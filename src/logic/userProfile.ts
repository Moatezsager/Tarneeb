import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";

export interface UserProfile {
  uid: string;
  name: string;
  searchId: string;
  country: string;
  gender: "male" | "female" | "other";
  avatar: string;
  status?: "online" | "offline";
  lastSeen?: any;
  updatedAt?: any;
  createdAt?: any;
}

export function generateSearchId() {
  // Generate 8-digit random number
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export async function isSearchIdUnique(searchId: string) {
  try {
    const q = query(collection(db, "users"), where("searchId", "==", searchId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  } catch (error) {
    console.error("Error checking searchId uniqueness:", error);
    return true; // Assume unique on error to not block user, but ideally handle better
  }
}

export const COUNTRIES = [
  { code: "LY", name: "ليبيا", flag: "🇱🇾" },
  { code: "EG", name: "مصر", flag: "🇪🇬" },
  { code: "TN", name: "تونس", flag: "🇹🇳" },
  { code: "DZ", name: "الجزائر", flag: "🇩🇿" },
  { code: "MA", name: "المغرب", flag: "🇲🇦" },
  { code: "SA", name: "السعودية", flag: "🇸🇦" },
  { code: "AE", name: "الإمارات", flag: "🇦🇪" },
  { code: "KW", name: "الكويت", flag: "🇰🇼" },
  { code: "QA", name: "قطر", flag: "🇶🇦" },
  { code: "JO", name: "الأردن", flag: "🇯🇴" },
  { code: "LB", name: "لبنان", flag: "🇱🇧" },
  { code: "IQ", name: "العراق", flag: "🇮🇶" },
];

export const AVATARS = [
  "👨‍💼", "👩‍💼", "👨‍🎨", "👩‍🎨", "👨‍🚀", "👩‍🚀", "👨‍🚒", "👩‍🚒",
  "🥷", "🧙‍♂️", "🧙‍♀️", "🧞‍♂️", "🧞‍♀️", "🧛‍♂️", "🧛‍♀️", "🧟‍♂️"
];

let currentUserProfile: UserProfile | null = null;

export function getLocalProfile() {
  return currentUserProfile;
}

export function setLocalProfile(profile: UserProfile | null) {
  currentUserProfile = profile;
}

export function clearLocalProfile() {
  currentUserProfile = null;
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data() as UserProfile,
        uid // Ensure uid is present
      };
    }
  } catch (error) {
    console.error("Error fetching profile:", error);
  }
  return null;
}

export async function fetchAndSetLocalProfile(uid: string): Promise<UserProfile | null> {
  const profile = await fetchUserProfile(uid);
  if (profile) {
    currentUserProfile = profile;
  }
  return profile;
}

export async function saveUserProfile(uid: string, profile: UserProfile) {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    const exists = docSnap.exists();

    const data: any = {
      ...profile,
      updatedAt: serverTimestamp()
    };
    
    if (!exists) {
      data.createdAt = serverTimestamp();
    } else {
      // Don't overwrite existing createdAt if it exists
      const existingData = docSnap.data();
      if (existingData.createdAt) {
          data.createdAt = existingData.createdAt;
      } else {
          data.createdAt = serverTimestamp();
      }
    }

    await setDoc(docRef, data);
    if (uid === auth.currentUser?.uid) {
      currentUserProfile = { ...profile, createdAt: data.createdAt };
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    return false;
  }
}
