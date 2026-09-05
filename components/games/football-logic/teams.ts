export type Role = 'gk' | 'def' | 'mid' | 'fwd';
export type OutfieldRole = Exclude<Role, 'gk'>;
export type Strategy = 'attack' | 'neutral' | 'defend';

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

// Task 1 publishes only 3-3-2; 3-2-3 and 4-3-1 arrive in step 7 (stage B) with the net already green.
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
];

// Task 1 publishes two; the bank of sixteen arrives in step 7.
export const TEAMS: readonly TeamDef[] = [
  { id: 'espana', name: 'ESPAÑA', kit: { primary: '#d40000', secondary: '#ffcc00' } },
  { id: 'italia', name: 'ITALIA', kit: { primary: '#0044aa', secondary: '#ffffff' } },
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
