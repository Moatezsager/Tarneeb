export interface GameStats {
  wins: number;
  losses: number;
  totalGames: number;
  totalScore: number;
  highestScore: number;
}

const DEFAULT_STATS: GameStats = {
  wins: 0,
  losses: 0,
  totalGames: 0,
  totalScore: 0,
  highestScore: -Infinity,
};

export function getStats(): GameStats {
  try {
    const saved = localStorage.getItem("tarneb_stats");
    if (saved) return JSON.parse(saved);
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
