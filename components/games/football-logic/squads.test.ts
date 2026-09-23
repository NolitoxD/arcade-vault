import { describe, expect, it } from 'vitest';
import { FORMATIONS, TEAMS, TEAM_SIZE, type Formation, type Role } from './teams';
import {
  SQUAD_NAMES, SQUAD_NAME_MAX, SQUAD_ROLES, SQUAD_SIZE,
  checkSquad, checkSquadCoversFormations, checkSquads, isSquadName, squadName, squadNumber, squadRole, squadRoleCount,
} from './squads';

// G15-16 / V15-4: the three eleven-a-side formations the spec already fixed. Written
// out here, NOT imported, so this test keeps guarding the squad composition before
// V15-4 exists -- and fails the day someone adds a formation the squad cannot fill.
const V15_4_FORMATIONS: readonly Formation[] = [
  {
    id: '4-4-2', name: 'NORMAL', slots: [
      { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
      { role: 'mid', x: 0.45, y: 0.15 }, { role: 'mid', x: 0.45, y: 0.38 }, { role: 'mid', x: 0.45, y: 0.62 }, { role: 'mid', x: 0.45, y: 0.85 },
      { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
    ],
  },
  {
    id: '4-3-3', name: 'OFENSIVA', slots: [
      { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
      { role: 'mid', x: 0.45, y: 0.25 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.75 },
      { role: 'fwd', x: 0.72, y: 0.2 }, { role: 'fwd', x: 0.72, y: 0.5 }, { role: 'fwd', x: 0.72, y: 0.8 },
    ],
  },
  {
    id: '5-3-2', name: 'DEFENSIVA', slots: [
      { role: 'def', x: 0.18, y: 0.12 }, { role: 'def', x: 0.18, y: 0.31 }, { role: 'def', x: 0.18, y: 0.5 }, { role: 'def', x: 0.18, y: 0.69 }, { role: 'def', x: 0.18, y: 0.88 },
      { role: 'mid', x: 0.44, y: 0.25 }, { role: 'mid', x: 0.44, y: 0.5 }, { role: 'mid', x: 0.44, y: 0.75 },
      { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
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
    // Bench size is derived, never written down as a literal -- nine today, changes
    // once V15-4 raises TEAM_SIZE.
    expect(SQUAD_SIZE - TEAM_SIZE).toBe(9);
    expect(SQUAD_SIZE).toBeGreaterThan(TEAM_SIZE);
  });

  it('and EVERY eleven-a-side formation of V15-4 (G15-16), so V15-4 does not reopen this file', () => {
    expect(checkSquadCoversFormations(V15_4_FORMATIONS)).toEqual([]);
    for (const f of V15_4_FORMATIONS) expect(f.slots).toHaveLength(10);
    // The point of eighteen over fourteen (H8): 4-4-2 needs 4 midfielders and 5-3-2
    // needs 5 defenders, and BOTH must still leave someone on the bench for that line.
    expect(squadRoleCount('mid')).toBeGreaterThan(4);
    expect(squadRoleCount('def')).toBeGreaterThan(5);
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
