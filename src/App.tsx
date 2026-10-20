import React, { useState, useEffect, useRef } from 'react';
import { VIRLAHeader } from './components/VIRLAHeader';
import { HostView } from './components/HostView';
import { PlayerView, GoogleUser } from './components/PlayerView';
import { sound } from './game/audio';
import { Lock, KeyRound, Monitor, X, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState<'host' | 'player'>('player');
  const [isMuted, setIsMuted] = useState<boolean>(sound.isMuted);

  // Connection & Room state
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [reconnecting, setReconnecting] = useState<boolean>(false);

  // Presenter Authorization State
  const [isHostAuthorized, setIsHostAuthorized] = useState<boolean>(false);
  const [showHostAuthModal, setShowHostAuthModal] = useState<boolean>(false);
  const [hostKeyInput, setHostKeyInput] = useState<string>('');
  const [hostAuthError, setHostAuthError] = useState<string | null>(null);
  const [isVerifyingHost, setIsVerifyingHost] = useState<boolean>(false);

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

  // Query parameter PIN
  const [queryPin, setQueryPin] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pin = params.get('pin');
    const urlMode = params.get('mode');
    const hostFlag = params.get('host');
    const adminFlag = params.get('admin');
    const urlKey = params.get('key');

    if (pin) {
      setQueryPin(pin);
    }

    // Check presenter authorization
    const savedHostAuth = sessionStorage.getItem('virla_host_authorized');
    const isMasterKeyInUrl = urlKey === 'virla2026';

    if (isMasterKeyInUrl || savedHostAuth === 'true') {
      setIsHostAuthorized(true);
      if (urlMode === 'host' || hostFlag === '1' || adminFlag === '1') {
        setMode('host');
      }
    } else if (urlMode === 'host' || hostFlag === '1' || adminFlag === '1') {
      // User explicitly tried to access host view: show authorization prompt
      setShowHostAuthModal(true);
      setMode('player');
    }

    // Check saved Google user email for authorized host
    const savedGoogle = sessionStorage.getItem('virla_google_user');
    if (savedGoogle) {
      try {
        const parsed = JSON.parse(savedGoogle);
        if (parsed.email && parsed.email.toLowerCase() === 'danielamorimk095@gmail.com') {
          setIsHostAuthorized(true);
          sessionStorage.setItem('virla_host_authorized', 'true');
        }
      } catch {}
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
            alert(msg.reason || 'Você foi desconectado da sala.');
            sessionStorage.removeItem('virla_player_token');
            sessionStorage.removeItem('virla_player_pin');
            setPlayerId(null);
            setSessionToken(null);
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
  }, []);

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const sendWsMessage = (data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  };

  // Host Verification Method
  const handleVerifyHostKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingHost(true);
    setHostAuthError(null);

    try {
      const res = await fetch('/api/host/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostKey: hostKeyInput.trim() }),
      });
      const data = await res.json();

      if (data.success && data.authorized) {
        setIsHostAuthorized(true);
        sessionStorage.setItem('virla_host_authorized', 'true');
        setShowHostAuthModal(false);
        setMode('host');
      } else {
        setHostAuthError('Chave mestra do apresentador incorreta.');
      }
    } catch {
      setHostAuthError('Falha ao verificar autorização no servidor.');
    } finally {
      setIsVerifyingHost(false);
    }
  };

  // Host Actions
  const handleCreateRoom = () => {
    sendWsMessage({ type: 'HOST_CREATE_ROOM' });
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

  // Player Actions with Google Auth
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

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#4A0052] text-white">
      {/* Brand Header */}
      <VIRLAHeader
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        mode={mode}
        onExitHost={() => setMode('player')}
        onRequestHostAccess={() => setShowHostAuthModal(true)}
      />

      {/* Reconnecting Banner */}
      {reconnecting && (
        <div className="bg-amber-600/90 text-white text-xs font-bold py-1 px-4 text-center border-b border-amber-400 animate-pulse">
          Reconectando ao servidor em tempo real...
        </div>
      )}

      {/* Host Authorization Modal (Restricted Presenter Access) */}
      {showHostAuthModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#6B0075] border-2 border-amber-400 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setShowHostAuthModal(false)}
              className="absolute top-4 right-4 text-pink-300 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400 text-amber-300 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="font-shrikhand text-xl text-white text-center mb-1">
              Acesso do Apresentador
            </h3>
            <p className="text-xs text-pink-200 text-center mb-4">
              Área restrita à organização da Semana de Tecnologia. Informe a chave mestra ou acesse via conta autorizada.
            </p>

            {hostAuthError && (
              <div className="bg-red-500/25 border border-red-400 text-red-100 text-xs rounded-xl p-2.5 mb-3 text-center">
                {hostAuthError}
              </div>
            )}

            <form onSubmit={handleVerifyHostKey} className="space-y-3">
              <input
                type="password"
                value={hostKeyInput}
                onChange={(e) => setHostKeyInput(e.target.value)}
                placeholder="Chave mestra do apresentador"
                className="w-full bg-[#4A0052] border border-amber-400/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                autoFocus
              />

              <button
                type="submit"
                disabled={isVerifyingHost || !hostKeyInput.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 font-bold text-xs uppercase tracking-wider shadow hover:bg-amber-300 transition cursor-pointer disabled:opacity-50"
              >
                {isVerifyingHost ? 'Verificando...' : 'Acessar Painel do Telão'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Screen according to Mode */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
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
          />
        )}
      </main>

      {/* Discreet Footer link for Presenter (Only shown if authorized or via key) */}
      {mode === 'player' && isHostAuthorized && (
        <div className="py-1 px-4 bg-[#3B0042] border-t border-pink-400/20 text-center">
          <button
            onClick={() => setMode('host')}
            className="text-[10px] text-amber-300 hover:text-amber-200 font-semibold tracking-wider uppercase inline-flex items-center gap-1 transition"
          >
            <Monitor className="w-3 h-3" />
            <span>Abrir Painel do Apresentador (Telão)</span>
          </button>
        </div>
      )}
    </div>
  );
}
