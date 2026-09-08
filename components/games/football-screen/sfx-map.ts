import { stepsFor } from '../football-logic/clock';
import { GOAL_PAUSE_STEPS, type MatchState } from '../football-logic/match';
import type { Rng } from '../football-logic/rng';
import type { VaultWorldCupSfx } from '@/lib/sfx-vault-world-cup';
import type { CaptionKind, MatchWatch } from './captions';

// The audio table of the spec, one row per caption. The goal is a CHAIN of three:
// the net fires the moment the ball crosses the line (RefereeCall.kind === 'goal',
// wired in the component), the shout comes with the GOL caption, and the crowd comes
// part way into the celebration.
export function sfxForCaption(kind: CaptionKind): VaultWorldCupSfx | 'none' {
  switch (kind) {
    case 'kickoff':
    case 'extra-time':
    case 'shootout':
      return 'whistle_start';
    case 'half-time':
    case 'full-time':
      return 'whistle_end';
    case 'foul':
    case 'penalty':
      return 'whistle_foul';
    case 'goal':
    case 'shootout-goal':
      return 'goal_shout';
    case 'out':
    case 'corner':
    case 'shootout-miss':
    case 'winner':
    case 'eliminated':
    case 'draw':
      return 'none';
  }
}

// The FIRST link of the goal chain, on the EDGE of the referee's call.
//
// MEASURED (preflight 07-sep, three full CPU-vs-CPU matches, seeds 7/11/23, no
// variance): scratch.call is a level, not an edge. clearRefereeCall runs only inside
// stepOpenPlay (match.ts:358) and stepShootout (:454); the 'goal', 'kickoff',
// 'set-piece' and 'half-time' phases leave it standing, so a goal keeps
// call.kind === 'goal' for 421 consecutive steps (120 of celebration + 300 of
// kickoff countdown + 1). Reading it as a level plays 421 goal_net and 421
// whistle_foul per goal, each one cloning an HTMLAudioElement -- and it breaks the
// promise written on VaultWorldCupSFX.play(), that it is only ever called on an event.
//
// The phase is deliberately NOT part of the condition: the spec's audio table ties
// goal_net to RefereeCall.kind === 'goal' with no exception, so a shootout penalty
// rings the net like any other goal. Excluding the shootout by phase gave the worst
// of both -- every shootout goal silent EXCEPT the deciding one, whose endShootout
// puts the phase on 'over' in the same step.
export function goalNetDue(match: MatchState, w: MatchWatch): boolean {
  return match.scratch.call.kind === 'goal' && w.call !== 'goal';
}

// whistle_end where the caption map cannot reach. The spec's audio table asks for it
// at "endHalf de cada parte y phase === 'over'", but two of those transitions never
// produce a 'half-time' caption and so would be silent:
//   · endHalf with the second half LEVEL sets half = 3 and calls startKickoff in the
//     same step (match.ts:183-201) -- no 'half-time' phase at all;
//   · endExtraTime goes from 'golden-goal' straight to 'shootout'.
// Both are the two loudest moments of a match. The 1 -> 2 change DOES pass through
// 'half-time', whose caption already whistles, so it is excluded here rather than
// whistled twice.
export function halfEndWhistleDue(match: MatchState, w: MatchWatch): boolean {
  if (!w.started) return false;
  if (match.half !== w.half && match.phase !== 'half-time') return true;
  return match.phase === 'shootout' && w.phase !== 'shootout';
}

// S-SC11: 0.7 s into the two-second celebration, so the crowd answers the shout
// instead of talking over it.
export const GOAL_CROWD_DELAY_STEPS = stepsFor(0.7);

export function goalCrowdDue(match: MatchState): boolean {
  if (match.phase !== 'goal') return false;
  return GOAL_PAUSE_STEPS - match.pauseStepsLeft === GOAL_CROWD_DELAY_STEPS;
}

// The ball being struck. Stage B2 §8 warns that during the shootout the resolution
// wipes the pointer, so the safe read is a scan of all eighteen slots for the single
// 'shot' -- which is exactly what this does, and it costs 18 comparisons.
export function shotFiredThisStep(match: MatchState): boolean {
  const events = match.scratch.events;
  for (let i = 0; i < events.length; i++) {
    if (events[i].kind === 'shot' && events[i].ok) return true;
  }
  return false;
}

// Spec: "dos o tres ráfagas por parte, en instantes sorteados y deterministas, también
// en la prórroga, y nunca los mismos instantes en dos partes".
export const AMBIENCE_MIN = 2;
export const AMBIENCE_MAX = 3;
// Spec, and criterion 1: the ambience must NOT draw from the match rng, or the audio
// layer would change the simulation. Its own stream, derived from the same seed by
// integer arithmetic, keeps it reproducible with the replay and out of the engine's way.
export const AMBIENCE_SALT = 0x5bf03635;

export function ambienceSeedFor(seed: number, half: 1 | 2 | 3): number {
  return ((seed ^ Math.imul(AMBIENCE_SALT, half)) >>> 0);
}

export function createAmbienceMarks(): number[] {
  const out: number[] = [];
  for (let i = 0; i < AMBIENCE_MAX; i++) out.push(0);
  return out;
}

// One burst per window, placed inside the middle 80 % of it: the marks come out
// sorted and spread by construction, with no sorting pass and no allocation.
export function planAmbience(rng: Rng, halfSteps: number, out: number[]): number {
  const count = AMBIENCE_MIN + (rng() < 0.5 ? 0 : 1);
  const window = halfSteps / count;
  for (let i = 0; i < count; i++) {
    out[i] = Math.floor(i * window + window * 0.1 + rng() * window * 0.8);
  }
  return count;
}

export function ambienceDue(marks: readonly number[], count: number, index: number, halfStep: number): boolean {
  if (index >= count) return false;
  return halfStep >= marks[index];
}
