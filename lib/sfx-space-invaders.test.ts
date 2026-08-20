import { describe, expect, it } from 'vitest';
import { SpaceInvadersSFX } from './sfx-space-invaders';

describe('SpaceInvadersSFX without AudioContext', () => {
  it('all methods are safe no-ops before init', () => {
    const sfx = new SpaceInvadersSFX();
    expect(() => {
      sfx.play('march', 3);
      sfx.play('shoot');
      sfx.stop('ufo');
      sfx.setMuted(true);
      sfx.dispose();
    }).not.toThrow();
  });
  it('init without AudioContext global does not throw', () => {
    const sfx = new SpaceInvadersSFX();
    expect(() => sfx.init()).not.toThrow();
  });
});
