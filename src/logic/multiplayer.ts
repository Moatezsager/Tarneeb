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
import { G, updateUI, Phase, setOnSyncNeeded, setMyPlayerIndex, myPlayerIndex, setMultiplayerMode, startNewRound, dealCardsAnimation, forceAiAction } from "./engine";
import { getLocalProfile } from "./userProfile";

let timerInterval: any = null;

window.addEventListener('tarneb-leave-room-end', () => {
   leaveRoom(multiplayerState.isHost);
});

window.addEventListener('tarneb-leave-room', () => {
   leaveRoom(false);
});

setOnSyncNeeded(() => {
  if (multiplayerState.isMultiplayer && multiplayerState.isHost) {
    updateGameState();
  }
});

function startHostTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!multiplayerState.isHost || !multiplayerState.isMultiplayer) return;
    if (G.phase !== "playing" && G.phase !== "bidding") return;
    if (!G.gameStarted) return;
    
    // Check if turn timeout reached
    const now = Date.now();
    const elapsed = (now - G.turnStartTime) / 1000;
    
    // Only force AI move for REAL players who timed out
    const currentPlayerIsBot = G.playerNames[G.currentPlayer].includes("كمبيوتر");
    
    if (!currentPlayerIsBot && elapsed > G.turnTimeout) {
       console.log(`Player ${G.currentPlayer} (${G.playerNames[G.currentPlayer]}) timed out. Forcing AI move.`);
       forceAiAction(G.currentPlayer);
       updateGameState();
    }
  }, 2000);
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
  index: number;
  status: "connected" | "disconnected";
  isBot?: boolean;
}

export interface Spectator {
  uid: string;
  name: string;
  avatar: string;
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

export const multiplayerState = {
  isMultiplayer: false,
  roomCode: "",
  players: [] as Player[],
  myPlayerIndex: -1,
  isHost: false,
};

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function serializeGameState(state: any): any {
  if (Array.isArray(state)) {
    return state.map(item => serializeGameState(item));
  }
  
  if (state !== null && typeof state === 'object') {
    const serialized: any = {};
    for (const key in state) {
      const value = state[key];
      // Special handling for G.hands which is Card[][]
      if (key === 'hands' && Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
        serialized[key] = {
          h0: serializeGameState(value[0]),
          h1: serializeGameState(value[1]),
          h2: serializeGameState(value[2]),
          h3: serializeGameState(value[3])
        };
      } else {
        serialized[key] = serializeGameState(value);
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

export async function createRoom(playerName: string, isPublic = true, password = "", winLimit = 31) {
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
        index: 0, 
        status: "connected" 
      }
    ],
    spectators: [],
    memberUids: [user.uid],
    gameState: serializeGameState({ ...G, phase: "intro", target: winLimit }),
    lastActionBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  G.target = winLimit;

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
    
    listenToRoom(roomId);
    startHostTimer();
    return code;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `rooms/${roomId}`);
  }
}

export async function joinRoom(code: string, playerName: string, passwordAttempt = "", asSpectator = false) {
  if (!auth.currentUser) throw new Error("يجب تسجيل الدخول أولاً");
  
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
          avatar: profile?.avatar || "👤"
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
      const existingPlayer = data.players.find(p => p.uid === user.uid);
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
    
    listenToRoom(roomId);
    if (multiplayerState.isHost) startHostTimer();
    return roomId;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}`);
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

export function listenToRoom(roomId: string) {
  if (roomUnsubscribe) roomUnsubscribe();

  let hasSyncedInitialState = false;

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
    multiplayerState.isHost = data.hostId === auth.currentUser?.uid;
    
    if (!wasHost && multiplayerState.isHost) {
      startHostTimer();
    } else if (wasHost && !multiplayerState.isHost) {
      stopHostTimer();
    }
    
    G.spectators = data.spectators || [];
    
    // Sync Game State
    if (data.lastActionBy !== auth.currentUser?.uid || !hasSyncedInitialState) {
        if (data.gameState) {
          const newState = deserializeGameState(data.gameState);
          const oldPhase = G.phase;
          
          Object.assign(G, newState);
          
          if (G.phase === "dealing" && oldPhase !== "dealing") {
             dealCardsAnimation();
          }
        }
        hasSyncedInitialState = true;
        updateUI();
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`);
  });
}

export async function updateGameState() {
  if (!activeRoomId || !multiplayerState.isMultiplayer) return;

  try {
    await updateDoc(doc(db, "rooms", activeRoomId), {
      gameState: serializeGameState({ ...G }),
      lastActionBy: auth.currentUser?.uid,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Multiplayer Sync Error", error);
  }
}

export async function leaveRoom(destroy = false) {
  const currentRoomId = activeRoomId;
  const user = auth.currentUser;
  
  if (roomUnsubscribe) roomUnsubscribe();
  roomUnsubscribe = null;
  stopHostTimer();
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
               await updateDoc(roomRef, {
                 hostId: newHostId,
                 memberUids: newMembers,
                 spectators: newSpectators,
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
  
  // Start the first round (includes shuffling and dealing animation)
  // This will transition G.phase to "dealing"
  await startNewRound();
  
  try {
    await updateDoc(roomRef, {
      status: "playing",
      players: updatedPlayers,
      gameState: serializeGameState({ ...G }),
      lastActionBy: auth.currentUser?.uid,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to start game", error);
  }
}

export async function sendRoomInvite(friendUid: string, roomCode: string) {
  const user = auth.currentUser;
  const profile = getLocalProfile();
  if (!user) return;

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
