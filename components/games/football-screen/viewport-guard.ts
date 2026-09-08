import { VIEW_H, VIEW_W } from './camera';

// Spec: "solo desktop en la v1". S-SC2: the repo has NO viewport guard to copy --
// grep for matchMedia/innerWidth/useMediaQuery across components, hooks and app
// returns nothing -- so these are the first two thresholds of the project. They are
// the canvas plus room for the page's HUD row and the CRT frame; anything smaller
// turns eighteen players of 12 world units into three pixels, which is the reason
// the camera exists in the first place.
export const MIN_VIEWPORT_W = VIEW_W + 100; // 900
export const MIN_VIEWPORT_H = VIEW_H + 100; // 600

export function viewportAllowed(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  return width >= MIN_VIEWPORT_W && height >= MIN_VIEWPORT_H;
}
