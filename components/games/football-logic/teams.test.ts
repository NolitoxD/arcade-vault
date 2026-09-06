import { describe, expect, it } from 'vitest';
import {
  BANK_SIZE, FORMATIONS, FORMATION_COUNT, OUTFIELD, STRATEGIES, STRATEGY_SHIFT, TEAMS, TEAM_SIZE, slotCounts, teamById,
  type Formation, type Strategy,
} from './teams';
import { checkBank, checkFormation, checkFormations, checkGoalkeepersInBox, checkTeam } from './invariants';
import { PITCH } from './pitch';
import { createPlayers, placeByFormation } from './players';

// The stage-A 3-3-2, byte for byte: every test the final review lists as coupled
// to this geometry (N1 clock traces, takerId 5, KICK_TARGET_ID 7, ...) depends on
// it staying exactly here, at index 0.
const STAGE_A_332: Formation = {
  id: '3-3-2',
  name: 'NORMAL',
  slots: [
    { role: 'def', x: 0.22, y: 0.25 }, { role: 'def', x: 0.22, y: 0.5 }, { role: 'def', x: 0.22, y: 0.75 },
    { role: 'mid', x: 0.45, y: 0.25 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.75 },
    { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
  ],
};

describe('the bank of sixteen selections (spec step 7): the net closes on the real content, first time', () => {
  it('checkBank accepts TEAMS: sixteen, unique ids, unique kits, every one legal', () => {
    expect(checkBank(TEAMS)).toEqual([]);
    expect(TEAMS).toHaveLength(BANK_SIZE);
    expect(BANK_SIZE).toBe(16);
  });
  it('every team individually passes checkTeam (so a failure names the offender)', () => {
    for (const t of TEAMS) expect({ id: t.id, problems: checkTeam(t) }).toEqual({ id: t.id, problems: [] });
  });
  it('names are Spanish, upper case, and the three unmistakable kits of the spec are there', () => {
    for (const t of TEAMS) {
      expect(t.name).toBe(t.name.toUpperCase());
      expect(t.name).not.toMatch(/[a-z]/);
      expect(t.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
    expect(teamById(TEAMS, 'espana')).toMatchObject({ name: 'ESPAÑA', kit: { primary: '#d40000' } });
    expect(teamById(TEAMS, 'italia')).toMatchObject({ name: 'ITALIA', kit: { primary: '#0044aa' } });
    expect(teamById(TEAMS, 'brasil')).toMatchObject({ name: 'BRASIL', kit: { primary: '#ffdf00' } });
    expect(teamById(TEAMS, 'atlantis')).toBeUndefined();
  });
  it('the two stage-A teams keep their index, id, name and kit', () => {
    expect(TEAMS[0]).toEqual({ id: 'espana', name: 'ESPAÑA', kit: { primary: '#d40000', secondary: '#ffcc00' } });
    expect(TEAMS[1]).toEqual({ id: 'italia', name: 'ITALIA', kit: { primary: '#0044aa', secondary: '#ffffff' } });
  });
  it('selections are identical on the pitch in v1: a TeamDef carries only id, name and kit', () => {
    for (const t of TEAMS) expect(Object.keys(t).sort()).toEqual(['id', 'kit', 'name']);
  });
});

describe('the three formations', () => {
  it('checkFormations accepts FORMATIONS: exactly three, unique ids, every one legal', () => {
    expect(checkFormations(FORMATIONS)).toEqual([]);
    expect(FORMATIONS).toHaveLength(FORMATION_COUNT);
    for (const f of FORMATIONS) expect({ id: f.id, problems: checkFormation(f) }).toEqual({ id: f.id, problems: [] });
  });
  it('are the 3-3-2 NORMAL, 3-2-3 OFENSIVA and 4-3-1 DEFENSIVA of the spec, in that order, with matching slot counts', () => {
    expect(FORMATIONS.map((f) => [f.id, f.name, ...slotCounts(f)])).toEqual([
      ['3-3-2', 'NORMAL', 3, 3, 2],
      ['3-2-3', 'OFENSIVA', 3, 2, 3],
      ['4-3-1', 'DEFENSIVA', 4, 3, 1],
    ]);
  });
  it('the 3-3-2 is the stage-A one, byte for byte, at index 0', () => {
    expect(FORMATIONS[0]).toEqual(STAGE_A_332);
  });
  it('every slot of every formation survives both strategy shifts inside the pitch', () => {
    for (const f of FORMATIONS) {
      for (const s of f.slots) {
        expect(s.x + STRATEGY_SHIFT).toBeLessThan(1);
        expect(s.x - STRATEGY_SHIFT).toBeGreaterThan(0);
        expect(s.y).toBeGreaterThan(0);
        expect(s.y).toBeLessThan(1);
      }
    }
  });
  it('team size is nine: eight outfield plus the goalkeeper; strategies shift by ±STRATEGY_SHIFT', () => {
    expect(TEAM_SIZE).toBe(OUTFIELD + 1);
    expect(OUTFIELD).toBe(8);
    expect(STRATEGIES.attack).toBe(STRATEGY_SHIFT);
    expect(STRATEGIES.defend).toBe(-STRATEGY_SHIFT);
    expect(STRATEGIES.neutral).toBe(0);
  });
});

describe('every formation × formation × strategy × strategy × end combination places a legal team', () => {
  const STRATS: readonly Strategy[] = ['attack', 'neutral', 'defend'];
  it('outfield players inside the pitch, no two teammates on the same point, keepers in their box (81 placements × 2 ends)', () => {
    let placements = 0;
    for (const f0 of FORMATIONS) {
      for (const f1 of FORMATIONS) {
        const players = createPlayers([f0, f1], PITCH);
        for (const s0 of STRATS) {
          for (const s1 of STRATS) {
            for (const attack of [[1, -1], [-1, 1]] as const) {
              placeByFormation(players, 0, f0, s0, attack[0], PITCH);
              placeByFormation(players, 1, f1, s1, attack[1], PITCH);
              expect(checkGoalkeepersInBox(players, attack, PITCH)).toEqual([]);
              for (const p of players) {
                expect(p.x).toBeGreaterThan(0);
                expect(p.x).toBeLessThan(PITCH.width);
                expect(p.y).toBeGreaterThan(0);
                expect(p.y).toBeLessThan(PITCH.height);
              }
              for (let i = 0; i < players.length; i++) {
                for (let j = i + 1; j < players.length; j++) {
                  if (players[i].team !== players[j].team) continue;
                  expect(players[i].x !== players[j].x || players[i].y !== players[j].y).toBe(true);
                }
              }
              placements++;
            }
          }
        }
      }
    }
    expect(placements).toBe(3 * 3 * 3 * 3 * 2);
  });
});
