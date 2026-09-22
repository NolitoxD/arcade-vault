import {
  ARROWS_SOLO, CLASSIC_SOLO, TWO_PLAYER_P1, type KeyScheme, type KeyTable, type PadKey,
} from './keyboard';

// G15-6 (grill of the v1.5, 17-sep): every on-screen text that names a key, built ONCE
// per scheme when the module loads -- draw() only looks a property up (criterion 20).
// The key letters come from the table itself, so a hint can never contradict the keys
// it describes. The Flechas texts are the step-8 ones word for word, except `mode`,
// which now also says how to change the scheme.

// The key a table reads for a pad key, upper-cased for the screen ('j' -> 'J'). Only
// called at module load and by tests (Object.keys allocates).
export function keyLabel(table: KeyTable, k: PadKey): string {
  for (const key of Object.keys(table.pad)) if (table.pad[key] === k) return key.toUpperCase();
  throw new Error(`no key for ${k}`);
}

export type ControlHints = {
  readonly schemeRow: string;      // ELIGE MODO: the row, 'TECLADO: < FLECHAS >'
  readonly schemeDetail: string;   // ELIGE MODO: the keys of that scheme and its pause
  readonly mode: string;           // ELIGE MODO: the screen hint
  readonly teamSolo: string;
  readonly draw: string;
  readonly bracketChoice: string;
  readonly bracketPlay: string;
  readonly spectate: string;
  readonly victory: string;
};

const SCHEME_NAMES: Readonly<Record<KeyScheme, string>> = { arrows: 'FLECHAS', classic: 'CLÁSICO' };
// The direction keys have no single-letter label on the arrows, so the detail line is
// written per scheme; its button letters are checked against the tables by the tests.
const SCHEME_DETAILS: Readonly<Record<KeyScheme, string>> = {
  arrows: 'FLECHAS + J/K/L · P O ESC PAUSA',
  classic: 'Q/A/O/P + Z/X/C · ESC PAUSA (LA P ES DERECHA)',
};

function buildHints(scheme: KeyScheme, table: KeyTable): ControlHints {
  const a = keyLabel(table, 'a');
  return {
    schemeRow: `TECLADO: < ${SCHEME_NAMES[scheme]} >`,
    schemeDetail: SCHEME_DETAILS[scheme],
    mode: `ARRIBA / ABAJO: MODO · IZQ / DER: TECLADO · A (${a}) CONFIRMA`,
    teamSolo: `CRUCETA · A (${a}) CONFIRMA · 1/2/3 ALINEACIÓN`,
    draw: `A (${a}) PARA CONTINUAR`,
    bracketChoice: `IZQ / DER · A (${a}) CONFIRMA`,
    bracketPlay: `A (${a}) PARA JUGAR`,
    spectate: `PARTIDO DE LA CPU · X4 · A (${a}) SALTA AL RESULTADO`,
    victory: `A (${a}) · CONTINUAR`,
  };
}

export const CONTROL_HINTS: Readonly<Record<KeyScheme, ControlHints>> = {
  arrows: buildHints('arrows', ARROWS_SOLO),
  classic: buildHints('classic', CLASSIC_SOLO),
};

// Shown dimmed on the scheme row while AMISTOSO A DOS is the highlighted mode: G9-2's
// split is fixed and the scheme does not apply to it.
export const TWO_PLAYER_SCHEME_NOTE = 'A DOS NO SE ELIGE: J1 WASD + C/V/B · J2 FLECHAS + J/K/L';

// S-SC3's keeper-hold hint, per table: B throws short, A throws long.
function keeperHint(table: KeyTable): string {
  return `SAQUE: ${keyLabel(table, 'b')} CORTO · ${keyLabel(table, 'a')} LARGO · `;
}
const KEEPER_HINT_ARROWS = keeperHint(ARROWS_SOLO);   // also J2's: the same J/K
const KEEPER_HINT_CLASSIC = keeperHint(CLASSIC_SOLO);
const KEEPER_HINT_P1 = keeperHint(TWO_PLAYER_P1);

// By table identity, like the step-8 code it replaces: no string is built per frame.
export function keeperHintFor(table: KeyTable): string {
  if (table === CLASSIC_SOLO) return KEEPER_HINT_CLASSIC;
  if (table === TWO_PLAYER_P1) return KEEPER_HINT_P1;
  return KEEPER_HINT_ARROWS;
}
