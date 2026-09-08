import { describe, expect, it } from 'vitest';
import { PITCH } from '../football-logic/pitch';
import { VIEW_H, VIEW_W, createCamera } from './camera';
import { MINIMAP_H, MINIMAP_W, createMinimapRect, minimapViewRect, minimapX, minimapY } from './minimap';

describe('minimap projection', () => {
  it('maps the four corners of the pitch onto the four corners of the minimap', () => {
    expect(minimapX(PITCH, 0)).toBe(0);
    expect(minimapY(PITCH, 0)).toBe(0);
    expect(minimapX(PITCH, PITCH.width)).toBe(MINIMAP_W);
    expect(minimapY(PITCH, PITCH.height)).toBe(MINIMAP_H);
  });

  it('maps the centre spot to the centre of the minimap', () => {
    expect(minimapX(PITCH, PITCH.width / 2)).toBe(MINIMAP_W / 2);
    expect(minimapY(PITCH, PITCH.height / 2)).toBe(MINIMAP_H / 2);
  });

  it('keeps a point outside the pitch outside the minimap, without clamping', () => {
    expect(minimapX(PITCH, -100)).toBeLessThan(0);
    expect(minimapY(PITCH, PITCH.height + 100)).toBeGreaterThan(MINIMAP_H);
  });
});

describe('minimapViewRect', () => {
  it('the view rectangle is the camera window in minimap units', () => {
    const cam = createCamera();
    cam.x = 0;
    cam.y = 0;
    const out = createMinimapRect();
    minimapViewRect(cam, PITCH, out);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    expect(out.w).toBeCloseTo((VIEW_W / PITCH.width) * MINIMAP_W, 6);
    expect(out.h).toBeCloseTo((VIEW_H / PITCH.height) * MINIMAP_H, 6);
  });

  it('the rectangle is a real fraction of the minimap, not the whole of it', () => {
    const cam = createCamera();
    const out = createMinimapRect();
    minimapViewRect(cam, PITCH, out);
    expect(out.w).toBeLessThan(MINIMAP_W);
    expect(out.h).toBeLessThan(MINIMAP_H);
  });

  it('moves with the camera', () => {
    const cam = createCamera();
    const out = createMinimapRect();
    cam.x = 600;
    cam.y = 400;
    minimapViewRect(cam, PITCH, out);
    expect(out.x).toBeCloseTo((600 / PITCH.width) * MINIMAP_W, 6);
    expect(out.y).toBeCloseTo((400 / PITCH.height) * MINIMAP_H, 6);
  });
});
