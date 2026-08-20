'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import type { GameRow } from '@/lib/supabase/types';
import { useUser } from '@/app/context/UserContext';

function GameCard({ game }: { game: GameRow }) {
  const ref = useRef<HTMLDivElement>(null);
  const { hasPlayed } = useUser();

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    requestAnimationFrame(() => {
      el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
    });
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
  }

  const btnColor =
    game.color === 'magenta'
      ? 'magenta'
      : game.color === 'yellow'
        ? 'yellow'
        : '';

  return (
    <div ref={ref} className="card" onMouseMove={onMove} onMouseLeave={onLeave}>
      <Link href={`/games/${game.id}`} className="cover">
        {game.cover.startsWith('/') ? (
          <div
            className="cover-bg cover-image"
            style={{ backgroundImage: `url(${game.cover})` }}
          />
        ) : (
          <div className={`cover-bg ${game.cover}`} />
        )}
        <div className="label">{game.cat}</div>
        {hasPlayed(game.id) && (
          <span className="played-badge" title="Ya jugado" aria-label="Ya jugado">
            ✓
          </span>
        )}
      </Link>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <Link
            href={`/games/${game.id}`}
            className={`btn ${btnColor}`}
            onClick={(e) => e.stopPropagation()}
          >
            JUGAR
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function GamesGrid({ games }: { games: GameRow[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');

  const cats = useMemo(
    () => Array.from(new Set(games.map((g) => g.cat))).sort(),
    [games],
  );

  const filtered = useMemo(
    () =>
      games.filter(
        (g) =>
          (cat === '' || g.cat === cat) &&
          g.title.toLowerCase().includes(q.toLowerCase()),
      ),
    [games, q, cat],
  );

  return (
    <>
      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar un juego por nombre…"
          />
        </div>
        <div className="av-chips">
          <button
            className={`chip${cat === '' ? ' active' : ''}`}
            onClick={() => setCat('')}
          >
            TODOS
          </button>
          <select
            className={`chip${cat !== '' ? ' active' : ''}`}
            aria-label="Filtrar por categoría"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="">CATEGORÍA</option>
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: 80,
              color: 'var(--ink-faint)',
            }}
          >
            <div
              className="pixel"
              style={{
                fontSize: 14,
                color: 'var(--magenta)',
                marginBottom: 12,
              }}
            >
              NO HAY RESULTADOS
            </div>
            <div>Intenta otra búsqueda o categoría.</div>
          </div>
        )}
      </div>
    </>
  );
}
