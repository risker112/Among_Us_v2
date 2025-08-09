import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function EjectionScreen() {
  const navigate = useNavigate();
  const location = useLocation();;

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/game'); // Navigate back to game after 5 seconds
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center p-4 z-50">
      <div className="text-center max-w-md">
        {/* Player image with red/green border */}
        <div className={`mx-auto mb-6 w-40 h-40 rounded-full overflow-hidden border-4 ${
          wasImpostor ? 'border-red-600' : 'border-green-500'
        }`}>
          <img
            src={`src/assets/characters/${player.character}`}
            alt={player.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Result text */}
        <h1 className="text-4xl font-bold mb-2">{player.name}</h1>
        <h2 className={`text-3xl font-bold mb-6 ${
          wasImpostor ? 'text-red-500' : 'text-green-400'
        }`}>
          {wasImpostor ? 'WAS AN IMPOSTOR' : 'WAS NOT AN IMPOSTOR'}
        </h2>

        {/* Additional flavor text */}
        <p className="text-gray-400 text-lg">
          {wasImpostor 
            ? 'The crewmates have successfully identified the threat!'
            : 'The crewmates made a terrible mistake...'}
        </p>
      </div>
    </div>
  );
}