import Link from 'next/link';
import { notFound } from 'next/navigation';
import InstructionsContent from '@/components/InstructionsContent';
import { getGame } from '@/lib/games-registry';
import { createClient } from '@/lib/supabase/server';

export default async function InstructionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from('games')
    .select('title')
    .eq('id', id)
    .maybeSingle();
  const title = (data?.title as string | undefined) ?? id.toUpperCase();

  return (
    <div className="av-detail fade-in" style={{ gridTemplateColumns: '1fr' }}>
      <div className="leaderboard" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h3>INSTRUCCIONES</h3>
        <div style={{ padding: '20px 24px' }}>
          <InstructionsContent game={game} title={title} />
          <div className="detail-actions">
            <Link href={`/games/${id}/play`} className="btn lg pulse">
              ▶ JUGAR
            </Link>
            <Link href={`/games/${id}`} className="btn ghost lg">
              VOLVER
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
