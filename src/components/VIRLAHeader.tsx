import React, { useState } from 'react';
import { Volume2, VolumeX, Monitor, LogOut, ArrowLeft, AlertCircle } from 'lucide-react';
import { VIRLALogo } from './VIRLALogo';

interface VIRLAHeaderProps {
  isMuted: boolean;
  onToggleMute: () => void;
  mode?: 'host' | 'player';
  onExitHost?: () => void;
  isHostAuthorized?: boolean;
  onOpenHost?: () => void;
  onSignOut?: () => void;
  isAuthenticated?: boolean;
  roomPin?: string | null;
}

export const VIRLAHeader: React.FC<VIRLAHeaderProps> = ({
  isMuted,
  onToggleMute,
  mode = 'player',
  onExitHost,
  isHostAuthorized = false,
  onOpenHost,
  onSignOut,
  isAuthenticated = false,
  roomPin,
}) => {
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  return (
    <>
      <header className="w-full bg-[#6B0075]/95 backdrop-blur-md border-b border-[#FE91FE]/30 px-2 sm:px-4 py-2 flex items-center justify-between text-white z-40 shrink-0 min-h-[52px] select-none">
        {/* Brand & Logo Zone */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <VIRLALogo size="sm" alt="Logo VIRLA" />
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-shrikhand text-xl sm:text-2xl tracking-wide text-[#FE91FE] leading-tight">
                VIRLA
              </span>
              <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-[#83078E] border border-[#FE91FE]/40 text-white tracking-wider whitespace-nowrap hidden min-[360px]:inline-block">
                Guardiões do Cuidado
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-pink-200 hidden md:block tracking-widest uppercase">
              Vida • Inclusão • Respeito • Ligação • Amparo
            </p>
          </div>
        </div>

        {/* Action Controls Zone */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Presenter Mode Active -> Voltar button */}
          {mode === 'host' && onExitHost && (
            <button
              type="button"
              onClick={onExitHost}
              className="min-h-[40px] px-2.5 sm:px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow transition cursor-pointer active:scale-95"
              title="Voltar para a tela inicial / participante (a sala continua rodando em segundo plano)"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Voltar</span>
            </button>
          )}

          {/* Player Mode Active & Authorized Presenter -> Telão / Apresentador button */}
          {mode === 'player' && isHostAuthorized && onOpenHost && (
            <button
              type="button"
              onClick={onOpenHost}
              className="min-h-[40px] flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-105 text-amber-950 font-black px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm shadow-lg transition cursor-pointer active:scale-95 border border-amber-200/60"
              title="Abrir o Painel do Apresentador (Telão)"
            >
              <Monitor className="w-4 h-4 shrink-0" />
              <span className="font-bold">Painel Telão</span>
              {roomPin && (
                <span className="text-[10px] bg-amber-900/30 text-amber-950 font-mono px-1.5 py-0.5 rounded-md hidden min-[400px]:inline">
                  PIN: {roomPin}
                </span>
              )}
            </button>
          )}

          {/* Dedicated Sign Out Button */}
          {isAuthenticated && onSignOut && (
            <button
              type="button"
              onClick={() => setShowSignOutConfirm(true)}
              title="Sair da conta Google"
              className="min-h-[40px] min-w-[40px] px-2 py-1.5 rounded-xl bg-[#83078E]/80 hover:bg-red-900/60 border border-[#FE91FE]/30 text-pink-200 hover:text-white transition flex items-center justify-center gap-1 text-xs font-semibold cursor-pointer active:scale-95"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden min-[480px]:inline">Sair</span>
            </button>
          )}

          {/* Audio Mute Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? 'Ativar Som' : 'Silenciar'}
            className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-[#83078E] hover:bg-[#83078E]/80 border border-[#FE91FE]/40 text-[#FE91FE] transition shadow flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-pink-300" /> : <Volume2 className="w-4 h-4 text-[#FE91FE]" />}
          </button>
        </div>
      </header>

      {/* Confirmation Modal for Sign Out */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#6B0075] border-2 border-pink-400/50 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-300 border border-red-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="font-shrikhand text-2xl text-white">Sair da Conta?</h3>
            <p className="text-xs text-pink-100 leading-relaxed">
              Deseja desconectar sua conta Google? Suas pontuações na sessão serão preservadas.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                className="min-h-[48px] py-2.5 px-4 rounded-xl bg-[#4A0052] border border-pink-400/30 text-pink-200 font-bold text-sm hover:bg-[#4A0052]/80 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSignOutConfirm(false);
                  onSignOut?.();
                }}
                className="min-h-[48px] py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow transition cursor-pointer"
              >
                Sim, Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
