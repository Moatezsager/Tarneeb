import React, { useState } from "react";
import { UserProfile, COUNTRIES, AVATARS, saveUserProfile, generateSearchId, isSearchIdUnique } from "../logic/userProfile";
import { auth } from "../lib/firebase";
import { G, updateUI } from "../logic/engine";
import { User, Globe, Users, Palette, Check, ArrowRight, Volume2, VolumeX, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";

interface Props {
  onComplete: () => void;
  initialData?: UserProfile | null;
}

export function ProfileSetupScreen({ onComplete, initialData }: Props) {
  const [name, setName] = useState(initialData?.name || auth.currentUser?.displayName || "");
  const [country, setCountry] = useState(initialData?.country || "LY");
  const [gender, setGender] = useState<"male" | "female" | "other">(initialData?.gender || "male");
  const [avatar, setAvatar] = useState(initialData?.avatar || AVATARS[0]);
  const [muted, setMuted] = useState(G.isMuted);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
       setError("يرجى إدخال الاسم");
       return;
    }
    if (!auth.currentUser) return;

    setLoading(true);
    setError("");

    // Update muted state globally
    G.isMuted = muted;
    localStorage.setItem('tarneb_muted', muted ? 'true' : 'false');

    let finalSearchId = initialData?.searchId;
    if (!finalSearchId) {
      let unique = false;
      let attempts = 0;
      while (!unique && attempts < 5) {
        let candidate = generateSearchId();
        unique = await isSearchIdUnique(candidate);
        if (unique) finalSearchId = candidate;
        attempts++;
      }
      if (!finalSearchId) {
        setError("فشل في إنشاء معرّف فريد، يرجى المحاولة لاحقاً");
        setLoading(false);
        return;
      }
    }

    const profile: UserProfile = { 
      uid: auth.currentUser.uid,
      name: name.trim(), 
      searchId: finalSearchId,
      country, 
      gender, 
      avatar,
      status: "online"
    };
    const success = await saveUserProfile(auth.currentUser.uid, profile);
    if (success) {
      onComplete();
    } else {
      setError("فشل حفظ البيانات، يرجى المحاولة لاحقاً");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 sm:p-6 bg-[#0a0a0f] relative overflow-hidden" dir="rtl">
       {/* Background Decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[var(--color-gold)] blur-[150px] opacity-10 rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--color-kuba)] blur-[120px] opacity-5 rounded-full" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[500px] bg-[#161625]/90 backdrop-blur-2xl border border-white/5 rounded-[40px] shadow-[0_30px_100px_rgba(0,0,0,0.7)] flex flex-col relative overflow-hidden z-10"
      >
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-gold)]/40 to-transparent" />
        
        {/* Header */}
        <div className="p-8 pb-4 flex justify-between items-center sm:px-10">
           <div className="flex flex-col">
              <h2 className="text-3xl font-black text-white font-[var(--font-tajawal)] leading-tight">الإعدادات</h2>
              <div className="text-[10px] text-[var(--color-gold)] font-bold uppercase tracking-widest mt-1">الملف الشخصي والنظام</div>
           </div>
           <button 
             onClick={onComplete}
             className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white/40 hover:text-white transition-all border border-white/5 active:scale-90"
           >
             <ArrowRight className="w-5 h-5" />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 sm:px-10 pb-8 space-y-8">
           {error && (
             <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-900/20 text-red-400 rounded-2xl text-xs font-bold border border-red-500/20 flex items-center gap-3">
               <span className="text-lg">⚠️</span> {error}
             </motion.div>
           )}

           <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* ID Card */}
              {initialData?.searchId && (
                <div className="p-5 bg-gradient-to-br from-black/60 to-black/30 border border-[var(--color-gold)]/20 rounded-[28px] text-center shadow-inner relative group">
                  <div className="absolute top-3 right-4 px-2 py-0.5 bg-[var(--color-gold)]/20 rounded-md border border-[var(--color-gold)]/30">
                    <span className="text-[8px] font-black tracking-widest text-[var(--color-gold)] uppercase">ID</span>
                  </div>
                  <label className="block text-white/30 text-[10px] font-black mb-1 uppercase tracking-widest">معرّف البحث الفريد</label>
                  <div className="text-white font-mono text-2xl tracking-[0.4em] font-black drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{initialData.searchId}</div>
                  <p className="text-white/10 text-[9px] mt-2 font-bold flex items-center justify-center gap-1">
                     <ShieldCheck className="w-3 h-3" /> تم التحقق من هويتك في طرنيب هيرو
                  </p>
                </div>
              )}

              {/* Sound Settings */}
              <div className="space-y-3">
                 <label className="block text-white/50 text-[10px] font-black mr-1 flex items-center gap-2 uppercase tracking-widest">
                   <Volume2 className="w-3.5 h-3.5 text-[var(--color-gold)]" /> إعدادات الصوت
                 </label>
                 <button 
                   type="button"
                   onClick={() => setMuted(!muted)}
                   className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all group ${muted ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}
                 >
                    <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-xl transition-all ${muted ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                       </div>
                       <div className="text-right">
                          <div className="text-white font-bold text-sm">{muted ? "صامت" : "صوت اللعبة مفعل"}</div>
                          <div className="text-[10px] text-white/30 font-bold">{muted ? "مؤثرات اللعبة لن تظهر" : "استمتع بمؤثرات لعب واقعية"}</div>
                       </div>
                    </div>
                    <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${muted ? 'bg-white/10' : 'bg-green-500'}`}>
                       <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 shadow-lg ${muted ? 'right-1 bg-white/40' : 'right-7 bg-white'}`} />
                    </div>
                 </button>
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                 <div>
                   <label className="block text-white/50 text-[10px] font-black mb-2 mr-1 flex items-center gap-2 uppercase tracking-widest">
                     <User className="w-3.5 h-3.5 text-[var(--color-gold)]" /> الاسم المستعار
                   </label>
                   <input 
                     type="text"
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                     className="w-full p-4.5 bg-black/40 border border-white/10 rounded-[22px] text-white focus:outline-none focus:border-[var(--color-gold)]/50 focus:bg-black/60 transition-all font-bold placeholder:text-white/10 shadow-inner"
                     placeholder="ادخل اسمك..."
                   />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-white/50 text-[10px] font-black mb-2 mr-1 flex items-center gap-2 uppercase tracking-widest">
                       <Globe className="w-3.5 h-3.5 text-[var(--color-gold)]" /> البلد
                     </label>
                     <div className="relative">
                        <select 
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="w-full p-4 bg-black/40 border border-white/10 rounded-[22px] text-white focus:outline-none focus:border-[var(--color-gold)]/50 appearance-none font-bold cursor-pointer"
                        >
                          {COUNTRIES.map(c => (
                            <option key={c.code} value={c.code} className="bg-[#1a1a2e]">{c.flag} {c.name}</option>
                          ))}
                        </select>
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20">▼</div>
                     </div>
                   </div>
                   <div>
                     <label className="block text-white/50 text-[10px] font-black mb-2 mr-1 flex items-center gap-2 uppercase tracking-widest">
                       <Users className="w-3.5 h-3.5 text-[var(--color-gold)]" /> الجنس
                     </label>
                     <div className="flex bg-black/40 border border-white/10 rounded-[22px] p-1 shadow-inner h-full">
                       <button 
                         type="button"
                         onClick={() => setGender("male")}
                         className={`flex-1 rounded-[18px] text-xs font-black transition-all ${gender === 'male' ? 'bg-gradient-to-b from-[#4facfe] to-[#00f2fe] text-blue-900 shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                       >
                         ذكر
                       </button>
                       <button 
                         type="button"
                         onClick={() => setGender("female")}
                         className={`flex-1 rounded-[18px] text-xs font-black transition-all ${gender === 'female' ? 'bg-gradient-to-b from-[#f093fb] to-[#f5576c] text-pink-900 shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                       >
                         أنثى
                       </button>
                     </div>
                   </div>
                 </div>
              </div>

              {/* Avatar Selection */}
              <div>
                <label className="block text-white/50 text-[10px] font-black mb-3 mr-1 flex items-center gap-2 uppercase tracking-widest">
                  <Palette className="w-3.5 h-3.5 text-[var(--color-gold)]" /> الأفاتار
                </label>
                <div className="grid grid-cols-5 gap-2.5 bg-black/40 border border-white/10 rounded-[28px] p-4 max-h-[220px] overflow-y-auto custom-scrollbar shadow-inner">
                  {AVATARS.map(av => (
                    <button 
                      key={av}
                      type="button"
                      onClick={() => setAvatar(av)}
                      className={`text-3xl p-3 rounded-2xl transition-all relative group flex items-center justify-center ${avatar === av ? 'bg-gradient-to-br from-[var(--color-gold)]/40 to-yellow-600/20 border-2 border-[var(--color-gold)] shadow-[0_0_15px_rgba(212,175,55,0.3)]' : 'hover:bg-white/5 active:scale-90 opacity-60 hover:opacity-100 border-2 border-transparent'}`}
                    >
                      {av}
                      {avatar === av && (
                        <div className="absolute -top-1 -right-1 bg-[var(--color-gold)] text-black p-0.5 rounded-full shadow-lg">
                           <Check className="w-2.5 h-2.5 stroke-[4]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                 <button 
                   type="submit"
                   disabled={loading}
                   className="w-full py-5 bg-gradient-to-b from-[#fceabb] to-[#f8b500] text-black font-black text-xl rounded-[24px] shadow-[0_15px_40px_rgba(248,181,0,0.3)] active:scale-[0.96] transition-all disabled:opacity-50 flex items-center justify-center gap-3 relative group overflow-hidden"
                 >
                   <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12" />
                   {loading ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-4 border-black/30 border-t-black"></div>
                   ) : (
                      <>
                        <ShieldCheck className="w-7 h-7" />
                        <span className="translate-y-[1px]">{initialData ? "تحديث وحفظ" : "إنشاء الحساب والمتابعة"}</span>
                      </>
                   )}
                 </button>
              </div>
           </form>
        </div>
      </motion.div>

      {/* Footer Quote */}
      <div className="mt-8 text-center opacity-20 pointer-events-none select-none z-0">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white">Tarneb Hero Experience</p>
      </div>
    </div>
  );
}
