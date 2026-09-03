'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/app/context/UserContext';
import { useMusic } from '@/app/context/MusicContext';
import MobileGamepad from '@/components/MobileGamepad';
import InstructionsContent from '@/components/InstructionsContent';
import GameOverModal from '@/components/GameOverModal';
import { useGameSkin } from '@/hooks/use-game-skin';
import { getGame, getKeyMap } from '@/lib/games-registry';

const VaultFighterGame = dynamic(
  () => import('@/components/games/VaultFighterGame'),
  { ssr: false },
);

const keyMap = getKeyMap('vault-fighter');

// Four theme tracks recorded for this game; one is picked at random per
// session (never mid-combat) so the play page doesn't loop the same song
// every time like the other 12 games.
const THEME_TRACKS = [
  '/vault-fighter-theme-1.mp3',
  '/vault-fighter-theme-2.mp3',
  '/vault-fighter-theme-3.mp3',
  '/vault-fighter-theme-4.mp3',
];

function getSavedMuted() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('av_sfx_muted') === 'true';
}

// The bout label arrives fully built from the game, which is the only side
// that knows which mode is running. The page just writes it, and no longer
// imports BOUTS from story.ts — a story-mode leak into the page.
//
// Until the first bout reports its own label the marker is a neutral dash:
// the mode and fighter screens now come first, and printing 'COMBATE 01/08'
// there would announce a story run to someone about to pick a tournament.
const IDLE_BOUT_LABEL = '—';

function roundsMarkup(playerRounds: number, cpuRounds: number) {
  return `ASALTOS ${playerRounds}-${cpuRounds}`;
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="4 9 9 9 13 5 13 19 9 15 4 15 4 9" />
      {muted ? (
        <>
          <line x1="17" y1="9" x2="22" y2="14" />
          <line x1="22" y1="9" x2="17" y2="14" />
        </>
      ) : (
        <>
          <path d="M17 8a5 5 0 0 1 0 8" />
          <path d="M19.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

export default function VaultFighterPlay() {
  const { username, saveScore } = useUser();
  const { setTrackOverride } = useMusic();
  const { skinKey, options, change } = useGameSkin('vault-fighter');
  const scoreRef = useRef(0);
  const scoreEl = useRef<HTMLSpanElement>(null);
  const boutEl = useRef<HTMLSpanElement>(null);
  const roundsEl = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [champion, setChampion] = useState(false);
  const [name, setName] = useState('INVITADO');
  const [saved, setSaved] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  // Unlike the rest of the HUD (refs, written directly to the DOM), this one
  // is a real useState: it only flips once or twice per round, not per frame.
  const [magicReady, setMagicReady] = useState(false);

  useEffect(() => {
    setMuted(getSavedMuted());
  }, []);

  useEffect(() => {
    // Math.random() stays inside the client effect, never in the render
    // body — a value picked during render would differ between the server
    // and client passes and break hydration. Picked once per session.
    const track = THEME_TRACKS[Math.floor(Math.random() * THEME_TRACKS.length)];
    setTrackOverride(track);
    return () => setTrackOverride(null);
  }, [setTrackOverride]);

  function toggleMuted() {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem('av_sfx_muted', String(next));
      return next;
    });
  }

  const handleScoreChange = useCallback((s: number) => {
    scoreRef.current = s;
    if (scoreEl.current)
      scoreEl.current.textContent = s.toLocaleString('es-ES');
  }, []);
  const handleBoutChange = useCallback((label: string) => {
    if (boutEl.current) boutEl.current.textContent = label;
  }, []);
  const handleRoundsChange = useCallback(
    (playerRounds: number, cpuRounds: number) => {
      if (roundsEl.current)
        roundsEl.current.textContent = roundsMarkup(playerRounds, cpuRounds);
    },
    [],
  );
  const handleMagicReadyChange = useCallback((ready: boolean) => {
    setMagicReady(ready);
  }, []);
  const handleGameOver = useCallback((finalScore: number) => {
    scoreRef.current = finalScore;
    if (scoreEl.current)
      scoreEl.current.textContent = finalScore.toLocaleString('es-ES');
    setChampion(false);
    setOver(true);
  }, []);
  const handleVictory = useCallback((finalScore: number) => {
    scoreRef.current = finalScore;
    if (scoreEl.current)
      scoreEl.current.textContent = finalScore.toLocaleString('es-ES');
    setChampion(true);
    setOver(true);
  }, []);

  useEffect(() => {
    if (over) {
      if (username) {
        setName(username);
        return;
      }
      const saved = localStorage.getItem('av_player_name');
      if (saved) setName(saved);
    }
  }, [over, username]);

  function restart() {
    scoreRef.current = 0;
    if (scoreEl.current) scoreEl.current.textContent = '0';
    if (boutEl.current) boutEl.current.textContent = IDLE_BOUT_LABEL;
    if (roundsEl.current) roundsEl.current.textContent = roundsMarkup(0, 0);
    setMagicReady(false);
    setPaused(false);
    setOver(false);
    setChampion(false);
    setSaved(false);
    setName(username ?? 'INVITADO');
    setGameKey((k) => k + 1);
  }

  return (
    <div className="av-player fade-in">
      <div className="hidden md:block">
        <div className="player-hud">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div className="hud-stat">
              <div className="l">Jugador</div>
              <div className="v" style={{ color: 'var(--ink)' }}>
                {name}
              </div>
            </div>
            <div className="hud-stat">
              <div className="l">Puntos</div>
              <div className="v">
                <span ref={scoreEl}>0</span>
              </div>
            </div>
            <div className="hud-stat lives">
              <div className="l">Combate</div>
              <div className="v">
                <span ref={boutEl}>{IDLE_BOUT_LABEL}</span>
              </div>
            </div>
            <div className="hud-stat level">
              <div className="l">Asaltos</div>
              <div className="v">
                <span ref={roundsEl}>{roundsMarkup(0, 0)}</span>
              </div>
            </div>
            <div className="hud-stat">
              <div className="l">Skin</div>
              <div className="v">
                <select
                  value={skinKey}
                  onChange={(e) => change(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--ink-dim)',
                    color: 'var(--ink)',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  {options.map((s) => (
                    <option key={s.key} value={s.key} disabled={s.locked}>
                      {s.locked ? s.lockedLabel : s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="hud-actions">
            <button
              className="btn ghost"
              onClick={toggleMuted}
              aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
              aria-pressed={muted}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <SpeakerIcon muted={muted} />
            </button>
            <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
              {paused ? 'REANUDAR' : 'PAUSA'}
            </button>
            <button
              className="btn cyan"
              aria-label="Instrucciones"
              onClick={() => setHelpOpen(true)}
            >
              ?
            </button>
            <button className="btn magenta" onClick={() => setOver(true)}>
              FIN
            </button>
            <Link href="/games/vault-fighter" className="btn ghost">
              SALIR
            </Link>
          </div>
        </div>
      </div>

      <div className="crt w-full max-w-[640px] mx-auto">
        <div
          className="crt-screen crt-screen--scale-canvas"
          style={{ aspectRatio: '8 / 5' }}
        >
          <VaultFighterGame
            key={gameKey}
            paused={paused || over || helpOpen}
            muted={muted}
            skinKey={skinKey}
            onScoreChange={handleScoreChange}
            onBoutChange={handleBoutChange}
            onRoundsChange={handleRoundsChange}
            onMagicReadyChange={handleMagicReadyChange}
            onGameOver={handleGameOver}
            onVictory={handleVictory}
          />
          {paused && (
            <div
              className="crt-content"
              style={{ background: 'rgba(0,0,0,0.6)', zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-dim)',
                    marginTop: 10,
                    letterSpacing: '0.16em',
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>VAULT FIGHTER · CRT-80 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      <MobileGamepad
        keyMap={keyMap}
        paused={paused || over}
        cLit={magicReady}
        onPauseToggle={() => setPaused((p) => !p)}
        skin={skinKey}
        onSkinChange={change}
        skinOptions={options}
        onHelp={() => setHelpOpen(true)}
        backHref="/games/vault-fighter"
      />

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
              gameId: 'vault-fighter',
              playerName: name,
              score: scoreRef.current,
            });
          }}
          onRestart={restart}
          leaderboardHref="/games/vault-fighter#leaderboard"
        />
      )}
      {helpOpen && (
        <div
          className="modal-bd"
          role="dialog"
          aria-modal="true"
          aria-label="Instrucciones"
        >
          <div
            className="modal"
            style={{ textAlign: 'left', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <InstructionsContent
              game={getGame('vault-fighter')!}
              title="VAULT FIGHTER"
            />
            <div className="actions">
              <button className="btn cyan" onClick={() => setHelpOpen(false)}>
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
