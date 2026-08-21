import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameId } from './games-registry';

export async function insertScore(
  client: SupabaseClient,
  input: { gameId: GameId; playerName: string; score: number; userId: string | null },
): Promise<{ error: string | null }> {
  const { error } = await client.from('scores').insert({
    game_id: input.gameId,
    player_name: input.playerName,
    score: input.score,
    user_id: input.userId,
  });
  return { error: error?.message ?? null };
}
