import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SFX_FILES, SFX_VOLUME, VaultWorldCupSFX, type VaultWorldCupSfx } from './sfx-vault-world-cup';

// Compared against the real directory listing, not existsSync: a table with a
// mistyped or stale name should fail loudly here instead of 404ing in production.
const PUBLIC_FILES = new Set(readdirSync(join(process.cwd(), 'public')));

const ALL: VaultWorldCupSfx[] = [
  'whistle_start', 'whistle_end', 'whistle_foul',
  'goal_net', 'goal_shout', 'goal_crowd',
  'kick', 'crowd',
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
