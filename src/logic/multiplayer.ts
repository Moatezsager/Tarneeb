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
import { G, updateUI, Phase, setOnSyncNeeded, setMyPlayerIndex, myPlayerIndex, setMultiplayerMode, startNewRound, dealCardsAnimation, forceAiAction, isDealingAnimationRunning, justPlayedLocalAction, setJustPlayedLocalAction, resumeGameLoop, executeAISwap } from "./engine";
import { getLocalProfile } from "./userProfile";

let timerInterval: any = null;
let pingInterval: any = null;

function startHeartbeat() {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(async () => {
    if (!activeRoomId || !auth.currentUser) return;
    try {
       const roomRef = doc(db, "rooms", activeRoomId);
       const players = multiplayerState.players;
       if (players.length > 0) {
          let hasChange = false;
          const updatedPlayers = players.map(p => {
             if (p.uid === auth.currentUser!.uid) {
                // Update our timestamp, considered a change to keep connection alive
                hasChange = true;
                return { ...p, lastPing: Date.now(), status: "connected" as const };
             }
             if (!p.isBot && p.lastPing && Date.now() - p.lastPing > 30000 && p.status !== "disconnected") {
                hasChange = true;
                return { ...p, status: "disconnected" as const };
             }
             return p;
          });
          
          if (hasChange) {
            await updateDoc(roomRef, { players: updatedPlayers });
          }
       }
    } catch (e) {
       console.error("Heartbeat failed", e);
    }
  }, 10000); // 10 seconds
}

function stopHeartbeat() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
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
       round: G.roundNumber
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
    if (G.phase !== "playing" && G.phase !== "bidding" && G.phase !== "swapping") return;
    if (!G.gameStarted) return;
    
    // Check if turn timeout reached
    const now = Date.now();
    const elapsed = (now - G.turnStartTime) / 1000;
    
    const actingPlayer = G.phase === "swapping" ? G.playerWithHighestScore : G.currentPlayer;
    const currentPlayerIsBot = Object.values(G.playerNames).length > actingPlayer && G.playerNames[actingPlayer] && G.playerNames[actingPlayer].includes("كمبيوتر");
    
    if (currentPlayerIsBot) {
       // If it's a bot and it's stuck for > 5 seconds (bots normally play in 1.5s), fix it
       // This handles the case where a player disconnects mid-turn and becomes a bot, losing the delayed timeout
       if (elapsed > 6) {
          console.log(`Bot ${actingPlayer} seems stuck. Forcing AI move.`);
          // Adjust turnStartTime so we don't spam if it takes a bit
          G.turnStartTime = Date.now();
          if (G.phase === "swapping") executeAISwap();
          else forceAiAction(actingPlayer);
          updateGameState();
       }
    } else {
       if (elapsed > G.turnTimeout) {
          console.log(`Player ${actingPlayer} (${G.playerNames[actingPlayer]}) timed out. AFK Bot taking over for this turn.`);
          // DO NOT convertPlayerToBot(actingPlayer) so they can return!
          G.turnStartTime = Date.now();
          if (G.phase === "swapping") executeAISwap();
          else forceAiAction(actingPlayer);
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
  index: number;
  status: "connected" | "disconnected";
  isBot?: boolean;
  lastPing?: number;
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
  spectators: [] as Spectator[],
  myPlayerIndex: -1,
  isHost: false,
  isPublic: true,
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

let antiHostInterval: any = null;
function startAntiHostFreezeTimer() {
  if (antiHostInterval) clearInterval(antiHostInterval);
  antiHostInterval = setInterval(() => {
    if (multiplayerState.isHost || !multiplayerState.isMultiplayer) return;
    if (G.phase !== "playing" && G.phase !== "bidding") return;
    if (!G.gameStarted) return;
    if (!activeRoomId) return;

    const now = Date.now();
    const elapsed = (now - G.turnStartTime) / 1000;
    
    // If the host hasn't done anything (turn is stuck for > turnTimeout + 15 seconds)
    // We assume host is dead and take over.
    if (elapsed > G.turnTimeout + 15) {
      console.log("Host seems dead. Taking over...");
      takeOverHost();
    }
  }, 5000);
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
    
    // Safety check: Maybe someone else just took over?
    if (!data.memberUids.includes(data.hostId)) {
        // host is already leaving?
    }
    
    // Only the first available non-bot member should take over. 
    // We can rely on memberUids order.
    const activeMembers = data.memberUids;
    if (activeMembers[0] === user.uid || (activeMembers[0] === data.hostId && activeMembers[1] === user.uid)) {
        console.log("I am taking over as host!");
        const newHostName = data.players.find(p => p.uid === user.uid)?.name || "لاعب";
        
        // Also convert the old host to a bot immediately since they are dead
        const deadHostId = data.hostId;
        const deadHostPlayer = data.players.find(p => p.uid === deadHostId);
        
        const updatedPlayers = data.players.map(p => {
            if (p.uid === deadHostId) {
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
        }

        const newMembers = activeMembers.filter(id => id !== deadHostId);

        await updateDoc(roomRef, {
            hostId: user.uid,
            hostName: newHostName,
            memberUids: newMembers,
            players: updatedPlayers,
            gameState: updatedGameState,
            updatedAt: serverTimestamp()
        });
    }
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
        index: 0, 
        status: "connected" 
      }
    ],
    spectators: [],
    memberUids: [user.uid],
    gameState: serializeGameState({ ...G, phase: "intro", target: winLimit, gameMode: mode }),
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
    
    if (wasHost !== multiplayerState.isHost) {
      setMultiplayerMode(true, multiplayerState.isHost);
    }
    
    if (!wasHost && multiplayerState.isHost) {
      startHostTimer();
    } else if (wasHost && !multiplayerState.isHost) {
      stopHostTimer();
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
    
    for (let i = 0; i < 4; i++) {
       const p = data.players.find(x => x.index === i);
       if (p && G.playerNames) G.playerNames[i] = p.name;
    }
    
    // Sync Game State
    if (data.lastActionBy !== auth.currentUser?.uid || !hasSyncedInitialState) {
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
    handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`);
  });
}

let lastUpdatePromise: Promise<void> | null = null;
let pendingStateUpdate = false;
let lastSerializedState = "";

export async function updateGameState() {
  if (!activeRoomId || !multiplayerState.isMultiplayer) return;
  if (pendingStateUpdate) return; 
  
  const newState = serializeGameState({ ...G });
  if (newState === lastSerializedState) return;

  pendingStateUpdate = true;
  // Delay to batch possible rapid updates
  await new Promise(resolve => setTimeout(resolve, 150));
  pendingStateUpdate = false;

  const finalState = serializeGameState({ ...G });
  if (finalState === lastSerializedState) return;

  try {
    lastSerializedState = finalState;
    const roomRef = doc(db, "rooms", activeRoomId);
    await updateDoc(roomRef, {
      gameState: finalState,
      lastActionBy: auth.currentUser?.uid,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Multiplayer Sync Error", error);
    lastSerializedState = ""; // Allow retry on failure
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
  
  // Do not await here so the room status and basic state update immediately
  // and clients can join the dealing phase. startNewRound triggers onSyncNeeded internally.
  startNewRound();
  
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
