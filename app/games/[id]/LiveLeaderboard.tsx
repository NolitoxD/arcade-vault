'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ScoreRow } from '@/lib/supabase/types';

const REALTIME_GAMES = ['pong', 'road-fighter'];
const TOP_LIMIT = 10;

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function LiveLeaderboard({
  gameId,
  initialScores,
}: {
  gameId: string;
  initialScores: ScoreRow[];
}) {
  const [scores, setScores] = useState(initialScores);

  useEffect(() => {
    if (!REALTIME_GAMES.includes(gameId)) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`scores-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scores',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const row = payload.new as ScoreRow;
          setScores((prev) =>
            [...prev, row]
              .sort((a, b) => b.score - a.score)
              .slice(0, TOP_LIMIT),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  return (
    <aside>
      <div className="leaderboard">
        <h3>MEJORES PUNTUACIONES</h3>
        {scores.length === 0 ? (
          <div
            style={{
              padding: '40px 0',
              textAlign: 'center',
              color: 'var(--ink-faint)',
            }}
          >
            <div
              className="pixel"
              style={{ fontSize: 12, color: 'var(--cyan)', marginBottom: 8 }}
            >
              SIN REGISTROS
            </div>
            <div style={{ fontSize: 13 }}>
              Sé el primero en entrar al salón de la fama
            </div>
          </div>
        ) : (
          scores.map((r, i) => (
            <div
              key={r.id}
              className={`lb-row${i === 0 ? ' top1' : i === 1 ? ' top2' : i === 2 ? ' top3' : ''}`}
            >
              <div className="rk">#{String(i + 1).padStart(2, '0')}</div>
              <div className="pl">
                {r.player_name}
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--ink-faint)',
                    letterSpacing: '0.1em',
                  }}
                >
                  {formatDate(r.created_at)}
                </div>
              </div>
              <div className="sc">{r.score.toLocaleString('es-ES')}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
