'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameRow } from '@/lib/supabase/types';
import { useUser } from '@/app/context/UserContext';
import { isDesktopOnlyBlocked } from './desktop-only';

function GameCard({ game, desktopOnlyBlocked }: { game: GameRow; desktopOnlyBlocked: boolean }) {
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

  const coverContent = (
    <>
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
    </>
  );

  return (
    <div ref={ref} className="card" onMouseMove={onMove} onMouseLeave={onLeave}>
      {desktopOnlyBlocked ? (
        // G10 fix wave (#3): same look, no navigation target — the cover offers
        // no path into the play page below the viewport threshold either.
        <div className="cover">{coverContent}</div>
      ) : (
        <Link href={`/games/${game.id}`} className="cover">
          {coverContent}
        </Link>
      )}
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          {desktopOnlyBlocked ? (
            // G10-5: no Link — nothing to navigate to. aria-disabled, not the
            // `disabled` attribute (this is a <span>, not a <button>).
            <span
              className="btn ghost"
              aria-disabled="true"
              title="Este juego solo se puede jugar en pantalla de escritorio"
              style={{ cursor: 'not-allowed', opacity: 0.6 }}
            >
              SOLO ESCRITORIO
            </span>
          ) : (
            <Link
              href={`/games/${game.id}`}
              className={`btn ${btnColor}`}
              onClick={(e) => e.stopPropagation()}
            >
              JUGAR
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GamesGrid({ games }: { games: GameRow[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  // null until mount: server render (and client's first paint) don't know
  // window size, so JUGAR always starts enabled and only a real resize
  // measurement can disable it — no hydration mismatch, at most a frame flicker
  // for those truly below the threshold.
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    function update() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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
          <GameCard
            key={g.id}
            game={g}
            desktopOnlyBlocked={viewport !== null && isDesktopOnlyBlocked(g.id, viewport.w, viewport.h)}
          />
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
