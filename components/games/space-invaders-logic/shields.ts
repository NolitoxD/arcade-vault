const SHIELD_COLS = 22;
const SHIELD_ROWS = 16;
const SHIELD_PX = 3;

const SHIELD_COUNT = 4;
const CORNER_ROWS = 2;
const NOTCH_ROWS = 6;

type Shield = { x: number; y: number; pixels: Uint8Array };

function buildTemplate(): Uint8Array {
  const pixels = new Uint8Array(SHIELD_COLS * SHIELD_ROWS).fill(1);

  for (let r = 0; r < CORNER_ROWS; r++) {
    const cut = CORNER_ROWS - r;
    for (let c = 0; c < cut; c++) {
      pixels[r * SHIELD_COLS + c] = 0;
      pixels[r * SHIELD_COLS + (SHIELD_COLS - 1 - c)] = 0;
    }
  }

  const notchStartRow = SHIELD_ROWS - NOTCH_ROWS;
  const center = SHIELD_COLS / 2;
  for (let r = notchStartRow; r < SHIELD_ROWS; r++) {
    const half = r - notchStartRow + 1;
    const left = Math.max(Math.round(center - half), 0);
    const right = Math.min(Math.round(center + half), SHIELD_COLS);
    for (let c = left; c < right; c++) {
      pixels[r * SHIELD_COLS + c] = 0;
    }
  }

  return pixels;
}

function createShields(canvasW: number, y: number): Shield[] {
  const template = buildTemplate();
  const width = SHIELD_COLS * SHIELD_PX;
  const spacing = canvasW / SHIELD_COUNT;
  const shields: Shield[] = [];
  for (let i = 0; i < SHIELD_COUNT; i++) {
    const x = i * spacing + (spacing - width) / 2;
    shields.push({ x, y, pixels: template.slice() });
  }
  return shields;
}

function shieldHitTest(s: Shield, px: number, py: number): number {
  const localX = px - s.x;
  const localY = py - s.y;
  const width = SHIELD_COLS * SHIELD_PX;
  const height = SHIELD_ROWS * SHIELD_PX;
  if (localX < 0 || localY < 0 || localX >= width || localY >= height) return -1;

  const col = Math.floor(localX / SHIELD_PX);
  const row = Math.floor(localY / SHIELD_PX);
  const index = row * SHIELD_COLS + col;
  return s.pixels[index] === 1 ? index : -1;
}

function damageShield(s: Shield, index: number, radius: number = 1): void {
  if (index < 0) return;
  const col = index % SHIELD_COLS;
  const row = Math.floor(index / SHIELD_COLS);
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (dr * dr + dc * dc > radius * radius) continue;
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= SHIELD_ROWS || c < 0 || c >= SHIELD_COLS) continue;
      s.pixels[r * SHIELD_COLS + c] = 0;
    }
  }
}

function aabb(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number,
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

export { SHIELD_COLS, SHIELD_ROWS, SHIELD_PX, createShields, shieldHitTest, damageShield, aabb };
export type { Shield };
