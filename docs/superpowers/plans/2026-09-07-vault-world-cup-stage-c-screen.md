# Vault World Cup — Etapa C, paso 8 (la pantalla) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el paso 8 del spec: `VaultWorldCupGame.tsx` y sus SFX de fichero, de modo que Paco pueda jugar **un solo amistoso contra la CPU** —cámara siguiendo al balón sobre el campo de 2 000 × 1 300, minimapa con los dieciocho, jugadores con las equipaciones, HUD con marcador y reloj, teclado de cruceta + tres botones, la fase de saque con su cuenta atrás dibujada, rótulos (INICIO, FALTA, PENALTI, FUERA, CÓRNER, GOL, FINAL, PRÓRROGA, PENALTIS, ELIMINADO/GANADOR) y celebración de gol fija— **sin tocar una sola línea del motor**.

**Architecture:** El componente **no reimplementa nada** del motor: llama a `stepMatch(match, inputs, rng)` a paso fijo de 60 Hz con un acumulador y dibuja el `MatchState` tal cual, **sin interpolación** (igual que los trece juegos anteriores, que dibujan el estado del frame). Todo lo que se puede razonar sin canvas ni rAF sale del `.tsx` a **módulos puros nuevos en `components/games/football-screen/`** —hermano de `football-logic/`, nunca dentro— con su `.test.ts` al lado: la cámara y la transformación mundo→pantalla, el minimapa, la máquina de estados del teclado que produce un `TeamInput`, el presupuesto de pasos por frame, el formateo del HUD (con el recorte del reloj de la prórroga), la cola de rótulos con su detector de transiciones, el mapeo evento→SFX con el sorteo del ambiente, y la guarda de viewport. El `.tsx` queda como **pegamento y dibujo**: es lo único no testable bajo la configuración actual de vitest (entorno Node, sin DOM), exactamente como `VaultFighterGame.tsx`. El audio va en `lib/sfx-vault-world-cup.ts` siguiendo el contrato de `lib/sfx-vault-fighter.ts` (clase + singleton + no-op sin `Audio`), pero **por fichero** (`new Audio()`, como `PongGame`/`ArkanoidGame`) porque el spec ya asigna los mp3 de `public/`.

**Tech Stack:** TypeScript estricto, React 19.2.4, Next 16.2.6 (App Router, `dynamic(..., { ssr: false })`), canvas 2D 800 × 500, vitest 4.1.11 (tests `*.test.ts` junto al código, **sin `vitest.config`**, entorno Node sin DOM), Web Audio no: `HTMLAudioElement`.

**Spec:** `specs/31-vault-world-cup.md` (Approved) — §Alcance (cámara + minimapa, rótulos sin árbitro, celebración fija, una sola versión visual, solo desktop con bloqueo por viewport), §Modelo de datos, §Números de partida, §Reglas de la IA, **§Etapa C paso 8**, §Etapa D tabla de audio (qué SFX son de este paso y qué música es del 10), criterios de aceptación 5, 7, 10, 11, 12, 13, 20, 21, §Decisiones 04/05/06/07-sep, §Riesgos 3 y 5.
**Informes obligatorios:** `.superpowers/sdd/2026-09-05-vault-world-cup-stage-b/final-review-report.md` §8 (gates 1-6 de la etapa C) · `.superpowers/sdd/2026-09-06-vault-world-cup-stage-b2/final-review-report.md` §8 (mapa de lectura del HUD).
**Ledgers:** `progress.md` de esas dos carpetas (ítems «CARRY TO Task 8»).
**Planes de referencia:** `docs/superpowers/plans/2026-09-01-vault-fighter.md` Task 10 (patrón de pantalla + SFX) · `docs/superpowers/plans/2026-09-06-vault-world-cup-stage-b2.md` (Global Constraints heredadas).

---

## Global Constraints

Heredadas de las etapas A, B y B2, con la baseline actualizada y las reglas nuevas propias de una etapa de pantalla. **Los requisitos de cada tarea incluyen implícitamente esta sección.**

- **Commits: SOLO Paco.** Ninguna tarea ejecuta `git add` ni `git commit`. Cada tarea termina dejando el working tree **verificado** y **propone el mensaje de commit exacto** en un paso «Proponer commit». Rama `main`.
- **NUNCA arrancar `next dev`.** Paco tiene el suyo en `:3000`. La verificación automática de cada tarea es `npx vitest run` + `npx tsc --noEmit`; `npm run build` además al cerrar el paso. **El QA visual lo hace Paco**, con la lista de comprobación que cada tarea deja escrita.
- **EL MOTOR NO SE TOCA.** `components/games/football-logic/` está congelado en el commit `09a6001`. Al cerrar cada tarea, `git diff --stat 09a6001 -- components/games/football-logic/` debe devolver **VACÍO**. Si algo del motor estorba, **no se arregla aquí**: se anota en «Peticiones separadas al motor» del cierre y la pantalla lo rodea.
- **Baseline verificada hoy (2026-09-07, commit `09a6001`): 916 tests en 52 ficheros verdes**, `npx tsc --noEmit` limpio, `npm run build` exit 0. Cada tarea suma y no regresa. Ningún test existente cambia de valor esperado: si uno se pone rojo es un bug de esta etapa.
- **Comentarios y nombres de tests en inglés** (convención del repo). El plan, el spec y el chat, en castellano. **Los textos de UI van en castellano y en mayúsculas** (`GOL`, `FALTA`, `PRÓRROGA`…), como en los otros trece juegos.
- **Ficheros en kebab-case**, salvo el componente `VaultWorldCupGame.tsx` (PascalCase, convención de `components/games/`). Tipos en PascalCase, `SCREAMING_CASE` para constantes de módulo. TypeScript estricto: nada de `any`, nada de `!` gratuito salvo el `canvas.getContext('2d')!` que ya usan los trece juegos, nada de `as` para tapar un tipo.
- **Toda la lógica de pantalla que se pueda razonar sin canvas vive en `components/games/football-screen/` como función pura con su test.** Regla operativa: si en el `.tsx` aparece una fórmula, un umbral, un formateo o una decisión de estado, **se mueve a `football-screen/` y se le escribe un test**. El `.tsx` solo puede contener llamadas a `ctx.*`, lectura de refs y el cableado de eventos.
- **`football-screen/` NO importa React ni toca `document`, `window`, `canvas` ni `Audio`.** Son módulos de Node puros: es lo que los hace testables con la configuración actual (sin `vitest.config`, entorno Node). La única excepción es `viewport-guard.ts`, que **recibe** `width`/`height` por parámetro y tampoco lee `window`.
- **Determinismo de la pantalla: PROHIBIDO `Math.random` en `components/games/football-screen/`.** Antes de cerrar cada tarea: `grep -rn "Math.random" components/games/football-screen/` debe devolver **VACÍO**, tests incluidos. La semilla del partido sale de `Date.now()` **en el componente** (fuera del motor y fuera de `football-screen/`), y de ahí se derivan por aritmética entera los dos streams: el `rng` del partido y el `rng` del ambiente. `performance.now()` y `Date.now()` **solo** en el `.tsx`.
- **Dos streams de azar, nunca uno.** `matchRng = createRng(seed)` es el del motor. La CPU decide con **su propio** stream, `cpuRng = createRng(seed ^ CPU_SEED_SALT)`, exactamente como hace `playCpuMatch` en `ai.test.ts`: `decideTeamInput(...)` se llama **antes** de `stepMatch` y nunca consume del `rng` del partido. El ambiente del público usa un tercero, `createRng(ambienceSeedFor(seed, half))`, por la razón que da el spec: la capa de audio no puede consumir tiradas del motor.
- **Sin asignación de memoria por frame** (criterio 20), ni en el bucle ni en el dibujo. Todo el estado del bucle se crea **una vez** dentro del `useEffect(..., [])`: los dos `TeamInput`, el `AiState`, la `Camera`, el `PadState`, el `CaptionState`, el `MatchWatch`, el array de instantes de ambiente. Nada de literales de objeto/array, `filter`/`map`/spread, `new`, closures ni plantillas de string dentro de `update()` ni de `draw()`. Las cadenas del HUD se precalculan en tablas indexadas por entero (patrón `TIMER_TEXT` de `KongGame`/`VaultFighterGame`) y solo se reasignan cuando cambia el número.
- **Paso fijo, sin `dtMs` al motor.** El componente acumula el tiempo real del frame y llama a `stepMatch` tantas veces como pasos completos quepan, con **tope de 5 pasos por frame** (spec). `pressed` y `released` duran **un** paso: el `TeamInput` se muestrea una vez por frame y en el segundo paso y siguientes de ese mismo frame `pressed`→`held` y `released`→`up`. Es la lectura literal del comentario de `input.ts` y se fija con un test.
- **El componente no reimplementa ninguna regla.** Reloj, fases, marcador, faltas, saques, prórroga y tanda salen de `match.ts`; la CPU, de `ai.ts`. Si aparece una regla escrita en el `.tsx`, va al ledger como deuda.
- **Contrato de props estable para el paso 9.** El componente ya nace con las props que el paso 9 necesita (selecciones, formaciones, estrategia inicial, dificultad, semilla, `onMatchEnd`). El paso 8 les da valores por defecto; el paso 9 solo las rellena. **No se añaden pantallas de modo, selector de selección, segundo teclado, Mundial, cuadro ni pantallas de victoria: son del paso 9.** Registro en catálogo, migración, música y play-page definitiva son del paso 10.
- **Un solo jugador humano: el equipo 0.** El equipo 1 es CPU con dificultad 5 (spec, amistoso). El segundo teclado es del paso 9.
- **Todo lo exportado tiene consumidor** al cerrar el paso: código o test. Lo que espera al paso 9 o al 10 lleva su línea de destino escrita (`// exported for Task 9: …`).
- **Regla anti-coincidencia de fixtures (riesgo 7 del spec):** antes de dar por bueno un test, preguntarse «¿pasaría con otros números?». En esta etapa en concreto: la cámara se comprueba **dentro** del campo y **en las cuatro esquinas** recortada, no solo en el centro; el recorte del reloj se comprueba en `EXTRA_TIME_STEPS − 1` (sin recortar) **y** en `EXTRA_TIME_STEPS + 301` (recortado); el presupuesto de pasos se comprueba en 4 pasos (no capa) **y** en 6 (capa); el detector de rótulos se comprueba con la transición **y** con el paso siguiente, donde ya no debe disparar.

---

## File Structure

Orden de dependencias: una fila solo importa de las de arriba y de `football-logic/` (en modo **solo lectura**).

| Fichero | Tarea | Responsabilidad |
|---|---|---|
| `components/games/football-screen/loop.ts` (+ `.test.ts`) | 8-1 | `STEP_MS`-acumulador: cuántos pasos toca correr este frame y qué resto queda. Tope de 5. |
| `components/games/football-screen/keyboard.ts` (+ `.test.ts`) | 8-1 | Teclas → `PadState` → `TeamInput`. Máquina `up/pressed/held/released`, degradado `pressed`→`held` a partir del segundo paso del frame, formación y estrategia. |
| `components/games/football-screen/camera.ts` (+ `.test.ts`) | 8-2 | Cámara 800 × 500 sobre el campo 2 000 × 1 300: objetivo, seguimiento suave, recorte al campo y transformación mundo→pantalla. |
| `components/games/football-screen/minimap.ts` (+ `.test.ts`) | 8-2 | Rectángulo del minimapa, proyección campo→minimapa y recuadro de lo que ve la cámara. |
| `components/games/football-screen/hud.ts` (+ `.test.ts`) | 8-3 | Reloj recortado y formateado, etiqueta de parte, cuenta atrás en segundos, marcador de la tanda, jugador del cursor, aviso de botones inactivos, carga del chut y del sprint. |
| `components/games/football-screen/captions.ts` (+ `.test.ts`) | 8-3 | Detector de transiciones (`MatchWatch`) y cola de rótulos con su duración. |
| `lib/sfx-vault-world-cup.ts` (+ `.test.ts`) | 8-4 | Los SFX de fichero del paso 8, con el contrato no-op de `lib/sfx-vault-fighter.ts`. |
| `components/games/football-screen/sfx-map.ts` (+ `.test.ts`) | 8-4 | Rótulo/evento del motor → sonido, y el sorteo determinista de los instantes de ambiente. |
| `components/games/football-screen/viewport-guard.ts` (+ `.test.ts`) | 8-5 | Umbral de viewport (solo desktop en la v1). |
| `components/games/VaultWorldCupGame.tsx` | 8-5 | El pegamento: refs, bucle rAF, teclado, guarda de viewport, dibujo y `onMatchEnd`. **Sin test unitario** (rAF + canvas, igual que los trece anteriores). |
| `app/games/vault-world-cup/play/page.tsx` | 8-5 | Banco de pruebas **provisional** para que Paco juegue en su `:3000`. El paso 10 lo reescribe entero. |

### Puntos de enganche para el paso 9 (contrato que este paso deja escrito)

```ts
// components/games/VaultWorldCupGame.tsx
interface VaultWorldCupGameProps {
  paused: boolean;
  muted?: boolean;
  homeTeamId?: string;      // id de TEAMS; por defecto 'espana'   — paso 9: selector de selección
  awayTeamId?: string;      // id de TEAMS; por defecto 'italia'   — paso 9: sorteo del Mundial
  homeFormation?: number;   // índice en FORMATIONS, 0..2; por defecto 0
  awayFormation?: number;   // índice en FORMATIONS, 0..2; por defecto 0
  homeStrategy?: Strategy;  // por defecto 'neutral'               — paso 9: pantalla de alineación
  difficulty?: number;      // 1..8; por defecto 5 (amistoso, spec) — paso 9: 4/6/8 por ronda
  seed?: number;            // por defecto Date.now() — paso 9 lo fija para el Mundial
  onScoreChange?: (home: number, away: number) => void;
  onClockChange?: (label: string) => void;
  onMatchEnd: (winner: 0 | 1 | -1) => void;   // 0 humano, 1 CPU, -1 abandonado (viewport)
}
export default React.memo(VaultWorldCupGame);
```

---

## Task 8-1: `football-screen/loop.ts` y `keyboard.ts` — el adaptador motor↔teclado

**Files:**
- Create: `components/games/football-screen/loop.ts`, `components/games/football-screen/loop.test.ts`
- Create: `components/games/football-screen/keyboard.ts`, `components/games/football-screen/keyboard.test.ts`

**Interfaces:**
- Consumes: `components/games/football-logic/clock.ts` (`STEP_MS`, `STEPS_PER_SECOND`), `components/games/football-logic/input.ts` (`TeamInput`, `ButtonState`, `Axis`, `createTeamInput`), `components/games/football-logic/teams.ts` (`Strategy`, `FORMATION_COUNT`), `components/games/football-logic/match.ts` (`MatchPhase`, solo tipo).
- Produces:

```ts
// loop.ts
export const MAX_STEPS_PER_FRAME = 5;
export type StepBudget = { steps: number; carryMs: number };
export function createStepBudget(): StepBudget;
export function planSteps(accumulatorMs: number, out: StepBudget): void;
export type FrameMode = 'full' | 'captions-only' | 'frozen';
export function frameMode(phase: MatchPhase, paused: boolean, blocked: boolean): FrameMode;

// keyboard.ts
export type PadKey = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'c';
export const KEY_BINDINGS: Readonly<Record<string, PadKey>>;
export const FORMATION_KEYS: readonly string[];
export const STRATEGY_KEYS: readonly string[];
export const STRATEGY_BY_KEY: readonly Strategy[];
export type PadState = {
  up: boolean; down: boolean; left: boolean; right: boolean;
  a: ButtonState; b: ButtonState; c: ButtonState;
  formation: number; strategy: Strategy;
};
export function createPadState(strategy: Strategy, formation: number): PadState;
export function padKeyFor(key: string): PadKey | null;
export function padDown(pad: PadState, k: PadKey): void;
export function padUp(pad: PadState, k: PadKey): void;
export function padChoice(pad: PadState, key: string): boolean;
export function padBlur(pad: PadState): void;
export function padClear(pad: PadState, k: PadKey): void;
export function padToTeamInput(pad: PadState, first: boolean, out: TeamInput): void;
export function padAdvance(pad: PadState): void;
```

- [ ] **Step 1: Escribir el test que falla de `loop.ts`**

Crear `components/games/football-screen/loop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { STEP_MS } from '../football-logic/clock';
import { MAX_STEPS_PER_FRAME, createStepBudget, frameMode, planSteps } from './loop';

describe('planSteps', () => {
  it('runs no step and keeps everything below one step', () => {
    const out = createStepBudget();
    planSteps(STEP_MS - 0.01, out);
    expect(out.steps).toBe(0);
    expect(out.carryMs).toBeCloseTo(STEP_MS - 0.01, 6);
  });

  it('runs exactly the whole steps and keeps the remainder', () => {
    const out = createStepBudget();
    planSteps(STEP_MS * 4 + 3, out);
    expect(out.steps).toBe(4);
    expect(out.carryMs).toBeCloseTo(3, 6);
  });

  it('caps at MAX_STEPS_PER_FRAME and DROPS the surplus', () => {
    const out = createStepBudget();
    planSteps(STEP_MS * 40, out);
    expect(out.steps).toBe(MAX_STEPS_PER_FRAME);
    // The surplus is dropped, not carried: a backgrounded tab must not spiral.
    expect(out.carryMs).toBe(0);
  });

  it('does not cap one step below the cap', () => {
    const out = createStepBudget();
    planSteps(STEP_MS * (MAX_STEPS_PER_FRAME - 1) + 1, out);
    expect(out.steps).toBe(MAX_STEPS_PER_FRAME - 1);
    expect(out.carryMs).toBeCloseTo(1, 6);
  });

  it('never returns a negative accumulator', () => {
    const out = createStepBudget();
    planSteps(-5, out);
    expect(out.steps).toBe(0);
    expect(out.carryMs).toBe(0);
  });
});

describe('frameMode', () => {
  it('runs everything while the match is live', () => {
    expect(frameMode('play', false, false)).toBe('full');
    expect(frameMode('shootout', false, false)).toBe('full');
    expect(frameMode('kickoff', false, false)).toBe('full');
  });

  it('a paused frame runs nothing at all', () => {
    expect(frameMode('play', true, false)).toBe('frozen');
    expect(frameMode('over', true, false)).toBe('frozen');
  });

  // The bug this fixes: with the match 'over' the component used to stop calling
  // update(), so the caption queue stopped being stepped and FINAL never gave way
  // to GANADOR / ELIMINADO / EMPATE (R32). The simulation stops; the caption clock
  // does not.
  it('a finished match stops the simulation but KEEPS the caption clock', () => {
    expect(frameMode('over', false, false)).toBe('captions-only');
  });

  // Same shape for the viewport guard: blocked stops the simulation and the
  // keyboard, never the drawing and never the captions -- otherwise the EMPATE
  // that QA C6-14 asks for could not appear on the canvas.
  it('a blocked viewport stops the simulation but KEEPS the caption clock', () => {
    expect(frameMode('play', false, true)).toBe('captions-only');
    expect(frameMode('over', false, true)).toBe('captions-only');
  });
});
```

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run components/games/football-screen/loop.test.ts`
Expected: FAIL — `Failed to resolve import "./loop"`.

- [ ] **Step 3: Escribir `loop.ts`**

```ts
import { STEP_MS } from '../football-logic/clock';
import type { MatchPhase } from '../football-logic/match';

// The screen's half of the fixed step (spec, "Paso fijo de simulación"): the engine
// takes no dtMs, so the component accumulates real frame time and spends it in whole
// STEP_MS steps. Five is the spec's cap: a backgrounded tab must not fire a hundred
// steps when it comes back.
//
// There is deliberately NO MAX_FRAME_MS clamp next to it: planSteps caps at five
// steps and DROPS the surplus, so clamping the frame first would change nothing at
// all -- a 5 000 ms frame and a 250 ms one both spend five steps and carry zero.
export const MAX_STEPS_PER_FRAME = 5;

export type StepBudget = { steps: number; carryMs: number };

export function createStepBudget(): StepBudget {
  return { steps: 0, carryMs: 0 };
}

// Writes into out; allocates nothing. When the cap bites, the surplus is DROPPED
// rather than carried, which is what keeps the loop from spiralling: carrying it
// would guarantee another capped frame, and another.
export function planSteps(accumulatorMs: number, out: StepBudget): void {
  if (accumulatorMs <= 0) {
    out.steps = 0;
    out.carryMs = 0;
    return;
  }
  let steps = Math.floor(accumulatorMs / STEP_MS);
  if (steps >= MAX_STEPS_PER_FRAME) {
    out.steps = MAX_STEPS_PER_FRAME;
    out.carryMs = 0;
    return;
  }
  if (steps < 0) steps = 0;
  out.steps = steps;
  out.carryMs = accumulatorMs - steps * STEP_MS;
}

// What a frame is allowed to do. Three modes, because the component has three
// independent reasons to stop and they stop DIFFERENT things:
//   · 'frozen'        — paused: nothing moves, not even the captions. The player
//                       asked for it and expects the screen to hold still.
//   · 'captions-only' — the match is over, or the viewport guard tripped: the
//                       simulation and the keyboard stop, the caption queue and the
//                       drawing do NOT. collectCaptions queues FINAL and then
//                       GANADOR / ELIMINADO / EMPATE in the step the match ends
//                       (R32), and those only reach the screen if stepCaption keeps
//                       being called afterwards. The same holds for the viewport
//                       guard, whose abandon() produces the one EMPATE this ruleset
//                       has and which QA C6-14 asks to read on the canvas.
//   · 'full'          — everything.
// `blocked` is tested before `paused` on purpose: a window shrunk while the game was
// paused still has to show why it stopped.
export type FrameMode = 'full' | 'captions-only' | 'frozen';

export function frameMode(phase: MatchPhase, paused: boolean, blocked: boolean): FrameMode {
  if (blocked) return 'captions-only';
  if (paused) return 'frozen';
  return phase === 'over' ? 'captions-only' : 'full';
}
```

- [ ] **Step 4: Verde**

Run: `npx vitest run components/games/football-screen/loop.test.ts`
Expected: PASS, 9 tests (5 de `planSteps` + 4 de `frameMode`).

- [ ] **Step 5: Escribir el test que falla de `keyboard.ts`**

Crear `components/games/football-screen/keyboard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTeamInput } from '../football-logic/input';
import { FORMATION_COUNT } from '../football-logic/teams';
import { checkTeamInput } from '../football-logic/input';
import {
  createPadState, padAdvance, padBlur, padChoice, padClear, padDown, padKeyFor, padToTeamInput, padUp,
} from './keyboard';

describe('padKeyFor', () => {
  it('maps both the arrows and WASD to the d-pad, and jkl to A/B/C', () => {
    expect(padKeyFor('arrowup')).toBe('up');
    expect(padKeyFor('w')).toBe('up');
    expect(padKeyFor('arrowdown')).toBe('down');
    expect(padKeyFor('s')).toBe('down');
    expect(padKeyFor('arrowleft')).toBe('left');
    expect(padKeyFor('a')).toBe('left');
    expect(padKeyFor('arrowright')).toBe('right');
    expect(padKeyFor('d')).toBe('right');
    expect(padKeyFor('j')).toBe('a');
    expect(padKeyFor('k')).toBe('b');
    expect(padKeyFor('l')).toBe('c');
  });

  it('ignores anything else', () => {
    expect(padKeyFor('q')).toBeNull();
    expect(padKeyFor('enter')).toBeNull();
    expect(padKeyFor(' ')).toBeNull();
  });
});

describe('button state machine', () => {
  it('a fresh press is pressed, and only becomes held after the frame advances', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'a');
    expect(pad.a).toBe('pressed');
    padAdvance(pad);
    expect(pad.a).toBe('held');
    padAdvance(pad);
    expect(pad.a).toBe('held');
  });

  it('a key repeat does not restart the press', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'b');
    padAdvance(pad);
    padDown(pad, 'b');
    expect(pad.b).toBe('held');
  });

  it('a release is released for one advance and then up', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'c');
    padAdvance(pad);
    padUp(pad, 'c');
    expect(pad.c).toBe('released');
    padAdvance(pad);
    expect(pad.c).toBe('up');
  });

  it('a press and a release inside the same frame still produce released', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'a');
    padUp(pad, 'a');
    expect(pad.a).toBe('released');
  });

  it('blur releases the d-pad and lifts every button', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'left');
    padDown(pad, 'a');
    padAdvance(pad);
    padBlur(pad);
    expect(pad.left).toBe(false);
    expect(pad.a).toBe('up');
  });

  // A keyup whose keydown never reached the pad -- swallowed because the game was
  // paused or blocked, or arriving after a blur already lifted the button. Marking
  // it 'released' would leave an edge the engine consumes on resume as a shot the
  // player never asked for. Symmetric to pressButton, which refuses to restart a
  // press that is already down.
  it('a keyup with no keydown leaves the button up, with no phantom edge', () => {
    const pad = createPadState('neutral', 0);
    padUp(pad, 'a');
    expect(pad.a).toBe('up');
    padDown(pad, 'a');
    padAdvance(pad);
    padBlur(pad);          // alt-tab: the button is lifted without an edge
    padUp(pad, 'a');       // the real keyup arrives when the window comes back
    expect(pad.a).toBe('up');
  });

  // padClear is what the component uses for a button released while paused or
  // blocked: the button has to come up, but without the edge that padUp produces.
  it('padClear lifts one button without an edge and leaves the rest alone', () => {
    const pad = createPadState('neutral', 0);
    padDown(pad, 'a');
    padDown(pad, 'b');
    padDown(pad, 'left');
    padAdvance(pad);
    padClear(pad, 'a');
    expect(pad.a).toBe('up');
    expect(pad.b).toBe('held');
    padClear(pad, 'left');
    expect(pad.left).toBe(false);
  });
});

describe('padToTeamInput', () => {
  it('turns the four direction flags into the axes, opposites cancelling', () => {
    const pad = createPadState('neutral', 0);
    const out = createTeamInput();
    padDown(pad, 'left');
    padDown(pad, 'up');
    padToTeamInput(pad, true, out);
    expect(out.dx).toBe(-1);
    expect(out.dy).toBe(-1);
    padDown(pad, 'right');
    padToTeamInput(pad, true, out);
    expect(out.dx).toBe(0);
  });

  it('downgrades pressed to held and released to up after the first step of a frame', () => {
    const pad = createPadState('neutral', 0);
    const out = createTeamInput();
    padDown(pad, 'a');
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('pressed');
    // Same frame, second simulation step: the engine already consumed the edge.
    padToTeamInput(pad, false, out);
    expect(out.a).toBe('held');

    padUp(pad, 'a');
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('released');
    padToTeamInput(pad, false, out);
    expect(out.a).toBe('up');
  });

  it('always produces an input the engine accepts', () => {
    const pad = createPadState('attack', 2);
    const out = createTeamInput();
    padDown(pad, 'down');
    padDown(pad, 'right');
    padDown(pad, 'b');
    padToTeamInput(pad, true, out);
    expect(checkTeamInput(out, FORMATION_COUNT)).toEqual([]);
  });

  // The rule the component's update() has to honour: an edge is consumed by a STEP,
  // not by a frame. A frame that plans zero steps (STEP_MS is 16.667 ms, so on a
  // 120 Hz panel half the frames plan none) must leave 'pressed' standing, or the
  // shot the player asked for is silently dropped.
  it('a press survives a frame in which no step ran', () => {
    const pad = createPadState('neutral', 0);
    const out = createTeamInput();
    padDown(pad, 'a');
    // Frame with budget.steps === 0: no padToTeamInput, no padAdvance.
    padToTeamInput(pad, true, out);   // the NEXT frame, which does run a step
    expect(out.a).toBe('pressed');
    // And the symmetric case: once a step has run, the frame ends with padAdvance
    // and the edge is gone.
    padAdvance(pad);
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('held');
  });
});

describe('padChoice', () => {
  it('1/2/3 pick the formation and 4/5/6 the strategy', () => {
    const pad = createPadState('neutral', 0);
    expect(padChoice(pad, '3')).toBe(true);
    expect(pad.formation).toBe(2);
    expect(padChoice(pad, '1')).toBe(true);
    expect(pad.formation).toBe(0);
    expect(padChoice(pad, '4')).toBe(true);
    expect(pad.strategy).toBe('attack');
    expect(padChoice(pad, '5')).toBe(true);
    expect(pad.strategy).toBe('neutral');
    expect(padChoice(pad, '6')).toBe(true);
    expect(pad.strategy).toBe('defend');
  });

  it('leaves the pad alone for any other key', () => {
    const pad = createPadState('neutral', 1);
    expect(padChoice(pad, '7')).toBe(false);
    expect(pad.formation).toBe(1);
    expect(pad.strategy).toBe('neutral');
  });
});
```

- [ ] **Step 6: Ver fallar**

Run: `npx vitest run components/games/football-screen/keyboard.test.ts`
Expected: FAIL — `Failed to resolve import "./keyboard"`.

- [ ] **Step 7: Escribir `keyboard.ts`**

```ts
import type { Axis, ButtonState, TeamInput } from '../football-logic/input';
import type { Strategy } from '../football-logic/teams';

// S-SC1: the repo's shared mapping (games-registry, every one of the thirteen games):
// arrows or WASD for the d-pad, j/k/l for A/B/C. Matching is always on
// e.key.toLowerCase(), never e.code, because MobileGamepad synthesises key events.
export type PadKey = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'c';

export const KEY_BINDINGS: Readonly<Record<string, PadKey>> = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
  j: 'a',
  k: 'b',
  l: 'c',
};

// S-SC5: formation and strategy are changed mid-match (spec, criterion 11) on the
// number row, out of the way of both the d-pad and the three buttons.
export const FORMATION_KEYS: readonly string[] = ['1', '2', '3'];
export const STRATEGY_KEYS: readonly string[] = ['4', '5', '6'];
export const STRATEGY_BY_KEY: readonly Strategy[] = ['attack', 'neutral', 'defend'];

export type PadState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: ButtonState;
  b: ButtonState;
  c: ButtonState;
  formation: number;
  strategy: Strategy;
};

export function createPadState(strategy: Strategy, formation: number): PadState {
  return { up: false, down: false, left: false, right: false, a: 'up', b: 'up', c: 'up', formation, strategy };
}

export function padKeyFor(key: string): PadKey | null {
  const k = KEY_BINDINGS[key];
  return k === undefined ? null : k;
}

function pressButton(current: ButtonState): ButtonState {
  // OS auto-repeat fires keydown again while the key is down: a 'held' button stays
  // held instead of firing a second edge the engine would consume as a new press.
  return current === 'held' || current === 'pressed' ? current : 'pressed';
}

export function padDown(pad: PadState, k: PadKey): void {
  switch (k) {
    case 'up': pad.up = true; return;
    case 'down': pad.down = true; return;
    case 'left': pad.left = true; return;
    case 'right': pad.right = true; return;
    case 'a': pad.a = pressButton(pad.a); return;
    case 'b': pad.b = pressButton(pad.b); return;
    case 'c': pad.c = pressButton(pad.c); return;
  }
}

// The mirror of pressButton: a button only RELEASES from a press. A keyup on a
// button that was already up is not an edge -- it happens whenever the keydown never
// reached the pad (paused, blocked) or a blur lifted the button first, and marking it
// 'released' would hand the engine a shot the player never asked for on the next step.
function releaseButton(current: ButtonState): ButtonState {
  return current === 'pressed' || current === 'held' ? 'released' : 'up';
}

export function padUp(pad: PadState, k: PadKey): void {
  switch (k) {
    case 'up': pad.up = false; return;
    case 'down': pad.down = false; return;
    case 'left': pad.left = false; return;
    case 'right': pad.right = false; return;
    case 'a': pad.a = releaseButton(pad.a); return;
    case 'b': pad.b = releaseButton(pad.b); return;
    case 'c': pad.c = releaseButton(pad.c); return;
  }
}

// Lift one key without producing an edge -- padBlur for a single key. The component
// uses it for a BUTTON released while the game is paused or the viewport guard has
// tripped: the button must come up (the finger really is off the key), but the
// release must not survive into the resumed match as a shot. Directions are never
// routed here: they are released normally in every state, because a direction left
// standing is repo-wide bug #1.
export function padClear(pad: PadState, k: PadKey): void {
  switch (k) {
    case 'up': pad.up = false; return;
    case 'down': pad.down = false; return;
    case 'left': pad.left = false; return;
    case 'right': pad.right = false; return;
    case 'a': pad.a = 'up'; return;
    case 'b': pad.b = 'up'; return;
    case 'c': pad.c = 'up'; return;
  }
}

// Returns true when the key was a formation/strategy choice, so the caller knows to
// preventDefault. The engine applies both every step (applyTeamChoices), so nothing
// else is needed: writing them into the TeamInput IS the change.
export function padChoice(pad: PadState, key: string): boolean {
  const f = FORMATION_KEYS.indexOf(key);
  if (f >= 0) {
    pad.formation = f;
    return true;
  }
  const s = STRATEGY_KEYS.indexOf(key);
  if (s >= 0) {
    pad.strategy = STRATEGY_BY_KEY[s];
    return true;
  }
  return false;
}

// Repo-wide bug #1 (VaultFighterGame's own comment): alt-tabbing with a direction
// held would leave the player running forever. Buttons go straight to 'up' -- a
// blur is not a release the player meant, so it must not fire a shot.
export function padBlur(pad: PadState): void {
  pad.up = false;
  pad.down = false;
  pad.left = false;
  pad.right = false;
  pad.a = 'up';
  pad.b = 'up';
  pad.c = 'up';
}

function axisOf(negative: boolean, positive: boolean): Axis {
  if (negative === positive) return 0;
  return negative ? -1 : 1;
}

// `first` is false for the second and later simulation steps of the SAME frame.
// input.ts: "pressed and released last one step and the engine consumes them on the
// first". The keyboard is sampled once per frame, so the component repeats the same
// TeamInput across the frame's steps -- with the edges downgraded from the second on,
// or a single tap would fire up to five shots.
export function padToTeamInput(pad: PadState, first: boolean, out: TeamInput): void {
  out.dx = axisOf(pad.left, pad.right);
  out.dy = axisOf(pad.up, pad.down);
  out.a = first ? pad.a : settle(pad.a);
  out.b = first ? pad.b : settle(pad.b);
  out.c = first ? pad.c : settle(pad.c);
  out.formation = pad.formation;
  out.strategy = pad.strategy;
}

function settle(b: ButtonState): ButtonState {
  if (b === 'pressed') return 'held';
  if (b === 'released') return 'up';
  return b;
}

// Called ONCE at the end of each frame **that actually ran a step**, after every step
// of that frame. Calling it on a zero-step frame would consume an edge no stepMatch
// ever saw -- see the "a press survives a frame in which no step ran" test and the
// `budget.steps > 0` guard in the component's update().
export function padAdvance(pad: PadState): void {
  pad.a = settle(pad.a);
  pad.b = settle(pad.b);
  pad.c = settle(pad.c);
}
```

- [ ] **Step 8: Verde y suite completa**

Run: `npx vitest run components/games/football-screen/ && npx vitest run && npx tsc --noEmit`
Expected: los dos ficheros nuevos en verde; **la suite pasa de 916 a 940 tests en 54 ficheros** (9 de `loop` + 15 de `keyboard`, contados uno a uno sobre los tests escritos arriba); `tsc` sin salida. **Anotar el recuento real en el ledger**: la puerta que importa es que ninguno de los 916 anteriores se ponga rojo, no que el número coincida con el anunciado.

- [ ] **Step 9: Comprobar que el motor sigue intacto**

Run: `git diff --stat 09a6001 -- components/games/football-logic/ && grep -rn "Math.random" components/games/football-screen/`
Expected: **las dos salidas vacías**.

- [ ] **Step 10: Proponer commit**

No ejecutar. Mensaje propuesto:

`feat(world-cup): fixed-step budget and keyboard-to-TeamInput adapter for the screen`

**QA de Paco para esta tarea:** ninguno todavía (no hay pantalla). Se verifica al llegar la 8-5.

---

## Task 8-2: `football-screen/camera.ts` y `minimap.ts` — la cámara y el minimapa

**Files:**
- Create: `components/games/football-screen/camera.ts`, `components/games/football-screen/camera.test.ts`
- Create: `components/games/football-screen/minimap.ts`, `components/games/football-screen/minimap.test.ts`

**Interfaces:**
- Consumes: `football-logic/pitch.ts` (`PITCH`, `PitchDef`, `centerX`, `centerY`), `football-logic/geometry.ts` (`clamp`), `football-logic/match.ts` (`MatchState`).
- Produces:

```ts
// camera.ts
export const VIEW_W = 800;
export const VIEW_H = 500;
export const PITCH_MARGIN = 60;
export const CAMERA_LAG = 0.12;
export type Camera = { x: number; y: number };          // top-left corner, world units
export function createCamera(): Camera;
export function cameraMinX(pitch: PitchDef): number;
export function cameraMaxX(pitch: PitchDef): number;
export function cameraMinY(pitch: PitchDef): number;
export function cameraMaxY(pitch: PitchDef): number;
export function centreCamera(cam: Camera, x: number, y: number, pitch: PitchDef): void;
export function followCamera(cam: Camera, x: number, y: number, pitch: PitchDef, lag: number): void;
export function cameraTargetX(match: MatchState): number;
export function cameraTargetY(match: MatchState): number;
export function toScreenX(cam: Camera, worldX: number): number;
export function toScreenY(cam: Camera, worldY: number): number;
export function isOnScreen(cam: Camera, worldX: number, worldY: number, margin: number): boolean;

// minimap.ts
export const MINIMAP_W = 200;
export const MINIMAP_H = 130;
export const MINIMAP_PAD = 12;
export function minimapX(pitch: PitchDef, worldX: number): number;
export function minimapY(pitch: PitchDef, worldY: number): number;
export type MinimapRect = { x: number; y: number; w: number; h: number };
export function createMinimapRect(): MinimapRect;
export function minimapViewRect(cam: Camera, pitch: PitchDef, out: MinimapRect): void;
```

- [ ] **Step 1: Escribir el test que falla de `camera.ts`**

Crear `components/games/football-screen/camera.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PITCH, centerX, centerY } from '../football-logic/pitch';
import {
  PITCH_MARGIN, VIEW_H, VIEW_W, cameraMaxX, cameraMaxY, cameraMinX, cameraMinY,
  centreCamera, createCamera, followCamera, isOnScreen, toScreenX, toScreenY,
} from './camera';

describe('camera bounds', () => {
  it('the view is smaller than the pitch on both axes', () => {
    expect(VIEW_W).toBeLessThan(PITCH.width);
    expect(VIEW_H).toBeLessThan(PITCH.height);
  });

  it('the bounds allow exactly PITCH_MARGIN of surround on each side', () => {
    expect(cameraMinX(PITCH)).toBe(-PITCH_MARGIN);
    expect(cameraMaxX(PITCH)).toBe(PITCH.width + PITCH_MARGIN - VIEW_W);
    expect(cameraMinY(PITCH)).toBe(-PITCH_MARGIN);
    expect(cameraMaxY(PITCH)).toBe(PITCH.height + PITCH_MARGIN - VIEW_H);
  });
});

describe('centreCamera', () => {
  it('centres the target in the middle of the pitch', () => {
    const cam = createCamera();
    centreCamera(cam, centerX(PITCH), centerY(PITCH), PITCH);
    expect(cam.x).toBe(centerX(PITCH) - VIEW_W / 2);
    expect(cam.y).toBe(centerY(PITCH) - VIEW_H / 2);
  });

  it('clamps at all four corners, so the camera never leaves the pitch', () => {
    const cam = createCamera();
    centreCamera(cam, 0, 0, PITCH);
    expect(cam.x).toBe(cameraMinX(PITCH));
    expect(cam.y).toBe(cameraMinY(PITCH));
    centreCamera(cam, PITCH.width, PITCH.height, PITCH);
    expect(cam.x).toBe(cameraMaxX(PITCH));
    expect(cam.y).toBe(cameraMaxY(PITCH));
    centreCamera(cam, 0, PITCH.height, PITCH);
    expect(cam.x).toBe(cameraMinX(PITCH));
    expect(cam.y).toBe(cameraMaxY(PITCH));
    centreCamera(cam, PITCH.width, 0, PITCH);
    expect(cam.x).toBe(cameraMaxX(PITCH));
    expect(cam.y).toBe(cameraMinY(PITCH));
  });

  it('does not clamp a target that is comfortably inside', () => {
    const cam = createCamera();
    centreCamera(cam, 700, 500, PITCH);
    expect(cam.x).toBe(700 - VIEW_W / 2);
    expect(cam.y).toBe(500 - VIEW_H / 2);
  });
});

describe('followCamera', () => {
  it('moves a fraction of the way and converges without overshooting', () => {
    const cam = createCamera();
    centreCamera(cam, 600, 650, PITCH);
    const startX = cam.x;
    followCamera(cam, 1400, 650, PITCH, 0.25);
    const wanted = 1400 - VIEW_W / 2;
    expect(cam.x).toBeCloseTo(startX + (wanted - startX) * 0.25, 6);
    for (let i = 0; i < 200; i++) followCamera(cam, 1400, 650, PITCH, 0.25);
    expect(cam.x).toBeCloseTo(wanted, 3);
  });

  it('still clamps: chasing the corner never leaves the pitch', () => {
    const cam = createCamera();
    centreCamera(cam, centerX(PITCH), centerY(PITCH), PITCH);
    for (let i = 0; i < 500; i++) followCamera(cam, PITCH.width, PITCH.height, PITCH, 0.2);
    expect(cam.x).toBeLessThanOrEqual(cameraMaxX(PITCH));
    expect(cam.y).toBeLessThanOrEqual(cameraMaxY(PITCH));
  });
});

describe('world to screen', () => {
  it('subtracts the camera corner', () => {
    const cam = createCamera();
    cam.x = 400;
    cam.y = 250;
    expect(toScreenX(cam, 400)).toBe(0);
    expect(toScreenY(cam, 250)).toBe(0);
    expect(toScreenX(cam, 1200)).toBe(VIEW_W);
    expect(toScreenY(cam, 750)).toBe(VIEW_H);
  });

  it('isOnScreen accepts the margin band and rejects beyond it', () => {
    const cam = createCamera();
    cam.x = 400;
    cam.y = 250;
    expect(isOnScreen(cam, 400 - 20, 250 - 20, 30)).toBe(true);
    expect(isOnScreen(cam, 400 - 40, 250 - 20, 30)).toBe(false);
    expect(isOnScreen(cam, 1200 + 20, 750 + 20, 30)).toBe(true);
    expect(isOnScreen(cam, 1200 + 40, 750 + 20, 30)).toBe(false);
  });
});
```

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run components/games/football-screen/camera.test.ts`
Expected: FAIL — `Failed to resolve import "./camera"`.

- [ ] **Step 3: Escribir `camera.ts`**

```ts
import { clamp } from '../football-logic/geometry';
import type { PitchDef } from '../football-logic/pitch';
import { centerX, centerY } from '../football-logic/pitch';
import type { MatchState } from '../football-logic/match';

// The spec's numbers: a 2000 x 1300 pitch seen through an 800 x 500 window -- 40 % of
// the pitch, and the same canvas size the other thirteen games use.
export const VIEW_W = 800;
export const VIEW_H = 500;
// S-SC6: how much dead ground around the pitch the camera may show, so the two goals
// and the touchlines are not pinned to the very edge of the canvas.
export const PITCH_MARGIN = 60;
// S-SC7: the follow factor per step. 0.12 at 60 Hz settles in about a quarter of a
// second, which reads as "the camera follows the ball" and not as "the ball is glued
// to the middle of the screen".
export const CAMERA_LAG = 0.12;

export type Camera = { x: number; y: number };

export function createCamera(): Camera {
  return { x: 0, y: 0 };
}

export function cameraMinX(pitch: PitchDef): number {
  return -PITCH_MARGIN;
}

export function cameraMaxX(pitch: PitchDef): number {
  return pitch.width + PITCH_MARGIN - VIEW_W;
}

export function cameraMinY(pitch: PitchDef): number {
  return -PITCH_MARGIN;
}

export function cameraMaxY(pitch: PitchDef): number {
  return pitch.height + PITCH_MARGIN - VIEW_H;
}

// Criterion 13: the camera follows the ball WITHOUT leaving the pitch.
export function centreCamera(cam: Camera, x: number, y: number, pitch: PitchDef): void {
  cam.x = clamp(x - VIEW_W / 2, cameraMinX(pitch), cameraMaxX(pitch));
  cam.y = clamp(y - VIEW_H / 2, cameraMinY(pitch), cameraMaxY(pitch));
}

export function followCamera(cam: Camera, x: number, y: number, pitch: PitchDef, lag: number): void {
  const wantX = clamp(x - VIEW_W / 2, cameraMinX(pitch), cameraMaxX(pitch));
  const wantY = clamp(y - VIEW_H / 2, cameraMinY(pitch), cameraMaxY(pitch));
  cam.x += (wantX - cam.x) * lag;
  cam.y += (wantY - cam.y) * lag;
}

// S-SC8: during the shootout the ball sits on the spot of whichever goal the kicking
// team attacks, and stage B2's S-PK8 makes the two goals ALTERNATE. Following the ball
// would be a slow pan across the whole pitch between kicks, so the target is the set
// piece itself and the component CUTS to it instead of panning.
export function cameraTargetX(match: MatchState): number {
  if (match.phase === 'shootout' && match.setPiece !== null) return match.setPiece.x;
  return match.ball.x;
}

export function cameraTargetY(match: MatchState): number {
  if (match.phase === 'shootout' && match.setPiece !== null) return match.setPiece.y;
  return match.ball.y;
}

export function toScreenX(cam: Camera, worldX: number): number {
  return worldX - cam.x;
}

export function toScreenY(cam: Camera, worldY: number): number {
  return worldY - cam.y;
}

// Culling for the eighteen players and the ball: nothing is drawn off the window.
export function isOnScreen(cam: Camera, worldX: number, worldY: number, margin: number): boolean {
  const sx = worldX - cam.x;
  const sy = worldY - cam.y;
  return sx >= -margin && sx <= VIEW_W + margin && sy >= -margin && sy <= VIEW_H + margin;
}
```

Nota para quien ejecute: `cameraMinX`/`cameraMinY` reciben `pitch` sin usarlo a propósito, para que las cuatro funciones de límite tengan la misma firma y el `.tsx` no tenga que recordar cuál la necesita. Si el linter se queja, añadir `void pitch;` como hace `profileFor` en `ai.ts`.

- [ ] **Step 4: Verde**

Run: `npx vitest run components/games/football-screen/camera.test.ts`
Expected: PASS, 9 tests (2 de `camera bounds` + 3 de `centreCamera` + 2 de `followCamera` + 2 de `world to screen`).

- [ ] **Step 5: Escribir el test que falla de `minimap.ts`**

Crear `components/games/football-screen/minimap.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PITCH } from '../football-logic/pitch';
import { VIEW_H, VIEW_W, createCamera } from './camera';
import { MINIMAP_H, MINIMAP_W, createMinimapRect, minimapViewRect, minimapX, minimapY } from './minimap';

describe('minimap projection', () => {
  it('maps the four corners of the pitch onto the four corners of the minimap', () => {
    expect(minimapX(PITCH, 0)).toBe(0);
    expect(minimapY(PITCH, 0)).toBe(0);
    expect(minimapX(PITCH, PITCH.width)).toBe(MINIMAP_W);
    expect(minimapY(PITCH, PITCH.height)).toBe(MINIMAP_H);
  });

  it('maps the centre spot to the centre of the minimap', () => {
    expect(minimapX(PITCH, PITCH.width / 2)).toBe(MINIMAP_W / 2);
    expect(minimapY(PITCH, PITCH.height / 2)).toBe(MINIMAP_H / 2);
  });

  it('keeps a point outside the pitch outside the minimap, without clamping', () => {
    expect(minimapX(PITCH, -100)).toBeLessThan(0);
    expect(minimapY(PITCH, PITCH.height + 100)).toBeGreaterThan(MINIMAP_H);
  });
});

describe('minimapViewRect', () => {
  it('the view rectangle is the camera window in minimap units', () => {
    const cam = createCamera();
    cam.x = 0;
    cam.y = 0;
    const out = createMinimapRect();
    minimapViewRect(cam, PITCH, out);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    expect(out.w).toBeCloseTo((VIEW_W / PITCH.width) * MINIMAP_W, 6);
    expect(out.h).toBeCloseTo((VIEW_H / PITCH.height) * MINIMAP_H, 6);
  });

  it('the rectangle is a real fraction of the minimap, not the whole of it', () => {
    const cam = createCamera();
    const out = createMinimapRect();
    minimapViewRect(cam, PITCH, out);
    expect(out.w).toBeLessThan(MINIMAP_W);
    expect(out.h).toBeLessThan(MINIMAP_H);
  });

  it('moves with the camera', () => {
    const cam = createCamera();
    const out = createMinimapRect();
    cam.x = 600;
    cam.y = 400;
    minimapViewRect(cam, PITCH, out);
    expect(out.x).toBeCloseTo((600 / PITCH.width) * MINIMAP_W, 6);
    expect(out.y).toBeCloseTo((400 / PITCH.height) * MINIMAP_H, 6);
  });
});
```

- [ ] **Step 6: Ver fallar**

Run: `npx vitest run components/games/football-screen/minimap.test.ts`
Expected: FAIL — `Failed to resolve import "./minimap"`.

- [ ] **Step 7: Escribir `minimap.ts`**

```ts
import type { PitchDef } from '../football-logic/pitch';
import { VIEW_H, VIEW_W, type Camera } from './camera';

// Spec: "minimapa con los dieciocho en una esquina". 200 x 130 keeps the 2000 x 1300
// aspect exactly, so the projection is a single scale factor per axis and nothing is
// distorted.
export const MINIMAP_W = 200;
export const MINIMAP_H = 130;
export const MINIMAP_PAD = 12;

// Local coordinates INSIDE the minimap: the component translates once and draws.
// Deliberately unclamped -- a ball that has left the pitch should show outside the
// minimap frame, exactly where it is, and the frame is drawn on top.
export function minimapX(pitch: PitchDef, worldX: number): number {
  return (worldX / pitch.width) * MINIMAP_W;
}

export function minimapY(pitch: PitchDef, worldY: number): number {
  return (worldY / pitch.height) * MINIMAP_H;
}

export type MinimapRect = { x: number; y: number; w: number; h: number };

export function createMinimapRect(): MinimapRect {
  return { x: 0, y: 0, w: 0, h: 0 };
}

// What the camera is currently showing, drawn as a frame on the minimap so the player
// can tell which slice of the pitch is on screen. Writes into out; allocates nothing.
export function minimapViewRect(cam: Camera, pitch: PitchDef, out: MinimapRect): void {
  out.x = minimapX(pitch, cam.x);
  out.y = minimapY(pitch, cam.y);
  out.w = (VIEW_W / pitch.width) * MINIMAP_W;
  out.h = (VIEW_H / pitch.height) * MINIMAP_H;
}
```

- [ ] **Step 8: Verde, suite y motor intacto**

Run: `npx vitest run && npx tsc --noEmit && git diff --stat 09a6001 -- components/games/football-logic/ && grep -rn "Math.random" components/games/football-screen/`
Expected: **955 tests en 56 ficheros** (940 + 9 de `camera` + 6 de `minimap`), `tsc` limpio, las dos últimas salidas vacías. **Contar el real y anotarlo en el ledger**; la puerta que importa es que ninguno de los 916 anteriores se ponga rojo.

- [ ] **Step 9: Proponer commit**

Mensaje propuesto: `feat(world-cup): ball-following camera with pitch clamping and minimap projection`

**QA de Paco para esta tarea:** ninguno todavía.



---

## Task 8-3: `football-screen/hud.ts` y `captions.ts` — el marcador, el reloj y los rótulos

Esta es la tarea donde se cobra el **mapa de lectura del HUD** del informe final de la etapa B2 (§8) y los gates 3 y 4 del de la etapa B. Todo lo que allí se describe como trampa se convierte aquí en una función pura con su test.

**Files:**
- Create: `components/games/football-screen/hud.ts`, `components/games/football-screen/hud.test.ts`
- Create: `components/games/football-screen/captions.ts`, `components/games/football-screen/captions.test.ts`

**Interfaces:**
- Consumes: `football-logic/clock.ts` (`HALF_SECONDS`, `HALF_STEPS`, `EXTRA_TIME_STEPS`, `STEPS_PER_SECOND`, `stepsFor`), `football-logic/match.ts` (`MatchState`, `MatchPhase`, `GOAL_PAUSE_STEPS`, `HALF_TIME_PAUSE_STEPS`, `winnerOf`, `createMatch`), `football-logic/referee.ts` (`CallKind`, solo tipo), `football-logic/set-pieces.ts` (`ShootoutState`, `SHOOTOUT_ROUNDS`), `football-logic/teams.ts` (`TEAM_SIZE`, `TEAMS`, `FORMATIONS`), `football-logic/players.ts` (`PlayerState`, `SPRINT_STEPS`, `SPRINT_COOLDOWN_STEPS`), `football-logic/actions.ts` (`SHOT_CHARGE_STEPS`), `football-logic/ai.ts` (`profileFor`, `humanProfile`).
- Produces:

```ts
// hud.ts
export const CLOCK_TEXT: readonly string[];         // index = seconds, 0..HALF_SECONDS
export const SMALL_NUMBER_TEXT: readonly string[];  // '0'..'99', for the score and the countdown
export function halfCapSteps(half: 1 | 2 | 3): number;
export function clockSteps(match: MatchState): number;
export function clockSeconds(match: MatchState): number;
export function clockText(match: MatchState): string;
export function halfLabel(match: MatchState): string;
export function countdownSeconds(stepsLeft: number): number;
export function smallNumber(n: number): string;
export function cursorPlayerId(match: MatchState, team: 0 | 1): number;
export function keeperHoldsBall(match: MatchState, team: 0 | 1): boolean;
export function buttonsIdle(match: MatchState): boolean;
export function shootoutRoundLabel(sh: ShootoutState): string;
export function shootoutKicksTaken(sh: ShootoutState, team: 0 | 1): number;
export const SHOT_CHARGE_SEGMENTS = 3;                      // R33
export function chargeSegments(chargeSteps: number): 0 | 1 | 2 | 3;
export function sprintBarFraction(p: PlayerState): number;

// captions.ts
export type CaptionKind =
  | 'kickoff' | 'foul' | 'penalty' | 'out' | 'corner' | 'goal'
  | 'half-time' | 'extra-time' | 'shootout' | 'shootout-goal' | 'shootout-miss'
  | 'full-time' | 'winner' | 'eliminated' | 'draw';
export const CAPTION_TEXT: Readonly<Record<CaptionKind, string>>;
export const CAPTION_STEPS: Readonly<Record<CaptionKind, number>>;
export const CAPTION_QUEUE_MAX = 4;
export type CaptionState = { kind: CaptionKind | 'none'; stepsLeft: number; queue: CaptionKind[]; queueLen: number };
export function createCaptionState(): CaptionState;
export function pushCaption(cs: CaptionState, kind: CaptionKind): void;
export function stepCaption(cs: CaptionState): void;
export type MatchWatch = {
  started: boolean; phase: MatchPhase; half: 1 | 2 | 3;
  score0: number; score1: number;
  taken0: number; taken1: number; scored0: number; scored1: number;
  call: CallKind;   // the referee call of the PREVIOUS step: it is a level, not an edge
};
export function createMatchWatch(): MatchWatch;
export function collectCaptions(match: MatchState, w: MatchWatch, humanTeam: 0 | 1, cs: CaptionState): void;
export function updateWatch(match: MatchState, w: MatchWatch): void;
```

- [ ] **Step 1: Escribir el test que falla de `hud.ts`**

Crear `components/games/football-screen/hud.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EXTRA_TIME_STEPS, HALF_STEPS, STEPS_PER_SECOND } from '../football-logic/clock';
import { createMatch, type MatchState } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { FORMATIONS, TEAMS, TEAM_SIZE } from '../football-logic/teams';
import { humanProfile, profileFor } from '../football-logic/ai';
import { SHOT_CHARGE_STEPS } from '../football-logic/actions';
import { SHOOTOUT_ROUNDS, createShootoutState } from '../football-logic/set-pieces';
import {
  SHOT_CHARGE_SEGMENTS, buttonsIdle, chargeSegments, clockSeconds, clockSteps, clockText,
  countdownSeconds, cursorPlayerId, halfCapSteps, halfLabel, keeperHoldsBall, shootoutKicksTaken,
  shootoutRoundLabel, smallNumber, sprintBarFraction,
} from './hud';

function newMatch(): MatchState {
  return createMatch(
    [TEAMS[0], TEAMS[1]],
    FORMATIONS,
    PITCH,
    [humanProfile(TEAMS[0], 5), profileFor(TEAMS[1], 5)],
  );
}

describe('the clock', () => {
  it('caps at the half in halves 1 and 2 and at the extra time in half 3', () => {
    expect(halfCapSteps(1)).toBe(HALF_STEPS);
    expect(halfCapSteps(2)).toBe(HALF_STEPS);
    expect(halfCapSteps(3)).toBe(EXTRA_TIME_STEPS);
  });

  it('does NOT clip one step below the cap', () => {
    const m = newMatch();
    m.half = 3;
    m.halfStep = EXTRA_TIME_STEPS - 1;
    expect(clockSteps(m)).toBe(EXTRA_TIME_STEPS - 1);
  });

  it('clips the overshoot of an extra time that ran out during a countdown', () => {
    // Stage B2, probe P5b: measured at 3901 steps / 65.02 s. Without the clamp the
    // HUD would print 65 s of a 60 s extra time.
    const m = newMatch();
    m.half = 3;
    m.halfStep = EXTRA_TIME_STEPS + 301;
    expect(clockSteps(m)).toBe(EXTRA_TIME_STEPS);
    expect(clockSeconds(m)).toBe(60);
  });

  it('freezes during the shootout instead of counting on', () => {
    // The clamp is what freezes it: the engine stops calling advanceClock when the
    // shootout starts, but halfStep can still be sitting ABOVE the cap (an extra
    // time that ran out mid-countdown, probe P5b). Ten extra seconds of halfStep
    // must not move the HUD. Asserting on stepCount instead would be a tautology --
    // clockText reads half and halfStep, never stepCount, in any implementation.
    const m = newMatch();
    m.half = 3;
    m.phase = 'shootout';
    m.halfStep = EXTRA_TIME_STEPS;
    const before = clockText(m);
    m.halfStep += 600;
    expect(clockText(m)).toBe(before);
    expect(before).toBe('1:00');
  });

  it('formats minutes and seconds', () => {
    const m = newMatch();
    m.halfStep = 0;
    expect(clockText(m)).toBe('0:00');
    m.halfStep = STEPS_PER_SECOND * 7;
    expect(clockText(m)).toBe('0:07');
    m.halfStep = STEPS_PER_SECOND * 65;
    expect(clockText(m)).toBe('1:05');
    m.halfStep = HALF_STEPS;
    expect(clockText(m)).toBe('1:30');
  });
});

describe('halfLabel', () => {
  it('names the three halves and the two special phases', () => {
    const m = newMatch();
    expect(halfLabel(m)).toBe('1ª PARTE');
    m.half = 2;
    expect(halfLabel(m)).toBe('2ª PARTE');
    m.half = 3;
    expect(halfLabel(m)).toBe('PRÓRROGA');
    m.phase = 'shootout';
    expect(halfLabel(m)).toBe('PENALTIS');
    m.phase = 'half-time';
    m.half = 2;
    expect(halfLabel(m)).toBe('DESCANSO');
  });
});

describe('countdownSeconds', () => {
  it('rounds up so the last fraction of a second still shows 1', () => {
    expect(countdownSeconds(STEPS_PER_SECOND * 5)).toBe(5);
    expect(countdownSeconds(STEPS_PER_SECOND * 4 + 1)).toBe(5);
    expect(countdownSeconds(1)).toBe(1);
    expect(countdownSeconds(0)).toBe(0);
    expect(countdownSeconds(-3)).toBe(0);
  });
});

describe('smallNumber', () => {
  it('returns table entries, never a freshly built string', () => {
    expect(smallNumber(0)).toBe('0');
    expect(smallNumber(7)).toBe('7');
    expect(smallNumber(99)).toBe('99');
    expect(smallNumber(3)).toBe('3');
    // Same reference twice: nothing is allocated per frame.
    expect(smallNumber(4)).toBe(smallNumber(4));
  });

  it('clamps out-of-range values instead of returning undefined', () => {
    expect(smallNumber(-1)).toBe('0');
    expect(smallNumber(1000)).toBe('99');
  });
});

describe('the cursor', () => {
  it('follows the derived controlled player in open play', () => {
    const m = newMatch();
    m.controlled[0] = 4;
    m.ball.owner = null;
    expect(cursorPlayerId(m, 0)).toBe(4);
    expect(keeperHoldsBall(m, 0)).toBe(false);
  });

  it('moves onto the keeper while the keeper holds the ball (S-GK.6 / gate 3)', () => {
    // The engine deliberately leaves match.controlled on a field player during the
    // keeper's 2 s (stage B report §8 gate 3). Two seconds of a cursor on a player
    // who does not obey the d-pad reads as a bug, so the screen moves it.
    const m = newMatch();
    m.controlled[0] = 4;
    m.ball.owner = 0 * TEAM_SIZE;
    expect(keeperHoldsBall(m, 0)).toBe(true);
    expect(cursorPlayerId(m, 0)).toBe(0 * TEAM_SIZE);
    // The rival team is unaffected.
    m.controlled[1] = TEAM_SIZE + 3;
    expect(cursorPlayerId(m, 1)).toBe(TEAM_SIZE + 3);
  });
});

describe('buttonsIdle (gate 4)', () => {
  it('is true in every phase where stepSetPiece swallows A and B', () => {
    const m = newMatch();
    for (const phase of ['kickoff', 'set-piece', 'shootout', 'goal', 'half-time'] as const) {
      m.phase = phase;
      expect(buttonsIdle(m)).toBe(true);
    }
  });

  it('is false in open play, in the golden goal and once the match is over', () => {
    const m = newMatch();
    for (const phase of ['play', 'golden-goal', 'over'] as const) {
      m.phase = phase;
      expect(buttonsIdle(m)).toBe(false);
    }
  });
});

describe('the shootout scoreboard', () => {
  it('counts the kicks of the five and then says sudden death', () => {
    const sh = createShootoutState();
    sh.taken[0] = 0;
    sh.taken[1] = 0;
    expect(shootoutRoundLabel(sh)).toBe('TANDA 1/5');
    sh.taken[0] = 2;
    sh.taken[1] = 2;
    expect(shootoutRoundLabel(sh)).toBe('TANDA 3/5');
    sh.taken[0] = SHOOTOUT_ROUNDS;
    sh.taken[1] = SHOOTOUT_ROUNDS;
    sh.suddenDeath = true;
    expect(shootoutRoundLabel(sh)).toBe('MUERTE SÚBITA');
  });

  it('reads the shootout counters and never the match score', () => {
    const sh = createShootoutState();
    sh.taken[0] = 3;
    sh.taken[1] = 2;
    expect(shootoutKicksTaken(sh, 0)).toBe(3);
    expect(shootoutKicksTaken(sh, 1)).toBe(2);
  });
});

describe('the shot charge notches (R33)', () => {
  it('has exactly three notches', () => {
    expect(SHOT_CHARGE_SEGMENTS).toBe(3);
    expect(SHOT_CHARGE_STEPS).toBe(60);
  });

  // R33 (Paco, 07-sep): three notches, not a continuous bar. The borders are what
  // makes a notch mean something: 59 steps is still TWO, and only a full charge
  // lights the third -- the difference between a ~825 shot and a 950 one.
  it('lights zero, one, two or three notches at the engine ramp borders', () => {
    expect(chargeSegments(0)).toBe(0);
    expect(chargeSegments(-1)).toBe(0);
    expect(chargeSegments(1)).toBe(1);
    expect(chargeSegments(SHOT_CHARGE_STEPS / 2 - 1)).toBe(1);   // 29
    expect(chargeSegments(SHOT_CHARGE_STEPS / 2)).toBe(2);       // 30
    expect(chargeSegments(SHOT_CHARGE_STEPS - 1)).toBe(2);       // 59
    expect(chargeSegments(SHOT_CHARGE_STEPS)).toBe(3);           // 60
    expect(chargeSegments(600)).toBe(3);
  });

  it('reads the player the engine is charging', () => {
    const m = newMatch();
    const p = m.players[3];
    p.chargeSteps = 0;
    expect(chargeSegments(p.chargeSteps)).toBe(0);
    p.chargeSteps = SHOT_CHARGE_STEPS;
    expect(chargeSegments(p.chargeSteps)).toBe(SHOT_CHARGE_SEGMENTS);
  });
});

describe('the sprint bar', () => {
  it('is full when rested and empty at the end of the burst', () => {
    const m = newMatch();
    const p = m.players[3];
    p.sprintStepsLeft = 0;
    p.sprintCooldownSteps = 0;
    expect(sprintBarFraction(p)).toBe(1);
    p.sprintCooldownSteps = 90;
    expect(sprintBarFraction(p)).toBeLessThan(1);
    p.sprintCooldownSteps = 0;
    p.sprintStepsLeft = 1;
    expect(sprintBarFraction(p)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run components/games/football-screen/hud.test.ts`
Expected: FAIL — `Failed to resolve import "./hud"`.

- [ ] **Step 3: Escribir `hud.ts`**

```ts
import {
  EXTRA_TIME_STEPS, HALF_SECONDS, HALF_STEPS, STEPS_PER_SECOND,
} from '../football-logic/clock';
import { SHOT_CHARGE_STEPS } from '../football-logic/actions';
import type { MatchState } from '../football-logic/match';
import { SHOOTOUT_ROUNDS, type ShootoutState } from '../football-logic/set-pieces';
import { SPRINT_COOLDOWN_STEPS, SPRINT_STEPS, type PlayerState } from '../football-logic/players';
import { TEAM_SIZE } from '../football-logic/teams';

// Precomputed string tables (the TIMER_TEXT pattern of KongGame/VaultFighterGame):
// draw() must never build a string. HALF_SECONDS (90) is the longest clock the HUD
// can show, and it also covers the 60 s extra time.
function buildClockText(): string[] {
  const out: string[] = [];
  for (let s = 0; s <= HALF_SECONDS; s++) {
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    out.push(`${mm}:${ss < 10 ? '0' : ''}${ss}`);
  }
  return out;
}
export const CLOCK_TEXT: readonly string[] = buildClockText();

function buildSmallNumbers(): string[] {
  const out: string[] = [];
  for (let n = 0; n <= 99; n++) out.push(String(n));
  return out;
}
export const SMALL_NUMBER_TEXT: readonly string[] = buildSmallNumbers();

export function smallNumber(n: number): string {
  if (n <= 0) return SMALL_NUMBER_TEXT[0];
  if (n >= 99) return SMALL_NUMBER_TEXT[99];
  return SMALL_NUMBER_TEXT[n | 0];
}

export function halfCapSteps(half: 1 | 2 | 3): number {
  return half === 3 ? EXTRA_TIME_STEPS : HALF_STEPS;
}

// Stage B2 final report §8, first row of the HUD reading map: the clock MUST be
// clamped. The cap is only read from open play, so an extra time that runs out
// during a set-piece countdown leaves halfStep above it (measured: up to 301 steps
// over, 65.02 s of a 60 s extra time). This is not an engine bug -- the two
// regulation halves have exactly the same shape -- the fix belongs here.
export function clockSteps(match: MatchState): number {
  const cap = halfCapSteps(match.half);
  return match.halfStep < cap ? match.halfStep : cap;
}

export function clockSeconds(match: MatchState): number {
  const s = Math.floor(clockSteps(match) / STEPS_PER_SECOND);
  return s > HALF_SECONDS ? HALF_SECONDS : s;
}

export function clockText(match: MatchState): string {
  return CLOCK_TEXT[clockSeconds(match)];
}

// Stage B2 §8: during the shootout halfStep and clockMs stay FROZEN at the value
// they were entered with, so nothing special is needed to stop the clock -- but the
// label has to say what is happening.
export function halfLabel(match: MatchState): string {
  if (match.phase === 'shootout') return 'PENALTIS';
  if (match.phase === 'half-time') return 'DESCANSO';
  if (match.half === 3) return 'PRÓRROGA';
  return match.half === 1 ? '1ª PARTE' : '2ª PARTE';
}

export function countdownSeconds(stepsLeft: number): number {
  if (stepsLeft <= 0) return 0;
  return Math.ceil(stepsLeft / STEPS_PER_SECOND);
}

export function keeperHoldsBall(match: MatchState, team: 0 | 1): boolean {
  return match.ball.owner === team * TEAM_SIZE;
}

// S-SC3, closing gate 3 of the stage B report: the engine leaves match.controlled on
// a field player during the keeper's two seconds (S-GK.6) and exposes ball.owner so
// the screen can decide. It decides here: the cursor goes where the d-pad goes.
export function cursorPlayerId(match: MatchState, team: 0 | 1): number {
  return keeperHoldsBall(match, team) ? team * TEAM_SIZE : match.controlled[team];
}

// Gate 4 of the stage B report: during a set-piece countdown stepSetPiece reads only
// input.dx/dy -- A and B are swallowed. The HUD says so, or the player hammers the
// buttons believing they are broken.
export function buttonsIdle(match: MatchState): boolean {
  const p = match.phase;
  return p === 'kickoff' || p === 'set-piece' || p === 'shootout' || p === 'goal' || p === 'half-time';
}

export function shootoutKicksTaken(sh: ShootoutState, team: 0 | 1): number {
  return sh.taken[team];
}

export function shootoutRoundLabel(sh: ShootoutState): string {
  if (sh.suddenDeath) return 'MUERTE SÚBITA';
  const taken = sh.taken[0] < sh.taken[1] ? sh.taken[0] : sh.taken[1];
  const round = taken + 1;
  return round > SHOOTOUT_ROUNDS ? 'MUERTE SÚBITA' : `TANDA ${round}/${SHOOTOUT_ROUNDS}`;
}

// R33 (Paco, 07-sep), replacing the continuous bar of the first draft of S-SC4:
// THREE notches, drawn next to the controlled player, not a bar in the HUD. The
// thresholds are the engine's own ramp (actions.ts: shotSpeed goes 700 -> 950 over
// SHOT_CHARGE_STEPS = 60), so a notch always means the same shot: 1 = tap (700),
// 2 = half (~825), 3 = full (950). Reading SHOT_CHARGE_STEPS instead of a literal 60
// is what keeps the notches and the shot from ever disagreeing.
export const SHOT_CHARGE_SEGMENTS = 3;

export function chargeSegments(chargeSteps: number): 0 | 1 | 2 | 3 {
  if (chargeSteps <= 0) return 0;
  if (chargeSteps >= SHOT_CHARGE_STEPS) return 3;
  return chargeSteps >= SHOT_CHARGE_STEPS / 2 ? 2 : 1;
}

// One bar for the burst and its recovery (spec: 2 s of sprint, 3 s of cooldown):
// full when rested, draining while sprinting, refilling while recovering.
export function sprintBarFraction(p: PlayerState): number {
  if (p.sprintStepsLeft > 0) return p.sprintStepsLeft / SPRINT_STEPS;
  if (p.sprintCooldownSteps > 0) return 1 - p.sprintCooldownSteps / SPRINT_COOLDOWN_STEPS;
  return 1;
}
```

Nota: `shootoutRoundLabel` construye una plantilla de string. **No se llama por frame**: el componente la cachea y solo la recalcula cuando cambia `sh.taken[0] + sh.taken[1]` (paso 8-5). Comprobarlo en la lectura de asignaciones del cierre.

- [ ] **Step 4: Verde**

Run: `npx vitest run components/games/football-screen/hud.test.ts`
Expected: PASS, 19 tests.
Si falla el test de `sprintBarFraction`, comprobar el nombre real de la constante en `players.ts` (`SPRINT_COOLDOWN_STEPS`) antes de tocar el test.

- [ ] **Step 5: Escribir el test que falla de `captions.ts`**

Crear `components/games/football-screen/captions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMatch, type MatchState } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { FORMATIONS, TEAMS } from '../football-logic/teams';
import { humanProfile, profileFor } from '../football-logic/ai';
import { createShootoutState } from '../football-logic/set-pieces';
import {
  CAPTION_QUEUE_MAX, CAPTION_STEPS, CAPTION_TEXT, collectCaptions, createCaptionState,
  createMatchWatch, pushCaption, stepCaption, updateWatch, type CaptionKind,
} from './captions';

function newMatch(): MatchState {
  return createMatch(
    [TEAMS[0], TEAMS[1]],
    FORMATIONS,
    PITCH,
    [humanProfile(TEAMS[0], 5), profileFor(TEAMS[1], 5)],
  );
}

describe('CAPTION_TEXT', () => {
  it('carries the seven captions the spec names, plus the extra-time pair', () => {
    expect(CAPTION_TEXT.kickoff).toBe('INICIO');
    expect(CAPTION_TEXT.foul).toBe('FALTA');
    expect(CAPTION_TEXT.penalty).toBe('PENALTI');
    expect(CAPTION_TEXT.out).toBe('FUERA');
    expect(CAPTION_TEXT.corner).toBe('CÓRNER');
    expect(CAPTION_TEXT.goal).toBe('GOL');
    expect(CAPTION_TEXT['full-time']).toBe('FINAL');
    expect(CAPTION_TEXT['extra-time']).toBe('PRÓRROGA');
    expect(CAPTION_TEXT.shootout).toBe('PENALTIS');
    expect(CAPTION_TEXT.eliminated).toBe('ELIMINADO');
    expect(CAPTION_TEXT.draw).toBe('EMPATE');
  });

  it('every caption has a positive duration', () => {
    for (const key of Object.keys(CAPTION_TEXT) as CaptionKind[]) {
      expect(CAPTION_STEPS[key]).toBeGreaterThan(0);
    }
  });
});

describe('the caption queue', () => {
  it('shows the first caption straight away and queues the next', () => {
    const cs = createCaptionState();
    expect(cs.kind).toBe('none');
    pushCaption(cs, 'goal');
    expect(cs.kind).toBe('goal');
    expect(cs.stepsLeft).toBe(CAPTION_STEPS.goal);
    pushCaption(cs, 'full-time');
    expect(cs.kind).toBe('goal');
    expect(cs.queueLen).toBe(1);
  });

  it('pops the queue when the current caption runs out', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'foul');
    pushCaption(cs, 'penalty');
    for (let i = 0; i < CAPTION_STEPS.foul; i++) stepCaption(cs);
    expect(cs.kind).toBe('penalty');
    expect(cs.queueLen).toBe(0);
    for (let i = 0; i < CAPTION_STEPS.penalty; i++) stepCaption(cs);
    expect(cs.kind).toBe('none');
  });

  it('does not queue the caption that is already showing', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'goal');
    pushCaption(cs, 'goal');
    expect(cs.queueLen).toBe(0);
  });

  it('drops what does not fit instead of growing the array', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'goal');
    for (let i = 0; i < 20; i++) pushCaption(cs, i % 2 === 0 ? 'foul' : 'corner');
    // Fixed-length array, never grown: the length is the constant it was built with,
    // not "whatever it happens to be".
    expect(cs.queue.length).toBe(CAPTION_QUEUE_MAX);
    expect(cs.queueLen).toBeLessThanOrEqual(CAPTION_QUEUE_MAX);
  });

  // The end of the match is a QUEUE, not a single caption: collectCaptions leaves
  // FINAL showing with GANADOR / ELIMINADO / EMPATE waiting behind it. If the
  // component stops stepping the queue when the match ends, the screen freezes on
  // FINAL and the result is never drawn (R32) -- that is what loop.ts's
  // frameMode('over', …) === 'captions-only' exists to prevent.
  it('the result caption replaces FINAL when the queue keeps being stepped', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'full-time');
    pushCaption(cs, 'winner');
    expect(cs.kind).toBe('full-time');
    for (let i = 0; i < CAPTION_STEPS['full-time']; i++) stepCaption(cs);
    expect(cs.kind).toBe('winner');
    expect(cs.queueLen).toBe(0);
  });
});

describe('collectCaptions', () => {
  it('fires INICIO on the very first look at the match, and not again next step', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    expect(cs.kind).toBe('kickoff');
    updateWatch(m, w);
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('none');
  });

  it('fires GOL when the score goes up, and only on that step', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);
    m.score[0] = 1;
    m.phase = 'goal';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('goal');
    updateWatch(m, w);
    const cs3 = createCaptionState();
    collectCaptions(m, w, 0, cs3);
    expect(cs3.kind).toBe('none');
  });

  it('turns a referee call into its caption', () => {
    const cases: [string, CaptionKind][] = [
      ['free-kick', 'foul'],
      ['penalty', 'penalty'],
      ['corner', 'corner'],
      ['throw-in', 'out'],
      ['goal-kick', 'out'],
    ];
    for (const [kind, caption] of cases) {
      const m = newMatch();
      const w = createMatchWatch();
      const cs = createCaptionState();
      collectCaptions(m, w, 0, cs);
      updateWatch(m, w);
      m.phase = 'set-piece';
      m.scratch.call.kind = kind as MatchState['scratch']['call']['kind'];
      const cs2 = createCaptionState();
      collectCaptions(m, w, 0, cs2);
      expect(cs2.kind).toBe(caption);
    }
  });

  // MEASURED (preflight 07-sep, three full CPU-vs-CPU matches, seeds 7/11/23):
  // scratch.call is a LEVEL, not an edge. clearRefereeCall only runs inside
  // stepOpenPlay and stepShootout, so the 'kickoff' / 'set-piece' / 'goal' /
  // 'half-time' phases leave it standing -- 301 steps for a restart, 421 for a goal,
  // with no variance between seeds. Without an edge detector the FALTA caption is
  // re-pushed the instant its 90 steps run out, with its whistle again, three or
  // four times per foul. This is the "step after" half of the anti-coincidence rule
  // of the Global Constraints, which every other call had missing.
  it('fires FALTA on the step the call appears and NOT on the next one, with the call still standing', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);

    m.phase = 'set-piece';
    m.scratch.call.kind = 'free-kick';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('foul');
    updateWatch(m, w);

    // The engine has NOT cleared the call: same kind, next step.
    const cs3 = createCaptionState();
    collectCaptions(m, w, 0, cs3);
    expect(cs3.kind).toBe('none');
    updateWatch(m, w);

    // And it fires again once the call really is a new one.
    m.scratch.call.kind = 'corner';
    const cs4 = createCaptionState();
    collectCaptions(m, w, 0, cs4);
    expect(cs4.kind).toBe('corner');
  });

  // H7: endHalf on a LEVEL second half sets half = 3 and calls startKickoff in the
  // same step (match.ts), so the half edge and the kickoff phase edge arrive
  // together. Both captions map to whistle_start, which would blow two start
  // whistles three seconds apart. PRÓRROGA wins: it says more and it whistles once.
  it('does not stack INICIO on top of PRÓRROGA when the extra time starts', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);

    m.phase = 'play';
    updateWatch(m, w);

    m.half = 3;
    m.phase = 'kickoff';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('extra-time');
    expect(cs2.queueLen).toBe(0);
  });

  it('IGNORES the phantom restart call of the shootout (stage B2 carry #3)', () => {
    // judgeShootoutKick leaves a one-step 'throw-in' in scratch.call when a kick
    // leaves the field. It is not a real restart and must not print FUERA.
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    updateWatch(m, w);
    m.scratch.call.kind = 'throw-in';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('none');
  });

  it('fires PRÓRROGA when the half becomes 3 and PENALTIS when the shootout starts', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);

    m.half = 3;
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('extra-time');
    updateWatch(m, w);

    m.phase = 'shootout';
    m.shootout = createShootoutState();
    const cs3 = createCaptionState();
    collectCaptions(m, w, 0, cs3);
    expect(cs3.kind).toBe('shootout');
  });

  it('tells a shootout goal from a shootout miss by the two counters', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);

    m.shootout.taken[0] = 1;
    m.shootout.scored[0] = 1;
    const csGoal = createCaptionState();
    collectCaptions(m, w, 0, csGoal);
    expect(csGoal.kind).toBe('shootout-goal');
    updateWatch(m, w);

    m.shootout.taken[1] = 1;
    const csMiss = createCaptionState();
    collectCaptions(m, w, 0, csMiss);
    expect(csMiss.kind).toBe('shootout-miss');
  });

  it('ends with FINAL and then the result, from the human team point of view', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);

    m.score[0] = 2;
    m.score[1] = 1;
    m.phase = 'over';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('goal');
    expect(cs2.queueLen).toBe(2);
    expect(cs2.queue[0]).toBe('full-time');
    expect(cs2.queue[1]).toBe('winner');
  });

  it('says ELIMINADO when the human loses', () => {
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);
    m.score[1] = 1;
    m.phase = 'over';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.queue[cs2.queueLen - 1]).toBe('eliminated');
  });

  it('says EMPATE, never GANADOR nor ELIMINADO, when the match was abandoned with no winner', () => {
    // Stage B2 §8: winnerOf can return -1 with the match over (abandon inside the
    // shootout). S-SC12 (confirmed by owner 2026-09-07): that is the only draw this
    // ruleset has, and it gets its own caption instead of silence.
    const m = newMatch();
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);
    m.phase = 'over';
    const cs2 = createCaptionState();
    collectCaptions(m, w, 0, cs2);
    expect(cs2.kind).toBe('full-time');
    expect(cs2.queueLen).toBe(1);
    expect(cs2.queue[0]).toBe('draw');
  });
});
```

- [ ] **Step 6: Ver fallar**

Run: `npx vitest run components/games/football-screen/captions.test.ts`
Expected: FAIL — `Failed to resolve import "./captions"`.

- [ ] **Step 7: Escribir `captions.ts`**

```ts
import { stepsFor } from '../football-logic/clock';
import {
  GOAL_PAUSE_STEPS, HALF_TIME_PAUSE_STEPS, winnerOf,
  type MatchPhase, type MatchState,
} from '../football-logic/match';
import type { CallKind } from '../football-logic/referee';

// Spec: the seven captions of the v1 (INICIO, FALTA, PENALTI, FUERA, CÓRNER, GOL,
// FINAL), plus the two the 06-sep decision added (PRÓRROGA, PENALTIS), plus the pair
// that closes a match (GANADOR / ELIMINADO -- a caption over the pitch, never a
// screen of its own; the victory screens are Task 9). No referee is drawn in the v1.
export type CaptionKind =
  | 'kickoff' | 'foul' | 'penalty' | 'out' | 'corner' | 'goal'
  | 'half-time' | 'extra-time' | 'shootout' | 'shootout-goal' | 'shootout-miss'
  | 'full-time' | 'winner' | 'eliminated' | 'draw';

export const CAPTION_TEXT: Readonly<Record<CaptionKind, string>> = {
  kickoff: 'INICIO',
  foul: 'FALTA',
  penalty: 'PENALTI',
  out: 'FUERA',
  corner: 'CÓRNER',
  goal: 'GOL',
  // S-SC9: the spec's list has no caption for the break, but the audio table does
  // whistle at the end of every half, and a silent three-second freeze reads as a
  // hang. DESCANSO is the smallest thing that explains it.
  'half-time': 'DESCANSO',
  'extra-time': 'PRÓRROGA',
  shootout: 'PENALTIS',
  'shootout-goal': 'GOL',
  'shootout-miss': 'FALLA',
  'full-time': 'FINAL',
  winner: 'GANADOR',
  eliminated: 'ELIMINADO',
  // S-SC12 (confirmed by owner 2026-09-07): the only way a friendly ends without a
  // winner is abandon() tripping inside the shootout (viewport guard) -- there is no
  // other draw in this ruleset (S-PK5: sudden death always produces a winner).
  draw: 'EMPATE',
};

const SHORT_CAPTION_STEPS = stepsFor(1.5);
const RESULT_CAPTION_STEPS = stepsFor(3);

// The captions that cover an engine pause last exactly as long as the pause, so the
// screen never freezes with nothing written on it.
export const CAPTION_STEPS: Readonly<Record<CaptionKind, number>> = {
  kickoff: SHORT_CAPTION_STEPS,
  foul: SHORT_CAPTION_STEPS,
  penalty: SHORT_CAPTION_STEPS,
  out: SHORT_CAPTION_STEPS,
  corner: SHORT_CAPTION_STEPS,
  goal: GOAL_PAUSE_STEPS,
  'half-time': HALF_TIME_PAUSE_STEPS,
  'extra-time': RESULT_CAPTION_STEPS,
  shootout: RESULT_CAPTION_STEPS,
  'shootout-goal': SHORT_CAPTION_STEPS,
  'shootout-miss': SHORT_CAPTION_STEPS,
  'full-time': RESULT_CAPTION_STEPS,
  winner: RESULT_CAPTION_STEPS,
  eliminated: RESULT_CAPTION_STEPS,
  draw: RESULT_CAPTION_STEPS,
};

// Four is enough for the worst chain the engine can produce in one step: a golden
// goal is GOL + FINAL + GANADOR, and a shootout kick that ends the match is
// GOL + FINAL + GANADOR too.
export const CAPTION_QUEUE_MAX = 4;

export type CaptionState = {
  kind: CaptionKind | 'none';
  stepsLeft: number;
  queue: CaptionKind[];
  queueLen: number;
};

export function createCaptionState(): CaptionState {
  const queue: CaptionKind[] = [];
  for (let i = 0; i < CAPTION_QUEUE_MAX; i++) queue.push('kickoff');
  return { kind: 'none', stepsLeft: 0, queue, queueLen: 0 };
}

export function pushCaption(cs: CaptionState, kind: CaptionKind): void {
  if (cs.kind === 'none') {
    cs.kind = kind;
    cs.stepsLeft = CAPTION_STEPS[kind];
    return;
  }
  if (cs.kind === kind) return;
  if (cs.queueLen > 0 && cs.queue[cs.queueLen - 1] === kind) return;
  if (cs.queueLen >= CAPTION_QUEUE_MAX) return;
  cs.queue[cs.queueLen] = kind;
  cs.queueLen++;
}

export function stepCaption(cs: CaptionState): void {
  if (cs.kind === 'none') return;
  cs.stepsLeft--;
  if (cs.stepsLeft > 0) return;
  if (cs.queueLen === 0) {
    cs.kind = 'none';
    cs.stepsLeft = 0;
    return;
  }
  cs.kind = cs.queue[0];
  cs.stepsLeft = CAPTION_STEPS[cs.kind];
  for (let i = 1; i < cs.queueLen; i++) cs.queue[i - 1] = cs.queue[i];
  cs.queueLen--;
}

// Everything the detector needs from the PREVIOUS step, in scalars: no snapshot, no
// allocation. Stage B2 §8: a shootout kick is resolved by `taken` changing, and it
// was a goal if `scored` changed with it.
export type MatchWatch = {
  started: boolean;
  phase: MatchPhase;
  half: 1 | 2 | 3;
  score0: number;
  score1: number;
  taken0: number;
  taken1: number;
  scored0: number;
  scored1: number;
  // MEASURED (preflight 07-sep): scratch.call is a LEVEL that stands for 301 steps
  // on a restart and 421 on a goal, because clearRefereeCall only runs inside
  // stepOpenPlay and stepShootout. Remembering it here is what turns it into the
  // one-step edge the screen and the audio both assume it already is.
  call: CallKind;
};

export function createMatchWatch(): MatchWatch {
  return {
    started: false, phase: 'kickoff', half: 1,
    score0: 0, score1: 0, taken0: 0, taken1: 0, scored0: 0, scored1: 0,
    call: 'none',
  };
}

export function collectCaptions(match: MatchState, w: MatchWatch, humanTeam: 0 | 1, cs: CaptionState): void {
  if (!w.started) {
    pushCaption(cs, 'kickoff');
    return;
  }
  // 1. The goal first: scoreGoal moves the phase in the SAME step, so a phase-based
  //    rule would swallow it.
  if (match.score[0] > w.score0 || match.score[1] > w.score1) pushCaption(cs, 'goal');

  // 2. The shootout, read the way the stage B2 report prescribes: `taken` is the only
  //    reliable signal for BOTH outcomes, and `scored` separates them.
  const sh = match.shootout;
  if (sh !== null && (sh.taken[0] !== w.taken0 || sh.taken[1] !== w.taken1)) {
    const scoredNow = sh.scored[0] !== w.scored0 || sh.scored[1] !== w.scored1;
    pushCaption(cs, scoredNow ? 'shootout-goal' : 'shootout-miss');
  }

  // 3. Phase and half changes. endHalf on a level second half sets half = 3 AND calls
  //    startKickoff in the same step, so the two edges arrive together; PRÓRROGA and
  //    INICIO would then both fire, and both map to whistle_start (two start whistles
  //    three seconds apart). PRÓRROGA wins: it says strictly more.
  let extraTimeNow = false;
  if (match.half !== w.half && match.half === 3) {
    pushCaption(cs, 'extra-time');
    extraTimeNow = true;
  }
  if (match.phase !== w.phase) {
    if (match.phase === 'shootout') pushCaption(cs, 'shootout');
    else if (match.phase === 'half-time') pushCaption(cs, 'half-time');
    else if (!extraTimeNow && match.phase === 'kickoff' && (w.phase === 'half-time' || match.half !== w.half)) {
      pushCaption(cs, 'kickoff');
    }
  }

  // 4. The referee's call, on its EDGE. Two guards, for two different reasons:
  //    · `w.call` — MEASURED (preflight 07-sep, seeds 7/11/23, no variance): the call
  //      is a level that stands for 301 steps on a restart. Reading it as a level
  //      re-pushes FALTA the moment its 90 steps run out, whistle included, three or
  //      four times per foul.
  //    · the phase — stage B2 carry #3: judgeShootoutKick can leave a one-step
  //      phantom restart in scratch.call, and there are no throw-ins in a shootout.
  if (match.phase !== 'shootout' && match.scratch.call.kind !== w.call) {
    switch (match.scratch.call.kind) {
      case 'free-kick': pushCaption(cs, 'foul'); break;
      case 'penalty': pushCaption(cs, 'penalty'); break;
      case 'corner': pushCaption(cs, 'corner'); break;
      case 'throw-in':
      case 'goal-kick': pushCaption(cs, 'out'); break;
      default: break;
    }
  }

  // 5. The end. winnerOf is the ONE reader of the winner (stage B2 §8) and it can
  //    return -1 with the match over -- abandon() inside the shootout, the only draw
  //    this ruleset has (S-PK5: sudden death always resolves). S-SC12 (confirmed by
  //    owner 2026-09-07): FINAL always whistles, and then GANADOR, ELIMINADO or, only
  //    in that abandon case, EMPATE -- never silence.
  if (match.phase === 'over' && w.phase !== 'over') {
    pushCaption(cs, 'full-time');
    const winner = winnerOf(match);
    if (winner === humanTeam) pushCaption(cs, 'winner');
    else if (winner >= 0) pushCaption(cs, 'eliminated');
    else pushCaption(cs, 'draw');
  }
}

export function updateWatch(match: MatchState, w: MatchWatch): void {
  w.started = true;
  w.phase = match.phase;
  w.half = match.half;
  w.score0 = match.score[0];
  w.score1 = match.score[1];
  const sh = match.shootout;
  w.taken0 = sh === null ? 0 : sh.taken[0];
  w.taken1 = sh === null ? 0 : sh.taken[1];
  w.scored0 = sh === null ? 0 : sh.scored[0];
  w.scored1 = sh === null ? 0 : sh.scored[1];
  w.call = match.scratch.call.kind;
}
```

- [ ] **Step 8: Verde, suite, tsc, motor intacto y determinismo**

Run: `npx vitest run && npx tsc --noEmit && git diff --stat 09a6001 -- components/games/football-logic/ && grep -rn "Math.random" components/games/football-screen/`
Expected: **992 tests en 58 ficheros** (955 + 19 de `hud` + 18 de `captions`) y **ninguno de los 916 anteriores en rojo**; `tsc` sin salida; las dos últimas salidas vacías. **Anotar el recuento real en el ledger.**

- [ ] **Step 9: Proponer commit**

Mensaje propuesto: `feat(world-cup): HUD readings and caption queue for the match screen`

**QA de Paco para esta tarea:** ninguno todavía.


---

## Task 8-4: `lib/sfx-vault-world-cup.ts` y `football-screen/sfx-map.ts` — los SFX de fichero

**Files:**
- Create: `lib/sfx-vault-world-cup.ts`, `lib/sfx-vault-world-cup.test.ts`
- Create: `components/games/football-screen/sfx-map.ts`, `components/games/football-screen/sfx-map.test.ts`

**Qué entra y qué no.** De la tabla de audio del spec (§Etapa D) entran en el paso 8 **ocho ficheros**: los tres silbatos (inicio de parte, final de parte, faltas y penaltis), la cadena de gol de tres sonidos, el golpeo del balón y el público a ráfagas. **NO entran**: las dos pistas de música (`vault-futbol-theme-game-play.mp3` y `vault-futbol-theme-pre-game-lobby.mp3`, paso 10 vía `useMusic().setTrackOverride`), los cánticos de celebración (`vault-futbol-chants-victory.mp3`, pantallas de victoria del paso 9) y el larguero (`vault-futbol-crossbar.mp3`, **reservado sin consumidor hasta la v1.5**: el motor no tiene los postes como colisión). La **entrada al suelo no tiene fichero**: S-SC10, silencio en la v1, etiquetado en el código y listado en dudas.

**Interfaces:**
- Consumes: `football-screen/captions.ts` (`CaptionKind`, `MatchWatch`), `football-logic/match.ts` (`MatchState`, `GOAL_PAUSE_STEPS`), `football-logic/clock.ts` (`stepsFor`), `football-logic/rng.ts` (`Rng`).
- Produces:

```ts
// lib/sfx-vault-world-cup.ts
export type VaultWorldCupSfx =
  | 'whistle_start' | 'whistle_end' | 'whistle_foul'
  | 'goal_net' | 'goal_shout' | 'goal_crowd'
  | 'kick' | 'crowd';
export const SFX_FILES: Readonly<Record<VaultWorldCupSfx, string>>;
export const SFX_VOLUME: Readonly<Record<VaultWorldCupSfx, number>>;
export class VaultWorldCupSFX {
  init(): void;
  play(name: VaultWorldCupSfx): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}
export const sfxVaultWorldCup: VaultWorldCupSFX;

// components/games/football-screen/sfx-map.ts
export const GOAL_CROWD_DELAY_STEPS: number;
export const AMBIENCE_MIN = 2;
export const AMBIENCE_MAX = 3;
export const AMBIENCE_SALT = 0x5bf03635;
export function sfxForCaption(kind: CaptionKind): VaultWorldCupSfx | 'none';
export function shotFiredThisStep(match: MatchState): boolean;
export function goalNetDue(match: MatchState, w: MatchWatch): boolean;
export function halfEndWhistleDue(match: MatchState, w: MatchWatch): boolean;
export function goalCrowdDue(match: MatchState): boolean;
export function ambienceSeedFor(seed: number, half: 1 | 2 | 3): number;
export function createAmbienceMarks(): number[];
export function planAmbience(rng: Rng, halfSteps: number, out: number[]): number;
export function ambienceDue(marks: readonly number[], count: number, index: number, halfStep: number): boolean;
```

- [ ] **Step 1: Confirmar los nombres exactos de los mp3**

Run: `ls public/ | grep vault-futbol`
Expected: doce ficheros, todos con slugs kebab-case en ASCII plano (`vault-futbol-whistle-start.mp3`, `vault-futbol-goal-net.mp3`, etc.).

**Los ocho nombres del paso 8 se COPIAN de esa salida y no se teclean nunca**, aunque ya no llevan tildes ni comas: los nombres originales del proveedor se renombraron con `git mv` el 2026-09-07 precisamente para eliminar la trampa de Unicode NFD/NFC que tenían (acentos descompuestos en disco que un `existsSync` no distinguía en macOS pero sí en el Linux de Vercel), así que copiar del `ls` sigue siendo la disciplina correcta aunque el riesgo que la motivó ya no exista.

- [ ] **Step 2: Escribir el test que falla de `lib/sfx-vault-world-cup.ts`**

Crear `lib/sfx-vault-world-cup.test.ts`:

```ts
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SFX_FILES, SFX_VOLUME, VaultWorldCupSFX, type VaultWorldCupSfx } from './sfx-vault-world-cup';

// Compared against the real directory listing, not existsSync: a table with a
// mistyped or stale name should fail loudly here instead of 404ing in production.
const PUBLIC_FILES = new Set(readdirSync(join(process.cwd(), 'public')));

const ALL: VaultWorldCupSfx[] = [
  'whistle_start', 'whistle_end', 'whistle_foul',
  'goal_net', 'goal_shout', 'goal_crowd',
  'kick', 'crowd',
];

describe('SFX_FILES', () => {
  it('names a real file in public/ for every sound', () => {
    for (const name of ALL) {
      const src = SFX_FILES[name];
      expect(src.startsWith('/')).toBe(true);
      expect(PUBLIC_FILES.has(decodeURI(src).slice(1)), `${name} -> ${src}`).toBe(true);
    }
  });

  it('the three sounds of the goal chain are three different files', () => {
    const chain = new Set([SFX_FILES.goal_net, SFX_FILES.goal_shout, SFX_FILES.goal_crowd]);
    expect(chain.size).toBe(3);
  });

  it('gives every sound a volume in (0, 1]', () => {
    for (const name of ALL) {
      expect(SFX_VOLUME[name]).toBeGreaterThan(0);
      expect(SFX_VOLUME[name]).toBeLessThanOrEqual(1);
    }
  });
});

describe('VaultWorldCupSFX without an Audio global', () => {
  it('all methods are safe no-ops before init', () => {
    const sfx = new VaultWorldCupSFX();
    expect(() => {
      for (const name of ALL) sfx.play(name);
      sfx.setMuted(true);
      sfx.dispose();
    }).not.toThrow();
  });

  it('init without an Audio global does not throw', () => {
    const sfx = new VaultWorldCupSFX();
    expect(() => sfx.init()).not.toThrow();
  });

  it('play after dispose does not throw either', () => {
    const sfx = new VaultWorldCupSFX();
    sfx.init();
    sfx.dispose();
    expect(() => sfx.play('kick')).not.toThrow();
  });
});
```

- [ ] **Step 3: Ver fallar**

Run: `npx vitest run lib/sfx-vault-world-cup.test.ts`
Expected: FAIL — `Failed to resolve import "./sfx-vault-world-cup"`.

- [ ] **Step 4: Escribir `lib/sfx-vault-world-cup.ts`**

```ts
// The SFX of stage C, step 8. Unlike the five synthesised sfx modules of this repo
// (sfx-vault-fighter and friends), Vault World Cup's sounds are FILES: Paco recorded
// them and the spec assigns each one to a trigger (§Etapa D, audio table). The
// contract is the same as VaultFighterSFX all the same -- lazy init on the first
// keypress, every method a no-op before it, dispose() in the effect cleanup -- so the
// component wires it exactly like the other thirteen games.
//
// NOT here, on purpose:
//   · the two music tracks (theme-game-play / theme-pre-game-lobby) -- step 10, they
//     go through app/context/MusicContext's setTrackOverride, not through this class;
//   · the victory chants (vault-futbol-chants-victory.mp3) -- step 9's victory screens;
//   · the crossbar (vault-futbol-crossbar.mp3) -- reserved with NO consumer until v1.5:
//     the engine has no posts as a collision, only the line between them;
//   · the sliding tackle -- S-SC10: it has no file at all, and the v1 leaves it
//     SILENT rather than inventing a synthesised one. Pending Paco.
export type VaultWorldCupSfx =
  | 'whistle_start'
  | 'whistle_end'
  | 'whistle_foul'
  | 'goal_net'
  | 'goal_shout'
  | 'goal_crowd'
  | 'kick'
  | 'crowd';

// Every name is a plain ASCII kebab-case slug (renamed 2026-09-07, no accents or
// commas left to encode), but they still go through encodeURI below: a cheap, always
// no-op guard is simpler than a rule that says "these files never need it".
const RAW_FILES: Readonly<Record<VaultWorldCupSfx, string>> = {
  whistle_start: '/vault-futbol-whistle-start.mp3',
  whistle_end: '/vault-futbol-whistle-end.mp3',
  whistle_foul: '/vault-futbol-whistle-foul.mp3',
  goal_net: '/vault-futbol-goal-net.mp3',
  goal_shout: '/vault-futbol-goal-shout.mp3',
  goal_crowd: '/vault-futbol-goal-crowd.mp3',
  kick: '/vault-futbol-kick.mp3',
  crowd: '/vault-futbol-crowd-ambience.mp3',
};

function encodeAll(files: Readonly<Record<VaultWorldCupSfx, string>>): Record<VaultWorldCupSfx, string> {
  const out = {} as Record<VaultWorldCupSfx, string>;
  for (const key of Object.keys(files) as VaultWorldCupSfx[]) out[key] = encodeURI(files[key]);
  return out;
}

export const SFX_FILES: Readonly<Record<VaultWorldCupSfx, string>> = encodeAll(RAW_FILES);

// The kick fires several times a minute and the crowd is a bed, so neither may drown
// the whistles, which are the game telling the player what just happened.
export const SFX_VOLUME: Readonly<Record<VaultWorldCupSfx, number>> = {
  whistle_start: 0.7,
  whistle_end: 0.7,
  whistle_foul: 0.6,
  goal_net: 0.7,
  goal_shout: 0.8,
  goal_crowd: 0.5,
  kick: 0.45,
  crowd: 0.3,
};

export class VaultWorldCupSFX {
  private sources: Partial<Record<VaultWorldCupSfx, HTMLAudioElement>> = {};
  private ready = false;
  private muted = false;

  // Called from the first keydown (user gesture), never at import: browsers refuse to
  // start audio before one, and the module is imported during SSR where Audio is not
  // defined at all.
  init(): void {
    if (this.ready) return;
    if (typeof Audio === 'undefined') return;
    for (const key of Object.keys(SFX_FILES) as VaultWorldCupSfx[]) {
      const el = new Audio(SFX_FILES[key]);
      el.preload = 'auto';
      el.volume = SFX_VOLUME[key];
      this.sources[key] = el;
    }
    this.ready = true;
  }

  // A clone per shot, the repo's own pattern (PongGame, ArkanoidGame, PacmanGame):
  // two goals in three seconds must not cut each other off. play() is only ever
  // called on an EVENT, never per frame, so the clone is not a per-frame allocation.
  play(name: VaultWorldCupSfx): void {
    if (!this.ready || this.muted) return;
    const source = this.sources[name];
    if (source === undefined) return;
    const shot = source.cloneNode(true) as HTMLAudioElement;
    shot.volume = SFX_VOLUME[name];
    // A browser that refuses to play (autoplay policy, tab in the background) rejects
    // the promise; swallowing it is the whole error handling this needs.
    void shot.play().catch(() => undefined);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  dispose(): void {
    for (const key of Object.keys(this.sources) as VaultWorldCupSfx[]) {
      const el = this.sources[key];
      if (el === undefined) continue;
      el.pause();
      el.src = '';
    }
    this.sources = {};
    this.ready = false;
  }
}

export const sfxVaultWorldCup = new VaultWorldCupSFX();
```

- [ ] **Step 5: Verde**

Run: `npx vitest run lib/sfx-vault-world-cup.test.ts`
Expected: PASS, 6 tests. **Si el test de existencia falla, el nombre está mal copiado** — volver al paso 1 y copiar del `ls`, no corregir el test.

- [ ] **Step 6: Escribir el test que falla de `sfx-map.ts`**

Crear `components/games/football-screen/sfx-map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EXTRA_TIME_STEPS, HALF_STEPS } from '../football-logic/clock';
import { createRng } from '../football-logic/rng';
import { GOAL_PAUSE_STEPS, createMatch, type MatchState } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { FORMATIONS, TEAMS } from '../football-logic/teams';
import { humanProfile, profileFor } from '../football-logic/ai';
import { createShootoutState } from '../football-logic/set-pieces';
import type { CaptionKind } from './captions';
import { CAPTION_TEXT, createMatchWatch, updateWatch } from './captions';
import {
  AMBIENCE_MAX, AMBIENCE_MIN, ambienceDue, ambienceSeedFor, createAmbienceMarks,
  goalCrowdDue, goalNetDue, halfEndWhistleDue, planAmbience, sfxForCaption, shotFiredThisStep,
} from './sfx-map';

function newMatch(): MatchState {
  return createMatch(
    [TEAMS[0], TEAMS[1]],
    FORMATIONS,
    PITCH,
    [humanProfile(TEAMS[0], 5), profileFor(TEAMS[1], 5)],
  );
}

describe('sfxForCaption', () => {
  it('whistles the start of every half and of the extra time', () => {
    expect(sfxForCaption('kickoff')).toBe('whistle_start');
    expect(sfxForCaption('extra-time')).toBe('whistle_start');
  });

  it('whistles the end of a half and the end of the match', () => {
    expect(sfxForCaption('half-time')).toBe('whistle_end');
    expect(sfxForCaption('full-time')).toBe('whistle_end');
  });

  it('whistles fouls and penalties with the referee file', () => {
    expect(sfxForCaption('foul')).toBe('whistle_foul');
    expect(sfxForCaption('penalty')).toBe('whistle_foul');
  });

  it('the GOL caption is the SECOND link of the goal chain', () => {
    expect(sfxForCaption('goal')).toBe('goal_shout');
    expect(sfxForCaption('shootout-goal')).toBe('goal_shout');
  });

  it('says nothing for the captions the audio table leaves silent', () => {
    expect(sfxForCaption('out')).toBe('none');
    expect(sfxForCaption('corner')).toBe('none');
    expect(sfxForCaption('shootout-miss')).toBe('none');
    expect(sfxForCaption('winner')).toBe('none');
    expect(sfxForCaption('eliminated')).toBe('none');
    expect(sfxForCaption('draw')).toBe('none');
  });

  it('has an answer for every caption kind', () => {
    for (const key of Object.keys(CAPTION_TEXT) as CaptionKind[]) {
      expect(typeof sfxForCaption(key)).toBe('string');
    }
  });
});

describe('shotFiredThisStep', () => {
  it('is false on a clean step', () => {
    const m = newMatch();
    expect(shotFiredThisStep(m)).toBe(false);
  });

  it('is true when any of the eighteen slots holds a shot that got away', () => {
    const m = newMatch();
    m.scratch.events[7].kind = 'shot';
    m.scratch.events[7].ok = true;
    expect(shotFiredThisStep(m)).toBe(true);
  });

  it('is false for a shot that did NOT get away, and for a pass', () => {
    const m = newMatch();
    m.scratch.events[7].kind = 'shot';
    m.scratch.events[7].ok = false;
    expect(shotFiredThisStep(m)).toBe(false);
    m.scratch.events[7].kind = 'long-pass';
    m.scratch.events[7].ok = true;
    expect(shotFiredThisStep(m)).toBe(false);
  });
});

describe('goalNetDue', () => {
  // MEASURED (preflight 07-sep, three CPU-vs-CPU matches, seeds 7/11/23): after a
  // goal, scratch.call.kind stays 'goal' for 421 consecutive steps, because
  // clearRefereeCall never runs in the 'goal' or 'kickoff' phases. Reading it as a
  // level plays 421 goal_net, each one cloning an HTMLAudioElement.
  it('fires on the step the goal call appears', () => {
    const m = newMatch();
    const w = createMatchWatch();
    updateWatch(m, w);
    m.scratch.call.kind = 'goal';
    expect(goalNetDue(m, w)).toBe(true);
  });

  it('does NOT fire again while the same call is still standing', () => {
    const m = newMatch();
    const w = createMatchWatch();
    m.scratch.call.kind = 'goal';
    updateWatch(m, w);          // the watch has seen it
    expect(goalNetDue(m, w)).toBe(false);
    // ... for as long as the engine leaves it there.
    for (let i = 0; i < 421; i++) expect(goalNetDue(m, w)).toBe(false);
  });

  // The spec's audio table ties goal_net to RefereeCall.kind === 'goal' with no
  // exception, so a penalty that goes in during the shootout rings the net like any
  // other goal. Excluding the shootout by PHASE, as the first draft did, produced the
  // one thing nobody wants: every shootout goal silent EXCEPT the deciding one, whose
  // endShootout puts the phase on 'over' in the same step.
  it('fires in the shootout too: the spec ties it to the call, never to the phase', () => {
    const m = newMatch();
    const w = createMatchWatch();
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    updateWatch(m, w);
    m.scratch.call.kind = 'goal';
    expect(goalNetDue(m, w)).toBe(true);
  });
});

describe('halfEndWhistleDue', () => {
  // Spec audio table: "whistle_end: endHalf de cada parte y phase === 'over'". Two of
  // those transitions never produce a 'half-time' caption, so sfxForCaption alone
  // leaves them silent: endHalf on a LEVEL second half jumps straight to half 3 +
  // 'kickoff' (match.ts:183-201) and endExtraTime goes 'golden-goal' -> 'shootout'.
  it('stays silent while nothing changes', () => {
    const m = newMatch();
    const w = createMatchWatch();
    updateWatch(m, w);
    expect(halfEndWhistleDue(m, w)).toBe(false);
  });

  it('whistles the end of a level second half, which never becomes half-time', () => {
    const m = newMatch();
    const w = createMatchWatch();
    m.half = 2;
    m.phase = 'play';
    updateWatch(m, w);
    m.half = 3;
    m.phase = 'kickoff';        // startKickoff, in the same step as the half change
    expect(halfEndWhistleDue(m, w)).toBe(true);
  });

  it('does NOT double up with the DESCANSO whistle at the end of the first half', () => {
    const m = newMatch();
    const w = createMatchWatch();
    m.phase = 'play';
    updateWatch(m, w);
    m.half = 2;
    m.phase = 'half-time';      // this one DOES get a caption, which whistles already
    expect(halfEndWhistleDue(m, w)).toBe(false);
  });

  it('whistles the end of the extra time when the shootout takes over', () => {
    const m = newMatch();
    const w = createMatchWatch();
    m.half = 3;
    m.phase = 'golden-goal';
    updateWatch(m, w);
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    expect(halfEndWhistleDue(m, w)).toBe(true);
  });
});

describe('goalCrowdDue', () => {
  it('fires exactly once, part way into the goal pause', () => {
    const m = newMatch();
    m.phase = 'goal';
    let fired = 0;
    for (let left = GOAL_PAUSE_STEPS; left >= 0; left--) {
      m.pauseStepsLeft = left;
      if (goalCrowdDue(m)) fired++;
    }
    expect(fired).toBe(1);
  });

  it('never fires outside the goal pause', () => {
    const m = newMatch();
    m.phase = 'play';
    m.pauseStepsLeft = 0;
    expect(goalCrowdDue(m)).toBe(false);
  });
});

describe('the crowd ambience', () => {
  it('derives a different seed for every half, so no two halves share instants', () => {
    const seed = 123456;
    const a = ambienceSeedFor(seed, 1);
    const b = ambienceSeedFor(seed, 2);
    const c = ambienceSeedFor(seed, 3);
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });

  it('is deterministic: the same seed and half give the same instants', () => {
    const marksA = createAmbienceMarks();
    const marksB = createAmbienceMarks();
    const nA = planAmbience(createRng(ambienceSeedFor(99, 1)), HALF_STEPS, marksA);
    const nB = planAmbience(createRng(ambienceSeedFor(99, 1)), HALF_STEPS, marksB);
    expect(nA).toBe(nB);
    expect(marksA.slice(0, nA)).toEqual(marksB.slice(0, nB));
  });

  it('plans two or three bursts, strictly inside the half and in order', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const marks = createAmbienceMarks();
      const n = planAmbience(createRng(ambienceSeedFor(seed, 1)), HALF_STEPS, marks);
      expect(n).toBeGreaterThanOrEqual(AMBIENCE_MIN);
      expect(n).toBeLessThanOrEqual(AMBIENCE_MAX);
      for (let i = 0; i < n; i++) {
        expect(marks[i]).toBeGreaterThan(0);
        expect(marks[i]).toBeLessThan(HALF_STEPS);
        if (i > 0) expect(marks[i]).toBeGreaterThan(marks[i - 1]);
      }
    }
  });

  it('two halves of the same match get different instants', () => {
    const first = createAmbienceMarks();
    const second = createAmbienceMarks();
    const n1 = planAmbience(createRng(ambienceSeedFor(7, 1)), HALF_STEPS, first);
    const n2 = planAmbience(createRng(ambienceSeedFor(7, 2)), HALF_STEPS, second);
    expect(first.slice(0, n1)).not.toEqual(second.slice(0, n2));
  });

  it('ambienceDue fires once per mark and never past the last one', () => {
    const marks = createAmbienceMarks();
    const n = planAmbience(createRng(ambienceSeedFor(5, 1)), HALF_STEPS, marks);
    let index = 0;
    let fired = 0;
    for (let step = 0; step <= HALF_STEPS; step++) {
      if (ambienceDue(marks, n, index, step)) {
        fired++;
        index++;
      }
    }
    expect(fired).toBe(n);
    expect(ambienceDue(marks, n, n, HALF_STEPS)).toBe(false);
  });

  // Regression for the skeleton bug the Self-Review flagged: the extra time (half 3)
  // is capped at EXTRA_TIME_STEPS, not HALF_STEPS -- a match lasting a few minutes,
  // not forty-five. Planning it with HALF_STEPS is exactly the mistake the component
  // made until Task 8-5 step 4, and it is invisible to every other test in this file
  // because they only ever pass HALF_STEPS.
  it('the extra time gets its OWN, shorter window: EXTRA_TIME_STEPS, not HALF_STEPS', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const marks = createAmbienceMarks();
      const n = planAmbience(createRng(ambienceSeedFor(seed, 3)), EXTRA_TIME_STEPS, marks);
      expect(n).toBeGreaterThanOrEqual(AMBIENCE_MIN);
      expect(n).toBeLessThanOrEqual(AMBIENCE_MAX);
      for (let i = 0; i < n; i++) {
        expect(marks[i]).toBeGreaterThan(0);
        expect(marks[i]).toBeLessThan(EXTRA_TIME_STEPS); // no mark past the real extra-time window
        if (i > 0) expect(marks[i]).toBeGreaterThan(marks[i - 1]); // strictly increasing: no repeated instants
      }
    }
  });

  it('would have caught the bug: the LAST mark planned with HALF_STEPS lands past EXTRA_TIME_STEPS', () => {
    // MEASURED (preflight 07-sep, mulberry32 of the repo, seeds 1..12): the failure
    // mode depends on how many bursts the draw gives. With count = 3 the last mark
    // falls in [3780, 5220) and ALWAYS clears 3600; with count = 2 it falls in
    // [2970, 5130) and CROSSES it -- seeds 1 and 4 give 3396 and 3260, below the cap,
    // and this assertion would go red for reasons that have nothing to do with the
    // bug. ambienceSeedFor(2, 3) draws three bursts: [882, 2124, 5080], clearing the
    // cap by 1480 steps.
    const marks = createAmbienceMarks();
    const n = planAmbience(createRng(ambienceSeedFor(2, 3)), HALF_STEPS, marks);
    // Pinned FIRST, so that if the draw ever stopped giving three bursts this test
    // would fail on the fixture and not on the assertion underneath it.
    expect(n).toBe(AMBIENCE_MAX);
    // Proof that the wrong call site is not just "less precise" but actively silent
    // for part of the extra time: the marks it plans in the second half of its window
    // fall beyond the step count halfStep ever reaches in half 3, so
    // ambienceDue(marks, n, index, match.halfStep) never fires for them.
    expect(marks[n - 1]).toBeGreaterThan(EXTRA_TIME_STEPS);
  });
});
```

- [ ] **Step 7: Ver fallar**

Run: `npx vitest run components/games/football-screen/sfx-map.test.ts`
Expected: FAIL — `Failed to resolve import "./sfx-map"`. 25 tests en total cuando pase.

- [ ] **Step 8: Escribir `sfx-map.ts`**

```ts
import { stepsFor } from '../football-logic/clock';
import { GOAL_PAUSE_STEPS, type MatchState } from '../football-logic/match';
import type { Rng } from '../football-logic/rng';
import type { VaultWorldCupSfx } from '@/lib/sfx-vault-world-cup';
import type { CaptionKind, MatchWatch } from './captions';

// The audio table of the spec, one row per caption. The goal is a CHAIN of three:
// the net fires the moment the ball crosses the line (RefereeCall.kind === 'goal',
// wired in the component), the shout comes with the GOL caption, and the crowd comes
// part way into the celebration.
export function sfxForCaption(kind: CaptionKind): VaultWorldCupSfx | 'none' {
  switch (kind) {
    case 'kickoff':
    case 'extra-time':
    case 'shootout':
      return 'whistle_start';
    case 'half-time':
    case 'full-time':
      return 'whistle_end';
    case 'foul':
    case 'penalty':
      return 'whistle_foul';
    case 'goal':
    case 'shootout-goal':
      return 'goal_shout';
    case 'out':
    case 'corner':
    case 'shootout-miss':
    case 'winner':
    case 'eliminated':
    case 'draw':
      return 'none';
  }
}

// The FIRST link of the goal chain, on the EDGE of the referee's call.
//
// MEASURED (preflight 07-sep, three full CPU-vs-CPU matches, seeds 7/11/23, no
// variance): scratch.call is a level, not an edge. clearRefereeCall runs only inside
// stepOpenPlay (match.ts:358) and stepShootout (:454); the 'goal', 'kickoff',
// 'set-piece' and 'half-time' phases leave it standing, so a goal keeps
// call.kind === 'goal' for 421 consecutive steps (120 of celebration + 300 of
// kickoff countdown + 1). Reading it as a level plays 421 goal_net and 421
// whistle_foul per goal, each one cloning an HTMLAudioElement -- and it breaks the
// promise written on VaultWorldCupSFX.play(), that it is only ever called on an event.
//
// The phase is deliberately NOT part of the condition: the spec's audio table ties
// goal_net to RefereeCall.kind === 'goal' with no exception, so a shootout penalty
// rings the net like any other goal. Excluding the shootout by phase gave the worst
// of both -- every shootout goal silent EXCEPT the deciding one, whose endShootout
// puts the phase on 'over' in the same step.
export function goalNetDue(match: MatchState, w: MatchWatch): boolean {
  return match.scratch.call.kind === 'goal' && w.call !== 'goal';
}

// whistle_end where the caption map cannot reach. The spec's audio table asks for it
// at "endHalf de cada parte y phase === 'over'", but two of those transitions never
// produce a 'half-time' caption and so would be silent:
//   · endHalf with the second half LEVEL sets half = 3 and calls startKickoff in the
//     same step (match.ts:183-201) -- no 'half-time' phase at all;
//   · endExtraTime goes from 'golden-goal' straight to 'shootout'.
// Both are the two loudest moments of a match. The 1 -> 2 change DOES pass through
// 'half-time', whose caption already whistles, so it is excluded here rather than
// whistled twice.
export function halfEndWhistleDue(match: MatchState, w: MatchWatch): boolean {
  if (!w.started) return false;
  if (match.half !== w.half && match.phase !== 'half-time') return true;
  return match.phase === 'shootout' && w.phase !== 'shootout';
}

// S-SC11: 0.7 s into the two-second celebration, so the crowd answers the shout
// instead of talking over it.
export const GOAL_CROWD_DELAY_STEPS = stepsFor(0.7);

export function goalCrowdDue(match: MatchState): boolean {
  if (match.phase !== 'goal') return false;
  return GOAL_PAUSE_STEPS - match.pauseStepsLeft === GOAL_CROWD_DELAY_STEPS;
}

// The ball being struck. Stage B2 §8 warns that during the shootout the resolution
// wipes the pointer, so the safe read is a scan of all eighteen slots for the single
// 'shot' -- which is exactly what this does, and it costs 18 comparisons.
export function shotFiredThisStep(match: MatchState): boolean {
  const events = match.scratch.events;
  for (let i = 0; i < events.length; i++) {
    if (events[i].kind === 'shot' && events[i].ok) return true;
  }
  return false;
}

// Spec: "dos o tres ráfagas por parte, en instantes sorteados y deterministas, también
// en la prórroga, y nunca los mismos instantes en dos partes".
export const AMBIENCE_MIN = 2;
export const AMBIENCE_MAX = 3;
// Spec, and criterion 1: the ambience must NOT draw from the match rng, or the audio
// layer would change the simulation. Its own stream, derived from the same seed by
// integer arithmetic, keeps it reproducible with the replay and out of the engine's way.
export const AMBIENCE_SALT = 0x5bf03635;

export function ambienceSeedFor(seed: number, half: 1 | 2 | 3): number {
  return ((seed ^ Math.imul(AMBIENCE_SALT, half)) >>> 0);
}

export function createAmbienceMarks(): number[] {
  const out: number[] = [];
  for (let i = 0; i < AMBIENCE_MAX; i++) out.push(0);
  return out;
}

// One burst per window, placed inside the middle 80 % of it: the marks come out
// sorted and spread by construction, with no sorting pass and no allocation.
export function planAmbience(rng: Rng, halfSteps: number, out: number[]): number {
  const count = AMBIENCE_MIN + (rng() < 0.5 ? 0 : 1);
  const window = halfSteps / count;
  for (let i = 0; i < count; i++) {
    out[i] = Math.floor(i * window + window * 0.1 + rng() * window * 0.8);
  }
  return count;
}

export function ambienceDue(marks: readonly number[], count: number, index: number, halfStep: number): boolean {
  if (index >= count) return false;
  return halfStep >= marks[index];
}
```

- [ ] **Step 9: Verde y cierre de la tarea**

Run: `npx vitest run && npx tsc --noEmit && git diff --stat 09a6001 -- components/games/football-logic/ && grep -rn "Math.random" components/games/football-screen/ lib/sfx-vault-world-cup.ts`
Expected: **1023 tests en 60 ficheros** (992 + 6 de `sfx-vault-world-cup` + 25 de `sfx-map`); `tsc` limpio; las dos últimas salidas vacías. **Anotar el recuento real en el ledger.**

- [ ] **Step 10: Proponer commit**

Mensaje propuesto: `feat(world-cup): file-based match SFX and the engine-event to sound map`

**QA de Paco para esta tarea:** ninguno todavía (los sonidos no suenan hasta la 8-5).

---

## Task 8-5: `viewport-guard.ts`, `VaultWorldCupGame.tsx` y la página provisional — el primer partido

La tarea grande y la única sin test unitario: rAF y canvas no son testables con la configuración actual (entorno Node, sin DOM), igual que `VaultFighterGame.tsx` y los doce anteriores. **Su verificación es `npx tsc --noEmit`, `npm run build`, la lectura manual de asignaciones y la lista de QA que Paco ejecuta en su `:3000`.**

**Files:**
- Create: `components/games/football-screen/viewport-guard.ts`, `components/games/football-screen/viewport-guard.test.ts`
- Create: `components/games/VaultWorldCupGame.tsx`
- Create: `app/games/vault-world-cup/play/page.tsx`

**Interfaces:**
- Consumes: todo `football-screen/` (Tasks 8-1 a 8-4), `lib/sfx-vault-world-cup.ts`, y de `football-logic/` **solo lectura**: `createMatch`, `stepMatch`, `abandon`, `winnerOf`, `isOpenPlay`, `TEAMS`, `FORMATIONS`, `teamById`, `PITCH`, `PLAYER_RADIUS`, `isPlayerDown`, `isSprinting`, `createTeamInput`, `createAiState`, `decideTeamInput`, `profileFor`, `humanProfile`, `createRng`, `stepsFor`, `SHOOTOUT_RESOLVE_STEPS`.
  **Ni uno más:** `createActionEvent`, `SET_PIECE_COUNTDOWN_STEPS` y `TEAM_SIZE` figuraban aquí en el primer borrador y **no los usa nada** del componente (el `tsconfig` no tiene `noUnusedLocals`, así que compilarían igual y C4 los firmaría como si tuvieran consumidor). `SHOOTOUT_RESOLVE_STEPS` sí se queda, y con uso real: la barra de resolución del lanzamiento en `drawHud` (el motor lo exportó justo para esto — su comentario dice «exported for Task 8»).
- Produces: el componente y su contrato de props (ver «Puntos de enganche para el paso 9» arriba).

- [ ] **Step 1: Escribir el test que falla de `viewport-guard.ts`**

Crear `components/games/football-screen/viewport-guard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { VIEW_H, VIEW_W } from './camera';
import { MIN_VIEWPORT_H, MIN_VIEWPORT_W, viewportAllowed } from './viewport-guard';

describe('viewportAllowed', () => {
  it('the thresholds leave room for the 800 x 500 canvas plus the HUD', () => {
    expect(MIN_VIEWPORT_W).toBeGreaterThanOrEqual(VIEW_W);
    expect(MIN_VIEWPORT_H).toBeGreaterThanOrEqual(VIEW_H);
  });

  it('accepts a desktop viewport', () => {
    expect(viewportAllowed(1440, 900)).toBe(true);
    expect(viewportAllowed(MIN_VIEWPORT_W, MIN_VIEWPORT_H)).toBe(true);
  });

  it('rejects a phone, a narrow window and a short window', () => {
    expect(viewportAllowed(390, 844)).toBe(false);
    expect(viewportAllowed(MIN_VIEWPORT_W - 1, MIN_VIEWPORT_H)).toBe(false);
    expect(viewportAllowed(MIN_VIEWPORT_W, MIN_VIEWPORT_H - 1)).toBe(false);
  });

  it('rejects a zero or negative viewport instead of dividing by it', () => {
    expect(viewportAllowed(0, 0)).toBe(false);
    expect(viewportAllowed(-100, 900)).toBe(false);
  });
});
```

- [ ] **Step 2: Ver fallar y escribir `viewport-guard.ts`**

Run: `npx vitest run components/games/football-screen/viewport-guard.test.ts` → FAIL.

```ts
import { VIEW_H, VIEW_W } from './camera';

// Spec: "solo desktop en la v1". S-SC2: the repo has NO viewport guard to copy --
// grep for matchMedia/innerWidth/useMediaQuery across components, hooks and app
// returns nothing -- so these are the first two thresholds of the project. They are
// the canvas plus room for the page's HUD row and the CRT frame; anything smaller
// turns eighteen players of 12 world units into three pixels, which is the reason
// the camera exists in the first place.
export const MIN_VIEWPORT_W = VIEW_W + 100; // 900
export const MIN_VIEWPORT_H = VIEW_H + 100; // 600

export function viewportAllowed(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  return width >= MIN_VIEWPORT_W && height >= MIN_VIEWPORT_H;
}
```

Run: `npx vitest run components/games/football-screen/viewport-guard.test.ts` → PASS, 4 tests.

- [ ] **Step 3: Escribir el esqueleto de `VaultWorldCupGame.tsx` — props, refs y estado creado una vez**

Crear `components/games/VaultWorldCupGame.tsx` empezando por esto (el bucle y el dibujo llegan en los pasos 4-7; el fichero no compila hasta el paso 7 y eso está bien):

```tsx
'use client';

import React, { useEffect, useRef } from 'react';

import { createAiState, decideTeamInput, humanProfile, profileFor, type AiProfile, type AiState } from './football-logic/ai';
import { stepsFor } from './football-logic/clock';
import { createTeamInput, type TeamInput } from './football-logic/input';
import {
  abandon, createMatch, isOpenPlay, stepMatch, winnerOf, type MatchState,
} from './football-logic/match';
import { PITCH } from './football-logic/pitch';
import { PLAYER_RADIUS, isPlayerDown, isSprinting, type PlayerState } from './football-logic/players';
import { createRng, type Rng } from './football-logic/rng';
import { SHOOTOUT_RESOLVE_STEPS } from './football-logic/set-pieces';
import { FORMATIONS, TEAMS, teamById, type Strategy, type TeamDef } from './football-logic/teams';

import {
  CAMERA_LAG, VIEW_H, VIEW_W, cameraTargetX, cameraTargetY, centreCamera, createCamera,
  followCamera, isOnScreen, toScreenX, toScreenY, type Camera,
} from './football-screen/camera';
import {
  CAPTION_TEXT, collectCaptions, createCaptionState, createMatchWatch, stepCaption, updateWatch,
} from './football-screen/captions';
import {
  SHOT_CHARGE_SEGMENTS, buttonsIdle, chargeSegments, clockText, countdownSeconds, cursorPlayerId,
  halfCapSteps, halfLabel, keeperHoldsBall, shootoutRoundLabel, smallNumber, sprintBarFraction,
} from './football-screen/hud';
import { createStepBudget, frameMode, planSteps } from './football-screen/loop';
import {
  MINIMAP_H, MINIMAP_PAD, MINIMAP_W, createMinimapRect, minimapViewRect, minimapX, minimapY,
} from './football-screen/minimap';
import {
  ambienceDue, ambienceSeedFor, createAmbienceMarks, goalCrowdDue, goalNetDue,
  halfEndWhistleDue, planAmbience, sfxForCaption, shotFiredThisStep,
} from './football-screen/sfx-map';
import {
  createPadState, padAdvance, padBlur, padChoice, padClear, padDown, padKeyFor, padToTeamInput, padUp,
} from './football-screen/keyboard';
import { MIN_VIEWPORT_H, MIN_VIEWPORT_W, viewportAllowed } from './football-screen/viewport-guard';
import { sfxVaultWorldCup } from '@/lib/sfx-vault-world-cup';

interface VaultWorldCupGameProps {
  paused: boolean;
  muted?: boolean;
  homeTeamId?: string;
  awayTeamId?: string;
  homeFormation?: number;
  awayFormation?: number;
  homeStrategy?: Strategy;
  difficulty?: number;
  seed?: number;
  onScoreChange?: (home: number, away: number) => void;
  onClockChange?: (label: string) => void;
  onMatchEnd: (winner: 0 | 1 | -1) => void;
}

// ── The human is team 0 in step 8. The second keyboard is step 9. ──────────────
const HUMAN_TEAM = 0 as const;
const CPU_TEAM = 1 as const;
// Two independent rng streams from one seed (ai.test.ts's playCpuMatch pattern): the
// CPU decides with its own, so the replay is seed + TeamInput and nothing else.
const CPU_SEED_SALT = 0x2545f491;
// S-SC3 (confirmed by owner 2026-09-07): the engine holds the keeper for a fixed 2 s
// (S-GK.6, stage B) but exposes no steps-left of its own -- keeperHoldsBall is a plain
// boolean. The screen keeps its OWN elapsed count, reset the moment the flag drops, to
// show a countdown that tracks the known, fixed duration without touching the engine.
const KEEPER_HOLD_STEPS = stepsFor(2);

// ── Palette. One visual version, no skins (spec). ─────────────────────────────
const GRASS_DARK = '#1f6b32';
const GRASS_LIGHT = '#247a39';
const STRIPE_WIDTH = 160;
const LINE = 'rgba(255,255,255,0.75)';
const HUD_BG = 'rgba(0,0,0,0.55)';
const HUD_TEXT = '#e8f4ff';
const HUD_ACCENT = '#ffcf3a';
const CURSOR_COLOR = '#ffcf3a';
const BALL_COLOR = '#ffffff';
const SHADOW = 'rgba(0,0,0,0.35)';
const MINIMAP_BG = 'rgba(0,0,0,0.6)';
const MINIMAP_FRAME = 'rgba(255,255,255,0.6)';

// ── Layout of the canvas overlays ─────────────────────────────────────────────
const HUD_H = 44;
const CAPTION_Y = 200;
const CAPTION_H = 96;
// The viewport-guard panel goes UNDER the caption band (296 .. 400 of the 500), so
// the EMPATE that the same event queues stays readable above it.
const BLOCKED_Y = CAPTION_Y + CAPTION_H;
const BLOCKED_H = 104;
const BAR_W = 34;
const BAR_H = 5;
// R33: the three charge notches drawn next to the controlled player, above the cursor
// arrow (which occupies y - PLAYER_RADIUS - 12 .. -3).
const NOTCH_W = 7;
const NOTCH_H = 5;
const NOTCH_GAP = 2;
const NOTCH_TOTAL_W = SHOT_CHARGE_SEGMENTS * NOTCH_W + (SHOT_CHARGE_SEGMENTS - 1) * NOTCH_GAP;
const NOTCH_DY = -24;

// Fixed UI copy, module constants so draw() never builds a string.
const HINT_AIM = 'CRUCETA: APUNTAR · SALE SOLO';
const FORMATION_HINT = '1/2/3 ALINEACIÓN · 4/5/6 ESTRATEGIA';
// Built ONCE at module load, from the guard's own thresholds rather than a literal,
// so the panel and viewportAllowed can never drift apart.
const BLOCKED_TITLE = 'AGRANDA LA VENTANA';
const BLOCKED_HINT = `MÍNIMO ${MIN_VIEWPORT_W} × ${MIN_VIEWPORT_H}`;
const STRATEGY_LABEL: Readonly<Record<Strategy, string>> = {
  attack: 'ATAQUE',
  neutral: 'NEUTRAL',
  defend: 'DEFENSA',
};

function teamOrDefault(id: string | undefined, fallbackIndex: number): TeamDef {
  const found = id === undefined ? undefined : teamById(TEAMS, id);
  return found ?? TEAMS[fallbackIndex];
}

function VaultWorldCupGame({
  paused,
  muted = false,
  homeTeamId,
  awayTeamId,
  homeFormation = 0,
  awayFormation = 0,
  homeStrategy = 'neutral',
  difficulty = 5,      // spec: 5 in the friendly
  seed,
  onScoreChange,
  onClockChange,
  onMatchEnd,
}: VaultWorldCupGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const mutedRef = useRef(muted);
  const onMatchEndRef = useRef(onMatchEnd);
  const onScoreChangeRef = useRef(onScoreChange);
  const onClockChangeRef = useRef(onClockChange);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    mutedRef.current = muted;
    sfxVaultWorldCup.setMuted(muted);
  }, [muted]);

  // The loop never reads props: the three callbacks go through refs so a page that
  // re-creates them does not restart the match.
  useEffect(() => {
    onMatchEndRef.current = onMatchEnd;
    onScoreChangeRef.current = onScoreChange;
    onClockChangeRef.current = onClockChange;
  }, [onMatchEnd, onScoreChange, onClockChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d')!;

    // ── Everything below is created ONCE and mutated in place (criterion 20) ──
    const matchSeed = seed ?? Date.now();          // the one Date.now() of the whole game
    const matchRng: Rng = createRng(matchSeed);
    const cpuRng: Rng = createRng((matchSeed ^ CPU_SEED_SALT) >>> 0);

    const home = teamOrDefault(homeTeamId, 0);
    const away = teamOrDefault(awayTeamId, 1);
    const profiles: [AiProfile, AiProfile] = [
      humanProfile(home, difficulty),   // D3: same difficulty, zero angular error
      profileFor(away, difficulty),
    ];
    const match: MatchState = createMatch([home, away], FORMATIONS, PITCH, profiles);
    match.formationIndex[HUMAN_TEAM] = homeFormation;
    match.formationIndex[CPU_TEAM] = awayFormation;

    const pad = createPadState(homeStrategy, homeFormation);
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[CPU_TEAM].formation = awayFormation;
    const cpuState: AiState = createAiState();

    const cam: Camera = createCamera();
    centreCamera(cam, match.ball.x, match.ball.y, PITCH);

    const budget = createStepBudget();
    const captions = createCaptionState();
    const watch = createMatchWatch();
    const viewRect = createMinimapRect();

    const ambienceMarks = createAmbienceMarks();
    let ambienceCount = 0;
    let ambienceIndex = 0;
    let ambienceHalf: 1 | 2 | 3 = 1;
    // The three lets above are initialised BEFORE this call, and planAmbienceForHalf
    // is a hoisted function declaration of this same effect (written in step 4), so
    // there is no TDZ here. It writes all three; this is the whole of the first
    // half's ambience draw, with the right window (halfCapSteps) from the start --
    // no placeholder to remember to replace later.
    planAmbienceForHalf(1);

    let accumulatorMs = 0;
    let lastTs = 0;
    let started = false;
    let sfxReady = false;
    let endFired = false;
    let blocked = false;               // the viewport guard tripped
    let shootoutTaken = -1;            // to detect a new kick of the shootout
    let cachedShootoutLabel = '';
    let reportedHome = -1;
    let reportedAway = -1;
    let reportedClock = '';
    let keeperHoldSteps = 0;            // S-SC3's countdown, see KEEPER_HOLD_STEPS
```

Nota: el sorteo del ambiente sale **ya correcto** del esqueleto, sin placeholder intermedio. `planAmbienceForHalf` (definida en el paso 4) llama a `planAmbience` con `halfCapSteps(half)` —el tope real de la parte que toca, `HALF_STEPS` en 1 y 2, `EXTRA_TIME_STEPS` en la prórroga—, **nunca `HALF_STEPS` fijo para las tres** ni el `match.pitch.width` que el primer borrador ponía «para que compilara». El test de `sfx-map` del paso 6 de la Task 8-4 trae la aserción que atrapa ese error si alguien lo reintroduce.

- [ ] **Step 4: El bucle — acumulador de paso fijo, CPU y audio de eventos**

Continuar el mismo `useEffect`, justo debajo:

```tsx
    function reportHud(): void {
      const home = match.score[HUMAN_TEAM];
      const away = match.score[CPU_TEAM];
      if (home !== reportedHome || away !== reportedAway) {
        reportedHome = home;
        reportedAway = away;
        const cb = onScoreChangeRef.current;
        if (cb !== undefined) cb(home, away);
      }
      const clock = clockText(match);
      if (clock !== reportedClock) {
        reportedClock = clock;
        const cb = onClockChangeRef.current;
        if (cb !== undefined) cb(clock);
      }
    }

    function playCaptionSfx(): void {
      // The caption that has just started playing is the trigger, so the sound and
      // the words always agree.
      if (captions.kind === 'none') return;
      const name = sfxForCaption(captions.kind);
      if (name !== 'none') sfxVaultWorldCup.play(name);
    }

    // The extra time is NOT a third half of the same length (clock.ts): it caps at
    // EXTRA_TIME_STEPS (3600), not HALF_STEPS (5400). Planning its ambience with
    // HALF_STEPS spreads the marks over a window half again as long as the one
    // ambienceDue compares against (match.halfStep, which never passes 3600 in half
    // 3), so the marks in the back of that window never fire. MEASURED over seeds
    // 1..12: the FIRST mark always lands below 3600, so what is lost is the second
    // burst, or the second and the third -- not all of them, as the first draft of
    // this comment claimed. halfCapSteps is hud.ts's own tested half-length lookup
    // (halfCapSteps(3) === EXTRA_TIME_STEPS); reusing it here instead of a second
    // literal is what keeps the two in sync.
    function planAmbienceForHalf(half: 1 | 2 | 3): void {
      ambienceCount = planAmbience(createRng(ambienceSeedFor(matchSeed, half)), halfCapSteps(half), ambienceMarks);
      ambienceIndex = 0;
      ambienceHalf = half;
    }

    // ONE simulation step: the CPU decides first with its own rng, then the engine
    // runs, then the screen reads what happened. `first` is false from the second
    // step of a frame on, which is what keeps a single tap from firing five shots.
    function runStep(first: boolean): void {
      padToTeamInput(pad, first, inputs[HUMAN_TEAM]);
      decideTeamInput(match, CPU_TEAM, match.profiles[CPU_TEAM], cpuState, cpuRng, inputs[CPU_TEAM]);
      stepMatch(match, inputs, matchRng);

      // 1. The ball being struck (audio table: ActionEvent 'shot' with ok).
      if (shotFiredThisStep(match)) sfxVaultWorldCup.play('kick');
      // 2. The first link of the goal chain, the moment the ball crosses the line.
      //    goalNetDue reads the EDGE of scratch.call against `watch`, which still
      //    holds the previous step here (updateWatch runs at point 7): the call is a
      //    level that stands for 421 measured steps, and reading it as one played
      //    842 overlapping mp3 per goal. It fires in the shootout too -- the spec
      //    ties goal_net to the call, not to the phase.
      if (goalNetDue(match, watch)) {
        sfxVaultWorldCup.play('goal_net');
        sfxVaultWorldCup.play('whistle_foul');
      }
      // 2b. The two half-endings the caption map cannot see: a level second half
      //     (endHalf jumps to half 3 + kickoff without ever being 'half-time') and
      //     the end of the extra time ('golden-goal' -> 'shootout'). Same `watch`,
      //     same reason it still holds the previous step.
      if (halfEndWhistleDue(match, watch)) sfxVaultWorldCup.play('whistle_end');
      // 3. The third link, part way into the celebration.
      if (goalCrowdDue(match)) sfxVaultWorldCup.play('goal_crowd');
      // 4. A new kick of the shootout starts its countdown: the start whistle again.
      //    `shootoutTaken >= 0` skips the FIRST kick: endExtraTime sets the phase and
      //    calls startShootoutKick in the same step, so the PENALTIS caption is
      //    whistling whistle_start already and this would be the second one three
      //    frames later. Same reason PRÓRROGA swallows INICIO in collectCaptions.
      const sh = match.shootout;
      if (sh !== null) {
        const taken = sh.taken[0] + sh.taken[1];
        if (taken !== shootoutTaken) {
          const first = shootoutTaken < 0;
          shootoutTaken = taken;
          cachedShootoutLabel = shootoutRoundLabel(sh);
          if (!first && match.phase === 'shootout') sfxVaultWorldCup.play('whistle_start');
        }
      }
      // 5. The crowd bed: 2-3 bursts per half, from its own stream (spec).
      if (match.half !== ambienceHalf) planAmbienceForHalf(match.half);
      if (isOpenPlay(match.phase) && ambienceDue(ambienceMarks, ambienceCount, ambienceIndex, match.halfStep)) {
        ambienceIndex++;
        sfxVaultWorldCup.play('crowd');
      }

      // 6. S-SC3's countdown: the screen's own elapsed count while the human keeper
      //    holds the ball, reset the instant the flag drops (a new hold restarts it).
      //    CAPPED at KEEPER_HOLD_STEPS: in the shootout the engine leaves the ball
      //    with the keeper who just saved, for as long as it likes, and an uncapped
      //    count would run the countdown into negative numbers.
      if (keeperHoldsBall(match, HUMAN_TEAM)) {
        if (keeperHoldSteps < KEEPER_HOLD_STEPS) keeperHoldSteps++;
      } else keeperHoldSteps = 0;

      // 7. Captions, from the transition detector.
      const before = captions.kind;
      collectCaptions(match, watch, HUMAN_TEAM, captions);
      updateWatch(match, watch);
      if (captions.kind !== before) playCaptionSfx();
      stepCaption(captions);
      if (captions.kind !== before && captions.kind !== 'none' && before !== 'none') playCaptionSfx();

      // 8. The camera. During the shootout the target is the alternating penalty
      //    spot and the cut is instant (S-SC8): panning 1600 units between kicks
      //    would take longer than the kick itself.
      const tx = cameraTargetX(match);
      const ty = cameraTargetY(match);
      if (match.phase === 'shootout') centreCamera(cam, tx, ty, PITCH);
      else followCamera(cam, tx, ty, PITCH, CAMERA_LAG);

      // 9. The end, exactly once.
      if (match.phase === 'over' && !endFired) {
        endFired = true;
        onMatchEndRef.current(winnerOf(match));
      }
    }

    // The caption clock on its own, for the frames where the simulation has stopped
    // but the screen has not: a finished match and a blocked viewport. Same relay
    // logic as point 7 of runStep, so the FINAL whistle still sounds when the queue
    // hands over from GOL to FINAL after the last step of the match.
    function stepCaptionsOnly(steps: number): void {
      for (let i = 0; i < steps; i++) {
        const before = captions.kind;
        stepCaption(captions);
        if (captions.kind !== before && captions.kind !== 'none') playCaptionSfx();
      }
    }

    function update(frameMs: number): void {
      const mode = frameMode(match.phase, pausedRef.current, blocked);
      // Paused: the accumulator is not fed either, and it keeps whatever carry it
      // had -- pausing must not bank up time that fires five steps on resume.
      if (mode === 'frozen') return;
      accumulatorMs += frameMs;
      planSteps(accumulatorMs, budget);
      accumulatorMs = budget.carryMs;
      if (mode === 'captions-only') {
        stepCaptionsOnly(budget.steps);
        return;
      }
      for (let i = 0; i < budget.steps; i++) runStep(i === 0);
      // Once per FRAME **that ran at least one step**, after every step of it:
      // pressed -> held, released -> up. The guard is the whole point: an edge is
      // consumed by a STEP, not by a frame. STEP_MS is 16.667 ms, so on a 120 or
      // 144 Hz panel a good half of the frames plan zero steps, and advancing the
      // pad on those would eat the press before any stepMatch ever saw it -- the
      // player's shot, pass or sprint simply would not happen. Fixed by the
      // "a press survives a frame in which no step ran" test in keyboard.test.ts.
      if (budget.steps > 0) padAdvance(pad);
      reportHud();
    }

    let rafId = 0;
    function loop(ts: number): void {
      const frameMs = started ? ts - lastTs : 0;
      lastTs = ts;
      started = true;
      // update() decides for itself what this frame may do (loop.ts's frameMode).
      // draw() runs UNCONDITIONALLY: neither the end of the match nor the viewport
      // guard may leave the canvas frozen on the frame before, because the last
      // thing the screen has to say -- GANADOR / ELIMINADO / EMPATE, or the panel
      // that explains the block -- is drawn after both of them happen.
      update(frameMs);
      draw();
      rafId = requestAnimationFrame(loop);
    }
```

**Por qué `padAdvance` va detrás de un `if`, y `draw()` no va detrás de ninguno.** Son los dos arreglos que esta revisión trae al bucle y conviene leerlos juntos: el primero mantiene una pulsación viva hasta que un paso la consume (un frame de cero pasos no consume nada); el segundo separa el reloj de la simulación del reloj de los rótulos, para que el partido terminado y la ventana encogida sigan pintando —que es lo que hace posibles `GANADOR`/`ELIMINADO`/`EMPATE` y el panel de la guarda—. Las tres modalidades están en `frameMode` de `loop.ts` con su test; el `.tsx` solo las obedece.

**Por qué `playCaptionSfx` se llama dos veces:** el primero cubre la aparición de un rótulo cuando no había ninguno; el segundo, el relevo de la cola (GOL → FINAL → GANADOR), donde el sonido del siguiente tiene que sonar al aparecer y no al empezar el paso. Si al leerlo en revisión resulta redundante, simplificar a una sola llamada **después** de `stepCaption` comparando contra `before`.

- [ ] **Step 5: El teclado, la guarda de viewport y la limpieza**

Continuar el mismo `useEffect`:

```tsx
    function isTypingTarget(e: KeyboardEvent): boolean {
      const target = e.target as HTMLElement | null;
      return (
        target !== null &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      );
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (isTypingTarget(e)) return;
      if (!sfxReady) {
        // Browsers only start audio after a user gesture, and Audio does not exist
        // during SSR: this is the one place init() may be called.
        sfxReady = true;
        sfxVaultWorldCup.init();
        sfxVaultWorldCup.setMuted(mutedRef.current);
      }
      if (pausedRef.current || blocked) return;
      const key = e.key.toLowerCase();
      const padKey = padKeyFor(key);
      if (padKey !== null) {
        e.preventDefault();
        padDown(pad, padKey);
        return;
      }
      if (padChoice(pad, key)) e.preventDefault();
    }

    function handleKeyUp(e: KeyboardEvent): void {
      const padKey = padKeyFor(e.key.toLowerCase());
      if (padKey === null) return;
      // A DIRECTION is always released, in every state: leaving one standing is
      // repo-wide bug #1 (the player runs for ever). A BUTTON released while the
      // game is paused or the viewport guard has tripped is a different matter --
      // handleKeyDown swallowed its keydown, so padUp would leave a 'released' edge
      // sitting in the pad for the engine to consume on resume, firing a shot the
      // player never asked for. padClear lifts it without the edge.
      const isButton = padKey === 'a' || padKey === 'b' || padKey === 'c';
      if (isButton && (pausedRef.current || blocked)) {
        padClear(pad, padKey);
        return;
      }
      padUp(pad, padKey);
    }

    // Repo-wide bug #1 (VaultFighterGame's own comment): alt-tabbing with a
    // direction held would leave the player running for ever.
    function handleBlur(): void {
      padBlur(pad);
    }

    // Spec: "solo desktop; si el viewport se reduce en partida, se para y redirige".
    // Stopping is abandon() -- the transition the engine already has, whose only
    // guard is phase === 'over', so it works from every phase including the
    // shootout. It leaves winnerOf() at -1, which is why onMatchEnd accepts -1.
    function handleResize(): void {
      if (blocked) return;
      if (viewportAllowed(window.innerWidth, window.innerHeight)) return;
      blocked = true;
      // ONE pass of the detector right here, outside the loop, and in this exact
      // order. abandon() puts the phase on 'over' between frames, and from the next
      // frame on the simulation no longer runs (frameMode -> 'captions-only'), so if
      // nobody looked at the match now, collectCaptions would never see the
      // transition and the EMPATE that QA C6-14 asks to read on the canvas would
      // never be queued at all. The updateWatch BEFORE abandon() covers the ugly
      // case: a viewport that is already too small at mount, where handleResize runs
      // before the first frame and the watch has never been started -- without it,
      // collectCaptions would take its `!w.started` branch, print INICIO and return.
      updateWatch(match, watch);
      abandon(match);
      collectCaptions(match, watch, HUMAN_TEAM, captions);
      updateWatch(match, watch);
      padBlur(pad);   // the keyboard is off from here: nothing may survive the block
      if (!endFired) {
        endFired = true;
        onMatchEndRef.current(-1);
      }
    }

    handleResize();
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('resize', handleResize);
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('resize', handleResize);
      sfxVaultWorldCup.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

**Gate 2 de la etapa B, cerrado y anotado:** el informe pedía «cablear una salida del gol de oro» porque el motor no tenía techo. La etapa B2 se lo puso (`EXTRA_TIME_STEPS` + tanda), así que el gol de oro **ya termina solo** y `abandon()` no hace falta para eso. Aquí se cablea al **único** caso que queda vivo: la reducción de viewport. La página provisional no llama a `abandon` al desmontar porque el remontaje crea un `MatchState` nuevo.


- [ ] **Step 6: El dibujo del mundo — campo, jugadores, balón, cursor y saque**

Estas funciones van **dentro del mismo `useEffect`**, antes de `loop` (JavaScript iza las declaraciones de función, así que el orden de escritura es libre; ponerlas juntas debajo de `update`). Todas leen `cam`, `match` y `ctx` del closure y **no reciben ni devuelven objetos**.

```tsx
    function drawPitch(): void {
      // Grass, in world-aligned stripes so the camera movement is legible.
      ctx.fillStyle = GRASS_DARK;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const first = Math.floor(cam.x / STRIPE_WIDTH);
      const last = Math.ceil((cam.x + VIEW_W) / STRIPE_WIDTH);
      ctx.fillStyle = GRASS_LIGHT;
      for (let i = first; i <= last; i++) {
        if ((i & 1) === 0) continue;
        ctx.fillRect(toScreenX(cam, i * STRIPE_WIDTH), 0, STRIPE_WIDTH, VIEW_H);
      }

      const p = PITCH;
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 3;
      // Touchlines and goal lines.
      ctx.strokeRect(toScreenX(cam, 0), toScreenY(cam, 0), p.width, p.height);
      // Halfway line.
      ctx.beginPath();
      ctx.moveTo(toScreenX(cam, p.width / 2), toScreenY(cam, 0));
      ctx.lineTo(toScreenX(cam, p.width / 2), toScreenY(cam, p.height));
      ctx.stroke();
      // Centre circle and spot.
      ctx.beginPath();
      ctx.arc(toScreenX(cam, p.width / 2), toScreenY(cam, p.height / 2), p.centerCircleRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = LINE;
      ctx.beginPath();
      ctx.arc(toScreenX(cam, p.width / 2), toScreenY(cam, p.height / 2), 4, 0, Math.PI * 2);
      ctx.fill();

      // The two ends: big area, small area, penalty spot and the goal mouth.
      for (let side = 0; side < 2; side++) {
        const goalX = side === 0 ? 0 : p.width;
        const dir = side === 0 ? 1 : -1;
        const midY = p.height / 2;
        ctx.strokeStyle = LINE;
        ctx.strokeRect(
          toScreenX(cam, goalX + (dir === 1 ? 0 : -p.bigAreaDepth)),
          toScreenY(cam, midY - p.bigAreaWidth / 2),
          p.bigAreaDepth,
          p.bigAreaWidth,
        );
        ctx.strokeRect(
          toScreenX(cam, goalX + (dir === 1 ? 0 : -p.smallAreaDepth)),
          toScreenY(cam, midY - p.smallAreaWidth / 2),
          p.smallAreaDepth,
          p.smallAreaWidth,
        );
        ctx.fillStyle = LINE;
        ctx.beginPath();
        ctx.arc(toScreenX(cam, goalX + dir * p.penaltySpotDist), toScreenY(cam, midY), 4, 0, Math.PI * 2);
        ctx.fill();
        // The goal itself: a white mouth 30 units deep behind the line.
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(
          toScreenX(cam, goalX + (dir === 1 ? -30 : 0)),
          toScreenY(cam, midY - p.goalWidth / 2),
          30,
          p.goalWidth,
        );
      }
    }

    // The parked fifteen of the shootout must be drawn STANDING AND STILL (stage B2
    // §8): placeAroundCentreSpot leaves vx/vy at zero but does NOT clear facing,
    // downUntilStep, tackleStepsLeft or chargeSteps, so a player who was mid-slide
    // when the extra time ended would otherwise stay frozen in that pose for the
    // whole shootout. The screen ignores those fields during the shootout instead of
    // the engine clearing them (carries #2 and #4 -- see "Peticiones al motor").
    //
    // Two different exclusions, on purpose:
    //   · `parked` — the fifteen in the centre circle: no facing stick either, they
    //     are scenery. The taker and the two keepers are NOT parked, because their
    //     direction is the one thing the player has to read.
    //   · `down`   — nobody is drawn lying down during the shootout, THE TAKER
    //     INCLUDED. The B2 report's Minor 2 is precisely that the first taker may
    //     still be on the ground (or sliding) if the extra time ran out mid-tackle,
    //     probe P6(1) -- so leaving him out of the exclusion would draw a penalty
    //     being taken by a man lying flat. Rounding carry #2 whole, taker and all,
    //     is what makes M6 in "Peticiones al motor" a legibility request and not a
    //     bug the screen still shows.
    function drawPlayer(p: PlayerState, cursor: boolean): void {
      if (!isOnScreen(cam, p.x, p.y, PLAYER_RADIUS * 3)) return;
      const x = toScreenX(cam, p.x);
      const y = toScreenY(cam, p.y);
      const kit = match.teams[p.team].kit;
      const shootout = match.phase === 'shootout';
      const parked = shootout && p.id !== (match.shootout?.takerId ?? -1) && p.role !== 'gk';
      const down = !shootout && isPlayerDown(p, match.stepCount);

      ctx.fillStyle = SHADOW;
      ctx.beginPath();
      ctx.ellipse(x, y + PLAYER_RADIUS * 0.6, PLAYER_RADIUS, PLAYER_RADIUS * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // A player on the ground is drawn flat: it is a whole second of the match and
      // the player has to be able to see why nothing responds.
      ctx.fillStyle = p.role === 'gk' ? kit.secondary : kit.primary;
      ctx.beginPath();
      if (down) ctx.ellipse(x, y, PLAYER_RADIUS * 1.3, PLAYER_RADIUS * 0.55, 0, 0, Math.PI * 2);
      else ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // The trim: shirt collar for the outfield, a full ring for the keeper, so the
      // one player who is never controllable is unmistakable.
      ctx.strokeStyle = p.role === 'gk' ? kit.primary : kit.secondary;
      ctx.lineWidth = p.role === 'gk' ? 3 : 2;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER_RADIUS - 1, 0, Math.PI * 2);
      ctx.stroke();

      // Facing: a short stick, so the pass cone and the slide direction are readable.
      if (!down && !parked) {
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + p.facingX * PLAYER_RADIUS * 1.6, y + p.facingY * PLAYER_RADIUS * 1.6);
        ctx.stroke();
      }

      // The fixed goal celebration (spec: always the same one, no variations): the
      // scoring team throws its arms up, the conceding team drops its head.
      if (match.phase === 'goal' && match.lastGoalTeam >= 0) {
        ctx.strokeStyle = p.team === match.lastGoalTeam ? HUD_ACCENT : 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (p.team === match.lastGoalTeam) {
          ctx.arc(x, y - PLAYER_RADIUS, PLAYER_RADIUS * 0.9, Math.PI, Math.PI * 2);
        } else {
          ctx.arc(x, y + PLAYER_RADIUS * 0.2, PLAYER_RADIUS * 0.7, 0, Math.PI);
        }
        ctx.stroke();
      }

      if (cursor) {
        ctx.strokeStyle = CURSOR_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 7, y - PLAYER_RADIUS - 12);
        ctx.lineTo(x + 7, y - PLAYER_RADIUS - 12);
        ctx.lineTo(x, y - PLAYER_RADIUS - 3);
        ctx.closePath();
        ctx.stroke();

        // R33 (Paco, 07-sep), replacing the continuous yellow bar the first draft
        // put in the HUD: THREE notches, here, next to the player who is charging.
        // chargeSegments reads the engine's own ramp, so a notch always means the
        // same shot -- 1 = tap (700), 2 = half (~825), 3 = full (950) -- and the
        // player can deliberately aim for one instead of guessing at a bar. They
        // only appear while J is actually held (chargeSteps > 0): three empty boxes
        // floating over the cursor the rest of the match would be noise.
        if (p.chargeSteps > 0) {
          const lit = chargeSegments(p.chargeSteps);
          const nx = x - NOTCH_TOTAL_W / 2;
          const ny = y - PLAYER_RADIUS + NOTCH_DY;
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(nx - 1, ny - 1, NOTCH_TOTAL_W + 2, NOTCH_H + 2);
          for (let i = 0; i < SHOT_CHARGE_SEGMENTS; i++) {
            ctx.fillStyle = i < lit ? HUD_ACCENT : 'rgba(0,0,0,0.5)';
            ctx.fillRect(nx + i * (NOTCH_W + NOTCH_GAP), ny, NOTCH_W, NOTCH_H);
          }
        }
      }

      if (isSprinting(p)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER_RADIUS + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawPlayers(): void {
      const cursorId = cursorPlayerId(match, HUMAN_TEAM);
      for (let i = 0; i < match.players.length; i++) {
        drawPlayer(match.players[i], match.players[i].id === cursorId);
      }
    }

    function drawBall(): void {
      const b = match.ball;
      if (!isOnScreen(cam, b.x, b.y, 30)) return;
      const x = toScreenX(cam, b.x);
      const y = toScreenY(cam, b.y);
      // The shadow stays on the ground and the ball rises with z: it is the only cue
      // that a long pass is going over the defenders' heads.
      ctx.fillStyle = SHADOW;
      ctx.beginPath();
      ctx.ellipse(x, y, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = BALL_COLOR;
      ctx.beginPath();
      ctx.arc(x, y - b.z * 0.35, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // The set piece: the five-second countdown and the direction the d-pad is aiming.
    // Gate 4 of the stage B report is paid here -- the hint says the buttons do
    // nothing during the countdown, because stepSetPiece only reads the d-pad.
    function drawSetPiece(): void {
      const sp = match.setPiece;
      if (sp === null) return;
      const x = toScreenX(cam, sp.x);
      const y = toScreenY(cam, sp.y);
      ctx.strokeStyle = HUD_ACCENT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + sp.dirX * 70, y + sp.dirY * 70);
      ctx.stroke();
      ctx.fillStyle = HUD_ACCENT;
      ctx.font = 'bold 40px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(smallNumber(countdownSeconds(sp.stepsLeft)), x, y - 46);
      if (sp.kind === 'penalty') {
        // A penalty is aimed with the VERTICAL axis only (stepSetPiece reads input.dy).
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y + sp.side * 40, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
```

- [ ] **Step 7: El dibujo de la interfaz — minimapa, HUD, rótulos y el JSX**

```tsx
    function drawMinimap(): void {
      const ox = VIEW_W - MINIMAP_W - MINIMAP_PAD;
      const oy = VIEW_H - MINIMAP_H - MINIMAP_PAD;
      ctx.fillStyle = MINIMAP_BG;
      ctx.fillRect(ox, oy, MINIMAP_W, MINIMAP_H);
      ctx.strokeStyle = MINIMAP_FRAME;
      ctx.lineWidth = 1;
      ctx.strokeRect(ox, oy, MINIMAP_W, MINIMAP_H);
      ctx.beginPath();
      ctx.moveTo(ox + MINIMAP_W / 2, oy);
      ctx.lineTo(ox + MINIMAP_W / 2, oy + MINIMAP_H);
      ctx.stroke();

      // Criterion 13: all eighteen, always -- this is the context the camera takes away.
      for (let i = 0; i < match.players.length; i++) {
        const p = match.players[i];
        ctx.fillStyle = match.teams[p.team].kit.primary;
        ctx.beginPath();
        ctx.arc(ox + minimapX(PITCH, p.x), oy + minimapY(PITCH, p.y), p.role === 'gk' ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = BALL_COLOR;
      ctx.beginPath();
      ctx.arc(ox + minimapX(PITCH, match.ball.x), oy + minimapY(PITCH, match.ball.y), 2, 0, Math.PI * 2);
      ctx.fill();

      minimapViewRect(cam, PITCH, viewRect);
      ctx.strokeStyle = HUD_ACCENT;
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + viewRect.x, oy + viewRect.y, viewRect.w, viewRect.h);
    }

    function drawHud(): void {
      ctx.fillStyle = HUD_BG;
      ctx.fillRect(0, 0, VIEW_W, HUD_H);
      ctx.textBaseline = 'middle';

      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = match.teams[HUMAN_TEAM].kit.primary;
      ctx.fillText(match.teams[HUMAN_TEAM].name, 12, HUD_H / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = match.teams[CPU_TEAM].kit.primary;
      ctx.fillText(match.teams[CPU_TEAM].name, VIEW_W - 12, HUD_H / 2);

      ctx.textAlign = 'center';
      ctx.fillStyle = HUD_TEXT;
      ctx.font = 'bold 24px monospace';
      ctx.fillText(smallNumber(match.score[HUMAN_TEAM]), VIEW_W / 2 - 52, HUD_H / 2);
      ctx.fillText(smallNumber(match.score[CPU_TEAM]), VIEW_W / 2 + 52, HUD_H / 2);
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = HUD_ACCENT;
      ctx.fillText(clockText(match), VIEW_W / 2, HUD_H / 2 - 7);
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(halfLabel(match), VIEW_W / 2, HUD_H / 2 + 12);

      // The shootout keeps its OWN scoreboard: match.score stays level and must not
      // be touched (stage B2 §8, assumption S-PK12).
      const sh = match.shootout;
      if (sh !== null) {
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = HUD_ACCENT;
        ctx.fillText(cachedShootoutLabel, VIEW_W / 2, HUD_H + 16);
        ctx.fillStyle = HUD_TEXT;
        ctx.fillText(
          `${smallNumber(sh.scored[HUMAN_TEAM])} - ${smallNumber(sh.scored[CPU_TEAM])}`,
          VIEW_W / 2,
          HUD_H + 34,
        );
        // The engine's own four-second window for the ball to settle after a kick
        // (SHOOTOUT_RESOLVE_STEPS, exported for exactly this). Without it those four
        // seconds of a still ball read as a hang.
        if (sh.resolveStepsLeft > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(VIEW_W / 2 - 60, HUD_H + 48, 120, 4);
          ctx.fillStyle = HUD_ACCENT;
          ctx.fillRect(VIEW_W / 2 - 60, HUD_H + 48, (sh.resolveStepsLeft / SHOOTOUT_RESOLVE_STEPS) * 120, 4);
        }
      }

      // Formation, strategy and the two player bars, bottom left.
      ctx.textAlign = 'left';
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(FORMATIONS[match.formationIndex[HUMAN_TEAM]].name, 12, VIEW_H - 40);
      ctx.fillText(STRATEGY_LABEL[match.strategies[HUMAN_TEAM]], 12, VIEW_H - 26);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(FORMATION_HINT, 12, VIEW_H - 12);

      // Only the SPRINT bar lives here now. The shot charge moved next to the player
      // as three notches (R33) -- see drawPlayer.
      const controlled = match.players[cursorPlayerId(match, HUMAN_TEAM)];
      const bx = 12;
      const by = VIEW_H - 58;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, BAR_W, BAR_H);
      ctx.fillStyle = '#6fe3ff';
      ctx.fillRect(bx, by, BAR_W * sprintBarFraction(controlled), BAR_H);

      // Gate 4: during a countdown the buttons do nothing. Say it, or the player
      // hammers them believing they are broken.
      if (buttonsIdle(match)) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(HINT_AIM, VIEW_W / 2, VIEW_H - 14);
      }

      // S-SC3 (confirmed by owner 2026-09-07): two seconds in which the d-pad and the
      // buttons belong to the keeper, with a countdown -- KEEPER_HOLD_STEPS is the
      // screen's OWN fixed duration (see its declaration), since the engine exposes
      // only the boolean keeperHoldsBall.
      //
      // isOpenPlay is the second half of the condition and it is NOT redundant:
      // keeperHoldsBall is just `ball.owner === team * TEAM_SIZE`, and in the
      // shootout the human keeper keeps the ball every time he saves a penalty. The
      // notice would then appear in a phase that has no goal kick at all, on top of
      // the TANDA n/5 label (same y, HUD_H + 16), with a countdown frozen at 0.
      if (isOpenPlay(match.phase) && keeperHoldsBall(match, HUMAN_TEAM)) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = HUD_ACCENT;
        const left = countdownSeconds(KEEPER_HOLD_STEPS - keeperHoldSteps);
        ctx.fillText(`SAQUE: K CORTO · J LARGO · ${smallNumber(left)}`, VIEW_W / 2, HUD_H + 16);
      }
    }

    // The viewport guard, drawn instead of a frozen canvas. S-SC12: the match has
    // been abandoned, the EMPATE caption is on its way through the queue, and this
    // panel is what turns "the game stopped" into something the player can act on.
    // The threshold comes from viewport-guard's own constants, never from a literal.
    function drawBlocked(): void {
      if (!blocked) return;
      // BLOCKED_Y sits BELOW the caption band (CAPTION_Y + CAPTION_H) on purpose:
      // the panel must not cover the EMPATE the same event produces.
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(0, BLOCKED_Y, VIEW_W, BLOCKED_H);
      ctx.strokeStyle = HUD_ACCENT;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, BLOCKED_Y, VIEW_W, BLOCKED_H);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 26px monospace';
      ctx.fillStyle = HUD_ACCENT;
      ctx.fillText(BLOCKED_TITLE, VIEW_W / 2, BLOCKED_Y + 36);
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(BLOCKED_HINT, VIEW_W / 2, BLOCKED_Y + 68);
    }

    function drawCaption(): void {
      if (captions.kind === 'none') return;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, CAPTION_Y, VIEW_W, CAPTION_H);
      ctx.strokeStyle = HUD_ACCENT;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, CAPTION_Y, VIEW_W, CAPTION_H);
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = HUD_ACCENT;
      ctx.fillText(CAPTION_TEXT[captions.kind], VIEW_W / 2, CAPTION_Y + CAPTION_H / 2);
    }

    function draw(): void {
      drawPitch();
      drawPlayers();
      drawBall();
      drawSetPiece();
      drawMinimap();
      drawHud();
      drawCaption();
      // Last, over everything, and only when the guard has tripped. The caption
      // underneath it is still running its queue (frameMode -> 'captions-only'), so
      // EMPATE appears in the band above this panel, which is what QA C6-14 reads.
      drawBlocked();
    }
```

Y el `return` del componente, calcado del de `VaultFighterGame`:

```tsx
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }}
      />
    </div>
  );
}

export default React.memo(VaultWorldCupGame);
```

- [ ] **Step 8: La página provisional**

Crear `app/games/vault-world-cup/play/page.tsx`. **Es un banco de pruebas, no la play-page**: nada de registro, música, puntuación, `MobileGamepad`, skins ni `GameOverModal` — todo eso es el paso 10, que **reescribe este fichero entero** manteniendo la URL para que el QA de Paco no cambie de sitio entre el paso 8 y el 10.

```tsx
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

export default function VaultWorldCupPlay() {
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState<string>('');
  const [gameKey, setGameKey] = useState(0);
  const [score, setScore] = useState('0 - 0');

  const handleScoreChange = useCallback((home: number, away: number) => {
    setScore(`${home} - ${away}`);
  }, []);

  const handleMatchEnd = useCallback((winner: 0 | 1 | -1) => {
    setResult(WINNER_TEXT[winner === 0 ? 0 : winner === 1 ? 1 : 2]);
  }, []);

  // Restart by remount, the repo's mechanism (vault-fighter's play page): the
  // component has no reset API and does not need one.
  const restart = useCallback(() => {
    setResult('');
    setScore('0 - 0');
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
          <div className="hud-stat">
            <span>Marcador</span>
            <span>{score}</span>
          </div>
          <div className="hud-stat">
            <span>Estado</span>
            <span>{result === '' ? 'EN JUEGO' : result}</span>
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
            onMatchEnd={handleMatchEnd}
          />
        </div>
        <div className="crt-bottom">
          <span>SEÑAL OK</span>
          <span>VAULT WORLD CUP · CRT-80 · 60 HZ</span>
          <span>PASO 8 · PROVISIONAL</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Compilar, construir y no romper nada**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: `tsc` sin salida; la suite verde con **los 916 originales intactos** y los nuevos sumados; `npm run build` exit 0 con la ruta `/games/vault-world-cup/play` en la lista.
Si el build se queja de `React.memo` sobre un componente con props opcionales, **no relajar el tipo**: revisar que `onMatchEnd` sigue siendo obligatoria.

- [ ] **Step 10: Lectura manual de asignaciones (sin navegador)**

Leer el cuerpo de `update()`, `runStep()` y de las ocho funciones de dibujo y confirmar contra las Global Constraints que **no hay** literales de objeto/array, `filter`/`map`/spread, `new`, closures creados por frame ni plantillas de string. Casos concretos que hay que mirar uno por uno y anotar en el ledger:

1. `drawHud` construye una plantilla de string para el marcador de la tanda (`${…} - ${…}`). **Solo se ejecuta con `match.shootout !== null`**, es decir en una fase donde el partido está parado y no hay física; se acepta y se anota. Si en la revisión molesta, cachearla junto a `cachedShootoutLabel`.
2. `cachedShootoutLabel` se recalcula **solo** cuando cambia `taken[0] + taken[1]`, nunca por frame.
3. `smallNumber`, `clockText` y `CAPTION_TEXT` devuelven entradas de tabla: verificar que no queda ningún `String(n)` ni `.toFixed()` en el dibujo.
4. `planAmbience` se llama **una vez por parte**, no por paso, y siempre a través de `planAmbienceForHalf`, que usa `halfCapSteps(half)` — no `HALF_STEPS` fijo ni `match.pitch.width`.
5. `shotFiredThisStep` recorre 18 slots con un bucle `for` clásico, sin `some`.
6. `drawPlayer` accede a `match.shootout?.takerId ?? -1`: el operador opcional no asigna, pero confirmar que no se convierte en una desestructuración.
7. `drawHud` también construye una plantilla para el aviso del portero (S-SC3, `SAQUE: K CORTO · J LARGO · ${…}`). **Solo se ejecuta con `isOpenPlay(match.phase) && keeperHoldsBall(...)`**, los mismos 2 s parados que ya cubre el punto 1: misma excepción, mismo motivo, se acepta y se anota.
8. `BLOCKED_HINT` es la única plantilla de string del fichero que se evalúa **en el módulo**, no en un frame: se construye una vez al cargar, a partir de `MIN_VIEWPORT_W`/`MIN_VIEWPORT_H`. Confirmar que no se ha movido dentro de `drawBlocked`.
9. Las tres casillas de carga de `drawPlayer` (R33) usan `NOTCH_TOTAL_W`, precalculado en el módulo, y un `for` de tres vueltas con `fillRect`: ni plantillas ni arrays.
10. `update()` no crea nada: `frameMode` devuelve un string literal de un tipo unión, no un objeto.

- [ ] **Step 11: El motor sigue intacto y la pantalla es determinista**

Run: `git diff --stat 09a6001 -- components/games/football-logic/ && grep -rn "Math.random" components/games/football-screen/ && grep -rn "Date.now\|performance.now" components/games/football-screen/ lib/sfx-vault-world-cup.ts`
Expected: **las tres salidas vacías**. `Date.now()` solo puede aparecer en `VaultWorldCupGame.tsx`, y una sola vez.

- [ ] **Step 12: Proponer commit**

Mensaje propuesto: `feat(world-cup): playable friendly — camera, minimap, HUD, captions and SFX`

---

## Cierre del paso 8

- [ ] **C1: La suite, el compilador y el build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: **52 ficheros y 916 tests de partida siguen verdes**, más los **nueve ficheros de test nuevos**, con este reparto contado uno a uno sobre los tests escritos en el plan:

| Fichero nuevo | Tests | Acumulado |
|---|---:|---:|
| baseline | 916 | 916 |
| `loop.test.ts` | 9 | 925 |
| `keyboard.test.ts` | 15 | 940 |
| `camera.test.ts` | 9 | 949 |
| `minimap.test.ts` | 6 | 955 |
| `hud.test.ts` | 19 | 974 |
| `captions.test.ts` | 18 | 992 |
| `lib/sfx-vault-world-cup.test.ts` | 6 | 998 |
| `sfx-map.test.ts` | 25 | 1023 |
| `viewport-guard.test.ts` | 4 | **1027** |

Es decir **1027 tests en 61 ficheros**. `tsc` sin salida. `npm run build` exit 0. **Anotar el recuento exacto que dé la suite en el ledger**: si difiere del de la tabla, la puerta que importa sigue siendo el criterio 21 del spec (la suite no baja de 916) y que ninguno de los 916 anteriores esté rojo — el número anunciado es una previsión, no una aserción.

- [ ] **C2: El motor no se ha tocado**

Run: `git diff --stat 09a6001 -- components/games/football-logic/`
Expected: **salida vacía**. Si no lo está, el paso 8 ha invadido el motor: revertir esa parte y moverla a «Peticiones separadas al motor».

- [ ] **C3: Determinismo de la capa de pantalla**

Run:
```bash
grep -rn "Math.random" components/games/football-screen/ lib/sfx-vault-world-cup.ts
grep -rn "Date.now\|performance.now" components/games/football-screen/ lib/sfx-vault-world-cup.ts
grep -rn "Date.now" components/games/VaultWorldCupGame.tsx | wc -l
```
Expected: las dos primeras **vacías**; la tercera, **1** (la semilla del amistoso, y solo esa).

- [ ] **C4: Todo lo exportado tiene consumidor**

Recorrer los `export` de `components/games/football-screen/` y de `lib/sfx-vault-world-cup.ts` y comprobar que cada uno lo usa el componente o un test. Lo que espere al paso 9 o al 10 lleva su línea `// exported for Task 9: …`. Anotar la lista en el ledger.

**Y el recorrido inverso, que es el que la etapa B firmó en falso:** `grep` de cada símbolo importado en `VaultWorldCupGame.tsx` sobre el cuerpo del fichero, y comprobar que aparece **al menos una vez más** que en su línea de `import`. El `tsconfig` no tiene `noUnusedLocals`, así que un import muerto compila igual y este paso es lo único que lo caza. Los cuatro que esta revisión ya quitó o cableó, para que no vuelvan: `createActionEvent`, `SET_PIECE_COUNTDOWN_STEPS` y `TEAM_SIZE` **borrados** (nada del componente los usaba), `SHOOTOUT_RESOLVE_STEPS` **importado y usado** en la barra de resolución de `drawHud`, y `MAX_FRAME_MS` **eliminado de `loop.ts`** por inerte (`planSteps` capa en 5 pasos y tira el sobrante, así que clampar el frame antes no cambiaba ningún resultado).

- [ ] **C5: Peticiones separadas al motor (NO se ejecutan en el paso 8)**

Los ítems «CARRY TO Task 8» de los dos ledgers que resultan ser **cambios en `football-logic/` o en sus tests**, y por tanto quedan fuera de esta etapa. Se entregan como lista para que Paco decida si van en un commit propio antes o después del paso 8:

| # | Fichero | Cambio pedido | Origen |
|---|---|---|---|
| M1 | `football-logic/match.ts:273` | Comentario de una línea sobre `players[match.controlled[team]]` sin guarda de `-1` (hoy inalcanzable con `TEAM_SIZE = 9`; v1.5 con expulsiones lo encontrará). | Ledger etapa B, línea 62 |
| M2 | `football-logic/ai.ts:182-194` | Comentario en `steerTo` diciendo que el llamante garantiza la velocidad (divide por `perStep(PLAYER_SPEED)` ignorando sprint y balón). | Etapa B, minor 6a #2 |
| M3 | `football-logic/ai.test.ts:697/722/732` | `stats.strategies` se escribe y no se asierta: asertarlo (es el criterio 12 dentro del partido grabado). | Etapa B, minor 6b #4 |
| M4 | `football-logic/ai.test.ts` | Comentario aclarando que el contador de chuts guardado con `open` excluye los saques. | Etapa B, minor 6b #5 |
| M5 | `football-logic/invariants.ts:31-38` | Helper `isGoalkeeperRole(role: Role)` en vez del comentario de cinco líneas que hoy justifica el ensanchado de tipo. | Etapa B, minor 7 #1 |
| M6 | `football-logic/set-pieces.ts:302-307` | Limpiar `facing` en `placeAroundCentreSpot` y el resto de campos del primer lanzador. **La pantalla lo rodea ENTERO, lanzador incluido**: `drawPlayer` ignora `isPlayerDown` durante toda la fase `'shootout'`, no solo para los quince aparcados, precisamente porque la sonda P6(1) de la B2 avisa de que el primer lanzador puede estar en el suelo. Queda como petición de legibilidad del motor, no como bug vivo. | Etapa B2, carries #2 y #4 |
| M7 | `football-logic/match.ts:409-414` | `clearRefereeCall` en la rama `isRestart` de `judgeShootoutKick` (saque fantasma de un paso). **La pantalla ya lo rodea** (`collectCaptions` salta la rama en `'shootout'`). | Etapa B2, carry #3 |
| M8 | `football-logic/match.test.ts:1472-1474` | Comentario «CY − 80» erróneo: la fila más cercana es `CY − 120`. La aserción es correcta. | Etapa B2, carry #5 |

**Ninguna de estas ocho se toca en el paso 8.** M6 y M7 están cubiertas desde la pantalla con su test; las otras seis son deuda de legibilidad del motor.

- [ ] **C6: Lista de QA manual para Paco (en su `:3000`, ruta `/games/vault-world-cup/play`)**

Claude **no** ejecuta nada de esto. Paco juega y apunta los números; los criterios se revisan después (decisión del spec del 03-sep).

**A. Que arranque y que se vea (criterios 13 y 20)**
1. La cámara sigue al balón y **no se sale del campo**: llevar el balón a las cuatro esquinas y comprobar que la banda de hierba de fuera no crece más de un dedo.
2. El minimapa muestra **los dieciocho** y el recuadro amarillo se mueve con la cámara.
3. Las dos equipaciones se distinguen de un vistazo; los **dos porteros** se distinguen de sus compañeros.
4. **60 fps**: abrir el panel de rendimiento del navegador durante un minuto de juego abierto y anotar si baja de 60. Es el juego con más elementos en pantalla del catálogo (riesgo 5 del spec).

**B. Que se juegue (criterios 5, 7, 10, 11)**
5. El cursor está siempre **sobre el jugador que obedece a la cruceta**, no parpadea, y **nunca sobre el portero salvo los 2 s en que tiene el balón**, con el HUD mostrando `SAQUE: K CORTO · J LARGO` y una cuenta atrás que baja hasta 0 (S-SC3, confirmado — comprobar que la cuenta atrás no desentona con los 2 s reales del motor).
6. Los tres botones: **J** chut con carga — **se encienden una, dos o tres casillas amarillas junto al jugador controlado** (R33: toque = 1 ≈ 700, medio = 2 ≈ 825, mantenido a tope = 3 = 950), y solo aparecen mientras se mantiene J; **K** pase corto al pulsar y largo al mantener, **L** sprint en ráfaga (la barra azul de abajo a la izquierda baja y se recupera). Sin balón: J entrada al suelo, K robo. **Tres cosas que apuntar:** ¿se ven las casillas a 24 px de jugador, o hacen falta más grandes?; ¿se nota la diferencia de potencia entre 2 y 3 casillas al chutar? (si no, es la Task 11 la que decide si `actions.ts` pasa a tres escalones, **no este paso**); y ¿molestan las casillas cuando aparecen, o se echa de menos verlas vacías siempre?
7. **Cambiar alineación (1/2/3) y estrategia (4/5/6) en pleno partido** y ver que el bloque responde en el acto (S-SC1/S-SC5, confirmado). Probar también **P** (pausa, alterna con el botón) y, con el partido terminado, **R** (OTRO PARTIDO) — las dos son atajos nuevos de esta sesión de grill.
8. Durante la cuenta atrás de un saque **los botones no hacen nada**: el aviso `CRUCETA: APUNTAR · SALE SOLO` debe estar en pantalla. ¿Se entiende?

**C. Que las reglas se vean (criterios 9, 10, 12)**
9. Los siete rótulos: forzar INICIO, FALTA, PENALTI, FUERA, CÓRNER, GOL y FINAL. **Aviso medido en la etapa B: los córners son rarísimos (2 en 18 partidos) y los saques de puerta no salen nunca (0 en 18)** — no es un bug de la pantalla.
10. La **celebración de gol fija**: los que marcan con los brazos arriba, los que reciben cabizbajos, durante los 2 s de pausa. ¿Es suficiente o quieres más?
11. Empatar a propósito para ver **PRÓRROGA**, y aguantar los 60 s para ver **PENALTIS**. Comprobar que el reloj de la prórroga **nunca pasa de 1:00** (el recorte de la etapa B2; el caso feo aparece cuando la prórroga se agota durante una cuenta atrás).
12. En la tanda: el marcador de penaltis es el suyo propio y **el del partido sigue empatado**; la cámara **salta de una portería a la otra** entre lanzamientos (S-SC8: ¿se quiere así, o todos a la misma portería?); los quince aparcados están **de pie y quietos** en el círculo central; el aviso `SAQUE: K CORTO · J LARGO` **no** aparece durante la tanda (aunque el portero se quede el balón tras parar un penalti), y bajo el marcador de la tanda se ve la **barra de resolución** de cada lanzamiento. **Repro concreto que hay que intentar (B2, sonda P6(1)):** hacer una entrada al suelo en los últimos segundos de la prórroga y forzar la tanda; **el primer lanzador debe salir de pie**, no tumbado ni deslizando — la pantalla ignora esa pose durante toda la tanda, lanzador incluido. Si sale tumbado, es un bug de esta pantalla, no del motor.
13. Si un lanzamiento se decide en muerte súbita, comprobar que **el rival no llega a lanzar** en esa ronda (regla literal de Paco, S-PK5) y decir si desconcierta.

**D. Viewport (spec, solo desktop)**
14. Reducir la ventana por debajo de **768 × 560** (R35; era 900 × 600) **en pleno partido**. Lo que tiene que pasar, en este orden y **todo dentro del canvas, que sigue dibujándose** (no se congela en el frame anterior):
    - los jugadores dejan de moverse y el teclado deja de responder;
    - en la banda de rótulos aparece `FINAL` y, tras sus tres segundos, **`EMPATE`** (S-SC12: es el único empate posible del amistoso);
    - debajo de esa banda, un panel fijo: **`AGRANDA LA VENTANA` / `MÍNIMO 768 × 560`**;
    - **y se oye el pitido final** (I2 de la revisión final: antes del arreglo el camino entero del guard era mudo);
    - el «Estado» de la página coincide, también `EMPATE`.

    Probar además el **caso feo**: entrar en la ruta con la ventana ya por debajo del umbral. El canvas **no puede quedarse en blanco** — el panel tiene que estar ahí desde el primer frame. El *redirect* y el «deshabilitado en el catálogo» son del paso 10. ¿Es 768 × 560 el umbral que quieres? (S-SC2, R35.)

**E. Audio (tabla del spec)**
15. Suenan: silbato de inicio de cada parte, silbato final, silbato de falta y de penalti, la **cadena de gol de tres sonidos** (red → grito → público), el golpeo al chutar y **2-3 ráfagas de público por parte**. Los volúmenes están en `SFX_VOLUME`: apuntar cuál sobra y cuál falta. **Cuatro comprobaciones concretas de esta revisión:** (a) un gol suena **una vez**, no como una avalancha de mp3 solapados; (b) una falta pita **una vez**, y el rótulo `FALTA` no parpadea reapareciendo; (c) al acabar la **2ª parte empatada** suena el silbato final **y luego** el de inicio de la prórroga — dos pitidos distintos, no dos de inicio seguidos; lo mismo al pasar de la prórroga a la tanda; (d) un **gol de la tanda** suena igual que cualquier otro gol, incluido el que decide el partido.
16. **La entrada al suelo no suena** (S-SC10, no hay fichero): decidir si se queda en silencio o se sintetiza.
17. La música **todavía no suena**: es del paso 10.

**F. Números para apuntar (alimentan el ajuste del paso 11)**
18. Goles por partido, chuts por partido, faltas, penaltis. Referencia medida CPU vs CPU en la etapa B: **1-4 goles, 1-5 chuts, 11 000-16 000 pasos**. Si al jugar tú salen muchos menos chuts de la CPU, es el embudo conocido (`SHOT_POST_MARGIN`, ítem 1 de la lista de QA de la etapa B).
19. ¿Se siente fútbol? Es el riesgo 2 del spec y lo único que ningún test verifica.

- [ ] **C7: Handoff y memoria**

Escribir `tasks/vault-world-cup/HANDOFF-next-session.md` con: estado del paso 8, los supuestos S-SC que Paco haya confirmado o cambiado, los números del QA, y el punto de entrada del **paso 9** (modos, selector de selección, segundo teclado, Mundial, cuadro y las dos pantallas de victoria), recordando que `winnerOf` puede devolver `-1` con el partido `'over'` y que el cuadro tiene que tratarlo como caso vivo.

---

## Supuestos de esta etapa (S-SC)

Todos van **etiquetados en el código** como `// Stage C assumption S-SCn, not in the spec — review in QA`, igual que los S de las etapas B y B2. **S-SC1, S-SC3, S-SC5 y S-SC12 quedaron confirmados en el grill corto del 07-sep** (marcados abajo); el resto sigue abierto para el QA de C6.

| # | Supuesto elegido | Alternativa descartada |
|---|---|---|
| **S-SC1** *(confirmed by owner 2026-09-07)* | **Teclas, tal cual el catálogo:** cruceta = flechas **o** WASD; **J = chut** (botón A, mantener carga la barra amarilla), **K = pase** (botón B, toque = corto, mantener = largo), **L = sprint** (botón C, en ráfaga); **1/2/3 cambian la alineación, 4/5/6 la estrategia** (confirma S-SC5 por extensión); **P alterna pausa** — nuevo: hasta ahora la pausa solo era un botón de la página provisional, ahora también un atajo de teclado (`keydown` propio de `app/games/vault-world-cup/play/page.tsx`, no del `VaultWorldCupGame.tsx`, porque `paused` es estado del padre). Es el mapa que ya usan los trece juegos (`games-registry`, `keyMap` de `MobileGamepad`) más P, así que el mando táctil del paso 10 encaja añadiendo un solo botón de pausa. | Un mapa propio de fútbol (espacio para chutar, sin P). Descartado: rompe el mando compartido y obliga a un `keyMap` distinto. |
| **S-SC2** *(confirmed by owner 2026-09-07 (R35): 768 × 560)* | **Viewport mínimo 768 × 560**: 768 es el breakpoint `md` de Tailwind (tablet mediana) y 560 deja sitio al canvas de 500 más la fila de HUD de la página. Por debajo, el partido se para con `abandon()`. **El repo no tiene ninguna guarda de viewport**: estos son los dos primeros umbrales del proyecto. El canvas mide 800 de ancho y se dibuja con `maxWidth: 100%`, así que entre 768 y 800 se escala en vez de recortarse. | **900 × 600** (`VIEW_W + 100`, `VIEW_H + 100`), el umbral del primer borrador: rechazado por el dueño en la revisión final — dejaba fuera una ventana de 800 × 600 y un portátil de 13" en pantalla partida. El breakpoint `lg` (1024), descartado por lo mismo. |
| **S-SC3** *(confirmed by owner 2026-09-07)* | **El cursor se mueve al portero** durante los 2 s en que tiene el balón, y el HUD escribe `SAQUE: K CORTO · J LARGO` **con la cuenta atrás** en segundos (contador propio de la pantalla, `keeperHoldSteps`, porque el motor solo expone el booleano `keeperHoldsBall`, no un `stepsLeft`). Cierra el gate 3 de la etapa B: el motor deja `controlled` en un jugador de campo a propósito y deja la decisión a la pantalla. | Dejar el cursor en el jugador de campo. Descartado por el propio informe: dos segundos con el cursor en alguien que no obedece se leen como un bug. |
| **S-SC4** *(confirmed by owner 2026-09-07, R33)* | **La carga del chut se dibuja como TRES casillas junto al jugador controlado**, encima del cursor, no como barra continua en el HUD. Se rellenan con la carga real del motor mientras se mantiene J, y los umbrales son la rampa de `actions.ts` (`chargeSegments` sobre `SHOT_CHARGE_STEPS`): toque = 1 casilla (700), medio = 2 (≈825), a tope = 3 (950). Solo dibujo: **el motor no cambia en el paso 8**; si el QA pide que la potencia pase también a tres escalones, son dos líneas de `actions.ts` y las decide la Task 11, anotado en el handoff C7. La barra amarilla continua del HUD **se borra**; abajo a la izquierda solo queda la del sprint. | **La barra continua en el HUD** (el borrador anterior de este mismo supuesto): rechazada por el dueño — una barra no dice qué chut vas a pegar, tres casillas sí. También descartado un arco creciendo alrededor del jugador, por tamaño. |
| **S-SC5** *(confirmed by owner 2026-09-07, by extension of S-SC1)* | **1/2/3 cambian la alineación; 4/5/6 la estrategia.** Fila de números, sin colisión con la cruceta ni con J/K/L. | Q/W/E y Z/X/C. Descartado: `W` es la cruceta y `C` se confunde con el botón C. |
| **S-SC6** | **`PITCH_MARGIN = 60`**: la cámara puede enseñar 60 unidades de fuera de banda por cada lado, para que las porterías no queden pegadas al borde del canvas. | Recorte estricto al campo. Descartado: la portería quedaría cortada por el marco. |
| **S-SC7** | **Sin interpolación**, y seguimiento suave con `CAMERA_LAG = 0.12`. Se dibuja el estado del paso, como los trece juegos anteriores. | Interpolar posiciones entre pasos. Descartado: a 60 Hz de simulación y 60 Hz de pantalla no se nota, y añade una copia del estado por frame que rompería el criterio 20. |
| **S-SC8** | **En la tanda la cámara CORTA** al punto de penalti de la portería que toca, que **alterna** por S-PK8. | Un barrido suave de 1 600 unidades entre lanzamientos. Descartado: tardaría más que el lanzamiento. *(S-PK8 sigue siendo un supuesto del motor: si Paco prefiere una sola portería, cambia el motor, no la pantalla.)* |
| **S-SC9** | **Rótulo `DESCANSO`** en el descanso, que el spec no lista. La tabla de audio ya pita al final de cada parte, y tres segundos de congelación sin texto se leen como un cuelgue. | Dejar el descanso mudo. Descartado por lo anterior. |
| **S-SC10** | **La entrada al suelo no suena** en la v1. No hay fichero y el spec deja la decisión pendiente. | Sintetizar un golpe breve con WebAudio. Descartado hoy: mezclaría síntesis con la biblioteca de ficheros por una sola señal. **Pendiente de Paco.** |
| **S-SC11** | **La tercera parte de la cadena de gol (público) suena a 0,7 s** de empezar la celebración, para que responda al grito en vez de solaparlo. | Los tres a la vez. Descartado: se pisan. |
| **S-SC12** *(confirmed by owner 2026-09-07)* | **El final del amistoso, sin modos, son rótulos sobre el partido**: `FINAL` (con el pitido de `whistle_end`, ya cableado) y después `GANADOR`, `ELIMINADO` o, **solo si se abandona por viewport, `EMPATE`** (S-PK5: la muerte súbita siempre da un ganador, así que abandonar es el único empate posible); el componente llama a `onMatchEnd(winner)` y se queda con la última imagen congelada. La página provisional ofrece «OTRO PARTIDO» **y la tecla `R`** (solo activa con el partido terminado), ambas por **remonte** del componente — sigue siendo el paso 9 el que sustituye esto por una pantalla propia. | Una pantalla de victoria con confeti. Descartado: es explícitamente del paso 9. |
| **S-SC13** | **La semilla del amistoso es `Date.now()`**, tomada en el componente (nunca en `football-screen/` ni en el motor), y de ella salen **tres streams** por aritmética entera: partido, CPU (`^ CPU_SEED_SALT`) y ambiente (`ambienceSeedFor`). La prop `seed` permite fijarla, que es lo que hará el Mundial del paso 9. | Un `Math.random()` en la página. Descartado: la semilla es lo que hace reproducible un partido y es la puerta del online. |
| **S-SC14** | **La página provisional vive ya en la URL definitiva** `/games/vault-world-cup/play`, marcada como provisional, y el paso 10 la reescribe entera. | Una ruta aparte tipo `/games/vault-world-cup/dev`. Descartada: obligaría a Paco a cambiar de URL entre el paso 8 y el 10 y dejaría una ruta muerta que borrar. |

**Además, dos cosas que el paso 8 NO decide y el 10 sí:** el **slug** definitivo del juego (el spec dice `vault-world-cup`, pero la carátula que puso Paco es `public/covers/vault-futbol.png` y los mp3 llevan prefijo `vault-futbol`), y la entrada en `GameId`/`GAMES` con las instrucciones de los tres botones.

---

## Self-Review

**1. Cobertura del spec (§Etapa C, paso 8).** Recorrido el enunciado frase a frase:

| Requisito del paso 8 | Dónde |
|---|---|
| `VaultWorldCupGame.tsx` | Task 8-5 |
| Los SFX | Task 8-4 (`lib/sfx-vault-world-cup.ts` + `sfx-map.ts`) |
| Cámara que sigue al balón | Task 8-2 `camera.ts`, cableada en `runStep` |
| Minimapa | Task 8-2 `minimap.ts`, `drawMinimap` |
| Campo y jugadores con las equipaciones | Task 8-5 `drawPitch`, `drawPlayer` (lee `TeamDef.kit`) |
| HUD con marcador y reloj | Task 8-3 `hud.ts`, `drawHud` |
| Teclado | Task 8-1 `keyboard.ts`, handlers de la 8-5 |
| Fase de saque dibujada con su cuenta atrás | Task 8-5 `drawSetPiece` + `countdownSeconds` |
| Rótulos de gol y de ELIMINADO | Task 8-3 `captions.ts`, `drawCaption` |
| Un solo amistoso contra la CPU, sin modos | Task 8-5, `HUMAN_TEAM`/`CPU_TEAM`, dificultad 5, sin pantallas de flujo |
| Criterio 13 (cámara sin salirse, minimapa con los 18) | Tests de `camera.test.ts` y `drawMinimap` |
| Criterio 20 (sin asignaciones por frame) | Global Constraints + Task 8-5 step 10 |
| Criterio 21 (la suite no baja de 916) | Cierre C1 |
| Viewport (parada + salida) | Task 8-5 `viewport-guard.ts` + `handleResize` |
| Celebración de gol fija, sin árbitro dibujado | `drawPlayer`, rama `phase === 'goal'`; no hay ninguna figura de árbitro |

**Gaps encontrados y cerrados durante la revisión:** (a) faltaba el rótulo del descanso, que el spec no lista pero la tabla de audio implica → S-SC9 y `CAPTION_TEXT['half-time']`; (b) faltaba decir quién dispara el **primer** eslabón de la cadena de gol (la red) al no ser un rótulo → cableado en `runStep` sobre `scratch.call.kind === 'goal'`; (c) faltaba el silbato de **cada lanzamiento** de la tanda, que el spec pide y que no es un cambio de fase → detectado por el cambio de `taken`, como manda el informe de la B2.

**Lo que el plan deja explícitamente fuera y por qué:** modos, selector de selección, segundo teclado, Mundial, cuadro y pantallas de victoria (paso 9); registro, migración, música, carátula, play-page definitiva y el «deshabilitado en el catálogo» (paso 10); postes y larguero con su SFX (v1.5).

**2. Barrido de placeholders.** Ni «TBD», ni «implementar después», ni «similar a la tarea N», ni «añadir el manejo de errores adecuado». Los tests van escritos enteros, no descritos. Los dos únicos sitios donde el plan dice «mirar antes de escribir» son deliberados y accionables: el paso 1 de la Task 8-4 (copiar los nombres de los mp3 del `ls`, porque llevan tildes y comas y **no** deben teclearse de memoria, con un test que lo verifica contra el disco) y el recuento de tests de cada cierre (que se anota, no se inventa). La Task 8-5 no tiene test unitario **por una razón medida**: no hay `vitest.config` ni entorno DOM en el repo, y ninguno de los trece juegos anteriores tiene test de componente; su verificación es `tsc` + `build` + lectura de asignaciones + la lista de QA de C6.

**3. Consistencia de tipos y nombres.** Comprobados uno a uno contra el código real de `components/games/football-logic/` de hoy:
- `stepMatch(match, inputs, rng)`, `createMatch(teams, formationTable, pitch, profiles)`, `decideTeamInput(match, team, profile, state, rng, out)`, `createAiState()`, `profileFor(def, difficulty)`, `humanProfile(def, difficulty)`, `winnerOf(match)`, `abandon(match)`, `isOpenPlay(phase)`, `createRng(seed)`, `createTeamInput()`, `checkTeamInput(input, formationCount)`, `isPlayerDown(p, stepCount)`, `isSprinting(p)`, `teamById(teams, id)`, `createShootoutState()`, `shootoutRoundLabel` sobre `ShootoutState` real (`taken`, `scored`, `team`, `takerId`, `suddenDeath`, `resolveStepsLeft`).
- Constantes: `STEP_MS`, `STEPS_PER_SECOND`, `HALF_SECONDS`, `HALF_STEPS`, `EXTRA_TIME_STEPS`, `GOAL_PAUSE_STEPS`, `HALF_TIME_PAUSE_STEPS`, `SHOOTOUT_ROUNDS`, `SHOOTOUT_RESOLVE_STEPS`, `SHOT_CHARGE_STEPS`, `PLAYER_RADIUS`, `SPRINT_STEPS`, `SPRINT_COOLDOWN_STEPS`, `TEAM_SIZE`, `FORMATION_COUNT`, `PITCH`. **`SET_PIECE_COUNTDOWN_STEPS` ya NO aparece:** el saque se dibuja con `countdownSeconds(sp.stepsLeft)` y nada más lo usaba (H10).
- Campos de `PlayerState` usados en el dibujo: `id`, `team`, `role`, `x`, `y`, `facingX`, `facingY`, `chargeSteps`, `sprintStepsLeft`, `sprintCooldownSteps` — **`facingX`/`facingY`, no `facing`**, que es el nombre del spec y no el del código.
- Campos de `MatchState`: `teams`, `players`, `ball`, `score`, `half`, `phase`, `setPiece`, `shootout`, `stepCount`, `controlled`, `halfStep`, `pauseStepsLeft`, `formationIndex`, `strategies`, `lastGoalTeam`, `profiles`, `scratch.events`, `scratch.call` (cuyo `kind` es el `CallKind` de `referee.ts`, que `MatchWatch.call` recuerda de un paso al siguiente).
- Nombres propios del plan, iguales en todas las tareas: `planSteps`/`StepBudget`, `padToTeamInput(pad, first, out)` (el `first` aparece con el mismo significado en la 8-1 y en la 8-5), `cursorPlayerId(match, team)`, `collectCaptions(match, w, humanTeam, cs)`, `sfxForCaption`, `planAmbience(rng, halfSteps, out)`, `frameMode(phase, paused, blocked)`, `chargeSegments(chargeSteps)`, `goalNetDue(match, w)` / `halfEndWhistleDue(match, w)` (los dos sobre el mismo `MatchWatch` que `collectCaptions`), `viewportAllowed(width, height)`, `VaultWorldCupSfx` con los ocho nombres en `snake_case` (como `VaultFighterSfx`), y `sfxVaultWorldCup` como singleton.

**Inconsistencia propia encontrada y corregida.** El esqueleto de la Task 8-5 llamaba a `planAmbience` con `match.pitch.width` para poder compilar antes de que existiera `update()`, y el paso 4 la sustituía por `HALF_STEPS` a secas — que compila y pasa la suite igual de verde, pero está mal: la prórroga (`half === 3`) dura `EXTRA_TIME_STEPS` (3 600), bastante menos que una parte (5 400), así que con `HALF_STEPS` fijo la capa de ambiente reparte las marcas sobre una ventana la mitad más larga que la que `ambienceDue` compara contra `match.halfStep`. **Medido sobre las semillas 1..12:** la primera marca cae **siempre** por debajo de 3 600, así que lo que se pierde es la segunda ráfaga, o la segunda y la tercera — **no todas**, como decía el primer borrador de este párrafo. Ningún test lo atrapaba porque `planAmbience` acepta cualquier número como `halfSteps` y todos los tests existentes solo lo llamaban con `HALF_STEPS`. **Cerrada por tres vías:** el esqueleto ya nace correcto (`let ambienceCount = 0;` y `planAmbienceForHalf(1)`, sin placeholder intermedio que recordar sustituir); `planAmbienceForHalf` usa `halfCapSteps(half)` —la misma función, ya probada, que `hud.ts` usa para el reloj— en vez de un literal; y `sfx-map.test.ts` (Task 8-4, Step 6) suma las dos aserciones que la atrapan, con el fixture **fijado a `ambienceSeedFor(2, 3)`** y un `expect(n).toBe(AMBIENCE_MAX)` delante: con `count = 2` la última marca cruza el tope según la semilla (1 y 4 dan 3 396 y 3 260, por debajo) y el test habría salido rojo por la razón equivocada — exactamente la clase de fixture que la regla anti-coincidencia del riesgo 7 existe para cazar.

**4. Hallazgo del pre-vuelo, ya resuelto.** Al comprobar los nombres de los mp3 contra el disco había aparecido una trampa que ningún informe recogía: cuatro de los doce ficheros de `public/` estaban guardados en Unicode NFD, invisible a `existsSync` en el Mac de Paco pero no en el Linux de Vercel. **Los doce ficheros se renombraron el 2026-09-07** (`git mv`, slugs kebab-case en ASCII plano) precisamente para eliminar esa trampa de raíz, así que el plan ya no necesita el diagnóstico: el test sigue comparando contra `readdirSync` con igualdad de cadena (barato y ya no imprescindible, pero sigue cazando un nombre mal copiado) y el paso 1 de la Task 8-4 solo pide copiar del `ls`.

**5. Los quince hallazgos del pre-vuelo, aplicados.** `.superpowers/sdd/2026-09-07-vault-world-cup-stage-c-screen/preflight.md`, aplicado entero el 07-sep antes de ejecutar una sola tarea:

| # | Qué era | Dónde queda arreglado |
|---|---|---|
| **H1** | R33 sin implementar: seguía la barra continua de S-SC4 | 8-3 (`SHOT_CHARGE_SEGMENTS`, `chargeSegments` + test de bordes), 8-5 (`drawPlayer` dibuja las tres casillas; se borra la barra del HUD), fila S-SC4, QA C6-6 |
| **H2** | `scratch.call` leído como flanco cuando es un nivel de 301/421 pasos (medido) | 8-3 (`MatchWatch.call` + guarda `!== w.call` + test del paso siguiente), 8-4 (`goalNetDue`), 8-5 (`runStep` punto 2) |
| **H3** | `padAdvance` por frame se comía las pulsaciones en frames de 0 pasos | 8-5 (`if (budget.steps > 0)`), 8-1 (test «a press survives a frame in which no step ran» + comentario en `padAdvance`) |
| **H4** | Con el partido `'over'` no se pintaban GANADOR/ELIMINADO/EMPATE | 8-1 (`frameMode` + sus tests), 8-3 (test del relevo de la cola), 8-5 (`update`/`loop`/`stepCaptionsOnly`) |
| **H5** | `blocked` mataba el dibujo: el EMPATE del QA era infalsable | 8-1 (`frameMode('…', …, true)`), 8-5 (`handleResize` con su pasada de `collectCaptions`, `drawBlocked`), QA C6-14 |
| **H6** | El fixture del test de regresión de la prórroga salía **rojo** | 8-4 (`ambienceSeedFor(2, 3)` + `expect(n).toBe(AMBIENCE_MAX)`) |
| **H7** | Faltaban dos `whistle_end` y sobraba un `whistle_start` | 8-4 (`halfEndWhistleDue` + 4 tests), 8-3 (`extraTimeNow` + su test), 8-5 (`runStep` punto 2b) |
| **H8** | `goal_net` mudo en la tanda salvo en el gol decisivo | 8-4 (`goalNetDue` sin exclusión por fase: **la red suena en la tanda**, que es lo que dice la tabla del spec) |
| **H9** | El aviso del portero se pintaba en la tanda, encima del marcador | 8-5 (`isOpenPlay(match.phase) &&` + tope de `keeperHoldSteps`), QA C6-12 |
| **H10** | Cuatro símbolos sin consumidor que C4 habría firmado | 8-5 (tres imports borrados, `SHOOTOUT_RESOLVE_STEPS` cableado a la barra de resolución), 8-1 (`MAX_FRAME_MS` eliminado por inerte), C4 con su recorrido inverso |
| **H11** | Tres tests tautológicos + el test de flanco que la constraint L38 exige | 8-3 (`clockText` sobre `halfStep`, `CAPTION_QUEUE_MAX`, `smallNumber(3)`) y el de H2 |
| **H12** | Tres recuentos de tests mal | 8-1, 8-2, 8-3, 8-4 y la tabla de C1 |
| **H13** | `handleKeyUp` sin capar y `padUp` marcando `'released'` desde `'up'` | 8-1 (`releaseButton`, `padClear` + 2 tests), 8-5 (`handleKeyUp`) |
| **H14** | La sustitución de `planAmbience` sin escribir y el motivo exagerado | 8-5 Step 3 (`let ambienceCount = 0;` + `planAmbienceForHalf(1)`), comentario de `planAmbienceForHalf` y este mismo párrafo |
| **H15** | `parked` dejaba fuera al lanzador, que la B2 avisa que puede estar tumbado | 8-5 (`down` excluye toda la fase `'shootout'`, **lanzador incluido**), C5/M6, QA C6-12 |
