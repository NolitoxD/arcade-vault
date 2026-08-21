import InstructionsContent from '@/components/InstructionsContent';
import { getGame } from '@/lib/games-registry';
import { createClient } from '@/lib/supabase/server';
import InstructionsModal from './InstructionsModal';

export default async function InterceptedInstructions({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('games')
    .select('title')
    .eq('id', id)
    .maybeSingle();
  const title = (data?.title as string | undefined) ?? id.toUpperCase();

  return (
    <InstructionsModal>
      <InstructionsContent game={game} title={title} />
    </InstructionsModal>
  );
}
