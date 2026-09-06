export type Role = 'gk' | 'def' | 'mid' | 'fwd';
// exported for v1.5 (per-role attributes) / Task 8 if the HUD paints the slot role; today only teams.ts uses it
export type OutfieldRole = Exclude<Role, 'gk'>;
export type Strategy = 'attack' | 'neutral' | 'defend';

// exported for Task 8: the component reads the kit to paint the shirts; today only teams.ts uses it
export type Kit = { primary: string; secondary: string };
export type TeamDef = { id: string; name: string; kit: Kit };

// Fractions of the pitch for the team attacking towards +x; the engine mirrors x for the other side.
export type FormationSlot = { role: OutfieldRole; x: number; y: number };
export type Formation = { id: string; name: string; slots: readonly FormationSlot[] };

export const TEAM_SIZE = 9;
export const OUTFIELD = 8;
export const BANK_SIZE = 16;
export const FORMATION_COUNT = 3;

// The strategy shifts every slot this fraction of the pitch towards the rival goal (attack) or away (defend).
export const STRATEGY_SHIFT = 0.12;
export const STRATEGIES: Readonly<Record<Strategy, number>> = {
  attack: STRATEGY_SHIFT,
  neutral: 0,
  defend: -STRATEGY_SHIFT,
};

// The three line-ups of the spec. 3-3-2 is the stage-A one, untouched: several
// tests are coupled to its exact geometry (see the final review of stage A).
export const FORMATIONS: readonly Formation[] = [
  {
    id: '3-3-2',
    name: 'NORMAL',
    slots: [
      { role: 'def', x: 0.22, y: 0.25 }, { role: 'def', x: 0.22, y: 0.5 }, { role: 'def', x: 0.22, y: 0.75 },
      { role: 'mid', x: 0.45, y: 0.25 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.75 },
      { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
    ],
  },
  {
    id: '3-2-3',
    name: 'OFENSIVA',
    slots: [
      { role: 'def', x: 0.22, y: 0.25 }, { role: 'def', x: 0.22, y: 0.5 }, { role: 'def', x: 0.22, y: 0.75 },
      { role: 'mid', x: 0.45, y: 0.35 }, { role: 'mid', x: 0.45, y: 0.65 },
      { role: 'fwd', x: 0.7, y: 0.2 }, { role: 'fwd', x: 0.7, y: 0.5 }, { role: 'fwd', x: 0.7, y: 0.8 },
    ],
  },
  {
    id: '4-3-1',
    name: 'DEFENSIVA',
    slots: [
      { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
      { role: 'mid', x: 0.42, y: 0.25 }, { role: 'mid', x: 0.42, y: 0.5 }, { role: 'mid', x: 0.42, y: 0.75 },
      { role: 'fwd', x: 0.68, y: 0.5 },
    ],
  },
];

// The bank of sixteen: identical on the pitch in v1, different in name and kit.
export const TEAMS: readonly TeamDef[] = [
  { id: 'espana', name: 'ESPAÑA', kit: { primary: '#d40000', secondary: '#ffcc00' } },
  { id: 'italia', name: 'ITALIA', kit: { primary: '#0044aa', secondary: '#ffffff' } },
  { id: 'brasil', name: 'BRASIL', kit: { primary: '#ffdf00', secondary: '#009c3b' } },
  { id: 'argentina', name: 'ARGENTINA', kit: { primary: '#75aadb', secondary: '#ffffff' } },
  { id: 'alemania', name: 'ALEMANIA', kit: { primary: '#ffffff', secondary: '#000000' } },
  { id: 'francia', name: 'FRANCIA', kit: { primary: '#002395', secondary: '#ffffff' } },
  { id: 'inglaterra', name: 'INGLATERRA', kit: { primary: '#ffffff', secondary: '#cf081f' } },
  { id: 'portugal', name: 'PORTUGAL', kit: { primary: '#e42518', secondary: '#006600' } },
  { id: 'paises-bajos', name: 'PAÍSES BAJOS', kit: { primary: '#ff7f00', secondary: '#ffffff' } },
  { id: 'belgica', name: 'BÉLGICA', kit: { primary: '#e30613', secondary: '#000000' } },
  { id: 'croacia', name: 'CROACIA', kit: { primary: '#ff0000', secondary: '#ffffff' } },
  { id: 'uruguay', name: 'URUGUAY', kit: { primary: '#7ec0ee', secondary: '#000000' } },
  { id: 'mexico', name: 'MÉXICO', kit: { primary: '#006847', secondary: '#ffffff' } },
  { id: 'japon', name: 'JAPÓN', kit: { primary: '#1b2f7a', secondary: '#ffffff' } },
  { id: 'marruecos', name: 'MARRUECOS', kit: { primary: '#c1272d', secondary: '#006233' } },
  { id: 'estados-unidos', name: 'ESTADOS UNIDOS', kit: { primary: '#ffffff', secondary: '#0a3161' } },
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
