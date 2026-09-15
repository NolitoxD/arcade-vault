import type { Kit } from './teams';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Below this Euclidean RGB distance, two kit primaries read as the same colour on
// screen: same dot on the minimap, same shirt block in the HUD, same shape on the
// pitch. QA 15-sep: white/white (ALEMANIA vs INGLATERRA vs ESTADOS UNIDOS), the reds,
// the light blues and the dark blues all clash under this threshold.
export const KIT_CLASH_DISTANCE = 100;

// Shared with invariants.ts's checkTeam so the '#rrggbb' shape lives in one place.
export function isKitColor(color: string): boolean {
  return HEX_COLOR.test(color);
}

function parseHex(color: string): [number, number, number] {
  if (!isKitColor(color)) throw new Error(`malformed kit colour: ${color}`);
  const hex = color.slice(1);
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

// Euclidean distance in RGB space, channels 0-255. Parses '#rrggbb', lowercase or
// uppercase; throws on anything else (named colours, short hex, missing '#').
export function kitDistance(a: string, b: string): number {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

export function kitsClash(a: string, b: string): boolean {
  return kitDistance(a, b) < KIT_CLASH_DISTANCE;
}

// Decision (Paco, 15-sep): when the two primaries clash, the AWAY side plays its
// inverted kit (primary/secondary swapped). HOME never changes -- no clash resolution
// for the team selector, no re-picking of the rival, just the shirt the away side
// wears once the match starts. Never mutates `home` or `away`.
//
// If the inverted away kit still clashes with home.primary, it is returned anyway:
// no third option exists in v1. Verified empirically for the real 16-team bank in
// kits.test.ts (a bank-wide property over all 240 ordered pairs) -- report any
// failing pair rather than silently weakening that test.
export function resolveMatchKits(home: Kit, away: Kit): readonly [Kit, Kit] {
  if (!kitsClash(home.primary, away.primary)) return [home, away];
  return [home, { primary: away.secondary, secondary: away.primary }];
}
