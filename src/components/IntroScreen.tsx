import React, { useState, useEffect } from "react";
import { initAudio, sfxNotify } from "../lib/audio";
import { G, updateUI } from "../logic/engine";
import { auth } from "../lib/firebase";
import { getLocalProfile, COUNTRIES, UserProfile } from "../logic/userProfile";
import { ProfileSetupScreen } from "./ProfileSetupScreen";
import { SocialModal } from "./SocialModal";
import { SettingsModal } from "./SettingsModal";
import { Settings, LogOut, Users, Play, Gamepad2, UserCircle, Crown } from "lucide-react";
import { 
  listenToFriendRequests, 
  listenToAcceptedRequests, 
  deleteFriendRequest,
  cleanupOldFriendRequests,
  FriendRequest
} from "../logic/social";
import { listenToRoomInvites, respondToRoomInvite, joinRoom, cleanupOldInvites, cleanupStaleRooms, multiplayerState } from "../logic/multiplayer";
import { setDoc, doc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";

export function IntroScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(getLocalProfile());
  const country = COUNTRIES.find(c => c.code === profile?.country);
  const [showSocial, setShowSocial] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [requestsCount, setRequestsCount] = useState(0);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [invites, setInvites] = useState<any[]>([]);
  const [toast, setToast] = useState<{message: string, icon: string} | null>(null);
  const hasNotification = requestsCount > 0 || acceptedCount > 0 || invites.length > 0;
  
  const [rejoinRoomId, setRejoinRoomId] = useState<string | null>(null);
  const [rejoining, setRejoining] = useState(false);

  useEffect(() => {
    // 1. Live Profile Listener
    const user = auth.currentUser;
    let unsubProfile = () => {};
    
    if (user) {
      unsubProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile({ ...data, uid: snap.id });
          localStorage.setItem('tarneb_user_profile', JSON.stringify({ ...data, uid: snap.id }));
        }
      });
    }

    // Run cleanup logic only once per session or mount
    const runCleanup = async () => {
      const lastCleanup = sessionStorage.getItem('tarneb_last_cleanup');
      const now = Date.now();
      if (!lastCleanup || now - parseInt(lastCleanup) > 3600000) {
        if (auth.currentUser) {
          cleanupOldInvites();
          cleanupStaleRooms();
          cleanupOldFriendRequests();
          sessionStorage.setItem('tarneb_last_cleanup', now.toString());
        }
      }
    };
    runCleanup();

    // Listen for room invites
    let prevInviteCount = 0;
    const unsubInvites = listenToRoomInvites((newInvites) => {
      if (newInvites.length > prevInviteCount) {
        sfxNotify();
      }
      prevInviteCount = newInvites.length;
      setInvites(newInvites);
    });

    const activeRoomId = localStorage.getItem('tarneb_active_room');
    if (activeRoomId && auth.currentUser) {
      // Show rejoin if not in multiplayer state OR if we are currently looking at intro phase while being in a multiplayer session
      if (!multiplayerState.isMultiplayer || G.phase === 'intro') {
        setRejoinRoomId(activeRoomId);
      } else {
        setRejoinRoomId(null);
      }
    } else {
      setRejoinRoomId(null);
    }

    // Listen for incoming friend requests
    const unsubRequests = listenToFriendRequests((reqs) => {
      setRequestsCount(reqs.length);
    });

    // Handle friend request acceptance sync
    const unsubAccepted = listenToAcceptedRequests(async (accepted) => {
      setAcceptedCount(accepted.length);
      if (!user) return;

      for (const req of accepted) {
        const processedKey = `friend_processed_${req.id}`;
        if (req.toUid && !sessionStorage.getItem(processedKey)) {
          sessionStorage.setItem(processedKey, 'true');
          try {
            const myFriendRef = doc(db, "users", user.uid, "friends", req.toUid);
            await setDoc(myFriendRef, {
              uid: req.toUid,
              name: req.toName || "لاعب",
              avatar: req.toAvatar || "👤",
              searchId: req.toSearchId || "",
              status: "online",
              updatedAt: serverTimestamp()
            });
            sfxNotify();
            setToast({
              message: `أصبح ${req.toName} صديقك الآن!`,
              icon: req.toAvatar || "🤝"
            });
            setTimeout(() => setToast(null), 5000);
            await deleteFriendRequest(req.id);
          } catch (err) {
            console.error("Intro sync error:", err);
            sessionStorage.removeItem(processedKey);
          }
        }
      }
    });

    return () => {
      unsubProfile();
      unsubRequests();
      unsubAccepted();
      unsubInvites();
    };
  }, []);

  const handleLogout = async () => {
    try {
      // Small manual update for status before signout to ensure it hits firestore
      const user = auth.currentUser;
      if (user) {
        const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
        const { db } = await import("../lib/firebase");
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          status: "offline",
          lastSeen: serverTimestamp()
        }).catch(() => {}); // ignore errors
      }
      await auth.signOut();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#050508] relative overflow-hidden font-[var(--font-tajawal)]" dir="rtl">
      {/* 🎭 Deep Cinematic Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[40%] bg-[var(--color-gold)] blur-[140px] opacity-[0.08] rounded-full animate-pulse" />
        <div className="absolute bottom-[5%] right-[-10%] w-[60%] h-[40%] bg-blue-900 blur-[140px] opacity-[0.05] rounded-full animate-pulse" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20" />
      </div>

      {/* 🏢 Main Content Container */}
      <div className="flex-1 flex flex-col items-center z-10 px-6 py-8 sm:py-12">
        
        {/* 1. Brand Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-8 sm:mb-12"
        >
          <div className="text-8xl sm:text-9xl mb-4 drop-shadow-[0_0_25px_rgba(212,175,55,0.3)] animate-float">🂡</div>
          <h1 className="text-6xl sm:text-8xl font-black golden-text drop-shadow-2xl mb-1" style={{textShadow: "0 4px 40px rgba(0,0,0,0.8)"}}>طرنيب</h1>
          <div className="flex items-center gap-3">
             <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-[var(--color-gold)]/40" />
             <span className="tracking-[6px] text-[var(--color-gold)] opacity-90 text-[10px] sm:text-xs font-black uppercase">كلاسيكيات هيرو</span>
             <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-[var(--color-gold)]/40" />
          </div>
        </motion.div>

        {/* 2. Notifications & Rejoin (Positioned for visibility) */}
        <div className="w-full max-w-sm mb-6 space-y-3">
          {rejoinRoomId && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-r from-[#1a1c35] to-[#0f1020] border-2 border-[var(--color-gold)]/60 rounded-2xl p-4 shadow-2xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-[var(--color-gold)] shadow-lg rounded-xl flex items-center justify-center text-xl">🔄</div>
                 <div className="text-right">
                    <p className="text-[var(--color-gold)] font-black text-xs">لديك مباراة جارية</p>
                    <p className="text-white/50 text-[9px]">هل ترغب في العودة؟</p>
                 </div>
              </div>
              <button 
                onClick={() => {
                  setRejoining(true);
                  initAudio();
                  joinRoom(rejoinRoomId, profile?.name || "لاعب").then(() => {
                    if (G.phase === 'intro') G.phase = 'multiplayer';
                    updateUI();
                  }).catch(() => {
                    localStorage.removeItem('tarneb_active_room');
                    setRejoinRoomId(null);
                  }).finally(() => setRejoining(false));
                }}
                className="px-5 py-2 bg-[var(--color-gold)] text-black font-black text-xs rounded-xl shadow-lg active:scale-95 transition-all"
              >
                {rejoining ? "جاري..." : "دخول"}
              </button>
            </motion.div>
          )}
        </div>

        {/* 3. Primary Actions (Game Modes) */}
        <div className="w-full max-w-sm space-y-4">
          
          {/* ONLINE MODE (Hero Button) */}
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full relative group overflow-hidden rounded-[24px] shadow-[0_10px_35px_rgba(248,181,0,0.25)]"
            onClick={() => { initAudio(); G.phase = 'multiplayer'; updateUI(); }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[#fceabb] via-[#f8b500] to-[#cb9200]" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
            <div className="relative py-5 px-6 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                     <Play className="w-6 h-6 fill-black" />
                  </div>
                  <div className="text-right">
                     <div className="text-black font-black text-xl leading-tight">اللعب أونلاين</div>
                     <div className="text-black/60 text-[10px] font-bold">تحدَّ اللاعبين الحقيقيين الآن</div>
                  </div>
               </div>
               <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_8px_red]" />
               </div>
            </div>
          </motion.button>

          {/* OFFLINE / SAVED MODE */}
          {G.savedPhase ? (
            <motion.button 
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-gradient-to-b from-[#1a1a2e] to-[#0a0a0f] border border-[var(--color-gold)]/30 rounded-2xl flex items-center justify-center gap-3 shadow-xl"
              onClick={() => { initAudio(); G.phase = G.savedPhase!; G.savedPhase = null; updateUI(); }}
            >
               <span className="text-2xl">⚡</span>
               <div className="text-right">
                  <div className="text-[var(--color-gold)] font-black text-sm">متابعة اللعب المحلي</div>
                  <div className="text-white/30 text-[9px] font-bold">لديك جولة لم تكتمل</div>
               </div>
            </motion.button>
          ) : (
            <motion.button 
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-4 px-6 transition-all"
              onClick={() => { initAudio(); G.phase = 'setup'; updateUI(); }}
            >
               <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                  <Gamepad2 className="w-5 h-5 text-white/70" />
               </div>
               <div className="text-right">
                  <div className="text-white font-black text-base">اللعب المحلي</div>
                  <div className="text-white/40 text-[9px]">تدرب ضد الذكاء الاصطناعي</div>
               </div>
            </motion.button>
          )}

          {/* SOCIAL MODE */}
          <motion.button 
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center justify-between px-6 transition-all"
            onClick={() => setShowSocial(true)}
          >
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                   <Users className="w-5 h-5 text-white/70" />
                </div>
                <div className="text-right">
                   <div className="text-white font-black text-base">الأصدقاء والمجتمع</div>
                   <p className="text-white/40 text-[9px]">تواصل مع أصدقائك</p>
                </div>
             </div>
             {hasNotification && (
                <div className="relative flex h-3 w-3">
                   <span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75"></span>
                   <span className="bg-red-500 rounded-full h-3 w-3 border-2 border-black"></span>
                </div>
             )}
          </motion.button>

        </div>
      </div>

      {/* 🧭 Optimized Bottom Navigation / Profile Bar */}
      <div className="bg-gradient-to-t from-black via-black/90 to-transparent pt-10 pb-6 sm:pb-8 px-6 z-20">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md mx-auto bg-[#1a1b2e]/60 backdrop-blur-3xl border border-[var(--color-gold)]/20 p-2.5 rounded-[28px] flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
        >
          {/* Profile Quick Info */}
          <button 
            onClick={() => { G.phase = 'profile'; updateUI(); }}
            className="flex items-center gap-2.5 hover:bg-white/5 p-1 px-2 rounded-2xl transition-colors min-w-0"
          >
            <div className={`relative w-10 h-10 rounded-full flex-shrink-0 ${profile?.searchId === '01' ? 'p-0.5 bg-gradient-to-tr from-[var(--color-gold)] to-yellow-200' : 'p-0.5 bg-white/10'}`}>
               <div className="bg-[#0a0a0f] w-full h-full rounded-full flex items-center justify-center overflow-hidden border border-black/50">
                  {profile?.avatar?.startsWith('http') ? (
                    <img src={profile.avatar} alt="Avatar" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-xl">{profile?.avatar || "👤"}</span>
                  )}
               </div>
               {profile?.searchId === '01' && (
                  <div className="absolute -top-1 -right-1 bg-[var(--color-gold)] p-0.5 rounded-full border border-black scale-90">
                     <Crown className="w-2.5 h-2.5 text-black fill-black" />
                  </div>
               )}
            </div>
            <div className="text-right min-w-0">
               <div className="text-white font-black text-xs truncate max-w-[80px]">{profile?.name || "لاعب"}</div>
               <div className="text-[9px] text-[var(--color-gold)] opacity-70 font-mono tracking-tighter">#{profile?.searchId || "0000"}</div>
            </div>
          </button>

          {/* Quick Shortcuts */}
          <div className="flex gap-1.5 px-2">
            <button 
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 bg-white/5 hover:bg-[var(--color-gold)]/20 rounded-2xl flex items-center justify-center text-white/50 hover:text-[var(--color-gold)] transition-all active:scale-90 border border-white/5"
            >
               <Settings className="w-5 h-5" />
            </button>
            <div className="w-[1px] h-6 bg-white/10 self-center" />
            <button 
              onClick={handleLogout}
              className="w-10 h-10 bg-red-900/10 hover:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-500/80 hover:text-red-500 transition-all active:scale-90 border border-red-500/10"
            >
               <LogOut className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* 🧩 Modals & Overlays */}
      <SocialModal isOpen={showSocial} onClose={() => setShowSocial(false)} myProfile={profile} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* 🔔 Notifications Layer */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="fixed top-8 left-6 right-6 z-[800] pointer-events-none">
            <div className="bg-black/90 backdrop-blur-xl border border-[var(--color-gold)]/30 p-3 px-6 rounded-full shadow-2xl flex items-center gap-3 w-fit mx-auto pointer-events-auto">
              <span className="text-xl">{toast.icon}</span>
              <span className="text-white text-xs font-black">{toast.message}</span>
            </div>
          </motion.div>
        )}

        {invites.length > 0 && (
          <motion.div 
            initial={{ y: -100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -100, opacity: 0, scale: 0.9 }}
            className="fixed top-24 left-4 right-4 z-[650] pointer-events-none"
          >
            <div className="bg-[#1a1a2e]/95 backdrop-blur-2xl border-2 border-[var(--color-gold)] p-4 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col gap-3 pointer-events-auto max-w-[360px] mx-auto overflow-hidden relative group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-50" />
              
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 bg-[var(--color-gold)]/10 rounded-xl flex items-center justify-center text-3xl shadow-inner border border-[var(--color-gold)]/20 overflow-hidden">
                    {invites[0].fromAvatar?.startsWith('http') ? (
                      <img src={invites[0].fromAvatar} alt="Invite Avatar" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      invites[0].fromAvatar
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-[var(--color-gold)] w-3 h-3 rounded-full border-2 border-[#1a1a2e]" />
                </div>
                
                <div className="text-right flex-1 min-w-0">
                  <div className="text-white font-black text-base truncate">{invites[0].fromName}</div>
                  <div className="text-[var(--color-gold)] text-[10px] font-bold flex items-center gap-1 mt-0.5">
                     <span className="animate-pulse shrink-0">⚔️</span>
                     <span className="truncate">يدعوك لتحدٍ في الغرفة: <span className="font-mono bg-white/5 px-1 rounded text-white">{invites[0].roomCode}</span></span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 mt-0.5">
                <button 
                  onClick={async () => {
                    const req = invites[0];
                    const accepted = await respondToRoomInvite(req.id, req.roomCode, 'accepted');
                    if (accepted) {
                      try {
                        await joinRoom(req.roomCode, profile?.name || "لاعب");
                        G.phase = 'multiplayer';
                        updateUI();
                      } catch (err: any) {
                        alert(err.message || "عذراً تعذر الانضمام للغرفة");
                      }
                    }
                  }}
                  className="flex-[2] py-2.5 bg-gradient-to-b from-[#fceabb] to-[#f8b500] text-black font-black text-xs rounded-lg active:scale-95 transition-all shadow-[0_4px_12px_rgba(248,181,0,0.3)] hover:brightness-110"
                >
                  قبول التحدي
                </button>
                <button 
                  onClick={() => respondToRoomInvite(invites[0].id, invites[0].roomCode, 'rejected')}
                  className="flex-1 py-2.5 bg-white/5 text-white/60 font-bold text-xs rounded-lg active:scale-95 transition-all hover:bg-white/10 hover:text-white"
                >
                  تجاهل
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

