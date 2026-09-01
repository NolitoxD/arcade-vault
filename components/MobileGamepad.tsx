'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './MobileGamepad.module.css';

const CYAN = '#00f5ff';
const MAGENTA = '#ff006e';
const GOLD = '#ffcf3a';

export interface KeyMap {
  up?: string;
  down?: string;
  left?: string;
  right?: string;
  a?: string;
  b?: string;
  c?: string;
}

export interface SkinOptionProp {
  key: string;
  label: string;
  locked?: boolean;
  requiredCredits?: number;
  lockedLabel?: string;
}

interface MobileGamepadProps {
  keyMap: KeyMap;
  paused: boolean;
  onPauseToggle: () => void;
  skin: string;
  onSkinChange: (skin: string) => void;
  skinOptions: SkinOptionProp[];
  onHelp?: () => void;
  backHref: string;
  cLit?: boolean;
}

function keyToCode(key: string): string {
  if (key === ' ') return 'Space';
  if (key === 'Shift') return 'ShiftLeft';
  if (key.startsWith('Arrow')) return key;
  if (key.length === 1) return `Key${key.toUpperCase()}`;
  return key;
}

function dispatchKey(key: string, type: 'keydown' | 'keyup') {
  const code = keyToCode(key);
  const init: KeyboardEventInit = {
    key,
    code,
    bubbles: true,
    cancelable: true,
  };
  document.dispatchEvent(new KeyboardEvent(type, init));
}

const DPAD_ARROWS: Record<string, React.ReactNode> = {
  up: <path d="M12 4 L20 16 L4 16 Z" fill="currentColor" />,
  down: <path d="M4 8 L20 8 L12 20 Z" fill="currentColor" />,
  left: <path d="M16 4 L16 20 L4 12 Z" fill="currentColor" />,
  right: <path d="M8 4 L20 12 L8 20 Z" fill="currentColor" />,
};

function DPadButton({
  direction,
  keyValue,
}: {
  direction: 'up' | 'down' | 'left' | 'right';
  keyValue?: string;
}) {
  const [active, setActive] = useState(false);
  const size = 44;

  const handleStart = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!keyValue) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setActive(true);
    dispatchKey(keyValue, 'keydown');
  };

  const handleEnd = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!keyValue || !active) return;
    setActive(false);
    dispatchKey(keyValue, 'keyup');
  };

  return (
    <button
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active
          ? 'linear-gradient(180deg, #08161e, #030a0e)'
          : 'linear-gradient(180deg, #1a1a25, #0a0a12)',
        border: `1px solid ${active ? CYAN : 'rgba(255,255,255,0.05)'}`,
        borderRadius: 10,
        color: active ? CYAN : '#8a8fb5',
        cursor: keyValue ? 'pointer' : 'default',
        opacity: keyValue ? 1 : 0.2,
        padding: 0,
        boxShadow: active
          ? `0 1px 0 #050507, inset 0 0 16px rgba(0,245,255,0.45), 0 0 16px rgba(0,245,255,0.5)`
          : `0 4px 0 #050507, inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 4px rgba(0,0,0,0.6)`,
        transform: active ? 'translateY(3px)' : 'none',
        transition:
          'transform 80ms, box-shadow 140ms, color 140ms, border-color 140ms, background 140ms',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onPointerDown={handleStart}
      onPointerUp={handleEnd}
      onPointerLeave={handleEnd}
      onPointerCancel={handleEnd}
      aria-label={direction}
    >
      <svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        style={{
          filter: active
            ? `drop-shadow(0 0 6px ${CYAN}) drop-shadow(0 0 12px ${CYAN})`
            : 'none',
          transition: 'filter 140ms',
        }}
      >
        {DPAD_ARROWS[direction]}
      </svg>
    </button>
  );
}

// Layout of the action cluster. Two buttons keep the exact numbers the other
// twelve games have shipped with, so nothing about them changes. Three buttons
// (only VAULT FIGHTER's magic so far) use a smaller button and a tighter gap:
// 3*44 + 2*8 = 148px of cluster beside the rigid 140px D-pad and 46px of
// padding/border = 334px, inside the 343px a 375px viewport leaves after
// .av-player's 16px side padding. The old 3*58 + 2*22 = 218px cluster did not
// fit, and since the D-pad grid cannot shrink the circles absorbed the
// difference and rendered as flattened ellipses. 44px is still the minimum
// comfortable tap target.
const ACTION_SIZE_2 = 58;
const ACTION_SIZE_3 = 44;
const ACTION_GAP_2 = 22;
const ACTION_GAP_3 = 8;

function ActionButton({
  label,
  keyValue,
  variant,
  lit = true,
  size = ACTION_SIZE_2,
}: {
  label: 'A' | 'B' | 'C';
  keyValue?: string;
  variant: 'a' | 'b' | 'c';
  lit?: boolean;
  size?: number;
}) {
  const [active, setActive] = useState(false);

  const isA = variant === 'a';
  const isC = variant === 'c';
  const color = isC ? GOLD : isA ? MAGENTA : CYAN;
  const abMid = isC
    ? 'rgba(255,207,58,0.7)'
    : isA
      ? 'rgba(255,0,110,0.7)'
      : 'rgba(0,200,230,0.7)';
  const abDeep = isC
    ? 'rgba(120,90,0,0.95)'
    : isA
      ? 'rgba(110,0,40,0.95)'
      : 'rgba(0,50,70,0.95)';
  const abGlow = isC
    ? 'rgba(255,207,58,0.4)'
    : isA
      ? 'rgba(255,0,110,0.4)'
      : 'rgba(0,245,255,0.4)';
  const dimmed = !lit;

  const handleStart = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!keyValue) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setActive(true);
    dispatchKey(keyValue, 'keydown');
    dispatchKey(keyValue, 'keyup');
  };

  const handleEnd = (e: React.PointerEvent) => {
    e.preventDefault();
    setActive(false);
  };

  return (
    <button
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${dimmed ? 'rgba(255,207,58,0.35)' : color}`,
        background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.25), transparent 50%), radial-gradient(circle at 50% 55%, ${abMid}, ${abDeep} 75%)`,
        padding: 0,
        cursor: keyValue ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: dimmed
          ? '0 6px 0 #050507, inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -4px 8px rgba(0,0,0,0.4)'
          : active
            ? `0 1px 0 #050507, 0 0 36px ${abGlow}, inset 0 0 18px rgba(0,0,0,0.5)`
            : `0 6px 0 #050507, 0 0 22px ${abGlow}, inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -4px 8px rgba(0,0,0,0.4)`,
        transform: active ? 'translateY(4px) scale(0.97)' : 'none',
        transition: 'transform 80ms, box-shadow 140ms',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        opacity: dimmed ? 0.45 : keyValue ? 1 : 0.2,
      }}
      onPointerDown={handleStart}
      onPointerUp={handleEnd}
      onPointerLeave={handleEnd}
      onPointerCancel={handleEnd}
      aria-label={label}
    >
      <span
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: size >= ACTION_SIZE_2 ? 16 : 13,
          color: '#fff',
          letterSpacing: '0.02em',
          textShadow: `0 0 8px ${color}, 0 0 18px ${color}, 0 1px 0 rgba(0,0,0,0.6)`,
        }}
      >
        {label}
      </span>
    </button>
  );
}

export default function MobileGamepad({
  keyMap,
  paused,
  onPauseToggle,
  skin,
  onSkinChange,
  skinOptions,
  onHelp,
  backHref,
  cLit = false,
}: MobileGamepadProps) {
  const btnSize = 44;
  const hasMagic = Boolean(keyMap.c);
  const actionSize = hasMagic ? ACTION_SIZE_3 : ACTION_SIZE_2;
  const actionGap = hasMagic ? ACTION_GAP_3 : ACTION_GAP_2;

  return (
    /* .gp neon container */
    <div
      className="md:hidden"
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        marginTop: 18,
        borderTop: '1px solid rgba(0,245,255,0.2)',
        background: 'linear-gradient(180deg, #1c1c28 0%, #0c0c14 100%)',
        border: '1px solid rgba(0,245,255,0.18)',
        borderRadius: 22,
        boxShadow: `
          0 0 0 6px #1b1b22,
          0 0 0 7px #2a2a35,
          0 30px 80px -30px rgba(0,245,255,0.4),
          inset 0 1px 0 rgba(255,255,255,0.06),
          inset 0 -2px 0 rgba(0,0,0,0.6)
        `,
        padding: '16px 22px 14px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* Inner border (replaces ::before) */}
      <div
        style={{
          position: 'absolute',
          inset: 4,
          border: '1px solid rgba(0,245,255,0.14)',
          borderRadius: 18,
          pointerEvents: 'none',
        }}
      />
      {/* Dot overlay (replaces ::after) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
          borderRadius: 'inherit',
          pointerEvents: 'none',
          opacity: 0.6,
        }}
      />

      {/* Content layer */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Main row: D-pad left, action buttons right */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Step 3 — D-pad */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${btnSize}px ${btnSize}px ${btnSize}px`,
              gridTemplateRows: `${btnSize}px ${btnSize}px ${btnSize}px`,
              gap: 4,
            }}
          >
            <div />
            <DPadButton direction="up" keyValue={keyMap.up} />
            <div />

            <DPadButton direction="left" keyValue={keyMap.left} />

            {/* Hub central con gema pulsante */}
            <div
              style={{
                width: btnSize,
                height: btnSize,
                background:
                  'radial-gradient(circle at 50% 50%, #181822 0%, #08080d 80%)',
                border: '1px solid rgba(0,245,255,0.15)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  'inset 0 0 12px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              <span
                className={styles.pulseLed}
                style={{
                  display: 'block',
                  width: 12,
                  height: 12,
                  background: CYAN,
                  clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
                }}
              />
            </div>

            <DPadButton direction="right" keyValue={keyMap.right} />

            <div />
            <DPadButton direction="down" keyValue={keyMap.down} />
            <div />
          </div>

          {/* Step 4 — Botones A/B (+ C opcional, la magia) */}
          <div style={{ display: 'flex', gap: actionGap, alignItems: 'center' }}>
            {hasMagic && (
              <ActionButton
                label="C"
                keyValue={keyMap.c}
                variant="c"
                lit={cLit}
                size={actionSize}
              />
            )}
            <ActionButton label="B" keyValue={keyMap.b} variant="b" size={actionSize} />
            <ActionButton label="A" keyValue={keyMap.a} variant="a" size={actionSize} />
          </div>
        </div>

        {/* Fila inferior: PAUSA, skin, SALIR */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginTop: 14,
          }}
        >
          <button
            style={{
              flex: 1,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,220,0,0.1)',
              border: '1px solid rgba(255,220,0,0.45)',
              borderRadius: 8,
              color: '#ffdc00',
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              boxShadow: '0 0 8px rgba(255,220,0,0.15)',
            }}
            onClick={onPauseToggle}
            aria-label={paused ? 'Reanudar' : 'Pausa'}
          >
            {paused ? '▶ REANUDAR' : '⏸ PAUSA'}
          </button>

          {onHelp && (
            <button
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,245,255,0.06)',
                border: '1px solid rgba(0,245,255,0.25)',
                borderRadius: 8,
                color: '#a0f0ff',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                padding: 0,
              }}
              onClick={onHelp}
              aria-label="Instrucciones"
            >
              ?
            </button>
          )}

          <select
            value={skin}
            onChange={(e) => onSkinChange(e.target.value)}
            style={{
              background: 'rgba(0,245,255,0.06)',
              border: '1px solid rgba(0,245,255,0.25)',
              borderRadius: 8,
              color: '#a0f0ff',
              fontFamily: 'inherit',
              fontSize: 12,
              padding: '6px 8px',
              cursor: 'pointer',
              outline: 'none',
              height: 36,
            }}
            aria-label="Selector de skin"
          >
            {skinOptions.map((s) => (
              <option key={s.key} value={s.key} disabled={s.locked}>
                {s.locked ? (s.lockedLabel ?? s.label) : s.label}
              </option>
            ))}
          </select>

          <Link
            href={backHref}
            style={{
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.55)',
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textDecoration: 'none',
              padding: '0 12px',
              whiteSpace: 'nowrap',
            }}
          >
            SALIR
          </Link>
        </div>
      </div>
    </div>
  );
}
