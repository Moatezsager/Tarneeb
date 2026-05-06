import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

export function initPresence() {
  let timeoutId: any = null;
  const updateStatus = async (status: "online" | "offline") => {
    const user = auth.currentUser;
    if (!user) return;

    if (timeoutId) clearTimeout(timeoutId);
    
    // Debounce status updates to avoid spamming Firestore
    timeoutId = setTimeout(async () => {
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
    }, status === "online" ? 100 : 2000); // Online is quick, offline is delayed in case they come back fast
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
