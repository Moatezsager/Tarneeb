import { useState, useEffect } from 'react';
import { useGameState } from './components/common';
import { IntroScreen } from './components/IntroScreen';
import { SetupScreen } from './components/SetupScreen';
import { GameScreen } from './components/GameScreen';
import { StatsScreen } from './components/StatsScreen';
import { MultiplayerScreen } from './components/MultiplayerScreen';
import { AuthWrapper } from './components/AuthWrapper';
import { ProfileSetupScreen } from './components/ProfileSetupScreen';
import { getLocalProfile } from './logic/userProfile';
import { G, updateUI } from './logic/engine';
import { initPresence } from './services/presenceService';

export default function App() {
  const gs = useGameState();

  useEffect(() => {
    const unsub = initPresence();
    return () => unsub();
  }, []);

  return (
    <AuthWrapper>
      {gs.phase === 'intro' && <IntroScreen />}
      {gs.phase === 'setup' && <SetupScreen />}
      {gs.phase === 'stats' && <StatsScreen />}
      {gs.phase === 'multiplayer' && <MultiplayerScreen />}
      {gs.phase === 'profile' && <ProfileSetupScreen initialData={getLocalProfile()} onComplete={() => { G.phase = 'intro'; updateUI(); }} />}
      {(gs.phase === 'dealing' || gs.phase === 'swapping' || gs.phase === 'bidding' || gs.phase === 'playing' || gs.phase === 'roundEnd') && <GameScreen />}
    </AuthWrapper>
  );
}

