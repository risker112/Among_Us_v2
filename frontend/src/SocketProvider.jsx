import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from './SessionProvider';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { session } = useSession();
  const socketRef = useRef(null);
  const listenersRef = useRef([]);
  const [ready, setReady] = useState(false);
  const stableSessionId = useRef(null);

  // Only reconnect when session ID actually changes
  useEffect(() => {
    if (!session?.player_id || session.player_id === stableSessionId.current) {
      return;
    }

    stableSessionId.current = session.player_id;

    const setupWebSocket = () => {
      // Clean up existing connection if any
      if (socketRef.current) {
        socketRef.current.close();
      }

      const wsUrl = `ws://192.168.0.105:8000/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WS] Connected');
        setReady(true);
        // Send authentication if needed
        ws.send(JSON.stringify({
          type: 'auth',
          player_id: session.player_id
        }));
      };

      const keepAlive = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
          }
      }, 30000);

      ws.onclose = () => {
        clearInterval(keepAlive);
        console.log('[WS] Disconnected');
        setReady(false);
        // Implement smarter reconnection logic if needed
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          listenersRef.current.forEach(cb => cb(data));
        } catch (err) {
          console.error('[WS] Message parse error:', err);
        }
      };
    };

    setupWebSocket();

    return () => {
      // Only close if we're establishing a new connection
      if (socketRef.current && stableSessionId.current !== session.player_id) {
        socketRef.current.close();
      }
    };
  }, [session?.player_id]); // Only reconnect when player_id changes

  const addMessageListener = (cb) => {
    listenersRef.current.push(cb);
    return () => {
      listenersRef.current = listenersRef.current.filter(fn => fn !== cb);
    };
  };

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      ready,
      addMessageListener
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
