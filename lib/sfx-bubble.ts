export type BubbleSfx =
  | 'shoot'
  | 'bounce'
  | 'stick'
  | 'pop'
  | 'drop'
  | 'magic'
  | 'map_clear'
  | 'life_lost'
  | 'victory'
  | 'game_over';

const MASTER_GAIN = 0.4;
const MAGIC_FREQUENCIES = [660, 990, 1320];
const MAP_CLEAR_FREQUENCIES = [523, 659, 784, 1047];
const VICTORY_FREQUENCIES = [523, 659, 784, 1047, 1319, 1568];
const GAME_OVER_FREQUENCIES = [392, 370, 349, 330, 311];

export class BubbleSFX {
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

  private playShoot(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  private playBounce(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 700;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  private playStick(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 220;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  private playPop(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private playDrop(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const buffer = this.createNoiseBuffer();
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, t);
      noiseGain.gain.linearRampToValueAtTime(0, t + 0.15);
      source.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      source.start(t);
      source.stop(t + 0.15);
    }

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.22);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  private playMagic(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    MAGIC_FREQUENCIES.forEach((frequency, i) => {
      const t = baseTime + i * 0.07;
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency;

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  private playMapClear(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    MAP_CLEAR_FREQUENCIES.forEach((frequency, i) => {
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

  private playLifeLost(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  private playVictory(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    VICTORY_FREQUENCIES.forEach((frequency, i) => {
      const t = baseTime + i * 0.12;
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = frequency;

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.14);
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

  play(name: BubbleSfx): void {
    if (!this.ctx) return;
    switch (name) {
      case 'shoot':
        this.playShoot();
        break;
      case 'bounce':
        this.playBounce();
        break;
      case 'stick':
        this.playStick();
        break;
      case 'pop':
        this.playPop();
        break;
      case 'drop':
        this.playDrop();
        break;
      case 'magic':
        this.playMagic();
        break;
      case 'map_clear':
        this.playMapClear();
        break;
      case 'life_lost':
        this.playLifeLost();
        break;
      case 'victory':
        this.playVictory();
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

export const sfxBubble = new BubbleSFX();
