import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SFX_FILES, SFX_VOLUME, VaultWorldCupSFX, type VaultWorldCupSfx } from './sfx-vault-world-cup';

// Compared against the real directory listing, not existsSync: a table with a
// mistyped or stale name should fail loudly here instead of 404ing in production.
const PUBLIC_FILES = new Set(readdirSync(join(process.cwd(), 'public')));

const ALL: VaultWorldCupSfx[] = [
  'whistle_start', 'whistle_end', 'whistle_foul',
  'goal_net', 'goal_shout', 'goal_crowd',
  'kick', 'crowd', 'chants_victory',
];

describe('SFX_FILES', () => {
  it('names a real file in public/ for every sound', () => {
    for (const name of ALL) {
      const src = SFX_FILES[name];
      expect(src.startsWith('/')).toBe(true);
      expect(PUBLIC_FILES.has(decodeURI(src).slice(1)), `${name} -> ${src}`).toBe(true);
    }
  });

  it('the three sounds of the goal chain are three different files', () => {
    const chain = new Set([SFX_FILES.goal_net, SFX_FILES.goal_shout, SFX_FILES.goal_crowd]);
    expect(chain.size).toBe(3);
  });

  it('gives every sound a volume in (0, 1]', () => {
    for (const name of ALL) {
      expect(SFX_VOLUME[name]).toBeGreaterThan(0);
      expect(SFX_VOLUME[name]).toBeLessThanOrEqual(1);
    }
  });
});

describe('VaultWorldCupSFX without an Audio global', () => {
  it('all methods are safe no-ops before init', () => {
    const sfx = new VaultWorldCupSFX();
    expect(() => {
      for (const name of ALL) sfx.play(name);
      sfx.setMuted(true);
      sfx.dispose();
    }).not.toThrow();
  });

  it('init without an Audio global does not throw', () => {
    const sfx = new VaultWorldCupSFX();
    expect(() => sfx.init()).not.toThrow();
  });

  it('play after dispose does not throw either', () => {
    const sfx = new VaultWorldCupSFX();
    sfx.init();
    sfx.dispose();
    expect(() => sfx.play('kick')).not.toThrow();
  });
});

// ── Task 9-6: the victory chants (spec audio table, row chants-victory) ──────────
describe('the victory chants', () => {
  it('name the real file, at a volume in (0, 1]', () => {
    expect(SFX_FILES.chants_victory).toBe('/vault-futbol-chants-victory.mp3');
    expect(PUBLIC_FILES.has('vault-futbol-chants-victory.mp3')).toBe(true);
    expect(SFX_VOLUME.chants_victory).toBeGreaterThan(0);
    expect(SFX_VOLUME.chants_victory).toBeLessThanOrEqual(1);
  });

  it('play with a gain and stop are safe no-ops before init, after init without Audio, and after dispose', () => {
    const sfx = new VaultWorldCupSFX();
    expect(() => {
      sfx.play('chants_victory', 0.4);
      sfx.stop('chants_victory');
      sfx.init();
      sfx.play('chants_victory', 1);
      sfx.stop('chants_victory');
      sfx.stop('kick');
      sfx.dispose();
      sfx.play('chants_victory', 0.4);
      sfx.stop('chants_victory');
    }).not.toThrow();
  });
});

// ── Fix round 1, finding 2: play()/stop() exercised against a live Audio clone ────
// Node has no `Audio` global, so every test above hits the early-return branches of
// init()/play()/stop(). This installs a minimal stub for the duration of these tests
// only, restored (deleted) in afterEach, so the rest of the file keeps seeing
// `typeof Audio === 'undefined'` exactly like production SSR.
describe('VaultWorldCupSFX against a stubbed Audio clone', () => {
  // The narrow surface VaultWorldCupSFX actually touches (verified against
  // lib/sfx-vault-world-cup.ts: constructor, preload, volume, cloneNode, play, pause,
  // currentTime, src -- no addEventListener/load, unlike sfx-vault-fighter.ts's
  // AudioContext-based contract, which never touches Audio at all).
  type MinimalAudioElement = {
    src: string;
    volume: number;
    currentTime: number;
    preload: string;
    paused: boolean;
    play: () => Promise<void>;
    pause: () => void;
    cloneNode: (deep?: boolean) => MinimalAudioElement;
  };

  type MinimalAudioCtor = new (src?: string) => MinimalAudioElement;

  class StubAudioElement implements MinimalAudioElement {
    src: string;
    volume = 0;
    currentTime = 0;
    preload = '';
    paused = true;

    constructor(src = '') {
      this.src = src;
    }

    play(): Promise<void> {
      this.paused = false;
      return Promise.resolve();
    }

    pause(): void {
      this.paused = true;
    }

    cloneNode(): MinimalAudioElement {
      const clone = new StubAudioElement(this.src);
      clones.push(clone);
      return clone;
    }
  }

  // Cast through a narrow, named interface (never `any`): globalThis really only needs
  // an optional `Audio` of this minimal shape for this file's purposes.
  function installStubAudio(ctor: MinimalAudioCtor): () => void {
    const patchable = globalThis as unknown as { Audio?: MinimalAudioCtor };
    const previous = patchable.Audio;
    patchable.Audio = ctor;
    return () => {
      if (previous === undefined) delete patchable.Audio;
      else patchable.Audio = previous;
    };
  }

  let clones: MinimalAudioElement[] = [];
  let restoreAudio: () => void;

  beforeEach(() => {
    clones = [];
    restoreAudio = installStubAudio(StubAudioElement);
  });

  afterEach(() => {
    restoreAudio();
  });

  it('play clones the source, applies gain, and clamps the volume to at most 1', () => {
    const sfx = new VaultWorldCupSFX();
    sfx.init();

    sfx.play('chants_victory', 0.4);
    const first = clones.at(-1);
    if (first === undefined) throw new Error('play() did not clone a source');
    expect(first.volume).toBe(SFX_VOLUME.chants_victory * 0.4);
    expect(first.paused).toBe(false);

    sfx.play('chants_victory', 5);
    const second = clones.at(-1);
    if (second === undefined) throw new Error('play() did not clone a source');
    expect(second.volume).toBeLessThanOrEqual(1);
  });

  it('stop pauses and resets the live clone; stopping a name that never played does not throw', () => {
    const sfx = new VaultWorldCupSFX();
    sfx.init();

    sfx.play('chants_victory', 0.4);
    const live = clones.at(-1);
    if (live === undefined) throw new Error('play() did not clone a source');
    live.currentTime = 12;

    sfx.stop('chants_victory');
    expect(live.paused).toBe(true);
    expect(live.currentTime).toBe(0);

    expect(() => sfx.stop('kick')).not.toThrow();
  });

  it('muted play produces no new clone', () => {
    const sfx = new VaultWorldCupSFX();
    sfx.init();
    sfx.setMuted(true);

    const countBefore = clones.length;
    sfx.play('chants_victory', 0.4);
    expect(clones.length).toBe(countBefore);
  });
});

it('the stub above leaves no Audio global behind for the rest of the suite', () => {
  expect(typeof Audio).toBe('undefined');
});
