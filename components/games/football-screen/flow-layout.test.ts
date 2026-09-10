import { describe, expect, it } from 'vitest';
import { VIEW_H, VIEW_W } from './camera';
import {
  BRACKET_ROW_H, BRACKET_ROW_TOP, DRAW_COL_X, FORMATION_ROW_Y, MODE_CARD_GAP, MODE_CARD_H, MODE_CARD_TOP, SELECT_HINT_Y,
  TEAM_CARD_H, TEAM_CARD_W, TEAM_GRID_COLS, TEAM_GRID_GAP_X, TEAM_GRID_GAP_Y, TEAM_GRID_TOP, VICTORY_HINT_Y,
  bracketRowY, drawColX, drawRowY, modeCardY, teamCardX, teamCardY, teamGridWidth,
} from './flow-layout';

const BANK = 16;

describe('the team grid', () => {
  it('is four columns wide and fits the canvas, centred', () => {
    expect(TEAM_GRID_COLS).toBe(4);
    const width = teamGridWidth(BANK);
    expect(width).toBe(4 * TEAM_CARD_W + 3 * TEAM_GRID_GAP_X);
    expect(width).toBeLessThan(VIEW_W);
    expect(teamCardX(0, BANK)).toBe((VIEW_W - width) / 2);
    expect(teamCardX(3, BANK) + TEAM_CARD_W).toBe(VIEW_W - teamCardX(0, BANK));
  });

  it('places index 5 on column 1, row 1 and index 15 on column 3, row 3', () => {
    expect(teamCardX(5, BANK)).toBe(teamCardX(1, BANK));
    expect(teamCardY(5)).toBe(TEAM_GRID_TOP + TEAM_CARD_H + TEAM_GRID_GAP_Y);
    expect(teamCardX(15, BANK)).toBe(teamCardX(3, BANK));
    expect(teamCardY(15)).toBe(TEAM_GRID_TOP + 3 * (TEAM_CARD_H + TEAM_GRID_GAP_Y));
  });

  it('leaves room under the last row for the formation selector and the hint', () => {
    const bottom = teamCardY(15) + TEAM_CARD_H;
    expect(bottom).toBeLessThan(FORMATION_ROW_Y);
    expect(FORMATION_ROW_Y).toBeLessThan(SELECT_HINT_Y);
    expect(SELECT_HINT_Y).toBeLessThan(VIEW_H);
  });
});

describe('the other screens', () => {
  it('four mode cards fit above the bottom of the canvas', () => {
    expect(modeCardY(0)).toBe(MODE_CARD_TOP);
    expect(modeCardY(3)).toBe(MODE_CARD_TOP + 3 * (MODE_CARD_H + MODE_CARD_GAP));
    expect(modeCardY(3) + MODE_CARD_H).toBeLessThan(VIEW_H - 40);
  });

  it('four bracket rows and the eight draw rows fit', () => {
    expect(bracketRowY(0)).toBe(BRACKET_ROW_TOP);
    expect(bracketRowY(3)).toBe(BRACKET_ROW_TOP + 3 * BRACKET_ROW_H);
    expect(bracketRowY(3) + BRACKET_ROW_H).toBeLessThan(VIEW_H);
    expect(drawRowY(3)).toBe(drawRowY(7));            // two columns of four
    expect(drawColX(0)).toBe(DRAW_COL_X[0]);
    expect(drawColX(4)).toBe(DRAW_COL_X[1]);
    expect(VICTORY_HINT_Y).toBeLessThan(VIEW_H);
  });
});
