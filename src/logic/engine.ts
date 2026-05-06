import {
  sfxSelect,
  sfxPlay,
  sfxWin,
  sfxBid,
  sfxTrap,
  sfxTarneb,
  sfxDeal,
  sfxRoundEnd,
  sfxValidPlay,
  sfxKubaCapture,
  sfxRoundSuccess,
} from "../lib/audio";

import { recordGameResult } from "./stats";

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
export interface Card {
  suit: Suit;
  rank: Rank;
  uid: string;
}

export type Phase = "intro" | "setup" | "stats" | "multiplayer" | "profile" | "dealing" | "swapping" | "bidding" | "playing" | "roundEnd";

export const G = {
  gameMode: "Teams" as "FFA" | "Teams" | "1v1",
  teamScores: [0, 0],
  target: 51,
  difficulty: "medium" as "easy" | "medium" | "hard",
  scores: [0, 0, 0, 0],
  hands: [[], [], [], []] as Card[][],
  bids: [0, 0, 0, 0],
  tricksTaken: [0, 0, 0, 0],
  dealerIdx: -1,
  currentPlayer: 0,
  leadPlayer: 0,
  trickCards: [null, null, null, null] as (Card | null)[],
  selectedCardIdx: -1,
  phase: "intro" as Phase,
  roundNumber: 0,
  totalTricksPlayed: 0,
  pendingBid: null as number | null,
  tarnebPlayed: false,
  anyoneTarnebThisTrick: false,
  trapHolder: -1,
  trapCaughtBy: -1,
  trapActive: false,
  exposedCards: [null, null, null, null] as (Card | null)[],
  playerWithHighestScore: -1,
  playerNames: ["أنت", "كمبيوتر 1", "كمبيوتر 2", "كمبيوتر 3"],
  gameStarted: false,
  gameMsg: "",
  gameMsgClass: "",
  results: [] as any[],
  bestInRound: null as any,
  gameWinner: null as number | null,
  particles: [] as { id: number; type: "tarneb" | "trap"; key: number }[],
  spectators: [] as any[],
  savedPhase: null as Phase | null,
  turnStartTime: 0,
  turnTimeout: 20, // 20 seconds per turn
  playHint: "",
  roundPhase: "",
  bidOverlayVisible: false,
  bidWarning: "",
  winnerSlot: null as number | null,
  playedCards: [] as Card[],
  dealingCards: [] as { id: number; card: Card; player: number; rotate: number }[],
  roundEndOverlayVisible: false,
  isGatheringTrick: false,
  lastTrickWinnerIndex: -1,
  lastTrickCards: [null, null, null, null] as (Card | null)[],
  isMuted: localStorage.getItem('tarneb_muted') === 'true',
};

export let myPlayerIndex = 0;
export const setMyPlayerIndex = (idx: number) => { myPlayerIndex = idx; };

export let isExecutingForcedAction = false;
export const setExecutingForcedAction = (v: boolean) => isExecutingForcedAction = v;

let isMultiplayerMode = false;
let isHostMode = false;
export const setMultiplayerMode = (multi: boolean, host: boolean) => {
  isMultiplayerMode = multi;
  isHostMode = host;
};

// Responsible identifies if THIS client should handle autonomous state transitions (AI, timers, etc)
export function isMyTurnToProcess(targetPlayer?: number): boolean {
  if (!isMultiplayerMode) return true;
  if (isExecutingForcedAction && isHostMode) return true;
  
  if (G.isGatheringTrick && isHostMode) return true;

  const p = targetPlayer ?? G.currentPlayer;
  // If it's my turn, I process
  if (p === myPlayerIndex) return true;
  // If it's an AI turn (nobody joined at that slot), Host processes
  const isAI = !G.playerNames[p] || G.playerNames[p].includes("كمبيوتر");
  if (isAI && isHostMode) return true;
  return false;
}

let onSyncNeeded: (() => void) | null = null;
export let justPlayedLocalAction = false;
export const setJustPlayedLocalAction = (val: boolean) => { justPlayedLocalAction = val; };

export const setOnSyncNeeded = (fn: () => void) => { onSyncNeeded = fn; };

export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const RANK_VAL: Record<string, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};
export const VALID_BIDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 13];
export const PLAYER_NAMES = ["أنت", "كمبيوتر 1", "كمبيوتر 2", "كمبيوتر 3"];
export const SUIT_ORDER: Record<string, number> = { "♥": 10, "♠": 3, "♦": 2, "♣": 1 };

type Listener = () => void;
const listeners: Listener[] = [];
export const subscribe = (l: Listener) => {
  listeners.push(l);
  return () => {
    const i = listeners.indexOf(l);
    if (i >= 0) listeners.splice(i, 1);
  };
};
let isSyncLocked = false;
export const setSyncLocked = (locked: boolean) => { isSyncLocked = locked; };

export const updateUI = () => {
  listeners.forEach((l) => l());
  if (onSyncNeeded && !isSyncLocked) onSyncNeeded();
};

export function initGame(
  pname: string,
  targetPoints: number,
  diff: "easy" | "medium" | "hard",
  aiNames: string[] = [],
  mode: "FFA" | "Teams" | "1v1" = "Teams"
) {
  G.gameMode = mode;
  G.target = targetPoints;
  G.difficulty = diff;
  G.playerNames = [
    pname || "البطل", 
    aiNames[0] || PLAYER_NAMES[1], 
    aiNames[1] || PLAYER_NAMES[2], 
    aiNames[2] || PLAYER_NAMES[3]
  ];
  G.scores = [0, 0, 0, 0];
  G.teamScores = [0, 0];
  G.dealerIdx = Math.floor(Math.random() * (G.gameMode === "1v1" ? 2 : 4));
  G.roundNumber = 0;
  G.gameStarted = true;
  G.savedPhase = null;
  G.phase = "dealing";
  // For single player, we just start
  startNewRound();
}

function shuffleDeck(): Card[] {
  let deck: Card[] = [];
  SUITS.forEach((s) => RANKS.forEach((r) => deck.push({ suit: s, rank: r, uid: `${s}${r}-${Math.random().toString(36).substring(2, 9)}` })));

  for (let round = 0; round < 4; round++) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  return deck;
}

export let isDealingAnimationRunning = false;
export async function dealCardsAnimation(): Promise<void> {
  if (isDealingAnimationRunning) return;
  isDealingAnimationRunning = true;
  
  return new Promise((resolve) => {
    // We'll create a reproduction of the distribution order
    const distribution: { card: Card; player: number }[] = [];
    const numPlayers = G.gameMode === "1v1" ? 2 : 4;
    let playerIdx = (G.dealerIdx + 1) % numPlayers;
    
    // Flatten hands into distribution order
    const tempHands = G.hands.map(h => [...h]);
    G.hands = [[], [], [], []]; // Clear for animation
    G.dealingCards = [];
    
    const totalCardsToDeal = numPlayers * 13;
    for (let i = 0; i < totalCardsToDeal; i++) {
        const p = playerIdx;
        playerIdx = (playerIdx + 1) % numPlayers;
        const card = tempHands[p].shift();
        if (card) distribution.push({ card, player: p });
    }

    let current = 0;
    isSyncLocked = true; // Don't sync during animation
    const interval = setInterval(() => {
        if (current >= distribution.length) {
            clearInterval(interval);
            setTimeout(() => {
                G.dealingCards = [];
                for (let p = 0; p < numPlayers; p++) {
                  G.hands[p] = [...distribution.filter(d => d.player === p).map(d => d.card)];
                  G.hands[p].sort((a, b) => {
                    if (a.suit !== b.suit) return SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit];
                    return RANK_VAL[b.rank] - RANK_VAL[a.rank];
                  });
                }

                G.trapHolder = -1;
                for (let p = 0; p < numPlayers; p++) {
                  if (G.hands[p].some((c) => c.suit === "♥" && c.rank === "Q")) {
                    G.trapHolder = p;
                    break;
                  }
                }
                isSyncLocked = false;
                isDealingAnimationRunning = false;
                updateUI();
                resolve();
            }, 500);
            return;
        }

        const item = distribution[current];
        G.hands[item.player].push(item.card); 
        G.dealingCards.push({ id: current, card: item.card, player: item.player, rotate: Math.random() * 360 - 180 });
        if (current % 3 === 0) sfxDeal();
        updateUI();
        current++;
    }, 30);
  });
}

export async function startNewRound() {
  G.roundNumber++;
  G.tricksTaken = [0, 0, 0, 0];
  G.bids = [0, 0, 0, 0];
  G.trickCards = [null, null, null, null];
  G.totalTricksPlayed = 0;
  G.selectedCardIdx = -1;
  G.phase = "dealing";
  G.tarnebPlayed = false;
  G.anyoneTarnebThisTrick = false;
  G.trapHolder = -1;
  G.trapCaughtBy = -1;
  G.trapActive = false;
  const numPlayers = G.gameMode === "1v1" ? 2 : 4;
  G.dealerIdx = (G.dealerIdx + 1) % numPlayers;
  G.currentPlayer = (G.dealerIdx + 1) % numPlayers;
  G.gameMsg = "🎴 جاري توزيع الأوراق...";
  G.gameMsgClass = "";
  G.roundPhase = "🔄 توزيع";
  G.playedCards = [];
  G.dealingCards = [];
  G.exposedCards = [null, null, null, null];
  G.playerWithHighestScore = -1;
  
  // Shuffling logic
  if (!isMultiplayerMode || isHostMode) {
    const deck = shuffleDeck();
    let playerIdx = (G.dealerIdx + 1) % numPlayers;
    G.hands = [[], [], [], []];
    const totalCardsToDeal = numPlayers * 13;
    for (let i = 0; i < totalCardsToDeal; i++) {
      G.hands[playerIdx].push(deck[i]);
      playerIdx = (playerIdx + 1) % numPlayers;
    }
  }

  updateUI();
  if (isMultiplayerMode && isHostMode && onSyncNeeded && !isSyncLocked) {
     onSyncNeeded();
  }

  await dealCardsAnimation();

  // Expose one random card per player
  for (let p = 0; p < 4; p++) {
    let randIdx = Math.floor(Math.random() * 13);
    G.exposedCards[p] = G.hands[p][randIdx];
  }
  updateUI();

  // Check if we do swapping (round >= 2)
  if (G.roundNumber >= 2) {
    let maxScore = Math.max(...G.scores);
    let highestPlayers = [0, 1, 2, 3].filter((p) => G.scores[p] === maxScore);
    G.playerWithHighestScore = highestPlayers[0];

    G.phase = "swapping";
    G.turnStartTime = Date.now();
    G.gameMsg = `الكنق 👑 ${G.playerNames[G.playerWithHighestScore]} يفكر في التبديل...`;
    updateUI();

    if (!isMyTurnToProcess(G.playerWithHighestScore)) return;
    if (G.playerWithHighestScore !== myPlayerIndex) {
      setTimeout(() => {
        executeAISwap();
      }, 2000);
    }
  } else {
    if (G.roundNumber === 1) {
      G.gameMsg = "✅ الجولة الأولى (بدون طلبات - أكل عادي)";
      G.phase = "playing";
      G.roundPhase = "🃏 اللعب";
      G.bids = [0, 0, 0, 0];
      G.currentPlayer = (G.dealerIdx + 1) % (G.gameMode === "1v1" ? 2 : 4);
      G.leadPlayer = G.currentPlayer;
      updateUI();
      setTimeout(() => processNextPlay(), 1000);
    } else {
      G.gameMsg = "✅ تم التوزيع! جاري المزاد...";
      updateUI();
      setTimeout(() => startBidding(), 600);
    }
  }
}

function getCardValue(c: Card) {
  if (c.suit === "♥" && c.rank === "Q") return -50; // Trap is bad to have exposed? Or good to give away. Value is low so AI gives it away if possible, wait, AI might want to give it away, so its value to AI is low. What if they receive it? We want them to NOT want it.
  let val = RANK_VAL[c.rank];
  if (c.suit === "♥") val += 20;
  return val;
}

export function executeAISwap() {
  let p = G.playerWithHighestScore;
  let myVal = getCardValue(G.exposedCards[p]!);
  let bestTarget = -1;
  let bestVal = myVal;

  for (let i = 0; i < 4; i++) {
    if (i !== p && G.exposedCards[i]) {
      let v = getCardValue(G.exposedCards[i]!);
      if (v > bestVal) {
        bestVal = v;
        bestTarget = i;
      }
    }
  }

  if (bestTarget !== -1) {
    let c1 = G.exposedCards[p];
    let c2 = G.exposedCards[bestTarget];
    swapCards(p, bestTarget);
    if (c1 && c2) {
      G.gameMsg = `الكنق 👑 ${G.playerNames[p]} إستبدل ورقته (${c1.rank}${c1.suit}) بـ (${c2.rank}${c2.suit}) من ${G.playerNames[bestTarget]}`;
    }
  } else {
    G.gameMsg = `الكنق 👑 ${G.playerNames[p]} قرر عدم التبديل (محتفظ بورقته)`;
  }
  updateUI();

  setTimeout(() => {
    startBidding();
  }, 3500);
}

export function swapCards(p1: number, p2: number) {
  let c1 = G.exposedCards[p1]!;
  let c2 = G.exposedCards[p2]!;

  // Swap in hands
  let h1Idx = G.hands[p1].indexOf(c1);
  let h2Idx = G.hands[p2].indexOf(c2);
  G.hands[p1][h1Idx] = c2;
  G.hands[p2][h2Idx] = c1;

  // Re-sort hands
  [p1, p2].forEach((p) => {
    G.hands[p].sort((a, b) => {
      if (a.suit !== b.suit) return SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit];
      return RANK_VAL[b.rank] - RANK_VAL[a.rank];
    });
  });

  // Swap exposed
  G.exposedCards[p1] = c2;
  G.exposedCards[p2] = c1;

  // Update trap holder
  G.trapHolder = -1;
  for (let p = 0; p < 4; p++) {
    if (G.hands[p].some((c) => c.suit === "♥" && c.rank === "Q")) {
      G.trapHolder = p;
      break;
    }
  }
  updateUI();
}

export function humanSwap(target: number) {
  if (G.phase !== "swapping" || G.playerWithHighestScore !== myPlayerIndex) return;
  justPlayedLocalAction = true;
  let c1 = G.exposedCards[myPlayerIndex];
  let c2 = G.exposedCards[target];
  swapCards(myPlayerIndex, target);
  if (c1 && c2) {
    G.gameMsg = `الكنق 👑 إستبدل ورقته المكشوفة (${c1.rank}${c1.suit}) بـ (${c2.rank}${c2.suit}) مع ${G.playerNames[target]}`;
  }
  updateUI();
  
  setTimeout(() => {
    startBidding();
  }, 3500);

  setTimeout(() => { justPlayedLocalAction = false; }, 100);
}

export function humanSkipSwap() {
  if (G.phase !== "swapping" || G.playerWithHighestScore !== myPlayerIndex) return;
  justPlayedLocalAction = true;
  G.gameMsg = `الكنق 👑 قرر عدم التبديل (محتفظ بورقته)`;
  updateUI();
  
  setTimeout(() => {
    startBidding();
  }, 2500);

  setTimeout(() => { justPlayedLocalAction = false; }, 100);
}

function startBidding() {
  G.phase = "bidding";
  G.bids = [0, 0, 0, 0];
  const numPlayers = G.gameMode === "1v1" ? 2 : 4;
  G.currentPlayer = (G.dealerIdx + 1) % numPlayers;
  G.roundPhase = "🎯 المزاد";
  G.turnStartTime = Date.now();
  processNextBid();
}

export function forceAiAction(playerIdx: number) {
  if (G.phase === "bidding") {
      const avail = getAvailableBids(playerIdx);
      // AI usually bids something safe or passes if timed out
      const estimate = 2; // Default for timeout
      let best = avail[0], minDiff = Infinity;
      for (let bid of avail) {
          let diff = Math.abs(bid - estimate);
          if (diff < minDiff) { minDiff = diff; best = bid; }
      }
      G.bids[playerIdx] = best;
      const numPlayers = G.gameMode === "1v1" ? 2 : 4;
      G.currentPlayer = (G.currentPlayer + 1) % numPlayers;
      processNextBid();
  } else if (G.phase === "playing") {
      const hand = G.hands[playerIdx];
      if (!hand || hand.length === 0) return;
      const isLeading = G.trickCards.every((c) => c === null);
      let leadSuit: Suit | null = null;
      if (!isLeading) {
          leadSuit = G.trickCards[G.leadPlayer]?.suit || null;
      }
      const valid = getValidCards(hand, leadSuit, isLeading, G.anyoneTarnebThisTrick);
      if (valid.length === 0) return;
      const card = selectBestCardAI(playerIdx, valid, leadSuit, isLeading);
      if (!card) return;
      
      const idx = hand.findIndex((c) => c.suit === card.suit && c.rank === card.rank);
      if (idx >= 0) {
          G.trickCards[playerIdx] = hand[idx];
          if (G.exposedCards[playerIdx] && G.exposedCards[playerIdx]!.suit === hand[idx].suit && G.exposedCards[playerIdx]!.rank === hand[idx].rank) G.exposedCards[playerIdx] = null;
          hand.splice(idx, 1);
          sfxPlay();
          advanceTurn();
      }
  }
}

function processNextBid() {
  if (!isMyTurnToProcess()) return;
  const numPlayers = G.gameMode === "1v1" ? 2 : 4;
  
  const relevantBids = G.bids.slice(0, numPlayers);
  if (G.currentPlayer === G.dealerIdx && relevantBids.every((b) => b > 0)) {
    finishBidding();
    return;
  }
  if (G.bids[G.currentPlayer] > 0) {
    G.currentPlayer = (G.currentPlayer + 1) % numPlayers;
    processNextBid();
    return;
  }

  const bot = isBot(G.currentPlayer);
  G.turnStartTime = Date.now();

  if (G.currentPlayer === myPlayerIndex) {
    showBidUI();
  } else {
    G.gameMsg = `⏳ دور ${G.playerNames[G.currentPlayer]}...`;
    updateUI();
    setTimeout(() => {
      if (!isMyTurnToProcess()) return;
      computerBid(G.currentPlayer);
      const numPlayers = G.gameMode === "1v1" ? 2 : 4;
      G.currentPlayer = (G.currentPlayer + 1) % numPlayers;
      processNextBid();
    }, bot ? 400 : 1500);
  }
}

export function getAvailableBids(p: number) {
  const numPlayers = G.gameMode === "1v1" ? 2 : 4;
  let avail = [...VALID_BIDS];
  let total = G.bids.slice(0, numPlayers).reduce((s, b) => s + b, 0);
  avail = avail.filter((b) => total + b !== 13);

  if (p === G.dealerIdx) {
    let all2 = G.bids.slice(0, numPlayers).every((b, i) => i === G.dealerIdx || b === 2);
    if (all2) avail = avail.filter((b) => b >= 5);
  }
  return avail;
}

function showBidUI() {
  G.bidOverlayVisible = true;
  G.pendingBid = null;

  if (G.dealerIdx === myPlayerIndex && G.bids.filter((b) => b === 0).length === 1) {
    let all2 = G.bids.every((b, i) => i === myPlayerIndex || b === 2);
    G.bidWarning = all2 ? "⚠️ الجميع طلب 2 - عليك طلب 5+" : "⚠️ لا تجعل المجموع 13";
  } else {
    G.bidWarning = G.trapHolder === myPlayerIndex ? "⚠️ معك Q♥ البنت كبة!" : "";
  }
  updateUI();
}

export function selectBid(bid: number) {
  G.pendingBid = bid;
  sfxSelect();
  updateUI();
}

export function confirmBid() {
  if (G.pendingBid !== null) {
    justPlayedLocalAction = true;
    G.bids[myPlayerIndex] = G.pendingBid;
    G.bidOverlayVisible = false;
    sfxBid();
    G.currentPlayer = (myPlayerIndex + 1) % 4;
    processNextBid();
    setTimeout(() => { justPlayedLocalAction = false; }, 100);
  }
}

function computerBid(p: number) {
  const hand = G.hands[p];
  const avail = getAvailableBids(p);

  let bidVal = 0;
  const kubaCards = hand.filter((c) => c.suit === "♥").sort((a,b)=>RANK_VAL[b.rank]-RANK_VAL[a.rank]);
  const kubaCount = kubaCards.length;

  // Value of Tarot (Kuba) cards - Higher weights for key cards
  if (kubaCards.some(c=>c.rank==='A')) bidVal += 1.3;
  if (kubaCards.some(c=>c.rank==='K')) bidVal += 1.0;
  if (kubaCards.some(c=>c.rank==='Q')) bidVal += 0.7;
  if (kubaCards.some(c=>c.rank==='J')) bidVal += 0.5;

  // Strategic trump distribution value
  if (kubaCount > 3) {
    bidVal += (kubaCount - 3) * 0.9;
  } else if (kubaCount > 0) {
    bidVal += kubaCount * 0.25; 
  }

  for (const s of (['♠', '♦', '♣'] as Suit[])) {
      const suitCards = hand.filter(c => c.suit === s).sort((a,b)=>RANK_VAL[b.rank]-RANK_VAL[a.rank]);
      const count = suitCards.length;
      
      if (count === 0 && kubaCount >= 1) {
          bidVal += 1.2; // High value for void suit if trumps exist
          continue;
      }
      
      if (count === 1 && kubaCount >= 2) {
          bidVal += 0.6; // singleton value
      }
      
      const topRank = suitCards[0]?.rank;
      if (topRank === 'A') {
          bidVal += 1.2;
          if (count > 1 && suitCards[1].rank === 'K') bidVal += 1.0;
          if (count > 2 && suitCards[2].rank === 'Q') bidVal += 0.7;
      } else if (topRank === 'K' && count > 1) {
          bidVal += 0.6;
          if (count > 2 && suitCards[2].rank === 'Q') bidVal += 0.5;
      }
  }

  let estimate = Math.floor(bidVal + 0.3); 

  if (G.difficulty === "easy") {
    estimate = Math.max(2, estimate - 1);
  } else if (G.difficulty === "hard") {
    // Hard bots play for higher stakes
    if (bidVal > 3.8) estimate += 1;
    if (Math.random() > 0.6) estimate += 1;
  }

  estimate = Math.max(2, Math.min(13, estimate));

  let best = avail[0], minDiff = Infinity;
  for (const bid of avail) {
    const diff = Math.abs(bid - estimate);
    // Prefer bidding slightly lower than estimate to be safe, unless diff is large
    const penalty = bid > estimate ? 1.4 : 1.0;
    const score = diff * penalty;
    if (score < minDiff) {
      minDiff = score;
      best = bid;
    }
  }
  G.bids[p] = best;
}

function finishBidding() {
  G.phase = "playing";
  G.tricksTaken = [0, 0, 0, 0];
  G.totalTricksPlayed = 0;
  const numPlayers = G.gameMode === "1v1" ? 2 : 4;
  G.leadPlayer = (G.dealerIdx + 1) % numPlayers;
  G.currentPlayer = G.leadPlayer;
  G.tarnebPlayed = false;
  G.anyoneTarnebThisTrick = false;
  G.trapCaughtBy = -1;
  G.trapActive = false;
  G.roundPhase = "🎮 لعب";
  processNextPlay();
}

export function getValidCards(hand: Card[], leadSuit: Suit | null, isLeading: boolean, anyoneTarneb: boolean) {
  if (isLeading) {
    let nonKuba = hand.filter((c) => c.suit !== "♥");
    if (nonKuba.length > 0) return nonKuba;
    return hand;
  }
  if (!leadSuit) return hand;
  let sameSuit = hand.filter((c) => c.suit === leadSuit);
  if (sameSuit.length > 0) return sameSuit;
  return hand;
}

export function canLeadKuba(playerIdx: number) {
  if (G.tarnebPlayed || G.anyoneTarnebThisTrick) return true;
  return G.hands[playerIdx].every((c) => c.suit === "♥");
}

export function handleSelectCard(idx: number) {
  if (G.phase !== "playing" || G.currentPlayer !== myPlayerIndex) return;

  let isLeading = G.trickCards.every((c) => c === null);
  let leadSuit: Suit | null = null;
  if (!isLeading) {
    leadSuit = G.trickCards[G.leadPlayer]?.suit || null;
  }

  let valid = getValidCards(G.hands[myPlayerIndex], leadSuit, isLeading, G.anyoneTarnebThisTrick);
  let card = G.hands[myPlayerIndex][idx];

  if (!valid.some((c) => c.suit === card.suit && c.rank === card.rank)) {
    G.gameMsg =
      isLeading && card.suit === "♥"
        ? "⚠️ لا يمكنك البدء بالكبة! لديك أنواع أخرى"
        : leadSuit
        ? `⚠️ يجب لعب ${leadSuit}`
        : "⚠️ لا يمكنك لعب هذه";
    updateUI();
    return;
  }

  G.selectedCardIdx = G.selectedCardIdx === idx ? -1 : idx;
  if (G.selectedCardIdx >= 0) sfxSelect();
  updateUI();
}

export function executePlay() {
  if (G.selectedCardIdx < 0 || G.currentPlayer !== myPlayerIndex) return;
  
  justPlayedLocalAction = true;

  let card = G.hands[myPlayerIndex][G.selectedCardIdx];
  let isLeading = G.trickCards.every((c) => c === null);
  let leadSuit = isLeading ? null : G.trickCards[G.leadPlayer]?.suit;

  let isTarneb = false;
  if (!isLeading && leadSuit && card.suit === "♥" && leadSuit !== "♥") {
    isTarneb = true;
    G.anyoneTarnebThisTrick = true;
    G.tarnebPlayed = true;
    sfxTarneb();
    G.gameMsg = "🔪 طرنب! قطعت بالكبة!";
    G.gameMsgClass = "tarneb-msg";
    triggerParticle("tarneb");
  } else {
    sfxValidPlay();
  }

  G.trickCards[myPlayerIndex] = card;
  if (G.exposedCards[myPlayerIndex] && G.exposedCards[myPlayerIndex]!.suit === card.suit && G.exposedCards[myPlayerIndex]!.rank === card.rank) G.exposedCards[myPlayerIndex] = null;
  G.hands[myPlayerIndex].splice(G.selectedCardIdx, 1);
  G.selectedCardIdx = -1;
  G.playHint = "";

  sfxPlay();
  updateUI();

  advanceTurn();

  setTimeout(() => { justPlayedLocalAction = false; }, 100);
}

function triggerParticle(type: "tarneb" | "trap") {
  G.particles.push({ id: Date.now() + Math.random(), type, key: Math.random() });
  updateUI();
}

export function removeParticle(id: number) {
  G.particles = G.particles.filter((p) => p.id !== id);
  updateUI();
}

function computerPlay(p: number) {
  if (G.phase !== "playing") return;
  let hand = G.hands[p];
  let isLeading = G.trickCards.every((c) => c === null);
  let leadSuit: Suit | null = null;
  if (!isLeading) {
    leadSuit = G.trickCards[G.leadPlayer]?.suit || null;
  }

  let valid = getValidCards(hand, leadSuit, isLeading, G.anyoneTarnebThisTrick);
  let card = selectBestCardAI(p, valid, leadSuit, isLeading);

  let isTarneb = false;
  if (!isLeading && leadSuit && card.suit === "♥" && leadSuit !== "♥") {
    isTarneb = true;
    G.anyoneTarnebThisTrick = true;
    G.tarnebPlayed = true;
    setTimeout(() => sfxTarneb(), 200);
  } else {
    sfxValidPlay();
  }

  let idx = hand.findIndex((c) => c.suit === card.suit && c.rank === card.rank);
  if (idx >= 0) {
    G.trickCards[p] = hand[idx];
    if (G.exposedCards[p] && G.exposedCards[p]!.suit === hand[idx].suit && G.exposedCards[p]!.rank === hand[idx].rank) G.exposedCards[p] = null;
    hand.splice(idx, 1);
    sfxPlay();

    if (isTarneb) {
      G.gameMsg = `🔪 ${G.playerNames[p]} قطع بالكبة!`;
      G.gameMsgClass = "tarneb-msg";
      triggerParticle("tarneb");
    }
  }
}

function selectBestCardAI(playerIdx: number, valid: Card[], leadSuit: Suit | null, isLeading: boolean): Card {
  const tarnebSuit: Suit = "♥";
  if (!valid || valid.length === 0) return G.hands[playerIdx][0]; // Fallback if valid is empty for some reason

  const teammateIdx = G.gameMode === "Teams" ? (playerIdx + 2) % 4 : -1;
  const currentWinnerIdx = getTrickWinner();
  const isTeammateWinning = teammateIdx !== -1 && currentWinnerIdx === teammateIdx;

  // 1. LEADING STRATEGY
  if (isLeading) {
    const hand = G.hands[playerIdx];
    const myTarnebs = hand.filter(c => c.suit === tarnebSuit);
    
    // Draw out trumps if AI has many and strong ones to weaken opponents
    if (myTarnebs.length >= 4 && myTarnebs.some(c => ["A", "K", "Q"].includes(c.rank))) {
      const topValidTarneb = valid.filter(c => c.suit === tarnebSuit).sort((a, b) => RANK_VAL[b.rank] - RANK_VAL[a.rank])[0];
      if (topValidTarneb) return topValidTarneb;
    }

    // Play Aces first to secure tricks early
    const aces = valid.filter(c => c.rank === "A" && c.suit !== tarnebSuit);
    if (aces.length > 0) return aces[0];

    // Strategic choice: Play from short suits to enable cutting (tarneb) in later rounds
    const suitCounts: Record<string, number> = {};
    hand.forEach(c => {
      if (c.suit !== tarnebSuit) suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    });
    
    const nonTarneb = valid.filter(c => c.suit !== tarnebSuit);
    if (nonTarneb.length > 0) {
      const shortSuit = Object.keys(suitCounts).sort((a, b) => suitCounts[a] - suitCounts[b])[0] as Suit;
      const suitCards = nonTarneb.filter(c => c.suit === shortSuit).sort((a, b) => RANK_VAL[b.rank] - RANK_VAL[a.rank]);
      if (suitCards.length > 0) return suitCards[0];
    }

    return valid.sort((a, b) => RANK_VAL[b.rank] - RANK_VAL[a.rank])[0] || valid[0];
  }

  // 2. FOLLOWING STRATEGY
  const leadCards = G.trickCards.filter(c => c !== null) as Card[];
  const mySuitCards = valid.filter(c => c && c.suit === leadSuit);
  
  if (mySuitCards.length > 0) {
    const currentBestCard = G.trickCards[currentWinnerIdx];
    
    // Coordination: If teammate is already winning with a strong card, throw away a low card
    if (isTeammateWinning && currentBestCard && (currentBestCard.rank === "A" || currentBestCard.rank === "K")) {
      return mySuitCards.sort((a, b) => RANK_VAL[a.rank] - RANK_VAL[b.rank])[0];
    }

    // Attempt to win the trick against an opponent
    if (currentBestCard) {
      const winningCards = mySuitCards.filter(c => RANK_VAL[c.rank] > RANK_VAL[currentBestCard.rank]);
      if (winningCards.length > 0) {
        // Efficiency: Use the smallest card that is still enough to win
        return winningCards.sort((a, b) => RANK_VAL[a.rank] - RANK_VAL[b.rank])[0];
      }
    }
    // Cannot win or teammate is winning, conserve power
    return mySuitCards.sort((a, b) => RANK_VAL[a.rank] - RANK_VAL[b.rank])[0];
  }

  // 3. CUTTING STRATEGY (When out of the lead suit)
  const tarnebs = valid.filter(c => c && c.suit === tarnebSuit);
  if (tarnebs.length > 0) {
    const currentBestCard = G.trickCards[currentWinnerIdx];
    
    // Tactical restraint: Don't spend a trump card if teammate is winning with a high lead-suit card
    if (isTeammateWinning && currentBestCard && currentBestCard.suit === leadSuit && (currentBestCard.rank === "A" || currentBestCard.rank === "K")) {
      return valid.sort((a, b) => RANK_VAL[a.rank] - RANK_VAL[b.rank])[0];
    }

    const currentWinnerTarneb = leadCards.filter(c => c.suit === tarnebSuit).sort((a, b) => RANK_VAL[b.rank] - RANK_VAL[a.rank])[0];
    
    if (!currentWinnerTarneb) {
      // First one to cut in this trick
      return tarnebs.sort((a, b) => RANK_VAL[a.rank] - RANK_VAL[b.rank])[0];
    } else {
      // Try to overcut another player's trump
      const overCutCards = tarnebs.filter(t => RANK_VAL[t.rank] > RANK_VAL[currentWinnerTarneb.rank]);
      if (overCutCards.length > 0) {
        return overCutCards.sort((a, b) => RANK_VAL[a.rank] - RANK_VAL[b.rank])[0];
      }
    }
  }

  // Final Fallback: Play lowest available card
  return valid.sort((a, b) => RANK_VAL[a.rank] - RANK_VAL[b.rank])[0] || valid[0];
}

export function isBot(playerIdx: number) {
  return G.playerNames[playerIdx]?.includes("كمبيوتر");
}

export function getTrickWinner() {
  let li = G.leadPlayer;
  if (!G.trickCards[li]) {
    // Lead player card missing. Find first played card.
    li = G.trickCards.findIndex((c) => c !== null);
    if (li === -1) return -1;
  }
  
  let leadSuit = G.trickCards[li]?.suit;
  if (!leadSuit) return li;

  let winner = li;
  let highest = RANK_VAL[G.trickCards[li]?.rank || '2'];

  for (let i = 0; i < 4; i++) {
    if (i === li || !G.trickCards[i]) continue;
    let card = G.trickCards[i]!;
    let currentWinnerCard = G.trickCards[winner];
    if (!card || !currentWinnerCard) continue;

    if (card.suit === "♥" && currentWinnerCard.suit !== "♥") {
      winner = i;
      highest = RANK_VAL[card.rank];
    } else if (card.suit === currentWinnerCard.suit && RANK_VAL[card.rank] > highest) {
      winner = i;
      highest = RANK_VAL[card.rank];
    }
  }
  return winner;
}

function advanceTurn() {
  if (!isMyTurnToProcess()) return;
  if (G.phase !== "playing") return;
  
  const numPlayers = G.gameMode === "1v1" ? 2 : 4;
  if (G.trickCards.slice(0, numPlayers).every((c) => c !== null)) {
    G.isGatheringTrick = true;
    let w = getTrickWinner();
    G.lastTrickWinnerIndex = w >= 0 ? w : 0;
    G.lastTrickCards = [...G.trickCards];
    updateUI();

    setTimeout(resolveTrick, 900);
    return;
  }

  G.currentPlayer = (G.currentPlayer + 1) % numPlayers;
  
  // Set timer for next player
  const isBot = G.playerNames[G.currentPlayer].includes("كمبيوتر");
  G.turnTimeout = isBot ? 3 : 20;
  G.turnStartTime = Date.now();
  
  updateUI();
  processNextPlay();
}

export function resumeGameLoop() {
  if (!isMyTurnToProcess()) return;
  if (G.phase === "bidding") {
    processNextBid();
  } else if (G.phase === "playing") {
    // Make sure we resolve the trick if it's full, else process next play
    const numPlayers = G.gameMode === "1v1" ? 2 : 4;
    if (G.trickCards.slice(0, numPlayers).every((c) => c !== null)) {
      setTimeout(resolveTrick, 700);
    } else {
      processNextPlay();
    }
  } else if (G.phase === "swapping") {
    if (G.playerWithHighestScore === myPlayerIndex) {
      // It's me
    } else if (isBot(G.playerWithHighestScore)) {
      setTimeout(() => {
        executeAISwap();
      }, 1000);
    }
  }
}

function processNextPlay() {
  if (!isMyTurnToProcess()) return;
  if (G.phase !== "playing") return;
  if (G.totalTricksPlayed >= 13) {
    endRound();
    return;
  }

  const bot = isBot(G.currentPlayer);
  G.turnStartTime = Date.now();

  if (G.currentPlayer === myPlayerIndex) {
    G.selectedCardIdx = -1;
    let isLeading = G.trickCards.every((c) => c === null);
    let canLeadK = isLeading ? canLeadKuba(myPlayerIndex) : true;
    if (isLeading && !canLeadK && G.hands[myPlayerIndex].some((c) => c.suit !== "♥")) {
      G.playHint = "لا يمكن البدء بالكبة";
    } else {
      G.playHint = G.anyoneTarnebThisTrick ? "الكبة مسموحة" : "";
    }
    G.gameMsg = "🎯 دورك! اختر ورقة";
    G.gameMsgClass = "";
    updateUI();
  } else {
    G.gameMsg = `⏳ دور ${G.playerNames[G.currentPlayer]}...`;
    G.gameMsgClass = "";
    G.selectedCardIdx = -1;
    G.playHint = "";
    updateUI();

    setTimeout(() => {
      if (!isMyTurnToProcess()) return;
      computerPlay(G.currentPlayer);
      advanceTurn();
    }, bot ? 400 : 1500);
  }
}

function resolveTrick() {
  if (!isMyTurnToProcess()) return;
  if (G.phase !== "playing") return;

  G.isGatheringTrick = false;

  let winner = getTrickWinner();
  if (winner < 0) winner = 0;

  let queenIdx = G.trickCards.findIndex((c) => c && c.suit === "♥" && c.rank === "Q");
  let aceIdx = G.trickCards.findIndex((c) => c && c.suit === "♥" && c.rank === "A");

  let trapHappened = false;
  if (queenIdx >= 0 && aceIdx >= 0 && queenIdx !== aceIdx) {
    G.trapCaughtBy = aceIdx;
    G.trapActive = true;
    G.scores[aceIdx] += 5;
    G.scores[queenIdx] -= 5;
    trapHappened = true;
    sfxTrap();
    triggerParticle("trap");
    G.gameMsg = `💀 ورطة! ${G.playerNames[aceIdx]} أخذ Q♥ بـ A♥! +5/-5`;
    G.gameMsgClass = "tarneb-msg";
  }

  G.tricksTaken[winner]++;
  G.totalTricksPlayed++;
  
  const currentTrickCards = G.trickCards.filter(c => c !== null) as Card[];
  G.playedCards.push(...currentTrickCards);

  if (!trapHappened) {
    G.gameMsg = `🏆 ${G.playerNames[winner]} كسب الحيلة ${G.totalTricksPlayed}/13`;
    G.gameMsgClass = "";
  }

  if (G.trickCards.some(c => c && c.suit === "♥")) {
    sfxKubaCapture();
  }
  sfxWin();
  G.winnerSlot = winner;
  G.lastTrickWinnerIndex = winner;
  G.lastTrickCards = [...G.trickCards];
  updateUI();

  setTimeout(() => {
    G.winnerSlot = null;
    G.trickCards = [null, null, null, null];
    G.anyoneTarnebThisTrick = false;
    G.isGatheringTrick = true;

    G.leadPlayer = winner;
    G.currentPlayer = winner;
    updateUI();

    setTimeout(() => {
       G.isGatheringTrick = false;
       updateUI();
       if (G.totalTricksPlayed >= 13) {
         endRound();
       } else {
         processNextPlay();
       }
    }, 600);
  }, 1000); // reduced from 1200 since we have 600ms gather anim
}

function endRound() {
  G.phase = "roundEnd";
  G.roundPhase = "📊 النتائج";
  G.turnStartTime = Date.now(); // Track for auto-close timer in multiplayer

  let results = [];
  const numPlayers = G.gameMode === "1v1" ? 2 : 4;
  
  let change0 = 0;
  let change1 = 0;
  let mult0 = "";
  let mult1 = "";

  if (G.gameMode === "Teams") {
    // Team 1 (idx 0, 2)
    let bid0 = G.bids[0] + G.bids[2];
    let taken0 = G.tricksTaken[0] + G.tricksTaken[2];
    if (G.roundNumber === 1) {
      change0 = taken0;
    } else {
      if (taken0 >= bid0) { change0 = bid0; if(bid0 >= 11) { change0*=3; mult0="×3"; } else if(bid0>=9) { change0*=2; mult0="×2"; } }
      else { change0 = -bid0; }
    }
    
    // Team 2 (idx 1, 3)
    let bid1 = G.bids[1] + G.bids[3];
    let taken1 = G.tricksTaken[1] + G.tricksTaken[3];
    if (G.roundNumber === 1) {
      change1 = taken1;
    } else {
      if (taken1 >= bid1) { change1 = bid1; if(bid1 >= 11) { change1*=3; mult1="×3"; } else if(bid1>=9) { change1*=2; mult1="×2"; } }
      else { change1 = -bid1; }
    }
    
    G.teamScores[0] += change0;
    G.teamScores[1] += change1;
    
    // Assign to players for results display
    results.push({ player: 0, bid: G.roundNumber === 1 ? "-" : bid0, taken: taken0, change: change0, multiplier: mult0 });
    results.push({ player: 1, bid: G.roundNumber === 1 ? "-" : bid1, taken: taken1, change: change1, multiplier: mult1 });
    results.push({ player: 2, bid: G.roundNumber === 1 ? "-" : bid0, taken: taken0, change: change0, multiplier: mult0 });
    results.push({ player: 3, bid: G.roundNumber === 1 ? "-" : bid1, taken: taken1, change: change1, multiplier: mult1 });
    
    // Keep individual scores somewhat matching for backwards compatibility if needed
    for(let p=0; p<4; p++) G.scores[p] = G.teamScores[p%2];
  } else {
    for (let p = 0; p < numPlayers; p++) {
      let bid = G.bids[p],
        taken = G.tricksTaken[p];
      let change = 0,
        multiplier = "";
        
      if (G.roundNumber === 1) {
        change = taken;
      } else {
        if (taken >= bid) {
          if (bid >= 7) {
            change = bid * 3;
            multiplier = "×3";
          } else if (bid >= 5) {
            change = bid * 2;
            multiplier = "×2";
          } else {
            change = bid;
          }
        } else {
          change = -bid;
        }
      }
      
      let displayBid: string | number = G.roundNumber === 1 ? "-" : bid;
      results.push({ player: p, bid: displayBid, taken, change, multiplier });
      G.scores[p] += change;
    }
  }

  // Check success for sound effect
  let humanSuccess = false;
  if (G.gameMode === "Teams") {
    const myTeamIdx = myPlayerIndex % 2 === 0 ? 0 : 1;
    const myChange = myTeamIdx === 0 ? change0 : change1;
    if (myChange > 0 || G.roundNumber === 1) humanSuccess = true;
  } else {
    const myRes = results.find(r => r.player === (myPlayerIndex === -1 ? 0 : myPlayerIndex));
    if (myRes && (myRes.change > 0 || G.roundNumber === 1)) humanSuccess = true;
  }

  if (humanSuccess) sfxRoundSuccess();
  else sfxRoundEnd();

  let bestInRound = results.reduce(
    (best, r) => (r.change > best.change ? r : best),
    results[0]
  );
  G.results = results;
  G.bestInRound = bestInRound;
  G.roundEndOverlayVisible = true;
  updateUI();

  let gameWinner = checkWinner();
  if (gameWinner !== null) {
    if (G.gameWinner === null) {
      if (myPlayerIndex !== -1) {
        const isWin = G.gameMode === "Teams" ? (gameWinner === (myPlayerIndex % 2)) : (gameWinner === myPlayerIndex);
        recordGameResult(G.scores[myPlayerIndex], isWin);
      }
    }
    G.gameWinner = gameWinner;
    updateUI();
  }
}

function checkWinner() {
  const numPlayers = G.gameMode === "1v1" ? 2 : 4;
  if (G.gameMode === "Teams") {
    if (G.teamScores[0] >= G.target) return (G.teamScores[0] > G.teamScores[1]) ? 0 : 1;
    if (G.teamScores[1] >= G.target) return 1;
    if (G.teamScores[0] <= -G.target) return 1;
    if (G.teamScores[1] <= -G.target) return 0;
  } else {
    for (let p = 0; p < numPlayers; p++) {
      if (G.scores[p] >= G.target) {
        let maxP = p;
        for (let j = 0; j < numPlayers; j++) if (G.scores[j] > G.scores[maxP]) maxP = j;
        return maxP;
      }
      if (G.scores[p] <= -G.target) {
        // If someone loses, the one with highest score wins
        let maxP = p === 0 ? 1 : 0;
        for (let j = 0; j < numPlayers; j++) if (j !== p && G.scores[j] > G.scores[maxP]) maxP = j;
        return maxP;
      }
    }
  }
  return null;
}

export function closeRoundEnd() {
  G.roundEndOverlayVisible = false;
  if (G.gameWinner === null) startNewRound();
  else {
    if (isMultiplayerMode) {
      // Disconnect smoothly if we're multiplayer
      window.dispatchEvent(new Event('tarneb-leave-room-end'));
    } else {
      resetGame();
    }
  }
}

export function resetGame() {
  G.roundEndOverlayVisible = false;
  G.gameWinner = null;
  G.scores = [0, 0, 0, 0];
  G.dealerIdx = Math.floor(Math.random() * 4);
  G.roundNumber = 0;
  startNewRound();
}

export function returnToMenu() {
  if (isMultiplayerMode) {
    window.dispatchEvent(new Event('tarneb-leave-room'));
  } else {
    G.phase = "intro";
    G.gameStarted = false;
    updateUI();
  }
}
