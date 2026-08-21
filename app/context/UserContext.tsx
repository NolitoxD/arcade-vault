'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getRank, crossedTiers, type Rank, type SkinTier } from '@/lib/credits';
import { insertScore } from '@/lib/scores';
import type { GameId } from '@/lib/games-registry';

export type UnlockEvent = { tiers: SkinTier[]; rank?: Rank; at: number };

interface UserContextValue {
  user: User | null;
  session: Session | null;
  username: string | null;
  avatarUrl: string | null;
  signOut: () => Promise<void>;
  gamesPlayed: number | null;
  catalogSize: number | null;
  hasPlayed: (gameId: string) => boolean;
  credits: number | null;
  rank: Rank;
  refreshCredits: () => Promise<void>;
  saveScore: (input: {
    gameId: GameId;
    playerName: string;
    score: number;
  }) => Promise<{ error: string | null }>;
  lastUnlock: UnlockEvent | null;
  clearUnlock: () => void;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  session: null,
  username: null,
  avatarUrl: null,
  signOut: async () => {},
  gamesPlayed: null,
  catalogSize: null,
  hasPlayed: () => false,
  credits: null,
  rank: 'INVITADO',
  refreshCredits: async () => {},
  saveScore: async () => ({ error: 'no-session' }),
  lastUnlock: null,
  clearUnlock: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [playedGameIds, setPlayedGameIds] = useState<Set<string>>(new Set());
  const [catalogSize, setCatalogSize] = useState<number | null>(null);
  const [lastUnlock, setLastUnlock] = useState<UnlockEvent | null>(null);
  const playedRef = useRef<Set<string>>(new Set());
  const catalogRef = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => {
        catalogRef.current = count ?? null;
        setCatalogSize(count ?? null);
      });
  }, []);

  const userId = user?.id ?? null;

  const applyPlayed = useCallback((ids: Set<string>) => {
    playedRef.current = ids;
    setPlayedGameIds(ids);
  }, []);

  const fetchPlayed = useCallback(
    async (id: string): Promise<Set<string>> => {
      const supabase = createClient();
      const { data } = await supabase
        .from('scores')
        .select('game_id')
        .eq('user_id', id);
      return new Set((data ?? []).map((row) => row.game_id));
    },
    [],
  );

  useEffect(() => {
    if (!userId) {
      applyPlayed(new Set());
      return;
    }
    let cancelled = false;
    fetchPlayed(userId).then((ids) => {
      if (!cancelled) applyPlayed(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, applyPlayed, fetchPlayed]);

  const refreshCredits = useCallback(async () => {
    if (!userId) return;
    applyPlayed(await fetchPlayed(userId));
  }, [userId, applyPlayed, fetchPlayed]);

  const saveScore = useCallback(
    async (input: { gameId: GameId; playerName: string; score: number }) => {
      if (!userId) return { error: 'no-session' };
      const result = await insertScore(createClient(), { ...input, userId });
      if (result.error) return result;

      const prev = playedRef.current.size;
      const ids = await fetchPlayed(userId);
      applyPlayed(ids);
      const next = ids.size;

      const catalog = catalogRef.current ?? 0;
      const tiers = crossedTiers(prev, next);
      const prevRank = getRank(prev, catalog);
      const nextRank = getRank(next, catalog);
      if (tiers.length > 0 || prevRank !== nextRank) {
        setLastUnlock({
          tiers,
          rank: prevRank !== nextRank ? nextRank : undefined,
          at: Date.now(),
        });
      }
      return result;
    },
    [userId, applyPlayed, fetchPlayed],
  );

  const clearUnlock = useCallback(() => setLastUnlock(null), []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  const username =
    user?.user_metadata?.username ??
    user?.user_metadata?.full_name?.split(' ')[0]?.toUpperCase().slice(0, 10) ??
    user?.email?.split('@')[0]?.toUpperCase().slice(0, 10) ??
    null;

  const avatarUrl: string | null =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;

  const gamesPlayed = user ? playedGameIds.size : null;
  const credits = gamesPlayed;
  const rank = getRank(credits, catalogSize ?? 0);

  function hasPlayed(gameId: string) {
    return playedGameIds.has(gameId);
  }

  return (
    <UserContext.Provider
      value={{
        user,
        session,
        username,
        avatarUrl,
        signOut,
        gamesPlayed,
        catalogSize,
        hasPlayed,
        credits,
        rank,
        refreshCredits,
        saveScore,
        lastUnlock,
        clearUnlock,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
