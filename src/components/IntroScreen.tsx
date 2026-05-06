import React, { useState, useEffect } from "react";
import { initAudio, sfxNotify } from "../lib/audio";
import { G, updateUI } from "../logic/engine";
import { auth } from "../lib/firebase";
import { getLocalProfile, COUNTRIES } from "../logic/userProfile";
import { ProfileSetupScreen } from "./ProfileSetupScreen";
import { SocialModal } from "./SocialModal";
import { SettingsModal } from "./SettingsModal";
import { Settings, LogOut, Users, Play, Gamepad2, UserCircle } from "lucide-react";
import { 
  listenToFriendRequests, 
  listenToAcceptedRequests, 
  deleteFriendRequest,
  cleanupOldFriendRequests,
  FriendRequest
} from "../logic/social";
import { listenToRoomInvites, respondToRoomInvite, joinRoom, cleanupOldInvites, cleanupStaleRooms } from "../logic/multiplayer";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";

export function IntroScreen() {
  const profile = getLocalProfile();
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
    // Run cleanup logic only once per session or mount (ideally once per app life but mount is safer with auth)
    const runCleanup = async () => {
      const lastCleanup = sessionStorage.getItem('tarneb_last_cleanup');
      const now = Date.now();
      if (!lastCleanup || now - parseInt(lastCleanup) > 3600000) { // Once per hour per tab
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
      setRejoinRoomId(activeRoomId);
    }

    // Listen for incoming friend requests
    const unsubRequests = listenToFriendRequests((reqs) => {
      setRequestsCount(reqs.length);
    });

    // Also handle automatic syncing of accepted requests even when modal is closed
    const unsubAccepted = listenToAcceptedRequests(async (accepted) => {
      setAcceptedCount(accepted.length);
      
      const user = auth.currentUser;
      if (!user) return;

      for (const req of accepted) {
        // Prevent redundant processing using a persistent session set
        const processedKey = `friend_processed_${req.id}`;
        if (req.toUid && !sessionStorage.getItem(processedKey)) {
          sessionStorage.setItem(processedKey, 'true');
          try {
            // Add to my friend list (I am the sender who got accepted)
            const myFriendRef = doc(db, "users", user.uid, "friends", req.toUid);
            await setDoc(myFriendRef, {
              uid: req.toUid,
              name: req.toName || "لاعب",
              avatar: req.toAvatar || "👤",
              searchId: req.toSearchId || "",
              status: "online", // optimistic
              updatedAt: serverTimestamp()
            });
            
            // Show toast
            sfxNotify();
            setToast({
              message: `أصبح ${req.toName} صديقك الآن!`,
              icon: req.toAvatar || "🤝"
            });
            setTimeout(() => setToast(null), 5000);

            // Clean up the request document
            await deleteFriendRequest(req.id);
          } catch (err) {
            console.error("Intro sync error:", err);
            sessionStorage.removeItem(processedKey); // Allow retry if failed
          }
        }
      }
    });

    return () => {
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
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 text-center bg-[#11111a] relative overflow-hidden" dir="rtl">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-gold)] blur-[120px] opacity-10 rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[var(--color-kuba)] blur-[120px] opacity-10 rounded-full animate-pulse" />
      
      {/* Profile Header */}
      <div className="absolute top-4 right-4 left-4 z-20 flex justify-between items-center bg-black/50 backdrop-blur-md p-3 rounded-[24px] border border-white/10 shadow-2xl">
        
        {/* Profile (Right side) */}
        <div className="flex items-center gap-3">
          <div 
            className={`w-11 h-11 sm:w-12 sm:h-12 ${profile?.searchId === '01' ? 'bg-gradient-to-tr from-[var(--color-gold)] to-yellow-200 p-0.5' : 'bg-[var(--color-gold)]/20 border border-[var(--color-gold)]/40'} rounded-full flex items-center justify-center text-2xl sm:text-3xl shadow-inner cursor-pointer active:scale-95 transition-all hover:border-[var(--color-gold)] relative`}
            onClick={() => { G.phase = 'profile'; updateUI(); }}
          >
            <div className="bg-[#1a1a1a] w-full h-full rounded-full flex items-center justify-center overflow-hidden">
              {profile?.avatar?.startsWith('http') ? (
                <img src={profile.avatar} alt="Avatar" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                profile?.avatar || "👤"
              )}
            </div>
            {profile?.searchId === '01' && (
              <div className="absolute -top-1 -right-1 bg-[var(--color-gold)] p-0.5 rounded-full border border-black shadow-lg">
                <span className="text-[10px] block leading-none">👑</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-start gap-0.5">
            <div className="flex items-center gap-1.5" dir="rtl">
              <div className="text-white font-black text-xs md:text-md leading-tight max-w-[120px] truncate">{profile?.name}</div>
              {profile?.searchId === '01' && <span className="text-[var(--color-gold)] text-[10px]">👑</span>}
              <div className="text-[10px] text-[#888] font-mono tracking-tighter" dir="ltr">#{profile?.searchId}</div>
            </div>
            <div className="text-[9px] sm:text-[10px] text-[var(--color-gold)] font-bold flex items-center gap-1" dir="rtl">
              <span>{country?.flag}</span>
              <span className="truncate max-w-[60px]">{country?.name}</span>
            </div>
          </div>
        </div>

        {/* Buttons (Left side) */}
        <div className="flex gap-2">
           <button 
             onClick={() => { G.phase = 'profile'; updateUI(); }}
             className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/80 hover:text-white transition-colors border border-white/5 active:scale-90"
             title="تعديل الملف الشخصي"
           >
             <UserCircle className="w-4 h-4 sm:w-5 sm:h-5" />
           </button>
           <button 
             onClick={() => setShowSettings(true)}
             className="p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/80 hover:text-white transition-colors border border-white/5 active:scale-90"
             title="إعدادات اللعبة"
           >
             <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
           </button>
           <button 
             onClick={handleLogout}
             className="p-2 sm:p-2.5 bg-red-900/20 hover:bg-red-900/40 rounded-[14px] text-red-500 transition-colors border border-red-500/10 active:scale-90"
             title="خروج"
           >
             <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
           </button>
        </div>
      </div>
      
      <div className="z-10 flex flex-col items-center w-full max-w-sm mt-12 sm:mt-16">
        <div className="text-8xl md:text-9xl mb-2 drop-shadow-[0_0_20px_rgba(212,175,55,0.4)] animate-bounce-subtle">🂡</div>
        <div className="text-7xl md:text-8xl font-black golden-text font-[var(--font-tajawal)] drop-shadow-2xl" style={{textShadow: "0 4px 30px rgba(212,175,55,0.4)"}}>طرنيب</div>
        <div className="font-[var(--font-tajawal)] tracking-[10px] text-[var(--color-gold)] opacity-90 text-sm md:text-md mt-2 font-black uppercase">
          مجانية بالكامل
        </div>
        
        <div className="flex gap-2 items-center my-5">
           <span className="bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/40 text-[var(--color-gold)] px-4 py-1.5 rounded-full text-xs md:text-sm font-bold shadow-sm backdrop-blur-sm">
             ✨ مجانية لمدى الحياة
           </span>
        </div>
        
        <p className="text-[#ccc] text-sm md:text-base my-2 max-w-[280px] sm:max-w-[340px] leading-relaxed font-medium px-4">
          العب طرنيب مع أصدقائك في أي وقت وفي أي مكان، بذكاء وبدون إعلانات.
        </p>
        
        <div className="flex flex-col gap-3.5 w-full mt-6 px-2">
          {rejoinRoomId && (
            <div className="flex gap-2 mb-2 w-full">
              <button 
                className="flex-1 py-4 text-base sm:text-lg bg-green-600/90 text-white border border-green-500 rounded-2xl font-black cursor-pointer shadow-[0_5px_25px_rgba(34,197,94,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group"
                onClick={() => {
                  setRejoining(true);
                  initAudio();
                  joinRoom(rejoinRoomId, profile?.name || "لاعب").then(() => {
                    if (G.phase === 'intro') {
                       G.phase = 'multiplayer';
                    }
                    updateUI();
                  }).catch((e) => {
                    console.error("Auto rejoin failed", e);
                    localStorage.removeItem('tarneb_active_room');
                    setRejoinRoomId(null);
                    alert(e.message || "عذراً تعذر العودة للمباراة أو أن المباراة قد انتهت");
                  }).finally(() => {
                    setRejoining(false);
                  });
                }}
                disabled={rejoining}
              >
                <div className="text-xl group-hover:rotate-180 transition-transform duration-500">🔄</div>
                <span className="translate-y-[1px]">
                  {rejoining ? "جاري العودة..." : "العودة للمباراة السابقة"}
                </span>
              </button>
              <button
                className="p-4 bg-red-900/30 text-red-500 rounded-2xl border border-red-500/20 active:scale-95 transition-all w-14 shrink-0 flex items-center justify-center hover:bg-red-900/50"
                onClick={() => {
                  localStorage.removeItem('tarneb_active_room');
                  setRejoinRoomId(null);
                }}
                disabled={rejoining}
                title="تجاهل"
              >
                ✖
              </button>
            </div>
          )}

          {G.savedPhase && (
            <button 
              className="w-full py-4 text-base sm:text-lg bg-green-600/90 text-white border border-green-500 rounded-2xl font-black cursor-pointer shadow-[0_5px_25px_rgba(34,197,94,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group mb-1"
              onClick={() => {
                initAudio();
                G.phase = G.savedPhase!;
                G.savedPhase = null;
                updateUI();
              }}
            >
              <div className="text-xl group-hover:rotate-12 transition-transform">🃏</div>
              <span className="translate-y-[1px]">متابعة اللعب المحلي</span>
            </button>
          )}

          <button 
            className="w-full py-4 text-base sm:text-lg bg-gradient-to-b from-[#fceabb] to-[#f8b500] text-black border border-[#f8b500]/50 rounded-2xl font-black cursor-pointer shadow-[0_5px_25px_rgba(248,181,0,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group"
            onClick={() => {
              initAudio();
              G.phase = 'multiplayer';
              updateUI();
            }}
          >
            <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-black group-hover:-translate-x-1 transition-transform" />
            <span className="translate-y-[1px]">اللعب أونلاين</span>
          </button>

          <button 
            className={`w-full py-4 text-base sm:text-lg border rounded-2xl font-bold cursor-pointer shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 group ${G.savedPhase ? 'bg-white/5 border-white/10 text-white/50 py-3 text-sm' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
            onClick={() => {
              initAudio();
              G.phase = 'setup';
              updateUI();
            }}
          >
            <Gamepad2 className={`w-5 h-5 sm:w-6 sm:h-6 group-hover:text-white transition-colors ${G.savedPhase ? 'text-white/30' : 'text-white/80'}`} />
            <span className="translate-y-[1px]">
              {G.savedPhase ? "بدء مباراة محلية جديدة" : "اللعب المحلي (أوفلاين)"}
            </span>
          </button>

          <button 
            className="w-full py-3.5 text-sm sm:text-base bg-black/40 border border-white/5 text-[#ccc] rounded-2xl font-bold cursor-pointer transition-all hover:bg-white/10 flex items-center justify-center gap-2 relative group mt-2 shadow-inner"
            onClick={() => setShowSocial(true)}
          >
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#aaa] group-hover:text-white transition-colors" />
            <span className="translate-y-[1px]">الأصدقاء والمجتمع</span>
            
            {hasNotification && (
              <span className="absolute top-2.5 right-2.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
              </span>
            )}
          </button>
        </div>
      </div>

        <SocialModal 
          isOpen={showSocial} 
          onClose={() => setShowSocial(false)} 
          myProfile={profile}
        />

        <SettingsModal 
          isOpen={showSettings} 
          onClose={() => setShowSettings(false)} 
        />

        {/* Generic Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="fixed top-24 left-4 right-4 z-[700] pointer-events-none"
            >
              <div className="bg-black/80 backdrop-blur-xl border border-green-500/30 p-3 px-5 rounded-full shadow-2xl flex items-center gap-3 w-fit mx-auto pointer-events-auto">
                <span className="text-xl">{toast.icon}</span>
                <span className="text-white text-sm font-bold">{toast.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Room Invite Notification */}
        <AnimatePresence>
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
                    <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-[#1a1a2e]" />
                  </div>
                  
                  <div className="text-right flex-1 min-w-0">
                    <div className="text-white font-black text-base truncate">{invites[0].fromName}</div>
                    <div className="text-[var(--color-gold)] text-[10px] font-bold flex items-center gap-1 mt-0.5">
                       <span className="animate-pulse shrink-0">⚔️</span>
                       <span className="truncate">يدعوك لتحدٍ في الغرفة: <span className="font-mono bg-white/5 px-1 rounded text-white">{invites[0].roomCode}</span></span>
                    </div>
                  </div>
                  
                  {invites.length > 1 && (
                    <div className="bg-[var(--color-kuba)] text-white text-[10px] font-black px-2 py-1 rounded-full absolute -top-1 -left-1 shadow-lg animate-bounce">
                      +{invites.length - 1}
                    </div>
                  )}
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
