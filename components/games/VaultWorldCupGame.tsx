'use client';

import React, { useEffect, useRef } from 'react';

import { createAiState, decideTeamInput, humanProfile, profileFor, type AiProfile, type AiState } from './football-logic/ai';
import { stepsFor } from './football-logic/clock';
import { createTeamInput, type TeamInput } from './football-logic/input';
import {
  abandon, createMatch, isOpenPlay, stepMatch, winnerOf, type MatchState,
} from './football-logic/match';
import { PITCH } from './football-logic/pitch';
import { PLAYER_RADIUS, isPlayerDown, isSprinting, type PlayerState } from './football-logic/players';
import { createRng, type Rng } from './football-logic/rng';
import { SHOOTOUT_RESOLVE_STEPS } from './football-logic/set-pieces';
import { FORMATIONS, TEAMS, teamById, type Strategy, type TeamDef } from './football-logic/teams';

import {
  CAMERA_LAG, VIEW_H, VIEW_W, cameraTargetX, cameraTargetY, centreCamera, createCamera,
  followCamera, isOnScreen, toScreenX, toScreenY, type Camera,
} from './football-screen/camera';
import {
  CAPTION_TEXT, collectCaptions, createCaptionState, createMatchWatch, stepCaption, updateWatch,
  type ShowingCaption,
} from './football-screen/captions';
import {
  SHOT_CHARGE_SEGMENTS, buttonsIdle, chargeSegments, clockText, countdownSeconds, cursorPlayerId,
  halfLabel, keeperHoldsBall, shootoutRoundLabel, smallNumber, sprintBarFraction,
} from './football-screen/hud';
import {
  createPadState, padAdvance, padBlur, padChoice, padClear, padDown, padKeyFor, padToTeamInput, padUp,
} from './football-screen/keyboard';
import { createStepBudget } from './football-screen/loop';
import { createFramePlan, planFrame, planHalfAmbience } from './football-screen/match-loop';
import {
  MINIMAP_H, MINIMAP_PAD, MINIMAP_W, createMinimapRect, minimapViewRect, minimapX, minimapY,
} from './football-screen/minimap';
import {
  ambienceDue, captionSfxOnEdge, createAmbienceMarks, goalCrowdDue, goalNetDue, halfEndWhistleDue,
  shotFiredThisStep,
} from './football-screen/sfx-map';
import { MIN_VIEWPORT_H, MIN_VIEWPORT_W, viewportAllowed } from './football-screen/viewport-guard';
import { sfxVaultWorldCup } from '@/lib/sfx-vault-world-cup';

interface VaultWorldCupGameProps {
  paused: boolean;
  muted?: boolean;
  homeTeamId?: string;
  awayTeamId?: string;
  homeFormation?: number;
  awayFormation?: number;
  homeStrategy?: Strategy;
  difficulty?: number;
  seed?: number;
  onScoreChange?: (home: number, away: number) => void;
  onClockChange?: (label: string) => void;
  onMatchEnd: (winner: 0 | 1 | -1) => void;
}

// ── The human is team 0 in step 8. The second keyboard is step 9. ──────────────
const HUMAN_TEAM = 0 as const;
const CPU_TEAM = 1 as const;
// Two independent rng streams from one seed (ai.test.ts's playCpuMatch pattern): the
// CPU decides with its own, so the replay is seed + TeamInput and nothing else.
const CPU_SEED_SALT = 0x2545f491;
// Stage C assumption S-SC3, not in the spec -- review in QA (confirmed by owner
// 2026-09-07): the engine holds the keeper for a fixed 2 s (S-GK.6, stage B) but
// exposes no steps-left of its own -- keeperHoldsBall is a plain boolean. The screen
// keeps its OWN elapsed count, reset the moment the flag drops, to show a countdown
// that tracks the known, fixed duration without touching the engine.
const KEEPER_HOLD_STEPS = stepsFor(2);

// ── Palette. One visual version, no skins (spec). ─────────────────────────────
const GRASS_DARK = '#1f6b32';
const GRASS_LIGHT = '#247a39';
const STRIPE_WIDTH = 160;
const LINE = 'rgba(255,255,255,0.75)';
const GOAL_MOUTH = 'rgba(255,255,255,0.25)';
const FACING_STICK = 'rgba(0,0,0,0.55)';
const HEADS_DOWN = 'rgba(0,0,0,0.5)';
const SPRINT_RING = 'rgba(255,255,255,0.5)';
const NOTCH_FRAME = 'rgba(0,0,0,0.6)';
const NOTCH_EMPTY = 'rgba(0,0,0,0.5)';
const BAR_EMPTY = 'rgba(0,0,0,0.5)';
const SPRINT_BAR = '#6fe3ff';
const HINT_TEXT = 'rgba(255,255,255,0.7)';
const HUD_DIM = 'rgba(255,255,255,0.45)';
const HUD_BG = 'rgba(0,0,0,0.55)';
const HUD_TEXT = '#e8f4ff';
const HUD_ACCENT = '#ffcf3a';
const CURSOR_COLOR = '#ffcf3a';
const BALL_COLOR = '#ffffff';
const BALL_TRIM = 'rgba(0,0,0,0.4)';
const SHADOW = 'rgba(0,0,0,0.35)';
const MINIMAP_BG = 'rgba(0,0,0,0.6)';
const MINIMAP_FRAME = 'rgba(255,255,255,0.6)';
const CAPTION_BG = 'rgba(0,0,0,0.65)';
const BLOCKED_BG = 'rgba(0,0,0,0.78)';
const PENALTY_MARK = 'rgba(255,255,255,0.8)';

// ── Layout of the canvas overlays ─────────────────────────────────────────────
const HUD_H = 44;
const CAPTION_Y = 200;
const CAPTION_H = 96;
// The viewport-guard panel goes UNDER the caption band (296 .. 400 of the 500), so
// the EMPATE that the same event queues stays readable above it.
const BLOCKED_Y = CAPTION_Y + CAPTION_H;
const BLOCKED_H = 104;
const BAR_W = 34;
const BAR_H = 5;
// R33: the three charge notches drawn next to the controlled player, above the cursor
// arrow (which occupies y - PLAYER_RADIUS - 12 .. -3).
const NOTCH_W = 7;
const NOTCH_H = 5;
const NOTCH_GAP = 2;
const NOTCH_TOTAL_W = SHOT_CHARGE_SEGMENTS * NOTCH_W + (SHOT_CHARGE_SEGMENTS - 1) * NOTCH_GAP;
const NOTCH_DY = -24;
// The minimap's corner and dot sizes: Task 8-2 left both to this file on purpose (its
// review, note under Issues), so they are named here rather than left as literals in
// drawMinimap. Bottom-right, because the HUD owns the top strip and the formation
// legend the bottom left. The keeper's dot is one pixel bigger than an outfielder's:
// at 2 px on a 200 x 130 map the two teams are told apart by colour, and the keeper
// by size.
const MINIMAP_X = VIEW_W - MINIMAP_W - MINIMAP_PAD;
const MINIMAP_Y = VIEW_H - MINIMAP_H - MINIMAP_PAD;
const MINIMAP_DOT_GK = 3;
const MINIMAP_DOT_PLAYER = 2;
const MINIMAP_DOT_BALL = 2;
const GOAL_MOUTH_DEPTH = 30;
const SPOT_RADIUS = 4;
const BALL_RADIUS = 6;
// How far off screen the ball is still drawn: its own radius plus the height it can
// be lifted to, so a long pass does not pop into view at the edge of the canvas.
const BALL_MARGIN = 30;

// Fixed UI copy, module constants so draw() never builds a string.
const HINT_AIM = 'CRUCETA: APUNTAR · SALE SOLO';
const FORMATION_HINT = '1/2/3 ALINEACIÓN · 4/5/6 ESTRATEGIA';
// Built ONCE at module load, from the guard's own thresholds rather than a literal,
// so the panel and viewportAllowed can never drift apart.
const BLOCKED_TITLE = 'AGRANDA LA VENTANA';
const BLOCKED_HINT = `MÍNIMO ${MIN_VIEWPORT_W} × ${MIN_VIEWPORT_H}`;
const KEEPER_HINT = 'SAQUE: K CORTO · J LARGO · ';
const STRATEGY_LABEL: Readonly<Record<Strategy, string>> = {
  attack: 'ATAQUE',
  neutral: 'NEUTRAL',
  defend: 'DEFENSA',
};

// The fonts, as complete `font` strings: assigning ctx.font takes a string, and
// building one per draw call is the allocation criterion 20 forbids.
const FONT_TEAM = 'bold 18px monospace';
const FONT_SCORE = 'bold 24px monospace';
const FONT_CLOCK = 'bold 20px monospace';
const FONT_HALF = 'bold 11px monospace';
const FONT_SMALL = 'bold 12px monospace';
const FONT_SHOOTOUT = 'bold 14px monospace';
const FONT_COUNTDOWN = 'bold 40px monospace';
const FONT_CAPTION = 'bold 48px monospace';
const FONT_BLOCKED_TITLE = 'bold 26px monospace';
const FONT_BLOCKED_HINT = 'bold 16px monospace';

function teamOrDefault(id: string | undefined, fallbackIndex: number): TeamDef {
  const found = id === undefined ? undefined : teamById(TEAMS, id);
  return found ?? TEAMS[fallbackIndex];
}

function VaultWorldCupGame({
  paused,
  muted = false,
  homeTeamId,
  awayTeamId,
  homeFormation = 0,
  awayFormation = 0,
  homeStrategy = 'neutral',
  difficulty = 5,      // spec: 5 in the friendly
  seed,
  onScoreChange,
  onClockChange,
  onMatchEnd,
}: VaultWorldCupGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const mutedRef = useRef(muted);
  const onMatchEndRef = useRef(onMatchEnd);
  const onScoreChangeRef = useRef(onScoreChange);
  const onClockChangeRef = useRef(onClockChange);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    mutedRef.current = muted;
    sfxVaultWorldCup.setMuted(muted);
  }, [muted]);

  // The loop never reads props: the three callbacks go through refs so a page that
  // re-creates them does not restart the match.
  useEffect(() => {
    onMatchEndRef.current = onMatchEnd;
    onScoreChangeRef.current = onScoreChange;
    onClockChangeRef.current = onClockChange;
  }, [onMatchEnd, onScoreChange, onClockChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d')!;

    // ── Everything below is created ONCE and mutated in place (criterion 20) ──
    // Stage C assumption S-SC13, not in the spec -- review in QA: the friendly's seed
    // is the wall clock, read HERE and nowhere else in the game (the football-screen
    // and football-logic layers are pure), and the three streams (match, CPU,
    // ambience) come off it by integer arithmetic.
    const matchSeed = seed ?? Date.now();          // the one Date.now() of the whole game
    const matchRng: Rng = createRng(matchSeed);
    const cpuRng: Rng = createRng((matchSeed ^ CPU_SEED_SALT) >>> 0);

    const home = teamOrDefault(homeTeamId, 0);
    const away = teamOrDefault(awayTeamId, 1);
    const profiles: [AiProfile, AiProfile] = [
      humanProfile(home, difficulty),   // D3: same difficulty, zero angular error
      profileFor(away, difficulty),
    ];
    const match: MatchState = createMatch([home, away], FORMATIONS, PITCH, profiles);
    match.formationIndex[HUMAN_TEAM] = homeFormation;
    match.formationIndex[CPU_TEAM] = awayFormation;

    const pad = createPadState(homeStrategy, homeFormation);
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    const cpuState: AiState = createAiState();

    const cam: Camera = createCamera();
    centreCamera(cam, match.ball.x, match.ball.y, PITCH);

    const budget = createStepBudget();
    const plan = createFramePlan();
    const captions = createCaptionState();
    const watch = createMatchWatch();
    const viewRect = createMinimapRect();

    const ambienceMarks = createAmbienceMarks();
    let ambienceCount = planHalfAmbience(matchSeed, 1, ambienceMarks);
    let ambienceIndex = 0;
    let ambienceHalf: 1 | 2 | 3 = 1;

    let accumulatorMs = 0;
    let lastTs = 0;
    let started = false;
    let sfxReady = false;
    let endFired = false;
    let blocked = false;               // the viewport guard tripped
    let shootoutTaken = -1;            // to detect a new kick of the shootout
    let shootoutSudden = false;        // the label also changes when sudden death starts
    let cachedShootoutLabel = '';
    let reportedHome = -1;
    let reportedAway = -1;
    let reportedClock = '';
    let keeperHoldSteps = 0;            // S-SC3's countdown, see KEEPER_HOLD_STEPS

    function reportHud(): void {
      const homeScore = match.score[HUMAN_TEAM];
      const awayScore = match.score[CPU_TEAM];
      if (homeScore !== reportedHome || awayScore !== reportedAway) {
        reportedHome = homeScore;
        reportedAway = awayScore;
        const cb = onScoreChangeRef.current;
        if (cb !== undefined) cb(homeScore, awayScore);
      }
      const clock = clockText(match);
      if (clock !== reportedClock) {
        reportedClock = clock;
        const cb = onClockChangeRef.current;
        if (cb !== undefined) cb(clock);
      }
    }

    // The caption that is showing NOW is the trigger, so the sound and the words
    // always agree, and only on the step it starts showing. The edge rule itself
    // lives in sfx-map (captionSfxOnEdge, tested there) because there are three
    // callers of it: the loop's step, the captions-only step, and the viewport
    // guard, which pushes its captions outside the loop.
    function playCaptionEdge(before: ShowingCaption): void {
      const name = captionSfxOnEdge(before, captions.kind);
      if (name !== 'none') sfxVaultWorldCup.play(name);
    }

    // ONE simulation step: the CPU decides first with its own rng, then the engine
    // runs, then the screen reads what happened. `first` is false from the second
    // step of a frame on, which is what keeps a single tap from firing five shots.
    function runStep(first: boolean): void {
      padToTeamInput(pad, first, inputs[HUMAN_TEAM]);
      decideTeamInput(match, CPU_TEAM, match.profiles[CPU_TEAM], cpuState, cpuRng, inputs[CPU_TEAM]);
      stepMatch(match, inputs, matchRng);

      // 1. The ball being struck (audio table: ActionEvent 'shot' with ok).
      if (shotFiredThisStep(match)) sfxVaultWorldCup.play('kick');
      // 2. The first link of the goal chain, the moment the ball crosses the line.
      //    goalNetDue reads the EDGE of scratch.call against `watch`, which still
      //    holds the previous step here (updateWatch runs at point 7): the call is a
      //    level that stands for 421 measured steps, and reading it as one played
      //    842 overlapping mp3 per goal. It fires in the shootout too -- the spec
      //    ties goal_net to the call, not to the phase.
      if (goalNetDue(match, watch)) {
        sfxVaultWorldCup.play('goal_net');
        sfxVaultWorldCup.play('whistle_foul');
      }
      // 2b. The two half-endings the caption map cannot see: a level second half
      //     (endHalf jumps to half 3 + kickoff without ever being 'half-time') and
      //     the end of the extra time ('golden-goal' -> 'shootout'). Same `watch`,
      //     same reason it still holds the previous step.
      if (halfEndWhistleDue(match, watch)) sfxVaultWorldCup.play('whistle_end');
      // 3. The third link, part way into the celebration. KNOWN GAP carried from the
      //    Task 8-4 review (its minor 1): goalCrowdDue needs phase 'goal', which a
      //    golden goal (straight to 'over') and a shootout goal (never leaves
      //    'shootout') never reach -- those two get net + shout and no crowd. Left as
      //    the brief has it and listed for QA rather than patched blind here.
      if (goalCrowdDue(match)) sfxVaultWorldCup.play('goal_crowd');
      // 4. A new kick of the shootout starts its countdown: the start whistle again
      //    (the spec's audio table whistles every shootout kick, not just the first).
      //    `firstKick` skips the FIRST kick of all: endExtraTime sets the phase and
      //    calls startShootoutKick in the same step, so the PENALTIS caption is
      //    whistling whistle_start already and this would be the second one three
      //    frames later. Same reason PRÓRROGA swallows INICIO in collectCaptions.
      const sh = match.shootout;
      if (sh !== null) {
        const takenNow = sh.taken[0] + sh.taken[1];
        const kickEdge = takenNow !== shootoutTaken;
        // Carried from the Task 8-3 review (its minor 3): the label allocates, so it
        // is cached -- and recomputed on the sudden-death flip too, which changes the
        // words with the kick count standing still.
        if (kickEdge || sh.suddenDeath !== shootoutSudden) {
          shootoutSudden = sh.suddenDeath;
          cachedShootoutLabel = shootoutRoundLabel(sh);
        }
        if (kickEdge) {
          const firstKick = shootoutTaken < 0;
          shootoutTaken = takenNow;
          if (!firstKick && match.phase === 'shootout') sfxVaultWorldCup.play('whistle_start');
        }
      }
      // 5. The crowd bed: 2-3 bursts per half, from its own stream (spec).
      if (match.half !== ambienceHalf) {
        ambienceCount = planHalfAmbience(matchSeed, match.half, ambienceMarks);
        ambienceIndex = 0;
        ambienceHalf = match.half;
      }
      if (isOpenPlay(match.phase) && ambienceDue(ambienceMarks, ambienceCount, ambienceIndex, match.halfStep)) {
        ambienceIndex++;
        sfxVaultWorldCup.play('crowd');
      }

      // 6. S-SC3's countdown: the screen's own elapsed count while the human keeper
      //    holds the ball, reset the instant the flag drops (a new hold restarts it).
      //    CAPPED at KEEPER_HOLD_STEPS: in the shootout the engine leaves the ball
      //    with the keeper who just saved, for as long as it likes, and an uncapped
      //    count would run the countdown into negative numbers.
      if (keeperHoldsBall(match, HUMAN_TEAM)) {
        if (keeperHoldSteps < KEEPER_HOLD_STEPS) keeperHoldSteps++;
      } else keeperHoldSteps = 0;

      // 7. Captions, from the transition detector. ONE sound check, after
      //    stepCaption: it covers both a caption appearing out of nothing (the queue
      //    was empty) and the hand-over of the queue (GOL -> FINAL -> GANADOR),
      //    because in both the showing caption differs from the one this step began
      //    with. A caption merely QUEUED behind another leaves `kind` alone and stays
      //    silent until its turn, which is when its whistle belongs.
      const before = captions.kind;
      collectCaptions(match, watch, HUMAN_TEAM, captions);
      updateWatch(match, watch);
      stepCaption(captions);
      playCaptionEdge(before);

      // 8. The camera. During the shootout the target is the alternating penalty
      //    spot and the cut is instant (S-SC8): panning 1600 units between kicks
      //    would take longer than the kick itself.
      const tx = cameraTargetX(match);
      const ty = cameraTargetY(match);
      if (match.phase === 'shootout') centreCamera(cam, tx, ty, PITCH);
      else followCamera(cam, tx, ty, PITCH, CAMERA_LAG);

      // 9. The end, exactly once.
      if (match.phase === 'over' && !endFired) {
        endFired = true;
        onMatchEndRef.current(winnerOf(match));
      }
    }

    // The caption clock on its own, for the frames where the simulation has stopped
    // but the screen has not: a finished match and a blocked viewport. Same single
    // check as point 7 of runStep, so the FINAL whistle still sounds when the queue
    // hands over from GOL to FINAL after the last step of the match.
    function stepCaptionsOnly(steps: number): void {
      for (let i = 0; i < steps; i++) {
        const before = captions.kind;
        stepCaption(captions);
        playCaptionEdge(before);
      }
    }

    function update(frameMs: number): void {
      // planFrame owns the three modes, the accumulator and the pad-advance guard
      // (match-loop.ts, tested there: a paused frame banks no time, and a frame that
      // ran no step may not consume a pad edge -- H3).
      accumulatorMs = planFrame(match.phase, pausedRef.current, blocked, accumulatorMs, frameMs, budget, plan);
      if (plan.mode === 'frozen') return;
      if (plan.mode === 'captions-only') {
        stepCaptionsOnly(plan.steps);
        return;
      }
      for (let i = 0; i < plan.steps; i++) runStep(i === 0);
      if (plan.advancePad) padAdvance(pad);
      reportHud();
    }

    function drawPitch(): void {
      // Grass, in world-aligned stripes so the camera movement is legible.
      ctx.fillStyle = GRASS_DARK;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const first = Math.floor(cam.x / STRIPE_WIDTH);
      const last = Math.ceil((cam.x + VIEW_W) / STRIPE_WIDTH);
      ctx.fillStyle = GRASS_LIGHT;
      for (let i = first; i <= last; i++) {
        if ((i & 1) === 0) continue;
        ctx.fillRect(toScreenX(cam, i * STRIPE_WIDTH), 0, STRIPE_WIDTH, VIEW_H);
      }

      const p = PITCH;
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 3;
      // Touchlines and goal lines.
      ctx.strokeRect(toScreenX(cam, 0), toScreenY(cam, 0), p.width, p.height);
      // Halfway line.
      ctx.beginPath();
      ctx.moveTo(toScreenX(cam, p.width / 2), toScreenY(cam, 0));
      ctx.lineTo(toScreenX(cam, p.width / 2), toScreenY(cam, p.height));
      ctx.stroke();
      // Centre circle and spot.
      ctx.beginPath();
      ctx.arc(toScreenX(cam, p.width / 2), toScreenY(cam, p.height / 2), p.centerCircleRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = LINE;
      ctx.beginPath();
      ctx.arc(toScreenX(cam, p.width / 2), toScreenY(cam, p.height / 2), SPOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // The two ends: big area, small area, penalty spot and the goal mouth.
      for (let side = 0; side < 2; side++) {
        const goalX = side === 0 ? 0 : p.width;
        const dir = side === 0 ? 1 : -1;
        const midY = p.height / 2;
        ctx.strokeStyle = LINE;
        ctx.strokeRect(
          toScreenX(cam, goalX + (dir === 1 ? 0 : -p.bigAreaDepth)),
          toScreenY(cam, midY - p.bigAreaWidth / 2),
          p.bigAreaDepth,
          p.bigAreaWidth,
        );
        ctx.strokeRect(
          toScreenX(cam, goalX + (dir === 1 ? 0 : -p.smallAreaDepth)),
          toScreenY(cam, midY - p.smallAreaWidth / 2),
          p.smallAreaDepth,
          p.smallAreaWidth,
        );
        ctx.fillStyle = LINE;
        ctx.beginPath();
        ctx.arc(toScreenX(cam, goalX + dir * p.penaltySpotDist), toScreenY(cam, midY), SPOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        // The goal itself: a white mouth 30 units deep behind the line.
        ctx.fillStyle = GOAL_MOUTH;
        ctx.fillRect(
          toScreenX(cam, goalX + (dir === 1 ? -GOAL_MOUTH_DEPTH : 0)),
          toScreenY(cam, midY - p.goalWidth / 2),
          GOAL_MOUTH_DEPTH,
          p.goalWidth,
        );
      }
    }

    // The parked fifteen of the shootout must be drawn STANDING AND STILL (stage B2
    // §8): placeAroundCentreSpot leaves vx/vy at zero but does NOT clear facing,
    // downUntilStep, tackleStepsLeft or chargeSteps, so a player who was mid-slide
    // when the extra time ended would otherwise stay frozen in that pose for the
    // whole shootout. The screen ignores those fields during the shootout instead of
    // the engine clearing them (carries #2 and #4 -- see the M-list of the report).
    //
    // Two different exclusions, on purpose:
    //   · `parked` — the fifteen in the centre circle: no facing stick either, they
    //     are scenery. The taker and the two keepers are NOT parked, because their
    //     direction is the one thing the player has to read.
    //   · `down`   — nobody is drawn lying down during the shootout, THE TAKER
    //     INCLUDED. The B2 report's Minor 2 is precisely that the first taker may
    //     still be on the ground (or sliding) if the extra time ran out mid-tackle,
    //     probe P6(1) -- so leaving him out of the exclusion would draw a penalty
    //     being taken by a man lying flat.
    function drawPlayer(p: PlayerState, cursor: boolean): void {
      if (!isOnScreen(cam, p.x, p.y, PLAYER_RADIUS * 3)) return;
      const x = toScreenX(cam, p.x);
      const y = toScreenY(cam, p.y);
      const kit = match.teams[p.team].kit;
      const shootout = match.phase === 'shootout';
      const parked = shootout && p.id !== (match.shootout?.takerId ?? -1) && p.role !== 'gk';
      const down = !shootout && isPlayerDown(p, match.stepCount);

      ctx.fillStyle = SHADOW;
      ctx.beginPath();
      ctx.ellipse(x, y + PLAYER_RADIUS * 0.6, PLAYER_RADIUS, PLAYER_RADIUS * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // A player on the ground is drawn flat: it is a whole second of the match and
      // the player has to be able to see why nothing responds.
      ctx.fillStyle = p.role === 'gk' ? kit.secondary : kit.primary;
      ctx.beginPath();
      if (down) ctx.ellipse(x, y, PLAYER_RADIUS * 1.3, PLAYER_RADIUS * 0.55, 0, 0, Math.PI * 2);
      else ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // The trim: shirt collar for the outfield, a full ring for the keeper, so the
      // one player who is never controllable is unmistakable.
      ctx.strokeStyle = p.role === 'gk' ? kit.primary : kit.secondary;
      ctx.lineWidth = p.role === 'gk' ? 3 : 2;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER_RADIUS - 1, 0, Math.PI * 2);
      ctx.stroke();

      // Facing: a short stick, so the pass cone and the slide direction are readable.
      if (!down && !parked) {
        ctx.strokeStyle = FACING_STICK;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + p.facingX * PLAYER_RADIUS * 1.6, y + p.facingY * PLAYER_RADIUS * 1.6);
        ctx.stroke();
      }

      // The fixed goal celebration (spec: always the same one, no variations): the
      // scoring team throws its arms up, the conceding team drops its head.
      if (match.phase === 'goal' && match.lastGoalTeam >= 0) {
        ctx.strokeStyle = p.team === match.lastGoalTeam ? HUD_ACCENT : HEADS_DOWN;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (p.team === match.lastGoalTeam) {
          ctx.arc(x, y - PLAYER_RADIUS, PLAYER_RADIUS * 0.9, Math.PI, Math.PI * 2);
        } else {
          ctx.arc(x, y + PLAYER_RADIUS * 0.2, PLAYER_RADIUS * 0.7, 0, Math.PI);
        }
        ctx.stroke();
      }

      if (cursor) {
        ctx.strokeStyle = CURSOR_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 7, y - PLAYER_RADIUS - 12);
        ctx.lineTo(x + 7, y - PLAYER_RADIUS - 12);
        ctx.lineTo(x, y - PLAYER_RADIUS - 3);
        ctx.closePath();
        ctx.stroke();

        // R33 (Paco, 07-sep), replacing the continuous yellow bar the first draft
        // put in the HUD: THREE notches, here, next to the player who is charging.
        // chargeSegments reads the engine's own ramp, so a notch always means the
        // same shot -- 1 = tap (700), 2 = half (~825), 3 = full (950) -- and the
        // player can deliberately aim for one instead of guessing at a bar. They
        // only appear while J is actually held: three empty boxes floating over the
        // cursor the rest of the match would be noise.
        //
        // I3 (final review): `chargeSteps > 0` alone is NOT "J is held". A pause or
        // an alt-tab lifts the button through padClear/padBlur, which deliberately
        // produce no 'released' edge, so the engine keeps the armed charge (its half
        // of the fix is M9 in actions.ts) and the notches stayed lit next to a player
        // who was touching nothing. The pad is the truth about the key, and it is
        // also what keeps a long pass charging on K from lighting the shot notches.
        if (p.chargeSteps > 0 && pad.a !== 'up') {
          const lit = chargeSegments(p.chargeSteps);
          const nx = x - NOTCH_TOTAL_W / 2;
          const ny = y - PLAYER_RADIUS + NOTCH_DY;
          ctx.strokeStyle = NOTCH_FRAME;
          ctx.lineWidth = 1;
          ctx.strokeRect(nx - 1, ny - 1, NOTCH_TOTAL_W + 2, NOTCH_H + 2);
          for (let i = 0; i < SHOT_CHARGE_SEGMENTS; i++) {
            ctx.fillStyle = i < lit ? HUD_ACCENT : NOTCH_EMPTY;
            ctx.fillRect(nx + i * (NOTCH_W + NOTCH_GAP), ny, NOTCH_W, NOTCH_H);
          }
        }
      }

      if (isSprinting(p)) {
        ctx.strokeStyle = SPRINT_RING;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER_RADIUS + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawPlayers(): void {
      const cursorId = cursorPlayerId(match, HUMAN_TEAM);
      for (let i = 0; i < match.players.length; i++) {
        drawPlayer(match.players[i], match.players[i].id === cursorId);
      }
    }

    function drawBall(): void {
      const b = match.ball;
      if (!isOnScreen(cam, b.x, b.y, BALL_MARGIN)) return;
      const x = toScreenX(cam, b.x);
      const y = toScreenY(cam, b.y);
      // The shadow stays on the ground and the ball rises with z: it is the only cue
      // that a long pass is going over the defenders' heads.
      ctx.fillStyle = SHADOW;
      ctx.beginPath();
      ctx.ellipse(x, y, BALL_RADIUS, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = BALL_COLOR;
      ctx.beginPath();
      ctx.arc(x, y - b.z * 0.35, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = BALL_TRIM;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // The set piece: the five-second countdown and the direction the d-pad is aiming.
    // Gate 4 of the stage B report is paid here -- the hint says the buttons do
    // nothing during the countdown, because stepSetPiece only reads the d-pad.
    function drawSetPiece(): void {
      const sp = match.setPiece;
      if (sp === null) return;
      const x = toScreenX(cam, sp.x);
      const y = toScreenY(cam, sp.y);
      ctx.strokeStyle = HUD_ACCENT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + sp.dirX * 70, y + sp.dirY * 70);
      ctx.stroke();
      ctx.fillStyle = HUD_ACCENT;
      ctx.font = FONT_COUNTDOWN;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(smallNumber(countdownSeconds(sp.stepsLeft)), x, y - 46);
      if (sp.kind === 'penalty') {
        // A penalty is aimed with the VERTICAL axis only (stepSetPiece reads input.dy).
        ctx.strokeStyle = PENALTY_MARK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y + sp.side * 40, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawMinimap(): void {
      ctx.fillStyle = MINIMAP_BG;
      ctx.fillRect(MINIMAP_X, MINIMAP_Y, MINIMAP_W, MINIMAP_H);
      ctx.strokeStyle = MINIMAP_FRAME;
      ctx.lineWidth = 1;
      ctx.strokeRect(MINIMAP_X, MINIMAP_Y, MINIMAP_W, MINIMAP_H);
      ctx.beginPath();
      ctx.moveTo(MINIMAP_X + MINIMAP_W / 2, MINIMAP_Y);
      ctx.lineTo(MINIMAP_X + MINIMAP_W / 2, MINIMAP_Y + MINIMAP_H);
      ctx.stroke();

      // Criterion 13: all eighteen, always -- this is the context the camera takes away.
      for (let i = 0; i < match.players.length; i++) {
        const p = match.players[i];
        ctx.fillStyle = match.teams[p.team].kit.primary;
        ctx.beginPath();
        ctx.arc(
          MINIMAP_X + minimapX(PITCH, p.x),
          MINIMAP_Y + minimapY(PITCH, p.y),
          p.role === 'gk' ? MINIMAP_DOT_GK : MINIMAP_DOT_PLAYER,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = BALL_COLOR;
      ctx.beginPath();
      ctx.arc(
        MINIMAP_X + minimapX(PITCH, match.ball.x),
        MINIMAP_Y + minimapY(PITCH, match.ball.y),
        MINIMAP_DOT_BALL,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      minimapViewRect(cam, PITCH, viewRect);
      ctx.strokeStyle = HUD_ACCENT;
      ctx.lineWidth = 1;
      ctx.strokeRect(MINIMAP_X + viewRect.x, MINIMAP_Y + viewRect.y, viewRect.w, viewRect.h);
    }

    function drawHud(): void {
      ctx.fillStyle = HUD_BG;
      ctx.fillRect(0, 0, VIEW_W, HUD_H);
      ctx.textBaseline = 'middle';

      ctx.font = FONT_TEAM;
      ctx.textAlign = 'left';
      ctx.fillStyle = match.teams[HUMAN_TEAM].kit.primary;
      ctx.fillText(match.teams[HUMAN_TEAM].name, 12, HUD_H / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = match.teams[CPU_TEAM].kit.primary;
      ctx.fillText(match.teams[CPU_TEAM].name, VIEW_W - 12, HUD_H / 2);

      ctx.textAlign = 'center';
      ctx.fillStyle = HUD_TEXT;
      ctx.font = FONT_SCORE;
      ctx.fillText(smallNumber(match.score[HUMAN_TEAM]), VIEW_W / 2 - 52, HUD_H / 2);
      ctx.fillText(smallNumber(match.score[CPU_TEAM]), VIEW_W / 2 + 52, HUD_H / 2);
      ctx.font = FONT_CLOCK;
      ctx.fillStyle = HUD_ACCENT;
      ctx.fillText(clockText(match), VIEW_W / 2, HUD_H / 2 - 7);
      ctx.font = FONT_HALF;
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(halfLabel(match), VIEW_W / 2, HUD_H / 2 + 12);

      // The shootout keeps its OWN scoreboard: match.score stays level and must not
      // be touched (stage B2 §8, assumption S-PK12).
      const sh = match.shootout;
      if (sh !== null) {
        ctx.font = FONT_SHOOTOUT;
        ctx.fillStyle = HUD_ACCENT;
        ctx.fillText(cachedShootoutLabel, VIEW_W / 2, HUD_H + 16);
        ctx.fillStyle = HUD_TEXT;
        // The one template of the draw path, and it only runs in a phase with no
        // physics at all: the shootout is a still ball and a countdown.
        ctx.fillText(
          `${smallNumber(sh.scored[HUMAN_TEAM])} - ${smallNumber(sh.scored[CPU_TEAM])}`,
          VIEW_W / 2,
          HUD_H + 34,
        );
        // The engine's own four-second window for the ball to settle after a kick
        // (SHOOTOUT_RESOLVE_STEPS, exported for exactly this). Without it those four
        // seconds of a still ball read as a hang.
        if (sh.resolveStepsLeft > 0) {
          ctx.fillStyle = BAR_EMPTY;
          ctx.fillRect(VIEW_W / 2 - 60, HUD_H + 48, 120, 4);
          ctx.fillStyle = HUD_ACCENT;
          ctx.fillRect(VIEW_W / 2 - 60, HUD_H + 48, (sh.resolveStepsLeft / SHOOTOUT_RESOLVE_STEPS) * 120, 4);
        }
      }

      // Formation, strategy and the sprint bar, bottom left.
      ctx.textAlign = 'left';
      ctx.font = FONT_HALF;
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(FORMATIONS[match.formationIndex[HUMAN_TEAM]].name, 12, VIEW_H - 40);
      ctx.fillText(STRATEGY_LABEL[match.strategies[HUMAN_TEAM]], 12, VIEW_H - 26);
      ctx.fillStyle = HUD_DIM;
      ctx.fillText(FORMATION_HINT, 12, VIEW_H - 12);

      // Only the SPRINT bar lives here now. The shot charge moved next to the player
      // as three notches (R33) -- see drawPlayer.
      const controlled = match.players[cursorPlayerId(match, HUMAN_TEAM)];
      const bx = 12;
      const by = VIEW_H - 58;
      ctx.fillStyle = BAR_EMPTY;
      ctx.fillRect(bx, by, BAR_W, BAR_H);
      ctx.fillStyle = SPRINT_BAR;
      ctx.fillRect(bx, by, BAR_W * sprintBarFraction(controlled), BAR_H);

      // Gate 4: during a countdown the buttons do nothing. Say it, or the player
      // hammers them believing they are broken.
      if (buttonsIdle(match)) {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HINT_TEXT;
        ctx.fillText(HINT_AIM, VIEW_W / 2, VIEW_H - 14);
      }

      // S-SC3 (confirmed by owner 2026-09-07): two seconds in which the d-pad and the
      // buttons belong to the keeper, with a countdown -- KEEPER_HOLD_STEPS is the
      // screen's OWN fixed duration (see its declaration), since the engine exposes
      // only the boolean keeperHoldsBall.
      //
      // isOpenPlay is the second half of the condition and it is NOT redundant:
      // keeperHoldsBall is just `ball.owner === team * TEAM_SIZE`, and in the
      // shootout the human keeper keeps the ball every time he saves a penalty. The
      // notice would then appear in a phase that has no goal kick at all, on top of
      // the TANDA n/5 label (same y, HUD_H + 16), with a countdown frozen at 0.
      if (isOpenPlay(match.phase) && keeperHoldsBall(match, HUMAN_TEAM)) {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HUD_ACCENT;
        const left = countdownSeconds(KEEPER_HOLD_STEPS - keeperHoldSteps);
        // The second template of the draw path, and like the other one it runs only
        // in a stopped two seconds, never in open play with the ball moving.
        ctx.fillText(KEEPER_HINT + smallNumber(left), VIEW_W / 2, HUD_H + 16);
      }
    }

    function drawCaption(): void {
      if (captions.kind === 'none') return;
      ctx.fillStyle = CAPTION_BG;
      ctx.fillRect(0, CAPTION_Y, VIEW_W, CAPTION_H);
      ctx.strokeStyle = HUD_ACCENT;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, CAPTION_Y, VIEW_W, CAPTION_H);
      ctx.font = FONT_CAPTION;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = HUD_ACCENT;
      ctx.fillText(CAPTION_TEXT[captions.kind], VIEW_W / 2, CAPTION_Y + CAPTION_H / 2);
    }

    // The viewport guard, drawn instead of a frozen canvas. S-SC12: the match has
    // been abandoned, the EMPATE caption is on its way through the queue, and this
    // panel is what turns "the game stopped" into something the player can act on.
    // The threshold comes from viewport-guard's own constants, never from a literal.
    function drawBlocked(): void {
      if (!blocked) return;
      // BLOCKED_Y sits BELOW the caption band (CAPTION_Y + CAPTION_H) on purpose:
      // the panel must not cover the EMPATE the same event produces.
      ctx.fillStyle = BLOCKED_BG;
      ctx.fillRect(0, BLOCKED_Y, VIEW_W, BLOCKED_H);
      ctx.strokeStyle = HUD_ACCENT;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, BLOCKED_Y, VIEW_W, BLOCKED_H);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = FONT_BLOCKED_TITLE;
      ctx.fillStyle = HUD_ACCENT;
      ctx.fillText(BLOCKED_TITLE, VIEW_W / 2, BLOCKED_Y + 36);
      ctx.font = FONT_BLOCKED_HINT;
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(BLOCKED_HINT, VIEW_W / 2, BLOCKED_Y + 68);
    }

    function draw(): void {
      drawPitch();
      drawPlayers();
      drawBall();
      drawSetPiece();
      drawMinimap();
      drawHud();
      drawCaption();
      // Last, over everything, and only when the guard has tripped. The caption
      // underneath it is still running its queue (planFrame -> 'captions-only'), so
      // EMPATE appears in the band above this panel, which is what QA C6-14 reads.
      drawBlocked();
    }

    let rafId = 0;
    function loop(ts: number): void {
      const frameMs = started ? ts - lastTs : 0;
      lastTs = ts;
      started = true;
      // update() decides for itself what this frame may do (match-loop's planFrame).
      // draw() runs UNCONDITIONALLY: neither the end of the match nor the viewport
      // guard may leave the canvas frozen on the frame before, because the last
      // thing the screen has to say -- GANADOR / ELIMINADO / EMPATE, or the panel
      // that explains the block -- is drawn after both of them happen.
      update(frameMs);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    function isTypingTarget(e: KeyboardEvent): boolean {
      const target = e.target as HTMLElement | null;
      return (
        target !== null &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      );
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (isTypingTarget(e)) return;
      if (e.repeat) return;   // auto-repeat is not a new press: the pad edges are ours
      if (!sfxReady) {
        // Browsers only start audio after a user gesture, and Audio does not exist
        // during SSR: this is the one place init() may be called.
        sfxReady = true;
        sfxVaultWorldCup.init();
        sfxVaultWorldCup.setMuted(mutedRef.current);
      }
      if (pausedRef.current || blocked) return;
      const key = e.key.toLowerCase();
      const padKey = padKeyFor(key);
      if (padKey !== null) {
        e.preventDefault();
        padDown(pad, padKey);
        return;
      }
      if (padChoice(pad, key)) e.preventDefault();
    }

    function handleKeyUp(e: KeyboardEvent): void {
      const padKey = padKeyFor(e.key.toLowerCase());
      if (padKey === null) return;
      // A DIRECTION is always released, in every state: leaving one standing is
      // repo-wide bug #1 (the player runs for ever). A BUTTON released while the
      // game is paused or the viewport guard has tripped is a different matter --
      // handleKeyDown swallowed its keydown, so padUp would leave a 'released' edge
      // sitting in the pad for the engine to consume on resume, firing a shot the
      // player never asked for. padClear lifts it without the edge.
      const isButton = padKey === 'a' || padKey === 'b' || padKey === 'c';
      if (isButton && (pausedRef.current || blocked)) {
        padClear(pad, padKey);
        return;
      }
      padUp(pad, padKey);
    }

    // Repo-wide bug #1 (VaultFighterGame's own comment): alt-tabbing with a
    // direction held would leave the player running for ever.
    function handleBlur(): void {
      padBlur(pad);
    }

    // Spec: "solo desktop; si el viewport se reduce en partida, se para y redirige".
    // Stopping is abandon() -- the transition the engine already has, whose only
    // guard is phase === 'over', so it works from every phase including the
    // shootout. abandon() does not touch the score, so winnerOf(match) after it
    // reflects however the match stood (including a lead, not just level) -- read
    // it the same way the natural-end path does (see point 9 above) so the page's
    // reported winner never disagrees with the canvas caption (S-SC12).
    function handleResize(): void {
      if (blocked) return;
      if (viewportAllowed(window.innerWidth, window.innerHeight)) return;
      blocked = true;
      // ONE pass of the detector right here, outside the loop, and in this exact
      // order. abandon() puts the phase on 'over' between frames, and from the next
      // frame on the simulation no longer runs (planFrame -> 'captions-only'), so if
      // nobody looked at the match now, collectCaptions would never see the
      // transition and the EMPATE that QA C6-14 asks to read on the canvas would
      // never be queued at all. The updateWatch BEFORE abandon() covers the ugly
      // case: a viewport that is already too small at mount, where handleResize runs
      // before the first frame and the watch has never been started -- without it,
      // collectCaptions would take its `!w.started` branch, print INICIO and return.
      updateWatch(match, watch);
      abandon(match);
      // I2 (final review): the same caption-sound check the loop makes, because this
      // pass is the only one this caption ever gets. pushCaption writes `kind`
      // directly when the queue is empty, so by the next frame the edge is gone and
      // the FINAL whistle the spec's audio table asks for at phase === 'over' would
      // never play -- measured whistle_end = 0 in five blocks. EMPATE, queued behind
      // it, is silent by design and rings nothing when its turn comes.
      const beforeBlocked = captions.kind;
      collectCaptions(match, watch, HUMAN_TEAM, captions);
      playCaptionEdge(beforeBlocked);
      updateWatch(match, watch);
      padBlur(pad);   // the keyboard is off from here: nothing may survive the block
      if (!endFired) {
        endFired = true;
        onMatchEndRef.current(winnerOf(match));
      }
    }

    handleResize();
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('resize', handleResize);
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('resize', handleResize);
      sfxVaultWorldCup.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }}
      />
    </div>
  );
}

export default React.memo(VaultWorldCupGame);
