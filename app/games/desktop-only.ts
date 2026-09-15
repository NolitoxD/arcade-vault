import { isGameId, type GameId } from '../../lib/games-registry';
import { viewportAllowed } from '../../components/games/football-screen/viewport-guard';

// G10-5: the only game the catalog blocks by viewport in v1. A literal set,
// not a GameMeta field or a `games` table column: a single game does not
// justify new schema (spec, §6.8 of the design brief).
const DESKTOP_ONLY_GAMES: ReadonlySet<GameId> = new Set<GameId>(['vault-world-cup']);

export function isDesktopOnlyBlocked(gameId: string, width: number, height: number): boolean {
  if (!isGameId(gameId) || !DESKTOP_ONLY_GAMES.has(gameId)) return false;
  return !viewportAllowed(width, height);
}
