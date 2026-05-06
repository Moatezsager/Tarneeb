import React from "react";
import { X, Volume2, VolumeX, ShieldCheck, Info, Bell, Languages, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { G, updateUI } from "../logic/engine";
import { auth } from "../lib/firebase";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [muted, setMuted] = React.useState(G.isMuted);

  const toggleMute = () => {
    const newVal = !muted;
    setMuted(newVal);
    G.isMuted = newVal;
    localStorage.setItem('muted', newVal ? 'true' : 'false');
    updateUI();
  };

  const handleLogout = async () => {
    if (confirm("هل أنت متأكد من تسجيل الخروج؟")) {
      await auth.signOut();
      window.location.reload();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-[#1a1a2e] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-[var(--color-gold)]/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[var(--color-gold)]/20 rounded-xl">
                  <ShieldCheck className="w-6 h-6 text-[var(--color-gold)]" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">إعدادات اللعبة</h2>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Game Preferences</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Sound Section */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">الصوت والموسيقى</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={toggleMute}
                    className={`flex items-center justify-between p-4 rounded-2xl transition-all border ${
                      !muted 
                        ? 'bg-[var(--color-gold)]/10 border-[var(--color-gold)]/30 text-white' 
                        : 'bg-white/5 border-white/5 text-white/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      <span className="font-bold">مؤثرات الصوت</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${!muted ? 'bg-[var(--color-gold)]' : 'bg-white/20'}`}>
                      <motion.div 
                        animate={{ x: !muted ? 20 : 2 }}
                        className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-lg" 
                      />
                    </div>
                  </button>
                </div>
              </div>

              {/* General Section */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">عام</label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 text-white/40 cursor-not-allowed opacity-50">
                    <div className="flex items-center gap-3">
                      <Languages className="w-5 h-5" />
                      <span className="font-bold">اللغة العربية</span>
                    </div>
                    <span className="text-[10px] font-black opacity-50">قريباً</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 text-white/40 cursor-not-allowed opacity-50">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5" />
                      <span className="font-bold">التنبيهات</span>
                    </div>
                    <span className="text-[10px] font-black opacity-50">قريباً</span>
                  </div>
                </div>
              </div>

              {/* About Section */}
              <div className="p-4 bg-black/20 rounded-2xl border border-white/5 flex items-start gap-3">
                <Info className="w-5 h-5 text-[var(--color-gold)] shrink-0 mt-0.5" />
                <div className="text-right">
                  <p className="text-xs text-white/60 leading-relaxed font-medium">
                    هذه اللعبة هي تجربة اجتماعية تفاعلية. تأكد من اتباع قواعد اللعب النظيف واحترام الآخرين.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-black/40 border-t border-white/5">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 font-black hover:bg-red-500 hover:text-white transition-all group"
              >
                <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                تسجيل الخروج
              </button>
              <p className="text-center mt-4 text-[9px] font-black text-white/20 uppercase tracking-widest">Version 1.2.0 - Stable</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
