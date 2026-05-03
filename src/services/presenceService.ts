import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

export function initPresence() {
  const updateStatus = async (status: "online" | "offline") => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        status,
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      // Ignore presence update errors (e.g. if profile doesn't exist yet)
    }
  };

  // Set online when tab is active
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      updateStatus("online");
    } else {
      updateStatus("offline");
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  
  // Set online initially
  updateStatus("online");

  // Set offline on unload
  window.addEventListener("beforeunload", () => {
    updateStatus("offline");
  });

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    updateStatus("offline");
  };
}
