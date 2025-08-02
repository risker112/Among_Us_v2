import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { SessionProvider } from './SessionProvider.jsx';
import { SocketProvider } from './SocketProvider.jsx'; // Import SocketProvider

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
      <BrowserRouter>
        <SessionProvider>
          <SocketProvider>
              <App />
          </SocketProvider>
        </SessionProvider>
      </BrowserRouter>
  </React.StrictMode>
);
