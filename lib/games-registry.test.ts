import { describe, expect, it } from 'vitest';
import { GAMES, GAME_IDS, getGame, getKeyMap, getSkinOptions, isGameId } from './games-registry';

const KEYMAP_SLOTS = ['up', 'down', 'left', 'right', 'a', 'b', 'c'];

describe('games registry', () => {
  it('has exactly the 13 implemented games', () => {
    expect(GAME_IDS.sort()).toEqual([
      'arkanoid', 'asteroids', 'bubble', 'frogger', 'karate-champ', 'kong', 'pacman',
      'pong', 'road-fighter', 'snake', 'space-invaders', 'tetris', 'vault-fighter',
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
  it('keymaps only use valid slots and touch labels exist for a/b/c', () => {
    for (const id of GAME_IDS) {
      const { keyMap, a, b, c } = GAMES[id].controls.touch;
      for (const slot of Object.keys(keyMap)) expect(KEYMAP_SLOTS).toContain(slot);
      if (keyMap.a) expect(a).toBeTruthy();
      if (keyMap.b) expect(b).toBeTruthy();
      if (keyMap.c) expect(c).toBeTruthy();
      expect(getKeyMap(id)).toBe(keyMap);
    }
  });
  it('only the games that need a third button declare one', () => {
    expect(GAME_IDS.filter((id) => GAMES[id].controls.touch.keyMap.c).sort()).toEqual(['vault-fighter']);
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
    expect(getSkinOptions('kong').map((s) => `${s.key}:${s.tier}`)).toEqual([
      'classic:base', 'retro:retro', 'neon:neon',
    ]);
    expect(getSkinOptions('bubble').map((s) => `${s.key}:${s.tier}`)).toEqual([
      'classic:base', 'retro:retro', 'neon:neon',
    ]);
    expect(getSkinOptions('vault-fighter').map((s) => `${s.key}:${s.tier}`)).toEqual([
      'classic:base', 'retro:retro', 'neon:neon',
    ]);
  });
  it('flags the realtime games', () => {
    expect(GAME_IDS.filter((id) => GAMES[id].realtime).sort()).toEqual([
      'bubble', 'karate-champ', 'kong', 'pacman', 'pong', 'road-fighter',
      'space-invaders', 'vault-fighter',
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
  it('kong has the run/jump keyMap and touch label for a, no b', () => {
    const { keyMap, a, b } = GAMES.kong.controls.touch;
    expect(keyMap).toEqual({
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      a: ' ',
    });
    expect(a).toBe('SALTAR');
    expect(b).toBeUndefined();
  });
  it('bubble has the aim/fire keyMap and touch labels for both buttons', () => {
    const { keyMap, a, b } = GAMES.bubble.controls.touch;
    expect(keyMap).toEqual({
      left: 'ArrowLeft',
      right: 'ArrowRight',
      a: ' ',
      b: 'ArrowDown',
    });
    expect(a).toBe('DISPARAR');
    expect(b).toBe('CAMBIAR');
  });
  it('vault-fighter has the fight keyMap with the magic button', () => {
    const { keyMap, a, b, c } = GAMES['vault-fighter'].controls.touch;
    expect(keyMap).toEqual({
      up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
      a: 'j', b: 'k', c: 'l',
    });
    expect(a).toBe('PATADA');
    expect(b).toBe('PUÑO');
    expect(c).toBe('MAGIA');
  });
});
