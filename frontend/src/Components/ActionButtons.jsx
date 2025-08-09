import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

export default function ActionButtons({ onReportKill, timeLeft, onSabotage, cooldown }) {
  const navigate = useNavigate();
  const { role } = useOutletContext();



  const handleEmergency = () => {
    navigate('/game/emergency');
  };

  const handleShowMap = () => {
    navigate('/game/map');
  };

  return (
    <>
      {/* Emergency Button - Top Right */}
      <button
        className="fixed bottom-4 right-4 bg-red-600 rounded-full w-20 h-20 flex items-center justify-center shadow-xl hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-400 transition-all duration-200 hover:scale-105 active:scale-95"
        title="Emergency Button"
        onClick={handleEmergency}
      >
        <img 
          src="/src/assets/emg.png" 
          alt="Emergency" 
          className="w-10 h-10 object-contain" 
        />
      </button>

      {/* Map Button - Bottom Left */}
      <button
        className="fixed bottom-4 left-4 bg-gray-700 rounded-full w-20 h-20 flex items-center justify-center shadow-xl hover:bg-gray-600 focus:outline-none focus:ring-4 focus:ring-gray-500 transition-all duration-200 hover:scale-105 active:scale-95"
        title="Map"
        onClick={handleShowMap}
      >
        <img 
          src="/src/assets/map.png" 
          alt="Map" 
          className="w-10 h-10 object-contain" 
        />
      </button>

      {/* Role-based Action Button - Middle Right */}
      <button
        className="fixed bottom-28 right-4 bg-yellow-500 rounded-full w-20 h-20 flex items-center justify-center shadow-xl hover:bg-yellow-600 focus:outline-none focus:ring-4 focus:ring-yellow-300 transition-all duration-200 hover:scale-105 active:scale-95"
        title="Report Kill"
        onClick={onReportKill}
      >
        <img 
          src="/src/assets/report.png" 
          alt="Report Kill" 
          className="w-10 h-10 object-contain" 
        />
      </button>
      {role === 'Impostor' && (
        <>
          {cooldown ? (
            // Sabotage Cooldown Button for Impostors
            <button
              className="fixed bottom-52 right-4 bg-gray-400 rounded-full w-20 h-20 flex items-center justify-center shadow-xl cursor-not-allowed opacity-75"
              title={`Sabotage Cooldown: ${timeLeft}`}
              disabled
            >
              <div className="flex flex-col items-center">
                <img 
                  src="/src/assets/sabotage.png" 
                  alt="Sabotage" 
                  className="w-8 h-8 object-contain opacity-50 mb-1" 
                />
                <span className="text-xs font-bold text-white">{timeLeft}</span>
              </div>
            </button>
          ) : (
            // Sabotage Button for Impostors
            <button
              className="fixed bottom-52 right-4 bg-yellow-500 rounded-full w-20 h-20 flex items-center justify-center shadow-xl hover:bg-yellow-600 focus:outline-none focus:ring-4 focus:ring-purple-300 transition-all duration-200 hover:scale-105 active:scale-95"
              title="Sabotage"
              onClick={onSabotage}
            >
              <img 
                src="/src/assets/sabotage.png" 
                alt="Sabotage" 
                className="w-10 h-10 object-contain" 
              />
            </button>
          )}
        </>
      )}
    </>
  );
}