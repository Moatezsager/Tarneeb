import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  deleteDoc,
  onSnapshot,
  setDoc
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile } from "./userProfile";

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromAvatar: string;
  fromSearchId?: string;
  toUid: string;
  toName?: string;
  toAvatar?: string;
  toSearchId?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: any;
}

export async function searchUsers(searchId: string): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, "users"), where("searchId", "==", searchId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "users");
    return [];
  }
}

export async function sendFriendRequest(toUser: UserProfile, fromProfile: UserProfile | null) {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    // 1. Check if already friends
    const friendSnap = await getDocs(query(collection(db, "users", currentUser.uid, "friends"), where("uid", "==", toUser.uid)));
    if (!friendSnap.empty) {
      console.log("Already friends");
      return false;
    }

    // 2. Check for existing pending request
    const q1 = query(collection(db, "friendRequests"), 
      where("fromUid", "==", currentUser.uid), 
      where("toUid", "==", toUser.uid), 
      where("status", "==", "pending")
    );
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      console.log("Request already sent");
      return false;
    }

    // Use passed profile or fall back
    const senderName = fromProfile?.name || currentUser.displayName || "لاعب";
    const senderAvatar = fromProfile?.avatar || "👤";
    const senderSearchId = fromProfile?.searchId || "";
    
    const requestData = {
      fromUid: currentUser.uid,
      fromName: senderName,
      fromAvatar: senderAvatar,
      fromSearchId: senderSearchId,
      toUid: toUser.uid,
      toName: toUser.name,
      toAvatar: toUser.avatar,
      toSearchId: toUser.searchId,
      status: "pending",
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, "friendRequests"), requestData);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "friendRequests");
    return false;
  }
}

export async function respondToFriendRequest(requestId: string, status: "accepted" | "rejected", fromUid: string, fromProfile: any) {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    const requestRef = doc(db, "friendRequests", requestId);
    
    // Defensive: check if request still exists and is directed to me
    // (Security rules already handle this, but let's be safe)
    
    await updateDoc(requestRef, { status });

    if (status === "accepted" && fromProfile) {
      // Add friend to MY list
      const myFriendRef = doc(db, "users", currentUser.uid, "friends", fromUid);
      await setDoc(myFriendRef, { 
        uid: fromUid,
        name: fromProfile.name || "لاعب", 
        avatar: fromProfile.avatar || "👤", 
        searchId: fromProfile.searchId || "",
        updatedAt: serverTimestamp() 
      });
    } else if (status === "rejected") {
      // Delete rejected requests immediately to save space
      await deleteDoc(requestRef);
    }
    
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `friendRequests/${requestId}`);
    return false;
  }
}

export function listenToAcceptedRequests(callback: (requests: FriendRequest[]) => void) {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(collection(db, "friendRequests"), where("fromUid", "==", user.uid), where("status", "==", "accepted"));
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
    callback(requests);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, "friendRequests");
  });
}

export async function deleteFriendRequest(requestId: string) {
  try {
    await deleteDoc(doc(db, "friendRequests", requestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `friendRequests/${requestId}`);
  }
}

export function listenToFriendRequests(callback: (requests: FriendRequest[]) => void) {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(collection(db, "friendRequests"), where("toUid", "==", user.uid), where("status", "==", "pending"));
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
    callback(requests);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, "friendRequests");
  });
}

export function listenToSentRequests(callback: (requests: FriendRequest[]) => void) {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(collection(db, "friendRequests"), where("fromUid", "==", user.uid), where("status", "==", "pending"));
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
    callback(requests);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, "friendRequests");
  });
}

export async function unfriend(friendId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;

  try {
    console.log(`Attempting to unfriend: Me=${currentUser.uid}, Friend=${friendId}`);
    
    // Delete from my list
    const myFriendRef = doc(db, "users", currentUser.uid, "friends", friendId);
    await deleteDoc(myFriendRef);
    console.log("Deleted from my friends list");

    // Delete from their list (using the new permission rule)
    const theirFriendRef = doc(db, "users", friendId, "friends", currentUser.uid);
    await deleteDoc(theirFriendRef);
    console.log("Deleted from their friends list");

    return true;
  } catch (error) {
    console.error("Unfriend error details:", error);
    handleFirestoreError(error, OperationType.DELETE, `users/${currentUser.uid}/friends/${friendId}`);
    return false;
  }
}

/**
 * Clean up old friend requests (e.g., older than 7 days)
 */
export async function cleanupOldFriendRequests() {
  try {
    const user = auth.currentUser;
    if (!user) return;
    
    // Stricter (7 days + 1 hour)
    const sevenDaysPlusAgo = new Date(Date.now() - (7 * 24 + 1) * 60 * 60 * 1000);
    const q1To = query(
      collection(db, "friendRequests"),
      where("toUid", "==", user.uid),
      where("createdAt", "<", sevenDaysPlusAgo)
    );
    const q1From = query(
      collection(db, "friendRequests"),
      where("fromUid", "==", user.uid),
      where("createdAt", "<", sevenDaysPlusAgo)
    );
    
    const [snap1To, snap1From] = await Promise.all([getDocs(q1To), getDocs(q1From)]);
    const docs1 = [...snap1To.docs, ...snap1From.docs];
    for (const d of docs1) {
      try { await deleteDoc(d.ref); } catch (e) {}
    }
    
    // Also cleanup accepted/rejected requests that are older than 25 hours
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const q2To = query(
      collection(db, "friendRequests"),
      where("toUid", "==", user.uid),
      where("status", "in", ["accepted", "rejected"])
    );
    const snap2 = await getDocs(q2To);
    let cleaned2 = 0;
    for (const d of snap2.docs) {
      const data = d.data();
      if (data.createdAt && data.createdAt.toMillis() < twentyFiveHoursAgo.getTime()) {
         try { await deleteDoc(d.ref); cleaned2++; } catch (e) {}
      }
    }
    
    if (docs1.length + cleaned2 > 0) {
      console.log(`Cleaned up ${docs1.length + cleaned2} friend requests.`);
    }
  } catch (error) {
    // Background task, silent fail
  }
}

export function listenToFriends(callback: (friends: UserProfile[]) => void) {
  const user = auth.currentUser;
  if (!user) return () => {};

  return onSnapshot(collection(db, "users", user.uid, "friends"), (snapshot) => {
    const friends = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
    callback(friends);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `users/${user.uid}/friends`);
  });
}
