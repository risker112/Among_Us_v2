import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../SessionProvider.jsx';
import { useSocket } from '../SocketProvider.jsx';

export default function Lobby() {
  const { session } = useSession();
  const { ready, sendMessage, addMessageListener } = useSocket();
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState(null);
  const [starterId, setStarterId] = useState(null);
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  
  useEffect(() => {
    if (!session) return;

    setPlayerId(session.player_id);

    if (session.game_state === 'game') {
      navigate('/pregame');
      return;
    }

    setIsLoading(false);
  }, [session, navigate]);

  useEffect(() => {
    const handleMessage = (msg) => {
      console.log('Component received:', msg);
      switch (msg.type) {
        case 'players_update':
          setPlayers(msg.players);
          setStarterId(msg.starter_id);
          break;
        case 'role_assigned':
          navigate('/pregame');
          break;
      }
    };

    const cleanup = addMessageListener(handleMessage);
    return cleanup; // always cleanup on unmount
  }, [addMessageListener, navigate]);

  useEffect(() => {
    if (ready && session?.player_id) {
      console.log('Sending join message');
      sendMessage({
        type: 'join',
        id: session.player_id,
        name: session.name
      });
    }
  }, [ready, session, sendMessage]);


  // Debug effect
  useEffect(() => {
    console.log('Players state changed:', players);
  }, [players]);

  const handleStartGame = async () => {
    try {
      const res = await fetch('/api/start', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error('Failed to start game');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLeaveLobby = async () => {
    try {
      await fetch('/api/leave-lobby', {
        method: 'POST',
        credentials: 'include',
      });
      navigate('/welcome');
    } catch (err) {
      setError('Failed to leave lobby');
    }
  };

  const handleResetLobby = async () => {
    try {
      await fetch('/api/reset-lobby', {
        method: "POST",
        credentials: "include",
      });
      navigate('/welcome')
    } catch {
      setError("Failed to reset lobby")
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading lobby...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <img src="/src/assets/logo.png" alt="Game Logo" className="w-64 sm:w-80 h-auto mb-6" />
      <h2 className="text-2xl font-bold mb-6">Lobby ({players.length}/13)</h2>

      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md mb-6">
        {players.length === 0 ? (
          <div className="text-xl font-semibold mb-4 text-center">Loading players ...</div>
        ) : (
          <>
            <h3 className="text-xl font-semibold mb-4">Players</h3>
              <ul className="space-y-2">
                {players.map((p, index) => (
                    <li
                    key={p.id}
                    className={`text-lg ${p.id === playerId ? 'text-green-400 font-medium' : ''}`}
                >
                  {index === 0 && '👑 '}
                  {p.name} 
                  {p.id === playerId && ' (You)'}
                </li>
            ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex space-x-4">
        <button
          onClick={handleLeaveLobby}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition"
        >
          Leave Lobby
        </button>

        {playerId === starterId && (
          <button
            onClick={handleStartGame}
            disabled={players.length < 2}
            className={`bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition
              ${players.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Start Game
          </button>
        )}

        <button
          onClick={handleResetLobby}
          className="bg-red-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded transition"
        >
          Reset Lobby
        </button>
      </div>
    </div>
  );
}