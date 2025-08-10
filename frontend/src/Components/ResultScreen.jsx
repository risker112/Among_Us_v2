import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ResultScreen() {
  const navigate = useNavigate();
  const [winner, setWinner] = useState(null);

  const resultMessages = {
    Impostor: {
      title: 'IMPOSTORS WIN!',
      subtitle: 'The crew has been eliminated',
      color: 'text-red-600',
      bg: 'bg-gray-900',
      border: 'border-red-600',
    },
    Crew: {
      title: 'CREWMATES WIN!',
      subtitle: 'All impostors have been ejected',
      color: 'text-green-600',
      bg: 'bg-gray-900',
      border: 'border-green-600',
    }
  };

  useEffect(() => {
    fetch('/api/results')
      .then(res => res.json())
      .then(data => setWinner(data.winner))
      .catch(err => console.error('Error fetching results:', err));

    // Po 10 sekundách najskôr zmeníme stav hry na 'lobby', potom presmerujeme
    const timer = setTimeout(() => {
      fetch('/api/gamestate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'lobby' }),
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to update game state');
          return res.json();
        })
        .then(() => {
          navigate('/lobby');
        })
        .catch(err => console.error('Error updating game state:', err));
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigate]);

  if (!winner) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="inline-block animate-pulse">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
          <h1 className="text-white text-3xl font-bold">Loading results...</h1>
        </div>
      </div>
    );
  }

  console.log(winner)
  const { title, subtitle, color, bg, border } = resultMessages[winner];
  console.log(resultMessages[winner])

  return (
    <div className={`fixed inset-0 ${bg} flex items-center justify-center p-4`}>
      <div className="max-w-4xl w-full mx-4">
        <div className={`text-center p-8 md:p-12 rounded-xl border-4 ${border} bg-gray-800/90 backdrop-blur-sm`}>
          <h1 className={`text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 ${color}`}>
            {title}
          </h1>
          <h2 className="text-xl sm:text-2xl md:text-3xl text-gray-300 mb-8">
            {subtitle}
          </h2>
          
          <div className="mt-12 text-gray-400 text-sm md:text-base">
            <p>Returning to lobby in 10 seconds...</p>
          </div>
        </div>
      </div>
    </div>
  );
}