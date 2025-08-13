from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException
import asyncio
import uuid
import random
import time
from typing import Dict
import json
import uvicorn

app = FastAPI()

# Session middleware
app.add_middleware(SessionMiddleware, secret_key="super-secret-key")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

with open("../frontend/src/assets/tasks.json", "r") as f:
    ALL_TASKS = json.load(f)
    f.close()

# Game state
connected_players: Dict[str, Dict] = {}
alive_players = None
player_roles = None
votes = {}
players_tasks = {}
ghost_players = []
sabotage_timers = {}
game_state = "welcome"
vote_start_time = None
MAX_PLAYERS = 20
TOTAL_TASKS = len(ALL_TASKS)
SABOTAGE_DURATION = 60
VOTE_DURATION = 120

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, player_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[player_id] = websocket

    def disconnect(self, player_id: str):
        if player_id in self.active_connections:
            del self.active_connections[player_id]

    async def send_personal_message(self, message: dict, player_id: str):
        if player_id in self.active_connections:
            await self.active_connections[player_id].send_json(message)

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            await connection.send_json(message)

manager = ConnectionManager()

@app.post("/api/join")
async def join_game(request: Request):
    global connected_players, game_state
    data = await request.json()
    name = data.get("name", "").strip()

    if not name:
        return JSONResponse(status_code=400, content={"error": "Name required"})

    if len(connected_players) >= MAX_PLAYERS:
        return JSONResponse(status_code=400, content={"error": "Lobby full"})

    player_id = str(uuid.uuid4())
    request.session["player_id"] = player_id
    request.session["name"] = name
    game_state = "lobby"
    
    connected_players[player_id] = {
        "id": player_id,
        "name": name,
        "ws": None,
        "session": request.session
    }

    await broadcast_player_list()

    return {"playerId": player_id, "playerName": name}

@app.get("/api/players")
async def get_players():
    await broadcast_player_list()
    players = [{"id": p["id"], "name": p["name"], "character": p["session"]["character"], "ghost": p["session"].get("is_ghost", False)} for p in connected_players.values()]

    return {"players": players}

async def broadcast_player_list():
    players = [{"id": p["id"], "name": p["name"]} for p in connected_players.values()]
    await manager.broadcast({
        "type": "players_update",
        "players": players,
        "starter_id": players[0]["id"] if players else None
    })

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global connected_players
    player_id = None
    
    await websocket.accept()
    
    try:
        # Initial authentication
        auth_data = await websocket.receive_json()
        if auth_data.get("type") != "auth":
            await websocket.close(code=1008, reason="Auth required")
            return

        player_id = auth_data.get("player_id")
        if not player_id or player_id not in connected_players:
            await websocket.close(code=1008, reason="Invalid player ID")
            return

        # Store WebSocket connection
        connected_players[player_id]["ws"] = websocket
        
        # Send initial data
        await send_player_list(websocket)
        await broadcast_player_list(exclude=player_id)

        # Main message loop
        while True:
            try:
                data = await websocket.receive_json()
                
                if data.get("type") == "join":
                    # Handle join message (if still needed)
                    if player_id in connected_players:
                        connected_players[player_id]["ws"] = websocket
                        
                        await websocket.send_json({
                            "type": "players_update",
                            "players": [
                                {"id": p["id"], "name": p["name"]}
                                for p in connected_players.values()
                            ],
                            "starter_id": list(connected_players)[0]
                        })
                        await broadcast_player_list()
                
                # Add other message type handlers here
                
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON format"})
            except KeyError as e:
                await websocket.send_json({"error": f"Missing field: {str(e)}"})

    except WebSocketDisconnect:
        print(f"Player {player_id} disconnected")
    except Exception as e:
        print(f"WebSocket error for player {player_id}: {str(e)}")
    finally:
        if player_id and player_id in connected_players:
            # Only clear if no new connection was established
            if connected_players[player_id]["ws"] == websocket:
                connected_players[player_id]["ws"] = None
            await broadcast_player_list()

async def send_player_list(websocket):
    players = [{"id": p["id"], "name": p["name"], "ghost": p["session"].get("is_ghost", False)} for p in connected_players.values()]
    await websocket.send_json({
        "type": "players_update",
        "players": players,
        "starter_id": players[0]["id"] if players else None
    })

async def broadcast_player_list(exclude=None):
    players = [{"id": p["id"], "name": p["name"]} for p in connected_players.values()]
    message = {
        "type": "players_update",
        "players": players,
        "starter_id": players[0]["id"] if players else None
    }
    
    for pid, player in connected_players.items():
        if pid != exclude and player["ws"]:
            try:
                await player["ws"].send_json(message)
            except:
                player["ws"] = None

@app.get("/api/session")
async def get_session(request: Request):
    player_id = request.session.get("player_id")
    name = request.session.get("name")

    if not player_id or not name:
        raise HTTPException(status_code=403, detail="Not joined")

    return {
        "player_id": player_id,
        "name": name,
        "game_state": game_state,
        "role": player_roles.get(player_id, {}).get("role") if player_roles else None,
        "character": player_roles.get(player_id, {}).get("character") if player_roles else None,
        "is_ghost": player_id in ghost_players
    }

def calc_num_impostors(num_players):
    if num_players < 8:
        return 1
    else:
        return 2

def assign_player_tasks(player_id: str):
    global ALL_TASKS, players_tasks
    players_tasks[player_id] = {}

    for task in ALL_TASKS:
        if not isinstance(task, dict):
            print(f"Warning: task is not a dict: {task}")
            continue
        if "id" not in task:
            print(f"Warning: task has no 'id': {task}")
            continue
        
        players_tasks[player_id][str(task["id"])] = False
    
@app.post("/api/start")
async def start_game(request: Request):
    global player_roles, game_state, connected_players, alive_players, players_tasks, sabotage_timers, votes, ghost_players
    
    player_id = request.session.get("player_id")
    if not player_id:
        raise HTTPException(status_code=403, detail="Not authenticated")
    
    # Only first player can start
    if connected_players and player_id != list(connected_players.keys())[0]:
        raise HTTPException(status_code=403, detail="Only lobby leader can start")

    if not connected_players:
        return JSONResponse(status_code=400, content={"error": "No players connected"})

    player_ids = list(connected_players.keys())
    num_players = len(player_ids)
    num_impostors = calc_num_impostors(num_players)
    alive_players = player_ids.copy()

    player_roles = None
    players_tasks = {}
    sabotage_timers = {}
    votes.clear()
    ghost_players.clear()

    roles = ["Impostor"] * num_impostors + ["Crewmate"] * (num_players - num_impostors)
    characters = [f"ch{i + 1}.png" for i in range(num_players)]

    random.shuffle(roles)
    random.shuffle(characters)
    random.shuffle(player_ids)

    player_roles = {}
    game_state = "pregame"

    for i, pid in enumerate(player_ids):
        role = roles[i]
        character = characters[i]
        player_roles[pid] = {"role": role, "character": character}
        assign_player_tasks(pid)

        player = connected_players[pid]
        player["session"]["role"] = role
        player["session"]["character"] = character
        player["session"]["is_ghost"] = False

        if player.get("ws"):
            try:
                # Send role assignment first
                await player["ws"].send_json({
                    "type": "role_assigned",
                    "role": role,
                    "character": character
                })
                # Then send game start command
                await player["ws"].send_json({
                    "type": "game_start",
                    "redirect": "/game"
                })
            except Exception as e:
                print(f"Error sending to {pid}: {e}")

    return {"message": "Game started", "players": len(player_ids), "impostors": num_impostors}

@app.post("/api/gamestate")
async def update_game_state(request: Request):
    try:
        data = await request.json()
        new_state = data.get("state")
        
        if not new_state:
            raise HTTPException(status_code=400, detail="Missing state parameter")
            
        valid_states = ["lobby", "pregame", "game", "vote"]
        if new_state not in valid_states:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid game state. Must be one of: {', '.join(valid_states)}"
            )

        # Update game state (consider using a proper state management solution)
        global game_state
        game_state = new_state
        
        return {"status": "success", "state": game_state}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# ───────────────────────────────────────────────────────────── tasky
# Nový endpoint na aktualizáciu úlohy hráča
@app.get("/api/tasks")
async def get_tasks(request: Request):
    player_id = request.session.get("player_id")
    if not player_id:
        raise HTTPException(status_code=403, detail="Not authenticated")

    # Example players_tasks[player_id]: {"3": False, "5": True}
    assigned_tasks = players_tasks.get(player_id, {})

    # Join with full task data
    full_tasks = []
    for task_id, done in assigned_tasks.items():
        task_data = next((t for t in ALL_TASKS if str(t["id"]) == str(task_id)), None)
        if task_data:
            full_tasks.append({
                **task_data,
                "done": done
            })

    return {"tasks": full_tasks}

@app.post("/api/update-task")
async def update_task(request: Request):
    global players_tasks, connected_players, TOTAL_TASKS
    data = await request.json()
    player_id = data.get("playerId")
    task_id = data.get("taskId")
    done = data.get("done")

    if not player_id or task_id is None or not isinstance(done, bool):
        return JSONResponse(status_code=400, content={"error": "Missing or invalid parameters"})

    if player_id not in connected_players:
        return JSONResponse(status_code=404, content={"error": "Player not connected"})

    start_time = sabotage_timers.get(player_id, 0)

    if time.time() - start_time < SABOTAGE_DURATION:
        return JSONResponse(
            status_code=403,
            content={"error": "Tasks locked during sabotage"}
        )
    
    # Inicializuj úlohy hráča, ak ešte nemá
    if player_id not in players_tasks:
        players_tasks[player_id] = {}

    players_tasks[player_id][str(task_id)] = done

    global_progress = await get_global_progress()

    if global_progress == 100:
        await send_results()
        game_state = "aftergame"
        return

    return {"globalProgress": global_progress}

# Endpoint na získanie globálneho progresu
async def get_global_progress():

    total_done = 0
    total_possible = 0
    
    for player_id, tasks in players_tasks.items():
        # Skip impostors - they don't contribute to task progress
        if player_roles.get(player_id)["role"] == "Impostor":
            continue
            
        # Count completed tasks for crewmates only
        completed = sum(1 for is_done in tasks.values() if is_done)
        total_done += completed
        total_possible += TOTAL_TASKS
    
    if total_possible == 0:
        global_progress = 0
    else:
        global_progress = round((total_done / total_possible) * 100)

    players = [{"id": p["id"], "name": p["name"]} for p in connected_players.values()]
    message = {
        "type": "global_progress",
        "progress": global_progress,
    }
    
    for pid, player in connected_players.items():
        try:
            await player["ws"].send_json(message)
        except:
            player["ws"] = None

    return global_progress

@app.get("/api/global-progress")
async def get_global_progress_endpoint(request: Request):
    player_id = request.session.get("player_id")
    if not player_id:
        raise HTTPException(status_code=403, detail="Not authenticated")

    total_done = 0
    total_possible = 0
    
    for player_id, tasks in players_tasks.items():
        # Skip impostors - they don't contribute to task progress
        if player_roles.get(player_id)["role"] == "Impostor":
            continue
            
        # Count completed tasks for crewmates only
        completed = sum(1 for is_done in tasks.values() if is_done)
        total_done += completed
        total_possible += TOTAL_TASKS
    

    global_progress = 0 if total_possible == 0 else round((total_done / total_possible) * 100)

    return {"globalProgress": global_progress}

@app.post("/api/sabotage")
async def start_sabotage(request: Request):
    player_id = request.session.get("player_id")
    if not player_id:
        return JSONResponse(status_code=403, content={"error": "Unauthorized"})
    
    # Only impostors can start sabotage
    if player_roles.get(player_id)['role'] != "Impostor":
        return JSONResponse(status_code=403, content={"error": "Only impostors can sabotage"})

    # Set timer for all players
    current_time = time.time()
    for pid in player_roles.keys():
        sabotage_timers[pid] = current_time
    
    return {"message": "Sabotage started", "duration": SABOTAGE_DURATION}

@app.get("/api/sabotage")
async def get_sabotage(request: Request):
    player_id = request.session.get("player_id")
    if not player_id:
        return JSONResponse(status_code=403, content={"error": "Unauthorized"})

    start_time = sabotage_timers.get(player_id)
    if not start_time:
        return JSONResponse(status_code=404, content={"error": "No active sabotage"})

    elapsed = time.time() - start_time
    remaining = max(0, SABOTAGE_DURATION - elapsed)

    return {
        "active": remaining > 0,
        "remaining": remaining,
        "endsAt": start_time + SABOTAGE_DURATION
    }

@app.get("/api/sabotage/status")
async def get_sabotage_status(request: Request):
    player_id = request.session.get("player_id")
    if not player_id:
        return JSONResponse(status_code=403, content={"error": "Unauthorized"})

    start_time = sabotage_timers.get(player_id)
    if not start_time:
        return {"active": False, "remaining": 0}
    
    elapsed = time.time() - start_time
    remaining = max(0, SABOTAGE_DURATION - elapsed)
    
    return {
        "active": remaining > 0,
        "remaining": remaining,
        "endsAt": start_time + SABOTAGE_DURATION
    }

# ───────────────────────────────────────────────────────────── session management
@app.post("/api/session/leave")
async def leave_game(request: Request):
    player_id = request.session.get("player_id")
    if player_id and player_id in connected_players:
        # Clean up player data
        if connected_players[player_id].get("ws"):
            try:
                await connected_players[player_id]["ws"].close()
            except:
                pass
        del connected_players[player_id]
    
    # Clear session
    request.session.clear()
    return {"message": "Left game"}

@app.post("/api/update-session")
async def update_session(request: Request):
    player_id = request.session.get("player_id")
    if not player_id:
        raise HTTPException(status_code=403, detail="Not authenticated")
    
    data = await request.json()
    
    # Update the session data
    for key, value in data.items():
        request.session[key] = value
    
    # Update the connected_players if needed
    if player_id in connected_players:
        if 'role' in data:
            connected_players[player_id]['session']['role'] = data['role']
        if 'character' in data:
            connected_players[player_id]['session']['character'] = data['character']

    return {
        "status": "success",
        **data
    }

@app.post("/api/leave-lobby")
async def leave_lobby(request: Request):
    player_id = request.session.get("player_id")
    if player_id and player_id in connected_players:
        if connected_players[player_id].get("ws"):
            try:
                await connected_players[player_id]["ws"].close()
            except:
                pass
        del connected_players[player_id]
        await broadcast_player_list()
    
    # Clear the session completely
    request.session.clear()
    return {"message": "Left lobby"}

@app.post("/api/reset-lobby")
async def reset_lobby():
    global connected_players, game_state
    game_state = "welcome"
    connected_players = Dict[str:Dict] = {}
    return {"message": 'Lobby reseted'}

@app.get("/api/game/end")
async def end_game():
    global player_roles, players_tasks, sabotage_timers, game_state
    
    # Only allow game owner or admin to end game
    # player_id = request.session.get("player_id")
    # if not player_id:
    #     raise HTTPException(status_code=403, detail="Not authenticated")
    
    # Reset game state
    player_roles = None
    players_tasks = {}
    sabotage_timers = {}
    votes.clear()
    ghost_players.clear()
    game_state = "lobby"

    # Keep players connected but clear their game-specific session data
    for pid, player in connected_players.items():
        if "session" in player:
            player["session"].pop("role", None)
            player["session"].pop("character", None)
            player["session"].pop("is_ghost", None)
        
    return {"message": "Game ended, returning to lobby"}

#───────────────────────────────────────────────────────────── emergency meetings
@app.post("/api/emergency/call")
async def call_emergency(request: Request):
    global game_state
    
    player_id = request.session.get("player_id")

    if not player_id:
        raise HTTPException(status_code=403, detail="Not authenticated")
    
    if game_state == "emergency":
        raise HTTPException(status_code=400, detail="Emergency already active")

    game_state = "emergency"

    # Broadcast emergency flash to all players
    caller_name = connected_players[player_id]["name"]

    for pid, player in connected_players.items():
        if player.get("ws"):
            try:
                await player["ws"].send_json({
                    "type": "emergency_flash",
                    "caller_name": caller_name
                })
            except Exception as e:
                print(f"Error sending redirect to {pid}: {e}")

    # Start countdown to redirect to vote
    asyncio.create_task(start_voting_after(10))  # 10 seconds of flashing

    return {"message": "Emergency meeting called"}

async def start_voting_after(seconds):
    global game_state, votes, vote_start_time
    
    # Count down and broadcast to all clients
    for i in range(seconds, 0, -1):
        for pid, player in connected_players.items():
            if player.get("ws"):
                try:
                    await player["ws"].send_json({
                        "type": "emergency_countdown",
                        "seconds_left": i
                    })
                except Exception as e:
                    print(f"Error sending countdown to {pid}: {e}")
        await asyncio.sleep(1)

    # Initialize voting state
    game_state = "vote"
    votes = {}
    vote_start_time = time.time()

    # Broadcast voting start with initial time
    for pid, player in connected_players.items():
        if player.get("ws"):
            try:
                await player["ws"].send_json({
                    "type": "vote_started",
                    "time_left": VOTE_DURATION,
                    "votes": votes
                })
            except Exception as e:
                print(f"Error sending vote start to {pid}: {e}")

    # Start background task to update time for all clients
    asyncio.create_task(update_vote_time())

async def update_vote_time():
    global game_state, votes, vote_start_time
    """Background task to update time remaining for all clients"""
    while game_state == "vote":
        time_left = max(0, VOTE_DURATION - (time.time() - vote_start_time))
        
        # End voting if time's up
        if time_left <= 0:
            await end_voting()
            await calculate_result()
            break
        else:
            # Broadcast to all connected players
            for pid, player in connected_players.items():
                if player.get("ws"):
                    try:
                        await player["ws"].send_json({
                            "type": "vote_update",
                            "time_left": time_left,
                            "votes": votes
                        })
                    except Exception as e:
                        print(f"Error sending time update to {pid}: {e}")

            await asyncio.sleep(1)

async def end_voting():
    global game_state, alive_players

    if len(alive_players) <= (2+calc_num_impostors(len(connected_players))):
        game_state = "after_game"
    else:
        game_state = "game"

# ────────────────────────────────────────────────────────────── report
@app.post("/api/report")
async def submit_report(request: Request):
    global game_state, alive_players
    data = await request.json()
    reported_id = data.get("reportedPlayerId")
    
    # Store the report
    ghost_players.append(reported_id)
    connected_players[reported_id]["session"]["is_ghost"] = True
    alive_players.remove(reported_id)
    game_state = "vote"


    if len(alive_players) <= (2+calc_num_impostors(len(connected_players))):
        await send_results()
        return
        # await end_game()

    # Notify all players about the report
    for pid, player in connected_players.items():
        if player.get("ws"):
            try:
                await player["ws"].send_json({
                    "type": "report",
                    "name": connected_players[reported_id]["session"]["name"],
                    "character": connected_players[reported_id]["session"]["character"],
                })
            except Exception as e:
                print(f"Error sending report to {pid}: {e}")
    
    asyncio.create_task(start_voting_after(10))  # 10 seconds of flashing
    
    return {"message": "Report received"}

@app.post('/api/vote')
async def submit_vote(request: Request):
    global game_state, votes

    if game_state != "vote":
        raise HTTPException(status_code=400, detail="Not in voting phase")

    data = await request.json()
    voter_id = data.get("voterId")  # Should come from session or client
    target_id = data.get("targetId")

    if not voter_id:
        raise HTTPException(status_code=400, detail="Invalid vote")

    # Record the vote (overwrites if same voter votes again)
    votes[voter_id] = target_id

    if len(votes) == len(alive_players):
       await calculate_result()
       return 

    # Broadcast updated votes to all clients
    for pid, player in connected_players.items():
        if player.get("ws"):
            try:
                await player["ws"].send_json({
                    "type": "vote_update",
                    "time_left": max(0, VOTE_DURATION - (time.time() - vote_start_time)),
                    "votes": votes
                })
            except Exception as e:
                print(f"Error sending vote update to {pid}: {e}")


    return {"message": "Vote submitted", "votes": votes}

async def calculate_result():
    global alive_players, ghost_players, connected_players
    
    results = process_votes(votes, alive_players)
    
    # Handle case where someone was ejected
    if results:
        alive_players.remove(results)
        ghost_players.append(results)
        connected_players[results]["session"]["is_ghost"] = True

        print(len(alive_players))
        print(2+calc_num_impostors(len(connected_players)))
        print("imp count:", len(get_impostors_ids()))

        # Check if game should end
        if len(alive_players) <= (2+calc_num_impostors(len(connected_players))) or (connected_players[results]["session"]['role'] == "Impostor" and len(get_impostors_ids()) == 0):
            print("som tuna :(")
            await send_results()
            return 
        
        # Send ejection results to all players
        for pid, player in connected_players.items():
            if player.get("ws"):
                try:
                    await player["ws"].send_json({
                        "type": "results",
                        "ejected": {
                            "name": connected_players[results]['name'],
                            'character': connected_players[results]['session']['character'],
                            'role': connected_players[results]['session']['role'],
                        }
                    })
                except Exception as e:
                    print(f"Error sending vote update to {pid}: {e}")
    
    # Handle case where no one was ejected
    else:        
        for pid, player in connected_players.items():
            if player.get("ws"):
                try:
                    await player["ws"].send_json({
                        "type": "results",
                        "ejected": None  # Explicitly indicate no ejection
                    })
                except Exception as e:
                    print(f"Error sending vote update to {pid}: {e}")
    
    await end_voting()

def get_impostors_ids():
    global connected_players
    # Find all impostor IDs
    impostor_ids = [
        pid for pid, pdata in connected_players.items()
        if pdata["session"]["role"] == "Impostor" and pdata["session"]["is_ghost"] == False
    ]
    return impostor_ids

@app.get("/api/results")
async def get_results():
    global connected_players, alive_players, game_state

    pg = await get_global_progress()

    impostor_ids = get_impostors_ids()

    if pg == 100:
        winner = "Crew"
    else:
        if any(pid in alive_players for pid in impostor_ids):
            winner = "Impostor"
        else:
            winner = "Crew"

    # game_state = 'lobby'  # if needed, uncomment

    return {"winner": winner}

async def send_results():
    global connected_players, alive_players, game_state

    pg = await get_global_progress()

    impostor_ids = get_impostors_ids()

    if pg == 100:
        winner = "Crew"
    else:
        if any(pid in alive_players for pid in impostor_ids):
            winner = "Impostor"
        else:
            winner = "Crew"

    print(winner)
    game_state = 'aftergame'

    for pid, player in connected_players.items():
        if player.get("ws"):
            try:
                await player["ws"].send_json({
                    "type": "game_end",
                    'winner': winner,
                })
            except Exception as e:
                print(f"Error sending vote update to {pid}: {e}")

    # await end_game()

def process_votes(votes, alive_players):
    """
    votes: dict {voter_id: target_id or None}
    alive_players: list of player_ids that are still alive
    
    Returns:
    - player_id if someone is ejected
    - None if no one is ejected (tie, insufficient votes, or majority skipped)
    """
    # Only process if all alive players have voted
    if len(votes) < len(alive_players):
        return None  # Not all votes in yet

    # Count skip votes
    skip_votes = sum(1 for target in votes.values() if target is None)
    
    # If majority skipped (half or more), no one gets ejected
    if skip_votes >= len(alive_players) / 2:
        return None

    # Count votes per target (excluding skip votes)
    vote_count = {}
    for voter, target in votes.items():
        if target is not None:  # skip "skip vote"
            vote_count[target] = vote_count.get(target, 0) + 1

    # Find max votes received
    max_votes = max(vote_count.values()) if vote_count else 0
    # Players with the most votes
    top_targets = [pid for pid, count in vote_count.items() if count == max_votes]

    # Majority rule: must have > half of NON-SKIP votes to eject
    required_majority = (len(alive_players) - skip_votes) / 2
    if max_votes > required_majority:
        if len(top_targets) == 1:
            return top_targets[0]  # Clear winner
        return None  # Tie - no ejection
    
    return None  # No majority reached

@app.get('/api/votes')
async def get_votes():
    global game_state, votes, vote_start_time
    time_left = max(0, VOTE_DURATION - (time.time() - vote_start_time)) if game_state == "vote" else 0
    return {
        "votes": votes,
        "time_left": time_left,
        "game_state": game_state
    }

if __name__ == "__main__":
    uvicorn.run(
        "server:app", 
        host="0.0.0.0", 
        port=8000,
        ws_ping_interval=20,
        ws_ping_timeout=20,
        reload=True,
        log_level="info"
    )