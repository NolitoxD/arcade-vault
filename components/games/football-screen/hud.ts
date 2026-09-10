import {
  EXTRA_TIME_STEPS, HALF_SECONDS, HALF_STEPS, STEPS_PER_SECOND,
} from '../football-logic/clock';
import { SHOT_CHARGE_STEPS } from '../football-logic/actions';
import type { MatchState } from '../football-logic/match';
import { SHOOTOUT_ROUNDS, type ShootoutState } from '../football-logic/set-pieces';
import { SPRINT_COOLDOWN_STEPS, SPRINT_STEPS, type PlayerState } from '../football-logic/players';
import { TEAM_SIZE } from '../football-logic/teams';

// Precomputed string tables (the TIMER_TEXT pattern of KongGame/VaultFighterGame):
// draw() must never build a string. HALF_SECONDS (90) is the longest clock the HUD
// can show, and it also covers the 60 s extra time.
function buildClockText(): string[] {
  const out: string[] = [];
  for (let s = 0; s <= HALF_SECONDS; s++) {
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    out.push(`${mm}:${ss < 10 ? '0' : ''}${ss}`);
  }
  return out;
}
const CLOCK_TEXT: readonly string[] = buildClockText();

function buildSmallNumbers(): string[] {
  const out: string[] = [];
  for (let n = 0; n <= 99; n++) out.push(String(n));
  return out;
}
const SMALL_NUMBER_TEXT: readonly string[] = buildSmallNumbers();

export function smallNumber(n: number): string {
  if (n <= 0) return SMALL_NUMBER_TEXT[0];
  if (n >= 99) return SMALL_NUMBER_TEXT[99];
  return SMALL_NUMBER_TEXT[n | 0];
}

export function halfCapSteps(half: 1 | 2 | 3): number {
  return half === 3 ? EXTRA_TIME_STEPS : HALF_STEPS;
}

// Stage B2 final report §8, first row of the HUD reading map: the clock MUST be
// clamped. The cap is only read from open play, so an extra time that runs out
// during a set-piece countdown leaves halfStep above it (measured: up to 301 steps
// over, 65.02 s of a 60 s extra time). This is not an engine bug -- the two
// regulation halves have exactly the same shape -- the fix belongs here.
export function clockSteps(match: MatchState): number {
  const cap = halfCapSteps(match.half);
  return match.halfStep < cap ? match.halfStep : cap;
}

export function clockSeconds(match: MatchState): number {
  const s = Math.floor(clockSteps(match) / STEPS_PER_SECOND);
  return s > HALF_SECONDS ? HALF_SECONDS : s;
}

export function clockText(match: MatchState): string {
  return CLOCK_TEXT[clockSeconds(match)];
}

const TRAINING_LABEL = 'ENTRENAMIENTO';

// Stage B2 §8: during the shootout halfStep and clockMs stay FROZEN at the value
// they were entered with, so nothing special is needed to stop the clock -- but the
// label has to say what is happening.
export function halfLabel(match: MatchState): string {
  if (!match.rules.timed) return TRAINING_LABEL;   // G9-1: no clock, no half to name
  if (match.phase === 'shootout') return 'PENALTIS';
  if (match.phase === 'half-time') return 'DESCANSO';
  if (match.half === 3) return 'PRÓRROGA';
  return match.half === 1 ? '1ª PARTE' : '2ª PARTE';
}

export function countdownSeconds(stepsLeft: number): number {
  if (stepsLeft <= 0) return 0;
  return Math.ceil(stepsLeft / STEPS_PER_SECOND);
}

export function keeperHoldsBall(match: MatchState, team: 0 | 1): boolean {
  return match.ball.owner === team * TEAM_SIZE;
}

// S-SC3, closing gate 3 of the stage B report: the engine leaves match.controlled on
// a field player during the keeper's two seconds (S-GK.6) and exposes ball.owner so
// the screen can decide. It decides here: the cursor goes where the d-pad goes.
export function cursorPlayerId(match: MatchState, team: 0 | 1): number {
  return keeperHoldsBall(match, team) ? team * TEAM_SIZE : match.controlled[team];
}

// Gate 4 of the stage B report: during a set-piece countdown stepSetPiece reads only
// input.dx/dy -- A and B are swallowed. The HUD says so, or the player hammers the
// buttons believing they are broken.
export function buttonsIdle(match: MatchState): boolean {
  const p = match.phase;
  return p === 'kickoff' || p === 'set-piece' || p === 'shootout' || p === 'goal' || p === 'half-time';
}

export function shootoutKicksTaken(sh: ShootoutState, team: 0 | 1): number {
  return sh.taken[team];
}

export function shootoutRoundLabel(sh: ShootoutState): string {
  if (sh.suddenDeath) return 'MUERTE SÚBITA';
  const taken = sh.taken[0] < sh.taken[1] ? sh.taken[0] : sh.taken[1];
  const round = taken + 1;
  return round > SHOOTOUT_ROUNDS ? 'MUERTE SÚBITA' : `TANDA ${round}/${SHOOTOUT_ROUNDS}`;
}

// R33 (Paco, 07-sep), replacing the continuous bar of the first draft of S-SC4:
// THREE notches, drawn next to the controlled player, not a bar in the HUD. The
// thresholds are the engine's own ramp (actions.ts: shotSpeed goes 700 -> 950 over
// SHOT_CHARGE_STEPS = 60), so a notch always means the same shot: 1 = tap (700),
// 2 = half (~825), 3 = full (950). Reading SHOT_CHARGE_STEPS instead of a literal 60
// is what keeps the notches and the shot from ever disagreeing.
export const SHOT_CHARGE_SEGMENTS = 3;

export function chargeSegments(chargeSteps: number): 0 | 1 | 2 | 3 {
  if (chargeSteps <= 0) return 0;
  if (chargeSteps >= SHOT_CHARGE_STEPS) return 3;
  return chargeSteps >= SHOT_CHARGE_STEPS / 2 ? 2 : 1;
}

// One bar for the burst and its recovery (spec: 2 s of sprint, 3 s of cooldown):
// full when rested, draining while sprinting, refilling while recovering.
export function sprintBarFraction(p: PlayerState): number {
  if (p.sprintStepsLeft > 0) return p.sprintStepsLeft / SPRINT_STEPS;
  if (p.sprintCooldownSteps > 0) return 1 - p.sprintCooldownSteps / SPRINT_COOLDOWN_STEPS;
  return 1;
}
