import { describe, expect, it } from 'vitest';
import { TEAM_SIZE } from '../football-logic/teams';
import { VIEW_H, VIEW_W } from './camera';
import { FRONT_H, FRONT_W } from './front-sprite';
import {
  CROWD_COLORS, CROWD_DOT, CROWD_SEED, PRE_MATCH_BOTTOM_FEET_Y, PRE_MATCH_BOTTOM_LABEL_Y, PRE_MATCH_HINT_Y,
  PRE_MATCH_SLOT_W, PRE_MATCH_STANDS_H, PRE_MATCH_TAGS, PRE_MATCH_TAG_DY, PRE_MATCH_TOP_FEET_Y, PRE_MATCH_TOP_LABEL_Y,
  forEachCrowdDot, preMatchBottomTeam, preMatchSlotX, preMatchTag, preMatchTopTeam,
} from './pre-match';

describe('the pre-match screen (G15-19)', () => {
  it('your team is drawn below and the rival above, whichever side you play; at two, J1 below and J2 above', () => {
    expect([preMatchBottomTeam(0), preMatchTopTeam(0)]).toEqual([0, 1]);
    expect([preMatchBottomTeam(1), preMatchTopTeam(1)]).toEqual([1, 0]);   // the World Cup may put you away (S-PK3)
    expect([preMatchBottomTeam('both'), preMatchTopTeam('both')]).toEqual([0, 1]);
  });

  it('labels each row TU EQUIPO / ORDENADOR, or J1 / J2 at two -- and those four are the only words besides the team names', () => {
    expect([preMatchTag(0, 0), preMatchTag(0, 1)]).toEqual(['TU EQUIPO', 'ORDENADOR']);
    expect([preMatchTag(1, 1), preMatchTag(1, 0)]).toEqual(['TU EQUIPO', 'ORDENADOR']);
    expect([preMatchTag('both', 0), preMatchTag('both', 1)]).toEqual(['J1', 'J2']);
    // G15-19 matizada (Paco, 23-sep): SIN nombres de jugadores en esta pantalla.
    expect(PRE_MATCH_TAGS).toEqual(['TU EQUIPO', 'ORDENADOR', 'J1', 'J2']);
  });

  it('eleven figures fit across the canvas without touching, and stands, rows, labels and hint stack top to bottom', () => {
    expect(preMatchSlotX(0, TEAM_SIZE) - FRONT_W / 2).toBeGreaterThanOrEqual(0);
    expect(preMatchSlotX(TEAM_SIZE - 1, TEAM_SIZE) + FRONT_W / 2).toBeLessThanOrEqual(VIEW_W);
    expect(preMatchSlotX((TEAM_SIZE - 1) / 2, TEAM_SIZE)).toBe(VIEW_W / 2);
    expect(PRE_MATCH_SLOT_W).toBeGreaterThan(FRONT_W);
    expect(PRE_MATCH_TOP_LABEL_Y).toBeGreaterThan(PRE_MATCH_STANDS_H);
    expect(PRE_MATCH_TOP_LABEL_Y + PRE_MATCH_TAG_DY).toBeLessThan(PRE_MATCH_TOP_FEET_Y - FRONT_H);
    expect(PRE_MATCH_TOP_FEET_Y).toBeLessThan(PRE_MATCH_BOTTOM_FEET_Y - FRONT_H);
    expect(PRE_MATCH_BOTTOM_FEET_Y).toBeLessThan(PRE_MATCH_BOTTOM_LABEL_Y);
    expect(PRE_MATCH_BOTTOM_LABEL_Y + PRE_MATCH_TAG_DY).toBeLessThan(PRE_MATCH_HINT_Y);
    expect(PRE_MATCH_HINT_Y).toBeLessThan(VIEW_H);
  });

  it('the crowd comes from a seed: the same seed paints the same dots, another seed others, all inside the stands', () => {
    const a: number[] = [];
    const b: number[] = [];
    const c: number[] = [];
    const n = forEachCrowdDot(CROWD_SEED, VIEW_W, PRE_MATCH_STANDS_H, (x, y, color) => { a.push(x, y, CROWD_COLORS.indexOf(color)); });
    forEachCrowdDot(CROWD_SEED, VIEW_W, PRE_MATCH_STANDS_H, (x, y, color) => { b.push(x, y, CROWD_COLORS.indexOf(color)); });
    forEachCrowdDot(CROWD_SEED + 1, VIEW_W, PRE_MATCH_STANDS_H, (x, y, color) => { c.push(x, y, CROWD_COLORS.indexOf(color)); });
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
    expect(n).toBeGreaterThan(0);
    expect(n).toBe(a.length / 3);
    for (let i = 0; i < a.length; i += 3) {
      expect(a[i]).toBeGreaterThanOrEqual(0);
      expect(a[i] + CROWD_DOT).toBeLessThanOrEqual(VIEW_W);
      expect(a[i + 1]).toBeGreaterThanOrEqual(0);
      expect(a[i + 1] + CROWD_DOT).toBeLessThanOrEqual(PRE_MATCH_STANDS_H);
      expect(a[i + 2]).toBeGreaterThanOrEqual(0);
    }
  });
});
