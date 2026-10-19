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
  Heart,
  AlertTriangle,
  Copy,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { sound } from '../game/audio';
import { CHARACTER_SKINS } from '../game/types';

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
  onCreateRoom,
  onStartCountdown,
  onTogglePause,
  onToggleLock,
  onEndPhase,
  onKickPlayer,
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

  // Fetch server local IP for mobile LAN access
  useEffect(() => {
    fetch('/api/network-info')
      .then((res) => res.json())
      .then((data) => setNetworkInfo(data))
      .catch(() => {});
  }, []);

  // Compute join URL
  const joinUrl = React.useMemo(() => {
    if (!pin) return '';
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
        <div className="w-20 h-20 rounded-3xl bg-[#FE91FE] text-[#83078E] flex items-center justify-center shadow-2xl mb-6 border-4 border-white">
          <Heart className="w-12 h-12 fill-current animate-pulse" />
        </div>
        <h1 className="font-shrikhand text-4xl text-[#FE91FE] mb-2 tracking-wide">
          VIRLA — Guardiões do Cuidado
        </h1>
        <p className="text-pink-100 text-lg mb-8 leading-relaxed">
          Painel do Apresentador para a Semana de Tecnologia. Crie uma sala ao vivo com PIN de 6
          dígitos, QR Code para até 45 participantes e controle sincronizado estilo Kahoot.
        </p>

        <button
          onClick={onCreateRoom}
          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#FE91FE] to-[#83078E] text-white font-bold text-xl shadow-xl hover:scale-105 transition-all border-2 border-white flex items-center gap-3 cursor-pointer"
        >
          <Play className="w-6 h-6 fill-current" />
          Criar Sala da Partida
        </button>
      </div>
    );
  }

  // --- 1. LOBBY SCREEN (Waiting for participants) ---
  if (roomState === 'LOBBY') {
    return (
      <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
        {/* Top bar with PIN and instructions */}
        <div className="bg-[#6B0075]/80 rounded-3xl p-6 border-2 border-[#FE91FE]/40 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            {qrCodeUrl && (
              <div className="bg-white p-3 rounded-2xl shadow-lg border-2 border-[#FE91FE]">
                <img src={qrCodeUrl} alt="QR Code de Entrada" className="w-36 h-36" />
                <p className="text-[10px] text-gray-700 text-center font-bold mt-1">Escaneie para Entrar</p>
              </div>
            )}
            <div>
              <p className="text-pink-200 text-sm font-semibold tracking-wider uppercase mb-1">
                Acesse no celular ou digite o PIN:
              </p>
              <div className="flex items-center gap-3">
                <span className="font-shrikhand text-5xl sm:text-6xl text-[#FE91FE] tracking-widest drop-shadow">
                  {pin}
                </span>
                <button
                  onClick={copyJoinLink}
                  className="p-2.5 rounded-xl bg-[#83078E] hover:bg-[#83078E]/70 text-white transition border border-[#FE91FE]/40"
                  title="Copiar Link de Entrada"
                >
                  {copiedLink ? <Check className="w-5 h-5 text-green-300" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-pink-200 mt-2 font-mono bg-[#4A0052]/60 px-3 py-1.5 rounded-lg border border-pink-400/20 inline-block">
                {joinUrl}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onToggleLock}
              className={`px-4 py-3 rounded-xl font-bold flex items-center gap-2 border transition ${
                isLocked
                  ? 'bg-red-600 text-white border-red-400'
                  : 'bg-[#83078E] text-pink-100 border-[#FE91FE]/40 hover:bg-[#83078E]/80'
              }`}
            >
              {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              {isLocked ? 'Sala Trancada' : 'Trancar Sala'}
            </button>

            <button
              onClick={() => onStartCountdown('TUTORIAL')}
              className="px-5 py-3 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-[#FE91FE] font-bold border border-[#FE91FE]/60 transition flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              Tutorial (30s)
            </button>

            <button
              onClick={() => onStartCountdown('PHASE_1')}
              disabled={players.length === 0}
              className={`px-6 py-3 rounded-xl font-bold text-lg shadow-xl flex items-center gap-2 transition ${
                players.length === 0
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#FE91FE] to-[#83078E] text-white hover:scale-105 border-2 border-white cursor-pointer'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              Iniciar Fase 1
            </button>
          </div>
        </div>

        {/* Player Roster Section */}
        <div className="flex-1 bg-[#4A0052]/80 rounded-3xl p-6 border border-[#FE91FE]/30 flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-pink-300/20">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-[#FE91FE]" />
              <h2 className="text-xl font-bold text-white">Participantes na Sala</h2>
              <span className="px-3 py-0.5 rounded-full bg-[#83078E] text-[#FE91FE] text-sm font-bold border border-[#FE91FE]/40">
                {players.length} / 45
              </span>
            </div>
            {players.length >= 45 && (
              <span className="text-xs font-bold text-amber-300 bg-amber-950/60 px-3 py-1 rounded-full border border-amber-500">
                Capacidade Máxima Atingida
              </span>
            )}
          </div>

          {players.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-pink-200">
              <div className="w-16 h-16 rounded-full bg-[#6B0075] flex items-center justify-center mb-4 animate-bounce">
                <Users className="w-8 h-8 text-[#FE91FE]" />
              </div>
              <p className="text-lg font-medium">Aguardando participantes entrarem...</p>
              <p className="text-sm opacity-80 mt-1">
                Peça para os alunos apontarem a câmera para o QR Code ou digitarem o PIN <b>{pin}</b>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 overflow-y-auto max-h-[460px] p-2">
              {players.map((p) => {
                const char = CHARACTER_SKINS[p.characterIndex] || CHARACTER_SKINS[0];
                return (
                  <div
                    key={p.id}
                    className="bg-[#6B0075] p-3 rounded-2xl border border-[#FE91FE]/30 flex items-center justify-between shadow group hover:border-[#FE91FE] transition"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-xl">{char.badge}</span>
                      <span className="font-semibold text-white truncate text-sm">{p.nickname}</span>
                    </div>
                    <button
                      onClick={() => onKickPlayer(p.id)}
                      className="opacity-0 group-hover:opacity-100 text-pink-300 hover:text-red-400 p-1 text-xs transition"
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
      </div>
    );
  }

  // --- 2. COUNTDOWN OVERLAY ---
  if (roomState === 'COUNTDOWN') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-3xl text-pink-200 font-bold mb-4 uppercase tracking-widest">
          A partida vai começar em:
        </h2>
        <div className="w-48 h-48 rounded-full bg-gradient-to-tr from-[#83078E] to-[#FE91FE] flex items-center justify-center shadow-2xl border-4 border-white animate-pulse">
          <span className="font-shrikhand text-8xl text-white drop-shadow-lg">
            {countdown > 0 ? countdown : 'CUIDAR!'}
          </span>
        </div>
        <p className="text-pink-100 mt-6 text-xl">Prepare seus reflexos para acolher e conectar!</p>
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
      <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
        {/* Header HUD with Phase, Timer, and Controls */}
        <div className="bg-[#6B0075] p-5 rounded-3xl border-2 border-[#FE91FE]/40 shadow-xl flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs uppercase font-bold tracking-widest text-[#FE91FE] bg-[#4A0052] px-3 py-1 rounded-full border border-pink-400/30">
              {roomState === 'TUTORIAL' ? 'Treinamento' : 'Em Andamento'}
            </span>
            <h1 className="font-shrikhand text-2xl sm:text-3xl text-white mt-1">{phaseTitle}</h1>
          </div>

          {/* Time Remaining Clock */}
          <div className="flex items-center gap-4 bg-[#4A0052] px-6 py-3 rounded-2xl border border-[#FE91FE]/50 shadow-inner">
            <div className="text-center">
              <span className="text-[10px] text-pink-300 uppercase tracking-widest font-bold">Tempo Restante</span>
              <div
                className={`text-4xl font-bold font-mono ${
                  timeRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-[#FE91FE]'
                }`}
              >
                {Math.floor(timeRemaining / 60)}:
                {String(timeRemaining % 60).padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={onTogglePause}
              className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border transition ${
                isPaused
                  ? 'bg-amber-500 text-white border-amber-300 animate-pulse'
                  : 'bg-[#83078E] text-pink-100 border-[#FE91FE]/40 hover:bg-[#83078E]/80'
              }`}
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              {isPaused ? 'Continuar' : 'Pausar'}
            </button>

            <button
              onClick={onEndPhase}
              className="px-4 py-2.5 rounded-xl bg-pink-600/30 hover:bg-pink-600/50 text-[#FE91FE] font-bold border border-[#FE91FE]/50 transition flex items-center gap-2 cursor-pointer"
            >
              <FastForward className="w-5 h-5" />
              Encerrar Fase
            </button>
          </div>
        </div>

        {/* Live Status and Top Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          {/* Status summary */}
          <div className="bg-[#4A0052] rounded-3xl p-6 border border-[#FE91FE]/30 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#FE91FE]" />
                Progresso dos Participantes
              </h2>
              <div className="space-y-4">
                <div className="bg-[#6B0075] p-4 rounded-2xl border border-pink-400/20">
                  <span className="text-xs text-pink-200">Jogadores Conectados</span>
                  <div className="text-3xl font-bold text-white">
                    {players.filter((p) => p.connected).length} / {players.length}
                  </div>
                </div>

                <div className="bg-[#6B0075] p-4 rounded-2xl border border-pink-400/20">
                  <span className="text-xs text-pink-200">Concluíram a Fase</span>
                  <div className="text-3xl font-bold text-emerald-400">
                    {finishedCount} / {players.length}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#6B0075]/60 p-4 rounded-2xl border border-[#FE91FE]/30 text-xs text-pink-100 leading-relaxed mt-6">
              💡 <b>Lembrete VIRLA:</b> O desempate premia primeiro quem acolhe mais idosos com carinho, depois a pontuação e quem precisou de menos recuperações!
            </div>
          </div>

          {/* Live Leaderboard Table */}
          <div className="lg:col-span-2 bg-[#4A0052] rounded-3xl p-6 border border-[#FE91FE]/30 flex flex-col">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Classificação em Tempo Real
            </h2>

            <div className="overflow-y-auto flex-1 max-h-[380px] rounded-2xl border border-pink-300/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#6B0075] text-pink-200 uppercase text-[11px] font-bold sticky top-0">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Guardião</th>
                    <th className="py-3 px-4 text-center">Idosos</th>
                    <th className="py-3 px-4 text-right">Pontos</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pink-300/10">
                  {players.slice(0, 15).map((p, idx) => (
                    <tr key={p.id} className="hover:bg-[#6B0075]/40 transition">
                      <td className="py-3 px-4 font-bold text-pink-300">#{idx + 1}</td>
                      <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                        <span>{CHARACTER_SKINS[p.characterIndex]?.badge || '💜'}</span>
                        <span>{p.nickname}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#FE91FE]">
                        ♥ {p.rescuedCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                        {p.score.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {p.currentFinished ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Concluiu
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-200 border border-pink-500/30">
                            Jogando
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
      <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
        {/* Educational takeaway banner */}
        <div className="bg-gradient-to-r from-[#83078E] to-[#6B0075] p-6 rounded-3xl border-2 border-[#FE91FE] shadow-2xl mb-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FE91FE] text-[#83078E] flex items-center justify-center shrink-0 shadow-lg">
              <Heart className="w-8 h-8 fill-current" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-pink-200">
                Momento de Reflexão VIRLA
              </span>
              <p className="text-xl sm:text-2xl font-bold text-white mt-1 leading-snug">
                {educationalMessage}
              </p>
            </div>
          </div>

          <button
            onClick={() => onStartCountdown(nextPhaseState)}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#FE91FE] to-pink-500 text-white font-bold text-xl shadow-xl hover:scale-105 transition-all border-2 border-white shrink-0 cursor-pointer flex items-center gap-3"
          >
            {isInter3 ? <Trophy className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
            {isInter3 ? 'Ir para o Pódio!' : 'Iniciar Próxima Fase'}
          </button>
        </div>

        {/* Current Standings */}
        <div className="flex-1 bg-[#4A0052] rounded-3xl p-6 border border-[#FE91FE]/30 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              Classificação Acumulada
            </h2>
            <span className="text-xs text-pink-200">
              Total de Idosos Ajudados até agora: <b>{players.reduce((a, b) => a + b.rescuedCount, 0)}</b>
            </span>
          </div>

          <div className="overflow-y-auto flex-1 max-h-[420px] rounded-2xl border border-pink-300/10">
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
      <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
        {/* Banner with Sweet Candy Award Announcement */}
        <div className="bg-gradient-to-r from-[#83078E] via-[#6B0075] to-[#83078E] p-6 rounded-3xl border-3 border-[#FE91FE] shadow-2xl text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-3xl">🍬</span>
            <h1 className="font-shrikhand text-3xl sm:text-5xl text-[#FE91FE] tracking-wide drop-shadow">
              Os três Guardiões do Cuidado ganharam doces!
            </h1>
            <span className="text-3xl">🍭</span>
          </div>
          <p className="text-pink-100 text-base sm:text-lg">
            Reconhecimento pelo cuidado, paciência e dedicação na Semana de Tecnologia!
          </p>

          {isTiedTop3 && (
            <div className="mt-3 bg-amber-500/20 text-amber-300 text-xs px-4 py-2 rounded-xl border border-amber-400 inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Houve empate exato na faixa dos doces! O apresentador pode premiar ambos ou realizar uma rodada relâmpago!
            </div>
          )}
        </div>

        {/* Podium Reveal Step Controller */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {podiumStep < 3 && (
            <button
              onClick={() => {
                sound.playCountdown(true);
                setPodiumStep((prev) => prev + 1);
              }}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-[#FE91FE] text-[#4A0052] font-black text-xl shadow-2xl hover:scale-105 transition-all border-2 border-white cursor-pointer flex items-center gap-3 animate-bounce"
            >
              <Sparkles className="w-6 h-6 fill-current" />
              {podiumStep === 0 && 'Revelar 3º Lugar! 🥉'}
              {podiumStep === 1 && 'Revelar 2º Lugar! 🥈'}
              {podiumStep === 2 && 'Revelar o Grande Campeão! 🥇'}
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="px-5 py-3 rounded-xl bg-[#83078E] hover:bg-[#83078E]/80 text-[#FE91FE] font-bold border border-[#FE91FE]/50 transition flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Baixar Relatório CSV
          </button>

          <button
            onClick={onCreateRoom}
            className="px-5 py-3 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-white font-bold border border-pink-400/30 transition flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Nova Sala
          </button>
        </div>

        {/* Visual 3D-like Step Podium */}
        <div className="flex items-end justify-center gap-4 sm:gap-8 max-w-4xl mx-auto w-full mb-8 min-h-[300px]">
          {/* 2nd Place (Silver) */}
          <div className="flex-1 flex flex-col items-center">
            {podiumStep >= 2 && topPlayers[1] ? (
              <div className="flex flex-col items-center animate-fade-in mb-3">
                <div className="text-4xl mb-1">{CHARACTER_SKINS[topPlayers[1].characterIndex]?.badge || '🌸'}</div>
                <span className="font-bold text-white text-lg truncate max-w-[140px]">
                  {topPlayers[1].nickname}
                </span>
                <span className="text-xs text-pink-200">♥ {topPlayers[1].rescuedCount} idosos</span>
                <span className="text-sm font-mono font-bold text-amber-300">
                  {topPlayers[1].score.toLocaleString('pt-BR')} pts
                </span>
              </div>
            ) : (
              <div className="h-20 flex items-center text-pink-300/40 text-sm font-bold">???</div>
            )}
            <div className="w-full h-44 bg-gradient-to-t from-[#6B0075] to-gray-400 rounded-t-3xl border-t-4 border-l-2 border-r-2 border-gray-200 shadow-2xl flex flex-col items-center justify-center">
              <span className="text-4xl">🥈</span>
              <span className="font-shrikhand text-2xl text-white mt-1">2º Lugar</span>
              <span className="text-xs font-bold text-pink-200">Ganha Doces! 🍬</span>
            </div>
          </div>

          {/* 1st Place (Gold - Tallest) */}
          <div className="flex-1 flex flex-col items-center">
            {podiumStep >= 3 && topPlayers[0] ? (
              <div className="flex flex-col items-center animate-bounce mb-3">
                <div className="text-5xl mb-1">{CHARACTER_SKINS[topPlayers[0].characterIndex]?.badge || '💜'}</div>
                <span className="font-shrikhand text-2xl text-[#FE91FE] truncate max-w-[160px] drop-shadow">
                  {topPlayers[0].nickname}
                </span>
                <span className="text-xs font-bold text-white bg-[#83078E] px-2 py-0.5 rounded-full border border-[#FE91FE]">
                  ♥ {topPlayers[0].rescuedCount} idosos acolhidos
                </span>
                <span className="text-lg font-mono font-black text-yellow-300">
                  {topPlayers[0].score.toLocaleString('pt-BR')} pts
                </span>
              </div>
            ) : (
              <div className="h-24 flex items-center text-pink-300/40 text-sm font-bold">???</div>
            )}
            <div className="w-full h-56 bg-gradient-to-t from-[#83078E] to-amber-400 rounded-t-3xl border-t-4 border-l-2 border-r-2 border-yellow-200 shadow-2xl flex flex-col items-center justify-center">
              <span className="text-5xl">🥇</span>
              <span className="font-shrikhand text-3xl text-white mt-1">1º Lugar</span>
              <span className="text-xs font-bold text-amber-950 bg-yellow-300 px-3 py-0.5 rounded-full mt-1">
                Ganha Doces! 🍭
              </span>
            </div>
          </div>

          {/* 3rd Place (Bronze) */}
          <div className="flex-1 flex flex-col items-center">
            {podiumStep >= 1 && topPlayers[2] ? (
              <div className="flex flex-col items-center animate-fade-in mb-3">
                <div className="text-4xl mb-1">{CHARACTER_SKINS[topPlayers[2].characterIndex]?.badge || '✨'}</div>
                <span className="font-bold text-white text-lg truncate max-w-[140px]">
                  {topPlayers[2].nickname}
                </span>
                <span className="text-xs text-pink-200">♥ {topPlayers[2].rescuedCount} idosos</span>
                <span className="text-sm font-mono font-bold text-amber-300">
                  {topPlayers[2].score.toLocaleString('pt-BR')} pts
                </span>
              </div>
            ) : (
              <div className="h-20 flex items-center text-pink-300/40 text-sm font-bold">???</div>
            )}
            <div className="w-full h-36 bg-gradient-to-t from-[#6B0075] to-amber-700 rounded-t-3xl border-t-4 border-l-2 border-r-2 border-amber-500 shadow-2xl flex flex-col items-center justify-center">
              <span className="text-4xl">🥉</span>
              <span className="font-shrikhand text-2xl text-white mt-1">3º Lugar</span>
              <span className="text-xs font-bold text-pink-200">Ganha Doces! 🍫</span>
            </div>
          </div>
        </div>

        {/* Full Ranking Table */}
        <div className="bg-[#4A0052] rounded-3xl p-6 border border-[#FE91FE]/30 flex flex-col">
          <h2 className="text-lg font-bold text-white mb-4">Classificação Geral Completa</h2>
          <div className="overflow-y-auto max-h-[300px] rounded-2xl border border-pink-300/10">
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
