export type FighterId =
  | 'nova' | 'torre' | 'glitch' | 'voltio' | 'oxido'
  | 'eco' | 'pixel' | 'brecha' | 'arquitecto';

export type MagicId =
  | 'destello' | 'muro' | 'salto-de-fase' | 'descarga' | 'corrosion'
  | 'onda' | 'duplicado' | 'sismico' | 'reinicio';

export type MagicKind = 'projectile' | 'area' | 'self-state' | 'foe-state';

export type FighterPalette = { body: string; trim: string; accent: string };

export type FighterDef = {
  id: FighterId;
  name: string;
  strength: number;
  speed: number;
  reach: number;
  magic: MagicId;
  boss: boolean;
  palette: FighterPalette;
  build: number;
};

export const STAT_MIN = 1;
export const STAT_MAX = 10;
export const STAT_BUDGET = 15;
export const ROSTER_SIZE = 8;

export const ROSTER: readonly FighterDef[] = [
  {
    id: 'nova', name: 'NOVA', strength: 5, speed: 5, reach: 5,
    magic: 'destello', boss: false, build: 1,
    palette: { body: '#e8f4ff', trim: '#00f5ff', accent: '#ffffff' },
  },
  {
    id: 'torre', name: 'TORRE', strength: 9, speed: 2, reach: 4,
    magic: 'muro', boss: false, build: 1.1,
    palette: { body: '#3a3a3a', trim: '#8a8a8a', accent: '#c0c0c0' },
  },
  {
    id: 'glitch', name: 'GLITCH', strength: 3, speed: 9, reach: 3,
    magic: 'salto-de-fase', boss: false, build: 0.9,
    palette: { body: '#0d0d0d', trim: '#ff00ff', accent: '#00ff9d' },
  },
  {
    id: 'voltio', name: 'VOLTIO', strength: 4, speed: 8, reach: 3,
    magic: 'descarga', boss: false, build: 0.95,
    palette: { body: '#1a1a00', trim: '#ffe600', accent: '#fff9c4' },
  },
  {
    id: 'oxido', name: 'ÓXIDO', strength: 7, speed: 4, reach: 4,
    magic: 'corrosion', boss: false, build: 1.05,
    palette: { body: '#3d1f0a', trim: '#d2691e', accent: '#ff8c42' },
  },
  {
    id: 'eco', name: 'ECO', strength: 3, speed: 3, reach: 9,
    magic: 'onda', boss: false, build: 0.92,
    palette: { body: '#0a1a2e', trim: '#7b2ff7', accent: '#00e5ff' },
  },
  {
    id: 'pixel', name: 'PÍXEL', strength: 4, speed: 7, reach: 4,
    magic: 'duplicado', boss: false, build: 0.95,
    palette: { body: '#001a00', trim: '#39ff14', accent: '#ffffff' },
  },
  {
    id: 'brecha', name: 'BRECHA', strength: 8, speed: 3, reach: 4,
    magic: 'sismico', boss: false, build: 1.08,
    palette: { body: '#1a0000', trim: '#ff3b3b', accent: '#ffb3b3' },
  },
  {
    id: 'arquitecto', name: 'EL ARQUITECTO', strength: 8, speed: 7, reach: 7,
    magic: 'reinicio', boss: true, build: 1,
    palette: { body: '#1a1a2e', trim: '#ff2d55', accent: '#f5f5f5' },
  },
];

export function statTotal(def: FighterDef): number {
  return def.strength + def.speed + def.reach;
}

export function fighterById(roster: readonly FighterDef[], id: string): FighterDef | undefined {
  return roster.find((f) => f.id === id);
}

export function selectableFighters(roster: readonly FighterDef[]): FighterDef[] {
  return roster.filter((f) => !f.boss);
}

export function bossFighter(roster: readonly FighterDef[]): FighterDef {
  const boss = roster.find((f) => f.boss);
  if (!boss) throw new Error('no boss in roster');
  return boss;
}

export function difficultyRank(def: FighterDef): number {
  return def.strength * 1.1 + def.speed * 1.3 + def.reach * 1.0;
}
