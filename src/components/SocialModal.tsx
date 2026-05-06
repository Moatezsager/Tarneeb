import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile, getLocalProfile } from "../logic/userProfile";
import {
  FriendRequest,
  listenToFriendRequests,
  listenToSentRequests,
  listenToFriends,
  searchUsers,
  sendFriendRequest,
  respondToFriendRequest,
  listenToAcceptedRequests,
  deleteFriendRequest,
} from "../logic/social";
import { multiplayerState, sendRoomInvite, createRoom } from "../logic/multiplayer";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { G, updateUI } from "../logic/engine";
import { UserProfileModal, formatLastSeen } from "./UserProfileModal";
import {
  Crown,
  Search,
  UserPlus,
  Users,
  X,
  Send,
  Copy,
  Bell,
  Check,
  Clock,
} from "lucide-react";

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
  const [isInviting, setIsInviting] = useState(false);
  const f = friend;

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between p-3.5 sm:p-4 gap-3 sm:gap-0 ${f.searchId === "01" ? "bg-gradient-to-r from-[var(--color-gold)]/15 to-black/40 border-[var(--color-gold)]/40 hover:border-[var(--color-gold)]/80" : "bg-white/5 border-white/10 hover:bg-white/10"} rounded-2xl border cursor-pointer transition-all shadow-lg hover:shadow-[var(--color-gold)]/5`}
      onClick={() => onSelect(f)}
    >
      <div className="flex items-center gap-3.5 w-full sm:w-auto">
        <div
          className={`relative ${f.searchId === "01" ? "p-0.5 bg-gradient-to-tr from-[var(--color-gold)] to-yellow-200 rounded-2xl" : ""}`}
        >
          <div className="bg-black/40 p-2.5 sm:p-3 rounded-2xl flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 shadow-inner border border-white/5 overflow-hidden">
            {f.avatar?.startsWith('http') ? (
              <img src={f.avatar} alt="Avatar" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-3xl sm:text-4xl">{f.avatar}</span>
            )}
          </div>
          {f.searchId === "01" && (
            <div className="absolute -top-1.5 -left-1.5 bg-[var(--color-gold)] p-1 rounded-full border border-black shadow-[0_0_10px_rgba(241,196,15,0.5)]">
              <Crown className="w-3.5 h-3.5 text-black fill-black" />
            </div>
          )}
          <div
            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#1a1a2e] ${f.status === "online" ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-gray-500"}`}
          ></div>
        </div>
        <div className="text-right flex-1">
          <div className="flex items-center gap-1.5">
            <div className="text-white font-bold text-sm sm:text-base">
              {f.name}
            </div>
            {f.searchId === "01" && (
              <Crown className="w-4 h-4 text-[var(--color-gold)]" />
            )}
            <div className="text-[10px] text-[var(--color-gold)]/70 font-mono tracking-wider bg-black/40 px-1.5 py-0.5 rounded-md">
              #{f.searchId}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`text-[11px] font-bold ${f.status === "online" ? "text-green-400" : "text-gray-400"}`}
            >
              {f.status === "online" ? "إنترنت" : formatLastSeen(f.lastSeen)}
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={async (e) => {
          e.stopPropagation();
          let roomCode = multiplayerState.roomCode;
          
          if (!multiplayerState.isMultiplayer || !roomCode) {
            const confirmed = window.confirm("أنت لست في غرفة حالياً. هل تريد إنشاء غرفة خاصة جديدة ودعوة هذا الصديق؟");
            if (!confirmed) return;
            
            setIsInviting(true);
            try {
              const profile = getLocalProfile();
              const createdCode = await createRoom(profile?.name || "لاعب", false, "", 31);
              if (createdCode) {
                roomCode = createdCode;
              } else {
                throw new Error("فشل إنشاء الغرفة");
              }
            } catch (err) {
              alert("خطأ: " + (err as Error).message);
              setIsInviting(false);
              return;
            }
          } else {
             setIsInviting(true);
          }

          const success = await sendRoomInvite(f.uid, roomCode);
          if (success) {
            alert(`تم إرسال الدعوة إلى ${f.name}`);
            // Switch to multiplayer screen if we just joined a room
            if (G.phase !== 'multiplayer') {
               G.phase = 'multiplayer';
               updateUI();
            }
          }
          setIsInviting(false);
        }}
        disabled={isInviting || f.status !== "online"}
        className={`w-full sm:w-auto px-5 py-2.5 sm:py-2 ${f.status === "online" ? "bg-gradient-to-r from-[var(--color-gold)] to-yellow-600 text-black hover:scale-105 active:scale-95" : "bg-black/30 text-gray-500"} text-xs font-black rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg`}
      >
        {isInviting ? (
          "..."
        ) : (
          <>
            <span>تحدي</span>
            <span>⚔️</span>
          </>
        )}
      </button>
    </div>
  );
}

export function SocialModal({ isOpen, onClose, myProfile }: Props) {
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "search">(
    "friends",
  );
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
    setSearchResults(results.filter((u) => u.uid !== auth.currentUser?.uid));
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-[500px] h-full sm:h-auto max-h-[90vh] bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1c] border border-[var(--color-gold)]/30 sm:rounded-[2.5rem] rounded-[2rem] overflow-hidden shadow-2xl flex flex-col relative"
            >
              {/* Header */}
              <div className="p-5 sm:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-white/5 relative z-10 bg-[#1a1a2e]/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-[var(--color-gold)]/20 p-2 sm:p-2.5 rounded-xl border border-[var(--color-gold)]/30">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--color-gold)]" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-white font-[var(--font-tajawal)] leading-tight">
                      المجتمع
                    </h3>
                    <div className="text-[10px] sm:text-xs text-[var(--color-gold)] font-bold">
                      تواصل مع أصدقائك
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="bg-black/30 p-2 sm:p-2.5 rounded-full text-white/50 hover:text-white hover:bg-black/60 transition-all border border-white/5 hover:border-red-500/50"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-4 sm:px-6 pt-4 pb-2 z-10 bg-transparent">
                <div className="bg-black/30 p-1.5 rounded-2xl flex gap-1 border border-white/5 shadow-inner">
                  <button
                    onClick={() => setActiveTab("friends")}
                    className={`flex-1 py-3 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex justify-center items-center gap-2 ${activeTab === "friends" ? "bg-[var(--color-gold)] text-black shadow-lg shadow-[var(--color-gold)]/20" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                  >
                    <Users className="w-4 h-4 hidden sm:block" />
                    الأصدقاء
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === "friends" ? "bg-black/20" : "bg-white/10 text-white"}`}
                    >
                      {friends.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("requests")}
                    className={`flex-1 py-3 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex justify-center items-center gap-2 relative ${activeTab === "requests" ? "bg-[var(--color-gold)] text-black shadow-lg shadow-[var(--color-gold)]/20" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                  >
                    <Bell className="w-4 h-4 hidden sm:block" />
                    الطلبات
                    {requests.length > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_#ef4444]"></span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("search")}
                    className={`flex-1 py-3 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex justify-center items-center gap-2 ${activeTab === "search" ? "bg-[var(--color-gold)] text-black shadow-lg shadow-[var(--color-gold)]/20" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                  >
                    <Search className="w-4 h-4 hidden sm:block" />
                    بحث
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 custom-scrollbar">
                <AnimatePresence mode="wait">
                  {activeTab === "friends" && (
                    <motion.div
                      key="friends"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3 sm:space-y-4"
                    >
                      {friends.length === 0 ? (
                        <div className="text-center py-12 flex flex-col items-center">
                          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                            <Users className="w-8 h-8 text-white/20" />
                          </div>
                          <div className="text-white/50 font-bold mb-1">
                            لا يوجد أصدقاء
                          </div>
                          <div className="text-white/30 text-xs w-2/3">
                            اضغط على زر البحث لإضافة أصدقاء جدد واللعب معهم
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {friends.map((f) => (
                            <FriendCard
                              key={f.uid}
                              friend={f}
                              onSelect={(u) => setSelectedUser(u)}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === "requests" && (
                    <motion.div
                      key="requests"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {requests.length === 0 ? (
                        <div className="text-center py-12 flex flex-col items-center">
                          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                            <Bell className="w-8 h-8 text-white/20" />
                          </div>
                          <div className="text-white/50 font-bold">
                            لا يوجد طلبات صداقة معلقة
                          </div>
                        </div>
                      ) : (
                        requests.map((r) => (
                          <div
                            key={r.id}
                            className="p-4 sm:p-5 bg-gradient-to-l from-white/5 to-white/0 rounded-2xl border border-white/10 shadow-lg"
                          >
                            <div className="flex items-center gap-3 sm:gap-4 mb-4">
                              <div className="text-3xl sm:text-4xl bg-black/40 p-2 sm:p-3 rounded-2xl border border-white/5 shadow-inner">
                                {r.fromAvatar}
                              </div>
                              <div className="text-right flex-1">
                                <div className="text-white font-bold text-sm sm:text-base">
                                  {r.fromName}
                                </div>
                                <div className="text-[10px] text-[var(--color-gold)] font-mono tracking-wider">
                                  #{r.fromSearchId}
                                </div>
                                <div className="text-xs text-white/40 mt-0.5">
                                  يريد أن يضيفك كصديق
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2.5">
                              <button
                                onClick={() =>
                                  respondToFriendRequest(
                                    r.id,
                                    "accepted",
                                    r.fromUid,
                                    {
                                      name: r.fromName,
                                      avatar: r.fromAvatar,
                                      searchId: r.fromSearchId,
                                      status: "online",
                                    },
                                  )
                                }
                                className="flex-1 py-2.5 sm:py-3 bg-green-500/20 text-green-400 border border-green-500/30 text-xs sm:text-sm font-black rounded-xl hover:bg-green-500 hover:text-black transition-all flex items-center justify-center gap-2"
                              >
                                <Check className="w-4 h-4" />
                                قبول
                              </button>
                              <button
                                onClick={() =>
                                  respondToFriendRequest(
                                    r.id,
                                    "rejected",
                                    r.fromUid,
                                    null,
                                  )
                                }
                                className="flex-1 py-2.5 sm:py-3 bg-red-500/10 text-red-400 border border-red-500/20 text-xs sm:text-sm font-black rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                              >
                                <X className="w-4 h-4" />
                                رفض
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}

                  {activeTab === "search" && (
                    <motion.div
                      key="search"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-5"
                    >
                      {/* My ID */}
                      <div className="p-4 sm:p-5 bg-gradient-to-r from-[var(--color-gold)]/20 to-black/40 border border-[var(--color-gold)]/30 rounded-2xl flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <div className="text-[var(--color-gold)] md:text-sm text-xs font-black flex items-center gap-2">
                            <UserPlus className="w-4 h-4" /> المعرف الرقمي الخاص
                            بك
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1 bg-black/60 p-3 rounded-xl border border-white/10 text-white font-mono text-center tracking-[0.3em] font-black text-lg">
                            {myProfile?.searchId}
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                myProfile?.searchId || "",
                              );
                              alert("تم النسخ!");
                            }}
                            className="w-14 items-center justify-center flex bg-[var(--color-gold)]/20 text-[var(--color-gold)] rounded-xl border border-[var(--color-gold)]/40 hover:bg-[var(--color-gold)] hover:text-black transition-all active:scale-95"
                          >
                            <Copy className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <form onSubmit={handleSearch} className="relative group">
                        <input
                          type="text"
                          placeholder="ابحث بالمعرف الرقمي (مثال: 12345678)"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-[90px] pr-5 py-4 bg-black/50 border border-white/10 rounded-2xl text-white font-bold placeholder:text-white/20 focus:outline-none focus:border-[var(--color-gold)] focus:bg-black/80 transition-all font-mono"
                        />
                        <button
                          type="submit"
                          className="absolute left-2 top-2 bottom-2 px-6 bg-[var(--color-gold)] text-black rounded-xl font-black text-xs sm:text-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                          disabled={searching || !searchQuery.trim()}
                        >
                          {searching ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                repeat: Infinity,
                                duration: 1,
                                ease: "linear",
                              }}
                            >
                              <Clock className="w-4 h-4" />
                            </motion.div>
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                        </button>
                      </form>

                      <div className="space-y-3">
                        {searchResults.length === 0 &&
                          searchQuery.trim() !== "" &&
                          !searching && (
                            <div className="text-center py-8 flex flex-col items-center border border-dashed border-white/10 rounded-2xl">
                              <Search className="w-8 h-8 text-white/20 mb-3" />
                              <div className="text-white/40 text-sm font-bold">
                                لم يتم العثور على أي لاعب
                              </div>
                            </div>
                          )}

                        {searchResults.map((u) => {
                          const isFriend = friends.some((f) => f.uid === u.uid);
                          const incomingRequest = requests.find(
                            (r) => r.fromUid === u.uid,
                          );
                          const outgoingRequest = sentRequests.find(
                            (r) => r.toUid === u.uid,
                          );

                          return (
                            <div
                              key={u.uid}
                              className={`flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 ${u.searchId === "01" ? "bg-gradient-to-r from-[var(--color-gold)]/10 to-black/40 border-[var(--color-gold)]/30" : "bg-white/5 border-white/10 hover:bg-white/10"} rounded-2xl border cursor-pointer transition-all shadow-lg gap-4 sm:gap-0`}
                              onClick={() => setSelectedUser(u)}
                            >
                              <div className="flex items-center gap-3.5 w-full sm:w-auto">
                                <div className="bg-black/40 p-2.5 sm:p-3 rounded-2xl flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 shadow-inner border border-white/5 overflow-hidden">
                                  {u.avatar?.startsWith('http') ? (
                                    <img src={u.avatar} alt="Avatar" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                  ) : (
                                    <span className="text-3xl sm:text-4xl">{u.avatar}</span>
                                  )}
                                </div>
                                <div className="text-right flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className="text-white font-bold text-sm sm:text-base">
                                      {u.name}
                                    </div>
                                    {u.searchId === "01" && (
                                      <Crown className="w-3.5 h-3.5 text-[var(--color-gold)]" />
                                    )}
                                  </div>
                                  <div className="text-[10px] sm:text-xs text-[var(--color-gold)]/70 font-mono tracking-wider mt-0.5">
                                    #{u.searchId}
                                  </div>
                                </div>
                              </div>

                              <div className="w-full sm:w-auto flex justify-end">
                                {isFriend ? (
                                  <div className="w-full sm:w-auto px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                                    <Check className="w-4 h-4" /> صديق
                                  </div>
                                ) : incomingRequest ? (
                                  <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        respondToFriendRequest(
                                          incomingRequest.id,
                                          "accepted",
                                          u.uid,
                                          {
                                            name: u.name,
                                            avatar: u.avatar,
                                            searchId: u.searchId,
                                            status: "online",
                                          },
                                        );
                                      }}
                                      className="flex-1 sm:flex-none px-4 py-2 sm:py-0 bg-green-500/20 text-green-400 border border-green-500/30 font-bold rounded-xl hover:bg-green-500 hover:text-black transition-all flex items-center justify-center gap-1"
                                    >
                                      <Check className="w-4 h-4" /> قبول
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        respondToFriendRequest(
                                          incomingRequest.id,
                                          "rejected",
                                          u.uid,
                                          null,
                                        );
                                      }}
                                      className="flex-1 sm:flex-none px-4 py-2 sm:py-0 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : outgoingRequest ? (
                                  <div className="flex gap-2 w-full sm:w-auto">
                                    <div className="flex-1 sm:flex-none px-4 py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
                                      <Clock className="w-4 h-4" />
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteFriendRequest(outgoingRequest.id);
                                      }}
                                      className="flex-none px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSendRequest(u);
                                    }}
                                    className="w-full sm:w-auto px-5 py-2.5 sm:py-2.5 bg-[var(--color-gold)] text-black rounded-xl hover:scale-105 active:scale-95 transition-all text-sm font-black flex items-center justify-center gap-2"
                                  >
                                    <UserPlus className="w-4 h-4" /> إضافة
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <UserProfileModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        user={selectedUser}
        isFriend={friends.some((f) => f.uid === selectedUser?.uid)}
      />
    </>
  );
}
