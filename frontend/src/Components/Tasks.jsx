import React, { useEffect, useState } from 'react';
import GlobalProgress from './GlobalProgress.jsx';
import ActionButtons from './ActionButtons';
import { useOutletContext } from 'react-router-dom';
import { useSession } from '../SessionProvider.jsx';
import ReportModal from './ReportModal.jsx';

export default function Tasks() {
  const { session } = useSession();
  const { globalProgress, tasks: backendTasks } = useOutletContext();
  const [myTasks, setMyTasks] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [players, setPlayers] = useState([]); // Fetch this from your backend
  const [progress, setProgress] = useState(0);
  const [sabotageActive, setSabotageActive] = useState(false);
  const [sabotageRemaining, setSabotageRemaining] = useState(0);

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

  useEffect(() => {
    const checkSabotage = async () => {
      try {
        const res = await fetch('/api/sabotage/status');
        const data = await res.json();
        setSabotageActive(data.active);
        setSabotageRemaining(Math.ceil(data.remaining));
      } catch (err) {
        console.error('Failed to check sabotage:', err);
      }
    };
    
    checkSabotage();
    const interval = setInterval(checkSabotage, 2500);
    return () => clearInterval(interval);
  }, []);

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
    if(sabotageActive) return;
    // Optimistic update
    setMyTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, done: !t.done } : t))
    );

    try {
      const taskState = myTasks.find(t => t.id === id);
      const newDoneState = taskState ? !taskState.done : true;

      const res = await fetch('/api/update-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: id,
          done: newDoneState,
          playerId: session.player_id,
        }),
      });

      if (!res.ok) throw new Error('Failed to update task');
      await res.json(); // you can handle server's response if needed
    } catch (err) {
      console.error(err);
      // rollback could be implemented here if necessary
    }
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
      <h1 className="text-3xl md:text-4xl font-bold mb-4 text-center">My Tasks</h1>

      {/* My progress bar */}
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
          {console.log(myTasks)}
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
                disabled={sabotageActive}
              />
              <span className={`text-lg ${done ? 'line-through text-gray-400' : 'select-none'}`}>
                {title}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <ActionButtons onReportKill={handleReportKill} role={'Crewmate'} />
    </div>
  );
}
