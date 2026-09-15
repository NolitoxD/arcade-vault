# Vault World Cup — Etapa D, paso 10 (cierre: registro, audio, viewport, play-page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el paso 10 del spec — el último de la Etapa D — dando de alta `vault-world-cup` como el juego nº 14 del catálogo (tipos, migración, test), cableando el audio que falta (pase corto, público solo con reloj), resolviendo el gap de fase que el paso 9 dejó abierto (`onPhaseChange`, para que la música sepa cuándo es menú y cuándo es partido), añadiendo el bloqueo real por viewport (redirect en partida, JUGAR deshabilitado en el catálogo) y reescribiendo `app/games/vault-world-cup/play/page.tsx` como la página definitiva — espejo de la de Vault Fighter, sin `MobileGamepad` ni selector de skin, con `GameOverModal` + `saveScore` disparados solo por el Mundial.

**Architecture:** Todo lo que se pueda razonar sin canvas sigue siendo una función pura con test, igual que en el paso 9: `modeHasCrowd(mode)` en `football-logic/mode.ts` (única grieta autorizada en el motor congelado), `phaseGroup(phase)` en `football-screen/flow.ts`, `shortPassFiredThisStep(match)` en `football-screen/sfx-map.ts`, `isDesktopOnlyBlocked(gameId, w, h)` en un módulo nuevo sin DOM. El componente (`VaultWorldCupGame.tsx`) solo gana dos props (`onPhaseChange`, `onViewportBlocked`) y tres sitios de cableado (el gate del ambiente, el reporte de fase por frame comparando con el último valor emitido — igual que `reportHud` ya hace con el marcador —, y una llamada en el borde de `blocked`); no gana ninguna regla nueva. La página se reescribe entera sobre el patrón de `vault-fighter/play/page.tsx`, con el `<Suspense>` de `useSearchParams` del paso 9 conservado porque el build estático depende de él. El catálogo (`GamesGrid.tsx`) es el único fichero fuera de `components/games/` que toca este paso: un `useEffect` con `resize` más una función pura testeada, sin columna nueva en Supabase (G10-5: un juego no justifica schema).

**Tech Stack:** TypeScript estricto, React 19.2.4, Next 16.2.6 (App Router, `dynamic(..., { ssr: false })`), canvas 2D 800 × 500, vitest 4.1.11 (tests `*.test.ts` junto al código, **sin `vitest.config`**, entorno Node sin DOM), audio por fichero con `HTMLAudioElement` (`lib/sfx-vault-world-cup.ts`) y `MusicContext` (`HTMLAudioElement` con `setTrackOverride`), Supabase (`@supabase/ssr`) para el catálogo y la tabla de puntuaciones.

**Spec:** `specs/31-vault-world-cup.md` (Approved) — §Alcance (solo desktop con bloqueo por viewport, registro/migración/play-page/carátula/puntuación), §Decisiones estructurales (solo el Mundial puntúa, tabla de puntos), §Etapa D punto 10 (registro + tabla de audio completa), criterios de aceptación 19-23, y en §Decisiones los bullets «Primer QA jugado del paso 8», «QA jugado del paso 9 (Paco, 2026-09-11)» y **«Grill corto del paso 10 (2026-09-14)» con G10-1..G10-10, que son ley** y no se reabren en este plan.
**Informes obligatorios:** `.superpowers/sdd/2026-09-14-vault-world-cup-step-10/design-brief.md` entero (116 líneas: patrón Vault Fighter con líneas exactas, contrato real del componente §4, tabla de audio con lo ya cableado §5, preguntas de diseño ya resueltas por G10-1..10 §6, riesgos §7).
**Código a imitar:** `lib/games-registry.ts` (`GameId` 4-17, entrada `vault-fighter` 374-412, `GAMES`/`GAME_IDS`/`getGame`/`getKeyMap`/`isGameId` 415-431) · `lib/games-registry.test.ts` (fichero entero, 110 líneas) · `supabase/migrations/20260901174242_add_vault_fighter_game.sql` (9 líneas) · `app/games/vault-fighter/play/page.tsx` (fichero entero, 320 líneas: `dynamic` 14-17, `setTrackOverride` en efecto con cleanup 101-108, `handleGameOver`/`handleVictory` 136-149, `GameOverModal` 320-339, ausencia deliberada de `MobileGamepad` para este juego) · `app/games/GamesGrid.tsx` (fichero entero, 141 líneas: `GameCard` 8-66, fila `JUGAR` 58-64) · `app/context/MusicContext.tsx` (fichero entero, 102 líneas: `setTrackOverride` 78-90, el gate de gesto 34-47) · `lib/sfx-vault-fighter.ts` (contrato de clase: `init`/`play`/`setMuted`/`dispose`, no se modifica) · `components/games/football-screen/viewport-guard.ts` (fichero entero, 17 líneas: `MIN_VIEWPORT_W/H` y `viewportAllowed` **ya exportados**, no hace falta tocarlo).
**Código a modificar:** `components/games/VaultWorldCupGame.tsx` (props 63-70, refs 230-237, sync-effect 250-256, `reportStatus` 341-344, `startMatch`/ambiencia inicial 395, gate de ambiente 638-647, `loop`/`draw` 1382-1394, `handleResize`/`blocked` 1558-1568, inicio del bucle 1592-1598) · `app/games/vault-world-cup/play/page.tsx` (reescritura completa, 157 líneas hoy, PROVISIONAL) · `lib/sfx-vault-world-cup.ts` (`VaultWorldCupSfx`, `RAW_FILES`, `SFX_VOLUME`) · `components/games/football-screen/sfx-map.ts` (tras `shotFiredThisStep`, línea 101) · `components/games/football-logic/mode.ts` (tras `modeRules`, línea 101 — **única excepción autorizada al motor congelado en `c5d1e52`**) · `components/games/football-screen/flow.ts` (tras el tipo `FlowPhase`, línea 22) · `app/games/GamesGrid.tsx` (estado de viewport + `GameCard`).
**Ledger de este paso:** `.superpowers/sdd/2026-09-14-vault-world-cup-step-10/progress.md` (crear en la Task 10-1; briefs, reviews y snapshots `.txt` van a la misma carpeta).

---

## Global Constraints

Heredadas del plan del paso 9 (`docs/superpowers/plans/2026-09-09-vault-world-cup-step-9.md`), actualizadas con la baseline y las reglas del paso 10. **Los requisitos de cada tarea incluyen implícitamente esta sección.**

- **Commits: SOLO Paco.** Ninguna tarea ejecuta `git add` ni `git commit`. Cada tarea termina dejando el working tree **verificado** y **propone el mensaje de commit exacto** en un paso «Proponer commit». Rama `main`. HEAD de hoy: `a7a9fdf` (sobre `c5d1e52`, motor sin tocar desde entonces — confirmado con `git diff --stat c5d1e52 -- components/games/football-logic/` vacío al escribir este plan). El working tree ya trae dos cambios de Paco previos a este plan, ninguno de los dos tuyo: `specs/31-vault-world-cup.md` modificado (las decisiones G10 recién añadidas) y `public/vault-futbol-pass.mp3` sin trackear (el fichero que la Task 10-2 consume). No los toques ni los incluyas en tu propuesta de commit — Paco los comitea aparte o junto con lo tuyo, es su decisión.
- **NUNCA arrancar `next dev`.** Paco tiene el suyo en `:3000`. La verificación automática de cada tarea es `npx vitest run` + `npx tsc --noEmit`; `npm run build` además al cerrar el paso. **El QA visual lo hace Paco** con la lista que deja escrita el cierre.
- **EL MOTOR SIGUE CONGELADO EN `c5d1e52`, CON UNA ÚNICA EXCEPCIÓN: la Task 10-2 añade `modeHasCrowd` a `components/games/football-logic/mode.ts` (+ su test) y NADA MÁS** (G10-3, y el encargo de este plan lo confirma). Al cerrar cada tarea: `git diff --stat c5d1e52 -- components/games/football-logic/` debe listar **como mucho** `mode.ts` y `mode.test.ts`, y solo a partir de la Task 10-2. Si algo del motor estorba más allá de esa función, **no se arregla aquí**: va a «Peticiones separadas al motor» del cierre.
- **Baseline verificada hoy (2026-09-14, commit `a7a9fdf`, `npx vitest run` ejecutado al escribir este plan): 1171 tests en 68 ficheros verdes**, `npx tsc --noEmit` limpio, `npm run build` exit 0. El criterio 21 del spec pide **≥ 1171**: ya lo cumple: cada tarea de este plan suma y no regresa. Ningún test existente cambia de valor esperado salvo la edición mecánica explícita de `lib/games-registry.test.ts` (13 → 14) de la Task 10-1.
- **Comentarios y nombres de tests en inglés** (convención del repo). El plan, el spec y el chat, en castellano. **Los textos de UI van en castellano y en mayúsculas** (`SOLO ESCRITORIO`, `AL SELECTOR`, `SONIDO ON`/`SONIDO OFF`, `PAUSA`/`REANUDAR`, `SALIR`).
- **Ficheros en kebab-case**, salvo `VaultWorldCupGame.tsx`. Tipos en PascalCase, `SCREAMING_CASE` para constantes de módulo. TypeScript estricto: nada de `any`, nada de `!` gratuito salvo el `canvas.getContext('2d')!` ya existente, **nada de `as` para tapar un tipo** (usa `isGameId`/type guards reales).
- **Toda la lógica que se pueda razonar sin canvas vive fuera del `.tsx` con su test.** `football-logic/mode.ts` (`modeHasCrowd`), `football-screen/flow.ts` (`phaseGroup`), `football-screen/sfx-map.ts` (`shortPassFiredThisStep`), el módulo nuevo del catálogo (`isDesktopOnlyBlocked`). El `.tsx` solo contiene llamadas a `ctx.*`, lectura de refs y cableado de eventos.
- **`football-screen/` y `football-logic/` NO importan React ni tocan `document`, `window`, `canvas` ni `Audio`, y NO contienen `Math.random`.** Al cerrar cada tarea: `grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/` debe devolver **VACÍO** (tests incluidos). `Date.now()` **solo en el `.tsx`** — y ya hay exactamente uno (`confirmTeam`, G9-7); este paso no añade ninguno. Al cerrar el paso: `grep -rn "Date.now()" components/games/VaultWorldCupGame.tsx app/games/vault-world-cup/` debe devolver **exactamente una** coincidencia.
- **Sin asignación de memoria por frame** (criterio 20), ni en el bucle ni en el dibujo. El reporte de fase nuevo (`reportPhase`) sigue el patrón exacto de `reportHud`: compara con el último valor **emitido** (una variable ya existente, reescrita in place) y solo llama al callback en el borde — una comparación de strings, no una asignación de memoria. Construir un `MatchRun` sigue siendo legal (ocurre en un evento, no en un frame); esta tarea no crea ninguno nuevo.
- **El componente no reimplementa ninguna regla.** Ni de partido (motor), ni de modo (`mode.ts`), ni de fase (`flow.ts`). Regla operativa, sin excepciones nuevas: **cero `if (mode.kind === …)` en el `.tsx` ni en ninguna `page.tsx`** — `grep -n "mode\.kind\|m\.kind\|kind === '\(friendly\|training\|world\)" components/games/VaultWorldCupGame.tsx app/games/vault-world-cup/play/page.tsx` debe devolver vacío al cerrar cada tarea que toque esos ficheros (el patrón `kind ===` a secas sigue casando con `sp.kind === 'penalty'` de `drawSetPiece`, legal y sin cambios).
- **Todo lo exportado tiene consumidor real al cerrar el paso.** Este plan es el cierre de la Etapa D: no quedan marcas `// exported for Task 11: …` salvo que este mismo plan las escriba explícitamente para algo que de verdad se difiere (no las hay: todo lo de este paso se consume dentro de él).
- **Regla anti-coincidencia de fixtures (riesgo 7 heredado):** `modeHasCrowd` se prueba para los cuatro `GameModeKind` (no solo `training` contra un caso feliz); `phaseGroup` se prueba sobre las **ocho** fases de `FlowPhase`, no sobre una muestra; `isDesktopOnlyBlocked` se prueba con al menos un juego que NO es `vault-world-cup` para confirmar que nunca bloquea a otro juego, además de los bordes exactos de `MIN_VIEWPORT_W/H`.
- **Assets ya en el repo, verificados al escribir este plan** (no hace falta pedir nada a Paco): `public/vault-futbol-pass.mp3` (16 KB, sin trackear en git todavía) y `public/covers/vault-futbol.png` existen los dos. La migración de la Task 10-1 usa `cover: '/covers/vault-futbol.png'` sin renombrar nada (G10-1).
- **Supabase: la migración NO se aplica desde este plan.** Paco la aplica con su flujo. La tabla `public.games` (`supabase/migrations/20260730141000_create_games_and_scores.sql`) no tiene ningún `CHECK` sobre `id`, `cat` ni `color` — son `text not null` a secas — así que no hace falta alterar ningún enum de base de datos (a diferencia del paso 11 de Vault Fighter, que sí tuvo que añadir `'silver'` al *tipo TypeScript* `GameRow.color`; aquí no hace falta: `'green'`, el color elegido, ya está en la unión de `lib/supabase/types.ts:8`). La validación de la migración es de lectura: comparar su forma contra `20260901174242_add_vault_fighter_game.sql` y confirmar que el `id` coincide carácter a carácter con la entrada nueva de `GameId`.

---

## File Structure

Orden de dependencias: una fila solo importa de las de arriba y de `football-logic/`/`football-screen/` ya cerrados en el paso 9.

| Fichero | Tarea | Responsabilidad |
|---|---|---|
| `lib/games-registry.ts` (**modificado**) + `games-registry.test.ts` | 10-1 | `GameId` con `'vault-world-cup'`; entrada `GAMES['vault-world-cup']` (controles, instrucciones, `skins: CLASSIC_SKINS`, `realtime: true`); el test de «los trece» pasa a catorce. |
| `supabase/migrations/<ts>_add_vault_world_cup_game.sql` **NUEVO** | 10-1 | Fila `vault-world-cup` en `games` (`cat: 'SPORTS'`, `cover: '/covers/vault-futbol.png'`, `color: 'green'`). |
| `lib/sfx-vault-world-cup.ts` (**modificado**) + `.test.ts` | 10-2 | `'pass'` en `VaultWorldCupSfx`, `RAW_FILES.pass`, `SFX_VOLUME.pass`. |
| `components/games/football-screen/sfx-map.ts` (**modificado**) + `.test.ts` | 10-2 | `shortPassFiredThisStep(match)`, hermana de `shotFiredThisStep`. |
| `components/games/football-logic/mode.ts` (**modificado, única excepción al motor congelado**) + `.test.ts` | 10-2 | `modeHasCrowd(m)` = `modeRules(m).timed` (G10-3). |
| `components/games/football-screen/flow.ts` (**modificado**) + `.test.ts` | 10-2 | `PhaseGroup`, `phaseGroup(phase)` (G10-4: `'match'`/`'spectate'` → `'match'`, las otras seis → `'menu'`). |
| `components/games/VaultWorldCupGame.tsx` (**modificado en 4 puntos**) | 10-3 | Props `onPhaseChange`/`onViewportBlocked`; consumo de `shortPassFiredThisStep` en `runStep`; gate de `modeHasCrowd` en la reproducción del ambiente; `reportPhase()` (patrón `reportHud`) llamado en `loop` y al montar; `onViewportBlocked()` llamado una vez en el borde de `blocked` de `handleResize`. |
| `app/games/desktop-only.ts` **NUEVO** + `.test.ts` | 10-4 | `isDesktopOnlyBlocked(gameId, w, h)`: pura, sin DOM, reexporta `MIN_VIEWPORT_W/H` de `viewport-guard.ts` para que el catálogo no duplique los números. |
| `app/games/GamesGrid.tsx` (**modificado**) | 10-4 | Estado de viewport (`resize`), `GameCard` deshabilita `JUGAR` → `SOLO ESCRITORIO` solo para `vault-world-cup` bajo el umbral. |
| `app/games/vault-world-cup/play/page.tsx` (**reescritura completa**) | 10-5 | Página definitiva: HUD, `useMusic`/`setTrackOverride` por `onPhaseChange` + pausa, `GameOverModal` + `saveScore` solo desde `onGameOver`/`onVictory`, redirect 2 s tras `onViewportBlocked`, P/R con `isTypingTarget`, sin `MobileGamepad`. |
| `.superpowers/sdd/2026-09-14-vault-world-cup-step-10/progress.md` | 10-1 → cierre | Ledger SDD (progreso por tarea, deudas arrastradas). |

### Contrato entre tareas (firmas que las tareas posteriores consumen tal cual)

```ts
// lib/games-registry.ts (10-1)
export type GameId = /* … los trece … */ | 'vault-fighter' | 'vault-world-cup';
// GAMES['vault-world-cup']: skins: CLASSIC_SKINS; controls.touch = { keyMap: {} } (sin táctil: solo desktop);
// controls.keyboard: 8 filas (mover, A, B, C, 1-2-3, 4-5-6, P, R); realtime: true.

// lib/sfx-vault-world-cup.ts (10-2)
export type VaultWorldCupSfx = /* …los nueve del paso 8/9… */ | 'pass';

// components/games/football-screen/sfx-map.ts (10-2)
export function shortPassFiredThisStep(match: MatchState): boolean;   // hermana de shotFiredThisStep

// components/games/football-logic/mode.ts (10-2)
export function modeHasCrowd(m: GameMode): boolean;   // = modeRules(m).timed

// components/games/football-screen/flow.ts (10-2)
export type PhaseGroup = 'menu' | 'match';
export function phaseGroup(phase: FlowPhase): PhaseGroup;   // 'match'|'spectate' -> 'match'; el resto -> 'menu'

// components/games/VaultWorldCupGame.tsx (10-3)
interface VaultWorldCupGameProps {
  paused: boolean;
  muted?: boolean;
  seed?: number;
  onScoreChange?: (home: number, away: number) => void;
  onClockChange?: (label: string) => void;
  onStatusChange?: (label: string) => void;
  onPhaseChange?: (phase: PhaseGroup) => void;      // NUEVO (10-3)
  onGameOver?: (score: number) => void;
  onVictory?: (score: number) => void;
  onViewportBlocked?: () => void;                   // NUEVO (10-3)
}

// app/games/desktop-only.ts (10-4)
export const MIN_VIEWPORT_W: number;    // reexportado de viewport-guard.ts
export const MIN_VIEWPORT_H: number;
export function isDesktopOnlyBlocked(gameId: string, width: number, height: number): boolean;

// app/games/GamesGrid.tsx (10-4)
// GameCard gana la prop `desktopOnlyBlocked: boolean`; sin cambios en la firma exportada de GamesGrid (sigue { games: GameRow[] }).

// app/games/vault-world-cup/play/page.tsx (10-5)
// Sin exports nuevos: es una page. Consume TODO el contrato de arriba.
```

---

## Riesgos de este paso

Heredados y filtrados del brief de diseño (§7) a lo que de verdad afecta a la ejecución de este plan:

1. **Migración y `GameId` desincronizados.** Si el `id` de la fila difiere del literal añadido a `GameId`, `isGameId()` rechaza la fila real de Supabase y `getGame()`/`getKeyMap()` devuelven `undefined` en el detalle y las instrucciones — un fallo silencioso en producción, no en `tsc` ni en la suite (la migración no se ejecuta en los tests). Mitigado por la Task 10-1 Step 7 y el Cierre C4, los dos con el mismo grep de comprobación.
2. **Perder el `<Suspense>` al reescribir la play-page.** Es fácil, al copiar el patrón de Vault Fighter (que no usa `useSearchParams`), olvidar envolver el componente que sí lo usa. Sin él, `next build` no puede pre-renderizar la ruta como estática (confirmado en el paso 9, C1 del `final-review-report.md`). La Task 10-5 lo mantiene explícito y el Step 4 de esa tarea lo verifica con `npm run build`.
3. **Orden de las tareas.** La Task 10-5 tipa `saveScore({ gameId: 'vault-world-cup', … })` contra el `GameId` que solo existe desde la Task 10-1. Ejecutar las tareas fuera de orden (10-5 antes que 10-1) da un error de `tsc` explícito, no un fallo silencioso — pero conviene no sorprenderse si aparece.
4. **`setTrackOverride` sin limpiar en el desmontaje — y limpiado de más en cada cambio de fase.** `MusicContext` es un singleton de módulo (un único `<audio>` para todo el sitio); sin `return () => setTrackOverride(null);` en algún efecto, la pista de partido de este juego seguiría sonando al navegar a `/games` o a otro juego. Pero ese cleanup **no puede vivir en el mismo efecto que hace el `setTrackOverride(track)` por fase** (deps `[phase, paused, setTrackOverride]`): React ejecuta el cleanup de un efecto cada vez que CUALQUIERA de sus deps cambia, no solo al desmontar, así que cada cambio de fase o de pausa pasaría primero por `setTrackOverride(null)` (la pista por defecto del sitio) antes de fijar la correcta — dos asignaciones de `audio.src` por transición en vez de una. La Task 10-5 (Step 1) usa dos efectos separados por esto: uno que fija la pista por fase/pausa (sin cleanup: el propio `if (trackOverrideRef.current === src) return;` de `setTrackOverride` ya deduplica), y otro, con deps `[setTrackOverride]` únicamente, cuyo único cometido es el `return () => setTrackOverride(null);` al desmontar — el mismo patrón que `app/games/vault-fighter/play/page.tsx:101-108`. No fundirlos en uno en una edición posterior.
5. **`onViewportBlocked` llamado más de una vez.** Si el guard de la Task 10-3 se cablea sin el `if (blocked) return;` que ya existe justo antes, cada evento de `resize` mientras la ventana sigue pequeña dispararía otro `setTimeout` en la página, apilando redirects. El código del Step 7 de la Task 10-3 se apoya en el guard ya existente a propósito; no duplicar la comprobación dentro de la página.
6. **`isDesktopOnlyBlocked` bloqueando el juego equivocado.** Un `Set` con un solo elemento es fácil de teclear mal (`'vault-world-cup'` vs `'vault_world_cup'` vs `'world-cup'`). El test de la Task 10-4 prueba explícitamente que otros juegos NO se bloquean, precisamente para atrapar este error de tecleo si el literal fuera otra cadena que también fallara `isGameId`.

---

## Task 10-1: Registro, migración y test del catálogo (G10-1, G10-10)

**Files:**
- Modify: `lib/games-registry.ts` (`GameId` líneas 4-17; `GAMES`, añadir la entrada tras `vault-fighter`, línea 411-412)
- Modify: `lib/games-registry.test.ts` (test `'has exactly the 13 implemented games'` línea 6-13; test `'flags the realtime games'` línea 65-69)
- Create: `supabase/migrations/20260914103000_add_vault_world_cup_game.sql`

**Interfaces:**
- Consumes: `KeyMap` (`components/MobileGamepad.tsx`), `SkinTier` (`lib/credits.ts`) — sin cambios, ya importados en `games-registry.ts`.
- Produces:

```ts
export type GameId = /* … los trece … */ | 'vault-fighter' | 'vault-world-cup';
// GAMES['vault-world-cup']: id, skins: CLASSIC_SKINS, controls (keyboard de 8 filas, touch: { keyMap: {} }),
// instructions (goal + 5 tips), realtime: true.
```

- [ ] **Step 1: Escribir la edición mecánica del test del registro (falla primero)**

`lib/games-registry.test.ts`, sustituir el primer test del `describe('games registry', …)` (líneas 6-13):

```ts
  it('has exactly the 14 implemented games', () => {
    expect(GAME_IDS.sort()).toEqual([
      'arkanoid', 'asteroids', 'bubble', 'frogger', 'karate-champ', 'kong', 'pacman',
      'pong', 'road-fighter', 'snake', 'space-invaders', 'tetris', 'vault-fighter', 'vault-world-cup',
    ]);
    expect(isGameId('pacman')).toBe(true);
    expect(isGameId('galaga')).toBe(false);
    expect(getGame('galaga')).toBeUndefined();
  });
```

Y el test `'flags the realtime games'` (líneas 65-69, buscar `filter((id) => GAMES[id].realtime)`):

```ts
  it('flags the realtime games', () => {
    expect(GAME_IDS.filter((id) => GAMES[id].realtime).sort()).toEqual([
      'bubble', 'karate-champ', 'kong', 'pacman', 'pong', 'road-fighter',
      'space-invaders', 'vault-fighter', 'vault-world-cup',
    ]);
  });
```

Añadir, al final del fichero (tras el último `it('vault-fighter has the fight keyMap …')`, antes del `});` que cierra el `describe`), un test que documente y fije la decisión "sin táctil" (G10-10: solo desktop, el juego nunca renderiza `MobileGamepad`):

```ts
  it('vault-world-cup declares no touch keys at all -- it is desktop-only and never renders MobileGamepad', () => {
    expect(GAMES['vault-world-cup'].controls.touch.keyMap).toEqual({});
    expect(getKeyMap('vault-world-cup')).toEqual({});
  });
```

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run lib/games-registry.test.ts`
Expected: FAIL — `Property 'vault-world-cup' does not exist` / `GAMES['vault-world-cup'] is undefined` al leer `.controls`, y el primer test falla porque `GAME_IDS.sort()` todavía trae trece elementos.

- [ ] **Step 3: Añadir `'vault-world-cup'` a `GameId`**

`lib/games-registry.ts`, sustituir la unión (líneas 4-17):

```ts
export type GameId =
  | 'asteroids'
  | 'tetris'
  | 'arkanoid'
  | 'snake'
  | 'frogger'
  | 'pong'
  | 'road-fighter'
  | 'pacman'
  | 'space-invaders'
  | 'karate-champ'
  | 'kong'
  | 'bubble'
  | 'vault-fighter'
  | 'vault-world-cup';
```

- [ ] **Step 4: Escribir la entrada del catálogo**

`lib/games-registry.ts`, insertar tras la entrada `'vault-fighter'` (tras la línea 411, antes del `};` que cierra `GAMES` en la línea 412):

```ts
  'vault-world-cup': {
    id: 'vault-world-cup',
    skins: CLASSIC_SKINS,
    controls: {
      keyboard: [
        { keys: ['↑', '↓', '←', '→', 'W', 'A', 'S', 'D'], action: 'Mover / apuntar los saques automáticos' },
        { keys: ['J'], action: 'A: chut o entrada al suelo (mantener = más fuerte)', special: true },
        { keys: ['K'], action: 'B: pase corto o robo de pie (mantener = pase largo)', special: true },
        { keys: ['L'], action: 'C: sprint en ráfaga', special: true },
        { keys: ['1', '2', '3'], action: 'Alineación: 3-3-2 / 3-2-3 / 4-3-1' },
        { keys: ['4', '5', '6'], action: 'Estrategia: ataque / neutral / defensa' },
        { keys: ['P'], action: 'Pausa' },
        { keys: ['R'], action: 'Reiniciar' },
      ],
      // Solo desktop (spec): este juego nunca renderiza MobileGamepad, así que no hay
      // ninguna tecla táctil que declarar. Un objeto vacío es un KeyMap válido (todos
      // sus campos son opcionales) y getKeyMap('vault-world-cup') nunca se llama desde
      // ninguna page -- lo fija el test de la Task 10-1.
      touch: { keyMap: {} },
    },
    instructions: {
      goal: 'Elige uno de los cuatro modos y llévate el balón: en AMISTOSO ganas un partido a la CPU o a otro jugador en tu mismo teclado, en ENTRENAMIENTO practicas sin reloj ni marcador contra un rival congelado, y en MUNDIAL disputas cuartos, semifinal y final contra siete selecciones sorteadas de dieciséis sin CONTINUE. Solo el Mundial apunta en la tabla.',
      tips: [
        'A chuta o entra al suelo; mantén pulsado para un chut más fuerte',
        'B pasa corto al pulsar o roba de pie; mantenlo pulsado para un pase largo',
        'C sprinta en ráfaga con recuperación, con o sin balón',
        '1, 2 y 3 cambian tu alineación (3-3-2 / 3-2-3 / 4-3-1); 4, 5 y 6 tu estrategia (ataque / neutral / defensa), en pleno partido',
        'P pausa el partido y R lo reinicia; el juego solo se juega en escritorio, con ventana suficiente',
      ],
    },
    realtime: true,
  },
```

- [ ] **Step 5: Verde del registro**

Run: `npx vitest run lib/games-registry.test.ts`
Expected: PASS, **9 tests** (los 8 de siempre + el nuevo de touch; ninguno cambia de nombre salvo los dos editados en el Step 1).

- [ ] **Step 6: `tsc` limpio**

Run: `npx tsc --noEmit`
Expected: sin salida. (Si algo referenciaba `GameId` con una unión exhaustiva de trece casos — p. ej. un `switch` sin `default` — aparecería aquí; no lo hay: `grep -rn "GameId" --include="*.ts" --include="*.tsx" .` fuera de `node_modules` solo devuelve `games-registry.ts` y sus importadores tipados como `GameId` genérico, ninguno con un switch exhaustivo sobre él.)

- [ ] **Step 7: Escribir la migración**

Create `supabase/migrations/20260914103000_add_vault_world_cup_game.sql`:

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'vault-world-cup',
  'VAULT WORLD CUP',
  'Fútbol cenital 9 contra 9: amistoso, entrenamiento o Mundial de ocho selecciones.',
  'Controla siempre al jugador más cercano al balón, pegado al pie, en un campo grande con cámara que te sigue y minimapa en la esquina. Chuta o entra con A, pasa corto o roba con B, sprinta en ráfaga con C, y cambia de alineación y estrategia en pleno partido. Juega un AMISTOSO contra la CPU o a dos en el mismo teclado, practica sin reloj en ENTRENAMIENTO, o disputa el MUNDIAL: ocho selecciones sorteadas de dieciséis, eliminatoria directa a cuartos, semifinal y final, con prórroga y penaltis si hace falta. Solo el Mundial puntúa en la tabla.',
  'SPORTS',
  '/covers/vault-futbol.png',
  'green'
);
```

Notas para el implementador (no ejecutar nada de esto, es la verificación de lectura que sustituye a `supabase db lint` — el repo no tiene CLI de Supabase instalada ni un script `db:lint`, confirmado al escribir este plan):
- El `id` (`'vault-world-cup'`) debe coincidir carácter a carácter con el añadido a `GameId` en el Step 3. Confirmar con: `grep -n "'vault-world-cup'" lib/games-registry.ts supabase/migrations/20260914103000_add_vault_world_cup_game.sql` → debe aparecer en los dos ficheros con la misma cadena exacta.
- `public.games` (`supabase/migrations/20260730141000_create_games_and_scores.sql`) no tiene ningún `CHECK` sobre `cat` ni `color`: son `text not null`. No hace falta tocar ningún enum de base de datos.
- `'green'` ya está en la unión de `lib/supabase/types.ts:8` (`GameRow.color`), y `'SPORTS'` ya está en la unión de `cat` (la usa `pong`) — no hace falta editar `lib/supabase/types.ts`.
- **S-D1 (assumption, this plan):** el spec no fija el `color` de la tarjeta. `'green'` (campo de fútbol) es la elección de este plan sobre los ocho valores ya existentes en `GameRow.color` — los ocho están repetidos entre las trece entradas actuales, así que no hay ningún valor "libre"; cualquier otro habría sido igual de válido. Cambiarlo después es una sola línea en la migración, sin tocar tipos.
- `public/covers/vault-futbol.png` existe (confirmado con `ls public/covers/` al escribir este plan). No hace falta el cover CSS provisional que sí necesitó Vault Fighter.

- [ ] **Step 8: Motor intacto**

Run: `git diff --stat c5d1e52 -- components/games/football-logic/`
Expected: **vacío** — esta tarea no toca `football-logic/` en absoluto (esa es la Task 10-2).

- [ ] **Step 9: Suite completa y ledger**

Run: `npx vitest run && npx tsc --noEmit`
Expected: **1172 tests en 68 ficheros** (1171 + el test nuevo de touch de la Task 10-1; los otros dos tests editados no cambian de cantidad, solo de contenido esperado); `tsc` sin salida.

Crear `.superpowers/sdd/2026-09-14-vault-world-cup-step-10/progress.md` con:

```markdown
# Progress — Vault World Cup, paso 10

## Task 10-1: DONE
- lib/games-registry.ts: GameId + GAMES['vault-world-cup'] (14º juego, SPORTS, sin táctil).
- lib/games-registry.test.ts: 13 -> 14, realtime list, +1 test nuevo (touch vacío).
- supabase/migrations/20260914103000_add_vault_world_cup_game.sql: fila nueva, sin aplicar (Paco).
- Suite: 1172/1172 (68 ficheros). tsc limpio. Motor intacto (git diff vacío).
```

No ejecutar `git commit`. Mensaje propuesto:

`feat(world-cup): register vault-world-cup as game 14 (catalogue entry + migration)`

**QA de Paco para esta tarea:** ninguno todavía — el catálogo real (carátula, tarjeta, instrucciones legibles) se comprueba en el cierre del paso, una vez la play-page también esté lista.

---

## Task 10-2: Audio y reglas puras que faltan (G10-2, G10-3, G10-4)

Cuatro añadidos independientes, los cuatro funciones puras con test, ninguno toca el `.tsx` todavía (eso es la Task 10-3): el fichero del pase corto, el disparador que lo detecta, la pregunta de si el modo tiene público, y la pregunta de a qué pista de música pertenece cada fase.

**Files:**
- Modify: `lib/sfx-vault-world-cup.ts` (`VaultWorldCupSfx` líneas 15-24, `RAW_FILES` líneas 27-37, `SFX_VOLUME` líneas 42-53)
- Modify: `lib/sfx-vault-world-cup.test.ts` (`ALL` líneas 10-14; bloque nuevo al final)
- Modify: `components/games/football-screen/sfx-map.ts` (tras `shotFiredThisStep`, línea 101)
- Modify: `components/games/football-screen/sfx-map.test.ts` (import línea 11-14; bloque nuevo)
- Modify: `components/games/football-logic/mode.ts` (tras `modeRules`, línea 101 — **única excepción al motor congelado**)
- Modify: `components/games/football-logic/mode.test.ts` (import línea 6-9; bloque nuevo)
- Modify: `components/games/football-screen/flow.ts` (tras el tipo `FlowPhase`, línea 22)
- Modify: `components/games/football-screen/flow.test.ts` (import línea 1-9; bloque nuevo)

**Interfaces:**
- Consumes: `MatchState` (`football-logic/match.ts`), `ActionEvent`/`ActionKind` (`football-logic/actions.ts`, ya usado sin importar directamente — `match.scratch.events` ya viene tipado), `GameMode` + `modeRules` (`football-logic/mode.ts`), `FlowPhase` (`football-screen/flow.ts`).
- Produces:

```ts
// lib/sfx-vault-world-cup.ts
export type VaultWorldCupSfx = /* … */ | 'kick' | 'pass' | 'crowd' | 'chants_victory';

// football-screen/sfx-map.ts
export function shortPassFiredThisStep(match: MatchState): boolean;

// football-logic/mode.ts
export function modeHasCrowd(m: GameMode): boolean;

// football-screen/flow.ts
export type PhaseGroup = 'menu' | 'match';
export function phaseGroup(phase: FlowPhase): PhaseGroup;
```

### Parte A — el fichero del pase corto (G10-2)

- [ ] **Step 1: Escribir los tests que fallan**

`lib/sfx-vault-world-cup.test.ts`, sustituir `ALL` (líneas 10-14):

```ts
const ALL: VaultWorldCupSfx[] = [
  'whistle_start', 'whistle_end', 'whistle_foul',
  'goal_net', 'goal_shout', 'goal_crowd',
  'kick', 'pass', 'crowd', 'chants_victory',
];
```

Y añadir, al final del fichero (tras el último `it('the stub above leaves no Audio global…')`):

```ts
// ── Task 10-2 (G10-2, QA 11-sep: "pase corto sin sonido"). Paco aportó el fichero
// el 14-sep; este es el primero de los nueve sonidos de fichero que NO estaba
// cableado desde el paso 8. ──────────────────────────────────────────────────────
describe('the short pass', () => {
  it('names the real file Paco added, at a volume in (0, 1]', () => {
    expect(SFX_FILES.pass).toBe('/vault-futbol-pass.mp3');
    expect(PUBLIC_FILES.has('vault-futbol-pass.mp3')).toBe(true);
    expect(SFX_VOLUME.pass).toBeGreaterThan(0);
    expect(SFX_VOLUME.pass).toBeLessThanOrEqual(1);
  });

  // S-D2 (assumption, this plan): no volume is specified in the spec's audio table
  // for the pass -- only that it must exist. A pass is a lighter touch of the ball
  // than a shot, so it sits below SFX_VOLUME.kick; adjustable in QA like every other
  // number in this table.
  it('is quieter than the shot -- a pass is not a kick', () => {
    expect(SFX_VOLUME.pass).toBeLessThan(SFX_VOLUME.kick);
  });
});
```

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run lib/sfx-vault-world-cup.test.ts`
Expected: FAIL — `SFX_FILES.pass` es `undefined` (`Cannot read properties of undefined (reading 'startsWith')` en el primer `it` del `describe('SFX_FILES', …)`, porque `'pass'` ya está en `ALL` pero todavía no en `RAW_FILES`).

- [ ] **Step 3: Añadir el sonido**

`lib/sfx-vault-world-cup.ts`, sustituir el tipo (líneas 15-24):

```ts
export type VaultWorldCupSfx =
  | 'whistle_start'
  | 'whistle_end'
  | 'whistle_foul'
  | 'goal_net'
  | 'goal_shout'
  | 'goal_crowd'
  | 'kick'
  | 'pass'
  | 'crowd'
  | 'chants_victory';
```

`RAW_FILES` (líneas 27-37), añadir tras `kick`:

```ts
const RAW_FILES: Readonly<Record<VaultWorldCupSfx, string>> = {
  whistle_start: '/vault-futbol-whistle-start.mp3',
  whistle_end: '/vault-futbol-whistle-end.mp3',
  whistle_foul: '/vault-futbol-whistle-foul.mp3',
  goal_net: '/vault-futbol-goal-net.mp3',
  goal_shout: '/vault-futbol-goal-shout.mp3',
  goal_crowd: '/vault-futbol-goal-crowd.mp3',
  kick: '/vault-futbol-kick.mp3',
  pass: '/vault-futbol-pass.mp3',
  crowd: '/vault-futbol-crowd-ambience.mp3',
  chants_victory: '/vault-futbol-chants-victory.mp3',
};
```

`SFX_VOLUME` (líneas 42-53), añadir tras `kick`:

```ts
export const SFX_VOLUME: Readonly<Record<VaultWorldCupSfx, number>> = {
  whistle_start: 0.7,
  whistle_end: 0.7,
  whistle_foul: 0.6,
  goal_net: 0.7,
  goal_shout: 0.8,
  goal_crowd: 0.5,
  kick: 0.45,
  // S-D2: below the shot, above nothing -- a pass is heard but never competes with it.
  pass: 0.35,
  crowd: 0.3,
  chants_victory: 0.6,
};
```

- [ ] **Step 4: Verde**

Run: `npx vitest run lib/sfx-vault-world-cup.test.ts`
Expected: PASS, todos los tests existentes siguen en verde (ahora recorren diez sonidos en vez de nueve) más los dos nuevos del `describe('the short pass', …)`.

### Parte B — el disparador que distingue el pase corto (G10-2)

- [ ] **Step 5: Escribir los tests que fallan**

`components/games/football-screen/sfx-map.test.ts`, añadir `shortPassFiredThisStep` al import de `./sfx-map` (línea 11-14):

```ts
import {
  AMBIENCE_MAX, AMBIENCE_MIN, ambienceDue, ambienceSeedFor, createAmbienceMarks,
  captionSfxOnEdge, goalCrowdDue, goalNetDue, halfEndWhistleDue, planAmbience, sfxForCaption,
  shortPassFiredThisStep, shotFiredThisStep, CHANTS_LOW_GAIN, victoryChantGain,
} from './sfx-map';
```

Añadir, tras el `describe('shotFiredThisStep', …)` existente:

```ts
// ── Task 10-2 (G10-2): the short pass, mirroring shotFiredThisStep exactly. The
// spec's file is for the SHORT pass only -- the long pass stays silent in the v1
// (no row for it in the audio table), so 'long-pass' must NOT trip this. ──────────
describe('shortPassFiredThisStep', () => {
  it('is false on a clean step', () => {
    const m = newMatch();
    expect(shortPassFiredThisStep(m)).toBe(false);
  });

  it('is true when any of the eighteen slots holds a short pass that got away', () => {
    const m = newMatch();
    m.scratch.events[3].kind = 'short-pass';
    m.scratch.events[3].ok = true;
    expect(shortPassFiredThisStep(m)).toBe(true);
  });

  it('ignores a long pass -- the spec has no audio row for it', () => {
    const m = newMatch();
    m.scratch.events[3].kind = 'long-pass';
    m.scratch.events[3].ok = true;
    expect(shortPassFiredThisStep(m)).toBe(false);
  });

  it('ignores a short pass that did not get away', () => {
    const m = newMatch();
    m.scratch.events[3].kind = 'short-pass';
    m.scratch.events[3].ok = false;
    expect(shortPassFiredThisStep(m)).toBe(false);
  });
});
```

- [ ] **Step 6: Ver fallar**

Run: `npx vitest run components/games/football-screen/sfx-map.test.ts`
Expected: FAIL — `does not provide an export named 'shortPassFiredThisStep'`.

- [ ] **Step 7: Escribir `shortPassFiredThisStep`**

`components/games/football-screen/sfx-map.ts`, insertar tras el cierre de `shotFiredThisStep` (línea 101, antes del comentario `// Spec: "dos o tres ráfagas…`):

```ts
// The short pass getting away (G10-2, QA 11-sep: it had no sound at all). Same scan
// as shotFiredThisStep, for the same reason (the shootout wipes the pointer) -- but
// 'short-pass' only: the spec's audio table has no row for the long pass, so it
// must stay silent even though the engine tags it with its own ActionKind.
export function shortPassFiredThisStep(match: MatchState): boolean {
  const events = match.scratch.events;
  for (let i = 0; i < events.length; i++) {
    if (events[i].kind === 'short-pass' && events[i].ok) return true;
  }
  return false;
}
```

- [ ] **Step 8: Verde**

Run: `npx vitest run components/games/football-screen/sfx-map.test.ts`
Expected: PASS, **+4 tests** sobre el conteo de antes de esta tarea.

### Parte C — `modeHasCrowd` (G10-3, única excepción al motor congelado)

- [ ] **Step 9: Escribir los tests que fallan**

`components/games/football-logic/mode.test.ts`, añadir `modeHasCrowd` al import de `./mode` (línea 6-9):

```ts
import {
  FRIENDLY_DIFFICULTY, createFriendlyMode, createWorldCupMode, drawRival, drawSeedFor, modeAbandonMatch, modeAwayId,
  modeBracket, modeDifficulty, modeEndMatch, modeFxKind, modeHasCrowd, modeHomeId, modeHumanSide, modeMatchLabel,
  modeMatchSeed, modeRules, modeScore, modeScores, modeStatus, modeVictoryScreen, modeVictoryTeamId, modeVictoryTitle,
  sideIsHuman, type GameMode,
} from './mode';
```

Añadir, al final del fichero (tras el último `it('modeAbandonMatch with a lead: …')`, antes del `});` que cierra el `describe` más externo si lo hay, o como `describe` hermano si los tests de nivel superior no están anidados):

```ts
// ── Task 10-2 (G10-3, QA 11-sep: "el público solo en partidos, no en entrenamiento").
// A thin alias over modeRules(m).timed, tested for the four kinds directly (riesgo 7:
// no basta un solo caso feliz) y por construcción contra modeRules. ─────────────────
describe('modeHasCrowd', () => {
  it('is true for both friendlies and the World Cup -- every mode with a running clock', () => {
    expect(modeHasCrowd(createFriendlyMode('friendly-cpu', 'brasil', 'italia'))).toBe(true);
    expect(modeHasCrowd(createFriendlyMode('friendly-2p', 'brasil', 'italia'))).toBe(true);
    expect(modeHasCrowd(createWorldCupMode(BANK_IDS, 'brasil', 1))).toBe(true);
  });

  it('is false for training -- no clock, no crowd', () => {
    expect(modeHasCrowd(createFriendlyMode('training', 'brasil', 'italia'))).toBe(false);
  });

  it('agrees with modeRules(m).timed by construction, for all four kinds', () => {
    const modes: GameMode[] = [
      createFriendlyMode('friendly-cpu', 'brasil', 'italia'),
      createFriendlyMode('friendly-2p', 'brasil', 'italia'),
      createFriendlyMode('training', 'brasil', 'italia'),
      createWorldCupMode(BANK_IDS, 'brasil', 1),
    ];
    for (const m of modes) expect(modeHasCrowd(m)).toBe(modeRules(m).timed);
  });
});
```

- [ ] **Step 10: Ver fallar**

Run: `npx vitest run components/games/football-logic/mode.test.ts`
Expected: FAIL — `does not provide an export named 'modeHasCrowd'`.

- [ ] **Step 11: Escribir `modeHasCrowd`**

`components/games/football-logic/mode.ts`, insertar tras el cierre de `modeRules` (línea 101, antes de `export function modeScore`):

```ts
// G10-3: the crowd ambience plays only in matches with a running clock -- exactly
// the question modeRules(m).timed already answers (G9-1 froze the clock for
// training). A thin, named alias on purpose: the component gates the ambience
// with THIS function, never with modeRules(m).timed directly and never with
// `mode.kind` -- one name, so a reviewer greps "modeHasCrowd" and finds every
// place the crowd is gated.
export function modeHasCrowd(m: GameMode): boolean {
  return modeRules(m).timed;
}
```

- [ ] **Step 12: Verde**

Run: `npx vitest run components/games/football-logic/mode.test.ts`
Expected: PASS, **+3 tests**.

Run también: `git diff --stat c5d1e52 -- components/games/football-logic/`
Expected: exactamente `mode.ts` y `mode.test.ts`, nada más — la única grieta autorizada en el motor congelado.

### Parte D — `phaseGroup` (G10-4)

- [ ] **Step 13: Escribir los tests que fallan**

`components/games/football-screen/flow.test.ts`, añadir `phaseGroup` y `type FlowPhase` al import de `./flow` (líneas 1-9, hoy sin `type FlowPhase`):

```ts
import {
  HUMANS_BY_MODE, MODE_BLURBS, MODE_LIST, MODE_NAMES,
  createFlowState, flowAfterModeBuilt, flowBracketAction, flowBuildMode, flowCaptionsDrained, flowConfirmBracket,
  flowConfirmDraw, flowConfirmMode, flowConfirmTeam, flowContinue, flowCpuPair, flowExitMatch, flowHumanCount,
  flowMatchOver, flowModeKind, flowMoveBracketChoice, flowMoveMode, flowMoveTeam, flowPickingHuman, flowRecordCpuResult,
  flowReset, flowSetFormation, flowSkipSpectate, flowSpectateOver, phaseGroup, type FlowPhase, type FlowState,
} from './flow';
```

Añadir, al final del fichero (tras el último `it('every transition is a no-op outside its phase', …)`, antes del `});` que cierra el `describe` más externo, o como bloque hermano):

```ts
// ── Task 10-2 (G10-4): which music track a phase belongs to. All EIGHT phases of
// FlowPhase, not a sample -- riesgo 7 heredado del paso 9. ───────────────────────
describe('phaseGroup', () => {
  it('match and spectate are "match"; the other six phases are "menu"', () => {
    const phases: FlowPhase[] = [
      'mode-select', 'team-select', 'draw', 'bracket', 'match', 'spectate', 'victory', 'over',
    ];
    expect(phases.map(phaseGroup)).toEqual([
      'menu', 'menu', 'menu', 'menu', 'match', 'match', 'menu', 'menu',
    ]);
  });
});
```

- [ ] **Step 14: Ver fallar**

Run: `npx vitest run components/games/football-screen/flow.test.ts`
Expected: FAIL — `does not provide an export named 'phaseGroup'`.

- [ ] **Step 15: Escribir `phaseGroup`**

`components/games/football-screen/flow.ts`, insertar tras el cierre del tipo `FlowPhase` (línea 22, antes de `export type BracketAction`):

```ts
// G10-4: which of the two tracks the play-page's music belongs to. 'match' is the
// only two phases with a game actually running -- a played match and a spectated
// CPU pair; the other six (every menu, the draw, the bracket, the victory screen,
// and the caption drain of 'over') are 'menu'. The pause is deliberately NOT a
// phase here: the play-page reads `paused` from its own prop (spec L464: the lobby
// track also covers the pause), not from this function.
export type PhaseGroup = 'menu' | 'match';

export function phaseGroup(phase: FlowPhase): PhaseGroup {
  return phase === 'match' || phase === 'spectate' ? 'match' : 'menu';
}
```

- [ ] **Step 16: Verde**

Run: `npx vitest run components/games/football-screen/flow.test.ts`
Expected: PASS, **+1 test**.

### Cierre de la tarea

- [ ] **Step 17: Suite completa, `tsc` y azar**

Run: `npx vitest run && npx tsc --noEmit && grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/`
Expected: la suite pasa de 1172 (cierre de la Task 10-1) a **1182** (+2 de la Parte A, +4 de la B, +3 de la C, +1 de la D) en **68 ficheros** (ningún fichero nuevo, todos son ediciones); `tsc` sin salida; el grep de `Math.random` **vacío**.

- [ ] **Step 18: Motor y ledger**

Run: `git diff --stat c5d1e52 -- components/games/football-logic/`
Expected: exactamente `mode.ts` y `mode.test.ts` (confirmación final de esta tarea, igual que el Step 12).

Actualizar `.superpowers/sdd/2026-09-14-vault-world-cup-step-10/progress.md`:

```markdown
## Task 10-2: DONE
- lib/sfx-vault-world-cup.ts: 'pass' (vault-futbol-pass.mp3, volumen 0.35, S-D2).
- football-screen/sfx-map.ts: shortPassFiredThisStep (hermana de shotFiredThisStep, solo short-pass).
- football-logic/mode.ts: modeHasCrowd = modeRules(m).timed (única grieta en el motor congelado).
- football-screen/flow.ts: PhaseGroup, phaseGroup(phase) sobre las 8 fases.
- Suite: 1182/1182 (68 ficheros). tsc limpio. Motor: solo mode.ts/mode.test.ts tocados.
```

No ejecutar `git commit`. Mensaje propuesto:

`feat(world-cup): short-pass sound, crowd-by-mode and phase-group pure functions (step 10 audio + flow gaps)`

**QA de Paco para esta tarea:** ninguno todavía — el pase corto suena de verdad solo cuando la Task 10-3 lo consume desde `runStep`; aquí solo se prueba el disparador puro.

---

## Task 10-3: Cablear el componente — pase, ambiente por modo, fase y bloqueo por viewport (G10-2, G10-3, G10-4, G10-5)

Cuatro cambios quirúrgicos sobre `VaultWorldCupGame.tsx`, cada uno de un puñado de líneas, todos consumiendo lo que la Task 10-2 acaba de escribir. **Ninguna regla nueva**: el componente sigue preguntando a `mode.ts`/`flow.ts`, nunca decidiendo por sí mismo. Sin test unitario (rAF + canvas, igual que el resto del fichero desde el paso 8): la verificación es `tsc`, los greps de invariantes y la suite completa sin regresión.

**Files:**
- Modify: `components/games/VaultWorldCupGame.tsx` (imports 7-11/27-32/55-58, props 63-70, destructuring 220-229, refs 230-237, sync-effect 250-256, `let reportedHome…` 329-333, tras `reportHud` línea 360, `runStep` línea 584, gate de ambiente 638-647, `loop` línea 1382-1394, inicio del bucle 1592-1598, `handleResize` línea 1558-1568)

**Interfaces:**
- Consumes: `modeHasCrowd` (`football-logic/mode.ts`, Task 10-2), `phaseGroup`, `type PhaseGroup` (`football-screen/flow.ts`, Task 10-2), `shortPassFiredThisStep` (`football-screen/sfx-map.ts`, Task 10-2).
- Produces: el contrato de props ya fijado en la cabecera de este plan (`onPhaseChange?: (phase: PhaseGroup) => void`, `onViewportBlocked?: () => void`) — la Task 10-5 (play-page) los consume tal cual.

- [ ] **Step 1: Los tres imports nuevos**

Sustituir el import de `./football-logic/mode` (líneas 7-11):

```ts
import {
  modeAwayId, modeBracket, modeDifficulty, modeFxKind, modeHasCrowd, modeHomeId, modeHumanSide, modeMatchLabel,
  modeMatchSeed, modeRules, modeScore, modeScores, modeStatus, modeVictoryScreen, modeVictoryTeamId, modeVictoryTitle,
  createFriendlyMode, sideIsHuman, type FxKind, type GameMode, type HumanSide,
} from './football-logic/mode';
```

Sustituir el import de `./football-screen/flow` (líneas 27-32):

```ts
import {
  MODE_BLURBS, MODE_LIST, MODE_NAMES, createFlowState, flowAfterModeBuilt, flowBuildMode, flowCaptionsDrained,
  flowConfirmBracket, flowConfirmDraw, flowConfirmMode, flowConfirmTeam, flowContinue, flowCpuPair, flowExitMatch,
  flowHumanCount, flowMatchOver, flowMoveBracketChoice, flowMoveMode, flowMoveTeam, flowPickingHuman, flowRecordCpuResult,
  flowSetFormation, flowSkipSpectate, flowSpectateOver, phaseGroup, type PhaseGroup,
} from './football-screen/flow';
```

Sustituir el import de `./football-screen/sfx-map` (líneas 55-58):

```ts
import {
  ambienceDue, captionSfxOnEdge, createAmbienceMarks, goalCrowdDue, goalNetDue, halfEndWhistleDue,
  shortPassFiredThisStep, shotFiredThisStep, victoryChantGain,
} from './football-screen/sfx-map';
```

- [ ] **Step 2: Las dos props nuevas, con sus refs y su sincronización**

Sustituir la interfaz (líneas 63-70):

```ts
interface VaultWorldCupGameProps {
  paused: boolean;
  muted?: boolean;
  seed?: number;
  onScoreChange?: (home: number, away: number) => void;
  onClockChange?: (label: string) => void;
  onStatusChange?: (label: string) => void;
  // G10-4: 'menu' mientras se ve cualquier selector/sorteo/cuadro/pantalla de
  // victoria; 'match' durante un partido jugado o un cruce de la CPU espectado.
  // Derivada de FlowPhase por phaseGroup, nunca leída de mode.kind. La play-page la
  // usa para cambiar de pista en MusicContext.
  onPhaseChange?: (phase: PhaseGroup) => void;
  onGameOver?: (score: number) => void;
  onVictory?: (score: number) => void;
  // G10-5: se llama UNA vez, en el borde de entrada a `blocked` (nunca por frame, ni
  // al salir de él): la play-page redirige al detalle tras enseñar el panel un par
  // de segundos.
  onViewportBlocked?: () => void;
}
```

Sustituir la destructuración de `function VaultWorldCupGame({ … })` (líneas 220-229):

```ts
function VaultWorldCupGame({
  paused,
  muted = false,
  seed,
  onScoreChange,
  onClockChange,
  onStatusChange,
  onPhaseChange,
  onGameOver,
  onVictory,
  onViewportBlocked,
}: VaultWorldCupGameProps) {
```

Sustituir el bloque de refs (líneas 230-237, empieza en `canvasRef` — preflight 14-sep: la cita
anterior de este plan decía 231-237 y se corrigió porque excluía esa línea; si se reemplaza por
número de línea en vez de por contenido, empezar en 231 deja un `canvasRef` sin tocar y el bloque de
abajo lo vuelve a declarar, un `tsc` "Cannot redeclare block-scoped variable 'canvasRef'"):

```ts
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const mutedRef = useRef(muted);
  const onScoreChangeRef = useRef(onScoreChange);
  const onClockChangeRef = useRef(onClockChange);
  const onStatusChangeRef = useRef(onStatusChange);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onGameOverRef = useRef(onGameOver);
  const onVictoryRef = useRef(onVictory);
  const onViewportBlockedRef = useRef(onViewportBlocked);
```

Sustituir el efecto de sincronización (líneas 250-256):

```ts
  useEffect(() => {
    onScoreChangeRef.current = onScoreChange;
    onClockChangeRef.current = onClockChange;
    onStatusChangeRef.current = onStatusChange;
    onPhaseChangeRef.current = onPhaseChange;
    onGameOverRef.current = onGameOver;
    onVictoryRef.current = onVictory;
    onViewportBlockedRef.current = onViewportBlocked;
  }, [onScoreChange, onClockChange, onStatusChange, onPhaseChange, onGameOver, onVictory, onViewportBlocked]);
```

- [ ] **Step 3: `tsc` a medio camino (confirma que los tres puntos de arriba encajan)**

Run: `npx tsc --noEmit`
Expected: **FALLA** — `onPhaseChangeRef`, `onViewportBlockedRef` y `PhaseGroup` están declarados y no usados todavía (`reportPhase` y `handleResize` los consumen en los Steps 4 y 6); es la señal correcta de que el Step 2 quedó bien tipado y falta cablear el resto. Si en cambio falla por un import no encontrado, revisar el Step 1 antes de seguir.

- [ ] **Step 4: `reportPhase`, patrón `reportHud`**

Sustituir el bloque de variables `reportedHome`/`reportedAway`/`reportedClock`/`keeperHold*` (líneas 329-333):

```ts
    let reportedHome = -1;
    let reportedAway = -1;
    let reportedClock = '';
    // '' antes del primer reporte (el componente se acaba de montar): ni 'menu' ni
    // 'match', así que la primera llamada siempre dispara una vez -- el mismo truco
    // que reportedClock empezando en ''.
    let reportedPhaseGroup: PhaseGroup | '' = '';
    let keeperHoldSteps = 0;
    let keeperHoldTeam: 0 | 1 | -1 = -1;
```

Insertar, justo tras el cierre de `reportHud` (línea 360, antes del comentario `// The caption that is showing NOW…`):

```ts

    // G10-4: la pista de música de la play-page. Barata por construcción -- una
    // comparación de strings contra una variable ya mutada in place, exactamente el
    // patrón de reportHud de arriba -- así que llamarla cada frame desde loop() no es
    // una asignación por frame: es una LECTURA por frame que solo llama al callback
    // en el borde.
    function reportPhase(): void {
      const group = phaseGroup(flow.phase);
      if (group === reportedPhaseGroup) return;
      reportedPhaseGroup = group;
      const cb = onPhaseChangeRef.current;
      if (cb !== undefined) cb(group);
    }
```

Sustituir `loop` (líneas 1382-1394):

```ts
    let rafId = 0;
    function loop(ts: number): void {
      const frameMs = started ? ts - lastTs : 0;
      lastTs = ts;
      started = true;
      // update() decides for itself what this frame may do (match-loop's planFrame).
      // draw() runs UNCONDITIONALLY: neither the end of the match nor the viewport
      // guard may leave the canvas frozen on the frame before, because the last
      // thing the screen has to say -- GANADOR / ELIMINADO / EMPATE, or the panel
      // that explains the block -- is drawn after both of them happen.
      update(frameMs);
      draw();
      // G10-4: after draw(), same reasoning -- the phase this frame just drew is the
      // one worth reporting, and reportPhase is a no-op on every frame but the edge.
      reportPhase();
      rafId = requestAnimationFrame(loop);
    }
```

Sustituir el arranque del bucle (líneas 1592-1598):

```ts
    handleResize();
    reportStatus(STATUS_SELECTOR);
    reportPhase();
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('resize', handleResize);
    rafId = requestAnimationFrame(loop);
```

- [ ] **Step 5: El pase corto en `runStep`**

Sustituir el punto 1 de `runStep` (línea 584-585, dentro del comentario numerado):

```ts
      // 1. The ball being struck (audio table: ActionEvent 'shot' with ok).
      if (shotFiredThisStep(match)) sfxVaultWorldCup.play('kick');
      // 1b. The short pass getting away (G10-2, QA 11-sep). The long pass has no row
      //     in the spec's audio table and stays silent in the v1.
      if (shortPassFiredThisStep(match)) sfxVaultWorldCup.play('pass');
```

- [ ] **Step 6: El público, solo con reloj**

Sustituir el punto 5 de `runStep` (líneas 638-647):

```ts
      // 5. The crowd bed: 2-3 bursts per half, from its own stream (spec). Planned
      //    for every mode (cheap, no sound); gated at the ONE place it makes sound
      //    (G10-3, QA 11-sep: training has no clock, and no crowd).
      if (match.half !== ambienceHalf) {
        ambienceCount = planHalfAmbience(matchSeed, match.half, ambienceMarks);
        ambienceIndex = 0;
        ambienceHalf = match.half;
      }
      if (modeHasCrowd(mode) && isOpenPlay(match.phase) && ambienceDue(ambienceMarks, ambienceCount, ambienceIndex, match.halfStep)) {
        ambienceIndex++;
        sfxVaultWorldCup.play('crowd');
      }
```

- [ ] **Step 7: `onViewportBlocked`, una vez en el borde**

Sustituir el arranque de `handleResize` (líneas 1558-1568):

```ts
    function handleResize(): void {
      if (viewportAllowed(window.innerWidth, window.innerHeight)) {
        if (blocked && flow.phase !== 'match' && flow.phase !== 'spectate') blocked = false;
        return;
      }
      if (blocked) return;
      blocked = true;
      // G10-5: exactamente una vez, en el borde de entrada a blocked -- el guard de
      // arriba (`if (blocked) return;`) hace esta línea inalcanzable en un segundo
      // resize mientras sigue bloqueado, y la rama de viewportAllowed nunca la repite.
      const cb = onViewportBlockedRef.current;
      if (cb !== undefined) cb();
      if (flow.phase === 'spectate') {
        skipSpectate();
        return;
      }
```

(El resto de la función, desde `if (flow.phase !== 'match') return;` hasta el final, no cambia.)

- [ ] **Step 8: `tsc` verde**

Run: `npx tsc --noEmit`
Expected: sin salida. Si algo sigue sin usarse (`PhaseGroup` importado dos veces, algún ref sin leer), es que se saltó un Step — revisar del 4 al 7.

- [ ] **Step 9: Suite sin regresión, e invariantes**

Run:

```bash
npx vitest run
grep -n "mode\.kind\|m\.kind\|kind === '\(friendly\|training\|world\)" components/games/VaultWorldCupGame.tsx
grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/ components/games/VaultWorldCupGame.tsx
grep -c "Date.now()" components/games/VaultWorldCupGame.tsx
```

Expected: **1182 tests en 68 ficheros** (sin cambio: esta tarea no toca ningún `.test.ts`); el primer grep vacío (el único `kind ===` que casa es `sp.kind === 'penalty'` de `drawSetPiece`, sin tocar); el segundo grep vacío; el tercero **1** (el `Date.now()` de `confirmTeam`, G9-7 — sin nuevos).

- [ ] **Step 10: Motor y ledger**

Run: `git diff --stat c5d1e52 -- components/games/football-logic/`
Expected: sigue listando solo `mode.ts`/`mode.test.ts` (de la Task 10-2) — esta tarea no toca `football-logic/`.

Actualizar `.superpowers/sdd/2026-09-14-vault-world-cup-step-10/progress.md`:

```markdown
## Task 10-3: DONE
- VaultWorldCupGame.tsx: props onPhaseChange/onViewportBlocked + refs + sync-effect.
- runStep: pase corto (shortPassFiredThisStep -> 'pass'), ambiente gateado por modeHasCrowd(mode).
- reportPhase() (patrón reportHud), llamado en loop() y al montar.
- handleResize: onViewportBlocked() una vez en el borde de `blocked`.
- Suite: 1182/1182 (68 ficheros, sin ficheros nuevos). tsc limpio. Invariantes (mode.kind, Math.random, Date.now) verdes.
```

No ejecutar `git commit`. Mensaje propuesto:

`feat(world-cup): wire short-pass sound, mode-gated crowd, phase-group reporting and viewport-blocked callback into the component`

**QA de Paco para esta tarea:** ninguno todavía — se juega en el cierre del paso, con la play-page ya consumiendo estas dos props nuevas (Task 10-5).

---

## Task 10-4: JUGAR deshabilitado en el catálogo bajo el umbral (G10-5)

**Files:**
- Create: `app/games/desktop-only.ts`, `app/games/desktop-only.test.ts`
- Modify: `app/games/GamesGrid.tsx` (import 1-6, `GameCard` 8 y 57-64, `GamesGrid` 71-88, `filtered.map` 124-127)

**Interfaces:**
- Consumes: `isGameId`, `type GameId` (`lib/games-registry.ts`), `MIN_VIEWPORT_W`, `MIN_VIEWPORT_H`, `viewportAllowed` (`components/games/football-screen/viewport-guard.ts`, **ya exportados, sin tocar ese fichero**).
- Produces:

```ts
// app/games/desktop-only.ts
export const MIN_VIEWPORT_W: number;   // reexportado, 768
export const MIN_VIEWPORT_H: number;   // reexportado, 560
export function isDesktopOnlyBlocked(gameId: string, width: number, height: number): boolean;
```

- [ ] **Step 1: Escribir el test que falla**

Create `app/games/desktop-only.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MIN_VIEWPORT_H, MIN_VIEWPORT_W, isDesktopOnlyBlocked } from './desktop-only';

describe('isDesktopOnlyBlocked', () => {
  // Riesgo anti-coincidencia (Global Constraints): probar explícitamente que NINGÚN
  // otro juego del catálogo se ve afectado, no solo que vault-world-cup sí.
  it('never blocks a game that is not vault-world-cup, at any size', () => {
    expect(isDesktopOnlyBlocked('pacman', 320, 480)).toBe(false);
    expect(isDesktopOnlyBlocked('vault-fighter', 0, 0)).toBe(false);
    expect(isDesktopOnlyBlocked('kong', 1, 1)).toBe(false);
  });

  it('is false for a string that is not even a real game id', () => {
    expect(isDesktopOnlyBlocked('not-a-real-game', 1920, 1080)).toBe(false);
  });

  it('blocks vault-world-cup strictly below either threshold, allows it at or above both', () => {
    expect(isDesktopOnlyBlocked('vault-world-cup', MIN_VIEWPORT_W - 1, MIN_VIEWPORT_H)).toBe(true);
    expect(isDesktopOnlyBlocked('vault-world-cup', MIN_VIEWPORT_W, MIN_VIEWPORT_H - 1)).toBe(true);
    expect(isDesktopOnlyBlocked('vault-world-cup', MIN_VIEWPORT_W, MIN_VIEWPORT_H)).toBe(false);
    expect(isDesktopOnlyBlocked('vault-world-cup', 1440, 900)).toBe(false);
  });

  it('re-exports the exact thresholds of viewport-guard.ts, not a copy of the numbers', () => {
    expect(MIN_VIEWPORT_W).toBe(768);
    expect(MIN_VIEWPORT_H).toBe(560);
  });
});
```

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run app/games/desktop-only.test.ts`
Expected: FAIL — `Cannot find module './desktop-only'` (el fichero todavía no existe).

- [ ] **Step 3: Escribir `desktop-only.ts`**

Create `app/games/desktop-only.ts`:

```ts
import { isGameId, type GameId } from '@/lib/games-registry';
import { MIN_VIEWPORT_H, MIN_VIEWPORT_W, viewportAllowed } from '@/components/games/football-screen/viewport-guard';

// G10-5: el único juego que el catálogo bloquea por viewport en la v1. Un set
// literal, no un campo de GameMeta ni una columna de `games`: un solo juego no
// justifica schema nuevo (spec, §6.8 del brief de diseño).
const DESKTOP_ONLY_GAMES: ReadonlySet<GameId> = new Set<GameId>(['vault-world-cup']);

export { MIN_VIEWPORT_H, MIN_VIEWPORT_W };

export function isDesktopOnlyBlocked(gameId: string, width: number, height: number): boolean {
  if (!isGameId(gameId) || !DESKTOP_ONLY_GAMES.has(gameId)) return false;
  return !viewportAllowed(width, height);
}
```

- [ ] **Step 4: Verde**

Run: `npx vitest run app/games/desktop-only.test.ts`
Expected: PASS, **4 tests**.

- [ ] **Step 5: Cablear `GamesGrid.tsx`**

Sustituir los imports (líneas 1-6):

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameRow } from '@/lib/supabase/types';
import { useUser } from '@/app/context/UserContext';
import { isDesktopOnlyBlocked } from './desktop-only';
```

Sustituir la firma de `GameCard` (línea 8) y la fila de `JUGAR` (líneas 57-64):

```tsx
function GameCard({ game, desktopOnlyBlocked }: { game: GameRow; desktopOnlyBlocked: boolean }) {
```

```tsx
        <div className="row">
          {desktopOnlyBlocked ? (
            // G10-5: sin Link -- no hay nada a lo que navegar. aria-disabled, no el
            // atributo `disabled` (esto es un <span>, no un <button>).
            <span
              className="btn ghost"
              aria-disabled="true"
              title="Este juego solo se puede jugar en pantalla de escritorio"
              style={{ cursor: 'not-allowed', opacity: 0.6 }}
            >
              SOLO ESCRITORIO
            </span>
          ) : (
            <Link
              href={`/games/${game.id}`}
              className={`btn ${btnColor}`}
              onClick={(e) => e.stopPropagation()}
            >
              JUGAR
            </Link>
          )}
        </div>
```

Sustituir el arranque de `GamesGrid` (líneas 71-73):

```tsx
export default function GamesGrid({ games }: { games: GameRow[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  // null hasta que se monta: el render de servidor (y el primer pintado del
  // cliente) no conocen el tamaño de la ventana, así que JUGAR arranca siempre
  // habilitado y solo una medición de resize real puede deshabilitarlo -- sin
  // desajuste de hidratación, como mucho un parpadeo de un frame para quien de
  // verdad está por debajo del umbral.
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    function update() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
```

Sustituir el `filtered.map` (líneas 124-127):

```tsx
        {filtered.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            desktopOnlyBlocked={viewport !== null && isDesktopOnlyBlocked(g.id, viewport.w, viewport.h)}
          />
        ))}
```

- [ ] **Step 6: `tsc` y suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: `tsc` sin salida; **1186 tests en 69 ficheros** (1182 + los 4 nuevos de `desktop-only.test.ts`, +1 fichero).

- [ ] **Step 7: Ledger**

Actualizar `.superpowers/sdd/2026-09-14-vault-world-cup-step-10/progress.md`:

```markdown
## Task 10-4: DONE
- app/games/desktop-only.ts: isDesktopOnlyBlocked(gameId, w, h), reexporta MIN_VIEWPORT_W/H.
- app/games/GamesGrid.tsx: viewport en estado (resize), GameCard deshabilita JUGAR -> SOLO ESCRITORIO solo para vault-world-cup.
- Suite: 1186/1186 (69 ficheros). tsc limpio.
```

No ejecutar `git commit`. Mensaje propuesto:

`feat(catalogue): disable JUGAR for vault-world-cup under the desktop-only viewport threshold`

**QA de Paco para esta tarea:** encoger la ventana del navegador por debajo de 768 × 560 con `/games` abierto: la tarjeta de VAULT WORLD CUP debe cambiar `JUGAR` por `SOLO ESCRITORIO` (sin enlace) y ningún otro juego debe verse afectado; agrandar la ventana debe devolver `JUGAR`.

---

## Task 10-5: La play-page definitiva (G10-4, G10-5, G10-6, G10-7)

Reescritura completa de `app/games/vault-world-cup/play/page.tsx`, espejo de `app/games/vault-fighter/play/page.tsx` con las diferencias que impone el spec: sin `MobileGamepad` (solo desktop, sin táctil), sin selector de skin (G10-7), música por fase en vez de una pista fija por sesión, `GameOverModal` gateado por `onGameOver`/`onVictory` en vez de por el fin de cualquier partido, y redirect al detalle tras el bloqueo por viewport. El `<Suspense>` alrededor de `useSearchParams` del paso 9 **se conserva**: sin él, `npm run build` deja de poder pre-renderizar la ruta como estática (riesgo confirmado en el brief de diseño, §7).

**Files:**
- Modify: `app/games/vault-world-cup/play/page.tsx` (reescritura completa; 157 líneas hoy)

**Interfaces:**
- Consumes: TODO el contrato de las Tasks 10-1 a 10-4 — `GameId` incluye `'vault-world-cup'` (para tipar `saveScore`), `VaultWorldCupGameProps` con `onPhaseChange`/`onViewportBlocked` (Task 10-3), `useUser().saveScore`/`useMusic().setTrackOverride` (sin cambios en esos dos ficheros), `GameOverModal` (sin cambios).
- Produces: ninguno — es una `page.tsx`, no exporta nada más que el componente por defecto.

**Decisiones de esta tarea (assumptions, etiquetadas para el Self-Review):**
- **S-D3:** `score`/`clock`/`status` siguen en `useState` normal (patrón ya validado por la página provisional del paso 9), no en refs con escritura directa al DOM como hace Vault Fighter — porque `onScoreChange`/`onClockChange`/`onStatusChange` solo se llaman en el BORDE (`reportHud`/`reportStatus` ya deduplican dentro del componente), nunca por frame; usar refs aquí sería una optimización sin problema que resolver. El PUNTAJE FINAL del Mundial (el que va a `GameOverModal`/`saveScore`) sí usa `scoreRef` (patrón de Vault Fighter y de los otros trece juegos) porque es el mismo valor que un closure async (`onSave`) debe leer sin resquicio de *stale closure*.
- **S-D4:** Sin botón `?` de instrucciones en el HUD de la play-page (Vault Fighter sí lo tiene). El encargo de este plan lista el HUD exacto — «marcador, reloj, estado, SONIDO, PAUSA, AL SELECTOR, SALIR» — sin instrucciones; y la ruta `/games/vault-world-cup/instructions` ya existe para quien las quiera antes de jugar (enlace INSTRUCCIONES del detalle, `app/games/[id]/page.tsx`). No es una omisión: es no añadir una feature que ni el spec ni el encargo piden.
- **S-D5:** SALIR enlaza a `/games/vault-world-cup` (el detalle), no a `/games` (el catálogo entero) como hacía la página provisional del paso 9. Alinea con el patrón de Vault Fighter (`href="/games/vault-fighter"`) y con el propio redirect del bloqueo por viewport de esta misma tarea, que va al mismo sitio.

- [ ] **Step 1: Escribir la página entera**

Reemplazar TODO `app/games/vault-world-cup/play/page.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/app/context/UserContext';
import { useMusic } from '@/app/context/MusicContext';
import GameOverModal from '@/components/GameOverModal';

// The definitive play page (step 10): catalogue entry, migration, music by phase,
// GameOverModal + saveScore, and the viewport-blocked redirect all land here and
// replace the step-9 provisional file. It lives at the same URL on purpose.
const VaultWorldCupGame = dynamic(() => import('@/components/games/VaultWorldCupGame'), { ssr: false });

const IDLE_SCORE = '0 - 0';
const IDLE_CLOCK = '0:00';
const DETAIL_HREF = '/games/vault-world-cup';

// G10-4: the two file tracks of the spec's audio table. Picked by onPhaseChange
// ('menu' | 'match') and by `paused` -- never by anything read off the canvas.
const TRACK_LOBBY = '/vault-futbol-theme-pre-game-lobby.mp3';
const TRACK_GAMEPLAY = '/vault-futbol-theme-game-play.mp3';

// G10-5: how long the blocked panel (drawn by the canvas itself) stays up before the
// redirect to the detail page -- same idea as CreditsToast's DISMISS_MS.
const VIEWPORT_BLOCKED_REDIRECT_MS = 2000;

function isTypingTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  return target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
}

function parseSeed(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function getSavedMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('av_sfx_muted') === 'true';
}

function VaultWorldCupPlayInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const seed = parseSeed(searchParams.get('seed'));
  const { username, saveScore } = useUser();
  const { setTrackOverride } = useMusic();

  const scoreRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<'menu' | 'match'>('menu');
  const [status, setStatus] = useState('SELECTOR');
  const [score, setScore] = useState(IDLE_SCORE);
  const [clock, setClock] = useState(IDLE_CLOCK);
  const [gameKey, setGameKey] = useState(0);

  const [over, setOver] = useState(false);
  const [champion, setChampion] = useState(false);
  const [name, setName] = useState('INVITADO');
  const [saved, setSaved] = useState(false);

  const [viewportBlocked, setViewportBlocked] = useState(false);

  useEffect(() => {
    setMuted(getSavedMuted());
  }, []);

  // G10-4: the lobby track covers every menu screen AND the pause (spec L464); the
  // gameplay track only while a match is actually running.
  //
  // preflight 14-sep: this is intentionally TWO effects, not one. A single effect
  // with `[phase, paused, setTrackOverride]` as deps and `return () =>
  // setTrackOverride(null)` as cleanup would run that cleanup on EVERY phase/pause
  // change too (React tears down and rebuilds an effect whenever any of its deps
  // change, not only on unmount) -- so every lobby<->gameplay transition would
  // detour through `setTrackOverride(null)` (MusicContext's default arcade-theme.mp3)
  // before landing on the right track, reassigning `audio.src` twice per transition
  // for no reason. Splitting the set from the cleanup keeps the edge cheap (it is
  // already deduped inside setTrackOverride's own `if (trackOverrideRef.current ===
  // src) return;`) and restores the context's default track ONLY on unmount, exactly
  // like Vault Fighter's own effect (`app/games/vault-fighter/play/page.tsx:101-108`,
  // deps `[setTrackOverride]` only).
  useEffect(() => {
    setTrackOverride(phase === 'match' && !paused ? TRACK_GAMEPLAY : TRACK_LOBBY);
  }, [phase, paused, setTrackOverride]);

  useEffect(() => {
    return () => setTrackOverride(null);
  }, [setTrackOverride]);

  // G10-5: 2 s after the guard trips, same pattern as CreditsToast's DISMISS_MS -- a
  // timer inside an effect, cleared if the run restarts (or the page unmounts) first.
  useEffect(() => {
    if (!viewportBlocked) return;
    const timer = setTimeout(() => {
      router.push(DETAIL_HREF);
    }, VIEWPORT_BLOCKED_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [viewportBlocked, router]);

  function toggleMuted() {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem('av_sfx_muted', String(next));
      return next;
    });
  }

  const handleScoreChange = useCallback((home: number, away: number) => {
    setScore(`${home} - ${away}`);
  }, []);
  const handleClockChange = useCallback((label: string) => {
    setClock(label);
  }, []);
  const handleStatusChange = useCallback((label: string) => {
    setStatus(label);
  }, []);
  const handlePhaseChange = useCallback((next: 'menu' | 'match') => {
    setPhase(next);
  }, []);
  // Criterion 19 / G10-6: only the World Cup ever calls these two -- a friendly or a
  // training run resolves entirely inside the canvas (GANADOR / EMPATE / ELIMINADO as
  // a caption over the pitch), never with a modal from the page.
  const handleGameOver = useCallback((points: number) => {
    scoreRef.current = points;
    setChampion(false);
    setOver(true);
  }, []);
  const handleVictory = useCallback((points: number) => {
    scoreRef.current = points;
    setChampion(true);
    setOver(true);
  }, []);
  const handleViewportBlocked = useCallback(() => {
    setViewportBlocked(true);
  }, []);

  useEffect(() => {
    if (over) {
      if (username) {
        setName(username);
        return;
      }
      const savedName = localStorage.getItem('av_player_name');
      if (savedName) setName(savedName);
    }
  }, [over, username]);

  // Restart by remount (the repo's mechanism): lands back on the mode selector.
  const restart = useCallback(() => {
    scoreRef.current = 0;
    setScore(IDLE_SCORE);
    setClock(IDLE_CLOCK);
    setStatus('SELECTOR');
    setPaused(false);
    setOver(false);
    setChampion(false);
    setSaved(false);
    setViewportBlocked(false);
    setName(username ?? 'INVITADO');
    setGameKey((k) => k + 1);
  }, [username]);

  // P pauses, R restarts -- only once a World Cup has reported its end (a stray R
  // mid-match must not wipe a run; inside a training match R is the game's own exit,
  // handled entirely by the component's own keydown handler, never by the page).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.repeat || isTypingTarget(e)) return;
      const key = e.key.toLowerCase();
      if (key === 'p') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (key === 'r' && over) {
        e.preventDefault();
        restart();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [over, restart]);

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
              <div className="v">{paused ? 'EN PAUSA' : status}</div>
            </div>
          </div>
          <div className="hud-actions">
            <button className="btn ghost" onClick={toggleMuted}>
              {muted ? 'SONIDO OFF' : 'SONIDO ON'}
            </button>
            <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
              {paused ? 'REANUDAR' : 'PAUSA'}
            </button>
            <button className="btn cyan" onClick={restart}>
              AL SELECTOR
            </button>
            <Link className="btn ghost" href={DETAIL_HREF}>
              SALIR
            </Link>
          </div>
        </div>
      </div>

      <div className="crt w-full max-w-[840px] mx-auto">
        <div className="crt-screen crt-screen--scale-canvas" style={{ aspectRatio: '8 / 5' }}>
          <VaultWorldCupGame
            key={gameKey}
            paused={paused || over}
            muted={muted}
            seed={seed}
            onScoreChange={handleScoreChange}
            onClockChange={handleClockChange}
            onStatusChange={handleStatusChange}
            onPhaseChange={handlePhaseChange}
            onGameOver={handleGameOver}
            onVictory={handleVictory}
            onViewportBlocked={handleViewportBlocked}
          />
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>VAULT WORLD CUP · CRT-80 · 60 HZ</span>
          <span>9 VS 9</span>
        </div>
      </div>

      {over && (
        <GameOverModal
          variant={champion ? 'victory' : 'defeat'}
          score={scoreRef.current}
          name={name}
          onNameChange={setName}
          saved={saved}
          onSave={async () => {
            setSaved(true);
            localStorage.setItem('av_player_name', name);
            await saveScore({
              gameId: 'vault-world-cup',
              playerName: name,
              score: scoreRef.current,
            });
          }}
          onRestart={restart}
          leaderboardHref={`${DETAIL_HREF}#leaderboard`}
        />
      )}
    </div>
  );
}

export default function VaultWorldCupPlay() {
  return (
    <Suspense>
      <VaultWorldCupPlayInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: `tsc` limpio**

Run: `npx tsc --noEmit`
Expected: sin salida. Si `saveScore({ gameId: 'vault-world-cup', … })` da un error de tipo, es que la Task 10-1 no se cerró antes que esta (`GameId` no incluye todavía `'vault-world-cup'`) — resolver ahí, no aquí.

- [ ] **Step 3: Suite completa (sin regresión: esta tarea no añade tests)**

Run: `npx vitest run`
Expected: **1186 tests en 69 ficheros**, igual que al cerrar la Task 10-4 — una `page.tsx` no lleva test unitario (rAF + canvas + DOM, como el resto de `play/page.tsx` del repo).

- [ ] **Step 4: `npm run build`, y que la ruta siga estática**

Run: `npm run build`
Expected: exit 0; en la tabla de rutas de la salida, `/games/vault-world-cup/play` sigue marcada **○ (Static)** — exactamente como confirmó el paso 9 (C1 del `final-review-report.md`): el `<Suspense>` alrededor de `useSearchParams()` es lo que lo permite, y esta reescritura lo conserva íntegro.

- [ ] **Step 5: Invariantes de la página**

Run:

```bash
grep -n "mode\.kind\|m\.kind" app/games/vault-world-cup/play/page.tsx
grep -c "Date.now()" app/games/vault-world-cup/play/page.tsx
grep -n "PASO 9\|PROVISIONAL" app/games/vault-world-cup/play/page.tsx
grep -n "MobileGamepad\|useGameSkin" app/games/vault-world-cup/play/page.tsx
```

Expected: los cuatro vacíos salvo el segundo, que debe ser **0** (esta página no lee el reloj del sistema, a diferencia del componente).

- [ ] **Step 6: Ledger y proponer commit**

Actualizar `.superpowers/sdd/2026-09-14-vault-world-cup-step-10/progress.md`:

```markdown
## Task 10-5: DONE
- app/games/vault-world-cup/play/page.tsx: reescritura completa (espejo Vault Fighter).
- Música por fase (onPhaseChange + paused -> setTrackOverride), GameOverModal+saveScore solo Mundial,
  redirect 2s tras onViewportBlocked, SALIR/detalle alineado con Vault Fighter (S-D5).
- Sin MobileGamepad, sin selector de skin, sin botón de instrucciones (S-D4).
- Suite: 1186/1186 (69 ficheros, sin cambio). tsc limpio. build exit 0, ruta sigue estática.
```

No ejecutar `git commit`. Mensaje propuesto:

`feat(world-cup): definitive play page — phase-driven music, GameOverModal for the World Cup only, viewport-blocked redirect`

**QA de Paco para esta tarea:** la lista completa está en el «Cierre del paso 10».

---

## Cierre del paso 10

- [ ] **C1: La suite, el compilador y el build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: los **1171 tests de partida siguen verdes**, más los nuevos, con este reparto contado uno a uno sobre los tests escritos en este plan:

| Tarea | Fichero | Tests | Acumulado |
|---|---|---:|---:|
| — | baseline (`a7a9fdf`) | 1171 | 1171 |
| 10-1 | `lib/games-registry.test.ts` (+1) | 1 | 1172 |
| 10-2 | `lib/sfx-vault-world-cup.test.ts` (+2), `football-screen/sfx-map.test.ts` (+4), `football-logic/mode.test.ts` (+3), `football-screen/flow.test.ts` (+1) | 10 | 1182 |
| 10-3 | (ninguno — solo el `.tsx`, sin test unitario) | 0 | 1182 |
| 10-4 | `app/games/desktop-only.test.ts` (4, fichero nuevo) | 4 | 1186 |
| 10-5 | (ninguno — solo la `page.tsx`, sin test unitario) | 0 | **1186** |

Es decir **1186 tests en 69 ficheros** (68 + `app/games/desktop-only.test.ts`). `tsc` sin salida. `npm run build` exit 0, con `/games/vault-world-cup/play` todavía `○ (Static)` en la tabla de rutas. **Anotar el recuento exacto en el ledger**: la puerta que importa es el criterio 21 (**la suite no baja de 1171**) y que ninguno de los 1171 anteriores esté rojo; el número anunciado es una previsión, no una aserción.

- [ ] **C2: El motor solo cambió en la Task 10-2, y solo `mode.ts`**

Run:

```bash
git diff --stat c5d1e52 -- components/games/football-logic/
git status --short components/games/football-logic/
git diff c5d1e52 -- components/games/football-logic/mode.ts | grep "^+" | grep -v "^+++" | wc -l
```

Expected: el `diff --stat` lista **exactamente** `mode.ts` y `mode.test.ts`; `git status --short` muestra `M` en esos dos y nada más (ningún `??` en `football-logic/`: este paso no crea ficheros ahí); el recuento de líneas añadidas a `mode.ts` está **por debajo de 15** (`modeHasCrowd` son 3 líneas de cuerpo + comentario) — la única grieta autorizada, y sigue siendo pequeña.

- [ ] **C3: Invariantes de cierre**

Run:

```bash
grep -rn "Math.random" components/games/football-screen/ components/games/football-logic/ components/games/VaultWorldCupGame.tsx
grep -n "mode\.kind\|m\.kind\|kind === '\(friendly\|training\|world\)" components/games/VaultWorldCupGame.tsx app/games/vault-world-cup/play/page.tsx app/games/GamesGrid.tsx app/games/desktop-only.ts
grep -c "Date.now()" components/games/VaultWorldCupGame.tsx app/games/vault-world-cup/play/page.tsx
grep -rn "PASO 9\|PROVISIONAL" app/games/vault-world-cup/
grep -n " as " app/games/desktop-only.ts app/games/GamesGrid.tsx app/games/vault-world-cup/play/page.tsx components/games/VaultWorldCupGame.tsx
grep -rn "MobileGamepad\|useGameSkin" app/games/vault-world-cup/
```

Expected: los cinco primeros greps **vacíos** (el tercero, `Date.now()`, cuenta **1** en `VaultWorldCupGame.tsx` — el de `confirmTeam`, G9-7 — y **0** en la play-page); el último (`MobileGamepad`/`useGameSkin`) también vacío: G10-7 se cumple, este juego no los usa en ningún sitio bajo `app/games/vault-world-cup/`.

- [ ] **C4: Migración y `GameId` coinciden**

Run: `grep -n "'vault-world-cup'" lib/games-registry.ts supabase/migrations/20260914103000_add_vault_world_cup_game.sql`
Expected: la cadena `'vault-world-cup'` aparece en los dos ficheros, carácter a carácter idéntica (comillas simples incluidas). Confirmar también con `sqlite3`/lectura manual que el `INSERT` no tiene ninguna coma ni paréntesis descolocado (no hay CLI de Supabase para validarlo automáticamente, ver Global Constraints).

- [ ] **C5: La tabla de audio del spec, fila por fila**

| Fichero | Disparador | Cableado en | Confirmado en este cierre |
|---|---|---|---|
| `vault-futbol-theme-pre-game-lobby.mp3` | Menú/previa y pausa | Task 10-5 (`onPhaseChange`/`paused` → `setTrackOverride`) | ✅ nuevo este paso |
| `vault-futbol-theme-game-play.mp3` | `kickoff` → `over`, sin pausa | Task 10-5 | ✅ nuevo este paso |
| `vault-futbol-whistle-start.mp3` | Inicio de parte/tanda | Paso 8-9 (`sfx-map.ts`) | ya estaba |
| `vault-futbol-whistle-end.mp3` | `endHalf`/`over` | Paso 8-9 | ya estaba |
| `vault-futbol-whistle-foul.mp3` | Falta/penalti/gol | Paso 8-9 | ya estaba |
| `vault-futbol-goal-net.mp3` | 1º cadena de gol | Paso 8-9 | ya estaba |
| `vault-futbol-goal-shout.mp3` | 2º cadena de gol | Paso 8-9 | ya estaba |
| `vault-futbol-goal-crowd.mp3` | 3º cadena de gol | Paso 8-9 | ya estaba |
| `vault-futbol-crowd-ambience.mp3` | 2-3 ráfagas/parte, **solo con reloj** | Paso 8-9 + **Task 10-3 (gate `modeHasCrowd`)** | ✅ el gate es nuevo este paso |
| `vault-futbol-kick.mp3` | Chut con `ok` | Paso 8-9 | ya estaba |
| `vault-futbol-pass.mp3` | Pase corto con `ok` | **Task 10-2 (fichero) + 10-3 (consumo)** | ✅ nuevo este paso |
| `vault-futbol-chants-victory.mp3` | Victoria, ganancia por `FxKind` | Paso 9 | ya estaba (G10-8: ganancias 0,4/1 sin cambios) |
| `vault-futbol-crossbar.mp3` | Reservado | — | sin consumidor, v1.5 (sin cambios) |
| *(sin fichero)* | Entrada al suelo | — | sigue en silencio, S-SC10 pendiente de Paco (sin cambios, fuera de alcance) |

Todas las filas del paso 10 (pase corto, las dos pistas, el gate del ambiente) quedan cableadas; las demás ya lo estaban desde el paso 8/9 y este plan no las toca.

### Peticiones separadas al motor

**Ninguna.** El motor congelado en `c5d1e52` solo necesitó la grieta ya prevista por G10-3 (`modeHasCrowd`, 3 líneas). No ha aparecido ninguna necesidad de tocar `football-logic/` más allá de eso: ni el pase corto, ni el viewport, ni la fase de flujo, ni el catálogo necesitan nada del motor que no exista ya. Si el QA de Paco (más abajo) encuentra algo que sí lo requiera, es candidato al paso 11 (la ola de ajustes), no a una reapertura de este plan.

### Lista de QA manual para Paco

1. **Catálogo** (`/games`): la tarjeta de VAULT WORLD CUP muestra la carátula `vault-futbol.png`, categoría SPORTS, título correcto y el botón JUGAR.
2. **Detalle** (`/games/vault-world-cup`): la descripción larga se lee bien, el enlace INSTRUCCIONES lleva a una pantalla legible con los tres botones, el pulsar/mantener y los cuatro modos.
3. **JUGAR deshabilitado**: encoger la ventana del navegador por debajo de 768 × 560 en `/games` — la tarjeta de VAULT WORLD CUP cambia a SOLO ESCRITORIO (sin enlace); las otras trece tarjetas no se ven afectadas; agrandar la ventana devuelve JUGAR.
4. **Música lobby ↔ partido**: entrar en la play-page, comprobar que suena la pista de lobby en el selector/selección/sorteo/cuadro, que cambia a la de partido al arrancar un Mundial o amistoso, y que vuelve a la de lobby al pulsar PAUSA (y de vuelta a la de partido al reanudar).
5. **Pase corto suena, el largo no cambia**: jugar un rato, pulsar B para pase corto (debe sonar, más flojo que el chut) y mantener B para pase largo (debe seguir en silencio, sin fichero en la v1).
6. **Sin público en ENTRENAMIENTO**: entrar en el modo ENTRENAMIENTO y confirmar que no suena ninguna ráfaga de público en ningún momento; jugar un AMISTOSO o un partido del MUNDIAL y confirmar que sí se oyen 2-3 ráfagas por parte.
7. **Mundial completo → modal → guardar → tabla**: jugar (o simular) un Mundial hasta CAMPEONES DEL MUNDO o hasta ELIMINADO; en los dos casos debe aparecer el `GameOverModal` con la puntuación acumulada, GUARDAR PUNTUACIÓN debe escribir en Supabase y la fila debe aparecer en la tabla del detalle.
8. **Amistoso y entrenamiento sin modal**: terminar un AMISTOSO (ganado o perdido) y una sesión de ENTRENAMIENTO (con R); en ningún caso debe aparecer el `GameOverModal` ni escribirse nada en la tabla.
9. **Redirect por viewport en partida**: entrar en un partido y encoger la ventana por debajo del umbral; el canvas debe mostrar el panel de bloqueo y, 2 segundos después, la página debe redirigir sola a `/games/vault-world-cup`.
10. **SONIDO ON/OFF, PAUSA/REANUDAR, AL SELECTOR, SALIR**: los cuatro botones del HUD hacen lo que dicen, y SALIR lleva al detalle del juego (no al catálogo entero).

- [ ] **C6: Proponer commit del cierre**

No ejecutar. Si Paco prefiere un solo commit para todo el paso en vez de los cinco propuestos por tarea, este es el mensaje agregado:

`feat(world-cup): step 10 close-out — catalogue entry (game 14), missing audio, viewport gating, definitive play page`

- [ ] **C7: Hand-off al paso 11**

El paso 11 (fuera de este plan) es la «ola de ajustes» que el spec ya lista, recopilada de los dos QA jugados (paso 8, 09-sep; paso 9, 11-sep) y de lo que quede pendiente después del QA manual de este cierre:
- Dibujo del jugador visto desde arriba (figura, no círculo) y portero que se estira al parar — solo `drawPlayer`/el gesto del portero, cero asignación por frame (criterio 20).
- Chuts con altura visible (sombra + escala del balón, `SHOT_VZ_MAX` ya existe en el motor).
- Gesto de gol visible (red que se mueve o balón dentro de la red).
- Entrada al suelo sin fichero (S-SC10): decisión de Paco pendiente — síntesis WebAudio breve o silencio definitivo.
- Discrepancia de ganancia de los cánticos (0,4/1 en código frente a 0,24/0,6 citados en una petición anterior, `final-review-report.md` C7-7): confirmar con Paco cuál es la serie vigente antes de tocar `CHANTS_LOW_GAIN`.
- Opinión sobre el minimapa dentro del campo semitransparente (Claude, sin decidir).
- Cualquier hallazgo del QA manual de este mismo cierre (§ arriba) que no bloquee el paso 10 pero convenga arreglar antes de dar la v1 por cerrada.

---

## Self-Review (skill `superpowers:writing-plans`)

**1. Cobertura del spec.** Repaso del punto 10 (`§Etapa D`), la tabla de audio, y las decisiones G10-1..10:

| Requisito | Tarea |
|---|---|
| Registro (`GameId` + `GAMES`), instrucciones con los tres botones y pulsar/mantener (G10-1, G10-10) | 10-1 |
| Migración `INSERT INTO games` (G10-1, G10-10) | 10-1 |
| Test del registro 13 → 14 (G10-10) | 10-1 |
| Pase corto: fichero + disparador + consumo (G10-2) | 10-2 (fichero + disparador), 10-3 (consumo en `runStep`) |
| Público solo con reloj: `modeHasCrowd` + gate (G10-3) | 10-2 (`modeHasCrowd`), 10-3 (gate en `runStep`) |
| `onPhaseChange` derivado de `FlowPhase` (G10-4) | 10-2 (`phaseGroup`), 10-3 (prop + `reportPhase` + cableado), 10-5 (consumo en la play-page con `setTrackOverride`) |
| Música por fase + pausa, limpieza al desmontar (G10-4) | 10-5 |
| `onViewportBlocked` + redirect 2 s (G10-5) | 10-3 (prop + llamada en el borde), 10-5 (temporizador + `router.push`) |
| Catálogo deshabilita JUGAR solo para `vault-world-cup`, SOLO ESCRITORIO, sin columna de BD (G10-5) | 10-4 |
| `GameOverModal` + `saveScore` solo desde `onGameOver`/`onVictory` (G10-6) | 10-5 (el filtro ya vive en el componente desde el paso 9; la play-page solo lo respeta) |
| Silencio como Vault Fighter: HUD = SFX, música = global; sin `MobileGamepad` ni skins (G10-7) | 10-1 (`skins: CLASSIC_SKINS` sin selector en la página), 10-5 (sin `MobileGamepad`, sin `useGameSkin`) |
| Ganancias de cánticos sin cambios (G10-8) | ninguna — confirmado que no se toca `CHANTS_LOW_GAIN` (Cierre, C5) |
| Créditos sin cambios (G10-9) | ninguna — confirmado en la investigación previa a este plan: `gamesPlayed`/`catalogSize` se derivan solos |
| Registro/migración/test 14/instrucciones, carátula ya existe (G10-10) | 10-1 |
| Criterio 19 (solo el Mundial puntúa) | ya lo cumplía el componente del paso 9; 10-5 no lo reabre, solo lo consume |
| Criterio 20 (cero asignación por frame) | 10-3 (`reportPhase` es una comparación, no una asignación) |
| Criterio 21 (suite ≥ 1171) | Cierre C1 |
| Criterios 22-23 (QA humano, tanda determinista) | ya cerrados en pasos anteriores; sin cambios aquí |

Sin huecos: las diez líneas de G10-1..10 y el punto 10 completo tienen una tarea que los implementa.

**2. Barrido de placeholders.** Ninguna tarea usa «TBD», «implementar después», «similar a la tarea N» ni «añadir manejo de errores» sin código. Cada bloque de código de este plan es el código real a escribir, con su ruta y sus líneas exactas verificadas contra el repo al momento de escribir el plan (`sed -n`/`grep -n` citados en cada tarea). Las dos referencias a trabajo diferido (`S-SC10` entrada al suelo, discrepancia de cánticos) están explícitamente fuera de alcance del spec y del encargo, no son placeholders de este plan.

**3. Consistencia de tipos y nombres.** Repasados uno a uno:
- `PhaseGroup` se declara en `football-screen/flow.ts` (Task 10-2) y se usa con el mismo nombre en `VaultWorldCupGameProps.onPhaseChange` (Task 10-3) y como el tipo estructural `'menu' | 'match'` en el estado local de la play-page (Task 10-5) — mismo conjunto de valores, sin renombrar.
- `modeHasCrowd(m: GameMode): boolean` (Task 10-2) se llama exactamente así en `runStep` (Task 10-3): sin `modeCrowd`, sin `hasCrowd`.
- `shortPassFiredThisStep(match: MatchState): boolean` (Task 10-2) — mismo nombre en `runStep` (Task 10-3); no se confunde con `shotFiredThisStep`, que sigue intacto.
- `isDesktopOnlyBlocked(gameId: string, width: number, height: number): boolean` (Task 10-4) — mismo orden de parámetros en su único consumidor (`GamesGrid.tsx`).
- `onViewportBlocked?: () => void` (Task 10-3) se consume sin argumentos en la Task 10-5 (`setViewportBlocked(true)`), consistente con la firma.
- `saveScore({ gameId: 'vault-world-cup', … })` (Task 10-5) tipa contra el `GameId` que la Task 10-1 amplía — si el orden de ejecución se invirtiera, `tsc` lo señalaría de inmediato (ya anotado como aviso en la Task 10-5, Step 2).

Sin incoherencias encontradas; no hace falta ninguna corrección posterior a este Self-Review.
