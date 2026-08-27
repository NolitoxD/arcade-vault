import { describe, expect, it } from 'vitest';
import { KongSFX } from './sfx-kong';

describe('KongSFX without AudioContext', () => {
  it('all methods are safe no-ops before init', () => {
    const sfx = new KongSFX();
    expect(() => {
      sfx.play('jump');
      sfx.play('land');
      sfx.play('climb');
      sfx.play('hammer_pickup');
      sfx.play('smash');
      sfx.play('point');
      sfx.play('death');
      sfx.play('level_clear');
      sfx.play('game_over');
      sfx.setMuted(true);
      sfx.dispose();
    }).not.toThrow();
  });
  it('init without AudioContext global does not throw', () => {
    const sfx = new KongSFX();
    expect(() => sfx.init()).not.toThrow();
  });
});
