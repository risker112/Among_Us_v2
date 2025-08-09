import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ReportedBody({ character, name }) {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('game/vote'); // Navigate to voting after 3 seconds
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-600 mb-6">BODY REPORTED</h1>
        
        <div className="relative mb-8">
          {/* Grayscale character image */}
          <div className="w-40 h-40 mx-auto overflow-hidden rounded-full border-4 border-gray-700">
            <img
              src={`src/assets/characters/${character}`}
              alt={`${name}'s character`}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <p className="text-2xl text-white mb-2">
          {name} was found dead!
        </p>
        <p className="text-gray-400 text-lg">
          Preparing emergency meeting...
        </p>
      </div>
    </div>
  );
}