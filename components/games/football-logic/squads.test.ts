import { describe, expect, it } from 'vitest';
import { FORMATIONS, TEAMS, TEAM_SIZE, type Formation, type Role } from './teams';
import {
  SQUAD_NAMES, SQUAD_NAME_MAX, SQUAD_ROLES, SQUAD_SIZE,
  checkSquad, checkSquadCoversFormations, checkSquads, isSquadName, squadName, squadNumber, squadRole, squadRoleCount,
} from './squads';

// The three NINE-a-side formations of the v1, written out here and NOT imported (V15-4
// retired them from FORMATIONS). Until V15-4 this table held the eleven-a-side shapes,
// to prove in advance that the squad of eighteen could field them; now that FORMATIONS
// IS that table, the test is turned around and keeps the property it always really
// asserted -- the squad of eighteen fields ANY formation table, yesterday's and today's
// -- which is also the proof that squads.ts did not have to be reopened for G15-16.
const PREVIOUS_FORMATIONS: readonly Formation[] = [
  {
    id: '3-3-2', name: 'NORMAL', slots: [
      { role: 'def', x: 0.22, y: 0.25 }, { role: 'def', x: 0.22, y: 0.5 }, { role: 'def', x: 0.22, y: 0.75 },
      { role: 'mid', x: 0.45, y: 0.25 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.75 },
      { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
    ],
  },
  {
    id: '3-2-3', name: 'OFENSIVA', slots: [
      { role: 'def', x: 0.22, y: 0.25 }, { role: 'def', x: 0.22, y: 0.5 }, { role: 'def', x: 0.22, y: 0.75 },
      { role: 'mid', x: 0.45, y: 0.35 }, { role: 'mid', x: 0.45, y: 0.65 },
      { role: 'fwd', x: 0.7, y: 0.2 }, { role: 'fwd', x: 0.7, y: 0.5 }, { role: 'fwd', x: 0.7, y: 0.8 },
    ],
  },
  {
    id: '4-3-1', name: 'DEFENSIVA', slots: [
      { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
      { role: 'mid', x: 0.42, y: 0.25 }, { role: 'mid', x: 0.42, y: 0.5 }, { role: 'mid', x: 0.42, y: 0.75 },
      { role: 'fwd', x: 0.68, y: 0.5 },
    ],
  },
];

describe('the twenty squads of eighteen (G15-17 + Paco 23-sep)', () => {
  it('checkSquads accepts the real data: one squad of eighteen per selection of the bank', () => {
    expect(checkSquads(TEAMS)).toEqual([]);
    expect(Object.keys(SQUAD_NAMES)).toHaveLength(TEAMS.length);
    for (const t of TEAMS) expect(SQUAD_NAMES[t.id]).toHaveLength(SQUAD_SIZE);
    expect(SQUAD_SIZE).toBe(18);
  });

  it('shirt numbers are the index plus one, 1 to 18, and numbers 1 and 2 are the goalkeepers (G15-17)', () => {
    expect(squadNumber(0)).toBe(1);
    expect(squadNumber(SQUAD_SIZE - 1)).toBe(18);
    expect(squadRole(0)).toBe('gk');
    expect(squadRole(1)).toBe('gk');
    for (let i = 2; i < SQUAD_SIZE; i++) expect(squadRole(i)).not.toBe('gk');
    expect(SQUAD_ROLES).toHaveLength(SQUAD_SIZE);
  });

  it('the composition is 2 keepers + 6 defenders + 6 midfielders + 4 forwards, in that order', () => {
    expect(squadRoleCount('gk')).toBe(2);
    expect(squadRoleCount('def')).toBe(6);
    expect(squadRoleCount('mid')).toBe(6);
    expect(squadRoleCount('fwd')).toBe(4);
    const roles: readonly Role[] = SQUAD_ROLES;
    expect(roles.indexOf('def')).toBe(2);
    expect(roles.indexOf('mid')).toBe(8);
    expect(roles.indexOf('fwd')).toBe(14);
  });

  it('every name is upper case, one word, at most twelve characters, and all 360 are distinct', () => {
    const seen = new Set<string>();
    let total = 0;
    for (const t of TEAMS) {
      const names = SQUAD_NAMES[t.id];
      for (const n of names) {
        expect(isSquadName(n)).toBe(true);
        expect(n).toBe(n.toUpperCase());
        expect([...n].length).toBeLessThanOrEqual(SQUAD_NAME_MAX);
        expect(seen.has(n)).toBe(false);
        seen.add(n);
        total++;
      }
    }
    expect(total).toBe(360);
    expect(seen.size).toBe(360);
  });

  it('the squad can field EVERY formation of today with a reserve to spare in every line', () => {
    expect(checkSquadCoversFormations(FORMATIONS)).toEqual([]);
    // Bench size is derived, never written down as a literal -- seven reserves with
    // eleven starters, since G15-16 raised TEAM_SIZE.
    expect(SQUAD_SIZE - TEAM_SIZE).toBe(7);
    expect(SQUAD_SIZE).toBeGreaterThan(TEAM_SIZE);
  });

  it('and EVERY nine-a-side formation of the v1, so the squad of eighteen is not tied to one table', () => {
    expect(checkSquadCoversFormations(PREVIOUS_FORMATIONS)).toEqual([]);
    for (const f of PREVIOUS_FORMATIONS) expect(f.slots).toHaveLength(8);
    // The point of eighteen over fourteen (H8), re-read against this table: the 4-3-1
    // needs 4 defenders and the 3-3-2 needs 3 midfielders, and BOTH must still leave
    // someone on the bench for that line. (The tighter bounds of the eleven-a-side
    // table -- 4 midfielders, 5 defenders -- are the ones the test above asserts, on
    // FORMATIONS itself, through checkSquadCoversFormations.)
    expect(squadRoleCount('mid')).toBeGreaterThan(3);
    expect(squadRoleCount('def')).toBeGreaterThan(4);
    expect(squadRoleCount('gk')).toBeGreaterThan(1);   // G15-18: the keeper can be injured
  });

  it('checkSquadCoversFormations rejects a formation the squad cannot fill, and one that would leave a line with no reserve', () => {
    const sevenBacks: Formation = {
      id: '7-2-1', name: 'MURO', slots: [
        { role: 'def', x: 0.18, y: 0.08 }, { role: 'def', x: 0.18, y: 0.21 }, { role: 'def', x: 0.18, y: 0.34 }, { role: 'def', x: 0.18, y: 0.47 },
        { role: 'def', x: 0.18, y: 0.6 }, { role: 'def', x: 0.18, y: 0.73 }, { role: 'def', x: 0.18, y: 0.86 },
        { role: 'mid', x: 0.45, y: 0.35 }, { role: 'mid', x: 0.45, y: 0.65 },
        { role: 'fwd', x: 0.7, y: 0.5 },
      ],
    };
    expect(checkSquadCoversFormations([sevenBacks]).join(' ')).toContain('7-2-1');
    expect(checkSquadCoversFormations([sevenBacks]).join(' ')).toContain('def');
    // Exactly six defenders is NOT enough: the net wants one on the bench too.
    const sixBacks: Formation = {
      id: '6-3-1', name: 'MURO', slots: [
        { role: 'def', x: 0.18, y: 0.1 }, { role: 'def', x: 0.18, y: 0.26 }, { role: 'def', x: 0.18, y: 0.42 },
        { role: 'def', x: 0.18, y: 0.58 }, { role: 'def', x: 0.18, y: 0.74 }, { role: 'def', x: 0.18, y: 0.9 },
        { role: 'mid', x: 0.45, y: 0.3 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.7 },
        { role: 'fwd', x: 0.7, y: 0.5 },
      ],
    };
    expect(checkSquadCoversFormations([sixBacks]).join(' ')).toContain('no def on the bench');
  });

  it('checkSquad and checkSquads name the offender: a missing squad, a short one, a repeat and a lower-case name', () => {
    expect(checkSquad('espana', SQUAD_NAMES.espana)).toEqual([]);
    expect(checkSquad('espana', SQUAD_NAMES.espana.slice(0, 17)).join(' ')).toContain('squad size 17');
    const dup = [...SQUAD_NAMES.italia];
    dup[4] = dup[0];
    expect(checkSquad('italia', dup).join(' ')).toContain('duplicate name');
    const lower = [...SQUAD_NAMES.brasil];
    lower[2] = 'minusculas';
    expect(checkSquad('brasil', lower).join(' ')).toContain('brasil[2]');
    expect(checkSquads([...TEAMS, { id: 'atlantida', name: 'ATLÁNTIDA', kit: { primary: '#123456', secondary: '#abcdef' } }]).join(' '))
      .toContain('no squad for atlantida');
    expect(() => squadName('atlantida', 0)).toThrow();
    expect(squadName('espana', 0)).toBe(SQUAD_NAMES.espana[0]);
  });
});
