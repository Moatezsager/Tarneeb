import { useState, useEffect } from 'react';
import { useGameState } from './components/common';
import { IntroScreen } from './components/IntroScreen';
import { SetupScreen } from './components/SetupScreen';
import { GameScreen } from './components/GameScreen';
import { StatsScreen } from './components/StatsScreen';

export default function App() {
  const gs = useGameState();

  if (gs.phase === 'intro') {
    return <IntroScreen />;
  }
  if (gs.phase === 'setup') {
    return <SetupScreen />;
  }
  if (gs.phase === 'stats') {
    return <StatsScreen />;
  }

  return <GameScreen />;
}

