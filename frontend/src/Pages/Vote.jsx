import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../SessionProvider';
import { useSocket } from '../SocketProvider';
import EjectionScreen from '../Components/EjectionScreen';
import ResultScreen from '../Components/ResultScreen';

export default function VotePage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [votes, setVotes] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [votingComplete, setVotingComplete] = useState(false);
  const { session } = useSession();
  const { socket, addMessageListener } = useSocket();
  const [result, setResult] = useState(false);
  const [gameEnd, setGameEnd] = useState(false);

  // Initialize WebSocket connection
   // Initialize and handle socket messages
  useEffect(() => {
    const handleSocketMessage = (data) => {
      console.log('Vote recieved', data);
      switch (data.type) {
        case 'vote_started':
          setTimeLeft(data.time_left);
          setVotes(data.votes || {});
          setVotingComplete(false);
          break;
        case 'vote_update':
          setTimeLeft(data.time_left);
          setVotes(data.votes || {});
          break;
        case 'vote_ended':
          setVotingComplete(true);
          // Handle vote results if needed
          break;
        case 'game_end':
          setGameEnd(data.winner)
          // navigate(data.path);
          break;
        case 'results':
          setResult({
            name: data.ejected.name,
            character: data.ejected.character,
            role: data.ejected.role
          });
          break;
        default:
          break;
      }
    };

    addMessageListener(handleSocketMessage);

    return () => {
      addMessageListener(handleSocketMessage);
    };
  }, [navigate, addMessageListener]);

  // Fetch players data
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await fetch('/api/players');
        const data = await response.json();
        setPlayers(data.players.filter(p => !p.isDead));
      } catch (error) {
        console.error('Failed to fetch players:', error);
      }
    };
    fetchPlayers();

    // Initial fetch of vote state
    const fetchVoteState = async () => {
      try {
        const response = await fetch('/api/votes');
        const data = await response.json();
        setTimeLeft(data.time_left);
        setVotes(data.votes || {});
        setVotingComplete(data.game_state !== 'vote');
      } catch (error) {
        console.error('Failed to fetch vote state:', error);
      }
    };
    fetchVoteState();
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleVote = (playerId) => {
    if (votingComplete || session?.is_ghost) return;
    setSelectedPlayer(selectedPlayer === playerId ? null : playerId);
  };

  const submitVote = async () => {
    if (!selectedPlayer || !session.player_id) return;

    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          voterId: session.player_id,
          targetId: selectedPlayer 
        })
      });

      if (!response.ok) throw new Error('Failed to submit vote');
      
      setVotingComplete(true);
    } catch (error) {
      console.error('Vote submission error:', error);
      // Optionally show error to user
    }
  };

  const skipVote = async () => {
    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          voterId: session.player_id,
          targetId: null // Indicates skipped vote
        })
      });

      if (!response.ok) throw new Error('Failed to skip vote');
      
      setVotingComplete(true);
    } catch (error) {
      console.error('Skip vote error:', error);
    }
  };

  if (result) return (<EjectionScreen result={result}></EjectionScreen>);
  if (gameEnd) return (<ResultScreen></ResultScreen>);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 mt-5">VOTE</h1>
        <div className="text-2xl font-mono bg-gray-800 inline-block px-4 py-2 rounded mt-5">
          ⏱️ {formatTime(timeLeft)}
        </div>
      </header>

      <div className="flex-grow mb-8 space-y-4 max-w-md w-full mx-auto">
        {players.map((player) => (
          <button
            key={player.id}
            onClick={() => handleVote(player.id)}
            className={`relative w-full p-4 rounded-lg transition-all border-2 flex items-center gap-4 ${
              selectedPlayer === player.id
                ? 'border-red-500 bg-gray-800'
                : 'border-gray-700 hover:border-gray-600'
            }`}
            disabled={player?.id === session?.player_id || player?.ghost}
          >
            <div className="w-16 h-16 flex-shrink-0 overflow-hidden rounded-md">
              <img
                src={`/src/assets/characters/${player.character}`}
                alt={player.name}
                className={`w-full h-full object-cover ${player.ghost ? 'grayscale' : ''}`}
              />
            </div>

            <p className="font-medium text-lg">{player?.name} {player?.id === session?.player_id && '(You)'}</p>

            {/* Show vote indicators */}
            {Object.entries(votes).map(([voterId, targetId]) => (
              targetId === player.id && (
                <span key={voterId} className="ml-auto text-sm bg-gray-700 px-2 py-1 rounded">
                  Voted
                </span>
              )
            ))}
          </button>
        ))}
      </div>

      {(!votingComplete && !session?.is_ghost) && (
        <div className="mt-auto py-4 border-t border-gray-800">
          <div className="max-w-md w-full mx-auto">
            {selectedPlayer && (
              <p className="mb-4 text-center">
                Voting for: <span className="font-bold">
                  {players.find(p => p.id === selectedPlayer)?.name}
                </span>
              </p>
            )}
            
            <div className="flex justify-between gap-4">
              <button
                onClick={skipVote}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex-1"
              >
                Skip Vote
              </button>
              
              <button
                onClick={submitVote}
                disabled={!selectedPlayer}
                className={`px-6 py-3 rounded-lg text-lg font-bold flex-1 ${
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
      )}
    </div>
  );
}