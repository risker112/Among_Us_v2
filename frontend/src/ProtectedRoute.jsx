import { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionProvider.jsx'; // Adjust path if needed

export function ProtectedRoute({ 
  children, 
  requireAuth = false, 
  allowedPhases = null,
  restrictedPhases = null 
}) {
  // const [isChecking, setIsChecking] = useState(true);
  // const navigate = useNavigate();
  // const { session } = useSession();

  // useEffect(() => {
  //   const checkAccess = async () => {
  //     try {

  //       if (!session) {
  //         throw new Error('Not authenticated');
  //       }
        
  //       // Redirect logic
  //       if (requireAuth && !session.player_id) {
  //         navigate('/welcome');
  //         return;
  //       }

  //       // Check if current phase is restricted
  //       if (restrictedPhases && restrictedPhases.includes(session.game_state)) {
  //         // Redirect based on current game state
  //         if (session.game_state === 'emergency') {
  //           navigate('/game/emergency');
  //         } else if (session.game_state === 'vote') {
  //           navigate('/game/vote');
  //         } else if (session.game_state === 'pregame') {
  //           navigate('/pregame');
  //         } else {
  //           navigate(`/${session.game_state}`);
  //         }
  //         return;
  //       }

  //       // Check if current phase is allowed
  //       if (allowedPhases && !allowedPhases.includes(gameState.phase)) {
  //         navigate(`/${gameState.phase}`);
  //         return;
  //       }

  //     } catch (err) {
  //       if (requireAuth) {
  //         navigate('/welcome');
  //       }
  //     } finally {
  //       setIsChecking(false);
  //     }
  //   };

  //   checkAccess();
  // }, [navigate, requireAuth, allowedPhases, restrictedPhases]);

  // if (isChecking) {
  //   return <div>Loading...</div>;
  // }

  return children ? children : <Outlet />;
}