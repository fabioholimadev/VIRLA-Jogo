import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  Users,
  Play,
  Pause,
  Lock,
  Unlock,
  FastForward,
  Trophy,
  Download,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Copy,
  Check,
  ArrowLeft,
  XCircle,
} from 'lucide-react';
import { sound } from '../game/audio';
import { CHARACTER_SKINS } from '../game/types';
import { VIRLALogo } from './VIRLALogo';

interface SanitizedPlayer {
  id: string;
  rank: number;
  nickname: string;
  characterIndex: number;
  connected: boolean;
  score: number;
  rescuedCount: number;
  recoveries: number;
  currentFinished: boolean;
  totalTime: number;
}

interface HostViewProps {
  socket: WebSocket | null;
  pin: string | null;
  hostSecret: string | null;
  onCreateRoom: () => void;
  onStartCountdown: (targetState: string) => void;
  onTogglePause: () => void;
  onToggleLock: () => void;
  onEndPhase: () => void;
  onKickPlayer: (playerId: string) => void;
  onExitHost?: () => void;
  roomState: string;
  timeRemaining: number;
  isPaused: boolean;
  isLocked: boolean;
  players: SanitizedPlayer[];
  countdown: number;
}

export const HostView: React.FC<HostViewProps> = ({
  socket,
  pin,
  hostSecret,
  onCreateRoom,
  onStartCountdown,
  onTogglePause,
  onToggleLock,
  onEndPhase,
  onKickPlayer,
  onExitHost,
  roomState,
  timeRemaining,
  isPaused,
  isLocked,
  players,
  countdown,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [networkInfo, setNetworkInfo] = useState<{ localIp: string; port: number } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [podiumStep, setPodiumStep] = useState<number>(0); // 0: hidden, 1: 3rd, 2: 2nd, 3: 1st, 4: all
  const [showEndRoomConfirm, setShowEndRoomConfirm] = useState(false);

  // Fetch server local IP for mobile LAN access
  useEffect(() => {
    fetch('/api/network-info')
      .then((res) => res.json())
      .then((data) => setNetworkInfo(data))
      .catch(() => {});
  }, []);

  // Compute join URL (uses public origin on web cloud preview or LAN IP on localhost)
  const joinUrl = React.useMemo(() => {
    if (!pin) return '';
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `${window.location.origin}?pin=${pin}`;
    }
    const host = networkInfo?.localIp || window.location.hostname;
    const port = networkInfo?.port || window.location.port || '3000';
    return `http://${host}:${port}?pin=${pin}`;
  }, [pin, networkInfo]);

  // Generate QR code when PIN is available
  useEffect(() => {
    if (joinUrl) {
      QRCode.toDataURL(joinUrl, {
        width: 240,
        margin: 1,
        color: {
          dark: '#6B0075',
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error(err));
    }
  }, [joinUrl]);

  // Play background music according to phase
  useEffect(() => {
    if (roomState === 'LOBBY') sound.playMusic('lobby');
    else if (roomState === 'PHASE_1') sound.playMusic('phase1');
    else if (roomState === 'PHASE_2') sound.playMusic('phase2');
    else if (roomState === 'PHASE_3') sound.playMusic('phase3');
    else if (roomState === 'PODIUM') sound.playMusic('podium');
    else sound.playMusic('lobby');
  }, [roomState]);

  // Trigger confetti when podium reveals first place
  useEffect(() => {
    if (podiumStep >= 3) {
      sound.playVictory();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#83078E', '#FE91FE', '#FFD1FF', '#FACC15', '#FFFFFF'],
      });
    }
  }, [podiumStep]);

  const copyJoinLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleExportCsv = () => {
    if (pin) {
      window.location.href = `/api/room/${pin}/export.csv`;
    }
  };

  const handleConfirmCloseRoom = () => {
    setShowEndRoomConfirm(false);
    sessionStorage.removeItem('virla_host_pin');
    sessionStorage.removeItem('virla_host_secret');
    if (socket && socket.readyState === WebSocket.OPEN && pin) {
      socket.send(JSON.stringify({ type: 'HOST_CLOSE_ROOM', pin }));
    }
    onExitHost?.();
  };

  // Top 3 players for podium
  const topPlayers = players.slice(0, 3);
  const isTiedTop3 =
    topPlayers.length >= 2 &&
    topPlayers[0].rescuedCount === topPlayers[1].rescuedCount &&
    topPlayers[0].score === topPlayers[1].score &&
    topPlayers[0].recoveries === topPlayers[1].recoveries;

  // Render initial room creation screen
  if (!pin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center max-w-2xl mx-auto w-full overflow-y-auto">
        {/* Official VIRLA Logo */}
        <div className="flex justify-center mb-6">
          <VIRLALogo size="xl" />
        </div>

        <h1 className="font-shrikhand text-3xl sm:text-4xl text-[#FE91FE] mb-2 tracking-wide">
          VIRLA — Guardiões do Cuidado
        </h1>
        <p className="text-pink-100 text-sm sm:text-base mb-6 leading-relaxed max-w-lg">
          Painel do Apresentador para a Semana de Tecnologia. Crie uma sala ao vivo com PIN de 6
          dígitos, QR Code para até 45 participantes e controle sincronizado estilo Kahoot.
        </p>

        <div className="w-full max-w-md space-y-3">
          <button
            onClick={onCreateRoom}
            className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#FE91FE] to-[#83078E] text-white font-bold text-lg sm:text-xl shadow-xl hover:scale-102 active:scale-98 transition-all border-2 border-white flex items-center justify-center gap-3 cursor-pointer"
          >
            <Play className="w-6 h-6 fill-current" />
            <span>Criar Sala da Partida</span>
          </button>

          {onExitHost && (
            <button
              onClick={onExitHost}
              className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-[#6B0075]/80 hover:bg-[#6B0075] text-pink-200 border border-pink-400/30 text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Visão do Participante</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- 1. LOBBY SCREEN (Waiting for participants) ---
  if (roomState === 'LOBBY') {
    return (
      <div className="host-view-layout flex-1 flex flex-col p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto w-full overflow-y-auto overflow-x-hidden">
        {/* Top bar with PIN and instructions */}
        <div className="bg-[#6B0075]/90 rounded-3xl p-4 sm:p-6 border-2 border-[#FE91FE]/40 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-5 mb-5">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left w-full lg:w-auto">
            {qrCodeUrl && (
              <div className="bg-white p-2.5 rounded-2xl shadow-lg border-2 border-[#FE91FE] shrink-0">
                <img src={qrCodeUrl} alt="QR Code de Entrada" className="w-28 h-28 sm:w-36 sm:h-36 mx-auto" />
                <p className="text-[10px] text-gray-700 text-center font-bold mt-1">Escaneie no celular</p>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-pink-200 text-xs sm:text-sm font-semibold tracking-wider uppercase mb-1">
                Acesse no celular ou digite o PIN:
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-2.5">
                <span className="font-shrikhand text-4xl sm:text-6xl text-[#FE91FE] tracking-widest drop-shadow">
                  {pin}
                </span>
                <button
                  onClick={copyJoinLink}
                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-[#83078E] hover:bg-[#83078E]/70 text-white transition border border-[#FE91FE]/40 cursor-pointer active:scale-95 flex items-center justify-center"
                  title="Copiar Link de Entrada"
                >
                  {copiedLink ? <Check className="w-5 h-5 text-green-300" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-[11px] sm:text-xs text-pink-200 mt-2 font-mono bg-[#4A0052]/80 px-3 py-1.5 rounded-lg border border-pink-400/20 truncate max-w-xs sm:max-w-md">
                {joinUrl}
              </p>
            </div>
          </div>

          {/* Action buttons - Mobile friendly */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2.5 w-full lg:w-auto">
            <button
              onClick={onToggleLock}
              className={`min-h-[48px] px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 border transition cursor-pointer text-sm ${
                isLocked
                  ? 'bg-red-600 text-white border-red-400'
                  : 'bg-[#83078E] text-pink-100 border-[#FE91FE]/40 hover:bg-[#83078E]/80'
              }`}
            >
              {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span>{isLocked ? 'Sala Trancada' : 'Trancar Sala'}</span>
            </button>

            <button
              onClick={() => onStartCountdown('TUTORIAL')}
              className="min-h-[48px] px-4 py-2.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-[#FE91FE] font-bold border border-[#FE91FE]/60 transition flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Tutorial (30s)</span>
            </button>

            <button
              onClick={() => onStartCountdown('PHASE_1')}
              disabled={players.length === 0}
              className={`min-h-[48px] px-6 py-2.5 rounded-xl font-black text-base shadow-xl flex items-center justify-center gap-2 transition ${
                players.length === 0
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-[#FE91FE] to-[#83078E] text-white hover:scale-102 border-2 border-white cursor-pointer active:scale-95'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Iniciar Fase 1</span>
            </button>
          </div>
        </div>

        {/* Player Roster Section */}
        <div className="flex-1 bg-[#4A0052]/90 rounded-3xl p-4 sm:p-6 border border-[#FE91FE]/30 flex flex-col min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-pink-300/20">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-[#FE91FE]" />
              <h2 className="text-lg sm:text-xl font-bold text-white">Participantes na Sala</h2>
              <span className="px-3 py-0.5 rounded-full bg-[#83078E] text-[#FE91FE] text-xs sm:text-sm font-bold border border-[#FE91FE]/40">
                {players.length} / 45
              </span>
            </div>
            {players.length >= 45 && (
              <span className="text-[10px] sm:text-xs font-bold text-amber-300 bg-amber-950/60 px-3 py-1 rounded-full border border-amber-500">
                Capacidade Máxima Atingida
              </span>
            )}
          </div>

          {players.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-pink-200">
              <div className="w-14 h-14 rounded-full bg-[#6B0075] flex items-center justify-center mb-3 animate-bounce">
                <Users className="w-7 h-7 text-[#FE91FE]" />
              </div>
              <p className="text-base sm:text-lg font-medium">Aguardando participantes entrarem...</p>
              <p className="text-xs sm:text-sm opacity-80 mt-1 max-w-md">
                Peça para os alunos apontarem a câmera para o QR Code ou digitarem o PIN <b>{pin}</b>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 overflow-y-auto max-h-[460px] p-1">
              {players.map((p) => {
                const char = CHARACTER_SKINS[p.characterIndex] || CHARACTER_SKINS[0];
                return (
                  <div
                    key={p.id}
                    className="bg-[#6B0075] p-2.5 sm:p-3 rounded-2xl border border-[#FE91FE]/30 flex items-center justify-between shadow group hover:border-[#FE91FE] transition"
                  >
                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                      <span className="text-lg sm:text-xl shrink-0">{char.badge}</span>
                      <span className="font-semibold text-white truncate text-xs sm:text-sm">{p.nickname}</span>
                    </div>
                    <button
                      onClick={() => onKickPlayer(p.id)}
                      className="text-pink-300 hover:text-red-400 p-1.5 text-xs transition cursor-pointer shrink-0"
                      title="Remover participante"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom subtle bar for Presenter options */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-pink-300 px-2">
          {onExitHost && (
            <button
              onClick={onExitHost}
              className="hover:text-white underline flex items-center gap-1 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ir para a visão do participante (a sala continua rodando)</span>
            </button>
          )}

          <button
            onClick={() => setShowEndRoomConfirm(true)}
            className="text-red-400 hover:text-red-300 flex items-center gap-1 transition cursor-pointer ml-auto"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Encerrar Sala</span>
          </button>
        </div>

        {/* End Room Confirmation Modal */}
        {showEndRoomConfirm && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#6B0075] border-2 border-red-400 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-300 border border-red-400 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="font-shrikhand text-2xl text-white">Encerrar a Sala {pin}?</h3>
              <p className="text-xs text-pink-100 leading-relaxed">
                Esta ação finalizará a partida e desconectará todos os participantes. Se quiser apenas visualizar a tela do jogador, use o botão <b>Voltar</b>.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEndRoomConfirm(false)}
                  className="min-h-[48px] py-2.5 px-4 rounded-xl bg-[#4A0052] border border-pink-400/30 text-pink-200 font-bold text-sm hover:bg-[#4A0052]/80 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCloseRoom}
                  className="min-h-[48px] py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow transition cursor-pointer"
                >
                  Sim, Encerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 2. COUNTDOWN OVERLAY ---
  if (roomState === 'COUNTDOWN') {
    return (
      <div className="host-view-layout flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl sm:text-3xl text-pink-200 font-bold mb-4 uppercase tracking-widest">
          A partida vai começar em:
        </h2>
        <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-full bg-gradient-to-tr from-[#83078E] to-[#FE91FE] flex items-center justify-center shadow-2xl border-4 border-white animate-pulse">
          <span className="font-shrikhand text-6xl sm:text-8xl text-white drop-shadow-lg">
            {countdown > 0 ? countdown : 'CUIDAR!'}
          </span>
        </div>
        <p className="text-pink-100 mt-6 text-base sm:text-xl">Prepare seus reflexos para acolher e conectar!</p>
      </div>
    );
  }

  // --- 3. ACTIVE GAMEPLAY SCREEN (Phase 1, 2, 3 or Tutorial) ---
  const isGameplay = ['TUTORIAL', 'PHASE_1', 'PHASE_2', 'PHASE_3'].includes(roomState);
  if (isGameplay) {
    const finishedCount = players.filter((p) => p.currentFinished).length;
    const phaseTitle =
      roomState === 'TUTORIAL'
        ? 'Tutorial — Escola do Cuidado'
        : roomState === 'PHASE_1'
        ? 'Fase 1 — Casa em Harmonia'
        : roomState === 'PHASE_2'
        ? 'Fase 2 — Caminhos da Comunicação'
        : 'Fase 3 — Praça das Conexões';

    return (
      <div className="host-view-layout flex-1 flex flex-col p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto w-full overflow-y-auto overflow-x-hidden">
        {/* Responsive CSS Grid organizing control cards and live ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 w-full">
          {/* Top HUD Card: Full width (1 col on mobile, 12 cols on desktop) */}
          <div className="lg:col-span-12 bg-[#6B0075] p-3.5 sm:p-5 rounded-3xl border-2 border-[#FE91FE]/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="text-center sm:text-left">
              <span className="text-[10px] sm:text-xs uppercase font-bold tracking-widest text-[#FE91FE] bg-[#4A0052] px-3 py-1 rounded-full border border-pink-400/30">
                {roomState === 'TUTORIAL' ? 'Treinamento' : 'Em Andamento'}
              </span>
              <h1 className="font-shrikhand text-lg sm:text-2xl lg:text-3xl text-white mt-1 leading-tight">{phaseTitle}</h1>
            </div>

            {/* Time Remaining Clock */}
            <div className="flex items-center gap-3 bg-[#4A0052] px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl border border-[#FE91FE]/50 shadow-inner">
              <div className="text-center">
                <span className="text-[9px] sm:text-[10px] text-pink-300 uppercase tracking-widest font-bold block">Tempo Restante</span>
                <div
                  className={`text-2xl sm:text-4xl font-bold font-mono ${
                    timeRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-[#FE91FE]'
                  }`}
                >
                  {Math.floor(timeRemaining / 60)}:
                  {String(timeRemaining % 60).padStart(2, '0')}
                </div>
              </div>
            </div>

            {/* Controls - Separated buttons with min-h 48px to prevent accidental taps */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={onTogglePause}
                className={`flex-1 sm:flex-none min-h-[48px] px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 border transition cursor-pointer text-xs sm:text-sm ${
                  isPaused
                    ? 'bg-amber-500 text-white border-amber-300 animate-pulse'
                    : 'bg-[#83078E] text-pink-100 border-[#FE91FE]/40 hover:bg-[#83078E]/80'
                }`}
              >
                {isPaused ? <Play className="w-4 h-4 sm:w-5 sm:h-5" /> : <Pause className="w-4 h-4 sm:w-5 sm:h-5" />}
                <span>{isPaused ? 'Continuar' : 'Pausar'}</span>
              </button>

              <button
                onClick={onEndPhase}
                className="flex-1 sm:flex-none min-h-[48px] px-4 py-2.5 rounded-xl bg-pink-600/40 hover:bg-pink-600/60 text-[#FE91FE] font-bold border border-[#FE91FE]/60 transition flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
              >
                <FastForward className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Encerrar Fase</span>
              </button>
            </div>
          </div>

          {/* Controls & Progress Card: 1 col on mobile, 4 cols on desktop */}
          <div className="lg:col-span-4 flex flex-col gap-3.5 sm:gap-4">
            <div className="bg-[#4A0052] rounded-3xl p-4 sm:p-5 border border-[#FE91FE]/30 shadow-lg flex flex-col justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#FE91FE]" />
                  <span>Progresso dos Participantes</span>
                </h2>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="bg-[#6B0075] p-3 sm:p-4 rounded-2xl border border-pink-400/20 text-center sm:text-left">
                    <span className="text-[11px] sm:text-xs text-pink-200 block">Conectados</span>
                    <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-1">
                      {players.filter((p) => p.connected).length} / {players.length}
                    </div>
                  </div>

                  <div className="bg-[#6B0075] p-3 sm:p-4 rounded-2xl border border-pink-400/20 text-center sm:text-left">
                    <span className="text-[11px] sm:text-xs text-pink-200 block">Concluíram</span>
                    <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-emerald-400 mt-1">
                      {finishedCount} / {players.length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#6B0075]/70 p-3 sm:p-4 rounded-2xl border border-[#FE91FE]/30 text-xs text-pink-100 leading-relaxed mt-3.5 shadow">
                💡 <b>Lembrete VIRLA:</b> O desempate premia primeiro quem acolhe mais idosos com carinho, depois a pontuação e quem precisou de menos recuperações!
              </div>
            </div>
          </div>

          {/* Live Ranking Card: 1 col on mobile, 8 cols on desktop (No horizontal scroll) */}
          <div className="lg:col-span-8 bg-[#4A0052] rounded-3xl p-4 sm:p-5 border border-[#FE91FE]/30 shadow-lg flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-pink-300/10">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                <span>Classificação em Tempo Real</span>
              </h2>
              <span className="text-xs font-semibold text-pink-300">
                {players.length} participante{players.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Compact Ranking List for Mobile and Desktop - Zero Horizontal Scroll */}
            <div className="space-y-1.5 sm:space-y-2 overflow-y-auto max-h-[460px] pr-1 w-full overflow-x-hidden">
              {players.length === 0 ? (
                <div className="text-center py-8 text-pink-300 text-xs sm:text-sm">
                  Aguardando pontuações dos guardiões...
                </div>
              ) : (
                players.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`p-2.5 sm:p-3 rounded-2xl border transition flex items-center justify-between gap-2 text-xs w-full ${
                      idx < 3
                        ? 'bg-[#6B0075] border-[#FE91FE]/50 shadow-md'
                        : 'bg-[#6B0075]/60 border-pink-400/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
                      <span className={`w-5 sm:w-6 text-center font-bold shrink-0 ${
                        idx === 0
                          ? 'text-amber-300 font-extrabold'
                          : idx === 1
                          ? 'text-gray-200'
                          : idx === 2
                          ? 'text-amber-500'
                          : 'text-pink-300'
                      }`}>
                        #{idx + 1}
                      </span>
                      <span className="text-base sm:text-lg shrink-0">
                        {CHARACTER_SKINS[p.characterIndex]?.badge || '💜'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-white truncate block text-xs sm:text-sm">
                          {p.nickname}
                        </span>
                      </div>
                    </div>

                    {/* Compact Metrics without horizontal scroll */}
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-right">
                      <span className="font-bold text-[#FE91FE] text-xs sm:text-sm whitespace-nowrap">
                        ♥ {p.rescuedCount}
                      </span>
                      <span className="font-mono font-bold text-amber-300 text-xs sm:text-sm whitespace-nowrap">
                        {p.score} <span className="text-[10px] font-normal text-amber-200 hidden min-[380px]:inline">pts</span>
                      </span>
                      {p.currentFinished ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                          Concluiu
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-500/20 text-pink-200 border border-pink-500/30 whitespace-nowrap">
                          Jogando
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 4. INTERMISSION SCREEN (Between Phases) ---
  if (roomState.startsWith('INTERMISSION_')) {
    const isInter3 = roomState === 'INTERMISSION_3';
    const nextPhaseState =
      roomState === 'INTERMISSION_1' ? 'PHASE_2' : roomState === 'INTERMISSION_2' ? 'PHASE_3' : 'PODIUM';

    const educationalMessage =
      roomState === 'INTERMISSION_1'
        ? '“Quando a rotina está organizada, o cuidado ganha continuidade.” Combinados claros evitam ansiedade para toda a família.'
        : roomState === 'INTERMISSION_2'
        ? '“Informação clara conecta quem cuida e quem acompanha.” O diálogo aberto e a confiança trazem tranquilidade no dia a dia.'
        : '“Cuidar é apoiar, ouvir e construir conexões.” A presença humana e o afeto superam o isolamento.';

    return (
      <div className="host-view-layout flex-1 flex flex-col p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto w-full overflow-y-auto overflow-x-hidden">
        {/* Educational takeaway banner with VIRLA Logo */}
        <div className="bg-gradient-to-r from-[#83078E] to-[#6B0075] p-5 sm:p-6 rounded-3xl border-2 border-[#FE91FE] shadow-2xl mb-5 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <VIRLALogo size="md" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-pink-200 block">
                Momento de Reflexão VIRLA
              </span>
              <p className="text-lg sm:text-2xl font-bold text-white mt-1 leading-snug">
                {educationalMessage}
              </p>
            </div>
          </div>

          <button
            onClick={() => onStartCountdown(nextPhaseState)}
            className="w-full md:w-auto min-h-[50px] px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#FE91FE] to-pink-500 text-white font-black text-lg sm:text-xl shadow-xl hover:scale-102 active:scale-98 transition-all border-2 border-white shrink-0 cursor-pointer flex items-center justify-center gap-3"
          >
            {isInter3 ? <Trophy className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
            <span>{isInter3 ? 'Ir para o Pódio!' : 'Iniciar Próxima Fase'}</span>
          </button>
        </div>

        {/* Current Standings */}
        <div className="flex-1 bg-[#4A0052] rounded-3xl p-4 sm:p-6 border border-[#FE91FE]/30 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
              <span>Classificação Acumulada</span>
            </h2>
            <span className="text-xs text-pink-200">
              Total de Idosos Ajudados: <b>{players.reduce((a, b) => a + b.rescuedCount, 0)}</b>
            </span>
          </div>

          {/* Mobile adapted card list */}
          <div className="sm:hidden space-y-2 overflow-y-auto max-h-[380px] pr-1">
            {players.map((p, idx) => (
              <div
                key={p.id}
                className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                  idx < 3 ? 'bg-[#83078E]/60 border-amber-300/40' : 'bg-[#6B0075]/80 border-pink-400/20'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-pink-200">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                  </span>
                  <span className="text-base">{CHARACTER_SKINS[p.characterIndex]?.badge || '💜'}</span>
                  <span className="font-semibold text-white truncate max-w-[120px]">{p.nickname}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-[#FE91FE]">♥ {p.rescuedCount}</span>
                  <span className="font-mono font-bold text-amber-300">{p.score} pts</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-y-auto flex-1 max-h-[420px] rounded-2xl border border-pink-300/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#6B0075] text-pink-200 uppercase text-[11px] font-bold sticky top-0">
                <tr>
                  <th className="py-3 px-4">Posição</th>
                  <th className="py-3 px-4">Guardião</th>
                  <th className="py-3 px-4 text-center">Idosos Ajudados</th>
                  <th className="py-3 px-4 text-center">Recuperações</th>
                  <th className="py-3 px-4 text-right">Pontuação Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-300/10">
                {players.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-[#6B0075]/40 transition ${
                      idx < 3 ? 'bg-pink-900/20 font-bold' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      {idx === 0 ? '🥇 1º' : idx === 1 ? '🥈 2º' : idx === 2 ? '🥉 3º' : `${idx + 1}º`}
                    </td>
                    <td className="py-3 px-4 flex items-center gap-2 text-white">
                      <span>{CHARACTER_SKINS[p.characterIndex]?.badge || '💜'}</span>
                      <span>{p.nickname}</span>
                    </td>
                    <td className="py-3 px-4 text-center text-[#FE91FE] font-bold">♥ {p.rescuedCount}</td>
                    <td className="py-3 px-4 text-center text-pink-300">{p.recoveries}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                      {p.score.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- 5. PODIUM REVEAL SCREEN (The Climax) ---
  if (roomState === 'PODIUM') {
    return (
      <div className="host-view-layout flex-1 flex flex-col p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto w-full overflow-y-auto overflow-x-hidden">
        {/* Banner with Sweet Candy Award Announcement */}
        <div className="bg-gradient-to-r from-[#83078E] via-[#6B0075] to-[#83078E] p-4 sm:p-6 rounded-3xl border-3 border-[#FE91FE] shadow-2xl text-center mb-5">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
            <span className="text-2xl sm:text-3xl">🍬</span>
            <h1 className="font-shrikhand text-2xl sm:text-4xl lg:text-5xl text-[#FE91FE] tracking-wide drop-shadow">
              Os três Guardiões do Cuidado ganharam doces!
            </h1>
            <span className="text-2xl sm:text-3xl">🍭</span>
          </div>
          <p className="text-pink-100 text-sm sm:text-base">
            Reconhecimento pelo cuidado, paciência e dedicação na Semana de Tecnologia!
          </p>

          {isTiedTop3 && (
            <div className="mt-3 bg-amber-500/20 text-amber-300 text-xs px-4 py-2 rounded-xl border border-amber-400 inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Houve empate exato na faixa dos doces! O apresentador pode premiar ambos ou realizar uma rodada relâmpago!</span>
            </div>
          )}
        </div>

        {/* Podium Reveal Step Controller */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          {podiumStep < 3 && (
            <button
              onClick={() => {
                sound.playCountdown(true);
                setPodiumStep((prev) => prev + 1);
              }}
              className="min-h-[48px] px-6 sm:px-8 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-[#FE91FE] text-[#4A0052] font-black text-base sm:text-xl shadow-2xl hover:scale-102 transition-all border-2 border-white cursor-pointer flex items-center gap-2.5 animate-bounce"
            >
              <Sparkles className="w-5 h-5 fill-current" />
              <span>
                {podiumStep === 0 && 'Revelar 3º Lugar! 🥉'}
                {podiumStep === 1 && 'Revelar 2º Lugar! 🥈'}
                {podiumStep === 2 && 'Revelar o Grande Campeão! 🥇'}
              </span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#83078E] hover:bg-[#83078E]/80 text-[#FE91FE] font-bold border border-[#FE91FE]/50 transition flex items-center gap-2 cursor-pointer text-sm"
          >
            <Download className="w-4 h-4" />
            <span>Baixar CSV</span>
          </button>

          <button
            onClick={onCreateRoom}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-white font-bold border border-pink-400/30 transition flex items-center gap-2 cursor-pointer text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Nova Sala</span>
          </button>
        </div>

        {/* Visual 3D Step Podium */}
        <div className="flex items-end justify-center gap-2 sm:gap-6 max-w-4xl mx-auto w-full mb-6 min-h-[260px] sm:min-h-[300px]">
          {/* 2nd Place (Silver) */}
          <div className="flex-1 flex flex-col items-center">
            {podiumStep >= 2 && topPlayers[1] ? (
              <div className="flex flex-col items-center animate-fade-in mb-2 text-center">
                <div className="text-3xl sm:text-4xl mb-0.5">{CHARACTER_SKINS[topPlayers[1].characterIndex]?.badge || '🌸'}</div>
                <span className="font-bold text-white text-xs sm:text-base truncate max-w-[100px] sm:max-w-[140px]">
                  {topPlayers[1].nickname}
                </span>
                <span className="text-[10px] sm:text-xs text-pink-200">♥ {topPlayers[1].rescuedCount} idosos</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-amber-300">
                  {topPlayers[1].score.toLocaleString('pt-BR')} pts
                </span>
              </div>
            ) : (
              <div className="h-16 flex items-center text-pink-300/40 text-xs sm:text-sm font-bold">???</div>
            )}
            <div className="w-full h-36 sm:h-44 bg-gradient-to-t from-[#6B0075] to-gray-400 rounded-t-2xl sm:rounded-t-3xl border-t-4 border-l-2 border-r-2 border-gray-200 shadow-2xl flex flex-col items-center justify-center p-1 text-center">
              <span className="text-2xl sm:text-4xl">🥈</span>
              <span className="font-shrikhand text-base sm:text-2xl text-white mt-0.5">2º Lugar</span>
              <span className="text-[10px] sm:text-xs font-bold text-pink-200">Doces! 🍬</span>
            </div>
          </div>

          {/* 1st Place (Gold - Tallest) */}
          <div className="flex-1 flex flex-col items-center">
            {podiumStep >= 3 && topPlayers[0] ? (
              <div className="flex flex-col items-center animate-bounce mb-2 text-center">
                <div className="text-4xl sm:text-5xl mb-0.5">{CHARACTER_SKINS[topPlayers[0].characterIndex]?.badge || '💜'}</div>
                <span className="font-shrikhand text-sm sm:text-2xl text-[#FE91FE] truncate max-w-[110px] sm:max-w-[160px] drop-shadow">
                  {topPlayers[0].nickname}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-white bg-[#83078E] px-2 py-0.5 rounded-full border border-[#FE91FE]">
                  ♥ {topPlayers[0].rescuedCount} idosos
                </span>
                <span className="text-xs sm:text-lg font-mono font-black text-yellow-300">
                  {topPlayers[0].score.toLocaleString('pt-BR')} pts
                </span>
              </div>
            ) : (
              <div className="h-20 flex items-center text-pink-300/40 text-xs sm:text-sm font-bold">???</div>
            )}
            <div className="w-full h-48 sm:h-56 bg-gradient-to-t from-[#83078E] to-amber-400 rounded-t-2xl sm:rounded-t-3xl border-t-4 border-l-2 border-r-2 border-yellow-200 shadow-2xl flex flex-col items-center justify-center p-1 text-center">
              <span className="text-3xl sm:text-5xl">🥇</span>
              <span className="font-shrikhand text-lg sm:text-3xl text-white mt-0.5">1º Lugar</span>
              <span className="text-[10px] sm:text-xs font-bold text-amber-950 bg-yellow-300 px-2 sm:px-3 py-0.5 rounded-full mt-1">
                Doces! 🍭
              </span>
            </div>
          </div>

          {/* 3rd Place (Bronze) */}
          <div className="flex-1 flex flex-col items-center">
            {podiumStep >= 1 && topPlayers[2] ? (
              <div className="flex flex-col items-center animate-fade-in mb-2 text-center">
                <div className="text-3xl sm:text-4xl mb-0.5">{CHARACTER_SKINS[topPlayers[2].characterIndex]?.badge || '✨'}</div>
                <span className="font-bold text-white text-xs sm:text-base truncate max-w-[100px] sm:max-w-[140px]">
                  {topPlayers[2].nickname}
                </span>
                <span className="text-[10px] sm:text-xs text-pink-200">♥ {topPlayers[2].rescuedCount} idosos</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-amber-300">
                  {topPlayers[2].score.toLocaleString('pt-BR')} pts
                </span>
              </div>
            ) : (
              <div className="h-16 flex items-center text-pink-300/40 text-xs sm:text-sm font-bold">???</div>
            )}
            <div className="w-full h-28 sm:h-36 bg-gradient-to-t from-[#6B0075] to-amber-700 rounded-t-2xl sm:rounded-t-3xl border-t-4 border-l-2 border-r-2 border-amber-500 shadow-2xl flex flex-col items-center justify-center p-1 text-center">
              <span className="text-2xl sm:text-4xl">🥉</span>
              <span className="font-shrikhand text-base sm:text-2xl text-white mt-0.5">3º Lugar</span>
              <span className="text-[10px] sm:text-xs font-bold text-pink-200">Doces! 🍫</span>
            </div>
          </div>
        </div>

        {/* Full Ranking Table (adapted for mobile cards) */}
        <div className="bg-[#4A0052] rounded-3xl p-4 sm:p-6 border border-[#FE91FE]/30 flex flex-col">
          <h2 className="text-base sm:text-lg font-bold text-white mb-3">Classificação Geral Completa</h2>

          <div className="sm:hidden space-y-2 overflow-y-auto max-h-[300px] pr-1">
            {players.map((p, idx) => (
              <div
                key={p.id}
                className="bg-[#6B0075]/70 p-3 rounded-2xl border border-pink-400/20 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-pink-300 w-6">#{idx + 1}</span>
                  <span className="text-base">{CHARACTER_SKINS[p.characterIndex]?.badge || '💜'}</span>
                  <span className="font-semibold text-white truncate max-w-[120px]">{p.nickname}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-[#FE91FE]">♥ {p.rescuedCount}</span>
                  <span className="font-mono font-bold text-amber-300">{p.score} pts</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block overflow-y-auto max-h-[300px] rounded-2xl border border-pink-300/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#6B0075] text-pink-200 uppercase text-[11px] font-bold sticky top-0">
                <tr>
                  <th className="py-3 px-4">Posição</th>
                  <th className="py-3 px-4">Guardião</th>
                  <th className="py-3 px-4 text-center">Idosos Ajudados</th>
                  <th className="py-3 px-4 text-center">Recuperações</th>
                  <th className="py-3 px-4 text-right">Pontuação Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-300/10">
                {players.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-[#6B0075]/40 transition">
                    <td className="py-3 px-4 font-bold text-pink-300">#{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                      <span>{CHARACTER_SKINS[p.characterIndex]?.badge || '💜'}</span>
                      <span>{p.nickname}</span>
                    </td>
                    <td className="py-3 px-4 text-center text-[#FE91FE] font-bold">♥ {p.rescuedCount}</td>
                    <td className="py-3 px-4 text-center text-pink-300">{p.recoveries}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                      {p.score.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
