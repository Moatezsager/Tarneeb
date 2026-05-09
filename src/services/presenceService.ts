import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

export function initPresence() {
  let timeoutId: any = null;
  let heartbeatId: any = null;
  
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

  const startHeartbeat = () => {
    if (heartbeatId) clearInterval(heartbeatId);
    heartbeatId = setInterval(() => {
      if (document.visibilityState === "visible") {
        updateStatus("online");
      }
    }, 60000); // 1 minute heartbeat
  };

  const stopHeartbeat = () => {
    if (heartbeatId) clearInterval(heartbeatId);
  };

  // Set online when tab is active
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      updateStatus("online");
      startHeartbeat();
    } else {
      updateStatus("offline");
      stopHeartbeat();
    }
  };

  const handleOnline = () => {
    if (document.visibilityState === "visible") {
      updateStatus("online");
      startHeartbeat();
    }
  };
  
  const handleOffline = () => {
    updateStatus("offline");
    stopHeartbeat();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  
  // Set online initially
  if (document.visibilityState === "visible" && navigator.onLine) {
     updateStatus("online");
     startHeartbeat();
  } else {
     updateStatus("offline");
  }

  // Set offline on unload
  window.addEventListener("beforeunload", () => {
    updateStatus("offline");
  });

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    stopHeartbeat();
    updateStatus("offline");
  };
}
