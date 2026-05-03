import { useState } from "react";
import { initGame, G, updateUI } from "../logic/engine";
import { Settings, Play, Users, Target, BrainCircuit, ArrowRight, Dices } from "lucide-react";

const RANDOM_NAMES = ["طارق", "سعيد", "سالم", "عمر", "خالد", "أحمد", "يوسف", "علي", "محمود", "حسن", "فهد"];

export function SetupScreen() {
  const [name, setName] = useState("البطل");
  const [target, setTarget] = useState("51");
  const [diff, setDiff] = useState<"easy" | "medium" | "hard">("medium");
  const [aiNames, setAiNames] = useState<string[]>(["", "", ""]);

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
      
      <div className="flex-1 flex flex-col w-full max-w-md mx-auto relative z-10 p-4">
        
        {/* Header Content */}
        <div className="flex items-center justify-between mb-8 pt-2">
            <button 
              onClick={() => { G.phase = "intro"; updateUI(); }}
              className="p-2 bg-white/5 text-white/70 hover:text-white rounded-xl border border-white/5 active:scale-95 transition-all"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
                <Settings className="w-6 h-6 text-[var(--color-gold)]" />
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-l from-[var(--color-gold)] to-[#ffe699] tracking-wider drop-shadow-sm">اللعب المحلي</h2>
            </div>
            <div className="w-10" /> {/* Balancer */}
        </div>

        <div className="bg-gradient-to-b from-black/60 to-black/40 p-6 rounded-[32px] border border-[var(--color-gold)]/20 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-md text-right relative overflow-hidden mt-4">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-50" />
            
            <div className="mb-6">
                <label className="text-white/70 text-xs font-bold mb-2 flex items-center gap-2 uppercase tracking-wide">
                    <Users className="w-4 h-4 text-[#888]" /> اسمك
                </label>
                <input 
                  className="w-full p-4 rounded-2xl border border-[var(--color-gold)]/20 bg-black/50 text-white text-base focus:outline-none focus:border-[var(--color-gold)] transition-all shadow-inner" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="أدخل اسمك" 
                />
            </div>

            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white/70 text-xs font-bold flex items-center gap-2 uppercase tracking-wide">
                      <BrainCircuit className="w-4 h-4 text-[#888]" /> أسماء الخصوم
                  </label>
                  <button 
                    className="text-[10px] bg-[var(--color-gold)]/10 text-[var(--color-gold)] px-2.5 py-1 rounded-lg hover:bg-[var(--color-gold)]/20 transition-colors border border-[var(--color-gold)]/20 flex items-center gap-1 font-bold"
                    onClick={randomizeAiNames}
                  >
                    <Dices className="w-3 h-3" /> عشوائي
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input 
                    className="w-full p-3 rounded-2xl border border-white/5 bg-white/5 text-white text-xs text-center focus:outline-none focus:border-[var(--color-gold)]/30 transition-all font-bold" 
                    value={aiNames[0]} 
                    onChange={(e) => updateAiName(0, e.target.value)} 
                    placeholder="كمبيوتر 1" 
                  />
                  <input 
                    className="w-full p-3 rounded-2xl border border-white/5 bg-white/5 text-white text-xs text-center focus:outline-none focus:border-[var(--color-gold)]/30 transition-all font-bold" 
                    value={aiNames[1]} 
                    onChange={(e) => updateAiName(1, e.target.value)} 
                    placeholder="كمبيوتر 2" 
                  />
                  <input 
                    className="w-full p-3 rounded-2xl border border-white/5 bg-white/5 text-white text-xs text-center focus:outline-none focus:border-[var(--color-gold)]/30 transition-all font-bold" 
                    value={aiNames[2]} 
                    onChange={(e) => updateAiName(2, e.target.value)} 
                    placeholder="كمبيوتر 3" 
                  />
                </div>
            </div>

            <div className="mb-6">
                <label className="text-white/70 text-xs font-bold mb-2 flex items-center gap-2 uppercase tracking-wide">
                    <Target className="w-4 h-4 text-[#888]" /> هدف النقاط
                </label>
                <div className="flex gap-2">
                  {[["31", "31 نقطة"], ["51", "51 نقطة"], ["101", "101 نقطة"]].map(([val, label]) => (
                    <button 
                      key={val}
                      onClick={() => setTarget(val)}
                      className={`flex-1 py-3 rounded-2xl text-xs font-black transition-all border ${target === val ? 'bg-[var(--color-gold)] text-black border-[var(--color-gold)] shadow-md' : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
            </div>

            <div className="mb-8">
                <label className="text-white/70 text-xs font-bold mb-2 flex items-center gap-2 uppercase tracking-wide">
                    <Settings className="w-4 h-4 text-[#888]" /> مستوى الذكاء الاصطناعي
                </label>
                <div className="flex gap-2">
                  <button 
                    className={`flex-1 py-3 rounded-2xl border text-xs transition-all ${diff === 'easy' ? 'bg-[var(--color-gold)] text-black border-[var(--color-gold)] font-black shadow-md' : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 font-bold'}`}
                    onClick={() => setDiff('easy')}
                  >
                    😊 سهل
                  </button>
                  <button 
                    className={`flex-1 py-3 rounded-2xl border text-xs transition-all ${diff === 'medium' ? 'bg-[var(--color-gold)] text-black border-[var(--color-gold)] font-black shadow-md' : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 font-bold'}`}
                    onClick={() => setDiff('medium')}
                  >
                    🤔 متوسط
                  </button>
                  <button 
                    className={`flex-1 py-3 rounded-2xl border text-xs transition-all ${diff === 'hard' ? 'bg-[var(--color-gold)] text-black border-[var(--color-gold)] font-black shadow-md' : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 font-bold'}`}
                    onClick={() => setDiff('hard')}
                  >
                    💀 صعب
                  </button>
                </div>
            </div>

            <button 
              className="w-full py-4 bg-gradient-to-b from-[#fceabb] to-[#f8b500] text-black rounded-2xl font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_5px_20px_rgba(248,181,0,0.4)] flex justify-center items-center gap-2"
              onClick={() => {
                initGame(name, parseInt(target), diff, aiNames.map((n, i) => n || `كمبيوتر ${i+1}`));
              }}
            >
              <Play className="w-6 h-6 fill-black" />
              ابدأ اللعب
            </button>
        </div>
      </div>
    </div>
  );
}
