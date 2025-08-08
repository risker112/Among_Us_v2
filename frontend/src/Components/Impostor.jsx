import React from 'react';
import ActionButtons from './ActionButtons.jsx';
import GlobalProgress from './GlobalProgress.jsx';
import { useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSession } from '../SessionProvider.jsx';

export default function Impostor() {
  const { session } = useSession();
  const { globalProgress, tasks: backendTasks } = useOutletContext();
  const [myTasks, setMyTasks] = useState([]);
  const [progress, setProgress] = useState(0);

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

    // try {
    //   const taskState = myTasks.find(t => t.id === id);
    //   const newDoneState = taskState ? !taskState.done : true;

    //   const res = await fetch('/api/update-task', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       taskId: id,
    //       done: newDoneState,
    //       playerId: session.player_id,
    //     }),
    //   });

    //   if (!res.ok) throw new Error('Failed to update task');
    //   await res.json(); // you can handle server's response if needed
    // } catch (err) {
    //   console.error(err);
    //   // rollback could be implemented here if necessary
    // }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col">
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
              />
              <span className={`text-lg ${done ? 'line-through text-gray-400' : 'select-none'}`}>
                {title}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <ActionButtons />
    </div>
  );
}
