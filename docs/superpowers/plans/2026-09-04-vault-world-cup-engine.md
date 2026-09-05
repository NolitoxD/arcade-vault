# Vault World Cup — Etapa A (motor sin pantalla) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el motor puro `components/games/football-logic/` de VAULT WORLD CUP hasta el paso 5 del spec: azar con semilla, campo, selecciones y formaciones con su red de invariantes, la simulación de **paso fijo** determinista de dieciocho jugadores y un balón con altura, las acciones del jugador (chut con carga, pases, robo, entrada al suelo) y el controlado derivado con histéresis, el árbitro con sus saques, y el partido entero (`stepMatch`) con máquina de fases guardada, dos partes de 90 s y gol de oro. **Sin IA, sin las 16 selecciones, sin pantalla**: eso son las etapas B, C y D.

**Architecture:** Todo en `components/games/football-logic/` como funciones puras que reciben por parámetro el campo (`PitchDef`), las selecciones, las formaciones, el estado (`MatchState`, `PlayerState[]`, `BallState`) y la fuente de azar (`Rng`). **Ninguna función lee estado de módulo**; lo único a nivel de módulo son constantes con nombre y tablas de datos. Las funciones del bucle escriben en el estado que reciben y en **out-params** creados una vez. La simulación avanza en pasos fijos de `STEP_MS = 1000/60`; los tiempos del spec (2 s de sprint, 1 s en el suelo, 5 s de cuenta atrás, 90 s por parte) se convierten a pasos con `stepsFor(seconds)` y se cuentan en enteros. El azar entra **solo** por el `rng` inyectado a `stepMatch`, y lo consumen únicamente el robo de pie y el portero en el penalti (la IA lo consumirá en la etapa B). `stepMatch(match, inputs, rng)` recibe dos `TeamInput` simétricos y no sabe cuál es humano: es la puerta del online que se deja abierta sin construir nada de red.

**Tech Stack:** TypeScript estricto, vitest 4.1.11 (tests `*.test.ts` junto al código, sin `vitest.config`), Node. Ni React ni canvas ni Supabase en esta etapa.

**Spec:** `specs/31-vault-world-cup.md` (Approved, grill hecho 2026-09-04) · Plan de referencia: `docs/superpowers/plans/2026-09-01-vault-fighter.md` · Patrón de módulo puro: `components/games/fighter-logic/` (`fighters.ts`, `roster-invariants.ts`, `ai.ts`, `combat.ts`, `tournament.ts`)

---

## Global Constraints

- **Commits: SOLO el dueño.** Ninguna tarea ejecuta `git add` ni `git commit`. Cada tarea termina dejando el working tree **verificado** (`npx vitest run` + `npx tsc --noEmit`; `npm run build` además al cerrar la Task 5) y **propone el mensaje de commit exacto**. Si hiciera falta `--no-verify`, se avisa.
- **Nunca arrancar `next dev`**: el dueño tiene el suyo en :3000. Esta etapa no tiene pantalla: la verificación es siempre la suite y el compilador.
- **Comentarios y nombres de tests en inglés** (convención del repo). El plan, el spec y el chat, en castellano. Los textos de cara al jugador (nombres de selección), en castellano y mayúsculas.
- **Ficheros en kebab-case**; tipos en PascalCase; variables, funciones y constantes como en `fighter-logic/` (`SCREAMING_CASE` para constantes de módulo). TypeScript estricto: nada de `any`, nada de `!` gratuito, nada de `as` para tapar un tipo (solo `as never` en fixtures de tests que fabrican datos ilegales a propósito, como en `roster-invariants.test.ts`).
- **Nada de estado de módulo.** El campo, las selecciones, las formaciones, el estado del partido y el `rng` **se pasan siempre por parámetro**. Una función que lea `PITCH`, `TEAMS` o `FORMATIONS` en vez del parámetro que recibe está **prohibida** (la lección de Kong con `LADDERS`, tres veces). Los tests pasan `PITCH` y `FORMATIONS` como argumentos, y así se ve.
- **Determinismo (riesgo 3 del spec): PROHIBIDO en `football-logic/`** `Math.random`, `Date.now`, `performance.now`, iterar un `Set` o un `Map` para decidir un orden, y `Math.sin`/`Math.cos`/`Math.atan2`/`Math.hypot` en la física. Las direcciones son vectores normalizados con `Math.sqrt` (exacto por IEEE 754). Los desempates son siempre por `id` más bajo. Antes de cerrar cada tarea: `grep -rn "Math.random\|Date.now\|performance.now\|Math.sin\|Math.cos\|Math.atan2\|Math.hypot" components/games/football-logic/` debe devolver **vacío**.
- **Paso fijo: nada de `dtMs` dentro del motor.** Todo tiempo es un entero de pasos (`stepsFor(seconds)`); toda velocidad "u/s" se convierte con `perStep(unitsPerSecond)`. Ninguna función de `football-logic/` recibe milisegundos reales.
- **Sin asignación de memoria por paso.** Las funciones que se llaman dentro de `stepMatch` (`stepPhysics`, `stepPlayer`, `stepBall`, `applyButtons`, `stepTackle`, `judgeBall`, `stepSetPiece`, `updateControlled`) escriben en out-params y en el estado; nada de `filter`/`map`/spread/objetos literales/`new`/closures dentro de ellas. Las únicas asignaciones permitidas son en **eventos** (empezar un saque, crear el partido), nunca por paso.
- **Los invariantes van ANTES que el contenido.** La Task 1 monta la red con **dos selecciones y una formación**; las otras 14 y las 2 formaciones que faltan llegan en el paso 7 (etapa B) con la red ya en verde. Si al escribir contenido salta un invariante, se corrige el contenido, nunca el invariante.
- **Un invariante vale por lo que RECHAZA.** Por cada comprobación de `invariants.ts` hay un **test negativo** con un dato fabricado que la incumple. Un invariante sin test negativo es decorativo.
- **Regla anti-coincidencia de fixtures (riesgo 7 del spec):** antes de dar por bueno un test, preguntarse **"¿pasaría este test con otros números?"**. Concretamente: nada a distancia exactamente 0 salvo que el test sea sobre la distancia 0; ningún intervalo igual al paso; las distancias de histéresis a 30 y 41, no a 39/40/41 pegadas al umbral por los dos lados a la vez; los tests de determinismo con un negativo que demuestre que sí detectan diferencias. Cada test de este plan dice en su nombre o en un comentario qué coincidencia evita.
- **Todo lo exportado tiene consumidor** al cerrar cada tarea: código o test. Lo que no lo tiene aún se lista en el bloque "Interfaces → Produces" como "consumido por Task N" y en el resumen final. Al cerrar la Task 5, recorrer las exportaciones: cada una con al menos un import fuera de su propio fichero, o en la lista de "consumido por Task 6/8".
- **Suite de partida: 504 tests verdes en 38 ficheros** (verificado 2026-09-04 con `npx vitest run`: `Test Files 38 passed (38) · Tests 504 passed (504)`). No se admiten regresiones; cada tarea suma.
- **Si un test existente cambia de valor esperado, es un bug que hay que INVESTIGAR, no una expectativa que actualizar.** Ante una expectativa que no cuadra: responder **BLOCKED** con la medición, no relajar el test. En esta etapa no hay ninguna lista hard-codeada del catálogo que crezca (el registro es la etapa D), así que **no hay excepciones declaradas**.
- **Números del spec en constantes con nombre**, nunca literales enterrados: `PLAYER_SPEED = 180`, `SHOT_SPEED_MAX = 950`, `CONTROL_HYSTERESIS = 40`… La tabla "Números de partida" del spec se transcribe entera a constantes en esta etapa (las del portero y la IA, `GK_LINE_DIST`, van donde las consumirá la etapa B).
- **Tipos y firmas idénticos entre tareas.** Cada tarea define en "Produces" los nombres exactos; las siguientes los usan tal cual. El Self-Review del final comprueba la consistencia.

---

## File Structure

Todo en `components/games/football-logic/`. Orden de dependencias (una fila solo importa de las de arriba):

| Fichero | Tarea | Responsabilidad |
|---|---|---|
| `rng.ts` | 1 | `Rng`, `createRng(seed)` — mulberry32, único origen de azar del motor |
| `rng.test.ts` | 1 | misma semilla = misma secuencia; semillas distintas = secuencias distintas; rango [0,1) |
| `pitch.ts` | 1 | `PitchDef`, `PITCH` (2000×1300, áreas, portería, punto de penalti, círculo central) y consultas geométricas puras (`goalLineX`, `isBetweenPosts`, `isInsideBigArea`, `isInsideSmallArea`, `clampToBigArea`, `penaltySpotX`) |
| `pitch.test.ts` | 1 | `PITCH` pasa `checkPitch`; consultas de lado 0 y lado 1 |
| `teams.ts` | 1 | `Role`, `Strategy`, `TeamDef`, `FormationSlot`, `Formation`, `TEAM_SIZE`, `OUTFIELD`, `BANK_SIZE`, `FORMATION_COUNT`, `STRATEGY_SHIFT`, `STRATEGIES`, `FORMATIONS` (solo 3-3-2), `TEAMS` (solo ESPAÑA e ITALIA), `teamById`, `slotCounts` |
| `teams.test.ts` | 1 | las dos selecciones y la formación reales pasan sus invariantes individuales; **no** llama a `checkBank`/`checkFormations` sobre el contenido real (eso lo cierra el paso 7) |
| `invariants.ts` | 1 (+2) | `checkPitch`, `checkFormation`, `checkFormations`, `checkTeam`, `checkTeams`, `checkBank`; la Task 2 añade `checkGoalkeepersInBox` |
| `invariants.test.ts` | 1 (+2) | cada comprobación con su **test negativo** sobre un dato fabricado |
| `clock.ts` | 2 | `STEPS_PER_SECOND`, `STEP_MS`, `stepsFor`, `perStep` — sin imports, para que `players.ts`/`ball.ts` no formen ciclo con `step.ts`; `step.ts` los re-exporta y es el contrato público |
| `geometry.ts` | 2 | `Vec2`, `INV_SQRT2`, `dist`, `normalizeInto`, `clamp` — sin trigonometría |
| `geometry.test.ts` | 2 | normalización, distancia, vector nulo |
| `step.ts` | 2 | re-exporta `clock.ts` (`STEP_MS`, `STEPS_PER_SECOND`, `stepsFor`, `perStep`) y define `AttackDirs` y `stepPhysics` (movimiento de los controlados + balón; la Task 5 lo envuelve) |
| `step.test.ts` | 2 | `stepsFor`/`perStep`; **el test que manda**: 5 400 pasos con la misma secuencia de entradas producen el mismo mundo paso a paso, y entradas distintas producen mundos distintos |
| `input.ts` | 2 | `ButtonState`, `TeamInput`, `createTeamInput`, `copyTeamInput`, `isDown`, `checkTeamInput` |
| `input.test.ts` | 2 | `isDown`; `checkTeamInput` acepta la entrada neutra y rechaza cada campo inválido |
| `players.ts` | 2 | `PlayerState`, velocidades y tiempos como constantes, `createPlayers`, `anchorFor`, `placeByFormation`, `stepPlayer`, `isDown`→`isPlayerDown`, `isSprinting`, `ownGoalSide` |
| `players.test.ts` | 2 | 18 jugadores con ids 0-17 y roles por formación; espejo del equipo 1; velocidades 180/160/×1,4; ráfaga de 2 s y recuperación de 3 s en pasos; suelo; portero recortado al área grande |
| `ball.ts` | 2 | `BallState`, gravedad, rozamiento, bote, `createBall`, `kickBall`, `givePossession`, `stickToOwner`, `stepBall` (vuelo + pegado al pie + recogida por proximidad) |
| `ball.test.ts` | 2 | pegado al pie delante del `facing`; pase largo cae a ~350 u; bloqueo del pateador; recogida por el más cercano con desempate por id; balón alto no se recoge |
| `actions.ts` | 3 | `ActionEvent`, `createActionEvent`, `shoot`, `shortPass`, `longPass`, `steal`, `startTackle`, `stepTackle`, `releaseFromGoalkeeper`, `applyButtons`, `updateControlled` |
| `actions.test.ts` | 3 | chut 700→950 por carga; pases 420/560; robo 65 % por rng inyectado; tres desenlaces de la entrada; controlado con cada rama e histéresis (30 no cambia, 41 sí) |
| `referee.ts` | 4 | `SetPieceKind`, `RefereeCall`, `createRefereeCall`, `judgeBall`, `judgeFoul` |
| `referee.test.ts` | 4 | gol entre postes y bajo el larguero; no gol por encima del larguero ni fuera de los postes; banda; córner/saque de puerta según el último toque; tiro libre fuera del área, penalti dentro |
| `set-pieces.ts` | 4 | `SetPieceState`, `SET_PIECE_COUNTDOWN_STEPS`, `createSetPieceState`, `beginSetPiece`, `stepSetPiece` (cruceta → dirección, cuenta atrás, ejecución automática, penalti con portero por `penaltyReadChance` por parámetro) |
| `set-pieces.test.ts` | 4 | dirección se guarda la última no nula; cuenta atrás en pasos; cada tipo ejecuta pase o chut; penalti atajado/no atajado según el rng inyectado |
| `match.ts` | 5 | `MatchPhase`, `MatchState`, `createMatch`, transiciones guardadas (`resumePlay`, `callSetPiece`, `scoreGoal`, `endGoalPause`, `endHalf`, `endHalfTime`, `abandon`), `stepMatch` |
| `match.test.ts` | 5 | cada transición desde cada fase ilegal devuelve `false` sin tocar el estado; reloj de 5 400 pasos por parte; cambio de campo; gol de oro; partido completo con entradas **grabadas y reproducidas** (criterio 1) y negativo por semilla |

Ficheros de la etapa B que este plan **no** crea pero cuyos tipos quedan preparados: `ai.ts` (consume `TeamInput`, `anchorFor`, `STRATEGIES`, `GK_LINE_DIST`, `gkPenaltyRead`), `world-cup.ts`, `mode.ts`.

---

## Task 1: `rng.ts`, `pitch.ts`, `teams.ts` e `invariants.ts` — la red antes que el contenido

**Files:**
- Create: `components/games/football-logic/rng.ts`
- Create: `components/games/football-logic/pitch.ts`
- Create: `components/games/football-logic/teams.ts` (**dos** selecciones y **una** formación; el resto es el paso 7)
- Create: `components/games/football-logic/invariants.ts`
- Test: `components/games/football-logic/rng.test.ts`
- Test: `components/games/football-logic/pitch.test.ts`
- Test: `components/games/football-logic/teams.test.ts`
- Test: `components/games/football-logic/invariants.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (todo lo de abajo lo usan las Tasks 2-5 con estos nombres exactos):

```ts
// rng.ts
export type Rng = () => number;                 // [0, 1)
export function createRng(seed: number): Rng;   // mulberry32; misma semilla = misma secuencia

// pitch.ts
export type Side = 0 | 1;                        // 0 = portería en x = 0, 1 = portería en x = width
export type PitchDef = {
  width: number; height: number;                 // 2000 × 1300
  goalWidth: number;                             // entre postes, en y
  crossbarHeight: number;                        // z del larguero
  bigAreaDepth: number; bigAreaWidth: number;    // área grande
  smallAreaDepth: number; smallAreaWidth: number;// área pequeña
  penaltySpotDist: number;                       // desde la línea de gol
  centerCircleRadius: number;
};
export const PITCH: PitchDef;
export function centerX(pitch: PitchDef): number;
export function centerY(pitch: PitchDef): number;
export function goalLineX(pitch: PitchDef, side: Side): number;          // 0 | width
export function penaltySpotX(pitch: PitchDef, side: Side): number;
export function isBetweenPosts(pitch: PitchDef, y: number): boolean;
export function isInsideBigArea(pitch: PitchDef, side: Side, x: number, y: number): boolean;
export function isInsideSmallArea(pitch: PitchDef, side: Side, x: number, y: number): boolean;
export function clampToBigArea(pitch: PitchDef, side: Side, p: { x: number; y: number }): void;

// teams.ts
export type Role = 'gk' | 'def' | 'mid' | 'fwd';
export type OutfieldRole = Exclude<Role, 'gk'>;
export type Strategy = 'attack' | 'neutral' | 'defend';
export type Kit = { primary: string; secondary: string };    // '#rrggbb'
export type TeamDef = { id: string; name: string; kit: Kit };
export type FormationSlot = { role: OutfieldRole; x: number; y: number }; // fracciones (0,1), equipo que ataca hacia +x
export type Formation = { id: string; name: string; slots: readonly FormationSlot[] };
export const TEAM_SIZE = 9;
export const OUTFIELD = 8;
export const BANK_SIZE = 16;          // paso 7
export const FORMATION_COUNT = 3;     // paso 7
export const STRATEGY_SHIFT = 0.12;
export const STRATEGIES: Readonly<Record<Strategy, number>>;   // attack +0.12, neutral 0, defend -0.12
export const FORMATIONS: readonly Formation[];                 // Task 1: solo '3-3-2'
export const TEAMS: readonly TeamDef[];                        // Task 1: 'espana', 'italia'
export function teamById(teams: readonly TeamDef[], id: string): TeamDef | undefined;
export function slotCounts(f: Formation): [number, number, number];   // [def, mid, fwd]

// invariants.ts
export function checkPitch(pitch: PitchDef): string[];
export function checkFormation(f: Formation): string[];
export function checkFormations(formations: readonly Formation[]): string[];   // + FORMATION_COUNT
export function checkTeam(def: TeamDef): string[];
export function checkTeams(teams: readonly TeamDef[]): string[];               // unicidad, sin contar
export function checkBank(teams: readonly TeamDef[]): string[];                // checkTeams + BANK_SIZE
```

Coordenadas de mundo: `x ∈ [0, width]` de izquierda a derecha, `y ∈ [0, height]` de arriba abajo, `z` altura. Las porterías están en `x = 0` (lado 0) y `x = width` (lado 1), centradas en `y = height/2`. Un equipo que **ataca hacia +x** tiene su propia portería en el lado 0 y chuta hacia el lado 1.

Números de `PITCH` (proporción de un campo real de 105 × 68 m a ~19 u/m; todos ajustables en QA):

| Constante | Valor | Origen |
|---|---|---|
| `width` × `height` | 2 000 × 1 300 | spec |
| `goalWidth` | 150 | 7,32 m |
| `crossbarHeight` | 50 | 2,44 m |
| `bigAreaDepth` × `bigAreaWidth` | 320 × 770 | 16,5 × 40,3 m |
| `smallAreaDepth` × `smallAreaWidth` | 105 × 350 | 5,5 × 18,3 m |
| `penaltySpotDist` | 210 | 11 m |
| `centerCircleRadius` | 175 | 9,15 m |

`checkPitch` (mensajes exactos, uno por rama):
1. `width > height > 0` → `bad size`
2. `goalWidth < smallAreaWidth < bigAreaWidth <= height` → `goal wider than small area` / `small area wider than big area` / `big area wider than pitch`
3. `0 < smallAreaDepth < bigAreaDepth < width / 2` → `small area deeper than big area` / `big area past halfway`
4. `smallAreaDepth < penaltySpotDist < bigAreaDepth` → `penalty spot outside big area` / `penalty spot inside small area`
5. `crossbarHeight > 0` → `bad crossbar`
6. `centerCircleRadius < height / 2` y `> 0` → `bad center circle`

`checkFormation`:
1. `slots.length === OUTFIELD` → `slot count N`
2. ningún slot con `role === 'gk'` (el tipo lo impide, pero el dato viene de una tabla) → `goalkeeper in formation`
3. cada `x`, `y` estrictamente dentro de `(0, 1)` → `slot i out of pitch`
4. cada `x` sigue dentro de `(0, 1)` tras sumar `+STRATEGY_SHIFT` y `-STRATEGY_SHIFT` (criterio 3 + "la estrategia desplaza ±12 %") → `slot i leaves pitch under strategy`
5. dos slots no comparten posición exacta → `duplicate slot position`
6. el `id` es `${def}-${mid}-${fwd}` con los recuentos reales de `slotCounts` → `id does not match slots`

`checkFormations`: `length === FORMATION_COUNT` → `formation count N`; ids únicos → `duplicate formation id x`; cada una pasa `checkFormation` prefijando el id.

`checkTeam`: `id` en kebab-case `^[a-z][a-z0-9-]*$` → `bad id`; `name` no vacío y en mayúsculas → `bad name`; `kit.primary` y `kit.secondary` en `#rrggbb` → `bad kit color`; `primary !== secondary` → `kit colors equal`.

`checkTeams`: ids únicos → `duplicate id x`; equipaciones únicas por par `primary|secondary` → `duplicate kit x`; cada una pasa `checkTeam` prefijando el id. `checkBank` = `checkTeams` + `length === BANK_SIZE` → `bank size N`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// components/games/football-logic/rng.test.ts
import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

function take(seed: number, n: number): number[] {
  const rng = createRng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rng());
  return out;
}

describe('createRng', () => {
  it('same seed yields the same sequence', () => {
    expect(take(12345, 50)).toEqual(take(12345, 50));
  });
  it('different seeds yield different sequences (not just a shifted copy)', () => {
    const a = take(12345, 50);
    const b = take(12346, 50);
    expect(a).not.toEqual(b);
    expect(a.slice(1)).not.toEqual(b.slice(0, 49));
  });
  it('stays inside [0, 1) over a long run', () => {
    const rng = createRng(7);
    for (let i = 0; i < 100_000; i++) {
      const v = rng();
      expect(v >= 0 && v < 1).toBe(true);
    }
  });
  it('is not stuck: 1000 draws use both halves of the range', () => {
    const values = take(99, 1000);
    expect(values.some((v) => v < 0.5)).toBe(true);
    expect(values.some((v) => v >= 0.5)).toBe(true);
  });
  it('seed 0 is a valid seed and differs from seed 1', () => {
    expect(take(0, 10)).not.toEqual(take(1, 10));
  });
});
```

```ts
// components/games/football-logic/pitch.test.ts
import { describe, expect, it } from 'vitest';
import {
  PITCH, centerX, centerY, clampToBigArea, goalLineX, isBetweenPosts,
  isInsideBigArea, isInsideSmallArea, penaltySpotX,
} from './pitch';
import { checkPitch } from './invariants';

describe('PITCH', () => {
  it('passes checkPitch', () => {
    expect(checkPitch(PITCH)).toEqual([]);
  });
  it('is 2000 x 1300 as the spec says', () => {
    expect([PITCH.width, PITCH.height]).toEqual([2000, 1300]);
  });
});

describe('pitch queries', () => {
  it('goal lines sit on both ends', () => {
    expect(goalLineX(PITCH, 0)).toBe(0);
    expect(goalLineX(PITCH, 1)).toBe(PITCH.width);
  });
  it('penalty spots are penaltySpotDist away from their goal line', () => {
    expect(penaltySpotX(PITCH, 0)).toBe(PITCH.penaltySpotDist);
    expect(penaltySpotX(PITCH, 1)).toBe(PITCH.width - PITCH.penaltySpotDist);
  });
  it('between posts is symmetric around centerY and excludes the posts', () => {
    const half = PITCH.goalWidth / 2;
    expect(isBetweenPosts(PITCH, centerY(PITCH))).toBe(true);
    expect(isBetweenPosts(PITCH, centerY(PITCH) + half - 1)).toBe(true);
    expect(isBetweenPosts(PITCH, centerY(PITCH) - half - 1)).toBe(false);
    expect(isBetweenPosts(PITCH, centerY(PITCH) + half)).toBe(false);
  });
  it('big and small areas are anchored to their own side', () => {
    // 17 and 88 are arbitrary offsets: no boundary numbers on purpose.
    expect(isInsideBigArea(PITCH, 0, PITCH.bigAreaDepth - 17, centerY(PITCH) + 88)).toBe(true);
    expect(isInsideBigArea(PITCH, 1, PITCH.bigAreaDepth - 17, centerY(PITCH) + 88)).toBe(false);
    expect(isInsideBigArea(PITCH, 1, PITCH.width - PITCH.bigAreaDepth + 17, centerY(PITCH) - 88)).toBe(true);
    expect(isInsideSmallArea(PITCH, 0, PITCH.smallAreaDepth - 17, centerY(PITCH))).toBe(true);
    expect(isInsideSmallArea(PITCH, 0, PITCH.smallAreaDepth + 17, centerY(PITCH))).toBe(false);
    expect(isInsideSmallArea(PITCH, 0, 5, centerY(PITCH) + PITCH.smallAreaWidth / 2 + 17)).toBe(false);
  });
  it('centerX/centerY are the middle of the pitch', () => {
    expect(centerX(PITCH)).toBe(1000);
    expect(centerY(PITCH)).toBe(650);
  });
  it('clampToBigArea pulls a point back inside its own side box on both axes', () => {
    const p = { x: PITCH.bigAreaDepth + 133, y: -40 };
    clampToBigArea(PITCH, 0, p);
    expect(p.x).toBe(PITCH.bigAreaDepth);
    expect(p.y).toBe(centerY(PITCH) - PITCH.bigAreaWidth / 2);
    const q = { x: 300, y: 700 };
    clampToBigArea(PITCH, 1, q);
    expect(q.x).toBe(PITCH.width - PITCH.bigAreaDepth);
    expect(q.y).toBe(700);
  });
});
```

```ts
// components/games/football-logic/teams.test.ts
import { describe, expect, it } from 'vitest';
import { FORMATIONS, OUTFIELD, STRATEGIES, STRATEGY_SHIFT, TEAMS, TEAM_SIZE, slotCounts, teamById } from './teams';
import { checkFormation, checkTeam, checkTeams } from './invariants';

describe('published content (2 teams, 1 formation — the rest arrives in step 7)', () => {
  it('every published team passes checkTeam and the pair is unique', () => {
    for (const t of TEAMS) expect({ id: t.id, problems: checkTeam(t) }).toEqual({ id: t.id, problems: [] });
    expect(checkTeams(TEAMS)).toEqual([]);
  });
  it('every published formation passes checkFormation', () => {
    for (const f of FORMATIONS) expect({ id: f.id, problems: checkFormation(f) }).toEqual({ id: f.id, problems: [] });
  });
  it('3-3-2 is published with 3 defenders, 3 midfielders and 2 forwards', () => {
    const f = FORMATIONS.find((x) => x.id === '3-3-2');
    expect(f && slotCounts(f)).toEqual([3, 3, 2]);
  });
  it('team size is nine: eight outfield plus the goalkeeper', () => {
    expect(TEAM_SIZE).toBe(OUTFIELD + 1);
    expect(OUTFIELD).toBe(8);
  });
  it('strategies shift by ±STRATEGY_SHIFT and neutral by nothing', () => {
    expect(STRATEGIES.attack).toBe(STRATEGY_SHIFT);
    expect(STRATEGIES.defend).toBe(-STRATEGY_SHIFT);
    expect(STRATEGIES.neutral).toBe(0);
  });
  it('finds a team by id and nothing by a made-up id', () => {
    expect(teamById(TEAMS, 'espana')?.name).toBe('ESPAÑA');
    expect(teamById(TEAMS, 'atlantis')).toBeUndefined();
  });
});
```

```ts
// components/games/football-logic/invariants.test.ts
import { describe, expect, it } from 'vitest';
import { checkBank, checkFormation, checkFormations, checkPitch, checkTeam, checkTeams } from './invariants';
import { PITCH, type PitchDef } from './pitch';
import { BANK_SIZE, FORMATION_COUNT, OUTFIELD, type Formation, type FormationSlot, type TeamDef } from './teams';

function pitch(over: Partial<PitchDef> = {}): PitchDef {
  return { ...PITCH, ...over };
}

// A legal 8-slot formation built by hand — NOT the published one — so the
// negative tests mutate a fixture and never the content.
function legalFormation(over: Partial<Formation> = {}): Formation {
  const slots: FormationSlot[] = [
    { role: 'def', x: 0.2, y: 0.25 }, { role: 'def', x: 0.2, y: 0.5 }, { role: 'def', x: 0.2, y: 0.75 },
    { role: 'mid', x: 0.45, y: 0.25 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.75 },
    { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
  ];
  return { id: '3-3-2', name: 'NORMAL', slots, ...over };
}

function team(over: Partial<TeamDef> = {}): TeamDef {
  return { id: 'espana', name: 'ESPAÑA', kit: { primary: '#d40000', secondary: '#ffcc00' }, ...over };
}

function legalBank(): TeamDef[] {
  const list: TeamDef[] = [];
  for (let i = 0; i < BANK_SIZE; i++) {
    const hex = (i * 16).toString(16).padStart(2, '0');
    list.push(team({ id: `team-${i}`, name: `EQUIPO ${i}`, kit: { primary: `#${hex}00ff`, secondary: `#ff${hex}00` } }));
  }
  return list;
}

describe('checkPitch accepts the published pitch and rejects incoherent geometry', () => {
  it('accepts PITCH', () => expect(checkPitch(PITCH)).toEqual([]));
  it('rejects a pitch taller than wide', () => {
    expect(checkPitch(pitch({ width: 1000, height: 1300 })).join(' ')).toContain('bad size');
  });
  it('rejects a goal wider than the small area', () => {
    expect(checkPitch(pitch({ goalWidth: 360 })).join(' ')).toContain('goal wider than small area');
  });
  it('rejects a small area wider than the big area', () => {
    expect(checkPitch(pitch({ smallAreaWidth: 800 })).join(' ')).toContain('small area wider than big area');
  });
  it('rejects a big area wider than the pitch', () => {
    expect(checkPitch(pitch({ bigAreaWidth: 1400 })).join(' ')).toContain('big area wider than pitch');
  });
  it('rejects a small area deeper than the big area', () => {
    expect(checkPitch(pitch({ smallAreaDepth: 330 })).join(' ')).toContain('small area deeper than big area');
  });
  it('rejects a big area past the halfway line', () => {
    expect(checkPitch(pitch({ bigAreaDepth: 1010, penaltySpotDist: 500 })).join(' ')).toContain('big area past halfway');
  });
  it('rejects a penalty spot outside the big area', () => {
    expect(checkPitch(pitch({ penaltySpotDist: 340 })).join(' ')).toContain('penalty spot outside big area');
  });
  it('rejects a penalty spot inside the small area', () => {
    expect(checkPitch(pitch({ penaltySpotDist: 90 })).join(' ')).toContain('penalty spot inside small area');
  });
  it('rejects a zero crossbar', () => {
    expect(checkPitch(pitch({ crossbarHeight: 0 })).join(' ')).toContain('bad crossbar');
  });
  it('rejects a center circle that crosses the touch lines', () => {
    expect(checkPitch(pitch({ centerCircleRadius: 700 })).join(' ')).toContain('bad center circle');
  });
});

describe('checkFormation', () => {
  it('accepts the legal fixture', () => expect(checkFormation(legalFormation())).toEqual([]));
  it('rejects seven slots', () => {
    const f = legalFormation();
    expect(checkFormation({ ...f, id: '3-3-1', slots: f.slots.slice(0, OUTFIELD - 1) }).join(' ')).toContain('slot count 7');
  });
  it('rejects nine slots', () => {
    const f = legalFormation();
    expect(checkFormation({ ...f, id: '3-3-3', slots: [...f.slots, { role: 'fwd', x: 0.7, y: 0.5 }] }).join(' ')).toContain('slot count 9');
  });
  it('rejects a goalkeeper smuggled into the slots', () => {
    const f = legalFormation();
    const slots = [...f.slots];
    slots[0] = { role: 'gk' as never, x: 0.2, y: 0.25 };
    expect(checkFormation({ ...f, slots }).join(' ')).toContain('goalkeeper in formation');
  });
  it('rejects a slot outside the pitch', () => {
    const f = legalFormation();
    const slots = [...f.slots];
    slots[4] = { role: 'mid', x: 1.05, y: 0.5 };
    expect(checkFormation({ ...f, slots }).join(' ')).toContain('slot 4 out of pitch');
  });
  it('rejects a slot that leaves the pitch once the attack strategy shifts it', () => {
    const f = legalFormation();
    const slots = [...f.slots];
    slots[7] = { role: 'fwd', x: 0.93, y: 0.65 };   // 0.93 + 0.12 > 1
    expect(checkFormation({ ...f, slots }).join(' ')).toContain('slot 7 leaves pitch under strategy');
  });
  it('rejects a slot that leaves the pitch once the defend strategy shifts it', () => {
    const f = legalFormation();
    const slots = [...f.slots];
    slots[0] = { role: 'def', x: 0.08, y: 0.25 };   // 0.08 - 0.12 < 0
    expect(checkFormation({ ...f, slots }).join(' ')).toContain('slot 0 leaves pitch under strategy');
  });
  it('rejects two slots on the same point', () => {
    const f = legalFormation();
    const slots = [...f.slots];
    slots[3] = { ...slots[4] };
    expect(checkFormation({ ...f, slots }).join(' ')).toContain('duplicate slot position');
  });
  it('rejects an id that does not describe the slots', () => {
    expect(checkFormation(legalFormation({ id: '4-3-1' })).join(' ')).toContain('id does not match slots');
  });
});

describe('checkFormations', () => {
  function three(): Formation[] {
    const a = legalFormation();
    const b = legalFormation({ id: '3-2-3', slots: a.slots.map((s, i) => (i === 5 ? { ...s, role: 'fwd', x: 0.7, y: 0.5 } : s)) });
    const c = legalFormation({ id: '4-3-1', slots: a.slots.map((s, i) => (i === 7 ? { ...s, role: 'def', x: 0.2, y: 0.9 } : s)) });
    return [a, b, c];
  }
  it('accepts three distinct legal formations', () => expect(checkFormations(three())).toEqual([]));
  it('rejects two formations', () => {
    expect(checkFormations(three().slice(0, 2)).join(' ')).toContain('formation count 2');
  });
  it('rejects a duplicated id', () => {
    const fs = three();
    fs[2] = { ...fs[2], id: fs[0].id, slots: fs[0].slots };
    expect(checkFormations(fs).join(' ')).toContain('duplicate formation id 3-3-2');
  });
  it('propagates a per-formation problem with the offender id', () => {
    const fs = three();
    fs[1] = { ...fs[1], slots: fs[1].slots.slice(0, 6) };
    expect(checkFormations(fs).join(' ')).toContain('3-2-3: slot count 6');
  });
  it('FORMATION_COUNT is the three of the spec', () => expect(FORMATION_COUNT).toBe(3));
});

describe('checkTeam', () => {
  it('accepts a legal team', () => expect(checkTeam(team())).toEqual([]));
  it('rejects an id that is not kebab-case', () => {
    expect(checkTeam(team({ id: 'Espana' })).join(' ')).toContain('bad id');
  });
  it('rejects a lowercase or empty name', () => {
    expect(checkTeam(team({ name: 'España' })).join(' ')).toContain('bad name');
    expect(checkTeam(team({ name: '' })).join(' ')).toContain('bad name');
  });
  it('rejects a kit color that is not #rrggbb', () => {
    expect(checkTeam(team({ kit: { primary: 'red', secondary: '#ffcc00' } })).join(' ')).toContain('bad kit color');
    expect(checkTeam(team({ kit: { primary: '#d40000', secondary: '#fc0' } })).join(' ')).toContain('bad kit color');
  });
  it('rejects a kit whose two colors are equal', () => {
    expect(checkTeam(team({ kit: { primary: '#d40000', secondary: '#d40000' } })).join(' ')).toContain('kit colors equal');
  });
});

describe('checkTeams / checkBank', () => {
  it('accepts a legal bank', () => {
    expect(checkTeams(legalBank())).toEqual([]);
    expect(checkBank(legalBank())).toEqual([]);
  });
  it('rejects a duplicated id', () => {
    const bank = legalBank();
    bank[5] = { ...bank[5], id: bank[2].id };
    expect(checkTeams(bank).join(' ')).toContain('duplicate id team-2');
  });
  it('rejects two teams wearing the same kit', () => {
    const bank = legalBank();
    bank[9] = { ...bank[9], kit: { ...bank[3].kit } };
    expect(checkTeams(bank).join(' ')).toContain('duplicate kit team-9');
  });
  it('propagates a per-team problem with the offender id', () => {
    const bank = legalBank();
    bank[4] = { ...bank[4], name: 'minusculas' };
    expect(checkTeams(bank).join(' ')).toContain('team-4: bad name');
  });
  it('checkBank rejects fifteen teams while checkTeams does not count', () => {
    const bank = legalBank().slice(0, BANK_SIZE - 1);
    expect(checkTeams(bank)).toEqual([]);
    expect(checkBank(bank).join(' ')).toContain('bank size 15');
  });
});
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `npx vitest run components/games/football-logic/`
Expected: FAIL — no existen `rng.ts`, `pitch.ts`, `teams.ts` ni `invariants.ts`.

- [ ] **Step 3: Implementación mínima**

```ts
// components/games/football-logic/rng.ts
export type Rng = () => number;

// mulberry32: 32-bit integer arithmetic only, so every JS engine produces the
// same sequence for the same seed. The ONLY source of randomness in the engine.
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

```ts
// components/games/football-logic/pitch.ts
export type Side = 0 | 1;

export type PitchDef = {
  width: number;
  height: number;
  goalWidth: number;
  crossbarHeight: number;
  bigAreaDepth: number;
  bigAreaWidth: number;
  smallAreaDepth: number;
  smallAreaWidth: number;
  penaltySpotDist: number;
  centerCircleRadius: number;
};

// World units: a real 105 x 68 m pitch at ~19 u/m. The 800 x 500 camera sees 40%.
export const PITCH: PitchDef = {
  width: 2000,
  height: 1300,
  goalWidth: 150,
  crossbarHeight: 50,
  bigAreaDepth: 320,
  bigAreaWidth: 770,
  smallAreaDepth: 105,
  smallAreaWidth: 350,
  penaltySpotDist: 210,
  centerCircleRadius: 175,
};

export function centerX(pitch: PitchDef): number {
  return pitch.width / 2;
}

export function centerY(pitch: PitchDef): number {
  return pitch.height / 2;
}

export function goalLineX(pitch: PitchDef, side: Side): number {
  return side === 0 ? 0 : pitch.width;
}

export function penaltySpotX(pitch: PitchDef, side: Side): number {
  return side === 0 ? pitch.penaltySpotDist : pitch.width - pitch.penaltySpotDist;
}

export function isBetweenPosts(pitch: PitchDef, y: number): boolean {
  const half = pitch.goalWidth / 2;
  const cy = centerY(pitch);
  return y > cy - half && y < cy + half;
}

function isInsideBox(pitch: PitchDef, side: Side, depth: number, width: number, x: number, y: number): boolean {
  const half = width / 2;
  const cy = centerY(pitch);
  if (y < cy - half || y > cy + half) return false;
  return side === 0 ? x >= 0 && x <= depth : x >= pitch.width - depth && x <= pitch.width;
}

export function isInsideBigArea(pitch: PitchDef, side: Side, x: number, y: number): boolean {
  return isInsideBox(pitch, side, pitch.bigAreaDepth, pitch.bigAreaWidth, x, y);
}

export function isInsideSmallArea(pitch: PitchDef, side: Side, x: number, y: number): boolean {
  return isInsideBox(pitch, side, pitch.smallAreaDepth, pitch.smallAreaWidth, x, y);
}

// Writes into `p` (goalkeeper invariant 9b: never outside the big area).
export function clampToBigArea(pitch: PitchDef, side: Side, p: { x: number; y: number }): void {
  const half = pitch.bigAreaWidth / 2;
  const cy = centerY(pitch);
  const minX = side === 0 ? 0 : pitch.width - pitch.bigAreaDepth;
  const maxX = side === 0 ? pitch.bigAreaDepth : pitch.width;
  if (p.x < minX) p.x = minX;
  if (p.x > maxX) p.x = maxX;
  if (p.y < cy - half) p.y = cy - half;
  if (p.y > cy + half) p.y = cy + half;
}
```

```ts
// components/games/football-logic/teams.ts
export type Role = 'gk' | 'def' | 'mid' | 'fwd';
export type OutfieldRole = Exclude<Role, 'gk'>;
export type Strategy = 'attack' | 'neutral' | 'defend';

export type Kit = { primary: string; secondary: string };
export type TeamDef = { id: string; name: string; kit: Kit };

// Fractions of the pitch for the team attacking towards +x; the engine mirrors x for the other side.
export type FormationSlot = { role: OutfieldRole; x: number; y: number };
export type Formation = { id: string; name: string; slots: readonly FormationSlot[] };

export const TEAM_SIZE = 9;
export const OUTFIELD = 8;
export const BANK_SIZE = 16;
export const FORMATION_COUNT = 3;

// The strategy shifts every slot this fraction of the pitch towards the rival goal (attack) or away (defend).
export const STRATEGY_SHIFT = 0.12;
export const STRATEGIES: Readonly<Record<Strategy, number>> = {
  attack: STRATEGY_SHIFT,
  neutral: 0,
  defend: -STRATEGY_SHIFT,
};

// Task 1 publishes only 3-3-2; 3-2-3 and 4-3-1 arrive in step 7 (stage B) with the net already green.
export const FORMATIONS: readonly Formation[] = [
  {
    id: '3-3-2',
    name: 'NORMAL',
    slots: [
      { role: 'def', x: 0.22, y: 0.25 }, { role: 'def', x: 0.22, y: 0.5 }, { role: 'def', x: 0.22, y: 0.75 },
      { role: 'mid', x: 0.45, y: 0.25 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.75 },
      { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
    ],
  },
];

// Task 1 publishes two; the bank of sixteen arrives in step 7.
export const TEAMS: readonly TeamDef[] = [
  { id: 'espana', name: 'ESPAÑA', kit: { primary: '#d40000', secondary: '#ffcc00' } },
  { id: 'italia', name: 'ITALIA', kit: { primary: '#0044aa', secondary: '#ffffff' } },
];

export function teamById(teams: readonly TeamDef[], id: string): TeamDef | undefined {
  return teams.find((t) => t.id === id);
}

export function slotCounts(f: Formation): [number, number, number] {
  let def = 0;
  let mid = 0;
  let fwd = 0;
  for (const s of f.slots) {
    if (s.role === 'def') def++;
    else if (s.role === 'mid') mid++;
    else if (s.role === 'fwd') fwd++;
  }
  return [def, mid, fwd];
}
```

```ts
// components/games/football-logic/invariants.ts
import type { PitchDef } from './pitch';
import { BANK_SIZE, FORMATION_COUNT, OUTFIELD, STRATEGY_SHIFT, slotCounts, type Formation, type TeamDef } from './teams';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const KEBAB_ID = /^[a-z][a-z0-9-]*$/;

export function checkPitch(pitch: PitchDef): string[] {
  const problems: string[] = [];
  if (!(pitch.width > pitch.height && pitch.height > 0)) problems.push('bad size');
  if (pitch.goalWidth >= pitch.smallAreaWidth) problems.push('goal wider than small area');
  if (pitch.smallAreaWidth >= pitch.bigAreaWidth) problems.push('small area wider than big area');
  if (pitch.bigAreaWidth > pitch.height) problems.push('big area wider than pitch');
  if (!(pitch.smallAreaDepth > 0 && pitch.smallAreaDepth < pitch.bigAreaDepth)) problems.push('small area deeper than big area');
  if (pitch.bigAreaDepth >= pitch.width / 2) problems.push('big area past halfway');
  if (pitch.penaltySpotDist >= pitch.bigAreaDepth) problems.push('penalty spot outside big area');
  if (pitch.penaltySpotDist <= pitch.smallAreaDepth) problems.push('penalty spot inside small area');
  if (!(pitch.crossbarHeight > 0)) problems.push('bad crossbar');
  if (!(pitch.centerCircleRadius > 0 && pitch.centerCircleRadius < pitch.height / 2)) problems.push('bad center circle');
  return problems;
}

function insideUnit(v: number): boolean {
  return v > 0 && v < 1;
}

export function checkFormation(f: Formation): string[] {
  const problems: string[] = [];
  if (f.slots.length !== OUTFIELD) problems.push(`slot count ${f.slots.length}`);
  f.slots.forEach((s, i) => {
    if ((s.role as string) === 'gk') problems.push('goalkeeper in formation');
    if (!insideUnit(s.x) || !insideUnit(s.y)) problems.push(`slot ${i} out of pitch`);
    else if (!insideUnit(s.x + STRATEGY_SHIFT) || !insideUnit(s.x - STRATEGY_SHIFT)) {
      problems.push(`slot ${i} leaves pitch under strategy`);
    }
  });
  for (let i = 0; i < f.slots.length; i++) {
    for (let j = i + 1; j < f.slots.length; j++) {
      if (f.slots[i].x === f.slots[j].x && f.slots[i].y === f.slots[j].y) problems.push('duplicate slot position');
    }
  }
  const [def, mid, fwd] = slotCounts(f);
  if (f.id !== `${def}-${mid}-${fwd}`) problems.push('id does not match slots');
  return problems;
}

export function checkFormations(formations: readonly Formation[]): string[] {
  const problems: string[] = [];
  if (formations.length !== FORMATION_COUNT) problems.push(`formation count ${formations.length}`);
  const seen = new Set<string>();
  for (const f of formations) {
    if (seen.has(f.id)) problems.push(`duplicate formation id ${f.id}`);
    seen.add(f.id);
  }
  for (const f of formations) {
    for (const p of checkFormation(f)) problems.push(`${f.id}: ${p}`);
  }
  return problems;
}

export function checkTeam(def: TeamDef): string[] {
  const problems: string[] = [];
  if (!KEBAB_ID.test(def.id)) problems.push('bad id');
  if (!def.name || def.name !== def.name.toUpperCase()) problems.push('bad name');
  if (!HEX_COLOR.test(def.kit.primary) || !HEX_COLOR.test(def.kit.secondary)) problems.push('bad kit color');
  if (def.kit.primary === def.kit.secondary) problems.push('kit colors equal');
  return problems;
}

export function checkTeams(teams: readonly TeamDef[]): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  for (const t of teams) {
    if (seenIds.has(t.id)) problems.push(`duplicate id ${t.id}`);
    seenIds.add(t.id);
  }
  const seenKits = new Set<string>();
  for (const t of teams) {
    const key = `${t.kit.primary}|${t.kit.secondary}`;
    if (seenKits.has(key)) problems.push(`duplicate kit ${t.id}`);
    seenKits.add(key);
  }
  for (const t of teams) {
    for (const p of checkTeam(t)) problems.push(`${t.id}: ${p}`);
  }
  return problems;
}

export function checkBank(teams: readonly TeamDef[]): string[] {
  const problems = checkTeams(teams);
  if (teams.length !== BANK_SIZE) problems.push(`bank size ${teams.length}`);
  return problems;
}
```

> Los `Set` de `checkTeams`/`checkFormations` solo detectan duplicados; **nunca deciden un orden**. Es el único uso de `Set` permitido en `football-logic/`.

> `teams.test.ts` **no** llama a `checkBank(TEAMS)` ni a `checkFormations(FORMATIONS)`: con 2 selecciones y 1 formación fallarían por `bank size 2` y `formation count 1`. Esas dos líneas las añade el paso 7 (etapa B), y son las que cierran la red sobre el contenido real.

- [ ] **Step 4: Verde**

Run: `npx vitest run` → 504 + los nuevos (unos 55). Después `npx tsc --noEmit` limpio y `grep -rn "Math.random\|Date.now\|Math.sin\|Math.cos\|Math.atan2\|Math.hypot" components/games/football-logic/` vacío.

- [ ] **Step 5: Verificar y proponer commit**

Exportaciones sin consumidor fuera de su test en esta tarea (todas con destino declarado): `Rng`/`createRng` → Tasks 3, 4, 5; `Side`, `goalLineX`, `penaltySpotX`, `isBetweenPosts`, `isInsideBigArea`, `isInsideSmallArea`, `clampToBigArea` → Tasks 2, 4; `Role`, `Strategy`, `STRATEGIES`, `Formation`, `TeamDef` → Task 2; `BANK_SIZE`, `FORMATION_COUNT`, `checkBank`, `checkFormations` → paso 7.

Mensaje propuesto: `feat(world-cup): seeded rng, pitch, teams and the invariant net before the content`

---

## Task 2: `input.ts`, `step.ts`, `players.ts` y `ball.ts` — el determinismo

**Files:**
- Create: `components/games/football-logic/clock.ts`
- Create: `components/games/football-logic/geometry.ts`
- Create: `components/games/football-logic/input.ts`
- Create: `components/games/football-logic/step.ts`
- Create: `components/games/football-logic/players.ts`
- Create: `components/games/football-logic/ball.ts`
- Modify: `components/games/football-logic/invariants.ts` (añade `checkGoalkeepersInBox`)
- Test: `components/games/football-logic/geometry.test.ts`
- Test: `components/games/football-logic/input.test.ts`
- Test: `components/games/football-logic/players.test.ts`
- Test: `components/games/football-logic/ball.test.ts`
- Test: `components/games/football-logic/step.test.ts` (**el test que manda**)
- Test: `components/games/football-logic/invariants.test.ts` (añade el negativo de `checkGoalkeepersInBox`)

**Interfaces:**
- Consumes (Task 1): `PitchDef`, `Side`, `centerY`, `goalLineX`, `clampToBigArea` de `pitch.ts`; `Role`, `Strategy`, `STRATEGIES`, `Formation`, `FormationSlot`, `OUTFIELD` de `teams.ts`.
- Produces:

```ts
// geometry.ts
export type Vec2 = { x: number; y: number };
export const INV_SQRT2: number;                                  // 1 / Math.sqrt(2)
export function dist(ax: number, ay: number, bx: number, by: number): number;
export function normalizeInto(out: Vec2, x: number, y: number): boolean;   // false y `out` intacto si (0,0)
export function clamp(v: number, min: number, max: number): number;

// input.ts
export type ButtonState = 'up' | 'pressed' | 'held' | 'released';
export type Axis = -1 | 0 | 1;
export type { Strategy } from './teams';
export type TeamInput = { dx: Axis; dy: Axis; a: ButtonState; b: ButtonState; c: ButtonState; formation: number; strategy: Strategy };
export function createTeamInput(): TeamInput;                    // neutra: 0/0, up/up/up, formation 0, 'neutral'
export function copyTeamInput(from: TeamInput, to: TeamInput): void;
export function isDown(b: ButtonState): boolean;                 // pressed | held
export function checkTeamInput(input: TeamInput, formationCount: number): string[];   // consumido por Task 6 (la IA nunca produce una entrada inválida)

// clock.ts (sin imports) — step.ts lo re-exporta; el resto del motor importa SIEMPRE de step.ts
export const STEPS_PER_SECOND = 60;
export const STEP_MS: number;                                    // 1000 / 60
export function stepsFor(seconds: number): number;               // Math.round(seconds * 60)
export function perStep(unitsPerSecond: number): number;         // unitsPerSecond / 60

// step.ts
export { STEPS_PER_SECOND, STEP_MS, stepsFor, perStep } from './clock';
export type AttackDirs = readonly [1 | -1, 1 | -1];              // hacia dónde ataca cada equipo
export function stepPhysics(
  players: PlayerState[], ball: BallState,
  inputs: readonly [TeamInput, TeamInput], controlled: readonly [number, number],
  attackDir: AttackDirs, pitch: PitchDef, stepCount: number,
): void;   // la Task 5 lo envuelve en stepMatch; aquí los no controlados solo tickean sus contadores

// players.ts
export type PlayerState = {
  id: number; team: 0 | 1; role: Role; slot: number;             // slot: índice en la formación, -1 el portero
  x: number; y: number; vx: number; vy: number;                  // v en u/s
  facingX: number; facingY: number;                              // vector unitario (nunca un ángulo)
  sprintStepsLeft: number; sprintCooldownSteps: number;          // la ráfaga y su recuperación, en pasos
  downUntilStep: number;                                         // en el suelo mientras stepCount < downUntilStep
  chargeSteps: number; chargeButton: 'none' | 'a' | 'b';         // carga de chut / mantenido de pase (los escribe Task 3)
  tackleStepsLeft: number; tackleDirX: number; tackleDirY: number;   // entrada al suelo en curso (la arranca Task 3)
};
export const PLAYER_SPEED = 180;
export const PLAYER_SPEED_WITH_BALL = 160;
export const SPRINT_MULT = 1.4;
export const SPRINT_SECONDS = 2;
export const SPRINT_COOLDOWN_SECONDS = 3;
export const SPRINT_STEPS: number;                               // stepsFor(2) = 120
export const SPRINT_COOLDOWN_STEPS: number;                      // stepsFor(3) = 180
export const PLAYER_RADIUS = 12;
export const PLAYER_HEIGHT = 35;                                 // un balón por encima no se puede recoger
export const GK_LINE_DIST = 25;                                  // línea del portero (la IA de Task 6 la usa)
export const TACKLE_DIST = 90;
export const TACKLE_SECONDS = 0.4;
export const TACKLE_STEPS: number;                               // stepsFor(0.4) = 24
export const TACKLE_SPEED: number;                               // TACKLE_DIST / TACKLE_SECONDS = 225 u/s
export function ownGoalSide(attackDir: 1 | -1): Side;            // ataca a +x ⇒ su portería es el lado 0
export function anchorFor(slot: FormationSlot, strategy: Strategy, attackDir: 1 | -1, pitch: PitchDef, out: Vec2): void;
export function createPlayers(formations: readonly [Formation, Formation], pitch: PitchDef): PlayerState[];   // 18, players[i].id === i
export function placeByFormation(players: PlayerState[], team: 0 | 1, formation: Formation, strategy: Strategy, attackDir: 1 | -1, pitch: PitchDef): void;
export function isPlayerDown(p: PlayerState, stepCount: number): boolean;
export function isSprinting(p: PlayerState): boolean;
export function stepPlayer(p: PlayerState, dx: Axis, dy: Axis, wantSprint: boolean, hasBall: boolean, attackDir: 1 | -1, pitch: PitchDef, stepCount: number): void;

// ball.ts
export type BallState = {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  owner: number | null; ownerSinceStep: number;
  lastTouchTeam: 0 | 1 | null; lastTouchId: number | null;       // para córner / saque de puerta (Task 4)
  kickerId: number | null; kickLockUntilStep: number;            // el pateador no recoge su propio pase durante KICK_LOCK_STEPS
};
export const GRAVITY = 900;                                      // u/s²
export const BALL_GROUND_DECEL = 260;                            // u/s² rodando
export const BALL_BOUNCE = 0.5;
export const BALL_REST_VZ = 30;                                  // por debajo, el bote se apaga
export const CONTROL_DIST = 18;                                  // delante del pie del poseedor
export const POSSESSION_RADIUS = 22;
export const KICK_LOCK_SECONDS = 0.25;
export const KICK_LOCK_STEPS: number;                            // 15
export const LONG_PASS_VZ = 280;                                 // con GRAVITY 900 y 560 u/s cae a ~348 u
export function createBall(): BallState;
export function givePossession(ball: BallState, p: PlayerState, stepCount: number): void;
export function stickToOwner(ball: BallState, owner: PlayerState): void;
export function kickBall(ball: BallState, kicker: PlayerState, dirX: number, dirY: number, speed: number, vz: number, stepCount: number): void;
export function canPickUp(ball: BallState, p: PlayerState, stepCount: number): boolean;
export function stepBall(ball: BallState, players: readonly PlayerState[], stepCount: number): void;

// invariants.ts (añadido)
export function checkGoalkeepersInBox(players: readonly PlayerState[], attackDir: AttackDirs, pitch: PitchDef): string[];
```

Reglas fijadas aquí (las respetan las Tasks 3-5):
- **`players[i].id === i` siempre** (18 creados una vez, ids 0-17). Equipo 0: id 0 portero, ids 1-8 los slots 0-7. Equipo 1: id 9 portero, ids 10-17. Así `players[ball.owner]` es O(1) y ningún bucle necesita buscar por id.
- El **equipo 0 ataca hacia +x** en la primera parte (`attackDir = [1, -1]`); la Task 5 lo invierte en la segunda.
- El portero se coloca en `goalLineX(own) + attackDir · GK_LINE_DIST`, `centerY`. Los slots se espejan en x para `attackDir = -1`: `x = (1 - fx - shift) · width`.
- Un jugador **en el suelo** (`stepCount < downUntilStep`) o **en entrada** (`tackleStepsLeft > 0`) ignora la cruceta; el que está en entrada avanza a `TACKLE_SPEED` en `tackleDir`. La Task 2 solo mueve; la Task 3 (`stepTackle`) es la **única** que descuenta `tackleStepsLeft` y decide el desenlace.
- **Sprint en ráfaga**: con C pulsado y sin recuperación pendiente arranca una ráfaga de `SPRINT_STEPS`; soltar C o agotarla arranca `SPRINT_COOLDOWN_STEPS` de recuperación completa. Se cuenta en pasos, con y sin balón.
- **El balón pegado al pie**: `x = owner.x + facingX · CONTROL_DIST`, `z = 0`, velocidad cero. Al patear, el pateador queda bloqueado `KICK_LOCK_STEPS` para no recogerlo al instante.
- **Recogida por proximidad**: balón libre con `z <= PLAYER_HEIGHT`, jugador a `< POSSESSION_RADIUS`, no en el suelo, no en entrada, no bloqueado; el **más cercano** y, a igual distancia, el `id` más bajo (comparación estricta `<` recorriendo ids ascendentes). En esta tarea también el portero recoge así; la Task 6 le pondrá `catchChance` delante.
- **El balón puede salir del campo y quedarse**: nada lo rebota. Eso es del árbitro (Task 4).
- La física **no consume `rng`**: es puramente determinista por entradas. El azar entra solo por las acciones (Task 3) y el penalti (Task 4).

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// components/games/football-logic/geometry.test.ts
import { describe, expect, it } from 'vitest';
import { INV_SQRT2, clamp, dist, normalizeInto, type Vec2 } from './geometry';

describe('geometry', () => {
  it('dist is euclidean (3-4-5 scaled by 7)', () => {
    expect(dist(10, 20, 31, 48)).toBe(35);
  });
  it('normalizeInto writes a unit vector and returns true', () => {
    const out: Vec2 = { x: 0, y: 0 };
    expect(normalizeInto(out, 30, -40)).toBe(true);
    expect(out.x).toBeCloseTo(0.6, 10);
    expect(out.y).toBeCloseTo(-0.8, 10);
  });
  it('normalizeInto leaves out untouched and returns false for the zero vector', () => {
    const out: Vec2 = { x: 0.6, y: 0.8 };
    expect(normalizeInto(out, 0, 0)).toBe(false);
    expect(out).toEqual({ x: 0.6, y: 0.8 });
  });
  it('INV_SQRT2 is the diagonal factor', () => {
    expect(INV_SQRT2 * INV_SQRT2).toBeCloseTo(0.5, 12);
  });
  it('clamp holds both ends', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(7, 0, 10)).toBe(7);
  });
});
```

```ts
// components/games/football-logic/input.test.ts
import { describe, expect, it } from 'vitest';
import { checkTeamInput, copyTeamInput, createTeamInput, isDown } from './input';

describe('TeamInput', () => {
  it('createTeamInput is the neutral input', () => {
    expect(createTeamInput()).toEqual({ dx: 0, dy: 0, a: 'up', b: 'up', c: 'up', formation: 0, strategy: 'neutral' });
  });
  it('isDown is true for pressed and held only', () => {
    expect(isDown('pressed')).toBe(true);
    expect(isDown('held')).toBe(true);
    expect(isDown('released')).toBe(false);
    expect(isDown('up')).toBe(false);
  });
  it('copyTeamInput copies every field without aliasing', () => {
    const from = createTeamInput();
    from.dx = -1; from.dy = 1; from.a = 'held'; from.b = 'released'; from.c = 'pressed'; from.formation = 2; from.strategy = 'attack';
    const to = createTeamInput();
    copyTeamInput(from, to);
    expect(to).toEqual(from);
    expect(to).not.toBe(from);
  });
  it('checkTeamInput accepts the neutral input and a full one', () => {
    expect(checkTeamInput(createTeamInput(), 3)).toEqual([]);
    const full = createTeamInput();
    full.dx = 1; full.dy = -1; full.a = 'pressed'; full.formation = 2; full.strategy = 'defend';
    expect(checkTeamInput(full, 3)).toEqual([]);
  });
  it('checkTeamInput rejects each invalid field', () => {
    const bad = createTeamInput();
    bad.dx = 2 as never;
    expect(checkTeamInput(bad, 3).join(' ')).toContain('bad dx');
    const bady = createTeamInput();
    bady.dy = 0.5 as never;
    expect(checkTeamInput(bady, 3).join(' ')).toContain('bad dy');
    const badButton = createTeamInput();
    badButton.b = 'down' as never;
    expect(checkTeamInput(badButton, 3).join(' ')).toContain('bad button b');
    const badFormation = createTeamInput();
    badFormation.formation = 3;
    expect(checkTeamInput(badFormation, 3).join(' ')).toContain('formation 3 out of range');
    const badStrategy = createTeamInput();
    badStrategy.strategy = 'yolo' as never;
    expect(checkTeamInput(badStrategy, 3).join(' ')).toContain('bad strategy');
  });
});
```

```ts
// components/games/football-logic/players.test.ts
import { describe, expect, it } from 'vitest';
import { PITCH, centerY, isInsideBigArea } from './pitch';
import { FORMATIONS, OUTFIELD, TEAM_SIZE } from './teams';
import { STEPS_PER_SECOND } from './step';
import {
  GK_LINE_DIST, PLAYER_SPEED, PLAYER_SPEED_WITH_BALL, SPRINT_COOLDOWN_STEPS, SPRINT_MULT, SPRINT_STEPS,
  TACKLE_DIST, TACKLE_STEPS, anchorFor, createPlayers, isPlayerDown, isSprinting, ownGoalSide,
  placeByFormation, stepPlayer, type PlayerState,
} from './players';

const F = FORMATIONS[0];

function fresh(): PlayerState[] {
  return createPlayers([F, F], PITCH);
}

// Walks `p` for `steps` steps with the same input and returns the distance covered in x.
function walk(p: PlayerState, steps: number, dx: -1 | 0 | 1, sprint: boolean, hasBall: boolean, from = 0): number {
  const x0 = p.x;
  for (let s = from; s < from + steps; s++) stepPlayer(p, dx, 0, sprint, hasBall, 1, PITCH, s);
  return p.x - x0;
}

describe('createPlayers', () => {
  it('creates 18 players whose array index is their id', () => {
    const ps = fresh();
    expect(ps).toHaveLength(2 * TEAM_SIZE);
    ps.forEach((p, i) => expect(p.id).toBe(i));
  });
  it('gives each team one goalkeeper and OUTFIELD field players with formation roles', () => {
    const ps = fresh();
    for (const team of [0, 1] as const) {
      const mine = ps.filter((p) => p.team === team);
      expect(mine.filter((p) => p.role === 'gk')).toHaveLength(1);
      expect(mine.filter((p) => p.role !== 'gk')).toHaveLength(OUTFIELD);
      expect(mine.filter((p) => p.role === 'def')).toHaveLength(3);
      expect(mine.filter((p) => p.role === 'fwd')).toHaveLength(2);
    }
    expect(ps[0].role).toBe('gk');
    expect(ps[9].role).toBe('gk');
    expect(ps[0].slot).toBe(-1);
    expect(ps[1].slot).toBe(0);
    expect(ps[10].slot).toBe(0);
  });
  it('team 0 attacks +x from the left half and team 1 is its mirror', () => {
    const ps = fresh();
    expect(ps[0].x).toBe(GK_LINE_DIST);
    expect(ps[9].x).toBe(PITCH.width - GK_LINE_DIST);
    expect(ps[0].y).toBe(centerY(PITCH));
    for (let i = 1; i <= OUTFIELD; i++) {
      expect(ps[i].x).toBeLessThan(PITCH.width / 2);
      expect(ps[i + TEAM_SIZE].x).toBeCloseTo(PITCH.width - ps[i].x, 6);
      expect(ps[i + TEAM_SIZE].y).toBe(ps[i].y);
    }
    expect(ps[1].facingX).toBe(1);
    expect(ps[10].facingX).toBe(-1);
  });
});

describe('anchorFor / placeByFormation', () => {
  const slot = { role: 'mid' as const, x: 0.45, y: 0.25 };
  it('maps a fraction to world units for the team attacking +x', () => {
    const out = { x: 0, y: 0 };
    anchorFor(slot, 'neutral', 1, PITCH, out);
    expect(out).toEqual({ x: 900, y: 325 });
  });
  it('mirrors x for the team attacking -x', () => {
    const out = { x: 0, y: 0 };
    anchorFor(slot, 'neutral', -1, PITCH, out);
    expect(out).toEqual({ x: 1100, y: 325 });
  });
  it('attack pushes towards the rival goal and defend pulls back, on both sides', () => {
    const a = { x: 0, y: 0 };
    const d = { x: 0, y: 0 };
    anchorFor(slot, 'attack', 1, PITCH, a);
    anchorFor(slot, 'defend', 1, PITCH, d);
    expect(a.x).toBeCloseTo(900 + 0.12 * PITCH.width, 6);
    expect(d.x).toBeCloseTo(900 - 0.12 * PITCH.width, 6);
    anchorFor(slot, 'attack', -1, PITCH, a);
    expect(a.x).toBeCloseTo(1100 - 0.12 * PITCH.width, 6);
  });
  it('placeByFormation rewrites positions, zeroes velocity and leaves the other team alone', () => {
    const ps = fresh();
    ps[3].x = 1500; ps[3].vx = 99; ps[12].x = 77;
    placeByFormation(ps, 0, F, 'attack', 1, PITCH);
    expect(ps[3].vx).toBe(0);
    expect(ps[3].x).toBeCloseTo((F.slots[2].x + 0.12) * PITCH.width, 6);
    expect(ps[12].x).toBe(77);
  });
});

describe('stepPlayer movement', () => {
  it('runs at PLAYER_SPEED without the ball', () => {
    const p = fresh()[4];
    expect(walk(p, 60, 1, false, false)).toBeCloseTo(PLAYER_SPEED, 6);
  });
  it('runs at PLAYER_SPEED_WITH_BALL with the ball', () => {
    const p = fresh()[4];
    expect(walk(p, 60, 1, false, true)).toBeCloseTo(PLAYER_SPEED_WITH_BALL, 6);
  });
  it('diagonals are normalized: same speed, not sqrt(2) faster', () => {
    const p = fresh()[4];
    const x0 = p.x; const y0 = p.y;
    for (let s = 0; s < 60; s++) stepPlayer(p, 1, 1, false, false, 1, PITCH, s);
    const covered = Math.sqrt((p.x - x0) ** 2 + (p.y - y0) ** 2);
    expect(covered).toBeCloseTo(PLAYER_SPEED, 6);
  });
  it('faces the last non-zero direction and keeps it when idle', () => {
    const p = fresh()[4];
    stepPlayer(p, -1, 1, false, false, 1, PITCH, 0);
    expect(p.facingX).toBeCloseTo(-Math.SQRT1_2, 10);
    expect(p.facingY).toBeCloseTo(Math.SQRT1_2, 10);
    stepPlayer(p, 0, 0, false, false, 1, PITCH, 1);
    expect(p.facingX).toBeCloseTo(-Math.SQRT1_2, 10);
  });
  it('never leaves the pitch', () => {
    const p = fresh()[4];
    p.x = PITCH.width - 5;
    walk(p, 30, 1, true, false);
    expect(p.x).toBe(PITCH.width);
  });
  it('a goalkeeper is clamped to its own big area on both sides (criterion 9b)', () => {
    const ps = fresh();
    const gk0 = ps[0];
    walk(gk0, 400, 1, true, false);   // would run 1680 u; must stop at the box edge
    expect(gk0.x).toBe(PITCH.bigAreaDepth);
    expect(isInsideBigArea(PITCH, ownGoalSide(1), gk0.x, gk0.y)).toBe(true);
    const gk1 = ps[9];
    for (let s = 0; s < 400; s++) stepPlayer(gk1, -1, 0, true, false, -1, PITCH, s);
    expect(gk1.x).toBe(PITCH.width - PITCH.bigAreaDepth);
    for (let s = 0; s < 400; s++) stepPlayer(gk1, 0, -1, false, false, -1, PITCH, s);
    expect(gk1.y).toBe(centerY(PITCH) - PITCH.bigAreaWidth / 2);
  });
});

describe('sprint burst and recovery (measured in steps, off the boundaries)', () => {
  it('sprints at x1.4 for SPRINT_STEPS, then recovers for SPRINT_COOLDOWN_STEPS, then sprints again', () => {
    const p = fresh()[4];
    const perStepBase = PLAYER_SPEED / STEPS_PER_SECOND;
    // 100 steps deep into the burst: all sprinting
    expect(walk(p, 100, 1, true, false, 0)).toBeCloseTo(100 * perStepBase * SPRINT_MULT, 6);
    // 20 more finish the burst; 30 more are already cooling down at base speed
    expect(walk(p, 20, 1, true, false, 100)).toBeCloseTo(20 * perStepBase * SPRINT_MULT, 6);
    expect(isSprinting(p)).toBe(false);
    expect(walk(p, 30, 1, true, false, 120)).toBeCloseTo(30 * perStepBase, 6);
    // still cooling at step 250 (cooldown runs 120..299)
    walk(p, 100, 1, true, false, 150);
    expect(isSprinting(p)).toBe(false);
    expect(walk(p, 1, 1, true, false, 250)).toBeCloseTo(perStepBase, 6);
    // cooldown over at 300: 30 steps later it is sprinting again
    walk(p, 49, 1, true, false, 251);
    expect(walk(p, 30, 1, true, false, 300)).toBeCloseTo(30 * perStepBase * SPRINT_MULT, 6);
    expect(SPRINT_STEPS).toBe(120);
    expect(SPRINT_COOLDOWN_STEPS).toBe(180);
  });
  it('releasing C early ends the burst and still charges the full recovery', () => {
    const p = fresh()[4];
    const perStepBase = PLAYER_SPEED / STEPS_PER_SECOND;
    walk(p, 30, 1, true, false, 0);          // steps 0..29: burst
    walk(p, 1, 1, false, false, 30);         // step 30: release -> the full 180-step recovery starts
    walk(p, 144, 1, false, false, 31);       // steps 31..174: still recovering
    expect(walk(p, 1, 1, true, false, 175)).toBeCloseTo(perStepBase, 6);                // 175 < 30 + 180: no sprint
    walk(p, 39, 1, false, false, 176);       // steps 176..214: recovery ends at 210
    expect(walk(p, 1, 1, true, false, 215)).toBeCloseTo(perStepBase * SPRINT_MULT, 6);  // 215 > 210: sprints again
  });
  it('sprinting also applies with the ball', () => {
    const p = fresh()[4];
    expect(walk(p, 10, 1, true, true)).toBeCloseTo(10 * (PLAYER_SPEED_WITH_BALL / STEPS_PER_SECOND) * SPRINT_MULT, 6);
  });
});

describe('down and tackling players ignore the d-pad', () => {
  it('stays put while stepCount < downUntilStep and moves again after (1 s = 60 steps, sampled at 37 and 61)', () => {
    const p = fresh()[4];
    p.downUntilStep = 60;
    expect(isPlayerDown(p, 37)).toBe(true);
    stepPlayer(p, 1, 0, false, false, 1, PITCH, 37);
    expect(p.vx).toBe(0);
    expect(isPlayerDown(p, 61)).toBe(false);
    expect(walk(p, 1, 1, false, false, 61)).toBeCloseTo(PLAYER_SPEED / STEPS_PER_SECOND, 6);
  });
  it('a tackling player slides TACKLE_DIST along tackleDir in TACKLE_STEPS steps and ignores the d-pad', () => {
    const p = fresh()[4];
    p.tackleStepsLeft = TACKLE_STEPS; p.tackleDirX = 0; p.tackleDirY = 1;
    const y0 = p.y; const x0 = p.x;
    for (let s = 0; s < TACKLE_STEPS; s++) stepPlayer(p, -1, 0, true, false, 1, PITCH, s);
    expect(p.y - y0).toBeCloseTo(TACKLE_DIST, 6);
    expect(p.x).toBe(x0);
    // stepPlayer only slides: the countdown and the outcome belong to stepTackle (Task 3).
    expect(p.tackleStepsLeft).toBe(TACKLE_STEPS);
    expect(TACKLE_STEPS).toBe(24);
  });
});
```

```ts
// components/games/football-logic/ball.test.ts
import { describe, expect, it } from 'vitest';
import { PITCH } from './pitch';
import { FORMATIONS } from './teams';
import {
  BALL_GROUND_DECEL, CONTROL_DIST, KICK_LOCK_STEPS, LONG_PASS_VZ, POSSESSION_RADIUS, canPickUp,
  createBall, givePossession, kickBall, stepBall, stickToOwner,
} from './ball';
import { PLAYER_HEIGHT, createPlayers, type PlayerState } from './players';

const F = FORMATIONS[0];

function world(): { players: PlayerState[]; ball: ReturnType<typeof createBall> } {
  const players = createPlayers([F, F], PITCH);
  // Park everyone far from the action so proximity pickups are explicit in each test.
  for (const p of players) { p.x = 50 + p.id * 10; p.y = 1250; }
  return { players, ball: createBall() };
}

describe('possession glued to the foot', () => {
  it('the ball sits CONTROL_DIST ahead of the owner along its facing, on the ground', () => {
    const { players, ball } = world();
    const p = players[4];
    p.x = 640; p.y = 410; p.facingX = 0.6; p.facingY = -0.8;
    givePossession(ball, p, 12);
    stickToOwner(ball, p);
    expect(ball.owner).toBe(4);
    expect(ball.ownerSinceStep).toBe(12);
    expect(ball.lastTouchTeam).toBe(0);
    expect(ball.lastTouchId).toBe(4);
    expect(ball.x).toBeCloseTo(640 + 0.6 * CONTROL_DIST, 10);
    expect(ball.y).toBeCloseTo(410 - 0.8 * CONTROL_DIST, 10);
    expect(ball.z).toBe(0);
    expect([ball.vx, ball.vy, ball.vz]).toEqual([0, 0, 0]);
  });
  it('stepBall follows the owner as it moves', () => {
    const { players, ball } = world();
    const p = players[13];
    givePossession(ball, p, 0);
    p.x += 33; p.y -= 21;
    stepBall(ball, players, 1);
    expect(ball.x).toBeCloseTo(p.x + p.facingX * CONTROL_DIST, 10);
    expect(ball.y).toBeCloseTo(p.y + p.facingY * CONTROL_DIST, 10);
  });
});

describe('kickBall', () => {
  it('releases the owner, sets the velocity and locks the kicker for KICK_LOCK_STEPS', () => {
    const { players, ball } = world();
    const p = players[4];
    givePossession(ball, p, 0);
    stickToOwner(ball, p);
    kickBall(ball, p, 0.6, 0.8, 420, 0, 100);
    expect(ball.owner).toBeNull();
    expect(ball.vx).toBeCloseTo(252, 10);
    expect(ball.vy).toBeCloseTo(336, 10);
    expect(ball.kickerId).toBe(4);
    expect(ball.kickLockUntilStep).toBe(100 + KICK_LOCK_STEPS);
    expect(ball.lastTouchTeam).toBe(0);
    expect(canPickUp(ball, p, 100 + KICK_LOCK_STEPS - 3)).toBe(false);
    expect(canPickUp(ball, p, 100 + KICK_LOCK_STEPS + 2)).toBe(true);
    expect(KICK_LOCK_STEPS).toBe(15);
  });
});

describe('free ball physics', () => {
  it('a ground pass decelerates at BALL_GROUND_DECEL and stops', () => {
    const { players, ball } = world();
    const p = players[4];
    p.x = 300; p.y = 650; p.facingX = 1; p.facingY = 0;
    givePossession(ball, p, 0);
    stickToOwner(ball, p);
    kickBall(ball, p, 1, 0, 420, 0, 0);
    // after 0.5 s (30 steps) the speed has dropped by 130 u/s
    for (let s = 1; s <= 30; s++) stepBall(ball, players, s);
    expect(ball.vx).toBeCloseTo(420 - BALL_GROUND_DECEL * 0.5, 6);
    for (let s = 31; s <= 400; s++) stepBall(ball, players, s);
    expect(ball.vx).toBe(0);
    expect(ball.x).toBeGreaterThan(300 + 300);   // it travelled a real distance before stopping
  });
  it('a long pass rises above PLAYER_HEIGHT and lands ~350 u away (spec: "cae a ~350 u")', () => {
    const { players, ball } = world();
    const p = players[4];
    p.x = 500; p.y = 650; p.facingX = 1; p.facingY = 0;
    givePossession(ball, p, 0);
    stickToOwner(ball, p);
    const x0 = ball.x;
    kickBall(ball, p, 1, 0, 560, LONG_PASS_VZ, 0);
    let apex = 0;
    let landing = -1;
    for (let s = 1; s <= 200 && landing < 0; s++) {
      stepBall(ball, players, s);
      if (ball.z > apex) apex = ball.z;
      if (s > 5 && ball.z === 0) landing = ball.x - x0;
    }
    expect(apex).toBeGreaterThan(PLAYER_HEIGHT);
    expect(landing).toBeGreaterThan(320);
    expect(landing).toBeLessThan(380);
  });
  it('bounces with BALL_BOUNCE and comes to rest on the ground', () => {
    const { players, ball } = world();
    ball.x = 900; ball.y = 700; ball.z = 60; ball.vz = 0;
    let bounced = false;
    for (let s = 0; s < 300; s++) {
      stepBall(ball, players, s);
      if (ball.vz > 0) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(ball.z).toBe(0);
    expect(ball.vz).toBe(0);
  });
  it('nothing stops the ball leaving the pitch (the referee does, in Task 4)', () => {
    const { players, ball } = world();
    ball.x = PITCH.width - 30; ball.y = 100; ball.vx = 600;
    for (let s = 0; s < 30; s++) stepBall(ball, players, s);
    expect(ball.x).toBeGreaterThan(PITCH.width);
  });
});

describe('pickup by proximity', () => {
  it('the nearest eligible player takes a free ball inside POSSESSION_RADIUS', () => {
    const { players, ball } = world();
    ball.x = 1000; ball.y = 600;
    players[7].x = 1000 + 9; players[7].y = 600;      // 9 u away
    players[15].x = 1000; players[15].y = 600 + 17;   // 17 u away
    stepBall(ball, players, 5);
    expect(ball.owner).toBe(7);
  });
  it('at exactly the same distance the lowest id wins, whatever the array order says', () => {
    const { players, ball } = world();
    ball.x = 1000; ball.y = 600;
    players[16].x = 1000 - 11; players[16].y = 600;   // id 16, 11 u to the left
    players[3].x = 1000 + 11; players[3].y = 600;     // id 3, 11 u to the right
    stepBall(ball, players, 5);
    expect(ball.owner).toBe(3);
  });
  it('a player just outside POSSESSION_RADIUS does not take it', () => {
    const { players, ball } = world();
    ball.x = 1000; ball.y = 600;
    players[7].x = 1000 + POSSESSION_RADIUS + 3; players[7].y = 600;
    stepBall(ball, players, 5);
    expect(ball.owner).toBeNull();
  });
  it('a ball above PLAYER_HEIGHT flies over a player standing right under it', () => {
    const { players, ball } = world();
    ball.x = 1000; ball.y = 600; ball.z = PLAYER_HEIGHT + 8; ball.vz = 200;
    players[7].x = 1004; players[7].y = 600;
    stepBall(ball, players, 5);
    expect(ball.owner).toBeNull();
  });
  it('a down player, a tackling player and the locked kicker cannot pick up', () => {
    const { players, ball } = world();
    ball.x = 1000; ball.y = 600;
    players[7].x = 1006; players[7].y = 600; players[7].downUntilStep = 50;
    players[8].x = 1000; players[8].y = 607; players[8].tackleStepsLeft = 4;
    players[2].x = 994; players[2].y = 600; ball.kickerId = 2; ball.kickLockUntilStep = 50;
    stepBall(ball, players, 20);
    expect(ball.owner).toBeNull();
    stepBall(ball, players, 55);   // the down player is up again, the lock expired: lowest id (2) wins the tie at 6 u
    expect(ball.owner).toBe(2);
  });
});
```

```ts
// components/games/football-logic/step.test.ts
import { describe, expect, it } from 'vitest';
import { PITCH } from './pitch';
import { FORMATIONS } from './teams';
import { createTeamInput, type Axis, type TeamInput } from './input';
import { createPlayers, type PlayerState } from './players';
import { createBall, givePossession, type BallState } from './ball';
import { STEPS_PER_SECOND, STEP_MS, perStep, stepPhysics, stepsFor, type AttackDirs } from './step';

const F = FORMATIONS[0];
const ATTACK: AttackDirs = [1, -1];
// Arbitrary outfield ids; the derived "controlled" arrives in Task 3.
const CONTROLLED: readonly [number, number] = [4, 13];
const HALF_STEPS = stepsFor(90);

type World = { players: PlayerState[]; ball: BallState };

function createWorld(): World {
  const players = createPlayers([F, F], PITCH);
  const ball = createBall();
  givePossession(ball, players[4], 0);
  return { players, ball };
}

// Deterministic script from the step number alone: no rng, no state reads.
// Both teams move in changing directions and sprint in bursts; team 1 lags by a phase.
function script(step: number, team: 0 | 1, out: TeamInput): void {
  const phase = Math.floor(step / 45) + team * 7;
  out.dx = ((phase % 3) - 1) as Axis;
  out.dy = ((Math.floor(phase / 2) % 3) - 1) as Axis;
  out.c = step % 240 < 100 ? 'held' : 'up';
}

function run(steps: number, mutate?: (step: number, inputs: [TeamInput, TeamInput]) => void, onStep?: (w: World, step: number) => void): World {
  const w = createWorld();
  const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
  for (let s = 0; s < steps; s++) {
    script(s, 0, inputs[0]);
    script(s, 1, inputs[1]);
    if (mutate) mutate(s, inputs);
    stepPhysics(w.players, w.ball, inputs, CONTROLLED, ATTACK, PITCH, s);
    if (onStep) onStep(w, s);
  }
  return w;
}

function sameWorld(a: World, b: World): boolean {
  for (let i = 0; i < a.players.length; i++) {
    const p = a.players[i]; const q = b.players[i];
    if (p.x !== q.x || p.y !== q.y || p.vx !== q.vx || p.vy !== q.vy || p.facingX !== q.facingX || p.facingY !== q.facingY) return false;
    if (p.sprintStepsLeft !== q.sprintStepsLeft || p.sprintCooldownSteps !== q.sprintCooldownSteps || p.downUntilStep !== q.downUntilStep) return false;
  }
  const x = a.ball; const y = b.ball;
  return x.x === y.x && x.y === y.y && x.z === y.z && x.vx === y.vx && x.vy === y.vy && x.vz === y.vz && x.owner === y.owner;
}

describe('fixed step', () => {
  it('STEP_MS is 1000/60 and stepsFor rounds seconds to whole steps', () => {
    expect(STEPS_PER_SECOND).toBe(60);
    expect(STEP_MS).toBeCloseTo(16.6667, 3);
    expect(stepsFor(90)).toBe(5400);
    expect(stepsFor(0.4)).toBe(24);
    expect(stepsFor(0.25)).toBe(15);
  });
  it('perStep converts u/s to u per step', () => {
    expect(perStep(180)).toBe(3);
    expect(perStep(560) * 60).toBeCloseTo(560, 10);
  });
});

describe('determinism — the test that rules (criterion 1)', () => {
  it('the same input sequence reproduces the same world step by step over a full half (5400 steps)', () => {
    const a = createWorld();
    const b = createWorld();
    const ia: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    const ib: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    let firstMismatch = -1;
    for (let s = 0; s < HALF_STEPS && firstMismatch < 0; s++) {
      script(s, 0, ia[0]); script(s, 1, ia[1]);
      script(s, 0, ib[0]); script(s, 1, ib[1]);
      stepPhysics(a.players, a.ball, ia, CONTROLLED, ATTACK, PITCH, s);
      stepPhysics(b.players, b.ball, ib, CONTROLLED, ATTACK, PITCH, s);
      if (!sameWorld(a, b)) firstMismatch = s;
    }
    expect(firstMismatch).toBe(-1);
    // Not vacuous: the controlled players actually moved and the ball travelled with its owner.
    const start = createWorld();
    expect(a.players[4].x).not.toBe(start.players[4].x);
    expect(a.players[13].y).not.toBe(start.players[13].y);
    expect(a.ball.x).not.toBe(start.ball.x);
  });
  it('a different input sequence produces a different world (proves the comparison is not blind)', () => {
    const a = run(HALF_STEPS);
    const b = run(HALF_STEPS, (s, inputs) => {
      if (s >= 1200) inputs[1].dx = (-inputs[1].dx) as Axis;
    });
    expect(sameWorld(a, b)).toBe(false);
    expect(a.players[13].x).not.toBe(b.players[13].x);
  });
  it('non-controlled players never move under stepPhysics (the AI arrives in Task 6)', () => {
    const w = run(600);
    const start = createWorld();
    for (const p of w.players) {
      if (p.id === CONTROLLED[0] || p.id === CONTROLLED[1]) continue;
      expect([p.x, p.y]).toEqual([start.players[p.id].x, start.players[p.id].y]);
    }
  });
});
```

Y en `invariants.test.ts`, al final (los `import` se funden con los ya existentes en la cabecera del fichero):

```ts
// invariants.test.ts (añadido en Task 2)
import { createPlayers } from './players';
import { checkGoalkeepersInBox } from './invariants';
import { FORMATIONS } from './teams';

describe('checkGoalkeepersInBox (criterion 9b)', () => {
  it('accepts freshly created players', () => {
    expect(checkGoalkeepersInBox(createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH), [1, -1], PITCH)).toEqual([]);
  });
  it('rejects a goalkeeper wandering to midfield', () => {
    const ps = createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH);
    ps[9].x = 900;
    expect(checkGoalkeepersInBox(ps, [1, -1], PITCH).join(' ')).toContain('goalkeeper 9 outside big area');
  });
  it('rejects a goalkeeper inside the WRONG box (its own box moves with attackDir)', () => {
    const ps = createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH);
    expect(checkGoalkeepersInBox(ps, [-1, 1], PITCH).join(' ')).toContain('goalkeeper 0 outside big area');
  });
});
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `npx vitest run components/games/football-logic/`
Expected: FAIL — no existen `geometry.ts`, `input.ts`, `step.ts`, `players.ts`, `ball.ts`; `checkGoalkeepersInBox` no está exportado.

- [ ] **Step 3: Implementación mínima**

```ts
// components/games/football-logic/geometry.ts
export type Vec2 = { x: number; y: number };

export const INV_SQRT2 = 1 / Math.sqrt(2);

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

// Writes the unit vector of (x, y) into `out`. Returns false (and leaves `out`
// untouched) for the zero vector, so callers keep their previous facing.
export function normalizeInto(out: Vec2, x: number, y: number): boolean {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return false;
  out.x = x / len;
  out.y = y / len;
  return true;
}

export function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
```

```ts
// components/games/football-logic/input.ts
import type { Strategy } from './teams';

export type { Strategy } from './teams';

// A TeamInput is the input of ONE simulation step (not a frame): the component
// samples the keyboard once per frame and repeats it for every step of that frame.
// `pressed` and `released` last one step; the engine consumes them on the first.
export type ButtonState = 'up' | 'pressed' | 'held' | 'released';
export type Axis = -1 | 0 | 1;

export type TeamInput = {
  dx: Axis;
  dy: Axis;
  a: ButtonState;
  b: ButtonState;
  c: ButtonState;
  formation: number; // index into FORMATIONS
  strategy: Strategy;
};

const BUTTON_STATES: readonly ButtonState[] = ['up', 'pressed', 'held', 'released'];
const STRATEGY_NAMES: readonly Strategy[] = ['attack', 'neutral', 'defend'];

export function createTeamInput(): TeamInput {
  return { dx: 0, dy: 0, a: 'up', b: 'up', c: 'up', formation: 0, strategy: 'neutral' };
}

export function copyTeamInput(from: TeamInput, to: TeamInput): void {
  to.dx = from.dx;
  to.dy = from.dy;
  to.a = from.a;
  to.b = from.b;
  to.c = from.c;
  to.formation = from.formation;
  to.strategy = from.strategy;
}

export function isDown(b: ButtonState): boolean {
  return b === 'pressed' || b === 'held';
}

function isAxis(v: number): boolean {
  return v === -1 || v === 0 || v === 1;
}

export function checkTeamInput(input: TeamInput, formationCount: number): string[] {
  const problems: string[] = [];
  if (!isAxis(input.dx)) problems.push('bad dx');
  if (!isAxis(input.dy)) problems.push('bad dy');
  if (!BUTTON_STATES.includes(input.a)) problems.push('bad button a');
  if (!BUTTON_STATES.includes(input.b)) problems.push('bad button b');
  if (!BUTTON_STATES.includes(input.c)) problems.push('bad button c');
  if (!Number.isInteger(input.formation) || input.formation < 0 || input.formation >= formationCount) {
    problems.push(`formation ${input.formation} out of range`);
  }
  if (!STRATEGY_NAMES.includes(input.strategy)) problems.push('bad strategy');
  return problems;
}
```

```ts
// components/games/football-logic/clock.ts
// The FIXED simulation step. No dtMs ever enters the engine: a variable step
// would only be deterministic within one machine (60 fps vs 144 fps diverge).
// This file imports nothing, so players.ts and ball.ts can use it without
// forming an import cycle with step.ts (which imports them).
export const STEPS_PER_SECOND = 60;
export const STEP_MS = 1000 / STEPS_PER_SECOND;

export function stepsFor(seconds: number): number {
  return Math.round(seconds * STEPS_PER_SECOND);
}

export function perStep(unitsPerSecond: number): number {
  return unitsPerSecond / STEPS_PER_SECOND;
}
```

```ts
// components/games/football-logic/step.ts
import type { PitchDef } from './pitch';
import { isDown, type TeamInput } from './input';
import { stepPlayer, type PlayerState } from './players';
import { stepBall, type BallState } from './ball';

// The public contract of the fixed step: everything outside players.ts/ball.ts imports the clock from here.
export { STEPS_PER_SECOND, STEP_MS, stepsFor, perStep } from './clock';

export type AttackDirs = readonly [1 | -1, 1 | -1];

// Moves the two controlled players by their team's input, ticks everyone else's
// timers, then advances the ball. Allocates nothing. Task 5 wraps it in stepMatch,
// after the actions and before the referee.
export function stepPhysics(
  players: PlayerState[],
  ball: BallState,
  inputs: readonly [TeamInput, TeamInput],
  controlled: readonly [number, number],
  attackDir: AttackDirs,
  pitch: PitchDef,
  stepCount: number,
): void {
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const hasBall = ball.owner === p.id;
    if (p.id === controlled[p.team]) {
      const input = inputs[p.team];
      stepPlayer(p, input.dx, input.dy, isDown(input.c), hasBall, attackDir[p.team], pitch, stepCount);
    } else {
      stepPlayer(p, 0, 0, false, hasBall, attackDir[p.team], pitch, stepCount);
    }
  }
  stepBall(ball, players, stepCount);
}
```

```ts
// components/games/football-logic/players.ts
import { INV_SQRT2, normalizeInto, type Vec2 } from './geometry';
import { centerY, clampToBigArea, goalLineX, type PitchDef, type Side } from './pitch';
import { OUTFIELD, STRATEGIES, TEAM_SIZE, type Formation, type FormationSlot, type Role, type Strategy } from './teams';
import type { Axis } from './input';
import { perStep, stepsFor } from './clock';

export type PlayerState = {
  id: number; // own id, not "defender #2": what will make substitutions possible in v1.5
  team: 0 | 1;
  role: Role;
  slot: number; // index into the formation, -1 for the goalkeeper
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  sprintStepsLeft: number;
  sprintCooldownSteps: number;
  downUntilStep: number;
  chargeSteps: number;
  chargeButton: 'none' | 'a' | 'b';
  tackleStepsLeft: number;
  tackleDirX: number;
  tackleDirY: number;
};

export const PLAYER_SPEED = 180;
export const PLAYER_SPEED_WITH_BALL = 160;
export const SPRINT_MULT = 1.4;
export const SPRINT_SECONDS = 2;
export const SPRINT_COOLDOWN_SECONDS = 3;
export const SPRINT_STEPS = stepsFor(SPRINT_SECONDS);
export const SPRINT_COOLDOWN_STEPS = stepsFor(SPRINT_COOLDOWN_SECONDS);
export const PLAYER_RADIUS = 12;
export const PLAYER_HEIGHT = 35;
export const GK_LINE_DIST = 25;
export const TACKLE_DIST = 90;
export const TACKLE_SECONDS = 0.4;
export const TACKLE_STEPS = stepsFor(TACKLE_SECONDS);
export const TACKLE_SPEED = TACKLE_DIST / TACKLE_SECONDS;

// Scratch for direction math inside the step; never holds state between calls.
const scratchDir: Vec2 = { x: 0, y: 0 };

export function ownGoalSide(attackDir: 1 | -1): Side {
  return attackDir === 1 ? 0 : 1;
}

// Formation fraction -> world units, shifted by the strategy towards the rival
// goal and mirrored in x for the team attacking -x.
export function anchorFor(slot: FormationSlot, strategy: Strategy, attackDir: 1 | -1, pitch: PitchDef, out: Vec2): void {
  const fx = slot.x + STRATEGIES[strategy];
  out.x = (attackDir === 1 ? fx : 1 - fx) * pitch.width;
  out.y = slot.y * pitch.height;
}

function createPlayer(id: number, team: 0 | 1, role: Role, slot: number, attackDir: 1 | -1): PlayerState {
  return {
    id, team, role, slot,
    x: 0, y: 0, vx: 0, vy: 0,
    facingX: attackDir, facingY: 0,
    sprintStepsLeft: 0, sprintCooldownSteps: 0, downUntilStep: 0,
    chargeSteps: 0, chargeButton: 'none',
    tackleStepsLeft: 0, tackleDirX: 0, tackleDirY: 0,
  };
}

// 18 players created once: ids 0..8 are team 0 (0 = goalkeeper), 9..17 team 1.
// players[i].id === i always, so players[ball.owner] is O(1).
export function createPlayers(formations: readonly [Formation, Formation], pitch: PitchDef): PlayerState[] {
  const players: PlayerState[] = [];
  for (const team of [0, 1] as const) {
    const attackDir: 1 | -1 = team === 0 ? 1 : -1;
    const base = team * TEAM_SIZE;
    players.push(createPlayer(base, team, 'gk', -1, attackDir));
    for (let s = 0; s < OUTFIELD; s++) {
      players.push(createPlayer(base + 1 + s, team, formations[team].slots[s].role, s, attackDir));
    }
    placeByFormation(players, team, formations[team], 'neutral', attackDir, pitch);
  }
  return players;
}

export function placeByFormation(players: PlayerState[], team: 0 | 1, formation: Formation, strategy: Strategy, attackDir: 1 | -1, pitch: PitchDef): void {
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.team !== team) continue;
    if (p.role === 'gk') {
      p.x = goalLineX(pitch, ownGoalSide(attackDir)) + attackDir * GK_LINE_DIST;
      p.y = centerY(pitch);
    } else {
      anchorFor(formation.slots[p.slot], strategy, attackDir, pitch, scratchDir);
      p.x = scratchDir.x;
      p.y = scratchDir.y;
    }
    p.vx = 0;
    p.vy = 0;
    p.facingX = attackDir;
    p.facingY = 0;
  }
}

export function isPlayerDown(p: PlayerState, stepCount: number): boolean {
  return stepCount < p.downUntilStep;
}

export function isSprinting(p: PlayerState): boolean {
  return p.sprintStepsLeft > 0;
}

// Burst with recovery, counted in steps. Returns whether this step is sprinting.
function tickSprint(p: PlayerState, wantSprint: boolean): boolean {
  if (p.sprintStepsLeft > 0) {
    if (!wantSprint) {
      p.sprintStepsLeft = 0;
      p.sprintCooldownSteps = SPRINT_COOLDOWN_STEPS;
      return false;
    }
    p.sprintStepsLeft--;
    if (p.sprintStepsLeft === 0) p.sprintCooldownSteps = SPRINT_COOLDOWN_STEPS;
    return true;
  }
  if (p.sprintCooldownSteps > 0) {
    p.sprintCooldownSteps--;
    return false;
  }
  if (wantSprint) {
    p.sprintStepsLeft = SPRINT_STEPS - 1;
    return true;
  }
  return false;
}

function clampToPitch(p: PlayerState, attackDir: 1 | -1, pitch: PitchDef): void {
  if (p.x < 0) p.x = 0;
  if (p.x > pitch.width) p.x = pitch.width;
  if (p.y < 0) p.y = 0;
  if (p.y > pitch.height) p.y = pitch.height;
  if (p.role === 'gk') clampToBigArea(pitch, ownGoalSide(attackDir), p);
}

export function stepPlayer(p: PlayerState, dx: Axis, dy: Axis, wantSprint: boolean, hasBall: boolean, attackDir: 1 | -1, pitch: PitchDef, stepCount: number): void {
  // Slides while the tackle is active; Task 3's stepTackle owns the countdown and the outcome.
  if (p.tackleStepsLeft > 0) {
    p.vx = p.tackleDirX * TACKLE_SPEED;
    p.vy = p.tackleDirY * TACKLE_SPEED;
    p.x += perStep(p.vx);
    p.y += perStep(p.vy);
    tickSprint(p, false);
    clampToPitch(p, attackDir, pitch);
    return;
  }
  if (isPlayerDown(p, stepCount)) {
    p.vx = 0;
    p.vy = 0;
    tickSprint(p, false);
    clampToPitch(p, attackDir, pitch);
    return;
  }
  const sprinting = tickSprint(p, wantSprint);
  let speed = hasBall ? PLAYER_SPEED_WITH_BALL : PLAYER_SPEED;
  if (sprinting) speed *= SPRINT_MULT;
  if (dx === 0 && dy === 0) {
    p.vx = 0;
    p.vy = 0;
  } else {
    const diag = dx !== 0 && dy !== 0 ? INV_SQRT2 : 1;
    p.facingX = dx * diag;
    p.facingY = dy * diag;
    p.vx = p.facingX * speed;
    p.vy = p.facingY * speed;
    p.x += perStep(p.vx);
    p.y += perStep(p.vy);
  }
  clampToPitch(p, attackDir, pitch);
}
```

> **Por qué existe `clock.ts`**: `step.ts` importa `players.ts` y `ball.ts`, y los dos necesitan `stepsFor`/`perStep` **en tiempo de carga** (`SPRINT_STEPS = stepsFor(2)`). Si vivieran en `step.ts`, en un ciclo ESM `STEPS_PER_SECOND` (un `const`) estaría en TDZ cuando `players.ts` se evalúa primero, y `stepsFor(2)` lanzaría `ReferenceError`. `clock.ts` no importa nada; `step.ts` lo re-exporta y sigue siendo el contrato público (todo lo demás importa de `step.ts`).

```ts
// components/games/football-logic/ball.ts
import { dist } from './geometry';
import { PLAYER_HEIGHT, isPlayerDown, type PlayerState } from './players';
import { perStep, stepsFor } from './clock';

export type BallState = {
  x: number;
  y: number;
  z: number; // height, for the long pass over heads
  vx: number;
  vy: number;
  vz: number;
  owner: number | null; // id of the player carrying it glued to the foot
  ownerSinceStep: number;
  lastTouchTeam: 0 | 1 | null;
  lastTouchId: number | null;
  kickerId: number | null;
  kickLockUntilStep: number;
};

export const GRAVITY = 900;
export const BALL_GROUND_DECEL = 260;
export const BALL_BOUNCE = 0.5;
export const BALL_REST_VZ = 30;
export const CONTROL_DIST = 18;
export const POSSESSION_RADIUS = 22;
export const KICK_LOCK_SECONDS = 0.25;
export const KICK_LOCK_STEPS = stepsFor(KICK_LOCK_SECONDS);
// With GRAVITY 900 the flight lasts 2 * 280 / 900 = 0.62 s: at 560 u/s that is ~348 u (spec: "cae a ~350 u"),
// with an apex of 280² / 1800 = 43.6 u, above PLAYER_HEIGHT.
export const LONG_PASS_VZ = 280;

export function createBall(): BallState {
  return {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    owner: null, ownerSinceStep: 0,
    lastTouchTeam: null, lastTouchId: null,
    kickerId: null, kickLockUntilStep: 0,
  };
}

export function givePossession(ball: BallState, p: PlayerState, stepCount: number): void {
  ball.owner = p.id;
  ball.ownerSinceStep = stepCount;
  ball.lastTouchTeam = p.team;
  ball.lastTouchId = p.id;
  ball.vx = 0;
  ball.vy = 0;
  ball.vz = 0;
  ball.z = 0;
  stickToOwner(ball, p);
}

export function stickToOwner(ball: BallState, owner: PlayerState): void {
  ball.x = owner.x + owner.facingX * CONTROL_DIST;
  ball.y = owner.y + owner.facingY * CONTROL_DIST;
  ball.z = 0;
}

// (dirX, dirY) must be a unit vector. Releases the owner and locks the kicker so
// it does not pick its own pass back up next step.
export function kickBall(ball: BallState, kicker: PlayerState, dirX: number, dirY: number, speed: number, vz: number, stepCount: number): void {
  ball.owner = null;
  ball.vx = dirX * speed;
  ball.vy = dirY * speed;
  ball.vz = vz;
  ball.lastTouchTeam = kicker.team;
  ball.lastTouchId = kicker.id;
  ball.kickerId = kicker.id;
  ball.kickLockUntilStep = stepCount + KICK_LOCK_STEPS;
}

export function canPickUp(ball: BallState, p: PlayerState, stepCount: number): boolean {
  if (isPlayerDown(p, stepCount)) return false;
  if (p.tackleStepsLeft > 0) return false;
  if (ball.kickerId === p.id && stepCount < ball.kickLockUntilStep) return false;
  return true;
}

function flyAndRoll(ball: BallState): void {
  if (ball.z > 0 || ball.vz > 0) {
    ball.vz -= perStep(GRAVITY);
    ball.z += perStep(ball.vz);
    if (ball.z <= 0) {
      ball.z = 0;
      ball.vz = -ball.vz * BALL_BOUNCE;
      if (ball.vz < BALL_REST_VZ) ball.vz = 0;
    }
  }
  ball.x += perStep(ball.vx);
  ball.y += perStep(ball.vy);
  if (ball.z === 0) {
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > 0) {
      const next = speed - perStep(BALL_GROUND_DECEL);
      if (next <= 0) {
        ball.vx = 0;
        ball.vy = 0;
      } else {
        const k = next / speed;
        ball.vx *= k;
        ball.vy *= k;
      }
    }
  }
}

// Nearest eligible player inside POSSESSION_RADIUS takes a free, low ball.
// Ascending ids with a strict `<` make the lowest id win every tie.
function pickUp(ball: BallState, players: readonly PlayerState[], stepCount: number): void {
  if (ball.z > PLAYER_HEIGHT) return;
  let best: PlayerState | null = null;
  let bestDist = POSSESSION_RADIUS;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!canPickUp(ball, p, stepCount)) continue;
    const d = dist(p.x, p.y, ball.x, ball.y);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  if (best !== null) givePossession(ball, best, stepCount);
}

export function stepBall(ball: BallState, players: readonly PlayerState[], stepCount: number): void {
  if (ball.owner !== null) {
    stickToOwner(ball, players[ball.owner]);
    return;
  }
  flyAndRoll(ball);
  pickUp(ball, players, stepCount);
}
```

Y en `invariants.ts`, al final (importando **solo tipos** de `players.ts` y `step.ts`; `isInsideBigArea` se añade al import de `./pitch` que ya existe):

```ts
// invariants.ts (añadido en Task 2)
import { isInsideBigArea } from './pitch';
import type { PlayerState } from './players';
import type { AttackDirs } from './step';

// Criterion 9b: a goalkeeper is never outside its own big area, not even by physics.
export function checkGoalkeepersInBox(players: readonly PlayerState[], attackDir: AttackDirs, pitch: PitchDef): string[] {
  const problems: string[] = [];
  for (const p of players) {
    if (p.role !== 'gk') continue;
    const side = attackDir[p.team] === 1 ? 0 : 1;
    if (!isInsideBigArea(pitch, side, p.x, p.y)) problems.push(`goalkeeper ${p.id} outside big area`);
  }
  return problems;
}
```

> `checkGoalkeepersInBox` recalcula el lado propio en vez de importar `ownGoalSide` de `players.ts`: `invariants.ts` importa de `players.ts` **solo el tipo**, como `roster-invariants.ts` hace con `stages.ts`. Es un duplicado deliberado de una línea.

- [ ] **Step 4: Verde**

Run: `npx vitest run` → todo verde (unos 45 tests nuevos). `npx tsc --noEmit` limpio. El `grep` de determinismo de las Global Constraints, vacío (el único `Math.sqrt` está en `geometry.ts`, `ball.ts` y el test). El test de 5 400 pasos debe correr en **menos de 1 s**; si tarda más, revisar que `sameWorld` no asigne.

- [ ] **Step 5: Verificar y proponer commit**

Exportaciones con destino declarado: `checkTeamInput` → Task 6; `GK_LINE_DIST` → Task 6; `PLAYER_RADIUS`, `TACKLE_STEPS`, `TACKLE_SPEED`, `chargeSteps`/`chargeButton`/`tackleDir*` → Task 3; `lastTouchTeam`/`lastTouchId` → Task 4; `ownerSinceStep` → Task 3 (`releaseFromGoalkeeper`); `stepPhysics` → Task 5.

Mensaje propuesto: `feat(world-cup): fixed-step players and ball physics with the determinism test`

---

## Task 3: `actions.ts` — lo que hace un jugador, y el controlado derivado

**Files:**
- Create: `components/games/football-logic/actions.ts`
- Test: `components/games/football-logic/actions.test.ts`

**Interfaces:**
- Consumes (Tasks 1-2): `Rng` de `rng.ts`; `dist`, `normalizeInto`, `Vec2` de `geometry.ts`; `isDown`, `TeamInput` de `input.ts`; `PLAYER_HEIGHT`, `PLAYER_RADIUS`, `TACKLE_STEPS`, `isPlayerDown`, `isSprinting`, `PlayerState` de `players.ts`; `LONG_PASS_VZ`, `givePossession`, `kickBall`, `BallState` de `ball.ts`; `stepsFor` de `step.ts`.
- Produces:

```ts
// actions.ts
export type ActionKind = 'none' | 'shot' | 'short-pass' | 'long-pass' | 'steal' | 'tackle' | 'gk-release';
export type ActionEvent = {
  kind: ActionKind;
  ok: boolean;          // el chut/pase salió, el robo o la entrada consiguió el balón
  foul: boolean;        // la entrada tocó a un rival (Task 4 lo convierte en tiro libre o penalti)
  actorId: number;      // -1 si none
  victimId: number;     // el rival tocado en la falta; -1 si no hay
  x: number; y: number; // dónde (la posición de la víctima en la falta)
};
export function createActionEvent(): ActionEvent;
export function clearActionEvent(out: ActionEvent): void;

export const SHOT_SPEED_MIN = 700;
export const SHOT_SPEED_MAX = 950;
export const SHOT_CHARGE_SECONDS = 1;
export const SHOT_CHARGE_STEPS: number;          // 60
export const SHOT_VZ_MAX = 200;                  // un chut cargado sube un poco (apex 22 u, nunca por encima del larguero solo)
export const SHORT_PASS_SPEED = 420;
export const LONG_PASS_SPEED = 560;
export const LONG_PASS_HOLD_SECONDS = 0.25;
export const LONG_PASS_HOLD_STEPS: number;       // 15: B mantenido al menos esto = pase largo
export const STEAL_RANGE = 28;
export const STEAL_CHANCE = 0.65;                // frente a un rival que no sprinta
export const STEAL_CHANCE_VS_SPRINT = 0.35;      // frente a un rival sprintando
export const TACKLE_BALL_REACH = 20;
export const TACKLE_FOUL_RADIUS: number;         // 2 * PLAYER_RADIUS = 24
export const TACKLE_MISS_DOWN_SECONDS = 1;
export const TACKLE_MISS_DOWN_STEPS: number;     // 60
export const CONTROL_HYSTERESIS = 40;
export const GK_HOLD_SECONDS = 2;
export const GK_HOLD_STEPS: number;              // 120

export function shotSpeed(chargeSteps: number): number;   // 700 → 950 lineal, tope en SHOT_CHARGE_STEPS
export function shoot(p: PlayerState, ball: BallState, dirX: number, dirY: number, chargeSteps: number, stepCount: number, out: ActionEvent): void;
export function shortPass(p: PlayerState, ball: BallState, dirX: number, dirY: number, stepCount: number, out: ActionEvent): void;
export function longPass(p: PlayerState, ball: BallState, dirX: number, dirY: number, stepCount: number, out: ActionEvent): void;
export function steal(p: PlayerState, ball: BallState, players: readonly PlayerState[], rng: Rng, stepCount: number, out: ActionEvent): void;
export function startTackle(p: PlayerState, dirX: number, dirY: number, out: ActionEvent): void;
export function stepTackle(p: PlayerState, ball: BallState, players: readonly PlayerState[], stepCount: number, out: ActionEvent): void;
export function releaseFromGoalkeeper(gk: PlayerState, ball: BallState, attackDir: 1 | -1, stepCount: number, out: ActionEvent): void;
export function applyButtons(p: PlayerState, input: TeamInput, ball: BallState, players: readonly PlayerState[], rng: Rng, stepCount: number, aim: Vec2, out: ActionEvent): void;
export function updateControlled(players: readonly PlayerState[], ball: BallState, controlled: [number, number]): void;
```

Reglas fijadas aquí:
- **Dirección de chut y pase**: la cruceta si no es nula (normalizada, 8 direcciones), si no el `facing`. Los pases **no** buscan compañero: van en la dirección elegida (la IA de la Task 6 elegirá la dirección hacia el compañero).
- **Carga**: A mantenido acumula `chargeSteps` (tope `SHOT_CHARGE_STEPS`); al **soltar** sale el chut con `shotSpeed(chargeSteps)`. B igual: al soltar, largo si `chargeSteps >= LONG_PASS_HOLD_STEPS`, corto si no. Un toque (`pressed` + `released` en pasos consecutivos) es `chargeSteps = 1`: chut a 704 u/s, pase corto. `chargeButton` recuerda cuál se está cargando; perder el balón lo reinicia.
- **Sin balón**: A `pressed` arranca la entrada al suelo en la dirección de puntería; B `pressed` intenta el robo de pie.
- **Robo de pie**: solo si el poseedor es rival, **no es portero** (regla 4 del portero del spec: no se le puede robar) y está a `< STEAL_RANGE`; entonces, y solo entonces, consume **un** `rng()`; éxito si `rng() < STEAL_CHANCE` (o `STEAL_CHANCE_VS_SPRINT` si el poseedor sprinta). Fuera de alcance o contra el portero **no consume rng** (determinismo: el número de tiradas es parte del estado).
- **Entrada al suelo** (`stepTackle`, se llama cada paso **después** de `stepPhysics` para cualquier jugador con `tackleStepsLeft > 0`): (1) si el balón está bajo (`z <= PLAYER_HEIGHT`), a `< TACKLE_BALL_REACH` y libre o de un rival no portero → **roba** y la entrada termina de pie; (2) si no, si algún rival (no en el suelo) está a `< TACKLE_FOUL_RADIUS` → **falta** sobre el rival de `id` más bajo, `foul = true`, posición de la víctima, y el que entra queda **1 s en el suelo**; (3) si no, descuenta un paso, y al llegar a cero sin nada, **1 s en el suelo**. El orden balón → jugador es el que hace que entrar de frente robe y entrar por detrás sea falta.
- **El portero con balón** lo saca solo a los `GK_HOLD_STEPS` de tenerlo: pase largo hacia `(attackDir, 0)`. Es la regla 4 del portero del spec adelantada a esta etapa **solo en la dirección** (la Task 6 elegirá al compañero más libre); sin ella un partido sin IA se atasca en el portero.
- **`updateControlled`** (regla exacta del spec): por equipo, si el balón lo lleva un jugador **de campo** del equipo → ese; si no (balón libre, rival, o **portero propio**, que nunca es controlado por el criterio 4), el jugador de campo más cercano al balón, recorriendo ids ascendentes con `<` estricto (desempate por id más bajo), y con **histéresis**: si el controlado actual es válido, solo cambia si el candidato está **al menos `CONTROL_HYSTERESIS` más cerca** (`bestDist <= currentDist - 40`). Se llama al final de cada `stepMatch` (Task 5) y escribe en la tupla `controlled`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// components/games/football-logic/actions.test.ts
import { describe, expect, it } from 'vitest';
import { PITCH } from './pitch';
import { FORMATIONS } from './teams';
import { createTeamInput, type TeamInput } from './input';
import { createPlayers, stepPlayer, TACKLE_STEPS, type PlayerState } from './players';
import { LONG_PASS_VZ, createBall, givePossession, stickToOwner, type BallState } from './ball';
import type { Rng } from './rng';
import {
  CONTROL_HYSTERESIS, GK_HOLD_STEPS, LONG_PASS_HOLD_STEPS, LONG_PASS_SPEED, SHORT_PASS_SPEED, SHOT_CHARGE_STEPS,
  SHOT_SPEED_MAX, SHOT_SPEED_MIN, STEAL_CHANCE, STEAL_CHANCE_VS_SPRINT, STEAL_RANGE, TACKLE_MISS_DOWN_STEPS,
  applyButtons, createActionEvent, longPass, releaseFromGoalkeeper, shoot, shortPass, shotSpeed, startTackle,
  steal, stepTackle, updateControlled, type ActionEvent,
} from './actions';

const F = FORMATIONS[0];

type World = { players: PlayerState[]; ball: BallState; out: ActionEvent; aim: { x: number; y: number } };

function world(): World {
  const players = createPlayers([F, F], PITCH);
  // Everyone parked on the bottom touch line, spaced by id, so every test places its actors explicitly.
  for (const p of players) { p.x = 100 + p.id * 40; p.y = 1290; p.facingX = 1; p.facingY = 0; }
  return { players, ball: createBall(), out: createActionEvent(), aim: { x: 0, y: 0 } };
}

function at(p: PlayerState, x: number, y: number, fx = 1, fy = 0): PlayerState {
  p.x = x; p.y = y; p.facingX = fx; p.facingY = fy;
  return p;
}

function fixedRng(values: number[]): Rng & { calls: number } {
  let i = 0;
  const fn = (() => { fn.calls++; return values[i++ % values.length]; }) as Rng & { calls: number };
  fn.calls = 0;
  return fn;
}

function speedOf(ball: BallState): number {
  return Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
}

describe('shotSpeed: 700 at a tap, 950 after one second of charge', () => {
  it('interpolates linearly and caps at SHOT_CHARGE_STEPS', () => {
    expect(shotSpeed(0)).toBe(SHOT_SPEED_MIN);
    expect(shotSpeed(30)).toBe((SHOT_SPEED_MIN + SHOT_SPEED_MAX) / 2);
    expect(shotSpeed(SHOT_CHARGE_STEPS)).toBe(SHOT_SPEED_MAX);
    expect(shotSpeed(SHOT_CHARGE_STEPS + 45)).toBe(SHOT_SPEED_MAX);
    expect(SHOT_CHARGE_STEPS).toBe(60);
  });
});

describe('shoot / shortPass / longPass write the ball and the event', () => {
  it('shoot releases the owner at shotSpeed along the given unit direction', () => {
    const w = world();
    const p = at(w.players[5], 900, 700);
    givePossession(w.ball, p, 10);
    shoot(p, w.ball, 0.6, 0.8, 40, 10, w.out);
    expect(w.ball.owner).toBeNull();
    expect(speedOf(w.ball)).toBeCloseTo(shotSpeed(40), 6);
    expect(w.ball.vx / w.ball.vy).toBeCloseTo(0.75, 10);
    expect(w.ball.vz).toBeGreaterThan(0);
    expect(w.out).toMatchObject({ kind: 'shot', ok: true, foul: false, actorId: 5 });
  });
  it('shortPass is a 420 u/s ground ball', () => {
    const w = world();
    const p = at(w.players[5], 900, 700);
    givePossession(w.ball, p, 10);
    shortPass(p, w.ball, 1, 0, 10, w.out);
    expect(speedOf(w.ball)).toBeCloseTo(SHORT_PASS_SPEED, 6);
    expect(w.ball.vz).toBe(0);
    expect(w.out.kind).toBe('short-pass');
  });
  it('longPass is a 560 u/s lob with LONG_PASS_VZ', () => {
    const w = world();
    const p = at(w.players[5], 900, 700);
    givePossession(w.ball, p, 10);
    longPass(p, w.ball, 0, -1, 10, w.out);
    expect(speedOf(w.ball)).toBeCloseTo(LONG_PASS_SPEED, 6);
    expect(w.ball.vz).toBe(LONG_PASS_VZ);
    expect(w.out.kind).toBe('long-pass');
  });
});

describe('steal: 65% by the injected rng, 35% against a sprinting owner, no roll out of range', () => {
  function setup(distance: number): World & { thief: PlayerState; owner: PlayerState } {
    const w = world();
    const owner = at(w.players[12], 1000, 600, -1, 0);
    givePossession(w.ball, owner, 50);
    stickToOwner(w.ball, owner);
    const thief = at(w.players[4], 1000 - distance, 600);
    return { ...w, thief, owner };
  }
  it('succeeds when rng() is below STEAL_CHANCE', () => {
    const s = setup(23);
    const rng = fixedRng([STEAL_CHANCE - 0.01]);
    steal(s.thief, s.ball, s.players, rng, 60, s.out);
    expect(s.ball.owner).toBe(4);
    expect(rng.calls).toBe(1);
    expect(s.out).toMatchObject({ kind: 'steal', ok: true, actorId: 4, victimId: 12 });
  });
  it('fails when rng() is at or above STEAL_CHANCE', () => {
    const s = setup(23);
    steal(s.thief, s.ball, s.players, fixedRng([STEAL_CHANCE + 0.01]), 60, s.out);
    expect(s.ball.owner).toBe(12);
    expect(s.out).toMatchObject({ kind: 'steal', ok: false });
  });
  it('uses STEAL_CHANCE_VS_SPRINT against a sprinting owner', () => {
    const s = setup(23);
    s.owner.sprintStepsLeft = 50;
    steal(s.thief, s.ball, s.players, fixedRng([STEAL_CHANCE_VS_SPRINT + 0.02]), 60, s.out);
    expect(s.ball.owner).toBe(12);
    const t = setup(23);
    t.owner.sprintStepsLeft = 50;
    steal(t.thief, t.ball, t.players, fixedRng([STEAL_CHANCE_VS_SPRINT - 0.02]), 60, t.out);
    expect(t.ball.owner).toBe(4);
  });
  it('does not roll the rng when the owner is out of STEAL_RANGE', () => {
    const s = setup(STEAL_RANGE + 5);
    const rng = fixedRng([0]);
    steal(s.thief, s.ball, s.players, rng, 60, s.out);
    expect(rng.calls).toBe(0);
    expect(s.ball.owner).toBe(12);
    expect(s.out.ok).toBe(false);
  });
  it('never robs a goalkeeper and does not roll for it', () => {
    const w = world();
    const gk = at(w.players[9], 1000, 600, -1, 0);
    givePossession(w.ball, gk, 50);
    const thief = at(w.players[4], 1000 - 20, 600);
    const rng = fixedRng([0]);
    steal(thief, w.ball, w.players, rng, 60, w.out);
    expect(rng.calls).toBe(0);
    expect(w.ball.owner).toBe(9);
  });
  it('ignores a free ball and a teammate owner', () => {
    const w = world();
    const mate = at(w.players[6], 1000, 600);
    givePossession(w.ball, mate, 50);
    const thief = at(w.players[4], 1010, 600);
    const rng = fixedRng([0]);
    steal(thief, w.ball, w.players, rng, 60, w.out);
    expect(rng.calls).toBe(0);
    expect(w.ball.owner).toBe(6);
  });
});

// Runs the tackle the way stepMatch will: slide (stepPlayer), then resolve (stepTackle).
function runTackle(w: World, p: PlayerState, maxSteps: number, from = 0): number {
  for (let s = from; s < from + maxSteps; s++) {
    stepPlayer(p, 0, 0, false, false, 1, PITCH, s);
    stepTackle(p, w.ball, w.players, s, w.out);
    if (p.tackleStepsLeft === 0) return s;
  }
  return -1;
}

describe('sliding tackle: three outcomes', () => {
  it('steals a free ball it reaches and stays on its feet', () => {
    const w = world();
    const p = at(w.players[4], 1000, 600);
    w.ball.x = 1061; w.ball.y = 600;          // 61 u ahead, inside the 90 u slide
    startTackle(p, 1, 0, w.out);
    expect(w.out).toMatchObject({ kind: 'tackle', ok: false, foul: false, actorId: 4 });
    const endedAt = runTackle(w, p, TACKLE_STEPS + 5, 100);
    expect(endedAt).toBeGreaterThan(100);
    expect(endedAt).toBeLessThan(100 + TACKLE_STEPS);
    expect(w.ball.owner).toBe(4);
    expect(w.out).toMatchObject({ kind: 'tackle', ok: true, foul: false });
    expect(p.downUntilStep).toBe(0);
  });
  it('fouls a rival it touches and lies down for 1 s', () => {
    const w = world();
    const p = at(w.players[4], 1000, 600);
    const victim = at(w.players[14], 1000, 655);   // 55 u ahead, ball far away
    w.ball.x = 300; w.ball.y = 300;
    startTackle(p, 0, 1, w.out);
    const endedAt = runTackle(w, p, TACKLE_STEPS + 5, 200);
    expect(w.out).toMatchObject({ kind: 'tackle', ok: false, foul: true, actorId: 4, victimId: 14 });
    expect(w.out.x).toBe(victim.x);
    expect(w.out.y).toBe(victim.y);
    expect(p.downUntilStep).toBe(endedAt + TACKLE_MISS_DOWN_STEPS);
    expect(w.ball.owner).toBeNull();
  });
  it('reaches nothing: lies down for 1 s after TACKLE_STEPS', () => {
    const w = world();
    const p = at(w.players[4], 1000, 600);
    w.ball.x = 300; w.ball.y = 300;
    startTackle(p, 1, 0, w.out);
    const endedAt = runTackle(w, p, TACKLE_STEPS + 5, 300);
    expect(endedAt).toBe(300 + TACKLE_STEPS - 1);
    expect(w.out).toMatchObject({ kind: 'tackle', ok: false, foul: false });
    expect(p.downUntilStep).toBe(endedAt + TACKLE_MISS_DOWN_STEPS);
    expect(TACKLE_MISS_DOWN_STEPS).toBe(60);
  });
  it('from the front reaches the ball before the body: a steal, not a foul', () => {
    const w = world();
    const owner = at(w.players[12], 1090, 600, -1, 0);   // faces the tackler: ball 18 u in front of it, at 1072
    givePossession(w.ball, owner, 0);
    stickToOwner(w.ball, owner);
    const p = at(w.players[4], 1000, 600);
    startTackle(p, 1, 0, w.out);
    runTackle(w, p, TACKLE_STEPS + 5, 400);
    expect(w.ball.owner).toBe(4);
    expect(w.out.foul).toBe(false);
  });
  it('from behind touches the body first: a foul', () => {
    const w = world();
    const owner = at(w.players[12], 1050, 600, 1, 0);    // faces away: ball at 1068, body at 1050
    givePossession(w.ball, owner, 0);
    stickToOwner(w.ball, owner);
    const p = at(w.players[4], 1000, 600);
    startTackle(p, 1, 0, w.out);
    runTackle(w, p, TACKLE_STEPS + 5, 500);
    expect(w.ball.owner).toBe(12);
    expect(w.out).toMatchObject({ foul: true, victimId: 12 });
  });
  it('never robs a goalkeeper holding the ball', () => {
    const w = world();
    const gk = at(w.players[9], 1090, 600, -1, 0);
    givePossession(w.ball, gk, 0);
    stickToOwner(w.ball, gk);
    const p = at(w.players[4], 1000, 600);
    startTackle(p, 1, 0, w.out);
    runTackle(w, p, TACKLE_STEPS + 5, 600);
    expect(w.ball.owner).toBe(9);
  });
});

describe('releaseFromGoalkeeper', () => {
  it('kicks a long pass towards attackDir once GK_HOLD_STEPS have passed, and not before', () => {
    const w = world();
    const gk = at(w.players[9], 1975, 650, -1, 0);
    givePossession(w.ball, gk, 100);
    releaseFromGoalkeeper(gk, w.ball, -1, 100 + GK_HOLD_STEPS - 7, w.out);
    expect(w.ball.owner).toBe(9);
    expect(w.out.kind).toBe('none');
    releaseFromGoalkeeper(gk, w.ball, -1, 100 + GK_HOLD_STEPS, w.out);
    expect(w.ball.owner).toBeNull();
    expect(w.ball.vx).toBeCloseTo(-LONG_PASS_SPEED, 6);
    expect(w.ball.vz).toBe(LONG_PASS_VZ);
    expect(w.out.kind).toBe('gk-release');
    expect(GK_HOLD_STEPS).toBe(120);
  });
  it('does nothing for an outfield player or a keeper without the ball', () => {
    const w = world();
    const p = at(w.players[4], 500, 500);
    givePossession(w.ball, p, 0);
    releaseFromGoalkeeper(p, w.ball, 1, 500, w.out);
    expect(w.ball.owner).toBe(4);
    releaseFromGoalkeeper(w.players[0], w.ball, 1, 500, w.out);
    expect(w.ball.owner).toBe(4);
  });
});

describe('applyButtons: press/hold semantics with and without the ball', () => {
  function withBall(): World & { p: PlayerState; input: TeamInput } {
    const w = world();
    const p = at(w.players[5], 900, 700);
    givePossession(w.ball, p, 0);
    return { ...w, p, input: createTeamInput() };
  }
  it('holding A for 40 steps then releasing shoots at shotSpeed(40) in the d-pad direction', () => {
    const s = withBall();
    const rng = fixedRng([0.5]);
    s.input.dx = 0; s.input.dy = -1;
    s.input.a = 'pressed';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 0, s.aim, s.out);
    s.input.a = 'held';
    for (let step = 1; step < 40; step++) applyButtons(s.p, s.input, s.ball, s.players, rng, step, s.aim, s.out);
    expect(s.ball.owner).toBe(5);
    expect(s.p.chargeSteps).toBe(40);
    s.input.a = 'released';
    applyButtons(s.p, s.input, s.ball, s.players, rng, 40, s.aim, s.out);
    expect(s.out.kind).toBe('shot');
    expect(speedOf(s.ball)).toBeCloseTo(shotSpeed(40), 6);
    expect(s.ball.vy).toBeLessThan(0);
    expect(s.ball.vx).toBeCloseTo(0, 10);
    expect(s.p.chargeSteps).toBe(0);
    expect(rng.calls).toBe(0);
  });
  it('a tap of B is a short pass along the facing when the d-pad is idle', () => {
    const s = withBall();
    s.input.b = 'pressed';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), 0, s.aim, s.out);
    s.input.b = 'released';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), 1, s.aim, s.out);
    expect(s.out.kind).toBe('short-pass');
    expect(s.ball.vx).toBeCloseTo(SHORT_PASS_SPEED, 6);
  });
  it('holding B for LONG_PASS_HOLD_STEPS + 3 is a long pass', () => {
    const s = withBall();
    s.input.b = 'pressed';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), 0, s.aim, s.out);
    s.input.b = 'held';
    for (let step = 1; step < LONG_PASS_HOLD_STEPS + 3; step++) applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), step, s.aim, s.out);
    s.input.b = 'released';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), LONG_PASS_HOLD_STEPS + 3, s.aim, s.out);
    expect(s.out.kind).toBe('long-pass');
    expect(s.ball.vz).toBe(LONG_PASS_VZ);
  });
  it('without the ball, A starts a tackle and B tries a steal', () => {
    const w = world();
    const owner = at(w.players[12], 1000, 600, -1, 0);
    givePossession(w.ball, owner, 0);
    stickToOwner(w.ball, owner);
    const p = at(w.players[4], 980, 600);
    const input = createTeamInput();
    input.b = 'pressed';
    const rng = fixedRng([0.9]);
    applyButtons(p, input, w.ball, w.players, rng, 10, w.aim, w.out);
    expect(rng.calls).toBe(1);
    expect(w.out.kind).toBe('steal');
    input.b = 'up'; input.a = 'pressed';
    applyButtons(p, input, w.ball, w.players, rng, 11, w.aim, w.out);
    expect(w.out.kind).toBe('tackle');
    expect(p.tackleStepsLeft).toBe(TACKLE_STEPS);
  });
  it('a player on the ground or mid-tackle does nothing and drops any charge', () => {
    const s = withBall();
    s.p.chargeSteps = 20; s.p.chargeButton = 'a';
    s.p.downUntilStep = 90;
    s.input.a = 'released';
    applyButtons(s.p, s.input, s.ball, s.players, fixedRng([0.5]), 30, s.aim, s.out);
    expect(s.out.kind).toBe('none');
    expect(s.ball.owner).toBe(5);
    expect(s.p.chargeSteps).toBe(0);
  });
});

describe('updateControlled: the derived controlled player (criteria 4 and 5)', () => {
  it('is the ball owner when an outfield player of the team has the ball', () => {
    const w = world();
    givePossession(w.ball, at(w.players[7], 500, 500), 0);
    const controlled: [number, number] = [-1, -1];
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(7);
  });
  it('is never the goalkeeper, even when the keeper holds the ball or is the nearest', () => {
    const w = world();
    givePossession(w.ball, at(w.players[0], 30, 650), 0);
    at(w.players[3], 300, 650);
    const controlled: [number, number] = [-1, -1];
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(3);
    // team 1: the keeper is 10 u from the ball, an outfield player 200 u away
    at(w.players[9], 40, 650);
    at(w.players[11], 240, 650);
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[1]).toBe(11);
  });
  it('picks the nearest outfield player with the lowest id breaking exact ties', () => {
    const w = world();
    w.ball.x = 1000; w.ball.y = 600;
    at(w.players[8], 1000, 600 - 70);   // id 8, 70 u
    at(w.players[2], 1000 + 70, 600);   // id 2, 70 u
    at(w.players[5], 1000, 600 + 130);  // farther
    const controlled: [number, number] = [-1, -1];
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(2);
  });
  it('keeps the current one when a teammate is only 30 u closer (hysteresis)', () => {
    const w = world();
    w.ball.x = 1000; w.ball.y = 600;
    at(w.players[6], 1000 + 100, 600);   // current, 100 u
    at(w.players[3], 1000 - 70, 600);    // 70 u: 30 closer, below CONTROL_HYSTERESIS
    const controlled: [number, number] = [6, -1];
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(6);
  });
  it('switches when a teammate is 41 u closer', () => {
    const w = world();
    w.ball.x = 1000; w.ball.y = 600;
    at(w.players[6], 1000 + 100, 600);
    at(w.players[3], 1000 - 59, 600);    // 41 closer
    const controlled: [number, number] = [6, -1];
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(3);
    expect(CONTROL_HYSTERESIS).toBe(40);
  });
  it('ignores hysteresis when the current controlled id is not a valid outfield player of the team', () => {
    const w = world();
    w.ball.x = 1000; w.ball.y = 600;
    at(w.players[3], 1000 - 300, 600);
    const controlled: [number, number] = [0, 9];    // both keepers: never valid as controlled
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(3);
    expect(w.players[controlled[1]].team).toBe(1);
    expect(w.players[controlled[1]].role).not.toBe('gk');
  });
  it('a rival owner does not become our controlled: our nearest does', () => {
    const w = world();
    givePossession(w.ball, at(w.players[12], 1000, 600), 0);
    at(w.players[4], 1000 - 90, 600);
    const controlled: [number, number] = [-1, -1];
    updateControlled(w.players, w.ball, controlled);
    expect(controlled[0]).toBe(4);
    expect(controlled[1]).toBe(12);
  });
});
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx vitest run components/games/football-logic/actions.test.ts`
Expected: FAIL — no existe `actions.ts`.

- [ ] **Step 3: Implementación mínima**

```ts
// components/games/football-logic/actions.ts
import { dist, normalizeInto, type Vec2 } from './geometry';
import { isDown, type TeamInput } from './input';
import { PLAYER_HEIGHT, PLAYER_RADIUS, TACKLE_STEPS, isPlayerDown, isSprinting, type PlayerState } from './players';
import { LONG_PASS_VZ, givePossession, kickBall, type BallState } from './ball';
import { stepsFor } from './step';
import type { Rng } from './rng';

export type ActionKind = 'none' | 'shot' | 'short-pass' | 'long-pass' | 'steal' | 'tackle' | 'gk-release';

export type ActionEvent = {
  kind: ActionKind;
  ok: boolean;
  foul: boolean;
  actorId: number;
  victimId: number;
  x: number;
  y: number;
};

export const SHOT_SPEED_MIN = 700;
export const SHOT_SPEED_MAX = 950;
export const SHOT_CHARGE_SECONDS = 1;
export const SHOT_CHARGE_STEPS = stepsFor(SHOT_CHARGE_SECONDS);
export const SHOT_VZ_MAX = 200;
export const SHORT_PASS_SPEED = 420;
export const LONG_PASS_SPEED = 560;
export const LONG_PASS_HOLD_SECONDS = 0.25;
export const LONG_PASS_HOLD_STEPS = stepsFor(LONG_PASS_HOLD_SECONDS);
export const STEAL_RANGE = 28;
export const STEAL_CHANCE = 0.65;
export const STEAL_CHANCE_VS_SPRINT = 0.35;
export const TACKLE_BALL_REACH = 20;
export const TACKLE_FOUL_RADIUS = 2 * PLAYER_RADIUS;
export const TACKLE_MISS_DOWN_SECONDS = 1;
export const TACKLE_MISS_DOWN_STEPS = stepsFor(TACKLE_MISS_DOWN_SECONDS);
export const CONTROL_HYSTERESIS = 40;
export const GK_HOLD_SECONDS = 2;
export const GK_HOLD_STEPS = stepsFor(GK_HOLD_SECONDS);

export function createActionEvent(): ActionEvent {
  return { kind: 'none', ok: false, foul: false, actorId: -1, victimId: -1, x: 0, y: 0 };
}

export function clearActionEvent(out: ActionEvent): void {
  out.kind = 'none';
  out.ok = false;
  out.foul = false;
  out.actorId = -1;
  out.victimId = -1;
  out.x = 0;
  out.y = 0;
}

function setEvent(out: ActionEvent, kind: ActionKind, ok: boolean, actorId: number): void {
  out.kind = kind;
  out.ok = ok;
  out.foul = false;
  out.actorId = actorId;
  out.victimId = -1;
  out.x = 0;
  out.y = 0;
}

export function shotSpeed(chargeSteps: number): number {
  const t = chargeSteps >= SHOT_CHARGE_STEPS ? 1 : chargeSteps <= 0 ? 0 : chargeSteps / SHOT_CHARGE_STEPS;
  return SHOT_SPEED_MIN + (SHOT_SPEED_MAX - SHOT_SPEED_MIN) * t;
}

export function shoot(p: PlayerState, ball: BallState, dirX: number, dirY: number, chargeSteps: number, stepCount: number, out: ActionEvent): void {
  const t = chargeSteps >= SHOT_CHARGE_STEPS ? 1 : chargeSteps / SHOT_CHARGE_STEPS;
  kickBall(ball, p, dirX, dirY, shotSpeed(chargeSteps), SHOT_VZ_MAX * t, stepCount);
  setEvent(out, 'shot', true, p.id);
}

export function shortPass(p: PlayerState, ball: BallState, dirX: number, dirY: number, stepCount: number, out: ActionEvent): void {
  kickBall(ball, p, dirX, dirY, SHORT_PASS_SPEED, 0, stepCount);
  setEvent(out, 'short-pass', true, p.id);
}

export function longPass(p: PlayerState, ball: BallState, dirX: number, dirY: number, stepCount: number, out: ActionEvent): void {
  kickBall(ball, p, dirX, dirY, LONG_PASS_SPEED, LONG_PASS_VZ, stepCount);
  setEvent(out, 'long-pass', true, p.id);
}

// Rolls the rng ONLY when a steal is actually possible: the number of draws is
// part of the deterministic state, so an impossible steal must not consume one.
export function steal(p: PlayerState, ball: BallState, players: readonly PlayerState[], rng: Rng, stepCount: number, out: ActionEvent): void {
  setEvent(out, 'steal', false, p.id);
  if (ball.owner === null) return;
  const owner = players[ball.owner];
  if (owner.team === p.team || owner.role === 'gk') return;
  if (dist(p.x, p.y, owner.x, owner.y) >= STEAL_RANGE) return;
  out.victimId = owner.id;
  const chance = isSprinting(owner) ? STEAL_CHANCE_VS_SPRINT : STEAL_CHANCE;
  if (rng() < chance) {
    givePossession(ball, p, stepCount);
    out.ok = true;
  }
}

export function startTackle(p: PlayerState, dirX: number, dirY: number, out: ActionEvent): void {
  p.tackleStepsLeft = TACKLE_STEPS;
  p.tackleDirX = dirX;
  p.tackleDirY = dirY;
  p.chargeSteps = 0;
  p.chargeButton = 'none';
  setEvent(out, 'tackle', false, p.id);
}

function ballIsTakeable(ball: BallState, p: PlayerState, players: readonly PlayerState[]): boolean {
  if (ball.z > PLAYER_HEIGHT) return false;
  if (ball.owner === null) return true;
  const owner = players[ball.owner];
  return owner.team !== p.team && owner.role !== 'gk';
}

// Called every step AFTER the slide (stepPlayer) for any player with tackleStepsLeft > 0.
// Ball before body: sliding in from the front steals, sliding in from behind fouls.
export function stepTackle(p: PlayerState, ball: BallState, players: readonly PlayerState[], stepCount: number, out: ActionEvent): void {
  if (p.tackleStepsLeft <= 0) return;
  setEvent(out, 'tackle', false, p.id);
  if (ballIsTakeable(ball, p, players) && dist(p.x, p.y, ball.x, ball.y) < TACKLE_BALL_REACH) {
    givePossession(ball, p, stepCount);
    p.tackleStepsLeft = 0;
    out.ok = true;
    return;
  }
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.team === p.team || isPlayerDown(q, stepCount)) continue;
    if (dist(p.x, p.y, q.x, q.y) < TACKLE_FOUL_RADIUS) {
      p.tackleStepsLeft = 0;
      p.downUntilStep = stepCount + TACKLE_MISS_DOWN_STEPS;
      out.foul = true;
      out.victimId = q.id;
      out.x = q.x;
      out.y = q.y;
      return;
    }
  }
  p.tackleStepsLeft--;
  if (p.tackleStepsLeft === 0) p.downUntilStep = stepCount + TACKLE_MISS_DOWN_STEPS;
}

// Spec goalkeeper rule 4, direction only for now: Task 6 aims at the freest teammate.
export function releaseFromGoalkeeper(gk: PlayerState, ball: BallState, attackDir: 1 | -1, stepCount: number, out: ActionEvent): void {
  if (gk.role !== 'gk' || ball.owner !== gk.id) {
    clearActionEvent(out);
    return;
  }
  if (stepCount - ball.ownerSinceStep < GK_HOLD_STEPS) {
    clearActionEvent(out);
    return;
  }
  gk.facingX = attackDir;
  gk.facingY = 0;
  kickBall(ball, gk, attackDir, 0, LONG_PASS_SPEED, LONG_PASS_VZ, stepCount);
  setEvent(out, 'gk-release', true, gk.id);
}

function resetCharge(p: PlayerState): void {
  p.chargeSteps = 0;
  p.chargeButton = 'none';
}

// The three buttons with press/hold, for the controlled player of one team.
// `aim` is a scratch Vec2 owned by the caller: d-pad direction if any, else the facing.
export function applyButtons(p: PlayerState, input: TeamInput, ball: BallState, players: readonly PlayerState[], rng: Rng, stepCount: number, aim: Vec2, out: ActionEvent): void {
  clearActionEvent(out);
  if (isPlayerDown(p, stepCount) || p.tackleStepsLeft > 0) {
    resetCharge(p);
    return;
  }
  if (!normalizeInto(aim, input.dx, input.dy)) {
    aim.x = p.facingX;
    aim.y = p.facingY;
  }
  if (ball.owner === p.id) {
    if (isDown(input.a)) {
      if (p.chargeButton !== 'a') {
        p.chargeButton = 'a';
        p.chargeSteps = 0;
      }
      if (p.chargeSteps < SHOT_CHARGE_STEPS) p.chargeSteps++;
      return;
    }
    if (input.a === 'released' && p.chargeButton === 'a') {
      shoot(p, ball, aim.x, aim.y, p.chargeSteps, stepCount, out);
      resetCharge(p);
      return;
    }
    if (isDown(input.b)) {
      if (p.chargeButton !== 'b') {
        p.chargeButton = 'b';
        p.chargeSteps = 0;
      }
      if (p.chargeSteps < SHOT_CHARGE_STEPS) p.chargeSteps++;
      return;
    }
    if (input.b === 'released' && p.chargeButton === 'b') {
      if (p.chargeSteps >= LONG_PASS_HOLD_STEPS) longPass(p, ball, aim.x, aim.y, stepCount, out);
      else shortPass(p, ball, aim.x, aim.y, stepCount, out);
      resetCharge(p);
      return;
    }
    return;
  }
  resetCharge(p);
  if (input.a === 'pressed') {
    startTackle(p, aim.x, aim.y, out);
    return;
  }
  if (input.b === 'pressed') steal(p, ball, players, rng, stepCount, out);
}

function isControllable(p: PlayerState, team: 0 | 1): boolean {
  return p.team === team && p.role !== 'gk';
}

// Derived, never an input (spec): owner if an outfield player of the team has the
// ball; else the nearest outfield player (never the keeper), lowest id on ties,
// with CONTROL_HYSTERESIS so it does not flicker. Writes into `controlled`.
export function updateControlled(players: readonly PlayerState[], ball: BallState, controlled: [number, number]): void {
  for (let team = 0 as 0 | 1; team <= 1; team = (team + 1) as 0 | 1) {
    if (ball.owner !== null && isControllable(players[ball.owner], team)) {
      controlled[team] = ball.owner;
      continue;
    }
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!isControllable(p, team)) continue;
      const d = dist(p.x, p.y, ball.x, ball.y);
      if (d < bestDist) {
        bestDist = d;
        best = p.id;
      }
    }
    const current = controlled[team];
    const currentValid = current >= 0 && current < players.length && isControllable(players[current], team);
    if (currentValid) {
      const currentDist = dist(players[current].x, players[current].y, ball.x, ball.y);
      if (bestDist > currentDist - CONTROL_HYSTERESIS) continue;
    }
    controlled[team] = best;
  }
}
```

> El bucle `for (let team = 0 as 0 | 1; ...)` se puede escribir como dos llamadas a una función interna `updateTeam(players, ball, controlled, 0)` y `(…, 1)` si el `as` molesta; lo que no cambia es que **no** se asigna nada por paso.

- [ ] **Step 4: Verde**

Run: `npx vitest run` → todo verde (unos 32 tests nuevos). `npx tsc --noEmit` limpio. `grep` de determinismo vacío. Comprobar que en `actions.ts` no hay `filter`/`map`/spread/`new`/literales de objeto fuera de `createActionEvent`.

- [ ] **Step 5: Verificar y proponer commit**

Exportaciones con destino declarado: `applyButtons`, `stepTackle`, `releaseFromGoalkeeper`, `updateControlled`, `createActionEvent` → Task 5 (`stepMatch`); `shortPass`, `longPass`, `shoot`, `SHORT_PASS_SPEED`, `LONG_PASS_SPEED` → Task 4 (`stepSetPiece`); `SHOT_CHARGE_STEPS`, `STEAL_RANGE`, `TACKLE_BALL_REACH` → Task 6 (árbol de la CPU).

Mensaje propuesto: `feat(world-cup): shots, passes, steals, sliding tackles and the derived controlled player`

---

## Task 4: `referee.ts` y `set-pieces.ts` — las reglas y los saques

**Files:**
- Create: `components/games/football-logic/referee.ts`
- Create: `components/games/football-logic/set-pieces.ts`
- Test: `components/games/football-logic/referee.test.ts`
- Test: `components/games/football-logic/set-pieces.test.ts`

**Interfaces:**
- Consumes: `PitchDef`, `Side`, `centerY`, `goalLineX`, `isBetweenPosts`, `isInsideBigArea`, `penaltySpotX`, `clampToBigArea` (Task 1); `Formation`, `Strategy`, `TEAM_SIZE` (Task 1); `clamp`, `dist`, `normalizeInto`, `Vec2` (Task 2); `TeamInput` (Task 2); `PlayerState`, `placeByFormation`, `ownGoalSide`, `GK_LINE_DIST` (Task 2); `BallState`, `CONTROL_DIST`, `givePossession`, `stickToOwner` (Task 2); `AttackDirs`, `stepsFor` (Task 2); `Rng` (Task 1); `ActionEvent`, `shoot`, `shortPass`, `longPass`, `shotSpeed` (Task 3).
- Produces:

```ts
// referee.ts
export type SetPieceKind = 'kickoff' | 'throw-in' | 'corner' | 'goal-kick' | 'free-kick' | 'penalty';
export type CallKind = 'none' | 'goal' | 'throw-in' | 'corner' | 'goal-kick' | 'free-kick' | 'penalty';
export type RefereeCall = { kind: CallKind; team: 0 | 1; x: number; y: number };   // team: quien marca / quien saca
export function createRefereeCall(): RefereeCall;
export function clearRefereeCall(out: RefereeCall): void;
export function teamAttackingSide(attackDir: AttackDirs, side: Side): 0 | 1;   // el equipo que chuta hacia `side`
export function teamDefendingSide(attackDir: AttackDirs, side: Side): 0 | 1;   // el equipo cuya portería está en `side`
export function judgeBall(ball: BallState, attackDir: AttackDirs, pitch: PitchDef, out: RefereeCall): void;
export function judgeFoul(x: number, y: number, victimTeam: 0 | 1, attackDir: AttackDirs, pitch: PitchDef, out: RefereeCall): void;

// set-pieces.ts
export type PenaltySide = -1 | 0 | 1;
export type SetPieceState = {
  kind: SetPieceKind; team: 0 | 1;
  x: number; y: number;               // el punto del saque (donde está el balón)
  dirX: number; dirY: number;         // la última dirección no nula elegida con la cruceta (unitaria)
  side: PenaltySide;                  // solo penalti: lado elegido con dy
  stepsLeft: number;                  // cuenta atrás en pasos
  takerId: number;
};
export const SET_PIECE_COUNTDOWN_SECONDS = 5;
export const SET_PIECE_COUNTDOWN_STEPS: number;   // 300
export const SET_PIECE_CLEARANCE = 180;           // los rivales se apartan a esta distancia del balón
export const PENALTY_SIDE_OFFSET = 55;            // el lanzador apunta a centerY ± 55 (postes a ±75)
export const FREE_KICK_CHARGE_STEPS: number;      // stepsFor(0.4) = 24 → shotSpeed = 800
export const PENALTY_CHARGE_STEPS: number;        // stepsFor(0.6) = 36 → shotSpeed = 850
export function createSetPieceState(): SetPieceState;
export function beginSetPiece(
  sp: SetPieceState, kind: SetPieceKind, team: 0 | 1, x: number, y: number,
  players: PlayerState[], ball: BallState,
  formations: readonly [Formation, Formation], strategies: readonly [Strategy, Strategy],
  attackDir: AttackDirs, pitch: PitchDef, stepCount: number,
): void;
export function stepSetPiece(
  sp: SetPieceState, input: TeamInput, players: PlayerState[], ball: BallState,
  rng: Rng, penaltyReadChance: number, attackDir: AttackDirs, pitch: PitchDef, stepCount: number,
  aim: Vec2, out: ActionEvent,
): boolean;   // true el paso en que se ejecuta el saque
```

Reglas fijadas aquí:
- **Gol**: el balón cruza una línea de fondo (`x < 0` o `x > width`) **entre los postes** y con `z < crossbarHeight`. Se juzga **con o sin poseedor** (entrar andando con el balón es gol). Marca el equipo que ataca hacia ese lado.
- **Fuera**: solo se juzga con **balón libre** (un poseedor pegado a la banda no provoca saque). Por la línea de fondo, sin ser gol: si el **último toque** fue del equipo que defiende ese lado → **córner** del otro, en la esquina del lado y de la mitad (`y < centerY` → `y = 0`, si no `y = height`); si no → **saque de puerta** del que defiende, en el borde del área pequeña a la altura del centro. Por la banda → **saque de banda** del equipo que **no** tocó último, en `(clamp(x), 0 | height)`. Sin último toque (imposible tras un saque inicial) → equipo 0.
- **Falta** (`judgeFoul`): si el punto está **dentro del área grande propia del infractor** → **penalti** para la víctima en el punto de penalti de ese lado; si no → **tiro libre** para la víctima en el punto de la falta.
- **Saque**: `kickoff` y `penalty` **recolocan a los dos equipos por formación**; los demás solo **apartan** a los rivales a `SET_PIECE_CLEARANCE` del balón (empujados en línea recta desde el balón; el portero rival además recortado a su área). El **lanzador** es el jugador de campo del equipo más cercano al punto (id más bajo a igual distancia). El balón queda **exactamente en `(x, y)`**, en posesión del lanzador, que se coloca `CONTROL_DIST` por detrás mirando en la dirección por defecto: **hacia el centro de la portería rival** (en el saque inicial, `(attackDir, 0)`).
- **Cruceta**: cada paso con `dx`/`dy` no nulo actualiza la dirección (normalizada, 8 direcciones) y recoloca al lanzador detrás del balón; con la cruceta en reposo **se conserva la última**. En el penalti la cruceta solo elige **lado** con `dy` (`-1` arriba, `0` centro, `1` abajo); la dirección la fija el motor hacia `centerY + side · PENALTY_SIDE_OFFSET`.
- **Ejecución** al llegar la cuenta a cero, sin intervención: `kickoff`/`throw-in` → pase corto; `goal-kick`/`corner` → pase largo; `free-kick` → chut con `FREE_KICK_CHARGE_STEPS`; `penalty` → chut con `PENALTY_CHARGE_STEPS` y el portero rival **se tira**: con probabilidad `penaltyReadChance` (**parámetro**, no perfil: `ai.ts` es la etapa B) adivina el lado del lanzador; si no, elige con un segundo `rng()` uno de los otros dos lados (el menor si `rng() < 0.5`). Si adivina, **ataja** (posesión del portero, `out.ok = false`); si no, el balón vuela y el árbitro decide el gol en el paso siguiente. Cada penalti consume **uno o dos** `rng()`, siempre en ese orden.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// components/games/football-logic/referee.test.ts
import { describe, expect, it } from 'vitest';
import { PITCH, centerY, penaltySpotX } from './pitch';
import { createBall, type BallState } from './ball';
import type { AttackDirs } from './step';
import { createRefereeCall, judgeBall, judgeFoul, teamAttackingSide, teamDefendingSide, type RefereeCall } from './referee';

const FIRST_HALF: AttackDirs = [1, -1];   // team 0 shoots at side 1, defends side 0
const SECOND_HALF: AttackDirs = [-1, 1];
const CY = centerY(PITCH);

function ball(over: Partial<BallState>): BallState {
  return { ...createBall(), ...over };
}

function judge(b: BallState, attackDir: AttackDirs = FIRST_HALF): RefereeCall {
  const out = createRefereeCall();
  judgeBall(b, attackDir, PITCH, out);
  return out;
}

describe('sides', () => {
  it('teamAttackingSide / teamDefendingSide follow attackDir, and flip in the second half', () => {
    expect(teamAttackingSide(FIRST_HALF, 1)).toBe(0);
    expect(teamAttackingSide(FIRST_HALF, 0)).toBe(1);
    expect(teamDefendingSide(FIRST_HALF, 0)).toBe(0);
    expect(teamDefendingSide(SECOND_HALF, 0)).toBe(1);
  });
});

describe('goal', () => {
  it('a ball past the goal line, between the posts and under the bar is a goal for the attacking team', () => {
    const c = judge(ball({ x: -3, y: CY + 40, z: 20, lastTouchTeam: 1 }));
    expect(c).toMatchObject({ kind: 'goal', team: 1, x: 0 });
    const d = judge(ball({ x: PITCH.width + 7, y: CY - 33, z: 0, lastTouchTeam: 0 }));
    expect(d).toMatchObject({ kind: 'goal', team: 0, x: PITCH.width });
  });
  it('in the second half the same line scores for the other team', () => {
    expect(judge(ball({ x: -3, y: CY + 40, z: 20 }), SECOND_HALF).team).toBe(0);
  });
  it('over the crossbar is not a goal (it is a goal kick if the attacker touched it last)', () => {
    const c = judge(ball({ x: -3, y: CY, z: PITCH.crossbarHeight + 10, lastTouchTeam: 1 }));
    expect(c.kind).toBe('goal-kick');
  });
  it('wide of the posts is not a goal', () => {
    const c = judge(ball({ x: -3, y: CY + PITCH.goalWidth / 2 + 5, lastTouchTeam: 1 }));
    expect(c.kind).toBe('goal-kick');
  });
  it('a player carrying the ball across the line scores too', () => {
    const c = judge(ball({ x: PITCH.width + 4, y: CY - 10, z: 0, owner: 5, lastTouchTeam: 0 }));
    expect(c).toMatchObject({ kind: 'goal', team: 0 });
  });
  it('a ball still on the pitch is nothing', () => {
    expect(judge(ball({ x: 12, y: CY })).kind).toBe('none');
    expect(judge(ball({ x: PITCH.width - 1, y: 7 })).kind).toBe('none');
  });
});

describe('out of play', () => {
  it('over the end line, last touched by the defender: corner for the attacker at the near corner', () => {
    // side 0 is defended by team 0 in the first half
    const low = judge(ball({ x: -2, y: CY + 300, lastTouchTeam: 0 }));
    expect(low).toMatchObject({ kind: 'corner', team: 1, x: 0, y: PITCH.height });
    const high = judge(ball({ x: -2, y: CY - 300, lastTouchTeam: 0 }));
    expect(high).toMatchObject({ kind: 'corner', team: 1, x: 0, y: 0 });
  });
  it('over the end line, last touched by the attacker: goal kick for the defender at the small area edge', () => {
    const c = judge(ball({ x: PITCH.width + 2, y: 200, lastTouchTeam: 0 }));
    expect(c).toMatchObject({ kind: 'goal-kick', team: 1, x: PITCH.width - PITCH.smallAreaDepth, y: CY });
    const d = judge(ball({ x: -2, y: 200, lastTouchTeam: 1 }));
    expect(d).toMatchObject({ kind: 'goal-kick', team: 0, x: PITCH.smallAreaDepth, y: CY });
  });
  it('over a touch line: throw-in for the team that did not touch it last, at the crossing point', () => {
    const c = judge(ball({ x: 700, y: -2, lastTouchTeam: 0 }));
    expect(c).toMatchObject({ kind: 'throw-in', team: 1, x: 700, y: 0 });
    const d = judge(ball({ x: 1450, y: PITCH.height + 9, lastTouchTeam: 1 }));
    expect(d).toMatchObject({ kind: 'throw-in', team: 0, x: 1450, y: PITCH.height });
  });
  it('a carried ball beyond a touch line is not out (only free balls go out)', () => {
    expect(judge(ball({ x: 700, y: -5, owner: 3, lastTouchTeam: 0 })).kind).toBe('none');
  });
  it('a throw-in far past a corner clamps x into the pitch', () => {
    const c = judge(ball({ x: -30, y: -2, lastTouchTeam: 1 }));
    // x < 0 counts as the end line first: this one is a corner/goal kick, not a throw-in
    expect(['corner', 'goal-kick']).toContain(c.kind);
    const d = judge(ball({ x: 2000, y: PITCH.height + 1, lastTouchTeam: 1 }));
    expect(d).toMatchObject({ kind: 'throw-in', x: PITCH.width });
  });
});

describe('fouls', () => {
  function foul(x: number, y: number, victim: 0 | 1, attackDir: AttackDirs = FIRST_HALF): RefereeCall {
    const out = createRefereeCall();
    judgeFoul(x, y, victim, attackDir, PITCH, out);
    return out;
  }
  it('inside the offender own big area: penalty for the victim at the spot', () => {
    // team 1 defends side 1 in the first half; its box starts at width - 320 = 1680
    const c = foul(1900, CY + 60, 0);
    expect(c).toMatchObject({ kind: 'penalty', team: 0, x: penaltySpotX(PITCH, 1), y: CY });
    const d = foul(140, CY - 200, 1);
    expect(d).toMatchObject({ kind: 'penalty', team: 1, x: penaltySpotX(PITCH, 0), y: CY });
  });
  it('outside the box: free kick for the victim where it happened', () => {
    expect(foul(1500, CY, 0)).toMatchObject({ kind: 'free-kick', team: 0, x: 1500, y: CY });
    expect(foul(1900, 100, 0)).toMatchObject({ kind: 'free-kick', team: 0, x: 1900, y: 100 });   // deep but too wide
  });
  it('the box moves with attackDir in the second half', () => {
    expect(foul(1900, CY + 60, 0, SECOND_HALF).kind).toBe('free-kick');
    expect(foul(140, CY, 0, SECOND_HALF).kind).toBe('penalty');
  });
});
```

```ts
// components/games/football-logic/set-pieces.test.ts
import { describe, expect, it } from 'vitest';
import { PITCH, centerY, goalLineX, isInsideBigArea } from './pitch';
import { FORMATIONS, TEAM_SIZE, type Formation, type Strategy } from './teams';
import { createTeamInput, type TeamInput } from './input';
import { GK_LINE_DIST, createPlayers, type PlayerState } from './players';
import { CONTROL_DIST, LONG_PASS_VZ, createBall, type BallState } from './ball';
import { createRng, type Rng } from './rng';
import type { AttackDirs } from './step';
import { LONG_PASS_SPEED, SHORT_PASS_SPEED, createActionEvent, shotSpeed, type ActionEvent } from './actions';
import {
  FREE_KICK_CHARGE_STEPS, PENALTY_CHARGE_STEPS, PENALTY_SIDE_OFFSET, SET_PIECE_CLEARANCE, SET_PIECE_COUNTDOWN_STEPS,
  beginSetPiece, createSetPieceState, stepSetPiece, type SetPieceState,
} from './set-pieces';
import type { SetPieceKind } from './referee';

const F = FORMATIONS[0];
const FORMS: readonly [Formation, Formation] = [F, F];
const STRATS: readonly [Strategy, Strategy] = ['neutral', 'neutral'];
const ATTACK: AttackDirs = [1, -1];
const CY = centerY(PITCH);

type W = { players: PlayerState[]; ball: BallState; sp: SetPieceState; input: TeamInput; aim: { x: number; y: number }; out: ActionEvent };

function world(): W {
  return {
    players: createPlayers(FORMS, PITCH), ball: createBall(), sp: createSetPieceState(),
    input: createTeamInput(), aim: { x: 0, y: 0 }, out: createActionEvent(),
  };
}

function begin(w: W, kind: SetPieceKind, team: 0 | 1, x: number, y: number, step = 0): void {
  beginSetPiece(w.sp, kind, team, x, y, w.players, w.ball, FORMS, STRATS, ATTACK, PITCH, step);
}

function fixedRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

// Runs `n` steps of the set piece with the given input; returns the step at which it executed or -1.
function run(w: W, n: number, rng: Rng = createRng(1), readChance = 0.6, from = 1): number {
  for (let s = from; s < from + n; s++) {
    if (stepSetPiece(w.sp, w.input, w.players, w.ball, rng, readChance, ATTACK, PITCH, s, w.aim, w.out)) return s;
  }
  return -1;
}

function speedOf(b: BallState): number {
  return Math.sqrt(b.vx * b.vx + b.vy * b.vy);
}

describe('beginSetPiece', () => {
  it('kickoff: everyone by formation, the nearest outfield player of the team takes it from the centre facing attackDir', () => {
    const w = world();
    w.players[3].x = 1700;   // moved away: kickoff must reset it
    begin(w, 'kickoff', 0, 1000, CY);
    expect(w.players[3].x).toBe(F.slots[2].x * PITCH.width);
    expect(w.sp).toMatchObject({ kind: 'kickoff', team: 0, x: 1000, y: CY, dirX: 1, dirY: 0, stepsLeft: SET_PIECE_COUNTDOWN_STEPS });
    expect(w.sp.takerId).toBe(5);   // slot 4 (centre mid at 900, 650) is the closest to the spot
    expect(w.ball.owner).toBe(5);
    expect(w.ball.x).toBeCloseTo(1000, 10);
    expect(w.ball.y).toBeCloseTo(CY, 10);
    expect(w.players[5].x).toBeCloseTo(1000 - CONTROL_DIST, 10);
    expect(SET_PIECE_COUNTDOWN_STEPS).toBe(300);
  });
  it('team 1 kicks off facing -x', () => {
    const w = world();
    begin(w, 'kickoff', 1, 1000, CY);
    expect(w.sp.dirX).toBe(-1);
    expect(w.players[w.sp.takerId].team).toBe(1);
    expect(w.players[w.sp.takerId].x).toBeCloseTo(1000 + CONTROL_DIST, 10);
  });
  it('corner: default direction points at the rival goal centre, rivals pushed to SET_PIECE_CLEARANCE, keeper still in its box', () => {
    const w = world();
    // a rival 100 u from the corner spot and the rival keeper close to its line
    w.players[12].x = 1930; w.players[12].y = 70;
    begin(w, 'corner', 0, PITCH.width, 0);
    const d12 = Math.sqrt((w.players[12].x - PITCH.width) ** 2 + (w.players[12].y - 0) ** 2);
    expect(d12).toBeGreaterThanOrEqual(SET_PIECE_CLEARANCE - 1e-6);
    expect(isInsideBigArea(PITCH, 1, w.players[9].x, w.players[9].y)).toBe(true);
    // direction from (2000, 0) towards (2000, 650) is straight down
    expect(w.sp.dirX).toBeCloseTo(0, 10);
    expect(w.sp.dirY).toBeCloseTo(1, 10);
    expect(w.players[w.sp.takerId].team).toBe(0);
    expect(w.players[w.sp.takerId].role).not.toBe('gk');
  });
  it('throw-in / free kick do not reset the formation', () => {
    const w = world();
    w.players[3].x = 1500; w.players[3].y = 900;
    begin(w, 'throw-in', 1, 700, 0);
    expect(w.players[3].x).toBe(1500);
    begin(w, 'free-kick', 0, 1200, 400);
    expect(w.players[3].y).toBe(900);
  });
});

describe('direction and countdown', () => {
  it('keeps the last non-null d-pad direction and moves the taker behind the ball', () => {
    const w = world();
    begin(w, 'kickoff', 0, 1000, CY);
    w.input.dx = 0; w.input.dy = 1;
    run(w, 1);
    expect(w.sp.dirY).toBe(1);
    w.input.dx = 0; w.input.dy = 0;
    run(w, 100, createRng(1), 0.6, 2);
    expect(w.sp.dirX).toBe(0);
    expect(w.sp.dirY).toBe(1);
    expect(w.players[5].y).toBeCloseTo(CY - CONTROL_DIST, 10);
    expect(w.ball.y).toBeCloseTo(CY, 10);
    w.input.dx = -1; w.input.dy = -1;
    run(w, 1, createRng(1), 0.6, 102);
    expect(w.sp.dirX).toBeCloseTo(-Math.SQRT1_2, 10);
    expect(w.sp.dirY).toBeCloseTo(-Math.SQRT1_2, 10);
  });
  it('executes exactly when the 300-step countdown reaches zero (sampled at 250, 299, 300)', () => {
    const w = world();
    begin(w, 'kickoff', 0, 1000, CY);
    expect(run(w, 250)).toBe(-1);
    expect(w.sp.stepsLeft).toBe(50);
    expect(run(w, 49, createRng(1), 0.6, 251)).toBe(-1);
    expect(w.ball.owner).toBe(5);
    expect(run(w, 1, createRng(1), 0.6, 300)).toBe(300);
    expect(w.ball.owner).toBeNull();
  });
});

describe('automatic execution by kind', () => {
  it('kickoff and throw-in are short passes in the chosen direction', () => {
    const w = world();
    begin(w, 'kickoff', 0, 1000, CY);
    w.input.dy = 1;
    run(w, SET_PIECE_COUNTDOWN_STEPS);
    expect(speedOf(w.ball)).toBeCloseTo(SHORT_PASS_SPEED, 6);
    expect(w.ball.vy).toBeCloseTo(SHORT_PASS_SPEED, 6);
    expect(w.ball.vz).toBe(0);
    expect(w.out.kind).toBe('short-pass');
    const t = world();
    begin(t, 'throw-in', 1, 700, 0);
    run(t, SET_PIECE_COUNTDOWN_STEPS);
    expect(t.out.kind).toBe('short-pass');
    expect(t.ball.lastTouchTeam).toBe(1);
  });
  it('goal kick and corner are long passes', () => {
    const w = world();
    begin(w, 'goal-kick', 0, PITCH.smallAreaDepth, CY);
    run(w, SET_PIECE_COUNTDOWN_STEPS);
    expect(speedOf(w.ball)).toBeCloseTo(LONG_PASS_SPEED, 6);
    expect(w.ball.vz).toBe(LONG_PASS_VZ);
    expect(w.ball.vx).toBeGreaterThan(0);   // towards the rival goal by default
    const c = world();
    begin(c, 'corner', 1, 0, PITCH.height);
    run(c, SET_PIECE_COUNTDOWN_STEPS);
    expect(c.out.kind).toBe('long-pass');
  });
  it('a free kick is a shot at shotSpeed(FREE_KICK_CHARGE_STEPS)', () => {
    const w = world();
    begin(w, 'free-kick', 0, 1500, 500);
    run(w, SET_PIECE_COUNTDOWN_STEPS);
    expect(w.out.kind).toBe('shot');
    expect(speedOf(w.ball)).toBeCloseTo(shotSpeed(FREE_KICK_CHARGE_STEPS), 6);
    expect(shotSpeed(FREE_KICK_CHARGE_STEPS)).toBe(800);
  });
});

describe('penalty', () => {
  function penalty(side: -1 | 0 | 1, rng: Rng, readChance = 0.6): W {
    const w = world();
    begin(w, 'penalty', 0, PITCH.width - PITCH.penaltySpotDist, CY);
    w.input.dy = side;
    run(w, 1);
    w.input.dy = 0;   // the side sticks once chosen
    run(w, SET_PIECE_COUNTDOWN_STEPS, rng, readChance, 2);
    return w;
  }
  it('the keeper reads the side when rng() < penaltyReadChance and saves', () => {
    const w = penalty(1, fixedRng([0.59]));
    const gk = w.players[TEAM_SIZE];
    expect(w.ball.owner).toBe(gk.id);
    expect(gk.y).toBeCloseTo(CY + PENALTY_SIDE_OFFSET, 6);
    expect(w.out).toMatchObject({ kind: 'shot', ok: false });
  });
  it('the keeper guesses wrong when rng() >= penaltyReadChance and the ball flies at shotSpeed(PENALTY_CHARGE_STEPS)', () => {
    const w = penalty(1, fixedRng([0.61, 0.3]));   // not read; second roll picks the lower of the other sides (-1)
    expect(w.ball.owner).toBeNull();
    expect(speedOf(w.ball)).toBeCloseTo(shotSpeed(PENALTY_CHARGE_STEPS), 6);
    expect(shotSpeed(PENALTY_CHARGE_STEPS)).toBe(850);
    expect(w.ball.vy).toBeGreaterThan(0);          // aimed at centerY + 55
    expect(w.ball.vx).toBeGreaterThan(0);
    expect(w.players[TEAM_SIZE].y).toBeCloseTo(CY - PENALTY_SIDE_OFFSET, 6);
    expect(w.out).toMatchObject({ kind: 'shot', ok: true });
  });
  it('a centre shot is saved when the keeper stays (reads) and scores when it dives', () => {
    expect(penalty(0, fixedRng([0.1])).ball.owner).toBe(TEAM_SIZE);
    expect(penalty(0, fixedRng([0.9, 0.7])).ball.owner).toBeNull();   // dives to +1
  });
  it('a read chance of 1 always saves and 0 never does, whatever the seed', () => {
    for (const seed of [3, 17, 4242]) {
      expect(penalty(-1, createRng(seed), 1).ball.owner).toBe(TEAM_SIZE);
      expect(penalty(-1, createRng(seed), 0).ball.owner).toBeNull();
    }
  });
  it('the keeper starts on its line at the goal centre and the box holds the penalty spot', () => {
    const w = world();
    begin(w, 'penalty', 0, PITCH.width - PITCH.penaltySpotDist, CY);
    expect(w.players[TEAM_SIZE].x).toBe(goalLineX(PITCH, 1) - GK_LINE_DIST);
    expect(w.players[TEAM_SIZE].y).toBe(CY);
    expect(w.ball.x).toBeCloseTo(PITCH.width - PITCH.penaltySpotDist, 10);
  });
});
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `npx vitest run components/games/football-logic/referee.test.ts components/games/football-logic/set-pieces.test.ts`
Expected: FAIL — no existen `referee.ts` ni `set-pieces.ts`.

- [ ] **Step 3: Implementación mínima**

```ts
// components/games/football-logic/referee.ts
import { clamp } from './geometry';
import { centerY, goalLineX, isBetweenPosts, isInsideBigArea, penaltySpotX, type PitchDef, type Side } from './pitch';
import type { BallState } from './ball';
import type { AttackDirs } from './step';

export type SetPieceKind = 'kickoff' | 'throw-in' | 'corner' | 'goal-kick' | 'free-kick' | 'penalty';
export type CallKind = 'none' | 'goal' | 'throw-in' | 'corner' | 'goal-kick' | 'free-kick' | 'penalty';

export type RefereeCall = { kind: CallKind; team: 0 | 1; x: number; y: number };

export function createRefereeCall(): RefereeCall {
  return { kind: 'none', team: 0, x: 0, y: 0 };
}

export function clearRefereeCall(out: RefereeCall): void {
  out.kind = 'none';
  out.team = 0;
  out.x = 0;
  out.y = 0;
}

// The team shooting towards `side`: attackDir +1 aims at side 1.
export function teamAttackingSide(attackDir: AttackDirs, side: Side): 0 | 1 {
  const wanted = side === 1 ? 1 : -1;
  return attackDir[0] === wanted ? 0 : 1;
}

export function teamDefendingSide(attackDir: AttackDirs, side: Side): 0 | 1 {
  return teamAttackingSide(attackDir, side) === 0 ? 1 : 0;
}

function call(out: RefereeCall, kind: CallKind, team: 0 | 1, x: number, y: number): void {
  out.kind = kind;
  out.team = team;
  out.x = x;
  out.y = y;
}

// Goal is judged for any ball (walking it in counts); out of play only for a free ball.
export function judgeBall(ball: BallState, attackDir: AttackDirs, pitch: PitchDef, out: RefereeCall): void {
  clearRefereeCall(out);
  const side: Side | -1 = ball.x < 0 ? 0 : ball.x > pitch.width ? 1 : -1;
  if (side !== -1 && isBetweenPosts(pitch, ball.y) && ball.z < pitch.crossbarHeight) {
    call(out, 'goal', teamAttackingSide(attackDir, side), goalLineX(pitch, side), ball.y);
    return;
  }
  if (ball.owner !== null) return;
  if (side !== -1) {
    const defending = teamDefendingSide(attackDir, side);
    if (ball.lastTouchTeam === defending) {
      const attacking = defending === 0 ? 1 : 0;
      call(out, 'corner', attacking, goalLineX(pitch, side), ball.y < centerY(pitch) ? 0 : pitch.height);
    } else {
      const x = side === 0 ? pitch.smallAreaDepth : pitch.width - pitch.smallAreaDepth;
      call(out, 'goal-kick', defending, x, centerY(pitch));
    }
    return;
  }
  if (ball.y < 0 || ball.y > pitch.height) {
    const team: 0 | 1 = ball.lastTouchTeam === 0 ? 1 : 0;
    call(out, 'throw-in', team, clamp(ball.x, 0, pitch.width), ball.y < 0 ? 0 : pitch.height);
  }
}

// Inside the offender's own big area: penalty; anywhere else: free kick where it happened.
export function judgeFoul(x: number, y: number, victimTeam: 0 | 1, attackDir: AttackDirs, pitch: PitchDef, out: RefereeCall): void {
  const offender: 0 | 1 = victimTeam === 0 ? 1 : 0;
  const ownSide: Side = attackDir[offender] === 1 ? 0 : 1;
  if (isInsideBigArea(pitch, ownSide, x, y)) {
    call(out, 'penalty', victimTeam, penaltySpotX(pitch, ownSide), centerY(pitch));
  } else {
    call(out, 'free-kick', victimTeam, x, y);
  }
}
```

```ts
// components/games/football-logic/set-pieces.ts
import { dist, normalizeInto, type Vec2 } from './geometry';
import { centerY, clampToBigArea, goalLineX, type PitchDef, type Side } from './pitch';
import { TEAM_SIZE, type Formation, type Strategy } from './teams';
import type { TeamInput } from './input';
import { ownGoalSide, placeByFormation, type PlayerState } from './players';
import { CONTROL_DIST, givePossession, stickToOwner, type BallState } from './ball';
import { stepsFor, type AttackDirs } from './step';
import type { Rng } from './rng';
import { longPass, shoot, shortPass, type ActionEvent } from './actions';
import type { SetPieceKind } from './referee';

export type PenaltySide = -1 | 0 | 1;

export type SetPieceState = {
  kind: SetPieceKind;
  team: 0 | 1;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  side: PenaltySide;
  stepsLeft: number;
  takerId: number;
};

export const SET_PIECE_COUNTDOWN_SECONDS = 5;
export const SET_PIECE_COUNTDOWN_STEPS = stepsFor(SET_PIECE_COUNTDOWN_SECONDS);
export const SET_PIECE_CLEARANCE = 180;
export const PENALTY_SIDE_OFFSET = 55;
export const FREE_KICK_CHARGE_STEPS = stepsFor(0.4); // shotSpeed(24) = 800
export const PENALTY_CHARGE_STEPS = stepsFor(0.6); // shotSpeed(36) = 850

const scratch: Vec2 = { x: 0, y: 0 };

export function createSetPieceState(): SetPieceState {
  return { kind: 'kickoff', team: 0, x: 0, y: 0, dirX: 1, dirY: 0, side: 0, stepsLeft: 0, takerId: -1 };
}

function rivalSide(team: 0 | 1, attackDir: AttackDirs): Side {
  return attackDir[team] === 1 ? 1 : 0;
}

function nearestOutfield(players: readonly PlayerState[], team: 0 | 1, x: number, y: number): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.team !== team || p.role === 'gk') continue;
    const d = dist(p.x, p.y, x, y);
    if (d < bestDist) {
      bestDist = d;
      best = p.id;
    }
  }
  return best;
}

function placeTaker(sp: SetPieceState, taker: PlayerState, ball: BallState): void {
  taker.facingX = sp.dirX;
  taker.facingY = sp.dirY;
  taker.x = sp.x - sp.dirX * CONTROL_DIST;
  taker.y = sp.y - sp.dirY * CONTROL_DIST;
  taker.vx = 0;
  taker.vy = 0;
  stickToOwner(ball, taker);
}

function pushRivalsAway(sp: SetPieceState, players: PlayerState[], attackDir: AttackDirs, pitch: PitchDef): void {
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.team === sp.team) continue;
    const d = dist(sp.x, sp.y, q.x, q.y);
    if (d >= SET_PIECE_CLEARANCE) continue;
    if (!normalizeInto(scratch, q.x - sp.x, q.y - sp.y)) {
      scratch.x = -attackDir[sp.team];
      scratch.y = 0;
    }
    q.x = sp.x + scratch.x * SET_PIECE_CLEARANCE;
    q.y = sp.y + scratch.y * SET_PIECE_CLEARANCE;
    if (q.x < 0) q.x = 0;
    if (q.x > pitch.width) q.x = pitch.width;
    if (q.y < 0) q.y = 0;
    if (q.y > pitch.height) q.y = pitch.height;
    if (q.role === 'gk') clampToBigArea(pitch, ownGoalSide(attackDir[q.team]), q);
  }
}

export function beginSetPiece(
  sp: SetPieceState, kind: SetPieceKind, team: 0 | 1, x: number, y: number,
  players: PlayerState[], ball: BallState,
  formations: readonly [Formation, Formation], strategies: readonly [Strategy, Strategy],
  attackDir: AttackDirs, pitch: PitchDef, stepCount: number,
): void {
  sp.kind = kind;
  sp.team = team;
  sp.x = x;
  sp.y = y;
  sp.side = 0;
  sp.stepsLeft = SET_PIECE_COUNTDOWN_STEPS;
  if (kind === 'kickoff' || kind === 'penalty') {
    placeByFormation(players, 0, formations[0], strategies[0], attackDir[0], pitch);
    placeByFormation(players, 1, formations[1], strategies[1], attackDir[1], pitch);
  } else {
    pushRivalsAway(sp, players, attackDir, pitch);
  }
  if (kind === 'kickoff' || !normalizeInto(scratch, goalLineX(pitch, rivalSide(team, attackDir)) - x, centerY(pitch) - y)) {
    scratch.x = attackDir[team];
    scratch.y = 0;
  }
  sp.dirX = scratch.x;
  sp.dirY = scratch.y;
  sp.takerId = nearestOutfield(players, team, x, y);
  const taker = players[sp.takerId];
  givePossession(ball, taker, stepCount);
  placeTaker(sp, taker, ball);
}

// The two sides other than `side`, ascending: (-1,0,1) minus side.
function otherSide(side: PenaltySide, pickLower: boolean): PenaltySide {
  if (side === -1) return pickLower ? 0 : 1;
  if (side === 0) return pickLower ? -1 : 1;
  return pickLower ? -1 : 0;
}

function executePenalty(
  sp: SetPieceState, taker: PlayerState, players: PlayerState[], ball: BallState,
  rng: Rng, penaltyReadChance: number, attackDir: AttackDirs, pitch: PitchDef, stepCount: number, aim: Vec2, out: ActionEvent,
): void {
  const side = rivalSide(sp.team, attackDir);
  const targetY = centerY(pitch) + sp.side * PENALTY_SIDE_OFFSET;
  normalizeInto(aim, goalLineX(pitch, side) - ball.x, targetY - ball.y);
  const gk = players[(sp.team === 0 ? 1 : 0) * TEAM_SIZE];
  const guess: PenaltySide = rng() < penaltyReadChance ? sp.side : otherSide(sp.side, rng() < 0.5);
  gk.y = centerY(pitch) + guess * PENALTY_SIDE_OFFSET;
  shoot(taker, ball, aim.x, aim.y, PENALTY_CHARGE_STEPS, stepCount, out);
  if (guess === sp.side) {
    givePossession(ball, gk, stepCount);
    out.ok = false;
  }
}

// Returns true on the step the set piece executes. `input` is the taking team's input.
export function stepSetPiece(
  sp: SetPieceState, input: TeamInput, players: PlayerState[], ball: BallState,
  rng: Rng, penaltyReadChance: number, attackDir: AttackDirs, pitch: PitchDef, stepCount: number,
  aim: Vec2, out: ActionEvent,
): boolean {
  const taker = players[sp.takerId];
  if (sp.kind === 'penalty') {
    if (input.dy !== 0) sp.side = input.dy;
  } else if (normalizeInto(aim, input.dx, input.dy)) {
    sp.dirX = aim.x;
    sp.dirY = aim.y;
    placeTaker(sp, taker, ball);
  }
  sp.stepsLeft--;
  if (sp.stepsLeft > 0) return false;
  switch (sp.kind) {
    case 'kickoff':
    case 'throw-in':
      shortPass(taker, ball, sp.dirX, sp.dirY, stepCount, out);
      break;
    case 'goal-kick':
    case 'corner':
      longPass(taker, ball, sp.dirX, sp.dirY, stepCount, out);
      break;
    case 'free-kick':
      shoot(taker, ball, sp.dirX, sp.dirY, FREE_KICK_CHARGE_STEPS, stepCount, out);
      break;
    case 'penalty':
      executePenalty(sp, taker, players, ball, rng, penaltyReadChance, attackDir, pitch, stepCount, aim, out);
      break;
  }
  return true;
}
```

> `scratch` es un buffer de módulo **sin estado entre llamadas** (patrón `fighter-logic`): se escribe y se lee dentro de la misma función. No es estado de módulo en el sentido prohibido.

- [ ] **Step 4: Verde**

Run: `npx vitest run` → todo verde (unos 27 tests nuevos). `npx tsc --noEmit` limpio. `grep` de determinismo vacío.

- [ ] **Step 5: Verificar y proponer commit**

Exportaciones con destino declarado: `judgeBall`, `judgeFoul`, `createRefereeCall`, `beginSetPiece`, `stepSetPiece`, `createSetPieceState`, `SetPieceState` → Task 5; `clearRefereeCall` → Task 5 (`stepMatch` la limpia antes de juzgar); `PenaltySide`, `PENALTY_SIDE_OFFSET` → Task 8 (dibujo del portero) y Task 6.

Mensaje propuesto: `feat(world-cup): referee calls and automatic directed set pieces with the penalty duel`

---

## Task 5: `match.ts` — el partido entero

**Files:**
- Create: `components/games/football-logic/match.ts`
- Test: `components/games/football-logic/match.test.ts`

**Interfaces:**
- Consumes: `TeamDef`, `Formation`, `Strategy`, `TEAM_SIZE` (Task 1); `PitchDef`, `centerX`, `centerY` (Task 1); `Rng` (Task 1); `Vec2` (Task 2); `TeamInput` (Task 2); `PlayerState`, `createPlayers` (Task 2); `BallState`, `createBall` (Task 2); `STEP_MS`, `stepsFor`, `stepPhysics`, `AttackDirs` (Task 2); `ActionEvent`, `createActionEvent`, `applyButtons`, `stepTackle`, `releaseFromGoalkeeper`, `updateControlled` (Task 3); `RefereeCall`, `createRefereeCall`, `judgeBall`, `judgeFoul`, `SetPieceKind` (Task 4); `SetPieceState`, `createSetPieceState`, `beginSetPiece`, `stepSetPiece` (Task 4); `checkGoalkeepersInBox` (Task 2, solo en el test).
- Produces (lo que consumirán `ai.ts` en la Task 6 y `VaultWorldCupGame.tsx` en la Task 8):

```ts
// match.ts
export type MatchPhase = 'kickoff' | 'play' | 'set-piece' | 'goal' | 'half-time' | 'golden-goal' | 'over';
export type MatchState = {
  teams: [TeamDef, TeamDef];
  players: PlayerState[];                 // los 18, creados una vez
  ball: BallState;
  score: [number, number];
  half: 1 | 2 | 3;                        // 3 = gol de oro
  clockMs: number;                        // halfStep * STEP_MS, para el HUD
  phase: MatchPhase;
  setPiece: SetPieceState | null;         // el objeto de scratch.setPiece mientras hay saque; null si no
  stepCount: number;
  controlled: [number, number];           // caché derivada al final de cada paso
  // Añadidos al tipo del spec:
  attackDir: [1 | -1, 1 | -1];            // hacia dónde ataca cada equipo; se invierte en la 2ª parte
  halfStep: number;                       // pasos jugados de la parte actual (el reloj)
  pauseStepsLeft: number;                 // pausa de gol / descanso
  formationIndex: [number, number];       // elección de cada equipo (input.formation)
  strategies: [Strategy, Strategy];       // elección de cada equipo (input.strategy)
  formationTable: readonly Formation[];   // la tabla que se le pasó a createMatch: NO se lee FORMATIONS
  pitch: PitchDef;                        // idem: NO se lee PITCH
  gkPenaltyRead: [number, number];        // penaltyReadChance del portero de cada equipo; Task 6/8 lo rellena desde profileFor
  lastGoalTeam: 0 | 1 | -1;
  scratch: { events: [ActionEvent, ActionEvent]; gkEvent: ActionEvent; call: RefereeCall; aim: Vec2; setPiece: SetPieceState };
};
export const HALF_SECONDS = 90;
export const HALF_SECONDS_MAX = 120;      // techo del spec: HALF_SECONDS <= HALF_SECONDS_MAX, con test
export const HALF_STEPS: number;          // 5400
export const GOAL_PAUSE_SECONDS = 2;
export const GOAL_PAUSE_STEPS: number;    // 120
export const HALF_TIME_PAUSE_SECONDS = 3;
export const HALF_TIME_PAUSE_STEPS: number;   // 180
export const DEFAULT_PENALTY_READ_CHANCE = 0.5;
export function kickoffTeamFor(half: 1 | 2 | 3): 0 | 1;     // 1ª y gol de oro: equipo 0; 2ª: equipo 1
export function isOpenPlay(phase: MatchPhase): boolean;    // play | golden-goal
export function createMatch(teams: [TeamDef, TeamDef], formationTable: readonly Formation[], pitch: PitchDef): MatchState;
// Transiciones: TODAS devuelven false sin tocar nada si la fase de partida no es legal.
export function resumePlay(match: MatchState): boolean;                   // kickoff | set-piece → play | golden-goal
export function callSetPiece(match: MatchState, kind: SetPieceKind, team: 0 | 1, x: number, y: number): boolean;   // play | golden-goal → set-piece
export function scoreGoal(match: MatchState, team: 0 | 1): boolean;       // play | golden-goal | set-piece → goal (o over en gol de oro)
export function endGoalPause(match: MatchState): boolean;                 // goal → kickoff (saca el que encajó)
export function endHalf(match: MatchState): boolean;                      // play → half-time | kickoff(3) | over
export function endHalfTime(match: MatchState): boolean;                  // half-time → kickoff (2ª parte)
export function abandon(match: MatchState): boolean;                      // cualquiera menos over → over
export function stepMatch(match: MatchState, inputs: readonly [TeamInput, TeamInput], rng: Rng): void;
```

Reglas fijadas aquí:
- **Máquina de fases**: `kickoff → play ⇄ set-piece`, `play|golden-goal|set-piece → goal → kickoff`, `play → half-time → kickoff`, `play → kickoff(half 3) → golden-goal`, `golden-goal → over` al primer gol, `play → over` al final de la 2ª parte con marcador distinto. **Cada transición comprueba la fase de partida y devuelve `false` sin excepción ni efecto** si no es legal.
- **Reloj en pasos**: `halfStep` avanza en `kickoff`, `play` y `set-piece` (la cuenta atrás de un saque consume tiempo de partido); **no** avanza en `goal`, `half-time`, `golden-goal` (sin tope) ni `over`. La parte termina en el primer paso de `play` con `halfStep >= HALF_STEPS`; si el reloj expira durante un saque, la parte termina al reanudar. `clockMs = halfStep · STEP_MS`.
- **Saques iniciales**: 1ª parte y gol de oro, equipo 0; 2ª parte, equipo 1; tras un gol, el que lo encajó. **Cambio de campo** en la 2ª parte: `endHalf` invierte `attackDir` y recoloca a los dos equipos por formación **en el acto** (así el invariante del portero se cumple también durante el descanso); el saque de la 2ª parte vuelve a recolocarlos.
- **Gol de oro sin tope**: `half = 3`, fase `golden-goal`; el primer gol pone `over`. La CPU pasando a ataque es de la Task 6.
- **Elección de formación y estrategia** llega en cada `TeamInput` y se guarda en `match.formationIndex`/`strategies` (índice fuera de tabla → se ignora). Aquí solo se aplica en las recolocaciones (saque inicial y penalti); la colocación en vivo es de la Task 6.
- **`gkPenaltyRead`** nace a `DEFAULT_PENALTY_READ_CHANCE` para los dos; la Task 6/8 lo escribe desde `profileFor(...).penaltyReadChance` (la IA solo recibe el perfil, nunca la dificultad).
- **Orden dentro de un paso de juego abierto**: (1) botones de los dos controlados (`applyButtons`), (2) los dos porteros (`releaseFromGoalkeeper`), (3) `stepPhysics`, (4) `stepTackle` para todo el que esté en entrada, (5) si hubo falta → `judgeFoul` → `callSetPiece`; si no → `judgeBall` → gol o saque, (6) reloj y fin de parte, (7) `stepCount++`, `clockMs`, `updateControlled`. En `kickoff`/`set-piece`: solo `stepSetPiece` con la entrada del equipo que saca, y al ejecutarse `resumePlay`. En `goal`/`half-time`: solo la pausa.
- **El rng** solo lo consumen `applyButtons` (robo) y `stepSetPiece` (penalti). `stepMatch` no lo llama nunca directamente.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// components/games/football-logic/match.test.ts
import { describe, expect, it } from 'vitest';
import { PITCH, centerY } from './pitch';
import { FORMATIONS, TEAMS, type Formation, type TeamDef } from './teams';
import { createTeamInput, copyTeamInput, type Axis, type TeamInput } from './input';
import { STEP_MS, stepsFor } from './step';
import { GK_LINE_DIST } from './players';
import { createRng, type Rng } from './rng';
import { checkGoalkeepersInBox } from './invariants';
import {
  DEFAULT_PENALTY_READ_CHANCE, GOAL_PAUSE_STEPS, HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS, HALF_TIME_PAUSE_STEPS,
  abandon, callSetPiece, createMatch, endGoalPause, endHalf, endHalfTime, isOpenPlay, kickoffTeamFor, resumePlay,
  scoreGoal, stepMatch, type MatchPhase, type MatchState,
} from './match';
import { SET_PIECE_COUNTDOWN_STEPS } from './set-pieces';
import { STEAL_CHANCE } from './actions';

const TEAM_PAIR: [TeamDef, TeamDef] = [TEAMS[0], TEAMS[1]];
const CY = centerY(PITCH);
const PHASES: readonly MatchPhase[] = ['kickoff', 'play', 'set-piece', 'goal', 'half-time', 'golden-goal', 'over'];
const IDLE: readonly [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];

function fresh(): MatchState {
  return createMatch(TEAM_PAIR, FORMATIONS, PITCH);
}

function idle(match: MatchState, steps: number, rng: Rng = createRng(1)): void {
  for (let i = 0; i < steps; i++) stepMatch(match, IDLE, rng);
}

// Forces a phase with the fields that phase implies, to test the guards from every illegal start.
function forcePhase(match: MatchState, phase: MatchPhase): void {
  match.phase = phase;
  match.setPiece = phase === 'kickoff' || phase === 'set-piece' ? match.scratch.setPiece : null;
  match.half = phase === 'golden-goal' ? 3 : 1;
  match.pauseStepsLeft = phase === 'goal' || phase === 'half-time' ? 50 : 0;
}

function snapshot(match: MatchState): string {
  return JSON.stringify({
    phase: match.phase, half: match.half, score: match.score, halfStep: match.halfStep, attackDir: match.attackDir,
    pause: match.pauseStepsLeft, sp: match.setPiece, players: match.players, ball: match.ball, controlled: match.controlled,
  });
}

describe('constants', () => {
  it('two halves of 90 s under the 120 s ceiling, in steps', () => {
    expect(HALF_SECONDS).toBe(90);
    expect(HALF_SECONDS).toBeLessThanOrEqual(HALF_SECONDS_MAX);
    expect(HALF_STEPS).toBe(5400);
    expect(GOAL_PAUSE_STEPS).toBe(stepsFor(2));
    expect(HALF_TIME_PAUSE_STEPS).toBe(stepsFor(3));
  });
  it('kickoff teams: 0 in the first half and the golden goal, 1 in the second', () => {
    expect([kickoffTeamFor(1), kickoffTeamFor(2), kickoffTeamFor(3)]).toEqual([0, 1, 0]);
  });
});

describe('createMatch', () => {
  it('starts at the kickoff of the first half, 0-0, team 0 attacking +x, with a derived controlled pair', () => {
    const m = fresh();
    expect(m.phase).toBe('kickoff');
    expect(m.half).toBe(1);
    expect(m.score).toEqual([0, 0]);
    expect(m.attackDir).toEqual([1, -1]);
    expect(m.setPiece).not.toBeNull();
    expect(m.setPiece?.kind).toBe('kickoff');
    expect(m.setPiece?.team).toBe(0);
    expect(m.ball.x).toBeCloseTo(1000, 10);
    expect(m.ball.y).toBeCloseTo(CY, 10);
    expect(m.controlled[0]).toBe(m.ball.owner);
    expect(m.players[m.controlled[1]].team).toBe(1);
    expect(m.players[m.controlled[1]].role).not.toBe('gk');
    expect(m.gkPenaltyRead).toEqual([DEFAULT_PENALTY_READ_CHANCE, DEFAULT_PENALTY_READ_CHANCE]);
    expect(m.formationTable).toBe(FORMATIONS);
    expect(m.pitch).toBe(PITCH);
    expect(m.stepCount).toBe(0);
  });
});

describe('every transition refuses every illegal phase without touching the state', () => {
  const table: { name: string; legal: readonly MatchPhase[]; fire: (m: MatchState) => boolean }[] = [
    { name: 'resumePlay', legal: ['kickoff', 'set-piece'], fire: resumePlay },
    { name: 'callSetPiece', legal: ['play', 'golden-goal'], fire: (m) => callSetPiece(m, 'throw-in', 1, 700, 0) },
    { name: 'scoreGoal', legal: ['play', 'golden-goal', 'set-piece'], fire: (m) => scoreGoal(m, 0) },
    { name: 'endGoalPause', legal: ['goal'], fire: endGoalPause },
    { name: 'endHalf', legal: ['play'], fire: endHalf },
    { name: 'endHalfTime', legal: ['half-time'], fire: endHalfTime },
    { name: 'abandon', legal: ['kickoff', 'play', 'set-piece', 'goal', 'half-time', 'golden-goal'], fire: abandon },
  ];
  for (const t of table) {
    for (const phase of PHASES) {
      if (t.legal.includes(phase)) continue;
      it(`${t.name} from ${phase} returns false and changes nothing`, () => {
        const m = fresh();
        forcePhase(m, phase);
        const before = snapshot(m);
        expect(t.fire(m)).toBe(false);
        expect(snapshot(m)).toBe(before);
      });
    }
    for (const phase of t.legal) {
      it(`${t.name} from ${phase} returns true`, () => {
        const m = fresh();
        forcePhase(m, phase);
        expect(t.fire(m)).toBe(true);
      });
    }
  }
});

describe('transition effects', () => {
  it('resumePlay goes to play in halves 1-2 and to golden-goal in half 3, clearing the set piece', () => {
    const m = fresh();
    expect(resumePlay(m)).toBe(true);
    expect(m.phase).toBe('play');
    expect(m.setPiece).toBeNull();
    forcePhase(m, 'kickoff');
    m.half = 3;
    resumePlay(m);
    expect(m.phase).toBe('golden-goal');
  });
  it('callSetPiece begins the set piece for the given team at the given spot', () => {
    const m = fresh();
    resumePlay(m);
    expect(callSetPiece(m, 'corner', 1, 0, PITCH.height)).toBe(true);
    expect(m.phase).toBe('set-piece');
    expect(m.setPiece).toMatchObject({ kind: 'corner', team: 1, x: 0, y: PITCH.height, stepsLeft: SET_PIECE_COUNTDOWN_STEPS });
    expect(m.players[m.setPiece?.takerId ?? -1].team).toBe(1);
  });
  it('scoreGoal adds to the score, pauses, and the conceding team kicks off after the pause', () => {
    const m = fresh();
    resumePlay(m);
    expect(scoreGoal(m, 1)).toBe(true);
    expect(m.score).toEqual([0, 1]);
    expect(m.phase).toBe('goal');
    expect(m.pauseStepsLeft).toBe(GOAL_PAUSE_STEPS);
    expect(endGoalPause(m)).toBe(true);
    expect(m.phase).toBe('kickoff');
    expect(m.setPiece?.team).toBe(0);
  });
  it('scoreGoal during a penalty (set-piece) counts', () => {
    const m = fresh();
    resumePlay(m);
    callSetPiece(m, 'penalty', 0, PITCH.width - PITCH.penaltySpotDist, CY);
    expect(scoreGoal(m, 0)).toBe(true);
    expect(m.score).toEqual([1, 0]);
  });
  it('endHalf after the first half swaps ends and pauses; endHalfTime makes team 1 kick off the second half', () => {
    const m = fresh();
    resumePlay(m);
    m.halfStep = HALF_STEPS;
    expect(endHalf(m)).toBe(true);
    expect(m.phase).toBe('half-time');
    expect(m.half).toBe(2);
    expect(m.attackDir).toEqual([-1, 1]);
    expect(m.halfStep).toBe(0);
    expect(m.players[9].x).toBe(GK_LINE_DIST);   // ends already swapped during the pause (criterion 9b holds throughout)
    expect(endHalfTime(m)).toBe(true);
    expect(m.phase).toBe('kickoff');
    expect(m.setPiece?.team).toBe(1);
    expect(m.setPiece?.dirX).toBe(1);          // team 1 now attacks +x
    expect(m.players[0].x).toBe(PITCH.width - GK_LINE_DIST);   // team 0 keeper moved to the right end
  });
  it('endHalf after the second half: over if the score differs, golden-goal kickoff by team 0 if tied', () => {
    const tied = fresh();
    resumePlay(tied);
    endHalf(tied); endHalfTime(tied); resumePlay(tied);
    expect(endHalf(tied)).toBe(true);
    expect(tied.phase).toBe('kickoff');
    expect(tied.half).toBe(3);
    expect(tied.setPiece?.team).toBe(0);
    const won = fresh();
    resumePlay(won);
    scoreGoal(won, 0); endGoalPause(won); resumePlay(won);
    endHalf(won); endHalfTime(won); resumePlay(won);
    expect(endHalf(won)).toBe(true);
    expect(won.phase).toBe('over');
  });
  it('a golden goal ends the match at once, and endHalf is refused in half 3', () => {
    const m = fresh();
    resumePlay(m);
    endHalf(m); endHalfTime(m); resumePlay(m); endHalf(m);   // tied → half 3 kickoff
    resumePlay(m);
    expect(m.phase).toBe('golden-goal');
    expect(endHalf(m)).toBe(false);
    expect(scoreGoal(m, 1)).toBe(true);
    expect(m.phase).toBe('over');
    expect(m.score).toEqual([0, 1]);
  });
  it('abandon ends the match from any live phase', () => {
    const m = fresh();
    expect(abandon(m)).toBe(true);
    expect(m.phase).toBe('over');
    expect(isOpenPlay('play') && isOpenPlay('golden-goal') && !isOpenPlay('over')).toBe(true);
  });
});

describe('stepMatch drives the clock and the phases with idle inputs', () => {
  it('the kickoff executes after the countdown and the first half ends at exactly HALF_STEPS steps', () => {
    const m = fresh();
    idle(m, SET_PIECE_COUNTDOWN_STEPS - 1);
    expect(m.phase).toBe('kickoff');
    idle(m, 1);
    expect(m.phase).toBe('play');
    expect(m.ball.owner).toBeNull();
    idle(m, HALF_STEPS - SET_PIECE_COUNTDOWN_STEPS - 1);
    expect(m.phase).toBe('play');
    expect(m.clockMs).toBeCloseTo((HALF_STEPS - 1) * STEP_MS, 6);
    idle(m, 1);
    expect(m.phase).toBe('half-time');
    expect(m.half).toBe(2);
    expect(m.stepCount).toBe(HALF_STEPS);
  });
  it('the half-time pause lasts HALF_TIME_PAUSE_STEPS and the second half starts with ends swapped', () => {
    const m = fresh();
    idle(m, HALF_STEPS);
    idle(m, HALF_TIME_PAUSE_STEPS - 1);
    expect(m.phase).toBe('half-time');
    idle(m, 1);
    expect(m.phase).toBe('kickoff');
    expect(m.attackDir).toEqual([-1, 1]);
    expect(m.setPiece?.team).toBe(1);
  });
  it('a 0-0 match goes to a golden goal that never times out', () => {
    const m = fresh();
    idle(m, 2 * HALF_STEPS + HALF_TIME_PAUSE_STEPS);
    expect(m.half).toBe(3);
    expect(m.phase).toBe('kickoff');
    idle(m, SET_PIECE_COUNTDOWN_STEPS);
    expect(m.phase).toBe('golden-goal');
    const clock = m.halfStep;
    idle(m, 3 * HALF_STEPS);
    expect(m.phase).toBe('golden-goal');
    expect(m.halfStep).toBe(clock);
  });
  it('a 1-0 lead after two halves ends the match', () => {
    const m = fresh();
    idle(m, SET_PIECE_COUNTDOWN_STEPS + 7);
    scoreGoal(m, 0);
    idle(m, 2 * HALF_STEPS + HALF_TIME_PAUSE_STEPS + GOAL_PAUSE_STEPS + 2 * SET_PIECE_COUNTDOWN_STEPS);
    expect(m.phase).toBe('over');
    expect(m.score).toEqual([1, 0]);
  });
  it('does nothing once over', () => {
    const m = fresh();
    abandon(m);
    const before = snapshot(m);
    idle(m, 50);
    expect(snapshot(m)).toBe(before);
    expect(m.stepCount).toBe(0);
  });
  it('stores the formation and strategy choice from the inputs and ignores an index outside the table', () => {
    const three: Formation[] = [FORMATIONS[0], { ...FORMATIONS[0], id: '3-3-2-b' }, { ...FORMATIONS[0], id: '3-3-2-c' }];
    const m = createMatch(TEAM_PAIR, three, PITCH);
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[0].formation = 2; inputs[0].strategy = 'attack';
    inputs[1].formation = 7; inputs[1].strategy = 'defend';
    stepMatch(m, inputs, createRng(1));
    expect(m.formationIndex).toEqual([2, 0]);
    expect(m.strategies).toEqual(['attack', 'defend']);
  });
  it('the keepers never leave their box through a full idle match (criterion 9b)', () => {
    const m = fresh();
    const rng = createRng(1);
    for (let i = 0; i < 2 * HALF_STEPS + HALF_TIME_PAUSE_STEPS; i++) {
      stepMatch(m, IDLE, rng);
      expect(checkGoalkeepersInBox(m.players, m.attackDir, m.pitch)).toEqual([]);
    }
  });
});

// ── The full match with RECORDED inputs (criterion 1 on stepMatch) ────────────
//
// The policies below read the match state (no rng) to produce each step's
// TeamInput, which run A records. Run B replays the recording with the same seed
// and must match A step by step; run C replays it with a seed whose first draw
// falls on the other side of STEAL_CHANCE and must diverge. Seeds are chosen by
// scanning createRng, never by luck: the steal is the only rng consumer here
// (nobody tackles, so there are no fouls and no penalties).

function sign(v: number, dead: number): Axis {
  return v > dead ? 1 : v < -dead ? -1 : 0;
}

function policy(match: MatchState, team: 0 | 1, out: TeamInput): void {
  out.dx = 0; out.dy = 0; out.a = 'up'; out.b = 'up'; out.c = 'up'; out.formation = 0; out.strategy = 'neutral';
  const me = match.players[match.controlled[team]];
  const ball = match.ball;
  const step = match.stepCount;
  const attack = match.attackDir[team];
  if (ball.owner === me.id) {
    if (team === 0) {
      // Run a corridor 50 u off the centre line (clear of the static 3-3-2 lanes and the keeper), then shoot straight.
      out.dy = sign(CY - 50 - me.y, 3);
      out.dx = attack;
      out.c = 'held';
      const goalX = attack === 1 ? match.pitch.width : 0;
      if (Math.abs(goalX - me.x) < 300 && out.dy === 0) out.a = step % 2 === 0 ? 'pressed' : 'released';
    } else {
      out.dx = attack;
      if (step % 90 === 0) out.b = 'pressed';
      if (step % 90 === 1) out.b = 'released';
    }
    return;
  }
  out.dx = sign(ball.x - me.x, 4);
  out.dy = sign(ball.y - me.y, 4);
  if (step % 30 === team * 15) out.b = 'pressed';
}

function seedWhere(pred: (firstDraw: number) => boolean): number {
  for (let seed = 1; seed < 10_000; seed++) if (pred(createRng(seed)())) return seed;
  throw new Error('no seed found');
}

function countingRng(seed: number): Rng & { calls: number } {
  const inner = createRng(seed);
  const fn = (() => { fn.calls++; return inner(); }) as Rng & { calls: number };
  fn.calls = 0;
  return fn;
}

function sameMatch(a: MatchState, b: MatchState): boolean {
  if (a.phase !== b.phase || a.half !== b.half || a.stepCount !== b.stepCount || a.halfStep !== b.halfStep) return false;
  if (a.score[0] !== b.score[0] || a.score[1] !== b.score[1]) return false;
  if (a.controlled[0] !== b.controlled[0] || a.controlled[1] !== b.controlled[1]) return false;
  for (let i = 0; i < a.players.length; i++) {
    const p = a.players[i]; const q = b.players[i];
    if (p.x !== q.x || p.y !== q.y || p.facingX !== q.facingX || p.facingY !== q.facingY) return false;
    if (p.sprintStepsLeft !== q.sprintStepsLeft || p.downUntilStep !== q.downUntilStep || p.tackleStepsLeft !== q.tackleStepsLeft) return false;
  }
  const x = a.ball; const y = b.ball;
  return x.x === y.x && x.y === y.y && x.z === y.z && x.vx === y.vx && x.vy === y.vy && x.vz === y.vz && x.owner === y.owner;
}

const RECORD_CAP = 4 * HALF_STEPS;   // two halves, pauses and a long golden goal fit comfortably

describe('full match with recorded inputs (criterion 1)', () => {
  const seedA = seedWhere((v) => v < STEAL_CHANCE);
  const seedC = seedWhere((v) => v >= STEAL_CHANCE);

  it('run A ends over with at least one goal, run B replays it identically step by step, run C diverges on the seed', () => {
    const a = fresh();
    const b = fresh();
    const c = fresh();
    const rngA = countingRng(seedA);
    const rngB = createRng(seedA);
    const rngC = createRng(seedC);
    const live: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    const recorded: [TeamInput, TeamInput][] = [];
    let firstMismatchB = -1;
    let steps = 0;
    while (a.phase !== 'over' && steps < RECORD_CAP) {
      policy(a, 0, live[0]);
      policy(a, 1, live[1]);
      const frame: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
      copyTeamInput(live[0], frame[0]);
      copyTeamInput(live[1], frame[1]);
      recorded.push(frame);
      stepMatch(a, live, rngA);
      stepMatch(b, frame, rngB);
      stepMatch(c, frame, rngC);
      if (firstMismatchB < 0 && !sameMatch(a, b)) firstMismatchB = steps;
      steps++;
    }
    expect(a.phase).toBe('over');
    expect(a.score[0] + a.score[1]).toBeGreaterThanOrEqual(1);
    expect(a.half).toBeGreaterThanOrEqual(2);
    expect(rngA.calls).toBeGreaterThan(0);
    expect(firstMismatchB).toBe(-1);
    expect(sameMatch(a, b)).toBe(true);
    expect(sameMatch(a, c)).toBe(false);
    expect(recorded.length).toBe(steps);
  });

  it('replaying the recording from a fresh match a second time gives the same score and the same final step', () => {
    const a = fresh();
    const live: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    const recorded: [TeamInput, TeamInput][] = [];
    const rngA = createRng(seedA);
    while (a.phase !== 'over' && recorded.length < RECORD_CAP) {
      policy(a, 0, live[0]);
      policy(a, 1, live[1]);
      const frame: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
      copyTeamInput(live[0], frame[0]);
      copyTeamInput(live[1], frame[1]);
      recorded.push(frame);
      stepMatch(a, live, rngA);
    }
    const replay = fresh();
    const rngR = createRng(seedA);
    for (const frame of recorded) stepMatch(replay, frame, rngR);
    expect(replay.phase).toBe('over');
    expect(replay.score).toEqual(a.score);
    expect(replay.stepCount).toBe(a.stepCount);
  });
});
```

> **Si el partido grabado no termina en `over` dentro de `RECORD_CAP`**, no se toca el test ni el tope: es información sobre el motor. Causas probables, por orden: (1) el pasillo `CY − 50` está siendo interceptado por un jugador estático (comprobar las `y` de la formación publicada frente a `POSSESSION_RADIUS`), (2) el chut sale con `dy ≠ 0` porque el jugador nunca se queda a ±3 u del pasillo (subir la banda muerta), (3) el portero atrapa el balón por proximidad porque `PENALTY_SIDE_OFFSET`/`goalWidth` cambiaron. Responder **BLOCKED** con la medición (`score`, `phase`, `half`, `halfStep` al tope).

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx vitest run components/games/football-logic/match.test.ts`
Expected: FAIL — no existe `match.ts`.

- [ ] **Step 3: Implementación mínima**

```ts
// components/games/football-logic/match.ts
import type { Vec2 } from './geometry';
import { centerX, centerY, type PitchDef } from './pitch';
import { TEAM_SIZE, type Formation, type Strategy, type TeamDef } from './teams';
import type { TeamInput } from './input';
import type { Rng } from './rng';
import { STEP_MS, stepPhysics, stepsFor } from './step';
import { createPlayers, placeByFormation, type PlayerState } from './players';
import { createBall, type BallState } from './ball';
import { applyButtons, createActionEvent, releaseFromGoalkeeper, stepTackle, updateControlled, type ActionEvent } from './actions';
import { createRefereeCall, judgeBall, judgeFoul, type RefereeCall, type SetPieceKind } from './referee';
import { beginSetPiece, createSetPieceState, stepSetPiece, type SetPieceState } from './set-pieces';

export type MatchPhase = 'kickoff' | 'play' | 'set-piece' | 'goal' | 'half-time' | 'golden-goal' | 'over';

export type MatchState = {
  teams: [TeamDef, TeamDef];
  players: PlayerState[];
  ball: BallState;
  score: [number, number];
  half: 1 | 2 | 3;
  clockMs: number;
  phase: MatchPhase;
  setPiece: SetPieceState | null;
  stepCount: number;
  controlled: [number, number];
  attackDir: [1 | -1, 1 | -1];
  halfStep: number;
  pauseStepsLeft: number;
  formationIndex: [number, number];
  strategies: [Strategy, Strategy];
  formationTable: readonly Formation[];
  pitch: PitchDef;
  gkPenaltyRead: [number, number];
  lastGoalTeam: 0 | 1 | -1;
  scratch: { events: [ActionEvent, ActionEvent]; gkEvent: ActionEvent; call: RefereeCall; aim: Vec2; setPiece: SetPieceState };
};

export const HALF_SECONDS = 90;
export const HALF_SECONDS_MAX = 120;
export const HALF_STEPS = stepsFor(HALF_SECONDS);
export const GOAL_PAUSE_SECONDS = 2;
export const GOAL_PAUSE_STEPS = stepsFor(GOAL_PAUSE_SECONDS);
export const HALF_TIME_PAUSE_SECONDS = 3;
export const HALF_TIME_PAUSE_STEPS = stepsFor(HALF_TIME_PAUSE_SECONDS);
export const DEFAULT_PENALTY_READ_CHANCE = 0.5;

export function kickoffTeamFor(half: 1 | 2 | 3): 0 | 1 {
  return half === 2 ? 1 : 0;
}

export function isOpenPlay(phase: MatchPhase): boolean {
  return phase === 'play' || phase === 'golden-goal';
}

function formationsOf(match: MatchState): readonly [Formation, Formation] {
  // Two reads, no allocation: the tuple is rebuilt only at set-piece events.
  return [match.formationTable[match.formationIndex[0]], match.formationTable[match.formationIndex[1]]];
}

function startSetPiece(match: MatchState, kind: SetPieceKind, team: 0 | 1, x: number, y: number): void {
  const sp = match.scratch.setPiece;
  beginSetPiece(sp, kind, team, x, y, match.players, match.ball, formationsOf(match), match.strategies, match.attackDir, match.pitch, match.stepCount);
  match.setPiece = sp;
}

function startKickoff(match: MatchState, team: 0 | 1): void {
  match.phase = 'kickoff';
  startSetPiece(match, 'kickoff', team, centerX(match.pitch), centerY(match.pitch));
}

// Both teams back to their formation on their CURRENT side. Called at half-time
// right after attackDir flips, so the keeper-in-box invariant (9b) holds during
// the pause and not only once the second-half kickoff repositions everyone.
function repositionBothTeams(match: MatchState): void {
  const formations = formationsOf(match);
  placeByFormation(match.players, 0, formations[0], match.strategies[0], match.attackDir[0], match.pitch);
  placeByFormation(match.players, 1, formations[1], match.strategies[1], match.attackDir[1], match.pitch);
}

export function createMatch(teams: [TeamDef, TeamDef], formationTable: readonly Formation[], pitch: PitchDef): MatchState {
  const match: MatchState = {
    teams,
    players: createPlayers([formationTable[0], formationTable[0]], pitch),
    ball: createBall(),
    score: [0, 0],
    half: 1,
    clockMs: 0,
    phase: 'kickoff',
    setPiece: null,
    stepCount: 0,
    controlled: [-1, -1],
    attackDir: [1, -1],
    halfStep: 0,
    pauseStepsLeft: 0,
    formationIndex: [0, 0],
    strategies: ['neutral', 'neutral'],
    formationTable,
    pitch,
    gkPenaltyRead: [DEFAULT_PENALTY_READ_CHANCE, DEFAULT_PENALTY_READ_CHANCE],
    lastGoalTeam: -1,
    scratch: {
      events: [createActionEvent(), createActionEvent()],
      gkEvent: createActionEvent(),
      call: createRefereeCall(),
      aim: { x: 0, y: 0 },
      setPiece: createSetPieceState(),
    },
  };
  startKickoff(match, kickoffTeamFor(1));
  updateControlled(match.players, match.ball, match.controlled);
  return match;
}

// ── Transitions: every one guards its starting phase and returns false otherwise ──

export function resumePlay(match: MatchState): boolean {
  if (match.phase !== 'kickoff' && match.phase !== 'set-piece') return false;
  match.setPiece = null;
  match.phase = match.half === 3 ? 'golden-goal' : 'play';
  return true;
}

export function callSetPiece(match: MatchState, kind: SetPieceKind, team: 0 | 1, x: number, y: number): boolean {
  if (!isOpenPlay(match.phase)) return false;
  match.phase = 'set-piece';
  startSetPiece(match, kind, team, x, y);
  return true;
}

export function scoreGoal(match: MatchState, team: 0 | 1): boolean {
  if (!isOpenPlay(match.phase) && match.phase !== 'set-piece') return false;
  match.score[team]++;
  match.lastGoalTeam = team;
  match.setPiece = null;
  if (match.half === 3) {
    match.phase = 'over';
    return true;
  }
  match.phase = 'goal';
  match.pauseStepsLeft = GOAL_PAUSE_STEPS;
  return true;
}

export function endGoalPause(match: MatchState): boolean {
  if (match.phase !== 'goal') return false;
  startKickoff(match, match.lastGoalTeam === 0 ? 1 : 0);
  return true;
}

export function endHalf(match: MatchState): boolean {
  if (match.phase !== 'play') return false;
  match.halfStep = 0;
  if (match.half === 1) {
    match.half = 2;
    match.attackDir[0] = match.attackDir[0] === 1 ? -1 : 1;
    match.attackDir[1] = match.attackDir[1] === 1 ? -1 : 1;
    repositionBothTeams(match);
    match.phase = 'half-time';
    match.pauseStepsLeft = HALF_TIME_PAUSE_STEPS;
    return true;
  }
  if (match.score[0] !== match.score[1]) {
    match.phase = 'over';
    return true;
  }
  match.half = 3;
  startKickoff(match, kickoffTeamFor(3));
  return true;
}

export function endHalfTime(match: MatchState): boolean {
  if (match.phase !== 'half-time') return false;
  startKickoff(match, kickoffTeamFor(2));
  return true;
}

export function abandon(match: MatchState): boolean {
  if (match.phase === 'over') return false;
  match.phase = 'over';
  match.setPiece = null;
  return true;
}

// ── The step ──────────────────────────────────────────────────────────────────

function applyTeamChoices(match: MatchState, inputs: readonly [TeamInput, TeamInput]): void {
  for (let t = 0; t < 2; t++) {
    const idx = inputs[t].formation;
    if (idx >= 0 && idx < match.formationTable.length) match.formationIndex[t] = idx;
    match.strategies[t] = inputs[t].strategy;
  }
}

function advanceClock(match: MatchState): void {
  match.halfStep++;
}

function isRestart(kind: RefereeCall['kind']): kind is SetPieceKind {
  return kind === 'throw-in' || kind === 'corner' || kind === 'goal-kick' || kind === 'free-kick' || kind === 'penalty';
}

function stepOpenPlay(match: MatchState, inputs: readonly [TeamInput, TeamInput], rng: Rng): void {
  const { players, ball, scratch } = match;
  for (let t = 0; t < 2; t++) {
    applyButtons(players[match.controlled[t]], inputs[t], ball, players, rng, match.stepCount, scratch.aim, scratch.events[t]);
  }
  releaseFromGoalkeeper(players[0], ball, match.attackDir[0], match.stepCount, scratch.gkEvent);
  releaseFromGoalkeeper(players[TEAM_SIZE], ball, match.attackDir[1], match.stepCount, scratch.gkEvent);
  stepPhysics(players, ball, inputs, match.controlled, match.attackDir, match.pitch, match.stepCount);
  for (let i = 0; i < players.length; i++) {
    if (players[i].tackleStepsLeft > 0) stepTackle(players[i], ball, players, match.stepCount, scratch.events[players[i].team]);
  }
  for (let t = 0; t < 2; t++) {
    const ev = scratch.events[t];
    if (ev.foul) {
      judgeFoul(ev.x, ev.y, players[ev.victimId].team, match.attackDir, match.pitch, scratch.call);
      if (isRestart(scratch.call.kind)) callSetPiece(match, scratch.call.kind, scratch.call.team, scratch.call.x, scratch.call.y);
      advanceClock(match);
      return;
    }
  }
  judgeBall(ball, match.attackDir, match.pitch, scratch.call);
  if (scratch.call.kind === 'goal') {
    scoreGoal(match, scratch.call.team);
    return;
  }
  if (isRestart(scratch.call.kind)) {
    callSetPiece(match, scratch.call.kind, scratch.call.team, scratch.call.x, scratch.call.y);
    advanceClock(match);
    return;
  }
  if (match.phase === 'play') {
    advanceClock(match);
    if (match.halfStep >= HALF_STEPS) endHalf(match);
  }
}

// One FIXED step. Two symmetric inputs; the engine does not know which one is human.
export function stepMatch(match: MatchState, inputs: readonly [TeamInput, TeamInput], rng: Rng): void {
  if (match.phase === 'over') return;
  applyTeamChoices(match, inputs);
  switch (match.phase) {
    case 'kickoff':
    case 'set-piece': {
      const sp = match.setPiece;
      if (sp === null) {
        resumePlay(match);
        break;
      }
      const keeperTeam = sp.team === 0 ? 1 : 0;
      const executed = stepSetPiece(
        sp, inputs[sp.team], match.players, match.ball, rng, match.gkPenaltyRead[keeperTeam],
        match.attackDir, match.pitch, match.stepCount, match.scratch.aim, match.scratch.events[sp.team],
      );
      if (executed) resumePlay(match);
      advanceClock(match);
      break;
    }
    case 'goal':
    case 'half-time': {
      match.pauseStepsLeft--;
      if (match.pauseStepsLeft <= 0) {
        if (match.phase === 'goal') endGoalPause(match);
        else endHalfTime(match);
      }
      break;
    }
    case 'play':
    case 'golden-goal':
      stepOpenPlay(match, inputs, rng);
      break;
    case 'over':
      break;
  }
  match.stepCount++;
  match.clockMs = match.halfStep * STEP_MS;
  updateControlled(match.players, match.ball, match.controlled);
}
```

> `formationsOf` construye una tupla de dos referencias **solo en eventos** (saque inicial, penalti, saque), nunca por paso. Si se prefiere cero asignaciones también ahí, `MatchState.scratch` puede llevar `formations: [Formation, Formation]` que `applyTeamChoices` mantenga al día; es equivalente.

> El `advanceClock` en la rama de **gol** no se llama a propósito: el paso en que se marca ya no cuenta como tiempo de juego, y la pausa de gol tampoco. Es una decisión de un paso de diferencia sin efecto en las reglas; el test del reloj mide partes **sin** goles.

- [ ] **Step 4: Verde, compilación y build**

Run: `npx vitest run` → todo verde (unos 60 tests nuevos: la tabla de guardas genera 7 transiciones × 7 fases). `npx tsc --noEmit` limpio. `grep -rn "Math.random\|Date.now\|performance.now\|Math.sin\|Math.cos\|Math.atan2\|Math.hypot" components/games/football-logic/` vacío. **`npm run build` verde** (cierra la etapa A). El test del partido grabado corre tres partidos en lockstep: debe quedar por debajo de **3 s**; si tarda más, revisar que `sameMatch` y `policy` no asignen dentro del bucle.

- [ ] **Step 5: Recorrido de exportaciones, verificación y commit propuesto**

Recorrer `grep -n "^export" components/games/football-logic/*.ts` y comprobar que cada símbolo tiene un import fuera de su fichero **o** aparece en el resumen final como "consumido por Task 6/7/8". Exportaciones nuevas de esta tarea con destino declarado: `MatchState`, `createMatch`, `stepMatch`, `abandon`, `isOpenPlay`, `HALF_STEPS`, `HALF_SECONDS` → Task 8 (componente); `gkPenaltyRead`, `strategies`, `formationIndex`, `lastGoalTeam` → Task 6 (`ai.ts`: cambio de estrategia por marcador y perfil del portero).

Mensaje propuesto: `feat(world-cup): match state machine with guarded transitions, two halves, golden goal and the recorded-match test`

---

## Resumen de exportaciones por tarea y su consumidor

Al cerrar la Task 5 todo símbolo exportado de `football-logic/` está en una de estas dos columnas. Lo marcado "Task 6/7/8" queda **sin consumidor de código** en esta etapa a propósito y se revisa al cerrar la etapa B (paso 7) y la C (paso 8).

| Tarea | Exportación | Consumidor en la etapa A | Consumidor previsto |
|---|---|---|---|
| 1 | `Rng`, `createRng` | `actions.ts`, `set-pieces.ts`, `match.ts`, tests | `ai.ts` (Task 6), componente (Task 8) |
| 1 | `PitchDef`, `Side`, `PITCH`, `centerX`, `centerY`, `goalLineX`, `penaltySpotX`, `isBetweenPosts`, `isInsideBigArea`, `isInsideSmallArea`, `clampToBigArea` | `players.ts`, `referee.ts`, `set-pieces.ts`, `match.ts`, `invariants.ts`, tests | `ai.ts` (`isInsideSmallArea`: el portero solo sale en el área pequeña), componente |
| 1 | `Role`, `OutfieldRole`, `Strategy`, `Kit`, `TeamDef`, `FormationSlot`, `Formation`, `TEAM_SIZE`, `OUTFIELD`, `STRATEGY_SHIFT`, `STRATEGIES`, `FORMATIONS`, `TEAMS`, `teamById`, `slotCounts` | `players.ts`, `input.ts`, `set-pieces.ts`, `match.ts`, `invariants.ts`, tests | `ai.ts` (`STRATEGIES`), `world-cup.ts` (Task 9: `TEAMS`, `teamById`) |
| 1 | `BANK_SIZE`, `FORMATION_COUNT`, `checkBank`, `checkFormations` | `invariants.test.ts` (fixture fabricado) | **paso 7**: `teams.test.ts` los aplica a `TEAMS` y `FORMATIONS` reales |
| 1 | `checkPitch`, `checkFormation`, `checkTeam`, `checkTeams` | `pitch.test.ts`, `teams.test.ts`, `invariants.test.ts` | — |
| 2 | `Vec2`, `INV_SQRT2`, `dist`, `normalizeInto`, `clamp` | `players.ts`, `ball.ts`, `actions.ts`, `referee.ts`, `set-pieces.ts` | `ai.ts` |
| 2 | `ButtonState`, `Axis`, `TeamInput`, `createTeamInput`, `copyTeamInput`, `isDown` | `step.ts`, `actions.ts`, `set-pieces.ts`, `match.ts`, tests | componente (teclado → `TeamInput`), `ai.ts` |
| 2 | `checkTeamInput` | `input.test.ts` | **Task 6**: "la IA nunca produce una entrada inválida" |
| 2 | `STEPS_PER_SECOND`, `STEP_MS`, `stepsFor`, `perStep` (`clock.ts`, re-exportados por `step.ts`), `AttackDirs`, `stepPhysics` | `players.ts`, `ball.ts`, `actions.ts`, `set-pieces.ts`, `match.ts`, `invariants.ts` | componente (acumulador con `STEP_MS`, tope 5 pasos/frame) |
| 2 | `PlayerState`, velocidades y tiempos, `ownGoalSide`, `anchorFor`, `createPlayers`, `placeByFormation`, `isPlayerDown`, `isSprinting`, `stepPlayer` | `step.ts`, `ball.ts`, `actions.ts`, `set-pieces.ts`, `match.ts`, tests | `ai.ts` (`anchorFor`, `GK_LINE_DIST`, `isSprinting`), componente (dibujo) |
| 2 | `BallState`, constantes del balón, `createBall`, `givePossession`, `stickToOwner`, `kickBall`, `canPickUp`, `stepBall` | `step.ts`, `actions.ts`, `set-pieces.ts`, `match.ts`, tests | `ai.ts` (`POSSESSION_RADIUS`), componente |
| 2 | `checkGoalkeepersInBox` | `invariants.test.ts`, `match.test.ts` | Task 6 (test de la IA del portero) |
| 3 | `ActionEvent`, `ActionKind`, `createActionEvent`, `clearActionEvent`, `applyButtons`, `stepTackle`, `releaseFromGoalkeeper`, `updateControlled` | `match.ts`, tests | componente (SFX por `ActionEvent.kind`) |
| 3 | `shoot`, `shortPass`, `longPass`, `shotSpeed`, `steal`, `startTackle` | `set-pieces.ts`, `actions.ts` (interno), tests | `ai.ts` |
| 3 | constantes de acciones (`SHOT_*`, `*_PASS_*`, `STEAL_*`, `TACKLE_*`, `CONTROL_HYSTERESIS`, `GK_HOLD_*`) | `actions.ts`, tests | `ai.ts` (árbol chutar/pasar/robar), Task 6 |
| 4 | `SetPieceKind`, `CallKind`, `RefereeCall`, `createRefereeCall`, `clearRefereeCall`, `teamAttackingSide`, `teamDefendingSide`, `judgeBall`, `judgeFoul` | `set-pieces.ts`, `match.ts`, tests | componente (rótulos de saque) |
| 4 | `PenaltySide`, `SetPieceState`, constantes de saque, `createSetPieceState`, `beginSetPiece`, `stepSetPiece` | `match.ts`, tests | componente (cuenta atrás y dirección dibujadas), `ai.ts` (la CPU elige dirección/lado) |
| 5 | `MatchPhase`, `MatchState`, constantes del partido, `kickoffTeamFor`, `isOpenPlay`, `createMatch`, transiciones, `stepMatch` | `match.test.ts` | **Task 8** (componente): `createMatch`, `stepMatch`, `abandon`, `isOpenPlay`, `HALF_STEPS`; **Task 6**: `gkPenaltyRead`, `strategies`, `score`, `half`, `halfStep` |

## Notas de riesgo para quien ejecute

- **El determinismo se rompe en silencio** (riesgo 3). Los dos tests que lo fijan (`step.test.ts` sobre la física, `match.test.ts` sobre el partido grabado) son la única red. Si alguno falla tras un cambio, la causa es un no-determinismo nuevo, **no** el test: buscar `Math.random`, `Date.now`, orden de `Set`/`Map`, trigonometría, o un `rng()` que se consume en una rama condicional distinta entre dos ejecuciones.
- **`players[i].id === i`** es lo que hace O(1) `players[ball.owner]`, `players[sp.takerId]` y el portero por `team * TEAM_SIZE`. Cualquier futuro `sort`/`filter` que devuelva un array nuevo para el estado rompe esto. Los cambios de banquillo de la v1.5 deberán intercambiar campos, no elementos.
- **El `rng` solo se consume en dos sitios** en esta etapa (robo en alcance y penalti). La Task 6 añadirá la IA como tercer consumidor. Cada nuevo `rng()` debe ser **incondicional respecto a cosas no deterministas** y consumirse igual para los dos equipos.
- **El motor no valida entradas por paso** (coste): `checkTeamInput` existe para el test de la IA. El componente rellena `TeamInput` desde su propio mapa de teclas, que solo produce valores válidos por construcción.
- **`clockMs` es derivado** de `halfStep`; el HUD lo lee, nada lo escribe salvo `stepMatch`.

## Self-Review (hecho al cerrar el plan; correcciones aplicadas inline)

1. **Cobertura del spec (pasos 1-5 y criterios 1-12 salvo los de pantalla):** paso 1 → Task 1 (red + 2 selecciones + 1 formación); paso 2 → Task 2 (`STEP_MS`, física, test que manda); paso 3 → Task 3 (acciones + controlado); paso 4 → Task 4 (árbitro + saques con penalti); paso 5 → Task 5 (fases guardadas, reloj, cambio de campo, gol de oro, partido grabado). Criterio 1 → `step.test.ts` + `match.test.ts`; 2 → `stepMatch(match, [a, b], rng)` y el grep de determinismo; 3 → `checkFormation`/`checkTeams` con negativos; 4 → `createPlayers` + `updateControlled` nunca portero; 5 → histéresis 30/41; 6 → `stickToOwner` + `steal` + `stepTackle`; 7 → `applyButtons` con y sin balón; 8 → tres desenlaces; 9 → `judgeFoul`; 9b → `clampToBigArea` en `stepPlayer` + `checkGoalkeepersInBox` en un partido entero; 10 → `stepSetPiece` con cruceta y 300 pasos; 11 → `applyTeamChoices` (la colocación viva es Task 6, como dice el spec); 12 → `HALF_STEPS`, `endHalf`, gol de oro sin tope (la CPU a ataque es Task 6). Los criterios 13-22 son de las etapas B-D. **Huecos aceptados a propósito:** la regla del portero "sale solo en el área pequeña" y `catchChance` (sección IA del spec) son Task 6; en esta etapa el portero recoge por proximidad como cualquiera.
2. **Placeholders:** ningún "TBD/TODO/similar to"; cada test y cada implementación están completos. Todos los ficheros referenciados están definidos en alguna tarea (`clock.ts` incluido, en la Task 2).
3. **Consistencia de tipos y nombres entre tareas (corregido inline):** `isDown` existe dos veces con significado distinto — `isDown(ButtonState)` en `input.ts` y el estado del jugador se llama `isPlayerDown` en `players.ts` para evitar la colisión. `Strategy` vive en `teams.ts` y `input.ts` la re-exporta. `SetPieceKind` vive en `referee.ts` y `set-pieces.ts` la importa (nunca al revés). `AttackDirs` vive en `step.ts`. La firma de `stepPhysics` es idéntica en Task 2 (definición y test), Task 5 (`stepOpenPlay`) y el resumen. `stepPlayer` **no** descuenta `tackleStepsLeft` (lo hace `stepTackle`); el test de Task 2 lo afirma. `beginSetPiece`/`stepSetPiece` tienen la misma lista de parámetros en Task 4 y en `match.ts`. `players[team * TEAM_SIZE]` es el portero en `set-pieces.ts` y `match.ts` por el invariante de ids de Task 2.
