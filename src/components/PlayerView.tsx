import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Heart,
  Clock,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Shield,
  Trophy,
  AlertTriangle,
  Loader2,
  Edit3,
  CheckCircle2,
  LogOut,
  Sparkles,
  Smartphone,
  X,
} from 'lucide-react';
import { GameEngine } from '../game/engine';
import { LEVELS } from '../game/levels';
import { CHARACTER_SKINS } from '../game/types';
import { sound } from '../game/audio';
import { SpriteRenderer } from '../game/sprites';
import { auth, googleAuthProvider } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { VIRLALogo } from './VIRLALogo';

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

export interface SavedProfile {
  googleId: string;
  nickname: string;
  characterIndex: number;
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
  onPresenterAuthorized?: (authorized: boolean, idToken: string, isExplicitLogin?: boolean) => void;
}

// Mini Character Canvas Preview Component
const MiniCharacterPreview: React.FC<{ skinIndex: number; size?: number }> = ({ skinIndex, size = 64 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      // Center the sprite in the canvas
      ctx.translate(canvas.width / 2 - 16, canvas.height / 2 - 20);
      SpriteRenderer.drawPlayer(ctx, 0, 0, skinIndex, 1, 'idle', frame, false);
      ctx.restore();
      frame += 0.05;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [skinIndex]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="shrink-0 pointer-events-none drop-shadow-md"
    />
  );
};

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
  onPresenterAuthorized,
}) => {
  // Navigation Steps:
  // 'AUTH' -> 'PROFILE' -> 'PIN' -> (joined room / lobby / gameplay / podium)
  const [currentStep, setCurrentStep] = useState<'AUTH' | 'PROFILE' | 'PIN'>('AUTH');

  // Google Authentication State
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [presenterNotice, setPresenterNotice] = useState<string | null>(null);
  const [idTokenString, setIdTokenString] = useState<string>('');

  // Profile Form State
  const [nicknameInput, setNicknameInput] = useState<string>('');
  const [selectedSkin, setSelectedSkin] = useState<number>(0);
  const [hasExistingProfile, setHasExistingProfile] = useState<boolean>(false);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Room PIN State
  const [pinInput, setPinInput] = useState<string>(initialPin);
  const [isJoining, setIsJoining] = useState<boolean>(false);

  // In-Game References & State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [inGameEnergy, setInGameEnergy] = useState(3);
  const [notification, setNotification] = useState<string | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissLandscapeNotice, setDismissLandscapeNotice] = useState(false);

  // Multi-Touch Tracking for fluid simultaneous movement & jump
  const activeTouchesRef = useRef<{ [touchId: number]: string }>({});
  const [touchState, setTouchState] = useState<{ [key: string]: boolean }>({});

  const [contextualBtn, setContextualBtn] = useState<{
    label: string;
    isContextual: boolean;
  }>({ label: 'Escudo', isContextual: false });

  // Value cards for Waiting Room carousel
  const [valueCardIndex, setValueCardIndex] = useState(0);
  const VIRLA_VALUES = [
    { title: 'Vida', desc: 'Preservar a segurança, a saúde e o bem-estar da pessoa idosa no dia a dia.' },
    { title: 'Inclusão', desc: 'Promover a participação ativa, socialização e convivência acolhedora.' },
    { title: 'Respeito', desc: 'Reconhecer a autonomia, a história de vida e as preferências individuais.' },
    { title: 'Ligação', desc: 'Fortalecer os laços de confiança e comunicação entre familiares e cuidadores.' },
    { title: 'Amparo', desc: 'Garantir proteção contínua e tranquilidade para quem cuida e quem é cuidado.' },
  ];

  // Rotate value cards every 4 seconds in lobby
  useEffect(() => {
    if (playerId && roomState === 'LOBBY') {
      const interval = setInterval(() => {
        setValueCardIndex((prev) => (prev + 1) % VIRLA_VALUES.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [playerId, roomState]);

  // Keep PIN synced from query parameter if present
  useEffect(() => {
    if (initialPin) {
      setPinInput(initialPin);
    }
  }, [initialPin]);

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

  // Floating notification timer
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3200);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Passive Firebase Auth state check on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          setIdTokenString(token);

          // Verify token on backend
          const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
          });
          const data = await res.json();

          if (data.success && data.googleUser) {
            setGoogleUser(data.googleUser);
            sessionStorage.setItem('virla_google_user', JSON.stringify(data.googleUser));

            // Inform App of presenter credentials PASSIVELY without forcing redirect
            onPresenterAuthorized?.(!!data.isHostAuthorized, token, false);

            if (data.presenterClaimPending) {
              setPresenterNotice(
                'Conta fabiooliveiral2020@gmail.com conectada. A custom claim presenter: true pode ser atribuída administrativamente.'
              );
            } else {
              setPresenterNotice(null);
            }

            if (data.profile) {
              setNicknameInput(data.profile.nickname);
              setSelectedSkin(data.profile.characterIndex);
              setHasExistingProfile(true);
              // If profile already exists, proceed to PIN entry if not in a room yet
              if (!playerId) {
                setCurrentStep('PIN');
              }
            } else {
              const defaultName = (data.googleUser.name || 'Guardião').split(' ')[0].substring(0, 16);
              setNicknameInput(defaultName);
              setHasExistingProfile(false);
              if (!playerId) {
                setCurrentStep('PROFILE');
              }
            }
          }
        } catch (err) {
          console.error('Error verifying Firebase Auth user on server:', err);
        }
      } else {
        setGoogleUser(null);
        onPresenterAuthorized?.(false, '', false);
        setPresenterNotice(null);
        if (!playerId) {
          setCurrentStep('AUTH');
        }
      }
    });

    return () => unsubscribe();
  }, [playerId]);

  // Official Real Google Sign In Handler (Explicit user action)
  const handleGoogleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    setPresenterNotice(null);

    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const token = await result.user.getIdToken(true);
      setIdTokenString(token);

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });
      const data = await res.json();

      if (data.success && data.googleUser) {
        setGoogleUser(data.googleUser);
        sessionStorage.setItem('virla_google_user', JSON.stringify(data.googleUser));

        // When explicitly logging in, allow initial auto-redirect if presenter
        if (data.isHostAuthorized) {
          onPresenterAuthorized?.(true, token, true);
        } else {
          onPresenterAuthorized?.(false, token, false);
        }

        if (data.presenterClaimPending) {
          setPresenterNotice(
            'Conta fabiooliveiral2020@gmail.com conectada. O painel do apresentador está liberado para sua conta.'
          );
        } else {
          setPresenterNotice(null);
        }

        if (data.profile) {
          setNicknameInput(data.profile.nickname);
          setSelectedSkin(data.profile.characterIndex);
          setHasExistingProfile(true);
          // If profile exists, advance to PIN entry directly
          setCurrentStep('PIN');
        } else {
          const defaultName = (data.googleUser.name || 'Guardião').split(' ')[0].substring(0, 16);
          setNicknameInput(defaultName);
          setHasExistingProfile(false);
          setCurrentStep('PROFILE');
        }
      } else {
        setAuthError(data.message || 'Falha na validação do servidor. Tente novamente.');
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Login cancelado: a janela de autenticação do Google foi fechada.');
      } else if (err.code === 'auth/popup-blocked') {
        setAuthError('O pop-up de login foi bloqueado pelo navegador. Por favor, permita pop-ups nesta página.');
      } else {
        setAuthError(err.message || 'Ocorreu um erro ao conectar à conta Google.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch {}
    setGoogleUser(null);
    onPresenterAuthorized?.(false, '', false);
    setPresenterNotice(null);
    setCurrentStep('AUTH');
    sessionStorage.removeItem('virla_google_user');
  };

  // Profile Save Submit Handler (Step 2)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = nicknameInput.trim();
    if (!cleanNick || cleanNick.length < 2) {
      setProfileError('Por favor, informe seu nome de exibição (entre 2 e 16 caracteres).');
      return;
    }
    if (!googleUser) {
      setProfileError('Sessão não identificada. Por favor, conecte-se com sua conta Google.');
      setCurrentStep('AUTH');
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);

    try {
      // Get fresh Firebase ID token if needed
      let token = idTokenString;
      if (!token && auth.currentUser) {
        token = await auth.currentUser.getIdToken();
        setIdTokenString(token);
      }

      if (!token) {
        setProfileError('Sessão expirada. Reconecte sua conta Google para continuar.');
        setCurrentStep('AUTH');
        return;
      }

      const res = await fetch('/api/profile/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          idToken: token,
          nickname: cleanNick,
          characterIndex: selectedSkin,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      } else {
        const textFallback = await res.text().catch(() => '');
        console.warn('Servidor respondeu com formato não-JSON:', res.status, textFallback.substring(0, 100));
      }

      // Check HTTP status code explicitly
      if (!res.ok) {
        if (res.status === 404) {
          setProfileError('Rota de salvamento não encontrada no servidor (HTTP 404). Verifique se a mesma versão de build foi publicada no backend.');
        } else if (res.status === 401 || res.status === 403) {
          setProfileError(data?.message || 'Sessão de autenticação Firebase expirada ou inválida. Por favor, reconecte sua conta Google.');
        } else if (res.status === 400) {
          setProfileError(data?.message || 'Dados inválidos para o perfil. Verifique o apelido e o personagem.');
        } else if (res.status >= 500) {
          setProfileError(data?.message || 'Erro interno no servidor ao salvar perfil (HTTP 500). Tente novamente em instantes.');
        } else {
          setProfileError(data?.message || `Falha ao salvar o perfil (Código HTTP ${res.status}).`);
        }
        return;
      }

      // Strictly advance ONLY when the server confirms successful persistence
      if (data && data.success && data.profile) {
        setHasExistingProfile(true);
        setCurrentStep('PIN');
      } else {
        setProfileError(data?.message || 'O servidor não pôde confirmar o salvamento do perfil.');
      }
    } catch (err: any) {
      console.error('Erro de rede ao salvar perfil:', err);
      setProfileError(`Falha na comunicação de rede com o servidor: ${err?.message || 'verifique sua conexão'}.`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Room Join Submit Handler (Step 3)
  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUser) {
      setCurrentStep('AUTH');
      return;
    }
    const cleanPin = pinInput.trim();
    if (!cleanPin || cleanPin.length < 4) {
      return;
    }
    setIsJoining(true);
    onJoinRoom(cleanPin, nicknameInput.trim(), selectedSkin, googleUser);
  };

  // Reset joining indicator on error or success
  useEffect(() => {
    if (joinError || playerId) {
      setIsJoining(false);
    }
  }, [joinError, playerId]);

  // Handle active gameplay canvas initialization
  const isGameplay = ['TUTORIAL', 'PHASE_1', 'PHASE_2', 'PHASE_3'].includes(roomState);

  useEffect(() => {
    if (isGameplay && canvasRef.current && activePhaseId && !phaseFinished) {
      const levelDef = LEVELS[activePhaseId as keyof typeof LEVELS] || LEVELS.fase1;
      const canvas = canvasRef.current;

      // Invariant internal coordinate resolution: exactly 800 x 500
      // Physics, jump heights, collisions, elderly positions are 100% constant across all devices!
      const VIRTUAL_WIDTH = 800;
      const VIRTUAL_HEIGHT = 500;
      canvas.width = VIRTUAL_WIDTH;
      canvas.height = VIRTUAL_HEIGHT;

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
          particleCount: 130,
          spread: 85,
          origin: { y: 0.6 },
          colors: ['#FE91FE', '#83078E', '#FACC15', '#FFFFFF'],
        });
      }
    }
  }, [roomState, rankings, playerId]);

  // Multi-Touch Handlers for mobile controls
  const handleTouchStart = (key: string, e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      activeTouchesRef.current[touch.identifier] = key;
    }
    setTouchState((prev) => ({ ...prev, [key]: true }));
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
    const isStillHeld = Object.values(activeTouchesRef.current).includes(key);
    if (!isStillHeld) {
      setTouchState((prev) => ({ ...prev, [key]: false }));
      if (engineRef.current) {
        engineRef.current.setTouchInput(key, false);
      }
    }
  };

  // -------------------------------------------------------------
  // SCREEN: SESSION REPLACED (Account taken over in another tab)
  // -------------------------------------------------------------
  if (sessionReplacedMessage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center max-w-md mx-auto w-full overflow-y-auto">
        <div className="w-full bg-[#6B0075] p-6 rounded-3xl border-2 border-amber-400 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400 mx-auto flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="font-shrikhand text-2xl text-white mb-2">Sessão Transferida</h2>
          <p className="text-sm text-pink-100 mb-6 leading-relaxed">
            {sessionReplacedMessage}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full min-h-[48px] py-3 rounded-xl bg-gradient-to-r from-[#FE91FE] to-[#83078E] text-white font-bold border border-white shadow-lg hover:scale-102 transition cursor-pointer"
          >
            Reconectar nesta Aba
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 1: ONLY AUTHENTICATION (Entrar com Google)
  // -------------------------------------------------------------
  if (!playerId && currentStep === 'AUTH') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 max-w-md mx-auto w-full overflow-y-auto">
        <div className="w-full bg-[#6B0075] rounded-3xl p-5 sm:p-8 border-2 border-[#FE91FE]/40 shadow-2xl text-center my-auto">
          {/* Official VIRLA Logo */}
          <div className="flex justify-center mb-4">
            <VIRLALogo size="lg" />
          </div>

          <h1 className="font-shrikhand text-3xl sm:text-4xl text-[#FE91FE] tracking-wide mb-1">
            VIRLA
          </h1>
          <h2 className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wider mb-2">
            Guardiões do Cuidado
          </h2>
          <p className="text-[10px] sm:text-xs text-pink-200 uppercase tracking-widest font-medium mb-5">
            Vida • Inclusão • Respeito • Ligação • Amparo
          </p>

          {/* Short Game Presentation */}
          <div className="bg-[#4A0052]/80 rounded-2xl p-3.5 sm:p-4 border border-pink-400/20 text-left mb-5 space-y-1.5">
            <p className="text-xs text-pink-100 leading-relaxed font-medium">
              🏃‍♀️ Corra, pule e conecte o cuidado nesta aventura inspirada em clássicos de plataforma!
            </p>
            <p className="text-[11px] text-pink-200/90 leading-relaxed">
              Ajude as pessoas idosas, supere a Desorganização e dispute os doces do pódio final na Semana de Tecnologia.
            </p>
          </div>

          {/* Presenter Notice Banner */}
          {presenterNotice && (
            <div className="bg-amber-500/20 border border-amber-400 text-amber-100 text-xs rounded-xl p-3 mb-4 text-left flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <span>{presenterNotice}</span>
            </div>
          )}

          {/* Auth Error Banner */}
          {authError && (
            <div className="bg-red-500/25 border border-red-400 text-red-100 text-xs rounded-xl p-3 mb-4 text-left flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Official Google Sign In Button - Min Height 48px */}
          <button
            type="button"
            disabled={isAuthenticating}
            onClick={handleGoogleSignIn}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-white text-gray-800 font-bold text-sm sm:text-base flex items-center justify-center gap-3 shadow-lg hover:bg-gray-50 active:scale-98 transition disabled:opacity-60 cursor-pointer border border-gray-200"
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-[#83078E]" />
                <span>Autenticando com Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                <span>Entrar com Google</span>
              </>
            )}
          </button>

          <p className="text-[10px] text-pink-300 mt-4">
            Autenticação rápida e segura. Seu e-mail não será exposto no projetor.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 2: PROFILE SETUP (Nome de exibição e Personagem)
  // -------------------------------------------------------------
  if (!playerId && currentStep === 'PROFILE') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 max-w-md mx-auto w-full overflow-y-auto">
        <div className="w-full bg-[#6B0075] rounded-3xl p-5 sm:p-6 border-2 border-[#FE91FE]/40 shadow-2xl my-auto">
          {/* Logged in User Bar */}
          <div className="flex items-center justify-between bg-[#4A0052]/90 p-3 rounded-2xl border border-pink-400/20 mb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              {googleUser?.picture ? (
                <img
                  src={googleUser.picture}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full border border-pink-300 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#83078E] text-white font-bold flex items-center justify-center border border-pink-300 shrink-0 text-xs">
                  {googleUser?.name?.charAt(0) || 'G'}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-xs truncate">{googleUser?.name}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                </div>
                <span className="text-[10px] text-pink-300 block truncate">{googleUser?.email}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 text-pink-300 hover:text-white transition shrink-0 cursor-pointer"
              title="Sair desta conta Google"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center mb-4">
            <h2 className="font-shrikhand text-2xl text-[#FE91FE] tracking-wide">
              {hasExistingProfile ? 'Seu Perfil de Cuidador' : 'Criar seu Perfil'}
            </h2>
            <p className="text-xs text-pink-100 mt-1">
              {hasExistingProfile
                ? 'Recuperamos seu cadastro! Confirme ou edite os dados:'
                : 'Defina seu nome e escolha seu personagem para a partida:'}
            </p>
          </div>

          {profileError && (
            <div className="bg-red-500/20 border border-red-400 text-red-200 text-xs rounded-xl p-2.5 mb-4 text-center">
              {profileError}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Display Name Input - Min 48px, text-base prevents iOS zoom */}
            <div>
              <label className="text-[11px] uppercase tracking-wider text-pink-200 font-bold block mb-1">
                Nome de Exibição no Ranking
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={16}
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="Ex: Clara Cuidadora"
                  className="w-full min-h-[48px] bg-[#4A0052] border border-[#FE91FE]/40 rounded-xl px-4 py-3 text-white text-base font-semibold focus:outline-none focus:ring-2 focus:ring-[#FE91FE]"
                />
                <span className="absolute right-3 top-3.5 text-[10px] text-pink-300">
                  {nicknameInput.length}/16
                </span>
              </div>
            </div>

            {/* Character Selector with Visual Preview */}
            <div>
              <label className="text-[11px] uppercase tracking-wider text-pink-200 font-bold block mb-1">
                Escolha seu Personagem
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CHARACTER_SKINS.map((skin) => {
                  const isSelected = selectedSkin === skin.id;
                  return (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => setSelectedSkin(skin.id)}
                      className={`p-2 rounded-2xl border-2 flex flex-col items-center text-center transition cursor-pointer relative ${
                        isSelected
                          ? 'border-[#FE91FE] bg-[#83078E] shadow-lg scale-102 ring-2 ring-[#FE91FE]/40'
                          : 'border-pink-400/20 bg-[#4A0052]/60 hover:bg-[#4A0052]'
                      }`}
                    >
                      <MiniCharacterPreview skinIndex={skin.id} size={50} />
                      <span className="font-bold text-xs text-white mt-1">{skin.name}</span>
                      <span className="text-[9px] text-pink-200 truncate w-full">{skin.title}</span>
                      {isSelected && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#FE91FE] text-[#6B0075] rounded-full flex items-center justify-center font-bold text-[10px] shadow">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Character Bio */}
              <div className="mt-2.5 p-2.5 rounded-xl bg-[#4A0052]/60 border border-pink-400/20 text-left flex items-center gap-2">
                <span className="text-xl shrink-0">{CHARACTER_SKINS[selectedSkin]?.badge}</span>
                <p className="text-[11px] text-pink-100 leading-snug">
                  <strong className="text-[#FE91FE]">{CHARACTER_SKINS[selectedSkin]?.name}:</strong>{' '}
                  {CHARACTER_SKINS[selectedSkin]?.description}
                </p>
              </div>
            </div>

            {/* Submit Button - Min Height 48px */}
            <button
              type="submit"
              disabled={isSavingProfile || !nicknameInput.trim()}
              className="w-full min-h-[48px] py-3 rounded-xl bg-gradient-to-r from-[#FE91FE] to-[#83078E] text-white font-bold text-base border border-white/60 shadow-lg hover:scale-102 active:scale-98 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSavingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando Perfil...</span>
                </>
              ) : (
                <span>Salvar e Continuar</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 3: ROOM PIN ENTRY
  // -------------------------------------------------------------
  if (!playerId && currentStep === 'PIN') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 max-w-md mx-auto w-full overflow-y-auto">
        <div className="w-full bg-[#6B0075] rounded-3xl p-5 sm:p-6 border-2 border-[#FE91FE]/40 shadow-2xl my-auto">
          {/* Confirmed Player Card */}
          <div className="flex items-center justify-between bg-[#4A0052] p-3 rounded-2xl border border-pink-400/30 mb-4 shadow">
            <div className="flex items-center gap-2.5">
              <MiniCharacterPreview skinIndex={selectedSkin} size={44} />
              <div>
                <span className="text-[9px] uppercase tracking-wider text-pink-300 font-bold block">
                  Jogador Confirmado
                </span>
                <span className="font-bold text-sm sm:text-base text-white">{nicknameInput}</span>
                <span className="text-[11px] text-[#FE91FE] block font-medium">
                  {CHARACTER_SKINS[selectedSkin]?.name} ({CHARACTER_SKINS[selectedSkin]?.title})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep('PROFILE')}
              className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#83078E] hover:bg-[#83078E]/80 text-[#FE91FE] text-xs font-semibold flex items-center gap-1 border border-pink-400/30 transition cursor-pointer"
              title="Editar Perfil"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          </div>

          <div className="text-center mb-4">
            <h2 className="font-shrikhand text-2xl text-[#FE91FE] tracking-wide">
              Entrar na Competição
            </h2>
            <p className="text-xs text-pink-100 mt-1">
              Digite o código PIN exibido no telão pelo apresentador:
            </p>
          </div>

          {/* Join Error Notice */}
          {joinError && (
            <div className="bg-red-500/25 border border-red-400 text-red-100 text-xs rounded-xl p-2.5 mb-4 text-center">
              {joinError}
            </div>
          )}

          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-pink-200 font-bold block mb-1">
                Código PIN da Sala (6 dígitos)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 849201"
                className="w-full min-h-[52px] bg-[#4A0052] border-2 border-[#FE91FE]/50 rounded-xl px-4 py-3 text-center text-white text-2xl sm:text-3xl font-mono tracking-widest font-black focus:outline-none focus:ring-2 focus:ring-[#FE91FE]"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isJoining || pinInput.length < 4}
              className="w-full min-h-[48px] py-3 rounded-xl bg-gradient-to-r from-[#FE91FE] to-[#83078E] text-white font-bold text-base border border-white/60 shadow-lg hover:scale-102 active:scale-98 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Conectando à Sala...</span>
                </>
              ) : (
                <span>Entrar na Sala</span>
              )}
            </button>
          </form>

          <p className="text-[11px] text-pink-200 text-center mt-4">
            Até 45 participantes simultâneos. As 3 primeiras pessoas ganharão doces!
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 4: WAITING ROOM IN LOBBY (Sincronizada pelo Apresentador)
  // -------------------------------------------------------------
  if (playerId && roomState === 'LOBBY') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 max-w-md mx-auto w-full text-center overflow-y-auto">
        <div className="w-full bg-[#6B0075] rounded-3xl p-5 sm:p-8 border-2 border-[#FE91FE]/40 shadow-2xl space-y-4 my-auto">
          {/* Room PIN Badge */}
          <div className="inline-flex items-center gap-2 bg-[#4A0052] px-4 py-1.5 rounded-full border border-pink-400/40 text-xs font-mono text-pink-200">
            <span>SALA:</span>
            <strong className="text-white text-sm font-bold tracking-wider">{pinInput || 'CONECTADA'}</strong>
          </div>

          {/* Player Identity Confirmation */}
          <div className="flex flex-col items-center">
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-[#4A0052] flex items-center justify-center border-2 border-[#FE91FE] shadow-lg mb-2">
              <MiniCharacterPreview skinIndex={characterIndex} size={68} />
            </div>
            <h2 className="font-shrikhand text-2xl text-white">
              Olá, {nickname}!
            </h2>
            <span className="text-xs font-semibold text-[#FE91FE]">
              {CHARACTER_SKINS[characterIndex]?.name} • {CHARACTER_SKINS[characterIndex]?.title}
            </span>
          </div>

          {/* Sync Waiting Message */}
          <div className="p-3.5 rounded-2xl bg-[#4A0052]/90 border border-amber-400/50 text-amber-200 text-xs space-y-1">
            <div className="flex items-center justify-center gap-2 font-bold text-white text-sm">
              <Clock className="w-4 h-4 text-amber-300 animate-spin" />
              <span>Aguardando o Apresentador...</span>
            </div>
            <p className="text-[11px] text-pink-100">
              A partida começará simultaneamente no projetor para todos os participantes.
            </p>
          </div>

          {/* Rotating VIRLA Educational Cards */}
          <div className="p-3.5 rounded-2xl bg-[#4A0052]/50 border border-pink-400/20 text-left min-h-[85px] flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#FE91FE] uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Valores VIRLA: {VIRLA_VALUES[valueCardIndex].title}</span>
            </div>
            <p className="text-xs text-pink-100 leading-relaxed">
              {VIRLA_VALUES[valueCardIndex].desc}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // COUNTDOWN OVERLAY
  // -------------------------------------------------------------
  if (roomState === 'COUNTDOWN') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-bounce">
          <span className="text-xs uppercase tracking-widest text-[#FE91FE] font-bold block mb-2">
            Prepare-se!
          </span>
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-[#FE91FE] to-[#83078E] border-4 border-white flex items-center justify-center shadow-2xl mx-auto">
            <span className="font-shrikhand text-5xl sm:text-7xl text-white">
              {countdown > 0 ? countdown : 'VAI!'}
            </span>
          </div>
          <span className="text-sm font-semibold text-pink-200 mt-4 block">
            Corra, pule e conecte o cuidado!
          </span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 6: PODIUM SCREEN
  // -------------------------------------------------------------
  if (roomState === 'PODIUM') {
    const myRank = rankings.findIndex((p) => p.id === playerId) + 1;
    const isTop3 = myRank >= 1 && myRank <= 3;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 max-w-lg mx-auto w-full text-center overflow-y-auto">
        <div className="w-full bg-[#6B0075] rounded-3xl p-5 sm:p-6 border-2 border-[#FE91FE]/40 shadow-2xl space-y-4 my-auto">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center mx-auto shadow-lg border-2 border-white">
            <Trophy className="w-7 h-7 text-white" />
          </div>

          <h2 className="font-shrikhand text-2xl sm:text-3xl text-white">Classificação Final</h2>

          {/* Player Personal Result Card */}
          <div
            className={`p-4 rounded-2xl border-2 text-center ${
              isTop3
                ? 'bg-gradient-to-r from-[#83078E] to-[#6B0075] border-amber-300 shadow-xl'
                : 'bg-[#4A0052] border-pink-400/30'
            }`}
          >
            <div className="text-[10px] sm:text-xs uppercase tracking-wider text-pink-200 font-bold mb-1">
              Seu Desempenho
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white flex items-center justify-center gap-2">
              <span>{myRank > 0 ? `${myRank}º Lugar` : 'Participante'}</span>
              {isTop3 && <span className="text-xl">🍬</span>}
            </div>
            {isTop3 && (
              <span className="inline-block mt-1 bg-amber-400 text-amber-950 text-xs font-bold px-3 py-0.5 rounded-full shadow">
                Parabéns! Você ganhou doces da VIRLA!
              </span>
            )}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-pink-400/20 text-xs">
              <div>
                <span className="text-[10px] text-pink-300 block">Pontuação</span>
                <strong className="text-[#FE91FE] text-sm sm:text-base">{score}</strong>
              </div>
              <div>
                <span className="text-[10px] text-pink-300 block">Idosos</span>
                <strong className="text-white text-sm sm:text-base">{rescuedCount}</strong>
              </div>
              <div>
                <span className="text-[10px] text-pink-300 block">Recuperações</span>
                <strong className="text-pink-200 text-sm sm:text-base">{recoveries}</strong>
              </div>
            </div>
          </div>

          {/* Top 3 Public Roster */}
          <div className="text-left bg-[#4A0052]/80 rounded-2xl p-3 border border-pink-400/20">
            <span className="text-[10px] uppercase tracking-wider text-pink-300 font-bold block mb-2">
              Pódio da Semana de Tecnologia
            </span>
            <div className="space-y-1.5">
              {rankings.slice(0, 3).map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                    p.id === playerId
                      ? 'bg-[#83078E] text-[#FE91FE] font-bold border border-[#FE91FE]'
                      : 'bg-[#6B0075]/60 text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 text-center font-bold">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </span>
                    <span className="truncate max-w-[120px] sm:max-w-[160px]">{p.nickname}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-pink-200">👵 {p.rescuedCount}</span>
                    <strong className="text-amber-300">{p.score} pts</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STEP 5: ACTIVE GAMEPLAY & MOBILE HUD
  // -------------------------------------------------------------
  return (
    <div className="flex-1 flex flex-col justify-between w-full h-full relative overflow-hidden select-none touch-none overscroll-none">
      {/* Top Mobile HUD Bar */}
      <div className="w-full bg-[#6B0075]/95 backdrop-blur-md border-b border-[#FE91FE]/30 px-2.5 sm:px-4 py-1.5 flex items-center justify-between text-xs shrink-0 z-30">
        {/* Left: Player Nickname & Energy Hearts */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1 bg-[#4A0052] px-2 py-1 rounded-lg border border-pink-400/30">
            <span className="font-bold text-white truncate max-w-[75px] sm:max-w-[120px]">{nickname}</span>
          </div>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3].map((heartIndex) => (
              <Heart
                key={heartIndex}
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition ${
                  heartIndex <= inGameEnergy
                    ? 'text-pink-400 fill-pink-400 drop-shadow'
                    : 'text-gray-500 fill-gray-500/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Center: Remaining Timer */}
        <div className="flex items-center gap-1 bg-[#4A0052] px-2.5 sm:px-3 py-1 rounded-lg border border-pink-400/40 text-amber-300 font-mono font-bold">
          <Clock className="w-3.5 h-3.5" />
          <span>{timeRemaining}s</span>
        </div>

        {/* Right: Rescues & Total Score */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1 bg-[#4A0052] px-2 py-1 rounded-lg border border-pink-400/30 text-white font-semibold">
            <span>👵</span>
            <span>{rescuedCount}</span>
          </div>
          <div className="bg-[#83078E] px-2 sm:px-2.5 py-1 rounded-lg border border-[#FE91FE]/40 text-[#FE91FE] font-bold">
            {score} pts
          </div>
        </div>
      </div>

      {/* Floating In-Game Notification */}
      {notification && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 bg-[#83078E]/95 border-2 border-[#FE91FE] text-white text-xs font-bold px-3 py-1.5 rounded-2xl shadow-2xl animate-fade-in flex items-center gap-1.5 max-w-[90%] text-center">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Portrait Suggestion Floating Hint (Non-blocking) */}
      {isPortrait && !dismissLandscapeNotice && (
        <div className="absolute top-12 right-2 z-40 bg-[#3B0042]/90 border border-pink-400/40 text-pink-200 text-[10px] px-2.5 py-1 rounded-xl shadow-lg flex items-center gap-1.5 animate-pulse">
          <Smartphone className="w-3 h-3 text-amber-300 rotate-90" />
          <span>Dica: Modo paisagem expande a visão</span>
          <button
            type="button"
            onClick={() => setDismissLandscapeNotice(true)}
            className="text-pink-300 hover:text-white ml-1 p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main Game Viewport - Canvas Preserves Invariant 800x500 Aspect Ratio */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-[#2D0033] p-1">
        <canvas
          ref={canvasRef}
          className="w-full max-w-full h-auto max-h-full object-contain shadow-2xl block touch-none select-none"
        />

        {/* Phase Finished Overlay */}
        {phaseFinished && (
          <div className="absolute inset-0 bg-[#4A0052]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-30">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="font-shrikhand text-2xl text-white mb-1">
              Fase Concluída!
            </h3>
            <p className="text-xs text-pink-200 mb-2">
              Você acolheu os idosos e alcançou o ponto seguro!
            </p>
            {timeBonus > 0 && (
              <span className="text-sm font-bold text-amber-300 mb-2">
                Bônus de tempo: +{timeBonus} pts
              </span>
            )}
            <span className="text-xs text-pink-300 animate-pulse">
              Aguarde a contagem regressiva para a próxima fase...
            </span>
          </div>
        )}
      </div>

      {/* Mobile Touch Controls - Multi-Touch Enabled, Sized >= 56px, Safe Area Respected */}
      <div className="w-full bg-[#3B0042]/95 border-t border-pink-400/25 p-2 sm:p-3 pb-safe z-30 flex items-center justify-between shrink-0 select-none touch-none">
        {/* Left Directional Cluster */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onTouchStart={(e) => handleTouchStart('ArrowLeft', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowLeft', e)}
            onTouchCancel={(e) => handleTouchEnd('ArrowLeft', e)}
            onMouseDown={(e) => {
              e.preventDefault();
              engineRef.current?.setTouchInput('ArrowLeft', true);
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              engineRef.current?.setTouchInput('ArrowLeft', false);
            }}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border-2 shadow-lg transition active:scale-95 cursor-pointer touch-none select-none ${
              touchState['ArrowLeft']
                ? 'bg-[#FE91FE] text-[#6B0075] border-white'
                : 'bg-[#6B0075] text-white border-pink-400/40'
            }`}
            aria-label="Mover para esquerda"
          >
            <ArrowLeft className="w-8 h-8" />
          </button>

          <button
            type="button"
            onTouchStart={(e) => handleTouchStart('ArrowRight', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowRight', e)}
            onTouchCancel={(e) => handleTouchEnd('ArrowRight', e)}
            onMouseDown={(e) => {
              e.preventDefault();
              engineRef.current?.setTouchInput('ArrowRight', true);
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              engineRef.current?.setTouchInput('ArrowRight', false);
            }}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border-2 shadow-lg transition active:scale-95 cursor-pointer touch-none select-none ${
              touchState['ArrowRight']
                ? 'bg-[#FE91FE] text-[#6B0075] border-white'
                : 'bg-[#6B0075] text-white border-pink-400/40'
            }`}
            aria-label="Mover para direita"
          >
            <ArrowRight className="w-8 h-8" />
          </button>
        </div>

        {/* Right Action & Jump Cluster */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Contextual Action / Shield Button */}
          <button
            type="button"
            onTouchStart={(e) => handleTouchStart('KeyE', e)}
            onTouchEnd={(e) => handleTouchEnd('KeyE', e)}
            onTouchCancel={(e) => handleTouchEnd('KeyE', e)}
            onMouseDown={(e) => {
              e.preventDefault();
              engineRef.current?.setTouchInput('KeyE', true);
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              engineRef.current?.setTouchInput('KeyE', false);
            }}
            className={`min-h-[56px] h-14 sm:h-16 px-3.5 sm:px-4 rounded-2xl flex items-center justify-center gap-1.5 border-2 shadow-lg font-bold text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer touch-none select-none ${
              contextualBtn.isContextual
                ? 'bg-amber-400 text-amber-950 border-white animate-pulse'
                : 'bg-[#83078E] text-[#FE91FE] border-pink-400/40'
            }`}
            aria-label={contextualBtn.label}
          >
            <Shield className="w-5 h-5 shrink-0" />
            <span className="truncate max-w-[85px] sm:max-w-none">{contextualBtn.label}</span>
          </button>

          {/* Jump Button */}
          <button
            type="button"
            onTouchStart={(e) => handleTouchStart('ArrowUp', e)}
            onTouchEnd={(e) => handleTouchEnd('ArrowUp', e)}
            onTouchCancel={(e) => handleTouchEnd('ArrowUp', e)}
            onMouseDown={(e) => {
              e.preventDefault();
              engineRef.current?.setTouchInput('ArrowUp', true);
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              engineRef.current?.setTouchInput('ArrowUp', false);
            }}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center border-2 shadow-lg font-bold transition active:scale-95 cursor-pointer touch-none select-none ${
              touchState['ArrowUp']
                ? 'bg-[#FE91FE] text-[#6B0075] border-white'
                : 'bg-gradient-to-br from-[#FE91FE] to-[#83078E] text-white border-white/60'
            }`}
            aria-label="Pular"
          >
            <ArrowUp className="w-7 h-7" />
            <span className="text-[9px] uppercase tracking-wider leading-none">Pular</span>
          </button>
        </div>
      </div>
    </div>
  );
};
