/**
 * Procedural Web Audio Engine for VIRLA — Guardiões do Cuidado
 * Generates custom retro melodies and sound effects without external audio asset downloads.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  private currentMusicTrack: string | null = null;
  private musicInterval: any = null;
  private masterGain: GainNode | null = null;

  constructor() {
    const saved = localStorage.getItem('virla_muted');
    if (saved !== null) {
      this.isMuted = saved === 'true';
    }
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('virla_muted', String(this.isMuted));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public setMuted(mute: boolean) {
    this.isMuted = mute;
    localStorage.setItem('virla_muted', String(this.isMuted));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
    }
  }

  // Plays a procedural synth tone
  private playTone(freq: number, type: OscillatorType, duration: number, gainVal = 0.3, detune = 0) {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (detune) osc.detune.setValueAtTime(detune, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio errors safely ignored
    }
  }

  // --- SOUND EFFECTS ---

  public playJump() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch {}
  }

  public playHeart() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;
    // Two high notes arpeggio (B5 -> E6)
    this.playTone(987.77, 'sine', 0.12, 0.25);
    setTimeout(() => this.playTone(1318.51, 'triangle', 0.18, 0.3), 80);
  }

  public playShield() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;
    // Harmonic chime wave
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.25, 0.2), i * 40);
    });
  }

  public playMechanism() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;
    // Dual energetic click & chime
    this.playTone(440, 'triangle', 0.08, 0.3);
    setTimeout(() => this.playTone(880, 'sine', 0.25, 0.35), 70);
  }

  public playRescue() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;
    // Warm uplifting fanfare: C5 -> E5 -> G5 -> C6!
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.35, 0.35);
        this.playTone(freq * 0.5, 'sine', 0.35, 0.2);
      }, idx * 110);
    });
  }

  public playHurt() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;
    // Gentle bump
    this.playTone(160, 'sawtooth', 0.15, 0.25);
    setTimeout(() => this.playTone(110, 'sine', 0.2, 0.2), 60);
  }

  public playCheckpoint() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;
    this.playTone(587.33, 'sine', 0.2, 0.25);
    setTimeout(() => this.playTone(880, 'triangle', 0.35, 0.3), 90);
  }

  public playCountdown(isGo = false) {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;
    if (isGo) {
      this.playTone(880, 'square', 0.3, 0.4);
      setTimeout(() => this.playTone(1760, 'triangle', 0.4, 0.35), 70);
    } else {
      this.playTone(440, 'square', 0.15, 0.3);
    }
  }

  public playVictory() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    fanfare.forEach((n, i) => {
      setTimeout(() => {
        this.playTone(n, 'triangle', 0.4, 0.4);
      }, i * 140);
    });
  }

  // --- BACKGROUND MUSIC ENGINE ---

  public playMusic(track: 'lobby' | 'phase1' | 'phase2' | 'phase3' | 'podium' | 'stop') {
    if (track === 'stop') {
      this.stopMusic();
      return;
    }

    if (this.currentMusicTrack === track) return;
    this.stopMusic();
    this.currentMusicTrack = track;
    this.initCtx();

    let step = 0;
    const stepTime = track === 'phase3' ? 160 : track === 'phase2' ? 180 : 210;

    // Note frequencies
    const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, A4 = 440.00, B4 = 493.88;
    const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880.00;
    const C3 = 130.81, F3 = 174.61, G3 = 196.00, A3 = 220.00;

    let melody: number[] = [];
    let bass: number[] = [];

    if (track === 'lobby') {
      melody = [E5, 0, G5, A5, 0, G5, E5, D5, C5, 0, E5, G5, 0, A5, G5, 0];
      bass = [C3, C3, F3, F3, G3, G3, C3, C3];
    } else if (track === 'phase1') {
      melody = [C5, E5, G5, C5, E5, G5, A5, G5, F5, E5, D5, 0, G4, B4, D5, 0];
      bass = [C3, C3, A3, A3, F3, F3, G3, G3];
    } else if (track === 'phase2') {
      melody = [G4, C5, D5, E5, 0, G5, E5, D5, C5, A4, C5, D5, 0, E5, D5, C5];
      bass = [A3, A3, F3, F3, C3, C3, G3, G3];
    } else if (track === 'phase3') {
      melody = [C5, C5, G5, G5, A5, G5, E5, 0, F5, F5, E5, D5, C5, D5, E5, 0];
      bass = [C3, C3, F3, F3, A3, A3, G3, G3];
    } else if (track === 'podium') {
      melody = [C5, E5, G5, C5, E5, G5, C5, G5, A5, C5, G5, E5, C5, 0, 0, 0];
      bass = [C3, G3, C3, G3, F3, C3, G3, C3];
    }

    this.musicInterval = setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      const mNote = melody[step % melody.length];
      const bNote = bass[Math.floor(step / 2) % bass.length];

      if (mNote > 0) {
        this.playTone(mNote, 'triangle', stepTime / 1000 * 0.9, 0.12);
      }
      if (step % 2 === 0 && bNote > 0) {
        this.playTone(bNote, 'sine', stepTime / 500 * 0.8, 0.18);
      }
      step++;
    }, stepTime);
  }

  public stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.currentMusicTrack = null;
  }
}

export const sound = new SoundEngine();
