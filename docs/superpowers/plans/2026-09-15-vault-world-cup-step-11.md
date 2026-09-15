# Vault World Cup — Etapa D, paso 11 (ola de ajustes visuales) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la ola de ajustes visuales del paso 11 — jugador cenital (cabeza + hombros orientados), portero que se estira al atajar, chut con altura legible (sombra + escala del balón) y gol visible (red dibujada como rejilla estática con el balón dentro) — **sin tocar una sola línea del motor** y sin asignar memoria por frame.

**Architecture:** Cada pieza se parte en dos: la geometría y los temporizadores viven en módulos puros nuevos de `components/games/football-screen/` (`ball-view.ts`, `gestures.ts`, `player-pose.ts`, `goal-net.ts`), cada uno con su test de vitest y su estado preasignado una vez (el molde de `particles.ts`); el `.tsx` solo traza con `ctx` leyendo lo que esos módulos calculan. El gesto del portero es un temporizador **de pantalla** arrancado por el evento `'gk-catch'` que el motor ya emite (`ActionEvent` en `match.scratch.events`), exactamente el patrón que `sfx-map.ts` usa para el sonido: el motor no se entera de que existe. El gol visible resulta ser **dibujo puro** (ver la nota de G11-4 abajo): el motor ya congela el balón donde cruzó la línea durante los 120 pasos de la celebración, así que basta pintar la red **dentro de `drawPitch`** (antes que el balón) para que el balón quede encima y se vea dentro de la portería.

**Tech Stack:** TypeScript estricto, React 19.2.4, Next 16.2.6 (App Router), canvas 2D 800 × 500, vitest 4.1.11 (tests `*.test.ts` junto al código, **sin `vitest.config`**, entorno Node sin DOM, **imports relativos** — el alias `@/` no existe en vitest).

**Spec:** `specs/31-vault-world-cup.md` (Approved) — criterio 20 (§Criterios de aceptación, «Calidad»), bullets «Primer QA jugado del paso 8 (Paco, 2026-09-09)» puntos 2 y 3, «QA jugado del paso 9 (Paco, 2026-09-11)» puntos 2, 3, 4 y 6, y **«Grill corto del paso 11 (Paco, 2026-09-15)» con G11-1..G11-6, que son ley** y no se reabren en este plan.
**Informe obligatorio:** `.superpowers/sdd/2026-09-15-vault-world-cup-step-11/design-brief.md` entero (276 líneas: hechos con fichero:línea §1, opciones por ítem §2, preguntas ya resueltas por el grill §3).
**Código a imitar:** `components/games/football-screen/particles.ts` (depósito preasignado una vez, arrays tipados, nada asigna después de `createParticlePool`; el comentario de su cabecera es la norma de este paso) · `components/games/football-screen/particles.test.ts` · `components/games/football-screen/camera.ts` + `camera.test.ts` (funciones puras sobre un objeto plano, escritura in-place, imports relativos) · `components/games/football-screen/sfx-map.ts:97-114` (`shotFiredThisStep` / `shortPassFiredThisStep`: barrido de los 18 slots de `scratch.events` buscando `kind === X && ok` — el molde exacto de `beginGkCatchGestures`) · `components/games/football-screen/match-run.test.ts:38-55` (partido CPU completo y determinista dentro de un test).
**Código a modificar:** `components/games/VaultWorldCupGame.tsx` — imports (51-58), constantes de color (96-118) y de tamaño (146-156), preasignación del efecto (307-322), `startMatch` (419-433), `runStep` (614-630), `drawPitch` (781-844), `drawPlayer` (863-961), `drawBall` (976-996).
**Ledger de este paso:** `.superpowers/sdd/2026-09-15-vault-world-cup-step-11/progress.md` (ya existe, 5 líneas; cada tarea le añade **una** línea al cerrar).

---

## Global Constraints

**Los requisitos de cada tarea incluyen implícitamente esta sección.**

### Las seis decisiones del grill (copiadas literalmente del spec, `specs/31-vault-world-cup.md`)

- **G11-1 · Jugador cenital**: cabeza + hombros orientados con `facingX/facingY` (dirección de movimiento/disparo, ya en `PlayerState`); solo `drawPlayer`, cero asignaciones por frame. Mismo dibujo para las estatuas del ENTRENAMIENTO y los aparcados de la tanda (sin rama nueva).
- **G11-2 · Portero que se estira**: gesto visual disparado por el evento de atajada, ~35 pasos (~0,6 s), vuelve a la pose normal antes de sacar. Motor intacto.
- **G11-3 · Chut con altura**: sombra + escala del balón a partir de `ball.z` tal cual; NO se tocan `SHOT_VZ_MAX` ni la gravedad en este paso. Si tras jugarlo sigue plano → tarea aparte con regrabado de partidos deterministas.
- **G11-4 · Gol visible**: el balón se queda dentro de la portería durante la celebración, con red dibujada como rejilla estática. **Red que ondula → v1.5.**
- **G11-5 · Minimapa**: ya está dentro del campo y semitransparente; se valida en el QA jugado, sin tarea de código salvo feedback explícito.
- **G11-6 · Calendario**: plan + pre-vuelo el 15-sep; ejecución SDD el 16-sep; QA jugado de Paco después.

### Criterio 20 del spec (copiado literalmente)

> 20. **Ninguna asignación de memoria por frame** en el bucle ni en el dibujo, incluido el confeti (depósito de partículas creado una vez).

Traducción operativa para este paso, sin excepciones: ningún `new`, ningún literal de objeto o array, ninguna plantilla ni concatenación de strings, ningún `.map/.filter/.slice`, ningún `Math.sqrt`/`Math.atan2` **dentro de `draw()` ni de `runStep()`**. Todo lo que se escribe por frame se escribe **in place** en un objeto creado una vez en el efecto (`pose`, `dive`, `gestures`). Las únicas raíces cuadradas nuevas de todo el paso ocurren en `beginGkCatchGestures`, **sobre un evento** (una atajada), no por frame.

### Reglas del repo

- **Commits: SOLO Paco.** Ninguna tarea ejecuta `git add` ni `git commit`. Cada tarea termina dejando el working tree **verificado** y **proponiendo el mensaje de commit exacto**. Rama `main`. HEAD de hoy: `ab3372c`. El working tree ya trae **un** cambio de Paco previo a este plan, que no es tuyo: `specs/31-vault-world-cup.md` modificado (las decisiones G11 recién añadidas). No lo toques ni lo incluyas en tu propuesta.
- **NUNCA arrancar `next dev` ni `next build`.** Paco tiene el suyo en `:3000`. La verificación de cada tarea es `npx vitest run <fichero>` → `npx vitest run` → `npx tsc --noEmit` → `npx eslint <ficheros tocados>`. **El QA visual lo hace Paco** con la lista que deja escrita la tarea de cierre.
- **EL MOTOR NO SE TOCA. Cero excepciones en este paso.** Al cerrar **cada** tarea, `git diff --stat ab3372c -- components/games/football-logic/` debe salir **VACÍO**. Si una tarea necesita un export del motor que no existe (por ejemplo `GRAVITY`, que `ball.ts:21` declara sin exportar), **no se añade**: se resuelve en la capa de pantalla o se anota en la lista «Peticiones separadas al motor» del cierre.
- **Determinismo (criterio 1):** nada de este paso puede tocar el estado del motor ni tirar de ninguna rng. Los módulos nuevos **leen** `MatchState` y no escriben en él. Al cerrar cada tarea: `grep -rn "Math.random" components/games/football-screen/` debe devolver **VACÍO** (tests incluidos), y ningún fichero nuevo importa React ni toca `document`, `window`, `canvas` ni `Audio`.
- **Baseline verificada hoy (2026-09-15, HEAD `ab3372c`, `npx vitest run` ejecutado al escribir este plan): 1213 tests en 70 ficheros verdes.** Cada tarea **suma** tests y no regresa ninguno. Ningún test existente cambia de valor esperado en todo el paso.
- **Tests con imports RELATIVOS** (`from './gestures'`, `from '../football-logic/players'`). El alias `@/` funciona en Next pero **no** en vitest: un test con `@/` no arranca.
- **Comentarios y nombres de tests en inglés** (convención del repo). El plan, el spec y el chat, en castellano. Los textos de UI van en castellano y en mayúsculas (este paso no añade ninguno).
- **Ficheros en kebab-case**, salvo `VaultWorldCupGame.tsx`. Tipos en PascalCase, `SCREAMING_CASE` para constantes de módulo. TypeScript estricto: nada de `any`, **nada de `as`** para tapar un tipo, ningún `!` nuevo.
- **Un test que pasa no prueba nada hasta verlo fallar** (riesgo 7 del spec y regla de Paco). En cada tarea, el paso «ver el test en rojo» es obligatorio y su resultado esperado está escrito literalmente.

### La respuesta a la pregunta abierta de G11-4 (medida hoy, no supuesta)

**Caso A: el motor YA deja el balón donde cruzó la línea durante toda la celebración.** `stepMatch` (`components/games/football-logic/match.ts:563-572`) despacha la fase `'goal'` a una rama que **solo** hace `match.pauseStepsLeft--` y, al llegar a cero, `endGoalPause`: no llama a `stepOpenPlay` ni a ninguna física, así que el balón (y los dieciocho) quedan **congelados** exactamente donde estaban. Y donde estaban es dentro de la boca de la portería: `judgeBall` (`football-logic/referee.ts:50-56`) canta gol cuando `ball.x < 0` o `ball.x > pitch.width` con `ball.z < crossbarHeight`, y `stepOpenPlay` (`match.ts:433-437`) llama a `scoreGoal` **sin** reubicar nada; `scoreGoal` (`match.ts:186-195`) solo pone `phase='goal'` y `pauseStepsLeft = GOAL_PAUSE_STEPS` (120). La reubicación al centro llega 120 pasos después, en `endGoalPause` → `startKickoff` (`match.ts:197-200` y `103-106`).

**Consecuencia para el plan:** la Task 11-4 es **dibujo puro**. No hay «posición del último gol» que guardar, ni balón fantasma, ni nada que leer del `RefereeCall`. Lo único que hay que garantizar es el **orden de dibujo**: la red se pinta dentro de `drawPitch()`, que corre **antes** que `drawBall()`, de modo que el balón congelado queda encima de la rejilla. La Task 11-4 incluye el test que convierte esta medición en una aserción ejecutable, para que un cambio futuro del motor la rompa en vez de estropear el dibujo en silencio.

---

## Mapa de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `components/games/football-screen/ball-view.ts` **(nuevo)** | Altura del balón → pantalla: elevación, escala del balón, escala y desvanecido de la sombra. Sin estado. | 11-1 |
| `components/games/football-screen/ball-view.test.ts` **(nuevo)** | Sus tests. | 11-1 |
| `components/games/football-screen/gestures.ts` **(nuevo)** | Temporizadores de gesto **de pantalla**, preasignados por índice de jugador (18 slots): arranque desde el evento `'gk-catch'`, progreso 0..1, curva del estirón. | 11-2 |
| `components/games/football-screen/gestures.test.ts` **(nuevo)** | Sus tests. | 11-2 |
| `components/games/football-screen/player-pose.ts` **(nuevo)** | Geometría cenital: cabeza + hombros a partir de `facing`, y cuerpo estirado del portero a partir de la dirección del estirón. Escribe in place, sin trigonometría. | 11-3 |
| `components/games/football-screen/player-pose.test.ts` **(nuevo)** | Sus tests. | 11-3 |
| `components/games/football-screen/goal-net.ts` **(nuevo)** | Rejilla de la red (cuántas líneas caben) + `GOAL_MOUTH_DEPTH` (se muda aquí desde el `.tsx`) + predicado «el balón está dentro de la boca». | 11-4 |
| `components/games/football-screen/goal-net.test.ts` **(nuevo)** | Sus tests **+ la prueba ejecutable del Caso A** (el motor congela el balón dentro de la portería los 120 pasos). | 11-4 |
| `components/games/football-screen/view-pipeline.test.ts` **(nuevo)** | Sonda sin canvas: tres partidos CPU completos pasados por los cuatro módulos nuevos, contra un partido de control sin ellos. | 11-5 |
| `components/games/VaultWorldCupGame.tsx` **(modificado)** | Solo trazos con `ctx` y cableado: `drawPlayer` (11-3), `drawPitch` (11-4), `drawBall` + `runStep` + `startMatch` + preasignación (11-5). | 11-3, 11-4, 11-5 |
| `.superpowers/sdd/2026-09-15-vault-world-cup-step-11/progress.md` **(modificado)** | Una línea por tarea al cerrarla. | todas |

**Lo que este paso NO toca, a propósito:** `components/games/football-logic/**` (motor congelado), `minimap.ts` y `drawMinimap` (G11-5: sin tarea de código), `sfx-map.ts` (el sonido del paso 10 ya está y no cambia), `app/games/vault-world-cup/**`, `lib/**`.

---

### Task 11-1: `ball-view.ts` — la altura del balón, en números puros (G11-3)

**Files:**
- Create: `components/games/football-screen/ball-view.ts`
- Test: `components/games/football-screen/ball-view.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores (es la primera).
- Produces, y la Task 11-5 consume literalmente:
  - `BALL_Z_LIFT: number` (0.35), `BALL_Z_REF: number` (50), `BALL_SCALE_MAX: number` (1.6), `BALL_SHADOW_MIN: number` (0.55), `BALL_SHADOW_FADE_MIN: number` (0.45)
  - `ballHeightFraction(z: number): number` → 0..1
  - `ballLift(z: number): number` → píxeles que sube el balón dibujado
  - `ballScale(z: number): number` → 1..`BALL_SCALE_MAX`, multiplica `BALL_RADIUS`
  - `ballShadowScale(z: number): number` → 1..`BALL_SHADOW_MIN`, multiplica los dos radios de la elipse de sombra
  - `ballShadowFade(z: number): number` → 1..`BALL_SHADOW_FADE_MIN`, se aplica con `ctx.globalAlpha` (un número: **no** se construye ningún `rgba(...)` por frame)

**Contexto que el ejecutor no tiene:** hoy `drawBall` (`VaultWorldCupGame.tsx:976-996`) ya sube el balón con `y - b.z * 0.35`, pero dibuja **siempre** `BALL_RADIUS = 6` y una sombra fija. El apogeo de un chut a tope es `SHOT_VZ_MAX² / (2 · GRAVITY)` = `200² / 1800` ≈ **22,2 unidades** → 7,8 px de desplazamiento, por debajo del radio de un jugador (12 px): se ve, pero poco. El pase largo (`LONG_PASS_VZ = 280`) llega a ≈ 43,6. `crossbarHeight` es 50 (`football-logic/pitch.ts`) y es el techo natural: un balón a 50 ya no puede entrar en portería. Por eso `BALL_Z_REF = 50` es la referencia de «balón alto» y no un número inventado. **G11-3 prohíbe tocar `SHOT_VZ_MAX` y la gravedad**, y este plan además **conserva `BALL_Z_LIFT` en el 0.35 exacto de hoy** (solo lo bautiza): así el QA de Paco juzga la escala y la sombra por separado, y subir la elevación queda como palanca siguiente, anotada en la lista de QA.

- [ ] **Step 1: Escribir el test en rojo**

Crea `components/games/football-screen/ball-view.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PITCH } from '../football-logic/pitch';
import {
  BALL_SCALE_MAX, BALL_SHADOW_FADE_MIN, BALL_SHADOW_MIN, BALL_Z_LIFT, BALL_Z_REF,
  ballHeightFraction, ballLift, ballScale, ballShadowFade, ballShadowScale,
} from './ball-view';

// The two heights this game actually produces, from the engine's own numbers:
// a full-power shot peaks at SHOT_VZ_MAX^2 / (2 * GRAVITY) = 200^2 / 1800, and a
// long pass at LONG_PASS_VZ^2 / (2 * GRAVITY) = 280^2 / 1800. GRAVITY is NOT
// exported by ball.ts and this step does not touch the engine to export it, so the
// two apexes are written here as the literals the formula gives.
const SHOT_APEX = 22.2;
const LONG_PASS_APEX = 43.6;

describe('ballHeightFraction', () => {
  it('is 0 on the ground and 1 at the crossbar, and never leaves 0..1', () => {
    expect(ballHeightFraction(0)).toBe(0);
    expect(ballHeightFraction(BALL_Z_REF)).toBe(1);
    expect(ballHeightFraction(BALL_Z_REF * 3)).toBe(1);
    expect(ballHeightFraction(-5)).toBe(0);
  });

  it('grows with the height, strictly, between the two ends', () => {
    expect(ballHeightFraction(SHOT_APEX)).toBeGreaterThan(ballHeightFraction(SHOT_APEX / 2));
    expect(ballHeightFraction(LONG_PASS_APEX)).toBeGreaterThan(ballHeightFraction(SHOT_APEX));
  });

  it('uses the crossbar as its reference: a ball above it cannot be a goal anyway', () => {
    expect(BALL_Z_REF).toBe(PITCH.crossbarHeight);
  });
});

describe('ballLift', () => {
  it('keeps the multiplier the screen has used since step 8 (0.35), untouched by G11-3', () => {
    expect(BALL_Z_LIFT).toBe(0.35);
    expect(ballLift(100)).toBeCloseTo(35, 6);
  });

  it('is 0 on the ground and never negative', () => {
    expect(ballLift(0)).toBe(0);
    expect(ballLift(-9)).toBe(0);
  });
});

describe('ballScale', () => {
  it('is 1 on the ground and BALL_SCALE_MAX at the crossbar', () => {
    expect(ballScale(0)).toBe(1);
    expect(ballScale(BALL_Z_REF)).toBeCloseTo(BALL_SCALE_MAX, 6);
    expect(ballScale(BALL_Z_REF * 10)).toBeCloseTo(BALL_SCALE_MAX, 6);
  });

  it('makes a full-power shot visibly bigger: at least 20 % at its apex', () => {
    expect(ballScale(SHOT_APEX)).toBeGreaterThan(1.2);
  });

  it('makes a long pass bigger than a shot, because it flies higher', () => {
    expect(ballScale(LONG_PASS_APEX)).toBeGreaterThan(ballScale(SHOT_APEX));
  });
});

describe('the shadow', () => {
  it('is full size and fully opaque on the ground', () => {
    expect(ballShadowScale(0)).toBe(1);
    expect(ballShadowFade(0)).toBe(1);
  });

  it('shrinks and fades as the ball climbs, bottoming out at the crossbar', () => {
    expect(ballShadowScale(BALL_Z_REF)).toBeCloseTo(BALL_SHADOW_MIN, 6);
    expect(ballShadowFade(BALL_Z_REF)).toBeCloseTo(BALL_SHADOW_FADE_MIN, 6);
    expect(ballShadowScale(SHOT_APEX)).toBeLessThan(1);
    expect(ballShadowFade(SHOT_APEX)).toBeLessThan(1);
  });

  it('never disappears: the shadow is the cue that says where the ball will land', () => {
    expect(ballShadowScale(BALL_Z_REF * 5)).toBeGreaterThan(0.3);
    expect(ballShadowFade(BALL_Z_REF * 5)).toBeGreaterThan(0.3);
  });

  it('moves the opposite way to the ball: the higher it is, the bigger the gap between the two', () => {
    expect(ballScale(SHOT_APEX)).toBeGreaterThan(ballShadowScale(SHOT_APEX));
  });
});
```

- [ ] **Step 2: Verlo fallar**

Ejecuta: `npx vitest run components/games/football-screen/ball-view.test.ts`
Esperado: **FALLA** con `Failed to resolve import "./ball-view"` (el módulo no existe todavía).

- [ ] **Step 3: Escribir `ball-view.ts`**

Crea `components/games/football-screen/ball-view.ts`:

```ts
import { PITCH } from '../football-logic/pitch';

// G11-3 (grill del paso 11, QA jugado del 11-sep): a shot has to LOOK like it goes
// up. The engine already gives the height -- ball.z, with SHOT_VZ_MAX 200 and
// GRAVITY 900 that is an apex of 22.2 units for a full-power shot -- and the screen
// already lifted the ball by 0.35 * z since step 8. What was missing is the second
// and third cue: the ball GROWS and its shadow SHRINKS and FADES. G11-3 is explicit
// that SHOT_VZ_MAX and the gravity are NOT touched here, and this module does not
// touch the lift either (BALL_Z_LIFT is the 0.35 the screen already used): if after
// playing it still reads flat, raising them is a separate task with its own replay.
//
// Everything here is a pure number in, pure number out: no state, no allocation, and
// the shadow's fade is a FACTOR for ctx.globalAlpha on purpose -- building an
// 'rgba(0,0,0,' + a + ')' string would allocate once per frame and break criterion 20.

// The crossbar is the natural ceiling of "a high ball": above it nothing can be a
// goal any more, so it is where every cue reaches its end of travel.
export const BALL_Z_REF = PITCH.crossbarHeight; // 50
export const BALL_Z_LIFT = 0.35;
export const BALL_SCALE_MAX = 1.6;
export const BALL_SHADOW_MIN = 0.55;
export const BALL_SHADOW_FADE_MIN = 0.45;

export function ballHeightFraction(z: number): number {
  if (z <= 0) return 0;
  if (z >= BALL_Z_REF) return 1;
  return z / BALL_Z_REF;
}

export function ballLift(z: number): number {
  return z > 0 ? z * BALL_Z_LIFT : 0;
}

export function ballScale(z: number): number {
  return 1 + ballHeightFraction(z) * (BALL_SCALE_MAX - 1);
}

export function ballShadowScale(z: number): number {
  return 1 - ballHeightFraction(z) * (1 - BALL_SHADOW_MIN);
}

export function ballShadowFade(z: number): number {
  return 1 - ballHeightFraction(z) * (1 - BALL_SHADOW_FADE_MIN);
}
```

- [ ] **Step 4: Verlo pasar**

Ejecuta: `npx vitest run components/games/football-screen/ball-view.test.ts`
Esperado: **PASA**, 12 tests.

- [ ] **Step 5: Romperlo a propósito (control negativo, regla de Paco)**

Cambia temporalmente `BALL_SCALE_MAX` a `1` y vuelve a ejecutar el fichero de test.
Esperado: fallan al menos `ballScale` «is 1 on the ground and BALL_SCALE_MAX at the crossbar» **no** (seguiría pasando con 1 === 1), pero **sí** «makes a full-power shot visibly bigger» y «makes a long pass bigger than a shot». Si no falla ninguno, el test es vacuo y hay que arreglarlo antes de seguir. **Deshaz el cambio** y vuelve a verlo verde.

- [ ] **Step 6: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/ball-view.ts components/games/football-screen/ball-view.test.ts
git diff --stat ab3372c -- components/games/football-logic/
```
Esperado: 1225 tests / 71 ficheros verdes (1213 + 12), `tsc` sin salida, `eslint` sin salida, el `git diff` del motor **vacío**.

- [ ] **Step 7: Anotar en el ledger**

Añade una línea a `.superpowers/sdd/2026-09-15-vault-world-cup-step-11/progress.md`:
`16-sep — Task 11-1 hecha: ball-view.ts + 12 tests (1225/71). Motor intacto. Pendiente commit de Paco.`

- [ ] **Step 8: Proponer commit — NO ejecutes `git add` ni `git commit`**

Mensaje exacto para Paco:

```
feat(world-cup): ball height reads on screen — scale and shadow from ball.z (G11-3)
```

---

### Task 11-2: `gestures.ts` — el temporizador de gesto, de pantalla (G11-2)

**Files:**
- Create: `components/games/football-screen/gestures.ts`
- Test: `components/games/football-screen/gestures.test.ts`

**Interfaces:**
- Consumes: nada de la Task 11-1 (módulos disjuntos).
- Produces, y las Tasks 11-3 y 11-5 consumen literalmente:
  - `GK_DIVE_STEPS: number` (35), `GESTURE_IDLE: number` (-1), `DIVE_PEAK: number` (0.35), `DIVE_REACH_MAX: number` (1.5)
  - `type GestureTimers = { count: number; startStep: Int32Array; untilStep: Int32Array; dirX: Float32Array; dirY: Float32Array }`
  - `createGestureTimers(count?: number): GestureTimers` (por defecto `TEAM_SIZE * 2` = 18)
  - `resetGestures(g: GestureTimers): void`
  - `gestureBegin(g: GestureTimers, index: number, stepCount: number, durationSteps: number, dirX: number, dirY: number): void`
  - `gestureProgress(g: GestureTimers, index: number, stepCount: number): number` → 0..1 mientras dura, `GESTURE_IDLE` si no
  - `beginGkCatchGestures(match: MatchState, g: GestureTimers, prevBallX: number, prevBallY: number, durationSteps?: number): number` → cuántos gestos arrancó (`prevBallX/prevBallY`: por qué no basta con `ev.x/ev.y`, ver el párrafo siguiente)
  - `diveReach(progress: number): number` → 0 → `DIVE_REACH_MAX` → 0

**Contexto que el ejecutor no tiene:** el motor **no** tiene un evento `'save'`. La parada del portero es `keeperCatch` (`football-logic/ai.ts:325-351`), que escribe en el slot del portero un `ActionEvent` con `kind = 'gk-catch'`, `ok = true`, `actorId` = id del portero. `match.scratch.events` es un array de 18 eventos, uno por jugador, **reseteado entero al principio de cada step** (`match.ts:543`), y `players[i].id === i` siempre, así que el índice del array y el índice del temporizador son el mismo número. El molde de barrido es `shotFiredThisStep` (`sfx-map.ts:97-104`): 18 comparaciones, sin puntero.

**Hallazgo del pre-vuelo (bloqueante, ya corregido en este plan): `ev.x/ev.y` NO es la posición del balón en el momento de atajar.** El diseño original de esta tarea (y el informe de diseño) daban por hecho que sí, pero `keeperCatch` (`ai.ts:325-351`) llama `givePossession(ball, gk, stepCount)` en la línea `ai.ts:342`, **antes** de hacer `out.x = ball.x; out.y = ball.y;` en `ai.ts:348-349`, y `givePossession` (`ball.ts:42-51`) termina con `stickToOwner(ball, p)` (`ball.ts:54-58`), que sobrescribe `ball.x/ball.y` a `gk.x + gk.facingX * CONTROL_DIST, gk.y + gk.facingY * CONTROL_DIST` (`CONTROL_DIST = 18`, `ball.ts:25`) **antes** de que el evento se estampe. Consecuencia medible: `ev.x - gk.x` es **siempre, exactamente**, `gk.facingX * 18` (lo mismo para `y`), así que normalizarlo reproduce **siempre** `gk.facingX/facingY` — la misma dirección que ya muestra el palito existente, nunca la dirección real de la que venía el balón. Un test que solo comprueba que el vector resultante tiene longitud 1 (como el que se iba a escribir aquí) no detecta esto: pasa igual, y calladamente el estirón de G11-2 no apunta al balón nunca, solo a donde ya miraba el portero. Como el motor está congelado y no se puede leer la posición real del balón en el instante de la atajada (se sobrescribe antes de que el evento exista), la solución que se queda **dentro de la capa de pantalla**: el propio componente (Task 11-3, Step 7) guarda `match.ball.x/y` en dos variables locales **justo antes** de llamar a `stepMatchRun` en cada `runStep` — la posición del balón un paso (1/60 s) antes de la atajada, muchísimo más cercana a la real que el valor que dejaría `stickToOwner` — y se las pasa a `beginGkCatchGestures` como `prevBallX, prevBallY`. Es una lectura, no una escritura: no toca el motor ni el determinismo (criterio 1). Esto cambia la firma de `beginGkCatchGestures` (ver arriba) y se propaga a `gestures.test.ts` (este mismo Task), a la Task 11-3 (cableado en `runStep`) y a la Task 11-5 (`view-pipeline.test.ts`), en los tres sitios de este plan que la llaman.

**El caso sucio que este módulo tiene que aguantar:** el componente reutiliza el mismo cierre entre partidos (`run = createMatchRun(...)` en `VaultWorldCupGame.tsx:419`) y `stepCount` **vuelve a 0** en cada partido nuevo. Un temporizador que quedó abierto en el paso 16 000 del partido anterior no puede reaparecer en el paso 0 del siguiente. `gestureProgress` se defiende sola (progreso negativo → `GESTURE_IDLE`) **y además** la Task 11-5 llama a `resetGestures` al arrancar cada partido: cinturón y tirantes, porque las dos defensas fallan de formas distintas.

- [ ] **Step 1: Escribir el test en rojo**

Crea `components/games/football-screen/gestures.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NORMAL_RULES, resumePlay } from '../football-logic/match';
import { TEAMS, TEAM_SIZE } from '../football-logic/teams';
import { createMatchRun, stepMatchRun } from './match-run';
import {
  DIVE_PEAK, DIVE_REACH_MAX, GESTURE_IDLE, GK_DIVE_STEPS,
  beginGkCatchGestures, createGestureTimers, diveReach, gestureBegin, gestureProgress, resetGestures,
} from './gestures';

const ESP = TEAMS[0];
const ITA = TEAMS[1];

describe('createGestureTimers', () => {
  it('holds one slot per player of the match, allocated once', () => {
    const g = createGestureTimers();
    expect(g.count).toBe(TEAM_SIZE * 2);
    expect(g.startStep.length).toBe(g.count);
    expect(g.untilStep.length).toBe(g.count);
    expect(g.dirX.length).toBe(g.count);
    expect(g.dirY.length).toBe(g.count);
  });

  it('starts inert: every slot is idle at step 0', () => {
    const g = createGestureTimers();
    for (let i = 0; i < g.count; i++) expect(gestureProgress(g, i, 0)).toBe(GESTURE_IDLE);
  });
});

describe('gestureBegin / gestureProgress', () => {
  it('runs from 0 to just under 1 over the duration and then goes idle', () => {
    const g = createGestureTimers();
    gestureBegin(g, 4, 100, GK_DIVE_STEPS, 1, 0);
    expect(gestureProgress(g, 4, 100)).toBe(0);
    expect(gestureProgress(g, 4, 100 + GK_DIVE_STEPS / 2)).toBeCloseTo(0.5, 6);
    expect(gestureProgress(g, 4, 100 + GK_DIVE_STEPS - 1)).toBeLessThan(1);
    expect(gestureProgress(g, 4, 100 + GK_DIVE_STEPS)).toBe(GESTURE_IDLE);
    expect(gestureProgress(g, 4, 100 + GK_DIVE_STEPS + 500)).toBe(GESTURE_IDLE);
  });

  it('keeps the direction it was given and leaves every other slot alone', () => {
    const g = createGestureTimers();
    gestureBegin(g, 9, 10, GK_DIVE_STEPS, 0, -1);
    expect(g.dirX[9]).toBe(0);
    expect(g.dirY[9]).toBe(-1);
    expect(gestureProgress(g, 8, 10)).toBe(GESTURE_IDLE);
    expect(gestureProgress(g, 10, 10)).toBe(GESTURE_IDLE);
  });

  it('ignores an index outside the pool instead of writing out of bounds', () => {
    const g = createGestureTimers();
    gestureBegin(g, -1, 10, GK_DIVE_STEPS, 1, 0);
    gestureBegin(g, g.count, 10, GK_DIVE_STEPS, 1, 0);
    expect(gestureProgress(g, -1, 10)).toBe(GESTURE_IDLE);
    expect(gestureProgress(g, g.count, 10)).toBe(GESTURE_IDLE);
  });

  // The dirty case: the component reuses the same timers for every match of a World
  // Cup and stepCount restarts at 0. A gesture left open at step 16 000 must NOT
  // reappear on the first step of the next match.
  it('does not fire again when the step count restarts at 0 in a new match', () => {
    const g = createGestureTimers();
    gestureBegin(g, 0, 16_000, GK_DIVE_STEPS, 1, 0);
    expect(gestureProgress(g, 0, 0)).toBe(GESTURE_IDLE);
  });

  it('resetGestures wipes every slot, timers and directions', () => {
    const g = createGestureTimers();
    gestureBegin(g, 0, 16_000, GK_DIVE_STEPS, 1, -1);
    resetGestures(g);
    expect(gestureProgress(g, 0, 16_000)).toBe(GESTURE_IDLE);
    expect(g.dirX[0]).toBe(0);
    expect(g.dirY[0]).toBe(0);
  });
});

describe('diveReach', () => {
  it('goes out and comes back: 0 at both ends, DIVE_REACH_MAX at the peak', () => {
    expect(diveReach(0)).toBe(0);
    expect(diveReach(DIVE_PEAK)).toBeCloseTo(DIVE_REACH_MAX, 6);
    expect(diveReach(1)).toBe(0);
  });

  it('reaches out faster than it comes back, which is what a save looks like', () => {
    expect(diveReach(DIVE_PEAK / 2)).toBeCloseTo(DIVE_REACH_MAX / 2, 6);
    expect(diveReach(DIVE_PEAK + (1 - DIVE_PEAK) / 2)).toBeCloseTo(DIVE_REACH_MAX / 2, 6);
    expect(DIVE_PEAK).toBeLessThan(0.5);
  });

  it('is 0 outside 0..1 instead of extrapolating', () => {
    expect(diveReach(-0.2)).toBe(0);
    expect(diveReach(1.4)).toBe(0);
  });
});

describe('beginGkCatchGestures', () => {
  it('starts nothing on a step with no catch', () => {
    const run = createMatchRun(ESP, ITA, 5, 5, [false, false], NORMAL_RULES, [0, 0]);
    const g = createGestureTimers();
    const prevBallX = run.match.ball.x;
    const prevBallY = run.match.ball.y;
    stepMatchRun(run);
    expect(beginGkCatchGestures(run.match, g, prevBallX, prevBallY)).toBe(0);
  });

  // A real catch, built from the engine's own rules instead of a hand-written event:
  // the ball is rolled at the keeper from inside its area, and keeperCatch fires.
  it('starts the keeper gesture on a real gk-catch, pointing at where the ball was one step before the catch', () => {
    const run = createMatchRun(ESP, ITA, 5, 9, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const g = createGestureTimers();
    resumePlay(m);
    const gk = m.players[0];
    m.ball.owner = null;
    m.ball.x = gk.x + 20;
    m.ball.y = gk.y - 10;
    m.ball.z = 0;
    m.ball.vx = -40;
    m.ball.vy = 0;
    m.ball.vz = 0;
    m.ball.lastTouchTeam = 1;
    m.ball.kickerId = 10;
    m.ball.kickLockUntilStep = 0;
    let fired = 0;
    for (let i = 0; i < 20 && fired === 0; i++) {
      // Pre-flight finding (blocker, fixed here): ev.x/ev.y from keeperCatch is USELESS
      // for direction -- ai.ts calls givePossession before stamping the event, and
      // givePossession's stickToOwner (ball.ts:54-58) has already snapped ball.x/y to
      // gk.x + gk.facingX * CONTROL_DIST by then, so ev.x - gk.x is always exactly
      // facingX * 18. The direction has to come from OUTSIDE the event: the ball's own
      // position one step earlier, snapshotted here exactly as Task 11-3's runStep does.
      const prevBallX = m.ball.x;
      const prevBallY = m.ball.y;
      stepMatchRun(run);
      fired = beginGkCatchGestures(m, g, prevBallX, prevBallY);
    }
    expect(fired).toBe(1);
    expect(gestureProgress(g, 0, m.stepCount)).toBe(0);
    // The stored direction is a unit vector, sourced from the pre-step ball position,
    // not from the event (see the comment above -- ev.x/y would give a unit vector too,
    // but always the keeper's OWN facing, which this test would not have caught).
    const len = Math.sqrt(g.dirX[0] * g.dirX[0] + g.dirY[0] * g.dirY[0]);
    expect(len).toBeCloseTo(1, 6);
    expect(gestureProgress(g, 0, m.stepCount + GK_DIVE_STEPS)).toBe(GESTURE_IDLE);
  });

  it('reads the events without writing a single field of the match', () => {
    const run = createMatchRun(ESP, ITA, 5, 5, [false, false], NORMAL_RULES, [0, 0]);
    const g = createGestureTimers();
    const prevBallX = run.match.ball.x;
    const prevBallY = run.match.ball.y;
    stepMatchRun(run);
    const before = JSON.stringify(run.match.ball) + run.match.stepCount + run.match.phase;
    beginGkCatchGestures(run.match, g, prevBallX, prevBallY);
    expect(JSON.stringify(run.match.ball) + run.match.stepCount + run.match.phase).toBe(before);
  });
});

describe('the length of the gesture', () => {
  it('is the ~0.6 s G11-2 asked for (35 steps at 60 steps/s) and ends well before the next restart', () => {
    expect(GK_DIVE_STEPS).toBe(35);
    // GOAL_PAUSE_STEPS is 120 and a set-piece countdown is 300: the keeper is
    // standing again long before it has to take the goal kick (G11-2).
    expect(GK_DIVE_STEPS).toBeLessThan(120);
  });
});
```

- [ ] **Step 2: Verlo fallar**

Ejecuta: `npx vitest run components/games/football-screen/gestures.test.ts`
Esperado: **FALLA** con `Failed to resolve import "./gestures"`.

- [ ] **Step 3: Escribir `gestures.ts`**

Crea `components/games/football-screen/gestures.ts`:

```ts
import type { MatchState } from '../football-logic/match';
import { TEAM_SIZE } from '../football-logic/teams';

// G11-2 (grill del paso 11, QA jugado del 09-sep): the keeper has to STRETCH when it
// saves. The engine has no 'save' -- keeperCatch (ai.ts) writes an ActionEvent with
// kind 'gk-catch', ok and actorId = the keeper -- and G11-2 says the engine stays out
// of it, so the gesture is a SCREEN timer: one slot per player, written in place, read
// by drawPlayer, invisible to the simulation.
//
// Pre-flight finding: the event's OWN x/y are NOT the ball's position at the catch.
// keeperCatch (ai.ts) calls givePossession before stamping out.x/out.y, and
// givePossession's stickToOwner (ball.ts) has already snapped ball.x/y to
// gk.x + gk.facingX * CONTROL_DIST by then -- so ev.x - gk.x is always exactly the
// keeper's own facing, never the ball's real approach direction. The direction this
// module uses instead comes from OUTSIDE the event: the caller (VaultWorldCupGame.tsx)
// snapshots match.ball.x/y one step before calling stepMatchRun and hands that in as
// prevBallX/prevBallY -- a read, not a write, so determinism (criterion 1) is untouched.
//
// The shape is particles.ts's: typed arrays created ONCE (criterion 20), never after.
// The only Math.sqrt of this module runs inside beginGkCatchGestures -- on a save,
// which happens a handful of times per match, never per frame.

export const GK_DIVE_STEPS = 35; // ~0.6 s at 60 steps/s (G11-2)
export const GESTURE_IDLE = -1;
// The dive shoots out in the first third and comes back over the rest: a save is a
// snap, not a sine wave.
export const DIVE_PEAK = 0.35;
// How far the body stretches at the peak, in PLAYER_RADIUS units.
export const DIVE_REACH_MAX = 1.5;
// Below this, "towards the ball" is not a direction any more (the keeper is standing
// on it), so the gesture falls back to the way the keeper is facing.
const DIVE_MIN_DIST = 0.001;

export type GestureTimers = {
  count: number;
  startStep: Int32Array;
  untilStep: Int32Array;
  dirX: Float32Array;
  dirY: Float32Array;
};

export function createGestureTimers(count = TEAM_SIZE * 2): GestureTimers {
  return {
    count,
    startStep: new Int32Array(count),
    untilStep: new Int32Array(count),
    dirX: new Float32Array(count),
    dirY: new Float32Array(count),
  };
}

// Called when a match starts: stepCount restarts at 0 and a timer left open at step
// 16 000 of the previous match must not be read as "in the future".
export function resetGestures(g: GestureTimers): void {
  g.startStep.fill(0);
  g.untilStep.fill(0);
  g.dirX.fill(0);
  g.dirY.fill(0);
}

export function gestureBegin(
  g: GestureTimers, index: number, stepCount: number, durationSteps: number, dirX: number, dirY: number,
): void {
  if (index < 0 || index >= g.count || durationSteps <= 0) return;
  g.startStep[index] = stepCount;
  g.untilStep[index] = stepCount + durationSteps;
  g.dirX[index] = dirX;
  g.dirY[index] = dirY;
}

// 0 on the step the gesture starts, just under 1 on its last step, GESTURE_IDLE
// otherwise. A negative progress means the step count went BACKWARDS since the
// gesture started -- a new match reusing the same pool -- and is idle too.
export function gestureProgress(g: GestureTimers, index: number, stepCount: number): number {
  if (index < 0 || index >= g.count) return GESTURE_IDLE;
  const until = g.untilStep[index];
  if (stepCount >= until) return GESTURE_IDLE;
  const span = until - g.startStep[index];
  if (span <= 0) return GESTURE_IDLE;
  const progress = (stepCount - g.startStep[index]) / span;
  return progress < 0 ? GESTURE_IDLE : progress;
}

// Out and back, a straight ramp each way: no trigonometry, no allocation.
export function diveReach(progress: number): number {
  if (progress < 0 || progress > 1) return 0;
  const t = progress <= DIVE_PEAK ? progress / DIVE_PEAK : (1 - progress) / (1 - DIVE_PEAK);
  return t * DIVE_REACH_MAX;
}

// The one reader of the engine in this module: the same 18-slot sweep sfx-map.ts does
// for the shot, because the shootout wipes any pointer. Returns how many gestures it
// started (0 on almost every step). Reads the match; writes nothing in it.
//
// prevBallX/prevBallY, NOT ev.x/ev.y: see the header note. The caller (runStep) reads
// match.ball.x/y ONE step before calling stepMatchRun, which is much closer to "where
// the ball was when it was caught" than the post-catch value the event carries.
export function beginGkCatchGestures(
  match: MatchState, g: GestureTimers, prevBallX: number, prevBallY: number, durationSteps = GK_DIVE_STEPS,
): number {
  const events = match.scratch.events;
  let started = 0;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.kind !== 'gk-catch' || !ev.ok) continue;
    const id = ev.actorId;
    if (id < 0 || id >= g.count || id >= match.players.length) continue;
    const gk = match.players[id];
    let dx = prevBallX - gk.x;
    let dy = prevBallY - gk.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < DIVE_MIN_DIST) {
      dx = gk.facingX;
      dy = gk.facingY;
    } else {
      dx /= len;
      dy /= len;
    }
    gestureBegin(g, id, match.stepCount, durationSteps, dx, dy);
    started++;
  }
  return started;
}
```

- [ ] **Step 4: Verlo pasar**

Ejecuta: `npx vitest run components/games/football-screen/gestures.test.ts`
Esperado: **PASA**, 14 tests.

Si «starts the keeper gesture on a real gk-catch» no llega a disparar en 20 pasos, **no relajes la aserción**: la atajada depende de `catchChance` (dificultad 9 la sube) y del `rng`; sube el bucle a 60 pasos o cambia la semilla del `createMatchRun` hasta que dispare, y deja escrito en el test **por qué** esa semilla (una línea de comentario). Un `expect(fired).toBeGreaterThanOrEqual(0)` sería un test vacuo.

- [ ] **Step 5: Romperlo a propósito (control negativo)**

Cambia temporalmente `gestureProgress` para que devuelva `0` en vez de `GESTURE_IDLE` cuando `progress < 0` y vuelve a ejecutar el fichero.
Esperado: falla «does not fire again when the step count restarts at 0 in a new match». **Deshaz el cambio** y vuelve a verlo verde.

**Control negativo extra, específico del hallazgo de pre-vuelo:** cambia temporalmente `beginGkCatchGestures` para que vuelva a leer `ev.x, ev.y` en vez de `prevBallX, prevBallY` (`let dx = ev.x - gk.x; let dy = ev.y - gk.y;`) y vuelve a ejecutar el fichero. Esperado: **el test sigue pasando** — `len` sigue siendo 1 porque `ev.x - gk.x` también es un vector, solo que **siempre** es `gk.facingX * CONTROL_DIST` (nunca la dirección real). Esto demuestra por qué el test original (antes del pre-vuelo) era vacuo para este caso concreto: comprobar solo la longitud no basta. **Deshaz el cambio** y confirma que sigues usando `prevBallX/prevBallY`.

- [ ] **Step 6: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/gestures.ts components/games/football-screen/gestures.test.ts
git diff --stat ab3372c -- components/games/football-logic/
grep -rn "Math.random" components/games/football-screen/
```
Esperado: 1239 tests / 72 ficheros verdes (1225 + 14), `tsc` y `eslint` sin salida, el `git diff` del motor **vacío**, el `grep` **vacío**.

- [ ] **Step 7: Anotar en el ledger**

`16-sep — Task 11-2 hecha: gestures.ts + 14 tests (1239/72). Temporizador de gesto de pantalla; motor intacto. Pendiente commit de Paco.`

- [ ] **Step 8: Proponer commit — NO ejecutes `git add` ni `git commit`**

```
feat(world-cup): screen-side gesture timers driven by the engine's gk-catch event (G11-2)
```

---

### Task 11-3: `player-pose.ts` + `drawPlayer` — la figura cenital y el portero estirado (G11-1 y G11-2)

**Files:**
- Create: `components/games/football-screen/player-pose.ts`
- Test: `components/games/football-screen/player-pose.test.ts`
- Modify: `components/games/VaultWorldCupGame.tsx` (imports 51-58, colores 96-118, preasignación ~312, `drawPlayer` 863-961, `runStep` tras la línea 628, `startMatch` ~432)

**Interfaces:**
- Consumes de la Task 11-2, literalmente: `createGestureTimers()`, `resetGestures(g)`, `gestureProgress(g, index, stepCount)`, `beginGkCatchGestures(match, g, prevBallX, prevBallY)`, `diveReach(progress)`, `GESTURE_IDLE`.
- Produces, y la Task 11-5 consume en la sonda:
  - `type PlayerPose = { headX: number; headY: number; headR: number; leftX: number; leftY: number; rightX: number; rightY: number }`
  - `createPlayerPose(): PlayerPose`
  - `playerPose(x: number, y: number, facingX: number, facingY: number, radius: number, out: PlayerPose): void`
  - `type DivePose = { frontX: number; frontY: number; backX: number; backY: number; endR: number; sideX: number; sideY: number }`
  - `createDivePose(): DivePose`
  - `divePose(x: number, y: number, dirX: number, dirY: number, radius: number, reach: number, out: DivePose): void`
  - `HEAD_R_RATIO`, `HEAD_FORWARD_RATIO`, `SHOULDER_HALF_RATIO`, `SHOULDER_BACK_RATIO`, `DIVE_END_R_RATIO`, `DIVE_HALF_W_RATIO` (todos `number`)

**Contexto que el ejecutor no tiene:** `drawPlayer` (`VaultWorldCupGame.tsx:863-961`) es el **único** punto de dibujo de jugador del juego y ya está parametrizado por rol y estado; dibuja, en este orden, sombra → cuerpo (círculo, o elipse tumbada si `down`) → ribete (collar para el de campo, anillo completo para el portero) → palito de dirección → arcos de celebración de gol → triángulo del cursor + muescas de carga → anillo de sprint. **G11-1 dice que todo eso se conserva** y solo se le añade la figura. `p.facingX/p.facingY` es un vector unitario que el motor ya mantiene (`players.ts:7-17`, inicializado a `(±1, 0)` en `createPlayer`), así que **no hay que normalizar nada por frame**: solo protegerse del caso degenerado `(0, 0)` con dos comparaciones. `PLAYER_RADIUS` es 12.

**Tres decisiones de dibujo que este plan cierra, para que no se decidan en silencio:**
1. **El palito de dirección se QUEDA.** Los hombros dan la orientación, pero el palito es lo que hace legible el cono de pase a un golpe de vista y es comportamiento existente que G11-1 no pide retirar. Si a Paco le sobra al jugarlo, quitarlo es borrar el bloque `if (!down && !parked)` de `drawPlayer` — va a la lista de QA como pregunta, no como cambio.
2. **La figura se dibuja para TODOS**, estatuas del ENTRENAMIENTO y aparcados de la tanda incluidos (G11-1 literal: «sin rama nueva»). Lo único que sigue teniendo excepción es lo que ya la tenía: el palito (no se pinta para `parked`).
3. **Nada de `Math.atan2` ni de `ctx.rotate` para el portero estirado.** El cuerpo estirado se traza como una cápsula: un cuadrilátero entre dos círculos, con los seis puntos calculados por `divePose` a partir del vector de dirección. Es la misma forma de trazar que ya usa el triángulo del cursor (`moveTo`/`lineTo`), no toca la matriz del canvas y no cuesta una sola llamada trigonométrica por frame.

- [ ] **Step 1: Escribir el test en rojo**

Crea `components/games/football-screen/player-pose.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS } from '../football-logic/players';
import {
  DIVE_END_R_RATIO, DIVE_HALF_W_RATIO, HEAD_FORWARD_RATIO, HEAD_R_RATIO,
  SHOULDER_BACK_RATIO, SHOULDER_HALF_RATIO,
  createDivePose, createPlayerPose, divePose, playerPose,
} from './player-pose';

const R = PLAYER_RADIUS;

function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

describe('playerPose', () => {
  it('puts the head forward along the facing vector', () => {
    const out = createPlayerPose();
    playerPose(100, 200, 1, 0, R, out);
    expect(out.headX).toBeCloseTo(100 + R * HEAD_FORWARD_RATIO, 6);
    expect(out.headY).toBeCloseTo(200, 6);
    expect(out.headR).toBeCloseTo(R * HEAD_R_RATIO, 6);
  });

  it('follows the facing vector round: facing up puts the head above the centre', () => {
    const out = createPlayerPose();
    playerPose(100, 200, 0, -1, R, out);
    expect(out.headX).toBeCloseTo(100, 6);
    expect(out.headY).toBeCloseTo(200 - R * HEAD_FORWARD_RATIO, 6);
  });

  it('draws the shoulders PERPENDICULAR to the facing vector, whatever it is', () => {
    const out = createPlayerPose();
    const facings: readonly (readonly [number, number])[] = [
      [1, 0], [0, 1], [-1, 0], [0, -1], [Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2],
    ];
    for (const [fx, fy] of facings) {
      playerPose(0, 0, fx, fy, R, out);
      const shoulderX = out.rightX - out.leftX;
      const shoulderY = out.rightY - out.leftY;
      expect(dot(shoulderX, shoulderY, fx, fy)).toBeCloseTo(0, 6);
    }
  });

  it('gives the shoulders the full span on both sides of the body', () => {
    const out = createPlayerPose();
    playerPose(0, 0, 1, 0, R, out);
    const span = Math.hypot(out.rightX - out.leftX, out.rightY - out.leftY);
    expect(span).toBeCloseTo(2 * R * SHOULDER_HALF_RATIO, 6);
  });

  it('sits the shoulder line BEHIND the centre, so head and shoulders read as a direction', () => {
    const out = createPlayerPose();
    playerPose(0, 0, 1, 0, R, out);
    const midX = (out.leftX + out.rightX) / 2;
    expect(midX).toBeCloseTo(-R * SHOULDER_BACK_RATIO, 6);
    expect(midX).toBeLessThan(0);
    expect(out.headX).toBeGreaterThan(0);
  });

  it('keeps the whole figure inside the body circle it is drawn on', () => {
    const out = createPlayerPose();
    playerPose(0, 0, Math.SQRT1_2, -Math.SQRT1_2, R, out);
    expect(Math.hypot(out.headX, out.headY) + out.headR).toBeLessThanOrEqual(R);
    expect(Math.hypot(out.leftX, out.leftY)).toBeLessThanOrEqual(R);
    expect(Math.hypot(out.rightX, out.rightY)).toBeLessThanOrEqual(R);
  });

  it('falls back to facing right when the engine hands it a zero vector', () => {
    const out = createPlayerPose();
    playerPose(50, 50, 0, 0, R, out);
    expect(out.headX).toBeCloseTo(50 + R * HEAD_FORWARD_RATIO, 6);
    expect(out.headY).toBeCloseTo(50, 6);
    expect(Number.isFinite(out.leftX)).toBe(true);
    expect(Number.isFinite(out.rightY)).toBe(true);
  });

  it('writes in place and returns nothing (criterion 20: no allocation per frame)', () => {
    const out = createPlayerPose();
    expect(playerPose(1, 2, 1, 0, R, out)).toBeUndefined();
    const first = out.headX;
    playerPose(9, 2, 1, 0, R, out);
    expect(out.headX).not.toBe(first);
  });
});

describe('divePose', () => {
  it('collapses onto the centre when the reach is 0, so the pose starts standing', () => {
    const out = createDivePose();
    divePose(100, 100, 1, 0, R, 0, out);
    expect(out.frontX).toBeCloseTo(100, 6);
    expect(out.backX).toBeCloseTo(100, 6);
    expect(out.frontY).toBeCloseTo(100, 6);
    expect(out.backY).toBeCloseTo(100, 6);
  });

  it('stretches symmetrically along the dive direction', () => {
    const out = createDivePose();
    divePose(100, 100, 0, 1, R, 1.5, out);
    expect(out.frontY).toBeCloseTo(100 + R * 1.5, 6);
    expect(out.backY).toBeCloseTo(100 - R * 1.5, 6);
    expect(out.frontX).toBeCloseTo(100, 6);
    expect(out.backX).toBeCloseTo(100, 6);
  });

  it('gives the body a width perpendicular to the dive, narrower than the standing body', () => {
    const out = createDivePose();
    divePose(0, 0, 1, 0, R, 1.5, out);
    expect(dot(out.sideX, out.sideY, 1, 0)).toBeCloseTo(0, 6);
    expect(Math.hypot(out.sideX, out.sideY)).toBeCloseTo(R * DIVE_HALF_W_RATIO, 6);
    expect(R * DIVE_HALF_W_RATIO).toBeLessThan(R);
    expect(out.endR).toBeCloseTo(R * DIVE_END_R_RATIO, 6);
  });

  it('keeps the two ends and the sides perpendicular for a diagonal dive too', () => {
    const out = createDivePose();
    divePose(0, 0, Math.SQRT1_2, Math.SQRT1_2, R, 1, out);
    const alongX = out.frontX - out.backX;
    const alongY = out.frontY - out.backY;
    expect(dot(alongX, alongY, out.sideX, out.sideY)).toBeCloseTo(0, 6);
    expect(Math.hypot(alongX, alongY)).toBeCloseTo(2 * R, 6);
  });

  it('falls back to a horizontal dive on a zero direction instead of producing NaN', () => {
    const out = createDivePose();
    divePose(0, 0, 0, 0, R, 1.5, out);
    expect(Number.isFinite(out.frontX)).toBe(true);
    expect(Number.isFinite(out.sideY)).toBe(true);
    expect(out.frontX).toBeCloseTo(R * 1.5, 6);
  });
});
```

- [ ] **Step 2: Verlo fallar**

Ejecuta: `npx vitest run components/games/football-screen/player-pose.test.ts`
Esperado: **FALLA** con `Failed to resolve import "./player-pose"`.

- [ ] **Step 3: Escribir `player-pose.ts`**

Crea `components/games/football-screen/player-pose.ts`:

```ts
// G11-1 (grill del paso 11, QA jugado del 09-sep y del 11-sep): a player must be a
// FIGURE seen from above -- head and shoulders -- not a plain disc. The orientation
// is the engine's own facingX/facingY (players.ts, a unit vector kept by movePlayer
// and preserved when the player stops), so nothing has to be derived and nothing has
// to be asked of the engine (G11-1: "solo drawPlayer, cero asignaciones por frame").
//
// And G11-2's diving keeper: the same maths, stretched along the direction of the
// dive. Both write into an out object created ONCE by the component, and neither uses
// a single trigonometric call -- the perpendicular of a unit vector (x, y) is
// (-y, x), which is all a top-down figure needs.
//
// Every ratio below is a fraction of PLAYER_RADIUS, so the figure scales with the
// body instead of being pinned to 12 px in three places.

export const HEAD_R_RATIO = 0.42;
export const HEAD_FORWARD_RATIO = 0.34;
export const SHOULDER_HALF_RATIO = 0.82;
export const SHOULDER_BACK_RATIO = 0.18;
export const DIVE_END_R_RATIO = 0.72;
export const DIVE_HALF_W_RATIO = 0.62;

export type PlayerPose = {
  headX: number;
  headY: number;
  headR: number;
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
};

export function createPlayerPose(): PlayerPose {
  return { headX: 0, headY: 0, headR: 0, leftX: 0, leftY: 0, rightX: 0, rightY: 0 };
}

export function playerPose(
  x: number, y: number, facingX: number, facingY: number, radius: number, out: PlayerPose,
): void {
  // The engine keeps facing a unit vector; the only case worth guarding is the
  // degenerate one, and it is guarded with two comparisons, not with a square root.
  const zero = facingX === 0 && facingY === 0;
  const fx = zero ? 1 : facingX;
  const fy = zero ? 0 : facingY;
  const px = -fy;
  const py = fx;
  out.headX = x + fx * radius * HEAD_FORWARD_RATIO;
  out.headY = y + fy * radius * HEAD_FORWARD_RATIO;
  out.headR = radius * HEAD_R_RATIO;
  const backX = x - fx * radius * SHOULDER_BACK_RATIO;
  const backY = y - fy * radius * SHOULDER_BACK_RATIO;
  out.leftX = backX + px * radius * SHOULDER_HALF_RATIO;
  out.leftY = backY + py * radius * SHOULDER_HALF_RATIO;
  out.rightX = backX - px * radius * SHOULDER_HALF_RATIO;
  out.rightY = backY - py * radius * SHOULDER_HALF_RATIO;
}

export type DivePose = {
  frontX: number;
  frontY: number;
  backX: number;
  backY: number;
  endR: number;
  sideX: number;
  sideY: number;
};

export function createDivePose(): DivePose {
  return { frontX: 0, frontY: 0, backX: 0, backY: 0, endR: 0, sideX: 0, sideY: 0 };
}

// The stretched keeper: a capsule drawn as the quad between two circles. `reach` is
// in radius units and comes from gestures.ts's diveReach, so this function stays pure
// geometry and knows nothing about time.
export function divePose(
  x: number, y: number, dirX: number, dirY: number, radius: number, reach: number, out: DivePose,
): void {
  const zero = dirX === 0 && dirY === 0;
  const dx = zero ? 1 : dirX;
  const dy = zero ? 0 : dirY;
  const ex = dx * radius * reach;
  const ey = dy * radius * reach;
  out.frontX = x + ex;
  out.frontY = y + ey;
  out.backX = x - ex;
  out.backY = y - ey;
  out.endR = radius * DIVE_END_R_RATIO;
  out.sideX = -dy * radius * DIVE_HALF_W_RATIO;
  out.sideY = dx * radius * DIVE_HALF_W_RATIO;
}
```

- [ ] **Step 4: Verlo pasar**

Ejecuta: `npx vitest run components/games/football-screen/player-pose.test.ts`
Esperado: **PASA**, 13 tests.

- [ ] **Step 5: Romperlo a propósito (control negativo)**

Cambia temporalmente `const px = -fy; const py = fx;` por `const px = fy; const py = fx;` y vuelve a ejecutar el fichero.
Esperado: falla «draws the shoulders PERPENDICULAR to the facing vector». **Deshaz el cambio** y vuelve a verlo verde.

- [ ] **Step 6: Cablear el componente — imports y preasignación**

En `components/games/VaultWorldCupGame.tsx`, junto a los demás imports de `./football-screen/` (bloque 51-58), añade:

```ts
import { GESTURE_IDLE, beginGkCatchGestures, createGestureTimers, diveReach, gestureProgress, resetGestures } from './football-screen/gestures';
import { createDivePose, createPlayerPose, divePose, playerPose } from './football-screen/player-pose';
```

Junto a los colores del bloque 96-118, añade dos constantes (la cabeza necesita leerse sobre los dieciséis equipos, así que es un tono fijo con ribete claro, no un color de equipo):

```ts
const HEAD_COLOR = '#23201d';
const HEAD_TRIM = 'rgba(255,255,255,0.55)';
```

Junto a los tamaños del bloque 146-156:

```ts
const SHOULDER_WIDTH = 4;
```

Y justo debajo de `const viewRect = createMinimapRect();` (línea ~312), con los demás objetos creados una vez:

```ts
    // Criterion 20: created ONCE, written in place by drawPlayer every frame.
    const gestures = createGestureTimers();
    const pose = createPlayerPose();
    const dive = createDivePose();
```

- [ ] **Step 7: Cablear el componente — arrancar y limpiar el gesto**

En `runStep`, **justo después** de `const match = run.match;` (la primera línea de la función) y **antes** de `stepMatchRun(run);`, añade:

```ts
      // Pre-flight finding: the 'gk-catch' event's own x/y are USELESS for direction
      // (ai.ts's keeperCatch calls givePossession, which snaps ball.x/y to the keeper's
      // own facing, BEFORE stamping the event -- see gestures.ts's header comment). The
      // direction has to be read HERE, before this step's stepMatchRun runs it over.
      const prevBallX = match.ball.x;
      const prevBallY = match.ball.y;
```

Y **justo después** del punto «1b» (la línea `if (shortPassFiredThisStep(match)) sfxVaultWorldCup.play('pass');`, línea ~628), añade:

```ts
      // 1c. G11-2: the keeper's dive. A SCREEN timer started by the engine's own
      //     'gk-catch' event -- the engine knows nothing about the gesture, and the
      //     sweep is the same 18-slot scan points 1 and 1b do for the sound. The
      //     direction comes from prevBallX/prevBallY, captured above, not from the
      //     event itself.
      beginGkCatchGestures(match, gestures, prevBallX, prevBallY);
```

En `startMatch`, junto a `resetCaptionState(captions);` y `resetMatchWatch(watch);` (líneas ~432-433), añade:

```ts
      resetGestures(gestures);
```

- [ ] **Step 8: Cablear el componente — `drawPlayer`**

En `drawPlayer`, **sustituye** el bloque del cuerpo y del ribete (hoy, tras el `ctx.fill()` de la sombra, desde el comentario `// A player on the ground is drawn flat:` hasta el `ctx.stroke()` del ribete, líneas 880-892) por:

```ts
      // G11-2: a keeper that has just saved is drawn STRETCHED along the direction it
      // dived (keeper -> ball at the moment of the catch, stored by the gesture). The
      // timer is screen state; the engine's keeper never left its feet.
      const gesture = p.role === 'gk' ? gestureProgress(gestures, p.id, match.stepCount) : GESTURE_IDLE;
      const diving = gesture !== GESTURE_IDLE;

      // A player on the ground is drawn flat: it is a whole second of the match and
      // the player has to be able to see why nothing responds.
      ctx.fillStyle = p.role === 'gk' ? kit.secondary : kit.primary;
      if (diving) {
        divePose(x, y, gestures.dirX[p.id], gestures.dirY[p.id], PLAYER_RADIUS, diveReach(gesture), dive);
        ctx.beginPath();
        ctx.moveTo(dive.frontX + dive.sideX, dive.frontY + dive.sideY);
        ctx.lineTo(dive.backX + dive.sideX, dive.backY + dive.sideY);
        ctx.lineTo(dive.backX - dive.sideX, dive.backY - dive.sideY);
        ctx.lineTo(dive.frontX - dive.sideX, dive.frontY - dive.sideY);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dive.frontX, dive.frontY, dive.endR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dive.backX, dive.backY, dive.endR, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        if (down) ctx.ellipse(x, y, PLAYER_RADIUS * 1.3, PLAYER_RADIUS * 0.55, 0, 0, Math.PI * 2);
        else ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // The trim: shirt collar for the outfield, a full ring for the keeper, so the
      // one player who is never controllable is unmistakable. A diving keeper has no
      // round body to trim -- its own outline is already the silhouette.
      if (!diving) {
        ctx.strokeStyle = p.role === 'gk' ? kit.primary : kit.secondary;
        ctx.lineWidth = p.role === 'gk' ? 3 : 2;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER_RADIUS - 1, 0, Math.PI * 2);
        ctx.stroke();
      }

      // G11-1: head and shoulders on top of the body, oriented with the engine's own
      // facing. Drawn for EVERY player -- the training statues and the parked fifteen
      // of the shootout included, the grill is explicit that there is no new branch --
      // and skipped only where there is no standing figure to draw: a player on the
      // ground and a keeper mid-dive.
      if (!down && !diving) {
        playerPose(x, y, p.facingX, p.facingY, PLAYER_RADIUS, pose);
        ctx.strokeStyle = p.role === 'gk' ? kit.primary : kit.secondary;
        ctx.lineWidth = SHOULDER_WIDTH;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pose.leftX, pose.leftY);
        ctx.lineTo(pose.rightX, pose.rightY);
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.fillStyle = HEAD_COLOR;
        ctx.beginPath();
        ctx.arc(pose.headX, pose.headY, pose.headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = HEAD_TRIM;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
```

**No toques nada más de `drawPlayer`**: el palito de dirección, los arcos de celebración, el triángulo del cursor, las muescas de carga y el anillo de sprint se quedan exactamente como están, y siguen dibujándose **después**, encima de la figura.

- [ ] **Step 9: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/player-pose.ts components/games/football-screen/player-pose.test.ts components/games/VaultWorldCupGame.tsx
git diff --stat ab3372c -- components/games/football-logic/
grep -n "Math.atan2\|ctx.rotate\|ctx.save()" components/games/VaultWorldCupGame.tsx
```
Esperado: 1252 tests / 73 ficheros verdes (1239 + 13), `tsc` y `eslint` sin salida, el `git diff` del motor **vacío**, y el último `grep` **vacío** (ni trigonometría ni transformaciones nuevas en el dibujo).

- [ ] **Step 10: Anotar en el ledger**

`16-sep — Task 11-3 hecha: player-pose.ts + 13 tests, drawPlayer cenital + portero estirado cableado (1252/73). Motor intacto. Palito de dirección CONSERVADO (pregunta de QA). Pendiente commit de Paco.`

- [ ] **Step 11: Proponer commit — NO ejecutes `git add` ni `git commit`**

```
feat(world-cup): top-down player figure and a keeper that stretches when it saves (G11-1, G11-2)
```

---

### Task 11-4: `goal-net.ts` + `drawPitch` — la red y el balón dentro (G11-4)

**Files:**
- Create: `components/games/football-screen/goal-net.ts`
- Test: `components/games/football-screen/goal-net.test.ts`
- Modify: `components/games/VaultWorldCupGame.tsx` (imports 51-58, colores 96-118, **borrar** `const GOAL_MOUTH_DEPTH = 30;` de la línea 151, `drawPitch` 813-844)

**Interfaces:**
- Consumes: nada de las tareas 11-1/11-2/11-3 (módulo disjunto).
- Produces, y el componente consume:
  - `GOAL_MOUTH_DEPTH: number` (30) — **se muda aquí desde `VaultWorldCupGame.tsx:151`**, para que el dibujo y el predicado no puedan divergir
  - `NET_CELL: number` (10)
  - `netLineCount(span: number, cell: number): number` → cuántas líneas interiores caben
  - `ballInsideGoalMouth(ballX: number, ballY: number, ballZ: number, pitch: PitchDef, depth?: number): boolean`

**Contexto que el ejecutor no tiene — y la razón de que esta tarea sea solo dibujo:** ver la sección «La respuesta a la pregunta abierta de G11-4» de las Global Constraints. Resumen: `stepMatch` despacha la fase `'goal'` a una rama que **solo** decrementa `pauseStepsLeft` (`football-logic/match.ts:563-572`), así que durante los `GOAL_PAUSE_STEPS = 120` de la celebración **no corre física ninguna** y el balón se queda clavado donde `judgeBall` lo cantó: pasada la línea de gol, dentro de los 30 de profundidad que `drawPitch` pinta hoy como un rectángulo blanco plano. No hay que guardar posición ni dibujar ningún balón fantasma. **Lo único que hay que acertar es el orden de dibujo**: la red se pinta en `drawPitch()`, que corre antes que `drawPlayers()` y `drawBall()` (ver `drawMatch`), así que el balón queda **encima** de la rejilla. La cámara llega sola: `followCamera` corre en todos los pasos, también en la fase `'goal'`, y `cameraMinX = -PITCH_MARGIN = -60` deja la boca entera (-30..0) dentro del encuadre.

Hoy la portería es `ctx.fillRect` con `GOAL_MOUTH = 'rgba(255,255,255,0.25)'` y **no hay ni postes ni red** (`drawPitch:836-844`). Esta tarea añade los dos, estáticos. **La red que ondula es v1.5 (G11-4 literal).**

- [ ] **Step 1: Escribir el test en rojo**

Crea `components/games/football-screen/goal-net.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GOAL_PAUSE_STEPS, NORMAL_RULES, resumePlay } from '../football-logic/match';
import { PITCH, centerX, centerY } from '../football-logic/pitch';
import { TEAMS } from '../football-logic/teams';
import { createMatchRun, stepMatchRun } from './match-run';
import { GOAL_MOUTH_DEPTH, NET_CELL, ballInsideGoalMouth, netLineCount } from './goal-net';

const ESP = TEAMS[0];
const ITA = TEAMS[1];

describe('netLineCount', () => {
  it('counts the INTERIOR lines only: the two edges are the frame, not the net', () => {
    expect(netLineCount(150, 10)).toBe(14);
    expect(netLineCount(30, 10)).toBe(2);
    expect(netLineCount(10, 10)).toBe(0);
  });

  it('never returns a negative count, whatever it is handed', () => {
    expect(netLineCount(0, 10)).toBe(0);
    expect(netLineCount(-40, 10)).toBe(0);
    expect(netLineCount(150, 0)).toBe(0);
    expect(netLineCount(150, -5)).toBe(0);
  });

  it('draws a mesh fine enough to read as a net in both directions of the mouth', () => {
    expect(netLineCount(PITCH.goalWidth, NET_CELL)).toBeGreaterThanOrEqual(10);
    expect(netLineCount(GOAL_MOUTH_DEPTH, NET_CELL)).toBeGreaterThanOrEqual(2);
  });
});

describe('ballInsideGoalMouth', () => {
  const midY = centerY(PITCH);

  it('is true just behind either goal line, between the posts and under the bar', () => {
    expect(ballInsideGoalMouth(-8, midY, 0, PITCH)).toBe(true);
    expect(ballInsideGoalMouth(PITCH.width + 8, midY, 0, PITCH)).toBe(true);
  });

  it('is false on the pitch, however close to the line', () => {
    expect(ballInsideGoalMouth(1, midY, 0, PITCH)).toBe(false);
    expect(ballInsideGoalMouth(PITCH.width - 1, midY, 0, PITCH)).toBe(false);
  });

  it('is false past the back of the net, wide of the posts, or over the bar', () => {
    expect(ballInsideGoalMouth(-GOAL_MOUTH_DEPTH - 1, midY, 0, PITCH)).toBe(false);
    expect(ballInsideGoalMouth(-8, midY - PITCH.goalWidth, 0, PITCH)).toBe(false);
    expect(ballInsideGoalMouth(-8, midY, PITCH.crossbarHeight + 1, PITCH)).toBe(false);
  });
});

// The measurement this whole task rests on, turned into an assertion: if a future
// change to the engine ever snapped the ball back to the centre spot the moment a
// goal is given, the net would be drawn around an empty mouth and NOTHING else would
// notice. This test notices.
describe('the ball during the goal celebration (G11-4)', () => {
  it('stays frozen inside the goal mouth for the whole pause, and only then goes back to the spot', () => {
    const run = createMatchRun(ESP, ITA, 23, 5, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    resumePlay(m);
    // Rolled at the goal line, well wide of the keeper (which stands ~25 units off
    // its line in the middle): 60 units of offset put it outside GK_CATCH_RADIUS.
    m.ball.owner = null;
    m.ball.x = 2;
    m.ball.y = centerY(PITCH) - 60;
    m.ball.z = 0;
    m.ball.vx = -900;
    m.ball.vy = 0;
    m.ball.vz = 0;
    m.ball.lastTouchTeam = 1;

    stepMatchRun(run);
    expect(m.phase).toBe('goal');
    const goalX = m.ball.x;
    const goalY = m.ball.y;
    expect(ballInsideGoalMouth(goalX, goalY, m.ball.z, PITCH)).toBe(true);

    for (let i = 1; i < GOAL_PAUSE_STEPS; i++) {
      stepMatchRun(run);
      expect(m.phase).toBe('goal');
      expect(m.ball.x).toBe(goalX);
      expect(m.ball.y).toBe(goalY);
    }

    stepMatchRun(run);
    expect(m.phase).toBe('kickoff');
    expect(m.ball.x).toBeCloseTo(centerX(PITCH), 6);
    expect(ballInsideGoalMouth(m.ball.x, m.ball.y, m.ball.z, PITCH)).toBe(false);
  });
});
```

- [ ] **Step 2: Verlo fallar**

Ejecuta: `npx vitest run components/games/football-screen/goal-net.test.ts`
Esperado: **FALLA** con `Failed to resolve import "./goal-net"`.

- [ ] **Step 3: Escribir `goal-net.ts`**

Crea `components/games/football-screen/goal-net.ts`:

```ts
import { centerY, type PitchDef } from '../football-logic/pitch';

// G11-4 (grill del paso 11, QA jugado del 11-sep: "un gesto de que el balón entra en
// la red"). Until now the goal was a flat translucent rectangle behind the line, with
// no posts and no net at all, so a goal read as the ball leaving the pitch.
//
// The measurement that makes this cheap: during the goal celebration the engine runs
// NO physics -- stepMatch's 'goal' branch (match.ts) only counts pauseStepsLeft down
// and then calls endGoalPause -- so the ball stays frozen exactly where judgeBall
// gave the goal, which is inside this mouth, for the whole 120-step pause. Nothing
// has to be remembered and no ghost ball has to be drawn: the net is painted inside
// drawPitch, BEFORE the players and the ball, and the real ball sits on top of it.
//
// The net that RIPPLES is v1.5 (G11-4). This one is a static grid.

// Moved here from VaultWorldCupGame.tsx so the rectangle that is drawn and the
// rectangle that is tested can never drift apart.
export const GOAL_MOUTH_DEPTH = 30;
// World units per cell. 150 / 10 and 30 / 10 give a mesh that reads as a net at the
// 1:1 scale the camera uses (world unit == pixel).
export const NET_CELL = 10;

// How many lines fall strictly INSIDE a span of `span` units every `cell` units. The
// two edges are the frame, drawn separately, so they are not counted here.
export function netLineCount(span: number, cell: number): number {
  if (span <= 0 || cell <= 0) return 0;
  const lines = Math.ceil(span / cell) - 1;
  return lines > 0 ? lines : 0;
}

// Is the ball in the box the net is drawn around? Used by the tests (and by the step-11
// probe) to state, as an assertion rather than as a comment, that a goal leaves the
// ball where the net is.
export function ballInsideGoalMouth(
  ballX: number, ballY: number, ballZ: number, pitch: PitchDef, depth = GOAL_MOUTH_DEPTH,
): boolean {
  if (ballZ >= pitch.crossbarHeight) return false;
  const halfGoal = pitch.goalWidth / 2;
  const midY = centerY(pitch);
  if (ballY < midY - halfGoal || ballY > midY + halfGoal) return false;
  if (ballX < 0) return ballX >= -depth;
  if (ballX > pitch.width) return ballX <= pitch.width + depth;
  return false;
}
```

- [ ] **Step 4: Verlo pasar**

Ejecuta: `npx vitest run components/games/football-screen/goal-net.test.ts`
Esperado: **PASA**, 7 tests.

Si el test de la celebración no llega a `'goal'` en el primer paso, **no lo relajes**: imprime `m.ball.x`, `m.ball.y` y `m.phase` tras el `stepMatchRun` y ajusta la posición de partida (el balón tiene que quedar entre los postes, `centerY ± 75`, y cruzar la línea en ese mismo paso: a `vx = -900` avanza 15 unidades por paso). Si en vez de `'goal'` sale `'play'` con el balón en poder del portero, aleja más el balón del centro en `y`.

- [ ] **Step 5: Romperlo a propósito (control negativo)**

Cambia temporalmente el bucle de los 119 pasos por `expect(m.ball.x).not.toBe(goalX)` y comprueba que **falla**: eso demuestra que el balón está realmente congelado y que la aserción no pasa por casualidad. **Deshaz el cambio.**

- [ ] **Step 6: Cablear el componente — la red en `drawPitch`**

En `VaultWorldCupGame.tsx`:

1. **Borra** la línea `const GOAL_MOUTH_DEPTH = 30;` (línea 151) e impórtalo del módulo nuevo, junto a los demás imports de `./football-screen/`:

```ts
import { GOAL_MOUTH_DEPTH, NET_CELL, netLineCount } from './football-screen/goal-net';
```

2. Junto a `const GOAL_MOUTH = 'rgba(255,255,255,0.25)';` (línea 100), añade:

```ts
const NET_LINE = 'rgba(255,255,255,0.32)';
const GOAL_FRAME = 'rgba(255,255,255,0.9)';
```

3. En `drawPitch`, **sustituye** el bloque de la portería (hoy el comentario `// The goal itself: a white mouth 30 units deep behind the line.` más su `ctx.fillStyle` y su `ctx.fillRect`, líneas 836-844) por:

```ts
        // The goal itself: a white mouth 30 units deep behind the line, now with its
        // frame and its net. G11-4: the net is a STATIC grid (the one that ripples is
        // v1.5) and it is drawn HERE, in drawPitch, on purpose -- drawPlayers and
        // drawBall run after it, so the ball the engine leaves frozen inside the mouth
        // for the whole celebration is drawn ON TOP of the mesh instead of behind it.
        const mouthX = toScreenX(cam, goalX + (dir === 1 ? -GOAL_MOUTH_DEPTH : 0));
        const mouthY = toScreenY(cam, midY - p.goalWidth / 2);
        ctx.fillStyle = GOAL_MOUTH;
        ctx.fillRect(mouthX, mouthY, GOAL_MOUTH_DEPTH, p.goalWidth);
        // One path for the whole mesh: 16 line segments, one stroke, no allocation.
        ctx.strokeStyle = NET_LINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const across = netLineCount(p.goalWidth, NET_CELL);
        for (let i = 1; i <= across; i++) {
          const lineY = mouthY + i * NET_CELL;
          ctx.moveTo(mouthX, lineY);
          ctx.lineTo(mouthX + GOAL_MOUTH_DEPTH, lineY);
        }
        const deep = netLineCount(GOAL_MOUTH_DEPTH, NET_CELL);
        for (let i = 1; i <= deep; i++) {
          const lineX = mouthX + i * NET_CELL;
          ctx.moveTo(lineX, mouthY);
          ctx.lineTo(lineX, mouthY + p.goalWidth);
        }
        ctx.stroke();
        // The posts and the back of the net: the outline that turns the mouth into a
        // box the ball can be INSIDE.
        ctx.strokeStyle = GOAL_FRAME;
        ctx.lineWidth = 3;
        ctx.strokeRect(mouthX, mouthY, GOAL_MOUTH_DEPTH, p.goalWidth);
```

**Ojo con dos cosas:** `p` dentro de `drawPitch` es `PITCH`, no un jugador (línea 795: `const p = PITCH;`), y `ctx.strokeStyle`/`ctx.lineWidth` quedan cambiados al salir del bucle — la iteración siguiente los reasigna y el resto de `drawPitch` ya ha terminado, pero comprueba visualmente en el QA que ninguna línea de campo sale más gruesa de lo que era.

- [ ] **Step 7: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/goal-net.ts components/games/football-screen/goal-net.test.ts components/games/VaultWorldCupGame.tsx
git diff --stat ab3372c -- components/games/football-logic/
grep -n "GOAL_MOUTH_DEPTH" components/games/VaultWorldCupGame.tsx
```
Esperado: 1259 tests / 74 ficheros verdes (1252 + 7), `tsc` y `eslint` sin salida, el `git diff` del motor **vacío**, y el último `grep` mostrando **solo** el import y los usos dentro de `drawPitch` (ninguna declaración local).

- [ ] **Step 8: Anotar en el ledger**

`16-sep — Task 11-4 hecha: goal-net.ts + 7 tests, red estática + marco en drawPitch (1259/74). MEDIDO: el motor congela el balón dentro de la boca los 120 pasos de la celebración (match.ts 563-572), así que el ítem es dibujo puro. Pendiente commit de Paco.`

- [ ] **Step 9: Proponer commit — NO ejecutes `git add` ni `git commit`**

```
feat(world-cup): draw the goal net and frame so a goal reads as the ball ending up inside (G11-4)
```

---

### Task 11-5: `drawBall` + la sonda sin canvas (G11-3 en pantalla, y la red de determinismo de todo el paso)

**Files:**
- Modify: `components/games/VaultWorldCupGame.tsx` (imports 51-58, `drawBall` 976-996)
- Create: `components/games/football-screen/view-pipeline.test.ts`

**Interfaces:**
- Consumes de la Task 11-1: `ballLift`, `ballScale`, `ballShadowScale`, `ballShadowFade`, `BALL_SCALE_MAX`, `BALL_SHADOW_MIN`.
- Consumes de la Task 11-2: `createGestureTimers`, `resetGestures`, `beginGkCatchGestures` (firma con `prevBallX, prevBallY` — hallazgo de pre-vuelo, ver Task 11-2), `gestureProgress`, `diveReach`, `GESTURE_IDLE`, `GK_DIVE_STEPS`.
- Consumes de la Task 11-3: `createPlayerPose`, `playerPose`, `createDivePose`, `divePose`.
- Consumes de la Task 11-4: `ballInsideGoalMouth`.
- Produces: nada nuevo para tareas posteriores; cierra el cableado.

**Por qué esta sonda, y qué prueba exactamente:** ninguno de los cuatro módulos nuevos se ejecuta en un test junto a un partido de verdad, y el repo **no tiene entorno DOM**, así que el canvas no se puede probar. Lo que sí se puede probar —y es lo que de verdad da miedo de este paso— es que la capa de pantalla nueva **no toca la simulación**: `beginGkCatchGestures` lee `match.scratch.events` y podría, por un descuido, escribir en el motor o consumir un evento que otro consumidor espera. La sonda corre tres partidos CPU **completos** contra tres partidos de control idénticos que no pasan por los módulos nuevos, y exige el mismo ganador, el mismo marcador y el mismo número de pasos. Además cuenta lo que ha visto (atajadas, pasos con el balón en el aire, pasos de celebración de gol) y **falla si alguno es cero**: un partido sin una sola atajada no probaría nada de G11-2 (regla de Paco: un test que pasa no prueba nada hasta romperlo a propósito).

- [ ] **Step 1: Escribir la sonda en rojo**

Crea `components/games/football-screen/view-pipeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NORMAL_RULES } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { PLAYER_RADIUS } from '../football-logic/players';
import { TEAMS } from '../football-logic/teams';
import { BALL_SCALE_MAX, BALL_SHADOW_MIN, ballLift, ballScale, ballShadowFade, ballShadowScale } from './ball-view';
import { GESTURE_IDLE, beginGkCatchGestures, createGestureTimers, diveReach, gestureProgress, resetGestures } from './gestures';
import { ballInsideGoalMouth } from './goal-net';
import { MATCH_RUN_STEP_CAP, createMatchRun, finishMatchRun, stepMatchRun } from './match-run';
import { createDivePose, createPlayerPose, divePose, playerPose } from './player-pose';

const BRA = TEAMS[2];
const FRA = TEAMS[5];
// Three different matches, not three runs of the same one: enough goals, saves and
// high balls between them to exercise every helper of the step.
const SEEDS = [23, 71, 131];

describe('the step-11 view layer over three full matches', () => {
  it('changes nothing in the simulation and produces only values inside its own bounds', () => {
    // Everything the probe observes, summed across the three matches.
    let saves = 0;
    let gestureSteps = 0;
    let airborneSteps = 0;
    let goalPhaseSteps = 0;
    let ballInsideMouthSteps = 0;
    let finiteEverywhere = true;
    let scaleInBounds = true;
    let shadowInBounds = true;
    let liftNeverNegative = true;
    let progressInBounds = true;
    let reachInBounds = true;
    let poseInsideBody = true;

    const gestures = createGestureTimers();
    const pose = createPlayerPose();
    const dive = createDivePose();

    for (const seed of SEEDS) {
      // The control: the very same match, stepped WITHOUT the screen layer.
      const control = createMatchRun(BRA, FRA, seed, 6, [false, false], NORMAL_RULES, [0, 0]);
      const controlWinner = finishMatchRun(control);
      expect(controlWinner).not.toBe(-1);

      const probed = createMatchRun(BRA, FRA, seed, 6, [false, false], NORMAL_RULES, [0, 0]);
      const m = probed.match;
      resetGestures(gestures);
      let steps = 0;
      while (m.phase !== 'over' && steps < MATCH_RUN_STEP_CAP) {
        // Pre-flight finding: the direction has to be read from the ball's position
        // BEFORE this step, not from the 'gk-catch' event -- see gestures.ts's header.
        const prevBallX = m.ball.x;
        const prevBallY = m.ball.y;
        stepMatchRun(probed);
        steps++;

        saves += beginGkCatchGestures(m, gestures, prevBallX, prevBallY);

        if (m.phase === 'goal') {
          goalPhaseSteps++;
          if (ballInsideGoalMouth(m.ball.x, m.ball.y, m.ball.z, PITCH)) ballInsideMouthSteps++;
        }

        const z = m.ball.z;
        if (z > 0) airborneSteps++;
        const scale = ballScale(z);
        const shadow = ballShadowScale(z);
        const fade = ballShadowFade(z);
        const lift = ballLift(z);
        if (!Number.isFinite(scale + shadow + fade + lift)) finiteEverywhere = false;
        if (scale < 1 || scale > BALL_SCALE_MAX) scaleInBounds = false;
        if (shadow > 1 || shadow < BALL_SHADOW_MIN || fade > 1) shadowInBounds = false;
        if (lift < 0) liftNeverNegative = false;

        for (let i = 0; i < m.players.length; i++) {
          const p = m.players[i];
          playerPose(p.x, p.y, p.facingX, p.facingY, PLAYER_RADIUS, pose);
          if (!Number.isFinite(pose.headX + pose.headY + pose.leftX + pose.rightY)) finiteEverywhere = false;
          if (Math.hypot(pose.headX - p.x, pose.headY - p.y) + pose.headR > PLAYER_RADIUS + 1e-9) poseInsideBody = false;

          const progress = gestureProgress(gestures, p.id, m.stepCount);
          if (progress !== GESTURE_IDLE) {
            gestureSteps++;
            if (progress < 0 || progress >= 1) progressInBounds = false;
            const reach = diveReach(progress);
            if (reach < 0 || reach > 1.5 + 1e-9) reachInBounds = false;
            divePose(p.x, p.y, gestures.dirX[p.id], gestures.dirY[p.id], PLAYER_RADIUS, reach, dive);
            if (!Number.isFinite(dive.frontX + dive.frontY + dive.sideX + dive.endR)) finiteEverywhere = false;
          }
        }
      }

      // THE point of the probe: the screen layer read the match and changed nothing.
      expect(steps).toBeLessThan(MATCH_RUN_STEP_CAP);
      expect(m.stepCount).toBe(control.match.stepCount);
      expect(m.score).toEqual(control.match.score);
      expect(m.half).toBe(control.match.half);
    }

    // Nothing here is allowed to be zero: a probe that never saw a save, a high ball
    // or a goal would pass while proving nothing.
    expect(saves).toBeGreaterThan(0);
    expect(gestureSteps).toBeGreaterThan(0);
    expect(airborneSteps).toBeGreaterThan(0);
    expect(goalPhaseSteps).toBeGreaterThan(0);
    expect(ballInsideMouthSteps).toBe(goalPhaseSteps);

    expect(finiteEverywhere).toBe(true);
    expect(scaleInBounds).toBe(true);
    expect(shadowInBounds).toBe(true);
    expect(liftNeverNegative).toBe(true);
    expect(progressInBounds).toBe(true);
    expect(reachInBounds).toBe(true);
    expect(poseInsideBody).toBe(true);
  });

  it('keeps one gesture per keeper: a save never starts a gesture on anybody else', () => {
    const run = createMatchRun(BRA, FRA, SEEDS[0], 6, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const gestures = createGestureTimers();
    resetGestures(gestures);
    let outfieldGestures = 0;
    let steps = 0;
    while (m.phase !== 'over' && steps < MATCH_RUN_STEP_CAP) {
      const prevBallX = m.ball.x;
      const prevBallY = m.ball.y;
      stepMatchRun(run);
      steps++;
      beginGkCatchGestures(m, gestures, prevBallX, prevBallY);
      for (let i = 0; i < m.players.length; i++) {
        const p = m.players[i];
        if (p.role !== 'gk' && gestureProgress(gestures, p.id, m.stepCount) !== GESTURE_IDLE) outfieldGestures++;
      }
    }
    expect(outfieldGestures).toBe(0);
  });
});
```

- [ ] **Step 2: Verla fallar (y sobre todo: comprobar que NO es vacua)**

Ejecuta: `npx vitest run components/games/football-screen/view-pipeline.test.ts`

Este test debería **pasar a la primera**, porque los cuatro módulos ya existen. Eso significa que aquí el paso «verlo en rojo» hay que provocarlo a mano, y es obligatorio hacerlo:

1. Comenta la línea `saves += beginGkCatchGestures(m, gestures, prevBallX, prevBallY);` → esperado: **falla** en `expect(saves).toBeGreaterThan(0)` y en `expect(gestureSteps).toBeGreaterThan(0)`. Si no falla, las semillas no producen ninguna atajada: cambia `SEEDS` hasta que sí, y anota en un comentario del test por qué esas semillas. **Deshaz el cambio.**
2. Cambia `expect(ballInsideMouthSteps).toBe(goalPhaseSteps)` por `.toBe(goalPhaseSteps + 1)` → esperado: **falla**, lo que demuestra que hubo goles de verdad y que el balón estaba dentro de la boca en todos y cada uno de esos pasos. **Deshaz el cambio.**
3. Si `goalPhaseSteps` sale 0 con estas semillas (posible si los tres partidos se resolvieran en la tanda, donde la fase nunca es `'goal'`), **no rebajes la aserción**: cambia las semillas hasta que haya goles en juego abierto.

- [ ] **Step 3: Verla pasar**

Ejecuta: `npx vitest run components/games/football-screen/view-pipeline.test.ts`
Esperado: **PASA**, 2 tests. Duración orientativa: tres partidos completos más tres de control son ~90 000 pasos; `match-run.test.ts` ya hace partidos enteros y la suite entera tarda ~2,2 s, así que la sonda debería quedarse por debajo de los 3 s ella sola. Si se dispara por encima de 10 s, baja `SEEDS` a dos semillas antes que recortar aserciones.

- [ ] **Step 4: Cablear `drawBall` (G11-3 en pantalla)**

En `components/games/VaultWorldCupGame.tsx`, añade al bloque de imports de `./football-screen/`:

```ts
import { ballLift, ballScale, ballShadowFade, ballShadowScale } from './football-screen/ball-view';
```

Y **sustituye** el cuerpo de `drawBall` (líneas 976-996) por:

```ts
    function drawBall(): void {
      const match = run.match;
      const b = match.ball;
      if (!isOnScreen(cam, b.x, b.y, BALL_MARGIN)) return;
      const x = toScreenX(cam, b.x);
      const y = toScreenY(cam, b.y);
      // The shadow stays on the ground and the ball rises with z: it is the only cue
      // that a long pass is going over the defenders' heads. G11-3 adds the two the
      // 11-sep QA asked for, with NO change to SHOT_VZ_MAX or the gravity: the shadow
      // SHRINKS and FADES as the ball climbs, and the ball itself GROWS. globalAlpha
      // is a number, so the fade costs no 'rgba(...)' string per frame (criterion 20).
      const shadow = ballShadowScale(b.z);
      ctx.globalAlpha = ballShadowFade(b.z);
      ctx.fillStyle = SHADOW;
      ctx.beginPath();
      ctx.ellipse(x, y, BALL_RADIUS * shadow, 3.5 * shadow, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = BALL_COLOR;
      ctx.beginPath();
      ctx.arc(x, y - ballLift(b.z), BALL_RADIUS * ballScale(b.z), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = BALL_TRIM;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
```

`ctx.globalAlpha` vuelve a 1 dos líneas después, **dentro de la misma función**: ningún otro dibujo del frame hereda la transparencia.

- [ ] **Step 5: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/view-pipeline.test.ts components/games/VaultWorldCupGame.tsx
git diff --stat ab3372c -- components/games/football-logic/
grep -n "globalAlpha" components/games/VaultWorldCupGame.tsx
```
Esperado: 1261 tests / 75 ficheros verdes (1259 + 2), `tsc` y `eslint` sin salida, el `git diff` del motor **vacío**, y el `grep` de `globalAlpha` mostrando **exactamente dos** líneas, las dos dentro de `drawBall`.

- [ ] **Step 6: Anotar en el ledger**

`16-sep — Task 11-5 hecha: drawBall con escala/sombra por z + sonda view-pipeline (2 tests, 1261/75). La sonda demuestra ganador/marcador/pasos idénticos con y sin capa de pantalla. Pendiente commit de Paco.`

- [ ] **Step 7: Proponer commit — NO ejecutes `git add` ni `git commit`**

```
feat(world-cup): shot height reads on screen, plus a headless probe proving the view layer is inert (G11-3)
```

---

### Task 11-6 (cierre): verificación del paso entero, lista de QA para Paco y commit final

**Files:**
- Modify: `.superpowers/sdd/2026-09-15-vault-world-cup-step-11/progress.md`
- Create: `.superpowers/sdd/2026-09-15-vault-world-cup-step-11/qa-paco.md`
- Ningún fichero de código se toca en esta tarea. Si al verificar aparece un fallo, **se arregla en la tarea que lo introdujo**, no aquí.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la lista con la que Paco hace el QA jugado (G11-6) y el mensaje de commit del paso.

- [ ] **Step 1: Verificación completa del paso**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/ components/games/VaultWorldCupGame.tsx
```
Esperado: **1261 tests en 75 ficheros verdes** (baseline 1213 + 12 + 14 + 13 + 7 + 2 = 1261; 70 + 5 ficheros nuevos = 75), `tsc` sin salida, `eslint` sin salida.

- [ ] **Step 2: Las cuatro verificaciones de las Global Constraints**

```bash
git diff --stat ab3372c -- components/games/football-logic/
grep -rn "Math.random" components/games/football-screen/
grep -rn "@/" components/games/football-screen/
grep -rn "React\|document\.\|window\.\|new Audio" components/games/football-screen/
```
Esperado: los **cuatro vacíos**. El primero es el que importa: el motor sigue exactamente como lo dejó `ab3372c`.

- [ ] **Step 3: Repasar el diff entero con ojos de revisor**

```bash
git diff --stat ab3372c
git diff ab3372c -- components/games/VaultWorldCupGame.tsx
```
Comprueba, una por una:
1. `specs/31-vault-world-cup.md` aparece modificado y **no es tuyo** (es el cambio de Paco anterior al plan). No lo toques.
2. Los cinco ficheros `.ts` nuevos de `football-screen/` están, cada uno con su `.test.ts`.
3. En `VaultWorldCupGame.tsx` no hay ninguna declaración local de `GOAL_MOUTH_DEPTH` (se mudó a `goal-net.ts`).
4. En `VaultWorldCupGame.tsx` no hay ningún literal de objeto, `new`, plantilla de string ni `.map(` dentro de `draw()`, `drawPlayer`, `drawBall`, `drawPitch` ni `runStep`.
5. El palito de dirección, los arcos de celebración, el triángulo del cursor, las muescas de carga y el anillo de sprint siguen en `drawPlayer`, intactos.

- [ ] **Step 4: Escribir la lista de QA de Paco**

Crea `.superpowers/sdd/2026-09-15-vault-world-cup-step-11/qa-paco.md` con exactamente esto:

```markdown
# QA jugado — paso 11 (ola de ajustes visuales)

Diez puntos, en orden de importancia. Modo ENTRENAMIENTO para los cuatro primeros
(no hay reloj y se puede repetir), un amistoso para el resto.

1. **El jugador se lee como una figura, no como una ficha.** Cabeza y hombros se ven
   claros a la distancia normal de cámara, y la cabeza apunta a donde va el jugador.
2. **La orientación sirve para jugar**, no solo decora: antes de dar un pase se ve
   hacia dónde mira el jugador sin tener que buscar el palito amarillo.
3. **¿Sobra el palito de dirección?** Se ha conservado a propósito. Si con los hombros
   ya basta, se quita en una línea; dilo y se hace.
4. **El portero se estira al atajar** y vuelve a estar de pie antes de sacar. Mira
   sobre todo que el estirón vaya **hacia el balón** y no hacia un lado cualquiera
   (usa la posición del balón un paso antes de la atajada, no la del evento del motor
   — ver hallazgo de pre-vuelo en la Task 11-2). Mira también si el palito de
   dirección amarillo, que se sigue dibujando encima de la cápsula del estirón (no se
   suprime para el portero tirándose, decisión deliberada del plan para no tocar más
   `drawPlayer` de lo imprescindible), estorba o sobra en ese momento concreto.
5. **El chut alto se ve subir**: con la carga a tope, el balón crece y la sombra se
   encoge y se aclara. Si sigue pareciendo plano, la palanca siguiente es subir la
   elevación (hoy z × 0,35, constante `BALL_Z_LIFT`) — y solo después, y como tarea
   aparte, tocar `SHOT_VZ_MAX` o la gravedad (G11-3).
6. **El gol se ve entrar**: la portería ya tiene marco y red de rejilla, y el balón se
   queda dentro toda la celebración. ¿Se entiende el gol sin mirar el marcador?
7. **La red estática, ¿basta?** La red que ondula está aparcada en la v1.5 (G11-4).
   Si al verlo la echas de menos, dilo y se planifica allí.
8. **Las estatuas del ENTRENAMIENTO y los quince aparcados de la tanda** llevan la
   misma figura que el resto (G11-1). Mira si eso confunde o si da igual.
9. **Minimapa** (G11-5): está dentro del campo y semitransparente. Solo hay que
   confirmarlo; si quieres más o menos opacidad, es cambiar una constante.
10. **Que nada se haya roto por el camino**: las líneas del campo, el círculo central,
    las áreas y el punto de penalti se ven igual que antes de este paso.
```

- [ ] **Step 5: Cerrar el ledger**

Añade a `.superpowers/sdd/2026-09-15-vault-world-cup-step-11/progress.md`:

```
16-sep — Paso 11 COMPLETO en código: 1261 tests / 75 ficheros verdes, tsc y eslint limpios, motor intacto desde ab3372c (git diff vacío). G11-1/2/3/4 implementados, G11-5 sin tarea (confirmación visual). Lista de QA en qa-paco.md. Pendiente: commits de Paco + QA jugado.
```

- [ ] **Step 6: Peticiones separadas al motor (lista, no cambios)**

Si durante el paso ha aparecido algo que solo se arregla en `football-logic/`, escríbelo al final de `progress.md` bajo el encabezado `## Peticiones separadas al motor`, con el fichero y el porqué. Si no ha aparecido nada, escribe la línea `## Peticiones separadas al motor: ninguna.` — el hueco vacío también es información.

Candidata ya conocida, que **no** se ejecuta en este paso: `GRAVITY` no está exportada de `football-logic/ball.ts:21`, así que los tests de altura escriben el apogeo como literal en vez de calcularlo. Exportarla sería un cambio de una línea en el motor y por eso queda fuera (G11-3 y la regla de motor congelado).

- [ ] **Step 7: Proponer el commit del paso — NO ejecutes `git add` ni `git commit`**

Si Paco prefiere un único commit para todo el paso en vez de los cinco de las tareas:

```
feat(world-cup): step 11 visual wave — top-down players, diving keeper, visible shot height and goal net (G11-1..G11-4)
```

Recuérdale que `specs/31-vault-world-cup.md` ya estaba modificado en el working tree antes del paso (las decisiones G11) y que es suyo decidir si entra en el mismo commit.

---

## Self-review (ejecutada al escribir el plan, 15-sep)

**1. Cobertura del spec.** G11-1 → Task 11-3 (`player-pose.ts` + `drawPlayer`, figura para todos, sin rama nueva). G11-2 → Tasks 11-2 (temporizador desde `'gk-catch'`, 35 pasos) y 11-3 (dibujo del estirón). G11-3 → Tasks 11-1 (`ball-view.ts`, sin tocar `SHOT_VZ_MAX` ni la gravedad) y 11-5 (`drawBall`). G11-4 → Task 11-4 (red estática + la medición del Caso A convertida en test). G11-5 → **sin tarea, por decisión del grill**; aparece como punto 9 de la lista de QA, que es exactamente lo que G11-5 pide. G11-6 (calendario) → no es código. Criterio 20 → en las Global Constraints, en el diseño de los cuatro módulos (todo preasignado, todo in-place, `globalAlpha` en vez de construir `rgba(...)`) y en la comprobación del Step 3 de la Task 11-6. Criterio 21 (la suite no baja) → baseline 1213 medida hoy, cada tarea dice su total esperado. **Sin huecos.**

**2. Placeholders.** Ningún «TBD», ningún «similar a la Task N» (el código de cada tarea está escrito entero, aunque se repita), ningún «añade manejo de errores», ningún paso que diga qué hacer sin enseñar cómo. Todos los tipos y funciones que una tarea usa están definidos en su bloque **Interfaces** o en el de una tarea anterior.

**3. Consistencia de tipos.** `GestureTimers` (11-2) se crea con `createGestureTimers()` y se lee con `gestureProgress`/`g.dirX[i]`/`g.dirY[i]` en 11-3 y 11-5 — mismos nombres. `PlayerPose`/`DivePose` (11-3) se crean con `createPlayerPose()`/`createDivePose()` y se escriben con `playerPose`/`divePose` — mismas firmas en las tres tareas que los usan. `GOAL_MOUTH_DEPTH` existe en **un** sitio (`goal-net.ts`, 11-4) y la Task 11-4 borra explícitamente la declaración local del `.tsx`. `ballScale`/`ballShadowScale`/`ballShadowFade`/`ballLift` se declaran en 11-1 y se consumen con esos mismos nombres en 11-5 y en la sonda. `GESTURE_IDLE` es `-1` en 11-2 y se compara con `!==`/`===` en 11-3 y 11-5, nunca con `> 0`. `beginGkCatchGestures(match, g, prevBallX, prevBallY, durationSteps?)` (11-2, firma corregida en el pre-vuelo del 15-sep) se llama con esos cuatro/cinco argumentos, en ese orden, en los tres sitios que la usan: `gestures.test.ts` (11-2), el cableado de `runStep` (11-3) y `view-pipeline.test.ts` (11-5) — los tres capturan `prevBallX/prevBallY` leyendo `match.ball.x/y` inmediatamente antes de su propio `stepMatchRun`.

**4. Hallazgo de pre-vuelo aplicado (15-sep, antes de la ejecución SDD del 16-sep).** El diseño original de G11-2 asumía que `ActionEvent.x/y` de un `'gk-catch'` era la posición del balón en el instante de la atajada (así lo daba por hecho el informe de diseño, sección C). Medido contra el código real (`ai.ts:342` y `ball.ts:54-58`), es falso: `keeperCatch` pide posesión (que fija `ball.x/y` a `gk.x/y + facingX/Y * CONTROL_DIST`) **antes** de copiar `ball.x/y` al evento, así que `ev.x - gk.x` es siempre exactamente el `facingX` del portero — el estirón nunca habría apuntado al balón, solo a donde ya miraba el portero, y el test tal como estaba escrito no lo habría detectado (solo comprobaba longitud 1). Corregido pasando `prevBallX/prevBallY` (la posición del balón un paso antes de la atajada, leída por el propio componente antes de `stepMatchRun`) en vez de leer `ev.x/ev.y`. Ver Task 11-2 para el detalle completo y el control negativo que demuestra el fallo original.

**Riesgo que el plan NO cierra y que solo cierra el QA de Paco:** si la escala del balón y la sombra no bastan para que el chut «suba», la palanca siguiente toca el motor y queda fuera de este paso por decisión de G11-3. Está escrito como punto 5 de la lista de QA.
