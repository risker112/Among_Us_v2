import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../SocketProvider';
import { useSession } from '../SessionProvider';

function Game() {
  const { session } = useSession();
  const [globalProgress, setGlobalProgress] = useState(0);
  const [vote, setVote] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [role, setRole] = useState(session?.role || 'spectator');
  const [character, setCharacter] = useState(session?.character || 'crewmate');
  const location = useLocation();
  const navigate = useNavigate();
  const { addMessageListener } = useSocket();

  useEffect(() => {
    if (session?.role && session?.character) {
      setRole(session.role);
      setCharacter(session.character);
    }
  }, [session]);

  // useEffect(() => {
  //   async function fetchGlobalProgress() {
  //     try {
  //       const res = await fetch('/api/global-progress');
  //       if (!res.ok) throw new Error('Failed to fetch global progress');
  //       const data = await res.json();
  //       setGlobalProgress(data.progress);
  //     } catch (err) {
  //       console.error(err);
  //     }
  //   }
  //   fetchGlobalProgress();
  // }, []);

  // Emergency redirect
  useEffect(() => {
    const removeListener = addMessageListener((msg) => {
      if (msg.type === 'emergency_flash') {
        if (location.pathname !== '/game/emergency') {
          navigate('/game/emergency');
        }
      }
    });

    return () => removeListener();
  }, [addMessageListener, location.pathname, navigate]);

  return (
    <div>
      <Outlet context={{ role, character, globalProgress, vote, emergency }} />
    </div>
  );
}

export default Game;
