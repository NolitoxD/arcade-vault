import type { GameMeta, KeyboardControl } from '@/lib/games-registry';

const DIRECTION_LABELS = {
  up: '▲ Arriba',
  down: '▼ Abajo',
  left: '◀ Izquierda',
  right: '▶ Derecha',
} as const;

const headingStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.14em',
  margin: '18px 0 8px',
};

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: '1px solid var(--line)',
};

const keycapStyle: React.CSSProperties = {
  display: 'inline-block',
  minWidth: 22,
  padding: '3px 7px',
  marginRight: 4,
  fontSize: 11,
  textAlign: 'center',
  color: 'var(--cyan)',
  background: 'var(--bg-2)',
  border: '1px solid rgba(0,245,255,0.35)',
  borderBottomWidth: 3,
  borderRadius: 4,
};

const tagStyle: React.CSSProperties = {
  fontSize: 7,
  letterSpacing: '0.12em',
  padding: '3px 6px',
  marginLeft: 8,
  color: 'var(--magenta)',
  border: '1px solid var(--magenta)',
  verticalAlign: 'middle',
};

const textStyle: React.CSSProperties = {
  color: 'var(--ink-dim)',
  fontSize: 13,
  lineHeight: 1.6,
  margin: 0,
};

function KeyboardRow({ row }: { row: KeyboardControl }) {
  return (
    <div style={rowStyle}>
      <div>
        {row.keys.map((key) => (
          <kbd key={key} className="mono" style={keycapStyle}>
            {key}
          </kbd>
        ))}
      </div>
      <div className="mono" style={{ ...textStyle, fontSize: 12 }}>
        {row.action}
        {row.special && (
          <span className="pixel" style={tagStyle}>
            ESPECIAL
          </span>
        )}
      </div>
    </div>
  );
}

export default function InstructionsContent({
  game,
  title,
}: {
  game: GameMeta;
  title: string;
}) {
  const { keyboard, touch } = game.controls;
  const normalRows = keyboard.filter((row) => !row.special);
  const specialRows = keyboard.filter((row) => row.special);
  const directions = (
    Object.keys(DIRECTION_LABELS) as (keyof typeof DIRECTION_LABELS)[]
  ).filter((direction) => touch.keyMap[direction]);

  return (
    <div>
      <h2
        className="pixel neon-cyan"
        style={{ fontSize: 14, margin: 0, color: 'var(--cyan)' }}
      >
        {title}
      </h2>

      <h3 className="pixel neon-yellow" style={headingStyle}>
        OBJETIVO
      </h3>
      <p style={textStyle}>{game.instructions.goal}</p>

      <h3 className="pixel neon-yellow" style={headingStyle}>
        CONSEJOS
      </h3>
      <ul style={{ ...textStyle, paddingLeft: 18 }}>
        {game.instructions.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>

      <h3 className="pixel neon-yellow" style={headingStyle}>
        TECLADO
      </h3>
      <div>
        {normalRows.map((row) => (
          <KeyboardRow key={`${row.keys.join('+')}-${row.action}`} row={row} />
        ))}
        {specialRows.map((row) => (
          <KeyboardRow key={`${row.keys.join('+')}-${row.action}`} row={row} />
        ))}
      </div>

      <h3 className="pixel neon-yellow" style={headingStyle}>
        TÁCTIL
      </h3>
      <div>
        {directions.map((direction) => (
          <div key={direction} style={rowStyle}>
            <div
              className="mono"
              style={{ ...textStyle, fontSize: 12, color: 'var(--cyan)' }}
            >
              {DIRECTION_LABELS[direction]}
            </div>
            <div className="mono" style={{ ...textStyle, fontSize: 12 }}>
              D-pad
            </div>
          </div>
        ))}
        {touch.a && (
          <div style={rowStyle}>
            <div
              className="pixel"
              style={{ fontSize: 11, color: 'var(--magenta)' }}
            >
              A
            </div>
            <div className="mono" style={{ ...textStyle, fontSize: 12 }}>
              {touch.a}
            </div>
          </div>
        )}
        {touch.b && (
          <div style={rowStyle}>
            <div
              className="pixel"
              style={{ fontSize: 11, color: 'var(--cyan)' }}
            >
              B
            </div>
            <div className="mono" style={{ ...textStyle, fontSize: 12 }}>
              {touch.b}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
