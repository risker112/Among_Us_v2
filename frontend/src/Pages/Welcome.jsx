import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../SessionProvider.jsx';

export default function Welcome() {
  const { session } = useSession();
  const [playerName, setPlayerName] = useState(session?.name || '');
  const navigate = useNavigate();
  
  const handleJoinClick = async () => {
    const name = playerName.trim();
    if (!name) return alert('Enter name');

    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });

      if (!res.ok) throw new Error("Join failed");

      navigate('/lobby');
    } catch (err) {
      alert('Error joining room');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white px-4">
      <div className="flex flex-col items-center space-y-6 w-full max-w-xs">
        <img src="src/assets/logo.png" alt="Game Logo" className="w-32 sm:w-40 h-auto" />
        <input
          type="text"
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="w-full p-3 rounded bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
        />
        <button
          onClick={handleJoinClick}
          className="w-full bg-green-600 hover:bg-green-700 p-3 rounded font-semibold transition"
        >
          Join Room
        </button>
      </div>
    </div>
  );
}
