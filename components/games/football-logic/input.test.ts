import { describe, expect, it } from 'vitest';
import { checkTeamInput, copyTeamInput, createTeamInput, isDown } from './input';

describe('TeamInput', () => {
  it('createTeamInput is the neutral input', () => {
    expect(createTeamInput()).toEqual({ dx: 0, dy: 0, a: 'up', b: 'up', c: 'up', formation: 0, strategy: 'neutral' });
  });
  it('isDown is true for pressed and held only', () => {
    expect(isDown('pressed')).toBe(true);
    expect(isDown('held')).toBe(true);
    expect(isDown('released')).toBe(false);
    expect(isDown('up')).toBe(false);
  });
  it('copyTeamInput copies every field without aliasing', () => {
    const from = createTeamInput();
    from.dx = -1; from.dy = 1; from.a = 'held'; from.b = 'released'; from.c = 'pressed'; from.formation = 2; from.strategy = 'attack';
    const to = createTeamInput();
    copyTeamInput(from, to);
    expect(to).toEqual(from);
    expect(to).not.toBe(from);
  });
  it('checkTeamInput accepts the neutral input and a full one', () => {
    expect(checkTeamInput(createTeamInput(), 3)).toEqual([]);
    const full = createTeamInput();
    full.dx = 1; full.dy = -1; full.a = 'pressed'; full.formation = 2; full.strategy = 'defend';
    expect(checkTeamInput(full, 3)).toEqual([]);
  });
  it('checkTeamInput rejects each invalid field', () => {
    const bad = createTeamInput();
    bad.dx = 2 as never;
    expect(checkTeamInput(bad, 3).join(' ')).toContain('bad dx');
    const bady = createTeamInput();
    bady.dy = 0.5 as never;
    expect(checkTeamInput(bady, 3).join(' ')).toContain('bad dy');
    const badButton = createTeamInput();
    badButton.b = 'down' as never;
    expect(checkTeamInput(badButton, 3).join(' ')).toContain('bad button b');
    const badFormation = createTeamInput();
    badFormation.formation = 3;
    expect(checkTeamInput(badFormation, 3).join(' ')).toContain('formation 3 out of range');
    const badStrategy = createTeamInput();
    badStrategy.strategy = 'yolo' as never;
    expect(checkTeamInput(badStrategy, 3).join(' ')).toContain('bad strategy');
  });
});
