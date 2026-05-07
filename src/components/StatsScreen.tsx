import React, { useEffect, useState } from "react";
import { GameStats, getStats, resetStats } from "../logic/stats";
import { G, updateUI } from "../logic/engine";

export function StatsScreen() {
  const [stats, setStats] = useState<GameStats | null>(null);

  useEffect(() => {
    setStats(getStats());
  }, []);

  const handleReset = () => {
    if (confirm("هل أنت متأكد من تصفير الإحصائيات؟")) {
      resetStats();
      setStats(getStats());
    }
  };

  if (!stats) return null;

  const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;
  const avgScore = stats.totalGames > 0 ? Math.round(stats.totalScore / stats.totalGames) : 0;
  const showHighest = stats.highestScore > -Infinity ? stats.highestScore : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 text-center bg-[#11111a] relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--color-gold)] blur-[100px] opacity-10 rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--color-kuba)] blur-[100px] opacity-10 rounded-full" />
      
      <div className="z-10 w-full max-w-[400px] bg-[#1a1a2e] border border-[var(--color-gold)] p-6 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
        <div className="text-4xl xs:text-5xl mb-4 drop-shadow-[0_0_15px_rgba(212,175,55,0.4)] text-[var(--color-gold)]">📊</div>
        <h2 className="text-2xl font-black text-[var(--color-gold)] mb-6 font-[var(--font-tajawal)] drop-shadow-md">إحصائيات اللاعب</h2>
        
        <div className="grid grid-cols-2 gap-3 mb-6" dir="rtl">
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center">
            <span className="text-[#888] text-xs font-bold mb-1">الانتصارات</span>
            <span className="text-[#2ecc71] text-2xl font-black">{stats.wins}</span>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center">
            <span className="text-[#888] text-xs font-bold mb-1">الهزائم</span>
            <span className="text-[var(--color-kuba)] text-2xl font-black">{stats.losses}</span>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center">
            <span className="text-[#888] text-xs font-bold mb-1">نسبة الفوز</span>
            <span className="text-white text-xl font-bold">{winRate}%</span>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center">
            <span className="text-[#888] text-xs font-bold mb-1">متوسط النقاط</span>
            <span className="text-white text-xl font-bold">{avgScore}</span>
          </div>
          <div className="bg-black/40 border border-[#f9e698]/20 rounded-2xl p-4 flex flex-col items-center col-span-2">
            <span className="text-[var(--color-gold)] text-xs font-bold mb-1">أعلى نقاط (كاس)</span>
            <span className="text-[#f9e698] text-3xl font-black">{showHighest}</span>
          </div>
        </div>

        <div className="text-[#777] text-xs mb-6 font-bold">
          إجمالي المباريات الملعوبة: <span className="text-white">{stats.totalGames}</span>
        </div>

        {stats.playerStats && Object.keys(stats.playerStats).length > 0 && (
          <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 mb-6">
            <h3 className="text-sm font-bold text-[var(--color-gold)] mb-3 border-b border-white/10 pb-2 text-right" dir="rtl">تفاصيل اللاعبين خلال الجولات</h3>
            <div className="max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
              <table className="w-full text-xs text-right" dir="rtl">
                <thead>
                  <tr className="text-[#888]">
                    <th className="pb-2 text-right">اللاعب</th>
                    <th className="pb-2 text-center">جولات فاز بها</th>
                    <th className="pb-2 text-center">م. الأكلات/الجولة</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.playerStats || {})
                    .sort((a, b) => (b[1] as any).roundsWon - (a[1] as any).roundsWon)
                    .map(([name, pStats]: [string, any]) => (
                    <tr key={name} className="border-t border-white/5">
                      <td className="py-2 text-white font-bold truncate max-w-[80px]" title={name}>{name}</td>
                      <td className="py-2 text-[#2ecc71] font-black text-center">{pStats.roundsWon}</td>
                      <td className="py-2 text-white/80 font-bold text-center">
                        {pStats.totalRounds > 0 ? (pStats.totalTricks / pStats.totalRounds).toFixed(1) : "0.0"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        <div className="flex gap-2">
          <button 
            className="flex-1 py-3 bg-[#222] border border-[#444] text-white rounded-full font-bold text-sm transition-colors hover:bg-[#333] active:scale-95"
            onClick={() => {
              G.phase = "intro";
              updateUI();
            }}
          >
            رجوع
          </button>
          <button 
            className="px-6 py-3 bg-[var(--color-kuba)]/20 border border-[var(--color-kuba)]/40 text-[var(--color-kuba)] rounded-full font-bold text-sm transition-colors hover:bg-[var(--color-kuba)]/30 active:scale-95"
            onClick={handleReset}
          >
            تصفير
          </button>
        </div>
      </div>
    </div>
  );
}
