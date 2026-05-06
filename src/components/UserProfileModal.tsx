import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile, fetchUserProfile, COUNTRIES, getLocalProfile } from "../logic/userProfile";
import { unfriend } from "../logic/social";
import { Clock, Mars, Venus, User, Calendar, Crown, Sword, Sparkles } from "lucide-react";
import { multiplayerState, sendRoomInvite, createRoom } from "../logic/multiplayer";
import { G, updateUI } from "../logic/engine";

export function formatLastSeen(lastSeen: any): string {
  if (!lastSeen) return "غير متوفر";
  
  let date: Date;
  if (lastSeen.toDate) {
    date = lastSeen.toDate();
  } else if (lastSeen instanceof Date) {
    date = lastSeen;
  } else if (typeof lastSeen === 'number') {
    date = new Date(lastSeen);
  } else if (lastSeen?.seconds) {
    date = new Date(lastSeen.seconds * 1000);
  } else {
    date = new Date(lastSeen);
  }

  if (isNaN(date.getTime())) return "غير متوفر";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 30) return "متصل الآن";
  if (diffInSeconds < 60) return "منذ ثوانٍ";
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes === 1) return "منذ دقيقة";
  if (diffInMinutes === 2) return "منذ دقيقتين";
  if (diffInMinutes < 11) return `منذ ${diffInMinutes} دقائق`;
  if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours === 1) return "منذ ساعة";
  if (diffInHours === 2) return "منذ ساعتين";
  if (diffInHours < 11) return `منذ ${diffInHours} ساعات`;
  if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "منذ يوم";
  if (diffInDays === 2) return "منذ يومين";
  if (diffInDays < 11) return `منذ ${diffInDays} أيام`;
  return `منذ ${diffInDays} يوم`;
}

export function formatJoinDate(createdAt: any): string {
  if (!createdAt) return "غير متوفر";
  let date: Date;
  if (createdAt.toDate) date = createdAt.toDate();
  else if (createdAt instanceof Date) date = createdAt;
  else if (typeof createdAt === 'number') date = new Date(createdAt);
  else if (createdAt?.seconds) date = new Date(createdAt.seconds * 1000);
  else date = new Date(createdAt);

  if (isNaN(date.getTime())) return "غير متوفر";

  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  isFriend: boolean;
  onActionComplete?: () => void;
}

export const UserProfileModal: React.FC<Props> = ({ isOpen, onClose, user, isFriend, onActionComplete }) => {
  const [fullProfile, setFullProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [unfriending, setUnfriending] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setFullProfile(user);
      setLoading(true);
      fetchUserProfile(user.uid).then(p => {
        if (p) setFullProfile(p);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setShowConfirm(false);
    }
  }, [isOpen, user]);

  if (!user) return null;

  const displayUser = fullProfile || user;
  const country = COUNTRIES.find(c => c.code === displayUser.country);

  const handleChallenge = async () => {
    setInviting(true);
    try {
      let roomCode = multiplayerState.roomCode;
      if (!multiplayerState.isMultiplayer || !roomCode) {
        const confirmed = window.confirm("أنت لست في غرفة حالياً. هل تريد إنشاء غرفة خاصة جديدة ودعوة هذا الصديق؟");
        if (!confirmed) {
          setInviting(false);
          return;
        }

        // Create a private room automatically
        const profile = getLocalProfile();
        const createdCode = await createRoom(profile?.name || "لاعب", false, "", 31);
        if (createdCode) {
          roomCode = createdCode;
        } else {
          throw new Error("فشل إنشاء الغرفة");
        }
      }

      if (roomCode) {
        const sent = await sendRoomInvite(user.uid, roomCode);
        if (sent) {
          alert(`تم إرسال طلب التحدي إلى ${displayUser.name}`);
          // Switch to multiplayer screen to wait
          G.phase = 'multiplayer';
          updateUI();
          onClose();
        }
      }
    } catch (err: any) {
      alert("تعذر إرسال التحدي: " + err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleUnfriend = async () => {
    setUnfriending(true);
    try {
      const success = await unfriend(user.uid);
      if (success) {
        onActionComplete?.();
        onClose();
      } else {
        alert("فشل في إلغاء الصداقة. يرجى التحقق من الاتصال.");
      }
    } catch (error) {
      alert("حدث خطأ أثناء إلغاء الصداقة.");
    } finally {
      setUnfriending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-[#1a1a2e] border border-white/10 rounded-[40px] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
          >
            {/* Deluxe Header Background */}
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[var(--color-gold)]/20 via-[var(--color-gold)]/5 to-transparent" />
            <div className="absolute top-4 left-4">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                <div className="w-2 h-2 bg-[var(--color-gold)] rounded-full animate-pulse shadow-[0_0_8px_var(--color-gold)]" />
                <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">Player Profile</span>
              </div>
            </div>

            <div className="px-8 pb-10 pt-16 flex flex-col items-center">
              {/* Profile Avatar with Hero Ring */}
              <div className="relative group">
                <motion.div 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className={`w-32 h-32 bg-black/60 border-4 ${displayUser.searchId === '01' ? 'border-[var(--color-gold)]' : 'border-white/10'} rounded-[36px] flex items-center justify-center shadow-2xl relative overflow-hidden transition-all group-hover:scale-105`}
                >
                   {displayUser.searchId === '01' && (
                     <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-gold)]/20 to-transparent animate-pulse" />
                   )}
                   {displayUser.avatar?.startsWith('http') ? (
                     <img src={displayUser.avatar} alt="Avatar" className="w-full h-full object-contain relative z-10 p-3" referrerPolicy="no-referrer" />
                   ) : (
                     <span className="text-6xl relative z-10">{displayUser.avatar}</span>
                   )}
                </motion.div>
                
                {displayUser.status === 'online' && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute bottom-2 right-2 w-7 h-7 bg-green-500 border-4 border-[#1a1a2e] rounded-full shadow-[0_0_15px_#22c55e] z-20" 
                  />
                )}

                {displayUser.searchId === '01' && (
                  <div className="absolute -top-3 -right-3 bg-[var(--color-gold)] p-2 rounded-2xl border-4 border-[#1a1a2e] shadow-lg rotate-12">
                    <Crown className="w-5 h-5 text-black" fill="black" />
                  </div>
                )}
              </div>
              
              {/* Identity Info */}
              <div className="mt-6 text-center space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-3xl font-black text-white tracking-tight">{displayUser.name}</h2>
                </div>
                <div className="flex items-center justify-center gap-2">
                   <div className="px-3 py-0.5 bg-white/5 rounded-full border border-white/5 flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[var(--color-gold)] tracking-[0.2em]">#{displayUser.searchId || "0000"}</span>
                   </div>
                   {country && (
                    <div className="flex items-center gap-1.5 text-white/40 font-bold text-xs">
                      <span>{country.flag}</span>
                      <span>{country.name}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Stats Dashboard */}
              <div className="grid grid-cols-2 gap-4 w-full mt-8">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-gold)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                  <div className="bg-white/5 border border-white/5 p-4 rounded-3xl text-center space-y-1 transition-all group-hover:translate-y-[-4px]">
                    <div className="text-[9px] text-white/30 font-black uppercase tracking-widest">Player Rank</div>
                    <div className="text-2xl font-black text-white flex items-center justify-center gap-2">
                       <span className="text-[var(--color-gold)] text-sm">LVL</span> 
                       {displayUser.points ? Math.floor(displayUser.points / 100) + 1 : 1}
                    </div>
                  </div>
                </div>

                <div className="relative group">
                   <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                   <div className="bg-white/5 border border-white/5 p-4 rounded-3xl text-center space-y-1 transition-all group-hover:translate-y-[-4px]">
                    <div className="text-[9px] text-white/30 font-black uppercase tracking-widest">Total Points</div>
                    <div className="text-2xl font-black text-white flex items-center justify-center gap-1">
                       <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                       {displayUser.points || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status & Activity */}
              <div className="w-full mt-6 space-y-2">
                <div className="flex items-center justify-between px-4 py-3 bg-black/20 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[var(--color-gold)]" />
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Activity Status</span>
                   </div>
                   <span className="text-[10px] font-black text-white/60">
                      {displayUser.status === 'online' ? 'Active Now' : formatLastSeen(displayUser.lastSeen)}
                   </span>
                </div>

                <div className="flex items-center justify-between px-4 py-3 bg-black/20 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Joined Origin</span>
                   </div>
                   <span className="text-[10px] font-black text-white/60">
                      {formatJoinDate(displayUser.createdAt)}
                   </span>
                </div>
              </div>

              {/* Actions */}
              <div className="w-full mt-8 space-y-3">
                {!showConfirm ? (
                  <>
                    {isFriend && displayUser.status === 'online' && (
                      <button 
                        onClick={handleChallenge}
                        disabled={inviting}
                        className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-400 text-white text-md font-black rounded-2xl shadow-[0_15px_30px_rgba(37,99,235,0.2)] active:scale-95 transition-all flex items-center justify-center gap-3 group relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12" />
                        <Sword className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        {inviting ? "Sending Challenge..." : "Challenge Battle ⚔️"}
                      </button>
                    )}
                    <div className="flex gap-3">
                      {isFriend && (
                        <button 
                          onClick={() => setShowConfirm(true)}
                          className="flex-1 py-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-black rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-inner"
                        >
                          Unfriend
                        </button>
                      )}
                      <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-white/5 border border-white/10 text-white/60 text-xs font-black rounded-2xl hover:bg-white/10 transition-all"
                      >
                        Close Portal
                      </button>
                    </div>
                  </>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 bg-red-500/5 rounded-[32px] border border-red-500/20 text-center space-y-4 shadow-inner"
                  >
                    <div className="text-white/80 font-black text-sm">Are you sure about removing this friend?</div>
                    <div className="flex gap-3">
                       <button 
                        onClick={handleUnfriend}
                        disabled={unfriending}
                        className="flex-1 py-4 bg-red-600 text-white text-xs font-black rounded-2xl hover:bg-red-500 transition-all shadow-lg"
                      >
                        {unfriending ? "Removing..." : "Yes, Remove"}
                      </button>
                      <button 
                        onClick={() => setShowConfirm(false)}
                        className="flex-1 py-4 bg-white/5 text-white/60 text-xs font-black rounded-2xl hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
            {loading && (
              <div className="absolute top-4 right-4">
                <div className="w-5 h-5 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </motion.div>        </div>
      )}
    </AnimatePresence>
  );
};

