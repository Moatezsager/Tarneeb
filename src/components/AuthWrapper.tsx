import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, signInWithPopup, googleProvider } from "../lib/firebase";
import { fetchAndSetLocalProfile, UserProfile, clearLocalProfile } from "../logic/userProfile";
import { ProfileSetupScreen } from "./ProfileSetupScreen";

interface Props {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: Props) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const p = await fetchAndSetLocalProfile(u.uid);
        setProfile(p);
      } else {
        setProfile(null);
        clearLocalProfile();
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const onProfileComplete = async () => {
    if (user) {
      const p = await fetchAndSetLocalProfile(user.uid);
      setProfile(p);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#11111a]">
        <div className="w-12 h-12 border-4 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin"></div>
        <div className="text-[var(--color-gold)] mt-4 font-bold font-[var(--font-tajawal)]">جاري التحميل...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 bg-[#11111a] text-center relative overflow-hidden" dir="rtl">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[var(--color-gold)] blur-[120px] opacity-10 rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[var(--color-kuba)] blur-[120px] opacity-10 rounded-full" />
        
        <div className="z-10 w-full max-w-[400px] p-6 sm:p-8 bg-[#1a1a2e]/80 backdrop-blur-xl border border-[var(--color-gold)]/20 rounded-3xl shadow-2xl flex flex-col items-center">
          <div className="text-7xl sm:text-8xl mb-4 drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]">🂡</div>
          <h2 className="text-4xl sm:text-5xl font-black text-[var(--color-gold)] mb-3 font-[var(--font-tajawal)] drop-shadow-lg">طرنيب</h2>
          <div className="bg-[var(--color-gold)]/10 text-[var(--color-gold)] px-3 py-1 rounded-full text-xs font-bold mb-4 border border-[var(--color-gold)]/30">مجانية لمدى الحياة ✨</div>
          <p className="text-[#bbb] mb-8 font-medium text-sm sm:text-base leading-relaxed px-2">العب واستمتع مع أصدقائك بدون قيود أو اشتراكات</p>
          
          {error && (
            <div className="w-full p-4 mb-6 bg-red-900/30 text-red-300 rounded-2xl text-xs sm:text-sm border border-red-500/20 leading-relaxed font-medium">
              {error.includes("auth/unauthorized-domain") 
                ? "يبدو أنك تستخدم رابطاً جديداً. لحماية حسابك، يجب إضافة رابط الموقع إلى إعدادات Firebase (Authorized Domains)." 
                : error}
            </div>
          )}

          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-3 active:scale-[0.97] transition-all shadow-[0_5px_20px_rgba(255,255,255,0.15)] hover:bg-gray-100 text-sm sm:text-base"
          >
             <img src="https://www.google.com/favicon.ico" className="w-5 h-5 sm:w-6 sm:h-6" alt="Google" referrerPolicy="no-referrer" />
             تسجيل الدخول باستخدام Google
          </button>
          
          <p className="text-[#555] mt-6 sm:mt-8 text-[10px] sm:text-xs font-bold tracking-widest opacity-80">اللعبة ستظل مجانية بنسبة 100%</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <ProfileSetupScreen onComplete={onProfileComplete} />;
  }

  return <>{children}</>;
}
