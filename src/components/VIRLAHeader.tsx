import React from 'react';
import { Volume2, VolumeX, Shield, Heart, ShieldAlert, Monitor } from 'lucide-react';
import { sound } from '../game/audio';

interface VIRLAHeaderProps {
  isMuted: boolean;
  onToggleMute: () => void;
  mode?: 'host' | 'player';
  onExitHost?: () => void;
  onRequestHostAccess?: () => void;
}

export const VIRLAHeader: React.FC<VIRLAHeaderProps> = ({
  isMuted,
  onToggleMute,
  mode = 'player',
  onExitHost,
  onRequestHostAccess,
}) => {
  return (
    <header className="w-full bg-[#6B0075]/95 backdrop-blur-md border-b border-[#FE91FE]/30 px-3 sm:px-4 py-2 flex items-center justify-between text-white z-50 shrink-0">
      {/* Brand & Logo */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#FE91FE] to-[#83078E] flex items-center justify-center shadow-lg border border-white/20 shrink-0">
          <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-white animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-shrikhand text-xl sm:text-2xl tracking-wide text-[#FE91FE]">VIRLA</span>
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-[#83078E] border border-[#FE91FE]/40 text-white tracking-wider whitespace-nowrap">
              Guardiões do Cuidado
            </span>
          </div>
          <p className="text-[9px] sm:text-[10px] text-pink-200 hidden sm:block tracking-widest uppercase">
            Vida • Inclusão • Respeito • Ligação • Amparo
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* If in Host mode, show clear Presenter Indicator and exit button */}
        {mode === 'host' && (
          <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/60 px-2.5 py-1 rounded-lg">
            <Monitor className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wide">
              Painel do Apresentador
            </span>
            {onExitHost && (
              <button
                onClick={onExitHost}
                className="text-[10px] bg-amber-400 text-amber-950 font-bold px-2 py-0.5 rounded hover:bg-amber-300 transition ml-1"
              >
                Voltar
              </button>
            )}
          </div>
        )}

        {/* Audio Mute Toggle */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Ativar Som' : 'Silenciar'}
          className="p-2 rounded-lg bg-[#83078E] hover:bg-[#83078E]/80 border border-[#FE91FE]/40 text-[#FE91FE] transition shadow flex items-center justify-center shrink-0"
        >
          {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-pink-300" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#FE91FE]" />}
        </button>
      </div>
    </header>
  );
};
