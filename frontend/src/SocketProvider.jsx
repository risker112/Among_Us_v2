import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSession } from './SessionProvider';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { session } = useSession();
  const socketRef = useRef(null);
  const listenersRef = useRef(new Set()); // Using Set to avoid duplicates
  const [ready, setReady] = useState(false);

  // Stable sendMessage function
  const sendMessage = useCallback((message) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Stable addMessageListener function
  const addMessageListener = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  useEffect(() => {
    if (!session?.player_id) return;

    const wsUrl = `ws://192.168.0.222:8000/ws`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      sendMessage({
        type: 'auth',
        player_id: session.player_id
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS] Raw message:', data);
        // Create a copy of listeners to avoid mutation during iteration
        const currentListeners = new Set(listenersRef.current);
        currentListeners.forEach(listener => listener(data));
      } catch (err) {
        console.error('[WS] Message error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setReady(false);
    };

    return () => {
      ws.close();
    };
  }, [session?.player_id, sendMessage]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    ready,
    sendMessage,
    addMessageListener
  }), [ready, sendMessage, addMessageListener]);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}