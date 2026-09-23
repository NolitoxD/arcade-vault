import { describe, expect, it } from 'vitest';
import { SQUAD_NAMES, SQUAD_NAME_MAX, SQUAD_SIZE, squadNumber, squadRole } from '../football-logic/squads';
import { FORMATIONS, TEAM_SIZE, type Formation } from '../football-logic/teams';
import {
  GK_POSITION, applySwap, canSwap, checkLineup, createLineup, defaultLineup, lineupBackspace, lineupEndEdit,
  lineupName, lineupPositionCount, lineupReserveCount, lineupRoleAt, lineupStorageKey, lineupTypeChar,
  loadLineup, parseLineup, saveLineup, serializeLineup, type Lineup,
} from './lineup';

// A ten-outfield formation: the shape V15-4 brings (G15-16). Written here, not
// imported, so this file is proven size-independent BEFORE V15-4 exists.
const TEN_SLOTS: Formation = {
  id: '4-4-2', name: 'NORMAL', slots: [
    { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
    { role: 'mid', x: 0.45, y: 0.15 }, { role: 'mid', x: 0.45, y: 0.38 }, { role: 'mid', x: 0.45, y: 0.62 }, { role: 'mid', x: 0.45, y: 0.85 },
    { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
  ],
};

function built(f: Formation): Lineup {
  const l = createLineup();
  defaultLineup(f, l);
  return l;
}

describe('the lineup model (G15-17): starters and reserves derived from the formation', () => {
  it('the default lineup fills one position per formation slot plus the goalkeeper, with matching roles', () => {
    for (const f of FORMATIONS) {
      const l = built(f);
      expect(l.starters).toHaveLength(lineupPositionCount(f));
      expect(lineupPositionCount(f)).toBe(f.slots.length + 1);
      expect(l.starters[GK_POSITION]).toBe(0);
      expect(squadRole(l.starters[GK_POSITION])).toBe('gk');
      for (let p = 1; p < l.starters.length; p++) {
        expect(squadRole(l.starters[p])).toBe(lineupRoleAt(f, p));
      }
      expect(new Set(l.starters).size).toBe(l.starters.length);
      expect(checkLineup(f, l)).toEqual([]);
    }
  });

  it('the reserves are exactly the rest of the squad, in ascending order', () => {
    const f = FORMATIONS[0];
    const l = built(f);
    expect(l.reserves).toHaveLength(lineupReserveCount(f));
    expect(lineupReserveCount(f)).toBe(SQUAD_SIZE - lineupPositionCount(f));
    expect(l.reserves).toHaveLength(SQUAD_SIZE - TEAM_SIZE);   // reserves = squad minus TEAM_SIZE, not fixed at nine
    for (const r of l.reserves) expect(l.starters).not.toContain(r);
    const sorted = [...l.reserves].sort((a, b) => a - b);
    expect(l.reserves).toEqual(sorted);
  });

  it('is size-independent: a ten-slot formation (V15-4, G15-16) gives eleven starters and seven reserves, no code change', () => {
    const l = built(TEN_SLOTS);
    expect(lineupPositionCount(TEN_SLOTS)).toBe(11);
    expect(lineupReserveCount(TEN_SLOTS)).toBe(7);
    expect(l.starters).toHaveLength(11);
    expect(l.reserves).toHaveLength(7);
    // G15-17's "reserva DEF/MED/DEL", the reason the squad is eighteen: even at
    // eleven a side there is still someone of every role on the bench.
    for (const role of ['gk', 'def', 'mid', 'fwd'] as const) {
      expect(l.reserves.some((i) => squadRole(i) === role)).toBe(true);
    }
    // fix round 1 (review-7.md #2): every position must actually be filled -- a bare
    // `.toContain('team size')` on checkLineup's output also passes on a BROKEN
    // defaultLineup that leaves a position at -1 (a second, unrelated problem string
    // would still contain the substring). Pinning the exact, single problem list rules
    // that out: the ONLY disagreement, if any, is a team-size mismatch between the
    // formation (eleven here) and whatever TEAM_SIZE the engine plays.
    expect(l.starters).not.toContain(-1);
    const positions = lineupPositionCount(TEN_SLOTS);
    const expectedProblems = positions === TEAM_SIZE ? [] : [`team size ${positions} but the engine plays ${TEAM_SIZE}`];
    expect(checkLineup(TEN_SLOTS, l)).toEqual(expectedProblems);
  });

  it('swaps only a reserve of the SAME role -- the goalkeeper only for the OTHER goalkeeper', () => {
    const f = FORMATIONS[0];
    const l = built(f);
    const defPosition = 1;
    expect(lineupRoleAt(f, defPosition)).toBe('def');
    const spareDef = l.reserves.find((i) => squadRole(i) === 'def');
    const spareFwd = l.reserves.find((i) => squadRole(i) === 'fwd');
    if (spareDef === undefined || spareFwd === undefined) throw new Error('the squad must keep a spare of each');
    expect(canSwap(f, l, defPosition, spareDef)).toBe(true);
    expect(canSwap(f, l, defPosition, spareFwd)).toBe(false);          // wrong role
    expect(canSwap(f, l, defPosition, l.starters[2])).toBe(false);      // already a starter
    // The bench keeper is the ONLY legal swap for position 0 (G15-18 needs him).
    const spareGk = l.reserves.find((i) => squadRole(i) === 'gk');
    if (spareGk === undefined) throw new Error('the squad must keep a spare keeper');
    expect(canSwap(f, l, GK_POSITION, spareGk)).toBe(true);
    for (let i = 0; i < SQUAD_SIZE; i++) {
      if (i === spareGk) continue;
      expect(canSwap(f, l, GK_POSITION, i)).toBe(false);
    }
    // And no outfield position may take a keeper.
    expect(canSwap(f, l, defPosition, spareGk)).toBe(false);
  });

  it('applySwap puts the reserve on the pitch, benches the starter and keeps the lineup legal', () => {
    const f = FORMATIONS[0];
    const l = built(f);
    const position = 1;
    const out = l.starters[position];
    const inc = l.reserves.find((i) => squadRole(i) === 'def');
    if (inc === undefined) throw new Error('no spare defender');
    expect(applySwap(f, l, position, inc)).toBe(true);
    expect(l.starters[position]).toBe(inc);
    expect(l.reserves).toContain(out);
    expect(l.reserves).not.toContain(inc);
    expect(checkLineup(f, l)).toEqual([]);
    expect(applySwap(f, l, position, l.starters[2])).toBe(false);       // refused, nothing moves
    expect(l.starters[position]).toBe(inc);
  });

  it('name editing: upper case, letters only, at most twelve, backspace, and empty falls back to the squad name', () => {
    const l = built(FORMATIONS[0]);
    expect(lineupName(l, 'espana', 0)).toBe(SQUAD_NAMES.espana[0]);
    expect(lineupTypeChar(l, 0, 'r')).toBe(true);
    expect(lineupTypeChar(l, 0, 'i')).toBe(true);
    expect(lineupTypeChar(l, 0, '7')).toBe(false);
    expect(lineupTypeChar(l, 0, ' ')).toBe(false);
    expect(lineupName(l, 'espana', 0)).toBe('RI');
    lineupBackspace(l, 0);
    expect(lineupName(l, 'espana', 0)).toBe('R');
    for (let i = 0; i < 20; i++) lineupTypeChar(l, 0, 'a');
    expect([...lineupName(l, 'espana', 0)].length).toBe(SQUAD_NAME_MAX);
    lineupBackspace(l, 0);
    expect(lineupTypeChar(l, 0, 'z')).toBe(true);
    // Emptying it and closing the editor restores the squad's own name.
    for (let i = 0; i < SQUAD_NAME_MAX; i++) lineupBackspace(l, 0);
    lineupEndEdit(l, 0);
    expect(lineupName(l, 'espana', 0)).toBe(SQUAD_NAMES.espana[0]);
  });

  it('serialize -> parse is a round trip that carries the formation id and the starter count', () => {
    const f = FORMATIONS[1];
    const l = built(f);
    const inc = l.reserves.find((i) => squadRole(i) === 'mid');
    if (inc === undefined) throw new Error('no spare midfielder');
    applySwap(f, l, 4, inc);
    lineupTypeChar(l, 2, 'x');
    const raw = serializeLineup(f, l);
    expect(raw).toContain('"f":"3-2-3"');
    expect(raw).toContain(`"n":${lineupPositionCount(f)}`);
    const back = createLineup();
    parseLineup(raw, f, back);
    expect(back.starters).toEqual(l.starters);
    expect(back.reserves).toEqual(l.reserves);
    expect(lineupName(back, 'espana', 2)).toBe('X');
  });

  it('a stored lineup from another formation or another team size falls back to the default BUT keeps the names', () => {
    const stored = built(FORMATIONS[0]);
    lineupTypeChar(stored, 3, 'q');
    const raw = serializeLineup(FORMATIONS[0], stored);
    const out = createLineup();
    parseLineup(raw, FORMATIONS[2], out);                       // 4-3-1, a different formation
    expect(out.starters).toEqual(built(FORMATIONS[2]).starters);
    expect(lineupName(out, 'espana', 3)).toBe('Q');
    // And the same when only the starter count moved (the V15-4 case).
    const eleven = createLineup();
    parseLineup(raw.replace('"n":9', '"n":11'), FORMATIONS[0], eleven);
    expect(eleven.starters).toEqual(built(FORMATIONS[0]).starters);
  });

  it('garbage, null and a throwing storage all give the default lineup and never throw', () => {
    const f = FORMATIONS[0];
    const expected = built(f).starters;
    for (const raw of [null, '', 'not json', '{}', '{"f":"3-3-2","n":9,"s":[0,0,0,0,0,0,0,0,0],"m":[]}', '{"f":"3-3-2","n":9,"s":[0,1,2,3,4,5,6,7,99],"m":[]}']) {
      const out = createLineup();
      expect(() => parseLineup(raw, f, out)).not.toThrow();
      expect(out.starters).toEqual(expected);
      expect(checkLineup(f, out)).toEqual([]);
    }
    const out = createLineup();
    expect(() => loadLineup(() => { throw new Error('blocked'); }, 'espana', f, out)).not.toThrow();
    expect(out.starters).toEqual(expected);
    expect(() => saveLineup(() => { throw new Error('blocked'); }, 'espana', f, out)).not.toThrow();
  });

  it('the storage key is one per selection, and load/save go through the injected closures only', () => {
    expect(lineupStorageKey('espana')).toBe('av_vwc_lineup_espana');
    expect(lineupStorageKey('corea-del-sur')).not.toBe(lineupStorageKey('espana'));
    const f = FORMATIONS[0];
    const l = built(f);
    const inc = l.reserves.find((i) => squadRole(i) === 'fwd');
    if (inc === undefined) throw new Error('no spare forward');
    applySwap(f, l, l.starters.length - 1, inc);
    const store = new Map<string, string>();
    saveLineup((k, v) => { store.set(k, v); }, 'japon', f, l);
    expect(store.has('av_vwc_lineup_japon')).toBe(true);
    const back = createLineup();
    loadLineup((k) => store.get(k) ?? null, 'japon', f, back);
    expect(back.starters).toEqual(l.starters);
    // A selection that was never saved simply starts on the default.
    const fresh = createLineup();
    loadLineup((k) => store.get(k) ?? null, 'egipto', f, fresh);
    expect(fresh.starters).toEqual(built(f).starters);
    expect(squadNumber(fresh.starters[GK_POSITION])).toBe(1);
  });

  it('a throwing storage on load resets the edited names too, so they cannot leak from one selection to another (fix round 1)', () => {
    const f = FORMATIONS[0];
    const l = built(f);
    lineupTypeChar(l, 3, 'q');
    expect(lineupName(l, 'espana', 3)).toBe('Q');
    // Reusing the SAME Lineup for the next selection, exactly as the screen does
    // (createLineup runs once per human at mount): a private window or blocked site
    // data must not leave ESPAÑA's edited name sitting on JAPÓN's squad.
    expect(() => loadLineup(() => { throw new Error('blocked'); }, 'japon', f, l)).not.toThrow();
    expect(l.names[3]).toBe('');
    expect(lineupName(l, 'japon', 3)).not.toBe('Q');
    expect(l.starters).toEqual(built(f).starters);
  });
});
