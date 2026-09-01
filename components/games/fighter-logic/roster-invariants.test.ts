import { describe, expect, it } from 'vitest';
import {
  checkFighter,
  checkReachClearsGap,
  checkRoster,
  checkStages,
  checkStunClearsFastestCycle,
  minScaledReach,
  minTechniqueCycleMs,
  type MagicKindTable,
} from './roster-invariants';
import { ROSTER, ROSTER_SIZE, STAT_BUDGET, type FighterDef } from './fighters';
import { HIT_STUN_MS, MIN_GAP } from './combat';
import { TECHNIQUES } from './techniques';
import type { StageDef } from './stages';

const KINDS: MagicKindTable = {
  destello: 'foe-state', muro: 'self-state', 'salto-de-fase': 'foe-state',
  descarga: 'projectile', corrosion: 'foe-state', onda: 'projectile',
  duplicado: 'area', sismico: 'area', reinicio: 'self-state',
};

function mk(over: Partial<FighterDef> = {}): FighterDef {
  return {
    id: 'nova', name: 'NOVA', strength: 5, speed: 5, reach: 5,
    magic: 'destello', boss: false, build: 1,
    palette: { body: '#e8f4ff', trim: '#00f5ff', accent: '#ffffff' },
    ...over,
  } as FighterDef;
}

// A crafted roster of 8 + boss, all legal, to be mutated in the negative tests.
const IDS = ['nova','torre','glitch','voltio','oxido','eco','pixel','brecha'] as const;
const MAGICS = ['destello','muro','salto-de-fase','descarga','corrosion','onda','duplicado','sismico'] as const;
function legalRoster(): FighterDef[] {
  // stat split summing to 15 that yields 8 distinct difficulty ranks
  const stats: [number, number, number][] = [
    [5,5,5],[9,2,4],[3,9,3],[4,8,3],[7,4,4],[3,3,9],[4,7,4],[8,3,4],
  ];
  const list = IDS.map((id, i) =>
    mk({ id, name: id.toUpperCase(), magic: MAGICS[i],
         strength: stats[i][0], speed: stats[i][1], reach: stats[i][2] }));
  list.push(mk({ id: 'arquitecto', name: 'EL ARQUITECTO', magic: 'reinicio',
                 boss: true, strength: 8, speed: 7, reach: 7 }));
  return list;
}

describe('checkFighter accepts a legal fighter', () => {
  it('reports no problems for a 5/5/5 fighter', () => {
    expect(checkFighter(mk(), KINDS)).toEqual([]);
  });
  it('reports no problems for the boss above the budget', () => {
    expect(checkFighter(mk({ id: 'arquitecto', name: 'EL ARQUITECTO', magic: 'reinicio',
      boss: true, strength: 8, speed: 7, reach: 7 }), KINDS)).toEqual([]);
  });
});

describe('checkFighter rejects what it is there to reject', () => {
  it('rejects a roster fighter under the budget', () => {
    const problems = checkFighter(mk({ strength: 4, speed: 4, reach: 4 }), KINDS);
    expect(problems.join(' ')).toContain('budget 12');
  });
  it('rejects a roster fighter over the budget', () => {
    const problems = checkFighter(mk({ strength: 6, speed: 6, reach: 6 }), KINDS);
    expect(problems.join(' ')).toContain('budget 18');
  });
  it('rejects a stat above 10 even when the total is 15', () => {
    const problems = checkFighter(mk({ strength: 11, speed: 3, reach: 1 }), KINDS);
    expect(problems.join(' ')).toContain('stat out of range');
  });
  it('rejects a stat below 1 even when the total is 15', () => {
    expect(checkFighter(mk({ strength: 0, speed: 5, reach: 10 }), KINDS).join(' '))
      .toContain('stat out of range');
  });
  it('rejects a non-integer stat', () => {
    expect(checkFighter(mk({ strength: 5.5, speed: 4.5, reach: 5 }), KINDS).join(' '))
      .toContain('stat out of range');
  });
  it('rejects a magic with no mechanic behind it', () => {
    const problems = checkFighter(mk({ magic: 'teletransporte' as never }), KINDS);
    expect(problems.join(' ')).toContain('magic without mechanic');
  });
  it('rejects a boss that is not superior to the roster', () => {
    const problems = checkFighter(mk({ id: 'arquitecto', boss: true, strength: 5, speed: 5, reach: 5 }), KINDS);
    expect(problems.join(' ')).toContain('boss not superior');
  });
  it('rejects a broken palette', () => {
    expect(checkFighter(mk({ palette: { body: 'blue', trim: '#00f5ff', accent: '#fff' } }), KINDS).join(' '))
      .toContain('bad palette');
  });
  it('rejects a name that is not uppercase', () => {
    expect(checkFighter(mk({ name: 'nova' }), KINDS).join(' ')).toContain('bad name');
  });
  it('rejects a build outside [0.9, 1.1]', () => {
    expect(checkFighter(mk({ build: 1.5 }), KINDS).join(' ')).toContain('bad build');
  });
});

describe('checkRoster accepts a legal roster', () => {
  it('reports no problems', () => {
    expect(checkRoster(legalRoster(), KINDS)).toEqual([]);
  });
  it('counts exactly ROSTER_SIZE selectable fighters plus one boss', () => {
    expect(legalRoster().filter((f) => !f.boss)).toHaveLength(ROSTER_SIZE);
    expect(legalRoster().filter((f) => f.boss)).toHaveLength(1);
  });
});

describe('checkRoster rejects what it is there to reject', () => {
  it('rejects a roster of seven selectable fighters', () => {
    const r = legalRoster().filter((f) => f.id !== 'brecha');
    expect(checkRoster(r, KINDS).join(' ')).toContain('roster size 7');
  });
  it('rejects a roster with two bosses', () => {
    const r = legalRoster();
    r[0] = { ...r[0], boss: true, strength: 8, speed: 7, reach: 7 };
    expect(checkRoster(r, KINDS).join(' ')).toContain('boss count 2');
  });
  it('rejects a roster with no boss', () => {
    const r = legalRoster().filter((f) => !f.boss);
    expect(checkRoster(r, KINDS).join(' ')).toContain('boss count 0');
  });
  it('rejects duplicated ids', () => {
    const r = legalRoster();
    r[1] = { ...r[1], id: 'nova' };
    expect(checkRoster(r, KINDS).join(' ')).toContain('duplicate id nova');
  });
  it('rejects two fighters sharing the same magic', () => {
    const r = legalRoster();
    r[1] = { ...r[1], magic: 'destello' };
    expect(checkRoster(r, KINDS).join(' ')).toContain('duplicate magic destello');
  });
  it('rejects two fighters with the same difficulty rank', () => {
    const r = legalRoster();
    r[1] = { ...r[1], strength: 5, speed: 5, reach: 5 };   // clone of NOVA's stats
    expect(checkRoster(r, KINDS).join(' ')).toContain('duplicate difficulty rank');
  });
  it('propagates a per-fighter problem with the offender id', () => {
    const r = legalRoster();
    r[3] = { ...r[3], strength: 1, speed: 1, reach: 1 };
    expect(checkRoster(r, KINDS).join(' ')).toContain('voltio');
  });
});

// checkStages: Task 7 publishes the real 8; here only the check itself is tested.
function stage(over: Partial<StageDef> = {}): StageDef {
  return {
    id: 'arranque', name: 'SALA DE ARRANQUE', sky: ['#0a0a18', '#1b2340'],
    ground: '#141a2c', accent: '#00f5ff', silhouette: 'towers',
    ...over,
  } as StageDef;
}
const SILS = ['towers','pipes','arcs','grid','spires','dunes','ribs','core'] as const;
function legalStages(): StageDef[] {
  return SILS.map((s, i) => stage({
    id: `stage-${i}`, name: `ESCENARIO ${i}`, silhouette: s,
    sky: [`#0a0a1${i}`, `#1b234${i}`],
  }));
}

describe('checkStages', () => {
  it('accepts eight distinct stages', () => {
    expect(checkStages(legalStages())).toEqual([]);
  });
  it('rejects seven stages', () => {
    expect(checkStages(legalStages().slice(0, 7)).join(' ')).toContain('stage count 7');
  });
  it('rejects two stages sharing a silhouette', () => {
    const s = legalStages();
    s[3] = { ...s[3], silhouette: 'towers' };
    expect(checkStages(s).join(' ')).toContain('duplicate silhouette towers');
  });
  it('rejects two stages sharing the same sky', () => {
    const s = legalStages();
    s[5] = { ...s[5], sky: s[0].sky };
    expect(checkStages(s).join(' ')).toContain('duplicate sky');
  });
  it('rejects a stage with a broken hex color', () => {
    const s = legalStages();
    s[2] = { ...s[2], ground: 'not-a-color' };
    expect(checkStages(s).join(' ')).toContain('bad color');
  });
  it('rejects two stages sharing the same id', () => {
    const s = legalStages();
    s[4] = { ...s[4], id: s[0].id };
    expect(checkStages(s).join(' ')).toContain('duplicate id');
  });
});

// ── Layer invariants (final review) ───────────────────────────────────────────
// These were the two seam bugs the per-task reviews could not see: MIN_GAP and
// HIT_STUN_MS lived in the canvas component, so nothing ever compared them
// against TECHNIQUES/ROSTER. Every number below is derived from the real
// tables — there is not a single hand-written literal — so retuning any
// baseReach/startup/recovery or any fighter stat re-runs the proof.

describe('every technique of every fighter clears the minimum separation', () => {
  it('reports no unreachable technique for the real tables at MIN_GAP', () => {
    expect(checkReachClearsGap(TECHNIQUES, ROSTER, MIN_GAP)).toEqual([]);
  });

  it('MIN_GAP is strictly below the shortest scaled reach in the tables', () => {
    expect(MIN_GAP).toBeLessThan(minScaledReach(TECHNIQUES, ROSTER));
  });

  it('catches the regression it exists for: a gap at or above the shortest reach', () => {
    const shortest = minScaledReach(TECHNIQUES, ROSTER);
    expect(checkReachClearsGap(TECHNIQUES, ROSTER, shortest).join(' ')).toContain('cannot reach');
  });
});

describe('hit stun is shorter than the fastest attack cycle', () => {
  it('reports no looping technique for the real tables at HIT_STUN_MS', () => {
    expect(checkStunClearsFastestCycle(TECHNIQUES, ROSTER, HIT_STUN_MS)).toEqual([]);
  });

  it('HIT_STUN_MS is strictly below the shortest scaled startup+recovery in the tables', () => {
    expect(HIT_STUN_MS).toBeLessThan(minTechniqueCycleMs(TECHNIQUES, ROSTER));
  });

  it('catches the regression it exists for: a stun at or above the fastest cycle', () => {
    const fastest = minTechniqueCycleMs(TECHNIQUES, ROSTER);
    expect(checkStunClearsFastestCycle(TECHNIQUES, ROSTER, fastest).join(' ')).toContain('loops');
  });
});
