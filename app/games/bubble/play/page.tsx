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

const BubbleGame = dynamic(() => import('@/components/games/BubbleGame'), {
  ssr: false,
});

const keyMap = getKeyMap('bubble');
const MAX_LIVES = 3;

function getSavedMuted() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('av_sfx_muted') === 'true';
}

// Internally-generated markup only (no user input reaches this string), same
// pattern as the hearts HUD in space-invaders/karate-champ/kong play pages.
function heartsMarkup(lives: number) {
  let html = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    html += `<span style="color:${i < lives ? 'var(--magenta)' : 'var(--ink-dim)'}">♥</span>`;
  }
  return html;
}

const FULL_HEARTS = heartsMarkup(MAX_LIVES);

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

export default function BubblePlay() {
  const { username, saveScore } = useUser();
  const { setTrackOverride } = useMusic();
  const { skinKey, options, change } = useGameSkin('bubble');
  const scoreRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const mapRef = useRef(1);
  const scoreEl = useRef<HTMLSpanElement>(null);
  const livesEl = useRef<HTMLSpanElement>(null);
  const mapEl = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const [name, setName] = useState('INVITADO');
  const [saved, setSaved] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(getSavedMuted());
  }, []);

  useEffect(() => {
    setTrackOverride('/bubble-theme.mp3');
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
  const handleLevelChange = useCallback((map: number) => {
    mapRef.current = map;
    if (mapEl.current) mapEl.current.textContent = String(map).padStart(2, '0');
  }, []);
  const handleLivesChange = useCallback((l: number) => {
    livesRef.current = l;
    if (livesEl.current) {
      livesEl.current.innerHTML = heartsMarkup(l);
    }
  }, []);
  const handleGameOver = useCallback((finalScore: number) => {
    scoreRef.current = finalScore;
    if (scoreEl.current)
      scoreEl.current.textContent = finalScore.toLocaleString('es-ES');
    setOver(true);
  }, []);
  const handleVictory = useCallback((finalScore: number) => {
    scoreRef.current = finalScore;
    if (scoreEl.current)
      scoreEl.current.textContent = finalScore.toLocaleString('es-ES');
    setVictory(true);
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
    livesRef.current = MAX_LIVES;
    mapRef.current = 1;
    if (scoreEl.current) scoreEl.current.textContent = '0';
    if (livesEl.current) livesEl.current.innerHTML = FULL_HEARTS;
    if (mapEl.current) mapEl.current.textContent = '01';
    setPaused(false);
    setOver(false);
    setVictory(false);
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
              <div className="l">Vidas</div>
              <div className="v">
                <span
                  ref={livesEl}
                  dangerouslySetInnerHTML={{ __html: FULL_HEARTS }}
                />
              </div>
            </div>
            <div className="hud-stat level">
              <div className="l">Mapa</div>
              <div className="v">
                <span ref={mapEl}>01</span>
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
            <Link href="/games/bubble" className="btn ghost">
              SALIR
            </Link>
          </div>
        </div>
      </div>

      <div className="crt w-full max-w-[520px] mx-auto">
        <div
          className="crt-screen crt-screen--scale-canvas"
          style={{ aspectRatio: '6 / 7' }}
        >
          <BubbleGame
            key={gameKey}
            paused={paused || over || helpOpen}
            muted={muted}
            skinKey={skinKey}
            onScoreChange={handleScoreChange}
            onLevelChange={handleLevelChange}
            onLivesChange={handleLivesChange}
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
          <span>BUBBLE · CRT-80 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      <MobileGamepad
        keyMap={keyMap}
        paused={paused || over}
        onPauseToggle={() => setPaused((p) => !p)}
        skin={skinKey}
        onSkinChange={change}
        skinOptions={options}
        onHelp={() => setHelpOpen(true)}
        backHref="/games/bubble"
      />

      {over && (
        <GameOverModal
          variant={victory ? 'victory' : 'defeat'}
          score={scoreRef.current}
          name={name}
          onNameChange={setName}
          saved={saved}
          onSave={async () => {
            setSaved(true);
            localStorage.setItem('av_player_name', name);
            await saveScore({
              gameId: 'bubble',
              playerName: name,
              score: scoreRef.current,
            });
          }}
          onRestart={restart}
          leaderboardHref="/games/bubble#leaderboard"
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
            <InstructionsContent game={getGame('bubble')!} title="BUBBLE" />
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
