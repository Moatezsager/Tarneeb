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
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 text-center bg-[#11111a] relative overflow-hidden" dir="rtl">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-gold)] blur-[150px] opacity-[0.07] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600 blur-[150px] opacity-[0.05] rounded-full animate-pulse" />
      
      {/* Profile Header (Relocated to Bottom for better UX) */}
      <div className="absolute bottom-8 right-6 left-6 z-50 flex justify-between items-center bg-gradient-to-b from-[#1a1a2e] to-[#0a0a0f] backdrop-blur-xl p-2.5 px-4 rounded-[30px] border-2 border-[var(--color-gold)]/40 shadow-[0_15px_40px_rgba(0,0,0,0.8)] max-w-[420px] mx-auto animate-in fade-in slide-in-from-bottom duration-700">
        
        {/* Profile (Right side) */}
        <div className="flex items-center gap-3">
          <div 
            className={`w-10 h-10 sm:w-11 sm:h-11 ${profile?.searchId === '01' ? 'bg-gradient-to-tr from-[var(--color-gold)] to-yellow-200 p-0.5 shadow-[0_0_15px_rgba(212,175,55,0.4)]' : 'bg-[var(--color-gold)]/20 border border-[var(--color-gold)]/40'} rounded-full flex items-center justify-center text-2xl sm:text-3xl shadow-inner cursor-pointer active:scale-95 transition-all hover:border-[var(--color-gold)] relative`}
            onClick={() => { G.phase = 'profile'; updateUI(); }}
          >
            <div className="bg-[#0a0a0a] w-full h-full rounded-full flex items-center justify-center overflow-hidden">
              {profile?.avatar?.startsWith('http') ? (
                <img src={profile.avatar} alt="Avatar" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                profile?.avatar || "👤"
              )}
            </div>
            {profile?.searchId === '01' && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }} 
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -top-1.5 -right-1.5 bg-[var(--color-gold)] p-0.5 rounded-full border border-black shadow-lg"
              >
                <Crown className="w-3 h-3 text-black fill-black" />
              </motion.div>
            )}
          </div>

          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5" dir="rtl">
              <div className={`font-black text-xs sm:text-sm leading-tight max-w-[100px] truncate ${profile?.searchId === '01' ? 'text-[var(--color-gold)]' : 'text-white'}`}>{profile?.name}</div>
              <div className="text-[9px] text-[#666] font-mono tracking-tighter" dir="ltr">#{profile?.searchId}</div>
            </div>
            <div className="text-[9px] text-[var(--color-gold)] font-bold flex items-center gap-1" dir="rtl">
              <span>{country?.flag}</span>
              <span className="truncate max-w-[50px]">{country?.name}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons (Left side) */}
        <div className="flex gap-1.5">
           <button 
             onClick={() => { G.phase = 'profile'; updateUI(); }}
             className="p-2 sm:p-2.5 bg-white/5 hover:bg-[var(--color-gold)]/20 rounded-2xl text-white/80 hover:text-[var(--color-gold)] transition-all border border-white/5 active:scale-90"
             title="الملف الشخصي"
           >
             <UserCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
           </button>
           <button 
             onClick={() => setShowSettings(true)}
             className="p-2 sm:p-2.5 bg-white/5 hover:bg-[var(--color-gold)]/20 rounded-2xl text-white/80 hover:text-[var(--color-gold)] transition-all border border-white/5 active:scale-90"
             title="الإعدادات"
           >
             <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
           </button>
           <div className="w-[1px] h-6 bg-white/10 mx-0.5 self-center" />
           <button 
             onClick={handleLogout}
             className="p-2 sm:p-2.5 bg-red-900/10 hover:bg-red-900/30 rounded-2xl text-red-500/80 hover:text-red-500 transition-all border border-red-500/10 active:scale-90"
             title="خروج"
           >
             <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
           </button>
        </div>
      </div>

      
      <div className="z-10 flex flex-col items-center w-full max-w-sm mt-12 sm:mt-16">
        <div className="text-8xl md:text-9xl mb-2 drop-shadow-[0_0_20px_rgba(212,175,55,0.4)] animate-bounce-subtle">🂡</div>
        <div className="text-7xl md:text-8xl font-black golden-text font-[var(--font-tajawal)] drop-shadow-2xl" style={{textShadow: "0 4px 30px rgba(212,175,55,0.4)"}}>طرنيب</div>
        <div className="font-[var(--font-tajawal)] tracking-[10px] text-[var(--color-gold)] opacity-90 text-sm md:text-md mt-2 font-black uppercase">
          كلاسيكيات هيرو
        </div>
        
        <p className="text-[#ccc] text-sm md:text-base my-2 max-w-[280px] sm:max-w-[340px] leading-relaxed font-medium px-4 mt-8">
          العب طرنيب مع أصدقائك في أي وقت وفي أي مكان، بذكاء ومهارة عالية.
        </p>
        
        <div className="flex flex-col gap-3.5 w-full mt-6 px-2">
          {rejoinRoomId && (
            <div className="absolute top-2 left-4 right-4 z-50 animate-in fade-in slide-in-from-top duration-500">
              <div className="bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1c] backdrop-blur-md border-2 border-[var(--color-gold)] rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--color-gold)]/20 rounded-xl flex items-center justify-center text-xl shadow-inner border border-[var(--color-gold)]/30">
                    🔄
                  </div>
                  <div className="text-right">
                    <h3 className="text-[var(--color-gold)] font-black text-sm">لديك مباراة جارية!</h3>
                    <p className="text-white/60 text-[10px]">هل ترغب في العودة إليها؟</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-6 py-2 bg-gradient-to-b from-[#fceabb] to-[#f8b500] text-black rounded-xl font-black text-xs transition-all hover:scale-105 active:scale-95 shadow-lg"
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
                    {rejoining ? "جاري العودة..." : "دخول"}
                  </button>
                  <button
                    className="p-2 bg-black/20 text-white/70 rounded-xl hover:bg-black/30 transition-all"
                    onClick={() => {
                      localStorage.removeItem('tarneb_active_room');
                      setRejoinRoomId(null);
                    }}
                    disabled={rejoining}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {G.savedPhase && (
            <button 
              className="w-full py-4 text-base sm:text-lg bg-gradient-to-b from-[#1a1a2e] to-[#0a0a0f] text-[var(--color-gold)] border border-[var(--color-gold)]/40 rounded-2xl font-black cursor-pointer shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group mb-1"
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
              <div className="bg-black/80 backdrop-blur-xl border border-[var(--color-gold)]/30 p-3 px-5 rounded-full shadow-2xl flex items-center gap-3 w-fit mx-auto pointer-events-auto">
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
                    <div className="absolute -bottom-1 -right-1 bg-[var(--color-gold)] w-3 h-3 rounded-full border-2 border-[#1a1a2e]" />
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
