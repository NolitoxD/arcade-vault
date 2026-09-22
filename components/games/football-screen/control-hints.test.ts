import { describe, expect, it } from 'vitest';
import {
  CONTROL_HINTS, TWO_PLAYER_SCHEME_NOTE, keeperHintFor, keyLabel, type ControlHints,
} from './control-hints';
import { ARROWS_SOLO, CLASSIC_SOLO, KEY_SCHEMES, TWO_PLAYER_P1, TWO_PLAYER_P2, type KeyTable } from './keyboard';

function allTexts(h: ControlHints): string[] {
  return [h.schemeRow, h.schemeDetail, h.mode, h.teamSolo, h.draw, h.bracketChoice, h.bracketPlay, h.spectate, h.victory];
}

describe('control hints per key scheme (G15-6)', () => {
  it('keeps the step-8 wording for Flechas, word for word', () => {
    const h = CONTROL_HINTS.arrows;
    expect(h.teamSolo).toBe('CRUCETA · A (J) CONFIRMA · 1/2/3 ALINEACIÓN');
    expect(h.draw).toBe('A (J) PARA CONTINUAR');
    expect(h.bracketChoice).toBe('IZQ / DER · A (J) CONFIRMA');
    expect(h.bracketPlay).toBe('A (J) PARA JUGAR');
    expect(h.spectate).toBe('PARTIDO DE LA CPU · X4 · A (J) SALTA AL RESULTADO');
    expect(h.victory).toBe('A (J) · CONTINUAR');
    expect(h.mode).toBe('ARRIBA / ABAJO: MODO · IZQ / DER: TECLADO · A (J) CONFIRMA');
  });

  it('names Clásico\'s own A key everywhere and never Flechas\' J', () => {
    const h = CONTROL_HINTS.classic;
    expect(h.draw).toBe('A (Z) PARA CONTINUAR');
    expect(h.mode).toBe('ARRIBA / ABAJO: MODO · IZQ / DER: TECLADO · A (Z) CONFIRMA');
    for (const text of allTexts(h)) expect(text).not.toContain('(J)');
    for (const text of allTexts(CONTROL_HINTS.arrows)) expect(text).not.toContain('(Z)');
  });

  it('keeperHintFor: the step-8 texts for Flechas, J2 and J1, and Clásico\'s own', () => {
    expect(keeperHintFor(ARROWS_SOLO)).toBe('SAQUE: K CORTO · J LARGO · ');
    expect(keeperHintFor(TWO_PLAYER_P2)).toBe('SAQUE: K CORTO · J LARGO · ');
    expect(keeperHintFor(TWO_PLAYER_P1)).toBe('SAQUE: V CORTO · C LARGO · ');
    expect(keeperHintFor(CLASSIC_SOLO)).toBe('SAQUE: X CORTO · Z LARGO · ');
  });

  it('keyLabel names the key a table reads for a pad key, upper-cased, and throws when there is none', () => {
    expect(keyLabel(ARROWS_SOLO, 'a')).toBe('J');
    expect(keyLabel(CLASSIC_SOLO, 'right')).toBe('P');
    expect(keyLabel(TWO_PLAYER_P1, 'b')).toBe('V');
    const noC: KeyTable = { pad: { j: 'a' }, formation: [], strategy: [] };
    expect(() => keyLabel(noC, 'c')).toThrow();
  });

  it('the scheme row names the scheme, the detail its keys and its pause, and the two-player note says it is fixed', () => {
    for (const scheme of KEY_SCHEMES) {
      for (const text of allTexts(CONTROL_HINTS[scheme])) expect(text.length).toBeGreaterThan(0);
    }
    expect(CONTROL_HINTS.arrows.schemeRow).toContain('FLECHAS');
    expect(CONTROL_HINTS.classic.schemeRow).toContain('CLÁSICO');
    expect(CONTROL_HINTS.arrows.schemeDetail).toContain('J/K/L');
    expect(CONTROL_HINTS.arrows.schemeDetail).toContain('P');
    expect(CONTROL_HINTS.classic.schemeDetail).toContain('Q/A/O/P');
    expect(CONTROL_HINTS.classic.schemeDetail).toContain('Z/X/C');
    expect(CONTROL_HINTS.classic.schemeDetail).toContain('ESC');
    expect(TWO_PLAYER_SCHEME_NOTE).toContain('WASD');
  });
});
