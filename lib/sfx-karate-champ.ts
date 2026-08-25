export type KarateSfx =
  | 'whoosh'
  | 'hit'
  | 'block'
  | 'half_point'
  | 'full_point'
  | 'gong'
  | 'board_break'
  | 'board_miss'
  | 'game_over';

const MASTER_GAIN = 0.4;
const HALF_POINT_FREQUENCIES = [659, 880];
const FULL_POINT_FREQUENCIES = [523, 659, 784, 1047];
const BOARD_MISS_FREQUENCIES = [440, 293];
const GAME_OVER_FREQUENCIES = [392, 370, 349, 330, 311];

export class KarateChampSFX {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

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

  private playWhoosh(): void {
    if (!this.ctx || !this.masterGain) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;
    const t = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.08);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(t);
    source.stop(t + 0.08);
  }

  private playHit(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);

    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.linearRampToValueAtTime(0, t + 0.03);
    source.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    source.start(t);
    source.stop(t + 0.03);
  }

  private playBlock(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  private playHalfPoint(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    HALF_POINT_FREQUENCIES.forEach((frequency, i) => {
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

  private playFullPoint(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    FULL_POINT_FREQUENCIES.forEach((frequency, i) => {
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

  private playGong(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 110;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 1.2);

    const partial = this.ctx.createOscillator();
    partial.type = 'sine';
    partial.frequency.value = 223;

    const partialGain = this.ctx.createGain();
    partialGain.gain.setValueAtTime(0.2, t);
    partialGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    partial.connect(partialGain);
    partialGain.connect(this.masterGain);
    partial.start(t);
    partial.stop(t + 1.2);
  }

  private playBoardBreak(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const buffer = this.createNoiseBuffer();
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7, t);
      noiseGain.gain.linearRampToValueAtTime(0, t + 0.1);
      source.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      source.start(t);
      source.stop(t + 0.1);
    }

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private playBoardMiss(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    BOARD_MISS_FREQUENCIES.forEach((frequency, i) => {
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

  play(name: KarateSfx): void {
    if (!this.ctx) return;
    switch (name) {
      case 'whoosh':
        this.playWhoosh();
        break;
      case 'hit':
        this.playHit();
        break;
      case 'block':
        this.playBlock();
        break;
      case 'half_point':
        this.playHalfPoint();
        break;
      case 'full_point':
        this.playFullPoint();
        break;
      case 'gong':
        this.playGong();
        break;
      case 'board_break':
        this.playBoardBreak();
        break;
      case 'board_miss':
        this.playBoardMiss();
        break;
      case 'game_over':
        this.playGameOver();
        break;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
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

export const sfxKarateChamp = new KarateChampSFX();
