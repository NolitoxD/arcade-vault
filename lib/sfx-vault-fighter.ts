export type VaultFighterSfx =
  | 'select'
  | 'whoosh'
  | 'hit'
  | 'miss'
  | 'block'
  | 'ko'
  | 'magic_ready'
  | 'magic_cast'
  | 'round_win'
  | 'round_lose'
  | 'bout_win'
  | 'continue'
  | 'champion'
  | 'game_over';

const MASTER_GAIN = 0.4;
const MAGIC_CAST_FREQUENCIES = [440, 660, 880];
const ROUND_WIN_FREQUENCIES = [523, 659, 784];
const ROUND_LOSE_FREQUENCIES = [349, 293];
const BOUT_WIN_FREQUENCIES = [392, 523, 659, 784];
const CHAMPION_FREQUENCIES = [523, 659, 784, 1047, 1319];
const GAME_OVER_FREQUENCIES = [392, 370, 349, 330, 311];

export class VaultFighterSFX {
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

  private playSelect(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 660;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
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

  // A technique that fell short used to make no sound at all, which is what
  // made a whiffed attack unreadable: a dull low thud, clearly not a 'hit'.
  private playMiss(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
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

  private playKo(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  private playMagicReady(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private playMagicCast(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    MAGIC_CAST_FREQUENCIES.forEach((frequency, i) => {
      const t = baseTime + i * 0.06;
      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = frequency;

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  private playRoundWin(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    ROUND_WIN_FREQUENCIES.forEach((frequency, i) => {
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

  private playRoundLose(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    ROUND_LOSE_FREQUENCIES.forEach((frequency, i) => {
      const t = baseTime + i * 0.14;
      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = frequency;

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  private playBoutWin(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    BOUT_WIN_FREQUENCIES.forEach((frequency, i) => {
      const t = baseTime + i * 0.1;
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

  private playContinue(): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.setValueAtTime(440, t + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private playChampion(): void {
    if (!this.ctx || !this.masterGain) return;
    const baseTime = this.ctx.currentTime;

    CHAMPION_FREQUENCIES.forEach((frequency, i) => {
      const t = baseTime + i * 0.12;
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = frequency;

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.55, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.35);
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

  play(name: VaultFighterSfx): void {
    if (!this.ctx) return;
    switch (name) {
      case 'select':
        this.playSelect();
        break;
      case 'whoosh':
        this.playWhoosh();
        break;
      case 'hit':
        this.playHit();
        break;
      case 'miss':
        this.playMiss();
        break;
      case 'block':
        this.playBlock();
        break;
      case 'ko':
        this.playKo();
        break;
      case 'magic_ready':
        this.playMagicReady();
        break;
      case 'magic_cast':
        this.playMagicCast();
        break;
      case 'round_win':
        this.playRoundWin();
        break;
      case 'round_lose':
        this.playRoundLose();
        break;
      case 'bout_win':
        this.playBoutWin();
        break;
      case 'continue':
        this.playContinue();
        break;
      case 'champion':
        this.playChampion();
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

export const sfxVaultFighter = new VaultFighterSFX();
