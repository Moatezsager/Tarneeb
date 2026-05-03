import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../logic/userProfile";
import { 
  FriendRequest, 
  listenToFriendRequests, 
  listenToSentRequests,
  listenToFriends, 
  searchUsers, 
  sendFriendRequest, 
  respondToFriendRequest,
  listenToAcceptedRequests,
  deleteFriendRequest
} from "../logic/social";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { UserProfileModal, formatLastSeen } from "./UserProfileModal";
import { Crown } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  myProfile: UserProfile | null;
}

// Sub-component to show live friend data
interface FriendCardProps {
  friend: UserProfile;
  onSelect: (u: UserProfile) => void;
  key?: React.Key;
}

function FriendCard({ friend, onSelect }: FriendCardProps) {
  const [liveProfile, setLiveProfile] = useState<UserProfile>(friend);

  useEffect(() => {
    // Fetch live profile to stay updated with name/avatar/lastSeen changes
    const unsub = onSnapshot(doc(db, "users", friend.uid), (doc) => {
      if (doc.exists()) {
        setLiveProfile({ ...doc.data(), uid: doc.id } as UserProfile);
      }
    });

    return () => unsub();
  }, [friend.uid]);

  const f = liveProfile;

  return (
    <div 
      className={`flex items-center justify-between p-4 ${f.searchId === '01' ? 'bg-gradient-to-r from-[var(--color-gold)]/10 to-white/5 border-[var(--color-gold)]/30' : 'bg-white/5 border-white/5'} rounded-2xl border cursor-pointer hover:bg-white/10 transition-colors shadow-lg`}
      onClick={() => onSelect(f)}
    >
      <div className="flex items-center gap-3">
        <div className={`relative ${f.searchId === '01' ? 'p-0.5 bg-gradient-to-tr from-[var(--color-gold)] to-yellow-200 rounded-xl' : ''}`}>
          <span className="text-3xl bg-black/40 p-2 rounded-xl block">{f.avatar}</span>
          {f.searchId === '01' && (
            <div className="absolute -top-2 -left-2 bg-[var(--color-gold)] p-0.5 rounded-full border-2 border-black">
              <Crown className="w-3 h-3 text-black fill-black" />
            </div>
          )}
        </div>
        <div className="text-right">
           <div className="flex items-center gap-1.5">
             <div className="text-white font-bold">{f.name}</div>
             {f.searchId === '01' && <Crown className="w-3.5 h-3.5 text-[var(--color-gold)]" />}
             <div className="text-[9px] text-white/30 font-mono tracking-tighter">#{f.searchId}</div>
           </div>
           <div className="flex items-center gap-1.5 mt-0.5">
             <div className={`w-2 h-2 rounded-full ${f.status === 'online' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-gray-600'}`}></div>
             <span className="text-[10px] text-white/40 font-bold uppercase">
               {f.status === 'online' ? 'متصل الآن' : formatLastSeen(f.lastSeen)}
             </span>
           </div>
        </div>
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          // Future: startChallenge(f);
        }}
        className="px-4 py-1.5 bg-[var(--color-gold)]/10 text-[var(--color-gold)] text-xs font-black rounded-lg border border-[var(--color-gold)]/20 hover:bg-[var(--color-gold)] hover:text-black transition-all"
      >
        تحدي
      </button>
    </div>
  );
}

export function SocialModal({ isOpen, onClose, myProfile }: Props) {
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "search">("friends");
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    const unsubFriends = listenToFriends(setFriends);
    const unsubRequests = listenToFriendRequests(setRequests);
    const unsubSent = listenToSentRequests(setSentRequests);
    
    return () => {
      unsubFriends();
      unsubRequests();
      unsubSent();
    };
  }, [isOpen]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    const results = await searchUsers(searchQuery.trim());
    setSearchResults(results.filter(u => u.uid !== auth.currentUser?.uid));
    setSearching(false);
  };

  const handleSendRequest = async (user: UserProfile) => {
    const success = await sendFriendRequest(user, myProfile);
    if (success) {
      // Results will naturally update status via the listeners
    }
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          dir="rtl"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-[450px] bg-[#1a1a2e] border border-[var(--color-gold)]/30 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="p-6 pb-2 flex justify-between items-center border-b border-white/5">
               <h3 className="text-2xl font-black text-[var(--color-gold)] font-[var(--font-tajawal)]">الاجتماعية</h3>
               <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex p-2 gap-1 bg-black/20 m-4 rounded-2xl">
               <button 
                 onClick={() => setActiveTab("friends")}
                 className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'friends' ? 'bg-[var(--color-gold)] text-black shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
               >
                 الأصدقاء ({friends.length})
               </button>
               <button 
                 onClick={() => setActiveTab("requests")}
                 className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative ${activeTab === 'requests' ? 'bg-[var(--color-gold)] text-black shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
               >
                 الطلبات
                 {requests.length > 0 && (
                   <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                 )}
               </button>
               <button 
                 onClick={() => setActiveTab("search")}
                 className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'search' ? 'bg-[var(--color-gold)] text-black shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
               >
                 بحث 🔍
               </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {activeTab === "friends" && (
                <div className="space-y-3">
                  {friends.length === 0 ? (
                    <div className="text-center py-10 text-white/30 italic">ليس لديك أصدقاء بعد. ابحث عنهم وأضفهم!</div>
                  ) : (
                    friends.map(f => (
                      <FriendCard key={f.uid} friend={f} onSelect={(u) => setSelectedUser(u)} />
                    ))
                  )}
                </div>
              )}

              {activeTab === "requests" && (
                <div className="space-y-3">
                  {requests.length === 0 ? (
                    <div className="text-center py-10 text-white/30 italic">لا توجد طلبات صداقة حالية</div>
                  ) : (
                    requests.map(r => (
                      <div key={r.id} className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3 mb-3">
                           <span className="text-3xl">{r.fromAvatar}</span>
                           <div className="text-right">
                             <div className="text-white font-bold">{r.fromName}</div>
                             <div className="text-[9px] text-white/30 font-mono">#{r.fromSearchId}</div>
                             <div className="text-[10px] text-white/40">يريد أن يكون صديقك</div>
                           </div>
                        </div>
                        <div className="flex gap-2">
                           <button 
                             onClick={() => respondToFriendRequest(r.id, 'accepted', r.fromUid, { name: r.fromName, avatar: r.fromAvatar, searchId: r.fromSearchId, status: 'online' })}
                             className="flex-1 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-500 transition-colors shadow-lg shadow-green-900/20"
                           >
                             قبول ✅
                           </button>
                           <button 
                             onClick={() => respondToFriendRequest(r.id, 'rejected', r.fromUid, null)}
                             className="flex-1 py-2 bg-red-600/20 text-red-500 text-xs font-bold rounded-xl hover:bg-red-600/30 transition-colors"
                           >
                             رفض ❌
                           </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "search" && (
                <div className="space-y-4">
                  <form onSubmit={handleSearch} className="relative">
                    <input 
                      type="text"
                      placeholder="ابحث بواسطة المعرف الرقمي (مثال: 12345678)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-4 bg-black/40 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-[var(--color-gold)]"
                    />
                    <button type="submit" className="absolute left-2 top-2 bottom-2 px-4 bg-[var(--color-gold)] text-black rounded-xl font-bold text-xs" disabled={searching}>
                      {searching ? "..." : "بحث"}
                    </button>
                  </form>

                  <div className="space-y-3">
                    {searchResults.length === 0 && searchQuery.trim() !== "" && !searching && (
                      <div className="text-center py-6 text-white/20 text-sm">لم يتم العثور على أي لاعب</div>
                    )}
                    {searchResults.map(u => {
                      const isFriend = friends.some(f => f.uid === u.uid);
                      const incomingRequest = requests.find(r => r.fromUid === u.uid);
                      const outgoingRequest = sentRequests.find(r => r.toUid === u.uid);

                      return (
                        <div 
                          key={u.uid} 
                          className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                          onClick={() => setSelectedUser(u)}
                        >
                           <div className="flex items-center gap-3">
                             <span className="text-3xl">{u.avatar}</span>
                             <div className="text-right">
                                <div className="text-white font-bold">{u.name}</div>
                                <div className="text-[10px] text-[var(--color-gold)] font-mono">{u.searchId}</div>
                             </div>
                           </div>
                           
                           {isFriend ? (
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] text-green-500 font-bold bg-green-500/10 px-2 py-1 rounded-lg">صديق</span>
                             </div>
                           ) : incomingRequest ? (
                             <div className="flex gap-1.5">
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   respondToFriendRequest(incomingRequest.id, 'accepted', u.uid, { name: u.name, avatar: u.avatar, searchId: u.searchId, status: 'online' });
                                 }}
                                 className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-bold rounded-lg"
                               >
                                 قبول
                               </button>
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   respondToFriendRequest(incomingRequest.id, 'rejected', u.uid, null);
                                 }}
                                 className="px-3 py-1.5 bg-red-600/20 text-red-500 text-[10px] font-bold rounded-lg"
                               >
                                 رفض
                               </button>
                             </div>
                           ) : outgoingRequest ? (
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] text-white/40 font-bold italic">قيد الانتظار</span>
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   deleteFriendRequest(outgoingRequest.id);
                                 }}
                                 className="text-[10px] text-red-500 bg-red-500/10 px-2 py-1 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                               >
                                 إلغاء
                               </button>
                             </div>
                           ) : (
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleSendRequest(u);
                               }}
                               className="p-2.5 bg-[var(--color-gold)] text-black rounded-xl hover:scale-105 active:scale-95 transition-all"
                               title="إضافة صديق"
                             >
                               ➕
                             </button>
                           )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="p-4 bg-black/40 rounded-2xl text-right">
                    <div className="text-[var(--color-gold)] text-xs font-black mb-1">المعرف الخاص بك (Search ID)</div>
                    <div className="text-white font-mono text-lg tracking-wider flex items-center justify-between">
                       <span>{myProfile?.searchId}</span>
                       <button className="text-[10px] bg-white/10 px-2 py-1 rounded" onClick={() => {
                         navigator.clipboard.writeText(myProfile?.searchId || "");
                         alert("تم النسخ!");
                       }}>نسخ</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 pt-2">
               <button 
                 onClick={onClose}
                 className="w-full py-4 bg-white text-black font-black rounded-full hover:bg-gray-200 active:scale-95 transition-all text-lg"
               >
                 إغلاق
               </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <UserProfileModal 
      isOpen={!!selectedUser}
      onClose={() => setSelectedUser(null)}
      user={selectedUser}
      isFriend={friends.some(f => f.uid === selectedUser?.uid)}
    />
    </>
  );
}
