import React from 'react';
import ActionButtons from './ActionButtons.jsx';
import GlobalProgress from './GlobalProgress.jsx';
import { useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Impostor() {
  const { globalProgress } = useOutletContext();
  const [tasks, setTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const allTasks = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      title: `Task #${i + 1}`,
      doneBy: [],
    }));
    setTasks(allTasks);

    setMyTasks(
      allTasks.map(task => ({
        id: task.id,
        done: false,
      }))
    );
  }, []);

  useEffect(() => {
    if (!tasks.length || !myTasks.length) {
      setProgress(0);
      return;
    }
    const doneCount = myTasks.filter(t => t.done).length;
    setProgress(Math.round((doneCount / tasks.length) * 100));
    }, [myTasks, tasks]);

   const toggleTask = async (id) => {
    // Optimisticky update lokálneho stavu
    setMyTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, done: !t.done } : t))
    );

    try {
      // Poslať na server aktuálny stav tasku (id a done)
      const taskState = myTasks.find(t => t.id === id);
      const newDoneState = taskState ? !taskState.done : true;

      const res = await fetch('/api/update-task', {
        method: 'POST', // alebo PUT podľa API
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId: id, done: newDoneState }),
      });
      if (!res.ok) throw new Error('Failed to update task');

      // Pošle server nové globálne percento progressu (príklad)
      const data = await res.json();
      if (typeof data.globalProgress === 'number') {
        // setGlobalProgress(data.globalProgress);
      }
    } catch (err) {
      console.error(err);
      // Ak chyba, môžeš rollbacknúť lokálny stav, alebo zobraziť chybu
    }
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
          {myTasks.map(({ id, done }) => {
            const task = tasks.find(t => t.id === id);
            if (!task) return null;
            return (
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
                  {task.title}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <ActionButtons />
    </div>
  );
}
