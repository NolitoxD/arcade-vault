import { describe, expect, it } from 'vitest';
import { CELLS, createBoard, idx } from './grid';
import { purgeCells } from './magic';
import { advance, createBag, pickColor, refreshPalette, remapOrphan, swapCurrentNext } from './bag';

describe('colour bag', () => {
  it('only ever draws colours that are still on the board', () => {
    const b = createBoard();
    b.color[idx(0, 0)] = 2;
    b.color[idx(0, 1)] = 5;
    const bag = createBag();
    refreshPalette(bag, b);
    expect(Array.from(bag.palette.subarray(0, bag.count))).toEqual([2, 5]);
    for (let i = 0; i < 50; i++) expect([2, 5]).toContain(pickColor(bag, Math.random));
  });

  it('remaps an orphan next bubble to the closest live colour', () => {
    const b = createBoard();
    b.color[idx(0, 0)] = 1;
    b.color[idx(0, 1)] = 6;
    const bag = createBag();
    refreshPalette(bag, b);
    bag.next = 4;
    remapOrphan(bag);
    expect(bag.next).toBe(6); // |4-1| = 3 vs |4-6| = 2
  });

  it('breaks a remap tie towards the lower colour id', () => {
    const b = createBoard();
    b.color[idx(0, 0)] = 2;
    b.color[idx(0, 1)] = 4;
    const bag = createBag();
    refreshPalette(bag, b);
    bag.next = 3;
    remapOrphan(bag);
    expect(bag.next).toBe(2);
  });

  it('leaves a still-live next bubble alone', () => {
    const b = createBoard();
    b.color[idx(0, 0)] = 3;
    const bag = createBag();
    refreshPalette(bag, b);
    bag.next = 3;
    remapOrphan(bag);
    expect(bag.next).toBe(3);
  });

  it('swaps and advances without losing the loaded colour', () => {
    const bag = createBag();
    bag.palette.set([1, 2]);
    bag.count = 2;
    bag.current = 1;
    bag.next = 2;
    swapCurrentNext(bag);
    expect([bag.current, bag.next]).toEqual([2, 1]);
    advance(bag, () => 0);
    expect(bag.current).toBe(1);
    expect(bag.next).toBe(1);
  });

  it('survives an empty palette without looping or returning garbage', () => {
    const bag = createBag();
    refreshPalette(bag, createBoard());
    expect(bag.count).toBe(0);
    expect(pickColor(bag, () => 0)).toBe(0);
    expect(() => remapOrphan(bag)).not.toThrow();
  });
});

// Colour purge and the bag are genuinely coupled: purging a colour off the board
// must stop the bag from ever offering it again, and any bubble it had already
// queued in that colour has to be remapped to something still alive.
describe('colour bag reacts to a colour purge', () => {
  it('stops offering a colour the moment magic purges it off the board, and remaps the queued orphan', () => {
    const out = new Int16Array(CELLS);
    const b = createBoard();
    b.color[idx(0, 0)] = 2;
    b.color[idx(0, 1)] = 4;
    b.color[idx(0, 2)] = 6;

    const bag = createBag();
    refreshPalette(bag, b);
    expect(Array.from(bag.palette.subarray(0, bag.count))).toEqual([2, 4, 6]);
    bag.next = 4; // queued exactly the colour about to be purged

    const purged = purgeCells(b, 4, out);
    for (let i = 0; i < purged; i++) b.color[out[i]] = 0;

    refreshPalette(bag, b);
    expect(Array.from(bag.palette.subarray(0, bag.count))).toEqual([2, 6]);
    expect(bag.count).toBe(2);

    remapOrphan(bag);
    expect(bag.next).not.toBe(4); // never re-offered after the purge
    expect(bag.next).toBe(2); // |4-2| = 2 ties |4-6| = 2, lower id wins

    for (let i = 0; i < 50; i++) expect(pickColor(bag, Math.random)).not.toBe(4);
  });
});
