import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSocket } from '../SocketProvider';
import { useSession } from '../SessionProvider';

export default function Emergency() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [flashing, setFlashing] = useState(session?.game_state === "emergency" || false);
  const [countdown, setCountdown] = useState(10);
  const { addMessageListener, error } = useSocket();
  
  useEffect(() => {
    if (session?.game_state) {
      setFlashing(session.game_state === "emergency");
      setCountdown(session.countdown || 10);
    }
  }, [session]);

  useEffect(() => {
    // Add message listener for this component
    const removeListener = addMessageListener((msg) => {
      console.log('Emergency message received:', msg);
      switch (msg.type) {
        case 'emergency_flash':
          setFlashing(true);
          setCountdown(10);
          break;
          
        case 'emergency_countdown':
          setCountdown(msg.seconds_left);
          break;
          
        case 'redirect':
          if (msg.path === '/game/vote') {
            navigate('/game/vote');
          }
          break;
          
        case 'emergency_cancelled':
          setFlashing(false);
          setCountdown(10);
          break;
          
        default:
          break;
      }
    });

    // Cleanup listener on unmount
    return removeListener;
  }, [navigate, addMessageListener]);

  const callEmergency = async () => {
    try {
      const response = await fetch('/api/emergency/call', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.detail || 'Failed to call emergency meeting');
        return;
      }

      // Success - the WebSocket will handle the rest
      console.log('Emergency meeting called successfully');
      
    } catch (error) {
      console.error('Failed to call emergency:', error);
      alert('Failed to call emergency meeting. Please try again.');
    }
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center w-full h-screen text-yellow-400 font-bold select-none transition-colors duration-500 ${
        flashing ? 'animate-screenFlash' : 'bg-red-700'
      }`}
    >
      {/* Back Button - only shown when not flashing */}
      {!flashing && (
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-yellow-400 text-red-700 rounded shadow hover:bg-yellow-300 transition-colors duration-200
            text-3xl sm:text-base md:text-lg
            px-12 sm:px-4 md:px-5
            py-3.5 sm:py-2 md:py-2.5"
        >
          ← Back
        </button>
      )}

      {/* Main Content */}
      {flashing ? (
        <>
          <h1 className="text-6xl sm:text-4xl md:text-5xl mb-4 text-center drop-shadow-lg animate-pulse">
            EMERGENCY MEETING!
          </h1>
          <div className="text-center">
            <p className="text-2xl sm:text-xl md:text-2xl mb-2">
              Starting vote in:
            </p>
            <div className="text-6xl sm:text-4xl md:text-5xl font-mono bg-black bg-opacity-50 rounded-lg px-4 py-2">
              {countdown}
            </div>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-6xl sm:text-4xl md:text-5xl mb-10 text-center drop-shadow-lg">
            Call Emergency Meeting?
          </h1>
          <button
            onClick={callEmergency}
            className={`bg-yellow-400 text-red-700 font-bold rounded shadow hover:bg-yellow-300 transition-all duration-200
              text-3xl sm:text-2xl md:text-3xl
              px-12 sm:px-8 md:px-10
              py-6 sm:py-4 md:py-5
              hover:scale-105 active:scale-95`}
          >
            CALL MEETING
          </button>
          
          {error && (
            <p className="mt-4 text-red-300 text-center max-w-md">
              {error}
            </p>
          )}
        </>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes screenFlash {
          0%, 100% { background-color: #b91c1c; }   /* red-700 */
          50% { background-color: #facc15; }        /* yellow-400 */
        }
        .animate-screenFlash {
          animation: screenFlash 0.5s infinite linear;
        }
      `}</style>
    </div>
  );
}