import { useState } from "react";
import { initGame, G, updateUI } from "../logic/engine";

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
    <div className="flex items-center justify-center min-h-screen p-5">
      <div className="max-w-[400px] w-full mx-auto p-5 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-gold)] max-h-[90vh] overflow-y-auto">
        <h2 className="text-center text-[var(--color-gold)] mb-3 text-lg font-black font-[var(--font-tajawal)]">⚙️ إعدادات اللعبة</h2>
        
        <label className="text-[#ccc] text-xs block mb-1.5 font-bold">👤 اسمك</label>
        <input 
          className="w-full p-2.5 mb-4 rounded-lg border border-[var(--color-gold)]/30 bg-[#1a1a2e] text-white text-sm focus:outline-none focus:border-[var(--color-gold)] transition-colors" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="أدخل اسمك" 
        />

        <div className="flex justify-between items-center mb-1.5">
          <label className="text-[#ccc] text-xs font-bold">🤖 أسماء الخصوم</label>
          <button 
            className="text-[0.65rem] bg-[var(--color-gold)]/20 text-[var(--color-gold)] px-2 py-0.5 rounded hover:bg-[var(--color-gold)]/40 transition-colors border border-[var(--color-gold)]/30"
            onClick={randomizeAiNames}
          >
            🎲 عشوائي
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <input 
            className="w-full p-2 rounded-lg border border-[#333] bg-[#1a1a2e] text-white text-xs text-center focus:outline-none focus:border-[var(--color-gold)]/50" 
            value={aiNames[0]} 
            onChange={(e) => updateAiName(0, e.target.value)} 
            placeholder="كمبيوتر 1" 
          />
          <input 
            className="w-full p-2 rounded-lg border border-[#333] bg-[#1a1a2e] text-white text-xs text-center focus:outline-none focus:border-[var(--color-gold)]/50" 
            value={aiNames[1]} 
            onChange={(e) => updateAiName(1, e.target.value)} 
            placeholder="كمبيوتر 2" 
          />
          <input 
            className="w-full p-2 rounded-lg border border-[#333] bg-[#1a1a2e] text-white text-xs text-center focus:outline-none focus:border-[var(--color-gold)]/50" 
            value={aiNames[2]} 
            onChange={(e) => updateAiName(2, e.target.value)} 
            placeholder="كمبيوتر 3" 
          />
        </div>

        <label className="text-[#ccc] text-xs block mb-1.5 font-bold">🎯 هدف النقاط</label>
        <select 
          className="w-full p-2.5 mb-4 rounded-lg border border-[#333] bg-[#1a1a2e] text-white text-sm focus:outline-none focus:border-[var(--color-gold)]/50"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="31">31 نقطة</option>
          <option value="51">51 نقطة</option>
          <option value="101">101 نقطة</option>
        </select>

        <label className="text-[#ccc] text-xs block mb-1.5 font-bold">🧠 مستوى الكمبيوتر</label>
        <div className="flex gap-1.5 mb-5">
          <button 
            className={`flex-1 p-2 rounded-lg border text-xs transition-all ${diff === 'easy' ? 'bg-[var(--color-gold)] text-black border-[var(--color-gold)] font-bold shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'border-white/10 bg-black/40 text-[#888] hover:bg-white/5'}`}
            onClick={() => setDiff('easy')}
          >
            😊 سهل
          </button>
          <button 
            className={`flex-1 p-2 rounded-lg border text-xs transition-all ${diff === 'medium' ? 'bg-[var(--color-gold)] text-black border-[var(--color-gold)] font-bold shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'border-white/10 bg-black/40 text-[#888] hover:bg-white/5'}`}
            onClick={() => setDiff('medium')}
          >
            🤔 متوسط
          </button>
          <button 
            className={`flex-1 p-2 rounded-lg border text-xs transition-all ${diff === 'hard' ? 'bg-[var(--color-gold)] text-black border-[var(--color-gold)] font-bold shadow-[0_0_10px_rgba(212,175,55,0.3)]' : 'border-white/10 bg-black/40 text-[#888] hover:bg-white/5'}`}
            onClick={() => setDiff('hard')}
          >
            💀 صعب
          </button>
        </div>

        <button 
          className="w-full py-3 bg-gradient-to-b from-[#f9e698] to-[#aa8d2e] text-black rounded-full font-black text-base transition-transform hover:scale-105 active:scale-95 shadow-[0_5px_15px_rgba(212,175,55,0.4)]"
          onClick={() => initGame(name, parseInt(target), diff, aiNames)}
        >
          🔥 ابدأ التحدي
        </button>
        
        <button 
          className="w-full py-2.5 mt-3 bg-[#222] border border-[#444] text-white rounded-full font-bold text-sm transition-colors hover:bg-[#333] active:scale-95"
          onClick={() => {
            G.phase = 'intro';
            updateUI();
          }}
        >
          ↩ رجوع
        </button>
      </div>
    </div>
  );
}
