import React, { useState, useEffect, useRef } from 'react';
import { VIRLAHeader } from './components/VIRLAHeader';
import { HostView } from './components/HostView';
import { PlayerView, GoogleUser } from './components/PlayerView';
import { sound } from './game/audio';
import { Monitor, Sparkles } from 'lucide-react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';

export default function App() {
  const [mode, setMode] = useState<'host' | 'player'>('player');
  const [isMuted, setIsMuted] = useState<boolean>(sound.isMuted);

  // Connection & Room state
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [reconnecting, setReconnecting] = useState<boolean>(false);

  // Presenter Authorization State (Server-verified Firebase Custom Claim)
  const [isHostAuthorized, setIsHostAuthorized] = useState<boolean>(false);
  const [hostIdToken, setHostIdToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  // Navigation guard flags: prevent repeated automatic redirect loops
  const hasAutoRedirectedHostRef = useRef<boolean>(false);
  const userManuallySwitchedToPlayerRef = useRef<boolean>(false);

  // Host state
  const [hostPin, setHostPin] = useState<string | null>(null);
  const [hostSecret, setHostSecret] = useState<string | null>(null);

  // Player state
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [playerNickname, setPlayerNickname] = useState<string>('');
  const [characterIndex, setCharacterIndex] = useState<number>(0);
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [rescuedCount, setRescuedCount] = useState<number>(0);
  const [recoveries, setRecoveries] = useState<number>(0);
  const [phaseFinished, setPhaseFinished] = useState<boolean>(false);
  const [timeBonus, setTimeBonus] = useState<number>(0);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [sessionReplacedMessage, setSessionReplacedMessage] = useState<string | null>(null);

  // Shared synchronized room state
  const [roomState, setRoomState] = useState<string>('LOBBY');
  const [activePhaseId, setActivePhaseId] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [players, setPlayers] = useState<any[]>([]);

  // Query parameter PIN (from scanning QR code)
  const [queryPin, setQueryPin] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pin = params.get('pin');
    if (pin) {
      setQueryPin(pin);
    }

    // Try loading saved host session
    const savedHostPin = sessionStorage.getItem('virla_host_pin');
    const savedHostSecret = sessionStorage.getItem('virla_host_secret');
    if (savedHostPin && savedHostSecret) {
      setHostPin(savedHostPin);
      setHostSecret(savedHostSecret);
    }

    // Try loading saved player token
    const savedPlayerToken = sessionStorage.getItem('virla_player_token');
    if (savedPlayerToken) {
      setSessionToken(savedPlayerToken);
    }
  }, []);

  // Listen to Firebase Auth state for server-side verified presenter authorization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          setHostIdToken(token);

          const res = await fetch('/api/host/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
          });
          const data = await res.json();

          if (data.success && data.authorized) {
            setIsHostAuthorized(true);
            // Automatic redirect to host panel happens ONLY ONCE upon initial login/load
            // If the user already manually navigated back to the player view, do NOT force them back!
            if (!hasAutoRedirectedHostRef.current && !userManuallySwitchedToPlayerRef.current) {
              hasAutoRedirectedHostRef.current = true;
              setMode('host');
            }
          } else {
            setIsHostAuthorized(false);
          }
        } catch {
          setIsHostAuthorized(false);
        }
      } else {
        setIsHostAuthorized(false);
        setHostIdToken(null);
        hasAutoRedirectedHostRef.current = false;
        userManuallySwitchedToPlayerRef.current = false;
        setMode('player');
      }
    });

    return () => unsubscribe();
  }, []);

  // WebSocket Connection & Lifecycle
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: any;

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setReconnecting(false);

        // Try reconnecting host if secret exists
        const savedHostPin = sessionStorage.getItem('virla_host_pin');
        const savedHostSecret = sessionStorage.getItem('virla_host_secret');
        if (savedHostPin && savedHostSecret) {
          ws.send(
            JSON.stringify({
              type: 'HOST_RECONNECT',
              pin: savedHostPin,
              hostSecret: savedHostSecret,
              idToken: hostIdToken || undefined,
            })
          );
        }

        // Try reconnecting player if token exists
        const savedToken = sessionStorage.getItem('virla_player_token');
        const savedPin = sessionStorage.getItem('virla_player_pin');
        const savedGoogle = sessionStorage.getItem('virla_google_user');
        let googleId = '';
        if (savedGoogle) {
          try {
            googleId = JSON.parse(savedGoogle).googleId || '';
          } catch {}
        }

        if (savedPin && (savedToken || googleId)) {
          ws.send(
            JSON.stringify({
              type: 'PLAYER_RECONNECT',
              pin: savedPin,
              sessionToken: savedToken || '',
              googleId,
            })
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // 1. HOST EVENTS
          if (msg.type === 'HOST_ROOM_CREATED') {
            setHostPin(msg.pin);
            setHostSecret(msg.hostSecret);
            sessionStorage.setItem('virla_host_pin', msg.pin);
            sessionStorage.setItem('virla_host_secret', msg.hostSecret);
            setRoomState('LOBBY');
          }

          if (msg.type === 'HOST_RECONNECTED') {
            setRoomState(msg.room.state);
            setTimeRemaining(msg.room.timeRemaining);
            setIsPaused(msg.room.isPaused);
            setIsLocked(msg.room.isLocked);
            setActivePhaseId(msg.room.activePhaseId);
            setPlayers(msg.room.players || []);
          }

          // 2. PLAYER JOIN & RECONNECT
          if (msg.type === 'JOIN_SUCCESS') {
            setPlayerId(msg.playerId);
            setSessionToken(msg.sessionToken);
            setPlayerNickname(msg.nickname);
            setCharacterIndex(msg.characterIndex);
            setRoomState(msg.roomState);
            setJoinError(null);
            setSessionReplacedMessage(null);
            sessionStorage.setItem('virla_player_token', msg.sessionToken);
            sessionStorage.setItem('virla_player_pin', msg.pin);
          }

          if (msg.type === 'JOIN_ERROR') {
            setJoinError(msg.message);
          }

          if (msg.type === 'RECONNECT_SUCCESS') {
            setPlayerId(msg.playerId);
            setSessionToken(msg.sessionToken);
            setPlayerNickname(msg.nickname);
            setCharacterIndex(msg.characterIndex);
            setPlayerScore(msg.score);
            setRescuedCount(msg.rescuedCount);
            setRecoveries(msg.recoveries);
            setRoomState(msg.roomState);
            setActivePhaseId(msg.activePhaseId);
            setTimeRemaining(msg.timeRemaining);
            setPhaseFinished(msg.phaseFinished);
            setSessionReplacedMessage(null);
          }

          if (msg.type === 'SESSION_REPLACED') {
            setSessionReplacedMessage(msg.reason || 'Sua conta Google foi conectada em outro dispositivo.');
            setPlayerId(null);
            setSessionToken(null);
          }

          // 3. SYNCHRONIZED ROOM EVENTS
          if (msg.type === 'ROOM_STATE_CHANGE') {
            setRoomState(msg.state);
            setActivePhaseId(msg.activePhaseId);
            setTimeRemaining(msg.timeRemaining);
            setPhaseFinished(false);
            if (msg.rankings) setPlayers(msg.rankings);
          }

          if (msg.type === 'COUNTDOWN_START' || msg.type === 'COUNTDOWN_TICK') {
            setRoomState('COUNTDOWN');
            setCountdown(msg.countdown);
            sound.playCountdown(msg.countdown === 0);
          }

          if (msg.type === 'TIMER_SYNC') {
            setTimeRemaining(msg.timeRemaining);
            if (msg.rankings) setPlayers(msg.rankings);
          }

          if (msg.type === 'PLAYER_LIST_UPDATE') {
            setPlayers(msg.players || []);
          }

          if (msg.type === 'ROOM_PAUSE_CHANGED') {
            setIsPaused(msg.isPaused);
          }

          if (msg.type === 'ROOM_LOCK_CHANGED') {
            setIsLocked(msg.isLocked);
          }

          // 4. PLAYER ACTION CONFIRMATIONS
          if (msg.type === 'ACTION_CONFIRMED') {
            if (msg.currentScore !== undefined) setPlayerScore(msg.currentScore);
            if (msg.rescuedCount !== undefined) setRescuedCount(msg.rescuedCount);
            if (msg.recoveries !== undefined) setRecoveries(msg.recoveries);
          }

          if (msg.type === 'PHASE_COMPLETE_ACK') {
            setPhaseFinished(true);
            setTimeBonus(msg.timeBonus || 0);
            setPlayerScore(msg.finalScore);
          }

          if (msg.type === 'KICKED') {
            sessionStorage.removeItem('virla_player_token');
            sessionStorage.removeItem('virla_player_pin');
            setPlayerId(null);
            setSessionToken(null);
          }

          if (msg.type === 'ERROR') {
            console.warn('WebSocket message error:', msg.message);
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setReconnecting(true);
        reconnectTimeout = setTimeout(connectWs, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [hostIdToken]);

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const sendWsMessage = (data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  };

  /**
   * Presenter authorization callback from PlayerView or login.
   * isExplicitLogin: only set to true when the user explicitly clicks the Google sign-in button
   * on that turn, NOT during passive auth checks on mount.
   */
  const handlePresenterAuthorized = (authorized: boolean, idToken: string, isExplicitLogin = false) => {
    setIsHostAuthorized(authorized);
    setHostIdToken(idToken);
    if (authorized && isExplicitLogin && !userManuallySwitchedToPlayerRef.current) {
      hasAutoRedirectedHostRef.current = true;
      setMode('host');
    }
  };

  /**
   * Safe navigation out of host view ("Voltar").
   * Returns to player/home screen without closing the room or logging out.
   */
  const handleExitHost = () => {
    userManuallySwitchedToPlayerRef.current = true;
    setMode('player');
  };

  /**
   * Explicit navigation to Host/Telão panel.
   */
  const handleOpenHost = () => {
    userManuallySwitchedToPlayerRef.current = false;
    setMode('host');
  };

  /**
   * Explicit sign out action - separate from "Voltar".
   */
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error signing out:', err);
    }
    setIsHostAuthorized(false);
    setHostIdToken(null);
    setCurrentUser(null);
    hasAutoRedirectedHostRef.current = false;
    userManuallySwitchedToPlayerRef.current = false;
    setMode('player');
    sessionStorage.removeItem('virla_google_user');
  };

  // Host Actions
  const handleCreateRoom = async () => {
    let token = hostIdToken;
    if (!token && auth.currentUser) {
      token = await auth.currentUser.getIdToken();
      setHostIdToken(token);
    }
    sendWsMessage({ type: 'HOST_CREATE_ROOM', idToken: token });
  };

  const handleStartCountdown = (targetState: string) => {
    sendWsMessage({ type: 'HOST_START_COUNTDOWN', targetState });
  };

  const handleTogglePause = () => {
    sendWsMessage({ type: 'HOST_TOGGLE_PAUSE' });
  };

  const handleToggleLock = () => {
    sendWsMessage({ type: 'HOST_TOGGLE_LOCK' });
  };

  const handleEndPhase = () => {
    sendWsMessage({ type: 'HOST_END_PHASE' });
  };

  const handleKickPlayer = (targetPlayerId: string) => {
    sendWsMessage({ type: 'HOST_KICK_PLAYER', playerId: targetPlayerId });
  };

  // Player Actions with Firebase Auth
  const handleJoinRoom = (pin: string, nickname: string, charIndex: number, googleUser: GoogleUser) => {
    sendWsMessage({
      type: 'PLAYER_JOIN',
      pin,
      googleId: googleUser.googleId,
      googleEmail: googleUser.email,
      googlePicture: googleUser.picture,
      nickname,
      characterIndex: charIndex,
    });
  };

  const isGameplayActive = mode === 'player' && !!playerId && ['TUTORIAL', 'PHASE_1', 'PHASE_2', 'PHASE_3'].includes(roomState) && !phaseFinished;

  return (
    <div className={`w-full flex flex-col bg-[#4A0052] text-white ${isGameplayActive ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen overflow-y-auto'}`}>
      {/* Brand Header */}
      <VIRLAHeader
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        mode={mode}
        onExitHost={handleExitHost}
        isHostAuthorized={isHostAuthorized}
        onOpenHost={handleOpenHost}
        onSignOut={handleSignOut}
        isAuthenticated={!!currentUser}
        roomPin={hostPin}
        hideOnMobileGameplay={isGameplayActive}
      />

      {/* Reconnecting Banner */}
      {reconnecting && (
        <div className="bg-amber-600/95 text-white text-xs font-bold py-1.5 px-4 text-center border-b border-amber-400 animate-pulse z-30 shrink-0">
          Reconectando ao servidor em tempo real...
        </div>
      )}

      {/* Presenter in Participant View Quick Banner */}
      {mode === 'player' && isHostAuthorized && !isGameplayActive && (
        <div className="bg-gradient-to-r from-amber-500/20 via-[#83078E]/40 to-amber-500/20 border-b border-amber-400/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200 z-30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">👑</span>
            <span>
              Logado como <b>Apresentador Oficial</b>
              {hostPin ? ` (Sala ${hostPin} em andamento)` : ''}.
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenHost}
            className="min-h-[36px] px-3 py-1 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Retornar ao Painel do Apresentador</span>
          </button>
        </div>
      )}

      {/* Main View Area */}
      <main className={`flex-1 min-h-0 w-full flex flex-col relative ${isGameplayActive ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {mode === 'host' && isHostAuthorized ? (
          <HostView
            socket={socketRef.current}
            pin={hostPin}
            hostSecret={hostSecret}
            onCreateRoom={handleCreateRoom}
            onStartCountdown={handleStartCountdown}
            onTogglePause={handleTogglePause}
            onToggleLock={handleToggleLock}
            onEndPhase={handleEndPhase}
            onKickPlayer={handleKickPlayer}
            onExitHost={handleExitHost}
            roomState={roomState}
            timeRemaining={timeRemaining}
            isPaused={isPaused}
            isLocked={isLocked}
            players={players}
            countdown={countdown}
          />
        ) : (
          <PlayerView
            socket={socketRef.current}
            initialPin={queryPin}
            onJoinRoom={handleJoinRoom}
            onSendAction={sendWsMessage}
            playerId={playerId}
            sessionToken={sessionToken}
            nickname={playerNickname}
            characterIndex={characterIndex}
            score={playerScore}
            rescuedCount={rescuedCount}
            recoveries={recoveries}
            roomState={roomState}
            activePhaseId={activePhaseId}
            timeRemaining={timeRemaining}
            countdown={countdown}
            phaseFinished={phaseFinished}
            timeBonus={timeBonus}
            reconnecting={reconnecting}
            joinError={joinError}
            sessionReplacedMessage={sessionReplacedMessage}
            rankings={players}
            onPresenterAuthorized={handlePresenterAuthorized}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onSignOut={handleSignOut}
          />
        )}
      </main>
    </div>
  );
}
