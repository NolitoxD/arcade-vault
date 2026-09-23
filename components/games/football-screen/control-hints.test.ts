import { describe, expect, it } from 'vitest';
import {
  CONTROL_HINTS, TWO_PLAYER_SCHEME_NOTE, keeperHintFor, keyLabel, type ControlHints,
} from './control-hints';
import { ARROWS_SOLO, CLASSIC_SOLO, KEY_SCHEMES, TWO_PLAYER_P1, TWO_PLAYER_P2, type KeyTable } from './keyboard';

function allTexts(h: ControlHints): string[] {
  return [
    h.schemeRow, h.schemeDetail, h.mode, h.teamSolo, h.draw, h.bracketChoice, h.bracketPlay, h.spectate, h.victory,
    h.lineupBrowse, h.lineupSwap, h.lineupEdit,
  ];
}

describe('control hints per key scheme (G15-6)', () => {
  it('keeps the step-8 wording for Flechas, word for word', () => {
    const h = CONTROL_HINTS.arrows;
    expect(h.teamSolo).toBe('CRUCETA · A (J) CONFIRMA · 1/2/3 ALINEACIÓN');
    expect(h.draw).toBe('A (J) PARA CONTINUAR');
    expect(h.bracketChoice).toBe('IZQ / DER: VER · SALTAR · TODOS · A (J) CONFIRMA');
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

  it('the bracket hint names the three choices of G15-8, in the order they are drawn', () => {
    for (const scheme of KEY_SCHEMES) {
      const text = CONTROL_HINTS[scheme].bracketChoice;
      expect(text.indexOf('VER')).toBeGreaterThanOrEqual(0);
      expect(text.indexOf('SALTAR')).toBeGreaterThan(text.indexOf('VER'));
      expect(text.indexOf('TODOS')).toBeGreaterThan(text.indexOf('SALTAR'));
    }
    expect(CONTROL_HINTS.classic.bracketChoice).toContain('(Z)');
  });

  it('the ALINEACIÓN hints name the three actions of G15-17 with Paco\'s own A/B/C split', () => {
    // A confirms or chooses, B goes back or cancels, C edits the name -- the same
    // split as every other screen (resolución (d), 23-sep).
    expect(CONTROL_HINTS.arrows.lineupBrowse).toBe('CRUCETA · A (J) CAMBIAR · C (L) NOMBRE · B (K) VOLVER');
    expect(CONTROL_HINTS.arrows.lineupSwap).toBe('CRUCETA: ELIGE RESERVA · A (J) CONFIRMA · B (K) CANCELA');
    expect(CONTROL_HINTS.classic.lineupBrowse).toBe('CRUCETA · A (Z) CAMBIAR · C (C) NOMBRE · B (X) VOLVER');
    expect(CONTROL_HINTS.classic.lineupSwap).toContain('(Z)');
  });

  it('the name editor hint names no key of any scheme: it is the letters themselves plus Enter', () => {
    for (const scheme of KEY_SCHEMES) {
      expect(CONTROL_HINTS[scheme].lineupEdit).toBe('ESCRIBE EL NOMBRE · MÁX. 12 · ENTER CONFIRMA');
    }
  });
});
