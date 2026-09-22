# Vault World Cup — v1.5, paso V15-2 «Mandos» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tres mejoras de control para VAULT WORLD CUP: (G15-5) cambiar de jugador a mano con C (tecla L) cuando defiendes; (G15-6) elegir en ELIGE MODO entre dos teclados de solitario, «Flechas» y «Clásico», con la pausa en Esc y la elección guardada en `localStorage`; (G15-20) jugar con un mando físico por la Gamepad API, con un módulo común `lib/gamepad` — **tocando del motor solo lo imprescindible para G15-5**, sin regrabar nada y sin asignar memoria por frame (salvo la excepción anotada de `navigator.getGamepads()`, acotada a mientras haya algún mando visto: pre-vuelo H8).

**Architecture:** El cambio manual es la única pieza de motor: una función pura de selección en `actions.ts` (`nextManualControl`, rango por distancia sin asignar) y, en `match.ts`, un estado `manualSwitch` (bloqueo + retención del sprint) que se arma con el flanco `c === 'pressed'` dentro de `stepOpenPlay`, se respeta al derivar el controlado al final de `stepMatch` y se borra en cuanto la fase deja de ser juego abierto. La CPU nunca emite `c: 'pressed'` (`ai.ts` solo escribe `'held'`/`'up'` en `c`), así que para ella todo es un no-op y las grabaciones no se mueven: la suite lo demuestra y un control negativo demuestra que la suite lo detectaría. Los teclados son tablas `KeyTable` nuevas en `keyboard.ts` (`ARROWS_SOLO`, `CLASSIC_SOLO`) con una regla de pausa derivada de las tablas (`isPauseKey`: Esc siempre; P solo si ninguna tabla activa la lee); el esquema vive en `FlowState`, los textos se precalculan por esquema en un módulo puro nuevo (`control-hints.ts`) y la pausa se muda de la play-page al componente (prop `onPauseToggle`). El mando se lee en dos capas: `lib/gamepad.ts` (puro: instantánea → estado de mando con zona muerta y flancos) y `lib/gamepad-navigator.ts` (la única línea que toca `navigator`); un adaptador puro en `football-screen/gamepad-input.ts` lo convierte en las **mismas entradas que el teclado** (`padDown`/`padUp` sobre un `PadState` propio que se funde con el del teclado en `overlayPadToTeamInput`), y los menús pasan a actuar por `PadKey` (`menuAction`), de modo que teclado y mando comparten un solo camino.

**Tech Stack:** TypeScript estricto, React 19.2.4, Next 16.2.6 (App Router), canvas 2D 800 × 500, Gamepad API del navegador, vitest 4.1.11 (tests `*.test.ts` junto al código, **sin `vitest.config`**, entorno Node sin DOM, **imports relativos** — el alias `@/` no existe en vitest).

**Spec:** `specs/31-vault-world-cup.md` (Approved) — bullet «Grill de la v1.5 (Paco, 2026-09-17), decisiones G15» (**G15-5**, **G15-6**, **G15-15**) y bullet «Ampliación tras el QA de V15-1 (Paco, 2026-09-21)» (**G15-20**, **G15-22**); **G9-2** (reparto a dos) en «Decisiones tomadas»; criterios de aceptación **1, 2, 4, 5, 14, 20 y 21**. Las decisiones G15 son ley y no se reabren en este plan.
**Informe obligatorio:** `.superpowers/sdd/2026-09-17-vault-world-cup-v1-5/design-brief.md` §0 (hallazgos 3, 4 y 8), §2 (cambio manual, opción 2-A) y §4 (teclado, opción 4-A y la salida (iii) del conflicto de la P).
**Código a imitar:** `components/games/football-logic/ai.ts:205-212` (`chaseRank`: rango por distancia sin asignar, desempate por id) · `components/games/football-logic/actions.ts:356-380` (`updateTeamControl`) · `components/games/football-screen/keyboard.ts` (tablas derivadas con `pickBindings`, máquina de estados de botón `pressButton`/`releaseButton`/`settle`) · `components/games/football-screen/flow.ts` (fases puras y probadas; el componente solo pregunta).
**Código a modificar:** motor — `football-logic/actions.ts`, `football-logic/match.ts` (+ sus tests); pantalla — `football-screen/keyboard.ts`, `football-screen/flow.ts`, `football-screen/flow-layout.ts` (+ tests), `components/games/VaultWorldCupGame.tsx`, `app/games/vault-world-cup/play/page.tsx`, `lib/games-registry.ts` (+ test); spec — una anotación en `specs/31-vault-world-cup.md`.
**Código nuevo:** `football-screen/control-hints.ts`, `football-screen/gamepad-input.ts`, `lib/gamepad.ts`, `lib/gamepad-navigator.ts` (+ los tests de los tres puros).
**Ledger de este paso:** `.superpowers/sdd/2026-09-22-vault-world-cup-v15-2/` (directorio ya creado; sin `progress.md` todavía, pero no vacío: contiene `sdd.sh` del controlador). El controlador crea allí `progress.md` al empezar la ejecución SDD; cada tarea le añade **una** línea al cerrar; la tarea de cierre escribe `qa-paco.md`.

---

## Global Constraints

**Los requisitos de cada tarea incluyen implícitamente esta sección.**

### Las decisiones del grill que este paso ejecuta (copiadas literalmente del spec)

- **G15-5 Cambio manual (Paco):** L con el rival en posesión o balón suelto (no con tu portero ni en saques) → pasa al siguiente compañero más cercano al balón (excluye el actual); pulsaciones repetidas van rotando entre los más cercanos. Pulsar = solo cambio, sin sprint (mantener L después sí esprinta; CPU intacta). Bloqueo ~0,6 s (ajuste en QA). Aplica en entrenamiento y a dos (J1 = B); no en la tanda. Motivo de Paco: el juego es rápido y hoy apetece cambiar y no se puede. Anotar en spec que «controlled derivado, nunca input» deja de valer para el humano.
- **G15-6 Teclado (Paco):** en solitario/entrenamiento/Mundial se elige entre DOS esquemas: «Flechas» = flechas + J/K/L (esquema 3 del spec) y «Clásico» = Q/A/O/P + Z/X/C (esquema 2). El esquema 1 (WASD+flechas) deja de ser opción elegible. Son disjuntos «por si juegan dos juntos». Pausa: con Clásico la P se ignora y pausa Esc; Esc pausa en ambos. Selector = fila en ELIGE MODO. Persistencia en localStorage (try/catch). Partido a dos: NO elegible, mantiene G9-2 (J1 WASD+C/V/B, J2 flechas+J/K/L). Default = Flechas.
- **G15-15 (tramo V15-2):** V15-2 Mandos (cambio L, teclados Flechas/Clásico, Esc, localStorage; motor sin regrabado).
- **G15-20 · Mando físico**: Gamepad API; módulo común `lib/gamepad` que traduce a las mismas entradas que el teclado (reutilizable en el portal), aplicado ahora solo a VAULT WORLD CUP. Mapeo estándar: stick izq./cruceta = mover; abajo (A/✕) = chut; derecha (B/○) = pase; izquierda (X/□) = sprint/cambio; L1/R1 = estrategia; Start = pausa. Teclado sigue activo a la vez; a dos: mando 1 = J1, mando 2 = J2 (si solo hay uno, J2 teclado). Menús navegables con mando. Excepción anotada al criterio 20: `navigator.getGamepads()` crea el array por frame **mientras haya algún mando visto** (sondeo condicionado por `gamepadSeen`, pre-vuelo H8 — con solo teclado, `pollGamepads` no se llama nunca). En V15-2 (1,5-2 días).
- **G9-2 · Amistoso a dos = mismo teclado, no online** (sigue vigente, NO se toca): J1 (izquierda) mueve con W/A/S/D y A/B/C en C/V/B, formación 1-2-3 y estrategia 4-5-6; J2 (derecha) mueve con las flechas y A/B/C en J/K/L, formación 7-8-9 y estrategia 0 ' ¡.

**Fuera de V15-2 (no se toca aunque «quede cerca»):** 20 selecciones, rejilla 5×4, Mundial de 16, minicampo, plantilla y ALINEACIÓN (V15-3); 11v11, atributos, postes, tarjetas, lesiones, pausa de gol de 4 s (V15-4, con su regrabado); celebraciones, red, nombres, pantalla previa (V15-5). Los textos del catálogo que hablan de «ocho de dieciséis» se quedan: los cambia V15-3. `ai.ts` NO se toca (ni su comentario de `positionTeam` «rank 0 is the controlled», que el cambio manual vuelve inexacto: va a «Peticiones separadas al motor» para V15-4, que ya regraba).

### Criterios del spec (copiados literalmente)

> 1. **Misma semilla y misma secuencia de entradas producen el mismo estado**, paso a paso, en un partido completo. Hay test que lo fija. **La simulación es de paso fijo** (`STEP_MS`): ningún `dtMs` entra en el motor.
> 2. **El motor no distingue quién mueve cada equipo**: `stepMatch` recibe dos `TeamInput` y ningún módulo de `football-logic/` lee teclado, `Math.random` ni estado de módulo.
> 4. **Nueve por equipo**, y el portero nunca es el jugador controlado.
> 5. **Se controla siempre el más cercano al balón**, con histéresis de 40 u para que no parpadee, y el cambio es automático y derivado del estado (no es entrada).
> 14. **Amistoso contra la CPU y amistoso a dos en el mismo teclado**, y en el de dos ningún equipo tiene ventaja de entrada — mismo motor, mismas velocidades.
> 20. **Ninguna asignación de memoria por frame** en el bucle ni en el dibujo, incluido el confeti (depósito de partículas creado una vez).
> 21. **La suite sigue verde y no baja de los 861 tests (cierre de la etapa B, 2026-09-06)** de partida.

El criterio 5 queda **matizado** por G15-5 (lo anota la Task V15-2-2 en el spec): el cambio manual sale de la entrada del humano, pero el replay sigue siendo semilla + `TeamInput`, así que el criterio 1 se mantiene intacto (test nuevo en V15-2-2). El criterio 2 también: el motor sigue sin saber quién es humano; solo reacciona a un flanco que la CPU no emite.

Traducción operativa del criterio 20 para este paso: dentro de `draw()` y sus `draw*`, `update`, `runStep`, `loop` y `pollGamepadFrame` no hay `new`, literales de objeto o array, plantillas ni concatenaciones de string, `.map/.filter/.slice/.split`, ni cierres (`=>`) nuevos. Todos los textos por esquema se construyen **una vez al cargar** `control-hints.ts`; el estado del mando, los dos `PadState` del mando y el `physicsInputs` del motor se crean **una vez** (al montar / en `createMatch`). **Única excepción, anotada en G15-20:** `navigator.getGamepads()` devuelve un array nuevo en cada llamada (y, en Chrome, una instantánea `Gamepad`/`GamepadButton` nueva por mando conectado); vive aislada en `lib/gamepad-navigator.ts` con un comentario que lo dice, y `pollGamepadFrame` (`.tsx`) solo la llama **mientras haya algún mando visto** (`gamepadSeen`, pre-vuelo H8): con solo teclado, la excepción no se ejecuta ni un frame.

### Reglas del repo

- **Commits: SOLO Paco.** Ninguna tarea ejecuta `git add`, `git rm`, `git commit` ni `git stash`. Donde un plan de superpowers diría «Commit», aquí dice: **dejar el working tree verificado; commit lo hace Paco**. Al final (Task V15-2-8) se propone **UN** mensaje de commit convencional para todo el paso.
- **Rama `main`. HEAD de hoy: `b130c06`** (docs de specs/handoff G15-16..22 sobre `90dc114`, el commit de V15-1). Al escribir el plan: plan añadido al índice (`A`), `specs/31-vault-world-cup.md` y `tasks/vault-world-cup/HANDOFF-next-session.md` modificados por docs, y el directorio del ledger ya creado (con `sdd.sh` del controlador, no vacío). Nada de esto es código: todas las compuertas comparan contra `b130c06` y se acotan a `*.ts`/`*.tsx`.
- **NUNCA arrancar `next dev` ni `next build`.** Paco tiene el suyo en `:3000`. La verificación de cada tarea es `npx vitest run <fichero>` → `npx vitest run` → `npx tsc --noEmit` → `npx eslint <ficheros tocados>`. **El QA jugado (teclados, mando USB/Bluetooth, dos mandos, cambio con L) lo hace Paco** con la lista que deja escrita la tarea de cierre.
- **EL MOTOR NO SE TOCA salvo G15-5, y solo en estos cuatro ficheros:** `components/games/football-logic/actions.ts`, `actions.test.ts`, `match.ts`, `match.test.ts`. Compuerta al cerrar **cada** tarea:
  ```bash
  git diff --name-only b130c06 -- components/games/football-logic/ | sort
  ```
  Esperado: **vacío** tras V15-2-1 salvo `actions.ts`/`actions.test.ts`; desde V15-2-2 en adelante, **exactamente** estas cuatro líneas y ninguna más:
  ```
  components/games/football-logic/actions.test.ts
  components/games/football-logic/actions.ts
  components/games/football-logic/match.test.ts
  components/games/football-logic/match.ts
  ```
  En particular `ai.ts`, `ai.test.ts`, `step.ts`, `players.ts`, `input.ts` y `set-pieces.ts` quedan **byte a byte** como en `b130c06` (los controles negativos que los tocan se deshacen en el acto).
- **Sin regrabado (G15-15):** ningún valor esperado de un test existente del motor cambia — en particular las grabaciones CPU-contra-CPU de `ai.test.ts` (`keeperLeftLineOutsideSmallArea` 69, la tabla `EXPECTED_OUTSIDE_SMALL_AREA` por pareja, `sameFinal`) y las de `match.test.ts` («full match with recorded inputs»). `git diff b130c06 -- components/games/football-logic/ai.test.ts` vacío lo garantiza; la Task V15-2-2 demuestra con un control negativo que esas grabaciones **sí** detectarían una CPU que pulsara C.
- **Determinismo (criterios 1 y 2):** `grep -rn "Math.random" components/games/football-logic/ components/games/football-screen/ lib/gamepad.ts lib/gamepad-navigator.ts` debe devolver **VACÍO** al cerrar cada tarea (tests incluidos). Ningún fichero nuevo de `football-screen/` ni `lib/gamepad.ts` importa React ni toca `document`, `window`, `navigator` ni `localStorage`: `navigator` solo en `lib/gamepad-navigator.ts`; `window.localStorage` solo en el `.tsx`, a través de dos cierres creados una vez al montar y envueltos en el `try/catch` de `loadKeyScheme`/`saveKeyScheme`.
- **Instantáneas bajo `.superpowers/`: solo `.txt`.** Si el controlador guarda una copia de un fichero de código antes de una tarea, va con extensión `.txt` (p. ej. `snapshot-before-v15-2-5/components_games_VaultWorldCupGame.tsx.txt`). **Ninguna copia `*.ts`/`*.tsx` bajo `.superpowers/`**: `tsc` y vitest las recogerían.
- **Baseline medida hoy (2026-09-22, HEAD `b130c06`, `npx vitest run` ejecutado al escribir este plan): 1291 tests en 77 ficheros verdes.** Objetivo al cerrar el paso: **1335 tests en 80 ficheros** (1291 + 5 + 9 + 6 + 9 + 0 + 8 + 7; 77 + 1 + 1 + 1). Ningún test existente del **motor** cambia de valor esperado. En `keyboard.test.ts`, tres tests cambian de cuerpo porque G15-6 retira WASD del solitario a propósito (se reescriben, no se borran: el recuento se conserva) y el resto cambia `SOLO` por `ARROWS_SOLO` sin tocar valores.
- **ESLint de partida (medido hoy):** `app/games/vault-world-cup/play/page.tsx` ya da **3 errores** de `react-hooks` en `b130c06` (`:76` y `:192` `set-state-in-effect`, `:299` `refs`); no se arreglan en este paso (fuera de alcance). Criterio en cada gate: **ningún error nuevo** — en `page.tsx` siguen siendo exactamente esos 3 (con las líneas desplazadas unas pocas posiciones por el `togglePause`); el resto de ficheros, `eslint` sin salida.
- **Tests con imports RELATIVOS** (`from './keyboard'`, `from '../football-logic/input'`, `from '../../../lib/gamepad'`).
- **Comentarios, identificadores y nombres de tests (`describe`/`it`) en inglés** (convención del repo). El plan, el spec, el chat y los textos de UI, en castellano.
- **Ficheros en kebab-case**, salvo `VaultWorldCupGame.tsx`. Tipos en PascalCase, `SCREAMING_CASE` para constantes de módulo. TypeScript estricto: nada de `any`, **nada de `as`** nuevo para tapar un tipo (se estrecha con comparaciones o predicados), **ningún `!` nuevo**. (Los `as` que ya existen — `e.target as HTMLElement | null`, `0 as const` — no se tocan.)
- **Un test que pasa no prueba nada hasta verlo fallar** (regla de Paco). Cada tarea tiene su paso «ver en rojo» y su **control negativo** con el resultado esperado escrito literalmente; si un control negativo no hace fallar lo que dice, el test es vacuo y se arregla antes de seguir.
- **Números de línea = orientativos.** Cada cita de línea va con el texto literal a buscar; si las líneas se han desplazado, manda el texto.

### Orden y paralelismo (para SDD)

**Las ocho tareas se ejecutan EN SERIE, una detrás de otra — V15-2-1 → … → V15-2-8 — nunca en paralelo**, aunque algunas toquen ficheros disjuntos (el motor frente a `lib/gamepad.ts`, por ejemplo). Motivo (mismo que en V15-1, H3 del pre-vuelo): cada tarea pasa por un estado rojo **intencionado** (Step 2: `Failed to resolve import`, `TS2305`/`TS2339`; controles negativos) y cierra con `npx vitest run` y `npx tsc --noEmit` **globales**; en un mismo working tree, dos subagentes en paralelo verían el rojo intencionado del otro como si fuera su propio gate global, o uno intentaría «arreglar» el fichero de la otra tarea. Además V15-2-3 cambia un export que el `.tsx` consume, y V15-2-5 y V15-2-7 editan el mismo `.tsx`.

| Orden | Tarea | Ficheros que toca | Delta tests / ficheros | Acumulado |
|---|---|---|---|---|
| 1 | **V15-2-1** motor: `nextManualControl` | `actions.ts`, `actions.test.ts` | +5 / 0 | 1296 / 77 |
| 2 | **V15-2-2** motor: cambio en `stepMatch` + spec | `match.ts`, `match.test.ts`, `specs/31-vault-world-cup.md` | +9 / 0 | 1305 / 77 |
| 3 | **V15-2-3** teclados `ARROWS_SOLO`/`CLASSIC_SOLO`, pausa, persistencia | `keyboard.ts`, `keyboard.test.ts`, `VaultWorldCupGame.tsx` (solo renombrar `SOLO`) | +6 / 0 | 1311 / 77 |
| 4 | **V15-2-4** esquema en el flujo, fila y textos por esquema | `flow.ts`, `flow-layout.ts` (+ tests), `control-hints.ts` + test (nuevos) | +9 / +1 | 1320 / 78 |
| 5 | **V15-2-5** cableado de esquemas y pausa | `VaultWorldCupGame.tsx`, `app/games/vault-world-cup/play/page.tsx` | 0 / 0 | 1320 / 78 |
| 6 | **V15-2-6** `lib/gamepad` | `lib/gamepad.ts` + test, `lib/gamepad-navigator.ts` (nuevos) | +8 / +1 | 1328 / 79 |
| 7 | **V15-2-7** mando en el juego + catálogo | `gamepad-input.ts` + test (nuevos), `keyboard.ts` + test, `VaultWorldCupGame.tsx`, `lib/games-registry.ts` + test | +7 / +1 | 1335 / 80 |
| 8 | **V15-2-8** cierre + `qa-paco.md` | solo ledger | 0 / 0 | 1335 / 80 |

---

## Mapa de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `components/games/football-logic/actions.ts` **(modificado)** | `MANUAL_SWITCH_POOL`, `MANUAL_SWITCH_LOCK_STEPS`, `MANUAL_SWITCH_SPRINT_HOLD_STEPS`; `nextManualControl` (puro, sin asignar); `updateTeamControl` pasa a exportarse; comentario de `updateControlled` actualizado. | 1 |
| `components/games/football-logic/actions.test.ts` **(modificado)** | +5 tests (`nextManualControl`). | 1 |
| `components/games/football-logic/match.ts` **(modificado)** | `MatchState.manualSwitch`, `scratch.physicsInputs`; `applyManualSwitch` + `physicsInputsFor` en `stepOpenPlay`; `updateTeamControlOf` con bloqueo y `clearManualSwitch` al final de `stepMatch`. | 2 |
| `components/games/football-logic/match.test.ts` **(modificado)** | +9 tests (escena `defending`, rotación, bloqueo, sprint, reseteos, replay, CPU sin C); `sameMatch` compara `manualSwitch`. | 2 |
| `specs/31-vault-world-cup.md` **(modificado)** | Anotación G15-5 junto a «El controlado es estado derivado» y bajo el criterio 5. | 2 |
| `components/games/football-screen/keyboard.ts` **(modificado)** | V15-2-3: `KeyScheme`, `ARROWS_SOLO`, `CLASSIC_SOLO`, `SOLO_TABLES_BY_SCHEME`, `isPauseKey`, `parseKeyScheme`/`loadKeyScheme`/`saveKeyScheme`; **fuera `SOLO`**. V15-2-7: `overlayPadToTeamInput`. | 3, 7 |
| `components/games/football-screen/keyboard.test.ts` **(modificado)** | V15-2-3: `SOLO` → `ARROWS_SOLO`, 3 tests reescritos, +6. V15-2-7: +2. | 3, 7 |
| `components/games/football-screen/flow.ts` **(modificado)** | `FlowState.keyScheme` (sobrevive a `flowReset`), `flowToggleKeyScheme`, `flowSetKeyScheme`. | 4 |
| `components/games/football-screen/flow-layout.ts` **(modificado)** | `MODE_SCHEME_ROW_Y`, `MODE_SCHEME_DETAIL_Y`, `MODE_HINT_Y`. | 4 |
| `components/games/football-screen/control-hints.ts` **(nuevo)** | `keyLabel`, `ControlHints`, `CONTROL_HINTS` por esquema, `keeperHintFor`, `TWO_PLAYER_SCHEME_NOTE`. Todo construido al cargar. | 4 |
| `components/games/football-screen/control-hints.test.ts` **(nuevo)** | 5 tests. | 4 |
| `components/games/VaultWorldCupGame.tsx` **(modificado)** | V15-2-3: `SOLO` → `ARROWS_SOLO` (mecánico). V15-2-5: tabla activa en menús y partido, `menuAction`, pausa (`isPauseKey` + `onPauseToggle`), fila del esquema, textos por esquema, persistencia. V15-2-7: mando (sondeo por frame, fusión en `runStep`, menús, Start, `ensureSfx`). | 3, 5, 7 |
| `app/games/vault-world-cup/play/page.tsx` **(modificado)** | La P sale de la página; nueva prop `onPauseToggle`. | 5 |
| `lib/gamepad.ts` **(nuevo)** | Puro: `GamepadLike`, `GamepadPad`, `STANDARD_BUTTON`, `GAMEPAD_STICK_DEAD_ZONE`, `nextEdge`, `stickAxis`, `readGamepad`, `assignGamepadSlots`. | 6 |
| `lib/gamepad.test.ts` **(nuevo)** | 8 tests. | 6 |
| `lib/gamepad-navigator.ts` **(nuevo)** | Capa fina: `pollGamepads(slots)` — la única lectura de `navigator`. | 6 |
| `components/games/football-screen/gamepad-input.ts` **(nuevo)** | Adaptador puro: `PAD_KEYS`, `routeGamepadToPad`, `routeGamepadStrategy`. | 7 |
| `components/games/football-screen/gamepad-input.test.ts` **(nuevo)** | 4 tests. | 7 |
| `lib/games-registry.ts` + `lib/games-registry.test.ts` **(modificados)** | Controles de VAULT WORLD CUP: Flechas, Clásico, Esc, cambio con C, mando. +1 test. | 7 |
| `.superpowers/sdd/2026-09-22-vault-world-cup-v15-2/progress.md` · `qa-paco.md` | Ledger (una línea por tarea) y lista de QA de Paco. | todas · 8 |

**Lo que este paso NO toca, a propósito:** `football-logic/ai.ts` y `ai.test.ts`, `step.ts`, `players.ts`, `input.ts`, `set-pieces.ts`, `mode.ts`, `world-cup.ts` y el resto del motor; `hud.ts` (`cursorPlayerId` ya lee `match.controlled`, que es lo que cambia); `components/MobileGamepad.tsx` (táctil, otro mundo: VAULT WORLD CUP es solo escritorio); los otros 13 juegos y sus play-pages (el módulo `lib/gamepad` queda listo para ellos, pero G15-20 lo aplica «ahora solo a VAULT WORLD CUP»).

---

### Task V15-2-1: `nextManualControl` — a quién pasa el control al pulsar C (G15-5, motor)

**Files:**
- Modify: `components/games/football-logic/actions.ts` (constantes junto a `export const CONTROL_HYSTERESIS = 40;` `:71`; `updateTeamControl` y `updateControlled` `:352-388`)
- Test: `components/games/football-logic/actions.test.ts` (imports `:8-13`; nuevo `describe` al final del fichero)

**Interfaces:**
- Consumes: nada de otras tareas (primera de la serie). Del propio motor: `isControllable` (privada de `actions.ts`), `isPlayerDown`, `dist`, `stepsFor`.
- Produces, y la Task V15-2-2 consume literalmente:
  - `MANUAL_SWITCH_POOL = 3` · `MANUAL_SWITCH_LOCK_STEPS = stepsFor(0.6)` (= 36) · `MANUAL_SWITCH_SPRINT_HOLD_STEPS = stepsFor(0.25)` (= 15)
  - `nextManualControl(players: readonly PlayerState[], ball: BallState, team: 0 | 1, current: number, stepCount: number): number` → id del nuevo controlado, o `-1` si no hay a quién pasar.
  - `updateTeamControl(players: readonly PlayerState[], ball: BallState, controlled: [number, number], team: 0 | 1): void` — la misma función de hoy, ahora **exportada** (sin cambiar una línea de su cuerpo).

**Contexto que el ejecutor no tiene:**
- **Qué decide G15-5 y qué deja al plan:** «pasa al siguiente compañero más cercano al balón (excluye el actual); pulsaciones repetidas van rotando entre los más cercanos». El plan lo concreta así (resuelto por Paco 22-sep, punto 1 de «Resueltas por Paco» en la Task V15-2-8): se ordena por distancia al balón a los jugadores de campo del equipo que están **de pie** (más el actual, esté como esté, para que su propio rango exista), desempate por id más bajo — la misma regla que `chaseRank` (`ai.ts:205-212`) y `updateTeamControl`. Si el actual ocupa el rango `r`, el nuevo es el de rango `r + 1` **dentro de los `MANUAL_SWITCH_POOL = 3` más cercanos**, y del último se vuelve al primero. Con el actual como más cercano (lo normal: la selección automática lo acaba de elegir) la secuencia de pulsaciones es 2.º → 3.º → 1.º → 2.º… Un actual que ha quedado fuera de los 3 salta al más cercano. Sin tope, pulsar ocho veces llevaría a un defensa a 600 u (la opción 2-C que el brief descartó).
- **Por qué fuera los tumbados:** pasarle el control a un jugador en el suelo (`isPlayerDown`) es pasárselo a alguien que no se puede mover durante un segundo. El portero nunca (criterio 4, `isControllable`). Los rivales nunca.
- **Sin asignar:** O(n²) sobre los 8 de campo (64 distancias como mucho), y solo en el paso de una pulsación.
- **`updateTeamControl` se exporta** porque la Task V15-2-2 necesita llamarla equipo a equipo (con el bloqueo por encima). `updateControlled` se queda exactamente igual (la usan `createMatch` y los tests).

- [ ] **Step 1: Escribir el test en rojo**

En `components/games/football-logic/actions.test.ts`, amplía el import de `./actions` (`:8-13`) añadiendo `MANUAL_SWITCH_POOL` y `nextManualControl`:

```ts
import {
  CONTROL_HYSTERESIS, GK_HOLD_STEPS, LONG_PASS_HOLD_STEPS, LONG_PASS_SPEED, MANUAL_SWITCH_POOL, SHORT_PASS_SPEED,
  SHOT_CHARGE_STEPS, SHOT_SPEED_MAX, SHOT_SPEED_MIN, STEAL_CHANCE, STEAL_CHANCE_VS_SPRINT, STEAL_RANGE,
  TACKLE_MISS_DOWN_STEPS, aimPass, applyButtons, applyKeeperButtons, chargeFraction, createActionEvent, freestMateDir,
  longPass, nextManualControl, pickPassTarget, releaseFromGoalkeeper, shoot, shortPass, shotSpeed, startTackle, steal,
  stepTackle, updateControlled,
  type ActionEvent,
} from './actions';
```

Y añade al **final** del fichero:

```ts
// ── G15-5 (grill of the v1.5, 17-sep): C with the rival on the ball or the ball loose
// hands control to the next teammate by distance, rotating through the nearest. ──
describe('nextManualControl: the manual switch with C (G15-5)', () => {
  // Our 1, 2, 3 and 4 in a line at 50, 100, 150 and 200 u from the ball; everybody
  // else is still parked on the bottom touchline by world(), 690+ u away.
  function scene(): World {
    const w = world();
    w.ball.x = 1000; w.ball.y = 600;
    at(w.players[1], 1050, 600);
    at(w.players[2], 1100, 600);
    at(w.players[3], 1150, 600);
    at(w.players[4], 1200, 600);
    return w;
  }

  it('hands control to the nearest teammate that is not the current one', () => {
    const w = scene();
    expect(nextManualControl(w.players, w.ball, 0, 1, 0)).toBe(2);
  });

  it('walks down the MANUAL_SWITCH_POOL nearest on repeated presses and wraps back to the nearest', () => {
    const w = scene();
    expect(MANUAL_SWITCH_POOL).toBe(3);
    expect(nextManualControl(w.players, w.ball, 0, 2, 0)).toBe(3);
    expect(nextManualControl(w.players, w.ball, 0, 3, 0)).toBe(1);
    // 4 is the fourth nearest, outside the pool: straight to the nearest.
    expect(nextManualControl(w.players, w.ball, 0, 4, 0)).toBe(1);
  });

  it('never hands control to the keeper, a rival or a teammate on the floor', () => {
    const w = scene();
    at(w.players[0], 1010, 600);        // our keeper, 10 u
    at(w.players[10], 1020, 600);       // a rival, 20 u
    w.players[2].downUntilStep = 50;    // 100 u, but on the floor until step 50
    expect(nextManualControl(w.players, w.ball, 0, 1, 10)).toBe(3);
    expect(nextManualControl(w.players, w.ball, 0, 1, 50)).toBe(2);   // back on his feet at step 50
  });

  it('breaks an exact distance tie by the lowest id, like updateControlled', () => {
    const w = world();
    w.ball.x = 1000; w.ball.y = 600;
    at(w.players[1], 1050, 600);   // 50 u
    at(w.players[6], 1000, 680);   // 80 u
    at(w.players[5], 920, 600);    // 80 u
    expect(nextManualControl(w.players, w.ball, 0, 1, 0)).toBe(5);
    expect(nextManualControl(w.players, w.ball, 0, 5, 0)).toBe(6);
  });

  it('returns -1 when nobody else can take over, and the nearest when the current id is not ours', () => {
    const w = scene();
    for (let id = 2; id <= 8; id++) w.players[id].downUntilStep = 100;
    expect(nextManualControl(w.players, w.ball, 0, 1, 0)).toBe(-1);
    const v = scene();
    expect(nextManualControl(v.players, v.ball, 0, -1, 0)).toBe(1);
    expect(nextManualControl(v.players, v.ball, 0, 12, 0)).toBe(1);   // a rival's id is not a current of ours
    // Team 1 works the same: all eight parked, 17 (x = 780) is the nearest to (1000, 600).
    expect(nextManualControl(v.players, v.ball, 1, 10, 0)).toBe(17);
  });
});
```

(Comprobación de la última línea, hecha al escribir el plan: `world()` aparca al id `i` en `(100 + 40·i, 1290)`; hasta `(1000, 600)` el 17 está a √(220² + 690²) ≈ 724 u y el 16 a ≈ 737 u; el 10, actual, a ≈ 852 u, fuera de los 3 más cercanos → salta al más cercano, el 17.)

- [ ] **Step 2: Verlo fallar**

Ejecuta: `npx vitest run components/games/football-logic/actions.test.ts`
Esperado: **FALLA** — los 5 tests nuevos con `TypeError: nextManualControl is not a function` (o `SyntaxError: ... does not provide an export named 'MANUAL_SWITCH_POOL'`); los existentes, verdes.

- [ ] **Step 3: Escribir `nextManualControl` y exportar `updateTeamControl`**

En `components/games/football-logic/actions.ts`, justo debajo de `export const CONTROL_HYSTERESIS = 40;` (`:71`), añade:

```ts
// G15-5 (grill of the v1.5, 17-sep): the human's manual switch. The pool is how many
// of the nearest a repeated C rotates through; the lock keeps the switched player
// against the hysteresis for ~0.6 s (to tune in QA); the hold is how long C must stay
// down after a switch before it sprints ("pulsar = solo cambio; mantener sí esprinta").
// The hold matches LONG_PASS_HOLD_SECONDS: 0.25 s is this game's "held, not tapped".
export const MANUAL_SWITCH_POOL = 3;
export const MANUAL_SWITCH_LOCK_STEPS = stepsFor(0.6); // 36
export const MANUAL_SWITCH_SPRINT_HOLD_STEPS = stepsFor(0.25); // 15
```

Sustituye el bloque que va desde `function updateTeamControl(` hasta el final del fichero (`:356-388`) por:

```ts
// Exported for G15-5: match.ts calls it team by team, with the manual lock on top.
// The body is the stage-A rule, untouched.
export function updateTeamControl(players: readonly PlayerState[], ball: BallState, controlled: [number, number], team: 0 | 1): void {
  if (ball.owner !== null && isControllable(players[ball.owner], team)) {
    controlled[team] = ball.owner;
    return;
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
    if (bestDist > currentDist - CONTROL_HYSTERESIS) return;
  }
  controlled[team] = best;
}

// Derived (spec): owner if an outfield player of the team has the ball; else the
// nearest outfield player (never the keeper), lowest id on ties, with
// CONTROL_HYSTERESIS so it does not flicker. Writes into `controlled`. Since G15-5 it
// is no longer "never an input" for a human: stepMatch lets a C press override it for
// MANUAL_SWITCH_LOCK_STEPS (match.ts, updateTeamControlOf) -- the replay is still
// seed + TeamInput, and the CPU never presses C.
export function updateControlled(players: readonly PlayerState[], ball: BallState, controlled: [number, number]): void {
  updateTeamControl(players, ball, controlled, 0);
  updateTeamControl(players, ball, controlled, 1);
}

// G15-5: the pool a manual switch ranks -- the team's outfield players on their feet,
// plus the current one whatever its state, so its own rank is always defined.
function inSwitchPool(p: PlayerState, team: 0 | 1, self: number, stepCount: number): boolean {
  return isControllable(p, team) && (p.id === self || !isPlayerDown(p, stepCount));
}

// How many of the pool are strictly nearer the ball than p (lowest id first on an
// exact tie) -- chaseRank's rule (ai.ts), over the switch pool.
function switchRank(p: PlayerState, players: readonly PlayerState[], ball: BallState, team: 0 | 1, self: number, stepCount: number): number {
  const mine = dist(p.x, p.y, ball.x, ball.y);
  let rank = 0;
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.id === p.id || !inSwitchPool(q, team, self, stepCount)) continue;
    const d = dist(q.x, q.y, ball.x, ball.y);
    if (d < mine || (d === mine && q.id < p.id)) rank++;
  }
  return rank;
}

// G15-5: who takes over when the human presses C without the ball. The current one
// holds rank r among the MANUAL_SWITCH_POOL nearest; the next is rank r + 1, and after
// the last of the pool comes the nearest again, so repeated presses rotate and never
// return the current one. A current outside the pool (or not ours at all) goes straight
// to the nearest. -1 when there is nobody to switch to. Allocates nothing: at most 64
// distances, and only on the step of a press.
export function nextManualControl(players: readonly PlayerState[], ball: BallState, team: 0 | 1, current: number, stepCount: number): number {
  const self = current >= 0 && current < players.length && isControllable(players[current], team) ? current : -1;
  let size = 0;
  for (let i = 0; i < players.length; i++) if (inSwitchPool(players[i], team, self, stepCount)) size++;
  const pool = size < MANUAL_SWITCH_POOL ? size : MANUAL_SWITCH_POOL;
  let target = 0;
  if (self >= 0) {
    if (pool < 2) return -1;
    const mine = switchRank(players[self], players, ball, team, self, stepCount);
    target = mine + 1 < pool ? mine + 1 : 0;
  } else if (pool < 1) {
    return -1;
  }
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.id === self || !inSwitchPool(p, team, self, stepCount)) continue;
    if (switchRank(p, players, ball, team, self, stepCount) === target) return p.id;
  }
  return -1;
}
```

(`isPlayerDown` y `dist` ya están importados en `actions.ts:1-4`; `stepsFor` en `:6`. No hace falta ningún import nuevo.)

- [ ] **Step 4: Verlo pasar**

Ejecuta: `npx vitest run components/games/football-logic/actions.test.ts`
Esperado: **PASA** entero (los de antes + 5).

Si «walks down the MANUAL_SWITCH_POOL nearest…» falla, **no toques las distancias del test**: revisa la fórmula de `target` (el actual nunca puede salir: con `pool ≥ 2`, `target ≠ mine` siempre).

- [ ] **Step 5: Romperlo a propósito (control negativo, regla de Paco)**

1. En `nextManualControl`, cambia temporalmente `target = mine + 1 < pool ? mine + 1 : 0;` por `target = 0;` y ejecuta el fichero. Esperado: **fallan, al menos,** «hands control to the nearest teammate…» (devuelve `-1`: el de rango 0 es el propio actual, excluido), «walks down…», «breaks an exact distance tie…» y «never hands control to the keeper, a rival or a teammate on the floor» (`expected -1 to be 3`). **Deshaz.**
2. En `inSwitchPool`, cambia temporalmente `(p.id === self || !isPlayerDown(p, stepCount))` por `true` y ejecuta. Esperado: **fallan** «never hands control to the keeper, a rival or a teammate on the floor» (primera aserción: 2 en vez de 3) y «returns -1 when nobody else…» (primera aserción: 2 en vez de -1). **Deshaz** y vuelve a verlo verde.

- [ ] **Step 6: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-logic/actions.ts components/games/football-logic/actions.test.ts
git diff --name-only b130c06 -- components/games/football-logic/ | sort
git diff b130c06 -- components/games/football-logic/actions.ts components/games/football-logic/actions.test.ts | grep "^+" | grep -n " as \|!\.\|: any\|Math.random"
```
Esperado: delta **+5 tests / +0 ficheros** → **1296 / 77** verdes; `tsc` y `eslint` sin salida; el `git diff --name-only` lista **solo** `actions.test.ts` y `actions.ts`; el último `grep` (líneas añadidas con `as`, `!.`, `any` o `Math.random`) **vacío**.

- [ ] **Step 7: Anotar en el ledger**

Añade una línea a `.superpowers/sdd/2026-09-22-vault-world-cup-v15-2/progress.md`:
`V15-2-1 hecha: nextManualControl (rango por distancia entre los 3 más cercanos de pie, rota y nunca devuelve al actual) + constantes MANUAL_SWITCH_* + updateTeamControl exportada; +5 tests (1296/77). Motor: solo actions.ts/.test.ts. Controles negativos aplicados y deshechos. Working tree verificado; commit lo hace Paco.`

- [ ] **Step 8: Dejar el working tree verificado; commit lo hace Paco**

No ejecutes `git add` ni `git commit`. El mensaje único del paso se propone en la Task V15-2-8.

---

### Task V15-2-2: el cambio manual dentro de `stepMatch` — bloqueo, sprint retenido, reseteos y cero regrabado (G15-5, motor)

**Files:**
- Modify: `components/games/football-logic/match.ts` (imports `:4`, `:10-13`; `MatchState` `:40-78`; `createMatch` `:139-176`; bloque nuevo tras `applyTeamInput` `:371-393`; `stepOpenPlay` `:395-418`; final de `stepMatch` `:586-590`)
- Modify: `components/games/football-logic/match.test.ts` (imports `:5`, `:7-8`, `:21-22`; `sameMatch` `:746-762`; nuevo `describe` al final)
- Modify: `specs/31-vault-world-cup.md` (párrafo «El controlado es estado derivado» `:190-194` y criterio 5 `:501-502`)

**Interfaces:**
- Consumes de la Task V15-2-1: `MANUAL_SWITCH_LOCK_STEPS`, `MANUAL_SWITCH_SPRINT_HOLD_STEPS`, `nextManualControl(players, ball, team, current, stepCount)`, `updateTeamControl(players, ball, controlled, team)`.
- Consumes de `input.ts` (sin tocarlo): `createTeamInput`, `copyTeamInput`, `isDown`.
- Produces (lo leen los tests; la pantalla no necesita nada nuevo — `hud.ts` ya pinta el cursor sobre `match.controlled`):
  - `MatchState.manualSwitch: { lockSteps: [number, number]; sprintHoldSteps: [number, number] }`
  - `MatchState.scratch.physicsInputs: [TeamInput, TeamInput]` (interno)

**Contexto que el ejecutor no tiene:**
- **Dónde entra el flanco:** en `stepOpenPlay`, **después** de las dos atajadas (`keeperCatchFor`: si nuestro portero acaba de atajar, ya es «nuestro balón» y no hay cambio) y **antes** de calcular `scratch.liveControlled` (así el nuevo controlado ya lee la cruceta en este mismo paso y la IA ya no lo posiciona). Solo `stepOpenPlay` lo mira: en `kickoff`, `set-piece`, `goal`, `half-time` y `shootout` una pulsación de C no hace nada (G15-5: «no en saques», «no en la tanda»). No consume ninguna tirada del `rng`.
- **«Con el rival en posesión o balón suelto (no con tu portero)»** = `ball.owner === null` o el dueño es del otro equipo. Si el balón es de un jugador de campo propio, el controlado ya es el dueño; si es de nuestro portero, tampoco hay cambio. El equipo congelado del ENTRENAMIENTO (`rules.frozenTeam`) nunca cambia (es la CPU y no recibe entrada).
- **El bloqueo** (`lockSteps[t]`, 36 pasos ≈ 0,6 s) se arma en la pulsación y se descuenta al final de cada paso en `updateTeamControlOf`, que mientras dure **no** llama a la regla derivada — salvo que un jugador de campo del equipo gane el balón, que lo rompe en el acto (el dueño siempre manda). Al acabar, vuelve la regla de siempre con su histéresis de 40 u. Pulsar otra vez durante el bloqueo rota (G15-5: «pulsaciones repetidas van rotando») y lo rearma.
- **«Pulsar = solo cambio, sin sprint; mantener después sí esprinta»:** hoy `stepPhysics` da sprint con `isDown(input.c)` (`step.ts:28`), y `'pressed'` cuenta como abajo. Un toque humano real dura varios pasos (el teclado da `'pressed'` un paso y `'held'` mientras el dedo sigue abajo, ~5-9 pasos en un toque normal), y soltar a mitad de ráfaga arranca los 3 s de recuperación (`tickSprint`, `players.ts:186-205`): sin retener, cada cambio quemaría el sprint. Por eso, tras un cambio, `sprintHoldSteps[t] = 15` (0,25 s, el mismo umbral de «mantener» que el pase largo): mientras C siga abajo y quede retención, `stepPhysics` recibe `c: 'up'` para ese equipo; si se suelta antes, la retención se anula; si se mantiene más, esprinta. El `TeamInput` del llamante **no se toca**: se copia en `scratch.physicsInputs` (dos copias de 7 campos por paso, sin asignar) y solo se modifica la copia. `step.ts` no cambia.
- **Reseteos:** al final de `stepMatch`, si la fase ya no es juego abierto (`!isOpenPlay`), `clearManualSwitch` pone los cuatro contadores a 0: cubre gol (`goal`, y `over` por gol de oro), saque/falta/penalti (`set-piece`, `kickoff`), descanso (`half-time`) y tanda (`shootout`) en un solo sitio.
- **Por qué no hay regrabado, y cómo se demuestra:** la CPU (`decideTeamInput`) solo escribe `'held'`/`'up'` en `c` (`ai.ts:572`, `ai.ts:598`; los `'pressed'` de `ai.ts:580/606/617` son de `a`/`b`); con `c` nunca `'pressed'`, `applyManualSwitch` no hace nada, los contadores se quedan en 0, `physicsInputsFor` copia sin cambiar nada y `updateTeamControlOf` es exactamente `updateTeamControl` en el mismo orden (equipo 0, luego 1) que el `updateControlled` de hoy. El test 9 lo fija sobre un partido CPU-contra-CPU entero; las grabaciones de `ai.test.ts`/`match.test.ts` siguen verdes **sin tocar un número**; y el control negativo 4 (CPU que pulsa C) demuestra que la suite lo cazaría.
- **Riesgo conocido que NO se corrige aquí (brief §2):** con un controlado manual que no es el más cercano, `positionTeam` (`ai.ts:221-240`) hace perseguir al balón a los `CHASERS` más cercanos **sin contar al controlado**, así que el equipo humano persigue con uno más durante el cambio. Probablemente deseable (el más cercano sigue presionando); se mira en el QA (punto 8). `ai.ts` no se toca.

- [ ] **Step 1: Escribir los tests en rojo**

En `components/games/football-logic/match.test.ts`:

1. Imports (`:5`, `:7-8`, `:21-22`): añade `type ButtonState` al de `./input`, `isSprinting` al de `./players`, `givePossession` al de `./ball`, `MANUAL_SWITCH_LOCK_STEPS, MANUAL_SWITCH_SPRINT_HOLD_STEPS` al de `./actions` y `createAiState, decideTeamInput` al de `./ai`:

```ts
import { createTeamInput, copyTeamInput, toAxis, type ButtonState, type TeamInput } from './input';
```
```ts
import { GK_LINE_DIST, TACKLE_DIST, TACKLE_STEPS, isSprinting, type PlayerState } from './players';
import { createBall, givePossession, type BallState } from './ball';
```
```ts
import {
  GK_HOLD_STEPS, MANUAL_SWITCH_LOCK_STEPS, MANUAL_SWITCH_SPRINT_HOLD_STEPS, SHORT_PASS_SPEED, STEAL_CHANCE,
  STEAL_CHANCE_VS_SPRINT, freestMateDir, shotSpeed,
} from './actions';
import { applyKickError, createAiState, decideTeamInput, humanProfile, profileFor, type AiProfile } from './ai';
```

2. En `sameMatch` (`:746`), justo después de la línea `if (a.catchRolled[0] !== b.catchRolled[0] || a.catchRolled[1] !== b.catchRolled[1]) return false;`, añade:

```ts
  const sa = a.manualSwitch;
  const sb = b.manualSwitch;
  if (sa.lockSteps[0] !== sb.lockSteps[0] || sa.lockSteps[1] !== sb.lockSteps[1]) return false;
  if (sa.sprintHoldSteps[0] !== sb.sprintHoldSteps[0] || sa.sprintHoldSteps[1] !== sb.sprintHoldSteps[1]) return false;
```

(Las grabaciones existentes comparan dos partidos con los cuatro contadores a 0: siguen iguales.)

3. Añade al **final** del fichero:

```ts
// ── G15-5 (grill of the v1.5, 17-sep): the manual switch with C, inside the engine. ──

// Team 0 presses, holds or lets go of C; team 1 stays idle.
function teamZeroC(c: ButtonState): readonly [TeamInput, TeamInput] {
  const t0 = createTeamInput();
  t0.c = c;
  return [t0, createTeamInput()];
}
const PRESS_C = teamZeroC('pressed');
const HOLD_C = teamZeroC('held');
const RELEASE_C = teamZeroC('released');

// Our 1, 2 and 3 in a line at 50, 100 and 150 u behind ballX on the centre line, our
// 1 controlled; our other five parked on the top touchline and the rival's 11-17 on
// the bottom one (the keepers stay where they are: they are clamped to their box).
function lineUpBehind(m: MatchState, ballX: number): void {
  for (let id = 4; id <= 8; id++) { m.players[id].x = 200 + id * 40; m.players[id].y = 40; }
  for (let id = 11; id <= 17; id++) { m.players[id].x = 200 + id * 40; m.players[id].y = 1260; }
  for (let i = 1; i <= 3; i++) {
    const p = m.players[i];
    p.x = ballX - 50 * i; p.y = CY; p.facingX = 1; p.facingY = 0; p.downUntilStep = 0; p.tackleStepsLeft = 0;
  }
  m.controlled[0] = 1;
}

// Open play; the rival's 10 holds the ball and stands still (he is team 1's controlled
// and gets an idle input); our 1/2/3 lined up behind the ball.
function defending(): MatchState {
  const m = fresh();
  resumePlay(m);
  const owner = m.players[10];
  owner.x = 1000; owner.y = CY; owner.facingX = 1; owner.facingY = 0;
  givePossession(m.ball, owner, m.stepCount);   // glues the ball at x = 1000 + CONTROL_DIST = 1018
  m.controlled[1] = 10;
  lineUpBehind(m, m.ball.x);
  return m;
}

describe('the manual switch with C (G15-5)', () => {
  it('a press with the rival on the ball hands control to the next nearest, and repeated presses rotate through the three nearest', () => {
    const m = defending();
    const rng = createRng(1);
    stepMatch(m, PRESS_C, rng);
    expect(m.controlled[0]).toBe(2);
    expect(m.manualSwitch.lockSteps[0]).toBe(MANUAL_SWITCH_LOCK_STEPS - 1);
    stepMatch(m, IDLE, rng);
    // Without the lock the hysteresis would hand it straight back: 1 is 50+ u nearer.
    expect(m.controlled[0]).toBe(2);
    stepMatch(m, PRESS_C, rng);
    expect(m.controlled[0]).toBe(3);
    stepMatch(m, IDLE, rng);
    stepMatch(m, PRESS_C, rng);
    expect(m.controlled[0]).toBe(1);
    expect(m.manualSwitch.lockSteps[1]).toBe(0);   // the idle side never switched
  });

  it('a press on a loose ball switches too, in a normal match and in the training ruleset -- but never for the frozen team', () => {
    for (const rules of [NORMAL_RULES, TRAINING_RULES]) {
      const m = createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES, rules);
      resumePlay(m);
      freeBall(m, 1000, CY, 0, 0);
      lineUpBehind(m, 1000);
      m.players[10].x = 600; m.players[10].y = 1260;   // the rival's 10 parked too
      stepMatch(m, PRESS_C, createRng(1));
      expect(m.controlled[0]).toBe(2);

      // Guardrail (frozenTeam in applyManualSwitch): unreachable in play today (the
      // frozen team is the CPU and match-run.ts never gives it a TeamInput other than
      // 'up'), so this is the only place that presses C for it directly. Only makes
      // sense under TRAINING_RULES, where team 1 is frozen.
      if (rules === TRAINING_RULES) {
        const m2 = createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES, rules);
        resumePlay(m2);
        freeBall(m2, 1000, CY, 0, 0);
        lineUpBehind(m2, 1000);
        m2.players[10].x = 600; m2.players[10].y = 1260;
        const twin = createMatch(TEAM_PAIR, FORMATIONS, PITCH, PROFILES, rules);
        resumePlay(twin);
        freeBall(twin, 1000, CY, 0, 0);
        lineUpBehind(twin, 1000);
        twin.players[10].x = 600; twin.players[10].y = 1260;
        const pressC1: readonly [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
        pressC1[1].c = 'pressed';
        stepMatch(m2, pressC1, createRng(1));
        stepMatch(twin, IDLE, createRng(1));
        expect(m2.manualSwitch.lockSteps[1]).toBe(0);
        expect(m2.controlled[1]).toBe(twin.controlled[1]);
      }
    }
  });

  it('no switch while our own side has the ball: an outfield owner, or our keeper', () => {
    const own = defending();
    givePossession(own.ball, own.players[1], own.stepCount);
    stepMatch(own, PRESS_C, createRng(1));
    expect(own.controlled[0]).toBe(1);
    expect(own.manualSwitch.lockSteps[0]).toBe(0);
    const keeper = defending();
    givePossession(keeper.ball, keeper.players[0], keeper.stepCount);
    const twin = defending();
    givePossession(twin.ball, twin.players[0], twin.stepCount);
    stepMatch(keeper, PRESS_C, createRng(1));
    stepMatch(twin, IDLE, createRng(1));
    expect(keeper.manualSwitch.lockSteps[0]).toBe(0);
    expect(keeper.controlled[0]).toBe(twin.controlled[0]);
  });

  it('a press outside open play does nothing: kickoff, set piece and shootout', () => {
    const scenes: readonly (() => MatchState)[] = [
      () => fresh(),
      () => { const m = defending(); callSetPiece(m, 'free-kick', 1, 1000, CY); return m; },
      () => atShootout(),
    ];
    for (const make of scenes) {
      const pressed = make();
      const idleTwin = make();
      const phase = pressed.phase;
      stepMatch(pressed, PRESS_C, createRng(1));
      stepMatch(idleTwin, IDLE, createRng(1));
      expect(pressed.phase).toBe(phase);
      expect(pressed.manualSwitch.lockSteps[0]).toBe(0);
      expect(pressed.controlled[0]).toBe(idleTwin.controlled[0]);
    }
  });

  it('the lock lasts exactly MANUAL_SWITCH_LOCK_STEPS steps, and our side winning the ball ends it at once', () => {
    const m = defending();
    const rng = createRng(1);
    stepMatch(m, PRESS_C, rng);
    for (let i = 1; i < MANUAL_SWITCH_LOCK_STEPS; i++) stepMatch(m, IDLE, rng);
    expect(m.controlled[0]).toBe(2);             // MANUAL_SWITCH_LOCK_STEPS steps in all, the press included
    expect(m.manualSwitch.lockSteps[0]).toBe(0);
    stepMatch(m, IDLE, rng);
    expect(m.controlled[0]).toBe(1);             // the derived rule is back: 1 chased the ball, 2 stood still
    const won = defending();
    stepMatch(won, PRESS_C, createRng(1));
    expect(won.controlled[0]).toBe(2);
    givePossession(won.ball, won.players[3], won.stepCount);
    stepMatch(won, IDLE, createRng(1));
    expect(won.controlled[0]).toBe(3);           // the owner always has control
    expect(won.manualSwitch.lockSteps[0]).toBe(0);
  });

  it('a tap only switches and never sprints; holding C past MANUAL_SWITCH_SPRINT_HOLD_STEPS does sprint', () => {
    const tap = defending();
    const rngTap = createRng(1);
    stepMatch(tap, PRESS_C, rngTap);
    for (let i = 0; i < 3; i++) stepMatch(tap, HOLD_C, rngTap);
    stepMatch(tap, RELEASE_C, rngTap);
    expect(tap.controlled[0]).toBe(2);
    expect(isSprinting(tap.players[2])).toBe(false);
    expect(tap.players[2].sprintCooldownSteps).toBe(0);   // no burst was started, so none was cut short
    const hold = defending();
    const rng = createRng(1);
    stepMatch(hold, PRESS_C, rng);
    expect(isSprinting(hold.players[2])).toBe(false);
    for (let i = 1; i < MANUAL_SWITCH_SPRINT_HOLD_STEPS; i++) {
      stepMatch(hold, HOLD_C, rng);
      expect(isSprinting(hold.players[2])).toBe(false);
    }
    stepMatch(hold, HOLD_C, rng);
    expect(isSprinting(hold.players[2])).toBe(true);
  });

  it('a goal, a set piece and the half-time wipe the lock and the sprint hold', () => {
    const interruptions: readonly ((m: MatchState) => void)[] = [
      (m) => { scoreGoal(m, 1); },
      (m) => { callSetPiece(m, 'throw-in', 1, 1000, 0); },
      (m) => { endHalf(m); },
    ];
    for (const interrupt of interruptions) {
      const m = defending();
      const rng = createRng(1);
      stepMatch(m, PRESS_C, rng);
      expect(m.manualSwitch.lockSteps[0]).toBeGreaterThan(0);
      expect(m.manualSwitch.sprintHoldSteps[0]).toBeGreaterThan(0);
      interrupt(m);
      stepMatch(m, HOLD_C, rng);
      expect(m.manualSwitch.lockSteps[0]).toBe(0);
      expect(m.manualSwitch.sprintHoldSteps[0]).toBe(0);
    }
  });

  it('a match with C presses replays identically, step by step (criterion 1 still holds)', () => {
    const a = fresh();
    const b = fresh();
    const rngA = createRng(5);
    const rngB = createRng(5);
    const live: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    let switches = 0;
    let firstMismatch = -1;
    for (let step = 0; step < 2 * HALF_STEPS && a.phase !== 'over'; step++) {
      policy(a, 0, live[0]);
      policy(a, 1, live[1]);
      if (step % 45 === 0) live[0].c = 'pressed';
      const before = a.controlled[0];
      stepMatch(a, live, rngA);
      stepMatch(b, live, rngB);
      if (a.manualSwitch.lockSteps[0] === MANUAL_SWITCH_LOCK_STEPS - 1 && a.controlled[0] !== before) switches++;
      if (firstMismatch < 0 && !sameMatch(a, b)) firstMismatch = step;
    }
    expect(firstMismatch).toBe(-1);
    expect(switches).toBeGreaterThan(0);   // not vacuous: the presses did switch
  });

  it('the CPU never presses C in a whole CPU-vs-CPU match, so no CPU recording can move (G15-15: no re-recording)', () => {
    const m = fresh();
    const states = [createAiState(), createAiState()];
    const cpuRngs = [createRng(7), createRng(8)];
    const rng = createRng(9);
    const live: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    let presses = 0;
    let steps = 0;
    while (m.phase !== 'over' && steps < RECORD_CAP) {
      decideTeamInput(m, 0, PROFILES[0], states[0], cpuRngs[0], live[0]);
      decideTeamInput(m, 1, PROFILES[1], states[1], cpuRngs[1], live[1]);
      if (live[0].c === 'pressed' || live[1].c === 'pressed') presses++;
      stepMatch(m, live, rng);
      if (m.manualSwitch.lockSteps[0] > 0 || m.manualSwitch.lockSteps[1] > 0) presses++;
      steps++;
    }
    expect(steps).toBeGreaterThan(HALF_STEPS);
    expect(presses).toBe(0);
  });
});
```

(`fresh`, `IDLE`, `CY`, `TEAM_PAIR`, `PROFILES`, `freeBall`, `policy`, `sameMatch`, `atShootout` y `RECORD_CAP` ya existen en el fichero; `atShootout` y `policy` son declaraciones de función y `RECORD_CAP` una constante de módulo evaluada antes de que corra ningún test.)

- [ ] **Step 2: Verlos fallar**

Ejecuta: `npx vitest run components/games/football-logic/match.test.ts`
Esperado: **FALLA** — `npx tsc --noEmit` daría `Property 'manualSwitch' does not exist on type 'MatchState'` (vitest no comprueba tipos: en ejecución, los 9 nuevos caen con `TypeError: Cannot read properties of undefined (reading 'lockSteps')` o con `expected 1 to be 2`); las grabaciones y demás tests existentes, **verdes**.

- [ ] **Step 3: Implementar en `match.ts`**

1. Imports. Sustituye `import type { TeamInput } from './input';` (`:4`) por:

```ts
import { copyTeamInput, createTeamInput, isDown, type TeamInput } from './input';
```

y el bloque de `./actions` (`:10-13`) por:

```ts
import {
  MANUAL_SWITCH_LOCK_STEPS, MANUAL_SWITCH_SPRINT_HOLD_STEPS, applyButtons, applyKeeperButtons, clearActionEvent,
  createActionEvent, nextManualControl, releaseFromGoalkeeper, stepTackle, updateControlled, updateTeamControl,
  type ActionEvent,
} from './actions';
```

2. `MatchState` (`:40-78`): justo después de `lastGoalTeam: 0 | 1 | -1;` añade:

```ts
  // G15-5: the human's manual switch, per team. lockSteps > 0 keeps the switched player
  // controlled against the hysteresis (updateTeamControlOf); sprintHoldSteps > 0 keeps
  // the press that switched from sprinting until C has been HELD that long
  // (physicsInputsFor). Always 0 for a CPU team -- it never presses C -- and wiped
  // whenever the phase leaves open play (end of stepMatch).
  manualSwitch: { lockSteps: [number, number]; sprintHoldSteps: [number, number] };
```

y en el tipo de `scratch` sustituye `shootout: ShootoutState };` por `shootout: ShootoutState; physicsInputs: [TeamInput, TeamInput] };`.

3. `createMatch` (`:139-176`): tras `lastGoalTeam: -1,` añade `manualSwitch: { lockSteps: [0, 0], sprintHoldSteps: [0, 0] },`, y dentro de `scratch`, tras `shootout: createShootoutState(),`, añade `physicsInputs: [createTeamInput(), createTeamInput()],`.

4. Justo **después** de la función `applyTeamInput` (acaba en `:393`, antes de `function stepOpenPlay`), añade:

```ts
// ── G15-5: the manual switch (grill of the v1.5, 17-sep) ─────────────────────────

function clearManualSwitch(match: MatchState): void {
  const ms = match.manualSwitch;
  ms.lockSteps[0] = 0;
  ms.lockSteps[1] = 0;
  ms.sprintHoldSteps[0] = 0;
  ms.sprintHoldSteps[1] = 0;
}

function ownSideHasBall(match: MatchState, team: 0 | 1): boolean {
  const owner = match.ball.owner;
  return owner !== null && match.players[owner].team === team;
}

// C pressed with the rival on the ball or the ball loose -- not with our own keeper or
// an outfield teammate holding it -- hands control to the next nearest (actions.ts,
// nextManualControl) and arms the lock and the sprint hold. Called from stepOpenPlay
// only, so a press on a restart or in the shootout does nothing. No rng draw. The CPU
// never presses C (ai.ts writes only 'held'/'up' into c), so for a CPU side this is a
// no-op and no recording moves.
function applyManualSwitch(match: MatchState, team: 0 | 1, input: TeamInput): void {
  if (input.c !== 'pressed' || team === match.rules.frozenTeam || ownSideHasBall(match, team)) return;
  const next = nextManualControl(match.players, match.ball, team, match.controlled[team], match.stepCount);
  if (next < 0) return;
  match.controlled[team] = next;
  match.manualSwitch.lockSteps[team] = MANUAL_SWITCH_LOCK_STEPS;
  match.manualSwitch.sprintHoldSteps[team] = MANUAL_SWITCH_SPRINT_HOLD_STEPS;
}

// "Pulsar = solo cambio; mantener después sí esprinta": while the C that switched is
// still down and the hold has not run out, the physics sees it up. Letting go cancels
// the hold; holding past it sprints. Writes the scratch copy, never the caller's input.
function muteSwitchSprint(match: MatchState, team: 0 | 1, input: TeamInput): void {
  const hold = match.manualSwitch.sprintHoldSteps;
  if (hold[team] === 0) return;
  if (!isDown(input.c)) {
    hold[team] = 0;
    return;
  }
  input.c = 'up';
  hold[team]--;
}

// The TeamInputs stepPhysics sees this step: copies of the caller's (two copies of
// seven fields, no allocation) with the switch's sprint muted. For a side with no hold
// running they are byte-for-byte the caller's.
function physicsInputsFor(match: MatchState, inputs: readonly [TeamInput, TeamInput]): readonly [TeamInput, TeamInput] {
  const out = match.scratch.physicsInputs;
  copyTeamInput(inputs[0], out[0]);
  copyTeamInput(inputs[1], out[1]);
  muteSwitchSprint(match, 0, out[0]);
  muteSwitchSprint(match, 1, out[1]);
  return out;
}

// The derived rule (actions.ts, updateTeamControl) with the manual lock on top: while
// a lock runs the switched player stays, whatever the hysteresis says -- unless an
// outfield player of the side wins the ball, which ends the lock at once (the owner
// always has control). With no lock this IS updateTeamControl, called in the order
// the updateControlled it replaces at the end of stepMatch used: team 0, then team 1.
function updateTeamControlOf(match: MatchState, team: 0 | 1): void {
  const lock = match.manualSwitch.lockSteps;
  if (lock[team] > 0) {
    const owner = match.ball.owner;
    const outfieldOwner = owner !== null && match.players[owner].team === team && match.players[owner].role !== 'gk';
    if (!outfieldOwner) {
      lock[team]--;
      return;
    }
    lock[team] = 0;
  }
  updateTeamControl(match.players, match.ball, match.controlled, team);
}
```

5. En `stepOpenPlay`, sustituye:

```ts
  keeperCatchFor(match, 0, rng);
  keeperCatchFor(match, 1, rng);
  scratch.liveControlled[0] = liveControlledFor(match, 0);
```

por:

```ts
  keeperCatchFor(match, 0, rng);
  keeperCatchFor(match, 1, rng);
  // G15-5: (1b) a human's C press without the ball switches the controlled, after the
  // catches (a catch makes it our ball: no switch) and before anyone reads who is
  // controlled this step. No draw, and a no-op for the CPU.
  applyManualSwitch(match, 0, inputs[0]);
  applyManualSwitch(match, 1, inputs[1]);
  scratch.liveControlled[0] = liveControlledFor(match, 0);
```

y la línea

```ts
  stepPhysics(players, ball, inputs, scratch.liveControlled, match.attackDir, match.pitch, match.stepCount);
```

por

```ts
  stepPhysics(players, ball, physicsInputsFor(match, inputs), scratch.liveControlled, match.attackDir, match.pitch, match.stepCount);
```

6. Al final de `stepMatch`, sustituye:

```ts
  match.stepCount++;
  match.clockMs = match.halfStep * STEP_MS;
  updateControlled(match.players, match.ball, match.controlled);
}
```

por:

```ts
  match.stepCount++;
  match.clockMs = match.halfStep * STEP_MS;
  // G15-5: a switch only lives in open play -- a goal, a restart, the half-time or the
  // shootout wipes it -- and while it lives it overrides the derived rule.
  if (!isOpenPlay(match.phase)) clearManualSwitch(match);
  updateTeamControlOf(match, 0);
  updateTeamControlOf(match, 1);
}
```

(`updateControlled` se sigue importando: `createMatch` la usa. `isOpenPlay` ya existe en el fichero.)

- [ ] **Step 4: Verlos pasar**

Ejecuta: `npx vitest run components/games/football-logic/`
Esperado: **PASA** todo el motor, los 9 nuevos incluidos, y **sin tocar un solo valor esperado** de las grabaciones (`ai.test.ts` 69/19/36 y tabla por pareja; `match.test.ts` «full match with recorded inputs»).

Si un test de escena falla por una distancia (p. ej. el 1 no vuelve al final del bloqueo), **no ajustes el número de pasos**: imprime `m.players[1..3]` y la distancia al balón y corrige la escena (`defending`/`lineUpBehind`), no la regla.

- [ ] **Step 5: Romperlo a propósito (controles negativos)**

1. En `updateTeamControlOf`, borra temporalmente el bloque `if (lock[team] > 0) { … }` entero. Ejecuta `npx vitest run components/games/football-logic/match.test.ts`. Esperado (medido en un prototipo al escribir el plan): **fallan 5** — «a press with the rival on the ball…», «a press on a loose ball switches too…», «the lock lasts exactly…» (los tres con `expected 1 to be 2`: sin bloqueo la histéresis devuelve el control al 1 en el mismo paso), «a tap only switches…» y «a match with C presses replays identically…» (`switches` queda en 0). **Deshaz.**
2. En `muteSwitchSprint`, añade temporalmente `return;` como primera línea. Esperado: **falla** «a tap only switches and never sprints…» con `expected 180 to be +0` (la línea de `sprintCooldownSteps`: el toque arrancó una ráfaga y soltar la cortó con sus 3 s de recuperación, justo lo que G15-5 prohíbe). **Deshaz.**
3. En `stepMatch`, comenta temporalmente `if (!isOpenPlay(match.phase)) clearManualSwitch(match);`. Esperado: **falla** «a goal, a set piece and the half-time wipe…» (`expected 34 to be 0`). **Deshaz.**
4. **El que importa (cero regrabado vigilado):** en `components/games/football-logic/ai.ts`, función `chase`, cambia temporalmente `out.c = d > SPRINT_FREE_DIST ? 'held' : 'up';` por `out.c = d > SPRINT_FREE_DIST ? 'pressed' : 'up';` y ejecuta `npx vitest run components/games/football-logic/`. Esperado (medido en un prototipo al escribir el plan: **6 fallos**): «the CPU never presses C…» (`match.test.ts`), el unitario de `ai.test.ts` «runs at the ball (quantized, dead zone) and sprints while it is far» (que fija el `'held'` de `chase`) y **cuatro grabaciones CPU-contra-CPU** de `ai.test.ts`: «(c) the keepers never left their box…» y tres de «CPU vs CPU with every published formation» (`3-2-3 vs 3-2-3`, `3-3-2 vs 4-3-1`, `3-2-3 vs 3-3-2`). Eso demuestra que la suite detectaría una CPU que pulsara C, y por tanto que su verde de hoy **es** la prueba de «sin regrabado». Si el recuento no coincide, anótalo en el ledger como hallazgo. **Deshaz** y comprueba: `git diff --quiet b130c06 -- components/games/football-logic/ai.ts && echo ai.ts intacto` → imprime `ai.ts intacto`.
5. **La guarda del equipo congelado:** en `applyManualSwitch`, quita temporalmente `team === match.rules.frozenTeam ||` de la condición (deja `if (input.c !== 'pressed' || ownSideHasBall(match, team)) return;`). Ejecuta `npx vitest run components/games/football-logic/match.test.ts`. Esperado: **falla** «a press on a loose ball switches too… -- but never for the frozen team» (el bloque `if (rules === TRAINING_RULES)`: `m2.manualSwitch.lockSteps[1]` deja de ser `0` y/o `m2.controlled[1]` deja de coincidir con el del gemelo `twin`). Es un guardarraíl hoy inalcanzable en juego real (el equipo congelado es la CPU y `match-run.ts` nunca le da un `TeamInput` distinto de `'up'`), pero con este control negativo queda vigilado como el resto. **Deshaz**.

- [ ] **Step 6: Anotar G15-5 en el spec**

En `specs/31-vault-world-cup.md`:

1. Justo después del párrafo que acaba en `actual. Así el replay solo necesita semilla + secuencia de \`TeamInput\`.` (`:194`), añade una línea en blanco y:

```markdown
> **G15-5 (v1.5, paso V15-2): para el humano deja de ser «nunca entrada».** En juego abierto, con el
> rival en posesión o el balón suelto, el flanco `c === 'pressed'` de su `TeamInput` pasa el control al
> siguiente compañero más cercano al balón (rotando entre los `MANUAL_SWITCH_POOL = 3` más cercanos de
> pie, nunca el actual) y lo bloquea `MANUAL_SWITCH_LOCK_STEPS` (0,6 s) frente a la histéresis; ganar el
> balón rompe el bloqueo, y cualquier saque, gol, descanso o la tanda lo borra. Pulsar no esprinta;
> mantener C más de `MANUAL_SWITCH_SPRINT_HOLD_STEPS` (0,25 s) sí. Como el cambio sale de la entrada, el
> replay sigue siendo semilla + `TeamInput` (criterio 1). La CPU nunca pulsa C, así que para ella el
> controlado sigue siendo exactamente el derivado (sin regrabado).
```

2. Bajo el criterio 5 (la línea `   y el cambio es automático y derivado del estado (no es entrada).`, `:502`), añade:

```markdown
   *G15-5 (v1.5): salvo el cambio manual del humano con C al defender, que sale de su `TeamInput`
   (ver «El controlado es estado derivado»).*
```

- [ ] **Step 7: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-logic/match.ts components/games/football-logic/match.test.ts
git diff --name-only b130c06 -- components/games/football-logic/ | sort
git diff --stat b130c06 -- components/games/football-logic/ai.ts components/games/football-logic/ai.test.ts components/games/football-logic/step.ts components/games/football-logic/players.ts components/games/football-logic/input.ts
grep -rn "Math.random" components/games/football-logic/
git diff b130c06 -- components/games/football-logic/match.ts components/games/football-logic/match.test.ts | grep "^+" | grep -n " as \|!\.\|: any"
```
Esperado: delta **+9 tests / +0 ficheros** → **1305 / 77** verdes; `tsc` y `eslint` sin salida; el `--name-only` lista **exactamente** los cuatro ficheros de la Global Constraint; el `--stat` de `ai.ts`/`ai.test.ts`/`step.ts`/`players.ts`/`input.ts` **vacío**; los dos `grep` **vacíos**.

- [ ] **Step 8: Anotar en el ledger**

`V15-2-2 hecha: cambio manual en stepMatch (applyManualSwitch tras las atajadas, bloqueo 36 pasos en updateTeamControlOf, sprint retenido 15 pasos vía scratch.physicsInputs, reseteo fuera de juego abierto) + spec anotado (criterio 5 y «controlado derivado»); +9 tests (1305/77). Grabaciones intactas sin tocar un número; control negativo 4 (CPU que pulsa C) las pone en rojo (6 fallos, 4 de ellos grabaciones de ai.test.ts). Motor: solo actions/match (+tests). Working tree verificado; commit lo hace Paco.`

- [ ] **Step 9: Dejar el working tree verificado; commit lo hace Paco**

No ejecutes `git add` ni `git commit`.

---

### Task V15-2-3: los dos teclados de solitario, la regla de la pausa y la persistencia (G15-6, `keyboard.ts`)

**Files:**
- Modify: `components/games/football-screen/keyboard.ts` (bloque de tablas `:37-79`)
- Modify: `components/games/football-screen/keyboard.test.ts` (imports `:5-9`; tests que usan `SOLO`; nuevo `describe` al final)
- Modify: `components/games/VaultWorldCupGame.tsx` — **solo** renombrar `SOLO` → `ARROWS_SOLO` (import `:52`, `:103`, `:216`, `:1620`, `:1645`, `:1673`, `:1681`, `:1691`, `:1698`) para que `tsc` siga verde; el cableado de verdad es la Task V15-2-5.

**Interfaces:**
- Consumes: nada de las tareas del motor.
- Produces, y las Tasks V15-2-4, V15-2-5 y V15-2-7 consumen literalmente:
  - `type KeyScheme = 'arrows' | 'classic'` · `KEY_SCHEMES: readonly KeyScheme[]` · `DEFAULT_KEY_SCHEME: KeyScheme = 'arrows'` · `KEY_SCHEME_STORAGE_KEY = 'av_vwc_key_scheme'`
  - `ARROWS_SOLO: KeyTable` (flechas + J/K/L, filas 1-2-3 / 4-5-6) · `CLASSIC_SOLO: KeyTable` (Q/A/O/P + Z/X/C, mismas filas)
  - `SOLO_TABLES_BY_SCHEME: Readonly<Record<KeyScheme, readonly [KeyTable, KeyTable]>>`
  - `isPauseKey(key: string, tables: readonly [KeyTable, KeyTable]): boolean`
  - `parseKeyScheme(raw: string | null): KeyScheme` · `loadKeyScheme(read: () => string | null): KeyScheme` · `saveKeyScheme(write: (value: string) => void, scheme: KeyScheme): void`
  - **Se retira `SOLO`** (WASD + flechas): G15-6 lo saca de las opciones. `KEY_BINDINGS` se queda como fuente de la que se recortan `ARROWS_SOLO` y los dos del modo a dos (`pickBindings`).

**Contexto que el ejecutor no tiene:**
- **Las dos tablas:** Flechas = `pickBindings(KEY_BINDINGS, P2_KEYS)` (exactamente el pad de J2 del modo a dos: nadie reaprende) con las filas de J1 (1-2-3 formación, 4-5-6 estrategia). Clásico = `q` arriba, `a` abajo, `o` izquierda, `p` derecha, `z`/`x`/`c` = A/B/C (esquema 2 del spec, teclas confirmadas en G15-6), mismas filas numéricas. Clásico no se puede recortar de `KEY_BINDINGS` (allí `a` es «izquierda» y no hay `q`/`o`/`p`/`z`/`x`), así que va literal, como el `c`/`v`/`b` de J1.
- **«Son disjuntos por si juegan dos juntos»:** los **pads** no comparten ni una tecla (lo fija un test). Las filas numéricas sí se comparten (1-6 en los dos) — son las de J1, que ya compartía el solitario; no hay modo que use los dos esquemas a la vez (el modo a dos es G9-2, fijo).
- **La regla de la pausa, derivada de las tablas y no de un `if (clásico)`:** Esc pausa siempre; la P pausa **solo si ninguna de las dos tablas activas lee la `p`**. Con Clásico la P es «derecha» → no pausa (G15-6); con Flechas y en el modo a dos (J1 WASD+CVB, J2 flechas+JKL) nadie lee la P → pausa como hoy. Se prueba en Node sin DOM.
- **Persistencia sin DOM en este módulo:** `loadKeyScheme`/`saveKeyScheme` reciben el acceso como callback y lo envuelven en `try/catch` (una ventana privada o un almacenamiento bloqueado pueden **lanzar**, no solo devolver `null`); cualquier valor que no sea exactamente `'classic'` o `'arrows'` cae a Flechas. El `.tsx` (Task V15-2-5) les pasa los dos cierres sobre `window.localStorage`. Clave `av_vwc_key_scheme`, en la línea de las del repo (`av_sfx_muted`, `av_player_name`).
- **El rename en el `.tsx` es mecánico** y cambia el comportamiento a propósito: desde esta tarea, en solitario/entrenamiento/Mundial y en los menús, WASD deja de mover (G15-6: «el esquema 1 deja de ser opción elegible»). La tabla activa por esquema llega en V15-2-5.

- [ ] **Step 1: Adaptar y ampliar los tests (en rojo)**

En `components/games/football-screen/keyboard.test.ts`:

1. Sustituye el import de `./keyboard` (`:5-9`) por:

```ts
import {
  ARROWS_SOLO, CLASSIC_SOLO, DEFAULT_KEY_SCHEME, KEY_BINDINGS, KEY_SCHEMES, KEY_SCHEME_STORAGE_KEY, SOLO_TABLES_BY_SCHEME,
  TWO_PLAYER_P1, TWO_PLAYER_P2, TWO_PLAYER_TABLES,
  createPadState, isPauseKey, loadKeyScheme, padAdvance, padBlur, padChoice, padClear, padDown, padFormationChoice,
  padKeyFor, padToTeamInput, padUp, parseKeyScheme, saveKeyScheme, tablesShareKey,
} from './keyboard';
```

2. **Reescribe** el primer test de `describe('padKeyFor', …)` (el que se llama `'maps both the arrows and WASD to the d-pad, and jkl to A/B/C'`) por:

```ts
  it('Flechas maps the arrows to the d-pad and J/K/L to A/B/C, and WASD no longer moves (G15-6)', () => {
    expect(padKeyFor(ARROWS_SOLO, 'arrowup')).toBe('up');
    expect(padKeyFor(ARROWS_SOLO, 'arrowdown')).toBe('down');
    expect(padKeyFor(ARROWS_SOLO, 'arrowleft')).toBe('left');
    expect(padKeyFor(ARROWS_SOLO, 'arrowright')).toBe('right');
    expect(padKeyFor(ARROWS_SOLO, 'j')).toBe('a');
    expect(padKeyFor(ARROWS_SOLO, 'k')).toBe('b');
    expect(padKeyFor(ARROWS_SOLO, 'l')).toBe('c');
    for (const k of ['w', 'a', 's', 'd']) expect(padKeyFor(ARROWS_SOLO, k)).toBeNull();
  });
```

3. En **todo el resto** del fichero, sustituye `SOLO` por `ARROWS_SOLO` cuando es el identificador suelto (`padKeyFor(SOLO,`, `padChoice(pad, SOLO,`, `padFormationChoice(pad, SOLO,`, `tablesShareKey(SOLO,`). Ningún valor esperado cambia (`'q'`, `'enter'` y `' '` siguen sin tecla; `tablesShareKey(ARROWS_SOLO, TWO_PLAYER_P2)` sigue siendo `'arrowup'`).

4. **Reescribe** `it('J2 is a subset of the solo map, so whoever plays alone never relearns a key', …)` por:

```ts
  it('Flechas IS J2\'s pad with J1\'s number rows, so whoever plays alone never relearns a key', () => {
    for (const [key, value] of Object.entries(TWO_PLAYER_P2.pad)) expect(ARROWS_SOLO.pad[key]).toBe(value);
    expect(Object.keys(ARROWS_SOLO.pad).length).toBe(Object.keys(TWO_PLAYER_P2.pad).length);
    expect(ARROWS_SOLO.formation).toEqual(TWO_PLAYER_P1.formation);
    expect(ARROWS_SOLO.strategy).toEqual(TWO_PLAYER_P1.strategy);
  });
```

5. **Reescribe** `it('the solo table IS the step-8 map: same objects, not copies', …)` por:

```ts
  it('KEY_BINDINGS stays the step-8 source both Flechas and the two-player maps are cut from', () => {
    expect(KEY_BINDINGS.w).toBe('up');              // still in the source (J1 needs it) ...
    expect(padKeyFor(ARROWS_SOLO, 'w')).toBeNull();  // ... but no longer in the solo map
    expect(padKeyFor(ARROWS_SOLO, 'arrowup')).toBe(KEY_BINDINGS.arrowup);
    expect(padKeyFor(ARROWS_SOLO, 'c')).toBeNull();   // C/V/B only exist for J1 in the two-player mode
  });
```

6. Añade al **final** del fichero:

```ts
// ── G15-6 (grill of the v1.5, 17-sep): two solo schemes, Flechas and Clásico. ──
describe('the solo key schemes (G15-6)', () => {
  it('Clásico moves on Q/A/O/P and fires A/B/C on Z/X/C, sharing Flechas\' number rows', () => {
    expect(padKeyFor(CLASSIC_SOLO, 'q')).toBe('up');
    expect(padKeyFor(CLASSIC_SOLO, 'a')).toBe('down');
    expect(padKeyFor(CLASSIC_SOLO, 'o')).toBe('left');
    expect(padKeyFor(CLASSIC_SOLO, 'p')).toBe('right');
    expect(padKeyFor(CLASSIC_SOLO, 'z')).toBe('a');
    expect(padKeyFor(CLASSIC_SOLO, 'x')).toBe('b');
    expect(padKeyFor(CLASSIC_SOLO, 'c')).toBe('c');
    for (const k of ['arrowup', 'arrowleft', 'j', 'k', 'l', 'w', 'd']) expect(padKeyFor(CLASSIC_SOLO, k)).toBeNull();
    expect(CLASSIC_SOLO.formation).toEqual(ARROWS_SOLO.formation);
    expect(CLASSIC_SOLO.strategy).toEqual(ARROWS_SOLO.strategy);
  });

  it('the two schemes share no pad key, and neither reads R (exit / restart)', () => {
    for (const key of Object.keys(ARROWS_SOLO.pad)) expect(padKeyFor(CLASSIC_SOLO, key)).toBeNull();
    for (const key of Object.keys(CLASSIC_SOLO.pad)) expect(padKeyFor(ARROWS_SOLO, key)).toBeNull();
    for (const scheme of KEY_SCHEMES) expect(padKeyFor(SOLO_TABLES_BY_SCHEME[scheme][0], 'r')).toBeNull();
  });

  it('pairs each scheme with itself for both teams, and Flechas is the default', () => {
    expect(KEY_SCHEMES).toEqual(['arrows', 'classic']);
    expect(DEFAULT_KEY_SCHEME).toBe('arrows');
    expect(SOLO_TABLES_BY_SCHEME.arrows[0]).toBe(ARROWS_SOLO);
    expect(SOLO_TABLES_BY_SCHEME.arrows[1]).toBe(ARROWS_SOLO);
    expect(SOLO_TABLES_BY_SCHEME.classic[0]).toBe(CLASSIC_SOLO);
    expect(SOLO_TABLES_BY_SCHEME.classic[1]).toBe(CLASSIC_SOLO);
  });

  it('isPauseKey: Esc always pauses; P only while no active table reads it', () => {
    expect(isPauseKey('escape', SOLO_TABLES_BY_SCHEME.arrows)).toBe(true);
    expect(isPauseKey('escape', SOLO_TABLES_BY_SCHEME.classic)).toBe(true);
    expect(isPauseKey('escape', TWO_PLAYER_TABLES)).toBe(true);
    expect(isPauseKey('p', SOLO_TABLES_BY_SCHEME.arrows)).toBe(true);
    expect(isPauseKey('p', SOLO_TABLES_BY_SCHEME.classic)).toBe(false);   // with Clásico, P is "right"
    expect(isPauseKey('p', TWO_PLAYER_TABLES)).toBe(true);                // G9-2 untouched
    expect(isPauseKey('j', SOLO_TABLES_BY_SCHEME.arrows)).toBe(false);
    expect(isPauseKey('r', SOLO_TABLES_BY_SCHEME.classic)).toBe(false);
  });

  it('loadKeyScheme reads the stored scheme and falls back to Flechas on nothing, on garbage and on a throwing storage', () => {
    expect(KEY_SCHEME_STORAGE_KEY).toBe('av_vwc_key_scheme');
    expect(loadKeyScheme(() => 'classic')).toBe('classic');
    expect(loadKeyScheme(() => 'arrows')).toBe('arrows');
    expect(loadKeyScheme(() => null)).toBe('arrows');
    expect(loadKeyScheme(() => 'wasd')).toBe('arrows');
    expect(loadKeyScheme(() => { throw new Error('SecurityError'); })).toBe('arrows');
    expect(parseKeyScheme('CLASSIC')).toBe('arrows');   // exact values only
  });

  it('saveKeyScheme writes the scheme and swallows a throwing storage', () => {
    const written: string[] = [];
    saveKeyScheme((value) => { written.push(value); }, 'classic');
    expect(written).toEqual(['classic']);
    expect(() => saveKeyScheme(() => { throw new Error('QuotaExceededError'); }, 'arrows')).not.toThrow();
  });
});
```

- [ ] **Step 2: Verlos fallar**

Ejecuta: `npx vitest run components/games/football-screen/keyboard.test.ts`
Esperado: **FALLA** — los tests que usan los símbolos nuevos caen (`TypeError: … is not a function` o el valor `undefined`, p. ej. `ARROWS_SOLO` importado como `undefined`); los demás, verdes.

- [ ] **Step 3: Escribir las tablas y la regla en `keyboard.ts`**

Sustituye, en `components/games/football-screen/keyboard.ts`, la línea

```ts
export const SOLO: KeyTable = { pad: KEY_BINDINGS, formation: FORMATION_KEYS, strategy: STRATEGY_KEYS };
```

por:

```ts
// G15-6 (grill of the v1.5, 17-sep): solo, training and the World Cup choose between
// TWO schemes on ELIGE MODO; the old WASD + arrows map is no longer one of them.
//   · Flechas (default) -- the arrows + J/K/L: exactly J2's pad, with J1's number rows.
//   · Clásico -- Q up, A down, O left, P right + Z/X/C, same number rows. Literal, like
//     J1's C/V/B: KEY_BINDINGS has no q/o/p/z/x and maps `a` to "left".
// The two pads share no key ("por si juegan dos juntos"); the two-player mode is not
// choosable and keeps G9-2's tables.
export type KeyScheme = 'arrows' | 'classic';
export const KEY_SCHEMES: readonly KeyScheme[] = ['arrows', 'classic'];
export const DEFAULT_KEY_SCHEME: KeyScheme = 'arrows';
export const KEY_SCHEME_STORAGE_KEY = 'av_vwc_key_scheme';

export const ARROWS_SOLO: KeyTable = { pad: pickBindings(KEY_BINDINGS, P2_KEYS), formation: FORMATION_KEYS, strategy: STRATEGY_KEYS };

export const CLASSIC_SOLO: KeyTable = {
  pad: { q: 'up', a: 'down', o: 'left', p: 'right', z: 'a', x: 'b', c: 'c' },
  formation: FORMATION_KEYS,
  strategy: STRATEGY_KEYS,
};

// Indexed by team, like TWO_PLAYER_TABLES: the solo human may be either side.
export const SOLO_TABLES_BY_SCHEME: Readonly<Record<KeyScheme, readonly [KeyTable, KeyTable]>> = {
  arrows: [ARROWS_SOLO, ARROWS_SOLO],
  classic: [CLASSIC_SOLO, CLASSIC_SOLO],
};

// G15-6: Esc always pauses; P pauses only while neither active table reads it -- with
// Clásico the P is "right". Derived from the tables, so the two-player mode (nobody
// reads P) keeps pausing on P just like before.
export function isPauseKey(key: string, tables: readonly [KeyTable, KeyTable]): boolean {
  if (key === 'escape') return true;
  return key === 'p' && padKeyFor(tables[0], 'p') === null && padKeyFor(tables[1], 'p') === null;
}

// The stored choice, read and written through callbacks so this module never touches
// the DOM. Any value but the two exact names is Flechas; a storage that THROWS (private
// window, blocked site data) is Flechas on read and a silent no-op on write -- the
// choice then lasts this visit only.
export function parseKeyScheme(raw: string | null): KeyScheme {
  return raw === 'classic' ? 'classic' : raw === 'arrows' ? 'arrows' : DEFAULT_KEY_SCHEME;
}

export function loadKeyScheme(read: () => string | null): KeyScheme {
  try {
    return parseKeyScheme(read());
  } catch {
    return DEFAULT_KEY_SCHEME;
  }
}

export function saveKeyScheme(write: (value: string) => void, scheme: KeyScheme): void {
  try {
    write(scheme);
  } catch {
    // no-op: see above.
  }
}
```

(Es la única línea que desaparece; `P2_KEYS`, `pickBindings`, `FORMATION_KEYS` y `STRATEGY_KEYS` ya están declarados antes en el fichero, y `padKeyFor` es una declaración de función: se puede usar desde `isPauseKey` aunque esté más abajo. Actualiza también el comentario de `KEY_BINDINGS` (`:10-11`: «derives the two-player tables and SOLO») para que diga «derives the two-player tables and ARROWS_SOLO».)

- [ ] **Step 4: Renombrar `SOLO` en el componente (mecánico)**

En `components/games/VaultWorldCupGame.tsx`, sustituye el identificador suelto `SOLO` por `ARROWS_SOLO` en estos sitios, y solo en estos:
- import de `./football-screen/keyboard` (`:52`): `SOLO, TWO_PLAYER_P1,` → `ARROWS_SOLO, TWO_PLAYER_P1,`
- `:103`: `const SOLO_TABLES: readonly [KeyTable, KeyTable] = [SOLO, SOLO];` → `[ARROWS_SOLO, ARROWS_SOLO]`
- `:216`: `buildFormationLabels(SOLO.formation)` → `buildFormationLabels(ARROWS_SOLO.formation)`
- `tableForPicker` (`:1620`): `: SOLO;` → `: ARROWS_SOLO;`
- los cinco `padKeyFor(SOLO, key)` de `handleKeyDown` (`:1645`, `:1673`, `:1681`, `:1691`, `:1698`) → `padKeyFor(ARROWS_SOLO, key)`
- el comentario de `:1616` («The menu keys go through the SOLO table (arrows or WASD + J)») → «The menu keys go through the ARROWS_SOLO table (arrows + J) until V15-2-5 makes them follow the chosen scheme».
- el comentario de `handleKeyUp` en `:1745` («Fix round 1, finding 3: in solo mode tables = [SOLO, SOLO]…») → «tables = [ARROWS_SOLO, ARROWS_SOLO]» (V15-2-5 lo deja obsoleto y lo vuelve a cambiar: ver Task V15-2-5 Step 4).

- [ ] **Step 5: Verlos pasar**

Ejecuta: `npx vitest run components/games/football-screen/keyboard.test.ts`
Esperado: **PASA** (los de antes, con 3 reescritos, + 6 nuevos).

- [ ] **Step 6: Romperlo a propósito (control negativo)**

1. En `isPauseKey`, cambia temporalmente el `return` final por `return key === 'p';`. Esperado: **falla** «isPauseKey: Esc always pauses…» (`expected true to be false` en la línea de Clásico). **Deshaz.**
2. En `CLASSIC_SOLO`, cambia temporalmente `c: 'c'` por `l: 'c'`. Esperado: **fallan** «Clásico moves on Q/A/O/P…» (`c` sin tecla) y «the two schemes share no pad key…» (`l` también está en Flechas). **Deshaz.**
3. En `loadKeyScheme`, quita temporalmente el `try/catch` (deja solo `return parseKeyScheme(read());`). Esperado: **falla** «loadKeyScheme reads the stored scheme…» con `Error: SecurityError`. **Deshaz** y vuelve a verlo verde.

- [ ] **Step 7: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/keyboard.ts components/games/football-screen/keyboard.test.ts components/games/VaultWorldCupGame.tsx
git diff --name-only b130c06 -- components/games/football-logic/ | sort
grep -rnw "SOLO" components/games/football-screen/ components/games/VaultWorldCupGame.tsx
grep -rn "Math.random\|document\.\|window\.\|localStorage\." components/games/football-screen/keyboard.ts
```
Esperado: delta **+6 tests / +0 ficheros** → **1311 / 77** verdes; `tsc` y `eslint` sin salida; motor: los cuatro ficheros de siempre y ninguno más; el `grep -w SOLO` devuelve **solo** las dos cadenas de UI `'CRUCETA: APUNTAR · SALE SOLO'` (`HINT_AIM`, `.tsx`) y `'… SOLO SU PORTERO …'` (`MODE_BLURBS.training`, `flow.ts`) — `-w` no casa `SOLO_TABLES` ni `FORMATION_HINT_SOLO` (`_` es carácter de palabra) —; el último `grep` **vacío**.

- [ ] **Step 8: Anotar en el ledger**

`V15-2-3 hecha: ARROWS_SOLO (flechas+JKL, = pad de J2) y CLASSIC_SOLO (QAOP+ZXC) con pads disjuntos, SOLO retirado (WASD fuera del solitario), isPauseKey derivada de las tablas (Esc siempre; P si ninguna la lee), load/saveKeyScheme con try/catch; componente solo renombrado. +6 tests (1311/77). Motor intacto en esta tarea. Working tree verificado; commit lo hace Paco.`

- [ ] **Step 9: Dejar el working tree verificado; commit lo hace Paco**

---

### Task V15-2-4: el esquema en el flujo, su fila en ELIGE MODO y los textos por esquema (G15-6, puro)

**Files:**
- Modify: `components/games/football-screen/flow.ts` (imports `:1-8`; `FlowState` `:74-83`; `createFlowState` `:85-87`; funciones nuevas tras `flowConfirmMode` `:123-133`)
- Modify: `components/games/football-screen/flow.test.ts` (import `:10-15`; tres tests en `describe('the mode selector', …)` `:83`)
- Modify: `components/games/football-screen/flow-layout.ts` (tras `modeCardY` `:40-42`)
- Modify: `components/games/football-screen/flow-layout.test.ts` (import `:3-7`; un test en `describe('the other screens', …)`)
- Create: `components/games/football-screen/control-hints.ts`
- Test: `components/games/football-screen/control-hints.test.ts`

**Interfaces:**
- Consumes de la Task V15-2-3: `ARROWS_SOLO`, `CLASSIC_SOLO`, `TWO_PLAYER_P1`, `TWO_PLAYER_P2`, `DEFAULT_KEY_SCHEME`, `type KeyScheme`, `type KeyTable`, `type PadKey`.
- Produces, y la Task V15-2-5 consume literalmente:
  - `FlowState.keyScheme: KeyScheme` · `flowToggleKeyScheme(f: FlowState): void` (solo en `mode-select`) · `flowSetKeyScheme(f: FlowState, scheme: KeyScheme): void`
  - `MODE_SCHEME_ROW_Y = 434` · `MODE_SCHEME_DETAIL_Y = 454` · `MODE_HINT_Y = VIEW_H - 24` (= 476)
  - `keyLabel(table: KeyTable, k: PadKey): string` · `type ControlHints` · `CONTROL_HINTS: Readonly<Record<KeyScheme, ControlHints>>` · `keeperHintFor(table: KeyTable): string` · `TWO_PLAYER_SCHEME_NOTE: string`

**Contexto que el ejecutor no tiene:**
- **Dónde vive el esquema:** en `FlowState`, como el `modeIndex`: una preferencia del jugador, no de una partida, así que **sobrevive a `flowReset`** (volver al selector no la borra) y solo se cambia en ELIGE MODO. `flowSetKeyScheme` existe para cargar lo guardado antes del primer frame (V15-2-5).
- **La fila (resuelto por Paco 22-sep, punto 3 de «Resueltas por Paco» en la Task V15-2-8):** «Selector = fila en ELIGE MODO» se implementa como una línea fija bajo las cuatro tarjetas, `TECLADO: < FLECHAS >` + una línea de detalle con las teclas, que se cambia con **IZQ / DER** desde cualquier tarjeta (hoy IZQ/DER no hacen nada en esa pantalla; ARRIBA/ABAJO siguen eligiendo modo). Así `flow.ts` no cambia la semántica de `modeIndex` ni sus tests. Con AMISTOSO A DOS marcado la fila sale atenuada con la nota del reparto fijo de G9-2 (el esquema no aplica, pero se puede seguir cambiando para los otros modos). Geometría: la última tarjeta acaba en `modeCardY(3) + MODE_CARD_H = 414`; la fila en 434, el detalle en 454 y la pista de la pantalla en 476 (`MODE_HINT_Y`, hoy el literal `VIEW_H - 24` de `drawModeSelect`).
- **Los textos, una vez por esquema:** hoy `KEEPER_HINT`, `MODE_HINT`, `TEAM_HINT_SOLO`, `DRAW_HINT`, `BRACKET_CHOICE_HINT`, `BRACKET_PLAY_HINT`, `SPECTATE_BANNER` y `VICTORY_HINT` (`VaultWorldCupGame.tsx:190-234`) llevan la J/K a fuego. `control-hints.ts` los construye **al cargar el módulo** a partir de la propia tabla (`keyLabel(table, 'a')` → `'J'` en Flechas, `'Z'` en Clásico), así que un texto nunca puede contradecir a su tabla; `draw()` solo hace una búsqueda por propiedad (criterio 20). Los de Flechas quedan **palabra por palabra** como hoy (test de regresión), salvo `mode`, que gana «IZQ / DER: TECLADO».
- **`keeperHintFor`:** por identidad de tabla, como hoy (`tables[t] === TWO_PLAYER_P1 ? KEEPER_HINT_P1 : KEEPER_HINT`), con un caso más: Clásico → `'SAQUE: X CORTO · Z LARGO · '`. Flechas y J2 leen las mismas J/K → el mismo texto de hoy.
- **`keyLabel` y `Object.keys`:** se llama solo al cargar el módulo (y en tests), nunca por frame. El orden de `Object.keys` es el de inserción: en `ARROWS_SOLO` la `'a'` es la `j` (única), en `TWO_PLAYER_P1` la `c`.

- [ ] **Step 1: Escribir los tests en rojo**

1. Crea `components/games/football-screen/control-hints.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CONTROL_HINTS, TWO_PLAYER_SCHEME_NOTE, keeperHintFor, keyLabel, type ControlHints,
} from './control-hints';
import { ARROWS_SOLO, CLASSIC_SOLO, KEY_SCHEMES, TWO_PLAYER_P1, TWO_PLAYER_P2, type KeyTable } from './keyboard';

function allTexts(h: ControlHints): string[] {
  return [h.schemeRow, h.schemeDetail, h.mode, h.teamSolo, h.draw, h.bracketChoice, h.bracketPlay, h.spectate, h.victory];
}

describe('control hints per key scheme (G15-6)', () => {
  it('keeps the step-8 wording for Flechas, word for word', () => {
    const h = CONTROL_HINTS.arrows;
    expect(h.teamSolo).toBe('CRUCETA · A (J) CONFIRMA · 1/2/3 ALINEACIÓN');
    expect(h.draw).toBe('A (J) PARA CONTINUAR');
    expect(h.bracketChoice).toBe('IZQ / DER · A (J) CONFIRMA');
    expect(h.bracketPlay).toBe('A (J) PARA JUGAR');
    expect(h.spectate).toBe('PARTIDO DE LA CPU · X4 · A (J) SALTA AL RESULTADO');
    expect(h.victory).toBe('A (J) · CONTINUAR');
    expect(h.mode).toBe('ARRIBA / ABAJO: MODO · IZQ / DER: TECLADO · A (J) CONFIRMA');
  });

  it('names Clásico\'s own A key everywhere and never Flechas\' J', () => {
    const h = CONTROL_HINTS.classic;
    expect(h.draw).toBe('A (Z) PARA CONTINUAR');
    expect(h.mode).toBe('ARRIBA / ABAJO: MODO · IZQ / DER: TECLADO · A (Z) CONFIRMA');
    for (const text of allTexts(h)) expect(text).not.toContain('(J)');
    for (const text of allTexts(CONTROL_HINTS.arrows)) expect(text).not.toContain('(Z)');
  });

  it('keeperHintFor: the step-8 texts for Flechas, J2 and J1, and Clásico\'s own', () => {
    expect(keeperHintFor(ARROWS_SOLO)).toBe('SAQUE: K CORTO · J LARGO · ');
    expect(keeperHintFor(TWO_PLAYER_P2)).toBe('SAQUE: K CORTO · J LARGO · ');
    expect(keeperHintFor(TWO_PLAYER_P1)).toBe('SAQUE: V CORTO · C LARGO · ');
    expect(keeperHintFor(CLASSIC_SOLO)).toBe('SAQUE: X CORTO · Z LARGO · ');
  });

  it('keyLabel names the key a table reads for a pad key, upper-cased, and throws when there is none', () => {
    expect(keyLabel(ARROWS_SOLO, 'a')).toBe('J');
    expect(keyLabel(CLASSIC_SOLO, 'right')).toBe('P');
    expect(keyLabel(TWO_PLAYER_P1, 'b')).toBe('V');
    const noC: KeyTable = { pad: { j: 'a' }, formation: [], strategy: [] };
    expect(() => keyLabel(noC, 'c')).toThrow();
  });

  it('the scheme row names the scheme, the detail its keys and its pause, and the two-player note says it is fixed', () => {
    for (const scheme of KEY_SCHEMES) {
      for (const text of allTexts(CONTROL_HINTS[scheme])) expect(text.length).toBeGreaterThan(0);
    }
    expect(CONTROL_HINTS.arrows.schemeRow).toContain('FLECHAS');
    expect(CONTROL_HINTS.classic.schemeRow).toContain('CLÁSICO');
    expect(CONTROL_HINTS.arrows.schemeDetail).toContain('J/K/L');
    expect(CONTROL_HINTS.arrows.schemeDetail).toContain('P');
    expect(CONTROL_HINTS.classic.schemeDetail).toContain('Q/A/O/P');
    expect(CONTROL_HINTS.classic.schemeDetail).toContain('Z/X/C');
    expect(CONTROL_HINTS.classic.schemeDetail).toContain('ESC');
    expect(TWO_PLAYER_SCHEME_NOTE).toContain('WASD');
  });
});
```

2. En `components/games/football-screen/flow.test.ts`, añade `flowSetKeyScheme, flowToggleKeyScheme` al import de `./flow` (`:10-15`) y, dentro de `describe('the mode selector', …)` (`:83`), tras el último `it`, añade:

```ts
  it('starts on Flechas and keeps the chosen scheme across a reset (G15-6: a preference, not a run)', () => {
    const f = createFlowState();
    expect(f.keyScheme).toBe('arrows');
    flowToggleKeyScheme(f);
    expect(f.keyScheme).toBe('classic');
    flowConfirmMode(f);
    flowReset(f);
    expect(f.phase).toBe('mode-select');
    expect(f.keyScheme).toBe('classic');
  });

  it('flowToggleKeyScheme flips the scheme on mode-select only', () => {
    const f = createFlowState();
    flowToggleKeyScheme(f);
    flowToggleKeyScheme(f);
    expect(f.keyScheme).toBe('arrows');
    flowConfirmMode(f);
    flowToggleKeyScheme(f);
    expect(f.phase).toBe('team-select');
    expect(f.keyScheme).toBe('arrows');
  });

  it('flowSetKeyScheme sets it on any screen (the stored choice is loaded before the first frame)', () => {
    const f = createFlowState();
    flowConfirmMode(f);
    flowSetKeyScheme(f, 'classic');
    expect(f.keyScheme).toBe('classic');
  });
```

3. En `components/games/football-screen/flow-layout.test.ts`, añade `MODE_HINT_Y, MODE_SCHEME_DETAIL_Y, MODE_SCHEME_ROW_Y` al import de `./flow-layout` (`:3-7`) y, dentro de `describe('the other screens', …)`, añade:

```ts
  it('the key-scheme row and its detail sit between the last mode card and the hint (G15-6)', () => {
    expect(MODE_SCHEME_ROW_Y - 8).toBeGreaterThan(modeCardY(3) + MODE_CARD_H);
    expect(MODE_SCHEME_DETAIL_Y).toBeGreaterThan(MODE_SCHEME_ROW_Y + 12);
    expect(MODE_SCHEME_DETAIL_Y + 8).toBeLessThan(MODE_HINT_Y - 6);
    expect(MODE_HINT_Y).toBe(VIEW_H - 24);
  });
```

- [ ] **Step 2: Verlos fallar**

Ejecuta: `npx vitest run components/games/football-screen/control-hints.test.ts components/games/football-screen/flow.test.ts components/games/football-screen/flow-layout.test.ts`
Esperado: **FALLA** — `control-hints.test.ts` con `Failed to resolve import "./control-hints"` (fichero nuevo); en `flow.test.ts` y `flow-layout.test.ts` (ficheros existentes) los tests que usan los símbolos nuevos caen (`TypeError: … is not a function` o el valor `undefined`, p. ej. `flowSetKeyScheme`/`MODE_HINT_Y`); los demás, verdes.

- [ ] **Step 3: `flow.ts`**

1. Tras los imports (`:1-8`) añade:

```ts
import { DEFAULT_KEY_SCHEME, type KeyScheme } from './keyboard';
```

2. En `FlowState` (`:74-83`), tras `after: FlowPhase;             // where 'over' goes once the captions drain`, añade:

```ts
  keyScheme: KeyScheme;         // G15-6: Flechas or Clásico; a preference, so it survives a reset
```

3. En `createFlowState`, añade `keyScheme: DEFAULT_KEY_SCHEME` al literal devuelto (tras `after: 'mode-select'`). `flowReset` **no** se toca (a propósito: no resetea el esquema).

4. Tras `flowConfirmMode` (`:123-133`), añade:

```ts
// G15-6: the key-scheme row of ELIGE MODO, flipped with left/right from any card.
export function flowToggleKeyScheme(f: FlowState): void {
  if (f.phase !== 'mode-select') return;
  f.keyScheme = f.keyScheme === 'arrows' ? 'classic' : 'arrows';
}

// Loads the stored choice (the component reads localStorage once, at mount).
export function flowSetKeyScheme(f: FlowState, scheme: KeyScheme): void {
  f.keyScheme = scheme;
}
```

- [ ] **Step 4: `flow-layout.ts`**

Tras `modeCardY` (`:40-42`), añade:

```ts
// G15-6: under the four cards, the key-scheme row and its detail line, then the hint.
export const MODE_SCHEME_ROW_Y = 434;
export const MODE_SCHEME_DETAIL_Y = 454;
export const MODE_HINT_Y = VIEW_H - 24;
```

- [ ] **Step 5: Crear `control-hints.ts`**

Crea `components/games/football-screen/control-hints.ts`:

```ts
import {
  ARROWS_SOLO, CLASSIC_SOLO, TWO_PLAYER_P1, type KeyScheme, type KeyTable, type PadKey,
} from './keyboard';

// G15-6 (grill of the v1.5, 17-sep): every on-screen text that names a key, built ONCE
// per scheme when the module loads -- draw() only looks a property up (criterion 20).
// The key letters come from the table itself, so a hint can never contradict the keys
// it describes. The Flechas texts are the step-8 ones word for word, except `mode`,
// which now also says how to change the scheme.

// The key a table reads for a pad key, upper-cased for the screen ('j' -> 'J'). Only
// called at module load and by tests (Object.keys allocates).
export function keyLabel(table: KeyTable, k: PadKey): string {
  for (const key of Object.keys(table.pad)) if (table.pad[key] === k) return key.toUpperCase();
  throw new Error(`no key for ${k}`);
}

export type ControlHints = {
  readonly schemeRow: string;      // ELIGE MODO: the row, 'TECLADO: < FLECHAS >'
  readonly schemeDetail: string;   // ELIGE MODO: the keys of that scheme and its pause
  readonly mode: string;           // ELIGE MODO: the screen hint
  readonly teamSolo: string;
  readonly draw: string;
  readonly bracketChoice: string;
  readonly bracketPlay: string;
  readonly spectate: string;
  readonly victory: string;
};

const SCHEME_NAMES: Readonly<Record<KeyScheme, string>> = { arrows: 'FLECHAS', classic: 'CLÁSICO' };
// The direction keys have no single-letter label on the arrows, so the detail line is
// written per scheme; its button letters are checked against the tables by the tests.
const SCHEME_DETAILS: Readonly<Record<KeyScheme, string>> = {
  arrows: 'FLECHAS + J/K/L · P O ESC PAUSA',
  classic: 'Q/A/O/P + Z/X/C · ESC PAUSA (LA P ES DERECHA)',
};

function buildHints(scheme: KeyScheme, table: KeyTable): ControlHints {
  const a = keyLabel(table, 'a');
  return {
    schemeRow: `TECLADO: < ${SCHEME_NAMES[scheme]} >`,
    schemeDetail: SCHEME_DETAILS[scheme],
    mode: `ARRIBA / ABAJO: MODO · IZQ / DER: TECLADO · A (${a}) CONFIRMA`,
    teamSolo: `CRUCETA · A (${a}) CONFIRMA · 1/2/3 ALINEACIÓN`,
    draw: `A (${a}) PARA CONTINUAR`,
    bracketChoice: `IZQ / DER · A (${a}) CONFIRMA`,
    bracketPlay: `A (${a}) PARA JUGAR`,
    spectate: `PARTIDO DE LA CPU · X4 · A (${a}) SALTA AL RESULTADO`,
    victory: `A (${a}) · CONTINUAR`,
  };
}

export const CONTROL_HINTS: Readonly<Record<KeyScheme, ControlHints>> = {
  arrows: buildHints('arrows', ARROWS_SOLO),
  classic: buildHints('classic', CLASSIC_SOLO),
};

// Shown dimmed on the scheme row while AMISTOSO A DOS is the highlighted mode: G9-2's
// split is fixed and the scheme does not apply to it.
export const TWO_PLAYER_SCHEME_NOTE = 'A DOS NO SE ELIGE: J1 WASD + C/V/B · J2 FLECHAS + J/K/L';

// S-SC3's keeper-hold hint, per table: B throws short, A throws long.
function keeperHint(table: KeyTable): string {
  return `SAQUE: ${keyLabel(table, 'b')} CORTO · ${keyLabel(table, 'a')} LARGO · `;
}
const KEEPER_HINT_ARROWS = keeperHint(ARROWS_SOLO);   // also J2's: the same J/K
const KEEPER_HINT_CLASSIC = keeperHint(CLASSIC_SOLO);
const KEEPER_HINT_P1 = keeperHint(TWO_PLAYER_P1);

// By table identity, like the step-8 code it replaces: no string is built per frame.
export function keeperHintFor(table: KeyTable): string {
  if (table === CLASSIC_SOLO) return KEEPER_HINT_CLASSIC;
  if (table === TWO_PLAYER_P1) return KEEPER_HINT_P1;
  return KEEPER_HINT_ARROWS;
}
```

- [ ] **Step 6: Verlos pasar**

Ejecuta: `npx vitest run components/games/football-screen/control-hints.test.ts components/games/football-screen/flow.test.ts components/games/football-screen/flow-layout.test.ts`
Esperado: **PASA** (5 + los de `flow` con 3 más + los de `flow-layout` con 1 más).

- [ ] **Step 7: Romperlo a propósito (control negativo)**

1. En `keeperHint`, intercambia temporalmente `'b'` y `'a'`. Esperado: **falla** «keeperHintFor: the step-8 texts…» (`'SAQUE: J CORTO · K LARGO · '`). **Deshaz.**
2. En `CONTROL_HINTS`, construye temporalmente `classic` con `ARROWS_SOLO`. Esperado: **falla** «names Clásico's own A key…». **Deshaz.**
3. En `flowReset`, añade temporalmente `f.keyScheme = 'arrows';`. Esperado: **falla** «starts on Flechas and keeps the chosen scheme across a reset». **Deshaz** y vuelve a verlo verde.

- [ ] **Step 8: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/flow.ts components/games/football-screen/flow.test.ts components/games/football-screen/flow-layout.ts components/games/football-screen/flow-layout.test.ts components/games/football-screen/control-hints.ts components/games/football-screen/control-hints.test.ts
git diff --name-only b130c06 -- components/games/football-logic/ | sort
grep -rn "Math.random\|document\.\|window\.\|localStorage\.\| as " components/games/football-screen/control-hints.ts components/games/football-screen/control-hints.test.ts
```
Esperado: delta **+9 tests / +1 fichero** → **1320 / 78** verdes; `tsc` y `eslint` sin salida; motor, los cuatro de siempre; el `grep` **vacío**.

- [ ] **Step 9: Anotar en el ledger**

`V15-2-4 hecha: FlowState.keyScheme (sobrevive a flowReset) + flowToggleKeyScheme/flowSetKeyScheme; MODE_SCHEME_ROW_Y/DETAIL_Y/MODE_HINT_Y; control-hints.ts (textos por esquema derivados de la tabla, Flechas palabra por palabra como hoy; keeperHintFor por identidad). +9 tests / +1 fichero (1320/78). Working tree verificado; commit lo hace Paco.`

- [ ] **Step 10: Dejar el working tree verificado; commit lo hace Paco**

---

### Task V15-2-5: cableado de los esquemas y de la pausa — menús por la tabla activa, fila en ELIGE MODO, Esc (G15-6, pantalla)

**Files:**
- Modify: `components/games/VaultWorldCupGame.tsx` (imports `:31-54`; props `:74-92`; constantes `:103`, `:190-234`; destructuring `:290-302`; refs `:303-333`; montaje junto a `const flow = createFlowState();` `:349`; `let tables` `:369`; `startMatch` `:516`; `drawHud` `:1322`, `:1330`; `drawModeSelect` `:1412`; `drawTeamSelect` `:1455`; `drawDraw` `:1472`; `drawBracket` `:1516`; `drawVictory` `:1561`; `tableForPicker` + `handleKeyDown` `:1616-1742`)
- Modify: `app/games/vault-world-cup/play/page.tsx` (`togglePause` nuevo; efecto de teclas `:222-236`; JSX `:283-295`)

**Interfaces:**
- Consumes de V15-2-3: `ARROWS_SOLO`, `SOLO_TABLES_BY_SCHEME`, `TWO_PLAYER_P1`, `TWO_PLAYER_P2`, `TWO_PLAYER_TABLES`, `KEY_SCHEME_STORAGE_KEY`, `isPauseKey`, `loadKeyScheme`, `saveKeyScheme`, `type PadKey`.
- Consumes de V15-2-4: `flowToggleKeyScheme`, `flowSetKeyScheme`, `flow.keyScheme`, `MODE_SCHEME_ROW_Y`, `MODE_SCHEME_DETAIL_Y`, `MODE_HINT_Y`, `CONTROL_HINTS`, `keeperHintFor`, `TWO_PLAYER_SCHEME_NOTE`.
- Produces, y la Task V15-2-7 consume (funciones internas del efecto del `.tsx`, no exports):
  - `menuAction(k: PadKey): boolean` — la acción de un botón de pad en la pantalla de menú actual; `false` si no significa nada ahí.
  - `requestPause(): void` — llama a la prop `onPauseToggle`.
  - Prop nueva del componente: `onPauseToggle?: () => void`.

**Contexto que el ejecutor no tiene:**
- **Instantánea previa (la hace el controlador antes de despachar):** `VaultWorldCupGame.tsx` y `page.tsx` copiados a `.superpowers/sdd/2026-09-22-vault-world-cup-v15-2/snapshot-before-v15-2-5/` con extensión `.txt` (`components_games_VaultWorldCupGame.tsx.txt`, `app_games_vault-world-cup_play_page.tsx.txt`).
- **La pausa cambia de dueño:** hoy la escucha la play-page (`page.tsx:226`, `key === 'p'` en `window`), que no sabe qué esquema hay (brief §0 hallazgo 3). Pasa al componente, que sí lo sabe: `isPauseKey(key, pauseTables())` **antes** de la guarda `if (pausedRef.current || blocked) return;` (o la tecla nunca podría quitar la pausa) y llama a la prop `onPauseToggle`. La página conserva su estado `paused`, el botón PAUSA/REANUDAR y la R tras el Mundial; solo pierde la rama de la P y pasa `onPauseToggle`. El mando (Start, V15-2-7) usará el mismo `requestPause`. Es la salida (iii) del brief §4, derivada de las tablas.
- **Qué tablas mira la pausa (`pauseTables`):** en `match`/`over`/`spectate`, las del partido (`tables`: el esquema en solitario, `TWO_PLAYER_TABLES` a dos → la P pausa); en la selección del modo a dos, `TWO_PLAYER_TABLES`; en el resto de menús, el par del esquema elegido (con Clásico, la P es «derecha» también en los menús: navega el cuadro y cambia el esquema).
- **`menuAction(k)`:** el `switch` por fase de hoy (`:1641-1703`) pasa a una función que recibe un `PadKey`, para que teclado y mando (V15-2-7) compartan un único camino. El teclado traduce la tecla con la tabla del menú (`menuTable()` = el esquema elegido; `tableForPicker()` en la selección, que a dos sigue siendo la de cada jugador, G9-2). Nuevo en `mode-select`: IZQ/DER → `toggleKeyScheme()` (cambia y guarda). El `if (e.repeat) return;` que cada `case` repetía pasa a una sola línea común.
- **Persistencia:** dos cierres creados **una vez** al montar sobre `window.localStorage` y la clave `KEY_SCHEME_STORAGE_KEY`; `loadKeyScheme`/`saveKeyScheme` les ponen el `try/catch`. Se carga una vez (antes del primer frame); se guarda al cambiar (un evento). Reiniciar desde la página (remonta) vuelve a cargar lo guardado.
- **Qué NO cambia:** `handleKeyUp` (ya enruta por `tables`), el bloque `case 'match'` (R para salir del entrenamiento, pads, `padChoice`), `drawTeamStrip` (las dos tablas de solitario tienen las mismas filas 1-6 que J1, así que su `FORMATION_HINT_SOLO` vale para las dos), `TEAM_TITLES_TWO`/`TEAM_HINTS_TWO`/`MODE_BLURBS` (modo a dos, G9-2).

- [ ] **Step 1: Imports, props y constantes**

1. Import de `./football-screen/flow` (`:31-36`): añade `flowSetKeyScheme, flowToggleKeyScheme`. Import de `./football-screen/flow-layout` (`:37-41`): añade `MODE_HINT_Y, MODE_SCHEME_DETAIL_Y, MODE_SCHEME_ROW_Y`. Sustituye el import de `./football-screen/keyboard` (`:51-54`) por:

```ts
import {
  ARROWS_SOLO, KEY_SCHEME_STORAGE_KEY, SOLO_TABLES_BY_SCHEME, TWO_PLAYER_P1, TWO_PLAYER_P2, TWO_PLAYER_TABLES,
  createPadState, isPauseKey, loadKeyScheme, padAdvance, padBlur, padChoice, padClear, padDown, padFormationChoice,
  padKeyFor, padToTeamInput, padUp, saveKeyScheme, type KeyTable, type PadKey, type PadState,
} from './football-screen/keyboard';
```

y añade, junto a los demás imports de `./football-screen/*` (orden alfabético, tras `captions`):

```ts
import { CONTROL_HINTS, TWO_PLAYER_SCHEME_NOTE, keeperHintFor } from './football-screen/control-hints';
```

2. En `interface VaultWorldCupGameProps` (`:74-92`), tras `onViewportBlocked?: () => void;`, añade:

```ts
  // G15-6: the pause keys live in the component, which knows the active key scheme
  // (Esc always; P only while no active table reads it -- with Clásico P is "right").
  // The play page keeps the `paused` state and flips it here; the gamepad's Start
  // (G15-20) lands here too.
  onPauseToggle?: () => void;
```

Añade `onPauseToggle,` al destructuring (`:290-302`, tras `onViewportBlocked,`), `const onPauseToggleRef = useRef(onPauseToggle);` tras `const onViewportBlockedRef = useRef(onViewportBlocked);` (`:312`), `onPauseToggleRef.current = onPauseToggle;` dentro del efecto de refs (tras `onViewportBlockedRef.current = onViewportBlocked;`, `:332`) y `onPauseToggle` al final de su array de dependencias (`:333`).

3. Borra la constante `const SOLO_TABLES: readonly [KeyTable, KeyTable] = [ARROWS_SOLO, ARROWS_SOLO];` (`:103`) y estas nueve (`:190-234`), que pasan a `control-hints.ts`:

```ts
const KEEPER_HINT = 'SAQUE: K CORTO · J LARGO · ';
const KEEPER_HINT_P1 = 'SAQUE: V CORTO · C LARGO · ';
const MODE_HINT = 'ARRIBA / ABAJO · A (J) PARA CONFIRMAR';
const TEAM_HINT_SOLO = 'CRUCETA · A (J) CONFIRMA · 1/2/3 ALINEACIÓN';
const DRAW_HINT = 'A (J) PARA CONTINUAR';
const BRACKET_CHOICE_HINT = 'IZQ / DER · A (J) CONFIRMA';
const BRACKET_PLAY_HINT = 'A (J) PARA JUGAR';
const SPECTATE_BANNER = 'PARTIDO DE LA CPU · X4 · A (J) SALTA AL RESULTADO';
const VICTORY_HINT = 'A (J) · CONTINUAR';
```

`FORMATION_LABELS_SOLO` (`:216`, `buildFormationLabels(ARROWS_SOLO.formation)`) se queda: las dos tablas de solitario tienen las mismas teclas 1/2/3.

- [ ] **Step 2: Estado al montar y `startMatch`**

1. Justo después de `const flow = createFlowState();` (`:349`), añade:

```ts
    // G15-6: the chosen key scheme survives a reload. Two closures over localStorage,
    // created once; loadKeyScheme/saveKeyScheme wrap them in try/catch, so a private
    // window or blocked site data simply starts on Flechas and forgets on reload.
    const readStoredScheme = (): string | null => window.localStorage.getItem(KEY_SCHEME_STORAGE_KEY);
    const writeStoredScheme = (value: string): void => {
      window.localStorage.setItem(KEY_SCHEME_STORAGE_KEY, value);
    };
    flowSetKeyScheme(flow, loadKeyScheme(readStoredScheme));
```

2. `let tables: readonly [KeyTable, KeyTable] = SOLO_TABLES;` (`:369`) → `let tables: readonly [KeyTable, KeyTable] = SOLO_TABLES_BY_SCHEME[flow.keyScheme];`

3. En `startMatch` (`:516`): `tables = side === 'both' ? TWO_PLAYER_TABLES : SOLO_TABLES;` → `tables = side === 'both' ? TWO_PLAYER_TABLES : SOLO_TABLES_BY_SCHEME[flow.keyScheme];`

- [ ] **Step 3: Textos por esquema en el dibujo**

1. `drawHud`, pista del portero (`:1322`): `const hint = tables[keeperHoldTeam] === TWO_PLAYER_P1 ? KEEPER_HINT_P1 : KEEPER_HINT;` → `const hint = keeperHintFor(tables[keeperHoldTeam]);` (y actualiza el comentario de encima: «The hint names the keys of the table in use (keeperHintFor).»).
2. `drawHud`, cruce de la CPU (`:1330`): `ctx.fillText(SPECTATE_BANNER, VIEW_W / 2, HUD_H + 16);` → `ctx.fillText(CONTROL_HINTS[flow.keyScheme].spectate, VIEW_W / 2, HUD_H + 16);`
3. `drawModeSelect` (`:1412`): sustituye `drawHint(MODE_HINT, VIEW_H - 24);` por:

```ts
      // G15-6: the key-scheme row, changed with left/right from any card. Dimmed while
      // AMISTOSO A DOS is highlighted: G9-2's split is fixed there.
      const hints = CONTROL_HINTS[flow.keyScheme];
      const two = flowHumanCount(flow) === 2;
      ctx.textAlign = 'center';
      ctx.font = FONT_MENU_BLURB;
      ctx.fillStyle = two ? DIM_TEXT : HUD_ACCENT;
      ctx.fillText(hints.schemeRow, VIEW_W / 2, MODE_SCHEME_ROW_Y);
      ctx.font = FONT_SMALL;
      ctx.fillStyle = two ? DIM_TEXT : HUD_TEXT;
      ctx.fillText(two ? TWO_PLAYER_SCHEME_NOTE : hints.schemeDetail, VIEW_W / 2, MODE_SCHEME_DETAIL_Y);
      drawHint(hints.mode, MODE_HINT_Y);
```

4. `drawTeamSelect` (`:1455`): `drawHint(two ? TEAM_HINTS_TWO[picking] : TEAM_HINT_SOLO, SELECT_HINT_Y);` → `drawHint(two ? TEAM_HINTS_TWO[picking] : CONTROL_HINTS[flow.keyScheme].teamSolo, SELECT_HINT_Y);`
5. `drawDraw` (`:1472`): `drawHint(DRAW_HINT, VIEW_H - 24);` → `drawHint(CONTROL_HINTS[flow.keyScheme].draw, VIEW_H - 24);`
6. `drawBracket` (`:1516`): `drawHint(bracketHasChoice ? BRACKET_CHOICE_HINT : BRACKET_PLAY_HINT, BRACKET_HINT_Y);` → `drawHint(bracketHasChoice ? CONTROL_HINTS[flow.keyScheme].bracketChoice : CONTROL_HINTS[flow.keyScheme].bracketPlay, BRACKET_HINT_Y);`
7. `drawVictory` (`:1561`): `drawHint(VICTORY_HINT, VICTORY_HINT_Y);` → `drawHint(CONTROL_HINTS[flow.keyScheme].victory, VICTORY_HINT_Y);`

- [ ] **Step 4: Teclado — `menuAction`, pausa y tabla activa**

Sustituye todo el bloque que va desde el comentario `// The menu keys go through the ARROWS_SOLO table (arrows + J) until V15-2-5 …` (`:1616`) hasta la llave que cierra `handleKeyDown` (justo antes de `function handleKeyUp`, `:1742`) por:

```ts
    // G15-6: the menus read the ACTIVE solo scheme (Flechas or Clásico), never a fixed
    // table; the two-player team selector keeps each player's own table (G9-2), so J2
    // picks with the arrows and J while J1 holds WASD and C.
    function menuTable(): KeyTable {
      return SOLO_TABLES_BY_SCHEME[flow.keyScheme][0];
    }

    function tableForPicker(): KeyTable {
      return flowHumanCount(flow) === 2 ? TWO_PLAYER_TABLES[flowPickingHuman(flow)] : menuTable();
    }

    // The pair of tables isPauseKey looks at: the match's own during a match (so the
    // two-player friendly pauses on P whatever scheme is stored), the two players' on
    // their selector, and the chosen scheme on every other screen.
    function pauseTables(): readonly [KeyTable, KeyTable] {
      const phase = flow.phase;
      if (phase === 'match' || phase === 'over' || phase === 'spectate') return tables;
      if (phase === 'team-select' && flowHumanCount(flow) === 2) return TWO_PLAYER_TABLES;
      return SOLO_TABLES_BY_SCHEME[flow.keyScheme];
    }

    function requestPause(): void {
      const cb = onPauseToggleRef.current;
      if (cb !== undefined) cb();
    }

    function toggleKeyScheme(): void {
      flowToggleKeyScheme(flow);
      saveKeyScheme(writeStoredScheme, flow.keyScheme);
    }

    // One action per pad key on the menu screen showing now. The keyboard (through the
    // menu table) and, from V15-2-7, the gamepad both land here. false = the key means
    // nothing on this screen, so the keyboard handler must not preventDefault it.
    function menuAction(k: PadKey): boolean {
      const phase = flow.phase;
      switch (phase) {
        case 'mode-select':
          if (k === 'up') flowMoveMode(flow, -1);
          else if (k === 'down') flowMoveMode(flow, 1);
          else if (k === 'left' || k === 'right') toggleKeyScheme();
          else if (k === 'a') flowConfirmMode(flow);
          else return false;
          return true;
        case 'team-select':
          if (k === 'up') flowMoveTeam(flow, 0, -1, TEAMS.length);
          else if (k === 'down') flowMoveTeam(flow, 0, 1, TEAMS.length);
          else if (k === 'left') flowMoveTeam(flow, -1, 0, TEAMS.length);
          else if (k === 'right') flowMoveTeam(flow, 1, 0, TEAMS.length);
          else if (k === 'a') confirmTeam();
          else return false;
          return true;
        case 'draw':
          if (k !== 'a') return false;
          flowConfirmDraw(flow);
          refreshBracketView();
          return true;
        case 'bracket':
          if (k === 'left') flowMoveBracketChoice(flow, -1);
          else if (k === 'right') flowMoveBracketChoice(flow, 1);
          else if (k === 'a') confirmBracket();
          else return false;
          return true;
        case 'spectate':
          if (k !== 'a') return false;
          skipSpectate();
          return true;
        case 'victory':
          if (k !== 'a') return false;
          continueFromVictory();
          return true;
        case 'match':
        case 'over':
          return false;
      }
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (isTypingTarget(e)) return;
      if (!sfxReady) {
        sfxReady = true;
        // QA fix (2026-09-11): this lazy audio setup ran unguarded before the menu
        // dispatch below. A throw here (autoplay policy, a bad SFX_VOLUME entry after
        // a future edit) would abort handleKeyDown for the CURRENT key -- including a
        // first-ever confirm on ELIGE MODO -- while sfxReady is already latched true,
        // so every later key silently skips this block and looks fine. sfx is
        // best-effort; it must never be able to eat the keystroke that triggered it.
        try {
          sfxVaultWorldCup.init();
          sfxVaultWorldCup.setMuted(mutedRef.current);
        } catch {
          // no-op: the menu/match dispatch below still has to run this frame.
        }
      }
      const key = e.key.toLowerCase();
      // G15-6: Esc always; P only while no active table reads it. BEFORE the paused
      // guard, or the key could never lift the pause it set.
      if (isPauseKey(key, pauseTables())) {
        e.preventDefault();
        if (!e.repeat) requestPause();
        return;
      }
      if (pausedRef.current || blocked) return;
      if (e.repeat) return;   // auto-repeat is not a new press: the pad edges are ours
      const phase = flow.phase;
      if (phase === 'over') return;
      if (phase === 'match') {
        if (key === 'r') {
          // S-FL4 / S-FL6: R leaves the training only; flowExitMatch is a no-op in a timed match.
          flowExitMatch(flow, mode);
          // flowExitMatch only ever moves the flow away from 'match' into
          // 'mode-select' (flowReset): `!== 'match'` reads the same as
          // `=== 'mode-select'` here without tripping tsc's literal-narrowing
          // check, which does not know an opaque call can mutate flow.phase.
          if (flow.phase !== 'match') {
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
      const table = phase === 'team-select' ? tableForPicker() : menuTable();
      const k = padKeyFor(table, key);
      if (k !== null && menuAction(k)) {
        e.preventDefault();
        return;
      }
      // Cheap minor: only the FORMATION row of the picker's table is routed here --
      // a strategy key (4/5/6, 0 ' ¡) is a mid-match choice and must not
      // preventDefault or touch the pad at this screen.
      if (phase === 'team-select') {
        const picker = flowPickingHuman(flow);
        if (padFormationChoice(pads[picker], table, key)) {
          flowSetFormation(flow, picker, pads[picker].formation);
          e.preventDefault();
        }
      }
    }
```

(Nota para el ejecutor: el bloque `case 'match'` de hoy empezaba con su propio `if (e.repeat) return;`; ahora ese `return` es común y va antes. En `menuAction`, el `switch` sobre la constante local `phase` es exhaustivo — `tsc` lo sabe igual que en `phaseGroup` (`flow.ts:34-47`) — así que no hace falta un `return` final; si `tsc` se quejara con `TS2366`, **no** añadas `as` ni un `default` que trague fases: añade un `default: { const _exhaustive: never = phase; return _exhaustive; }` como el de `stepMatch`.)

`handleKeyUp` no cambia de cuerpo (ya enruta por `tables`), pero su comentario, tocado mecánicamente en la Task V15-2-3 Step 4 para decir `tables = [ARROWS_SOLO, ARROWS_SOLO]`, queda obsoleto en cuanto `tables` puede ser también el par de Clásico: sustituye ese comentario por «Fix round 1, finding 3: in solo mode tables = the chosen scheme's pair…» (mismo sitio, solo texto).

- [ ] **Step 5: La play-page**

En `app/games/vault-world-cup/play/page.tsx`:

1. Tras `const restart = useCallback(…, [username]);` (`:204-220`), añade:

```tsx
  // G15-6: the component owns the pause keys now (it knows the active key scheme and
  // the gamepad's Start); it only asks the page to flip the state it keeps.
  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);
```

2. Sustituye el efecto de teclas (`:222-236`) por:

```tsx
  // R restarts -- only once a World Cup has reported its end (a stray R mid-match must
  // not wipe a run; inside a training match R is the game's own exit, handled entirely
  // by the component's own keydown handler, never by the page). The pause keys (Esc,
  // and P unless the Clásico scheme reads it) moved into the component (G15-6).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.repeat || isTypingTarget(e)) return;
      if (e.key.toLowerCase() === 'r' && over) {
        e.preventDefault();
        restart();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [over, restart]);
```

3. En el JSX de `<VaultWorldCupGame …>` (`:283-295`), añade `onPauseToggle={togglePause}` tras `onViewportBlocked={handleViewportBlocked}`.

- [ ] **Step 6: Verificación completa**

Esta tarea no añade tests (todo lo probable es puro y ya está probado en V15-2-3/V15-2-4; lo que queda es cableado de DOM y lo cubre el QA de Paco).

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/VaultWorldCupGame.tsx app/games/vault-world-cup/play/page.tsx
git diff --name-only b130c06 -- components/games/football-logic/ | sort
grep -nw "SOLO\|SOLO_TABLES\|KEEPER_HINT\|KEEPER_HINT_P1\|MODE_HINT\|TEAM_HINT_SOLO\|DRAW_HINT\|BRACKET_CHOICE_HINT\|BRACKET_PLAY_HINT\|SPECTATE_BANNER\|VICTORY_HINT" components/games/VaultWorldCupGame.tsx
grep -n "padKeyFor(ARROWS_SOLO" components/games/VaultWorldCupGame.tsx
grep -n "localStorage" components/games/VaultWorldCupGame.tsx
grep -n "'p'" app/games/vault-world-cup/play/page.tsx
grep -n "onPauseToggle" components/games/VaultWorldCupGame.tsx app/games/vault-world-cup/play/page.tsx
```
Esperado:
- **1320 tests / 78 ficheros** verdes (sin cambio), `tsc` sin salida, `eslint` sin salida en el `.tsx` y **solo los 3 errores preexistentes** en `page.tsx` (ver Global Constraints), motor: los cuatro de siempre.
- El primer `grep` devuelve **solo** la línea de `HINT_AIM` (`'CRUCETA: APUNTAR · SALE SOLO'`, una cadena de UI); el segundo, **vacío**.
- `localStorage`: **3** líneas — el comentario y los dos cierres creados al montar.
- `'p'` en la página: **vacío**.
- `onPauseToggle`: en el `.tsx` la prop, el destructuring, el `useRef`, la asignación del efecto, el array de dependencias y `const cb = onPauseToggleRef.current;` dentro de `requestPause` (casa por contener «onPauseToggle»); en la página, el `onPauseToggle={togglePause}`.
- Revisión a ojo (criterio 20): ninguna línea nueva dentro de `draw*` construye strings ni objetos — solo `CONTROL_HINTS[flow.keyScheme].<campo>` y `keeperHintFor(...)`.

- [ ] **Step 7: Anotar en el ledger**

`V15-2-5 hecha: menús por la tabla activa (menuAction(PadKey) común), IZQ/DER en ELIGE MODO cambia y guarda el esquema (fila + detalle; atenuada con AMISTOSO A DOS), textos por esquema, pausa en el componente (isPauseKey antes de la guarda de pausa; onPauseToggle), la P fuera de la play-page, localStorage con try/catch. Suite 1320/78 sin cambio. Motor intacto en esta tarea. Working tree verificado; commit lo hace Paco.`

- [ ] **Step 8: Dejar el working tree verificado; commit lo hace Paco**

---

### Task V15-2-6: `lib/gamepad` — de la instantánea del mando a un estado con zona muerta y flancos, sin navegador (G15-20)

**Files:**
- Create: `lib/gamepad.ts`
- Test: `lib/gamepad.test.ts`
- Create: `lib/gamepad-navigator.ts` (capa fina, sin test: su única lógica es la de `assignGamepadSlots`, que sí se prueba)

**Interfaces:**
- Consumes: nada (módulo común del portal: no importa nada de `components/`).
- Produces, y la Task V15-2-7 consume literalmente:
  - `type GamepadControl = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'c' | 'l1' | 'r1' | 'start'` · `GAMEPAD_CONTROLS: readonly GamepadControl[]`
  - `type GamepadEdge = 'up' | 'pressed' | 'held' | 'released'`
  - `type GamepadButtonLike = { readonly pressed: boolean }` · `type GamepadLike = { readonly connected: boolean; readonly axes: readonly number[]; readonly buttons: readonly GamepadButtonLike[] }` (un `Gamepad` real encaja por estructura: sin `as`)
  - `type GamepadPad = { connected: boolean; down: Record<GamepadControl, boolean>; edge: Record<GamepadControl, GamepadEdge> }`
  - `STANDARD_BUTTON: Readonly<Record<GamepadControl, number>>` · `GAMEPAD_STICK_DEAD_ZONE = 0.5`
  - `createGamepadPad(): GamepadPad` · `nextEdge(wasDown: boolean, isDown: boolean): GamepadEdge` · `stickAxis(value: number, deadZone: number): -1 | 0 | 1`
  - `readGamepad(snapshot: GamepadLike | null | undefined, pad: GamepadPad): void`
  - `assignGamepadSlots(list: ArrayLike<GamepadLike | null | undefined> | null, slots: readonly GamepadPad[]): number` → cuántos mandos conectados hay
  - `pollGamepads(slots: readonly GamepadPad[]): number` (en `lib/gamepad-navigator.ts`)

**Contexto que el ejecutor no tiene:**
- **La Gamepad API no avisa: se sondea.** Mientras hay algún mando visto (`gamepadSeen`, cableado en la Task V15-2-7), cada frame se llama a `navigator.getGamepads()`, que devuelve un array **nuevo** de `Gamepad | null` (huecos incluidos). Es la excepción al criterio 20 anotada en G15-20: vive sola en `lib/gamepad-navigator.ts`, con un comentario que lo dice, y todo lo demás escribe en estado creado una vez. `pollGamepads` en sí no sabe nada de `gamepadSeen` — es su única llamante, `pollGamepadFrame`, quien decide si la ejecuta este frame (pre-vuelo H8).
- **Mapeo estándar W3C** (`mapping === 'standard'`, el de casi todos los mandos USB/Bluetooth en Chrome y Safari): botones 0 = abajo (A/✕), 1 = derecha (B/○), 2 = izquierda (X/□), 3 = arriba (Y/△), 4 = L1, 5 = R1, 8 = select, 9 = start, 12-15 = cruceta arriba/abajo/izquierda/derecha; ejes 0/1 = stick izquierdo x/y (+y hacia abajo). G15-20 fija: A/✕ → `a` (chut), B/○ → `b` (pase), X/□ → `c` (sprint/cambio), L1/R1 → estrategia, Start → pausa, stick o cruceta → mover. Un mando que no declare `'standard'` se lee con los mismos índices (resuelto por Paco 22-sep, punto 5 de «Resueltas por Paco» en la Task V15-2-8).
- **Zona muerta:** el stick es analógico; aquí se cuantiza a -1/0/1 por eje con umbral 0,5 (más de la mitad del recorrido). Las diagonales salen solas (los dos ejes pasan el umbral). Cruceta y stick se suman con un OR.
- **Flancos:** `nextEdge` es la máquina de estados del mando (`up → pressed → held → released → up`), calculada **entre dos sondeos** (dos frames). Un mando que desaparece o se desconecta lee todo `'up'` **sin** flanco `'released'`: como `padBlur`, soltar por desconexión no es un chut que el jugador pidiera.
- **Ranuras:** `assignGamepadSlots` recorre la lista en orden y mete el primer mando conectado en la ranura 0 («mando 1») y el segundo en la 1 («mando 2»), saltando huecos; las ranuras sobrantes se limpian. (Si el mando 1 se desconecta, el 2 pasa a ser el 1: aceptado; se mira en el QA.)
- **Test en Node:** los tests pasan objetos literales que cumplen `GamepadLike`; no hay `navigator`.

- [ ] **Step 1: Escribir el test en rojo**

Crea `lib/gamepad.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  GAMEPAD_CONTROLS, GAMEPAD_STICK_DEAD_ZONE, STANDARD_BUTTON, assignGamepadSlots, createGamepadPad, nextEdge, readGamepad,
  stickAxis, type GamepadLike,
} from './gamepad';

// A standard-mapping pad (17 buttons, 4 axes) with the given buttons down and the left
// stick at (x, y).
function snapshot(down: readonly number[], x = 0, y = 0): GamepadLike {
  const buttons: { pressed: boolean }[] = [];
  for (let i = 0; i < 17; i++) buttons.push({ pressed: down.includes(i) });
  return { connected: true, axes: [x, y, 0, 0], buttons };
}

describe('lib/gamepad: from a pad snapshot to edges (G15-20)', () => {
  it('nextEdge walks up -> pressed -> held -> released -> up', () => {
    expect(nextEdge(false, true)).toBe('pressed');
    expect(nextEdge(true, true)).toBe('held');
    expect(nextEdge(true, false)).toBe('released');
    expect(nextEdge(false, false)).toBe('up');
  });

  it('reads the standard mapping: A/✕ 0 shoots (a), B/○ 1 passes (b), X/□ 2 sprints/switches (c), L1 4, R1 5, Start 9', () => {
    expect(STANDARD_BUTTON.a).toBe(0);
    expect(STANDARD_BUTTON.b).toBe(1);
    expect(STANDARD_BUTTON.c).toBe(2);
    expect(STANDARD_BUTTON.l1).toBe(4);
    expect(STANDARD_BUTTON.r1).toBe(5);
    expect(STANDARD_BUTTON.start).toBe(9);
    const pad = createGamepadPad();
    readGamepad(snapshot([0, 2, 5, 9]), pad);
    expect(pad.connected).toBe(true);
    expect(pad.down.a).toBe(true);
    expect(pad.down.b).toBe(false);
    expect(pad.down.c).toBe(true);
    expect(pad.down.l1).toBe(false);
    expect(pad.down.r1).toBe(true);
    expect(pad.down.start).toBe(true);
  });

  it('the d-pad buttons 12-15 and the left stick both drive the four directions', () => {
    const pad = createGamepadPad();
    readGamepad(snapshot([12, 15]), pad);
    expect([pad.down.up, pad.down.down, pad.down.left, pad.down.right]).toEqual([true, false, false, true]);
    readGamepad(snapshot([], -0.9, 0.8), pad);
    expect([pad.down.up, pad.down.down, pad.down.left, pad.down.right]).toEqual([false, true, true, false]);
    readGamepad(snapshot([13], 0.9, 0), pad);
    expect([pad.down.up, pad.down.down, pad.down.left, pad.down.right]).toEqual([false, true, false, true]);
  });

  it('the stick has a dead zone: up to 0.5 is centred, past it is a direction', () => {
    expect(GAMEPAD_STICK_DEAD_ZONE).toBe(0.5);
    expect(stickAxis(0.5, GAMEPAD_STICK_DEAD_ZONE)).toBe(0);
    expect(stickAxis(-0.5, GAMEPAD_STICK_DEAD_ZONE)).toBe(0);
    expect(stickAxis(0.51, GAMEPAD_STICK_DEAD_ZONE)).toBe(1);
    expect(stickAxis(-0.51, GAMEPAD_STICK_DEAD_ZONE)).toBe(-1);
    const pad = createGamepadPad();
    readGamepad(snapshot([], 0.3, -0.45), pad);   // a resting stick drifts: nothing moves
    expect([pad.down.up, pad.down.down, pad.down.left, pad.down.right]).toEqual([false, false, false, false]);
  });

  it('a button kept down is pressed on the first read and held after; letting go is released once, then up', () => {
    const pad = createGamepadPad();
    readGamepad(snapshot([0]), pad);
    expect(pad.edge.a).toBe('pressed');
    readGamepad(snapshot([0]), pad);
    expect(pad.edge.a).toBe('held');
    readGamepad(snapshot([]), pad);
    expect(pad.edge.a).toBe('released');
    readGamepad(snapshot([]), pad);
    expect(pad.edge.a).toBe('up');
    readGamepad(snapshot([], 0, 1), pad);          // directions have edges too (menus step once per push)
    expect(pad.edge.down).toBe('pressed');
  });

  it('a missing or disconnected pad reads everything up, with no released edge (like padBlur)', () => {
    const pad = createGamepadPad();
    readGamepad(snapshot([0, 12]), pad);
    readGamepad(null, pad);
    expect(pad.connected).toBe(false);
    for (const c of GAMEPAD_CONTROLS) {
      expect(pad.down[c]).toBe(false);
      expect(pad.edge[c]).toBe('up');
    }
    readGamepad(snapshot([0]), pad);
    readGamepad({ connected: false, axes: [], buttons: [] }, pad);
    expect(pad.edge.a).toBe('up');
    readGamepad(undefined, pad);
    expect(pad.connected).toBe(false);
  });

  it('a pad with fewer buttons or axes than the standard layout reads the missing ones up and centred', () => {
    const pad = createGamepadPad();
    readGamepad({ connected: true, axes: [], buttons: [{ pressed: true }, { pressed: false }] }, pad);
    expect(pad.connected).toBe(true);
    expect(pad.down.a).toBe(true);
    expect(pad.down.start).toBe(false);
    expect(pad.down.up).toBe(false);
    expect(pad.down.right).toBe(false);
  });

  it('assignGamepadSlots fills the slots with the connected pads in order, skips the holes and clears the rest', () => {
    const slots = [createGamepadPad(), createGamepadPad()];
    const off: GamepadLike = { connected: false, axes: [], buttons: [] };
    expect(assignGamepadSlots([null, snapshot([1]), off, snapshot([2])], slots)).toBe(2);
    expect(slots[0].down.b).toBe(true);
    expect(slots[1].down.c).toBe(true);
    expect(assignGamepadSlots([undefined, snapshot([0])], slots)).toBe(1);
    expect(slots[0].down.a).toBe(true);
    expect(slots[1].connected).toBe(false);
    expect(slots[1].edge.c).toBe('up');            // cleared, not released
    expect(assignGamepadSlots(null, slots)).toBe(0);
    expect(slots[0].connected).toBe(false);
  });
});
```

- [ ] **Step 2: Verlo fallar**

Ejecuta: `npx vitest run lib/gamepad.test.ts`
Esperado: **FALLA** con `Failed to resolve import "./gamepad"`.

- [ ] **Step 3: Escribir `lib/gamepad.ts`**

```ts
// G15-20 (Paco, 21-sep): physical gamepads through the Gamepad API. This module is the
// PURE half, shared by the whole portal: it turns one snapshot of a pad (a Gamepad, or
// any object shaped like one) into ten digital controls -- the four directions, the
// three buttons of the repo's shared A/B/C mapping, L1, R1 and Start -- with a dead
// zone on the stick and the up/pressed/held/released edges between two reads. The
// names of the first seven are the keyboard's pad keys, so a game can feed them to the
// same entries its keyboard uses. Nothing here touches navigator (that is
// gamepad-navigator.ts) and nothing allocates after createGamepadPad.

export type GamepadControl = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'c' | 'l1' | 'r1' | 'start';
export const GAMEPAD_CONTROLS: readonly GamepadControl[] = ['up', 'down', 'left', 'right', 'a', 'b', 'c', 'l1', 'r1', 'start'];

export type GamepadEdge = 'up' | 'pressed' | 'held' | 'released';

// The slice of the DOM's Gamepad this module reads: a real Gamepad fits it unchanged.
export type GamepadButtonLike = { readonly pressed: boolean };
export type GamepadLike = {
  readonly connected: boolean;
  readonly axes: readonly number[];
  readonly buttons: readonly GamepadButtonLike[];
};

export type GamepadPad = {
  connected: boolean;
  down: Record<GamepadControl, boolean>;      // this read
  edge: Record<GamepadControl, GamepadEdge>;  // this read against the one before
};

// The W3C "standard" layout. A/✕ bottom shoots, B/○ right passes, X/□ left sprints or
// switches, L1/R1 change the strategy, Start pauses; 12-15 are the d-pad. A pad that
// does not report 'standard' is still read with these indices (Paco, 22-sep: read with the standard indices).
export const STANDARD_BUTTON: Readonly<Record<GamepadControl, number>> = {
  a: 0, b: 1, c: 2, l1: 4, r1: 5, start: 9, up: 12, down: 13, left: 14, right: 15,
};
const STICK_X_AXIS = 0;
const STICK_Y_AXIS = 1;   // +y is down, like the screen
export const GAMEPAD_STICK_DEAD_ZONE = 0.5;

export function createGamepadPad(): GamepadPad {
  return {
    connected: false,
    down: { up: false, down: false, left: false, right: false, a: false, b: false, c: false, l1: false, r1: false, start: false },
    edge: { up: 'up', down: 'up', left: 'up', right: 'up', a: 'up', b: 'up', c: 'up', l1: 'up', r1: 'up', start: 'up' },
  };
}

export function nextEdge(wasDown: boolean, isDown: boolean): GamepadEdge {
  if (isDown) return wasDown ? 'held' : 'pressed';
  return wasDown ? 'released' : 'up';
}

// -1 / 0 / 1 past the dead zone (strictly more than `deadZone` of the travel).
export function stickAxis(value: number, deadZone: number): -1 | 0 | 1 {
  return value > deadZone ? 1 : value < -deadZone ? -1 : 0;
}

function buttonDown(snap: GamepadLike, index: number): boolean {
  return index < snap.buttons.length && snap.buttons[index].pressed;
}

function axisAt(snap: GamepadLike, index: number): number {
  return index < snap.axes.length ? snap.axes[index] : 0;
}

function write(pad: GamepadPad, c: GamepadControl, isDown: boolean): void {
  pad.edge[c] = nextEdge(pad.down[c], isDown);
  pad.down[c] = isDown;
}

// A pad that vanished or disconnected reads all up with NO released edge: like
// padBlur, letting go because the cable came out is not a shot the player asked for.
function clearGamepadPad(pad: GamepadPad): void {
  pad.connected = false;
  for (let i = 0; i < GAMEPAD_CONTROLS.length; i++) {
    const c = GAMEPAD_CONTROLS[i];
    pad.down[c] = false;
    pad.edge[c] = 'up';
  }
}

export function readGamepad(snapshot: GamepadLike | null | undefined, pad: GamepadPad): void {
  if (snapshot === null || snapshot === undefined || !snapshot.connected) {
    clearGamepadPad(pad);
    return;
  }
  pad.connected = true;
  const sx = stickAxis(axisAt(snapshot, STICK_X_AXIS), GAMEPAD_STICK_DEAD_ZONE);
  const sy = stickAxis(axisAt(snapshot, STICK_Y_AXIS), GAMEPAD_STICK_DEAD_ZONE);
  write(pad, 'up', buttonDown(snapshot, STANDARD_BUTTON.up) || sy < 0);
  write(pad, 'down', buttonDown(snapshot, STANDARD_BUTTON.down) || sy > 0);
  write(pad, 'left', buttonDown(snapshot, STANDARD_BUTTON.left) || sx < 0);
  write(pad, 'right', buttonDown(snapshot, STANDARD_BUTTON.right) || sx > 0);
  write(pad, 'a', buttonDown(snapshot, STANDARD_BUTTON.a));
  write(pad, 'b', buttonDown(snapshot, STANDARD_BUTTON.b));
  write(pad, 'c', buttonDown(snapshot, STANDARD_BUTTON.c));
  write(pad, 'l1', buttonDown(snapshot, STANDARD_BUTTON.l1));
  write(pad, 'r1', buttonDown(snapshot, STANDARD_BUTTON.r1));
  write(pad, 'start', buttonDown(snapshot, STANDARD_BUTTON.start));
}

// "Mando 1" is the first connected pad of the browser's list, "mando 2" the second;
// holes and disconnected entries are skipped and the slots left over are cleared.
// Returns how many connected pads were found.
export function assignGamepadSlots(list: ArrayLike<GamepadLike | null | undefined> | null, slots: readonly GamepadPad[]): number {
  let slot = 0;
  if (list !== null) {
    for (let i = 0; i < list.length && slot < slots.length; i++) {
      const g = list[i];
      if (g === null || g === undefined || !g.connected) continue;
      readGamepad(g, slots[slot]);
      slot++;
    }
  }
  const found = slot;
  for (; slot < slots.length; slot++) readGamepad(null, slots[slot]);
  return found;
}
```

- [ ] **Step 4: Escribir `lib/gamepad-navigator.ts`**

```ts
import { assignGamepadSlots, type GamepadPad } from './gamepad';

// G15-20: the ONE place that touches navigator. Criterion 20 exception, written into
// G15-20 itself: navigator.getGamepads() builds a new array on every call (and, in
// Chrome, a new Gamepad/GamepadButton snapshot per connected pad), and the browser
// offers no other way to read a pad. The caller (VaultWorldCupGame.tsx's
// pollGamepadFrame) only calls this while it has seen a gamepad at all (gamepadSeen,
// pre-flight H8), so a keyboard-only session never pays this allocation. Everything
// downstream writes into the slots created once by the caller.
// Some browsers throw here (permissions policy, insecure context): no pads, then.
export function pollGamepads(slots: readonly GamepadPad[]): number {
  let list: ArrayLike<Gamepad | null> | null = null;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') list = navigator.getGamepads();
  } catch {
    list = null;
  }
  return assignGamepadSlots(list, slots);
}
```

- [ ] **Step 5: Verlo pasar**

Ejecuta: `npx vitest run lib/gamepad.test.ts`
Esperado: **PASA**, 8 tests.

- [ ] **Step 6: Romperlo a propósito (control negativo)**

1. En `readGamepad`, cambia temporalmente `GAMEPAD_STICK_DEAD_ZONE` por `0` en las dos llamadas a `stickAxis`. Esperado: **falla** «the stick has a dead zone…» (la deriva 0,3/-0,45 mueve). **Deshaz.**
2. En `clearGamepadPad`, sustituye temporalmente el cuerpo del bucle por `const c = GAMEPAD_CONTROLS[i]; pad.edge[c] = nextEdge(pad.down[c], false); pad.down[c] = false;` (el flanco se calcula con el estado anterior, como en `write`). Esperado: **fallan** «a missing or disconnected pad reads everything up, with no released edge» y la línea `slots[1].edge.c` de «assignGamepadSlots…» (`'released'` en vez de `'up'`). **Deshaz** y vuelve a verlo verde.

- [ ] **Step 7: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint lib/gamepad.ts lib/gamepad.test.ts lib/gamepad-navigator.ts
git diff --name-only b130c06 -- components/games/football-logic/ | sort
grep -nE "\b(navigator|window|document)\.[a-zA-Z]+\(" lib/gamepad.ts lib/gamepad.test.ts
grep -n "Math.random\| as \|from '@/\|from '.*components/" lib/gamepad.ts lib/gamepad.test.ts
grep -rn "getGamepads" app components lib
```
Esperado: delta **+8 tests / +1 fichero** → **1328 / 79** verdes; `tsc` y `eslint` sin salida; motor, los cuatro de siempre; el primer `grep` (llamadas reales, no cualquier «navigator.»/«window.»/«document.» — el comentario de `:8`, «(that is gamepad-navigator.ts)», no cuenta) **vacío**; el segundo, **vacío**; `getGamepads` aparece **solo** en `lib/gamepad-navigator.ts` (y en su comentario).

- [ ] **Step 8: Anotar en el ledger**

`V15-2-6 hecha: lib/gamepad.ts puro (mapeo estándar, zona muerta 0,5, flancos, desconexión sin 'released', ranuras mando 1/2) + lib/gamepad-navigator.ts (única lectura de navigator; excepción del criterio 20 anotada). +8 tests / +1 fichero (1328/79). Working tree verificado; commit lo hace Paco.`

- [ ] **Step 9: Dejar el working tree verificado; commit lo hace Paco**

---

### Task V15-2-7: el mando en el juego — mismas entradas que el teclado, menús, Start — y el catálogo de controles (G15-20, G15-5, G15-6)

**Files:**
- Create: `components/games/football-screen/gamepad-input.ts`
- Test: `components/games/football-screen/gamepad-input.test.ts`
- Modify: `components/games/football-screen/keyboard.ts` (tras `settle`, al final del bloque de `padToTeamInput`) y `keyboard.test.ts` (import; nuevo `describe` al final)
- Modify: `components/games/VaultWorldCupGame.tsx` (imports; montaje junto a `const pads` `:368`; `startMatch` `:518-522`; `runStep` `:719-720`; `update` `:869-872`; `loop` `:1600`; `handleKeyDown` (bloque `if (!sfxReady)`); funciones nuevas tras `menuAction`; `handleBlur` `:1758`)
- Modify: `lib/games-registry.ts` (entrada `'vault-world-cup'`, `controls.keyboard` e `instructions.tips`, `:414-453`) y `lib/games-registry.test.ts` (un test al final)

**Interfaces:**
- Consumes de V15-2-6: `createGamepadPad`, `type GamepadPad` (`@/lib/gamepad` en el `.tsx`; `../../../lib/gamepad` en el módulo y su test), `pollGamepads` (`@/lib/gamepad-navigator`), `readGamepad` y `type GamepadLike` (solo el test).
- Consumes de V15-2-5 (funciones internas del efecto): `menuAction(k: PadKey): boolean`, `requestPause(): void`.
- Consumes de `keyboard.ts`: `padDown`, `padUp`, `STRATEGY_BY_KEY`, `type PadKey`, `type PadState`.
- Produces:
  - `PAD_KEYS: readonly PadKey[]` · `routeGamepadToPad(gp: GamepadPad, pad: PadState): void` · `routeGamepadStrategy(gp: GamepadPad, pad: PadState): void` (`gamepad-input.ts`)
  - `overlayPadToTeamInput(pad: PadState, first: boolean, out: TeamInput): void` (`keyboard.ts`)

**Contexto que el ejecutor no tiene:**
- **«Traduce a las mismas entradas que el teclado»** se toma al pie de la letra: los tres botones del mando llaman a `padDown`/`padUp`, las mismas funciones que un `keydown`/`keyup`, sobre un `PadState` **propio del mando** (uno por equipo, `gamepadPads`). Así el mando hereda toda la máquina de estados del teclado sin reescribirla: una pulsación sobrevive a un frame sin paso (H3 del paso 8), no hay autorrepetición, soltar solo produce `'released'` si antes hubo pulsación (y un botón mantenido a través de la pausa no dispara al volver: `padBlur` lo deja arriba y el mando solo informa `'held'`). Las direcciones se copian de `gp.down` en cada lectura.
- **Teclado y mando a la vez (G15-20):** son dos `PadState` distintos por equipo; `runStep` escribe el `TeamInput` con el del teclado (`padToTeamInput`) y encima pone el del mando (`overlayPadToTeamInput`): cada eje que el teclado deja a 0 lo rellena el mando; cada botón se queda con el estado «más fuerte» (`pressed > held > released > up`). Se probó por separado en vez de hacer que el mando escriba en el `PadState` del teclado porque entonces soltar el stick soltaría una flecha que el teclado sigue pisando.
- **El sondeo es condicionado (excepción del criterio 20 acotada al mando visto):** `pollGamepadFrame` solo llama a `pollGamepads` — y por tanto a `navigator.getGamepads()` — mientras `gamepadSeen` sea `true`. `gamepadSeen` se activa con un sondeo inicial al montar (mandos ya conectados antes de entrar en la página, que Chrome/Firefox no siempre exponen hasta la primera pulsación) o con el evento `gamepadconnected`, y se desactiva solo cuando, tras un `gamepaddisconnected`, un nuevo sondeo confirma que no queda ninguno conectado (así un segundo mando que sigue vivo no lo apaga). Quien juega solo con teclado nunca paga la asignación del array (ni las instancias `Gamepad`/`GamepadButton` que Chrome crea por mando en cada llamada): la excepción del criterio 20 queda acotada a «mientras haya al menos un mando visto», no a todo frame del juego.
- **Quién es quién:** ranura 0 = «mando 1», ranura 1 = «mando 2» (`assignGamepadSlots`). A dos (`humanSide === 'both'`): mando 1 → equipo 0 (J1), mando 2 → equipo 1 (J2); con un solo mando, J2 juega con teclado (G15-20). En solitario solo cuenta el mando 1 (resuelto por Paco 22-sep, punto 5 de «Resueltas por Paco» en la Task V15-2-8). En la selección de equipo del modo a dos, cada mando elige para su jugador; en los demás menús vale cualquiera.
- **L1/R1 (estrategia):** un paso hacia ATAQUE (L1) o DEFENSA (R1) en el orden de las teclas 4/5/6, con tope en los extremos; escribe la `strategy` del `PadState` **del teclado** (el campo que comparten los dos dispositivos y que ya lleva al motor). Dirección resuelta por Paco 22-sep (punto 4 de «Resueltas por Paco» en la Task V15-2-8). La formación no tiene botón de mando (G15-20 no le asigna ninguno): sigue en 1/2/3.
- **Start** llama a `requestPause()` en cualquier pantalla (flanco `'pressed'`), también en pausa (para quitarla). Mientras hay pausa o bloqueo, el mando no hace nada más y sus `PadState` se levantan sin flanco en cada frame.
- **Menús:** cada flanco `'pressed'` de las siete teclas de pad es **un** `menuAction(k)` — el mismo camino que el teclado (V15-2-5). Un stick empujado y mantenido mueve el cursor una vez, no uno por frame.
- **Sonido:** el audio se inicializa perezosamente en la primera tecla (`sfxReady`). Para quien entra solo con mando, el bloque se extrae a `ensureSfx()` y también lo llama el primer `menuAction` de mando. (Si el navegador no da por buena una pulsación de mando como gesto de usuario para el audio, el QA lo dirá: punto 11.)
- **El catálogo** (`lib/games-registry.ts`) se reescribe una sola vez, aquí, con todo lo del paso: Flechas, Clásico, Esc, el cambio con C y el mando. Los textos de «ocho de dieciséis» se quedan (V15-3).
- **Instantánea previa (la hace el controlador):** `VaultWorldCupGame.tsx` a `.superpowers/sdd/2026-09-22-vault-world-cup-v15-2/snapshot-before-v15-2-7/components_games_VaultWorldCupGame.tsx.txt`.

- [ ] **Step 1: Escribir los tests en rojo**

1. Crea `components/games/football-screen/gamepad-input.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createGamepadPad, readGamepad, type GamepadLike } from '../../../lib/gamepad';
import { createTeamInput } from '../football-logic/input';
import { PAD_KEYS, routeGamepadStrategy, routeGamepadToPad } from './gamepad-input';
import { createPadState, padAdvance, padBlur, padToTeamInput } from './keyboard';

// A standard-mapping pad (17 buttons, 4 axes) with the given buttons down and the left
// stick at (x, y).
function snapshot(down: readonly number[], x = 0, y = 0): GamepadLike {
  const buttons: { pressed: boolean }[] = [];
  for (let i = 0; i < 17; i++) buttons.push({ pressed: down.includes(i) });
  return { connected: true, axes: [x, y, 0, 0], buttons };
}

describe('the gamepad drives the keyboard\'s own pad entries (G15-20)', () => {
  it('the directions follow the stick and the d-pad on every read', () => {
    const gp = createGamepadPad();
    const pad = createPadState('neutral', 0);
    readGamepad(snapshot([], 0.9, -0.9), gp);
    routeGamepadToPad(gp, pad);
    expect([pad.up, pad.down, pad.left, pad.right]).toEqual([true, false, false, true]);
    readGamepad(snapshot([14]), gp);
    routeGamepadToPad(gp, pad);
    expect([pad.up, pad.down, pad.left, pad.right]).toEqual([false, false, true, false]);
    expect(PAD_KEYS).toEqual(['up', 'down', 'left', 'right', 'a', 'b', 'c']);
  });

  it('a press goes through padDown: it survives a frame with no step, and is held once a step consumed it', () => {
    const gp = createGamepadPad();
    const pad = createPadState('neutral', 0);
    const out = createTeamInput();
    readGamepad(snapshot([0]), gp);
    routeGamepadToPad(gp, pad);          // frame 1: pressed; no step ran, so no padAdvance
    readGamepad(snapshot([0]), gp);
    routeGamepadToPad(gp, pad);          // frame 2: the pad reads 'held' -- no second padDown
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('pressed');       // the press was not lost
    padAdvance(pad);
    readGamepad(snapshot([0]), gp);
    routeGamepadToPad(gp, pad);
    padToTeamInput(pad, true, out);
    expect(out.a).toBe('held');
  });

  it('a release goes through padUp, and a button held since before a blur stays up (no phantom shot)', () => {
    const gp = createGamepadPad();
    const pad = createPadState('neutral', 0);
    readGamepad(snapshot([1]), gp);
    routeGamepadToPad(gp, pad);
    padAdvance(pad);
    readGamepad(snapshot([]), gp);
    routeGamepadToPad(gp, pad);
    expect(pad.b).toBe('released');
    readGamepad(snapshot([2]), gp);
    routeGamepadToPad(gp, pad);
    expect(pad.c).toBe('pressed');
    padBlur(pad);                        // the pause, or an alt-tab
    readGamepad(snapshot([2]), gp);
    routeGamepadToPad(gp, pad);          // still held on the pad
    expect(pad.c).toBe('up');
    readGamepad(snapshot([]), gp);
    routeGamepadToPad(gp, pad);          // let go: padUp on a button that is up
    expect(pad.c).toBe('up');            // no edge out of nothing (releaseButton)
  });

  it('L1 / R1 step the strategy towards ATAQUE / DEFENSA, once per press, and stop at the ends', () => {
    const gp = createGamepadPad();
    const pad = createPadState('neutral', 0);
    readGamepad(snapshot([5]), gp);
    routeGamepadStrategy(gp, pad);
    expect(pad.strategy).toBe('defend');
    readGamepad(snapshot([]), gp);
    readGamepad(snapshot([5]), gp);
    routeGamepadStrategy(gp, pad);
    expect(pad.strategy).toBe('defend');   // already at the end
    readGamepad(snapshot([]), gp);
    readGamepad(snapshot([4]), gp);
    routeGamepadStrategy(gp, pad);
    expect(pad.strategy).toBe('neutral');
    readGamepad(snapshot([4]), gp);
    routeGamepadStrategy(gp, pad);         // still held: no second step
    expect(pad.strategy).toBe('neutral');
  });
});
```

2. En `components/games/football-screen/keyboard.test.ts`, añade `overlayPadToTeamInput` al import de `./keyboard` y, al **final** del fichero:

```ts
// ── G15-20: the gamepad's PadState laid over the keyboard's TeamInput. ──
describe('overlayPadToTeamInput: the gamepad over the keyboard (G15-20)', () => {
  it('the keyboard wins a direction it holds; the gamepad fills an axis the keyboard leaves at 0', () => {
    const kb = createPadState('neutral', 0);
    const gp = createPadState('neutral', 0);
    const out = createTeamInput();
    kb.left = true;
    gp.right = true;
    gp.down = true;
    padToTeamInput(kb, true, out);
    overlayPadToTeamInput(gp, true, out);
    expect(out.dx).toBe(-1);
    expect(out.dy).toBe(1);
    expect(checkTeamInput(out, FORMATION_COUNT)).toEqual([]);
  });

  it('each button keeps the stronger state, and from the second step of a frame the gamepad edges settle too', () => {
    const kb = createPadState('neutral', 0);
    const gp = createPadState('neutral', 0);
    const out = createTeamInput();
    padDown(kb, 'b');        // keyboard: B pressed
    padDown(gp, 'b');
    padAdvance(gp);          // gamepad: B held
    padDown(gp, 'a');        // gamepad: A freshly pressed
    padToTeamInput(kb, true, out);
    overlayPadToTeamInput(gp, true, out);
    expect(out.a).toBe('pressed');   // from the gamepad alone
    expect(out.b).toBe('pressed');   // the keyboard's pressed beats the gamepad's held
    padToTeamInput(kb, false, out);
    overlayPadToTeamInput(gp, false, out);
    expect(out.a).toBe('held');      // settled: the gamepad's edge is not fired twice in one frame
    expect(out.b).toBe('held');
    expect(out.c).toBe('up');
  });
});
```

3. En `lib/games-registry.test.ts`, dentro del `describe('games registry', …)`, tras el último `it`, añade:

```ts
  it('vault-world-cup documents both solo key schemes, the Esc pause, the manual switch and the gamepad (V15-2)', () => {
    const rows = GAMES['vault-world-cup'].controls.keyboard;
    const has = (key: string): boolean => rows.some((r) => r.keys.includes(key));
    for (const key of ['Q', 'O', 'P', 'Z', 'X', 'ESC', 'MANDO']) expect(has(key)).toBe(true);
    expect(rows.some((r) => r.action.includes('cambio de jugador'))).toBe(true);
    // G15-6: WASD is only J1's in the two-player friendly now.
    for (const r of rows) if (r.keys.includes('W')) expect(r.action.startsWith('A dos')).toBe(true);
  });
```

- [ ] **Step 2: Verlos fallar**

Ejecuta: `npx vitest run components/games/football-screen/gamepad-input.test.ts components/games/football-screen/keyboard.test.ts lib/games-registry.test.ts`
Esperado: **FALLA** — `gamepad-input.test.ts` con `Failed to resolve import "./gamepad-input"` (fichero nuevo); en `keyboard.test.ts` (fichero existente) los tests que usan `overlayPadToTeamInput` caen (`TypeError: … is not a function` o el valor `undefined`); en `games-registry.test.ts`, el test nuevo (`expected false to be true` en `'Q'`) y la regla de WASD (la fila `['↑', '↓', '←', '→', 'W', 'A', 'S', 'D']` no empieza por «A dos»).

- [ ] **Step 3: `overlayPadToTeamInput` en `keyboard.ts`**

Tras la función `settle` (`keyboard.ts`, justo antes del comentario de `padAdvance`), añade:

```ts
// G15-20: a second PadState -- the gamepad's -- laid over the TeamInput padToTeamInput
// just wrote from the keyboard, so both devices play at once. An axis the keyboard
// leaves at 0 is taken from the gamepad; each button keeps the stronger of the two
// states (pressed > held > released > up), so holding on either device holds. `first`
// means what it means for padToTeamInput: from the second step of a frame on, the
// gamepad's edges are settled too.
const BUTTON_STRENGTH: Readonly<Record<ButtonState, number>> = { up: 0, released: 1, held: 2, pressed: 3 };

function stronger(a: ButtonState, b: ButtonState): ButtonState {
  return BUTTON_STRENGTH[b] > BUTTON_STRENGTH[a] ? b : a;
}

export function overlayPadToTeamInput(pad: PadState, first: boolean, out: TeamInput): void {
  if (out.dx === 0) out.dx = axisOf(pad.left, pad.right);
  if (out.dy === 0) out.dy = axisOf(pad.up, pad.down);
  out.a = stronger(out.a, first ? pad.a : settle(pad.a));
  out.b = stronger(out.b, first ? pad.b : settle(pad.b));
  out.c = stronger(out.c, first ? pad.c : settle(pad.c));
}
```

- [ ] **Step 4: Crear `gamepad-input.ts`**

```ts
import type { GamepadPad } from '../../../lib/gamepad';
import { STRATEGY_BY_KEY, padDown, padUp, type PadKey, type PadState } from './keyboard';

// G15-20 (Paco, 21-sep): from lib/gamepad's controls to this game's pad. "Traduce a las
// mismas entradas que el teclado": the directions are copied and the three buttons go
// through padDown/padUp -- the very calls a keydown/keyup makes -- so the gamepad
// inherits the keyboard's whole state machine (a press survives a frame with no step,
// no auto-repeat, a release only out of a press). Nothing allocates.

// The seven pad keys, in the order the menus read a gamepad's fresh pushes.
export const PAD_KEYS: readonly PadKey[] = ['up', 'down', 'left', 'right', 'a', 'b', 'c'];
const BUTTONS: readonly ('a' | 'b' | 'c')[] = ['a', 'b', 'c'];

export function routeGamepadToPad(gp: GamepadPad, pad: PadState): void {
  pad.up = gp.down.up;
  pad.down = gp.down.down;
  pad.left = gp.down.left;
  pad.right = gp.down.right;
  for (let i = 0; i < BUTTONS.length; i++) {
    const k = BUTTONS[i];
    const edge = gp.edge[k];
    if (edge === 'pressed') padDown(pad, k);
    else if (edge === 'released') padUp(pad, k);
  }
}

// L1 / R1: one step of the strategy towards ATAQUE (L1) or DEFENSA (R1), in the order
// of the 4/5/6 keys, stopping at the ends. It writes the KEYBOARD pad's strategy: the
// one field both devices share, and the one the engine already reads.
export function routeGamepadStrategy(gp: GamepadPad, pad: PadState): void {
  const delta = gp.edge.l1 === 'pressed' ? -1 : gp.edge.r1 === 'pressed' ? 1 : 0;
  if (delta === 0) return;
  const next = STRATEGY_BY_KEY.indexOf(pad.strategy) + delta;
  if (next >= 0 && next < STRATEGY_BY_KEY.length) pad.strategy = STRATEGY_BY_KEY[next];
}
```

(`PadKey` es un subconjunto de `GamepadControl` — las siete primeras palabras coinciden a propósito —, así que `gp.edge[k]` compila sin `as`.)

- [ ] **Step 5: Verlos pasar (los puros)**

Ejecuta: `npx vitest run components/games/football-screen/gamepad-input.test.ts components/games/football-screen/keyboard.test.ts`
Esperado: **PASA** (4 + los de `keyboard` con 2 más). `games-registry.test.ts` sigue en rojo hasta el Step 8.

- [ ] **Step 6: Cablear el componente**

1. Imports: añade `overlayPadToTeamInput` al import de `./football-screen/keyboard`, y:

```ts
import { PAD_KEYS, routeGamepadStrategy, routeGamepadToPad } from './football-screen/gamepad-input';
```

junto a los demás de `./football-screen/*` (orden alfabético, tras `flow-layout`), y al final, junto a `import { sfxVaultWorldCup } from '@/lib/sfx-vault-world-cup';`:

```ts
import { createGamepadPad, type GamepadPad } from '@/lib/gamepad';
import { pollGamepads } from '@/lib/gamepad-navigator';
```

2. Justo después de `const pads: [PadState, PadState] = [createPadState('neutral', 0), createPadState('neutral', 0)];` (`:368`), añade:

```ts
    // G15-20: the two physical pads (mando 1, mando 2), read once per frame by
    // pollGamepadFrame, and one PadState per TEAM they drive through padDown/padUp --
    // the keyboard's own entries; runStep lays them over the keyboard's, which stays
    // live at the same time. All created once (criterion 20).
    const gamepads: readonly [GamepadPad, GamepadPad] = [createGamepadPad(), createGamepadPad()];
    const gamepadPads: [PadState, PadState] = [createPadState('neutral', 0), createPadState('neutral', 0)];
```

3. **Sondeo condicionado (pre-vuelo, H8):** justo debajo, todavía en el cuerpo del efecto de montaje (antes de sus demás declaraciones), añade:

```ts
    // G15-20 (H8 del pre-vuelo): pollGamepadFrame solo llama a pollGamepads -- y por
    // tanto a navigator.getGamepads(), la excepción del criterio 20 -- mientras
    // gamepadSeen sea true. El sondeo inicial detecta un mando ya conectado antes de
    // entrar (Chrome/Firefox no siempre lo exponen hasta la primera pulsación, pero si
    // ya está expuesto esto lo recoge sin esperarla); 'gamepadconnected' lo activa en
    // caliente; 'gamepaddisconnected' solo lo apaga si un nuevo sondeo confirma que no
    // queda ninguno (así un segundo mando que sigue vivo no lo apaga). Quien juega solo
    // con teclado no paga nunca la asignación del array ni las instancias
    // Gamepad/GamepadButton que Chrome crea por mando en cada llamada.
    let gamepadSeen = pollGamepads(gamepads) > 0;
    function handleGamepadConnected(): void {
      gamepadSeen = true;
    }
    function handleGamepadDisconnected(): void {
      gamepadSeen = pollGamepads(gamepads) > 0;
    }
    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
```

Y en el `return () => { … }` de ese mismo efecto (el que ya quita `keydown`/`blur` y cancela el `requestAnimationFrame` de `loop` -- busca por ese texto, no por línea), añade `window.removeEventListener('gamepadconnected', handleGamepadConnected);` y `window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);`.

4. `startMatch` (`:518-522`): dentro del `for (let t = 0; t < 2; t++) {`, tras `padBlur(pads[t]);`, añade `padBlur(gamepadPads[t]);`.

5. `runStep` (`:719-720`): sustituye

```ts
      if (run.human[0]) padToTeamInput(pads[0], first, run.inputs[0]);
      if (run.human[1]) padToTeamInput(pads[1], first, run.inputs[1]);
```

por

```ts
      if (run.human[0]) {
        padToTeamInput(pads[0], first, run.inputs[0]);
        overlayPadToTeamInput(gamepadPads[0], first, run.inputs[0]);
      }
      if (run.human[1]) {
        padToTeamInput(pads[1], first, run.inputs[1]);
        overlayPadToTeamInput(gamepadPads[1], first, run.inputs[1]);
      }
```

6. `update` (`:869-872`): dentro de `if (plan.advancePad) {`, tras `padAdvance(pads[1]);`, añade `padAdvance(gamepadPads[0]);` y `padAdvance(gamepadPads[1]);` (las pulsaciones de mando se consumen por **paso**, igual que las de teclado: H3).

7. `handleKeyDown`: sustituye el bloque entero `if (!sfxReady) { … }` (con su comentario «QA fix (2026-09-11)») por la llamada `ensureSfx();`, y declara, justo **antes** de `function handleKeyDown`:

```ts
    // QA fix (2026-09-11): the lazy audio setup used to run unguarded before the menu
    // dispatch. A throw here (autoplay policy, a bad SFX_VOLUME entry after a future
    // edit) would abort the CURRENT key -- including a first-ever confirm on ELIGE MODO
    // -- while sfxReady is already latched true, so every later key silently skips this
    // block and looks fine. sfx is best-effort; it must never eat the input that
    // triggered it. G15-20: the gamepad's first menu press calls it too.
    function ensureSfx(): void {
      if (sfxReady) return;
      sfxReady = true;
      try {
        sfxVaultWorldCup.init();
        sfxVaultWorldCup.setMuted(mutedRef.current);
      } catch {
        // no-op: the menu/match dispatch still has to run this frame.
      }
    }
```

8. Justo **después** de `function menuAction(k: PadKey): boolean { … }`, añade:

```ts
    // G15-20, once per frame before update(). Start pauses (and un-pauses) on any
    // screen. While paused or blocked nothing else is read and the gamepad pads are
    // lifted with no edge, every frame: a button held through the pause must not fire
    // on resume (padClear's rule). In a match each pad drives its team; on the menus a
    // fresh push or press is one menuAction -- the keyboard's own path. pollGamepads
    // itself only runs while gamepadSeen (H8 del pre-vuelo, ver más arriba): otherwise
    // gamepads[] just keeps reading as disconnected, so everything below is a no-op.
    function pollGamepadFrame(): void {
      if (gamepadSeen) pollGamepads(gamepads);
      if (gamepads[0].edge.start === 'pressed' || gamepads[1].edge.start === 'pressed') requestPause();
      if (pausedRef.current || blocked) {
        padBlur(gamepadPads[0]);
        padBlur(gamepadPads[1]);
        return;
      }
      if (flow.phase === 'match') {
        routeMatchGamepad(0);
        routeMatchGamepad(1);
        return;
      }
      routeMenuGamepad(0);
      routeMenuGamepad(1);
    }

    // Mando 1 = J1 (team 0) and mando 2 = J2 (team 1) in the two-player friendly; alone,
    // mando 1 plays the human's side and mando 2 is ignored (G15-20). A pad that is gone
    // lifts its team's gamepad pad with no edge.
    function routeMatchGamepad(slot: 0 | 1): void {
      const side = humanSide;
      let team: 0 | 1;
      if (side === 'both') team = slot;
      else if (side === 'none' || slot === 1) return;
      else team = side;
      const gp = gamepads[slot];
      if (!gp.connected) {
        padBlur(gamepadPads[team]);
        return;
      }
      routeGamepadToPad(gp, gamepadPads[team]);
      routeGamepadStrategy(gp, pads[team]);
    }

    // On the two-player team selector each pad picks for its own player (mando 1 = J1);
    // every other menu takes either pad.
    function routeMenuGamepad(slot: 0 | 1): void {
      const gp = gamepads[slot];
      if (!gp.connected) return;
      if (flow.phase === 'team-select' && flowHumanCount(flow) === 2 && flowPickingHuman(flow) !== slot) return;
      for (let i = 0; i < PAD_KEYS.length; i++) {
        const k = PAD_KEYS[i];
        if (gp.edge[k] !== 'pressed') continue;
        ensureSfx();
        menuAction(k);
      }
    }
```

9. `loop` (`:1600`): justo antes de `update(frameMs);`, añade `pollGamepadFrame();` y amplía el comentario de encima con una línea: «G15-20: the gamepads are polled first, so this frame's update sees their input.»

10. `handleBlur` (`:1758`): tras `padBlur(pads[1]);`, añade `padBlur(gamepadPads[0]);` y `padBlur(gamepadPads[1]);`.

- [ ] **Step 7: El catálogo**

En `lib/games-registry.ts`, entrada `'vault-world-cup'`, sustituye el array `keyboard: [ … ]` entero por:

```ts
      keyboard: [
        { keys: ['↑', '↓', '←', '→'], action: 'Teclado FLECHAS (por defecto): mover / apuntar los saques (solo, entrenamiento y Mundial)' },
        { keys: ['Q', 'A', 'O', 'P'], action: 'Teclado CLÁSICO: arriba / abajo / izquierda / derecha (se elige con IZQ/DER en ELIGE MODO y se recuerda)' },
        { keys: ['Z', 'X', 'C'], action: 'Teclado CLÁSICO: A chut · B pase · C sprint / cambio de jugador' },
        { keys: ['1', '2', '3'], action: 'Alineación: 3-3-2 / 3-2-3 / 4-3-1' },
        { keys: ['4', '5', '6'], action: 'Estrategia: ataque / neutral / defensa' },
        { keys: ['ESC'], action: 'Pausa (con FLECHAS y a dos también la P; con CLÁSICO la P es «derecha»)' },
        { keys: ['R'], action: 'Salir del entrenamiento / reiniciar tras el Mundial' },
        { keys: ['MANDO'], action: 'Mando USB/Bluetooth: stick o cruceta mueve · A/✕ chut · B/○ pase · X/□ sprint / cambio de jugador · L1/R1 estrategia · Start pausa. A dos: mando 1 = J1, mando 2 = J2' },
        { keys: ['W', 'A', 'S', 'D'], action: 'A dos · J1: mover' },
        { keys: ['C', 'V', 'B'], action: 'A dos · J1: A chut · B pase · C sprint / cambio de jugador' },
        { keys: ['1', '2', '3', '4', '5', '6'], action: 'A dos · J1: alineación (1-3) y estrategia (4-6)' },
        { keys: ['↑', '↓', '←', '→'], action: 'A dos · J2: mover' },
        { keys: ['J', 'K', 'L'], action: 'A dos · J2: A chut · B pase · C sprint / cambio de jugador' },
        { keys: ['7', '8', '9'], action: 'A dos · J2: alineación' },
        { keys: ['0', '\'', '¡'], action: 'A dos · J2: estrategia' },
        { keys: ['J'], action: 'A: chut o entrada al suelo (mantener = más fuerte) · teclado FLECHAS', special: true },
        { keys: ['K'], action: 'B: pase corto o robo de pie (mantener = pase largo) · teclado FLECHAS', special: true },
        { keys: ['L'], action: 'C: sprint en ráfaga; sin balón, pulsar = cambio de jugador (mantener = sprint) · teclado FLECHAS', special: true },
      ],
```

y en `instructions.tips` sustituye las entradas que empiezan por `'C sprinta en ráfaga…'` y `'P pausa el partido…'` por:

```ts
        'C sprinta en ráfaga con recuperación; defendiendo (balón rival o suelto), púlsala para pasar el control al siguiente compañero más cercano al balón (repite para rotar entre los tres más cercanos) y mantenla para esprintar',
        'Esc pausa siempre (y la P con el teclado FLECHAS y a dos) · R sale del ENTRENAMIENTO y reinicia tras el Mundial; el juego solo se juega en escritorio, con ventana suficiente',
        'Elige teclado en ELIGE MODO con IZQ/DER: FLECHAS (flechas + J/K/L) o CLÁSICO (Q/A/O/P + Z/X/C); también se juega con mando USB o Bluetooth, a la vez que el teclado',
```

(El resto de `tips`, `goal` incluido, se queda: los textos de «ocho de dieciséis» los cambia V15-3.)

- [ ] **Step 8: Verlos pasar todos**

Ejecuta: `npx vitest run components/games/football-screen/gamepad-input.test.ts components/games/football-screen/keyboard.test.ts lib/games-registry.test.ts`
Esperado: **PASA** entero.

- [ ] **Step 9: Romperlo a propósito (control negativo)**

1. En `routeGamepadToPad`, cambia temporalmente `if (edge === 'pressed') padDown(pad, k);` por `if (edge === 'pressed' || edge === 'held') padDown(pad, k);`. Esperado: **falla** «a release goes through padUp, and a button held since before a blur stays up» (`'pressed'` en vez de `'up'` tras el `padBlur`: el botón mantenido dispararía al volver de la pausa). **Deshaz.**
2. En `overlayPadToTeamInput`, cambia temporalmente `first ? pad.a : settle(pad.a)` por `pad.a` (y lo mismo en `b`). Esperado: **falla** «each button keeps the stronger state…» (`expected 'pressed' to be 'held'` en el segundo paso del frame). **Deshaz.**
3. En `routeGamepadStrategy`, cambia temporalmente `gp.edge.l1 === 'pressed'` por `gp.edge.l1 !== 'up'`. Esperado: **falla** «L1 / R1 step the strategy…» (un L1 mantenido da un segundo paso: `'attack'`). **Deshaz** y vuelve a verlo verde.

- [ ] **Step 10: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/gamepad-input.ts components/games/football-screen/gamepad-input.test.ts components/games/football-screen/keyboard.ts components/games/football-screen/keyboard.test.ts components/games/VaultWorldCupGame.tsx lib/games-registry.ts lib/games-registry.test.ts
git diff --name-only b130c06 -- components/games/football-logic/ | sort
grep -rn "getGamepads" app components lib
grep -n "pollGamepadFrame()\|overlayPadToTeamInput(\|padAdvance(gamepadPads\|padBlur(gamepadPads" components/games/VaultWorldCupGame.tsx
grep -n "gamepadSeen\|gamepadconnected\|gamepaddisconnected" components/games/VaultWorldCupGame.tsx
grep -rn "Math.random\|document\.\|window\.\|navigator\.\| as " components/games/football-screen/gamepad-input.ts components/games/football-screen/gamepad-input.test.ts
```
Esperado:
- delta **+7 tests / +1 fichero** → **1335 / 80** verdes; `tsc` y `eslint` sin salida; motor, los cuatro de siempre.
- `getGamepads`: **solo** `lib/gamepad-navigator.ts`.
- El tercer `grep`: `pollGamepadFrame()` 2 líneas (la declaración y la llamada en `loop`); `overlayPadToTeamInput(` 2 (en `runStep`); `padAdvance(gamepadPads` 2 (en `update`); `padBlur(gamepadPads` **6** líneas (1 en el bucle de `startMatch`, 2 en la rama de pausa de `pollGamepadFrame`, 1 en `routeMatchGamepad`, 2 en `handleBlur`).
- `gamepadSeen`: **3** líneas (la declaración con el sondeo inicial, dentro de `handleGamepadConnected` y dentro de `handleGamepadDisconnected`) más el uso en el `if` de `pollGamepadFrame` → **4** en total; `gamepadconnected`/`gamepaddisconnected`: cada uno **2** líneas (`addEventListener` y `removeEventListener` en el cleanup).
- El último `grep` **vacío**.
- Revisión a ojo (criterio 20): `pollGamepadFrame`, `routeMatchGamepad` y `routeMenuGamepad` no construyen ni objetos, ni arrays, ni strings, ni cierres; la única asignación por frame es el array (y sus instantáneas `Gamepad`/`GamepadButton`) de `navigator.getGamepads()` dentro de `pollGamepads`, y solo mientras `gamepadSeen` sea `true` (excepción anotada, acotada por H8 del pre-vuelo).

- [ ] **Step 11: Anotar en el ledger**

`V15-2-7 hecha: mando en el juego (gamepad-input.ts: botones por padDown/padUp, direcciones copiadas, L1/R1 estrategia; overlayPadToTeamInput funde mando y teclado por equipo; pollGamepadFrame antes de update: Start pausa, menús por menuAction, mando 1 = J1 / mando 2 = J2, solitario = mando 1; ensureSfx) + sondeo condicionado por gamepadSeen (sondeo inicial + gamepadconnected/gamepaddisconnected, H8 del pre-vuelo) + catálogo reescrito (Flechas, Clásico, Esc, cambio con C, mando). +7 tests / +1 fichero (1335/80). Working tree verificado; commit lo hace Paco.`

- [ ] **Step 12: Dejar el working tree verificado; commit lo hace Paco**

---

### Task V15-2-8 (cierre): verificación del paso, lista de QA de Paco y mensaje de commit

**Files:**
- Modify: `.superpowers/sdd/2026-09-22-vault-world-cup-v15-2/progress.md`
- Create: `.superpowers/sdd/2026-09-22-vault-world-cup-v15-2/qa-paco.md`
- Ningún fichero de código se toca en esta tarea. Si al verificar aparece un fallo, **se arregla en la tarea que lo introdujo**, no aquí.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la lista con la que Paco hace el QA jugado (G15-15: «QA jugado al final de cada uno») y el mensaje de commit del paso.

- [ ] **Step 1: Verificación completa del paso**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-logic/actions.ts components/games/football-logic/actions.test.ts components/games/football-logic/match.ts components/games/football-logic/match.test.ts components/games/football-screen/ components/games/VaultWorldCupGame.tsx app/games/vault-world-cup/play/page.tsx lib/gamepad.ts lib/gamepad.test.ts lib/gamepad-navigator.ts lib/games-registry.ts lib/games-registry.test.ts
```
Esperado: **1335 tests en 80 ficheros verdes** (1291 + 5 + 9 + 6 + 9 + 0 + 8 + 7; 77 + 3), `tsc` sin salida, `eslint` con **solo los 3 errores preexistentes** de `page.tsx` (Global Constraints).

- [ ] **Step 2: Las compuertas de las Global Constraints**

```bash
git diff --name-only b130c06 -- components/games/football-logic/ | sort
git diff --stat b130c06 -- components/games/football-logic/ai.ts components/games/football-logic/ai.test.ts components/games/football-logic/step.ts components/games/football-logic/players.ts components/games/football-logic/input.ts components/games/football-logic/set-pieces.ts
grep -rn "Math.random" components/games/football-logic/ components/games/football-screen/ lib/gamepad.ts lib/gamepad-navigator.ts
grep -rn "getGamepads" app components lib
grep -rnE "\b(navigator|window|document|localStorage)\.[a-zA-Z]+\(" components/games/football-screen/ lib/gamepad.ts
grep -rn "@/" components/games/football-screen/control-hints.ts components/games/football-screen/gamepad-input.ts lib/gamepad.ts
git diff b130c06 -- '*.ts' '*.tsx' | grep "^+" | grep -v "^+++" | grep -n " as \|!\.\|: any"
find .superpowers -name "*.ts" -o -name "*.tsx"
```
Esperado: el primero, **exactamente** `actions.test.ts`, `actions.ts`, `match.test.ts`, `match.ts`; el `--stat` **vacío** (sin regrabado: `ai.test.ts` intacto); `Math.random` **vacío**; `getGamepads` **solo** en `lib/gamepad-navigator.ts`; el de `navigator|window|document|localStorage` (llamadas reales — `camera.ts:76` «…nothing is drawn off the window.» y `lib/gamepad.ts:8` «…(that is gamepad-navigator.ts)…» son comentarios y ya no casan con esta versión acotada) **vacío**; `@/` **vacío**; el `git diff` acotado a `*.ts`/`*.tsx` (el plan mismo, en el índice, queda fuera: no lo mide el código) con las líneas añadidas con `as`/`!.`/`any` **vacío**; `find` **vacío**.

- [ ] **Step 3: Repasar el diff entero con ojos de revisor**

```bash
git status --short
git diff --stat b130c06
git diff b130c06 -- components/games/VaultWorldCupGame.tsx app/games/vault-world-cup/play/page.tsx
```
Comprueba, una por una:
1. `git status` muestra: nuevos `control-hints.ts/.test.ts`, `gamepad-input.ts/.test.ts`, `lib/gamepad.ts/.test.ts`, `lib/gamepad-navigator.ts` y el ledger; modificados los cuatro del motor, `keyboard.ts/.test.ts`, `flow.ts/.test.ts`, `flow-layout.ts/.test.ts`, `VaultWorldCupGame.tsx`, `page.tsx`, `games-registry.ts/.test.ts` y el spec; también `tasks/vault-world-cup/HANDOFF-next-session.md` (ya modificado antes de este paso, por docs) y el plan mismo, que sale **en el índice** (`A`/`AM`), no sin trackear. Nada más.
2. En `draw()` y sus `draw*`, `update`, `runStep`, `loop`, `pollGamepadFrame`, `routeMatchGamepad`, `routeMenuGamepad`: ni `new`, ni literales de objeto/array, ni plantillas/concatenaciones de string, ni `.map(`/`.filter(`, ni `=>` nuevos.
3. `isPauseKey` se comprueba en `handleKeyDown` **antes** de `if (pausedRef.current || blocked) return;`.
4. La página ya no tiene la rama de la P y pasa `onPauseToggle={togglePause}`.
5. El modo a dos sigue con `TWO_PLAYER_TABLES` en `startMatch` y en `tableForPicker` (G9-2), y su selección no se ve afectada por el esquema guardado.
6. `menuAction` es el único sitio que decide qué hace una tecla de pad en un menú (teclado y mando pasan por él).

- [ ] **Step 4: Escribir la lista de QA de Paco**

Crea `.superpowers/sdd/2026-09-22-vault-world-cup-v15-2/qa-paco.md` con exactamente esto:

```markdown
# QA jugado — V15-2 «Mandos» (v1.5)

Catorce puntos. Teclado primero (1-6), luego el cambio con L (7-9), luego mandos (10-14).
Ten a mano un mando USB, uno Bluetooth y, para el 13, un segundo mando.

1. **Flechas por defecto.** En una ventana privada, ELIGE MODO muestra `TECLADO: < FLECHAS >`.
   En AMISTOSO, ENTRENAMIENTO y MUNDIAL mueves con las flechas y J/K/L; **WASD ya no mueve**
   en solitario (G15-6). P y Esc pausan y reanudan.
2. **Cambiar a Clásico.** En ELIGE MODO, IZQ/DER cambia la fila a CLÁSICO; la pista de abajo
   pasa a «A (Z) CONFIRMA». Recarga la página: sigue en CLÁSICO. En la ventana privada, al
   recargar vuelve a FLECHAS sin ningún error en consola.
3. **Clásico jugando.** Q/A/O/P mueven, Z chuta, X pasa, C esprinta/cambia. **La P mueve a la
   derecha y NO pausa; Esc pausa y reanuda.** En el cuadro del Mundial O/P eligen VER/SALTAR.
   Los textos dicen Z/X (saque del portero «SAQUE: X CORTO · Z LARGO», sorteo, cuadro,
   cruce de la CPU, victoria).
4. **La fila en AMISTOSO A DOS** sale atenuada con la nota del reparto fijo; el partido a dos
   sigue igual que siempre (J1 WASD + C/V/B, J2 flechas + J/K/L) **aunque tengas CLÁSICO
   guardado**, y ahí la P sí pausa.
5. **¿La fila se entiende?** Se cambia con IZQ/DER desde cualquier tarjeta (resuelto 22-sep:
   se queda así, no como tarjeta seleccionable con ARRIBA/ABAJO); confirma que se entiende bien
   en la práctica.
6. **El botón PAUSA/REANUDAR** de la página y el cambio de música de la pausa siguen igual.
7. **Cambio con L defendiendo** (balón del rival y balón suelto): pasa al siguiente más
   cercano; pulsaciones seguidas rotan entre los **tres** más cercanos y vuelven al primero
   (resuelto 22-sep: el tres vale). Confirma la sensación: ¿el bloqueo de ~0,6 s evita que
   vuelva solo al de antes sin sentirse pegajoso?
8. **Pulsar no esprinta, mantener sí.** Un toque de L cambia y no gasta el sprint (la barra no
   se vacía ni entra en recuperación); mantener L más de ~0,25 s tras el cambio esprinta
   (resuelto 22-sep: el umbral vale). Confirma la sensación, y mira también el dibujo
   defensivo: con el cambio, el más cercano sigue presionando y el equipo persigue con uno
   más un momento.
9. **Dónde NO cambia:** con el balón tuyo o de tu portero, en saques (inicio, banda, falta,
   penalti) y en la tanda. **En ENTRENAMIENTO sí cambia; a dos, J1 cambia con B y J2 con L.**
10. **Mando USB, en `localhost`** (la Gamepad API exige contexto seguro; por `http://` a la IP
    de la red del dev server no hay mandos — ver Global Constraints). Conéctalo y pulsa un
    botón (Chrome no lo muestra hasta entonces). Menús: cruceta y stick mueven el cursor (una
    vez por empujón), A/✕ confirma, IZQ/DER cambia el teclado en ELIGE MODO. Partido: stick o
    cruceta mueve, A/✕ chut (mantener = más fuerte), B/○ pase, X/□ sprint/cambio, L1/R1
    estrategia (mira la etiqueta ATAQUE/NEUTRAL/DEFENSA del HUD), Start pausa y reanuda. El
    teclado sigue funcionando a la vez.
11. **Mando Bluetooth, también en `localhost`.** Lo mismo. Si algún botón sale cambiado de
    sitio, apunta el modelo: se leen todos con el mapeo estándar (resuelto 22-sep). ¿Suena el
    juego si entras **solo** con el mando, sin tocar el teclado?
12. **Desconectar en pleno partido** (cable o apagar el mando): el jugador se para, no sale un
    chut ni un sprint fantasma. Mantén A/✕ pulsado, pausa con Start, suelta, reanuda: no chuta.
13. **Dos mandos a dos:** mando 1 elige y juega J1, mando 2 elige y juega J2. Con un solo
    mando, J2 juega con teclado. En solitario con dos mandos solo juega el mando 1 (resuelto
    22-sep).
14. **Rendimiento:** un VER x4 de un cruce de la CPU con el mando conectado va fluido
    (`getGamepads` se llama cada frame mientras haya algún mando visto: la excepción anotada
    del criterio 20 — ver H8). Sin ningún mando conectado en toda la sesión, comprueba también
    que va igual de fluido con solo teclado.
```

- [ ] **Step 5: Cerrar el ledger**

Añade a `.superpowers/sdd/2026-09-22-vault-world-cup-v15-2/progress.md`:

```
V15-2 COMPLETO en código: 1335 tests / 80 ficheros verdes, tsc limpio, eslint sin errores nuevos (solo los 3 preexistentes de page.tsx). Motor tocado SOLO en actions.ts/match.ts (+tests) para G15-5, sin regrabado (ai.test.ts y grabaciones intactas; el control negativo 4 lo vigila). G15-5 (cambio con C, bloqueo 0,6 s, pulsar no esprinta), G15-6 (Flechas/Clásico, Esc, localStorage, fila en ELIGE MODO) y G15-20 (lib/gamepad + mando en el juego, menús, Start, dos mandos) implementados; spec anotado. Lista de QA en qa-paco.md. Pendiente: commit de Paco + QA jugado.
```

Y debajo, estos cuatro encabezados:

`## Resueltas por Paco (22-sep, antes del pre-vuelo)` — las 7 dudas del plan, ya cerradas por Paco (no se reabren en el QA; el QA solo confirma la sensación):
1. **Rotación del cambio:** entre los **3** más cercanos (`MANUAL_SWITCH_POOL`), sin contar a los tumbados. G15-5 dice «entre los más cercanos» sin número.
2. **Pulsar vs. mantener:** el sprint tras un cambio espera **0,25 s** de C mantenida (`MANUAL_SWITCH_SPRINT_HOLD_STEPS`, el umbral del pase largo). Sin umbral, un toque real (varios pasos) arrancaría el sprint y, al soltar, sus 3 s de recuperación.
3. **La fila del teclado:** se cambia con IZQ/DER desde cualquier tarjeta de ELIGE MODO, no es una fila «seleccionable» con el cursor.
4. **Mando — estrategia y lo que no tiene botón:** L1 = un paso hacia ATAQUE, R1 = hacia DEFENSA. La **formación** (1/2/3) y **salir del ENTRENAMIENTO** (R) no tienen botón de mando (G15-20 no les asigna ninguno); las pistas en pantalla solo nombran teclas.
5. **Mando — casos límite:** en solitario solo juega el mando 1; un mando que no declara `mapping: 'standard'` se lee con los índices estándar; si el mando 1 se desconecta, el 2 pasa a ser el 1.
6. **«Disjuntos»:** los pads de Flechas y Clásico no comparten ninguna tecla, pero sí las filas numéricas 1-6 (las de J1 de siempre).
7. **Comentario de `positionTeam`:** el cambio manual lo vuelve inexacto; se corrige en V15-4 (que ya regraba) — ver `## Peticiones separadas al motor`.

`## Dudas abiertas para Paco` — ninguna.

`## Peticiones separadas al motor` — 1. En V15-4 (que ya regraba): actualizar el comentario de `positionTeam` en `ai.ts` («rank 0 is the controlled and never gets here»), que el cambio manual vuelve inexacto (resuelto por Paco 22-sep, punto 7 de arriba); decidir allí si el controlado manual debe contar como perseguidor.

`## Hallazgos de la ejecución` — lo que salga (p. ej. un control negativo que no falle como dice el plan). Si no hay ninguno: `ninguno.`

- [ ] **Step 6: Proponer el commit del paso — NO ejecutes `git add` ni `git commit`**

Mensaje único para Paco:

```
feat(world-cup): v1.5 controls — manual switch on C, Flechas/Clásico key schemes with Esc pause, physical gamepad (V15-2, G15-5/G15-6/G15-20)
```

Recuérdale que el commit incluye **ficheros nuevos** (`lib/gamepad.ts`, `lib/gamepad.test.ts`, `lib/gamepad-navigator.ts`, `football-screen/control-hints.ts/.test.ts`, `football-screen/gamepad-input.ts/.test.ts`) que hay que añadir explícitamente, y que el plan (`docs/superpowers/plans/2026-09-22-vault-world-cup-v15-2-controls.md`) está **en el índice** (sin commitear) y el ledger **sin trackear**: es suyo decidir si entran en el mismo commit.

---

## Self-review (ejecutada al escribir el plan, 22-sep)

**1. Cobertura del spec.**
- **G15-5** — «L con el rival en posesión o balón suelto (no con tu portero ni en saques)» → `applyManualSwitch` (`ownSideHasBall`, solo desde `stepOpenPlay`) + tests 1-4 de V15-2-2; «siguiente más cercano, excluye el actual; pulsaciones repetidas rotan» → `nextManualControl` (V15-2-1, 5 tests) + test 1 de V15-2-2; «pulsar = solo cambio, sin sprint; mantener sí esprinta; CPU intacta» → `muteSwitchSprint`/`physicsInputsFor` + test 6, y la CPU por construcción + test 9 + control negativo 4; «bloqueo ~0,6 s» → `MANUAL_SWITCH_LOCK_STEPS = 36` + test 5; «aplica en entrenamiento y a dos (J1 = B)» → test 2 (`TRAINING_RULES`) y, a dos, la tabla de J1 ya manda su C en la `b` (G9-2, sin código nuevo; QA punto 9); «no en la tanda» → test 4; «anotar en spec» → Step 6 de V15-2-2; «estado nuevo reseteado en saques/descanso/gol/tanda» → `clearManualSwitch` + tests 4 y 7. «Sin regrabado» → gate de `ai.test.ts` intacto en cada tarea + control negativo 4.
- **G15-6** — dos esquemas → `ARROWS_SOLO`/`CLASSIC_SOLO` (V15-2-3); WASD fuera del solitario → retirada de `SOLO` + test reescrito; «disjuntos» → test de pads; Esc siempre y P ignorada con Clásico → `isPauseKey` (V15-2-3) + cableado antes de la guarda de pausa (V15-2-5); fila en ELIGE MODO → `flowToggleKeyScheme` + `MODE_SCHEME_*` (V15-2-4) + `drawModeSelect` (V15-2-5); localStorage con try/catch → `loadKeyScheme`/`saveKeyScheme` (V15-2-3) + cierres al montar (V15-2-5); modo a dos no elegible → `TWO_PLAYER_TABLES` intactas + fila atenuada; menús por la tabla activa → `menuTable`/`menuAction`; textos precalculados por esquema → `control-hints.ts` (V15-2-4); default Flechas → `DEFAULT_KEY_SCHEME` + test.
- **G15-20** — Gamepad API y `lib/gamepad` común → `lib/gamepad.ts` + `lib/gamepad-navigator.ts` (V15-2-6); «traduce a las mismas entradas que el teclado» → `routeGamepadToPad` sobre `padDown`/`padUp` (V15-2-7); mapeo estándar → `STANDARD_BUTTON` + test; teclado a la vez → `overlayPadToTeamInput`; a dos mando 1/2 = J1/J2 y J2 teclado con un solo mando → `routeMatchGamepad`; menús con mando → `routeMenuGamepad` → `menuAction`; Start = pausa → `requestPause`; excepción del criterio 20 → aislada y comentada en `pollGamepads`, y acotada por `gamepadSeen` a mientras haya algún mando visto (`pollGamepadFrame`, pre-vuelo H8); lógica pura sin navegador (instantánea → estado, zona muerta, flancos) → 8 tests en Node.
- **Criterios 1, 2, 4, 20, 21** → test de replay con pulsaciones (V15-2-2), motor sin DOM ni `Math.random` (gates), portero nunca controlado (`isControllable` + test), revisiones de asignaciones por frame (V15-2-5/7/8), 1291 medidos → 1335 objetivo. **Criterio 5** matizado y anotado.
- Fuera de alcance respetado (V15-3/4/5, `ai.ts`, otros juegos). **Sin huecos.**

**2. Placeholders.** Ningún «TBD»/«similar a la Task N»; todo test y todo cambio lleva su código. Validación al escribir el plan: los bloques de código de las siete tareas se aplicaron tal cual a una copia del repo en el scratchpad (nunca al repo): **1335 tests / 80 ficheros verdes**, `tsc --noEmit` limpio y `eslint` sin errores nuevos. Los controles negativos del motor (V15-2-2, los cuatro) y dos de V15-2-7 se ejecutaron allí; sus fallos esperados están escritos con lo medido. De esa pasada salieron tres correcciones ya incorporadas: los `grep` de las compuertas ignoran comentarios y cadenas de UI (`'SALE SOLO'`, «the window»), el recuento de `localStorage` es 3 líneas (comentario + 2 cierres) y `page.tsx` arrastra 3 errores de ESLint preexistentes.

**3. Consistencia de nombres.** `MANUAL_SWITCH_POOL/LOCK_STEPS/SPRINT_HOLD_STEPS`, `nextManualControl` y `updateTeamControl` se declaran en V15-2-1 y se consumen con esos nombres en V15-2-2. `manualSwitch.lockSteps/sprintHoldSteps` coinciden entre `match.ts`, `sameMatch` y los tests. `KeyScheme`, `ARROWS_SOLO`, `CLASSIC_SOLO`, `SOLO_TABLES_BY_SCHEME`, `isPauseKey`, `loadKeyScheme`, `saveKeyScheme`, `KEY_SCHEME_STORAGE_KEY` (V15-2-3) son los que usan V15-2-4/5. `flowToggleKeyScheme`, `flowSetKeyScheme`, `MODE_SCHEME_ROW_Y`, `MODE_SCHEME_DETAIL_Y`, `MODE_HINT_Y`, `CONTROL_HINTS` (campos `schemeRow`, `schemeDetail`, `mode`, `teamSolo`, `draw`, `bracketChoice`, `bracketPlay`, `spectate`, `victory`), `keeperHintFor`, `TWO_PLAYER_SCHEME_NOTE` (V15-2-4) son los de V15-2-5. `menuAction`/`requestPause` (V15-2-5) los usa V15-2-7. `GamepadPad.down/edge`, `createGamepadPad`, `pollGamepads`, `readGamepad`, `GamepadLike` (V15-2-6) son los de V15-2-7; `PadKey` ⊂ `GamepadControl` por diseño (mismas siete palabras), así que `gp.edge[k]` compila sin `as`.

**Riesgos que el plan NO cierra y que solo cierra el QA de Paco:** la sensación del cambio (pool, bloqueo, umbral del sprint) — ya **resuelta** por Paco 22-sep, el QA solo la confirma —, el dibujo defensivo con un perseguidor de más, la legibilidad de la fila del teclado, el comportamiento real de mandos concretos (mapeo, Bluetooth, gesto de usuario para el audio) y el coste de `getGamepads` por frame. Todos en `qa-paco.md`.

## Resoluciones de Paco (22-sep, antes del pre-vuelo)

Las 7 dudas se cierran con el valor provisional del plan: (1) L rota entre los 3 compañeros más cercanos de pie; (2) sprint tras un cambio
solo si C se mantiene 0,25 s; (3) el teclado se cambia con IZQ/DER desde cualquier tarjeta de ELIGE MODO; (4) L1 → ATAQUE, R1 → DEFENSA,
formación y R sin botón de mando; (5) en solitario juega el mando 1, los mandos sin mapeo estándar se leen como estándar, si cae el 1 el 2
pasa a ser el 1; (6) los dos teclados solo comparten la fila 1-6; (7) el comentario de `positionTeam` en `ai.ts` se corrige en V15-4.
→ En la tarea de cierre se registran como «resueltas por Paco 22-sep», no como dudas abiertas.
