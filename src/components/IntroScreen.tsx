import { initAudio } from "../lib/audio";
import { G, updateUI } from "../logic/engine";

export function IntroScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 text-center bg-gradient-to-b from-[#11111a] to-[#1a1a2e] relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--color-gold)] blur-[100px] opacity-10 rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--color-kuba)] blur-[100px] opacity-10 rounded-full" />
      
      <div className="z-10 flex flex-col items-center">
        <div className="text-6xl md:text-8xl mb-2 md:mb-4 drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]">🂡</div>
        <div className="text-5xl xs:text-6xl md:text-8xl font-black golden-text font-[var(--font-tajawal)] drop-shadow-xl" style={{textShadow: "0 4px 20px rgba(212,175,55,0.4)"}}>طرنت</div>
        <div className="font-[var(--font-tajawal)] tracking-[8px] text-[var(--color-gold)] opacity-90 text-sm md:text-xl mt-1 md:mt-2 font-bold uppercase">
          Libya Pro
        </div>
        
        <div className="flex gap-2 items-center my-4 md:my-6">
          <span className="bg-black/40 border border-[var(--color-gold)]/30 text-[var(--color-gold)] px-4 py-1.5 rounded-full text-xs md:text-sm font-bold shadow-sm backdrop-blur-sm">
            ✨ الإصدار 3.0
          </span>
          <span className="bg-[var(--color-kuba)]/20 border border-[var(--color-kuba)]/40 text-[var(--color-kuba)] px-4 py-1.5 rounded-full text-xs md:text-sm font-bold shadow-sm backdrop-blur-sm">
            ♥ كبة حاكمة
          </span>
        </div>
        
        <p className="text-[#bbb] text-xs md:text-sm my-2 max-w-[320px] md:max-w-[400px] leading-relaxed font-medium">
          طاولة الجواكر • نظام الكنق • الذكاء الاصطناعي المتقدم والمزيد
        </p>
        
        <button 
          className="mt-8 px-10 py-3.5 md:px-14 md:py-4 text-lg md:text-xl bg-gradient-to-b from-[#fceabb] to-[#f8b500] text-black border-none rounded-full font-black cursor-pointer shadow-[0_5px_25px_rgba(248,181,0,0.4)] transition-all hover:scale-105 hover:shadow-[0_8px_30px_rgba(248,181,0,0.6)] active:scale-95 flex items-center gap-2"
          onClick={() => {
            initAudio();
            G.phase = 'setup';
            updateUI();
          }}
        >
          <span>دخول الغرفة</span>
          <span className="text-xl">🎲</span>
        </button>

        <button 
          className="mt-3 px-6 py-2 text-sm bg-black/40 border border-white/10 text-white rounded-full font-bold cursor-pointer transition-colors hover:bg-white/10 active:scale-95 flex items-center gap-2"
          onClick={() => {
            G.phase = 'stats';
            updateUI();
          }}
        >
          <span>الإحصائيات</span>
          <span className="text-base">📊</span>
        </button>
      </div>
    </div>
  );
}
