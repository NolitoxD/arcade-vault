'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/app/context/UserContext';
import { useMusic } from '@/app/context/MusicContext';
import GameOverModal from '@/components/GameOverModal';

// The definitive play page (step 10): catalogue entry, migration, music by phase,
// GameOverModal + saveScore, and the viewport-blocked redirect all land here and
// replace the step-9 provisional file. It lives at the same URL on purpose.
const VaultWorldCupGame = dynamic(() => import('@/components/games/VaultWorldCupGame'), { ssr: false });

const IDLE_SCORE = '0 - 0';
const IDLE_CLOCK = '0:00';
const DETAIL_HREF = '/games/vault-world-cup';

// G10-4: the two file tracks of the spec's audio table. Picked by onPhaseChange
// ('menu' | 'match') and by `paused` -- never by anything read off the canvas.
const TRACK_LOBBY = '/vault-futbol-theme-pre-game-lobby.mp3';
const TRACK_GAMEPLAY = '/vault-futbol-theme-game-play.mp3';

// G10-5: how long the blocked panel (drawn by the canvas itself) stays up before the
// redirect to the detail page -- same idea as CreditsToast's DISMISS_MS.
const VIEWPORT_BLOCKED_REDIRECT_MS = 2000;

// G10 fix wave (#4): how long the World Cup victory celebration (fireworks + chants,
// drawn and played entirely inside the canvas) gets to run before GameOverModal
// covers it. See the controller ruling on handleVictory below for why this diverges
// from the Vault Fighter pattern.
const VICTORY_MODAL_DELAY_MS = 4000;

function isTypingTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  return target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
}

function parseSeed(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function getSavedMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('av_sfx_muted') === 'true';
}

function VaultWorldCupPlayInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const seed = parseSeed(searchParams.get('seed'));
  const { username, saveScore } = useUser();
  const { setTrackOverride } = useMusic();

  const scoreRef = useRef(0);
  const victoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<'menu' | 'match'>('menu');
  const [status, setStatus] = useState('SELECTOR');
  const [score, setScore] = useState(IDLE_SCORE);
  const [clock, setClock] = useState(IDLE_CLOCK);
  const [gameKey, setGameKey] = useState(0);

  const [over, setOver] = useState(false);
  const [champion, setChampion] = useState(false);
  const [name, setName] = useState('INVITADO');
  const [saved, setSaved] = useState(false);

  const [viewportBlocked, setViewportBlocked] = useState(false);

  useEffect(() => {
    setMuted(getSavedMuted());
  }, []);

  // G10-4: the lobby track covers every menu screen AND the pause (spec L464); the
  // gameplay track only while a match is actually running.
  //
  // preflight 14-sep: this is intentionally TWO effects, not one. A single effect
  // with `[phase, paused, setTrackOverride]` as deps and `return () =>
  // setTrackOverride(null)` as cleanup would run that cleanup on EVERY phase/pause
  // change too (React tears down and rebuilds an effect whenever any of its deps
  // change, not only on unmount) -- so every lobby<->gameplay transition would
  // detour through `setTrackOverride(null)` (MusicContext's default arcade-theme.mp3)
  // before landing on the right track, reassigning `audio.src` twice per transition
  // for no reason. Splitting the set from the cleanup keeps the edge cheap (it is
  // already deduped inside setTrackOverride's own `if (trackOverrideRef.current ===
  // src) return;`) and restores the context's default track ONLY on unmount, exactly
  // like Vault Fighter's own effect (`app/games/vault-fighter/play/page.tsx:101-108`,
  // deps `[setTrackOverride]` only).
  useEffect(() => {
    setTrackOverride(phase === 'match' && !paused ? TRACK_GAMEPLAY : TRACK_LOBBY);
  }, [phase, paused, setTrackOverride]);

  useEffect(() => {
    return () => setTrackOverride(null);
  }, [setTrackOverride]);

  // G10 fix wave (#4): clear a pending victory-modal timer if the page unmounts
  // mid-celebration (navigating away before VICTORY_MODAL_DELAY_MS elapses).
  useEffect(() => {
    return () => {
      if (victoryTimerRef.current !== null) clearTimeout(victoryTimerRef.current);
    };
  }, []);

  // G10-5: 2 s after the guard trips, same pattern as CreditsToast's DISMISS_MS -- a
  // timer inside an effect, cleared if the run restarts (or the page unmounts) first.
  useEffect(() => {
    if (!viewportBlocked) return;
    const timer = setTimeout(() => {
      router.push(DETAIL_HREF);
    }, VIEWPORT_BLOCKED_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [viewportBlocked, router]);

  function toggleMuted() {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem('av_sfx_muted', String(next));
      return next;
    });
  }

  const handleScoreChange = useCallback((home: number, away: number) => {
    setScore(`${home} - ${away}`);
  }, []);
  const handleClockChange = useCallback((label: string) => {
    setClock(label);
  }, []);
  // G10 fix wave (#9): the component can return to the mode selector on its own
  // (a friendly/training run ending without a page-level restart), leaving the
  // HUD's marcador/reloj stuck on the last match's values -- clear them on that edge.
  const handleStatusChange = useCallback((label: string) => {
    setStatus(label);
    if (label === 'SELECTOR') {
      setScore(IDLE_SCORE);
      setClock(IDLE_CLOCK);
      // G10 fix wave (#4): if a pending victory timer was running when CONTINUAR
      // was pressed, clear it and show the modal immediately so the World Cup score
      // is still offered for saving (no silent cancellation of the celebration).
      if (victoryTimerRef.current !== null) {
        clearTimeout(victoryTimerRef.current);
        victoryTimerRef.current = null;
        setChampion(true);
        setOver(true);
      }
    }
  }, []);
  const handlePhaseChange = useCallback((next: 'menu' | 'match') => {
    setPhase(next);
  }, []);
  // Criterion 19 / G10-6: only the World Cup ever calls these two -- a friendly or a
  // training run resolves entirely inside the canvas (GANADOR / EMPATE / ELIMINADO as
  // a caption over the pitch), never with a modal from the page.
  const handleGameOver = useCallback((points: number) => {
    scoreRef.current = points;
    setChampion(false);
    setOver(true);
  }, []);
  // G10 fix wave (#4, controller ruling): unlike Vault Fighter, which pauses the
  // component the instant `over` flips and shows GameOverModal right away, the
  // World Cup's victory screen has its own on-canvas celebration (fireworks +
  // chants) and its own CONTINUAR control (A/J, handled inside
  // VaultWorldCupGame's own input loop -- see `continueFromVictory`). Freezing the
  // component here (`paused={paused || over}`, the Vault Fighter pattern) would
  // silence that celebration under the modal backdrop and make CONTINUAR
  // unreachable, since its keydown handler lives inside the now-paused game loop.
  // So the component keeps running (`paused={paused}` below) and the modal is
  // raised only after VICTORY_MODAL_DELAY_MS, leaving the fireworks and CONTINUAR
  // visible and usable in the meantime. The score is still captured synchronously,
  // before the delay, exactly like handleGameOver.
  const handleVictory = useCallback((points: number) => {
    scoreRef.current = points;
    if (victoryTimerRef.current !== null) clearTimeout(victoryTimerRef.current);
    victoryTimerRef.current = setTimeout(() => {
      victoryTimerRef.current = null;
      setChampion(true);
      setOver(true);
    }, VICTORY_MODAL_DELAY_MS);
  }, []);
  const handleViewportBlocked = useCallback(() => {
    setViewportBlocked(true);
  }, []);

  useEffect(() => {
    if (over) {
      if (username) {
        setName(username);
        return;
      }
      const savedName = localStorage.getItem('av_player_name');
      if (savedName) setName(savedName);
    }
  }, [over, username]);

  // Restart by remount (the repo's mechanism): lands back on the mode selector.
  const restart = useCallback(() => {
    if (victoryTimerRef.current !== null) {
      clearTimeout(victoryTimerRef.current);
      victoryTimerRef.current = null;
    }
    scoreRef.current = 0;
    setScore(IDLE_SCORE);
    setClock(IDLE_CLOCK);
    setStatus('SELECTOR');
    setPaused(false);
    setOver(false);
    setChampion(false);
    setSaved(false);
    setViewportBlocked(false);
    setName(username ?? 'INVITADO');
    setGameKey((k) => k + 1);
  }, [username]);

  // P pauses, R restarts -- only once a World Cup has reported its end (a stray R
  // mid-match must not wipe a run; inside a training match R is the game's own exit,
  // handled entirely by the component's own keydown handler, never by the page).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.repeat || isTypingTarget(e)) return;
      const key = e.key.toLowerCase();
      if (key === 'p') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (key === 'r' && over) {
        e.preventDefault();
        restart();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [over, restart]);

  return (
    <div className="av-player fade-in">
      <div className="hidden md:block">
        <div className="player-hud">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div className="hud-stat">
              <div className="l">Marcador</div>
              <div className="v">{score}</div>
            </div>
            <div className="hud-stat level">
              <div className="l">Reloj</div>
              <div className="v">{clock}</div>
            </div>
            <div className="hud-stat lives">
              <div className="l">Estado</div>
              <div className="v">{paused ? 'EN PAUSA' : status}</div>
            </div>
          </div>
          <div className="hud-actions">
            <button className="btn ghost" onClick={toggleMuted}>
              {muted ? 'SONIDO OFF' : 'SONIDO ON'}
            </button>
            <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
              {paused ? 'REANUDAR' : 'PAUSA'}
            </button>
            <button className="btn cyan" onClick={restart}>
              AL SELECTOR
            </button>
            <Link className="btn ghost" href={DETAIL_HREF}>
              SALIR
            </Link>
          </div>
        </div>
      </div>

      <div className="crt w-full max-w-[840px] mx-auto">
        <div className="crt-screen crt-screen--scale-canvas" style={{ aspectRatio: '8 / 5' }}>
          <VaultWorldCupGame
            key={gameKey}
            paused={paused}
            muted={muted}
            seed={seed}
            onScoreChange={handleScoreChange}
            onClockChange={handleClockChange}
            onStatusChange={handleStatusChange}
            onPhaseChange={handlePhaseChange}
            onGameOver={handleGameOver}
            onVictory={handleVictory}
            onViewportBlocked={handleViewportBlocked}
          />
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>VAULT WORLD CUP · CRT-80 · 60 HZ</span>
          <span>9 VS 9</span>
        </div>
      </div>

      {over && (
        <GameOverModal
          variant={champion ? 'victory' : 'defeat'}
          score={scoreRef.current}
          name={name}
          onNameChange={setName}
          saved={saved}
          onSave={async () => {
            setSaved(true);
            localStorage.setItem('av_player_name', name);
            await saveScore({
              gameId: 'vault-world-cup',
              playerName: name,
              score: scoreRef.current,
            });
          }}
          onRestart={restart}
          leaderboardHref={`${DETAIL_HREF}#leaderboard`}
        />
      )}
    </div>
  );
}

export default function VaultWorldCupPlay() {
  return (
    <Suspense>
      <VaultWorldCupPlayInner />
    </Suspense>
  );
}
