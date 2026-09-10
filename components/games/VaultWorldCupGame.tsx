'use client';

import React, { useEffect, useRef } from 'react';

import { stepsFor } from './football-logic/clock';
import { NORMAL_RULES, abandon, isOpenPlay, type MatchRules } from './football-logic/match';
import {
  modeAwayId, modeBracket, modeDifficulty, modeFxKind, modeHomeId, modeHumanSide, modeMatchLabel, modeMatchSeed, modeRules,
  modeScore, modeScores, modeStatus, modeVictoryScreen, modeVictoryTeamId, modeVictoryTitle, createFriendlyMode, sideIsHuman,
  type FxKind, type GameMode, type HumanSide,
} from './football-logic/mode';
import { PITCH } from './football-logic/pitch';
import { PLAYER_RADIUS, isPlayerDown, isSprinting, type PlayerState } from './football-logic/players';
import { createRng, type Rng } from './football-logic/rng';
import { SHOOTOUT_RESOLVE_STEPS } from './football-logic/set-pieces';
import { FORMATIONS, TEAMS, teamById, type Strategy, type TeamDef } from './football-logic/teams';
import {
  currentDifficulty, humanPairIndex, isStillIn, matchSeedFor, pairAwayId, pairCount, pairHomeId, roundLabel,
} from './football-logic/world-cup';

import {
  CAMERA_LAG, VIEW_H, VIEW_W, cameraTargetX, cameraTargetY, centreCamera, createCamera,
  followCamera, isOnScreen, toScreenX, toScreenY, type Camera,
} from './football-screen/camera';
import {
  CAPTION_TEXT, collectCaptions, createCaptionState, createMatchWatch, resetCaptionState, resetMatchWatch, stepCaption,
  updateWatch, type ShowingCaption,
} from './football-screen/captions';
import {
  MODE_BLURBS, MODE_LIST, MODE_NAMES, createFlowState, flowAfterModeBuilt, flowBuildMode, flowCaptionsDrained,
  flowConfirmBracket, flowConfirmDraw, flowConfirmMode, flowConfirmTeam, flowContinue, flowCpuPair, flowExitMatch,
  flowHumanCount, flowMatchOver, flowMoveBracketChoice, flowMoveMode, flowMoveTeam, flowPickingHuman, flowRecordCpuResult,
  flowSetFormation, flowSkipSpectate, flowSpectateOver,
} from './football-screen/flow';
import {
  BRACKET_ELIMINATED_Y, BRACKET_HINT_Y, BRACKET_PROMPT_Y, BRACKET_ROW_H, DRAW_ROW_H, FORMATION_ROW_Y, MODE_CARD_H,
  MODE_CARD_W, SELECT_HINT_Y, TEAM_CARD_H, TEAM_CARD_W, VICTORY_FIGURE_Y, VICTORY_HINT_Y, VICTORY_TEAM_Y, VICTORY_TITLE_Y,
  bracketRowY, drawColX, drawRowY, modeCardY, teamCardX, teamCardY,
} from './football-screen/flow-layout';
import {
  SHOT_CHARGE_SEGMENTS, buttonsIdle, chargeSegments, clockText, countdownSeconds, cursorPlayerId,
  halfLabel, keeperHoldsBall, shootoutRoundLabel, smallNumber, sprintBarFraction,
} from './football-screen/hud';
import {
  SOLO, TWO_PLAYER_P1, TWO_PLAYER_P2, TWO_PLAYER_TABLES, createPadState, padAdvance, padBlur, padChoice, padClear,
  padDown, padKeyFor, padToTeamInput, padUp, type KeyTable, type PadState,
} from './football-screen/keyboard';
import { SPECTATE_SPEED, createStepBudget } from './football-screen/loop';
import { createFramePlan, planFrame, planHalfAmbience } from './football-screen/match-loop';
import { createMatchRun, finishMatchRun, stepMatchRun, type MatchRun } from './football-screen/match-run';
import {
  MINIMAP_H, MINIMAP_PAD, MINIMAP_W, createMinimapRect, minimapViewRect, minimapX, minimapY,
} from './football-screen/minimap';
import { FX_COLORS, createParticlePool, fxSeedFor, startFx, stepFx } from './football-screen/particles';
import {
  ambienceDue, captionSfxOnEdge, createAmbienceMarks, goalCrowdDue, goalNetDue, halfEndWhistleDue,
  shotFiredThisStep, victoryChantGain,
} from './football-screen/sfx-map';
import { MIN_VIEWPORT_H, MIN_VIEWPORT_W, viewportAllowed } from './football-screen/viewport-guard';
import { sfxVaultWorldCup } from '@/lib/sfx-vault-world-cup';

interface VaultWorldCupGameProps {
  paused: boolean;
  muted?: boolean;
  seed?: number;
  onScoreChange?: (home: number, away: number) => void;
  onClockChange?: (label: string) => void;
  onStatusChange?: (label: string) => void;
  onGameOver?: (score: number) => void;
  onVictory?: (score: number) => void;
}

// ── The two display slots of the scoreboard. NOT "human" and "CPU" any more: who is
// human is modeHumanSide(mode), read per match (step 9). Home is drawn on the left.
const HOME = 0 as const;
const AWAY = 1 as const;
// Stage C assumption S-SC3 (confirmed by owner 2026-09-07): the screen's own fixed
// keeper-hold countdown, see the step-8 comment on drawHud.
const KEEPER_HOLD_STEPS = stepsFor(2);
// The bank, as ids, once: the selector and the draw read it by index.
const BANK_IDS: readonly string[] = TEAMS.map((t) => t.id);
const SOLO_TABLES: readonly [KeyTable, KeyTable] = [SOLO, SOLO];
const ZERO_FORMATIONS: readonly [number, number] = [0, 0];

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
const BLOCKED_TITLE = 'AGRANDA LA VENTANA';
const BLOCKED_HINT = `MÍNIMO ${MIN_VIEWPORT_W} × ${MIN_VIEWPORT_H}`;
const KEEPER_HINT = 'SAQUE: K CORTO · J LARGO · ';
const KEEPER_HINT_P1 = 'SAQUE: V CORTO · C LARGO · ';
const STRATEGY_LABEL: Readonly<Record<Strategy, string>> = { attack: 'ATAQUE', neutral: 'NEUTRAL', defend: 'DEFENSA' };
// One hint per key table (G9-2), chosen by table identity in draw(): no string is built.
const FORMATION_HINT_SOLO = '1/2/3 ALINEACIÓN · 4/5/6 ESTRATEGIA';
const FORMATION_HINT_P1 = '1/2/3 ALINEACIÓN · 4/5/6 ESTRATEGIA';
const FORMATION_HINT_P2 = "7/8/9 ALINEACIÓN · 0 ' ¡ ESTRATEGIA";
// Flow screens.
const MENU_BG = '#05050a';
const CARD_BG = 'rgba(20,20,30,0.85)';
const CARD_BORDER = '#444455';
const DIM_TEXT = 'rgba(232,244,255,0.4)';
const MODE_TITLE = 'ELIGE MODO';
const MODE_HINT = 'ARRIBA / ABAJO · A (J) PARA CONFIRMAR';
const TEAM_TITLE_SOLO = 'ELIGE TU SELECCIÓN';
const TEAM_TITLES_TWO: readonly [string, string] = ['JUGADOR 1 (WASD): ELIGE TU SELECCIÓN', 'JUGADOR 2 (FLECHAS): ELIGE TU SELECCIÓN'];
const TEAM_HINT_SOLO = 'CRUCETA · A (J) CONFIRMA · 1/2/3 ALINEACIÓN';
const TEAM_HINTS_TWO: readonly [string, string] = ['WASD · C CONFIRMA · 1/2/3 ALINEACIÓN', 'FLECHAS · J CONFIRMA · 7/8/9 ALINEACIÓN'];
const TAKEN_TAG = 'J1';
const FORMATION_ROW_LABEL = 'ALINEACIÓN:';
// '1 NORMAL', '2 OFENSIVA', '3 DEFENSIVA' for the solo/J1 keys and '7 …' for J2's, built once.
function buildFormationLabels(keys: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < FORMATIONS.length; i++) out.push(`${keys[i]} ${FORMATIONS[i].name}`);
  return out;
}
const FORMATION_LABELS_SOLO: readonly string[] = buildFormationLabels(SOLO.formation);
const FORMATION_LABELS_P2: readonly string[] = buildFormationLabels(TWO_PLAYER_P2.formation);
const DRAW_TITLE = 'SORTEO DEL MUNDIAL';
const DRAW_HINT = 'A (J) PARA CONTINUAR';
const YOU_TAG = 'TÚ';
const BRACKET_TITLE_PREFIX = 'CUADRO · ';
const BRACKET_VS = ' VS ';
const BRACKET_SCORE_SEP = ' - ';
const BRACKET_NEXT_PREFIX = 'PRÓXIMO: ';
const BRACKET_YOURS_PREFIX = 'TU PARTIDO: ';
const BRACKET_ELIMINATED_PREFIX = 'ELIMINADOS: ';
const BRACKET_LIST_SEP = ' · ';
const BRACKET_VER = 'VER';
const BRACKET_SALTAR = 'SALTAR';
const BRACKET_CHOICE_HINT = 'IZQ / DER · A (J) CONFIRMA';
const BRACKET_PLAY_HINT = 'A (J) PARA JUGAR';
const SPECTATE_BANNER = 'PARTIDO DE LA CPU · X4 · A (J) SALTA AL RESULTADO';
const TRAINING_HINT = 'R PARA SALIR';
const VICTORY_HINT = 'A (J) · CONTINUAR';
const STATUS_SELECTOR = 'SELECTOR';
const STATUS_VICTORY = 'VICTORIA';
const CUP_COLOR = '#ffcf3a';
const SKIN_COLOR = '#f1c27d';
const FONT_MENU_TITLE = 'bold 26px monospace';
const FONT_MENU_ITEM = 'bold 22px monospace';
const FONT_MENU_BLURB = 'bold 11px monospace';
const FONT_VICTORY_TITLE = 'bold 44px monospace';
const FONT_VICTORY_TEAM = 'bold 30px monospace';

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

function VaultWorldCupGame({
  paused,
  muted = false,
  seed,
  onScoreChange,
  onClockChange,
  onStatusChange,
  onGameOver,
  onVictory,
}: VaultWorldCupGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const mutedRef = useRef(muted);
  const onScoreChangeRef = useRef(onScoreChange);
  const onClockChangeRef = useRef(onClockChange);
  const onStatusChangeRef = useRef(onStatusChange);
  const onGameOverRef = useRef(onGameOver);
  const onVictoryRef = useRef(onVictory);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    mutedRef.current = muted;
    sfxVaultWorldCup.setMuted(muted);
  }, [muted]);

  // The loop never reads props: the callbacks go through refs so a page that
  // re-creates them does not restart the run.
  useEffect(() => {
    onScoreChangeRef.current = onScoreChange;
    onClockChangeRef.current = onClockChange;
    onStatusChangeRef.current = onStatusChange;
    onGameOverRef.current = onGameOver;
    onVictoryRef.current = onVictory;
  }, [onScoreChange, onClockChange, onStatusChange, onGameOver, onVictory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d')!;

    // ── Everything below is created ONCE and mutated in place (criterion 20) ──
    // G9-7: ONE seed per run, read when the mode is built (confirmTeam) -- the only
    // wall-clock read of the whole game. The `seed` prop pins it for QA and replays.
    const fixedSeed = seed;
    let runSeed = 0;
    const flow = createFlowState();
    // Placeholders so nothing below is nullable: replaced by flowBuildMode / startMatch
    // the first time the player confirms. Neither is ever stepped or drawn as such.
    let mode: GameMode = createFriendlyMode('friendly-cpu', TEAMS[0].id, TEAMS[1].id);
    let run: MatchRun = createMatchRun(TEAMS[0], TEAMS[1], 0, 5, [true, false], NORMAL_RULES, ZERO_FORMATIONS);
    let humanSide: HumanSide = 0;
    let victoryScreen = false;
    let speed = 1;
    let spectatePair = -1;
    let matchSeed = 0;

    // Two pads, one per TEAM (not per player): pads[t] drives team t when it is human.
    // The tables say which keys each pad listens to (G9-2).
    const pads: [PadState, PadState] = [createPadState('neutral', 0), createPadState('neutral', 0)];
    let tables: readonly [KeyTable, KeyTable] = SOLO_TABLES;
    const runFormations: [number, number] = [0, 0];
    const cursorIds: [number, number] = [-1, -1];

    const cam: Camera = createCamera();
    const budget = createStepBudget();
    const plan = createFramePlan();
    const captions = createCaptionState();
    const watch = createMatchWatch();
    const viewRect = createMinimapRect();

    const ambienceMarks = createAmbienceMarks();
    let ambienceCount = 0;
    let ambienceIndex = 0;
    let ambienceHalf: 1 | 2 | 3 = 1;

    // The fourth stream and the pool (criterion 20: created once).
    const fxPool = createParticlePool();
    let fxRng: Rng = createRng(0);
    let fxKind: FxKind = 'confetti';
    let victoryTitle = '';
    let victoryTeam: TeamDef = TEAMS[0];

    // The bracket and draw views, resolved ONCE per screen entry (Vault Fighter's
    // refreshBracketView), never per frame. Strings are built here, on the event.
    let bracketTitle = '';
    const bracketRowText: string[] = ['', '', '', ''];
    const bracketRowIsHuman: boolean[] = [false, false, false, false];
    let bracketRows = 0;
    let bracketPrompt = '';
    let bracketEliminated = '';
    let bracketHasChoice = false;
    const drawNames: string[] = ['', '', '', '', '', '', '', ''];
    let drawHumanIndex = -1;

    let accumulatorMs = 0;
    let lastTs = 0;
    let started = false;
    let sfxReady = false;
    let endFired = false;
    let blocked = false;
    let shootoutTaken = -1;
    let shootoutSudden = false;
    let cachedShootoutLabel = '';
    let reportedHome = -1;
    let reportedAway = -1;
    let reportedClock = '';
    let keeperHoldSteps = 0;
    let keeperHoldTeam: 0 | 1 | -1 = -1;

    function teamOf(id: string): TeamDef {
      const def = teamById(TEAMS, id);
      if (def === undefined) throw new Error(`team not in bank: ${id}`);
      return def;
    }

    function reportStatus(label: string): void {
      const cb = onStatusChangeRef.current;
      if (cb !== undefined) cb(label);
    }

    function reportHud(): void {
      const match = run.match;
      const homeScore = match.score[HOME];
      const awayScore = match.score[AWAY];
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

    // ── Starting a match. Reusable for every friendly, every World Cup match and every
    // spectated pair: nothing here remounts (G9-9). Allocates (createMatchRun) on an
    // event, never in a frame.
    function startMatch(
      home: TeamDef, away: TeamDef, seedForMatch: number, difficulty: number, rules: Readonly<MatchRules>,
      side: HumanSide, formations: readonly [number, number], screen: boolean,
    ): void {
      run = createMatchRun(home, away, seedForMatch, difficulty, [sideIsHuman(side, 0), sideIsHuman(side, 1)], rules, formations);
      humanSide = side;
      victoryScreen = screen;
      matchSeed = seedForMatch;
      tables = side === 'both' ? TWO_PLAYER_TABLES : SOLO_TABLES;
      speed = side === 'none' ? SPECTATE_SPEED : 1;
      for (let t = 0; t < 2; t++) {
        padBlur(pads[t]);
        pads[t].formation = formations[t];
        pads[t].strategy = 'neutral';
      }
      centreCamera(cam, run.match.ball.x, run.match.ball.y, PITCH);
      resetCaptionState(captions);
      resetMatchWatch(watch);
      ambienceCount = planHalfAmbience(seedForMatch, 1, ambienceMarks);
      ambienceIndex = 0;
      ambienceHalf = 1;
      accumulatorMs = 0;
      endFired = false;
      shootoutTaken = -1;
      shootoutSudden = false;
      cachedShootoutLabel = '';
      reportedHome = -1;
      reportedAway = -1;
      reportedClock = '';
      keeperHoldSteps = 0;
      keeperHoldTeam = -1;
    }

    // The formation each TEAM starts with: the human's pick for a human team (J1's for
    // the first human, J2's for the second), 3-3-2 for a CPU team (S18: the CPU keeps
    // whatever it is given).
    // Two explicit lines, not a `for (let t …)`: sideIsHuman takes a `0 | 1`, and the
    // counter of a for loop is a `number` (tsc rejects it; no `as` to paper over it).
    function fillRunFormations(side: HumanSide): void {
      runFormations[0] = sideIsHuman(side, 0) ? flow.formation[0] : 0;
      runFormations[1] = sideIsHuman(side, 1) ? flow.formation[side === 'both' ? 1 : 0] : 0;
    }

    function startHumanMatch(): void {
      const side = modeHumanSide(mode);
      fillRunFormations(side);
      startMatch(
        teamOf(modeHomeId(mode)), teamOf(modeAwayId(mode)), modeMatchSeed(mode, runSeed), modeDifficulty(mode),
        modeRules(mode), side, runFormations, modeVictoryScreen(mode),
      );
      reportStatus(modeMatchLabel(mode));
    }

    // G9-3: the CPU pair the bracket points at, either on screen (VER) or headless
    // (SALTAR). SAME startMatch, SAME seed: the result cannot depend on the choice.
    function startCpuPair(): boolean {
      const wc = modeBracket(mode);
      const pair = flowCpuPair(mode);
      if (wc === null || pair === -1) return false;
      spectatePair = pair;
      startMatch(
        teamOf(pairHomeId(wc, pair)), teamOf(pairAwayId(wc, pair)), matchSeedFor(wc.seed, wc.round, pair),
        currentDifficulty(wc), NORMAL_RULES, 'none', ZERO_FORMATIONS, false,
      );
      return true;
    }

    function skipCpuPair(): void {
      if (!startCpuPair()) return;
      finishMatchRun(run);
      flowRecordCpuResult(mode, spectatePair, run.match);
      refreshBracketView();
    }

    // A during a spectated pair (or the viewport guard, S-FL5): finish it headless,
    // record it, back to the bracket. finishMatchRun continues the SAME run from where
    // the screen left it, so the winner is the one SALTAR would have produced.
    function skipSpectate(): void {
      finishMatchRun(run);
      flowRecordCpuResult(mode, spectatePair, run.match);
      flowSkipSpectate(flow);
      refreshBracketView();
    }

    // The human's match ended, naturally (runStep) or by the guard (abandoned). ONCE.
    function endHumanMatch(abandoned: boolean): void {
      if (endFired) return;
      endFired = true;
      flowMatchOver(flow, mode, run.match, abandoned);
    }

    // The captions drained after a match: go where the flow says and set the screen up.
    function afterCaptionsDrained(): void {
      const after = flow.after;
      flowCaptionsDrained(flow);
      if (after === 'victory') startVictory();
      else if (after === 'bracket') refreshBracketView();
      else {
        // Back to the selector after ELIMINADO / EMPATE / a loss. Criterion 19: only
        // the World Cup reports a score, and only when it really ended.
        if (modeScores(mode) && modeStatus(mode) === 'eliminated') {
          const cb = onGameOverRef.current;
          if (cb !== undefined) cb(modeScore(mode));
        }
        reportStatus(STATUS_SELECTOR);
      }
    }

    function startVictory(): void {
      fxKind = modeFxKind(mode);
      victoryTitle = modeVictoryTitle(mode);
      victoryTeam = teamOf(modeVictoryTeamId(mode, run.match));
      startFx(fxPool, fxKind, fxRng);
      accumulatorMs = 0;
      // Spec audio table: the chants under the fireworks at full volume, under the
      // confetti "a volumen bajo". They start here, when the caption queue is already
      // empty, so no whistle and no GANADOR ever overlap them (S-FL3).
      sfxVaultWorldCup.play('chants_victory', victoryChantGain(fxKind));
      if (modeScores(mode)) {
        const cb = onVictoryRef.current;
        if (cb !== undefined) cb(modeScore(mode));
      }
      reportStatus(STATUS_VICTORY);
    }

    // CONTINUAR: cut the chants and back to the selector (spec).
    function continueFromVictory(): void {
      sfxVaultWorldCup.stop('chants_victory');
      flowContinue(flow);
      reportStatus(STATUS_SELECTOR);
    }

    // A on the team selector: J1 (and J2 in the two-player mode), then the mode is
    // built -- the one place, once per run (Vault Fighter's confirmSelection).
    function confirmTeam(): void {
      const result = flowConfirmTeam(flow, BANK_IDS.length);
      if (result !== 'done') return;
      runSeed = fixedSeed ?? Date.now();          // the one Date.now() of the whole game (G9-7)
      mode = flowBuildMode(flow, BANK_IDS, runSeed);
      fxRng = createRng(fxSeedFor(runSeed));      // the fourth stream, never the match's
      flowAfterModeBuilt(flow, mode);
      if (modeBracket(mode) === null) startHumanMatch();
      else refreshDrawView();
    }

    function refreshDrawView(): void {
      const wc = modeBracket(mode);
      if (wc === null) return;
      for (let i = 0; i < wc.bracket.length; i++) drawNames[i] = teamOf(wc.bracket[i]).name;
      drawHumanIndex = wc.bracket.indexOf(wc.humanId);
    }

    // Resolved once per entry to the bracket screen and once per VER/SALTAR resolution,
    // never per frame (Vault Fighter 973-1000). The strings are built HERE.
    function refreshBracketView(): void {
      const wc = modeBracket(mode);
      if (wc === null) return;
      bracketTitle = BRACKET_TITLE_PREFIX + roundLabel(wc);
      bracketRows = pairCount(wc);
      const human = humanPairIndex(wc);
      for (let p = 0; p < bracketRows; p++) {
        const homeName = teamOf(pairHomeId(wc, p)).name;
        const awayName = teamOf(pairAwayId(wc, p)).name;
        bracketRowIsHuman[p] = p === human;
        if (!wc.resolved[p]) {
          bracketRowText[p] = homeName + BRACKET_VS + awayName;
          continue;
        }
        // The result of this pair: the latest of this round with this home.
        let text = homeName + BRACKET_VS + awayName;
        for (let r = wc.resultCount - 1; r >= 0; r--) {
          const res = wc.results[r];
          if (res.round !== wc.round || res.homeId !== pairHomeId(wc, p)) continue;
          text = homeName + ' ' + smallNumber(res.homeGoals) + BRACKET_SCORE_SEP + smallNumber(res.awayGoals) + ' ' + awayName;
          break;
        }
        bracketRowText[p] = text;
      }
      let fallen = '';
      for (let i = 0; i < wc.bracket.length; i++) {
        if (isStillIn(wc, wc.bracket[i])) continue;
        fallen += (fallen === '' ? '' : BRACKET_LIST_SEP) + teamOf(wc.bracket[i]).name;
      }
      bracketEliminated = fallen === '' ? '' : BRACKET_ELIMINATED_PREFIX + fallen;
      const pair = flowCpuPair(mode);
      bracketHasChoice = pair !== -1;
      bracketPrompt = pair === -1
        ? BRACKET_YOURS_PREFIX + teamOf(modeHomeId(mode)).name + BRACKET_VS + teamOf(modeAwayId(mode)).name
        : BRACKET_NEXT_PREFIX + teamOf(pairHomeId(wc, pair)).name + BRACKET_VS + teamOf(pairAwayId(wc, pair)).name;
      reportStatus(roundLabel(wc));
    }

    // A on the bracket: VER, SALTAR or the human's match.
    function confirmBracket(): void {
      const action = flowConfirmBracket(flow, mode);
      if (action === 'spectate') startCpuPair();
      else if (action === 'skip') skipCpuPair();
      else if (action === 'play') startHumanMatch();
    }

    // ONE simulation step. The human pads are sampled into their TeamInputs; the CPU
    // sides decide inside stepMatchRun (team 0 first, own stream). `first` is false from
    // the second step of a frame on (a single tap must not fire five shots).
    function runStep(first: boolean): void {
      const match = run.match;
      if (run.human[0]) padToTeamInput(pads[0], first, run.inputs[0]);
      if (run.human[1]) padToTeamInput(pads[1], first, run.inputs[1]);
      stepMatchRun(run);

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

      // 6. S-SC3's countdown, now for WHICHEVER human keeper holds the ball (0, 1, or
      //    both teams human in the two-player friendly; none in a spectated pair).
      keeperHoldTeam = -1;
      if (run.human[0] && keeperHoldsBall(match, 0)) keeperHoldTeam = 0;
      else if (run.human[1] && keeperHoldsBall(match, 1)) keeperHoldTeam = 1;
      if (keeperHoldTeam !== -1) {
        if (keeperHoldSteps < KEEPER_HOLD_STEPS) keeperHoldSteps++;
      } else keeperHoldSteps = 0;

      // 7. Captions, from the transition detector, seen from the human side of THIS
      //    match; no GANADOR when a victory screen follows (S-FL3).
      const before = captions.kind;
      collectCaptions(match, watch, humanSide, captions, victoryScreen);
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

      // 9. The end, exactly once. A spectated pair is recorded and the flow drains its
      //    FINAL back to the bracket; the human's match goes through the mode.
      if (match.phase === 'over' && !endFired) {
        if (flow.phase === 'spectate') {
          endFired = true;
          flowRecordCpuResult(mode, spectatePair, match);
          flowSpectateOver(flow);
        } else endHumanMatch(false);
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
      const phase = flow.phase;
      if (phase === 'match' || phase === 'spectate' || phase === 'over') {
        // planFrame owns the three modes, the accumulator, the pad-advance guard (H3)
        // and, new in step 9, the x4 of a spectated pair.
        accumulatorMs = planFrame(run.match.phase, pausedRef.current, blocked, accumulatorMs, frameMs, budget, plan, speed);
        if (plan.mode === 'frozen') return;
        if (plan.mode === 'captions-only') {
          stepCaptionsOnly(plan.steps);
          // The queue emptied: FINAL (and ELIMINADO / EMPATE) had their three seconds.
          if (phase === 'over' && captions.kind === 'none') afterCaptionsDrained();
          return;
        }
        for (let i = 0; i < plan.steps; i++) runStep(i === 0);
        if (plan.advancePad) {
          padAdvance(pads[0]);
          padAdvance(pads[1]);
        }
        reportHud();
        return;
      }
      if (phase === 'victory') {
        // The effects run at the fixed step too, from their own stream, paused with P.
        accumulatorMs = planFrame('play', pausedRef.current, blocked, accumulatorMs, frameMs, budget, plan, 1);
        if (plan.mode !== 'full') return;
        for (let i = 0; i < plan.steps; i++) stepFx(fxPool, fxKind, fxRng);
        return;
      }
      accumulatorMs = 0;   // the menus step nothing
    }

    function drawPitch(): void {
      // Grass, in world-aligned stripes so the camera movement is legible. (No
      // `const match = run.match` here: drawPitch never reads the match, only the
      // camera and the fixed pitch geometry -- adding it would be an unused local.)
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
      const match = run.match;
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
        if (p.chargeSteps > 0 && pads[p.team].a !== 'up') {
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
      const match = run.match;
      cursorIds[0] = run.human[0] ? cursorPlayerId(match, 0) : -1;
      cursorIds[1] = run.human[1] ? cursorPlayerId(match, 1) : -1;
      for (let i = 0; i < match.players.length; i++) {
        const p = match.players[i];
        drawPlayer(p, p.id === cursorIds[p.team]);
      }
    }

    function drawBall(): void {
      const match = run.match;
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
      const match = run.match;
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
      const match = run.match;
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

    function drawTeamStrip(team: 0 | 1): void {
      const match = run.match;
      const right = team === 1;
      const x = right ? VIEW_W - 12 : 12;
      ctx.textAlign = right ? 'right' : 'left';
      ctx.font = FONT_HALF;
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(FORMATIONS[match.formationIndex[team]].name, x, VIEW_H - 40);
      ctx.fillText(STRATEGY_LABEL[match.strategies[team]], x, VIEW_H - 26);
      ctx.fillStyle = HUD_DIM;
      const table = tables[team];
      ctx.fillText(table === TWO_PLAYER_P2 ? FORMATION_HINT_P2 : table === TWO_PLAYER_P1 ? FORMATION_HINT_P1 : FORMATION_HINT_SOLO, x, VIEW_H - 12);
      const controlled = match.players[cursorPlayerId(match, team)];
      const bx = right ? VIEW_W - 12 - BAR_W : 12;
      const by = VIEW_H - 58;
      ctx.fillStyle = BAR_EMPTY;
      ctx.fillRect(bx, by, BAR_W, BAR_H);
      ctx.fillStyle = SPRINT_BAR;
      ctx.fillRect(bx, by, BAR_W * sprintBarFraction(controlled), BAR_H);
    }

    function drawHud(): void {
      const match = run.match;
      ctx.fillStyle = HUD_BG;
      ctx.fillRect(0, 0, VIEW_W, HUD_H);
      ctx.textBaseline = 'middle';

      ctx.font = FONT_TEAM;
      ctx.textAlign = 'left';
      ctx.fillStyle = match.teams[HOME].kit.primary;
      ctx.fillText(match.teams[HOME].name, 12, HUD_H / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = match.teams[AWAY].kit.primary;
      ctx.fillText(match.teams[AWAY].name, VIEW_W - 12, HUD_H / 2);
      // A bar under the name of each human team: in the World Cup the human may be on
      // the right (S-PK3), and in the two-player friendly both are.
      ctx.fillStyle = HUD_ACCENT;
      if (run.human[HOME]) ctx.fillRect(12, HUD_H - 6, 60, 2);
      if (run.human[AWAY]) ctx.fillRect(VIEW_W - 72, HUD_H - 6, 60, 2);

      ctx.textAlign = 'center';
      ctx.fillStyle = HUD_TEXT;
      ctx.font = FONT_SCORE;
      ctx.fillText(smallNumber(match.score[HOME]), VIEW_W / 2 - 52, HUD_H / 2);
      ctx.fillText(smallNumber(match.score[AWAY]), VIEW_W / 2 + 52, HUD_H / 2);
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
          `${smallNumber(sh.scored[HOME])} - ${smallNumber(sh.scored[AWAY])}`,
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

      if (run.human[0]) drawTeamStrip(0);
      if (run.human[1]) drawTeamStrip(1);

      if (buttonsIdle(match)) {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HINT_TEXT;
        ctx.fillText(HINT_AIM, VIEW_W / 2, VIEW_H - 14);
      }

      // S-SC3, for the human keeper who holds the ball (see runStep point 6). The hint
      // names J1's keys when J1's table is the one in use.
      if (keeperHoldTeam !== -1 && isOpenPlay(match.phase)) {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HUD_ACCENT;
        const left = countdownSeconds(KEEPER_HOLD_STEPS - keeperHoldSteps);
        const hint = tables[keeperHoldTeam] === TWO_PLAYER_P1 ? KEEPER_HINT_P1 : KEEPER_HINT;
        ctx.fillText(hint + smallNumber(left), VIEW_W / 2, HUD_H + 16);
      }

      if (flow.phase === 'spectate') {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HUD_ACCENT;
        ctx.fillText(SPECTATE_BANNER, VIEW_W / 2, HUD_H + 16);
      } else if (!match.rules.timed) {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HUD_DIM;
        ctx.fillText(TRAINING_HINT, VIEW_W / 2, HUD_H + 16);
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

    function drawMenuBackground(title: string): void {
      ctx.fillStyle = MENU_BG;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.font = FONT_MENU_TITLE;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = HUD_ACCENT;
      ctx.fillText(title, VIEW_W / 2, 48);
    }

    function drawHint(text: string, y: number): void {
      ctx.font = FONT_SMALL;
      ctx.textAlign = 'center';
      ctx.fillStyle = HINT_TEXT;
      ctx.fillText(text, VIEW_W / 2, y);
    }

    function drawModeSelect(): void {
      drawMenuBackground(MODE_TITLE);
      const x = (VIEW_W - MODE_CARD_W) / 2;
      for (let i = 0; i < MODE_LIST.length; i++) {
        const y = modeCardY(i);
        const selected = i === flow.modeIndex;
        ctx.fillStyle = CARD_BG;
        ctx.fillRect(x, y, MODE_CARD_W, MODE_CARD_H);
        ctx.strokeStyle = selected ? HUD_ACCENT : CARD_BORDER;
        ctx.lineWidth = selected ? 3 : 1;
        ctx.strokeRect(x, y, MODE_CARD_W, MODE_CARD_H);
        ctx.textAlign = 'center';
        ctx.font = FONT_MENU_ITEM;
        ctx.fillStyle = selected ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(MODE_NAMES[MODE_LIST[i]], VIEW_W / 2, y + 24);
        ctx.font = FONT_MENU_BLURB;
        ctx.fillStyle = selected ? HUD_TEXT : DIM_TEXT;
        ctx.fillText(MODE_BLURBS[MODE_LIST[i]], VIEW_W / 2, y + 48);
      }
      drawHint(MODE_HINT, VIEW_H - 24);
    }

    function drawTeamSelect(): void {
      const two = flowHumanCount(flow) === 2;
      const picking = flowPickingHuman(flow);
      drawMenuBackground(two ? TEAM_TITLES_TWO[picking] : TEAM_TITLE_SOLO);
      for (let i = 0; i < TEAMS.length; i++) {
        const def = TEAMS[i];
        const x = teamCardX(i, TEAMS.length);
        const y = teamCardY(i);
        const selected = i === flow.cursor;
        const taken = two && picking === 1 && i === flow.picked[0];
        ctx.fillStyle = CARD_BG;
        ctx.fillRect(x, y, TEAM_CARD_W, TEAM_CARD_H);
        ctx.strokeStyle = selected ? HUD_ACCENT : CARD_BORDER;
        ctx.lineWidth = selected ? 3 : 1;
        ctx.strokeRect(x, y, TEAM_CARD_W, TEAM_CARD_H);
        // The kit: a shirt block in the primary with a collar band in the secondary.
        ctx.fillStyle = def.kit.primary;
        ctx.fillRect(x + 10, y + 12, 30, 40);
        ctx.fillStyle = def.kit.secondary;
        ctx.fillRect(x + 10, y + 12, 30, 7);
        ctx.font = FONT_HALF;
        ctx.textAlign = 'left';
        ctx.fillStyle = taken ? DIM_TEXT : selected ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(def.name, x + 50, y + TEAM_CARD_H / 2);
        if (taken) {
          ctx.textAlign = 'right';
          ctx.fillStyle = DIM_TEXT;
          ctx.fillText(TAKEN_TAG, x + TEAM_CARD_W - 8, y + 14);
        }
      }
      // G9-5: the formation, one per human, on the human's own number row.
      const labels = two && picking === 1 ? FORMATION_LABELS_P2 : FORMATION_LABELS_SOLO;
      ctx.font = FONT_SMALL;
      ctx.textAlign = 'left';
      ctx.fillStyle = HUD_DIM;
      ctx.fillText(FORMATION_ROW_LABEL, 32, FORMATION_ROW_Y);
      for (let i = 0; i < labels.length; i++) {
        ctx.fillStyle = i === flow.formation[picking] ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(labels[i], 150 + i * 200, FORMATION_ROW_Y);
      }
      drawHint(two ? TEAM_HINTS_TWO[picking] : TEAM_HINT_SOLO, SELECT_HINT_Y);
    }

    function drawDraw(): void {
      drawMenuBackground(DRAW_TITLE);
      ctx.font = FONT_MENU_ITEM;
      for (let i = 0; i < drawNames.length; i++) {
        const you = i === drawHumanIndex;
        ctx.textAlign = 'center';
        ctx.fillStyle = you ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(drawNames[i], drawColX(i), drawRowY(i) + DRAW_ROW_H / 2);
        if (you) {
          ctx.font = FONT_SMALL;
          ctx.fillText(YOU_TAG, drawColX(i) + 130, drawRowY(i) + DRAW_ROW_H / 2);
          ctx.font = FONT_MENU_ITEM;
        }
      }
      drawHint(DRAW_HINT, VIEW_H - 24);
    }

    function drawBracket(): void {
      drawMenuBackground(bracketTitle);
      ctx.font = FONT_MENU_ITEM;
      for (let p = 0; p < bracketRows; p++) {
        const y = bracketRowY(p) + BRACKET_ROW_H / 2;
        ctx.textAlign = 'center';
        ctx.fillStyle = bracketRowIsHuman[p] ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(bracketRowText[p], VIEW_W / 2, y);
        if (bracketRowIsHuman[p]) {
          ctx.font = FONT_SMALL;
          ctx.textAlign = 'left';
          ctx.fillText(YOU_TAG, VIEW_W - 80, y);
          ctx.font = FONT_MENU_ITEM;
        }
      }
      ctx.font = FONT_TEAM;
      ctx.textAlign = 'center';
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(bracketPrompt, VIEW_W / 2, BRACKET_PROMPT_Y);
      if (bracketHasChoice) {
        // VER | SALTAR, the selected one boxed (G9-3).
        const w = 120;
        const h = 34;
        const y = BRACKET_PROMPT_Y + 26;
        for (let i = 0; i < 2; i++) {
          const x = VIEW_W / 2 + (i === 0 ? -w - 10 : 10);
          const selected = flow.bracketChoice === i;
          ctx.fillStyle = CARD_BG;
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = selected ? HUD_ACCENT : CARD_BORDER;
          ctx.lineWidth = selected ? 3 : 1;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = selected ? HUD_ACCENT : HUD_TEXT;
          ctx.fillText(i === 0 ? BRACKET_VER : BRACKET_SALTAR, x + w / 2, y + h / 2);
        }
      }
      if (bracketEliminated !== '') {
        ctx.font = FONT_SMALL;
        ctx.fillStyle = DIM_TEXT;
        ctx.fillText(bracketEliminated, VIEW_W / 2, BRACKET_ELIMINATED_Y);
      }
      drawHint(bracketHasChoice ? BRACKET_CHOICE_HINT : BRACKET_PLAY_HINT, BRACKET_HINT_Y);
    }

    // Spec: a fixed composition painted on canvas -- the winner's kit and name lifting
    // the cup; the only thing moving is the confetti or the fireworks.
    function drawVictory(): void {
      ctx.fillStyle = MENU_BG;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < fxPool.count; i++) {
        if (fxPool.life[i] === 0) continue;
        ctx.fillStyle = FX_COLORS[fxPool.color[i]];
        ctx.fillRect(fxPool.x[i], fxPool.y[i], fxPool.size[i], fxPool.size[i]);
      }
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.font = FONT_VICTORY_TITLE;
      ctx.fillStyle = HUD_ACCENT;
      ctx.fillText(victoryTitle, VIEW_W / 2, VICTORY_TITLE_Y);
      ctx.font = FONT_VICTORY_TEAM;
      ctx.fillStyle = victoryTeam.kit.primary;
      ctx.fillText(victoryTeam.name, VIEW_W / 2, VICTORY_TEAM_Y);
      // The figure: shirt, head, two arms up, the cup above the hands.
      const cx = VIEW_W / 2;
      const cy = VICTORY_FIGURE_Y;
      ctx.fillStyle = victoryTeam.kit.primary;
      ctx.fillRect(cx - 30, cy - 40, 60, 80);
      ctx.fillStyle = victoryTeam.kit.secondary;
      ctx.fillRect(cx - 30, cy - 40, 60, 10);
      ctx.fillStyle = SKIN_COLOR;
      ctx.beginPath();
      ctx.arc(cx, cy - 62, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = SKIN_COLOR;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(cx - 28, cy - 30);
      ctx.lineTo(cx - 48, cy - 100);
      ctx.moveTo(cx + 28, cy - 30);
      ctx.lineTo(cx + 48, cy - 100);
      ctx.stroke();
      ctx.fillStyle = CUP_COLOR;
      ctx.fillRect(cx - 40, cy - 130, 80, 12);
      ctx.fillRect(cx - 30, cy - 118, 60, 26);
      ctx.fillRect(cx - 8, cy - 92, 16, 14);
      ctx.fillRect(cx - 24, cy - 78, 48, 8);
      drawHint(VICTORY_HINT, VICTORY_HINT_Y);
    }

    function drawMatch(): void {
      drawPitch();
      drawPlayers();
      drawBall();
      drawSetPiece();
      drawMinimap();
      drawHud();
      drawCaption();
    }

    function draw(): void {
      switch (flow.phase) {
        case 'mode-select': drawModeSelect(); break;
        case 'team-select': drawTeamSelect(); break;
        case 'draw': drawDraw(); break;
        case 'bracket': drawBracket(); break;
        case 'victory': drawVictory(); break;
        case 'match':
        case 'spectate':
        case 'over': drawMatch(); break;
      }
      // Last, over everything, and only when the guard has tripped (step 8).
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

    // The menu keys go through the SOLO table (arrows or WASD + J), so both players
    // can drive the menus; the team selector of the two-player mode uses each player's
    // own table (G9-2), so J2 picks with the arrows and J while J1 holds WASD and C.
    function tableForPicker(): KeyTable {
      return flowHumanCount(flow) === 2 ? TWO_PLAYER_TABLES[flowPickingHuman(flow)] : SOLO;
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (isTypingTarget(e)) return;
      if (!sfxReady) {
        sfxReady = true;
        sfxVaultWorldCup.init();
        sfxVaultWorldCup.setMuted(mutedRef.current);
      }
      if (pausedRef.current || blocked) return;
      const key = e.key.toLowerCase();
      switch (flow.phase) {
        case 'mode-select': {
          if (e.repeat) return;
          const k = padKeyFor(SOLO, key);
          if (k === 'up') flowMoveMode(flow, -1);
          else if (k === 'down') flowMoveMode(flow, 1);
          else if (k === 'a') flowConfirmMode(flow);
          else return;
          e.preventDefault();
          return;
        }
        case 'team-select': {
          if (e.repeat) return;
          const table = tableForPicker();
          const picker = flowPickingHuman(flow);
          const k = padKeyFor(table, key);
          if (k === 'up') flowMoveTeam(flow, 0, -1, TEAMS.length);
          else if (k === 'down') flowMoveTeam(flow, 0, 1, TEAMS.length);
          else if (k === 'left') flowMoveTeam(flow, -1, 0, TEAMS.length);
          else if (k === 'right') flowMoveTeam(flow, 1, 0, TEAMS.length);
          else if (k === 'a') confirmTeam();
          else if (padChoice(pads[picker], table, key)) flowSetFormation(flow, picker, pads[picker].formation);
          else return;
          e.preventDefault();
          return;
        }
        case 'draw': {
          if (e.repeat) return;
          if (padKeyFor(SOLO, key) !== 'a') return;
          e.preventDefault();
          flowConfirmDraw(flow);
          refreshBracketView();
          return;
        }
        case 'bracket': {
          if (e.repeat) return;
          const k = padKeyFor(SOLO, key);
          if (k === 'left') flowMoveBracketChoice(flow, -1);
          else if (k === 'right') flowMoveBracketChoice(flow, 1);
          else if (k === 'a') confirmBracket();
          else return;
          e.preventDefault();
          return;
        }
        case 'spectate': {
          if (e.repeat) return;
          if (padKeyFor(SOLO, key) !== 'a') return;
          e.preventDefault();
          skipSpectate();
          return;
        }
        case 'victory': {
          if (e.repeat) return;
          if (padKeyFor(SOLO, key) !== 'a') return;
          e.preventDefault();
          continueFromVictory();
          return;
        }
        case 'match': {
          if (e.repeat) return;   // auto-repeat is not a new press: the pad edges are ours
          if (key === 'r') {
            // S-FL4 / S-FL6: R leaves the training only; flowExitMatch is a no-op in a timed match.
            flowExitMatch(flow, mode);
            // flowExitMatch only ever moves the flow away from 'match' into
            // 'mode-select' (flowReset): `!== 'match'` reads the same as
            // `=== 'mode-select'` here without tripping tsc's literal-narrowing
            // check, which does not know an opaque call can mutate flow.phase.
            if (flow.phase !== 'match') {
              padBlur(pads[0]);
              padBlur(pads[1]);
              reportStatus(STATUS_SELECTOR);
              e.preventDefault();
            }
            return;
          }
          // One handler, two pads, two tables: a key of one table leaves the other pad
          // untouched (keyboard.test.ts, "routing a key through both tables").
          for (let t = 0; t < 2; t++) {
            if (!run.human[t]) continue;
            const k = padKeyFor(tables[t], key);
            if (k !== null) {
              e.preventDefault();
              padDown(pads[t], k);
              return;
            }
            if (padChoice(pads[t], tables[t], key)) {
              e.preventDefault();
              return;
            }
          }
          return;
        }
        case 'over':
          return;
      }
    }

    function handleKeyUp(e: KeyboardEvent): void {
      const key = e.key.toLowerCase();
      for (let t = 0; t < 2; t++) {
        const k = padKeyFor(tables[t], key);
        if (k === null) continue;
        // Step 8's rule, per pad: a DIRECTION is always released; a BUTTON released while
        // paused or blocked is cleared without an edge (padClear).
        const isButton = k === 'a' || k === 'b' || k === 'c';
        if (isButton && (pausedRef.current || blocked)) padClear(pads[t], k);
        else padUp(pads[t], k);
      }
    }

    function handleBlur(): void {
      padBlur(pads[0]);
      padBlur(pads[1]);
    }

    // Spec: "solo desktop; si el viewport se reduce en partida, se para y redirige".
    // The human's match is abandoned (G9-8 for the World Cup, S-SC12 for a friendly);
    // a spectated pair is finished headless and recorded (S-FL5); the menus just get
    // the panel. And there is a way back (step-8 Minor 5): when the window is big
    // enough again the block lifts -- on a menu screen only, never into a match.
    function handleResize(): void {
      if (viewportAllowed(window.innerWidth, window.innerHeight)) {
        if (blocked && flow.phase !== 'match' && flow.phase !== 'spectate') blocked = false;
        return;
      }
      if (blocked) return;
      blocked = true;
      if (flow.phase === 'spectate') {
        skipSpectate();
        return;
      }
      if (flow.phase !== 'match') return;
      const match = run.match;
      updateWatch(match, watch);
      abandon(match);
      // S-SC12: the standing result as a CAPTION (never a screen under the panel), with
      // its whistle (I2 of the step-8 review), same order as step 8.
      const beforeBlocked = captions.kind;
      collectCaptions(match, watch, humanSide, captions, false);
      playCaptionEdge(beforeBlocked);
      updateWatch(match, watch);
      padBlur(pads[0]);
      padBlur(pads[1]);
      endHumanMatch(true);
    }

    handleResize();
    reportStatus(STATUS_SELECTOR);
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
