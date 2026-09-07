# Vault World Cup — Etapa B2 (prórroga con tope y tanda de penaltis) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el paso 7b del spec sobre el motor de las etapas A y B: la prórroga deja de ser un gol de oro sin fin y pasa a ser **una parte de 60 s con reloj y con gol de oro dentro**; si se agota empatada, el partido entra en una **tanda de cinco penaltis por equipo con muerte súbita** que reutiliza la pieza de penalti que ya existe y que **termina siempre**. Todo en `components/games/football-logic/`, sin una línea de pantalla.

**Architecture:** Ninguna fase nueva salvo `'shootout'` (decisión del spec, S-PK6): `half === 3` ya ES la prórroga y su juego abierto sigue siendo `'golden-goal'`. El cambio se reparte en tres sitios y nada más. (1) **El reloj**: `advanceClock` pierde su guarda `half === 3` —el ruling R18 queda **sustituido** por la decisión de Paco del 06-sep— y la cola de `stepOpenPlay` gana la rama de la prórroga, que llama a `endExtraTime` al llegar a `EXTRA_TIME_STEPS` exactamente como la de `'play'` llama a `endHalf` al llegar a `HALF_STEPS`. (2) **El estado**: `MatchState` gana `shootout: ShootoutState | null`, con el objeto creado una sola vez en `createMatch` dentro de `scratch` (mismo patrón que `scratch.setPiece`: cero asignación por paso). (3) **La tanda**: `set-pieces.ts` pone el estado, el orden de lanzadores, la colocación y la **regla de fin** (`shootoutWinner`, función pura sobre los contadores), y `match.ts` pone la máquina —contar atrás con `stepSetPiece`, mover el balón con `stepBall`, juzgar con `judgeBall`, y encadenar el siguiente lanzamiento—. La tanda **no toca `match.score`**: lleva su propio marcador y quien decide el ganador del partido es `winnerOf(match)`, el único símbolo nuevo que la etapa C y `world-cup.ts` necesitan leer.

**Tech Stack:** TypeScript estricto, vitest 4.1.11 (tests `*.test.ts` junto al código, sin `vitest.config`), Node. Ni React ni canvas ni Supabase en esta etapa.

**Spec:** `specs/31-vault-world-cup.md` (Approved; §Alcance "dos partes de 90 segundos… prórroga… tanda", §Modelo de datos —`MatchPhase` con `'shootout'`, `ShootoutState`, `half: 3`—, tabla "Números de partida" (`EXTRA_TIME_SECONDS`, `SHOOTOUT_RESOLVE_SECONDS`), §Decisiones estructurales, **§"Etapa B2" con los supuestos S-PK1..S-PK6**, criterios 12 y 23, §Decisiones entrada 2026-09-06, §Riesgos riesgo 8) · Plan de la etapa B: `docs/superpowers/plans/2026-09-05-vault-world-cup-stage-b.md` (Global Constraints heredadas) · Informe final de la etapa B: `.superpowers/sdd/2026-09-05-vault-world-cup-stage-b/final-review-report.md` (§8 recomendación 2: "el gol de oro no tiene techo… cablear una salida"; mecanismo de sondas P0) · Ledger: `.superpowers/sdd/2026-09-05-vault-world-cup-stage-b/progress.md` (R26, R28; y R18 del ledger de la etapa A, que esta etapa sustituye).

---

## Global Constraints

Heredadas literalmente de las etapas A y B, con la baseline actualizada. Los requisitos de cada tarea incluyen implícitamente esta sección.

- **Commits: SOLO Paco.** Ninguna tarea ejecuta `git add` ni `git commit`. Cada tarea termina dejando el working tree **verificado** (`npx vitest run` + `npx tsc --noEmit`; `npm run build` además al cerrar la etapa) y **propone el mensaje de commit exacto** en un paso "Propose commit". Si hiciera falta `--no-verify`, se avisa. Rama `main` (mismo patrón que los 13 juegos anteriores).
- **Nunca arrancar `next dev`**: Paco tiene el suyo en :3000. Esta etapa no tiene pantalla: la verificación es la suite, el compilador y las sondas del cierre.
- **Comentarios y nombres de tests en inglés** (convención del repo). El plan, el spec y el chat, en castellano.
- **Ficheros en kebab-case**; tipos en PascalCase; `SCREAMING_CASE` para constantes de módulo. TypeScript estricto: nada de `any`, nada de `!` gratuito, nada de `as` para tapar un tipo.
- **Nada de estado de módulo.** El campo, las selecciones, las formaciones, el estado del partido, el perfil, el `AiState` y el `rng` **se pasan siempre por parámetro**. Las funciones nuevas de `set-pieces.ts` y `players.ts` reciben `pitch`, `players`, `ball` y `attackDir`; ninguna lee `PITCH`, `TEAMS` ni `FORMATIONS`.
- **Determinismo (riesgo 3 del spec): PROHIBIDO en `football-logic/`** `Math.random`, `Date.now`, `performance.now`, iterar un `Set` o un `Map` para decidir un orden, y `Math.sin`/`Math.cos`/`Math.atan2`/`Math.hypot`. La rejilla de la tanda se calcula con aritmética entera (`k % 5`, `(k - col) / 5`), **nunca con trigonometría para repartir un círculo**. Los desempates son siempre por `id` más bajo. Antes de cerrar cada tarea: `grep -rn "Math.random\|Date.now\|performance.now\|Math.sin\|Math.cos\|Math.atan2\|Math.hypot" components/games/football-logic/` debe devolver **vacío**, tests incluidos (ruling R12).
- **Azar SOLO por el `rng` inyectado.** En la tanda el **único** consumidor de `rng` dentro de `stepMatch` es la lectura del portero dentro de `executePenalty` (1 tirada si acierta el lado, 2 si falla), en el paso en que el lanzamiento se ejecuta y en ningún otro. No hay robo, ni atajada de juego abierto, ni error angular durante la tanda. Fuera del paso, `decideTeamInput` sigue consumiendo **su propio** `rng` (S11: una tirada por lanzamiento).
- **Paso fijo: nada de `dtMs` dentro del motor.** `EXTRA_TIME_SECONDS` y `SHOOTOUT_RESOLVE_SECONDS` se convierten a pasos con `stepsFor` en `clock.ts` / `set-pieces.ts`; el motor razona en pasos.
- **Sin asignación de memoria por paso.** `stepShootout`, `judgeShootoutKick`, `finishShootoutKick`, `shootoutWinner`, `kicksLeft`, `beginShootoutKick` y `placeAroundCentreSpot` escriben en el estado y en out-params: nada de `filter`/`map`/spread/objetos literales/`new`/closures. El `ShootoutState` se crea **una vez** en `createMatch` (`scratch.shootout`) y `endExtraTime` lo reutiliza con `resetShootout`.
- **Los números del spec van a constantes con nombre**: `EXTRA_TIME_SECONDS = 60`, `SHOOTOUT_RESOLVE_SECONDS = 4`, `SHOOTOUT_ROUNDS = 5`. Lo que el spec NO da se pone también en constantes marcadas `// Stage B2 assumption S-PKn, not in the spec — review in QA`, y se lista en la sección "Supuestos abiertos" del final. Los supuestos que el spec YA fija (S-PK1..S-PK6) se etiquetan en el código `// Stage B2 assumption S-PKn` tal cual, sin decidir nada por encima de ellos.
- **Regla anti-coincidencia de fixtures (riesgo 7 del spec):** antes de dar por bueno un test, preguntarse "¿pasaría este test con otros números?". En esta etapa, en concreto: el tope de la prórroga se comprueba en **N−1 verde / N rojo**, nunca solo en N; el corte por imposibilidad matemática se comprueba con el caso exacto (3-0 tras tres y tres) **y** con el caso vecino que NO corta (3-0 tras tres y dos); la muerte súbita se comprueba en sus dos formas (falla el primero que lanza / falla el segundo); el guion de la tanda afirma el marcador **y** los contadores `taken`, no solo el ganador; el test de determinismo afirma el paso o el contador en que dos semillas divergen; ninguna posición de la rejilla de la tanda cae exactamente sobre el radio del círculo central.
- **Todo lo exportado tiene consumidor** al cerrar la etapa: código o test. Lo que espera a la etapa C lleva su línea de destino escrita (`// exported for Task 8/9: …`).
- **Baseline verificada 2026-09-06 (tras el commit `5e1e1a3` de la etapa B): 861 tests en 52 ficheros verdes**, `npx tsc --noEmit` limpio, `npm run build` verde. Cada tarea suma y no regresa. Comprobado hoy con `npx vitest run`: `Test Files 52 passed (52) · Tests 861 passed (861)`.
- **Si un test existente cambia de valor esperado es un bug que hay que INVESTIGAR, no relajar.** Las ÚNICAS expectativas con **fecha de caducidad declarada** en esta etapa —cambiarlas es el trabajo, no una regresión— son estas ocho, todas en `match.test.ts` salvo la última:
  1. `'a 0-0 match goes to a golden goal that never times out'` (match.test.ts:240) → se reescribe: la prórroga **sí** se acaba, en `EXTRA_TIME_STEPS` exactos, y desemboca en `'shootout'`. Es la decisión de Paco del 06-sep sustituyendo al gol de oro sin tope del 03-sep (Task 7b-1).
  2. `'the golden-goal clock does not move through a set piece either'` (match.test.ts:256) → se reescribe con el signo contrario: el reloj **sí** corre en la parte 3, también a través de un saque. Es el ruling R18 **sustituido** por el spec de hoy (Task 7b-1).
  3. `PHASES` (match.test.ts:22) gana `'shootout'`, lo que genera automáticamente las filas de rechazo de la tabla de guardas para la fase nueva (Task 7b-1).
  4. La aserción de unión de fases de R26 (match.test.ts, final del segundo partido grabado) pasa a recorrer una constante nueva `RECORDED_PHASES` = `PHASES` menos `'shootout'`, con comentario: ninguna de las dos policies grabadas puede llegar a la tanda (las dos deciden el partido antes), y la tanda tiene sus propios partidos grabados en la Task 7b-2. **No se relaja nada**: la cobertura de las siete fases anteriores sigue exigida igual (Task 7b-1).
  5. `snapshot()` (match.test.ts:41) y `sameMatch()` (match.test.ts:668) suman el campo nuevo `shootout` de `MatchState`, igual que la etapa B les sumó `catchRolled`: un campo nuevo se añade conscientemente o deja de estar comprobado (Task 7b-1).
  6. `forcePhase()` (match.test.ts:35) gana el caso `'shootout'` (fija `shootout` al objeto de scratch y `half = 3`) (Task 7b-1).
  7. La fila `abandon` de la tabla de guardas gana `'shootout'` en su lista `legal`, y la tabla gana dos filas nuevas (`endExtraTime`, `endShootout`) (Task 7b-1).
  8. `ALL_PHASES` (ai.test.ts:815) gana `'shootout'`. Es una lista de filtro para el informe, no una aserción: ninguna expectativa de `ai.test.ts` cambia (Task 7b-1).

  **Todo lo demás debe seguir en verde sin tocarlo**, y en particular estas dos cosas, que se han **medido hoy** contra el motor actual precisamente para poder exigirlas:
  - **R26, el partido grabado "golden goal with live AI"**, sigue verde **sin cambiar una aserción**: medido con una sonda que replica su policy y su semilla, el partido entra en la parte 3 en el paso 10 980 y termina en el 13 376, es decir **2 396 pasos de prórroga de los 3 600 disponibles** — el tope no llega a dispararse. Lo único que hay que reescribir de ese test es el **comentario** de números medidos, para dejar dicho que la prórroga cabe en el tope con 1 204 pasos (20 s) de margen. Si tras el cambio ese test se pone rojo: **BLOCKED con la medición**, no se toca la policy.
  - **Los partidos CPU vs CPU de `ai.test.ts` no llegan al tope**: medido seed a seed sobre las semillas que usan los tests (14; **15**, jugada dentro del test `(e)` vía `playCpuMatch(SEED + 1, ...)` y omitida de esta lista hasta el pre-vuelo de la B2 [hallazgo H8] — **1 008 pasos** de prórroga; 21-32 a 8v1; 31 con los cuatro pares de formaciones; 100-111 con cap 900), la prórroga más larga de todas dura **1 841 pasos** (seed 31, par `[0,2]`), muy por debajo de 3 600. Ningún test de `ai.test.ts` cambia de resultado.
- **Tipos y firmas idénticos entre tareas.** Las firmas que este plan consume son las del código REAL de hoy, comprobadas sobre `components/games/football-logic/`: `stepMatch(match, inputs, rng)`, `stepSetPiece(sp, input, players, ball, rng, penaltyReadChance, attackDir, pitch, stepCount, aim, out)`, `beginSetPiece(sp, kind, team, x, y, players, ball, formations, strategies, attackDir, pitch, stepCount)`, `judgeBall(ball, attackDir, pitch, out)`, `clearRefereeCall(out)`, `stepBall(ball, players, stepCount, pitch)`, `givePossession(ball, p, stepCount)`, `placeByFormation(players, team, formation, strategy, attackDir, pitch)`, `ownGoalSide(attackDir)`, `penaltySpotX(pitch, side)`, `centerX(pitch)`, `centerY(pitch)`, `checkGoalkeepersInBox(players, attackDir, pitch)`, `decideTeamInput(match, team, profile, state, rng, out)`, `createMatch(teams, formationTable, pitch, profiles)`. `placeTaker`, `nearestOutfield` y `pushRivalsAway` son **privadas** de `set-pieces.ts`; `beginShootoutKick` vive en ese mismo fichero justamente para poder usar `placeTaker` sin exportarla.

---

## File Structure

Orden de dependencias (una fila solo importa de las de arriba). La tanda **no** crea ningún fichero nuevo: el spec ya reparte la responsabilidad entre `set-pieces.ts` (los lanzamientos) y `match.ts` (la fase y el estado), y meter un `shootout.ts` obligaría a `match.ts` a importar de dos sitios lo que hoy importa de uno.

| Fichero | Tarea | Cambio |
|---|---|---|
| `clock.ts` | 7b-1 | + `EXTRA_TIME_SECONDS = 60` y `EXTRA_TIME_STEPS = stepsFor(60)` (3 600), junto a `HALF_SECONDS`, sin imports |
| `step.ts` | 7b-1 | la línea de re-export del contrato del reloj gana las dos constantes nuevas |
| `players.ts` | 7b-2 | + `placeAroundCentreSpot(players, takerId, pitch)` y las tres constantes de la rejilla (S-PK4/S-PK7/S-PK10) |
| `set-pieces.ts` | 7b-1 | + `ShootoutState`, `createShootoutState`, `resetShootout`, `shootoutWinner`, `SHOOTOUT_ROUNDS`, `SHOOTOUT_RESOLVE_SECONDS`, `SHOOTOUT_RESOLVE_STEPS` |
| `set-pieces.ts` | 7b-2 | + `shootoutTakerId(team, taken)` y `beginShootoutKick(sp, sh, players, ball, formations, strategies, attackDir, pitch, stepCount)` |
| `match.ts` | 7b-1 | `MatchPhase` + `'shootout'`; `MatchState.shootout`; `scratch.shootout`; `advanceClock` sin la guarda R18; cola de `stepOpenPlay` con la rama de la prórroga; `endExtraTime`, `endShootout`, `winnerOf`; caso `'shootout'` del switch en espera; re-export de las constantes nuevas y del tipo `ShootoutState` |
| `match.ts` | 7b-2 | `startShootoutKick`, `stepShootout`, `judgeShootoutKick`, `finishShootoutKick`; `endExtraTime` arranca ya el primer lanzamiento; el caso `'shootout'` pasa a llamar a `stepShootout` |
| `ai.ts` | 7b-2 | `decideTeamInput` trata `'shootout'` como fase de pieza (S11 sigue eligiendo lado); `AiState` gana `penaltyKickIndex` para volver a tirar una vez por lanzamiento (S-PK11) |
| `match.test.ts` | 7b-1, 7b-2 | caducidades 1-7; tope exacto N−1/N; gol de oro en el último paso; tabla de verdad de `shootoutWinner` y `winnerOf` (7b-1). Tanda guionizada completa: gol, atajada, fuera, timeout de 4 s, corte por imposibilidad, muerte súbita en sus dos formas, invariantes y determinismo (7b-2) |
| `set-pieces.test.ts` | 7b-2 | orden de lanzadores (S-PK3) y colocación de un lanzamiento (S-PK4/S-PK7) |
| `players.test.ts` | 7b-2 | `placeAroundCentreSpot`: quince en la rejilla dentro del círculo, porteros intactos, todos parados |
| `ai.test.ts` | 7b-1, 7b-2 | caducidad 8 (7b-1); la CPU elige lado en cada lanzamiento con una sola tirada, y la propiedad "la tanda termina siempre" sobre treinta semillas (7b-2) |

**Subdivisión de la Task 7b en 7b-1/7b-2 (justificación en una línea):** 7b-1 (el reloj de la prórroga, la puerta a la tanda y la aritmética pura de quién gana) y 7b-2 (los lanzamientos: colocación, ejecución, resolución y encadenado) son dos entregables con test propio —un revisor puede aprobar el tope de la prórroga y rechazar la mecánica de los penaltis— y juntos superan de largo un solo ciclo implementar→revisar. La numeración del spec (paso 7b) se conserva.

---

## Task 7b-1: la prórroga con tope y la puerta de la tanda

**Files:**
- Modify: `components/games/football-logic/clock.ts`
- Modify: `components/games/football-logic/step.ts:7`
- Modify: `components/games/football-logic/set-pieces.ts`
- Modify: `components/games/football-logic/match.ts`
- Test: `components/games/football-logic/match.test.ts`
- Test: `components/games/football-logic/ai.test.ts:815` (solo la lista `ALL_PHASES`)

**Interfaces:**
- Consumes (etapas A y B, sin cambios): `stepsFor(seconds)`, `HALF_STEPS`, `createSetPieceState()`, `beginSetPiece(...)`, `stepSetPiece(...)`, `judgeBall(ball, attackDir, pitch, out)`, `createMatch(teams, formationTable, pitch, profiles)`.
- Produces (lo que la Task 7b-2 y la etapa C consumen):
  - `clock.ts`: `export const EXTRA_TIME_SECONDS = 60` · `export const EXTRA_TIME_STEPS: number` (3 600). Re-exportadas por `step.ts` y por `match.ts`.
  - `set-pieces.ts`: `export const SHOOTOUT_ROUNDS = 5` · `export const SHOOTOUT_RESOLVE_SECONDS = 4` · `export const SHOOTOUT_RESOLVE_STEPS: number` (240) · `export type ShootoutState = { taken: [number, number]; scored: [number, number]; team: 0 | 1; takerId: number; suddenDeath: boolean; resolveStepsLeft: number }` · `export function createShootoutState(): ShootoutState` · `export function resetShootout(sh: ShootoutState): void` · `export function shootoutWinner(sh: ShootoutState): 0 | 1 | -1`.
  - `match.ts`: `MatchPhase` gana `'shootout'` · `MatchState.shootout: ShootoutState | null` · `MatchState.scratch.shootout: ShootoutState` · `export function endExtraTime(match: MatchState): boolean` · `export function endShootout(match: MatchState): boolean` · `export function winnerOf(match: MatchState): 0 | 1 | -1` (**destino Task 9**: `world-cup.ts` decide el cruce con esto, y el HUD de la Task 8 pinta el ganador con esto).

- [ ] **Step 1: Escribir el test rojo del tope exacto de la prórroga (N−1 verde / N rojo)**

En `match.test.ts`, dentro del `describe('stepMatch drives the clock and the phases with idle inputs')`, **sustituir** el test `'a 0-0 match goes to a golden goal that never times out'` (caducidad 1) por este. La nota N1 del `describe` sigue valiendo: con entradas en vacío el balón acaba parado en poder de un rival estático y la parte 3 no ve ni un saque, así que el reloj sube un paso por paso y la cuenta es exacta.

```ts
  // Stage B2 (Paco, 06-sep): the golden goal no longer runs forever. It lives inside
  // an extra time of EXTRA_TIME_SECONDS, and a 0-0 extra time ends in a shootout on
  // the step the clock reaches the cap -- not one step earlier (anti-coincidence: the
  // N-1 sample below is what makes "exactly" mean exactly).
  // Measured with idle inputs: half 3 opens at step 2 * HALF_STEPS + HALF_TIME_PAUSE_STEPS
  // with halfStep 0, and from there the kickoff countdown and the open play that follows
  // advance the clock one step per step, with no set piece in between.
  it('a 0-0 extra time ends in a shootout at exactly EXTRA_TIME_STEPS, and not one step before', () => {
    const m = fresh();
    const rng = createRng(1);
    idle(m, 2 * HALF_STEPS + HALF_TIME_PAUSE_STEPS, rng);
    expect(m.half).toBe(3);
    expect(m.phase).toBe('kickoff');
    expect(m.halfStep).toBe(0);
    idle(m, EXTRA_TIME_STEPS - 1, rng);
    expect(m.phase).toBe('golden-goal');
    expect(m.halfStep).toBe(EXTRA_TIME_STEPS - 1);
    expect(m.shootout).toBeNull();
    idle(m, 1, rng);
    expect(m.phase).toBe('shootout');
    expect(m.halfStep).toBe(EXTRA_TIME_STEPS);
    expect(m.stepCount).toBe(2 * HALF_STEPS + HALF_TIME_PAUSE_STEPS + EXTRA_TIME_STEPS);
    expect(m.score).toEqual([0, 0]);
    expect(m.shootout).not.toBeNull();
    expect(m.shootout?.taken).toEqual([0, 0]);
    expect(m.shootout?.scored).toEqual([0, 0]);
    expect(m.shootout?.team).toBe(0);              // S-PK3: team 0 opens the shootout
    expect(m.shootout?.suddenDeath).toBe(false);
  });
```

Y añadir a los imports de `match.test.ts` (línea 12-15) `EXTRA_TIME_SECONDS`, `EXTRA_TIME_STEPS`, `endExtraTime`, `endShootout` y `winnerOf` desde `./match`, y `SHOOTOUT_ROUNDS`, `shootoutWinner`, `createShootoutState`, `type ShootoutState` desde `./set-pieces`.

Stage B2 finding H5: `EXTRA_TIME_SECONDS` entraba en esos imports sin que ningún test lo afirmara. En el `describe('constants')` que ya existe en `match.test.ts` (el que fija `HALF_SECONDS`/`HALF_STEPS`), añadir:

```ts
  expect(EXTRA_TIME_SECONDS).toBe(60);
  expect(EXTRA_TIME_STEPS).toBe(3600);
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npx vitest run components/games/football-logic/match.test.ts -t 'extra time ends in a shootout'`
Expected: FAIL en compilación — `EXTRA_TIME_STEPS`, `endExtraTime` y `m.shootout` no existen.

- [ ] **Step 3: Las dos constantes del reloj**

En `clock.ts`, debajo de `HALF_STEPS`:

```ts
// Stage B2 (Paco, 06-sep): the golden goal now lives inside a capped extra time, so
// half 3 finally has something to measure. Here, next to HALF_SECONDS, so ai.ts and
// match.ts read it through step.ts without importing match.ts at runtime.
export const EXTRA_TIME_SECONDS = 60;
export const EXTRA_TIME_STEPS = stepsFor(EXTRA_TIME_SECONDS);
```

En `step.ts:7`, ampliar la línea del contrato público del paso:

```ts
export { STEPS_PER_SECOND, STEP_MS, HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS, EXTRA_TIME_SECONDS, EXTRA_TIME_STEPS, stepsFor, perStep } from './clock';
```

- [ ] **Step 4: El estado de la tanda y la regla de quién gana, en `set-pieces.ts`**

Al final de `set-pieces.ts`, después de `stepSetPiece`:

```ts
// ── The shootout (stage B2, S-PK1..S-PK6) ────────────────────────────────────
//
// The state lives here, not in match.ts, because every kick IS the penalty set
// piece above (S-PK1) and because beginShootoutKick (Task 7b-2) needs placeTaker,
// which is private to this file. match.ts re-exports the type, so MatchState reads
// `shootout: ShootoutState | null` exactly as the spec's data model writes it.

export const SHOOTOUT_ROUNDS = 5;
// exported for Task 8: the HUD counts the resolution down in seconds, not in steps
export const SHOOTOUT_RESOLVE_SECONDS = 4;
export const SHOOTOUT_RESOLVE_STEPS = stepsFor(SHOOTOUT_RESOLVE_SECONDS);

export type ShootoutState = {
  taken: [number, number];        // kicks already taken by each team
  scored: [number, number];       // the shootout's own scoreboard -- never added to match.score
  team: 0 | 1;                    // whose turn it is
  takerId: number;                // this turn's outfield taker
  suddenDeath: boolean;           // false through the first five of each team
  resolveStepsLeft: number;       // countdown after the kick (S-PK2); 0 while it is still to be taken
};

export function createShootoutState(): ShootoutState {
  return { taken: [0, 0], scored: [0, 0], team: 0, takerId: -1, suddenDeath: false, resolveStepsLeft: 0 };
}

// In place: the object is created once per match (match.scratch.shootout) and the
// step never allocates.
export function resetShootout(sh: ShootoutState): void {
  sh.taken[0] = 0;
  sh.taken[1] = 0;
  sh.scored[0] = 0;
  sh.scored[1] = 0;
  sh.team = 0;                    // S-PK3: team 0 kicks first
  sh.takerId = -1;
  sh.suddenDeath = false;
  sh.resolveStepsLeft = 0;
}

// Kicks `team` still has coming. Inside the five it is what is left of the five;
// in sudden death it is the kick of the current round it still owes (the rounds
// alternate, so the trailing team always owes exactly one).
function kicksLeft(taken: readonly [number, number], team: 0 | 1): number {
  const regulation = SHOOTOUT_ROUNDS - taken[team];
  const round = taken[team === 0 ? 1 : 0] - taken[team];
  const most = regulation > round ? regulation : round;
  return most > 0 ? most : 0;
}

// The whole of S-PK5 in one pure function of the counters, so the phase machine and
// the HUD read the same rule: the shootout is cut as soon as it is mathematically
// impossible to catch up, and in sudden death the first team to miss loses.
export function shootoutWinner(sh: ShootoutState): 0 | 1 | -1 {
  if (sh.scored[0] > sh.scored[1] + kicksLeft(sh.taken, 1)) return 0;
  if (sh.scored[1] > sh.scored[0] + kicksLeft(sh.taken, 0)) return 1;
  // S-PK5, literally "the first to miss loses": level on goals, with one team one
  // kick ahead of the other, can only mean that extra kick missed -- had it scored,
  // the scores would differ. So the rival wins there and then, without taking its
  // own kick of the round. The `scored[0] === scored[1]` guard is what makes this
  // clause fire ONLY on a miss: without it, a kick that is SCORED while the taker
  // is a kick ahead (e.g. [6,5]/[6,5], team 1 still owes its sixth) would also
  // match `taken[0] !== taken[1]` and hand the match to the team that just scored
  // (Stage B2 finding H1). With the guard, this clause and the two cut clauses
  // above are mutually exclusive -- the cuts need an UNEVEN scoreboard, this one
  // needs an EVEN one -- so the order they are checked in stops mattering.
  if (sh.scored[0] === sh.scored[1] && sh.taken[0] >= SHOOTOUT_ROUNDS && sh.taken[1] >= SHOOTOUT_ROUNDS && sh.taken[0] !== sh.taken[1]) {
    return sh.taken[0] > sh.taken[1] ? 1 : 0;
  }
  return -1;
}
```

- [ ] **Step 5: La fase, el estado y las transiciones en `match.ts`**

(a) La unión de fases y el estado:

```ts
export type MatchPhase = 'kickoff' | 'play' | 'set-piece' | 'goal' | 'half-time' | 'golden-goal' | 'shootout' | 'over';
```

En `MatchState`, justo después de `setPiece`:

```ts
  // Stage B2 (S-PK6): null until the extra time runs out level. The shootout keeps
  // its own scoreboard; `score` stays as it ended and winnerOf() puts the two together.
  shootout: ShootoutState | null;
```

y en `scratch`, después de `setPiece: SetPieceState`:

```ts
  shootout: ShootoutState;
```

(b) Imports y re-exports. En la cabecera:

```ts
import { HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS, EXTRA_TIME_SECONDS, EXTRA_TIME_STEPS } from './clock';
import {
  beginSetPiece, createSetPieceState, createShootoutState, resetShootout, shootoutWinner, stepSetPiece,
  type SetPieceState, type ShootoutState,
} from './set-pieces';
```

y la línea de re-export:

```ts
export { HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS, EXTRA_TIME_SECONDS, EXTRA_TIME_STEPS };
export type { ShootoutState };
```

(c) `createMatch`: `shootout: null,` junto a `setPiece: null,` y `shootout: createShootoutState(),` dentro de `scratch`.

(d) `advanceClock` pierde la guarda de R18 (el comentario viejo se sustituye entero):

```ts
// Stage B2 (Paco, 06-sep): ruling R18 is SUPERSEDED. It froze the clock in half 3
// because a golden goal with no cap had nothing to measure; with a cap of
// EXTRA_TIME_SECONDS it has, so the clock runs in the extra time exactly like in the
// two regulation halves. The one phase with a frozen clock is now the shootout, and
// it freezes by not calling this at all (S-PK6).
function advanceClock(match: MatchState): void {
  match.halfStep++;
}
```

(e) La cola de `stepOpenPlay` (las tres líneas finales, `if (match.phase === 'play') { … }`):

```ts
  advanceClock(match);
  if (match.phase === 'play') {
    if (match.halfStep >= HALF_STEPS) endHalf(match);
    return;
  }
  // Only 'golden-goal' is left (isOpenPlay is the entry condition of this function).
  // Same shape as the half above: the cap is only read from open play, so an extra
  // time whose clock runs out during a set-piece countdown ends on the first open-play
  // step after it -- which is what the two regulation halves already do with endHalf.
  if (match.halfStep >= EXTRA_TIME_STEPS) endExtraTime(match);
```

(f) Las dos transiciones nuevas, junto a las demás, cada una con su guarda de precondición:

```ts
// The extra time ran out level: the shootout takes over (S-PK6). The clock stops
// here for good -- no branch of the shootout calls advanceClock.
export function endExtraTime(match: MatchState): boolean {
  if (match.phase !== 'golden-goal') return false;
  match.phase = 'shootout';
  resetShootout(match.scratch.shootout);
  match.shootout = match.scratch.shootout;
  match.setPiece = null;
  return true;
}

// The shootout has a winner. `shootout` is deliberately NOT cleared: the screen and
// world-cup.ts read its scoreboard after the match is over, through winnerOf().
export function endShootout(match: MatchState): boolean {
  if (match.phase !== 'shootout') return false;
  match.phase = 'over';
  match.setPiece = null;
  return true;
}

// Who won: the score decides, and a level score is decided by the shootout, which
// keeps its own scoreboard. -1 while the match is undecided (or ended level with no
// shootout, which only abandon() can produce).
// exported for Task 9: world-cup.ts resolves the bracket with this, and the Task 8
// HUD paints the winner with it.
export function winnerOf(match: MatchState): 0 | 1 | -1 {
  if (match.score[0] !== match.score[1]) return match.score[0] > match.score[1] ? 0 : 1;
  return match.shootout === null ? -1 : shootoutWinner(match.shootout);
}
```

(g) El caso del switch de `stepMatch`, que hace compilar el `never` exhaustivo:

```ts
    case 'shootout':
      // Task 7b-2 puts the kick machine here (stepShootout). Until then the phase only
      // holds: no clock (S-PK6), no positioning AI and no physics for the players.
      break;
```

- [ ] **Step 6: Correr el test y verlo pasar**

Run: `npx vitest run components/games/football-logic/match.test.ts -t 'extra time ends in a shootout'`
Expected: PASS.

- [ ] **Step 7: Reescribir el test del reloj de la prórroga (caducidad 2) y verlo pasar**

Sustituir el test `'the golden-goal clock does not move through a set piece either'` por su contrario, que es lo que el spec de hoy pide:

```ts
  // I3 / ruling R18, SUPERSEDED by the spec of 2026-09-06: the clock used to be frozen
  // in half 3 on every branch. Now it runs there like in any other half, and this test
  // pins the branch R18's own test used to pin -- the set piece -- with the sign flipped:
  // a set-piece countdown of the extra time advances the clock, one step per step.
  it('the golden-goal clock moves through a set piece, one step per step (R18 superseded)', () => {
    const m = fresh();
    resumePlay(m); endHalf(m); endHalfTime(m); resumePlay(m); endHalf(m);   // tied -> half 3 kickoff
    resumePlay(m);
    expect(m.phase).toBe('golden-goal');
    expect(m.half).toBe(3);
    const clock = m.halfStep;
    expect(callSetPiece(m, 'throw-in', 1, 700, 0)).toBe(true);
    const rng = createRng(1);
    for (let i = 0; i < SET_PIECE_COUNTDOWN_STEPS; i++) stepMatch(m, IDLE, rng);
    expect(m.phase).not.toBe('set-piece');   // the set piece really did execute
    expect(m.halfStep).toBe(clock + SET_PIECE_COUNTDOWN_STEPS);
    expect(m.clockMs).toBeCloseTo(m.halfStep * STEP_MS, 6);
  });
```

Run: `npx vitest run components/games/football-logic/match.test.ts -t 'R18 superseded'`
Expected: PASS.

- [ ] **Step 8: El gol de oro en el último paso posible (frontera del tope)**

Test nuevo en el mismo `describe`, para fijar el orden entre marcar y agotar el tiempo (en `stepOpenPlay` el gol retorna **antes** de `advanceClock`, así que un gol en el paso 3 600 acaba el partido y NO abre la tanda). Stage B2 finding H3: conducir el gol por el motor de verdad, con el mismo patrón que ya usa `fix C2`'s case D más arriba en el fichero (`freeBall` + el portero apartado de la línea del balón), en vez de llamar a `scoreGoal(m, 1)` a mano — llamarla a mano no pasa por `stepOpenPlay` y por tanto no ejercita el orden que el comentario del test afirma fijar:

```ts
  // Anti-coincidence for the cap: the boundary has two sides. The test above pins the
  // step where a goalless extra time becomes a shootout; this one pins that a goal on
  // that very step still ends the match as a golden goal -- scoring returns from
  // stepOpenPlay before the clock advances, so the cap never gets to read it. Driven
  // through stepMatch with fix C2's own fixture (freeBall + a keeper moved off the ball
  // line, case D above), not by calling scoreGoal by hand: a hand-called goal never
  // enters stepOpenPlay and so never exercises the order this test claims to pin.
  it('a goal on the last step of the extra time is a golden goal, not a shootout', () => {
    const m = fresh();
    resumePlay(m); endHalf(m); endHalfTime(m); resumePlay(m); endHalf(m);   // tied -> half 3 kickoff
    resumePlay(m);
    expect(m.phase).toBe('golden-goal');
    m.halfStep = EXTRA_TIME_STEPS - 1;
    const GOAL_Y = 612;   // same fixture as fix C2's case D: between the posts, off centerY
    freeBall(m, 1996, GOAL_Y, 700, 0);
    const keeper = m.players[9];
    keeper.x = PITCH.width; keeper.y = 500;      // 112 u from the ball: out of POSSESSION_RADIUS
    stepMatch(m, IDLE, createRng(1));
    expect(m.phase).toBe('over');
    expect(m.halfStep).toBe(EXTRA_TIME_STEPS - 1);   // the clock did NOT advance on the goal's own step
    expect(m.score).toEqual([1, 0]);
    expect(m.shootout).toBeNull();
    expect(winnerOf(m)).toBe(0);
  });
```

Run: `npx vitest run components/games/football-logic/match.test.ts -t 'last step of the extra time'`
Expected: PASS.

- [ ] **Step 9: La tabla de guardas, `PHASES`, `forcePhase`, `snapshot` y `sameMatch` (caducidades 3, 5, 6, 7)**

```ts
const PHASES: readonly MatchPhase[] = ['kickoff', 'play', 'set-piece', 'goal', 'half-time', 'golden-goal', 'shootout', 'over'];
// Ruling R26's union assertion runs over the phases a recorded match can reach: the two
// recordings decide the match before the extra time runs out, so neither can reach the
// shootout. The shootout has its own recordings (Task 7b-2).
const RECORDED_PHASES: readonly MatchPhase[] = PHASES.filter((p) => p !== 'shootout');
```

```ts
function forcePhase(match: MatchState, phase: MatchPhase): void {
  match.phase = phase;
  match.setPiece = phase === 'kickoff' || phase === 'set-piece' ? match.scratch.setPiece : null;
  match.shootout = phase === 'shootout' ? match.scratch.shootout : null;
  match.half = phase === 'golden-goal' || phase === 'shootout' ? 3 : 1;
  match.pauseStepsLeft = phase === 'goal' || phase === 'half-time' ? 50 : 0;
}
```

En `snapshot`, dentro del objeto: `sp: match.setPiece, shootout: match.shootout,`.

En `sameMatch`, junto a `sameSetPiece`:

```ts
function sameShootout(a: ShootoutState | null, b: ShootoutState | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.taken[0] === b.taken[0] && a.taken[1] === b.taken[1] &&
    a.scored[0] === b.scored[0] && a.scored[1] === b.scored[1] &&
    a.team === b.team && a.takerId === b.takerId &&
    a.suddenDeath === b.suddenDeath && a.resolveStepsLeft === b.resolveStepsLeft
  );
}
```

y en el cuerpo de `sameMatch`, después de `if (!sameSetPiece(a.setPiece, b.setPiece)) return false;`:

```ts
  if (!sameShootout(a.shootout, b.shootout)) return false;
```

En la tabla de guardas, la fila de `abandon` y dos filas nuevas:

```ts
    { name: 'abandon', legal: ['kickoff', 'play', 'set-piece', 'goal', 'half-time', 'golden-goal', 'shootout'], fire: abandon },
    { name: 'endExtraTime', legal: ['golden-goal'], fire: endExtraTime },
    { name: 'endShootout', legal: ['shootout'], fire: endShootout },
```

Y en la aserción de unión de R26 (el bucle final del segundo partido grabado), cambiar `for (const phase of PHASES)` por `for (const phase of RECORDED_PHASES)` y actualizar el comentario de esa línea a: `// Ruling R26 + stage B2: the union of both recordings covers every phase a recorded match can reach; 'shootout' is covered by the recordings of Task 7b-2.`

Run: `npx vitest run components/games/football-logic/match.test.ts`
Expected: PASS. Stage B2 finding H6: la tabla genera **23** tests nuevos de rechazo/aceptación, no 16 -- añadir `'shootout'` a `PHASES` da un test nuevo a cada una de las 7 filas existentes (6 rechazos y, en `abandon`, cuya lista `legal` ya incluye `'shootout'`, 1 aceptación) más las 8 comprobaciones (1 aceptación + 7 rechazos) de cada una de las dos filas nuevas: 7 + 8 + 8 = 23.

- [ ] **Step 10: La tabla de verdad de `shootoutWinner` y de `winnerOf`**

`describe` nuevo al final de `match.test.ts`:

```ts
// ── Stage B2: who wins a shootout (S-PK5), as a pure function of the counters ──
describe('shootoutWinner: the mathematical cut inside the five and sudden death', () => {
  function sh(taken: [number, number], scored: [number, number], suddenDeath = false): ShootoutState {
    const s = createShootoutState();
    s.taken[0] = taken[0]; s.taken[1] = taken[1];
    s.scored[0] = scored[0]; s.scored[1] = scored[1];
    s.suddenDeath = suddenDeath;
    return s;
  }
  it('nobody has won before a kick is taken', () => {
    expect(shootoutWinner(sh([0, 0], [0, 0]))).toBe(-1);
    expect(SHOOTOUT_ROUNDS).toBe(5);
  });
  // The exact cut the spec names: 3-0 with three taken each. Team 1 has two kicks left
  // and three goals behind, so it cannot catch up. Anti-coincidence: the neighbouring
  // state (3-0 with three and TWO taken) leaves team 1 three kicks and must NOT cut.
  it('cuts at 3-0 after three kicks each, and not one kick earlier', () => {
    expect(shootoutWinner(sh([3, 3], [3, 0]))).toBe(0);
    expect(shootoutWinner(sh([3, 2], [3, 0]))).toBe(-1);
    expect(shootoutWinner(sh([2, 2], [2, 0]))).toBe(-1);
  });
  it('cuts the other way round too, and on the ninth kick when the margin is one', () => {
    expect(shootoutWinner(sh([3, 3], [0, 3]))).toBe(1);
    expect(shootoutWinner(sh([5, 4], [4, 2]))).toBe(0);
    expect(shootoutWinner(sh([5, 4], [2, 4]))).toBe(1);
  });
  it('a level five-and-five is undecided, and a five-and-five with a margin is not', () => {
    expect(shootoutWinner(sh([5, 5], [4, 4]))).toBe(-1);
    expect(shootoutWinner(sh([5, 5], [4, 3]))).toBe(0);
    expect(shootoutWinner(sh([5, 5], [3, 4]))).toBe(1);
  });
  // S-PK5 literally: the first to miss loses, even with the rival still to kick in the
  // round. Both shapes are pinned: the team kicking first misses (and loses without the
  // rival kicking), and the team kicking second misses (and loses on the scoreboard).
  // Stage B2 finding H1: [6,5]/[6,5] is the case that used to break -- team 0 has just
  // SCORED its sixth (one kick ahead of team 1, which still owes its sixth), and that is
  // not a decision yet. It is the mirror of [6,5]/[5,5] one line above: same `taken`,
  // and the only difference is whether the extra kick went in. Because the two ending
  // clauses of shootoutWinner are mutually exclusive (a cut needs the scoreboard UNEVEN,
  // sudden death here needs it EVEN), exactly one of "-1" and "1" can ever be right for
  // a given `scored`, which is what makes this pair of lines a real regression guard and
  // not two assertions that happen to agree.
  it('sudden death: the first to miss loses, whichever of the two it is', () => {
    expect(shootoutWinner(sh([6, 5], [5, 5], true))).toBe(1);   // team 0 kicked and missed
    expect(shootoutWinner(sh([6, 5], [6, 5], true))).toBe(-1);  // team 0 kicked and scored: team 1 still owes its kick
    expect(shootoutWinner(sh([6, 6], [6, 5], true))).toBe(0);   // team 1 kicked and missed
    expect(shootoutWinner(sh([6, 6], [6, 6], true))).toBe(-1);  // both scored: another round
  });
});

describe('winnerOf: the score decides, and a level score is decided by the shootout', () => {
  it('reads the score when it is not level and ignores the shootout', () => {
    const m = fresh();
    m.score[0] = 2; m.score[1] = 1;
    expect(winnerOf(m)).toBe(0);
    m.score[0] = 1; m.score[1] = 2;
    expect(winnerOf(m)).toBe(1);
  });
  it('is undecided while the match is level with no shootout, and reads the shootout once there is one', () => {
    const m = fresh();
    expect(winnerOf(m)).toBe(-1);
    forcePhase(m, 'shootout');
    resetShootout(m.scratch.shootout);
    expect(winnerOf(m)).toBe(-1);
    m.scratch.shootout.taken[0] = 3; m.scratch.shootout.taken[1] = 3;
    m.scratch.shootout.scored[0] = 3;
    expect(winnerOf(m)).toBe(0);
    expect(m.score).toEqual([0, 0]);   // the shootout never touches the match score
  });
});
```

Añadir `resetShootout` a los imports de `./set-pieces` en `match.test.ts`.

Run: `npx vitest run components/games/football-logic/match.test.ts -t 'shootoutWinner'` y `-t 'winnerOf'`
Expected: PASS.

- [ ] **Step 11: `ALL_PHASES` de `ai.test.ts` (caducidad 8)**

```ts
const ALL_PHASES: readonly MatchPhase[] = ['kickoff', 'play', 'set-piece', 'goal', 'half-time', 'golden-goal', 'shootout', 'over'];
```

Run: `npx vitest run components/games/football-logic/ai.test.ts`
Expected: PASS, sin cambios de aserción.

- [ ] **Step 12: Verificación de la tarea**

Run: `npx vitest run` → esperado: 52 ficheros verdes y **894 tests** (861 + 33 nuevos: 1 tope + 1 R18 + 1 frontera del gol de oro + 23 de la tabla de guardas [H6] + 7 de `shootoutWinner`/`winnerOf` [5 + 2]).
Run: `npx tsc --noEmit` → esperado: sin salida.
Run: `grep -rn "Math.random\|Date.now\|performance.now\|Math.sin\|Math.cos\|Math.atan2\|Math.hypot" components/games/football-logic/` → esperado: vacío.
Run: `npx vitest run components/games/football-logic/match.test.ts -t 'golden goal with live AI'` → esperado: PASS sin tocar nada (Stage B2 finding H9: ese test vive en `match.test.ts`, no en `ai.test.ts` -- con `-t` apuntando al fichero equivocado, vitest no encuentra ningún test y da el paso por bueno sin haberlo corrido).
Run: `npx vitest run components/games/football-logic/ai.test.ts -t 'CPU vs CPU'` → esperado: PASS sin tocar nada (medición previa: prórroga más larga de esas semillas 1 841 pasos < 3 600).

Si el partido grabado de R26 se pone rojo: **BLOCKED** con la medición (pasos en la parte 3, marcador y fase final), sin tocar la policy.

- [ ] **Step 13: Propose commit (NO ejecutar)**

```
feat(world-cup): cap the extra time at 60 s and open the shootout phase

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
```

---

## Task 7b-2: la tanda de cinco penaltis con muerte súbita

**Files:**
- Modify: `components/games/football-logic/players.ts`
- Modify: `components/games/football-logic/set-pieces.ts`
- Modify: `components/games/football-logic/match.ts`
- Modify: `components/games/football-logic/ai.ts`
- Test: `components/games/football-logic/players.test.ts`
- Test: `components/games/football-logic/set-pieces.test.ts`
- Test: `components/games/football-logic/match.test.ts`
- Test: `components/games/football-logic/ai.test.ts`

**Interfaces:**
- Consumes (Task 7b-1): `EXTRA_TIME_STEPS`, `SHOOTOUT_ROUNDS`, `SHOOTOUT_RESOLVE_STEPS`, `ShootoutState`, `createShootoutState`, `resetShootout`, `shootoutWinner`, `endExtraTime`, `endShootout`, `winnerOf`, `MatchState.shootout`, `MatchState.scratch.shootout`.
- Produces:
  - `players.ts`: `export const SHOOTOUT_GRID_COLUMNS = 4` · `export const SHOOTOUT_GRID_ROWS = 4` · `export const SHOOTOUT_GRID_SPACING_X = 70` · `export const SHOOTOUT_GRID_SPACING_Y = 80` · `export function placeAroundCentreSpot(players: PlayerState[], takerId: number, pitch: PitchDef): void`. (Stage B2 finding H4: 4 x 4, not 5 x 3 -- see Step 3.)
  - `set-pieces.ts`: `export function shootoutTakerId(team: 0 | 1, taken: number): number` · `export function beginShootoutKick(sp: SetPieceState, sh: ShootoutState, players: PlayerState[], ball: BallState, formations: readonly [Formation, Formation], strategies: readonly [Strategy, Strategy], attackDir: AttackDirs, pitch: PitchDef, stepCount: number): void`.
  - `ai.ts`: `AiState` gana `penaltyKickIndex: number`.
  - **Para la etapa C (Task 8), sin consumidor de código todavía y con su línea de destino escrita:** `match.shootout` (marcador y turno de la tanda para el HUD), `match.setPiece.stepsLeft` durante `phase === 'shootout'` (la cuenta atrás de cada lanzamiento, que dispara el silbato de inicio según el mapa de audio del paso 10), `match.scratch.events[takerId]` con `kind === 'shot'` en el paso del golpeo (SFX de golpeo) y `match.scratch.call.kind === 'goal'` en el paso en que la tanda marca (cadena de gol), y `winnerOf(match)`.

- [ ] **Step 1: Test rojo de la colocación de la tanda**

En `players.test.ts`, `describe` nuevo:

```ts
// Stage B2, S-PK4: during a shootout the fifteen outfield players who are not taking
// the kick stand still around the centre spot. S-PK7: the two keepers do NOT join them
// -- criterion 9b forbids a keeper outside its own big area, and a keeper parked on the
// centre circle would break the invariant on every step of the shootout.
describe('placeAroundCentreSpot (shootout)', () => {
  it('parks the fifteen outfield players who are not the taker on a grid inside the centre circle, and leaves both keepers alone', () => {
    const players = createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH);
    const keeperPositions = [players[0], players[TEAM_SIZE]].map((p) => ({ x: p.x, y: p.y }));
    const takerId = 3;
    for (const p of players) { p.vx = 7; p.vy = -7; p.tackleStepsLeft = 9; p.downUntilStep = 1000; }
    const takerBefore = { x: players[takerId].x, y: players[takerId].y };
    placeAroundCentreSpot(players, takerId, PITCH);
    expect(players[0].x).toBe(keeperPositions[0].x);
    expect(players[0].y).toBe(keeperPositions[0].y);
    expect(players[TEAM_SIZE].x).toBe(keeperPositions[1].x);
    expect(players[TEAM_SIZE].y).toBe(keeperPositions[1].y);
    expect(players[takerId].x).toBe(takerBefore.x);
    expect(players[takerId].y).toBe(takerBefore.y);
    let parked = 0;
    for (const p of players) {
      if (p.role === 'gk' || p.id === takerId) continue;
      parked++;
      expect(dist(p.x, p.y, centerX(PITCH), centerY(PITCH)),
        `player ${p.id} was parked outside the centre circle`).toBeLessThan(PITCH.centerCircleRadius);
      expect(p.vx).toBe(0);
      expect(p.vy).toBe(0);
      expect(p.tackleStepsLeft).toBe(0);
      expect(p.downUntilStep).toBe(0);
    }
    expect(parked).toBe(2 * OUTFIELD - 1);
    // Stage B2 finding H4: the grid has 2 * OUTFIELD = 16 slots, one more than the
    // fifteen players it parks -- see Step 3 for which one is left empty and why.
    expect(SHOOTOUT_GRID_COLUMNS * SHOOTOUT_GRID_ROWS).toBe(2 * OUTFIELD);
    expect(SHOOTOUT_GRID_SPACING_Y).toBe(80);
  });
  // Anti-coincidence: a grid that put two players on the same spot would still be
  // "inside the circle" and still park fifteen. Nobody overlaps, and nobody lands on
  // the centre spot itself (Stage B2 finding H4): with an even number of columns and
  // an even number of rows, no slot's offset from the centre is ever (0, 0) -- unlike
  // the 5 x 3 layout this replaces, whose middle column and row landed exactly on it.
  it('nobody shares a spot and the grid is wider than a player', () => {
    const players = createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH);
    placeAroundCentreSpot(players, 3, PITCH);
    for (const p of players) {
      if (p.role === 'gk' || p.id === 3) continue;
      for (const q of players) {
        if (q.id === p.id || q.role === 'gk' || q.id === 3) continue;
        expect(dist(p.x, p.y, q.x, q.y), `players ${p.id} and ${q.id} share a spot`).toBeGreaterThanOrEqual(SHOOTOUT_GRID_SPACING_X);
      }
    }
  });
});
```

Imports que hay que añadir en `players.test.ts`: `dist` de `./geometry`, `centerX` de `./pitch`, `OUTFIELD` y `TEAM_SIZE` de `./teams`, y de `./players` `placeAroundCentreSpot`, `SHOOTOUT_GRID_COLUMNS`, `SHOOTOUT_GRID_ROWS`, `SHOOTOUT_GRID_SPACING_X`, `SHOOTOUT_GRID_SPACING_Y` (Stage B2 finding H5; comprobar cuáles ya están importados antes de duplicar).

- [ ] **Step 2: Correr para verlo fallar**

Run: `npx vitest run components/games/football-logic/players.test.ts -t 'placeAroundCentreSpot'`
Expected: FAIL — `placeAroundCentreSpot` no existe.

- [ ] **Step 3: Implementar `placeAroundCentreSpot`**

En `players.ts`, después de `placeByFormation`:

```ts
// Stage B2, S-PK4: the fifteen outfield players who are not taking the kick stand
// still around the centre spot and the live positioning AI does not run for them.
// The grid is 4 x 4 = 2 * OUTFIELD slots, laid out by ascending id with integer
// arithmetic -- spreading them on a circle would need trigonometry, which the engine
// bans (risk 3). Its far corner sits at sqrt(105^2 + 120^2) = 159.45 u from the centre
// spot, inside the 175 u circle.
// Stage B2 finding H4: this used to be a 5 x 3 grid (2 * OUTFIELD - 1 slots, exactly
// the fifteen needed), but its middle column and row are both exact integers
// ((5-1)/2 = 2, (3-1)/2 = 1), so slot k = 7 landed at offset (0, 0) -- one player
// parked exactly on the centre spot itself, which is where the ball of the shootout's
// NEXT kick sits. A 4 x 4 grid has no middle column or row (both (4-1)/2 = 1.5), so no
// slot's offset is ever (0, 0) regardless of which one is used -- that is what actually
// fixes the coincidence, not the choice of which slot to drop. One slot has to be
// dropped anyway, since 16 slots is one more than the fifteen players parked here;
// slot 7 is it, kept only because it is the smallest possible diff from the old
// layout's dropped centre and carries no geometric meaning of its own now.
// S-PK7: the goalkeepers are NOT parked. The spec's "the sixteen remaining" would put
// the attacking keeper on the centre circle, and criterion 9b (checkGoalkeepersInBox)
// forbids a keeper outside its own big area -- so both keepers stay where
// placeByFormation left them, on their lines.
// S-PK10: an extra time that ended mid-slide would otherwise leave a parked player
// frozen in the air for the whole shootout, so the slide, the floor and the charge are
// cleared here as well.
export const SHOOTOUT_GRID_COLUMNS = 4;
export const SHOOTOUT_GRID_ROWS = 4;
export const SHOOTOUT_GRID_SPACING_X = 70;
export const SHOOTOUT_GRID_SPACING_Y = 80;

export function placeAroundCentreSpot(players: PlayerState[], takerId: number, pitch: PitchDef): void {
  const cx = centerX(pitch);
  const cy = centerY(pitch);
  let k = 0;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.role === 'gk' || p.id === takerId) continue;
    if (k === 7) k++;   // Stage B2 (H4): the sixteenth slot is dropped so fifteen fit
    const col = k % SHOOTOUT_GRID_COLUMNS;
    const row = (k - col) / SHOOTOUT_GRID_COLUMNS;
    p.x = cx + (col - (SHOOTOUT_GRID_COLUMNS - 1) / 2) * SHOOTOUT_GRID_SPACING_X;
    p.y = cy + (row - (SHOOTOUT_GRID_ROWS - 1) / 2) * SHOOTOUT_GRID_SPACING_Y;
    p.vx = 0;
    p.vy = 0;
    p.wantX = 0;
    p.wantY = 0;
    p.wantSprint = false;
    p.tackleStepsLeft = 0;
    p.downUntilStep = 0;
    p.chargeSteps = 0;
    p.chargeButton = 'none';
    k++;
  }
}
```

Añadir `centerX` al import de `./pitch` de `players.ts`.

- [ ] **Step 4: Correr y verlo pasar**

Run: `npx vitest run components/games/football-logic/players.test.ts -t 'placeAroundCentreSpot'`
Expected: PASS.

- [ ] **Step 5: Test rojo del orden de lanzadores y del arranque de un lanzamiento**

En `set-pieces.test.ts`, `describe` nuevo al final:

```ts
// ── Stage B2: the shootout kick is the penalty set piece (S-PK1) ─────────────
describe('shootout kick', () => {
  function sh(team: 0 | 1, taken: [number, number]): ShootoutState {
    const s = createShootoutState();
    s.team = team;
    s.taken[0] = taken[0];
    s.taken[1] = taken[1];
    return s;
  }
  // S-PK3: the outfield takers go by ascending id without repeating until the eight are
  // used up, and then it starts again. Keepers never take one.
  it('the taker cycles through the eight outfield ids of its team and wraps around', () => {
    expect(shootoutTakerId(0, 0)).toBe(1);
    expect(shootoutTakerId(0, 7)).toBe(8);
    expect(shootoutTakerId(0, 8)).toBe(1);
    expect(shootoutTakerId(1, 0)).toBe(TEAM_SIZE + 1);
    expect(shootoutTakerId(1, 7)).toBe(TEAM_SIZE + 8);
    expect(shootoutTakerId(1, 8)).toBe(TEAM_SIZE + 1);
    // Anti-coincidence: the eight ids of a team are all different and none is a keeper.
    const seen = new Set<number>();
    for (let taken = 0; taken < OUTFIELD; taken++) seen.add(shootoutTakerId(1, taken));
    expect(seen.size).toBe(OUTFIELD);
    expect(seen.has(TEAM_SIZE)).toBe(false);
  });
  it('team 0 kicks at the goal it attacks, with its taker on the spot and the ball at his feet', () => {
    const w = world();
    beginShootoutKick(w.sp, sh(0, [0, 0]), w.players, w.ball, FORMS, STRATS, ATTACK, PITCH, 0);
    expect(w.sp.kind).toBe('penalty');
    expect(w.sp.team).toBe(0);
    expect(w.sp.takerId).toBe(1);
    expect(w.sp.stepsLeft).toBe(SET_PIECE_COUNTDOWN_STEPS);
    expect(w.sp.side).toBe(0);
    expect(w.ball.x).toBeCloseTo(PITCH.width - PITCH.penaltySpotDist, 10);
    expect(w.ball.y).toBeCloseTo(CY, 10);
    expect(w.ball.owner).toBe(1);
    // The defending keeper is on its line at the centre of the goal it defends.
    expect(w.players[TEAM_SIZE].x).toBe(goalLineX(PITCH, 1) - GK_LINE_DIST);
    expect(w.players[TEAM_SIZE].y).toBe(CY);
  });
  it('team 1 kicks at the other goal, with the third kick taken by its third outfield id', () => {
    const w = world();
    beginShootoutKick(w.sp, sh(1, [3, 2]), w.players, w.ball, FORMS, STRATS, ATTACK, PITCH, 0);
    expect(w.sp.team).toBe(1);
    expect(w.sp.takerId).toBe(TEAM_SIZE + 3);
    expect(w.ball.x).toBeCloseTo(PITCH.penaltySpotDist, 10);
    expect(w.ball.owner).toBe(TEAM_SIZE + 3);
    expect(w.players[0].x).toBe(GK_LINE_DIST);   // team 0's keeper defends side 0
  });
  // S-PK4 + S-PK7 through the real entry point, not through placeAroundCentreSpot alone.
  it('everyone but the taker and the two keepers is parked inside the centre circle, and the keepers stay in their boxes', () => {
    const w = world();
    beginShootoutKick(w.sp, sh(0, [0, 0]), w.players, w.ball, FORMS, STRATS, ATTACK, PITCH, 0);
    expect(checkGoalkeepersInBox(w.players, ATTACK, PITCH)).toEqual([]);
    for (const p of w.players) {
      if (p.role === 'gk' || p.id === w.sp.takerId) continue;
      expect(dist(p.x, p.y, PITCH.width / 2, CY), `player ${p.id} is not in the centre circle`).toBeLessThan(PITCH.centerCircleRadius);
    }
  });
  // Stage B2 finding H7: placeByFormation (all beginSetPiece does to the keepers)
  // resets vx/vy/want*/facing but not a slide, a tackle or a charge -- so without this,
  // a keeper whose extra time ended mid-tackle would stay frozen in that pose for the
  // whole shootout, the same artefact S-PK10 already fixes for the fifteen outfield
  // players parked around the centre spot.
  it('S-PK10 also clears a slide, a tackle or a charge left on either keeper', () => {
    const w = world();
    for (const gk of [w.players[0], w.players[TEAM_SIZE]]) {
      gk.tackleStepsLeft = 9;
      gk.downUntilStep = 1000;
      gk.chargeSteps = 5;
      gk.chargeButton = 'a';
    }
    beginShootoutKick(w.sp, sh(0, [0, 0]), w.players, w.ball, FORMS, STRATS, ATTACK, PITCH, 0);
    for (const gk of [w.players[0], w.players[TEAM_SIZE]]) {
      expect(gk.tackleStepsLeft).toBe(0);
      expect(gk.downUntilStep).toBe(0);
      expect(gk.chargeSteps).toBe(0);
      expect(gk.chargeButton).toBe('none');
    }
  });
});
```

Imports nuevos en `set-pieces.test.ts`: `OUTFIELD` de `./teams`, `checkGoalkeepersInBox` de `./invariants`, y de `./set-pieces` `beginShootoutKick`, `createShootoutState`, `shootoutTakerId`, `type ShootoutState` (`TEAM_SIZE` puede que ya esté importado; comprobar antes de duplicar).

- [ ] **Step 6: Correr para verlo fallar**

Run: `npx vitest run components/games/football-logic/set-pieces.test.ts -t 'shootout kick'`
Expected: FAIL — `beginShootoutKick` y `shootoutTakerId` no existen.

- [ ] **Step 7: Implementar `shootoutTakerId` y `beginShootoutKick`**

En `set-pieces.ts`, dentro del bloque de la tanda (después de `shootoutWinner`):

```ts
// S-PK3: team 0 opens (resetShootout) and they alternate; each team's takers go by
// ascending id without repeating until its eight outfield players are used up, and
// then it starts again. players[i].id === i and id `team * TEAM_SIZE` is the keeper,
// so the outfield ids of a team are team * TEAM_SIZE + 1 .. + OUTFIELD.
export function shootoutTakerId(team: 0 | 1, taken: number): number {
  return team * TEAM_SIZE + 1 + (taken % OUTFIELD);
}

// S-PK1: every kick IS the penalty set piece -- same countdown, same d-pad side, same
// keeper read, same automatic execution. Three things are laid on top of it: the taker
// is the one S-PK3 names instead of the nearest player, the rest are parked around the
// centre spot (S-PK4/S-PK7), and the resolution countdown starts at zero because the
// kick is still to be taken.
// S-PK8: the spot is the one in front of the goal the kicking team attacks, so the two
// goals alternate through the shootout. executePenalty derives its target from
// attackDir, and there is no notion in the engine of "both teams shoot at one goal".
// Stage B2 finding H7: S-PK10 clears a leftover slide, tackle or charge on the fifteen
// parked outfield players, but the two goalkeepers never go through
// placeAroundCentreSpot -- and placeByFormation, the only thing beginSetPiece does to
// them, resets vx/vy/want*/facing but not downUntilStep/tackleStepsLeft/chargeSteps
// (players.ts, placeByFormation). A keeper whose extra time ended mid-slide would
// otherwise stay frozen in that pose for the whole shootout -- the same artefact
// S-PK10 already fixes for the outfield fifteen. Harmless today (executePenalty
// teleports the keeper by `gk.y` directly, without going through the physics that read
// these fields), but the same reasoning that put the fix on the fifteen puts it here.
export function beginShootoutKick(
  sp: SetPieceState, sh: ShootoutState, players: PlayerState[], ball: BallState,
  formations: readonly [Formation, Formation], strategies: readonly [Strategy, Strategy],
  attackDir: AttackDirs, pitch: PitchDef, stepCount: number,
): void {
  const defending: 0 | 1 = sh.team === 0 ? 1 : 0;
  const side = ownGoalSide(attackDir[defending]);
  beginSetPiece(sp, 'penalty', sh.team, penaltySpotX(pitch, side), centerY(pitch), players, ball, formations, strategies, attackDir, pitch, stepCount);
  sh.takerId = shootoutTakerId(sh.team, sh.taken[sh.team]);
  sh.resolveStepsLeft = 0;
  sp.takerId = sh.takerId;
  placeAroundCentreSpot(players, sh.takerId, pitch);
  // S-PK10, extended to the keepers (H7): same three fields as placeAroundCentreSpot,
  // on the two players it does not touch.
  for (const gk of [players[sh.team * TEAM_SIZE], players[defending * TEAM_SIZE]]) {
    gk.tackleStepsLeft = 0;
    gk.downUntilStep = 0;
    gk.chargeSteps = 0;
    gk.chargeButton = 'none';
  }
  const taker = players[sh.takerId];
  givePossession(ball, taker, stepCount);
  placeTaker(sp, taker, ball, pitch);
}
```

Imports que hay que ampliar en `set-pieces.ts`: `penaltySpotX` desde `./pitch`, `OUTFIELD` desde `./teams`, y `placeAroundCentreSpot` desde `./players`.

- [ ] **Step 8: Correr y verlo pasar**

Run: `npx vitest run components/games/football-logic/set-pieces.test.ts -t 'shootout kick'`
Expected: PASS.

- [ ] **Step 9: Test rojo de una tanda guionizada entera (gol, atajada, corte por imposibilidad)**

En `match.test.ts`, `describe` nuevo al final del fichero. El guion es exacto porque en la tanda **el único consumidor del `rng` es la lectura del portero**:

```ts
// ── Stage B2: the shootout, kick by kick (S-PK1..S-PK6, criterion 23) ─────────
//
// The only rng draw of a shootout is the keeper's read inside executePenalty: one draw
// below penaltyReadChance and it dives the right way, keeps the ball and the kick is a
// MISS; one draw at or above it and a second draw picking which of the other two sides,
// so a kick down the middle (the idle d-pad leaves sp.side at 0) goes in. That is what
// makes a scripted shootout exact instead of lucky.
function shootoutRng(outcomes: readonly ('save' | 'goal')[]): CountingRng {
  const values: number[] = [];
  for (const outcome of outcomes) {
    if (outcome === 'save') values.push(0);          // < penaltyReadChance at any difficulty
    else values.push(0.99, 0.5);                     // >= 0.60, the maximum read chance
  }
  return fixedRng(values);
}

// The engine's own route into the shootout, transition by transition: no phase is ever
// written by hand, so the state is exactly the one a real match arrives with.
function atShootout(): MatchState {
  const m = fresh();
  resumePlay(m); endHalf(m); endHalfTime(m); resumePlay(m); endHalf(m);   // tied -> half 3 kickoff
  resumePlay(m);
  expect(m.phase).toBe('golden-goal');
  expect(endExtraTime(m)).toBe(true);
  expect(m.phase).toBe('shootout');
  return m;
}

// Steps until the number of kicks taken changes (or the match ends), and returns how
// many steps that took. The cap is the countdown plus the resolution plus one: a kick
// that needs more than that is a hang, and the test says so instead of looping.
function takeKick(m: MatchState, rng: Rng): number {
  const before = (m.shootout?.taken[0] ?? 0) + (m.shootout?.taken[1] ?? 0);
  const cap = SET_PIECE_COUNTDOWN_STEPS + SHOOTOUT_RESOLVE_STEPS + 1;
  for (let i = 1; i <= cap; i++) {
    stepMatch(m, IDLE, rng);
    if ((m.shootout?.taken[0] ?? 0) + (m.shootout?.taken[1] ?? 0) !== before) return i;
    if (m.phase === 'over') return i;
  }
  throw new Error(`a shootout kick did not resolve in ${cap} steps`);
}

describe('the shootout runs kick by kick and cuts as soon as it is decided', () => {
  it('the first kick is team 0 s, taken by its lowest outfield id, with the ball on the spot and everyone else parked', () => {
    const m = atShootout();
    expect(m.shootout?.team).toBe(0);
    expect(m.shootout?.takerId).toBe(1);
    expect(m.setPiece?.kind).toBe('penalty');
    expect(m.setPiece?.stepsLeft).toBe(SET_PIECE_COUNTDOWN_STEPS);
    expect(m.ball.owner).toBe(1);
    expect(checkGoalkeepersInBox(m.players, m.attackDir, m.pitch)).toEqual([]);
  });
  // A kick that is saved resolves on the step it is taken: the ball is in the keeper's
  // hands and there is nothing to wait for (S-PK2, no rebound).
  it('a saved kick resolves on the countdown step itself, and the next kick is the rival s', () => {
    const m = atShootout();
    const rng = shootoutRng(['save']);
    const steps = takeKick(m, rng);
    expect(steps).toBe(SET_PIECE_COUNTDOWN_STEPS);
    expect(m.shootout?.taken).toEqual([1, 0]);
    expect(m.shootout?.scored).toEqual([0, 0]);
    expect(m.shootout?.team).toBe(1);
    expect(m.shootout?.takerId).toBe(TEAM_SIZE + 1);
    expect(rng.calls).toBe(1);                       // read right: one draw, no second one
    expect(m.score).toEqual([0, 0]);                 // the shootout never touches the match score
  });
  // A kick the keeper reads wrong flies down the middle and crosses the line a few steps
  // later: 210 u at 850 u/s, airborne (vz 120), so no ground deceleration -- about 15
  // steps, and in any case far inside SHOOTOUT_RESOLVE_STEPS.
  it('a scored kick resolves a few steps after the countdown, well inside the four seconds', () => {
    const m = atShootout();
    const rng = shootoutRng(['goal']);
    const steps = takeKick(m, rng);
    expect(steps).toBeGreaterThan(SET_PIECE_COUNTDOWN_STEPS);
    expect(steps).toBeLessThan(SET_PIECE_COUNTDOWN_STEPS + SHOOTOUT_RESOLVE_STEPS);
    expect(m.shootout?.taken).toEqual([1, 0]);
    expect(m.shootout?.scored).toEqual([1, 0]);
    expect(m.shootout?.team).toBe(1);
    expect(rng.calls).toBe(2);                       // read wrong: the draw plus the side
    expect(m.score).toEqual([0, 0]);
  });
  // The exact cut the spec names, driven end to end: 3-0 after three kicks each.
  it('3-0 after three kicks each ends the shootout without a fourth kick', () => {
    const m = atShootout();
    const rng = shootoutRng(['goal', 'save', 'goal', 'save', 'goal', 'save']);
    for (let i = 0; i < 6; i++) takeKick(m, rng);
    expect(m.phase).toBe('over');
    expect(m.shootout?.taken).toEqual([3, 3]);
    expect(m.shootout?.scored).toEqual([3, 0]);
    expect(m.shootout?.suddenDeath).toBe(false);
    expect(m.setPiece).toBeNull();
    expect(winnerOf(m)).toBe(0);
    expect(m.score).toEqual([0, 0]);
  });
  // Anti-coincidence for the cut: the same six kicks with one goal moved keep the
  // shootout alive, so the cut above is the rule and not the length of the script.
  it('2-1 after three kicks each goes on to a fourth kick', () => {
    const m = atShootout();
    const rng = shootoutRng(['goal', 'goal', 'goal', 'save', 'save', 'save']);
    for (let i = 0; i < 6; i++) takeKick(m, rng);
    expect(m.phase).toBe('shootout');
    expect(m.shootout?.taken).toEqual([3, 3]);
    expect(m.shootout?.scored).toEqual([2, 1]);
    expect(m.shootout?.team).toBe(0);
    expect(m.shootout?.takerId).toBe(4);             // fourth kick, fourth outfield id
  });
});
```

Añadir a los imports de `match.test.ts`: `SHOOTOUT_RESOLVE_STEPS` desde `./set-pieces` y `TEAM_SIZE` desde `./teams` (si no está ya).

- [ ] **Step 10: Correr para verlo fallar**

Run: `npx vitest run components/games/football-logic/match.test.ts -t 'the shootout runs kick by kick'`
Expected: FAIL — la fase `'shootout'` no hace nada: el primer test falla ya en `m.setPiece?.kind` (hoy `endExtraTime` deja `setPiece` en `null`).

- [ ] **Step 11: Implementar la máquina de la tanda en `match.ts`**

(a) `endExtraTime` arranca el primer lanzamiento: sustituir `match.setPiece = null;` por `startShootoutKick(match, match.scratch.shootout);`.

(b) Los cuatro trozos nuevos, antes de `stepMatch`:

```ts
function startShootoutKick(match: MatchState, sh: ShootoutState): void {
  const sp = match.scratch.setPiece;
  beginShootoutKick(sp, sh, match.players, match.ball, formationsOf(match), match.strategies, match.attackDir, match.pitch, match.stepCount);
  match.setPiece = sp;
}

type KickOutcome = 'goal' | 'miss' | 'pending';

// S-PK2: it is a GOAL if the ball crosses the line between the posts; it is a MISS if
// the keeper saves it, if it leaves the field, or if SHOOTOUT_RESOLVE_SECONDS go by
// with neither. There is no rebound: the ball is collected and placed for the next one.
function judgeShootoutKick(match: MatchState, sh: ShootoutState, keeperTeam: 0 | 1): KickOutcome {
  if (match.ball.owner === keeperOf(match, keeperTeam).id) return 'miss';
  judgeBall(match.ball, match.attackDir, match.pitch, match.scratch.call);
  if (match.scratch.call.kind === 'goal') return match.scratch.call.team === sh.team ? 'goal' : 'miss';
  if (isRestart(match.scratch.call.kind)) return 'miss';
  return sh.resolveStepsLeft <= 0 ? 'miss' : 'pending';
}

// The kick is resolved: count it, and either the shootout has a winner (shootoutWinner
// carries the whole of S-PK5, sudden death included) or the rival steps up.
function finishShootoutKick(match: MatchState, sh: ShootoutState, scored: boolean): void {
  if (scored) sh.scored[sh.team]++;
  sh.taken[sh.team]++;
  if (shootoutWinner(sh) >= 0) {
    endShootout(match);
    return;
  }
  sh.team = sh.team === 0 ? 1 : 0;
  if (sh.taken[0] >= SHOOTOUT_ROUNDS && sh.taken[1] >= SHOOTOUT_ROUNDS) sh.suddenDeath = true;
  startShootoutKick(match, sh);
}

// One step of the shootout. No clock (S-PK6), no positioning AI and no player physics
// (S-PK4): the only things that move are the ball, once the kick is away, and the
// defending keeper, teleported to the side it dives to by executePenalty. The referee
// call is cleared every step so the goal of a kick is visible for exactly one step, the
// same property ruling R28 gave the action events.
function stepShootout(match: MatchState, inputs: readonly [TeamInput, TeamInput], rng: Rng): void {
  const sh = match.shootout;
  const sp = match.setPiece;
  // Unreachable while the phase is entered through endExtraTime, which sets both (same
  // convention as nearestOutfield's -1 in set-pieces.ts): it is the narrowing the
  // compiler needs, and the safe way out if a v1.5 path ever forces the phase.
  if (sh === null || sp === null) {
    endShootout(match);
    return;
  }
  clearRefereeCall(match.scratch.call);
  const keeperTeam: 0 | 1 = sh.team === 0 ? 1 : 0;
  if (sh.resolveStepsLeft === 0) {
    const executed = stepSetPiece(
      sp, inputs[sh.team], match.players, match.ball, rng, match.profiles[keeperTeam].penaltyReadChance,
      match.attackDir, match.pitch, match.stepCount, match.scratch.aim, match.scratch.events[sp.takerId],
    );
    if (!executed) return;
    sh.resolveStepsLeft = SHOOTOUT_RESOLVE_STEPS;
  } else {
    stepBall(match.ball, match.players, match.stepCount, match.pitch);
    sh.resolveStepsLeft--;
  }
  const outcome = judgeShootoutKick(match, sh, keeperTeam);
  if (outcome === 'pending') return;
  finishShootoutKick(match, sh, outcome === 'goal');
}
```

(c) El caso del switch pasa a `case 'shootout': stepShootout(match, inputs, rng); break;`.

(d) Imports que se amplían en `match.ts`: `stepBall` desde `./ball`, y `SHOOTOUT_RESOLVE_STEPS`, `SHOOTOUT_ROUNDS`, `beginShootoutKick` desde `./set-pieces`.

- [ ] **Step 12: Correr y verlo pasar**

Run: `npx vitest run components/games/football-logic/match.test.ts -t 'the shootout runs kick by kick'`
Expected: PASS los cinco tests.

- [ ] **Step 13: Test de los dos desenlaces que faltan (fuera y timeout de 4 s)**

Mismo fichero, `describe` nuevo:

```ts
// The other two ways a kick misses (S-PK2). Neither happens on its own with a penalty
// aimed at the goal, so both are forced on the ball right after the kick is away --
// which is the point: the engine must resolve them, not depend on them not happening.
describe('a shootout kick that leaves the field or never arrives is a miss', () => {
  // Runs the countdown and returns on the step the kick is taken.
  function kickAway(m: MatchState, rng: Rng): void {
    for (let i = 0; i < SET_PIECE_COUNTDOWN_STEPS; i++) stepMatch(m, IDLE, rng);
  }
  it('a ball sent over the touchline is a miss as soon as the referee sees it out', () => {
    const m = atShootout();
    const rng = shootoutRng(['goal']);
    kickAway(m, rng);
    expect(m.shootout?.resolveStepsLeft).toBe(SHOOTOUT_RESOLVE_STEPS);
    m.ball.vx = 0;
    m.ball.vy = -900;
    m.ball.z = 0;
    m.ball.vz = 0;
    let steps = 0;
    while (m.shootout !== null && m.shootout.taken[0] === 0 && steps < SHOOTOUT_RESOLVE_STEPS) {
      stepMatch(m, IDLE, rng);
      steps++;
    }
    expect(steps).toBeLessThan(SHOOTOUT_RESOLVE_STEPS);
    expect(m.shootout?.taken).toEqual([1, 0]);
    expect(m.shootout?.scored).toEqual([0, 0]);
    expect(m.shootout?.team).toBe(1);
  });
  it('a ball that stops dead is a miss exactly SHOOTOUT_RESOLVE_STEPS after the kick', () => {
    const m = atShootout();
    const rng = shootoutRng(['goal']);
    kickAway(m, rng);
    // Parked where nobody can pick it up: the fifteen are on the centre grid, at y
    // CY - 80 at the nearest, and POSSESSION_RADIUS is 22 u.
    m.ball.x = centerX(PITCH);
    m.ball.y = 300;
    m.ball.z = 0;
    m.ball.vx = 0;
    m.ball.vy = 0;
    m.ball.vz = 0;
    for (let i = 0; i < SHOOTOUT_RESOLVE_STEPS - 1; i++) stepMatch(m, IDLE, rng);
    expect(m.shootout?.taken, 'the kick timed out early').toEqual([0, 0]);
    stepMatch(m, IDLE, rng);
    expect(m.shootout?.taken).toEqual([1, 0]);
    expect(m.shootout?.scored).toEqual([0, 0]);
    expect(m.shootout?.team).toBe(1);
  });
});
```

Run: `npx vitest run components/games/football-logic/match.test.ts -t 'leaves the field or never arrives'`
Expected: PASS. Si el timeout no cae en el paso exacto, **medir y reportar** antes de tocar nada: la resolución arranca en `SHOOTOUT_RESOLVE_STEPS` en el paso de la ejecución y baja uno por paso a partir del siguiente.

- [ ] **Step 14: Test de la muerte súbita en sus dos formas**

```ts
// S-PK5, the rule Paco dictated word for word: in sudden death the first team to miss
// loses, even if the rival has not taken its kick of that round. Both shapes are pinned.
// The second test below ('team 1 misses the second kick...') passes through the exact
// state Stage B2 finding H1 broke -- [6,5]/[6,5], asserted mid-test at the point team 0
// has just scored one kick ahead -- so with the un-fixed shootoutWinner this test fails
// one line earlier than its own assertion of it: `phase` is already 'over' (the wrong
// team having been declared the winner) instead of still 'shootout' with team 1 yet to
// take its sixth kick.
describe('sudden death: the first to miss loses', () => {
  const TEN_GOALS: readonly ('save' | 'goal')[] = ['goal', 'goal', 'goal', 'goal', 'goal', 'goal', 'goal', 'goal', 'goal', 'goal'];
  it('team 0 misses the first kick of the round and loses without team 1 kicking', () => {
    const m = atShootout();
    const rng = shootoutRng([...TEN_GOALS, 'save']);
    for (let i = 0; i < 10; i++) takeKick(m, rng);
    expect(m.phase).toBe('shootout');
    expect(m.shootout?.taken).toEqual([5, 5]);
    expect(m.shootout?.scored).toEqual([5, 5]);
    expect(m.shootout?.suddenDeath).toBe(true);
    expect(m.shootout?.team).toBe(0);
    expect(m.shootout?.takerId).toBe(6);             // sixth kick, sixth outfield id
    takeKick(m, rng);
    expect(m.phase).toBe('over');
    expect(m.shootout?.taken).toEqual([6, 5]);       // team 1 never took its kick of the round
    expect(m.shootout?.scored).toEqual([5, 5]);
    expect(winnerOf(m)).toBe(1);
  });
  it('team 1 misses the second kick of the round and loses on the scoreboard', () => {
    const m = atShootout();
    const rng = shootoutRng([...TEN_GOALS, 'goal', 'save']);
    for (let i = 0; i < 11; i++) takeKick(m, rng);
    expect(m.phase).toBe('shootout');
    expect(m.shootout?.taken).toEqual([6, 5]);
    expect(m.shootout?.scored).toEqual([6, 5]);
    takeKick(m, rng);
    expect(m.phase).toBe('over');
    expect(m.shootout?.taken).toEqual([6, 6]);
    expect(m.shootout?.scored).toEqual([6, 5]);
    expect(winnerOf(m)).toBe(0);
  });
  // Anti-coincidence: a sudden-death round where both score is not a win for anybody,
  // and the shootout goes into another round with the next takers.
  it('a sudden-death round where both score goes on to another round', () => {
    const m = atShootout();
    const rng = shootoutRng([...TEN_GOALS, 'goal', 'goal']);
    for (let i = 0; i < 12; i++) takeKick(m, rng);
    expect(m.phase).toBe('shootout');
    expect(m.shootout?.taken).toEqual([6, 6]);
    expect(m.shootout?.scored).toEqual([6, 6]);
    expect(m.shootout?.team).toBe(0);
    expect(m.shootout?.takerId).toBe(7);
  });
});
```

Run: `npx vitest run components/games/football-logic/match.test.ts -t 'sudden death'`
Expected: PASS.

- [ ] **Step 15: Test de invariantes durante la tanda**

```ts
// Criterion 9b and S-PK4 held step by step through a whole shootout, not only at its
// start: the keepers never leave their boxes, nobody leaves the pitch, and the only
// player allowed to move while a kick is being taken is the defending keeper (on the
// step it dives). The taker does not even move: it is placed once, when its kick begins.
describe('nothing and nobody moves during a shootout except the ball and the diving keeper', () => {
  // Eleven kicks: five-and-five (all scored) puts it into sudden death, and the 11th --
  // team 0's, per S-PK3's alternation -- is the 'save' that ends it. The same script as
  // Task 7b-1 Step 14's test 1 (match.test.ts:1085), which pins the winner as team 1:
  // team 0 is the one that misses.
  it('holds for eleven kicks', () => {
    const m = atShootout();
    const rng = shootoutRng(['goal', 'goal', 'goal', 'goal', 'goal', 'goal', 'goal', 'goal', 'goal', 'goal', 'save']);
    const beforeX: number[] = [];
    const beforeY: number[] = [];
    let steps = 0;
    while (m.phase === 'shootout' && steps < 12 * (SET_PIECE_COUNTDOWN_STEPS + SHOOTOUT_RESOLVE_STEPS)) {
      const sh = m.shootout;
      expect(sh).not.toBeNull();
      const takenBefore = (sh?.taken[0] ?? 0) + (sh?.taken[1] ?? 0);
      const keeperId = (sh?.team === 0 ? 1 : 0) * TEAM_SIZE;
      for (let i = 0; i < m.players.length; i++) { beforeX[i] = m.players[i].x; beforeY[i] = m.players[i].y; }
      stepMatch(m, IDLE, rng);
      expect(checkGoalkeepersInBox(m.players, m.attackDir, m.pitch)).toEqual([]);
      for (const p of m.players) {
        expect(p.x, `player ${p.id} left the pitch in x`).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(PITCH.width);
        expect(p.y, `player ${p.id} left the pitch in y`).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(PITCH.height);
      }
      const kickChanged = (m.shootout?.taken[0] ?? 0) + (m.shootout?.taken[1] ?? 0) !== takenBefore;
      if (!kickChanged) {
        for (let i = 0; i < m.players.length; i++) {
          if (m.players[i].x === beforeX[i] && m.players[i].y === beforeY[i]) continue;
          expect(m.players[i].id, 'somebody other than the defending keeper moved during a kick').toBe(keeperId);
        }
      }
      steps++;
    }
    expect(m.phase).toBe('over');
    expect(winnerOf(m)).toBe(1);   // team 0's 11th kick is the miss (Stage B2 finding H2)
  });
});
```

Run: `npx vitest run components/games/football-logic/match.test.ts -t 'except the ball and the diving keeper'`
Expected: PASS.

- [ ] **Step 16: La CPU elige lado en cada lanzamiento (S11 + S-PK11)**

En `ai.ts`, `AiState` gana un campo y `createAiState` su valor inicial:

```ts
  penaltyChosen: boolean;
  penaltySide: PenaltySide;
  penaltyKickIndex: number;      // which kick of the shootout the side was drawn for (-1 outside one)
```

```ts
    penaltyChosen: false, penaltySide: 0, penaltyKickIndex: -1,
```

y en `decideTeamInput`, la rama de las piezas:

```ts
  if (phase === 'kickoff' || phase === 'set-piece' || phase === 'shootout') {
    state.plan = 'none';
    const sp = match.setPiece;
    if (sp !== null && sp.kind === 'penalty' && sp.team === team) {
      // Stage B assumption S11, not in the spec -- review in QA: uniform over the
      // three sides, ONE draw per penalty, kept through the whole countdown.
      // Stage B2 assumption S-PK11: a shootout is ONE phase from the first kick to the
      // last, so the reset below (which fires when the phase changes) never runs between
      // kicks. The kick the side was drawn for is remembered instead, so each kick draws
      // exactly once and the CPU does not shoot at the same side all shootout long.
      const kickIndex = match.shootout === null ? -1 : match.shootout.taken[team];
      if (!state.penaltyChosen || state.penaltyKickIndex !== kickIndex) {
        state.penaltyChosen = true;
        state.penaltyKickIndex = kickIndex;
        const r = rng();
        state.penaltySide = r < 1 / 3 ? -1 : r < 2 / 3 ? 0 : 1;
      }
      out.dy = state.penaltySide;
    }
    return;
  }
  state.penaltyChosen = false;
  state.penaltyKickIndex = -1;
```

Test en `ai.test.ts`, junto al de S11:

```ts
  // S-PK11: the whole shootout is one phase, so the phase change that used to reset the
  // choice never comes. Each kick draws exactly once, and two consecutive kicks of the
  // same team draw again instead of repeating the first side for ever.
  it('during a shootout the CPU draws its side once per kick, not once per shootout', () => {
    const m = createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
    resumePlay(m); endHalf(m); endHalfTime(m); resumePlay(m); endHalf(m);
    resumePlay(m);
    expect(endExtraTime(m)).toBe(true);
    const state = createAiState();
    const out = createTeamInput();
    let calls = 0;
    const rng = () => { calls++; return 0.7; };                 // -> side +1 (S11: thirds)
    for (let i = 0; i < 5; i++) decideTeamInput(m, 0, m.profiles[0], state, rng, out);
    expect(out.dy).toBe(1);
    expect(calls).toBe(1);
    // The defending team does not touch the d-pad while the rival kicks.
    const other = createTeamInput();
    decideTeamInput(m, 1, m.profiles[1], createAiState(), rng, other);
    expect([other.dx, other.dy]).toEqual([0, 0]);
    expect(calls).toBe(1);
    // Second kick of team 0: a new draw.
    const sh = m.shootout;
    expect(sh).not.toBeNull();
    if (sh !== null) sh.taken[0] = 1;
    decideTeamInput(m, 0, m.profiles[0], state, rng, out);
    expect(calls).toBe(2);
  });
```

Imports nuevos en `ai.test.ts`: `endExtraTime`, `endHalf`, `endHalfTime` desde `./match` (comprobar cuáles ya están).

Run: `npx vitest run components/games/football-logic/ai.test.ts -t 'once per kick'`
Expected: PASS. Y el test S11 anterior (`'calls' === 1` en un penalti normal) sigue verde sin tocarlo: fuera de una tanda `kickIndex` vale `-1` y no cambia.

- [ ] **Step 17: La propiedad que fija el criterio 23 — la tanda termina SIEMPRE**

En `ai.test.ts`, al final:

```ts
// Criterion 23 and risk 8: the shootout is deterministic with the injected rng and it
// ALWAYS ends -- never a match without a winner. Thirty seeds of CPU vs CPU, entered
// through the engine's own transitions instead of playing 14 580 steps of football
// first, which is what makes this affordable inside the suite.
describe('the shootout always ends with a winner (criterion 23)', () => {
  function playShootout(seed: number, difficulty: readonly [number, number]): { m: MatchState; steps: number; kicks: number } {
    const profiles: [AiProfile, AiProfile] = [profileFor(TEAMS[0], difficulty[0]), profileFor(TEAMS[1], difficulty[1])];
    const m = createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, profiles);
    resumePlay(m); endHalf(m); endHalfTime(m); resumePlay(m); endHalf(m);
    resumePlay(m);
    endExtraTime(m);
    const matchRng = createRng(seed);
    const aiRng = createRng(seed ^ 0x5bd1e995);
    const states: [AiState, AiState] = [createAiState(), createAiState()];
    const live: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    // A ceiling, not a rule: the engine has no cap on sudden death (S-PK9). Each kick is
    // saved with probability penaltyReadChance >= 0.5125, so 60 kicks without a single
    // miss has probability below 1e-18; a run that hits this ceiling is a hang.
    const cap = 60 * (SET_PIECE_COUNTDOWN_STEPS + SHOOTOUT_RESOLVE_STEPS);
    let steps = 0;
    while (m.phase !== 'over' && steps < cap) {
      for (const t of [0, 1] as const) decideTeamInput(m, t, profiles[t], states[t], aiRng, live[t]);
      stepMatch(m, live, matchRng);
      steps++;
    }
    const sh = m.shootout;
    return { m, steps, kicks: (sh?.taken[0] ?? 0) + (sh?.taken[1] ?? 0) };
  }
  it('thirty seeds: every one of them ends, with a winner, inside the ceiling', () => {
    let suddenDeaths = 0;
    let earlyCuts = 0;
    const winners = [0, 0];
    for (let seed = 1; seed <= 30; seed++) {
      const difficulty: readonly [number, number] = seed % 2 === 0 ? [8, 8] : [1, 8];
      const { m, steps, kicks } = playShootout(seed, difficulty);
      expect(m.phase, `seed ${seed} never finished its shootout`).toBe('over');
      const winner = winnerOf(m);
      expect(winner, `seed ${seed} ended without a winner`).toBeGreaterThanOrEqual(0);
      expect(steps).toBeLessThan(60 * (SET_PIECE_COUNTDOWN_STEPS + SHOOTOUT_RESOLVE_STEPS));
      expect(kicks).toBeGreaterThanOrEqual(2);
      expect(m.score).toEqual([0, 0]);
      winners[winner]++;
      if (m.shootout?.suddenDeath === true) suddenDeaths++;
      if (kicks < 2 * SHOOTOUT_ROUNDS) earlyCuts++;
    }
    // Anti-coincidence: thirty shootouts that all ended in the same shape would prove
    // nothing about the rules. Both endings and both winners have to show up.
    expect(suddenDeaths + earlyCuts, 'no shootout was cut early and none reached sudden death').toBeGreaterThan(0);
    expect(winners[0] + winners[1]).toBe(30);
    expect(winners[0], 'team 0 never won a shootout in thirty seeds').toBeGreaterThan(0);
    expect(winners[1], 'team 1 never won a shootout in thirty seeds').toBeGreaterThan(0);
  });
  // Criterion 1 on the shootout: same seed, same shootout; another seed, another one.
  it('the same seed replays to the same shootout, and another seed does not', () => {
    const a = playShootout(7, [8, 8]);
    const b = playShootout(7, [8, 8]);
    expect(b.m.shootout?.taken).toEqual(a.m.shootout?.taken);
    expect(b.m.shootout?.scored).toEqual(a.m.shootout?.scored);
    expect(b.steps).toBe(a.steps);
    expect(winnerOf(b.m)).toBe(winnerOf(a.m));
    const other = playShootout(8, [8, 8]);
    // Ruling R3's shape: the negative names WHAT differs, not just "not equal".
    const differs = other.kicks !== a.kicks
      || other.m.shootout?.scored[0] !== a.m.shootout?.scored[0]
      || other.m.shootout?.scored[1] !== a.m.shootout?.scored[1]
      || winnerOf(other.m) !== winnerOf(a.m);
    expect(differs, 'seed 8 produced exactly the same shootout as seed 7').toBe(true);
  });
});
```

Imports nuevos en `ai.test.ts`: `SET_PIECE_COUNTDOWN_STEPS`, `SHOOTOUT_RESOLVE_STEPS`, `SHOOTOUT_ROUNDS` desde `./set-pieces`, y `winnerOf` desde `./match`.

Run: `npx vitest run components/games/football-logic/ai.test.ts -t 'always ends with a winner'`
Expected: PASS. Si alguna semilla acaba en el techo: **BLOCKED** con la semilla, el número de lanzamientos y el marcador de la tanda; es exactamente el riesgo 8 del spec y no se arregla subiendo el techo.

- [ ] **Step 18: Verificación de la tarea**

Run: `npx vitest run` → 52 ficheros verdes y **915 tests** (894 de la Task 7b-1 + 21 nuevos de esta tarea: 2 de `placeAroundCentreSpot` + 5 de la tanda en `set-pieces.test.ts` [4 + 1 del H7] + 5 de la tanda kick-by-kick + 2 de fuera/timeout + 3 de muerte súbita + 1 de invariantes + 1 de la CPU por lanzamiento + 2 de "siempre termina").
Run: `npx tsc --noEmit` → sin salida.
Run: `grep -rn "Math.random\|Date.now\|performance.now\|Math.sin\|Math.cos\|Math.atan2\|Math.hypot" components/games/football-logic/` → vacío.
Run: `npx vitest run components/games/football-logic/ -t 'recorded'` → los dos partidos grabados de R26 en verde sin tocar aserciones.

- [ ] **Step 19: Propose commit (NO ejecutar)**

```
feat(world-cup): five-penalty shootout with sudden death, reusing the penalty set piece

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
```

---

## Cierre de la etapa B2

Se hace en una sola pasada, después de las dos tareas, y **no toca código salvo que una sonda encuentre algo**.

- [ ] **Step 1: La suite, el compilador y el build**

```bash
npx vitest run                      # 52 ficheros verdes, 915 tests (861 + 33 de la Task 7b-1 + 21 de la 7b-2)
npx tsc --noEmit                    # sin salida
npm run build                       # verde; NUNCA `next dev`
```

- [ ] **Step 2: Grep de determinismo sobre toda la carpeta, tests incluidos**

```bash
grep -rn "Math.random\|Date.now\|performance.now\|Math.sin\|Math.cos\|Math.atan2\|Math.hypot" components/games/football-logic/
```
Esperado: vacío.

- [ ] **Step 3: Exportaciones sin consumidor**

```bash
grep -rn "^export" components/games/football-logic/ | wc -l
```
Y para cada símbolo nuevo de esta etapa (`EXTRA_TIME_SECONDS`, `EXTRA_TIME_STEPS`, `SHOOTOUT_ROUNDS`, `SHOOTOUT_RESOLVE_SECONDS`, `SHOOTOUT_RESOLVE_STEPS`, `ShootoutState`, `createShootoutState`, `resetShootout`, `shootoutWinner`, `shootoutTakerId`, `beginShootoutKick`, `placeAroundCentreSpot`, `SHOOTOUT_GRID_*`, `endExtraTime`, `endShootout`, `winnerOf`), comprobar con `grep -rn "<símbolo>" components/games/football-logic/` que tiene consumidor de código o de test, o **línea de destino escrita** (`// exported for Task 8/9: …`). Los que hoy solo esperan a la pantalla son `SHOOTOUT_RESOLVE_SECONDS` y `winnerOf`: los dos la llevan.

- [ ] **Step 4: Sondas ejecutables desde el scratchpad**

**Mecanismo (el único que funciona, del informe de la etapa B; `npx vitest run --root <D> --dir .` NO aísla):**

```bash
D=<scratchpad>/b2-probes
mkdir -p "$D"
ln -sfn <repo>/node_modules "$D/node_modules"
# los ficheros de sonda son <D>/*.test.ts e importan por ruta absoluta desde
# <repo>/components/games/football-logic/…
npx vitest run --root "$D" --reporter=verbose
```

**Nunca** se escribe un `*.test.ts` bajo `.superpowers/` ni dentro del repo: las sondas viven en el scratchpad y el symlink también.

Stage B2 finding H10: el reporter por defecto de vitest 4.1.11 se traga cualquier `console.log` de un test — probado hoy con el propio mecanismo (0 líneas, incluso con `--silent=false`). Como P1, P2 y P4 son sobre todo mediciones, sin salida no hay informe que llevar a Paco. **`--reporter=verbose` sí imprime** (medido) y es el flag que va en el comando de arriba; `--disableConsoleIntercept` también vale como alternativa. Si aun así no aparece nada, la salvedad es escribir los números con `appendFileSync` a un fichero del propio `$D` en vez de `console.log` — el mecanismo que se ha usado para medir este mismo pre-vuelo — y leer ese fichero al terminar la sonda.

**Sonda P1 — 40 partidos CPU vs CPU completos, las tres formaciones y varias dificultades.** Semillas 200-239, formaciones `[0,0] [1,1] [2,2] [0,2]` rotando y dificultades `[8,8] [5,5] [4,6] [1,1]` rotando; cap `8 * HALF_STEPS`. Mide, por partido: si llegó a prórroga, pasos de prórroga, si llegó a la tanda, lanzamientos de la tanda, si hubo muerte súbita, pasos totales y `winnerOf`. Salidas exigidas:
- **`sinGanador === 0`** — ningún partido termina sin ganador (criterio 23).
- **`ningunoEnElTecho === 40`** — ninguno agota el cap.
- Reportar (no son puertas, son datos de QA para Paco): cuántos llegan a prórroga, cuántos a la tanda, cuántos a muerte súbita, y la duración máxima en pasos y en segundos de reloj de partido.
- **Referencia medida hoy contra el motor SIN la B2, con esas mismas 40 semillas:** 16 de 40 llegaron a la parte 3 y la prórroga más larga duró **3 451 pasos** (57,5 s) — o sea que con el tope de 3 600 **ninguno de esos 40 habría llegado a la tanda**. Si la sonda da 0 tandas, eso NO es un fallo: es el ritmo del juego. Por eso la sonda lleva un segundo lote.

**Sonda P2 — 200 tandas forzadas.** Mismo mecanismo; cada partido entra en la tanda por las transiciones del motor (`resumePlay`/`endHalf`/`endHalfTime`/`endExtraTime`, como el helper de `ai.test.ts`) y se juega CPU vs CPU con semillas 1-200 y dificultades alternas. Exige:
- **0 tandas sin ganador** y **0 tandas en el techo** de 60 lanzamientos.
- Reportar: histograma de lanzamientos por tanda, cuántas se cortaron dentro de los cinco, cuántas llegaron a muerte súbita, la más larga, el reparto de victorias 0/1 (debe estar cerca del 50/50 con dificultades iguales) y el número de pasos de la más larga.

**Sonda P3 — determinismo de la etapa.** Diez semillas, cada una jugada dos veces: mismo `taken`, mismo `scored`, mismo `stepCount` final y mismo ganador; y con la semilla vecina, distinto. Exige **10/10 iguales y 10/10 distintas de su vecina**.

**Sonda P4 — invariantes bajo carga.** Sobre las 200 tandas de P2, contar `checkGoalkeepersInBox` no vacío, jugadores fuera del campo y balón libre fuera del campo mientras la tanda sigue viva. Exige **0, 0 y 0**.

- [ ] **Step 5: Informe de cierre**

Un `progress.md`/informe en `.superpowers/sdd/2026-09-06-vault-world-cup-stage-b2/` (git-ignorado) con: las mediciones de las cuatro sondas, la lista de caducidades aplicadas una a una con su justificación, los supuestos S-PK7..S-PK12 para que Paco los confirme o los cambie, y los mensajes de commit propuestos. **Ningún commit**: los hace Paco.

---

## Supuestos abiertos (para Paco, además de S-PK1..S-PK6)

Los seis primeros vienen del spec y se implementan tal cual. Estos seis son huecos que el spec no cierra; cada uno va **etiquetado en el código** `// Stage B2 assumption S-PKn, not in the spec — review in QA` y aquí está la alternativa que se descartó.

- **S-PK7 · Los porteros no van al círculo central.** S-PK4 dice "los dieciséis restantes se colocan en el círculo central", y dieciséis restantes incluye al portero del equipo que lanza. Pero el criterio 9b y su invariante `checkGoalkeepersInBox` prohíben que un portero esté fuera de su área grande, y esa invariante se comprueba paso a paso. **Elegido:** se aparcan los **quince jugadores de campo** que no lanzan y los dos porteros se quedan en sus líneas. **Alternativa:** aparcar también al portero atacante y exceptuar la fase `'shootout'` en la invariante (descartada: debilita la única red que tiene el criterio 9b).
- **S-PK8 · Cada equipo lanza a la portería que atacaba.** El spec no dice si la tanda se tira a una sola portería. `executePenalty` deriva la portería de `attackDir`, así que las dos porterías se van alternando. **Alternativa:** invertir `attackDir` durante la tanda para tirar todos a la misma (descartada: `attackDir` gobierna colocación, árbitro y portero, y tocarlo por estética sería el cambio más grande de la etapa).
- **S-PK9 · La muerte súbita no lleva tope duro en el motor.** El criterio 23 exige que la tanda termine siempre; la regla de S-PK5 garantiza que **cada ronda tiene como mucho un lanzamiento perdedor**, y como el portero para con probabilidad `penaltyReadChance` ∈ [0,5125, 0,60], la probabilidad de sesenta lanzamientos seguidos sin un fallo es menor que 1e-18. **Elegido:** cero tope en el motor y techo solo en el test y en la sonda, que tratan alcanzarlo como un cuelgue. **Alternativa:** un tope duro (por ejemplo veinte rondas) resuelto con una tirada (descartada: inventaría una regla de fútbol que Paco no ha dictado).
- **S-PK10 · Aparcar limpia el suelo, la entrada y la carga — de los quince Y de los dos porteros.** Una prórroga que se agota justo mientras alguien está en el suelo o a mitad de una entrada dejaría a ese jugador congelado en esa pose durante toda la tanda, porque en la tanda no corre la física de jugadores. **Elegido:** `placeAroundCentreSpot` pone a cero `tackleStepsLeft`, `downUntilStep` y la carga de los quince jugadores de campo que aparca, y `beginShootoutKick` hace lo mismo con los dos porteros (hallazgo H7 del pre-vuelo: `placeByFormation`, lo único que la pieza les toca, no limpia esos tres campos). **Alternativa:** dejarlos (descartada: es un artefacto visible en la etapa C y no cuesta nada limpiarlo).
- **S-PK11 · La CPU vuelve a elegir lado en cada lanzamiento.** S11 (etapa B) tira una vez por penalti y guarda el lado hasta que **cambia la fase**; una tanda entera es **una sola fase**, así que sin esto la CPU tiraría al mismo lado los diez lanzamientos. **Elegido:** el `AiState` recuerda para qué lanzamiento (`shootout.taken[team]`) tiró, y vuelve a tirar cuando cambia. **Alternativa:** que el motor exponga un contador de lanzamiento propio (descartada: `taken` ya lo es).
- **S-PK12 · La tanda no toca `match.score`, y quien decide el partido es `winnerOf`.** El spec da a `ShootoutState` su propio `scored`, así que un partido decidido en los penaltis acaba `'over'` **con el marcador empatado**. Eso deja sin respuesta quién cobra los 5 000 puntos de "Victoria en un partido" y quién pasa de ronda. **Elegido:** un único lector, `winnerOf(match)`, que lee el marcador y, si está empatado, la tanda; lo consumirán `world-cup.ts` (Task 9) y el HUD (Task 8). **Alternativa:** sumar el gol de la tanda a `match.score` (descartada: falsearía el marcador que pinta el HUD y el "portería a cero" de la tabla de puntuación).

**Contradicción spec ↔ código resuelta a favor del spec, y anotada:** el ruling **R18** de la etapa A ("el reloj NO avanza en `half === 3` en ninguna rama") queda **sustituido** por la decisión de Paco del 06-sep; su test se reescribe con el signo contrario (caducidad 2) y el comentario de `advanceClock` dice de dónde viene el cambio. Es el único choque entre lo que hay escrito en el código y lo que manda el spec de hoy.

**Colocación de `ShootoutState` (nota estructural, no supuesto):** el bloque de código del spec lo escribe bajo `// match.ts`, pero su tabla de ficheros da a `set-pieces.ts` "los lanzamientos de la tanda". El tipo vive en `set-pieces.ts` —que es de donde `beginShootoutKick` puede usar la `placeTaker` privada— y `match.ts` lo **re-exporta**, así que `MatchState.shootout: ShootoutState | null` se lee exactamente como el spec lo escribe y la dirección de los imports no cambia.

---

## Self-Review

**1. Cobertura del spec.** Recorridas las secciones que tocan la etapa B2:

| Requisito del spec | Dónde queda cubierto |
|---|---|
| Prórroga de 60 s con gol de oro dentro (§Alcance, §Decisiones 06-sep) | Task 7b-1 Steps 3, 5 (`EXTRA_TIME_STEPS`, cola de `stepOpenPlay`) + tests Steps 1, 7, 8 |
| `EXTRA_TIME_SECONDS` como constante (tabla "Números de partida") | Task 7b-1 Step 3 |
| `half === 3` es la prórroga, sin fase `'extra-time'` (S-PK6) | No se añade ninguna fase salvo `'shootout'`: `MatchPhase` de la Task 7b-1 Step 5 |
| El reloj corre en la parte 3, R18 sustituido | Task 7b-1 Step 5(d) + caducidad 2 |
| Al agotarse sin gol → `phase = 'shootout'` con `ShootoutState` | Task 7b-1 Steps 4, 5(f) |
| El reloj no avanza en la tanda (S-PK6) | `stepShootout` no llama a `advanceClock` (Task 7b-2 Step 11) + test del tope, que fija `halfStep` en `EXTRA_TIME_STEPS` |
| `abandon()` intacto | No se toca; solo gana `'shootout'` en la lista `legal` del test (caducidad 7) |
| Cada lanzamiento reutiliza la pieza de penalti (S-PK1) | `beginShootoutKick` llama a `beginSetPiece(..., 'penalty', ...)` y el paso usa `stepSetPiece` (Task 7b-2 Steps 7, 11) |
| Resolución por gol / atajada / fuera / 4 s (S-PK2), sin rechace | `judgeShootoutKick` + `SHOOTOUT_RESOLVE_STEPS` (Task 7b-2 Step 11) + tests Steps 9 y 13 |
| Orden de lanzadores (S-PK3) | `shootoutTakerId` + test Step 5 |
| Los demás quietos en el círculo, IA de colocación apagada (S-PK4) | `placeAroundCentreSpot` + `stepShootout` sin `positionTeam`/`stepPhysics` + test Step 15 |
| Corte por imposibilidad y muerte súbita "el primero que falla pierde" (S-PK5) | `shootoutWinner` (Task 7b-1 Step 4) + tests Steps 10 (tabla de verdad), 9 (3-0) y 14 (las dos formas) |
| Estado y campos de `ShootoutState` (S-PK6) | Task 7b-1 Step 4, campo por campo como el spec los escribe |
| Criterio 12 (la CPU en ataque en la prórroga) | Ya cubierto por la etapa B (`chooseStrategy` devuelve `'attack'` con `half === 3`, ai.test.ts:438, y P10 lo midió en partido); esta etapa lo deja intacto y lo verifica en el Step 12 de la Task 7b-1 |
| Criterio 23 (determinista y termina siempre) | Task 7b-2 Step 17 + sondas P2 y P3 del cierre |
| Riesgo 8 (la tanda tiene que terminar) | S-PK9 + el techo de 60 lanzamientos tratado como cuelgue, en test y en sonda |
| Guarda de precondición en cada transición nueva | `endExtraTime` y `endShootout` guardan su fase de partida, y la tabla de guardas genera el test negativo de cada una desde las siete fases restantes (Task 7b-1 Step 9) |

**2. Placeholders.** Repasado el documento: no hay "TBD", ni "implementar después", ni "similar a la Task N", ni pasos de código sin código. El único número que el plan no puede fijar de antemano —los pasos exactos que tarda un penalti marcado en cruzar la línea— se resuelve con una **aserción real** (`> SET_PIECE_COUNTDOWN_STEPS` y `< SET_PIECE_COUNTDOWN_STEPS + SHOOTOUT_RESOLVE_STEPS`), con la aritmética que lo predice escrita en el comentario, no con un hueco que alguien tenga que rellenar. La cuenta final de tests de la suite, en cambio, sí queda fija tras la revisión del pre-vuelo (Stage B2 finding H6): 894 al cerrar la Task 7b-1, 915 al cerrar la 7b-2.

**3. Consistencia de tipos y nombres.** Comprobado símbolo a símbolo contra el código real de hoy y entre las dos tareas: `ShootoutState` tiene los mismos seis campos en el tipo (7b-1 Step 4), en `resetShootout`, en `sameShootout` del test, en `beginShootoutKick` (7b-2 Step 7) y en `finishShootoutKick`; `shootoutWinner(sh)` recibe siempre un solo argumento; `beginShootoutKick` se llama en `startShootoutKick` con los nueve parámetros que declara, en el mismo orden que `beginSetPiece` los pide; `placeAroundCentreSpot(players, takerId, pitch)` tiene la misma firma en `players.ts`, en su test y en `set-pieces.ts`; `endExtraTime`/`endShootout`/`winnerOf` devuelven lo mismo en la declaración, en la tabla de guardas y en los tests; `SHOOTOUT_RESOLVE_STEPS` se importa en `match.ts` y en los dos ficheros de test con ese nombre exacto. La única función privada que se reutiliza desde otro sitio del mismo fichero es `placeTaker`, y por eso `beginShootoutKick` vive en `set-pieces.ts` y no en `match.ts`.
