import React from 'react';
import ActionButtons from './ActionButtons.jsx';
import GlobalProgress from './GlobalProgress.jsx';
import { useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSession } from '../SessionProvider.jsx';
import ReportModal from './ReportModal.jsx';

export default function Impostor() {
  const { session } = useSession();
  const { globalProgress, tasks: backendTasks } = useOutletContext();
  const [myTasks, setMyTasks] = useState([]);
  const [progress, setProgress] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false); 
  const [players, setPlayers] = useState(null);

  const [cooldown, setCooldown] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  // Load my tasks from backendTasks
  useEffect(() => {
    if (!backendTasks || backendTasks.length === 0) return;

    // Assume backend sends: [{id, title, done}, ...]
    setMyTasks(backendTasks.map(task => ({
      id: task.id,
      title: task.title,
      done: task.done || false,
    })));
  }, [backendTasks]);

  // Calculate progress
  useEffect(() => {
    if (!myTasks.length) {
      setProgress(0);
      return;
    }
    const doneCount = myTasks.filter(t => t.done).length;
    setProgress(Math.round((doneCount / myTasks.length) * 100));
  }, [myTasks]);

  const toggleTask = async (id) => {
    // Optimistic update
    setMyTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const handleReportKill = () => {
    fetch('api/players', {
      method: 'GET',
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        console.log('Players fetched:', data);
        setPlayers(data.players);
        setShowReportModal(true);
      })
      .catch(err => console.error('Failed to fetch players:', err));
  };

  const handleReportSubmit = (reportedPlayerId) => {
    console.log('Reporting player:', reportedPlayerId);
    // Send to backend:
    fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporterId: session.player_id,
        reportedPlayerId,
      }),
    });
    setShowReportModal(false);
  };

  const onSabotage = async () => {
    const res = await fetch("/api/sabotage", {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    setCooldown(true);
    setTimeLeft(data.cooldown); // local timer starts fresh
  };

    useEffect(() => {
    const fetchCooldown = async () => {
      const res = await fetch("/api/sabotage", { credentials: 'include' });
      const data = await res.json();
      if (data.cooldown) {
        const cooldown = Math.floor(data.cooldown);
        if (cooldown > 0) {
          setCooldown(true);
          setTimeLeft(cooldown);
        }
      }
    };
    fetchCooldown();
  }, []);

  useEffect(() => {
    if (!cooldown) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setCooldown(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col">

      {showReportModal && (
        <ReportModal
          players={players}
          onReport={handleReportSubmit}
          onClose={() => setShowReportModal(false)}
        />
      )}

      <GlobalProgress progress={globalProgress} />
      <h1 className="text-3xl font-bold text-center my-4">My Tasks</h1>
      {/* <p className="text-center mb-6">As an Impostor, you can sabotage tasks and eliminate crewmates.</p> */}
      <div className="px-2 w-full mb-6">
        <div className="w-full bg-gray-700 rounded h-6">
          <div
            className="bg-green-500 h-6 rounded transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <section className="mb-8 flex-1 flex flex-col">
        <ul className="overflow-y-auto max-h-[500px] md:max-h-[600px] space-y-2 px-2">
          {myTasks.map(({ id, done, title }) => (
            <li
              key={id}
              className="flex items-center bg-gray-900 rounded p-8 shadow hover:bg-gray-800 transition-colors"
            >
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggleTask(id)}
                className="mr-4 w-12 h-12 cursor-pointer accent-green-500"
                disabled={cooldown}
              />
              <span className={`text-lg ${done ? 'line-through text-gray-400' : 'select-none'}`}>
                {title}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <ActionButtons onReportKill={handleReportKill} timeLeft={formatTime(timeLeft)} onSabotage={onSabotage} cooldown={cooldown} ghost={session?.is_ghost} />
    </div>
  );
}
