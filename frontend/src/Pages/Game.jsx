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
  const [tasks, setTasks] = useState([]);
  const { addMessageListener } = useSocket();

  useEffect(() => {
    if (session?.role && session?.character) {
      setRole(session.role);
      setCharacter(session.character);
    }
  }, [session]);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const res = await fetch('/api/tasks');
        if (!res.ok) throw new Error('Failed to fetch tasks');
        const data = await res.json();
        setTasks(data.tasks);
      } catch (err) {
        console.error(err);
      }
    }
    fetchTasks();
  }, []);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const res = await fetch('/api/global-progress');
        if (!res.ok) throw new Error('Failed to fetch progress');
        const data = await res.json();
        setGlobalProgress(data.globalProgress);
      } catch (err) {
        console.error(err);
      }
    }
    fetchProgress();
  }, [navigate]);

  // Emergency redirect
  useEffect(() => {
    const removeListener = addMessageListener((msg) => {
      console.log('Game component received:', msg);
      if (msg.type === 'emergency_flash') {
        if (location.pathname !== '/game/emergency') {
          navigate('/game/emergency');
        }
      } else if (msg.type === 'global_progress') {
        console.log('Global progress update:', msg.progress);
        setGlobalProgress(msg.progress);
      }

    });

    return () => removeListener();
  }, [addMessageListener, location.pathname, navigate]);

  return (
    <div>
      <Outlet context={{ role, character, globalProgress, vote, emergency, tasks }} />
    </div>
  );
}

export default Game;
