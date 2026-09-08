// Spec: "solo desktop en la v1". S-SC2: the repo has NO viewport guard to copy --
// grep for matchMedia/innerWidth/useMediaQuery across components, hooks and app
// returns nothing -- so these are the first two thresholds of the project.
//
// R35 (owner, 2026-09-07, during the final review of stage C): the thresholds are
// 768 x 560, NOT the 900 x 600 the first draft derived from the canvas
// (VIEW_W + 100 / VIEW_H + 100). 768 is Tailwind's `md` breakpoint -- a mid-size
// tablet, the width at which the rest of the site stops being a phone layout -- and
// 560 leaves the 500-unit canvas its row of page HUD underneath. The canvas is 800
// wide and is drawn with `maxWidth: 100%`, so between 768 and 800 it scales down
// instead of being cropped: nothing disappears, the eighteen players just get
// smaller. That is the trade R35 accepts to keep a 13" laptop in split screen
// playable, which the old 900 x 600 refused.
export const MIN_VIEWPORT_W = 768; // Tailwind's `md`
export const MIN_VIEWPORT_H = 560;

export function viewportAllowed(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  return width >= MIN_VIEWPORT_W && height >= MIN_VIEWPORT_H;
}
