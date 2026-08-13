import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { GameRow, ScoreRow } from '@/lib/supabase/types';
import LiveLeaderboard from './LiveLeaderboard';

export default async function GameDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: game }, { data: scores }] = await Promise.all([
    supabase.from('games').select('*').eq('id', id).single(),
    supabase
      .from('scores')
      .select('*')
      .eq('game_id', id)
      .order('score', { ascending: false })
      .limit(10),
  ]);

  if (!game) notFound();

  const typedGame = game as GameRow;
  const typedScores = (scores ?? []) as ScoreRow[];
  const best = typedScores[0]?.score ?? 0;

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={`cover-bg ${typedGame.cover}`} />
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{typedGame.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{typedGame.title}</h2>
          <p>{typedGame.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">
                {typedScores.length > 0 ? typedScores.length : '-'}
              </div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{
                  color: 'var(--magenta)',
                  textShadow: '0 0 6px rgba(255,0,110,0.5)',
                }}
              >
                {best > 0 ? best.toLocaleString('es-ES') : '-'}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{
                  color: 'var(--yellow)',
                  textShadow: '0 0 6px rgba(245,255,0,0.5)',
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/games/${id}/play`} className="btn xl pulse">
              ▶ JUGAR AHORA
            </Link>
            <Link href="/games" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <LiveLeaderboard gameId={id} initialScores={typedScores} />
    </div>
  );
}
