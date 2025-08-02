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
    console.log('Pregame component mounted');
    console.log('Session:', session);
    console.log('Role:', role);
    console.log('Character:', character);
    if (!role || !character) return;
    console.log('Starting countdown for role assignment...');
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [countdown, role, character]);


  // Handle fade out and navigation
  useEffect(() => {
    if (role && character && countdown === 0) {
      const timer1 = setTimeout(() => setFadeOut(true), 5000);
      const timer2 = setTimeout(() => navigate('/game'), 6000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [role, character, countdown, navigate]);

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