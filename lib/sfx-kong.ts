export type KongSfx =
  | 'jump'
  | 'land'
  | 'climb'
  | 'hammer_pickup'
  | 'smash'
  | 'point'
  | 'death'
  | 'level_clear'
  | 'game_over';

const MASTER_GAIN = 0.4;
const HAMMER_PICKUP_FREQUENCIES = [440, 660];
const LEVEL_CLEAR_FREQUENCIES = [523, 659, 784, 1047];
const GAME_OVER_FREQUENCIES = [392, 370, 349, 330, 311];

export class KongSFX {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  init(): void {
    if (this.ctx) return;
    if (typeof AudioContext === 'undefined') return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = MASTER_GAIN;
    this.masterGain.connect(this.ctx.destination);
  }

  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const buffer = this.ctx.createBuffer(1, 2048, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playJump(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private playLand(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 90;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  private playClimb(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 300;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  private playHammerPickup(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    HAMMER_PICKUP_FREQUENCIES.forEach((frequency, i) => {
      const t = baseTime + i * 0.09;
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = frequency;

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.09);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.09);
    });
  }

  private playSmash(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const buffer = this.createNoiseBuffer();
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.6, t);
      noiseGain.gain.linearRampToValueAtTime(0, t + 0.08);
      source.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      source.start(t);
      source.stop(t + 0.08);
    }

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  private playPoint(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 880;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  private playDeath(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.7);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.7);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  private playLevelClear(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    LEVEL_CLEAR_FREQUENCIES.forEach((frequency, i) => {
      const t = baseTime + i * 0.1;
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = frequency;

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  private playGameOver(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    GAME_OVER_FREQUENCIES.forEach((frequency, i) => {
      const t = baseTime + i * 0.16;
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency;

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  play(name: KongSfx): void {
    if (!this.ctx) return;
    switch (name) {
      case 'jump':
        this.playJump();
        break;
      case 'land':
        this.playLand();
        break;
      case 'climb':
        this.playClimb();
        break;
      case 'hammer_pickup':
        this.playHammerPickup();
        break;
      case 'smash':
        this.playSmash();
        break;
      case 'point':
        this.playPoint();
        break;
      case 'death':
        this.playDeath();
        break;
      case 'level_clear':
        this.playLevelClear();
        break;
      case 'game_over':
        this.playGameOver();
        break;
    }
  }

  setMuted(muted: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.01);
  }

  dispose(): void {
    if (!this.ctx) return;
    this.ctx.close();
    this.ctx = null;
    this.masterGain = null;
  }
}

export const sfxKong = new KongSFX();
