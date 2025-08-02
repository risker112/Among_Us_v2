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

# Game state
connected_players: Dict[str, Dict] = {}
player_roles = None
game_state = "welcome"
MAX_PLAYERS = 13

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
    await websocket.accept()
    player_id = None
    
    try:
        # Step 1: Receive authentication
        data = await websocket.receive_json()
        print(f"WebSocket connection established with data: {data}")
        if data.get("type") != "auth":
            await websocket.close(code=1008, reason="Auth required")
            return

        player_id = data.get("player_id")

        if not player_id or player_id not in connected_players:
            await websocket.close(code=1008, reason="Invalid player ID")
            return

        # Update player's WebSocket connection
        connected_players[player_id]["ws"] = websocket

        # Send immediate player list update
        await send_player_list(websocket)
        
        # Broadcast to all other players
        await broadcast_player_list(exclude=player_id)

        # Step 2: Normal message handling
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "join":
                player_id = message["id"]
                name = message["name"]
                print(connected_players)
                if player_id in connected_players:
                    connected_players[player_id]["ws"] = websocket
                    print(f"{name} joined via socket")
                    
                    # ✅ Send updated player list directly to the new player
                    await websocket.send_json({
                        "type": "players_update",
                        "players": [
                            {"id": p["id"], "name": p["name"]}
                            for p in connected_players.values()
                        ],
                        "starter_id": list(connected_players)[0]  # first player as starter
                    })

                    # 🔁 Then broadcast to others if needed
                    await broadcast_player_list()

    except WebSocketDisconnect:
        print(f"Player {player_id} disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if player_id and player_id in connected_players:
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
    game_state = "game"

    for i, pid in enumerate(player_ids):
        role = roles[i]
        character = characters[i]
        player_roles[pid] = {"role": role, "character": character}

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

# ───────────────────────────────────────────────────────────── tasky
# Nový endpoint na aktualizáciu úlohy hráča
@app.post("/api/update-task")
async def update_task(request: Request):
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

    return {"globalProgress": global_progress}

# Endpoint na získanie globálneho progresu
@app.get("/api/global-progress")
async def get_global_progress():
    total_done = 0
    total_possible = 0
    for pid, tasks in players_tasks.items():
        total_done += sum(1 for v in tasks.values() if v)
        total_possible += TOTAL_TASKS

    global_progress = 0 if total_possible == 0 else round((total_done / total_possible) * 100)
    return {"progress": global_progress}

# global state or per-player storage
sabotage_timers = {}

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

# @app.get("/api/session")
# async def get_session(request: Request):
#     global game_state, connected_players
#     player_id = request.session.get("player_id")
#     name = request.session.get("name")

#     if not player_id or not name:
#         raise HTTPException(status_code=403, detail="Not joined")

#     role = None
#     character = None

#     # vezmeme z backendovej session kópie
#     if player_id in connected_players:
#         session_data = connected_players[player_id].get("session", {})
#         role = session_data.get("role")
#         character = session_data.get("character")

#     return {
#         "game_state": game_state,
#         "player_id": player_id,
#         "name": name,
#         "role": role,
#         "character": character
#     }

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


# Add this endpoint to get full game state
# @app.get("/api/game/state")
# async def get_full_game_state(request: Request):
#     player_id = request.session.get("player_id")
#     if not player_id:
#         raise HTTPException(status_code=403, detail="Not authenticated")
    
#     return {
#         "game_state": game_state,
#         "player_id": player_id,
#         "role": request.session.get("role"),
#         "character": request.session.get("character")
#     }

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










