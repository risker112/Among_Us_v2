import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../SocketProvider';
import { useSession } from '../SessionProvider';
import ReportedBody from '../Components/ReportedBody.jsx';

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
  const [reportedPlayer, setReportedPlayer] = useState({
    character: '',
    name: ''
  });
  const [report, setReport] = useState(false);
  const [sabotageActive, setSabotageActive] = useState(false);

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
    const checkSabotage = async () => {
      try {
          const res = await fetch("/api/sabotage", { credentials: 'include' });
          const data = await res.json();
        setSabotageActive(data.active);
      } catch (err) {
        console.error('Failed to check sabotage:', err);
      }
    };
    
    checkSabotage();
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
      } else if (msg.type === 'report') {
        setReport(true);
        setReportedPlayer({
          character: msg.character,
          name: msg.name,
        });
      } else if (msg.type === 'game_end') {
        navigate('/game/aftergame')
      } else if (msg.type === 'sabotage_active') {
          setSabotageActive(true);
        } 
    });

    return () => removeListener();
  }, [addMessageListener, location.pathname, navigate]);

  return (
    <div>
      {report ? (
        <ReportedBody character={reportedPlayer.character} name={reportedPlayer.name} />
      ) : (
        <Outlet context={{ role, character, globalProgress, vote, emergency, tasks, sabotageActive }} />
      )}
    </div>
  );
}

export default Game;
