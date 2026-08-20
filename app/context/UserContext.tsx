'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface UserContextValue {
  user: User | null;
  session: Session | null;
  username: string | null;
  avatarUrl: string | null;
  signOut: () => Promise<void>;
  gamesPlayed: number | null;
  catalogSize: number | null;
  hasPlayed: (gameId: string) => boolean;
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
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [playedGameIds, setPlayedGameIds] = useState<Set<string>>(new Set());
  const [catalogSize, setCatalogSize] = useState<number | null>(null);

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
      .then(({ count }) => setCatalogSize(count ?? null));
  }, []);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setPlayedGameIds(new Set());
      return;
    }
    const supabase = createClient();
    supabase
      .from('scores')
      .select('game_id')
      .eq('user_id', userId)
      .then(({ data }) => {
        setPlayedGameIds(new Set((data ?? []).map((row) => row.game_id)));
      });
  }, [userId]);

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
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
