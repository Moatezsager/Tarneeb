import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { useGameState } from "./common";
import { G, updateUI, getAvailableBids, selectBid, confirmBid, handleSelectCard, executePlay, closeRoundEnd, returnToMenu, removeParticle, Card, resetGame, myPlayerIndex, getTrickWinner, humanSwap, humanSkipSwap } from "../logic/engine";
import { multiplayerState } from "../logic/multiplayer";
import { UserProfileModal } from "./UserProfileModal";
import { UserProfile } from "../logic/userProfile";
import { ShieldAlert, ShieldCheck, Home, Settings, Eye, Users, Info, RotateCcw, LogOut, Wifi, WifiOff, Volume2, VolumeX, BarChart2, Trophy, Crown, Medal, Menu } from "lucide-react";

function getCardImageUrl(card: Card | null) {
  if (!card) return '/cards/back.svg';
  const suitMap: Record<string, string> = { "♠": "S", "♥": "H", "♦": "D", "♣": "C" };
  const rank = card.rank === '10' ? 'T' : card.rank;
  return `/cards/${rank}${suitMap[card.suit]}.svg`;
}

function MiniCard({ card, isKuba }: { card: Card | null, isKuba: boolean }) {
  if (!card) return <div className="w-[36px] h-[52px] sm:w-[48px] sm:h-[68px] bg-black/20 rounded-[4px] animate-pulse" />;
  return (
    <div className={`w-[36px] h-[52px] sm:w-[48px] sm:h-[68px] relative min-w-0 flex-shrink-0 ${isKuba ? 'drop-shadow-[0_0_8px_rgba(231,76,60,0.6)]' : 'drop-shadow-sm'}`}>
      <img src={getCardImageUrl(card)} className="w-full h-full object-contain" draggable={false} alt={`${card?.rank}${card?.suit}`} loading="eager" fetchPriority="high" />
    </div>
  );
}

function DealingAnimation() {
  const gs = useGameState();
  if (gs.dealingCards.length === 0) return null;

  const positions = [
    { y: "30vh", x: 0 },
    { x: "30vw", y: 0 },
    { y: "-30vh", x: 0 },
    { x: "-30vw", y: 0 },
  ];

  return (
    <div className="fixed top-1/2 left-1/2 pointer-events-none z-[300]">
      <AnimatePresence>
        {gs.dealingCards.map(dc => (
          <motion.div
            key={dc.id}
            initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }}
            animate={{
              x: positions[dc.player].x,
              y: positions[dc.player].y,
              scale: 1,
              opacity: 1,
              rotate: dc.rotate
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute w-[32px] h-[46px] sm:w-[42px] sm:h-[60px] -ml-[16px] -mt-[23px] sm:-ml-[21px] sm:-mt-[30px]"
          >
            <img src="/cards/back.svg" className="w-full h-full object-contain drop-shadow" loading="eager" fetchPriority="high" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function useTurnTimer(turnStartTime: number, turnTimeout: number) {
  const [timeLeft, setTimeLeft] = React.useState(turnTimeout);

  React.useEffect(() => {
    // Save local start time when turnStartTime from server changes, but account for real elapsed if reasonable
    const estimatedElapsed = (Date.now() - turnStartTime) / 1000;
    const validElapsed = (estimatedElapsed >= 0 && estimatedElapsed <= turnTimeout) ? estimatedElapsed : 0;
    const localStart = Date.now() - (validElapsed * 1000);

    let frameId: number;
    const update = () => {
      const elapsed = (Date.now() - localStart) / 1000;
      let remaining = Math.ceil(turnTimeout - elapsed);
      if (remaining < 0) remaining = 0;
      if (remaining > turnTimeout) remaining = turnTimeout;
      setTimeLeft(remaining);
      if (remaining > 0) {
        frameId = requestAnimationFrame(update);
      }
    };
    update();
    return () => cancelAnimationFrame(frameId);
  }, [turnStartTime, turnTimeout]);

  return timeLeft;
}

function PlayerBadge({ index, positionClass, onProfileClick }: { index: number, positionClass: string, onProfileClick: (index: number) => void }) {
  const gs = useGameState();
  const name = gs.playerNames[index];
  const isDealer = gs.dealerIdx === index;
  const isActive = gs.currentPlayer === index;
  const score = gs.scores[index];
  const bid = gs.bids[index];
  const taken = gs.tricksTaken[index];
  const cardCount = gs.hands[index].length;
  const isYou = index === myPlayerIndex && myPlayerIndex !== -1;
  const exposedCard = gs.exposedCards[index];
  const isBot = name.includes("كمبيوتر");

  const showTimer = isActive && !isBot && (gs.phase === 'playing' || gs.phase === 'bidding' || gs.phase === 'swapping');
  const timeLeft = useTurnTimer(gs.turnStartTime, gs.turnTimeout);

  const realPlayer = multiplayerState.players.find(p => p.index === index);
  const isDisconnected = realPlayer && realPlayer.status === "disconnected";

  let teamBorder = 'border-[#333] shadow-xl z-20 hover:border-[var(--color-gold)]/50';
  let teamHeaderBg = 'bg-[#222] text-white';
  let activeClass = 'border-[var(--color-gold)] active-turn';
  let activeHeaderBg = 'bg-[var(--color-gold)] text-black';

  if (gs.gameMode === "Teams") {
    const myTeam = myPlayerIndex !== -1 ? myPlayerIndex % 2 : 0;
    const thisPlayerTeam = index % 2;
    if (thisPlayerTeam === myTeam) {
      teamBorder = 'border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.15)] z-20 hover:border-blue-400';
      teamHeaderBg = 'bg-blue-900/60 text-blue-50';
      activeClass = 'border-blue-500 active-turn-blue';
      activeHeaderBg = 'bg-blue-600 text-white';
    } else {
      teamBorder = 'border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.15)] z-20 hover:border-red-400';
      teamHeaderBg = 'bg-red-900/60 text-red-50';
      activeClass = 'border-red-500 active-turn-red';
      activeHeaderBg = 'bg-red-600 text-white';
    }
  };

  return (
    <div
      onClick={() => onProfileClick(index)}
      className={`absolute ${positionClass} flex flex-col bg-[#141423]/95 backdrop-blur-md rounded-xl border-2 ${isDisconnected ? 'border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : isActive ? activeClass : teamBorder} overflow-hidden transition-all min-w-[95px] max-w-[120px] cursor-pointer active:scale-95`}
    >

      {/* Header (Avatar, Name, Status) */}
      <div className={`w-full flex items-center py-1 px-2 gap-1.5 relative ${isActive ? activeHeaderBg : teamHeaderBg}`} dir="rtl">
        {/* Avatar */}
        <div className="w-5 h-5 rounded-full overflow-hidden bg-black/20 shrink-0 flex items-center justify-center text-[10px] relative border border-white/10">
          {isBot ? '🤖' : realPlayer?.avatar?.startsWith('http') ? <img src={realPlayer.avatar} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : realPlayer?.avatar || '👤'}
          {isDisconnected && isActive && (
            <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center text-[10px]">🤖</div>
          )}
        </div>

        {/* Name and Status Container */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-1 w-full relative">
            <span className="text-[0.7rem] sm:text-[0.75rem] font-bold truncate leading-tight text-right w-full flex items-center gap-1">
              {name}
              {multiplayerState.isMultiplayer && (realPlayer?.uid === multiplayerState.hostId) && (
                <span title="مضيف الغرفة" className="drop-shadow-[0_0_5px_rgba(255,215,0,0.8)] text-[0.6rem]">👑</span>
              )}
            </span>
            {multiplayerState.isMultiplayer && !isBot && (
              <span className="shrink-0 flex items-center justify-center ml-0.5">
                {isDisconnected ? (
                  <WifiOff size={10} className="text-red-500 bg-black/50 rounded-full p-[1px] animate-pulse" />
                ) : (
                  <Wifi size={10} className={`${isActive ? 'text-black' : 'text-[var(--color-gold)]'} opacity-80`} />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Dealer Marker */}
        {isDealer && <span className={`absolute -right-1 -top-1 w-4 h-4 rounded-full flex items-center justify-center border-2 ${isActive ? 'bg-black border-[var(--color-gold)] text-[var(--color-gold)]' : 'bg-[var(--color-gold)] border-[#222] text-black'} text-[0.55rem] font-black leading-none animate-bounce shadow-lg z-10`}>م</span>}

        {/* Turn Timer Progress Bar */}
        {showTimer && (
          <div className="absolute bottom-0 left-0 w-full h-[2.5px] bg-black/20 overflow-hidden">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: gs.turnTimeout, ease: "linear" }}
              key={gs.turnStartTime}
              className={`h-full ${isActive ? 'bg-black' : 'bg-[var(--color-gold)]'}`}
            />
          </div>
        )}
      </div>

      {/* Body (Score & Extra Info) */}
      <div className="flex flex-col items-center px-1.5 py-1.5 relative bg-[#1a1a2e]">
        {exposedCard && !isYou && (
          <div className="absolute inset-0 flex items-center justify-center opacity-20 z-0 pointer-events-none transform scale-75">
            <MiniCard card={exposedCard} isKuba={exposedCard?.suit === '♥'} />
          </div>
        )}

        <div className={`z-10 text-xl sm:text-2xl font-black leading-none drop-shadow-md my-0.5 ${score < 0 ? 'text-[var(--color-kuba)]' : 'text-[var(--color-gold)]'}`}>
          {score}
        </div>

        {showTimer && (
          <div className={`absolute top-1 right-2 font-mono font-black text-xs drop-shadow-md z-20 ${timeLeft <= 5 ? 'text-red-500 animate-[ping_1s_ease-in-out_infinite]' : 'text-[var(--color-gold)]'}`}>
            {timeLeft}
          </div>
        )}
      </div>

      {/* Footer (Stats/Cards) */}
      <div className="w-full flex bg-black/40 text-[0.6rem] font-bold text-white/80 overflow-hidden border-t border-[#333]">
        <div className="flex-1 py-0.5 text-center truncate border-l border-[#333]/50">
          {bid > 0 ? <span className="text-[var(--color-gold)]">{bid}</span> : '-'}
        </div>
        <div className="flex-1 py-0.5 text-center truncate border-l border-[#333]/50">
          <span className={taken >= bid && bid > 0 ? 'text-green-400' : ''}>{taken}</span>
        </div>
        {!isYou && cardCount > 0 && (
          <div className="flex-1 py-0.5 text-center bg-black/30 flex items-center justify-center gap-0.5" title="الورق المتبقي">
            🎴 {cardCount}
          </div>
        )}
      </div>
    </div>
  );
}

function Spot({ index, position }: { index: number, position: string }) {
  const gs = useGameState();
  const isYou = index === myPlayerIndex && myPlayerIndex !== -1;

  const playedCard = gs.trickCards[index];
  const isWinner = gs.winnerSlot === index;

  let isCurrentWinner = false;
  if (gs.phase === "playing" && !gs.isGatheringTrick && !isWinner && playedCard) {
    isCurrentWinner = getTrickWinner() === index;
  }

  const isLeadPlayer = gs.leadPlayer === index && gs.phase === "playing" && gs.trickCards.some(c => c !== null) && !gs.isGatheringTrick;
  const hasTrap = gs.trapHolder === index && (isYou || gs.phase === "roundEnd");

  return (
    <div className={`absolute flex flex-col items-center gap-[2px] z-10 ${position}`}>
      <div className={`w-[40px] h-[56px] sm:w-[52px] sm:h-[72px] border-2 rounded-[5px] flex items-center justify-center text-[0.55rem] transition-colors relative shrink-0
        ${playedCard ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10' : 'border-dashed border-white/10 bg-black/20 text-[#888]'}
        ${playedCard && playedCard?.suit === '♥' && gs.trickCards.some(c => c?.suit !== '♥') ? 'border-[var(--color-kuba)] bg-[var(--color-kuba)]/15 shadow-[0_0_15px_rgba(231,76,60,0.4)]' : ''}
        ${isWinner ? 'winner-spot' : ''}
        ${isCurrentWinner ? 'shadow-[0_0_20px_rgba(241,196,15,0.6)] border-[var(--color-gold)] z-30 scale-[1.08] transition-all duration-300 ring-1 ring-yellow-400/50' : 'transition-all duration-300'}
      `}>
        {isLeadPlayer && (
          <div className="absolute -top-3 sm:-top-4 w-4 h-4 sm:w-5 sm:h-5 bg-white/10 border border-white/20 rounded-full flex items-center justify-center shadow-sm z-20" title="اللاعب الأول">
            <span className="text-[8px] sm:text-[10px] opacity-70">1️⃣</span>
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {playedCard ? (
            <motion.div
              key={playedCard.uid || `${playedCard?.suit}${playedCard?.rank}`}
              initial={{ scale: 0.2, opacity: 0, y: isYou ? 50 : 20, rotate: isYou ? 0 : Math.random() * 30 - 15 }}
              animate={{ scale: 1, opacity: 1, y: 0, rotate: isYou ? 0 : Math.random() * 10 - 5 }}
              exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 400, damping: 20, mass: 0.8 }}
              className="w-full h-full drop-shadow-lg relative"
            >
              <MiniCard card={playedCard} isKuba={playedCard?.suit === '♥'} />
              {isCurrentWinner && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shadow-[0_0_10px_rgba(255,215,0,0.8)] z-40"
                >
                  <span className="text-[8px] sm:text-[10px] drop-shadow-md">👑</span>
                </motion.div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
        {hasTrap && <div className="absolute -top-[15px] animate-bounce text-[0.7rem] drop-shadow-md z-30">💀</div>}
      </div>
    </div>
  );
}

function TableArea({ onProfileClick }: { onProfileClick: (index: number) => void }) {
  const gs = useGameState();
  const numPlayers = gs.gameMode === "1v1" ? 2 : 4;
  const baseIdx = myPlayerIndex !== -1 ? myPlayerIndex : 0;
  const pIdx = (offset: number) => (baseIdx + offset) % numPlayers;

  const bottomIdx = pIdx(0);
  const rightIdx = numPlayers === 4 ? pIdx(1) : -1;
  const topIdx = numPlayers === 4 ? pIdx(2) : pIdx(1);
  const leftIdx = numPlayers === 4 ? pIdx(3) : -1;

  return (
    <div className="flex-1 relative flex items-center justify-center min-h-0 py-1 w-full my-2">
      {topIdx !== -1 && <PlayerBadge index={topIdx} positionClass="top-1 sm:top-2 left-1 sm:left-2 z-20" onProfileClick={onProfileClick} />}
      {rightIdx !== -1 && <PlayerBadge index={rightIdx} positionClass="top-1 sm:top-2 right-1 sm:right-2 z-20" onProfileClick={onProfileClick} />}
      {leftIdx !== -1 && <PlayerBadge index={leftIdx} positionClass="bottom-1 sm:bottom-2 left-1 sm:left-2 z-20" onProfileClick={onProfileClick} />}
      {bottomIdx !== -1 && <PlayerBadge index={bottomIdx} positionClass="bottom-1 sm:bottom-2 right-1 sm:right-2 z-20" onProfileClick={onProfileClick} />}

      <div className="relative w-[190px] xs:w-[230px] sm:w-[320px] aspect-square flex items-center justify-center">
        <div className="absolute inset-[8%] sm:inset-[10%] table-felt rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] flex items-center justify-center">
          <div className="text-center opacity-10 pointer-events-none select-none">
            <div className="text-[var(--color-gold)] text-[10px] font-black uppercase tracking-widest leading-none mb-1">الهدف</div>
            <div className="text-[var(--color-gold)] text-4xl sm:text-5xl font-black leading-none">{gs.target}</div>
          </div>
        </div>
        {topIdx !== -1 && <Spot index={topIdx} position="-top-[20px] sm:-top-[30px] left-1/2 -translate-x-1/2" />}
        {rightIdx !== -1 && <Spot index={rightIdx} position="-right-[20px] sm:-right-[30px] top-1/2 -translate-y-1/2" />}
        {bottomIdx !== -1 && <Spot index={bottomIdx} position="-bottom-[20px] sm:-bottom-[30px] left-1/2 -translate-x-1/2" />}
        {leftIdx !== -1 && <Spot index={leftIdx} position="-left-[20px] sm:-left-[30px] top-1/2 -translate-y-1/2" />}

        {gs.isGatheringTrick && gs.lastTrickWinnerIndex !== -1 && (
          <div className="absolute inset-0 z-[100] pointer-events-none">
            {gs.lastTrickCards.map((c, i) => {
              if (!c) return null;

              // Map index to position string
              const posStr = i === topIdx ? "-top-[20px] sm:-top-[30px] left-1/2 -translate-x-1/2" :
                i === rightIdx ? "-right-[20px] sm:-right-[30px] top-1/2 -translate-y-1/2" :
                  i === bottomIdx ? "-bottom-[20px] sm:-bottom-[30px] left-1/2 -translate-x-1/2" :
                    "-left-[20px] sm:-left-[30px] top-1/2 -translate-y-1/2";

              const isWinner = i === gs.lastTrickWinnerIndex;
              const winPosStr = gs.lastTrickWinnerIndex === topIdx ? "top" :
                gs.lastTrickWinnerIndex === rightIdx ? "right" :
                  gs.lastTrickWinnerIndex === bottomIdx ? "bottom" : "left";

              return (
                <motion.div
                  key={`${c.uid}-gather`}
                  className={`absolute flex flex-col items-center gap-[2px] z-[100] ${posStr}`}
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: Math.random() * 10 - 5 }}
                  animate={{
                    x: winPosStr === 'right' ? 120 : winPosStr === 'left' ? -120 : 0,
                    y: winPosStr === 'bottom' ? 120 : winPosStr === 'top' ? -120 : 0,
                    scale: 0.1,
                    opacity: 0,
                    rotate: (isWinner ? 0 : Math.random() * 180 - 90)
                  }}
                  transition={{ duration: 0.5, ease: [0.32, 0, 0.67, 0] }}
                >
                  <div className="w-[40px] h-[56px] sm:w-[52px] sm:h-[72px] shrink-0 drop-shadow-2xl">
                    <MiniCard card={c} isKuba={c?.suit === '♥'} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}



function PlayerHand() {
  const gs = useGameState();
  if (myPlayerIndex === -1) return null;
  const hand = gs.hands[myPlayerIndex];

  return (
    <div className="bg-black/50 rounded-t-2xl p-1 border-t-2 border-[var(--color-gold)]/30 mx-1">
      <div className="flex justify-center items-center px-2 mb-1">
        <span className="font-bold text-[var(--color-gold)] text-[0.65rem] drop-shadow-md">🎴 أوراقك</span>
      </div>
      <div className="flex justify-center items-end h-[90px] sm:h-[110px] px-1 pt-2 pb-1 flex-nowrap overflow-visible">
        <AnimatePresence mode="popLayout">
          {hand.map((card, i) => {
            const isSelected = gs.selectedCardIdx === i;
            let notPlayable = false;
            if (gs.phase === 'playing' && gs.currentPlayer === myPlayerIndex) {
              // Need to check playability based on trick leader
              const isLeading = gs.trickCards.every(c => c === null);
              const leadSuit = isLeading ? null : gs.trickCards[gs.leadPlayer]?.suit;
              const hasLeadSuit = leadSuit ? hand.some(c => c?.suit === leadSuit) : false;
              if (leadSuit && hasLeadSuit && card?.suit !== leadSuit) notPlayable = true;
              if (isLeading && card?.suit === '♥' && !gs.tarnebPlayed && !gs.anyoneTarnebThisTrick && hand.some(c => c?.suit !== '♥')) notPlayable = true; // Can't lead Kuba normally unless all Kuba or broken
            } else if (gs.phase === 'playing' && gs.currentPlayer !== myPlayerIndex) {
              notPlayable = true;
            }

            return (
              <motion.div
                key={card.uid || `${card?.suit}${card?.rank}-${i}`}
                layout
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  y: isSelected ? -50 : 0,
                  scale: isSelected ? 1.15 : 1,
                  zIndex: isSelected ? 30 : i
                }}
                exit={{ opacity: 0, y: -40, scale: 0.6, filter: "blur(2px)", pointerEvents: "none" }}
                whileHover={!notPlayable && !isSelected ? { y: -20, zIndex: 29 } : {}}
                whileTap={!notPlayable ? { scale: 0.95 } : {}}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 35,
                  mass: 0.8
                }}
                className={`w-[54px] h-[78px] xs:w-[58px] xs:h-[84px] sm:w-[72px] sm:h-[104px] relative cursor-pointer flex-shrink-0 select-none
                  ${i > 0 ? '-ml-[34px] xs:-ml-[36px] sm:-ml-[46px]' : ''}
                  ${isSelected ? 'drop-shadow-[0_0_20px_rgba(212,175,55,0.8)] z-30' : 'drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]'}
                  ${notPlayable ? 'opacity-40 grayscale-[0.8] brightness-[0.5] cursor-not-allowed pointer-events-none' : 'opacity-100 brightness-110 z-10'}
                  ${!notPlayable && !gs.isGatheringTrick && gs.currentPlayer === myPlayerIndex ? 'shadow-[0_0_15px_rgba(212,175,55,0.3)] ring-1 ring-[var(--color-gold)]/20 rounded-[4px]' : ''}
                  ${card?.suit === '♥' && !isSelected && !notPlayable ? 'drop-shadow-[0_0_12px_rgba(231,76,60,0.5)]' : ''}
                  ${card?.suit === '♥' && card?.rank === 'Q' ? 'trap-card' : ''}
                `}
                onClick={() => handleSelectCard(i)}
                onDoubleClick={() => {
                  if (!notPlayable && gs.currentPlayer === myPlayerIndex && gs.phase === 'playing' && !gs.isGatheringTrick) {
                    handleSelectCard(i);
                    executePlay();
                  }
                }}
              >
                <img src={getCardImageUrl(card)} className="w-full h-full object-contain rounded-[4px]" draggable={false} alt={`${card?.rank}${card?.suit}`} loading="eager" fetchPriority="high" />
                {isSelected && <div className="absolute inset-[1px] rounded-[4px] border-[2px] border-[var(--color-gold)] pointer-events-none shadow-[inset_0_0_15px_rgba(212,175,55,0.5)]"></div>}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none rounded-[4px]"></div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="text-center mt-1 flex gap-2 justify-center items-center h-[30px]">
        <button
          className="px-4 py-1.5 rounded-full font-black text-[0.65rem] disabled:bg-[#333] disabled:text-[#666] disabled:scale-100 transition-transform active:scale-95 bg-gradient-to-b from-[#f9e698] to-[#aa8d2e] text-black shadow-lg shadow-black/20"
          disabled={gs.selectedCardIdx < 0 || gs.currentPlayer !== myPlayerIndex || gs.phase !== 'playing' || gs.isGatheringTrick}
          onClick={() => executePlay()}
        >
          🎯 العب
        </button>
        <span className="text-[0.55rem] text-[#888]">{gs.playHint}</span>
      </div>
    </div>
  );
}

function BiddingOverlay() {
  const gs = useGameState();
  if (!gs.bidOverlayVisible || myPlayerIndex === -1) return null;
  const avail = getAvailableBids(myPlayerIndex);

  return (
    <div className="absolute bottom-[110px] sm:bottom-[120px] left-1/2 -translate-x-1/2 z-50 flex items-center justify-center p-1 w-full pointer-events-none">
      <div className="bg-[var(--color-surface)]/95 backdrop-blur-xl p-2 sm:p-3 rounded-2xl border border-[var(--color-gold)] w-[90%] max-w-[280px] text-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] pointer-events-auto">
        <div className="text-[var(--color-gold)] mb-2 text-sm font-black drop-shadow-md">🎯 اختر طلبك</div>

        {/* Show what others bid */}
        <div className="flex justify-center gap-1.5 mb-2.5 flex-wrap">
          {gs.bids.map((b, i) => i !== 0 && b > 0 && (
            <div key={i} className="bg-black/60 border border-white/10 px-2 py-0.5 rounded text-[0.55rem] sm:text-[0.6rem] text-[#aaa]">
              {gs.playerNames[i]}: <strong className="text-[var(--color-gold)] px-1">{b}</strong>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-1 my-1">
          {avail.map(bid => (
            <button
              key={bid}
              className={`w-[32px] h-[32px] sm:w-[36px] sm:h-[36px] rounded-[8px] border font-bold text-xs sm:text-sm transition-transform active:scale-95 ${gs.pendingBid === bid ? 'bg-[var(--color-gold)] text-black border-[var(--color-gold)] font-black shadow-[0_0_15px_rgba(212,175,55,0.4)] scale-105' : 'bg-white/5 text-white border-[var(--color-gold)]/20 hover:bg-white/10'}`}
              onClick={() => selectBid(bid)}
            >
              {bid}
            </button>
          ))}
        </div>
        <button
          className="px-6 py-1.5 rounded-full font-black text-xs disabled:bg-[#555] disabled:text-[#888] disabled:shadow-none bg-gradient-to-b from-[#f9e698] to-[#aa8d2e] text-black mt-2 active:scale-95 transition-all shadow-[0_5px_15px_rgba(212,175,55,0.3)] w-full max-w-[150px]"
          disabled={gs.pendingBid === null}
          onClick={() => confirmBid()}
        >
          تأكيد الطلب
        </button>
        {gs.bidWarning && <div className="mt-1 text-[var(--color-kuba)] text-[0.6rem] font-bold min-h-[14px]">{gs.bidWarning}</div>}
      </div>
    </div>
  );
}

function RoundEndOverlay() {
  const gs = useGameState();
  const [timeLeft, setTimeLeft] = React.useState(15);

  React.useEffect(() => {
    if (!gs.roundEndOverlayVisible) return;
    if (gs.gameWinner !== null) return; // Don't auto close if game ended

    setTimeLeft(15);
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval);
          if (!multiplayerState.isMultiplayer || multiplayerState.isHost) {
            closeRoundEnd(); // Host actually closes it
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gs.roundEndOverlayVisible, gs.gameWinner]);

  if (!gs.roundEndOverlayVisible) return null;
  if (gs.gameWinner !== null) return null; // Let PodiumOverlay handle game end

  let results = gs.results || [];
  if (gs.gameMode === "Teams" && results.length >= 2) {
    results = [
      { ...results[0], playerLabel: "فريقنا" },
      { ...results[1], playerLabel: "الخصم" }
    ];
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface)] p-4 rounded-2xl border-2 border-[var(--color-gold)] w-full max-w-[420px] text-center">
        <div className="text-[var(--color-gold)] mb-2 text-sm font-black flex items-center justify-center gap-2">
          <BarChart2 className="w-4 h-4" /> نتائج الجولة
        </div>
        {gs.trapActive && (
          <div className="text-[#f39c12] text-[0.6rem] mb-1.5 font-bold animate-pulse">
            💀 ورطة: {gs.playerNames[gs.trapCaughtBy]} أخذ Q♥ بـ A♥ (+5/-5)
          </div>
        )}
        <table className="w-full border-collapse my-2 text-[0.65rem] sm:text-xs" dir="rtl">
          <thead>
            <tr>
              <th className="text-[var(--color-gold)] p-1.5 border-b border-[var(--color-gold)]/30">اللاعب</th>
              <th className="text-[var(--color-gold)] p-1.5 border-b border-[var(--color-gold)]/30">طلب</th>
              <th className="text-[var(--color-gold)] p-1.5 border-b border-[var(--color-gold)]/30">جمع</th>
              <th className="text-[var(--color-gold)] p-1.5 border-b border-[var(--color-gold)]/30">مضاعف</th>
              <th className="text-[var(--color-gold)] p-1.5 border-b border-[var(--color-gold)]/30">النقاط</th>
              <th className="text-[var(--color-gold)] p-1.5 border-b border-[var(--color-gold)]/30 font-black">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="hover:bg-white/5 transition-colors">
                <td className="p-1.5 border-b border-white/5 font-black text-white/90">{(r as any).playerLabel || gs.playerNames[r.player]} {r.player === gs.bestInRound?.player ? '⭐' : ''}</td>
                <td className="p-1.5 border-b border-white/5 text-[#ccc]">{r.bid}</td>
                <td className="p-1.5 border-b border-white/5 text-[#ccc]">{r.taken} {r.bid === "-" ? '' : (r.taken >= r.bid ? '✅' : '❌')}</td>
                <td className="p-1.5 border-b border-white/5 text-[#ccc]">{r.multiplier || '-'}</td>
                <td className={`p-1.5 border-b border-white/5 font-black ${r.change > 0 ? 'text-[#2ecc71]' : 'text-[var(--color-kuba)]'}`}>
                  {r.change > 0 ? '+' : ''}{r.change}
                </td>
                <td className="p-1.5 border-b border-white/5 font-black text-[var(--color-gold)]">
                  {gs.gameMode === "Teams" ? gs.scores[r.player % 2] : gs.scores[r.player]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {gs.bestInRound && gs.gameMode !== "Teams" && (
          <div className="mt-2 text-[#2ecc71] text-xs font-bold">
            ⭐ أفضل لاعب: {gs.playerNames[gs.bestInRound.player]} ({gs.bestInRound.change > 0 ? '+' : ''}{gs.bestInRound.change})
          </div>
        )}

        <div className="mt-4 flex flex-col items-center gap-2">
          {(!multiplayerState.isMultiplayer || multiplayerState.isHost) ? (
            <button
              className="px-8 py-2.5 bg-gradient-to-b from-[#f9e698] to-[#aa8d2e] text-black rounded-full font-black text-sm active:scale-95 shadow-[0_5px_15px_rgba(212,175,55,0.3)] hover:scale-105 transition-all w-full max-w-[200px]"
              onClick={() => closeRoundEnd()}
            >
              ✅ متابعة ({timeLeft}ث)
            </button>
          ) : (
            <div className="px-6 py-2 bg-white/5 border border-white/10 text-white/60 rounded-full font-black text-xs flex justify-center items-center gap-2 w-full max-w-[220px]">
              <span className="w-3.5 h-3.5 border-2 border-[var(--color-gold)]/20 border-t-[var(--color-gold)] rounded-full animate-spin"></span>
              في انتظار المضيف... ({timeLeft}ث)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PodiumOverlay() {
  const gs = useGameState();

  if (!gs.roundEndOverlayVisible || gs.gameWinner === null) return null;

  if (gs.gameMode === "Teams") {
    const winningTeam = gs.gameWinner!;
    const winnerName1 = gs.playerNames[winningTeam];
    const winnerName2 = gs.playerNames[winningTeam + 2];
    return (
      <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-4 overflow-hidden">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="flex flex-col items-center">
          <Trophy className="w-24 h-24 text-[var(--color-gold)] mb-4 drop-shadow-[0_0_30px_rgba(212,175,55,0.8)]" />
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#f9e698] to-[#aa8d2e] mb-2 drop-shadow-lg text-center">🏆 الفريق الفائز 🏆</h1>
          <p className="text-white/60 text-sm mb-8">نهاية المباراة</p>

          <div className="bg-gradient-to-b from-[var(--color-gold)]/20 to-transparent p-8 rounded-3xl border-2 border-[var(--color-gold)] flex flex-col items-center shadow-[0_0_50px_rgba(212,175,55,0.2)]">
            <div className="text-3xl md:text-4xl font-black text-white text-center mb-4 leading-tight">{winnerName1} <br /><span className="text-[var(--color-gold)]">&</span><br /> {winnerName2}</div>
            <div className="text-2xl font-black text-[var(--color-gold)] mt-2 bg-black/50 px-6 py-2 rounded-full border border-[var(--color-gold)]/30">{gs.scores[winningTeam]} نقطة</div>
          </div>
        </motion.div>
        <div className="mt-12 flex gap-4">
          <button onClick={() => returnToMenu()} className="px-10 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-black text-lg transition-all border border-white/20">
            العودة للقائمة
          </button>
          {(!multiplayerState.isMultiplayer || multiplayerState.isHost) && (
            <button onClick={() => closeRoundEnd()} className="px-10 py-3 bg-gradient-to-b from-[#f9e698] to-[#aa8d2e] text-black rounded-full font-black text-lg transition-all shadow-[0_0_20px_rgba(212,175,55,0.5)]">
              مباراة جديدة
            </button>
          )}
        </div>
      </div>
    );
  } else {
    const sortedPlayers = gs.scores.map((score, index) => ({ score, index, name: gs.playerNames[index] })).sort((a, b) => b.score - a.score);
    const first = sortedPlayers[0];
    const second = sortedPlayers[1];
    const third = sortedPlayers[2];

    return (
      <div className="fixed inset-0 bg-[#0a0a12] z-[100] flex flex-col items-center justify-center p-4 overflow-hidden">
        <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#f9e698] to-[#aa8d2e] drop-shadow-lg">🎉 نهاية اللعبة 🎉</h1>
          <p className="text-white/50 text-sm mt-2">منصة التتويج الأسطورية</p>
        </motion.div>

        <div className="flex items-end justify-center gap-3 sm:gap-6 h-[220px] md:h-[280px] mt-4 mb-8">
          {/* Second Place */}
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8, type: "spring" }} className="flex flex-col items-center relative z-10 w-[80px] sm:w-[100px] md:w-[120px]">
            <div className="text-sm md:text-base text-white/90 font-bold mb-2 truncate w-full text-center px-1 drop-shadow-md">{second.name}</div>
            <div className="bg-gradient-to-t from-[#9ca3af] to-[#e5e7eb] w-full h-[120px] md:h-[150px] rounded-t-xl flex flex-col items-center pt-3 shadow-[0_0_30px_rgba(156,163,175,0.4)] border-t-4 border-white/80">
              <Medal className="w-8 h-8 text-[#6b7280] mb-1" />
              <span className="text-4xl md:text-5xl font-black text-[#4b5563] drop-shadow-sm">2</span>
            </div>
            <div className="absolute bottom-4 text-sm md:text-base font-black text-[#4b5563] drop-shadow-sm bg-white/40 px-3 py-1 rounded-full backdrop-blur-sm">{second.score}</div>
          </motion.div>

          {/* First Place */}
          <motion.div initial={{ y: 150, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.2, type: "spring" }} className="flex flex-col items-center relative z-20 w-[100px] sm:w-[120px] md:w-[140px]">
            <Crown className="w-12 h-12 md:w-16 md:h-16 text-[var(--color-gold)] mb-2 drop-shadow-[0_0_20px_rgba(212,175,55,1)] animate-bounce" />
            <div className="text-base md:text-lg text-[var(--color-gold)] font-black mb-2 truncate w-full text-center px-1 drop-shadow-lg">{first.name}</div>
            <div className="bg-gradient-to-t from-[#ca8a04] to-[#fde047] w-full h-[170px] md:h-[210px] rounded-t-xl flex flex-col items-center pt-4 shadow-[0_0_50px_rgba(234,179,8,0.6)] border-t-4 border-[#fef08a]">
              <Trophy className="w-10 h-10 text-[#713f12] mb-1 drop-shadow-md" />
              <span className="text-5xl md:text-6xl font-black text-[#713f12] drop-shadow-md">1</span>
            </div>
            <div className="absolute bottom-6 text-base md:text-lg font-black text-[#854d0e] drop-shadow-sm bg-white/40 px-4 py-1.5 rounded-full backdrop-blur-sm">{first.score}</div>
          </motion.div>

          {/* Third Place */}
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5, type: "spring" }} className="flex flex-col items-center relative z-10 w-[80px] sm:w-[100px] md:w-[120px]">
            <div className="text-sm md:text-base text-white/90 font-bold mb-2 truncate w-full text-center px-1 drop-shadow-md">{third.name}</div>
            <div className="bg-gradient-to-t from-[#b45309] to-[#fb923c] w-full h-[90px] md:h-[110px] rounded-t-xl flex flex-col items-center pt-3 shadow-[0_0_30px_rgba(217,119,6,0.4)] border-t-4 border-[#fdba74]">
              <Medal className="w-8 h-8 text-[#78350f] mb-1" />
              <span className="text-4xl md:text-5xl font-black text-[#78350f] drop-shadow-sm">3</span>
            </div>
            <div className="absolute bottom-4 text-sm md:text-base font-black text-[#78350f] drop-shadow-sm bg-white/40 px-3 py-1 rounded-full backdrop-blur-sm">{third.score}</div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }} className="mt-8 flex gap-4 z-30">
          <button
            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-black text-lg transition-all border border-white/20"
            onClick={() => returnToMenu()}
          >
            القائمة الرئيسية
          </button>
          {(!multiplayerState.isMultiplayer || multiplayerState.isHost) && (
            <button
              className="px-8 py-3 bg-gradient-to-b from-[#f9e698] to-[#aa8d2e] text-black rounded-full font-black text-lg active:scale-95 shadow-[0_0_30px_rgba(212,175,55,0.5)] hover:scale-105 transition-all"
              onClick={() => closeRoundEnd()}
            >
              مباراة جديدة
            </button>
          )}
        </motion.div>
      </div>
    );
  }
}

function ScoreboardOverlay({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const gs = useGameState();

  if (!isOpen) return null;

  const sortedPlayers = gs.scores.map((score, index) => ({
    score,
    index,
    name: gs.playerNames[index],
    bid: gs.bids[index],
    taken: gs.tricksTaken[index]
  })).sort((a, b) => b.score - a.score);

  return (
    <div className="fixed inset-0 z-[450] flex flex-col p-4 bg-black/80 backdrop-blur-md justify-center items-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-[400px] bg-[#1a1a2e] border-2 border-[var(--color-gold)] rounded-3xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-3">
          <h2 className="text-xl font-black text-[var(--color-gold)] flex items-center gap-2">
            <BarChart2 className="w-5 h-5" /> ترتيب اللاعبين
          </h2>
          <button onClick={onClose} className="p-1.5 bg-white/5 rounded-full text-[#aaa] hover:text-white hover:bg-white/10 transition-colors">
            ×
          </button>
        </div>

        {gs.gameMode === "Teams" ? (
          <div className="flex flex-col gap-3" dir="rtl">
            {[0, 1].map(teamId => {
              const p1 = gs.playerNames[teamId];
              const p2 = gs.playerNames[teamId + 2];
              const isMyTeam = myPlayerIndex !== -1 && (myPlayerIndex % 2 === teamId);

              return (
                <div key={teamId} className={`flex items-center justify-between p-3 rounded-xl border ${isMyTeam ? 'bg-blue-900/30 border-blue-500/50' : 'bg-red-900/30 border-red-500/50'}`}>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white/90">{isMyTeam ? 'فريقنا' : 'الخصم'}</span>
                    <span className="text-xs text-[#aaa] mt-0.5">{p1} & {p2}</span>
                  </div>
                  <div className="text-3xl font-black text-[var(--color-gold)] drop-shadow-md">
                    {gs.scores[teamId]}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-2" dir="rtl">
            {sortedPlayers.map((p, i) => (
              <div key={p.index} className={`flex items-center justify-between p-3 rounded-xl border ${p.index === myPlayerIndex ? 'bg-[var(--color-gold)]/20 border-[var(--color-gold)]/50' : 'bg-white/5 border-white/10'} relative overflow-hidden`}>
                {i === 0 && <div className="absolute right-0 top-0 bottom-0 w-1 bg-[var(--color-gold)]" />}
                <div className="flex items-center gap-3">
                  <div className={`w-6 text-center font-black ${i === 0 ? 'text-[var(--color-gold)]' : 'text-white/40'}`}>#{i + 1}</div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-bold ${p.index === myPlayerIndex ? 'text-[var(--color-gold)]' : 'text-white/90'} flex items-center gap-1`}>
                      {p.name} {i === 0 && <Crown className="w-3.5 h-3.5 text-[var(--color-gold)]" />}
                    </span>
                    <span className="text-[0.6rem] text-[#aaa] mt-0.5 flex gap-2">
                      <span>الطلب: <strong className="text-white">{p.bid > 0 ? p.bid : '-'}</strong></span>
                      <span>جمع: <strong className={p.taken >= p.bid && p.bid > 0 ? "text-green-400" : "text-white"}>{p.taken}</strong></span>
                    </span>
                  </div>
                </div>
                <div className="text-2xl font-black text-[var(--color-gold)] drop-shadow-md min-w-[40px] text-left">
                  {p.score}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-center bg-black/30 py-2 rounded-lg border border-white/5">
          <div className="text-[0.7rem] text-[#888] font-bold">الهدف للانتصار: <span className="text-[var(--color-gold)]">{gs.target}</span> نقطة</div>
        </div>
      </motion.div>
    </div>
  );
}

function ParticlesRenderer() {
  const gs = useGameState();
  return (
    <>
      {gs.particles.map(p => {
        const emojis = p.type === 'tarneb' ? ['🔪', '⚔️', '💥', '🔥', '💣'] : ['💀', '☠️', '💥', '🔥', '⚠️', '👻'];
        const emoji = emojis[Math.floor(p.key * emojis.length)];
        const left = 15 + p.key * 70;
        const top = 25 + (p.key * 1.5 % 1) * 50;
        const fontSize = 1 + p.key * 2.5;

        return (
          <div
            key={p.id}
            className="particle"
            style={{ left: `${left}%`, top: `${top}%`, fontSize: `${fontSize}rem` }}
            onAnimationEnd={() => removeParticle(p.id)}
          >
            {emoji}
          </div>
        );
      })}
    </>
  );
}

function useHaptics(gs: any) {
  const prevGs = React.useRef(gs);

  React.useEffect(() => {
    const pGs = prevGs.current;

    // 1. My turn started
    if (gs.currentPlayer === myPlayerIndex && pGs.currentPlayer !== myPlayerIndex && (gs.phase === 'playing' || gs.phase === 'swapping' || gs.phase === 'bidding')) {
      if (navigator.vibrate) navigator.vibrate(15);
    }

    // 2. I played a card
    if (myPlayerIndex !== -1 && gs.hands[myPlayerIndex]?.length < (pGs.hands[myPlayerIndex]?.length || 0)) {
      if (navigator.vibrate) navigator.vibrate(25);
    }

    // 3. Won trick
    if (gs.isGatheringTrick && !pGs.isGatheringTrick) {
      if (gs.lastTrickWinnerIndex === myPlayerIndex) {
        const hasQueen = gs.lastTrickCards.some((c: Card) => c?.suit === '♥' && c?.rank === 'Q');
        if (hasQueen) {
          if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
        } else {
          if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
        }
      }
    }

    // 4. Round end Win
    if (gs.phase === 'roundEnd' && pGs.phase !== 'roundEnd') {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    }

    prevGs.current = gs;
  }, [gs]);
}

export function GameScreen() {
  const gs = useGameState();
  useHaptics(gs);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<"leave" | "reset" | null>(null);
  const [profileModalUser, setProfileModalUser] = React.useState<UserProfile | null>(null);
  const [showSpectators, setShowSpectators] = React.useState(false);
  const [showScoreboard, setShowScoreboard] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // نظام الإصلاح الذاتي (Watchdog) - يعمل بالخلفية بدون إزعاج
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (gs.phase !== 'playing' && gs.phase !== 'bidding' && gs.phase !== 'swapping') return;
      
      const elapsed = (Date.now() - gs.turnStartTime) / 1000;
      
      // If turn is stuck for more than 4 seconds past the timeout
      if (elapsed > gs.turnTimeout + 4) {
         console.warn("[Auto-Heal] Game seems stuck. Attempting auto-repair...");
         resumeGameLoop();
         if (multiplayerState.isMultiplayer && multiplayerState.isHost) {
            updateUI(); // Force state sync to clients
         }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [gs.phase, gs.turnStartTime, gs.turnTimeout]);

  let headerScores = null;
  if (gs.gameMode === "Teams") {
    const myTeamIdx = myPlayerIndex % 2 === 0 ? 0 : 1;
    const oppTeamIdx = myTeamIdx === 0 ? 1 : 0;
    headerScores = (
      <div className="flex items-center justify-between flex-1 px-4">
        <div className="flex items-center gap-1.5 text-[0.7rem] sm:text-xs font-black bg-white/10 px-3 py-1 rounded-full border border-white/20">
          <span className="text-white/60">فريقنا:</span> <span className="text-[var(--color-gold)] drop-shadow-md text-base">{gs.teamScores[myTeamIdx]}</span>
          <span className="text-white/20 mx-1">|</span>
          <span className="text-red-400/80">الخصم:</span> <span className="text-red-300 text-base">{gs.teamScores[oppTeamIdx]}</span>
        </div>
        <div className="text-[0.6rem] sm:text-xs text-white/50 bg-black/40 px-2 py-0.5 rounded-md border border-[var(--color-gold)]/20 shadow-[0_0_10px_rgba(212,175,55,0.1)] hidden xs:block">
          الهدف: <strong className="text-[var(--color-gold)]">{gs.target}</strong>
        </div>
      </div>
    );
  } else {
    headerScores = (
      <div className="flex items-center justify-between flex-1 px-4">
        <div className="flex items-center gap-1.5 text-[0.7rem] sm:text-xs font-black bg-white/10 px-3 py-1 rounded-full border border-white/20">
          <span className="text-white/40">نقاطي:</span> <span className="text-[var(--color-gold)] font-bold text-base">{gs.scores[myPlayerIndex === -1 ? 0 : myPlayerIndex]}</span>
        </div>
        <div className="text-[0.6rem] sm:text-xs text-white/50 bg-black/40 px-2 py-0.5 rounded-md border border-[var(--color-gold)]/20 shadow-[0_0_10px_rgba(212,175,55,0.1)] hidden xs:block">
          الهدف: <strong className="text-[var(--color-gold)]">{gs.target}</strong>
        </div>
      </div>
    );
  }

  const handleProfileClick = (index: number) => {
    const name = gs.playerNames[index];
    if (name.includes("كمبيوتر")) {
      setProfileModalUser({
        uid: "bot-" + index,
        name: name,
        searchId: "BOT",
        country: "LY",
        gender: "male",
        avatar: "🤖",
        status: "online"
      });
    } else {
      const realPlayer = multiplayerState.players.find(p => p.index === index);
      if (realPlayer) {
        setProfileModalUser({
          uid: realPlayer.uid,
          name: realPlayer.name,
          searchId: "----",
          country: realPlayer.country,
          gender: "male",
          avatar: realPlayer.avatar,
          status: "online"
        });
      } else {
        setProfileModalUser({
          uid: "local-" + index,
          name: name,
          searchId: "LOCAL",
          country: "LY",
          gender: "male",
          avatar: "👤",
          status: "online"
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] pt-1 pb-1 px-1 overflow-hidden gap-[4px] relative">
      {isOffline && (
        <div className="absolute inset-0 z-[10000] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <WifiOff size={48} className="text-red-500 mb-4 animate-pulse" />
          <h2 className="text-[var(--color-gold)] font-black text-xl mb-2">انقطع الإتصال!</h2>
          <p className="text-white/70 text-center max-w-[250px] text-sm leading-relaxed">
            أنت تلعب بدون إنترنت الآن.<br />يرجى التحقق من الشبكة الخاصة بك للعودة للعبة، وإلا قد لا يتمكن أصدقائك من مجاراتك.
          </p>
        </div>
      )}
      <div className="flex justify-between items-center py-2 px-3 mx-1 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl shrink-0 mt-1 z-50 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-gold)]/5 to-transparent pointer-events-none" />

        <div className="flex gap-3 items-center relative z-10">
          <div className="flex flex-col pl-2">
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-gold)] font-black text-[0.6rem] bg-[var(--color-gold)]/10 px-1.5 py-0.5 rounded uppercase tracking-tighter">{gs.roundPhase}</span>
              {headerScores}
            </div>
            <div className="text-[10px] text-[#555] font-bold mt-0.5 flex items-center gap-1.5">
              <Users className="w-2.5 h-2.5" />
              <span>{G.spectators?.length || 0}</span>
              <span className="opacity-30">•</span>
              <span>الجولة {gs.roundNumber}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            className="text-white/60 hover:text-green-400 p-1.5 hover:bg-green-400/10 rounded-lg transition-all shadow-sm"
            onClick={() => {
              resumeGameLoop();
              if (multiplayerState.isMultiplayer && multiplayerState.isHost) {
                 updateUI();
              }
              G.gameMsg = "نظام اللعبة يعمل بشكل ممتاز ✅";
              G.gameMsgClass = "normal-msg";
              updateUI();
              setTimeout(() => { G.gameMsg = ""; updateUI(); }, 2000);
            }}
            title="تحديث وفحص النظام"
          >
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            className="text-white/60 hover:text-[var(--color-gold)] p-1.5 hover:bg-[var(--color-gold)]/10 rounded-lg transition-all shadow-sm"
            onClick={() => setShowScoreboard(true)}
            title="جدول النتائج"
          >
            <BarChart2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            className="text-white/60 hover:text-[var(--color-gold)] p-1.5 hover:bg-[var(--color-gold)]/10 rounded-lg transition-all"
            onClick={() => setMenuOpen(true)}
            title="الخيارات"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      <TableArea onProfileClick={handleProfileClick} />

      <div className={`text-center py-1 font-black text-[0.7rem] sm:text-[0.8rem] min-h-[22px] leading-[1.3] shrink-0 drop-shadow-md z-10 relative overflow-hidden`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={gs.gameMsg}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={gs.gameMsgClass === 'tarneb-msg' ? 'text-[var(--color-kuba)]' : 'text-[var(--color-gold)]'}
          >
            {gs.gameMsg}
          </motion.div>
        </AnimatePresence>
      </div>

      <PlayerHand />

      <SwapOverlay />
      <BiddingOverlay />
      <RoundEndOverlay />
      <PodiumOverlay />
      <ScoreboardOverlay isOpen={showScoreboard} onClose={() => setShowScoreboard(false)} />
      <ParticlesRenderer />
      <DealingAnimation />

      <UserProfileModal
        isOpen={!!profileModalUser}
        onClose={() => setProfileModalUser(null)}
        user={profileModalUser}
        isFriend={false}
      />

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[400] flex flex-col p-4 bg-black/80 backdrop-blur-sm justify-center items-center"
          >
            <div className="w-full max-w-[280px] flex flex-col gap-3">
              <button
                onClick={() => {
                  G.isMuted = !G.isMuted;
                  updateUI();
                }}
                className="p-3.5 bg-[#222]/80 border border-white/10 text-white rounded-2xl font-bold flex justify-center items-center gap-3 transition-colors hover:bg-white/10"
              >
                <span className="text-xl">
                  {gs.isMuted ? <VolumeX className="w-5 h-5 text-red-400 inline" /> : <Volume2 className="w-5 h-5 text-green-400 inline" />}
                </span>
                {gs.isMuted ? "تشغيل الصوت" : "كتم الصوت"}
              </button>
              <button onClick={() => { setMenuOpen(false); setAboutOpen(true); }} className="p-3.5 bg-[#222]/80 border border-white/10 text-white rounded-2xl font-bold flex justify-center items-center gap-3 transition-colors hover:bg-white/10">
                <span className="text-xl">ℹ️</span> حول اللعبة
              </button>
              {multiplayerState.isMultiplayer ? (
                <button onClick={() => { setMenuOpen(false); setConfirmAction('leave'); }} className="p-3.5 bg-red-900/30 border border-red-500/30 text-red-400 rounded-2xl font-bold flex justify-center items-center gap-3 transition-colors hover:bg-red-900/50 mt-4">
                  <span className="text-xl">🚪</span> مغادرة الغرفة
                </button>
              ) : (
                <>
                  <button onClick={() => { setMenuOpen(false); setConfirmAction('reset'); }} className="p-3.5 bg-[#222]/80 border border-white/10 text-white rounded-2xl font-bold flex justify-center items-center gap-3 transition-colors hover:bg-white/10 mt-2">
                    <span className="text-xl">🔄</span> إعادة المباراة
                  </button>
                  <button onClick={() => { setMenuOpen(false); setConfirmAction('leave'); }} className="p-3.5 bg-red-900/30 border border-red-500/30 text-red-400 rounded-2xl font-bold flex justify-center items-center gap-3 transition-colors hover:bg-red-900/50 mt-4">
                    <span className="text-xl">🚪</span> خروج للقائمة الرئيسية
                  </button>
                </>
              )}
              <button onClick={() => setMenuOpen(false)} className="mt-4 p-3 bg-transparent text-[#aaa] font-bold w-full text-center hover:text-white transition-colors">
                × إغلاق
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aboutOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[500] flex justify-center items-center p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setAboutOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-[#1a1a2e] border border-[var(--color-gold)] p-6 md:p-8 rounded-3xl w-full max-w-[400px] text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-5xl mb-3 drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]">🂡</div>
              <h2 className="text-2xl font-black text-[var(--color-gold)] mb-4 font-[var(--font-tajawal)] drop-shadow-md">طرنيب كلاسيك v3.0</h2>
              <p className="text-sm md:text-base text-[#ccc] mb-6 leading-relaxed">
                لعبة ورق ليبية شهيرة مبنية على طاولة الجواكر. تتميز بالنظام الجديد للورق المكشوف والكنق، إضافة لذكاء اصطناعي متطور يلعب وكأنه أصدقاؤك.
              </p>
              <div className="text-xs text-[#777] mb-8 bg-black/30 p-3 rounded-xl border border-white/5">
                تطوير: موصى به لمحبي ألعاب الورق التكتيكية.<br />جميع الحقوق محفوظة © 2026
              </div>
              <button onClick={() => setAboutOpen(false)} className="px-10 py-2.5 bg-gradient-to-b from-[#f9e698] to-[#aa8d2e] text-black font-black rounded-full active:scale-95 shadow-[0_5px_15px_rgba(212,175,55,0.3)] transition-transform hover:scale-105 w-full">
                حسناً
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[600] flex justify-center items-center p-4 bg-black/90 backdrop-blur-md pointer-events-auto"
            onClick={() => setConfirmAction(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-[#1a1a2e] border border-[var(--color-gold)] p-6 md:p-8 rounded-3xl w-full max-w-[320px] text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-4xl mb-3 drop-shadow-md">⚠️</div>
              <h2 className="text-lg sm:text-xl font-black text-white mb-2">
                {confirmAction === 'leave' ? 'هل أنت متأكد من الخروج؟' : 'هل أنت متأكد من إعادة المباراة؟'}
              </h2>
              <p className="text-xs sm:text-sm text-[#aaa] mb-6">
                {confirmAction === 'leave'
                  ? 'سيتم الخروج من الغرفة والعودة للقائمة الرئيسية.'
                  : 'سيتم تقديم طلب إعادة المباراة لجميع اللاعبين.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 bg-[#333] hover:bg-[#444] text-white font-bold rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => {
                    if (confirmAction === 'leave') returnToMenu();
                    else if (confirmAction === 'reset') resetGame();
                    setConfirmAction(null);
                  }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(220,38,38,0.4)]"
                >
                  تأكيد
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwapOverlay() {
  const gs = useGameState();
  if (gs.phase !== "swapping" || gs.playerWithHighestScore !== myPlayerIndex || myPlayerIndex === -1) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-2 bg-black/40 pointer-events-auto backdrop-blur-[1px]">
      <div className="bg-[#1a1a2e]/95 backdrop-blur-xl p-3 sm:p-5 rounded-2xl border-2 border-[var(--color-gold)] w-full max-w-[320px] text-center shadow-[0_15px_40px_rgba(0,0,0,0.8)]">
        <div className="text-[var(--color-gold)] mb-3 text-sm sm:text-base font-black">🔄 مبادلة الورقة المكشوفة</div>
        <div className="text-xs text-[#aaa] mb-4">لقد حققت أعلى نتيجة! يمكنك مبادلة ورقتك المكشوفة بأي ورقة أخرى.</div>

        <div className="flex justify-center gap-2 mb-4">
          <div className="flex flex-col items-center">
            <span className="text-[0.6rem] text-[var(--color-gold)] mb-1">ورقتك</span>
            {gs.exposedCards[myPlayerIndex] && <MiniCard card={gs.exposedCards[myPlayerIndex]} isKuba={gs.exposedCards[myPlayerIndex]?.suit === '♥'} />}
          </div>
        </div>

        <div className="text-xs text-white mb-2">اختر ورقة للتبديل معها:</div>
        <div className="flex justify-center gap-4 mb-5">
          {[1, 2, 3].map(offset => {
            const p = (myPlayerIndex + offset) % 4;
            return gs.exposedCards[p] ? (
              <div key={p} className="flex flex-col items-center cursor-pointer transform transition-transform hover:scale-110 active:scale-95" onClick={() => humanSwap(p)}>
                <span className="text-[0.55rem] text-[#aaa] mb-1">{gs.playerNames[p]}</span>
                <MiniCard card={gs.exposedCards[p]!} isKuba={gs.exposedCards[p]?.suit === '♥'} />
                <div className="mt-1 px-2 py-0.5 bg-[var(--color-gold)]/20 rounded text-[0.5rem] text-[var(--color-gold)]">تبديل</div>
              </div>
            ) : null;
          })}
        </div>

        <button
          className="px-6 py-1.5 rounded-full font-bold text-xs bg-[#444] text-white hover:bg-[#555] border border-[#666] active:scale-95 transition-all w-full max-w-[150px]"
          onClick={() => humanSkipSwap()}
        >
          عدم التبديل
        </button>
      </div>
    </div>
  );
}
