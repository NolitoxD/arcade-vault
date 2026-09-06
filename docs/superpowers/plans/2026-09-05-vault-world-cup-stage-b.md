# Vault World Cup — Etapa B (la inteligencia y el contenido) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los pasos 6 y 7 del spec sobre el motor puro de la etapa A: `ai.ts` (colocación viva de los dieciséis no controlados por formación y estrategia, persecución acotada, portero que se mueve en su línea, sale solo en el área pequeña, ataja por `catchChance` y, con el balón en las manos, saca a botón —B saque con la mano, A pase largo— o automático a los 2 s (D4, grill del 05-sep), error angular de pase y chut por perfil, y la decisión del equipo CPU que rellena un `TeamInput` —chutar, pasar, conducir, entrar, robar, cambiar de estrategia por marcador— con perfil por dificultad 1-8 derivado por fórmula) y el contenido real (dieciséis selecciones y tres formaciones) con la red de invariantes cerrándose sobre él a la primera.

**Architecture:** Todo sigue en `components/games/football-logic/` como funciones puras con el estado, el campo, las formaciones y el `rng` por parámetro. La IA se parte en dos capas con una frontera nítida: (1) **la parte que vive DENTRO de `stepMatch`** y se aplica igual a los dos equipos (recomendación 2 del informe final): colocación de los no controlados, portero, atajada, saque del portero (a botón o automático, D4) y error angular de los golpeos, todo escrito desde `match.ts` sobre un **canal de movimiento nuevo** en `PlayerState` (`wantX`, `wantY`, `wantSprint`, recomendación 1) que `stepPhysics` honra para quien no es el controlado; (2) **la decisión del equipo CPU** (`decideTeamInput`), que vive FUERA del paso —la llama el componente en la etapa C y los tests aquí—, solo recibe el perfil (nunca la dificultad), lleva su propio `AiState` y su propio `rng`, y escribe un `TeamInput` válido por construcción. Así el replay sigue necesitando solo semilla + secuencia de `TeamInput` (criterio 1) y el motor sigue sin saber cuál de los dos es humano (criterio 2): la única diferencia entre un equipo humano y uno CPU es quién rellena su `TeamInput` y que el perfil del humano lleva error angular cero (ruling R10). El perfil viaja en `MatchState.profiles: [AiProfile, AiProfile]` (recomendación 3), así `match.ts` sigue sin importar contenido.

**Tech Stack:** TypeScript estricto, vitest 4.1.11 (tests `*.test.ts` junto al código, sin `vitest.config`), Node. Ni React ni canvas ni Supabase en esta etapa.

**Spec:** `specs/31-vault-world-cup.md` (Approved; §"Reglas de la IA (del grill del 2026-09-04)", §"Etapa B", criterios 11, 12, 14 y 18) · Plan de la etapa A: `docs/superpowers/plans/2026-09-04-vault-world-cup-engine.md` (formato y Global Constraints heredadas) · Informe final de la etapa A: `.superpowers/sdd/2026-09-04-vault-world-cup-engine/final-review-report.md` (§"Recommendations for stage B", §"Tests coupled to the 3-3-2 geometry", tabla de triaje `CARRY TO Task 6/7`) · Ledger: `.superpowers/sdd/2026-09-04-vault-world-cup-engine/progress.md` (rulings R1-R20, vinculantes) · Patrón de IA de referencia: `components/games/fighter-logic/ai.ts` y `ai.test.ts` (`profileFor(def, difficulty)` por fórmula, `decide(profile, ctx, rng, out)` sin asignar).

---

## Global Constraints

Heredadas literalmente de la etapa A, con la baseline actualizada:

- **Commits: SOLO el dueño.** Ninguna tarea ejecuta `git add` ni `git commit`. Cada tarea termina dejando el working tree **verificado** (`npx vitest run` + `npx tsc --noEmit`; `npm run build` además al cerrar la Task 7) y **propone el mensaje de commit exacto** en un paso "Propose commit". Si hiciera falta `--no-verify`, se avisa. Rama `main` (consentimiento explícito de Paco, mismo patrón que los 13 juegos anteriores).
- **Nunca arrancar `next dev`**: el dueño tiene el suyo en :3000. Esta etapa no tiene pantalla: la verificación es siempre la suite, el compilador y las sondas del cierre.
- **Comentarios y nombres de tests en inglés** (convención del repo). El plan, el spec y el chat, en castellano. Los textos de cara al jugador (nombres de selección y de formación), en castellano y mayúsculas.
- **Ficheros en kebab-case**; tipos en PascalCase; variables, funciones y constantes como en `fighter-logic/` (`SCREAMING_CASE` para constantes de módulo). TypeScript estricto: nada de `any`, nada de `!` gratuito, nada de `as` para tapar un tipo (solo `as never` en fixtures de tests que fabrican datos ilegales a propósito). El `as Axis` de los tests de la etapa A desaparece en esta etapa con `toAxis` (CARRY #10).
- **Nada de estado de módulo.** El campo, las selecciones, las formaciones, el estado del partido, el perfil, el `AiState` y el `rng` **se pasan siempre por parámetro**. `ai.ts` no lee `PITCH`, `TEAMS` ni `FORMATIONS`: recibe `match.pitch`, `match.formationTable[...]`, etc. Los tests pasan `PITCH` y `FORMATIONS` como argumentos, y así se ve.
- **Determinismo (riesgo 3 del spec): PROHIBIDO en `football-logic/`** `Math.random`, `Date.now`, `performance.now`, iterar un `Set` o un `Map` para decidir un orden, y `Math.sin`/`Math.cos`/`Math.atan2`/`Math.hypot`. El error angular se aplica con **skew + normalización** (`x' = x − e·y, y' = y + e·x`, recomendación 4), nunca con trigonometría. Los desempates son siempre por `id` más bajo. Antes de cerrar cada tarea: `grep -rn "Math.random\|Date.now\|performance.now\|Math.sin\|Math.cos\|Math.atan2\|Math.hypot" components/games/football-logic/` debe devolver **vacío**, tests incluidos (ruling R12).
- **La IA consume azar SOLO por el `rng` inyectado.** Dentro de `stepMatch` el orden de consumo por paso queda fijado así: atajada del portero (equipo 0, equipo 1); después, por cada equipo en orden, el robo de pie dentro de `applyButtons` y a continuación el error angular de su golpeo. **El saque del portero —a botón (B/A) o automático a los 2 s— no consume `rng`** (D4: es un saque y va exacto, como los de `stepSetPiece`); el penalti se tira en la fase de saque, como en la etapa A. Fuera del paso, `decideTeamInput` consume su **propio** `rng` (el del componente/test), nunca el del partido: si compartieran instancia, el replay con solo semilla + `TeamInput` divergiría.
- **Paso fijo: nada de `dtMs` dentro del motor.** `reactionMs` del spec se convierte a pasos con `stepsFor(ms / 1000)` en `profileFor` y el perfil guarda **`reactionSteps`**, nunca milisegundos (recomendación 3).
- **Sin asignación de memoria por paso.** Las funciones nuevas que corren dentro de `stepMatch` (`positionTeam`, `keeperStep`, `keeperCatch`, `applyKeeperButtons`, `applyKickError`, `stepPlayerFree`, `freestMateDir`, `pickPassTarget`) y la que corre cada paso fuera (`decideTeamInput`) escriben en out-params y en el estado; nada de `filter`/`map`/spread/objetos literales/`new`/closures dentro de ellas. Las únicas asignaciones permitidas son en eventos (`createMatch`, `createAiState`, `profileFor`).
- **Los números de las reglas de la IA del spec se transcriben a constantes con nombre** (tabla en la Task 6a), nunca literales enterrados. Lo que el spec NO da (huecos listados en el bloque "Supuestos" de cada tarea y en la respuesta final) se pone también en constantes, marcado `// Stage B assumption, not in the spec — review in QA`, igual que hizo R6. Los supuestos que Paco confirmó en el grill del 05-sep (D1 = S3, D2 = S14, D3 = S9, D4 = S17) llevan la etiqueta `// confirmed by owner 2026-09-05` y no van al QA como supuestos; la interpretación de ejecución de la regla nueva D4 (portero con balón) entra como supuesto **S-GK** en la Task 6a y en la lista final "Supuestos de la etapa".
- **Regla anti-coincidencia de fixtures (riesgo 7 del spec):** antes de dar por bueno un test, preguntarse "¿pasaría este test con otros números?". En esta etapa, concretamente: las dificultades comparadas son **1 frente a 8**, nunca vecinas; los tests de monotonía afirman el número exacto del perfil y ADEMÁS la desigualdad; el partido CPU vs CPU afirma que hubo chuts, pases cortos y largos, entradas y robos (contados por `ActionEvent.kind`), no solo que acabó; el negativo de semilla afirma el paso de divergencia; ninguna posición de fixture cae en el borde exacto de un radio (`GK_CATCH_RADIUS` se muestrea a 31 y 47, no a 39/40/41).
- **Todo lo exportado tiene consumidor** al cerrar cada tarea: código o test. Al cerrar la Task 7 se recorre `grep -n "^export"` de toda la carpeta y se **des-exportan las 11 constantes espejo** que el informe final lista sin consumidor (Task 7, paso 9), y se deja línea de destino en las que esperan a la etapa C.
- **Baseline verificada 2026-09-05: 760 tests en 51 ficheros verdes**, `npx tsc --noEmit` limpio, `npm run build` verde. Cada tarea suma y no regresa.
- **Si un test existente cambia de valor esperado es un bug que hay que INVESTIGAR, no relajar.** Las ÚNICAS expectativas con **fecha de caducidad declarada** (el informe final las anuncia; cambiarlas es parte del trabajo, no una regresión) son estas, y ninguna más:
  1. `step.test.ts` "non-controlled players never move under stepPhysics (the AI arrives in Task 6)" → se reescribe como "move only by their want vector" (Task 6a).
  2. `samePlayer` en `step.test.ts` y `match.test.ts`: suma los tres campos nuevos de `PlayerState` (`wantX`, `wantY`, `wantSprint`), como su propio comentario obliga (Task 6a).
  3. `sameMatch` en `match.test.ts`: `gkPenaltyRead` desaparece (lo sustituye `profiles`) y entra `catchRolled` (Task 6a).
  4. `createMatch(teams, formationTable, pitch)` pasa a recibir `profiles`: todos los `fresh()` de `match.test.ts` y el `expect(m.gkPenaltyRead)` cambian de forma (Task 6a).
  5. `releaseFromGoalkeeper` gana `players` y `pitch` (apunta al compañero más libre): sus dos tests de `actions.test.ts` cambian de firma, no de valor (Task 6a).
  6. Los **comentarios** con números medidos del partido grabado de `match.test.ts` ("14 915 pasos, 1-2…") y el comentario obsoleto "nobody tackles" (R20): se re-miden y se reescriben; las **aserciones** (rangos, fases visitadas, `sawFoulSetPiece`, divergencia) NO se tocan. Si una aserción del partido grabado deja de cumplirse tras cablear la colocación viva, se responde **BLOCKED** con la medición.
  7. `players.test.ts` "gives each team one goalkeeper…" (3 def / 2 fwd) y `teams.test.ts` entero: son tests de contenido que la Task 7 amplía o reescribe.
  8. `match.test.ts:482-491` **C2-C** ("a 700 u/s shot over the goal line … keeper ON his line"): el portero a 7,67 u de un balón en movimiento hace que `keeperCatchFor(1)` tire ANTES de la física, y `createRng(1)` da 0,627 < 0,75 (`catchChance` del nivel 5) → ataja y la fase sigue `'play'`. Es la regla 2 del portero del spec (D4) funcionando, no una regresión: se sustituye `createRng(1)` por `fixedRng([0.99])` (falla a cualquier nivel, `catchChance ≤ 0,90`) y se AÑADE `expect(rng.calls).toBe(1)` — queda documentado que el portero tiró y falló; las aserciones de gol y marcador no se tocan (Task 6a, Step 16). No es relajar: la expectativa (gol) es la misma, solo se retira la tirada nueva que la etapa B pone delante.
  9. `match.test.ts:356-374` **"a penalty draws from the rng only on the step it executes, and never again"** y `match.test.ts:397-437` **C1**: su premisa ("nada más en el motor consume `rng`" / "el portero solo recoge") muere con `keeperCatch`: el portero falla la lectura (0,627 ≥ 0,5625), el balón vuela recto y `keeperStep` lo desliza hasta `GK_CATCH_RADIUS` en ~11 pasos → tercera tirada (0,527 < 0,75: ataja), y en C1 el saque automático posterior puede acabar en banda dentro de la ventana de 400 pasos. Se pone al portero 9 en el suelo justo después del paso que ejecuta (`m.players[9].downUntilStep = m.stepCount + 60`): `keeperCatch` rechaza a un portero caído, así que la ÚNICA tirada / el ÚNICO saque que podría aparecer es un saque re-ejecutándose, que es exactamente la propiedad que los dos tests fijan. Las aserciones (`rng.calls === afterExecution`, `secondCall === -1`) no cambian (Task 6a, Step 16). No es relajar: la atajada es comportamiento del spec (regla 2), el fixture la aparta y la propiedad medida es la misma.
  Todo lo demás —incluidas las cuatro trazas del reloj en vacío (N1) y `set-pieces.test.ts:59` `takerId 5`— **debe seguir en verde sin tocarlo**: la 3-3-2 publicada no cambia ni una coma en la Task 7 (sigue siendo `FORMATIONS[0]` con los mismos ocho slots), y con entradas en vacío los controlados no se mueven, así que la traza N1 sobrevive. Si no sobrevive: BLOCKED con la medición.
- **Tipos y firmas idénticos entre tareas.** Las firmas de este plan son las del código REAL de la etapa A (comprobadas hoy sobre `components/games/football-logic/`): `stepMatch(match, inputs, rng)`, `stepPhysics(players, ball, inputs, controlled, attackDir, pitch, stepCount)`, `stepPlayer(p, dx, dy, wantSprint, hasBall, attackDir, pitch, stepCount)`, `anchorFor(slot, strategy, attackDir, pitch, out)`, `aimPass(p, players, dirX, dirY, farthest, stepCount, out)`, `applyButtons(p, input, ball, players, rng, stepCount, aim, out)`, `beginSetPiece(sp, kind, team, x, y, players, ball, formations, strategies, attackDir, pitch, stepCount)`, `stepSetPiece(sp, input, players, ball, rng, penaltyReadChance, attackDir, pitch, stepCount, aim, out)`, `checkGoalkeepersInBox(players, attackDir, pitch)`, `checkTeamInput(input, formationCount)`. `nearestOutfield` y `pushRivalsAway` son **privadas** de `set-pieces.ts` (se ejercitan por `beginSetPiece`); `toAxis` **no existe** todavía (la crea la Task 6a en `input.ts`).

---

## File Structure

Orden de dependencias (una fila solo importa de las de arriba; `ai.ts` importa `MatchState` de `match.ts` **solo como tipo**, `import type`, que se borra al compilar y no forma ciclo ESM; `match.ts` importa de `ai.ts` en runtime):

| Fichero | Tarea | Cambio |
|---|---|---|
| `input.ts` | 6a | + `toAxis(v, dead)` (cuantización con zona muerta; sustituye los `as Axis` de los tests, CARRY #10) |
| `pitch.ts` | 6a | + `goalKickX(pitch, side)` (el punto del saque de puerta, que hoy `referee.ts` calcula inline; desde D4 la atajada NO lo usa: su único consumidor de código es `referee.ts`); comentario de convenciones de frontera en `isBetweenPosts`/`isInsideBox` (CARRY #3) |
| `referee.ts` | 6a | `judgeBall` usa `goalKickX` (misma aritmética, sin duplicar) |
| `players.ts` | 6a | + `wantX`, `wantY`, `wantSprint` en `PlayerState`; `movePlayer` interna; `stepPlayerFree(p, hasBall, attackDir, pitch, stepCount)`; el portero se mueve a `GK_SPEED`; comentario sobre `isSprinting` en el último paso (CARRY #12) |
| `step.ts` | 6a | `stepPhysics` mueve a los no controlados con `stepPlayerFree` |
| `ball.ts` | 6a | `canPickUp`: el portero solo recoge balón **parado** (el que se mueve lo ataja o no, por `catchChance`) |
| `actions.ts` | 6a | `chargeFraction` compartida por `shotSpeed` y `shoot` (CARRY #13); `pickPassTarget` extraída de `aimPass` (misma aritmética); `freestMateDir`; `releaseFromGoalkeeper` apunta al compañero más libre en campo propio (regla 4 del portero: el saque automático a los 2 s, D4) y ya no limpia `out` en sus rutas no-op; **`applyKeeperButtons`** (D4: B saque con la mano / A pase largo del portero con balón, exactos); `ActionKind` + `'gk-catch'` |
| `set-pieces.ts` | 6a | comentario/guarda del `-1` de `nearestOutfield` (CARRY #20); sin cambio de comportamiento |
| `ai.ts` | 6a | **NUEVO**: `AiProfile`, `profileFor`, `humanProfile`, `positionTeam`, `keeperStep`, `keeperCatch`, `applyKickError`, `laneBlocked`, `quantizeDir` y las constantes de la IA |
| `ai.ts` | 6b | + `AiState`, `createAiState`, `chooseStrategy`, `decideTeamInput` (la capa de decisión, fuera del paso) |
| `match.ts` | 6a | `MatchState.profiles`, `MatchState.catchRolled`; `scratch.liveControlled` sustituye a `scratch.gkEvent` (los porteros escriben en su propio slot `events[gk.id]`); `createMatch(teams, formationTable, pitch, profiles)`; `stepOpenPlay` llama a `keeperCatch` (posesión del portero, **sin saque de puerta**, D4), `positionTeam`/`keeperStep`, y por equipo `applyKeeperButtons` + `releaseFromGoalkeeper` o `applyButtons` + `applyKickError`; `gkPenaltyRead` y `DEFAULT_PENALTY_READ_CHANCE` desaparecen |
| `teams.ts` | 7 | las 16 selecciones y las 3 formaciones (la 3-3-2 intacta) |
| `invariants.ts` | 7 | `checkFormation` sin el cast `as string` (CARRY #1) |
| `ai.test.ts` | 6a, 6b, 7 | **NUEVO**: perfil, colocación, portero, atajada, error angular, criterio 11 (6a); decisión, monotonía de reacción, entrada nunca inválida, partido CPU vs CPU grabado (6b); el mismo partido con las tres formaciones (7) |
| `players.test.ts` | 6a, 7 | `stepPlayerFree` (6a); recuentos de roles de las tres formaciones (7) |
| `step.test.ts` | 6a | expectativas 1 y 2 de la lista de caducidad |
| `ball.test.ts` | 6a | el portero no recoge un balón en movimiento; sí uno parado |
| `actions.test.ts` | 6a | `releaseFromGoalkeeper` nueva firma + compañero más libre; `applyKeeperButtons` (D4); `pickPassTarget`; `chargeFraction` |
| `set-pieces.test.ts` | 6a, 7 | fallback de distancia cero de `pushRivalsAway` (CARRY #19, 6a); lanzador por formación (7) |
| `input.test.ts` | 6a | `toAxis` |
| `pitch.test.ts` | 6a | `goalKickX` en los dos lados |
| `match.test.ts` | 6a, 7 | expectativas 3, 4 y 6; tests D4 del portero con balón (atajada → posesión inrobable sin cambio de fase; B/A durante los 2 s; automático a los `stepsFor(2)` pasos exactos; cruceta sin efecto sobre el controlado de campo); criterio 11 sobre una tabla de tres formaciones fabricada (6a) y sobre las reales (7) |
| `teams.test.ts` | 7 | reescrito entero para 16 selecciones y 3 formaciones |

**Subdivisión de la Task 6 en 6a/6b (una línea de justificación):** 6a (canal de movimiento + perfil + colocación + portero + error, cableado en `stepMatch`) y 6b (la capa de decisión y el partido CPU vs CPU) son dos entregables con test propio y un revisor puede rechazar uno aprobando el otro; juntos superan el ciclo implementar→revisar de una tarea. La numeración del spec (paso 6) se conserva.

---

## Task 6a: `ai.ts` dentro del paso — canal de movimiento, perfil, colocación viva, portero y error angular

**Files:**
- Modify: `components/games/football-logic/input.ts`
- Modify: `components/games/football-logic/pitch.ts`
- Modify: `components/games/football-logic/referee.ts:64-65`
- Modify: `components/games/football-logic/players.ts`
- Modify: `components/games/football-logic/step.ts:23-33`
- Modify: `components/games/football-logic/ball.ts:73-78`
- Modify: `components/games/football-logic/actions.ts`
- Modify: `components/games/football-logic/set-pieces.ts:43-56`
- Create: `components/games/football-logic/ai.ts`
- Modify: `components/games/football-logic/match.ts`
- Test: `components/games/football-logic/ai.test.ts` (nuevo), `input.test.ts`, `pitch.test.ts`, `players.test.ts`, `step.test.ts`, `ball.test.ts`, `actions.test.ts`, `set-pieces.test.ts`, `match.test.ts`

**Interfaces:**
- Consumes (código real de la etapa A): `PlayerState`, `stepPlayer`, `anchorFor`, `ownGoalSide`, `isPlayerDown`, `GK_SPEED`, `GK_CATCH_RADIUS`, `GK_LINE_DIST`, `PLAYER_SPEED`, `PLAYER_HEIGHT` (`players.ts`); `BallState`, `givePossession`, `kickBall` (`ball.ts`; `canPickUp` se MODIFICA en el Step 7, no se consume); `Vec2`, `dist`, `normalizeInto`, `INV_SQRT2` (`geometry.ts`); `PitchDef`, `Side`, `centerY`, `goalLineX`, `isInsideSmallArea`, `isInsideBigArea` (`pitch.ts`; `Side` solo en `goalKickX`, `ai.ts` no lo importa); `Formation`, `Strategy`, `TeamDef`, `TEAM_SIZE` (`teams.ts`; `STRATEGIES` no lo importa nadie nuevo: `anchorFor` ya lo consume dentro de `players.ts`); `Axis`, `TeamInput` (`input.ts`); `stepsFor`, `perStep` (`step.ts`); `Rng` (`rng.ts`); `ActionEvent`, `clearActionEvent`, `SHOT_SPEED_MIN`, `SHOT_SPEED_MAX`, `SHORT_PASS_SPEED`, `LONG_PASS_SPEED`, `GK_HOLD_STEPS`, `aimPass`, `shortPass`, `longPass` (`actions.ts`); `MatchState` (`match.ts`). Desde D4 la atajada no llama a `callSetPiece`: el único consumidor de `goalKickX` en código es `referee.ts`.
- Produces (lo usan la Task 6b, la Task 7 y la etapa C con estos nombres exactos):

```ts
// input.ts (añadido)
export function toAxis(v: number, dead: number): Axis;       // v > dead → 1; v < -dead → -1; else 0

// pitch.ts (añadido)
export function goalKickX(pitch: PitchDef, side: Side): number;   // smallAreaDepth | width - smallAreaDepth

// players.ts (añadido / cambiado)
export type PlayerState = { /* ...los 18 campos de la etapa A... */
  wantX: number; wantY: number;   // AI movement channel: |want| <= 1, the magnitude scales the speed (arrive exactly, no jitter)
  wantSprint: boolean;
};
export function stepPlayerFree(p: PlayerState, hasBall: boolean, attackDir: 1 | -1, pitch: PitchDef, stepCount: number): void;
// stepPlayer(p, dx, dy, wantSprint, hasBall, attackDir, pitch, stepCount) conserva firma y aritmética bit a bit.

// actions.ts (añadido / cambiado)
export type ActionKind = 'none' | 'shot' | 'short-pass' | 'long-pass' | 'steal' | 'tackle' | 'gk-release' | 'gk-catch';
export function chargeFraction(chargeSteps: number): number;               // 0..1, guarda <= 0 (CARRY #13)
export function pickPassTarget(p: PlayerState, players: readonly PlayerState[], dirX: number, dirY: number, farthest: boolean, stepCount: number): number; // id | -1
export function freestMateDir(gk: PlayerState, players: readonly PlayerState[], attackDir: 1 | -1, pitch: PitchDef, out: Vec2): boolean; // unit vector to the freest outfield mate in own half; false = none
// D4, the automatic release: fires ONLY at stepCount - ball.ownerSinceStep >= GK_HOLD_STEPS (120), a long pass at the
// freest own-half mate (straight along attackDir with nobody). No rng. Does NOT clear `out` on its no-op paths any more.
export function releaseFromGoalkeeper(gk: PlayerState, ball: BallState, players: readonly PlayerState[], attackDir: 1 | -1, pitch: PitchDef, stepCount: number, aim: Vec2, out: ActionEvent): void;
// D4, the release by button while the keeper holds the ball (caught or picked up: one path, ball.owner === gk.id):
// the d-pad aims (neutral = (attackDir, 0)); B 'pressed' = hand throw = assisted short pass (nearest mate in the
// 45° cone, aimPass); A 'pressed' = assisted long pass (farthest mate in the cone); nobody in the cone = straight.
// No angular error, no rng, only 'pressed' fires (never 'held'), A wins if both are pressed, and not on the very step
// the keeper took the ball (stepCount <= ball.ownerSinceStep). Events: 'short-pass' / 'long-pass' with actorId = gk.id.
export function applyKeeperButtons(gk: PlayerState, input: TeamInput, ball: BallState, players: readonly PlayerState[], attackDir: 1 | -1, stepCount: number, aim: Vec2, out: ActionEvent): void;

// ai.ts (nuevo)
export type AiProfile = {
  reactionSteps: number;     // stepsFor(reactionMs / 1000): 36 at level 1, 13 at level 8
  passErrorDeg: number;      // 16 → 2
  shotErrorDeg: number;      // 12.5 → 2
  catchChance: number;       // 0.55 → 0.90
  penaltyReadChance: number; // 0.5125 → 0.60
  tackleChance: number;      // 0.49 → 0.77
};
export function profileFor(def: TeamDef, difficulty: number): AiProfile;   // def unused in v1 (v1.5 attributes), kept in the signature as the spec asks
export function humanProfile(def: TeamDef, difficulty: number): AiProfile; // profileFor with passErrorDeg = shotErrorDeg = 0 (ruling R10)
export function quantizeDir(x: number, y: number, out: { dx: Axis; dy: Axis }): void;  // nearest of the 8 d-pad directions; (0,0) for the zero vector
export function laneBlocked(players: readonly PlayerState[], team: 0 | 1, fromX: number, fromY: number, dirX: number, dirY: number, length: number, radius: number, stepCount: number): boolean;   // `team` is MY team (the lane's owner); true when a standing rival of `team` lies in the corridor (pre-vuelo H1)
export function positionTeam(players: PlayerState[], ball: BallState, team: 0 | 1, formation: Formation, strategy: Strategy, attackDir: 1 | -1, controlled: number, pitch: PitchDef, stepCount: number, scratch: Vec2): void;
export function keeperStep(gk: PlayerState, players: readonly PlayerState[], ball: BallState, attackDir: 1 | -1, pitch: PitchDef, stepCount: number): void;
export function keeperCatch(gk: PlayerState, ball: BallState, catchChance: number, rolled: [boolean, boolean], rng: Rng, pitch: PitchDef, stepCount: number, out: ActionEvent): boolean;
export function applyKickError(ball: BallState, errorDeg: number, rng: Rng): void;   // one rng draw per call

// match.ts (cambiado)
export type MatchState = { /* ...la etapa A menos gkPenaltyRead... */
  profiles: readonly [AiProfile, AiProfile];
  catchRolled: [boolean, boolean];   // one catch roll per approach of the ball (per keeper)
  // scratch: gkEvent disappears (each keeper writes its own slot events[gk.id]); liveControlled is the
  // controlled tuple stepPhysics and positionTeam see THIS step: match.controlled, or -1 for a team whose
  // keeper holds the ball (D4: its TeamInput goes to the keeper, the field player is placed by the AI).
  scratch: { events: ActionEvent[]; liveControlled: [number, number]; call: RefereeCall; aim: Vec2; setPiece: SetPieceState };
};
export function createMatch(teams: [TeamDef, TeamDef], formationTable: readonly Formation[], pitch: PitchDef, profiles: readonly [AiProfile, AiProfile]): MatchState;
```

### Números de esta tarea (spec → constante, todas en `ai.ts` salvo que se diga)

| Regla del spec | Valor | Constante |
|---|---|---|
| Chuta si dist. a portería rival < 420 u | 420 | `SHOT_RANGE` |
| … a 150 u, toque; a 420, carga completa | 150 | `SHOT_TAP_DIST` |
| … hay línea: ningún rival a < 60 u de la recta en sus primeras 200 u | 60 · 200 | `SHOT_LANE_RADIUS` · `SHOT_LANE_LENGTH` |
| Pasa si hay presión (rival a < 90 u) | 90 | `PRESSURE_DIST` |
| … carril libre: ningún rival a < 50 u de la recta del pase | 50 | `PASS_LANE_RADIUS` |
| … corto si < 350 u, largo si más | 350 | `LONG_PASS_MIN_DIST` |
| Sprinta con 150 u de pista libre | 150 | `SPRINT_FREE_DIST` |
| Deriva: 30 % eje largo, 20 % eje corto | 0.30 · 0.20 | `DRIFT_LONG` · `DRIFT_SHORT` |
| Separación: compañeros a < 60 u se repelen | 60 | `SEPARATION_DIST` |
| El segundo cubre a 120 u entre balón y portería | 120 | `COVER_DIST` |
| Persiguen: ataque 3, neutral 2, defensa 1 | | `CHASERS: Readonly<Record<Strategy, number>>` |
| Portero: línea a 25 u · 220 u/s · ataja a < 40 u | | `GK_LINE_DIST`, `GK_SPEED`, `GK_CATCH_RADIUS` (ya en `players.ts`, R4) |
| Chut cargado al máximo resta 0,15 | 0.15 | `CHARGED_SHOT_CATCH_PENALTY` |
| Perfil: `reactionMs = 650 − d·55` | 650 · 55 | `REACTION_MS_BASE` · `REACTION_MS_PER_LEVEL` |
| `passErrorDeg = 18 − d·2` | 18 · 2 | `PASS_ERROR_BASE` · `PASS_ERROR_PER_LEVEL` |
| `shotErrorDeg = 14 − d·1,5` | 14 · 1.5 | `SHOT_ERROR_BASE` · `SHOT_ERROR_PER_LEVEL` |
| `catchChance = 0,50 + d·0,05` | 0.5 · 0.05 | `CATCH_BASE` · `CATCH_PER_LEVEL` |
| `penaltyReadChance = 0,50 + d·0,0125` | 0.5 · 0.0125 | `PENALTY_READ_BASE` · `PENALTY_READ_PER_LEVEL` |
| `tackleChance = 0,45 + d·0,04` | 0.45 · 0.04 | `TACKLE_BASE` · `TACKLE_PER_LEVEL` |
| Clamp a mínimos y máximos en constantes | valores en nivel 1 y 8 | `REACTION_MS_MIN/MAX`, `PASS_ERROR_MIN/MAX`, `SHOT_ERROR_MIN/MAX`, `CATCH_MIN/MAX`, `PENALTY_READ_MIN/MAX`, `TACKLE_MIN/MAX` |
| Cambio de estrategia cada 5 s · < 30 s | 5 · 30 | `STRATEGY_REVIEW_SECONDS` · `LATE_GAME_SECONDS` (Task 6b) |

### Supuestos de la Task 6a (el spec no lo fija; marcados `// Stage B assumption, not in the spec — review in QA`, salvo S3 y S9, que Paco confirmó el 05-sep y llevan `// confirmed by owner 2026-09-05`; ver la lista final "Supuestos de la etapa")

- **S1 · Cotas del clamp del perfil**: el spec pide "clamp a mínimos y máximos en constantes" sin darlos → cada campo se acota a su valor en nivel 1 y nivel 8 (`REACTION_MS_MIN = 210`, `REACTION_MS_MAX = 595`, etc.). Dificultades fuera de 1-8 saturan.
- **S2 · Skew como rotación**: `e = deg · (π/180)` y `x' = x − e·y, y' = y + e·x` normalizado; a 16° el error frente a la rotación exacta es < 0,3°. Constante `DEG_TO_SKEW = Math.PI / 180`.
- **S3 · Persecución — CONFIRMADO por Paco el 05-sep (D1)**: "solo el más cercano persigue; el segundo cubre a 120 u; el resto a su ancla" y "la estrategia fija cuántos persiguen: 3/2/1" se reconcilian así: los `CHASERS[strategy]` más cercanos al balón (el primero es el controlado, que mueve la entrada) persiguen el balón; el siguiente cubre a `COVER_DIST`; el resto, ancla + deriva. Rango por distancia ascendente, desempate por `id`. Etiqueta en código: `// confirmed by owner 2026-09-05 (D1)`; no va al QA como supuesto.
- **S4 · Separación**: la repulsión suma al objetivo `(SEPARATION_DIST − d)` en la dirección que aleja del compañero, por cada compañero a `< SEPARATION_DIST`.
- **S5 · Línea del portero**: la `y` objetivo es la intersección de la recta balón→centro de la portería con la línea a `GK_LINE_DIST`, con el parámetro acotado a [0, 1] y la `y` acotada a la anchura del área pequeña (`± smallAreaWidth / 2`), de la propia `PitchDef`.
- **S6 · El portero solo recoge balón parado**: un balón en movimiento a `< GK_CATCH_RADIUS` se juega una sola vez por aproximación (`catchRolled`); si falla, sigue su trayectoria y el portero no lo "aspira" a 22 u por `pickUp`. Un balón parado es "balón suelto" y sigue las reglas de recogida de todos.
- **S7 · Penalización por carga**: la resta de `CHARGED_SHOT_CATCH_PENALTY` es lineal en la velocidad del balón entre `SHOT_SPEED_MIN` (0) y `SHOT_SPEED_MAX` (0,15); los pases, más lentos, no restan. (Lo que S7 decía el 04-sep sobre el saque de puerta lo sustituye D4: la atajada da POSESIÓN al portero, regla 2 nueva del spec.)
- **S8 · Error angular**: se aplica en el motor SOLO a los golpeos de `applyButtons` (chut, pase corto, pase largo del controlado de campo) de los DOS equipos con el `passErrorDeg`/`shotErrorDeg` de `profiles[team]`; el humano lleva `humanProfile` (error 0, R10). Los saques (`stepSetPiece`) y **los saques del portero (`applyKeeperButtons` y `releaseFromGoalkeeper`, D4) van exactos y no consumen `rng`**. Una tirada de `rng` por golpeo de campo, error cero incluido.
- **S9 · Perfil del equipo humano — CONFIRMADO por Paco el 05-sep (D3)**: `humanProfile(def, difficulty)` con la MISMA dificultad que la CPU (portero y penalti simétricos; criterio 14 a dos por construcción); solo difiere en `passErrorDeg = shotErrorDeg = 0`. Etiqueta en código: `// confirmed by owner 2026-09-05 (D3)`.
- **S10 · Balón alto**: el portero ataja solo balones a `z <= PLAYER_HEIGHT`, como la recogida.
- **S-GK · Portero con balón (interpretación de ejecución de D4, regla 4 nueva del spec; marcado `// Stage B assumption S-GK (D4 interpretation) — review in QA`)**. Lo que D4 fija: la atajada (`rng() < catchChance − penalización`, balón a `< GK_CATCH_RADIUS`) da posesión al portero por `givePossession` —el MISMO camino que recoger un balón parado por `pickUp`—, sin cambio de fase; inrobable por construcción (`steal` y `stepTackle` ya rechazan al portero como dueño); mientras `ball.owner === gk.id` el `TeamInput` del equipo va al portero (`applyKeeperButtons`) y no al controlado de campo, que se coloca por `positionTeam`; B = saque con la mano = pase corto asistido (cono de 45° de R10, al más cercano); A = pase largo asistido (al más lejano del cono); sin compañero en el cono, recto; sin error angular; si a `GK_HOLD_STEPS` (= `stepsFor(2)` = 120, el temporizador de la etapa A sobre `ball.ownerSinceStep`) nadie ha pulsado, `releaseFromGoalkeeper` saca al compañero más libre en campo propio; la CPU no pulsa botones (siempre el automático). Lo que el spec NO fija y aquí se decide: (1) **cruceta en neutro = recto hacia campo contrario, `(attackDir, 0)`**, nunca el `facing` del portero (que es el que tenía al atajar); (2) **solo `'pressed'` dispara** (una B mantenida desde un intento de robo anterior no saca); (3) **si A y B llegan `'pressed'` en el mismo paso gana A** (mismo orden que `applyButtons`); (4) **el saque a botón no puede salir en el mismo paso en que el portero se hizo con el balón** (`stepCount <= ball.ownerSinceStep` → nada): así la atajada y la recogida por `pickUp` (que ocurre en la física, después de los botones) se comportan igual —el primer saque posible es el paso siguiente— y el evento `'gk-catch'` de ese paso no lo pisa un `'short-pass'`; (5) los saques a botón llevan los eventos `'short-pass'`/`'long-pass'` con `actorId = gk.id` (son pases; el automático sigue siendo `'gk-release'`); (6) `match.controlled[team]` sigue apuntando al jugador de campo durante la posesión del portero (lo deriva `updateControlled`, que nunca elige al portero): el motor no cambia el cursor; si la etapa C quiere dibujarlo sobre el portero, lo decide leyendo `ball.owner` (nota para la Task 8).

- [ ] **Step 1: `toAxis` en `input.ts` con su test, y quitar los `as Axis` de `step.test.ts` (CARRY #10)**

```ts
// input.ts — añadir tras isDown
// Quantizes a signed value into the d-pad axis with a dead zone: the AI, the
// step-script of step.test.ts and the recorded-match policy all need it.
export function toAxis(v: number, dead: number): Axis {
  return v > dead ? 1 : v < -dead ? -1 : 0;
}
```

```ts
// input.test.ts — añadir
import { toAxis } from './input';
describe('toAxis', () => {
  it('maps a value beyond the dead zone to ±1 and inside it to 0 (sampled off the boundary)', () => {
    expect(toAxis(7, 4)).toBe(1);
    expect(toAxis(-7, 4)).toBe(-1);
    expect(toAxis(2, 4)).toBe(0);
    expect(toAxis(-2, 4)).toBe(0);
    expect(toAxis(0, 0)).toBe(0);   // the exact boundary is 0, never ±1
  });
});
```

En `step.test.ts` sustituir `script`:

```ts
import { createTeamInput, toAxis, type TeamInput } from './input';
function script(step: number, team: 0 | 1, out: TeamInput): void {
  const phase = Math.floor(step / 45) + team * 7;
  out.dx = toAxis((phase % 3) - 1, 0);
  out.dy = toAxis((Math.floor(phase / 2) % 3) - 1, 0);
  out.c = step % 240 < 100 ? 'held' : 'up';
}
```
y en el negativo `inputs[1].dx = toAxis(-inputs[1].dx, 0)`. En `match.test.ts` la función `sign` se borra y sus dos usos pasan a `toAxis(…, 3)` / `toAxis(…, 4)` con los mismos umbrales. Quitar el import `type Axis` donde quede sin uso.

Run: `npx vitest run components/games/football-logic/input.test.ts components/games/football-logic/step.test.ts components/games/football-logic/match.test.ts` → verde, mismos valores (`toAxis(v, 0)` sobre enteros −1/0/1 es la identidad).

- [ ] **Step 2: Test que falla — el canal de movimiento `wantX/wantY/wantSprint` y `stepPlayerFree`**

```ts
// players.test.ts — añadir al final
import { GK_SPEED, stepPlayerFree } from './players';   // (fusionar con el import existente)

describe('stepPlayerFree: the AI movement channel', () => {
  it('a fresh player wants nothing and stays put', () => {
    const p = fresh()[4];
    expect([p.wantX, p.wantY, p.wantSprint]).toEqual([0, 0, false]);
    const x0 = p.x;
    for (let s = 0; s < 10; s++) stepPlayerFree(p, false, 1, PITCH, s);
    expect(p.x).toBe(x0);
  });
  it('a unit want moves at PLAYER_SPEED along it and turns the facing', () => {
    const p = fresh()[4];
    p.wantX = 0.6; p.wantY = 0.8;   // 3-4-5: a unit vector off both axes
    const x0 = p.x; const y0 = p.y;
    for (let s = 0; s < 60; s++) stepPlayerFree(p, false, 1, PITCH, s);
    expect(p.x - x0).toBeCloseTo(PLAYER_SPEED * 0.6, 6);
    expect(p.y - y0).toBeCloseTo(PLAYER_SPEED * 0.8, 6);
    expect(p.facingX).toBeCloseTo(0.6, 10);
    expect(p.facingY).toBeCloseTo(0.8, 10);
  });
  it('a want of magnitude 0.5 moves at half speed (arrive-exactly semantics), and 1.7 is capped at full speed', () => {
    const half = fresh()[4];
    half.wantX = 0.5; half.wantY = 0;
    const x0 = half.x;
    for (let s = 0; s < 60; s++) stepPlayerFree(half, false, 1, PITCH, s);
    expect(half.x - x0).toBeCloseTo(PLAYER_SPEED * 0.5, 6);
    const over = fresh()[4];
    over.wantX = 1.7; over.wantY = 0;
    const x1 = over.x;
    for (let s = 0; s < 60; s++) stepPlayerFree(over, false, 1, PITCH, s);
    expect(over.x - x1).toBeCloseTo(PLAYER_SPEED, 6);
  });
  it('the goalkeeper moves at GK_SPEED and never sprints', () => {
    const gk = fresh()[0];
    gk.wantX = 0; gk.wantY = 1; gk.wantSprint = true;
    const y0 = gk.y;
    for (let s = 0; s < 60; s++) stepPlayerFree(gk, false, 1, PITCH, s);
    expect(gk.y - y0).toBeCloseTo(GK_SPEED, 6);
    expect(isSprinting(gk)).toBe(false);
  });
  it('wantSprint sprints an outfield player at x1.4 and the want is ignored while down or mid-tackle', () => {
    const p = fresh()[4];
    p.x = 100;
    p.wantX = 1; p.wantY = 0; p.wantSprint = true;
    const x0 = p.x;
    for (let s = 0; s < 30; s++) stepPlayerFree(p, false, 1, PITCH, s);
    expect(p.x - x0).toBeCloseTo(30 * (PLAYER_SPEED / STEPS_PER_SECOND) * SPRINT_MULT, 6);
    const down = fresh()[5];
    down.wantX = 1; down.downUntilStep = 100;
    const xd = down.x;
    stepPlayerFree(down, false, 1, PITCH, 37);
    expect(down.x).toBe(xd);
    const sliding = fresh()[6];
    sliding.wantX = -1; sliding.tackleStepsLeft = 5; sliding.tackleDirX = 0; sliding.tackleDirY = 1;
    const ys = sliding.y;
    stepPlayerFree(sliding, false, 1, PITCH, 0);
    expect(sliding.y).toBeGreaterThan(ys);   // slides along tackleDir, not along the want
  });
});
```

Run: `npx vitest run components/games/football-logic/players.test.ts` → FAIL (`stepPlayerFree` no existe; `wantX` undefined).

- [ ] **Step 3: Implementar el canal en `players.ts` sin tocar la aritmética del controlado**

```ts
// players.ts — PlayerState: añadir tras tackleDirY
  // AI movement channel (stage B, Task 6a): |want| <= 1, the magnitude scales the
  // speed so a positioning target is reached exactly instead of overshot. The
  // controlled player ignores it (moved by its TeamInput through stepPlayer).
  wantX: number;
  wantY: number;
  wantSprint: boolean;
```
En `createPlayer` añadir `wantX: 0, wantY: 0, wantSprint: false,`. En `placeByFormation` añadir `p.wantX = 0; p.wantY = 0; p.wantSprint = false;` junto a `p.vx = 0`.

Sustituir el cuerpo de `stepPlayer` por un `movePlayer` compartido, manteniendo **bit a bit** el camino del controlado (mismo `diag`, factor `1`):

```ts
// (fx, fy) is the facing to apply (unit or zero); `factor` in (0, 1] scales the
// speed. stepPlayer passes exactly the stage-A values (dx*diag, dy*diag, 1) so
// the controlled path is bit-identical; stepPlayerFree passes the want channel.
function movePlayer(p: PlayerState, fx: number, fy: number, factor: number, wantSprint: boolean, hasBall: boolean, attackDir: 1 | -1, pitch: PitchDef, stepCount: number): void {
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
  const sprinting = tickSprint(p, p.role === 'gk' ? false : wantSprint);
  let speed = p.role === 'gk' ? GK_SPEED : hasBall ? PLAYER_SPEED_WITH_BALL : PLAYER_SPEED;
  if (sprinting) speed *= SPRINT_MULT;
  if (fx === 0 && fy === 0) {
    p.vx = 0;
    p.vy = 0;
  } else {
    p.facingX = fx;
    p.facingY = fy;
    p.vx = p.facingX * speed * factor;
    p.vy = p.facingY * speed * factor;
    p.x += perStep(p.vx);
    p.y += perStep(p.vy);
  }
  clampToPitch(p, attackDir, pitch);
}

export function stepPlayer(p: PlayerState, dx: Axis, dy: Axis, wantSprint: boolean, hasBall: boolean, attackDir: 1 | -1, pitch: PitchDef, stepCount: number): void {
  const diag = dx !== 0 && dy !== 0 ? INV_SQRT2 : 1;
  movePlayer(p, dx * diag, dy * diag, 1, wantSprint, hasBall, attackDir, pitch, stepCount);
}

// Moves a NON-controlled player by its want channel (written by ai.ts every step
// of open play). Zero want = stand still and keep the facing.
export function stepPlayerFree(p: PlayerState, hasBall: boolean, attackDir: 1 | -1, pitch: PitchDef, stepCount: number): void {
  const len = Math.sqrt(p.wantX * p.wantX + p.wantY * p.wantY);
  if (len === 0) {
    movePlayer(p, 0, 0, 1, p.wantSprint, hasBall, attackDir, pitch, stepCount);
    return;
  }
  movePlayer(p, p.wantX / len, p.wantY / len, len > 1 ? 1 : len, p.wantSprint, hasBall, attackDir, pitch, stepCount);
}
```

> El portero nunca era controlado ni se movía en la etapa A, así que `p.role === 'gk' ? GK_SPEED : …` no cambia ningún valor existente. El `* factor` con `factor = 1` es exacto en IEEE 754: las trazas de la etapa A se conservan.

Añadir junto a `isSprinting` la decisión de CARRY #12 (sin cambio de comportamiento):

```ts
// Deferred minor #12 (stage A): this reads false on the LAST sprinting step
// (tickSprint decrements to 0 while still applying sprint speed). The steal
// threshold in actions.ts reads it at the START of the next step, i.e. it sees the
// sprint state that was applied in the previous step: a one-step, deterministic
// lag that is the same for both teams. Left as is on purpose (stage B decision);
// the HUD of stage C may show one frame of "not sprinting" at the end of a burst.
export function isSprinting(p: PlayerState): boolean {
```

Run: `npx vitest run components/games/football-logic/players.test.ts` → PASS (los tests de la etapa A intactos, los nuevos en verde).

- [ ] **Step 4: `stepPhysics` honra el canal; reescribir la expectativa 1 y ampliar `samePlayer` (expectativa 2)**

```ts
// step.ts
import { stepPlayer, stepPlayerFree, type PlayerState } from './players';
// ...dentro del bucle de stepPhysics:
    if (p.id === controlled[p.team]) {
      const input = inputs[p.team];
      stepPlayer(p, input.dx, input.dy, isDown(input.c), hasBall, attackDir[p.team], pitch, stepCount);
    } else {
      stepPlayerFree(p, hasBall, attackDir[p.team], pitch, stepCount);
    }
```
Actualizar el comentario de cabecera: "Moves the two controlled players by their team's input and everyone else by its want channel (written by ai.ts, stage B)".

En `step.test.ts` y `match.test.ts`, `samePlayer` suma las tres líneas (el comentario de esas funciones lo exige):
```ts
    p.tackleDirX === q.tackleDirX && p.tackleDirY === q.tackleDirY &&
    p.wantX === q.wantX && p.wantY === q.wantY && p.wantSprint === q.wantSprint
```
Y en `step.test.ts` sustituir el test "non-controlled players never move under stepPhysics (the AI arrives in Task 6)" por:
```ts
  it('non-controlled players move only by their want channel: still with a zero want, at PLAYER_SPEED along a unit want', () => {
    const w = run(600);
    const start = createWorld();
    for (const p of w.players) {
      if (p.id === CONTROLLED[0] || p.id === CONTROLLED[1]) continue;
      expect([p.x, p.y]).toEqual([start.players[p.id].x, start.players[p.id].y]);
    }
    // Stage B: the same channel ai.ts writes. Player 7 is a static forward far
    // from both controlled players (see KICK_TARGET_ID), so nothing else moves it.
    const z = createWorld();
    const mover = z.players[7];
    mover.wantX = 0.6; mover.wantY = -0.8;
    const x0 = mover.x; const y0 = mover.y;
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    for (let s = 0; s < 20; s++) stepPhysics(z.players, z.ball, inputs, CONTROLLED, ATTACK, PITCH, s);
    expect(mover.x - x0).toBeCloseTo(20 * perStep(PLAYER_SPEED) * 0.6, 6);
    expect(mover.y - y0).toBeCloseTo(20 * perStep(PLAYER_SPEED) * -0.8, 6);
  });
```
(importar `PLAYER_SPEED` de `./players`.)

Run: `npx vitest run components/games/football-logic/step.test.ts components/games/football-logic/match.test.ts` → PASS.

- [ ] **Step 5: `goalKickX` en `pitch.ts` (+ convenciones de frontera, CARRY #3) y `judgeBall` la usa**

```ts
// pitch.ts — tras penaltySpotX
// The goal-kick spot: on the small-area line, centre of the goal. Its only code
// consumer is judgeBall (referee.ts): since D4 a keeper's catch keeps play alive,
// it never restarts from here.
export function goalKickX(pitch: PitchDef, side: Side): number {
  return side === 0 ? pitch.smallAreaDepth : pitch.width - pitch.smallAreaDepth;
}

// Boundary conventions (deferred minor #3, decided in stage B): isBetweenPosts is
// EXCLUSIVE (a ball exactly on a post is not a goal) while isInsideBox is CLOSED
// (a keeper exactly on the area line is still inside, which is what clampToBigArea
// produces). referee.ts and ai.ts rely on both together: a ball on the goal line
// between the posts is judged by judgeBall, never picked up or caught.
export function isBetweenPosts(...)
```
En `referee.ts`, importar `goalKickX` y sustituir `const x = side === 0 ? pitch.smallAreaDepth : pitch.width - pitch.smallAreaDepth;` por `const x = goalKickX(pitch, side);`.

```ts
// pitch.test.ts — añadir (importar goalKickX)
  it('goalKickX sits on the small-area line at both ends', () => {
    expect(goalKickX(PITCH, 0)).toBe(PITCH.smallAreaDepth);
    expect(goalKickX(PITCH, 1)).toBe(PITCH.width - PITCH.smallAreaDepth);
  });
```
Run: `npx vitest run components/games/football-logic/pitch.test.ts components/games/football-logic/referee.test.ts` → PASS (`referee.test.ts:84-86` siguen exactos).

- [ ] **Step 6: Test que falla — el portero solo recoge balón parado (S6)**

```ts
// ball.test.ts — añadir dentro de describe('pickup by proximity')
  // Stage B (S6): a moving ball reaching the keeper is decided by keeperCatch
  // (catchChance), never by the free pickup; a ball at rest is a loose ball.
  it('the keeper does not pick up a MOVING ball but does pick up one at rest (an outfield player takes both)', () => {
    const { players, ball } = world();
    const gk = players[9];
    gk.x = 1960; gk.y = 650;
    ball.x = 1970; ball.y = 650; ball.vx = -120; ball.vy = 0;   // 10 u away, rolling towards him
    stepBall(ball, players, 5, PITCH);
    expect(ball.owner).toBeNull();
    ball.vx = 0; ball.vy = 0; ball.x = 1970;
    stepBall(ball, players, 6, PITCH);
    expect(ball.owner).toBe(9);
    const { players: ps, ball: b } = world();
    ps[7].x = 1000; ps[7].y = 600;
    b.x = 1010; b.y = 600; b.vx = -120;
    stepBall(b, ps, 5, PITCH);
    expect(b.owner).toBe(7);
  });
```
Run: `npx vitest run components/games/football-logic/ball.test.ts` → FAIL (el portero recoge el balón en movimiento).

- [ ] **Step 7: `canPickUp` con la regla del portero**

```ts
// ball.ts
export function canPickUp(ball: BallState, p: PlayerState, stepCount: number): boolean {
  if (isPlayerDown(p, stepCount)) return false;
  if (p.tackleStepsLeft > 0) return false;
  if (ball.kickerId === p.id && stepCount < ball.kickLockUntilStep) return false;
  // Stage B (Task 6a): a keeper only collects a ball AT REST (a loose ball). A
  // moving ball is caught, or not, by keeperCatch in ai.ts with the profile's
  // catchChance; without this rule the 22 u free pickup made the roll moot.
  if (p.role === 'gk' && (ball.vx !== 0 || ball.vy !== 0 || ball.vz !== 0 || ball.z !== 0)) return false;
  return true;
}
```
Run: `npx vitest run components/games/football-logic/ball.test.ts components/games/football-logic/match.test.ts` → PASS (los casos C2 siguen: el balón en `width − 1` del test de la línea está parado).

- [ ] **Step 8: Tests que fallan — `chargeFraction`, `pickPassTarget`, `freestMateDir` y el `releaseFromGoalkeeper` que apunta (expectativa 5)**

```ts
// actions.test.ts — sustituir el describe('releaseFromGoalkeeper') y añadir
import { chargeFraction, freestMateDir, pickPassTarget, /* ...existentes... */ } from './actions';

describe('chargeFraction (deferred minor #13: one ramp for shotSpeed and shoot)', () => {
  it('is 0 at or below zero, linear in between, 1 at or beyond SHOT_CHARGE_STEPS', () => {
    expect(chargeFraction(-5)).toBe(0);
    expect(chargeFraction(0)).toBe(0);
    expect(chargeFraction(15)).toBeCloseTo(0.25, 10);
    expect(chargeFraction(SHOT_CHARGE_STEPS)).toBe(1);
    expect(chargeFraction(SHOT_CHARGE_STEPS + 9)).toBe(1);
  });
  it('shoot with a negative charge lobs nothing (vz 0) instead of a negative vz', () => {
    const w = world();
    const p = at(w.players[5], 1000, 600, 1, 0);
    givePossession(w.ball, p, 0);
    shoot(p, w.ball, 1, 0, -3, 0, w.out);
    expect(w.ball.vz).toBe(0);
    expect(Math.sqrt(w.ball.vx ** 2 + w.ball.vy ** 2)).toBeCloseTo(shotSpeed(0), 6);
  });
});

describe('pickPassTarget: the id aimPass locks onto (same scan, so the direction is bit-identical)', () => {
  it('returns the nearer mate in the cone for a short pass, the farther for a long one, -1 with nobody', () => {
    const w = world();
    const p = at(w.players[5], 1000, 600, 1, 0);
    at(w.players[1], p.x + 150 * 0.9848078, p.y + 150 * 0.1736482); // 10°: (0.9848078, 0.1736482)
    at(w.players[2], p.x + 80 * 0.8660254, p.y + 80 * 0.5);         // 30°: (0.8660254, 0.5)
    expect(pickPassTarget(p, w.players, 1, 0, false, 0)).toBe(2);
    expect(pickPassTarget(p, w.players, 1, 0, true, 0)).toBe(1);
    expect(pickPassTarget(p, w.players, -1, 0, false, 0)).toBe(-1);
    const aim = { x: 0, y: 0 };
    aimPass(p, w.players, 1, 0, false, 0, aim);
    const d = dist2(p, w.players[2]);
    expect(aim.x).toBe((w.players[2].x - p.x) / d);   // exact: aimPass now derives the direction from the picked id
    expect(aim.y).toBe((w.players[2].y - p.y) / d);
  });
});

describe('freestMateDir: the outfield mate in OWN half farthest from every rival', () => {
  it('picks the mate with the largest nearest-rival distance among those in the keeper\'s half', () => {
    const w = world();
    const gk = at(w.players[0], 25, 650, 1, 0);   // team 0 defends side 0: own half is x < 1000
    const crowded = at(w.players[1], 400, 400);
    at(w.players[10], 430, 400);                   // rival 30 u from the crowded mate
    const free = at(w.players[2], 500, 900);
    at(w.players[11], 750, 900);                   // nearest rival 250 u away
    // Anti-coincidence (pre-flight H6): world() parks mates 4-8 at (260..420, 1290), in OWN half,
    // and mate 4 has the parked rival keeper 9 at (460, 1290) EXACTLY 200 u away. With the rival
    // at 200 u the "free" mate would win only by lowest id; at 250 u it wins by margin.
    expect(dist2(w.players[4], w.players[9])).toBe(200);
    at(w.players[3], 1300, 650);                   // freest of all but in the rival half: ignored
    const out = { x: 0, y: 0 };
    expect(freestMateDir(gk, w.players, 1, PITCH, out)).toBe(true);
    const d = dist2(gk, free);
    expect(out.x).toBeCloseTo((free.x - gk.x) / d, 10);
    expect(out.y).toBeCloseTo((free.y - gk.y) / d, 10);
    expect(dist2(gk, crowded)).toBeLessThan(d);    // not the nearest: the freest
  });
  it('returns false and leaves out untouched when every outfield mate is in the rival half', () => {
    const w = world();
    const gk = at(w.players[0], 25, 650, 1, 0);
    for (let i = 1; i <= 8; i++) at(w.players[i], 1200 + i * 10, 650);
    const out = { x: 7, y: 7 };
    expect(freestMateDir(gk, w.players, 1, PITCH, out)).toBe(false);
    expect(out).toEqual({ x: 7, y: 7 });
  });
});

describe('releaseFromGoalkeeper', () => {
  it('kicks a long pass at the freest own-half mate once GK_HOLD_STEPS have passed, and not before', () => {
    const w = world();
    const gk = at(w.players[9], 1975, 650, -1, 0);   // team 1 defends side 1: own half is x > 1000
    const target = at(w.players[12], 1500, 300);
    at(w.players[13], 1500, 1000);
    at(w.players[4], 1470, 1000);                     // rival crowds mate 13, so 12 is the freest
    givePossession(w.ball, gk, 100);
    releaseFromGoalkeeper(gk, w.ball, w.players, -1, PITCH, 100 + GK_HOLD_STEPS - 7, w.aim, w.out);
    expect(w.ball.owner).toBe(9);
    expect(w.out.kind).toBe('none');
    releaseFromGoalkeeper(gk, w.ball, w.players, -1, PITCH, 100 + GK_HOLD_STEPS, w.aim, w.out);
    expect(w.ball.owner).toBeNull();
    const d = dist2(gk, target);
    expect(w.ball.vx).toBeCloseTo(LONG_PASS_SPEED * (target.x - gk.x) / d, 6);
    expect(w.ball.vy).toBeCloseTo(LONG_PASS_SPEED * (target.y - gk.y) / d, 6);
    expect(w.ball.vz).toBe(LONG_PASS_VZ);
    expect(w.out.kind).toBe('gk-release');
    expect(GK_HOLD_STEPS).toBe(120);
  });
  it('falls back to a straight kick along attackDir when no mate is in its half', () => {
    const w = world();
    const gk = at(w.players[9], 1975, 650, -1, 0);
    for (let i = 10; i <= 17; i++) at(w.players[i], 300 + i, 650);
    givePossession(w.ball, gk, 0);
    releaseFromGoalkeeper(gk, w.ball, w.players, -1, PITCH, GK_HOLD_STEPS, w.aim, w.out);
    expect(w.ball.vx).toBeCloseTo(-LONG_PASS_SPEED, 6);
    expect(w.ball.vy).toBe(0);
  });
  it('does nothing for an outfield player or a keeper without the ball', () => {
    const w = world();
    const p = at(w.players[4], 500, 500);
    givePossession(w.ball, p, 0);
    releaseFromGoalkeeper(p, w.ball, w.players, 1, PITCH, 500, w.aim, w.out);
    expect(w.ball.owner).toBe(4);
    releaseFromGoalkeeper(w.players[0], w.ball, w.players, 1, PITCH, 500, w.aim, w.out);
    expect(w.ball.owner).toBe(4);
  });
  it('leaves `out` alone on its no-op paths (D4: the throw applyKeeperButtons wrote in the same slot this step survives)', () => {
    const w = world();
    const gk = at(w.players[9], 1975, 650, -1, 0);
    givePossession(w.ball, gk, 100);
    w.out.kind = 'short-pass'; w.out.ok = true; w.out.actorId = 9;
    releaseFromGoalkeeper(gk, w.ball, w.players, -1, PITCH, 100 + GK_HOLD_STEPS - 7, w.aim, w.out);   // holding: no-op
    expect(w.out.kind).toBe('short-pass');
    shortPass(gk, w.ball, -1, 0, 100 + GK_HOLD_STEPS, w.out);                                         // the ball left by button
    releaseFromGoalkeeper(gk, w.ball, w.players, -1, PITCH, 100 + GK_HOLD_STEPS, w.aim, w.out);       // not the owner: no-op
    expect(w.out.kind).toBe('short-pass');
    expect(w.ball.owner).toBeNull();
  });
});
```
(`at`, `world`, `dist2` son los helpers que ya existen en `actions.test.ts` —`at(p, x, y, fx = 1, fy = 0)`, `world()` aparca a los 18 en la banda inferior con `facing (1, 0)`—; `dist2(a, b)` **ya existe** en `actions.test.ts:441` (declaración `function`, hoisted, justo tras el `describe` de `aimPass`): se reutiliza tal cual y **no se vuelve a declarar** — sería TS2393 *Duplicate function implementation*, que vitest/esbuild tolera pero `npx tsc --noEmit` no, y el compilador es puerta de este plan (pre-vuelo H2).)

Run: `npx vitest run components/games/football-logic/actions.test.ts` → FAIL (símbolos nuevos y aridad de `releaseFromGoalkeeper`).

- [ ] **Step 9: Implementar en `actions.ts`**

```ts
// ActionKind: añadir 'gk-catch'
export type ActionKind = 'none' | 'shot' | 'short-pass' | 'long-pass' | 'steal' | 'tackle' | 'gk-release' | 'gk-catch';

// Deferred minor #13: one ramp, with the <= 0 guard, shared by shotSpeed and shoot.
export function chargeFraction(chargeSteps: number): number {
  return chargeSteps >= SHOT_CHARGE_STEPS ? 1 : chargeSteps <= 0 ? 0 : chargeSteps / SHOT_CHARGE_STEPS;
}
export function shotSpeed(chargeSteps: number): number {
  return SHOT_SPEED_MIN + (SHOT_SPEED_MAX - SHOT_SPEED_MIN) * chargeFraction(chargeSteps);
}
export function shoot(p: PlayerState, ball: BallState, dirX: number, dirY: number, chargeSteps: number, stepCount: number, out: ActionEvent): void {
  kickBall(ball, p, dirX, dirY, shotSpeed(chargeSteps), SHOT_VZ_MAX * chargeFraction(chargeSteps), stepCount);
  setEvent(out, 'shot', true, p.id);
}

// The scan aimPass used to do inline, returning the mate's id instead of its
// direction so the AI (Task 6b) can judge the lane to the SAME mate the engine
// will lock onto. -1 when nobody is inside the cone. (dirX, dirY) must be a unit vector.
export function pickPassTarget(p: PlayerState, players: readonly PlayerState[], dirX: number, dirY: number, farthest: boolean, stepCount: number): number {
  let bestId = -1;
  let bestDist = farthest ? -1 : Infinity;
  for (let i = 0; i < players.length; i++) {
    const mate = players[i];
    if (mate.id === p.id || mate.team !== p.team || mate.role === 'gk') continue;
    if (isPlayerDown(mate, stepCount)) continue;
    const d = dist(p.x, p.y, mate.x, mate.y);
    if (d === 0) continue;
    const ux = (mate.x - p.x) / d;
    const uy = (mate.y - p.y) / d;
    if (ux * dirX + uy * dirY < INV_SQRT2) continue;
    const better = farthest ? d > bestDist : d < bestDist;
    if (!better) continue;
    bestId = mate.id;
    bestDist = d;
  }
  return bestId;
}

export function aimPass(p: PlayerState, players: readonly PlayerState[], dirX: number, dirY: number, farthest: boolean, stepCount: number, out: Vec2): boolean {
  const id = pickPassTarget(p, players, dirX, dirY, farthest, stepCount);
  if (id === -1) {
    out.x = dirX;
    out.y = dirY;
    return false;
  }
  const mate = players[id];
  const d = dist(p.x, p.y, mate.x, mate.y);   // same formula as the scan: identical quotient, identical bits
  out.x = (mate.x - p.x) / d;
  out.y = (mate.y - p.y) / d;
  return true;
}

// Spec goalkeeper rule 4: the freest outfield mate in the keeper's own half —
// the one whose nearest rival is farthest away; ties by lowest id (strict `>`
// over ascending ids). Writes the unit direction into `out`; false = nobody.
export function freestMateDir(gk: PlayerState, players: readonly PlayerState[], attackDir: 1 | -1, pitch: PitchDef, out: Vec2): boolean {
  const halfX = pitch.width / 2;
  let bestId = -1;
  let bestFree = -1;
  for (let i = 0; i < players.length; i++) {
    const mate = players[i];
    if (mate.team !== gk.team || mate.role === 'gk') continue;
    const inOwnHalf = attackDir === 1 ? mate.x < halfX : mate.x > halfX;
    if (!inOwnHalf) continue;
    let nearestRival = Infinity;
    for (let j = 0; j < players.length; j++) {
      const q = players[j];
      if (q.team === gk.team) continue;
      const d = dist(mate.x, mate.y, q.x, q.y);
      if (d < nearestRival) nearestRival = d;
    }
    if (nearestRival > bestFree) {
      bestFree = nearestRival;
      bestId = mate.id;
    }
  }
  if (bestId === -1) return false;
  const mate = players[bestId];
  return normalizeInto(out, mate.x - gk.x, mate.y - gk.y);
}

// Spec goalkeeper rule 4 (D4), the AUTOMATIC release: once GK_HOLD_STEPS have
// passed since the keeper took the ball (caught or picked up, one path through
// givePossession/ownerSinceStep) and nobody released it by button, a long pass at
// the freest own-half mate, else straight along attackDir. Exact: no error, no rng.
// `aim` is the caller's scratch Vec2 (no module state, no allocation), exactly as
// applyButtons receives it; match.ts passes scratch.aim. Unlike applyButtons it
// does NOT clear `out` on its no-op paths: stepOpenPlay wipes every slot at the top
// of the step and applyKeeperButtons may already have written this same slot.
export function releaseFromGoalkeeper(gk: PlayerState, ball: BallState, players: readonly PlayerState[], attackDir: 1 | -1, pitch: PitchDef, stepCount: number, aim: Vec2, out: ActionEvent): void {
  if (gk.role !== 'gk' || ball.owner !== gk.id) return;
  if (stepCount - ball.ownerSinceStep < GK_HOLD_STEPS) return;
  if (!freestMateDir(gk, players, attackDir, pitch, aim)) {
    aim.x = attackDir;
    aim.y = 0;
  }
  gk.facingX = aim.x;
  gk.facingY = aim.y;
  kickBall(ball, gk, aim.x, aim.y, LONG_PASS_SPEED, LONG_PASS_VZ, stepCount);
  setEvent(out, 'gk-release', true, gk.id);
}
```
(`actions.ts` importa `PitchDef` como tipo de `./pitch`.) **Firma definitiva**, la misma del bloque Produces: `releaseFromGoalkeeper(gk, ball, players, attackDir, pitch, stepCount, aim, out)`. Actualizar el comentario de cabecera de `clearActionEvent` (hoy dice "applyButtons/releaseFromGoalkeeper still reset their own slot in place before deciding"): desde D4 solo `applyButtons` lo hace; `releaseFromGoalkeeper` y `applyKeeperButtons` confían en el barrido de `stepOpenPlay`.

Run: `npx vitest run components/games/football-logic/actions.test.ts components/games/football-logic/set-pieces.test.ts` → PASS (los tests de `aimPass` de la etapa A siguen exactos: el cociente es el mismo).

- [ ] **Step 10: Test que falla — `applyKeeperButtons` (D4: B saque con la mano, A pase largo, cruceta apunta, exacto)**

```ts
// actions.test.ts — añadir (importar applyKeeperButtons de './actions')
describe('applyKeeperButtons (D4): the keeper holding the ball throws by button, exact, from the step after taking it', () => {
  // Team 1 keeper (id 9) on its line, attacking -x. Its eight outfield mates are
  // parked BEHIND it near the goal line at x = 1990, y = 100..170, so from the
  // keeper they lie almost straight up (+15, -480..-550): outside the -x cone,
  // the +y cone and the +x cone every test below opens. Only the mates each test
  // places with `at` are candidates. The keeper faces +y on purpose: a neutral
  // d-pad must open the cone along attackDir, never along the facing (S-GK.1).
  function holding(): World & { gk: PlayerState; input: TeamInput } {
    const w = world();
    for (let i = 10; i <= 17; i++) at(w.players[i], 1990, 100 + (i - 10) * 10);
    const gk = at(w.players[9], 1975, 650, 0, 1);
    givePossession(w.ball, gk, 100);
    return { ...w, gk, input: createTeamInput() };
  }
  function unitTo(from: PlayerState, to: PlayerState): { x: number; y: number } {
    const d = dist2(from, to);
    return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
  }
  it('B pressed with the d-pad on -x throws a SHORT pass at the nearest mate in the cone and turns the keeper to face it', () => {
    const s = holding();
    const near = at(s.players[12], 1775, 700);        // 206 u away, 14° off -x: in the cone
    at(s.players[13], 1475, 550);                     // 510 u away, 11° off -x: in the cone, farther
    s.input.dx = -1; s.input.b = 'pressed';
    applyKeeperButtons(s.gk, s.input, s.ball, s.players, -1, 101, s.aim, s.out);
    const u = unitTo(s.gk, near);
    expect(s.ball.owner).toBeNull();
    expect(s.ball.kickerId).toBe(9);
    expect(speedOf(s.ball)).toBeCloseTo(SHORT_PASS_SPEED, 6);
    expect(s.ball.vz).toBe(0);
    expect(s.ball.vx / speedOf(s.ball)).toBeCloseTo(u.x, 10);
    expect(s.ball.vy / speedOf(s.ball)).toBeCloseTo(u.y, 10);
    expect([s.gk.facingX, s.gk.facingY]).toEqual([u.x, u.y]);
    expect(s.out).toMatchObject({ kind: 'short-pass', ok: true, foul: false, actorId: 9 });
  });
  it('A pressed throws a LONG pass at the farthest mate in the same cone', () => {
    const s = holding();
    at(s.players[12], 1775, 700);
    const far = at(s.players[13], 1475, 550);
    s.input.dx = -1; s.input.a = 'pressed';
    applyKeeperButtons(s.gk, s.input, s.ball, s.players, -1, 101, s.aim, s.out);
    const u = unitTo(s.gk, far);
    expect(s.ball.owner).toBeNull();
    expect(speedOf(s.ball)).toBeCloseTo(LONG_PASS_SPEED, 6);
    expect(s.ball.vz).toBe(LONG_PASS_VZ);
    expect(s.ball.vx / speedOf(s.ball)).toBeCloseTo(u.x, 10);
    expect(s.ball.vy / speedOf(s.ball)).toBeCloseTo(u.y, 10);
    expect(s.out).toMatchObject({ kind: 'long-pass', ok: true, actorId: 9 });
  });
  it('a neutral d-pad opens the cone along attackDir (towards the rival half), not along the keeper\'s facing; the d-pad on +y opens it there', () => {
    const neutral = holding();
    const ahead = at(neutral.players[12], 1775, 700);   // in the -x cone only
    at(neutral.players[14], 1975, 850);                 // 200 u straight down (+y): in the +y cone only
    neutral.input.b = 'pressed';                        // dx = dy = 0
    applyKeeperButtons(neutral.gk, neutral.input, neutral.ball, neutral.players, -1, 101, neutral.aim, neutral.out);
    const u = unitTo(neutral.gk, ahead);
    expect(neutral.ball.vx / speedOf(neutral.ball)).toBeCloseTo(u.x, 10);
    expect(neutral.ball.vy / speedOf(neutral.ball)).toBeCloseTo(u.y, 10);
    const down = holding();
    at(down.players[12], 1775, 700);
    const below = at(down.players[14], 1975, 850);
    down.input.dy = 1; down.input.b = 'pressed';
    applyKeeperButtons(down.gk, down.input, down.ball, down.players, -1, 101, down.aim, down.out);
    const v = unitTo(down.gk, below);
    expect(down.ball.vx / speedOf(down.ball)).toBeCloseTo(v.x, 10);
    expect(down.ball.vy / speedOf(down.ball)).toBeCloseTo(v.y, 10);
  });
  it('with nobody in the cone the throw goes straight along the aim (d-pad on +x: no mate that way)', () => {
    const s = holding();
    s.input.dx = 1; s.input.b = 'pressed';
    applyKeeperButtons(s.gk, s.input, s.ball, s.players, -1, 101, s.aim, s.out);
    expect(s.ball.vx).toBeCloseTo(SHORT_PASS_SPEED, 6);
    expect(s.ball.vy).toBe(0);
    expect(s.out.kind).toBe('short-pass');
  });
  it('only a press fires: a held B (a steal attempt carried over) throws nothing; A and B pressed together → A wins', () => {
    const held = holding();
    at(held.players[12], 1775, 700);
    held.input.dx = -1; held.input.b = 'held';
    applyKeeperButtons(held.gk, held.input, held.ball, held.players, -1, 101, held.aim, held.out);
    expect(held.ball.owner).toBe(9);
    expect(held.out.kind).toBe('none');
    const both = holding();
    at(both.players[12], 1775, 700);
    both.input.dx = -1; both.input.a = 'pressed'; both.input.b = 'pressed';
    applyKeeperButtons(both.gk, both.input, both.ball, both.players, -1, 101, both.aim, both.out);
    expect(both.out.kind).toBe('long-pass');
  });
  it('never on the step the keeper took the ball (S-GK.4), never for an outfield player, never for a keeper without the ball; no rng anywhere', () => {
    const same = holding();                           // ownerSinceStep = 100
    at(same.players[12], 1775, 700);
    same.input.dx = -1; same.input.b = 'pressed';
    applyKeeperButtons(same.gk, same.input, same.ball, same.players, -1, 100, same.aim, same.out);
    expect(same.ball.owner).toBe(9);
    expect(same.out.kind).toBe('none');
    applyKeeperButtons(same.gk, same.input, same.ball, same.players, -1, 101, same.aim, same.out);
    expect(same.ball.owner).toBeNull();
    const w = world();
    const p = at(w.players[4], 500, 500);
    givePossession(w.ball, p, 0);
    const input = createTeamInput(); input.b = 'pressed';
    applyKeeperButtons(p, input, w.ball, w.players, 1, 5, w.aim, w.out);
    expect(w.ball.owner).toBe(4);
    applyKeeperButtons(w.players[0], input, w.ball, w.players, 1, 5, w.aim, w.out);
    expect(w.ball.owner).toBe(4);
    expect(w.out.kind).toBe('none');
    // The signature has no rng: a throw can never move the deterministic draw count.
  });
});
```
(`createTeamInput` y `type TeamInput` ya se importan en `actions.test.ts`.) Regla anti-coincidencia: los compañeros de prueba están a 206/510 u y a 14°/11° del eje (nunca en el borde de 45°), el `facing` del portero apunta a +y para que "neutro = `attackDir`" no pase por casualidad, y los aparcados quedan a > 85° de todos los conos usados.

Run: `npx vitest run components/games/football-logic/actions.test.ts` → FAIL (`applyKeeperButtons` no existe).

- [ ] **Step 11: Implementar `applyKeeperButtons` en `actions.ts`**

```ts
// actions.ts — añadir tras releaseFromGoalkeeper

// D4 (spec goalkeeper rule 4): while the keeper holds the ball its team's TeamInput
// comes HERE instead of applyButtons (stepOpenPlay routes it). The d-pad aims; in
// neutral the cone opens straight towards the rival half, (attackDir, 0), never
// along the keeper's facing (S-GK.1). B 'pressed' = hand throw = assisted short
// pass (nearest outfield mate in the 45° cone, aimPass, ruling R10); A 'pressed' =
// assisted long pass (farthest mate in the cone); nobody in the cone = straight.
// A throw is a set piece in spirit: exact, no rng, no angular error. Only 'pressed'
// fires (S-GK.2), A wins a double press (S-GK.3), and nothing fires on the very step
// the keeper took the ball (S-GK.4), so a catch (before the buttons) and a pickUp
// (after them, in the physics) both release from the next step on. Like
// releaseFromGoalkeeper it never clears `out`: stepOpenPlay wipes the slot.
export function applyKeeperButtons(gk: PlayerState, input: TeamInput, ball: BallState, players: readonly PlayerState[], attackDir: 1 | -1, stepCount: number, aim: Vec2, out: ActionEvent): void {
  if (gk.role !== 'gk' || ball.owner !== gk.id) return;
  if (stepCount <= ball.ownerSinceStep) return;
  const longOne = input.a === 'pressed';
  if (!longOne && input.b !== 'pressed') return;
  if (!normalizeInto(aim, input.dx, input.dy)) {
    aim.x = attackDir;
    aim.y = 0;
  }
  aimPass(gk, players, aim.x, aim.y, longOne, stepCount, aim);
  gk.facingX = aim.x;
  gk.facingY = aim.y;
  if (longOne) longPass(gk, ball, aim.x, aim.y, stepCount, out);
  else shortPass(gk, ball, aim.x, aim.y, stepCount, out);
}
```
Sin asignación: `aim` y `out` son del llamador; `normalizeInto` sobre la cruceta da el vector unitario que `aimPass` exige. `TeamInput` ya está importado en `actions.ts`.

Run: `npx vitest run components/games/football-logic/actions.test.ts` → PASS.

- [ ] **Step 12: Tests que fallan — `profileFor`, `humanProfile`, `quantizeDir`, `laneBlocked`, `applyKickError` (nuevo `ai.test.ts`, parte 1)**

```ts
// components/games/football-logic/ai.test.ts
import { describe, expect, it } from 'vitest';
import { PITCH, centerY, goalLineX, isInsideSmallArea } from './pitch';
import { FORMATIONS, TEAMS, type Formation, type TeamDef } from './teams';
import { dist } from './geometry';
import { createTeamInput, type Axis, type TeamInput } from './input';
import { stepsFor, perStep } from './step';
import { GK_CATCH_RADIUS, GK_LINE_DIST, GK_SPEED, PLAYER_SPEED, createPlayers, type PlayerState } from './players';
import { KICK_LOCK_STEPS, createBall, givePossession, type BallState } from './ball';
import { createRng, type Rng } from './rng';
import { createActionEvent, SHOT_SPEED_MAX, SHOT_SPEED_MIN, type ActionEvent } from './actions';
import { checkGoalkeepersInBox } from './invariants';
import {
  CHARGED_SHOT_CATCH_PENALTY, CHASERS, COVER_DIST, DRIFT_LONG, DRIFT_SHORT, SEPARATION_DIST,
  applyKickError, humanProfile, keeperCatch, keeperStep, laneBlocked, positionTeam, profileFor, quantizeDir,
  type AiProfile,
} from './ai';

const F = FORMATIONS[0];
const CY = centerY(PITCH);
const ESP = TEAMS[0];

function fixedRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

// Places a player and makes it active (a parked player of `scenario` below is on the floor).
function at(p: PlayerState, x: number, y: number, fx = p.facingX, fy = p.facingY): PlayerState {
  p.x = x; p.y = y; p.facingX = fx; p.facingY = fy;
  p.wantX = 0; p.wantY = 0; p.wantSprint = false;
  p.downUntilStep = 0;
  return p;
}

function freeBall(ball: BallState, x: number, y: number, vx = 0, vy = 0): void {
  ball.owner = null; ball.x = x; ball.y = y; ball.z = 0; ball.vx = vx; ball.vy = vy; ball.vz = 0;
  ball.kickerId = -1; ball.kickLockUntilStep = 0;
}

describe('profileFor: the spec formulas, in steps, clamped (levels 1 and 8 exact)', () => {
  it('level 1 and level 8 are the values of the spec table', () => {
    const easy = profileFor(ESP, 1);
    const hard = profileFor(ESP, 8);
    expect(easy.reactionSteps).toBe(stepsFor(0.595));   // 36
    expect(hard.reactionSteps).toBe(stepsFor(0.210));   // 13
    expect(easy.passErrorDeg).toBe(16);
    expect(hard.passErrorDeg).toBe(2);
    expect(easy.shotErrorDeg).toBe(12.5);
    expect(hard.shotErrorDeg).toBe(2);
    expect(easy.catchChance).toBeCloseTo(0.55, 10);
    expect(hard.catchChance).toBeCloseTo(0.90, 10);
    expect(easy.penaltyReadChance).toBeCloseTo(0.5125, 10);
    expect(hard.penaltyReadChance).toBeCloseTo(0.60, 10);
    expect(easy.tackleChance).toBeCloseTo(0.49, 10);
    expect(hard.tackleChance).toBeCloseTo(0.77, 10);
  });
  it('a harder level reacts sooner and is more accurate everywhere (1 vs 8, not neighbours)', () => {
    const easy = profileFor(ESP, 1);
    const hard = profileFor(ESP, 8);
    expect(hard.reactionSteps).toBeLessThan(easy.reactionSteps);
    expect(hard.passErrorDeg).toBeLessThan(easy.passErrorDeg);
    expect(hard.shotErrorDeg).toBeLessThan(easy.shotErrorDeg);
    expect(hard.catchChance).toBeGreaterThan(easy.catchChance);
    expect(hard.penaltyReadChance).toBeGreaterThan(easy.penaltyReadChance);
    expect(hard.tackleChance).toBeGreaterThan(easy.tackleChance);
  });
  it('difficulties beyond 1..8 saturate at the level-1 / level-8 values (S1)', () => {
    expect(profileFor(ESP, -40)).toEqual(profileFor(ESP, 1));
    expect(profileFor(ESP, 99)).toEqual(profileFor(ESP, 8));
  });
  it('the team is received but does not change the profile in v1 (identical selections)', () => {
    expect(profileFor(TEAMS[0], 5)).toEqual(profileFor(TEAMS[1], 5));
  });
  it('humanProfile is the same keeper and penalty with ZERO kick error (ruling R10)', () => {
    const h = humanProfile(ESP, 5);
    const c = profileFor(ESP, 5);
    expect(h.passErrorDeg).toBe(0);
    expect(h.shotErrorDeg).toBe(0);
    expect(h.catchChance).toBe(c.catchChance);
    expect(h.penaltyReadChance).toBe(c.penaltyReadChance);
    expect(h.reactionSteps).toBe(c.reactionSteps);
  });
});

describe('quantizeDir: the nearest of the eight d-pad directions', () => {
  const out: { dx: Axis; dy: Axis } = { dx: 0, dy: 0 };
  it('snaps on-axis, diagonal and off-boundary vectors; the zero vector stays (0,0)', () => {
    quantizeDir(10, 0, out); expect(out).toEqual({ dx: 1, dy: 0 });
    quantizeDir(0, -3, out); expect(out).toEqual({ dx: 0, dy: -1 });
    quantizeDir(-5, 5, out); expect(out).toEqual({ dx: -1, dy: 1 });
    quantizeDir(100, 30, out); expect(out).toEqual({ dx: 1, dy: 0 });     // 16.7°: below the 22.5° sector edge
    quantizeDir(100, 60, out); expect(out).toEqual({ dx: 1, dy: 1 });     // 31°: above it
    quantizeDir(-30, -100, out); expect(out).toEqual({ dx: 0, dy: -1 });  // 16.7° off the -y axis
    quantizeDir(0, 0, out); expect(out).toEqual({ dx: 0, dy: 0 });
  });
});

describe('laneBlocked: a rival inside the corridor blocks, outside or beyond its length does not', () => {
  it('judges perpendicular distance and projection, ignoring downed rivals and own team', () => {
    const ps = createPlayers([F, F], PITCH);
    for (const p of ps) at(p, 50 + p.id * 10, 1250);
    // The lane is team 0's (attacking +x from (1000, 650)): the second argument is MY team, so
    // the obstacles are the players of team 1 (ids 9-17). Pre-flight H1: never pass the rival's team.
    at(ps[10], 1100, 640);          // 100 u along the lane, 10 u off it: blocks a radius of 60
    expect(laneBlocked(ps, 0, 1000, 650, 1, 0, 200, 60, 0)).toBe(true);
    at(ps[10], 1100, 731);          // 81 u off the lane: outside a radius of 60
    expect(laneBlocked(ps, 0, 1000, 650, 1, 0, 200, 60, 0)).toBe(false);
    at(ps[10], 1237, 650);          // on the lane but 237 u along it: beyond a length of 200
    expect(laneBlocked(ps, 0, 1000, 650, 1, 0, 200, 60, 0)).toBe(false);
    at(ps[10], 1100, 640); ps[10].downUntilStep = 50;
    expect(laneBlocked(ps, 0, 1000, 650, 1, 0, 200, 60, 20)).toBe(false);   // on the floor: not an obstacle
    at(ps[10], 150, 1250);          // rival 10 back on the touchline (and up again: at() clears downUntilStep)
    at(ps[3], 1100, 640);           // a TEAMMATE of team 0 on the lane is not a rival of team 0
    expect(laneBlocked(ps, 0, 1000, 650, 1, 0, 200, 60, 100)).toBe(false);
    at(ps[10], 930, 650);           // behind the start: negative projection
    expect(laneBlocked(ps, 0, 1000, 650, 1, 0, 200, 60, 100)).toBe(false);
  });
});

describe('applyKickError: one rng draw, centred on zero, smaller at level 8 than at level 1', () => {
  function deviationCos(errorDeg: number, draw: number): number {
    const ball = createBall();
    ball.vx = 700; ball.vy = 0;
    let calls = 0;
    applyKickError(ball, errorDeg, () => { calls++; return draw; });
    expect(calls).toBe(1);
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    expect(speed).toBeCloseTo(700, 6);     // the error rotates, it never changes the speed
    return ball.vx / speed;
  }
  it('a draw of 0.5 leaves the direction untouched, 0.9 turns one way and 0.1 the other', () => {
    expect(deviationCos(12.5, 0.5)).toBeCloseTo(1, 12);
    const ball = createBall(); ball.vx = 700; ball.vy = 0;
    applyKickError(ball, 12.5, fixedRng([0.9]));
    expect(ball.vy).toBeGreaterThan(0);
    const other = createBall(); other.vx = 700; other.vy = 0;
    applyKickError(other, 12.5, fixedRng([0.1]));
    expect(other.vy).toBeLessThan(0);
    expect(other.vy).toBeCloseTo(-ball.vy, 6);
  });
  it('for the same draw the hard profile deviates less than the easy one, and zero error does nothing but draw', () => {
    const easy = deviationCos(profileFor(ESP, 1).shotErrorDeg, 0.9);
    const hard = deviationCos(profileFor(ESP, 8).shotErrorDeg, 0.9);
    expect(hard).toBeGreaterThan(easy);             // closer to 1 = closer to the intended direction
    expect(deviationCos(0, 0.9)).toBe(1);
  });
  it('the full-scale deviation of 12.5° is about 12.5° (skew approximates rotation within 0.3°, S2)', () => {
    const c = deviationCos(12.5, 1);                // draw 1 → +12.5° (rng in [0,1) never reaches 1; fixed here on purpose)
    expect(c).toBeGreaterThan(0.9744);              // cos 13°   = 0.9744
    expect(c).toBeLessThan(0.9781);                 // cos 12°   = 0.9781
  });
});
```
(La lista de imports de arriba es la de todo el fichero al final de las Tasks 6a/6b; recortar lo que aún no se use si `tsc` protesta por `noUnusedLocals`.)

Run: `npx vitest run components/games/football-logic/ai.test.ts` → FAIL (`./ai` no existe).

- [ ] **Step 13: `ai.ts` — perfil, cuantización, carril y error angular**

```ts
// components/games/football-logic/ai.ts
import { dist, normalizeInto, type Vec2 } from './geometry';
import { centerY, goalLineX, isInsideSmallArea, type PitchDef } from './pitch';
import type { Formation, Strategy, TeamDef } from './teams';
import type { Axis } from './input';
import { perStep, stepsFor } from './step';
import {
  GK_CATCH_RADIUS, GK_LINE_DIST, GK_SPEED, PLAYER_HEIGHT, PLAYER_SPEED, anchorFor, isPlayerDown, ownGoalSide,
  type PlayerState,
} from './players';
import { givePossession, type BallState } from './ball';
import { SHOT_SPEED_MAX, SHOT_SPEED_MIN, type ActionEvent } from './actions';
import type { Rng } from './rng';

// ── Spec "Reglas de la IA": every number named, none buried ──────────────────
export const SHOT_RANGE = 420;
export const SHOT_TAP_DIST = 150;
export const SHOT_LANE_LENGTH = 200;
export const SHOT_LANE_RADIUS = 60;
export const PRESSURE_DIST = 90;
export const PASS_LANE_RADIUS = 50;
export const LONG_PASS_MIN_DIST = 350;
export const SPRINT_FREE_DIST = 150;
export const DRIFT_LONG = 0.3;
export const DRIFT_SHORT = 0.2;
export const SEPARATION_DIST = 60;
export const COVER_DIST = 120;
export const CHASERS: Readonly<Record<Strategy, number>> = { attack: 3, neutral: 2, defend: 1 };
export const CHARGED_SHOT_CATCH_PENALTY = 0.15;

// Profile formulas (spec table "Perfil por dificultad (1-8)").
const REACTION_MS_BASE = 650;
const REACTION_MS_PER_LEVEL = 55;
const PASS_ERROR_BASE = 18;
const PASS_ERROR_PER_LEVEL = 2;
const SHOT_ERROR_BASE = 14;
const SHOT_ERROR_PER_LEVEL = 1.5;
const CATCH_BASE = 0.5;
const CATCH_PER_LEVEL = 0.05;
const PENALTY_READ_BASE = 0.5;
const PENALTY_READ_PER_LEVEL = 0.0125;
const TACKLE_BASE = 0.45;
const TACKLE_PER_LEVEL = 0.04;
// Stage B assumption S1, not in the spec — review in QA: the clamp bounds are the
// level-1 and level-8 values of each formula (the spec asks for bounds, gives none).
const REACTION_MS_MIN = 210;
const REACTION_MS_MAX = 595;
const PASS_ERROR_MIN = 2;
const PASS_ERROR_MAX = 16;
const SHOT_ERROR_MIN = 2;
const SHOT_ERROR_MAX = 12.5;
const CATCH_MIN = 0.55;
const CATCH_MAX = 0.9;
const PENALTY_READ_MIN = 0.5125;
const PENALTY_READ_MAX = 0.6;
const TACKLE_MIN = 0.49;
const TACKLE_MAX = 0.77;
// Stage B assumption S2: a small-angle skew (x' = x - e*y, y' = y + e*x, then
// normalise) stands in for a rotation; at 16° it is within 0.3° of the exact one
// and uses no trigonometry (ruling R12). e = degrees * DEG_TO_SKEW.
const DEG_TO_SKEW = Math.PI / 180;
// tan(22.5°) = sqrt(2) - 1: the edge between an axis sector and a diagonal sector.
const TAN_22_5 = Math.SQRT2 - 1;

export type AiProfile = {
  reactionSteps: number;
  passErrorDeg: number;
  shotErrorDeg: number;
  catchChance: number;
  penaltyReadChance: number;
  tackleChance: number;
};

function clampNum(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// Pure formulas over the difficulty, as profileFor(def, difficulty) in Vault
// Fighter. `def` is received from day one (spec) and unused in v1: v1.5 attributes
// per selection plug in here. Difficulty never touches speed (criterion 14).
export function profileFor(def: TeamDef, difficulty: number): AiProfile {
  void def;
  const reactionMs = clampNum(REACTION_MS_BASE - difficulty * REACTION_MS_PER_LEVEL, REACTION_MS_MIN, REACTION_MS_MAX);
  return {
    reactionSteps: stepsFor(reactionMs / 1000),
    passErrorDeg: clampNum(PASS_ERROR_BASE - difficulty * PASS_ERROR_PER_LEVEL, PASS_ERROR_MIN, PASS_ERROR_MAX),
    shotErrorDeg: clampNum(SHOT_ERROR_BASE - difficulty * SHOT_ERROR_PER_LEVEL, SHOT_ERROR_MIN, SHOT_ERROR_MAX),
    catchChance: clampNum(CATCH_BASE + difficulty * CATCH_PER_LEVEL, CATCH_MIN, CATCH_MAX),
    penaltyReadChance: clampNum(PENALTY_READ_BASE + difficulty * PENALTY_READ_PER_LEVEL, PENALTY_READ_MIN, PENALTY_READ_MAX),
    tackleChance: clampNum(TACKLE_BASE + difficulty * TACKLE_PER_LEVEL, TACKLE_MIN, TACKLE_MAX),
  };
}

// The human team's profile (ruling R10: no angular error on human kicks). The
// keeper and the penalty read use the same difficulty as the CPU: the ONLY
// difference is the zero kick error. // confirmed by owner 2026-09-05 (D3, S9)
export function humanProfile(def: TeamDef, difficulty: number): AiProfile {
  const p = profileFor(def, difficulty);
  p.passErrorDeg = 0;
  p.shotErrorDeg = 0;
  return p;
}

// Nearest of the eight d-pad directions, by sector: |y| < |x|·tan22.5 → axis x,
// |x| < |y|·tan22.5 → axis y, else diagonal. Allocates nothing.
export function quantizeDir(x: number, y: number, out: { dx: Axis; dy: Axis }): void {
  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;
  if (ax === 0 && ay === 0) {
    out.dx = 0;
    out.dy = 0;
    return;
  }
  const sx: Axis = x > 0 ? 1 : x < 0 ? -1 : 0;
  const sy: Axis = y > 0 ? 1 : y < 0 ? -1 : 0;
  if (ay < ax * TAN_22_5) {
    out.dx = sx;
    out.dy = 0;
  } else if (ax < ay * TAN_22_5) {
    out.dx = 0;
    out.dy = sy;
  } else {
    out.dx = sx;
    out.dy = sy;
  }
}

// True when a rival of `team` (not on the floor) lies within `radius` of the
// segment from (fromX, fromY) along the unit (dirX, dirY) for `length` units.
// `team` is the lane's owner (MY team): its own players are never obstacles.
export function laneBlocked(players: readonly PlayerState[], team: 0 | 1, fromX: number, fromY: number, dirX: number, dirY: number, length: number, radius: number, stepCount: number): boolean {
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.team === team || isPlayerDown(q, stepCount)) continue;
    const rx = q.x - fromX;
    const ry = q.y - fromY;
    const along = rx * dirX + ry * dirY;
    if (along < 0 || along > length) continue;
    const across = rx * dirY - ry * dirX;
    if ((across < 0 ? -across : across) < radius) return true;
  }
  return false;
}

// Spec: "the angular error is applied to the pass/shot vector with rng() centred
// on zero". One draw per call, error 0 included, so the draw count per kick is
// the same for both teams whatever their profile.
export function applyKickError(ball: BallState, errorDeg: number, rng: Rng): void {
  const e = (rng() * 2 - 1) * errorDeg * DEG_TO_SKEW;
  const vx = ball.vx;
  const vy = ball.vy;
  const nx = vx - e * vy;
  const ny = vy + e * vx;
  const before = vx * vx + vy * vy;
  const after = nx * nx + ny * ny;
  if (after === 0) return;
  const k = Math.sqrt(before / after);
  ball.vx = nx * k;
  ball.vy = ny * k;
}
```
Run: `npx vitest run components/games/football-logic/ai.test.ts` → los cuatro `describe` de arriba PASS (los de colocación y portero aún no existen).

- [ ] **Step 14: Tests que fallan — colocación viva (`positionTeam`) y portero (`keeperStep`, `keeperCatch`)**

```ts
// ai.test.ts — añadir
type World = { players: PlayerState[]; ball: BallState; scratch: { x: number; y: number } };
function world(): World {
  const players = createPlayers([F, F], PITCH);
  return { players, ball: createBall(), scratch: { x: 0, y: 0 } };
}
// Runs positionTeam for team 0 (attacking +x) and returns the want of player `id`.
function wantOf(w: World, id: number, strategy: Strategy = 'neutral', controlled = -1): { x: number; y: number } {
  positionTeam(w.players, w.ball, 0, F, strategy, 1, controlled, PITCH, 0, w.scratch);
  return { x: w.players[id].wantX, y: w.players[id].wantY };
}
// The target a want points at, assuming full speed (|want| = 1) or an exact arrival (|want| < 1).
function targetOf(p: PlayerState): { x: number; y: number } {
  const step = perStep(PLAYER_SPEED);
  return { x: p.x + p.wantX * step, y: p.y + p.wantY * step };
}

describe('positionTeam: anchor + drift + separation + bounded pursuit (spec "Los compañeros sin balón")', () => {
  it('with possession, a mate far from its anchor wants to go there, shifted by the strategy (criterion 11 lives here)', () => {
    const w = world();
    givePossession(w.ball, w.players[5], 0);                 // team 0 has the ball; ball near (918, 650)
    at(w.players[1], 100, 100);                              // slot 0 anchor: (440, 325) neutral
    const want = wantOf(w, 1, 'neutral', 5);
    expect(Math.sqrt(want.x * want.x + want.y * want.y)).toBeCloseTo(1, 10);   // far away: full speed
    expect(want.x).toBeGreaterThan(0);
    expect(want.y).toBeGreaterThan(0);
    // attack shifts the anchor +240 u in x: the want turns flatter (more x per y)
    const atk = wantOf(w, 1, 'attack', 5);
    expect(atk.x / atk.y).toBeGreaterThan(want.x / want.y);
  });
  it('the anchor drifts 30 % of the way to the ball in x and 20 % in y', () => {
    const w = world();
    givePossession(w.ball, w.players[5], 0);
    w.players[5].x = 1400; w.players[5].y = 1000; w.players[5].facingX = 1; w.players[5].facingY = 0;
    w.ball.x = 1418; w.ball.y = 1000;                        // stickToOwner geometry, written explicitly
    // Isolate player 1: put every other outfield mate far away so separation adds nothing.
    for (let i = 2; i <= 8; i++) at(w.players[i], 1900, 50 + i * 20);
    const expectedX = 440 + DRIFT_LONG * (1418 - 440);     // 733.4
    const expectedY = 325 + DRIFT_SHORT * (1000 - 325);    // 460
    const p = at(w.players[1], 732, 459);                    // 1.7 u short of the drift target: one step arrives
    wantOf(w, 1, 'neutral', 5);
    const t = targetOf(p);
    // |want| < 1 here means "arrive this step": the want encodes the exact target.
    expect(Math.sqrt(p.wantX ** 2 + p.wantY ** 2)).toBeLessThan(1);
    expect(t.x).toBeCloseTo(expectedX, 6);
    expect(t.y).toBeCloseTo(expectedY, 6);
    expect(DRIFT_LONG).toBe(0.3);
    expect(DRIFT_SHORT).toBe(0.2);
  });
  it('two mates 41 u apart repel each other by (SEPARATION_DIST - d) along the line between them; 75 u apart they do not', () => {
    const w = world();
    givePossession(w.ball, w.players[5], 0);
    w.players[5].x = 1400; w.players[5].y = 1000; w.players[5].facingX = 1; w.players[5].facingY = 0;
    w.ball.x = 1418; w.ball.y = 1000;
    for (let i = 3; i <= 8; i++) at(w.players[i], 1900, 50 + i * 20);   // far away: no separation from them
    const a = at(w.players[1], 700, 500);
    const b = at(w.players[2], 741, 500);                    // 41 u to the right of a
    wantOf(w, 1, 'neutral', 5);
    // Anchor + drift, computed here from the rule: slots 0 and 1 share x = 0.22 (440 u).
    const tx = 440 + DRIFT_LONG * (1418 - 440);
    const tyA = 325 + DRIFT_SHORT * (1000 - 325);
    const tyB = 650 + DRIFT_SHORT * (1000 - 650);
    const push = SEPARATION_DIST - 41;                       // 19 u each, a to the left, b to the right
    const unit = (p: PlayerState, x: number, y: number) => { const d = dist(p.x, p.y, x, y); return { x: (x - p.x) / d, y: (y - p.y) / d }; };
    const ea = unit(a, tx - push, tyA);
    const eb = unit(b, tx + push, tyB);
    expect(a.wantX).toBeCloseTo(ea.x, 6); expect(a.wantY).toBeCloseTo(ea.y, 6);
    expect(b.wantX).toBeCloseTo(eb.x, 6); expect(b.wantY).toBeCloseTo(eb.y, 6);
    at(w.players[2], 775, 500);                              // 75 u apart: no push at all
    wantOf(w, 1, 'neutral', 5);
    const fa = unit(a, tx, tyA);
    expect(a.wantX).toBeCloseTo(fa.x, 6); expect(a.wantY).toBeCloseTo(fa.y, 6);
    expect(SEPARATION_DIST).toBe(60);
  });
  it('without possession, CHASERS[strategy] mates chase the ball (the nearest being the controlled), the next covers at COVER_DIST, the rest anchor', () => {
    const w = world();
    freeBall(w.ball, 1300, 650);
    // Distances to the ball, ascending: 1 (50 u, the controlled), 2 (80), 3 (134), 4 (255); the rest > 900.
    // Every pair is more than SEPARATION_DIST apart, so no push distorts the directions asserted below.
    at(w.players[1], 1300, 700); at(w.players[2], 1220, 650); at(w.players[3], 1180, 590); at(w.players[4], 1050, 700);
    for (let i = 5; i <= 8; i++) at(w.players[i], 300, 100 + i * 100);
    const expectWant = (p: PlayerState, ux: number, uy: number) => {
      expect(p.wantX).toBeCloseTo(ux, 3);
      expect(p.wantY).toBeCloseTo(uy, 3);
    };
    // neutral: 2 chase (1 = controlled, 2), 3 covers, 4 anchors
    positionTeam(w.players, w.ball, 0, F, 'neutral', 1, 1, PITCH, 0, w.scratch);
    expectWant(w.players[2], 1, 0);                          // straight at the ball
    expectWant(w.players[3], 0, 1);                          // cover spot (1300 - COVER_DIST, 650) = (1180, 650): straight down
    expectWant(w.players[4], -0.0963, -0.9954);              // slot 3 anchor (900, 325) + drift = (1020, 390)
    // attack: 3 chase, 4 covers
    positionTeam(w.players, w.ball, 0, F, 'attack', 1, 1, PITCH, 0, w.scratch);
    expectWant(w.players[3], 0.8944, 0.4472);                // at the ball from (1180, 590)
    expectWant(w.players[4], 0.9333, -0.359);                // cover spot from (1050, 700)
    // defend: only the controlled chases, 2 covers, 3 anchors
    positionTeam(w.players, w.ball, 0, F, 'defend', 1, 1, PITCH, 0, w.scratch);
    expectWant(w.players[2], -1, 0);                         // cover spot from (1220, 650)
    expectWant(w.players[3], -0.833, 0.553);                 // slot 2 anchor (440, 975) + drift = (698, 910), from (1180, 590)
    expect(COVER_DIST).toBe(120);
    expect(CHASERS).toEqual({ attack: 3, neutral: 2, defend: 1 });
  });
  it('never writes the keeper, never writes the other team, never sets wantSprint', () => {
    const w = world();
    freeBall(w.ball, 1000, 650);
    w.players[0].wantX = 0.5; w.players[10].wantX = -0.5;
    positionTeam(w.players, w.ball, 0, F, 'neutral', 1, 1, PITCH, 0, w.scratch);
    expect(w.players[0].wantX).toBe(0.5);
    expect(w.players[10].wantX).toBe(-0.5);
    for (let i = 1; i <= 8; i++) expect(w.players[i].wantSprint).toBe(false);
  });
});

describe('keeperStep: on its line closing the angle, out only inside the small area, back when a mate has it', () => {
  const LINE_X = goalLineX(PITCH, 0) + GK_LINE_DIST;   // team 0 keeper (id 0), attacking +x, defends side 0
  it('a ball owned by a rival far up the pitch: the keeper stays on its line at the intersection ball→goal centre', () => {
    const w = world();
    givePossession(w.ball, w.players[12], 0);
    w.players[12].x = 600; w.players[12].y = 300; w.players[12].facingX = -1; w.players[12].facingY = 0;
    w.ball.x = 582; w.ball.y = 300;
    const gk = at(w.players[0], LINE_X, CY);
    keeperStep(gk, w.players, w.ball, 1, PITCH, 0);
    // Intersection of (582, 300)→(0, 650) with x = 25: t = (25 - 582)/(0 - 582), y = 300 + t*(650 - 300)
    const t = (LINE_X - 582) / (0 - 582);
    const targetY = 300 + t * (CY - 300);
    const dy = (targetY - CY) / perStep(GK_SPEED);           // -15 u / 3.67 u per step: capped at -1
    expect(gk.wantX).toBe(0);
    expect(gk.wantY).toBeCloseTo(dy < -1 ? -1 : dy, 6);
    expect(targetY).toBeLessThan(CY);                        // towards the ball's side of the goal
  });
  it('a loose ball in the small area with no mate closer: the keeper goes for it', () => {
    const w = world();
    freeBall(w.ball, 60, 700);                               // inside side-0 small area (x <= 105, |y - 650| <= 175)
    expect(isInsideSmallArea(PITCH, 0, 60, 700)).toBe(true);
    for (let i = 1; i <= 8; i++) at(w.players[i], 900, 100 + i * 100);
    const gk = at(w.players[0], LINE_X, CY);
    keeperStep(gk, w.players, w.ball, 1, PITCH, 0);
    const len = Math.sqrt(gk.wantX ** 2 + gk.wantY ** 2);
    expect(gk.wantX / len).toBeCloseTo((60 - LINE_X) / dist(LINE_X, CY, 60, 700), 6);
    expect(gk.wantY / len).toBeCloseTo((700 - CY) / dist(LINE_X, CY, 60, 700), 6);
  });
  it('the same loose ball just OUTSIDE the small area (x = 122): the keeper stays on its line', () => {
    const w = world();
    freeBall(w.ball, 122, 700);
    expect(isInsideSmallArea(PITCH, 0, 122, 700)).toBe(false);
    for (let i = 1; i <= 8; i++) at(w.players[i], 900, 100 + i * 100);
    const gk = at(w.players[0], LINE_X, CY);
    keeperStep(gk, w.players, w.ball, 1, PITCH, 0);
    expect(gk.wantX).toBe(0);                                // never leaves the line for it
    expect(gk.wantY).toBeGreaterThan(0);                     // only slides along the line towards it
  });
  it('a loose ball in the small area with a mate closer: the keeper leaves it and holds the line', () => {
    const w = world();
    freeBall(w.ball, 60, 700);
    at(w.players[3], 75, 720);                               // 25 u from the ball; the keeper is ~63 u away
    const gk = at(w.players[0], LINE_X, CY);
    keeperStep(gk, w.players, w.ball, 1, PITCH, 0);
    expect(gk.wantX).toBe(0);
  });
  it('a keeper off its line (pushed by a set piece) with a mate on the ball goes back to the line, and stands still holding the ball (D4: the d-pad aims its throw, it never moves it)', () => {
    const w = world();
    givePossession(w.ball, w.players[4], 0);
    const gk = at(w.players[0], 200, 800);
    keeperStep(gk, w.players, w.ball, 1, PITCH, 0);
    expect(gk.wantX).toBeLessThan(0);                        // back towards x = 25
    givePossession(w.ball, gk, 0);
    keeperStep(gk, w.players, w.ball, 1, PITCH, 0);
    expect([gk.wantX, gk.wantY]).toEqual([0, 0]);
  });
  it('the line target is clamped to the small-area width (a ball near the corner does not drag the keeper to the touchline)', () => {
    const w = world();
    freeBall(w.ball, 60, 5);                                 // x inside the small-area depth, y far outside its width
    expect(isInsideSmallArea(PITCH, 0, 60, 5)).toBe(false);  // not a loose ball the keeper may go for
    // intersection: t = (25 - 60)/(0 - 60) = 0.583 → y = 5 + 0.583 * 645 = 381 < 475 = CY - 175: clamped to 475
    for (let i = 1; i <= 8; i++) at(w.players[i], 900, 100 + i * 100);
    const gk = at(w.players[0], LINE_X, CY - PITCH.smallAreaWidth / 2);   // already at the clamp
    keeperStep(gk, w.players, w.ball, 1, PITCH, 0);
    expect([gk.wantX, gk.wantY]).toEqual([0, 0]);
  });
});

describe('keeperCatch: one roll per approach, penalised by shot charge, never on a ball already out', () => {
  function approach(vx: number, gkX = 1975): { w: World; gk: PlayerState; out: ActionEvent; rolled: [boolean, boolean] } {
    const w = world();
    const gk = at(w.players[9], gkX, CY);                    // team 1 keeper on its line, side 1
    freeBall(w.ball, gkX - 31, CY, vx, 0);                   // 31 u away, inside GK_CATCH_RADIUS (40), off the boundary
    return { w, gk, out: createActionEvent(), rolled: [false, false] };
  }
  it('catches when rng() < catchChance: possession, event gk-catch, returns true, and marks the roll', () => {
    const { w, gk, out, rolled } = approach(700);
    expect(keeperCatch(gk, w.ball, 0.9, rolled, fixedRng([0.7]), PITCH, 0, out)).toBe(true);
    expect(w.ball.owner).toBe(9);
    expect(out.kind).toBe('gk-catch');
    expect(rolled[1]).toBe(true);
  });
  it('misses when rng() >= catchChance and does not roll again while the ball stays inside the radius', () => {
    const { w, gk, out, rolled } = approach(300);
    let calls = 0;
    const rng = () => { calls++; return 0.7; };
    expect(keeperCatch(gk, w.ball, 0.55, rolled, rng, PITCH, 0, out)).toBe(false);
    expect(calls).toBe(1);
    expect(w.ball.owner).toBeNull();
    w.ball.x -= 4;                                           // still inside 40 u
    expect(keeperCatch(gk, w.ball, 0.55, rolled, rng, PITCH, 1, out)).toBe(false);
    expect(calls).toBe(1);
    w.ball.x = gk.x - 47;                                    // leaves the radius: the flag resets
    expect(keeperCatch(gk, w.ball, 0.55, rolled, rng, PITCH, 2, out)).toBe(false);
    expect(rolled[1]).toBe(false);
    expect(calls).toBe(1);
  });
  it('the same draw catches for the level-8 keeper and misses for the level-1 one (accuracy grows with difficulty)', () => {
    const hard = approach(700);
    expect(keeperCatch(hard.gk, hard.w.ball, profileFor(ESP, 8).catchChance, hard.rolled, fixedRng([0.7]), PITCH, 0, hard.out)).toBe(true);
    const easy = approach(700);
    expect(keeperCatch(easy.gk, easy.w.ball, profileFor(ESP, 1).catchChance, easy.rolled, fixedRng([0.7]), PITCH, 0, easy.out)).toBe(false);
  });
  it('a fully charged shot (SHOT_SPEED_MAX) subtracts CHARGED_SHOT_CATCH_PENALTY; a pass subtracts nothing', () => {
    const charged = approach(-SHOT_SPEED_MAX);
    // catchChance 0.9 - 0.15 = 0.75: a draw of 0.8 misses the charged shot...
    expect(keeperCatch(charged.gk, charged.w.ball, 0.9, charged.rolled, fixedRng([0.8]), PITCH, 0, charged.out)).toBe(false);
    const pass = approach(-560);
    // ...and catches the pass with the same draw.
    expect(keeperCatch(pass.gk, pass.w.ball, 0.9, pass.rolled, fixedRng([0.8]), PITCH, 0, pass.out)).toBe(true);
    const half = approach(-(SHOT_SPEED_MIN + SHOT_SPEED_MAX) / 2);   // half charge: penalty 0.075 → 0.825
    expect(keeperCatch(half.gk, half.w.ball, 0.9, half.rolled, fixedRng([0.8]), PITCH, 0, half.out)).toBe(true);
    expect(CHARGED_SHOT_CATCH_PENALTY).toBe(0.15);
  });
  it('never rolls for its own kick inside the kick lock (D4: the throw must leave, not bounce back into the gloves)', () => {
    const { w, gk, out, rolled } = approach(-700);
    w.ball.x = gk.x - 9;                                     // one step after a throw: 9 u out, well inside the radius
    w.ball.kickerId = 9; w.ball.kickLockUntilStep = KICK_LOCK_STEPS;   // what kickBall wrote at step 0 (15 steps)
    let calls = 0;
    const rng = () => { calls++; return 0.1; };
    expect(keeperCatch(gk, w.ball, 0.9, rolled, rng, PITCH, 3, out)).toBe(false);
    expect(calls).toBe(0);
    expect(w.ball.owner).toBeNull();
    expect(rolled[1]).toBe(false);                           // the lock refused, not a used-up approach
    // Lock over (KICK_LOCK_STEPS < KICK_LOCK_STEPS is false): a normal approach again, one roll, caught.
    expect(keeperCatch(gk, w.ball, 0.9, rolled, rng, PITCH, KICK_LOCK_STEPS, out)).toBe(true);
    expect(calls).toBe(1);
  });
  it('never rolls for an owned ball, a resting ball, a high ball, or a ball already over a line', () => {
    let calls = 0;
    const rng = () => { calls++; return 0; };
    const owned = approach(700);
    givePossession(owned.w.ball, owned.w.players[4], 0);
    expect(keeperCatch(owned.gk, owned.w.ball, 0.9, owned.rolled, rng, PITCH, 0, owned.out)).toBe(false);
    const resting = approach(0);
    expect(keeperCatch(resting.gk, resting.w.ball, 0.9, resting.rolled, rng, PITCH, 0, resting.out)).toBe(false);
    const high = approach(700);
    high.w.ball.z = PLAYER_HEIGHT + 8;
    expect(keeperCatch(high.gk, high.w.ball, 0.9, high.rolled, rng, PITCH, 0, high.out)).toBe(false);
    const out = approach(700, PITCH.width);
    out.w.ball.x = PITCH.width + 5;                          // over the goal line: the referee's, not the keeper's
    expect(keeperCatch(out.gk, out.w.ball, 0.9, out.rolled, rng, PITCH, 0, out.out)).toBe(false);
    expect(calls).toBe(0);
  });
});
```
(importar `PLAYER_HEIGHT` de `./players` y `Strategy` de `./teams`.)

Run: `npx vitest run components/games/football-logic/ai.test.ts` → FAIL (`positionTeam`, `keeperStep`, `keeperCatch` no existen).

- [ ] **Step 15: `ai.ts` — colocación viva y portero**

```ts
// ai.ts — añadir

// want = (target - p) / stepDist, capped to a unit vector: full speed when far,
// exact arrival when within one step (no overshoot, no jitter). No allocation.
function steerTo(p: PlayerState, targetX: number, targetY: number, unitsPerSecond: number): void {
  const stepDist = perStep(unitsPerSecond);
  const dx = (targetX - p.x) / stepDist;
  const dy = (targetY - p.y) / stepDist;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= 1) {
    p.wantX = dx;
    p.wantY = dy;
  } else {
    p.wantX = dx / len;
    p.wantY = dy / len;
  }
}

function teamHasBall(players: readonly PlayerState[], ball: BallState, team: 0 | 1): boolean {
  return ball.owner !== null && players[ball.owner].team === team;
}

// Rank of `p` among its team's outfield players by distance to the ball:
// the number of eligible mates strictly nearer, or equally near with a lower id.
function chaseRank(p: PlayerState, players: readonly PlayerState[], ball: BallState, stepCount: number): number {
  const mine = dist(p.x, p.y, ball.x, ball.y);
  let rank = 0;
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.team !== p.team || q.role === 'gk' || q.id === p.id || isPlayerDown(q, stepCount)) continue;
    const d = dist(q.x, q.y, ball.x, ball.y);
    if (d < mine || (d === mine && q.id < p.id)) rank++;
  }
  return rank;
}

// Spec "Los compañeros sin balón" 1-4, applied to every outfield player of `team`
// except the controlled one (moved by its TeamInput; -1 = nobody is, D4: while the
// keeper holds the ball the field player is placed here too). Runs inside stepMatch
// for BOTH teams (final-review recommendation 2), so the replay stays seed + inputs.
// Pursuit without possession: the CHASERS[strategy] nearest chase the ball (rank 0
// is the controlled), the next covers, the rest anchor. // confirmed by owner 2026-09-05 (D1, S3)
// `scratch` is the caller's Vec2 for anchorFor.
export function positionTeam(players: PlayerState[], ball: BallState, team: 0 | 1, formation: Formation, strategy: Strategy, attackDir: 1 | -1, controlled: number, pitch: PitchDef, stepCount: number, scratch: Vec2): void {
  const inPossession = teamHasBall(players, ball, team);
  const chasers = CHASERS[strategy];
  const ownGoalX = goalLineX(pitch, ownGoalSide(attackDir));
  const cy = centerY(pitch);
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.team !== team || p.role === 'gk') continue;
    p.wantSprint = false;
    if (p.id === controlled) continue;
    let targetX: number;
    let targetY: number;
    const rank = inPossession ? Infinity : chaseRank(p, players, ball, stepCount);
    if (rank < chasers) {
      // 4. pursuit: the CHASERS nearest run at the ball (rank 0 is the controlled and never gets here)
      targetX = ball.x;
      targetY = ball.y;
    } else if (rank === chasers) {
      // 4. the next one covers COVER_DIST from the ball towards own goal
      if (!normalizeInto(scratch, ownGoalX - ball.x, cy - ball.y)) {
        scratch.x = -attackDir;
        scratch.y = 0;
      }
      targetX = ball.x + scratch.x * COVER_DIST;
      targetY = ball.y + scratch.y * COVER_DIST;
    } else {
      // 1. anchor shifted by the strategy; 2. drift 30 % / 20 % towards the ball
      anchorFor(formation.slots[p.slot], strategy, attackDir, pitch, scratch);
      targetX = scratch.x + DRIFT_LONG * (ball.x - scratch.x);
      targetY = scratch.y + DRIFT_SHORT * (ball.y - scratch.y);
    }
    // 3. separation: mates closer than SEPARATION_DIST push the target away
    for (let j = 0; j < players.length; j++) {
      const q = players[j];
      if (q.team !== team || q.role === 'gk' || q.id === p.id) continue;
      const d = dist(p.x, p.y, q.x, q.y);
      if (d >= SEPARATION_DIST) continue;
      if (d === 0) {
        // Stage B assumption S4: coincident mates split along ±y by id parity
        targetY += (p.id < q.id ? -1 : 1) * SEPARATION_DIST;
        continue;
      }
      const push = SEPARATION_DIST - d;
      targetX += ((p.x - q.x) / d) * push;
      targetY += ((p.y - q.y) / d) * push;
    }
    steerTo(p, targetX, targetY, PLAYER_SPEED);
  }
}

// Spec "El portero" 1 and 4 (movement only; the catch is keeperCatch, the
// release is releaseFromGoalkeeper). Writes gk.want*; never gk.x/y directly.
export function keeperStep(gk: PlayerState, players: readonly PlayerState[], ball: BallState, attackDir: 1 | -1, pitch: PitchDef, stepCount: number): void {
  gk.wantSprint = false;
  if (ball.owner === gk.id) {
    gk.wantX = 0;
    gk.wantY = 0;
    return;
  }
  const side = ownGoalSide(attackDir);
  const goalX = goalLineX(pitch, side);
  const lineX = goalX + attackDir * GK_LINE_DIST;
  const cy = centerY(pitch);
  // 1b. out ONLY inside the small area, for a loose ball nobody of ours is closer to
  if (ball.owner === null && isInsideSmallArea(pitch, side, ball.x, ball.y)) {
    const mine = dist(gk.x, gk.y, ball.x, ball.y);
    let mateCloser = false;
    for (let i = 0; i < players.length && !mateCloser; i++) {
      const q = players[i];
      if (q.team !== gk.team || q.id === gk.id || isPlayerDown(q, stepCount)) continue;
      if (dist(q.x, q.y, ball.x, ball.y) < mine) mateCloser = true;
    }
    if (!mateCloser) {
      steerTo(gk, ball.x, ball.y, GK_SPEED);
      return;
    }
  }
  // 1a. on the line, at the point where the ball→goal-centre line crosses it
  // (assumption S5: parameter clamped to [0, 1], y clamped to the small-area width)
  const denom = goalX - ball.x;
  let t = denom === 0 ? 1 : (lineX - ball.x) / denom;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  let targetY = ball.y + t * (cy - ball.y);
  const half = pitch.smallAreaWidth / 2;
  if (targetY < cy - half) targetY = cy - half;
  if (targetY > cy + half) targetY = cy + half;
  steerTo(gk, lineX, targetY, GK_SPEED);
}

// Spec "El portero" 2 (D4): a moving ball inside GK_CATCH_RADIUS is caught with
// rng() < catchChance - penalty, ONE roll per approach (rolled[team] is reset when
// the ball leaves the radius or gets an owner). A catch is POSSESSION, nothing
// else: givePossession, the same path pickUp takes for a ball at rest, so the
// 2 s hold (ownerSinceStep + GK_HOLD_STEPS), the button release and the automatic
// one are one mechanism; play stays alive, no phase changes. The penalty grows
// linearly with the ball speed from SHOT_SPEED_MIN (0) to SHOT_SPEED_MAX
// (CHARGED_SHOT_CATCH_PENALTY), so passes are never penalised (assumption S7). A
// ball over a line is the referee's (same strict comparisons as pickUp, ruling
// R17); a high ball is not catchable (assumption S10, same rule as the pickup).
// Never its own throw: inside the kick lock the released ball is still within the
// radius (7-9 u per step) and `rolled` was reset while it was held, so without the
// guard the keeper would roll for -- and mostly catch -- its own release, forever
// (pre-flight H4). KICK_LOCK_STEPS (15) carry it 105-140 u out, past the radius.
export function keeperCatch(gk: PlayerState, ball: BallState, catchChance: number, rolled: [boolean, boolean], rng: Rng, pitch: PitchDef, stepCount: number, out: ActionEvent): boolean {
  const moving = ball.vx !== 0 || ball.vy !== 0 || ball.vz !== 0 || ball.z !== 0;
  const inside = ball.x >= 0 && ball.x <= pitch.width && ball.y >= 0 && ball.y <= pitch.height;
  const near = inside && dist(gk.x, gk.y, ball.x, ball.y) < GK_CATCH_RADIUS;
  if (ball.owner !== null || !near) {
    rolled[gk.team] = false;
    return false;
  }
  if (ball.kickerId === gk.id && stepCount < ball.kickLockUntilStep) return false;   // own throw, still locked: no roll, `rolled` stays false
  if (!moving || ball.z > PLAYER_HEIGHT || isPlayerDown(gk, stepCount)) return false;
  if (rolled[gk.team]) return false;
  rolled[gk.team] = true;
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  let charge = (speed - SHOT_SPEED_MIN) / (SHOT_SPEED_MAX - SHOT_SPEED_MIN);
  if (charge < 0) charge = 0;
  if (charge > 1) charge = 1;
  if (rng() >= catchChance - CHARGED_SHOT_CATCH_PENALTY * charge) return false;
  givePossession(ball, gk, stepCount);
  out.kind = 'gk-catch';
  out.ok = true;
  out.foul = false;
  out.actorId = gk.id;
  out.victimId = -1;
  out.x = ball.x;
  out.y = ball.y;
  return true;
}
```
Run: `npx vitest run components/games/football-logic/ai.test.ts` → PASS. Si el test "two mates 41 u apart" no cuadra en el factor `1.99`, **medir** la separación real que sale de la fórmula S4 (cada uno empujado 19 u) y ajustar solo el fixture, nunca la regla.

- [ ] **Step 16: Tests que fallan en `match.test.ts` — perfiles en `createMatch` (expectativas 3-4), atajada → posesión del portero y saque a botón/automático (D4, tests a-b-c-e), criterio 11 "responde en el acto" (R19)**

Cambios mecánicos primero:
```ts
// match.test.ts — cabecera
import { profileFor, type AiProfile } from './ai';   // humanProfile has its consumer in ai.test.ts, not here
const PROFILES: readonly [AiProfile, AiProfile] = [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)];
function fresh(): MatchState {
  return createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES);
}
```
`createMatch(TEAM_PAIR, three, PITCH)` en el test de "stores the formation…" pasa a `createMatch(TEAM_PAIR, three, PITCH, PROFILES)`. En el test de `createMatch`, `expect(m.gkPenaltyRead).toEqual(...)` → `expect(m.profiles).toBe(PROFILES); expect(m.catchRolled).toEqual([false, false]);` y quitar `DEFAULT_PENALTY_READ_CHANCE` del import. En `sameMatch`, sustituir la línea de `gkPenaltyRead` por `if (a.catchRolled[0] !== b.catchRolled[0] || a.catchRolled[1] !== b.catchRolled[1]) return false;`.

**Expectativas 8 y 9 de la lista de caducidad (pre-vuelo H3) — tres tests de la etapa A cuya premisa muere con `keeperCatch`; cambia el fixture, nunca la aserción** (`fixedRng` es la declaración `function` del bloque siguiente: hoisted, usable desde C2-C aunque se defina más abajo):
```ts
// match.test.ts:482-491 — C2-C: sustituir `stepMatch(m, IDLE, createRng(1));` y sus dos expects por
    // Stage B (D4, keeper rule 2): a moving ball inside GK_CATCH_RADIUS makes keeperCatch roll
    // BEFORE the physics. A draw of 0.99 misses at every level (catchChance <= 0.90), so the
    // shot flies on and the referee still sees it cross the line. The roll is asserted, not
    // hidden: the keeper tried and failed, and the goal stands (expectation 8).
    const rng = fixedRng([0.99]);
    stepMatch(m, IDLE, rng);
    expect(m.phase).toBe('goal');
    expect(m.score).toEqual([1, 0]);
    expect(rng.calls).toBe(1);
```
```ts
// match.test.ts:356-374 — "a penalty draws from the rng only on the step it executes, and never again":
// tras `stepMatch(m, IDLE, rng); expect(m.phase).not.toBe('set-piece');` añadir
    // Stage B (D4): keeperCatch is the one other draw the engine makes, and it WOULD fire here --
    // a misread penalty flies at the keeper's line and keeperStep slides him into
    // GK_CATCH_RADIUS in ~11 steps. Keeper on the floor: keeperCatch refuses a downed keeper, so
    // the only draw that could appear is a set piece re-firing -- exactly what this test pins
    // (expectation 9).
    m.players[9].downUntilStep = m.stepCount + 60;
// y reescribir el comentario "Idle inputs never press B, so nothing else in the engine can draw" como
    // Idle inputs never press B and a downed keeper never catches, so nothing else in the
    // engine can draw: any growth here would be stepSetPiece firing a second time.
```
```ts
// match.test.ts:397-437 — C1: tras `for (let i = 0; i < SET_PIECE_COUNTDOWN_STEPS; i++) stepMatch(m, IDLE, rng);`
// y su `expect(m.phase).not.toBe('set-piece');` añadir
    // Stage B (D4): same penalty, same ~11-step slide into GK_CATCH_RADIUS, and a catch would
    // hold the ball 2 s and throw it long -- a throw that can end in touch inside the 400-step
    // window and set `secondCall` for a reason that is not C1. Keeper on the floor: keeperCatch
    // refuses a downed keeper, so the ball goes in as it did in stage A and the only set piece
    // that could appear is the re-judged foul this test pins (expectation 9).
    m.players[9].downUntilStep = m.stepCount + 60;
```
Ninguno de los tres relaja una expectativa: la atajada nueva es comportamiento del spec (regla 2 del portero, D4), la Global Constraint manda investigar y la investigación está hecha (pre-vuelo H3: `createRng(1)` = 0,627 / 0,0027 / 0,527 contra `catchChance` 0,75 y `penaltyReadChance` 0,5625 del nivel 5). Lo que cambia es la fuente de tirada que la etapa B añade, no lo que cada test afirma (`phase 'goal'`, `rng.calls === afterExecution`, `secondCall === -1` siguen tal cual). Si con estos cambios alguno de los tres sigue rojo: **BLOCKED con la medición**.

Tests nuevos (helpers primero; `countingRng`, `sameMatch` **y `freeBall(m, x, y, vx, vy)`** ya existen en el fichero: `freeBall` es la del fix C2, `match.test.ts:444` —`kickerId = -1`, `lastTouchTeam 0`/`lastTouchId 5`, sin lock— y vale tal cual para `caught()` porque la atajada no lee `lastTouch`; **no se redeclara**, sería TS2393 *Duplicate function implementation* (pre-vuelo H2). El único helper nuevo es `fixedRng`):
```ts
// D4 helper: a fixed rng that counts its draws (freeBall is the C2 one, higher up in this file).
function fixedRng(values: number[]): CountingRng {
  let i = 0;
  const fn: CountingRng = Object.assign(function next(): number {
    fn.calls++;
    return values[i++ % values.length];
  }, { calls: 0 });
  return fn;
}
// Team 1's keeper (id 9) on its line; a 700 u/s shot 31 u short of it (inside GK_CATCH_RADIUS,
// off the boundary) is caught on the first step with a draw of 0 (any profile catches). Idle
// input: nobody presses anything. The catch step is stepCount 0, so ownerSinceStep === 0.
function caught(): { m: MatchState; keeper: PlayerState } {
  const m = fresh();
  resumePlay(m);
  const keeper = m.players[9];
  keeper.x = PITCH.width - GK_LINE_DIST; keeper.y = CY;
  freeBall(m, keeper.x - 31, CY, 700, 0);
  stepMatch(m, IDLE, fixedRng([0]));
  return { m, keeper };
}

describe('D4: a catch is possession, not a set piece; the team throws by button or the engine does at 2 s (spec keeper rules 2 and 4)', () => {
  it('(a) the caught ball belongs to the keeper, play goes on in the same phase with a gk-catch event, and a rival at steal range cannot take it (no rng draw)', () => {
    const { m, keeper } = caught();
    expect(m.ball.owner).toBe(9);
    expect(m.ball.ownerSinceStep).toBe(0);
    expect(m.phase).toBe('play');
    expect(m.setPiece).toBeNull();
    expect(m.scratch.events[9]).toMatchObject({ kind: 'gk-catch', ok: true, actorId: 9 });
    expect(m.controlled[1]).not.toBe(9);                     // the cursor never sits on the keeper (S-GK.6)
    const thief = m.players[m.controlled[0]];
    thief.x = keeper.x - 20; thief.y = CY;                   // inside STEAL_RANGE of the keeper
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[0].b = 'pressed';
    const rng = fixedRng([0]);
    stepMatch(m, inputs, rng);
    expect(m.ball.owner).toBe(9);
    expect(rng.calls).toBe(0);                               // steal() refuses a keeper owner before rolling
    expect(m.phase).toBe('play');
  });
  it('(b) B on the 10th step of the hold throws a SHORT pass to the nearest mate in the d-pad cone; A throws a LONG one to the farthest — by the keeper, exact, no rng', () => {
    for (const button of ['b', 'a'] as const) {
      const { m, keeper } = caught();
      const rng = countingRng(3);
      for (let i = 0; i < 9; i++) stepMatch(m, IDLE, rng);
      expect(m.ball.owner).toBe(9);
      // Two mates below the keeper (+y): 155 u and 461 u away, both inside the +y cone. Every 3-3-2
      // mate is at x <= 1587 with |dy| <= 325 after nine steps of drift: outside that cone (dot < 0.64).
      const near = m.players[12]; near.x = keeper.x - 40; near.y = CY + 150;
      const far = m.players[13]; far.x = keeper.x - 100; far.y = CY + 450;
      const target = button === 'b' ? near : far;
      const d = dist(keeper.x, keeper.y, target.x, target.y);
      const ux = (target.x - keeper.x) / d;
      const uy = (target.y - keeper.y) / d;
      const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
      inputs[1].dy = 1;
      inputs[1][button] = 'pressed';
      stepMatch(m, inputs, rng);
      expect(m.ball.owner).toBeNull();
      expect(m.ball.kickerId).toBe(9);
      expect(m.scratch.events[9]).toMatchObject({ kind: button === 'b' ? 'short-pass' : 'long-pass', ok: true, actorId: 9 });
      expect(m.ball.vy / m.ball.vx).toBeCloseTo(uy / ux, 6);  // exact aim: a keeper's throw carries no angular error
      if (button === 'a') expect(m.ball.z).toBeGreaterThan(0); else expect(m.ball.z).toBe(0);
      expect(m.phase).toBe('play');
      expect(rng.calls).toBe(0);                             // ten steps of a held ball and a throw: not one draw
    }
  });
  it('(c) with nobody pressing, the automatic release fires on exactly the GK_HOLD_STEPS-th step after the catch, a long pass at the freest own-half mate, and not one step before', () => {
    const { m, keeper } = caught();
    const rng = countingRng(3);
    for (let i = 0; i < GK_HOLD_STEPS - 1; i++) stepMatch(m, IDLE, rng);
    expect(m.ball.owner).toBe(9);
    expect(m.phase).toBe('play');
    const expected = { x: 0, y: 0 };
    // The target as the engine will see it: positions only change in stepPhysics, after the release.
    expect(freestMateDir(keeper, m.players, -1, PITCH, expected)).toBe(true);
    stepMatch(m, IDLE, rng);
    expect(m.ball.owner).toBeNull();
    expect(m.scratch.events[9]).toMatchObject({ kind: 'gk-release', ok: true, actorId: 9 });
    expect(m.ball.vy / m.ball.vx).toBeCloseTo(expected.y / expected.x, 6);
    expect(m.ball.z).toBeGreaterThan(0);                     // a long pass: airborne
    expect(m.phase).toBe('play');
    expect(rng.calls).toBe(0);                               // the whole hold and the release: no draw (no error on a keeper's kick)
    expect(GK_HOLD_STEPS).toBe(stepsFor(2));
    // Pre-flight H4: the five steps after the throw. The ball is 9-46 u from the keeper, moving
    // and free -- inside GK_CATCH_RADIUS for four of them -- and keeperCatch must NOT roll for
    // it (own kick inside the kick lock): the keeper never gets it back, the rng stays untouched.
    for (let i = 0; i < 5; i++) {
      stepMatch(m, IDLE, rng);
      expect(m.ball.owner).toBeNull();
      expect(m.scratch.events[9].kind).not.toBe('gk-catch');
    }
    expect(rng.calls).toBe(0);
  });
  it('(e) while the keeper holds the ball the d-pad and the sprint do not move the field controlled: the AI places it, identically with and without input; with a free ball the same d-pad does move it', () => {
    const a = caught().m;
    const b = caught().m;
    expect(sameMatch(a, b)).toBe(true);
    const c1 = a.controlled[1];
    const before: [number, number] = [a.players[c1].x, a.players[c1].y];
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[1].dx = 1; inputs[1].dy = -1; inputs[1].c = 'held';
    stepMatch(a, inputs, createRng(1));
    stepMatch(b, IDLE, createRng(1));
    expect(a.ball.owner).toBe(9);
    expect(sameMatch(a, b)).toBe(true);
    expect([a.players[c1].x, a.players[c1].y]).not.toEqual(before);   // moved, by positionTeam (drift towards the ball)
    // Control, so the equality above is not vacuous: a FREE ball at rest and the same d-pad move the controlled.
    const free = fresh(); resumePlay(free); freeBall(free, 1000, CY, 0, 0);
    const still = fresh(); resumePlay(still); freeBall(still, 1000, CY, 0, 0);
    stepMatch(free, inputs, createRng(1));
    stepMatch(still, IDLE, createRng(1));
    expect(sameMatch(free, still)).toBe(false);
  });
  it('the same shot with a draw that misses flies on (no free pickup of a moving ball by the keeper, S6), and the referee calls the goal a few steps later', () => {
    const m = fresh();
    resumePlay(m);
    const keeper = m.players[9];
    keeper.x = PITCH.width - GK_LINE_DIST; keeper.y = CY;
    freeBall(m, keeper.x - 31, CY, 700, 0);
    const rng = fixedRng([0.99]);
    stepMatch(m, IDLE, rng);
    expect(m.phase).toBe('play');
    expect(m.ball.owner).toBeNull();
    for (let i = 0; i < 6 && m.phase === 'play'; i++) stepMatch(m, IDLE, rng);
    expect(m.phase).toBe('goal');
    expect(m.score).toEqual([1, 0]);
    expect(rng.calls).toBe(1);                               // one roll per approach (catchRolled), never a second
  });
});

// Ruling R19 / criterion 11: formation and strategy change in the middle of play
// and the placement responds ON THE VERY NEXT STEP, not at the next set piece.
describe('criterion 11: live placement responds at once to a formation or strategy change', () => {
  // A second formation whose slot 0 sits 300 u further up the pitch than the 3-3-2's.
  const shifted: Formation = {
    id: '3-3-2', name: 'NORMAL',
    slots: FORMATIONS[0].slots.map((s, i) => (i === 0 ? { ...s, x: s.x + 0.15 } : s)),
  };
  // Two identical matches run in lockstep; at the switch step only one changes its
  // input. Whatever the drift target is at that moment, the changed side must move
  // differently on THAT step -- not at the next set piece.
  function pair(table: readonly Formation[]): [MatchState, MatchState] {
    const a = createMatch(TEAM_PAIR, table, PITCH, PROFILES);
    const b = createMatch(TEAM_PAIR, table, PITCH, PROFILES);
    resumePlay(a); resumePlay(b);
    const ra = createRng(1); const rb = createRng(1);
    for (let i = 0; i < 120; i++) { stepMatch(a, IDLE, ra); stepMatch(b, IDLE, rb); }
    expect(sameMatch(a, b)).toBe(true);
    return [a, b];
  }
  it('switching the strategy to attack moves a defender further towards the rival goal on the next step', () => {
    const [control, switched] = pair(FORMATIONS);
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[0].strategy = 'attack';
    stepMatch(control, IDLE, createRng(1));
    stepMatch(switched, inputs, createRng(1));
    expect(switched.strategies[0]).toBe('attack');
    expect(switched.players[1].x).toBeGreaterThan(control.players[1].x);   // slot 0 defender, team 0 attacks +x
  });
  it('switching the formation index moves the player of the changed slot on the next step, and nobody else', () => {
    const [control, switched] = pair([FORMATIONS[0], shifted]);
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[0].formation = 1;
    stepMatch(control, IDLE, createRng(1));
    stepMatch(switched, inputs, createRng(1));
    expect(switched.formationIndex[0]).toBe(1);
    expect(switched.players[1].x).toBeGreaterThan(control.players[1].x);
    expect(switched.players[2].x).toBe(control.players[2].x);               // slot 1 is identical in both tables
    expect(switched.players[2].y).toBe(control.players[2].y);
  });
  it('and the human side is symmetric: team 1 responds the same step to its own strategy change', () => {
    const [control, switched] = pair(FORMATIONS);
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[1].strategy = 'attack';
    stepMatch(control, IDLE, createRng(1));
    stepMatch(switched, inputs, createRng(1));
    expect(switched.players[10].x).toBeLessThan(control.players[10].x);      // team 1 attacks -x
  });
});
```
(importar `GK_HOLD_STEPS` y `freestMateDir` de `./actions` y `type PlayerState` ya está; `dist` de `./geometry` ya está; `CountingRng`, `countingRng` y `sameMatch` ya existen en el fichero. Regla anti-coincidencia: 31 u y no 39/40; el paso del automático se afirma por `GK_HOLD_STEPS − 1` verde y `GK_HOLD_STEPS` rojo; el control con balón libre de (e) demuestra que la igualdad no es vacía; los `rng.calls === 0` prueban que ni la posesión, ni el saque del portero, ni los cinco pasos que lo siguen —el portero no re-ataja su propio saque dentro del kick lock, H4— tocan el `rng`.) Sustituir además el bloque de comentario del partido grabado (expectativa 6): quitar "nobody tackles, so there are no fouls and no penalties" y decir que la `policy` sí entra (I1) y que desde la etapa B el `rng` también lo consumen la atajada y el error angular, por lo que la divergencia de la run C llega por cualquiera de los cuatro consumidores.

Run: `npx vitest run components/games/football-logic/match.test.ts` → FAIL (aridad de `createMatch`, `profiles`, atajada, colocación viva).

- [ ] **Step 17: Cablear `match.ts`**

```ts
// match.ts — imports
import { applyKickError, keeperCatch, keeperStep, positionTeam, type AiProfile } from './ai';
import {
  applyButtons, applyKeeperButtons, clearActionEvent, createActionEvent, releaseFromGoalkeeper, stepTackle, updateControlled,
  type ActionEvent,
} from './actions';
// (pitch.ts sigue aportando centerX, centerY y PitchDef; goalKickX NO se importa: la atajada ya no saca de puerta)
// MatchState: quitar gkPenaltyRead; añadir
  profiles: readonly [AiProfile, AiProfile];
  catchRolled: [boolean, boolean];
// scratch: gkEvent desaparece; entra liveControlled
  scratch: { events: ActionEvent[]; liveControlled: [number, number]; call: RefereeCall; aim: Vec2; setPiece: SetPieceState };
// borrar DEFAULT_PENALTY_READ_CHANCE

export function createMatch(teams: [TeamDef, TeamDef], formationTable: readonly Formation[], pitch: PitchDef, profiles: readonly [AiProfile, AiProfile]): MatchState {
  // ...igual, con `profiles,` y `catchRolled: [false, false],` en vez de gkPenaltyRead, y en scratch
  // `liveControlled: [-1, -1],` en vez de `gkEvent: createActionEvent(),`
}

// stepMatch, rama kickoff/set-piece:
      const executed = stepSetPiece(
        sp, inputs[sp.team], match.players, match.ball, rng, match.profiles[keeperTeam].penaltyReadChance,
        match.attackDir, match.pitch, match.stepCount, match.scratch.aim, match.scratch.events[sp.takerId],
      );

function stepOpenPlay(match: MatchState, inputs: readonly [TeamInput, TeamInput], rng: Rng): void {
  const { players, ball, scratch } = match;
  for (let i = 0; i < scratch.events.length; i++) clearActionEvent(scratch.events[i]);
  // Stage B (Task 6a): the in-engine AI, applied to BOTH teams so the replay
  // stays seed + TeamInput. Order of the step, fixed for the rng: (1) the catch,
  // team 0 then team 1 (the only draw before the buttons; D4: a catch is
  // possession, play goes on); (2) who reads the TeamInput this step -- the field
  // controlled, or nobody when the keeper holds the ball (its input goes to the
  // keeper's throw and the field player is placed by the AI, D4); (3) placement
  // and keeper write the want channel; (4) per team, the throw + automatic
  // release (exact, no draw) OR the buttons (steal draw) + kick error (one draw);
  // (5) physics, tackles, referee, clock exactly as in stage A.
  keeperCatchFor(match, 0, rng);
  keeperCatchFor(match, 1, rng);
  scratch.liveControlled[0] = liveControlledFor(match, 0);
  scratch.liveControlled[1] = liveControlledFor(match, 1);
  runTeamAi(match, 0);
  runTeamAi(match, 1);
  applyTeamInput(match, 0, inputs[0], rng);
  applyTeamInput(match, 1, inputs[1], rng);
  stepPhysics(players, ball, inputs, scratch.liveControlled, match.attackDir, match.pitch, match.stepCount);
  // ...el resto (stepTackle, faltas, judgeBall, reloj) exactamente como en la etapa A
}
```
Las cuatro privadas nuevas de `match.ts` (unrolled por equipo porque las firmas piden `0 | 1`, sin ningún `as`; ninguna asigna):

```ts
function keeperOf(match: MatchState, team: 0 | 1): PlayerState {
  return match.players[team * TEAM_SIZE];
}

// D4: -1 while this team's keeper holds the ball (nobody reads the d-pad), else the
// derived controlled. match.controlled itself is untouched: updateControlled keeps
// the cursor on a field player and stage C reads ball.owner to draw it on the keeper.
function liveControlledFor(match: MatchState, team: 0 | 1): number {
  return match.ball.owner === keeperOf(match, team).id ? -1 : match.controlled[team];
}

// One rng draw at most, only when a roll is actually possible (keeperCatch). A catch
// is possession -- no set piece, no early return: the step goes on.
function keeperCatchFor(match: MatchState, team: 0 | 1, rng: Rng): void {
  const gk = keeperOf(match, team);
  keeperCatch(gk, match.ball, match.profiles[team].catchChance, match.catchRolled, rng, match.pitch, match.stepCount, match.scratch.events[gk.id]);
}

function runTeamAi(match: MatchState, team: 0 | 1): void {
  const { players, ball, scratch } = match;
  positionTeam(players, ball, team, match.formationTable[match.formationIndex[team]], match.strategies[team], match.attackDir[team], scratch.liveControlled[team], match.pitch, match.stepCount, scratch.aim);
  keeperStep(keeperOf(match, team), players, ball, match.attackDir[team], match.pitch, match.stepCount);
}

// D4 routing. Keeper holding the ball: the TeamInput is the keeper's (throw by button,
// exact) and, failing that, the automatic release at GK_HOLD_STEPS -- both write the
// keeper's own slot and neither draws. Otherwise the field controlled gets the
// buttons (steal draw inside) and its kick gets the profile's angular error (one draw).
// Team 0 acts first: a simultaneous steal by both resolves in its favour, same
// lowest-id rule as everywhere; QA item, criterion 14.
function applyTeamInput(match: MatchState, team: 0 | 1, input: TeamInput, rng: Rng): void {
  const { players, ball, scratch } = match;
  const gk = keeperOf(match, team);
  if (ball.owner === gk.id) {
    applyKeeperButtons(gk, input, ball, players, match.attackDir[team], match.stepCount, scratch.aim, scratch.events[gk.id]);
    releaseFromGoalkeeper(gk, ball, players, match.attackDir[team], match.pitch, match.stepCount, scratch.aim, scratch.events[gk.id]);
    return;
  }
  const controlledPlayer = players[match.controlled[team]];
  const ev = scratch.events[controlledPlayer.id];
  applyButtons(controlledPlayer, input, ball, players, rng, match.stepCount, scratch.aim, ev);
  if (ev.ok && (ev.kind === 'shot' || ev.kind === 'short-pass' || ev.kind === 'long-pass')) {
    applyKickError(ball, ev.kind === 'shot' ? match.profiles[team].shotErrorDeg : match.profiles[team].passErrorDeg, rng);
  }
}
```
> Por qué el orden atajada → `liveControlled` → colocación: la atajada es la única que cambia `ball.owner` antes de los botones, y tanto `liveControlledFor` como `positionTeam` (`inPossession`) y `keeperStep` (parado con el balón) leen ese dueño; así, en el mismo paso de la atajada, el equipo ya se coloca en posesión y el controlado de campo ya no obedece a la cruceta. `releaseFromGoalkeeper` tras `applyKeeperButtons` es seguro sin guarda: si el botón sacó, `ball.owner !== gk.id` y sale sin tocar el evento; si no, decide por `ownerSinceStep`. `stepPhysics` conserva su firma: recibe `scratch.liveControlled` en vez de `match.controlled`.

> Simultaneidad (deuda del ledger, decisión escrita): los robos simultáneos siguen resolviendo equipo 0 primero (el bucle de `applyButtons` va en orden de equipo) y solo se juzga una falta por paso (gana la víctima del equipo 0). Es un desempate determinista por `id`, el mismo criterio de toda la carpeta; queda documentado en el comentario de cabecera de `applyTeamInput` (arriba) y va a la lista de QA del handoff. Sin cambio de código en la etapa B.

En `set-pieces.ts`, CARRY #20, junto a `nearestOutfield`:
```ts
// Returns -1 only if the team has no outfield player: unreachable while TEAM_SIZE
// is 9 and rosters are fixed (stage B decision); v1.5 substitutions/sendings-off
// must keep at least one outfield player or guard beginSetPiece before indexing.
```

Run: `npx vitest run` → **todo verde**. Contar: 760 + nuevos. `npx tsc --noEmit` limpio. Si alguna de las cuatro trazas de reloj en vacío (N1) o el partido grabado falla: **BLOCKED con la medición** (ver la lista de caducidad: no son expectativas que se relajen).

- [ ] **Step 18: Test que falla — fallback de distancia cero de `pushRivalsAway` (CARRY #19), ahora alcanzable**

```ts
// set-pieces.test.ts — añadir en describe('beginSetPiece')
  it('a rival standing EXACTLY on the free-kick spot is pushed straight back towards its own goal (zero-distance fallback)', () => {
    const w = world();
    // (1234, 567) is on no formation lane and not centre-anything: the pushed
    // coordinates below cannot coincide with a formation slot by accident.
    const rival = w.players[13];
    rival.x = 1234; rival.y = 567;
    begin(w, 'free-kick', 0, 1234, 567);
    // team 0 attacks +x: the fallback direction is (-attackDir[0], 0) = (-1, 0)
    expect(rival.x).toBe(1234 - SET_PIECE_CLEARANCE);
    expect(rival.y).toBe(567);
  });
```
Run: `npx vitest run components/games/football-logic/set-pieces.test.ts` → PASS a la primera si la rama existe (existe desde la etapa A: `set-pieces.ts:81-84`); comprobar por **mutación** que el test la cubre: cambiar temporalmente `scratch.x = -attackDir[sp.team]` por `scratch.x = attackDir[sp.team]` → el test debe fallar; restaurar.

- [ ] **Step 19: Verificación de la Task 6a y grep de determinismo**

Run: `npx vitest run` → verde (≈ 760 + ~58: 45 de la versión del 04-sep más los 7 de `applyKeeperButtons`/`releaseFromGoalkeeper` en `actions.test.ts`, los 5 de D4 en `match.test.ts` y el `it` del kick lock de `keeperCatch` (H4) en `ai.test.ts`). `npx tsc --noEmit` limpio. `grep -rn "Math.random\|Date.now\|performance.now\|Math.sin\|Math.cos\|Math.atan2\|Math.hypot" components/games/football-logic/` → vacío. `grep -rn "gkEvent\|goalKickX" components/games/football-logic/` → `gkEvent` en ningún sitio; `goalKickX` solo en `pitch.ts`, `referee.ts` y `pitch.test.ts`. Recorrer `grep -n "^export" components/games/football-logic/ai.ts`: cada símbolo con consumidor en `match.ts` o `ai.test.ts`; `applyKeeperButtons` consumido por `match.ts` y `actions.test.ts`. **Excepción declarada (pre-vuelo H7):** los ocho umbrales del árbol con balón (`SHOT_RANGE`, `SHOT_TAP_DIST`, `SHOT_LANE_LENGTH`, `SHOT_LANE_RADIUS`, `PRESSURE_DIST`, `PASS_LANE_RADIUS`, `LONG_PASS_MIN_DIST`, `SPRINT_FREE_DIST`) y el tipo `AiPlan` no tienen consumidor hasta la Task 6b (Step 4, `it` de umbrales); se anota aquí y se cierra allí. `ai.ts` no importa `STRATEGIES` ni `Side` (podados del Step 13).

Re-medir el partido grabado de `match.test.ts` (pasos, marcador, fases, tiros libres, `firstMismatchC`) y reescribir su comentario con los números nuevos (expectativa 6). Reportar en el informe de la tarea la cifra de tests y las mediciones.

- [ ] **Step 20: Propose commit**

Working tree verificado. Mensaje propuesto (lo ejecuta Paco):

`feat(world-cup): in-engine AI — want channel, live placement by formation and strategy, keeper on its line that catches and holds (throw by button or automatic release at 2 s), profile-driven kick error`

---

## Task 6b: `ai.ts` fuera del paso — la decisión del equipo CPU y el partido CPU vs CPU

**Files:**
- Modify: `components/games/football-logic/clock.ts` (recibe `HALF_SECONDS`, `HALF_SECONDS_MAX`, `HALF_STEPS`)
- Modify: `components/games/football-logic/match.ts:47-49` (las re-exporta desde `clock.ts`; `match.test.ts` no cambia sus imports)
- Modify: `components/games/football-logic/ai.ts`
- Test: `components/games/football-logic/ai.test.ts`

**Interfaces:**
- Consumes: todo lo de la Task 6a más `pickPassTarget`, `STEAL_RANGE`, `SHOT_CHARGE_STEPS`, `LONG_PASS_HOLD_STEPS` (`actions.ts`); `TACKLE_DIST`, `isPlayerDown` (`players.ts`); `PenaltySide` (`set-pieces.ts`, tipo); `MatchState` (`match.ts`, **solo tipo**); `HALF_STEPS` (`step.ts`, que lo re-exporta de `clock.ts` tras el Step 1: `ai.ts` sigue la convención del motor, "everything outside players.ts/ball.ts imports the clock from step.ts" — pre-vuelo H11); `createTeamInput`, `checkTeamInput`, `copyTeamInput`, `toAxis` (`input.ts`).
- Produces (lo usan la Task 7, el componente de la etapa C y las sondas del cierre):

```ts
// clock.ts (movidas desde match.ts, mismos valores; match.ts las re-exporta)
export const HALF_SECONDS = 90;
export const HALF_SECONDS_MAX = 120;
export const HALF_STEPS = stepsFor(HALF_SECONDS);   // 5400

// ai.ts
export type AiPlan = 'none' | 'carry' | 'shoot' | 'short-pass' | 'long-pass';
export type AiState = {
  nextDecisionStep: number;      // the reaction gate of the with-ball tree and the defensive action
  nextStrategyStep: number;      // the 5 s scoreboard review
  strategy: Strategy;
  plan: AiPlan;
  planPressed: boolean;          // the button of the plan has been pressed
  planStepsLeft: number;         // holds left before the release
  aimDx: Axis; aimDy: Axis;      // d-pad of the current plan (carry direction or kick direction)
  sprint: boolean;
  penaltyChosen: boolean;
  penaltySide: PenaltySide;
  dir: Vec2;                     // scratch, created once
  quant: { dx: Axis; dy: Axis }; // scratch, created once
};
export function createAiState(): AiState;
export function chooseStrategy(score: readonly [number, number], team: 0 | 1, half: 1 | 2 | 3, halfStep: number): Strategy;
// Called ONCE PER STEP by the component (stage C) or the test, BEFORE stepMatch, with the
// CPU team's own rng (never the match's). Writes a TeamInput valid by construction.
export function decideTeamInput(match: MatchState, team: 0 | 1, profile: AiProfile, state: AiState, rng: Rng, out: TeamInput): void;
export const STRATEGY_REVIEW_SECONDS = 5;
export const LATE_GAME_SECONDS = 30;
```

### Supuestos de la Task 6b (marcados `// Stage B assumption, not in the spec — review in QA`, salvo S14 y S17, confirmados por Paco el 05-sep: `// confirmed by owner 2026-09-05`)

- **S11 · Lado del penalti de la CPU**: uniforme entre −1/0/1 con una tirada de su `rng`, elegido una vez por penalti y mantenido durante la cuenta atrás. Los demás saques dejan la dirección por defecto del motor (hacia el centro de la portería rival).
- **S12 · Esquiva al conducir**: `v = unit(goal − me) − unit(rival − me) · (1 − dRival / DODGE_DIST)` con `DODGE_DIST = 150`; con presión y sin carril, `v = unit(goal − me) − unit(rival − me)` (peso completo: "hacia el lado contrario").
- **S13 · "150 u de pista libre"**: `laneBlocked` con `SPRINT_FREE_DIST` de largo y `SPRINT_LANE_RADIUS = 60` de radio (el mismo radio que la línea de chut).
- **S14 · Sin balón — CONFIRMADO por Paco el 05-sep (D2)**: el controlado persigue el balón cada paso (sin puerta de reacción: es lo que hace el humano con la cruceta) y sprinta si está a más de `SPRINT_FREE_DIST`; la **acción defensiva** (robo a < `STEAL_RANGE`, entrada a < `TACKLE_DIST` y solo si `rng() < tackleChance`) se evalúa en la puerta de reacción. El **"solo de frente"** (`dot(me − owner, owner.facing) > 0`) NO está en el texto de D2: es un supuesto propio (entrar por detrás es falta por construcción), numerado **S14b**, etiquetado `// Stage B assumption S14b, not in the spec — review in QA` y NO `confirmed` (pre-vuelo H9). `tackleChance` es la **disposición** de la CPU a intentar robo o entrada a alcance en cada tick de reacción (como `aggression` en Vault Fighter); el éxito del robo sigue siendo `STEAL_CHANCE` 65 % / 35 % frente a sprint para los dos equipos, y el de la entrada, geométrico. Etiqueta en código: `// confirmed by owner 2026-09-05 (D2)`.
- **S15 · Un solo rayo de chut**: el chut sale por la cruceta (8 direcciones): recto `(attack, 0)` si `|me.y − cy| < goalWidth/2 − SHOT_POST_MARGIN`, diagonal `(attack, ±1)` si ese rayo entra entre los postes con el mismo margen; `SHOT_POST_MARGIN = 20`. Sin rayo que entre, no chuta y sigue conduciendo hacia `(goalX, cy)`.
- **S16 · Al ganar el balón se decide en el acto** (`plan === 'none'` fuerza la decisión); a partir de ahí, cada `reactionSteps`.
- **S17 · Con el portero propio en posesión — CONFIRMADO por Paco el 05-sep (D4)**: la CPU **no pulsa botones** (saca siempre con el automático a los 2 s) y emite entrada neutra (`dx = dy = 0`, A/B/C `'up'`): el motor enruta ese `TeamInput` al saque del portero (D4), así que la cruceta no movería al controlado de campo, que se coloca por `positionTeam` (ancla + deriva) igual que el resto. Ni una tirada del `rng` de la CPU en ese estado. Etiqueta en código: `// confirmed by owner 2026-09-05 (D4)`.
- **S18 · La CPU no cambia de formación** (el spec solo fija el cambio de estrategia): `out.formation = match.formationIndex[team]`.

- [ ] **Step 1: Mover las constantes de la parte a `clock.ts` y re-exportarlas**

```ts
// clock.ts — añadir al final (sigue sin imports)
export const HALF_SECONDS = 90;
export const HALF_SECONDS_MAX = 120;
export const HALF_STEPS = stepsFor(HALF_SECONDS);
```
```ts
// match.ts — sustituir las tres líneas de HALF_* por (una sola fuente para el reloj de la parte, `./clock`,
// y una sola línea de import: match.ts es, como step.ts, un re-exportador de clock.ts para match.test.ts
// y el componente; pre-vuelo H11)
import { HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS } from './clock';
export { HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS };
```
(la línea `import { STEP_MS, stepPhysics, stepsFor } from './step';` de `match.ts` no cambia; `HALF_STEPS` se usa localmente en `endHalf`/`stepMatch` y sale del mismo import que se re-exporta, no de dos fuentes distintas) y en `step.ts` ampliar la re-exportación: `export { STEPS_PER_SECOND, STEP_MS, HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS, stepsFor, perStep } from './clock';`.

Run: `npx vitest run components/games/football-logic/match.test.ts` → PASS sin tocar el test (`HALF_STEPS` etc. siguen saliendo de `./match`). `npx tsc --noEmit` limpio.

- [ ] **Step 2: Tests que fallan — `chooseStrategy` y `createAiState`**

```ts
// ai.test.ts — añadir (importar chooseStrategy, createAiState, decideTeamInput, STRATEGY_REVIEW_SECONDS, LATE_GAME_SECONDS de './ai';
// HALF_STEPS de './step'; checkTeamInput, copyTeamInput de './input'; createMatch, stepMatch, resumePlay, type MatchState, type MatchPhase de './match')

describe('chooseStrategy: the scoreboard table of the spec, reviewed every 5 s', () => {
  const LATE = HALF_STEPS - stepsFor(LATE_GAME_SECONDS) + 60;   // 29 s left: inside the late window, off its edge
  const EARLY = HALF_STEPS - stepsFor(LATE_GAME_SECONDS) - 900;  // 45 s left
  it('losing → attack, whatever the half or the clock', () => {
    expect(chooseStrategy([0, 1], 0, 1, 0)).toBe('attack');
    expect(chooseStrategy([2, 0], 1, 2, EARLY)).toBe('attack');
  });
  it('tied in the second half with under 30 s → attack; with 45 s left → neutral; tied in the first half late → neutral', () => {
    expect(chooseStrategy([1, 1], 0, 2, LATE)).toBe('attack');
    expect(chooseStrategy([1, 1], 0, 2, EARLY)).toBe('neutral');
    expect(chooseStrategy([1, 1], 0, 1, LATE)).toBe('neutral');
  });
  it('winning by exactly one with under 30 s → defend; by two → neutral; by one with 45 s left → neutral', () => {
    expect(chooseStrategy([1, 0], 0, 2, LATE)).toBe('defend');
    expect(chooseStrategy([0, 1], 1, 1, LATE)).toBe('defend');
    expect(chooseStrategy([2, 0], 0, 2, LATE)).toBe('neutral');
    expect(chooseStrategy([1, 0], 0, 2, EARLY)).toBe('neutral');
  });
  it('the golden goal is always attack, even for the side that would otherwise defend (criterion 12)', () => {
    expect(chooseStrategy([0, 0], 0, 3, 0)).toBe('attack');
    expect(chooseStrategy([0, 0], 1, 3, 0)).toBe('attack');
    expect(STRATEGY_REVIEW_SECONDS).toBe(5);
    expect(LATE_GAME_SECONDS).toBe(30);
  });
  it('createAiState starts neutral, planless, ready to decide at step 0', () => {
    const s = createAiState();
    expect(s.strategy).toBe('neutral');
    expect(s.plan).toBe('none');
    expect(s.nextDecisionStep).toBe(0);
    expect(s.nextStrategyStep).toBe(0);
  });
});
```
Run: `npx vitest run components/games/football-logic/ai.test.ts` → FAIL.

- [ ] **Step 3: Implementar `AiState`, `createAiState`, `chooseStrategy`**

```ts
// ai.ts — añadir
import { HALF_STEPS } from './step';   // the engine convention: the clock comes through step.ts (re-exported in 6b Step 1), never from clock.ts directly (pre-flight H11)
import type { TeamInput } from './input';
import type { PenaltySide } from './set-pieces';
import type { MatchState } from './match';   // type only: erased at compile time, no ESM cycle
import { LONG_PASS_HOLD_STEPS, SHOT_CHARGE_STEPS, STEAL_RANGE, pickPassTarget } from './actions';
import { TACKLE_DIST } from './players';
import { INV_SQRT2 } from './geometry';

export const STRATEGY_REVIEW_SECONDS = 5;
export const LATE_GAME_SECONDS = 30;
const STRATEGY_REVIEW_STEPS = stepsFor(STRATEGY_REVIEW_SECONDS);
const LATE_GAME_STEPS = stepsFor(LATE_GAME_SECONDS);
// Stage B assumptions S12, S13 and S15, not in the spec — review in QA (S14, the
// defensive roll in `chase`, is confirmed by owner 2026-09-05, D2; S14b, the
// front-only slide in `chase`, is NOT: assumption, review in QA)
const DODGE_DIST = 150;
const SPRINT_LANE_RADIUS = 60;
const SHOT_POST_MARGIN = 20;
const CHASE_DEAD_ZONE = 4;

export type AiPlan = 'none' | 'carry' | 'shoot' | 'short-pass' | 'long-pass';
export type AiState = {
  nextDecisionStep: number;
  nextStrategyStep: number;
  strategy: Strategy;
  plan: AiPlan;
  planPressed: boolean;
  planStepsLeft: number;
  aimDx: Axis;
  aimDy: Axis;
  sprint: boolean;
  penaltyChosen: boolean;
  penaltySide: PenaltySide;
  dir: Vec2;
  quant: { dx: Axis; dy: Axis };
};

export function createAiState(): AiState {
  return {
    nextDecisionStep: 0, nextStrategyStep: 0, strategy: 'neutral',
    plan: 'none', planPressed: false, planStepsLeft: 0, aimDx: 0, aimDy: 0, sprint: false,
    penaltyChosen: false, penaltySide: 0,
    dir: { x: 0, y: 0 }, quant: { dx: 0, dy: 0 },
  };
}

// Spec "Cambio de estrategia de la CPU por marcador": losing → attack; tied in the
// 2nd half with < 30 s → attack; winning by one with < 30 s → defend; golden goal → attack.
export function chooseStrategy(score: readonly [number, number], team: 0 | 1, half: 1 | 2 | 3, halfStep: number): Strategy {
  if (half === 3) return 'attack';
  const mine = score[team];
  const theirs = score[team === 0 ? 1 : 0];
  if (mine < theirs) return 'attack';
  const late = HALF_STEPS - halfStep < LATE_GAME_STEPS;
  if (mine === theirs) return half === 2 && late ? 'attack' : 'neutral';
  return mine - theirs === 1 && late ? 'defend' : 'neutral';
}
```
Run: `npx vitest run components/games/football-logic/ai.test.ts` → los tests del Step 2 PASS.

- [ ] **Step 4: Tests que fallan — el árbol con balón, la persecución y la acción defensiva, la reacción por dificultad (1 vs 8), el penalti**

```ts
// ai.test.ts — añadir (importar de './ai' SHOT_RANGE, SHOT_TAP_DIST, SHOT_LANE_LENGTH, SHOT_LANE_RADIUS,
// PRESSURE_DIST, PASS_LANE_RADIUS, LONG_PASS_MIN_DIST, SPRINT_FREE_DIST y type AiPlan — pre-vuelo H7: los
// umbrales se afirman aquí para que tengan consumidor, patrón DRIFT_LONG de 6a —; de './actions'
// SHOT_CHARGE_STEPS y LONG_PASS_HOLD_STEPS si no están ya)
// A match in open play with team 0 (attacking +x) holding the ball in player 5.
// Everybody else is parked on the far touchline AND on the floor (downUntilStep far
// ahead): pickPassTarget, laneBlocked and nearestRival all skip downed players, so
// only the players each test places with `at` (which stands them up) take part.
// Without the floor, a parked mate 60 u from a parked rival could qualify as a
// "freer" pass target by coincidence of the parking geometry.
const PARKED_UNTIL = 1_000_000;
function scenario(): { m: MatchState; me: PlayerState; state: AiState; out: TeamInput } {
  const m = createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [profileFor(TEAMS[0], 8), profileFor(TEAMS[1], 8)]);
  resumePlay(m);
  for (const p of m.players) { at(p, 50 + p.id * 10, 1280); p.downUntilStep = PARKED_UNTIL; }
  const me = at(m.players[5], 1000, CY, 1, 0);
  givePossession(m.ball, me, 0);
  m.controlled[0] = 5;
  return { m, me, state: createAiState(), out: createTeamInput() };
}
function decide(s: ReturnType<typeof scenario>, rng: Rng = fixedRng([0.5])): TeamInput {
  decideTeamInput(s.m, 0, s.m.profiles[0], s.state, rng, s.out);
  return s.out;
}
// Plays the plan out: returns the sequence of A/B states until the release.
function buttonTrace(s: ReturnType<typeof scenario>, button: 'a' | 'b', max = 80): string[] {
  const trace: string[] = [];
  for (let i = 0; i < max; i++) {
    s.m.stepCount = i;
    const out = decide(s);
    trace.push(out[button]);
    if (out[button] === 'released') break;
  }
  return trace;
}

describe('decideTeamInput with the ball: the three-branch tree (spec "La CPU con balón")', () => {
  it('the with-ball thresholds are the spec numbers (the tests below spell them as literals on purpose: 300, 150, 419, 60, 200, 400)', () => {
    expect(SHOT_RANGE).toBe(420);
    expect(SHOT_TAP_DIST).toBe(150);
    expect(SHOT_LANE_LENGTH).toBe(200);
    expect(SHOT_LANE_RADIUS).toBe(60);
    expect(PRESSURE_DIST).toBe(90);
    expect(PASS_LANE_RADIUS).toBe(50);
    expect(LONG_PASS_MIN_DIST).toBe(350);
    expect(SPRINT_FREE_DIST).toBe(150);
    // AiPlan is the public name of what the state carries: a shot plan starts (and stays, charge 33) as 'shoot'.
    const s = scenario();
    at(s.me, PITCH.width - 300, CY, 1, 0); s.m.ball.x = s.me.x + 18; s.m.ball.y = CY;
    decide(s);
    const plan: AiPlan = s.state.plan;
    expect(plan).toBe('shoot');
  });
  it('1. shoots when < SHOT_RANGE from the goal, aligned, lane clear: A pressed, held proportionally, released', () => {
    const s = scenario();
    at(s.me, PITCH.width - 300, CY, 1, 0);                   // 300 u out, dead centre
    s.m.ball.x = s.me.x + 18; s.m.ball.y = CY;
    const trace = buttonTrace(s, 'a');
    expect(trace[0]).toBe('pressed');
    expect(trace[trace.length - 1]).toBe('released');
    // charge = round(60 * (300 - 150) / (420 - 150)) = round(33.3) = 33 → pressed + 32 held + released
    expect(trace.length).toBe(34);
    expect(s.out.dx).toBe(1);
    expect(s.out.dy).toBe(0);
  });
  it('a tap from 150 u and a full charge from 419 u', () => {
    const near = scenario();
    at(near.me, PITCH.width - 150, CY, 1, 0); near.m.ball.x = near.me.x + 18;
    expect(buttonTrace(near, 'a')).toEqual(['pressed', 'released']);
    const far = scenario();
    at(far.me, PITCH.width - 419, CY, 1, 0); far.m.ball.x = far.me.x + 18;
    expect(buttonTrace(far, 'a').length).toBe(SHOT_CHARGE_STEPS + 1);
  });
  it('does not shoot with a rival on the line inside its first 200 u, and does shoot with the rival 250 u out', () => {
    const blocked = scenario();
    at(blocked.me, PITCH.width - 300, CY, 1, 0); blocked.m.ball.x = blocked.me.x + 18;
    at(blocked.m.players[12], blocked.me.x + 120, CY + 30);   // 120 u along, 30 u off: inside radius 60
    expect(decide(blocked).a).toBe('up');
    const open = scenario();
    at(open.me, PITCH.width - 300, CY, 1, 0); open.m.ball.x = open.me.x + 18;
    at(open.m.players[12], open.me.x + 250, CY + 30);         // beyond SHOT_LANE_LENGTH
    expect(decide(open).a).toBe('pressed');
  });
  it('shoots on the diagonal when that ray enters the goal and the straight one does not', () => {
    const s = scenario();
    // 200 u out and 200 u above centre: (1, +1) reaches the line at y = CY exactly; (1, 0) misses the posts
    at(s.me, PITCH.width - 200, CY - 200, 1, 0); s.m.ball.x = s.me.x + 18; s.m.ball.y = s.me.y;
    const out = decide(s);
    expect(out.a).toBe('pressed');
    expect([out.dx, out.dy]).toEqual([1, 1]);
  });
  it('2. under pressure with a mate in a clear lane, passes: short to a mate 200 u away, long to one 400 u away', () => {
    const short = scenario();
    at(short.m.players[12], short.me.x - 60, CY);             // rival 60 u behind: pressure, not on the lane
    at(short.m.players[6], short.me.x + 200, CY);             // mate straight ahead, more advanced
    // A mate exactly on the +x axis is by construction on the EDGE of both diagonal cones too
    // (dot = INV_SQRT2 with (1, ±1), and the assist uses `< INV_SQRT2` to exclude): three
    // directions score the same and (1, 0) wins because tryPass keeps the lowest DIRS index on
    // ties (`score > bestScore`, strict). Unavoidable geometry (pre-flight H8), not a fixture bug.
    expect(buttonTrace(short, 'b')).toEqual(['pressed', 'released']);
    expect([short.out.dx, short.out.dy]).toEqual([1, 0]);
    const long = scenario();
    at(long.m.players[12], long.me.x - 60, CY);
    at(long.m.players[6], long.me.x + 400, CY);
    const trace = buttonTrace(long, 'b');
    expect(trace[0]).toBe('pressed');
    expect(trace.length).toBe(LONG_PASS_HOLD_STEPS + 1);      // pressed + 14 held + released → chargeSteps 15
  });
  it('2b. under pressure with the only mate\'s lane blocked, carries AWAY from the nearest rival', () => {
    const s = scenario();
    at(s.m.players[12], s.me.x - 40, CY - 60);                // rival 72 u away, behind and above
    at(s.m.players[6], s.me.x + 200, CY);
    at(s.m.players[13], s.me.x + 100, CY + 10);               // on the pass lane, 10 u off it
    const out = decide(s);
    expect(out.b).toBe('up');
    expect(out.a).toBe('up');
    // v = (1, 0) - unit(-40, -60) = (1.555, 0.832): 28° below the axis, i.e. the (1, 1) sector — away from the rival
    expect(out.dx).toBe(1);
    expect(out.dy).toBe(1);
  });
  it('3. no pressure, far from goal: carries towards the goal centre and sprints with 150 u of clear track', () => {
    const s = scenario();
    at(s.me, 400, CY - 300, 1, 0); s.m.ball.x = 418; s.m.ball.y = CY - 300;
    const out = decide(s);
    expect(out.a).toBe('up');
    expect(out.b).toBe('up');
    expect(out.dx).toBe(1);
    expect(out.dy).toBe(0);                                   // goal centre is 10.6° below-right: inside the (1, 0) sector
    expect(out.c).toBe('held');
    at(s.m.players[12], s.me.x + 90, s.me.y + 40);            // 98 u ahead (no pressure), 40 u off the track (< 60): no sprint
    s.state.plan = 'none';
    const again = decide(s);
    expect(again.c).toBe('up');
    expect([again.dx, again.dy]).toEqual([1, 0]);             // the partial dodge (weight 0.35) does not leave the sector
  });
  it('the reaction gate: a level-8 CPU re-reads the situation in 13 steps, a level-1 one in 36 (spec 210 ms vs 595 ms)', () => {
    for (const [level, expected] of [[8, 13], [1, 36]] as const) {
      const s = scenario();
      const profile = profileFor(TEAMS[0], level);
      at(s.me, 400, CY, 1, 0); s.m.ball.x = 418;             // far out: step 0 decides "carry"
      s.m.stepCount = 0;
      decideTeamInput(s.m, 0, profile, s.state, fixedRng([0.5]), s.out);
      expect(s.out.a).toBe('up');
      // The situation changes right after: now 300 u out, aligned, clear.
      at(s.me, PITCH.width - 300, CY, 1, 0); s.m.ball.x = s.me.x + 18;
      let firstPress = -1;
      for (let step = 1; step < 80 && firstPress < 0; step++) {
        s.m.stepCount = step;
        decideTeamInput(s.m, 0, profile, s.state, fixedRng([0.5]), s.out);
        if (s.out.a === 'pressed') firstPress = step;
      }
      expect(firstPress).toBe(expected);
      expect(profile.reactionSteps).toBe(expected);
    }
  });
});

describe('decideTeamInput without the ball: chase every step, act at the gate', () => {
  it('runs at the ball (quantized, dead zone) and sprints while it is far', () => {
    const s = scenario();
    givePossession(s.m.ball, s.m.players[12], 0);
    at(s.m.players[12], 1400, CY + 300, -1, 0);
    s.m.ball.x = 1382; s.m.ball.y = CY + 300;
    const out = decide(s);
    expect([out.dx, out.dy]).toEqual([1, 1]);
    expect(out.c).toBe('held');
  });
  it('steals at < STEAL_RANGE (B pressed), slides at < TACKLE_DIST from the FRONT when the roll passes tackleChance, never from behind', () => {
    const steal = scenario();
    const owner = at(steal.m.players[12], 1020, CY, -1, 0);   // faces -x, towards me: I am in front
    givePossession(steal.m.ball, owner, 0);
    expect(decide(steal).b).toBe('pressed');
    const slide = scenario();
    const o2 = at(slide.m.players[12], 1060, CY, -1, 0);      // 60 u, facing me
    givePossession(slide.m.ball, o2, 0);
    expect(decide(slide, fixedRng([0.1])).a).toBe('pressed');  // 0.1 < tackleChance(8) = 0.77
    const shy = scenario();
    const o3 = at(shy.m.players[12], 1060, CY, -1, 0);
    givePossession(shy.m.ball, o3, 0);
    expect(decide(shy, fixedRng([0.9])).a).toBe('up');          // 0.9 >= 0.77: keeps chasing
    const behind = scenario();
    const o4 = at(behind.m.players[12], 1060, CY, 1, 0);        // faces away: I am behind him
    givePossession(behind.m.ball, o4, 0);
    expect(decide(behind, fixedRng([0.1])).a).toBe('up');
  });
  it('the defensive roll consumes the rng only when a slide is actually considered', () => {
    const s = scenario();
    const owner = at(s.m.players[12], 1300, CY, -1, 0);       // 300 u away: nothing to consider
    givePossession(s.m.ball, owner, 0);
    let calls = 0;
    decideTeamInput(s.m, 0, s.m.profiles[0], s.state, () => { calls++; return 0; }, s.out);
    expect(calls).toBe(0);
  });
  it('(d) with our own keeper holding the ball the CPU presses nothing and points nowhere (D4: the engine would route A/B to the keeper\'s throw; the CPU always leaves it to the automatic release) and draws nothing', () => {
    const s = scenario();
    givePossession(s.m.ball, s.m.players[0], 0);
    at(s.me, 1500, 100, 1, 0);                                // far from its anchor: a d-pad towards it would be (-1, 1)
    let calls = 0;
    for (let step = 0; step < 130; step++) {                   // longer than GK_HOLD_STEPS: the gate reopens several times
      s.m.stepCount = step;
      decideTeamInput(s.m, 0, s.m.profiles[0], s.state, () => { calls++; return 0; }, s.out);
      expect([s.out.dx, s.out.dy, s.out.a, s.out.b, s.out.c]).toEqual([0, 0, 'up', 'up', 'up']);
    }
    expect(calls).toBe(0);
    expect(s.state.plan).toBe('none');
  });
});

describe('decideTeamInput during set pieces and pauses', () => {
  it('chooses a penalty side once with one rng draw and keeps it through the countdown; no buttons', () => {
    const m = createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
    resumePlay(m);
    expect(callSetPiece(m, 'penalty', 0, PITCH.width - PITCH.penaltySpotDist, CY)).toBe(true);
    const state = createAiState();
    const out = createTeamInput();
    let calls = 0;
    const rng = () => { calls++; return 0.7; };               // → side +1 (S11: thirds)
    decideTeamInput(m, 0, m.profiles[0], state, rng, out);
    expect(out.dy).toBe(1);
    expect(calls).toBe(1);
    for (let i = 0; i < 10; i++) decideTeamInput(m, 0, m.profiles[0], state, rng, out);
    expect(out.dy).toBe(1);
    expect(calls).toBe(1);
    expect([out.a, out.b, out.c]).toEqual(['up', 'up', 'up']);
    // The defending team leaves the d-pad alone.
    const other = createTeamInput();
    decideTeamInput(m, 1, m.profiles[1], createAiState(), rng, other);
    expect([other.dx, other.dy]).toEqual([0, 0]);
  });
  it('is neutral input (formation kept, strategy from the scoreboard) during goal, half-time and over', () => {
    const m = createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
    const state = createAiState();
    const out = createTeamInput();
    for (const phase of ['goal', 'half-time', 'over'] as const) {
      m.phase = phase;
      m.score[1] = 2;                                         // team 0 is losing → attack
      decideTeamInput(m, 0, m.profiles[0], state, fixedRng([0.5]), out);
      expect([out.dx, out.dy, out.a, out.b, out.c]).toEqual([0, 0, 'up', 'up', 'up']);
      expect(out.strategy).toBe('attack');
      expect(out.formation).toBe(m.formationIndex[0]);
    }
  });
});
```
(importar `callSetPiece` de `./match`, `type AiState` de `./ai`.) Si un fixture geométrico de este bloque no dispara la rama que dice (p. ej. la diagonal de "shoots on the diagonal"), **medir** la geometría real y mover el fixture, nunca la regla.

Run: `npx vitest run components/games/football-logic/ai.test.ts` → FAIL (`decideTeamInput` no existe).

- [ ] **Step 5: Implementar `decideTeamInput`**

```ts
// ai.ts — añadir

// The eight d-pad directions with their unit vectors (data, created once).
const DIRS: readonly { dx: Axis; dy: Axis; ux: number; uy: number }[] = [
  { dx: 1, dy: 0, ux: 1, uy: 0 }, { dx: 1, dy: 1, ux: INV_SQRT2, uy: INV_SQRT2 },
  { dx: 0, dy: 1, ux: 0, uy: 1 }, { dx: -1, dy: 1, ux: -INV_SQRT2, uy: INV_SQRT2 },
  { dx: -1, dy: 0, ux: -1, uy: 0 }, { dx: -1, dy: -1, ux: -INV_SQRT2, uy: -INV_SQRT2 },
  { dx: 0, dy: -1, ux: 0, uy: -1 }, { dx: 1, dy: -1, ux: INV_SQRT2, uy: -INV_SQRT2 },
];

function neutralInput(out: TeamInput): void {
  out.dx = 0; out.dy = 0; out.a = 'up'; out.b = 'up'; out.c = 'up';
}

function nearestRival(players: readonly PlayerState[], team: 0 | 1, x: number, y: number, stepCount: number): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.team === team || isPlayerDown(q, stepCount)) continue;
    const d = dist(x, y, q.x, q.y);
    if (d < bestDist) {
      bestDist = d;
      best = q.id;
    }
  }
  return best;
}

function nearestRivalDist(players: readonly PlayerState[], team: 0 | 1, x: number, y: number, stepCount: number): number {
  const id = nearestRival(players, team, x, y, stepCount);
  return id === -1 ? Infinity : dist(x, y, players[id].x, players[id].y);
}

function startPlan(state: AiState, plan: AiPlan, holds: number, dx: Axis, dy: Axis): void {
  state.plan = plan;
  state.planPressed = false;
  state.planStepsLeft = holds;
  state.aimDx = dx;
  state.aimDy = dy;
  state.sprint = false;
}

// Branch 1: the straight ray, else the diagonal towards the goal centre, if it
// enters between the posts with SHOT_POST_MARGIN and the lane is clear (S15).
function tryShoot(match: MatchState, team: 0 | 1, me: PlayerState, state: AiState): boolean {
  const { players, ball, pitch } = match;
  const attack = match.attackDir[team];
  const goalX = goalLineX(pitch, attack === 1 ? 1 : 0);
  const cy = centerY(pitch);
  const dGoal = dist(me.x, me.y, goalX, cy);
  if (dGoal >= SHOT_RANGE) return false;
  const half = pitch.goalWidth / 2 - SHOT_POST_MARGIN;
  const run = attack === 1 ? goalX - me.x : me.x - goalX;
  const towardsCentre: Axis = cy > me.y ? 1 : cy < me.y ? -1 : 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const dy: Axis = attempt === 0 ? 0 : towardsCentre;
    if (attempt === 1 && dy === 0) return false;
    const yHit = me.y + dy * run;
    const off = yHit - cy;
    if ((off < 0 ? -off : off) >= half) continue;
    const ux = dy === 0 ? attack : attack * INV_SQRT2;
    const uy = dy === 0 ? 0 : dy * INV_SQRT2;
    if (laneBlocked(players, team, ball.x, ball.y, ux, uy, SHOT_LANE_LENGTH, SHOT_LANE_RADIUS, match.stepCount)) continue;
    let t = (dGoal - SHOT_TAP_DIST) / (SHOT_RANGE - SHOT_TAP_DIST);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    let charge = Math.round(SHOT_CHARGE_STEPS * t);
    if (charge < 1) charge = 1;
    startPlan(state, 'shoot', charge, attack, dy);
    return true;
  }
  return false;
}

// Branch 2: the best (advance + freedom) mate the engine's own aim assist would
// lock onto for each d-pad direction and length, with a clear lane, more advanced
// or freer than me. Returns true when a pass plan started.
function tryPass(match: MatchState, team: 0 | 1, me: PlayerState, state: AiState, myFreedom: number): boolean {
  const { players, ball } = match;
  const attack = match.attackDir[team];
  let bestScore = -Infinity;
  let bestDir = -1;
  let bestLong = false;
  for (let d = 0; d < DIRS.length; d++) {
    const dir = DIRS[d];
    for (let l = 0; l < 2; l++) {
      const long = l === 1;
      const id = pickPassTarget(me, players, dir.ux, dir.uy, long, match.stepCount);
      if (id === -1) continue;
      const mate = players[id];
      const dm = dist(me.x, me.y, mate.x, mate.y);
      if (long ? dm < LONG_PASS_MIN_DIST : dm >= LONG_PASS_MIN_DIST) continue;
      if (!normalizeInto(state.dir, mate.x - ball.x, mate.y - ball.y)) continue;
      if (laneBlocked(players, team, ball.x, ball.y, state.dir.x, state.dir.y, dm, PASS_LANE_RADIUS, match.stepCount)) continue;
      const advance = (mate.x - me.x) * attack;
      const freedom = nearestRivalDist(players, team, mate.x, mate.y, match.stepCount);
      if (advance <= 0 && freedom <= myFreedom) continue;
      const score = advance + freedom;
      if (score > bestScore) {   // strict: ties keep the lowest DIRS index (a mate on an axis also sits on the edge of two diagonal cones)
        bestScore = score;
        bestDir = d;
        bestLong = long;
      }
    }
  }
  if (bestDir === -1) return false;
  startPlan(state, bestLong ? 'long-pass' : 'short-pass', bestLong ? LONG_PASS_HOLD_STEPS : 1, DIRS[bestDir].dx, DIRS[bestDir].dy);
  return true;
}

// Branch 3 (and 2b): carry towards the goal centre, dodging the nearest rival.
function carry(match: MatchState, team: 0 | 1, me: PlayerState, state: AiState, rivalId: number, rivalDist: number, fullDodge: boolean): void {
  const { players, pitch } = match;
  const attack = match.attackDir[team];
  const goalX = goalLineX(pitch, attack === 1 ? 1 : 0);
  const cy = centerY(pitch);
  normalizeInto(state.dir, goalX - me.x, cy - me.y);
  let vx = state.dir.x;
  let vy = state.dir.y;
  if (rivalId !== -1 && rivalDist < DODGE_DIST) {
    const q = players[rivalId];
    if (normalizeInto(state.dir, q.x - me.x, q.y - me.y)) {
      const w = fullDodge ? 1 : 1 - rivalDist / DODGE_DIST;
      vx -= state.dir.x * w;
      vy -= state.dir.y * w;
    }
  }
  quantizeDir(vx, vy, state.quant);
  if (state.quant.dx === 0 && state.quant.dy === 0) {
    state.quant.dx = attack;
  }
  startPlan(state, 'carry', 0, state.quant.dx, state.quant.dy);
  const d = DIRS[dirIndex(state.quant.dx, state.quant.dy)];
  state.sprint = !laneBlocked(players, team, me.x, me.y, d.ux, d.uy, SPRINT_FREE_DIST, SPRINT_LANE_RADIUS, match.stepCount);
}

function dirIndex(dx: Axis, dy: Axis): number {
  for (let i = 0; i < DIRS.length; i++) if (DIRS[i].dx === dx && DIRS[i].dy === dy) return i;
  return 0;
}

function decideWithBall(match: MatchState, team: 0 | 1, me: PlayerState, state: AiState): void {
  const rivalId = nearestRival(match.players, team, me.x, me.y, match.stepCount);
  const rivalDist = rivalId === -1 ? Infinity : dist(me.x, me.y, match.players[rivalId].x, match.players[rivalId].y);
  if (tryShoot(match, team, me, state)) return;
  if (rivalDist < PRESSURE_DIST) {
    if (tryPass(match, team, me, state, rivalDist)) return;
    carry(match, team, me, state, rivalId, rivalDist, true);
    return;
  }
  carry(match, team, me, state, rivalId, rivalDist, false);
}

// Turns the plan into this step's buttons: pressed → held × planStepsLeft → released.
function executePlan(state: AiState, stepCount: number, out: TeamInput): void {
  out.dx = state.aimDx;
  out.dy = state.aimDy;
  if (state.plan === 'carry') {
    out.c = state.sprint ? 'held' : 'up';
    return;
  }
  const button = state.plan === 'shoot' ? 'a' : 'b';
  if (!state.planPressed) {
    state.planPressed = true;
    state.planStepsLeft--;
    out[button] = 'pressed';
    return;
  }
  if (state.planStepsLeft > 0) {
    state.planStepsLeft--;
    out[button] = 'held';
    return;
  }
  out[button] = 'released';
  state.plan = 'none';
  state.nextDecisionStep = stepCount + 1;
}

function chase(match: MatchState, team: 0 | 1, me: PlayerState, profile: AiProfile, state: AiState, rng: Rng, out: TeamInput): void {
  const { players, ball } = match;
  out.dx = toAxis(ball.x - me.x, CHASE_DEAD_ZONE);
  out.dy = toAxis(ball.y - me.y, CHASE_DEAD_ZONE);
  const d = dist(me.x, me.y, ball.x, ball.y);
  out.c = d > SPRINT_FREE_DIST ? 'held' : 'up';
  if (match.stepCount < state.nextDecisionStep) return;
  state.nextDecisionStep = match.stepCount + profile.reactionSteps;
  if (ball.owner === null) return;
  const owner = players[ball.owner];
  if (owner.team === team || owner.role === 'gk') return;
  const dO = dist(me.x, me.y, owner.x, owner.y);
  if (dO < STEAL_RANGE) {
    out.b = 'pressed';
    return;
  }
  if (dO >= TACKLE_DIST) return;
  // Stage B assumption S14b, not in the spec — review in QA: slide only from the FRONT
  // (a slide from behind is a foul by construction). D2 fixes the willingness, not this.
  const inFront = (me.x - owner.x) * owner.facingX + (me.y - owner.y) * owner.facingY > 0;
  if (!inFront) return;
  // tackleChance is the WILLINGNESS to slide at reach on each reaction tick; the
  // outcome stays geometric (stepTackle) and steals keep STEAL_CHANCE for both
  // teams. // confirmed by owner 2026-09-05 (D2, S14)
  if (rng() < profile.tackleChance) out.a = 'pressed';
}

export function decideTeamInput(match: MatchState, team: 0 | 1, profile: AiProfile, state: AiState, rng: Rng, out: TeamInput): void {
  neutralInput(out);
  out.formation = match.formationIndex[team];
  if (match.stepCount >= state.nextStrategyStep) {
    state.strategy = chooseStrategy(match.score, team, match.half, match.halfStep);
    state.nextStrategyStep = match.stepCount + STRATEGY_REVIEW_STEPS;
  }
  out.strategy = state.strategy;
  const phase = match.phase;
  if (phase === 'kickoff' || phase === 'set-piece') {
    state.plan = 'none';
    const sp = match.setPiece;
    if (sp !== null && sp.kind === 'penalty' && sp.team === team) {
      if (!state.penaltyChosen) {
        state.penaltyChosen = true;
        const r = rng();
        state.penaltySide = r < 1 / 3 ? -1 : r < 2 / 3 ? 0 : 1;
      }
      out.dy = state.penaltySide;
    }
    return;
  }
  state.penaltyChosen = false;
  if (phase !== 'play' && phase !== 'golden-goal') {
    state.plan = 'none';
    return;
  }
  const { players, ball } = match;
  const me = players[match.controlled[team]];
  if (isPlayerDown(me, match.stepCount) || me.tackleStepsLeft > 0) {
    state.plan = 'none';
    return;
  }
  if (ball.owner === me.id) {
    if (state.plan === 'none' || (state.plan === 'carry' && match.stepCount >= state.nextDecisionStep)) {
      decideWithBall(match, team, me, state);
      state.nextDecisionStep = match.stepCount + profile.reactionSteps;
    }
    executePlan(state, match.stepCount, out);
    return;
  }
  state.plan = 'none';
  if (ball.owner !== null && players[ball.owner].team === team) {
    // A same-team owner that is not `me` can only be our keeper (updateControlled
    // hands the cursor to any outfield owner). D4: the engine routes this TeamInput
    // to the keeper's throw; the CPU never presses, so neutral input = the
    // automatic release at GK_HOLD_STEPS, and positionTeam places the field
    // controlled meanwhile. // confirmed by owner 2026-09-05 (D4, S17)
    return;
  }
  chase(match, team, me, profile, state, rng, out);
}
```
> `toAxis` se importa de `./input`; `anchorFor` ya no hace falta en la capa de decisión (sigue en `positionTeam`): quitarlo del import de 6b si `tsc` avisa. `decideTeamInput` no crea nada: `state.dir` y `state.quant` son los dos scratch creados en `createAiState`. La única tirada de `rng` con balón es ninguna; sin balón, la de la entrada; en el penalti, la del lado; con el portero propio en posesión, ninguna.

Run: `npx vitest run components/games/football-logic/ai.test.ts` → PASS. Los fixtures que no cuadren se miden y se mueven (regla del Step 4).

- [ ] **Step 6: Test que falla — el partido CPU vs CPU grabado y determinista (criterio 1 sobre la IA, tests a, c, e)**

```ts
// ai.test.ts — añadir
type CpuStats = {
  steps: number; score: [number, number]; phases: Set<MatchPhase>;
  shots: number; shortPasses: number; longPasses: number; tackles: number; steals: number;
  catches: number; releases: number; strategies: Set<string>; invalid: number;
  keeperOutsideBox: number; keeperLeftLineOutsideSmallArea: number; keeperLeftLine: number;
};
type CpuMatch = { match: MatchState; recorded: [TeamInput, TeamInput][]; stats: CpuStats };

const CPU_CAP = 4 * HALF_STEPS;

// Team t defends side (attackDir === 1 ? 0 : 1); its keeper's line x is GK_LINE_DIST off that goal line.
function keeperLineDist(m: MatchState, t: 0 | 1): number {
  const gk = m.players[t * 9];
  const side = m.attackDir[t] === 1 ? 0 : 1;
  const lineX = goalLineX(PITCH, side) + m.attackDir[t] * GK_LINE_DIST;
  return Math.abs(gk.x - lineX);
}

function playCpuMatch(seed: number, formationTable: readonly Formation[], fi: readonly [number, number], difficulty: readonly [number, number] = [8, 8], cap = CPU_CAP): CpuMatch {
  const profiles: [AiProfile, AiProfile] = [profileFor(TEAMS[0], difficulty[0]), profileFor(TEAMS[1], difficulty[1])];
  const match = createMatch([TEAMS[0], TEAMS[1]], formationTable, PITCH, profiles);
  const matchRng = createRng(seed);
  const aiRng = createRng(seed ^ 0x5bd1e995);   // the CPU's own stream, never the match's
  const states: [AiState, AiState] = [createAiState(), createAiState()];
  const live: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
  const recorded: [TeamInput, TeamInput][] = [];
  const stats: CpuStats = {
    steps: 0, score: [0, 0], phases: new Set(), shots: 0, shortPasses: 0, longPasses: 0, tackles: 0, steals: 0,
    catches: 0, releases: 0, strategies: new Set(), invalid: 0,
    keeperOutsideBox: 0, keeperLeftLineOutsideSmallArea: 0, keeperLeftLine: 0,
  };
  const prevLine: [number, number] = [0, 0];
  let prevOpen = false;
  while (match.phase !== 'over' && stats.steps < cap) {
    for (const t of [0, 1] as const) {
      decideTeamInput(match, t, profiles[t], states[t], aiRng, live[t]);
      live[t].formation = fi[t];   // the formation choice is the test's (S18: the CPU keeps whatever it is given)
      if (checkTeamInput(live[t], formationTable.length).length > 0) stats.invalid++;
      stats.strategies.add(`${t}:${live[t].strategy}`);
    }
    const frame: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    copyTeamInput(live[0], frame[0]);
    copyTeamInput(live[1], frame[1]);
    recorded.push(frame);
    const open = match.phase === 'play' || match.phase === 'golden-goal';
    stepMatch(match, live, matchRng);
    stats.phases.add(match.phase);
    for (const ev of match.scratch.events) {
      if (ev.kind === 'shot' && ev.ok) stats.shots++;
      if (ev.kind === 'short-pass' && ev.ok) stats.shortPasses++;
      if (ev.kind === 'long-pass' && ev.ok) stats.longPasses++;
      if (ev.kind === 'tackle') stats.tackles++;
      if (ev.kind === 'steal') stats.steals++;
      // D4: each keeper writes its own slot (events[gk.id]); the CPU never throws by
      // button, so every hold ends in a 'gk-release' unless a phase change cuts it.
      if (ev.kind === 'gk-catch') stats.catches++;
      if (ev.kind === 'gk-release') stats.releases++;
    }
    if (checkGoalkeepersInBox(match.players, match.attackDir, match.pitch).length > 0) stats.keeperOutsideBox++;
    // Criterion 9b's second half: during open play (this step and the last, so a
    // set-piece push does not count), a keeper moving AWAY from its line does so
    // only inside its small area.
    for (const t of [0, 1] as const) {
      const off = keeperLineDist(match, t);
      if (open && prevOpen && off > prevLine[t] + 1e-9) {
        stats.keeperLeftLine++;
        const gk = match.players[t * 9];
        const side = match.attackDir[t] === 1 ? 0 : 1;
        if (!isInsideSmallArea(PITCH, side, gk.x, gk.y)) stats.keeperLeftLineOutsideSmallArea++;
      }
      prevLine[t] = off;
    }
    prevOpen = open;
    stats.steps++;
  }
  stats.score = [match.score[0], match.score[1]];
  return { match, recorded, stats };
}

function replay(seed: number, formationTable: readonly Formation[], recorded: readonly [TeamInput, TeamInput][], difficulty: readonly [number, number] = [8, 8]): MatchState {
  const m = createMatch([TEAMS[0], TEAMS[1]], formationTable, PITCH, [profileFor(TEAMS[0], difficulty[0]), profileFor(TEAMS[1], difficulty[1])]);
  const rng = createRng(seed);
  for (const frame of recorded) stepMatch(m, frame, rng);
  return m;
}

// Field-by-field, like sameMatch in match.test.ts but on what a spectator sees.
function sameFinal(a: MatchState, b: MatchState): boolean {
  if (a.phase !== b.phase || a.stepCount !== b.stepCount || a.half !== b.half) return false;
  if (a.score[0] !== b.score[0] || a.score[1] !== b.score[1]) return false;
  if (a.ball.x !== b.ball.x || a.ball.y !== b.ball.y || a.ball.owner !== b.ball.owner) return false;
  for (let i = 0; i < a.players.length; i++) {
    if (a.players[i].x !== b.players[i].x || a.players[i].y !== b.players[i].y) return false;
  }
  return true;
}

const ALL_PHASES: readonly MatchPhase[] = ['kickoff', 'play', 'set-piece', 'goal', 'half-time', 'golden-goal', 'over'];

describe('CPU vs CPU: a recorded, deterministic full match that exercises the whole AI (criteria 1, 9b, 12 and the never-invalid input)', () => {
  const SEED = 7;
  const game = playCpuMatch(SEED, FORMATIONS, [0, 0]);
  it('ends, scores, and actually shoots, passes short and long, slides, steals, and the keepers catch and release', () => {
    const s = game.stats;
    expect(game.match.phase).toBe('over');
    expect(s.score[0] + s.score[1]).toBeGreaterThanOrEqual(1);
    expect(s.shots).toBeGreaterThanOrEqual(3);
    expect(s.shortPasses).toBeGreaterThanOrEqual(3);
    expect(s.longPasses).toBeGreaterThanOrEqual(1);
    expect(s.tackles).toBeGreaterThanOrEqual(1);
    expect(s.steals).toBeGreaterThanOrEqual(1);
    expect(s.releases + s.catches).toBeGreaterThanOrEqual(1);
    expect(s.phases.has('set-piece')).toBe(true);
    expect(s.phases.has('goal')).toBe(true);
    // Measured once and reported in the task report (steps, score, counts); never tuned here.
  });
  it('(a) never produced an invalid TeamInput in the whole match', () => {
    expect(game.stats.invalid).toBe(0);
  });
  it('(c) the keepers never left their box, and only moved off their line inside the small area', () => {
    expect(game.stats.keeperOutsideBox).toBe(0);
    expect(game.stats.keeperLeftLineOutsideSmallArea).toBe(0);
    // keeperLeftLine is reported, not asserted: whether a loose ball reaches a small
    // area in this seed is a measurement (probe P3 of the closing checks it over 20 seeds).
  });
  it('(e) the same seed replays to the same score and the same final positions; a different seed does not', () => {
    const again = playCpuMatch(SEED, FORMATIONS, [0, 0]);
    expect(sameFinal(game.match, again.match)).toBe(true);
    const replayed = replay(SEED, FORMATIONS, game.recorded);        // engine only: no AI, no AI rng
    expect(sameFinal(game.match, replayed)).toBe(true);
    const other = playCpuMatch(SEED + 1, FORMATIONS, [0, 0]);
    expect(sameFinal(game.match, other.match)).toBe(false);
  });
  it('(a, fuzz) twelve more seeds, 900 steps each: no invalid input, no keeper out of its box', () => {
    for (let seed = 100; seed < 112; seed++) {
      const g = playCpuMatch(seed, FORMATIONS, [0, 0], [8, 8], 900);
      expect(g.stats.invalid).toBe(0);
      expect(g.stats.keeperOutsideBox).toBe(0);
    }
  });
  it('(b, end to end) level 8 vs level 1 over three seeds: the harder side scores at least as many goals in total', () => {
    let hardGoals = 0;
    let easyGoals = 0;
    for (const seed of [21, 22, 23]) {
      const g = playCpuMatch(seed, FORMATIONS, [0, 0], [8, 1]);
      hardGoals += g.stats.score[0];
      easyGoals += g.stats.score[1];
    }
    expect(hardGoals).toBeGreaterThanOrEqual(easyGoals);
  });
});
```
> El último `it` es una **sonda de tendencia**, no un teorema: si en las tres semillas el nivel 1 marca más que el 8, es una señal para el QA (Task 11), y el test debe quedar en rojo para que se investigue, no relajarse. Si el implementador lo considera frágil, lo pasa a la sección "Cierre" como sonda del scratchpad y lo dice en el informe.

Run: `npx vitest run components/games/football-logic/ai.test.ts` → debe pasar con el `decideTeamInput` del Step 5. Si alguna cuenta (`longPasses`, `steals`, `catches + releases`) sale 0: **medir** con la sonda del cierre por qué la rama no se alcanza (p. ej. `LONG_PASS_MIN_DIST` nunca se supera con carril libre) y **reportarlo**; no bajar el umbral sin explicación escrita.

- [ ] **Step 7: Verificación de la Task 6b**

Run: `npx vitest run` → verde (≈ 6a + ~31, contando el `it` de umbrales de H7). Recorrer `grep -n "^export" components/games/football-logic/ai.ts`: los ocho umbrales y `AiPlan` tienen ya consumidor en `ai.test.ts` (Step 4). `npx tsc --noEmit` limpio. Grep de determinismo vacío. El partido CPU vs CPU debe correr por debajo de **1,5 s** (semilla principal + 12 de fuzz + 3 de tendencia ≈ 16 partidos); si tarda más, revisar que `tryPass` (8 direcciones × 2 largos × `pickPassTarget` × `laneBlocked`) solo corre en la puerta de reacción y no cada paso. Reportar las mediciones del partido principal (pasos, marcador, chuts, pases, entradas, robos, atajadas, estrategias vistas).

- [ ] **Step 8: Propose commit**

`feat(world-cup): CPU decision layer — shoot/pass/carry tree, chase and defensive actions by reaction, scoreboard strategy, and the recorded CPU-vs-CPU determinism test`

---

## Task 7: El contenido — las 16 selecciones y las 3 formaciones, con la red cerrándose sobre los datos reales

**Files:**
- Modify: `components/games/football-logic/teams.ts:25-42`
- Modify: `components/games/football-logic/invariants.ts:31-32` (CARRY #1)
- Modify (des-exportar, Step 9): `players.ts`, `ball.ts`, `actions.ts`, `match.ts`
- Test: `components/games/football-logic/teams.test.ts` (reescrito entero), `players.test.ts`, `set-pieces.test.ts`, `ai.test.ts`, `match.test.ts`

**Interfaces:**
- Consumes: `checkBank`, `checkFormations`, `checkFormation`, `checkTeam`, `checkGoalkeepersInBox` (`invariants.ts`); `createPlayers`, `placeByFormation` (`players.ts`); `createMatch`, `stepMatch`, `resumePlay` (`match.ts`); `playCpuMatch`, `sameFinal`, `replay` (helpers de `ai.test.ts`, Task 6b); `BANK_SIZE = 16`, `FORMATION_COUNT = 3`, `OUTFIELD = 8`, `STRATEGY_SHIFT = 0.12`.
- Produces:

```ts
// teams.ts
export const FORMATIONS: readonly Formation[];   // [0] '3-3-2' NORMAL (intacta), [1] '3-2-3' OFENSIVA, [2] '4-3-1' DEFENSIVA
export const TEAMS: readonly TeamDef[];          // 16, ESPAÑA e ITALIA primero e intactas; ids kebab, nombres en mayúsculas
```

**Regla de oro de esta tarea:** la 3-3-2 y las dos selecciones existentes **no cambian ni una coma** (mismo índice 0, mismos ocho slots, mismos ids/nombres/colores). Así, todos los tests acoplados a la 3-3-2 que lista el informe (`match.test.ts` N1 y partido grabado, `set-pieces.test.ts:59` `takerId 5`, `step.test.ts` `KICK_TARGET_ID 7`, `match.test.ts` test de clobbering, `players.test.ts` 3 def / 2 fwd) siguen verdes **sin tocarlos**; esta tarea solo **amplía** con las dos formaciones nuevas. Si al añadir contenido salta un invariante, se corrige el **contenido**, nunca el invariante.

### Los datos

Formaciones (fracciones del campo para el equipo que ataca hacia +x; toda `x` en (0.12, 0.88) para sobrevivir al desplazamiento ±0.12; ninguna posición repetida; `id` = recuento real de `def-mid-fwd`):

| id | name | slots (role, x, y) |
|---|---|---|
| `3-3-2` | `NORMAL` | intacta de la etapa A |
| `3-2-3` | `OFENSIVA` | def (0.22, 0.25) (0.22, 0.5) (0.22, 0.75) · mid (0.45, 0.35) (0.45, 0.65) · fwd (0.7, 0.2) (0.7, 0.5) (0.7, 0.8) |
| `4-3-1` | `DEFENSIVA` | def (0.2, 0.15) (0.2, 0.38) (0.2, 0.62) (0.2, 0.85) · mid (0.42, 0.25) (0.42, 0.5) (0.42, 0.75) · fwd (0.68, 0.5) |

Selecciones (16; iguales en el campo, distintas en nombre y equipación; pares `primary|secondary` únicos; `primary !== secondary`; las tres "inconfundibles" del spec: Italia azul, España roja, Brasil amarilla):

| id | name | primary | secondary |
|---|---|---|---|
| `espana` | `ESPAÑA` | `#d40000` | `#ffcc00` |
| `italia` | `ITALIA` | `#0044aa` | `#ffffff` |
| `brasil` | `BRASIL` | `#ffdf00` | `#009c3b` |
| `argentina` | `ARGENTINA` | `#75aadb` | `#ffffff` |
| `alemania` | `ALEMANIA` | `#ffffff` | `#000000` |
| `francia` | `FRANCIA` | `#002395` | `#ffffff` |
| `inglaterra` | `INGLATERRA` | `#ffffff` | `#cf081f` |
| `portugal` | `PORTUGAL` | `#e42518` | `#006600` |
| `paises-bajos` | `PAÍSES BAJOS` | `#ff7f00` | `#ffffff` |
| `belgica` | `BÉLGICA` | `#e30613` | `#000000` |
| `croacia` | `CROACIA` | `#ff0000` | `#ffffff` |
| `uruguay` | `URUGUAY` | `#7ec0ee` | `#000000` |
| `mexico` | `MÉXICO` | `#006847` | `#ffffff` |
| `japon` | `JAPÓN` | `#1b2f7a` | `#ffffff` |
| `marruecos` | `MARRUECOS` | `#c1272d` | `#006233` |
| `estados-unidos` | `ESTADOS UNIDOS` | `#ffffff` | `#0a3161` |

- [ ] **Step 1: Reescribir `teams.test.ts` entero (test que falla: 2 selecciones y 1 formación no pasan `checkBank`/`checkFormations`)**

```ts
// components/games/football-logic/teams.test.ts
import { describe, expect, it } from 'vitest';
import {
  BANK_SIZE, FORMATIONS, FORMATION_COUNT, OUTFIELD, STRATEGIES, STRATEGY_SHIFT, TEAMS, TEAM_SIZE, slotCounts, teamById,
  type Formation, type Strategy,
} from './teams';
import { checkBank, checkFormation, checkFormations, checkGoalkeepersInBox, checkTeam } from './invariants';
import { PITCH } from './pitch';
import { createPlayers, placeByFormation } from './players';

// The stage-A 3-3-2, byte for byte: every test the final review lists as coupled
// to this geometry (N1 clock traces, takerId 5, KICK_TARGET_ID 7, ...) depends on
// it staying exactly here, at index 0.
const STAGE_A_332: Formation = {
  id: '3-3-2',
  name: 'NORMAL',
  slots: [
    { role: 'def', x: 0.22, y: 0.25 }, { role: 'def', x: 0.22, y: 0.5 }, { role: 'def', x: 0.22, y: 0.75 },
    { role: 'mid', x: 0.45, y: 0.25 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.75 },
    { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
  ],
};

describe('the bank of sixteen selections (spec step 7): the net closes on the real content, first time', () => {
  it('checkBank accepts TEAMS: sixteen, unique ids, unique kits, every one legal', () => {
    expect(checkBank(TEAMS)).toEqual([]);
    expect(TEAMS).toHaveLength(BANK_SIZE);
    expect(BANK_SIZE).toBe(16);
  });
  it('every team individually passes checkTeam (so a failure names the offender)', () => {
    for (const t of TEAMS) expect({ id: t.id, problems: checkTeam(t) }).toEqual({ id: t.id, problems: [] });
  });
  it('names are Spanish, upper case, and the three unmistakable kits of the spec are there', () => {
    for (const t of TEAMS) {
      expect(t.name).toBe(t.name.toUpperCase());
      expect(t.name).not.toMatch(/[a-z]/);
      expect(t.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
    expect(teamById(TEAMS, 'espana')).toMatchObject({ name: 'ESPAÑA', kit: { primary: '#d40000' } });
    expect(teamById(TEAMS, 'italia')).toMatchObject({ name: 'ITALIA', kit: { primary: '#0044aa' } });
    expect(teamById(TEAMS, 'brasil')).toMatchObject({ name: 'BRASIL', kit: { primary: '#ffdf00' } });
    expect(teamById(TEAMS, 'atlantis')).toBeUndefined();
  });
  it('the two stage-A teams keep their index, id, name and kit', () => {
    expect(TEAMS[0]).toEqual({ id: 'espana', name: 'ESPAÑA', kit: { primary: '#d40000', secondary: '#ffcc00' } });
    expect(TEAMS[1]).toEqual({ id: 'italia', name: 'ITALIA', kit: { primary: '#0044aa', secondary: '#ffffff' } });
  });
  it('selections are identical on the pitch in v1: a TeamDef carries only id, name and kit', () => {
    for (const t of TEAMS) expect(Object.keys(t).sort()).toEqual(['id', 'kit', 'name']);
  });
});

describe('the three formations', () => {
  it('checkFormations accepts FORMATIONS: exactly three, unique ids, every one legal', () => {
    expect(checkFormations(FORMATIONS)).toEqual([]);
    expect(FORMATIONS).toHaveLength(FORMATION_COUNT);
    for (const f of FORMATIONS) expect({ id: f.id, problems: checkFormation(f) }).toEqual({ id: f.id, problems: [] });
  });
  it('are the 3-3-2 NORMAL, 3-2-3 OFENSIVA and 4-3-1 DEFENSIVA of the spec, in that order, with matching slot counts', () => {
    expect(FORMATIONS.map((f) => [f.id, f.name, ...slotCounts(f)])).toEqual([
      ['3-3-2', 'NORMAL', 3, 3, 2],
      ['3-2-3', 'OFENSIVA', 3, 2, 3],
      ['4-3-1', 'DEFENSIVA', 4, 3, 1],
    ]);
  });
  it('the 3-3-2 is the stage-A one, byte for byte, at index 0', () => {
    expect(FORMATIONS[0]).toEqual(STAGE_A_332);
  });
  it('every slot of every formation survives both strategy shifts inside the pitch', () => {
    for (const f of FORMATIONS) {
      for (const s of f.slots) {
        expect(s.x + STRATEGY_SHIFT).toBeLessThan(1);
        expect(s.x - STRATEGY_SHIFT).toBeGreaterThan(0);
        expect(s.y).toBeGreaterThan(0);
        expect(s.y).toBeLessThan(1);
      }
    }
  });
  it('team size is nine: eight outfield plus the goalkeeper; strategies shift by ±STRATEGY_SHIFT', () => {
    expect(TEAM_SIZE).toBe(OUTFIELD + 1);
    expect(OUTFIELD).toBe(8);
    expect(STRATEGIES.attack).toBe(STRATEGY_SHIFT);
    expect(STRATEGIES.defend).toBe(-STRATEGY_SHIFT);
    expect(STRATEGIES.neutral).toBe(0);
  });
});

describe('every formation × formation × strategy × strategy × end combination places a legal team', () => {
  const STRATS: readonly Strategy[] = ['attack', 'neutral', 'defend'];
  it('outfield players inside the pitch, no two teammates on the same point, keepers in their box (81 placements × 2 ends)', () => {
    let placements = 0;
    for (const f0 of FORMATIONS) {
      for (const f1 of FORMATIONS) {
        const players = createPlayers([f0, f1], PITCH);
        for (const s0 of STRATS) {
          for (const s1 of STRATS) {
            for (const attack of [[1, -1], [-1, 1]] as const) {
              placeByFormation(players, 0, f0, s0, attack[0], PITCH);
              placeByFormation(players, 1, f1, s1, attack[1], PITCH);
              expect(checkGoalkeepersInBox(players, attack, PITCH)).toEqual([]);
              for (const p of players) {
                expect(p.x).toBeGreaterThan(0);
                expect(p.x).toBeLessThan(PITCH.width);
                expect(p.y).toBeGreaterThan(0);
                expect(p.y).toBeLessThan(PITCH.height);
              }
              for (let i = 0; i < players.length; i++) {
                for (let j = i + 1; j < players.length; j++) {
                  if (players[i].team !== players[j].team) continue;
                  expect(players[i].x !== players[j].x || players[i].y !== players[j].y).toBe(true);
                }
              }
              placements++;
            }
          }
        }
      }
    }
    expect(placements).toBe(3 * 3 * 3 * 3 * 2);
  });
});
```
Run: `npx vitest run components/games/football-logic/teams.test.ts` → FAIL (`bank size 2`, `formation count 1`).

- [ ] **Step 2: Publicar el contenido en `teams.ts`**

Sustituir el bloque de `FORMATIONS` (dejando la 3-3-2 exactamente como está) y el de `TEAMS`:

```ts
// The three line-ups of the spec. 3-3-2 is the stage-A one, untouched: several
// tests are coupled to its exact geometry (see the final review of stage A).
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
  {
    id: '3-2-3',
    name: 'OFENSIVA',
    slots: [
      { role: 'def', x: 0.22, y: 0.25 }, { role: 'def', x: 0.22, y: 0.5 }, { role: 'def', x: 0.22, y: 0.75 },
      { role: 'mid', x: 0.45, y: 0.35 }, { role: 'mid', x: 0.45, y: 0.65 },
      { role: 'fwd', x: 0.7, y: 0.2 }, { role: 'fwd', x: 0.7, y: 0.5 }, { role: 'fwd', x: 0.7, y: 0.8 },
    ],
  },
  {
    id: '4-3-1',
    name: 'DEFENSIVA',
    slots: [
      { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
      { role: 'mid', x: 0.42, y: 0.25 }, { role: 'mid', x: 0.42, y: 0.5 }, { role: 'mid', x: 0.42, y: 0.75 },
      { role: 'fwd', x: 0.68, y: 0.5 },
    ],
  },
];

// The bank of sixteen: identical on the pitch in v1, different in name and kit.
export const TEAMS: readonly TeamDef[] = [
  { id: 'espana', name: 'ESPAÑA', kit: { primary: '#d40000', secondary: '#ffcc00' } },
  { id: 'italia', name: 'ITALIA', kit: { primary: '#0044aa', secondary: '#ffffff' } },
  { id: 'brasil', name: 'BRASIL', kit: { primary: '#ffdf00', secondary: '#009c3b' } },
  { id: 'argentina', name: 'ARGENTINA', kit: { primary: '#75aadb', secondary: '#ffffff' } },
  { id: 'alemania', name: 'ALEMANIA', kit: { primary: '#ffffff', secondary: '#000000' } },
  { id: 'francia', name: 'FRANCIA', kit: { primary: '#002395', secondary: '#ffffff' } },
  { id: 'inglaterra', name: 'INGLATERRA', kit: { primary: '#ffffff', secondary: '#cf081f' } },
  { id: 'portugal', name: 'PORTUGAL', kit: { primary: '#e42518', secondary: '#006600' } },
  { id: 'paises-bajos', name: 'PAÍSES BAJOS', kit: { primary: '#ff7f00', secondary: '#ffffff' } },
  { id: 'belgica', name: 'BÉLGICA', kit: { primary: '#e30613', secondary: '#000000' } },
  { id: 'croacia', name: 'CROACIA', kit: { primary: '#ff0000', secondary: '#ffffff' } },
  { id: 'uruguay', name: 'URUGUAY', kit: { primary: '#7ec0ee', secondary: '#000000' } },
  { id: 'mexico', name: 'MÉXICO', kit: { primary: '#006847', secondary: '#ffffff' } },
  { id: 'japon', name: 'JAPÓN', kit: { primary: '#1b2f7a', secondary: '#ffffff' } },
  { id: 'marruecos', name: 'MARRUECOS', kit: { primary: '#c1272d', secondary: '#006233' } },
  { id: 'estados-unidos', name: 'ESTADOS UNIDOS', kit: { primary: '#ffffff', secondary: '#0a3161' } },
];
```
Quitar los dos comentarios "Task 1 publishes only…" que quedan obsoletos.

Run: `npx vitest run components/games/football-logic/teams.test.ts` → **PASS a la primera** (spec: "debe pasar a la primera, como en Vault Fighter"). Si no pasa a la primera, el informe de la tarea lo dice y explica qué dato se corrigió.

- [ ] **Step 3: CARRY #1 — `checkFormation` sin el cast**

```ts
// invariants.ts — importar Role: import { ..., type Role, ... } from './teams';
  f.slots.forEach((s, i) => {
    const role: Role = s.role;   // the table is data: a 'gk' can be smuggled in despite OutfieldRole
    if (role === 'gk') problems.push('goalkeeper in formation');
```
Run: `npx vitest run components/games/football-logic/invariants.test.ts` → PASS (el negativo "rejects a goalkeeper smuggled into the slots" sigue rojo-verde igual: comprobar por mutación borrando la línea del `push`).

- [ ] **Step 4: Ampliar `players.test.ts` — roles por formación**

```ts
// players.test.ts — añadir en describe('createPlayers')
  it('every published formation gives its team exactly the roles its slots say, in slot order', () => {
    for (const f of FORMATIONS) {
      const ps = createPlayers([f, f], PITCH);
      const [def, mid, fwd] = slotCounts(f);
      for (const team of [0, 1] as const) {
        const mine = ps.filter((p) => p.team === team && p.role !== 'gk');
        expect(mine.filter((p) => p.role === 'def')).toHaveLength(def);
        expect(mine.filter((p) => p.role === 'mid')).toHaveLength(mid);
        expect(mine.filter((p) => p.role === 'fwd')).toHaveLength(fwd);
        mine.forEach((p, i) => expect([p.slot, p.role]).toEqual([i, f.slots[i].role]));
      }
    }
  });
  it('two different formations on the two sides: each team follows its own', () => {
    const ps = createPlayers([FORMATIONS[1], FORMATIONS[2]], PITCH);
    expect(ps.filter((p) => p.team === 0 && p.role === 'fwd')).toHaveLength(3);
    expect(ps.filter((p) => p.team === 1 && p.role === 'def')).toHaveLength(4);
    expect(ps[8].role).toBe('fwd');    // 3-2-3: last slot is a forward
    expect(ps[17].role).toBe('fwd');   // 4-3-1: last slot is the lone forward
    expect(ps[10].role).toBe('def');
  });
```
(importar `slotCounts` de `./teams`.) Run → PASS.

- [ ] **Step 5: Ampliar `set-pieces.test.ts` — el lanzador por formación**

```ts
// set-pieces.test.ts — añadir en describe('beginSetPiece')
  it('the kickoff taker is the outfield player nearest the centre spot in EVERY formation (ids differ, the rule does not)', () => {
    // Hand-computed (see the note below): 3-3-2 → id 5; 3-2-3 → id 5 (NOT a tie: 0.35 * 1300 is
    // 454.99999999999994, so the slot at y = 845 is 5e-14 closer); 4-3-1 → id 6.
    for (const [fi, expectedId] of [[0, 5], [1, 5], [2, 6]] as const) {
      const f = FORMATIONS[fi];
      const w = { ...world(), players: createPlayers([f, f], PITCH) };
      beginSetPiece(w.sp, 'kickoff', 0, 1000, CY, w.players, w.ball, [f, f], STRATS, ATTACK, PITCH, 0);
      expect(w.sp.takerId).toBe(expectedId);
      expect(w.players[w.sp.takerId].role).not.toBe('gk');
      let best = Infinity;
      for (let i = 1; i <= 8; i++) best = Math.min(best, dist(w.players[i].x, w.players[i].y, 1000, CY));
      expect(dist(w.players[w.sp.takerId].x, w.players[w.sp.takerId].y, 1000, CY)).toBeCloseTo(best, 6);
    }
  });
```
> **La tabla está calculada a mano** (regla anti-coincidencia), el implementador la re-comprueba: 3-3-2 → slot 4 (900, 650) a 100 u = id 5. 3-2-3 → las dos medias (ids 4 y 5) en (900, 0,35·1300) y (900, 0,65·1300), a 219,146 u de (1000, 650) las dos… pero **NO en bits iguales**: en coma flotante `0.35 * 1300 = 454.99999999999994` y `0.65 * 1300 = 845` (exacto), así que las distancias son 219,1460700081113 (id 4) y 219,14607000811125 (id 5); el slot de y = 845 está 5·10⁻¹⁴ más cerca y `nearestOutfield` (`<` estricto) devuelve **id 5**. El desempate por id NO se ejercita aquí (pre-vuelo H5); no se toca la formación (contenido aprobado) ni `nearestOutfield`. El delantero central (1400, 650) queda a 400 u. 4-3-1 → mid central slot 5 (840, 650) a 160 u = id 6. La última aserción (el elegido es el más cercano) es la que protege contra un cálculo mal hecho: si la tabla está mal, es ella la que lo dice. (importar `dist` de `./geometry`.)

Run → PASS.

- [ ] **Step 6: Ampliar `ai.test.ts` — el partido CPU vs CPU con las tres formaciones y el criterio 11 con las reales**

```ts
// ai.test.ts — añadir
describe('CPU vs CPU with every published formation (Task 7): the AI works with all three, not only the 3-3-2', () => {
  const PAIRS: readonly (readonly [number, number])[] = [[1, 1], [2, 2], [0, 2], [1, 0]];
  for (const pair of PAIRS) {
    it(`${FORMATIONS[pair[0]].id} vs ${FORMATIONS[pair[1]].id}: ends, plays the whole game, replays identically`, () => {
      const g = playCpuMatch(31, FORMATIONS, pair);
      expect(g.match.phase).toBe('over');
      expect(g.stats.invalid).toBe(0);
      expect(g.stats.keeperOutsideBox).toBe(0);
      expect(g.stats.keeperLeftLineOutsideSmallArea).toBe(0);
      expect(g.stats.shots + g.stats.shortPasses + g.stats.longPasses).toBeGreaterThanOrEqual(5);
      expect(g.stats.tackles + g.stats.steals).toBeGreaterThanOrEqual(1);
      expect(g.match.formationIndex).toEqual([pair[0], pair[1]]);
      expect(sameFinal(g.match, replay(31, FORMATIONS, g.recorded))).toBe(true);
    });
  }
});

describe('criterion 11 with the real formations: switching 3-3-2 → 4-3-1 mid-play moves the changed slots at once', () => {
  it('slot 7 (a 3-3-2 forward at 0.7) becomes a 4-3-1 forward at 0.68: it walks back on the very next step', () => {
    const m = createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
    resumePlay(m);
    const rng = createRng(1);
    const idle: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    for (let i = 0; i < 120; i++) stepMatch(m, idle, rng);
    const fwd = m.players[8];                      // slot 7
    const before = fwd.x;
    idle[0].formation = 2;
    stepMatch(m, idle, rng);
    expect(m.formationIndex[0]).toBe(2);
    expect(fwd.x).not.toBe(before);                // moved this very step (the direction depends on the drift; the move does not)
    expect(m.players[8].role).toBe('fwd');         // roles are fixed at creation (v1: slots keep their player)
  });
});
```
> Nota de diseño (para el informe, no bloqueante): al cambiar de formación en pleno partido los **roles** de `PlayerState` no cambian (se fijan en `createPlayers`); solo cambian las anclas. Un 3-3-2 → 4-3-1 mueve al slot 7 de delantero a "defensa" de posición aunque siga siendo `role: 'fwd'`. Con selecciones y jugadores idénticos en la v1 no tiene efecto en el juego; en la v1.5 (atributos) habrá que decidir si el rol sigue al slot.

Run: `npx vitest run components/games/football-logic/ai.test.ts` → PASS.

- [ ] **Step 7: `match.test.ts` — el test de "stores the formation" usa las tres reales**

Sustituir la tabla fabricada `three` por `FORMATIONS` (ya tiene tres): `const m = createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES);` y dejar `inputs[1].formation = 7` como índice fuera de tabla. Run → PASS.

- [ ] **Step 8: Suite completa, compilación y build**

Run: `npx vitest run` → verde. `npx tsc --noEmit` limpio. **`npm run build` verde** (cierra la etapa). Grep de determinismo vacío. Contar tests y ficheros (esperado: 52 ficheros).

- [ ] **Step 9: Recorrido de exportaciones (Global Constraint) — des-exportar las 11 constantes espejo**

Para cada símbolo de esta lista, `grep -rn "<símbolo>" components/games/football-logic/ --include=*.ts` debe devolver **solo su propio fichero**; entonces quitar el `export` (siguen siendo `const` del módulo): `players.ts` `SPRINT_SECONDS`, `SPRINT_COOLDOWN_SECONDS`, `TACKLE_SECONDS`; `ball.ts` `KICK_LOCK_SECONDS`, `GRAVITY`, `BALL_REST_VZ`; `actions.ts` `SHOT_CHARGE_SECONDS`, `LONG_PASS_HOLD_SECONDS`, `TACKLE_MISS_DOWN_SECONDS`, `GK_HOLD_SECONDS`; `match.ts` `GOAL_PAUSE_SECONDS`, `HALF_TIME_PAUSE_SECONDS`. Si el grep encuentra un consumidor (p. ej. un test que lo importa), se **mantiene** exportado y se anota. Dejar línea de destino en las que esperan a la etapa C: `SHOT_VZ_MAX` (QA), `SET_PIECE_COUNTDOWN_SECONDS` (HUD, Task 8), `Kit`, `ButtonState`, `ActionKind`, `PenaltySide` (Task 8). `OutfieldRole` **NO gana consumidor en esta tarea** (el Step 3 importa `Role`, no `OutfieldRole`, y `teams.test.ts` lee `slot.role` sin anotar; pre-vuelo H7): se mantiene exportado con línea de destino `// exported for v1.5 (per-role attributes) / Task 8 if the HUD paints the slot role; today only teams.ts uses it`, igual que `Kit`/`ActionKind`. Luego `npx tsc --noEmit` y `npx vitest run` de nuevo.

Recorrer también `grep -n "^export" components/games/football-logic/ai.ts`: todo con consumidor en `match.ts`, `ai.test.ts` o con destino declarado "componente (Task 8)": `decideTeamInput`, `createAiState`, `humanProfile`, `profileFor`, `AiState`, `AiProfile`.

- [ ] **Step 10: Propose commit**

`feat(world-cup): the sixteen selections and the three formations, with the invariant net closed on the real content`

---

## Cierre de la etapa B (revisión final con sondas ejecutables)

Se hace **después** de la Task 7 y antes de que Paco commitee, con la lección de la etapa A: los revisores de tarea no ven la integración; las dos Critical de la etapa A solo aparecieron con sondas.

1. **Suite completa**: `npx vitest run` → verde, cifra de tests y ficheros anotada (partida: 760/51).
2. **Compilador y build**: `npx tsc --noEmit` limpio; `npm run build` verde.
3. **Determinismo**: `grep -rn "Math.random\|Date.now\|performance.now\|Math.sin\|Math.cos\|Math.atan2\|Math.hypot" components/games/football-logic/` vacío, tests incluidos. Además `grep -rn "new Set\|new Map" components/games/football-logic/*.ts` (sin tests): solo los `has` de `invariants.ts`.
4. **Asignaciones por paso**: leer `positionTeam`, `keeperStep`, `keeperCatch`, `applyKickError`, `stepPlayerFree`, `freestMateDir`, `pickPassTarget`, `decideTeamInput` y sus privadas buscando `{`-literales de objeto, `[`-literales de array, `.map(`, `.filter(`, `...`, `new `, `=>` dentro del cuerpo. Cero.
5. **Exportaciones sin consumidor**: `grep -n "^export" components/games/football-logic/*.ts` cruzado con imports; cada símbolo con consumidor o con destino declarado (lista del Step 9 de la Task 7).
6. **Sondas ejecutables** — scripts vitest de un solo uso en el **scratchpad** (`/private/tmp/claude-501/-Users-paco-monleon-Dev-Web/<sesión>/scratchpad/wc-probes/*.test.ts`), **NUNCA dentro del repo** (vitest ejecuta cualquier `*.test.ts` bajo `.superpowers/` y las cuentas se inflan, trampa del 04-sep). Se lanzan desde el repo con `npx vitest run --root <scratchpad>/wc-probes --dir .`, importando el motor por ruta absoluta; se borran al terminar. Ese mecanismo NO está validado (pre-vuelo H10: vite-node fuera del root, resolución de `'vitest'` desde un directorio sin `node_modules`), así que la **primera** sonda es de humo y decide cómo se lanzan las demás. Cada sonda imprime sus mediciones y el informe de cierre las copia:
   - **P0 · Sonda de humo del mecanismo** (antes de escribir P1; tres minutos como mucho):
     ```ts
     // <scratchpad>/wc-probes/p0-smoke.test.ts — the engine by absolute path, nothing else
     import { describe, expect, it } from 'vitest';
     import { PITCH } from '/Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault/components/games/football-logic/pitch';
     import { FORMATIONS, TEAMS } from '/Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault/components/games/football-logic/teams';
     import { profileFor } from '/Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault/components/games/football-logic/ai';
     import { createTeamInput } from '/Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault/components/games/football-logic/input';
     import { createRng } from '/Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault/components/games/football-logic/rng';
     import { HALF_STEPS, createMatch, resumePlay, stepMatch } from '/Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault/components/games/football-logic/match';

     describe('P0 smoke: the engine resolves from outside the vite root', () => {
       it('imports match.ts by absolute path and steps one match', () => {
         expect(PITCH.width).toBe(2000);
         expect(HALF_STEPS).toBe(5400);
         const m = createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
         resumePlay(m);
         stepMatch(m, [createTeamInput(), createTeamInput()], createRng(1));
         expect(m.players.length).toBe(18);
         expect(m.phase).toBe('play');
       });
     });
     ```
     Lanzar: `cd <repo> && npx vitest run --root <scratchpad>/wc-probes --dir .` → **1 passed** y, en la misma salida, la suite del repo NO aparece (si aparece, `--root` no ha aislado nada: parar). Si P0 falla (típicamente `Failed to resolve import "vitest"` o un import fuera de `server.fs.allow`), **plan B, en este orden y sin instalar nada en el repo**:
     1. Root en el repo y config ad hoc en el scratchpad: `<scratchpad>/wc-probes/vitest.probes.config.ts` con `import { defineConfig } from 'vitest/config'; export default defineConfig({ root: '/Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault', test: { include: ['/private/tmp/claude-501/-Users-paco-monleon-Dev-Web/<sesión>/scratchpad/wc-probes/**/*.test.ts'] } });` y lanzar `npx vitest run --config <scratchpad>/wc-probes/vitest.probes.config.ts` (el `include` absoluto saca las sondas del repo; la suite del repo queda fuera porque no casa con el `include`).
     2. Si tampoco: `npx --yes tsx <scratchpad>/wc-probes/p0-smoke.ts` (mismo cuerpo sin `vitest`, con `node:assert`; `tsx` no está en `devDependencies` y **no se añade**: `npx --yes` lo trae a la caché de npm, no al repo). Las sondas P1-P6 se escriben entonces con `node:assert` y `console.log` en vez de `describe/it`.
     Sea cual sea el camino que pase, se anota en el informe de cierre y P1-P6 usan ESE camino.
   - **P1 · Partido CPU vs CPU completo con cada formación** (3 mismas + 3 cruzadas, dificultad 8 vs 8 y 5 vs 5, dos semillas): pasos, marcador, fases, chuts/pases/entradas/robos/atajadas/saques del portero por equipo, `invalid === 0`, `keeperOutsideBox === 0`. Anomalías a buscar: partidos sin goles en gol de oro más de `4 × HALF_STEPS` (riesgo 4 del spec), un equipo con 0 chuts, robos con `victimId === -1` fuera de rango, penaltis en bucle (C1 revive con IA), balón recogido fuera del campo (C2 revive con porteros móviles), y desde D4: un paso con `ball.owner === gk.id` y `phase !== 'play' | 'golden-goal'` sin que medie fin de parte o gol (la atajada nunca debe cambiar de fase), o un `'gk-catch'` que no vaya seguido de posesión del portero en ese mismo paso.
   - **P2 · Cambio de estrategia por marcador observado**: partido 8 vs 1 con marcador forzado (`match.score[1] = 1` en el paso 600, `halfStep` a 30 s del final en la 2ª parte): registrar `out.strategy` de cada equipo en cada revisión de 5 s y comprobar la secuencia neutral → attack (el que pierde) y neutral → defend (el que gana por uno, últimos 30 s) y attack para los dos en `half === 3`.
   - **P3 · El portero respeta el área**: 20 semillas × 3 000 pasos con `checkGoalkeepersInBox` en cada paso y el contador "se aleja de su línea fuera del área pequeña en juego abierto" (la métrica de `playCpuMatch`), imprimiendo el máximo `|gk.x − lineX|` visto y en qué fase.
   - **P4 · Reacción y acierto por dificultad, extremo a extremo**: 10 semillas de 8 vs 1 y 10 de 1 vs 8: goles, chuts y atajadas por nivel. Se reporta la tendencia; si el nivel 1 gana sistemáticamente, es hallazgo para el QA (Task 11), no para relajar tests.
   - **P5 · Replay puro**: para dos de los partidos de P1, grabar los `TeamInput` y re-ejecutar solo el motor con `createRng(seed)`: `sameFinal` verdadero. Es la prueba de que la capa de decisión está de verdad fuera del paso.
   - **P6 · Atajada → posesión → saque automático (D4) observado en juego**: sobre los partidos de P1, por cada `'gk-catch'` en `events[gk.id]` registrar el paso, y comprobar que en ese paso `ball.owner === gk.id` y la fase no cambia, que durante los `GK_HOLD_STEPS − 1` pasos siguientes el balón sigue del portero (o hasta un gol/fin de parte, que se cuenta aparte), y que en el paso `catchStep + GK_HOLD_STEPS` aparece `'gk-release'` del mismo portero. Imprimir: atajadas totales, cuántas acabaron en saque automático exacto, cuántas cortó una fase, y el número de veces que un rival intentó `'steal'` con `victimId === gk.id` (debe ser 0: `steal` rechaza al portero antes de fijar la víctima), y el número de `'gk-catch'` de un portero en los `KICK_LOCK_STEPS` (15) posteriores a su propio saque —botón o automático— (debe ser 0: `keeperCatch` no ataja su propio saque dentro del lock, H4; si no es 0 el portero hace malabares y todas las cuentas de atajadas/saques quedan invalidadas). **Debe verse al menos una atajada seguida de saque automático**; si en las 12 configuraciones de P1 no aparece ninguna, es hallazgo (el `catchChance` no se ejercita en juego) y se investiga, no se relaja. Además, una variante "humana": repetir un partido de P1 sustituyendo la entrada del equipo 1 por una política de test que, con su portero en posesión, pulse B en el 5.º paso de la posesión: contar los `'short-pass'` con `actorId === gk.id` (≥ 1) y comprobar que ninguno consumió `rng` (contador de tiradas igual con y sin la política en esos pasos).
7. **Comparar** el resultado de las sondas con los criterios 1, 2, 4, 5, 9b, 11, 12, 14 (motor) y con los supuestos abiertos S1, S2, S4-S8, S10-S13, S14b, S15, S16, S18 y S-GK (S3, S9, S14 y S17 ya están confirmados por D1-D4): cualquier supuesto que las sondas desmientan se anota en el informe de cierre como pregunta para Paco.
8. **Informe de cierre**: `.superpowers/sdd/2026-09-05-vault-world-cup-stage-b/final-review-report.md` (git-ignorado, mismo formato que el de la etapa A: fortalezas, cobertura de criterios, tabla de números, hallazgos por severidad, triaje de deferred con `CARRY TO Task 8/9/11`, recomendaciones para la etapa C). En él, obligatoriamente: la verificación **explícita** del criterio 11 (R19) con el test de `match.test.ts` y el de las formaciones reales; el estado de las deudas del ledger asignadas a la Task 6 (criterio 11 ✓ código; falta única por paso y robos simultáneos: documentadas sin cambio; `isSprinting` último paso: documentado sin cambio; comentario R20: corregido); la actualización del spec que toque (sección "Decisiones tomadas": los supuestos abiertos —S-GK incluido— que Paco apruebe se vuelcan como decisiones de ejecución, igual que R7/R10/R11/R14/R6).
9. **Mensaje de commit global alternativo** (si Paco prefiere uno solo para la etapa): `feat(world-cup): stage B — in-engine AI, CPU decision layer, sixteen selections and three formations`.

---

## Supuestos de la etapa (lista final para Paco)

**Confirmados el 05-sep** (etiqueta `// confirmed by owner 2026-09-05`, no van al QA como supuestos): **S3 = D1** (persecución sin posesión: los K más cercanos, el primero controlado, el siguiente cubre a 120 u, el resto ancla + deriva), **S14 = D2** (`tackleChance` = disposición a robar/entrar a alcance en cada tick de reacción; el éxito sigue el 65 %/35 % de `STEAL_CHANCE` para los dos), **S9 = D3** (`humanProfile` con la MISMA dificultad para portero y penalti; solo error angular 0), **S17 = D4** (la CPU con su portero en posesión no pulsa nada: siempre el automático).

**Abiertos** (etiqueta `// Stage B assumption, not in the spec — review in QA`): S1 (cotas del clamp), S2 (skew como rotación), S4 (separación), S5 (línea del portero), S6 (el portero solo recoge balón parado), S7 (penalización por carga lineal), S8 (dónde se aplica el error angular), S10 (balón alto), S11 (lado del penalti de la CPU), S12 (esquiva), S13 (pista libre para sprintar), **S14b (la entrada de la CPU solo de frente, `dot(me − owner, owner.facing) > 0`; D2 fija la disposición, no esto — pre-vuelo H9)**, S15 (rayo de chut), S16 (decisión en el acto al ganar el balón), S18 (la CPU no cambia de formación) y:

- **S-GK · Interpretación de ejecución de D4 (portero con balón)** — lo que D4 fija está en el spec (regla 2 y 4 del portero); lo que aquí se decide y Paco debe ver: (1) cruceta en neutro = recto hacia campo contrario, `(attackDir, 0)`, nunca el `facing` del portero; (2) solo `'pressed'` saca (una B mantenida desde un robo no saca); (3) A y B en el mismo paso → gana A (pase largo), como en `applyButtons`; (4) el saque a botón sale como pronto en el paso SIGUIENTE al de hacerse con el balón, igual para atajada y recogida (`stepCount <= ball.ownerSinceStep` → nada); (5) los saques a botón llevan eventos `'short-pass'`/`'long-pass'` con `actorId = gk.id`, el automático `'gk-release'`; los saques del portero (botón o automático) nunca consumen `rng` ni llevan error angular, para los dos equipos; (6) `match.controlled[team]` sigue en el jugador de campo mientras el portero tiene el balón (el motor no mueve el cursor; la etapa C decide si lo dibuja sobre el portero leyendo `ball.owner`); (7) la CPU saca siempre con el automático a los 2 s (D4 literal), aunque un compañero esté libre antes.

## Tabla CARRY del informe final → paso del plan

| CARRY | Qué | Dónde se resuelve |
|---|---|---|
| #1 `invariants.ts` cast `as string` | limpiar al tocar el contenido | Task 7, Step 3 |
| #3 `pitch.ts` convenciones de frontera | comentario junto a `isBetweenPosts`/`isInsideBox` | Task 6a, Step 5 |
| #8 exports sin consumidor de la Task 2 | `GK_SPEED`/`GK_CATCH_RADIUS` consumidos por `ai.ts`/`players.ts`; los espejo en segundos se des-exportan | Task 6a Steps 3/15 · Task 7, Step 9 |
| #10 `as Axis` fuera de la excepción | `toAxis` en `input.ts`, tests migrados | Task 6a, Step 1 |
| #12 `isSprinting` en el último paso | decisión escrita: se mantiene (lag de un paso, simétrico) | Task 6a, Step 3 |
| #13 `shoot` clamp duplicado sin guarda | `chargeFraction` compartida | Task 6a, Steps 8-9 |
| #19 fallback distancia cero `pushRivalsAway` | test por `beginSetPiece` con rival sobre el punto + mutación | Task 6a, Step 18 |
| #20 `nearestOutfield` puede devolver −1 | comentario de alcance (v1.5) | Task 6a, Step 17 |
| I2 / R19 criterio 11 | tests "live placement responds at once" + formaciones reales; verificación explícita en el cierre | Task 6a Step 16 · Task 7 Step 6 · Cierre 8 |
| R20 comentario "nobody tackles" | reescrito con la medición nueva | Task 6a, Steps 16/19 |
| Ledger: una falta por paso / robos simultáneos (equipo 0) | decisión escrita, comentario en `applyTeamInput`, lista de QA | Task 6a, Step 17 · Cierre 8 |
| **D4 (05-sep) portero con balón** | atajada = posesión (`keeperCatch` → `givePossession`), saque a botón `applyKeeperButtons`, automático `releaseFromGoalkeeper`, enrutado `applyTeamInput` + `liveControlled`, CPU sin botones, sonda P6 | Task 6a Steps 8-11, 15-17 · Task 6b Steps 4-6 · Cierre P6 |
| #11, #16 (QA), #14, #18 (Task 8) | fuera de la etapa B por el propio triaje | — |

## Recomendaciones del informe final incorporadas

1. Canal `wantX/wantY/wantSprint` en `PlayerState` leído por `stepPhysics` para los no controlados; `step.test.ts:183` cambia a propósito → Task 6a Steps 2-4.
2. Colocación de compañeros DENTRO de `stepMatch` para los dos equipos (`positionTeam` desde `stepOpenPlay`) → Task 6a Steps 15/17.
3. `AiProfile` con `reactionSteps` (pasos, no ms) y `profiles: [AiProfile, AiProfile]` en `MatchState`; `gkPenaltyRead` sustituido → Task 6a Steps 13/17.
4. Error angular sin trigonometría (skew + normalización) → Task 6a Step 13 (`applyKickError`).
5. Atajada del portero con `catchChance`, y el orden de consumo del `rng` fijado en el primer paso de cableado (atajada → robo → error de golpeo; los saques del portero, D4, fuera del `rng`; el penalti en su fase) → Task 6a Steps 15/17 y Global Constraints.
6. `aimPass` exige vector unitario: la IA solo le pasa los literales unitarios de `DIRS` y `pickPassTarget` hereda el comentario → Task 6b Step 5.
7. C1/C2 arreglados antes de `ai.ts`: ya lo están (ola de fix de la etapa A, R16/R17); los tests de esta etapa (atajada respeta la línea, `pickUp` del portero) los mantienen → Task 6a Steps 7/16.
8. Lo que la IA ya tiene (`anchorFor`, `STRATEGIES`, `attackDir`, `goalLineX`, `isInsideSmallArea`, `checkTeamInput`, `stepsFor`) se usa tal cual → Task 6a/6b.

**Descartada (con motivo):** ninguna. La única desviación respecto al informe es de detalle: el informe sugiere que `stepPlayer` lea el canal en vez de sus parámetros; aquí `stepPlayer` conserva la firma y la aritmética de la etapa A y `stepPlayerFree` lee el canal, para que el camino del controlado sea bit a bit el mismo y las trazas grabadas no se muevan por un `factor = 1` que no lo era.

## Self-Review (hecho al cerrar el plan; correcciones aplicadas inline)

1. **Cobertura del spec.** Paso 6 → Tasks 6a + 6b: colocación por formación y estrategia (S3/S4, `positionTeam`), persecución por los K más cercanos acotada por estrategia (`CHASERS`, D1), portero (`keeperStep` línea/área pequeña/vuelta; regla 2 nueva: `keeperCatch` con `catchChance` y penalización de carga que da POSESIÓN sin cambio de fase; regla 4 nueva: con balón, `applyKeeperButtons` —B saque con la mano corto asistido, A largo asistido, cruceta apunta, exacto— y `releaseFromGoalkeeper` automático al más libre en `GK_HOLD_STEPS`, con el `TeamInput` enrutado en `applyTeamInput` y el controlado de campo colocado por IA vía `liveControlled`; tests D4 a-b-c-e en `match.test.ts`, unitarios en `actions.test.ts`, (d) en `ai.test.ts`, sonda P6; penalti ya en `set-pieces.ts` con `profiles[t].penaltyReadChance`), decisión del CPU que rellena `TeamInput` (chutar/pasar/conducir por `reactionSteps`, entrar/robar, estrategia por marcador cada 5 s con las cuatro reglas), perfil 1-8 por fórmula con `profileFor(teamDef, difficulty)` y sin tocar la velocidad, tests de entrada nunca inválida (a), monotonía 1 vs 8 en reacción y acierto (b), portero y área (c), criterio 11 en el acto (d), partido grabado CPU vs CPU con negativo de semilla y ejercitando entradas/pases/chuts (e). Paso 7 → Task 7: 16 selecciones, 3 formaciones, `checkBank`/`checkFormations` sobre lo real, tests acoplados ampliados, todas las combinaciones, IA con las tres. Criterio 12 ("CPU pasa a ataque en gol de oro") → `chooseStrategy` half 3. Criterio 14 (simetría) → `humanProfile` con la misma dificultad y el error solo en el perfil CPU. Criterio 18 (4/6/8 y 5) es de la etapa C: el perfil se deriva de cualquier dificultad y los tests usan 1, 5 y 8. Fuera a propósito (spec §Pendientes v1.5): atributos por selección/jugador, cambio manual de controlado.
2. **Placeholders.** Ningún "TBD/TODO/similar to/add appropriate" (grep pasado el 06-sep tras volcar D4); cada test y cada implementación están completos, helpers incluidos (`fixedRng`/`caught` nuevos en `match.test.ts` y `holding`/`unitTo` en `actions.test.ts` están definidos en su paso; `freeBall` (`match.test.ts:444`) y `dist2` (`actions.test.ts:441`) se REUTILIZAN de la etapa A y no se redeclaran — pre-vuelo H2). Los dos únicos puntos donde el plan manda **medir** (fixture de separación 41 u, `expectedId` de la 3-2-3) traen el cálculo hecho y la aserción independiente que lo protege.
3. **Consistencia de tipos y nombres (re-comprobado el 06-sep con D4):** `releaseFromGoalkeeper(gk, ball, players, attackDir, pitch, stepCount, aim, out)` tiene UNA firma en Produces, Step 8, Step 9, Step 17 (`applyTeamInput`) y el test (c) de `match.test.ts`; ya no limpia `out` (Step 9, test de Step 8). `applyKeeperButtons(gk, input, ball, players, attackDir, stepCount, aim, out)` idéntica en Produces, Step 10 (tests), Step 11 (implementación) y Step 17; sin `rng` ni `pitch` en la firma. `keeperCatch(gk, ball, catchChance, rolled, rng, pitch, stepCount, out)` idéntica en Step 14 (tests), Step 15 (implementación) y `keeperCatchFor` (Step 17), que ahora devuelve `void` y escribe en `events[gk.id]`. `MatchState.scratch` es `{ events, liveControlled, call, aim, setPiece }` en Produces, Step 17 y `createMatch`; `gkEvent` no existe en ningún paso (6a, 6b ni Cierre); `playCpuMatch` (6b Step 6) cuenta `'gk-catch'`/`'gk-release'` en `events`. `stepPhysics` conserva la firma de la etapa A y recibe `scratch.liveControlled`; `positionTeam(players, ball, team, formation, strategy, attackDir, controlled, pitch, stepCount, scratch)` idéntica en `wantOf`, tests de persecución y `runTeamAi`, con `controlled = liveControlled[team]` (−1 = coloca también al controlado). `createMatch` recibe `profiles` como cuarto parámetro en Produces, Step 16, Step 17, Task 6b (`scenario`, `playCpuMatch`, `replay`) y Task 7. `decideTeamInput` (6b Step 5) con el portero propio en posesión devuelve entrada neutra y no toca `anchorFor` ni el `rng`, como afirma el test (d) de 6b Step 4. `HALF_STEPS` sale de `clock.ts` (Task 6b Step 1) y sigue importable desde `./match` y `./step`; `ai.ts` la importa de `./clock`. `PenaltySide` se importa como tipo desde `./set-pieces` (que no importa `ai.ts`: sin ciclo). `MatchState` en `ai.ts` es `import type`. `toAxis` vive en `input.ts` y lo usan `ai.ts`, `step.test.ts` y `match.test.ts`. `goalKickX` vive en `pitch.ts` y lo usan SOLO `referee.ts` y `pitch.test.ts` (ni `ai.ts`, ni `match.ts`, ni `match.test.ts`: D4). `ActionKind` gana `'gk-catch'` en Task 6a Step 9, lo escribe `keeperCatch` (Step 15) y lo cuenta `playCpuMatch` (6b); los saques a botón del portero son `'short-pass'`/`'long-pass'` con `actorId = gk.id` y el automático `'gk-release'`, igual en Step 11, Step 16, 6b Step 6 y P6. En `playCpuMatch` el portero es `players[t * 9]`: 9 es `TEAM_SIZE`; usar la constante importada de `./teams` en vez del literal al escribir el test.
4. **Pre-vuelo del 06-sep aplicado (H1-H11, `.superpowers/sdd/2026-09-06-vault-world-cup-stage-b/preflight.md`), firmas re-comprobadas:** `laneBlocked(players, team, fromX, fromY, dirX, dirY, length, radius, stepCount)` tiene UNA firma en Produces, Step 13 y las tres llamadas de 6b (`tryShoot`/`tryPass`/`carry` pasan `team`), y el test del Step 12 pasa `0` (el equipo dueño del carril). `keeperCatch` conserva su firma de 8 y gana solo la guarda del kick lock (Step 15) con su `it` (Step 14) y los cinco pasos extra del test (c) (Step 16); `KICK_LOCK_STEPS` entra en el import de `ai.test.ts` (Step 12). `freeBall` y `dist2` se reutilizan de la etapa A (Steps 8 y 16). Lista de caducidad: 9 puntos (8 = C2-C, 9 = penalti "never again" + C1). `takerId` de la 3-2-3 = 5 (Task 7, Step 5). `ai.ts` importa `HALF_STEPS` de `./step` y `match.ts` el reloj de la parte de `./clock` en una línea (6b, Steps 1/3). S14b es supuesto abierto (6b Step 5, listas del Cierre 7 y final). P0 precede a P1 en el Cierre 6. Cuentas de pasos sin cambio: 6a 20, 6b 8, Task 7 10.
