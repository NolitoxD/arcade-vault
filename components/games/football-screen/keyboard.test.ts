import { describe, expect, it } from 'vitest';
import { createTeamInput } from '../football-logic/input';
import { FORMATION_COUNT } from '../football-logic/teams';
import { checkTeamInput } from '../football-logic/input';
import {
  ARROWS_SOLO, CLASSIC_SOLO, DEFAULT_KEY_SCHEME, KEY_BINDINGS, KEY_SCHEMES, KEY_SCHEME_STORAGE_KEY, SOLO_TABLES_BY_SCHEME,
  TWO_PLAYER_P1, TWO_PLAYER_P2, TWO_PLAYER_TABLES,
  createPadState, isPauseKey, loadKeyScheme, overlayPadToTeamInput, padAdvance, padBlur, padChoice, padClear, padDown,
  padFormationChoice, padKeyFor, padToTeamInput, padUp, parseKeyScheme, saveKeyScheme, tablesShareKey,
} from './keyboard';

describe('padKeyFor', () => {
  it('Flechas maps the arrows to the d-pad and J/K/L to A/B/C, and WASD no longer moves (G15-6)', () => {
    expect(padKeyFor(ARROWS_SOLO, 'arrowup')).toBe('up');
    expect(padKeyFor(ARROWS_SOLO, 'arrowdown')).toBe('down');
    expect(padKeyFor(ARROWS_SOLO, 'arrowleft')).toBe('left');
    expect(padKeyFor(ARROWS_SOLO, 'arrowright')).toBe('right');
    expect(padKeyFor(ARROWS_SOLO, 'j')).toBe('a');
    expect(padKeyFor(ARROWS_SOLO, 'k')).toBe('b');
    expect(padKeyFor(ARROWS_SOLO, 'l')).toBe('c');
    for (const k of ['w', 'a', 's', 'd']) expect(padKeyFor(ARROWS_SOLO, k)).toBeNull();
  });

  it('ignores anything else', () => {
    expect(padKeyFor(ARROWS_SOLO, 'q')).toBeNull();
    expect(padKeyFor(ARROWS_SOLO, 'enter')).toBeNull();
    expect(padKeyFor(ARROWS_SOLO, ' ')).toBeNull();
  });
});

describe('button state machine', () => {
  it('a fresh press is pressed, and only becomes held after the frame advances', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'a');
    expect(pad.a).toBe('pressed');
    padAdvance(pad);
    expect(pad.a).toBe('held');
    padAdvance(pad);
    expect(pad.a).toBe('held');
  });

  it('a key repeat does not restart the press', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'b');
    padAdvance(pad);
    padDown(pad, 'b');
    expect(pad.b).toBe('held');
  });

  it('a release is released for one advance and then up', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'c');
    padAdvance(pad);
    padUp(pad, 'c');
    expect(pad.c).toBe('released');
    padAdvance(pad);
    expect(pad.c).toBe('up');
  });

  it('a press and a release inside the same frame still produce released', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'a');
    padUp(pad, 'a');
    expect(pad.a).toBe('released');
  });

  it('blur releases the d-pad and lifts every button', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'left');
    padDown(pad, 'a');
    padAdvance(pad);
    padBlur(pad);
    expect(pad.left).toBe(false);
    expect(pad.a).toBe('up');
  });

  // A keyup whose keydown never reached the pad -- swallowed because the game was
  // paused or blocked, or arriving after a blur already lifted the button. Marking
  // it 'released' would leave an edge the engine consumes on resume as a shot the
  // player never asked for. Symmetric to pressButton, which refuses to restart a
  // press that is already down.
  it('a keyup with no keydown leaves the button up, with no phantom edge', () => {
    const pad = createPadState('neutral', 0);
    padUp(pad, 'a');
    expect(pad.a).toBe('up');
    padDown(pad, 'a');
    padAdvance(pad);
    padBlur(pad);          // alt-tab: the button is lifted without an edge
    padUp(pad, 'a');       // the real keyup arrives when the window comes back
    expect(pad.a).toBe('up');
  });

  // padClear is what the component uses for a button released while paused or
  // blocked: the button has to come up, but without the edge that padUp produces.
  it('padClear lifts one button without an edge and leaves the rest alone', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'a');
    padDown(pad, 'b');
    padDown(pad, 'left');
    padAdvance(pad);
    padClear(pad, 'a');
    expect(pad.a).toBe('up');
    expect(pad.b).toBe('held');
    padClear(pad, 'left');
    expect(pad.left).toBe(false);
  });
});

describe('padToTeamInput', () => {
  it('turns the four direction flags into the axes, opposites cancelling', () => {
    const pad = createPadState('neutral', 0);
    const out = createTeamInput();
    padDown(pad, 'left');
    padDown(pad, 'up');
    padToTeamInput(pad, true, out);
    expect(out.dx).toBe(-1);
    expect(out.dy).toBe(-1);
    padDown(pad, 'right');
    padToTeamInput(pad, true, out);
    expect(out.dx).toBe(0);
  });

  it('downgrades pressed to held and released to up after the first step of a frame', () => {
    const pad = createPadState('neutral', 0);
    const out = createTeamInput();
    padDown(pad, 'a');
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('pressed');
    // Same frame, second simulation step: the engine already consumed the edge.
    padToTeamInput(pad, false, out);
    expect(out.a).toBe('held');

    padUp(pad, 'a');
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('released');
    padToTeamInput(pad, false, out);
    expect(out.a).toBe('up');
  });

  it('always produces an input the engine accepts', () => {
    const pad = createPadState('attack', 2);
    const out = createTeamInput();
    padDown(pad, 'down');
    padDown(pad, 'right');
    padDown(pad, 'b');
    padToTeamInput(pad, true, out);
    expect(checkTeamInput(out, FORMATION_COUNT)).toEqual([]);
  });

  // The rule the component's update() has to honour: an edge is consumed by a STEP,
  // not by a frame. A frame that plans zero steps (STEP_MS is 16.667 ms, so on a
  // 120 Hz panel half the frames plan none) must leave 'pressed' standing, or the
  // shot the player asked for is silently dropped.
  it('a press survives a frame in which no step ran', () => {
    const pad = createPadState('neutral', 0);
    const out = createTeamInput();
    padDown(pad, 'a');
    // Frame with budget.steps === 0: no padToTeamInput, no padAdvance.
    padToTeamInput(pad, true, out);   // the NEXT frame, which does run a step
    expect(out.a).toBe('pressed');
    // And the symmetric case: once a step has run, the frame ends with padAdvance
    // and the edge is gone.
    padAdvance(pad);
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('held');
  });
});

describe('padChoice', () => {
  it('1/2/3 pick the formation and 4/5/6 the strategy', () => {
    const pad = createPadState('neutral', 0);
    expect(padChoice(pad, ARROWS_SOLO, '3')).toBe(true);
    expect(pad.formation).toBe(2);
    expect(padChoice(pad, ARROWS_SOLO, '1')).toBe(true);
    expect(pad.formation).toBe(0);
    expect(padChoice(pad, ARROWS_SOLO, '4')).toBe(true);
    expect(pad.strategy).toBe('attack');
    expect(padChoice(pad, ARROWS_SOLO, '5')).toBe(true);
    expect(pad.strategy).toBe('neutral');
    expect(padChoice(pad, ARROWS_SOLO, '6')).toBe(true);
    expect(pad.strategy).toBe('defend');
  });

  it('leaves the pad alone for any other key', () => {
    const pad = createPadState('neutral', 1);
    expect(padChoice(pad, ARROWS_SOLO, '7')).toBe(false);
    expect(pad.formation).toBe(1);
    expect(pad.strategy).toBe('neutral');
  });
});

describe('padFormationChoice (final fix wave: the team selector has no strategy row)', () => {
  it('1/2/3 pick the formation, same as padChoice', () => {
    const pad = createPadState('neutral', 0);
    expect(padFormationChoice(pad, ARROWS_SOLO, '3')).toBe(true);
    expect(pad.formation).toBe(2);
    expect(padFormationChoice(pad, ARROWS_SOLO, '1')).toBe(true);
    expect(pad.formation).toBe(0);
  });

  it('a strategy key returns false and leaves the pad untouched, unlike padChoice', () => {
    const pad = createPadState('neutral', 1);
    expect(padFormationChoice(pad, ARROWS_SOLO, '4')).toBe(false);
    expect(pad.formation).toBe(1);
    expect(pad.strategy).toBe('neutral');
  });
});

// ── G9-2 (Paco, 09-sep): two people, one keyboard, each with their own half. ──
describe('the two-player key tables', () => {
  it('J1 moves with WASD and fires A/B/C on C/V/B; J2 moves with the arrows and fires on J/K/L', () => {
    expect(padKeyFor(TWO_PLAYER_P1, 'w')).toBe('up');
    expect(padKeyFor(TWO_PLAYER_P1, 's')).toBe('down');
    expect(padKeyFor(TWO_PLAYER_P1, 'a')).toBe('left');
    expect(padKeyFor(TWO_PLAYER_P1, 'd')).toBe('right');
    expect(padKeyFor(TWO_PLAYER_P1, 'c')).toBe('a');
    expect(padKeyFor(TWO_PLAYER_P1, 'v')).toBe('b');
    expect(padKeyFor(TWO_PLAYER_P1, 'b')).toBe('c');
    expect(padKeyFor(TWO_PLAYER_P2, 'arrowup')).toBe('up');
    expect(padKeyFor(TWO_PLAYER_P2, 'arrowdown')).toBe('down');
    expect(padKeyFor(TWO_PLAYER_P2, 'arrowleft')).toBe('left');
    expect(padKeyFor(TWO_PLAYER_P2, 'arrowright')).toBe('right');
    expect(padKeyFor(TWO_PLAYER_P2, 'j')).toBe('a');
    expect(padKeyFor(TWO_PLAYER_P2, 'k')).toBe('b');
    expect(padKeyFor(TWO_PLAYER_P2, 'l')).toBe('c');
  });

  // The spec's own sentence: "en el modo a dos WASD deja de mover a J2 y las flechas
  // dejan de mover a J1". KEY_BINDINGS maps both to the same d-pad; here it is SPLIT.
  it('in the two-player mode WASD no longer moves J2 and the arrows no longer move J1', () => {
    for (const k of ['w', 'a', 's', 'd', 'c', 'v', 'b']) expect(padKeyFor(TWO_PLAYER_P2, k)).toBeNull();
    for (const k of ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'j', 'k', 'l']) expect(padKeyFor(TWO_PLAYER_P1, k)).toBeNull();
  });

  it('no key appears in both tables -- d-pad, buttons and number rows included', () => {
    expect(tablesShareKey(TWO_PLAYER_P1, TWO_PLAYER_P2)).toBeNull();
    expect(tablesShareKey(TWO_PLAYER_P2, TWO_PLAYER_P1)).toBeNull();
    // The check is not vacuous: ARROWS_SOLO and J2 both carry the arrows.
    expect(tablesShareKey(ARROWS_SOLO, TWO_PLAYER_P2)).toBe('arrowup');
  });

  it('Flechas IS J2\'s pad with J1\'s number rows, so whoever plays alone never relearns a key', () => {
    for (const [key, value] of Object.entries(TWO_PLAYER_P2.pad)) expect(ARROWS_SOLO.pad[key]).toBe(value);
    expect(Object.keys(ARROWS_SOLO.pad).length).toBe(Object.keys(TWO_PLAYER_P2.pad).length);
    expect(ARROWS_SOLO.formation).toEqual(TWO_PLAYER_P1.formation);
    expect(ARROWS_SOLO.strategy).toEqual(TWO_PLAYER_P1.strategy);
  });

  it('KEY_BINDINGS stays the step-8 source both Flechas and the two-player maps are cut from', () => {
    expect(KEY_BINDINGS.w).toBe('up');              // still in the source (J1 needs it) ...
    expect(padKeyFor(ARROWS_SOLO, 'w')).toBeNull();  // ... but no longer in the solo map
    expect(padKeyFor(ARROWS_SOLO, 'arrowup')).toBe(KEY_BINDINGS.arrowup);
    expect(padKeyFor(ARROWS_SOLO, 'c')).toBeNull();   // C/V/B only exist for J1 in the two-player mode
  });

  it("J2 picks the formation on 7/8/9 and the strategy on 0 ' ¡, and ignores J1's number row", () => {
    const pad = createPadState('neutral', 0);
    expect(padChoice(pad, TWO_PLAYER_P2, '9')).toBe(true);
    expect(pad.formation).toBe(2);
    expect(padChoice(pad, TWO_PLAYER_P2, '0')).toBe(true);
    expect(pad.strategy).toBe('attack');
    expect(padChoice(pad, TWO_PLAYER_P2, "'"  )).toBe(true);
    expect(pad.strategy).toBe('neutral');
    expect(padChoice(pad, TWO_PLAYER_P2, '¡')).toBe(true);
    expect(pad.strategy).toBe('defend');
    expect(padChoice(pad, TWO_PLAYER_P2, '1')).toBe(false);
    expect(pad.formation).toBe(2);
    // And symmetrically: J1's pad ignores J2's row.
    const pad1 = createPadState('neutral', 0);
    expect(padChoice(pad1, TWO_PLAYER_P1, '7')).toBe(false);
    expect(pad1.formation).toBe(0);
  });

  // Two pads, two tables, one keydown handler: a key of one table must leave the other
  // pad untouched. This is what the component's handler relies on in the two-player mode.
  it('routing a key through both tables moves exactly one of the two pads', () => {
    const pads = [createPadState('neutral', 0), createPadState('neutral', 0)];
    const tables = [TWO_PLAYER_P1, TWO_PLAYER_P2];
    for (let t = 0; t < 2; t++) {
      const k = padKeyFor(tables[t], 'arrowleft');
      if (k !== null) padDown(pads[t], k);
    }
    expect(pads[0].left).toBe(false);
    expect(pads[1].left).toBe(true);
    for (let t = 0; t < 2; t++) {
      const k = padKeyFor(tables[t], 'c');
      if (k !== null) padDown(pads[t], k);
    }
    expect(pads[0].a).toBe('pressed');
    expect(pads[1].a).toBe('up');
  });

  it('tablesShareKey detects shared keys in formation and strategy rows', () => {
    const tableWithSharedFormation = {
      pad: { ...TWO_PLAYER_P2.pad },
      formation: ['1', '8', '9'],  // '1' is shared with TWO_PLAYER_P1
      strategy: TWO_PLAYER_P2.strategy,
    };
    expect(tablesShareKey(TWO_PLAYER_P1, tableWithSharedFormation)).toBe('1');

    const tableWithSharedStrategy = {
      pad: { ...TWO_PLAYER_P2.pad },
      formation: TWO_PLAYER_P2.formation,
      strategy: ['4', "'", '¡'],  // '4' is shared with TWO_PLAYER_P1
    };
    expect(tablesShareKey(TWO_PLAYER_P1, tableWithSharedStrategy)).toBe('4');
  });
});

// ── G15-6 (grill of the v1.5, 17-sep): two solo schemes, Flechas and Clásico. ──
describe('the solo key schemes (G15-6)', () => {
  it('Clásico moves on Q/A/O/P and fires A/B/C on Z/X/C, sharing Flechas\' number rows', () => {
    expect(padKeyFor(CLASSIC_SOLO, 'q')).toBe('up');
    expect(padKeyFor(CLASSIC_SOLO, 'a')).toBe('down');
    expect(padKeyFor(CLASSIC_SOLO, 'o')).toBe('left');
    expect(padKeyFor(CLASSIC_SOLO, 'p')).toBe('right');
    expect(padKeyFor(CLASSIC_SOLO, 'z')).toBe('a');
    expect(padKeyFor(CLASSIC_SOLO, 'x')).toBe('b');
    expect(padKeyFor(CLASSIC_SOLO, 'c')).toBe('c');
    for (const k of ['arrowup', 'arrowleft', 'j', 'k', 'l', 'w', 'd']) expect(padKeyFor(CLASSIC_SOLO, k)).toBeNull();
    expect(CLASSIC_SOLO.formation).toEqual(ARROWS_SOLO.formation);
    expect(CLASSIC_SOLO.strategy).toEqual(ARROWS_SOLO.strategy);
  });

  it('the two schemes share no pad key, and neither reads R (exit / restart)', () => {
    for (const key of Object.keys(ARROWS_SOLO.pad)) expect(padKeyFor(CLASSIC_SOLO, key)).toBeNull();
    for (const key of Object.keys(CLASSIC_SOLO.pad)) expect(padKeyFor(ARROWS_SOLO, key)).toBeNull();
    for (const scheme of KEY_SCHEMES) expect(padKeyFor(SOLO_TABLES_BY_SCHEME[scheme][0], 'r')).toBeNull();
  });

  it('pairs each scheme with itself for both teams, and Flechas is the default', () => {
    expect(KEY_SCHEMES).toEqual(['arrows', 'classic']);
    expect(DEFAULT_KEY_SCHEME).toBe('arrows');
    expect(SOLO_TABLES_BY_SCHEME.arrows[0]).toBe(ARROWS_SOLO);
    expect(SOLO_TABLES_BY_SCHEME.arrows[1]).toBe(ARROWS_SOLO);
    expect(SOLO_TABLES_BY_SCHEME.classic[0]).toBe(CLASSIC_SOLO);
    expect(SOLO_TABLES_BY_SCHEME.classic[1]).toBe(CLASSIC_SOLO);
  });

  it('isPauseKey: Esc always pauses; P only while no active table reads it', () => {
    expect(isPauseKey('escape', SOLO_TABLES_BY_SCHEME.arrows)).toBe(true);
    expect(isPauseKey('escape', SOLO_TABLES_BY_SCHEME.classic)).toBe(true);
    expect(isPauseKey('escape', TWO_PLAYER_TABLES)).toBe(true);
    expect(isPauseKey('p', SOLO_TABLES_BY_SCHEME.arrows)).toBe(true);
    expect(isPauseKey('p', SOLO_TABLES_BY_SCHEME.classic)).toBe(false);   // with Clásico, P is "right"
    expect(isPauseKey('p', TWO_PLAYER_TABLES)).toBe(true);                // G9-2 untouched
    expect(isPauseKey('j', SOLO_TABLES_BY_SCHEME.arrows)).toBe(false);
    expect(isPauseKey('r', SOLO_TABLES_BY_SCHEME.classic)).toBe(false);
  });

  it('loadKeyScheme reads the stored scheme and falls back to Flechas on nothing, on garbage and on a throwing storage', () => {
    expect(KEY_SCHEME_STORAGE_KEY).toBe('av_vwc_key_scheme');
    expect(loadKeyScheme(() => 'classic')).toBe('classic');
    expect(loadKeyScheme(() => 'arrows')).toBe('arrows');
    expect(loadKeyScheme(() => null)).toBe('arrows');
    expect(loadKeyScheme(() => 'wasd')).toBe('arrows');
    expect(loadKeyScheme(() => { throw new Error('SecurityError'); })).toBe('arrows');
    expect(parseKeyScheme('CLASSIC')).toBe('arrows');   // exact values only
  });

  it('saveKeyScheme writes the scheme and swallows a throwing storage', () => {
    const written: string[] = [];
    saveKeyScheme((value) => { written.push(value); }, 'classic');
    expect(written).toEqual(['classic']);
    expect(() => saveKeyScheme(() => { throw new Error('QuotaExceededError'); }, 'arrows')).not.toThrow();
  });
});

// ── G15-20: the gamepad's PadState laid over the keyboard's TeamInput. ──
describe('overlayPadToTeamInput: the gamepad over the keyboard (G15-20)', () => {
  it('the keyboard wins a direction it holds; the gamepad fills an axis the keyboard leaves at 0', () => {
    const kb = createPadState('neutral', 0);
    const gp = createPadState('neutral', 0);
    const out = createTeamInput();
    kb.left = true;
    gp.right = true;
    gp.down = true;
    padToTeamInput(kb, true, out);
    overlayPadToTeamInput(gp, true, out);
    expect(out.dx).toBe(-1);
    expect(out.dy).toBe(1);
    expect(checkTeamInput(out, FORMATION_COUNT)).toEqual([]);
  });

  it('each button keeps the stronger state, and from the second step of a frame the gamepad edges settle too', () => {
    const kb = createPadState('neutral', 0);
    const gp = createPadState('neutral', 0);
    const out = createTeamInput();
    padDown(kb, 'b');        // keyboard: B pressed
    padDown(gp, 'b');
    padAdvance(gp);          // gamepad: B held
    padDown(gp, 'a');        // gamepad: A freshly pressed
    padToTeamInput(kb, true, out);
    overlayPadToTeamInput(gp, true, out);
    expect(out.a).toBe('pressed');   // from the gamepad alone
    expect(out.b).toBe('pressed');   // the keyboard's pressed beats the gamepad's held
    padToTeamInput(kb, false, out);
    overlayPadToTeamInput(gp, false, out);
    expect(out.a).toBe('held');      // settled: the gamepad's edge is not fired twice in one frame
    expect(out.b).toBe('held');
    expect(out.c).toBe('up');
  });
});
