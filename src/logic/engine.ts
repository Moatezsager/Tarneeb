import {
  sfxSelect,
  sfxPlay,
  sfxWin,
  sfxBid,
  sfxTrap,
  sfxTarneb,
  sfxDeal,
  sfxRoundEnd,
} from "../lib/audio";

import { recordGameResult } from "./stats";

export let myPlayerIndex = 0;
export const setMyPlayerIndex = (idx: number) => { myPlayerIndex = idx; };

let isMultiplayerMode = false;
let isHostMode = false;
export const setMultiplayerMode = (multi: boolean, host: boolean) => {
  isMultiplayerMode = multi;
  isHostMode = host;
};

// Responsible identifies if THIS client should handle autonomous state transitions (AI, timers, etc)
export function isMyTurnToProcess(targetPlayer?: number): boolean {
  if (!isMultiplayerMode) return true;
  const p = targetPlayer ?? G.currentPlayer;
  // If it's my turn, I process
  if (p === myPlayerIndex) return true;
  // If it's an AI turn (nobody joined at that slot), Host processes
  const isAI = !G.playerNames[p] || G.playerNames[p].includes("كمبيوتر");
  if (isAI && isHostMode) return true;
  return false;
}

let onSyncNeeded: (() => void) | null = null;
export const setOnSyncNeeded = (fn: () => void) => { onSyncNeeded = fn; };

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
export interface Card {
  suit: Suit;
  rank: Rank;
}

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

export type Phase = "intro" | "setup" | "stats" | "multiplayer" | "profile" | "dealing" | "swapping" | "bidding" | "playing" | "roundEnd";

export const G = {
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
  turnStartTime: 0,
  turnTimeout: 20, // 20 seconds per turn
  playHint: "",
  roundPhase: "",
  bidOverlayVisible: false,
  bidWarning: "",
  roundEndOverlayVisible: false,
  winnerSlot: null as number | null,
  playedCards: [] as Card[],
  dealingCards: [] as { id: number; card: Card; player: number; rotate: number }[],
};

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
  aiNames: string[] = []
) {
  G.target = targetPoints;
  G.difficulty = diff;
  G.playerNames = [
    pname || "البطل", 
    aiNames[0] || PLAYER_NAMES[1], 
    aiNames[1] || PLAYER_NAMES[2], 
    aiNames[2] || PLAYER_NAMES[3]
  ];
  G.scores = [0, 0, 0, 0];
  G.dealerIdx = Math.floor(Math.random() * 4);
  G.roundNumber = 0;
  G.gameStarted = true;
  G.phase = "dealing";
  // For single player, we just start
  startNewRound();
}

function shuffleDeck(): Card[] {
  let deck: Card[] = [];
  SUITS.forEach((s) => RANKS.forEach((r) => deck.push({ suit: s, rank: r })));

  for (let round = 0; round < 4; round++) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  return deck;
}

export async function dealCardsAnimation(): Promise<void> {
  return new Promise((resolve) => {
    // We'll create a reproduction of the distribution order
    const distribution: { card: Card; player: number }[] = [];
    let playerIdx = (G.dealerIdx + 1) % 4;
    
    // Flatten hands into distribution order
    const tempHands = G.hands.map(h => [...h]);
    G.hands = [[], [], [], []]; // Clear for animation
    
    for (let i = 0; i < 52; i++) {
        const p = playerIdx;
        playerIdx = (playerIdx + 1) % 4;
        const card = tempHands[p].shift();
        if (card) distribution.push({ card, player: p });
    }

    let current = 0;
    isSyncLocked = true; // Don't sync during animation
    const interval = setInterval(() => {
        if (current >= distribution.length) {
            clearInterval(interval);
            isSyncLocked = false;
            setTimeout(() => {
                G.dealingCards = [];
                for (let p = 0; p < 4; p++) {
                  G.hands[p] = [...distribution.filter(d => d.player === p).map(d => d.card)];
                  G.hands[p].sort((a, b) => {
                    if (a.suit !== b.suit) return SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit];
                    return RANK_VAL[b.rank] - RANK_VAL[a.rank];
                  });
                }

                G.trapHolder = -1;
                for (let p = 0; p < 4; p++) {
                  if (G.hands[p].some((c) => c.suit === "♥" && c.rank === "Q")) {
                    G.trapHolder = p;
                    break;
                  }
                }
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
  G.dealerIdx = (G.dealerIdx + 1) % 4;
  G.currentPlayer = (G.dealerIdx + 1) % 4;
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
    let playerIdx = (G.dealerIdx + 1) % 4;
    G.hands = [[], [], [], []];
    for (let i = 0; i < 52; i++) {
      G.hands[playerIdx].push(deck[i]);
      playerIdx = (playerIdx + 1) % 4;
    }
  }
  
  updateUI();

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
      G.currentPlayer = (G.dealerIdx + 1) % 4;
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

function executeAISwap() {
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
}

export function humanSkipSwap() {
  if (G.phase !== "swapping" || G.playerWithHighestScore !== myPlayerIndex) return;
  G.gameMsg = `الكنق 👑 قرر عدم التبديل (محتفظ بورقته)`;
  updateUI();
  
  setTimeout(() => {
    startBidding();
  }, 2500);
}

function startBidding() {
  G.phase = "bidding";
  G.bids = [0, 0, 0, 0];
  G.currentPlayer = (G.dealerIdx + 1) % 4;
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
      G.currentPlayer = (G.currentPlayer + 1) % 4;
      processNextBid();
  } else if (G.phase === "playing") {
      const hand = G.hands[playerIdx];
      const isLeading = G.trickCards.every((c) => c === null);
      let leadSuit: Suit | null = null;
      if (!isLeading) {
          leadSuit = G.trickCards[G.leadPlayer]?.suit || null;
      }
      const valid = getValidCards(hand, leadSuit, isLeading, G.anyoneTarnebThisTrick);
      const card = selectBestCardAI(playerIdx, valid, leadSuit, isLeading);
      
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
  if (G.currentPlayer === G.dealerIdx && G.bids.every((b) => b > 0)) {
    finishBidding();
    return;
  }
  if (G.bids[G.currentPlayer] > 0) {
    G.currentPlayer = (G.currentPlayer + 1) % 4;
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
      G.currentPlayer = (G.currentPlayer + 1) % 4;
      processNextBid();
    }, bot ? 400 : 1500);
  }
}

export function getAvailableBids(p: number) {
  let avail = [...VALID_BIDS];
  let total = G.bids.reduce((s, b) => s + b, 0);
  avail = avail.filter((b) => total + b !== 13);

  if (p === G.dealerIdx) {
    let all2 = G.bids.every((b, i) => i === G.dealerIdx || b === 2);
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
    G.bids[myPlayerIndex] = G.pendingBid;
    G.bidOverlayVisible = false;
    sfxBid();
    G.currentPlayer = (myPlayerIndex + 1) % 4;
    processNextBid();
  }
}

function computerBid(p: number) {
  let hand = G.hands[p];
  let avail = getAvailableBids(p);

  let bidVal = 0;
  let kubaCards = hand.filter((c) => c.suit === "♥").sort((a,b)=>RANK_VAL[b.rank]-RANK_VAL[a.rank]);
  let kubaCount = kubaCards.length;

  if (kubaCards.some(c=>c.rank==='A')) bidVal += 1.1;
  if (kubaCards.some(c=>c.rank==='K')) bidVal += 0.9;
  if (kubaCards.some(c=>c.rank==='Q')) bidVal += 0.5;
  if (kubaCards.some(c=>c.rank==='J')) bidVal += 0.4;

  if (kubaCount > 3) bidVal += (kubaCount - 3) * 0.7;

  for (let s of ['♠', '♦', '♣']) {
      let suitCards = hand.filter(c => c.suit === s).sort((a,b)=>RANK_VAL[b.rank]-RANK_VAL[a.rank]);
      if (suitCards.length === 0) {
          if (kubaCount >= 2) bidVal += 0.6;
          continue;
      }
      
      let topRank = suitCards[0].rank;
      if (topRank === 'A') {
          bidVal += 1;
          if (suitCards.length > 1 && suitCards[1].rank === 'K') bidVal += 0.8;
      } else if (topRank === 'K' && suitCards.length > 1) {
          bidVal += 0.4;
      }
  }

  let estimate = Math.round(bidVal);

  switch (G.difficulty) {
    case "easy":
      estimate = Math.max(2, estimate - 1);
      break;
    case "medium":
      estimate = estimate;
      break;
    case "hard":
      estimate = Math.min(13, estimate + (Math.random() > 0.6 ? 1 : 0));
      break;
  }

  estimate = Math.max(2, Math.min(13, estimate));

  let best = avail[0],
    minDiff = Infinity;
  for (let bid of avail) {
    let diff = Math.abs(bid - estimate);
    let adj = bid <= estimate ? diff * 0.6 : diff * 1.5;
    if (adj < minDiff) {
      minDiff = adj;
      best = bid;
    }
  }
  G.bids[p] = best;
}

function finishBidding() {
  G.phase = "playing";
  G.tricksTaken = [0, 0, 0, 0];
  G.totalTricksPlayed = 0;
  G.leadPlayer = (G.dealerIdx + 1) % 4;
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
  }

  G.trickCards[myPlayerIndex] = card;
  if (G.exposedCards[myPlayerIndex] && G.exposedCards[myPlayerIndex]!.suit === card.suit && G.exposedCards[myPlayerIndex]!.rank === card.rank) G.exposedCards[myPlayerIndex] = null;
  G.hands[myPlayerIndex].splice(G.selectedCardIdx, 1);
  G.selectedCardIdx = -1;
  G.playHint = "";

  sfxPlay();
  updateUI();

  advanceTurn();
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
  
  if (isLeading) {
    const nonTarneb = valid.filter(c => c.suit !== tarnebSuit);
    if (nonTarneb.length > 0) {
       const high = nonTarneb.filter(c => ['A', 'K', 'Q'].includes(c.rank));
       if (high.length > 0) return high[0];
       const suitCounts: Record<string, number> = {};
       nonTarneb.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);
       const bestSuit = Object.keys(suitCounts).sort((a,b) => suitCounts[b] - suitCounts[a])[0];
       return nonTarneb.filter(c => c.suit === bestSuit).sort((a,b) => RANK_VAL[b.rank] - RANK_VAL[a.rank])[0];
    }
    return valid.sort((a,b) => RANK_VAL[b.rank] - RANK_VAL[a.rank])[0];
  }

  const leadCards = G.trickCards.filter(c => c !== null) as Card[];
  const mySuitCards = valid.filter(c => c.suit === leadSuit);
  
  if (mySuitCards.length > 0) {
    const currentBest = leadCards.reduce((best, curr) => {
        if (curr.suit === leadSuit && RANK_VAL[curr.rank] > RANK_VAL[best.rank]) return curr;
        return best;
    }, leadCards[0]);

    const canWin = mySuitCards.filter(c => RANK_VAL[c.rank] > RANK_VAL[currentBest.rank]);
    if (canWin.length > 0) return canWin.sort((a, b) => RANK_VAL[a.rank] - RANK_VAL[b.rank])[0];
    return mySuitCards.sort((a, b) => RANK_VAL[a.rank] - RANK_VAL[b.rank])[0];
  }

  const tarnebs = valid.filter(c => c.suit === tarnebSuit);
  if (tarnebs.length > 0) {
     const currentBestTarneb = leadCards.filter(c => c.suit === tarnebSuit).sort((a,b) => RANK_VAL[b.rank] - RANK_VAL[a.rank])[0];
     if (!currentBestTarneb || tarnebs.some(t => RANK_VAL[t.rank] > RANK_VAL[currentBestTarneb.rank])) {
        const potential = currentBestTarneb ? tarnebs.filter(t => RANK_VAL[t.rank] > RANK_VAL[currentBestTarneb.rank]) : tarnebs;
        return potential.sort((a,b) => RANK_VAL[a.rank] - RANK_VAL[b.rank])[0];
     }
  }

  return valid.sort((a, b) => RANK_VAL[a.rank] - RANK_VAL[b.rank])[0];
}

export function isBot(playerIdx: number) {
  return G.playerNames[playerIdx]?.includes("كمبيوتر");
}

function getTrickWinner() {
  let li = G.leadPlayer;
  if (!G.trickCards[li]) return -1;
  let leadSuit = G.trickCards[li]!.suit;
  let winner = li,
    highest = RANK_VAL[G.trickCards[li]!.rank];

  for (let i = 0; i < 4; i++) {
    if (i === li || !G.trickCards[i]) continue;
    let card = G.trickCards[i]!;
    if (card.suit === "♥" && G.trickCards[winner]!.suit !== "♥") {
      winner = i;
      highest = RANK_VAL[card.rank];
    } else if (card.suit === G.trickCards[winner]!.suit && RANK_VAL[card.rank] > highest) {
      winner = i;
      highest = RANK_VAL[card.rank];
    }
  }
  return winner;
}

function advanceTurn() {
  if (!isMyTurnToProcess()) return;
  if (G.phase !== "playing") return;
  
  if (G.trickCards.every((c) => c !== null)) {
    setTimeout(resolveTrick, 700);
    return;
  }

  G.currentPlayer = (G.currentPlayer + 1) % 4;
  
  // Set timer for next player
  const isBot = G.playerNames[G.currentPlayer].includes("كمبيوتر");
  G.turnTimeout = isBot ? 3 : 20;
  G.turnStartTime = Date.now();
  
  updateUI();
  processNextPlay();
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

  sfxWin();
  G.winnerSlot = winner;
  updateUI();

  setTimeout(() => {
    G.winnerSlot = null;
    G.trickCards = [null, null, null, null];
    G.anyoneTarnebThisTrick = false;

    G.leadPlayer = winner;
    G.currentPlayer = winner;
    updateUI();

    if (G.totalTricksPlayed >= 13) {
      endRound();
    } else {
      processNextPlay();
    }
  }, 1200);
}

function endRound() {
  G.phase = "roundEnd";
  G.roundPhase = "📊 النتائج";
  sfxRoundEnd();

  let results = [];
  for (let p = 0; p < 4; p++) {
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
        recordGameResult(G.scores[myPlayerIndex], gameWinner === myPlayerIndex);
      }
    }
    G.gameWinner = gameWinner;
    updateUI();
  }
}

function checkWinner() {
  for (let p = 0; p < 4; p++) {
    if (G.scores[p] >= G.target) return p;
    if (G.scores[p] <= -G.target) return p;
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
