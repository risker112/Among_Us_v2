import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function VotePage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [votes, setVotes] = useState({}); // Track who voted for whom
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes in seconds
  const [votingComplete, setVotingComplete] = useState(false);

  // Fetch players data
  useEffect(() => {
    const fetchPlayers = async () => {
      const response = await fetch('/api/players');
      const data = await response.json();
      setPlayers(data.players.filter(p => !p.isDead)); // Exclude dead players
    };
    fetchPlayers();
  }, []);

  // Countdown timer
  useEffect(() => {
    const timer = timeLeft > 0 && setInterval(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleVote = (playerId) => {
    if (votingComplete) return; // Prevent voting after completion
    setSelectedPlayer(selectedPlayer === playerId ? null : playerId);
  };

  const submitVote = async () => {
    if (!selectedPlayer) return;
    setVotes(prev => ({
      ...prev,
      [selectedPlayer]: [...(prev[selectedPlayer] || []), 'currentPlayerId'] // Replace 'currentPlayerId' with actual ID
    }));
    setVotingComplete(true);

    // Send vote to server
    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: selectedPlayer })
      });
      if (!response.ok) throw new Error('Failed to submit vote');
      // Handle successful vote submission
    } catch (error) {
      console.error('Vote submission error:', error);
      // Optionally handle error state
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      {/* Header with timer */}
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">VOTE</h1>
        <div className="text-2xl font-mono bg-gray-800 inline-block px-4 py-2 rounded">
          ⏱️ {formatTime(timeLeft)}
        </div>
      </header>

      {/* Player voting grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8 flex-grow">
        {players.map((player) => (
          <button
            key={player.id}
            onClick={() => handleVote(player.id)}
            className={`relative p-3 rounded-lg transition-all border-2 ${
              selectedPlayer === player.id
                ? 'border-red-500 bg-gray-800'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            {/* Player image */}
            <div className="w-full aspect-square mb-2 overflow-hidden rounded-md">
              <img
                src={`/src/assets/characters/${player.character}`}
                alt={player.name}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Player name */}
            <p className="font-medium text-center">{player.name}</p>
            
            {/* Voting indicators */}
            {/* <div className="absolute -top-2 -right-2 flex space-x-1">
              {votes[player.id]?.map((voterId) => (
                <img
                  key={voterId}
                  src={`/src/assets/characters/${players.find(p => p.id === voterId)?.character}`}
                  alt="voter"
                  className="w-6 h-6 rounded-full border border-white"
                />
              ))}
            </div> */}
          </button>
        ))}
      </div>
      {!votingComplete && (
        <>
           {/* Vote submission */}
            <div className="mt-auto py-4 border-t border-gray-800">
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setVotingComplete(true)} // Or whatever skip does
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Skip Vote
              </button>
              
              <div className="text-center">
                {selectedPlayer && (
                  <p className="mb-2">
                    Voting for: <span className="font-bold">
                      {players.find(p => p.id === selectedPlayer)?.name}
                    </span>
                  </p>
                )}
                <button
                  onClick={submitVote}
                  disabled={!selectedPlayer}
                  className={`px-8 py-3 rounded-lg text-lg font-bold ${
                    selectedPlayer
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gray-600 cursor-not-allowed'
                  }`}
                >
                  Confirm Vote
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}