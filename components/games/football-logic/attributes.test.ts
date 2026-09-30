import { describe, expect, it } from 'vitest';
import { FORMATIONS, TEAMS, TEAM_SIZE, type TeamAttrs } from './teams';
import { KEEPER_ATTRS, SQUAD_SIZE, checkAttributes, keeperAttrsFor, outfieldAttrsFor, squadRole } from './squads';
import { KEEPER_REFLEX_PER_LEVEL, humanProfile, keeperCatchChance, keeperStep, keeperThrowErrorDeg, profileFor } from './ai';
import { PITCH, centerX, centerY, goalLineX } from './pitch';
import { createMatch, keeperOf, resumePlay, stepMatch } from './match';
import {
  ATTR_SHOT_SPAN, ATTR_SPEED_SPAN, GK_LINE_DIST, GK_SPEED, KEEPER_RUSHING_SPAN, applySquadAttrs, createPlayers,
  defaultSquadIndexFor, multForLevel, stepPlayerFree, type PlayerState,
} from './players';
import { createBall } from './ball';
import { createTeamInput, type TeamInput } from './input';
import type { Rng } from './rng';
// Test-only edge into the screen (H17): the ENGINE may not import lineup.ts, which is
// exactly why this test exists -- it proves the engine's own copy of the rule agrees.
import { createLineup, defaultLineup } from '../football-screen/lineup';

const LEVELS = [1, 2, 3, 4, 5];

function attrValues(a: TeamAttrs): number[] {
  return [a.defence, a.attack, a.counter, a.shooting, a.passing];
}

describe('G15-10: five 1-5 attributes per selection', () => {
  it('every one of the twenty carries five integers in 1..5', () => {
    for (const t of TEAMS) {
      for (const v of attrValues(t.attrs)) {
        expect(Number.isInteger(v), `${t.id}`).toBe(true);
        expect(LEVELS, `${t.id}`).toContain(v);
      }
    }
  });
  it('the twenty are NOT all the same team with a different shirt (the point of the decision)', () => {
    const shapes = new Set(TEAMS.map((t) => attrValues(t.attrs).join('-')));
    expect(shapes.size).toBeGreaterThanOrEqual(12);
  });
  it('checkAttributes is not vacuous: it names a selection whose attribute is out of range', () => {
    expect(checkAttributes(TEAMS)).toEqual([]);
    const broken = [{ ...TEAMS[0], attrs: { ...TEAMS[0].attrs, shooting: 6 } }];
    expect(checkAttributes(broken).join(' ')).toContain('espana');
    expect(checkAttributes(broken).join(' ')).toContain('shooting');
  });
});

describe('G15-10: the attributes bend profileFor, and difficulty still dominates', () => {
  it('at the same difficulty, a better passer has LESS pass error and a better shooter LESS shot error', () => {
    const weak = { ...TEAMS[0], attrs: { defence: 3, attack: 3, counter: 3, shooting: 1, passing: 1 } };
    const strong = { ...TEAMS[0], attrs: { defence: 3, attack: 3, counter: 3, shooting: 5, passing: 5 } };
    expect(profileFor(strong, 5).passErrorDeg).toBeLessThan(profileFor(weak, 5).passErrorDeg);
    expect(profileFor(strong, 5).shotErrorDeg).toBeLessThan(profileFor(weak, 5).shotErrorDeg);
  });
  it('the bend is SMALL (Paco: "pequenos cambios"): never more than 20 % of the level-5 value', () => {
    const mid = { ...TEAMS[0], attrs: { defence: 3, attack: 3, counter: 3, shooting: 3, passing: 3 } };
    const base = profileFor(mid, 5);
    for (const level of LEVELS) {
      const t = { ...TEAMS[0], attrs: { defence: level, attack: level, counter: level, shooting: level, passing: level } };
      const p = profileFor(t, 5);
      expect(Math.abs(p.passErrorDeg - base.passErrorDeg)).toBeLessThanOrEqual(base.passErrorDeg * 0.2);
      expect(Math.abs(p.shotErrorDeg - base.shotErrorDeg)).toBeLessThanOrEqual(base.shotErrorDeg * 0.2);
    }
  });
  it('NEGATIVE CONTROL: difficulty still moves the profile more than the attributes do', () => {
    const best = { ...TEAMS[0], attrs: { defence: 5, attack: 5, counter: 5, shooting: 5, passing: 5 } };
    const worst = { ...TEAMS[0], attrs: { defence: 1, attack: 1, counter: 1, shooting: 1, passing: 1 } };
    const byAttrs = Math.abs(profileFor(best, 5).passErrorDeg - profileFor(worst, 5).passErrorDeg);
    const byLevel = Math.abs(profileFor(best, 8).passErrorDeg - profileFor(best, 1).passErrorDeg);
    expect(byLevel).toBeGreaterThan(byAttrs);
  });
});

describe('G15-26: the two keepers of a squad are different', () => {
  it('every selection has exactly two keeper profiles, all three levels in 1..5', () => {
    for (const t of TEAMS) {
      const pair = KEEPER_ATTRS[t.id];
      expect(pair, `${t.id}`).toBeDefined();
      expect(pair).toHaveLength(2);
      for (const k of pair) {
        for (const v of [k.reflexes, k.rushing, k.kicking]) {
          expect(LEVELS, `${t.id}`).toContain(v);
        }
      }
    }
  });
  it('the number 2 is NOT a copy of the number 1 in any selection (so the sub is felt, G15-18)', () => {
    for (const t of TEAMS) {
      const [first, second] = KEEPER_ATTRS[t.id];
      expect(
        first.reflexes !== second.reflexes || first.rushing !== second.rushing || first.kicking !== second.kicking,
        `${t.id}: the two keepers are identical`,
      ).toBe(true);
    }
  });
  it('keeperAttrsFor maps squad index 0 and 1 to the pair, and throws for an outfield index', () => {
    expect(keeperAttrsFor('espana', 0)).toEqual(KEEPER_ATTRS['espana'][0]);
    expect(keeperAttrsFor('espana', 1)).toEqual(KEEPER_ATTRS['espana'][1]);
    expect(() => keeperAttrsFor('espana', 2)).toThrow();
  });
});

describe('G15-10: per-player speed and shot, derived from the role', () => {
  it('every outfield index of every selection gets speed and shot in 1..5', () => {
    for (const t of TEAMS) {
      for (let i = 0; i < SQUAD_SIZE; i++) {
        if (squadRole(i) === 'gk') continue;
        const a = outfieldAttrsFor(t.id, i);
        expect(LEVELS, `${t.id}[${i}] speed`).toContain(a.speed);
        expect(LEVELS, `${t.id}[${i}] shot`).toContain(a.shot);
      }
    }
  });
  it('the role dominates: forwards shoot better than defenders on average, across the twenty', () => {
    let fwd = 0;
    let def = 0;
    let n = 0;
    for (const t of TEAMS) {
      for (let i = 0; i < SQUAD_SIZE; i++) {
        if (squadRole(i) === 'fwd') fwd += outfieldAttrsFor(t.id, i).shot;
        if (squadRole(i) === 'def') def += outfieldAttrsFor(t.id, i).shot;
      }
      n++;
    }
    expect(fwd / (4 * n)).toBeGreaterThan(def / (6 * n));
  });
  it('NEGATIVE CONTROL: two selections do NOT produce the same numbers for the same index', () => {
    let different = 0;
    for (let i = 0; i < SQUAD_SIZE; i++) {
      if (squadRole(i) === 'gk') continue;
      const a = outfieldAttrsFor('espana', i);
      const b = outfieldAttrsFor('japon', i);
      if (a.speed !== b.speed || a.shot !== b.shot) different++;
    }
    expect(different, 'the per-selection variation is missing: every squad is a clone').toBeGreaterThan(0);
  });
});

describe('V15-4: the squad reaches the pitch (squadIndex, the default eleven, the derived values)', () => {
  it('defaultSquadIndexFor gives, for every formation, exactly the eleven the ALINEACION screen opens on (defaultLineup)', () => {
    for (const f of FORMATIONS) {
      const l = createLineup();
      defaultLineup(f, l);
      const engine = [defaultSquadIndexFor(f, -1)];
      for (let s = 0; s < f.slots.length; s++) engine.push(defaultSquadIndexFor(f, s));
      expect(engine, f.id).toEqual(l.starters);
    }
  });
  it('createPlayers fields the default eleven and derives each player\'s values from its squad index', () => {
    const ps = createPlayers([FORMATIONS[0], FORMATIONS[1]], PITCH, ['espana', 'japon']);
    for (const p of ps) {
      const teamId = p.team === 0 ? 'espana' : 'japon';
      const f = FORMATIONS[p.team];
      expect(p.squadIndex, `player ${p.id}`).toBe(defaultSquadIndexFor(f, p.slot));
      expect(squadRole(p.squadIndex), `player ${p.id}`).toBe(p.role);
      if (p.role === 'gk') {
        const k = keeperAttrsFor(teamId, p.squadIndex);
        expect([p.keeperReflexes, p.keeperRushing, p.keeperKicking]).toEqual([k.reflexes, k.rushing, k.kicking]);
        expect([p.speedMult, p.shotMult]).toEqual([1, 1]);
      } else {
        const a = outfieldAttrsFor(teamId, p.squadIndex);
        expect(p.speedMult).toBe(multForLevel(a.speed, ATTR_SPEED_SPAN));
        expect(p.shotMult).toBe(multForLevel(a.shot, ATTR_SHOT_SPAN));
        expect([p.keeperReflexes, p.keeperRushing, p.keeperKicking]).toEqual([0, 0, 0]);
      }
    }
  });
  it('starters, when given, are the squad index per lineup position (0 = the keeper): the number 2 can start in goal', () => {
    const l = createLineup();
    defaultLineup(FORMATIONS[0], l);
    const mine = [...l.starters];
    mine[0] = 1;                              // the second keeper
    mine[1] = l.starters[1] === 2 ? 7 : 2;    // another defender in slot 0
    const ps = createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH, ['espana', 'italia'], [mine, l.starters]);
    expect(ps[0].squadIndex).toBe(1);
    expect(ps[0].keeperReflexes).toBe(KEEPER_ATTRS['espana'][1].reflexes);
    expect(ps[1].squadIndex).toBe(mine[1]);
    expect(ps[TEAM_SIZE].squadIndex).toBe(0);
  });
  it('the multipliers are small: level 3 is exactly 1, levels 1 and 5 are 1 -+ the span', () => {
    expect(multForLevel(3, ATTR_SPEED_SPAN)).toBe(1);
    expect(multForLevel(1, ATTR_SPEED_SPAN)).toBeCloseTo(0.95, 12);
    expect(multForLevel(5, ATTR_SHOT_SPAN)).toBeCloseTo(1.05, 12);
  });
});

describe('G15-26: the keeper on the pitch bends the catch', () => {
  it('reflexes 3 is the team profile exactly; 5 catches more and 1 less, inside the profile clamp', () => {
    const m = createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
    const gk = keeperOf(m, 0);
    expect(gk.role).toBe('gk');
    expect(gk.team).toBe(0);
    const team = m.profiles[0].catchChance;
    gk.keeperReflexes = 3;
    expect(keeperCatchChance(team, gk)).toBe(team);
    gk.keeperReflexes = 5;
    const high = keeperCatchChance(team, gk);
    gk.keeperReflexes = 1;
    const low = keeperCatchChance(team, gk);
    expect(high).toBeGreaterThan(team);
    expect(low).toBeLessThan(team);
    gk.keeperReflexes = 5;
    expect(keeperCatchChance(0.9, gk)).toBe(0.9);   // CATCH_MAX still caps it
  });
});

describe('G15-26: distribution is strength AND accuracy', () => {
  it('kicking 3 throws with the team pass error, 5 with less and 1 with more; a human side (R10) stays exact', () => {
    const m = createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [humanProfile(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
    const gk = keeperOf(m, 1);
    const team = m.profiles[1].passErrorDeg;
    gk.keeperKicking = 3;
    expect(keeperThrowErrorDeg(team, gk)).toBe(team);
    gk.keeperKicking = 5;
    expect(keeperThrowErrorDeg(team, gk)).toBeLessThan(team);
    gk.keeperKicking = 1;
    expect(keeperThrowErrorDeg(team, gk)).toBeGreaterThan(team);
    expect(keeperThrowErrorDeg(m.profiles[0].passErrorDeg, keeperOf(m, 0))).toBe(0);
  });
});

describe('G15-26: each squad\'s number 1 keeper is better than its number 2 in at least one level', () => {
  it('holds for the twenty selections (the data rule of KEEPER_ATTRS)', () => {
    for (const t of TEAMS) {
      const [first, second] = KEEPER_ATTRS[t.id];
      expect(
        first.reflexes > second.reflexes || first.rushing > second.rushing || first.kicking > second.kicking,
        `${t.id}: the number 1 is not better than the number 2 in any level`,
      ).toBe(true);
    }
  });
});

// ── Fix round 1 (review-2 Important 1): the engine wiring of G15-26, each with a test that
// can fail. The squads' first keepers are mostly neutral (level 3), so the levels here are
// either set on the keeper (the ends of the scale, 1 and 5, which no keeper in the data has
// for rushing) or picked FROM the data by level, never by a hard-coded team or index.

function keeperOfTeam(ps: readonly PlayerState[], team: 0 | 1): PlayerState {
  const gk = ps.find((p) => p.team === team && p.role === 'gk');
  if (gk === undefined) throw new Error(`team ${team} has no keeper`);
  return gk;
}

// The first (teamId, squad index) in the data whose keeper matches `pred`.
function dataKeeper(pred: (reflexes: number, rushing: number, kicking: number) => boolean): { teamId: string; index: number } {
  for (const t of TEAMS) {
    const pair = KEEPER_ATTRS[t.id];
    for (let i = 0; i < pair.length; i++) {
      if (pred(pair[i].reflexes, pair[i].rushing, pair[i].kicking)) return { teamId: t.id, index: i };
    }
  }
  throw new Error('no keeper in the data matches');
}

// Moves the keeper along +y for one second by its want channel and returns the distance.
function walkKeeper(gk: PlayerState): number {
  gk.wantX = 0;
  gk.wantY = 1;
  const y0 = gk.y;
  for (let s = 0; s < 60; s++) stepPlayerFree(gk, false, 1, PITCH, s);
  return gk.y - y0;
}

describe('G15-26: sweeping (rushing) sets the keeper\'s speed, and keeperStep still arrives exactly', () => {
  it('rushing 1 moves at GK_SPEED x (1 - span), rushing 5 at x (1 + span)', () => {
    for (const [level, factor] of [[1, 1 - KEEPER_RUSHING_SPAN], [5, 1 + KEEPER_RUSHING_SPAN]]) {
      const gk = keeperOfTeam(createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH, [TEAMS[0].id, TEAMS[1].id]), 0);
      gk.keeperRushing = level;
      expect(walkKeeper(gk), `rushing ${level}`).toBeCloseTo(GK_SPEED * factor, 6);
    }
  });
  it('a keeper from the data with a non-neutral rushing, put in goal through applySquadAttrs, moves at his own speed', () => {
    const k = dataKeeper((_r, rushing) => rushing !== 3);
    const gk = keeperOfTeam(createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH, [k.teamId, TEAMS[1].id]), 0);
    gk.squadIndex = k.index;
    applySquadAttrs(gk, k.teamId);
    const rushing = KEEPER_ATTRS[k.teamId][k.index].rushing;
    expect(gk.keeperRushing).toBe(rushing);
    expect(walkKeeper(gk)).toBeCloseTo(GK_SPEED * (1 + ((rushing - 3) / 2) * KEEPER_RUSHING_SPAN), 6);
    expect(walkKeeper(gk)).not.toBeCloseTo(GK_SPEED, 6);
  });
  it('at rushing 1 and 5, keeperStep + the move land the keeper EXACTLY on its line target (steer and move use one speed)', () => {
    for (const level of [1, 5]) {
      const ps = createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH, [TEAMS[0].id, TEAMS[1].id]);
      const gk = keeperOfTeam(ps, 0);
      gk.keeperRushing = level;
      const lineX = goalLineX(PITCH, 0) + GK_LINE_DIST;
      gk.x = lineX;
      gk.y = centerY(PITCH) + 2;   // under one step away at either speed
      const ball = createBall();
      ball.owner = null;
      ball.x = centerX(PITCH);     // loose, far from both areas: the keeper goes to its line point
      ball.y = centerY(PITCH);
      keeperStep(gk, ps, ball, 1, PITCH, 0);
      stepPlayerFree(gk, false, 1, PITCH, 0);
      expect(gk.x, `rushing ${level}`).toBeCloseTo(lineX, 10);
      expect(gk.y, `rushing ${level}`).toBeCloseTo(centerY(PITCH), 10);
    }
  });
});

describe('G15-26: in the match, the keeper on the pitch catches with HIS reflexes (keeperCatchFor)', () => {
  function fixedRng(value: number): Rng {
    return () => value;
  }
  it('with one fixed draw between the two keepers\' chances, the better-reflexes keeper catches and the other does not', () => {
    // A selection whose two keepers differ in reflexes, from the data (not TEAMS[0]: the rival is TEAMS[0]).
    const t = TEAMS.slice(1).find((d) => KEEPER_ATTRS[d.id][0].reflexes !== KEEPER_ATTRS[d.id][1].reflexes);
    if (t === undefined) throw new Error('no selection with two keepers of different reflexes');
    const pair = KEEPER_ATTRS[t.id];
    const better = pair[0].reflexes > pair[1].reflexes ? 0 : 1;
    const worse = 1 - better;
    const idle: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    const caughtBy = (index: number, draw: (team: number) => number): boolean => {
      const m = createMatch([TEAMS[0], t], FORMATIONS, PITCH, [profileFor(TEAMS[0], 5), profileFor(t, 5)]);
      resumePlay(m);
      const gk = keeperOf(m, 1);
      gk.squadIndex = index;
      applySquadAttrs(gk, t.id);
      gk.x = PITCH.width - GK_LINE_DIST;
      gk.y = centerY(PITCH);
      // A 700 u/s ball (no charged-shot penalty) 31 u short of him, inside GK_CATCH_RADIUS.
      m.ball.owner = null;
      m.ball.x = gk.x - 31; m.ball.y = gk.y; m.ball.z = 0;
      m.ball.vx = 700; m.ball.vy = 0; m.ball.vz = 0;
      m.ball.kickerId = -1; m.ball.kickLockUntilStep = 0;
      stepMatch(m, idle, fixedRng(draw(m.profiles[1].catchChance)));
      return m.ball.owner === gk.id;
    };
    // Halfway between the worse and the better keeper's chance, from the definition.
    const draw = (team: number): number =>
      team + ((pair[worse].reflexes - 3) + (pair[better].reflexes - pair[worse].reflexes) / 2) * KEEPER_REFLEX_PER_LEVEL;
    expect(caughtBy(better, draw), `${t.id}: the better keeper should catch`).toBe(true);
    expect(caughtBy(worse, draw), `${t.id}: the worse keeper should miss`).toBe(false);
  });
});
