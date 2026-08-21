'use client';

import { useEffect } from 'react';
import { useUser } from '@/app/context/UserContext';
import RankBadge from './RankBadge';

const DISMISS_MS = 4000;

export default function CreditsToast() {
  const { lastUnlock, clearUnlock } = useUser();
  const at = lastUnlock?.at ?? null;

  useEffect(() => {
    if (at === null) return;
    const timer = setTimeout(clearUnlock, DISMISS_MS);
    return () => clearTimeout(timer);
  }, [at, clearUnlock]);

  if (!lastUnlock) return null;

  const tiersLabel = lastUnlock.tiers.map((tier) => tier.toUpperCase()).join(' · ');

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={clearUnlock}
      className="pixel"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 18px',
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--bg-2)',
        border: '1px solid var(--cyan)',
        boxShadow:
          '0 0 14px rgba(0,245,255,0.55), inset 0 0 8px rgba(0,245,255,0.25)',
        color: 'var(--ink)',
        fontSize: 9,
        cursor: 'pointer',
      }}
    >
      {lastUnlock.rank && <RankBadge rank={lastUnlock.rank} size={32} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tiersLabel && (
          <span className="neon-cyan">NUEVO SKIN DESBLOQUEADO · {tiersLabel}</span>
        )}
        {lastUnlock.rank && (
          <span className="neon-magenta">NUEVO RANGO · {lastUnlock.rank}</span>
        )}
      </div>
    </div>
  );
}
