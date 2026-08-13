'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/app/context/UserContext';
import MobileGamepad from '@/components/MobileGamepad';

const PongGame = dynamic(() => import('@/components/games/PongGame'), {
  ssr: false,
});

const SKIN_OPTIONS = [
  { key: 'classic', label: 'Classic' },
  { key: 'retro', label: 'Retro' },
  { key: 'neon', label: 'Neon' },
];

function getSavedSkin() {
  if (typeof window === 'undefined') return 'classic';
  return localStorage.getItem('pong-skin') ?? 'classic';
}

const FULL_HEARTS =
  '<span style="color:var(--green)">♥</span>' +
  '<span style="color:var(--green)">♥</span>' +
  '<span style="color:var(--green)">♥</span>';

type Mode = 'solo' | 'versus';

interface VersusResult {
  winner: 1 | 2;
  score1: number;
  score2: number;
}

export default function PongPlay() {
  const { user, username } = useUser();
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const levelRef = useRef(1);
  const scoreEl = useRef<HTMLSpanElement>(null);
  const livesEl = useRef<HTMLSpanElement>(null);
  const levelEl = useRef<HTMLSpanElement>(null);
  const versusEl = useRef<HTMLSpanElement>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState('INVITADO');
  const [saved, setSaved] = useState(false);
  const [versusResult, setVersusResult] = useState<VersusResult | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [skinKey, setSkinKey] = useState('classic');
  const [fastBall, setFastBall] = useState(false);
  const [smallPaddles, setSmallPaddles] = useState(false);

  useEffect(() => {
    setSkinKey(getSavedSkin());
  }, []);

  function changeSkin(key: string) {
    setSkinKey(key);
    localStorage.setItem('pong-skin', key);
  }

  const handleScoreChange = useCallback((s: number) => {
    scoreRef.current = s;
    if (scoreEl.current)
      scoreEl.current.textContent = s.toLocaleString('es-ES');
  }, []);
  const handleLevelChange = useCallback((l: number) => {
    levelRef.current = l;
    if (levelEl.current)
      levelEl.current.textContent = String(l).padStart(2, '0');
  }, []);
  const handleLivesChange = useCallback((l: number) => {
    livesRef.current = l;
    if (livesEl.current) {
      livesEl.current.innerHTML = Array.from({ length: 3 })
        .map(
          (_, i) =>
            `<span style="color:${i < l ? 'var(--green)' : 'var(--ink-dim)'}">♥</span>`,
        )
        .join('');
    }
  }, []);
  const handleGameOver = useCallback((finalScore: number) => {
    scoreRef.current = finalScore;
    if (scoreEl.current)
      scoreEl.current.textContent = finalScore.toLocaleString('es-ES');
    setOver(true);
  }, []);
  const handleVersusScoreChange = useCallback((s1: number, s2: number) => {
    if (versusEl.current) versusEl.current.textContent = `${s1} – ${s2}`;
  }, []);
  const handleMatchEnd = useCallback(
    (winner: 1 | 2, score1: number, score2: number) => {
      if (versusEl.current)
        versusEl.current.textContent = `${score1} – ${score2}`;
      setVersusResult({ winner, score1, score2 });
      setOver(true);
    },
    [],
  );

  useEffect(() => {
    if (over && mode === 'solo') {
      if (username) {
        setName(username);
        return;
      }
      const saved = localStorage.getItem('av_player_name');
      if (saved) setName(saved);
    }
  }, [over, mode, username]);

  function resetHud() {
    scoreRef.current = 0;
    livesRef.current = 3;
    levelRef.current = 1;
    if (scoreEl.current) scoreEl.current.textContent = '0';
    if (livesEl.current) livesEl.current.innerHTML = FULL_HEARTS;
    if (levelEl.current) levelEl.current.textContent = '01';
    if (versusEl.current) versusEl.current.textContent = '0 – 0';
    setPaused(false);
    setOver(false);
    setSaved(false);
    setVersusResult(null);
    setName(username ?? 'INVITADO');
    setGameKey((k) => k + 1);
  }

  function restart() {
    resetHud();
  }

  function changeMode() {
    resetHud();
    setMode(null);
  }

  function selectMode(m: Mode) {
    resetHud();
    setMode(m);
  }

  const keyMap = { up: 'ArrowUp', down: 'ArrowDown' };

  return (
    <div className="av-player fade-in">
      {mode !== null && (
        <div className="hidden md:block">
          <div className="player-hud">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {mode === 'solo' ? (
                <>
                  <div className="hud-stat">
                    <div className="l">Jugador</div>
                    <div className="v" style={{ color: 'var(--ink)' }}>
                      {name}
                    </div>
                  </div>
                  <div className="hud-stat">
                    <div className="l">Puntuación</div>
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
                    <div className="l">Nivel</div>
                    <div className="v">
                      <span ref={levelEl}>01</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="hud-stat">
                  <div className="l">Marcador P1 – P2</div>
                  <div className="v">
                    <span ref={versusEl}>0 – 0</span>
                  </div>
                </div>
              )}
              <div className="hud-stat">
                <div className="l">Skin</div>
                <div className="v">
                  <select
                    value={skinKey}
                    onChange={(e) => changeSkin(e.target.value)}
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
                    {SKIN_OPTIONS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="hud-actions">
              <button
                className="btn yellow"
                onClick={() => setPaused((p) => !p)}
              >
                {paused ? 'REANUDAR' : 'PAUSA'}
              </button>
              <button
                className="btn magenta"
                onClick={() =>
                  mode === 'versus' ? changeMode() : setOver(true)
                }
              >
                FIN
              </button>
              <Link href="/games/pong" className="btn ghost">
                SALIR
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="crt w-full max-w-[800px] mx-auto">
        <div
          className="crt-screen crt-screen--scale-canvas"
          style={{ aspectRatio: '4 / 3' }}
        >
          {mode !== null && (
            <PongGame
              key={`${mode}-${gameKey}`}
              paused={paused}
              mode={mode}
              skinKey={skinKey}
              fastBall={fastBall}
              smallPaddles={smallPaddles}
              onScoreChange={handleScoreChange}
              onLevelChange={handleLevelChange}
              onLivesChange={handleLivesChange}
              onGameOver={handleGameOver}
              onMatchEnd={handleMatchEnd}
              onVersusScoreChange={handleVersusScoreChange}
            />
          )}
          {mode === null && (
            <div className="crt-content" style={{ zIndex: 5 }}>
              <div style={{ textAlign: 'center' }}>
                <div className="pixel neon-cyan" style={{ fontSize: 22 }}>
                  PONG
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
                  ELIGE MODO DE JUEGO
                </div>
                <div className="flex flex-col items-center gap-2 md:gap-3 mt-3 md:mt-[22px]">
                  <button className="btn cyan" onClick={() => selectMode('solo')}>
                    1 JUGADOR vs CPU
                  </button>
                  <div className="hidden md:block">
                    <button
                      className="btn magenta"
                      onClick={() => selectMode('versus')}
                    >
                      2 JUGADORES (MISMO TECLADO)
                    </button>
                  </div>
                </div>
                <div
                  className="mono mt-3 md:mt-5"
                  style={{
                    fontSize: 10,
                    color: 'var(--ink-faint)',
                    letterSpacing: '0.16em',
                  }}
                >
                  MODIFICADORES
                </div>
                <div className="flex flex-col items-center gap-1 md:gap-2 mt-1.5 md:mt-2.5">
                  <label
                    className="mono"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      color: fastBall ? 'var(--cyan)' : 'var(--ink-dim)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={fastBall}
                      onChange={(e) => setFastBall(e.target.checked)}
                    />
                    <span aria-hidden="true">
                      [{fastBall ? 'X' : ' '}]
                    </span>
                    BOLA RÁPIDA
                  </label>
                  <label
                    className="mono"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      color: smallPaddles ? 'var(--cyan)' : 'var(--ink-dim)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={smallPaddles}
                      onChange={(e) => setSmallPaddles(e.target.checked)}
                    />
                    <span aria-hidden="true">
                      [{smallPaddles ? 'X' : ' '}]
                    </span>
                    PALAS PEQUEÑAS
                  </label>
                </div>
                <div
                  className="mono mt-2.5 md:mt-[18px]"
                  style={{
                    fontSize: 10,
                    color: 'var(--ink-faint)',
                    letterSpacing: '0.12em',
                  }}
                >
                  1P: ↑/↓ o W/S
                  <span className="hidden md:inline"> · 2P: W/S y ↑/↓</span>
                </div>
              </div>
            </div>
          )}
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
          <span>PONG · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {mode === 'solo' && (
        <MobileGamepad
          keyMap={keyMap}
          paused={paused}
          onPauseToggle={() => setPaused((p) => !p)}
          skin={skinKey}
          onSkinChange={changeSkin}
          backHref="/games/pong"
        />
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            {mode === 'versus' && versusResult ? (
              <>
                <h2>{`GANA JUGADOR ${versusResult.winner}`}</h2>
                <div className="final-label">MARCADOR FINAL</div>
                <div className="final">
                  {versusResult.score1} – {versusResult.score2}
                </div>
                <div className="actions">
                  <button className="btn" onClick={restart}>
                    JUGAR DE NUEVO
                  </button>
                  <button className="btn cyan" onClick={changeMode}>
                    CAMBIAR MODO
                  </button>
                  <Link href="/games" className="btn magenta">
                    VOLVER AL VAULT
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2>FIN DEL JUEGO</h2>
                <div className="final-label">PUNTUACIÓN FINAL</div>
                <div className="final">
                  {scoreRef.current.toLocaleString('es-ES')}
                </div>
                {!saved ? (
                  <div className="input-row">
                    <input
                      value={name}
                      onChange={(e) =>
                        setName(e.target.value.toUpperCase().slice(0, 10))
                      }
                      placeholder="TUS INICIALES"
                    />
                    <button
                      className="btn yellow"
                      onClick={async () => {
                        setSaved(true);
                        localStorage.setItem('av_player_name', name);
                        const supabase = createClient();
                        await supabase.from('scores').insert({
                          game_id: 'pong',
                          player_name: name,
                          score: scoreRef.current,
                          user_id: user?.id ?? null,
                        });
                      }}
                    >
                      GUARDAR PUNTUACIÓN
                    </button>
                  </div>
                ) : (
                  <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
                )}
                <div className="actions">
                  <button className="btn" onClick={restart}>
                    JUGAR DE NUEVO
                  </button>
                  <button className="btn cyan" onClick={changeMode}>
                    CAMBIAR MODO
                  </button>
                  <Link href="/games/pong#leaderboard" className="btn ghost">
                    VER LEADERBOARD
                  </Link>
                  <Link href="/games" className="btn magenta">
                    VOLVER AL VAULT
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
