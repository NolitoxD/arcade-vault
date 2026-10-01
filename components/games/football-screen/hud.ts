import {
  EXTRA_TIME_STEPS, HALF_SECONDS, HALF_STEPS, STEPS_PER_SECOND,
} from '../football-logic/clock';
import { SHOT_CHARGE_STEPS } from '../football-logic/actions';
import type { MatchState } from '../football-logic/match';
import { SHOOTOUT_ROUNDS, type ShootoutState } from '../football-logic/set-pieces';
import { SPRINT_COOLDOWN_STEPS, SPRINT_STEPS, type PlayerState } from '../football-logic/players';
import { TEAM_SIZE, type Role } from '../football-logic/teams';
import { hasLeftPitch } from '../football-logic/discipline';
import { squadRole } from '../football-logic/squads';

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
// H5 (V15-4): an exhaustive switch, not a chain of comparisons, so a new MatchPhase
// fails to compile here instead of being painted as open play.
// V15-4-7 (controller addition 3): WHICH line the bottom of the screen shows. 'aim' is
// the "only the d-pad works" hint; 'injury' is the LESIONADO window, where the match is
// stopped too but A CONFIRMS the reserve -- so the aim hint must not be painted over it
// (the window draws its own, control-hints.ts injuryHintFor).
export type IdleHint = 'none' | 'aim' | 'injury';

export function idleHint(match: MatchState): IdleHint {
  switch (match.phase) {
    case 'kickoff':
    case 'set-piece':
    case 'shootout':
    case 'goal':
    case 'half-time':
      return 'aim';
    case 'injury':
      return 'injury';
    case 'play':
    case 'golden-goal':
    case 'over':
      return 'none';
    default: {
      const _exhaustive: never = match.phase;
      return _exhaustive;
    }
  }
}

// The match is stopped and does not read A or B as football (it reads the d-pad of a
// set piece, or the TeamInput.sub of the LESIONADO window).
export function buttonsIdle(match: MatchState): boolean {
  return idleHint(match) !== 'none';
}

// ── G15-18: the LESIONADO window (V15-4-7) ──────────────────────────────────────

export const INJURY_TITLE = 'LESIONADO';

// The team whose window the screen shows: a HUMAN team with an injured player waiting,
// in the phase 'injury'. Controller addition 2: decided by the phase and pendingInjury,
// never by injuryStepsLeft, which keeps its last value after the window closes. A CPU
// team picks inside its TeamInput (ai.ts) and gets no window. Team 0 first; the engine
// opens one window at a time (no foul can be given while the phase is 'injury').
export function injuryWindowTeam(match: MatchState, human: readonly [boolean, boolean]): 0 | 1 | -1 {
  if (match.phase !== 'injury') return -1;
  if (human[0] && match.pendingInjury[0] >= 0) return 0;
  if (human[1] && match.pendingInjury[1] >= 0) return 1;
  return -1;
}

// The picker offers only what match.ts's substitute accepts (hud.test.ts checks the two
// agree for every squad index): a keeper for a keeper and an outfield player of ANY
// position for an outfield player (G15-18), nobody on the pitch and nobody who has left
// it. Runs on the event (refreshInjuryView), over the Lineup.reserves of the screen.
export function reserveCanComeOn(match: MatchState, team: 0 | 1, outRole: Role, squadIndex: number): boolean {
  if ((outRole === 'gk') !== (squadRole(squadIndex) === 'gk')) return false;
  if (hasLeftPitch(match, team, squadIndex)) return false;
  for (let i = 0; i < match.players.length; i++) {
    const p = match.players[i];
    if (p.team === team && p.squadIndex === squadIndex) return false;
  }
  return true;
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
// SHOT_CHARGE_STEPS = 60, before the shooter's shotMult, which the notches do not
// show -- G15-10, V15-4), so a notch always means the same CHARGE: 1 = tap (700),
// 2 = half (~825), 3 = full (950), each x the shooter's 0.95..1.05. Reading
// SHOT_CHARGE_STEPS instead of a literal 60 is what keeps the notches and the charge
// from ever disagreeing.
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
