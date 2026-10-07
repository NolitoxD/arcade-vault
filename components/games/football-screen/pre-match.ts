import type { HumanSide } from '../football-logic/mode';
import { createRng } from '../football-logic/rng';
import { VIEW_W } from './camera';

// G15-19 (matizada 23-sep): the line-up screen before the kickoff -- the two elevens
// standing in a row with their kits (the keeper in the fluor green), the rival above and
// your team below, the selection's name and TU EQUIPO / ORDENADOR (J1 / J2 at two) over
// each row. NO player names. Simple stands and grass behind. "Parecido, no copia" of the
// Tehkan line-up photo Paco shared. Pure: layout, who goes where, the four words, and the
// crowd dots from a SEED (createRng: nothing here is unseeded).

// ── Layout (800 x 500) ───────────────────────────────────────────────────────────
export const PRE_MATCH_STANDS_H = 92;
export const PRE_MATCH_SLOT_W = 66;            // eleven slots = 726 px, centred
export const PRE_MATCH_TOP_LABEL_Y = 112;      // the selection's name; its tag PRE_MATCH_TAG_DY below
export const PRE_MATCH_TOP_FEET_Y = 230;       // the figures stand ON this line
export const PRE_MATCH_BOTTOM_FEET_Y = 400;
export const PRE_MATCH_BOTTOM_LABEL_Y = 424;
export const PRE_MATCH_TAG_DY = 18;
export const PRE_MATCH_HINT_Y = 480;

export function preMatchSlotX(index: number, count: number): number {
  return VIEW_W / 2 + (index - (count - 1) / 2) * PRE_MATCH_SLOT_W;
}

// ── Who goes where ───────────────────────────────────────────────────────────────
// Your team below, the rival above. Team 1 is yours only when the World Cup puts you away
// (S-PK3); at two, J1 (team 0) below and J2 above. 'none' (a CPU pair) never gets here.
export function preMatchBottomTeam(side: HumanSide): 0 | 1 {
  return side === 1 ? 1 : 0;
}

export function preMatchTopTeam(side: HumanSide): 0 | 1 {
  return preMatchBottomTeam(side) === 0 ? 1 : 0;
}

export const PRE_MATCH_YOU = 'TU EQUIPO';
export const PRE_MATCH_CPU = 'ORDENADOR';
export const PRE_MATCH_P1 = 'J1';
export const PRE_MATCH_P2 = 'J2';
// The only words of this screen besides the two selection names.
export const PRE_MATCH_TAGS: readonly string[] = [PRE_MATCH_YOU, PRE_MATCH_CPU, PRE_MATCH_P1, PRE_MATCH_P2];

// Constants only: draw() may call it every frame without building a string.
export function preMatchTag(side: HumanSide, team: 0 | 1): string {
  if (side === 'both') return team === 0 ? PRE_MATCH_P1 : PRE_MATCH_P2;
  return side === team ? PRE_MATCH_YOU : PRE_MATCH_CPU;
}

// ── The stands: rows of crowd dots on a dark band, baked ONCE at mount ─────────────
export const CROWD_SEED = 0x2f6b1d3;
export const CROWD_DOT = 3;
export const CROWD_EMPTY_CHANCE = 0.2;
export const CROWD_BG = '#262633';
export const CROWD_COLORS: readonly string[] = ['#c94c4c', '#e8c547', '#4c7bc9', '#e8e8e8', '#6e6e82', '#d98a3d'];

// Every other cell of a CROWD_DOT grid, rows staggered, a few left empty; the colour of
// each dot from the same Rng. Returns how many dots it handed to `fill`.
export function forEachCrowdDot(
  seed: number, w: number, h: number, fill: (x: number, y: number, color: string) => void,
): number {
  const rng = createRng(seed);
  const pitch = CROWD_DOT * 2;
  let n = 0;
  for (let row = 0; row * pitch + 1 + CROWD_DOT <= h; row++) {
    const y = row * pitch + 1;
    for (let x = 1 + (row % 2) * CROWD_DOT; x + CROWD_DOT <= w; x += pitch) {
      if (rng() < CROWD_EMPTY_CHANCE) continue;
      fill(x, y, CROWD_COLORS[Math.floor(rng() * CROWD_COLORS.length)]);
      n++;
    }
  }
  return n;
}
