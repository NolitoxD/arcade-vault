'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useUser } from '@/app/context/UserContext';
import { useMusic } from '@/app/context/MusicContext';

function getRank(played: number | null, total: number | null): string {
  if (played === null) return 'INVITADO';
  if (played === 0) return 'INVITADO';
  if (total !== null && total > 0 && played >= total) return 'MAESTRO DEL VAULT';
  if (played >= 6) return 'VETERANO';
  if (played >= 3) return 'JUGADOR';
  return 'NOVATO';
}

function getStars(played: number | null, total: number | null): string {
  let filled = 0;
  if (played !== null) {
    if (total !== null && total > 0 && played >= total) filled = 3;
    else if (played >= 6) filled = 2;
    else if (played >= 3) filled = 1;
  }
  return '★'.repeat(filled) + '☆'.repeat(3 - filled);
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { username, avatarUrl, signOut, user, gamesPlayed, catalogSize } =
    useUser();
  const { muted, toggleMuted } = useMusic();

  const rank = getRank(gamesPlayed, catalogSize);
  const stars = getStars(gamesPlayed, catalogSize);
  const creditsLabel =
    gamesPlayed === null
      ? 'CRÉDITOS · --'
      : `CRÉDITOS · ${String(gamesPlayed).padStart(2, '0')} / ${
          catalogSize !== null ? String(catalogSize).padStart(2, '0') : '--'
        }`;

  const isLibrary = pathname.startsWith('/games');
  const isHall = pathname === '/hall-of-fame';
  const isAbout = pathname === '/about';
  const isPlayPage = pathname.endsWith('/play');

  function close() {
    setOpen(false);
  }

  async function handleSignOut() {
    await signOut();
    close();
  }

  const initial = username ? username[0].toUpperCase() : null;

  return (
    <>
      <nav className={`av-nav${isPlayPage ? ' nav-hide-mobile' : ''}`}>
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>

        <div className="links">
          <Link href="/games" className={isLibrary ? 'active' : ''}>
            Biblioteca
          </Link>
          <Link href="/hall-of-fame" className={isHall ? 'active' : ''}>
            Salón de la Fama
          </Link>
          <Link href="/about" className={isAbout ? 'active' : ''}>
            Sobre Nosotros
          </Link>
        </div>

        <div className="spacer" />

        {user ? (
          <div className="coin-counter">
            <span className="coin" />
            <span>{creditsLabel}</span>
            <span className="rank">{rank}</span>
            <span className="stars">{stars}</span>
          </div>
        ) : (
          <Link href="/auth" className="coin-counter">
            <span className="coin" />
            <span>{creditsLabel}</span>
            <span className="rank">{rank}</span>
          </Link>
        )}

        {username ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '2px solid var(--neon-cyan)',
                boxShadow: '0 0 8px var(--neon-cyan)',
                flexShrink: 0,
                background: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={username}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--neon-cyan)',
                    lineHeight: 1,
                  }}
                >
                  {initial}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                color: 'var(--ink)',
              }}
            >
              {username}
            </span>
            <button className="btn ghost auth-btn" onClick={handleSignOut}>
              CERRAR SESIÓN
            </button>
          </div>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            ACCESO
          </Link>
        )}

        <button
          type="button"
          className="btn ghost music-toggle"
          onClick={toggleMuted}
          aria-label={muted ? 'Activar música' : 'Silenciar música'}
          aria-pressed={muted}
        >
          {muted ? '♪̸' : '♪'}
        </button>

        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      {isPlayPage && (
        <button
          type="button"
          className="btn ghost music-toggle music-toggle--floating"
          onClick={toggleMuted}
          aria-label={muted ? 'Activar música' : 'Silenciar música'}
          aria-pressed={muted}
        >
          {muted ? '♪̸' : '♪'}
        </button>
      )}

      <div
        className={`av-mobile-backdrop${open ? ' open' : ''}${isPlayPage ? ' nav-hide-mobile' : ''}`}
        onClick={close}
      />
      <aside
        className={`av-mobile-panel${open ? ' open' : ''}${isPlayPage ? ' nav-hide-mobile' : ''}`}
      >
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link
          href="/games"
          className={isLibrary ? 'active' : ''}
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link
          href="/hall-of-fame"
          className={isHall ? 'active' : ''}
          onClick={close}
        >
          Salón de la Fama
        </Link>
        <Link href="/about" className={isAbout ? 'active' : ''} onClick={close}>
          Sobre Nosotros
        </Link>
        {username ? (
          <button
            className="btn ghost"
            style={{ textAlign: 'left', padding: 0, marginTop: 8 }}
            onClick={handleSignOut}
          >
            CERRAR SESIÓN ({username})
          </button>
        ) : (
          <Link
            href="/auth"
            className={pathname === '/auth' ? 'active' : ''}
            onClick={close}
          >
            ACCESO
          </Link>
        )}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn ghost music-toggle"
          onClick={toggleMuted}
          aria-label={muted ? 'Activar música' : 'Silenciar música'}
          aria-pressed={muted}
        >
          {muted ? '♪̸' : '♪'} MÚSICA
        </button>
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: 'var(--ink-faint)',
            letterSpacing: '0.16em',
          }}
        >
          {creditsLabel} · {rank}
        </div>
        {user && (
          <div style={{ fontSize: 13, color: 'var(--yellow)', letterSpacing: 3 }}>
            {stars}
          </div>
        )}
      </aside>
    </>
  );
}
