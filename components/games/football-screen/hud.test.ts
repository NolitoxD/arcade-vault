import { describe, expect, it } from 'vitest';
import { EXTRA_TIME_STEPS, HALF_STEPS, STEPS_PER_SECOND } from '../football-logic/clock';
import { createMatch, substitute, TRAINING_RULES, type MatchState } from '../football-logic/match';
import { SQUAD_SIZE } from '../football-logic/squads';
import { PITCH } from '../football-logic/pitch';
import { FORMATIONS, TEAMS, TEAM_SIZE } from '../football-logic/teams';
import { humanProfile, profileFor } from '../football-logic/ai';
import { SHOT_CHARGE_STEPS } from '../football-logic/actions';
import { SHOOTOUT_ROUNDS, createShootoutState } from '../football-logic/set-pieces';
import {
  INJURY_TITLE, SHOT_CHARGE_SEGMENTS, buttonsIdle, chargeSegments, clockSeconds, clockSteps, clockText,
  countdownSeconds, cursorPlayerId, halfCapSteps, halfLabel, idleHint, injuryWindowTeam, keeperHoldsBall,
  reserveCanComeOn, shootoutKicksTaken, shootoutRoundLabel, smallNumber, sprintBarFraction,
} from './hud';

function newMatch(): MatchState {
  return createMatch(
    [TEAMS[0], TEAMS[1]],
    FORMATIONS,
    PITCH,
    [humanProfile(TEAMS[0], 5), profileFor(TEAMS[1], 5)],
  );
}

describe('the clock', () => {
  it('caps at the half in halves 1 and 2 and at the extra time in half 3', () => {
    expect(halfCapSteps(1)).toBe(HALF_STEPS);
    expect(halfCapSteps(2)).toBe(HALF_STEPS);
    expect(halfCapSteps(3)).toBe(EXTRA_TIME_STEPS);
  });

  it('does NOT clip one step below the cap', () => {
    const m = newMatch();
    m.half = 3;
    m.halfStep = EXTRA_TIME_STEPS - 1;
    expect(clockSteps(m)).toBe(EXTRA_TIME_STEPS - 1);
  });

  it('clips the overshoot of an extra time that ran out during a countdown', () => {
    // Stage B2, probe P5b: measured at 3901 steps / 65.02 s. Without the clamp the
    // HUD would print 65 s of a 60 s extra time.
    const m = newMatch();
    m.half = 3;
    m.halfStep = EXTRA_TIME_STEPS + 301;
    expect(clockSteps(m)).toBe(EXTRA_TIME_STEPS);
    expect(clockSeconds(m)).toBe(60);
  });

  it('freezes during the shootout instead of counting on', () => {
    // The clamp is what freezes it: the engine stops calling advanceClock when the
    // shootout starts, but halfStep can still be sitting ABOVE the cap (an extra
    // time that ran out mid-countdown, probe P5b). Ten extra seconds of halfStep
    // must not move the HUD. Asserting on stepCount instead would be a tautology --
    // clockText reads half and halfStep, never stepCount, in any implementation.
    const m = newMatch();
    m.half = 3;
    m.phase = 'shootout';
    m.halfStep = EXTRA_TIME_STEPS;
    const before = clockText(m);
    m.halfStep += 600;
    expect(clockText(m)).toBe(before);
    expect(before).toBe('1:00');
  });

  it('formats minutes and seconds', () => {
    const m = newMatch();
    m.halfStep = 0;
    expect(clockText(m)).toBe('0:00');
    m.halfStep = STEPS_PER_SECOND * 7;
    expect(clockText(m)).toBe('0:07');
    m.halfStep = STEPS_PER_SECOND * 65;
    expect(clockText(m)).toBe('1:05');
    m.halfStep = HALF_STEPS;
    expect(clockText(m)).toBe('1:30');
  });
});

describe('halfLabel', () => {
  it('names the three halves and the two special phases', () => {
    const m = newMatch();
    expect(halfLabel(m)).toBe('1ª PARTE');
    m.half = 2;
    expect(halfLabel(m)).toBe('2ª PARTE');
    m.half = 3;
    expect(halfLabel(m)).toBe('PRÓRROGA');
    m.phase = 'shootout';
    expect(halfLabel(m)).toBe('PENALTIS');
    m.phase = 'half-time';
    m.half = 2;
    expect(halfLabel(m)).toBe('DESCANSO');
  });

  // G9-1: a training match has no clock, so the half is not what the strip should say.
  it('reads ENTRENAMIENTO for a match without a clock, whatever the half or phase', () => {
    const m = createMatch(
      [TEAMS[0], TEAMS[1]], FORMATIONS, PITCH,
      [humanProfile(TEAMS[0], 5), profileFor(TEAMS[1], 5)], TRAINING_RULES,
    );
    expect(halfLabel(m)).toBe('ENTRENAMIENTO');
    m.phase = 'goal';
    expect(halfLabel(m)).toBe('ENTRENAMIENTO');
  });
});

describe('countdownSeconds', () => {
  it('rounds up so the last fraction of a second still shows 1', () => {
    expect(countdownSeconds(STEPS_PER_SECOND * 5)).toBe(5);
    expect(countdownSeconds(STEPS_PER_SECOND * 4 + 1)).toBe(5);
    expect(countdownSeconds(1)).toBe(1);
    expect(countdownSeconds(0)).toBe(0);
    expect(countdownSeconds(-3)).toBe(0);
  });
});

describe('smallNumber', () => {
  it('returns table entries, never a freshly built string', () => {
    expect(smallNumber(0)).toBe('0');
    expect(smallNumber(7)).toBe('7');
    expect(smallNumber(99)).toBe('99');
    expect(smallNumber(3)).toBe('3');
    // Same reference twice: nothing is allocated per frame.
    expect(smallNumber(4)).toBe(smallNumber(4));
  });

  it('clamps out-of-range values instead of returning undefined', () => {
    expect(smallNumber(-1)).toBe('0');
    expect(smallNumber(1000)).toBe('99');
  });
});

describe('the cursor', () => {
  it('follows the derived controlled player in open play', () => {
    const m = newMatch();
    m.controlled[0] = 4;
    m.ball.owner = null;
    expect(cursorPlayerId(m, 0)).toBe(4);
    expect(keeperHoldsBall(m, 0)).toBe(false);
  });

  it('moves onto the keeper while the keeper holds the ball (S-GK.6 / gate 3)', () => {
    // The engine deliberately leaves match.controlled on a field player during the
    // keeper's 2 s (stage B report §8 gate 3). Two seconds of a cursor on a player
    // who does not obey the d-pad reads as a bug, so the screen moves it.
    const m = newMatch();
    m.controlled[0] = 4;
    m.ball.owner = 0 * TEAM_SIZE;
    expect(keeperHoldsBall(m, 0)).toBe(true);
    expect(cursorPlayerId(m, 0)).toBe(0 * TEAM_SIZE);
    // The rival team is unaffected.
    m.controlled[1] = TEAM_SIZE + 3;
    expect(cursorPlayerId(m, 1)).toBe(TEAM_SIZE + 3);
  });
});

describe('buttonsIdle (gate 4)', () => {
  it('is true in every phase where stepSetPiece swallows A and B', () => {
    const m = newMatch();
    // G15-18 (V15-4): the LESIONADO window ('injury') stops the match too.
    for (const phase of ['kickoff', 'set-piece', 'shootout', 'goal', 'half-time', 'injury'] as const) {
      m.phase = phase;
      expect(buttonsIdle(m)).toBe(true);
    }
  });

  it('is false in open play, in the golden goal and once the match is over', () => {
    const m = newMatch();
    for (const phase of ['play', 'golden-goal', 'over'] as const) {
      m.phase = phase;
      expect(buttonsIdle(m)).toBe(false);
    }
  });
});

// V15-4-7 (controller addition 3): during the LESIONADO window buttonsIdle stays true --
// the match is stopped -- but A confirms the reserve, so the bottom line must not say
// "the buttons do nothing". idleHint is the exhaustive switch that picks which line.
describe('idleHint', () => {
  it('is the aim hint where stepSetPiece swallows A and B, and the injury hint in the LESIONADO window', () => {
    const m = newMatch();
    for (const phase of ['kickoff', 'set-piece', 'shootout', 'goal', 'half-time'] as const) {
      m.phase = phase;
      expect(idleHint(m)).toBe('aim');
    }
    m.phase = 'injury';
    expect(idleHint(m)).toBe('injury');
    for (const phase of ['play', 'golden-goal', 'over'] as const) {
      m.phase = phase;
      expect(idleHint(m)).toBe('none');
    }
  });
});

describe('the LESIONADO window (G15-18)', () => {
  it('is titled LESIONADO', () => {
    expect(INJURY_TITLE).toBe('LESIONADO');
  });

  it('opens for a HUMAN team with an injured player waiting, in the injury phase', () => {
    const m = newMatch();
    m.phase = 'injury';
    m.pendingInjury[1] = TEAM_SIZE + 5;
    m.injuryStepsLeft[1] = 100;
    expect(injuryWindowTeam(m, [false, true])).toBe(1);
    expect(injuryWindowTeam(m, [true, false])).toBe(-1);   // the CPU's own change: no window
  });

  // Controller addition 2: injuryStepsLeft keeps its last value after the window closes
  // (review-5 minor 4), so it can never be what decides whether the window is drawn.
  it('is closed once the phase leaves injury, whatever injuryStepsLeft still says', () => {
    const m = newMatch();
    m.phase = 'set-piece';
    m.pendingInjury[0] = -1;
    m.injuryStepsLeft[0] = 479;
    expect(injuryWindowTeam(m, [true, false])).toBe(-1);
    m.phase = 'injury';
    expect(injuryWindowTeam(m, [true, false])).toBe(-1);   // nobody of team 0 waiting
  });

  // The picker offers exactly what the engine's substitute accepts: a reserve of the
  // right kind (keeper for keeper, outfield for outfield), not on the pitch and who has
  // not left it.
  it('reserveCanComeOn agrees with substitute for every squad index, outfield and keeper', () => {
    for (const outId of [3, 0]) {
      const m = newMatch();
      m.phase = 'injury';
      m.pendingInjury[0] = outId;
      m.players[outId].injured = true;
      m.leftPitch[0] = 1 << 17;      // squad index 17 (a bench forward) has already left
      const out = m.players[outId];
      let offered = 0;
      for (let i = 0; i < SQUAD_SIZE; i++) {
        const probe = newMatch();
        probe.phase = 'injury';
        probe.pendingInjury[0] = outId;
        probe.players[outId].injured = true;
        probe.leftPitch[0] = 1 << 17;
        expect(reserveCanComeOn(m, 0, out.role, i), `out ${outId}, squad index ${i}`).toBe(substitute(probe, 0, i));
        if (reserveCanComeOn(m, 0, out.role, i)) offered++;
      }
      // Default 4-4-2 bench: keeper 2, defenders 7-8, midfielders 13-14, forwards 17-18
      // (shirts; squad indices one lower). The keeper is replaced only by the keeper, an
      // outfield player by any of the outfield five minus the one who already left.
      expect(offered, `out ${outId}`).toBe(outId === 0 ? 1 : 5);
    }
  });
});

describe('the shootout scoreboard', () => {
  it('counts the kicks of the five and then says sudden death', () => {
    const sh = createShootoutState();
    sh.taken[0] = 0;
    sh.taken[1] = 0;
    expect(shootoutRoundLabel(sh)).toBe('TANDA 1/5');
    sh.taken[0] = 2;
    sh.taken[1] = 2;
    expect(shootoutRoundLabel(sh)).toBe('TANDA 3/5');
    sh.taken[0] = SHOOTOUT_ROUNDS;
    sh.taken[1] = SHOOTOUT_ROUNDS;
    sh.suddenDeath = true;
    expect(shootoutRoundLabel(sh)).toBe('MUERTE SÚBITA');
  });

  it('reads the shootout counters and never the match score', () => {
    const sh = createShootoutState();
    sh.taken[0] = 3;
    sh.taken[1] = 2;
    expect(shootoutKicksTaken(sh, 0)).toBe(3);
    expect(shootoutKicksTaken(sh, 1)).toBe(2);
  });
});

describe('the shot charge notches (R33)', () => {
  it('has exactly three notches', () => {
    expect(SHOT_CHARGE_SEGMENTS).toBe(3);
    expect(SHOT_CHARGE_STEPS).toBe(60);
  });

  // R33 (Paco, 07-sep): three notches, not a continuous bar. The borders are what
  // makes a notch mean something: 59 steps is still TWO, and only a full charge
  // lights the third -- the difference between a ~825 shot and a 950 one.
  it('lights zero, one, two or three notches at the engine ramp borders', () => {
    expect(chargeSegments(0)).toBe(0);
    expect(chargeSegments(-1)).toBe(0);
    expect(chargeSegments(1)).toBe(1);
    expect(chargeSegments(SHOT_CHARGE_STEPS / 2 - 1)).toBe(1);   // 29
    expect(chargeSegments(SHOT_CHARGE_STEPS / 2)).toBe(2);       // 30
    expect(chargeSegments(SHOT_CHARGE_STEPS - 1)).toBe(2);       // 59
    expect(chargeSegments(SHOT_CHARGE_STEPS)).toBe(3);           // 60
    expect(chargeSegments(600)).toBe(3);
  });

  it('reads the player the engine is charging', () => {
    const m = newMatch();
    const p = m.players[3];
    p.chargeSteps = 0;
    expect(chargeSegments(p.chargeSteps)).toBe(0);
    p.chargeSteps = SHOT_CHARGE_STEPS;
    expect(chargeSegments(p.chargeSteps)).toBe(SHOT_CHARGE_SEGMENTS);
  });
});

describe('the sprint bar', () => {
  it('is full when rested and empty at the end of the burst', () => {
    const m = newMatch();
    const p = m.players[3];
    p.sprintStepsLeft = 0;
    p.sprintCooldownSteps = 0;
    expect(sprintBarFraction(p)).toBe(1);
    p.sprintCooldownSteps = 90;
    expect(sprintBarFraction(p)).toBeLessThan(1);
    p.sprintCooldownSteps = 0;
    p.sprintStepsLeft = 1;
    expect(sprintBarFraction(p)).toBeGreaterThan(0);
  });
});
