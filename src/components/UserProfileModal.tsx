import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile, fetchUserProfile, COUNTRIES, getLocalProfile } from "../logic/userProfile";
import { unfriend } from "../logic/social";
import { Clock, Mars, Venus, User, Calendar, Crown, Sword } from "lucide-react";
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
            className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
          >
            <div className="h-24 bg-gradient-to-b from-[var(--color-gold)]/20 to-transparent" />
            
            <div className="px-8 pb-8 -mt-12 text-center">
              <div className="inline-block relative">
                <div className={`w-24 h-24 bg-[#1a1a1a] border-4 ${displayUser.searchId === '01' ? 'border-[var(--color-gold)] shadow-[0_0_20px_rgba(234,179,8,0.4)]' : 'border-[#111]'} rounded-[28px] text-5xl flex items-center justify-center shadow-xl relative overflow-hidden group`}>
                   {displayUser.searchId === '01' && (
                     <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-gold)]/20 to-transparent animate-pulse" />
                   )}
                   <span className="relative z-10">{displayUser.avatar}</span>
                </div>
                {displayUser.status === 'online' && (
                  <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-[#111] rounded-full shadow-[0_0_10px_#22c55e]" />
                )}
              </div>
              
              <div className="flex items-center justify-center gap-2 mt-4">
                <h2 className="text-2xl font-black text-white">{displayUser.name}</h2>
                {displayUser.searchId === '01' && (
                  <Crown className="w-5 h-5 text-[var(--color-gold)] fill-[var(--color-gold)]/20 animate-bounce" />
                )}
              </div>
              <div className="text-xs font-mono text-[var(--color-gold)] mb-1 tracking-widest uppercase opacity-60">#{displayUser.searchId || "00000000"}</div>
              
              <div className="flex items-center justify-center gap-2 mb-4 px-3 py-1.5 bg-white/5 rounded-full w-fit mx-auto border border-white/5">
                <Clock className="w-3.5 h-3.5 text-[var(--color-gold)]" />
                <span className="text-[10px] font-black text-white/50 uppercase tracking-wider">
                  {displayUser.status === 'online' ? 'نشط الآن' : `آخر ظهور: ${formatLastSeen(displayUser.lastSeen)}`}
                </span>
              </div>
              
              <div className="flex items-center justify-center gap-3 mb-6">
                {country && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-lg border border-white/5 text-white/40 text-[10px] font-bold uppercase tracking-tight">
                    <span className="text-sm">{country.flag}</span>
                    <span>{country.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-lg border border-white/5 text-white/40 text-[10px] font-bold uppercase tracking-tight">
                  {displayUser.gender === 'female' ? <Venus className="w-3 h-3 text-pink-400" /> : <Mars className="w-3 h-3 text-blue-400" />}
                  <span>{displayUser.gender === 'female' ? 'أنثى' : 'ذكر'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <div className="text-[10px] text-white/30 font-bold uppercase mb-1">المرحلة</div>
                  <div className="text-white font-black">{displayUser.points ? Math.floor(displayUser.points / 100) + 1 : 1}</div>
                </div>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                  <div className="text-[10px] text-white/30 font-bold uppercase mb-1">النقاط</div>
                  <div className="text-white font-black">{displayUser.points || 0}</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 mb-8 px-4 py-2 bg-white/5 rounded-xl border border-white/5 text-white/40">
                <Calendar className="w-3.5 h-3.5 text-[var(--color-gold)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  عضو منذ: {formatJoinDate(displayUser.createdAt)}
                </span>
              </div>

              {!showConfirm ? (
                <div className="space-y-3">
                  {isFriend && displayUser.status === 'online' && (
                    <button 
                      onClick={handleChallenge}
                      disabled={inviting}
                      className="w-full py-4 bg-[var(--color-gold)] text-black text-sm font-black rounded-2xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_5px_15px_rgba(212,175,55,0.3)]"
                    >
                      <Sword className="w-4 h-4" />
                      {inviting ? "جاري الإرسال..." : "تحدي ⚔️"}
                    </button>
                  )}
                  {isFriend && (
                    <button 
                      onClick={() => setShowConfirm(true)}
                      className="w-full py-4 border border-red-500/20 text-red-500 text-sm font-black rounded-2xl hover:bg-red-500/10 transition-colors"
                    >
                      إلغاء الصداقة
                    </button>
                  )}
                  <button 
                    onClick={onClose}
                    className="w-full py-4 bg-white/5 text-white/60 text-sm font-black rounded-2xl hover:bg-white/10 transition-colors"
                  >
                    إغلاق
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-white/60 text-sm mb-4">هل أنت متأكد من إزالة الصداقة؟</div>
                  <button 
                    onClick={handleUnfriend}
                    disabled={unfriending}
                    className="w-full py-4 bg-red-600 text-white text-sm font-black rounded-2xl hover:bg-red-500 transition-colors disabled:opacity-50"
                  >
                    {unfriending ? "جاري الإزالة..." : "نعم، متأكد"}
                  </button>
                  <button 
                    onClick={() => setShowConfirm(false)}
                    className="w-full py-4 bg-white/5 text-white/60 text-sm font-black rounded-2xl hover:bg-white/10 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </div>
            {loading && (
              <div className="absolute top-2 right-2">
                <div className="w-4 h-4 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
