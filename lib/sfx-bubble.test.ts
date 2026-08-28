import { describe, expect, it } from 'vitest';
import { BubbleSFX } from './sfx-bubble';

describe('BubbleSFX without AudioContext', () => {
  it('all methods are safe no-ops before init', () => {
    const sfx = new BubbleSFX();
    expect(() => {
      for (const n of [
        'shoot',
        'bounce',
        'stick',
        'pop',
        'drop',
        'magic',
        'map_clear',
        'life_lost',
        'victory',
        'game_over',
      ] as const) {
        sfx.play(n);
      }
      sfx.setMuted(true);
      sfx.dispose();
    }).not.toThrow();
  });

  it('init without AudioContext global does not throw', () => {
    expect(() => new BubbleSFX().init()).not.toThrow();
  });
});
