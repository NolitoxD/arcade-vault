import { winnerOf, type MatchState } from '../football-logic/match';
import {
  createFriendlyMode, createWorldCupMode, drawRival, drawSeedFor, modeAbandonMatch, modeBracket, modeEndMatch, modeRules,
  modeStatus, type GameMode, type GameModeKind,
} from '../football-logic/mode';
import { createRng } from '../football-logic/rng';
import { nextCpuPair, resolveCpuMatch } from '../football-logic/world-cup';
import { TEAM_GRID_COLS } from './flow-layout';
import { DEFAULT_KEY_SCHEME, type KeyScheme } from './keyboard';

// G9-9: the flow lives inside the component, one canvas, one loop -- and its phase
// machine lives HERE, pure and tested, so VaultWorldCupGame.tsx only asks and draws.
// The component calls these on key events and on the match ending; nothing here reads
// the keyboard, the clock or the DOM, and nothing allocates after createFlowState.
export type FlowPhase =
  | 'mode-select'   // the four modes
  | 'team-select'   // the twenty, with the formation selector (G9-4, G9-5, G15-9)
  | 'lineup'        // G15-17: starters, reserves and names, before a friendly or the World Cup
  | 'draw'          // the World Cup's sixteen, drawn
  | 'bracket'       // the round's pairs; VER / SALTAR per CPU pair, then the human's match
  | 'match'         // a match with at least one human
  | 'spectate'      // a CPU pair watched at x4 (G9-3)
  | 'victory'       // GANADOR / CAMPEONES DEL MUNDO, CONTINUAR
  | 'over';         // the match ended: the captions drain, then `after`

// G10-4: which of the two tracks the play-page's music belongs to. 'match' is the
// only two phases with a game actually running -- a played match and a spectated
// CPU pair; the other six (every menu, the draw, the bracket, the victory screen,
// and the caption drain of 'over') are 'menu'. The pause is deliberately NOT a
// phase here: the play-page reads `paused` from its own prop (spec L464: the lobby
// track also covers the pause), not from this function.
export type PhaseGroup = 'menu' | 'match';

// Exhaustive switch (pattern of modeVictoryScreen in mode.ts): a ninth FlowPhase
// with no case here fails tsc instead of silently falling into 'menu'.
export function phaseGroup(phase: FlowPhase): PhaseGroup {
  switch (phase) {
    case 'match':
    case 'spectate':
      return 'match';
    case 'mode-select':
    case 'team-select':
    case 'lineup':
    case 'draw':
    case 'bracket':
    case 'victory':
    case 'over':
      return 'menu';
  }
}

// G15-8 adds SALTAR TODOS: the same resolution as SALTAR, for every CPU pair left.
export type BracketAction = 'spectate' | 'skip' | 'skip-all' | 'play';
export const BRACKET_CHOICE_COUNT = 3;

export const MODE_LIST: readonly GameModeKind[] = ['friendly-cpu', 'friendly-2p', 'training', 'world-cup'];

export const MODE_NAMES: Readonly<Record<GameModeKind, string>> = {
  'friendly-cpu': 'AMISTOSO',
  'friendly-2p': 'AMISTOSO A DOS',
  training: 'ENTRENAMIENTO',
  'world-cup': 'MUNDIAL',
};

export const MODE_BLURBS: Readonly<Record<GameModeKind, string>> = {
  'friendly-cpu': 'UN PARTIDO CONTRA LA CPU · RIVAL SORTEADO',
  'friendly-2p': 'DOS EN EL MISMO TECLADO · J1 WASD + C/V/B · J2 FLECHAS + J/K/L',
  training: 'SIN RELOJ · EL RIVAL NO SE MUEVE, SOLO SU PORTERO · R PARA SALIR',
  'world-cup': '16 SELECCIONES SORTEADAS · 4 PARTIDOS · SIN CONTINUE · PUNTÚA',
};

export const HUMANS_BY_MODE: Readonly<Record<GameModeKind, 1 | 2>> = {
  'friendly-cpu': 1,
  'friendly-2p': 2,
  training: 1,
  'world-cup': 1,
};

// G15-17: only a friendly (either one) and the World Cup show ALINEACIÓN; the training
// is a practice screen and goes straight to the pitch.
export const LINEUP_BY_MODE: Readonly<Record<GameModeKind, boolean>> = {
  'friendly-cpu': true,
  'friendly-2p': true,
  training: false,
  'world-cup': true,
};

export type FlowState = {
  phase: FlowPhase;
  modeIndex: number;            // cursor on MODE_LIST; survives a reset (the last mode played)
  picking: 0 | 1;               // which human is choosing on team-select
  cursor: number;               // team index under the cursor
  picked: [number, number];     // team indices chosen, -1 = none
  formation: [number, number];  // per human; 0 = 3-3-2 (G9-5)
  bracketChoice: 0 | 1 | 2;     // 0 = VER, 1 = SALTAR, 2 = SALTAR TODOS (G15-8)
  lineupCursor: number;         // G15-17: the position, or the reserve while choosing
  lineupChoosing: number;       // the position being substituted, -1 = browsing
  lineupEditing: number;        // the squad index whose name is being typed, -1 = none
  after: FlowPhase;             // where 'over' goes once the captions drain
  keyScheme: KeyScheme;         // G15-6: Flechas or Clásico; a preference, so it survives a reset
};

export function createFlowState(): FlowState {
  return {
    phase: 'mode-select', modeIndex: 0, picking: 0, cursor: 0, picked: [-1, -1], formation: [0, 0], bracketChoice: 0,
    lineupCursor: 0, lineupChoosing: -1, lineupEditing: -1,
    after: 'mode-select', keyScheme: DEFAULT_KEY_SCHEME,
  };
}

// Back to the mode selector, in place. modeIndex is kept on purpose: "otra vez" lands
// on the mode just played.
export function flowReset(f: FlowState): void {
  f.phase = 'mode-select';
  f.picking = 0;
  f.cursor = 0;
  f.picked[0] = -1;
  f.picked[1] = -1;
  f.formation[0] = 0;
  f.formation[1] = 0;
  f.bracketChoice = 0;
  f.lineupCursor = 0;
  f.lineupChoosing = -1;
  f.lineupEditing = -1;
  f.after = 'mode-select';
}

export function flowModeKind(f: FlowState): GameModeKind {
  return MODE_LIST[f.modeIndex];
}

export function flowHumanCount(f: FlowState): 1 | 2 {
  return HUMANS_BY_MODE[flowModeKind(f)];
}

export function flowHasLineup(f: FlowState): boolean {
  return LINEUP_BY_MODE[flowModeKind(f)];
}

function resetLineupCursor(f: FlowState): void {
  f.lineupCursor = 0;
  f.lineupChoosing = -1;
  f.lineupEditing = -1;
}

export function flowPickingHuman(f: FlowState): 0 | 1 {
  return f.picking;
}

// ── mode-select ─────────────────────────────────────────────────────────────────

export function flowMoveMode(f: FlowState, delta: number): void {
  if (f.phase !== 'mode-select') return;
  const n = MODE_LIST.length;
  f.modeIndex = (((f.modeIndex + delta) % n) + n) % n;
}

export function flowConfirmMode(f: FlowState): void {
  if (f.phase !== 'mode-select') return;
  f.phase = 'team-select';
  f.picking = 0;
  f.cursor = 0;
  f.picked[0] = -1;
  f.picked[1] = -1;
  f.formation[0] = 0;
  f.formation[1] = 0;
}

// G15-6: the key-scheme row of ELIGE MODO, flipped with left/right from any card.
export function flowToggleKeyScheme(f: FlowState): void {
  if (f.phase !== 'mode-select') return;
  f.keyScheme = f.keyScheme === 'arrows' ? 'classic' : 'arrows';
}

// Loads the stored choice (the component reads localStorage once, at mount).
export function flowSetKeyScheme(f: FlowState, scheme: KeyScheme): void {
  f.keyScheme = scheme;
}

// ── team-select ─────────────────────────────────────────────────────────────────

// A TEAM_GRID_COLS-wide grid over the bank (five since G15-9), wrapping on both axes;
// a wrap that lands past the bank (a bank that is not a multiple of the column count)
// leaves the cursor where it was.
export function flowMoveTeam(f: FlowState, dx: number, dy: number, bankSize: number): void {
  if (f.phase !== 'team-select') return;
  const cols = TEAM_GRID_COLS;
  const rows = Math.ceil(bankSize / cols);
  const col = (((f.cursor % cols) + dx) % cols + cols) % cols;
  const row = (((Math.floor(f.cursor / cols)) + dy) % rows + rows) % rows;
  const next = row * cols + col;
  if (next < bankSize) f.cursor = next;
}

// G9-5: the formation is chosen on the selector with the same keys as in the match
// (padChoice on the human's own table); the component mirrors the pad here so the
// mode can be built from the flow alone.
export function flowSetFormation(f: FlowState, human: 0 | 1, formation: number): void {
  f.formation[human] = formation;
}

// G9-4: solo modes pick one team; the two-player friendly picks J1 and then J2, and
// J2 may not repeat J1's team. G15-17: once every team is picked, a mode with a
// lineup screen goes there (J1's first, then J2's) instead of straight to the mode.
export function flowConfirmTeam(f: FlowState, bankSize: number): 'next' | 'lineup' | 'done' | 'refused' {
  if (f.phase !== 'team-select') return 'refused';
  if (f.cursor < 0 || f.cursor >= bankSize) return 'refused';
  if (f.picking === 1 && f.cursor === f.picked[0]) return 'refused';
  f.picked[f.picking] = f.cursor;
  if (f.picking === 0 && flowHumanCount(f) === 2) {
    f.picking = 1;
    return 'next';
  }
  if (!flowHasLineup(f)) return 'done';
  f.phase = 'lineup';
  f.picking = 0;
  resetLineupCursor(f);
  return 'lineup';
}

// The ONE place a mode is built (Vault Fighter's confirmSelection). G9-4: the CPU
// friendly and the training draw their rival; the two-player friendly takes J2's
// pick; the World Cup draws seven of the fifteen. G9-7: everything comes off `seed`.
export function flowBuildMode(f: FlowState, bankIds: readonly string[], seed: number): GameMode {
  const kind = flowModeKind(f);
  const homeId = bankIds[f.picked[0]];
  if (kind === 'world-cup') return createWorldCupMode(bankIds, homeId, seed);
  const awayId = kind === 'friendly-2p' ? bankIds[f.picked[1]] : drawRival(bankIds, homeId, createRng(drawSeedFor(seed)));
  return createFriendlyMode(kind, homeId, awayId);
}

// A mode with a bracket shows the draw first; one without goes straight to the match.
// The question is "does this mode have a bracket", never "which mode is it".
export function flowAfterModeBuilt(f: FlowState, m: GameMode): void {
  if (f.phase !== 'team-select' && f.phase !== 'lineup') return;
  f.phase = modeBracket(m) === null ? 'match' : 'draw';
}

// ── lineup (G15-17) ─────────────────────────────────────────────────────────────

// The cursor wraps over whatever list the screen is showing -- the positions while
// browsing, the legal reserves while choosing. The COUNT comes from the component,
// which is the one holding the Lineup: the flow never hard-codes a team size.
export function flowLineupMove(f: FlowState, delta: number, count: number): void {
  if (f.phase !== 'lineup' || f.lineupEditing !== -1 || count <= 0) return;
  f.lineupCursor = (((f.lineupCursor + delta) % count) + count) % count;
}

export function flowLineupChoose(f: FlowState, position: number): void {
  if (f.phase !== 'lineup' || f.lineupEditing !== -1) return;
  f.lineupChoosing = position;
  f.lineupCursor = 0;
}

export function flowLineupCancelChoice(f: FlowState): void {
  if (f.phase !== 'lineup' || f.lineupChoosing === -1) return;
  f.lineupCursor = f.lineupChoosing;
  f.lineupChoosing = -1;
}

export function flowLineupBeginEdit(f: FlowState, squadIndex: number): void {
  if (f.phase !== 'lineup' || f.lineupChoosing !== -1) return;
  f.lineupEditing = squadIndex;
}

export function flowLineupEndEdit(f: FlowState): void {
  if (f.phase !== 'lineup') return;
  f.lineupEditing = -1;
}

// B on ALINEACIÓN (Paco's (d): B is the back/leave button of every screen): J2's turn
// in the two-player friendly, or "the component may build the mode now". Refused
// ('none') while a substitution or an edit is open -- there B cancels instead, so a
// half finished change never starts a match.
export function flowConfirmLineup(f: FlowState): 'next' | 'done' | 'none' {
  if (f.phase !== 'lineup') return 'none';
  if (f.lineupChoosing !== -1 || f.lineupEditing !== -1) return 'none';
  if (f.picking === 0 && flowHumanCount(f) === 2) {
    f.picking = 1;
    resetLineupCursor(f);
    return 'next';
  }
  return 'done';
}

// ── draw ────────────────────────────────────────────────────────────────────────

export function flowConfirmDraw(f: FlowState): void {
  if (f.phase !== 'draw') return;
  f.phase = 'bracket';
  f.bracketChoice = 0;
}

// ── bracket (G9-3) ──────────────────────────────────────────────────────────────

// The next CPU pair of the round still to resolve, or -1 when the human's match is up.
export function flowCpuPair(m: GameMode): number {
  const wc = modeBracket(m);
  return wc === null ? -1 : nextCpuPair(wc);
}

export function flowBracketAction(f: FlowState, m: GameMode): BracketAction {
  if (flowCpuPair(m) === -1) return 'play';
  if (f.bracketChoice === 0) return 'spectate';
  return f.bracketChoice === 1 ? 'skip' : 'skip-all';
}

// Directional with a stop at each end (the decision of the v1 fix wave, extended by
// G15-8 to three): a repeated press in the same direction leaves the choice where it
// is instead of wrapping round to VER.
export function flowMoveBracketChoice(f: FlowState, delta: number): void {
  if (f.phase !== 'bracket' || delta === 0) return;
  if (delta < 0) {
    if (f.bracketChoice === 2) f.bracketChoice = 1;
    else if (f.bracketChoice === 1) f.bracketChoice = 0;
    return;
  }
  if (f.bracketChoice === 0) f.bracketChoice = 1;
  else if (f.bracketChoice === 1) f.bracketChoice = 2;
}

// A on the bracket. 'spectate' moves to the spectate phase (the component starts the
// CPU run on screen); 'skip' and 'skip-all' stay here (the component resolves the pair,
// or every pair left, headless and refreshes the screen); 'play' moves to the match.
// 'none' outside the bracket phase.
export function flowConfirmBracket(f: FlowState, m: GameMode): BracketAction | 'none' {
  if (f.phase !== 'bracket') return 'none';
  const action = flowBracketAction(f, m);
  if (action === 'spectate') f.phase = 'spectate';
  else if (action === 'play') f.phase = 'match';
  // 'skip' and 'skip-all' stay on the bracket: the component resolves the pair (or
  // every pair left) headless and refreshes the screen.
  return action;
}

// Records a CPU pair's result, whichever way it was produced (watched or headless).
// A CPU pair cannot end undecided (finishMatchRun's cap is never hit, its tests say),
// so -1 here is a programming error, not a state.
export function flowRecordCpuResult(m: GameMode, pair: number, match: MatchState): void {
  const wc = modeBracket(m);
  if (wc === null) return;
  const winner = winnerOf(match);
  if (winner === -1) throw new Error('a CPU pair cannot end undecided');
  resolveCpuMatch(wc, pair, winner, match.score[0], match.score[1]);
}

// ── spectate ────────────────────────────────────────────────────────────────────

// The watched match ended by itself: FINAL drains, then back to the bracket.
export function flowSpectateOver(f: FlowState): void {
  if (f.phase !== 'spectate') return;
  f.phase = 'over';
  f.after = 'bracket';
}

// A mid-match: the component has already finished the run headless and recorded it;
// straight back to the bracket, no FINAL.
export function flowSkipSpectate(f: FlowState): void {
  if (f.phase !== 'spectate') return;
  f.phase = 'bracket';
  f.bracketChoice = 0;
}

// ── match ───────────────────────────────────────────────────────────────────────

// The human's match ended, naturally or by the viewport guard (`abandoned`). The mode
// resolves it; the flow only asks the resulting status to know where 'over' goes:
// a champion to the victory screen, a World Cup still playing back to the bracket,
// anything else (eliminated, draw, or any abandon) to the mode selector after the
// caption (spec 60-61).
export function flowMatchOver(f: FlowState, m: GameMode, match: MatchState, abandoned: boolean): void {
  if (f.phase !== 'match') return;
  if (abandoned) modeAbandonMatch(m, match);
  else modeEndMatch(m, match);
  f.phase = 'over';
  const status = modeStatus(m);
  if (abandoned) f.after = 'mode-select';
  else if (status === 'champion') f.after = 'victory';
  else if (status === 'playing') f.after = 'bracket';
  else f.after = 'mode-select';
}

// The caption queue emptied: go where `after` says.
export function flowCaptionsDrained(f: FlowState): void {
  if (f.phase !== 'over') return;
  if (f.after === 'mode-select') {
    flowReset(f);
    return;
  }
  f.phase = f.after;
  if (f.after === 'bracket') f.bracketChoice = 0;
}

// CONTINUAR on the victory screen (spec: back to the mode selector).
export function flowContinue(f: FlowState): void {
  if (f.phase !== 'victory') return;
  flowReset(f);
}

// S-FL4 (G9-1): R leaves a match that has no clock -- the training -- and nothing
// else. The page's own R (restart by remount) only exists after a World Cup ends.
export function flowExitMatch(f: FlowState, m: GameMode): void {
  if (f.phase !== 'match' || modeRules(m).timed) return;
  flowReset(f);
}
