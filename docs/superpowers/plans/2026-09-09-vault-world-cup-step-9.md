# Vault World Cup — Etapa C, paso 9 (modos, Mundial y pantallas de flujo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el paso 9 del spec: sobre la pantalla del paso 8 (un solo amistoso humano vs CPU creado al montar), construir **los cuatro modos** del grill del 09-sep —AMISTOSO vs CPU, AMISTOSO A DOS en el mismo teclado (G9-2), ENTRENAMIENTO sin reloj contra un equipo congelado (G9-1) y MUNDIAL de ocho sorteadas de dieciséis con cuadro, cruces de la CPU simulados de verdad con VER/SALTAR (G9-3), dificultad 4/6/8 y puntuación—, el **selector de modo**, el **selector de selección con formación** (G9-4/G9-5), el **sorteo y el cuadro**, las **pantallas de victoria** (GANADOR con confeti, CAMPEONES DEL MUNDO con fuegos artificiales, cánticos, CONTINUAR → selector de modo) y los callbacks `onGameOver`/`onVictory` que el paso 10 consumirá, **todo dentro del mismo canvas y del mismo bucle** (G9-9).

**Architecture:** El patrón es el de Vault Fighter, no su código: `football-logic/mode.ts` es la costura entre el componente y los modos (preguntas puras, **cero ramas por modo en el `.tsx`**), `football-logic/world-cup.ts` es el cuadro como funciones puras sobre un estado mutado in place (sorteo Fisher-Yates con rng inyectado, `bracket` fijo de ocho, `entrants` 8→4→2→1, emparejamiento por pares consecutivos, semillas de partido derivadas por aritmética entera, puntuación de la tabla del spec, invariante `checkWorldCupBracket`), y **la máquina de fases vive en `football-screen/flow.ts`** como módulo puro con tests (G9-9), de modo que `VaultWorldCupGame.tsx` sigue siendo pegamento y dibujo. El partido deja de crearse al montar: un `MatchRun` (`football-screen/match-run.ts`) agrupa partido, dos rngs, dos `AiState` y dos `TeamInput` con una máscara de humanos, y **es el mismo código** el que reproduce un cruce de la CPU en pantalla (VER, x4) y el que lo termina headless (SALTAR o tecla A): misma semilla → mismo `winnerOf` por construcción. El segundo teclado es un segundo `PadState` con **su propia tabla de teclas** (`keyboard.ts`, tablas derivadas de `KEY_BINDINGS`). El motor **sí se toca una vez**, y solo una (G9-1): `MatchState.rules = { timed, frozenTeam }` con valor por defecto normal, `advanceClock` no-op sin reloj y `runTeamAi` saltando la colocación del equipo congelado (su portero sigue vivo); flag apagado = ningún test existente cambia. Los efectos de victoria son un depósito de partículas creado una vez (`particles.ts`, patrón del pool de barriles de Kong) con su propio stream de azar derivado de la semilla del run, nunca el del partido.

**Tech Stack:** TypeScript estricto, React 19.2.4, Next 16.2.6 (App Router, `dynamic(..., { ssr: false })`), canvas 2D 800 × 500, vitest 4.1.11 (tests `*.test.ts` junto al código, **sin `vitest.config`**, entorno Node sin DOM), audio por fichero con `HTMLAudioElement` (`lib/sfx-vault-world-cup.ts`).

**Spec:** `specs/31-vault-world-cup.md` (Approved) — §Alcance (dos modos + pantallas de victoria + ELIMINADO como rótulo), §Modelo de datos (**`world-cup.ts` y `mode.ts` viven en `components/games/football-logic/`**, filas de la tabla), §Decisiones estructurales (tabla de puntos: gol 1 000 · victoria 5 000 · portería a cero 2 000 · pasar cuartos/semi 5 000/10 000 · campeón 25 000; dificultad 4/6/8 y 5; solo puntúa el Mundial), **§Etapa C punto 9**, §Etapa D tabla de audio (fila `chants-victory`: fuegos artificiales a volumen normal, confeti a volumen bajo; la música de menú es del paso 10), criterios de aceptación 14-21 y 23, §Decisiones «Primer QA jugado del paso 8 (09-sep)» y **«Grill corto del paso 9 (09-sep)» con G9-1..G9-9, que son ley**, §Riesgos 3, 6, 7.
**Informes obligatorios:** `.superpowers/sdd/2026-09-09-vault-world-cup-step-9/design-brief.md` entero (patrón Fighter, contrato con el motor y con la pantalla del paso 8 con números de línea, riesgos 1-12; sus preguntas P1-P8 **ya están decididas** en G9-1..G9-9 y este plan no las reabre) · `.superpowers/sdd/2026-09-07-vault-world-cup-stage-c-screen/final-review-report.md` §8 (recomendaciones 1-6 para el paso 9) y §4 Minor 5, 7, 8, 10.
**Código a imitar:** `components/games/fighter-logic/mode.ts` y `tournament.ts` (+ tests) · `components/games/VaultFighterGame.tsx` fases 752-800, `confirmSelection`/`startBoutFor`/`refreshBracketView` 973-1074, `afterBoutEnd` 1372-1396, teclado por fase 2050-2075 · `app/games/vault-fighter/play/page.tsx` 130-150 y 320-338 · `components/games/KongGame.tsx` 758-809 (pool) · `components/games/PongGame.tsx` 141-153 (dos teclados).
**Ledger de este paso:** `.superpowers/sdd/2026-09-09-vault-world-cup-step-9/progress.md` (crear en la Task 9-1; briefs, reviews y snapshots `.txt` —nunca `.ts`— van a la misma carpeta).

---

## Global Constraints

Heredadas del plan del paso 8 (`docs/superpowers/plans/2026-09-07-vault-world-cup-stage-c-screen.md`), con la baseline actualizada y las reglas nuevas del paso 9. **Los requisitos de cada tarea incluyen implícitamente esta sección.**

- **Commits: SOLO Paco.** Ninguna tarea ejecuta `git add` ni `git commit`. Cada tarea termina dejando el working tree **verificado** y **propone el mensaje de commit exacto** en un paso «Proponer commit». Rama `main`.
- **NUNCA arrancar `next dev`.** Paco tiene el suyo en `:3000`. La verificación automática de cada tarea es `npx vitest run` + `npx tsc --noEmit`; `npm run build` además al cerrar el paso. **El QA visual lo hace Paco** con la lista que deja escrita el cierre.
- **EL MOTOR SIGUE CONGELADO EN `0e553af`, CON UNA ÚNICA EXCEPCIÓN: la Task 9-1 (G9-1).** Los ficheros EXISTENTES de `components/games/football-logic/` solo pueden cambiar en esa tarea, y solo `match.ts` y `match.test.ts` (`players.ts` y su test quedan autorizados por si el pickup lo exige; **no hace falta**, ver S-FL2). Al cerrar cada tarea: `git diff --stat 0e553af -- components/games/football-logic/` debe listar **como mucho** `match.ts` y `match.test.ts`. Los ficheros NUEVOS que el spec sitúa en esa carpeta (`mode.ts`, `world-cup.ts` y sus tests, Tasks 9-3/9-4) no son «tocar el motor»: son módulos nuevos que solo LEEN del motor, y `git diff --stat <commit>` no los lista porque no están trackeados; se comprueban con `git status --short components/games/football-logic/`, que solo puede mostrar `M match.ts`, `M match.test.ts` y `??` de esos cuatro ficheros. Si algo del motor estorba, **no se arregla aquí**: va a «Peticiones separadas al motor» del cierre.
- **Baseline verificada hoy (2026-09-09, commit `0e553af`, `npx vitest run` ejecutado al escribir este plan): 1050 tests en 62 ficheros verdes**, `npx tsc --noEmit` limpio, `npm run build` exit 0. El criterio 21 del spec dice 861 y está desactualizado: **el umbral real de este paso es 1050**. Cada tarea suma y no regresa. Ningún test existente cambia de valor esperado; una edición mecánica de argumentos (la tabla de teclas de la Task 9-2, el nombre nuevo en `ALL` del test de SFX) es la única modificación admitida y va listada con su `sed` exacto.
- **Comentarios y nombres de tests en inglés** (convención del repo). El plan, el spec y el chat, en castellano. **Los textos de UI van en castellano y en mayúsculas** (`AMISTOSO`, `MUNDIAL`, `ELIGE TU SELECCIÓN`, `CAMPEONES DEL MUNDO`, `CONTINUAR`, `VER`, `SALTAR`).
- **Ficheros en kebab-case**, salvo `VaultWorldCupGame.tsx`. Tipos en PascalCase, `SCREAMING_CASE` para constantes de módulo. TypeScript estricto: nada de `any`, nada de `!` gratuito salvo el `canvas.getContext('2d')!`, nada de `as` para tapar un tipo.
- **Toda la lógica que se pueda razonar sin canvas vive fuera del `.tsx` con su test.** `football-logic/mode.ts` y `world-cup.ts` (reglas de modo y de cuadro), `football-screen/flow.ts` (máquina de fases), `flow-layout.ts` (rejillas y posiciones de las pantallas), `match-run.ts` (el arnés de un partido), `particles.ts` (el depósito), `keyboard.ts` (tablas). El `.tsx` solo contiene llamadas a `ctx.*`, lectura de refs y cableado de eventos.
- **`football-screen/` NO importa React ni toca `document`, `window`, `canvas` ni `Audio`, y NO contiene `Math.random`.** Al cerrar cada tarea: `grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/` debe devolver **VACÍO** (tests incluidos). `Date.now()` y `performance.now()` **solo en el `.tsx`**.
- **Una sola semilla por partida (G9-7): `runSeed = seed ?? Date.now()` se lee UNA vez, al construir el modo en el selector, y de ella se derivan por aritmética entera con `>>> 0` todos los streams:** el sorteo del Mundial (`DRAW_SEED_SALT`), el rival del amistoso (mismo stream del sorteo), la semilla de cada partido (`matchSeedFor(seed, round, pair)`, o la propia `runSeed` en un amistoso), y de cada semilla de partido los tres streams del paso 8 —partido (`createRng(matchSeed)`), CPU (`createRng((matchSeed ^ CPU_SEED_SALT) >>> 0)`), ambiente (`ambienceSeedFor`)— más el cuarto de **efectos** (`createRng(fxSeedFor(runSeed))`). **NUNCA `matchRng` para nada que no sea `stepMatch`.** Un Mundial con la misma semilla produce el mismo cuadro, las mismas semillas de partido y el mismo resultado de cada cruce de la CPU, se vea o no (G9-3).
- **Sin asignación de memoria por frame** (criterio 20), ni en el bucle ni en el dibujo, **incluido el confeti y los fuegos artificiales**: depósito creado una vez (`createParticlePool`), direcciones precalculadas en carga de módulo, `stepFx` escribe in place. Las cadenas de las pantallas de flujo (nombres de modo, etiquetas de ronda, resultados del cuadro) se construyen **una vez por evento** (al confirmar, al refrescar el cuadro, al empezar un partido), nunca en `draw()`. Crear un partido nuevo (`createMatchRun`) asigna, y es legal: ocurre en un evento (A en el cuadro, A en el selector), no en un frame.
- **Paso fijo con tope.** `planSteps` conserva el tope de 5 pasos por frame a velocidad 1 y lo multiplica por `SPECTATE_SPEED = 4` en el cruce de la CPU visto en pantalla (pasos ×4, tope ×4 = 20). `pressed`/`released` siguen durando un paso por frame; en el modo a dos los DOS pads siguen la misma regla (`padAdvance` sobre los dos cuando el frame corrió pasos).
- **El componente no reimplementa ninguna regla.** Ni de partido (motor), ni de modo (`mode.ts`), ni de cuadro (`world-cup.ts`), ni de fase (`flow.ts`). Regla operativa: **cero `if (mode.kind === …)` en el `.tsx`**; `grep -n "mode\.kind\|m\.kind\|kind === '\(friendly\|training\|world\)" components/games/VaultWorldCupGame.tsx` debe devolver vacío al cerrar la Task 9-7 (preflight: el patrón `kind ===` a secas casa con el `sp.kind === 'penalty'` de `drawSetPiece`, que es legal y no cambia).
- **Todo lo exportado tiene consumidor** al cerrar el paso: código o test. Lo que espera al paso 10 lleva `// exported for Task 10: …`. Las cinco exportaciones huérfanas de `keyboard.ts` (Minor 8) encuentran aquí su consumidor.
- **Regla anti-coincidencia de fixtures (riesgo 7):** el cuadro se prueba **para TODA selección del banco como humana** (16 sorteos, 3 victorias exactas cada uno), con **varias semillas distintas**; el modo a dos se prueba con **las dos tablas** (una tecla de J1 no mueve a J2 y viceversa); `matchSeedFor` se prueba con los 3 × 4 pares de un mismo seed **todos distintos**; el entrenamiento se prueba con 10 000 pasos y **con el caso de control** (reglas normales → el reloj sí avanza, el congelado sí se mueve); la equivalencia VER/SALTAR se prueba con un partido cortado a mitad **y** con uno visto entero.
- **Prioridad si el día se complica (Paco, 09-sep):** el entrenamiento es lo primero que se difiere al paso 11. Por eso la Task 9-1 va **PRIMERA y pequeña** (~40 líneas de motor + 5 tests + una línea de `hud.ts`): deja `MatchState.rules` con el valor normal por defecto y todo lo posterior pasa `rules` por parámetro sin saber qué hay dentro. Lo que se difiere si hace falta es **la entrada `'training'` en `MODE_LIST` de `flow.ts`** (Task 9-5, una línea, con su test marcado `.skip` explícitamente) y su punto de QA, no la tarea del motor, que es la más barata de todas y la que más cuesta rehacer después con el componente ya cableado.

---

## File Structure

Orden de dependencias: una fila solo importa de las de arriba, de `football-logic/` (solo lectura salvo la 9-1) y de `football-screen/` del paso 8.

| Fichero | Tarea | Responsabilidad |
|---|---|---|
| `components/games/football-logic/match.ts` (**modificado**) + `match.test.ts` | 9-1 | `MatchRules` (`timed`, `frozenTeam`), `NORMAL_RULES`/`TRAINING_RULES`, `createMatch(…, rules = NORMAL_RULES)`, `advanceClock` no-op sin reloj, `runTeamAi` salta `positionTeam` del congelado, `dropFrozenPickup` (S-FL2). |
| `components/games/football-screen/hud.ts` (**modificado**) + `hud.test.ts` | 9-1 | `halfLabel` devuelve `ENTRENAMIENTO` cuando `!match.rules.timed`. |
| `components/games/football-screen/keyboard.ts` (**modificado**) + `keyboard.test.ts` | 9-2 | `KeyTable`, `SOLO`, `TWO_PLAYER_P1`, `TWO_PLAYER_P2` (derivadas de `KEY_BINDINGS`), `padKeyFor(table, key)`, `padChoice(pad, table, key)`, `tablesShareKey`. |
| `components/games/football-screen/loop.ts` + `match-loop.ts` (**modificados**) + tests | 9-2 | `SPECTATE_SPEED = 4`; `planSteps(acc, out, speed = 1)`; `planFrame(…, speed = 1)`. |
| `components/games/football-logic/world-cup.ts` (+ `.test.ts`) **NUEVO** | 9-3 | Sorteo, cuadro, semillas de partido, VER/SALTAR de la CPU, victoria/derrota/abandono del humano, puntuación, invariante. |
| `components/games/football-screen/match-run.ts` (+ `.test.ts`) **NUEVO** | 9-3 | `MatchRun`: partido + rngs + `AiState` + `TeamInput` + máscara de humanos; `stepMatchRun` (decide las CPU, `stepMatch`), `finishMatchRun` headless. La equivalencia VER/SALTAR es por construcción. |
| `components/games/football-logic/mode.ts` (+ `.test.ts`) **NUEVO** | 9-4 | `GameMode`, `ModeStatus`, `HumanSide`, constructores, `drawRival`, y las preguntas puras (`modeHumanSide`, `modeHomeId/AwayId`, `modeDifficulty`, `modeRules`, `modeScore`, `modeBracket`, `modeMatchSeed`, `modeVictoryScreen`, `modeEndMatch`, `modeStatus`, `modeScores`, etiquetas). |
| `components/games/football-screen/captions.ts` (**modificado**) + `captions.test.ts` | 9-5 | `collectCaptions(match, w, human: HumanSide, cs, victoryScreen = false)`: sin `winner` cuando hay pantalla propia; sin resultado en `'none'` (spectate). |
| `components/games/football-screen/flow.ts` (+ `.test.ts`) **NUEVO** | 9-5 | La máquina de fases pura: `FlowPhase`, `FlowState`, `MODE_LIST`, movimientos y confirmaciones de cada pantalla, `flowBuildMode` (el único sitio donde se construye el modo), VER/SALTAR, fin de partido → `after`, CONTINUAR, salida del entrenamiento. |
| `components/games/football-screen/flow-layout.ts` (+ `.test.ts`) **NUEVO** | 9-5 | Rejilla 4 × 4 del selector, filas del cuadro, tarjetas del selector de modo: solo números, sin `ctx`. |
| `components/games/football-screen/particles.ts` (+ `.test.ts`) **NUEVO** | 9-6 | Depósito de partículas creado una vez; `startFx`/`stepFx` para `'confetti'` y `'fireworks'`; `FX_DIRS` precalculadas; `fxSeedFor`. |
| `lib/sfx-vault-world-cup.ts` (**modificado**) + `.test.ts` | 9-6 | `'chants_victory'` en `VaultWorldCupSfx`, `play(name, gain = 1)`, `stop(name)`, el clon vivo guardado por nombre. |
| `components/games/football-screen/sfx-map.ts` (**modificado**) + `.test.ts` | 9-6 | `victoryChantGain(kind)`: 1 en los fuegos, `CHANTS_LOW_GAIN` en el confeti. |
| `components/games/VaultWorldCupGame.tsx` (**reescrito en sus zonas**) | 9-7 | Props nuevas, `FlowState` + `GameMode` + `MatchRun` como estado de run, `startMatch` sin remonte, dos pads con sus tablas, `runStep` por máscara de humanos, dibujo de las seis pantallas, victoria con partículas y cánticos, guard de viewport con G9-8, `onGameOver`/`onVictory`. **Sin test unitario** (rAF + canvas). |
| `app/games/vault-world-cup/play/page.tsx` (**modificado**) | 9-7 | Banco de pruebas provisional para los cuatro modos: P/R con `isTypingTarget` (Minor 10), estado del Mundial vía `onGameOver`/`onVictory`. El paso 10 lo reescribe. |
| `.superpowers/sdd/2026-09-09-vault-world-cup-step-9/progress.md` | 9-1 → cierre | Ledger SDD (rulings, progreso por tarea, deudas arrastradas). |

### Contrato entre tareas (firmas que las tareas posteriores consumen tal cual)

```ts
// football-logic/match.ts (9-1)
export type MatchRules = { timed: boolean; frozenTeam: -1 | 0 | 1 };
export const NORMAL_RULES: Readonly<MatchRules>;      // { timed: true,  frozenTeam: -1 }
export const TRAINING_RULES: Readonly<MatchRules>;    // { timed: false, frozenTeam: 1 }
export type MatchState = { /* …lo del paso 8… */ rules: Readonly<MatchRules> };
export function createMatch(teams, formationTable, pitch, profiles, rules?: Readonly<MatchRules>): MatchState;

// football-screen/keyboard.ts (9-2)
export type KeyTable = { readonly pad: Readonly<Record<string, PadKey>>; readonly formation: readonly string[]; readonly strategy: readonly string[] };
export const SOLO: KeyTable; export const TWO_PLAYER_P1: KeyTable; export const TWO_PLAYER_P2: KeyTable;
export const TWO_PLAYER_TABLES: readonly [KeyTable, KeyTable];
export function padKeyFor(table: KeyTable, key: string): PadKey | null;
export function padChoice(pad: PadState, table: KeyTable, key: string): boolean;
export function tablesShareKey(a: KeyTable, b: KeyTable): string | null;

// football-screen/loop.ts + match-loop.ts (9-2)
export const SPECTATE_SPEED = 4;
export function planSteps(accumulatorMs: number, out: StepBudget, speed?: number): void;
export function planFrame(phase, paused, blocked, accumulatorMs, frameMs, budget, out, speed?: number): number;

// football-logic/world-cup.ts (9-3)
export type WorldCupRound = 'quarters' | 'semis' | 'final';
export type WorldCupStatus = 'playing' | 'champion' | 'eliminated';
export type WorldCupResult = { round: WorldCupRound; homeId: string; awayId: string; homeGoals: number; awayGoals: number; winner: 0 | 1 };
export type WorldCupState = { humanId: string; seed: number; round: WorldCupRound; status: WorldCupStatus; score: number; bracket: string[]; entrants: string[]; pairWinner: string[]; resolved: boolean[]; results: WorldCupResult[]; resultCount: number };
export function createWorldCup(bankIds: readonly string[], humanId: string, seed: number, rng: Rng): WorldCupState;
export function pairCount(wc): number; pairHomeId(wc, pair): string; pairAwayId(wc, pair): string;
export function humanPairIndex(wc): number; humanSideInPair(wc): 0 | 1; humanOpponentId(wc): string;
export function isStillIn(wc, id): boolean; isFinal(wc): boolean; currentDifficulty(wc): number; roundLabel(wc): string;
export function matchSeedFor(seed: number, round: WorldCupRound, pair: number): number; humanMatchSeed(wc): number;
export function nextCpuPair(wc): number;                                   // -1 = todos resueltos
export function resolveCpuMatch(wc, pair: number, winner: 0 | 1, homeGoals: number, awayGoals: number): void;
export function matchPoints(goalsFor: number, goalsAgainst: number, won: boolean): number;
export function winHumanMatch(wc, match: MatchState): void; loseHumanMatch(wc, match: MatchState): void; abandonHumanMatch(wc): void;
export function checkWorldCupBracket(wc, bankIds: readonly string[]): string[];
export const WORLD_CUP_SIZE = 8; ROUND_LABELS; ROUND_DIFFICULTY; ROUND_BONUS; SCORE_GOAL; SCORE_WIN; SCORE_CLEAN_SHEET; SCORE_PASS_QUARTERS; SCORE_PASS_SEMIS; SCORE_CHAMPION; PERFECT_BASE_SCORE = 61_000;

// football-screen/match-run.ts (9-3)
export const CPU_SEED_SALT = 0x2545f491;                                   // el del componente del paso 8, movido aquí
export type MatchRun = { match: MatchState; matchRng: Rng; cpuRng: Rng; states: [AiState, AiState]; inputs: [TeamInput, TeamInput]; human: [boolean, boolean] };
export function createMatchRun(home: TeamDef, away: TeamDef, seed: number, difficulty: number, human: readonly [boolean, boolean], rules: Readonly<MatchRules>, formations: readonly [number, number]): MatchRun;
export function stepMatchRun(run: MatchRun): void;
export function finishMatchRun(run: MatchRun, cap?: number): 0 | 1 | -1;
export const MATCH_RUN_STEP_CAP = 100_000;
// stepMatchRun SOLO pide decisión a la CPU de un equipo que NO es humano Y NO es el congelado
// (G9-1: sus ocho de campo quietos, controlado incluido; su TeamInput queda neutro).

// football-logic/mode.ts (9-4)
export type GameModeKind = 'friendly-cpu' | 'friendly-2p' | 'training' | 'world-cup';
export type ModeStatus = 'playing' | 'champion' | 'eliminated' | 'draw';
export type HumanSide = 0 | 1 | 'both' | 'none';
export type FxKind = 'confetti' | 'fireworks';                              // vive AQUÍ (logic no importa de screen); particles.ts lo importa
export type GameMode = { kind: 'friendly-cpu' | 'friendly-2p' | 'training'; state: FriendlyState } | { kind: 'world-cup'; state: WorldCupState };
export function drawRival(bankIds: readonly string[], homeId: string, rng: Rng): string;
export function createFriendlyMode(kind, homeId: string, awayId: string): GameMode;
export function createWorldCupMode(bankIds, humanId: string, seed: number): GameMode;
export function sideIsHuman(side: HumanSide, team: 0 | 1): boolean;
export function modeHumanSide(m): HumanSide; modeHomeId(m): string; modeAwayId(m): string; modeDifficulty(m): number;
export function modeRules(m): Readonly<MatchRules>; modeScore(m): number; modeBracket(m): WorldCupState | null;
export function modeMatchSeed(m, runSeed: number): number; modeVictoryScreen(m): boolean; modeScores(m): boolean;
export function modeEndMatch(m, match: MatchState): void; modeAbandonMatch(m, match: MatchState): void; modeStatus(m): ModeStatus;
export function modeVictoryTeamId(m, match: MatchState): string;
export function modeMatchLabel(m): string; modeVictoryTitle(m): string; modeFxKind(m): FxKind;
export type FriendlyKind = Exclude<GameModeKind, 'world-cup'>; export type FriendlyState = { homeId: string; awayId: string; status: ModeStatus };
export const FRIENDLY_DIFFICULTY = 5; export const DRAW_SEED_SALT: number; export function drawSeedFor(seed: number): number;

// football-screen/flow.ts (9-5)
export type FlowPhase = 'mode-select' | 'team-select' | 'draw' | 'bracket' | 'match' | 'spectate' | 'victory' | 'over';
export type BracketAction = 'spectate' | 'skip' | 'play';
export const MODE_LIST: readonly GameModeKind[]; export const MODE_NAMES; export const MODE_BLURBS;
export function createFlowState(): FlowState;
export function flowMoveMode(f, delta): void; flowConfirmMode(f): void; flowModeKind(f): GameModeKind; flowHumanCount(f): 1 | 2;
export function flowMoveTeam(f, dx, dy, bankSize): void; flowSetFormation(f, human: 0 | 1, formation: number): void; flowConfirmTeam(f, bankSize): 'next' | 'done' | 'refused'; flowPickingHuman(f): 0 | 1;
export function flowBuildMode(f, bankIds, seed): GameMode; flowAfterModeBuilt(f, m): void; flowConfirmDraw(f): void;
export function flowMoveBracketChoice(f, delta): void; flowBracketAction(f, m): BracketAction; flowConfirmBracket(f, m): BracketAction | 'none';
export function flowMatchOver(f, m, match: MatchState, abandoned: boolean): void; flowSpectateOver(f): void; flowSkipSpectate(f): void;
export function flowCaptionsDrained(f): void; flowContinue(f): void; flowExitMatch(f, m): void; flowReset(f): void;
export function flowCpuPair(m): number; flowRecordCpuResult(m, pair: number, match: MatchState): void; export const HUMANS_BY_MODE;

// football-screen/particles.ts (9-6) — FxKind se importa de football-logic/mode.ts
export function createParticlePool(count?: number): ParticlePool; startFx(pool, kind, rng): void; stepFx(pool, kind, rng): void; fxSeedFor(seed): number; activeCount(pool): number;
export const PARTICLE_COUNT = 240; FX_SEED_SALT; FX_DIR_COUNT = 32; FX_DIR_X; FX_DIR_Y; FX_COLORS; FIREWORK_BURST_STEPS = 45; FIREWORK_BURST_SIZE = 40;

// lib/sfx-vault-world-cup.ts (9-6)
export type VaultWorldCupSfx = /* los ocho del paso 8 */ | 'chants_victory';
play(name: VaultWorldCupSfx, gain?: number): void; stop(name: VaultWorldCupSfx): void;
```

---

## Task 9-1: `match.ts` — reglas de entrenamiento en el motor (G9-1), la única excepción al motor congelado

**Por qué primera y pequeña:** deja `MatchState.rules` con el valor normal por defecto (`NORMAL_RULES`) sin que cambie una sola línea de test existente. Todas las tareas posteriores pasan `rules` por parámetro (`createMatchRun`, `modeRules`) sin mirar dentro. Si el día se complica, lo que se difiere es la entrada `'training'` de `MODE_LIST` (Task 9-5), no esta tarea: ~40 líneas de motor con cinco tests, y la que más caro sería meter después con el componente cableado.

**Files:**
- Modify: `components/games/football-logic/match.ts` (tipo `MatchState` 26-59, `createMatch` 110-145, `advanceClock` 267-269, `runTeamAi` 296-300, `stepOpenPlay` tras `stepPhysics` 349)
- Modify: `components/games/football-logic/match.test.ts` (append al final; imports 11-15)
- Modify: `components/games/football-screen/hud.ts:63-68` (`halfLabel`), `components/games/football-screen/hud.test.ts` (append en `describe('halfLabel')`, línea 77-91)
- Create: `.superpowers/sdd/2026-09-09-vault-world-cup-step-9/progress.md`

**Interfaces:**
- Consumes: `positionTeam`, `keeperStep` (`ai.ts`), `stepPhysics` (`step.ts`), `PlayerState.role/team` (`players.ts`), `BallState.owner` (`ball.ts`).
- Produces:

```ts
// match.ts
export type MatchRules = { timed: boolean; frozenTeam: -1 | 0 | 1 };
export const NORMAL_RULES: Readonly<MatchRules>;     // { timed: true, frozenTeam: -1 }
export const TRAINING_RULES: Readonly<MatchRules>;   // { timed: false, frozenTeam: 1 }
export type MatchState = { /* …paso 8… */ rules: Readonly<MatchRules> };
export function createMatch(
  teams: [TeamDef, TeamDef], formationTable: readonly Formation[], pitch: PitchDef,
  profiles: readonly [AiProfile, AiProfile], rules: Readonly<MatchRules> = NORMAL_RULES,
): MatchState;
// hud.ts
export function halfLabel(match: MatchState): string;   // 'ENTRENAMIENTO' cuando !match.rules.timed
```

**Decisiones fijadas con test en esta tarea (S-FL1, S-FL2):**
- **Saque de centro tras un gol del humano en entrenamiento: el automático a los 5 s que ya existe** (S-FL1). `endGoalPause` sigue dando el saque al equipo que encajó (el congelado); `beginSetPiece` le teletransporta un lanzador al balón (`nearestOutfield` + `placeTaker`) y `stepSetPiece` ejecuta el pase corto solo al agotarse la cuenta atrás. Cero código nuevo: el jugador ve el rótulo INICIO, cinco segundos, y el balón sale hacia su campo. La alternativa (saque siempre del humano) tocaba `endGoalPause` y `kickoffTeamFor` para un caso que el automático ya resuelve.
- **Los siete congelados NO recogen balones sueltos** (S-FL2): un pase largo que aterriza junto a una estatua no puede quedarse pegado a su pie o el drill de pases se convierte en un drill de robos. `canPickUp` vive en `ball.ts` (no autorizado) y `pickUp` corre dentro de `stepBall`; la regla se aplica **en `match.ts`, justo después de `stepPhysics`**: si el dueño del balón es un jugador de campo del equipo congelado, se suelta (`ball.owner = null`; `givePossession` ya lo dejó en reposo a `CONTROL_DIST` de su pie, y el humano lo recoge al llegar a menos de 18 u —`pickUp` elige al más cercano dentro de `POSSESSION_RADIUS` (22) y la estatua está a 18—; **no hace falta ni es posible robarlo con K**: `steal` exige un dueño rival y al final de cada paso el balón no tiene dueño. Cada paso la estatua lo «recoge» dentro de `stepBall` y `dropFrozenPickup` lo suelta: 18 comparaciones, cero asignaciones, mismo resultado paso a paso). El portero congelado sigue recogiendo y atajando (sus `keeperStep`/`keeperCatch` no se tocan). `players.ts` **no hace falta**.

- [ ] **Step 1: Crear el ledger SDD del paso**

Crear `.superpowers/sdd/2026-09-09-vault-world-cup-step-9/progress.md`:

```markdown
# SDD ledger — plan: docs/superpowers/plans/2026-09-09-vault-world-cup-step-9.md

Spec: specs/31-vault-world-cup.md (paso 9 de la Etapa C, G9-1..G9-9 del grill del 09-sep) — autoridad vinculante. Rama main.
Baseline: 1050 tests / 62 ficheros, tsc limpio, build 0. BASE = 0e553af (paso 8). Motor congelado SALVO Task 9-1
(match.ts + match.test.ts): `git diff --stat 0e553af -- components/games/football-logic/` solo puede listar esos dos.
Commits SOLO Paco. Nunca next dev (Paco juega en su :3000).

## Rulings
- G9-1..G9-9 (Paco, 09-sep): en el spec, §Decisiones, último bullet. No se relitigan.
- S-FL1 (plan): saque tras gol en entrenamiento = automático a los 5 s (sin código). S-FL2: los congelados no
  recogen balones sueltos, regla en match.ts tras stepPhysics (dropFrozenPickup), players.ts intacto.

## Progreso
```

- [ ] **Step 2: Escribir los tests que fallan del motor**

Añadir al final de `components/games/football-logic/match.test.ts`. Ampliar primero el import de `./match` (líneas 11-15) con `NORMAL_RULES, TRAINING_RULES`:

```ts
import {
  EXTRA_TIME_SECONDS, EXTRA_TIME_STEPS, GOAL_PAUSE_STEPS, HALF_SECONDS, HALF_SECONDS_MAX, HALF_STEPS, HALF_TIME_PAUSE_STEPS,
  NORMAL_RULES, TRAINING_RULES,
  abandon, callSetPiece, createMatch, endExtraTime, endGoalPause, endHalf, endHalfTime, endShootout, isOpenPlay,
  kickoffTeamFor, resumePlay, scoreGoal, stepMatch, winnerOf, type MatchPhase, type MatchState,
} from './match';
```

Y el bloque nuevo, al final del fichero:

```ts
// ── G9-1: training rules. Flag off = the normal match, byte for byte. ────────
describe('G9-1: match rules (clock off, frozen team)', () => {
  function training(): MatchState {
    return createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES, TRAINING_RULES);
  }

  it('createMatch without rules is the normal match: NORMAL_RULES, and an identical run to an explicit one', () => {
    const implicit = fresh();
    const explicit = createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES, NORMAL_RULES);
    expect(implicit.rules).toEqual({ timed: true, frozenTeam: -1 });
    expect(TRAINING_RULES).toEqual({ timed: false, frozenTeam: 1 });
    idle(implicit, 2000, createRng(7));
    idle(explicit, 2000, createRng(7));
    expect(snapshot(implicit)).toBe(snapshot(explicit));
  });

  it('with the clock off, 10 000 steps leave halfStep, clockMs and the half untouched; the normal match has moved on', () => {
    const t = training();
    const n = fresh();
    idle(t, 10_000, createRng(3));
    idle(n, 10_000, createRng(3));
    expect(t.halfStep).toBe(0);
    expect(t.clockMs).toBe(0);
    expect(t.half).toBe(1);
    expect(t.phase).not.toBe('over');
    expect(t.phase).not.toBe('half-time');
    expect(t.shootout).toBeNull();
    // The control case (risk 7): the same 10 000 idle steps DO move the normal clock --
    // past the first half (5 400 steps of play + a 300-step kickoff + a 180-step break).
    expect(n.half === 2 || n.halfStep > 0).toBe(true);
  });

  it('the frozen team\'s eight outfield players stay exactly where the kickoff placed them, while the other team moves', () => {
    const t = training();
    // Through the kickoff countdown (team 0 takes it: kickoffTeamFor(1)) into open play.
    idle(t, SET_PIECE_COUNTDOWN_STEPS + 1, createRng(5));
    expect(isOpenPlay(t.phase)).toBe(true);
    const frozenX: number[] = [];
    const frozenY: number[] = [];
    const freeX: number[] = [];
    for (let i = 0; i < t.players.length; i++) {
      const p = t.players[i];
      if (p.role === 'gk') continue;
      if (p.team === 1) { frozenX.push(p.x); frozenY.push(p.y); } else freeX.push(p.x);
    }
    idle(t, 2000, createRng(5));
    let k = 0;
    let f = 0;
    let moved = 0;
    for (let i = 0; i < t.players.length; i++) {
      const p = t.players[i];
      if (p.role === 'gk') continue;
      if (p.team === 1) {
        expect(p.x).toBe(frozenX[k]);
        expect(p.y).toBe(frozenY[k]);
        k++;
      } else {
        // `f` indexes freeX in the same order it was filled; `moved` only counts.
        if (p.x !== freeX[f]) moved++;
        f++;
      }
    }
    expect(k).toBe(OUTFIELD_COUNT);
    // The control case: the un-frozen team's AI still drifts its players towards the ball.
    expect(moved).toBeGreaterThan(0);
  });

  it('the frozen team\'s keeper is still alive: he comes out for a loose ball in his small area', () => {
    const t = training();
    idle(t, SET_PIECE_COUNTDOWN_STEPS + 1, createRng(5));
    const gk = t.players[1 * TEAM_SIZE];
    // Team 1 attacks -x, so its own goal is at x = width. A resting ball inside its
    // small area, off the centre line, with no frozen mate anywhere near it.
    t.ball.owner = null;
    t.ball.x = PITCH.width - PITCH.smallAreaDepth / 2;
    t.ball.y = CY + PITCH.smallAreaWidth / 4;
    t.ball.vx = 0; t.ball.vy = 0; t.ball.vz = 0; t.ball.z = 0;
    t.ball.kickerId = null;
    const startX = gk.x;
    const startY = gk.y;
    idle(t, 10, createRng(5));
    expect(gk.x !== startX || gk.y !== startY).toBe(true);
  });

  it('a frozen outfield player never ends a step holding the ball; with normal rules the same player picks it up', () => {
    for (const rules of [TRAINING_RULES, NORMAL_RULES]) {
      const m = createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES, rules);
      idle(m, SET_PIECE_COUNTDOWN_STEPS + 1, createRng(9));
      const statue = m.players[1 * TEAM_SIZE + 4];   // a team-1 midfielder (slot 3)
      m.ball.owner = null;
      m.ball.x = statue.x + 10;
      m.ball.y = statue.y;
      m.ball.vx = 0; m.ball.vy = 0; m.ball.vz = 0; m.ball.z = 0;
      m.ball.kickerId = null;
      stepMatch(m, IDLE, createRng(9));
      if (rules === TRAINING_RULES) expect(m.ball.owner).toBeNull();
      else expect(m.ball.owner).toBe(statue.id);
    }
  });

  it('after a goal in training the frozen team kicks off automatically at the end of the countdown, and the clock still reads zero (S-FL1)', () => {
    const t = training();
    idle(t, SET_PIECE_COUNTDOWN_STEPS + 1, createRng(11));
    expect(scoreGoal(t, 0)).toBe(true);
    expect(t.score[0]).toBe(1);
    idle(t, GOAL_PAUSE_STEPS, createRng(11));
    expect(t.phase).toBe('kickoff');
    expect(t.setPiece?.team).toBe(1);
    idle(t, SET_PIECE_COUNTDOWN_STEPS, createRng(11));
    expect(isOpenPlay(t.phase)).toBe(true);
    // The automatic short pass is away: nobody of the frozen outfield holds it.
    const owner = t.ball.owner;
    expect(owner === null || t.players[owner].team === 0 || t.players[owner].role === 'gk').toBe(true);
    expect(t.halfStep).toBe(0);
  });
});
```

`OUTFIELD_COUNT` es la constante `OUTFIELD` de `teams.ts` (8): añadirla al import de la línea 3 del test (`import { FORMATIONS, TEAMS, TEAM_SIZE, OUTFIELD as OUTFIELD_COUNT, … } from './teams';`).

- [ ] **Step 3: Ver fallar**

Run: `npx vitest run components/games/football-logic/match.test.ts`
Expected: FAIL — `NORMAL_RULES`/`TRAINING_RULES` no exportadas (`SyntaxError: The requested module './match' does not provide an export named 'NORMAL_RULES'`).

- [ ] **Step 4: Escribir el motor**

En `components/games/football-logic/match.ts`:

(a) Antes de `export type MatchState` (línea 26):

```ts
// ── G9-1 (Paco, 09-sep): the training mode is a RULESET of the match, not a mode.
// The engine still does not know what it is playing; it knows two switches:
//   · timed      — advanceClock is a no-op when false: no half ends, no extra time,
//                  no shootout. The match only ends by abandon().
//   · frozenTeam — that team's outfield players skip positionTeam (their want
//                  channel stays at zero: they stand at their anchors), and never end a
//                  step holding a loose ball (dropFrozenPickup, S-FL2). Its KEEPER is
//                  untouched: keeperStep, keeperCatch and the automatic release all
//                  still run, which is what makes it a shooting drill and not a void.
// NORMAL_RULES is the default of createMatch, so every existing call and test is the
// match it always was, byte for byte (see the first G9-1 test).
export type MatchRules = { timed: boolean; frozenTeam: -1 | 0 | 1 };
export const NORMAL_RULES: Readonly<MatchRules> = { timed: true, frozenTeam: -1 };
export const TRAINING_RULES: Readonly<MatchRules> = { timed: false, frozenTeam: 1 };
```

(b) En `MatchState`, tras `profiles: readonly [AiProfile, AiProfile];` (línea 47):

```ts
  rules: Readonly<MatchRules>;
```

(c) `createMatch` (línea 110): quinto parámetro y el campo en el literal:

```ts
export function createMatch(
  teams: [TeamDef, TeamDef], formationTable: readonly Formation[], pitch: PitchDef,
  profiles: readonly [AiProfile, AiProfile], rules: Readonly<MatchRules> = NORMAL_RULES,
): MatchState {
  const match: MatchState = {
    teams,
    // … (el literal del paso 8, sin cambios) …
    profiles,
    rules,
    catchRolled: [false, false],
```

(d) `advanceClock` (línea 267):

```ts
function advanceClock(match: MatchState): void {
  if (!match.rules.timed) return;   // G9-1: a training match has no clock at all
  match.halfStep++;
}
```

(e) `runTeamAi` (línea 296):

```ts
function runTeamAi(match: MatchState, team: 0 | 1): void {
  const { players, ball, scratch } = match;
  // G9-1: the frozen team's outfield stands still (its want channel is left at the
  // zero placeByFormation wrote); its keeper is positioned like any other.
  if (team !== match.rules.frozenTeam) {
    positionTeam(players, ball, team, match.formationTable[match.formationIndex[team]], match.strategies[team], match.attackDir[team], scratch.liveControlled[team], match.pitch, match.stepCount, scratch.aim);
  }
  keeperStep(keeperOf(match, team), players, ball, match.attackDir[team], match.pitch, match.stepCount);
}

// S-FL2 (G9-1): a frozen OUTFIELD player never keeps a loose ball. pickUp runs inside
// stepBall (ball.ts, not part of this change) and has just glued the ball to his foot
// at CONTROL_DIST, at rest; letting go here leaves it exactly there, loose, for the
// human to collect by getting closer than the statue (under 18 u; pickUp takes the
// nearest). Repeats every step while it lies there: 18 comparisons, no allocation.
// The keeper is deliberately excluded: a training drill needs someone to beat.
function dropFrozenPickup(match: MatchState): void {
  const frozen = match.rules.frozenTeam;
  const owner = match.ball.owner;
  if (frozen < 0 || owner === null) return;
  const p = match.players[owner];
  if (p.team !== frozen || p.role === 'gk') return;
  match.ball.owner = null;
}
```

(f) En `stepOpenPlay`, justo después de la llamada a `stepPhysics(...)` (línea 349):

```ts
  stepPhysics(players, ball, inputs, scratch.liveControlled, match.attackDir, match.pitch, match.stepCount);
  dropFrozenPickup(match);
```

- [ ] **Step 5: Verde del motor**

Run: `npx vitest run components/games/football-logic/match.test.ts`
Expected: PASS, **142 tests** (136 + 6: `npx vitest run` cuenta 136 hoy en este fichero, no 66, porque varios `it` viven dentro de bucles `for`; el recuento de `grep -c "it("` engaña). Si el tercer test («stay exactly where the kickoff placed them») falla porque una estatua se movió, la causa es un `pushRivalsAway` de un saque de banda ocurrido en esos 2 000 pasos: **no cambiar la regla**; sustituir `idle(t, 2000, …)` por `idle(t, 600, …)` y anotarlo en el ledger (el drill no necesita que nunca se muevan por un saque, necesita que no se muevan por la IA).

- [ ] **Step 6: Escribir el test que falla del HUD y su implementación**

Añadir dentro de `describe('halfLabel', …)` de `components/games/football-screen/hud.test.ts` (tras el `it` existente, línea 91), y `TRAINING_RULES` al import de `../football-logic/match` (línea 3):

```ts
  // G9-1: a training match has no clock, so the half is not what the strip should say.
  it('reads ENTRENAMIENTO for a match without a clock, whatever the half or phase', () => {
    const m = createMatch(
      [TEAMS[0], TEAMS[1]], FORMATIONS, PITCH,
      [humanProfile(TEAMS[0], 5), profileFor(TEAMS[1], 5)], TRAINING_RULES,
    );
    expect(halfLabel(m)).toBe('ENTRENAMIENTO');
    m.phase = 'goal';
    expect(halfLabel(m)).toBe('ENTRENAMIENTO');
  });
```

En `components/games/football-screen/hud.ts`, `halfLabel` (línea 63):

```ts
const TRAINING_LABEL = 'ENTRENAMIENTO';

export function halfLabel(match: MatchState): string {
  if (!match.rules.timed) return TRAINING_LABEL;   // G9-1: no clock, no half to name
  if (match.phase === 'shootout') return 'PENALTIS';
  if (match.phase === 'half-time') return 'DESCANSO';
  if (match.half === 3) return 'PRÓRROGA';
  return match.half === 1 ? '1ª PARTE' : '2ª PARTE';
}
```

Run: `npx vitest run components/games/football-screen/hud.test.ts`
Expected: PASS (los del paso 8 + 1).

- [ ] **Step 7: Suite completa y tipos**

Run: `npx vitest run && npx tsc --noEmit`
Expected: **1057 tests en 62 ficheros** (1050 + 6 + 1); `tsc` sin salida. Anotar el recuento real en el ledger.

- [ ] **Step 8: Comprobar que el motor solo cambió donde debía**

Run: `git diff --stat 0e553af -- components/games/football-logic/ && git status --short components/games/football-logic/ && grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/`
Expected: el `diff --stat` lista **solo** `match.ts` y `match.test.ts`; `git status` muestra `M` en esos dos y nada más; el grep **vacío**.

- [ ] **Step 9: Anotar en el ledger y proponer commit**

Añadir a `progress.md`: `Task 9-1: DONE (1057/1057 en 62 ficheros; motor: match.ts + match.test.ts; hud.ts halfLabel; S-FL1/S-FL2 fijados con test).`

No ejecutar. Mensaje propuesto:

`feat(world-cup): training rules in the engine — clock off and frozen team, default normal (G9-1)`

**QA de Paco para esta tarea:** ninguno todavía (no hay selector). Se verifica al llegar la 9-7.

---

## Task 9-2: `keyboard.ts` con dos tablas de teclas (G9-2) y `loop.ts`/`match-loop.ts` con velocidad x4 (G9-3)

**Files:**
- Modify: `components/games/football-screen/keyboard.ts` (`padKeyFor` 51-54, `padChoice` 115-127; añadir `KeyTable` y las tres tablas tras `STRATEGY_BY_KEY`, línea 33)
- Modify: `components/games/football-screen/keyboard.test.ts` (edición mecánica de argumentos + bloque nuevo al final)
- Modify: `components/games/football-screen/loop.ts` (`planSteps` 22-38), `loop.test.ts` (bloque nuevo)
- Modify: `components/games/football-screen/match-loop.ts` (`planFrame` 36-59), `match-loop.test.ts` (un test nuevo)

**Interfaces:**
- Consumes: `KEY_BINDINGS`, `FORMATION_KEYS`, `STRATEGY_KEYS`, `STRATEGY_BY_KEY`, `PadState`, `PadKey` (`keyboard.ts` del paso 8); `STEP_MS`, `MAX_STEPS_PER_FRAME` (`loop.ts`).
- Produces:

```ts
// keyboard.ts
export type KeyTable = {
  readonly pad: Readonly<Record<string, PadKey>>;
  readonly formation: readonly string[];
  readonly strategy: readonly string[];
};
export const SOLO: KeyTable;              // { pad: KEY_BINDINGS, formation: FORMATION_KEYS, strategy: STRATEGY_KEYS }
export const TWO_PLAYER_P1: KeyTable;     // w/a/s/d + c/v/b · '1','2','3' / '4','5','6'
export const TWO_PLAYER_P2: KeyTable;     // flechas + j/k/l · '7','8','9' / '0',"'",'¡'
export const TWO_PLAYER_TABLES: readonly [KeyTable, KeyTable];
export function padKeyFor(table: KeyTable, key: string): PadKey | null;
export function padChoice(pad: PadState, table: KeyTable, key: string): boolean;
export function tablesShareKey(a: KeyTable, b: KeyTable): string | null;   // primera tecla compartida, o null
// loop.ts
export const SPECTATE_SPEED = 4;
export function planSteps(accumulatorMs: number, out: StepBudget, speed?: number): void;   // pasos ×speed, tope ×speed
// match-loop.ts
export function planFrame(phase, paused, blocked, accumulatorMs, frameMs, budget, out, speed?: number): number;
```

- [ ] **Step 1: Edición mecánica de los tests existentes de `keyboard.ts`**

`padKeyFor` y `padChoice` pasan a recibir la tabla. Los 15 tests del paso 8 no cambian de valor esperado: solo reciben `SOLO`. Ejecutar exactamente:

```bash
sed -i '' "s/padKeyFor('/padKeyFor(SOLO, '/g; s/padChoice(pad, '/padChoice(pad, SOLO, '/g" components/games/football-screen/keyboard.test.ts
```

Y en el import de `./keyboard` (líneas 5-7 del test) añadir `KEY_BINDINGS, SOLO, TWO_PLAYER_P1, TWO_PLAYER_P2, tablesShareKey`:

```ts
import {
  KEY_BINDINGS, SOLO, TWO_PLAYER_P1, TWO_PLAYER_P2,
  createPadState, padAdvance, padBlur, padChoice, padClear, padDown, padKeyFor, padToTeamInput, padUp, tablesShareKey,
} from './keyboard';
```

Comprobar: `grep -c "SOLO, '" components/games/football-screen/keyboard.test.ts` → **20** (las 20 llamadas contadas al escribir este plan).

- [ ] **Step 2: Escribir los tests que fallan de las dos tablas**

Añadir al final de `components/games/football-screen/keyboard.test.ts`:

```ts
// ── G9-2 (Paco, 09-sep): two people, one keyboard, each with their own half. ──
describe('the two-player key tables', () => {
  it('J1 moves with WASD and fires A/B/C on C/V/B; J2 moves with the arrows and fires on J/K/L', () => {
    expect(padKeyFor(TWO_PLAYER_P1, 'w')).toBe('up');
    expect(padKeyFor(TWO_PLAYER_P1, 's')).toBe('down');
    expect(padKeyFor(TWO_PLAYER_P1, 'a')).toBe('left');
    expect(padKeyFor(TWO_PLAYER_P1, 'd')).toBe('right');
    expect(padKeyFor(TWO_PLAYER_P1, 'c')).toBe('a');
    expect(padKeyFor(TWO_PLAYER_P1, 'v')).toBe('b');
    expect(padKeyFor(TWO_PLAYER_P1, 'b')).toBe('c');
    expect(padKeyFor(TWO_PLAYER_P2, 'arrowup')).toBe('up');
    expect(padKeyFor(TWO_PLAYER_P2, 'arrowdown')).toBe('down');
    expect(padKeyFor(TWO_PLAYER_P2, 'arrowleft')).toBe('left');
    expect(padKeyFor(TWO_PLAYER_P2, 'arrowright')).toBe('right');
    expect(padKeyFor(TWO_PLAYER_P2, 'j')).toBe('a');
    expect(padKeyFor(TWO_PLAYER_P2, 'k')).toBe('b');
    expect(padKeyFor(TWO_PLAYER_P2, 'l')).toBe('c');
  });

  // The spec's own sentence: "en el modo a dos WASD deja de mover a J2 y las flechas
  // dejan de mover a J1". KEY_BINDINGS maps both to the same d-pad; here it is SPLIT.
  it('in the two-player mode WASD no longer moves J2 and the arrows no longer move J1', () => {
    for (const k of ['w', 'a', 's', 'd', 'c', 'v', 'b']) expect(padKeyFor(TWO_PLAYER_P2, k)).toBeNull();
    for (const k of ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'j', 'k', 'l']) expect(padKeyFor(TWO_PLAYER_P1, k)).toBeNull();
  });

  it('no key appears in both tables -- d-pad, buttons and number rows included', () => {
    expect(tablesShareKey(TWO_PLAYER_P1, TWO_PLAYER_P2)).toBeNull();
    expect(tablesShareKey(TWO_PLAYER_P2, TWO_PLAYER_P1)).toBeNull();
    // The check is not vacuous: SOLO and J2 both carry the arrows.
    expect(tablesShareKey(SOLO, TWO_PLAYER_P2)).toBe('arrowup');
  });

  it('J2 is a subset of the solo map, so whoever plays alone never relearns a key', () => {
    for (const [key, value] of Object.entries(TWO_PLAYER_P2.pad)) expect(SOLO.pad[key]).toBe(value);
    expect(TWO_PLAYER_P1.formation).toEqual(SOLO.formation);
    expect(TWO_PLAYER_P1.strategy).toEqual(SOLO.strategy);
  });

  it('the solo table IS the step-8 map: same objects, not copies', () => {
    expect(SOLO.pad).toBe(KEY_BINDINGS);
    expect(padKeyFor(SOLO, 'w')).toBe('up');
    expect(padKeyFor(SOLO, 'arrowup')).toBe('up');
    expect(padKeyFor(SOLO, 'c')).toBeNull();   // C/V/B only exist for J1 in the two-player mode
  });

  it("J2 picks the formation on 7/8/9 and the strategy on 0 ' ¡, and ignores J1's number row", () => {
    const pad = createPadState('neutral', 0);
    expect(padChoice(pad, TWO_PLAYER_P2, '9')).toBe(true);
    expect(pad.formation).toBe(2);
    expect(padChoice(pad, TWO_PLAYER_P2, '0')).toBe(true);
    expect(pad.strategy).toBe('attack');
    expect(padChoice(pad, TWO_PLAYER_P2, "'")).toBe(true);
    expect(pad.strategy).toBe('neutral');
    expect(padChoice(pad, TWO_PLAYER_P2, '¡')).toBe(true);
    expect(pad.strategy).toBe('defend');
    expect(padChoice(pad, TWO_PLAYER_P2, '1')).toBe(false);
    expect(pad.formation).toBe(2);
    // And symmetrically: J1's pad ignores J2's row.
    const pad1 = createPadState('neutral', 0);
    expect(padChoice(pad1, TWO_PLAYER_P1, '7')).toBe(false);
    expect(pad1.formation).toBe(0);
  });

  // Two pads, two tables, one keydown handler: a key of one table must leave the other
  // pad untouched. This is what the component's handler relies on in the two-player mode.
  it('routing a key through both tables moves exactly one of the two pads', () => {
    const pads = [createPadState('neutral', 0), createPadState('neutral', 0)];
    const tables = [TWO_PLAYER_P1, TWO_PLAYER_P2];
    for (let t = 0; t < 2; t++) {
      const k = padKeyFor(tables[t], 'arrowleft');
      if (k !== null) padDown(pads[t], k);
    }
    expect(pads[0].left).toBe(false);
    expect(pads[1].left).toBe(true);
    for (let t = 0; t < 2; t++) {
      const k = padKeyFor(tables[t], 'c');
      if (k !== null) padDown(pads[t], k);
    }
    expect(pads[0].a).toBe('pressed');
    expect(pads[1].a).toBe('up');
  });
});
```

- [ ] **Step 3: Ver fallar**

Run: `npx vitest run components/games/football-screen/keyboard.test.ts`
Expected: FAIL — `SOLO` no exportado (`does not provide an export named 'SOLO'`).

- [ ] **Step 4: Escribir las tablas en `keyboard.ts`**

Sustituir `padKeyFor` (líneas 51-54) y `padChoice` (115-129), y añadir tras `STRATEGY_BY_KEY` (línea 33):

```ts
// G9-2 (Paco, 09-sep): two people on one keyboard, each with their own half.
//   J1 (left)  — W/A/S/D, A/B/C on C/V/B, formation 1-2-3, strategy 4-5-6.
//   J2 (right) — the arrows, A/B/C on J/K/L (the solo map, nothing to relearn),
//                formation 7-8-9, strategy 0 ' ¡ (the rest of the Spanish ISO row).
// N and M are left free as the physical gap. In the two-player mode WASD no longer
// moves J2 and the arrows no longer move J1 -- KEY_BINDINGS is SPLIT, not extended.
// Solo and World Cup keep KEY_BINDINGS untouched. Every table is DERIVED from the
// step-8 constants (final review §8.2): pickBindings throws at module load if a key
// listed here is not in KEY_BINDINGS, so the two can never drift apart.
export type KeyTable = {
  readonly pad: Readonly<Record<string, PadKey>>;
  readonly formation: readonly string[];
  readonly strategy: readonly string[];
};

function pickBindings(source: Readonly<Record<string, PadKey>>, keys: readonly string[]): Record<string, PadKey> {
  const out: Record<string, PadKey> = {};
  for (const key of keys) {
    const value = source[key];
    if (value === undefined) throw new Error(`key not in KEY_BINDINGS: ${key}`);
    out[key] = value;
  }
  return out;
}

const P1_MOVE_KEYS: readonly string[] = ['w', 'a', 's', 'd'];
const P2_KEYS: readonly string[] = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'j', 'k', 'l'];

export const SOLO: KeyTable = { pad: KEY_BINDINGS, formation: FORMATION_KEYS, strategy: STRATEGY_KEYS };

export const TWO_PLAYER_P1: KeyTable = {
  pad: { ...pickBindings(KEY_BINDINGS, P1_MOVE_KEYS), c: 'a', v: 'b', b: 'c' },
  formation: FORMATION_KEYS,
  strategy: STRATEGY_KEYS,
};

export const TWO_PLAYER_P2: KeyTable = {
  pad: pickBindings(KEY_BINDINGS, P2_KEYS),
  formation: ['7', '8', '9'],
  strategy: ['0', "'", '¡'],
};

// Indexed by team: the two-player friendly puts J1 on team 0 and J2 on team 1.
export const TWO_PLAYER_TABLES: readonly [KeyTable, KeyTable] = [TWO_PLAYER_P1, TWO_PLAYER_P2];

export function padKeyFor(table: KeyTable, key: string): PadKey | null {
  const k = table.pad[key];
  return k === undefined ? null : k;
}

// Returns true when the key was a formation/strategy choice of THIS table, so the
// caller knows to preventDefault. The engine applies both every step
// (applyTeamChoices): writing them into the TeamInput IS the change.
export function padChoice(pad: PadState, table: KeyTable, key: string): boolean {
  const f = table.formation.indexOf(key);
  if (f >= 0) {
    pad.formation = f;
    return true;
  }
  const s = table.strategy.indexOf(key);
  if (s >= 0) {
    pad.strategy = STRATEGY_BY_KEY[s];
    return true;
  }
  return false;
}

// The invariant of the two-player mode (spec risk 6: "ninguno puede pisarse"): the
// first key of `a` that `b` also reads, in any of its three rows, or null. Consumed
// by keyboard.test.ts and by the closing probe of the step; never by the loop
// (Object.keys allocates).
export function tablesShareKey(a: KeyTable, b: KeyTable): string | null {
  const readsKey = (key: string): boolean =>
    b.pad[key] !== undefined || b.formation.includes(key) || b.strategy.includes(key);
  for (const key of Object.keys(a.pad)) if (readsKey(key)) return key;
  for (const key of a.formation) if (readsKey(key)) return key;
  for (const key of a.strategy) if (readsKey(key)) return key;
  return null;
}
```

Borrar las anotaciones `// exported for Task 9: …` de `KEY_BINDINGS`, `FORMATION_KEYS`, `STRATEGY_KEYS`, `STRATEGY_BY_KEY` si las hay (Minor 8): ya tienen consumidor aquí mismo.

- [ ] **Step 5: Verde de `keyboard.ts`**

Run: `npx vitest run components/games/football-screen/keyboard.test.ts`
Expected: PASS, **22 tests** (15 + 7).

- [ ] **Step 6: Escribir los tests que fallan de la velocidad**

Añadir al final de `components/games/football-screen/loop.test.ts` (import: añadir `SPECTATE_SPEED` a la línea 3):

```ts
// ── G9-3: a CPU bout watched on screen runs at x4 (adjustable in QA). ─────────
describe('planSteps at SPECTATE_SPEED', () => {
  it('SPECTATE_SPEED is 4', () => {
    expect(SPECTATE_SPEED).toBe(4);
  });

  it('multiplies the steps of a frame by the speed and keeps the same real-time remainder', () => {
    const out = createStepBudget();
    planSteps(STEP_MS * 2 + 3, out, SPECTATE_SPEED);
    expect(out.steps).toBe(8);
    expect(out.carryMs).toBeCloseTo(3, 6);
  });

  it('multiplies the cap too, and still DROPS the surplus', () => {
    const out = createStepBudget();
    planSteps(STEP_MS * 40, out, SPECTATE_SPEED);
    expect(out.steps).toBe(MAX_STEPS_PER_FRAME * SPECTATE_SPEED);
    expect(out.carryMs).toBe(0);
  });

  it('a frame below one step plans nothing at any speed', () => {
    const out = createStepBudget();
    planSteps(STEP_MS - 0.01, out, SPECTATE_SPEED);
    expect(out.steps).toBe(0);
    expect(out.carryMs).toBeCloseTo(STEP_MS - 0.01, 6);
  });

  it('speed 1 is exactly the step-8 behaviour', () => {
    const a = createStepBudget();
    const b = createStepBudget();
    planSteps(STEP_MS * 4 + 3, a);
    planSteps(STEP_MS * 4 + 3, b, 1);
    expect(a).toEqual(b);
  });
});
```

Y en `components/games/football-screen/match-loop.test.ts` (import: añadir `SPECTATE_SPEED` al import de `./loop`, línea 6), dentro de `describe('planFrame')`:

```ts
  it('at SPECTATE_SPEED a frame plans four times the steps of the same real time', () => {
    const budget = createStepBudget();
    const plan = createFramePlan();
    const carry = planFrame('play', false, false, 0, STEP_MS * 3 + 1, budget, plan, SPECTATE_SPEED);
    expect(plan.mode).toBe('full');
    expect(plan.steps).toBe(12);
    expect(carry).toBeCloseTo(1, 6);
  });
```

Run: `npx vitest run components/games/football-screen/loop.test.ts components/games/football-screen/match-loop.test.ts`
Expected: FAIL — `SPECTATE_SPEED` no exportado.

- [ ] **Step 7: Escribir la velocidad**

`components/games/football-screen/loop.ts`, sustituir `planSteps` (líneas 20-38) y añadir la constante tras `MAX_STEPS_PER_FRAME`:

```ts
// G9-3: a CPU bout of the World Cup watched on screen runs at x4 -- four simulation
// steps per real step of time. The cap scales with it (20), so a backgrounded tab
// still cannot spiral, and the real-time remainder is untouched: the accumulator
// keeps counting wall time, only the exchange rate changes. Adjustable in QA.
export const SPECTATE_SPEED = 4;

// Writes into out; allocates nothing. When the cap bites, the surplus is DROPPED
// rather than carried, which is what keeps the loop from spiralling: carrying it
// would guarantee another capped frame, and another. `speed` multiplies both the
// steps and the cap; 1 is the human match.
export function planSteps(accumulatorMs: number, out: StepBudget, speed = 1): void {
  if (accumulatorMs <= 0) {
    out.steps = 0;
    out.carryMs = 0;
    return;
  }
  let whole = Math.floor(accumulatorMs / STEP_MS);
  if (whole >= MAX_STEPS_PER_FRAME) {
    out.steps = MAX_STEPS_PER_FRAME * speed;
    out.carryMs = 0;
    return;
  }
  if (whole < 0) whole = 0;
  out.steps = whole * speed;
  out.carryMs = accumulatorMs - whole * STEP_MS;
}
```

`components/games/football-screen/match-loop.ts`, `planFrame` (líneas 36-59): último parámetro `speed = 1` y pasarlo:

```ts
export function planFrame(
  phase: MatchPhase,
  paused: boolean,
  blocked: boolean,
  accumulatorMs: number,
  frameMs: number,
  budget: StepBudget,
  out: FramePlan,
  speed = 1,
): number {
  out.mode = frameMode(phase, paused, blocked);
  if (out.mode === 'frozen') {
    out.steps = 0;
    out.advancePad = false;
    return accumulatorMs;
  }
  planSteps(accumulatorMs + frameMs, budget, speed);
  out.steps = budget.steps;
  out.advancePad = out.mode === 'full' && budget.steps > 0;
  return budget.carryMs;
}
```

- [ ] **Step 8: Verde y suite completa**

Run: `npx vitest run components/games/football-screen/ && npx vitest run && npx tsc --noEmit`
Expected: `keyboard` 22, `loop` 14 (9 + 5), `match-loop` 9 (8 + 1); **la suite pasa de 1057 a 1070 tests en 62 ficheros**; `tsc` sin salida. **`tsc` fallará en `components/games/VaultWorldCupGame.tsx` (líneas 881, 887, 891: `padKeyFor(key)` y `padChoice(pad, key)` con la firma vieja): arreglarlo AHORA con la edición mínima** —`padKeyFor(SOLO, key)` y `padChoice(pad, SOLO, key)`, importando `SOLO`—; la Task 9-7 reescribe esa zona entera.

- [ ] **Step 9: Motor intacto y azar**

Run: `git diff --stat 0e553af -- components/games/football-logic/ && grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/`
Expected: el diff solo lista `match.ts` y `match.test.ts` (Task 9-1); grep vacío.

- [ ] **Step 10: Ledger y proponer commit**

Ledger: `Task 9-2: DONE (1070/1070; keyboard 22, loop 14, match-loop 9; componente parcheado a SOLO hasta la 9-7).`

No ejecutar. Mensaje propuesto:

`feat(world-cup): two-player key tables split from KEY_BINDINGS and x4 step budget for spectated bouts`

**QA de Paco para esta tarea:** ninguno todavía; el teclado a dos se prueba con dos personas en la 9-7.

---

## Task 9-3: `football-logic/world-cup.ts` (sorteo, cuadro, puntuación) y `football-screen/match-run.ts` (el arnés de un partido)

**Por qué van juntos:** el cuadro necesita que alguien produzca el resultado de los cruces de la CPU (G9-3), y ese alguien es `MatchRun`: la misma función que la pantalla usa paso a paso para VER es la que SALTAR ejecuta headless, así que «misma semilla → mismo resultado se vea o no» es una propiedad por construcción y se fija con test aquí, antes de que exista el flujo.

**Files:**
- Create: `components/games/football-logic/world-cup.ts`, `components/games/football-logic/world-cup.test.ts`
- Create: `components/games/football-screen/match-run.ts`, `components/games/football-screen/match-run.test.ts`

**Interfaces:**
- Consumes: `winnerOf`, `createMatch`, `stepMatch`, `MatchState`, `MatchRules`, `NORMAL_RULES`, `TRAINING_RULES` (`match.ts`, Task 9-1); `Rng`, `createRng` (`rng.ts`); `TEAMS`, `TeamDef`, `FORMATIONS`, `teamById` (`teams.ts`); `PITCH`; `humanProfile`, `profileFor`, `createAiState`, `decideTeamInput`, `AiState`, `AiProfile` (`ai.ts`); `createTeamInput`, `TeamInput` (`input.ts`).
- Produces: las firmas de `world-cup.ts` y `match-run.ts` del «Contrato entre tareas» (File Structure), tal cual.

- [ ] **Step 1: Escribir el test que falla de `world-cup.ts`**

Crear `components/games/football-logic/world-cup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { humanProfile, profileFor } from './ai';
import { createMatch, type MatchState } from './match';
import { PITCH } from './pitch';
import { createRng } from './rng';
import { FORMATIONS, TEAMS, teamById } from './teams';
import {
  PERFECT_BASE_SCORE, ROUND_BONUS, ROUND_DIFFICULTY, ROUND_LABELS, SCORE_CLEAN_SHEET, SCORE_GOAL, SCORE_WIN, WORLD_CUP_SIZE,
  abandonHumanMatch, checkWorldCupBracket, createWorldCup, currentDifficulty, humanMatchSeed, humanOpponentId,
  humanPairIndex, humanSideInPair, isFinal, isStillIn, loseHumanMatch, matchPoints, matchSeedFor, nextCpuPair,
  pairAwayId, pairCount, pairHomeId, resolveCpuMatch, roundLabel, winHumanMatch,
  type WorldCupRound, type WorldCupState,
} from './world-cup';

const BANK_IDS: readonly string[] = TEAMS.map((t) => t.id);
const ROUNDS: readonly WorldCupRound[] = ['quarters', 'semis', 'final'];

function team(id: string) {
  const def = teamById(TEAMS, id);
  if (def === undefined) throw new Error(`missing team ${id}`);
  return def;
}

// A finished match between two ids with a given scoreboard. A level score with
// `shootoutWinner` set decides it on penalties the way the engine does: the shootout
// keeps its own scoreboard and match.score stays level (S-PK12).
function finished(homeId: string, awayId: string, homeGoals: number, awayGoals: number, shootoutWinner: 0 | 1 = 0): MatchState {
  const m = createMatch([team(homeId), team(awayId)], FORMATIONS, PITCH, [humanProfile(team(homeId), 5), profileFor(team(awayId), 5)]);
  m.score[0] = homeGoals;
  m.score[1] = awayGoals;
  if (homeGoals === awayGoals) {
    m.shootout = m.scratch.shootout;
    m.shootout.taken[0] = 5;
    m.shootout.taken[1] = 5;
    m.shootout.scored[0] = shootoutWinner === 0 ? 4 : 3;
    m.shootout.scored[1] = shootoutWinner === 0 ? 3 : 4;
  }
  m.phase = 'over';
  return m;
}

// Resolves every CPU pair of the current round (home wins 2-1) and plays the human's
// match with the given scoreboard from the human's point of view.
function playRound(wc: WorldCupState, goalsFor: number, goalsAgainst: number, humanWins: boolean): void {
  for (let p = nextCpuPair(wc); p !== -1; p = nextCpuPair(wc)) resolveCpuMatch(wc, p, 0, 2, 1);
  const pair = humanPairIndex(wc);
  const side = humanSideInPair(wc);
  const home = pairHomeId(wc, pair);
  const away = pairAwayId(wc, pair);
  const m = side === 0
    ? finished(home, away, goalsFor, goalsAgainst, humanWins ? 0 : 1)
    : finished(home, away, goalsAgainst, goalsFor, humanWins ? 1 : 0);
  if (humanWins) winHumanMatch(wc, m);
  else loseHumanMatch(wc, m);
}

describe('createWorldCup', () => {
  it('draws exactly eight distinct teams of the bank with the human inside, for EVERY team of the bank and three seeds', () => {
    for (const humanId of BANK_IDS) {
      for (const seed of [1, 42, 1234567]) {
        const wc = createWorldCup(BANK_IDS, humanId, seed, createRng(seed));
        expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
        expect(wc.bracket).toHaveLength(WORLD_CUP_SIZE);
        expect(wc.entrants).toHaveLength(WORLD_CUP_SIZE);
        expect(wc.round).toBe('quarters');
        expect(wc.status).toBe('playing');
        expect(wc.score).toBe(0);
        expect(isStillIn(wc, humanId)).toBe(true);
        expect(humanOpponentId(wc)).not.toBe(humanId);
      }
    }
  });

  it('same seed -> same bracket and the same three match seeds; a different seed -> a different bracket', () => {
    const a = createWorldCup(BANK_IDS, 'espana', 7, createRng(7));
    const b = createWorldCup(BANK_IDS, 'espana', 7, createRng(7));
    expect(a.bracket).toEqual(b.bracket);
    expect(humanMatchSeed(a)).toBe(humanMatchSeed(b));
    for (const round of ROUNDS) {
      for (let pair = 0; pair < 4; pair++) expect(matchSeedFor(7, round, pair)).toBe(matchSeedFor(7, round, pair));
    }
    const c = createWorldCup(BANK_IDS, 'espana', 8, createRng(8));
    expect(c.bracket).not.toEqual(a.bracket);
  });

  it('bracket and entrants are independent arrays in memory', () => {
    const wc = createWorldCup(BANK_IDS, 'italia', 3, createRng(3));
    expect(wc.entrants).not.toBe(wc.bracket);
    wc.entrants[0] = 'x';
    expect(wc.bracket[0]).not.toBe('x');
  });

  // S-PK3: team 0 kicks first in the shootout, and the human is team 0 only when the
  // draw put him first in his pair. Over 200 draws he must land on both sides.
  it('the draw puts the human on either side of his pair (S-PK3 kick order is drawn too)', () => {
    let first = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (humanSideInPair(createWorldCup(BANK_IDS, 'brasil', seed, createRng(seed))) === 0) first++;
    }
    expect(first).toBeGreaterThan(50);
    expect(first).toBeLessThan(150);
  });

  it('throws when the human is not in the bank', () => {
    expect(() => createWorldCup(BANK_IDS, 'atlantida', 1, createRng(1))).toThrow();
  });
});

describe('matchSeedFor', () => {
  it('gives twelve distinct 32-bit seeds for the twelve (round, pair) slots of one tournament seed, for several seeds', () => {
    for (const seed of [0, 1, 7, 42, 999_999, 0x7fffffff, 1_757_000_000_000]) {
      const seen = new Set<number>();
      for (const round of ROUNDS) {
        for (let pair = 0; pair < 4; pair++) {
          const s = matchSeedFor(seed, round, pair);
          expect(Number.isInteger(s)).toBe(true);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(0xffffffff);
          seen.add(s);
        }
      }
      expect(seen.size).toBe(12);
    }
  });

  it('two tournament seeds one apart do not share a match seed', () => {
    const a = new Set<number>();
    for (const round of ROUNDS) for (let p = 0; p < 4; p++) a.add(matchSeedFor(100, round, p));
    for (const round of ROUNDS) for (let p = 0; p < 4; p++) expect(a.has(matchSeedFor(101, round, p))).toBe(false);
  });
});

describe('round tables', () => {
  it('difficulty 4/6/8 and the three Spanish labels', () => {
    expect(ROUND_DIFFICULTY).toEqual({ quarters: 4, semis: 6, final: 8 });
    expect(ROUND_LABELS.quarters).toBe('CUARTOS DE FINAL');
    expect(ROUND_LABELS.semis).toBe('SEMIFINAL');
    expect(ROUND_LABELS.final).toBe('FINAL');
    const wc = createWorldCup(BANK_IDS, 'japon', 2, createRng(2));
    expect(currentDifficulty(wc)).toBe(4);
    expect(roundLabel(wc)).toBe('CUARTOS DE FINAL');
    expect(isFinal(wc)).toBe(false);
  });

  it('the scoring table of the spec, and the perfect base of 61 000', () => {
    expect(matchPoints(0, 0, false)).toBe(SCORE_CLEAN_SHEET);
    expect(matchPoints(2, 1, true)).toBe(2 * SCORE_GOAL + SCORE_WIN);
    expect(matchPoints(3, 0, true)).toBe(3 * SCORE_GOAL + SCORE_WIN + SCORE_CLEAN_SHEET);
    expect(matchPoints(1, 2, false)).toBe(SCORE_GOAL);
    expect(ROUND_BONUS).toEqual({ quarters: 5_000, semis: 10_000, final: 25_000 });
    expect(PERFECT_BASE_SCORE).toBe(61_000);
  });
});

describe('the CPU pairs of a round', () => {
  it('nextCpuPair walks the three pairs without the human; resolveCpuMatch marks each, and refuses the human pair and a repeat', () => {
    const wc = createWorldCup(BANK_IDS, 'francia', 5, createRng(5));
    const human = humanPairIndex(wc);
    const visited: number[] = [];
    for (let p = nextCpuPair(wc); p !== -1; p = nextCpuPair(wc)) {
      visited.push(p);
      resolveCpuMatch(wc, p, 1, 0, 3);
      expect(wc.resolved[p]).toBe(true);
      expect(wc.pairWinner[p]).toBe(pairAwayId(wc, p));
    }
    expect(visited).toHaveLength(3);
    expect(visited).not.toContain(human);
    expect(wc.resultCount).toBe(3);
    resolveCpuMatch(wc, human, 0, 1, 0);        // the human's pair: refused
    expect(wc.resolved[human]).toBe(false);
    resolveCpuMatch(wc, visited[0], 0, 5, 5);   // already resolved: refused
    expect(wc.pairWinner[visited[0]]).toBe(pairAwayId(wc, visited[0]));
    expect(wc.resultCount).toBe(3);
    expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
  });

  it('winHumanMatch throws while a CPU pair is still unresolved', () => {
    const wc = createWorldCup(BANK_IDS, 'francia', 5, createRng(5));
    const pair = humanPairIndex(wc);
    const m = humanSideInPair(wc) === 0
      ? finished(pairHomeId(wc, pair), pairAwayId(wc, pair), 1, 0)
      : finished(pairHomeId(wc, pair), pairAwayId(wc, pair), 0, 1);
    expect(() => winHumanMatch(wc, m)).toThrow();
  });

  it('winHumanMatch throws when the match does not carry the human on the side the pair says (S-PK3)', () => {
    const wc = createWorldCup(BANK_IDS, 'francia', 5, createRng(5));
    for (let p = nextCpuPair(wc); p !== -1; p = nextCpuPair(wc)) resolveCpuMatch(wc, p, 0, 1, 0);
    const pair = humanPairIndex(wc);
    // Deliberately swapped: the human on the wrong side of the pair.
    const swapped = humanSideInPair(wc) === 0
      ? finished(pairAwayId(wc, pair), pairHomeId(wc, pair), 0, 1)
      : finished(pairAwayId(wc, pair), pairHomeId(wc, pair), 1, 0);
    expect(() => winHumanMatch(wc, swapped)).toThrow();
  });
});

describe('winning the World Cup', () => {
  it('three exact wins make the champion, for EVERY team of the bank, with 61 000 + goals', () => {
    for (const humanId of BANK_IDS) {
      const wc = createWorldCup(BANK_IDS, humanId, 5, createRng(5));
      const sizes: number[] = [];
      for (let i = 0; i < 3; i++) {
        expect(wc.status).toBe('playing');
        sizes.push(wc.entrants.length);
        expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
        playRound(wc, 2, 0, true);
        expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
      }
      expect(sizes).toEqual([8, 4, 2]);
      expect(wc.status).toBe('champion');
      expect(wc.round).toBe('final');
      expect(wc.score).toBe(PERFECT_BASE_SCORE + 6 * SCORE_GOAL);
      expect(wc.resultCount).toBe(7);
    }
  });

  it('the winners of a round are exactly the next round\'s entrants, in pair order', () => {
    const wc = createWorldCup(BANK_IDS, 'uruguay', 9, createRng(9));
    const expected: string[] = [];
    for (let p = 0; p < pairCount(wc); p++) expected.push(p === humanPairIndex(wc) ? 'uruguay' : pairHomeId(wc, p));
    playRound(wc, 1, 0, true);
    expect(wc.entrants).toEqual(expected);
    expect(wc.round).toBe('semis');
    expect(currentDifficulty(wc)).toBe(6);
    expect(isStillIn(wc, expected[0])).toBe(true);
    expect(wc.resolved.every((r) => !r)).toBe(true);
  });

  it('a level match decided on penalties still scores a clean sheet for the human (S-PK12 read through match.score)', () => {
    const wc = createWorldCup(BANK_IDS, 'mexico', 4, createRng(4));
    playRound(wc, 0, 0, true);
    expect(wc.score).toBe(SCORE_WIN + SCORE_CLEAN_SHEET + ROUND_BONUS.quarters);
  });

  it('every transition is a no-op on a champion', () => {
    const wc = createWorldCup(BANK_IDS, 'croacia', 6, createRng(6));
    for (let i = 0; i < 3; i++) playRound(wc, 1, 0, true);
    const score = wc.score;
    const snapshot = JSON.stringify(wc);
    expect(nextCpuPair(wc)).toBe(-1);
    resolveCpuMatch(wc, 0, 0, 1, 0);
    abandonHumanMatch(wc);
    expect(wc.score).toBe(score);
    expect(JSON.stringify(wc)).toBe(snapshot);
  });
});

describe('losing and abandoning', () => {
  it('loseHumanMatch keeps the goals and the clean sheet, adds no win and no round bonus, and eliminates', () => {
    const a = createWorldCup(BANK_IDS, 'belgica', 12, createRng(12));
    playRound(a, 0, 1, false);
    expect(a.status).toBe('eliminated');
    expect(a.score).toBe(0);
    const b = createWorldCup(BANK_IDS, 'belgica', 12, createRng(12));
    playRound(b, 1, 2, false);
    expect(b.score).toBe(SCORE_GOAL);
    const c = createWorldCup(BANK_IDS, 'belgica', 12, createRng(12));
    playRound(c, 0, 0, false);   // lost on penalties at 0-0: the clean sheet counts for both
    expect(c.score).toBe(SCORE_CLEAN_SHEET);
    expect(c.resultCount).toBe(4);
    expect(c.results[3].winner).toBe(humanSideInPair(c) === 0 ? 1 : 0);
  });

  it('points from earlier rounds survive an elimination', () => {
    const wc = createWorldCup(BANK_IDS, 'portugal', 13, createRng(13));
    playRound(wc, 2, 0, true);
    const afterQuarters = wc.score;
    playRound(wc, 1, 3, false);
    expect(wc.score).toBe(afterQuarters + SCORE_GOAL);
    expect(wc.status).toBe('eliminated');
    expect(wc.round).toBe('semis');
  });

  it('abandonHumanMatch (G9-8, viewport guard): eliminated, the points so far are kept, nothing from the abandoned match', () => {
    const wc = createWorldCup(BANK_IDS, 'marruecos', 14, createRng(14));
    playRound(wc, 3, 1, true);
    const kept = wc.score;
    abandonHumanMatch(wc);
    expect(wc.status).toBe('eliminated');
    expect(wc.score).toBe(kept);
    expect(wc.resultCount).toBe(4);
    expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
  });

  it('every transition is a no-op on an eliminated tournament', () => {
    const wc = createWorldCup(BANK_IDS, 'argentina', 15, createRng(15));
    playRound(wc, 0, 2, false);
    const snapshot = JSON.stringify(wc);
    abandonHumanMatch(wc);
    resolveCpuMatch(wc, 0, 1, 0, 1);
    expect(() => winHumanMatch(wc, finished('argentina', 'italia', 1, 0))).not.toThrow();
    expect(JSON.stringify(wc)).toBe(snapshot);
  });
});

describe('checkWorldCupBracket', () => {
  function valid(): WorldCupState {
    return createWorldCup(BANK_IDS, 'espana', 21, createRng(21));
  }

  it('accepts a freshly drawn bracket and a mid-tournament one', () => {
    const wc = valid();
    expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
    playRound(wc, 1, 0, true);
    expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
  });

  it('rejects a duplicate seed, a seed outside the bank, and a bracket of the wrong size', () => {
    const dup = valid();
    dup.bracket[1] = dup.bracket[0];
    expect(checkWorldCupBracket(dup, BANK_IDS)).not.toEqual([]);
    const foreign = valid();
    foreign.bracket[2] = 'atlantida';
    expect(checkWorldCupBracket(foreign, BANK_IDS)).not.toEqual([]);
    const short = valid();
    short.bracket.pop();
    expect(checkWorldCupBracket(short, BANK_IDS)).not.toEqual([]);
  });

  it('rejects entrants of the wrong size for the round, an entrant outside the bracket, and a missing human', () => {
    const wrongSize = valid();
    wrongSize.round = 'semis';
    expect(checkWorldCupBracket(wrongSize, BANK_IDS)).not.toEqual([]);
    const outside = valid();
    outside.entrants[3] = 'atlantida';
    expect(checkWorldCupBracket(outside, BANK_IDS)).not.toEqual([]);
    const noHuman = valid();
    noHuman.entrants[noHuman.entrants.indexOf('espana')] = noHuman.entrants[0] === 'espana' ? noHuman.entrants[1] : noHuman.entrants[0];
    expect(checkWorldCupBracket(noHuman, BANK_IDS)).not.toEqual([]);
  });

  it('rejects a resolved pair whose winner is neither of its two teams', () => {
    const wc = valid();
    const p = nextCpuPair(wc);
    resolveCpuMatch(wc, p, 0, 1, 0);
    wc.pairWinner[p] = 'atlantida';
    expect(checkWorldCupBracket(wc, BANK_IDS)).not.toEqual([]);
  });
});
```

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run components/games/football-logic/world-cup.test.ts`
Expected: FAIL — `Failed to resolve import "./world-cup"`.

- [ ] **Step 3: Escribir `world-cup.ts`**

Crear `components/games/football-logic/world-cup.ts`:

```ts
import { winnerOf, type MatchState } from './match';
import type { Rng } from './rng';

// The World Cup as pure functions over a state mutated in place: the same pattern as
// fighter-logic/tournament.ts, not the same code (spec, data model). Eight drawn from
// the bank, straight knockout, three matches, eliminated with no CONTINUE. The engine
// never sees this module: it produces matches, and this module reads winnerOf().
export const WORLD_CUP_SIZE = 8;
export const WORLD_CUP_ROUNDS = 3;

export type WorldCupRound = 'quarters' | 'semis' | 'final';
export type WorldCupStatus = 'playing' | 'champion' | 'eliminated';

export type WorldCupResult = {
  round: WorldCupRound;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  winner: 0 | 1;
};

export type WorldCupState = {
  humanId: string;
  // G9-7: the tournament seed. The draw came off it (through the rng createWorldCup
  // received) and every match seed comes off it by integer arithmetic (matchSeedFor).
  seed: number;
  round: WorldCupRound;
  status: WorldCupStatus;
  score: number;
  // The eight in draw order, fixed for the whole run: `entrants` forgets who fell,
  // and the bracket screen exists to say it (tournament.ts has the same field for
  // the same reason).
  bracket: string[];
  // This round's participants, 8 -> 4 -> 2, paired as consecutive slots 0-1, 2-3…
  // Shrunk in place on advanceRound (length assignment), never reallocated.
  entrants: string[];
  // Per pair of the CURRENT round: the winner's id ('' while unresolved) and the flag.
  // Four slots created once; reset on advanceRound.
  pairWinner: string[];
  resolved: boolean[];
  // Every result of the run, in resolution order: 4 + 2 + 1 slots created once.
  results: WorldCupResult[];
  resultCount: number;
};

export const ROUND_LABELS: Readonly<Record<WorldCupRound, string>> = {
  quarters: 'CUARTOS DE FINAL',
  semis: 'SEMIFINAL',
  final: 'FINAL',
};

// G9-6 / spec: 4 in the quarters, 6 in the semis, 8 in the final. Numbers, not branches.
export const ROUND_DIFFICULTY: Readonly<Record<WorldCupRound, number>> = {
  quarters: 4,
  semis: 6,
  final: 8,
};

const NEXT_ROUND: Readonly<Record<WorldCupRound, WorldCupRound>> = {
  quarters: 'semis',
  semis: 'final',
  final: 'final',   // unreachable: winHumanMatch returns before consulting it in the final
};

const ROUND_INDEX: Readonly<Record<WorldCupRound, number>> = { quarters: 0, semis: 1, final: 2 };
const ROUND_ENTRANTS: Readonly<Record<WorldCupRound, number>> = { quarters: 8, semis: 4, final: 2 };

// The scoring table of the spec (§Decisiones estructurales). Only the World Cup
// scores: the friendlies never call anything here.
export const SCORE_GOAL = 1_000;
export const SCORE_WIN = 5_000;
export const SCORE_CLEAN_SHEET = 2_000;
export const SCORE_PASS_QUARTERS = 5_000;
export const SCORE_PASS_SEMIS = 10_000;
export const SCORE_CHAMPION = 25_000;
export const ROUND_BONUS: Readonly<Record<WorldCupRound, number>> = {
  quarters: SCORE_PASS_QUARTERS,
  semis: SCORE_PASS_SEMIS,
  final: SCORE_CHAMPION,
};
// 3 × 5 000 + 3 × 2 000 + 5 000 + 10 000 + 25 000 = 61 000 (spec: "~70 000 con goles").
export const PERFECT_BASE_SCORE = 3 * SCORE_WIN + 3 * SCORE_CLEAN_SHEET + SCORE_PASS_QUARTERS + SCORE_PASS_SEMIS + SCORE_CHAMPION;

// G9-7: one match seed per (round, pair), derived from the tournament seed with 32-bit
// integer arithmetic only (same discipline as CPU_SEED_SALT and ambienceSeedFor), so
// a replay of the whole tournament needs the one seed and nothing else. The three
// salts are the usual odd 32-bit mixing constants; the test asserts the twelve slots
// of one seed are distinct for several seeds.
const MATCH_SEED_SALT = 0x9e3779b1;
const ROUND_SEED_SALT = 0x85ebca6b;
const PAIR_SEED_SALT = 0xc2b2ae35;

export function matchSeedFor(seed: number, round: WorldCupRound, pair: number): number {
  const mixedRound = (seed ^ Math.imul(ROUND_SEED_SALT, ROUND_INDEX[round] + 1)) >>> 0;
  return (Math.imul(mixedRound, MATCH_SEED_SALT) + Math.imul(PAIR_SEED_SALT, pair + 1)) >>> 0;
}

function shuffled(items: readonly string[], rng: Rng): string[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// G9-4: the human chose; seven of the remaining fifteen are drawn, and the eight are
// shuffled AGAIN so the human's slot -- and with it who is team 0 of his pair, who
// kicks first in a shootout (S-PK3) -- is drawn too. Called once per run, never per
// frame: the two copies it makes are the price of a Fisher-Yates over a readonly bank.
function drawEight(bankIds: readonly string[], humanId: string, rng: Rng): string[] {
  const others: string[] = [];
  for (const id of bankIds) if (id !== humanId) others.push(id);
  if (others.length !== bankIds.length - 1) throw new Error(`human team not in bank: ${humanId}`);
  const drawn = shuffled(others, rng).slice(0, WORLD_CUP_SIZE - 1);
  drawn.push(humanId);
  return shuffled(drawn, rng);
}

export function createWorldCup(bankIds: readonly string[], humanId: string, seed: number, rng: Rng): WorldCupState {
  const bracket = drawEight(bankIds, humanId, rng);
  const entrants = [...bracket];
  const pairWinner: string[] = [];
  const resolved: boolean[] = [];
  for (let i = 0; i < WORLD_CUP_SIZE / 2; i++) {
    pairWinner.push('');
    resolved.push(false);
  }
  const results: WorldCupResult[] = [];
  for (let i = 0; i < WORLD_CUP_SIZE - 1; i++) {
    results.push({ round: 'quarters', homeId: '', awayId: '', homeGoals: 0, awayGoals: 0, winner: 0 });
  }
  return { humanId, seed, round: 'quarters', status: 'playing', score: 0, bracket, entrants, pairWinner, resolved, results, resultCount: 0 };
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export function pairCount(wc: WorldCupState): number {
  return wc.entrants.length >> 1;
}

export function pairHomeId(wc: WorldCupState, pair: number): string {
  return wc.entrants[pair * 2];
}

export function pairAwayId(wc: WorldCupState, pair: number): string {
  return wc.entrants[pair * 2 + 1];
}

export function humanPairIndex(wc: WorldCupState): number {
  const index = wc.entrants.indexOf(wc.humanId);
  if (index === -1) throw new Error(`human not among the entrants: ${wc.humanId}`);
  return index >> 1;
}

// S-PK3 in the World Cup: "el que figure primero en el cruce" is team 0 and kicks first
// in a shootout. The human is team 0 only when the draw put him first.
export function humanSideInPair(wc: WorldCupState): 0 | 1 {
  const index = wc.entrants.indexOf(wc.humanId);
  if (index === -1) throw new Error(`human not among the entrants: ${wc.humanId}`);
  return (index & 1) === 0 ? 0 : 1;
}

export function humanOpponentId(wc: WorldCupState): string {
  const pair = humanPairIndex(wc);
  return humanSideInPair(wc) === 0 ? pairAwayId(wc, pair) : pairHomeId(wc, pair);
}

export function isStillIn(wc: WorldCupState, id: string): boolean {
  return wc.entrants.includes(id);
}

export function isFinal(wc: WorldCupState): boolean {
  return wc.round === 'final';
}

export function currentDifficulty(wc: WorldCupState): number {
  return ROUND_DIFFICULTY[wc.round];
}

export function roundLabel(wc: WorldCupState): string {
  return ROUND_LABELS[wc.round];
}

export function humanMatchSeed(wc: WorldCupState): number {
  return matchSeedFor(wc.seed, wc.round, humanPairIndex(wc));
}

// G9-3: the pairs the human does not play, resolved one by one before his match --
// the bracket screen asks VER or SALTAR for each. -1 once they are all resolved (or
// the tournament is over), which is the screen's cue to offer the human's match.
export function nextCpuPair(wc: WorldCupState): number {
  if (wc.status !== 'playing') return -1;
  const human = humanPairIndex(wc);
  for (let pair = 0; pair < pairCount(wc); pair++) {
    if (pair !== human && !wc.resolved[pair]) return pair;
  }
  return -1;
}

// ── Transitions: every one guards its status and returns silently otherwise ────

function recordResult(wc: WorldCupState, pair: number, homeGoals: number, awayGoals: number, winner: 0 | 1): void {
  const r = wc.results[wc.resultCount];
  r.round = wc.round;
  r.homeId = pairHomeId(wc, pair);
  r.awayId = pairAwayId(wc, pair);
  r.homeGoals = homeGoals;
  r.awayGoals = awayGoals;
  r.winner = winner;
  wc.resultCount++;
  wc.pairWinner[pair] = winner === 0 ? r.homeId : r.awayId;
  wc.resolved[pair] = true;
}

// The result is PRODUCED outside (match-run.ts: the headless simulation of SALTAR, or
// the match watched on screen with the same seed -- same trajectory, same winner) and
// only RECORDED here. Refuses the human's pair, a pair already resolved, and anything
// once the tournament is over.
export function resolveCpuMatch(wc: WorldCupState, pair: number, winner: 0 | 1, homeGoals: number, awayGoals: number): void {
  if (wc.status !== 'playing') return;
  if (pair < 0 || pair >= pairCount(wc) || pair === humanPairIndex(wc) || wc.resolved[pair]) return;
  recordResult(wc, pair, homeGoals, awayGoals, winner);
}

export function matchPoints(goalsFor: number, goalsAgainst: number, won: boolean): number {
  return goalsFor * SCORE_GOAL + (won ? SCORE_WIN : 0) + (goalsAgainst === 0 ? SCORE_CLEAN_SHEET : 0);
}

// The two invariants a human result must satisfy, thrown rather than swallowed: both
// are programming errors of the screen, not states of the game. (1) S-PK3: the match
// carries the human on the side his pair says. (2) The CPU pairs of the round are all
// resolved -- advanceRound needs their winners.
function requireHumanMatch(wc: WorldCupState, match: MatchState): 0 | 1 {
  const side = humanSideInPair(wc);
  if (match.teams[side].id !== wc.humanId) throw new Error(`human must be team ${side} of this pair (S-PK3)`);
  if (nextCpuPair(wc) !== -1) throw new Error('every CPU pair must be resolved before the human match');
  return side;
}

function advanceRound(wc: WorldCupState): void {
  const n = pairCount(wc);
  for (let pair = 0; pair < n; pair++) {
    wc.entrants[pair] = wc.pairWinner[pair];
    wc.pairWinner[pair] = '';
    wc.resolved[pair] = false;
  }
  wc.entrants.length = n;
  wc.round = NEXT_ROUND[wc.round];
}

// The clean sheet is read from match.score: the shootout never touches it (S-PK12), so
// a 0-0 decided on penalties is a clean sheet for BOTH sides by construction.
export function winHumanMatch(wc: WorldCupState, match: MatchState): void {
  if (wc.status !== 'playing') return;
  const side = requireHumanMatch(wc, match);
  if (winnerOf(match) !== side) throw new Error('winHumanMatch called on a match the human did not win');
  const other: 0 | 1 = side === 0 ? 1 : 0;
  wc.score += matchPoints(match.score[side], match.score[other], true) + ROUND_BONUS[wc.round];
  recordResult(wc, humanPairIndex(wc), match.score[0], match.score[1], side);
  if (wc.round === 'final') {
    wc.status = 'champion';
    return;
  }
  advanceRound(wc);
}

export function loseHumanMatch(wc: WorldCupState, match: MatchState): void {
  if (wc.status !== 'playing') return;
  const side = requireHumanMatch(wc, match);
  const other: 0 | 1 = side === 0 ? 1 : 0;
  wc.score += matchPoints(match.score[side], match.score[other], false);
  recordResult(wc, humanPairIndex(wc), match.score[0], match.score[1], other);
  wc.status = 'eliminated';
}

// G9-8: the viewport guard abandoned the human's match (winnerOf === -1). ELIMINADO;
// the points of the rounds already played are what the table is offered. The
// abandoned match itself contributes nothing and is not recorded: it never finished.
export function abandonHumanMatch(wc: WorldCupState): void {
  if (wc.status !== 'playing') return;
  wc.status = 'eliminated';
}

// The invariant net of the bracket: eight distinct seeds of the bank with the human
// inside; entrants sized by the round, all seeded, no repeats, the human among them
// unless eliminated; every resolved pair won by one of its two. [] when it all holds.
export function checkWorldCupBracket(wc: WorldCupState, bankIds: readonly string[]): string[] {
  const problems: string[] = [];
  if (wc.bracket.length !== WORLD_CUP_SIZE) problems.push(`bracket size ${wc.bracket.length}`);
  const seeds = new Set<string>();
  for (const id of wc.bracket) {
    if (seeds.has(id)) problems.push(`duplicate seed ${id}`);
    if (!bankIds.includes(id)) problems.push(`seed outside the bank: ${id}`);
    seeds.add(id);
  }
  if (!seeds.has(wc.humanId)) problems.push('human missing from the bracket');

  if (wc.entrants.length !== ROUND_ENTRANTS[wc.round]) problems.push(`entrants size ${wc.entrants.length} for round ${wc.round}`);
  const seen = new Set<string>();
  for (const id of wc.entrants) {
    if (seen.has(id)) problems.push(`duplicate entrant ${id}`);
    if (!seeds.has(id)) problems.push(`entrant outside the seeded bracket: ${id}`);
    seen.add(id);
  }
  if (wc.status !== 'eliminated' && !seen.has(wc.humanId)) problems.push('human missing from entrants');

  for (let pair = 0; pair < pairCount(wc); pair++) {
    if (!wc.resolved[pair]) continue;
    const w = wc.pairWinner[pair];
    if (w !== pairHomeId(wc, pair) && w !== pairAwayId(wc, pair)) problems.push(`pair ${pair} won by ${w}, who is not in it`);
  }
  if (wc.resultCount > wc.results.length) problems.push(`resultCount ${wc.resultCount} over ${wc.results.length}`);
  return problems;
}
```

- [ ] **Step 4: Verde de `world-cup.ts`**

Run: `npx vitest run components/games/football-logic/world-cup.test.ts`
Expected: PASS, **24 tests** (5 + 2 + 2 + 3 + 4 + 4 + 4, contados `it` a `it` en el bloque de arriba). Si «twelve distinct seeds» fallara para alguna de las siete semillas del test (colisión en `matchSeedFor`), cambiar `PAIR_SEED_SALT` por `0x27d4eb2f` y volver a correr; anotarlo en el ledger. No tocar el test.

- [ ] **Step 5: Escribir el test que falla de `match-run.ts`**

Crear `components/games/football-screen/match-run.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NORMAL_RULES, TRAINING_RULES } from '../football-logic/match';
import { TEAMS } from '../football-logic/teams';
import { CPU_SEED_SALT, MATCH_RUN_STEP_CAP, createMatchRun, finishMatchRun, stepMatchRun } from './match-run';

const ESP = TEAMS[0];
const ITA = TEAMS[1];
const BRA = TEAMS[2];
const FRA = TEAMS[5];

describe('createMatchRun', () => {
  it('gives a human side the human profile (zero kick error) and a CPU side the CPU profile', () => {
    const run = createMatchRun(ESP, ITA, 1, 5, [true, false], NORMAL_RULES, [0, 0]);
    expect(run.match.profiles[0].shotErrorDeg).toBe(0);
    expect(run.match.profiles[0].passErrorDeg).toBe(0);
    expect(run.match.profiles[1].shotErrorDeg).toBeGreaterThan(0);
    // The keeper and the penalty read use the SAME difficulty on both sides (D3).
    expect(run.match.profiles[0].catchChance).toBe(run.match.profiles[1].catchChance);
    expect(run.human).toEqual([true, false]);
  });

  it('applies the formations to the match and to the inputs, and passes the rules through', () => {
    const run = createMatchRun(ESP, ITA, 1, 5, [true, false], TRAINING_RULES, [2, 1]);
    expect(run.match.formationIndex).toEqual([2, 1]);
    expect(run.inputs[0].formation).toBe(2);
    expect(run.inputs[1].formation).toBe(1);
    expect(run.match.rules.timed).toBe(false);
    expect(run.match.rules.frozenTeam).toBe(1);
    expect(run.match.teams[0].id).toBe('espana');
    expect(run.match.teams[1].id).toBe('italia');
  });

  it('derives the CPU stream from the seed with the step-8 salt', () => {
    expect(CPU_SEED_SALT).toBe(0x2545f491);
  });
});

describe('a CPU-vs-CPU run (the World Cup pairs the human does not play)', () => {
  it('finishes with a winner within the cap, deterministically: same seed, same winner, score and step count', () => {
    const a = createMatchRun(BRA, FRA, 11, 6, [false, false], NORMAL_RULES, [0, 0]);
    const b = createMatchRun(BRA, FRA, 11, 6, [false, false], NORMAL_RULES, [0, 0]);
    const wa = finishMatchRun(a);
    const wb = finishMatchRun(b);
    expect(wa).not.toBe(-1);
    expect(wa).toBe(wb);
    expect(a.match.phase).toBe('over');
    expect(a.match.score).toEqual(b.match.score);
    expect(a.match.stepCount).toBe(b.match.stepCount);
    expect(a.match.stepCount).toBeLessThan(MATCH_RUN_STEP_CAP);
  });

  // G9-3, the property the whole VER / SALTAR design rests on: watching part of the
  // match on screen and then skipping to the result gives EXACTLY the result of never
  // having watched it. Same function, same streams, same trajectory.
  it('a run watched for 3 000 steps and then finished ends exactly like the one finished headless from the start', () => {
    const watched = createMatchRun(BRA, FRA, 23, 4, [false, false], NORMAL_RULES, [0, 0]);
    for (let i = 0; i < 3000; i++) stepMatchRun(watched);
    expect(watched.match.phase).not.toBe('over');
    const w1 = finishMatchRun(watched);
    const headless = createMatchRun(BRA, FRA, 23, 4, [false, false], NORMAL_RULES, [0, 0]);
    const w2 = finishMatchRun(headless);
    expect(w1).toBe(w2);
    expect(watched.match.score).toEqual(headless.match.score);
    expect(watched.match.stepCount).toBe(headless.match.stepCount);
    expect(watched.match.ball.x).toBe(headless.match.ball.x);
  });

  it('a different seed gives a different match', () => {
    const a = createMatchRun(BRA, FRA, 23, 4, [false, false], NORMAL_RULES, [0, 0]);
    const b = createMatchRun(BRA, FRA, 24, 4, [false, false], NORMAL_RULES, [0, 0]);
    finishMatchRun(a);
    finishMatchRun(b);
    const same = a.match.stepCount === b.match.stepCount && a.match.score[0] === b.match.score[0] && a.match.score[1] === b.match.score[1] && a.match.ball.x === b.match.ball.x;
    expect(same).toBe(false);
  });

  it('at each round difficulty, seven seeds never hit the cap and always produce a winner (criterion 23)', () => {
    for (const difficulty of [4, 6, 8]) {
      for (let seed = 100; seed < 107; seed++) {
        const run = createMatchRun(ESP, ITA, seed, difficulty, [false, false], NORMAL_RULES, [0, 0]);
        expect(finishMatchRun(run)).not.toBe(-1);
        expect(run.match.stepCount).toBeLessThan(MATCH_RUN_STEP_CAP);
      }
    }
  });
});

describe('a run with humans', () => {
  it('never calls the CPU for a human team: its input is whatever the caller wrote; the CPU side is rewritten', () => {
    const run = createMatchRun(ESP, ITA, 1, 5, [true, false], NORMAL_RULES, [0, 0]);
    run.inputs[0].dx = 1;
    run.inputs[1].dx = 1;
    stepMatchRun(run);   // kickoff phase: decideTeamInput writes a neutral d-pad for the CPU
    expect(run.inputs[0].dx).toBe(1);
    expect(run.inputs[1].dx).toBe(0);
  });

  it('a two-human run consumes nothing from the CPU stream', () => {
    const run = createMatchRun(ESP, ITA, 1, 5, [true, true], NORMAL_RULES, [0, 0]);
    run.cpuRng = () => {
      throw new Error('the two-player friendly must not consult the CPU rng');
    };
    for (let i = 0; i < 400; i++) stepMatchRun(run);
    expect(run.match.stepCount).toBe(400);
  });

  // G9-1: the frozen team of a training match is never asked to decide. Without this
  // the CPU would drive the frozen side's CONTROLLED player (stepPlayer reads its
  // TeamInput regardless of the rules) and the "statues" would chase and tackle.
  it('in a training run the frozen team gets no CPU decision: neutral input, CPU stream untouched, its controlled player still', () => {
    const run = createMatchRun(ESP, ITA, 1, 5, [true, false], TRAINING_RULES, [0, 0]);
    run.cpuRng = () => {
      throw new Error('the frozen team must not consult the CPU rng');
    };
    for (let i = 0; i < 400; i++) stepMatchRun(run);   // through the kickoff into open play
    const controlled = run.match.players[run.match.controlled[1]];
    const x = controlled.x;
    const y = controlled.y;
    for (let i = 0; i < 200; i++) stepMatchRun(run);
    expect(run.inputs[1].dx).toBe(0);
    expect(run.inputs[1].dy).toBe(0);
    expect(run.inputs[1].a).toBe('up');
    expect(run.inputs[1].b).toBe('up');
    expect(run.match.players[controlled.id].x).toBe(x);
    expect(run.match.players[controlled.id].y).toBe(y);
    expect(run.match.stepCount).toBe(600);
    // The control case: with normal rules the same seat DOES draw from the CPU stream.
    const normal = createMatchRun(ESP, ITA, 1, 5, [true, false], NORMAL_RULES, [0, 0]);
    let draws = 0;
    const inner = normal.cpuRng;
    normal.cpuRng = () => {
      draws++;
      return inner();
    };
    for (let i = 0; i < 600; i++) stepMatchRun(normal);
    expect(draws).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: Ver fallar**

Run: `npx vitest run components/games/football-screen/match-run.test.ts`
Expected: FAIL — `Failed to resolve import "./match-run"`.

- [ ] **Step 7: Escribir `match-run.ts`**

Crear `components/games/football-screen/match-run.ts`:

```ts
import { createAiState, decideTeamInput, humanProfile, profileFor, type AiProfile, type AiState } from '../football-logic/ai';
import { createTeamInput, type TeamInput } from '../football-logic/input';
import { createMatch, stepMatch, winnerOf, type MatchRules, type MatchState } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { createRng, type Rng } from '../football-logic/rng';
import { FORMATIONS, type TeamDef } from '../football-logic/teams';

// ONE match and everything that drives it: the two rng streams, the two AI states and
// the two TeamInputs, plus the mask of who is human. The component fills the human
// inputs from the pads and calls stepMatchRun; a CPU-vs-CPU pair of the World Cup is
// the same run with nobody human, whether it is stepped on screen at x4 (VER) or
// finished headless in one call (SALTAR, or the A key mid-match). Same function, same
// streams: the result cannot depend on whether anybody watched (G9-3).
//
// Two streams from one seed, exactly as the step-8 component and ai.test.ts's
// playCpuMatch: the CPU decides with its own, before stepMatch, and never draws from
// the match's. CPU_SEED_SALT moves here from VaultWorldCupGame.tsx unchanged.
export const CPU_SEED_SALT = 0x2545f491;

// A match is ~11-16 k steps with a shootout; criterion 23 says the shootout always
// ends. The cap is a safety net for a broken engine, not a rule: the test asserts it is
// never reached, and finishMatchRun reports -1 (undecided) if it ever were.
export const MATCH_RUN_STEP_CAP = 100_000;

export type MatchRun = {
  match: MatchState;
  matchRng: Rng;
  cpuRng: Rng;
  states: [AiState, AiState];
  inputs: [TeamInput, TeamInput];
  human: [boolean, boolean];
};

// Allocates: a match, two rngs, two AI states, two inputs. Called on an EVENT (A on
// the bracket, A on the team selector), never per frame.
export function createMatchRun(
  home: TeamDef, away: TeamDef, seed: number, difficulty: number,
  human: readonly [boolean, boolean], rules: Readonly<MatchRules>, formations: readonly [number, number],
): MatchRun {
  // D3: the human profile is the CPU profile with zero kick error -- same keeper,
  // same penalty read, same difficulty.
  const profiles: [AiProfile, AiProfile] = [
    human[0] ? humanProfile(home, difficulty) : profileFor(home, difficulty),
    human[1] ? humanProfile(away, difficulty) : profileFor(away, difficulty),
  ];
  const match = createMatch([home, away], FORMATIONS, PITCH, profiles, rules);
  match.formationIndex[0] = formations[0];
  match.formationIndex[1] = formations[1];
  const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
  inputs[0].formation = formations[0];
  inputs[1].formation = formations[1];
  return {
    match,
    matchRng: createRng(seed),
    cpuRng: createRng((seed ^ CPU_SEED_SALT) >>> 0),
    states: [createAiState(), createAiState()],
    inputs,
    human: [human[0], human[1]],
  };
}

// ONE simulation step. The caller has already written the human inputs for this step
// (padToTeamInput); the CPU sides decide here, team 0 first, from the CPU stream.
// G9-1 (design brief, option B): the FROZEN team of a training match is asked nothing --
// the engine only skips positionTeam for it, and its controlled player is still moved by
// its TeamInput (stepPlayer), so a CPU decision here would send one statue chasing and
// tackling. Its input stays the neutral one createTeamInput wrote (formation aside).
function cpuDecides(run: MatchRun, team: 0 | 1): boolean {
  return !run.human[team] && run.match.rules.frozenTeam !== team;
}

export function stepMatchRun(run: MatchRun): void {
  const { match, inputs } = run;
  if (cpuDecides(run, 0)) decideTeamInput(match, 0, match.profiles[0], run.states[0], run.cpuRng, inputs[0]);
  if (cpuDecides(run, 1)) decideTeamInput(match, 1, match.profiles[1], run.states[1], run.cpuRng, inputs[1]);
  stepMatch(match, inputs, run.matchRng);
}

// Runs the match to 'over' and reports the winner. -1 only if the cap was hit, which
// the tests say never happens.
export function finishMatchRun(run: MatchRun, cap = MATCH_RUN_STEP_CAP): 0 | 1 | -1 {
  let steps = 0;
  while (run.match.phase !== 'over' && steps < cap) {
    stepMatchRun(run);
    steps++;
  }
  return winnerOf(run.match);
}
```

- [ ] **Step 8: Verde y suite completa**

Run: `npx vitest run components/games/football-screen/match-run.test.ts && npx vitest run && npx tsc --noEmit`
Expected: `match-run` **10 tests** (3 + 4 + 3); **la suite pasa de 1070 a 1104 tests en 64 ficheros** (24 + 10); `tsc` sin salida. La suite tarda ~5-8 s más (unos 30 partidos completos simulados; medido hoy en `ai.test.ts`: ~0,15-0,3 s por partido CPU-CPU): aceptable; si supera los 15 s en total, reducir el fuzz de dificultades a seeds `100..104` y anotarlo.

- [ ] **Step 9: Motor intacto**

Run: `git diff --stat 0e553af -- components/games/football-logic/ && git status --short components/games/football-logic/ && grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/`
Expected: el diff lista solo `match.ts` y `match.test.ts`; `git status` muestra además `?? world-cup.ts` y `?? world-cup.test.ts`; grep vacío.

- [ ] **Step 10: Ledger y proponer commit**

Ledger: `Task 9-3: DONE (1104/1104 en 64 ficheros; world-cup 24, match-run 10; VER/SALTAR equivalencia fijada con test; el congelado no recibe decisión de la CPU).`

No ejecutar. Mensaje propuesto:

`feat(world-cup): bracket, draw, scoring and seeds (world-cup.ts) plus the MatchRun harness that makes VER and SALTAR equivalent`

**QA de Paco para esta tarea:** ninguno todavía.

---

## Task 9-4: `football-logic/mode.ts` — la costura entre el componente y los cuatro modos

**Files:**
- Create: `components/games/football-logic/mode.ts`, `components/games/football-logic/mode.test.ts`

**Interfaces:**
- Consumes: `NORMAL_RULES`, `TRAINING_RULES`, `winnerOf`, `MatchRules`, `MatchState` (`match.ts`); `createRng`, `Rng` (`rng.ts`); todo `world-cup.ts` (Task 9-3).
- Produces (firmas exactas; el resto del paso las consume tal cual):

```ts
export type GameModeKind = 'friendly-cpu' | 'friendly-2p' | 'training' | 'world-cup';
export type FriendlyKind = Exclude<GameModeKind, 'world-cup'>;
export type ModeStatus = 'playing' | 'champion' | 'eliminated' | 'draw';
export type HumanSide = 0 | 1 | 'both' | 'none';
export type FxKind = 'confetti' | 'fireworks';
export type FriendlyState = { homeId: string; awayId: string; status: ModeStatus };
export type GameMode = { kind: FriendlyKind; state: FriendlyState } | { kind: 'world-cup'; state: WorldCupState };
export const FRIENDLY_DIFFICULTY = 5;
export const DRAW_SEED_SALT: number;
export function drawSeedFor(seed: number): number;
export function drawRival(bankIds: readonly string[], homeId: string, rng: Rng): string;
export function createFriendlyMode(kind: FriendlyKind, homeId: string, awayId: string): GameMode;
export function createWorldCupMode(bankIds: readonly string[], humanId: string, seed: number): GameMode;
export function sideIsHuman(side: HumanSide, team: 0 | 1): boolean;
export function modeHumanSide(m: GameMode): HumanSide;
export function modeHomeId(m: GameMode): string;
export function modeAwayId(m: GameMode): string;
export function modeDifficulty(m: GameMode): number;
export function modeRules(m: GameMode): Readonly<MatchRules>;
export function modeScore(m: GameMode): number;
export function modeScores(m: GameMode): boolean;
export function modeBracket(m: GameMode): WorldCupState | null;
export function modeMatchSeed(m: GameMode, runSeed: number): number;
export function modeVictoryScreen(m: GameMode): boolean;
export function modeStatus(m: GameMode): ModeStatus;
export function modeEndMatch(m: GameMode, match: MatchState): void;
export function modeAbandonMatch(m: GameMode, match: MatchState): void;
export function modeVictoryTeamId(m: GameMode, match: MatchState): string;
export function modeMatchLabel(m: GameMode): string;
export function modeVictoryTitle(m: GameMode): string;
export function modeFxKind(m: GameMode): FxKind;
```

- [ ] **Step 1: Escribir el test que falla**

Crear `components/games/football-logic/mode.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { humanProfile, profileFor } from './ai';
import { NORMAL_RULES, TRAINING_RULES, createMatch, type MatchState } from './match';
import { PITCH } from './pitch';
import { createRng } from './rng';
import { FORMATIONS, TEAMS, teamById } from './teams';
import {
  FRIENDLY_DIFFICULTY, createFriendlyMode, createWorldCupMode, drawRival, drawSeedFor, modeAbandonMatch, modeAwayId,
  modeBracket, modeDifficulty, modeEndMatch, modeFxKind, modeHomeId, modeHumanSide, modeMatchLabel, modeMatchSeed, modeRules,
  modeScore, modeScores, modeStatus, modeVictoryScreen, modeVictoryTeamId, modeVictoryTitle, sideIsHuman, type GameMode,
} from './mode';
import {
  createWorldCup, humanMatchSeed, humanPairIndex, humanSideInPair, nextCpuPair, pairAwayId, pairHomeId, resolveCpuMatch,
} from './world-cup';

const BANK_IDS: readonly string[] = TEAMS.map((t) => t.id);

function team(id: string) {
  const def = teamById(TEAMS, id);
  if (def === undefined) throw new Error(`missing team ${id}`);
  return def;
}

// A finished match with a given scoreboard; level scores go to a shootout the given
// side wins (S-PK12: match.score stays level). Same helper as world-cup.test.ts.
function finished(homeId: string, awayId: string, homeGoals: number, awayGoals: number, shootoutWinner: 0 | 1 = 0): MatchState {
  const m = createMatch([team(homeId), team(awayId)], FORMATIONS, PITCH, [humanProfile(team(homeId), 5), profileFor(team(awayId), 5)]);
  m.score[0] = homeGoals;
  m.score[1] = awayGoals;
  if (homeGoals === awayGoals) {
    m.shootout = m.scratch.shootout;
    m.shootout.taken[0] = 5;
    m.shootout.taken[1] = 5;
    m.shootout.scored[0] = shootoutWinner === 0 ? 4 : 3;
    m.shootout.scored[1] = shootoutWinner === 0 ? 3 : 4;
  }
  m.phase = 'over';
  return m;
}

// An abandoned match: 'over' with a level score and NO shootout (winnerOf === -1).
function abandonedLevel(homeId: string, awayId: string): MatchState {
  const m = createMatch([team(homeId), team(awayId)], FORMATIONS, PITCH, [humanProfile(team(homeId), 5), profileFor(team(awayId), 5)]);
  m.phase = 'over';
  return m;
}

// The human's World Cup match with the pair in the right order (S-PK3), scored from
// the human's point of view.
function humanWorldCupMatch(m: GameMode, goalsFor: number, goalsAgainst: number, humanWins: boolean): MatchState {
  const home = modeHomeId(m);
  const away = modeAwayId(m);
  return modeHumanSide(m) === 0
    ? finished(home, away, goalsFor, goalsAgainst, humanWins ? 0 : 1)
    : finished(home, away, goalsAgainst, goalsFor, humanWins ? 1 : 0);
}

function resolveCpuPairs(m: GameMode): void {
  const wc = modeBracket(m);
  if (wc === null) throw new Error('no bracket');
  for (let p = nextCpuPair(wc); p !== -1; p = nextCpuPair(wc)) resolveCpuMatch(wc, p, 0, 1, 0);
}

describe('drawRival', () => {
  it('never returns the home team and, over 300 draws, reaches every other team of the bank', () => {
    const rng = createRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const rival = drawRival(BANK_IDS, 'espana', rng);
      expect(rival).not.toBe('espana');
      seen.add(rival);
    }
    expect(seen.size).toBe(BANK_IDS.length - 1);
  });

  it('is deterministic for a seed and throws for a home outside the bank', () => {
    expect(drawRival(BANK_IDS, 'italia', createRng(9))).toBe(drawRival(BANK_IDS, 'italia', createRng(9)));
    expect(() => drawRival(BANK_IDS, 'atlantida', createRng(9))).toThrow();
  });
});

describe('the three friendly modes', () => {
  it('answer the questions the component asks, without the component knowing which one it holds', () => {
    const cpu = createFriendlyMode('friendly-cpu', 'espana', 'italia');
    const two = createFriendlyMode('friendly-2p', 'brasil', 'argentina');
    const training = createFriendlyMode('training', 'francia', 'alemania');

    expect(modeHumanSide(cpu)).toBe(0);
    expect(modeHumanSide(two)).toBe('both');
    expect(modeHumanSide(training)).toBe(0);
    expect([modeHomeId(cpu), modeAwayId(cpu)]).toEqual(['espana', 'italia']);
    expect([modeHomeId(two), modeAwayId(two)]).toEqual(['brasil', 'argentina']);
    for (const m of [cpu, two, training]) {
      expect(modeDifficulty(m)).toBe(FRIENDLY_DIFFICULTY);   // G9-6: 5, no selector
      expect(modeScore(m)).toBe(0);
      expect(modeScores(m)).toBe(false);                      // criterion 19: no friendly writes to the table
      expect(modeBracket(m)).toBeNull();
      expect(modeMatchSeed(m, 12345)).toBe(12345);             // the run seed IS the match seed
      expect(modeStatus(m)).toBe('playing');
      expect(modeFxKind(m)).toBe('confetti');
      expect(modeVictoryTitle(m)).toBe('GANADOR');
    }
    expect(modeRules(cpu)).toBe(NORMAL_RULES);
    expect(modeRules(two)).toBe(NORMAL_RULES);
    expect(modeRules(training)).toBe(TRAINING_RULES);          // G9-1: the only mode with the switch on
    expect(modeVictoryScreen(cpu)).toBe(true);
    expect(modeVictoryScreen(two)).toBe(true);
    expect(modeVictoryScreen(training)).toBe(false);           // no clock, no end, no screen: R exits
    expect(modeMatchLabel(cpu)).toBe('AMISTOSO');
    expect(modeMatchLabel(two)).toBe('AMISTOSO A DOS');
    expect(modeMatchLabel(training)).toBe('ENTRENAMIENTO');
  });

  it('refuse the same team on both sides', () => {
    expect(() => createFriendlyMode('friendly-cpu', 'espana', 'espana')).toThrow();
  });

  it('sideIsHuman reads the four sides', () => {
    expect(sideIsHuman(0, 0)).toBe(true);
    expect(sideIsHuman(0, 1)).toBe(false);
    expect(sideIsHuman(1, 1)).toBe(true);
    expect(sideIsHuman('both', 0)).toBe(true);
    expect(sideIsHuman('both', 1)).toBe(true);
    expect(sideIsHuman('none', 0)).toBe(false);
    expect(sideIsHuman('none', 1)).toBe(false);
  });

  it('modeEndMatch on the CPU friendly: a human win is champion, a loss eliminated, an abandon at level is a draw -- and then no-ops', () => {
    const won = createFriendlyMode('friendly-cpu', 'espana', 'italia');
    modeEndMatch(won, finished('espana', 'italia', 2, 1));
    expect(modeStatus(won)).toBe('champion');
    expect(modeVictoryTeamId(won, finished('espana', 'italia', 2, 1))).toBe('espana');
    modeEndMatch(won, finished('espana', 'italia', 0, 1));
    expect(modeStatus(won)).toBe('champion');

    const lost = createFriendlyMode('friendly-cpu', 'espana', 'italia');
    modeEndMatch(lost, finished('espana', 'italia', 0, 0, 1));   // lost on penalties
    expect(modeStatus(lost)).toBe('eliminated');

    const level = createFriendlyMode('friendly-cpu', 'espana', 'italia');
    modeEndMatch(level, abandonedLevel('espana', 'italia'));
    expect(modeStatus(level)).toBe('draw');
  });

  it('in the two-player friendly EITHER winner is a champion: both are human, and the screen names the one who won', () => {
    const a = createFriendlyMode('friendly-2p', 'brasil', 'argentina');
    modeEndMatch(a, finished('brasil', 'argentina', 1, 0));
    expect(modeStatus(a)).toBe('champion');
    expect(modeVictoryTeamId(a, finished('brasil', 'argentina', 1, 0))).toBe('brasil');
    const b = createFriendlyMode('friendly-2p', 'brasil', 'argentina');
    modeEndMatch(b, finished('brasil', 'argentina', 0, 3));
    expect(modeStatus(b)).toBe('champion');
    expect(modeVictoryTeamId(b, finished('brasil', 'argentina', 0, 3))).toBe('argentina');
  });

  // S-SC12 (step 8): abandon() does not touch the score, so a friendly abandoned with
  // a lead still reads GANADOR / ELIMINADO on the canvas. The friendly keeps that.
  it('modeAbandonMatch on a friendly reads the standing score like the natural end (S-SC12)', () => {
    const lead = createFriendlyMode('friendly-cpu', 'espana', 'italia');
    const m = finished('espana', 'italia', 1, 0);
    m.shootout = null;
    modeAbandonMatch(lead, m);
    expect(modeStatus(lead)).toBe('champion');
  });
});

describe('the World Cup mode', () => {
  it('builds the same bracket as calling world-cup.ts with the derived draw stream', () => {
    const m = createWorldCupMode(BANK_IDS, 'japon', 77);
    const direct = createWorldCup(BANK_IDS, 'japon', 77, createRng(drawSeedFor(77)));
    const wc = modeBracket(m);
    expect(wc).not.toBeNull();
    if (wc === null) return;
    expect(wc.bracket).toEqual(direct.bracket);
    expect(wc.seed).toBe(77);
    expect(modeHumanSide(m)).toBe(humanSideInPair(direct));
    expect(modeHomeId(m)).toBe(pairHomeId(direct, humanPairIndex(direct)));
    expect(modeAwayId(m)).toBe(pairAwayId(direct, humanPairIndex(direct)));
    expect(modeMatchSeed(m, 999)).toBe(humanMatchSeed(direct));   // NOT the run seed: the derived one
    expect(modeDifficulty(m)).toBe(4);
    expect(modeRules(m)).toBe(NORMAL_RULES);
    expect(modeScores(m)).toBe(true);
    expect(modeVictoryScreen(m)).toBe(false);                       // only the final has one
    expect(modeMatchLabel(m)).toBe('CUARTOS DE FINAL');
    expect(modeFxKind(m)).toBe('fireworks');
    expect(modeVictoryTitle(m)).toBe('CAMPEONES DEL MUNDO');
  });

  it('three wins through modeEndMatch make the champion: difficulty 4 -> 6 -> 8, victory screen only in the final, for EVERY team', () => {
    for (const humanId of BANK_IDS) {
      const m = createWorldCupMode(BANK_IDS, humanId, 5);
      const difficulties: number[] = [];
      const screens: boolean[] = [];
      for (let i = 0; i < 3; i++) {
        difficulties.push(modeDifficulty(m));
        screens.push(modeVictoryScreen(m));
        resolveCpuPairs(m);
        modeEndMatch(m, humanWorldCupMatch(m, 2, 0, true));
      }
      expect(difficulties).toEqual([4, 6, 8]);
      expect(screens).toEqual([false, false, true]);
      expect(modeStatus(m)).toBe('champion');
      expect(modeScore(m)).toBe(61_000 + 6_000);
      expect(modeVictoryTeamId(m, humanWorldCupMatch(m, 2, 0, true))).toBe(humanId);
    }
  });

  it('a loss is eliminated with the points so far; a level abandon is eliminated too (G9-8)', () => {
    const lost = createWorldCupMode(BANK_IDS, 'uruguay', 8);
    resolveCpuPairs(lost);
    modeEndMatch(lost, humanWorldCupMatch(lost, 1, 2, false));
    expect(modeStatus(lost)).toBe('eliminated');
    expect(modeScore(lost)).toBe(1_000);

    const abandoned = createWorldCupMode(BANK_IDS, 'uruguay', 8);
    resolveCpuPairs(abandoned);
    modeEndMatch(abandoned, humanWorldCupMatch(abandoned, 3, 0, true));
    const kept = modeScore(abandoned);
    modeAbandonMatch(abandoned, abandonedLevel(modeHomeId(abandoned), modeAwayId(abandoned)));
    expect(modeStatus(abandoned)).toBe('eliminated');
    expect(modeScore(abandoned)).toBe(kept);
  });

  // The difference between the two abandons, and the reason modeAbandonMatch exists:
  // a World Cup match abandoned WITH A LEAD is still ELIMINADO (G9-8), never a win.
  it('modeAbandonMatch with a lead: the World Cup eliminates, the friendly keeps the standing result', () => {
    const wc = createWorldCupMode(BANK_IDS, 'croacia', 6);
    resolveCpuPairs(wc);
    const leading = humanWorldCupMatch(wc, 1, 0, true);
    leading.shootout = null;
    modeAbandonMatch(wc, leading);
    expect(modeStatus(wc)).toBe('eliminated');
    expect(modeScore(wc)).toBe(0);
  });
});
```

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run components/games/football-logic/mode.test.ts`
Expected: FAIL — `Failed to resolve import "./mode"`.

- [ ] **Step 3: Escribir `mode.ts`**

Crear `components/games/football-logic/mode.ts`:

```ts
import { NORMAL_RULES, TRAINING_RULES, winnerOf, type MatchRules, type MatchState } from './match';
import { createRng, type Rng } from './rng';
import * as worldCup from './world-cup';
import type { WorldCupState } from './world-cup';

// The seam between VaultWorldCupGame.tsx and the four modes (spec, data model: "igual
// que la de Vault Fighter"). The component holds ONE GameMode, built once when a run
// starts, and every question it asks -- who is human, who plays, at what difficulty,
// under which rules, what happens when the match ends, what the victory screen says --
// goes through a function here. The branch by mode lives here ONCE; the component
// never asks "which mode am I in" (Global Constraints: no `kind ===` in the .tsx).
export type GameModeKind = 'friendly-cpu' | 'friendly-2p' | 'training' | 'world-cup';
export type FriendlyKind = Exclude<GameModeKind, 'world-cup'>;

// 'champion' is a human win that gets a victory screen (GANADOR for a friendly,
// CAMPEONES DEL MUNDO for the final); 'eliminated' is the ELIMINADO caption over the
// pitch (spec 60-61); 'draw' only ever comes from abandon() at a level score.
export type ModeStatus = 'playing' | 'champion' | 'eliminated' | 'draw';

// Who the keyboard drives in the current match. 'both' is the two-player friendly;
// 'none' is a CPU pair of the World Cup watched on screen (the component's spectate).
export type HumanSide = 0 | 1 | 'both' | 'none';

// The victory effect. Defined here and not in football-screen/particles.ts because
// this folder never imports from the screen; particles.ts imports it from here.
export type FxKind = 'confetti' | 'fireworks';

export type FriendlyState = { homeId: string; awayId: string; status: ModeStatus };

export type GameMode =
  | { kind: FriendlyKind; state: FriendlyState }
  | { kind: 'world-cup'; state: WorldCupState };

// G9-6: 5 in every friendly, no selector.
export const FRIENDLY_DIFFICULTY = 5;

// G9-7: the draw stream (the World Cup's eight, or a friendly's rival) comes off the
// run seed by integer arithmetic, like every other stream of this game.
export const DRAW_SEED_SALT = 0x6a09e667;

export function drawSeedFor(seed: number): number {
  return (seed ^ DRAW_SEED_SALT) >>> 0;
}

// G9-4: the rival of a friendly (CPU or training) is drawn, never chosen. Uniform over
// the other fifteen, one draw, no allocation.
export function drawRival(bankIds: readonly string[], homeId: string, rng: Rng): string {
  if (!bankIds.includes(homeId)) throw new Error(`home team not in bank: ${homeId}`);
  let k = Math.floor(rng() * (bankIds.length - 1));
  for (let i = 0; i < bankIds.length; i++) {
    if (bankIds[i] === homeId) continue;
    if (k === 0) return bankIds[i];
    k--;
  }
  throw new Error('unreachable: rival index out of range');
}

export function createFriendlyMode(kind: FriendlyKind, homeId: string, awayId: string): GameMode {
  if (homeId === awayId) throw new Error(`a friendly needs two different teams: ${homeId}`);
  return { kind, state: { homeId, awayId, status: 'playing' } };
}

export function createWorldCupMode(bankIds: readonly string[], humanId: string, seed: number): GameMode {
  return { kind: 'world-cup', state: worldCup.createWorldCup(bankIds, humanId, seed, createRng(drawSeedFor(seed))) };
}

export function sideIsHuman(side: HumanSide, team: 0 | 1): boolean {
  return side === 'both' || side === team;
}

const HUMAN_SIDE_BY_KIND: Readonly<Record<FriendlyKind, HumanSide>> = {
  'friendly-cpu': 0,
  'friendly-2p': 'both',
  training: 0,
};

// S-PK3 in the World Cup: the human is team 0 or 1 according to his slot in the pair.
export function modeHumanSide(m: GameMode): HumanSide {
  return m.kind === 'world-cup' ? worldCup.humanSideInPair(m.state) : HUMAN_SIDE_BY_KIND[m.kind];
}

export function modeHomeId(m: GameMode): string {
  if (m.kind !== 'world-cup') return m.state.homeId;
  return worldCup.pairHomeId(m.state, worldCup.humanPairIndex(m.state));
}

export function modeAwayId(m: GameMode): string {
  if (m.kind !== 'world-cup') return m.state.awayId;
  return worldCup.pairAwayId(m.state, worldCup.humanPairIndex(m.state));
}

export function modeDifficulty(m: GameMode): number {
  return m.kind === 'world-cup' ? worldCup.currentDifficulty(m.state) : FRIENDLY_DIFFICULTY;
}

// G9-1: the only mode with a switch on. Returns the frozen module constants, so the
// component can hand them to createMatch without copying.
export function modeRules(m: GameMode): Readonly<MatchRules> {
  return m.kind === 'training' ? TRAINING_RULES : NORMAL_RULES;
}

export function modeScore(m: GameMode): number {
  return m.kind === 'world-cup' ? m.state.score : 0;
}

// Criterion 19: only the World Cup writes to the table. The component fires
// onGameOver / onVictory only when this is true.
export function modeScores(m: GameMode): boolean {
  return m.kind === 'world-cup';
}

// null when the mode has no bracket: that is how the component decides the draw and
// bracket phases exist at all, without asking which mode it holds.
export function modeBracket(m: GameMode): WorldCupState | null {
  return m.kind === 'world-cup' ? m.state : null;
}

// A friendly plays on the run seed itself; a World Cup match on its derived seed.
export function modeMatchSeed(m: GameMode, runSeed: number): number {
  return m.kind === 'world-cup' ? worldCup.humanMatchSeed(m.state) : runSeed;
}

// Whether a human WIN of the current match ends on a victory screen (and so the
// GANADOR caption is not queued, final review §8.5). Friendlies: always. Training:
// never -- it has no end. World Cup: only the final.
export function modeVictoryScreen(m: GameMode): boolean {
  switch (m.kind) {
    case 'friendly-cpu':
    case 'friendly-2p':
      return true;
    case 'training':
      return false;
    case 'world-cup':
      return worldCup.isFinal(m.state);
  }
}

export function modeStatus(m: GameMode): ModeStatus {
  return m.state.status;
}

// The natural end of a match. winnerOf is the ONE reader of the winner (stage B2 §8);
// -1 only comes from abandon(), which modeAbandonMatch handles -- but a component that
// routed an abandon here by mistake still gets a sane answer (draw / eliminated).
export function modeEndMatch(m: GameMode, match: MatchState): void {
  const winner = winnerOf(match);
  if (m.kind === 'world-cup') {
    if (winner === -1) worldCup.abandonHumanMatch(m.state);
    else if (winner === worldCup.humanSideInPair(m.state)) worldCup.winHumanMatch(m.state, match);
    else worldCup.loseHumanMatch(m.state, match);
    return;
  }
  const s = m.state;
  if (s.status !== 'playing') return;
  if (winner === -1) s.status = 'draw';
  else s.status = sideIsHuman(HUMAN_SIDE_BY_KIND[m.kind], winner) ? 'champion' : 'eliminated';
}

// The viewport guard's end. G9-8: a World Cup match abandoned is ELIMINADO whatever
// the score stood at, with the points of the rounds already played kept. A friendly
// reads the standing score like the natural end (S-SC12: GANADOR / ELIMINADO / EMPATE
// on the canvas), because abandon() does not touch the score.
export function modeAbandonMatch(m: GameMode, match: MatchState): void {
  if (m.kind === 'world-cup') {
    worldCup.abandonHumanMatch(m.state);
    return;
  }
  modeEndMatch(m, match);
}

// The team the victory screen names: whoever won the match that ended the run. In
// the two-player friendly that is either side; in the World Cup it is the human.
export function modeVictoryTeamId(m: GameMode, match: MatchState): string {
  const winner = winnerOf(match);
  return winner === -1 ? modeHomeId(m) : match.teams[winner].id;
}

// Pre-built at module load, never per frame.
const MATCH_LABEL_BY_KIND: Readonly<Record<FriendlyKind, string>> = {
  'friendly-cpu': 'AMISTOSO',
  'friendly-2p': 'AMISTOSO A DOS',
  training: 'ENTRENAMIENTO',
};
const FRIENDLY_VICTORY_TITLE = 'GANADOR';
const WORLD_CUP_VICTORY_TITLE = 'CAMPEONES DEL MUNDO';

export function modeMatchLabel(m: GameMode): string {
  return m.kind === 'world-cup' ? worldCup.roundLabel(m.state) : MATCH_LABEL_BY_KIND[m.kind];
}

export function modeVictoryTitle(m: GameMode): string {
  return m.kind === 'world-cup' ? WORLD_CUP_VICTORY_TITLE : FRIENDLY_VICTORY_TITLE;
}

// Spec: confetti for a friendly, fireworks for the World Cup.
export function modeFxKind(m: GameMode): FxKind {
  return m.kind === 'world-cup' ? 'fireworks' : 'confetti';
}
```

- [ ] **Step 4: Verde y suite completa**

Run: `npx vitest run components/games/football-logic/mode.test.ts && npx vitest run && npx tsc --noEmit`
Expected: `mode` **12 tests** (2 + 6 + 4); **la suite pasa de 1104 a 1116 tests en 65 ficheros**; `tsc` sin salida.

- [ ] **Step 5: Motor intacto**

Run: `git diff --stat 0e553af -- components/games/football-logic/ && git status --short components/games/football-logic/ && grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/`
Expected: el diff lista solo `match.ts` y `match.test.ts`; `git status` muestra además `??` de `world-cup.ts`, `world-cup.test.ts`, `mode.ts`, `mode.test.ts`; grep vacío.

- [ ] **Step 6: Ledger y proponer commit**

Ledger: `Task 9-4: DONE (1116/1116 en 65 ficheros; mode 12).`

No ejecutar. Mensaje propuesto:

`feat(world-cup): mode.ts — the seam between the component and the four modes, no per-mode branch outside it`

**QA de Paco para esta tarea:** ninguno todavía.

---

## Task 9-5: `football-screen/flow.ts` (la máquina de fases, G9-9), `flow-layout.ts` y `captions.ts` con `HumanSide`

**Files:**
- Create: `components/games/football-screen/flow-layout.ts`, `components/games/football-screen/flow-layout.test.ts`
- Create: `components/games/football-screen/flow.ts`, `components/games/football-screen/flow.test.ts`
- Modify: `components/games/football-screen/captions.ts` (`collectCaptions` 143-213, imports 1-6), `captions.test.ts` (bloque nuevo al final)

**Interfaces:**
- Consumes: `mode.ts` entero (Task 9-4); `nextCpuPair`, `resolveCpuMatch` (`world-cup.ts`); `createRng`; `winnerOf`, `MatchState`; `VIEW_W`, `VIEW_H` (`camera.ts`).
- Produces:

```ts
// flow-layout.ts — solo números; el .tsx dibuja con ellos
export const TEAM_GRID_COLS = 4;
export const TEAM_CARD_W = 172; export const TEAM_CARD_H = 74; export const TEAM_GRID_GAP_X = 16; export const TEAM_GRID_GAP_Y = 12; export const TEAM_GRID_TOP = 78;
export function teamGridWidth(bankSize: number): number;
export function teamCardX(index: number, bankSize: number): number;
export function teamCardY(index: number): number;
export const FORMATION_ROW_Y = 432; export const SELECT_HINT_Y = 478;
export const MODE_CARD_W = 560; export const MODE_CARD_H = 66; export const MODE_CARD_GAP = 14; export const MODE_CARD_TOP = 108;
export function modeCardY(index: number): number;
export const BRACKET_ROW_TOP = 96; export const BRACKET_ROW_H = 40; export const BRACKET_PROMPT_Y = 330; export const BRACKET_ELIMINATED_Y = 400; export const BRACKET_HINT_Y = 470;
export function bracketRowY(pair: number): number;
export const DRAW_ROW_TOP = 120; export const DRAW_ROW_H = 36; export const DRAW_COL_X: readonly [number, number];
export function drawRowY(index: number): number; drawColX(index: number): number;
export const VICTORY_TITLE_Y = 88; export const VICTORY_TEAM_Y = 150; export const VICTORY_FIGURE_Y = 320; export const VICTORY_HINT_Y = 468;

// flow.ts
export type FlowPhase = 'mode-select' | 'team-select' | 'draw' | 'bracket' | 'match' | 'spectate' | 'victory' | 'over';
export type BracketAction = 'spectate' | 'skip' | 'play';
export type FlowState = { phase: FlowPhase; modeIndex: number; picking: 0 | 1; cursor: number; picked: [number, number]; formation: [number, number]; bracketChoice: 0 | 1; after: FlowPhase };
export const MODE_LIST: readonly GameModeKind[]; MODE_NAMES; MODE_BLURBS; HUMANS_BY_MODE;
export function createFlowState(): FlowState; flowReset(f): void;
export function flowModeKind(f): GameModeKind; flowHumanCount(f): 1 | 2; flowPickingHuman(f): 0 | 1;
export function flowMoveMode(f, delta: number): void; flowConfirmMode(f): void;
export function flowMoveTeam(f, dx: number, dy: number, bankSize: number): void; flowSetFormation(f, human: 0 | 1, formation: number): void;
export function flowConfirmTeam(f, bankSize: number): 'next' | 'done' | 'refused';
export function flowBuildMode(f, bankIds: readonly string[], seed: number): GameMode; flowAfterModeBuilt(f, m): void;
export function flowConfirmDraw(f): void;
export function flowCpuPair(m): number; flowBracketAction(f, m): BracketAction; flowMoveBracketChoice(f, delta: number): void;
export function flowConfirmBracket(f, m): BracketAction | 'none'; flowRecordCpuResult(m, pair: number, match: MatchState): void;
export function flowSpectateOver(f): void; flowSkipSpectate(f): void;
export function flowMatchOver(f, m, match: MatchState, abandoned: boolean): void; flowCaptionsDrained(f): void;
export function flowContinue(f): void; flowExitMatch(f, m): void;

// captions.ts
export function collectCaptions(match: MatchState, w: MatchWatch, human: HumanSide, cs: CaptionState, victoryScreen?: boolean): void;
```

**Decisiones fijadas con test (S-FL3, S-FL4):**
- **S-FL3 (recomendación §8.5 del informe): cuando hay pantalla de victoria propia, `collectCaptions` NO encola `winner`.** FINAL suena y se ve sus 3 s sobre la última imagen congelada, y al vaciarse la cola el flujo pasa a `'victory'`. ELIMINADO y EMPATE siguen siendo rótulos y, al vaciarse, se vuelve al selector (spec 60-61). En un cruce de la CPU (`'none'`) solo FINAL: el cuadro dice quién ganó. Así `sfxForCaption('winner')` ('none' de todos modos) y los cánticos nunca coinciden: los cánticos empiezan al entrar en `'victory'`, cuando la cola ya está vacía.
- **S-FL4: el entrenamiento se sale con R** (G9-1 literal), dentro del componente y solo cuando el partido no tiene reloj (`!modeRules(m).timed`): vuelve al selector sin rótulo. No hay CONTINUAR propio. La R de la página (reinicio por remonte) sigue existiendo solo tras `onGameOver`/`onVictory`, que el entrenamiento nunca dispara.

**Si el entrenamiento se difiere al paso 11 (Paco, G9-1: «es lo primero que se difiere»)** — la Task 9-1 se ejecuta igual (el motor con `NORMAL_RULES` por defecto es byte a byte el del paso 8, y 9-3/9-4/9-7 la importan: **9-1 NO es prescindible**, lo prescindible es el MODO). Lista cerrada de lo que cambia, y nada más:
1. `flow.ts`: `MODE_LIST = ['friendly-cpu', 'friendly-2p', 'world-cup']` (`GameModeKind`, `MODE_NAMES`, `MODE_BLURBS`, `HUMANS_BY_MODE` se quedan: son `Record<GameModeKind, …>` y el tipo sigue teniendo `'training'`).
2. `flow.test.ts`: en «lists the four modes…» el `toEqual` pasa a los tres (y el título); `it.skip` en «training: the chosen team against a drawn statue team» y en «R exits the training match…» con el comentario `// deferred to step 11 (G9-1)`; en «starts on mode-select…» los `for (let i = 0; i < 4; i++)` pasan a 3 y `flowMoveMode(f, -1)` sigue cayendo en `'world-cup'`.
3. `flow-layout.test.ts`: nada (`modeCardY(3)` es geometría, no depende de cuántos modos hay).
4. `mode.ts` / `mode.test.ts` / `match-run.test.ts` / `match.test.ts` / `hud.test.ts`: **nada** (el ruleset existe y se prueba aunque ningún modo lo use).
5. Task 9-7: nada de código (`MODE_LIST.length` manda en `drawModeSelect`); en el QA (C7) se tacha el bloque C.

- [ ] **Step 1: Escribir el test que falla de `flow-layout.ts`**

Crear `components/games/football-screen/flow-layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { VIEW_H, VIEW_W } from './camera';
import {
  BRACKET_ROW_H, BRACKET_ROW_TOP, DRAW_COL_X, FORMATION_ROW_Y, MODE_CARD_GAP, MODE_CARD_H, MODE_CARD_TOP, SELECT_HINT_Y,
  TEAM_CARD_H, TEAM_CARD_W, TEAM_GRID_COLS, TEAM_GRID_GAP_X, TEAM_GRID_GAP_Y, TEAM_GRID_TOP, VICTORY_HINT_Y,
  bracketRowY, drawColX, drawRowY, modeCardY, teamCardX, teamCardY, teamGridWidth,
} from './flow-layout';

const BANK = 16;

describe('the team grid', () => {
  it('is four columns wide and fits the canvas, centred', () => {
    expect(TEAM_GRID_COLS).toBe(4);
    const width = teamGridWidth(BANK);
    expect(width).toBe(4 * TEAM_CARD_W + 3 * TEAM_GRID_GAP_X);
    expect(width).toBeLessThan(VIEW_W);
    expect(teamCardX(0, BANK)).toBe((VIEW_W - width) / 2);
    expect(teamCardX(3, BANK) + TEAM_CARD_W).toBe(VIEW_W - teamCardX(0, BANK));
  });

  it('places index 5 on column 1, row 1 and index 15 on column 3, row 3', () => {
    expect(teamCardX(5, BANK)).toBe(teamCardX(1, BANK));
    expect(teamCardY(5)).toBe(TEAM_GRID_TOP + TEAM_CARD_H + TEAM_GRID_GAP_Y);
    expect(teamCardX(15, BANK)).toBe(teamCardX(3, BANK));
    expect(teamCardY(15)).toBe(TEAM_GRID_TOP + 3 * (TEAM_CARD_H + TEAM_GRID_GAP_Y));
  });

  it('leaves room under the last row for the formation selector and the hint', () => {
    const bottom = teamCardY(15) + TEAM_CARD_H;
    expect(bottom).toBeLessThan(FORMATION_ROW_Y);
    expect(FORMATION_ROW_Y).toBeLessThan(SELECT_HINT_Y);
    expect(SELECT_HINT_Y).toBeLessThan(VIEW_H);
  });
});

describe('the other screens', () => {
  it('four mode cards fit above the bottom of the canvas', () => {
    expect(modeCardY(0)).toBe(MODE_CARD_TOP);
    expect(modeCardY(3)).toBe(MODE_CARD_TOP + 3 * (MODE_CARD_H + MODE_CARD_GAP));
    expect(modeCardY(3) + MODE_CARD_H).toBeLessThan(VIEW_H - 40);
  });

  it('four bracket rows and the eight draw rows fit', () => {
    expect(bracketRowY(0)).toBe(BRACKET_ROW_TOP);
    expect(bracketRowY(3)).toBe(BRACKET_ROW_TOP + 3 * BRACKET_ROW_H);
    expect(bracketRowY(3) + BRACKET_ROW_H).toBeLessThan(VIEW_H);
    expect(drawRowY(3)).toBe(drawRowY(7));            // two columns of four
    expect(drawColX(0)).toBe(DRAW_COL_X[0]);
    expect(drawColX(4)).toBe(DRAW_COL_X[1]);
    expect(VICTORY_HINT_Y).toBeLessThan(VIEW_H);
  });
});
```

- [ ] **Step 2: Ver fallar, escribir `flow-layout.ts`, verde**

Run: `npx vitest run components/games/football-screen/flow-layout.test.ts` → FAIL (`Failed to resolve import "./flow-layout"`).

Crear `components/games/football-screen/flow-layout.ts`:

```ts
import { VIEW_H, VIEW_W } from './camera';

// The geometry of the six flow screens, as numbers the component draws with. Kept out
// of the .tsx (Global Constraints: a formula in draw() is a formula with no test).
// Every function is integer arithmetic on constants; nothing allocates.

// ── Team selector: the sixteen of the bank in a 4 x 4 grid (G9-4) ──────────────
export const TEAM_GRID_COLS = 4;
export const TEAM_CARD_W = 172;
export const TEAM_CARD_H = 74;
export const TEAM_GRID_GAP_X = 16;
export const TEAM_GRID_GAP_Y = 12;
export const TEAM_GRID_TOP = 78;
// Under the grid: the formation selector (G9-5) and the key hint.
export const FORMATION_ROW_Y = 432;
export const SELECT_HINT_Y = 478;

export function teamGridWidth(bankSize: number): number {
  const cols = bankSize < TEAM_GRID_COLS ? bankSize : TEAM_GRID_COLS;
  return cols * TEAM_CARD_W + (cols - 1) * TEAM_GRID_GAP_X;
}

export function teamCardX(index: number, bankSize: number): number {
  const originX = (VIEW_W - teamGridWidth(bankSize)) / 2;
  return originX + (index % TEAM_GRID_COLS) * (TEAM_CARD_W + TEAM_GRID_GAP_X);
}

export function teamCardY(index: number): number {
  return TEAM_GRID_TOP + Math.floor(index / TEAM_GRID_COLS) * (TEAM_CARD_H + TEAM_GRID_GAP_Y);
}

// ── Mode selector: four cards in a column ───────────────────────────────────────
export const MODE_CARD_W = 560;
export const MODE_CARD_H = 66;
export const MODE_CARD_GAP = 14;
export const MODE_CARD_TOP = 108;

export function modeCardY(index: number): number {
  return MODE_CARD_TOP + index * (MODE_CARD_H + MODE_CARD_GAP);
}

// ── Bracket: one row per pair of the round, then the prompt and the fallen ───────
export const BRACKET_ROW_TOP = 96;
export const BRACKET_ROW_H = 40;
export const BRACKET_PROMPT_Y = 330;
export const BRACKET_ELIMINATED_Y = 400;
export const BRACKET_HINT_Y = 470;

export function bracketRowY(pair: number): number {
  return BRACKET_ROW_TOP + pair * BRACKET_ROW_H;
}

// ── Draw: the eight in two columns of four ──────────────────────────────────────
export const DRAW_ROW_TOP = 120;
export const DRAW_ROW_H = 36;
export const DRAW_COL_X: readonly [number, number] = [VIEW_W / 2 - 150, VIEW_W / 2 + 150];

export function drawRowY(index: number): number {
  return DRAW_ROW_TOP + (index % 4) * DRAW_ROW_H;
}

export function drawColX(index: number): number {
  return DRAW_COL_X[index < 4 ? 0 : 1];
}

// ── Victory: title, team name, the figure lifting the cup, the hint ─────────────
export const VICTORY_TITLE_Y = 88;
export const VICTORY_TEAM_Y = 150;
export const VICTORY_FIGURE_Y = 320;
export const VICTORY_HINT_Y = VIEW_H - 32;
```

Run: `npx vitest run components/games/football-screen/flow-layout.test.ts` → PASS, **5 tests**.

- [ ] **Step 3: Escribir el test que falla de `captions.ts`**

Añadir al final de `components/games/football-screen/captions.test.ts`:

```ts
// ── Task 9-5: the ending as seen from each HumanSide, with and without a victory screen ──
describe('collectCaptions at the end of the match, by HumanSide', () => {
  function over(homeGoals: number, awayGoals: number): { m: MatchState; w: ReturnType<typeof createMatchWatch> } {
    const m = newMatch();
    const w = createMatchWatch();
    collectCaptions(m, w, 0, createCaptionState());
    m.score[0] = homeGoals;
    m.score[1] = awayGoals;
    // The goals are already "seen" by the watch: only the end is an edge here, so the
    // queue starts at FINAL and not at GOL.
    updateWatch(m, w);
    m.phase = 'over';
    return { m, w };
  }

  function queued(cs: ReturnType<typeof createCaptionState>): string[] {
    const out: string[] = [cs.kind];
    for (let i = 0; i < cs.queueLen; i++) out.push(cs.queue[i]);
    return out;
  }

  it('team 0 human, no screen: FINAL then GANADOR on a win, ELIMINADO on a loss (the step-8 behaviour, untouched)', () => {
    const win = over(2, 1);
    const csWin = createCaptionState();
    collectCaptions(win.m, win.w, 0, csWin);
    expect(queued(csWin)).toEqual(['full-time', 'winner']);
    const loss = over(0, 1);
    const csLoss = createCaptionState();
    collectCaptions(loss.m, loss.w, 0, csLoss);
    expect(queued(csLoss)).toEqual(['full-time', 'eliminated']);
  });

  // S-FL3 (final review §8.5): the victory screen REPLACES the GANADOR caption; it
  // does not follow it. FINAL still plays its three seconds. ELIMINADO is unaffected.
  it('with a victory screen, a human win queues FINAL only; a loss still queues ELIMINADO', () => {
    const win = over(2, 1);
    const cs = createCaptionState();
    collectCaptions(win.m, win.w, 0, cs, true);
    expect(queued(cs)).toEqual(['full-time']);
    const loss = over(0, 1);
    const cs2 = createCaptionState();
    collectCaptions(loss.m, loss.w, 0, cs2, true);
    expect(queued(cs2)).toEqual(['full-time', 'eliminated']);
  });

  it('team 1 human reads the same match the other way round', () => {
    const { m, w } = over(2, 1);
    const cs = createCaptionState();
    collectCaptions(m, w, 1, cs);
    expect(queued(cs)).toEqual(['full-time', 'eliminated']);
  });

  it("'both' (two-player friendly): whoever wins is a winner, never eliminated; with the screen, FINAL only", () => {
    const { m, w } = over(0, 3);
    const cs = createCaptionState();
    collectCaptions(m, w, 'both', cs);
    expect(queued(cs)).toEqual(['full-time', 'winner']);
    const cs2 = createCaptionState();
    collectCaptions(m, w, 'both', cs2, true);
    expect(queued(cs2)).toEqual(['full-time']);
  });

  it("'none' (a CPU pair watched on screen): FINAL only, the bracket says who won", () => {
    const { m, w } = over(1, 0);
    const cs = createCaptionState();
    collectCaptions(m, w, 'none', cs);
    expect(queued(cs)).toEqual(['full-time']);
  });

  it('an abandon at level is EMPATE for every side, screen or not', () => {
    for (const side of [0, 1, 'both', 'none'] as const) {
      for (const screen of [false, true]) {
        const { m, w } = over(1, 1);   // level, no shootout: winnerOf === -1
        const cs = createCaptionState();
        collectCaptions(m, w, side, cs, screen);
        expect(queued(cs)).toEqual(['full-time', 'draw']);
      }
    }
  });
});
```

`ReturnType<typeof createMatchWatch>` y `ReturnType<typeof createCaptionState>` evitan importar los tipos; si el fichero ya importa `MatchWatch`/`CaptionState`, usarlos.

- [ ] **Step 4: Ver fallar y escribir el cambio en `captions.ts`**

Run: `npx vitest run components/games/football-screen/captions.test.ts` → FAIL (los tests de `'both'`/`'none'` y `victoryScreen`: TypeScript rechaza `'both'` como `0 | 1` y el quinto argumento).

En `components/games/football-screen/captions.ts`: añadir el import

```ts
import { sideIsHuman, type HumanSide } from '../football-logic/mode';
```

y sustituir la firma y el bloque 5 de `collectCaptions` (líneas 143 y 200-212):

```ts
// `human` is who the keyboard drives (mode.ts HumanSide): 0 or 1 in a solo mode and in
// the World Cup (S-PK3 may put the human on either side), 'both' in the two-player
// friendly, 'none' for a CPU pair watched on screen. `victoryScreen` (Task 9-5, S-FL3,
// final review §8.5): when the mode shows a victory screen for a human win, GANADOR is
// NOT queued -- the screen replaces it; FINAL still runs its three seconds and the flow
// moves on when the queue drains. Defaults keep every step-8 call and test unchanged.
export function collectCaptions(match: MatchState, w: MatchWatch, human: HumanSide, cs: CaptionState, victoryScreen = false): void {
  // … puntos 1-4 sin cambios …

  // 5. The end. winnerOf is the ONE reader of the winner (stage B2 §8) and it can
  //    return -1 with the match over -- abandon() at a level score, the only draw this
  //    ruleset has (S-PK5). S-SC12: FINAL always whistles; then EMPATE on an abandon,
  //    nothing for a spectated pair (the bracket names the winner), GANADOR for a
  //    human win without a screen, ELIMINADO for a human loss.
  if (match.phase === 'over' && w.phase !== 'over') {
    pushCaption(cs, 'full-time');
    const winner = winnerOf(match);
    if (winner === -1) pushCaption(cs, 'draw');
    else if (human === 'none') return;
    else if (sideIsHuman(human, winner)) {
      if (!victoryScreen) pushCaption(cs, 'winner');
    } else pushCaption(cs, 'eliminated');
  }
}
```

Run: `npx vitest run components/games/football-screen/captions.test.ts` → PASS, **27 tests** (21 + 6).

- [ ] **Step 5: Escribir el test que falla de `flow.ts`**

Crear `components/games/football-screen/flow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { humanProfile, profileFor } from '../football-logic/ai';
import { createMatch, type MatchState } from '../football-logic/match';
import {
  modeAwayId, modeBracket, modeDifficulty, modeHomeId, modeHumanSide, modeScore, modeStatus, type GameMode,
} from '../football-logic/mode';
import { PITCH } from '../football-logic/pitch';
import { FORMATIONS, TEAMS, teamById } from '../football-logic/teams';
import {
  HUMANS_BY_MODE, MODE_BLURBS, MODE_LIST, MODE_NAMES,
  createFlowState, flowAfterModeBuilt, flowBracketAction, flowBuildMode, flowCaptionsDrained, flowConfirmBracket,
  flowConfirmDraw, flowConfirmMode, flowConfirmTeam, flowContinue, flowCpuPair, flowExitMatch, flowHumanCount,
  flowMatchOver, flowModeKind, flowMoveBracketChoice, flowMoveMode, flowMoveTeam, flowPickingHuman, flowRecordCpuResult,
  flowReset, flowSetFormation, flowSkipSpectate, flowSpectateOver, type FlowState,
} from './flow';

const BANK_IDS: readonly string[] = TEAMS.map((t) => t.id);
const BANK = BANK_IDS.length;
const SEED = 20260909;

function team(id: string) {
  const def = teamById(TEAMS, id);
  if (def === undefined) throw new Error(`missing team ${id}`);
  return def;
}

function finished(homeId: string, awayId: string, homeGoals: number, awayGoals: number, shootoutWinner: 0 | 1 = 0): MatchState {
  const m = createMatch([team(homeId), team(awayId)], FORMATIONS, PITCH, [humanProfile(team(homeId), 5), profileFor(team(awayId), 5)]);
  m.score[0] = homeGoals;
  m.score[1] = awayGoals;
  if (homeGoals === awayGoals) {
    m.shootout = m.scratch.shootout;
    m.shootout.taken[0] = 5;
    m.shootout.taken[1] = 5;
    m.shootout.scored[0] = shootoutWinner === 0 ? 4 : 3;
    m.shootout.scored[1] = shootoutWinner === 0 ? 3 : 4;
  }
  m.phase = 'over';
  return m;
}

// The human's match of the current mode, scored from the human's side.
function humanMatch(m: GameMode, goalsFor: number, goalsAgainst: number, humanWins: boolean): MatchState {
  const home = modeHomeId(m);
  const away = modeAwayId(m);
  return modeHumanSide(m) === 0
    ? finished(home, away, goalsFor, goalsAgainst, humanWins ? 0 : 1)
    : finished(home, away, goalsAgainst, goalsFor, humanWins ? 1 : 0);
}

// Walks the selector to a mode and a team, and builds the mode as the component does.
function start(kind: string, teamIndex: number, secondIndex = -1): { f: FlowState; m: GameMode } {
  const f = createFlowState();
  while (flowModeKind(f) !== kind) flowMoveMode(f, 1);
  flowConfirmMode(f);
  f.cursor = teamIndex;
  const first = flowConfirmTeam(f, BANK);
  if (first === 'next') {
    f.cursor = secondIndex;
    expect(flowConfirmTeam(f, BANK)).toBe('done');
  } else expect(first).toBe('done');
  const m = flowBuildMode(f, BANK_IDS, SEED);
  flowAfterModeBuilt(f, m);
  return { f, m };
}

// Resolves the CPU pairs of the round by SALTAR, the way the component does.
function skipCpuPairs(f: FlowState, m: GameMode): void {
  while (flowBracketAction(f, m) !== 'play') {
    flowMoveBracketChoice(f, 1);
    expect(flowBracketAction(f, m)).toBe('skip');
    expect(flowConfirmBracket(f, m)).toBe('skip');
    const pair = flowCpuPair(m);
    const wc = modeBracket(m);
    if (wc === null) throw new Error('no bracket');
    flowRecordCpuResult(m, pair, finished(wc.entrants[pair * 2], wc.entrants[pair * 2 + 1], 1, 0));
    flowMoveBracketChoice(f, 1);   // back to VER, as the component leaves it
  }
}

describe('the mode selector', () => {
  it('lists the four modes of G9-1..G9-4 in order, with their names, blurbs and human counts', () => {
    expect(MODE_LIST).toEqual(['friendly-cpu', 'friendly-2p', 'training', 'world-cup']);
    expect(MODE_NAMES['friendly-cpu']).toBe('AMISTOSO');
    expect(MODE_NAMES['friendly-2p']).toBe('AMISTOSO A DOS');
    expect(MODE_NAMES.training).toBe('ENTRENAMIENTO');
    expect(MODE_NAMES['world-cup']).toBe('MUNDIAL');
    for (const kind of MODE_LIST) expect(MODE_BLURBS[kind].length).toBeGreaterThan(0);
    expect(HUMANS_BY_MODE).toEqual({ 'friendly-cpu': 1, 'friendly-2p': 2, training: 1, 'world-cup': 1 });
  });

  it('starts on mode-select at AMISTOSO, wraps in both directions, and A moves to team-select', () => {
    const f = createFlowState();
    expect(f.phase).toBe('mode-select');
    expect(flowModeKind(f)).toBe('friendly-cpu');
    flowMoveMode(f, -1);
    expect(flowModeKind(f)).toBe('world-cup');
    for (let i = 0; i < 4; i++) flowMoveMode(f, 1);
    expect(flowModeKind(f)).toBe('world-cup');
    flowMoveMode(f, 1);
    expect(flowModeKind(f)).toBe('friendly-cpu');
    flowConfirmMode(f);
    expect(f.phase).toBe('team-select');
    expect(flowPickingHuman(f)).toBe(0);
    expect(flowHumanCount(f)).toBe(1);
    // A second A on a screen that is not mode-select does nothing to the mode.
    flowMoveMode(f, 1);
    expect(flowModeKind(f)).toBe('friendly-cpu');
  });
});

describe('the team selector', () => {
  it('moves the cursor on a 4 x 4 grid, wrapping rows and columns, and refuses a slot past the bank', () => {
    const f = createFlowState();
    flowConfirmMode(f);
    flowMoveTeam(f, 1, 0, BANK);
    expect(f.cursor).toBe(1);
    flowMoveTeam(f, -1, 0, BANK);
    flowMoveTeam(f, -1, 0, BANK);
    expect(f.cursor).toBe(3);
    flowMoveTeam(f, 0, 1, BANK);
    expect(f.cursor).toBe(7);
    flowMoveTeam(f, 0, -1, BANK);
    flowMoveTeam(f, 0, -1, BANK);
    expect(f.cursor).toBe(15);
    // A bank of 14: from 10 (column 2, row 2), down would land on 14, which does not
    // exist -- stay. From 9 the same move lands on 13, which does.
    f.cursor = 10;
    flowMoveTeam(f, 0, 1, 14);
    expect(f.cursor).toBe(10);
    f.cursor = 9;
    flowMoveTeam(f, 0, 1, 14);
    expect(f.cursor).toBe(13);
    // And the cursor does nothing outside team-select.
    const idle = createFlowState();
    flowMoveTeam(idle, 1, 0, BANK);
    expect(idle.cursor).toBe(0);
  });

  it('solo modes pick one team and are done; the two-player friendly picks J1 then J2, never the same', () => {
    const solo = createFlowState();
    flowConfirmMode(solo);
    solo.cursor = 4;
    expect(flowConfirmTeam(solo, BANK)).toBe('done');
    expect(solo.picked).toEqual([4, -1]);

    const two = createFlowState();
    flowMoveMode(two, 1);
    flowConfirmMode(two);
    two.cursor = 2;
    expect(flowConfirmTeam(two, BANK)).toBe('next');
    expect(flowPickingHuman(two)).toBe(1);
    expect(flowConfirmTeam(two, BANK)).toBe('refused');   // the same team, G9-4: "sin repetir"
    two.cursor = 9;
    expect(flowConfirmTeam(two, BANK)).toBe('done');
    expect(two.picked).toEqual([2, 9]);
  });

  it('keeps one formation per human, 3-3-2 by default (G9-5)', () => {
    const f = createFlowState();
    flowMoveMode(f, 1);
    flowConfirmMode(f);
    expect(f.formation).toEqual([0, 0]);
    flowSetFormation(f, 0, 2);
    flowSetFormation(f, 1, 1);
    expect(f.formation).toEqual([2, 1]);
  });
});

describe('flowBuildMode -- the one place a mode is built', () => {
  it('a CPU friendly: the chosen team at home, a drawn rival away, deterministic by seed, straight to the match', () => {
    const { f, m } = start('friendly-cpu', 0);
    expect(modeHomeId(m)).toBe('espana');
    expect(modeAwayId(m)).not.toBe('espana');
    expect(modeBracket(m)).toBeNull();
    expect(f.phase).toBe('match');
    const again = start('friendly-cpu', 0);
    expect(modeAwayId(again.m)).toBe(modeAwayId(m));
  });

  it('a two-player friendly: J1 at home, J2 away', () => {
    const { f, m } = start('friendly-2p', 3, 11);
    expect(modeHomeId(m)).toBe(BANK_IDS[3]);
    expect(modeAwayId(m)).toBe(BANK_IDS[11]);
    expect(modeHumanSide(m)).toBe('both');
    expect(f.phase).toBe('match');
  });

  it('training: the chosen team against a drawn statue team', () => {
    const { f, m } = start('training', 7);
    expect(modeHomeId(m)).toBe(BANK_IDS[7]);
    expect(modeAwayId(m)).not.toBe(BANK_IDS[7]);
    expect(f.phase).toBe('match');
  });

  it('the World Cup: the chosen team in a drawn bracket of eight, and the flow goes to the draw screen', () => {
    const { f, m } = start('world-cup', 5);
    const wc = modeBracket(m);
    expect(wc).not.toBeNull();
    if (wc === null) return;
    expect(wc.bracket).toContain(BANK_IDS[5]);
    expect(wc.seed).toBe(SEED);
    expect(f.phase).toBe('draw');
    flowConfirmDraw(f);
    expect(f.phase).toBe('bracket');
    expect(f.bracketChoice).toBe(0);
  });
});

describe('the bracket screen (G9-3: VER / SALTAR, then the human match)', () => {
  it('offers VER by default, SALTAR on a toggle, and PLAY once the three CPU pairs are resolved', () => {
    const { f, m } = start('world-cup', 1);
    flowConfirmDraw(f);
    expect(flowBracketAction(f, m)).toBe('spectate');
    flowMoveBracketChoice(f, 1);
    expect(flowBracketAction(f, m)).toBe('skip');
    flowMoveBracketChoice(f, -1);
    expect(flowBracketAction(f, m)).toBe('spectate');
    let pairs = 0;
    while (flowBracketAction(f, m) !== 'play') {
      const pair = flowCpuPair(m);
      expect(pair).toBeGreaterThanOrEqual(0);
      const wc = modeBracket(m);
      if (wc === null) throw new Error('no bracket');
      flowRecordCpuResult(m, pair, finished(wc.entrants[pair * 2], wc.entrants[pair * 2 + 1], 2, 2, 1));
      pairs++;
    }
    expect(pairs).toBe(3);
    expect(flowCpuPair(m)).toBe(-1);
    expect(flowConfirmBracket(f, m)).toBe('play');
    expect(f.phase).toBe('match');
  });

  it('VER moves to spectate; the end of the spectated match drains through over back to the bracket; A skips straight to it', () => {
    const { f, m } = start('world-cup', 1);
    flowConfirmDraw(f);
    expect(flowConfirmBracket(f, m)).toBe('spectate');
    expect(f.phase).toBe('spectate');
    flowSpectateOver(f);
    expect(f.phase).toBe('over');
    expect(f.after).toBe('bracket');
    flowCaptionsDrained(f);
    expect(f.phase).toBe('bracket');
    expect(flowConfirmBracket(f, m)).toBe('spectate');
    flowSkipSpectate(f);
    expect(f.phase).toBe('bracket');
    expect(flowConfirmBracket(createFlowState(), m)).toBe('none');
  });

  it('flowRecordCpuResult refuses an undecided match', () => {
    const { m } = start('world-cup', 1);
    const wc = modeBracket(m);
    if (wc === null) throw new Error('no bracket');
    const pair = flowCpuPair(m);
    const level = finished(wc.entrants[pair * 2], wc.entrants[pair * 2 + 1], 0, 0);
    level.shootout = null;
    expect(() => flowRecordCpuResult(m, pair, level)).toThrow();
  });
});

describe('the end of a match', () => {
  it('a won friendly: over -> victory once the captions drain; CONTINUAR resets to mode-select keeping the mode cursor', () => {
    const { f, m } = start('friendly-cpu', 0);
    flowMatchOver(f, m, humanMatch(m, 1, 0, true), false);
    expect(f.phase).toBe('over');
    expect(f.after).toBe('victory');
    expect(modeStatus(m)).toBe('champion');
    flowCaptionsDrained(f);
    expect(f.phase).toBe('victory');
    flowContinue(f);
    expect(f.phase).toBe('mode-select');
    expect(f.picked).toEqual([-1, -1]);
    expect(flowModeKind(f)).toBe('friendly-cpu');
  });

  it('a lost friendly and a level abandon go back to mode-select after the caption (spec 60-61)', () => {
    const lost = start('friendly-cpu', 0);
    flowMatchOver(lost.f, lost.m, humanMatch(lost.m, 0, 2, false), false);
    expect(lost.f.after).toBe('mode-select');
    flowCaptionsDrained(lost.f);
    expect(lost.f.phase).toBe('mode-select');

    const level = start('friendly-2p', 0, 1);
    const abandoned = finished('espana', 'italia', 1, 1);
    abandoned.shootout = null;
    flowMatchOver(level.f, level.m, abandoned, true);
    expect(modeStatus(level.m)).toBe('draw');
    expect(level.f.after).toBe('mode-select');
  });

  it('a World Cup round won goes back to the bracket with the next difficulty; the final won goes to victory', () => {
    const { f, m } = start('world-cup', 2);
    flowConfirmDraw(f);
    const difficulties: number[] = [];
    for (let round = 0; round < 3; round++) {
      skipCpuPairs(f, m);
      difficulties.push(modeDifficulty(m));
      expect(flowConfirmBracket(f, m)).toBe('play');
      flowMatchOver(f, m, humanMatch(m, 2, 0, true), false);
      expect(f.phase).toBe('over');
      flowCaptionsDrained(f);
    }
    expect(difficulties).toEqual([4, 6, 8]);
    expect(f.phase).toBe('victory');
    expect(modeStatus(m)).toBe('champion');
    expect(modeScore(m)).toBe(67_000);
  });

  it('a World Cup match lost, or abandoned with a lead (G9-8), is eliminated and returns to mode-select', () => {
    const lost = start('world-cup', 2);
    flowConfirmDraw(lost.f);
    skipCpuPairs(lost.f, lost.m);
    flowConfirmBracket(lost.f, lost.m);
    flowMatchOver(lost.f, lost.m, humanMatch(lost.m, 0, 1, false), false);
    expect(modeStatus(lost.m)).toBe('eliminated');
    expect(lost.f.after).toBe('mode-select');

    const abandoned = start('world-cup', 2);
    flowConfirmDraw(abandoned.f);
    skipCpuPairs(abandoned.f, abandoned.m);
    flowConfirmBracket(abandoned.f, abandoned.m);
    const leading = humanMatch(abandoned.m, 1, 0, true);
    flowMatchOver(abandoned.f, abandoned.m, leading, true);
    expect(modeStatus(abandoned.m)).toBe('eliminated');
    expect(abandoned.f.after).toBe('mode-select');
  });

  // S-FL4: R leaves a training match (no clock, no natural end) and nothing else.
  it('R exits the training match to mode-select and does nothing in a timed match', () => {
    const training = start('training', 4);
    flowExitMatch(training.f, training.m);
    expect(training.f.phase).toBe('mode-select');
    const friendly = start('friendly-cpu', 4);
    flowExitMatch(friendly.f, friendly.m);
    expect(friendly.f.phase).toBe('match');
  });

  it('every transition is a no-op outside its phase', () => {
    const f = createFlowState();
    flowConfirmDraw(f);
    flowSpectateOver(f);
    flowSkipSpectate(f);
    flowCaptionsDrained(f);
    flowContinue(f);
    expect(f.phase).toBe('mode-select');
    flowReset(f);
    expect(f).toEqual(createFlowState());
  });
});
```

- [ ] **Step 6: Ver fallar**

Run: `npx vitest run components/games/football-screen/flow.test.ts`
Expected: FAIL — `Failed to resolve import "./flow"`.

- [ ] **Step 7: Escribir `flow.ts`**

Crear `components/games/football-screen/flow.ts`:

```ts
import { winnerOf, type MatchState } from '../football-logic/match';
import {
  createFriendlyMode, createWorldCupMode, drawRival, drawSeedFor, modeAbandonMatch, modeBracket, modeEndMatch, modeRules,
  modeStatus, type GameMode, type GameModeKind,
} from '../football-logic/mode';
import { createRng } from '../football-logic/rng';
import { nextCpuPair, resolveCpuMatch } from '../football-logic/world-cup';
import { TEAM_GRID_COLS } from './flow-layout';

// G9-9: the flow lives inside the component, one canvas, one loop -- and its phase
// machine lives HERE, pure and tested, so VaultWorldCupGame.tsx only asks and draws.
// The component calls these on key events and on the match ending; nothing here reads
// the keyboard, the clock or the DOM, and nothing allocates after createFlowState.
export type FlowPhase =
  | 'mode-select'   // the four modes
  | 'team-select'   // the sixteen, with the formation selector (G9-4, G9-5)
  | 'draw'          // the World Cup's eight, drawn
  | 'bracket'       // the round's pairs; VER / SALTAR per CPU pair, then the human's match
  | 'match'         // a match with at least one human
  | 'spectate'      // a CPU pair watched at x4 (G9-3)
  | 'victory'       // GANADOR / CAMPEONES DEL MUNDO, CONTINUAR
  | 'over';         // the match ended: the captions drain, then `after`

export type BracketAction = 'spectate' | 'skip' | 'play';

export const MODE_LIST: readonly GameModeKind[] = ['friendly-cpu', 'friendly-2p', 'training', 'world-cup'];

export const MODE_NAMES: Readonly<Record<GameModeKind, string>> = {
  'friendly-cpu': 'AMISTOSO',
  'friendly-2p': 'AMISTOSO A DOS',
  training: 'ENTRENAMIENTO',
  'world-cup': 'MUNDIAL',
};

export const MODE_BLURBS: Readonly<Record<GameModeKind, string>> = {
  'friendly-cpu': 'UN PARTIDO CONTRA LA CPU · RIVAL SORTEADO',
  'friendly-2p': 'DOS EN EL MISMO TECLADO · J1 WASD + C/V/B · J2 FLECHAS + J/K/L',
  training: 'SIN RELOJ · EL RIVAL NO SE MUEVE, SOLO SU PORTERO · R PARA SALIR',
  'world-cup': '8 SELECCIONES SORTEADAS · 3 PARTIDOS · SIN CONTINUE · PUNTÚA',
};

export const HUMANS_BY_MODE: Readonly<Record<GameModeKind, 1 | 2>> = {
  'friendly-cpu': 1,
  'friendly-2p': 2,
  training: 1,
  'world-cup': 1,
};

export type FlowState = {
  phase: FlowPhase;
  modeIndex: number;            // cursor on MODE_LIST; survives a reset (the last mode played)
  picking: 0 | 1;               // which human is choosing on team-select
  cursor: number;               // team index under the cursor
  picked: [number, number];     // team indices chosen, -1 = none
  formation: [number, number];  // per human; 0 = 3-3-2 (G9-5)
  bracketChoice: 0 | 1;         // 0 = VER, 1 = SALTAR
  after: FlowPhase;             // where 'over' goes once the captions drain
};

export function createFlowState(): FlowState {
  return { phase: 'mode-select', modeIndex: 0, picking: 0, cursor: 0, picked: [-1, -1], formation: [0, 0], bracketChoice: 0, after: 'mode-select' };
}

// Back to the mode selector, in place. modeIndex is kept on purpose: "otra vez" lands
// on the mode just played.
export function flowReset(f: FlowState): void {
  f.phase = 'mode-select';
  f.picking = 0;
  f.cursor = 0;
  f.picked[0] = -1;
  f.picked[1] = -1;
  f.formation[0] = 0;
  f.formation[1] = 0;
  f.bracketChoice = 0;
  f.after = 'mode-select';
}

export function flowModeKind(f: FlowState): GameModeKind {
  return MODE_LIST[f.modeIndex];
}

export function flowHumanCount(f: FlowState): 1 | 2 {
  return HUMANS_BY_MODE[flowModeKind(f)];
}

export function flowPickingHuman(f: FlowState): 0 | 1 {
  return f.picking;
}

// ── mode-select ─────────────────────────────────────────────────────────────────

export function flowMoveMode(f: FlowState, delta: number): void {
  if (f.phase !== 'mode-select') return;
  const n = MODE_LIST.length;
  f.modeIndex = (((f.modeIndex + delta) % n) + n) % n;
}

export function flowConfirmMode(f: FlowState): void {
  if (f.phase !== 'mode-select') return;
  f.phase = 'team-select';
  f.picking = 0;
  f.cursor = 0;
  f.picked[0] = -1;
  f.picked[1] = -1;
  f.formation[0] = 0;
  f.formation[1] = 0;
}

// ── team-select ─────────────────────────────────────────────────────────────────

// A 4-column grid over the bank, wrapping on both axes; a wrap that lands past the
// bank (a bank that is not a multiple of four) leaves the cursor where it was.
export function flowMoveTeam(f: FlowState, dx: number, dy: number, bankSize: number): void {
  if (f.phase !== 'team-select') return;
  const cols = TEAM_GRID_COLS;
  const rows = Math.ceil(bankSize / cols);
  const col = (((f.cursor % cols) + dx) % cols + cols) % cols;
  const row = (((Math.floor(f.cursor / cols)) + dy) % rows + rows) % rows;
  const next = row * cols + col;
  if (next < bankSize) f.cursor = next;
}

// G9-5: the formation is chosen on the selector with the same keys as in the match
// (padChoice on the human's own table); the component mirrors the pad here so the
// mode can be built from the flow alone.
export function flowSetFormation(f: FlowState, human: 0 | 1, formation: number): void {
  f.formation[human] = formation;
}

// G9-4: solo modes pick one team; the two-player friendly picks J1 and then J2, and
// J2 may not repeat J1's team.
export function flowConfirmTeam(f: FlowState, bankSize: number): 'next' | 'done' | 'refused' {
  if (f.phase !== 'team-select') return 'refused';
  if (f.cursor < 0 || f.cursor >= bankSize) return 'refused';
  if (f.picking === 1 && f.cursor === f.picked[0]) return 'refused';
  f.picked[f.picking] = f.cursor;
  if (f.picking === 0 && flowHumanCount(f) === 2) {
    f.picking = 1;
    return 'next';
  }
  return 'done';
}

// The ONE place a mode is built (Vault Fighter's confirmSelection). G9-4: the CPU
// friendly and the training draw their rival; the two-player friendly takes J2's
// pick; the World Cup draws seven of the fifteen. G9-7: everything comes off `seed`.
export function flowBuildMode(f: FlowState, bankIds: readonly string[], seed: number): GameMode {
  const kind = flowModeKind(f);
  const homeId = bankIds[f.picked[0]];
  if (kind === 'world-cup') return createWorldCupMode(bankIds, homeId, seed);
  const awayId = kind === 'friendly-2p' ? bankIds[f.picked[1]] : drawRival(bankIds, homeId, createRng(drawSeedFor(seed)));
  return createFriendlyMode(kind, homeId, awayId);
}

// A mode with a bracket shows the draw first; one without goes straight to the match.
// The question is "does this mode have a bracket", never "which mode is it".
export function flowAfterModeBuilt(f: FlowState, m: GameMode): void {
  if (f.phase !== 'team-select') return;
  f.phase = modeBracket(m) === null ? 'match' : 'draw';
}

// ── draw ────────────────────────────────────────────────────────────────────────

export function flowConfirmDraw(f: FlowState): void {
  if (f.phase !== 'draw') return;
  f.phase = 'bracket';
  f.bracketChoice = 0;
}

// ── bracket (G9-3) ──────────────────────────────────────────────────────────────

// The next CPU pair of the round still to resolve, or -1 when the human's match is up.
export function flowCpuPair(m: GameMode): number {
  const wc = modeBracket(m);
  return wc === null ? -1 : nextCpuPair(wc);
}

export function flowBracketAction(f: FlowState, m: GameMode): BracketAction {
  if (flowCpuPair(m) === -1) return 'play';
  return f.bracketChoice === 0 ? 'spectate' : 'skip';
}

export function flowMoveBracketChoice(f: FlowState, delta: number): void {
  if (f.phase !== 'bracket' || delta === 0) return;
  f.bracketChoice = f.bracketChoice === 0 ? 1 : 0;
}

// A on the bracket. 'spectate' moves to the spectate phase (the component starts the
// CPU run on screen); 'skip' stays here (the component finishes the run headless and
// records it); 'play' moves to the match. 'none' outside the bracket phase.
export function flowConfirmBracket(f: FlowState, m: GameMode): BracketAction | 'none' {
  if (f.phase !== 'bracket') return 'none';
  const action = flowBracketAction(f, m);
  if (action === 'spectate') f.phase = 'spectate';
  else if (action === 'play') f.phase = 'match';
  return action;
}

// Records a CPU pair's result, whichever way it was produced (watched or headless).
// A CPU pair cannot end undecided (finishMatchRun's cap is never hit, its tests say),
// so -1 here is a programming error, not a state.
export function flowRecordCpuResult(m: GameMode, pair: number, match: MatchState): void {
  const wc = modeBracket(m);
  if (wc === null) return;
  const winner = winnerOf(match);
  if (winner === -1) throw new Error('a CPU pair cannot end undecided');
  resolveCpuMatch(wc, pair, winner, match.score[0], match.score[1]);
}

// ── spectate ────────────────────────────────────────────────────────────────────

// The watched match ended by itself: FINAL drains, then back to the bracket.
export function flowSpectateOver(f: FlowState): void {
  if (f.phase !== 'spectate') return;
  f.phase = 'over';
  f.after = 'bracket';
}

// A mid-match: the component has already finished the run headless and recorded it;
// straight back to the bracket, no FINAL.
export function flowSkipSpectate(f: FlowState): void {
  if (f.phase !== 'spectate') return;
  f.phase = 'bracket';
  f.bracketChoice = 0;
}

// ── match ───────────────────────────────────────────────────────────────────────

// The human's match ended, naturally or by the viewport guard (`abandoned`). The mode
// resolves it; the flow only asks the resulting status to know where 'over' goes:
// a champion to the victory screen, a World Cup still playing back to the bracket,
// anything else (eliminated, draw, or any abandon) to the mode selector after the
// caption (spec 60-61).
export function flowMatchOver(f: FlowState, m: GameMode, match: MatchState, abandoned: boolean): void {
  if (f.phase !== 'match') return;
  if (abandoned) modeAbandonMatch(m, match);
  else modeEndMatch(m, match);
  f.phase = 'over';
  const status = modeStatus(m);
  if (abandoned) f.after = 'mode-select';
  else if (status === 'champion') f.after = 'victory';
  else if (status === 'playing') f.after = 'bracket';
  else f.after = 'mode-select';
}

// The caption queue emptied: go where `after` says.
export function flowCaptionsDrained(f: FlowState): void {
  if (f.phase !== 'over') return;
  if (f.after === 'mode-select') {
    flowReset(f);
    return;
  }
  f.phase = f.after;
  if (f.after === 'bracket') f.bracketChoice = 0;
}

// CONTINUAR on the victory screen (spec: back to the mode selector).
export function flowContinue(f: FlowState): void {
  if (f.phase !== 'victory') return;
  flowReset(f);
}

// S-FL4 (G9-1): R leaves a match that has no clock -- the training -- and nothing
// else. The page's own R (restart by remount) only exists after a World Cup ends.
export function flowExitMatch(f: FlowState, m: GameMode): void {
  if (f.phase !== 'match' || modeRules(m).timed) return;
  flowReset(f);
}
```

- [ ] **Step 8: Verde y suite completa**

Run: `npx vitest run components/games/football-screen/flow.test.ts && npx vitest run && npx tsc --noEmit`
Expected: `flow` **18 tests** (2 + 3 + 4 + 3 + 6); **la suite pasa de 1116 a 1145 tests en 67 ficheros** (5 layout + 6 captions + 18 flow); `tsc` sin salida (el componente sigue compilando: `collectCaptions(match, watch, HUMAN_TEAM, captions)` pasa un `0 | 1`, que es un `HumanSide`).

- [ ] **Step 9: Motor intacto y azar**

Run: `git diff --stat 0e553af -- components/games/football-logic/ && grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/`
Expected: el diff solo lista `match.ts` y `match.test.ts`; grep vacío.

- [ ] **Step 10: Ledger y proponer commit**

Ledger: `Task 9-5: DONE (1145/1145 en 67 ficheros; flow 18, flow-layout 5, captions +6; S-FL3 (sin GANADOR con pantalla) y S-FL4 (R sale del entrenamiento) fijados con test).`

No ejecutar. Mensaje propuesto:

`feat(world-cup): pure phase machine for the flow screens (flow.ts), screen layout numbers, and captions aware of HumanSide and the victory screen`

**QA de Paco para esta tarea:** ninguno todavía.

---

## Task 9-6: `football-screen/particles.ts` (confeti y fuegos artificiales sobre un depósito) y los cánticos en `lib/sfx-vault-world-cup.ts`

**Files:**
- Create: `components/games/football-screen/particles.ts`, `components/games/football-screen/particles.test.ts`
- Modify: `lib/sfx-vault-world-cup.ts` (tipo 16-24, `RAW_FILES` 29-38, `SFX_VOLUME` 50-59, clase 61-109), `lib/sfx-vault-world-cup.test.ts` (`ALL` 10-14 + bloque nuevo)
- Modify: `components/games/football-screen/sfx-map.ts` (append), `sfx-map.test.ts` (append)

**Interfaces:**
- Consumes: `FxKind` (`mode.ts`, Task 9-4); `Rng` (`rng.ts`); `VIEW_W`, `VIEW_H` (`camera.ts`).
- Produces:

```ts
// particles.ts
export const PARTICLE_COUNT = 240;
export const FX_SEED_SALT: number;
export function fxSeedFor(seed: number): number;
export const FX_DIR_COUNT = 32; export const FX_DIR_X: readonly number[]; export const FX_DIR_Y: readonly number[];
export const FX_COLORS: readonly string[];
export type ParticlePool = { count: number; x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; life: Int16Array; color: Uint8Array; size: Uint8Array; burstIn: number };
export function createParticlePool(count?: number): ParticlePool;
export function startFx(pool: ParticlePool, kind: FxKind, rng: Rng): void;
export function stepFx(pool: ParticlePool, kind: FxKind, rng: Rng): void;
export function activeCount(pool: ParticlePool): number;
// lib/sfx-vault-world-cup.ts
export type VaultWorldCupSfx = 'whistle_start' | 'whistle_end' | 'whistle_foul' | 'goal_net' | 'goal_shout' | 'goal_crowd' | 'kick' | 'crowd' | 'chants_victory';
play(name: VaultWorldCupSfx, gain?: number): void;   // gain multiplica SFX_VOLUME[name], recortado a [0, 1]
stop(name: VaultWorldCupSfx): void;                   // corta el último clon vivo de ese nombre
// sfx-map.ts
export const CHANTS_LOW_GAIN = 0.4;
export function victoryChantGain(kind: FxKind): number;   // 1 en 'fireworks', CHANTS_LOW_GAIN en 'confetti'
```

- [ ] **Step 1: Escribir el test que falla de `particles.ts`**

Crear `components/games/football-screen/particles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRng } from '../football-logic/rng';
import { VIEW_H, VIEW_W } from './camera';
import {
  FIREWORK_BURST_SIZE, FIREWORK_BURST_STEPS, FX_COLORS, FX_DIR_COUNT, FX_DIR_X, FX_DIR_Y, FX_SEED_SALT, PARTICLE_COUNT,
  activeCount, createParticlePool, fxSeedFor, startFx, stepFx,
} from './particles';

describe('the pool', () => {
  it('is created once with typed arrays of the requested size, all inactive', () => {
    const pool = createParticlePool(10);
    expect(pool.count).toBe(10);
    expect(pool.x.length).toBe(10);
    expect(pool.life.length).toBe(10);
    expect(activeCount(pool)).toBe(0);
    expect(createParticlePool().count).toBe(PARTICLE_COUNT);
  });

  it('the fourth stream: fxSeedFor is deterministic, unsigned, and not the seed itself', () => {
    expect(fxSeedFor(12345)).toBe(fxSeedFor(12345));
    expect(fxSeedFor(12345)).not.toBe(12345);
    expect(fxSeedFor(12345)).toBeGreaterThanOrEqual(0);
    expect(fxSeedFor(-1)).toBeGreaterThanOrEqual(0);
    expect(FX_SEED_SALT).not.toBe(0);
  });

  it('the burst directions are 32 unit vectors precomputed once, starting at (1, 0)', () => {
    expect(FX_DIR_COUNT).toBe(32);
    expect(FX_DIR_X.length).toBe(32);
    for (let i = 0; i < FX_DIR_COUNT; i++) {
      expect(FX_DIR_X[i] * FX_DIR_X[i] + FX_DIR_Y[i] * FX_DIR_Y[i]).toBeCloseTo(1, 9);
    }
    expect(FX_DIR_X[0]).toBeCloseTo(1, 9);
    expect(FX_DIR_Y[0]).toBeCloseTo(0, 9);
    expect(FX_COLORS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('confetti', () => {
  it('starts with every particle active inside the view and keeps them inside for a thousand steps, wrapping at the bottom', () => {
    const pool = createParticlePool(60);
    const rng = createRng(fxSeedFor(1));
    startFx(pool, 'confetti', rng);
    expect(activeCount(pool)).toBe(60);
    for (let i = 0; i < 60; i++) {
      expect(pool.x[i]).toBeGreaterThanOrEqual(0);
      expect(pool.x[i]).toBeLessThanOrEqual(VIEW_W);
      expect(pool.y[i]).toBeGreaterThanOrEqual(-4);
      expect(pool.y[i]).toBeLessThanOrEqual(VIEW_H);
      expect(pool.vy[i]).toBeGreaterThan(0);
    }
    let wrapped = 0;
    for (let step = 0; step < 1000; step++) {
      const before = pool.y[0];
      stepFx(pool, 'confetti', rng);
      if (pool.y[0] < before) wrapped++;
      for (let i = 0; i < 60; i++) {
        expect(pool.x[i]).toBeGreaterThanOrEqual(0);
        expect(pool.x[i]).toBeLessThanOrEqual(VIEW_W);
        expect(pool.y[i]).toBeLessThanOrEqual(VIEW_H + 4);
      }
    }
    // At >= 1.2 px per step, particle 0 fell the whole 500 px view at least twice.
    expect(wrapped).toBeGreaterThanOrEqual(2);
    expect(activeCount(pool)).toBe(60);
  });
});

describe('fireworks', () => {
  it('starts empty, bursts FIREWORK_BURST_SIZE particles from one point on the first step, and bursts again FIREWORK_BURST_STEPS later', () => {
    const pool = createParticlePool();
    const rng = createRng(fxSeedFor(2));
    startFx(pool, 'fireworks', rng);
    expect(activeCount(pool)).toBe(0);
    stepFx(pool, 'fireworks', rng);
    expect(activeCount(pool)).toBe(FIREWORK_BURST_SIZE);
    // One origin: after one step of flight the spread is at most one step of speed.
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < pool.count; i++) {
      if (pool.life[i] === 0) continue;
      if (pool.x[i] < minX) minX = pool.x[i];
      if (pool.x[i] > maxX) maxX = pool.x[i];
    }
    expect(maxX - minX).toBeLessThan(12);
    for (let i = 1; i < FIREWORK_BURST_STEPS; i++) stepFx(pool, 'fireworks', rng);
    expect(activeCount(pool)).toBeLessThanOrEqual(FIREWORK_BURST_SIZE);
    stepFx(pool, 'fireworks', rng);
    expect(activeCount(pool)).toBeGreaterThan(FIREWORK_BURST_SIZE / 2);
  });

  it('particles fall under gravity and die: over 600 steps the count never exceeds the pool and some die', () => {
    const pool = createParticlePool();
    const rng = createRng(fxSeedFor(3));
    startFx(pool, 'fireworks', rng);
    let peak = 0;
    let died = false;
    for (let step = 0; step < 600; step++) {
      const before = activeCount(pool);
      stepFx(pool, 'fireworks', rng);
      const now = activeCount(pool);
      if (now > peak) peak = now;
      if (now < before) died = true;
      expect(now).toBeLessThanOrEqual(pool.count);
    }
    expect(peak).toBeGreaterThan(FIREWORK_BURST_SIZE);
    expect(died).toBe(true);
    // Gravity: a live particle's vy grows step over step.
    let live = -1;
    for (let i = 0; i < pool.count; i++) if (pool.life[i] > 1) { live = i; break; }
    expect(live).toBeGreaterThanOrEqual(0);
    const vyBefore = pool.vy[live];
    stepFx(pool, 'fireworks', rng);
    expect(pool.vy[live]).toBeGreaterThan(vyBefore);
  });

  it('is deterministic: the same effect seed gives the same positions; a different one does not', () => {
    const a = createParticlePool();
    const b = createParticlePool();
    const c = createParticlePool();
    const ra = createRng(fxSeedFor(9));
    const rb = createRng(fxSeedFor(9));
    const rc = createRng(fxSeedFor(10));
    startFx(a, 'fireworks', ra);
    startFx(b, 'fireworks', rb);
    startFx(c, 'fireworks', rc);
    for (let step = 0; step < 300; step++) {
      stepFx(a, 'fireworks', ra);
      stepFx(b, 'fireworks', rb);
      stepFx(c, 'fireworks', rc);
    }
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
    expect(Array.from(a.life)).toEqual(Array.from(b.life));
    expect(Array.from(a.x)).not.toEqual(Array.from(c.x));
  });

  it('stepFx never replaces the pool arrays (the zero-allocation contract, as far as a test can see it)', () => {
    const pool = createParticlePool();
    const rng = createRng(1);
    const { x, y, vx, vy, life, color, size } = pool;
    startFx(pool, 'fireworks', rng);
    for (let i = 0; i < 200; i++) stepFx(pool, 'fireworks', rng);
    startFx(pool, 'confetti', rng);
    for (let i = 0; i < 200; i++) stepFx(pool, 'confetti', rng);
    expect(pool.x).toBe(x);
    expect(pool.y).toBe(y);
    expect(pool.vx).toBe(vx);
    expect(pool.vy).toBe(vy);
    expect(pool.life).toBe(life);
    expect(pool.color).toBe(color);
    expect(pool.size).toBe(size);
  });
});
```

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run components/games/football-screen/particles.test.ts`
Expected: FAIL — `Failed to resolve import "./particles"`.

- [ ] **Step 3: Escribir `particles.ts`**

Crear `components/games/football-screen/particles.ts`:

```ts
import type { FxKind } from '../football-logic/mode';
import type { Rng } from '../football-logic/rng';
import { VIEW_H, VIEW_W } from './camera';

// The two victory effects of the spec (confetti for a friendly, fireworks for the
// World Cup) on ONE pool of particles created once (criterion 20: "depósito de
// partículas creado una vez"), the pattern of KongGame's barrel pool. Typed arrays,
// written in place; nothing here allocates after createParticlePool.
//
// The fourth stream of the game (Global Constraints): the effects draw from
// createRng(fxSeedFor(runSeed)) -- never from the match rng (that would change the
// simulation, criterion 1), never from the CPU's, never from the ambience's.
export const PARTICLE_COUNT = 240;
export const FX_SEED_SALT = 0x7f4a7c15;

export function fxSeedFor(seed: number): number {
  return (seed ^ FX_SEED_SALT) >>> 0;
}

// The burst directions, precomputed ONCE at module load: the only Math.cos / Math.sin
// of the screen layer, and they never run per frame. (The engine bans trigonometry in
// its physics for determinism -- risk 3; these are constants, identical on every JS
// engine for the same index, and the physics never see them.)
export const FX_DIR_COUNT = 32;

function buildDirs(fn: (angle: number) => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < FX_DIR_COUNT; i++) out.push(fn((i / FX_DIR_COUNT) * Math.PI * 2));
  return out;
}

export const FX_DIR_X: readonly number[] = buildDirs(Math.cos);
export const FX_DIR_Y: readonly number[] = buildDirs(Math.sin);

export const FX_COLORS: readonly string[] = ['#ffcf3a', '#ff4d6d', '#6fe3ff', '#7cff6f', '#ffffff', '#ff9f1c'];

// Confetti: everything falls, sways a little, wraps at the bottom. Pixels per step.
export const CONFETTI_FALL_MIN = 1.2;
export const CONFETTI_FALL_MAX = 2.6;
export const CONFETTI_SWAY = 0.6;
const CONFETTI_RESPAWN_Y = -4;

// Fireworks: a burst of FIREWORK_BURST_SIZE every FIREWORK_BURST_STEPS from a random
// point in the upper two thirds; each spark flies out on one of the 32 directions,
// falls under gravity and dies after 40-70 steps.
export const FIREWORK_BURST_STEPS = 45;
export const FIREWORK_BURST_SIZE = 40;
export const FIREWORK_SPEED_MIN = 2;
export const FIREWORK_SPEED_MAX = 5;
export const FIREWORK_GRAVITY = 0.06;
export const FIREWORK_LIFE_MIN = 40;
export const FIREWORK_LIFE_MAX = 70;
// Confetti particles never die on their own: a life this long outlasts any screen.
const CONFETTI_LIFE = 30_000;

export type ParticlePool = {
  count: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  life: Int16Array;     // steps left; 0 = inactive
  color: Uint8Array;    // index into FX_COLORS
  size: Uint8Array;     // side of the square, in px
  burstIn: number;      // fireworks: steps until the next burst
};

export function createParticlePool(count = PARTICLE_COUNT): ParticlePool {
  return {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    vx: new Float32Array(count),
    vy: new Float32Array(count),
    life: new Int16Array(count),
    color: new Uint8Array(count),
    size: new Uint8Array(count),
    burstIn: 0,
  };
}

export function activeCount(pool: ParticlePool): number {
  let n = 0;
  for (let i = 0; i < pool.count; i++) if (pool.life[i] > 0) n++;
  return n;
}

// Called once when the victory screen opens.
export function startFx(pool: ParticlePool, kind: FxKind, rng: Rng): void {
  if (kind === 'confetti') {
    for (let i = 0; i < pool.count; i++) {
      pool.x[i] = rng() * VIEW_W;
      pool.y[i] = rng() * VIEW_H;
      pool.vx[i] = (rng() - 0.5) * 2 * CONFETTI_SWAY;
      pool.vy[i] = CONFETTI_FALL_MIN + rng() * (CONFETTI_FALL_MAX - CONFETTI_FALL_MIN);
      pool.life[i] = CONFETTI_LIFE;
      pool.color[i] = Math.floor(rng() * FX_COLORS.length);
      pool.size[i] = 2 + Math.floor(rng() * 3);
    }
    pool.burstIn = 0;
    return;
  }
  for (let i = 0; i < pool.count; i++) pool.life[i] = 0;
  pool.burstIn = 1;
}

function burst(pool: ParticlePool, rng: Rng): void {
  const cx = VIEW_W * 0.15 + rng() * VIEW_W * 0.7;
  const cy = VIEW_H * 0.15 + rng() * VIEW_H * 0.5;
  const color = Math.floor(rng() * FX_COLORS.length);
  let spawned = 0;
  for (let i = 0; i < pool.count && spawned < FIREWORK_BURST_SIZE; i++) {
    if (pool.life[i] > 0) continue;
    const dir = Math.floor(rng() * FX_DIR_COUNT);
    const speed = FIREWORK_SPEED_MIN + rng() * (FIREWORK_SPEED_MAX - FIREWORK_SPEED_MIN);
    pool.x[i] = cx;
    pool.y[i] = cy;
    pool.vx[i] = FX_DIR_X[dir] * speed;
    pool.vy[i] = FX_DIR_Y[dir] * speed;
    pool.life[i] = FIREWORK_LIFE_MIN + Math.floor(rng() * (FIREWORK_LIFE_MAX - FIREWORK_LIFE_MIN));
    pool.color[i] = color;
    pool.size[i] = 2 + Math.floor(rng() * 2);
    spawned++;
  }
}

// One fixed step of the effect. Writes in place; the confetti's rng draws only on a
// wrap, the fireworks' only on a burst.
export function stepFx(pool: ParticlePool, kind: FxKind, rng: Rng): void {
  if (kind === 'confetti') {
    for (let i = 0; i < pool.count; i++) {
      pool.x[i] += pool.vx[i];
      pool.y[i] += pool.vy[i];
      if (pool.y[i] > VIEW_H) {
        pool.y[i] = CONFETTI_RESPAWN_Y;
        pool.x[i] = rng() * VIEW_W;
      }
      if (pool.x[i] < 0) pool.x[i] += VIEW_W;
      else if (pool.x[i] > VIEW_W) pool.x[i] -= VIEW_W;
    }
    return;
  }
  pool.burstIn--;
  if (pool.burstIn <= 0) {
    pool.burstIn = FIREWORK_BURST_STEPS;
    burst(pool, rng);
  }
  for (let i = 0; i < pool.count; i++) {
    if (pool.life[i] === 0) continue;
    pool.vy[i] += FIREWORK_GRAVITY;
    pool.x[i] += pool.vx[i];
    pool.y[i] += pool.vy[i];
    pool.life[i]--;
  }
}
```

- [ ] **Step 4: Verde de `particles.ts`**

Run: `npx vitest run components/games/football-screen/particles.test.ts`
Expected: PASS, **8 tests**.

- [ ] **Step 5: Escribir los tests que fallan de los cánticos**

En `lib/sfx-vault-world-cup.test.ts`, edición mecánica de `ALL` (líneas 10-14) añadiendo el nombre nuevo:

```ts
const ALL: VaultWorldCupSfx[] = [
  'whistle_start', 'whistle_end', 'whistle_foul',
  'goal_net', 'goal_shout', 'goal_crowd',
  'kick', 'crowd', 'chants_victory',
];
```

Y al final del fichero:

```ts
// ── Task 9-6: the victory chants (spec audio table, row chants-victory) ──────────
describe('the victory chants', () => {
  it('name the real file, at a volume in (0, 1]', () => {
    expect(SFX_FILES.chants_victory).toBe('/vault-futbol-chants-victory.mp3');
    expect(PUBLIC_FILES.has('vault-futbol-chants-victory.mp3')).toBe(true);
    expect(SFX_VOLUME.chants_victory).toBeGreaterThan(0);
    expect(SFX_VOLUME.chants_victory).toBeLessThanOrEqual(1);
  });

  it('play with a gain and stop are safe no-ops before init, after init without Audio, and after dispose', () => {
    const sfx = new VaultWorldCupSFX();
    expect(() => {
      sfx.play('chants_victory', 0.4);
      sfx.stop('chants_victory');
      sfx.init();
      sfx.play('chants_victory', 1);
      sfx.stop('chants_victory');
      sfx.stop('kick');
      sfx.dispose();
      sfx.play('chants_victory', 0.4);
      sfx.stop('chants_victory');
    }).not.toThrow();
  });
});
```

En `components/games/football-screen/sfx-map.test.ts`, al final (import: añadir `CHANTS_LOW_GAIN, victoryChantGain` al import de `./sfx-map`):

```ts
// ── Task 9-6: spec audio table -- chants at full volume with the fireworks, low with the confetti ──
describe('victoryChantGain', () => {
  it('is 1 for the fireworks and CHANTS_LOW_GAIN, strictly between 0 and 1, for the confetti', () => {
    expect(victoryChantGain('fireworks')).toBe(1);
    expect(victoryChantGain('confetti')).toBe(CHANTS_LOW_GAIN);
    expect(CHANTS_LOW_GAIN).toBeGreaterThan(0);
    expect(CHANTS_LOW_GAIN).toBeLessThan(1);
  });
});
```

Run: `npx vitest run lib/sfx-vault-world-cup.test.ts components/games/football-screen/sfx-map.test.ts`
Expected: FAIL — `'chants_victory'` no es un `VaultWorldCupSfx`; `victoryChantGain` no exportado.

- [ ] **Step 6: Escribir los cánticos**

`lib/sfx-vault-world-cup.ts`:

(a) El tipo (líneas 16-24) y el comentario de cabecera: quitar la viñeta «the victory chants … step 9's victory screens» del comentario (líneas 11) y añadir el nombre:

```ts
export type VaultWorldCupSfx =
  | 'whistle_start'
  | 'whistle_end'
  | 'whistle_foul'
  | 'goal_net'
  | 'goal_shout'
  | 'goal_crowd'
  | 'kick'
  | 'crowd'
  | 'chants_victory';
```

(b) `RAW_FILES` (línea 37) y `SFX_VOLUME` (línea 58): una entrada más en cada tabla:

```ts
  crowd: '/vault-futbol-crowd-ambience.mp3',
  chants_victory: '/vault-futbol-chants-victory.mp3',
```

```ts
  crowd: 0.3,
  // The chants play under the victory screen for 20-30 s: below the whistles, above
  // the crowd bed. The confetti halves this again through play()'s gain (sfx-map.ts).
  chants_victory: 0.6,
```

(c) La clase (líneas 61-109): el clon vivo guardado por nombre, `gain` en `play`, `stop`, y `dispose` cortando lo vivo:

```ts
export class VaultWorldCupSFX {
  private sources: Partial<Record<VaultWorldCupSfx, HTMLAudioElement>> = {};
  // The last clone started per name. Step 8 threw the clone away (a whistle is over
  // before anyone could want it stopped); the chants are not -- CONTINUAR must cut
  // them (Task 9-6), so the clone is kept. One per name: two chants never overlap.
  private live: Partial<Record<VaultWorldCupSfx, HTMLAudioElement>> = {};
  private ready = false;
  private muted = false;

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

  // A clone per shot, the repo's own pattern. `gain` multiplies the table volume
  // (spec: the chants "a volumen bajo" under the confetti); the product is clamped so
  // a bad gain can never throw on the volume setter.
  play(name: VaultWorldCupSfx, gain = 1): void {
    if (!this.ready || this.muted) return;
    const source = this.sources[name];
    if (source === undefined) return;
    const shot = source.cloneNode(true) as HTMLAudioElement;
    const volume = SFX_VOLUME[name] * gain;
    shot.volume = volume < 0 ? 0 : volume > 1 ? 1 : volume;
    this.live[name] = shot;
    void shot.play().catch(() => undefined);
  }

  // Cuts the last clone of `name`. Safe on a name that never played.
  stop(name: VaultWorldCupSfx): void {
    const el = this.live[name];
    if (el === undefined) return;
    el.pause();
    el.currentTime = 0;
    this.live[name] = undefined;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  dispose(): void {
    for (const key of Object.keys(this.live) as VaultWorldCupSfx[]) this.stop(key);
    for (const key of Object.keys(this.sources) as VaultWorldCupSfx[]) {
      const el = this.sources[key];
      if (el === undefined) continue;
      el.pause();
      el.src = '';
    }
    this.sources = {};
    this.live = {};
    this.ready = false;
  }
}
```

`components/games/football-screen/sfx-map.ts`, al final (import: `import type { FxKind } from '../football-logic/mode';`):

```ts
// Spec audio table, row chants-victory: full volume with the fireworks (CAMPEONES DEL
// MUNDO), "a volumen bajo" with the confetti (GANADOR). The component hands this to
// sfxVaultWorldCup.play('chants_victory', gain).
export const CHANTS_LOW_GAIN = 0.4;

export function victoryChantGain(kind: FxKind): number {
  return kind === 'fireworks' ? 1 : CHANTS_LOW_GAIN;
}
```

- [ ] **Step 7: Verde y suite completa**

Run: `npx vitest run lib/sfx-vault-world-cup.test.ts components/games/football-screen/ && npx vitest run && npx tsc --noEmit`
Expected: `sfx-vault-world-cup` 8 (6 + 2); `sfx-map` +1; `particles` 8; **la suite pasa de 1145 a 1156 tests en 68 ficheros**; `tsc` sin salida.

- [ ] **Step 8: Motor intacto y azar**

Run: `git diff --stat 0e553af -- components/games/football-logic/ && grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/ lib/sfx-vault-world-cup.ts`
Expected: el diff solo lista `match.ts` y `match.test.ts`; grep vacío. (`Math.cos`/`Math.sin` aparecen UNA vez en `particles.ts`, en carga de módulo: comprobar con `grep -n "Math\.\(cos\|sin\)" components/games/football-screen/particles.ts` que solo están en `buildDirs`.)

- [ ] **Step 9: Ledger y proponer commit**

Ledger: `Task 9-6: DONE (1156/1156 en 68 ficheros; particles 8, sfx +2, sfx-map +1; cuarto stream de azar fxSeedFor).`

No ejecutar. Mensaje propuesto:

`feat(world-cup): confetti and fireworks on a fixed particle pool, and the victory chants with gain and stop`

**QA de Paco para esta tarea:** ninguno todavía (los efectos se ven en la 9-7).

---

## Task 9-7: `VaultWorldCupGame.tsx` — el flujo entero en el mismo canvas, y la play-page provisional para los cuatro modos

**Files:**
- Modify: `components/games/football-screen/captions.ts` (dos resets nuevos, append) + `captions.test.ts` (un test)
- Modify: `components/games/VaultWorldCupGame.tsx` — **reescritura de zonas**: imports 1-42, props 44-57, constantes 59-70 y 135-147, el cuerpo del `useEffect` 205-968 (estado 209-259, `runStep` 291-387, `update` 401-414, `drawPlayer` 496-595 solo las líneas 574 y 598, `drawHud` 695-793, `draw` 832-844, teclado 869-911, guard 920-950). Lo que no se nombra (paleta, `drawPitch`, `drawBall`, `drawSetPiece`, `drawMinimap`, `drawCaption`, `drawBlocked`, `loop`, `isTypingTarget`, JSX) **no cambia**.
- Modify: `app/games/vault-world-cup/play/page.tsx` entero.

**Interfaces:**
- Consumes: todo lo producido por 9-1..9-6 (ver «Contrato entre tareas»), más `TEAMS`, `FORMATIONS`, `teamById`, `TeamDef`, `Strategy` (`teams.ts`), `abandon`, `isOpenPlay`, `winnerOf`, `NORMAL_RULES`, `MatchRules` (`match.ts`), `createRng`, `Rng`, `matchSeedFor`, `currentDifficulty`, `roundLabel`, `pairCount`, `pairHomeId`, `pairAwayId`, `humanPairIndex`, `isStillIn` (`world-cup.ts`), y los módulos de pantalla del paso 8 tal cual.
- Produces:

```ts
interface VaultWorldCupGameProps {
  paused: boolean;
  muted?: boolean;
  seed?: number;                                  // fija la semilla del run (QA / replay); por defecto Date.now() UNA vez por run
  onScoreChange?: (home: number, away: number) => void;
  onClockChange?: (label: string) => void;
  onStatusChange?: (label: string) => void;       // 'SELECTOR', 'AMISTOSO', 'CUARTOS DE FINAL', 'VICTORIA'…
  onGameOver?: (score: number) => void;           // SOLO el Mundial (criterio 19): ELIMINADO con los puntos hasta ahí (G9-8)
  onVictory?: (score: number) => void;            // SOLO el Mundial: CAMPEONES DEL MUNDO
}
export default React.memo(VaultWorldCupGame);
// captions.ts
export function resetCaptionState(cs: CaptionState): void;
export function resetMatchWatch(w: MatchWatch): void;
```

`onMatchEnd` **desaparece**: su único consumidor era el rótulo «Estado» de la página provisional, que ahora se alimenta de `onStatusChange` + `onGameOver`/`onVictory`. `homeTeamId`/`awayTeamId`/`homeFormation`/`awayFormation`/`homeStrategy`/`difficulty` **desaparecen**: el selector las sustituye (recomendación §8.6) y G9-6 fija la dificultad.

**Decisiones fijadas aquí (S-FL5, S-FL6):**
- **S-FL5 · Un cruce de la CPU visto (spectate) al que el guard de viewport interrumpe NO se abandona: se termina headless y se registra** (`finishMatchRun` + `flowRecordCpuResult` + `flowSkipSpectate`). No hay nada humano que perder y `winnerOf === -1` haría inválido el cuadro. G9-8 se aplica **solo al partido del humano**. Y tras el guard **sí hay vuelta atrás** (Minor 5): al agrandar la ventana, `blocked` se levanta si el flujo está en una pantalla de menú (el partido abandonado no se reanuda nunca).
- **S-FL6 · En el partido, la R del entrenamiento la maneja el componente** (`flowExitMatch`), y la R de la página (reinicio por remonte) sigue existiendo solo tras `onGameOver`/`onVictory` del Mundial. En el resto de modos R no hace nada durante el partido.

- [ ] **Step 1: Dos resets en `captions.ts`, con test**

Añadir a `components/games/football-screen/captions.test.ts`, dentro de `describe('the caption queue')`:

```ts
  it('resetCaptionState and resetMatchWatch bring both back to the freshly created state, in place', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'goal');
    pushCaption(cs, 'full-time');
    const queue = cs.queue;
    resetCaptionState(cs);
    expect(cs.kind).toBe('none');
    expect(cs.stepsLeft).toBe(0);
    expect(cs.queueLen).toBe(0);
    expect(cs.queue).toBe(queue);
    const w = createMatchWatch();
    const m = newMatch();
    m.score[0] = 2;
    updateWatch(m, w);
    resetMatchWatch(w);
    expect(w).toEqual(createMatchWatch());
  });
```

(añadir `resetCaptionState, resetMatchWatch` al import de `./captions`). Implementación, al final de `captions.ts`:

```ts
// Task 9-7: a new match on the same screen (no remount) reuses the queue and the watch.
export function resetCaptionState(cs: CaptionState): void {
  cs.kind = 'none';
  cs.stepsLeft = 0;
  cs.queueLen = 0;
}

export function resetMatchWatch(w: MatchWatch): void {
  w.started = false;
  w.phase = 'kickoff';
  w.half = 1;
  w.score0 = 0;
  w.score1 = 0;
  w.taken0 = 0;
  w.taken1 = 0;
  w.scored0 = 0;
  w.scored1 = 0;
  w.call = 'none';
}
```

Run: `npx vitest run components/games/football-screen/captions.test.ts` → PASS, **28 tests**.

- [ ] **Step 2: Imports, props y constantes del componente**

Sustituir las líneas 1-70 de `components/games/VaultWorldCupGame.tsx` por:

```tsx
'use client';

import React, { useEffect, useRef } from 'react';

import { stepsFor } from './football-logic/clock';
import { NORMAL_RULES, abandon, isOpenPlay, type MatchRules } from './football-logic/match';
import {
  modeAwayId, modeBracket, modeDifficulty, modeFxKind, modeHomeId, modeHumanSide, modeMatchLabel, modeMatchSeed, modeRules,
  modeScore, modeScores, modeStatus, modeVictoryScreen, modeVictoryTeamId, modeVictoryTitle, createFriendlyMode, sideIsHuman,
  type FxKind, type GameMode, type HumanSide,
} from './football-logic/mode';
import { PITCH } from './football-logic/pitch';
import { PLAYER_RADIUS, isPlayerDown, isSprinting, type PlayerState } from './football-logic/players';
import { createRng, type Rng } from './football-logic/rng';
import { SHOOTOUT_RESOLVE_STEPS } from './football-logic/set-pieces';
import { FORMATIONS, TEAMS, teamById, type Strategy, type TeamDef } from './football-logic/teams';
import {
  currentDifficulty, humanPairIndex, isStillIn, matchSeedFor, pairAwayId, pairCount, pairHomeId, roundLabel,
} from './football-logic/world-cup';

import {
  CAMERA_LAG, VIEW_H, VIEW_W, cameraTargetX, cameraTargetY, centreCamera, createCamera,
  followCamera, isOnScreen, toScreenX, toScreenY, type Camera,
} from './football-screen/camera';
import {
  CAPTION_TEXT, collectCaptions, createCaptionState, createMatchWatch, resetCaptionState, resetMatchWatch, stepCaption,
  updateWatch, type ShowingCaption,
} from './football-screen/captions';
import {
  MODE_BLURBS, MODE_LIST, MODE_NAMES, createFlowState, flowAfterModeBuilt, flowBuildMode, flowCaptionsDrained,
  flowConfirmBracket, flowConfirmDraw, flowConfirmMode, flowConfirmTeam, flowContinue, flowCpuPair, flowExitMatch,
  flowHumanCount, flowMatchOver, flowMoveBracketChoice, flowMoveMode, flowMoveTeam, flowPickingHuman, flowRecordCpuResult,
  flowSetFormation, flowSkipSpectate, flowSpectateOver,
} from './football-screen/flow';
import {
  BRACKET_ELIMINATED_Y, BRACKET_HINT_Y, BRACKET_PROMPT_Y, BRACKET_ROW_H, DRAW_ROW_H, FORMATION_ROW_Y, MODE_CARD_H,
  MODE_CARD_W, SELECT_HINT_Y, TEAM_CARD_H, TEAM_CARD_W, VICTORY_FIGURE_Y, VICTORY_HINT_Y, VICTORY_TEAM_Y, VICTORY_TITLE_Y,
  bracketRowY, drawColX, drawRowY, modeCardY, teamCardX, teamCardY,
} from './football-screen/flow-layout';
import {
  SHOT_CHARGE_SEGMENTS, buttonsIdle, chargeSegments, clockText, countdownSeconds, cursorPlayerId,
  halfLabel, keeperHoldsBall, shootoutRoundLabel, smallNumber, sprintBarFraction,
} from './football-screen/hud';
import {
  SOLO, TWO_PLAYER_P1, TWO_PLAYER_P2, TWO_PLAYER_TABLES, createPadState, padAdvance, padBlur, padChoice, padClear,
  padDown, padKeyFor, padToTeamInput, padUp, type KeyTable, type PadState,
} from './football-screen/keyboard';
import { SPECTATE_SPEED, createStepBudget } from './football-screen/loop';
import { createFramePlan, planFrame, planHalfAmbience } from './football-screen/match-loop';
import { createMatchRun, finishMatchRun, stepMatchRun, type MatchRun } from './football-screen/match-run';
import {
  MINIMAP_H, MINIMAP_PAD, MINIMAP_W, createMinimapRect, minimapViewRect, minimapX, minimapY,
} from './football-screen/minimap';
import { FX_COLORS, createParticlePool, fxSeedFor, startFx, stepFx } from './football-screen/particles';
import {
  ambienceDue, captionSfxOnEdge, createAmbienceMarks, goalCrowdDue, goalNetDue, halfEndWhistleDue,
  shotFiredThisStep, victoryChantGain,
} from './football-screen/sfx-map';
import { MIN_VIEWPORT_H, MIN_VIEWPORT_W, viewportAllowed } from './football-screen/viewport-guard';
import { sfxVaultWorldCup } from '@/lib/sfx-vault-world-cup';

interface VaultWorldCupGameProps {
  paused: boolean;
  muted?: boolean;
  seed?: number;
  onScoreChange?: (home: number, away: number) => void;
  onClockChange?: (label: string) => void;
  onStatusChange?: (label: string) => void;
  onGameOver?: (score: number) => void;
  onVictory?: (score: number) => void;
}

// ── The two display slots of the scoreboard. NOT "human" and "CPU" any more: who is
// human is modeHumanSide(mode), read per match (step 9). Home is drawn on the left.
const HOME = 0 as const;
const AWAY = 1 as const;
// Stage C assumption S-SC3 (confirmed by owner 2026-09-07): the screen's own fixed
// keeper-hold countdown, see the step-8 comment on drawHud.
const KEEPER_HOLD_STEPS = stepsFor(2);
// The bank, as ids, once: the selector and the draw read it by index.
const BANK_IDS: readonly string[] = TEAMS.map((t) => t.id);
const SOLO_TABLES: readonly [KeyTable, KeyTable] = [SOLO, SOLO];
const ZERO_FORMATIONS: readonly [number, number] = [0, 0];
```

Y sustituir el bloque de copy fijo (líneas 135-147, desde `const HINT_AIM` hasta `STRATEGY_LABEL`) por:

```tsx
// Fixed UI copy, module constants so draw() never builds a string.
const HINT_AIM = 'CRUCETA: APUNTAR · SALE SOLO';
const BLOCKED_TITLE = 'AGRANDA LA VENTANA';
const BLOCKED_HINT = `MÍNIMO ${MIN_VIEWPORT_W} × ${MIN_VIEWPORT_H}`;
const KEEPER_HINT = 'SAQUE: K CORTO · J LARGO · ';
const KEEPER_HINT_P1 = 'SAQUE: V CORTO · C LARGO · ';
const STRATEGY_LABEL: Readonly<Record<Strategy, string>> = { attack: 'ATAQUE', neutral: 'NEUTRAL', defend: 'DEFENSA' };
// One hint per key table (G9-2), chosen by table identity in draw(): no string is built.
const FORMATION_HINT_SOLO = '1/2/3 ALINEACIÓN · 4/5/6 ESTRATEGIA';
const FORMATION_HINT_P1 = '1/2/3 ALINEACIÓN · 4/5/6 ESTRATEGIA';
const FORMATION_HINT_P2 = "7/8/9 ALINEACIÓN · 0 ' ¡ ESTRATEGIA";
// Flow screens.
const MENU_BG = '#05050a';
const CARD_BG = 'rgba(20,20,30,0.85)';
const CARD_BORDER = '#444455';
const DIM_TEXT = 'rgba(232,244,255,0.4)';
const MODE_TITLE = 'ELIGE MODO';
const MODE_HINT = 'ARRIBA / ABAJO · A (J) PARA CONFIRMAR';
const TEAM_TITLE_SOLO = 'ELIGE TU SELECCIÓN';
const TEAM_TITLES_TWO: readonly [string, string] = ['JUGADOR 1 (WASD): ELIGE TU SELECCIÓN', 'JUGADOR 2 (FLECHAS): ELIGE TU SELECCIÓN'];
const TEAM_HINT_SOLO = 'CRUCETA · A (J) CONFIRMA · 1/2/3 ALINEACIÓN';
const TEAM_HINTS_TWO: readonly [string, string] = ['WASD · C CONFIRMA · 1/2/3 ALINEACIÓN', 'FLECHAS · J CONFIRMA · 7/8/9 ALINEACIÓN'];
const TAKEN_TAG = 'J1';
const FORMATION_ROW_LABEL = 'ALINEACIÓN:';
// '1 NORMAL', '2 OFENSIVA', '3 DEFENSIVA' for the solo/J1 keys and '7 …' for J2's, built once.
function buildFormationLabels(keys: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < FORMATIONS.length; i++) out.push(`${keys[i]} ${FORMATIONS[i].name}`);
  return out;
}
const FORMATION_LABELS_SOLO: readonly string[] = buildFormationLabels(SOLO.formation);
const FORMATION_LABELS_P2: readonly string[] = buildFormationLabels(TWO_PLAYER_P2.formation);
const DRAW_TITLE = 'SORTEO DEL MUNDIAL';
const DRAW_HINT = 'A (J) PARA CONTINUAR';
const YOU_TAG = 'TÚ';
const BRACKET_TITLE_PREFIX = 'CUADRO · ';
const BRACKET_VS = ' VS ';
const BRACKET_SCORE_SEP = ' - ';
const BRACKET_NEXT_PREFIX = 'PRÓXIMO: ';
const BRACKET_YOURS_PREFIX = 'TU PARTIDO: ';
const BRACKET_ELIMINATED_PREFIX = 'ELIMINADOS: ';
const BRACKET_LIST_SEP = ' · ';
const BRACKET_VER = 'VER';
const BRACKET_SALTAR = 'SALTAR';
const BRACKET_CHOICE_HINT = 'IZQ / DER · A (J) CONFIRMA';
const BRACKET_PLAY_HINT = 'A (J) PARA JUGAR';
const SPECTATE_BANNER = 'PARTIDO DE LA CPU · X4 · A (J) SALTA AL RESULTADO';
const TRAINING_HINT = 'R PARA SALIR';
const VICTORY_HINT = 'A (J) · CONTINUAR';
const STATUS_SELECTOR = 'SELECTOR';
const STATUS_VICTORY = 'VICTORIA';
const CUP_COLOR = '#ffcf3a';
const SKIN_COLOR = '#f1c27d';
const FONT_MENU_TITLE = 'bold 26px monospace';
const FONT_MENU_ITEM = 'bold 22px monospace';
const FONT_MENU_BLURB = 'bold 11px monospace';
const FONT_VICTORY_TITLE = 'bold 44px monospace';
const FONT_VICTORY_TEAM = 'bold 30px monospace';
```

(La constante `FORMATION_HINT` del paso 8 se elimina; `CPU_SEED_SALT` también, vive en `match-run.ts`.)

- [ ] **Step 3: Las props y el estado del run**

Sustituir la cabecera de la función (líneas 167-203) y el arranque del efecto (205-259) por:

```tsx
function VaultWorldCupGame({
  paused,
  muted = false,
  seed,
  onScoreChange,
  onClockChange,
  onStatusChange,
  onGameOver,
  onVictory,
}: VaultWorldCupGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const mutedRef = useRef(muted);
  const onScoreChangeRef = useRef(onScoreChange);
  const onClockChangeRef = useRef(onClockChange);
  const onStatusChangeRef = useRef(onStatusChange);
  const onGameOverRef = useRef(onGameOver);
  const onVictoryRef = useRef(onVictory);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    mutedRef.current = muted;
    sfxVaultWorldCup.setMuted(muted);
  }, [muted]);

  // The loop never reads props: the callbacks go through refs so a page that
  // re-creates them does not restart the run.
  useEffect(() => {
    onScoreChangeRef.current = onScoreChange;
    onClockChangeRef.current = onClockChange;
    onStatusChangeRef.current = onStatusChange;
    onGameOverRef.current = onGameOver;
    onVictoryRef.current = onVictory;
  }, [onScoreChange, onClockChange, onStatusChange, onGameOver, onVictory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d')!;

    // ── Everything below is created ONCE and mutated in place (criterion 20) ──
    // G9-7: ONE seed per run, read when the mode is built (confirmTeam) -- the only
    // wall-clock read of the whole game. The `seed` prop pins it for QA and replays.
    const fixedSeed = seed;
    let runSeed = 0;
    const flow = createFlowState();
    // Placeholders so nothing below is nullable: replaced by flowBuildMode / startMatch
    // the first time the player confirms. Neither is ever stepped or drawn as such.
    let mode: GameMode = createFriendlyMode('friendly-cpu', TEAMS[0].id, TEAMS[1].id);
    let run: MatchRun = createMatchRun(TEAMS[0], TEAMS[1], 0, 5, [true, false], NORMAL_RULES, ZERO_FORMATIONS);
    let humanSide: HumanSide = 0;
    let victoryScreen = false;
    let speed = 1;
    let spectatePair = -1;
    let matchSeed = 0;

    // Two pads, one per TEAM (not per player): pads[t] drives team t when it is human.
    // The tables say which keys each pad listens to (G9-2).
    const pads: [PadState, PadState] = [createPadState('neutral', 0), createPadState('neutral', 0)];
    let tables: readonly [KeyTable, KeyTable] = SOLO_TABLES;
    const runFormations: [number, number] = [0, 0];
    const cursorIds: [number, number] = [-1, -1];

    const cam: Camera = createCamera();
    const budget = createStepBudget();
    const plan = createFramePlan();
    const captions = createCaptionState();
    const watch = createMatchWatch();
    const viewRect = createMinimapRect();

    const ambienceMarks = createAmbienceMarks();
    let ambienceCount = 0;
    let ambienceIndex = 0;
    let ambienceHalf: 1 | 2 | 3 = 1;

    // The fourth stream and the pool (criterion 20: created once).
    const fxPool = createParticlePool();
    let fxRng: Rng = createRng(0);
    let fxKind: FxKind = 'confetti';
    let victoryTitle = '';
    let victoryTeam: TeamDef = TEAMS[0];

    // The bracket and draw views, resolved ONCE per screen entry (Vault Fighter's
    // refreshBracketView), never per frame. Strings are built here, on the event.
    let bracketTitle = '';
    const bracketRowText: string[] = ['', '', '', ''];
    const bracketRowIsHuman: boolean[] = [false, false, false, false];
    let bracketRows = 0;
    let bracketPrompt = '';
    let bracketEliminated = '';
    let bracketHasChoice = false;
    const drawNames: string[] = ['', '', '', '', '', '', '', ''];
    let drawHumanIndex = -1;

    let accumulatorMs = 0;
    let lastTs = 0;
    let started = false;
    let sfxReady = false;
    let endFired = false;
    let blocked = false;
    let shootoutTaken = -1;
    let shootoutSudden = false;
    let cachedShootoutLabel = '';
    let reportedHome = -1;
    let reportedAway = -1;
    let reportedClock = '';
    let keeperHoldSteps = 0;
    let keeperHoldTeam: 0 | 1 | -1 = -1;

    function teamOf(id: string): TeamDef {
      const def = teamById(TEAMS, id);
      if (def === undefined) throw new Error(`team not in bank: ${id}`);
      return def;
    }

    function reportStatus(label: string): void {
      const cb = onStatusChangeRef.current;
      if (cb !== undefined) cb(label);
    }
```

- [ ] **Step 4: Arrancar, saltar y terminar partidos (sin remonte)**

Añadir a continuación, ANTES de `reportHud` (que no cambia):

```tsx
    // ── Starting a match. Reusable for every friendly, every World Cup match and every
    // spectated pair: nothing here remounts (G9-9). Allocates (createMatchRun) on an
    // event, never in a frame.
    function startMatch(
      home: TeamDef, away: TeamDef, seedForMatch: number, difficulty: number, rules: Readonly<MatchRules>,
      side: HumanSide, formations: readonly [number, number], screen: boolean,
    ): void {
      run = createMatchRun(home, away, seedForMatch, difficulty, [sideIsHuman(side, 0), sideIsHuman(side, 1)], rules, formations);
      humanSide = side;
      victoryScreen = screen;
      matchSeed = seedForMatch;
      tables = side === 'both' ? TWO_PLAYER_TABLES : SOLO_TABLES;
      speed = side === 'none' ? SPECTATE_SPEED : 1;
      for (let t = 0; t < 2; t++) {
        padBlur(pads[t]);
        pads[t].formation = formations[t];
        pads[t].strategy = 'neutral';
      }
      centreCamera(cam, run.match.ball.x, run.match.ball.y, PITCH);
      resetCaptionState(captions);
      resetMatchWatch(watch);
      ambienceCount = planHalfAmbience(seedForMatch, 1, ambienceMarks);
      ambienceIndex = 0;
      ambienceHalf = 1;
      accumulatorMs = 0;
      endFired = false;
      shootoutTaken = -1;
      shootoutSudden = false;
      cachedShootoutLabel = '';
      reportedHome = -1;
      reportedAway = -1;
      reportedClock = '';
      keeperHoldSteps = 0;
      keeperHoldTeam = -1;
    }

    // The formation each TEAM starts with: the human's pick for a human team (J1's for
    // the first human, J2's for the second), 3-3-2 for a CPU team (S18: the CPU keeps
    // whatever it is given).
    // Two explicit lines, not a `for (let t …)`: sideIsHuman takes a `0 | 1`, and the
    // counter of a for loop is a `number` (tsc rejects it; no `as` to paper over it).
    function fillRunFormations(side: HumanSide): void {
      runFormations[0] = sideIsHuman(side, 0) ? flow.formation[0] : 0;
      runFormations[1] = sideIsHuman(side, 1) ? flow.formation[side === 'both' ? 1 : 0] : 0;
    }

    function startHumanMatch(): void {
      const side = modeHumanSide(mode);
      fillRunFormations(side);
      startMatch(
        teamOf(modeHomeId(mode)), teamOf(modeAwayId(mode)), modeMatchSeed(mode, runSeed), modeDifficulty(mode),
        modeRules(mode), side, runFormations, modeVictoryScreen(mode),
      );
      reportStatus(modeMatchLabel(mode));
    }

    // G9-3: the CPU pair the bracket points at, either on screen (VER) or headless
    // (SALTAR). SAME startMatch, SAME seed: the result cannot depend on the choice.
    function startCpuPair(): boolean {
      const wc = modeBracket(mode);
      const pair = flowCpuPair(mode);
      if (wc === null || pair === -1) return false;
      spectatePair = pair;
      startMatch(
        teamOf(pairHomeId(wc, pair)), teamOf(pairAwayId(wc, pair)), matchSeedFor(wc.seed, wc.round, pair),
        currentDifficulty(wc), NORMAL_RULES, 'none', ZERO_FORMATIONS, false,
      );
      return true;
    }

    function skipCpuPair(): void {
      if (!startCpuPair()) return;
      finishMatchRun(run);
      flowRecordCpuResult(mode, spectatePair, run.match);
      refreshBracketView();
    }

    // A during a spectated pair (or the viewport guard, S-FL5): finish it headless,
    // record it, back to the bracket. finishMatchRun continues the SAME run from where
    // the screen left it, so the winner is the one SALTAR would have produced.
    function skipSpectate(): void {
      finishMatchRun(run);
      flowRecordCpuResult(mode, spectatePair, run.match);
      flowSkipSpectate(flow);
      refreshBracketView();
    }

    // The human's match ended, naturally (runStep) or by the guard (abandoned). ONCE.
    function endHumanMatch(abandoned: boolean): void {
      if (endFired) return;
      endFired = true;
      flowMatchOver(flow, mode, run.match, abandoned);
    }

    // The captions drained after a match: go where the flow says and set the screen up.
    function afterCaptionsDrained(): void {
      const after = flow.after;
      flowCaptionsDrained(flow);
      if (after === 'victory') startVictory();
      else if (after === 'bracket') refreshBracketView();
      else {
        // Back to the selector after ELIMINADO / EMPATE / a loss. Criterion 19: only
        // the World Cup reports a score, and only when it really ended.
        if (modeScores(mode) && modeStatus(mode) === 'eliminated') {
          const cb = onGameOverRef.current;
          if (cb !== undefined) cb(modeScore(mode));
        }
        reportStatus(STATUS_SELECTOR);
      }
    }

    function startVictory(): void {
      fxKind = modeFxKind(mode);
      victoryTitle = modeVictoryTitle(mode);
      victoryTeam = teamOf(modeVictoryTeamId(mode, run.match));
      startFx(fxPool, fxKind, fxRng);
      accumulatorMs = 0;
      // Spec audio table: the chants under the fireworks at full volume, under the
      // confetti "a volumen bajo". They start here, when the caption queue is already
      // empty, so no whistle and no GANADOR ever overlap them (S-FL3).
      sfxVaultWorldCup.play('chants_victory', victoryChantGain(fxKind));
      if (modeScores(mode)) {
        const cb = onVictoryRef.current;
        if (cb !== undefined) cb(modeScore(mode));
      }
      reportStatus(STATUS_VICTORY);
    }

    // CONTINUAR: cut the chants and back to the selector (spec).
    function continueFromVictory(): void {
      sfxVaultWorldCup.stop('chants_victory');
      flowContinue(flow);
      reportStatus(STATUS_SELECTOR);
    }

    // A on the team selector: J1 (and J2 in the two-player mode), then the mode is
    // built -- the one place, once per run (Vault Fighter's confirmSelection).
    function confirmTeam(): void {
      const result = flowConfirmTeam(flow, BANK_IDS.length);
      if (result !== 'done') return;
      runSeed = fixedSeed ?? Date.now();          // the one Date.now() of the whole game (G9-7)
      mode = flowBuildMode(flow, BANK_IDS, runSeed);
      fxRng = createRng(fxSeedFor(runSeed));      // the fourth stream, never the match's
      flowAfterModeBuilt(flow, mode);
      if (modeBracket(mode) === null) startHumanMatch();
      else refreshDrawView();
    }

    function refreshDrawView(): void {
      const wc = modeBracket(mode);
      if (wc === null) return;
      for (let i = 0; i < wc.bracket.length; i++) drawNames[i] = teamOf(wc.bracket[i]).name;
      drawHumanIndex = wc.bracket.indexOf(wc.humanId);
    }

    // Resolved once per entry to the bracket screen and once per VER/SALTAR resolution,
    // never per frame (Vault Fighter 973-1000). The strings are built HERE.
    function refreshBracketView(): void {
      const wc = modeBracket(mode);
      if (wc === null) return;
      bracketTitle = BRACKET_TITLE_PREFIX + roundLabel(wc);
      bracketRows = pairCount(wc);
      const human = humanPairIndex(wc);
      for (let p = 0; p < bracketRows; p++) {
        const homeName = teamOf(pairHomeId(wc, p)).name;
        const awayName = teamOf(pairAwayId(wc, p)).name;
        bracketRowIsHuman[p] = p === human;
        if (!wc.resolved[p]) {
          bracketRowText[p] = homeName + BRACKET_VS + awayName;
          continue;
        }
        // The result of this pair: the latest of this round with this home.
        let text = homeName + BRACKET_VS + awayName;
        for (let r = wc.resultCount - 1; r >= 0; r--) {
          const res = wc.results[r];
          if (res.round !== wc.round || res.homeId !== pairHomeId(wc, p)) continue;
          text = homeName + ' ' + smallNumber(res.homeGoals) + BRACKET_SCORE_SEP + smallNumber(res.awayGoals) + ' ' + awayName;
          break;
        }
        bracketRowText[p] = text;
      }
      let fallen = '';
      for (let i = 0; i < wc.bracket.length; i++) {
        if (isStillIn(wc, wc.bracket[i])) continue;
        fallen += (fallen === '' ? '' : BRACKET_LIST_SEP) + teamOf(wc.bracket[i]).name;
      }
      bracketEliminated = fallen === '' ? '' : BRACKET_ELIMINATED_PREFIX + fallen;
      const pair = flowCpuPair(mode);
      bracketHasChoice = pair !== -1;
      bracketPrompt = pair === -1
        ? BRACKET_YOURS_PREFIX + teamOf(modeHomeId(mode)).name + BRACKET_VS + teamOf(modeAwayId(mode)).name
        : BRACKET_NEXT_PREFIX + teamOf(pairHomeId(wc, pair)).name + BRACKET_VS + teamOf(pairAwayId(wc, pair)).name;
      reportStatus(roundLabel(wc));
    }

    // A on the bracket: VER, SALTAR or the human's match.
    function confirmBracket(): void {
      const action = flowConfirmBracket(flow, mode);
      if (action === 'spectate') startCpuPair();
      else if (action === 'skip') skipCpuPair();
      else if (action === 'play') startHumanMatch();
    }
```

- [ ] **Step 5: `runStep`, `stepCaptionsOnly`, `update`**

Sustituir `runStep` (líneas 291-387) por la versión de máscara de humanos. Solo cambian las líneas señaladas; los puntos 1-5 y 8 se copian del paso 8 tal cual, con `match` → `run.match`:

```tsx
    // ONE simulation step. The human pads are sampled into their TeamInputs; the CPU
    // sides decide inside stepMatchRun (team 0 first, own stream). `first` is false from
    // the second step of a frame on (a single tap must not fire five shots).
    function runStep(first: boolean): void {
      const match = run.match;
      if (run.human[0]) padToTeamInput(pads[0], first, run.inputs[0]);
      if (run.human[1]) padToTeamInput(pads[1], first, run.inputs[1]);
      stepMatchRun(run);

      // 1-5: kick, goal chain, half-end whistle, goal crowd, shootout whistle, ambience
      //      -- IDENTICAL to step 8 (copy lines 296-351 with `match` = run.match and
      //      `matchSeed` for planHalfAmbience).

      // 6. S-SC3's countdown, now for WHICHEVER human keeper holds the ball (0, 1, or
      //    both teams human in the two-player friendly; none in a spectated pair).
      keeperHoldTeam = -1;
      if (run.human[0] && keeperHoldsBall(match, 0)) keeperHoldTeam = 0;
      else if (run.human[1] && keeperHoldsBall(match, 1)) keeperHoldTeam = 1;
      if (keeperHoldTeam !== -1) {
        if (keeperHoldSteps < KEEPER_HOLD_STEPS) keeperHoldSteps++;
      } else keeperHoldSteps = 0;

      // 7. Captions, from the transition detector, seen from the human side of THIS
      //    match; no GANADOR when a victory screen follows (S-FL3).
      const before = captions.kind;
      collectCaptions(match, watch, humanSide, captions, victoryScreen);
      updateWatch(match, watch);
      stepCaption(captions);
      playCaptionEdge(before);

      // 8. The camera -- IDENTICAL to step 8 (lines 377-380).

      // 9. The end, exactly once. A spectated pair is recorded and the flow drains its
      //    FINAL back to the bracket; the human's match goes through the mode.
      if (match.phase === 'over' && !endFired) {
        if (flow.phase === 'spectate') {
          endFired = true;
          flowRecordCpuResult(mode, spectatePair, match);
          flowSpectateOver(flow);
        } else endHumanMatch(false);
      }
    }
```

`stepCaptionsOnly` (393-399) no cambia. Sustituir `update` (401-414) por:

```tsx
    function update(frameMs: number): void {
      const phase = flow.phase;
      if (phase === 'match' || phase === 'spectate' || phase === 'over') {
        // planFrame owns the three modes, the accumulator, the pad-advance guard (H3)
        // and, new in step 9, the x4 of a spectated pair.
        accumulatorMs = planFrame(run.match.phase, pausedRef.current, blocked, accumulatorMs, frameMs, budget, plan, speed);
        if (plan.mode === 'frozen') return;
        if (plan.mode === 'captions-only') {
          stepCaptionsOnly(plan.steps);
          // The queue emptied: FINAL (and ELIMINADO / EMPATE) had their three seconds.
          if (phase === 'over' && captions.kind === 'none') afterCaptionsDrained();
          return;
        }
        for (let i = 0; i < plan.steps; i++) runStep(i === 0);
        if (plan.advancePad) {
          padAdvance(pads[0]);
          padAdvance(pads[1]);
        }
        reportHud();
        return;
      }
      if (phase === 'victory') {
        // The effects run at the fixed step too, from their own stream, paused with P.
        accumulatorMs = planFrame('play', pausedRef.current, blocked, accumulatorMs, frameMs, budget, plan, 1);
        if (plan.mode !== 'full') return;
        for (let i = 0; i < plan.steps; i++) stepFx(fxPool, fxKind, fxRng);
        return;
      }
      accumulatorMs = 0;   // the menus step nothing
    }
```

- [ ] **Step 6: Los lectores de `HUMAN_TEAM` en el dibujo**

`grep -n "HUMAN_TEAM\|CPU_TEAM" components/games/VaultWorldCupGame.tsx` debe quedar **vacío** al final de este paso. Cambios, uno a uno:

(a) `drawPlayer` línea 574: `pad.a !== 'up'` → `pads[p.team].a !== 'up'` (el pad de un equipo CPU está en `padBlur` desde `startMatch` y nunca recibe `padDown`, así que sus casillas no se encienden).

(b) `drawPlayers` (597-602):

```tsx
    function drawPlayers(): void {
      const match = run.match;
      cursorIds[0] = run.human[0] ? cursorPlayerId(match, 0) : -1;
      cursorIds[1] = run.human[1] ? cursorPlayerId(match, 1) : -1;
      for (let i = 0; i < match.players.length; i++) {
        const p = match.players[i];
        drawPlayer(p, p.id === cursorIds[p.team]);
      }
    }
```

(c) `drawHud` (695-793): nombres y marcador por `HOME`/`AWAY`; una barra bajo el nombre de cada equipo humano; la tira de alineación/estrategia/sprint **por equipo humano** (izquierda para el 0, derecha para el 1); el aviso del portero para `keeperHoldTeam`; la pancarta del spectate:

```tsx
    function drawTeamStrip(team: 0 | 1): void {
      const match = run.match;
      const right = team === 1;
      const x = right ? VIEW_W - 12 : 12;
      ctx.textAlign = right ? 'right' : 'left';
      ctx.font = FONT_HALF;
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(FORMATIONS[match.formationIndex[team]].name, x, VIEW_H - 40);
      ctx.fillText(STRATEGY_LABEL[match.strategies[team]], x, VIEW_H - 26);
      ctx.fillStyle = HUD_DIM;
      const table = tables[team];
      ctx.fillText(table === TWO_PLAYER_P2 ? FORMATION_HINT_P2 : table === TWO_PLAYER_P1 ? FORMATION_HINT_P1 : FORMATION_HINT_SOLO, x, VIEW_H - 12);
      const controlled = match.players[cursorPlayerId(match, team)];
      const bx = right ? VIEW_W - 12 - BAR_W : 12;
      const by = VIEW_H - 58;
      ctx.fillStyle = BAR_EMPTY;
      ctx.fillRect(bx, by, BAR_W, BAR_H);
      ctx.fillStyle = SPRINT_BAR;
      ctx.fillRect(bx, by, BAR_W * sprintBarFraction(controlled), BAR_H);
    }

    function drawHud(): void {
      const match = run.match;
      ctx.fillStyle = HUD_BG;
      ctx.fillRect(0, 0, VIEW_W, HUD_H);
      ctx.textBaseline = 'middle';

      ctx.font = FONT_TEAM;
      ctx.textAlign = 'left';
      ctx.fillStyle = match.teams[HOME].kit.primary;
      ctx.fillText(match.teams[HOME].name, 12, HUD_H / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = match.teams[AWAY].kit.primary;
      ctx.fillText(match.teams[AWAY].name, VIEW_W - 12, HUD_H / 2);
      // A bar under the name of each human team: in the World Cup the human may be on
      // the right (S-PK3), and in the two-player friendly both are.
      ctx.fillStyle = HUD_ACCENT;
      if (run.human[HOME]) ctx.fillRect(12, HUD_H - 6, 60, 2);
      if (run.human[AWAY]) ctx.fillRect(VIEW_W - 72, HUD_H - 6, 60, 2);

      ctx.textAlign = 'center';
      ctx.fillStyle = HUD_TEXT;
      ctx.font = FONT_SCORE;
      ctx.fillText(smallNumber(match.score[HOME]), VIEW_W / 2 - 52, HUD_H / 2);
      ctx.fillText(smallNumber(match.score[AWAY]), VIEW_W / 2 + 52, HUD_H / 2);
      ctx.font = FONT_CLOCK;
      ctx.fillStyle = HUD_ACCENT;
      ctx.fillText(clockText(match), VIEW_W / 2, HUD_H / 2 - 7);
      ctx.font = FONT_HALF;
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(halfLabel(match), VIEW_W / 2, HUD_H / 2 + 12);

      // The shootout scoreboard -- IDENTICAL to step 8 (lines 720-744) with HOME/AWAY.

      if (run.human[0]) drawTeamStrip(0);
      if (run.human[1]) drawTeamStrip(1);

      if (buttonsIdle(match)) {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HINT_TEXT;
        ctx.fillText(HINT_AIM, VIEW_W / 2, VIEW_H - 14);
      }

      // S-SC3, for the human keeper who holds the ball (see runStep point 6). The hint
      // names J1's keys when J1's table is the one in use.
      if (keeperHoldTeam !== -1 && isOpenPlay(match.phase)) {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HUD_ACCENT;
        const left = countdownSeconds(KEEPER_HOLD_STEPS - keeperHoldSteps);
        const hint = tables[keeperHoldTeam] === TWO_PLAYER_P1 ? KEEPER_HINT_P1 : KEEPER_HINT;
        ctx.fillText(hint + smallNumber(left), VIEW_W / 2, HUD_H + 16);
      }

      if (flow.phase === 'spectate') {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HUD_ACCENT;
        ctx.fillText(SPECTATE_BANNER, VIEW_W / 2, HUD_H + 16);
      } else if (!match.rules.timed) {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HUD_DIM;
        ctx.fillText(TRAINING_HINT, VIEW_W / 2, HUD_H + 16);
      }
    }
```

(d) En `drawPitch`, `drawPlayer`, `drawBall`, `drawSetPiece`, `drawMinimap`: `match` → `run.match` (añadir `const match = run.match;` como primera línea de cada una).

- [ ] **Step 7: Las cinco pantallas de flujo y el `draw()` por fase**

Añadir antes de `draw()`:

```tsx
    function drawMenuBackground(title: string): void {
      ctx.fillStyle = MENU_BG;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.font = FONT_MENU_TITLE;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = HUD_ACCENT;
      ctx.fillText(title, VIEW_W / 2, 48);
    }

    function drawHint(text: string, y: number): void {
      ctx.font = FONT_SMALL;
      ctx.textAlign = 'center';
      ctx.fillStyle = HINT_TEXT;
      ctx.fillText(text, VIEW_W / 2, y);
    }

    function drawModeSelect(): void {
      drawMenuBackground(MODE_TITLE);
      const x = (VIEW_W - MODE_CARD_W) / 2;
      for (let i = 0; i < MODE_LIST.length; i++) {
        const y = modeCardY(i);
        const selected = i === flow.modeIndex;
        ctx.fillStyle = CARD_BG;
        ctx.fillRect(x, y, MODE_CARD_W, MODE_CARD_H);
        ctx.strokeStyle = selected ? HUD_ACCENT : CARD_BORDER;
        ctx.lineWidth = selected ? 3 : 1;
        ctx.strokeRect(x, y, MODE_CARD_W, MODE_CARD_H);
        ctx.textAlign = 'center';
        ctx.font = FONT_MENU_ITEM;
        ctx.fillStyle = selected ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(MODE_NAMES[MODE_LIST[i]], VIEW_W / 2, y + 24);
        ctx.font = FONT_MENU_BLURB;
        ctx.fillStyle = selected ? HUD_TEXT : DIM_TEXT;
        ctx.fillText(MODE_BLURBS[MODE_LIST[i]], VIEW_W / 2, y + 48);
      }
      drawHint(MODE_HINT, VIEW_H - 24);
    }

    function drawTeamSelect(): void {
      const two = flowHumanCount(flow) === 2;
      const picking = flowPickingHuman(flow);
      drawMenuBackground(two ? TEAM_TITLES_TWO[picking] : TEAM_TITLE_SOLO);
      for (let i = 0; i < TEAMS.length; i++) {
        const def = TEAMS[i];
        const x = teamCardX(i, TEAMS.length);
        const y = teamCardY(i);
        const selected = i === flow.cursor;
        const taken = two && picking === 1 && i === flow.picked[0];
        ctx.fillStyle = CARD_BG;
        ctx.fillRect(x, y, TEAM_CARD_W, TEAM_CARD_H);
        ctx.strokeStyle = selected ? HUD_ACCENT : CARD_BORDER;
        ctx.lineWidth = selected ? 3 : 1;
        ctx.strokeRect(x, y, TEAM_CARD_W, TEAM_CARD_H);
        // The kit: a shirt block in the primary with a collar band in the secondary.
        ctx.fillStyle = def.kit.primary;
        ctx.fillRect(x + 10, y + 12, 30, 40);
        ctx.fillStyle = def.kit.secondary;
        ctx.fillRect(x + 10, y + 12, 30, 7);
        ctx.font = FONT_HALF;
        ctx.textAlign = 'left';
        ctx.fillStyle = taken ? DIM_TEXT : selected ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(def.name, x + 50, y + TEAM_CARD_H / 2);
        if (taken) {
          ctx.textAlign = 'right';
          ctx.fillStyle = DIM_TEXT;
          ctx.fillText(TAKEN_TAG, x + TEAM_CARD_W - 8, y + 14);
        }
      }
      // G9-5: the formation, one per human, on the human's own number row.
      const labels = two && picking === 1 ? FORMATION_LABELS_P2 : FORMATION_LABELS_SOLO;
      ctx.font = FONT_SMALL;
      ctx.textAlign = 'left';
      ctx.fillStyle = HUD_DIM;
      ctx.fillText(FORMATION_ROW_LABEL, 32, FORMATION_ROW_Y);
      for (let i = 0; i < labels.length; i++) {
        ctx.fillStyle = i === flow.formation[picking] ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(labels[i], 150 + i * 200, FORMATION_ROW_Y);
      }
      drawHint(two ? TEAM_HINTS_TWO[picking] : TEAM_HINT_SOLO, SELECT_HINT_Y);
    }

    function drawDraw(): void {
      drawMenuBackground(DRAW_TITLE);
      ctx.font = FONT_MENU_ITEM;
      for (let i = 0; i < drawNames.length; i++) {
        const you = i === drawHumanIndex;
        ctx.textAlign = 'center';
        ctx.fillStyle = you ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(drawNames[i], drawColX(i), drawRowY(i) + DRAW_ROW_H / 2);
        if (you) {
          ctx.font = FONT_SMALL;
          ctx.fillText(YOU_TAG, drawColX(i) + 130, drawRowY(i) + DRAW_ROW_H / 2);
          ctx.font = FONT_MENU_ITEM;
        }
      }
      drawHint(DRAW_HINT, VIEW_H - 24);
    }

    function drawBracket(): void {
      drawMenuBackground(bracketTitle);
      ctx.font = FONT_MENU_ITEM;
      for (let p = 0; p < bracketRows; p++) {
        const y = bracketRowY(p) + BRACKET_ROW_H / 2;
        ctx.textAlign = 'center';
        ctx.fillStyle = bracketRowIsHuman[p] ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(bracketRowText[p], VIEW_W / 2, y);
        if (bracketRowIsHuman[p]) {
          ctx.font = FONT_SMALL;
          ctx.textAlign = 'left';
          ctx.fillText(YOU_TAG, VIEW_W - 80, y);
          ctx.font = FONT_MENU_ITEM;
        }
      }
      ctx.font = FONT_TEAM;
      ctx.textAlign = 'center';
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(bracketPrompt, VIEW_W / 2, BRACKET_PROMPT_Y);
      if (bracketHasChoice) {
        // VER | SALTAR, the selected one boxed (G9-3).
        const w = 120;
        const h = 34;
        const y = BRACKET_PROMPT_Y + 26;
        for (let i = 0; i < 2; i++) {
          const x = VIEW_W / 2 + (i === 0 ? -w - 10 : 10);
          const selected = flow.bracketChoice === i;
          ctx.fillStyle = CARD_BG;
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = selected ? HUD_ACCENT : CARD_BORDER;
          ctx.lineWidth = selected ? 3 : 1;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = selected ? HUD_ACCENT : HUD_TEXT;
          ctx.fillText(i === 0 ? BRACKET_VER : BRACKET_SALTAR, x + w / 2, y + h / 2);
        }
      }
      if (bracketEliminated !== '') {
        ctx.font = FONT_SMALL;
        ctx.fillStyle = DIM_TEXT;
        ctx.fillText(bracketEliminated, VIEW_W / 2, BRACKET_ELIMINATED_Y);
      }
      drawHint(bracketHasChoice ? BRACKET_CHOICE_HINT : BRACKET_PLAY_HINT, BRACKET_HINT_Y);
    }

    // Spec: a fixed composition painted on canvas -- the winner's kit and name lifting
    // the cup; the only thing moving is the confetti or the fireworks.
    function drawVictory(): void {
      ctx.fillStyle = MENU_BG;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < fxPool.count; i++) {
        if (fxPool.life[i] === 0) continue;
        ctx.fillStyle = FX_COLORS[fxPool.color[i]];
        ctx.fillRect(fxPool.x[i], fxPool.y[i], fxPool.size[i], fxPool.size[i]);
      }
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.font = FONT_VICTORY_TITLE;
      ctx.fillStyle = HUD_ACCENT;
      ctx.fillText(victoryTitle, VIEW_W / 2, VICTORY_TITLE_Y);
      ctx.font = FONT_VICTORY_TEAM;
      ctx.fillStyle = victoryTeam.kit.primary;
      ctx.fillText(victoryTeam.name, VIEW_W / 2, VICTORY_TEAM_Y);
      // The figure: shirt, head, two arms up, the cup above the hands.
      const cx = VIEW_W / 2;
      const cy = VICTORY_FIGURE_Y;
      ctx.fillStyle = victoryTeam.kit.primary;
      ctx.fillRect(cx - 30, cy - 40, 60, 80);
      ctx.fillStyle = victoryTeam.kit.secondary;
      ctx.fillRect(cx - 30, cy - 40, 60, 10);
      ctx.fillStyle = SKIN_COLOR;
      ctx.beginPath();
      ctx.arc(cx, cy - 62, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = SKIN_COLOR;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(cx - 28, cy - 30);
      ctx.lineTo(cx - 48, cy - 100);
      ctx.moveTo(cx + 28, cy - 30);
      ctx.lineTo(cx + 48, cy - 100);
      ctx.stroke();
      ctx.fillStyle = CUP_COLOR;
      ctx.fillRect(cx - 40, cy - 130, 80, 12);
      ctx.fillRect(cx - 30, cy - 118, 60, 26);
      ctx.fillRect(cx - 8, cy - 92, 16, 14);
      ctx.fillRect(cx - 24, cy - 78, 48, 8);
      drawHint(VICTORY_HINT, VICTORY_HINT_Y);
    }

    function drawMatch(): void {
      drawPitch();
      drawPlayers();
      drawBall();
      drawSetPiece();
      drawMinimap();
      drawHud();
      drawCaption();
    }

    function draw(): void {
      switch (flow.phase) {
        case 'mode-select': drawModeSelect(); break;
        case 'team-select': drawTeamSelect(); break;
        case 'draw': drawDraw(); break;
        case 'bracket': drawBracket(); break;
        case 'victory': drawVictory(); break;
        case 'match':
        case 'spectate':
        case 'over': drawMatch(); break;
      }
      // Last, over everything, and only when the guard has tripped (step 8).
      drawBlocked();
    }
```

(`drawCaption` y `drawBlocked` sin cambios; `drawCaption` lee `captions.kind`, que en las pantallas de menú está en `'none'`.)

- [ ] **Step 8: Teclado por fase y guard de viewport**

Sustituir `handleKeyDown`/`handleKeyUp`/`handleBlur`/`handleResize` (líneas 869-950) por:

```tsx
    // The menu keys go through the SOLO table (arrows or WASD + J), so both players
    // can drive the menus; the team selector of the two-player mode uses each player's
    // own table (G9-2), so J2 picks with the arrows and J while J1 holds WASD and C.
    function tableForPicker(): KeyTable {
      return flowHumanCount(flow) === 2 ? TWO_PLAYER_TABLES[flowPickingHuman(flow)] : SOLO;
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (isTypingTarget(e)) return;
      if (!sfxReady) {
        sfxReady = true;
        sfxVaultWorldCup.init();
        sfxVaultWorldCup.setMuted(mutedRef.current);
      }
      if (pausedRef.current || blocked) return;
      const key = e.key.toLowerCase();
      switch (flow.phase) {
        case 'mode-select': {
          if (e.repeat) return;
          const k = padKeyFor(SOLO, key);
          if (k === 'up') flowMoveMode(flow, -1);
          else if (k === 'down') flowMoveMode(flow, 1);
          else if (k === 'a') flowConfirmMode(flow);
          else return;
          e.preventDefault();
          return;
        }
        case 'team-select': {
          if (e.repeat) return;
          const table = tableForPicker();
          const picker = flowPickingHuman(flow);
          const k = padKeyFor(table, key);
          if (k === 'up') flowMoveTeam(flow, 0, -1, TEAMS.length);
          else if (k === 'down') flowMoveTeam(flow, 0, 1, TEAMS.length);
          else if (k === 'left') flowMoveTeam(flow, -1, 0, TEAMS.length);
          else if (k === 'right') flowMoveTeam(flow, 1, 0, TEAMS.length);
          else if (k === 'a') confirmTeam();
          else if (padChoice(pads[picker], table, key)) flowSetFormation(flow, picker, pads[picker].formation);
          else return;
          e.preventDefault();
          return;
        }
        case 'draw': {
          if (e.repeat) return;
          if (padKeyFor(SOLO, key) !== 'a') return;
          e.preventDefault();
          flowConfirmDraw(flow);
          refreshBracketView();
          return;
        }
        case 'bracket': {
          if (e.repeat) return;
          const k = padKeyFor(SOLO, key);
          if (k === 'left') flowMoveBracketChoice(flow, -1);
          else if (k === 'right') flowMoveBracketChoice(flow, 1);
          else if (k === 'a') confirmBracket();
          else return;
          e.preventDefault();
          return;
        }
        case 'spectate': {
          if (e.repeat) return;
          if (padKeyFor(SOLO, key) !== 'a') return;
          e.preventDefault();
          skipSpectate();
          return;
        }
        case 'victory': {
          if (e.repeat) return;
          if (padKeyFor(SOLO, key) !== 'a') return;
          e.preventDefault();
          continueFromVictory();
          return;
        }
        case 'match': {
          if (e.repeat) return;   // auto-repeat is not a new press: the pad edges are ours
          if (key === 'r') {
            // S-FL4 / S-FL6: R leaves the training only; flowExitMatch is a no-op in a timed match.
            flowExitMatch(flow, mode);
            if (flow.phase === 'mode-select') {
              padBlur(pads[0]);
              padBlur(pads[1]);
              reportStatus(STATUS_SELECTOR);
              e.preventDefault();
            }
            return;
          }
          // One handler, two pads, two tables: a key of one table leaves the other pad
          // untouched (keyboard.test.ts, "routing a key through both tables").
          for (let t = 0; t < 2; t++) {
            if (!run.human[t]) continue;
            const k = padKeyFor(tables[t], key);
            if (k !== null) {
              e.preventDefault();
              padDown(pads[t], k);
              return;
            }
            if (padChoice(pads[t], tables[t], key)) {
              e.preventDefault();
              return;
            }
          }
          return;
        }
        case 'over':
          return;
      }
    }

    function handleKeyUp(e: KeyboardEvent): void {
      const key = e.key.toLowerCase();
      for (let t = 0; t < 2; t++) {
        const k = padKeyFor(tables[t], key);
        if (k === null) continue;
        // Step 8's rule, per pad: a DIRECTION is always released; a BUTTON released while
        // paused or blocked is cleared without an edge (padClear).
        const isButton = k === 'a' || k === 'b' || k === 'c';
        if (isButton && (pausedRef.current || blocked)) padClear(pads[t], k);
        else padUp(pads[t], k);
      }
    }

    function handleBlur(): void {
      padBlur(pads[0]);
      padBlur(pads[1]);
    }

    // Spec: "solo desktop; si el viewport se reduce en partida, se para y redirige".
    // The human's match is abandoned (G9-8 for the World Cup, S-SC12 for a friendly);
    // a spectated pair is finished headless and recorded (S-FL5); the menus just get
    // the panel. And there is a way back (step-8 Minor 5): when the window is big
    // enough again the block lifts -- on a menu screen only, never into a match.
    function handleResize(): void {
      if (viewportAllowed(window.innerWidth, window.innerHeight)) {
        if (blocked && flow.phase !== 'match' && flow.phase !== 'spectate') blocked = false;
        return;
      }
      if (blocked) return;
      blocked = true;
      if (flow.phase === 'spectate') {
        skipSpectate();
        return;
      }
      if (flow.phase !== 'match') return;
      const match = run.match;
      updateWatch(match, watch);
      abandon(match);
      // S-SC12: the standing result as a CAPTION (never a screen under the panel), with
      // its whistle (I2 of the step-8 review), same order as step 8.
      const beforeBlocked = captions.kind;
      collectCaptions(match, watch, humanSide, captions, false);
      playCaptionEdge(beforeBlocked);
      updateWatch(match, watch);
      padBlur(pads[0]);
      padBlur(pads[1]);
      endHumanMatch(true);
    }

    handleResize();
    reportStatus(STATUS_SELECTOR);
```

El registro de listeners, `rafId`, `loop` y la limpieza (952-968) no cambian. **Comprobar** que `grep -n "mode\.kind\|m\.kind\|HUMAN_TEAM\|CPU_TEAM\|CPU_SEED_SALT\|Math.random" components/games/VaultWorldCupGame.tsx` devuelve vacío (el `sp.kind === 'penalty'` de `drawSetPiece` es legal y sigue ahí: por eso el patrón no es `kind ===` a secas) y que `grep -c "Date.now()" components/games/VaultWorldCupGame.tsx` devuelve **1** (la línea `runSeed = fixedSeed ?? Date.now();`; ningún comentario debe contener ese literal).

- [ ] **Step 9: La play-page provisional**

Sustituir `app/games/vault-world-cup/play/page.tsx` entero por:

```tsx
'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

// PROVISIONAL (stage C, step 9). The definitive play page is step 10: catalogue
// entry, migration, music, the GameOverModal with saveScore and the mobile gamepad all
// land there and rewrite this file. It lives at the final URL on purpose.
const VaultWorldCupGame = dynamic(() => import('@/components/games/VaultWorldCupGame'), { ssr: false });

const IDLE_SCORE = '0 - 0';
const IDLE_CLOCK = '0:00';

function isTypingTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  return target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
}

export default function VaultWorldCupPlay() {
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
```

- [ ] **Step 10: Tipos, lint, suite y build**

Run: `npx tsc --noEmit && npx eslint components/games/VaultWorldCupGame.tsx app/games/vault-world-cup/play/page.tsx && npx vitest run && npm run build`
Expected: `tsc` sin salida; eslint sin errores (el `// eslint-disable-next-line react-hooks/exhaustive-deps` del efecto de montaje sigue ahí: `seed` se lee una vez, a propósito); **1157 tests en 68 ficheros** (1156 + 1); `build` exit 0. Si `tsc` señala un import sin usar del bloque del Step 2 (`ROUND_LABELS`, `TEAM_CARD_H`…), quitarlo: la lista del Step 2 es un superconjunto seguro.

- [ ] **Step 11: Invariantes de la etapa**

Run:

```bash
git diff --stat 0e553af -- components/games/football-logic/
grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/ components/games/VaultWorldCupGame.tsx
grep -n "mode\.kind\|m\.kind\|HUMAN_TEAM\|CPU_TEAM\|onMatchEnd" components/games/VaultWorldCupGame.tsx app/games/vault-world-cup/play/page.tsx
grep -c "Date.now()" components/games/VaultWorldCupGame.tsx
grep -rn "Date.now\|performance.now" components/games/football-screen/ components/games/football-logic/
```

Expected: el diff solo `match.ts` y `match.test.ts`; los tres greps siguientes vacíos salvo el recuento, que es **1**; el último vacío.

- [ ] **Step 12: Ledger y proponer commit**

Ledger: `Task 9-7: DONE (1157/1157 en 68 ficheros; tsc/eslint/build limpios; componente ~1 500 líneas; play-page provisional para los cuatro modos; S-FL5/S-FL6).`

No ejecutar. Mensaje propuesto:

`feat(world-cup): the whole flow in one canvas — mode and team selectors, draw, bracket with VER/SALTAR, two-player pads, victory screens, World Cup callbacks (step 9)`

**QA de Paco para esta tarea:** la lista completa está en el «Cierre del paso 9».

---

## Cierre del paso 9

- [ ] **C1: La suite, el compilador y el build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: **los 62 ficheros y 1050 tests de partida siguen verdes**, más los nuevos, con este reparto contado uno a uno sobre los tests escritos en el plan:

| Tarea | Fichero | Tests | Acumulado |
|---|---|---:|---:|
| — | baseline (`0e553af`) | 1050 | 1050 |
| 9-1 | `football-logic/match.test.ts` (+6), `football-screen/hud.test.ts` (+1) | 7 | 1057 |
| 9-2 | `keyboard.test.ts` (+7), `loop.test.ts` (+5), `match-loop.test.ts` (+1) | 13 | 1070 |
| 9-3 | `football-logic/world-cup.test.ts` (24), `football-screen/match-run.test.ts` (10) | 34 | 1104 |
| 9-4 | `football-logic/mode.test.ts` (12) | 12 | 1116 |
| 9-5 | `flow-layout.test.ts` (5), `captions.test.ts` (+6), `flow.test.ts` (18) | 29 | 1145 |
| 9-6 | `particles.test.ts` (8), `lib/sfx-vault-world-cup.test.ts` (+2), `sfx-map.test.ts` (+1) | 11 | 1156 |
| 9-7 | `captions.test.ts` (+1) | 1 | **1157** |

Es decir **1157 tests en 68 ficheros** (62 + `world-cup`, `match-run`, `mode`, `flow-layout`, `flow`, `particles`). `tsc` sin salida. `npm run build` exit 0. **Anotar el recuento exacto en el ledger**: la puerta que importa es el criterio 21 con el umbral real (**la suite no baja de 1050**) y que ninguno de los 1050 anteriores esté rojo; el número anunciado es una previsión, no una aserción.

- [ ] **C2: El motor solo cambió en la Task 9-1**

Run: `git diff --stat 0e553af -- components/games/football-logic/ && git status --short components/games/football-logic/`
Expected: el `diff --stat` lista **exactamente** `match.ts` y `match.test.ts`; `git status` muestra `M` en esos dos y `??` en `mode.ts`, `mode.test.ts`, `world-cup.ts`, `world-cup.test.ts`, y nada más. Comprobar además que `git diff 0e553af -- components/games/football-logic/match.ts | grep "^+" | grep -v "^+++" | wc -l` está **por debajo de 60**: el cambio de G9-1 era «pequeño» y tiene que seguir siéndolo.

- [ ] **C3: Determinismo de todas las capas**

Run:
```bash
grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/ components/games/VaultWorldCupGame.tsx lib/sfx-vault-world-cup.ts
grep -rn "Date.now\|performance.now" components/games/football-screen/ components/games/football-logic/ lib/sfx-vault-world-cup.ts
grep -c "Date.now()" components/games/VaultWorldCupGame.tsx
grep -rn "matchRng" components/games/VaultWorldCupGame.tsx components/games/football-screen/particles.ts components/games/football-screen/flow.ts
grep -n "Math\.\(cos\|sin\)" components/games/football-screen/*.ts | grep -v test
```
Expected: los dos primeros **vacíos**; el tercero **1** (la semilla del run, y solo esa); el cuarto **vacío** (nadie fuera de `match-run.ts` toca el stream del partido); el quinto **solo las dos líneas de `buildDirs` en `particles.ts`**.

- [ ] **C4: Sin ramas por modo en el componente, y todo lo exportado con consumidor**

Run: `grep -n "\.kind\b" components/games/VaultWorldCupGame.tsx | grep -v "captions\.kind\|sp\.kind"`
Expected: **vacío** (los dos `.kind` legales son `captions.kind` —el rótulo— y `sp.kind === 'penalty'` en `drawSetPiece` —el tipo de saque, del paso 8—; ninguno es un modo. Cualquier `mode.kind` / `m.kind` es una rama por modo que debe volver a `mode.ts`).

Recorrer los `export` de los seis ficheros nuevos y de los cinco modificados y comprobar que cada uno lo usa el componente, otro módulo o un test. En particular: `tablesShareKey` (test + sonda P4), `activeCount` (test), `PERFECT_BASE_SCORE` (test), `drawSeedFor` (flow + test), `TWO_PLAYER_TABLES` (componente), `HUMANS_BY_MODE` (flow + test), `WORLD_CUP_ROUNDS` (**si nadie lo usa, borrarlo**: la tabla de rondas ya lo implica). Y el recorrido inverso del paso 8 sobre `VaultWorldCupGame.tsx`: cada símbolo importado aparece al menos una vez más que en su `import` (`tsconfig` sin `noUnusedLocals`).

- [ ] **C5: Sondas ejecutables (se escriben como `*.probe.test.ts` en `components/games/football-screen/`, se corren con `npx vitest run <fichero>`, se guarda su salida en `.superpowers/sdd/2026-09-09-vault-world-cup-step-9/probes/<nombre>.txt` y SE BORRAN antes de proponer el commit)**

Cada sonda es un fichero de vitest con un solo `it` que imprime con `console.log` y asierta lo que dice su título. Ninguna se queda en el repo: `git status --short | grep probe` debe estar vacío al terminar.

**P1 — Un Mundial completo headless con cada una de las 16 selecciones como humana, tres semillas** (`world-cup-full.probe.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { NORMAL_RULES } from '../football-logic/match';
import { modeBracket, modeEndMatch, modeHomeId, modeAwayId, modeDifficulty, modeMatchSeed, modeScore, modeStatus } from '../football-logic/mode';
import { TEAMS, teamById } from '../football-logic/teams';
import { checkWorldCupBracket } from '../football-logic/world-cup';
import { createFlowState, flowAfterModeBuilt, flowBracketAction, flowBuildMode, flowCaptionsDrained, flowConfirmBracket, flowConfirmDraw, flowConfirmMode, flowConfirmTeam, flowCpuPair, flowMatchOver, flowMoveBracketChoice, flowMoveMode, flowRecordCpuResult } from './flow';
import { createMatchRun, finishMatchRun } from './match-run';

const BANK_IDS = TEAMS.map((t) => t.id);
function team(id: string) { const d = teamById(TEAMS, id); if (!d) throw new Error(id); return d; }

// The human's match is played by the CPU too (both sides CPU, the human's difficulty):
// what this probes is the bracket, the seeds and the scoring, not the football.
function playWorldCup(teamIndex: number, seed: number): { status: string; score: number; steps: number } {
  const f = createFlowState();
  while (f.modeIndex !== 3) flowMoveMode(f, 1);
  flowConfirmMode(f);
  f.cursor = teamIndex;
  expect(flowConfirmTeam(f, BANK_IDS.length)).toBe('done');
  const m = flowBuildMode(f, BANK_IDS, seed);
  flowAfterModeBuilt(f, m);
  flowConfirmDraw(f);
  let steps = 0;
  for (let round = 0; round < 3 && modeStatus(m) === 'playing'; round++) {
    const wc = modeBracket(m);
    if (wc === null) throw new Error('no bracket');
    expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
    while (flowBracketAction(f, m) !== 'play') {
      flowMoveBracketChoice(f, 1);
      expect(flowConfirmBracket(f, m)).toBe('skip');
      const pair = flowCpuPair(m);
      const run = createMatchRun(team(wc.entrants[pair * 2]), team(wc.entrants[pair * 2 + 1]), (wc.seed ^ (round + 1) * 0x85ebca6b) >>> 0, modeDifficulty(m), [false, false], NORMAL_RULES, [0, 0]);
      expect(finishMatchRun(run)).not.toBe(-1);
      steps += run.match.stepCount;
      flowRecordCpuResult(m, pair, run.match);
      flowMoveBracketChoice(f, 1);
    }
    expect(flowConfirmBracket(f, m)).toBe('play');
    const human = createMatchRun(team(modeHomeId(m)), team(modeAwayId(m)), modeMatchSeed(m, seed), modeDifficulty(m), [false, false], NORMAL_RULES, [0, 0]);
    expect(finishMatchRun(human)).not.toBe(-1);
    steps += human.match.stepCount;
    flowMatchOver(f, m, human.match, false);
    flowCaptionsDrained(f);
  }
  const wc = modeBracket(m);
  if (wc === null) throw new Error('no bracket');
  expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
  return { status: modeStatus(m), score: modeScore(m), steps };
}

describe('probe P1', () => {
  it('every team of the bank, three seeds: the tournament always ends, the invariant always holds, and a replay gives the same score', () => {
    let champions = 0;
    let eliminated = 0;
    let totalSteps = 0;
    for (let i = 0; i < TEAMS.length; i++) {
      for (const seed of [11, 22, 33]) {
        const a = playWorldCup(i, seed);
        const b = playWorldCup(i, seed);
        expect(a.status === 'champion' || a.status === 'eliminated').toBe(true);
        expect(a.score).toBe(b.score);
        expect(a.status).toBe(b.status);
        if (a.status === 'champion') champions++; else eliminated++;
        totalSteps += a.steps;
        console.log(`${TEAMS[i].id} seed ${seed}: ${a.status} ${a.score} pts (${a.steps} steps)`);
      }
    }
    console.log(`champions ${champions} / eliminated ${eliminated} / ${totalSteps} simulated steps`);
    expect(champions + eliminated).toBe(TEAMS.length * 3);
  });
});
```

(El match seed de los cruces de la CPU en esta sonda NO es `matchSeedFor` a propósito: la sonda no importa `matchSeedFor` para no depender de la firma; lo que se mide es que el cuadro y la puntuación se cierran con CUALQUIER resultado. La equivalencia de semillas la cubren los tests de 9-3.) Expected: pasa. Ojo con la escala: son 48 Mundiales **× 2** (la réplica `b`) = 96, cada uno con 6 partidos simulados (3 + 1 de la CPU y 2 + 1 del «humano»), ~576 partidos completos del orden de 8 M de pasos; medido hoy en `ai.test.ts` un partido CPU-CPU completo cuesta ~0,15-0,3 s, así que **1-3 min**. Si supera los 3 min, dejar las semillas en `[11]` (32 Mundiales, ~1 min) y anotarlo en el ledger. Guardar la salida en `probes/p1-world-cup-full.txt`.

**P2 — 200 sorteos deterministas** (`world-cup-draws.probe.test.ts`): para `seed` 0..199, `createWorldCup(BANK_IDS, TEAMS[seed % 16].id, seed, createRng(seed))` dos veces → `bracket` iguales, `checkWorldCupBracket` vacío, los 12 `matchSeedFor(seed, round, pair)` distintos, y contar en cuántos el humano cae en el lado 0 (esperado 80-120). Guardar en `probes/p2-draws.txt`.

**P3 — Entrenamiento 10 000 pasos con entradas humanas aleatorias** (`training.probe.test.ts`): `createMatchRun(TEAMS[0], TEAMS[1], 5, 5, [true, false], TRAINING_RULES, [0, 0])`; cada paso escribir en `run.inputs[0]` un d-pad y botones sacados de `createRng(99)` (dx/dy ∈ {-1,0,1}, `a`/`b` `'pressed'` con probabilidad 0,02, `c` `'held'` con 0,3), `stepMatchRun`; al final: `halfStep === 0`, `half === 1`, `phase !== 'over'`, y las posiciones de los siete de campo del equipo 1 **iguales** a las que tenían al entrar en juego salvo tras un saque (contar cuántos saques hubo: `setPiece !== null` flancos) — imprimir goles del humano, saques, y si alguna estatua se movió fuera de un saque (**debe ser 0**). Guardar en `probes/p3-training.txt`.

**P4 — Dos pads sin tecla compartida** (`keys.probe.test.ts`): `tablesShareKey` en las cuatro combinaciones (P1↔P2 null, SOLO↔P2 'arrowup', SOLO↔P1 'w'), y una simulación de 5 000 `keydown` aleatorios de las 24 teclas de las dos tablas enrutados por `padKeyFor` a dos pads: nunca una tecla mueve los dos, y los dos pads producen `TeamInput` válidos (`checkTeamInput`). Guardar en `probes/p4-keys.txt`.

**P5 — VER y SALTAR dan lo mismo, 20 semillas, corte en un paso aleatorio** (`spectate-equivalence.probe.test.ts`): para 20 semillas y las tres dificultades de ronda, un `MatchRun` CPU-CPU cortado tras `floor(rng() * 8000)` pasos y terminado con `finishMatchRun`, contra otro terminado desde cero: mismo `winnerOf`, mismo `score`, mismo `stepCount`, mismo `ball.x`. Imprimir el reparto de ganadores 0/1 (S-PK3: el equipo 0 saca primero en la tanda; anotar cuántos partidos fueron a tanda y quién los ganó). Guardar en `probes/p5-spectate.txt`.

- [ ] **C6: Peticiones separadas al motor (NO se ejecutan en el paso 9)**

Las del paso 8 (M1-M8, M10 en su `final-review-report.md` §8) siguen abiertas y **ninguna se toca aquí**. Nuevas de este paso:

| # | Fichero | Cambio pedido | Origen |
|---|---|---|---|
| M11 | `football-logic/ball.ts:73` | `canPickUp` con un parámetro de reglas (o un flag por jugador) haría innecesario `dropFrozenPickup` en `match.ts`, que hoy suelta el balón un paso después de que `pickUp` lo pegara al pie. Es más limpio, pero toca `ball.ts` y `stepBall`, fuera del cambio pequeño de G9-1. | S-FL2 |
| M12 | `football-logic/set-pieces.ts:115` (`pushRivalsAway`) y `beginSetPiece` | En entrenamiento, un saque de banda/córner del humano empuja a las estatuas y un saque del equipo congelado teletransporta a una al balón: las estatuas «derivan» de sus anclas a lo largo de una sesión larga (cada saque de centro las recoloca). Si Paco lo nota, un `placeByFormation` del congelado al terminar cada saque lo arregla (dos líneas en `resumePlay` bajo `rules.frozenTeam`). | S-FL1, sonda P3 |
| M13 | `football-logic/match.ts` `endGoalPause` | Alternativa a S-FL1: que en entrenamiento saque siempre el humano tras un gol. Una línea (`startKickoff(match, match.rules.frozenTeam === 0 ? 1 : 0)` cuando `frozenTeam >= 0`), pendiente de que el QA diga si los 5 s del saque automático de la estatua molestan. | S-FL1 |

- [ ] **C7: Lista de QA manual para Paco (en su `:3000`, ruta `/games/vault-world-cup/play`)**

Claude **no** ejecuta nada de esto. Paco juega y apunta; los criterios se revisan después. Los 25 puntos del paso 8 (`…stage-c-screen/final-review-report.md` §7) siguen valiendo para el partido; estos son los del paso 9.

**A. El selector y la selección (criterios 14, 15, 17; G9-4, G9-5)**
1. Al cargar aparece **ELIGE MODO** con los cuatro modos (AMISTOSO, AMISTOSO A DOS, ENTRENAMIENTO, MUNDIAL); arriba/abajo (flechas o W/S) mueven, **J** confirma. La página dice `SELECTOR` en Estado.
2. **ELIGE TU SELECCIÓN**: rejilla 4 × 4 de las dieciséis con su camiseta; cruceta mueve (con vuelta por los bordes), J confirma; **1/2/3** cambia la alineación en la fila de abajo (NORMAL por defecto) y se ve resaltada. Apuntar: ¿se leen los nombres largos (PAÍSES BAJOS, ESTADOS UNIDOS) en la tarjeta de 172 px?
3. En AMISTOSO y ENTRENAMIENTO el rival **se sortea** (no se elige) y es distinto en dos partidas seguidas; en el MUNDIAL se sortean siete y tú estás entre los ocho del **SORTEO DEL MUNDIAL** (con `TÚ`).

**B. Amistoso a dos (criterio 14; G9-2) — con dos personas**
4. Mode AMISTOSO A DOS: la pantalla de selección dice **JUGADOR 1 (WASD)**; J1 elige con WASD y confirma con **C**; luego **JUGADOR 2 (FLECHAS)**, que elige con las flechas y confirma con **J**; J2 **no puede** elegir la misma selección que J1 (la tarjeta lleva `J1` y no se confirma). J2 cambia SU alineación con **7/8/9**.
5. En el partido: **WASD no mueve al equipo de la derecha y las flechas no mueven al de la izquierda**; J1 chuta con C, pasa con V, esprinta con B; J2 con J/K/L. Los dos cursores se ven (uno por equipo), las dos tiras de alineación/estrategia (izquierda J1, derecha J2) y las dos barras de sprint. J1 cambia estrategia con 4/5/6 y J2 con **0 ' ¡**.
6. **Ghosting**: los dos a la vez —J1 W+D+C y J2 ↑+→+J— ¿se pierde alguna tecla? Apuntar el modelo de teclado. Si se pierde, es hardware: anotar qué combinación y se decide si se cambian teclas en la v1.5 (spec, «Teclado alternativo seleccionable»).
7. Gana quien gane: **GANADOR** con confeti nombra a la selección que ganó (la de J2 si ganó J2), los cánticos suenan **bajos**, y **J** (CONTINUAR) los **corta en seco** y vuelve a ELIGE MODO. No hay pantalla de derrota: el que pierde no ve ELIMINADO en el modo a dos.

**C. Entrenamiento (G9-1)**
8. El HUD dice **ENTRENAMIENTO** donde iba la parte, el reloj se queda en `0:00`, y **R PARA SALIR** bajo el marcador. Los siete de campo rivales **no se mueven** (están de pie en su formación); su **portero sí** se mueve, sale a un balón suelto en su área pequeña y ataja chuts.
9. Un pase largo que cae junto a una estatua **no se le queda pegado**: el balón queda suelto a su lado y lo recoges al llegar (o lo robas con K si te apetece). Un gol tuyo: rótulo GOL, celebración, y a los 5 s **saca la estatua sola** (S-FL1): ¿molestan esos 5 s, o vale? (si molestan, M13).
10. **R** vuelve a ELIGE MODO **sin** rótulo; **P** pausa igual que en un partido. ¿Sirve para aprender pase corto, pase largo y chut, que era el motivo del modo?

**D. Mundial (criterios 15, 16, 17, 18, 19; G9-3, G9-6, G9-7, G9-8)**
11. **CUADRO · CUARTOS DE FINAL**: cuatro filas de cruces con tu fila en amarillo y `TÚ`; abajo `PRÓXIMO: X VS Y` con **VER / SALTAR** (izq/der cambia el recuadro, J confirma).
12. **SALTAR**: la fila pasa a `X 2 - 1 Y` **al instante** (~50 ms). **VER**: el partido se juega en pantalla **a x4** sin cursor ni tiras de alineación, con la pancarta `PARTIDO DE LA CPU · X4 · A (J) SALTA AL RESULTADO`; **J** a mitad lo corta y el cuadro muestra el resultado. **Comprobar la propiedad G9-3:** con la prop `seed` fijada en la página (añadir temporalmente `seed={12345}` al `<VaultWorldCupGame>`), VER entero, SALTAR y VER-cortado-a-mitad del mismo cruce deben dar **el mismo marcador** las tres veces (reiniciar con AL SELECTOR entre pruebas). ¿x4 se ve bien o va a tirones? (ajustable: `SPECTATE_SPEED`).
13. Resueltos los tres, `TU PARTIDO: X VS Y · A (J) PARA JUGAR`. Tu partido: dificultad **4** (¿se nota más blanda que el amistoso de 5?); si estás **a la derecha del cruce**, tu nombre va a la derecha del marcador con la barra amarilla debajo y **en la tanda saca primero el otro** (S-PK3). Ganar → FINAL (3 s) → cuadro de **SEMIFINAL** (dos filas, `ELIMINADOS: …` abajo) → dificultad 6 → final a **8**.
14. Perder en cualquier ronda: **FINAL + ELIMINADO** como rótulos (3 s cada uno) y vuelta a ELIGE MODO; la página muestra `ELIMINADO · N PTS` con los puntos de las rondas ganadas (0 si caes en cuartos sin marcar; 1 000 por gol tuyo aunque pierdas; 2 000 si el rival no te marcó). **R** en la página reinicia.
15. Ganar la final: FINAL (3 s, **sin** GANADOR) → **CAMPEONES DEL MUNDO** con fuegos artificiales y cánticos a volumen normal; el nombre y la camiseta de tu selección con la copa; la página `CAMPEONES · N PTS` (~61 000 + 1 000 por gol). **J** corta los cánticos y vuelve al selector.
16. **Viewport en el Mundial** (G9-8): durante TU partido de semifinales (ganados los cuartos), reducir la ventana por debajo de 768 × 560: el partido se para, panel AGRANDA LA VENTANA, rótulos FINAL + ELIMINADO (o EMPATE si iba empate — pero el resultado del Mundial es **ELIMINADO igualmente**), y la página dice `ELIMINADO · N PTS` con los puntos de cuartos. Agrandar la ventana: el panel se va y estás en ELIGE MODO (S-FL5: hay vuelta atrás). Repetir **durante un cruce VER**: el cruce se resuelve solo y el cuadro sigue (no hay ELIMINADO).
17. Ningún amistoso ni entrenamiento cambia el Estado de la página a `ELIMINADO`/`CAMPEONES`: solo el Mundial reporta (criterio 19).

**E. Rendimiento y sonido (criterio 20; tabla de audio)**
18. Pantalla de victoria un minuto: **60 fps** con el confeti y con los fuegos (panel de rendimiento del navegador; el pool son 240 cuadrados). Si baja, `PARTICLE_COUNT` es la primera palanca.
19. Ningún silbato ni GANADOR suena **encima** de los cánticos: FINAL pita, pasan sus 3 s, y entonces empiezan los cánticos con la pantalla (S-FL3).
20. Sin sonido de menú todavía (paso 10): correcto que los selectores estén mudos.

- [ ] **C8: Ledger, handoff y snapshots**

En `.superpowers/sdd/2026-09-09-vault-world-cup-step-9/`: `progress.md` con el cierre (`Cierre: 1157/1157 en 68 ficheros; tsc/eslint/build limpios; C2-C4 verdes; sondas P1-P5 en probes/*.txt; QA de Paco pendiente (C7)`), los briefs y reviews de cada tarea, y `probes/*.txt`. **Ningún `.ts` en esa carpeta** (vitest lo cogería). Actualizar `tasks/vault-world-cup/HANDOFF-next-session.md` con: paso 9 cerrado, S-FL1..S-FL9 pendientes de QA, M11-M13, y el siguiente = paso 10 (registro, migración, play-page definitiva espejo de Vault Fighter con `GameOverModal` + `saveScore` sobre `onGameOver`/`onVictory`, música de menú en `mode-select`/`team-select`/`draw`/`bracket`/`victory` y de gameplay en `match`/`spectate` vía `setTrackOverride`, `MobileGamepad` fuera —solo desktop—, slug `vault-futbol` vs `vault-world-cup`).

- [ ] **C9: Proponer el commit de cierre (si Paco no ha ido commiteando tarea a tarea)**

No ejecutar. Un solo commit con todo el paso 9, mensaje:

`feat(world-cup): step 9 — four modes, two-player keyboard, World Cup draw/bracket/scoring with simulated CPU ties, victory screens with confetti and fireworks`

---

## Supuestos de esta etapa (S-FL)

Todos van **etiquetados en el código** como `// Step 9 assumption S-FLn, not in the spec — review in QA` (o en el comentario que ya los nombra) y **todos se fijan con un test**, salvo S-FL7 que es una regla de ficheros. Ninguno relitiga G9-1..G9-9.

| # | Supuesto elegido | Alternativa descartada |
|---|---|---|
| **S-FL1** | **Saque de centro tras un gol del humano en entrenamiento: el automático a los 5 s que ya existe.** `endGoalPause` da el saque al equipo que encajó (el congelado), `beginSetPiece` le pone un lanzador y `stepSetPiece` ejecuta el pase corto solo. Cero código nuevo. Test en `match.test.ts` («after a goal in training the frozen team kicks off automatically…»). | Que saque siempre el humano (una línea en `endGoalPause`, M13). Descartado hoy: añade una regla al motor para un caso que el automático ya resuelve; si los 5 s molestan en el QA, M13. |
| **S-FL2** | **Los siete congelados no recogen balones sueltos**, aplicado en `match.ts` (`dropFrozenPickup`, justo tras `stepPhysics`) sin tocar `ball.ts`: el balón queda en reposo a `CONTROL_DIST` (18 u) del pie de la estatua y el humano lo recoge al acercarse (o lo roba con K). El portero congelado sí recoge y ataja. Test («a frozen outfield player never ends a step holding the ball…», con el caso de control). | (a) Que las estatuas recojan y el humano robe (cero código): descartado porque convierte el drill de pases en un drill de robos. (b) `canPickUp` con reglas (M11): más limpio, pero toca `ball.ts`. (c) Marcarlos «tumbados» (`downUntilStep`): se dibujarían tumbados y `nearestOutfield` podría no encontrar lanzador. |
| **S-FL3** | **Con pantalla de victoria propia, `collectCaptions` NO encola GANADOR** (informe §8.5): FINAL suena y se ve 3 s, la cola se vacía y el flujo pasa a `'victory'`; los cánticos empiezan entonces, así que nunca coinciden con un silbato. ELIMINADO y EMPATE siguen siendo rótulos y vuelven al selector al vaciarse (spec 60-61). Tests en `captions.test.ts` (bloque «by HumanSide»). | Esperar los 3 s del rótulo GANADOR y entonces la pantalla: dos veces la misma palabra, y el cántico se pisaría con el final del rótulo. |
| **S-FL4** | **El entrenamiento se sale con R** (G9-1 literal), manejada por el componente **solo cuando el partido no tiene reloj** (`flowExitMatch` lee `modeRules(m).timed`), sin rótulo ni CONTINUAR propio. Test en `flow.test.ts` («R exits the training match…»). | Un CONTINUAR propio a los N goles: inventa un final que G9-1 no pide. |
| **S-FL5** | **Un cruce de la CPU visto (spectate) que el guard de viewport interrumpe se termina headless y se registra**; G9-8 (ELIMINADO) solo se aplica al partido del humano. Y **tras el guard hay vuelta atrás** (Minor 5 del paso 8): al agrandar la ventana, `blocked` se levanta si el flujo está en una pantalla de menú; un partido abandonado no se reanuda nunca. Verificación: QA C7-16. | Abandonar el cruce (`winnerOf === -1`) y tratarlo como ELIMINADO: castiga al humano por un partido que no jugaba, y deja el cuadro sin ganador de ese par. |
| **S-FL6** | **La R de la página (reinicio por remonte) solo actúa tras `onGameOver`/`onVictory`**, es decir solo tras un Mundial; en los amistosos el flujo vuelve solo al selector y el botón AL SELECTOR remonta cuando se quiera. `isTypingTarget` y `preventDefault` en el listener (Minor 10). | R de la página siempre activa: mataría un Mundial a medias con una tecla que el entrenamiento usa para salir. |
| **S-FL7** | **`mode.ts` y `world-cup.ts` nacen en `components/games/football-logic/`, como manda el spec §Modelo de datos**, aunque el motor esté congelado: son ficheros NUEVOS que solo leen del motor, `git diff --stat <commit>` no los lista, y la verificación de cada tarea distingue `M` (solo `match.ts` + test, Task 9-1) de `??` (los cuatro nuevos). El arnés `match-run.ts`, que no es regla del juego, va en `football-screen/`. | Una carpeta hermana `football-modes/`: contradice el spec y separa el cuadro de `winnerOf`, su único lector del motor. |
| **S-FL8** | **Los ocho del sorteo se barajan dos veces**: se sortean siete de los quince y luego se baraja el conjunto con el humano dentro, de modo que **el lado del humano en su cruce (y con él quién saca primero en una tanda, S-PK3) también se sortea**. Test («the draw puts the human on either side of his pair»). | Humano siempre en el slot 0 (siempre saca primero): la ventaja medida en la B2 (42/58 al segundo lanzador) está dentro del ruido, pero regalarla siempre al mismo lado no es «el que figure primero en el cruce». |
| **S-FL9** | **Las pantallas de menú se navegan con la tabla SOLO** (flechas o WASD + J), y en la selección del modo a dos cada jugador elige con SU tabla (J1 WASD + C, J2 flechas + J). El cuadro y la victoria responden a J (y a la tecla A de cualquiera de las dos tablas no: solo SOLO). **El cuadro muestra los cruces de la ronda actual** (4/2/1 filas) más la lista `ELIMINADOS: …`, no las ocho filas fijas del sorteo como en Vault Fighter: con resultados por cruce, la vista por ronda se lee mejor en 500 px. | Menús con las dos tablas a la vez (cualquiera confirma): en la selección a dos, J1 podría confirmar por J2. |

**Dos cosas que el paso 9 NO decide y el 10 sí:** el slug definitivo del juego, y la música de menú/previa y de gameplay (tabla de audio: selector de modo y de selección, sorteo, cuadro, pausa → `theme-pre-game-lobby`; partido y spectate → `theme-game-play`), que se engancha por `flow.phase` desde la play-page definitiva con `setTrackOverride`.

---

## Self-Review

**1. Cobertura del spec (§Etapa C punto 9, G9-1..G9-9, criterios 14-21 y 23, informe §8 y Minors).**

| Requisito | Dónde |
|---|---|
| Punto 9: `mode.ts` | Task 9-4 |
| Punto 9: `world-cup.ts` | Task 9-3 |
| Punto 9: selector de modo | Task 9-5 (`flowMoveMode`/`flowConfirmMode`, `MODE_LIST`), 9-7 (`drawModeSelect`) |
| Punto 9: selector de selección | 9-5 (`flowMoveTeam`/`flowConfirmTeam`), 9-7 (`drawTeamSelect`) |
| Punto 9: segundo teclado del amistoso a dos | 9-2 (tablas), 9-7 (dos pads, `handleKeyDown` por tabla) |
| Punto 9: sorteo del Mundial | 9-3 (`drawEight`/`createWorldCup`), 9-7 (`drawDraw`) |
| Punto 9: cuadro con pantalla al inicio de cada partido | 9-3 (estado), 9-5 (`flowConfirmBracket`), 9-7 (`refreshBracketView`/`drawBracket`; se vuelve al cuadro tras cada ronda ganada) |
| Punto 9: pantalla de victoria con confeti (amistoso) y fuegos (Mundial) | 9-6 (`particles.ts`), 9-4 (`modeFxKind`), 9-7 (`drawVictory`/`startVictory`) |
| G9-1 entrenamiento (sin reloj, rival congelado, portero vivo, un humano, sin prórroga ni tanda, R sale, flag apagado) | 9-1 (motor + tests), 9-4 (`modeRules` → `TRAINING_RULES`), 9-5 (`flowExitMatch`, S-FL4), 9-7 (R en `'match'`); sin prórroga/tanda porque `advanceClock` es no-op y `endHalf` nunca dispara (test «with the clock off, 10 000 steps…») |
| G9-2 reparto de teclas exacto, WASD no mueve a J2 ni flechas a J1, solitario y Mundial sin cambio | 9-2 (`TWO_PLAYER_P1`/`P2`, tests «in the two-player mode WASD no longer…», «the solo table IS the step-8 map») |
| G9-3 cruces simulados de verdad, VER/SALTAR, x4, tecla para saltar, misma semilla → mismo resultado | 9-3 (`match-run.ts` + test «watched for 3 000 steps…»), 9-2 (`SPECTATE_SPEED`), 9-5 (`flowConfirmBracket`/`flowSkipSpectate`), 9-7 (`startCpuPair`/`skipCpuPair`/`skipSpectate`), sonda P5, QA C7-12 |
| G9-4 selector: rival sorteado / J1 luego J2 sin repetir / 7 de 15 / no se elige rival | 9-4 (`drawRival`), 9-5 (`flowConfirmTeam` 'refused', `flowBuildMode`), 9-3 (`drawEight`) |
| G9-5 formación en la selección, tres, 3-3-2 por defecto, una por humano | 9-5 (`flowSetFormation`, `formation: [0, 0]`), 9-7 (`padChoice` en `team-select`, `fillRunFormations`, `drawTeamSelect`) |
| G9-6 dificultad fija 5 / 4-6-8 | 9-3 (`ROUND_DIFFICULTY`), 9-4 (`FRIENDLY_DIFFICULTY`, `modeDifficulty`), sin selector en ninguna pantalla |
| G9-7 una semilla por partida, `Date.now()` único, todo derivado | 9-7 (`confirmTeam`, `grep -c "Date.now()"` = 1), 9-3 (`matchSeedFor`), 9-4 (`drawSeedFor`), 9-6 (`fxSeedFor`), C3 |
| G9-8 abandono en cruce del Mundial = ELIMINADO con los puntos hasta ahí | 9-3 (`abandonHumanMatch` + test), 9-4 (`modeAbandonMatch`), 9-5 (`flowMatchOver(…, true)`), 9-7 (`handleResize` → `endHumanMatch(true)` → `onGameOver`) |
| G9-9 flujo en el componente, un canvas y un bucle, máquina en `flow.ts` | 9-5 (`flow.ts` con 18 tests), 9-7 (`draw()` por fase, `update()` por fase) |
| Criterio 14 (a dos, sin ventaja) | mismo motor, mismos perfiles humanos (`createMatchRun` da `humanProfile` a los dos); QA C7-5 |
| Criterio 15 (8 de 16, tres partidos, cuadro al inicio) | 9-3 tests «three exact wins…», `sizes [8, 4, 2]` |
| Criterio 16 (ELIMINADO sin CONTINUE) | 9-5 (`after = 'mode-select'`), captions (`'eliminated'`), ningún `'continue'` en `ModeStatus` |
| Criterio 17 (GANADOR confeti / CAMPEONES fuegos / CONTINUAR → selector) | 9-4 (`modeVictoryTitle`, `modeFxKind`), 9-7 (`continueFromVictory`), 9-5 (`flowContinue`) |
| Criterio 18 (4/6/8 y 5) | 9-3, 9-4, test «difficulty 4 -> 6 -> 8» |
| Criterio 19 (solo el Mundial puntúa) | 9-4 (`modeScores`), 9-7 (callbacks condicionados), QA C7-17 |
| Criterio 20 (cero asignaciones por frame, confeti incluido) | 9-6 (pool + test de identidad de arrays), 9-7 (vistas por evento, cadenas construidas en `refresh*`) |
| Criterio 21 (suite no baja; umbral real 1050) | C1 |
| Criterio 23 (la tanda termina) | 9-3 test «seven seeds never hit the cap», sonda P5 |
| Tabla de audio: `chants-victory` con fuegos / bajo con confeti | 9-6 (`'chants_victory'`, `victoryChantGain`), 9-7 (`startVictory`) |
| Informe §8.1 (`winnerOf === -1` como caso vivo del cuadro) | 9-3 (`abandonHumanMatch`), 9-4 (`modeEndMatch` con `-1`), 9-5 (`flowRecordCpuResult` lanza en `-1`: un cruce de la CPU no puede quedar indeciso, S-FL5) |
| §8.2 (segundo `PadState`, tablas derivadas de `KEY_BINDINGS`) | 9-2 (`pickBindings`), 9-7 (`pads[2]`) |
| §8.3 (atribución al lanzador anterior) | **No aplica**: ninguna pantalla nombra al lanzador. Anotado. |
| §8.4 (`chants-victory` en el tipo) | 9-6 |
| §8.5 (las pantallas sustituyen a GANADOR) | S-FL3, 9-5 |
| §8.6 (`homeTeamId`/`awayTeamId` dejan de ser props inertes) | 9-7: las props **desaparecen** y el selector manda; `teamOrDefault` se sustituye por `teamOf` |
| Minor 5 (sin vuelta tras el guard) | S-FL5, 9-7 `handleResize` |
| Minor 7 (asignación muerta `inputs[CPU_TEAM].formation`) | 9-3 `createMatchRun` escribe `inputs[t].formation` para los dos con sentido (el humano lo repite desde el pad; la CPU lo sobrescribe desde `match.formationIndex`); la línea muerta desaparece con el bloque de montaje |
| Minor 8 (exports huérfanos de `keyboard.ts`) | 9-2 (consumidos por las tablas) |
| Minor 10 (P/R sin `isTypingTarget`) | 9-7 play-page |
| Riesgo 6 (dos entradas humanas sin pisarse) | 9-2 (`tablesShareKey` + test), sonda P4 |
| Riesgo 7 (fixtures coincidentes) | «para toda selección» en 9-3/9-4, tres semillas, dos tablas, caso de control en 9-1, corte a mitad y entero en 9-3 |

**Lo que el plan deja explícitamente fuera y por qué:** registro, migración, música, carátula, `GameOverModal`/`saveScore`, `MobileGamepad` y slug (paso 10); dibujo del jugador y portero que se tira (paso 11); esquemas visuales de formación y teclado alternativo seleccionable (v1.5); octavos (v1.5).

**2. Barrido de placeholders.** Ni «TBD», ni «implementar después», ni «añadir validación». Los tests van escritos enteros. Los tres sitios donde el plan dice «copiar del paso 8» son deliberados y precisos: los puntos 1-5 y 8 de `runStep` (líneas 296-351 y 377-380 del fichero actual, sin cambio de lógica, solo `match` → `run.match`), el bloque del marcador de la tanda de `drawHud` (720-744, con `HOME`/`AWAY`) y las cuatro funciones de dibujo que solo cambian `match` por `run.match`. Las dos únicas instrucciones condicionales («si `matchSeedFor` colisiona, cambiar `PAIR_SEED_SALT` por `0x27d4eb2f`»; «si una estatua se movió por un saque, bajar a 600 pasos») nombran el valor exacto que poner y por qué. La Task 9-7 no tiene test unitario **por la misma razón medida del paso 8** (sin `vitest.config` ni DOM); su verificación es `tsc` + eslint + build + los greps de C3/C4 + la lista de QA de C7 + las sondas P1-P5 que ejercitan todo el flujo sin canvas.

**3. Consistencia de tipos y nombres, comprobada tarea contra tarea:**
- `createMatch(teams, formationTable, pitch, profiles, rules = NORMAL_RULES)` (9-1) es lo que llama `createMatchRun` (9-3) y `finished()` en los tres tests que lo usan sin `rules` (9-3, 9-4, 9-5). `TRAINING_RULES` es `{ timed: false, frozenTeam: 1 }` en 9-1, 9-3 (test «passes the rules through»), 9-4 (`modeRules`).
- `padKeyFor(table, key)` / `padChoice(pad, table, key)` (9-2) son las firmas de `handleKeyDown` (9-7) y del parche provisional de 9-2 Step 8. `TWO_PLAYER_TABLES: readonly [KeyTable, KeyTable]` indexado por equipo, igual en 9-2 y 9-7.
- `planSteps(acc, out, speed = 1)` y `planFrame(…, out, speed = 1)` (9-2): `update()` de 9-7 pasa `speed` como octavo argumento; `SPECTATE_SPEED` vive en `loop.ts` e importa de ahí el componente.
- `WorldCupState` (9-3) con `humanId, seed, round, status, score, bracket, entrants, pairWinner, resolved, results, resultCount`: `refreshBracketView` (9-7) lee `seed`, `round`, `resolved`, `results`, `resultCount`, `bracket`, `humanId`; `mode.test.ts` (9-4) lee `bracket`, `seed`; `flow.test.ts` (9-5) lee `entrants`, `seed`.
- `HumanSide = 0 | 1 | 'both' | 'none'` definido en `mode.ts` (9-4), consumido por `captions.ts` (9-5) y el componente (9-7); `sideIsHuman(side, team)` en los tres.
- `FxKind` definido en `mode.ts` (9-4), no en `particles.ts`: `particles.ts` (9-6) y `sfx-map.ts` (9-6) lo importan de `../football-logic/mode`; `modeFxKind` (9-4) lo devuelve. **Corregido en la cabecera durante esta revisión** (el primer borrador lo situaba en `particles.ts`, que habría hecho importar a `football-logic` desde `football-screen`).
- `modeEndMatch(m, match)` / `modeAbandonMatch(m, match)` (9-4) son lo que `flowMatchOver(f, m, match, abandoned)` (9-5) llama; `modeVictoryTeamId(m, match)` es lo que `startVictory` (9-7) usa.
- `flowConfirmTeam` devuelve `'next' | 'done' | 'refused'` (9-5) y `confirmTeam` (9-7) solo construye el modo en `'done'`. `flowConfirmBracket` devuelve `BracketAction | 'none'` (9-5) y `confirmBracket` (9-7) trata los tres valores y deja `'none'` inerte. `flowMatchOver` exige `phase === 'match'`: el `runStep` de 9-7 desvía el spectate a `flowSpectateOver` antes de llamarla.
- `collectCaptions(match, w, human, cs, victoryScreen = false)` (9-5): el `runStep` de 9-7 pasa `victoryScreen`; el guard pasa `false` (S-SC12); los tests de 8-3 siguen llamando con cuatro argumentos.
- `createMatchRun(home, away, seed, difficulty, human, rules, formations)` (9-3): siete argumentos en el mismo orden en `startMatch` (9-7), en el placeholder de montaje (9-7) y en la sonda P1.
- `play(name, gain = 1)` y `stop(name)` (9-6): `startVictory` y `continueFromVictory` (9-7); `victoryChantGain(kind)` (9-6) toma un `FxKind`.
- Nombres de UI iguales entre `MODE_NAMES` (9-5), los tests de 9-5 y la lista de QA (C7): AMISTOSO, AMISTOSO A DOS, ENTRENAMIENTO, MUNDIAL; `ROUND_LABELS` (9-3): CUARTOS DE FINAL, SEMIFINAL, FINAL; títulos GANADOR / CAMPEONES DEL MUNDO (9-4) y ENTRENAMIENTO en el HUD (9-1).

**4. Inconsistencias propias encontradas y corregidas al revisar:**
- El test de `flowMoveTeam` «past the bank» usaba el cursor 13 sobre un banco de 14, que **sí** tiene sitio al bajar (vuelve a la fila 0, casilla 1): corregido a cursor 10 (bajar caería en la 14, inexistente) con el caso de control desde 9.
- El helper `over()` de los tests de `captions.ts` ponía el marcador DESPUÉS de `updateWatch`, así que `collectCaptions` habría encolado GOL antes de FINAL: corregido (los goles se «ven» antes de forzar `'over'`).
- `FxKind` movido de `particles.ts` a `mode.ts` (arriba).
- `matchSeedFor` firmado con `(seed, round, pair)` en el contrato y en 9-3, y **así lo llama `startCpuPair`** en 9-7 (`matchSeedFor(wc.seed, wc.round, pair)`); la sonda P1 deriva su propia semilla a propósito y lo dice.

**5. Orden y prescindibilidad.** 9-1 → 9-2 → 9-3 → 9-4 → 9-5 → 9-6 → 9-7 es el único orden que respeta los imports (9-5 importa de 9-4 y 9-3; 9-6 de 9-4; 9-7 de todo). **La Task 9-1 no es prescindible**: `createMatchRun` (9-3) pasa `rules` como quinto argumento de `createMatch`, `mode.ts` (9-4) importa `NORMAL_RULES`/`TRAINING_RULES`, `hud.ts` lee `match.rules.timed` y `flow.ts` (9-5) lee `modeRules(m).timed` — sin 9-1 nada de eso compila. Lo prescindible es el MODO (preflight, lista cerrada al principio de la Task 9-5). Si el entrenamiento se difiere al paso 11: se ejecuta 9-1 igual (barata y sin efecto con el flag apagado), y en 9-5 se quita `'training'` de `MODE_LIST` (y de `HUMANS_BY_MODE`/`MODE_NAMES`/`MODE_BLURBS` se deja, porque `GameModeKind` lo sigue teniendo), marcando `.skip` los dos tests que lo nombran (`start('training', …)` en «flowBuildMode» y «R exits the training match»), y en 9-7 nada cambia. Si es el modo a dos lo que se difiere (menos probable): 9-2 se ejecuta igual (las tablas no molestan) y se quita `'friendly-2p'` de `MODE_LIST` de la misma manera.
