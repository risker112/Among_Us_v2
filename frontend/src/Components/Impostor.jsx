import React from 'react';
import ActionButtons from './ActionButtons.jsx';
import GlobalProgress from './GlobalProgress.jsx';
import { useOutletContext } from 'react-router-dom';

export default function Impostor() {
  const { globalProgress } = useOutletContext();

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col">
      <GlobalProgress progress={globalProgress} />
      <h1 className="text-2xl font-bold text-center my-4">Impostor Tasks</h1>
      <p className="text-center mb-6">As an Impostor, you can sabotage tasks and eliminate crewmates.</p>
      <ActionButtons />
    </div>
  );
}
