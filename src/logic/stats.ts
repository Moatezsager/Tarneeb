export interface GameStats {
  wins: number;
  losses: number;
  totalGames: number;
  totalScore: number;
  highestScore: number;
  playerStats?: Record<string, {
    roundsWon: number;
    totalTricks: number;
    totalRounds: number;
  }>;
}

const DEFAULT_STATS: GameStats = {
  wins: 0,
  losses: 0,
  totalGames: 0,
  totalScore: 0,
  highestScore: -Infinity,
  playerStats: {},
};

export function getStats(): GameStats {
  try {
    const saved = localStorage.getItem("tarneb_stats");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.playerStats) parsed.playerStats = {};
      return parsed;
    }
  } catch (e) {
    console.error("Failed to load stats", e);
  }
  return { ...DEFAULT_STATS };
}

export function saveStats(stats: GameStats) {
  try {
    localStorage.setItem("tarneb_stats", JSON.stringify(stats));
  } catch (e) {
    console.error("Failed to save stats", e);
  }
}

export function recordRoundResult(players: { name: string, isRoundWinner: boolean, tricks: number }[]) {
  const stats = getStats();
  if (!stats.playerStats) stats.playerStats = {};
  
  players.forEach(p => {
    if (!stats.playerStats![p.name]) {
      stats.playerStats![p.name] = { roundsWon: 0, totalTricks: 0, totalRounds: 0 };
    }
    stats.playerStats![p.name].totalRounds++;
    stats.playerStats![p.name].totalTricks += p.tricks;
    if (p.isRoundWinner) {
      stats.playerStats![p.name].roundsWon++;
    }
  });
  
  saveStats(stats);
}

export function recordGameResult(playerScore: number, isWinner: boolean) {
  const stats = getStats();
  stats.totalGames++;
  if (isWinner) {
    stats.wins++;
  } else {
    stats.losses++;
  }
  stats.totalScore += playerScore;
  if (playerScore > stats.highestScore) {
    stats.highestScore = playerScore;
  }
  saveStats(stats);
}

export function resetStats() {
  saveStats({ ...DEFAULT_STATS });
}
