import React, { useState } from "react";
import { UserProfile, COUNTRIES, AVATARS, saveUserProfile, generateSearchId, isSearchIdUnique } from "../logic/userProfile";
import { auth } from "../lib/firebase";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
       setError("يرجى إدخال الاسم");
       return;
    }
    if (!auth.currentUser) return;

    setLoading(true);
    setError("");

    let finalSearchId = initialData?.searchId;
    if (!finalSearchId) {
      setError("جاري إنشاء معرّف فريد...");
      let unique = false;
      let attempts = 0;
      while (!unique && attempts < 5) {
        finalSearchId = generateSearchId();
        unique = await isSearchIdUnique(finalSearchId);
        attempts++;
      }
      if (!unique) {
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
    <div className="flex flex-col items-center justify-center min-h-screen p-5 bg-[#11111a] text-center" dir="rtl">
      <div className="w-full max-w-[450px] p-8 bg-[#1a1a2e] border border-[var(--color-gold)] rounded-3xl shadow-2xl">
        <h2 className="text-3xl font-black text-[var(--color-gold)] mb-2 font-[var(--font-tajawal)]">إعداد الملف الشخصي</h2>
        <p className="text-[#888] mb-8 text-sm">أضف بياناتك لتتمكن من المنافسة مع الأصدقاء</p>

        {error && <div className="p-3 mb-4 bg-red-900/20 text-red-500 rounded-xl text-sm border border-red-500/20">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6 text-right">
          {initialData?.searchId && (
            <div className="p-4 bg-black/40 border border-[var(--color-gold)]/20 rounded-2xl text-center">
              <label className="block text-[var(--color-gold)] text-[10px] font-black mb-1 uppercase tracking-widest">معرّف البحث الخاص بك</label>
              <div className="text-white font-mono text-xl tracking-widest">{initialData.searchId}</div>
              <p className="text-[#555] text-[9px] mt-1 font-bold">شارك هذا المعرف مع أصدقائك ليتمكنوا من إضافتك</p>
            </div>
          )}

          {!initialData && (
            <div className="p-4 bg-[var(--color-gold)]/5 border border-dashed border-[var(--color-gold)]/20 rounded-2xl text-center">
              <p className="text-[var(--color-gold)] text-xs font-bold italic">سيتم إنشاء "معرّف بحث" فريد لك تلقائياً عند الحفظ</p>
            </div>
          )}

          <div>
            <label className="block text-[#888] text-xs font-bold mb-2 mr-2">الاسم</label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-4 bg-black/40 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-[var(--color-gold)]"
              placeholder="ادخل اسمك هنا..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#888] text-xs font-bold mb-2 mr-2">البلد</label>
              <select 
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full p-4 bg-black/40 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-[var(--color-gold)] appearance-none"
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#888] text-xs font-bold mb-2 mr-2">الجنس</label>
              <div className="flex bg-black/40 border border-white/10 rounded-2xl p-1">
                <button 
                  type="button"
                  onClick={() => setGender("male")}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${gender === 'male' ? 'bg-[var(--color-gold)] text-black' : 'text-white'}`}
                >
                  ذكر
                </button>
                <button 
                  type="button"
                  onClick={() => setGender("female")}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${gender === 'female' ? 'bg-[var(--color-gold)] text-black' : 'text-white'}`}
                >
                  أنثى
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[#888] text-xs font-bold mb-2 mr-2">اختر شخصيتك (Avatar)</label>
            <div className="grid grid-cols-4 gap-3 bg-black/40 border border-white/10 rounded-2xl p-4 max-h-[160px] overflow-y-auto custom-scrollbar">
              {AVATARS.map(av => (
                <button 
                  key={av}
                  type="button"
                  onClick={() => setAvatar(av)}
                  className={`text-3xl p-2 rounded-xl transition-all ${avatar === av ? 'bg-[var(--color-gold)] scale-110 shadow-lg' : 'hover:bg-white/5 active:scale-90'}`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-4 bg-gradient-to-b from-[#f9e698] to-[#aa8d2e] text-black font-black text-xl rounded-full shadow-[0_5px_15px_rgba(212,175,55,0.4)] active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? "جاري الحفظ..." : "حفظ والمتابعة"}
          </button>
        </form>
      </div>
    </div>
  );
}
