import { describe, expect, it } from 'vitest';
import { KIT_CLASH_DISTANCE, kitDistance, kitsClash, resolveMatchKits } from './kits';
import { TEAMS, teamById, type Kit } from './teams';

function kitOf(id: string): Kit {
  const def = teamById(TEAMS, id);
  if (def === undefined) throw new Error(`team not in bank: ${id}`);
  return def.kit;
}

function primaryOf(id: string): string {
  return kitOf(id).primary;
}

describe('kitDistance: Euclidean RGB distance over 0-255 channels', () => {
  it('is zero for identical colours', () => {
    expect(kitDistance('#ffffff', '#ffffff')).toBe(0);
  });
  it('is the diagonal of the cube for black vs white', () => {
    expect(kitDistance('#000000', '#ffffff')).toBeCloseTo(441.67, 1);
  });
  it('is case-insensitive', () => {
    expect(kitDistance('#AABBCC', '#aabbcc')).toBe(0);
  });
  it('throws on a malformed colour', () => {
    expect(() => kitDistance('red', '#ffffff')).toThrow();
    expect(() => kitDistance('#fff', '#ffffff')).toThrow();
    expect(() => kitDistance('ffffff', '#ffffff')).toThrow();
  });
});

describe('kitsClash: below KIT_CLASH_DISTANCE reads as the same colour', () => {
  it('KIT_CLASH_DISTANCE is 100', () => {
    expect(KIT_CLASH_DISTANCE).toBe(100);
  });

  // Real bank, real ids -- QA 15-sep's own list of unreadable pairs.
  const clashingPairs: [string, string][] = [
    ['alemania', 'inglaterra'],
    ['alemania', 'estados-unidos'],
    ['inglaterra', 'estados-unidos'],
    ['espana', 'croacia'],
    ['portugal', 'belgica'],
    ['croacia', 'marruecos'],
    ['argentina', 'uruguay'],
    ['francia', 'japon'],
    ['italia', 'francia'],
  ];
  it.each(clashingPairs)('%s vs %s clashes', (a, b) => {
    expect(kitsClash(primaryOf(a), primaryOf(b))).toBe(true);
  });

  const distinctPairs: [string, string][] = [
    ['espana', 'brasil'],
    ['paises-bajos', 'croacia'],
    ['alemania', 'belgica'],
    ['argentina', 'italia'],
    ['mexico', 'brasil'],
  ];
  it.each(distinctPairs)('%s vs %s does not clash', (a, b) => {
    expect(kitsClash(primaryOf(a), primaryOf(b))).toBe(false);
  });

  it('is strict: exactly KIT_CLASH_DISTANCE does not clash', () => {
    expect(kitDistance('#000000', '#640000')).toBe(100);
    expect(kitsClash('#000000', '#640000')).toBe(false);
  });
  it('is strict: just under KIT_CLASH_DISTANCE does clash', () => {
    expect(kitDistance('#000000', '#630000')).toBe(99);
    expect(kitsClash('#000000', '#630000')).toBe(true);
  });
});

describe('resolveMatchKits: the away side inverts when the primaries clash', () => {
  it('returns the same tuple (identity) when there is no clash', () => {
    const home = kitOf('espana');
    const away = kitOf('brasil');
    const [rHome, rAway] = resolveMatchKits(home, away);
    expect(rHome).toBe(home);
    expect(rAway).toBe(away);
  });

  it('inverts the away kit when the primaries clash, home unchanged', () => {
    const home = kitOf('alemania');
    const away = kitOf('inglaterra');
    const [rHome, rAway] = resolveMatchKits(home, away);
    expect(rHome).toBe(home);
    expect(rAway).toEqual({ primary: '#cf081f', secondary: '#ffffff' });
  });

  it('never mutates its inputs', () => {
    const home = kitOf('alemania');
    const away = kitOf('inglaterra');
    const homeCopy = { ...home };
    const awayCopy = { ...away };
    resolveMatchKits(home, away);
    expect(home).toEqual(homeCopy);
    expect(away).toEqual(awayCopy);
  });

  it('returns the inverted away kit even when it still clashes with home (no third option in v1)', () => {
    const home: Kit = { primary: '#ffffff', secondary: '#000000' };
    const away: Kit = { primary: '#fffffe', secondary: '#fefefe' };
    const [rHome, rAway] = resolveMatchKits(home, away);
    expect(rHome).toBe(home);
    expect(rAway).toEqual({ primary: '#fefefe', secondary: '#fffffe' });
    expect(kitsClash(rHome.primary, rAway.primary)).toBe(true);
  });

  it('bank-wide: after resolution, no ordered pair of the 16 teams still clashes', () => {
    const failures: string[] = [];
    for (const home of TEAMS) {
      for (const away of TEAMS) {
        if (home.id === away.id) continue;
        const [rHome, rAway] = resolveMatchKits(home.kit, away.kit);
        if (kitsClash(rHome.primary, rAway.primary)) {
          failures.push(`${home.id} (home) vs ${away.id} (away): ${kitDistance(rHome.primary, rAway.primary).toFixed(2)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
