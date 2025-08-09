import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Confetti from 'react-confetti';

export default function ResultScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { result, impostors, crewmates } = location.state || {}; // zmenit
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [windowSize, setWindowSize] = React.useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Result messages
  const resultMessages = {
    impostorsWin: {
      title: 'IMPOSTORS WIN!',
      subtitle: 'The crew has been eliminated',
      color: 'text-red-500',
      bg: 'bg-red-900/20',
    },
    crewmatesWin: {
      title: 'CREWMATES SURVIVE!',
      subtitle: 'All impostors have been ejected',
      color: 'text-green-500',
      bg: 'bg-green-900/20',
    }
  };

  useEffect(() => {
    if (!result) {
      navigate('/game');
      return;
    }

    // Set up confetti for wins
    if (result === 'crewmatesWin' || result === 'timeOut') {
      setShowConfetti(true);
    }

    // Handle window resize
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);

    // Auto-navigate after delay
    const timer = setTimeout(() => {
      navigate('/lobby');
    }, 10000); // 10 seconds

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [navigate, result]);

  if (!result) return null;

  const currentResult = resultMessages[result] || resultMessages.impostorsWin;

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center p-4 z-50">
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
        />
      )}

      <div className={`text-center max-w-2xl p-8 rounded-xl ${currentResult.bg} backdrop-blur-sm`}>
        {/* Main result title */}
        <h1 className={`text-5xl md:text-6xl font-bold mb-4 ${currentResult.color}`}>
          {currentResult.title}
        </h1>
        
        {/* Subtitle */}
        <h2 className="text-2xl text-gray-300 mb-8">
          {currentResult.subtitle}
        </h2>

        {/* Player lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Impostors list */}
          <div className="text-left">
            <h3 className="text-xl font-bold text-red-500 mb-4">Impostors:</h3>
            <ul className="space-y-2">
              {impostors?.map(player => (
                <li key={player.id} className="flex items-center gap-3">
                  <img
                    src={`src/assets/characters/${player.character}`}
                    alt=""
                    className="w-10 h-10 rounded-full border border-red-500"
                  />
                  <span className="text-lg">{player.name}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Crewmates list */}
          <div className="text-left">
            <h3 className="text-xl font-bold text-green-500 mb-4">Crewmates:</h3>
            <ul className="space-y-2">
              {crewmates?.map(player => (
                <li key={player.id} className="flex items-center gap-3">
                  <img
                    src={`src/assets/characters/${player.character}`}
                    alt=""
                    className="w-10 h-10 rounded-full border border-green-500"
                  />
                  <span className="text-lg">{player.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}