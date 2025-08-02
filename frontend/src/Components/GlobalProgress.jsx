import React from 'react';
import { useOutletContext } from 'react-router-dom';

export default function GlobalProgress({ progress }) {
  const { character } = useOutletContext();

  return (
    <div className="w-full max-w-md mx-auto my-4 flex flex-col items-center gap-4">
      {/* Character Image */}
      <img
        src={`/src/assets/characters/${character}`}
        alt="Character"
        className="w-32 h-32"
      />

      {/* Progress Area */}
      <div className="w-full">
        <h3 className="text-white text-xl font-bold mb-3 text-center">
          Global Crew Progress
        </h3>
        <div className="w-full bg-gray-700 rounded h-6">
          <div
            className="bg-green-500 h-6 rounded transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-white text-xl text-center mt-2 font-semibold">
          {progress}%
        </p>
      </div>
    </div>
  );
}
