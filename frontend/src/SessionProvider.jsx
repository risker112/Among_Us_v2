import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SessionContext = createContext();

export const useSession = () => useContext(SessionContext);

export const SessionProvider = ({ children }) => {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initialLoad = useRef(true);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/session', { 
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!res.ok) throw new Error('Session expired');
      
      const data = await res.json();
      setSession(data);
      setError(null);

      // Redirect logic based on game state
      if (data.game_state == 'game' && !window.location.pathname.startsWith('/game')) {
        navigate('/game');
      } else if (data.game_state == 'vote') {
        navigate('/game/vote');
      } else if (data.game_state == 'lobby') {
        navigate('/lobby');
      } else if (data.game_state == 'pregame') {
        navigate('/pregame');
      } else if (data.game_state == 'welcome') {
        navigate('/welcome');
      } else if (data.game_state == 'aftergame') {
        navigate('game/aftergame');
      }

      return data;
    } catch (err) {
      setError(err.message);
      setSession(null);
      if (!window.location.pathname.startsWith('/welcome')) {
        navigate('/welcome');
      }
      throw err;
    } finally {
      if (initialLoad.current) {
        initialLoad.current = false;
        setLoading(false);
      }
    }
  };

  const updateSession = async (updates) => {
    try {
      const res = await fetch('/api/update-session', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error('Failed to update session');
      
      const data = await res.json();
      setSession(prev => ({ ...prev, ...data }));
      return data;
    } catch (err) {
      console.error('Session update error:', err);
      throw err;
    }
  };
  
  // Refresh session with error handling
  const refreshSession = async () => {
    try {
      setLoading(true);
      await fetchSession();
    } finally {
      setLoading(false);
    }
  };

  // Initial load and periodic refresh
  useEffect(() => {
    let timeoutId;

    const fetchWithRandomInterval = async () => {
      await fetchSession();

      // Random interval between 30 and 45 seconds (ms)
      const interval = 30000 + Math.random() * 30000;
      timeoutId = setTimeout(fetchWithRandomInterval, interval);
    };

    fetchWithRandomInterval();

    return () => clearTimeout(timeoutId);
  }, [navigate]);


  return (
    <SessionContext.Provider value={{ 
      session, 
      loading, 
      error, 
      refreshSession,
      fetchSession,
      updateSession
    }}>
      {children}
    </SessionContext.Provider>
  );
};