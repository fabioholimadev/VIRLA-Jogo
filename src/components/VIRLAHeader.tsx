import React from 'react';
import { Volume2, VolumeX, Shield, Heart } from 'lucide-react';
import { sound } from '../game/audio';

interface VIRLAHeaderProps {
  isMuted: boolean;
  onToggleMute: () => void;
  mode?: 'host' | 'player';
  onSwitchMode?: (mode: 'host' | 'player') => void;
}

export const VIRLAHeader: React.FC<VIRLAHeaderProps> = ({
  isMuted,
  onToggleMute,
  mode,
  onSwitchMode,
}) => {
  return (
    <header className="w-full bg-[#6B0075]/90 backdrop-blur-md border-b border-[#FE91FE]/30 px-4 py-2 flex items-center justify-between text-white z-50">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FE91FE] to-[#83078E] flex items-center justify-center shadow-lg border border-white/20">
          <Heart className="w-6 h-6 text-white fill-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-shrikhand text-2xl tracking-wide text-[#FE91FE]">VIRLA</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#83078E] border border-[#FE91FE]/40 text-white uppercase tracking-wider">
              Guardiões do Cuidado
            </span>
          </div>
          <p className="text-[10px] text-pink-200 hidden sm:block tracking-widest uppercase">
            Vida • Inclusão • Respeito • Ligação • Amparo
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onSwitchMode && (
          <div className="flex items-center bg-[#4A0052] rounded-lg p-1 border border-[#FE91FE]/30 text-xs">
            <button
              onClick={() => onSwitchMode('player')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                mode === 'player'
                  ? 'bg-[#83078E] text-[#FE91FE] shadow'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Jogador
            </button>
            <button
              onClick={() => onSwitchMode('host')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                mode === 'host'
                  ? 'bg-[#83078E] text-[#FE91FE] shadow'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Apresentador
            </button>
          </div>
        )}

        {/* Audio Mute Toggle */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Ativar Som' : 'Silenciar'}
          className="p-2 rounded-lg bg-[#83078E] hover:bg-[#83078E]/80 border border-[#FE91FE]/40 text-[#FE91FE] transition shadow"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-pink-300" /> : <Volume2 className="w-5 h-5 text-[#FE91FE]" />}
        </button>
      </div>
    </header>
  );
};
