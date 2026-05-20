import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  getDocs,
  where,
  updateDoc
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { G, updateUI } from "../logic/engine";
import { 
  Shield, 
  Server, 
  Users, 
  Activity, 
  AlertTriangle, 
  Trash2, 
  ArrowRight,
  Power,
  RefreshCw,
  Ban
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"rooms" | "server" | "logs" | "users">("server");
  
  // Data
  const [rooms, setRooms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // System metrics (mocked + real)
  const [uptime, setUptime] = useState(0); // seconds
  const [isServerActive, setIsServerActive] = useState(true);

  useEffect(() => {
    // Tick uptime
    const t = setInterval(() => setUptime(prev => prev + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (activeTab === "rooms") {
      const q = query(collection(db, "rooms"), orderBy("createdAt", "desc"), limit(50));
      const unsub = onSnapshot(q, (snap) => {
        setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    }
    
    if (activeTab === "users") {
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(50));
      const unsub = onSnapshot(q, (snap) => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    }
  }, [activeTab]);

  const handleDeleteRoom = async (roomId: string) => {
    if (window.confirm("حذف الغرفة نهائياً سيطرد جميع اللاعبين. هل أنت متأكد؟")) {
      try {
         await deleteDoc(doc(db, "rooms", roomId));
      } catch (e: any) {
         alert("فشل حذف الغرفة: " + e.message);
      }
    }
  };

  const handleBanUser = async (userId: string, currentBanStatus: boolean) => {
    if (window.confirm(`هل أنت متأكد من ${currentBanStatus ? 'إلغاء حظر' : 'حظر'} هذا اللاعب؟`)) {
      try {
         await updateDoc(doc(db, "users", userId), {
            isBanned: !currentBanStatus
         });
      } catch(e: any) {
         alert("حدث خطأ");
      }
    }
  };

  const formatUptime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-[#06080F] text-white flex flex-col font-[var(--font-tajawal)] z-50 overflow-hidden" dir="rtl">
      {/* Background Grid & Glow */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
         <div className="absolute w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] md:w-[800px] h-[300px] md:h-[400px] bg-blue-600/20 blur-[100px] md:blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-white/5 border-b border-white/10 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3 md:gap-4">
           <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)] shrink-0">
              <Shield className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
           </div>
           <div className="min-w-0">
             <h1 className="text-base md:text-xl font-black tracking-tight text-white flex items-center gap-2 truncate">
                التحكم المركزي
                {isServerActive ? (
                  <span className="flex h-2 w-2 md:h-2.5 md:w-2.5 relative shrink-0">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-full w-full bg-green-500"></span>
                  </span>
                ) : (
                  <span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-red-500 shrink-0"></span>
                )}
             </h1>
             <p className="text-[10px] md:text-xs text-white/50 font-medium font-mono truncate">ADMIN CONSOLE v1.0</p>
           </div>
        </div>
        
        <button 
          onClick={() => { G.phase = "intro"; updateUI(); }}
          className="flex items-center justify-center gap-1.5 md:gap-2 p-2 md:px-4 md:py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-all text-xs md:text-sm font-bold border border-white/10 shrink-0"
        >
           <span className="hidden sm:inline">عودة للعبة</span>
           <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>

      {/* Content Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
         
         {/* Navigation */}
         <div className="w-full md:w-64 bg-white/5 border-b md:border-b-0 md:border-l border-white/10 shrink-0 p-2 md:py-6 md:px-4 flex flex-row md:flex-col gap-2 relative z-10 backdrop-blur-xl overflow-x-auto no-scrollbar shrink-0">
            <NavItem 
              active={activeTab === "server"} 
              onClick={() => setActiveTab("server")}
              icon={<Server className="w-4 h-4 md:w-5 md:h-5 shrink-0" />}
              label="السيرفر"
            />
            <NavItem 
              active={activeTab === "rooms"} 
              onClick={() => setActiveTab("rooms")}
              icon={<Activity className="w-4 h-4 md:w-5 md:h-5 shrink-0" />}
              label="الغرف المباشرة"
            />
            <NavItem 
              active={activeTab === "users"} 
              onClick={() => setActiveTab("users")}
              icon={<Users className="w-4 h-4 md:w-5 md:h-5 shrink-0" />}
              label="اللاعبين"
            />
            <NavItem 
              active={activeTab === "logs"} 
              onClick={() => setActiveTab("logs")}
              icon={<AlertTriangle className="w-4 h-4 md:w-5 md:h-5 shrink-0" />}
              label="الأخطاء"
            />
         </div>

         {/* Main Panel */}
         <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 relative z-0 scrollbar-hide">
            <AnimatePresence mode="wait">
               {activeTab === "server" && (
                 <motion.div 
                    key="server" 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6"
                 >
                    {/* Server Controls */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 backdrop-blur-lg">
                       <h2 className="text-base md:text-lg font-black mb-4 md:mb-6 flex items-center gap-2"><Power className="w-4 h-4 md:w-5 md:h-5 text-blue-400"/> التحكم بمحرك اللعبة</h2>
                       
                       <div className="flex items-center justify-between p-3 md:p-4 bg-black/40 rounded-xl mb-4 border border-white/5">
                          <div>
                            <div className="text-white/60 text-[10px] md:text-xs font-bold mb-1">حالة اتصال Firebase</div>
                            <div className={`font-black text-sm md:text-lg ${isServerActive ? 'text-green-400' : 'text-red-400'}`}>
                               {isServerActive ? 'متصل ويعمل' : 'متوقف'}
                            </div>
                          </div>
                          <button 
                            onClick={() => setIsServerActive(!isServerActive)}
                            className={`w-12 h-6 md:w-14 md:h-8 rounded-full transition-all flex items-center px-1 ${isServerActive ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'} relative cursor-pointer`}
                          >
                             <div className={`w-4 h-4 md:w-6 md:h-6 rounded-full transition-all absolute ${isServerActive ? 'bg-green-400 left-1' : 'bg-red-400 right-1'}`} />
                          </button>
                       </div>

                       <div className="grid grid-cols-2 gap-3 md:gap-4">
                          <div className="p-3 md:p-4 bg-black/40 rounded-xl border border-white/5">
                             <div className="text-white/50 text-[10px] md:text-xs font-bold mb-1">وقت التشغيل المستمر</div>
                             <div className="text-lg md:text-2xl font-mono font-black text-blue-400">{formatUptime(uptime)}</div>
                          </div>
                          <div className="p-3 md:p-4 bg-black/40 rounded-xl border border-white/5">
                             <div className="text-white/50 text-[10px] md:text-xs font-bold mb-1">عقد السيرفر</div>
                             <div className="text-lg md:text-2xl font-black text-white">4 <span className="text-xs md:text-sm text-green-500">نشطة</span></div>
                          </div>
                       </div>
                    </div>
                 </motion.div>
               )}

               {activeTab === "rooms" && (
                 <motion.div 
                    key="rooms" 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                 >
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                       <h2 className="text-lg md:text-xl font-black flex items-center gap-2">الغرف المباشرة</h2>
                       <div className="px-2 py-1 md:px-3 md:py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold rounded-lg text-xs md:text-sm whitespace-nowrap">
                          {rooms.length} غرف
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                       {rooms.length === 0 && <div className="text-white/50 col-span-full py-10 text-center font-bold text-sm md:text-base">لا يوجد غرف حالياً</div>}
                       {rooms.map(r => (
                         <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-5 hover:bg-white/10 transition-colors group">
                           <div className="flex items-center justify-between mb-3">
                              <span className="font-mono text-sm md:text-lg font-black bg-white/10 px-2 py-0.5 rounded text-[var(--color-gold)]">{r.id}</span>
                              <button 
                                onClick={() => handleDeleteRoom(r.id)}
                                className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                                title="إغلاق الغرفة"
                              >
                                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </button>
                           </div>
                           <div className="flex flex-col gap-1.5 text-xs md:text-sm text-white/70">
                              <div className="flex justify-between"><span>اللاعبين:</span> <span>{r.players?.length || 0}/4</span></div>
                              <div className="flex justify-between"><span>الحالة:</span> <span className="truncate max-w-[120px] text-left">{r.state || 'غير معروف'}</span></div>
                              <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10">
                                <span className="text-[10px] md:text-xs text-white/40">المُنشئ:</span>
                                <span className="text-[10px] md:text-xs text-white/60 truncate max-w-[120px] text-left">{r.createdBy || '---'}</span>
                              </div>
                           </div>
                         </div>
                       ))}
                    </div>
                 </motion.div>
               )}

               {activeTab === "users" && (
                 <motion.div 
                    key="users" 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                 >
                    <h2 className="text-lg md:text-xl font-black flex items-center gap-2 mb-4 md:mb-6">أحدث اللاعبين</h2>
                    <div className="bg-black/50 border border-white/10 rounded-xl md:rounded-2xl overflow-x-auto w-full">
                       <table className="w-full min-w-[500px] text-right bg-transparent text-sm">
                          <thead className="bg-white/5 text-white/50 border-b border-white/10 text-xs md:text-sm">
                             <tr>
                                <th className="p-3 md:p-4 font-bold w-12 md:w-16">Av.</th>
                                <th className="p-3 md:p-4 font-bold">اللاعب</th>
                                <th className="p-3 md:p-4 font-bold hidden sm:table-cell">المستوى</th>
                                <th className="p-3 md:p-4 font-bold">الحالة</th>
                                <th className="p-3 md:p-4 font-bold text-left">إجراء</th>
                             </tr>
                          </thead>
                          <tbody>
                             {users.map(u => (
                               <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                  <td className="p-3 md:p-4">
                                     <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                        {u.avatar?.startsWith('http') ? <img src={u.avatar} className="w-full h-full object-cover" /> : <span className="text-lg md:text-xl">{u.avatar||"👤"}</span>}
                                     </div>
                                  </td>
                                  <td className="p-3 md:p-4 text-white">
                                     <div className="font-bold text-sm md:text-base truncate max-w-[120px] md:max-w-[200px]">{u.name}</div>
                                     <div className="text-[10px] md:text-xs text-[var(--color-gold)] font-mono">{u.searchId || u.id.substring(0, 8)}</div>
                                  </td>
                                  <td className="p-3 md:p-4 font-black hidden sm:table-cell">{u.level || 1}</td>
                                  <td className="p-3 md:p-4">
                                     {u.isBanned ? (
                                        <span className="px-1.5 py-0.5 md:px-2 md:py-1 rounded bg-red-500/20 text-red-400 font-bold text-[10px] md:text-xs whitespace-nowrap">محظور</span>
                                     ) : (
                                        <span className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded ${u.status === 'online'? 'bg-green-500/20 text-green-400': 'bg-white/10 text-white/50'} font-bold text-[10px] md:text-xs whitespace-nowrap`}>
                                           {u.status === 'online' ? 'متصل' : 'غ/م'}
                                        </span>
                                     )}
                                  </td>
                                  <td className="p-3 md:p-4 text-left">
                                     <button 
                                        onClick={() => handleBanUser(u.id, u.isBanned)}
                                        className={`px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${u.isBanned ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/10 hover:bg-red-500/30 text-red-500'}`}
                                     >
                                        <div className="flex items-center gap-1 md:gap-1.5 justify-center">
                                          <Ban className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                          <span className="hidden sm:inline">{u.isBanned ? 'إلغاء حظر' : 'حظر اللاعب'}</span>
                                          <span className="sm:hidden">{u.isBanned ? 'فك' : 'حظر'}</span>
                                        </div>
                                     </button>
                                  </td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </motion.div>
               )}

               {activeTab === "logs" && (
                 <motion.div 
                    key="logs" 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                 >
                    <h2 className="text-lg md:text-xl font-black flex items-center gap-2 mb-4 md:mb-6">سجل الأخطاء النظام</h2>
                    <div className="bg-black/60 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 font-mono text-[10px] md:text-sm h-[300px] md:h-[400px] flex flex-col justify-end">
                       {/* Mock Logs */}
                       <div className="flex flex-col gap-1.5 md:gap-2 overflow-y-auto w-full scrollbar-hide">
                          <div className="text-white/50">[2026-05-20 10:45:12] INFO: Firebase connection established.</div>
                          <div className="text-white/50">[2026-05-20 10:46:06] <span className="text-yellow-400">WARN: Client fallback to long polling applied.</span></div>
                          <div className="text-red-400/80">[2026-05-20 10:46:40] ERROR: Invalid room state payload from client #9x82jf.</div>
                          <div className="text-white/50">[2026-05-20 10:47:01] INFO: Server garbage collection completed natively.</div>
                          <div className="text-white/50">[2026-05-20 10:49:53] INFO: Multiplayer loop auto-resumed explicitly.</div>
                       </div>
                    </div>
                 </motion.div>
               )}

            </AnimatePresence>
         </div>
      </div>
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`shrink-0 md:w-full flex items-center gap-1.5 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl transition-all font-bold text-xs md:text-sm ${active ? 'bg-blue-600/20 text-white border border-blue-500/30 md:shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'text-white/50 hover:bg-white/5 hover:text-white/90 border border-transparent'}`}
    >
       {icon}
       <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

