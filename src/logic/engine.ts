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

export type Phase = "intro" | "setup" | "stats" | "dealing" | "swapping" | "bidding" | "playing" | "roundEnd";

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
export const updateUI = () => listeners.forEach((l) => l());

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
  startNewRound();
}

function dealCardsAnimation(): Promise<void> {
  return new Promise((resolve) => {
    let deck: Card[] = [];
    SUITS.forEach((s) => RANKS.forEach((r) => deck.push({ suit: s, rank: r })));

    for (let round = 0; round < 4; round++) {
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }

    G.hands = [[], [], [], []];
    G.dealingCards = [];
    let playerIdx = (G.dealerIdx + 1) % 4;
    
    const distribution = Array.from({length: 52}, (_, i) => {
        const p = playerIdx;
        playerIdx = (playerIdx + 1) % 4;
        return { card: deck[i], player: p };
    });

    let current = 0;
    const interval = setInterval(() => {
        if (current >= distribution.length) {
            clearInterval(interval);
            setTimeout(() => {
                G.dealingCards = [];
                for (let p = 0; p < 4; p++) {
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

    if (G.playerWithHighestScore !== 0) {
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
  if (G.phase !== "swapping" || G.playerWithHighestScore !== 0) return;
  let c1 = G.exposedCards[0];
  let c2 = G.exposedCards[target];
  swapCards(0, target);
  if (c1 && c2) {
    G.gameMsg = `الكنق 👑 إستبدل ورقته المكشوفة (${c1.rank}${c1.suit}) بـ (${c2.rank}${c2.suit}) مع ${G.playerNames[target]}`;
  }
  updateUI();
  
  setTimeout(() => {
    startBidding();
  }, 3500);
}

export function humanSkipSwap() {
  if (G.phase !== "swapping" || G.playerWithHighestScore !== 0) return;
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
  processNextBid();
}

function processNextBid() {
  if (G.currentPlayer === G.dealerIdx && G.bids.every((b) => b > 0)) {
    finishBidding();
    return;
  }
  if (G.bids[G.currentPlayer] > 0) {
    G.currentPlayer = (G.currentPlayer + 1) % 4;
    processNextBid();
    return;
  }

  if (G.currentPlayer === 0) {
    showBidUI();
  } else {
    G.gameMsg = `⏳ ${G.playerNames[G.currentPlayer]} يفكر...`;
    updateUI();
    setTimeout(() => {
      computerBid(G.currentPlayer);
      G.currentPlayer = (G.currentPlayer + 1) % 4;
      processNextBid();
    }, 400 + Math.random() * 500);
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

  if (G.dealerIdx === 0 && G.bids.filter((b) => b === 0).length === 1) {
    let all2 = G.bids.every((b, i) => i === 0 || b === 2);
    G.bidWarning = all2 ? "⚠️ الجميع طلب 2 - عليك طلب 5+" : "⚠️ لا تجعل المجموع 13";
  } else {
    G.bidWarning = G.trapHolder === 0 ? "⚠️ معك Q♥ البنت كبة!" : "";
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
    G.bids[0] = G.pendingBid;
    G.bidOverlayVisible = false;
    sfxBid();
    G.currentPlayer = 1;
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
  if (G.phase !== "playing" || G.currentPlayer !== 0) return;

  let isLeading = G.trickCards.every((c) => c === null);
  let leadSuit: Suit | null = null;
  if (!isLeading) {
    leadSuit = G.trickCards[G.leadPlayer]?.suit || null;
  }

  let valid = getValidCards(G.hands[0], leadSuit, isLeading, G.anyoneTarnebThisTrick);
  let card = G.hands[0][idx];

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
  if (G.selectedCardIdx < 0 || G.currentPlayer !== 0) return;

  let card = G.hands[0][G.selectedCardIdx];
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

  G.trickCards[0] = card;
  if (G.exposedCards[0] && G.exposedCards[0]!.suit === card.suit && G.exposedCards[0]!.rank === card.rank) G.exposedCards[0] = null;
  G.hands[0].splice(G.selectedCardIdx, 1);
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

function selectBestCardAI(p: number, valid: Card[], leadSuit: Suit | null, isLeading: boolean) {
  let need = G.bids[p] - G.tricksTaken[p];
  let hasAceKuba = valid.some((c) => c.suit === "♥" && c.rank === "A");
  
  let opponentPlayedQueen = leadSuit ? G.trickCards.some(
    (c, i) => c && c.suit === "♥" && c.rank === "Q" && i !== p && i !== (p + 2) % 4
  ) : false;

  if (opponentPlayedQueen && hasAceKuba) {
    return valid.find((c) => c.suit === "♥" && c.rank === "A")!;
  }

  if (isLeading) {
    if (need > 0) {
      let nonKuba = valid.filter((c) => c.suit !== "♥");
      if (nonKuba.length > 0) {
        let sortedDesc = [...nonKuba].sort((a, b) => RANK_VAL[b.rank] - RANK_VAL[a.rank]);
        let highest = sortedDesc[0];
        if (highest.rank === 'A') return highest;
        if (highest.rank === 'K' && G.playedCards.some(c => c.suit === highest.suit && c.rank === 'A')) return highest;
        return highest;
      }
      
      let kuba = valid.filter((c) => c.suit === "♥");
      if (kuba.length > 0) {
          let sortedDesc = [...kuba].sort((a, b) => RANK_VAL[b.rank] - RANK_VAL[a.rank]);
          if (sortedDesc[0].rank === 'A' && !G.playedCards.some(c => c.suit === "♥" && c.rank === "Q")) {
              if (sortedDesc.length > 1 && sortedDesc[1].rank !== 'Q') return sortedDesc[1]; 
          }
          return sortedDesc[0];
      }
    } else {
      let nonKuba = valid.filter((c) => c.suit !== "♥");
      if (nonKuba.length > 0) {
        return nonKuba.reduce((a, b) => (RANK_VAL[a.rank] < RANK_VAL[b.rank] ? a : b));
      }
      return valid.reduce((a, b) => (RANK_VAL[a.rank] < RANK_VAL[b.rank] ? a : b));
    }
  }

  let currentWinner = getTrickWinner();
  let iAmWinning = currentWinner === p;

  if (iAmWinning && need <= 0) {
    return valid.reduce((a, b) => (RANK_VAL[a.rank] < RANK_VAL[b.rank] ? a : b));
  }

  if (need > 0) {
    let winning = valid.filter((c) => {
      if (c.suit === "♥" && !G.trickCards.some((tc) => tc && tc.suit === "♥")) return true;
      if (c.suit === "♥" && G.trickCards.some(tc => tc && tc.suit === "♥")) {
          let highestTrump = Math.max(...G.trickCards.filter(tc => tc && tc.suit === "♥").map(tc => RANK_VAL[tc!.rank]));
          return RANK_VAL[c.rank] > highestTrump;
      }
      if (c.suit === leadSuit) {
        let highestFollow = Math.max(...G.trickCards.filter(tc => tc && tc.suit === leadSuit).map(tc => RANK_VAL[tc!.rank]));
        return !G.trickCards.some(tc => tc && tc.suit === "♥") && RANK_VAL[c.rank] > highestFollow;
      }
      return false;
    });

    if (winning.length > 0) {
      return winning.reduce((a, b) => (RANK_VAL[a.rank] < RANK_VAL[b.rank] ? a : b));
    }
  }
  
  let dumpable = valid.filter(c => !(c.suit === "♥" && c.rank === "Q"));
  if (dumpable.length > 0) {
      return dumpable.reduce((a, b) => (RANK_VAL[a.rank] < RANK_VAL[b.rank] ? a : b));
  }

  return valid.reduce((a, b) => (RANK_VAL[a.rank] < RANK_VAL[b.rank] ? a : b));
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
  if (G.phase !== "playing") return;
  G.currentPlayer = (G.currentPlayer + 1) % 4;
  updateUI();

  if (G.trickCards.every((c) => c !== null)) {
    setTimeout(resolveTrick, 700);
    return;
  }

  let played = G.trickCards.filter((c) => c !== null).length;
  if (played === 3) {
    let last = G.trickCards.findIndex((c) => c === null);
    if (last >= 0 && last !== 0) {
      G.currentPlayer = last;
      updateUI();
      setTimeout(() => {
        computerPlay(last);
        updateUI();
        setTimeout(resolveTrick, 700);
      }, 350);
      return;
    }
  }

  processNextPlay();
}

function processNextPlay() {
  if (G.phase !== "playing") return;
  if (G.totalTricksPlayed >= 13) {
    endRound();
    return;
  }

  if (G.currentPlayer === 0) {
    G.selectedCardIdx = -1;
    let isLeading = G.trickCards.every((c) => c === null);
    let canLeadK = isLeading ? canLeadKuba(0) : true;
    if (isLeading && !canLeadK && G.hands[0].some((c) => c.suit !== "♥")) {
      G.playHint = "لا يمكن البدء بالكبة";
    } else {
      G.playHint = G.anyoneTarnebThisTrick ? "الكبة مسموحة" : "";
    }

    G.gameMsg = "🎯 دورك! اختر ورقة";
    G.gameMsgClass = "";
    updateUI();
  } else {
    G.gameMsg = `⏳ ${G.playerNames[G.currentPlayer]} يفكر...`;
    G.gameMsgClass = "";
    G.selectedCardIdx = -1;
    G.playHint = "";
    updateUI();

    setTimeout(() => {
      computerPlay(G.currentPlayer);
      advanceTurn();
    }, 500 + Math.random() * 600);
  }
}

function resolveTrick() {
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
      recordGameResult(G.scores[0], gameWinner === 0);
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
  else resetGame();
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
  G.phase = "intro";
  G.gameStarted = false;
  updateUI();
}
