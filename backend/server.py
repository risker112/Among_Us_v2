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
player_roles = None
players_tasks = {}
sabotage_timers = {}
game_state = "welcome"
MAX_PLAYERS = 13
TOTAL_TASKS = 3

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
                        print(f"{connected_players[player_id]['name']} reconnected")
                        
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
    players = [{"id": p["id"], "name": p["name"]} for p in connected_players.values()]
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
        "character": player_roles.get(player_id, {}).get("character") if player_roles else None
    }

def calc_num_impostors(num_players):
    if num_players <= 6:
        return 1
    elif num_players <= 13:
        return 2
    else:
        # případně rozšířit logiku pro víc hráčů
        return max(2, num_players // 7)  # třeba 1 Impostor na každých 7 hráčů

def assign_player_tasks(player_id: str):
    """Assign unique tasks to each player based on their role."""
    global ALL_TASKS, players_tasks, assigned_task_ids
    
    # Initialize if not exists
    if 'assigned_task_ids' not in globals():
        assigned_task_ids = set()
    
    role = player_roles.get(player_id)['role']
    players_tasks[player_id] = {}  # Reset tasks for this player
    print(f"Assigning tasks for {player_id} (Role: {role})")
    if role == "Impostor":
        print(role)

        # Assign fake tasks (sabotage)
        available_fake_tasks = [t for t in ALL_TASKS 
                              if t["type"] == "sabotage" 
                              and t["id"] not in assigned_task_ids]
        
        for _ in range(min(TOTAL_TASKS, len(available_fake_tasks))):
            task = random.choice(available_fake_tasks)
            players_tasks[player_id][str(task["id"])] = False
            assigned_task_ids.add(task["id"])
            available_fake_tasks.remove(task)  # Prevent re-selection
            
    else:
        print(role)
        # Assign real tasks (normal)
        available_real_tasks = [t for t in ALL_TASKS 
                              if t["type"] == "normal" 
                              and t["id"] not in assigned_task_ids]
        
        for _ in range(min(TOTAL_TASKS, len(available_real_tasks))):
            task = random.choice(available_real_tasks)
            players_tasks[player_id][str(task["id"])] = False
            assigned_task_ids.add(task["id"])
            available_real_tasks.remove(task)  # Prevent re-selection
    
    print(f"Assigned tasks to {player_id} (Role: {role}): {players_tasks[player_id]}")

@app.post("/api/start")
async def start_game(request: Request):
    global player_roles, game_state, connected_players
    
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

    # Inicializuj úlohy hráča, ak ešte nemá
    if player_id not in players_tasks:
        players_tasks[player_id] = {}

    players_tasks[player_id][str(task_id)] = done

    # Spočítaj globálny progress (v %)
    total_done = 0
    total_possible = 0
    for pid, tasks in players_tasks.items():
        total_done += sum(1 for v in tasks.values() if v)
        total_possible += TOTAL_TASKS

    global_progress = 0 if total_possible == 0 else round((total_done / total_possible) * 100)

    await get_global_progress(global_progress)

    return {"globalProgress": global_progress}

# Endpoint na získanie globálneho progresu
async def get_global_progress(global_progress=0):
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

@app.get("/api/global-progress")
async def get_global_progress_endpoint(request: Request):
    player_id = request.session.get("player_id")
    if not player_id:
        raise HTTPException(status_code=403, detail="Not authenticated")

    total_done = 0
    total_possible = 0
    for tasks in players_tasks.values():
        total_done += sum(1 for v in tasks.values() if v)
        total_possible += TOTAL_TASKS

    global_progress = 0 if total_possible == 0 else round((total_done / total_possible) * 100)

    return {"globalProgress": global_progress}

@app.post("/api/sabotage")
async def start_sabotage(request: Request):
    player_id = request.session.get("player_id")
    if not player_id:
        return JSONResponse(status_code=403, content={"error": "Unauthorized"})

    sabotage_timers[player_id] = time.time()
    return {"startedAt": sabotage_timers[player_id]}

@app.get("/api/sabotage")
async def get_sabotage_timer(request: Request):
    player_id = request.session.get("player_id")
    if not player_id:
        return JSONResponse(status_code=403, content={"error": "Unauthorized"})

    started = sabotage_timers.get(player_id)
    return {"startedAt": started}

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

    print(f"Updated session for player {player_id}: {data}")
    print(connected_players[player_id]['session'])
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

@app.get("/api/game/end")
async def end_game(request: Request):
    global player_roles, players_tasks, sabotage_timers, game_state
    
    # Only allow game owner or admin to end game
    # player_id = request.session.get("player_id")
    # if not player_id:
    #     raise HTTPException(status_code=403, detail="Not authenticated")
    
    # Reset game state
    player_roles = None
    players_tasks = {}
    sabotage_timers = {}
    game_state = "lobby"

    # Keep players connected but clear their game-specific session data
    for pid, player in connected_players.items():
        if "session" in player:
            player["session"].pop("role", None)
            player["session"].pop("character", None)
        
        # Notify players via WebSocket
        if player.get("ws"):
            try:
                await player["ws"].send_json({
                    "type": "game_ended",
                    "message": "Game has been reset"
                })
            except:
                pass
    
    await broadcast_player_list()
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
    global game_state

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

    # Change game state
    game_state = "vote"

    # Final redirect broadcast
    for pid, player in connected_players.items():
        if player.get("ws"):
            try:
                await player["ws"].send_json({
                    "type": "redirect",
                    "path": "/game/vote"
                })
            except Exception as e:
                print(f"Error sending redirect to {pid}: {e}")

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