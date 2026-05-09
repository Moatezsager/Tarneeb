import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  deleteDoc,
  getDoc
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { G, updateUI, Phase, setOnSyncNeeded, setMyPlayerIndex, myPlayerIndex, setMultiplayerMode, startNewRound, dealCardsAnimation, forceAiAction, isDealingAnimationRunning, justPlayedLocalAction, setJustPlayedLocalAction, resumeGameLoop, executeAISwap, setExecutingForcedAction } from "./engine";
import { getLocalProfile } from "./userProfile";

let timerInterval: any = null;
let pingInterval: any = null;

// Timing constants for disconnect detection
const HEARTBEAT_INTERVAL = 3000;      // 3 seconds between heartbeats (was 10s)
const DISCONNECT_THRESHOLD = 8000;    // 8 seconds before considered disconnected (was 30s)
const RECONNECT_GRACE_PERIOD = 2000;  // 2 seconds grace for reconnection

export let localActionLockUntil = 0;
export const setLocalActionLock = (ms: number) => { localActionLockUntil = Date.now() + ms; };

function startHeartbeat() {
  if (pingInterval) clearInterval(pingInterval);

  // Browser online/offline events for instant detection
  const handleOnline = () => {
    if (activeRoomId && auth.currentUser) {
      console.log("Browser back online - sending immediate heartbeat");
      sendHeartbeat();
    }
  };
  const handleVisibility = () => {
    if (document.visibilityState === "visible" && activeRoomId && auth.currentUser) {
      sendHeartbeat();
    }
  };
  window.addEventListener("online", handleOnline);
  document.addEventListener("visibilitychange", handleVisibility);
  (window as any).__tarneb_hb_cleanup = () => {
    window.removeEventListener("online", handleOnline);
    document.removeEventListener("visibilitychange", handleVisibility);
  };

  // Send initial heartbeat immediately
  sendHeartbeat();
  pingInterval = setInterval(() => sendHeartbeat(), HEARTBEAT_INTERVAL);
}

async function sendHeartbeat() {
  if (!activeRoomId || !auth.currentUser) return;
  try {
    const roomRef = doc(db, "rooms", activeRoomId);
    const players = multiplayerState.players;
    if (players.length === 0) return;

    let hasChange = false;
    const now = Date.now();
    const updatedPlayers = players.map(p => {
      if (p.uid === auth.currentUser!.uid) {
        const wasDisconnected = p.status === "disconnected";
        hasChange = true;
        if (wasDisconnected) {
          console.log("Reconnected! Restoring player status.");
        }
        return { ...p, lastPing: now, status: "connected" as const };
      }
      // Only host detects disconnected players to avoid conflicts
      if (multiplayerState.isHost && !p.isBot && p.lastPing && p.status === "connected") {
        if (now - p.lastPing > DISCONNECT_THRESHOLD) {
          hasChange = true;
          console.log(`Player ${p.name} (idx ${p.index}) disconnected (${Math.round((now - p.lastPing) / 1000)}s since last ping)`);
          return { ...p, status: "disconnected" as const, disconnectedAt: now };
        }
      }
      // Detect reconnection: player was disconnected but now sending pings again
      if (multiplayerState.isHost && !p.isBot && p.status === "disconnected" && p.lastPing && now - p.lastPing < DISCONNECT_THRESHOLD) {
        hasChange = true;
        console.log(`Player ${p.name} (idx ${p.index}) reconnected!`);
        return { ...p, status: "connected" as const, disconnectedAt: undefined };
      }
      return p;
    });

    if (hasChange) {
      try {
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
          await updateDoc(roomRef, { players: updatedPlayers });
        } else {
          console.warn("Heartbeat failed: Room no longer exists.");
          stopHeartbeat();
        }
      } catch (e) {
        // Silently fail - next heartbeat will retry or user will be kicked by listener
      }
    }
  } catch (e) {
    // Silently fail
  }
}

function stopHeartbeat() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if ((window as any).__tarneb_hb_cleanup) {
    (window as any).__tarneb_hb_cleanup();
    delete (window as any).__tarneb_hb_cleanup;
  }
}

let lastSyncedCoreState = "";
function getCoreState() {
   return JSON.stringify({
       phase: G.phase,
       cp: G.currentPlayer,
       bids: G.bids,
       hands: G.hands.map(h => h ? h.length : 0),
       tricks: G.trickCards ? G.trickCards.map(c => c ? `${c.suit}${c.rank}` : null) : [],
       taken: G.tricksTaken,
       scores: G.scores,
       exposed: G.exposedCards ? G.exposedCards.map(c => c ? `${c.suit}${c.rank}` : null) : [],
       round: G.roundNumber,
       tp: G.tarnebPlayed,
       att: G.anyoneTarnebThisTrick
   });
}

window.addEventListener('tarneb-leave-room-end', () => {
   leaveRoom(multiplayerState.isHost);
});

window.addEventListener('tarneb-leave-room', () => {
   leaveRoom(false);
});

window.addEventListener('beforeunload', () => {
   if (activeRoomId) {
       leaveRoom(false);
   }
});

setOnSyncNeeded(() => {
  if (multiplayerState.isMultiplayer) {
    const coreState = getCoreState();
    if (coreState !== lastSyncedCoreState) {
      lastSyncedCoreState = coreState;
      if (multiplayerState.isHost || justPlayedLocalAction) {
         updateGameState();
      }
    }
  }
});

function startHostTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!multiplayerState.isHost || !multiplayerState.isMultiplayer) return;
    if (!G.gameStarted) return;
    
    const now = Date.now();
    const elapsed = (now - G.turnStartTime) / 1000;
    
    // === Auto-close roundEnd overlay ===
    // If host hasn't clicked "continue" after 25 seconds, auto-progress
    if (G.phase === "roundEnd" && G.roundEndOverlayVisible && elapsed > 25) {
      console.log("Auto-closing round end overlay (timeout)");
      G.turnStartTime = Date.now();
      import("./engine").then(eng => eng.closeRoundEnd());
      return;
    }
    
    // === Dealing phase stuck detection ===
    // If dealing animation is stuck for > 20 seconds, force-complete it
    if (G.phase === "dealing" && elapsed > 20 && !isDealingAnimationRunning) {
      console.log("Dealing phase stuck, forcing progression");
      G.turnStartTime = Date.now();
      resumeGameLoop();
      updateGameState();
      return;
    }
    
    // Only process turn-based phases
    if (G.phase !== "playing" && G.phase !== "bidding" && G.phase !== "swapping") return;
    
    const actingPlayer = G.phase === "swapping" ? G.playerWithHighestScore : G.currentPlayer;
    const currentPlayerIsBot = G.playerNames[actingPlayer]?.includes("كمبيوتر");
    
    // Check if the acting player is disconnected (even if not a bot)
    const actingPlayerRecord = multiplayerState.players.find(p => p.index === actingPlayer);
    const isDisconnected = actingPlayerRecord && actingPlayerRecord.status === "disconnected";
    
    if (currentPlayerIsBot) {
       // Bot stuck for > 4 seconds - force action
       if (elapsed > 4) {
          console.log(`Bot ${actingPlayer} stuck. Forcing AI move.`);
          G.turnStartTime = Date.now();
          setExecutingForcedAction(true);
          if (G.phase === "swapping") executeAISwap();
          else forceAiAction(actingPlayer);
          setExecutingForcedAction(false);
          updateGameState();
       }
    } else if (isDisconnected) {
       // Disconnected player: take over immediately (shorter timeout)
       const disconnectTimeout = Math.min(G.turnTimeout, 8);
       if (elapsed > disconnectTimeout) {
          console.log(`Disconnected player ${actingPlayer} (${G.playerNames[actingPlayer]}) - AI taking over turn.`);
          G.turnStartTime = Date.now();
          setExecutingForcedAction(true);
          if (G.phase === "swapping") executeAISwap();
          else forceAiAction(actingPlayer);
          setExecutingForcedAction(false);
          updateGameState();
       }
    } else {
       // Connected human player: use normal timeout
       if (elapsed > G.turnTimeout) {
          console.log(`Player ${actingPlayer} (${G.playerNames[actingPlayer]}) timed out. AI taking over for this turn.`);
          // DO NOT convertPlayerToBot so they can return!
          G.turnStartTime = Date.now();
          setExecutingForcedAction(true);
          if (G.phase === "swapping") executeAISwap();
          else forceAiAction(actingPlayer);
          setExecutingForcedAction(false);
          updateGameState();
       }
    }
  }, 500);
}

async function convertPlayerToBot(playerIndex: number) {
  if (!activeRoomId || !multiplayerState.isHost) return;
  const botName = `كمبيوتر ${playerIndex + 1}`;
  G.playerNames[playerIndex] = botName;
  updateUI();
  try {
    const roomRef = doc(db, "rooms", activeRoomId);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists()) {
       const data = roomSnap.data() as RoomData;
       const updatedPlayers = data.players.map(p => {
         if (p.index === playerIndex) {
           return {
             ...p,
             uid: `bot_${playerIndex}_${Date.now()}`,
             name: botName,
             avatar: "🤖",
             country: "AI",
             isBot: true
           } as Player;
         }
         return p;
       });
       await updateDoc(roomRef, { players: updatedPlayers });
    }
  } catch(e) {
    console.error("Error converting player to bot:", e);
  }
}

function stopHostTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

export interface Player {
  uid: string;
  name: string;
  avatar: string;
  country: string;
  searchId?: string;
  index: number;
  status: "connected" | "disconnected";
  isBot?: boolean;
  lastPing?: number;
  disconnectedAt?: number;  // When the player was detected as disconnected
}

export interface Spectator {
  uid: string;
  name: string;
  avatar: string;
  searchId?: string;
}

export interface RoomData {
  code: string;
  hostId: string;
  status: "waiting" | "playing" | "finished";
  isPublic: boolean;
  password?: string;
  hostName: string;
  players: Player[];
  spectators: Spectator[];
  memberUids: string[];
  gameState: any;
  lastActionBy: string;
  createdAt: any;
  updatedAt: any;
}

let activeRoomId: string | null = null;
let roomUnsubscribe: (() => void) | null = null;
let actionsUnsubscribe: (() => void) | null = null;

export const multiplayerState = {
  isMultiplayer: false,
  roomCode: "",
  players: [] as Player[],
  spectators: [] as Spectator[],
  myPlayerIndex: -1,
  isHost: false,
  hostId: "",
  isPublic: true,
};

function startActionsListener(roomId: string) {
  if (actionsUnsubscribe) return; // already listening

  const actionsRef = collection(db, "rooms", roomId, "actions");
  actionsUnsubscribe = onSnapshot(actionsRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const action = change.doc.data();
        if (multiplayerState.isHost) {
           processPlayerAction(action);
        }
        // Only host deletes the action, or actually we can let anyone delete if it's their action? No, host deletes it to confirm it was processed.
        if (multiplayerState.isHost) {
           deleteDoc(change.doc.ref).catch(e => console.error("Failed to delete action", e));
        }
      }
    });
  });
}

function stopActionsListener() {
  if (actionsUnsubscribe) {
     actionsUnsubscribe();
     actionsUnsubscribe = null;
  }
}

async function processPlayerAction(action: any) {
  try {
    const engine = await import("./engine");
    
    if (action.type === "PLAY_CARD") {
       engine.executePlay(action.cardIdx, action.playerIdx);
    } else if (action.type === "BID") {
       engine.confirmBid(action.bid, action.playerIdx);
    } else if (action.type === "SWAP") {
       engine.humanSwap(action.target, action.playerIdx);
    } else if (action.type === "SKIP_SWAP") {
       engine.humanSkipSwap(action.playerIdx);
    }
    
    engine.updateUI();
    updateGameState();
  } catch(e) {
    console.error("Error processing action", e);
  }
}

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function serializeGameState(state: any, isRoot = true): any {
  if (Array.isArray(state)) {
    return state.map(item => serializeGameState(item, false));
  }
  
  if (state !== null && typeof state === 'object') {
    const serialized: any = {};
    for (const key in state) {
      if (isRoot && (key === 'particles' || key === 'dealingCards')) {
         continue; // Omit UI-only state from network sync
      }
      const value = state[key];
      // Special handling for G.hands which is Card[][]
      if (key === 'hands' && Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
        serialized[key] = {
          h0: serializeGameState(value[0], false),
          h1: serializeGameState(value[1], false),
          h2: serializeGameState(value[2], false),
          h3: serializeGameState(value[3], false)
        };
      } else {
        serialized[key] = serializeGameState(value, false);
      }
    }
    return serialized;
  }
  
  return state;
}

function deserializeGameState(state: any): any {
  if (Array.isArray(state)) {
    return state.map(item => deserializeGameState(item));
  }

  if (state !== null && typeof state === 'object') {
    // Check if this was a serialized hands object
    if (state.h0 !== undefined && state.h1 !== undefined && state.h2 !== undefined && state.h3 !== undefined && Object.keys(state).length === 4) {
      return [
        deserializeGameState(state.h0),
        deserializeGameState(state.h1),
        deserializeGameState(state.h2),
        deserializeGameState(state.h3)
      ];
    }

    const deserialized: any = {};
    for (const key in state) {
      deserialized[key] = deserializeGameState(state[key]);
    }
    return deserialized;
  }

  return state;
}

let antiHostInterval: any = null;
function startAntiHostFreezeTimer() {
  if (antiHostInterval) clearInterval(antiHostInterval);
  antiHostInterval = setInterval(() => {
    if (multiplayerState.isHost || !multiplayerState.isMultiplayer) return;
    if (!G.gameStarted) return;
    if (!activeRoomId) return;

    const now = Date.now();
    const elapsed = (now - G.turnStartTime) / 1000;
    
    // Determine appropriate freeze threshold based on phase
    let freezeThreshold: number;
    if (G.phase === "roundEnd") {
      freezeThreshold = 20; // Reduced from 35
    } else if (G.phase === "dealing") {
      freezeThreshold = 18; // Reduced from 30
    } else if (G.phase === "swapping") {
      freezeThreshold = G.turnTimeout + 8;
    } else if (G.phase === "playing" || G.phase === "bidding") {
      freezeThreshold = G.turnTimeout + 6;
    } else {
      return; // intro, setup, stats, etc. - no freeze detection needed
    }
    
    if (elapsed > freezeThreshold) {
      console.log(`Host seems frozen in phase '${G.phase}' (${Math.round(elapsed)}s elapsed). Taking over...`);
      takeOverHost();
    }
  }, 4000);
}

function stopAntiHostFreezeTimer() {
  if (antiHostInterval) {
    clearInterval(antiHostInterval);
    antiHostInterval = null;
  }
}

async function takeOverHost() {
  if (!activeRoomId || multiplayerState.isHost) return;
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const roomRef = doc(db, "rooms", activeRoomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const data = roomSnap.data() as RoomData;
    
    // Determine who should be the new host:
    // Find the first connected non-bot player (by index order for determinism)
    const connectedPlayers = data.players
      .filter(p => !p.isBot && !p.uid.startsWith('bot_') && p.status === "connected")
      .sort((a, b) => a.index - b.index);
    
    // Only take over if I'm the first eligible connected player
    if (connectedPlayers.length === 0 || connectedPlayers[0].uid !== user.uid) {
      return; // Someone else should take over, or no one can
    }
    
    console.log("I am taking over as host!");
    const newHostName = data.players.find(p => p.uid === user.uid)?.name || "لاعب";
    
    // Convert the old host to a bot if they are disconnected
    const deadHostId = data.hostId;
    const deadHostPlayer = data.players.find(p => p.uid === deadHostId);
    
    const updatedPlayers = data.players.map(p => {
      if (p.uid === deadHostId && deadHostPlayer) {
        return {
          ...p,
          uid: `bot_${p.index}_${Date.now()}`,
          name: `كمبيوتر ${p.index + 1}`,
          avatar: "🤖",
          country: "AI",
          isBot: true
        } as Player;
      }
      return p;
    });

    let updatedGameState = data.gameState;
    if (deadHostPlayer && updatedGameState && updatedGameState.playerNames) {
      updatedGameState.playerNames[deadHostPlayer.index] = `كمبيوتر ${deadHostPlayer.index + 1}`;
      // Reset turnStartTime so the new host's timer starts fresh
      updatedGameState.turnStartTime = Date.now();
    }

    const newMembers = data.memberUids.filter(id => id !== deadHostId);

    await updateDoc(roomRef, {
      hostId: user.uid,
      hostName: newHostName,
      memberUids: newMembers,
      players: updatedPlayers,
      gameState: updatedGameState,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.error("Take over host failed", e);
  }
}

export async function createRoom(playerName: string, isPublic = true, password = "", winLimit = 31, mode: "FFA" | "Teams" | "1v1" = "Teams") {
  if (!auth.currentUser) throw new Error("يجب تسجيل الدخول أولاً");

  const profile = getLocalProfile();
  const code = generateCode();
  const roomId = code;
  const user = auth.currentUser;

  const room: RoomData = {
    code,
    hostId: user.uid,
    hostName: profile?.name || playerName,
    status: "waiting",
    isPublic,
    password,
    players: [
      { 
        uid: user.uid, 
        name: profile?.name || playerName, 
        avatar: profile?.avatar || "👨‍💼",
        country: profile?.country || "LY",
        searchId: profile?.searchId || "0000",
        index: 0, 
        status: "connected" 
      }
    ],
    spectators: [],
    memberUids: [user.uid],
    gameState: serializeGameState({ ...G, phase: "multiplayer", target: winLimit, gameMode: mode }),
    lastActionBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  G.target = winLimit;
  G.gameMode = mode;

  try {
    await setDoc(doc(db, "rooms", roomId), room);
    activeRoomId = roomId;
    multiplayerState.isMultiplayer = true;
    multiplayerState.roomCode = code;
    multiplayerState.myPlayerIndex = 0;
    multiplayerState.isHost = true;
    localStorage.setItem('tarneb_active_room', code);
    
    setMyPlayerIndex(0);
    setMultiplayerMode(true, true);
    
    startHeartbeat();
    startAntiHostFreezeTimer();
    listenToRoom(roomId);
    startHostTimer();
    return code;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `rooms/${roomId}`);
  }
}

export async function joinRoom(code: string, playerName: string, passwordAttempt = "", asSpectator = false) {
  if (!auth.currentUser) throw new Error("يجب تسجيل الدخول أولاً");
  
  G.savedPhase = null;
  const roomId = code.toUpperCase();
  const user = auth.currentUser;

  try {
    const profile = getLocalProfile();
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) throw new Error("الغرفة غير موجودة");
    
    const data = roomSnap.data() as RoomData;
    
    const isAlreadyMember = data.memberUids.includes(user.uid);
    
    if (!isAlreadyMember && data.password && data.password !== passwordAttempt) {
      throw new Error("كلمة المرور غير صحيحة");
    }

    if (asSpectator) {
      if (data.players.some(p => p.uid === user.uid)) {
        throw new Error("لا يمكنك مشاهدة غرفة أنت لاعب فيها!");
      }
      const existingSpectator = data.spectators?.find(s => s.uid === user.uid);
      if (!existingSpectator) {
        const newSpectator: Spectator = {
          uid: user.uid,
          name: profile?.name || playerName,
          avatar: profile?.avatar || "👤",
          searchId: profile?.searchId || "0000",
        };
        const updatedSpectators = [...(data.spectators || []), newSpectator];
        await updateDoc(roomRef, {
          spectators: updatedSpectators,
          memberUids: [...data.memberUids, user.uid],
          updatedAt: serverTimestamp()
        });
      }
      multiplayerState.myPlayerIndex = -1; // Spectator index
    } else {
      let updatedSpectators = data.spectators || [];
      if (updatedSpectators.some(s => s.uid === user.uid)) {
        updatedSpectators = updatedSpectators.filter(s => s.uid !== user.uid);
      }

      // Check if already in room as player
      let existingPlayer = data.players.find(p => p.uid === user.uid);

      if (!existingPlayer && data.status !== "waiting") {
         // Try to take over a bot slot
         const botToReplace = data.players.find(p => p.isBot || p.uid.startsWith('bot_'));
         if (botToReplace) {
             const updatedPlayers = data.players.map(p => {
                 if (p.index === botToReplace.index) {
                     return {
                         ...p,
                         uid: user.uid,
                         name: profile?.name || playerName,
                         avatar: profile?.avatar || "👨‍💼",
                         country: profile?.country || "LY",
                         searchId: profile?.searchId || "0000",
                         isBot: false,
                         status: "connected"
                     } as Player;
                 }
                 return p;
             });
             
             let updatedGameState = data.gameState || G;
             if (updatedGameState && updatedGameState.playerNames) {
                 updatedGameState.playerNames[botToReplace.index] = profile?.name || playerName;
             }

             const newUids = data.memberUids.includes(user.uid) ? data.memberUids : [...data.memberUids, user.uid];

             await updateDoc(roomRef, {
                 players: updatedPlayers,
                 memberUids: newUids,
                 gameState: updatedGameState,
                 updatedAt: serverTimestamp()
             });
             
             existingPlayer = updatedPlayers.find(p => p.uid === user.uid);
             // use the updated players instead of the old data.players below
             data.players = updatedPlayers;
         }
      }

      if (existingPlayer) {
         multiplayerState.myPlayerIndex = existingPlayer.index;
      } else {
         if (data.status !== "waiting") throw new Error("اللعبة بدأت بالفعل أو انتهت");
         if (data.players.length >= 4) throw new Error("الغرفة ممتلئة. انضم كمشاهد!");
         
         const newPlayer: Player = {
           uid: user.uid,
           name: profile?.name || playerName,
           avatar: profile?.avatar || "👨‍💼",
           country: profile?.country || "LY",
           searchId: profile?.searchId || "0000",
           index: data.players.length,
           status: "connected"
         };
         const updatedPlayers = [...data.players, newPlayer];
         const updatedUids = [...data.memberUids, user.uid];
         await updateDoc(roomRef, {
           players: updatedPlayers,
           spectators: updatedSpectators,
           memberUids: updatedUids,
           updatedAt: serverTimestamp()
         });
         multiplayerState.myPlayerIndex = newPlayer.index;
      }
    }

    activeRoomId = roomId;
    localStorage.setItem('tarneb_active_room', roomId);
    multiplayerState.isMultiplayer = true;
    multiplayerState.roomCode = roomId;
    multiplayerState.isHost = data.hostId === user.uid;
    
    setMyPlayerIndex(multiplayerState.myPlayerIndex);
    setMultiplayerMode(true, multiplayerState.isHost);
    
    startHeartbeat();
    startAntiHostFreezeTimer();
    listenToRoom(roomId);
    if (multiplayerState.isHost) startHostTimer();
    return roomId;
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const expectedErrors = ["الغرفة غير موجودة", "كلمة المرور غير صحيحة", "اللعبة بدأت بالفعل أو انتهت", "الغرفة ممتلئة"];
    
    if (expectedErrors.some(e => errorMsg.includes(e))) {
      console.warn("Expected join error:", errorMsg);
      throw error; // Just throw the simple error, don't use handleFirestoreError's JSON bloat
    }
    
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}`);
    throw error;
  }
}

export async function fetchPublicRooms(): Promise<RoomData[]> {
  try {
    const q = query(
      collection(db, "rooms"),
      where("isPublic", "==", true),
      where("status", "==", "waiting")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as RoomData);
  } catch (error) {
    console.error("Error fetching public rooms:", error);
    return [];
  }
}

export function listenToPublicRooms(callback: (rooms: RoomData[]) => void) {
  const q = query(
    collection(db, "rooms"),
    where("isPublic", "==", true),
    where("status", "==", "waiting")
  );
  return onSnapshot(q, (snapshot) => {
    const rooms = snapshot.docs.map(doc => doc.data() as RoomData);
    callback(rooms);
  }, (error) => {
    console.error("Error listening to public rooms:", error);
  });
}

export function listenToRoom(roomId: string) {
  if (roomUnsubscribe) roomUnsubscribe();

  let hasSyncedInitialState = false;
  let lastKnownPlayerStatuses: Record<number, string> = {};

  roomUnsubscribe = onSnapshot(doc(db, "rooms", roomId), (doc) => {
    if (!doc.exists()) {
      if (G.phase !== 'roundEnd') {
        leaveRoom();
      }
      return;
    }

    const data = doc.data() as RoomData;
    const wasHost = multiplayerState.isHost;
    multiplayerState.players = data.players;
    multiplayerState.hostId = data.hostId;
    multiplayerState.isHost = data.hostId === auth.currentUser?.uid;
    
    if (wasHost !== multiplayerState.isHost) {
      setMultiplayerMode(true, multiplayerState.isHost);
    }
    
    if (!wasHost && multiplayerState.isHost) {
      startHostTimer();
      startActionsListener(roomId);
    } else if (wasHost && !multiplayerState.isHost) {
      stopHostTimer();
      stopActionsListener();
    }
    
    // Safety check in case we join as Host immediately
    if (multiplayerState.isHost && !actionsUnsubscribe) {
      startActionsListener(roomId);
    }
    
    G.spectators = data.spectators || [];
    
    if (auth.currentUser) {
        const myPlayerRecord = data.players.find(p => p.uid === auth.currentUser?.uid);
        if (myPlayerRecord) {
            if (multiplayerState.myPlayerIndex !== myPlayerRecord.index) {
                multiplayerState.myPlayerIndex = myPlayerRecord.index;
                setMyPlayerIndex(myPlayerRecord.index);
            }
        } else {
            if (multiplayerState.myPlayerIndex !== -1) {
                multiplayerState.myPlayerIndex = -1;
                setMyPlayerIndex(-1);
            }
        }
    }
    
    // Track player reconnections for visual feedback
    for (let i = 0; i < 4; i++) {
       const p = data.players.find(x => x.index === i);
       if (p && G.playerNames) {
         G.playerNames[i] = p.name;
         
         // Detect reconnection: was disconnected, now connected
         const oldStatus = lastKnownPlayerStatuses[i];
         if (oldStatus === "disconnected" && p.status === "connected" && !p.isBot) {
           console.log(`Player ${p.name} (idx ${i}) has reconnected!`);
           // Show reconnection message briefly
           if (G.gameStarted) {
             G.gameMsg = `🔌 ${p.name} عاد للعبة!`;
             G.gameMsgClass = "";
           }
         }
         lastKnownPlayerStatuses[i] = p.status;
       }
    }
    
    // Sync Game State
    // If we just played an action locally (optimistic UI), ignore incoming state for a short time to prevent rubberbanding.
    if (!hasSyncedInitialState || (data.lastActionBy !== auth.currentUser?.uid && Date.now() > localActionLockUntil)) {
        if (data.gameState) {
          const newState = deserializeGameState(data.gameState);
          const oldPhase = G.phase;
          
          if (isDealingAnimationRunning) {
             const currentHands = G.hands;
             const currentDealing = G.dealingCards;
             Object.assign(G, newState);
             G.hands = currentHands;
             G.dealingCards = currentDealing;
          } else {
             Object.assign(G, newState);
          }
          
          if (G.phase === "dealing" && oldPhase !== "dealing") {
             dealCardsAnimation();
          }
          
          // Ensure turnStartTime is reasonable (avoid stale timestamps causing instant timeouts)
          if (G.turnStartTime && Date.now() - G.turnStartTime > 120000) {
            G.turnStartTime = Date.now();
          }
        }
        hasSyncedInitialState = true;
        lastSyncedCoreState = getCoreState();
        updateUI();
        
        // Host should resume game loop if it's an AI's turn or needs autonomous processing
        if (multiplayerState.isHost && !isDealingAnimationRunning && !justPlayedLocalAction) {
           resumeGameLoop();
        }
    }
  }, (error) => {
    console.error("Room listener error - attempting to reconnect...", error);
    // Attempt to re-listen after a short delay
    setTimeout(() => {
      if (activeRoomId && multiplayerState.isMultiplayer) {
        console.log("Re-establishing room listener...");
        listenToRoom(roomId);
      }
    }, 3000);
  });
}

let lastUpdatePromise: Promise<void> | null = null;
let pendingStateUpdate = false;
let lastSerializedState = "";
let syncRetryCount = 0;
const MAX_SYNC_RETRIES = 3;

export async function updateGameState() {
  if (!activeRoomId || !multiplayerState.isMultiplayer) return;
  if (pendingStateUpdate) return; 

  // Stability/Anti-Cheat: ONLY THE HOST should push state.
  if (!multiplayerState.isHost) return;  
  
  const newState = serializeGameState({ ...G });
  if (newState === lastSerializedState) return;

  pendingStateUpdate = true;
  await new Promise(resolve => setTimeout(resolve, 80));
  pendingStateUpdate = false;

  const finalState = serializeGameState({ ...G });
  if (finalState === lastSerializedState) return;

  const roomId = activeRoomId;
  for (let attempt = 0; attempt <= MAX_SYNC_RETRIES; attempt++) {
    try {
      lastSerializedState = finalState;
      const roomRef = doc(db, "rooms", roomId);
      
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        console.warn("Update Game State failed: Room no longer exists.");
        leaveRoom();
        return;
      }

      await updateDoc(roomRef, {
        gameState: finalState,
        lastActionBy: auth.currentUser?.uid,
        updatedAt: serverTimestamp()
      });
      syncRetryCount = 0;
      return;
    } catch (error: any) {
      lastSerializedState = "";
      if (attempt < MAX_SYNC_RETRIES) {
        const backoffMs = Math.min(200 * Math.pow(2, attempt), 2000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        syncRetryCount++;
        if (syncRetryCount >= 3) {
          G.gameMsg = "⚠️ مشكلة في الاتصال بـ سيرفر المضيف";
          G.gameMsgClass = "";
          import("./engine").then(eng => eng.updateUI());
        }
      }
    }
  }
}

export async function sendPlayerAction(action: any) {
  if (!activeRoomId || !auth.currentUser) return;
  try {
     const actionRef = doc(collection(db, "rooms", activeRoomId, "actions"));
     await setDoc(actionRef, {
        ...action,
        timestamp: serverTimestamp()
     });
  } catch (error) {
     console.error("Failed to send action", error);
  }
}

export async function leaveRoom(destroy = false) {
  const currentRoomId = activeRoomId;
  const user = auth.currentUser;
  
  if (roomUnsubscribe) roomUnsubscribe();
  roomUnsubscribe = null;
  stopHeartbeat();
  stopHostTimer();
  stopAntiHostFreezeTimer();
  stopActionsListener();
  activeRoomId = null;
  multiplayerState.isMultiplayer = false;
  multiplayerState.roomCode = "";
  multiplayerState.players = [];
  multiplayerState.myPlayerIndex = -1;
  multiplayerState.isHost = false;
  
  setMultiplayerMode(false, false);
  setMyPlayerIndex(0);
  
  G.phase = "intro";
  updateUI();
  localStorage.removeItem('tarneb_active_room');

  if (currentRoomId && user) {
    try {
      if (destroy) {
        await deleteDoc(doc(db, "rooms", currentRoomId));
      } else {
        const roomRef = doc(db, "rooms", currentRoomId);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
           const data = roomSnap.data() as RoomData;
           const uid = user.uid;
           const newPlayers = data.players.filter(p => p.uid !== uid);
           const newSpectators = (data.spectators || []).filter(s => s.uid !== uid);
           const newMembers = data.memberUids.filter(id => id !== uid);
           
           if (newMembers.length === 0) {
             await deleteDoc(roomRef);
           } else {
             const newHostId = data.hostId === uid ? newMembers[0] : data.hostId;
             
             // Only remove from players if the game hasn't started yet, to not break array lengths
             if (data.status === "waiting") {
               const newHostName = newPlayers.find(p => p.uid === newHostId)?.name || data.hostName;
               await updateDoc(roomRef, {
                 hostId: newHostId,
                 hostName: newHostName,
                 memberUids: newMembers,
                 players: newPlayers,
                 spectators: newSpectators,
                 updatedAt: serverTimestamp()
               });
             } else {
               const leavingPlayer = data.players.find(p => p.uid === uid);
               const updatedPlayers = data.players.map(p => {
                 if (p.uid === uid) {
                   return {
                     ...p,
                     uid: `bot_${p.index}_${Date.now()}`,
                     name: `كمبيوتر ${p.index + 1}`,
                     avatar: "🤖",
                     country: "AI",
                     isBot: true
                   } as Player;
                 }
                 return p;
               });

               let updatedGameState = data.gameState;
               if (leavingPlayer && updatedGameState && updatedGameState.playerNames) {
                  updatedGameState.playerNames[leavingPlayer.index] = `كمبيوتر ${leavingPlayer.index + 1}`;
               }

               await updateDoc(roomRef, {
                 hostId: newHostId,
                 memberUids: newMembers,
                 players: updatedPlayers,
                 spectators: newSpectators,
                 gameState: updatedGameState,
                 updatedAt: serverTimestamp()
               });
             }
           }
        }
      }
    } catch (e) {
       console.error("Error leaving room", e);
    }
  }
}

export async function startGame() {
  if (!activeRoomId || !multiplayerState.isHost) return;
  
  const roomRef = doc(db, "rooms", activeRoomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return;
  const data = roomSnap.data() as RoomData;

  const players = [...data.players];
  const playerNames = ["", "", "", ""];
  
  // Fill empty slots with bots
  const updatedPlayers = [...players];
  for (let i = 0; i < 4; i++) {
    const existingP = players.find(x => x.index === i);
    if (existingP) {
      playerNames[i] = existingP.name;
    } else {
      const botName = `كمبيوتر ${i + 1}`;
      playerNames[i] = botName;
      updatedPlayers.push({
        uid: `bot_${i}`,
        name: botName,
        avatar: "🤖",
        country: "AI",
        index: i,
        status: "connected",
        isBot: true
      });
    }
  }

  // Initialize engine state for everyone
  G.playerNames = playerNames as [string, string, string, string];
  G.scores = [0, 0, 0, 0];
  G.gameStarted = true;
  G.dealerIdx = Math.floor(Math.random() * 4);
  G.roundNumber = 0;
  
  // Save initial game state to avoid race condition with dealing animation clearing hands
  const initialState = serializeGameState({ ...G });
  
  try {
    await updateDoc(roomRef, {
      status: "playing",
      players: updatedPlayers,
      gameState: initialState,
      lastActionBy: auth.currentUser?.uid,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to start game", error);
  }

  // Now start the round, which triggers dealing animation and syncs automatically
  startNewRound();
}

/**
 * Clean up old room invites (e.g., older than 1 hour)
 * This helps keep the database performant.
 */
export async function cleanupOldInvites() {
  try {
    const user = auth.currentUser;
    if (!user) return;
    
    // Stricter than 1h to avoid clock sync issues (using 65 mins)
    const sixtyFiveMinsAgo = new Date(Date.now() - 65 * 60 * 1000);
    const q1 = query(
      collection(db, "roomInvites"),
      where("toUid", "==", user.uid),
      where("createdAt", "<", sixtyFiveMinsAgo)
    );
    const q2 = query(
      collection(db, "roomInvites"),
      where("fromUid", "==", user.uid),
      where("createdAt", "<", sixtyFiveMinsAgo)
    );
    
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const allDocs = [...snap1.docs, ...snap2.docs];
    
    for (const docSnap of allDocs) {
      try {
        await deleteDoc(docSnap.ref);
      } catch (err) {
        // Silently skip if we still don't have permission
      }
    }
    if (allDocs.length > 0) console.log(`Cleaned up ${allDocs.length} old invites.`);
  } catch (error) {
    // This often happens if the query logic doesn't perfectly match security rules
    // or if we have no permissions for these docs yet.
  }
}

/**
 * Clean up empty or stale rooms (host not seen for > 20 mins)
 */
export async function cleanupStaleRooms() {
  try {
    // Stricter than 15m to avoid clock sync issues (using 20 mins)
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
    const q = query(
      collection(db, "rooms"),
      where("updatedAt", "<", twentyMinsAgo)
    );
    const snapshot = await getDocs(q);
    
    for (const docSnap of snapshot.docs) {
      try {
        await deleteDoc(docSnap.ref);
      } catch (err) {
        // Skip individual errors
      }
    }
    if (snapshot.docs.length > 0) console.log(`Cleaned up ${snapshot.docs.length} stale rooms.`);
  } catch (error) {
    // Silent catch for background task
  }
}

export async function sendRoomInvite(friendUid: string, roomCode: string) {
  const user = auth.currentUser;
  const profile = getLocalProfile();
  if (!user) return;

  try {
    // Basic rate limiting/check: see if an invite already exists
    const existingQ = query(
      collection(db, "roomInvites"),
      where("fromUid", "==", user.uid),
      where("toUid", "==", friendUid),
      where("status", "==", "pending")
    );
    try {
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) return true;
    } catch (e) {
      console.error("Error in getDocs existingQ:", e);
      throw e;
    }

    try {
      const inviteId = `${user.uid}_${friendUid}_${roomCode}`;
      await setDoc(doc(db, "roomInvites", inviteId), {
        fromUid: user.uid,
        fromName: profile?.name || user.displayName || "صديق",
        fromAvatar: profile?.avatar || "👤",
        toUid: friendUid,
        roomCode,
        status: "pending",
        createdAt: serverTimestamp()
      });
      return true;
    } catch (e) {
      console.error("Error in setDoc roomInvite:", e);
      throw e;
    }
  } catch (error) {
    console.error("Error sending room invite:", error);
    return false;
  }
}

export async function respondToRoomInvite(inviteId: string, roomCode: string, status: "accepted" | "rejected") {
  try {
    if (status === "accepted") {
      await deleteDoc(doc(db, "roomInvites", inviteId));
      return true;
    } else {
      await deleteDoc(doc(db, "roomInvites", inviteId));
      return false;
    }
  } catch (error) {
    console.error("Error responding to room invite:", error);
    return false;
  }
}

export function listenToRoomInvites(callback: (invites: any[]) => void) {
  const user = auth.currentUser;
  if (!user) return () => {};

  const q = query(
    collection(db, "roomInvites"),
    where("toUid", "==", user.uid),
    where("status", "==", "pending")
  );

  return onSnapshot(q, (snapshot) => {
    const invites = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(invites);
  });
}

export async function swapPlayerWithSpectator(playerIndex: number, spectatorUid: string) {
  if (!activeRoomId || !multiplayerState.isHost) return;

  try {
    const roomRef = doc(db, "rooms", activeRoomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const data = roomSnap.data() as RoomData;

    const spectator = data.spectators.find(s => s.uid === spectatorUid);
    if (!spectator) return;

    const oldPlayer = data.players.find(p => p.index === playerIndex);
    const updatedPlayers = data.players.filter(p => p.index !== playerIndex);
    const updatedSpectators = data.spectators.filter(s => s.uid !== spectatorUid);

    // Add spectator to players
    updatedPlayers.push({
      uid: spectator.uid,
      name: spectator.name,
      avatar: spectator.avatar,
      country: "??",
      index: playerIndex,
      status: "connected"
    });

    // Add old player to spectators if they are not a bot
    if (oldPlayer && !oldPlayer.uid.startsWith("bot_")) {
      updatedSpectators.push({
        uid: oldPlayer.uid,
        name: oldPlayer.name,
        avatar: oldPlayer.avatar
      });
    }

    await updateDoc(roomRef, {
      players: updatedPlayers,
      spectators: updatedSpectators,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error swapping player with spectator:", error);
  }
}
