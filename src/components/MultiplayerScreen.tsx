import React, { useState, useEffect } from "react";
import { multiplayerState, createRoom, joinRoom, leaveRoom, startGame, fetchPublicRooms, listenToPublicRooms, RoomData, sendRoomInvite, swapPlayerWithSpectator, listenToRoomInvites, respondToRoomInvite } from "../logic/multiplayer";
import { G, updateUI, subscribe } from "../logic/engine";
import { auth, db } from "../lib/firebase";
import { getLocalProfile, COUNTRIES, isUserOnline } from "../logic/userProfile";
import { collection, onSnapshot, query, where, getDoc, doc } from "firebase/firestore";
import { ShieldAlert, ShieldCheck, Lock, Unlock, Users, Plus, Share2, Play, Eye, Home, Send, X, ArrowRight, UserPlus, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FriendInvite {
  uid: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
}

export function MultiplayerScreen() {
  const profile = getLocalProfile();
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inRoom, setInRoom] = useState(multiplayerState.isMultiplayer);
  const [tick, setTick] = useState(0);
  
  // Player Event Notifications
  const [lastPlayers, setLastPlayers] = useState<typeof multiplayerState.players>([]);
  const [roomToast, setRoomToast] = useState<{message: string, icon: string} | null>(null);

  const toastTimeoutRef = React.useRef<any>(null);

  const showRoomToast = (message: string, icon: string) => {
    setRoomToast({ message, icon });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setRoomToast(null);
    }, 4000);
  };

  // Monitor Player Events
  useEffect(() => {
    if (!inRoom) return;

    // Detect Joins / Leaves / Status Changes
    const currentPlayers = [...multiplayerState.players];
    
    if (lastPlayers.length > 0) {
      // 1. Detect Joins
      currentPlayers.forEach(p => {
        const prev = lastPlayers.find(lp => lp.uid === p.uid);
        if (!prev) {
          if (!p.isBot) {
            showRoomToast(`${p.name} دخل الغرفة الآن`, "⚔️");
          } else {
            showRoomToast(`الكمبيوتر أخذ مكان لاعب`, "🤖");
          }
        } else {
          // 2. Detect Connection Changes
          const wasDisconnected = prev.status === "disconnected";
          const isDisconnected = p.status === "disconnected";
          if (isDisconnected && !wasDisconnected && !p.isBot) {
            showRoomToast(`${p.name} فقد الاتصال.. جاري انتظاره`, "📡");
          } else if (!isDisconnected && wasDisconnected && !p.isBot) {
            showRoomToast(`${p.name} عاد إلى قلب المعركة!`, "⚡");
          }
        }
      });

      // 3. Detect Leaves
      lastPlayers.forEach(lp => {
        const missing = !currentPlayers.find(p => p.uid === lp.uid);
        if (missing && !lp.isBot) {
          showRoomToast(`${lp.name} غادر المباراة`, "🏃‍♂️");
        }
      });
    }

    setLastPlayers(currentPlayers);
  }, [multiplayerState.players, inRoom]);
  
  // Lobby State
  const [publicRooms, setPublicRooms] = useState<RoomData[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [roomPassword, setRoomPassword] = useState("");
  const [winLimit, setWinLimit] = useState(31);
  const [mode, setMode] = useState<"FFA" | "Teams" | "1v1">("Teams");
  const [joinPassword, setJoinPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState<{code: string, asSpectator: boolean} | null>(null);
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [onlineFriends, setOnlineFriends] = useState<FriendInvite[]>([]);
  const [invites, setInvites] = useState<any[]>([]);

  useEffect(() => {
    if (showInviteModal && auth.currentUser) {
      // Fetch online friends to invite
      const unsubFriends = onSnapshot(collection(db, "users", auth.currentUser.uid, "friends"), async (snapshot) => {
        const friendsList = snapshot.docs.map(doc => doc.data());
        const friendsWithStatus: FriendInvite[] = [];
        
        for (const f of friendsList) {
          // Check online status for each friend
          const friendRef = doc(db, "users", f.uid);
          const friendSnap = await getDoc(friendRef);
          if (friendSnap.exists() && isUserOnline(friendSnap.data() as any)) {
            friendsWithStatus.push({
              uid: f.uid,
              name: f.name,
              avatar: f.avatar,
              status: 'online'
            });
          }
        }
        setOnlineFriends(friendsWithStatus);
      });
      return unsubFriends;
    }
  }, [showInviteModal]);

  useEffect(() => {
    // Listen for incoming invites
    const unsubInvites = listenToRoomInvites((newInvites) => {
      setInvites(newInvites);
    });

    const unsubG = subscribe(() => {
      setTick(t => t + 1);
      setInRoom(multiplayerState.isMultiplayer);
    });
    
    // Real-time listener for public rooms
    const unsubRooms = listenToPublicRooms((rooms) => {
       setPublicRooms(rooms);
    });

    return () => {
      unsubInvites();
      unsubG();
      unsubRooms();
    };
  }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      await createRoom(profile?.name || "لاعب", isPublic, roomPassword, winLimit, mode);
      setInRoom(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (targetCode?: string, pass?: string, asSpectator = false) => {
    const code = targetCode || joinCode;
    if (!code) return;
    setLoading(true);
    setError("");
    try {
      await joinRoom(code, profile?.name || "لاعب", pass || joinPassword, asSpectator);
      setInRoom(true);
      setShowPasswordInput(null);
    } catch (e: any) {
      setError(e.message);
      if (e.message === "كلمة المرور غير صحيحة") {
        setShowPasswordInput({code, asSpectator});
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (friendUid: string) => {
    await sendRoomInvite(friendUid, multiplayerState.roomCode);
    alert("تم إرسال الدعوة!");
  };

  if (inRoom) {
     return (
       <div className="flex flex-col items-center min-h-[100dvh] bg-[#0a0a0f]" dir="rtl">
         {/* Room Toast Notifications */}
         <AnimatePresence>
           {roomToast && (
             <motion.div 
               initial={{ y: -50, opacity: 0 }}
               animate={{ y: 20, opacity: 1 }}
               exit={{ y: -50, opacity: 0 }}
               className="fixed top-20 left-6 right-6 z-[100] pointer-events-none"
             >
               <div className="bg-black/80 backdrop-blur-3xl border border-[var(--color-gold)]/30 p-2.5 px-5 rounded-[20px] shadow-2xl flex items-center gap-3 w-fit mx-auto pointer-events-auto">
                 <div className="w-8 h-8 bg-[var(--color-gold)]/20 rounded-lg flex items-center justify-center text-lg">{roomToast.icon}</div>
                 <span className="text-white text-xs font-black tracking-tight">{roomToast.message}</span>
               </div>
             </motion.div>
           )}
         </AnimatePresence>

         {/* Improved Header */}
         <div className="w-full bg-[#151522]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
            <button 
              onClick={() => { G.phase = 'intro'; updateUI(); }}
              className="p-2 hover:bg-white/5 rounded-xl transition-all group"
            >
              <ArrowRight className="w-6 h-6 text-white/40 group-hover:text-white" />
            </button>
            <div className="flex flex-col items-center">
              <h2 className="text-[var(--color-gold)] font-black text-lg">غرفة الانتظار</h2>
              <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{multiplayerState.isPublic ? "غرفة عامة" : "غرفة خاصة"}</div>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex -space-x-2 flex-row-reverse border border-white/10 p-1 rounded-full bg-black/20">
                  {multiplayerState.players.slice(0, 3).map(p => (
                    <div key={p.uid} className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] shadow-sm overflow-hidden">
                      {p.avatar?.startsWith('http') ? <img src={p.avatar} alt="Avatar" className="w-full h-full object-contain" referrerPolicy="no-referrer" /> : p.avatar}
                    </div>
                  ))}
                  {multiplayerState.players.length > 3 && <div className="w-6 h-6 rounded-full bg-[var(--color-gold)] text-black border border-white/20 flex items-center justify-center text-[8px] font-black">+1</div>}
               </div>
            </div>
         </div>

         <div className="w-full max-w-[420px] p-6 mt-4">
            <div className="p-6 bg-[#151522] border-2 border-[var(--color-gold)]/30 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden mb-6">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-50" />
            
            <h2 className="text-2xl font-black text-[var(--color-gold)] mb-6 drop-shadow-md">غرفة اللعب</h2>

            <div className="flex gap-3 mb-8">
              <button 
                onClick={() => setShowInviteModal(true)}
                className="flex-1 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 active:scale-95 transition-all shadow-inner flex items-center justify-center gap-2"
              >
                <span className="text-xl">➕</span> دعوة صديق
              </button>
              <div className="flex-1 py-4 bg-gradient-to-br from-black/60 to-black/40 border border-white/10 rounded-2xl flex flex-col items-center justify-center shadow-inner relative group">
                <span className="text-[10px] text-[var(--color-gold)] font-bold uppercase tracking-widest leading-none mb-1.5 opacity-80">رمز الغرفة</span>
                <span className="text-white font-black text-2xl tracking-widest leading-none drop-shadow-md">{multiplayerState.roomCode}</span>
              </div>
            </div>
            
            <div className="text-right mb-8">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-[#aaa] text-sm font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-gold)] animate-pulse"></span>
                  اللاعبون المتصلون
                </h3>
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/70 font-bold">{multiplayerState.players.length}/4</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map(i => {
                  const p = multiplayerState.players.find(x => x.index === i);
                  const country = COUNTRIES.find(c => c.code === p?.country);
                  return (
                     <div key={i} className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${p ? 'bg-gradient-to-b from-white/10 to-transparent border border-white/10 shadow-sm' : 'bg-black/20 border border-dashed border-white/10 opacity-50'}`}>
                       {p ? (
                         <>
                           <div className="relative">
                             <div className={`text-3xl filter drop-shadow-md p-1 rounded-2xl ${p.searchId === '01' ? 'bg-[var(--color-gold)]/20 border border-[var(--color-gold)]/50' : ''}`}>
                               {p.avatar?.startsWith('http') ? <img src={p.avatar} alt="Avatar" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" /> : p.avatar}
                             </div>
                             {i === 0 && p.searchId !== '01' && <span className="absolute -bottom-1 -right-1 text-[10px] bg-[var(--color-gold)] text-black w-4 h-4 flex items-center justify-center rounded-full leading-none shadow-md">👑</span>}
                             {p.searchId === '01' && <span className="absolute -top-2 -right-2 text-[10px] bg-[var(--color-gold)] text-black w-5 h-5 flex items-center justify-center rounded-full leading-none shadow-[0_0_10px_rgba(212,175,55,0.8)] border border-black animate-pulse z-10 text-xs">👑</span>}
                           </div>
                           <div className="flex flex-col items-center text-center max-w-full">
                             <div className="flex items-center gap-1 justify-center max-w-full">
                               <span className={`font-black text-xs truncate max-w-full leading-tight ${p.searchId === '01' ? 'text-[var(--color-gold)]' : 'text-white'}`}>{p.name}</span>
                               {p.searchId === '01' && <span className="px-1 py-0.5 bg-[var(--color-gold)] text-black rounded text-[6px] font-black uppercase tracking-tighter">مطور</span>}
                             </div>
                             <span className="text-[9px] text-[#888] font-bold truncate max-w-full">{country?.flag} {country?.name} {p.uid === auth.currentUser?.uid ? "(أنت)" : ""}</span>
                           </div>
                         </>
                       ) : (
                         <>
                           <div className="w-8 h-8 rounded-full border border-dashed border-white/20 flex items-center justify-center text-white/20 text-xs mb-1">?</div>
                           <span className="text-[#666] text-[10px] font-bold text-center">بانتظار لاعب</span>
                         </>
                       )}
                     </div>
                  );
                })}
              </div>
            </div>

            {/* Spectators List */}
            {G.spectators && G.spectators.length > 0 && (
              <div className="text-right mb-8">
                <h3 className="text-[#888] text-xs mb-3 font-bold px-2 uppercase tracking-wider">المشاهدون ({G.spectators.length})</h3>
                <div className="flex flex-wrap gap-2 justify-end px-2">
                  {G.spectators.map(s => (
                    <div key={s.uid} className={`flex items-center gap-2 pr-2 pl-3 py-1.5 rounded-xl border group relative shadow-sm ${s.searchId === '01' ? 'bg-gradient-to-r from-[var(--color-gold)]/20 to-[var(--color-gold)]/5 border-[var(--color-gold)]/50' : 'bg-gradient-to-r from-white/5 to-transparent border-white/5'}`}>
                      <div className="relative">
                        <span className="text-sm">
                          {s.avatar?.startsWith('http') ? <img src={s.avatar} alt="Avatar" className="w-5 h-5 object-contain" referrerPolicy="no-referrer" /> : s.avatar}
                        </span>
                        {s.searchId === '01' && <span className="absolute -top-1.5 -right-1.5 text-[6px] bg-[var(--color-gold)] text-black w-3 h-3 flex items-center justify-center rounded-full leading-none shadow-md border border-black z-10">👑</span>}
                      </div>
                      <span className={`text-xs font-bold ${s.searchId === '01' ? 'text-[var(--color-gold)]' : 'text-white/70'}`}>{s.name}</span>
                      {multiplayerState.isHost && multiplayerState.players.length < 4 && (
                        <button 
                          onClick={() => {
                            const emptySeat = [0, 1, 2, 3].find(i => !multiplayerState.players.find(p => p.index === i));
                            if (emptySeat !== undefined) swapPlayerWithSpectator(emptySeat, s.uid);
                          }}
                          className="absolute -top-2 -left-2 bg-[var(--color-gold)] text-black w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-[0_0_10px_rgba(212,175,55,0.5)] opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                          title="إضافة للعب"
                        >
                          +
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {multiplayerState.isHost ? (
              <div className="space-y-3">
                <button 
                  onClick={startGame}
                  className="w-full py-4 bg-gradient-to-b from-[#f9e698] to-[#aa8d2e] text-black font-black text-lg rounded-2xl shadow-[0_5px_20px_rgba(212,175,55,0.4)] active:scale-95 transition-all hover:brightness-110 flex justify-center items-center gap-2"
                >
                  <span>🚀</span> ابدأ اللعبة {multiplayerState.players.length < 4 ? "(مع بوتات)" : ""}
                </button>
                <div className="text-[10px] text-[#666] font-bold text-center">المقاعد الشاغرة سيتم ملؤها بذكاء اصطناعي</div>
              </div>
            ) : (
              <div className="bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/30 text-[var(--color-gold)] font-bold rounded-2xl py-4 flex justify-center items-center gap-2 shadow-inner">
                <div className="w-2 h-2 bg-[var(--color-gold)] rounded-full animate-ping" />
                بانتظار المضيف لبدء اللعبة...
              </div>
            )}

            <button 
              onClick={() => leaveRoom()}
              className="w-full mt-4 py-3 bg-red-900/10 text-red-500/80 font-bold rounded-xl hover:bg-red-900/30 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20 active:scale-95"
            >
              مغادرة الغرفة
            </button>
         </div>

        {/* Invite Friends Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-[320px] bg-[#1a1a2e] border border-[var(--color-gold)] rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <button onClick={() => setShowInviteModal(false)} className="text-white/40 hover:text-white transition-colors">×</button>
                <h3 className="text-white font-bold">دعوة أصدقاء متصلين</h3>
              </div>
              
              <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-[100px] custom-scrollbar">
                {onlineFriends.length === 0 ? (
                  <div className="text-center py-8 text-[#555] text-xs">لا يوجد أصدقاء متصلين حالياً...</div>
                ) : (
                  onlineFriends.map(f => (
                    <div key={f.uid} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl inline-block w-8 h-8">
                          {f.avatar?.startsWith('http') ? <img src={f.avatar} alt="Avatar" className="w-full h-full object-contain" referrerPolicy="no-referrer" /> : f.avatar}
                        </span>
                        <span className="text-white font-bold text-sm">{f.name}</span>
                      </div>
                      <button 
                        onClick={() => handleInvite(f.uid)}
                        className="p-2 bg-[var(--color-gold)] text-black rounded-xl text-[10px] font-black active:scale-95 transition-transform"
                      >
                        إرسال 📩
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              <button 
                onClick={() => setShowInviteModal(false)}
                className="w-full mt-6 py-3 bg-[#222] text-white/50 font-bold rounded-xl active:scale-95 transition-transform shrink-0"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
       </div>
      </div>
     );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0a0a0f] text-center relative overflow-hidden" dir="rtl">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[var(--color-gold)] blur-[150px] opacity-10 rounded-full animate-pulse" />
      
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto relative z-10 p-4">
        
        {/* Header Content */}
        <div className="flex items-center justify-between mb-6 pt-2">
            <button 
              onClick={() => { G.phase = "intro"; updateUI(); }}
              className="p-2 bg-white/5 text-white/70 hover:text-white rounded-xl border border-white/5 active:scale-95 transition-all"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-l from-[var(--color-gold)] to-[#ffe699] tracking-wider drop-shadow-sm">ردهة الانتظار</h2>
            <div className="w-10" /> {/* Balancer */}
        </div>
        
        {error && (
            <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-2 text-sm">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span className="text-right leading-tight">{error}</span>
            </div>
        )}

        {/* Join by Code Section */}
        <div className="flex gap-2 mb-6">
           <input 
             value={joinCode}
             onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
             placeholder="رمز غرفـة"
             maxLength={4}
             className="flex-1 p-4 bg-black/40 border border-[var(--color-gold)]/20 rounded-2xl text-white text-center font-black tracking-[0.2em] text-xl focus:outline-none focus:border-[var(--color-gold)] placeholder:text-white/20 shadow-inner"
           />
           <button 
             onClick={() => handleJoin()}
             disabled={loading || !joinCode}
             className="px-6 bg-gradient-to-b from-[var(--color-gold)] to-[#cca628] text-black font-black rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-2"
           >
             <span>انضمام</span>
             <Play className="w-4 h-4 fill-black" />
           </button>
        </div>

        {/* Create Section */}
        <div className="mb-6 p-5 bg-gradient-to-b from-black/60 to-black/40 rounded-[24px] border border-white/5 shadow-xl text-right backdrop-blur-md">
           <div className="flex items-center gap-2 mb-4">
               <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center border border-[var(--color-gold)]/30">
                   <Plus className="w-4 h-4 text-[var(--color-gold)]" />
               </div>
               <h3 className="text-white font-bold text-sm tracking-wide">إنشاء غرفة جديدة</h3>
           </div>
           
           <div className="flex gap-3 mb-4">
              <button 
                onClick={() => setIsPublic(true)}
                className={`flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black transition-all border ${isPublic ? 'bg-[var(--color-gold)]/10 text-[var(--color-gold)] border-[var(--color-gold)]/50 shadow-inner' : 'bg-white/5 text-white/40 border-transparent hover:bg-white/10'}`}
              >
                <Unlock className="w-4 h-4" />
                عامة
              </button>
              <button 
                onClick={() => setIsPublic(false)}
                className={`flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black transition-all border ${!isPublic ? 'bg-[var(--color-gold)]/10 text-[var(--color-gold)] border-[var(--color-gold)]/50 shadow-inner' : 'bg-white/5 text-white/40 border-transparent hover:bg-white/10'}`}
              >
                <Lock className="w-4 h-4" />
                خاصة
              </button>
           </div>
           
           {!isPublic && (
             <div className="mb-4 relative">
                 <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                 <input 
                  type="password"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  placeholder="كلمة مرور الغرفة"
                  className="w-full py-3.5 pr-11 pl-4 bg-black/50 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors shadow-inner"
                 />
             </div>
           )}

           <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[#888] text-[11px] font-bold uppercase tracking-wider">حد الفوز (النقاط)</h4>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/50 font-mono">pts</span>
              </div>
              <div className="flex gap-2">
                 {[31, 61, 121].map(limit => (
                   <button 
                     key={limit}
                     onClick={() => setWinLimit(limit)}
                     className={`flex-1 py-2.5 rounded-xl text-sm font-black border transition-all ${winLimit === limit ? 'bg-[var(--color-gold)] text-black border-[var(--color-gold)] shadow-md' : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10'}`}
                   >
                     {limit}
                   </button>
                 ))}
              </div>
           </div>

           <div className="mb-6">
              <label className="text-white/40 text-[10px] font-bold mb-2 flex items-center justify-between px-1 uppercase tracking-widest">
                 <span>نظام اللعب</span>
                 <span className="text-[var(--color-gold)]">{mode === "Teams" ? "فرق 2v2" : mode === "FFA" ? "فردي 4" : "ثنائي 1v1"}</span>
              </label>
              <div className="flex gap-2">
                 {[
                   { val: "Teams", icon: "👥" },
                   { val: "FFA", icon: "🥷" },
                   { val: "1v1", icon: "⚔️" }
                 ].map(({val, icon}) => (
                   <button 
                     key={val}
                     onClick={() => setMode(val as any)}
                     className={`flex-1 py-2.5 rounded-xl text-lg font-black border transition-all ${mode === val ? 'bg-[var(--color-gold)] text-black border-[var(--color-gold)] shadow-md' : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10'}`}
                   >
                     {icon}
                   </button>
                 ))}
              </div>
           </div>

           <button 
             onClick={handleCreate}
             disabled={loading}
             className="w-full py-4 bg-gradient-to-b from-[#f9e698] to-[#aa8d2e] text-black font-black text-base rounded-2xl shadow-[0_5px_15px_rgba(212,175,55,0.3)] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale flex justify-center items-center gap-2"
           >
             <Play className="w-5 h-5 fill-black" />
             استضافة الغرفة
           </button>
        </div>

        {/* Lobby Section */}
        <div className="flex-1 flex flex-col text-right">
           <div className="flex items-center gap-2 mb-3 px-1">
               <Users className="w-4 h-4 text-[#888]" />
               <h3 className="text-[#888] text-xs font-bold uppercase tracking-wider">استكشف الغرف المتاحة</h3>
           </div>
           
           <div className="flex-1 overflow-y-auto space-y-3 pb-6 custom-scrollbar pr-1 min-h-[150px]">
              {publicRooms.length === 0 ? (
                <div className="h-full flex items-center justify-center p-8 bg-white/5 border border-white/5 border-dashed rounded-3xl">
                    <div className="text-center">
                        <Home className="w-8 h-8 text-white/20 mx-auto mb-2 opacity-50" />
                        <div className="text-[#666] text-sm font-medium">لا يوجد غرف عامة حالياً...</div>
                        <div className="text-[#444] text-[10px] mt-1">قم بإنشاء غرفتك الخاصة!</div>
                    </div>
                </div>
              ) : (
                publicRooms.map(room => (
                  <div key={room.code} className="group p-4 bg-black/40 border border-white/5 rounded-[20px] flex gap-3 cursor-pointer hover:bg-white/5 hover:border-[var(--color-gold)]/30 transition-all active:scale-[0.98]">
                    <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-[var(--color-gold)]/20 to-[var(--color-gold)]/5 rounded-[14px] flex items-center justify-center border border-[var(--color-gold)]/20 shadow-inner group-hover:from-[var(--color-gold)]/30 transition-colors">
                        <Home className="w-6 h-6 text-[var(--color-gold)]" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center text-right overflow-hidden">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="text-white font-bold text-sm truncate">{room.hostName}</div>
                            <div className="text-[var(--color-gold)] font-black text-xs tracking-widest bg-[var(--color-gold)]/10 px-1.5 py-0.5 rounded shadow-sm">
                              {room.code}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] text-[#888] font-bold flex items-center gap-1.5">
                                <Users className="w-3 h-3" />
                                {room.players.length}/4 لاعبين
                                {room.password && <span className="text-blue-400 flex items-center gap-0.5 ml-1"><Lock className="w-2.5 h-2.5"/>محمي</span>}
                            </div>
                            <div className="flex gap-1.5">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); room.password ? setShowPasswordInput({code: room.code, asSpectator: false}) : handleJoin(room.code); }}
                                  className="text-[10px] bg-[var(--color-gold)] text-black px-2.5 py-1.5 rounded-lg font-black shadow-sm active:scale-95 flex items-center gap-1"
                                >
                                  لعب
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); room.password ? setShowPasswordInput({code: room.code, asSpectator: true}) : handleJoin(room.code, "", true); }}
                                  className="text-[10px] bg-white/10 text-white/70 px-2 py-1.5 rounded-lg border border-white/5 hover:bg-white/20 active:scale-95 transition-colors flex items-center gap-1"
                                  title="مشاهدة"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>
      </div>

        {/* Room Invite Notification */}
        <AnimatePresence>
          {invites.length > 0 && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-6 left-6 right-6 z-[600] pointer-events-none"
            >
              <div className="bg-black/90 backdrop-blur-xl border-2 border-[var(--color-gold)] p-4 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center justify-between pointer-events-auto max-w-[400px] mx-auto overflow-hidden relative group gap-4">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-gold)]/10 to-transparent" />
                <div className="flex items-center gap-3 relative z-10 w-full md:w-auto overflow-hidden">
                  <div className="w-12 h-12 shrink-0 bg-white/10 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-white/5">
                    {invites[0].fromAvatar}
                  </div>
                  <div className="text-right overflow-hidden pr-2">
                    <div className="text-white font-black text-sm truncate">{invites[0].fromName}</div>
                    <div className="text-[var(--color-gold)] text-[10px] font-bold truncate">دعوة للانضمام لغرفة: {invites[0].roomCode}</div>
                  </div>
                </div>
                <div className="flex gap-2 relative z-10 shrink-0 w-full md:w-auto">
                  <button 
                    onClick={async () => {
                      const req = invites[0];
                      const accepted = await respondToRoomInvite(req.id, req.roomCode, 'accepted');
                      if (accepted) {
                         if (multiplayerState.isMultiplayer) { // Leave current room if in one
                            await leaveRoom();
                         }
                         await handleJoin(req.roomCode); // Using handleJoin handles password modal / spectator state
                      }
                    }}
                    className="flex-1 md:flex-none px-4 py-2 bg-gradient-to-b from-[#fceabb] to-[#f8b500] text-black font-black text-xs rounded-xl active:scale-95 transition-all text-center shadow-lg"
                  >
                    قبول
                  </button>
                  <button 
                    onClick={() => respondToRoomInvite(invites[0].id, invites[0].roomCode, 'rejected')}
                    className="flex-1 md:flex-none px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl active:scale-95 transition-all text-center"
                  >
                    رفض
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Password Modal (Simple) */}
        {showPasswordInput && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
             <div className="w-full max-w-[300px] bg-[#1a1a2e] border border-[var(--color-gold)] rounded-3xl p-6 shadow-2xl">
                <h3 className="text-white font-bold mb-4">أدخل كلمة المرور</h3>
                <input 
                   type="password"
                   autoFocus
                   value={joinPassword}
                   onChange={(e) => setJoinPassword(e.target.value)}
                   className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white mb-4 focus:outline-none focus:border-[var(--color-gold)]"
                />
                <div className="flex gap-2">
                   <button onClick={() => handleJoin(showPasswordInput.code, joinPassword, showPasswordInput.asSpectator)} className="flex-1 py-3 bg-[var(--color-gold)] text-black font-bold rounded-xl active:scale-95 transition-transform">دخول</button>
                   <button onClick={() => setShowPasswordInput(null)} className="flex-1 py-3 bg-[#222] text-white/50 font-bold rounded-xl active:scale-95 transition-transform">إلغاء</button>
                </div>
             </div>
          </div>
        )}
    </div>
  );
}
