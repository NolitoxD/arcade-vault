'use client';

import Link from 'next/link';

interface GameOverModalProps {
  variant: 'defeat' | 'victory';
  score: number;
  name: string;
  onNameChange: (name: string) => void;
  saved: boolean;
  onSave: () => void;
  onRestart: () => void;
  leaderboardHref: string;
  vaultHref?: string;
}

const TITLES: Record<GameOverModalProps['variant'], string> = {
  defeat: 'FIN DEL JUEGO',
  victory: '¡LO HAS CONSEGUIDO!',
};

export default function GameOverModal({
  variant,
  score,
  name,
  onNameChange,
  saved,
  onSave,
  onRestart,
  leaderboardHref,
  vaultHref = '/games',
}: GameOverModalProps) {
  return (
    <div className="modal-bd">
      <div className={`modal${variant === 'victory' ? ' modal--victory' : ''}`}>
        <h2>{TITLES[variant]}</h2>
        <div className="final-label">PUNTUACIÓN FINAL</div>
        <div className="final">{score.toLocaleString('es-ES')}</div>
        {!saved ? (
          <div className="input-row">
            <input
              value={name}
              onChange={(e) =>
                onNameChange(e.target.value.toUpperCase().slice(0, 10))
              }
              placeholder="TUS INICIALES"
            />
            <button className="btn yellow" onClick={onSave}>
              GUARDAR PUNTUACIÓN
            </button>
          </div>
        ) : (
          <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
        )}
        <div className="actions">
          <button className="btn" onClick={onRestart}>
            JUGAR DE NUEVO
          </button>
          <Link href={leaderboardHref} className="btn cyan">
            VER LEADERBOARD
          </Link>
          <Link href={vaultHref} className="btn magenta">
            VOLVER AL VAULT
          </Link>
        </div>
      </div>
    </div>
  );
}
