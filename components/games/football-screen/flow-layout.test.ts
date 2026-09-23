import { describe, expect, it } from 'vitest';
import { VIEW_H, VIEW_W } from './camera';
import {
  BRACKET_BUTTON_GAP, BRACKET_BUTTON_H, BRACKET_BUTTON_W, BRACKET_BUTTON_Y, BRACKET_COL_ROWS, BRACKET_COL_X,
  BRACKET_HINT_Y, BRACKET_PROMPT_Y, BRACKET_ROW_H, BRACKET_ROW_TOP, DRAW_COL_X, DRAW_ROW_H,
  FORMATION_LABEL_DX, FORMATION_LABEL_X0, FORMATION_ROW_Y,
  LINEUP_HINT_Y, LINEUP_PITCH_H, LINEUP_PITCH_W, LINEUP_PITCH_X, LINEUP_PITCH_Y, LINEUP_RESERVE_H,
  LINEUP_RESERVE_TOP, LINEUP_RESERVE_X, LINEUP_STATUS_Y,
  MODE_CARD_GAP, MODE_CARD_H, MODE_CARD_TOP,
  MODE_HINT_Y, MODE_SCHEME_DETAIL_Y, MODE_SCHEME_ROW_Y, SELECT_HINT_Y,
  TEAM_CARD_H, TEAM_CARD_W, TEAM_GRID_COLS, TEAM_GRID_GAP_X, TEAM_GRID_GAP_Y, TEAM_GRID_TOP,
  TEAM_PREVIEW_H, TEAM_PREVIEW_W, TEAM_PREVIEW_X, TEAM_PREVIEW_Y, VICTORY_HINT_Y,
  bracketButtonX, bracketColX, bracketRowY, drawColX, drawRowY, formationLabelX, lineupReserveY, modeCardY, teamCardX,
  teamCardY, teamGridWidth,
} from './flow-layout';

const BANK = 20;

describe('the team grid (G15-9: twenty selections in a 5 x 4 grid)', () => {
  it('is five columns wide and fits the canvas, centred', () => {
    expect(TEAM_GRID_COLS).toBe(5);
    const width = teamGridWidth(BANK);
    expect(width).toBe(5 * TEAM_CARD_W + 4 * TEAM_GRID_GAP_X);
    expect(width).toBeLessThan(VIEW_W);
    expect(teamCardX(0, BANK)).toBe((VIEW_W - width) / 2);
    expect(teamCardX(4, BANK) + TEAM_CARD_W).toBe(VIEW_W - teamCardX(0, BANK));
  });

  it('places index 6 on column 1, row 1 and index 19 on column 4, row 3', () => {
    expect(teamCardX(6, BANK)).toBe(teamCardX(1, BANK));
    expect(teamCardY(6)).toBe(TEAM_GRID_TOP + TEAM_CARD_H + TEAM_GRID_GAP_Y);
    expect(teamCardX(19, BANK)).toBe(teamCardX(4, BANK));
    expect(teamCardY(19)).toBe(TEAM_GRID_TOP + 3 * (TEAM_CARD_H + TEAM_GRID_GAP_Y));
  });

  it('still fits a bank narrower than one row', () => {
    expect(teamGridWidth(3)).toBe(3 * TEAM_CARD_W + 2 * TEAM_GRID_GAP_X);
  });

  it('leaves room under the last row for the formation row, the mini pitch and the hint', () => {
    const bottom = teamCardY(19) + TEAM_CARD_H;
    expect(bottom).toBeLessThan(TEAM_PREVIEW_Y);
    expect(bottom).toBeLessThan(FORMATION_ROW_Y);
    expect(FORMATION_ROW_Y).toBeLessThan(SELECT_HINT_Y);
    expect(SELECT_HINT_Y).toBeLessThan(VIEW_H);
  });

  it('the mini pitch sits to the RIGHT of the formation row, keeps the pitch ratio and clears the hint (G15-9)', () => {
    // The third formation label ('3 DEFENSIVA', 11 chars of bold 12px monospace ~ 79px)
    // must not reach the mini pitch.
    expect(formationLabelX(0)).toBe(FORMATION_LABEL_X0);
    expect(formationLabelX(2)).toBe(FORMATION_LABEL_X0 + 2 * FORMATION_LABEL_DX);
    expect(formationLabelX(2) + 80).toBeLessThan(TEAM_PREVIEW_X);
    expect(TEAM_PREVIEW_X + TEAM_PREVIEW_W).toBeLessThan(VIEW_W);
    expect(TEAM_PREVIEW_Y + TEAM_PREVIEW_H).toBeLessThan(SELECT_HINT_Y - 8);
    // 2000 x 1300 is the pitch; the preview keeps that ratio within one pixel.
    expect(Math.abs(TEAM_PREVIEW_W / TEAM_PREVIEW_H - 2000 / 1300)).toBeLessThan(0.02);
  });
});

describe('the other screens', () => {
  it('four mode cards fit above the bottom of the canvas', () => {
    expect(modeCardY(0)).toBe(MODE_CARD_TOP);
    expect(modeCardY(3)).toBe(MODE_CARD_TOP + 3 * (MODE_CARD_H + MODE_CARD_GAP));
    expect(modeCardY(3) + MODE_CARD_H).toBeLessThan(VIEW_H - 40);
  });

  it('eight bracket crosses fit in two columns of four, and fewer than five in one centred column (G15-8)', () => {
    expect(BRACKET_COL_ROWS).toBe(4);
    expect(bracketRowY(0, 8)).toBe(BRACKET_ROW_TOP);
    expect(bracketRowY(3, 8)).toBe(BRACKET_ROW_TOP + 3 * BRACKET_ROW_H);
    expect(bracketRowY(4, 8)).toBe(BRACKET_ROW_TOP);            // second column starts again at the top
    expect(bracketRowY(7, 8)).toBe(BRACKET_ROW_TOP + 3 * BRACKET_ROW_H);
    expect(bracketRowY(7, 8) + BRACKET_ROW_H).toBeLessThan(BRACKET_PROMPT_Y);
    expect(bracketColX(0, 8)).toBe(BRACKET_COL_X[0]);
    expect(bracketColX(4, 8)).toBe(BRACKET_COL_X[1]);
    // Quarters (4), semis (2) and the final (1): one centred column.
    expect(bracketColX(0, 4)).toBe(VIEW_W / 2);
    expect(bracketColX(3, 4)).toBe(VIEW_W / 2);
    expect(bracketRowY(3, 4)).toBe(BRACKET_ROW_TOP + 3 * BRACKET_ROW_H);
    expect(bracketColX(0, 1)).toBe(VIEW_W / 2);
    expect(bracketRowY(0, 1)).toBe(BRACKET_ROW_TOP);
    // A 356 px cross (the longest possible pair at bold 18px monospace, 33 chars) fits either column.
    expect(BRACKET_COL_X[0] - 184).toBeGreaterThan(0);
    expect(BRACKET_COL_X[1] + 184).toBeLessThan(VIEW_W);
  });

  it('the three bracket buttons fit under the prompt and above the hint (G15-8: SALTAR TODOS)', () => {
    expect(BRACKET_BUTTON_Y).toBeGreaterThan(BRACKET_PROMPT_Y);
    expect(bracketButtonX(0)).toBe((VIEW_W - (3 * BRACKET_BUTTON_W + 2 * BRACKET_BUTTON_GAP)) / 2);
    expect(bracketButtonX(1)).toBe(bracketButtonX(0) + BRACKET_BUTTON_W + BRACKET_BUTTON_GAP);
    expect(bracketButtonX(2) + BRACKET_BUTTON_W).toBe(VIEW_W - bracketButtonX(0));
    expect(bracketButtonX(0)).toBeGreaterThan(0);
    expect(BRACKET_BUTTON_Y + BRACKET_BUTTON_H).toBeLessThan(BRACKET_HINT_Y - 8);
  });

  it('the sixteen drawn teams fit in four columns of four', () => {
    expect(drawRowY(3)).toBe(drawRowY(7));
    expect(drawRowY(3)).toBe(drawRowY(15));
    expect(drawColX(0)).toBe(DRAW_COL_X[0]);
    expect(drawColX(4)).toBe(DRAW_COL_X[1]);
    expect(drawColX(8)).toBe(DRAW_COL_X[2]);
    expect(drawColX(15)).toBe(DRAW_COL_X[3]);
    for (let i = 0; i < 4; i++) {
      expect(DRAW_COL_X[i] - 80).toBeGreaterThan(0);
      expect(DRAW_COL_X[i] + 80).toBeLessThan(VIEW_W);
    }
    expect(drawRowY(15) + DRAW_ROW_H).toBeLessThan(VIEW_H - 40);
    expect(VICTORY_HINT_Y).toBeLessThan(VIEW_H);
  });

  it('the key-scheme row and its detail sit between the last mode card and the hint (G15-6)', () => {
    expect(MODE_SCHEME_ROW_Y - 8).toBeGreaterThan(modeCardY(3) + MODE_CARD_H);
    expect(MODE_SCHEME_DETAIL_Y).toBeGreaterThan(MODE_SCHEME_ROW_Y + 12);
    expect(MODE_SCHEME_DETAIL_Y + 8).toBeLessThan(MODE_HINT_Y - 6);
    expect(MODE_HINT_Y).toBe(VIEW_H - 24);
  });

  it('the ALINEACIÓN screen: a mini pitch on the left, the reserves on the right, both sizes (G15-17)', () => {
    expect(LINEUP_PITCH_X).toBeGreaterThan(0);
    expect(LINEUP_PITCH_X + LINEUP_PITCH_W).toBeLessThan(LINEUP_RESERVE_X);
    expect(Math.abs(LINEUP_PITCH_W / LINEUP_PITCH_H - 2000 / 1300)).toBeLessThan(0.02);
    expect(LINEUP_PITCH_Y + LINEUP_PITCH_H).toBeLessThan(LINEUP_STATUS_Y);
    expect(LINEUP_STATUS_Y).toBeLessThan(LINEUP_HINT_Y);
    expect(LINEUP_HINT_Y).toBeLessThan(VIEW_H);
    expect(lineupReserveY(0)).toBe(LINEUP_RESERVE_TOP);
    expect(lineupReserveY(1)).toBe(LINEUP_RESERVE_TOP + LINEUP_RESERVE_H);
    // A squad of eighteen: NINE reserves today (9 on the pitch) and seven once V15-4
    // plays eleven. The worst case is the ninth row; both must clear the status line.
    expect(lineupReserveY(8) + LINEUP_RESERVE_H).toBeLessThan(LINEUP_STATUS_Y);
    expect(lineupReserveY(6) + LINEUP_RESERVE_H).toBeLessThan(LINEUP_STATUS_Y);
    expect(LINEUP_RESERVE_X).toBeLessThan(VIEW_W - 60);
  });
});
