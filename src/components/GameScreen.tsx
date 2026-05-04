import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { useGameState } from "./common";
import { getAvailableBids, selectBid, confirmBid, handleSelectCard, executePlay, closeRoundEnd, returnToMenu, removeParticle, Card, resetGame, myPlayerIndex } from "../logic/engine";
import { multiplayerState } from "../logic/multiplayer";
import { UserProfileModal } from "./UserProfileModal";
import { UserProfile } from "../logic/userProfile";

function getCardImageUrl(card: Card) {
  const suitMap: Record<string, string> = { "♠": "S", "♥": "H", "♦": "D", "♣": "C" };
  const rankMap: Record<string, string> = {
    "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9", "10": "0",
    "J": "J", "Q": "Q", "K": "K", "A": "A"
  };
  return `https://deckofcardsapi.com/static/img/${rankMap[card.rank]}${suitMap[card.suit]}.png`;
}

function MiniCard({ card, isKuba }: { card: Card, isKuba: boolean }) {
  return (
    <div className={`w-[36px] h-[52px] sm:w-[48px] sm:h-[68px] relative min-w-0 flex-shrink-0 ${isKuba ? 'drop-shadow-[0_0_8px_rgba(231,76,60,0.6)]' : 'drop-shadow-sm'}`}>
      <img src={getCardImageUrl(card)} className="w-full h-full object-contain" draggable={false} alt={`${card.rank}${card.suit}`} />
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
            <img src="https://deckofcardsapi.com/static/img/back.png" className="w-full h-full object-contain drop-shadow" />
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
  
  const showTimer = isActive && !gs.playerNames[index].includes("كمبيوتر") && (gs.phase === 'playing' || gs.phase === 'bidding');
  const timeLeft = useTurnTimer(gs.turnStartTime, gs.turnTimeout);

  return (
    <div 
      onClick={() => onProfileClick(index)}
      className={`absolute ${positionClass} flex flex-col bg-[#141423]/95 backdrop-blur-md rounded-xl border-2 ${isActive ? 'border-[var(--color-gold)] shadow-[0_0_15px_rgba(212,175,55,0.4)] z-30 scale-105 ring-1 ring-[var(--color-gold)]/50' : 'border-[#333] shadow-xl z-20'} overflow-hidden transition-all min-w-[70px] sm:min-w-[85px] max-w-[90px] cursor-pointer hover:border-[var(--color-gold)]/50 active:scale-95`}
    >
      
      {/* Header (Name) */}
      <div className={`w-full text-center py-1 px-1.5 relative ${isActive ? 'bg-[var(--color-gold)] text-black' : 'bg-[#222] text-white'}`}>
        <span className="text-[0.6rem] sm:text-[0.7rem] font-black block truncate px-1">
          {name}
        </span>
        {isDealer && <span className={`absolute left-1.5 top-1 ${isActive ? 'text-black' : 'text-[var(--color-gold)]'} text-[0.55rem] sm:text-[0.6rem] leading-none animate-pulse`}>●</span>}
        
        {/* Turn Timer Progress Bar */}
        {showTimer && (
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-black/20 overflow-hidden">
             <motion.div 
               initial={{ width: "100%" }}
               animate={{ width: "0%" }}
               transition={{ duration: gs.turnTimeout, ease: "linear" }}
               key={gs.turnStartTime} // Restart animation when turn changes
               className={`h-full ${isActive ? 'bg-black' : 'bg-[var(--color-gold)]'}`}
             />
          </div>
        )}
      </div>
      
      {/* Body (Score & Bid) */}
      <div className="flex flex-col items-center px-1.5 py-1.5 relative">
        {exposedCard && !isYou && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 z-0 pointer-events-none transform scale-90">
             <MiniCard card={exposedCard} isKuba={exposedCard.suit === '♥'} />
          </div>
        )}
        <div className={`z-10 text-xl sm:text-2xl font-black leading-none drop-shadow-md my-0.5 ${score < 0 ? 'text-[var(--color-kuba)]' : 'text-[var(--color-gold)]'}`}>
          {score}
        </div>
        
        {showTimer && (
          <div className={`absolute top-0 right-1 font-mono font-black text-xs sm:text-sm drop-shadow-md z-20 ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-[var(--color-gold)]'}`}>
            {timeLeft}
          </div>
        )}
        
        <div className="z-10 flex w-full mt-1.5 bg-black/80 rounded-[4px] border border-[#555] overflow-hidden text-[0.55rem] sm:text-[0.65rem] font-black">
          <div className="flex-1 py-0.5 text-center text-[#bbb] border-l border-[#555]">
            {bid > 0 ? bid : '-'}
          </div>
          <div className={`flex-1 py-0.5 text-center ${bid > 0 && gs.phase === 'playing' ? (taken >= bid ? 'bg-[#2ecc71]/20 text-[#2ecc71]' : 'text-white') : 'text-[#666]'}`}>
            {bid > 0 ? taken : '-'}
          </div>
        </div>
      </div>

      {/* Cards Count (Only for others) */}
      {!isYou && (
        <div className="w-full text-center bg-[#000]/60 py-0.5 text-[0.5rem] sm:text-[0.6rem] text-[#aaa] flex items-center justify-center gap-1 border-t border-[#333]">
          <span className="font-bold">{cardCount}</span>
          <span className="text-[var(--color-gold)] font-bold">🂠</span>
        </div>
      )}
    </div>
  );
}

function Spot({ index, position }: { index: number, position: string }) {
  const gs = useGameState();
  const isYou = index === myPlayerIndex && myPlayerIndex !== -1;
  
  const playedCard = gs.trickCards[index];
  const isWinner = gs.winnerSlot === index;
  const hasTrap = gs.trapHolder === index && (isYou || gs.phase === "roundEnd");

  return (
    <div className={`absolute flex flex-col items-center gap-[2px] z-10 ${position}`}>
      <div className={`w-[40px] h-[56px] sm:w-[52px] sm:h-[72px] border-2 rounded-[5px] flex items-center justify-center text-[0.55rem] transition-colors relative shrink-0
        ${playedCard ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10' : 'border-dashed border-white/10 bg-black/20 text-[#888]'}
        ${playedCard && playedCard.suit === '♥' && gs.trickCards.some(c=>c?.suit!=='♥') ? 'border-[var(--color-kuba)] bg-[var(--color-kuba)]/15 shadow-[0_0_15px_rgba(231,76,60,0.4)]' : ''}
        ${isWinner ? 'winner-spot' : ''}
      `}>
        <AnimatePresence mode="popLayout">
          {playedCard ? (
            <motion.div
              key={playedCard.uid || `${playedCard.suit}${playedCard.rank}`}
              initial={{ scale: 0, opacity: 0, y: 30, rotate: isYou ? 0 : Math.random() * 20 - 10 }}
              animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
            >
              <MiniCard card={playedCard} isKuba={playedCard.suit === '♥'} />
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
  const baseIdx = myPlayerIndex !== -1 ? myPlayerIndex : 0;
  const pIdx = (offset: number) => (baseIdx + offset) % 4;

  const bottomIdx = pIdx(0);
  const rightIdx = pIdx(1);
  const topIdx = pIdx(2);
  const leftIdx = pIdx(3);

  return (
    <div className="flex-1 relative flex items-center justify-center min-h-0 py-1 w-full my-2">
      <PlayerBadge index={topIdx} positionClass="top-1 sm:top-2 left-1 sm:left-2 z-20" onProfileClick={onProfileClick} />
      <PlayerBadge index={rightIdx} positionClass="top-1 sm:top-2 right-1 sm:right-2 z-20" onProfileClick={onProfileClick} />
      <PlayerBadge index={leftIdx} positionClass="bottom-1 sm:bottom-2 left-1 sm:left-2 z-20" onProfileClick={onProfileClick} />
      <PlayerBadge index={bottomIdx} positionClass="bottom-1 sm:bottom-2 right-1 sm:right-2 z-20" onProfileClick={onProfileClick} />
      
      <div className="relative w-[190px] xs:w-[230px] sm:w-[320px] aspect-square flex items-center justify-center">
        <div className="absolute inset-[8%] sm:inset-[10%] table-felt rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] flex items-center justify-center">
           <div className="text-center opacity-10 pointer-events-none select-none">
              <div className="text-[var(--color-gold)] text-[10px] font-black uppercase tracking-widest leading-none mb-1">الهدف</div>
              <div className="text-[var(--color-gold)] text-4xl sm:text-5xl font-black leading-none">{gs.target}</div>
           </div>
        </div>
        <Spot index={topIdx} position="-top-[20px] sm:-top-[30px] left-1/2 -translate-x-1/2" />
        <Spot index={rightIdx} position="-right-[20px] sm:-right-[30px] top-1/2 -translate-y-1/2" />
        <Spot index={bottomIdx} position="-bottom-[20px] sm:-bottom-[30px] left-1/2 -translate-x-1/2" />
        <Spot index={leftIdx} position="-left-[20px] sm:-left-[30px] top-1/2 -translate-y-1/2" />
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
              const hasLeadSuit = leadSuit ? hand.some(c => c.suit === leadSuit) : false;
              if (leadSuit && hasLeadSuit && card.suit !== leadSuit) notPlayable = true;
              if (isLeading && card.suit === '♥' && hand.some(c => c.suit !== '♥')) notPlayable = true; // Can't lead Kuba normally unless all Kuba
            } else if (gs.phase === 'playing' && gs.currentPlayer !== myPlayerIndex) {
              notPlayable = true;
            }
            
            return (
              <motion.div 
                key={card.uid || `${card.suit}${card.rank}-${i}`} 
                layout
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  y: isSelected ? -15 : 0,
                  scale: isSelected ? 1.05 : 1,
                  zIndex: isSelected ? 30 : i
                }}
                exit={{ opacity: 0, y: -40, scale: 0.6, filter: "blur(2px)", pointerEvents: "none" }}
                whileHover={!notPlayable && !isSelected ? { y: -8, zIndex: 29 } : {}}
                transition={{ 
                  type: "spring", 
                  stiffness: 500, 
                  damping: 35,
                  mass: 0.8
                }}
                className={`w-[54px] h-[78px] xs:w-[58px] xs:h-[84px] sm:w-[72px] sm:h-[104px] relative cursor-pointer flex-shrink-0 select-none
                  ${i > 0 ? '-ml-[34px] xs:-ml-[36px] sm:-ml-[46px]' : ''}
                  ${isSelected ? 'drop-shadow-[0_0_20px_rgba(212,175,55,0.8)]' : 'drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]'}
                  ${notPlayable ? 'grayscale-[0.6] brightness-[0.6] cursor-not-allowed pointer-events-none' : ''}
                  ${card.suit === '♥' && !isSelected ? 'drop-shadow-[0_0_12px_rgba(231,76,60,0.5)]' : ''}
                  ${card.suit === '♥' && card.rank === 'Q' ? 'trap-card' : ''}
                `}
                onClick={() => handleSelectCard(i)}
              >
                <img src={getCardImageUrl(card)} className="w-full h-full object-contain rounded-[4px]" draggable={false} alt={`${card.rank}${card.suit}`} />
                {isSelected && <div className="absolute inset-[1px] rounded-[4px] border-[2px] border-[var(--color-gold)] pointer-events-none shadow-[inset_0_0_15px_rgba(212,175,55,0.5)]"></div>}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none rounded-[4px]"></div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="text-center mt-1 flex gap-2 justify-center items-center h-[30px]">
        <button 
          className="px-4 py-1.5 rounded-full font-black text-[0.65rem] disabled:bg-[#555] disabled:text-[#888] disabled:scale-100 transition-transform active:scale-95 bg-gradient-to-b from-[#f9e698] to-[#aa8d2e] text-black"
          disabled={gs.selectedCardIdx < 0 || gs.currentPlayer !== myPlayerIndex || gs.phase !== 'playing'}
          onClick={executePlay}
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
          onClick={confirmBid}
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
  if (!gs.roundEndOverlayVisible) return null;
  
  const results = gs.results || [];
  
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface)] p-4 rounded-2xl border-2 border-[var(--color-gold)] w-full max-w-[380px] text-center">
        <div className="text-[var(--color-gold)] mb-2 text-sm">📊 نتائج الجولة</div>
        {gs.trapActive && (
          <div className="text-[#f39c12] text-[0.6rem] mb-1.5">
            💀 ورطة: {gs.playerNames[gs.trapCaughtBy]} أخذ Q♥ بـ A♥ (+5/-5)
          </div>
        )}
        <table className="w-full border-collapse my-2 text-[0.65rem]" dir="rtl">
          <thead>
            <tr>
              <th className="text-[var(--color-gold)] p-1 border-b border-[var(--color-gold)]/30 text-[0.55rem]">اللاعب</th>
              <th className="text-[var(--color-gold)] p-1 border-b border-[var(--color-gold)]/30 text-[0.55rem]">طلب</th>
              <th className="text-[var(--color-gold)] p-1 border-b border-[var(--color-gold)]/30 text-[0.55rem]">جمع</th>
              <th className="text-[var(--color-gold)] p-1 border-b border-[var(--color-gold)]/30 text-[0.55rem]">مضاعف</th>
              <th className="text-[var(--color-gold)] p-1 border-b border-[var(--color-gold)]/30 text-[0.55rem]">النقاط</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td className="p-1 border-b border-white/5">{gs.playerNames[r.player]} {r.player === gs.bestInRound?.player ? '⭐' : ''}</td>
                <td className="p-1 border-b border-white/5">{r.bid}</td>
                <td className="p-1 border-b border-white/5">{r.taken} {r.bid === "-" ? '' : (r.taken >= r.bid ? '✅' : '❌')}</td>
                <td className="p-1 border-b border-white/5">{r.multiplier || '-'}</td>
                <td className={`p-1 border-b border-white/5 font-bold ${r.change > 0 ? 'text-[#2ecc71]' : 'text-[var(--color-kuba)]'}`}>
                  {r.change > 0 ? '+' : ''}{r.change}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {gs.bestInRound && (
          <div className="mt-1.5 text-[#2ecc71] text-[0.6rem]">
            ⭐ أفضل لاعب: {gs.playerNames[gs.bestInRound.player]} ({gs.bestInRound.change > 0 ? '+' : ''}{gs.bestInRound.change})
          </div>
        )}
        <div className="mt-1.5 text-[#aaa] text-[0.55rem] min-h-[14px]">
          {gs.gameWinner !== null 
            ? (gs.gameWinner === myPlayerIndex && myPlayerIndex !== -1 ? '🏆 مبروك! أنت بطل الطرنت! 🏆' : `🏆 ${gs.playerNames[gs.gameWinner]} فاز باللعبة!`)
            : (results[0]?.change > 0 ? '🎉 نقاط إيجابية!' : '💔 خسارة نقاط')
          }
        </div>
        <button 
          className="mt-3 px-6 py-2 bg-gradient-to-b from-[#f9e698] to-[#aa8d2e] text-black rounded-full font-black text-sm active:scale-95"
          onClick={closeRoundEnd}
        >
          {gs.gameWinner !== null ? 'بداية جديدة' : '✅ متابعة'}
        </button>
      </div>
    </div>
  );
}

function ParticlesRenderer() {
  const gs = useGameState();
  return (
    <>
      {gs.particles.map(p => {
        const emojis = p.type === 'tarneb' ? ['🔪','⚔️','💥','🔥','💣'] : ['💀','☠️','💥','🔥','⚠️','👻'];
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

export function GameScreen() {
  const gs = useGameState();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<"leave" | "reset" | null>(null);
  const [profileModalUser, setProfileModalUser] = React.useState<UserProfile | null>(null);

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
      <div className="flex justify-between items-center py-1.5 px-3 mx-1 bg-black/40 backdrop-blur-sm rounded-xl border border-[var(--color-gold)]/20 shadow-md shrink-0 mt-1">
        <div className="flex gap-2 items-center flex-wrap shrink-0">
          <span className="text-[var(--color-gold)] font-black text-[0.75rem] bg-[var(--color-gold)]/10 px-2 py-0.5 rounded opacity-90">{gs.roundPhase}</span>
          <span className="text-[var(--color-kuba)] text-[0.75rem] font-black bg-[var(--color-kuba)]/15 px-2 py-0.5 rounded-[10px] border border-[var(--color-kuba)]/30 drop-shadow-sm">
            ♥ الحاكم: الكبة
          </span>
          <span className="text-[#888] font-bold text-[0.65rem] hidden xs:inline">الجولة {gs.roundNumber} | الموزع: <span className="text-white">{gs.playerNames[gs.dealerIdx]}</span></span>
        </div>
        <button 
          className="text-white hover:text-[var(--color-gold)] p-1 hover:bg-[var(--color-gold)]/10 rounded-full transition-colors flex-shrink-0"
          onClick={() => setMenuOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
      </div>

      <TableArea onProfileClick={handleProfileClick} />

      <div className={`text-center py-1 font-black text-[0.7rem] sm:text-[0.8rem] min-h-[22px] leading-[1.3] shrink-0 drop-shadow-md z-10 relative ${gs.gameMsgClass === 'tarneb-msg' ? 'text-[var(--color-kuba)]' : 'text-[var(--color-gold)]'}`}>
        {gs.gameMsg}
      </div>

      <PlayerHand />

      <SwapOverlay />
      <BiddingOverlay />
      <RoundEndOverlay />
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
               <button onClick={() => { setMenuOpen(false); setAboutOpen(true); }} className="p-3.5 bg-[#222]/80 border border-white/10 text-white rounded-2xl font-bold flex justify-center items-center gap-3 transition-colors hover:bg-white/10">
                   <span className="text-xl">ℹ️</span> حول اللعبة
               </button>
               <button onClick={() => { setMenuOpen(false); setConfirmAction('reset'); }} className="p-3.5 bg-[#222]/80 border border-white/10 text-white rounded-2xl font-bold flex justify-center items-center gap-3 transition-colors hover:bg-white/10 mt-2">
                   <span className="text-xl">🔄</span> إعادة المباراة
               </button>
               <button onClick={() => { setMenuOpen(false); setConfirmAction('leave'); }} className="p-3.5 bg-red-900/30 border border-red-500/30 text-red-400 rounded-2xl font-bold flex justify-center items-center gap-3 transition-colors hover:bg-red-900/50 mt-4">
                   <span className="text-xl">🚪</span> خروج للقائمة الرئيسية
               </button>
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
                 <h2 className="text-2xl font-black text-[var(--color-gold)] mb-4 font-[var(--font-tajawal)] drop-shadow-md">طرنيب مجانية v3.0</h2>
                 <p className="text-sm md:text-base text-[#ccc] mb-6 leading-relaxed">
                     لعبة ورق ليبية شهيرة مبنية على طاولة الجواكر. تتميز بالنظام الجديد للورق المكشوف والكنق، إضافة لذكاء اصطناعي متطور يلعب وكأنه أصدقاؤك.
                 </p>
                 <div className="text-xs text-[#777] mb-8 bg-black/30 p-3 rounded-xl border border-white/5">
                   تطوير: موصى به لمحبي ألعاب الورق التكتيكية.<br/>جميع الحقوق محفوظة © 2026
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

import { humanSwap, humanSkipSwap } from "../logic/engine";

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
            {gs.exposedCards[myPlayerIndex] && <MiniCard card={gs.exposedCards[myPlayerIndex]} isKuba={gs.exposedCards[myPlayerIndex].suit === '♥'} />}
          </div>
        </div>

        <div className="text-xs text-white mb-2">اختر ورقة للتبديل معها:</div>
        <div className="flex justify-center gap-4 mb-5">
          {[1,2,3].map(offset => {
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
          onClick={humanSkipSwap}
        >
          عدم التبديل
        </button>
      </div>
    </div>
  );
}
