export type Role = 'gk' | 'def' | 'mid' | 'fwd';
// exported for v1.5 (per-role attributes) / Task 8 if the HUD paints the slot role; today only teams.ts uses it
export type OutfieldRole = Exclude<Role, 'gk'>;
export type Strategy = 'attack' | 'neutral' | 'defend';

// exported for Task 8: the component reads the kit to paint the shirts; today only teams.ts uses it
export type Kit = { primary: string; secondary: string };
// G15-10 (v1.5): five levels 1-5 per selection. They are DATA, not a difficulty: the
// difficulty still dominates the profile (see attributes.test.ts). profileFor reads
// defence, shooting and passing. attack and counter are DATA ONLY in V15-4 (Paco,
// 30-sep): stored per selection, no effect on play -- only checkAttributes reads them,
// to range-check them.
export type TeamAttrs = {
  defence: number;
  attack: number;
  counter: number;
  shooting: number;
  passing: number;
};

export type TeamDef = { id: string; name: string; kit: Kit; attrs: TeamAttrs };

// Fractions of the pitch for the team attacking towards +x; the engine mirrors x for the other side.
export type FormationSlot = { role: OutfieldRole; x: number; y: number };
export type Formation = { id: string; name: string; slots: readonly FormationSlot[] };

export const TEAM_SIZE = 11;
export const OUTFIELD = 10;
export const BANK_SIZE = 20;
export const FORMATION_COUNT = 3;

// The strategy shifts every slot this fraction of the pitch towards the rival goal (attack) or away (defend).
export const STRATEGY_SHIFT = 0.12;
export const STRATEGIES: Readonly<Record<Strategy, number>> = {
  attack: STRATEGY_SHIFT,
  neutral: 0,
  defend: -STRATEGY_SHIFT,
};

// G15-16 (v1.5, V15-4): eleven a side. The three line-ups keep their keys (1/2/3) and
// their names; only the shapes changed. Every slot keeps x within (STRATEGY_SHIFT,
// 1 - STRATEGY_SHIFT) so checkFormation's "leaves pitch under strategy" never fires,
// and no two slots share a position.
export const FORMATIONS: readonly Formation[] = [
  {
    id: '4-4-2',
    name: 'NORMAL',
    slots: [
      { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
      { role: 'mid', x: 0.45, y: 0.15 }, { role: 'mid', x: 0.45, y: 0.38 }, { role: 'mid', x: 0.45, y: 0.62 }, { role: 'mid', x: 0.45, y: 0.85 },
      { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
    ],
  },
  {
    id: '4-3-3',
    name: 'OFENSIVA',
    slots: [
      { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
      { role: 'mid', x: 0.45, y: 0.25 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.75 },
      { role: 'fwd', x: 0.72, y: 0.2 }, { role: 'fwd', x: 0.72, y: 0.5 }, { role: 'fwd', x: 0.72, y: 0.8 },
    ],
  },
  {
    id: '5-3-2',
    name: 'DEFENSIVA',
    slots: [
      { role: 'def', x: 0.18, y: 0.12 }, { role: 'def', x: 0.18, y: 0.31 }, { role: 'def', x: 0.18, y: 0.5 }, { role: 'def', x: 0.18, y: 0.69 }, { role: 'def', x: 0.18, y: 0.88 },
      { role: 'mid', x: 0.44, y: 0.25 }, { role: 'mid', x: 0.44, y: 0.5 }, { role: 'mid', x: 0.44, y: 0.75 },
      { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
    ],
  },
];

// The bank of twenty: identical on the pitch in v1, different in name and kit; since
// V15-4 (G15-10) also in their five attributes. G15-9 (v1.5) added the last four AT
// THE END on purpose -- a TEAMS index is an identity
// (selector cursor, flow.picked, the baked kit atlases), so nothing may shift.
export const TEAMS: readonly TeamDef[] = [
  { id: 'espana', name: 'ESPAÑA', kit: { primary: '#d40000', secondary: '#ffcc00' }, attrs: { defence: 3, attack: 4, counter: 3, shooting: 3, passing: 5 } },
  { id: 'italia', name: 'ITALIA', kit: { primary: '#0044aa', secondary: '#ffffff' }, attrs: { defence: 5, attack: 3, counter: 4, shooting: 3, passing: 3 } },
  { id: 'brasil', name: 'BRASIL', kit: { primary: '#ffdf00', secondary: '#009c3b' }, attrs: { defence: 3, attack: 5, counter: 4, shooting: 5, passing: 4 } },
  { id: 'argentina', name: 'ARGENTINA', kit: { primary: '#75aadb', secondary: '#ffffff' }, attrs: { defence: 4, attack: 5, counter: 4, shooting: 5, passing: 4 } },
  { id: 'alemania', name: 'ALEMANIA', kit: { primary: '#ffffff', secondary: '#000000' }, attrs: { defence: 4, attack: 4, counter: 3, shooting: 4, passing: 4 } },
  { id: 'francia', name: 'FRANCIA', kit: { primary: '#002395', secondary: '#ffffff' }, attrs: { defence: 4, attack: 4, counter: 5, shooting: 4, passing: 4 } },
  { id: 'inglaterra', name: 'INGLATERRA', kit: { primary: '#ffffff', secondary: '#cf081f' }, attrs: { defence: 4, attack: 3, counter: 3, shooting: 4, passing: 3 } },
  { id: 'portugal', name: 'PORTUGAL', kit: { primary: '#e42518', secondary: '#006600' }, attrs: { defence: 3, attack: 4, counter: 4, shooting: 4, passing: 4 } },
  { id: 'paises-bajos', name: 'PAÍSES BAJOS', kit: { primary: '#ff7f00', secondary: '#ffffff' }, attrs: { defence: 3, attack: 4, counter: 3, shooting: 3, passing: 4 } },
  { id: 'belgica', name: 'BÉLGICA', kit: { primary: '#e30613', secondary: '#000000' }, attrs: { defence: 3, attack: 4, counter: 4, shooting: 4, passing: 3 } },
  { id: 'croacia', name: 'CROACIA', kit: { primary: '#ff0000', secondary: '#ffffff' }, attrs: { defence: 3, attack: 3, counter: 3, shooting: 3, passing: 4 } },
  { id: 'uruguay', name: 'URUGUAY', kit: { primary: '#7ec0ee', secondary: '#000000' }, attrs: { defence: 4, attack: 3, counter: 4, shooting: 3, passing: 3 } },
  { id: 'mexico', name: 'MÉXICO', kit: { primary: '#006847', secondary: '#ffffff' }, attrs: { defence: 3, attack: 3, counter: 4, shooting: 3, passing: 3 } },
  { id: 'japon', name: 'JAPÓN', kit: { primary: '#1b2f7a', secondary: '#ffffff' }, attrs: { defence: 3, attack: 3, counter: 4, shooting: 2, passing: 4 } },
  { id: 'marruecos', name: 'MARRUECOS', kit: { primary: '#c1272d', secondary: '#006233' }, attrs: { defence: 4, attack: 3, counter: 4, shooting: 3, passing: 3 } },
  { id: 'estados-unidos', name: 'ESTADOS UNIDOS', kit: { primary: '#ffffff', secondary: '#0a3161' }, attrs: { defence: 3, attack: 3, counter: 3, shooting: 3, passing: 3 } },
  { id: 'colombia', name: 'COLOMBIA', kit: { primary: '#fcd116', secondary: '#003893' }, attrs: { defence: 3, attack: 4, counter: 4, shooting: 4, passing: 4 } },
  { id: 'corea-del-sur', name: 'COREA DEL SUR', kit: { primary: '#c60c30', secondary: '#ffffff' }, attrs: { defence: 3, attack: 3, counter: 4, shooting: 3, passing: 3 } },
  { id: 'noruega', name: 'NORUEGA', kit: { primary: '#ba0c2f', secondary: '#00205b' }, attrs: { defence: 3, attack: 4, counter: 3, shooting: 4, passing: 3 } },
  { id: 'egipto', name: 'EGIPTO', kit: { primary: '#ce1126', secondary: '#ffffff' }, attrs: { defence: 3, attack: 3, counter: 3, shooting: 3, passing: 3 } },
];

export function teamById(teams: readonly TeamDef[], id: string): TeamDef | undefined {
  return teams.find((t) => t.id === id);
}

export function slotCounts(f: Formation): [number, number, number] {
  let def = 0;
  let mid = 0;
  let fwd = 0;
  for (const s of f.slots) {
    if (s.role === 'def') def++;
    else if (s.role === 'mid') mid++;
    else if (s.role === 'fwd') fwd++;
  }
  return [def, mid, fwd];
}
