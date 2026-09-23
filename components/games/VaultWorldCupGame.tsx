'use client';

import React, { useEffect, useRef } from 'react';

import { stepsFor } from './football-logic/clock';
import { resolveMatchKits } from './football-logic/kits';
import { NORMAL_RULES, abandon, isOpenPlay, type MatchRules } from './football-logic/match';
import {
  modeAwayId, modeBracket, modeDifficulty, modeFxKind, modeHasCrowd, modeHomeId, modeHumanSide, modeMatchLabel,
  modeMatchSeed, modeRules, modeScore, modeScores, modeStatus, modeVictoryScreen, modeVictoryTeamId, modeVictoryTitle,
  createFriendlyMode, sideIsHuman, type FxKind, type GameMode, type HumanSide,
} from './football-logic/mode';
import { PITCH } from './football-logic/pitch';
import { PLAYER_RADIUS, isSprinting, type PlayerState } from './football-logic/players';
import { createRng, type Rng } from './football-logic/rng';
import { SHOOTOUT_RESOLVE_STEPS } from './football-logic/set-pieces';
import { SQUAD_SIZE } from './football-logic/squads';
import {
  FORMATIONS, TEAM_SIZE, TEAMS, teamById, type Formation, type Kit, type Strategy, type TeamDef,
} from './football-logic/teams';
import {
  WORLD_CUP_SIZE, cpuMatchSeed, currentDifficulty, humanPairIndex, pairAwayId, pairCount, pairHomeId, pairResult, roundLabel,
} from './football-logic/world-cup';

import { ballLift, ballScale, ballShadowFade, ballShadowScale } from './football-screen/ball-view';
import {
  CAMERA_LAG, VIEW_H, VIEW_W, cameraTargetX, cameraTargetY, centreCamera, createCamera,
  followCamera, isOnScreen, toScreenX, toScreenY, type Camera,
} from './football-screen/camera';
import {
  CAPTION_TEXT, collectCaptions, createCaptionState, createMatchWatch, pushCaption, resetCaptionState, resetMatchWatch,
  stepCaption, updateWatch, type ShowingCaption,
} from './football-screen/captions';
import { CONTROL_HINTS, TWO_PLAYER_SCHEME_NOTE, keeperHintFor } from './football-screen/control-hints';
import {
  BRACKET_CHOICE_COUNT, MODE_BLURBS, MODE_LIST, MODE_NAMES, createFlowState, flowAfterModeBuilt, flowBuildMode,
  flowCaptionsDrained, flowConfirmBracket, flowConfirmDraw, flowConfirmLineup, flowConfirmMode, flowConfirmTeam,
  flowContinue, flowCpuPair, flowExitMatch, flowHumanCount, flowLineupBeginEdit, flowLineupCancelChoice,
  flowLineupChoose, flowLineupEndEdit, flowLineupMove, flowMatchOver, flowMoveBracketChoice, flowMoveMode,
  flowMoveTeam, flowPickingHuman, flowRecordCpuResult, flowSetFormation, flowSetKeyScheme, flowSkipSpectate,
  flowSpectateOver, flowToggleKeyScheme, phaseGroup, type PhaseGroup,
} from './football-screen/flow';
import {
  BRACKET_BUTTON_H, BRACKET_BUTTON_W, BRACKET_BUTTON_Y, BRACKET_HINT_Y, BRACKET_PROMPT_Y, BRACKET_ROW_H, DRAW_ROW_H,
  FORMATION_ROW_Y, LINEUP_HINT_Y, LINEUP_LABEL_DY, LINEUP_PITCH_H, LINEUP_PITCH_W, LINEUP_PITCH_X, LINEUP_PITCH_Y,
  LINEUP_RESERVE_X, LINEUP_STATUS_Y, MODE_CARD_H, MODE_CARD_W, MODE_HINT_Y, MODE_SCHEME_DETAIL_Y, MODE_SCHEME_ROW_Y,
  SELECT_HINT_Y, TEAM_CARD_H, TEAM_CARD_W, TEAM_PREVIEW_H, TEAM_PREVIEW_W, TEAM_PREVIEW_X, TEAM_PREVIEW_Y,
  VICTORY_FIGURE_Y, VICTORY_HINT_Y, VICTORY_TEAM_Y, VICTORY_TITLE_Y,
  bracketButtonX, bracketColX, bracketRowY, drawColX, drawRowY, formationLabelX, lineupReserveY, modeCardY,
  teamCardX, teamCardY,
} from './football-screen/flow-layout';
import { previewGkX, previewGkY, previewSlotX, previewSlotY } from './football-screen/formation-preview';
import { PAD_KEYS, routeGamepadStrategy, routeGamepadToPad } from './football-screen/gamepad-input';
import { GESTURE_IDLE, beginGkCatchGestures, createGestureTimers, gestureProgress, resetGestures } from './football-screen/gestures';
import { GOAL_MOUTH_DEPTH, NET_CELL, netLineCount } from './football-screen/goal-net';
import {
  GRASS_TILE_H, GRASS_TILE_W, forEachGrassCell, grassTileOffset,
} from './football-screen/grass';
import {
  SHOT_CHARGE_SEGMENTS, buttonsIdle, chargeSegments, clockText, countdownSeconds, cursorPlayerId,
  halfLabel, keeperHoldsBall, shootoutRoundLabel, smallNumber, sprintBarFraction,
} from './football-screen/hud';
import {
  ARROWS_SOLO, KEY_SCHEME_STORAGE_KEY, SOLO_TABLES_BY_SCHEME, TWO_PLAYER_P1, TWO_PLAYER_P2, TWO_PLAYER_TABLES,
  createPadState, isPauseKey, loadKeyScheme, overlayPadToTeamInput, padAdvance, padBlur, padChoice, padClear, padDown,
  padFormationChoice, padKeyFor, padToTeamInput, padUp, saveKeyScheme, type KeyTable, type PadKey, type PadState,
} from './football-screen/keyboard';
import {
  GK_POSITION, applySwap, canSwap, createLineup, lineupBackspace, lineupEndEdit, lineupName, lineupTypeChar,
  loadLineup, saveLineup, type Lineup,
} from './football-screen/lineup';
import { SPECTATE_SPEED, createStepBudget } from './football-screen/loop';
import { createFramePlan, planFrame, planHalfAmbience } from './football-screen/match-loop';
import { createMatchRun, finishMatchRun, stepMatchRun, type MatchRun } from './football-screen/match-run';
import {
  MINIMAP_H, MINIMAP_PAD, MINIMAP_W, createMinimapRect, minimapViewRect, minimapX, minimapY,
} from './football-screen/minimap';
import { FX_COLORS, createParticlePool, fxSeedFor, startFx, stepFx } from './football-screen/particles';
import {
  ambienceDue, captionSfxOnEdge, createAmbienceMarks, goalCrowdDue, goalNetDue, halfEndWhistleDue,
  shortPassFiredThisStep, shotFiredThisStep, victoryChantGain,
} from './football-screen/sfx-map';
import { SLIDE_TILT_COS, SLIDE_TILT_SIN, choosePlayerSprite, createSpriteChoice } from './football-screen/sprite-frame';
import {
  ATLAS_H, ATLAS_W, PLAYER_SPRITE_MAPS, SPRITE_HALF, SPRITE_SIZE, atlasCellX, atlasCellY, bakeSpriteAtlas,
  createSpritePalette, writeSpritePalette, type SpritePalette,
} from './football-screen/sprite-maps';
import { MIN_VIEWPORT_H, MIN_VIEWPORT_W, viewportAllowed } from './football-screen/viewport-guard';
import { createGamepadPad, type GamepadPad } from '@/lib/gamepad';
import { pollGamepads } from '@/lib/gamepad-navigator';
import { sfxVaultWorldCup } from '@/lib/sfx-vault-world-cup';

interface VaultWorldCupGameProps {
  paused: boolean;
  muted?: boolean;
  seed?: number;
  onScoreChange?: (home: number, away: number) => void;
  onClockChange?: (label: string) => void;
  onStatusChange?: (label: string) => void;
  // G10-4: 'menu' while viewing any selector/draw/bracket/victory screen;
  // 'match' during a played match or a watched CPU crossing. Derived from FlowPhase
  // via phaseGroup, never read from the mode's kind field. The play page uses it to
  // switch tracks in MusicContext.
  onPhaseChange?: (phase: PhaseGroup) => void;
  onGameOver?: (score: number) => void;
  onVictory?: (score: number) => void;
  // G10-5: called exactly once, at the edge of entering `blocked` (never per frame,
  // nor upon exit): the play page redirects to detail after showing the panel for
  // a couple of seconds.
  onViewportBlocked?: () => void;
  // G15-6: the pause keys live in the component, which knows the active key scheme
  // (Esc always; P only while no active table reads it -- with Clásico P is "right").
  // The play page keeps the `paused` state and flips it here; the gamepad's Start
  // (G15-20) lands here too.
  onPauseToggle?: () => void;
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
const ZERO_FORMATIONS: readonly [number, number] = [0, 0];

// ── Palette. One visual version, no skins (spec). ─────────────────────────────
// V15-1 (G15-2): two lime greens in mowing stripes, the dark one "stronger/more
// serious" as Paco asked, each with its own speckle shade. Indexed by grass.ts's tone.
const GRASS_LIGHT = '#9ccf3f';
const GRASS_LIGHT_SPECK = '#8fc538';
const GRASS_DARK = '#7db62f';
const GRASS_DARK_SPECK = '#70a82a';
const GRASS_TONE_COLORS: readonly string[] = [GRASS_LIGHT, GRASS_LIGHT_SPECK, GRASS_DARK, GRASS_DARK_SPECK];
// Brief §8 (deferred minor of step 11): every stroke of drawPitch sets it explicitly
// instead of inheriting it from whatever was drawn before.
const PITCH_LINE_WIDTH = 3;
const LINE = 'rgba(255,255,255,0.75)';
const GOAL_MOUTH = 'rgba(255,255,255,0.25)';
const NET_LINE = 'rgba(255,255,255,0.32)';
const GOAL_FRAME = 'rgba(255,255,255,0.9)';
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
// G12-1: the goalkeeper is reserved out of the sixteen teams' kit space entirely, so
// it never coincides with either side's colours -- fluor green body, black
// ring/collar/head trim, in EVERY mode (training statues and shootout included).
const GK_KIT_PRIMARY = '#39ff14';
const GK_KIT_SECONDARY = '#000000';

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
// V15-1 (G15-2 "sombra mínima"): a small ellipse under the sprite's feet, smaller than
// v1's body shadow, so the sprite and not the shadow is what reads.
const SPRITE_SHADOW_DY = 4;
const SPRITE_SHADOW_RX = 10;
const SPRITE_SHADOW_RY = 4;
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
// G15-9: the mini pitch's dot radius, shared by the goalkeeper and the outfield.
const PREVIEW_DOT_R = 4;
const SPOT_RADIUS = 4;
const BALL_RADIUS = 6;
// How far off screen the ball is still drawn: its own radius plus the height it can
// be lifted to, so a long pass does not pop into view at the edge of the canvas.
const BALL_MARGIN = 30;

// Fixed UI copy, module constants so draw() never builds a string.
const HINT_AIM = 'CRUCETA: APUNTAR · SALE SOLO';
const BLOCKED_TITLE = 'AGRANDA LA VENTANA';
const BLOCKED_HINT = `MÍNIMO ${MIN_VIEWPORT_W} × ${MIN_VIEWPORT_H}`;
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
const TEAM_TITLE_SOLO = 'ELIGE TU SELECCIÓN';
const TEAM_TITLES_TWO: readonly [string, string] = ['JUGADOR 1 (WASD): ELIGE TU SELECCIÓN', 'JUGADOR 2 (FLECHAS): ELIGE TU SELECCIÓN'];
const TEAM_HINTS_TWO: readonly [string, string] = ['WASD · C CONFIRMA · 1/2/3 ALINEACIÓN', 'FLECHAS · J CONFIRMA · 7/8/9 ALINEACIÓN'];
// Fix round 1 (Important #2): ALINEACIÓN is reachable from the two-player friendly
// (LINEUP_BY_MODE['friendly-2p'], flow.ts) too, and J1's buttons there are C/V/B
// (TWO_PLAYER_P1), not either solo scheme's -- CONTROL_HINTS[flow.keyScheme] was
// naming J2's or a solo scheme's keys to a player who does not have them. Mirrors
// TEAM_HINTS_TWO above: literal per-picker strings, no per-frame build.
const LINEUP_HINTS_TWO_BROWSE: readonly [string, string] = [
  'WASD · C CAMBIAR · B NOMBRE · V VOLVER',
  'FLECHAS · J CAMBIAR · L NOMBRE · K VOLVER',
];
const LINEUP_HINTS_TWO_SWAP: readonly [string, string] = [
  'WASD: ELIGE RESERVA · C CONFIRMA · V CANCELA',
  'FLECHAS: ELIGE RESERVA · J CONFIRMA · K CANCELA',
];
const TAKEN_TAG = 'J1';
const FORMATION_ROW_LABEL = 'ALINEACIÓN:';
// '1 NORMAL', '2 OFENSIVA', '3 DEFENSIVA' for the solo/J1 keys and '7 …' for J2's, built once.
function buildFormationLabels(keys: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < FORMATIONS.length; i++) out.push(`${keys[i]} ${FORMATIONS[i].name}`);
  return out;
}
const FORMATION_LABELS_SOLO: readonly string[] = buildFormationLabels(ARROWS_SOLO.formation);
const FORMATION_LABELS_P2: readonly string[] = buildFormationLabels(TWO_PLAYER_P2.formation);
const DRAW_TITLE = 'SORTEO DEL MUNDIAL';
const YOU_TAG = 'TÚ';
const BRACKET_TITLE_PREFIX = 'CUADRO · ';
const BRACKET_VS = ' VS ';
const BRACKET_SCORE_SEP = ' - ';
const BRACKET_NEXT_PREFIX = 'PRÓXIMO: ';
const BRACKET_YOURS_PREFIX = 'TU PARTIDO: ';
const BRACKET_VER = 'VER';
const BRACKET_SALTAR = 'SALTAR';
const BRACKET_SALTAR_TODOS = 'SALTAR TODOS';
const TRAINING_HINT = 'R PARA SALIR';
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

// Eighteen shirt numbers as text, built once at module load: not even a String(n)
// runs on an event (criterion 20).
const SHIRT_LABELS: readonly string[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18',
];
const LINEUP_TITLE_PREFIX = 'ALINEACIÓN · ';
const LINEUP_STATUS_SWAP = 'ELIGE QUIÉN ENTRA POR ';
const LINEUP_STATUS_EDIT = 'ESCRIBIENDO: ';
// With the squad of eighteen this line should never appear (every role keeps someone
// on the bench, keeper included -- that is what checkSquadCoversFormations enforces).
// It stays as the honest answer if a future formation ever empties a line: an empty
// list with no explanation would look like a bug. Do NOT delete it as dead code.
const LINEUP_NO_RESERVE = 'SIN RESERVA PARA ESE PUESTO';
const LINEUP_CURSOR_RING = 6;

// Bakes grass.ts's tile into a canvas ONCE per mount (criterion 20: never per frame).
function bakeGrassTile(): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = GRASS_TILE_W;
  tile.height = GRASS_TILE_H;
  const c = tile.getContext('2d');
  if (c === null) return tile;
  forEachGrassCell((x, y, size, tone) => {
    c.fillStyle = GRASS_TONE_COLORS[tone];
    c.fillRect(x, y, size, size);
  });
  return tile;
}

// V15-1: one 240 x 210 atlas canvas (octants across, poses down), created ONCE per
// mount and re-baked on the startMatch event -- never per frame (criterion 20).
function createAtlasCanvas(): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = ATLAS_W;
  el.height = ATLAS_H;
  return el;
}

function bakeAtlas(atlas: HTMLCanvasElement, palette: Readonly<SpritePalette>): void {
  const c = atlas.getContext('2d');
  if (c === null) return;
  c.clearRect(0, 0, atlas.width, atlas.height);
  bakeSpriteAtlas(PLAYER_SPRITE_MAPS, palette, (x, y, size, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, size, size);
  });
}

function VaultWorldCupGame({
  paused,
  muted = false,
  seed,
  onScoreChange,
  onClockChange,
  onStatusChange,
  onPhaseChange,
  onGameOver,
  onVictory,
  onViewportBlocked,
  onPauseToggle,
}: VaultWorldCupGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const mutedRef = useRef(muted);
  const onScoreChangeRef = useRef(onScoreChange);
  const onClockChangeRef = useRef(onClockChange);
  const onStatusChangeRef = useRef(onStatusChange);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onGameOverRef = useRef(onGameOver);
  const onVictoryRef = useRef(onVictory);
  const onViewportBlockedRef = useRef(onViewportBlocked);
  const onPauseToggleRef = useRef(onPauseToggle);

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
    onPhaseChangeRef.current = onPhaseChange;
    onGameOverRef.current = onGameOver;
    onVictoryRef.current = onVictory;
    onViewportBlockedRef.current = onViewportBlocked;
    onPauseToggleRef.current = onPauseToggle;
  }, [onScoreChange, onClockChange, onStatusChange, onPhaseChange, onGameOver, onVictory, onViewportBlocked, onPauseToggle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d')!;
    // V15-1: pixel art. Smoothing off for every drawImage/pattern of this canvas (the
    // sprites and the grass); drawPlayer also rounds its screen coordinates, or the
    // sprites shimmer while the camera glides.
    ctx.imageSmoothingEnabled = false;

    // ── Everything below is created ONCE and mutated in place (criterion 20) ──
    // G9-7: ONE seed per run, read when the mode is built (confirmTeam) -- the only
    // wall-clock read of the whole game. The `seed` prop pins it for QA and replays.
    const fixedSeed = seed;
    let runSeed = 0;
    const flow = createFlowState();
    // G15-6: the chosen key scheme survives a reload. Two closures over localStorage,
    // created once; loadKeyScheme/saveKeyScheme wrap them in try/catch, so a private
    // window or blocked site data simply starts on Flechas and forgets on reload.
    const readStoredScheme = (): string | null => window.localStorage.getItem(KEY_SCHEME_STORAGE_KEY);
    const writeStoredScheme = (value: string): void => {
      window.localStorage.setItem(KEY_SCHEME_STORAGE_KEY, value);
    };
    flowSetKeyScheme(flow, loadKeyScheme(readStoredScheme));
    // G15-17: one Lineup per human, created ONCE (criterion 20); the names and the
    // starters of a selection are loaded on entering ALINEACIÓN and saved on leaving
    // it. Two closures over localStorage, like the key scheme's: loadLineup and
    // saveLineup wrap them in try/catch, so a private window simply starts on the
    // default lineup and forgets.
    const lineups: readonly [Lineup, Lineup] = [createLineup(), createLineup()];
    const readLineup = (key: string): string | null => window.localStorage.getItem(key);
    const writeLineup = (key: string, value: string): void => {
      window.localStorage.setItem(key, value);
    };
    // Built on an event (refreshLineupView), never per frame. Eighteen, one per squad
    // member (SQUAD_SIZE), written with literals -- no new Array, no .fill.
    const lineupLabels: string[] = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    const lineupChoices: number[] = [];
    let lineupChoiceCount = 0;
    let lineupTitle = '';
    let lineupStatus = '';
    // Placeholders so nothing below is nullable: replaced by flowBuildMode / startMatch
    // the first time the player confirms. Neither is ever stepped or drawn as such.
    let mode: GameMode = createFriendlyMode('friendly-cpu', TEAMS[0].id, TEAMS[1].id);
    let run: MatchRun = createMatchRun(TEAMS[0], TEAMS[1], 0, 5, [true, false], NORMAL_RULES, ZERO_FORMATIONS);
    // Resolved ONCE per match, alongside `run` (never per frame): QA 15-sep, near-
    // identical primaries (white/white, the reds, the light blues, the dark blues)
    // are unreadable on screen, so every in-match drawing paints from this tuple
    // instead of the teams' own kits. The selector and victory screen are unaffected
    // -- they show one team at a time, never a clashing pair.
    let matchKits: readonly [Kit, Kit] = resolveMatchKits(run.match.teams[HOME].kit, run.match.teams[AWAY].kit);
    let humanSide: HumanSide = 0;
    let victoryScreen = false;
    let speed = 1;
    let spectatePair = -1;
    let matchSeed = 0;

    // Two pads, one per TEAM (not per player): pads[t] drives team t when it is human.
    // The tables say which keys each pad listens to (G9-2).
    const pads: [PadState, PadState] = [createPadState('neutral', 0), createPadState('neutral', 0)];
    // G15-20: the two physical pads (mando 1, mando 2), read once per frame by
    // pollGamepadFrame, and one PadState per TEAM they drive through padDown/padUp --
    // the keyboard's own entries; runStep lays them over the keyboard's, which stays
    // live at the same time. All created once (criterion 20).
    const gamepads: readonly [GamepadPad, GamepadPad] = [createGamepadPad(), createGamepadPad()];
    const gamepadPads: [PadState, PadState] = [createPadState('neutral', 0), createPadState('neutral', 0)];
    // G15-20 (pre-flight H8): pollGamepadFrame only calls pollGamepads -- and so
    // navigator.getGamepads(), criterion 20's exception -- while gamepadSeen is true.
    // The initial poll catches a pad already connected before entering the page
    // (Chrome/Firefox do not always expose it until the first button press, but if it
    // is already exposed this picks it up without waiting for one); 'gamepadconnected'
    // turns it on live; 'gamepaddisconnected' only turns it off once a fresh poll
    // confirms none is left (so a second pad that is still alive does not turn it
    // off). A keyboard-only player never pays for the array allocation, nor for the
    // Gamepad/GamepadButton instances Chrome creates per pad on every call.
    let gamepadSeen = pollGamepads(gamepads) > 0;
    function handleGamepadConnected(): void {
      gamepadSeen = true;
    }
    function handleGamepadDisconnected(): void {
      gamepadSeen = pollGamepads(gamepads) > 0;
    }
    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
    let tables: readonly [KeyTable, KeyTable] = SOLO_TABLES_BY_SCHEME[flow.keyScheme];
    const runFormations: [number, number] = [0, 0];
    const cursorIds: [number, number] = [-1, -1];

    const cam: Camera = createCamera();
    const budget = createStepBudget();
    const plan = createFramePlan();
    const captions = createCaptionState();
    const watch = createMatchWatch();
    const viewRect = createMinimapRect();
    // V15-1: the grass tile and its pattern, created ONCE (criterion 20). drawPitch
    // only shifts it with the camera. createPattern can return null (per the DOM
    // types), and then drawPitch falls back to the flat dark shade.
    const grassPattern = ctx.createPattern(bakeGrassTile(), 'repeat');
    // Criterion 20: created ONCE, written in place by runStep/drawPlayer every frame.
    const gestures = createGestureTimers();
    const spriteChoice = createSpriteChoice();
    // V15-1 (G15-2): the three sprite atlases. The keeper's is baked once and for all
    // (G12-1: the same fluor green and black for the sixteen keepers); home and away
    // are re-baked by bakeMatchAtlases on every startMatch, from the RESOLVED kits.
    const spritePalette = createSpritePalette();
    const atlasHome = createAtlasCanvas();
    const atlasAway = createAtlasCanvas();
    const atlasKeeper = createAtlasCanvas();
    writeSpritePalette(spritePalette, GK_KIT_PRIMARY, GK_KIT_SECONDARY);
    bakeAtlas(atlasKeeper, spritePalette);
    bakeMatchAtlases();

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
    // Eight rows: the round of 16 is the widest the screen ever gets (G15-8). Created
    // once, with literals -- refreshBracketView writes into them on an event.
    // The row is drawn in THREE pieces (home, score, away) so the loser of a resolved
    // cross can be dimmed in place -- Paco's (b): no ELIMINADOS line, no counter.
    const bracketRowHome: string[] = ['', '', '', '', '', '', '', ''];
    const bracketRowMid: string[] = ['', '', '', '', '', '', '', ''];
    const bracketRowAway: string[] = ['', '', '', '', '', '', '', ''];
    // Offsets from the column centre, measured ONCE per refresh, never per frame.
    const bracketRowHomeDx: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    const bracketRowAwayDx: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    // 0 = the home side lost, 1 = the away side lost, -1 = the cross is not resolved.
    const bracketRowLoser: number[] = [-1, -1, -1, -1, -1, -1, -1, -1];
    const bracketRowIsHuman: boolean[] = [false, false, false, false, false, false, false, false];
    let bracketRows = 0;
    let bracketPrompt = '';
    let bracketHasChoice = false;
    const drawNames: string[] = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
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
    let cachedShootoutScore = '';
    let shootoutScoredHome = -1;
    let shootoutScoredAway = -1;
    let reportedHome = -1;
    let reportedAway = -1;
    let reportedClock = '';
    // '' before the first report (the component just mounted): neither 'menu' nor
    // 'match', so the first call always fires once — the same trick as reportedClock
    // starting at ''.
    let reportedPhaseGroup: PhaseGroup | '' = '';
    let keeperHoldSteps = 0;
    let keeperHoldTeam: 0 | 1 | -1 = -1;

    // On an event (mount, startMatch), never per frame: paints the resolved kits of
    // the match -- the away side's inverted kit included when it clashes (QA 15-sep).
    function bakeMatchAtlases(): void {
      writeSpritePalette(spritePalette, matchKits[HOME].primary, matchKits[HOME].secondary);
      bakeAtlas(atlasHome, spritePalette);
      writeSpritePalette(spritePalette, matchKits[AWAY].primary, matchKits[AWAY].secondary);
      bakeAtlas(atlasAway, spritePalette);
    }

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

    // G10-4: the play page's music track. Cheap by construction — a string comparison
    // against a variable already mutated in place, exactly the pattern of reportHud
    // above — so calling it every frame from loop() is not an assignment per frame:
    // it is a READ per frame that only calls the callback at the edge.
    function reportPhase(): void {
      const group = phaseGroup(flow.phase);
      if (group === reportedPhaseGroup) return;
      reportedPhaseGroup = group;
      const cb = onPhaseChangeRef.current;
      if (cb !== undefined) cb(group);
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
      matchKits = resolveMatchKits(home.kit, away.kit);
      bakeMatchAtlases();
      humanSide = side;
      victoryScreen = screen;
      matchSeed = seedForMatch;
      tables = side === 'both' ? TWO_PLAYER_TABLES : SOLO_TABLES_BY_SCHEME[flow.keyScheme];
      speed = side === 'none' ? SPECTATE_SPEED : 1;
      for (let t = 0; t < 2; t++) {
        padBlur(pads[t]);
        padBlur(gamepadPads[t]);
        pads[t].formation = formations[t];
        pads[t].strategy = 'neutral';
      }
      centreCamera(cam, run.match.ball.x, run.match.ball.y, PITCH);
      resetCaptionState(captions);
      resetMatchWatch(watch);
      resetGestures(gestures);
      ambienceCount = planHalfAmbience(seedForMatch, 1, ambienceMarks);
      ambienceIndex = 0;
      ambienceHalf = 1;
      accumulatorMs = 0;
      endFired = false;
      shootoutTaken = -1;
      shootoutSudden = false;
      cachedShootoutLabel = '';
      cachedShootoutScore = '';
      shootoutScoredHome = -1;
      shootoutScoredAway = -1;
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
        teamOf(pairHomeId(wc, pair)), teamOf(pairAwayId(wc, pair)), cpuMatchSeed(wc, pair),
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

    // G15-8: SALTAR TODOS. The same skipCpuPair as one-by-one, for every CPU pair
    // left of the round -- same seed per pair (cpuMatchSeed), so the bracket ends up
    // exactly as it would resolving them one at a time. Bounded by WORLD_CUP_SIZE
    // instead of `while (true)`: if nextCpuPair ever stopped advancing, this returns
    // rather than hanging the tab.
    function skipAllCpuPairs(): void {
      for (let i = 0; i < WORLD_CUP_SIZE; i++) {
        if (flowCpuPair(mode) === -1) return;
        skipCpuPair();
      }
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

    // A on the team selector: J1 (and J2 in the two-player mode), then either the
    // ALINEACIÓN screen (G15-17) or, in the training, straight to the mode.
    function confirmTeam(): void {
      const result = flowConfirmTeam(flow, BANK_IDS.length);
      if (result === 'lineup') {
        openLineup();
        return;
      }
      if (result !== 'done') return;
      buildModeAndGo();
    }

    // The mode is built HERE, the one place, once per run (Vault Fighter's
    // confirmSelection). Reached from the training's team selector or from the last
    // ALINEACIÓN screen.
    function buildModeAndGo(): void {
      runSeed = fixedSeed ?? Date.now();          // the one Date.now() of the whole game (G9-7)
      mode = flowBuildMode(flow, BANK_IDS, runSeed);
      fxRng = createRng(fxSeedFor(runSeed));      // the fourth stream, never the match's
      flowAfterModeBuilt(flow, mode);
      if (modeBracket(mode) === null) startHumanMatch();
      else refreshDrawView();
    }

    function lineupHuman(): 0 | 1 {
      return flowPickingHuman(flow);
    }

    function lineupTeam(): TeamDef {
      return TEAMS[flow.picked[lineupHuman()]];
    }

    function lineupFormation(): Formation {
      return FORMATIONS[flow.formation[lineupHuman()]];
    }

    // Entering ALINEACIÓN (from the team selector, or from J1's screen to J2's).
    function openLineup(): void {
      const who = lineupHuman();
      loadLineup(readLineup, lineupTeam().id, lineupFormation(), lineups[who]);
      refreshLineupView();
      reportStatus(lineupTitle);
    }

    function saveLineupOf(who: 0 | 1): void {
      saveLineup(writeLineup, TEAMS[flow.picked[who]].id, FORMATIONS[flow.formation[who]], lineups[who]);
    }

    // Every string of the screen, on an event: entering, a swap, a typed letter.
    // Also the list of legal reserves for the position being substituted, which is
    // what the cursor walks while flow.lineupChoosing !== -1.
    function refreshLineupView(): void {
      const f = lineupFormation();
      const l = lineups[lineupHuman()];
      const teamId = lineupTeam().id;
      lineupTitle = LINEUP_TITLE_PREFIX + lineupTeam().name;
      for (let i = 0; i < SQUAD_SIZE; i++) {
        lineupLabels[i] = SHIRT_LABELS[i] + ' ' + lineupName(l, teamId, i);
      }
      lineupChoiceCount = 0;
      lineupChoices.length = SQUAD_SIZE;
      if (flow.lineupChoosing !== -1) {
        for (let i = 0; i < SQUAD_SIZE; i++) {
          if (!canSwap(f, l, flow.lineupChoosing, i)) continue;
          lineupChoices[lineupChoiceCount] = i;
          lineupChoiceCount++;
        }
        lineupStatus = lineupChoiceCount === 0
          ? LINEUP_NO_RESERVE
          : LINEUP_STATUS_SWAP + lineupLabels[l.starters[flow.lineupChoosing]];
      } else if (flow.lineupEditing !== -1) {
        lineupStatus = LINEUP_STATUS_EDIT + lineupLabels[flow.lineupEditing];
      } else {
        lineupStatus = '';
      }
    }

    // The squad index the cursor is on: a starter while browsing, a legal reserve
    // while choosing. -1 when there is nothing to point at.
    function lineupCursorIndex(): number {
      const l = lineups[lineupHuman()];
      if (flow.lineupChoosing === -1) {
        return flow.lineupCursor < l.starters.length ? l.starters[flow.lineupCursor] : -1;
      }
      return flow.lineupCursor < lineupChoiceCount ? lineupChoices[flow.lineupCursor] : -1;
    }

    // B on ALINEACIÓN while browsing (Paco's (d)). flowConfirmLineup refuses ('none')
    // mid-swap or mid-edit, so a half finished change never starts a match.
    function confirmLineup(): void {
      const who = lineupHuman();
      const result = flowConfirmLineup(flow);
      if (result === 'none') return;
      saveLineupOf(who);
      if (result === 'next') {
        openLineup();
        return;
      }
      buildModeAndGo();
    }

    function refreshDrawView(): void {
      const wc = modeBracket(mode);
      if (wc === null) return;
      for (let i = 0; i < wc.bracket.length; i++) drawNames[i] = teamOf(wc.bracket[i]).name;
      drawHumanIndex = wc.bracket.indexOf(wc.humanId);
    }

    // Resolved once per entry to the bracket screen and once per VER/SALTAR resolution,
    // never per frame (Vault Fighter 973-1000). The strings AND their offsets are
    // built HERE -- ctx.measureText runs on the event, not on the frame.
    // G15-8: only the CURRENT round is shown, so there is no ELIMINADOS line any more
    // -- with sixteen teams it would be fourteen names by the final and would not fit.
    // Paco's (b): the loser of a resolved cross is DIMMED in its own row instead.
    function refreshBracketView(): void {
      const wc = modeBracket(mode);
      if (wc === null) return;
      bracketTitle = BRACKET_TITLE_PREFIX + roundLabel(wc);
      bracketRows = pairCount(wc);
      const human = humanPairIndex(wc);
      ctx.font = FONT_TEAM;
      for (let p = 0; p < bracketRows; p++) {
        const homeName = teamOf(pairHomeId(wc, p)).name;
        const awayName = teamOf(pairAwayId(wc, p)).name;
        bracketRowIsHuman[p] = p === human;
        bracketRowHome[p] = homeName;
        bracketRowAway[p] = awayName;
        const res = wc.resolved[p] ? pairResult(wc, p) : null;
        if (res === null) {
          bracketRowMid[p] = BRACKET_VS;
          bracketRowLoser[p] = -1;
        } else {
          bracketRowMid[p] = ' ' + smallNumber(res.homeGoals) + BRACKET_SCORE_SEP + smallNumber(res.awayGoals) + ' ';
          bracketRowLoser[p] = res.winner === 0 ? 1 : 0;
        }
        // The three pieces are laid out around the column centre: home ends where the
        // middle starts, away starts where it ends. Measured here, ONCE.
        const midW = ctx.measureText(bracketRowMid[p]).width;
        bracketRowHomeDx[p] = -midW / 2;
        bracketRowAwayDx[p] = midW / 2;
      }
      const pair = flowCpuPair(mode);
      bracketHasChoice = pair !== -1;
      bracketPrompt = pair === -1
        ? BRACKET_YOURS_PREFIX + teamOf(modeHomeId(mode)).name + BRACKET_VS + teamOf(modeAwayId(mode)).name
        : BRACKET_NEXT_PREFIX + teamOf(pairHomeId(wc, pair)).name + BRACKET_VS + teamOf(pairAwayId(wc, pair)).name;
      reportStatus(roundLabel(wc));
    }

    // A on the bracket: VER, SALTAR, SALTAR TODOS or the human's match.
    function confirmBracket(): void {
      const action = flowConfirmBracket(flow, mode);
      if (action === 'spectate') startCpuPair();
      else if (action === 'skip') skipCpuPair();
      else if (action === 'skip-all') skipAllCpuPairs();
      else if (action === 'play') startHumanMatch();
    }

    // ONE simulation step. The human pads are sampled into their TeamInputs; the CPU
    // sides decide inside stepMatchRun (team 0 first, own stream). `first` is false from
    // the second step of a frame on (a single tap must not fire five shots).
    function runStep(first: boolean): void {
      const match = run.match;
      // Pre-flight finding: the 'gk-catch' event's own x/y are USELESS for direction
      // (ai.ts's keeperCatch calls givePossession, which snaps ball.x/y to the keeper's
      // own facing, BEFORE stamping the event -- see gestures.ts's header comment). The
      // direction has to be read HERE, before this step's stepMatchRun runs it over.
      const prevBallX = match.ball.x;
      const prevBallY = match.ball.y;
      if (run.human[0]) {
        padToTeamInput(pads[0], first, run.inputs[0]);
        overlayPadToTeamInput(gamepadPads[0], first, run.inputs[0]);
      }
      if (run.human[1]) {
        padToTeamInput(pads[1], first, run.inputs[1]);
        overlayPadToTeamInput(gamepadPads[1], first, run.inputs[1]);
      }
      stepMatchRun(run);

      // 1. The ball being struck (audio table: ActionEvent 'shot' with ok).
      if (shotFiredThisStep(match)) sfxVaultWorldCup.play('kick');
      // 1b. The short pass getting away (G10-2, QA 11-sep). The long pass has no row
      //     in the spec's audio table and stays silent in the v1.
      if (shortPassFiredThisStep(match)) sfxVaultWorldCup.play('pass');
      // 1c. G11-2: the keeper's dive. A SCREEN timer started by the engine's own
      //     'gk-catch' event -- the engine knows nothing about the gesture, and the
      //     sweep is the same 18-slot scan points 1 and 1b do for the sound. The
      //     direction comes from prevBallX/prevBallY, captured above, not from the
      //     event itself.
      beginGkCatchGestures(match, gestures, prevBallX, prevBallY);
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
        // Same treatment for the score template of drawHud: rebuilt only when either
        // number actually changes, not once per frame.
        if (sh.scored[HOME] !== shootoutScoredHome || sh.scored[AWAY] !== shootoutScoredAway) {
          shootoutScoredHome = sh.scored[HOME];
          shootoutScoredAway = sh.scored[AWAY];
          cachedShootoutScore = `${smallNumber(shootoutScoredHome)} - ${smallNumber(shootoutScoredAway)}`;
        }
        if (kickEdge) {
          const firstKick = shootoutTaken < 0;
          shootoutTaken = takenNow;
          if (!firstKick && match.phase === 'shootout') sfxVaultWorldCup.play('whistle_start');
        }
      }
      // 5. The crowd bed: 2-3 bursts per half, from its own stream (spec). Planned
      //    for every mode (cheap, no sound); gated at the ONE place it makes sound
      //    (G10-3, QA 11-sep: training has no clock, and no crowd).
      if (match.half !== ambienceHalf) {
        ambienceCount = planHalfAmbience(matchSeed, match.half, ambienceMarks);
        ambienceIndex = 0;
        ambienceHalf = match.half;
      }
      if (modeHasCrowd(mode) && isOpenPlay(match.phase) && ambienceDue(ambienceMarks, ambienceCount, ambienceIndex, match.halfStep)) {
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
          // Cheap minor: leaving spectate for over drops the x4 -- the FINAL caption
          // of a watched CPU match drains at real time (3 s), not sped up.
          speed = 1;
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
        for (let i = 0; i < plan.steps; i++) {
          // Fix round 1, finding 2: stepMatch returns early on 'over' without clearing
          // scratch.events, so a step after the match ended would re-read the last shot
          // event and fire 'kick' again (up to x4 at spectate speed) for nothing.
          if (run.match.phase === 'over') break;
          runStep(i === 0);
        }
        if (plan.advancePad) {
          padAdvance(pads[0]);
          padAdvance(pads[1]);
          padAdvance(gamepadPads[0]);
          padAdvance(gamepadPads[1]);
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
      // V15-1 (G15-2): lime mowing stripes with a soft speckle, baked once into
      // grassPattern. The pattern is anchored to the coordinate origin, so shifting the
      // transform by the camera's offset inside the tile glues the stripes to the world:
      // screen pixel s shows tile pixel (s + ox) mod 96 = the stripe of world pixel
      // s + cam.x (grass.test.ts asserts it). One fill, no allocation. (No
      // `const match = run.match` here: drawPitch never reads the match.)
      if (grassPattern === null) {
        ctx.fillStyle = GRASS_DARK;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      } else {
        const ox = grassTileOffset(cam.x, GRASS_TILE_W);
        const oy = grassTileOffset(cam.y, GRASS_TILE_H);
        ctx.setTransform(1, 0, 0, 1, -ox, -oy);
        ctx.fillStyle = grassPattern;
        ctx.fillRect(ox, oy, VIEW_W, VIEW_H);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      const p = PITCH;
      ctx.strokeStyle = LINE;
      ctx.lineWidth = PITCH_LINE_WIDTH;
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
        // Brief §8: without this, the second goal's areas inherit the goal frame's
        // lineWidth from the first iteration. Explicit, so they can never drift apart.
        ctx.lineWidth = PITCH_LINE_WIDTH;
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
        // The goal itself: a white mouth 30 units deep behind the line, now with its
        // frame and its net. G11-4: the net is a STATIC grid (the one that ripples is
        // v1.5) and it is drawn HERE, in drawPitch, on purpose -- drawPlayers and
        // drawBall run after it, so the ball the engine leaves frozen inside the mouth
        // for the whole celebration is drawn ON TOP of the mesh instead of behind it.
        const mouthX = toScreenX(cam, goalX + (dir === 1 ? -GOAL_MOUTH_DEPTH : 0));
        const mouthY = toScreenY(cam, midY - p.goalWidth / 2);
        ctx.fillStyle = GOAL_MOUTH;
        ctx.fillRect(mouthX, mouthY, GOAL_MOUTH_DEPTH, p.goalWidth);
        // One path for the whole mesh: 16 line segments, one stroke, no allocation.
        ctx.strokeStyle = NET_LINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const across = netLineCount(p.goalWidth, NET_CELL);
        for (let i = 1; i <= across; i++) {
          const lineY = mouthY + i * NET_CELL;
          ctx.moveTo(mouthX, lineY);
          ctx.lineTo(mouthX + GOAL_MOUTH_DEPTH, lineY);
        }
        const deep = netLineCount(GOAL_MOUTH_DEPTH, NET_CELL);
        for (let i = 1; i <= deep; i++) {
          const lineX = mouthX + i * NET_CELL;
          ctx.moveTo(lineX, mouthY);
          ctx.lineTo(lineX, mouthY + p.goalWidth);
        }
        ctx.stroke();
        // The posts and the back of the net: the outline that turns the mouth into a
        // box the ball can be INSIDE.
        ctx.strokeStyle = GOAL_FRAME;
        ctx.lineWidth = 3;
        ctx.strokeRect(mouthX, mouthY, GOAL_MOUTH_DEPTH, p.goalWidth);
      }
    }

    // V15-1 (G15-2 + G15-3): every player is ONE sprite from the atlas of its side --
    // run/idle frames, its own lying-down frame, the keeper's two dive frames, a slide
    // drawn as the run sprite tilted -- chosen by sprite-frame.ts's choosePlayerSprite.
    // The direction stick, the head and shoulders of G11-1 and the dive capsule are
    // gone (G15-3); the shadow, the step-8 goal celebration arcs, the cursor, the
    // charge notches and the sprint ring stay vector, on top of the sprite.
    //
    // The shootout exclusions of stage B2 §8 live in choosePlayerSprite now:
    //   · `parked` — the fifteen in the centre circle stand still, whatever slide,
    //     floor or charge fields the engine left on them.
    //   · nobody is drawn lying down or sliding during the shootout, THE TAKER
    //     INCLUDED (B2 report, Minor 2; probe P6(1)).
    function drawPlayer(p: PlayerState, cursor: boolean): void {
      const match = run.match;
      if (!isOnScreen(cam, p.x, p.y, PLAYER_RADIUS * 3)) return;
      const x = toScreenX(cam, p.x);
      const y = toScreenY(cam, p.y);
      const shootout = match.phase === 'shootout';
      const parked = shootout && p.id !== (match.shootout?.takerId ?? -1) && p.role !== 'gk';

      ctx.fillStyle = SHADOW;
      ctx.beginPath();
      ctx.ellipse(x, y + SPRITE_SHADOW_DY, SPRITE_SHADOW_RX, SPRITE_SHADOW_RY, 0, 0, Math.PI * 2);
      ctx.fill();

      // G11-2 still drives the dive: a SCREEN timer started by 'gk-catch'. G15-3 turns
      // it into two sprite frames chosen by the fraction of the gesture, pointed where
      // the gesture stored (the ball one step before the catch).
      const gesture = p.role === 'gk' ? gestureProgress(gestures, p.id, match.stepCount) : GESTURE_IDLE;
      choosePlayerSprite(
        p, match.stepCount, shootout, parked, gesture, gestures.dirX[p.id], gestures.dirY[p.id], spriteChoice,
      );
      // G12-1: the keeper ALWAYS paints from the reserved atlas, never its team's.
      const atlas = p.role === 'gk' ? atlasKeeper : p.team === HOME ? atlasHome : atlasAway;
      const sx = atlasCellX(spriteChoice.octant);
      const sy = atlasCellY(spriteChoice.pose);
      // Whole pixels, or the pixel art shimmers while the camera glides.
      const px = Math.round(x);
      const py = Math.round(y);
      if (spriteChoice.tilt === 0) {
        ctx.drawImage(atlas, sx, sy, SPRITE_SIZE, SPRITE_SIZE, px - SPRITE_HALF, py - SPRITE_HALF, SPRITE_SIZE, SPRITE_SIZE);
      } else {
        // G15-3: the slide is the run sprite tilted. cos/sin were computed once at
        // module load; the transform is undone on the very next line.
        const s = SLIDE_TILT_SIN * spriteChoice.tilt;
        ctx.setTransform(SLIDE_TILT_COS, s, -s, SLIDE_TILT_COS, px, py);
        ctx.drawImage(atlas, sx, sy, SPRITE_SIZE, SPRITE_SIZE, -SPRITE_HALF, -SPRITE_HALF, SPRITE_SIZE, SPRITE_SIZE);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
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
      // that a long pass is going over the defenders' heads. G11-3 adds the two the
      // 11-sep QA asked for, with NO change to SHOT_VZ_MAX or the gravity: the shadow
      // SHRINKS and FADES as the ball climbs, and the ball itself GROWS. globalAlpha
      // is a number, so the fade costs no 'rgba(...)' string per frame (criterion 20).
      const shadow = ballShadowScale(b.z);
      ctx.globalAlpha = ballShadowFade(b.z);
      ctx.fillStyle = SHADOW;
      ctx.beginPath();
      ctx.ellipse(x, y, BALL_RADIUS * shadow, 3.5 * shadow, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = BALL_COLOR;
      ctx.beginPath();
      ctx.arc(x, y - ballLift(b.z), BALL_RADIUS * ballScale(b.z), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = BALL_TRIM;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // G12-2: the direction indicator itself, shared by the set piece and the
    // keeper's own hold (drawKeeperAim below) so the two stay pixel-identical
    // without duplicating the block. Primitives only, (dirX, dirY) already a unit
    // vector -- no Vec2, no allocation.
    function drawAimIndicator(ax: number, ay: number, dirX: number, dirY: number): void {
      ctx.strokeStyle = HUD_ACCENT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + dirX * 70, ay + dirY * 70);
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
      drawAimIndicator(x, y, sp.dirX, sp.dirY);
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

    // G12-2: the same indicator while a HUMAN team's own keeper holds the ball in
    // live play, anchored on him and following that team's current pad direction --
    // the very input applyKeeperButtons (actions.ts) normalizes into the aim of the
    // short/long pass on a button press. keeperHoldTeam already carries both guards
    // (run.human[team], ball.owner is that team's gk -- see runStep point 6); the
    // isOpenPlay check here rules out a goal kick or a shootout penalty, which draw
    // their own indicator through drawSetPiece. No countdown text: that lives in
    // drawHud's own hint. A neutral stick (dx = dy = 0) draws nothing, same as a set
    // piece never sees the zero vector.
    function drawKeeperAim(): void {
      const match = run.match;
      if (keeperHoldTeam === -1 || !isOpenPlay(match.phase)) return;
      const input = run.inputs[keeperHoldTeam];
      if (input.dx === 0 && input.dy === 0) return;
      const len = Math.sqrt(input.dx * input.dx + input.dy * input.dy);
      const gk = match.players[keeperHoldTeam * TEAM_SIZE];
      drawAimIndicator(toScreenX(cam, gk.x), toScreenY(cam, gk.y), input.dx / len, input.dy / len);
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
        ctx.fillStyle = matchKits[p.team].primary;
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
      ctx.fillStyle = matchKits[HOME].primary;
      ctx.fillText(match.teams[HOME].name, 12, HUD_H / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = matchKits[AWAY].primary;
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
        // Cached like cachedShootoutLabel above: rebuilt on an edge (runStep point 4),
        // not on every frame of the shootout's still ball and countdown.
        ctx.fillText(cachedShootoutScore, VIEW_W / 2, HUD_H + 34);
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
      // names the keys of the table in use (keeperHintFor).
      if (keeperHoldTeam !== -1 && isOpenPlay(match.phase)) {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HUD_ACCENT;
        const left = countdownSeconds(KEEPER_HOLD_STEPS - keeperHoldSteps);
        const hint = keeperHintFor(tables[keeperHoldTeam]);
        ctx.fillText(hint + smallNumber(left), VIEW_W / 2, HUD_H + 16);
      }

      if (flow.phase === 'spectate') {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HUD_ACCENT;
        ctx.fillText(CONTROL_HINTS[flow.keyScheme].spectate, VIEW_W / 2, HUD_H + 16);
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
      // G15-6: the key-scheme row, changed with left/right from any card. Dimmed while
      // AMISTOSO A DOS is highlighted: G9-2's split is fixed there.
      const hints = CONTROL_HINTS[flow.keyScheme];
      const two = flowHumanCount(flow) === 2;
      ctx.textAlign = 'center';
      ctx.font = FONT_MENU_BLURB;
      ctx.fillStyle = two ? DIM_TEXT : HUD_ACCENT;
      ctx.fillText(hints.schemeRow, VIEW_W / 2, MODE_SCHEME_ROW_Y);
      ctx.font = FONT_SMALL;
      ctx.fillStyle = two ? DIM_TEXT : HUD_TEXT;
      ctx.fillText(two ? TWO_PLAYER_SCHEME_NOTE : hints.schemeDetail, VIEW_W / 2, MODE_SCHEME_DETAIL_Y);
      drawHint(hints.mode, MODE_HINT_Y);
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
        // G15-9: the card is 140 wide now, so the kit block narrows to 22 and the
        // name starts at x + 36 -- 98 px, enough for ESTADOS UNIDOS (14 chars of
        // bold 11px monospace is about 92 px).
        ctx.fillStyle = def.kit.primary;
        ctx.fillRect(x + 8, y + 12, 22, 34);
        ctx.fillStyle = def.kit.secondary;
        ctx.fillRect(x + 8, y + 12, 22, 6);
        ctx.font = FONT_HALF;
        ctx.textAlign = 'left';
        ctx.fillStyle = taken ? DIM_TEXT : selected ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(def.name, x + 36, y + TEAM_CARD_H / 2);
        if (taken) {
          ctx.textAlign = 'right';
          ctx.fillStyle = DIM_TEXT;
          ctx.fillText(TAKEN_TAG, x + TEAM_CARD_W - 6, y + 12);
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
        ctx.fillText(labels[i], formationLabelX(i), FORMATION_ROW_Y);
      }
      drawFormationPreview(
        FORMATIONS[flow.formation[picking]], TEAMS[flow.cursor],
        TEAM_PREVIEW_X, TEAM_PREVIEW_Y, TEAM_PREVIEW_W, TEAM_PREVIEW_H,
      );
      drawHint(two ? TEAM_HINTS_TWO[picking] : CONTROL_HINTS[flow.keyScheme].teamSolo, SELECT_HINT_Y);
    }

    // G15-9: the mini pitch. Frame, halfway line, centre circle and one dot per
    // position -- goalkeeper in the fluor green every keeper wears (G12-1), outfield
    // in the selection's own primary with a ring of its secondary so a white kit does
    // not vanish on the grass. No attack arrows (G15-9). Reused by the ALINEACIÓN
    // screen in V15-3-9, which is why it takes its rectangle as arguments.
    function drawFormationPreview(f: Formation, def: TeamDef, x: number, y: number, w: number, h: number): void {
      ctx.fillStyle = GRASS_DARK;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w / 2, y + h);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h / 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = GK_KIT_PRIMARY;
      ctx.beginPath();
      ctx.arc(previewGkX(x, w), previewGkY(y, h), PREVIEW_DOT_R, 0, Math.PI * 2);
      ctx.fill();
      for (let s = 0; s < f.slots.length; s++) {
        const dx = previewSlotX(f, s, x, w);
        const dy = previewSlotY(f, s, y, h);
        ctx.fillStyle = def.kit.primary;
        ctx.beginPath();
        ctx.arc(dx, dy, PREVIEW_DOT_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = def.kit.secondary;
        ctx.beginPath();
        ctx.arc(dx, dy, PREVIEW_DOT_R, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // G15-17: the starters on a mini pitch with shirt number and name, the reserves
    // on the right, and the cursor ring on whichever list is live. Only YOUR team:
    // the rival is drawn from V15-5 on (the draw has not happened yet at this point).
    function drawLineup(): void {
      drawMenuBackground(lineupTitle);
      const f = lineupFormation();
      const def = lineupTeam();
      const l = lineups[lineupHuman()];
      drawFormationPreview(f, def, LINEUP_PITCH_X, LINEUP_PITCH_Y, LINEUP_PITCH_W, LINEUP_PITCH_H);
      ctx.font = FONT_HALF;
      ctx.textAlign = 'center';
      for (let p = 0; p < l.starters.length; p++) {
        const px = p === GK_POSITION
          ? previewGkX(LINEUP_PITCH_X, LINEUP_PITCH_W)
          : previewSlotX(f, p - 1, LINEUP_PITCH_X, LINEUP_PITCH_W);
        const py = p === GK_POSITION
          ? previewGkY(LINEUP_PITCH_Y, LINEUP_PITCH_H)
          : previewSlotY(f, p - 1, LINEUP_PITCH_Y, LINEUP_PITCH_H);
        const live = flow.lineupChoosing === -1 ? p === flow.lineupCursor : p === flow.lineupChoosing;
        if (live) {
          ctx.strokeStyle = HUD_ACCENT;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, LINEUP_CURSOR_RING, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = live ? HUD_ACCENT : HUD_TEXT;
        // H13: the keeper sits at PREVIEW_GK_X (49 px) and the centre back of the
        // 3-3-2 and the 3-2-3 at x = 0.22 (125 px) on the SAME line (y = 0.5). A
        // 12-13 character label is 79-86 px wide, so both under the dot would overlap
        // by ~7 px and the keeper's would run off the left of the pitch. His label
        // goes ABOVE his dot instead; nobody shares that spot.
        ctx.fillText(
          lineupLabels[l.starters[p]], px,
          p === GK_POSITION ? py - LINEUP_LABEL_DY : py + LINEUP_LABEL_DY,
        );
      }
      // The bench: every reserve while browsing, only the legal ones while choosing.
      ctx.textAlign = 'left';
      ctx.font = FONT_SMALL;
      const choosing = flow.lineupChoosing !== -1;
      const count = choosing ? lineupChoiceCount : l.reserves.length;
      for (let i = 0; i < count; i++) {
        const index = choosing ? lineupChoices[i] : l.reserves[i];
        const live = choosing && i === flow.lineupCursor;
        ctx.fillStyle = live ? HUD_ACCENT : choosing ? HUD_TEXT : HUD_DIM;
        ctx.fillText(lineupLabels[index], LINEUP_RESERVE_X, lineupReserveY(i));
      }
      if (lineupStatus !== '') {
        ctx.textAlign = 'center';
        ctx.fillStyle = HUD_ACCENT;
        ctx.fillText(lineupStatus, VIEW_W / 2, LINEUP_STATUS_Y);
      }
      // Fix round 1 (Important #2): the two-player friendly reaches this screen too,
      // where the scheme-keyed hints would name the WRONG player's keys (J2's or a
      // solo scheme's, never J1's C/V/B). lineupEdit has no key letters in it, so it
      // is identical in both CONTROL_HINTS entries and safe to keep reading by scheme
      // even in two-player -- only browse/swap need the per-picker literals.
      const hints = CONTROL_HINTS[flow.keyScheme];
      const two = flowHumanCount(flow) === 2;
      const who = lineupHuman();
      const browse = two ? LINEUP_HINTS_TWO_BROWSE[who] : hints.lineupBrowse;
      const swap = two ? LINEUP_HINTS_TWO_SWAP[who] : hints.lineupSwap;
      drawHint(
        flow.lineupEditing !== -1 ? hints.lineupEdit : flow.lineupChoosing !== -1 ? swap : browse,
        LINEUP_HINT_Y,
      );
    }

    function drawDraw(): void {
      drawMenuBackground(DRAW_TITLE);
      // FONT_TEAM, not FONT_MENU_ITEM: sixteen names in four columns of 200 px.
      ctx.font = FONT_TEAM;
      for (let i = 0; i < drawNames.length; i++) {
        const you = i === drawHumanIndex;
        ctx.textAlign = 'center';
        ctx.fillStyle = you ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(drawNames[i], drawColX(i), drawRowY(i) + DRAW_ROW_H / 2);
        if (you) {
          ctx.font = FONT_SMALL;
          ctx.fillText(YOU_TAG, drawColX(i), drawRowY(i) + DRAW_ROW_H / 2 + 14);
          ctx.font = FONT_TEAM;
        }
      }
      drawHint(CONTROL_HINTS[flow.keyScheme].draw, VIEW_H - 24);
    }

    function drawBracket(): void {
      drawMenuBackground(bracketTitle);
      // FONT_TEAM: the longest possible cross is 33 chars, ~356 px at 18 px monospace,
      // which fits a 400 px column; at FONT_MENU_ITEM it would be ~435 and spill over.
      ctx.font = FONT_TEAM;
      for (let p = 0; p < bracketRows; p++) {
        const cx = bracketColX(p, bracketRows);
        const y = bracketRowY(p, bracketRows) + BRACKET_ROW_H / 2;
        const live = bracketRowIsHuman[p] ? HUD_ACCENT : HUD_TEXT;
        // Paco's (b): once a cross is resolved, the side that went out stays in its
        // own row, dimmed. No ELIMINADOS line, no "QUEDAN N" counter.
        ctx.textAlign = 'right';
        ctx.fillStyle = bracketRowLoser[p] === 0 ? DIM_TEXT : live;
        ctx.fillText(bracketRowHome[p], cx + bracketRowHomeDx[p], y);
        ctx.textAlign = 'center';
        ctx.fillStyle = live;
        ctx.fillText(bracketRowMid[p], cx, y);
        ctx.textAlign = 'left';
        ctx.fillStyle = bracketRowLoser[p] === 1 ? DIM_TEXT : live;
        ctx.fillText(bracketRowAway[p], cx + bracketRowAwayDx[p], y);
        if (bracketRowIsHuman[p]) {
          // To the LEFT of the row, left-aligned from cx - 190: at cx + 190 on the
          // right-hand column (600) the tag would start at 790 and run past the 800 px
          // canvas; right-aligning at cx - 190 on the left-hand column (200) anchors at
          // x = 10 and the glyphs run backwards past x = 0 (review-5 Important #1).
          // Left-aligning keeps the same anchor but grows the tag rightwards, into the
          // row, which stays inside the canvas in all three cases (see report).
          ctx.font = FONT_SMALL;
          ctx.textAlign = 'left';
          ctx.fillStyle = HUD_ACCENT;
          ctx.fillText(YOU_TAG, cx - 190, y);
          ctx.font = FONT_TEAM;
        }
      }
      ctx.font = FONT_TEAM;
      ctx.textAlign = 'center';
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(bracketPrompt, VIEW_W / 2, BRACKET_PROMPT_Y);
      if (bracketHasChoice) {
        // VER | SALTAR | SALTAR TODOS, the selected one boxed (G9-3, G15-8).
        for (let i = 0; i < BRACKET_CHOICE_COUNT; i++) {
          const x = bracketButtonX(i);
          const selected = flow.bracketChoice === i;
          ctx.fillStyle = CARD_BG;
          ctx.fillRect(x, BRACKET_BUTTON_Y, BRACKET_BUTTON_W, BRACKET_BUTTON_H);
          ctx.strokeStyle = selected ? HUD_ACCENT : CARD_BORDER;
          ctx.lineWidth = selected ? 3 : 1;
          ctx.strokeRect(x, BRACKET_BUTTON_Y, BRACKET_BUTTON_W, BRACKET_BUTTON_H);
          ctx.fillStyle = selected ? HUD_ACCENT : HUD_TEXT;
          ctx.fillText(
            i === 0 ? BRACKET_VER : i === 1 ? BRACKET_SALTAR : BRACKET_SALTAR_TODOS,
            x + BRACKET_BUTTON_W / 2, BRACKET_BUTTON_Y + BRACKET_BUTTON_H / 2,
          );
        }
      }
      drawHint(bracketHasChoice ? CONTROL_HINTS[flow.keyScheme].bracketChoice : CONTROL_HINTS[flow.keyScheme].bracketPlay, BRACKET_HINT_Y);
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
      drawHint(CONTROL_HINTS[flow.keyScheme].victory, VICTORY_HINT_Y);
    }

    function drawMatch(): void {
      drawPitch();
      drawPlayers();
      drawBall();
      drawSetPiece();
      drawKeeperAim();
      drawMinimap();
      drawHud();
      drawCaption();
    }

    function draw(): void {
      switch (flow.phase) {
        case 'mode-select': drawModeSelect(); break;
        case 'team-select': drawTeamSelect(); break;
        case 'lineup': drawLineup(); break;
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
      // G15-20: the gamepads are polled first, so this frame's update sees their input.
      pollGamepadFrame();
      update(frameMs);
      draw();
      // G10-4: after draw(), same reasoning -- the phase this frame just drew is the
      // one worth reporting, and reportPhase is a no-op on every frame but the edge.
      reportPhase();
      rafId = requestAnimationFrame(loop);
    }

    function isTypingTarget(e: KeyboardEvent): boolean {
      const target = e.target as HTMLElement | null;
      return (
        target !== null &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      );
    }

    // G15-6: the menus read the ACTIVE solo scheme (Flechas or Clásico), never a fixed
    // table; the two-player team selector keeps each player's own table (G9-2), so J2
    // picks with the arrows and J while J1 holds WASD and C.
    function menuTable(): KeyTable {
      return SOLO_TABLES_BY_SCHEME[flow.keyScheme][0];
    }

    function tableForPicker(): KeyTable {
      return flowHumanCount(flow) === 2 ? TWO_PLAYER_TABLES[flowPickingHuman(flow)] : menuTable();
    }

    // The pair of tables isPauseKey looks at: the match's own during a match (so the
    // two-player friendly pauses on P whatever scheme is stored), the two players' on
    // their selector, and the chosen scheme on every other screen.
    function pauseTables(): readonly [KeyTable, KeyTable] {
      const phase = flow.phase;
      if (phase === 'match' || phase === 'over' || phase === 'spectate') return tables;
      if ((phase === 'team-select' || phase === 'lineup') && flowHumanCount(flow) === 2) return TWO_PLAYER_TABLES;
      return SOLO_TABLES_BY_SCHEME[flow.keyScheme];
    }

    function requestPause(): void {
      const cb = onPauseToggleRef.current;
      if (cb !== undefined) cb();
    }

    function toggleKeyScheme(): void {
      flowToggleKeyScheme(flow);
      saveKeyScheme(writeStoredScheme, flow.keyScheme);
    }

    // One action per pad key on the menu screen showing now. The keyboard (through the
    // menu table) and, from V15-2-7, the gamepad both land here. false = the key means
    // nothing on this screen, so the keyboard handler must not preventDefault it.
    function menuAction(k: PadKey): boolean {
      const phase = flow.phase;
      switch (phase) {
        case 'mode-select':
          if (k === 'up') flowMoveMode(flow, -1);
          else if (k === 'down') flowMoveMode(flow, 1);
          else if (k === 'left' || k === 'right') toggleKeyScheme();
          else if (k === 'a') flowConfirmMode(flow);
          else return false;
          return true;
        case 'team-select':
          if (k === 'up') flowMoveTeam(flow, 0, -1, TEAMS.length);
          else if (k === 'down') flowMoveTeam(flow, 0, 1, TEAMS.length);
          else if (k === 'left') flowMoveTeam(flow, -1, 0, TEAMS.length);
          else if (k === 'right') flowMoveTeam(flow, 1, 0, TEAMS.length);
          else if (k === 'a') confirmTeam();
          else return false;
          return true;
        case 'lineup': {
          const f2 = lineupFormation();
          const l = lineups[lineupHuman()];
          if (k === 'up' || k === 'left') flowLineupMove(flow, -1, flow.lineupChoosing === -1 ? l.starters.length : lineupChoiceCount);
          else if (k === 'down' || k === 'right') flowLineupMove(flow, 1, flow.lineupChoosing === -1 ? l.starters.length : lineupChoiceCount);
          else if (k === 'a') {
            if (flow.lineupChoosing === -1) flowLineupChoose(flow, flow.lineupCursor);
            else {
              const incoming = lineupCursorIndex();
              if (incoming !== -1) applySwap(f2, l, flow.lineupChoosing, incoming);
              flowLineupCancelChoice(flow);
            }
          } else if (k === 'b') {
            // Paco's (d): B is the back/cancel button. Mid-substitution it cancels;
            // browsing, it leaves ALINEACIÓN (J2's turn, or build the mode).
            if (flow.lineupChoosing !== -1) flowLineupCancelChoice(flow);
            else {
              confirmLineup();
              // The screen may be gone; refreshing a dead one would read the next team.
              if (flow.phase !== 'lineup') return true;
            }
          } else if (k === 'c') {
            // Paco's (d): C opens the name editor. It does nothing mid-substitution.
            if (flow.lineupChoosing === -1) {
              const target = lineupCursorIndex();
              if (target !== -1) flowLineupBeginEdit(flow, target);
            }
          } else return false;
          refreshLineupView();
          return true;
        }
        case 'draw':
          if (k !== 'a') return false;
          flowConfirmDraw(flow);
          refreshBracketView();
          return true;
        case 'bracket':
          if (k === 'left') flowMoveBracketChoice(flow, -1);
          else if (k === 'right') flowMoveBracketChoice(flow, 1);
          else if (k === 'a') confirmBracket();
          else return false;
          return true;
        case 'spectate':
          if (k !== 'a') return false;
          skipSpectate();
          return true;
        case 'victory':
          if (k !== 'a') return false;
          continueFromVictory();
          return true;
        case 'match':
        case 'over':
          return false;
      }
    }

    // G15-20, once per frame before update(). Start pauses (and un-pauses) on any
    // screen. While paused or blocked nothing else is read and the gamepad pads are
    // lifted with no edge, every frame: a button held through the pause must not fire
    // on resume (padClear's rule). In a match each pad drives its team; on the menus a
    // fresh push or press is one menuAction -- the keyboard's own path. pollGamepads
    // itself only runs while gamepadSeen (pre-flight H8, see above): otherwise
    // gamepads[] just keeps reading as disconnected, so everything below is a no-op.
    function pollGamepadFrame(): void {
      if (gamepadSeen) pollGamepads(gamepads);
      if (gamepads[0].edge.start === 'pressed' || gamepads[1].edge.start === 'pressed') requestPause();
      if (pausedRef.current || blocked) {
        padBlur(gamepadPads[0]);
        padBlur(gamepadPads[1]);
        return;
      }
      if (flow.phase === 'match') {
        routeMatchGamepad(0);
        routeMatchGamepad(1);
        return;
      }
      // Fix round 1, finding 2: a menu is a single-input screen, like the keyboard's
      // own menuTable() (one table, not two) -- so only mando 1 drives it, or two
      // pads both pressing the same frame would fire menuAction twice (double
      // confirm, cursor jumping two rows). The two-player team selector and, since
      // fix round 1 of Task 9 (Minor #3), the two-player ALINEACIÓN are the screens
      // with two real pickers, and routeMenuGamepad already restricts each slot to
      // its own player there -- matching pauseTables' own '|| lineup'.
      routeMenuGamepad(0);
      if ((flow.phase === 'team-select' || flow.phase === 'lineup') && flowHumanCount(flow) === 2) routeMenuGamepad(1);
    }

    // Mando 1 = J1 (team 0) and mando 2 = J2 (team 1) in the two-player friendly; alone,
    // mando 1 plays the human's side and mando 2 is ignored (G15-20). A pad that is gone
    // lifts its team's gamepad pad with no edge.
    function routeMatchGamepad(slot: 0 | 1): void {
      const side = humanSide;
      let team: 0 | 1;
      if (side === 'both') team = slot;
      else if (side === 'none' || slot === 1) return;
      else team = side;
      const gp = gamepads[slot];
      if (!gp.connected) {
        padBlur(gamepadPads[team]);
        return;
      }
      routeGamepadToPad(gp, gamepadPads[team]);
      routeGamepadStrategy(gp, pads[team]);
    }

    // On the two-player team selector AND, since fix round 1 of Task 9, the two-player
    // ALINEACIÓN, each pad picks/edits for its own player (mando 1 = J1). Every other
    // menu is only ever called with slot 0 (fix round 1, finding 2): this guard is
    // what makes mando 2 a no-op there, matching the keyboard's own single menuTable().
    function routeMenuGamepad(slot: 0 | 1): void {
      const gp = gamepads[slot];
      if (!gp.connected) return;
      if ((flow.phase === 'team-select' || flow.phase === 'lineup') && flowHumanCount(flow) === 2 && flowPickingHuman(flow) !== slot) return;
      for (let i = 0; i < PAD_KEYS.length; i++) {
        const k = PAD_KEYS[i];
        if (gp.edge[k] !== 'pressed') continue;
        ensureSfx();
        menuAction(k);
      }
    }

    // QA fix (2026-09-11): the lazy audio setup used to run unguarded before the menu
    // dispatch. A throw here (autoplay policy, a bad SFX_VOLUME entry after a future
    // edit) would abort the CURRENT key -- including a first-ever confirm on ELIGE
    // MODO -- while sfxReady is already latched true, so every later key silently
    // skips this block and looks fine. sfx is best-effort; it must never eat the
    // input that triggered it. G15-20: the gamepad's first menu press calls it too.
    function ensureSfx(): void {
      if (sfxReady) return;
      sfxReady = true;
      try {
        sfxVaultWorldCup.init();
        sfxVaultWorldCup.setMuted(mutedRef.current);
      } catch {
        // no-op: the menu/match dispatch still has to run this frame.
      }
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (isTypingTarget(e)) return;
      ensureSfx();
      const key = e.key.toLowerCase();
      // G15-6: Esc always; P only while no active table reads it. BEFORE the paused
      // guard, or the key could never lift the pause it set.
      // Fix round 1 (Important #1): while a lineup name is being typed, 'p' is a
      // LETTER, not the pause key -- ARROWS_SOLO and both two-player tables don't map
      // it, so isPauseKey would treat it as Esc's understudy and swallow it before the
      // editing interceptor below ever runs, making any name with a P untypable under
      // the default FLECHAS scheme and in the two-player friendly. Esc itself keeps
      // priority over editing, exactly as the brief says ("lo único que sigue
      // teniendo prioridad sobre la edición es isPauseKey (Esc)").
      const editingLineupName = flow.phase === 'lineup' && flow.lineupEditing !== -1;
      if (isPauseKey(key, pauseTables()) && !(editingLineupName && key === 'p')) {
        e.preventDefault();
        if (!e.repeat) requestPause();
        return;
      }
      if (pausedRef.current || blocked) return;
      // G15-17: while a name is being typed, the letters ARE the input -- they must
      // not reach padKeyFor, or CLÁSICO's Q/A/O/P would move the cursor instead of
      // writing. Esc (the pause) is the only thing above this, and it already ran.
      if (editingLineupName) {
        const editing = flow.lineupEditing;
        const l = lineups[lineupHuman()];
        if (e.key === 'Enter') {
          lineupEndEdit(l, editing);
          flowLineupEndEdit(flow);
        } else if (e.key === 'Backspace') {
          lineupBackspace(l, editing);
        } else if ([...e.key].length !== 1 || !lineupTypeChar(l, editing, e.key)) {
          return;
        }
        e.preventDefault();
        refreshLineupView();
        return;
      }
      if (e.repeat) return;   // auto-repeat is not a new press: the pad edges are ours
      const phase = flow.phase;
      if (phase === 'over') return;
      if (phase === 'match') {
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
      const table = phase === 'team-select' || phase === 'lineup' ? tableForPicker() : menuTable();
      const k = padKeyFor(table, key);
      if (k !== null && menuAction(k)) {
        e.preventDefault();
        return;
      }
      // Cheap minor: only the FORMATION row of the picker's table is routed here --
      // a strategy key (4/5/6, 0 ' ¡) is a mid-match choice and must not
      // preventDefault or touch the pad at this screen.
      if (phase === 'team-select') {
        const picker = flowPickingHuman(flow);
        if (padFormationChoice(pads[picker], table, key)) {
          flowSetFormation(flow, picker, pads[picker].formation);
          e.preventDefault();
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent): void {
      const key = e.key.toLowerCase();
      for (let t = 0; t < 2; t++) {
        // Fix round 1, finding 3: in solo mode tables = the chosen scheme's pair, so an unfiltered
        // loop would also padUp the CPU's own pad, which never gets a matching padDown.
        if (!run.human[t]) continue;
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
      padBlur(gamepadPads[0]);
      padBlur(gamepadPads[1]);
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
      // G10-5: once per blocking edge, not exactly once overall — the guard above
      // (`if (blocked) return;`) makes this line unreachable on a second resize while
      // still blocked, but the allowed branch resets `blocked` on a menu screen, so
      // shrinking again later re-fires this callback.
      const cb = onViewportBlockedRef.current;
      if (cb !== undefined) cb();
      if (flow.phase === 'spectate') {
        skipSpectate();
        return;
      }
      if (flow.phase !== 'match') return;
      const match = run.match;
      updateWatch(match, watch);
      abandon(match);
      // S-SC12 / G9-8 (Fix round 1, finding 1): the standing result as a CAPTION (never
      // a screen under the panel), with its whistle (I2 of the step-8 review), same
      // order as step 8. modeScores(mode) is true only for the World Cup: there,
      // abandoning always eliminates (G9-8), whatever the score stood at, matching
      // endHumanMatch -> flowMatchOver -> abandonHumanMatch below. A friendly keeps
      // S-SC12's GANADOR/EMPATE-by-score semantics (abandonEliminates defaults to false).
      const beforeBlocked = captions.kind;
      // Cheap minor: an untimed match (training) has no score to report -- FINAL
      // alone, never GANADOR/ELIMINADO/EMPATE. Read off match.rules.timed, never a
      // mode-kind branch (Global Constraints: no mode branch in the .tsx).
      if (match.rules.timed) collectCaptions(match, watch, humanSide, captions, false, modeScores(mode));
      else pushCaption(captions, 'full-time');
      playCaptionEdge(beforeBlocked);
      updateWatch(match, watch);
      padBlur(pads[0]);
      padBlur(pads[1]);
      endHumanMatch(true);
    }

    handleResize();
    reportStatus(STATUS_SELECTOR);
    reportPhase();
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
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
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
