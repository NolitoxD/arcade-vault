export type SfxName =
  | 'march'
  | 'shoot'
  | 'invader_hit'
  | 'player_hit'
  | 'ufo'
  | 'ufo_hit'
  | 'level_clear'
  | 'game_over';

const MASTER_GAIN = 0.4;
const MARCH_FREQUENCIES = [110, 130, 110, 87];
const LEVEL_CLEAR_FREQUENCIES = [261, 329, 392, 523];
const GAME_OVER_FREQUENCIES = [392, 370, 349, 330, 311];

export class SpaceInvadersSFX {
  private ctx: AudioContext | null = null;
  private ufoNode: OscillatorNode | null = null;
  private ufoLfo: OscillatorNode | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private marchStep = 0;

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

  private playMarch(level: number): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const multiplier = 1 + (level - 1) * 0.05;
    const frequency = MARCH_FREQUENCIES[this.marchStep] * multiplier;
    this.marchStep = (this.marchStep + 1) % MARCH_FREQUENCIES.length;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = frequency;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t);
    gain.gain.setValueAtTime(1, t + 0.05);
    gain.gain.linearRampToValueAtTime(0, t + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  private playShoot(): void {
    if (!this.ctx || !this.masterGain) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;
    const t = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    filter.frequency.value = 1200;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(t);
    source.stop(t + 0.03);
  }

  private playInvaderHit(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private playPlayerHit(): void {
    if (!this.ctx || !this.masterGain) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;
    const t = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, t);
    noiseGain.gain.linearRampToValueAtTime(0, t + 0.6);
    source.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    source.start(t);
    source.stop(t + 0.6);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.6);
    const toneGain = this.ctx.createGain();
    toneGain.gain.setValueAtTime(0.6, t);
    toneGain.gain.linearRampToValueAtTime(0, t + 0.6);
    osc.connect(toneGain);
    toneGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  private playUfo(): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ufoNode) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440;

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 8;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 50;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const gain = this.ctx.createGain();
    gain.gain.value = 0.4;

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    lfo.start(t);

    this.ufoNode = osc;
    this.ufoLfo = lfo;
  }

  private stopUfo(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.ufoNode?.stop(t);
    this.ufoLfo?.stop(t);
    this.ufoNode = null;
    this.ufoLfo = null;
  }

  private playUfoHit(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(200, t + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
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

  play(name: SfxName, level = 1): void {
    if (!this.ctx) return;
    switch (name) {
      case 'march':
        this.playMarch(level);
        break;
      case 'shoot':
        this.playShoot();
        break;
      case 'invader_hit':
        this.playInvaderHit();
        break;
      case 'player_hit':
        this.playPlayerHit();
        break;
      case 'ufo':
        this.playUfo();
        break;
      case 'ufo_hit':
        this.playUfoHit();
        break;
      case 'level_clear':
        this.playLevelClear();
        break;
      case 'game_over':
        this.playGameOver();
        break;
    }
  }

  stop(name: SfxName): void {
    if (!this.ctx) return;
    if (name === 'ufo') {
      this.stopUfo();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.01);
  }

  dispose(): void {
    if (!this.ctx) return;
    this.stopUfo();
    this.ctx.close();
    this.ctx = null;
    this.masterGain = null;
  }
}

export const sfxSpaceInvaders = new SpaceInvadersSFX();
