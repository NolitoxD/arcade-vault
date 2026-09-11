'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

// PROVISIONAL (stage C, step 9). The definitive play page is step 10: catalogue
// entry, migration, music, the GameOverModal with saveScore and the mobile gamepad all
// land there and rewrite this file. It lives at the final URL on purpose.
const VaultWorldCupGame = dynamic(() => import('@/components/games/VaultWorldCupGame'), { ssr: false });

const IDLE_SCORE = '0 - 0';
const IDLE_CLOCK = '0:00';
// Mirrors STATUS_SELECTOR in VaultWorldCupGame.tsx: the label the component reports
// once a run ends and the player is back at ELIGE MODO.
const STATUS_SELECTOR = 'SELECTOR';

function isTypingTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  return target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
}

function parseSeed(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function VaultWorldCupPlayInner() {
  const searchParams = useSearchParams();
  const seed = parseSeed(searchParams.get('seed'));
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState('SELECTOR');
  const [result, setResult] = useState('');
  const [gameKey, setGameKey] = useState(0);
  const [score, setScore] = useState(IDLE_SCORE);
  const [clock, setClock] = useState(IDLE_CLOCK);

  const handleScoreChange = useCallback((home: number, away: number) => {
    setScore(`${home} - ${away}`);
  }, []);
  const handleClockChange = useCallback((label: string) => {
    setClock(label);
  }, []);
  const handleStatusChange = useCallback((label: string) => {
    setStatus(label);
    // Finding 3: back at the selector, the HUD must show the live status again --
    // an armed `result` from the previous run must not linger mid-run.
    if (label === STATUS_SELECTOR) setResult('');
  }, []);
  // Criterion 19: only the World Cup ever calls these. Step 10 turns them into the
  // GameOverModal + saveScore of the Vault Fighter page.
  const handleGameOver = useCallback((finalScore: number) => {
    setResult(`ELIMINADO · ${finalScore.toLocaleString('es-ES')} PTS`);
  }, []);
  const handleVictory = useCallback((finalScore: number) => {
    setResult(`CAMPEONES · ${finalScore.toLocaleString('es-ES')} PTS`);
  }, []);

  // Restart by remount (the repo's mechanism): lands on the mode selector.
  const restart = useCallback(() => {
    setResult('');
    setScore(IDLE_SCORE);
    setClock(IDLE_CLOCK);
    setStatus('SELECTOR');
    setPaused(false);
    setGameKey((k) => k + 1);
  }, []);

  // P pauses, R restarts -- only once a World Cup has reported its end (a stray R
  // mid-match must not wipe a run; inside a training match R is the game's own exit).
  // isTypingTarget closes step-8 Minor 10 now that the game has key handlers by phase.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.repeat || isTypingTarget(e)) return;
      const key = e.key.toLowerCase();
      if (key === 'p') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (key === 'r' && result !== '') {
        e.preventDefault();
        restart();
      }
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
              <div className="v">{result !== '' ? result : paused ? 'EN PAUSA' : status}</div>
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
              AL SELECTOR
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
            seed={seed}
            onScoreChange={handleScoreChange}
            onClockChange={handleClockChange}
            onStatusChange={handleStatusChange}
            onGameOver={handleGameOver}
            onVictory={handleVictory}
          />
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>VAULT WORLD CUP · CRT-80 · 60 HZ</span>
          <span>PASO 9 · PROVISIONAL</span>
        </div>
      </div>
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
