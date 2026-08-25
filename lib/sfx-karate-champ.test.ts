import { describe, expect, it } from 'vitest';
import { KarateChampSFX } from './sfx-karate-champ';

describe('KarateChampSFX without AudioContext', () => {
  it('all methods are safe no-ops before init', () => {
    const sfx = new KarateChampSFX();
    expect(() => {
      sfx.play('whoosh');
      sfx.play('hit');
      sfx.play('block');
      sfx.play('half_point');
      sfx.play('full_point');
      sfx.play('gong');
      sfx.play('board_break');
      sfx.play('board_miss');
      sfx.play('game_over');
      sfx.setMuted(true);
      sfx.dispose();
    }).not.toThrow();
  });
  it('init without AudioContext global does not throw', () => {
    const sfx = new KarateChampSFX();
    expect(() => sfx.init()).not.toThrow();
  });
});
