import { VIEW_H, VIEW_W } from './camera';

// The geometry of the six flow screens, as numbers the component draws with. Kept out
// of the .tsx (Global Constraints: a formula in draw() is a formula with no test).
// Every function is integer arithmetic on constants; nothing allocates.

// ── Team selector: the sixteen of the bank in a 4 x 4 grid (G9-4) ──────────────
export const TEAM_GRID_COLS = 4;
export const TEAM_CARD_W = 172;
export const TEAM_CARD_H = 74;
export const TEAM_GRID_GAP_X = 16;
export const TEAM_GRID_GAP_Y = 12;
export const TEAM_GRID_TOP = 78;
// Under the grid: the formation selector (G9-5) and the key hint.
export const FORMATION_ROW_Y = 432;
export const SELECT_HINT_Y = 478;

export function teamGridWidth(bankSize: number): number {
  const cols = bankSize < TEAM_GRID_COLS ? bankSize : TEAM_GRID_COLS;
  return cols * TEAM_CARD_W + (cols - 1) * TEAM_GRID_GAP_X;
}

export function teamCardX(index: number, bankSize: number): number {
  const originX = (VIEW_W - teamGridWidth(bankSize)) / 2;
  return originX + (index % TEAM_GRID_COLS) * (TEAM_CARD_W + TEAM_GRID_GAP_X);
}

export function teamCardY(index: number): number {
  return TEAM_GRID_TOP + Math.floor(index / TEAM_GRID_COLS) * (TEAM_CARD_H + TEAM_GRID_GAP_Y);
}

// ── Mode selector: four cards in a column ───────────────────────────────────────
// exported for Task 9-7: width of a mode card in drawModeSelect
export const MODE_CARD_W = 560;
export const MODE_CARD_H = 66;
export const MODE_CARD_GAP = 14;
export const MODE_CARD_TOP = 108;

export function modeCardY(index: number): number {
  return MODE_CARD_TOP + index * (MODE_CARD_H + MODE_CARD_GAP);
}

// ── Bracket: one row per pair of the round, then the prompt and the fallen ───────
export const BRACKET_ROW_TOP = 96;
export const BRACKET_ROW_H = 40;
// exported for Task 9-7: y of the VER/SALTAR prompt, the ELIMINADOS line and the hint in drawBracket
export const BRACKET_PROMPT_Y = 330;
export const BRACKET_ELIMINATED_Y = 400;
export const BRACKET_HINT_Y = 470;

export function bracketRowY(pair: number): number {
  return BRACKET_ROW_TOP + pair * BRACKET_ROW_H;
}

// ── Draw: the eight in two columns of four ──────────────────────────────────────
export const DRAW_ROW_TOP = 120;
export const DRAW_ROW_H = 36;
export const DRAW_COL_X: readonly [number, number] = [VIEW_W / 2 - 150, VIEW_W / 2 + 150];

export function drawRowY(index: number): number {
  return DRAW_ROW_TOP + (index % 4) * DRAW_ROW_H;
}

export function drawColX(index: number): number {
  return DRAW_COL_X[index < 4 ? 0 : 1];
}

// ── Victory: title, team name, the figure lifting the cup, the hint ─────────────
// exported for Task 9-7: y of the title, the team name and the figure in drawVictory
export const VICTORY_TITLE_Y = 88;
export const VICTORY_TEAM_Y = 150;
export const VICTORY_FIGURE_Y = 320;
export const VICTORY_HINT_Y = VIEW_H - 32;
