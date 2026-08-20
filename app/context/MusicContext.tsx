'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const MUTED_STORAGE_KEY = 'av_music_muted';
const PLAY_PAGE_PATTERN = /^\/games\/[^/]+\/play$/;
const TRACK_SRC = '/arcade-theme.m4a';

interface MusicContextValue {
  muted: boolean;
  toggleMuted: () => void;
}

const MusicContext = createContext<MusicContextValue>({
  muted: false,
  toggleMuted: () => {},
});

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [muted, setMuted] = useState(false);
  const [gestureDone, setGestureDone] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(MUTED_STORAGE_KEY);
    if (stored !== null) setMuted(stored === 'true');
  }, []);

  useEffect(() => {
    if (gestureDone) return;

    function onGesture() {
      setGestureDone(true);
    }

    document.addEventListener('keydown', onGesture, { once: true });
    document.addEventListener('pointerdown', onGesture, { once: true });
    return () => {
      document.removeEventListener('keydown', onGesture);
      document.removeEventListener('pointerdown', onGesture);
    };
  }, [gestureDone]);

  useEffect(() => {
    const isPlayPage = PLAY_PAGE_PATTERN.test(pathname);
    if (!isPlayPage || muted || !gestureDone) {
      audioRef.current?.pause();
      return;
    }

    if (!audioRef.current) {
      const audio = new Audio(TRACK_SRC);
      audio.loop = true;
      audio.volume = 0.35;
      audio.preload = 'none';
      audioRef.current = audio;
    }
    audioRef.current.play().catch(() => {});

    return () => {
      audioRef.current?.pause();
    };
  }, [pathname, muted, gestureDone]);

  useEffect(() => {
    localStorage.setItem(MUTED_STORAGE_KEY, String(muted));
  }, [muted]);

  function toggleMuted() {
    setMuted((prev) => !prev);
  }

  return (
    <MusicContext.Provider value={{ muted, toggleMuted }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  return useContext(MusicContext);
}
