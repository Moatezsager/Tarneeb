import React, { useState } from "react";
import { UserProfile, COUNTRIES, AVATARS, AVATAR_CATEGORIES, saveUserProfile, generateSearchId, isSearchIdUnique } from "../logic/userProfile";
import { auth } from "../lib/firebase";
import { G, updateUI } from "../logic/engine";
import { User, Globe, Users, Palette, Check, ArrowRight, Volume2, VolumeX, ShieldCheck, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  onComplete: () => void;
  initialData?: UserProfile | null;
}

export function ProfileSetupScreen({ onComplete, initialData }: Props) {
  const [name, setName] = useState(initialData?.name || auth.currentUser?.displayName || "");
  const [country, setCountry] = useState(initialData?.country || "LY");
  const [gender, setGender] = useState<"male" | "female" | "other">(initialData?.gender || "male");
  const [avatar, setAvatar] = useState(initialData?.avatar || AVATARS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "avatar">("info");

  const selectedCountry = COUNTRIES.find(c => c.code === country);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
       setError("يرجى إدخال اسم اللاعب");
       return;
    }
    if (!auth.currentUser) return;

    setLoading(true);
    setError("");

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
    <div className="flex flex-col items-center justify-start min-h-[100dvh] bg-[#05050a] relative overflow-x-hidden pt-12 pb-24 sm:py-12 px-4" dir="rtl">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-gold)]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
      </div>

      <div className="w-full max-w-[480px] z-10 space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-white tracking-tighter">ملف المحترف</h1>
            <p className="text-[var(--color-gold)] text-[10px] font-black uppercase tracking-[0.3em]">Profile Identity</p>
          </div>
          <button 
            onClick={onComplete}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white/50 hover:text-white transition-all border border-white/5 active:scale-90"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Live Preview Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative aspect-[1.8/1] w-full bg-[#1a1a2e] rounded-[32px] overflow-hidden border border-white/10 shadow-2xl group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-transparent to-[var(--color-gold)]/10" />
          <div className="absolute top-0 right-0 p-6 flex flex-col gap-1 items-end">
             <div className="px-3 py-1 bg-[var(--color-gold)] text-black text-[10px] font-black rounded-lg shadow-lg">LVL 1</div>
             <div className="text-[var(--color-gold)]/60 text-[9px] font-bold uppercase tracking-widest mt-1">Player Rank</div>
          </div>

          <div className="relative h-full flex items-center p-8 gap-6">
            <div className="relative">
              <div className="w-24 h-24 bg-black/40 rounded-3xl border-2 border-[var(--color-gold)] p-3 shadow-[0_0_30px_rgba(212,175,55,0.2)] overflow-hidden">
                {avatar.startsWith('http') ? (
                  <img src={avatar} className="w-full h-full object-contain" alt="Preview Avatar" />
                ) : (
                  <span className="text-5xl flex items-center justify-center h-full">{avatar}</span>
                )}
              </div>
              <div className="absolute -bottom-2 -left-2 bg-[var(--color-gold)] w-5 h-5 rounded-full border-4 border-[#1a1a2e] shadow-lg" />
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-2xl font-black text-white tracking-tight leading-none truncate max-w-[200px]">
                {name || "لاعب جديد"}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl">{selectedCountry?.flag}</span>
                <span className="text-white/40 text-xs font-bold">{selectedCountry?.name}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5 w-fit">
                <ShieldCheck className="w-3 h-3 text-[var(--color-gold)]" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{initialData?.searchId || "ID: PREVIEW"}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs Control */}
        <div className="flex p-1.5 bg-white/5 rounded-2xl border border-white/5">
          <button 
            onClick={() => setActiveTab("info")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'info' ? 'bg-[var(--color-gold)] text-black shadow-lg' : 'text-white/40 hover:text-white/60'}`}
          >
            <User className="w-4 h-4" /> المعلومات الشخصية
          </button>
          <button 
            onClick={() => setActiveTab("avatar")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'avatar' ? 'bg-[var(--color-gold)] text-black shadow-lg' : 'text-white/40 hover:text-white/60'}`}
          >
            <Palette className="w-4 h-4" /> اختيار الشخصية
          </button>
        </div>

        {/* Content Section */}
        <AnimatePresence mode="wait">
          {activeTab === "info" ? (
            <motion.div 
              key="info"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-5">
                <div className="group">
                  <label className="block text-white/40 text-[10px] font-black mb-2 px-1 uppercase tracking-widest transition-colors group-focus-within:text-[var(--color-gold)]">الاسم المستعار (NickName)</label>
                  <div className="relative">
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10 group-focus-within:text-[var(--color-gold)]" />
                    <input 
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-6 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:border-[var(--color-gold)] focus:bg-white/10 transition-all placeholder:text-white/10"
                      placeholder="كيف نحب أن نناديك؟"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/40 text-[10px] font-black mb-2 px-1 uppercase tracking-widest">البلد</label>
                    <div className="relative">
                      <select 
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:border-[var(--color-gold)] appearance-none cursor-pointer"
                      >
                        {COUNTRIES.map(c => (
                          <option key={c.code} value={c.code} className="bg-[#1a1a2e]">{c.flag} {c.name}</option>
                        ))}
                      </select>
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20">▼</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-white/40 text-[10px] font-black mb-2 px-1 uppercase tracking-widest">الجنس</label>
                    <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 h-[58px]">
                      <button 
                        type="button"
                        onClick={() => setGender("male")}
                        className={`flex-1 rounded-[12px] text-xs font-black transition-all ${gender === 'male' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/30'}`}
                      >
                        ذكر
                      </button>
                      <button 
                        type="button"
                        onClick={() => setGender("female")}
                        className={`flex-1 rounded-[12px] text-xs font-black transition-all ${gender === 'female' ? 'bg-pink-600 text-white shadow-lg' : 'text-white/30'}`}
                      >
                        أنثى
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="avatar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between px-1">
                <h4 className="text-white/40 text-[10px] font-black uppercase tracking-widest">اختر مظهرك الفريد</h4>
                <button 
                  type="button"
                  onClick={() => setAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)])}
                  className="flex items-center gap-1.5 text-[10px] font-black text-[var(--color-gold)] hover:brightness-125 transition-all"
                >
                  <Sparkles className="w-3 h-3" /> عشوائي
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-[32px] p-4 max-h-[360px] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-4 gap-4">
                  {AVATARS.map(av => (
                    <button 
                      key={av}
                      type="button"
                      onClick={() => setAvatar(av)}
                      className={`aspect-square p-2 rounded-2xl transition-all relative group flex items-center justify-center overflow-hidden border-2 ${avatar === av ? 'bg-[var(--color-gold)]/20 border-[var(--color-gold)] shadow-[0_0_20px_rgba(212,175,55,0.3)]' : 'bg-black/20 border-transparent hover:bg-black/40'}`}
                    >
                      {av.startsWith('http') ? (
                        <img src={av} alt="Avatar" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-3xl">{av}</span>
                      )}
                      {avatar === av && (
                        <div className="absolute top-1 right-1 bg-[var(--color-gold)] text-black p-0.5 rounded-full shadow-lg">
                           <Check className="w-2.5 h-2.5 stroke-[4]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        <div className="pt-4">
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-5 bg-gradient-to-r from-[var(--color-gold)] to-yellow-400 text-black font-black text-xl rounded-2xl shadow-[0_15px_30px_rgba(212,175,55,0.2)] active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-3 relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/30 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
            {loading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-4 border-black/30 border-t-black"></div>
            ) : (
              <>
                <Check className="w-6 h-6 border-2 border-black rounded-lg" />
                <span>{initialData ? "تحديث التعديلات" : "تأكيد واستمرار"}</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="text-center text-red-500 text-xs font-black uppercase tracking-widest">{error}</p>
        )}
      </div>
    </div>
  );
}

