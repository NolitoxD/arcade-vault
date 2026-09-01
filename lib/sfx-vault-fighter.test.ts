import { describe, expect, it } from 'vitest';
import { VaultFighterSFX } from './sfx-vault-fighter';

describe('VaultFighterSFX without AudioContext', () => {
  it('all methods are safe no-ops before init', () => {
    const sfx = new VaultFighterSFX();
    expect(() => {
      sfx.play('select');
      sfx.play('whoosh');
      sfx.play('hit');
      sfx.play('miss');
      sfx.play('block');
      sfx.play('ko');
      sfx.play('magic_ready');
      sfx.play('magic_cast');
      sfx.play('round_win');
      sfx.play('round_lose');
      sfx.play('bout_win');
      sfx.play('continue');
      sfx.play('champion');
      sfx.play('game_over');
      sfx.setMuted(true);
      sfx.dispose();
    }).not.toThrow();
  });
  it('init without AudioContext global does not throw', () => {
    const sfx = new VaultFighterSFX();
    expect(() => sfx.init()).not.toThrow();
  });
});
