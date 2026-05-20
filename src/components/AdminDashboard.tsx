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
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/10 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Shield className="w-6 h-6 text-blue-400" />
           </div>
           <div>
             <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                لوحة تحكم النظام 
                {isServerActive ? (
                  <span className="flex h-2.5 w-2.5 relative">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                )}
             </h1>
             <p className="text-xs text-white/50 font-medium font-mono">ADMINISTRATION CONSOLE v1.0</p>
           </div>
        </div>
        
        <button 
          onClick={() => { G.phase = "intro"; updateUI(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-all text-sm font-bold border border-white/10"
        >
           عودة للعبة
           <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Content Layout */}
      <div className="flex-1 flex overflow-hidden relative">
         
         {/* Sidebar Navigation */}
         <div className="w-64 bg-white/5 border-l border-white/10 shrink-0 py-6 px-4 flex flex-col gap-2 relative z-10 backdrop-blur-xl">
            <NavItem 
              active={activeTab === "server"} 
              onClick={() => setActiveTab("server")}
              icon={<Server className="w-5 h-5" />}
              label="حالة السيرفر"
            />
            <NavItem 
              active={activeTab === "rooms"} 
              onClick={() => setActiveTab("rooms")}
              icon={<Activity className="w-5 h-5" />}
              label="إدارة الغرف المباشرة"
            />
            <NavItem 
              active={activeTab === "users"} 
              onClick={() => setActiveTab("users")}
              icon={<Users className="w-5 h-5" />}
              label="إدارة اللاعبين"
            />
            <NavItem 
              active={activeTab === "logs"} 
              onClick={() => setActiveTab("logs")}
              icon={<AlertTriangle className="w-5 h-5" />}
              label="سجل الأخطاء النظامية"
            />
         </div>

         {/* Main Panel */}
         <div className="flex-1 overflow-y-auto p-6 md:p-10 relative z-10 scrollbar-hide">
            <AnimatePresence mode="wait">
               {activeTab === "server" && (
                 <motion.div 
                    key="server" 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                 >
                    {/* Server Controls */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-lg">
                       <h2 className="text-lg font-black mb-6 flex items-center gap-2"><Power className="w-5 h-5 text-blue-400"/> التحكم بمحرك اللعبة</h2>
                       
                       <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl mb-4 border border-white/5">
                          <div>
                            <div className="text-white/60 text-xs font-bold mb-1">حالة اتصال Firebase</div>
                            <div className={`font-black text-lg ${isServerActive ? 'text-green-400' : 'text-red-400'}`}>
                               {isServerActive ? 'متصل ويعمل' : 'متوقف'}
                            </div>
                          </div>
                          <button 
                            onClick={() => setIsServerActive(!isServerActive)}
                            className={`w-14 h-8 rounded-full transition-all flex items-center px-1 ${isServerActive ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'} relative cursor-pointer`}
                          >
                             <div className={`w-6 h-6 rounded-full transition-all absolute ${isServerActive ? 'bg-green-400 left-1' : 'bg-red-400 right-1'}`} />
                          </button>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                             <div className="text-white/50 text-xs font-bold mb-1">وقت التشغيل المستمر</div>
                             <div className="text-2xl font-mono font-black text-blue-400">{formatUptime(uptime)}</div>
                          </div>
                          <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                             <div className="text-white/50 text-xs font-bold mb-1">عقد السيرفر</div>
                             <div className="text-2xl font-black text-white">4 <span className="text-sm text-green-500">نشطة</span></div>
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
                    <div className="flex items-center justify-between mb-6">
                       <h2 className="text-xl font-black flex items-center gap-2">الغرف النشطة حالياً</h2>
                       <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold rounded-lg text-sm">
                          {rooms.length} غرف
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                       {rooms.length === 0 && <div className="text-white/50 col-span-full py-10 text-center font-bold">لا يوجد غرف حالياً</div>}
                       {rooms.map(r => (
                         <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors group">
                           <div className="flex items-center justify-between mb-3">
                              <span className="font-mono text-lg font-black bg-white/10 px-2 py-0.5 rounded text-[var(--color-gold)]">{r.id}</span>
                              <button 
                                onClick={() => handleDeleteRoom(r.id)}
                                className="w-8 h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                                title="إغلاق الغرفة"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                           <div className="flex flex-col gap-1 text-sm text-white/70">
                              <div className="flex justify-between"><span>اللاعبين:</span> <span>{r.players?.length || 0}/4</span></div>
                              <div className="flex justify-between"><span>الحالة:</span> <span>{r.state || 'غير معروف'}</span></div>
                              <div className="flex justify-between mt-2 pt-2 border-t border-white/10 text-xs text-white/40">
                                <span>مُنشئ الغرفة:</span>
                                <span>{r.createdBy || '---'}</span>
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
                    <h2 className="text-xl font-black flex items-center gap-2 mb-6">أحدث اللاعبين المسجلين</h2>
                    <div className="bg-black/50 border border-white/10 rounded-2xl overflow-hidden">
                       <table className="w-full text-right bg-transparent text-sm">
                          <thead className="bg-white/5 text-white/50 border-b border-white/10">
                             <tr>
                                <th className="p-4 font-bold">Avatar</th>
                                <th className="p-4 font-bold">ID / User</th>
                                <th className="p-4 font-bold">Level</th>
                                <th className="p-4 font-bold">Status</th>
                                <th className="p-4 font-bold text-left">Actions</th>
                             </tr>
                          </thead>
                          <tbody>
                             {users.map(u => (
                               <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                  <td className="p-4">
                                     <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                        {u.avatar?.startsWith('http') ? <img src={u.avatar} className="w-full h-full object-cover" /> : <span className="text-xl">{u.avatar||"👤"}</span>}
                                     </div>
                                  </td>
                                  <td className="p-4 text-white">
                                     <div className="font-bold text-base">{u.name}</div>
                                     <div className="text-xs text-[var(--color-gold)] font-mono">{u.searchId || u.id.substring(0, 8)}</div>
                                  </td>
                                  <td className="p-4 font-black">{u.level || 1}</td>
                                  <td className="p-4">
                                     {u.isBanned ? (
                                        <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 font-bold text-xs">محظور</span>
                                     ) : (
                                        <span className={`px-2 py-1 rounded ${u.status === 'online'? 'bg-green-500/20 text-green-400': 'bg-white/10 text-white/50'} font-bold text-xs`}>
                                           {u.status === 'online' ? 'متصل' : 'غير متصل'}
                                        </span>
                                     )}
                                  </td>
                                  <td className="p-4 text-left">
                                     <button 
                                        onClick={() => handleBanUser(u.id, u.isBanned)}
                                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${u.isBanned ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/10 hover:bg-red-500/30 text-red-500'}`}
                                     >
                                        <div className="flex items-center gap-1.5 justify-center">
                                          <Ban className="w-3.5 h-3.5" />
                                          {u.isBanned ? 'إلغاء حظر' : 'حظر اللاعب'}
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
                    <h2 className="text-xl font-black flex items-center gap-2 mb-6">سجل الأخطاء والنظام</h2>
                    <div className="bg-black/60 border border-white/10 rounded-2xl p-6 font-mono text-sm h-[400px] flex flex-col justify-end">
                       {/* Mock Logs */}
                       <div className="flex flex-col gap-2 overflow-y-auto w-full text-xs">
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${active ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'text-white/50 hover:bg-white/5 hover:text-white/90 border border-transparent'}`}
    >
       {icon}
       {label}
    </button>
  );
}
