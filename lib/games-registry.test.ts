import { describe, expect, it } from 'vitest';
import { GAMES, GAME_IDS, getGame, getKeyMap, getSkinOptions, isGameId } from './games-registry';

const KEYMAP_SLOTS = ['up', 'down', 'left', 'right', 'a', 'b'];

describe('games registry', () => {
  it('has exactly the 10 implemented games', () => {
    expect(GAME_IDS.sort()).toEqual([
      'arkanoid', 'asteroids', 'frogger', 'karate-champ', 'pacman', 'pong',
      'road-fighter', 'snake', 'space-invaders', 'tetris',
    ]);
    expect(isGameId('pacman')).toBe(true);
    expect(isGameId('galaga')).toBe(false);
    expect(getGame('galaga')).toBeUndefined();
  });
  it('every game has exactly one base skin and non-empty instructions', () => {
    for (const id of GAME_IDS) {
      const g = GAMES[id];
      expect(g.skins.filter((s) => s.tier === 'base')).toHaveLength(1);
      expect(g.instructions.goal.length).toBeGreaterThan(20);
      expect(g.instructions.tips.length).toBeGreaterThan(0);
      expect(g.controls.keyboard.length).toBeGreaterThan(0);
    }
  });
  it('keymaps only use valid slots and touch labels exist for a/b', () => {
    for (const id of GAME_IDS) {
      const { keyMap, a, b } = GAMES[id].controls.touch;
      for (const slot of Object.keys(keyMap)) expect(KEYMAP_SLOTS).toContain(slot);
      if (keyMap.a) expect(a).toBeTruthy();
      if (keyMap.b) expect(b).toBeTruthy();
      expect(getKeyMap(id)).toBe(keyMap);
    }
  });
  it('fixes the dead gamepad buttons', () => {
    expect(GAMES.arkanoid.controls.touch.keyMap.a).toBeUndefined();
    expect(GAMES.asteroids.controls.touch.keyMap.b).toBeUndefined();
    expect(GAMES.tetris.controls.touch.keyMap.b).toBe(' ');
  });
  it('tetris keeps its 4 skins with retro as base; others are classic/retro/neon', () => {
    expect(getSkinOptions('tetris').map((s) => `${s.key}:${s.tier}`)).toEqual([
      'retro:base', 'neon:neon', 'pastel:extra', 'pixel:extra',
    ]);
    expect(getSkinOptions('pacman').map((s) => `${s.key}:${s.tier}`)).toEqual([
      'classic:base', 'retro:retro', 'neon:neon',
    ]);
    expect(getSkinOptions('karate-champ').map((s) => `${s.key}:${s.tier}`)).toEqual([
      'classic:base', 'retro:retro', 'neon:neon',
    ]);
  });
  it('flags the realtime games', () => {
    expect(GAME_IDS.filter((id) => GAMES[id].realtime).sort()).toEqual([
      'karate-champ', 'pacman', 'pong', 'road-fighter', 'space-invaders',
    ]);
  });
  it('karate-champ has the full keyMap and touch labels for both buttons', () => {
    const { keyMap, a, b } = GAMES['karate-champ'].controls.touch;
    expect(keyMap).toEqual({
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      a: 'j',
      b: 'k',
    });
    expect(a).toBe('PATADA');
    expect(b).toBe('PUÑO');
  });
});
