import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../SessionProvider.jsx';
import { useSocket } from '../SocketProvider.jsx';

export default function Pregame() {
  const { session, refreshSession } = useSession();
  const { socket, ready, addMessageListener } = useSocket();
  const [role, setRole] = useState(session?.role || null);
  const [character, setCharacter] = useState(session?.character || null);
  const [countdown, setCountdown] = useState(3);
  const [fadeOut, setFadeOut] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Track session changes
  useEffect(() => {
    if (session?.role && session?.character) {
      setRole(session.role);
      setCharacter(session.character);
    }
  }, [session]);

  // Handle countdown timer
  useEffect(() => {

    if (!role || !character) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [countdown, role, character]);


  useEffect(() => {
    let timer1, timer2;
    let isMounted = true;

    const updateGameState = async () => {
      if (role && character && countdown === 0) {
        try {
          const response = await fetch('/api/gamestate', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ state: 'game' }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update game state');
          }

          const data = await response.json();
          console.log('Game state updated:', data.state);

          if (isMounted) {
            timer1 = setTimeout(() => {
              setFadeOut(true);
              console.log('Fade out started');
            }, 5000);

            timer2 = setTimeout(() => {
              console.log('Navigating to game');
              navigate('/game');
            }, 6000);
          }
        } catch (error) {
          console.error('Error updating game state:', error);
          if (isMounted) {
            setError(error.message);
          }
        }
      }
    };

    updateGameState();

    return () => {
      isMounted = false;
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [role, character, countdown, navigate, setFadeOut, setError]);

  // Error state
  if (error) {
    return (
      <div className="text-red-500 text-xl flex justify-center items-center min-h-screen bg-black">
        {error}
      </div>
    );
  }

  // Loading state
  if (!session?.player_id || !session?.name) {
    return (
      <div className="text-white text-xl flex justify-center items-center min-h-screen bg-black">
        Loading session...
      </div>
    );
  }

  // Countdown state
  if (countdown > 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white text-6xl font-bold">
        {countdown > 0 ? countdown : 'Waiting for role assignment...'}
      </div>
    );
  }

  // Main pregame display
  return (
    <div className={`flex flex-col items-center justify-center min-h-screen bg-black text-white transition-opacity duration-1000 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      <h1 className={`text-6xl font-bold mb-8 ${role === 'Impostor' ? 'text-red-600' : 'text-green-600'}`}>
        {role}
      </h1>
      <h2 className="text-4xl mb-6">{session.name}</h2>
      {character && (
        <img
          src={`/src/assets/characters/${character}`}
          alt="Character"
          className="w-48 h-48 object-contain"
        />
      )}
    </div>
  );
}