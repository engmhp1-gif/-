/**
 * Audio Alert Service for Procedure 155 Platform
 * Generates crisp, modern, harmonious sound notifications using Web Audio API.
 * Completely self-contained: zero external network assets, zero latency, works offline.
 */

export type ActionSoundType = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'restore' 
  | 'export' 
  | 'auth_success' 
  | 'auth_error' 
  | 'sync' 
  | 'notification';

class SoundService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Load mute preference from localStorage if available
    try {
      const saved = localStorage.getItem('procedure155_sound_muted');
      if (saved !== null) {
        this.isMuted = saved === 'true';
      }
    } catch {
      this.isMuted = false;
    }
  }

  /**
   * Lazy-initialize and resume AudioContext on user interaction
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  public isSoundEnabled(): boolean {
    return !this.isMuted;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.isMuted = !enabled;
    try {
      localStorage.setItem('procedure155_sound_muted', String(!enabled));
    } catch {
      // Ignore storage errors
    }
  }

  public toggleSound(): boolean {
    this.setSoundEnabled(this.isMuted);
    if (!this.isMuted) {
      // Play a confirmation chime when unmuting
      this.playActionSound('notification');
    }
    return !this.isMuted;
  }

  /**
   * Play synthesized harmonic chime based on action type
   */
  public play(type: ActionSoundType = 'notification'): void {
    this.playActionSound(type);
  }

  public playSuccess(): void {
    this.playActionSound('auth_success');
  }

  public playError(): void {
    this.playActionSound('auth_error');
  }

  public playActionSound(type: ActionSoundType = 'notification'): void {
    if (this.isMuted) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      switch (type) {
        case 'create':
          // Ascending 3-note harmonic chime (C5 -> E5 -> G5)
          this.playToneSequence(ctx, now, [
            { freq: 523.25, time: 0, duration: 0.12, gain: 0.18 },
            { freq: 659.25, time: 0.08, duration: 0.14, gain: 0.20 },
            { freq: 783.99, time: 0.16, duration: 0.28, gain: 0.22 }
          ]);
          break;

        case 'update':
          // Crisp, professional dual-tone confirmation (D5 -> A5)
          this.playToneSequence(ctx, now, [
            { freq: 587.33, time: 0, duration: 0.10, gain: 0.18 },
            { freq: 880.00, time: 0.08, duration: 0.22, gain: 0.22 }
          ]);
          break;

        case 'delete':
          // Soft descending warning chime (E5 -> C5 -> A4)
          this.playToneSequence(ctx, now, [
            { freq: 659.25, time: 0, duration: 0.10, gain: 0.18, type: 'triangle' },
            { freq: 523.25, time: 0.08, duration: 0.12, gain: 0.18, type: 'triangle' },
            { freq: 440.00, time: 0.16, duration: 0.24, gain: 0.16, type: 'triangle' }
          ]);
          break;

        case 'restore':
          // Uplifting, rich 4-tone restorative chime (A4 -> C#5 -> E5 -> A5)
          this.playToneSequence(ctx, now, [
            { freq: 440.00, time: 0, duration: 0.10, gain: 0.16 },
            { freq: 554.37, time: 0.07, duration: 0.12, gain: 0.18 },
            { freq: 659.25, time: 0.14, duration: 0.14, gain: 0.20 },
            { freq: 880.00, time: 0.21, duration: 0.35, gain: 0.24 }
          ]);
          break;

        case 'export':
          // Shimmering completion chime for PDF/Excel/PPTX exports
          this.playToneSequence(ctx, now, [
            { freq: 659.25, time: 0, duration: 0.10, gain: 0.16 },
            { freq: 783.99, time: 0.07, duration: 0.12, gain: 0.18 },
            { freq: 1046.50, time: 0.14, duration: 0.30, gain: 0.22 }
          ]);
          break;

        case 'auth_success':
          // Gentle digital unlock tone (G5 -> C6)
          this.playToneSequence(ctx, now, [
            { freq: 783.99, time: 0, duration: 0.08, gain: 0.18 },
            { freq: 1046.50, time: 0.07, duration: 0.22, gain: 0.22 }
          ]);
          break;

        case 'auth_error':
          // Subtle double low buzz indicating incorrect PIN
          this.playToneSequence(ctx, now, [
            { freq: 220.00, time: 0, duration: 0.10, gain: 0.20, type: 'sawtooth' },
            { freq: 180.00, time: 0.12, duration: 0.16, gain: 0.18, type: 'sawtooth' }
          ]);
          break;

        case 'sync':
          // Smooth dual-tone sync pulse
          this.playToneSequence(ctx, now, [
            { freq: 493.88, time: 0, duration: 0.10, gain: 0.16 },
            { freq: 659.25, time: 0.08, duration: 0.20, gain: 0.20 }
          ]);
          break;

        case 'notification':
        default:
          // Default gentle bell chime
          this.playToneSequence(ctx, now, [
            { freq: 659.25, time: 0, duration: 0.09, gain: 0.18 },
            { freq: 880.00, time: 0.08, duration: 0.25, gain: 0.20 }
          ]);
          break;
      }
    } catch (err) {
      console.warn('Audio playback not allowed or supported in current context:', err);
    }
  }

  /**
   * Helper to play a sequence of synthesized oscillator notes with exponential gain decay
   */
  private playToneSequence(
    ctx: AudioContext, 
    startTime: number, 
    notes: Array<{ freq: number; time: number; duration: number; gain: number; type?: OscillatorType }>
  ) {
    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = note.type || 'sine';
      osc.frequency.setValueAtTime(note.freq, startTime + note.time);

      // Smooth attack & exponential decay to prevent clicking/popping
      const noteStart = startTime + note.time;
      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.linearRampToValueAtTime(note.gain, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + note.duration);
    });
  }
}

export const soundService = new SoundService();
