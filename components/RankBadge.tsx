import type { Rank } from '@/lib/credits';

type Px = [x: number, y: number, w: number, h: number, color: string];

function coin(fill: string, rim: string, highlight: string): Px[] {
  return [
    [4, 1, 4, 1, rim],
    [3, 2, 6, 1, rim],
    [2, 3, 8, 6, rim],
    [3, 9, 6, 1, rim],
    [4, 10, 4, 1, rim],
    [4, 2, 4, 1, fill],
    [3, 3, 6, 6, fill],
    [4, 9, 4, 1, fill],
    [5, 4, 2, 4, rim],
    [4, 3, 2, 1, highlight],
  ];
}

const STAR: Px[] = (() => {
  const fill = '#ff00e5';
  const rim = '#8a0070';
  const highlight = '#ffb3f7';
  return [
    [5, 0, 2, 1, rim],
    [4, 1, 1, 3, rim],
    [7, 1, 1, 3, rim],
    [0, 4, 5, 1, rim],
    [7, 4, 5, 1, rim],
    [1, 5, 1, 1, rim],
    [10, 5, 1, 1, rim],
    [2, 6, 1, 1, rim],
    [9, 6, 1, 1, rim],
    [3, 7, 1, 1, rim],
    [8, 7, 1, 1, rim],
    [2, 8, 1, 1, rim],
    [9, 8, 1, 1, rim],
    [1, 9, 1, 1, rim],
    [4, 9, 4, 1, rim],
    [10, 9, 1, 1, rim],
    [0, 10, 4, 1, rim],
    [8, 10, 4, 1, rim],
    [5, 1, 2, 4, fill],
    [2, 5, 8, 1, fill],
    [3, 6, 6, 1, fill],
    [4, 7, 4, 1, fill],
    [3, 8, 6, 1, fill],
    [2, 9, 2, 1, fill],
    [8, 9, 2, 1, fill],
    [5, 1, 1, 2, highlight],
    [2, 5, 2, 1, highlight],
  ];
})();

const CROWN: Px[] = (() => {
  const fill = '#ffd400';
  const rim = '#8a6a00';
  const base = '#b38f00';
  const magenta = '#ff00e5';
  const cyan = '#00f5ff';
  const highlight = '#fff2a8';
  return [
    [5, 0, 2, 1, rim],
    [1, 1, 1, 1, rim],
    [4, 1, 1, 1, rim],
    [7, 1, 1, 1, rim],
    [10, 1, 1, 1, rim],
    [0, 2, 1, 1, rim],
    [2, 2, 1, 1, rim],
    [4, 2, 1, 1, rim],
    [7, 2, 1, 1, rim],
    [9, 2, 1, 1, rim],
    [11, 2, 1, 1, rim],
    [0, 3, 1, 1, rim],
    [3, 3, 2, 1, rim],
    [7, 3, 2, 1, rim],
    [11, 3, 1, 1, rim],
    [0, 4, 1, 6, rim],
    [11, 4, 1, 6, rim],
    [0, 10, 12, 1, rim],
    [5, 1, 2, 2, fill],
    [1, 2, 1, 1, fill],
    [10, 2, 1, 1, fill],
    [1, 3, 2, 1, fill],
    [5, 3, 2, 1, fill],
    [9, 3, 2, 1, fill],
    [1, 4, 10, 3, fill],
    [1, 7, 10, 3, base],
    [2, 8, 1, 1, magenta],
    [5, 8, 2, 1, cyan],
    [9, 8, 1, 1, magenta],
    [5, 1, 1, 1, highlight],
    [2, 5, 1, 1, highlight],
  ];
})();

const SPRITES: Record<Exclude<Rank, 'INVITADO'>, Px[]> = {
  NOVATO: coin('#8a8a9a', '#3a3a48', '#c8c8d4'),
  JUGADOR: coin('#00f5ff', '#007a80', '#c9ffff'),
  VETERANO: STAR,
  'MAESTRO DEL VAULT': CROWN,
};

export default function RankBadge({
  rank,
  size = 18,
}: {
  rank: Rank;
  size?: number;
}) {
  if (rank === 'INVITADO') return null;
  const rects = SPRITES[rank];
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label={rank}
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      {rects.map(([x, y, w, h, color], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={color} />
      ))}
    </svg>
  );
}
