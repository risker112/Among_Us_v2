import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function EjectionScreen({ result }) {
  const navigate = useNavigate();
  console.log(result);

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/game'); // Navigate back to game after 5 seconds
    }, 10000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center p-4 z-50">
      <div className="text-center max-w-md">
        {/* Player image with red/green border */}
        <div className={`mx-auto mb-6 w-40 h-40 rounded-full overflow-hidden border-4 ${
          result.role == "Impostor" ? 'border-red-600' : 'border-green-500'
        }`}>
          <img
            src={`/src/assets/characters/${result.character}`}
            alt={result.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Result text */}
        <h1 className="text-4xl font-bold mb-2 text-white">{result.name}</h1>
        <h2 className={`text-3xl font-bold mb-6 ${
          result.role == "Impostor" ? 'text-red-500' : 'text-green-400'
        }`}>
          {result.role == "Impostor" ? 'WAS AN IMPOSTOR' : 'WAS NOT AN IMPOSTOR'}
        </h2>

        {/* Additional flavor text */}
        <p className="text-gray-400 text-lg">
          {result.role == "Impostor" 
            ? 'The crewmates have successfully identified the threat!'
            : 'The crewmates made a terrible mistake...'}
        </p>
      </div>
    </div>
  );
}