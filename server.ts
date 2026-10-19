import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Google OAuth Client
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Types
export interface PlayerData {
  id: string;
  sessionToken: string;
  googleId: string; // Stable Google User ID (sub)
  googleEmail?: string; // Kept private on server
  googlePicture?: string;
  nickname: string;
  characterIndex: number;
  ws?: WebSocket;
  connected: boolean;
  score: number;
  rescuedCount: number;
  recoveries: number;
  phaseRescued: { [phaseId: string]: number };
  phaseScores: { [phaseId: string]: number };
  phaseTimes: { [phaseId: string]: number }; // seconds spent
  phaseFinished: { [phaseId: string]: boolean };
  collectedHearts: { [key: string]: boolean };
  activatedMechanisms: { [key: string]: boolean };
  rescuedElderly: { [key: string]: boolean };
  joinedAt: number;
}

export type GameState = 
  | 'LOBBY'
  | 'COUNTDOWN'
  | 'TUTORIAL'
  | 'PHASE_1'
  | 'INTERMISSION_1'
  | 'PHASE_2'
  | 'INTERMISSION_2'
  | 'PHASE_3'
  | 'INTERMISSION_3'
  | 'PODIUM';

export interface Room {
  pin: string;
  hostWs?: WebSocket;
  hostSecret: string;
  state: GameState;
  nextState?: GameState;
  phaseTimeLimit: number; // in seconds
  timeRemaining: number;
  isPaused: boolean;
  isLocked: boolean;
  countdown: number;
  players: Map<string, PlayerData>; // key: playerId
  playersByGoogleId: Map<string, string>; // key: googleId -> playerId
  createdAt: number;
  activePhaseId: string;
}

const rooms = new Map<string, Room>();

// Helper to get local network IPv4 address for QR code and mobile connection
function getLocalNetworkIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal && alias.address !== '127.0.0.1') {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

function generatePin(): string {
  let pin = '';
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(pin));
  return pin;
}

// Verify Google Token (Real ID Token Verification)
async function verifyGoogleIdToken(token: string) {
  if (!token) return null;

  // 1. Try OAuth2Client verifyIdToken if client ID is configured
  if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith('SEU_GOOGLE')) {
    try {
      const ticket = await oauthClient.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (payload) {
        return {
          googleId: payload.sub,
          email: payload.email,
          name: payload.name || payload.email?.split('@')[0] || 'Participante',
          picture: payload.picture,
        };
      }
    } catch (err) {
      console.warn('OAuth2Client verification failed, attempting tokeninfo fallback...');
    }
  }

  // 2. Direct Google tokeninfo validation
  try {
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (resp.ok) {
      const data: any = await resp.json();
      if (data && data.sub) {
        return {
          googleId: data.sub,
          email: data.email,
          name: data.name || data.email?.split('@')[0] || 'Participante',
          picture: data.picture,
        };
      }
    }
  } catch (err) {
    console.error('Google tokeninfo fetch error:', err);
  }

  return null;
}

function calculateRankings(room: Room) {
  const playerList = Array.from(room.players.values());

  // Sorting hierarchy per official VIRLA rules:
  // 1. Highest total elderly rescued
  // 2. Highest total score
  // 3. Lowest number of recoveries
  // 4. Lowest sum of completion times
  return playerList.sort((a, b) => {
    if (b.rescuedCount !== a.rescuedCount) {
      return b.rescuedCount - a.rescuedCount;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.recoveries !== b.recoveries) {
      return a.recoveries - b.recoveries;
    }
    const aTime = Object.values(a.phaseTimes).reduce((sum, t) => sum + t, 0);
    const bTime = Object.values(b.phaseTimes).reduce((sum, t) => sum + t, 0);
    return aTime - bTime;
  });
}

function getSanitizedPlayers(room: Room) {
  const ranked = calculateRankings(room);
  return ranked.map((p, index) => {
    const totalTime = Object.values(p.phaseTimes).reduce((sum, t) => sum + t, 0);
    const currentFinished = room.activePhaseId ? !!p.phaseFinished[room.activePhaseId] : false;
    // Note: NEVER expose p.googleEmail or p.googleId to keep public projection private!
    return {
      id: p.id,
      rank: index + 1,
      nickname: p.nickname,
      characterIndex: p.characterIndex,
      connected: p.connected,
      score: p.score,
      rescuedCount: p.rescuedCount,
      recoveries: p.recoveries,
      currentFinished,
      totalTime,
    };
  });
}

function broadcastToRoom(room: Room, message: any, excludeWs?: WebSocket) {
  const data = JSON.stringify(message);
  if (room.hostWs && room.hostWs !== excludeWs && room.hostWs.readyState === WebSocket.OPEN) {
    room.hostWs.send(data);
  }
  for (const player of room.players.values()) {
    if (player.ws && player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

function broadcastToHost(room: Room, message: any) {
  if (room.hostWs && room.hostWs.readyState === WebSocket.OPEN) {
    room.hostWs.send(JSON.stringify(message));
  }
}

function sendToPlayer(player: PlayerData, message: any) {
  if (player.ws && player.ws.readyState === WebSocket.OPEN) {
    player.ws.send(JSON.stringify(message));
  }
}

// Room timer ticker
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.isPaused) continue;

    // Handle countdowns
    if (room.state === 'COUNTDOWN') {
      room.countdown--;
      broadcastToRoom(room, {
        type: 'COUNTDOWN_TICK',
        countdown: room.countdown,
        nextState: room.nextState,
      });

      if (room.countdown <= 0) {
        if (room.nextState) {
          transitionRoomState(room, room.nextState);
        }
      }
      continue;
    }

    // Active gameplay phases
    const isGameplay = ['TUTORIAL', 'PHASE_1', 'PHASE_2', 'PHASE_3'].includes(room.state);
    if (isGameplay && room.timeRemaining > 0) {
      room.timeRemaining--;

      // Update unfinished players' time in this phase
      for (const p of room.players.values()) {
        if (p.connected && !p.phaseFinished[room.activePhaseId]) {
          p.phaseTimes[room.activePhaseId] = (p.phaseTimes[room.activePhaseId] || 0) + 1;
        }
      }

      // Check if all connected players finished
      const connectedPlayers = Array.from(room.players.values()).filter(p => p.connected);
      const allFinished = connectedPlayers.length > 0 && connectedPlayers.every(p => p.phaseFinished[room.activePhaseId]);

      if (room.timeRemaining <= 0 || allFinished) {
        // End phase
        const nextIntermission: GameState = 
          room.state === 'TUTORIAL' ? 'LOBBY' :
          room.state === 'PHASE_1' ? 'INTERMISSION_1' :
          room.state === 'PHASE_2' ? 'INTERMISSION_2' :
          'INTERMISSION_3';
        
        transitionRoomState(room, nextIntermission);
      } else if (room.timeRemaining % 5 === 0 || room.timeRemaining <= 10) {
        // Broadcast timer sync
        broadcastToRoom(room, {
          type: 'TIMER_SYNC',
          timeRemaining: room.timeRemaining,
          rankings: getSanitizedPlayers(room),
        });
      }
    }
  }
}, 1000);

function transitionRoomState(room: Room, newState: GameState) {
  room.state = newState;
  room.isPaused = false;

  if (newState === 'TUTORIAL') {
    room.activePhaseId = 'tutorial';
    room.phaseTimeLimit = 35; // 30s tutorial + 5s grace
    room.timeRemaining = room.phaseTimeLimit;
  } else if (newState === 'PHASE_1') {
    room.activePhaseId = 'fase1';
    room.phaseTimeLimit = 120; // 2 minutes
    room.timeRemaining = room.phaseTimeLimit;
  } else if (newState === 'PHASE_2') {
    room.activePhaseId = 'fase2';
    room.phaseTimeLimit = 120;
    room.timeRemaining = room.phaseTimeLimit;
  } else if (newState === 'PHASE_3') {
    room.activePhaseId = 'fase3';
    room.phaseTimeLimit = 120;
    room.timeRemaining = room.phaseTimeLimit;
  } else {
    room.activePhaseId = '';
    room.timeRemaining = 0;
  }

  // Clear phase finished flags for all players when entering a new competitive phase
  if (['TUTORIAL', 'PHASE_1', 'PHASE_2', 'PHASE_3'].includes(newState)) {
    for (const p of room.players.values()) {
      p.phaseFinished[room.activePhaseId] = false;
    }
  }

  broadcastToRoom(room, {
    type: 'ROOM_STATE_CHANGE',
    state: room.state,
    activePhaseId: room.activePhaseId,
    timeRemaining: room.timeRemaining,
    phaseTimeLimit: room.phaseTimeLimit,
    rankings: getSanitizedPlayers(room),
  });
}

function startCountdown(room: Room, targetState: GameState) {
  room.state = 'COUNTDOWN';
  room.nextState = targetState;
  room.countdown = 3;
  broadcastToRoom(room, {
    type: 'COUNTDOWN_START',
    countdown: 3,
    nextState: targetState,
  });
}

// Server App setup
const app = express();
app.use(express.json());

// API Endpoints
app.get('/api/auth/config', (req, res) => {
  res.json({
    googleClientId: GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith('SEU_GOOGLE') ? GOOGLE_CLIENT_ID : null,
  });
});

app.post('/api/auth/google', async (req, res) => {
  const { credential, testGoogleUser } = req.body;

  // Real Google verification
  if (credential) {
    const verified = await verifyGoogleIdToken(credential);
    if (verified) {
      return res.json({ success: true, googleUser: verified });
    }
    return res.status(401).json({ success: false, message: 'Token de autenticação Google inválido.' });
  }

  // Developer fallback for testing when Google Client ID has not been created yet in Google Cloud Console
  if (testGoogleUser && testGoogleUser.googleId && testGoogleUser.email) {
    return res.json({
      success: true,
      googleUser: {
        googleId: testGoogleUser.googleId,
        email: testGoogleUser.email,
        name: testGoogleUser.name || 'Participante Google',
        picture: testGoogleUser.picture || '',
      },
    });
  }

  return res.status(400).json({ success: false, message: 'Nenhuma credencial Google fornecida.' });
});

app.get('/api/network-info', (req, res) => {
  const localIp = getLocalNetworkIp();
  const port = process.env.PORT || 3000;
  res.json({
    localIp,
    port,
    fullUrl: `http://${localIp}:${port}`,
  });
});

app.get('/api/room/:pin/export.csv', (req, res) => {
  const room = rooms.get(req.params.pin);
  if (!room) {
    return res.status(404).send('Sala não encontrada');
  }

  const rankings = calculateRankings(room);
  let csv = 'Posição,Apelido,Personagem,Idosos Ajudados,Pontuação Total,Recuperações,Tempo Total (s),Fase 1 Pontos,Fase 2 Pontos,Fase 3 Pontos\n';
  
  const charNames = ['Clara (Colete Roxo)', 'Lucas (Colete & Boné)', 'Mariana (Colete & Tênis)'];

  rankings.forEach((p, idx) => {
    const totalTime = Object.values(p.phaseTimes).reduce((a, b) => a + b, 0);
    const f1 = p.phaseScores['fase1'] || 0;
    const f2 = p.phaseScores['fase2'] || 0;
    const f3 = p.phaseScores['fase3'] || 0;
    csv += `${idx + 1},"${p.nickname.replace(/"/g, '""')}","${charNames[p.characterIndex] || 'Cuidador'}",${p.rescuedCount},${p.score},${p.recoveries},${totalTime},${f1},${f2},${f3}\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="VIRLA_Resultado_${room.pin}.csv"`);
  res.send('\uFEFF' + csv); // UTF-8 BOM for Excel compatibility
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  let boundPin: string | null = null;
  let boundPlayerId: string | null = null;
  let isHost = false;

  ws.on('message', (messageRaw: string) => {
    try {
      const msg = JSON.parse(messageRaw.toString());

      // 1. HOST: CREATE ROOM
      if (msg.type === 'HOST_CREATE_ROOM') {
        const pin = generatePin();
        const hostSecret = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const room: Room = {
          pin,
          hostWs: ws,
          hostSecret,
          state: 'LOBBY',
          phaseTimeLimit: 0,
          timeRemaining: 0,
          isPaused: false,
          isLocked: false,
          countdown: 0,
          players: new Map(),
          playersByGoogleId: new Map(),
          createdAt: Date.now(),
          activePhaseId: '',
        };
        rooms.set(pin, room);
        boundPin = pin;
        isHost = true;

        ws.send(JSON.stringify({
          type: 'HOST_ROOM_CREATED',
          pin,
          hostSecret,
          localIp: getLocalNetworkIp(),
          port: process.env.PORT || 3000,
        }));
        return;
      }

      // 2. HOST: RECONNECT
      if (msg.type === 'HOST_RECONNECT') {
        const room = rooms.get(msg.pin);
        if (room && room.hostSecret === msg.hostSecret) {
          room.hostWs = ws;
          boundPin = room.pin;
          isHost = true;
          ws.send(JSON.stringify({
            type: 'HOST_RECONNECTED',
            room: {
              pin: room.pin,
              state: room.state,
              timeRemaining: room.timeRemaining,
              isPaused: room.isPaused,
              isLocked: room.isLocked,
              activePhaseId: room.activePhaseId,
              players: getSanitizedPlayers(room),
            },
          }));
        } else {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Sessão de apresentador inválida ou expirada.' }));
        }
        return;
      }

      // 3. HOST ACTIONS (Protected by isHost & boundPin)
      if (isHost && boundPin) {
        const room = rooms.get(boundPin);
        if (!room) return;

        if (msg.type === 'HOST_START_COUNTDOWN') {
          startCountdown(room, msg.targetState as GameState);
          return;
        }

        if (msg.type === 'HOST_CHANGE_STATE') {
          transitionRoomState(room, msg.targetState as GameState);
          return;
        }

        if (msg.type === 'HOST_TOGGLE_PAUSE') {
          room.isPaused = !room.isPaused;
          broadcastToRoom(room, {
            type: 'ROOM_PAUSE_CHANGED',
            isPaused: room.isPaused,
          });
          return;
        }

        if (msg.type === 'HOST_TOGGLE_LOCK') {
          room.isLocked = !room.isLocked;
          broadcastToRoom(room, {
            type: 'ROOM_LOCK_CHANGED',
            isLocked: room.isLocked,
          });
          return;
        }

        if (msg.type === 'HOST_KICK_PLAYER') {
          const player = room.players.get(msg.playerId);
          if (player) {
            sendToPlayer(player, { type: 'KICKED', reason: 'Você foi removido pelo apresentador.' });
            if (player.ws) player.ws.close();
            room.playersByGoogleId.delete(player.googleId);
            room.players.delete(msg.playerId);
            broadcastToRoom(room, {
              type: 'PLAYER_LIST_UPDATE',
              players: getSanitizedPlayers(room),
            });
          }
          return;
        }

        if (msg.type === 'HOST_END_PHASE') {
          const nextState: GameState = 
            room.state === 'PHASE_1' ? 'INTERMISSION_1' :
            room.state === 'PHASE_2' ? 'INTERMISSION_2' :
            room.state === 'PHASE_3' ? 'INTERMISSION_3' :
            room.state === 'TUTORIAL' ? 'LOBBY' : 'PODIUM';
          transitionRoomState(room, nextState);
          return;
        }
      }

      // 4. PLAYER: JOIN ROOM (With Google Authentication identifier)
      if (msg.type === 'PLAYER_JOIN') {
        const pin = String(msg.pin).trim();
        const googleId = String(msg.googleId || '').trim();
        const nickname = String(msg.nickname || '').trim().substring(0, 16);
        const charIndex = Math.max(0, Math.min(2, Number(msg.characterIndex) || 0));

        if (!googleId) {
          ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'É necessário fazer login com a conta Google para entrar.' }));
          return;
        }

        const room = rooms.get(pin);
        if (!room) {
          ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'Código PIN inválido ou sala não encontrada.' }));
          return;
        }

        // Check if player with this Google account already exists in this room!
        const existingPlayerId = room.playersByGoogleId.get(googleId);
        if (existingPlayerId) {
          const existingPlayer = room.players.get(existingPlayerId);
          if (existingPlayer) {
            // Disconnect old session if active
            if (existingPlayer.ws && existingPlayer.ws !== ws && existingPlayer.ws.readyState === WebSocket.OPEN) {
              const oldWs = existingPlayer.ws;
              oldWs.send(JSON.stringify({
                type: 'SESSION_REPLACED',
                reason: 'Sua conta Google foi conectada em outra aba ou aparelho.',
              }));
              setTimeout(() => {
                try {
                  if (oldWs.readyState === WebSocket.OPEN) oldWs.close();
                } catch {}
              }, 150);
            }

            // Rebind connection
            existingPlayer.ws = ws;
            existingPlayer.connected = true;
            boundPin = room.pin;
            boundPlayerId = existingPlayer.id;

            ws.send(JSON.stringify({
              type: 'JOIN_SUCCESS',
              playerId: existingPlayer.id,
              sessionToken: existingPlayer.sessionToken,
              roomState: room.state,
              activePhaseId: room.activePhaseId,
              pin: room.pin,
              nickname: existingPlayer.nickname,
              characterIndex: existingPlayer.characterIndex,
              score: existingPlayer.score,
              rescuedCount: existingPlayer.rescuedCount,
              recoveries: existingPlayer.recoveries,
              phaseFinished: existingPlayer.phaseFinished[room.activePhaseId] || false,
            }));

            broadcastToRoom(room, {
              type: 'PLAYER_LIST_UPDATE',
              players: getSanitizedPlayers(room),
            });
            return;
          }
        }

        // New player validations
        if (room.isLocked) {
          ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'Esta sala foi trancada pelo apresentador.' }));
          return;
        }

        // Room capacity limit: max 45 players
        if (room.players.size >= 45) {
          ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'A sala atingiu a capacidade máxima de 45 participantes.' }));
          return;
        }

        // Game already started check (new players blocked, only reconnects allowed)
        if (room.state !== 'LOBBY') {
          ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'A partida já começou! Não é possível entrar agora.' }));
          return;
        }

        // Nickname uniqueness in room
        const nameTaken = Array.from(room.players.values()).some(
          p => p.nickname.toLowerCase() === nickname.toLowerCase()
        );
        if (nameTaken) {
          ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'Este apelido já está em uso na sala. Escolha outro!' }));
          return;
        }

        // Create player
        const playerId = 'p_' + Math.random().toString(36).substring(2, 9);
        const sessionToken = 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        const player: PlayerData = {
          id: playerId,
          sessionToken,
          googleId,
          googleEmail: msg.googleEmail,
          googlePicture: msg.googlePicture,
          nickname,
          characterIndex: charIndex,
          ws,
          connected: true,
          score: 0,
          rescuedCount: 0,
          recoveries: 0,
          phaseRescued: {},
          phaseScores: {},
          phaseTimes: {},
          phaseFinished: {},
          collectedHearts: {},
          activatedMechanisms: {},
          rescuedElderly: {},
          joinedAt: Date.now(),
        };

        room.players.set(playerId, player);
        room.playersByGoogleId.set(googleId, playerId);
        boundPin = pin;
        boundPlayerId = playerId;

        ws.send(JSON.stringify({
          type: 'JOIN_SUCCESS',
          playerId,
          sessionToken,
          roomState: room.state,
          pin: room.pin,
          nickname: player.nickname,
          characterIndex: player.characterIndex,
        }));

        broadcastToRoom(room, {
          type: 'PLAYER_LIST_UPDATE',
          players: getSanitizedPlayers(room),
        });
        return;
      }

      // 5. PLAYER: RECONNECT
      if (msg.type === 'PLAYER_RECONNECT') {
        const pin = String(msg.pin).trim();
        const sessionToken = String(msg.sessionToken).trim();
        const googleId = String(msg.googleId || '').trim();
        const room = rooms.get(pin);

        if (!room) {
          ws.send(JSON.stringify({ type: 'RECONNECT_ERROR', message: 'Sala não encontrada.' }));
          return;
        }

        let existingPlayer: PlayerData | undefined;
        if (googleId && room.playersByGoogleId.has(googleId)) {
          const pid = room.playersByGoogleId.get(googleId)!;
          existingPlayer = room.players.get(pid);
        } else {
          for (const p of room.players.values()) {
            if (p.sessionToken === sessionToken) {
              existingPlayer = p;
              break;
            }
          }
        }

        if (!existingPlayer) {
          ws.send(JSON.stringify({ type: 'RECONNECT_ERROR', message: 'Sessão não encontrada ou expirada.' }));
          return;
        }

        // Close previous connection if still open
        if (existingPlayer.ws && existingPlayer.ws !== ws && existingPlayer.ws.readyState === WebSocket.OPEN) {
          existingPlayer.ws.send(JSON.stringify({
            type: 'SESSION_REPLACED',
            reason: 'Sua conta Google foi conectada em outra aba ou aparelho.',
          }));
          existingPlayer.ws.close();
        }

        // Reconnect player
        existingPlayer.ws = ws;
        existingPlayer.connected = true;
        boundPin = room.pin;
        boundPlayerId = existingPlayer.id;

        ws.send(JSON.stringify({
          type: 'RECONNECT_SUCCESS',
          playerId: existingPlayer.id,
          sessionToken: existingPlayer.sessionToken,
          nickname: existingPlayer.nickname,
          characterIndex: existingPlayer.characterIndex,
          score: existingPlayer.score,
          rescuedCount: existingPlayer.rescuedCount,
          recoveries: existingPlayer.recoveries,
          roomState: room.state,
          activePhaseId: room.activePhaseId,
          timeRemaining: room.timeRemaining,
          phaseFinished: existingPlayer.phaseFinished[room.activePhaseId] || false,
        }));

        broadcastToRoom(room, {
          type: 'PLAYER_LIST_UPDATE',
          players: getSanitizedPlayers(room),
        });
        return;
      }

      // 6. PLAYER GAMEPLAY ACTIONS (Server Authoritative)
      if (boundPin && boundPlayerId) {
        const room = rooms.get(boundPin);
        if (!room) return;
        const player = room.players.get(boundPlayerId);
        if (!player) return;

        // Verify active phase and not finished
        const activePhase = room.activePhaseId;
        const isPlaying = ['TUTORIAL', 'PHASE_1', 'PHASE_2', 'PHASE_3'].includes(room.state);

        if (!isPlaying || room.isPaused) return;

        // Once a player finishes the current phase, competitive actions in that phase are locked!
        if (player.phaseFinished[activePhase]) return;

        // A. RESCUE ELDERLY (1,000 pts)
        if (msg.type === 'ACTION_RESCUE_ELDERLY') {
          const elderlyId = `${activePhase}_${msg.elderlyKey}`;
          if (!player.rescuedElderly[elderlyId]) {
            player.rescuedElderly[elderlyId] = true;
            
            // Tutorial does not count towards competitive score
            if (activePhase !== 'tutorial') {
              player.rescuedCount++;
              player.score += 1000;
              player.phaseRescued[activePhase] = (player.phaseRescued[activePhase] || 0) + 1;
              player.phaseScores[activePhase] = (player.phaseScores[activePhase] || 0) + 1000;
            }

            ws.send(JSON.stringify({
              type: 'ACTION_CONFIRMED',
              action: 'RESCUE_ELDERLY',
              elderlyKey: msg.elderlyKey,
              currentScore: player.score,
              rescuedCount: player.rescuedCount,
              elderlyName: msg.elderlyName,
            }));

            broadcastToHost(room, {
              type: 'PLAYER_SCORE_UPDATE',
              players: getSanitizedPlayers(room),
            });
          }
          return;
        }

        // B. COLLECT HEART (25 pts)
        if (msg.type === 'ACTION_COLLECT_HEART') {
          const heartId = `${activePhase}_${msg.heartKey}`;
          if (!player.collectedHearts[heartId]) {
            player.collectedHearts[heartId] = true;
            if (activePhase !== 'tutorial') {
              player.score += 25;
              player.phaseScores[activePhase] = (player.phaseScores[activePhase] || 0) + 25;
            }

            ws.send(JSON.stringify({
              type: 'ACTION_CONFIRMED',
              action: 'COLLECT_HEART',
              heartKey: msg.heartKey,
              currentScore: player.score,
            }));
          }
          return;
        }

        // C. ACTIVATE MECHANISM (100 pts)
        if (msg.type === 'ACTION_ACTIVATE_MECHANISM') {
          const mechId = `${activePhase}_${msg.mechanismKey}`;
          if (!player.activatedMechanisms[mechId]) {
            player.activatedMechanisms[mechId] = true;
            if (activePhase !== 'tutorial') {
              player.score += 100;
              player.phaseScores[activePhase] = (player.phaseScores[activePhase] || 0) + 100;
            }

            ws.send(JSON.stringify({
              type: 'ACTION_CONFIRMED',
              action: 'ACTIVATE_MECHANISM',
              mechanismKey: msg.mechanismKey,
              currentScore: player.score,
            }));
          }
          return;
        }

        // D. PLAYER RECOVERY (fell or 0 energy)
        if (msg.type === 'ACTION_RECOVERY') {
          if (activePhase !== 'tutorial') {
            player.recoveries++;
          }
          ws.send(JSON.stringify({
            type: 'ACTION_CONFIRMED',
            action: 'RECOVERY',
            recoveries: player.recoveries,
          }));
          return;
        }

        // E. PLAYER FINISHED PHASE (Reaching Shelter)
        if (msg.type === 'ACTION_FINISH_PHASE') {
          if (!player.phaseFinished[activePhase]) {
            const rescuesInPhase = player.phaseRescued[activePhase] || 0;
            const requiredRescues = activePhase === 'tutorial' ? 1 : 3;

            // Strict check: must have rescued all required elderly
            if (rescuesInPhase < requiredRescues) {
              ws.send(JSON.stringify({
                type: 'ACTION_REJECTED',
                message: `Você precisa acolher todos os ${requiredRescues} idosos para concluir a fase!`,
              }));
              return;
            }

            player.phaseFinished[activePhase] = true;
            player.phaseTimes[activePhase] = (room.phaseTimeLimit - room.timeRemaining);

            // Time bonus: 2 points per second remaining
            let timeBonus = 0;
            if (activePhase !== 'tutorial' && room.timeRemaining > 0) {
              timeBonus = room.timeRemaining * 2;
              player.score += timeBonus;
              player.phaseScores[activePhase] = (player.phaseScores[activePhase] || 0) + timeBonus;
            }

            ws.send(JSON.stringify({
              type: 'PHASE_COMPLETE_ACK',
              phaseId: activePhase,
              timeBonus,
              finalScore: player.score,
              timeTaken: player.phaseTimes[activePhase],
            }));

            broadcastToRoom(room, {
              type: 'PLAYER_FINISHED_EVENT',
              playerId: player.id,
              nickname: player.nickname,
              rankings: getSanitizedPlayers(room),
            });
          }
          return;
        }
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  ws.on('close', () => {
    if (boundPin) {
      const room = rooms.get(boundPin);
      if (room) {
        if (isHost) {
          room.hostWs = undefined;
        } else if (boundPlayerId) {
          const player = room.players.get(boundPlayerId);
          if (player) {
            player.connected = false;
            player.ws = undefined;
            broadcastToRoom(room, {
              type: 'PLAYER_LIST_UPDATE',
              players: getSanitizedPlayers(room),
            });
          }
        }
      }
    }
  });
});

// Serve frontend with Vite middlewares in development
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalNetworkIp();
    console.log(`\n======================================================`);
    console.log(`🎮 VIRLA — Guardiões do Cuidado rodando com sucesso!`);
    console.log(`📡 Computador / Host:  http://localhost:${PORT}`);
    console.log(`📱 Celulares na rede: http://${localIp}:${PORT}`);
    if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith('SEU_GOOGLE')) {
      console.log(`🔑 Google Auth: Ativo (Client ID configurado)`);
    } else {
      console.log(`ℹ️ Google Auth: Modo de configuração/desenvolvedor (defina GOOGLE_CLIENT_ID no .env para produção)`);
    }
    console.log(`======================================================\n`);
  });
}

startServer();
