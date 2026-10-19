import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Heart,
  Shield,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Trophy,
  RotateCw,
  Users,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import { GameEngine } from '../game/engine';
import { LEVELS } from '../game/levels';
import { CHARACTER_SKINS } from '../game/types';
import { sound } from '../game/audio';

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

interface PlayerViewProps {
  socket: WebSocket | null;
  initialPin?: string;
  onJoinRoom: (pin: string, nickname: string, characterIndex: number, googleUser: GoogleUser) => void;
  onSendAction: (msg: any) => void;
  playerId: string | null;
  sessionToken: string | null;
  nickname: string;
  characterIndex: number;
  score: number;
  rescuedCount: number;
  recoveries: number;
  roomState: string;
  activePhaseId: string;
  timeRemaining: number;
  countdown: number;
  phaseFinished: boolean;
  timeBonus: number;
  reconnecting: boolean;
  joinError: string | null;
  sessionReplacedMessage: string | null;
  rankings: any[];
}

export const PlayerView: React.FC<PlayerViewProps> = ({
  socket,
  initialPin = '',
  onJoinRoom,
  onSendAction,
  playerId,
  sessionToken,
  nickname,
  characterIndex,
  score,
  rescuedCount,
  recoveries,
  roomState,
  activePhaseId,
  timeRemaining,
  countdown,
  phaseFinished,
  timeBonus,
  reconnecting,
  joinError,
  sessionReplacedMessage,
  rankings,
}) => {
  // Google Authentication State
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [showDevGoogleModal, setShowDevGoogleModal] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devName, setDevName] = useState('');
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  // Join form state
  const [pinInput, setPinInput] = useState(initialPin);
  const [nameInput, setNameInput] = useState('');
  const [selectedSkin, setSelectedSkin] = useState(0);

  // In-game states
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [inGameEnergy, setInGameEnergy] = useState(3);
  const [notification, setNotification] = useState<string | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissPortraitWarning, setDismissPortraitWarning] = useState(false);

  // Multi-touch tracking refs
  const activeTouchesRef = useRef<{ [touchId: number]: string }>({});

  const [contextualBtn, setContextualBtn] = useState<{
    label: string;
    isContextual: boolean;
  }>({ label: 'Escudo', isContextual: false });

  // Floating notification timer
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3200);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Orientation detector for mobile
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Fetch Google Auth Config from backend
  useEffect(() => {
    fetch('/api/auth/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.googleClientId) {
          setGoogleClientId(data.googleClientId);
        }
      })
      .catch(() => {});

    // Try loading saved Google User from sessionStorage
    const savedUser = sessionStorage.getItem('virla_google_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.googleId && parsed.email) {
          setGoogleUser(parsed);
          if (!nameInput) {
            setNameInput(parsed.name.split(' ')[0] || 'Guardião');
          }
        }
      } catch {}
    }
  }, []);

  // Initialize Google Identity Services (GIS) when googleClientId is available
  useEffect(() => {
    if (googleClientId && (window as any).google?.accounts?.id && !googleUser) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response.credential) {
              const res = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential }),
              });
              const data = await res.json();
              if (data.success && data.googleUser) {
                setGoogleUser(data.googleUser);
                sessionStorage.setItem('virla_google_user', JSON.stringify(data.googleUser));
                setNameInput(data.googleUser.name.split(' ')[0] || 'Guardião');
              }
            }
          },
        });

        if (googleBtnRef.current) {
          (window as any).google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            locale: 'pt-BR',
            width: 280,
          });
        }
      } catch (err) {
        console.warn('Google Identity Services init notice:', err);
      }
    }
  }, [googleClientId, googleUser]);

  // Keep PIN synced from query parameter if present
  useEffect(() => {
    if (initialPin) setPinInput(initialPin);
  }, [initialPin]);

  // Handle active gameplay canvas initialization
  const isGameplay = ['TUTORIAL', 'PHASE_1', 'PHASE_2', 'PHASE_3'].includes(roomState);

  useEffect(() => {
    if (isGameplay && canvasRef.current && activePhaseId && !phaseFinished) {
      const levelDef = LEVELS[activePhaseId as keyof typeof LEVELS] || LEVELS.fase1;
      const canvas = canvasRef.current;

      const updateCanvasSize = () => {
        if (!canvas) return;
        const width = Math.min(window.innerWidth, 1200);
        // Adaptive height accounting for mobile browser navigation bars
        const maxH = Math.min(window.innerHeight - 110, 520);
        canvas.width = width;
        canvas.height = Math.max(340, maxH);
      };

      updateCanvasSize();
      window.addEventListener('resize', updateCanvasSize);

      const engine = new GameEngine(canvas, levelDef, characterIndex, {
        onCollectHeart: (heartKey) => {
          onSendAction({ type: 'ACTION_COLLECT_HEART', heartKey });
        },
        onActivateMechanism: (mechanismKey) => {
          onSendAction({ type: 'ACTION_ACTIVATE_MECHANISM', mechanismKey });
        },
        onRescueElderly: (elderlyKey, elderlyName) => {
          onSendAction({ type: 'ACTION_RESCUE_ELDERLY', elderlyKey, elderlyName });
        },
        onRecovery: () => {
          onSendAction({ type: 'ACTION_RECOVERY' });
        },
        onFinishPhase: () => {
          onSendAction({ type: 'ACTION_FINISH_PHASE' });
        },
        onNotification: (msg) => {
          setNotification(msg);
        },
      });

      engineRef.current = engine;
      engine.start();

      // UI update interval for energy & contextual button
      const uiTimer = setInterval(() => {
        if (engineRef.current) {
          setInGameEnergy(engineRef.current.energy);
          const act = engineRef.current.contextualAction;
          setContextualBtn({
            label: act.available ? act.label : 'Escudo',
            isContextual: act.available,
          });
        }
      }, 75);

      return () => {
        clearInterval(uiTimer);
        window.removeEventListener('resize', updateCanvasSize);
        engine.stop();
        engineRef.current = null;
      };
    }
  }, [isGameplay, activePhaseId, phaseFinished, characterIndex]);

  // Confetti for top 3 in podium
  useEffect(() => {
    if (roomState === 'PODIUM') {
      const myRank = rankings.findIndex((p) => p.id === playerId) + 1;
      if (myRank >= 1 && myRank <= 3) {
        sound.playVictory();
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#FE91FE', '#83078E', '#FACC15', '#FFFFFF'],
        });
      }
    }
  }, [roomState, rankings, playerId]);

  // Multi-Touch Handlers (independent multi-touch support for Left, Right, Jump, and Action)
  const handleTouchStart = (key: string, e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      activeTouchesRef.current[touch.identifier] = key;
    }
    if (engineRef.current) {
      engineRef.current.setTouchInput(key, true);
    }
  };

  const handleTouchEnd = (key: string, e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      delete activeTouchesRef.current[touch.identifier];
    }
    // Check if another touch is still holding this key
    const isStillHeld = Object.values(activeTouchesRef.current).includes(key);
    if (!isStillHeld && engineRef.current) {
      engineRef.current.setTouchInput(key, false);
    }
  };

  const handleMouseDown = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (engineRef.current) {
      engineRef.current.setTouchInput(key, true);
    }
  };

  const handleMouseUp = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (engineRef.current) {
      engineRef.current.setTouchInput(key, false);
    }
  };

  // Developer Google Login Form Submit
  const handleDevGoogleLogin = async () => {
    if (!devEmail.trim() || !devEmail.includes('@')) {
      alert('Por favor informe um e-mail válido (ex: seu.nome@gmail.com)');
      return;
    }
    const googleId = 'gid_' + Math.abs(devEmail.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0));
    const name = devName.trim() || devEmail.split('@')[0];

    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testGoogleUser: {
          googleId,
          email: devEmail.trim(),
          name,
          picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${googleId}`,
        },
      }),
    });
    const data = await res.json();
    if (data.success && data.googleUser) {
      setGoogleUser(data.googleUser);
      sessionStorage.setItem('virla_google_user', JSON.stringify(data.googleUser));
      setNameInput(name.split(' ')[0]);
      setShowDevGoogleModal(false);
    }
  };

  const handleLogoutGoogle = () => {
    setGoogleUser(null);
    sessionStorage.removeItem('virla_google_user');
  };

  // --- 0. SESSION REPLACED SCREEN (Active Control in Another Tab) ---
  if (sessionReplacedMessage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto w-full">
        <div className="bg-[#6B0075] p-6 rounded-3xl border-2 border-amber-400 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400 mx-auto flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="font-shrikhand text-2xl text-white mb-2">Sessão Transferida</h2>
          <p className="text-sm text-pink-100 mb-6 leading-relaxed">
            {sessionReplacedMessage}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FE91FE] to-[#83078E] text-white font-bold border border-white shadow-lg hover:scale-102 transition"
          >
            Reconectar nesta Aba
          </button>
        </div>
      </div>
    );
  }

  // --- 1. SIGN IN & ENTRY SCREEN ---
  if (!playerId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full">
        <div className="w-full bg-[#6B0075] rounded-3xl p-6 border-2 border-[#FE91FE]/40 shadow-2xl">
          <div className="text-center mb-5">
            <h1 className="font-shrikhand text-3xl text-[#FE91FE] tracking-wide">
              Entrar no Jogo
            </h1>
            <p className="text-pink-100 text-xs mt-1">
              Guardiões do Cuidado • Semana de Tecnologia
            </p>
          </div>

          {joinError && (
            <div className="bg-red-500/20 border border-red-400 text-red-200 text-xs rounded-xl p-3 mb-4 text-center">
              {joinError}
            </div>
          )}

          {/* STEP 1: GOOGLE SIGN-IN */}
          <div className="mb-5 p-4 rounded-2xl bg-[#4A0052]/70 border border-pink-400/20">
            <span className="text-[11px] uppercase tracking-wider text-pink-200 font-bold block mb-2">
              Passo 1: Identificação com Conta Google
            </span>

            {googleUser ? (
              <div className="flex items-center justify-between bg-[#6B0075] p-3 rounded-xl border border-emerald-400/50 shadow">
                <div className="flex items-center gap-3 overflow-hidden">
                  {googleUser.picture ? (
                    <img src={googleUser.picture} alt="Avatar" className="w-10 h-10 rounded-full border border-pink-300" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#83078E] text-white font-bold flex items-center justify-center border border-pink-300">
                      {googleUser.name.charAt(0)}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-sm truncate">{googleUser.name}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    </div>
                    <span className="text-[10px] text-pink-200 block truncate">{googleUser.email}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogoutGoogle}
                  className="p-1.5 text-pink-300 hover:text-white transition"
                  title="Trocar de conta"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Official Google Button container */}
                <div ref={googleBtnRef} className="flex justify-center min-h-[44px]"></div>

                {/* Direct Google Login Option */}
                <button
                  type="button"
                  onClick={() => setShowDevGoogleModal(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-white text-gray-800 font-bold text-xs flex items-center justify-center gap-2 shadow hover:bg-gray-100 transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Entrar com Conta Google (Gmail)</span>
                </button>
              </div>
            )}
          </div>

          {/* STEP 2: DISPLAY NICKNAME & CHARACTER */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-pink-200 font-bold mb-1">
                Passo 2: Nome de Exibição no Ranking
              </label>
              <input
                type="text"
                maxLength={16}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Como quer ser chamado no telão?"
                className="w-full bg-[#4A0052] border border-[#FE91FE]/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FE91FE]"
              />
              <span className="text-[10px] text-pink-300 mt-1 block">
                🔒 Seu Gmail <b>nunca</b> será exibido no projetor público.
              </span>
            </div>

            {/* Character selection */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-pink-200 font-bold mb-2">
                Passo 3: Escolha seu Cuidador VIRLA
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CHARACTER_SKINS.map((skin) => (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => {
                      setSelectedSkin(skin.id);
                      sound.playJump();
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition cursor-pointer ${
                      selectedSkin === skin.id
                        ? 'bg-[#83078E] border-[#FE91FE] shadow-lg scale-102'
                        : 'bg-[#4A0052]/60 border-pink-400/20 hover:border-pink-300'
                    }`}
                  >
                    <span className="text-3xl mb-1">{skin.badge}</span>
                    <span className="text-xs font-bold text-white">{skin.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* STEP 4: PIN INPUT */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-pink-200 font-bold mb-1">
                Passo 4: PIN da Partida
              </label>
              <input
                type="text"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 123456"
                className="w-full bg-[#4A0052] border-2 border-[#FE91FE]/50 rounded-xl px-4 py-2.5 text-2xl font-mono text-center text-white tracking-widest placeholder-white/20 focus:outline-none focus:border-[#FE91FE]"
              />
            </div>

            {/* Submit button */}
            <button
              onClick={() => {
                if (googleUser && pinInput.length === 6 && nameInput.trim()) {
                  sound.playVictory();
                  onJoinRoom(pinInput, nameInput.trim(), selectedSkin, googleUser);
                }
              }}
              disabled={!googleUser || pinInput.length !== 6 || !nameInput.trim()}
              className={`w-full py-3.5 rounded-xl font-bold text-base shadow-xl transition-all border-2 flex items-center justify-center gap-2 ${
                googleUser && pinInput.length === 6 && nameInput.trim()
                  ? 'bg-gradient-to-r from-[#FE91FE] to-[#83078E] text-white border-white hover:scale-102 cursor-pointer'
                  : 'bg-gray-600/40 text-gray-400 border-transparent cursor-not-allowed'
              }`}
            >
              <Heart className="w-5 h-5 fill-current" />
              Entrar na Competição
            </button>
          </div>
        </div>

        {/* Modal for Google Account Login */}
        {showDevGoogleModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#6B0075] border-2 border-[#FE91FE] rounded-3xl p-6 max-w-sm w-full shadow-2xl">
              <h3 className="font-shrikhand text-xl text-white mb-2">Entrar com Google</h3>
              <p className="text-xs text-pink-100 mb-4 leading-relaxed">
                Informe o seu e-mail do Google (Gmail) para registrar a sua participação oficial na
                Semana de Tecnologia.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-pink-200 uppercase">Seu Gmail</label>
                  <input
                    type="email"
                    value={devEmail}
                    onChange={(e) => setDevEmail(e.target.value)}
                    placeholder="exemplo@gmail.com"
                    className="w-full bg-[#4A0052] border border-pink-300/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FE91FE]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-pink-200 uppercase">Seu Nome Completo</label>
                  <input
                    type="text"
                    value={devName}
                    onChange={(e) => setDevName(e.target.value)}
                    placeholder="Nome que consta na conta Google"
                    className="w-full bg-[#4A0052] border border-pink-300/40 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FE91FE]"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setShowDevGoogleModal(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-600/40 text-pink-200 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDevGoogleLogin}
                  className="flex-1 py-2 rounded-xl bg-[#FE91FE] text-[#6B0075] font-black text-xs shadow hover:scale-102 transition"
                >
                  Confirmar Login
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 2. WAITING ROOM SCREEN ---
  if (roomState === 'LOBBY') {
    const char = CHARACTER_SKINS[characterIndex] || CHARACTER_SKINS[0];
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full text-center">
        <div className="bg-[#6B0075] rounded-3xl p-6 border-2 border-[#FE91FE]/40 shadow-2xl w-full">
          <div className="w-20 h-20 rounded-full bg-[#83078E] border-2 border-[#FE91FE] mx-auto flex items-center justify-center text-4xl mb-3 shadow-lg">
            {char.badge}
          </div>
          <h2 className="text-2xl font-bold text-white">{nickname}</h2>
          <span className="text-xs font-semibold px-3 py-0.5 rounded-full bg-[#4A0052] text-[#FE91FE] border border-pink-400/30 inline-block mt-1">
            {char.title}
          </span>

          <div className="my-5 p-4 rounded-2xl bg-[#4A0052]/70 border border-pink-400/20 text-left space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FE91FE]">
              Conceito VIRLA do Cuidado:
            </span>
            <p className="text-xs text-pink-100 leading-relaxed">
              <b>Dilema de Márcia:</b> "Como trabalhar tranquila sabendo que meu pai, o Sr. Jorge,
              está recebendo apoio com segurança e carinho?"
            </p>
            <p className="text-xs text-pink-100 leading-relaxed">
              <b>Sua Missão:</b> Corra, pule e conecte o cuidado! Acolha os 3 idosos de cada fase para
              liberar o Ponto de Acolhimento final!
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-pink-200 text-sm font-medium animate-pulse">
            <Users className="w-4 h-4 text-[#FE91FE]" />
            Aguardando o apresentador iniciar a partida...
          </div>
        </div>
      </div>
    );
  }

  // --- 3. COUNTDOWN SCREEN ---
  if (roomState === 'COUNTDOWN') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h3 className="text-xl text-pink-200 font-bold mb-4 uppercase tracking-widest">
          A rodada começa em:
        </h3>
        <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-[#83078E] to-[#FE91FE] flex items-center justify-center shadow-2xl border-4 border-white animate-pulse">
          <span className="font-shrikhand text-6xl text-white">
            {countdown > 0 ? countdown : 'CUIDAR!'}
          </span>
        </div>
        <p className="text-pink-100 mt-4 text-sm font-medium">Segure o celular na horizontal se preferir!</p>
      </div>
    );
  }

  // --- 4. PHASE FINISHED / WAITING FOR OTHERS ---
  if (isGameplay && phaseFinished) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full text-center">
        <div className="bg-[#6B0075] rounded-3xl p-6 border-2 border-[#FE91FE] shadow-2xl w-full">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400 mx-auto flex items-center justify-center text-3xl mb-3">
            ✨
          </div>
          <h2 className="font-shrikhand text-2xl text-white">Fase Concluída!</h2>
          <p className="text-xs text-pink-200 mt-1">
            Você acolheu os idosos com carinho e chegou ao Ponto de Acolhimento!
          </p>

          <div className="my-5 grid grid-cols-2 gap-3 text-center">
            <div className="bg-[#4A0052] p-3 rounded-2xl border border-pink-400/20">
              <span className="text-[10px] uppercase text-pink-300 font-bold">Pontuação</span>
              <div className="text-2xl font-bold font-mono text-amber-300">
                {score.toLocaleString('pt-BR')}
              </div>
            </div>
            <div className="bg-[#4A0052] p-3 rounded-2xl border border-pink-400/20">
              <span className="text-[10px] uppercase text-pink-300 font-bold">Bônus de Tempo</span>
              <div className="text-2xl font-bold font-mono text-emerald-300">+{timeBonus}</div>
            </div>
          </div>

          <p className="text-xs text-pink-100 animate-pulse">
            Aguardando os outros participantes e a contagem do apresentador...
          </p>
        </div>
      </div>
    );
  }

  // --- 5. ACTIVE GAMEPLAY (CANVAS & MOBILE TOUCH CONTROLS) ---
  if (isGameplay && !phaseFinished) {
    return (
      <div className="relative flex-1 w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden select-none touch-none">
        {/* Floating In-Game Notification */}
        {notification && (
          <div className="absolute top-14 z-40 bg-[#83078E]/95 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full border border-[#FE91FE] shadow-2xl animate-fade-in pointer-events-none">
            {notification}
          </div>
        )}

        {/* Portrait Orientation Hint on Mobile */}
        {isPortrait && !dismissPortraitWarning && (
          <div className="absolute top-16 left-4 right-4 z-40 bg-[#6B0075]/95 text-white p-3 rounded-2xl border border-[#FE91FE] flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-2">
              <RotateCw className="w-5 h-5 text-[#FE91FE] animate-spin" />
              <span className="text-xs">Gire o celular para a horizontal para melhor visão!</span>
            </div>
            <button
              onClick={() => setDismissPortraitWarning(true)}
              className="text-[11px] font-bold text-pink-300 px-2 py-1 rounded bg-[#4A0052]"
            >
              OK
            </button>
          </div>
        )}

        {/* Minimalist Safe-Area Perimeter HUD (Top) */}
        <div className="absolute top-2 left-2 right-2 z-30 flex items-center justify-between text-white pointer-events-none text-xs sm:text-sm font-bold">
          {/* Energy Hearts */}
          <div className="flex items-center gap-1 bg-[#4A0052]/80 backdrop-blur px-3 py-1.5 rounded-full border border-[#FE91FE]/30 shadow">
            {[0, 1, 2].map((i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${
                  i < inGameEnergy
                    ? 'text-[#FE91FE] fill-[#FE91FE]'
                    : 'text-gray-500 fill-gray-500/50'
                }`}
              />
            ))}
          </div>

          {/* Time Remaining */}
          <div className="flex items-center gap-1.5 bg-[#4A0052]/80 backdrop-blur px-3 py-1.5 rounded-full border border-[#FE91FE]/30 shadow font-mono">
            <Clock className="w-4 h-4 text-pink-300" />
            <span className={timeRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}>
              {timeRemaining}s
            </span>
          </div>

          {/* Rescued Elderly Counter in this Phase */}
          <div className="bg-[#4A0052]/80 backdrop-blur px-3 py-1.5 rounded-full border border-[#FE91FE]/30 shadow text-[#FE91FE]">
            ♥ {rescuedCount} idosos
          </div>

          {/* Score */}
          <div className="bg-[#4A0052]/80 backdrop-blur px-3 py-1.5 rounded-full border border-[#FE91FE]/30 shadow font-mono text-amber-300">
            {score} pts
          </div>
        </div>

        {/* The Game Canvas Viewport */}
        <div className="w-full h-full flex items-center justify-center">
          <canvas ref={canvasRef} className="block max-w-full max-h-full object-contain" />
        </div>

        {/* Mobile First Multi-Touch Virtual Controls */}
        <div
          className="absolute bottom-2 left-0 right-0 px-4 pb-[env(safe-area-inset-bottom,8px)] z-30 flex items-center justify-between pointer-events-none"
          style={{ touchAction: 'none' }}
        >
          {/* Left Directional D-Pad (Holding Left/Right while Jumping) */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <button
              onMouseDown={(e) => handleMouseDown('ArrowLeft', e)}
              onMouseUp={(e) => handleMouseUp('ArrowLeft', e)}
              onTouchStart={(e) => handleTouchStart('ArrowLeft', e)}
              onTouchEnd={(e) => handleTouchEnd('ArrowLeft', e)}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#6B0075]/85 active:bg-[#FE91FE] active:text-[#6B0075] text-white border-2 border-[#FE91FE]/60 flex items-center justify-center shadow-2xl transition active:scale-95"
            >
              <ArrowLeft className="w-8 h-8" />
            </button>
            <button
              onMouseDown={(e) => handleMouseDown('ArrowRight', e)}
              onMouseUp={(e) => handleMouseUp('ArrowRight', e)}
              onTouchStart={(e) => handleTouchStart('ArrowRight', e)}
              onTouchEnd={(e) => handleTouchEnd('ArrowRight', e)}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#6B0075]/85 active:bg-[#FE91FE] active:text-[#6B0075] text-white border-2 border-[#FE91FE]/60 flex items-center justify-center shadow-2xl transition active:scale-95"
            >
              <ArrowRight className="w-8 h-8" />
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3 pointer-events-auto">
            {/* Contextual Action Button (Ajudar / Ativar / Escudo) */}
            <button
              onMouseDown={(e) => handleMouseDown('KeyE', e)}
              onMouseUp={(e) => handleMouseUp('KeyE', e)}
              onTouchStart={(e) => handleTouchStart('KeyE', e)}
              onTouchEnd={(e) => handleTouchEnd('KeyE', e)}
              className={`min-w-16 h-14 sm:h-16 px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xl border-2 transition active:scale-95 ${
                contextualBtn.isContextual
                  ? 'bg-gradient-to-r from-[#FE91FE] to-pink-500 text-[#4A0052] border-white animate-pulse'
                  : 'bg-[#83078E]/85 active:bg-[#FE91FE] active:text-[#83078E] text-[#FE91FE] border-[#FE91FE]/60'
              }`}
            >
              <Shield className="w-5 h-5 fill-current shrink-0" />
              <span>{contextualBtn.label}</span>
            </button>

            {/* Jump Button */}
            <button
              onMouseDown={(e) => handleMouseDown('ArrowUp', e)}
              onMouseUp={(e) => handleMouseUp('ArrowUp', e)}
              onTouchStart={(e) => handleTouchStart('ArrowUp', e)}
              onTouchEnd={(e) => handleTouchEnd('ArrowUp', e)}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#FE91FE] active:bg-white text-[#83078E] font-black border-2 border-white flex flex-col items-center justify-center shadow-2xl transition active:scale-95"
            >
              <ArrowUp className="w-7 h-7 stroke-[3]" />
              <span className="text-[9px] uppercase tracking-tighter -mt-1 font-bold">Pular</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 6. INTERMISSION SCREEN ---
  if (roomState.startsWith('INTERMISSION_')) {
    const myRank = rankings.findIndex((p) => p.id === playerId) + 1;
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full text-center">
        <div className="bg-[#6B0075] rounded-3xl p-6 border-2 border-[#FE91FE]/40 shadow-2xl w-full">
          <h2 className="text-xl font-bold text-white mb-2">Classificação Atual</h2>
          <div className="bg-[#4A0052] p-5 rounded-2xl border border-pink-400/20 my-4">
            <span className="text-xs uppercase text-pink-300 font-bold">Sua Posição</span>
            <div className="text-4xl font-black text-[#FE91FE] mt-1 font-mono">
              {myRank > 0 ? `${myRank}º Lugar` : 'Em apuração...'}
            </div>
            <p className="text-xs text-pink-100 mt-2">
              ♥ {rescuedCount} idosos acolhidos • {score.toLocaleString('pt-BR')} pontos
            </p>
          </div>
          <p className="text-xs text-pink-200 animate-pulse">
            O apresentador está comentando os destaques da rodada...
          </p>
        </div>
      </div>
    );
  }

  // --- 7. FINAL PODIUM & RESULTS SCREEN ---
  if (roomState === 'PODIUM') {
    const myRank = rankings.findIndex((p) => p.id === playerId) + 1;
    const isTop3 = myRank >= 1 && myRank <= 3;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full text-center">
        <div className="bg-[#6B0075] rounded-3xl p-6 border-3 border-[#FE91FE] shadow-2xl w-full">
          {isTop3 ? (
            <div>
              <div className="text-6xl mb-2 animate-bounce">🍬</div>
              <h2 className="font-shrikhand text-2xl sm:text-3xl text-[#FE91FE]">
                PARABÉNS! VOCÊ GANHOU DOCES!
              </h2>
              <p className="text-sm font-bold text-yellow-300 mt-1">
                Você conquistou o {myRank}º lugar no pódio!
              </p>
            </div>
          ) : (
            <div>
              <div className="text-5xl mb-2">💜</div>
              <h2 className="font-shrikhand text-2xl text-white">
                Guardião do Cuidado!
              </h2>
              <p className="text-xs text-pink-200 mt-1">
                Sua dedicação fez toda a diferença para as pessoas idosas da cidade!
              </p>
            </div>
          )}

          <div className="bg-[#4A0052] p-4 rounded-2xl border border-pink-400/20 my-6 space-y-2 text-left text-xs">
            <div className="flex justify-between text-pink-100">
              <span>Posição Final:</span>
              <b className="text-white">{myRank}º lugar</b>
            </div>
            <div className="flex justify-between text-pink-100">
              <span>Idosos Ajudados:</span>
              <b className="text-[#FE91FE]">♥ {rescuedCount}</b>
            </div>
            <div className="flex justify-between text-pink-100">
              <span>Pontos Acumulados:</span>
              <b className="text-amber-300 font-mono">{score.toLocaleString('pt-BR')}</b>
            </div>
            <div className="flex justify-between text-pink-100">
              <span>Recuperações:</span>
              <b className="text-white">{recoveries}</b>
            </div>
          </div>

          <p className="text-[11px] text-pink-200 italic">
            Obrigado por participar da Semana de Tecnologia com a VIRLA!
          </p>
        </div>
      </div>
    );
  }

  return null;
};
