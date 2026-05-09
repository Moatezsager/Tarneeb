import { useState, useEffect } from "react";
import { initGame, G, updateUI } from "../logic/engine";
import { getLocalProfile } from "../logic/userProfile";
import { Settings, Play, Users, Target, BrainCircuit, ArrowRight, Dices, Sparkles, User, Swords, Smile, Brain, Flame } from "lucide-react";
import { motion } from "motion/react";

const RANDOM_NAMES = ["طارق", "سعيد", "سالم", "عمر", "خالد", "أحمد", "يوسف", "علي", "محمود", "حسن", "فهد"];

export function SetupScreen() {
  const profile = getLocalProfile();
  const [name, setName] = useState(profile?.name || "البطل");
  const [target, setTarget] = useState("51");
  const [diff, setDiff] = useState<"easy" | "medium" | "hard">("medium");
  const [mode, setMode] = useState<"FFA" | "Teams" | "1v1">("FFA");
  const [aiNames, setAiNames] = useState<string[]>(["", "", ""]);

  useEffect(() => {
     // If profile name changes, update it here once if it was default
     if (profile?.name && name === "البطل") {
        setName(profile.name);
     }
  }, [profile]);

  useEffect(() => {
     // Randomize AI names on load
     randomizeAiNames();
  }, []);

  const randomizeAiNames = () => {
    let shuffled = [...RANDOM_NAMES].sort(() => 0.5 - Math.random());
    setAiNames([shuffled[0], shuffled[1], shuffled[2]]);
  };

  const updateAiName = (index: number, val: string) => {
    const newNames = [...aiNames];
    newNames[index] = val;
    setAiNames(newNames);
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0a0a0f] relative overflow-hidden" dir="rtl">
      {/* Decorative background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[var(--color-gold)] blur-[150px] opacity-10 rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--color-kuba)] blur-[120px] opacity-5 rounded-full" />
      
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto relative z-10 p-4">
        
        {/* Header Content */}
        <div className="flex items-center justify-between mb-8 pt-2">
            <button 
              onClick={() => { G.phase = "intro"; updateUI(); }}
              className="p-2.5 bg-white/5 text-white/70 hover:text-white rounded-2xl border border-white/5 active:scale-90 transition-all backdrop-blur-sm"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[var(--color-gold)] animate-pulse" />
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-l from-[var(--color-gold)] to-[#ffe699] tracking-wider drop-shadow-sm">اللعب المحلي</h2>
                </div>
                <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-0.5">تحدي الكمبيوتر</div>
            </div>
            <div className="w-12" /> {/* Balancer */}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-b from-[#161625] to-[#0f0f1c] p-6 rounded-[32px] border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl text-right relative overflow-hidden mt-2"
        >
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--color-gold)]/50 to-transparent opacity-30" />
            
            <div className="mb-6 relative group">
                <label className="text-white/50 text-[10px] font-black mb-2 flex items-center gap-2 uppercase tracking-widest mr-1">
                    <Users className="w-3.5 h-3.5 text-[var(--color-gold)]" /> اسم المحارب
                </label>
                <div className="relative">
                  <input 
                    className="w-full p-4.5 rounded-[20px] border border-white/10 bg-black/40 text-white text-base focus:outline-none focus:border-[var(--color-gold)]/50 focus:bg-black/60 transition-all shadow-inner font-bold placeholder:text-white/10" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="أدخل اسمك" 
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-xs italic pointer-events-none">أنت</div>
                </div>
            </div>

            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white/50 text-[10px] font-black flex items-center gap-2 uppercase tracking-widest mr-1">
                      <BrainCircuit className="w-3.5 h-3.5 text-[var(--color-gold)]" /> أسماء الخصوم
                  </label>
                  <button 
                    className="text-[10px] bg-[var(--color-gold)]/10 text-[var(--color-gold)] px-3 py-1.5 rounded-xl hover:bg-[var(--color-gold)]/20 transition-all border border-[var(--color-gold)]/20 flex items-center gap-1.5 font-black uppercase"
                    onClick={randomizeAiNames}
                  >
                    <Dices className="w-3.5 h-3.5" /> عشوائي
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[0, 1, 2].map(idx => {
                    const isDisabled = (mode === "1v1" && idx >= 1);
                    return (
                    <div key={idx} className={`relative group ${isDisabled ? 'opacity-30 pointer-events-none' : ''}`}>
                      <input 
                        className="w-full p-4 rounded-2xl border border-white/5 bg-white/5 text-white text-xs text-center focus:outline-none focus:border-[var(--color-gold)]/40 focus:bg-white/10 transition-all font-black placeholder:text-white/10" 
                        value={aiNames[idx]} 
                        onChange={(e) => updateAiName(idx, e.target.value)} 
                        placeholder={isDisabled ? "غير متاح" : `خصم ${idx+1}`}
                        disabled={isDisabled}
                      />
                    </div>
                  )})}
                </div>
            </div>

            <div className="mb-6">
                <label className="text-white/50 text-[10px] font-black mb-3 flex items-center gap-2 uppercase tracking-widest mr-1">
                    <Users className="w-3.5 h-3.5 text-[var(--color-gold)]" /> نظام اللعب
                </label>
                <div className="flex gap-2.5 bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                  {[
                    { val: "Teams", label: "فرق 2v2", icon: <Users className="w-5 h-5" /> },
                    { val: "FFA", label: "فردي", icon: <User className="w-5 h-5" /> },
                    { val: "1v1", label: "لعب ثنائي", icon: <Swords className="w-5 h-5" /> }
                  ].map(({val, label, icon}) => (
                    <button 
                      key={val}
                      onClick={() => setMode(val as "FFA" | "Teams" | "1v1")}
                      className={`flex-1 py-2.5 px-1 flex flex-col items-center gap-1 rounded-xl text-[10px] font-black transition-all ${mode === val ? 'bg-gradient-to-b from-[var(--color-gold)] to-yellow-600 text-black shadow-lg shadow-[var(--color-gold)]/20 scale-[1.03] z-10' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                    >
                      <span className="flex items-center justify-center p-1">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
            </div>

            <div className="mb-6">
                <label className="text-white/50 text-[10px] font-black mb-3 flex items-center gap-2 uppercase tracking-widest mr-1">
                    <Target className="w-3.5 h-3.5 text-[var(--color-gold)]" /> هدف النقاط
                </label>
                <div className="flex gap-2.5 bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                  {[["31", "31"], ["51", "51"], ["101", "101"]].map(([val, label]) => (
                    <button 
                      key={val}
                      onClick={() => setTarget(val)}
                      className={`flex-1 py-3 px-2 rounded-xl text-xs font-black transition-all ${target === val ? 'bg-gradient-to-b from-[var(--color-gold)] to-yellow-600 text-black shadow-lg shadow-[var(--color-gold)]/20 scale-[1.03] z-10' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                    >
                      {label} <span className="text-[10px] opacity-70">نقطة</span>
                    </button>
                  ))}
                </div>
            </div>

            <div className="mb-10">
                <label className="text-white/50 text-[10px] font-black mb-3 flex items-center gap-2 uppercase tracking-widest mr-1">
                    <Settings className="w-3.5 h-3.5 text-[var(--color-gold)]" /> مستوى الذكاء الاصطناعي
                </label>
                <div className="grid grid-cols-3 gap-2.5 p-1 bg-black/20 rounded-[22px]">
                  <button 
                    className={`py-3.5 rounded-[18px] text-[10px] font-black transition-all flex flex-col items-center gap-1 ${diff === 'easy' ? 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40 shadow-lg' : 'text-white/30 border border-transparent'}`}
                    onClick={() => setDiff('easy')}
                  >
                    <Smile className={`w-5 h-5 mb-1 ${diff === 'easy' ? 'text-[#22c55e]' : 'opacity-50'}`} />
                    سهل
                  </button>
                  <button 
                    className={`py-3.5 rounded-[18px] text-[10px] font-black transition-all flex flex-col items-center gap-1 ${diff === 'medium' ? 'bg-[var(--color-gold)]/20 text-[var(--color-gold)] border border-[var(--color-gold)]/40 shadow-lg' : 'text-white/30 border border-transparent'}`}
                    onClick={() => setDiff('medium')}
                  >
                    <Brain className={`w-5 h-5 mb-1 ${diff === 'medium' ? 'text-[var(--color-gold)]' : 'opacity-50'}`} />
                    متوسط
                  </button>
                  <button 
                    className={`py-3.5 rounded-[18px] text-[10px] font-black transition-all flex flex-col items-center gap-1 ${diff === 'hard' ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-lg' : 'text-white/30 border border-transparent'}`}
                    onClick={() => setDiff('hard')}
                  >
                    <Flame className={`w-5 h-5 mb-1 ${diff === 'hard' ? 'text-red-400' : 'opacity-50'}`} />
                    صعب
                  </button>
                </div>
            </div>

            <button 
              className="w-full py-4.5 bg-gradient-to-b from-[#fceabb] to-[#f8b500] text-black rounded-[22px] font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.96] shadow-[0_15px_40px_rgba(248,181,0,0.3)] flex justify-center items-center gap-3 relative group overflow-hidden"
              onClick={() => {
                initGame(name, parseInt(target), diff, aiNames.map((n, i) => n || `كمبيوتر ${i+1}`), mode);
              }}
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
              <Play className="w-7 h-7 fill-black translate-y-[1px]" />
              <span className="translate-y-[1px]">ابدأ المعركة</span>
            </button>
        </motion.div>
        
        <div className="mt-auto py-6 text-center">
            <p className="text-white/10 text-[9px] font-black uppercase tracking-[0.3em]">Tarneb Hero • v2.0</p>
        </div>
      </div>
    </div>
  );
}
