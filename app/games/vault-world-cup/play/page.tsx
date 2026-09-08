'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

// PROVISIONAL (stage C, step 8). The definitive play page is step 10: catalogue
// entry, migration, music, score and the mobile gamepad all land there and rewrite
// this file. It lives at the final URL on purpose, so Paco's QA does not move.
const VaultWorldCupGame = dynamic(() => import('@/components/games/VaultWorldCupGame'), { ssr: false });

// S-SC12 (confirmed by owner 2026-09-07): EMPATE here matches the on-canvas caption
// for the same event (collectCaptions pushes 'draw' when winnerOf is -1) -- the two
// must read the same or the QA session sees the page and the canvas disagree.
const WINNER_TEXT = ['HAS GANADO', 'HAS PERDIDO', 'EMPATE'];
const IDLE_SCORE = '0 - 0';

export default function VaultWorldCupPlay() {
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState('');
  const [gameKey, setGameKey] = useState(0);
  const [score, setScore] = useState(IDLE_SCORE);
  const [clock, setClock] = useState('0:00');

  const handleScoreChange = useCallback((home: number, away: number) => {
    setScore(`${home} - ${away}`);
  }, []);

  const handleClockChange = useCallback((label: string) => {
    setClock(label);
  }, []);

  const handleMatchEnd = useCallback((winner: 0 | 1 | -1) => {
    setResult(WINNER_TEXT[winner === 0 ? 0 : winner === 1 ? 1 : 2]);
  }, []);

  // Restart by remount, the repo's mechanism (vault-fighter's play page): the
  // component has no reset API and does not need one.
  const restart = useCallback(() => {
    setResult('');
    setScore(IDLE_SCORE);
    setClock('0:00');
    setPaused(false);
    setGameKey((k) => k + 1);
  }, []);

  // S-SC1 / S-SC12 (confirmed by owner 2026-09-07): P toggles pause and R restarts,
  // both by the SAME mechanism as their buttons -- this page owns `paused`, so the
  // shortcut lives here and not inside VaultWorldCupGame.tsx's own keydown handler.
  // R only fires once the match has actually ended: a stray R mid-match must not
  // wipe the score, and `result` is what `restart()` itself resets to ''.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === 'p') setPaused((p) => !p);
      else if (key === 'r' && result !== '') restart();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [result, restart]);

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
              <div className="v">{result === '' ? (paused ? 'EN PAUSA' : 'EN JUEGO') : result}</div>
            </div>
          </div>
          <div className="hud-actions">
            <button className="btn ghost" onClick={() => setMuted((m) => !m)}>
              {muted ? 'SONIDO OFF' : 'SONIDO ON'}
            </button>
            <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
              {paused ? 'REANUDAR' : 'PAUSA'}
            </button>
            <button className="btn cyan" onClick={restart}>
              OTRO PARTIDO
            </button>
            <Link className="btn ghost" href="/games">
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
            difficulty={5}
            onScoreChange={handleScoreChange}
            onClockChange={handleClockChange}
            onMatchEnd={handleMatchEnd}
          />
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>VAULT WORLD CUP · CRT-80 · 60 HZ</span>
          <span>PASO 8 · PROVISIONAL</span>
        </div>
      </div>
    </div>
  );
}
