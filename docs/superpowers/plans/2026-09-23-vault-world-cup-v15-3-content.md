# Vault World Cup — v1.5, paso V15-3 «Contenido» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llenar de contenido VAULT WORLD CUP: (G15-9) veinte selecciones en una rejilla 5×4 con un minicampo de la formación elegida; (G15-7 + G15-8) un Mundial de **dieciséis** con una ronda nueva de OCTAVOS, su puntuación y una pantalla de cuadro de 8 cruces en dos columnas con «SALTAR TODOS»; (G15-17, con la adenda de Paco del 23-sep) una **plantilla de 18** por selección (2 porteros + 6 defensas + 6 medios + 4 delanteros) con nombres inventados y dorsales fijos 1-18, y una pantalla **ALINEACIÓN** para cambiar titulares por reservas y editar nombres, guardada en `localStorage` por selección. **Del motor se tocan SOLO datos (`teams.ts`, el fichero nuevo `squads.ts`) y `world-cup.ts`**; no se regraba ningún partido.

**Architecture:** Tres bloques independientes que se ejecutan en serie. (1) *Datos*: cuatro `TeamDef` nuevos al final de `TEAMS` (los índices 0-15 no se mueven, así que ningún test de kits, sprites ni sorteo cambia de sitio) y un fichero de datos nuevo `football-logic/squads.ts` con las veinte plantillas de dieciocho, su red de invariantes propia y **ninguna importación desde el motor vivo** — el motor no lee `squads.ts` en este paso. (2) *Mundial de 16*: `world-cup.ts` gana una ronda `'round-16'` al principio de la tabla de rondas; todo lo demás ya estaba parametrizado por `WORLD_CUP_SIZE` y por los `Record<WorldCupRound, …>`, así que el cambio es de tablas, no de ramas. (3) *Alineación*: el modelo vive en un módulo puro nuevo `football-screen/lineup.ts` que **deriva los titulares del `TEAM_SIZE` vigente** (hoy 9 = 8 de campo + portero; en V15-4, 11) en vez de fijar once a fuego, y una fase `'lineup'` nueva en `flow.ts`. El `.tsx` solo pregunta y dibuja, como siempre.

**Tech Stack:** TypeScript estricto, React 19.2.4, Next 16.2.6 (App Router), canvas 2D 800 × 500, vitest 4.1.11 (tests `*.test.ts` junto al código, **sin `vitest.config`**, entorno Node sin DOM, **imports relativos** — el alias `@/` no existe en vitest).

**Spec:** `specs/31-vault-world-cup.md` (Approved) — bullet «Grill de la v1.5 (Paco, 2026-09-17), decisiones G15» (**G15-7**, **G15-8**, **G15-9**, **G15-11**, **G15-15**) y bullet «Ampliación tras el QA de V15-1 (Paco, 2026-09-21)» (**G15-16**, **G15-17**, **G15-22**); bullet «Selecciones de la v1.5 (Paco, 2026-09-07)» en «Decisiones tomadas»; criterios de aceptación **1, 2, 4, 5, 20 y 21**. Las decisiones G15 son ley y no se reabren en este plan.
**Plan hermano (modelo de formato, profundidad y convenciones):** `docs/superpowers/plans/2026-09-22-vault-world-cup-v15-2-controls.md` (paso anterior, ya implementado en `ef61be7`).
**Código a imitar:** `components/games/football-logic/invariants.ts` (`checkTeam`/`checkTeams`/`checkBank`: una red de invariantes que devuelve `string[]` y nombra al culpable) · `components/games/football-screen/keyboard.ts:101-119` (`parseKeyScheme`/`loadKeyScheme`/`saveKeyScheme`: persistencia pura con `try/catch` y closures inyectadas, el `.tsx` pone el `window.localStorage`) · `components/games/football-screen/flow.ts` (fases puras y probadas; el componente solo pregunta) · `components/games/football-screen/flow-layout.ts` (toda la geometría de menú fuera del `.tsx`) · `components/games/football-screen/control-hints.ts` (textos construidos UNA vez al cargar el módulo).
**Código a modificar:** motor (solo datos + cuadro) — `football-logic/teams.ts`, `football-logic/world-cup.ts` (+ sus tests, + `invariants.test.ts` y `kits.test.ts`); pantalla — `football-screen/flow.ts`, `flow-layout.ts`, `control-hints.ts` (+ tests), `components/games/VaultWorldCupGame.tsx`; catálogo — `lib/games-registry.ts`; spec — una anotación.
**Código nuevo:** `football-logic/squads.ts`, `football-screen/formation-preview.ts`, `football-screen/lineup.ts` (+ los tests de los tres).
**Ledger de este paso:** `.superpowers/sdd/2026-09-23-vault-world-cup-v15-3/` (**creado vacío al escribir este plan**). El controlador crea allí `progress.md` al empezar la ejecución SDD; cada tarea le añade **una** línea al cerrar; la tarea de cierre escribe `qa-paco.md`.

---

## Global Constraints

**Los requisitos de cada tarea incluyen implícitamente esta sección.**

### Las decisiones del grill que este paso ejecuta (copiadas literalmente del spec)

- **Selecciones de la v1.5 (Paco, 2026-09-07):** máximo 20. Lista cerrada de Paco: las 16 de la v1 más **COLOMBIA, COREA DEL SUR, NORUEGA y EGIPTO**. En la v1.5 entran las cuatro con la red de invariantes (`BANK_SIZE` 16 → 20) y el sorteo del Mundial elige 16 de 20 (→ G15-7: Mundial de 16, humano + 15 de 19).
- **G15-7 Mundial (Paco):** banco de 20 seleccionables; el Mundial pasa a **16 equipos** (una ronda más: OCTAVOS → cuartos → semis → final), todo eliminatorias. Humano + 15 sorteadas de 19. Corregir spec:815 y catálogo. Impacto: `WORLD_CUP_SIZE`, rondas y puntuación de `world-cup.ts`, pantalla de cuadro (`bracketRowY`, 8 pares), VER/SALTAR de 7 pares CPU en octavos.
- **G15-8 Puntuación/cuadro Mundial 16 (Paco):** bonus nuevo pasar octavos = 2 500, resto igual → PERFECT_BASE_SCORE 70 500 (4×5 000 + 4×2 000 + 2 500 + 5 000 + 10 000 + 25 000). Botón «SALTAR TODOS» además de VER/SALTAR por cruce. Pantalla de cuadro: solo la ronda actual, 8 cruces en dos columnas de 4 (800×500).
- **G15-9 Selector (Paco):** rejilla 5×4 (tarjetas más estrechas); minicampo a la derecha de la fila ALINEACIÓN con la formación elegida (8 puntos por rol, color del kit de la selección marcada), sin flechas de ataque. Kits nuevos: COLOMBIA #fcd116/#003893, COREA DEL SUR #c60c30/#ffffff, NORUEGA #ba0c2f/#00205b, EGIPTO #ce1126/#ffffff; nuevas al FINAL del array TEAMS.
- **G15-17 · Plantilla y alineación**: 14 por selección (11 titulares + reserva DEF/MED/DEL), nombres inventados que suenen al país, dorsales fijos 1-14 (sustituye los 8 de G15-11).
  > **Adenda de Paco (23-sep, tras el pre-vuelo):** la plantilla sube de 14 a **18** — **2 porteros + 6 defensas + 6 medios + 4 delanteros**, dorsales **1-18** con los dos porteros primero. Motivo: con 14 y once titulares, la 4-4-2 se quedaba sin reserva de medio y la 5-3-2 sin reserva de defensa, así que el «reserva DEF/MED/DEL» de G15-17 no se cumplía en V15-4; y el segundo portero cubre la lesión del portero (G15-18). **El número de la plantilla manda sobre el «14» del spec en este punto**; el resto de G15-17 se aplica tal cual. Pantalla «ALINEACIÓN» tras elegir formación (solo amistoso y Mundial): minicampo con los 11 (dorsal+nombre) + 3 reservas; cambio titular↔reserva solo misma posición (cruceta, confirmar, elegir reserva); edición de nombre (tecla, mayúsculas, máx. 12, Enter). Alineación y nombres editados en localStorage por selección; CPU siempre titulares por defecto; rival visible no editable. En V15-3 (pasa a 2 días).
- **G15-22 (tramo V15-3):** V15-3 Contenido (20 selecciones, 5×4, minicampo, Mundial 16, plantilla 14 + pantalla ALINEACIÓN; 2 días).

**Fuera de V15-3 (no se toca aunque «quede cerca»):** 11 contra 11 y las formaciones 4-4-2/4-3-3/5-3-2, atributos por selección, postes y larguero, tarjetas, lesiones y la pausa de gol de 4 s (**V15-4**, con su regrabado); celebración de abrazo, red que ondula, **nombres y dorsales EN LOS EVENTOS del partido y sobre el jugador controlado**, pantalla previa y celebración de victoria (**V15-5**); el online (**V15-6**, tras producción). Tampoco **G15-24** (entradas y faltas, V15-4) ni **G15-25** (entrada visible, V15-5), que Paco añadió al spec hoy tras el QA de V15-2.

### Cómo este paso evita acoplarse a V15-4 (11 contra 11) — decisión y justificación

V15-4 sube el equipo a once (G15-16). Si este paso escribiera «11» en el modelo de la alineación, V15-4 tendría que reabrir `lineup.ts`, su test y el dibujo. Regla de este plan, **verificable con `grep`**:

> En `football-screen/lineup.ts`, `football-screen/formation-preview.ts` y el dibujo de la pantalla ALINEACIÓN **no aparece el literal `11` ni el literal `3` como tamaño de nada**. Los titulares se derivan de `formation.slots.length + 1` (hoy 9 = 1 portero + 8 de campo; en V15-4, 11) y las reservas son `SQUAD_SIZE − (slots.length + 1)` (hoy **9**, en V15-4 **7**). Los puestos de campo se recorren por `formation.slots.length`, nunca por una constante escrita a mano, y `TEAM_SIZE` se lee **una sola vez**, dentro de `checkLineup`, para avisar si la pantalla y el motor dejaran de estar de acuerdo.

Lo que **sí** se fija a fuego: `SQUAD_SIZE = 18` y los dorsales **1-18** con los dos porteros en el 1 y el 2 (adenda de Paco del 23-sep; el spec decía 14). Composición de la plantilla, elegida para que **todas** las formaciones de hoy y **todas** las de V15-4 tengan **al menos un recambio en cada línea**: **2 porteros (dorsales 1-2) + 6 defensas (3-8) + 6 medios (9-14) + 4 delanteros (15-18)**. Comprobación: hoy 3-3-2 (3/3/2), 3-2-3 (3/2/3) y 4-3-1 (4/3/1); en V15-4 4-4-2 (4/4/2), 4-3-3 (4/3/3) y 5-3-2 (5/3/2) — el máximo por rol entre las seis es **5 defensas, 4 medios y 3 delanteros**, así que con 6/6/4 sobra **como mínimo uno de cada rol en las seis**, y con dos porteros sobra también el portero. **Un test de `squads.test.ts` lo comprueba contra `FORMATIONS` de hoy y contra una tabla literal con las tres formaciones de V15-4**, y `checkSquadCoversFormations` no se conforma con que la plantilla llegue: exige **una reserva de cada rol**, de modo que si en V15-4 alguien mete una 5-4-1 la red salta antes que el juego.

> **Por qué 18 y no 14 (hallazgo H8 del pre-vuelo).** Con 14 (1/5/4/4) y once titulares, la 4-4-2 dejaba `canSwap` **vacío para todos los medios** y la 5-3-2 para todos los defensas: la pantalla existiría pero no dejaría cambiar a media plantilla. Subir a 18 es lo que hace que la promesa «V15-4 no reabre `squads.ts`» sea cierta de verdad, y no solo «caben once».

Además, la alineación guardada lleva **el id de la formación** con la que se guardó y el **número de titulares**: al cargarla contra otra formación (o contra el `TEAM_SIZE` de V15-4) no cuadra, y `parseLineup` cae al orden por defecto sin romper nada. Eso es lo que hace que una alineación guardada hoy con nueve no explote el día que V15-4 ponga once — **y es la razón por la que el formato guardado se decide ahora y no en V15-4**.

**Lo de G15-17 que NO puede existir hasta V15-4, y por qué (listado, no inventado):**
1. **«11 titulares» y «reserva DEF/MED/DEL» literales.** Hoy la pantalla enseña **9 titulares y 9 reservas**. No es un recorte: es el mismo código leyendo `slots.length + 1`. Cuando V15-4 suba el equipo a once, la pantalla enseña **11 y 7** sin tocar una línea.
2. **Que la alineación elegida llegue al partido.** `PlayerState` no tiene `name` ni `number` y **añadírselos es tocar el motor fuera de «datos»**, lo que este paso tiene prohibido. En V15-3 la alineación se elige, se dibuja y se guarda; el partido sigue creando sus jugadores como hoy. La conexión (qué jugador de la plantilla es cada `PlayerState`) entra en **V15-4**, que ya regraba, junto con los atributos de G15-10.
3. **Los nombres en los eventos (GOL, penalti, falta) y el dorsal sobre el controlado.** Son G15-11 y están calendariados en **V15-5**. Este paso solo crea el dato.
4. **Los cambios por lesión** (G15-18) usan estas mismas reservas, pero son de **V15-4**.

### Criterios del spec (copiados literalmente)

> 1. **Misma semilla y misma secuencia de entradas producen el mismo estado**, paso a paso, en un partido completo. Hay test que lo fija. **La simulación es de paso fijo** (`STEP_MS`): ningún `dtMs` entra en el motor.
> 2. **El motor no distingue quién mueve cada equipo**: `stepMatch` recibe dos `TeamInput` y ningún módulo de `football-logic/` lee teclado, `Math.random` ni estado de módulo.
> 4. **Nueve por equipo**, y el portero nunca es el jugador controlado.
> 5. **Se controla siempre el más cercano al balón**, con histéresis de 40 u para que no parpadee, y el cambio es automático y derivado del estado (no es entrada).
> 20. **Ninguna asignación de memoria por frame** en el bucle ni en el dibujo, incluido el confeti (depósito de partículas creado una vez).
> 21. **La suite sigue verde y no baja de los 861 tests (cierre de la etapa B, 2026-09-06)** de partida.

Traducción operativa del criterio 20 para este paso: dentro de `draw()` y sus `draw*`, `update`, `runStep`, `loop` y `pollGamepadFrame` no hay `new`, literales de objeto o array, plantillas ni concatenaciones de string, `.map/.filter/.slice/.split`, ni cierres (`=>`) nuevos. **Las cadenas de la pantalla ALINEACIÓN (dorsal + nombre) se componen en `refreshLineupView()`, que corre al entrar en la pantalla y en cada cambio o tecla de edición — nunca por frame**, exactamente como `refreshBracketView()`. `JSON.parse`/`JSON.stringify` de la persistencia solo corren al entrar y al salir de la pantalla, y están dentro de `try/catch`.

### Reglas del repo

- **Commits: SOLO Paco.** Ninguna tarea ejecuta `git add`, `git rm`, `git commit` ni `git stash`. Donde un plan de superpowers diría «Commit», aquí dice: **dejar el working tree verificado; commit lo hace Paco**. Al final (Task V15-3-10) se propone **UN** mensaje de commit convencional para todo el paso.
- **Rama `main`. HEAD de hoy: `ef61be7`** (V15-2 «Mandos»). Estado del working tree **medido en el pre-vuelo** (corrige lo que decía este plan al escribirse), además del directorio del ledger recién creado y vacío: el plan mismo **en el índice** (`A`), `specs/31-vault-world-cup.md` **en el índice** (`M `) y `tasks/vault-world-cup/HANDOFF-next-session.md` **modificado sin añadir** (`M `) — son las siete líneas del QA jugado de V15-2 que Paco escribió hoy (**G15-24 entradas y faltas, V15-4; G15-25 entrada visible, V15-5**). **Nada de eso es código, y las dos decisiones nuevas caen fuera de V15-3**: no las toques, y cuando la Task V15-3-9 edite el spec, tus cambios se suman a los suyos. Todas las compuertas comparan contra `ef61be7` y se acotan a `*.ts`/`*.tsx`.
- **NUNCA arrancar `next dev` ni `next build`.** Paco tiene el suyo en `:3000`. La verificación de cada tarea es `npx vitest run <fichero>` → `npx vitest run` → `npx tsc --noEmit` → `npx eslint <ficheros tocados>`. **El QA jugado lo hace Paco** con la lista que deja escrita la tarea de cierre.
- **EL MOTOR SE TOCA SOLO EN DATOS Y EN `world-cup.ts`.** Ficheros de `components/games/football-logic/` que este paso puede tocar, y el porqué de cada uno:
  | Fichero | Por qué está permitido |
  |---|---|
  | `teams.ts` | **Datos**: `BANK_SIZE` 16 → 20 y cuatro `TeamDef` al final. Ni una función cambia. |
  | `teams.test.ts` | El test de esos datos. |
  | `kits.test.ts` | El test del banco (240 → **380** pares ordenados). `kits.ts` **no** se toca. |
  | `invariants.test.ts` | Dos cosas del **test**, no del código: el literal del mensaje (`bank size 15` → `bank size 19`) y el generador `legalBank()`, cuyo `(i * 16).toString(16)` se sale de dos dígitos a partir de `i = 16` y produciría kits ilegales con veinte equipos (H2). `invariants.ts` **no** se toca: `checkBank` ya lee la constante. |
  | `squads.ts` (**nuevo**) | **Datos**: las veinte plantillas de **dieciocho** y su red de invariantes. **Nadie del motor lo importa en este paso**; lo consume solo `football-screen/lineup.ts`. |
  | `squads.test.ts` (**nuevo**) | Su red. |
  | `world-cup.ts` | Permitido explícitamente por G15-7/G15-8 (ronda nueva y puntuación). |
  | `world-cup.test.ts` | Su test. |
  | `mode.test.ts` | **Solo el test** (H3): cita la primera ronda del Mundial (`modeDifficulty` 4, `modeMatchLabel` `'CUARTOS DE FINAL'`), la progresión de dificultad `[4, 6, 8]` y el total `61 000`. `mode.ts` **no cambia** — lee `ROUND_DIFFICULTY`/`ROUND_LABELS`, que son tablas — así que esto **no** es un regrabado del partido. |

  Compuerta al cerrar **cada** tarea:
  ```bash
  git diff --name-only ef61be7 -- components/games/football-logic/ | sort
  ```
  Al cerrar el paso, **exactamente** estas **nueve** líneas y ninguna más (la novena, `mode.test.ts`, la añade la Task V15-3-3 por H3):
  ```
  components/games/football-logic/invariants.test.ts
  components/games/football-logic/kits.test.ts
  components/games/football-logic/mode.test.ts
  components/games/football-logic/squads.test.ts
  components/games/football-logic/squads.ts
  components/games/football-logic/teams.test.ts
  components/games/football-logic/teams.ts
  components/games/football-logic/world-cup.test.ts
  components/games/football-logic/world-cup.ts
  ```
  En particular `ai.ts`, `ai.test.ts`, `match.ts`, `match.test.ts`, `step.ts`, `players.ts`, `actions.ts`, `input.ts`, `set-pieces.ts`, **`mode.ts`** (el código; su test sí se toca), `kits.ts`, `invariants.ts`, `pitch.ts`, `referee.ts`, `ball.ts` y `rng.ts` quedan **byte a byte** como en `ef61be7`.
- **Sin regrabado (G15-22: el regrabado es de V15-4).** Ningún valor esperado de un test existente del **partido** cambia — en particular las grabaciones CPU-contra-CPU de `ai.test.ts` y las de `match.test.ts`. `git diff --stat ef61be7 -- components/games/football-logic/ai.test.ts components/games/football-logic/match.test.ts` **vacío** lo garantiza. **Si algo obligara a regrabar, se para y se propone como tarea aparte de V15-4** (lo repite cada tarea).
- **Determinismo (criterios 1 y 2):** `grep -rn "Math.random" components/games/football-logic/ components/games/football-screen/` debe devolver **VACÍO** al cerrar cada tarea (tests incluidos). Ningún fichero de `football-screen/` ni de `football-logic/` importa React ni toca `document`, `window`, `navigator` ni `localStorage`: `window.localStorage` vive **solo** en `VaultWorldCupGame.tsx`, a través de closures creadas una vez al montar y envueltas en el `try/catch` de `loadLineup`/`saveLineup` (el patrón exacto de `loadKeyScheme`/`saveKeyScheme`, V15-2).
- **Instantáneas bajo `.superpowers/`: solo `.txt`.** **Ninguna copia `*.ts`/`*.tsx` bajo `.superpowers/`**: `tsc` y vitest las recogerían. Compuerta: `find .superpowers -name "*.ts" -o -name "*.tsx"` **vacío**.
- **Baseline medida hoy (2026-09-23, HEAD `ef61be7`, `npx vitest run` ejecutado al escribir este plan): 1338 tests en 80 ficheros verdes.** Objetivo al cerrar el paso: **1383 tests en 83 ficheros** (1338 + 9 + 8 + 1 + 4 + 0 + 8 + 10 + 4 + 1 + 0; 80 + 1 + 1 + 1). Ningún test existente del **partido** cambia de valor esperado.
- **ESLint de partida (medido hoy):** `app/games/vault-world-cup/play/page.tsx` arrastra **3 errores** de `react-hooks` (`set-state-in-effect` ×2, `refs`) desde antes de V15-2; **no se arreglan en este paso** (fuera de alcance). Criterio en cada gate: **ningún error nuevo**; el resto de ficheros, `eslint` sin salida.
- **Tests con imports RELATIVOS** (`from './squads'`, `from '../football-logic/teams'`).
- **Comentarios, identificadores y nombres de tests (`describe`/`it`) en inglés** (convención del repo). El plan, el spec, el chat y los textos de UI, en castellano.
- **Ficheros en kebab-case**, salvo `VaultWorldCupGame.tsx`. Tipos en PascalCase, `SCREAMING_CASE` para constantes de módulo. TypeScript estricto: nada de `any`, **nada de `as`** nuevo para tapar un tipo (se estrecha con comparaciones o predicados), **ningún `!` nuevo**. (Los `as` que ya existen — `e.target as HTMLElement | null`, `0 as const`, `Object.keys(GAMES) as GameId[]` — no se tocan.)
- **Un test que pasa no prueba nada hasta verlo fallar** (regla de Paco). Cada tarea tiene su paso «ver en rojo» y su **control negativo** con el resultado esperado escrito literalmente; si un control negativo no hace fallar lo que dice, el test es vacuo y se arregla antes de seguir.
- **Números de línea = orientativos.** Cada cita de línea va con el texto literal a buscar; si las líneas se han desplazado, manda el texto.

### Orden y paralelismo (para SDD)

**Las diez tareas se ejecutan EN SERIE, una detrás de otra — V15-3-1 → … → V15-3-10 — nunca en paralelo**, aunque algunas toquen ficheros disjuntos. Motivo (el mismo que en V15-1 y V15-2): cada tarea pasa por un estado rojo **intencionado** (Step 2: `Failed to resolve import`, `TS2305`/`TS2339`; controles negativos) y cierra con `npx vitest run` y `npx tsc --noEmit` **globales**; en un mismo working tree, dos subagentes en paralelo verían el rojo intencionado del otro como si fuera su propio gate. Además la cadena de dependencias es real: V15-3-2 y V15-3-4 cambian exports que V15-3-5 consume; V15-3-6 produce el dato que V15-3-7 modela; V15-3-5 y V15-3-9 editan el **mismo** `.tsx`.

> **Regla de compuertas (endurecida tras el pre-vuelo):** al cerrar **cada** tarea, `npx vitest run` sale **entero verde** con el número de la columna «Acumulado». Cada tarea **lista y arregla los tests existentes que rompe** — no se deja ningún rojo «para la tarea siguiente». Los **únicos** rojos que cruzan la frontera de una tarea son los **dos de `tsc`** que el plan declara (`bracketRowY` con un argumento tras la Task 4, que cierra la Task 5; `switch` de `menuAction` no exhaustivo tras la Task 8, que cierra la Task 9), y vitest no compila el `.tsx`, así que la suite sigue verde en los dos casos. Los rojos de los Steps 1-2 y de los controles negativos son **dentro** de la tarea y se cierran antes de su compuerta.

| Orden | Tarea | Ficheros que toca | Δ tests / ficheros | Acumulado |
|---|---|---|---|---|
| 1 | **V15-3-1** las 20 selecciones (datos) | `teams.ts`, `teams.test.ts`, `kits.test.ts`, `invariants.test.ts`, **`flow.test.ts`** (H1) | +9 / 0 | 1347 / 80 |
| 2 | **V15-3-2** rejilla 5×4 + minicampo de formación (puro) | `flow-layout.ts` (+test), `formation-preview.ts` (+test, nuevos), **`flow.ts`** y **`flow.test.ts`** (H1) | +8 / +1 | 1355 / 81 |
| 3 | **V15-3-3** Mundial de 16 (`world-cup.ts`) | `world-cup.ts`, `world-cup.test.ts`, **`mode.test.ts`** y **`flow.test.ts`** (H3) | +1 / 0 | 1356 / 81 |
| 4 | **V15-3-4** cuadro de 8 cruces, SALTAR TODOS, sorteo de 16 (puro) | `flow.ts` (+test), `flow-layout.ts` (+test), `control-hints.ts` (+test) | +4 / 0 | 1360 / 81 |
| 5 | **V15-3-5** cableado del Mundial de 16 y del selector en el `.tsx` | `VaultWorldCupGame.tsx` | 0 / 0 | 1360 / 81 |
| 6 | **V15-3-6** plantillas de 18 (datos) | `squads.ts` + test (nuevos) | +8 / +1 | 1368 / 82 |
| 7 | **V15-3-7** modelo de alineación y persistencia (puro) | `lineup.ts` + test (nuevos) | +10 / +1 | 1378 / 83 |
| 8 | **V15-3-8** la fase `'lineup'` en el flujo, su geometría y sus textos (puro) | `flow.ts` (+test), `flow-layout.ts` (+test), `control-hints.ts` (+test) | +4 / 0 | 1382 / 83 |
| 9 | **V15-3-9** la pantalla ALINEACIÓN en el `.tsx` + catálogo + spec | `VaultWorldCupGame.tsx`, `lib/games-registry.ts` (+test), `specs/31-vault-world-cup.md` | +1 / 0 | 1383 / 83 |
| 10 | **V15-3-10** cierre + `qa-paco.md` | solo ledger | 0 / 0 | 1383 / 83 |

---

## Mapa de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `components/games/football-logic/teams.ts` **(modificado)** | `BANK_SIZE` 16 → 20; COLOMBIA, COREA DEL SUR, NORUEGA y EGIPTO al **final** de `TEAMS`. Nada más. | 1 |
| `components/games/football-logic/teams.test.ts` **(modificado)** | Banco de veinte; +1 test que fija las cuatro nuevas y sus índices 16-19. | 1 |
| `components/games/football-logic/kits.test.ts` **(modificado)** | 380 pares ordenados; +4 choques y +4 no-choques reales de las nuevas. | 1 |
| `components/games/football-logic/invariants.test.ts` **(modificado)** | `bank size 15` → `bank size 19` (literal del mensaje) **y** el generador `legalBank()`: `(i * 16)` → `(i * 12)`, para que el hex del kit siga cabiendo en dos dígitos con veinte equipos (H2). | 1 |
| `components/games/football-logic/mode.test.ts` **(modificado)** | H3: dificultad y etiqueta de la primera ronda del Mundial, progresión `[3, 4, 6, 8]` y total `70 500 + 8 000`. **`mode.ts` no se toca.** | 3 |
| `components/games/football-screen/flow-layout.ts` **(modificado)** | T2: rejilla 5×4 (`TEAM_GRID_COLS` 5, tarjeta 140×62) y el rectángulo del minicampo del selector. T4: `BRACKET_COL_X`, `bracketColX`, `DRAW_COL_X` de cuatro. T8: la geometría de ALINEACIÓN. | 2, 4, 8 |
| `components/games/football-screen/formation-preview.ts` **(nuevo)** | Puro: fracción de formación → píxel dentro de un rectángulo cualquiera (`previewSlotX/Y`, `previewGkX/Y`, `previewDotCount`). Lo usan el minicampo del selector y el de ALINEACIÓN. | 2 |
| `components/games/football-screen/flow.ts` **(modificado)** | T4: `BracketAction` gana `'skip-all'`, `bracketChoice: 0 \| 1 \| 2`, `flowMoveBracketChoice` sobre tres, `MODE_BLURBS['world-cup']`. T8: `FlowPhase` `'lineup'`, `flowConfirmTeam` devuelve `'lineup'`, `flowConfirmLineup`, `LINEUP_BY_MODE`, `phaseGroup`. | 4, 8 |
| `components/games/football-screen/control-hints.ts` **(modificado)** | T4: `bracketChoice` nombra las tres opciones. T8: `lineupBrowse`, `lineupSwap`, `lineupEdit`. | 4, 8 |
| `components/games/football-logic/world-cup.ts` **(modificado)** | `WORLD_CUP_SIZE` 8 → 16; ronda `'round-16'`; `SCORE_PASS_ROUND16 = 2 500`; `PERFECT_BASE_SCORE` 70 500; `drawEight` → `drawEntrants`. | 3 |
| `components/games/football-logic/squads.ts` **(nuevo)** | Datos: `SQUAD_SIZE = 18`, `SQUAD_ROLES` (2 GK + 6 DEF + 6 MED + 4 DEL), `SQUAD_NAMES` por selección (360 nombres), `squadRole`, `squadNumber`, `squadName`, `checkSquads`. | 6 |
| `components/games/football-screen/lineup.ts` **(nuevo)** | Puro: `Lineup`, `defaultLineup`, `lineupRoleAt`, `lineupReserves`, `canSwap`/`applySwap`, edición de nombre, `serializeLineup`/`parseLineup`/`loadLineup`/`saveLineup`. **Titulares = `f.slots.length + 1`, reservas = `SQUAD_SIZE −` eso (9 + 9 hoy, 11 + 7 en V15-4).** | 7 |
| `components/games/VaultWorldCupGame.tsx` **(modificado)** | T5: rejilla 5×4, minicampo del selector, sorteo de 16, cuadro de 8 en dos columnas, SALTAR TODOS. T9: pantalla ALINEACIÓN (dibujo, teclas, edición de nombre, persistencia). | 5, 9 |
| `lib/games-registry.ts` + `lib/games-registry.test.ts` **(modificados)** | Catálogo: veinte selecciones, Mundial de dieciséis, ALINEACIÓN. +1 test. | 9 |
| `specs/31-vault-world-cup.md` **(modificado)** | Anotación de que V15-3 implementa la alineación con `TEAM_SIZE` titulares (9 hoy, 11 en V15-4) y de qué queda para V15-4/V15-5. | 9 |
| `.superpowers/sdd/2026-09-23-vault-world-cup-v15-3/progress.md` · `qa-paco.md` | Ledger (una línea por tarea) y lista de QA de Paco. | todas · 10 |

**Lo que este paso NO toca, a propósito:** todo el motor de partido (`ai.ts`, `match.ts`, `step.ts`, `players.ts`, `actions.ts`, `set-pieces.ts`, `referee.ts`, `ball.ts`, `input.ts`, `mode.ts`, `kits.ts`, `invariants.ts`); `keyboard.ts` y `gamepad-input.ts` (los controles son de V15-2); `app/games/vault-world-cup/play/page.tsx`; los otros 13 juegos.

**Deuda conocida que este paso deja escrita y NO arregla** (va a `## Peticiones separadas al motor` del ledger), toda ella en ficheros **vetados**, y toda ella comentarios, no código:
- `mode.ts`: el comentario de `drawRival` («Uniform over the other fifteen») pasa a ser «diecinueve».
- `players.ts`: «18 players created once» lo corrige V15-4 al subir a 22.
- `kits.ts:44-45` (H12): «the real **16-team** bank … all **240** ordered pairs» pasa a «20-team» y «380». `kits.ts` está vetado en este paso — solo se toca su test.

Los comentarios que **sí** mienten en ficheros **permitidos** (`world-cup.ts`, `flow.ts`) **no** son deuda: los corrigen las Tasks 3, 4 y 8, con la lista literal en cada una (H12).

---

### Task V15-3-1: las veinte selecciones — COLOMBIA, COREA DEL SUR, NORUEGA y EGIPTO (G15-9, datos del motor)

**Files:**
- Modify: `components/games/football-logic/teams.ts` (`export const BANK_SIZE = 16;` `:16`; el final del array `TEAMS`, tras `{ id: 'estados-unidos', … }` `:75`; el comentario `// The bank of sixteen: …` `:59`)
- Modify: `components/games/football-logic/teams.test.ts` (`describe('the bank of sixteen selections …` `:23`; `expect(BANK_SIZE).toBe(16);` `:27`)
- Modify: `components/games/football-logic/kits.test.ts` (`clashingPairs` `:39-49`; `distinctPairs` `:54-60`; `it('bank-wide: after resolution, no ordered pair of the 16 teams still clashes'` `:117`)
- Modify: `components/games/football-logic/invariants.test.ts` (`legalBank()` `:25-32`, la línea `const hex = (i * 16).toString(16)…`; `it('checkBank rejects fifteen teams while checkTeams does not count'` `:194`)
- Modify: `components/games/football-screen/flow.test.ts` (`it('moves the cursor on a 4 x 4 grid, …')` `:145-169`) — **H1**: `flowMoveTeam` lee `TEAM_GRID_COLS` (`flow.ts:156`) y `rows = ceil(bankSize / cols)`; con veinte equipos y cuatro columnas la rejilla pasa a **cinco filas**, así que la envoltura vertical cambia de destino. Es un consumidor de `BANK_SIZE` que el plan no había listado.

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces, y todas las demás tareas consumen literalmente: `BANK_SIZE = 20`; `TEAMS` con veinte entradas cuyos índices **0-15 no se mueven** y cuyos índices 16-19 son, en este orden, `'colombia'`, `'corea-del-sur'`, `'noruega'`, `'egipto'`.

**Contexto que el ejecutor no tiene:**
- **Por qué al final del array y no ordenadas.** El índice de `TEAMS` es la identidad de una selección en media docena de sitios (el cursor del selector, `flow.picked`, los tests de `flow.test.ts` que dicen `BANK_IDS[3]`, `BANK_IDS[11]`, los atlas de sprites horneados por kit). Meter COLOMBIA entre BRASIL y ARGENTINA movería dieciséis índices y rompería tests que no tienen nada que ver con este paso. G15-9 lo dice explícitamente: «nuevas al FINAL del array TEAMS».
- **La red que ya existe y que tiene que seguir dando `[]`:** `checkBank` (`invariants.ts:99-103`) exige `teams.length === BANK_SIZE`, ids en kebab-case **únicos**, nombres en mayúsculas, kits `#rrggbb` válidos, **pares de kit únicos** y que el primario y el secundario de una misma selección **no choquen** (distancia RGB ≥ 100). `invariants.ts` **no se toca**: ya lee `BANK_SIZE`.
- **Los cuatro kits ya están verificados contra la red (cálculo hecho al escribir el plan, 23-sep).** Ninguno choca consigo mismo, no hay par de kit repetido, y **los 380 pares ordenados (20 × 19) pasan la propiedad de `resolveMatchKits`: 0 fallos**. Los choques reales de las nuevas, que el test tiene que nombrar: COLOMBIA choca con BRASIL y PAÍSES BAJOS; COREA DEL SUR, NORUEGA y EGIPTO chocan entre sí y con ESPAÑA, PORTUGAL, BÉLGICA, CROACIA y MARRUECOS (los rojos). No chocan: COLOMBIA vs ESPAÑA, COREA DEL SUR vs ITALIA, NORUEGA vs ALEMANIA, EGIPTO vs BRASIL.
- **`invariants.test.ts:194`** construye un banco sintético con `legalBank()`, que ya hace `for (let i = 0; i < BANK_SIZE; i++)`. **OJO (H2, medido): NO se redimensiona solo.** El generador hace `const hex = (i * 16).toString(16).padStart(2, '0');` y, a partir de `i = 16`, `i * 16 ≥ 256` da **tres** dígitos (`'100'`, `'110'`, `'120'`, `'130'`) → `#10000ff`, de ocho caracteres, que `isKitColor` rechaza. Con `BANK_SIZE = 20` eso pone **dos** tests en rojo, no cero: `accepts a legal bank` y `checkBank rejects a bank one short`, los dos con `[ 'team-16: bad kit color', … ]`. Hay que cambiar el generador (`* 16` → `* 12`: con veinte equipos da `00`…`e4`, dos dígitos y todos distintos) **además** del literal del mensaje (`bank size 15` → `bank size 19`).
- **`flow.test.ts` y la rejilla (H1).** `flowMoveTeam` (`flow.ts:154-162`) calcula `rows = Math.ceil(bankSize / TEAM_GRID_COLS)`. Con 16 equipos y 4 columnas eran 4 filas; con **20** y 4 columnas son **5**, así que subir desde la fila 0 envuelve al índice **19**, no al 15. Esta tarea lo deja verde para la rejilla **4×5** de este momento; la Task V15-3-2, que pone `TEAM_GRID_COLS = 5`, reescribe el test entero a la rejilla **5×4** definitiva. Son dos ediciones porque son dos estados reales, y **cada tarea tiene que cerrar en verde**.

- [ ] **Step 1: Escribir los tests en rojo**

1. En `components/games/football-logic/teams.test.ts`, cambia el `describe` y el primer `it` (busca el texto `the bank of sixteen selections (spec step 7)`):

```ts
describe('the bank of twenty selections (spec step 7 + G15-9): the net closes on the real content, first time', () => {
  it('checkBank accepts TEAMS: twenty, unique ids, unique kits, every one legal', () => {
    expect(checkBank(TEAMS)).toEqual([]);
    expect(TEAMS).toHaveLength(BANK_SIZE);
    expect(BANK_SIZE).toBe(20);
  });
```

2. En el mismo fichero, justo después del `it('the two stage-A teams keep their index, id, name and kit', …)`, añade:

```ts
  it('G15-9: the four v1.5 selections are LAST, in Paco\'s order, and the first sixteen keep their index', () => {
    expect(TEAMS.slice(16).map((t) => t.id)).toEqual(['colombia', 'corea-del-sur', 'noruega', 'egipto']);
    expect(TEAMS[16]).toEqual({ id: 'colombia', name: 'COLOMBIA', kit: { primary: '#fcd116', secondary: '#003893' } });
    expect(TEAMS[17]).toEqual({ id: 'corea-del-sur', name: 'COREA DEL SUR', kit: { primary: '#c60c30', secondary: '#ffffff' } });
    expect(TEAMS[18]).toEqual({ id: 'noruega', name: 'NORUEGA', kit: { primary: '#ba0c2f', secondary: '#00205b' } });
    expect(TEAMS[19]).toEqual({ id: 'egipto', name: 'EGIPTO', kit: { primary: '#ce1126', secondary: '#ffffff' } });
    // The v1 sixteen are byte for byte where they were: TEAMS index is an identity
    // (the selector cursor, flow.picked, the baked kit atlases) and must not shift.
    expect(TEAMS[15]).toEqual({ id: 'estados-unidos', name: 'ESTADOS UNIDOS', kit: { primary: '#ffffff', secondary: '#0a3161' } });
  });
```

3. En `components/games/football-logic/kits.test.ts`, añade cuatro filas al final de `clashingPairs` (antes del `];`) y cuatro a `distinctPairs`:

```ts
    ['francia', 'japon'],
    ['italia', 'francia'],
    ['corea-del-sur', 'espana'],
    ['noruega', 'portugal'],
    ['egipto', 'croacia'],
    ['corea-del-sur', 'noruega'],
  ];
```

```ts
    ['mexico', 'brasil'],
    ['colombia', 'espana'],
    ['corea-del-sur', 'italia'],
    ['noruega', 'alemania'],
    ['egipto', 'brasil'],
  ];
```

4. En el mismo fichero, cambia el título y el cuerpo del test de banco completo (busca `bank-wide: after resolution`):

```ts
  it('bank-wide: after resolution, no ordered pair of the 20 teams still clashes (380 pairs)', () => {
    const failures: string[] = [];
    let pairs = 0;
    for (const home of TEAMS) {
      for (const away of TEAMS) {
        if (home.id === away.id) continue;
        pairs++;
        const [rHome, rAway] = resolveMatchKits(home.kit, away.kit);
        if (kitsClash(rHome.primary, rAway.primary)) {
          failures.push(`${home.id} (home) vs ${away.id} (away): ${kitDistance(rHome.primary, rAway.primary).toFixed(2)}`);
        }
      }
    }
    expect(pairs).toBe(380);
    expect(failures).toEqual([]);
  });
```

5. En `components/games/football-logic/invariants.test.ts`, **primero arregla el generador** (H2): busca en `legalBank()` la línea

```ts
    const hex = (i * 16).toString(16).padStart(2, '0');
```
y cámbiala por

```ts
    // * 12, not * 16: with a bank of twenty, i * 16 reaches 256 at i = 16 and the hex
    // would be three digits ('100'), giving #10000ff -- eight characters, which
    // isKitColor rejects. * 12 runs 00..e4: two digits, all different.
    const hex = (i * 12).toString(16).padStart(2, '0');
```
Sin esto, **dos** tests del fichero se ponen en rojo (`accepts a legal bank` y el de abajo), no cero.

6. En el mismo fichero, en el test `checkBank rejects fifteen teams while checkTeams does not count`, cambia el título y el literal:

```ts
  it('checkBank rejects a bank one short while checkTeams does not count', () => {
    const bank = legalBank().slice(0, BANK_SIZE - 1);
    expect(checkTeams(bank)).toEqual([]);
    expect(checkBank(bank).join(' ')).toContain('bank size 19');
  });
```

7. **H1** — en `components/games/football-screen/flow.test.ts`, en `describe('the team selector', …)`, el `it('moves the cursor on a 4 x 4 grid, …')`: con veinte equipos y **cuatro** columnas la rejilla tiene cinco filas, así que la envoltura vertical cae en el 19. Cambia el título y **una** línea:

```ts
  it('moves the cursor on a 4-column grid over the bank of twenty, wrapping rows and columns, and refuses a slot past the bank', () => {
```
```ts
    flowMoveTeam(f, 0, -1, BANK);
    flowMoveTeam(f, 0, -1, BANK);
    expect(f.cursor).toBe(19);   // 20 teams over 4 columns are FIVE rows: row 0 wraps to row 4
```
(el bloque del banco de 14 no cambia: `ceil(14 / 4) = 4` filas sigue dando 10 y 13.) **La Task V15-3-2 vuelve a este mismo `it` y lo reescribe a la rejilla 5×4 definitiva**; aquí solo se le quita el rojo que introduce `BANK_SIZE = 20`.

- [ ] **Step 2: Verlos en rojo**

```bash
npx vitest run components/games/football-logic/teams.test.ts components/games/football-logic/kits.test.ts components/games/football-logic/invariants.test.ts components/games/football-screen/flow.test.ts
```
Esperado: **rojo**. `teams.test.ts`: `expected 16 to be 20` y `expected [] to deeply equal [ 'colombia', … ]`. `kits.test.ts`: las cuatro filas nuevas de `clashingPairs` fallan con `team not in bank: corea-del-sur` (lanza `kitOf`), las de `distinctPairs` igual, y el de banco completo con `expected 240 to be 380`. `invariants.test.ts`: `expected 'bank size 15' to contain 'bank size 19'`. `flow.test.ts`: `expected 15 to be 19` (el aserto que acabas de cambiar todavía se mide contra el banco de dieciséis).

- [ ] **Step 3: Los datos**

En `components/games/football-logic/teams.ts`, cambia la constante y el comentario del array:

```ts
export const BANK_SIZE = 20;
```

```ts
// The bank of twenty: identical on the pitch in v1, different in name and kit. G15-9
// (v1.5) added the last four AT THE END on purpose -- a TEAMS index is an identity
// (selector cursor, flow.picked, the baked kit atlases), so nothing may shift.
```

Y añade las cuatro entradas justo después de `{ id: 'estados-unidos', … },`, antes del `];`:

```ts
  { id: 'colombia', name: 'COLOMBIA', kit: { primary: '#fcd116', secondary: '#003893' } },
  { id: 'corea-del-sur', name: 'COREA DEL SUR', kit: { primary: '#c60c30', secondary: '#ffffff' } },
  { id: 'noruega', name: 'NORUEGA', kit: { primary: '#ba0c2f', secondary: '#00205b' } },
  { id: 'egipto', name: 'EGIPTO', kit: { primary: '#ce1126', secondary: '#ffffff' } },
```

- [ ] **Step 4: Verlos en verde**

```bash
npx vitest run components/games/football-logic/teams.test.ts components/games/football-logic/kits.test.ts components/games/football-logic/invariants.test.ts components/games/football-screen/flow.test.ts
```
Esperado: **verde** en los cuatro (`invariants.test.ts` con sus dos tests de banco, no solo uno).

- [ ] **Step 5: Control negativo — que la red vería un kit malo**

Un test que pasa no prueba nada hasta verlo fallar. Haz **uno cada vez**, comprueba el fallo literal, **deshazlo en el acto**:

1. En `teams.ts`, cambia el primario de NORUEGA a `#c60c30` (el de COREA DEL SUR).
   `npx vitest run components/games/football-logic/teams.test.ts` → **rojo**: `checkBank` devuelve `duplicate kit`? **No**: los secundarios difieren, así que el mensaje esperado es el del test nuevo de índices (`expected {…primary:'#c60c30'…} to deeply equal {…primary:'#ba0c2f'…}`) y, sobre todo, `kits.test.ts` → **rojo** en `corea-del-sur vs noruega does not clash`… ojo: esa fila está en `clashingPairs`, así que **el que tiene que fallar es `noruega vs alemania does not clash`** (`expected true to be false`). Comprueba que sale ese. **Deshaz.**
2. En `teams.ts`, pon el secundario de EGIPTO en `#d01126` (casi igual que su primario, distancia ≈ 2).
   `npx vitest run components/games/football-logic/teams.test.ts` → **rojo**: `expect(checkBank(TEAMS)).toEqual([])` recibe `[ 'egipto: kit colors too close' ]`. **Deshaz.**
3. En `teams.ts`, pon el id de COLOMBIA en `'Colombia'`.
   → **rojo**: `[ 'colombia: bad id' ]`… no: el id es el que se imprime, así que el mensaje es `Colombia: bad id`. **Deshaz.**
4. **(H2)** En `invariants.test.ts`, vuelve a poner `(i * 16)` en `legalBank()`.
   → **rojo en DOS tests**: `accepts a legal bank` y `checkBank rejects a bank one short`, los dos con `expected [ 'team-16: bad kit color', … ] to deeply equal []`. Es el control que demuestra que el generador no se redimensionaba solo. **Deshaz.**

Si alguno **no** falla como dice esto, el test es vacuo: arréglalo antes de seguir.

- [ ] **Step 6: Gates de la tarea**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-logic/teams.ts components/games/football-logic/teams.test.ts components/games/football-logic/kits.test.ts components/games/football-logic/invariants.test.ts components/games/football-screen/flow.test.ts
git diff --name-only ef61be7 -- components/games/football-logic/ | sort
git diff --stat ef61be7 -- components/games/football-logic/ai.test.ts components/games/football-logic/match.test.ts components/games/football-logic/kits.ts components/games/football-logic/invariants.ts
```
Esperado: **1347 tests en 80 ficheros verdes, sin un solo rojo** (los cuatro consumidores de `BANK_SIZE` — `teams.test.ts`, `kits.test.ts`, `invariants.test.ts` ×2 y `flow.test.ts` — están arreglados **en esta tarea**); `tsc` sin salida; `eslint` sin salida; el `--name-only` **exactamente** `invariants.test.ts`, `kits.test.ts`, `teams.test.ts`, `teams.ts` (`flow.test.ts` no está bajo `football-logic/`); el `--stat` **vacío** (sin regrabado, `kits.ts` e `invariants.ts` intactos).

> **Si la suite global se pone roja en un test de PARTIDO** (`ai.test.ts`, `match.test.ts`, `step.test.ts`), **para**: significa que algo lee `TEAMS` por longitud y habría que regrabar, lo que este paso tiene prohibido. Anótalo en `## Peticiones separadas al motor` del ledger y pregunta a Paco antes de seguir. (No debería pasar: el partido recibe dos `TeamDef`, nunca el banco.)

- [ ] **Step 7: Cerrar — NO ejecutes `git add` ni `git commit`**

Deja el working tree verificado y añade **una** línea a `.superpowers/sdd/2026-09-23-vault-world-cup-v15-3/progress.md`:

```
V15-3-1: BANK_SIZE 20 y las cuatro selecciones nuevas al final de TEAMS (índices 16-19). Arreglados los consumidores que rompía: legalBank() de invariants.test.ts (hex * 12) y la rejilla de flow.test.ts (envuelve al 19 con cuatro columnas y veinte equipos). 1347/80 verdes SIN rojos, tsc y eslint limpios, motor tocado solo en teams.ts. Los 380 pares ordenados de resolveMatchKits siguen sin choques.
```

---

### Task V15-3-2: la rejilla 5×4 y el minicampo de la formación (G15-9, puro)

**Files:**
- Modify: `components/games/football-screen/flow-layout.ts` (bloque `── Team selector …` `:7-30`)
- Modify: `components/games/football-screen/flow-layout.test.ts` (`const BANK = 16;` `:10`; `describe('the team grid', …)` `:12-35`)
- Modify: `components/games/football-screen/flow.ts` (**solo el comentario** de `flowMoveTeam`, `:152`: «A **4-column** grid over the bank…» ya no es cierto) — **H1/H12**
- Modify: `components/games/football-screen/flow.test.ts` (`it('moves the cursor on a 4-column grid over the bank of twenty, …')`, el que dejó la Task 1) — **H1**
- Create: `components/games/football-screen/formation-preview.ts`
- Test: `components/games/football-screen/formation-preview.test.ts`

**Interfaces:**
- Consumes de la Task V15-3-1: `BANK_SIZE = 20`, `TEAMS` de veinte. De hoy: `FORMATIONS`, `type Formation`, `type OutfieldRole` (`football-logic/teams`), `VIEW_W`/`VIEW_H` (`./camera`).
- Produces, y la Task V15-3-5 consume literalmente:
  - `flow-layout.ts`: `TEAM_GRID_COLS = 5` · `TEAM_CARD_W = 140` · `TEAM_CARD_H = 62` · `TEAM_GRID_GAP_X = 12` · `TEAM_GRID_GAP_Y = 10` · `TEAM_GRID_TOP = 76` · `FORMATION_ROW_Y = 420` · `SELECT_HINT_Y = 480` · `FORMATION_LABEL_X0 = 140` · `FORMATION_LABEL_DX = 150` · `formationLabelX(i: number): number` · `TEAM_PREVIEW_X = 612` · `TEAM_PREVIEW_Y = 366` · `TEAM_PREVIEW_W = 150` · `TEAM_PREVIEW_H = 97` (y `teamGridWidth`, `teamCardX`, `teamCardY` sin cambio de firma)
  - `formation-preview.ts`: `PREVIEW_GK_X = 0.045` · `previewSlotX(f: Formation, slot: number, x: number, w: number): number` · `previewSlotY(f: Formation, slot: number, y: number, h: number): number` · `previewGkX(x: number, w: number): number` · `previewGkY(y: number, h: number): number` · `previewDotCount(f: Formation): number` · `previewSlotRole(f: Formation, slot: number): OutfieldRole`

**Contexto que el ejecutor no tiene:**
- **Por qué 5×4 y estas medidas.** Veinte selecciones en cinco columnas son **cuatro filas**, las mismas que hoy, así que la rejilla no crece hacia abajo: solo adelgazan las tarjetas. Cuentas, todas con el canvas de 800 × 500: ancho de rejilla `5 × 140 + 4 × 12 = 748`, margen `(800 − 748) / 2 = 26` a cada lado; alto `76 + 3 × (62 + 10) + 62 = 354`, que deja la banda 354-500 libre para la fila ALINEACIÓN (baseline 420), el minicampo (366-463) y la pista (480).
- **Por qué la tarjeta encoge también de alto (74 → 62).** Para que el minicampo quepa **a la derecha de la fila ALINEACIÓN** con la proporción del campo (2000 × 1300 → 150 × 97,5 ≈ 97) sin pisar ni la última fila de tarjetas ni la pista. Con las tarjetas de 74 la última fila acabaría en 410 y no cabría.
- **Por qué el nombre se mueve dentro de la tarjeta.** Hoy el bloque del kit ocupa `x+10 … x+40` y el nombre arranca en `x+50`, con 122 px de hueco. En una tarjeta de 140 eso deja 84 px, y `ESTADOS UNIDOS` (14 caracteres a `bold 11px monospace` ≈ 6,6 px/carácter ≈ 92 px) se sale. La Task V15-3-5 estrecha el bloque del kit a 22 px y arranca el nombre en `x+36`: **104 px** de hueco (`TEAM_CARD_W 140 − 36`, H11), suficiente también para `COREA DEL SUR` (13) y `PAÍSES BAJOS` (12).
- **La rejilla de `flowMoveTeam` (H1).** `TEAM_GRID_COLS` tiene un consumidor más de los que el plan listaba: `flow.ts:156`, dentro de `flowMoveTeam`. Al pasar de 4 a 5 columnas cambian **todos** los destinos del test de la rejilla (`flow.test.ts`), que la Task 1 dejó verde para 4 columnas y 20 equipos. Esta tarea lo reescribe a la rejilla definitiva **5×4** y corrige el comentario de `flow.ts:152`.
- **Por qué las etiquetas de formación se juntan.** Hoy se pintan en `150 + i * 200` → 150, 350, 550; `3 DEFENSIVA` a `bold 12px monospace` mide ≈ 79 px, así que la tercera acabaría en 629 y pisaría el minicampo (612). Con `formationLabelX` → 140, 290, 440, la tercera acaba en ≈ 519.
- **Qué es y qué NO es `formation-preview.ts`.** Es geometría pura: fracción de formación → píxel dentro de un rectángulo. **No** conoce el `PitchDef` del motor (no es una proyección del partido, es un esquema), **no** elige colores (los pone el `.tsx`: `kit.primary` para los de campo, el verde flúor del portero) y **no** dibuja flechas de ataque (G15-9: «sin flechas de ataque»). Se escribe genérico en el rectángulo justamente porque lo van a usar **dos** pantallas: el minicampo del selector (Task 5) y el de ALINEACIÓN (Task 9).
- **`PREVIEW_GK_X = 0.045`:** el portero no tiene `FormationSlot`; en el partido vive a `GK_LINE_DIST = 25` u de su línea sobre un campo de 2000 u de ancho → `25 / 2000 = 0,0125`, que en un minicampo de 150 px cae a 1,9 px del borde y se come el punto. 0,045 lo separa lo justo (6,75 px) sin mentir sobre dónde está. **No importa `players.ts`** (está vetado y además sería acoplar un esquema a la física).
- **Por qué `previewDotCount` y no `9`:** es `f.slots.length + 1` (el portero). Hoy 9, en V15-4 11, sin tocar este fichero — es la regla de las Global Constraints.

- [ ] **Step 1: Escribir los tests en rojo**

1. Crea `components/games/football-screen/formation-preview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FORMATIONS } from '../football-logic/teams';
import {
  PREVIEW_GK_X, previewDotCount, previewGkX, previewGkY, previewSlotRole, previewSlotX, previewSlotY,
} from './formation-preview';

const X = 100;
const Y = 50;
const W = 200;
const H = 130;

describe('formation preview geometry (G15-9): a schematic, not a projection of the pitch', () => {
  it('maps a slot fraction into the rectangle, attacking to the right', () => {
    const f = FORMATIONS[0];                       // 3-3-2 NORMAL
    expect(previewSlotX(f, 0, X, W)).toBe(X + 0.22 * W);
    expect(previewSlotY(f, 0, Y, H)).toBe(Y + 0.25 * H);
    expect(previewSlotX(f, 7, X, W)).toBe(X + 0.7 * W);
    expect(previewSlotY(f, 7, Y, H)).toBe(Y + 0.65 * H);
  });

  it('puts the goalkeeper on its own line, inside the rectangle and left of every outfield slot', () => {
    expect(PREVIEW_GK_X).toBeGreaterThan(0);
    expect(previewGkX(X, W)).toBe(X + PREVIEW_GK_X * W);
    expect(previewGkY(Y, H)).toBe(Y + H / 2);
    for (const f of FORMATIONS) {
      for (let s = 0; s < f.slots.length; s++) {
        expect(previewGkX(X, W)).toBeLessThan(previewSlotX(f, s, X, W));
      }
    }
  });

  it('every dot of every formation lands strictly inside the rectangle', () => {
    for (const f of FORMATIONS) {
      expect(previewGkX(X, W)).toBeGreaterThan(X);
      for (let s = 0; s < f.slots.length; s++) {
        expect(previewSlotX(f, s, X, W)).toBeGreaterThan(X);
        expect(previewSlotX(f, s, X, W)).toBeLessThan(X + W);
        expect(previewSlotY(f, s, Y, H)).toBeGreaterThan(Y);
        expect(previewSlotY(f, s, Y, H)).toBeLessThan(Y + H);
      }
    }
  });

  it('previewDotCount is the formation\'s slots plus the goalkeeper -- never a hard-coded team size (V15-4 raises it)', () => {
    for (const f of FORMATIONS) expect(previewDotCount(f)).toBe(f.slots.length + 1);
    expect(previewDotCount(FORMATIONS[0])).toBe(9);
    // A hypothetical V15-4 formation with ten outfield slots needs no change here.
    const tenSlots = { id: '4-4-2', name: 'NORMAL', slots: [...FORMATIONS[0].slots, ...FORMATIONS[1].slots.slice(0, 2)] };
    expect(previewDotCount(tenSlots)).toBe(11);
  });

  it('previewSlotRole names the role of each dot, so the screen can paint by role (G15-9: "puntos por rol")', () => {
    const f = FORMATIONS[0];
    expect(previewSlotRole(f, 0)).toBe('def');
    expect(previewSlotRole(f, 3)).toBe('mid');
    expect(previewSlotRole(f, 7)).toBe('fwd');
  });

  it('is pure: the same arguments give the same numbers and nothing is cached', () => {
    const f = FORMATIONS[2];
    const a = previewSlotX(f, 1, X, W);
    const b = previewSlotX(f, 1, X, W);
    expect(a).toBe(b);
    expect(previewSlotX(f, 1, 0, W)).toBe(a - X);
  });
});
```

2. En `components/games/football-screen/flow-layout.test.ts`, cambia `const BANK = 16;` por `const BANK = 20;`, añade los nuevos nombres al import de `./flow-layout` (`FORMATION_LABEL_DX, FORMATION_LABEL_X0, TEAM_PREVIEW_H, TEAM_PREVIEW_W, TEAM_PREVIEW_X, TEAM_PREVIEW_Y, formationLabelX`) y sustituye el `describe('the team grid', …)` **entero** por:

```ts
describe('the team grid (G15-9: twenty selections in a 5 x 4 grid)', () => {
  it('is five columns wide and fits the canvas, centred', () => {
    expect(TEAM_GRID_COLS).toBe(5);
    const width = teamGridWidth(BANK);
    expect(width).toBe(5 * TEAM_CARD_W + 4 * TEAM_GRID_GAP_X);
    expect(width).toBeLessThan(VIEW_W);
    expect(teamCardX(0, BANK)).toBe((VIEW_W - width) / 2);
    expect(teamCardX(4, BANK) + TEAM_CARD_W).toBe(VIEW_W - teamCardX(0, BANK));
  });

  it('places index 6 on column 1, row 1 and index 19 on column 4, row 3', () => {
    expect(teamCardX(6, BANK)).toBe(teamCardX(1, BANK));
    expect(teamCardY(6)).toBe(TEAM_GRID_TOP + TEAM_CARD_H + TEAM_GRID_GAP_Y);
    expect(teamCardX(19, BANK)).toBe(teamCardX(4, BANK));
    expect(teamCardY(19)).toBe(TEAM_GRID_TOP + 3 * (TEAM_CARD_H + TEAM_GRID_GAP_Y));
  });

  it('still fits a bank narrower than one row', () => {
    expect(teamGridWidth(3)).toBe(3 * TEAM_CARD_W + 2 * TEAM_GRID_GAP_X);
  });

  it('leaves room under the last row for the formation row, the mini pitch and the hint', () => {
    const bottom = teamCardY(19) + TEAM_CARD_H;
    expect(bottom).toBeLessThan(TEAM_PREVIEW_Y);
    expect(bottom).toBeLessThan(FORMATION_ROW_Y);
    expect(FORMATION_ROW_Y).toBeLessThan(SELECT_HINT_Y);
    expect(SELECT_HINT_Y).toBeLessThan(VIEW_H);
  });

  it('the mini pitch sits to the RIGHT of the formation row, keeps the pitch ratio and clears the hint (G15-9)', () => {
    // The third formation label ('3 DEFENSIVA', 11 chars of bold 12px monospace ~ 79px)
    // must not reach the mini pitch.
    expect(formationLabelX(0)).toBe(FORMATION_LABEL_X0);
    expect(formationLabelX(2)).toBe(FORMATION_LABEL_X0 + 2 * FORMATION_LABEL_DX);
    expect(formationLabelX(2) + 80).toBeLessThan(TEAM_PREVIEW_X);
    expect(TEAM_PREVIEW_X + TEAM_PREVIEW_W).toBeLessThan(VIEW_W);
    expect(TEAM_PREVIEW_Y + TEAM_PREVIEW_H).toBeLessThan(SELECT_HINT_Y - 8);
    // 2000 x 1300 is the pitch; the preview keeps that ratio within one pixel.
    expect(Math.abs(TEAM_PREVIEW_W / TEAM_PREVIEW_H - 2000 / 1300)).toBeLessThan(0.02);
  });
});
```

3. **H1** — en `components/games/football-screen/flow.test.ts`, sustituye el `it` de la rejilla **entero** (el que la Task 1 dejó en «4-column grid over the bank of twenty») por su versión definitiva de cinco columnas:

```ts
  it('moves the cursor on a 5 x 4 grid, wrapping rows and columns, and refuses a slot past the bank', () => {
    const f = createFlowState();
    flowConfirmMode(f);
    flowMoveTeam(f, 1, 0, BANK);
    expect(f.cursor).toBe(1);
    flowMoveTeam(f, -1, 0, BANK);
    flowMoveTeam(f, -1, 0, BANK);
    expect(f.cursor).toBe(4);            // wraps within the row
    flowMoveTeam(f, 0, 1, BANK);
    expect(f.cursor).toBe(9);
    flowMoveTeam(f, 0, -1, BANK);
    flowMoveTeam(f, 0, -1, BANK);
    expect(f.cursor).toBe(19);           // wraps to the last row
    // A bank of 18: from 13 (column 3, row 2), down would land on 18 -- stay.
    f.cursor = 13;
    flowMoveTeam(f, 0, 1, 18);
    expect(f.cursor).toBe(13);
    f.cursor = 12;
    flowMoveTeam(f, 0, 1, 18);
    expect(f.cursor).toBe(17);
    const idle = createFlowState();
    flowMoveTeam(idle, 1, 0, BANK);
    expect(idle.cursor).toBe(0);
  });
```
> Los valores están calculados a mano (`cols = 5`, `rows = ceil(20/5) = 4`; para el banco de 18, `rows = ceil(18/5) = 4`). **Verifícalos ejecutando** antes de dar la tarea por verde: si alguno no cuadra, manda lo que diga `vitest`, no este bloque.

- [ ] **Step 2: Verlos en rojo**

```bash
npx vitest run components/games/football-screen/formation-preview.test.ts components/games/football-screen/flow-layout.test.ts components/games/football-screen/flow.test.ts
```
Esperado: **rojo**. El primero con `Failed to resolve import "./formation-preview"`; el segundo con `expected 4 to be 5` y `No test found`… no: con errores de import (`TEAM_PREVIEW_X` etc. no exportados) → `SyntaxError`/`TS`-menos: en vitest sale como `does not provide an export named 'TEAM_PREVIEW_X'`. Cualquiera de los dos vale como rojo; lo que **no** vale es que pase. El tercero, `expected 3 to be 4` en la rejilla nueva (con cuatro columnas, dos pasos a la izquierda desde el índice 1 siguen dando 3).

- [ ] **Step 3: Escribir `formation-preview.ts`**

```ts
import type { Formation, OutfieldRole } from '../football-logic/teams';

// G15-9: the mini pitch of the team selector and, from V15-3-9, the one of the
// ALINEACIÓN screen. A SCHEMATIC, not a projection of the match: it takes a
// formation's unit fractions into an arbitrary rectangle and nothing else. It does
// not know PitchDef, it picks no colours (the .tsx paints the kit) and it draws no
// attack arrows (G15-9: "sin flechas de ataque"). Everything is derived from
// `f.slots`, never from a hard-coded team size -- V15-4 raises it and this file
// does not move. Pure arithmetic; nothing allocates.

// The goalkeeper has no FormationSlot. In the match it stands GK_LINE_DIST = 25 u off
// its own line on a 2000 u pitch (0.0125), which in a 150 px preview would be under
// two pixels from the frame and eat the dot. 0.045 clears the frame without lying
// about where the keeper is. (Deliberately NOT imported from players.ts: the engine
// is out of bounds in this step, and a schematic must not be coupled to the physics.)
export const PREVIEW_GK_X = 0.045;

export function previewSlotX(f: Formation, slot: number, x: number, w: number): number {
  return x + f.slots[slot].x * w;
}

export function previewSlotY(f: Formation, slot: number, y: number, h: number): number {
  return y + f.slots[slot].y * h;
}

export function previewSlotRole(f: Formation, slot: number): OutfieldRole {
  return f.slots[slot].role;
}

export function previewGkX(x: number, w: number): number {
  return x + PREVIEW_GK_X * w;
}

export function previewGkY(y: number, h: number): number {
  return y + h / 2;
}

// The outfield slots plus the goalkeeper: 9 today, 11 once V15-4 raises TEAM_SIZE.
export function previewDotCount(f: Formation): number {
  return f.slots.length + 1;
}
```

- [ ] **Step 4: La geometría nueva en `flow-layout.ts`**

Sustituye el bloque `── Team selector …` (desde `export const TEAM_GRID_COLS = 4;` hasta `export const SELECT_HINT_Y = 478;`) por:

```ts
// ── Team selector: the twenty of the bank in a 5 x 4 grid (G9-4, G15-9) ────────
// Twenty in five columns is still FOUR rows, so the grid does not grow downwards:
// the cards get narrower (172 -> 140) and shorter (74 -> 62) instead. 5*140 + 4*12
// = 748 wide (26 px of margin each side) and 76 + 3*72 + 62 = 354 tall, which leaves
// the 354-500 band for the formation row, the mini pitch and the hint.
export const TEAM_GRID_COLS = 5;
export const TEAM_CARD_W = 140;
export const TEAM_CARD_H = 62;
export const TEAM_GRID_GAP_X = 12;
export const TEAM_GRID_GAP_Y = 10;
export const TEAM_GRID_TOP = 76;
// Under the grid: the formation selector (G9-5), its mini pitch (G15-9) and the hint.
export const FORMATION_ROW_Y = 420;
export const SELECT_HINT_Y = 480;
// The three formation labels. 150 px apart, not 200: '3 DEFENSIVA' is ~79 px of
// bold 12px monospace and at 550 it would reach into the mini pitch at 612.
export const FORMATION_LABEL_X0 = 140;
export const FORMATION_LABEL_DX = 150;
// G15-9: the mini pitch to the RIGHT of the formation row. 150 x 97 keeps the
// 2000 x 1300 ratio of the pitch, so the schematic is not stretched.
export const TEAM_PREVIEW_X = 612;
export const TEAM_PREVIEW_Y = 366;
export const TEAM_PREVIEW_W = 150;
export const TEAM_PREVIEW_H = 97;

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

export function formationLabelX(index: number): number {
  return FORMATION_LABEL_X0 + index * FORMATION_LABEL_DX;
}
```

- [ ] **Step 4b: El comentario de `flowMoveTeam` (H12)**

En `components/games/football-screen/flow.ts`, sobre `flowMoveTeam`, sustituye

```ts
// A 4-column grid over the bank, wrapping on both axes; a wrap that lands past the
// bank (a bank that is not a multiple of four) leaves the cursor where it was.
```
por

```ts
// A TEAM_GRID_COLS-wide grid over the bank (five since G15-9), wrapping on both axes;
// a wrap that lands past the bank (a bank that is not a multiple of the column count)
// leaves the cursor where it was.
```
**El cuerpo de la función no se toca**: ya lee `TEAM_GRID_COLS`.

- [ ] **Step 5: Verlos en verde**

```bash
npx vitest run components/games/football-screen/formation-preview.test.ts components/games/football-screen/flow-layout.test.ts components/games/football-screen/flow.test.ts
```
Esperado: **verde** en los tres.

- [ ] **Step 6: Controles negativos**

**Uno cada vez, y deshaz en el acto.**
1. En `flow-layout.ts`, pon `TEAM_CARD_W = 160`. → `flow-layout.test.ts` **rojo**: `expected 848 to be less than 800` (la rejilla se sale del canvas). **Deshaz.**
2. En `flow-layout.ts`, pon `TEAM_PREVIEW_Y = 340`. → **rojo**: `expected 354 to be less than 340` (el minicampo pisaría la última fila de tarjetas). **Deshaz.**
3. En `formation-preview.ts`, pon `PREVIEW_GK_X = 0.3`. → `formation-preview.test.ts` **rojo**: `expected 160 to be less than 144` (H11: el 144 sale de la **3-3-2**, `0,22 × 200 + 100`, que es la primera del bucle; el portero se pondría por delante de su defensa más retrasado). **Deshaz.**
4. En `formation-preview.ts`, cambia `previewDotCount` a `return 9;`. → **rojo**: `expected 9 to be 11` en el test de la formación hipotética de V15-4. **Este control negativo es el que vigila la regla anti-acoplamiento de las Global Constraints**; si no falla, el test es vacuo. **Deshaz.**

- [ ] **Step 7: Gates de la tarea**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/formation-preview.ts components/games/football-screen/formation-preview.test.ts components/games/football-screen/flow-layout.ts components/games/football-screen/flow-layout.test.ts components/games/football-screen/flow.ts components/games/football-screen/flow.test.ts
git diff --name-only ef61be7 -- components/games/football-logic/ | sort
grep -n "PitchDef\|players\|Math.random" components/games/football-screen/formation-preview.ts
grep -n "4-column\|4 x 4" components/games/football-screen/flow.ts components/games/football-screen/flow.test.ts
```
Esperado: **1355 tests en 81 ficheros verdes, sin un solo rojo** (la rejilla de `flow.test.ts` queda ya en su forma 5×4 definitiva); `tsc` y `eslint` sin salida; el `--name-only` sigue siendo las cuatro líneas de la Task 1; los dos `grep` **vacíos**.

> El `.tsx` todavía dibuja la rejilla con las medidas nuevas pero **sin** el minicampo: se ve raro (tarjetas estrechas, hueco a la derecha). Es lo esperado hasta la Task V15-3-5; **no** lo arregles aquí.

- [ ] **Step 8: Cerrar — NO ejecutes `git add` ni `git commit`**

Una línea en `progress.md`:

```
V15-3-2: rejilla 5×4 (tarjeta 140×62), fila ALINEACIÓN recolocada y rectángulo del minicampo en flow-layout.ts; formation-preview.ts puro (fracción → píxel, dots = slots + portero); test de la rejilla de flow.test.ts reescrito a 5×4 y comentario de flowMoveTeam corregido. 1355/81 verdes SIN rojos. El .tsx aún no pinta el minicampo (Task 5).
```

---

### Task V15-3-3: el Mundial de dieciséis — OCTAVOS, su bonus y el cuadro de ocho cruces (G15-7 + G15-8, `world-cup.ts`)

**Files:**
- Modify: `components/games/football-logic/world-cup.ts` (cabecera y `WORLD_CUP_SIZE` `:1-8`; `WorldCupRound` `:10`; `ROUND_LABELS` `:46-50`; `ROUND_DIFFICULTY` `:53-57`; `NEXT_ROUND` `:59-63`; `ROUND_INDEX`/`ROUND_ENTRANTS` `:65-66`; tabla de puntos `:68-82`; `drawEight` `:105-121`)
- Modify: `components/games/football-logic/world-cup.test.ts` (`const ROUNDS` `:17`; `playRound` `:41-52`; y los tests que citan 8/4/3/61 000, **incluidos `:65` y `:157`, que el plan no listaba** — H4, y el `c.results[3]` de `:298` — H7)
- Modify: `components/games/football-logic/mode.test.ts` (`describe('the World Cup mode', …)`: `:181`, `:185`, `:190-206`) — **H3**. Es el **noveno** fichero permitido de `football-logic/`; **`mode.ts` NO se toca**.
- Modify: `components/games/football-screen/flow.test.ts` (`it('offers VER by default, …')` `:242`, solo el `expect(pairs).toBe(3)` y su título; `it('a World Cup round won goes back to the bracket …')` `:334-350`) — **H3**

**Interfaces:**
- Consumes de la Task V15-3-1: `TEAMS` de veinte (el test lo usa como banco).
- Produces, y las Tasks V15-3-4/5 consumen literalmente:
  - `WORLD_CUP_SIZE = 16` · `type WorldCupRound = 'round-16' | 'quarters' | 'semis' | 'final'`
  - `ROUND_LABELS['round-16'] = 'OCTAVOS DE FINAL'` (los otros tres, intactos)
  - `ROUND_DIFFICULTY = { 'round-16': 3, quarters: 4, semis: 6, final: 8 }`
  - `SCORE_PASS_ROUND16 = 2_500` (exportada) · `ROUND_BONUS = { 'round-16': 2_500, quarters: 5_000, semis: 10_000, final: 25_000 }` · `PERFECT_BASE_SCORE = 70_500`
  - Todo lo demás (`createWorldCup`, `pairCount`, `pairHomeId/AwayId`, `humanPairIndex`, `humanSideInPair`, `nextCpuPair`, `resolveCpuMatch`, `winHumanMatch`, `loseHumanMatch`, `abandonHumanMatch`, `cpuMatchSeed`, `pairResult`, `checkWorldCupBracket`, `matchSeedFor`) **con la misma firma**.

**Contexto que el ejecutor no tiene:**
- **Por qué esto es un cambio de tablas y no de ramas.** `world-cup.ts` ya está parametrizado: `pairCount` es `entrants.length >> 1`, `advanceRound` recorta `entrants.length` a la mitad, y todo lo que depende de la ronda vive en cuatro `Record<WorldCupRound, …>` (`ROUND_LABELS`, `ROUND_DIFFICULTY`, `NEXT_ROUND`, `ROUND_INDEX`, `ROUND_ENTRANTS`, `ROUND_BONUS`). Añadir una ronda es añadir una entrada a cada tabla; **TypeScript obliga**, porque un `Record<WorldCupRound, X>` al que le falte `'round-16'` no compila. Ésa es la red de seguridad de esta tarea: si te olvidas de una tabla, `tsc` lo dice.
- **`matchSeedFor` NO cambia.** Con cuatro rondas y ocho pares son 32 ranuras por semilla de torneo. Comprobado numéricamente al escribir el plan: con las tres salts actuales, las **32 ranuras son distintas** para las siete semillas del test (0, 1, 7, 42, 999 999, 0x7fffffff, 1 757 000 000 000), para **las 2 000 primeras semillas** no hay ni una colisión, y semillas contiguas (s, s+1) no comparten ni una ranura en las 500 primeras. No toques las salts.
- **Ningún test fija un cuadro concreto por semilla** (comprobado al escribir el plan y confirmado en el pre-vuelo): `world-cup.test.ts` compara `a.bracket` con `b.bracket` (misma semilla) y con `c.bracket` (semilla distinta), pero **nunca** contra una lista literal de equipos. Por eso pasar de 16 a 20 selecciones y de 8 a 16 participantes **no obliga a regrabar nada**. `flow.test.ts` usa `wc.entrants[pair * 2]`, también relativo. Si al ejecutar aparece un test con una lista literal de ids, **para y avisa**: sería un regrabado y este paso lo tiene prohibido.
- **Lo que sí fijan los tests, y esta tarea rompe si no lo arregla (H3):** el **número de rondas**, la **dificultad** y la **puntuación**. Hay tres ficheros con eso escrito, no uno:
  - `world-cup.test.ts` — cubierto por el Step 1, pero con **dos asertos que el plan se había dejado** (`:65` `expect(wc.round).toBe('quarters')` dentro del bucle del primer `it`, y `:157` `expect(res?.round).toBe('quarters')`) y **uno que dejaba de discriminar** (`:298`, `c.results[3]`, que con dieciséis pasa a ser un resultado de CPU y acierta por casualidad con esa semilla).
  - `mode.test.ts` — `modeDifficulty` 4, `modeMatchLabel` `'CUARTOS DE FINAL'`, la progresión `[4, 6, 8]` y `61 000 + 6 000`. **`mode.ts` no cambia**: lee `ROUND_DIFFICULTY`/`ROUND_LABELS`. Por eso el fichero entra en la tabla de permitidos de las Global Constraints (la novena línea) y esto **no** es un regrabado del partido.
  - `flow.test.ts` — `expect(pairs).toBe(3)` en el test del cuadro (siete pares de CPU en octavos) y el `it('a World Cup round won goes back to the bracket …')`, que recorre **tres** rondas y espera `[4, 6, 8]` y `67 000`.
  Los tres se arreglan **aquí**, en los Steps 1b y 1c, para que la compuerta de esta tarea salga verde entera.
- **La dificultad de octavos (3) la decide este plan, no el spec.** G15-8 fija los puntos pero no la dificultad. 3 continúa la progresión 4/6/8 hacia abajo y deja el amistoso (5, `FRIENDLY_DIFFICULTY`) por encima de la primera ronda del Mundial. Va a `qa-paco.md` como punto a confirmar jugando.
- **`drawEight` pasa a llamarse `drawEntrants`.** Es privada del módulo (no se exporta), así que el renombrado no cruza ningún límite; se renombra porque «Eight» ya es mentira.
- **Comprobación aritmética de G15-8:** 4 × 5 000 (victorias) + 4 × 2 000 (porterías a cero) + 2 500 + 5 000 + 10 000 + 25 000 = 20 000 + 8 000 + 42 500 = **70 500**. El test lo escribe con la fórmula y con el literal.

- [ ] **Step 1: Escribir los tests en rojo**

En `components/games/football-logic/world-cup.test.ts`:

1. Añade `SCORE_PASS_ROUND16` al import de `./world-cup` y cambia la lista de rondas:

```ts
const ROUNDS: readonly WorldCupRound[] = ['round-16', 'quarters', 'semis', 'final'];
const PAIRS_BY_ROUND: readonly number[] = [8, 4, 2, 1];
```

2. En `describe('createWorldCup', …)`, primer `it`: cambia el título a `'draws exactly sixteen distinct teams of the bank with the human inside, for EVERY team of the bank and three seeds'`. **El cuerpo SÍ cambia** (H4): dentro del bucle hay un `expect(wc.round).toBe('quarters');` (≈ `:65`) que pasa a `expect(wc.round).toBe('round-16');`. Lo demás ya usa `WORLD_CUP_SIZE`.

3. En el segundo `it` (`same seed -> same bracket…`), cambia `for (let pair = 0; pair < 4; pair++)` por `for (let pair = 0; pair < 8; pair++)` y el título a `'same seed -> same bracket and the same four match seeds; a different seed -> a different bracket'`.

4. En `describe('matchSeedFor', …)`, sustituye los dos `it` por:

```ts
  it('gives thirty-two distinct 32-bit seeds for the (round, pair) slots of one tournament seed, for several seeds', () => {
    for (const seed of [0, 1, 7, 42, 999_999, 0x7fffffff, 1_757_000_000_000]) {
      const seen = new Set<number>();
      for (const round of ROUNDS) {
        for (let pair = 0; pair < 8; pair++) {
          const s = matchSeedFor(seed, round, pair);
          expect(Number.isInteger(s)).toBe(true);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(0xffffffff);
          seen.add(s);
        }
      }
      expect(seen.size).toBe(32);
    }
  });

  it('two tournament seeds one apart do not share a match seed', () => {
    const a = new Set<number>();
    for (const round of ROUNDS) for (let p = 0; p < 8; p++) a.add(matchSeedFor(100, round, p));
    for (const round of ROUNDS) for (let p = 0; p < 8; p++) expect(a.has(matchSeedFor(101, round, p))).toBe(false);
  });
```

5. En `describe('cpuMatchSeed and pairResult …')`, en el primer `it` cambia `expect(wc.round).toBe('semis');` por `expect(wc.round).toBe('quarters');` (tras la primera ronda, que ahora son octavos) y el título a `'…and follows the round forward'` (sin cambio). **Y (H4) en ese mismo `it`, `expect(res?.round).toBe('quarters');` (≈ `:157`) pasa a `toBe('round-16');`** — es el resultado de un cruce **de la ronda en curso**, no de la siguiente, y el plan lo había confundido con los `wc.round`. En el tercer `it` (`after advancing a round…`) cambia `expect(wc.round).toBe('semis')` por `expect(wc.round).toBe('quarters')`.

6. Sustituye `describe('round tables', …)` **entero** por:

```ts
describe('round tables (G15-7 / G15-8: sixteen teams, four rounds)', () => {
  it('four rounds, difficulty 3/4/6/8 and the four Spanish labels', () => {
    expect(WORLD_CUP_SIZE).toBe(16);
    expect(ROUND_DIFFICULTY).toEqual({ 'round-16': 3, quarters: 4, semis: 6, final: 8 });
    expect(ROUND_LABELS['round-16']).toBe('OCTAVOS DE FINAL');
    expect(ROUND_LABELS.quarters).toBe('CUARTOS DE FINAL');
    expect(ROUND_LABELS.semis).toBe('SEMIFINAL');
    expect(ROUND_LABELS.final).toBe('FINAL');
    const wc = createWorldCup(BANK_IDS, 'japon', 2, createRng(2));
    expect(currentDifficulty(wc)).toBe(3);
    expect(roundLabel(wc)).toBe('OCTAVOS DE FINAL');
    expect(isFinal(wc)).toBe(false);
    expect(pairCount(wc)).toBe(8);
  });

  it('the scoring table of G15-8, and the perfect base of 70 500', () => {
    expect(matchPoints(0, 0, false)).toBe(SCORE_CLEAN_SHEET);
    expect(matchPoints(2, 1, true)).toBe(2 * SCORE_GOAL + SCORE_WIN);
    expect(matchPoints(3, 0, true)).toBe(3 * SCORE_GOAL + SCORE_WIN + SCORE_CLEAN_SHEET);
    expect(matchPoints(1, 2, false)).toBe(SCORE_GOAL);
    expect(SCORE_PASS_ROUND16).toBe(2_500);
    expect(ROUND_BONUS).toEqual({ 'round-16': 2_500, quarters: 5_000, semis: 10_000, final: 25_000 });
    expect(PERFECT_BASE_SCORE).toBe(4 * SCORE_WIN + 4 * SCORE_CLEAN_SHEET + 2_500 + 5_000 + 10_000 + 25_000);
    expect(PERFECT_BASE_SCORE).toBe(70_500);
  });

  it('every round has half the pairs of the previous one, 8 -> 4 -> 2 -> 1', () => {
    const wc = createWorldCup(BANK_IDS, 'noruega', 31, createRng(31));
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(pairCount(wc));
      if (i < 3) playRound(wc, 1, 0, true);
    }
    expect(seen).toEqual(PAIRS_BY_ROUND);
  });
});
```

7. En `describe('the CPU pairs of a round', …)`, primer `it`: título a `'nextCpuPair walks the seven pairs without the human; …'`, y cambia los tres números:

```ts
    expect(visited).toHaveLength(7);
    expect(visited).not.toContain(human);
    expect(wc.resultCount).toBe(7);
```
y, más abajo, `expect(wc.resultCount).toBe(7);` (el segundo, tras los dos `resolveCpuMatch` rechazados).

8. En `describe('winning the World Cup', …)`, primer `it`:

```ts
  it('four exact wins make the champion, for EVERY team of the bank, with 70 500 + goals', () => {
    for (const humanId of BANK_IDS) {
      const wc = createWorldCup(BANK_IDS, humanId, 5, createRng(5));
      const sizes: number[] = [];
      for (let i = 0; i < 4; i++) {
        expect(wc.status).toBe('playing');
        sizes.push(wc.entrants.length);
        expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
        playRound(wc, 2, 0, true);
        expect(checkWorldCupBracket(wc, BANK_IDS)).toEqual([]);
      }
      expect(sizes).toEqual([16, 8, 4, 2]);
      expect(wc.status).toBe('champion');
      expect(wc.round).toBe('final');
      expect(wc.score).toBe(PERFECT_BASE_SCORE + 8 * SCORE_GOAL);
      expect(wc.resultCount).toBe(15);
    }
  });
```

9. En el segundo `it` de ese describe (`the winners of a round are exactly the next round's entrants`), cambia el final:

```ts
    expect(wc.entrants).toEqual(expected);
    expect(wc.round).toBe('quarters');
    expect(currentDifficulty(wc)).toBe(4);
```

10. En el tercero (`a level match decided on penalties…`):

```ts
    expect(wc.score).toBe(SCORE_WIN + SCORE_CLEAN_SHEET + ROUND_BONUS['round-16']);
```

11. En `it('every transition is a no-op on a champion', …)`, cambia `for (let i = 0; i < 3; i++)` por `for (let i = 0; i < 4; i++)`.

12. En `describe('losing and abandoning', …)`: en el primer `it`, `expect(c.resultCount).toBe(4);` → `toBe(8);` **y (H7) `expect(c.results[3].winner)` → `expect(c.results[7].winner)`**. Con dieciséis equipos hay **siete** pares de CPU antes del humano, así que el resultado del humano pasa del índice 3 al **7**; `results[3]` es ahora un resultado de CPU, que `playRound` resuelve siempre con `winner = 0`, y con la semilla del test (`belgica`, 12) **el aserto pasaría por casualidad** (`humanSideInPair(c) === 1` hace que el valor esperado sea también 0). Dejarlo así sería un test que ya no comprueba lo que dice. En el segundo (`points from earlier rounds survive an elimination`), `expect(wc.round).toBe('semis');` → `toBe('quarters');`. En el tercero (`abandonHumanMatch …`), `expect(wc.resultCount).toBe(4);` → `toBe(8);`.

13. En `describe('checkWorldCupBracket', …)`, en `it('rejects entrants of the wrong size for the round, …')` cambia `wrongSize.round = 'semis';` por `wrongSize.round = 'quarters';` (con 16 entrantes y la ronda de cuartos, que espera 8, sigue siendo tamaño equivocado).

- [ ] **Step 1b: `mode.test.ts` — la primera ronda y la progresión de dificultad (H3)**

`mode.ts` **no cambia** (lee las tablas), pero su test cita el Mundial de ocho en dos sitios. En `components/games/football-logic/mode.test.ts`, `describe('the World Cup mode', …)`:

1. En `it('builds the same bracket as calling world-cup.ts with the derived draw stream', …)`:

```ts
    expect(modeDifficulty(m)).toBe(3);
```
```ts
    expect(modeMatchLabel(m)).toBe('OCTAVOS DE FINAL');
```
(el resto del `it` no cambia: compara `wc.bracket` con `direct.bracket` y usa índices relativos.)

2. Sustituye el `it('three wins through modeEndMatch make the champion: …')` **entero** por:

```ts
  it('four wins through modeEndMatch make the champion: difficulty 3 -> 4 -> 6 -> 8, victory screen only in the final, for EVERY team', () => {
    for (const humanId of BANK_IDS) {
      const m = createWorldCupMode(BANK_IDS, humanId, 5);
      const difficulties: number[] = [];
      const screens: boolean[] = [];
      for (let i = 0; i < 4; i++) {
        difficulties.push(modeDifficulty(m));
        screens.push(modeVictoryScreen(m));
        resolveCpuPairs(m);
        modeEndMatch(m, humanWorldCupMatch(m, 2, 0, true));
      }
      expect(difficulties).toEqual([3, 4, 6, 8]);
      expect(screens).toEqual([false, false, false, true]);
      expect(modeStatus(m)).toBe('champion');
      expect(modeScore(m)).toBe(70_500 + 8_000);
      expect(modeVictoryTeamId(m, humanWorldCupMatch(m, 2, 0, true))).toBe(humanId);
    }
  });
```
> Cuatro rondas a 2-0 son **ocho** goles: `PERFECT_BASE_SCORE` (70 500) + 8 × `SCORE_GOAL`. El número de tests del fichero **no cambia**: son ediciones dentro de dos `it` existentes.
>
> `resolveCpuPairs(m)` ahora resuelve **siete** cruces en la primera ronda en vez de tres; es un helper del propio test y no necesita cambios (ya recorre `nextCpuPair`). Si al ejecutar aparece algún otro aserto acoplado a la primera ronda, arréglalo aquí y **anótalo en el progress**: no lo dejes para otra tarea.

- [ ] **Step 1c: `flow.test.ts` — los siete cruces y las cuatro rondas (H3)**

En `components/games/football-screen/flow.test.ts`:

1. En `describe('the bracket screen …')`, primer `it` (`offers VER by default, SALTAR to the right and back to VER on the left, and PLAY once the three CPU pairs are resolved`): cambia **solo** el título (`the three CPU pairs` → `the seven CPU pairs`) y el aserto

```ts
    expect(pairs).toBe(7);
```
**No reescribas el `it` entero aquí**: la Task V15-3-4 lo sustituye por los tres `it` de VER / SALTAR / SALTAR TODOS. Esto es únicamente quitarle el rojo que introduce el Mundial de dieciséis.

2. Sustituye el `it('a World Cup round won goes back to the bracket with the next difficulty; the final won goes to victory', …)` por su versión de cuatro rondas:

```ts
  it('a World Cup round won goes back to the bracket with the next difficulty; the final won goes to victory', () => {
    const { f, m } = start('world-cup', 2);
    flowConfirmDraw(f);
    const difficulties: number[] = [];
    for (let round = 0; round < 4; round++) {
      skipCpuPairs(f, m);
      difficulties.push(modeDifficulty(m));
      expect(flowConfirmBracket(f, m)).toBe('play');
      flowMatchOver(f, m, humanMatch(m, 2, 0, true), false);
      expect(f.phase).toBe('over');
      flowCaptionsDrained(f);
    }
    expect(difficulties).toEqual([3, 4, 6, 8]);
    expect(f.phase).toBe('victory');
    expect(modeStatus(m)).toBe('champion');
    expect(modeScore(m)).toBe(78_500);   // 70 500 + 8 goles
  });
```

- [ ] **Step 2: Verlos en rojo**

```bash
npx vitest run components/games/football-logic/world-cup.test.ts
```
Esperado: **rojo**, empezando por `does not provide an export named 'SCORE_PASS_ROUND16'`. Tras la implementación parcial verás también `expected 8 to be 16`, `expected 61000 to be 70500` y `expected { quarters: 4, … } to deeply equal { 'round-16': 3, … }`.

- [ ] **Step 3: La implementación**

En `components/games/football-logic/world-cup.ts`:

1. Cabecera y tamaño (sustituye el comentario de cabecera y la constante):

```ts
// The World Cup as pure functions over a state mutated in place: the same pattern as
// fighter-logic/tournament.ts, not the same code (spec, data model). G15-7 (v1.5):
// SIXTEEN drawn from the bank of twenty, straight knockout, FOUR matches, eliminated
// with no CONTINUE. The engine never sees this module: it produces matches, and this
// module reads winnerOf(). Everything that depends on the round lives in a
// Record<WorldCupRound, …> below, so adding a round is adding a row to each table --
// and tsc refuses a table that forgets one.
export const WORLD_CUP_SIZE = 16;

export type WorldCupRound = 'round-16' | 'quarters' | 'semis' | 'final';
```

2. Las tablas de ronda:

```ts
export const ROUND_LABELS: Readonly<Record<WorldCupRound, string>> = {
  'round-16': 'OCTAVOS DE FINAL',
  quarters: 'CUARTOS DE FINAL',
  semis: 'SEMIFINAL',
  final: 'FINAL',
};

// G9-6 / spec, extended by G15-7: 3 in the round of 16, then 4, 6 and 8. The friendly
// sits at 5 (FRIENDLY_DIFFICULTY), above the World Cup's first round on purpose.
// Numbers, not branches.
export const ROUND_DIFFICULTY: Readonly<Record<WorldCupRound, number>> = {
  'round-16': 3,
  quarters: 4,
  semis: 6,
  final: 8,
};

const NEXT_ROUND: Readonly<Record<WorldCupRound, WorldCupRound>> = {
  'round-16': 'quarters',
  quarters: 'semis',
  semis: 'final',
  final: 'final',   // unreachable: winHumanMatch returns before consulting it in the final
};

const ROUND_INDEX: Readonly<Record<WorldCupRound, number>> = { 'round-16': 0, quarters: 1, semis: 2, final: 3 };
const ROUND_ENTRANTS: Readonly<Record<WorldCupRound, number>> = { 'round-16': 16, quarters: 8, semis: 4, final: 2 };
```

3. La puntuación (G15-8):

```ts
// The scoring table of the spec (§Decisiones estructurales), extended by G15-8 with
// the round of 16. Only the World Cup scores: the friendlies never call anything here.
export const SCORE_GOAL = 1_000;
export const SCORE_WIN = 5_000;
export const SCORE_CLEAN_SHEET = 2_000;
export const SCORE_PASS_ROUND16 = 2_500;
const SCORE_PASS_QUARTERS = 5_000;
const SCORE_PASS_SEMIS = 10_000;
const SCORE_CHAMPION = 25_000;
export const ROUND_BONUS: Readonly<Record<WorldCupRound, number>> = {
  'round-16': SCORE_PASS_ROUND16,
  quarters: SCORE_PASS_QUARTERS,
  semis: SCORE_PASS_SEMIS,
  final: SCORE_CHAMPION,
};
// 4 × 5 000 + 4 × 2 000 + 2 500 + 5 000 + 10 000 + 25 000 = 70 500 (G15-8).
export const PERFECT_BASE_SCORE =
  4 * SCORE_WIN + 4 * SCORE_CLEAN_SHEET + SCORE_PASS_ROUND16 + SCORE_PASS_QUARTERS + SCORE_PASS_SEMIS + SCORE_CHAMPION;
```

4. El sorteo (renombra la función y su comentario; el cuerpo no cambia, ya va por `WORLD_CUP_SIZE`):

```ts
// G9-4 / G15-7: the human chose; fifteen of the remaining nineteen are drawn, and the
// sixteen are shuffled AGAIN so the human's slot -- and with it who is team 0 of his
// pair, who kicks first in a shootout (S-PK3) -- is drawn too. Called once per run,
// never per frame: the two copies it makes are the price of a Fisher-Yates over a
// readonly bank.
function drawEntrants(bankIds: readonly string[], humanId: string, rng: Rng): string[] {
  const others: string[] = [];
  for (const id of bankIds) if (id !== humanId) others.push(id);
  if (others.length !== bankIds.length - 1) throw new Error(`human team not in bank: ${humanId}`);
  const drawn = shuffled(others, rng).slice(0, WORLD_CUP_SIZE - 1);
  drawn.push(humanId);
  return shuffled(drawn, rng);
}
```

5. En `createWorldCup`, cambia la llamada y la ronda inicial:

```ts
  const bracket = drawEntrants(bankIds, humanId, rng);
```
```ts
  for (let i = 0; i < WORLD_CUP_SIZE - 1; i++) {
    results.push({ round: 'round-16', homeId: '', awayId: '', homeGoals: 0, awayGoals: 0, winner: 0 });
  }
  return { humanId, seed, round: 'round-16', status: 'playing', score: 0, bracket, entrants, pairWinner, resolved, results, resultCount: 0 };
```

6. En el comentario de `nextCpuPair`, cambia «the bracket screen asks VER o SALTAR for each» por «the bracket screen asks VER, SALTAR o SALTAR TODOS (G15-8) for each».

7. **Los comentarios que quedarían mintiendo (H12).** `world-cup.ts` está permitido, así que se corrigen **aquí**, no se dejan como deuda. Localiza cada uno por su texto:

| Texto de hoy (≈ línea) | Pasa a decir |
|---|---|
| `The eight in draw order` (`:30`) | `The sixteen in draw order` |
| `8 -> 4 -> 2` (`:34`) | `16 -> 8 -> 4 -> 2` |
| `Four slots created once` (`:38`) | `Eight slots created once` |
| `4 + 2 + 1 slots created once` (`:41`) | `8 + 4 + 2 + 1 slots created once` |
| `the test asserts the twelve slots of one seed` (`:87`) | `the test asserts the thirty-two slots of one seed` |

No hay nada más que tocar: `matchSeedFor`, `pairCount`, `advanceRound`, `recordResult`, `checkWorldCupBracket` y las transiciones ya son genéricas.

- [ ] **Step 4: Verlos en verde**

```bash
npx vitest run components/games/football-logic/world-cup.test.ts components/games/football-logic/mode.test.ts components/games/football-screen/flow.test.ts
```
Esperado: **los tres verdes**. `world-cup.test.ts` queda en **28** (los 27 de hoy + 1). El resto de asertos del cuadro en `flow.test.ts` son relativos (`wc.entrants[pair * 2]`) y pasan sin tocarlos; los dos que no lo eran los arregló el Step 1c. **Si queda algún rojo, NO lo dejes para la Task V15-3-4**: arréglalo aquí y anótalo en el progress.

- [ ] **Step 5: Controles negativos**

**Uno cada vez, deshaz en el acto.**
1. En `world-cup.ts`, pon `'round-16': 5_000` en `ROUND_BONUS`. → `world-cup.test.ts` **rojo**: `expected 73000 to be 70500` (y el `toEqual` de la tabla). **Deshaz.**
2. En `world-cup.ts`, pon `ROUND_INDEX['round-16'] = 1` (igual que `quarters`). → **rojo**: `expected 24 to be 32` en el test de las 32 ranuras (octavos y cuartos compartirían las ocho). **Deshaz.**
3. En `world-cup.ts`, pon `'round-16': 'semis'` en `NEXT_ROUND`. → **rojo**: `expected [16, 4, 2, …] to deeply equal [16, 8, 4, 2]` y `entrants size 8 for round semis` en `checkWorldCupBracket`. **Deshaz.**
4. Pon `WORLD_CUP_SIZE = 8`. → **rojo**: `expected 8 to be 16` y, sobre todo, `expected 4 to be 8` en `pairCount`. **Deshaz.**

- [ ] **Step 6: Gates de la tarea**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-logic/world-cup.ts components/games/football-logic/world-cup.test.ts components/games/football-logic/mode.test.ts components/games/football-screen/flow.test.ts
git diff --name-only ef61be7 -- components/games/football-logic/ | sort
git diff --stat ef61be7 -- components/games/football-logic/ai.test.ts components/games/football-logic/match.test.ts components/games/football-logic/mode.ts
grep -rn "drawEight" components lib app
grep -n "the eight in draw order\|8 -> 4 -> 2\|Four slots\|4 + 2 + 1\|twelve slots" components/games/football-logic/world-cup.ts
```
Esperado: **1356 tests en 81 ficheros verdes, sin un solo rojo** (los tres ficheros acoplados al Mundial de ocho —`world-cup.test.ts`, `mode.test.ts` y `flow.test.ts`— se arreglan **en esta tarea**). `tsc` y `eslint` sin salida; el `--name-only` con **siete** líneas (las cuatro de la Task 1 más `mode.test.ts`, `world-cup.test.ts` y `world-cup.ts`); el `--stat` **vacío** (`mode.ts` incluido: solo se tocó su test, así que **no** es un regrabado); `drawEight` **vacío**; el último `grep` **vacío** (H12).

> **Si la suite se pone roja en algún test de PARTIDO, o en `world-cup.test.ts` con una lista literal de equipos, para**: sería un regrabado y este paso lo tiene prohibido. Anótalo en `## Peticiones separadas al motor`.

- [ ] **Step 7: Cerrar — NO ejecutes `git add` ni `git commit`**

Una línea en `progress.md`:

```
V15-3-3: Mundial de 16 con ronda OCTAVOS (dificultad 3, bonus 2 500), PERFECT_BASE_SCORE 70 500, drawEntrants y los cinco comentarios de world-cup.ts al día. matchSeedFor intacta: 32 ranuras distintas comprobadas. Arreglados los tres ficheros acoplados al Mundial de ocho: world-cup.test.ts (incluidos :65, :157 y results[3] → results[7]), mode.test.ts (dificultad 3, OCTAVOS, [3,4,6,8], 70 500 + 8 000) y flow.test.ts (7 cruces y cuatro rondas). mode.ts NO se toca: no es regrabado. 1356/81 verdes SIN rojos.
```

---

### Task V15-3-4: el cuadro de ocho cruces, «SALTAR TODOS» y el sorteo de dieciséis (G15-8, puro)

**Files:**
- Modify: `components/games/football-screen/flow-layout.ts` (bloque `── Bracket …` `:48-60`; bloque `── Draw …` `:62-72`)
- Modify: `components/games/football-screen/flow-layout.test.ts` (import; `it('four bracket rows and the eight draw rows fit', …)`)
- Modify: `components/games/football-screen/flow.ts` (`MODE_BLURBS` `:65-70`; `BracketAction` `:56`; `FlowState.bracketChoice` `:79`; `flowBracketAction` `:241-244`; `flowMoveBracketChoice` `:249-253`; `flowConfirmBracket` `:258-265`)
- Modify: `components/games/football-screen/flow.test.ts` (`describe('the bracket screen …')` `:242`; el test de `MODE_BLURBS` `:85`)
- Modify: `components/games/football-screen/control-hints.ts` (`bracketChoice` dentro de `buildHints` `:56`)
- Modify: `components/games/football-screen/control-hints.test.ts` (los dos tests que citan `bracketChoice`)

**Interfaces:**
- Consumes de la Task V15-3-3: `WORLD_CUP_SIZE = 16`, `nextCpuPair` (siete pares de CPU en octavos), `ROUND_LABELS['round-16']`.
- Produces, y la Task V15-3-5 consume literalmente:
  - `flow-layout.ts`: `BRACKET_COL_ROWS = 4` · `BRACKET_COL_X: readonly [number, number] = [200, 600]` · `bracketRowY(pair: number, pairs: number): number` · `bracketColX(pair: number, pairs: number): number` · `BRACKET_BUTTON_W = 150` · `BRACKET_BUTTON_H = 34` · `BRACKET_BUTTON_GAP = 12` · `BRACKET_BUTTON_Y = 356` · `bracketButtonX(index: number): number` · `DRAW_COL_X: readonly [number, number, number, number]` · `DRAW_ROWS_PER_COL = 4` (y `drawRowY`, `drawColX` con la misma firma). **`BRACKET_ELIMINATED_Y` deja de existir.**
  - `flow.ts`: `type BracketAction = 'spectate' | 'skip' | 'skip-all' | 'play'` · `FlowState.bracketChoice: 0 | 1 | 2` · `BRACKET_CHOICE_COUNT = 3` · `MODE_BLURBS['world-cup'] = '16 SELECCIONES SORTEADAS · 4 PARTIDOS · SIN CONTINUE · PUNTÚA'`
  - `control-hints.ts`: `CONTROL_HINTS[scheme].bracketChoice = 'IZQ / DER: VER · SALTAR · TODOS · A (<tecla>) CONFIRMA'`

**Contexto que el ejecutor no tiene:**
- **Por qué `bracketRowY` gana un segundo argumento.** El cuadro enseña **solo la ronda actual** (G15-8), y la ronda actual tiene 8, 4, 2 o 1 cruces. Con 8 van en dos columnas de cuatro; con 4 o menos, en **una** columna centrada, que es como se ve hoy y como tiene que verse una semifinal. Meter esa regla en el `.tsx` sería una fórmula sin test (Global Constraints), así que va aquí: `bracketRowY(pair, pairs)` y `bracketColX(pair, pairs)`.
- **Las cuentas de la pantalla, con el canvas de 800 × 500.** Cuatro filas de 40 desde 96 → la última acaba en 256, muy por encima del prompt (330). Columnas centradas en 200 y 600: el cruce más largo posible es `ESTADOS UNIDOS 2 - 1 COREA DEL SUR` — **33 caracteres** (H11: `14 + 1 + 1 + 3 + 1 + 13`, con `BRACKET_VS = ' VS '`, `BRACKET_SCORE_SEP = ' - '` y `smallNumber` de un dígito) a `bold 18px monospace` ≈ 10,8 px/carácter ≈ **356 px** (±178), así que centrado en 200 ocupa 22-378 y centrado en 600 ocupa 422-778. Cabe, y con holgura. **Por eso la Task V15-3-5 pinta las filas del cuadro con `FONT_TEAM` (18 px) y no con `FONT_MENU_ITEM` (22 px), con el que 33 caracteres serían ≈ 435 px y se saldrían de la columna.** El aserto del test (`BRACKET_COL_X[0] - 184 > 0`, `BRACKET_COL_X[1] + 184 < 800` → 16 y 784) se deja tal cual: cubre los 178 reales con margen.
- **Los tres botones.** 3 × 150 + 2 × 12 = 474, centrados → x en 163, 325 y 487; `SALTAR TODOS` son 12 caracteres a 18 px ≈ 130 px, dentro de los 150.
- **Por qué desaparece la línea ELIMINADOS, y qué la sustituye.** Con ocho equipos la lista cabía; con dieciséis, al llegar a la final son catorce nombres (≈ 180 caracteres ≈ 1 300 px a 12 px) y se sale del canvas tres veces. G15-8 dice que el cuadro enseña **solo la ronda actual**, así que la línea se retira en vez de truncarla. **Paco lo resolvió el 23-sep (resolución (b)): no hay línea ELIMINADOS ni contador «QUEDAN N»; el perdedor de un cruce ya resuelto se dibuja atenuado dentro de su propio cruce.** Eso lo implementa la Task V15-3-5 (`bracketRowLoser` + `DIM_TEXT`); aquí solo desaparece `BRACKET_ELIMINATED_Y`.
- **`flowMoveBracketChoice` deja de ser «izquierda = 0, derecha = 1» y pasa a ser un cursor de tres con tope.** Sigue siendo **direccional** (la decisión del cierre de la v1: repetir la misma dirección no hace ping-pong), pero ahora un paso a la derecha desde SALTAR lleva a SALTAR TODOS y otro más se queda ahí. El test de hoy («right, right stays SALTAR») dice lo contrario y **se reescribe**, no se borra.
- **Qué hace `'skip-all'` y qué NO.** La fase **no** cambia: el componente resuelve los pares de CPU que queden, uno tras otro, en cabeza (`skipCpuPair` en bucle, Task V15-3-5) y se queda en el cuadro. No es una fase nueva y no toca `world-cup.ts`: cada par se resuelve por la misma `resolveCpuMatch` que el SALTAR de uno, con la **misma semilla**, así que el resultado de saltar todos es idéntico al de saltarlos de uno en uno.

- [ ] **Step 1: Escribir los tests en rojo**

1. En `components/games/football-screen/flow-layout.test.ts`, añade al import `BRACKET_BUTTON_GAP, BRACKET_BUTTON_H, BRACKET_BUTTON_W, BRACKET_BUTTON_Y, BRACKET_COL_ROWS, BRACKET_COL_X, BRACKET_PROMPT_Y, bracketButtonX, bracketColX` y sustituye el `it('four bracket rows and the eight draw rows fit', …)` por:

```ts
  it('eight bracket crosses fit in two columns of four, and fewer than five in one centred column (G15-8)', () => {
    expect(BRACKET_COL_ROWS).toBe(4);
    expect(bracketRowY(0, 8)).toBe(BRACKET_ROW_TOP);
    expect(bracketRowY(3, 8)).toBe(BRACKET_ROW_TOP + 3 * BRACKET_ROW_H);
    expect(bracketRowY(4, 8)).toBe(BRACKET_ROW_TOP);            // second column starts again at the top
    expect(bracketRowY(7, 8)).toBe(BRACKET_ROW_TOP + 3 * BRACKET_ROW_H);
    expect(bracketRowY(7, 8) + BRACKET_ROW_H).toBeLessThan(BRACKET_PROMPT_Y);
    expect(bracketColX(0, 8)).toBe(BRACKET_COL_X[0]);
    expect(bracketColX(4, 8)).toBe(BRACKET_COL_X[1]);
    // Quarters (4), semis (2) and the final (1): one centred column.
    expect(bracketColX(0, 4)).toBe(VIEW_W / 2);
    expect(bracketColX(3, 4)).toBe(VIEW_W / 2);
    expect(bracketRowY(3, 4)).toBe(BRACKET_ROW_TOP + 3 * BRACKET_ROW_H);
    expect(bracketColX(0, 1)).toBe(VIEW_W / 2);
    expect(bracketRowY(0, 1)).toBe(BRACKET_ROW_TOP);
    // A 356 px cross (the longest possible pair at bold 18px monospace, 33 chars) fits either column.
    expect(BRACKET_COL_X[0] - 184).toBeGreaterThan(0);
    expect(BRACKET_COL_X[1] + 184).toBeLessThan(VIEW_W);
  });

  it('the three bracket buttons fit under the prompt and above the hint (G15-8: SALTAR TODOS)', () => {
    expect(BRACKET_BUTTON_Y).toBeGreaterThan(BRACKET_PROMPT_Y);
    expect(bracketButtonX(0)).toBe((VIEW_W - (3 * BRACKET_BUTTON_W + 2 * BRACKET_BUTTON_GAP)) / 2);
    expect(bracketButtonX(1)).toBe(bracketButtonX(0) + BRACKET_BUTTON_W + BRACKET_BUTTON_GAP);
    expect(bracketButtonX(2) + BRACKET_BUTTON_W).toBe(VIEW_W - bracketButtonX(0));
    expect(bracketButtonX(0)).toBeGreaterThan(0);
    expect(BRACKET_BUTTON_Y + BRACKET_BUTTON_H).toBeLessThan(BRACKET_HINT_Y - 8);
  });

  it('the sixteen drawn teams fit in four columns of four', () => {
    expect(drawRowY(3)).toBe(drawRowY(7));
    expect(drawRowY(3)).toBe(drawRowY(15));
    expect(drawColX(0)).toBe(DRAW_COL_X[0]);
    expect(drawColX(4)).toBe(DRAW_COL_X[1]);
    expect(drawColX(8)).toBe(DRAW_COL_X[2]);
    expect(drawColX(15)).toBe(DRAW_COL_X[3]);
    for (let i = 0; i < 4; i++) {
      expect(DRAW_COL_X[i] - 80).toBeGreaterThan(0);
      expect(DRAW_COL_X[i] + 80).toBeLessThan(VIEW_W);
    }
    expect(drawRowY(15) + DRAW_ROW_H).toBeLessThan(VIEW_H - 40);
    expect(VICTORY_HINT_Y).toBeLessThan(VIEW_H);
  });
```
(añade también `BRACKET_HINT_Y` y `DRAW_ROW_H` al import si no están).

2. En `components/games/football-screen/flow.test.ts`, en `describe('the mode selector', …)`, al primer `it`, tras el bucle de `MODE_BLURBS`, añade:

```ts
    expect(MODE_BLURBS['world-cup']).toBe('16 SELECCIONES SORTEADAS · 4 PARTIDOS · SIN CONTINUE · PUNTÚA');
```

3. En el mismo fichero, sustituye los dos primeros `it` de `describe('the bracket screen …')` por estos tres:

```ts
  it('offers VER by default, walks to SALTAR and SALTAR TODOS to the right, and PLAY once the seven CPU pairs are resolved', () => {
    const { f, m } = start('world-cup', 1);
    flowConfirmDraw(f);
    expect(flowBracketAction(f, m)).toBe('spectate');
    flowMoveBracketChoice(f, 1);
    expect(flowBracketAction(f, m)).toBe('skip');
    flowMoveBracketChoice(f, 1);
    expect(flowBracketAction(f, m)).toBe('skip-all');
    flowMoveBracketChoice(f, -1);
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
    expect(pairs).toBe(7);
    expect(flowCpuPair(m)).toBe(-1);
    expect(flowConfirmBracket(f, m)).toBe('play');
    expect(f.phase).toBe('match');
  });

  it('is directional with a stop at each end: repeating a direction never wraps round', () => {
    const { f, m } = start('world-cup', 1);
    flowConfirmDraw(f);
    expect(BRACKET_CHOICE_COUNT).toBe(3);
    flowMoveBracketChoice(f, -1);
    flowMoveBracketChoice(f, -1);
    expect(flowBracketAction(f, m)).toBe('spectate');   // left on VER stays VER
    flowMoveBracketChoice(f, 1);
    flowMoveBracketChoice(f, 1);
    flowMoveBracketChoice(f, 1);
    flowMoveBracketChoice(f, 1);
    expect(flowBracketAction(f, m)).toBe('skip-all');   // and it never comes back round to VER
    flowMoveBracketChoice(f, 0);
    expect(flowBracketAction(f, m)).toBe('skip-all');   // a zero delta does nothing
  });

  it('SALTAR TODOS is an action of the bracket and leaves the flow ON the bracket (the component resolves the rest)', () => {
    const { f, m } = start('world-cup', 1);
    flowConfirmDraw(f);
    flowMoveBracketChoice(f, 1);
    flowMoveBracketChoice(f, 1);
    expect(flowConfirmBracket(f, m)).toBe('skip-all');
    expect(f.phase).toBe('bracket');
    // And the choice survives: the player asked for all of them, not for one.
    expect(flowBracketAction(f, m)).toBe('skip-all');
  });
```
Añade `BRACKET_CHOICE_COUNT` al import de `./flow`.

4. En `components/games/football-screen/control-hints.test.ts`, en el test `keeps the step-8 wording for Flechas, word for word`, cambia la línea de `bracketChoice`:

```ts
    expect(h.bracketChoice).toBe('IZQ / DER: VER · SALTAR · TODOS · A (J) CONFIRMA');
```
Y añade un test al final del `describe`:

```ts
  it('the bracket hint names the three choices of G15-8, in the order they are drawn', () => {
    for (const scheme of KEY_SCHEMES) {
      const text = CONTROL_HINTS[scheme].bracketChoice;
      expect(text.indexOf('VER')).toBeGreaterThanOrEqual(0);
      expect(text.indexOf('SALTAR')).toBeGreaterThan(text.indexOf('VER'));
      expect(text.indexOf('TODOS')).toBeGreaterThan(text.indexOf('SALTAR'));
    }
    expect(CONTROL_HINTS.classic.bracketChoice).toContain('(Z)');
  });
```

- [ ] **Step 2: Verlos en rojo**

```bash
npx vitest run components/games/football-screen/flow-layout.test.ts components/games/football-screen/flow.test.ts components/games/football-screen/control-hints.test.ts
```
Esperado: **rojo** en los tres: `does not provide an export named 'BRACKET_COL_ROWS'`, `does not provide an export named 'BRACKET_CHOICE_COUNT'` y `expected 'IZQ / DER · A (J) CONFIRMA' to be 'IZQ / DER: VER · SALTAR · TODOS · A (J) CONFIRMA'`.

- [ ] **Step 3: La geometría (`flow-layout.ts`)**

Sustituye los bloques `── Bracket …` y `── Draw …` por:

```ts
// ── Bracket: the CURRENT round's crosses, then the prompt and the buttons ───────
// G15-8: eight crosses in two columns of four. Four or fewer (quarters, semis, the
// final) go in ONE centred column, which is how it has always looked. The rule lives
// here and not in the .tsx: a formula in draw() is a formula with no test.
export const BRACKET_ROW_TOP = 96;
export const BRACKET_ROW_H = 40;
export const BRACKET_COL_ROWS = 4;
export const BRACKET_COL_X: readonly [number, number] = [200, 600];
export const BRACKET_PROMPT_Y = 330;
// VER | SALTAR | SALTAR TODOS: 3 * 150 + 2 * 12 = 474, centred -> 163, 325, 487.
export const BRACKET_BUTTON_W = 150;
export const BRACKET_BUTTON_H = 34;
export const BRACKET_BUTTON_GAP = 12;
export const BRACKET_BUTTON_Y = BRACKET_PROMPT_Y + 26;
export const BRACKET_HINT_Y = 470;

function bracketRowsPerColumn(pairs: number): number {
  return pairs > BRACKET_COL_ROWS ? BRACKET_COL_ROWS : pairs;
}

export function bracketRowY(pair: number, pairs: number): number {
  return BRACKET_ROW_TOP + (pair % bracketRowsPerColumn(pairs)) * BRACKET_ROW_H;
}

export function bracketColX(pair: number, pairs: number): number {
  if (pairs <= BRACKET_COL_ROWS) return VIEW_W / 2;
  return BRACKET_COL_X[pair < BRACKET_COL_ROWS ? 0 : 1];
}

export function bracketButtonX(index: number): number {
  const total = 3 * BRACKET_BUTTON_W + 2 * BRACKET_BUTTON_GAP;
  return (VIEW_W - total) / 2 + index * (BRACKET_BUTTON_W + BRACKET_BUTTON_GAP);
}

// ── Draw: the sixteen in four columns of four (G15-7) ───────────────────────────
export const DRAW_ROW_TOP = 120;
export const DRAW_ROW_H = 36;
export const DRAW_ROWS_PER_COL = 4;
export const DRAW_COL_X: readonly [number, number, number, number] = [100, 300, 500, 700];

export function drawRowY(index: number): number {
  return DRAW_ROW_TOP + (index % DRAW_ROWS_PER_COL) * DRAW_ROW_H;
}

export function drawColX(index: number): number {
  return DRAW_COL_X[Math.floor(index / DRAW_ROWS_PER_COL)];
}
```
**Borra `export const BRACKET_ELIMINATED_Y = 400;`** (ya no hay línea de eliminados).

- [ ] **Step 4: El flujo (`flow.ts`)**

1. `MODE_BLURBS['world-cup']`:

```ts
  'world-cup': '16 SELECCIONES SORTEADAS · 4 PARTIDOS · SIN CONTINUE · PUNTÚA',
```

2. La acción y el cursor de tres (sustituye `export type BracketAction = 'spectate' | 'skip' | 'play';`):

```ts
// G15-8 adds SALTAR TODOS: the same resolution as SALTAR, for every CPU pair left.
export type BracketAction = 'spectate' | 'skip' | 'skip-all' | 'play';
export const BRACKET_CHOICE_COUNT = 3;
```

3. En `FlowState`, cambia el campo:

```ts
  bracketChoice: 0 | 1 | 2;     // 0 = VER, 1 = SALTAR, 2 = SALTAR TODOS (G15-8)
```

4. `flowBracketAction` y `flowMoveBracketChoice`:

```ts
export function flowBracketAction(f: FlowState, m: GameMode): BracketAction {
  if (flowCpuPair(m) === -1) return 'play';
  if (f.bracketChoice === 0) return 'spectate';
  return f.bracketChoice === 1 ? 'skip' : 'skip-all';
}

// Directional with a stop at each end (the decision of the v1 fix wave, extended by
// G15-8 to three): a repeated press in the same direction leaves the choice where it
// is instead of wrapping round to VER.
export function flowMoveBracketChoice(f: FlowState, delta: number): void {
  if (f.phase !== 'bracket' || delta === 0) return;
  if (delta < 0) {
    if (f.bracketChoice === 2) f.bracketChoice = 1;
    else if (f.bracketChoice === 1) f.bracketChoice = 0;
    return;
  }
  if (f.bracketChoice === 0) f.bracketChoice = 1;
  else if (f.bracketChoice === 1) f.bracketChoice = 2;
}
```
> Dos escaleras de `if` y no `Math.min/Math.max`: `bracketChoice` es el tipo literal `0 | 1 | 2` y un `Math.min(...)` devuelve `number`, que `tsc` rechaza sin un `as`. Las Global Constraints prohíben `as` nuevos.

5. `flowConfirmBracket` — añade la rama que **no** cambia de fase:

```ts
export function flowConfirmBracket(f: FlowState, m: GameMode): BracketAction | 'none' {
  if (f.phase !== 'bracket') return 'none';
  const action = flowBracketAction(f, m);
  if (action === 'spectate') f.phase = 'spectate';
  else if (action === 'play') f.phase = 'match';
  // 'skip' and 'skip-all' stay on the bracket: the component resolves the pair (or
  // every pair left) headless and refreshes the screen.
  return action;
}
```

- [ ] **Step 4b: Los comentarios de `flow.ts` que quedarían mintiendo (H12)**

`flow.ts` está permitido y esta tarea ya lo toca, así que se corrigen aquí:

| Texto de hoy (≈ línea) | Pasa a decir |
|---|---|
| `the sixteen, with the formation selector` (`:17`) | `the twenty, with the formation selector` |
| `the World Cup's eight, drawn` (`:18`) | `the World Cup's sixteen, drawn` |

(El tercero, «A 4-column grid over the bank» de `:152`, lo corrigió la Task V15-3-2.)

- [ ] **Step 5: El texto (`control-hints.ts`)**

En `buildHints`, sustituye la línea de `bracketChoice`:

```ts
    bracketChoice: `IZQ / DER: VER · SALTAR · TODOS · A (${a}) CONFIRMA`,
```

- [ ] **Step 6: Verlos en verde**

```bash
npx vitest run components/games/football-screen/
npx tsc --noEmit
```
Esperado: los tests de `football-screen/` **verdes**; `tsc` **rojo** en `VaultWorldCupGame.tsx` con `TS2554: Expected 2 arguments, but got 1` en `bracketRowY(p)` y `TS2305`/`TS2339` por `BRACKET_ELIMINATED_Y`. **Es el rojo intencionado que cierra la Task V15-3-5**; no lo arregles aquí.

- [ ] **Step 7: Controles negativos**

**Uno cada vez, deshaz en el acto.**
1. En `flow.ts`, haz que `flowMoveBracketChoice` con `delta > 0` desde 2 vuelva a 0. → `flow.test.ts` **rojo**: `expected 'spectate' to be 'skip-all'` en el test direccional. **Deshaz.**
2. En `flow.ts`, haz que `flowConfirmBracket` ponga `f.phase = 'match'` también para `'skip-all'`. → **rojo**: `expected 'match' to be 'bracket'`. **Deshaz.**
3. En `flow-layout.ts`, pon `BRACKET_COL_X = [200, 700]`. → `flow-layout.test.ts` **rojo**: `expected 884 to be less than 800`. **Deshaz.**
4. En `flow-layout.ts`, haz que `bracketColX` devuelva siempre `BRACKET_COL_X[pair < 4 ? 0 : 1]`. → **rojo**: `expected 200 to be 400` (una semifinal saldría descentrada). **Deshaz.**

- [ ] **Step 8: Gates de la tarea**

```bash
npx vitest run
npx eslint components/games/football-screen/flow.ts components/games/football-screen/flow.test.ts components/games/football-screen/flow-layout.ts components/games/football-screen/flow-layout.test.ts components/games/football-screen/control-hints.ts components/games/football-screen/control-hints.test.ts
git diff --name-only ef61be7 -- components/games/football-logic/ | sort
grep -rn "BRACKET_ELIMINATED" components
grep -n "the sixteen, with the formation\|World Cup's eight" components/games/football-screen/flow.ts
```
Esperado: **1360 tests en 81 ficheros verdes** (vitest no compila el `.tsx`, así que la suite está verde aunque `tsc` no); `eslint` sin salida; el `--name-only` con las **siete** líneas de la Task 3; el `grep` de `BRACKET_ELIMINATED` encuentra `BRACKET_ELIMINATED_PREFIX`/`bracketEliminated` **solo** en `VaultWorldCupGame.tsx` (lo borra la Task 5); el último `grep` **vacío**.

- [ ] **Step 9: Cerrar — NO ejecutes `git add` ni `git commit`**

```
V15-3-4: cuadro de 8 cruces en dos columnas (una centrada con 4 o menos), tres botones VER/SALTAR/SALTAR TODOS, sorteo en 4 columnas de 4, blurb del MUNDIAL a 16/4, hint con las tres opciones. Fuera BRACKET_ELIMINATED_Y (resolución (b) de Paco: sin línea ELIMINADOS y sin contador; el perdedor se atenúa en su cruce, Task 5). Comentarios de flow.ts :17 y :18 al día. 1360/81 verdes; tsc rojo a propósito en el .tsx hasta la Task 5.
```

---

### Task V15-3-5: cableado del selector 5×4, el minicampo, el sorteo de dieciséis y el cuadro nuevo (G15-7/8/9, pantalla)

**Files:**
- Modify: `components/games/VaultWorldCupGame.tsx` (imports `:20-60`; buffers del cuadro y del sorteo `:446-455`; `skipCpuPair` `:613-619`; `refreshDrawView` `:694-699`; `refreshBracketView` `:703-735`; `confirmBracket` `:737-742`; `drawTeamSelect` `:1471-1512`; `drawDraw` `:1514-1529`; `drawBracket` `:1531-1575`; `menuAction` caso `'bracket'` `:1738-1743`)
- **Ningún test cambia en esta tarea.** Su verificación es `tsc` + `eslint` + la revisión de asignaciones por frame + la suite global intacta.

**Interfaces:**
- Consumes de las Tasks V15-3-1..4: `TEAMS` (20) · `WORLD_CUP_SIZE = 16` · `pairCount` · `roundLabel` · `pairResult` · `TEAM_CARD_W/H`, `TEAM_GRID_COLS`, `formationLabelX`, `TEAM_PREVIEW_X/Y/W/H` · `previewSlotX/Y`, `previewGkX/Y`, `previewDotCount` · `bracketRowY(pair, pairs)`, `bracketColX(pair, pairs)`, `bracketButtonX`, `BRACKET_BUTTON_W/H/Y`, `DRAW_ROWS_PER_COL` · `BracketAction` con `'skip-all'` · `BRACKET_CHOICE_COUNT`.
- Produces: nada que consuma otra tarea (es cableado). La Task V15-3-9 vuelve a este mismo fichero.

**Contexto que el ejecutor no tiene:**
- **Criterio 20 en esta pantalla.** `refreshBracketView()` y `refreshDrawView()` construyen **todas** las cadenas y corren en un evento (entrar al cuadro, resolver un cruce), nunca por frame; `drawBracket`/`drawDraw`/`drawTeamSelect` solo leen índices de arrays creados al montar. Los arrays de la fila del cuadro (`bracketRowHome`, `bracketRowMid`, `bracketRowAway`, `bracketRowHomeDx`, `bracketRowAwayDx`, `bracketRowLoser`, `bracketRowIsHuman`) pasan a **8** posiciones y `drawNames` de 8 a **16**, creados **una vez** con literales (no con `new Array(…)` ni `.fill`, que serían una asignación más y además cambiarían de estilo). **`ctx.measureText` también vive en `refreshBracketView`**, no en `drawBracket`.
- **`smallNumber`** ya existe en el `.tsx` (convierte un número de goles en su carácter): no la toques.
- **`SALTAR TODOS` en cabeza.** `skipCpuPair()` ya hace «arranca el cruce → `finishMatchRun` → registra → refresca». Saltarlos todos es llamarlo en bucle mientras `flowCpuPair(mode) !== -1`. Con siete cruces de octavos son siete simulaciones sin dibujar; `finishMatchRun` es el mismo camino que usa el SALTAR de uno, así que **el resultado es idéntico al de saltarlos uno a uno** (misma semilla por par, `cpuMatchSeed`). El bucle lleva un tope de seguridad (`WORLD_CUP_SIZE`) por si un día `nextCpuPair` no avanzara: es un `for` acotado, no un `while (true)`.
- **El minicampo del selector.** Pinta: marco, línea de medio campo, círculo central, y `previewDotCount(formación)` puntos — el portero en verde flúor (`GK_KIT_PRIMARY`, la constante que ya existe) y los de campo en el `kit.primary` de la selección **bajo el cursor** (`TEAMS[flow.cursor]`), con un aro del `kit.secondary` para que un kit blanco no desaparezca sobre el verde. **Sin flechas de ataque** (G15-9). La formación es la del humano que está eligiendo: `FORMATIONS[flow.formation[picking]]`.
- **La fuente de las filas del cuadro baja a `FONT_TEAM`** (18 px): con `FONT_MENU_ITEM` (22 px) el cruce más largo mide 449 px y se sale de una columna de 400 (Task V15-3-4, «Contexto»).
- **La etiqueta TÚ del cuadro** ya no puede ir a `VIEW_W - 80` (con dos columnas caería sobre la de la derecha). **Va a `bracketColX(p, bracketRows) - 190` con `textAlign = 'right'`** (H10): con `+ 190` y alineación a la izquierda, en la columna derecha (600) arrancaría en 790 y `'TÚ'` a `bold 12px monospace` (≈ 14,4 px) acabaría en **≈ 804**, fuera de los 800 del canvas. A la izquierda de la fila, el borde de la etiqueta queda en 410 y en 10, dentro de las dos columnas, y a 12 px de la fila más larga (±178 desde el centro).
- **Los eliminados (resolución (b) de Paco).** No hay línea ELIMINADOS **ni contador**: el perdedor de un cruce **ya resuelto** se dibuja **atenuado dentro de su propia fila**. `refreshBracketView` calcula, además del texto, **qué lado perdió** (`bracketRowLoser[p]`: `0` = el local, `1` = el visitante, `-1` = el cruce aún no está resuelto) a partir de `wc.pairWinner[p]`, y `drawBracket` pinta el nombre del perdedor con `DIM_TEXT`. Para poder atenuar **un lado** hace falta pintar la fila en **tres** trozos (local · marcador · visitante) en vez de una sola cadena. Las tres cadenas se construyen en `refreshBracketView`, como siempre, y los **desplazamientos** respecto al centro de la columna (`bracketRowHomeDx`/`bracketRowAwayDx`) se calculan **ahí también**, con `ctx.measureText` sobre el marcador, una vez por refresco: `drawBracket` no mide nada. El criterio 20 prohíbe asignar por frame, y `measureText` devuelve un `TextMetrics` nuevo en cada llamada, así que tampoco puede estar en el dibujo.

- [ ] **Step 1: Los buffers y el estado del cuadro**

En `VaultWorldCupGame.tsx`, sustituye el bloque de `let bracketTitle = '';` … `let drawHumanIndex = -1;`:

```ts
    let bracketTitle = '';
    // Eight rows: the round of 16 is the widest the screen ever gets (G15-8). Created
    // once, with literals -- refreshBracketView writes into them on an event.
    // The row is drawn in THREE pieces (home, score, away) so the loser of a resolved
    // cross can be dimmed in place -- Paco's (b): no ELIMINADOS line, no counter.
    const bracketRowHome: string[] = ['', '', '', '', '', '', '', ''];
    const bracketRowMid: string[] = ['', '', '', '', '', '', '', ''];
    const bracketRowAway: string[] = ['', '', '', '', '', '', '', ''];
    // Offsets from the column centre, measured ONCE per refresh, never per frame.
    const bracketRowHomeDx: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    const bracketRowAwayDx: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    // 0 = the home side lost, 1 = the away side lost, -1 = the cross is not resolved.
    const bracketRowLoser: number[] = [-1, -1, -1, -1, -1, -1, -1, -1];
    const bracketRowIsHuman: boolean[] = [false, false, false, false, false, false, false, false];
    let bracketRows = 0;
    let bracketPrompt = '';
    let bracketHasChoice = false;
    const drawNames: string[] = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    let drawHumanIndex = -1;
```
(desaparece `let bracketEliminated = '';`).

Y borra las constantes que ya no se usan: `const BRACKET_ELIMINATED_PREFIX = 'ELIMINADOS: ';` y `const BRACKET_LIST_SEP = …` (busca su nombre exacto junto a `BRACKET_SCORE_SEP`); añade, junto a `BRACKET_SALTAR`:

```ts
const BRACKET_SALTAR_TODOS = 'SALTAR TODOS';
```

- [ ] **Step 2: `refreshBracketView`, `refreshDrawView`, `skipAllCpuPairs` y `confirmBracket`**

Sustituye `refreshBracketView` por:

```ts
    // Resolved once per entry to the bracket screen and once per VER/SALTAR resolution,
    // never per frame (Vault Fighter 973-1000). The strings AND their offsets are
    // built HERE -- ctx.measureText runs on the event, not on the frame.
    // G15-8: only the CURRENT round is shown, so there is no ELIMINADOS line any more
    // -- with sixteen teams it would be fourteen names by the final and would not fit.
    // Paco's (b): the loser of a resolved cross is DIMMED in its own row instead.
    function refreshBracketView(): void {
      const wc = modeBracket(mode);
      if (wc === null) return;
      bracketTitle = BRACKET_TITLE_PREFIX + roundLabel(wc);
      bracketRows = pairCount(wc);
      const human = humanPairIndex(wc);
      ctx.font = FONT_TEAM;
      for (let p = 0; p < bracketRows; p++) {
        const homeName = teamOf(pairHomeId(wc, p)).name;
        const awayName = teamOf(pairAwayId(wc, p)).name;
        bracketRowIsHuman[p] = p === human;
        bracketRowHome[p] = homeName;
        bracketRowAway[p] = awayName;
        const res = wc.resolved[p] ? pairResult(wc, p) : null;
        if (res === null) {
          bracketRowMid[p] = BRACKET_VS;
          bracketRowLoser[p] = -1;
        } else {
          bracketRowMid[p] = ' ' + smallNumber(res.homeGoals) + BRACKET_SCORE_SEP + smallNumber(res.awayGoals) + ' ';
          bracketRowLoser[p] = res.winner === 0 ? 1 : 0;
        }
        // The three pieces are laid out around the column centre: home ends where the
        // middle starts, away starts where it ends. Measured here, ONCE.
        const midW = ctx.measureText(bracketRowMid[p]).width;
        bracketRowHomeDx[p] = -midW / 2;
        bracketRowAwayDx[p] = midW / 2;
      }
      const pair = flowCpuPair(mode);
      bracketHasChoice = pair !== -1;
      bracketPrompt = pair === -1
        ? BRACKET_YOURS_PREFIX + teamOf(modeHomeId(mode)).name + BRACKET_VS + teamOf(modeAwayId(mode)).name
        : BRACKET_NEXT_PREFIX + teamOf(pairHomeId(wc, pair)).name + BRACKET_VS + teamOf(pairAwayId(wc, pair)).name;
      reportStatus(roundLabel(wc));
    }
```

Justo debajo de `skipCpuPair`, añade:

```ts
    // G15-8: SALTAR TODOS. The same skipCpuPair as one-by-one, for every CPU pair
    // left of the round -- same seed per pair (cpuMatchSeed), so the bracket ends up
    // exactly as it would resolving them one at a time. Bounded by WORLD_CUP_SIZE
    // instead of `while (true)`: if nextCpuPair ever stopped advancing, this returns
    // rather than hanging the tab.
    function skipAllCpuPairs(): void {
      for (let i = 0; i < WORLD_CUP_SIZE; i++) {
        if (flowCpuPair(mode) === -1) return;
        skipCpuPair();
      }
    }
```

Y en `confirmBracket`, añade la rama:

```ts
    function confirmBracket(): void {
      const action = flowConfirmBracket(flow, mode);
      if (action === 'spectate') startCpuPair();
      else if (action === 'skip') skipCpuPair();
      else if (action === 'skip-all') skipAllCpuPairs();
      else if (action === 'play') startHumanMatch();
    }
```

`refreshDrawView` no cambia una línea (`wc.bracket.length` ya es 16 y `drawNames` ahora tiene 16 huecos).

- [ ] **Step 3: `drawTeamSelect` con la rejilla 5×4 y el minicampo**

Sustituye `drawTeamSelect` entera por:

```ts
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
        // G15-9: the card is 140 wide now, so the kit block narrows to 22 and the
        // name starts at x + 36 -- 98 px, enough for ESTADOS UNIDOS (14 chars of
        // bold 11px monospace is about 92 px).
        ctx.fillStyle = def.kit.primary;
        ctx.fillRect(x + 8, y + 12, 22, 34);
        ctx.fillStyle = def.kit.secondary;
        ctx.fillRect(x + 8, y + 12, 22, 6);
        ctx.font = FONT_HALF;
        ctx.textAlign = 'left';
        ctx.fillStyle = taken ? DIM_TEXT : selected ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(def.name, x + 36, y + TEAM_CARD_H / 2);
        if (taken) {
          ctx.textAlign = 'right';
          ctx.fillStyle = DIM_TEXT;
          ctx.fillText(TAKEN_TAG, x + TEAM_CARD_W - 6, y + 12);
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
        ctx.fillText(labels[i], formationLabelX(i), FORMATION_ROW_Y);
      }
      drawFormationPreview(
        FORMATIONS[flow.formation[picking]], TEAMS[flow.cursor],
        TEAM_PREVIEW_X, TEAM_PREVIEW_Y, TEAM_PREVIEW_W, TEAM_PREVIEW_H,
      );
      drawHint(two ? TEAM_HINTS_TWO[picking] : CONTROL_HINTS[flow.keyScheme].teamSolo, SELECT_HINT_Y);
    }

    // G15-9: the mini pitch. Frame, halfway line, centre circle and one dot per
    // position -- goalkeeper in the fluor green every keeper wears (G12-1), outfield
    // in the selection's own primary with a ring of its secondary so a white kit does
    // not vanish on the grass. No attack arrows (G15-9). Reused by the ALINEACIÓN
    // screen in V15-3-9, which is why it takes its rectangle as arguments.
    function drawFormationPreview(f: Formation, def: TeamDef, x: number, y: number, w: number, h: number): void {
      ctx.fillStyle = GRASS_DARK;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w / 2, y + h);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, h / 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = GK_KIT_PRIMARY;
      ctx.beginPath();
      ctx.arc(previewGkX(x, w), previewGkY(y, h), PREVIEW_DOT_R, 0, Math.PI * 2);
      ctx.fill();
      for (let s = 0; s < f.slots.length; s++) {
        const dx = previewSlotX(f, s, x, w);
        const dy = previewSlotY(f, s, y, h);
        ctx.fillStyle = def.kit.primary;
        ctx.beginPath();
        ctx.arc(dx, dy, PREVIEW_DOT_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = def.kit.secondary;
        ctx.beginPath();
        ctx.arc(dx, dy, PREVIEW_DOT_R, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
```
Añade, junto a las demás constantes de módulo (cerca de `MINIMAP_DOT_PLAYER`):

```ts
const PREVIEW_DOT_R = 4;
```
y `Formation` y `TeamDef` al import de tipos de `football-logic/teams` si no están ya (`TeamDef` ya lo está).

- [ ] **Step 4: `drawDraw` en cuatro columnas y `drawBracket` en dos**

```ts
    function drawDraw(): void {
      drawMenuBackground(DRAW_TITLE);
      // FONT_TEAM, not FONT_MENU_ITEM: sixteen names in four columns of 200 px.
      ctx.font = FONT_TEAM;
      for (let i = 0; i < drawNames.length; i++) {
        const you = i === drawHumanIndex;
        ctx.textAlign = 'center';
        ctx.fillStyle = you ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(drawNames[i], drawColX(i), drawRowY(i) + DRAW_ROW_H / 2);
        if (you) {
          ctx.font = FONT_SMALL;
          ctx.fillText(YOU_TAG, drawColX(i), drawRowY(i) + DRAW_ROW_H / 2 + 14);
          ctx.font = FONT_TEAM;
        }
      }
      drawHint(CONTROL_HINTS[flow.keyScheme].draw, VIEW_H - 24);
    }

    function drawBracket(): void {
      drawMenuBackground(bracketTitle);
      // FONT_TEAM: the longest possible cross is 33 chars, ~356 px at 18 px monospace,
      // which fits a 400 px column; at FONT_MENU_ITEM it would be ~435 and spill over.
      ctx.font = FONT_TEAM;
      for (let p = 0; p < bracketRows; p++) {
        const cx = bracketColX(p, bracketRows);
        const y = bracketRowY(p, bracketRows) + BRACKET_ROW_H / 2;
        const live = bracketRowIsHuman[p] ? HUD_ACCENT : HUD_TEXT;
        // Paco's (b): once a cross is resolved, the side that went out stays in its
        // own row, dimmed. No ELIMINADOS line, no "QUEDAN N" counter.
        ctx.textAlign = 'right';
        ctx.fillStyle = bracketRowLoser[p] === 0 ? DIM_TEXT : live;
        ctx.fillText(bracketRowHome[p], cx + bracketRowHomeDx[p], y);
        ctx.textAlign = 'center';
        ctx.fillStyle = live;
        ctx.fillText(bracketRowMid[p], cx, y);
        ctx.textAlign = 'left';
        ctx.fillStyle = bracketRowLoser[p] === 1 ? DIM_TEXT : live;
        ctx.fillText(bracketRowAway[p], cx + bracketRowAwayDx[p], y);
        if (bracketRowIsHuman[p]) {
          // To the LEFT of the row and right-aligned: at cx + 190 on the right-hand
          // column (600) the tag would start at 790 and run past the 800 px canvas.
          ctx.font = FONT_SMALL;
          ctx.textAlign = 'right';
          ctx.fillStyle = HUD_ACCENT;
          ctx.fillText(YOU_TAG, cx - 190, y);
          ctx.font = FONT_TEAM;
        }
      }
      ctx.font = FONT_TEAM;
      ctx.textAlign = 'center';
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(bracketPrompt, VIEW_W / 2, BRACKET_PROMPT_Y);
      if (bracketHasChoice) {
        // VER | SALTAR | SALTAR TODOS, the selected one boxed (G9-3, G15-8).
        for (let i = 0; i < BRACKET_CHOICE_COUNT; i++) {
          const x = bracketButtonX(i);
          const selected = flow.bracketChoice === i;
          ctx.fillStyle = CARD_BG;
          ctx.fillRect(x, BRACKET_BUTTON_Y, BRACKET_BUTTON_W, BRACKET_BUTTON_H);
          ctx.strokeStyle = selected ? HUD_ACCENT : CARD_BORDER;
          ctx.lineWidth = selected ? 3 : 1;
          ctx.strokeRect(x, BRACKET_BUTTON_Y, BRACKET_BUTTON_W, BRACKET_BUTTON_H);
          ctx.fillStyle = selected ? HUD_ACCENT : HUD_TEXT;
          ctx.fillText(
            i === 0 ? BRACKET_VER : i === 1 ? BRACKET_SALTAR : BRACKET_SALTAR_TODOS,
            x + BRACKET_BUTTON_W / 2, BRACKET_BUTTON_Y + BRACKET_BUTTON_H / 2,
          );
        }
      }
      drawHint(bracketHasChoice ? CONTROL_HINTS[flow.keyScheme].bracketChoice : CONTROL_HINTS[flow.keyScheme].bracketPlay, BRACKET_HINT_Y);
    }
```

- [ ] **Step 5: Imports**

Ajusta los imports de `./football-screen/flow-layout` (fuera `BRACKET_ELIMINATED_Y`; dentro `BRACKET_BUTTON_H`, `BRACKET_BUTTON_W`, `BRACKET_BUTTON_Y`, `bracketButtonX`, `bracketColX`, `formationLabelX`, `TEAM_PREVIEW_H`, `TEAM_PREVIEW_W`, `TEAM_PREVIEW_X`, `TEAM_PREVIEW_Y`), añade `import { previewGkX, previewGkY, previewSlotX, previewSlotY } from './football-screen/formation-preview';` en el sitio alfabético que le toque, `BRACKET_CHOICE_COUNT` al import de `./football-screen/flow` y `WORLD_CUP_SIZE` al de `./football-logic/world-cup`.

**Y en el import de `./football-logic/world-cup`, FUERA: `isStillIn` (H6).** Su **única** utilización (`:725`) vive dentro del bloque de `fallen`/`bracketEliminated` que el Step 2 de esta tarea elimina, y `tsc` no lo ve (`noUnusedLocals` no está en `tsconfig.json`), pero `eslint` sí: `19:52 warning 'isStillIn' is defined but never used @typescript-eslint/no-unused-vars`, y la compuerta de esta tarea dice «`eslint` sin salida». (Los otros tres huérfanos — `BRACKET_ELIMINATED_PREFIX`, `BRACKET_LIST_SEP` y el `prefer-const` de `bracketEliminated` — ya los borran los Steps 1 y 2.)

> `previewDotCount` **no** se importa: `drawFormationPreview` recorre `f.slots` y pinta el portero aparte, que es la misma cuenta. (El export existe para la pantalla ALINEACIÓN y para el test anti-acoplamiento.)

- [ ] **Step 6: `menuAction` — SALTAR TODOS ya funciona sin tocar nada**

Comprueba que el caso `'bracket'` de `menuAction` sigue siendo:

```ts
        case 'bracket':
          if (k === 'left') flowMoveBracketChoice(flow, -1);
          else if (k === 'right') flowMoveBracketChoice(flow, 1);
          else if (k === 'a') confirmBracket();
          else return false;
          return true;
```
No cambia: el cursor de tres y la acción nueva viven en `flow.ts` y en `confirmBracket`. **Si lo cambias, lo estás duplicando.**

- [ ] **Step 7: Verificar**

```bash
npx tsc --noEmit
npx vitest run
npx eslint components/games/VaultWorldCupGame.tsx
```
Esperado: `tsc` **sin salida** (se cierra el rojo intencionado de la Task 4); **1360 tests en 81 ficheros verdes**; `eslint` sin salida.

- [ ] **Step 8: Revisión de asignaciones por frame (criterio 20)**

```bash
git diff ef61be7 -- components/games/VaultWorldCupGame.tsx
```
Comprueba, una por una:
1. En `drawTeamSelect`, `drawFormationPreview`, `drawDraw` y `drawBracket` no hay `new`, ni literales de objeto/array, ni plantillas ni concatenaciones de string, ni `.map(`/`.filter(`/`.slice(`, ni `=>` nuevos, **ni un solo `ctx.measureText`** (vive en `refreshBracketView`).
2. Toda concatenación de nombres sigue viviendo en `refreshBracketView`/`refreshDrawView`.
3. `bracketRowHome`, `bracketRowMid`, `bracketRowAway`, `bracketRowHomeDx`, `bracketRowAwayDx`, `bracketRowLoser`, `bracketRowIsHuman` y `drawNames` se crean **una vez**, con literales, en el bloque de «Everything below is created ONCE».
4. `skipAllCpuPairs` tiene tope `WORLD_CUP_SIZE` y no es un `while (true)`.
5. No queda ninguna referencia a `bracketEliminated`, `BRACKET_ELIMINATED_PREFIX`, `BRACKET_LIST_SEP`, `BRACKET_ELIMINATED_Y` ni `bracketRowText`.
6. **`isStillIn` ya NO está en el import de `world-cup`** (H6): `npx eslint components/games/VaultWorldCupGame.tsx` sin salida lo confirma, y `grep -n "isStillIn" components/games/VaultWorldCupGame.tsx` sale **vacío**.
7. La etiqueta `YOU_TAG` va a `cx - 190` con `textAlign = 'right'` (H10), y el perdedor de un cruce resuelto sale en `DIM_TEXT` dentro de su fila (resolución (b) de Paco).

- [ ] **Step 9: Cerrar — NO ejecutes `git add` ni `git commit`**

```
V15-3-5: .tsx cableado — rejilla 5×4 con tarjetas de 140×62 y nombre en x+36, minicampo de formación a la derecha de la fila ALINEACIÓN, sorteo de 16 en cuatro columnas, cuadro de 8 cruces en dos columnas con FONT_TEAM, botón SALTAR TODOS (skipAllCpuPairs con tope WORLD_CUP_SIZE). Fuera la línea ELIMINADOS: el perdedor se dibuja atenuado en su propio cruce (resolución (b) de Paco). Etiqueta TÚ a la izquierda de la fila para no salirse del canvas. Import de isStillIn retirado. tsc limpio, 1360/81 verdes, sin asignaciones por frame nuevas.
```

---

### Task V15-3-6: las veinte plantillas de dieciocho — nombres inventados y dorsales fijos (G15-17 + adenda de Paco, datos del motor)

**Files:**
- Create: `components/games/football-logic/squads.ts`
- Test: `components/games/football-logic/squads.test.ts`

**Interfaces:**
- Consumes de la Task V15-3-1: `TEAMS` (20), `type TeamDef`. De hoy: `FORMATIONS`, `TEAM_SIZE`, `type Formation`, `type Role` (`./teams`).
- Produces, y la Task V15-3-7 consume literalmente:
  - `SQUAD_SIZE = 18` · `SQUAD_NAME_MAX = 12` · `SQUAD_ROLES: readonly Role[]` (18 entradas: 2 `'gk'`, 6 `'def'`, 6 `'mid'`, 4 `'fwd'`, en ese orden) · `SQUAD_NAMES: Readonly<Record<string, readonly string[]>>`
  - `squadRole(index: number): Role` · `squadNumber(index: number): number` · `squadName(teamId: string, index: number): string` · `squadRoleCount(role: Role): number` · `isSquadName(name: string): boolean`
  - `checkSquad(teamId: string, names: readonly string[]): string[]` · `checkSquads(teams: readonly TeamDef[]): string[]` · `checkSquadCoversFormations(formations: readonly Formation[]): string[]`

**Contexto que el ejecutor no tiene:**
- **Por qué 2 + 6 + 6 + 4 = 18 y no el 14 del spec (adenda de Paco, 23-sep, hallazgo H8 del pre-vuelo).** La plantilla tiene que dar titulares a **cualquiera** de las formaciones de hoy (3-3-2, 3-2-3, 4-3-1) **y** a las tres que trae V15-4 (4-4-2, 4-3-3, 5-3-2, G15-16) **dejando al menos un recambio en cada línea** — eso es lo que pide G15-17 con «reserva DEF/MED/DEL». Con la plantilla de 14 (1/5/4/4) que tenía este plan, el máximo por rol (5 def, 4 mid, 3 fwd) se **consumía entero**: en 4-4-2 no quedaba ni un medio de reserva y en 5-3-2 ni un defensa, así que `canSwap` devolvería una lista vacía para media plantilla el día que V15-4 llegara. Con 6 defensas, 6 medios y 4 delanteros sobra **uno de cada rol en las seis formaciones**, y con **dos porteros** el portero deja de ser el único jugador que no se puede cambiar (y queda cubierta la lesión del portero, G15-18). Por eso `SQUAD_ROLES` es esa tabla, por eso hay un test que la comprueba **contra las formaciones de V15-4 escritas a mano**, y por eso `checkSquadCoversFormations` **no se conforma con que la plantilla llegue**: exige una reserva de cada rol.
- **Los dorsales son el índice + 1** (G15-17: «dorsales fijos», ahora **1-18**; los dos porteros en el 1 y el 2). No hay campo `number` en los datos: escribirlo sería un dato duplicado que puede desincronizarse. `squadNumber(i) = i + 1`, y un test lo fija.
- **Los nombres son inventados y NO son futbolistas reales** (G15-17, y la resolución (f) de Paco: «inventados y al azar, con apellidos típicos del país — italiano → Federici, español → Fernández…, nunca jugadores reales»). Los **360** de abajo (20 × 18) se generaron y se comprobaron con un script al aplicar el pre-vuelo: todos en mayúsculas, una sola palabra, **máximo 11 caracteres** (el tope del formato es 12), solo letras `A-Z` más `Á É Í Ó Ú Ñ Ç Ø Å Ä Ö Ü`, **los 360 distintos entre sí**. No los cambies «para que suenen mejor» sin volver a pasar la red.
- **`squads.ts` es un fichero de DATOS y nadie del motor lo importa en este paso.** Lo consume `football-screen/lineup.ts` (Task 7) y, a través de él, el `.tsx`. Que los nombres lleguen al partido es de V15-4/V15-5 (Global Constraints, «Lo de G15-17 que NO puede existir hasta V15-4»).
- **Por qué su propia red y no `invariants.ts`.** `invariants.ts` está vetado en este paso (no es «datos»). `checkSquads` sigue **su mismo patrón**: devuelve `string[]`, `[]` cuando todo está bien, y cada problema nombra al culpable (`espana[3]: …`).

- [ ] **Step 1: Escribir el test en rojo**

Crea `components/games/football-logic/squads.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FORMATIONS, TEAMS, TEAM_SIZE, type Formation, type Role } from './teams';
import {
  SQUAD_NAMES, SQUAD_NAME_MAX, SQUAD_ROLES, SQUAD_SIZE,
  checkSquad, checkSquadCoversFormations, checkSquads, isSquadName, squadName, squadNumber, squadRole, squadRoleCount,
} from './squads';

// G15-16 / V15-4: the three eleven-a-side formations the spec already fixed. Written
// out here, NOT imported, so this test keeps guarding the squad composition before
// V15-4 exists -- and fails the day someone adds a formation the squad cannot fill.
const V15_4_FORMATIONS: readonly Formation[] = [
  {
    id: '4-4-2', name: 'NORMAL', slots: [
      { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
      { role: 'mid', x: 0.45, y: 0.15 }, { role: 'mid', x: 0.45, y: 0.38 }, { role: 'mid', x: 0.45, y: 0.62 }, { role: 'mid', x: 0.45, y: 0.85 },
      { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
    ],
  },
  {
    id: '4-3-3', name: 'OFENSIVA', slots: [
      { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
      { role: 'mid', x: 0.45, y: 0.25 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.75 },
      { role: 'fwd', x: 0.72, y: 0.2 }, { role: 'fwd', x: 0.72, y: 0.5 }, { role: 'fwd', x: 0.72, y: 0.8 },
    ],
  },
  {
    id: '5-3-2', name: 'DEFENSIVA', slots: [
      { role: 'def', x: 0.18, y: 0.12 }, { role: 'def', x: 0.18, y: 0.31 }, { role: 'def', x: 0.18, y: 0.5 }, { role: 'def', x: 0.18, y: 0.69 }, { role: 'def', x: 0.18, y: 0.88 },
      { role: 'mid', x: 0.44, y: 0.25 }, { role: 'mid', x: 0.44, y: 0.5 }, { role: 'mid', x: 0.44, y: 0.75 },
      { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
    ],
  },
];

describe('the twenty squads of eighteen (G15-17 + Paco 23-sep)', () => {
  it('checkSquads accepts the real data: one squad of eighteen per selection of the bank', () => {
    expect(checkSquads(TEAMS)).toEqual([]);
    expect(Object.keys(SQUAD_NAMES)).toHaveLength(TEAMS.length);
    for (const t of TEAMS) expect(SQUAD_NAMES[t.id]).toHaveLength(SQUAD_SIZE);
    expect(SQUAD_SIZE).toBe(18);
  });

  it('shirt numbers are the index plus one, 1 to 18, and numbers 1 and 2 are the goalkeepers (G15-17)', () => {
    expect(squadNumber(0)).toBe(1);
    expect(squadNumber(SQUAD_SIZE - 1)).toBe(18);
    expect(squadRole(0)).toBe('gk');
    expect(squadRole(1)).toBe('gk');
    for (let i = 2; i < SQUAD_SIZE; i++) expect(squadRole(i)).not.toBe('gk');
    expect(SQUAD_ROLES).toHaveLength(SQUAD_SIZE);
  });

  it('the composition is 2 keepers + 6 defenders + 6 midfielders + 4 forwards, in that order', () => {
    expect(squadRoleCount('gk')).toBe(2);
    expect(squadRoleCount('def')).toBe(6);
    expect(squadRoleCount('mid')).toBe(6);
    expect(squadRoleCount('fwd')).toBe(4);
    const roles: readonly Role[] = SQUAD_ROLES;
    expect(roles.indexOf('def')).toBe(2);
    expect(roles.indexOf('mid')).toBe(8);
    expect(roles.indexOf('fwd')).toBe(14);
  });

  it('every name is upper case, one word, at most twelve characters, and all 360 are distinct', () => {
    const seen = new Set<string>();
    let total = 0;
    for (const t of TEAMS) {
      const names = SQUAD_NAMES[t.id];
      for (const n of names) {
        expect(isSquadName(n)).toBe(true);
        expect(n).toBe(n.toUpperCase());
        expect([...n].length).toBeLessThanOrEqual(SQUAD_NAME_MAX);
        expect(seen.has(n)).toBe(false);
        seen.add(n);
        total++;
      }
    }
    expect(total).toBe(360);
    expect(seen.size).toBe(360);
  });

  it('the squad can field EVERY formation of today with a reserve to spare in every line', () => {
    expect(checkSquadCoversFormations(FORMATIONS)).toEqual([]);
    // Today: nine on the pitch, nine on the bench -- derived, never written down.
    expect(SQUAD_SIZE - TEAM_SIZE).toBe(9);
    expect(SQUAD_SIZE).toBeGreaterThan(TEAM_SIZE);
  });

  it('and EVERY eleven-a-side formation of V15-4 (G15-16), so V15-4 does not reopen this file', () => {
    expect(checkSquadCoversFormations(V15_4_FORMATIONS)).toEqual([]);
    for (const f of V15_4_FORMATIONS) expect(f.slots).toHaveLength(10);
    // The point of eighteen over fourteen (H8): 4-4-2 needs 4 midfielders and 5-3-2
    // needs 5 defenders, and BOTH must still leave someone on the bench for that line.
    expect(squadRoleCount('mid')).toBeGreaterThan(4);
    expect(squadRoleCount('def')).toBeGreaterThan(5);
    expect(squadRoleCount('gk')).toBeGreaterThan(1);   // G15-18: the keeper can be injured
  });

  it('checkSquadCoversFormations rejects a formation the squad cannot fill, and one that would leave a line with no reserve', () => {
    const sevenBacks: Formation = {
      id: '7-2-1', name: 'MURO', slots: [
        { role: 'def', x: 0.18, y: 0.08 }, { role: 'def', x: 0.18, y: 0.21 }, { role: 'def', x: 0.18, y: 0.34 }, { role: 'def', x: 0.18, y: 0.47 },
        { role: 'def', x: 0.18, y: 0.6 }, { role: 'def', x: 0.18, y: 0.73 }, { role: 'def', x: 0.18, y: 0.86 },
        { role: 'mid', x: 0.45, y: 0.35 }, { role: 'mid', x: 0.45, y: 0.65 },
        { role: 'fwd', x: 0.7, y: 0.5 },
      ],
    };
    expect(checkSquadCoversFormations([sevenBacks]).join(' ')).toContain('7-2-1');
    expect(checkSquadCoversFormations([sevenBacks]).join(' ')).toContain('def');
    // Exactly six defenders is NOT enough: the net wants one on the bench too.
    const sixBacks: Formation = {
      id: '6-3-1', name: 'MURO', slots: [
        { role: 'def', x: 0.18, y: 0.1 }, { role: 'def', x: 0.18, y: 0.26 }, { role: 'def', x: 0.18, y: 0.42 },
        { role: 'def', x: 0.18, y: 0.58 }, { role: 'def', x: 0.18, y: 0.74 }, { role: 'def', x: 0.18, y: 0.9 },
        { role: 'mid', x: 0.45, y: 0.3 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.7 },
        { role: 'fwd', x: 0.7, y: 0.5 },
      ],
    };
    expect(checkSquadCoversFormations([sixBacks]).join(' ')).toContain('no def on the bench');
  });

  it('checkSquad and checkSquads name the offender: a missing squad, a short one, a repeat and a lower-case name', () => {
    expect(checkSquad('espana', SQUAD_NAMES.espana)).toEqual([]);
    expect(checkSquad('espana', SQUAD_NAMES.espana.slice(0, 17)).join(' ')).toContain('squad size 17');
    const dup = [...SQUAD_NAMES.italia];
    dup[4] = dup[0];
    expect(checkSquad('italia', dup).join(' ')).toContain('duplicate name');
    const lower = [...SQUAD_NAMES.brasil];
    lower[2] = 'minusculas';
    expect(checkSquad('brasil', lower).join(' ')).toContain('brasil[2]');
    expect(checkSquads([...TEAMS, { id: 'atlantida', name: 'ATLÁNTIDA', kit: { primary: '#123456', secondary: '#abcdef' } }]).join(' '))
      .toContain('no squad for atlantida');
    expect(() => squadName('atlantida', 0)).toThrow();
    expect(squadName('espana', 0)).toBe(SQUAD_NAMES.espana[0]);
  });
});
```

- [ ] **Step 2: Verlo en rojo**

```bash
npx vitest run components/games/football-logic/squads.test.ts
```
Esperado: **rojo**, `Failed to resolve import "./squads"`.

- [ ] **Step 3: Escribir `squads.ts`**

```ts
import { TEAM_SIZE, type Formation, type Role, type TeamDef } from './teams';

// G15-17 (v1.5), con la adenda de Paco del 23-sep: EIGHTEEN players per selection --
// invented surnames that sound like the country (NEVER real footballers) and fixed
// shirt numbers 1-18 with the two keepers on 1 and 2. Pure DATA: nothing in
// football-logic/ imports this file in V15-3; the screen reads it through
// football-screen/lineup.ts. Wiring a squad into the match (names on events,
// per-player attributes) is V15-4/V15-5.
//
// The composition is not arbitrary. A squad has to field EVERY formation of today
// (3-3-2, 3-2-3, 4-3-1) and every eleven-a-side formation of V15-4 (4-4-2, 4-3-3,
// 5-3-2, G15-16) AND still leave a substitute in every line, which is what G15-17
// means by "reserva DEF/MED/DEL". The maximum across the six is 5 defenders,
// 4 midfielders and 3 forwards, so 6/6/4 keeps at least one of each on the bench in
// all six; the second keeper covers an injured one (G15-18). The fourteen-man squad
// this plan started from did NOT: 4-4-2 left no spare midfielder and 5-3-2 no spare
// defender. checkSquadCoversFormations is what keeps that promise honest.
export const SQUAD_SIZE = 18;
export const SQUAD_NAME_MAX = 12;

// Index -> role. The shirt number is the index + 1 (G15-17), so it is NOT stored:
// a second copy of the same fact is a second copy that can drift.
export const SQUAD_ROLES: readonly Role[] = [
  'gk', 'gk',
  'def', 'def', 'def', 'def', 'def', 'def',
  'mid', 'mid', 'mid', 'mid', 'mid', 'mid',
  'fwd', 'fwd', 'fwd', 'fwd',
];

// Upper case, one word, letters only (the accented ones the twenty languages need).
const SQUAD_NAME_RE = /^[A-ZÁÉÍÓÚÑÇØÅÄÖÜ]+$/;

export function isSquadName(name: string): boolean {
  return SQUAD_NAME_RE.test(name) && [...name].length <= SQUAD_NAME_MAX;
}

export function squadRole(index: number): Role {
  return SQUAD_ROLES[index];
}

export function squadNumber(index: number): number {
  return index + 1;
}

export function squadRoleCount(role: Role): number {
  let n = 0;
  for (const r of SQUAD_ROLES) if (r === role) n++;
  return n;
}

// Eighteen invented surnames per selection, in SQUAD_ROLES order (the two keepers
// first, then six defenders, six midfielders and four forwards). None of the 360 is a
// real, identifiable footballer (G15-17, resolución (f) de Paco); all are distinct.
export const SQUAD_NAMES: Readonly<Record<string, readonly string[]>> = {
  'espana': [
    'QUEROL', 'IZAGUERRA',
    'ARBIZU', 'VILLENAR', 'ZUBELDA', 'MORCUENDE', 'LARRETA', 'VALDUERNA',
    'ESPEJEL', 'GAMONAL', 'BERRUECO', 'OLAZUBI', 'REQUEJANO', 'MONTALBÉS',
    'CENDRERO', 'MARZOLA', 'PEÑALBA', 'SARRIEGUI',
  ],
  'italia': [
    'BRANCATI', 'FEDERICI',
    'VESCARDI', 'MORANDELLI', 'TRIVELLO', 'PISANOTTI', 'CALOGERI', 'CASTELVETRI',
    'BENAZZO', 'FERRANTI', 'SCAMOZZI', 'TESSARO', 'RAVIZZONI', 'BORGHESANI',
    'GUALTIERO', 'MONTECCHI', 'SALVETTI', 'ZAMBERLAN',
  ],
  'brasil': [
    'GOULARTE', 'QUEIROLINO',
    'BEZERRIL', 'TAVARELO', 'CAMPELHO', 'DORNELAS', 'RIBAMAR', 'ARAUJEIRO',
    'SOUZEDO', 'ALMEIRAL', 'MARÇANO', 'VILARINHO', 'FURTADINHO', 'MENDONÇAL',
    'ESTEVAL', 'BRANDIM', 'NOGUEIREDO', 'PORTELINHO',
  ],
  'argentina': [
    'QUIROLA', 'URDIALDE',
    'BENAVENTI', 'SOSTIZZO', 'LARRALDE', 'ALFARACHE', 'PIROVANI', 'GAITANOZZI',
    'ZALDUENDO', 'MERCADANTE', 'OVIEDANO', 'BORDAGARAY', 'PELLEGRANO', 'MOLINARES',
    'CAMPODÓNICO', 'VILLAMAYOR', 'ECHENIQUE', 'ARANGUREZ',
  ],
  'alemania': [
    'HALBRECHT', 'KELLERBRUNN',
    'STEINKAMP', 'WEIGANDT', 'BRUNNHOFER', 'LAUTERBACH', 'OSTERMANN', 'ZIEGENHALS',
    'KIENZLE', 'DIERSEN', 'VOGELSANG', 'REINHOLZ', 'ROTHENBERG', 'DAMMSTEIN',
    'SCHÄFFLER', 'MERZBACH', 'GRUNDMEIER', 'WALDHUBER',
  ],
  'francia': [
    'DELANGES', 'LAFRENOY',
    'BOUVERET', 'MARCHANDIN', 'LEVASSIER', 'THIBAUDOT', 'GRENIVEL', 'BERTHOUMIEU',
    'ROQUEBERT', 'CHAVANOT', 'DUPERRIER', 'MALBRUNOT', 'DESROCHAIS', 'GUILLEMART',
    'SAUVIGNAC', 'PELLETANT', 'VOISENET', 'CORBINEAU',
  ],
  'inglaterra': [
    'HOLBROOK', 'ASHDOWNE',
    'WEATHERALL', 'PENHALIGON', 'BRACKWELL', 'THORNCLIFF', 'MARSDALE', 'CRANBOURNE',
    'EASTHORPE', 'KEMBLETON', 'FAIRHOLME', 'LUDGATE', 'WYNDHALL', 'BLACKMOOR',
    'SWAINSBY', 'REDMARSH', 'TILLOTSON', 'HAVERCROFT',
  ],
  'portugal': [
    'ALCOFORADO', 'AZEVEDAL',
    'SEABRINHO', 'LOURENÇAL', 'PIMENTEIRO', 'BARROCAL', 'VASCONCELO', 'MONTEIRINHO',
    'CARVALHEDO', 'TRINDADE', 'ALPUIM', 'RESENDINHO', 'QUARESMAL', 'FIGUEIRÓ',
    'SERPILHO', 'BRAGANÇO', 'TEIXEIRAL', 'CORDEIRAL',
  ],
  'paises-bajos': [
    'VEENSTRUIK', 'STRAATMAN',
    'BOLKESTEIN', 'HOOGEVEEN', 'KRUISDIJK', 'DRIESSENAAR', 'MEERHOUT', 'VEENHUIZEN',
    'VLASBERGEN', 'TERHORST', 'SNIJDERHOF', 'BOSVELDT', 'DOKKUMER', 'BROUWERSMA',
    'RIETVELDER', 'ZWANENBURG', 'OOSTERLEE', 'HAVERKAMPS',
  ],
  'belgica': [
    'VERSTRAELE', 'DHAENENS',
    'DECRAENE', 'MAESSCHALK', 'WOUTERSEN', 'GILLEBERT', 'PEETERMANS', 'VERSCHOOT',
    'DEBACKERE', 'LAMBRECHTS', 'VANHOECKE', 'DEMEULDER', 'MAERTENSEL', 'CLAESSENAER',
    'SERVAESEN', 'THYSSENAER', 'CALLEWAERT', 'BORREMANS',
  ],
  'croacia': [
    'BUDINEC', 'JURKOVAC',
    'TOMLJENOV', 'KRALJEC', 'VUKELAR', 'SIMUNOVAC', 'DRAGANEC', 'RADOSINEC',
    'PRELOGAR', 'MARUSEK', 'ZVONAREC', 'BLAZEVAC', 'PETRANOVIC', 'SLAVINEC',
    'SKOKANEC', 'HERCEGOVAC', 'TURKALJEC', 'MILOSAVAC',
  ],
  'uruguay': [
    'BENZANO', 'CORBALLO',
    'ARRIGONI', 'LAMARQUE', 'ZUBILLAGA', 'ORTUÑEZ', 'CASARAVILLA', 'ALMADENSO',
    'LARRAÑAGA', 'ETCHEGOIN', 'BERRUTINI', 'SANGUINÉS', 'BAUZÁTEGUI', 'RIVERANO',
    'PIRIZOLA', 'MADEROSO', 'CANEVARO', 'TROCHÓN',
  ],
  'mexico': [
    'ZAMUDIANO', 'ZEPEDANO',
    'CHAVARRÍN', 'OLVERANO', 'TREVIÑAL', 'MACEDONIO', 'ESQUIVIAS', 'HUIZACHAL',
    'PALOMINOS', 'ARELLANEZ', 'XOCHIPAL', 'BERISTOL', 'NAVARRETO', 'CUAUHTÉMOL',
    'CUELLARES', 'TEPANEC', 'VILLASANTE', 'MONTELLANO',
  ],
  'japon': [
    'SHIRAMI', 'MORIZAKI',
    'KUROBANE', 'TAKEMOTO', 'NAGASHIRO', 'ISHIMARU', 'FUKUHARA', 'HANABUSA',
    'ARIMATSU', 'KOZUKAWA', 'MITSUDANI', 'YAMAGURA', 'TOKUNAGI', 'SASAGAWARA',
    'HOSAKABE', 'TSUJIMORI', 'EDAMITSU', 'OKURIYAMA',
  ],
  'marruecos': [
    'BENCHRIF', 'ELHAMRANI',
    'ELMOUSSAOUI', 'OUAZZANI', 'TAZAGHRI', 'BOUKERCH', 'IDRISSOUN', 'BOUSKRAOUI',
    'ZERHOUNI', 'AMGHARI', 'LAHSSINI', 'BOUAZZAOUI', 'AZOULAYNE', 'CHERKAOUNI',
    'TIFRITINE', 'MESKALLI', 'OURAHMA', 'SEDDIKOU',
  ],
  'estados-unidos': [
    'HALVERSEN', 'STOCKWELL',
    'BRINKMAN', 'CALLOWAY', 'STRAUBECK', 'MCGARVIN', 'DELANCEY', 'LANDRIGAN',
    'WHITFIELD', 'KESSLINGER', 'HOLLOMAN', 'RAMBECK', 'HARGROVER', 'MERIWEATHER',
    'SUTTERFIELD', 'QUINTRELL', 'BRADSHER', 'WESTBROOKE',
  ],
  'colombia': [
    'ARBELÁNEZ', 'BEDOYANO',
    'CIFUENTAL', 'OSORIANO', 'BALANDRA', 'ZULETANO', 'CANTILLANO', 'QUINTERANO',
    'REVOLLEDO', 'MANCILLAS', 'TORRENEGRA', 'LOZANILLO', 'PALOMEQUE', 'SALAZARTE',
    'ESCANDÓN', 'MARULANDO', 'SANCLEMENTE', 'ORTEGÓN',
  ],
  'corea-del-sur': [
    'SEOKJUNG', 'JINHWAN',
    'NAMGIL', 'YUNSEOK', 'BAEKHUN', 'JUNGHAE', 'DOHYEOK', 'SEUNGRAE',
    'MYEONGSU', 'HAEJOON', 'SANGWOOK', 'GIJOONG', 'KWANGMIN', 'HYEONBOK',
    'TAEYOL', 'WOOJINHO', 'CHEOLBAE', 'EUNSANG',
  ],
  'noruega': [
    'BRENNHAUG', 'STRANDVIK',
    'SOLVIKEN', 'HAGENSRUD', 'MYKLEBOST', 'ØSTERLIEN', 'FJELLHEIM', 'AASHEIMEN',
    'NORDBRÅTEN', 'LIANGSETH', 'KVAMSDAL', 'BERGSVIK', 'GRØNDALEN', 'HELLESTØL',
    'TVEITANE', 'HAUGSTAD', 'RØNNEBERG', 'SKARSHOLM',
  ],
  'egipto': [
    'ABDELSAMIE', 'MOKHTARY',
    'ELGHARIB', 'SHENOUDI', 'MANSOURY', 'KHALIFAWY', 'TAWFIKY', 'ELSHERBINY',
    'RAGHEB', 'SOLIMANY', 'BADAWEY', 'NASHAATY', 'GABALLAWY', 'RASHEEDAN',
    'GHOZLANI', 'SEIFELDIN', 'ABOUHAMED', 'ZAKARIEH',
  ],
};

// Throws rather than returning '': a missing squad is a programming error (a team in
// the bank with no data), not a state of the game.
export function squadName(teamId: string, index: number): string {
  const names = SQUAD_NAMES[teamId];
  if (names === undefined) throw new Error(`no squad for ${teamId}`);
  return names[index];
}

// ── The invariant net (same shape as invariants.ts: [] when it all holds) ───────

export function checkSquad(teamId: string, names: readonly string[]): string[] {
  const problems: string[] = [];
  if (names.length !== SQUAD_SIZE) problems.push(`${teamId}: squad size ${names.length}`);
  const seen = new Set<string>();
  names.forEach((n, i) => {
    if (!isSquadName(n)) problems.push(`${teamId}[${i}]: bad name ${n}`);
    if (seen.has(n)) problems.push(`${teamId}[${i}]: duplicate name ${n}`);
    seen.add(n);
  });
  return problems;
}

export function checkSquads(teams: readonly TeamDef[]): string[] {
  const problems: string[] = [];
  if (SQUAD_ROLES.length !== SQUAD_SIZE) problems.push(`role table size ${SQUAD_ROLES.length}`);
  if (squadRoleCount('gk') !== 2) problems.push(`goalkeepers ${squadRoleCount('gk')}`);
  if (SQUAD_ROLES[0] !== 'gk' || SQUAD_ROLES[1] !== 'gk') problems.push('shirt numbers 1 and 2 are not the goalkeepers');
  if (SQUAD_SIZE <= TEAM_SIZE) problems.push(`squad of ${SQUAD_SIZE} leaves no reserve for a team of ${TEAM_SIZE}`);
  const global = new Set<string>();
  for (const t of teams) {
    const names = SQUAD_NAMES[t.id];
    if (names === undefined) {
      problems.push(`no squad for ${t.id}`);
      continue;
    }
    for (const p of checkSquad(t.id, names)) problems.push(p);
    for (const n of names) {
      if (global.has(n)) problems.push(`${t.id}: name ${n} is used by another selection`);
      global.add(n);
    }
  }
  return problems;
}

// The promise of the composition: every formation can be filled from this squad, with
// the keeper on top, AND every line keeps someone on the bench (G15-17's "reserva
// DEF/MED/DEL"). Called with FORMATIONS today and, by the test, with V15-4's
// eleven-a-side ones -- which is what stops V15-4 from having to reopen this file.
export function checkSquadCoversFormations(formations: readonly Formation[]): string[] {
  const problems: string[] = [];
  for (const f of formations) {
    let def = 0;
    let mid = 0;
    let fwd = 0;
    for (const s of f.slots) {
      if (s.role === 'def') def++;
      else if (s.role === 'mid') mid++;
      else fwd++;
    }
    if (def > squadRoleCount('def')) problems.push(`${f.id}: needs ${def} def, the squad has ${squadRoleCount('def')}`);
    else if (def === squadRoleCount('def')) problems.push(`${f.id}: no def on the bench`);
    if (mid > squadRoleCount('mid')) problems.push(`${f.id}: needs ${mid} mid, the squad has ${squadRoleCount('mid')}`);
    else if (mid === squadRoleCount('mid')) problems.push(`${f.id}: no mid on the bench`);
    if (fwd > squadRoleCount('fwd')) problems.push(`${f.id}: needs ${fwd} fwd, the squad has ${squadRoleCount('fwd')}`);
    else if (fwd === squadRoleCount('fwd')) problems.push(`${f.id}: no fwd on the bench`);
    if (f.slots.length + 1 > SQUAD_SIZE) problems.push(`${f.id}: needs ${f.slots.length + 1} players, the squad has ${SQUAD_SIZE}`);
  }
  return problems;
}
```

- [ ] **Step 4: Verlo en verde**

```bash
npx vitest run components/games/football-logic/squads.test.ts
```
Esperado: **verde, 8 tests**.

- [ ] **Step 5: Controles negativos**

**Uno cada vez, deshaz en el acto.**
1. En `squads.ts`, cambia `'QUEROL'` (ESPAÑA, índice 0) por `'Querol'`. → **rojo**: `expected [ 'espana[0]: bad name Querol' ] to deeply equal []`. **Deshaz.**
2. Cambia `'BRANCATI'` (ITALIA, 0) por `'QUEROL'`. → **rojo**: `italia: name QUEROL is used by another selection` y `expected false to be true` en el test de los 360 distintos. **Deshaz.**
3. En `SQUAD_ROLES`, cambia el sexto `'def'` por `'mid'` (composición 2/5/7/4). → **rojo**: `5-3-2: no def on the bench` en el test de V15-4 y `expected 5 to be greater than 5`. **Comprueba que sale ése**: es el control que demuestra que la plantilla de dieciocho existe **por** el recambio, no por el tamaño. **Deshaz.**
4. En `SQUAD_ROLES`, cambia el segundo `'gk'` por `'def'` (composición 1/7/6/4). → **rojo**: `goalkeepers 1` y `expected 1 to be greater than 1`. Es el control de la resolución de Paco sobre el segundo portero (G15-18). **Deshaz.**
5. Quita el último nombre de `'egipto'` (17 en vez de 18). → **rojo**: `egipto: squad size 17`. **Deshaz.**

- [ ] **Step 6: Gates de la tarea**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-logic/squads.ts components/games/football-logic/squads.test.ts
git diff --name-only ef61be7 -- components/games/football-logic/ | sort
grep -rn "squads" components/games/football-logic/ --include=*.ts | grep -v "squads.ts\|squads.test.ts"
```
Esperado: **1368 tests en 82 ficheros verdes**; `tsc` y `eslint` sin salida; el `--name-only` con **nueve** líneas (las siete de la Task 3 más `squads.ts` y `squads.test.ts`); el último `grep` **vacío** — **nadie del motor importa `squads.ts`**, que es justo la garantía de que este paso no toca el partido.

- [ ] **Step 7: Cerrar — NO ejecutes `git add` ni `git commit`**

```
V15-3-6: squads.ts — 20 plantillas de 18 (2 GK + 6 DEF + 6 MED + 4 DEL, adenda de Paco tras H8), 360 nombres inventados únicos, dorsal = índice + 1, y checkSquadCoversFormations verificado contra las formaciones de hoy Y contra las tres de V15-4 (4-4-2 / 4-3-3 / 5-3-2) exigiendo UNA RESERVA DE CADA ROL. Nadie del motor lo importa. 1368/82 verdes.
```

---


### Task V15-3-7: el modelo de la alineación y su persistencia (G15-17, puro)

**Files:**
- Create: `components/games/football-screen/lineup.ts`
- Test: `components/games/football-screen/lineup.test.ts`

**Interfaces:**
- Consumes de la Task V15-3-6: `SQUAD_SIZE`, `SQUAD_NAME_MAX`, `SQUAD_NAMES`, `isSquadName`, `squadName`, `squadNumber`, `squadRole`. De hoy: `TEAM_SIZE`, `FORMATIONS`, `type Formation`, `type Role`.
- Produces, y las Tasks V15-3-8/9 consumen literalmente:
  - `type Lineup = { starters: number[]; reserves: number[]; names: string[] }` · `createLineup(): Lineup`
  - `lineupPositionCount(f: Formation): number` · `lineupReserveCount(f: Formation): number` · `lineupRoleAt(f: Formation, position: number): Role` · `GK_POSITION = 0`
  - `defaultLineup(f: Formation, out: Lineup): void` · `refreshReserves(f: Formation, out: Lineup): void`
  - `lineupName(l: Lineup, teamId: string, index: number): string` · `canSwap(f: Formation, l: Lineup, position: number, squadIndex: number): boolean` · `applySwap(f: Formation, l: Lineup, position: number, squadIndex: number): boolean`
  - `lineupTypeChar(l: Lineup, index: number, ch: string): boolean` · `lineupBackspace(l: Lineup, index: number): void` · `lineupEndEdit(l: Lineup, index: number): void`
  - `checkLineup(f: Formation, l: Lineup): string[]` · `lineupStorageKey(teamId: string): string` · `serializeLineup(f: Formation, l: Lineup): string` · `parseLineup(raw: string | null, f: Formation, out: Lineup): void` · `loadLineup(read: (key: string) => string | null, teamId: string, f: Formation, out: Lineup): void` · `saveLineup(write: (key: string, value: string) => void, teamId: string, f: Formation, l: Lineup): void`

**Contexto que el ejecutor no tiene:**
- **La regla anti-acoplamiento de este fichero (Global Constraints).** `lineup.ts` **no usa `TEAM_SIZE` para dimensionar nada**: el número de puestos es `f.slots.length + 1` (los de campo más el portero) y el de reservas `SQUAD_SIZE − (f.slots.length + 1)`. Hoy salen **9 y 9**; con las formaciones de once de V15-4 saldrán **11 y 7** **sin tocar este fichero**, y hay un test que lo demuestra con una formación de diez puestos escrita a mano. `TEAM_SIZE` aparece **una sola vez**, dentro de `checkLineup`, como comprobación de que la pantalla y el motor están de acuerdo.
- **Qué es un puesto.** El puesto 0 es el portero (`GK_POSITION`); el puesto `p ≥ 1` es el hueco `p − 1` de la formación, con su rol. Ésa es la única correspondencia y vive en `lineupRoleAt`.
- **El cambio es solo de la misma posición (G15-17).** `canSwap` exige que el suplente sea **reserva** (no titular) y que su rol coincida con el del puesto. Con la plantilla de dieciocho hay **dos porteros**, así que el puesto 0 **sí** tiene reserva: el portero se puede cambiar por el otro portero y por nadie más, y eso sale de los datos, no de un `if` especial. (Con la plantilla de catorce que tenía este plan el portero no era cambiable nunca; la adenda de Paco lo arregla de paso, y con ella la lesión del portero de G15-18 tiene a quién meter.) Un test lo fija en los dos sentidos.
- **Los nombres editados viven en `names`, indexado por PLANTILLA, no por puesto.** Cadena vacía = «usa el nombre de la plantilla». Así un nombre editado sobrevive a cambiar de alineación y de formación, que es lo que dice G15-17 («alineación **y nombres editados** en localStorage por selección»).
- **El formato guardado y por qué esto se decide HOY.** `{"f":"3-3-2","n":9,"s":[…],"m":[…]}` — el id de la formación y el número de titulares van dentro **a propósito**: cuando V15-4 suba a once, una alineación guardada hoy no cuadrará (`n` 9 ≠ 11, y `f` será otra) y `parseLineup` caerá al orden por defecto **sin romper nada ni perder los nombres**. Sin esos dos campos, V15-4 heredaría un array de nueve índices metido en once puestos.
- **Las dos mitades se cargan por separado**: los nombres se aplican siempre que sean válidos; los titulares, solo si la formación y el tamaño coinciden **y** `checkLineup` los acepta. Es lo que permite cambiar de 3-3-2 a 4-3-1 y conservar los nombres.
- **`JSON.parse`/`JSON.stringify` asignan**, pero corren al **entrar** y al **salir** de la pantalla, nunca por frame (criterio 20). Van envueltos en `try/catch` — igual que `loadKeyScheme`/`saveKeyScheme` de V15-2 — porque una ventana privada o el almacenamiento bloqueado tienen que dar la alineación por defecto, no una excepción.
- **`lineup.ts` está en `football-screen/`, no en `football-logic/`.** Es estado de pantalla: el motor no lo lee en este paso, y `football-screen/` ya importa de `football-logic/` (lo hace `flow.ts`). Ponerlo en `football-logic/` sería declarar que el partido lo usa, que es justo lo que V15-3 no hace.

- [ ] **Step 1: Escribir el test en rojo**

Crea `components/games/football-screen/lineup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SQUAD_NAMES, SQUAD_NAME_MAX, SQUAD_SIZE, squadNumber, squadRole } from '../football-logic/squads';
import { FORMATIONS, TEAM_SIZE, type Formation } from '../football-logic/teams';
import {
  GK_POSITION, applySwap, canSwap, checkLineup, createLineup, defaultLineup, lineupBackspace, lineupEndEdit,
  lineupName, lineupPositionCount, lineupReserveCount, lineupRoleAt, lineupStorageKey, lineupTypeChar,
  loadLineup, parseLineup, saveLineup, serializeLineup, type Lineup,
} from './lineup';

// A ten-outfield formation: the shape V15-4 brings (G15-16). Written here, not
// imported, so this file is proven size-independent BEFORE V15-4 exists.
const TEN_SLOTS: Formation = {
  id: '4-4-2', name: 'NORMAL', slots: [
    { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
    { role: 'mid', x: 0.45, y: 0.15 }, { role: 'mid', x: 0.45, y: 0.38 }, { role: 'mid', x: 0.45, y: 0.62 }, { role: 'mid', x: 0.45, y: 0.85 },
    { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
  ],
};

function built(f: Formation): Lineup {
  const l = createLineup();
  defaultLineup(f, l);
  return l;
}

describe('the lineup model (G15-17): starters and reserves derived from the formation', () => {
  it('the default lineup fills one position per formation slot plus the goalkeeper, with matching roles', () => {
    for (const f of FORMATIONS) {
      const l = built(f);
      expect(l.starters).toHaveLength(lineupPositionCount(f));
      expect(lineupPositionCount(f)).toBe(f.slots.length + 1);
      expect(l.starters[GK_POSITION]).toBe(0);
      expect(squadRole(l.starters[GK_POSITION])).toBe('gk');
      for (let p = 1; p < l.starters.length; p++) {
        expect(squadRole(l.starters[p])).toBe(lineupRoleAt(f, p));
      }
      expect(new Set(l.starters).size).toBe(l.starters.length);
      expect(checkLineup(f, l)).toEqual([]);
    }
  });

  it('the reserves are exactly the rest of the squad, in ascending order', () => {
    const f = FORMATIONS[0];
    const l = built(f);
    expect(l.reserves).toHaveLength(lineupReserveCount(f));
    expect(lineupReserveCount(f)).toBe(SQUAD_SIZE - lineupPositionCount(f));
    expect(l.reserves).toHaveLength(SQUAD_SIZE - TEAM_SIZE);   // today: nine on, nine off
    for (const r of l.reserves) expect(l.starters).not.toContain(r);
    const sorted = [...l.reserves].sort((a, b) => a - b);
    expect(l.reserves).toEqual(sorted);
  });

  it('is size-independent: a ten-slot formation (V15-4, G15-16) gives eleven starters and seven reserves, no code change', () => {
    const l = built(TEN_SLOTS);
    expect(lineupPositionCount(TEN_SLOTS)).toBe(11);
    expect(lineupReserveCount(TEN_SLOTS)).toBe(7);
    expect(l.starters).toHaveLength(11);
    expect(l.reserves).toHaveLength(7);
    // G15-17's "reserva DEF/MED/DEL", the reason the squad is eighteen: even at
    // eleven a side there is still someone of every role on the bench.
    for (const role of ['gk', 'def', 'mid', 'fwd'] as const) {
      expect(l.reserves.some((i) => squadRole(i) === role)).toBe(true);
    }
    expect(checkLineup(TEN_SLOTS, l).join(' ')).toContain('team size');   // the engine is still on nine
  });

  it('swaps only a reserve of the SAME role -- the goalkeeper only for the OTHER goalkeeper', () => {
    const f = FORMATIONS[0];
    const l = built(f);
    const defPosition = 1;
    expect(lineupRoleAt(f, defPosition)).toBe('def');
    const spareDef = l.reserves.find((i) => squadRole(i) === 'def');
    const spareFwd = l.reserves.find((i) => squadRole(i) === 'fwd');
    if (spareDef === undefined || spareFwd === undefined) throw new Error('the squad must keep a spare of each');
    expect(canSwap(f, l, defPosition, spareDef)).toBe(true);
    expect(canSwap(f, l, defPosition, spareFwd)).toBe(false);          // wrong role
    expect(canSwap(f, l, defPosition, l.starters[2])).toBe(false);      // already a starter
    // The bench keeper is the ONLY legal swap for position 0 (G15-18 needs him).
    const spareGk = l.reserves.find((i) => squadRole(i) === 'gk');
    if (spareGk === undefined) throw new Error('the squad must keep a spare keeper');
    expect(canSwap(f, l, GK_POSITION, spareGk)).toBe(true);
    for (let i = 0; i < SQUAD_SIZE; i++) {
      if (i === spareGk) continue;
      expect(canSwap(f, l, GK_POSITION, i)).toBe(false);
    }
    // And no outfield position may take a keeper.
    expect(canSwap(f, l, defPosition, spareGk)).toBe(false);
  });

  it('applySwap puts the reserve on the pitch, benches the starter and keeps the lineup legal', () => {
    const f = FORMATIONS[0];
    const l = built(f);
    const position = 1;
    const out = l.starters[position];
    const inc = l.reserves.find((i) => squadRole(i) === 'def');
    if (inc === undefined) throw new Error('no spare defender');
    expect(applySwap(f, l, position, inc)).toBe(true);
    expect(l.starters[position]).toBe(inc);
    expect(l.reserves).toContain(out);
    expect(l.reserves).not.toContain(inc);
    expect(checkLineup(f, l)).toEqual([]);
    expect(applySwap(f, l, position, l.starters[2])).toBe(false);       // refused, nothing moves
    expect(l.starters[position]).toBe(inc);
  });

  it('name editing: upper case, letters only, at most twelve, backspace, and empty falls back to the squad name', () => {
    const l = built(FORMATIONS[0]);
    expect(lineupName(l, 'espana', 0)).toBe(SQUAD_NAMES.espana[0]);
    expect(lineupTypeChar(l, 0, 'r')).toBe(true);
    expect(lineupTypeChar(l, 0, 'i')).toBe(true);
    expect(lineupTypeChar(l, 0, '7')).toBe(false);
    expect(lineupTypeChar(l, 0, ' ')).toBe(false);
    expect(lineupName(l, 'espana', 0)).toBe('RI');
    lineupBackspace(l, 0);
    expect(lineupName(l, 'espana', 0)).toBe('R');
    for (let i = 0; i < 20; i++) lineupTypeChar(l, 0, 'a');
    expect([...lineupName(l, 'espana', 0)].length).toBe(SQUAD_NAME_MAX);
    lineupBackspace(l, 0);
    expect(lineupTypeChar(l, 0, 'z')).toBe(true);
    // Emptying it and closing the editor restores the squad's own name.
    for (let i = 0; i < SQUAD_NAME_MAX; i++) lineupBackspace(l, 0);
    lineupEndEdit(l, 0);
    expect(lineupName(l, 'espana', 0)).toBe(SQUAD_NAMES.espana[0]);
  });

  it('serialize -> parse is a round trip that carries the formation id and the starter count', () => {
    const f = FORMATIONS[1];
    const l = built(f);
    const inc = l.reserves.find((i) => squadRole(i) === 'mid');
    if (inc === undefined) throw new Error('no spare midfielder');
    applySwap(f, l, 4, inc);
    lineupTypeChar(l, 2, 'x');
    const raw = serializeLineup(f, l);
    expect(raw).toContain('"f":"3-2-3"');
    expect(raw).toContain(`"n":${lineupPositionCount(f)}`);
    const back = createLineup();
    parseLineup(raw, f, back);
    expect(back.starters).toEqual(l.starters);
    expect(back.reserves).toEqual(l.reserves);
    expect(lineupName(back, 'espana', 2)).toBe('X');
  });

  it('a stored lineup from another formation or another team size falls back to the default BUT keeps the names', () => {
    const stored = built(FORMATIONS[0]);
    lineupTypeChar(stored, 3, 'q');
    const raw = serializeLineup(FORMATIONS[0], stored);
    const out = createLineup();
    parseLineup(raw, FORMATIONS[2], out);                       // 4-3-1, a different formation
    expect(out.starters).toEqual(built(FORMATIONS[2]).starters);
    expect(lineupName(out, 'espana', 3)).toBe('Q');
    // And the same when only the starter count moved (the V15-4 case).
    const eleven = createLineup();
    parseLineup(raw.replace('"n":9', '"n":11'), FORMATIONS[0], eleven);
    expect(eleven.starters).toEqual(built(FORMATIONS[0]).starters);
  });

  it('garbage, null and a throwing storage all give the default lineup and never throw', () => {
    const f = FORMATIONS[0];
    const expected = built(f).starters;
    for (const raw of [null, '', 'not json', '{}', '{"f":"3-3-2","n":9,"s":[0,0,0,0,0,0,0,0,0],"m":[]}', '{"f":"3-3-2","n":9,"s":[0,1,2,3,4,5,6,7,99],"m":[]}']) {
      const out = createLineup();
      expect(() => parseLineup(raw, f, out)).not.toThrow();
      expect(out.starters).toEqual(expected);
      expect(checkLineup(f, out)).toEqual([]);
    }
    const out = createLineup();
    expect(() => loadLineup(() => { throw new Error('blocked'); }, 'espana', f, out)).not.toThrow();
    expect(out.starters).toEqual(expected);
    expect(() => saveLineup(() => { throw new Error('blocked'); }, 'espana', f, out)).not.toThrow();
  });

  it('the storage key is one per selection, and load/save go through the injected closures only', () => {
    expect(lineupStorageKey('espana')).toBe('av_vwc_lineup_espana');
    expect(lineupStorageKey('corea-del-sur')).not.toBe(lineupStorageKey('espana'));
    const f = FORMATIONS[0];
    const l = built(f);
    const inc = l.reserves.find((i) => squadRole(i) === 'fwd');
    if (inc === undefined) throw new Error('no spare forward');
    applySwap(f, l, l.starters.length - 1, inc);
    const store = new Map<string, string>();
    saveLineup((k, v) => { store.set(k, v); }, 'japon', f, l);
    expect(store.has('av_vwc_lineup_japon')).toBe(true);
    const back = createLineup();
    loadLineup((k) => store.get(k) ?? null, 'japon', f, back);
    expect(back.starters).toEqual(l.starters);
    // A selection that was never saved simply starts on the default.
    const fresh = createLineup();
    loadLineup((k) => store.get(k) ?? null, 'egipto', f, fresh);
    expect(fresh.starters).toEqual(built(f).starters);
    expect(squadNumber(fresh.starters[GK_POSITION])).toBe(1);
  });
});
```

- [ ] **Step 2: Verlo en rojo**

```bash
npx vitest run components/games/football-screen/lineup.test.ts
```
Esperado: **rojo**, `Failed to resolve import "./lineup"`.

- [ ] **Step 3: Escribir `lineup.ts`**

```ts
import { SQUAD_NAME_MAX, SQUAD_SIZE, isSquadName, squadName, squadRole } from '../football-logic/squads';
import { TEAM_SIZE, type Formation, type Role } from '../football-logic/teams';

// G15-17: the ALINEACIÓN screen's model. Who starts, who sits, and the names the
// player has edited -- per selection, kept in localStorage through the injected
// closures at the bottom (the pattern of keyboard.ts's loadKeyScheme, V15-2: nothing
// in this folder touches `window`).
//
// SIZE INDEPENDENCE (Global Constraints of V15-3): the number of positions is
// `f.slots.length + 1` and the number of reserves is `SQUAD_SIZE` minus that --
// nine and nine today, eleven and seven the day V15-4 raises the team to eleven
// (G15-16), with NO change to this file. `TEAM_SIZE` is read exactly once, inside
// checkLineup, to notice when the screen and the engine disagree.

export const LINEUP_STORAGE_PREFIX = 'av_vwc_lineup_';
// Position 0 is the goalkeeper; position p >= 1 is the formation's slot p - 1.
export const GK_POSITION = 0;

export type Lineup = {
  starters: number[];   // squad index per position, length lineupPositionCount(f)
  reserves: number[];   // the rest of the squad, ascending
  names: string[];      // by SQUAD index; '' means "use the squad's own name"
};

// Created ONCE per human at mount (criterion 20); everything else writes in place.
export function createLineup(): Lineup {
  const names: string[] = [];
  for (let i = 0; i < SQUAD_SIZE; i++) names.push('');
  return { starters: [], reserves: [], names };
}

export function lineupPositionCount(f: Formation): number {
  return f.slots.length + 1;
}

export function lineupReserveCount(f: Formation): number {
  return SQUAD_SIZE - lineupPositionCount(f);
}

export function lineupRoleAt(f: Formation, position: number): Role {
  return position === GK_POSITION ? 'gk' : f.slots[position - 1].role;
}

// The rest of the squad, ascending. Length assignment + index writes, like
// world-cup.ts's advanceRound: no new array.
export function refreshReserves(f: Formation, out: Lineup): void {
  const positions = lineupPositionCount(f);
  let n = 0;
  out.reserves.length = lineupReserveCount(f);
  for (let i = 0; i < SQUAD_SIZE; i++) {
    let starting = false;
    for (let p = 0; p < positions; p++) {
      if (out.starters[p] === i) {
        starting = true;
        break;
      }
    }
    if (starting) continue;
    if (n < out.reserves.length) out.reserves[n] = i;
    n++;
  }
}

// The lowest unused squad index of the right role for each position, keeper first --
// so the number 1 always starts in goal and the number 2 always sits on the bench.
// Deterministic, so the same formation always opens on the same eleven (nine today).
// Does NOT touch `names`: an edited name belongs to the player, not to the lineup.
export function defaultLineup(f: Formation, out: Lineup): void {
  const positions = lineupPositionCount(f);
  out.starters.length = positions;
  for (let p = 0; p < positions; p++) out.starters[p] = -1;
  for (let p = 0; p < positions; p++) {
    const role = lineupRoleAt(f, p);
    for (let i = 0; i < SQUAD_SIZE; i++) {
      if (squadRole(i) !== role) continue;
      let taken = false;
      for (let q = 0; q < positions; q++) {
        if (out.starters[q] === i) {
          taken = true;
          break;
        }
      }
      if (taken) continue;
      out.starters[p] = i;
      break;
    }
  }
  refreshReserves(f, out);
}

export function lineupName(l: Lineup, teamId: string, index: number): string {
  const edited = l.names[index];
  return edited === '' ? squadName(teamId, index) : edited;
}

// G15-17: "cambio titular <-> reserva solo de la misma posición". The squad carries
// TWO goalkeepers (Paco, 23-sep), so position 0 accepts the bench keeper and nothing
// else -- and an outfield position never accepts a keeper. That falls out of the
// data and the role table, not out of a special case.
export function canSwap(f: Formation, l: Lineup, position: number, squadIndex: number): boolean {
  if (position < 0 || position >= l.starters.length) return false;
  if (squadIndex < 0 || squadIndex >= SQUAD_SIZE) return false;
  if (l.starters.includes(squadIndex)) return false;
  return squadRole(squadIndex) === lineupRoleAt(f, position);
}

export function applySwap(f: Formation, l: Lineup, position: number, squadIndex: number): boolean {
  if (!canSwap(f, l, position, squadIndex)) return false;
  l.starters[position] = squadIndex;
  refreshReserves(f, l);
  return true;
}

// ── Editing a name (G15-17: a key, upper case, twelve max, Enter) ───────────────

const LETTER = /^[A-ZÁÉÍÓÚÑÇØÅÄÖÜ]$/;

export function lineupTypeChar(l: Lineup, index: number, ch: string): boolean {
  const upper = ch.toUpperCase();
  if (!LETTER.test(upper)) return false;
  const current = l.names[index];
  if ([...current].length >= SQUAD_NAME_MAX) return false;
  l.names[index] = current + upper;
  return true;
}

export function lineupBackspace(l: Lineup, index: number): void {
  const chars = [...l.names[index]];
  if (chars.length === 0) return;
  chars.pop();
  l.names[index] = chars.join('');
}

// Enter. An empty (or somehow illegal) name goes back to the squad's own.
export function lineupEndEdit(l: Lineup, index: number): void {
  const name = l.names[index];
  if (name !== '' && !isSquadName(name)) l.names[index] = '';
}

// ── The invariant net ───────────────────────────────────────────────────────────

export function checkLineup(f: Formation, l: Lineup): string[] {
  const problems: string[] = [];
  const positions = lineupPositionCount(f);
  if (l.starters.length !== positions) problems.push(`starters ${l.starters.length} for ${positions} positions`);
  if (l.names.length !== SQUAD_SIZE) problems.push(`names ${l.names.length}`);
  const seen = new Set<number>();
  for (let p = 0; p < l.starters.length; p++) {
    const i = l.starters[p];
    if (i < 0 || i >= SQUAD_SIZE) problems.push(`position ${p} holds ${i}`);
    else if (squadRole(i) !== lineupRoleAt(f, p)) problems.push(`position ${p} holds a ${squadRole(i)}`);
    if (seen.has(i)) problems.push(`player ${i} starts twice`);
    seen.add(i);
  }
  for (const n of l.names) {
    if (n !== '' && !isSquadName(n)) problems.push(`edited name ${n} is illegal`);
  }
  // The one place TEAM_SIZE is read: the screen and the engine must agree on how many
  // play. V15-4 raises both at once; until then a mismatch has to be visible.
  if (positions !== TEAM_SIZE) problems.push(`team size ${positions} but the engine plays ${TEAM_SIZE}`);
  return problems;
}

// ── Persistence, per selection (G15-17) ────────────────────────────────────────

export function lineupStorageKey(teamId: string): string {
  return LINEUP_STORAGE_PREFIX + teamId;
}

// The formation id AND the starter count travel inside on purpose: when V15-4 raises
// the team to eleven, a lineup stored today no longer matches and parseLineup falls
// back to the default -- instead of pushing nine indices into eleven positions.
export function serializeLineup(f: Formation, l: Lineup): string {
  return JSON.stringify({ f: f.id, n: lineupPositionCount(f), s: l.starters, m: l.names });
}

// A type predicate, not a cast: the Global Constraints ban new `as`.
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isStringArray(v: unknown): v is string[] {
  if (!Array.isArray(v)) return false;
  for (const item of v) if (typeof item !== 'string') return false;
  return true;
}

function isNumberArray(v: unknown): v is number[] {
  if (!Array.isArray(v)) return false;
  for (const item of v) if (typeof item !== 'number' || !Number.isInteger(item)) return false;
  return true;
}

// Two halves, read independently: the NAMES come back whenever they are legal, the
// STARTERS only when the formation and the size match and the result passes
// checkLineup. That is what lets the player change formation -- or upgrade to V15-4 --
// without losing the names he typed.
export function parseLineup(raw: string | null, f: Formation, out: Lineup): void {
  defaultLineup(f, out);
  for (let i = 0; i < SQUAD_SIZE; i++) out.names[i] = '';
  if (raw === null || raw === '') return;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isRecord(parsed)) return;
  const names = parsed.m;
  if (isStringArray(names) && names.length === SQUAD_SIZE) {
    for (let i = 0; i < SQUAD_SIZE; i++) {
      const n = names[i];
      out.names[i] = n === '' || isSquadName(n) ? n : '';
    }
  }
  if (parsed.f !== f.id || parsed.n !== lineupPositionCount(f)) return;
  const starters = parsed.s;
  if (!isNumberArray(starters) || starters.length !== lineupPositionCount(f)) return;
  const backup = [...out.starters];
  for (let p = 0; p < starters.length; p++) out.starters[p] = starters[p];
  refreshReserves(f, out);
  if (checkLineup(f, out).length === 0) return;
  for (let p = 0; p < backup.length; p++) out.starters[p] = backup[p];
  refreshReserves(f, out);
}

export function loadLineup(read: (key: string) => string | null, teamId: string, f: Formation, out: Lineup): void {
  try {
    parseLineup(read(lineupStorageKey(teamId)), f, out);
  } catch {
    defaultLineup(f, out);
  }
}

export function saveLineup(write: (key: string, value: string) => void, teamId: string, f: Formation, l: Lineup): void {
  try {
    write(lineupStorageKey(teamId), serializeLineup(f, l));
  } catch {
    // no-op: a private window or blocked site data just forgets, like the key scheme.
  }
}
```

> **Ojo con `checkLineup` y la formación de diez puestos:** el test espera que `checkLineup(TEN_SLOTS, l)` **contenga** `team size` — con `TEAM_SIZE` en 9, once puestos no cuadran, y eso es exactamente lo que ese aviso está para decir. Todos los demás asertos de ese test (11 titulares, 3 reservas) **sí** pasan: la fila del tamaño es un aviso de desacuerdo con el motor, no un rechazo del modelo. En `parseLineup` ese aviso haría caer SIEMPRE al orden por defecto con una formación de once — lo cual es el comportamiento correcto **hoy** (no hay formaciones de once) y lo que V15-4 arreglará subiendo `TEAM_SIZE`. **Está escrito así a propósito; no lo "arregles" quitando la comprobación.**
>
> Si prefieres verlo de otra manera: `defaultLineup`, `canSwap`, `applySwap` y el dibujo **no** consultan `TEAM_SIZE` nunca, así que el día que valga 11 todo encaja sin tocar nada.

- [ ] **Step 4: Verlo en verde**

```bash
npx vitest run components/games/football-screen/lineup.test.ts
```
Esperado: **verde, 10 tests**.

- [ ] **Step 5: Controles negativos**

**Uno cada vez, deshaz en el acto.**
1. En `lineup.ts`, haz que `lineupPositionCount` devuelva `TEAM_SIZE`. → **rojo**: `expected 9 to be 11` en el test de independencia de tamaño. **Éste es el control que vigila la regla anti-acoplamiento**; si no falla, el test es vacuo. **Deshaz.**
2. En `canSwap`, quita la comparación de roles (`return !l.starters.includes(squadIndex)`). → **rojo**: `expected true to be false` (un delantero entrando de central, y el bucle del portero, que aceptaría a cualquier reserva). **Deshaz.**
3. En `serializeLineup`, quita `n: lineupPositionCount(f)`. → **rojo**: `expected '…' to contain '"n":9'` y el caso V15-4 del test de fallback. **Deshaz.**
4. En `parseLineup`, aplica los nombres **después** del `return` de la formación (mueve el bloque de `names` debajo del `if (parsed.f !== f.id …)`). → **rojo**: `expected '…' to be 'Q'`; ojo, el índice es el 3, así que con la plantilla de dieciocho el mensaje nombra a `VILLENAR` (el cuarto de ESPAÑA), no a `ZUBELDA`. **Deshaz.**
5. En `lineupTypeChar`, quita el tope de `SQUAD_NAME_MAX`. → **rojo**: `expected 21 to be 12`. **Deshaz.**

- [ ] **Step 6: Gates de la tarea**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/lineup.ts components/games/football-screen/lineup.test.ts
git diff --name-only ef61be7 -- components/games/football-logic/ | sort
grep -n "TEAM_SIZE" components/games/football-screen/lineup.ts
grep -nE "\b11\b|\b3\b" components/games/football-screen/lineup.ts
grep -rnE "(window|document|localStorage)\." components/games/football-screen/lineup.ts
```
Esperado: **1378 tests en 83 ficheros verdes**; `tsc` y `eslint` sin salida; el `--name-only` con las **nueve** líneas de la Task 6; el primer `grep` **dos líneas** (el import y el uso dentro de `checkLineup`) **y ninguna más**; el segundo, **vacío** (ningún `11` ni `3` como tamaño); el tercero, **vacío**.

- [ ] **Step 7: Cerrar — NO ejecutes `git add` ni `git commit`**

```
V15-3-7: lineup.ts puro — titulares y reservas derivados de f.slots.length + 1 (9 + 9 hoy, 11 + 7 en V15-4 sin tocar el fichero), cambio solo de la misma posición, portero cambiable SOLO por el segundo portero (sale de los datos), edición de nombre (mayúsculas, 12, Enter) y persistencia por selección con el id de formación y el número de titulares dentro. 1378/83 verdes.
```

---

### Task V15-3-8: la fase ALINEACIÓN en el flujo, su geometría y sus textos (G15-17, puro)

**Files:**
- Modify: `components/games/football-screen/flow.ts` (`FlowPhase` `:15-24`; `phaseGroup` `:37-50`; `FlowState` `:72-83`; `createFlowState`/`flowReset` `:85-107`; `flowConfirmTeam` `:172-183`; `flowAfterModeBuilt` `:196-199`)
- Modify: `components/games/football-screen/flow.test.ts` (`describe('the team selector', …)` `:144`; `describe('flowBuildMode …')` `:202`; `describe('phaseGroup', …)` `:396`)
- Modify: `components/games/football-screen/flow-layout.ts` (al final)
- Modify: `components/games/football-screen/flow-layout.test.ts` (`describe('the other screens', …)`)
- Modify: `components/games/football-screen/control-hints.ts` (`ControlHints` y `buildHints`)
- Modify: `components/games/football-screen/control-hints.test.ts`

**Interfaces:**
- Consumes de la Task V15-3-7: nada en código (la fase no importa `lineup.ts`: el modelo lo tiene el `.tsx`). De hoy: `GameModeKind`, `modeBracket`.
- Produces, y la Task V15-3-9 consume literalmente:
  - `flow.ts`: `FlowPhase` gana `'lineup'` · `LINEUP_BY_MODE: Readonly<Record<GameModeKind, boolean>>` · `flowHasLineup(f: FlowState): boolean` · `FlowState.lineupCursor: number`, `.lineupChoosing: number`, `.lineupEditing: number` · `flowConfirmTeam(f, bankSize): 'next' | 'lineup' | 'done' | 'refused'` · `flowLineupMove(f: FlowState, delta: number, count: number): void` · `flowLineupChoose(f: FlowState, position: number): void` · `flowLineupCancelChoice(f: FlowState): void` · `flowLineupBeginEdit(f: FlowState, squadIndex: number): void` · `flowLineupEndEdit(f: FlowState): void` · `flowConfirmLineup(f: FlowState): 'next' | 'done' | 'none'`
  - `flow-layout.ts`: `LINEUP_PITCH_X = 30` · `LINEUP_PITCH_Y = 92` · `LINEUP_PITCH_W = 430` · `LINEUP_PITCH_H = 280` · `LINEUP_LABEL_DY = 14` · `LINEUP_RESERVE_X = 500` · `LINEUP_RESERVE_TOP = 108` · `LINEUP_RESERVE_H = 30` · `LINEUP_STATUS_Y = 412` · `LINEUP_HINT_Y = 476` · `lineupReserveY(index: number): number`
  - `control-hints.ts`: `ControlHints.lineupBrowse`, `.lineupSwap`, `.lineupEdit`

**Contexto que el ejecutor no tiene:**
- **Dónde encaja la pantalla.** G15-17: «pantalla ALINEACIÓN **tras elegir formación** (solo amistoso y Mundial)». La formación se elige en el selector de equipo con 1/2/3, así que la fase nueva va **entre `team-select` y lo que venga** (el partido en un amistoso, el sorteo en el Mundial). El **entrenamiento no la tiene** (`LINEUP_BY_MODE.training = false`): es una pantalla de práctica.
- **A dos, las dos alineaciones.** El amistoso a dos elige J1 → J2 los equipos y **luego** J1 → J2 las alineaciones: `flowConfirmTeam` devuelve `'next'` mientras falte un equipo y `'lineup'` cuando estén los dos; `flowConfirmLineup` devuelve `'next'` cuando aún falta la de J2 y `'done'` cuando el componente ya puede construir el modo. `f.picking` es el mismo cursor de humano que ya usaba el selector.
- **Por qué la fase NO importa `lineup.ts`.** `flow.ts` es la máquina de fases; el modelo (quién juega, quién está en el banquillo) lo tiene el `.tsx` en dos `Lineup` creados al montar. La fase solo guarda **dónde está el cursor** y **en qué submodo** está la pantalla, que es lo que decide qué hace cada tecla. Mismo reparto que `bracketChoice`.
- **Los tres submodos, y por qué son tres números y no un tipo union.** `lineupChoosing` = el puesto al que se le está buscando reserva (−1 = ninguno) y `lineupEditing` = el índice de plantilla cuyo nombre se está escribiendo (−1 = ninguno). Guardar el **qué** además del **si** ahorra un segundo campo y deja el `.tsx` sin estado propio.
- **El reparto de teclas LO DECIDIÓ PACO** (resolución (d), 23-sep), no este plan — G15-17 dice «cruceta, confirmar, elegir reserva» y «edición de nombre (tecla…)», pero no qué botón hace qué, y el plan lo había repartido **al revés**:
  | Botón | Navegando | Eligiendo reserva |
  |---|---|---|
  | **A** | **confirma / elige**: abre la lista de reservas del puesto marcado | **confirma** la reserva marcada y cierra la lista |
  | **B** | **vuelve**: sale de ALINEACIÓN (y, a dos, pasa el turno a J2) | **cancela** el cambio y vuelve al puesto del que salió |
  | **C** | **entra a editar el nombre** del jugador marcado | — (mientras se elige reserva, C no hace nada) |
  Es **el mismo reparto que el resto de pantallas**: A avanza, B es el botón de salir/atrás, y C es la acción extra de esta pantalla. Salir de ALINEACIÓN con B es lo que hace que empiece el partido (o el sorteo), porque el flujo de este juego no tiene marcha atrás desde aquí; la palabra del hint es `VOLVER` y en `qa-paco.md` se confirma jugando que se entiende.
- **Esc sigue siendo la pausa, también editando un nombre** (G15-6, V15-2). Por eso **no** hay «cancelar edición con Esc»: se sale con Enter, y un nombre vacío vuelve al de la plantilla (`lineupEndEdit` de la Task 7).
- **Geometría, con el canvas de 800 × 500.** Minicampo 430 × 280 (proporción 1,536 ≈ 2000/1300) en 30,92 → acaba en 372. Panel de reservas a la derecha, 500 en adelante, filas de 30 desde 108: con la plantilla de dieciocho son **nueve** reservas hoy (108-378) y **siete** en V15-4 (108-318) — **cabe en los dos tamaños**, y el test lo comprueba con el peor caso, la novena fila, contra la línea de estado (412). Línea de estado en 412 y pista en 476.

- [ ] **Step 1: Escribir los tests en rojo**

1. En `components/games/football-screen/flow.test.ts`, añade al import de `./flow`: `LINEUP_BY_MODE, flowConfirmLineup, flowHasLineup, flowLineupBeginEdit, flowLineupCancelChoice, flowLineupChoose, flowLineupEndEdit, flowLineupMove`.

2. Sustituye el `it('solo modes pick one team and are done; …')` por:

```ts
  it('a friendly and the World Cup go on to ALINEACIÓN; the training is done there and then (G15-17)', () => {
    const solo = createFlowState();
    flowConfirmMode(solo);                                   // AMISTOSO
    solo.cursor = 4;
    expect(flowConfirmTeam(solo, BANK)).toBe('lineup');
    expect(solo.phase).toBe('lineup');
    expect(solo.picked).toEqual([4, -1]);
    expect(flowConfirmLineup(solo)).toBe('done');

    const training = createFlowState();
    flowMoveMode(training, 2);                               // ENTRENAMIENTO
    flowConfirmMode(training);
    training.cursor = 1;
    expect(flowHasLineup(training)).toBe(false);
    expect(flowConfirmTeam(training, BANK)).toBe('done');
    expect(training.phase).toBe('team-select');
    expect(LINEUP_BY_MODE).toEqual({ 'friendly-cpu': true, 'friendly-2p': true, training: false, 'world-cup': true });

    const two = createFlowState();
    flowMoveMode(two, 1);                                    // AMISTOSO A DOS
    flowConfirmMode(two);
    two.cursor = 2;
    expect(flowConfirmTeam(two, BANK)).toBe('next');
    expect(flowPickingHuman(two)).toBe(1);
    expect(flowConfirmTeam(two, BANK)).toBe('refused');      // the same team, G9-4: "sin repetir"
    two.cursor = 9;
    expect(flowConfirmTeam(two, BANK)).toBe('lineup');
    expect(two.picked).toEqual([2, 9]);
    expect(flowPickingHuman(two)).toBe(0);                   // J1's lineup first
    expect(flowConfirmLineup(two)).toBe('next');
    expect(flowPickingHuman(two)).toBe(1);
    expect(flowConfirmLineup(two)).toBe('done');
  });
```

3. Añade, dentro de ese mismo `describe('the team selector', …)`:

```ts
  it('the ALINEACIÓN cursor wraps, and the two sub-modes open and close (G15-17)', () => {
    const f = createFlowState();
    flowConfirmMode(f);
    f.cursor = 0;
    flowConfirmTeam(f, BANK);
    expect(f.phase).toBe('lineup');
    expect(f.lineupCursor).toBe(0);
    expect(f.lineupChoosing).toBe(-1);
    expect(f.lineupEditing).toBe(-1);
    flowLineupMove(f, 1, 9);
    expect(f.lineupCursor).toBe(1);
    flowLineupMove(f, -1, 9);
    flowLineupMove(f, -1, 9);
    expect(f.lineupCursor).toBe(8);                 // wraps backwards
    flowLineupMove(f, 1, 9);
    expect(f.lineupCursor).toBe(0);                 // and forwards
    flowLineupMove(f, 1, 0);
    expect(f.lineupCursor).toBe(0);                 // an empty list never moves the cursor

    flowLineupChoose(f, 3);
    expect(f.lineupChoosing).toBe(3);
    expect(f.lineupCursor).toBe(0);                 // the cursor restarts over the reserves
    expect(flowConfirmLineup(f)).toBe('none');      // B does not leave mid-substitution
    flowLineupCancelChoice(f);
    expect(f.lineupChoosing).toBe(-1);
    expect(f.lineupCursor).toBe(3);                 // back on the position it came from

    flowLineupBeginEdit(f, 7);
    expect(f.lineupEditing).toBe(7);
    expect(flowConfirmLineup(f)).toBe('none');      // nor mid-edit
    flowLineupEndEdit(f);
    expect(f.lineupEditing).toBe(-1);
    expect(flowConfirmLineup(f)).toBe('done');
  });
```

4. En `describe('flowBuildMode …')`, en el helper `start(…)` (al principio del fichero, busca `function start(`), el flujo pasa por la fase nueva. **Abre el helper y, tras el `flowConfirmTeam(...)`, añade `if (f.phase === 'lineup') flowConfirmLineup(f);` antes de construir el modo.** Si el helper ya construye el modo con `flowBuildMode(f, …)` seguido de `flowAfterModeBuilt(f, m)`, no hace falta nada más: `flowAfterModeBuilt` acepta ahora `'lineup'` además de `'team-select'`.

5. Sustituye el `describe('phaseGroup', …)` por:

```ts
describe('phaseGroup', () => {
  it('match and spectate are "match"; the other seven phases are "menu"', () => {
    const phases: FlowPhase[] = [
      'mode-select', 'team-select', 'lineup', 'draw', 'bracket', 'match', 'spectate', 'victory', 'over',
    ];
    expect(phases.map(phaseGroup)).toEqual([
      'menu', 'menu', 'menu', 'menu', 'menu', 'match', 'match', 'menu', 'menu',
    ]);
  });
});
```

6. En `components/games/football-screen/flow-layout.test.ts`, añade al import `LINEUP_HINT_Y, LINEUP_PITCH_H, LINEUP_PITCH_W, LINEUP_PITCH_X, LINEUP_PITCH_Y, LINEUP_RESERVE_H, LINEUP_RESERVE_TOP, LINEUP_RESERVE_X, LINEUP_STATUS_Y, lineupReserveY` y, dentro de `describe('the other screens', …)`:

```ts
  it('the ALINEACIÓN screen: a mini pitch on the left, the reserves on the right, both sizes (G15-17)', () => {
    expect(LINEUP_PITCH_X).toBeGreaterThan(0);
    expect(LINEUP_PITCH_X + LINEUP_PITCH_W).toBeLessThan(LINEUP_RESERVE_X);
    expect(Math.abs(LINEUP_PITCH_W / LINEUP_PITCH_H - 2000 / 1300)).toBeLessThan(0.02);
    expect(LINEUP_PITCH_Y + LINEUP_PITCH_H).toBeLessThan(LINEUP_STATUS_Y);
    expect(LINEUP_STATUS_Y).toBeLessThan(LINEUP_HINT_Y);
    expect(LINEUP_HINT_Y).toBeLessThan(VIEW_H);
    expect(lineupReserveY(0)).toBe(LINEUP_RESERVE_TOP);
    expect(lineupReserveY(1)).toBe(LINEUP_RESERVE_TOP + LINEUP_RESERVE_H);
    // A squad of eighteen: NINE reserves today (9 on the pitch) and seven once V15-4
    // plays eleven. The worst case is the ninth row; both must clear the status line.
    expect(lineupReserveY(8) + LINEUP_RESERVE_H).toBeLessThan(LINEUP_STATUS_Y);
    expect(lineupReserveY(6) + LINEUP_RESERVE_H).toBeLessThan(LINEUP_STATUS_Y);
    expect(LINEUP_RESERVE_X).toBeLessThan(VIEW_W - 60);
  });
```

7. En `components/games/football-screen/control-hints.test.ts`, añade `h.lineupBrowse, h.lineupSwap, h.lineupEdit` al array de `allTexts` y, al final del `describe`:

```ts
  it('the ALINEACIÓN hints name the three actions of G15-17 with Paco\'s own A/B/C split', () => {
    // A confirms or chooses, B goes back or cancels, C edits the name -- the same
    // split as every other screen (resolución (d), 23-sep).
    expect(CONTROL_HINTS.arrows.lineupBrowse).toBe('CRUCETA · A (J) CAMBIAR · C (L) NOMBRE · B (K) VOLVER');
    expect(CONTROL_HINTS.arrows.lineupSwap).toBe('CRUCETA: ELIGE RESERVA · A (J) CONFIRMA · B (K) CANCELA');
    expect(CONTROL_HINTS.classic.lineupBrowse).toBe('CRUCETA · A (Z) CAMBIAR · C (C) NOMBRE · B (X) VOLVER');
    expect(CONTROL_HINTS.classic.lineupSwap).toContain('(Z)');
  });

  it('the name editor hint names no key of any scheme: it is the letters themselves plus Enter', () => {
    for (const scheme of KEY_SCHEMES) {
      expect(CONTROL_HINTS[scheme].lineupEdit).toBe('ESCRIBE EL NOMBRE · MÁX. 12 · ENTER CONFIRMA');
    }
  });
```

- [ ] **Step 2: Verlos en rojo**

```bash
npx vitest run components/games/football-screen/flow.test.ts components/games/football-screen/flow-layout.test.ts components/games/football-screen/control-hints.test.ts
```
Esperado: **rojo** en los tres (`does not provide an export named 'LINEUP_BY_MODE'`, `'LINEUP_PITCH_X'`, y `expected undefined to be 'CRUCETA · A (J) CAMBIAR · C (L) NOMBRE · B (K) VOLVER'`).

- [ ] **Step 3: La fase en `flow.ts`**

1. `FlowPhase` (añade la línea tras `'team-select'`):

```ts
  | 'team-select'   // the twenty, with the formation selector (G9-4, G9-5, G15-9)
  | 'lineup'        // G15-17: starters, reserves and names, before a friendly or the World Cup
```

2. `phaseGroup` — añade `case 'lineup':` junto a los demás menús (la exhaustividad del switch es lo que obliga):

```ts
    case 'mode-select':
    case 'team-select':
    case 'lineup':
    case 'draw':
```

3. Bajo `HUMANS_BY_MODE`, añade:

```ts
// G15-17: only a friendly (either one) and the World Cup show ALINEACIÓN; the training
// is a practice screen and goes straight to the pitch.
export const LINEUP_BY_MODE: Readonly<Record<GameModeKind, boolean>> = {
  'friendly-cpu': true,
  'friendly-2p': true,
  training: false,
  'world-cup': true,
};
```

4. En `FlowState`, tras `bracketChoice`:

```ts
  lineupCursor: number;         // G15-17: the position, or the reserve while choosing
  lineupChoosing: number;       // the position being substituted, -1 = browsing
  lineupEditing: number;        // the squad index whose name is being typed, -1 = none
```

5. En `createFlowState` y en `flowReset`, ponlos a `0`, `-1`, `-1`. En `createFlowState` van en el literal; en `flowReset`, tres líneas nuevas junto a `f.bracketChoice = 0;`.

6. Tras `flowHumanCount`:

```ts
export function flowHasLineup(f: FlowState): boolean {
  return LINEUP_BY_MODE[flowModeKind(f)];
}

function resetLineupCursor(f: FlowState): void {
  f.lineupCursor = 0;
  f.lineupChoosing = -1;
  f.lineupEditing = -1;
}
```

7. `flowConfirmTeam` (sustituye la función entera):

```ts
// G9-4: solo modes pick one team; the two-player friendly picks J1 and then J2, and
// J2 may not repeat J1's team. G15-17: once every team is picked, a mode with a
// lineup screen goes there (J1's first, then J2's) instead of straight to the mode.
export function flowConfirmTeam(f: FlowState, bankSize: number): 'next' | 'lineup' | 'done' | 'refused' {
  if (f.phase !== 'team-select') return 'refused';
  if (f.cursor < 0 || f.cursor >= bankSize) return 'refused';
  if (f.picking === 1 && f.cursor === f.picked[0]) return 'refused';
  f.picked[f.picking] = f.cursor;
  if (f.picking === 0 && flowHumanCount(f) === 2) {
    f.picking = 1;
    return 'next';
  }
  if (!flowHasLineup(f)) return 'done';
  f.phase = 'lineup';
  f.picking = 0;
  resetLineupCursor(f);
  return 'lineup';
}
```

8. `flowAfterModeBuilt` — acepta venir de la pantalla nueva:

```ts
export function flowAfterModeBuilt(f: FlowState, m: GameMode): void {
  if (f.phase !== 'team-select' && f.phase !== 'lineup') return;
  f.phase = modeBracket(m) === null ? 'match' : 'draw';
}
```

9. Y, tras `flowConfirmTeam`, el bloque de la pantalla:

```ts
// ── lineup (G15-17) ─────────────────────────────────────────────────────────────

// The cursor wraps over whatever list the screen is showing -- the positions while
// browsing, the legal reserves while choosing. The COUNT comes from the component,
// which is the one holding the Lineup: the flow never hard-codes a team size.
export function flowLineupMove(f: FlowState, delta: number, count: number): void {
  if (f.phase !== 'lineup' || f.lineupEditing !== -1 || count <= 0) return;
  f.lineupCursor = (((f.lineupCursor + delta) % count) + count) % count;
}

export function flowLineupChoose(f: FlowState, position: number): void {
  if (f.phase !== 'lineup' || f.lineupEditing !== -1) return;
  f.lineupChoosing = position;
  f.lineupCursor = 0;
}

export function flowLineupCancelChoice(f: FlowState): void {
  if (f.phase !== 'lineup' || f.lineupChoosing === -1) return;
  f.lineupCursor = f.lineupChoosing;
  f.lineupChoosing = -1;
}

export function flowLineupBeginEdit(f: FlowState, squadIndex: number): void {
  if (f.phase !== 'lineup' || f.lineupChoosing !== -1) return;
  f.lineupEditing = squadIndex;
}

export function flowLineupEndEdit(f: FlowState): void {
  if (f.phase !== 'lineup') return;
  f.lineupEditing = -1;
}

// B on ALINEACIÓN (Paco's (d): B is the back/leave button of every screen): J2's turn
// in the two-player friendly, or "the component may build the mode now". Refused
// ('none') while a substitution or an edit is open -- there B cancels instead, so a
// half finished change never starts a match.
export function flowConfirmLineup(f: FlowState): 'next' | 'done' | 'none' {
  if (f.phase !== 'lineup') return 'none';
  if (f.lineupChoosing !== -1 || f.lineupEditing !== -1) return 'none';
  if (f.picking === 0 && flowHumanCount(f) === 2) {
    f.picking = 1;
    resetLineupCursor(f);
    return 'next';
  }
  return 'done';
}
```

- [ ] **Step 4: La geometría en `flow-layout.ts`**

Al final del fichero:

```ts
// ── ALINEACIÓN (G15-17): the mini pitch on the left, the bench on the right ──────
// 430 x 280 keeps the 2000 x 1300 ratio. The bench rows are 30 apart from 108: NINE
// reserves (a squad of eighteen with nine on the pitch, today) reach 378 and the
// seven of V15-4 reach 318 -- both clear the status line at 412.
export const LINEUP_PITCH_X = 30;
export const LINEUP_PITCH_Y = 92;
export const LINEUP_PITCH_W = 430;
export const LINEUP_PITCH_H = 280;
export const LINEUP_LABEL_DY = 14;
export const LINEUP_RESERVE_X = 500;
export const LINEUP_RESERVE_TOP = 108;
export const LINEUP_RESERVE_H = 30;
export const LINEUP_STATUS_Y = 412;
export const LINEUP_HINT_Y = 476;

export function lineupReserveY(index: number): number {
  return LINEUP_RESERVE_TOP + index * LINEUP_RESERVE_H;
}
```

- [ ] **Step 5: Los textos en `control-hints.ts`**

En `ControlHints`, tras `victory`:

```ts
  readonly lineupBrowse: string;   // ALINEACIÓN: moving over the eleven (nine today)
  readonly lineupSwap: string;     // ALINEACIÓN: picking the reserve who comes on
  readonly lineupEdit: string;     // ALINEACIÓN: typing a name
```

En `buildHints`, junto a `const a = keyLabel(table, 'a');`:

```ts
  const b = keyLabel(table, 'b');
  const c = keyLabel(table, 'c');
```
y, tras `victory`:

```ts
    // Paco's (d): A confirms/chooses, B goes back or cancels, C edits the name.
    lineupBrowse: `CRUCETA · A (${a}) CAMBIAR · C (${c}) NOMBRE · B (${b}) VOLVER`,
    lineupSwap: `CRUCETA: ELIGE RESERVA · A (${a}) CONFIRMA · B (${b}) CANCELA`,
    // No key letters: while editing, the letters ARE the input (G15-17).
    lineupEdit: LINEUP_EDIT_HINT,
```
y, sobre `buildHints`:

```ts
const LINEUP_EDIT_HINT = 'ESCRIBE EL NOMBRE · MÁX. 12 · ENTER CONFIRMA';
```

- [ ] **Step 6: Verlos en verde**

```bash
npx vitest run components/games/football-screen/
npx tsc --noEmit
```
Esperado: los tests de `football-screen/` **verdes**; `tsc` **rojo** en `VaultWorldCupGame.tsx` con `TS2367`/`TS2678` en `menuAction` (el `switch` sobre `flow.phase` ya no es exhaustivo: falta `case 'lineup'`) y con `result !== 'done'` en `confirmTeam`. **Es el rojo intencionado que cierra la Task V15-3-9.**

- [ ] **Step 7: Controles negativos**

**Uno cada vez, deshaz en el acto.**
1. En `flow.ts`, pon `training: true` en `LINEUP_BY_MODE`. → `flow.test.ts` **rojo**: `expected 'lineup' to be 'done'`. **Deshaz.**
2. En `flowConfirmLineup`, quita la guarda de `lineupChoosing`. → **rojo**: `expected 'done' to be 'none'`. **Deshaz.**
3. En `flowLineupCancelChoice`, quita `f.lineupCursor = f.lineupChoosing;`. → **rojo**: `expected 0 to be 3`. **Deshaz.**
4. En `phaseGroup`, mueve `case 'lineup':` junto a `'match'`. → **rojo**: `expected [ …, 'match', … ] to deeply equal [ …, 'menu', … ]`. **Deshaz.**
5. En `flow-layout.ts`, pon `LINEUP_RESERVE_X = 440`. → `flow-layout.test.ts` **rojo**: `expected 460 to be less than 440` (el banquillo pisaría el minicampo). **Deshaz.**
6. En `flow-layout.ts`, pon `LINEUP_RESERVE_H = 40`. → **rojo**: `expected 468 to be less than 412` (con nueve reservas y filas de 40 el banquillo se comería la línea de estado). Es el control que vigila que la plantilla de dieciocho **cabe** en la pantalla. **Deshaz.**

- [ ] **Step 8: Gates de la tarea**

```bash
npx vitest run
npx eslint components/games/football-screen/flow.ts components/games/football-screen/flow.test.ts components/games/football-screen/flow-layout.ts components/games/football-screen/flow-layout.test.ts components/games/football-screen/control-hints.ts components/games/football-screen/control-hints.test.ts
git diff --name-only ef61be7 -- components/games/football-logic/ | sort
grep -n "lineup" components/games/football-screen/flow.ts | grep -i "import"
```
Esperado: **1382 tests en 83 ficheros verdes**; `eslint` sin salida; el `--name-only` con las **nueve** líneas de la Task 6; el último `grep` **vacío** (`flow.ts` **no** importa `lineup.ts`: la fase no conoce el modelo).

- [ ] **Step 9: Cerrar — NO ejecutes `git add` ni `git commit`**

```
V15-3-8: fase 'lineup' en flow.ts (amistoso y Mundial sí, entrenamiento no; a dos, J1 y luego J2), cursor y submodos cambio/edición, geometría de la pantalla en flow-layout.ts (nueve reservas caben) y tres textos por esquema en control-hints.ts con el reparto de Paco (A confirma/elige, B vuelve o cancela, C nombre). flow.ts NO importa lineup.ts. 1382/83 verdes; tsc rojo a propósito en el .tsx hasta la Task 9.
```

---

### Task V15-3-9: la pantalla ALINEACIÓN en el componente, el catálogo y la anotación del spec (G15-17)

**Files:**
- Modify: `components/games/VaultWorldCupGame.tsx` (imports; estado del montaje `:350-365`; `confirmTeam` `:682-692`; `menuTable`/`tableForPicker`/`pauseTables` `:1677-1693`; `menuAction` `:1708-1748`; `handleKeyDown` `:1832-1897`; `draw()` — el `switch` por fase)
- Modify: `lib/games-registry.ts` (entrada `vault-world-cup`: `instructions.goal` `:445`, `tips` `:446-453`)
- Modify: `lib/games-registry.test.ts` (+1 test)
- Modify: `specs/31-vault-world-cup.md`

**Interfaces:**
- Consumes de las Tasks V15-3-6/7/8, y **éstos son exactamente los imports nuevos del `.tsx`** (ni uno más: `eslint` marca un import sin usar):
  - de `./football-logic/squads`: `SQUAD_SIZE`
  - de `./football-screen/lineup`: `GK_POSITION`, `applySwap`, `canSwap`, `createLineup`, `lineupBackspace`, `lineupEndEdit`, `lineupName`, `lineupTypeChar`, `loadLineup`, `saveLineup`, `type Lineup`
  - de `./football-screen/flow`: `flowConfirmLineup`, `flowLineupBeginEdit`, `flowLineupCancelChoice`, `flowLineupChoose`, `flowLineupEndEdit`, `flowLineupMove`
  - de `./football-screen/flow-layout`: `LINEUP_HINT_Y`, `LINEUP_LABEL_DY`, `LINEUP_PITCH_H`, `LINEUP_PITCH_W`, `LINEUP_PITCH_X`, `LINEUP_PITCH_Y`, `LINEUP_RESERVE_X`, `LINEUP_STATUS_Y`, `lineupReserveY`
  - ya importados desde antes: `TEAMS`, `FORMATIONS`, `type Formation`, `type TeamDef`, `previewGkX`, `previewGkY`, `previewSlotX`, `previewSlotY`, `CONTROL_HINTS`, `flowPickingHuman`, `flowHumanCount`.
  > **`lineupPositionCount`, `lineupReserveCount`, `lineupRoleAt`, `defaultLineup`, `checkLineup`, `squadRole`, `squadNumber` y `flowHasLineup` NO se importan aquí**: el `.tsx` lee `l.starters.length` y `l.reserves.length`, y las decisiones de rol y de tamaño ya están tomadas dentro de `lineup.ts` y de `flow.ts`.
- Produces: nada que consuma otra tarea.

**Contexto que el ejecutor no tiene:**
- **Criterio 20 en esta pantalla.** Igual que el cuadro: **todas** las cadenas (`«9 ESPEJEL»`, la línea de estado) se componen en `refreshLineupView()`, que corre al entrar, tras cada cambio y tras cada tecla de edición — **nunca por frame**. `drawLineup()` solo lee arrays creados al montar. Los números de camiseta salen de `SHIRT_LABELS`, **dieciocho** cadenas construidas **una vez** al cargar el módulo, para que ni siquiera un `String(n)` entre en un evento.
- **El reparto de botones es el de Paco (resolución (d)), no el del borrador de este plan:** **A confirma / elige**, **B vuelve o cancela** (y es quien sale de la pantalla), **C entra a editar el nombre**. Está en la Task V15-3-8 con su tabla; aquí solo hay que cablearlo **en ese orden** — si escribes `'b'` → editar y `'c'` → salir, lo has puesto al revés.
- **Dónde vive el modelo.** Dos `Lineup` creados **una vez** al montar (`lineups[0]`, `lineups[1]`), uno por humano, y dos closures sobre `window.localStorage` creadas **una vez** —el patrón exacto de `readStoredScheme`/`writeStoredScheme` de V15-2—, que `loadLineup`/`saveLineup` envuelven en `try/catch`.
- **Cuándo se carga y cuándo se guarda.** Se carga al **entrar** en la pantalla (por selección y con la formación elegida). Se guarda al **salir con C**, antes de construir el modo, del humano que la estaba editando. No se guarda por cada cambio: un `JSON.stringify` por pulsación sería ruido, y si el jugador cierra la pestaña a media pantalla es razonable que no se guarde.
- **El rival no se ve en ALINEACIÓN, y está decidido** (resolución (a) de Paco, 23-sep). La pantalla enseña **solo tu alineación**, con dorsales y nombres, porque el rival de un amistoso se sortea al construir el modo (`flowBuildMode`), que ocurre **después** de esta pantalla, y el del Mundial sale del sorteo, que ocurre después también. **Ver a los dos equipos es otra pantalla y es de V15-5**: la pantalla previa de G15-19, que va justo al pulsar JUGAR, ya con rival sorteado, **sin nombres** — solo las dos formaciones de pie con sus equipaciones, para dar ambiente. **No la hagas aquí** y no muevas ALINEACIÓN detrás del sorteo.
- **La CPU siempre con sus titulares** (G15-17) es lo que ya pasa: el partido no lee `lineup.ts` en este paso, así que la CPU juega con la plantilla por defecto por construcción.
- **Las teclas de la edición de nombre no pasan por la tabla.** Mientras `flow.lineupEditing !== -1`, `handleKeyDown` consume **cualquier** letra, `Backspace` y `Enter` **antes** del `padKeyFor(table, key)`: si no, con el teclado CLÁSICO la `A` movería el cursor en vez de escribir una A. Lo único que sigue teniendo prioridad sobre la edición es `isPauseKey` (Esc), que ya está arriba del todo en el handler.
- **`menuAction` es un `switch` exhaustivo sobre `FlowPhase`**: al añadir `'lineup'` en la Task 8, `tsc` obliga a añadir el `case` aquí. No lo metas en el `default`.

- [ ] **Step 1: El estado del montaje**

Junto a las closures del esquema de teclado (busca `const readStoredScheme = (): string | null =>`), añade:

```ts
    // G15-17: one Lineup per human, created ONCE (criterion 20); the names and the
    // starters of a selection are loaded on entering ALINEACIÓN and saved on leaving
    // it. Two closures over localStorage, like the key scheme's: loadLineup and
    // saveLineup wrap them in try/catch, so a private window simply starts on the
    // default lineup and forgets.
    const lineups: readonly [Lineup, Lineup] = [createLineup(), createLineup()];
    const readLineup = (key: string): string | null => window.localStorage.getItem(key);
    const writeLineup = (key: string, value: string): void => {
      window.localStorage.setItem(key, value);
    };
    // Built on an event (refreshLineupView), never per frame. Eighteen, one per squad
    // member (SQUAD_SIZE), written with literals -- no new Array, no .fill.
    const lineupLabels: string[] = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    const lineupChoices: number[] = [];
    let lineupChoiceCount = 0;
    let lineupTitle = '';
    let lineupStatus = '';
```
Y junto a las constantes de módulo:

```ts
// Eighteen shirt numbers as text, built once at module load: not even a String(n)
// runs on an event (criterion 20).
const SHIRT_LABELS: readonly string[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18',
];
const LINEUP_TITLE_PREFIX = 'ALINEACIÓN · ';
const LINEUP_STATUS_SWAP = 'ELIGE QUIÉN ENTRA POR ';
const LINEUP_STATUS_EDIT = 'ESCRIBIENDO: ';
// With the squad of eighteen this line should never appear (every role keeps someone
// on the bench, keeper included -- that is what checkSquadCoversFormations enforces).
// It stays as the honest answer if a future formation ever empties a line: an empty
// list with no explanation would look like a bug. Do NOT delete it as dead code.
const LINEUP_NO_RESERVE = 'SIN RESERVA PARA ESE PUESTO';
const LINEUP_CURSOR_RING = 6;
```

- [ ] **Step 2: Abrir, refrescar y cerrar la pantalla**

Junto a `refreshBracketView`, añade:

```ts
    function lineupHuman(): 0 | 1 {
      return flowPickingHuman(flow);
    }

    function lineupTeam(): TeamDef {
      return TEAMS[flow.picked[lineupHuman()]];
    }

    function lineupFormation(): Formation {
      return FORMATIONS[flow.formation[lineupHuman()]];
    }

    // Entering ALINEACIÓN (from the team selector, or from J1's screen to J2's).
    function openLineup(): void {
      const who = lineupHuman();
      loadLineup(readLineup, lineupTeam().id, lineupFormation(), lineups[who]);
      refreshLineupView();
      reportStatus(lineupTitle);
    }

    function saveLineupOf(who: 0 | 1): void {
      saveLineup(writeLineup, TEAMS[flow.picked[who]].id, FORMATIONS[flow.formation[who]], lineups[who]);
    }

    // Every string of the screen, on an event: entering, a swap, a typed letter.
    // Also the list of legal reserves for the position being substituted, which is
    // what the cursor walks while flow.lineupChoosing !== -1.
    function refreshLineupView(): void {
      const f = lineupFormation();
      const l = lineups[lineupHuman()];
      const teamId = lineupTeam().id;
      lineupTitle = LINEUP_TITLE_PREFIX + lineupTeam().name;
      for (let i = 0; i < SQUAD_SIZE; i++) {
        lineupLabels[i] = SHIRT_LABELS[i] + ' ' + lineupName(l, teamId, i);
      }
      lineupChoiceCount = 0;
      lineupChoices.length = SQUAD_SIZE;
      if (flow.lineupChoosing !== -1) {
        for (let i = 0; i < SQUAD_SIZE; i++) {
          if (!canSwap(f, l, flow.lineupChoosing, i)) continue;
          lineupChoices[lineupChoiceCount] = i;
          lineupChoiceCount++;
        }
        lineupStatus = lineupChoiceCount === 0
          ? LINEUP_NO_RESERVE
          : LINEUP_STATUS_SWAP + lineupLabels[l.starters[flow.lineupChoosing]];
      } else if (flow.lineupEditing !== -1) {
        lineupStatus = LINEUP_STATUS_EDIT + lineupLabels[flow.lineupEditing];
      } else {
        lineupStatus = '';
      }
    }

    // The squad index the cursor is on: a starter while browsing, a legal reserve
    // while choosing. -1 when there is nothing to point at.
    function lineupCursorIndex(): number {
      const l = lineups[lineupHuman()];
      if (flow.lineupChoosing === -1) {
        return flow.lineupCursor < l.starters.length ? l.starters[flow.lineupCursor] : -1;
      }
      return flow.lineupCursor < lineupChoiceCount ? lineupChoices[flow.lineupCursor] : -1;
    }

    // B on ALINEACIÓN while browsing (Paco's (d)). flowConfirmLineup refuses ('none')
    // mid-swap or mid-edit, so a half finished change never starts a match.
    function confirmLineup(): void {
      const who = lineupHuman();
      const result = flowConfirmLineup(flow);
      if (result === 'none') return;
      saveLineupOf(who);
      if (result === 'next') {
        openLineup();
        return;
      }
      buildModeAndGo();
    }
```

- [ ] **Step 3: Partir `confirmTeam` en dos**

Sustituye `confirmTeam` por:

```ts
    // A on the team selector: J1 (and J2 in the two-player mode), then either the
    // ALINEACIÓN screen (G15-17) or, in the training, straight to the mode.
    function confirmTeam(): void {
      const result = flowConfirmTeam(flow, BANK_IDS.length);
      if (result === 'lineup') {
        openLineup();
        return;
      }
      if (result !== 'done') return;
      buildModeAndGo();
    }

    // The mode is built HERE, the one place, once per run (Vault Fighter's
    // confirmSelection). Reached from the training's team selector or from the last
    // ALINEACIÓN screen.
    function buildModeAndGo(): void {
      runSeed = fixedSeed ?? Date.now();          // the one Date.now() of the whole game (G9-7)
      mode = flowBuildMode(flow, BANK_IDS, runSeed);
      fxRng = createRng(fxSeedFor(runSeed));      // the fourth stream, never the match's
      flowAfterModeBuilt(flow, mode);
      if (modeBracket(mode) === null) startHumanMatch();
      else refreshDrawView();
    }
```

- [ ] **Step 4: Las teclas**

1. En `tableForPicker` y en `pauseTables`, la fase nueva se comporta como el selector:

```ts
    function tableForPicker(): KeyTable {
      return flowHumanCount(flow) === 2 ? TWO_PLAYER_TABLES[flowPickingHuman(flow)] : menuTable();
    }
```
(no cambia), y en `pauseTables`:

```ts
      if ((phase === 'team-select' || phase === 'lineup') && flowHumanCount(flow) === 2) return TWO_PLAYER_TABLES;
```

2. En `menuAction`, añade el caso (el `switch` es exhaustivo: `tsc` lo exige):

```ts
        case 'lineup': {
          const f2 = lineupFormation();
          const l = lineups[lineupHuman()];
          if (k === 'up' || k === 'left') flowLineupMove(flow, -1, flow.lineupChoosing === -1 ? l.starters.length : lineupChoiceCount);
          else if (k === 'down' || k === 'right') flowLineupMove(flow, 1, flow.lineupChoosing === -1 ? l.starters.length : lineupChoiceCount);
          else if (k === 'a') {
            if (flow.lineupChoosing === -1) flowLineupChoose(flow, flow.lineupCursor);
            else {
              const incoming = lineupCursorIndex();
              if (incoming !== -1) applySwap(f2, l, flow.lineupChoosing, incoming);
              flowLineupCancelChoice(flow);
            }
          } else if (k === 'b') {
            // Paco's (d): B is the back/cancel button. Mid-substitution it cancels;
            // browsing, it leaves ALINEACIÓN (J2's turn, or build the mode).
            if (flow.lineupChoosing !== -1) flowLineupCancelChoice(flow);
            else {
              confirmLineup();
              // The screen may be gone; refreshing a dead one would read the next team.
              if (flow.phase !== 'lineup') return true;
            }
          } else if (k === 'c') {
            // Paco's (d): C opens the name editor. It does nothing mid-substitution.
            if (flow.lineupChoosing === -1) {
              const target = lineupCursorIndex();
              if (target !== -1) flowLineupBeginEdit(flow, target);
            }
          } else return false;
          refreshLineupView();
          return true;
        }
```

3. En `handleKeyDown`, **justo después** del bloque de `isPauseKey` y del `if (pausedRef.current || blocked) return;`, y **antes** de `if (e.repeat) return;`, añade:

```ts
      // G15-17: while a name is being typed, the letters ARE the input -- they must
      // not reach padKeyFor, or CLÁSICO's Q/A/O/P would move the cursor instead of
      // writing. Esc (the pause) is the only thing above this, and it already ran.
      if (flow.phase === 'lineup' && flow.lineupEditing !== -1) {
        const editing = flow.lineupEditing;
        const l = lineups[lineupHuman()];
        if (e.key === 'Enter') {
          lineupEndEdit(l, editing);
          flowLineupEndEdit(flow);
        } else if (e.key === 'Backspace') {
          lineupBackspace(l, editing);
        } else if ([...e.key].length !== 1 || !lineupTypeChar(l, editing, e.key)) {
          return;
        }
        e.preventDefault();
        refreshLineupView();
        return;
      }
```

4. Al final de `handleKeyDown`, la rama de la fila de formación sigue siendo **solo** de `team-select` (en ALINEACIÓN la formación ya está elegida):

```ts
      if (phase === 'team-select') {
```
(no cambia — comprueba que no la has ampliado a `'lineup'`).

5. En la línea que elige la tabla del menú, añade la fase nueva:

```ts
      const table = phase === 'team-select' || phase === 'lineup' ? tableForPicker() : menuTable();
```

- [ ] **Step 5: El dibujo**

En el `switch` por fase de `draw()`, añade `case 'lineup': drawLineup(); break;` junto a `case 'team-select'`. Y, tras `drawTeamSelect`/`drawFormationPreview`, añade:

```ts
    // G15-17: the starters on a mini pitch with shirt number and name, the reserves
    // on the right, and the cursor ring on whichever list is live. Only YOUR team:
    // the rival is drawn from V15-5 on (the draw has not happened yet at this point).
    function drawLineup(): void {
      drawMenuBackground(lineupTitle);
      const f = lineupFormation();
      const def = lineupTeam();
      const l = lineups[lineupHuman()];
      drawFormationPreview(f, def, LINEUP_PITCH_X, LINEUP_PITCH_Y, LINEUP_PITCH_W, LINEUP_PITCH_H);
      ctx.font = FONT_HALF;
      ctx.textAlign = 'center';
      for (let p = 0; p < l.starters.length; p++) {
        const px = p === GK_POSITION
          ? previewGkX(LINEUP_PITCH_X, LINEUP_PITCH_W)
          : previewSlotX(f, p - 1, LINEUP_PITCH_X, LINEUP_PITCH_W);
        const py = p === GK_POSITION
          ? previewGkY(LINEUP_PITCH_Y, LINEUP_PITCH_H)
          : previewSlotY(f, p - 1, LINEUP_PITCH_Y, LINEUP_PITCH_H);
        const live = flow.lineupChoosing === -1 ? p === flow.lineupCursor : p === flow.lineupChoosing;
        if (live) {
          ctx.strokeStyle = HUD_ACCENT;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, LINEUP_CURSOR_RING, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = live ? HUD_ACCENT : HUD_TEXT;
        // H13: the keeper sits at PREVIEW_GK_X (49 px) and the centre back of the
        // 3-3-2 and the 3-2-3 at x = 0.22 (125 px) on the SAME line (y = 0.5). A
        // 12-13 character label is 79-86 px wide, so both under the dot would overlap
        // by ~7 px and the keeper's would run off the left of the pitch. His label
        // goes ABOVE his dot instead; nobody shares that spot.
        ctx.fillText(
          lineupLabels[l.starters[p]], px,
          p === GK_POSITION ? py - LINEUP_LABEL_DY : py + LINEUP_LABEL_DY,
        );
      }
      // The bench: every reserve while browsing, only the legal ones while choosing.
      ctx.textAlign = 'left';
      ctx.font = FONT_SMALL;
      const choosing = flow.lineupChoosing !== -1;
      const count = choosing ? lineupChoiceCount : l.reserves.length;
      for (let i = 0; i < count; i++) {
        const index = choosing ? lineupChoices[i] : l.reserves[i];
        const live = choosing && i === flow.lineupCursor;
        ctx.fillStyle = live ? HUD_ACCENT : choosing ? HUD_TEXT : HUD_DIM;
        ctx.fillText(lineupLabels[index], LINEUP_RESERVE_X, lineupReserveY(i));
      }
      if (lineupStatus !== '') {
        ctx.textAlign = 'center';
        ctx.fillStyle = HUD_ACCENT;
        ctx.fillText(lineupStatus, VIEW_W / 2, LINEUP_STATUS_Y);
      }
      const hints = CONTROL_HINTS[flow.keyScheme];
      drawHint(
        flow.lineupEditing !== -1 ? hints.lineupEdit : flow.lineupChoosing !== -1 ? hints.lineupSwap : hints.lineupBrowse,
        LINEUP_HINT_Y,
      );
    }
```

- [ ] **Step 6: El catálogo**

En `lib/games-registry.ts`, entrada `vault-world-cup`:

```ts
      goal: 'Elige uno de los cuatro modos y llévate el balón: en AMISTOSO ganas un partido a la CPU o a otro jugador en tu mismo teclado, en ENTRENAMIENTO practicas sin reloj ni marcador contra un rival congelado, y en MUNDIAL disputas octavos, cuartos, semifinal y final en un cuadro de dieciséis selecciones sorteadas de veinte, la tuya entre ellas, sin CONTINUE. Solo el Mundial apunta en la tabla.',
```
Y añade un `tip` tras el de la alineación 1/2/3:

```ts
        'Antes de un amistoso o del Mundial pasas por ALINEACIÓN: cruceta para moverte, A cambia un titular por una reserva de su misma posición (el portero solo por el otro portero), C edita su nombre (máximo 12 letras, Enter confirma) y B sale y empieza; tu alineación y tus nombres se guardan por selección',
```

En `lib/games-registry.test.ts`, añade:

```ts
  it('the VAULT WORLD CUP catalogue describes the v1.5 content: twenty selections, a World Cup of sixteen and ALINEACIÓN', () => {
    const game = GAMES['vault-world-cup'];
    expect(game.instructions.goal).toContain('dieciséis selecciones sorteadas de veinte');
    expect(game.instructions.goal).toContain('octavos');
    expect(game.instructions.goal).not.toContain('ocho selecciones');
    expect(game.instructions.tips.some((t) => t.includes('ALINEACIÓN'))).toBe(true);
  });
```
(usa el mismo `import` de `GAMES` que ya tenga el fichero; si importa `getGame`, escribe `const game = getGame('vault-world-cup')` con su guarda de `undefined`, como hagan los tests vecinos).

- [ ] **Step 7: El spec**

**7a. «Corregir spec» (G15-7).** El spec todavía dice «ocho de dieciséis» en seis sitios. **No reescribas la narrativa histórica**: añade la anotación entre paréntesis detrás del número, que es como el spec lleva marcadas las revisiones de la v1.5. Localiza cada uno por su texto y anótalo:

| Texto a buscar | Anotación a añadir |
|---|---|
| `**Mundial** (8 selecciones sorteadas de un banco mayor` (≈ `:52`) | `(v1.5, G15-7: 16 de 20)` |
| `**Banco de selecciones** de dieciséis` (≈ `:54`) | `(v1.5, G15-9: veinte)` |
| `Un Mundial perfecto vale **61 000 sin contar goles** (3 × 5 000 + 3 × 2 000 + 40 000)` (≈ `:331`) | `(v1.5, G15-8: 70 500 = 4 × 5 000 + 4 × 2 000 + 42 500)` |
| `**Banco de dieciséis selecciones**, ocho por Mundial` (≈ `:342`) | `(v1.5: veinte, dieciséis por Mundial)` |
| `15. **El Mundial sortea ocho de un banco de dieciséis**, eliminatoria directa de tres partidos` (≈ `:538`) | `(v1.5, G15-7: dieciséis de veinte, cuatro partidos)` |
| `la cuenta del Mundial perfecto es ~70 000, no 80 000** (61 000 base + goles)` (≈ `:622`) | `(v1.5, G15-8: 70 500 base)` |

**7b.** Bajo el bullet de **G15-17**, añade una línea (en castellano, como el resto del bullet):

```
    *Implementado en V15-3 (2026-09-23) con los titulares derivados de la formación (`slots.length + 1`: hoy 9 = 8 de campo + portero; 11 cuando V15-4 aplique G15-16) y las reservas como `SQUAD_SIZE` menos eso (hoy 9, luego 7): la plantilla y los dorsales son fijos, el reparto titulares/reservas no. **La plantilla sube de 14 a 18 (2 porteros + 6 defensas + 6 medios + 4 delanteros, dorsales 1-18), decisión de Paco del 23-sep**: con 14 y once titulares, la 4-4-2 se quedaba sin reserva de medio y la 5-3-2 sin reserva de defensa, así que el «reserva DEF/MED/DEL» de este bullet no se cumplía, y el segundo portero es el que cubre G15-18. Botones de la pantalla: A confirma o elige, B vuelve o cancela, C edita el nombre. Quedan para V15-4 que la alineación elegida llegue al partido (`PlayerState` no tiene nombre ni dorsal) y los cambios por lesión (G15-18), y para V15-5 los nombres en los eventos y el dorsal sobre el controlado (G15-11) y la pantalla previa con los dos equipos sin nombres (G15-19).*
```

- [ ] **Step 8: Verificar**

```bash
npx tsc --noEmit
npx vitest run
npx eslint components/games/VaultWorldCupGame.tsx lib/games-registry.ts lib/games-registry.test.ts
```
Esperado: `tsc` **sin salida**; **1383 tests en 83 ficheros verdes**; `eslint` sin salida (y `page.tsx`, que no se toca, sigue con sus 3 errores preexistentes).

- [ ] **Step 9: Revisión de asignaciones por frame (criterio 20)**

```bash
git diff ef61be7 -- components/games/VaultWorldCupGame.tsx
```
Comprueba, una por una:
1. En `drawLineup` no hay `new`, ni literales de objeto/array, ni plantillas ni concatenaciones de string, ni `.map(`/`.filter(`, ni `=>` nuevos. **Toda** concatenación vive en `refreshLineupView`.
2. `lineups`, `lineupLabels`, `lineupChoices`, `readLineup` y `writeLineup` se crean **una vez**, en el bloque de «Everything below is created ONCE».
3. `SHIRT_LABELS` es de módulo; no hay ningún `String(` ni `.toString()` nuevo.
4. `refreshLineupView()` se llama al abrir la pantalla y al final de **cada** rama de `menuAction` case `'lineup'` y de la rama de edición de `handleKeyDown`; **nunca** desde `draw()`.
5. `window.localStorage` aparece **solo** en `readLineup`/`writeLineup` (más las dos del esquema de teclado de V15-2). `grep -n "localStorage" components/games/VaultWorldCupGame.tsx` → cuatro líneas de código.
6. El `switch` de `menuAction` cubre las nueve fases y no tiene `default`.
7. **El reparto A/B/C es el de Paco** (`'a'` elige/confirma, `'b'` cancela o sale, `'c'` edita el nombre) y coincide **letra por letra** con `CONTROL_HINTS[...].lineupBrowse`/`.lineupSwap` de la Task 8 y con el `tip` del catálogo. Si el hint dice una cosa y `menuAction` otra, el bug está aquí.
8. La etiqueta del portero va **encima** de su punto (`py - LINEUP_LABEL_DY`) y la de los demás debajo (H13).

- [ ] **Step 10: Cerrar — NO ejecutes `git add` ni `git commit`**

```
V15-3-9: pantalla ALINEACIÓN en el .tsx (minicampo con dorsal+nombre, banquillo de nueve, cambio por posición con A, nombre con C / Enter, B vuelve y arranca — reparto de Paco), etiqueta del portero encima de su punto para no pisar al central, dos Lineup creados al montar y persistidos por selección con try/catch, confirmTeam partido en confirmTeam + buildModeAndGo, catálogo y spec actualizados. tsc limpio, 1383/83 verdes.
```

---

### Task V15-3-10 (cierre): verificación del paso, lista de QA de Paco y mensaje de commit

**Files:**
- Modify: `.superpowers/sdd/2026-09-23-vault-world-cup-v15-3/progress.md`
- Create: `.superpowers/sdd/2026-09-23-vault-world-cup-v15-3/qa-paco.md`
- Ningún fichero de código se toca en esta tarea. Si al verificar aparece un fallo, **se arregla en la tarea que lo introdujo**, no aquí.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la lista con la que Paco hace el QA jugado (G15-22: «QA jugado al final de cada uno») y el mensaje de commit del paso.

- [ ] **Step 1: Verificación completa del paso**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-logic/ components/games/football-screen/ components/games/VaultWorldCupGame.tsx lib/games-registry.ts lib/games-registry.test.ts
```
Esperado: **1383 tests en 83 ficheros verdes** (1338 + 9 + 8 + 1 + 4 + 0 + 8 + 10 + 4 + 1 + 0; 80 + 3), `tsc` sin salida, `eslint` sin salida.

> Las correcciones del pre-vuelo (H1-H4, H7) son **ediciones de tests existentes**, no altas: el objetivo **sigue siendo 1383 / 83**. Lo que sí cambió es que ahora **ninguna compuerta intermedia sale roja**.

- [ ] **Step 2: Las compuertas de las Global Constraints**

```bash
git diff --name-only ef61be7 -- components/games/football-logic/ | sort
git diff --stat ef61be7 -- components/games/football-logic/ai.ts components/games/football-logic/ai.test.ts components/games/football-logic/match.ts components/games/football-logic/match.test.ts components/games/football-logic/step.ts components/games/football-logic/players.ts components/games/football-logic/actions.ts components/games/football-logic/input.ts components/games/football-logic/set-pieces.ts components/games/football-logic/mode.ts components/games/football-logic/kits.ts components/games/football-logic/invariants.ts
grep -rn "Math.random" components/games/football-logic/ components/games/football-screen/
grep -rnE "(navigator|window|document|localStorage)\.[a-zA-Z]+\(" components/games/football-screen/ components/games/football-logic/
grep -rn "@/" components/games/football-screen/lineup.ts components/games/football-screen/formation-preview.ts components/games/football-logic/squads.ts
git diff ef61be7 -- '*.ts' '*.tsx' | grep "^+" | grep -v "^+++" | grep -nE " as |!\.|: any"
find .superpowers -name "*.ts" -o -name "*.tsx"
grep -nE "\b11\b|\b3\b" components/games/football-screen/lineup.ts
grep -rn "squads" components/games/football-logic/ --include=*.ts | grep -v "squads.ts\|squads.test.ts"
git diff --stat ef61be7 -- components/games/football-logic/mode.ts
grep -rn "isStillIn\|BRACKET_ELIMINATED\|bracketRowText" components/games/VaultWorldCupGame.tsx
```
Esperado: el primero, **exactamente** las **nueve** líneas de las Global Constraints (con `mode.test.ts`); el `--stat` **vacío** (el partido, byte a byte como en `ef61be7`: **sin regrabado**); `Math.random` **vacío**; el de `navigator|window|document|localStorage` **vacío**; `@/` **vacío**; el `git diff` de `as`/`!.`/`any` **vacío**; `find` **vacío**; el `grep` de `11`/`3` en `lineup.ts` **vacío**; el de `squads` **vacío**; el `--stat` de **`mode.ts`** **vacío** (solo se tocó su test: H3 **no** es un regrabado); el último **vacío** (H6 y los tres huérfanos del cuadro).

- [ ] **Step 3: Repasar el diff entero con ojos de revisor**

```bash
git status --short
git diff --stat ef61be7
git diff ef61be7 -- components/games/VaultWorldCupGame.tsx
```
Comprueba, una por una:
1. `git status` muestra: nuevos `football-logic/squads.ts/.test.ts`, `football-screen/formation-preview.ts/.test.ts`, `football-screen/lineup.ts/.test.ts` y el ledger; modificados `teams.ts/.test.ts`, `kits.test.ts`, `invariants.test.ts`, **`mode.test.ts`**, `world-cup.ts/.test.ts`, `flow.ts/.test.ts`, `flow-layout.ts/.test.ts`, `control-hints.ts/.test.ts`, `VaultWorldCupGame.tsx`, `games-registry.ts/.test.ts` y el spec; también `tasks/vault-world-cup/HANDOFF-next-session.md` y el plan mismo (los dos ya tocados antes de este paso). **Nada más** — en particular, ni `ai.ts`, ni `match.ts`, ni `players.ts`, ni **`mode.ts`** (solo su test), ni `app/games/vault-world-cup/play/page.tsx`.
2. Ningún `draw*` concatena cadenas ni asigna memoria; `refreshBracketView`, `refreshDrawView` y `refreshLineupView` son los tres únicos sitios que las construyen.
3. El único `TEAM_SIZE` de `lineup.ts` está dentro de `checkLineup`.
4. `squads.ts` no lo importa nadie de `football-logic/`.
5. Los `try/catch` de `loadLineup`/`saveLineup` están, y las closures de `localStorage` se crean una vez al montar.
6. El entrenamiento **no** pasa por ALINEACIÓN y el amistoso a dos pasa **dos veces**, J1 y luego J2.

- [ ] **Step 4: Escribir la lista de QA de Paco**

Crea `.superpowers/sdd/2026-09-23-vault-world-cup-v15-3/qa-paco.md` con exactamente esto:

```markdown
# QA jugado — V15-3 «Contenido» (v1.5)

Doce puntos. Primero el selector (1-3), luego el Mundial de 16 (4-7), luego la
ALINEACIÓN (8-12). Ten a mano una ventana privada para el punto 11.

**Ninguno de estos puntos vuelve a abrir una decisión**: las siete dudas del plan las
cerraste tú el 23-sep (resoluciones (a)-(g) y la adenda de la plantilla de 18), y aquí
solo se confirma **la sensación jugando**. Si algo no te gusta, es un cambio nuevo, no
una duda pendiente.

1. **Las veinte, en 5×4.** ELIGE TU SELECCIÓN enseña veinte tarjetas en cinco columnas
   y cuatro filas; COLOMBIA, COREA DEL SUR, NORUEGA y EGIPTO salen las últimas. Ningún
   nombre se sale de su tarjeta — mira sobre todo ESTADOS UNIDOS, COREA DEL SUR y
   PAÍSES BAJOS. La cruceta recorre las veinte y da la vuelta por los dos ejes.
2. **El minicampo.** A la derecha de la fila ALINEACIÓN, con la formación marcada:
   1/2/3 la cambian y los puntos se recolocan. Los puntos llevan el color de la
   selección bajo el cursor (mueve el cursor y cambian); el portero sale en verde
   flúor. **¿Se lee bien un kit blanco (ALEMANIA, INGLATERRA) sobre el verde?**
3. **Kits de las nuevas.** Juega AMISTOSO con COREA DEL SUR y, si te sale NORUEGA o
   EGIPTO de rival (los tres son rojos), comprueba que se distinguen en el campo y en
   el minimapa: el visitante invierte su kit (`resolveMatchKits`).
4. **Mundial de dieciséis.** SORTEO DEL MUNDIAL enseña dieciséis nombres en cuatro
   columnas de cuatro, con TÚ bajo el tuyo. El cuadro dice OCTAVOS DE FINAL y enseña
   ocho cruces en dos columnas de cuatro. **¿Se lee el cruce más largo sin pisar la
   otra columna?**
5. **VER / SALTAR / SALTAR TODOS.** IZQ/DER recorre los tres botones y no da la vuelta
   (desde SALTAR TODOS a la derecha no vuelve a VER). SALTAR TODOS resuelve los siete
   cruces de CPU de golpe y te deja en tu partido. **Comprueba que el cuadro queda
   igual que si los saltas uno a uno** (juega dos veces con la misma semilla si puedes).
6. **Los eliminados, atenuados en su propio cruce** (resolución (b), 23-sep). No hay
   línea ELIMINADOS ni contador «QUEDAN N»: cuando un cruce se resuelve, el que cae se
   queda en su fila en gris apagado. **Confirma la sensación**: ¿se distingue bien el
   gris del perdedor del blanco del que pasa, también en el cruce donde estás tú
   (que va en amarillo)?
7. **Puntuación.** Gana los cuatro partidos y comprueba que la tabla recibe 70 500 más
   1 000 por gol. La dificultad de octavos es **3** (resolución (c), 23-sep):
   **confirma la sensación — ¿se nota demasiado fácil el primer partido?**
8. **ALINEACIÓN aparece donde toca:** tras elegir selección y formación, en AMISTOSO,
   AMISTOSO A DOS (J1 y luego J2) y MUNDIAL; **en ENTRENAMIENTO no aparece**.
9. **Nueve titulares y nueve reservas, no once y siete.** Es lo esperado hasta V15-4:
   el equipo sigue siendo de nueve. Comprueba que los dorsales son **1-18**, que el 1
   y el 2 son los dos porteros y que los nombres suenan a la selección (apellidos
   típicos del país). **¿Alguno te suena a un futbolista real? Si sí, apúntalo y se
   cambia** — son 360 y se tocan sin recompilar nada más que `squads.ts`.
10. **Cambios y nombres, con TU reparto de botones (resolución (d)).** Con **A** sobre
    un titular sale la lista de reservas **de su misma posición**; **A** confirma la
    elegida y **B** cancela. Sobre el portero sale **un** nombre: el segundo portero
    (dorsal 2), y nadie más. **C** sobre un titular edita su nombre: escribe en
    mayúsculas, máximo 12, Enter confirma, Backspace borra, y vaciarlo devuelve el de
    la plantilla. **Con el teclado CLÁSICO, escribe un nombre con Q, A, O y P: tienen
    que escribirse, no mover el cursor.** **B** sale de la pantalla y arranca.
    **Confirma la sensación:** ¿se entiende que el botón de salir sea B («VOLVER») y
    no A, cuando lo que hace es empezar el partido?
11. **Se guarda por selección.** Cambia la alineación de ESPAÑA y edita un nombre, juega,
    vuelve y entra otra vez con ESPAÑA: siguen ahí. Entra con ITALIA: la suya está por
    defecto. Cambia de formación (1/2/3) y vuelve a entrar: la alineación vuelve al
    orden por defecto **pero el nombre editado sigue**. En una ventana privada, todo
    arranca por defecto y **sin ningún error en consola**.
12. **Legibilidad del minicampo de ALINEACIÓN.** El portero lleva su etiqueta **encima**
    del punto y todos los demás debajo, justo para que el nombre del portero no pise al
    del central (van a la misma altura). **Míralo con los nombres más largos** —
    ELMOUSSAOUI (Marruecos), CASTELVETRI (Italia), MERIWEATHER (Estados Unidos) — y
    dime si se lee o si hay que recortar a 10 caracteres en esta pantalla.
    *(El rival NO se ve aquí y está decidido: resolución (a). Ver a los dos equipos es
    la pantalla previa de G15-19, sin nombres, y es de **V15-5**.)*
```

- [ ] **Step 5: Cerrar el ledger**

Añade a `.superpowers/sdd/2026-09-23-vault-world-cup-v15-3/progress.md`:

```
V15-3 COMPLETO en código: 1383 tests / 83 ficheros verdes, tsc limpio, eslint sin errores nuevos. Motor tocado SOLO en datos (teams.ts, squads.ts), en world-cup.ts y en TESTS (invariants.test.ts, kits.test.ts, mode.test.ts), sin regrabado (ai.test.ts, match.test.ts y mode.ts byte a byte). G15-9 (20 selecciones, rejilla 5×4, minicampo), G15-7/G15-8 (Mundial de 16 con OCTAVOS, 70 500, cuadro de 8 en dos columnas con el perdedor atenuado en su cruce, SALTAR TODOS) y G15-17 (plantilla de 18, pantalla ALINEACIÓN con cambios, nombres y persistencia) implementados; spec anotado. Los 13 hallazgos del pre-vuelo aplicados al plan antes de ejecutar. Lista de QA en qa-paco.md. Pendiente: commit de Paco + QA jugado.
```

Y debajo, estos cuatro encabezados:

`## Resueltas por Paco (23-sep, antes de ejecutar) — a confirmar jugando, NO a rediscutir`
1. **(a) El rival NO se ve en ALINEACIÓN.** La pantalla enseña solo tu alineación, con dorsales y nombres. Ver a los dos equipos es la **pantalla previa de G15-19, sin nombres, y es de V15-5**, no de este paso.
2. **(b) La línea ELIMINADOS se retira y no hay contador**: el perdedor se dibuja **atenuado dentro de su propio cruce** ya resuelto.
3. **(c) Dificultad de octavos = 3** (la dificultad crece por ronda; la primera no debe desanimar).
4. **(d) Teclas de ALINEACIÓN: A confirma / elige, B vuelve o cancela (y sale de la pantalla), C entra a editar el nombre** — el mismo reparto que el resto de pantallas.
5. **(e) El sorteo de dieciséis se dibuja en cuatro columnas de cuatro.**
6. **(f) Nombres inventados al azar con apellidos típicos del país**, nunca futbolistas reales; Paco los revisa en el QA y los que chirríen se cambian.
7. **(g) Las formaciones siguen siendo tres** (4-4-2, 4-3-3, 5-3-2 en V15-4); no se prepara nada para una 5-4-1 por adelantado.
8. **Adenda (tras el hallazgo H8 del pre-vuelo): la plantilla es de 18, no de 14** — 2 porteros + 6 defensas + 6 medios + 4 delanteros, dorsales 1-18, 20 × 18 = **360** nombres. Con 14 y once titulares, la 4-4-2 se quedaba sin reserva de medio y la 5-3-2 sin reserva de defensa; con 18 hay recambio en todas las líneas y el segundo portero cubre G15-18.
9. **Los titulares se derivan de la formación** (`slots.length + 1`: 9 + 9 hoy, 11 + 7 en V15-4) en vez de fijar once, de modo que **V15-4 no reabre `squads.ts` ni `lineup.ts`**.

`## Dudas abiertas para Paco` — **ninguna.** Las siete del plan quedaron resueltas el 23-sep (resoluciones (a)-(g)) y H8 lo cerró la adenda de la plantilla de 18. Lo que salga del QA jugado se anota aquí como **hallazgo nuevo**, no como duda heredada; los 360 nombres que Paco quiera retocar entran por ahí.

`## Peticiones separadas al motor` — 1. En V15-4 (que ya regraba): actualizar el comentario de `drawRival` en `mode.ts` («Uniform over the other fifteen» → diecinueve), el de `createPlayers` en `players.ts` («18 players created once») y el de `kits.ts:44-45` («the real 16-team bank … all 240 ordered pairs» → 20-team y 380), los tres en ficheros vetados en V15-3. 2. En V15-4: conectar la alineación elegida al partido (`PlayerState` necesita nombre y dorsal, o un mapa puesto→índice de plantilla) y subir `TEAM_SIZE` a 11, lo que hace que `lineup.ts` pase solo a 11 + 7. 3. En V15-4: los cambios por lesión (G15-18) ya tienen banquillo — incluido el portero suplente — sin tocar `squads.ts`.

`## Hallazgos de la ejecución` — lo que salga. Si no hay ninguno: `ninguno.`

- [ ] **Step 6: Proponer el commit del paso — NO ejecutes `git add` ni `git commit`**

Mensaje único para Paco:

```
feat(world-cup): v1.5 content — 20 selections in a 5x4 grid, 16-team World Cup with round of 16, and 18-man squads with a lineup screen (V15-3, G15-7/G15-8/G15-9/G15-17)
```

Recuérdale que el commit incluye **ficheros nuevos** (`football-logic/squads.ts`, `squads.test.ts`, `football-screen/formation-preview.ts`, `formation-preview.test.ts`, `football-screen/lineup.ts`, `lineup.test.ts`) que hay que añadir explícitamente, que `tasks/vault-world-cup/HANDOFF-next-session.md` **ya estaba en el índice** antes de este paso, y que el plan (`docs/superpowers/plans/2026-09-23-vault-world-cup-v15-3-content.md`) y el ledger son suyos: él decide si entran en el mismo commit.

---

## Self-review (ejecutada al escribir el plan, 23-sep)

**1. Cobertura del spec.**
- **Selecciones de la v1.5 (07-sep) / G15-9** — «las 16 más COLOMBIA, COREA DEL SUR, NORUEGA y EGIPTO, al FINAL de TEAMS, con la red de invariantes (`BANK_SIZE` 16 → 20)» → Task 1, con los cuatro kits **verificados numéricamente al escribir el plan** (0 fallos en los 380 pares ordenados de `resolveMatchKits`); «rejilla 5×4, tarjetas más estrechas» → Tasks 2 (geometría + test) y 5 (dibujo); «minicampo a la derecha de la fila ALINEACIÓN con la formación elegida, puntos por rol, color del kit de la marcada, sin flechas» → `formation-preview.ts` (Task 2) + `drawFormationPreview` (Task 5).
- **G15-7** — `WORLD_CUP_SIZE` 8 → 16, ronda OCTAVOS antes de cuartos, todo eliminatorias, humano + 15 de 19 → Task 3 (tablas de ronda, `drawEntrants`); «pantalla de cuadro (`bracketRowY`, 8 pares)» → Task 4 (`bracketRowY(pair, pairs)`, `bracketColX`) + Task 5; «VER/SALTAR de 7 pares CPU en octavos» → test de los siete pares en Task 4; «corregir spec y catálogo» → Task 9, Steps 6 y 7a (seis anotaciones en el spec, `goal` y `tips` del catálogo, +1 test).
- **G15-8** — bonus de octavos 2 500 y `PERFECT_BASE_SCORE` 70 500 → Task 3 (con el test que escribe la fórmula **y** el literal); «SALTAR TODOS además del VER/SALTAR por cruce» → Task 4 (`'skip-all'`, `BRACKET_CHOICE_COUNT`) + Task 5 (`skipAllCpuPairs`); «solo la ronda actual, 8 cruces en dos columnas de 4 dentro de 800×500» → Task 4 (geometría comprobada con la medida del cruce más largo) + Task 5.
- **G15-17** (con la adenda de Paco del 23-sep) — **18** por selección, nombres inventados que suenan al país, dorsales fijos **1-18** con los dos porteros en 1 y 2 → Task 6 (`squads.ts`, **360** nombres, `squadNumber = índice + 1`); «pantalla ALINEACIÓN tras elegir formación, solo en amistoso y Mundial» → Task 8 (`LINEUP_BY_MODE`, fase `'lineup'`); «minicampo con los titulares (dorsal + nombre) y las reservas» → Task 9 (`drawLineup`); «cambio titular↔reserva solo de la misma posición (cruceta, confirmar, elegir reserva)» → Task 7 (`canSwap`/`applySwap`) + Tasks 8 y 9, con el reparto **A confirma / B vuelve o cancela / C nombre** de la resolución (d); «reserva DEF/MED/DEL» → **garantizado por la plantilla de 18 y exigido por `checkSquadCoversFormations`**, también para las tres formaciones de V15-4; «edición de nombre (tecla, mayúsculas, máx. 12, Enter)» → Task 7 (`lineupTypeChar`/`lineupBackspace`/`lineupEndEdit`) + Task 9 (ruta de teclas por delante de la tabla); «alineación y nombres editados en localStorage por selección, try/catch, render correcto sin él» → Task 7 (`loadLineup`/`saveLineup` + el test de almacenamiento que lanza) + Task 9 (dos closures creadas al montar); «la CPU siempre con sus titulares» → por construcción (el partido no lee `lineup.ts`); «el rival visible y no editable» → **NO se implementa, y está DECIDIDO así** (resolución (a)): la pantalla va antes del sorteo, y ver a los dos equipos es la pantalla previa de G15-19, **sin nombres, en V15-5**.
- **El acoplamiento a V15-4** — regla escrita en las Global Constraints, implementada en `lineup.ts` y `formation-preview.ts` (todo derivado de `f.slots.length`), y **verificada por dos tests que usan formaciones de diez puestos escritas a mano** más dos controles negativos (Task 2 nº 4 y Task 7 nº 1) y un `grep` en la compuerta final. Lo que no puede existir hasta V15-4 está **listado**, no inventado: los literales de tamaño, que la alineación llegue al partido, los nombres en los eventos y los cambios por lesión. **La plantilla de 18 es lo que cierra el agujero que el pre-vuelo encontró (H8)**: con 14 la promesa «V15-4 no reabre `squads.ts`» era falsa para la 4-4-2 y la 5-3-2.
- **Criterios 1, 2, 4, 5, 20, 21** — el motor de partido no se toca (compuerta `git diff --stat` en cada tarea), no entra `Math.random` ni DOM en `football-logic/`/`football-screen/` (grep en cada tarea), el portero sigue sin ser controlable (nada lo toca), las cadenas se construyen en `refresh*View` y nunca en `draw*` (revisión explícita en las Tasks 5 y 9), y 1338 medidos → 1383 objetivo. **Sin huecos.**
- Fuera de alcance respetado: V15-4 (11v11, atributos, postes, tarjetas, lesiones), V15-5 (celebraciones, red, nombres en eventos, pantalla previa), V15-6 (online), y `page.tsx`, `keyboard.ts`, `gamepad-input.ts` y los otros 13 juegos sin tocar.

**2. Placeholders.** Ningún «TBD», ningún «similar a la Task N», ninguna «añade los tests correspondientes»: los diez pasos llevan el código o el `diff` exacto. Las dos tareas sin tests (5 y 9, cableado del `.tsx`) llevan en su lugar una revisión de revisor punto por punto y las compuertas de `tsc`/`eslint`/criterio 20. Los **360** nombres están escritos, no descritos, y **se comprobaron con un script al aplicar el pre-vuelo**: 20 × 18, todos válidos contra el regex, **los 360 distintos**, el más largo de 11 caracteres. Los kits nuevos y las 32 ranuras de `matchSeedFor` también se comprobaron numéricamente antes de escribirlos aquí.

**3. Consistencia de nombres y tipos.** `BANK_SIZE`/`TEAMS` (T1) → los consumen T2, T3, T5, T6. `TEAM_GRID_COLS`, `TEAM_CARD_W/H`, `formationLabelX`, `TEAM_PREVIEW_*` y `previewSlotX/Y`, `previewGkX/Y`, `previewDotCount`, `previewSlotRole` (T2) → T5 y T9 los usan con esos nombres. `WORLD_CUP_SIZE`, `'round-16'`, `SCORE_PASS_ROUND16`, `ROUND_BONUS`, `PERFECT_BASE_SCORE` (T3) → T4 (siete pares) y T5 (`skipAllCpuPairs`). `BracketAction` con `'skip-all'`, `BRACKET_CHOICE_COUNT`, `bracketRowY(pair, pairs)`, `bracketColX(pair, pairs)`, `bracketButtonX`, `BRACKET_BUTTON_*` (T4) → T5. `SQUAD_SIZE`, `SQUAD_NAME_MAX`, `SQUAD_ROLES`, `SQUAD_NAMES`, `squadRole`, `squadNumber`, `squadName`, `isSquadName`, `checkSquad*` (T6) → T7. `Lineup`, `createLineup`, `defaultLineup`, `refreshReserves`, `lineupName`, `canSwap`, `applySwap`, `lineupTypeChar`, `lineupBackspace`, `lineupEndEdit`, `checkLineup`, `loadLineup`, `saveLineup`, `lineupPositionCount`, `lineupReserveCount`, `lineupRoleAt`, `GK_POSITION` (T7) → T9, con la lista de imports **cerrada** en la cabecera de la Task 9 para que `eslint` no marque ninguno sin usar. `FlowPhase` `'lineup'`, `LINEUP_BY_MODE`, `flowHasLineup`, `flowConfirmTeam` con `'lineup'`, `flowConfirmLineup`, `flowLineupMove/Choose/CancelChoice/BeginEdit/EndEdit`, `lineupCursor/lineupChoosing/lineupEditing`, `LINEUP_*` de layout y `lineupBrowse/lineupSwap/lineupEdit` (T8) → T9. `drawFormationPreview(f, def, x, y, w, h)` se define en T5 y se reutiliza en T9 con esa firma exacta.
Dos rojos de `tsc` son **intencionados y están escritos**: el de la Task 4 (`bracketRowY` con un argumento en el `.tsx`) lo cierra la Task 5, y el de la Task 8 (`switch` de `menuAction` no exhaustivo y `flowConfirmTeam` con un valor de retorno más) lo cierra la Task 9. Ésa es otra razón de la ejecución **en serie**.

**Riesgos que el plan NO cierra y que solo cierra el QA jugado de Paco** (sensación, no decisión: las decisiones están tomadas): si un kit blanco se lee sobre el minicampo verde; si el cruce más largo del cuadro se lee de verdad a 18 px y si el perdedor atenuado se distingue del que pasa; si la dificultad 3 de octavos hace el primer partido soso; si alguno de los 360 nombres le suena a un futbolista real; si el reparto A/B/C de ALINEACIÓN se entiende, en particular que B sea el que arranca; y si los nombres más largos se leen en el minicampo de ALINEACIÓN sin pisarse. Todos en `qa-paco.md`.

## Resueltas por Paco (23-sep, antes del pre-vuelo) — decisiones cerradas, NO dudas

Las siete dudas que este plan traía se cerraron **antes de ejecutar**. Están propagadas
a las tareas, a los tests, a los textos de UI, a `qa-paco.md` y al cierre; aquí quedan
como registro. **No se reabren.**

(a) **Rival en ALINEACIÓN: NO.** La pantalla muestra SOLO tu alineación, con dorsales y nombres. Ver a los dos equipos se hace en la
pantalla previa (G15-19), que va justo al pulsar JUGAR, ya con rival sorteado, **sin nombres**: solo las dos formaciones de pie
con sus equipaciones, para dar ambiente. **Esa pantalla es de V15-5, no de V15-3** (Task 9, «Contexto»; `qa-paco.md` punto 12).
(b) **Línea ELIMINADOS: se quita, y sin contador.** Los eliminados se dibujan **atenuados en su propio cruce** ya resuelto
(Task 5: `bracketRowLoser` en `refreshBracketView`, `DIM_TEXT` en `drawBracket`; `qa-paco.md` punto 6).
(c) **Dificultad de octavos = 3** (la dificultad crece por ronda; la primera ronda no debe desanimar) — Task 3, `ROUND_DIFFICULTY`.
(d) **Botones en ALINEACIÓN:** **A confirma / elige, B vuelve o cancela, C entra a editar el nombre** (mismo reparto que el resto de
pantallas). B es también quien **sale** de la pantalla. Propagado a `control-hints.ts` y su test (Task 8), al `case 'lineup'` de
`menuAction` (Task 9), al `tip` del catálogo (Task 9) y al punto 10 de `qa-paco.md`.
(e) **Sorteo de 16 en cuatro columnas de 4** — Task 4, `DRAW_COL_X`.
(f) **Nombres:** inventados y al azar, con apellidos típicos del país (italiano → Federici, español → Fernández, etc.), nunca jugadores
reales. Paco los revisa en el QA; los que chirríen se cambian — Task 6, los 360 nombres.
(g) **Las formaciones siguen siendo tres** (4-4-2 normal, 4-3-3 ofensiva, 5-3-2 defensiva). No se prepara nada por adelantado para una
hipotética 5-4-1; si un día entrara, `checkSquadCoversFormations` salta antes que el juego (Task 6).
→ En la tarea de cierre se registran como «resueltas por Paco 23-sep», **no** como dudas abiertas, y `## Dudas abiertas para Paco`
dice `ninguna.`

### Adenda del pre-vuelo (Paco, 23-sep) — la plantilla de 18

**Plantilla de 18 por selección, no 14** (decisión de Paco tras el hallazgo H8): **2 porteros + 6 defensas + 6 medios + 4 delanteros**,
dorsales **1-18** (los dos porteros primero). Motivo: con 14 (1/5/4/4) y once titulares, la 4-4-2 se quedaba **sin reserva de medio** y
la 5-3-2 **sin reserva de defensa**, así que el «reserva DEF/MED/DEL» de G15-17 no se cumplía en V15-4 y `canSwap` habría devuelto una
lista vacía para media plantilla; y el segundo portero cubre la **lesión del portero** (G15-18). **20 × 18 = 360 nombres** inventados y
únicos. Titulares y reservas se siguen derivando del tamaño vigente (`slots.length + 1`), **nunca de 11**, para que V15-4 no reabra
`squads.ts` ni `lineup.ts`: hoy **9 + 9**, en V15-4 **11 + 7**. `checkSquadCoversFormations` se endurece y exige **una reserva de cada
rol**, no solo que la plantilla llegue.

**Efectos secundarios ya aplicados al plan:** el portero **sí** es cambiable (solo por el otro portero), el banquillo de la pantalla
pasa a nueve filas (y cabe: `lineupReserveY(8) + 30 = 378 < 412`), `SHIRT_LABELS` y `lineupLabels` pasan a dieciocho huecos, y el spec
queda anotado con el porqué del cambio de 14 a 18.

### Registro del pre-vuelo (23-sep)

El pre-vuelo adversarial (`.superpowers/sdd/2026-09-23-vault-world-cup-v15-3/preflight.md`) dio **5 Críticos, 3 Importantes y
5 Menores**. **Los trece están aplicados a este plan**; el detalle, con qué cambió y dónde, está en la sección «Aplicado 23-sep» al
final de ese fichero. Lo que cambió de fondo, no de texto:
1. **Cobertura de consumidores (H1-H4, H7).** Tres ficheros de test que ninguna tarea tocaba —`flow.test.ts` (×2 tests),
   `invariants.test.ts` (×2) y `mode.test.ts` (×2)— más tres asertos de `world-cup.test.ts` dejaban **todas** las compuertas globales
   en rojo desde la Task 1. Ahora **cada tarea lista y arregla lo que rompe** y ninguna compuerta de tests sale roja.
2. **`mode.test.ts` es el noveno fichero permitido** de `football-logic/`; la compuerta de cierre pasa de ocho líneas a **nueve**.
   `mode.ts` sigue intacto, así que no es un regrabado.
3. **Las resoluciones de Paco están propagadas** (H5), no solo listadas al final: botones de ALINEACIÓN, eliminados atenuados y
   la pantalla previa como V15-5.
4. **La plantilla sube a 18** (H8, decisión de Paco), con todo lo que arrastra.
5. **Objetivo de tests: sigue siendo 1383 / 83.** Todas las correcciones son ediciones de tests existentes, no altas.
