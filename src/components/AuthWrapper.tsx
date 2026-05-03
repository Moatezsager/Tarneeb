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
      <div className="flex flex-col items-center justify-center min-h-screen p-5 bg-[#11111a] text-center">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--color-gold)] blur-[120px] opacity-10 rounded-full" />
        <div className="z-10 w-full max-w-[400px] p-8 bg-[#1a1a2e] border border-[var(--color-gold)] rounded-3xl shadow-2xl">
          <div className="text-6xl mb-6 drop-shadow-md">🂡</div>
          <h2 className="text-3xl font-black text-[var(--color-gold)] mb-4 font-[var(--font-tajawal)]">طرنيب Pro</h2>
          <p className="text-[#aaa] mb-8 font-medium">الرجاء تسجيل الدخول للانضمام إلى عالم الطرنيب</p>
          
          {error && <div className="p-3 mb-4 bg-red-900/20 text-red-500 rounded-xl text-sm border border-red-500/20">{error}</div>}

          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-white text-black font-bold rounded-full flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-xl"
          >
             <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
             تسجيل الدخول باستخدام Google
          </button>
          
          <p className="text-[#555] mt-8 text-xs font-bold uppercase tracking-widest">المتعة والاحترافية</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <ProfileSetupScreen onComplete={onProfileComplete} />;
  }

  return <>{children}</>;
}
