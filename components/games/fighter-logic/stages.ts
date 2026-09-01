export type Silhouette =
  | 'towers' | 'pipes' | 'arcs' | 'grid' | 'spires' | 'dunes' | 'ribs' | 'core';

export type StageDef = {
  id: string;
  name: string;
  sky: [string, string];
  ground: string;
  accent: string;
  silhouette: Silhouette;
};

export const STAGE_COUNT = 8;

export const STAGES: readonly StageDef[] = [
  {
    id: 'arranque', name: 'SALA DE ARRANQUE', silhouette: 'towers',
    sky: ['#0a1a2e', '#1478a8'], ground: '#0d2233', accent: '#00e5ff',
  },
  {
    id: 'cartuchos', name: 'PATIO DE CARTUCHOS', silhouette: 'grid',
    sky: ['#1f0a35', '#6d1fb0'], ground: '#2a1140', accent: '#ff2fd0',
  },
  {
    id: 'tunel', name: 'TÚNEL DE DATOS', silhouette: 'pipes',
    sky: ['#04150d', '#0e5c34'], ground: '#0a2318', accent: '#a6ff2e',
  },
  {
    id: 'azotea', name: 'AZOTEA NEÓN', silhouette: 'spires',
    sky: ['#2b0a3d', '#8a1f6b'], ground: '#3a1130', accent: '#ff4fa3',
  },
  {
    id: 'fundicion', name: 'FUNDICIÓN', silhouette: 'arcs',
    sky: ['#2e0c0a', '#8a3410'], ground: '#3a140a', accent: '#ff7a1a',
  },
  {
    id: 'cinta', name: 'DESIERTO DE CINTA', silhouette: 'dunes',
    sky: ['#3d2b0f', '#c98a2e'], ground: '#4a3418', accent: '#ffb238',
  },
  {
    id: 'servidores', name: 'CATEDRAL DE SERVIDORES', silhouette: 'ribs',
    sky: ['#1c2733', '#4a6478'], ground: '#232d38', accent: '#e8f0f5',
  },
  {
    id: 'nucleo', name: 'NÚCLEO DEL VAULT', silhouette: 'core',
    sky: ['#000000', '#2a2a2e'], ground: '#0a0a0c', accent: '#c0c0c8',
  },
];

export function stageForBout(stages: readonly StageDef[], boutIndex: number): StageDef {
  const clamped = Math.min(Math.max(boutIndex, 0), STAGE_COUNT - 1);
  return stages[clamped];
}
