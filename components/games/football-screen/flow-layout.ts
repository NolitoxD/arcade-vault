import { VIEW_H, VIEW_W } from './camera';

// The geometry of the six flow screens, as numbers the component draws with. Kept out
// of the .tsx (Global Constraints: a formula in draw() is a formula with no test).
// Every function is integer arithmetic on constants; nothing allocates.

// ── Team selector: the twenty of the bank in a 5 x 4 grid (G9-4, G15-9) ────────
// Twenty in five columns is still FOUR rows, so the grid does not grow downwards:
// the cards get narrower (172 -> 140) and shorter (74 -> 62) instead. 5*140 + 4*12
// = 748 wide (26 px of margin each side) and 76 + 3*72 + 62 = 354 tall, which leaves
// the 354-500 band for the formation row, the mini pitch and the hint.
export const TEAM_GRID_COLS = 5;
export const TEAM_CARD_W = 140;
export const TEAM_CARD_H = 62;
export const TEAM_GRID_GAP_X = 12;
export const TEAM_GRID_GAP_Y = 10;
export const TEAM_GRID_TOP = 76;
// Under the grid: the formation selector (G9-5), its mini pitch (G15-9) and the hint.
export const FORMATION_ROW_Y = 420;
export const SELECT_HINT_Y = 480;
// The three formation labels. 150 px apart, not 200: '3 DEFENSIVA' is ~79 px of
// bold 12px monospace and at 550 it would reach into the mini pitch at 612.
export const FORMATION_LABEL_X0 = 140;
export const FORMATION_LABEL_DX = 150;
// G15-9: the mini pitch to the RIGHT of the formation row. 150 x 97 keeps the
// 2000 x 1300 ratio of the pitch, so the schematic is not stretched.
export const TEAM_PREVIEW_X = 612;
export const TEAM_PREVIEW_Y = 366;
export const TEAM_PREVIEW_W = 150;
export const TEAM_PREVIEW_H = 97;

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

export function formationLabelX(index: number): number {
  return FORMATION_LABEL_X0 + index * FORMATION_LABEL_DX;
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

// G15-6: under the four cards, the key-scheme row and its detail line, then the hint.
export const MODE_SCHEME_ROW_Y = 434;
export const MODE_SCHEME_DETAIL_Y = 454;
export const MODE_HINT_Y = VIEW_H - 24;

// ── Bracket: the CURRENT round's crosses, then the prompt and the buttons ───────
// G15-8: eight crosses in two columns of four. Four or fewer (quarters, semis, the
// final) go in ONE centred column, which is how it has always looked. The rule lives
// here and not in the .tsx: a formula in draw() is a formula with no test.
export const BRACKET_ROW_TOP = 96;
export const BRACKET_ROW_H = 40;
export const BRACKET_COL_ROWS = 4;
export const BRACKET_COL_X: readonly [number, number] = [200, 600];
export const BRACKET_PROMPT_Y = 330;
// VER | SALTAR | SALTAR TODOS: 3 * 150 + 2 * 12 = 474, centred -> 163, 325, 487.
export const BRACKET_BUTTON_W = 150;
export const BRACKET_BUTTON_H = 34;
export const BRACKET_BUTTON_GAP = 12;
export const BRACKET_BUTTON_Y = BRACKET_PROMPT_Y + 26;
export const BRACKET_HINT_Y = 470;

function bracketRowsPerColumn(pairs: number): number {
  return pairs > BRACKET_COL_ROWS ? BRACKET_COL_ROWS : pairs;
}

export function bracketRowY(pair: number, pairs: number): number {
  return BRACKET_ROW_TOP + (pair % bracketRowsPerColumn(pairs)) * BRACKET_ROW_H;
}

export function bracketColX(pair: number, pairs: number): number {
  if (pairs <= BRACKET_COL_ROWS) return VIEW_W / 2;
  return BRACKET_COL_X[pair < BRACKET_COL_ROWS ? 0 : 1];
}

export function bracketButtonX(index: number): number {
  const total = 3 * BRACKET_BUTTON_W + 2 * BRACKET_BUTTON_GAP;
  return (VIEW_W - total) / 2 + index * (BRACKET_BUTTON_W + BRACKET_BUTTON_GAP);
}

// ── Draw: the sixteen in four columns of four (G15-7) ───────────────────────────
export const DRAW_ROW_TOP = 120;
export const DRAW_ROW_H = 36;
export const DRAW_ROWS_PER_COL = 4;
export const DRAW_COL_X: readonly [number, number, number, number] = [100, 300, 500, 700];

export function drawRowY(index: number): number {
  return DRAW_ROW_TOP + (index % DRAW_ROWS_PER_COL) * DRAW_ROW_H;
}

export function drawColX(index: number): number {
  return DRAW_COL_X[Math.floor(index / DRAW_ROWS_PER_COL)];
}

// ── Victory: title, team name, the figure lifting the cup, the hint ─────────────
// exported for Task 9-7: y of the title, the team name and the figure in drawVictory
export const VICTORY_TITLE_Y = 88;
export const VICTORY_TEAM_Y = 150;
export const VICTORY_FIGURE_Y = 320;
export const VICTORY_HINT_Y = VIEW_H - 32;

// ── ALINEACIÓN (G15-17): the mini pitch on the left, the bench on the right ──────
// 430 x 280 keeps the 2000 x 1300 ratio. The bench rows are 30 apart from 108: NINE
// reserves (a squad of eighteen with nine on the pitch, today) reach 378 and the
// seven of V15-4 reach 318 -- both clear the status line at 412.
export const LINEUP_PITCH_X = 30;
export const LINEUP_PITCH_Y = 92;
export const LINEUP_PITCH_W = 430;
export const LINEUP_PITCH_H = 280;
export const LINEUP_LABEL_DY = 14;
export const LINEUP_RESERVE_X = 500;
export const LINEUP_RESERVE_TOP = 108;
export const LINEUP_RESERVE_H = 30;
export const LINEUP_STATUS_Y = 412;
export const LINEUP_HINT_Y = 476;

export function lineupReserveY(index: number): number {
  return LINEUP_RESERVE_TOP + index * LINEUP_RESERVE_H;
}
