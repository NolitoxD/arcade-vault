// The SFX of stage C, step 8. Unlike the five synthesised sfx modules of this repo
// (sfx-vault-fighter and friends), Vault World Cup's sounds are FILES: Paco recorded
// them and the spec assigns each one to a trigger (§Etapa D, audio table). The
// contract is the same as VaultFighterSFX all the same -- lazy init on the first
// keypress, every method a no-op before it, dispose() in the effect cleanup -- so the
// component wires it exactly like the other thirteen games.
//
// NOT here, on purpose:
//   · the two music tracks (theme-game-play / theme-pre-game-lobby) -- step 10, they
//     go through app/context/MusicContext's setTrackOverride, not through this class;
//   · the crossbar (vault-futbol-crossbar.mp3) -- reserved with NO consumer until v1.5:
//     the engine has no posts as a collision, only the line between them;
//   · the sliding tackle -- S-SC10: it has no file at all, and the v1 leaves it
//     SILENT rather than inventing a synthesised one. Pending Paco.
export type VaultWorldCupSfx =
  | 'whistle_start'
  | 'whistle_end'
  | 'whistle_foul'
  | 'goal_net'
  | 'goal_shout'
  | 'goal_crowd'
  | 'kick'
  | 'crowd'
  | 'chants_victory';

// Every name is a plain ASCII kebab-case slug (renamed 2026-09-07, no accents or
// commas left to encode), but they still go through encodeURI below: a cheap, always
// no-op guard is simpler than a rule that says "these files never need it".
const RAW_FILES: Readonly<Record<VaultWorldCupSfx, string>> = {
  whistle_start: '/vault-futbol-whistle-start.mp3',
  whistle_end: '/vault-futbol-whistle-end.mp3',
  whistle_foul: '/vault-futbol-whistle-foul.mp3',
  goal_net: '/vault-futbol-goal-net.mp3',
  goal_shout: '/vault-futbol-goal-shout.mp3',
  goal_crowd: '/vault-futbol-goal-crowd.mp3',
  kick: '/vault-futbol-kick.mp3',
  crowd: '/vault-futbol-crowd-ambience.mp3',
  chants_victory: '/vault-futbol-chants-victory.mp3',
};

function encodeAll(files: Readonly<Record<VaultWorldCupSfx, string>>): Record<VaultWorldCupSfx, string> {
  const out = {} as Record<VaultWorldCupSfx, string>;
  for (const key of Object.keys(files) as VaultWorldCupSfx[]) out[key] = encodeURI(files[key]);
  return out;
}

export const SFX_FILES: Readonly<Record<VaultWorldCupSfx, string>> = encodeAll(RAW_FILES);

// The kick fires several times a minute and the crowd is a bed, so neither may drown
// the whistles, which are the game telling the player what just happened.
export const SFX_VOLUME: Readonly<Record<VaultWorldCupSfx, number>> = {
  whistle_start: 0.7,
  whistle_end: 0.7,
  whistle_foul: 0.6,
  goal_net: 0.7,
  goal_shout: 0.8,
  goal_crowd: 0.5,
  kick: 0.45,
  crowd: 0.3,
  // The chants play under the victory screen for 20-30 s: below the whistles, above
  // the crowd bed. The confetti halves this again through play()'s gain (sfx-map.ts).
  chants_victory: 0.6,
};

export class VaultWorldCupSFX {
  private sources: Partial<Record<VaultWorldCupSfx, HTMLAudioElement>> = {};
  // The last clone started per name. Step 8 threw the clone away (a whistle is over
  // before anyone could want it stopped); the chants are not -- CONTINUAR must cut
  // them (Task 9-6), so the clone is kept. One per name: two chants never overlap.
  private live: Partial<Record<VaultWorldCupSfx, HTMLAudioElement>> = {};
  private ready = false;
  private muted = false;

  // Called from the first keydown (user gesture), never at import: browsers refuse to
  // start audio before one, and the module is imported during SSR where Audio is not
  // defined at all.
  init(): void {
    if (this.ready) return;
    if (typeof Audio === 'undefined') return;
    for (const key of Object.keys(SFX_FILES) as VaultWorldCupSfx[]) {
      const el = new Audio(SFX_FILES[key]);
      el.preload = 'auto';
      el.volume = SFX_VOLUME[key];
      this.sources[key] = el;
    }
    this.ready = true;
  }

  // A clone per shot, the repo's own pattern (PongGame, ArkanoidGame, PacmanGame):
  // two goals in three seconds must not cut each other off. play() is only ever
  // called on an EVENT, never per frame, so the clone is not a per-frame allocation.
  //
  // `gain` multiplies the table volume (spec: the chants "a volumen bajo" under the
  // confetti); the product is clamped so a bad gain can never throw on the volume
  // setter.
  play(name: VaultWorldCupSfx, gain = 1): void {
    if (!this.ready || this.muted) return;
    const source = this.sources[name];
    if (source === undefined) return;
    const shot = source.cloneNode(true) as HTMLAudioElement;
    const volume = SFX_VOLUME[name] * gain;
    shot.volume = volume < 0 ? 0 : volume > 1 ? 1 : volume;
    this.live[name] = shot;
    // A browser that refuses to play (autoplay policy, tab in the background) rejects
    // the promise; swallowing it is the whole error handling this needs.
    void shot.play().catch(() => undefined);
  }

  // Cuts the last clone of `name`. Safe on a name that never played.
  stop(name: VaultWorldCupSfx): void {
    const el = this.live[name];
    if (el === undefined) return;
    el.pause();
    el.currentTime = 0;
    this.live[name] = undefined;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  dispose(): void {
    for (const key of Object.keys(this.live) as VaultWorldCupSfx[]) this.stop(key);
    for (const key of Object.keys(this.sources) as VaultWorldCupSfx[]) {
      const el = this.sources[key];
      if (el === undefined) continue;
      el.pause();
      el.src = '';
    }
    this.sources = {};
    this.live = {};
    this.ready = false;
  }
}

export const sfxVaultWorldCup = new VaultWorldCupSFX();
