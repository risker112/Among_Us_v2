import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Lobby from './Pages/Lobby.jsx';
import PreGame from './Pages/PreGame.jsx';
import Game from './Pages/Game.jsx';
import Welcome from './Pages/Welcome.jsx';
import TasksOrImpostor from './Components/TasksOrImpostor.jsx';
import Emergency from './Pages/Emergency.jsx';
import Vote from './Pages/Vote.jsx';
import Map from './Pages/Map.jsx';
import { ProtectedRoute } from './ProtectedRoute';
import './index.css';
import ResultScreen from './Components/ResultScreen.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/welcome" replace />} />
      <Route path="/welcome" element={<Welcome />} />

      <Route path="/lobby" element={
        <ProtectedRoute requireAuth requireGameState="pre-game">
          <Lobby />
        </ProtectedRoute>
      } />
    
      <Route path="/pregame" element={
        <ProtectedRoute requireAuth requireGameState="pre-game">
          <PreGame />
        </ProtectedRoute>
      } />

      <Route path="/game" element={
        <ProtectedRoute requireAuth requireGameState="in-game">
          <Game />
        </ProtectedRoute>
      }>
        
      <Route index element={<TasksOrImpostor />} />
      <Route path="map" element={<Map />} />
      <Route path="emergency" element={<Emergency />} />
      <Route path="vote" element={<Vote />} />
      <Route path="aftergame" element={<ResultScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
  );
}

export default App;
