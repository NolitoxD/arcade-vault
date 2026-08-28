import type { Board } from './grid';
import { livePalette } from './match';

export type Bag = {
  palette: Uint8Array; // 6, colores vivos ascendentes
  count: number;
  current: number; // color cargado en el cañón
  currentMagic: number; // siempre 0 hoy: el jugador nunca dispara magia
  next: number; // color en la recámara
};

export function createBag(): Bag {
  return {
    palette: new Uint8Array(6),
    count: 0,
    current: 0,
    currentMagic: 0,
    next: 0,
  };
}

export function refreshPalette(bag: Bag, b: Board): void {
  bag.count = livePalette(b, bag.palette);
}

export function pickColor(bag: Bag, rand: () => number): number {
  if (bag.count === 0) return 0;
  return bag.palette[Math.floor(rand() * bag.count)];
}

// If a colour purge (magic.ts) empties `next`'s colour off the board, refresh
// the palette first and then call this: it remaps the orphaned bubble to the
// closest still-live colour, ties broken towards the lower id so the choice
// stays deterministic and testable.
export function remapOrphan(bag: Bag): void {
  if (bag.count === 0) return;

  for (let i = 0; i < bag.count; i++) {
    if (bag.palette[i] === bag.next) return; // still alive, nothing to do
  }

  let best = bag.palette[0];
  let bestDist = Math.abs(best - bag.next);
  for (let i = 1; i < bag.count; i++) {
    const c = bag.palette[i];
    const dist = Math.abs(c - bag.next);
    if (dist < bestDist || (dist === bestDist && c < best)) {
      best = c;
      bestDist = dist;
    }
  }
  bag.next = best;
}

export function swapCurrentNext(bag: Bag): void {
  const tmp = bag.current;
  bag.current = bag.next;
  bag.next = tmp;
}

export function advance(bag: Bag, rand: () => number): void {
  bag.current = bag.next;
  bag.next = pickColor(bag, rand);
}
