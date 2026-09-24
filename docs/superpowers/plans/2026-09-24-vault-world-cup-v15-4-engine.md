# Vault World Cup — v1.5, paso V15-4 «Motor» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meter mano al motor de VAULT WORLD CUP: **once contra once** con formaciones 4-4-2 / 4-3-3 / 5-3-2 y un campo ~10 % mayor (G15-16); **atributos recortados** por selección y por jugador, con **porteros de tres niveles** (G15-10 + G15-26); **postes y larguero** con rebote y SFX (G15-12); **lesiones tras falta, con cambio** (G15-18); **tarjetas deterministas con expulsión real** (G15-13); **entradas y faltas direccionales** (G15-24) y la **pausa de gol de 2 s a 4 s** (G15-4, parte de motor). Todo ello con **UN ÚNICO REGRABADO** de los partidos deterministas, al final del tercer día, y dos sondas de 40 partidos.

**Architecture:** Doce tareas **en serie**, repartidas en **tres días** (resolución 10 de Paco, tras el pre-vuelo). El día 1 escribe la red estructural y cambia la **forma** del juego (tamaño de equipo, formaciones, campo, rejilla de la tanda); el día 2 la **física** (atributos, marco de portería) y la entrada nueva; el día 3 los **cambios y la disciplina** (lesiones, tarjetas), la **pantalla** y, al final, el **regrabado**. La regla que hace posible el regrabado único: `ai.test.ts` y `match.test.ts` —los dos ficheros que guardan los partidos grabados— **no reciben ningún número regrabado en las tareas 1-8**; cada tarea que mueve un número *medido de la lista blanca* marca el `it` afectado con `it.skip` y un comentario `PENDING_REBASELINE`, y la **Task V15-4-9 es la única** que vuelve a medir, restaura los números y borra todas las marcas. Lo que **no** es un número medido —índices de jugador, coordenadas de fixture, cuentas de plantilla— se **reancla a su fórmula** (edición de **clase 3**), porque reanclar no es regrabar. Las propiedades **estructurales** (determinismo, réplica, portero dentro del área, ninguna entrada inválida, ninguna salida de línea sin razón de presión) no se saltan nunca: la **Task V15-4-1a** las levanta a un fichero nuevo, `engine-invariants.test.ts`, que está verde desde la primera tarea hasta la última.

**Tech Stack:** TypeScript estricto, React 19.2.4, Next 16.2.6 (App Router), canvas 2D 800 × 500, vitest 4.1.11 (tests `*.test.ts` junto al código, **sin `vitest.config`**, entorno Node sin DOM, **imports relativos** — el alias `@/` no existe en vitest).

**Spec:** `specs/31-vault-world-cup.md` (Approved) — bullet «Grill de la v1.5 (Paco, 2026-09-17), decisiones G15» (**G15-4**, **G15-10**, **G15-12**, **G15-13**, **G15-15**), bullet «Ampliación tras el QA de V15-1 (Paco, 2026-09-21)» (**G15-16**, **G15-18**, **G15-22**) y «QA jugado de V15-2 (Paco, 2026-09-23)» (**G15-24**, **G15-26**). Las decisiones G15 son ley y no se reabren en este plan.
**Plan hermano (modelo de formato, profundidad y convenciones):** `docs/superpowers/plans/2026-09-23-vault-world-cup-v15-3-content.md` (paso anterior, implementado en `f1d7d2a`).
**Código a imitar:** `components/games/football-logic/invariants.ts` (redes de invariantes que devuelven `string[]` y nombran al culpable) · `components/games/football-logic/ai.ts:99-122` (`profileFor`/`humanProfile`: fórmulas puras sobre la dificultad, con `clampNum`) · `components/games/football-logic/actions.ts:150-180` (`stepTackle`: la entrada, balón antes que cuerpo) · `components/games/football-logic/match.ts:560-570` (el `switch (match.phase)` con `const _exhaustive: never`) · `components/games/football-logic/squads.ts` (datos + su propia red).
**Ledger de este paso:** `.superpowers/sdd/2026-09-24-vault-world-cup-v15-4/` (**creado vacío al escribir este plan**). El controlador crea allí `progress.md` al empezar la ejecución SDD; cada tarea le añade **una** línea al cerrar (y, si ha tenido que poner un `it.skip`, la lista literal de los `it` saltados); la tarea de cierre escribe `qa-paco.md`.

---

## Global Constraints

**Los requisitos de cada tarea incluyen implícitamente esta sección.**

### Las decisiones del grill que este paso ejecuta (copiadas literalmente del spec)

- **G15-16 · 11 contra 11**: amistoso (incl. a dos) y Mundial con 11 por equipo (10 + GK); entrenamiento intacto. Formaciones normal 4-4-2 / ofensiva 4-3-3 / defensiva 5-3-2 (mismas teclas 1/2/3); campo ~10 % mayor (QA); persecución 3/2/1 igual. En V15-4, mismo regrabado; V15-4 pasa a 2-3 días.
- **G15-10 Atributos (Paco, recorte):** por selección 5 valores 1-5 (defensa, ataque, contraataque, chut, pase) → perfil de CPU vía `profileFor(teamDef, difficulty)` + ajuste físico pequeño (±5 % velocidad de pase/chut). Por jugador SOLO velocidad y chut, derivados del rol con pequeña variación por selección. Resistencia + banquillo → v1.6. Regrabado único + sonda 40 partidos (0 sin ganador). Paco: «pequeños cambios, no afecta tanto a la jugabilidad».
- **G15-26 · Porteros con atributos (Paco, 23-sep, CONFIRMADO)** (V15-4, mismo regrabado): cada portero de la plantilla lleva tres niveles 1-5 — **reflejos** (probabilidad de atajar), **salidas** (alcance y rapidez al salir dentro del área, sobre `keeperStep` de G12-3) y **saque** (fuerza y precisión del saque de puerta y de mano). Los dos porteros de cada selección son distintos, así el suplente se nota al entrar por lesión (G15-18). Extiende G15-10 (atributos recortados) al puesto de portero.
- **G15-12 Postes y larguero (Paco):** postes = 2 círculos de colisión en el motor, rebote con pérdida + SFX (fichero ya en public/). Larguero: por encima = fuera; cruza a la altura del larguero → rebote al campo + mismo SFX. Toca motor → MISMO regrabado que G15-10. Sonda 40 partidos contando postes/largueros (ni rarísimo ni constante).
- **G15-13 Tarjetas (Paco):** determinista por faltas del jugador: amarilla a la 2.ª, roja a la 4.ª (2.ª amarilla). Roja = expulsión real (equipo con 7; revisar invariantes de 8; si es el controlado, control al siguiente más cercano). Tope 2 expulsados por equipo (3.ª roja solo rótulo). Rótulo tarjeta + nombre, sin pausa extra. Se reinician por partido, no afectan a la tanda. Motor → mismo regrabado que G15-10/12.
  > **Traducción a los números de hoy (V15-4):** donde el spec dice «equipo con 7» y «invariantes de 8», hoy son **equipo con 10 de campo** e **invariantes de 10** — el spec escribió el número del equipo de nueve. La regla (amarilla a la 2.ª falta, roja a la 4.ª, tope 2 expulsados) no cambia.
- **G15-18 · Lesiones**: solo tras entrada pitada como falta, ~8 % de esas faltas lesiona al que la recibe, determinista por semilla del partido; tope 1 lesión por equipo y partido. Humano: pausa en esa falta, ventana «LESIONADO: <nombre>», elige entre sus 3 reservas (cualquier posición). CPU: cambio automático misma posición. Sin reservas → juega con uno menos. Reabre G15-10 SOLO para cambios por lesión (tácticos siguen en v1.6). Tarjetas siguen G15-13 (por acumulación, no random). En V15-4, mismo regrabado.
  > **Traducción:** «sus 3 reservas» es el número de la plantilla de 14 del spec original; desde la adenda del 23-sep la plantilla es de **18** y las reservas son `SQUAD_SIZE − (slots.length + 1)` = **7** con once titulares. El humano elige entre **sus reservas, cualquier posición**, sean tres o siete.
- **G15-24 · Entradas y faltas** (V15-4, mismo regrabado): `TACKLE_BALL_REACH` 20 → 28 (por encima de `TACKLE_FOUL_RADIUS` 24) y falta solo si el contacto llega por detrás o de lado; de frente sin tocar balón = choque. Sonda de 40 partidos (entradas/robos/faltas, objetivo ≈ 50 % limpias), ajuste fino en QA.
- **G15-4 Celebración (Paco)** — la parte de motor: la pausa de gol pasa de **2 s a 4 s** (`GOAL_PAUSE_SECONDS`). El abrazo, la red que ondula y el resto de la celebración son **V15-5, solo pantalla**.
- **Diferido que se recoge aquí:** el comentario de `positionTeam` en `ai.ts:235` («rank 0 is the controlled and never gets here») que **G15-5 dejó inexacto** en V15-2: desde el cambio manual con C, el controlado ya no es necesariamente el de rango 0, así que el jugador de rango 0 **sí** puede entrar por esa rama.

**Fuera de V15-4 (no se toca aunque «quede cerca»):** la celebración del abrazo, la red que ondula, los **nombres y dorsales en los eventos del partido y sobre el jugador controlado** (G15-11), la pantalla previa (G15-19) y la celebración de victoria (G15-21) — todo eso es **V15-5**; el online es **V15-6, tras producción** (G15-23); la **resistencia** y el **banquillo táctico** son **v1.6** (G15-10, G15-18: «tácticos siguen en v1.6»); el sprite «tirándose» de la entrada (G15-25) es **V15-5**.

### Lo que este paso da por cerrado de V15-3 y NO reabre

V15-3 dejó escritos, a propósito, tres módulos **independientes del tamaño del equipo**, y este paso lo comprueba en vez de reescribirlos:

| Módulo | Por qué no se reabre |
|---|---|
| `football-screen/lineup.ts` | Los titulares son `f.slots.length + 1` y las reservas `SQUAD_SIZE −` eso. Al pasar a 4-4-2 salen **11 y 7** sin tocar una línea. `TEAM_SIZE` se lee **una sola vez**, en `checkLineup`, y como `TEAM_SIZE` también sube a 11 la comprobación sigue cuadrando. |
| `football-screen/formation-preview.ts` | `previewDotCount(f) = f.slots.length + 1`: 11 puntos en vez de 9, sin tocar el fichero. **Su test sí cambia** (`formation-preview.test.ts:46` dice `toBe(9)` con el comentario «changes once V15-4 raises TEAM_SIZE» — es el único literal). |
| `football-logic/squads.ts` | `checkSquadCoversFormations` ya se probó en V15-3 contra una tabla literal con 4-4-2 / 4-3-3 / 5-3-2; con 2 GK + 6 DEF + 6 MED + 4 DEL las tres caben **y dejan recambio en cada línea** (ejecutado en el pre-vuelo: `checkSquadCoversFormations(FORMATIONS)` sigue dando `[]` con las nuevas). Cuando este paso ponga esas tres en `FORMATIONS`, la tabla literal del test pasa a ser **redundante** — eso es un hallazgo del plan, resuelto en la Task V15-4-1b (se deja, apuntando a las de hoy, como control negativo de la propia red). **El fichero de datos no se toca en la 1b; la Task 2 sí le añade `KEEPER_ATTRS`, `outfieldAttrsFor` y `checkAttributes`.** |
| Alineación guardada en `localStorage` | `serializeLineup` guarda `{ f: id, n: positionCount }`. Una alineación de V15-3 (`n: 9`, `f: '3-3-2'`) **no casa** con 4-4-2 y `parseLineup` cae al orden por defecto **conservando los nombres editados**. No hay migración que escribir: la decisión se tomó en V15-3 precisamente para esto. **Se verifica con un test**, no con fe — el test está escrito, en la Task V15-4-1b, Step 1.d (el plan lo prometía y no lo escribía en ningún sitio). |

**Lo que V15-3 dejó explícitamente para este paso y aquí se hace:** que **la alineación elegida llegue al partido** — `PlayerState` gana `squadIndex`, que es lo que permite a la vez los atributos por jugador (G15-10), los atributos del portero (G15-26) y el cambio por lesión (G15-18).

### Criterios del spec (copiados literalmente), y qué les pasa en este paso

> 1. **Misma semilla y misma secuencia de entradas producen el mismo estado**, paso a paso, en un partido completo. Hay test que lo fija. **La simulación es de paso fijo** (`STEP_MS`): ningún `dtMs` entra en el motor.
> 2. **El motor no distingue quién mueve cada equipo**: `stepMatch` recibe dos `TeamInput` y ningún módulo de `football-logic/` lee teclado, `Math.random` ni estado de módulo.
> 4. **Nueve por equipo**, y el portero nunca es el jugador controlado.
> 5. **Se controla siempre el más cercano al balón**, con histéresis de 40 u para que no parpadee, y el cambio es automático y derivado del estado (no es entrada).
> 20. **Ninguna asignación de memoria por frame** en el bucle ni en el dibujo, incluido el confeti (depósito de partículas creado una vez).
> 21. **La suite sigue verde y no baja de los 861 tests (cierre de la etapa B, 2026-09-06)** de partida.

- El **criterio 4** es el único que este paso **cambia**: pasa a **once por equipo** (G15-16). La Task V15-4-1b lo anota en el spec; el «el portero nunca es el jugador controlado» sigue intacto. El criterio 5 gana su segunda excepción escrita (la primera fue G15-5): **una roja al controlado pasa el control al siguiente más cercano** (G15-13).
- El **criterio 1** no se relaja en ningún momento: los partidos siguen replicando byte a byte sobre semilla + `TeamInput`. Por eso la **decisión del cambio por lesión del humano viaja dentro del `TeamInput`** (campo `sub`), y no por una llamada aparte del componente — una llamada aparte rompería la réplica.
- **Traducción operativa del criterio 20 para este paso:** dentro de `draw()` y sus `draw*`, `update`, `runStep`, `loop` y `pollGamepadFrame` no hay `new`, literales de objeto o array, plantillas ni concatenaciones de string, `.map/.filter/.slice/.split`, ni cierres (`=>`) nuevos. Los textos del rótulo de tarjeta y de la ventana **LESIONADO** se componen en un `refresh*View()` que corre **al producirse el evento**, nunca por frame, exactamente como `refreshBracketView()` y `refreshLineupView()`.

### Reglas del repo

- **Commits: SOLO Paco.** Ninguna tarea ejecuta `git add`, `git rm`, `git commit` ni `git stash`. Donde un plan de superpowers diría «Commit», aquí dice: **dejar el working tree verificado; commit lo hace Paco**. Al final (Task V15-4-11) se propone **UN** mensaje de commit convencional para todo el paso.
- **Rama `main`. HEAD de hoy: `f1d7d2a`** (V15-3 «Contenido»). **Working tree de partida (medido al aplicar el pre-vuelo, H15): `specs/31-vault-world-cup.md` y este plan, LOS DOS EN EL ÍNDICE** (`git status --short` → `M  specs/31-vault-world-cup.md` y `AM docs/superpowers/plans/2026-09-24-vault-world-cup-v15-4-engine.md`; los añadió Paco, no una tarea). El directorio del ledger existe y `.superpowers/sdd/` está **ignorado por git** (`.superpowers/sdd/.gitignore`), así que `progress.md`, `qa-paco.md` y `preflight.md` **no aparecen en `git status` ni entran en ningún commit** — conviene saberlo antes de buscarlos ahí. No hay nada más. Todas las compuertas comparan contra `f1d7d2a` y se acotan a `*.ts`/`*.tsx`.
- **NUNCA arrancar `next dev` ni `next build`.** Paco tiene el suyo en `:3000`. La verificación de cada tarea es `npx vitest run <fichero>` → `npx vitest run` → `npx tsc --noEmit` → `npx eslint <ficheros tocados>`. **El QA jugado lo hace Paco** con la lista que deja escrita la tarea de cierre.
- **Baseline medida hoy (2026-09-24, HEAD `f1d7d2a`, `npx vitest run` ejecutado al escribir este plan y re-medida en el pre-vuelo sobre una copia limpia): 1385 tests en 83 ficheros, todos verdes, 0 saltados.** Objetivo al cerrar el paso: **≈1461 tests en 88 ficheros, 0 saltados** (H14: es el único número de objetivo del plan; la columna «Acumulado» de la tabla de orden suma exactamente eso, y los cinco ficheros nuevos —`engine-invariants`, `attributes`, `goal-frame`, `discipline`, `probes`— sobre 83 dan 88). Los Δ por tarea son estimaciones; el número que manda lo confirma la Task V15-4-11.
- **ESLint de partida:** `app/games/vault-world-cup/play/page.tsx` arrastra **3 errores** de `react-hooks` (`set-state-in-effect` ×2, `refs`) desde antes de V15-2; **no se arreglan en este paso** (fuera de alcance). Criterio en cada gate: **ningún error nuevo**; el resto de ficheros, `eslint` sin salida.
- **Determinismo (criterios 1 y 2):** `grep -rn "Math.random" components/games/football-logic/ components/games/football-screen/` debe devolver **VACÍO** al cerrar cada tarea (tests incluidos). Ningún fichero de `football-logic/` ni de `football-screen/` importa React ni toca `document`, `window`, `navigator` ni `localStorage`. **Todo lo aleatorio de este paso (la lesión del 8 %, nada más) sale del `Rng` del partido**, con la misma regla de siempre: *no se tira el dado si el suceso no es posible*, porque el número de tiradas es parte del estado determinista.
- **Sin asignaciones por paso ni por frame en el motor.** Los campos nuevos de `PlayerState` y de `MatchState` son **escalares** o arrays creados **una vez** en `createMatch`/`createPlayers`. Ninguna función del motor devuelve un objeto nuevo por paso.
- **Instantáneas bajo `.superpowers/`: solo `.txt`/`.md`.** **Ninguna copia `*.ts`/`*.tsx` bajo `.superpowers/`**: `tsc` y vitest las recogerían. Compuerta: `find .superpowers -name "*.ts" -o -name "*.tsx"` **vacío**.
- **Tests con imports RELATIVOS** (`from './goal-frame'`, `from '../football-logic/teams'`).
- **Comentarios, identificadores y nombres de tests (`describe`/`it`) en inglés** (convención del repo). El plan, el spec, el chat y los textos de UI, en castellano.
- **Ficheros en kebab-case**, salvo `VaultWorldCupGame.tsx`. Tipos en PascalCase, `SCREAMING_CASE` para constantes de módulo. TypeScript estricto: nada de `any`, **nada de `as`** nuevo para tapar un tipo (se estrecha con comparaciones o predicados), **ningún `!` nuevo**.
- **Un test que pasa no prueba nada hasta verlo fallar** (regla de Paco). Cada tarea tiene su paso «ver en rojo» y su **control negativo** con el resultado esperado escrito literalmente; si un control negativo no hace fallar lo que dice, el test es vacuo y se arregla antes de seguir.
- **Números de línea = orientativos.** Cada cita de línea va con el texto literal a buscar; si las líneas se han desplazado, manda el texto.

### EL REGRABADO ÚNICO — la regla, el mecanismo y su compuerta

**El problema.** Ocho de las doce tareas cambian el comportamiento del motor. Los dos ficheros que guardan **partidos grabados** —`football-logic/ai.test.ts` (1149 líneas) y `football-logic/match.test.ts` (2091 líneas)— contienen unos pocos valores **medidos una vez y nunca ajustados**, por ejemplo:

```ts
// ai.test.ts, describe 'CPU vs CPU: a recorded, deterministic full match...'
expect(game.stats.keeperLeftLineOutsideSmallArea).toBe(69);
// ai.test.ts, describe 'CPU vs CPU with every published formation (Task 7)'
const EXPECTED_OUTSIDE_SMALL_AREA: Record<string, number> = { '1-1': 19, '1-0': 36 };
// match.test.ts, describe 'full match with recorded inputs (criterion 1)'
expect(visited, 'this recording reached the golden goal: ...').not.toContain('golden-goal');
```

Si cada tarea volviera a medirlos, habría **ocho regrabados** — justo lo que G15-15 prohíbe («UN regrabado + sonda 40; puede partirse en 2 días con regrabado al final del segundo»).

**LA LISTA BLANCA — los únicos asertos regrabables del paso (H3).** El regrabado no es «cualquier número que se ponga rojo». Es **esta lista y nada más**, medida en `f1d7d2a` y copiada aquí con su valor viejo al lado:

| Fichero | Aserto (texto literal a buscar) | Valor viejo | Por qué es regrabable |
|---|---|---|---|
| `ai.test.ts` | `expect(game.stats.keeperLeftLineOutsideSmallArea).toBe(69)` | **69** | Cuenta de un partido grabado. No es una propiedad, es una foto. |
| `ai.test.ts` | `const EXPECTED_OUTSIDE_SMALL_AREA: Record<string, number> = { '1-1': 19, '1-0': 36 }` | **19**, **36** | Ídem, por par de formaciones. |
| `ai.test.ts` | el párrafo en prosa «2-1, 6 shots, 79 short and 35 long passes, 313 slide steps…» | — | Medición en comentario. |
| `match.test.ts` | `expect(visited, 'this recording reached the golden goal: …').not.toContain('golden-goal')` | política | El propio comentario pide releerlo el día que la grabación llegue al gol de oro. |
| `match.test.ts` | el párrafo en prosa «11 325 steps, 0-2, … run C first diverging at step 1171» | — | Medición en comentario. |

**Todo lo que se ponga rojo y NO esté en esta tabla no es un regrabado.** O es una **edición de clase 3** (abajo), o es una **regresión** — y entonces se para y se investiga. En particular, y esto es lo que el pre-vuelo pilló: un aserto que hoy vale **`0`** o **`[]`** es **estructural por definición** (`keeperOutsideBox`, `keeperLeftLineWithoutPressReason`, `invalid`, `firstMismatchB === -1`). **Ninguno vale 0 en la lista blanca, así que ninguno se regraba jamás.** Si `keeperLeftLineWithoutPressReason` sale 153 en vez de 0, eso **no** se escribe como `toBe(153)`: se para el paso.

**La regla.** `components/games/football-logic/ai.test.ts` y `components/games/football-logic/match.test.ts` **no reciben ningún número regrabado en las tareas 1-8**. En esas tareas solo se les permiten **tres** clases de edición, y ninguna otra:

1. **Poner `it.skip`** en un `it` **de la lista blanca** cuyo número medido se ha movido, con un comentario en la línea de encima:
   ```ts
   // PENDING_REBASELINE (Task V15-4-9): <qué lo movió, en una línea>.
   it.skip('(c) the keepers never left their box ...', () => {
   ```
   Un `it` que no toca ningún aserto de la lista blanca **no puede llevar marca**. Si se quiere marcar, es que se está tapando una regresión o una clase 3 sin hacer.
2. **Actualizar literales DERIVADOS** que siguen mecánicamente de una constante y no son una medición — por ejemplo `expect(m.ball.x).toBeCloseTo(1000, 10)` pasa a `toBeCloseTo(centerX(PITCH), 10)` cuando el campo crece. **Un literal derivado se sustituye por su fórmula, no por el número nuevo**: así deja de poder volver a moverse.
3. **Reanclar la ARITMÉTICA DE IDENTIDAD y las coordenadas de fixture** a las constantes y fórmulas de las que siempre dependieron. **Esto no es regrabar: ninguna de estas líneas es un valor medido, son la descripción del montaje del test.** Entra aquí, y solo esto:
   - `players[t * 9]` → `players[t * TEAM_SIZE]`; `m.players[9]` → `m.players[TEAM_SIZE]`; en general **cualquier `players[N]` con `N ≥ 9`** de estos dos ficheros, que en el motor de nueve nombraba al jugador `N − 9` del equipo 1 y ahora nombra a uno del equipo 0 → `players[TEAM_SIZE + (N − 9)]`.
   - Literales de **id de jugador** en el lado derecho: `expect(w.ball.owner).toBe(9)` → `toBe(TEAM_SIZE)`, `toBe(3)`/`toBe(1)` del cambio manual con C → la expresión que los deriva.
   - Cuentas de plantilla: `expect(a.players.length).toBe(18)` → `toBe(TEAM_SIZE * 2)`.
   - Coordenadas de fixture calibradas contra `PITCH`: `650` → `CY`, `1000` → `centerX(PITCH)`, `x = 122` («just outside the small area») → `PITCH.smallAreaDepth + 6.5`, etc. **Siempre la fórmula, nunca el número nuevo.**
   - Descripciones del dato que cambian de significado (títulos que dicen «3-3-2», `expect(m.players[8].role).toBe('fwd')` cuando el hueco 8 pasa a ser medio, `ai.test.ts:710` con «slides … from the FRONT» tras G15-24).

   **Medido en el pre-vuelo, sobre la copia y con las medidas definitivas de la resolución 5:** con la Task 1 aplicada, los dos ficheros congelados dan **39 rojos** (17 en `ai.test.ts`, 22 en `match.test.ts`). Un pase **puramente mecánico** de la primera viñeta de la clase 3 (sustituir los índices y `toBe(18)`, y añadir el import de `TEAM_SIZE`) baja de **39 a 25** sin tocar un solo número medido — y, lo más importante, **devuelve a verde el `it` de la fuzz de doce semillas**, que es donde vivía el `keeperLeftLineWithoutPressReason === 0` que el pre-vuelo vio romperse. De los 25 restantes, **sólo cuatro** tocan la lista blanca (`69`, los dos de `EXPECTED_OUTSIDE_SMALL_AREA` y el gol de oro); los otros veintiuno son más clase 3 (ids literales `toBe(9)`, fixtures de geometría del área y del larguero).

Lo que **no** se permite: cambiar `toBe(69)` por `toBe(otro número)` fuera de la Task 9. Eso es regrabar.

**Lo que NO se salta nunca.** Las propiedades **estructurales** de esos dos ficheros —determinismo (`firstMismatchB === -1`), divergencia con otra semilla, réplica desde la grabación, `invalid === 0`, `keeperOutsideBox === 0`, **`keeperLeftLineWithoutPressReason === 0`** y llegar a `'over'`— **no dependen de ningún número medido**. La **Task V15-4-1a** las levanta, copiadas y adaptadas, a un fichero nuevo **`football-logic/engine-invariants.test.ts`** que está **verde desde la Task 1a hasta la Task 11**. Es lo que impide que un `it.skip` esconda una regresión real durante ocho tareas. El pre-vuelo midió que la versión original de ese fichero **no** levantaba `keeperLeftLineWithoutPressReason`, y por eso pasaba verde mientras `ai.test.ts` perdía ese invariante: el Step 1 de la Task 1a lo añade, derivando el portero **del rol y no del índice**.

**La compuerta, en cada tarea:**

```bash
# (a) ningún número de la LISTA BLANCA regrabado en tareas 1-8: su valor sigue siendo el de f1d7d2a
#     (o su `it` está .skip). Los dos listados tienen que dar el MISMO valor, línea a línea.
for f in ai.test.ts match.test.ts; do
  git show f1d7d2a:components/games/football-logic/$f | grep -nE "toBe\(69\)|'1-1': 19|'1-0': 36|not\.toContain\('golden-goal'\)"
  grep -nE "toBe\(69\)|'1-1': 19|'1-0': 36|not\.toContain\('golden-goal'\)" components/games/football-logic/$f
done
# (b) el número de marcas coincide EXACTAMENTE con lo que esta tarea anotó en progress.md,
#     y NINGUNA marca cae fuera de la lista blanca
grep -rn "PENDING_REBASELINE" components/games | wc -l
grep -rn -A2 "PENDING_REBASELINE" components/games   # revisar a ojo: cada it marcado toca un aserto de la lista blanca
# (c) la suite: verde, con exactamente ese número de tests saltados
npx vitest run
```

> **Por qué la columna «Marcas» de la tabla de orden ya no lleva un número fijo (H2).** El pre-vuelo demostró que el número declarado (2 en la Task 1) era papel mojado: el reparto real depende de cuánta clase 3 se aplique, y eso sólo se sabe al hacerla. La compuerta (b) compara contra **lo que la propia tarea anotó en `progress.md`**, más un **techo duro para todo el paso: 5 marcas**. Si una tarea quiere poner la sexta, se para y se le pregunta a Paco — porque significaría que el motor ha movido algo que la lista blanca no prevé.

**Y la compuerta de la Task V15-4-9 (la del regrabado):**

```bash
grep -rn "PENDING_REBASELINE" components/games        # VACÍO
npx vitest run                                        # 0 skipped, todo verde
```

**Por qué este orden de tareas lo permite:** las ocho tareas que mueven el motor van **antes** (1a-8) y ninguna vuelve a medir; la 9 mide **una vez**, con el motor ya terminado; la 10 (sondas) mide **sobre el motor de la 9**, así que sus números tampoco se tocan dos veces; la 11 solo cierra.

### Orden, reparto en tres días y paralelismo (para SDD)

**Las doce tareas se ejecutan EN SERIE, una detrás de otra — V15-4-1a → V15-4-1b → … → V15-4-11 — nunca en paralelo.** Motivo (el mismo que en V15-1, V15-2 y V15-3): cada tarea pasa por un estado rojo **intencionado** (Step 2) y cierra con `npx vitest run` y `npx tsc --noEmit` **globales**; en un mismo working tree, dos subagentes en paralelo verían el rojo intencionado del otro como si fuera su propio gate. Y aquí la cadena de dependencias es más fuerte que nunca: la 1b cambia el tamaño del equipo del que dependen todas; la 2 crea `PlayerState.squadIndex`, que la 5 (lesiones) necesita; la 5 crea `substitute`, que la 6 (tarjetas) necesita para el portero expulsado (resolución 6 de Paco); la 9 solo puede medir cuando la 8 ha cerrado.

> **Cambios de estructura respecto al plan original, y por qué:**
> - **La Task 1 se parte en 1a y 1b (H1).** El pre-vuelo midió que la Task 1 entera deja **89 tests rojos en 13 ficheros**. `TEAM_SIZE` es atómico —no hay forma de subirlo a medias— así que el corte posible no es por ficheros sino por **naturaleza del trabajo**: la **1a** escribe la red estructural sin tocar una constante de producción y cierra verde con el motor de nueve; la **1b** da el golpe y reancla los trece ficheros. Así el estado intermedio existe de verdad y la red ya está puesta cuando llega el golpe.
> - **Las tareas 5 y 6 intercambian su contenido: 5 = lesiones y cambios (G15-18), 6 = tarjetas y expulsión real (G15-13).** Lo obliga la **resolución 6 de Paco**: el portero expulsado sale por el **mecanismo de cambio de la tarea de lesiones**. Con el orden viejo, la tarea de tarjetas tendría que expulsar porteros antes de que `substitute` existiera. `isActive` se crea en la nueva Task 5 como `!p.injured` y la 6 la extiende a `!p.sentOff && !p.injured`, que es una línea.

> **Regla de compuertas:** al cerrar **cada** tarea, `npx vitest run` sale **verde** (con los saltados declarados), `npx tsc --noEmit` sin errores y `npx eslint` sin errores nuevos. Cada tarea **arregla los tests existentes que rompe** salvo los asertos de la lista blanca de los dos ficheros congelados, donde marca `it.skip`. Los rojos de los Steps 1-2 y de los controles negativos son **dentro** de la tarea y se cierran antes de su compuerta.

| Día | Orden | Tarea | Ficheros de motor que toca | Δ tests / ficheros | Marcas | Acumulado |
|---|---|---|---|---|---|---|
| **1** | 1a | **V15-4-1a** la red estructural: `engine-invariants.test.ts` verde contra el motor de hoy, con sus dos controles negativos | ninguno de producción | +6 / +1 | 0 | 1391 / 84 |
| **1** | 1b | **V15-4-1b** once contra once: `TEAM_SIZE` 11, formaciones 4-4-2/4-3-3/5-3-2, campo y áreas ×1.1, rejilla de la tanda, y el reanclado de los **13 ficheros** | `teams.ts`, `pitch.ts`, `players.ts` (+ sus tests), `invariants.test.ts`, `set-pieces.test.ts`, `actions.test.ts`, `ball.test.ts`, `squads.test.ts`, `formation-preview.test.ts`, `lineup.test.ts`, `camera.test.ts`, `pitch.test.ts` | +3 / 0 | **medida** (≤4) | 1394 / 84 |
| **2** | 2 | **V15-4-2** atributos de selección y de jugador; el portero deja de ser genérico (G15-10 + G15-26) | `teams.ts`, `squads.ts`, `players.ts`, `ai.ts`, `match.ts` (+ tests nuevos) | +13 / +1 | medida | 1407 / 85 |
| **2** | 3 | **V15-4-3** postes y larguero (G15-12) | `goal-frame.ts` (nuevo), `ball.ts`, `step.ts`, `match.ts` | +11 / +1 | medida | 1418 / 86 |
| **2** | 4 | **V15-4-4** entradas y faltas direccionales + pausa de gol de 4 s (G15-24 + G15-4) | `actions.ts`, `match.ts`, `actions.test.ts` | +7 / 0 | medida | 1425 / 86 |
| **3** | 5 | **V15-4-5** lesiones y cambios (G15-18) — crea `substitute`, la fase `'injury'` y `discipline.ts` | `discipline.ts` (nuevo), `input.ts`, `match.ts`, `players.ts`, `ai.ts`, `hud.ts`, `loop.ts` | +12 / +1 | medida | 1437 / 87 |
| **3** | 6 | **V15-4-6** tarjetas y expulsión real (G15-13), incluido el portero expulsado por la vía de la Task 5 | `discipline.ts`, `players.ts`, `match.ts`, `actions.ts`, `ai.ts`, `invariants.ts` | +11 / 0 | medida | 1448 / 87 |
| **3** | 7 | **V15-4-7** la pantalla: rótulos de tarjeta, ventana LESIONADO, SFX del marco, minimapa | `football-screen/*`, `VaultWorldCupGame.tsx` | +9 / 0 | medida | 1457 / 87 |
| **3** | 8 | **V15-4-8** el comentario de `positionTeam` y el resto de la deuda de comentarios | solo comentarios | 0 / 0 | medida | 1457 / 87 |
| **3** | 9 | **V15-4-9 · EL REGRABADO ÚNICO** | `ai.test.ts`, `match.test.ts` (**solo tests**) | 0 / 0 | **0** | 1457 / 87 |
| **3** | 10 | **V15-4-10** las dos sondas de 40 partidos | `probes.test.ts` (nuevo) | +4 / +1 | 0 | 1461 / 88 |
| **3** | 11 | **V15-4-11** cierre, `qa-paco.md` y mensaje de commit | solo ledger + spec | 0 / 0 | 0 | 1461 / 88 |

> **La columna «Marcas» dice «medida» a propósito (H2).** El número real lo fija cuánta clase 3 aplica cada tarea, y eso sólo se sabe haciéndola: cada tarea **mide sus marcas, las anota en `progress.md` con la lista literal de los `it`** y la compuerta (b) compara contra esa anotación. Lo que sí es fijo es el **techo del paso: 5 marcas**, y que **ninguna marca puede caer fuera de la lista blanca**. Lo medido en el pre-vuelo para la Task 1b: de 39 rojos en los dos ficheros congelados, sólo **4** tocan la lista blanca (el `69`, los dos de `EXPECTED_OUTSIDE_SMALL_AREA` y el gol de oro), así que **≤ 4** es el techo de esa tarea.

> Los Δ son **estimaciones del plan**. La cifra que manda es la que mide `npx vitest run` al cerrar cada tarea; si una tarea sale con un Δ distinto, **se anota en `progress.md` y se sigue** — lo que no se permite es bajar del acumulado anterior.

**Fichero a vigilar, que no es de nadie: `step.test.ts` (H17).** `step.test.ts:175` (`expect(a.ball.owner).toBe(KICK_TARGET_ID)` con `KICK_TARGET_ID = 7`) está documentado en `step.test.ts:21-26` como «verified by simulation»: es **un valor medido que no aparece en ninguna tarea del plan**. Medido en el pre-vuelo: **sobrevive a la Task 1b** (`step.test.ts` sale verde), pero es sensible al campo y a las formaciones y puede caer en cualquiera de las tareas 2-8. **Regla:** si cae, es **clase 3** —se reancla `KICK_TARGET_ID` a la formación (`defaultSquadIndexFor` / el hueco correspondiente de `FORMATIONS[0]`)— y **NO es un regrabado**, porque `step.test.ts` no es uno de los dos ficheros congelados y no está en la lista blanca. Lo mismo, en menor grado, con `set-pieces.test.ts:73` y `:149` (`takerId` calculado a mano), que **sí** caen en la Task 1b y que el plan ya prevé.

**Cortes de día (resolución 10 de Paco).** El **día 1** termina al cerrar la **Task V15-4-1b**: el motor ya es once-contra-once sobre el campo definitivo, los trece ficheros están reanclados y la red estructural lleva puesta desde antes del golpe. El **día 2** termina al cerrar la **Task V15-4-4**. El **día 3** arranca en la Task V15-4-5 y **no termina hasta haber pasado la Task V15-4-9**: dejar el paso con marcas `PENDING_REBASELINE` vivas de un día para otro sí se permite (es justo lo que hacen los dos cortes), pero **cerrarlo** con marcas vivas, no. En los dos cortes el estado es el mismo: suite verde, `tsc` limpio, ninguna medición a medias.

---

## Mapa de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `components/games/football-logic/teams.ts` **(modificado)** | `TEAM_SIZE` 9 → **11**, `OUTFIELD` 8 → **10**; las tres formaciones pasan a **4-4-2 / 4-3-3 / 5-3-2**; tipo nuevo `TeamAttrs` (5 valores 1-5) y el campo `attrs` en cada uno de los veinte `TeamDef`. | 1b, 2 |
| `components/games/football-logic/pitch.ts` **(modificado)** | **Resolución 5 de Paco (24-sep):** escalan ×1,1 el campo (`width` 2000 → **2200**, `height` 1300 → **1430**), **las dos áreas** (`bigAreaDepth` 320 → **352**, `bigAreaWidth` 770 → **847**, `smallAreaDepth` 105 → **115,5**, `smallAreaWidth` 350 → **385**), el **punto de penalti** (`penaltySpotDist` 210 → **231**, que es geometría del área grande) y el **círculo central** (`centerCircleRadius` 175 → **192,5**). **La portería NO escala**: `goalWidth` se queda en **150** y `crossbarHeight` en **50**. | 1b |
| `components/games/football-logic/players.ts` **(modificado)** | La rejilla de la tanda pasa a **5 × 4** con separación 60/80 y **desaparece el salto `k === 7`**; `PlayerState` gana `squadIndex`, `speedMult`/`shotMult` y los tres escalares de portero `keeperReflexes`/`keeperRushing`/`keeperKicking` (T2, H12), `injured` (T5) y `fouls`/`card`/`sentOff` (T6). | 1b, 2, 5, 6 |
| `components/games/football-logic/squads.ts` **(modificado)** | Datos: `KEEPER_ATTRS` por selección (dos porteros × 3 niveles 1-5, G15-26) y `outfieldAttrsFor(teamId, index)` (velocidad y chut derivados del rol, G15-10). Su red de invariantes crece con ellos. | 2 |
| `components/games/football-logic/ai.ts` **(modificado)** | `profileFor(def, difficulty)` deja de ignorar `def`: los 5 atributos de selección sesgan el perfil. `keeperStep` y `keeperCatch` leen los tres niveles del portero que está en el campo. `decideTeamInput` rellena `sub` (T5). Comentario de `positionTeam` corregido (T8). **`ai.ts:610-613` (la CPU solo desliza de frente, supuesto S14b) NO se toca** — resolución 8 de Paco. | 2, 5, 6, 8 |
| `components/games/football-logic/goal-frame.ts` **(nuevo)** | Puro: `POST_RADIUS`, `FRAME_BOUNCE`, `postCentreY`, `hitPost`, `hitCrossbar`, `bounceOffFrame`. Sin estado, sin `Rng`, sin asignaciones. | 3 |
| `components/games/football-logic/ball.ts` **(modificado)** | `BallState` gana `frameHit: 'none' \| 'post' \| 'crossbar'`, escrito **cada paso** por `stepBall` entre `flyAndRoll` y `pickUp`. | 3 |
| `components/games/football-logic/actions.ts` **(modificado)** | `TACKLE_BALL_REACH` 20 → **28**; `stepTackle` solo pita falta si el contacto llega **por detrás o de lado** (G15-24). `updateTeamControl`/`nextManualControl` ignoran a los expulsados y lesionados (T5, T6). | 4, 5, 6 |
| `components/games/football-logic/discipline.ts` **(nuevo)** | Puro. **T5:** `INJURY_CHANCE = 0.08`, `INJURY_MAX_PER_TEAM = 1`, `canInjure`, `isActive` (v1: `!p.injured`), `INJURY_WINDOW_STEPS`. **T6:** `CARD_YELLOW_AT = 2`, `CARD_RED_AT = 4`, `SENT_OFF_MAX = 2`, `cardForFouls`, `registerFoul`, `sentOffCount`, `isActive` extendida a `!p.sentOff && !p.injured`. | 5, 6 |
| `components/games/football-logic/input.ts` **(modificado)** | `TeamInput` gana `sub: number` (−1 = nada; si no, el **índice de plantilla** del recambio elegido). `createTeamInput`, `copyTeamInput` y `checkTeamInput` lo cubren. | 5 |
| `components/games/football-logic/match.ts` **(modificado)** | `GOAL_PAUSE_SECONDS` 2 → **4**; `MatchState` gana `pendingInjury: [number, number]`, `injuriesUsed: [number, number]` (H6), `injuryStepsLeft: [number, number]` (H13) y `lastCard`; `MatchPhase` gana `'injury'`; `substitute()`; el `switch` exhaustivo la cubre. **`keeperOf` no cambia** (resolución 6). | 3, 4, 5, 6 |
| `components/games/football-logic/invariants.ts` **(modificado)** | `checkFormation` deja de comparar contra `OUTFIELD` a secas (pasa a aceptar la longitud de la tabla que se le pasa); red nueva `checkTeamCount` **con cuerpo escrito** (H10) para los expulsados y lesionados, incluida la comprobación de «exactamente un `gk` por equipo». | 1b, 6 |
| `components/games/football-logic/engine-invariants.test.ts` **(nuevo)** | Las propiedades **estructurales** de los partidos grabados, sin ningún número medido: determinismo, réplica, divergencia, `invalid === 0`, portero dentro del área, **`keeperLeftLineWithoutPressReason === 0`** y llegar a `'over'`. **Verde de la Task 1a a la 11.** | 1a |
| `components/games/football-logic/attributes.test.ts` **(nuevo)** | Los atributos de selección, de jugador y de portero: red, monotonía y controles negativos. | 2 |
| `components/games/football-logic/goal-frame.test.ts` **(nuevo)** | El marco: poste, larguero, por encima, rebote con pérdida, y el gol que sigue siendo gol. | 3 |
| `components/games/football-logic/discipline.test.ts` **(nuevo)** | **T5:** lesiones, tope por equipo, la ventana `'injury'`, la salida por tiempo, el cambio (incluido gk→gk). **T6:** tarjetas: 2.ª falta = amarilla, 4.ª = roja, tope 2, reinicio por partido, la tanda intacta, el portero expulsado. | 5, 6 |
| `components/games/football-logic/probes.test.ts` **(nuevo)** | Las **dos sondas de 40 partidos**: marco (postes/largueros) y entradas (limpias/faltas/robos). Miden y **aseveran bandas**, no números exactos. | 10 |
| `components/games/football-screen/hud.ts`, `loop.ts` **(modificados en la T5)** | **H5:** `buttonsIdle` (`hud.ts:94`) y `frameMode` (`loop.ts:67`) pasan a `switch` exhaustivo con `const _exhaustive: never` sobre `MatchPhase`, **en la misma tarea que añade `'injury'`**. Hoy son comparaciones sueltas y una fase nueva compilaría en silencio. | 5 |
| `components/games/football-screen/captions.ts`, `sfx-map.ts`, `hud.ts`, `control-hints.ts`, `flow.ts` **(modificados)** | Rótulo de tarjeta, rótulo de lesión, SFX del larguero, ventana LESIONADO. | 7 |
| `components/games/VaultWorldCupGame.tsx` **(modificado)** | Dibujo de la ventana LESIONADO, rótulos de tarjeta, disparo del SFX `crossbar`, minimapa con veintidós. | 7 |
| `specs/31-vault-world-cup.md` **(modificado)** | Criterio 4 (nueve → once), y la anotación de qué implementa V15-4 y qué queda para V15-5/v1.6. | 1b, 11 |
| `.superpowers/sdd/2026-09-24-vault-world-cup-v15-4/progress.md` · `qa-paco.md` | Ledger (una línea por tarea + la lista de `it` saltados) y lista de QA de Paco. | todas · 11 |

**Lo que este paso NO toca, a propósito:** `football-logic/world-cup.ts`, `mode.ts`, `kits.ts`, `rng.ts`, `geometry.ts`, `clock.ts`, `referee.ts` (la falta ya la juzga bien: la tarjeta va en `match.ts`, no en el árbitro) · `football-screen/keyboard.ts`, `gamepad-input.ts`, `lineup.ts`, `formation-preview.ts`, `flow-layout.ts` · `lib/games-registry.ts` · `app/games/vault-world-cup/play/page.tsx` · los otros 13 juegos.

---

## Dudas de diseño — TODAS RESUELTAS POR PACO (24-sep). Ninguna sigue abierta

Las cuatro dudas que este plan planteaba están decididas. Se dejan escritas **con su decisión al lado**, porque cada una manda sobre el cuerpo del plan y sobre la implementación. El texto íntegro de las resoluciones está al final del documento; aquí va lo que hay que hacer.

1. **«Entrenamiento se queda como está»: ¿tamaño o reglas?** → **RESUELTO, opción (A)** (resolución 1): intacto = sus **REGLAS** (`TRAINING_RULES`: sin reloj, equipo 1 congelado). El entrenamiento adopta el tamaño de equipo vigente y pasa a **11 v 11**. `TEAM_SIZE` sigue siendo una constante global y **no** se implementa tamaño por partido. Coste cero; la Task 1b no se parte por esto.

2. **El portero expulsado.** → **RESUELTO** (resolución 6, que **sustituye** a la resolución 2 del mismo día): el portero **sí** puede ver la roja y entra el **segundo portero** de la plantilla **por el mecanismo de cambio de la tarea de lesiones** (`substitute`), con lo que el equipo pierde **un jugador de campo** (el que se va es el expulsado, y el hueco lo ocupa el segundo portero; el equipo juega con diez, uno de ellos portero). **Si ya no queda portero disponible** —el segundo ya está en el campo, o se gastó— la roja se **muestra como rótulo y NO expulsa** (mismo trato que la tercera roja de `SENT_OFF_MAX`). **`keeperOf` no se toca ni sus llamadores**: el equipo siempre tiene exactamente un portero, y ese portero es siempre `players[team * TEAM_SIZE]`. **Nada de «un jugador de campo se pone los guantes»**: esa lectura (resolución 2) queda derogada, y con ella desaparece la necesidad de `promoteKeeper`, de intercambiar `PlayerState` en el array y de tocar `match.ts:316, 322, 333, 365, 556` o `set-pieces.ts:143, 302`.

3. **El portero lesionado sin el segundo portero disponible.** → **RESUELTO** (resolución 7): entra el **segundo portero** si queda. Si no queda, **la lesión se señala pero el portero sigue jugando** — nunca se juega sin portero. Consecuencia directa sobre el código: **`substitute` DEBE PERMITIR el cambio gk→gk**, al revés de lo que decía el borrador (H4(3)); la guarda `if (out.role === 'gk' || squadRole(squadIndex) === 'gk') return false;` se borra y se sustituye por una que sólo prohíbe **mezclar** los dos mundos (campo→portería y portería→campo).

4. **Cuánto crece el campo, exactamente.** → **RESUELTO** (resoluciones 4 y 5): **2200 × 1430** (×1,1 en los dos ejes, para que el minimapa y las previsualizaciones conserven la proporción exacta sin tocar `minimap.ts` ni `flow-layout.ts`). **Escalan también las dos áreas y el círculo central**, y con ellos el punto de penalti, que es geometría del área grande. **La portería NO escala**: `goalWidth` se queda en 150 y `crossbarHeight` en 50, porque es lo que fija cuántos goles caen y está equilibrado con `catchChance`/`SHOT_POST_MARGIN`. Todos los números, en el Step 3 de la Task 1b. Si en el QA Paco quiere más campo, se sube **dentro de V15-4 y antes de la Task 9**, nunca después.

> **Lo que el plan decide por derivación, y que Paco confirma en el QA.** La resolución 5 nombra «las áreas» y «el círculo central». **`penaltySpotDist` (210 → 231) escala con ellos**, porque el punto de penalti es geometría del área grande —`checkPitch` exige que esté dentro del área grande y fuera de la pequeña— y dejarlo en 210 con un área de 352 de fondo lo acercaría relativamente a la línea de gol. Va anotado en `qa-paco.md` como la **única** medida que el plan ha decidido por su cuenta.

---

## Task V15-4-1a: la red estructural — `engine-invariants.test.ts` verde contra el motor de hoy

**Files:**
- Create: `components/games/football-logic/engine-invariants.test.ts`

**Interfaces:**
- Produces: `engine-invariants.test.ts` como red estructural, consumida (como compuerta, no como import) por las tareas 1b-11.
- Consumes: nada.

> **Por qué es una tarea aparte (H1).** El pre-vuelo midió que la Task 1 original deja **89 tests rojos en 13 ficheros**: es, de largo, el golpe más grande del paso. La red que debe sostenerlo tiene que estar puesta **antes**, y tiene que haberse visto fallar **antes**. Esta tarea no toca ni una constante de producción: escribe la red, la ve verde contra el motor de nueve y la rompe dos veces a propósito. Cierra verde y se puede dejar dormida.

> **Y por qué la versión original de este fichero no servía (H3).** El pre-vuelo escribió el fichero **literal, tal como estaba en el plan**, y lo ejecutó: sale verde con el motor de nueve, verde con el de once y verde a dificultad 8 — pero **no detecta** que `ai.test.ts` pierda `keeperLeftLineWithoutPressReason === 0`, que es una propiedad **estructural** y no un número medido. La causa era que ese aserto vivía sólo en `ai.test.ts`, calculado sobre `players[t * 9]`. El Step 1 de aquí lo levanta, **derivando el portero del rol y no del índice**, y el Step 3 lo prueba rompiéndolo.

- [ ] **Step 1: Escribir el fichero de invariantes estructurales, EN VERDE contra el motor de hoy**

Antes de tocar una constante. Es la red que va a sostener las ocho tareas siguientes, así que tiene que nacer verde con el motor de nueve y seguir verde con el de once **sin cambiar una línea** — si para pasar a once hubiera que tocarla, es que llevaba un número medido dentro.

```ts
// components/games/football-logic/engine-invariants.test.ts
import { describe, expect, it } from 'vitest';
import { FORMATIONS, TEAMS } from './teams';
import { PITCH, goalLineX, isInsideBigArea, isInsideSmallArea } from './pitch';
import { dist } from './geometry';
import { createRng } from './rng';
import { createTeamInput, checkTeamInput, copyTeamInput, type TeamInput } from './input';
import { createMatch, stepMatch, type MatchPhase, type MatchState } from './match';
import { GK_LINE_DIST, isPlayerDown, type PlayerState } from './players';
import { HALF_STEPS } from './step';
import { createAiState, decideTeamInput, profileFor, type AiProfile, type AiState } from './ai';
import { checkGoalkeepersInBox } from './invariants';

// The STRUCTURAL half of the two recorded files (ai.test.ts, match.test.ts): every
// property here is number-free, so it survives every engine change of V15-4 and stays
// green while those two files carry their PENDING_REBASELINE marks. If one of these
// goes red, it is a REGRESSION, never a re-baseline.
const CAP = 20000;

function fresh(): MatchState {
  return createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
}

// V15-4 (pre-flight finding H3): the keeper is found BY ROLE, never by index. The
// whole point of this file is that it cannot be fooled by a team-size change, and
// `players[t * 9]` is exactly the kind of literal that fooled ai.test.ts.
function keeperOf(m: MatchState, t: 0 | 1): PlayerState {
  for (let i = 0; i < m.players.length; i++) {
    const p = m.players[i];
    if (p.team === t && p.role === 'gk') return p;
  }
  throw new Error(`team ${t} has no goalkeeper`);   // structural: this alone is a failure
}

function keeperLineDist(m: MatchState, t: 0 | 1): number {
  const gk = keeperOf(m, t);
  const side = m.attackDir[t] === 1 ? 0 : 1;
  return Math.abs(gk.x - (goalLineX(m.pitch, side) + m.attackDir[t] * GK_LINE_DIST));
}

// The G12-3 "come out" condition, RE-DERIVED from the geometry and never by calling
// keeperStep: a keeper may leave its line outside the small area only to press a ball
// that is its to press. Copied, on purpose, from ai.test.ts's keeperWouldPressG12_3.
function keeperWouldPressG12_3(m: MatchState, t: 0 | 1): boolean {
  const gk = keeperOf(m, t);
  const side = m.attackDir[t] === 1 ? 0 : 1;
  const { ball, players, stepCount } = m;
  const ownerTeam = ball.owner === null ? null : players[ball.owner].team;
  if (ownerTeam === gk.team) return false;
  const inSmall = isInsideSmallArea(m.pitch, side, ball.x, ball.y);
  const inBig = isInsideBigArea(m.pitch, side, ball.x, ball.y);
  if (!inSmall && !(inBig && ownerTeam !== null)) return false;
  const mine = dist(gk.x, gk.y, ball.x, ball.y);
  for (let i = 0; i < players.length; i++) {
    const q = players[i];
    if (q.team !== gk.team || q.id === gk.id || isPlayerDown(q, stepCount)) continue;
    if (dist(q.x, q.y, ball.x, ball.y) < mine) return false;
  }
  return true;
}

type Run = {
  match: MatchState; recorded: [TeamInput, TeamInput][]; invalid: number; outsideBox: number;
  phases: Set<MatchPhase>; leftLineWithoutPressReason: number; keepers: number;
};

function playCpu(seed: number, cap = CAP): Run {
  const match = fresh();
  const profiles: [AiProfile, AiProfile] = [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)];
  const states: [AiState, AiState] = [createAiState(), createAiState()];
  const cpuRngs = [createRng(seed ^ 0x1234), createRng(seed ^ 0x5678)];
  const rng = createRng(seed);
  const live: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
  const recorded: [TeamInput, TeamInput][] = [];
  const phases = new Set<MatchPhase>();
  const prevLine: [number, number] = [0, 0];
  let prevOpen = false;
  let invalid = 0;
  let outsideBox = 0;
  let leftLineWithoutPressReason = 0;
  let keepers = 0;
  let steps = 0;
  while (match.phase !== 'over' && steps < cap) {
    decideTeamInput(match, 0, profiles[0], states[0], cpuRngs[0], live[0]);
    decideTeamInput(match, 1, profiles[1], states[1], cpuRngs[1], live[1]);
    if (checkTeamInput(live[0], FORMATIONS.length).length > 0) invalid++;
    if (checkTeamInput(live[1], FORMATIONS.length).length > 0) invalid++;
    const frame: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    copyTeamInput(live[0], frame[0]);
    copyTeamInput(live[1], frame[1]);
    recorded.push(frame);
    const open = match.phase === 'play' || match.phase === 'golden-goal';
    // Captured BEFORE stepMatch, on the exact state keeperStep sees this step.
    const pressed: [boolean, boolean] = open
      ? [keeperWouldPressG12_3(match, 0), keeperWouldPressG12_3(match, 1)]
      : [false, false];
    stepMatch(match, live, rng);
    phases.add(match.phase);
    outsideBox += checkGoalkeepersInBox(match.players, match.attackDir, match.pitch).length;
    for (const t of [0, 1] as const) {
      const off = keeperLineDist(match, t);
      if (open && prevOpen && off > prevLine[t] + 1e-9) {
        const gk = keeperOf(match, t);
        const side = match.attackDir[t] === 1 ? 0 : 1;
        if (!isInsideSmallArea(match.pitch, side, gk.x, gk.y) && !pressed[t]) leftLineWithoutPressReason++;
      }
      prevLine[t] = off;
    }
    // Exactly one goalkeeper per team, every step: the sending off (T6) and the
    // substitution (T5) must never leave a team without one, nor with two.
    let gk0 = 0;
    let gk1 = 0;
    for (let i = 0; i < match.players.length; i++) {
      const p = match.players[i];
      if (p.role !== 'gk') continue;
      if (p.team === 0) gk0++;
      else gk1++;
    }
    if (gk0 !== 1 || gk1 !== 1) keepers++;
    prevOpen = open;
    steps++;
  }
  return { match, recorded, invalid, outsideBox, phases, leftLineWithoutPressReason, keepers };
}

function replay(seed: number, recorded: readonly [TeamInput, TeamInput][]): MatchState {
  const match = fresh();
  const rng = createRng(seed);
  for (const frame of recorded) stepMatch(match, frame, rng);
  return match;
}

function sameFinal(a: MatchState, b: MatchState): boolean {
  if (a.phase !== b.phase || a.stepCount !== b.stepCount || a.half !== b.half) return false;
  if (a.score[0] !== b.score[0] || a.score[1] !== b.score[1]) return false;
  if (a.ball.x !== b.ball.x || a.ball.y !== b.ball.y || a.ball.owner !== b.ball.owner) return false;
  for (let i = 0; i < a.players.length; i++) {
    if (a.players[i].x !== b.players[i].x || a.players[i].y !== b.players[i].y) return false;
  }
  return true;
}

describe('engine invariants (number-free: they survive every V15-4 change)', () => {
  const SEED = 14;
  const run = playCpu(SEED);

  it('a full CPU-vs-CPU match ends, never produces an invalid TeamInput and never lets a keeper out of its box', () => {
    expect(run.match.phase).toBe('over');
    expect(run.match.stepCount).toBeGreaterThan(HALF_STEPS);
    expect(run.invalid).toBe(0);
    expect(run.outsideBox).toBe(0);
  });

  // H3: the one structural property of ai.test.ts that this file did NOT copy, and
  // the reason it passed green while ai.test.ts lost it. It is 0 today, it must be 0
  // for ever, and a non-zero value is NEVER re-baselined: it is investigated.
  it('every off-line move outside the small area has a G12-3 press reason, and each team keeps exactly one goalkeeper', () => {
    expect(run.leftLineWithoutPressReason).toBe(0);
    expect(run.keepers, 'some step had a team with zero or two goalkeepers').toBe(0);
  });

  it('the same seed replays to the same final state, and the recorded inputs replay through the engine alone', () => {
    expect(sameFinal(run.match, playCpu(SEED).match)).toBe(true);
    expect(sameFinal(run.match, replay(SEED, run.recorded))).toBe(true);
  });

  it('a different seed does NOT produce the same final state (the negative control of the two above)', () => {
    expect(sameFinal(run.match, playCpu(SEED + 1).match)).toBe(false);
  });

  it('the match drives the phase machine, not only `play`', () => {
    for (const phase of ['kickoff', 'play', 'set-piece', 'over'] as const) {
      expect(run.phases, `phase ${phase} was never visited`).toContain(phase);
    }
  });

  it('twelve more seeds, 900 steps each: no invalid input, no keeper out of its box, no off-line move without a reason', () => {
    for (let seed = 100; seed < 112; seed++) {
      const g = playCpu(seed, 900);
      expect(g.invalid, `seed ${seed}`).toBe(0);
      expect(g.outsideBox, `seed ${seed}`).toBe(0);
      expect(g.leftLineWithoutPressReason, `seed ${seed}`).toBe(0);
      expect(g.keepers, `seed ${seed}`).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Verlo en verde CON EL MOTOR DE HOY (todavía nueve contra nueve)**

Run: `npx vitest run components/games/football-logic/engine-invariants.test.ts`
Expected: **PASS, 6 tests** (medido en el pre-vuelo, sobre una copia pristina del repo en `f1d7d2a`: `Test Files 1 passed (1) · Tests 6 passed (6)`). Si alguno sale rojo aquí, el fichero lleva un número medido escondido: se quita antes de seguir.

- [ ] **Step 3: Los DOS controles negativos del fichero de invariantes**

Sin este paso, los seis tests de arriba podrían ser vacuos. Se rompen dos cosas distintas, a mano, y se comprueba que la red salta en las dos.

**(3.1) El determinismo.** En `match.ts`, dentro de `stepMatch`, justo después de `match.stepCount++`, añadir **temporalmente**:
```ts
if (match.stepCount === 500) match.ball.x += 0.0001;   // CONTROL NEGATIVO, se quita
```
Run: `npx vitest run components/games/football-logic/engine-invariants.test.ts`
Expected: **FAIL** en `the same seed replays to the same final state...` — el replay por `TeamInput` **no** coincide con la partida viva, porque el empujón depende del `stepCount` de cada corrida... y **si NO falla**, el test es vacuo y hay que arreglarlo antes de seguir (la forma de arreglarlo: comparar también `ball.z`, `ball.vx` y `ball.vy` en `sameFinal`).
Quitar la línea y volver a verde.

**(3.2) El portero por índice — el control que el plan original NO tenía (H3).** Es el que demuestra que este fichero ya **no** puede ser engañado por un cambio de tamaño de equipo. Dentro del propio `engine-invariants.test.ts`, sustituir **temporalmente** el cuerpo de `keeperOf` por el literal que el pre-vuelo encontró en `ai.test.ts`:
```ts
function keeperOf(m: MatchState, t: 0 | 1): PlayerState {
  return m.players[t * 9];   // CONTROL NEGATIVO, se quita
}
```
Expected, **ejecutándolo contra el motor de la Task 1b** (once contra once): **FAIL en 2 de los 6 tests**, medido literalmente en el pre-vuelo:
```
× every off-line move outside the small area has a G12-3 press reason, ...
  AssertionError: expected 4273 to be +0
× twelve more seeds, 900 steps each: ...
  AssertionError: seed 100: expected 202 to be +0
```
Contra el motor de hoy (nueve contra nueve) este control **no** falla, porque ahí `t * 9` **es** el portero: por eso el control se repite, con el mismo texto, en el Step de cierre de la Task 1b. **Si no falla allí, el fichero ha vuelto a ser vacuo y se para.** Deshacer y volver a verde.

- [ ] **Step 4: Compuertas de la tarea**

```bash
npx vitest run                    # verde, 1391 tests en 84 ficheros, 0 skipped
npx tsc --noEmit                  # sin errores
npx eslint components/games/football-logic                                    # sin errores nuevos
grep -rn "PENDING_REBASELINE" components/games | wc -l                        # 0
git diff --name-only f1d7d2a -- components/games | grep -v '\.test\.ts$'      # VACÍO: esta tarea no toca produccion
find .superpowers -name "*.ts" -o -name "*.tsx"                               # VACÍO
```
Anotar en `progress.md`: el número de tests, y que las marcas siguen a 0.

- [ ] **Step 5: Dejar el working tree verificado — commit lo hace Paco**

---

## Task V15-4-1b: once contra once — tamaño, formaciones, campo y la rejilla de la tanda (G15-16)

**Files:**
- Modify: `components/games/football-logic/teams.ts` (`TEAM_SIZE`, `OUTFIELD`, `FORMATIONS`)
- Modify: `components/games/football-logic/pitch.ts` (`PITCH`: campo, áreas, punto de penalti y círculo central; la portería **no**)
- Modify: `components/games/football-logic/players.ts` (`SHOOTOUT_GRID_*`, `placeAroundCentreSpot`)
- Modify: `components/games/football-logic/teams.test.ts`, `players.test.ts`, `pitch.test.ts`, `invariants.test.ts`, `set-pieces.test.ts`, `squads.test.ts`, **`actions.test.ts`**, **`ball.test.ts`**
- Modify: `components/games/football-screen/formation-preview.test.ts`, `lineup.test.ts`, `camera.test.ts`, `flow-layout.test.ts` (solo comentarios de proporción)
- Modify (clase 3 + marcas): `components/games/football-logic/ai.test.ts`, `match.test.ts`
- Modify: `specs/31-vault-world-cup.md` (criterio 4)

> **`actions.test.ts` y `ball.test.ts` estaban fuera de la lista del plan original y el pre-vuelo los midió en rojo (H1).** `actions.test.ts` cae con **12** y `ball.test.ts` con **1**.

**Interfaces:**
- Produces: `TEAM_SIZE = 11`, `OUTFIELD = 10`; `FORMATIONS` con ids `'4-4-2'` (NORMAL), `'4-3-3'` (OFENSIVA), `'5-3-2'` (DEFENSIVA); `PITCH` = 2200 × 1430 con áreas, punto de penalti y círculo central ×1,1 y **portería sin escalar**; `SHOOTOUT_GRID_COLUMNS = 5`, `SHOOTOUT_GRID_ROWS = 4`, `SHOOTOUT_GRID_SPACING_X = 60`, `SHOOTOUT_GRID_SPACING_Y = 80`.
- Consumes: `engine-invariants.test.ts` de la Task 1a, como compuerta.

> **Por qué esta tarea es la primera con código y por qué es tan grande.** Todo lo demás (atributos por jugador, tarjetas, lesiones) se apoya en cuántos juegan. Y `TEAM_SIZE` es **atómico**: no hay forma de subirlo a medias, así que los trece ficheros caen a la vez y se arreglan a la vez. Lo que sí se ha sacado fuera es la red (Task 1a). **Medido en el pre-vuelo, con las medidas definitivas de la resolución 5: 89 tests rojos en 13 ficheros** (`Test Files 13 failed | 70 passed (83) · Tests 89 failed | 1296 passed (1385)`).

- [ ] **Step 1: Escribir los tests de las tres formaciones nuevas y del tamaño (rojo)**

> **H11: el Step original hacía tres destrozos a la vez.** Cerraba el `it` justo después de `expect(OUTFIELD).toBe(10)`, con lo que **borraba los tres asertos de `STRATEGIES`**; dejaba el título mintiendo («team size is **nine**»); abría un `it` nuevo **sin su `});` de cierre**; **duplicaba** el `it` de los ids que ya existe (`teams.test.ts:68-74`) en vez de sustituirlo; y **no mencionaba** el fixture `STAGE_A_332` (`teams.test.ts:13-21`) ni su `it` (`:76-78`), que el pre-vuelo midió en rojo. Aquí van las **cuatro ediciones separadas**, con el fichero completo delante.

**(1.a) El `it` del tamaño** (`teams.test.ts:88-94`) — se conservan los tres `STRATEGIES` y se corrige el título:
```ts
  it('team size is eleven: ten outfield plus the goalkeeper; strategies shift by ±STRATEGY_SHIFT', () => {
    expect(TEAM_SIZE).toBe(OUTFIELD + 1);
    expect(OUTFIELD).toBe(10);            // G15-16: eleven a side, ten outfield
    expect(STRATEGIES.attack).toBe(STRATEGY_SHIFT);
    expect(STRATEGIES.defend).toBe(-STRATEGY_SHIFT);
    expect(STRATEGIES.neutral).toBe(0);
  });
```

**(1.b) El `it` de los tres ids** (`teams.test.ts:68-74`) — se **SUSTITUYE**, no se añade otro al lado:
```ts
  // G15-16: the three line-ups of the v1.5, with the SAME keys 1/2/3 and the same
  // three names. The ids are derived from the slots, so checkFormation already
  // guarantees the name matches the shape -- these are the SHAPES themselves.
  it('are the 4-4-2 NORMAL, 4-3-3 OFENSIVA and 5-3-2 DEFENSIVA of the spec, in that order, with matching slot counts', () => {
    expect(FORMATIONS.map((f) => [f.id, f.name, ...slotCounts(f)])).toEqual([
      ['4-4-2', 'NORMAL', 4, 4, 2],
      ['4-3-3', 'OFENSIVA', 4, 3, 3],
      ['5-3-2', 'DEFENSIVA', 5, 3, 2],
    ]);
    for (const f of FORMATIONS) expect(f.slots).toHaveLength(OUTFIELD);
  });
```

**(1.c) El fixture `STAGE_A_332` y su `it`** (`teams.test.ts:13-21` y `:76-78`) — **se reescriben a la 4-4-2**, no se borran. El fixture existe para que nadie mueva el índice 0 sin darse cuenta, y esa razón sigue viva:
```ts
// The published 4-4-2, byte for byte: several tests are coupled to the geometry of
// index 0 (takerId, KICK_TARGET_ID, the camera traces), so it lives here as a fixture
// and the test below is what notices if somebody nudges it. Replaces the stage-A
// 3-3-2 fixture, which V15-4 retired with the nine-a-side engine.
const PUBLISHED_442: Formation = {
  id: '4-4-2',
  name: 'NORMAL',
  slots: [
    { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
    { role: 'mid', x: 0.45, y: 0.15 }, { role: 'mid', x: 0.45, y: 0.38 }, { role: 'mid', x: 0.45, y: 0.62 }, { role: 'mid', x: 0.45, y: 0.85 },
    { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
  ],
};
// ...
  it('the 4-4-2 is the published one, byte for byte, at index 0', () => {
    expect(FORMATIONS[0]).toEqual(PUBLISHED_442);
  });
```

**(1.d) Un `it` nuevo: la alineación guardada de V15-3 sobrevive al cambio de formación.** El plan prometía comprobarlo «con un test y no con fe» (tabla «Lo que este paso da por cerrado de V15-3») y no lo escribía en ningún sitio. Va en `football-screen/lineup.test.ts`, junto al `it` de ida y vuelta:
```ts
  it('a lineup saved before V15-4 (f: "3-3-2", n: 9) falls back to the default eleven and KEEPS the edited names', () => {
    const old = '{"f":"3-3-2","n":9,"s":[0,3,4,5,9,10,11,15,16],"names":{"3":"PACO"}}';
    const parsed = parseLineup(old, FORMATIONS[0]);
    expect(parsed.starters).toHaveLength(TEAM_SIZE);
    expect(parsed.names[3]).toBe('PACO');
  });
```
(el JSON exacto se copia del que produce `serializeLineup` en `f1d7d2a`; lo que se asevera es la **política**, no el literal).

- [ ] **Step 2: Verlo en rojo**

Run: `npx vitest run components/games/football-logic/teams.test.ts`
Expected: **FAIL, 3 tests** (medido en el pre-vuelo): `expected 8 to be 10` en el del tamaño, el `toEqual` de los tres ids y `expected FORMATIONS[0] to equal STAGE_A_332` en el del fixture.

- [ ] **Step 3: Implementar el tamaño, las formaciones y el campo**

En `teams.ts`:
```ts
export const TEAM_SIZE = 11;
export const OUTFIELD = 10;
```
y sustituir el array `FORMATIONS` entero por:
```ts
// G15-16 (v1.5, V15-4): eleven a side. The three line-ups keep their keys (1/2/3) and
// their names; only the shapes changed. Every slot keeps x within (STRATEGY_SHIFT,
// 1 - STRATEGY_SHIFT) so checkFormation's "leaves pitch under strategy" never fires,
// and no two slots share a position.
export const FORMATIONS: readonly Formation[] = [
  {
    id: '4-4-2',
    name: 'NORMAL',
    slots: [
      { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
      { role: 'mid', x: 0.45, y: 0.15 }, { role: 'mid', x: 0.45, y: 0.38 }, { role: 'mid', x: 0.45, y: 0.62 }, { role: 'mid', x: 0.45, y: 0.85 },
      { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
    ],
  },
  {
    id: '4-3-3',
    name: 'OFENSIVA',
    slots: [
      { role: 'def', x: 0.2, y: 0.15 }, { role: 'def', x: 0.2, y: 0.38 }, { role: 'def', x: 0.2, y: 0.62 }, { role: 'def', x: 0.2, y: 0.85 },
      { role: 'mid', x: 0.45, y: 0.25 }, { role: 'mid', x: 0.45, y: 0.5 }, { role: 'mid', x: 0.45, y: 0.75 },
      { role: 'fwd', x: 0.72, y: 0.2 }, { role: 'fwd', x: 0.72, y: 0.5 }, { role: 'fwd', x: 0.72, y: 0.8 },
    ],
  },
  {
    id: '5-3-2',
    name: 'DEFENSIVA',
    slots: [
      { role: 'def', x: 0.18, y: 0.12 }, { role: 'def', x: 0.18, y: 0.31 }, { role: 'def', x: 0.18, y: 0.5 }, { role: 'def', x: 0.18, y: 0.69 }, { role: 'def', x: 0.18, y: 0.88 },
      { role: 'mid', x: 0.44, y: 0.25 }, { role: 'mid', x: 0.44, y: 0.5 }, { role: 'mid', x: 0.44, y: 0.75 },
      { role: 'fwd', x: 0.7, y: 0.35 }, { role: 'fwd', x: 0.7, y: 0.65 },
    ],
  },
];
```

> **H16: el 5-3-2 va con `mid x: 0.44` y `fwd x: 0.7`, no con 0,42 y 0,68.** Es lo que V15-3 dejó escrito en `squads.test.ts:26-32` (`V15_4_FORMATIONS`), y el argumento de «V15-3 ya lo dejó fijado» sólo es cierto si coinciden byte a byte. Las otras dos ya coincidían. (Ninguna de las dos versiones rompe `checkFormation`, que sólo mira roles, límites y duplicados: es una cuestión de que el plan no se contradiga con el repo.)

En `pitch.ts`, en `PITCH` — **resolución 5 de Paco (24-sep, tras el pre-vuelo), que corrige H4(4) y deroga las tres frases del borrador que decían que las áreas no escalan**:
```ts
// G15-16 (v1.5, V15-4): ~10 % bigger, so eleven a side is not a crowd. Both axes scale
// by exactly 1.1, which keeps the aspect ratio (and therefore minimap.ts's 200 x 130
// and flow-layout.ts's previews) EXACT without touching those files.
//
// Paco, 24-sep: the AREAS and the CENTRE CIRCLE scale with the pitch, in proportion,
// and so does the penalty spot, which is big-area geometry (checkPitch requires it
// inside the big area and outside the small one). The GOAL does NOT: goalWidth and
// crossbarHeight stay exactly as they are, because they are what decides how many
// goals go in and they are balanced against catchChance and SHOT_POST_MARGIN.
export const PITCH: PitchDef = {
  width: 2200,               // 2000 * 1.1
  height: 1430,              // 1300 * 1.1
  goalWidth: 150,            // NOT scaled
  crossbarHeight: 50,        // NOT scaled
  bigAreaDepth: 352,         // 320 * 1.1
  bigAreaWidth: 847,         // 770 * 1.1
  smallAreaDepth: 115.5,     // 105 * 1.1
  smallAreaWidth: 385,       // 350 * 1.1
  penaltySpotDist: 231,      // 210 * 1.1
  centerCircleRadius: 192.5, // 175 * 1.1
};
```

> **Comprobado, no supuesto:** con estas medidas `checkPitch(PITCH)` sigue dando `[]` (ejecutado en el pre-vuelo: el `it` `'accepts PITCH'` de `invariants.test.ts` sale verde; lo que cae son **siete fixtures de rechazo**, ver el Step 4). `smallAreaDepth` y `centerCircleRadius` dejan de ser enteros; no importa, son `number` y `goalKickX` ya devolvía fracciones al mirror-ear.

En `players.ts`, la rejilla de la tanda. Con diez de campo hay **`2 * OUTFIELD - 1` = 19** jugadores que aparcar, y la rejilla de 4 × 4 = 16 ya no da. Sustituir las cuatro constantes y borrar el salto:
```ts
// G15-16 (V15-4): with ten outfield players a side there are 2 * OUTFIELD - 1 = 19 to
// park, so the 4 x 4 grid of stage B2 is one row short. 5 x 4 = 20 = 2 * OUTFIELD keeps
// the old shape of the property (one slot more than the players) and, with an EVEN
// number of ROWS, no slot's offset from the centre is ever (0, 0) -- which is the whole
// point of finding H4: nobody parks on the centre spot where the NEXT kick's ball sits.
// (The old layout needed the `k === 7` skip to drop its extra slot; with 19 players and
// 20 slots the last one is simply never used, so the skip is gone.)
// Spacing 60 x 80 puts the far corner at sqrt(120^2 + 120^2) = 169.7 u from the centre
// spot, inside the centre circle, which is now 192.5 u (Paco 24-sep: the circle scales
// with the pitch). 169.7 < 192.5 with 23 u to spare -- the old 175 u circle already fit
// it, so the spacing is not what the scaling changed.
export const SHOOTOUT_GRID_COLUMNS = 5;
export const SHOOTOUT_GRID_ROWS = 4;
export const SHOOTOUT_GRID_SPACING_X = 60;
export const SHOOTOUT_GRID_SPACING_Y = 80;
```
y dentro de `placeAroundCentreSpot`, **borrar** la línea:
```ts
    if (k === 7) k++;   // Stage B2 (H4): the sixteenth slot is dropped so fifteen fit
```

- [ ] **Step 4: Verlo en rojo entero, y arreglar TODO lo que rompe (menos los dos congelados)**

Run: `npx vitest run`

**Censo MEDIDO en el pre-vuelo, sobre una copia del repo en `f1d7d2a` con exactamente los tres cambios de código del Step 3 y las medidas definitivas de la resolución 5 (H1):**

```
 Test Files  13 failed | 70 passed (83)
      Tests  89 failed | 1296 passed (1385)
```

| Fichero | Rojos medidos | Naturaleza |
|---|---|---|
| `football-logic/match.test.ts` | **22** | congelado → Step 5 |
| `football-logic/ai.test.ts` | **17** | congelado → Step 5 |
| `football-logic/actions.test.ts` | **12** | se arregla aquí |
| `football-logic/invariants.test.ts` | **11** | se arregla aquí (reanclado de fixtures) |
| `football-logic/players.test.ts` | **7** | se arregla aquí |
| `football-logic/set-pieces.test.ts` | **7** | se arregla aquí |
| `football-logic/teams.test.ts` | **3** | ya arreglados en el Step 1 |
| `football-screen/formation-preview.test.ts` | **3** | se arregla aquí |
| `football-logic/pitch.test.ts` | **2** | se arregla aquí |
| `football-screen/camera.test.ts` | **2** | se arregla aquí |
| `football-logic/ball.test.ts` | **1** | se arregla aquí |
| `football-logic/squads.test.ts` | **1** | se arregla aquí |
| `football-screen/lineup.test.ts` | **1** | se arregla aquí |

Cómo se arregla cada uno:

| Fichero : texto a buscar | Qué pasa | Arreglo |
|---|---|---|
| `teams.test.ts` (3) | ya arreglados en el Step 1 | — |
| `pitch.test.ts` : `'PITCH is 2000 x 1300 as the spec says'` | literal del tamaño y de las áreas | reescribir el `it` con las diez medidas de la resolución 5 y el título `'PITCH is 2200 x 1430 (G15-16: the v1 pitch x 1.1; the goal does NOT scale)'`, aseverando explícitamente `expect(PITCH.goalWidth).toBe(150)` y `expect(PITCH.bigAreaWidth).toBeCloseTo(770 * 1.1, 6)` |
| `pitch.test.ts` : `expect(centerX(PITCH)).toBe(1000)` | derivado | `toBe(PITCH.width / 2)` / `toBe(PITCH.height / 2)` — **fórmula, no número nuevo** |
| **`invariants.test.ts` (11)** | **no son literales: los fixtures están calibrados contra `PITCH`** | ver el bloque de abajo, que es su propio trozo de trabajo |
| `players.test.ts` (7) : `'maps a fraction to world units'`, `'mirrors x'`, `'attack pushes towards the rival goal…'`, `'a goalkeeper is clamped to its own big area'` y los tres de reparto de roles | coordenadas absolutas (`{x: 900, y: 325}`) y cuentas de la 3-3-2 (3 def / 2 fwd) | reanclar a `PITCH.width * fx` / `PITCH.height * fy` y a los recuentos de la 4-4-2 (4 def / 4 mid / 2 fwd) |
| `players.test.ts` : `'parks the fifteen outfield players...'` | **NO está en rojo** (medido: sobrevive) | solo título y comentario: → `'parks the nineteen outfield players who are not the taker...'` y `// the grid has 2 * OUTFIELD = 20 slots, one more than the nineteen`. Sus asertos ya eran derivados |
| `set-pieces.test.ts` (7) : `shootoutTakerId(1, 7)`, `(1, 8)` | la rotación da la vuelta a los 10, no a los 8 | `(1, 9)).toBe(TEAM_SIZE + 10)` y `(1, 10)).toBe(TEAM_SIZE + 1)` |
| `set-pieces.test.ts` : `expect(w.sp.takerId).toBe(TEAM_SIZE + 3)` y los `.toBeCloseTo` de la 3-3-2 | el más cercano cambia de slot al cambiar la formación **y** el campo | **re-derivar a mano** desde la 4-4-2 sobre 2200 × 1430 y dejar escrito el cálculo en el comentario, como ya hace ese fichero |
| **`actions.test.ts` (12)** : `freestMateDir` (×2), `releaseFromGoalkeeper` (×2), `applyKeeperButtons` (×6), `updateControlled`, `nextManualControl` | fixtures con **posiciones y cuentas de compañeros** calibradas contra ocho de campo y `centerY = 650` | reanclar: `650` → `centerY(PITCH)`, las coordenadas de compañero a fracciones de `PITCH`, y las cuentas «hay N compañeros en el cono» a `OUTFIELD`. **Ninguno es un número medido** |
| **`ball.test.ts` (1)** : `'the keeper does not pick up a MOVING ball but does pick up one at rest'` | la posición del portero y del balón salen del área, que ha crecido | reanclar a `PITCH.smallAreaDepth` / `goalLineX(PITCH, side)` |
| `squads.test.ts` : `expect(SQUAD_SIZE - TEAM_SIZE).toBe(9)` | derivado | `toBe(7)` y el comentario pasa a «seven reserves with eleven starters» |
| `squads.test.ts` : la tabla literal `V15_4_FORMATIONS` y **las cuatro líneas que la acompañan** | **ya no es del futuro** | se queda, **renombrada a `PREVIOUS_FORMATIONS`** con las de hoy (`3-3-2`/`3-2-3`/`4-3-1`). **H16: el `it` (`squads.test.ts:89-97`) lleva además `for (const f of …) expect(f.slots).toHaveLength(10)` → `toHaveLength(8)`, y los tres asertos de composición `squadRoleCount('mid') > 4` / `('def') > 5` / `('gk') > 1`, que con formaciones de ocho dejan de decir lo que dicen** → pasan a `> 3` / `> 4` / `> 1` con el comentario reescrito, y el título del `it` a `'and EVERY nine-a-side formation of the v1, so the squad of eighteen is not tied to one table'` |
| `formation-preview.test.ts` (3) : `previewDotCount(...).toBe(9)` | derivado | `toBe(TEAM_SIZE)` y se borra el comentario «changes once V15-4 raises TEAM_SIZE» |
| `formation-preview.test.ts` : `'maps a slot fraction into the rectangle'` (`expected 140 to be 144`) y `previewSlotRole` (`expected 'def' to be 'mid'`) | el primer defensa pasa de 0,22 a 0,2 y el hueco 4 pasa de medio a defensa | reanclar a `FORMATIONS[0].slots[0].x` y al rol real del hueco, no al literal |
| `lineup.test.ts` (1) : `'serialize -> parse is a round trip…'`, con `expect(raw).toContain('"f":"3-2-3"')` (`:143`) y dos JSON literales con `"f":"3-3-2"` (`:169`) | **el propio plan pedía anotarlo como hallazgo si cambiaba: cambia** | los tres literales pasan a `FORMATIONS[1].id` / `FORMATIONS[0].id`. Medido: `expected '{"f":"4-3-3","n":11,…' to contain '"f":"3-2-3"'` |
| `camera.test.ts` (2) : `expect(cameraTargetX(m)).toBe(1790)` y `toBe(650)` | `penaltySpotX(PITCH,1)` y `centerY(PITCH)` | `toBe(PITCH.width - PITCH.penaltySpotDist)` y `toBe(centerY(PITCH))` — **fórmula, no número nuevo** |
| `camera.test.ts` : los comentarios `2000 - 210 = 1790`, `1300 / 2 = 650`, `2000 + 60 - 800 = 1260`, `x=2000` | comentarios | reescribir con 2200/1430 y el penalti a 231 |
| `flow-layout.test.ts` : `2000 / 1300` (×2) | **no cambia de valor** (la proporción es la misma) | solo el comentario: «2000 x 1300» → «2200 x 1430» |

**El trozo aparte: `invariants.test.ts` (11 rojos).** No se arreglan con un literal. Los fixtures de `checkPitch` se construyen con `pitch({ ... })` = `{ ...PITCH, ...over }`, así que **cada valor «ilegal» estaba calibrado contra el `PITCH` viejo** y, con el campo y las áreas ×1,1, **tres de ellos dejan de ser ilegales y el test de rechazo pasa a verde-falso antes de fallar**. El arreglo es **reanclarlos a `PITCH`**, no ponerles el número nuevo:

| `it` | Hoy | Pasa a |
|---|---|---|
| `rejects a goal wider than the small area` | `goalWidth: 360` | `goalWidth: PITCH.smallAreaWidth + 1` |
| `rejects a small area wider than the big area` | `smallAreaWidth: 800` | `smallAreaWidth: PITCH.bigAreaWidth + 1` |
| `rejects a big area wider than the pitch` | `bigAreaWidth: 1400` | `bigAreaWidth: PITCH.height + 1` |
| `rejects a small area deeper than the big area` | `smallAreaDepth: 330` | `smallAreaDepth: PITCH.bigAreaDepth + 1` |
| `rejects a big area past the halfway line` | `bigAreaDepth: 1010, penaltySpotDist: 500` | `bigAreaDepth: PITCH.width / 2 + 1` (el `penaltySpotDist: 500` se queda: sigue dentro del área grande y fuera de la pequeña) |
| `rejects a penalty spot outside the big area` | `penaltySpotDist: 340` | `penaltySpotDist: PITCH.bigAreaDepth + 1` |
| `rejects a center circle that crosses the touch lines` | `centerCircleRadius: 700` | `centerCircleRadius: PITCH.height / 2 + 1` |
| `checkFormation accepts the legal fixture` | `legalFormation()` tiene **8** huecos | el fixture crece a **10** (3-3-2 → 4-4-2 a mano, con su `id` coherente), que es lo único que `checkFormation` mira |
| `checkFormation rejects seven slots` | `slice(0, OUTFIELD - 1)` con mensaje `'slot count 7'` | con el fixture de 10, `slice` da 9 → mensaje `'slot count 9'`, y el título pasa a `'rejects nine slots'`. **Y el `it` vecino `'rejects nine slots'`, que añade un hueco, pasa a `'rejects eleven slots'` con `'slot count 11'`** |
| `checkFormations accepts three distinct legal formations` | el helper `three()` deriva de `legalFormation()` | se arregla solo al crecer el fixture; el `it` `'propagates a per-formation problem'` usa `slice(0, 6)` y su mensaje `'3-2-3: slot count 6'` sigue valiendo, pero **su id pasa a ser el de la tabla nueva** |
| `checkGoalkeepersInBox rejects a goalkeeper wandering to midfield` | `ps[9].x = 900` y el mensaje `'goalkeeper 9 outside big area'` | **clase 3 pura**: `ps[TEAM_SIZE].x = centerX(PITCH)` y `` `goalkeeper ${TEAM_SIZE} outside big area` `` |

> **Control negativo de este trozo, obligatorio:** tras reanclarlos, volver a poner **uno solo** (p. ej. `goalWidth: PITCH.smallAreaWidth - 1`) y comprobar que el `it` correspondiente **se pone rojo**. Si no se pone, el fixture ha dejado de ser ilegal y el test es vacuo. Ese es exactamente el fallo que el pre-vuelo encontró.

> **La nota de `squads.test.ts`.** En V15-3 ese test comprobaba `checkSquadCoversFormations` contra una tabla literal con las formaciones **de V15-4**, para garantizar que V15-4 no tendría que reabrir `squads.ts`. Hoy esa tabla **es** `FORMATIONS`, así que el test se habría vuelto redundante. En vez de borrarlo, se le da la vuelta: la tabla literal pasa a llevar las **tres formaciones de la v1** (3-3-2 / 3-2-3 / 4-3-1) y el test queda como lo que siempre fue en el fondo — la prueba de que la plantilla de 18 sirve para **cualquier** tabla de formaciones, la de ayer y la de hoy. **Es, además, la comprobación de que la promesa de V15-3 se ha cumplido: `squads.ts` no se ha tocado en esta tarea.**

- [ ] **Step 5: Los dos ficheros congelados — CLASE 3 primero, marcar después**

Run: `npx vitest run components/games/football-logic/ai.test.ts components/games/football-logic/match.test.ts`
**Medido en el pre-vuelo: 39 rojos** (17 en `ai.test.ts`, 22 en `match.test.ts`). El plan original preveía **2** y decía que eran números medidos: **no lo son**. Se trabaja en dos pasadas, en este orden.

**(5.a) La pasada mecánica de clase 3 — los índices de identidad.** Medido: baja de **39 a 25** y, lo más importante, **devuelve a verde `'(a, fuzz) twelve more seeds, 900 steps each'`**, que es donde vivía `keeperLeftLineWithoutPressReason === 0`. Es decir: ese invariante estructural **no se había roto**; lo rompía el fixture. Sustituciones, con su import de `TEAM_SIZE` añadido en los dos ficheros:
- `ai.test.ts:827`, `:840`, `:927` → `m.players[t * 9]` / `match.players[t * 9]` → `[t * TEAM_SIZE]`.
- Todo `players[N]` con `N ≥ 9` en los dos ficheros → `players[TEAM_SIZE + (N − 9)]`. Son, entre otros, `ai.test.ts:436` (`w.players[9]`, «team 1 keeper»), `:1071`/`:1077` (`m.players[8]`), la veintena de `w.players[10]`/`players[12]` de los fixtures de rival, y `match.test.ts:187, 325, 329, 398, 442, 494, 513, 545, 612, 628, 999, 1033, 1102, 1265, 1859, 1891, 1904, 1909`.
- `match.test.ts:960` → `expect(a.players.length).toBe(18)` → `toBe(TEAM_SIZE * 2)`.

**(5.b) La segunda pasada de clase 3 — ids literales en el lado derecho y fixtures de geometría.** De los 25 que quedan, **21 son esto**. Los que el pre-vuelo midió uno a uno:
- **Ids literales**: los cuatro `it` de D4 de `match.test.ts` fallan con `expected 11 to be 9` — `9` era el id del portero del equipo 1 → `TEAM_SIZE`. Los dos del cambio manual con C fallan con `expected 1 to be 3` / `expected 3 to be 1` — el orden de cercanía cambia con once, y el aserto se reescribe sobre **quién** debe tomar el control (el más cercano activo), no sobre su id.
- **Geometría**: `ai.test.ts` → `'the same loose ball just OUTSIDE the small area (x = 122)'` (el área creció: `122` → `PITCH.smallAreaDepth + 6.5`), los tres de `positionTeam` (drift del 30 %/20 % sobre un campo mayor), los dos de `keeperStep` G12-3, `laneBlocked`, los dos de `keeperCatch`. `match.test.ts` → `createMatch` (`expected 1100 to be close to 1000` → `toBeCloseTo(centerX(PITCH), 10)`), los dos de `judgeBall` C y D (`expected 'play' to be 'goal'`: el disparo de 700 u/s ya no llega a la línea en los pasos del fixture, que se reanclan a `goalLineX(PITCH, s)`), el penalti (`expected 'free-kick' to be 'penalty'`: la falta cae ahora fuera del área grande, que se ha movido) y el gol de oro del último paso.
- **Descripción del dato**: `describe('criterion 11 with the real formations: switching 3-3-2 → 4-3-1 mid-play...')` usa `m.players[8]` («slot 7») y afirma `role === 'fwd'`; con la 4-4-2 el hueco 8 es un **medio** (medido: `expected 'mid' to be 'fwd'`). Título → `switching 4-4-2 → 5-3-2`, aserto → `toBe('mid')`, comentario ajustado.

**(5.c) Y SÓLO ENTONCES, marcar.** Lo que quede rojo después de (5.a) y (5.b) tiene que estar **en la lista blanca**. Medido, son **cuatro**:
1. `ai.test.ts` → `'(c) the keepers never left their box (G12-3: ...)'`, por `expect(game.stats.keeperLeftLineOutsideSmallArea).toBe(69)` (medido: sale `0`).
2. `ai.test.ts` → `'4-3-3 vs 4-3-3'`, `'5-3-2 vs 5-3-2'`, `'4-4-2 vs 5-3-2'` y `'4-3-3 vs 4-4-2'`, por `EXPECTED_OUTSIDE_SMALL_AREA` (medido: `54` donde decía `19`, `36` donde decía `0`, `0` donde decía `36`). Los cuatro comparten el mismo dato, así que se marcan los cuatro con el mismo comentario; **la clave del `Record` también cambia** (`'1-1'`/`'1-0'` siguen siendo pares de índices, no ids, así que no cambia).
3. `match.test.ts` → `'run A ends over with at least one goal...'`, por `expect(visited, ...).not.toContain('golden-goal')`. Medido: **ahora SÍ llega al gol de oro** (`AssertionError: this recording reached the golden goal: …`). Es la pregunta que el propio comentario pedía contestar; se contesta en la Task 9 Step 4.
4. (si aparece) cualquier otro **de la lista blanca**.

Para cada uno **y sólo para ellos**:
```ts
  // PENDING_REBASELINE (Task V15-4-9): eleven a side + a 10 % bigger pitch with x1.1
  // areas move every measured count of this recording. The STRUCTURAL half of it
  // lives, green, in engine-invariants.test.ts since Task V15-4-1a.
  it.skip('(c) the keepers never left their box (G12-3: off-line moves can now also be a big-area press)', () => {
```

> **La regla de parada, escrita aquí para que no haya que recordarla (H3).** Si tras (5.a) y (5.b) queda rojo un aserto que **hoy vale `0` o `[]`** —`keeperOutsideBox`, `keeperLeftLineWithoutPressReason`, `invalid`, `firstMismatchB === -1`— **NO se marca y NO se regraba: se para y se investiga**, porque es una regresión estructural. El pre-vuelo vio a `keeperLeftLineWithoutPressReason` salir **153** con el fixture sin reanclar, y a la Task 9 escribir tranquilamente `toBe(153)` encima. Con (5.a) hecha, sale **0**.

- [ ] **Step 6: Repetir el control negativo 3.2 de la Task 1a, ahora contra el motor de once**

Es el que demuestra que la red no se ha vuelto vacua con el cambio de tamaño. Sustituir temporalmente el cuerpo de `keeperOf` en `engine-invariants.test.ts` por `return m.players[t * 9];` y correrlo.
Expected: **FAIL en 2 de los 6 tests**, `expected 4273 to be +0` y `seed 100: expected 202 to be +0` (medido). Deshacer y volver a verde.

- [ ] **Step 7: El criterio 4 del spec**

En `specs/31-vault-world-cup.md`, en la lista de criterios, el 4:
```
4. **Nueve por equipo** (v1.5, G15-16: **once por equipo**, 10 de campo + portero, en amistoso y Mundial), y el portero nunca es el jugador controlado.
```

- [ ] **Step 8: Compuertas de la tarea**

```bash
npx vitest run                    # verde; ~4 tests skipped (el número exacto se MIDE), ninguno failed
npx tsc --noEmit                  # sin errores
npx eslint components/games/football-logic components/games/football-screen   # sin errores nuevos
npx vitest run components/games/football-logic/engine-invariants.test.ts      # 6 passed, sin tocar una linea
grep -rn "PENDING_REBASELINE" components/games | wc -l                        # <= 4, y cada uno en la LISTA BLANCA
grep -rn -A2 "PENDING_REBASELINE" components/games                            # revisar: ningun `it` fuera de la lista blanca
grep -rn "Math.random" components/games/football-logic components/games/football-screen   # VACÍO
grep -rn "from './squads'" components/games/football-logic/*.ts | grep -v squads    # VACÍO todavía (la T2 abre esa arista, no esta)
git diff --name-only f1d7d2a -- components/games/football-logic/ | sort
find .superpowers -name "*.ts" -o -name "*.tsx"                               # VACÍO
```
Y anotar en `.superpowers/sdd/2026-09-24-vault-world-cup-v15-4/progress.md`: el total de tests, **el número de marcas medido** y **la lista literal** de los `it` saltados (la compuerta (b) de las tareas siguientes compara contra esa lista).

- [ ] **Step 9: Dejar el working tree verificado — commit lo hace Paco**

> **FIN DEL DÍA 1.** Estado: motor once-contra-once sobre el campo definitivo (2200 × 1430, áreas y círculo ×1,1, portería intacta), trece ficheros reanclados, red estructural verde desde antes del golpe. `npx vitest run` **verde** con ~4 `it` saltados y sus marcas. `npx tsc --noEmit` limpio. Nada a medio medir.

---

## Task V15-4-2: atributos de selección, de jugador y de portero (G15-10 + G15-26)

**Files:**
- Modify: `components/games/football-logic/teams.ts` (tipo `TeamAttrs` + `attrs` en los veinte)
- Modify: `components/games/football-logic/squads.ts` (`KeeperAttrs`, `KEEPER_ATTRS`, `outfieldAttrsFor`, red)
- Modify: `components/games/football-logic/players.ts` (`PlayerState.squadIndex`, `.speedMult`, `.shotMult`, `.keeperReflexes`, `.keeperRushing`, `.keeperKicking`; `createPlayers` y `applySquadAttrs` los rellenan)
- Modify: `components/games/football-logic/ai.ts` (`profileFor` usa `def.attrs`; `keeperStep`/`keeperCatch` usan los del portero)
- Modify: `components/games/football-logic/match.ts` (pasa el portero vivo a `keeperCatch`; **exporta `keeperOf`**, hoy privada, H17)
- Create: `components/games/football-logic/attributes.test.ts`
- Modify: `components/games/football-logic/teams.test.ts`, `squads.test.ts`, `players.test.ts`, y **los doce ficheros de test que llaman a `createPlayers`** (una sola vez, en esta tarea)

**Interfaces:**
- Consumes: `TEAM_SIZE = 11`, `FORMATIONS` de la Task 1b.
- Produces:
  - `type TeamAttrs = { defence: number; attack: number; counter: number; shooting: number; passing: number }` (cada uno entero 1-5), campo `attrs` de `TeamDef`.
  - `type KeeperAttrs = { reflexes: number; rushing: number; kicking: number }` (1-5), `KEEPER_ATTRS: Readonly<Record<string, readonly [KeeperAttrs, KeeperAttrs]>>`, `keeperAttrsFor(teamId, squadIndex): KeeperAttrs`.
  - `outfieldAttrsFor(teamId: string, squadIndex: number): { speed: number; shot: number }` (1-5 cada uno).
  - `PlayerState.squadIndex: number`, `.speedMult: number`, `.shotMult: number`, **`.keeperReflexes: number`, `.keeperRushing: number`, `.keeperKicking: number`** (0 para los de campo — H12: faltaban en la lista de la tarea, en el Mapa de ficheros y en la self-review).
  - `applySquadAttrs(p: PlayerState, teamId: string): void` — deriva los cinco multiplicadores/niveles de `p.squadIndex` y `p.role`. **Se escribe aquí**, no en la Task 5 (H10: no existía en ninguna tarea).
  - `defaultSquadIndexFor(formation: Formation, slot: number): number` — el menor índice libre del rol de ese hueco, portero incluido en el hueco −1. **Se escribe aquí** (H10).
  - `keeperOf(match, team): PlayerState` — **pasa de privada a exportada** en `match.ts` (H17: `match.ts:308-310`; la «duda 2» y el Step 7 la trataban como API sin serlo). Su cuerpo **no cambia**: sigue siendo `players[team * TEAM_SIZE]`, como manda la resolución 6.
  - `profileFor(def: TeamDef, difficulty: number): AiProfile` — misma firma, ahora sesgada por `def.attrs`.

> **LA FIRMA DE `createPlayers` SE FIJA AQUÍ Y NO SE VUELVE A TOCAR (H9).** El borrador la cambiaba **tres veces** con tres firmas incompatibles (dos `TeamDef` en la T2, dos `string` en el test de la T5, cuatro argumentos en la T7), con lo que el test de la T5 no compilaba y los doce ficheros que la llaman se tocaban dos veces. La firma definitiva, desde esta tarea hasta el final del paso:
> ```ts
> export function createPlayers(
>   formations: readonly [Formation, Formation],
>   pitch: PitchDef,
>   teamIds: readonly [string, string],
>   starters?: readonly [readonly number[], readonly number[]],
> ): PlayerState[]
> ```
> `starters` es **opcional**: si no se pasa, cada equipo sale con el reparto de `defaultSquadIndexFor`. La **Task 7 no cambia la firma**, sólo **pasa el array real** (`lineup.starters`) desde `match-run.ts`. Todos los tests del plan que llamen a `createPlayers` usan esta firma, incluido el del Step 1 de la Task 5.

> **Lo que esta tarea resuelve además de G15-10 y G15-26.** V15-3 dejó escrito que «la alineación elegida llegue al partido» era de V15-4 porque `PlayerState` no tenía nombre ni dorsal. Aquí `PlayerState` gana **`squadIndex`**, que es la única pieza que hacía falta: con él, un jugador del campo sabe **qué jugador de la plantilla es**, y de ahí salen sus atributos (esta tarea), su nombre para el rótulo de lesión (Task 6) y, en V15-5, su dorsal y su nombre en los eventos. **No** se conecta todavía la alineación guardada en `localStorage`: `createPlayers` reparte los dorsales por defecto con `defaultSquadIndexFor` (el menor índice libre de cada rol; `defaultLineup` vive en la pantalla y el motor no la importa, H17), y el cableado de la alineación elegida es de la pantalla — **Task V15-4-7**.

- [ ] **Step 1: Escribir los tests de los atributos (rojo)**

```ts
// components/games/football-logic/attributes.test.ts
import { describe, expect, it } from 'vitest';
import { TEAMS, type TeamAttrs } from './teams';
import { KEEPER_ATTRS, SQUAD_SIZE, checkAttributes, keeperAttrsFor, outfieldAttrsFor, squadRole } from './squads';
import { profileFor } from './ai';

const LEVELS = [1, 2, 3, 4, 5];

function attrValues(a: TeamAttrs): number[] {
  return [a.defence, a.attack, a.counter, a.shooting, a.passing];
}

describe('G15-10: five 1-5 attributes per selection', () => {
  it('every one of the twenty carries five integers in 1..5', () => {
    for (const t of TEAMS) {
      for (const v of attrValues(t.attrs)) {
        expect(Number.isInteger(v), `${t.id}`).toBe(true);
        expect(LEVELS, `${t.id}`).toContain(v);
      }
    }
  });
  it('the twenty are NOT all the same team with a different shirt (the point of the decision)', () => {
    const shapes = new Set(TEAMS.map((t) => attrValues(t.attrs).join('-')));
    expect(shapes.size).toBeGreaterThanOrEqual(12);
  });
  it('checkAttributes is not vacuous: it names a selection whose attribute is out of range', () => {
    expect(checkAttributes(TEAMS)).toEqual([]);
    const broken = [{ ...TEAMS[0], attrs: { ...TEAMS[0].attrs, shooting: 6 } }];
    expect(checkAttributes(broken).join(' ')).toContain('espana');
    expect(checkAttributes(broken).join(' ')).toContain('shooting');
  });
});

describe('G15-10: the attributes bend profileFor, and difficulty still dominates', () => {
  it('at the same difficulty, a better passer has LESS pass error and a better shooter LESS shot error', () => {
    const weak = { ...TEAMS[0], attrs: { defence: 3, attack: 3, counter: 3, shooting: 1, passing: 1 } };
    const strong = { ...TEAMS[0], attrs: { defence: 3, attack: 3, counter: 3, shooting: 5, passing: 5 } };
    expect(profileFor(strong, 5).passErrorDeg).toBeLessThan(profileFor(weak, 5).passErrorDeg);
    expect(profileFor(strong, 5).shotErrorDeg).toBeLessThan(profileFor(weak, 5).shotErrorDeg);
  });
  it('the bend is SMALL (Paco: "pequenos cambios"): never more than 20 % of the level-5 value', () => {
    const mid = { ...TEAMS[0], attrs: { defence: 3, attack: 3, counter: 3, shooting: 3, passing: 3 } };
    const base = profileFor(mid, 5);
    for (const level of LEVELS) {
      const t = { ...TEAMS[0], attrs: { defence: level, attack: level, counter: level, shooting: level, passing: level } };
      const p = profileFor(t, 5);
      expect(Math.abs(p.passErrorDeg - base.passErrorDeg)).toBeLessThanOrEqual(base.passErrorDeg * 0.2);
      expect(Math.abs(p.shotErrorDeg - base.shotErrorDeg)).toBeLessThanOrEqual(base.shotErrorDeg * 0.2);
    }
  });
  it('NEGATIVE CONTROL: difficulty still moves the profile more than the attributes do', () => {
    const best = { ...TEAMS[0], attrs: { defence: 5, attack: 5, counter: 5, shooting: 5, passing: 5 } };
    const worst = { ...TEAMS[0], attrs: { defence: 1, attack: 1, counter: 1, shooting: 1, passing: 1 } };
    const byAttrs = Math.abs(profileFor(best, 5).passErrorDeg - profileFor(worst, 5).passErrorDeg);
    const byLevel = Math.abs(profileFor(best, 8).passErrorDeg - profileFor(best, 1).passErrorDeg);
    expect(byLevel).toBeGreaterThan(byAttrs);
  });
});

describe('G15-26: the two keepers of a squad are different', () => {
  it('every selection has exactly two keeper profiles, all three levels in 1..5', () => {
    for (const t of TEAMS) {
      const pair = KEEPER_ATTRS[t.id];
      expect(pair, `${t.id}`).toBeDefined();
      expect(pair).toHaveLength(2);
      for (const k of pair) {
        for (const v of [k.reflexes, k.rushing, k.kicking]) {
          expect(LEVELS, `${t.id}`).toContain(v);
        }
      }
    }
  });
  it('the number 2 is NOT a copy of the number 1 in any selection (so the sub is felt, G15-18)', () => {
    for (const t of TEAMS) {
      const [first, second] = KEEPER_ATTRS[t.id];
      expect(
        first.reflexes !== second.reflexes || first.rushing !== second.rushing || first.kicking !== second.kicking,
        `${t.id}: the two keepers are identical`,
      ).toBe(true);
    }
  });
  it('keeperAttrsFor maps squad index 0 and 1 to the pair, and throws for an outfield index', () => {
    expect(keeperAttrsFor('espana', 0)).toEqual(KEEPER_ATTRS['espana'][0]);
    expect(keeperAttrsFor('espana', 1)).toEqual(KEEPER_ATTRS['espana'][1]);
    expect(() => keeperAttrsFor('espana', 2)).toThrow();
  });
});

describe('G15-10: per-player speed and shot, derived from the role', () => {
  it('every outfield index of every selection gets speed and shot in 1..5', () => {
    for (const t of TEAMS) {
      for (let i = 0; i < SQUAD_SIZE; i++) {
        if (squadRole(i) === 'gk') continue;
        const a = outfieldAttrsFor(t.id, i);
        expect(LEVELS, `${t.id}[${i}] speed`).toContain(a.speed);
        expect(LEVELS, `${t.id}[${i}] shot`).toContain(a.shot);
      }
    }
  });
  it('the role dominates: forwards shoot better than defenders on average, across the twenty', () => {
    let fwd = 0;
    let def = 0;
    let n = 0;
    for (const t of TEAMS) {
      for (let i = 0; i < SQUAD_SIZE; i++) {
        if (squadRole(i) === 'fwd') fwd += outfieldAttrsFor(t.id, i).shot;
        if (squadRole(i) === 'def') def += outfieldAttrsFor(t.id, i).shot;
      }
      n++;
    }
    expect(fwd / (4 * n)).toBeGreaterThan(def / (6 * n));
  });
  it('NEGATIVE CONTROL: two selections do NOT produce the same numbers for the same index', () => {
    let different = 0;
    for (let i = 0; i < SQUAD_SIZE; i++) {
      if (squadRole(i) === 'gk') continue;
      const a = outfieldAttrsFor('espana', i);
      const b = outfieldAttrsFor('japon', i);
      if (a.speed !== b.speed || a.shot !== b.shot) different++;
    }
    expect(different, 'the per-selection variation is missing: every squad is a clone').toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Verlo en rojo**

Run: `npx vitest run components/games/football-logic/attributes.test.ts`
Expected: **FAIL** con `Failed to resolve import` / `TS2305` para `TeamAttrs`, `KEEPER_ATTRS`, `keeperAttrsFor`, `outfieldAttrsFor`, `checkAttributes`.

- [ ] **Step 3: Los datos — `TeamAttrs` en `teams.ts`**

```ts
// G15-10 (v1.5): five levels 1-5 per selection. They are DATA, not a difficulty: the
// difficulty still dominates the profile (see attributes.test.ts). `counter` is the
// only one the AI reads outside profileFor -- it is the speed at which a team turns a
// steal into a long pass forward (ai.ts, chase).
export type TeamAttrs = {
  defence: number;
  attack: number;
  counter: number;
  shooting: number;
  passing: number;
};

export type TeamDef = { id: string; name: string; kit: Kit; attrs: TeamAttrs };
```
y a cada uno de los veinte `TeamDef` se le añade su `attrs`. Criterio para fijarlos (**es dato de juego, no simulación**): media de los cinco entre 2,8 y 3,6 en todos, ninguna selección con los cinco iguales, y **al menos doce formas distintas** entre las veinte (lo exige el test). Tabla propuesta, a revisar en el QA de Paco:

| id | def | atk | cnt | shoot | pass |
|---|---|---|---|---|---|
| espana | 3 | 4 | 3 | 3 | 5 |
| italia | 5 | 3 | 4 | 3 | 3 |
| brasil | 3 | 5 | 4 | 5 | 4 |
| argentina | 4 | 5 | 4 | 5 | 4 |
| alemania | 4 | 4 | 3 | 4 | 4 |
| francia | 4 | 4 | 5 | 4 | 4 |
| inglaterra | 4 | 3 | 3 | 4 | 3 |
| portugal | 3 | 4 | 4 | 4 | 4 |
| paises-bajos | 3 | 4 | 3 | 3 | 4 |
| belgica | 3 | 4 | 4 | 4 | 3 |
| croacia | 3 | 3 | 3 | 3 | 4 |
| uruguay | 4 | 3 | 4 | 3 | 3 |
| mexico | 3 | 3 | 4 | 3 | 3 |
| japon | 3 | 3 | 4 | 2 | 4 |
| marruecos | 4 | 3 | 4 | 3 | 3 |
| estados-unidos | 3 | 3 | 3 | 3 | 3 |
| colombia | 3 | 4 | 4 | 4 | 4 |
| corea-del-sur | 3 | 3 | 4 | 3 | 3 |
| noruega | 3 | 4 | 3 | 4 | 3 |
| egipto | 3 | 3 | 3 | 3 | 3 |

> `estados-unidos` y `egipto` comparten forma a propósito: el test pide **≥ 12 formas distintas de 20**, no 20, y un par de selecciones «del montón» es información, no un descuido.

Y en `invariants.ts`, junto a `checkTeam`, la red de los atributos (se exporta desde `squads.ts` porque el test la importa de allí; ver Step 4 — **decisión**: vive en `squads.ts`, que es el fichero de datos de plantilla, para no meter a `invariants.ts` en el negocio de los atributos):

- [ ] **Step 4: Los datos — porteros y jugadores en `squads.ts`**

```ts
// G15-26 (Paco, 23-sep): three 1-5 levels per KEEPER. reflexes feeds keeperCatch's
// chance, rushing feeds how far and how fast keeperStep comes out (on top of G12-3),
// kicking feeds the strength and the accuracy of the goal kick and the hand throw.
// The two keepers of a squad are never identical: that is what makes the substitute
// noticeable when he comes on for an injury (G15-18).
export type KeeperAttrs = { reflexes: number; rushing: number; kicking: number };

export const KEEPER_ATTRS: Readonly<Record<string, readonly [KeeperAttrs, KeeperAttrs]>> = {
  espana: [{ reflexes: 4, rushing: 3, kicking: 4 }, { reflexes: 3, rushing: 4, kicking: 3 }],
  // ... las veinte, con el mismo criterio: el nº 1 mejor en al menos un nivel y
  // NUNCA los tres iguales a los del nº 2.
};

export function keeperAttrsFor(teamId: string, squadIndex: number): KeeperAttrs {
  const pair = KEEPER_ATTRS[teamId];
  if (pair === undefined) throw new Error(`no keepers for ${teamId}`);
  if (squadIndex !== 0 && squadIndex !== 1) throw new Error(`squad index ${squadIndex} is not a goalkeeper`);
  return pair[squadIndex];
}

// G15-10, "por jugador SOLO velocidad y chut, derivados del rol con pequena variacion
// por seleccion". DERIVED, not stored: a table of 360 pairs would be 360 more numbers
// to keep in sync with SQUAD_ROLES. The role sets the base, and the selection shifts it
// by a deterministic hash of (teamId, index) -- no Rng, no module state, same answer
// for ever.
const ROLE_SPEED: Readonly<Record<Role, number>> = { gk: 3, def: 3, mid: 4, fwd: 4 };
const ROLE_SHOT: Readonly<Record<Role, number>> = { gk: 1, def: 2, mid: 3, fwd: 4 };

function attrHash(teamId: string, index: number, salt: number): number {
  let h = salt;
  for (let i = 0; i < teamId.length; i++) h = Math.imul(h ^ teamId.charCodeAt(i), 0x01000193) >>> 0;
  return Math.imul(h ^ index, 0x01000193) >>> 0;
}

function clampLevel(v: number): number {
  return v < 1 ? 1 : v > 5 ? 5 : v;
}

export function outfieldAttrsFor(teamId: string, index: number): { speed: number; shot: number } {
  const role = squadRole(index);
  const speedShift = (attrHash(teamId, index, 0x811c9dc5) % 3) - 1;   // -1, 0 or +1
  const shotShift = (attrHash(teamId, index, 0x9e3779b9) % 3) - 1;
  return { speed: clampLevel(ROLE_SPEED[role] + speedShift), shot: clampLevel(ROLE_SHOT[role] + shotShift) };
}

// The invariant net of the attributes (same shape as checkSquads).
export function checkAttributes(teams: readonly TeamDef[]): string[] {
  const problems: string[] = [];
  for (const t of teams) {
    const a = t.attrs;
    for (const [name, v] of [['defence', a.defence], ['attack', a.attack], ['counter', a.counter], ['shooting', a.shooting], ['passing', a.passing]] as const) {
      if (!Number.isInteger(v) || v < 1 || v > 5) problems.push(`${t.id}: ${name} ${v} out of 1..5`);
    }
    const pair = KEEPER_ATTRS[t.id];
    if (pair === undefined) {
      problems.push(`${t.id}: no keeper attributes`);
      continue;
    }
    for (let k = 0; k < pair.length; k++) {
      for (const [name, v] of [['reflexes', pair[k].reflexes], ['rushing', pair[k].rushing], ['kicking', pair[k].kicking]] as const) {
        if (!Number.isInteger(v) || v < 1 || v > 5) problems.push(`${t.id}: keeper ${k} ${name} ${v} out of 1..5`);
      }
    }
    if (pair[0].reflexes === pair[1].reflexes && pair[0].rushing === pair[1].rushing && pair[0].kicking === pair[1].kicking) {
      problems.push(`${t.id}: the two keepers are identical`);
    }
  }
  return problems;
}
```

> **Cuidado con el criterio 20 y con la asignación por paso:** `outfieldAttrsFor` y `keeperAttrsFor` **solo se llaman en `createPlayers` y en la sustitución**, nunca por paso. `outfieldAttrsFor` devuelve un objeto nuevo — legítimo porque se llama 22 veces al crear el partido y 1 vez por cambio, **jamás** dentro de `stepMatch`. Eso queda escrito en el comentario de la función.

- [ ] **Step 5: `PlayerState` aprende quién es**

En `players.ts`:
```ts
export type PlayerState = {
  // ...
  // G15-10 / G15-26 (V15-4): which player of the squad this is. The multipliers are
  // DERIVED from it once, at creation (and again on a substitution), and never
  // recomputed inside the step: the step only multiplies.
  squadIndex: number;
  speedMult: number;   // 1 +- ATTR_SPEED_SPAN, from the per-player speed level
  shotMult: number;    // 1 +- ATTR_SHOT_SPAN, from the per-player shot level
};

// G15-10, "ajuste fisico pequeno (+-5 %)". Level 3 is 1.0; each level away from it is
// half of the span, so level 1 is 0.95 and level 5 is 1.05.
export const ATTR_SPEED_SPAN = 0.05;
export const ATTR_SHOT_SPAN = 0.05;

export function multForLevel(level: number, span: number): number {
  return 1 + ((level - 3) / 2) * span;
}
```
`createPlayers` recibe ahora los dos **`teamId`** (para leer la plantilla) y, opcionalmente, **el reparto de dorsales** (ver la firma fijada arriba). Por defecto el portero es el índice 0 y los de campo salen del mismo criterio que usa `defaultLineup`: el menor índice libre de cada rol. Ese criterio se escribe **una vez** en `players.ts`, en una función exportada `defaultSquadIndexFor(formation, slot): number`, y `football-screen/lineup.ts` **no se toca**: ya tiene el suyo y los dos coinciden por construcción, lo cual **se comprueba con un test** en `attributes.test.ts` (si dejaran de coincidir, el jugador vería en ALINEACIÓN un once distinto del que salta al campo).

> **H17: `defaultLineup` vive en `football-screen/lineup.ts:68`, no en `squads.ts`, y su único llamador de producción es `parseLineup` (`lineup.ts:200`).** El motor **no puede llamarla** sin importar `football-screen/` desde `football-logic/`, que es una arista prohibida. Por eso `defaultSquadIndexFor` es una función **nueva y propia del motor**, y lo que el test comprueba es que las dos dan el mismo reparto — no que una llame a la otra. La misma corrección vale para la cita del Step 4 de la Task 7 («Para el rival y para la CPU, `defaultLineup`»): lo que usa el motor es `defaultSquadIndexFor`; `defaultLineup` es lo que la **pantalla** le pasa.

> **H12: esta tarea ABRE la arista `football-logic/players.ts → football-logic/squads.ts`, a propósito.** `defaultSquadIndexFor` y `applySquadAttrs` necesitan `squadRole`/`SQUAD_ROLES`/`outfieldAttrsFor`, que viven en `squads.ts`. Eso **invalida** la propiedad que V15-3 dejó escrita y que la Task 1b usa como prueba de cierre («nadie de `football-logic/` importa `squads.ts`»): a partir de aquí, **`players.ts` sí lo importa**, y el `grep` de cierre de las tareas 2-11 lo espera en vez de tratarlo como error. Se anota en `progress.md` y en el comentario de cabecera de `players.ts`. La arista es de datos y en una sola dirección (`squads.ts` no importa `players.ts`), así que no hay ciclo.

`movePlayer` multiplica la velocidad:
```ts
  let speed = p.role === 'gk' ? GK_SPEED : hasBall ? PLAYER_SPEED_WITH_BALL : PLAYER_SPEED;
  speed *= p.speedMult;
```
y `shotSpeed` (en `actions.ts`) pasa a recibir el `shotMult` del que chuta:
```ts
export function shotSpeed(chargeSteps: number, shotMult: number): number {
  return (SHOT_SPEED_MIN + (SHOT_SPEED_MAX - SHOT_SPEED_MIN) * chargeFraction(chargeSteps)) * shotMult;
}
```
con `shoot(p, ...)` pasando `p.shotMult`. Ningún otro sitio **ejecutable** cambia (`shoot` en `actions.ts:95` es el único llamador), pero **sí quedan tres comentarios mintiendo y unos umbrales que hay que revisar (H12)**:
- `set-pieces.ts:31` (`// shotSpeed(24) = 800`) y `:32` (`// shotSpeed(36) = 850`) → se les añade «at shotMult 1».
- `hud.ts:110` («the engine's own ramp (actions.ts: shotSpeed goes 700 -> 950 over…)») → **los umbrales de la barra de carga del HUD están calibrados sobre esa rampa sin multiplicar**. Con `shotMult` a 1,05 un chut a plena carga son **997,5 u/s** y el HUD sigue diciendo 950. **Decisión de esta tarea:** la barra del HUD sigue pintando la **fracción de carga** (0..1), que no depende de `shotMult`, así que **no hay que tocar los umbrales**; lo que se corrige es el comentario, que pasa a decir «700 → 950 **before the shooter's shotMult**, which the bar does not show». Se anota en la deuda de la Task 8 y se pone en `qa-paco.md` («¿se nota que la barra llena no significa lo mismo con BRASIL que con JAPÓN?»).

- [ ] **Step 6: `profileFor` deja de ignorar `def`**

En `ai.ts`, sustituir el `void def;` por:
```ts
// G15-10: the five attributes BEND the profile; the difficulty still dominates
// (attributes.test.ts asserts both). Level 3 is neutral, so a 3-3-3-3-3 selection
// gives byte-for-byte the profile of the v1 -- which is what keeps the bend honest.
const ATTR_PASS_ERROR_PER_LEVEL = 0.35;
const ATTR_SHOT_ERROR_PER_LEVEL = 0.25;
const ATTR_CATCH_PER_LEVEL = 0.006;
const ATTR_TACKLE_PER_LEVEL = 0.012;

export function profileFor(def: TeamDef, difficulty: number): AiProfile {
  const a = def.attrs;
  const reactionMs = clampNum(REACTION_MS_BASE - difficulty * REACTION_MS_PER_LEVEL, REACTION_MS_MIN, REACTION_MS_MAX);
  return {
    reactionSteps: stepsFor(reactionMs / 1000),
    passErrorDeg: clampNum(PASS_ERROR_BASE - difficulty * PASS_ERROR_PER_LEVEL - (a.passing - 3) * ATTR_PASS_ERROR_PER_LEVEL, PASS_ERROR_MIN, PASS_ERROR_MAX),
    shotErrorDeg: clampNum(SHOT_ERROR_BASE - difficulty * SHOT_ERROR_PER_LEVEL - (a.shooting - 3) * ATTR_SHOT_ERROR_PER_LEVEL, SHOT_ERROR_MIN, SHOT_ERROR_MAX),
    catchChance: clampNum(CATCH_BASE + difficulty * CATCH_PER_LEVEL + (a.defence - 3) * ATTR_CATCH_PER_LEVEL, CATCH_MIN, CATCH_MAX),
    penaltyReadChance: clampNum(PENALTY_READ_BASE + difficulty * PENALTY_READ_PER_LEVEL, PENALTY_READ_MIN, PENALTY_READ_MAX),
    tackleChance: clampNum(TACKLE_BASE + difficulty * TACKLE_PER_LEVEL + (a.defence - 3) * ATTR_TACKLE_PER_LEVEL, TACKLE_MIN, TACKLE_MAX),
  };
}
```
`penaltyReadChance` **no** se sesga: su rango está clavado en [0,5125; 0,60] porque de ese mínimo depende la terminación de la muerte súbita (S-PK9). Tocarlo sería tocar la garantía de que la tanda acaba, y eso no está en G15-10.

`attack` y `counter` **no** entran en `profileFor`: entran en `ai.ts`, en la decisión — `attack` sube `CHASERS` en un jugador cuando la estrategia es `'attack'`; `counter` acorta `LONG_PASS_MIN_DIST` al recuperar el balón. Las dos son de una línea y van con su propio test en `attributes.test.ts`. **Si al implementarlas se ve que mueven la jugabilidad más que «pequeños cambios», se para y se pregunta** (regla de Paco: grill también durante la implementación).

- [ ] **Step 7: El portero deja de ser genérico (G15-26)**

`keeperCatch` recibe hoy `catchChance: number` desde `match.profiles[team].catchChance`. Pasa a recibir **la del portero que está en el campo**:
```ts
// match.ts, keeperCatchFor
const gk = keeperOf(match, team);
const chance = keeperCatchChance(match.profiles[team].catchChance, gk);
```
con, en `ai.ts`:
```ts
// G15-26: the team profile still sets the floor (the difficulty), the keeper's own
// reflexes bend it. Level 3 is neutral, so a keeper with 3 reflexes catches exactly
// like the v1 one did at the same difficulty.
export const KEEPER_REFLEX_PER_LEVEL = 0.03;

export function keeperCatchChance(teamCatchChance: number, gk: PlayerState): number {
  return clampNum(teamCatchChance + (gk.keeperReflexes - 3) * KEEPER_REFLEX_PER_LEVEL, CATCH_MIN, CATCH_MAX);
}
```
`PlayerState` gana, junto a `squadIndex`, tres escalares más — `keeperReflexes`, `keeperRushing`, `keeperKicking` — que valen `0` para los de campo y se rellenan en `createPlayers`/`applySquadAttrs` cuando el jugador es portero. (Alternativa descartada: un objeto `keeper: KeeperAttrs | null` en `PlayerState` — obliga a una comprobación de `null` en el camino caliente y a una asignación por cambio.) **Los tres están en los Files de esta tarea, en el Mapa de ficheros y en la self-review** — el borrador los introducía aquí sin declararlos en ninguno de los tres sitios (H12).

- `rushing` entra en `keeperStep`: multiplica `GK_SPEED` por `multForLevel(gk.keeperRushing, 0.08)` y **ensancha la condición de salida de G12-3** de `isInsideSmallArea` a un rectángulo que crece con el nivel entre el área pequeña (nivel 1) y el área grande (nivel 5). La forma exacta, con su test, en el Step 8.
- `kicking` entra en `releaseFromGoalkeeper` y en `applyKeeperButtons`: multiplica `LONG_PASS_SPEED` por `multForLevel(gk.keeperKicking, 0.10)` y **resta** error al saque (hoy el saque es exacto; sigue siéndolo para el humano — R10 — y para la CPU el `passErrorDeg` del perfil se multiplica por `multForLevel(6 - gk.keeperKicking, 0.20)`).

- [ ] **Step 8: Verlo todo en verde, con sus controles negativos**

Run: `npx vitest run components/games/football-logic/attributes.test.ts` → **PASS**.
**Control negativo obligatorio** (si no falla, los tests son vacuos): poner `def.attrs` a `{3,3,3,3,3}` a la fuerza dentro de `profileFor` (`const a = { defence: 3, attack: 3, counter: 3, shooting: 3, passing: 3 };`) y volver a correr.
Expected: **FAIL** en `'at the same difficulty, a better passer has LESS pass error...'` con `expected 8 to be less than 8`. Quitar la línea.

- [ ] **Step 9: Compuertas de la tarea** (las mismas del Step 8 de la Task 1b). `Marcas`: **se miden**, no se predicen; se prevé que caiga además `ai.test.ts` → `'ends, scores, and actually shoots, passes short and long, slides, steals, and the keepers catch and release'` por los umbrales de `stats` — **pero ese `it` asevera bandas (`toBeGreaterThanOrEqual`), no números medidos, así que NO está en la lista blanca**: si cae, es **clase 3 o regresión**, y se investiga antes de marcar nada. Añadir a las compuertas: `grep -rn "from './squads'" components/games/football-logic/players.ts` → **una línea, esperada** (arista abierta a propósito). Anotar en `progress.md`.

- [ ] **Step 10: Dejar el working tree verificado — commit lo hace Paco**

---

## Task V15-4-3: postes y larguero (G15-12)

**Files:**
- Create: `components/games/football-logic/goal-frame.ts`, `goal-frame.test.ts`
- Modify: `components/games/football-logic/ball.ts` (`BallState.frameHit`, llamada en `stepBall`)
- Modify: `components/games/football-logic/ball.test.ts`

**Interfaces:**
- Consumes: `PITCH` de la Task 1b. **La portería NO ha escalado** (resolución 5): `goalWidth` sigue siendo **150** y `crossbarHeight` **50**, que es exactamente de lo que depende este módulo entero. Por eso esta tarea **no tiene que replantearse nada** por el campo nuevo: `POST_RADIUS = 6` y `BALL_RADIUS = 5` dejan la boca en `150 − 2·11 = 128 u`, más de `4 · BALL_RADIUS` con margen de sobra, igual que antes. Las áreas sí han crecido, pero el marco no las mira.
- Produces:
  - `type FrameHit = 'none' | 'post' | 'crossbar'`; `BallState.frameHit: FrameHit`.
  - `POST_RADIUS = 6`, `BALL_RADIUS = 5`, `FRAME_BOUNCE = 0.55`, `CROSSBAR_THICKNESS = 8`.
  - `postCentreY(pitch, which: 0 | 1): number`, `frameHitFor(ball, pitch): FrameHit`, `bounceOffFrame(ball, pitch, hit: FrameHit): void`.

> **Dónde entra, y por qué ahí.** El marco se resuelve **dentro de `stepBall`, entre `flyAndRoll` y `pickUp`**, es decir **antes** de que el árbitro juzgue (el árbitro corre en `stepOpenPlay`, después de `stepPhysics`). Si se resolviera después, un balón que da en el palo ya habría sido juzgado gol o saque. Y va en `stepBall` y no en `stepPhysics` porque la tanda llama a `stepBall` **directamente** (`match.ts`, `stepShootout`): un penalti al palo tiene que rebotar igual que cualquier otro disparo.

- [ ] **Step 1: El módulo puro y su test (rojo)**

```ts
// components/games/football-logic/goal-frame.test.ts
import { describe, expect, it } from 'vitest';
import { PITCH, centerY, goalLineX } from './pitch';
import { createBall, type BallState } from './ball';
import { BALL_RADIUS, CROSSBAR_THICKNESS, FRAME_BOUNCE, POST_RADIUS, bounceOffFrame, frameHitFor, postCentreY } from './goal-frame';

function ballAt(x: number, y: number, z: number, vx: number, vy: number): BallState {
  const b = createBall();
  b.x = x; b.y = y; b.z = z; b.vx = vx; b.vy = vy;
  return b;
}

describe('G15-12: the two posts are collision circles on the goal line', () => {
  it('the posts sit exactly on the two ends of the goal mouth', () => {
    expect(postCentreY(PITCH, 0)).toBe(centerY(PITCH) - PITCH.goalWidth / 2);
    expect(postCentreY(PITCH, 1)).toBe(centerY(PITCH) + PITCH.goalWidth / 2);
  });
  it('a low ball arriving at the post is a post hit; one arriving a metre inside is not', () => {
    const onPost = ballAt(goalLineX(PITCH, 1) - 2, postCentreY(PITCH, 1), 10, 600, 0);
    expect(frameHitFor(onPost, PITCH)).toBe('post');
    const inside = ballAt(goalLineX(PITCH, 1) - 2, centerY(PITCH), 10, 600, 0);
    expect(frameHitFor(inside, PITCH)).toBe('none');
  });
  it('a ball above the crossbar is NOT a frame hit (G15-12: "por encima = fuera")', () => {
    const over = ballAt(goalLineX(PITCH, 1) - 2, centerY(PITCH), PITCH.crossbarHeight + CROSSBAR_THICKNESS + 1, 600, 0);
    expect(frameHitFor(over, PITCH)).toBe('none');
  });
  it('a ball arriving AT the height of the crossbar is a crossbar hit', () => {
    const bar = ballAt(goalLineX(PITCH, 1) - 2, centerY(PITCH), PITCH.crossbarHeight + 1, 600, 0);
    expect(frameHitFor(bar, PITCH)).toBe('crossbar');
  });
  it('a ball nowhere near a goal is never a frame hit', () => {
    expect(frameHitFor(ballAt(1000, 400, 0, 100, 100), PITCH)).toBe('none');
  });
});

describe('G15-12: the bounce sends it back into the pitch and it loses speed', () => {
  it('a post bounce reverses the x component and keeps the ball inside', () => {
    const b = ballAt(goalLineX(PITCH, 1) - 2, postCentreY(PITCH, 1), 10, 600, 0);
    const speedBefore = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    bounceOffFrame(b, PITCH, 'post');
    expect(b.vx).toBeLessThan(0);
    expect(b.x).toBeLessThan(goalLineX(PITCH, 1));
    expect(Math.sqrt(b.vx * b.vx + b.vy * b.vy)).toBeLessThan(speedBefore);
    expect(Math.sqrt(b.vx * b.vx + b.vy * b.vy)).toBeCloseTo(speedBefore * FRAME_BOUNCE, 6);
  });
  it('a crossbar bounce drops it back into the field of play, not over the line', () => {
    const b = ballAt(goalLineX(PITCH, 1) - 2, centerY(PITCH), PITCH.crossbarHeight + 1, 600, 0);
    bounceOffFrame(b, PITCH, 'crossbar');
    expect(b.vx).toBeLessThan(0);
    expect(b.vz).toBeLessThanOrEqual(0);
    expect(b.x).toBeLessThan(goalLineX(PITCH, 1));
  });
  it('NEGATIVE CONTROL: a goal is still a goal -- the frame never eats a ball between the posts', () => {
    const b = ballAt(goalLineX(PITCH, 1) - 2, centerY(PITCH), 10, 600, 0);
    expect(frameHitFor(b, PITCH)).toBe('none');
    const before = { x: b.x, vx: b.vx };
    bounceOffFrame(b, PITCH, frameHitFor(b, PITCH));
    expect(b.x).toBe(before.x);
    expect(b.vx).toBe(before.vx);
  });
  it('POST_RADIUS and BALL_RADIUS are small enough that the mouth is still wider than the ball', () => {
    expect(PITCH.goalWidth - 2 * (POST_RADIUS + BALL_RADIUS)).toBeGreaterThan(4 * BALL_RADIUS);
  });
});
```

- [ ] **Step 2: Verlo en rojo**

Run: `npx vitest run components/games/football-logic/goal-frame.test.ts`
Expected: **FAIL** con `Failed to resolve import "./goal-frame"`.

- [ ] **Step 3: Escribir `goal-frame.ts`**

```ts
import { centerY, goalLineX, type PitchDef, type Side } from './pitch';
import type { BallState } from './ball';

// G15-12 (v1.5, V15-4): the goal FRAME. Two collision circles on the goal line, one on
// each end of the mouth, plus a crossbar band on top of it. Pure arithmetic over a
// BallState: no Rng, no state, no allocation -- it is called once per step, for one
// ball, from stepBall.
//
// Boundary convention, deliberately aligned with pitch.ts's isBetweenPosts (EXCLUSIVE)
// and referee.ts's judgeBall: a ball whose centre is strictly between the posts and
// below the bar is a GOAL and the frame must never touch it. That is the negative
// control of this module's test, and it is the one property a bug here would break.
export type FrameHit = 'none' | 'post' | 'crossbar';

export const POST_RADIUS = 6;
export const BALL_RADIUS = 5;
// The band above crossbarHeight that still counts as hitting the bar. Above it the ball
// is OUT, which is exactly what judgeBall already does with a ball over the bar.
export const CROSSBAR_THICKNESS = 8;
// "rebote con perdida" (G15-12). 0.55 is half the ball's own ground bounce plus a
// little: a ball off the post comes back into play, it does not shoot away.
export const FRAME_BOUNCE = 0.55;

export function postCentreY(pitch: PitchDef, which: 0 | 1): number {
  const half = pitch.goalWidth / 2;
  return which === 0 ? centerY(pitch) - half : centerY(pitch) + half;
}

// The goal the ball is arriving at, or -1. The frame is only live within one ball
// radius plus one post radius of the goal line: everywhere else this returns -1 and the
// whole module costs two comparisons.
function goalSideNear(ball: BallState, pitch: PitchDef): Side | -1 {
  const reach = POST_RADIUS + BALL_RADIUS;
  if (ball.x <= reach) return 0;
  if (ball.x >= pitch.width - reach) return 1;
  return -1;
}

export function frameHitFor(ball: BallState, pitch: PitchDef): FrameHit {
  if (ball.owner !== null) return 'none';
  const side = goalSideNear(ball, pitch);
  if (side === -1) return 'none';
  const reach = POST_RADIUS + BALL_RADIUS;
  for (const which of [0, 1] as const) {
    const py = postCentreY(pitch, which);
    const dy = ball.y - py;
    if (dy > -reach && dy < reach && ball.z < pitch.crossbarHeight + CROSSBAR_THICKNESS) return 'post';
  }
  const half = pitch.goalWidth / 2;
  const cy = centerY(pitch);
  if (ball.y <= cy - half || ball.y >= cy + half) return 'none';
  if (ball.z >= pitch.crossbarHeight && ball.z < pitch.crossbarHeight + CROSSBAR_THICKNESS) return 'crossbar';
  return 'none';
}

// Reflects the ball back into the pitch and takes FRAME_BOUNCE of its speed away.
// Writes into `ball`; allocates nothing. A 'none' hit is a no-op by design, so the
// caller can hand it the result of frameHitFor without a branch.
export function bounceOffFrame(ball: BallState, pitch: PitchDef, hit: FrameHit): void {
  if (hit === 'none') return;
  const side = goalSideNear(ball, pitch);
  if (side === -1) return;
  const line = goalLineX(pitch, side);
  const inward = side === 0 ? 1 : -1;
  ball.vx = -ball.vx * FRAME_BOUNCE;
  ball.vy *= FRAME_BOUNCE;
  if (hit === 'crossbar') {
    ball.vz = -Math.abs(ball.vz) * FRAME_BOUNCE;
  }
  // Make sure it cannot be judged a goal on the very next step: park it one ball
  // radius inside the line, on the side it came from.
  if (ball.vx * inward <= 0) ball.vx = Math.abs(ball.vx) * inward;
  ball.x = line + inward * (POST_RADIUS + BALL_RADIUS);
}
```

- [ ] **Step 4: Verlo en verde y su control negativo**

Run: `npx vitest run components/games/football-logic/goal-frame.test.ts` → **PASS** (11 tests).
**Control negativo:** cambiar en `frameHitFor` la última comparación de `ball.y <= cy - half` a `ball.y < cy - half - 1000` (es decir, hacer el larguero infinitamente ancho).
Expected: **FAIL** en `'NEGATIVE CONTROL: a goal is still a goal...'` con `expected 'crossbar' to be 'none'`. Deshacer.

- [ ] **Step 5: Cablear `stepBall`**

En `ball.ts`: `BallState` gana `frameHit: FrameHit`, `createBall()` lo pone a `'none'`, y `stepBall`:
```ts
export function stepBall(ball: BallState, players: readonly PlayerState[], stepCount: number, pitch: PitchDef): void {
  ball.frameHit = 'none';
  if (ball.owner !== null) {
    stickToOwner(ball, players[ball.owner]);
    return;
  }
  flyAndRoll(ball);
  // G15-12: the frame BEFORE the pickup and, through it, before the referee
  // (stepOpenPlay judges after stepPhysics): a ball that hits the post must never be
  // judged a goal or a goal kick first. One level, reset at the top of every step, so
  // the screen reads it exactly like scratch.call -- on the edge.
  const hit = frameHitFor(ball, pitch);
  if (hit !== 'none') {
    bounceOffFrame(ball, pitch, hit);
    ball.frameHit = hit;
  }
  pickUp(ball, players, stepCount, pitch);
}
```
**Cuidado con el ciclo ESM:** `goal-frame.ts` importa `type BallState` de `ball.ts` (solo tipo, se borra al compilar) y `ball.ts` importa funciones de `goal-frame.ts`. Es una arista de una sola dirección en tiempo de ejecución, la misma que `ai.ts` ← `match.ts` ya usa. **Si `tsc` o vitest se quejan de un ciclo, la salida es mover el tipo `FrameHit` a `goal-frame.ts` y que `ball.ts` lo importe de allí** (que es exactamente lo que este plan hace).

- [ ] **Step 6: Tres tests de integración en `ball.test.ts`**

Un disparo al palo desde dentro del campo que vuelve al campo, un disparo entre palos que **sigue siendo gol** (comprobado con `judgeBall`) y un balón por encima del larguero que `judgeBall` sigue mandando fuera. El tercero es el que ata `frameHitFor` con el árbitro.

- [ ] **Step 7: Compuertas de la tarea** (`Marcas` esperado: **3**, sin marcas nuevas — el marco no mueve ninguno de los números que quedaban vivos; **si las mueve, se marca y se anota**). Dejar el working tree verificado.

---

## Task V15-4-4: entradas y faltas direccionales + la pausa de gol de 4 s (G15-24 + G15-4)

**Files:**
- Modify: `components/games/football-logic/actions.ts` (`TACKLE_BALL_REACH`, `stepTackle`)
- Modify: `components/games/football-logic/match.ts` (`GOAL_PAUSE_SECONDS`)
- Modify: `components/games/football-logic/actions.test.ts`, `match.test.ts` (solo el `GOAL_PAUSE_STEPS`, que es **derivado**)
- Modify (**clase 3**): `components/games/football-logic/ai.test.ts` → `ai.test.ts:710`

**Interfaces:**
- Produces: `TACKLE_BALL_REACH = 28`; `FOUL_FRONT_COS` y la función `contactIsFoul(tackler, victim): boolean`; `GOAL_PAUSE_SECONDS = 4`.

> **Contexto que faltaba: `ai.ts:610-613` ya restringe la entrada de la CPU a la cara del rival (H7).** Es el supuesto S14b de la etapa B, marcado «review in QA», y dice literalmente:
> ```ts
> // Stage B assumption S14b, not in the spec -- review in QA: slide only from the FRONT
> // (a slide from behind is a foul by construction). D2 fixes the willingness, not this.
> const inFront = (me.x - owner.x) * owner.facingX + (me.y - owner.y) * owner.facingY > 0;
> if (!inFront) return;
> ```
> `contactIsFoul` calcula **el mismo producto escalar**. G15-24 no invierte la regla de la CPU, pero **le quita la mitad del cono**: la CPU sólo entra de frente, y de frente ya no es falta.
>
> **Resolución 8 de Paco (24-sep): `ai.ts:612` NO SE TOCA.** La CPU sigue entrando sólo de frente y se aceptan los números que midió el pre-vuelo sobre 12 partidos CPU-vs-CPU completos, dificultad 8, semillas 200-211, aplicando **solo** `TACKLE_BALL_REACH 20 → 28` y `contactIsFoul`:
>
> | | faltas | entradas iniciadas | entradas ganadas | limpias |
> |---|---|---|---|---|
> | Motor de hoy | **95** | 297 | 70 | 23,6 % |
> | Con G15-24 | **72** (−24 %) | 309 | 130 | **42,1 %** |
>
> El objetivo «≈ 50 % de entradas limpias» queda a tiro (42,1 % sobre el motor de nueve; con once y campo mayor hay que volver a medir) y las faltas no desaparecen (12/12 partidos siguen teniendo alguna). Lo que hay que vigilar es que de esas faltas cuelgan G15-13 (tarjetas), G15-18 (lesiones al 8 % **de las faltas**) y `match.test.ts:836` (`sawFoulSetPiece`): con 6 faltas por partido, **una lesión cada dos partidos largos**. Se revisa en el QA jugado (`qa-paco.md`), no aquí.

- [ ] **Step 1: Los tests de la entrada direccional (rojo), en `actions.test.ts`**

```ts
describe('G15-24: the ball is reachable before the body, and only a contact from behind or from the side is a foul', () => {
  it('TACKLE_BALL_REACH is above TACKLE_FOUL_RADIUS, so a clean ball is taken before a body is touched', () => {
    expect(TACKLE_BALL_REACH).toBe(28);
    expect(TACKLE_BALL_REACH).toBeGreaterThan(TACKLE_FOUL_RADIUS);
  });
  it('a tackler sliding INTO the rival head on, without the ball, is a collision and NOT a foul', () => {
    const w = world();
    const tackler = w.players[1];
    const victim = w.players[TEAM_SIZE + 1];
    // Face to face: the tackler slides towards +x, the victim is facing -x.
    place(tackler, 400, 400, 1, 0);
    place(victim, 400 + TACKLE_FOUL_RADIUS - 2, 400, -1, 0);
    tackler.tackleStepsLeft = TACKLE_STEPS;
    tackler.tackleDirX = 1;
    tackler.tackleDirY = 0;
    stepTackle(tackler, w.ball, w.players, 0, w.ev);
    expect(w.ev.foul).toBe(false);
    expect(tackler.tackleStepsLeft).toBe(0);      // the slide still ENDS: it is a collision
    expect(tackler.downUntilStep).toBeGreaterThan(0);
  });
  it('the SAME contact from behind IS a foul', () => {
    const w = world();
    const tackler = w.players[1];
    const victim = w.players[TEAM_SIZE + 1];
    place(tackler, 400, 400, 1, 0);
    place(victim, 400 + TACKLE_FOUL_RADIUS - 2, 400, 1, 0);   // the victim is running AWAY
    tackler.tackleStepsLeft = TACKLE_STEPS;
    tackler.tackleDirX = 1;
    tackler.tackleDirY = 0;
    stepTackle(tackler, w.ball, w.players, 0, w.ev);
    expect(w.ev.foul).toBe(true);
    expect(w.ev.victimId).toBe(victim.id);
  });
  it('a contact from the SIDE is a foul too (G15-24: "por detras o de lado")', () => {
    const w = world();
    const tackler = w.players[1];
    const victim = w.players[TEAM_SIZE + 1];
    place(tackler, 400, 400, 0, 1);
    place(victim, 400, 400 + TACKLE_FOUL_RADIUS - 2, 1, 0);   // the victim faces +x, hit from -y
    tackler.tackleStepsLeft = TACKLE_STEPS;
    tackler.tackleDirX = 0;
    tackler.tackleDirY = 1;
    stepTackle(tackler, w.ball, w.players, 0, w.ev);
    expect(w.ev.foul).toBe(true);
  });
  it('NEGATIVE CONTROL: the ball still wins over the body -- a clean slide onto the ball steals it even with a rival in the foul radius', () => {
    const w = world();
    const tackler = w.players[1];
    const victim = w.players[TEAM_SIZE + 1];
    place(tackler, 400, 400, 1, 0);
    place(victim, 400 + TACKLE_FOUL_RADIUS - 2, 400, 1, 0);   // from behind: would be a foul
    w.ball.owner = null;
    w.ball.x = 400 + TACKLE_BALL_REACH - 2;                   // but the ball is within reach
    w.ball.y = 400;
    w.ball.z = 0;
    stepTackle(tackler, w.ball, w.players, 0, w.ev);
    expect(w.ev.foul).toBe(false);
    expect(w.ev.ok).toBe(true);
    expect(w.ball.owner).toBe(tackler.id);
  });
});
```

- [ ] **Step 2: Verlo en rojo**

Run: `npx vitest run components/games/football-logic/actions.test.ts`
Expected: **FAIL** — `expected 20 to be 28` en el primero, y `expected true to be false` en el segundo (hoy **cualquier** contacto es falta).

- [ ] **Step 3: Implementar**

En `actions.ts`:
```ts
export const TACKLE_BALL_REACH = 28;   // G15-24 (Paco, QA de V15-2): above TACKLE_FOUL_RADIUS
// ...
// G15-24: "falta solo si el contacto llega por detras o de lado; de frente sin tocar
// balon = choque, no falta". "From the front" is measured against the VICTIM's facing:
// the contact comes from the front when the vector victim -> tackler points the same way
// the victim is looking. cos 45deg = INV_SQRT2 is the same cone the pass assist uses, so
// the game has ONE definition of "in front of me" and not two.
export const FOUL_FRONT_COS = INV_SQRT2;

export function contactIsFoul(tackler: PlayerState, victim: PlayerState): boolean {
  const dx = tackler.x - victim.x;
  const dy = tackler.y - victim.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return true;                        // exactly on top of him: never "from the front"
  const facing = Math.sqrt(victim.facingX * victim.facingX + victim.facingY * victim.facingY);
  if (facing === 0) return true;                   // a victim facing nowhere cannot see it coming
  const dot = (dx / d) * (victim.facingX / facing) + (dy / d) * (victim.facingY / facing);
  return dot < FOUL_FRONT_COS;
}
```
y en `stepTackle`, dentro del bucle de contacto:
```ts
    if (dist(p.x, p.y, q.x, q.y) < TACKLE_FOUL_RADIUS) {
      p.tackleStepsLeft = 0;
      p.downUntilStep = stepCount + TACKLE_MISS_DOWN_STEPS;
      // G15-24: the slide always ENDS on a contact (the tackler goes down either way);
      // what the direction decides is whether the referee blows.
      if (!contactIsFoul(p, q)) return;
      out.foul = true;
      out.victimId = q.id;
      out.x = q.x;
      out.y = q.y;
      return;
    }
```

En `match.ts`:
```ts
const GOAL_PAUSE_SECONDS = 4;   // G15-4 (v1.5): room for the hug celebration, which is V15-5
```

- [ ] **Step 4: Verlo en verde**

Run: `npx vitest run components/games/football-logic/actions.test.ts` → **PASS**.
`match.test.ts` : `expect(GOAL_PAUSE_STEPS).toBe(stepsFor(2))` → `stepsFor(4)`. **Es derivado y cambia aquí**, no en la Task 9: está escrito como fórmula sobre un número que es la propia decisión.
`captions.ts` : `CAPTION_STEPS.goal = GOAL_PAUSE_STEPS` ya es derivado y no cambia. `sfx-map.ts` : `GOAL_CROWD_DELAY_STEPS` sigue en 0,7 s, ahora sobre una pausa de 4 s — **correcto, y se comprueba** con el test que ya existe (`goalCrowdDue`).

- [ ] **Step 5: La sonda de faltas, aquí y no en la Task 10 (H7)**

Una sonda **de usar y tirar**, no un test: un bucle con `console.log` en un fichero temporal que se **borra antes de cerrar la tarea**. Doce partidos CPU-vs-CPU completos, dificultad 8, semillas 200-211, contando **faltas** (`ev.foul`), **entradas iniciadas** (transición de `tackleStepsLeft` de 0 a >0, **no** eventos por paso — ver H8) y **entradas ganadas** (`ev.kind === 'tackle' && ev.ok`). Se corre **antes** y **después** del Step 3.
Referencia medida por el pre-vuelo sobre el motor de nueve: **95 → 72 faltas**, **23,6 % → 42,1 % de limpias**.
**Se anotan los dos números en `progress.md`.** Y la regla de parada: **si las faltas bajan de ~3 por partido, se para y se le pregunta a Paco antes de construir tarjetas y lesiones encima**, porque son su único combustible. (Por qué aquí y no en la Task 10: la Task 10 es la última tarea con contenido; descubrir en ella que no hay faltas obligaría a deshacer las tareas 5 y 6.)

- [ ] **Step 6: `ai.test.ts:710` — clase 3, no marca**

`ai.test.ts:710` se titula `'steals at < STEAL_RANGE …, slides at < TACKLE_DIST from the FRONT …, never from behind'`. G15-24 **invierte su semántica** (ahora «de frente» es precisamente lo que NO es falta), y el fichero **no estaba en los Files de esta tarea**. Es una **descripción del dato**, no un número medido: se reescriben el título y el último aserto para que digan lo que el motor hace ahora, con el comentario que explica que `ai.ts:612` sigue restringiendo la entrada de la CPU al frente (resolución 8). **No lleva marca.**

- [ ] **Step 7: Compuertas de la tarea.** `Marcas`: **se miden**. Se prevé que la entrada direccional toque el `it` de `match.test.ts` que exige `sawFoulSetPiece === true`; **ese aserto es booleano, no un número medido, así que NO está en la lista blanca**: si cae, significa que la grabación se ha quedado sin faltas, y eso se investiga con los números del Step 5 en la mano. Dejar el working tree verificado.

> **FIN DEL DÍA 2.** Estado: motor once-contra-once, con campo y áreas mayores, atributos, marco de portería, entrada nueva y pausa de 4 s. `npx vitest run` **verde**, con las marcas declaradas en `progress.md`. `npx tsc --noEmit` limpio. Nada a medio medir. Es el segundo punto donde se puede parar.

---

## Task V15-4-5: lesiones y cambios (G15-18)

> **Esta tarea era la 6 y ahora es la 5.** Lo obliga la **resolución 6 de Paco**: el portero expulsado sale por el **mecanismo de cambio de la tarea de lesiones**, así que `substitute` tiene que existir **antes** de que las tarjetas puedan expulsar a nadie. Aquí se crea `discipline.ts` (con su mitad de lesiones), la fase `'injury'`, `TeamInput.sub` y `substitute`; la Task 6 le añade las tarjetas y `isActive` crece en una línea.

**Files:**
- Create: `components/games/football-logic/discipline.ts`, `discipline.test.ts`
- Modify: `components/games/football-logic/input.ts` (`TeamInput.sub`)
- Modify: `components/games/football-logic/match.ts` (`MatchPhase` `'injury'`, `pendingInjury`, `injuriesUsed`, `injuryStepsLeft`, `substitute`)
- Modify: `components/games/football-logic/players.ts` (`PlayerState.injured`)
- Modify: `components/games/football-logic/ai.ts` (`decideTeamInput` rellena `sub` para la CPU)
- Modify: `components/games/football-screen/hud.ts` (`buttonsIdle` → `switch` exhaustivo) y `components/games/football-screen/loop.ts` (`frameMode` → `switch` exhaustivo)
- Modify: `components/games/football-logic/input.test.ts`

**Interfaces:**
- Consumes: el `ActionEvent.foul`/`victimId` de la Task 4; `squadIndex`, `applySquadAttrs`, `outfieldAttrsFor`, `keeperAttrsFor` y la firma fija de `createPlayers` de la Task 2.
- Produces:
  - `TeamInput.sub: number` (−1 = nada; si no, **índice de plantilla** del recambio).
  - `MatchPhase` gana `'injury'`; `MatchState.pendingInjury: [number, number]` (id del lesionado por equipo, −1 si no hay), **`MatchState.injuriesUsed: [number, number]`** y **`MatchState.injuryStepsLeft: [number, number]`**.
  - `PlayerState.injured: boolean`.
  - En `discipline.ts`: `INJURY_CHANCE = 0.08`, `INJURY_MAX_PER_TEAM = 1`, `INJURY_WINDOW_STEPS = stepsFor(8)`, `isActive(p)`, `canInjure(match, victim)`, `firstFreeReserveOfRole(match, team, role): number`, `hasSubstituteFor(match, team, out): boolean`.
  - En `match.ts`: `substitute(match, team, squadIndex): boolean`.

> **Por qué la decisión del humano viaja en el `TeamInput` y no en una llamada del componente.** El criterio 1 dice «misma semilla y misma secuencia de entradas producen el mismo estado». Si el cambio entrase por una llamada aparte (`game.substitute(...)`), la grabación dejaría de reproducir el partido y el criterio 1 se caería. Con `sub` dentro del `TeamInput`, un cambio es **una entrada más**, como la formación o la estrategia, y la grabación sigue siendo semilla + entradas. La CPU lo rellena en `decideTeamInput` **de forma derivada**, así que **no gasta ninguna tirada del `Rng`** y ninguna grabación CPU-contra-CPU se mueve por esto.

- [ ] **Step 1: Los tests (rojo)**

En `discipline.test.ts`, un `describe('G15-18: injuries')` con, **usando la firma fija de `createPlayers` de la Task 2** (`createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH, ['espana', 'italia'])`):

1. `'a foul injures the victim with probability INJURY_CHANCE, and the roll only happens when a foul is actually given'` — con un `Rng` de guion (`fixedRng`) se comprueba que con `0.05` hay lesión y con `0.5` no, y que **sin falta no se tira** (contando las llamadas con `countingRng`).
2. **`'a second injury in the same team never happens, EVEN AFTER the substitution (INJURY_MAX_PER_TEAM)'`** — la secuencia completa **falta → lesión → cambio → segunda falta al mismo equipo**, aseverando que la segunda no abre la fase. **Sin el cambio en medio, este test es vacuo** (H6): es exactamente el agujero que tenía el diseño anterior.
3. `'the CPU substitutes automatically, with a reserve of the SAME role, and never waits a step'`.
4. `'a human team stops in phase injury until its TeamInput carries a sub, and the CLOCK does not advance'` — se dan 300 pasos con `sub: -1`, la fase sigue en `'injury'` y **`match.halfStep` es el mismo antes y después**; en cuanto llega un `sub` legal, vuelve a `'play'`/`'set-piece'`.
5. `'the injury window times out: with nobody choosing, the reserve of that position comes on by itself'` — más de `INJURY_WINDOW_STEPS` pasos con `sub: -1` y el cambio se hace solo.
6. `'the set-piece countdown is frozen during the window and resumes where it was'` — se asevera `match.setPiece.countdown` antes y después de la ventana.
7. `'with no outfield reserve left the team plays with one less, and the match does NOT stall'`.
8. **`'an injured GOALKEEPER is replaced by the SECOND keeper'`** (resolución 7) — y `'a goalkeeper with no keeper left is FLAGGED but keeps playing: the team is never without a goalkeeper'`.
9. `'NEGATIVE CONTROL: an illegal sub (an index already on the pitch, of another team, an outfield player for the keeper or the keeper for an outfield player) is ignored and the phase stays in injury'`.
10. `'the substitute is a DIFFERENT player: his attributes come from his own squad index'` — el que entra no hereda los multiplicadores del que sale.

- [ ] **Step 2: Verlo en rojo** — `TS2339: Property 'sub' does not exist on type 'TeamInput'`.

- [ ] **Step 3: `TeamInput.sub`**

```ts
export type TeamInput = {
  // ...
  // G15-18 (v1.5, V15-4): the substitution the team asks for, as a SQUAD index; -1 for
  // "nothing". It rides inside the TeamInput and not in a call of its own because
  // criterion 1 says the replay is seed + TeamInput: a substitution decided outside
  // would not replay. It is read ONLY while the match is in phase 'injury' for that
  // team, and ignored everywhere else.
  sub: number;
};
```
`createTeamInput()` → `sub: -1`; `copyTeamInput` lo copia; `checkTeamInput` exige `Number.isInteger(sub) && sub >= -1 && sub < squadSize`. **`SQUAD_SIZE` vive en `squads.ts` y `input.ts` no lo importa hoy**: la comprobación se escribe con un parámetro nuevo (`checkTeamInput(input, formationCount, squadSize)`), y el llamador pasa `SQUAD_SIZE`. Así `input.ts` no se acopla al fichero de datos. **Los llamadores de `checkTeamInput` en los tests se actualizan en esta misma tarea** (incluidos los de `ai.test.ts`/`match.test.ts`, que es **clase 3**: añadir un argumento no es regrabar).

- [ ] **Step 4: La mitad de lesiones de `discipline.ts`**

```ts
import { SQUAD_SIZE, squadRole } from './squads';
import { stepsFor } from './step';
import type { Role } from './teams';
import type { PlayerState } from './players';
import type { MatchState } from './match';

// G15-18 (v1.5, V15-4): only a foul that the referee actually gives can injure, only
// the player who RECEIVED it, at most one per team per match, and by the match seed --
// so the roll is part of the deterministic state.
export const INJURY_CHANCE = 0.08;
export const INJURY_MAX_PER_TEAM = 1;
// Paco 24-sep (resolution 9): the LESIONADO window has a way out. Eight seconds and the
// reserve of that position comes on by itself, so a disconnected pad or a trip to the
// kitchen never leaves the match frozen.
export const INJURY_WINDOW_STEPS = stepsFor(8);

// THE one definition of "this player is on the pitch". Every loop in football-logic/
// that walks `players` and filters by team must use it. Task V15-4-6 adds `!p.sentOff`
// to it; the ONE documented exception is invariants.ts's checkGoalkeepersInBox, which
// deliberately looks at everybody.
export function isActive(p: PlayerState): boolean {
  return !p.injured;
}

// H6: the cap lives in the MATCH, not in the player. `injured` is cleared by the
// substitution (the reserve takes the same slot), so counting injured players would
// reset the cap to zero on every substitution and let a team be injured for ever.
// `injuriesUsed` is incremented where the injury is decided and NEVER decremented.
//
// The draw does NOT depend on whether a reserve exists: an injury is a possible outcome
// either way (an outfield player leaves, a keeper without a replacement is flagged and
// keeps playing), so the NUMBER of draws stays the same and the replay is safe.
export function canInjure(match: MatchState, victim: PlayerState): boolean {
  if (match.injuriesUsed[victim.team] >= INJURY_MAX_PER_TEAM) return false;
  if (match.pendingInjury[victim.team] >= 0) return false;
  return isActive(victim);
}

// The lowest squad index of that role that is not already on the pitch, or -1.
// Costs SQUAD_SIZE * players.length comparisons and runs only on the steps the phase
// is 'injury': never in the hot path.
export function firstFreeReserveOfRole(match: MatchState, team: 0 | 1, role: Role): number {
  for (let i = 0; i < SQUAD_SIZE; i++) {
    if (squadRole(i) !== role) continue;
    let onPitch = false;
    for (let k = 0; k < match.players.length; k++) {
      const p = match.players[k];
      if (p.team === team && p.squadIndex === i) { onPitch = true; break; }
    }
    if (!onPitch) return i;
  }
  return -1;
}

// G15-18 lets the HUMAN pick "cualquier posicion", so for an outfield player any free
// outfield reserve counts; for a keeper, only another keeper (resolutions 6 and 7).
export function hasSubstituteFor(match: MatchState, team: 0 | 1, out: PlayerState): boolean {
  if (out.role === 'gk') return firstFreeReserveOfRole(match, team, 'gk') >= 0;
  for (const role of ['def', 'mid', 'fwd'] as const) {
    if (firstFreeReserveOfRole(match, team, role) >= 0) return true;
  }
  return false;
}
```

- [ ] **Step 5: La fase `'injury'`, el reloj y el cambio**

`MatchPhase` gana `'injury'`. El `switch (match.phase)` de `stepMatch` gana su `case` y el `const _exhaustive: never` de `match.ts:670-675` lo obliga **dentro de `match.ts`**.

> **H5: fuera de `match.ts` NO hay ningún `_exhaustive`, y el plan contaba con que sí.** Verificado: el único `_exhaustive` del repositorio está en `match.ts:670-675`. `components/games/football-screen/` **no tiene ningún `switch` exhaustivo sobre `MatchPhase`**; usa comparaciones sueltas, así que añadir `'injury'` **compilaría en silencio en toda la pantalla**:
> - `hud.ts:94` `buttonsIdle`: `p === 'kickoff' || 'set-piece' || 'shootout' || 'goal' || 'half-time'` → con `'injury'` el HUD pintaría los botones **como si se estuviera jugando**.
> - `loop.ts:67` `frameMode`: `phase === 'over' ? 'captions-only' : 'full'` → seguiría en `'full'`.
> - `captions.ts:191-226` y `sfx-map.ts:80-89` son comparaciones sueltas (el `switch` exhaustivo de `sfx-map.ts:12-35` es sobre `CaptionKind`, no sobre `MatchPhase`); `VaultWorldCupGame.tsx:1933` y `:2012` son sobre `FlowPhase`.
>
> **Por eso los dos primeros se convierten en `switch` exhaustivo EN ESTA TAREA**, no en la 7: así la próxima fase que alguien añada **rompe la compilación** en vez de colarse. `buttonsIdle` devuelve `true` para `'injury'` (el juego está parado) y `frameMode` devuelve `'full'` explícitamente, con su comentario. Los dos de `captions.ts`/`sfx-map.ts` se revisan en la Task 7, que es la que les añade contenido.

**Dónde se decide la lesión:** en el mismo sitio donde la Task 6 pondrá `registerFoul`, justo después de juzgar la falta:
```ts
      // G15-18: the roll only happens when it CAN injure (canInjure), for the same
      // reason `steal` only rolls when a steal is possible: the NUMBER of draws is
      // part of the deterministic state.
      const victim = players[ev.victimId];
      if (canInjure(match, victim)) {
        if (rng() < INJURY_CHANCE) {
          match.injuriesUsed[victim.team]++;          // H6: never decremented
          if (victim.role === 'gk' && !hasSubstituteFor(match, victim.team, victim)) {
            // Paco 24-sep (resolution 7): a keeper with no keeper left is FLAGGED and
            // keeps playing. A team is never without a goalkeeper (criterion 9b).
            match.lastInjury = victim.id;              // caption only, no phase change
          } else {
            victim.injured = true;
            match.pendingInjury[victim.team] = victim.id;
            match.injuryStepsLeft[victim.team] = INJURY_WINDOW_STEPS;
            match.phase = 'injury';
          }
        }
      }
```

**El `case 'injury'` de `stepMatch`:**
```ts
    case 'injury': {
      // H13 / Paco 24-sep (resolution 9): THE CLOCK STOPS. `halfStep` only advances
      // inside stepOpenPlay, which does not run here, so the match clock is frozen for
      // as long as the window is open -- and so is the set-piece countdown, which lives
      // in stepSetPiece. That is deliberate and it is asserted by two tests.
      for (let t = 0; t <= 1; t++) {
        const team = t === 0 ? 0 : 1;                  // two branches, no array per step (criterion 20)
        if (match.pendingInjury[team] < 0) continue;
        const outPlayer = match.players[match.pendingInjury[team]];
        const wanted = inputs[team].sub;
        if (wanted >= 0 && substitute(match, team, wanted)) {
          match.pendingInjury[team] = -1;
          continue;
        }
        if (match.injuryStepsLeft[team] > 0) match.injuryStepsLeft[team]--;
        if (match.injuryStepsLeft[team] > 0 && hasSubstituteFor(match, team, outPlayer)) continue;
        // Out of time, or nothing to choose from. The default reserve of that position
        // comes on; if there is none, G15-18's "juega con uno menos" applies and the
        // injured outfield player simply stays off.
        const fallback = firstFreeReserveOfRole(match, team, outPlayer.role);
        if (fallback < 0 || !substitute(match, team, fallback)) match.pendingInjury[team] = -1;
        else match.pendingInjury[team] = -1;
      }
      if (match.pendingInjury[0] < 0 && match.pendingInjury[1] < 0) {
        // No set piece of its own: the foul's free kick was already called by the branch
        // that produced the injury, so play resumes exactly where it was, with the
        // countdown at the value it had when the window opened.
        match.phase = match.setPiece === null ? 'play' : 'set-piece';
      }
      break;
    }
```

**Y `substitute` — que ahora SÍ permite el cambio de portero (resolución 7, corrige H4(3)):**
```ts
// G15-18: the reserve takes the injured player's SLOT and his id -- the ids are the
// engine's identity (players[i].id === i, match.ts and set-pieces.ts depend on it), so a
// substitution swaps WHO the player is, never WHERE he sits in the array. Everything
// that makes him a different footballer is re-derived from his squad index.
export function substitute(match: MatchState, team: 0 | 1, squadIndex: number): boolean {
  const outId = match.pendingInjury[team];
  if (outId < 0) return false;
  if (!Number.isInteger(squadIndex) || squadIndex < 0 || squadIndex >= SQUAD_SIZE) return false;
  const out = match.players[outId];
  const incomingRole = squadRole(squadIndex);
  // Paco 24-sep (resolutions 6 and 7): a keeper is replaced by a KEEPER and an outfield
  // player by an OUTFIELD player of ANY position ("cualquier posicion", G15-18). What is
  // forbidden is MIXING the two, because the engine's keeper is players[team*TEAM_SIZE]
  // and its role is structural. gk -> gk is not only allowed, it is the whole point: it
  // is how the second keeper comes on for an injury (resolution 7) and for a red
  // (resolution 6, Task V15-4-6).
  if ((out.role === 'gk') !== (incomingRole === 'gk')) return false;
  for (let i = 0; i < match.players.length; i++) {
    const p = match.players[i];
    if (p.team === team && p.squadIndex === squadIndex) return false;   // already on
  }
  out.squadIndex = squadIndex;
  out.injured = false;
  out.fouls = 0;
  out.card = 'none';
  out.sentOff = false;
  applySquadAttrs(out, match.teams[team].id);
  return true;
}
```
> **H6: el `out.injured = true` del borrador se BORRA.** Era código muerto y engañoso —la lesión ya se marca donde se decide— y, sobre todo, `out` e `incoming` eran **la misma referencia**, así que `incoming.injured = false` deshacía la línea de arriba y dejaba al equipo **sin ningún jugador con `injured === true`**. Con el contador en `match.injuriesUsed`, el tope de G15-18 sobrevive al cambio, que es justo el caso que lo rompía.

> **Hallazgo del plan, y por qué `substitute` escribe sobre el mismo `PlayerState`.** Añadir un jugador 23 al array rompería tres cosas a la vez: `players[i].id === i` (la promesa de `players.ts`), `createPlayerEvents(TEAM_SIZE * 2)` (el `scratch.events` de `match.ts`, que es un array de tamaño fijo creado una vez) y `keeperOf(match, team) = players[team * TEAM_SIZE]`. **El cambio es una identidad nueva en un hueco existente**, no un jugador nuevo. Eso hay que escribirlo en el comentario del código, porque es contraintuitivo y el que lo lea dentro de seis meses lo va a querer «arreglar».

- [ ] **Step 6: La CPU decide sola**

En `ai.ts`, al final de `decideTeamInput`:
```ts
  // G15-18: "CPU: cambio automatico misma posicion". Derived, not drawn: the lowest
  // squad index of the injured player's role that is not already on the pitch. Costs
  // SQUAD_SIZE * TEAM_SIZE comparisons and runs ONLY on the steps the phase is 'injury'.
  out.sub = match.phase === 'injury' && match.pendingInjury[team] >= 0
    ? firstFreeReserveOfRole(match, team, match.players[match.pendingInjury[team]].role)
    : -1;
```

- [ ] **Step 7: Verlo todo en verde, con sus TRES controles negativos**

Run: `npx vitest run components/games/football-logic/discipline.test.ts components/games/football-logic/input.test.ts` → **PASS**.

**(7.1)** Poner `INJURY_CHANCE = 0`.
Expected: **FAIL** en `'a foul injures the victim with probability INJURY_CHANCE...'` con `expected false to be true`. Deshacer.

**(7.2) El importante para el determinismo:** quitar el `canInjure` de delante del `rng()`.
Expected: **FAIL** en el test de `countingRng` — el número de tiradas del partido grabado cambia, que es **exactamente** la clase de error que rompe el determinismo y que `engine-invariants.test.ts` pilla desde la Task 1a.

**(7.3) El importante para H6:** quitar `match.injuriesUsed[victim.team]++` y hacer que `canInjure` cuente jugadores con `injured === true` (que es lo que hacía el diseño anterior).
Expected: **FAIL** en `'a second injury in the same team never happens, EVEN AFTER the substitution'` — hay una segunda lesión. **Si NO falla, el test no está metiendo el cambio en medio y es vacuo.** Deshacer.

- [ ] **Step 8: Compuertas de la tarea.** Las de siempre, más:
```bash
npx vitest run components/games/football-logic/engine-invariants.test.ts   # 6 passed: ningun paso deja un equipo sin portero
grep -rn "_exhaustive" components/games/football-screen                    # hud.ts y loop.ts, nuevos
```
`Marcas`: se miden y se anotan. Dejar el working tree verificado.

---

## Task V15-4-6: tarjetas y expulsión real (G15-13)

> **Esta tarea era la 5 y ahora es la 6**, por la resolución 6 de Paco: el portero expulsado sale por `substitute`, que la Task 5 acaba de crear.

**Files:**
- Modify: `components/games/football-logic/discipline.ts`, `discipline.test.ts`
- Modify: `components/games/football-logic/players.ts` (`fouls`, `card`, `sentOff`)
- Modify: `components/games/football-logic/match.ts` (el registro de la falta, `lastCard`, `clearDiscipline` al empezar la tanda)
- Modify: `components/games/football-logic/actions.ts` (`updateTeamControl`, `nextManualControl`, `pickPassTarget`, `freestMateDir`, `steal` ignoran a los expulsados)
- Modify: `components/games/football-logic/ai.ts` (`positionTeam`, `chaseRank`, `mateCloserToBall` ignoran a los expulsados)
- Modify: `components/games/football-logic/invariants.ts` (`checkTeamCount`, **con cuerpo**)

**Interfaces:**
- Consumes: `contactIsFoul` y el `ActionEvent.foul` de la Task 4; **`substitute`, `firstFreeReserveOfRole`, `isActive` y `SQUAD_SIZE` de la Task 5**.
- Produces:
  - `type Card = 'none' | 'yellow' | 'red'`; `PlayerState.fouls: number`, `PlayerState.card: Card`, `PlayerState.sentOff: boolean`.
  - `CARD_YELLOW_AT = 2`, `CARD_RED_AT = 4`, `SENT_OFF_MAX = 2`.
  - `cardForFouls(fouls: number): Card`, `registerFoul(match, offenderId): Card` (devuelve la tarjeta **que se muestra**, que puede ser `'red'` sin expulsión), `sentOffCount(players, team): number`, `sendOffKeeper(match, team): boolean`, `isActive` **extendida** a `!p.sentOff && !p.injured`.
  - `MatchState.lastCard: { playerId: number; card: Card }` — un escalar por partido, leído por la pantalla **en el flanco**.
  - `checkTeamCount(players, controlled): string[]` en `invariants.ts`, **con cuerpo escrito aquí** (H10).

> **La pieza que hay que hacer bien: quién está «en el campo».** Hoy el motor decide «este jugador cuenta» con tres predicados distintos repartidos (`isControllable`, `p.role === 'gk'`, `isPlayerDown`). Un expulsado tiene que **desaparecer** de todos ellos a la vez. La forma de no dejarse ninguno es **una sola función**, `isActive(p)`, y un `grep` que lo demuestre:
> ```bash
> grep -rn "team !== \|\.team === " components/games/football-logic/*.ts | grep -v isActive
> ```
> Cada sitio que recorre `players` y filtra por equipo tiene que llevar `isActive(p)` al lado, **o estar en la lista de excepciones escrita en `discipline.ts`** (hoy hay una: `checkGoalkeepersInBox`, que quiere ver incluso al que ya no juega).

- [ ] **Step 1: El módulo y su test (rojo)**

```ts
// components/games/football-logic/discipline.test.ts (el describe de tarjetas)
import { describe, expect, it } from 'vitest';
import { CARD_RED_AT, CARD_YELLOW_AT, SENT_OFF_MAX, cardForFouls, isActive, registerFoul, sentOffCount } from './discipline';
import { FORMATIONS, TEAM_SIZE } from './teams';
import { PITCH } from './pitch';
import { createMatch } from './match';
import { TEAMS } from './teams';
import { profileFor } from './ai';

function game() {
  return createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
}

describe('G15-13: the card is a function of how many fouls the PLAYER has made', () => {
  it('yellow on the second, red on the fourth, nothing in between', () => {
    expect(CARD_YELLOW_AT).toBe(2);
    expect(CARD_RED_AT).toBe(4);
    expect([0, 1, 2, 3, 4, 5, 6].map(cardForFouls)).toEqual(['none', 'none', 'yellow', 'none', 'red', 'none', 'none']);
  });
  it('four fouls by the same player send him off, and the team really plays with one less', () => {
    const m = game();
    const offender = m.players[3];
    for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, offender.id);
    expect(offender.card).toBe('red');
    expect(offender.sentOff).toBe(true);
    expect(isActive(offender)).toBe(false);
    expect(m.players.filter((p) => p.team === 0 && isActive(p))).toHaveLength(TEAM_SIZE - 1);
  });
  it('four fouls spread over four DIFFERENT players send nobody off', () => {
    const m = game();
    for (const id of [2, 3, 4, 5]) registerFoul(m, id);
    expect(sentOffCount(m.players, 0)).toBe(0);
    expect(m.players.filter((p) => p.team === 0 && isActive(p))).toHaveLength(TEAM_SIZE);
  });
  it('the third red of a team is a caption only: SENT_OFF_MAX players leave, no more', () => {
    const m = game();
    expect(SENT_OFF_MAX).toBe(2);
    for (const id of [2, 3, 4]) {
      for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, id);
    }
    expect(sentOffCount(m.players, 0)).toBe(SENT_OFF_MAX);
    expect(m.players[4].card).toBe('red');         // the caption is shown
    expect(m.players[4].sentOff).toBe(false);      // but he stays on
  });
  it('NEGATIVE CONTROL: a foul by the OTHER team does not card anybody of this one', () => {
    const m = game();
    for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, TEAM_SIZE + 3);
    expect(sentOffCount(m.players, 0)).toBe(0);
    expect(sentOffCount(m.players, 1)).toBe(1);
  });
});

describe('G15-13 + Paco 24-sep (resolution 6): the sent-off GOALKEEPER', () => {
  it('the second keeper comes on and the team loses an OUTFIELD player, never its goalkeeper', () => {
    const m = game();
    const gk = m.players[0];
    const before = gk.squadIndex;
    for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, gk.id);
    expect(m.lastCard.card).toBe('red');
    // keeperOf is untouched: players[team * TEAM_SIZE] is still a keeper, now the second one.
    expect(m.players[0].role).toBe('gk');
    expect(m.players[0].squadIndex).not.toBe(before);
    expect(m.players[0].sentOff).toBe(false);
    expect(m.players.filter((p) => p.team === 0 && isActive(p))).toHaveLength(TEAM_SIZE - 1);
    expect(sentOffCount(m.players, 0)).toBe(1);
    const gone = m.players.find((p) => p.team === 0 && p.sentOff);
    expect(gone?.role).not.toBe('gk');
  });
  it('with no keeper left, the red is a CAPTION and nobody leaves', () => {
    const m = game();
    // burn the second keeper first (an injury brought him on in a previous window)
    // ... the test drives it through the Task 5 machinery, not by hand
    const gk = m.players[0];
    for (let i = 0; i < CARD_RED_AT; i++) registerFoul(m, gk.id);
    expect(m.lastCard.card).toBe('red');
    expect(sentOffCount(m.players, 0)).toBe(0);
    expect(m.players.filter((p) => p.team === 0 && isActive(p))).toHaveLength(TEAM_SIZE);
  });
});
```
(Los tests de «se reinician por partido» y «no afectan a la tanda» van contra `createMatch`/`endExtraTime` y se escriben en el mismo fichero.)

- [ ] **Step 2: Verlo en rojo** — `TS2305: Module './discipline' has no exported member 'registerFoul'`.

- [ ] **Step 3: La mitad de tarjetas de `discipline.ts`**

```ts
// G15-13 (v1.5, V15-4): cards are DETERMINISTIC -- a function of how many fouls that
// player has made in this match, with no Rng anywhere. Yellow on the second, red on the
// fourth (which G15-13 describes as "the second yellow"), and a team never loses more
// than SENT_OFF_MAX players: a third red is a caption and nothing else, so a match can
// never fizzle out into five against eleven.
export type Card = 'none' | 'yellow' | 'red';

export const CARD_YELLOW_AT = 2;
export const CARD_RED_AT = 4;
export const SENT_OFF_MAX = 2;

export function cardForFouls(fouls: number): Card {
  if (fouls === CARD_YELLOW_AT) return 'yellow';
  if (fouls === CARD_RED_AT) return 'red';
  return 'none';
}

// Task V15-4-5 wrote this as `!p.injured`; the sending off is the other half.
export function isActive(p: PlayerState): boolean {
  return !p.sentOff && !p.injured;
}

export function sentOffCount(players: readonly PlayerState[], team: 0 | 1): number {
  let n = 0;
  for (let i = 0; i < players.length; i++) if (players[i].team === team && players[i].sentOff) n++;
  return n;
}

// Paco 24-sep (resolution 6). The sent-off KEEPER does not leave a hole in the goal:
// the SECOND keeper takes his slot -- players[team * TEAM_SIZE], which keeperOf reads
// and which match.ts:316/322/333/365/556 and set-pieces.ts:143/302 all assume is a
// goalkeeper -- and the team gives up an OUTFIELD player instead. keeperOf is never
// touched and no PlayerState is ever moved in the array. Returns false when there is no
// keeper left, in which case the caller shows the caption and sends NOBODY off.
export function sendOffKeeper(match: MatchState, team: 0 | 1): boolean {
  const reserve = firstFreeReserveOfRole(match, team, 'gk');
  if (reserve < 0) return false;
  // Who pays for it: the active outfield player FARTHEST from the ball, ties broken by
  // the lowest id. Derived from the state, so it replays; no Rng.
  let victimId = -1;
  let best = -1;
  for (let i = 0; i < match.players.length; i++) {
    const p = match.players[i];
    if (p.team !== team || p.role === 'gk' || !isActive(p)) continue;
    const d = dist(p.x, p.y, match.ball.x, match.ball.y);
    if (d > best) { best = d; victimId = p.id; }
  }
  if (victimId < 0) return false;
  match.players[victimId].sentOff = true;
  // The offending keeper's IDENTITY leaves; the slot stays and becomes the second keeper.
  const gk = match.players[team * TEAM_SIZE];
  gk.squadIndex = reserve;
  gk.fouls = 0;
  gk.card = 'none';
  gk.sentOff = false;
  applySquadAttrs(gk, match.teams[team].id);
  return true;
}

// Counts the foul, decides the card and applies the sending off. Returns the card TO
// SHOW, which is 'red' even when nobody actually leaves (the caption without the sending
// off, G15-13 for the third red and resolution 6 for a keeper with no replacement).
// Allocates nothing.
export function registerFoul(match: MatchState, offenderId: number): Card {
  const p = match.players[offenderId];
  p.fouls++;
  const card = cardForFouls(p.fouls);
  if (card === 'none') return 'none';
  p.card = card;
  if (card !== 'red') return card;
  const team = p.team;
  if (sentOffCount(match.players, team) >= SENT_OFF_MAX) return 'red';   // caption only
  if (p.role === 'gk') {
    sendOffKeeper(match, team);                                          // false -> caption only
    return 'red';
  }
  p.sentOff = true;
  return 'red';
}
```
> **`registerFoul` cambia de firma respecto al borrador** (`(players, offenderId, team)` → `(match, offenderId)`): necesita el `match` para `sendOffKeeper` y para `match.teams[team].id`, y el equipo ya está en `p.team`. Es la firma que usan los tests de arriba y la que llama `match.ts`.

- [ ] **Step 4: Verlo en verde, y el control negativo**

Run: `npx vitest run components/games/football-logic/discipline.test.ts` → **PASS**.
**Control negativo 1:** cambiar `CARD_RED_AT` a `40`.
Expected: **FAIL** en `'four fouls by the same player send him off...'` con `expected 'none' to be 'red'`. Deshacer.
**Control negativo 2 (resolución 6):** hacer que `registerFoul` trate al portero como a un jugador de campo (`p.sentOff = true` sin pasar por `sendOffKeeper`).
Expected: **FAIL** en `'the second keeper comes on and the team loses an OUTFIELD player, never its goalkeeper'` **y** en `engine-invariants.test.ts` (`some step had a team with zero or two goalkeepers`) si se corre un partido con una roja a un portero. Deshacer.

- [ ] **Step 5: Cablear la falta en `match.ts`**

En `stepOpenPlay`, en el bucle que busca la primera falta (`if (ev.foul)`), **antes** de `judgeFoul` y **antes** de la tirada de lesión de la Task 5:
```ts
      // G15-13: the card is decided here, where the foul is judged, and NOT in
      // referee.ts: the referee's job is where play restarts, the discipline is the
      // match's. No extra pause (G15-13: "sin pausa extra"); the screen reads
      // match.lastCard on the edge, like it reads scratch.call.
      const offender = players[ev.actorId];
      match.lastCard.playerId = offender.id;
      match.lastCard.card = registerFoul(match, offender.id);
      judgeFoul(...);
```
y `match.lastCard` se limpia al principio de `stepMatch`, junto al barrido de `scratch.events`:
```ts
  match.lastCard.card = 'none';
  match.lastCard.playerId = -1;
```
`createMatch` lo crea **una vez**; `endExtraTime` **no lo toca** y ninguna función de la tanda escribe tarjetas — que es exactamente G15-13 («no afectan a la tanda»), y se comprueba con un test.

- [ ] **Step 6: Que el expulsado desaparezca de verdad, y la red que lo comprueba**

Recorrer con el `grep` de arriba y añadir `isActive(p)` en:
- `actions.ts`: `isControllable` (→ `p.team === team && p.role !== 'gk' && isActive(p)`), `pickPassTarget`, `freestMateDir`, `steal` (un expulsado no roba), el bucle de contacto de `stepTackle` (no se pita falta a quien ya no juega).
- `ai.ts`: `chaseRank`, `positionTeam`, `mateCloserToBall`.
- `ball.ts`: `canPickUp`.
- `set-pieces.ts`: `nearestOutfield` y `shootoutTakerId` — **ojo**: `shootoutTakerId` es aritmética pura (`team * TEAM_SIZE + 1 + taken % OUTFIELD`) y **puede nombrar a un expulsado**. G15-13 dice que las tarjetas «no afectan a la tanda», así que **se deja como está** y eso se escribe en su comentario: en la tanda tiran los once, expulsados incluidos. *(Es una lectura literal del spec; si en el QA a Paco le chirría, es un ajuste de una línea.)*

Y la red nueva en `invariants.ts`, **con cuerpo (H10: el borrador la dejaba en `{ /* ... */ }`, y es precisamente la que detecta un equipo en estado imposible)**:
```ts
import { INJURY_MAX_PER_TEAM, SENT_OFF_MAX, isActive } from './discipline';
import { TEAM_SIZE } from './teams';

// G15-13 + G15-18: a team never has fewer than TEAM_SIZE - SENT_OFF_MAX -
// INJURY_MAX_PER_TEAM players on the pitch, always has EXACTLY ONE active goalkeeper
// (Paco 24-sep, resolutions 6 and 7), never has more than SENT_OFF_MAX sent off, and
// the controlled player is never one who has left. Returns the offenders by name, like
// every other net in this file.
export function checkTeamCount(players: readonly PlayerState[], controlled: readonly [number, number]): string[] {
  const problems: string[] = [];
  for (const team of [0, 1] as const) {
    let active = 0;
    let keepers = 0;
    let off = 0;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.team !== team) continue;
      if (p.sentOff) off++;
      if (!isActive(p)) continue;
      active++;
      if (p.role === 'gk') keepers++;
    }
    if (keepers !== 1) problems.push(`team ${team}: ${keepers} active goalkeepers, expected exactly 1`);
    if (off > SENT_OFF_MAX) problems.push(`team ${team}: ${off} sent off, over SENT_OFF_MAX ${SENT_OFF_MAX}`);
    const floor = TEAM_SIZE - SENT_OFF_MAX - INJURY_MAX_PER_TEAM;
    if (active < floor) problems.push(`team ${team}: ${active} on the pitch, under the floor of ${floor}`);
    const c = controlled[team];
    if (c >= 0) {
      const p = players[c];
      if (p.team !== team || p.role === 'gk' || !isActive(p)) {
        problems.push(`team ${team}: controlled ${c} is not an active outfield player of this team`);
      }
    }
  }
  return problems;
}
```
Se llama desde `engine-invariants.test.ts` **en cada paso** de la partida grabada, con su propio `it` y su control negativo (marcar a mano tres jugadores del mismo equipo como `sentOff` y comprobar que la red los nombra).

- [ ] **Step 7: El control del expulsado**

G15-13: «si es el controlado, control al siguiente más cercano». Como `isControllable` ya lleva `isActive`, `updateTeamControl` lo resuelve **solo**: en el mismo paso de la roja, el expulsado deja de ser candidato y la histéresis elige al siguiente. **Eso no se da por hecho, se prueba**: un test en `discipline.test.ts` que expulsa al controlado y comprueba que `match.controlled[team]` cambia en ese mismo `stepMatch` y apunta a un jugador activo.

- [ ] **Step 8: Compuertas de la tarea.** Las de siempre, más `npx vitest run components/games/football-logic/engine-invariants.test.ts` (6 verdes, incluido el `it` de «exactamente un portero por equipo»). `Marcas`: se miden y se anotan. Dejar el working tree verificado.

## Task V15-4-7: la pantalla — rótulos, ventana LESIONADO, SFX del larguero y la alineación que llega al campo

**Files:**
- Modify: `components/games/football-screen/captions.ts` (`CaptionKind` gana `'card-yellow'`, `'card-red'`, `'injury'`)
- Modify: `components/games/football-screen/sfx-map.ts` (`crossbarDue`, la fila del larguero)
- Modify: `components/games/football-screen/hud.ts` (el `switch` exhaustivo que la Task 5 dejó puesto gana el texto de `'injury'`)
- Modify: `components/games/football-screen/control-hints.ts` (las teclas de la ventana LESIONADO)
- Modify: `components/games/VaultWorldCupGame.tsx`
- Modify: `lib/sfx-vault-world-cup.ts` (la fila `crossbar` → `public/vault-futbol-crossbar.mp3`, **ya está en `public/`**)

**Interfaces:**
- Consumes: `ball.frameHit` (Task 3), `match.pendingInjury` + `TeamInput.sub` (**Task 5**), `match.lastCard` (**Task 6**), `Lineup` de V15-3.
- Produces: `crossbarDue(match, w): boolean`; `INJURY_TITLE = 'LESIONADO'`; los textos de la ventana, construidos en `refreshInjuryView()`.
- **NO produce ningún cambio de firma.** `createPlayers` quedó fijada en la Task 2 y esta tarea sólo **pasa el array real** de titulares.

- [ ] **Step 1: El SFX del larguero (test primero)**

`vault-futbol-crossbar.mp3` **ya está en `public/`** (comprobado al escribir el plan: `ls public/ | grep crossbar`). Falta la fila en el mapa de sonidos y el flanco:
```ts
// sfx-map.ts
// G15-12: the frame rings once, on the EDGE of ball.frameHit -- which stepBall resets
// at the top of every step, so unlike scratch.call it is already an event and not a
// level. Reading it as a level would be the goal_net bug of 07-sep all over again.
export function crossbarDue(match: MatchState): boolean {
  return match.ball.frameHit !== 'none';
}
```
**Control negativo obligatorio**: hacer que `stepBall` NO resetee `ball.frameHit` al principio del paso y comprobar que el test `'the frame rings ONCE per hit, not on every step of the bounce'` se pone rojo con `expected 1 to be 47` o parecido.

- [ ] **Step 2: Los rótulos de tarjeta y de lesión**

Tres `CaptionKind` nuevos con su `CAPTION_TEXT` (`'TARJETA AMARILLA'`, `'TARJETA ROJA'`, `'LESIÓN'`) y su `CAPTION_STEPS` (los dos primeros, `SHORT_CAPTION_STEPS`; G15-13 dice «sin pausa extra», así que el rótulo **no** para el juego, solo se encola). El `switch` de `sfxForCaption` gana los tres (`'none'` los tres: el silbato de la falta ya suena).

- [ ] **Step 3: La ventana LESIONADO**

Es una **superposición sobre el partido**, no una `FlowPhase` nueva: el partido sigue en `'match'` y el motor en `'injury'`. El componente, cuando `match.pendingInjury[humanTeam] >= 0`:
1. Llama **una vez** a `refreshInjuryView()`, que compone los textos (`'LESIONADO: ' + lineupName(...)` y la lista de reservas con dorsal y nombre) y los guarda en un array creado al montar. **Nunca por frame** (criterio 20).
2. Dibuja el cuadro con la cruceta moviendo el cursor por las reservas y A confirmando.
3. Al confirmar, escribe `run.inputs[humanTeam].sub = reserveSquadIndex` **para un solo paso** (se vuelve a `-1` en el siguiente muestreo, como los `'pressed'`).

4. Y tiene **cuenta atrás visible**: la ventana se cierra sola pasados `INJURY_WINDOW_STEPS` (8 s) y entra el suplente de esa posición (resolución 9 de Paco). El componente pinta los segundos que quedan leyendo `match.injuryStepsLeft[humanTeam]`; **el motor no depende de que la pantalla haga nada**.

> **H10: `lineupReserves` NO EXISTE.** Lo que V15-3 dejó en `football-screen/lineup.ts` es **`Lineup.reserves`** (`lineup.ts:21`), **`lineupReserveCount(f)`** (`:36`) y **`refreshReserves(f, out)`** (`:46`). Las reservas que se ofrecen salen de esos tres, que son **el mismo modelo que ya dibuja la pantalla ALINEACIÓN**, sin duplicar la lista.

- [ ] **Step 4: La alineación elegida llega al campo**

`createMatch` pasa a `createPlayers`, por equipo, el **`teamId`** y el **array de `squadIndex` titulares** (`lineup.starters`), usando **la firma que la Task 2 fijó** (H9: aquí **no** se cambia la firma, sólo se rellena el cuarto argumento, que hasta ahora se omitía). `applySquadAttrs` deriva de ahí los multiplicadores y los tres niveles del portero. Para el rival y para la CPU, el reparto por defecto — que en el motor es **`defaultSquadIndexFor`**, no `defaultLineup`: **`defaultLineup` vive en `football-screen/lineup.ts:68` y el motor no puede importarla** (H17). La pantalla la usa para pintar; el motor usa la suya, y un test comprueba que coinciden (Task 2). **Este es el último trozo de V15-3 que quedaba pendiente**, y aquí se cierra.

- [ ] **Step 5: Compuertas de la tarea.** `Marcas`: se miden; la pantalla no toca el motor, así que **no debería haber ninguna nueva**. `git diff --name-only f1d7d2a -- components/games/football-logic/` no debe crecer en esta tarea salvo por `players.ts`/`match.ts` si el Step 4 lo exige, y en ese caso se anota. Dejar el working tree verificado.

---

## Task V15-4-8: el comentario de `positionTeam` y el resto de la deuda de comentarios

**Files:**
- Modify: `components/games/football-logic/ai.ts` (comentarios), `players.ts` (comentarios), `kits.ts` (comentario), `mode.ts` (comentario), `set-pieces.ts` (comentario), `camera.ts` y `minimap.ts` (comentarios)

**Interfaces:** ninguna. **Esta tarea no cambia una sola línea de código ejecutable.** Compuerta específica:
```bash
git diff f1d7d2a -- components/games | grep -E '^[-+]' | grep -vE '^\+\+\+|^---|^[-+]\s*(//|\*|/\*)' | wc -l
# lo que salga aquí tiene que ser EXACTAMENTE lo que las tareas 1-7 ya habían cambiado
```

- [ ] **Step 1: El diferido que este paso tenía que recoger**

`ai.ts:235`, dentro de `positionTeam`:
```ts
      // 4. pursuit: the CHASERS nearest run at the ball (rank 0 is the controlled and never gets here)
```
**Ya no es cierto desde G15-5 (V15-2).** Antes del cambio manual, el controlado era por definición el de rango 0 y por eso nunca entraba aquí. Desde que el humano puede pasar el control con C a cualquiera de los `MANUAL_SWITCH_POOL` más cercanos, el controlado puede tener rango 1 o 2 — y entonces **el jugador de rango 0 sí entra por esta rama**, que es justo lo que se quiere (alguien tiene que ir a por el balón). Sustituir por:
```ts
      // 4. pursuit: the CHASERS nearest run at the ball. Before G15-5 (v1.5, V15-2) the
      // controlled player was by definition rank 0 and so never reached this branch;
      // since the human can hand control to any of the MANUAL_SWITCH_POOL nearest, the
      // controlled one may be rank 1 or 2 and the rank-0 player DOES get here -- which
      // is what keeps somebody running at the ball while the human covers.
```

- [ ] **Step 2: La deuda que V15-3 dejó escrita en su ledger**

| Fichero | Comentario que miente | Corrección |
|---|---|---|
| `players.ts:83` | `// 18 players created once: ids 0..8 are team 0 (0 = goalkeeper), 9..17 team 1.` | `// 22 players created once: ids 0..10 are team 0 (0 = goalkeeper), 11..21 team 1.` |
| `players.ts:120-134` | el bloque de la rejilla 4 × 4 y del salto `k === 7` | reescrito por la Task 1; **verificar aquí que no queda rastro de «fifteen» ni de «5 x 3»** |
| `mode.ts` | `drawRival`: «Uniform over the other fifteen» | «over the other nineteen» |
| `kits.ts:44-45` | «the real 16-team bank … all 240 ordered pairs» | «20-team … 380» |
| `set-pieces.ts:263-264` | «its eight outfield players» | «its ten outfield players» |
| `camera.ts:5`, `minimap.ts:4`, `formation-preview.ts:12` | «2000 x 1300» | «2200 x 1430» |
| `actions.ts` / `match.ts` / `sfx-map.ts` | los «18 slots» / «all 18» del barrido de eventos | «22 slots» |

- [ ] **Step 3: Compuertas** — `npx vitest run` (mismo número de tests y de saltados que al cerrar la Task 7), `npx tsc --noEmit`, y el `grep` de arriba. Dejar el working tree verificado.

---

## Task V15-4-9: EL REGRABADO ÚNICO

**Files:**
- Modify: `components/games/football-logic/ai.test.ts`
- Modify: `components/games/football-logic/match.test.ts`

**Interfaces:** ninguna. **Esta tarea no toca una sola línea de código de producción.** Compuerta específica, la primera de todas:
```bash
git diff --name-only f1d7d2a -- components/games | grep -v '\.test\.ts$'
# tiene que devolver lo mismo que al cerrar la Task 8: esta tarea NO añade ningún fichero de produccion
```

> **Esta es la tarea que justifica el orden de las ocho anteriores.** Hasta aquí, ni un solo número medido se ha vuelto a medir. Aquí se miden **todos**, una vez, contra el motor definitivo.

- [ ] **Step 1: Inventariar las marcas**

```bash
grep -rn "PENDING_REBASELINE" components/games
```
Debe salir la lista exacta que `progress.md` viene acumulando desde la Task 1b (techo del paso: **5** marcas). Si sale alguna que no está en `progress.md`, se para: alguien saltó un test sin anotarlo. **Y si alguna marca no toca un aserto de la LISTA BLANCA de Global Constraints, también se para**: esa marca no debió ponerse nunca y lo que hay debajo es clase 3 sin hacer o una regresión.

- [ ] **Step 2: Quitar UN `it.skip`, ver el rojo y leer el número real**

> **LA REGLA DE PARADA, ANTES DE TOCAR NADA (H3).** El Step original era mecánico —«lee el valor del mensaje y escríbelo»— y con eso el ejecutor habría escrito `expect(g.stats.keeperLeftLineWithoutPressReason).toBe(153)`, **convirtiendo un invariante estructural que debe valer 0 en un número grabado**. El aviso que llevaba («si un número resulta ser inestable entre corridas, se para») no cubría ese caso: 153 era perfectamente estable. Por eso, aquí:
> 1. **Sólo se regraban los asertos de la LISTA BLANCA**, y son estos, con su valor viejo al lado: `keeperLeftLineOutsideSmallArea` **69**, `EXPECTED_OUTSIDE_SMALL_AREA` **{ '1-1': 19, '1-0': 36 }**, la aserción del gol de oro, y los dos párrafos en prosa. **Nada más.**
> 2. **Un aserto que hoy vale `0` o `[]` es ESTRUCTURAL y NO SE REGRABA JAMÁS.** Si sale distinto de 0, se para y se investiga. Ninguno de la lista blanca vale 0 hoy, así que la regla no tiene excepciones.
> 3. Si al quitar un `.skip` el `it` sale rojo **por otra cosa** además del número de la lista blanca, se arregla esa otra cosa como **clase 3** antes de regrabar.

Para cada marca, de una en una y en el orden en que se pusieron:
1. Quitar el `.skip` y el comentario `PENDING_REBASELINE`.
2. `npx vitest run <fichero> -t "<nombre del it>"`.
3. Leer el valor real del mensaje de error (`expected 41 to be 69`), **y comprobar que el aserto que ha fallado está en la lista blanca**.
4. **Escribir el valor nuevo Y, al lado, el comentario que dice cuándo se midió y contra qué**, con el formato que ese fichero ya usa:
   ```ts
   // Re-measured ONCE in V15-4 (2026-09-24, eleven a side + 2200 x 1430 pitch +
   // attributes + goal frame + directional tackles + cards + injuries). Old value 69,
   // measured for the 9v9 engine of the stage B. Change the engine and this moves;
   // measure the new value and report it, never edit it away.
   expect(game.stats.keeperLeftLineOutsideSmallArea).toBe(<el nuevo>);
   ```
5. Volver a correr ese `it` solo: **PASS**.

> **Lo que NO se permite en este paso:** cambiar una aserción exacta por una banda (`toBeGreaterThan`) para no tener que medir. Eso sería convertir una grabación en un test vacuo, que es exactamente lo que este fichero lleva tres etapas evitando. Si un número resulta ser **inestable entre corridas**, eso es un hallazgo de determinismo y se para el paso.

- [ ] **Step 3: Volver a medir los COMENTARIOS medidos**

`match.test.ts`, `describe('full match with recorded inputs (criterion 1)')`, lleva una medición en prosa que hoy dice:
```
// reported, never tuned (stage B, with all 16 outfield players alive): 11 325 steps,
// 0-2, decided at the end of the second half, visiting six phases and five set-piece
// kinds (kickoff, free-kick, goal-kick, throw-in, penalty), with run C first diverging
// at step 1171.
```
Se vuelve a medir **todo** (pasos, marcador, fases visitadas, tipos de saque, paso de divergencia) instrumentando el test con `console.log` **temporalmente**, se escribe el párrafo nuevo con la fecha de hoy y se **quita** la instrumentación. Lo mismo con el bloque de `ai.test.ts` que enumera «2-1, 6 shots, 79 short and 35 long passes, 313 slide steps…». El párrafo viejo se **conserva** entre paréntesis como «old value», igual que hizo G12-3.

- [ ] **Step 4: La aserción del gol de oro**

`match.test.ts` afirma hoy que la grabación **no** llega a `'golden-goal'`, con un párrafo largo explicando por qué. **El pre-vuelo ya lo midió, con la Task 1b sola aplicada: AHORA SÍ LLEGA** (`AssertionError: this recording reached the golden goal: the score was level at full time with a policy in which…`). Así que la salida es la segunda de las dos:
- **Ahora llega**: la aserción se **invierte** (`toContain('golden-goal')`), y el párrafo se reescribe explicando que el motor de once, sobre un campo un 10 % mayor y con áreas ×1,1, **sí** empata con esa política. **Lo que no se hace es borrar la aserción**: el comentario existente pide expresamente que «el día que esta grabación SÍ llegue al gol de oro, alguien vuelva y relea esto». Ese día es hoy, y la respuesta se escribe.
- (Si, contra lo medido, tras las tareas 2-8 volviera a no llegar, se deja tal cual y se anota la medición nueva en el párrafo. Lo que **no** se hace es cambiar la aserción por una banda.)

- [ ] **Step 5: Compuertas de la tarea — las que cierran el regrabado**

```bash
grep -rn "PENDING_REBASELINE" components/games        # VACÍO
grep -rn "it\.skip\|describe\.skip" components/games  # VACÍO
npx vitest run                                        # todo verde, 0 skipped
npx tsc --noEmit
git diff --name-only f1d7d2a -- components/games | grep -v '\.test\.ts$'   # igual que en la Task 8
```
Y anotar en `progress.md` **la tabla de valores viejos → nuevos**, que es lo que Paco va a leer para saber cuánto se ha movido el juego.

- [ ] **Step 6: Dejar el working tree verificado — commit lo hace Paco**

---

## Task V15-4-10: las dos sondas de 40 partidos

**Files:**
- Create: `components/games/football-logic/probes.test.ts`

**Interfaces:** ninguna hacia el código; la sonda **mide** y asevera **bandas**, no números exactos — es lo que la distingue de una grabación.

> **Por qué va después del regrabado y no antes.** Una sonda que midiera el motor de la Task 4 estaría midiendo un juego que todavía no existe. Y por qué **asevera bandas**: G15-12 pide «ni rarísimo ni constante» y G15-24 pide «objetivo ≈ 50 % de entradas limpias». Eso son rangos, y un rango que se rompe es una señal para el QA, no un fallo del código.

- [ ] **Step 1: La sonda del marco (G15-12)**

```ts
// components/games/football-logic/probes.test.ts
import { describe, expect, it } from 'vitest';
// ... (mismos helpers de partida CPU-vs-CPU que engine-invariants.test.ts, importados de allí)

// G15-12: "Sonda 40 partidos contando postes/larguerous (ni rarisimo ni constante)".
// 40 full CPU-vs-CPU matches, seeds 200..239, counting every step whose ball.frameHit
// is not 'none'. This is a BAND, not a recording: it says the frame is part of the game
// without pinning a number that every future tweak would have to chase.
describe('probe: the goal frame is felt but is not the main event (G15-12)', () => {
  const MATCHES = 40;
  let posts = 0;
  let crossbars = 0;
  let matchesWithAHit = 0;
  for (let seed = 200; seed < 200 + MATCHES; seed++) {
    const g = playCpuCountingFrame(seed);
    posts += g.posts;
    crossbars += g.crossbars;
    if (g.posts + g.crossbars > 0) matchesWithAHit++;
  }
  it('hits the frame in a meaningful share of the forty matches, and not in all of them', () => {
    // MEASURED on <fecha> and REPORTED here: posts=<p>, crossbars=<c>, matches with at
    // least one hit = <m> of 40. The band is what is asserted.
    expect(matchesWithAHit).toBeGreaterThanOrEqual(4);    // "ni rarisimo"
    expect(matchesWithAHit).toBeLessThanOrEqual(36);      // "ni constante"
  });
  it('the crossbar happens at all (the band above it is reachable), and less often than the posts', () => {
    expect(crossbars).toBeGreaterThan(0);
    expect(crossbars).toBeLessThan(posts);
  });
});
```

- [ ] **Step 2: La sonda de las entradas (G15-24)**

Cuarenta partidos, semillas 300..339, contando por paso: **entradas iniciadas**, **entradas que ganan el balón** (`ev.kind === 'tackle' && ev.ok`), **faltas** (`ev.foul`) y **robos** (`ev.kind === 'steal' && ev.ok`).

> **H8: el divisor del borrador estaba mal y la sonda salía roja en la primera ejecución.** La prosa decía bien «entradas iniciadas», pero el código dividía entre `tackles` contado como **eventos por paso**: `stepTackle` (`actions.ts:145`) escribe `setEvent(out, 'tackle', false, p.id)` **en cada paso** del deslizamiento, hasta `TACKLE_STEPS` (= `stepsFor(0.4)` = 24 pasos), y el propio `ai.test.ts:905-911` lo documenta. Medido sobre los doce partidos del pre-vuelo con G15-24: `tackles` por evento = **5026** → `clean = 130 / 5026 = 0,026`, muy por debajo de 0,35; `slidesStarted` por transición = **309** → `clean = 130 / 309 = 0,421`, dentro de la banda. La resolución 8 de Paco manda corregirlo así.

```ts
  // The counter the prose always described: a slide STARTED is the step in which
  // tackleStepsLeft goes from 0 to > 0, NOT every step of the slide. `wasSliding` is
  // created ONCE per match, outside the step loop.
  const wasSliding = new Array<boolean>(match.players.length).fill(false);
  // ... inside the step loop, after stepMatch:
  for (let i = 0; i < match.players.length; i++) {
    const now = match.players[i].tackleStepsLeft > 0;
    if (now && !wasSliding[i]) slidesStarted++;
    wasSliding[i] = now;
  }
```
```ts
  it('about half of the slides are clean (G15-24: "objetivo ~ 50 % de entradas limpias")', () => {
    const clean = tacklesWon / slidesStarted;
    // MEASURED on <fecha>: slidesStarted=<t>, won=<w>, fouls=<f>, steals=<s>, clean=<x> %.
    // Reference from the pre-flight, on the NINE-a-side engine over 12 matches:
    // 309 slides started, 130 won (42.1 %), 72 fouls.
    expect(clean).toBeGreaterThanOrEqual(0.35);
    expect(clean).toBeLessThanOrEqual(0.65);
  });
  it('NEGATIVE CONTROL: the two counters are NOT the same number -- per-step events are not slides', () => {
    // The bug this replaced: tackleEvents / slidesStarted is about 16 (TACKLE_STEPS is
    // 24 and most slides are cut short). If these two were ever equal, the transition
    // counter would have silently become the per-step counter again.
    expect(tackleEvents).toBeGreaterThan(slidesStarted * 4);
  });
  it('NEGATIVE CONTROL: the probe is counting something -- there ARE slides and there ARE fouls', () => {
    expect(slidesStarted).toBeGreaterThan(MATCHES);   // more than one slide per match
    expect(fouls).toBeGreaterThan(0);
  });
```

- [ ] **Step 3: Medir, escribir el número medido en el comentario, y comprobar el coste**

Run: `npx vitest run components/games/football-logic/probes.test.ts`
Ochenta partidos completos son la parte cara de la suite. **Medir el tiempo** y anotarlo. Si pasa de **20 s**, reducir la duración de cada partido de la sonda (una parte en vez de dos) antes que reducir las semillas: lo que la sonda necesita es **variedad de semillas**, no minutos de juego. La baseline de la suite entera es de 2,85 s: si la suite se va por encima de **30 s**, se anota como deuda para Paco.

- [ ] **Step 4: Si una sonda sale fuera de banda**

**No se ajusta la banda.** Se anota el número en `qa-paco.md` con la propuesta concreta de ajuste (`FRAME_BOUNCE`, `POST_RADIUS`, `FOUL_FRONT_COS`, `TACKLE_BALL_REACH`) y **se le pregunta a Paco**, porque los dos son ajustes de jugabilidad que el spec manda afinar en QA («ajuste fino en QA» en G15-24, «ni rarísimo ni constante» en G15-12). Si Paco decide ajustar, **hay que volver a la Task 9 y regrabar otra vez**: eso también se le dice, para que lo decida con el precio delante. (Lo que **no** se toca es `ai.ts:612`: la resolución 8 lo dejó cerrado.)

- [ ] **Step 5: Compuertas de la tarea** — las seis de siempre, con `PENDING_REBASELINE` **vacío**. Dejar el working tree verificado.

---

## Task V15-4-11 (cierre): verificación del paso, lista de QA de Paco y mensaje de commit

**Files:**
- Modify: `specs/31-vault-world-cup.md` (la anotación de qué implementa V15-4)
- Create: `.superpowers/sdd/2026-09-24-vault-world-cup-v15-4/qa-paco.md`
- Modify: `.superpowers/sdd/2026-09-24-vault-world-cup-v15-4/progress.md`

**Interfaces:** ninguna.

- [ ] **Step 1: La verificación del paso entero**

```bash
npx vitest run                    # verde, 0 skipped; objetivo ~1461 tests en 88 ficheros (partida: 1385 / 83)
npx tsc --noEmit
npx eslint components lib app     # solo los 3 errores de react-hooks de partida, ninguno nuevo
npx vitest run components/games/football-logic/engine-invariants.test.ts        # 6 passed, sin haberse tocado desde la Task 1a
grep -rn "PENDING_REBASELINE\|it\.skip\|describe\.skip" components/games       # VACÍO
grep -rn "Math.random" components/games/football-logic components/games/football-screen   # VACÍO
grep -rnE "\bas [A-Z]" components/games/football-logic components/games/football-screen   # solo los `as` de antes de f1d7d2a
find .superpowers -name "*.ts" -o -name "*.tsx"                                # VACÍO
git status --short                # solo lo que este paso ha tocado
git diff --stat f1d7d2a
```

- [ ] **Step 2: La anotación del spec**

Bajo el bullet de G15-22, en el mismo sitio donde V15-3 dejó la suya:
```
*V15-4 implementado (2026-09-24): once por equipo con 4-4-2 / 4-3-3 / 5-3-2 y campo 2200 × 1430 con las áreas,
el punto de penalti y el círculo central ×1,1 y la portería sin escalar (G15-16, resolución de Paco 24-sep);
cinco atributos 1-5 por selección y velocidad/chut por jugador derivados del rol (G15-10); tres niveles por
portero, distintos entre el 1 y el 2 (G15-26); postes y larguero con rebote, pérdida y SFX (G15-12); lesión
tras falta al 8 %, una por equipo, con cambio por `TeamInput.sub`, reloj parado y salida por tiempo (G15-18);
tarjetas deterministas con expulsión real y tope de dos, con el portero expulsado sustituido por el segundo
portero y el equipo perdiendo un jugador de campo (G15-13); `TACKLE_BALL_REACH` 28 y falta solo por detrás o
de lado (G15-24); pausa de gol de 4 s (G15-4). UN solo regrabado, al final, con los valores viejos conservados
al lado de los nuevos. Quedan para V15-5 el abrazo, la red que ondula, los nombres y dorsales en los eventos
(G15-11), la pantalla previa (G15-19) y la celebración de victoria (G15-21); y para v1.6 la resistencia y el
banquillo táctico.*
```
**Y el criterio 4**, que la Task 1b ya dejó anotado, se revisa aquí para que no haya quedado a medias.

- [ ] **Step 3: `qa-paco.md` — la lista de QA jugado**

```markdown
# QA jugado — V15-4 «Motor» (v1.5)

Todo esto se juega en `localhost:3000/games/vault-world-cup`. Claude NO lo ha jugado:
lo ha dejado verde en tests. Lo que no cuadre, se anota aquí mismo.

## 1 · Once contra once (G15-16)
- [ ] Amistoso: cuenta los jugadores de cada equipo en el minimapa. **Once y once.**
- [ ] Las teclas 1 / 2 / 3 siguen dando NORMAL (4-4-2), OFENSIVA (4-3-3) y DEFENSIVA (5-3-2), y el
      minicampo del selector enseña **once puntos** con la forma correcta.
- [ ] El campo se nota más grande. ¿Demasiado? ¿Poco? **Si hay que ajustarlo, dilo AHORA**: cambiarlo
      después obliga a regrabar otra vez.
- [ ] **Las áreas y el círculo central han crecido con el campo, la portería NO** (tu resolución 5).
      ¿Se nota el área grande demasiado profunda? ¿La portería se ve pequeña para el campo nuevo?
- [ ] **DECISIÓN DERIVADA QUE TIENES QUE CONFIRMAR:** el **punto de penalti** también ha escalado
      (210 → 231), porque es geometría del área grande. ¿De acuerdo, o lo dejamos en 210? Los penaltis
      se tiran desde algo más lejos que antes.
- [ ] La cámara no se queda corta en las bandas ni en las porterías.
- [ ] Entrenamiento: es de once, con sus reglas de siempre (tu resolución 1). Confírmalo jugando.

## 2 · Alineación (cierre de V15-3)
- [ ] Una alineación guardada **antes** de este paso: al entrar, los nombres que editaste **siguen ahí**
      y el once es el de por defecto (es lo esperado: la formación cambió).
- [ ] Cambias un titular por una reserva en ALINEACIÓN → **ese jugador es el que sale al campo**.

## 3 · Atributos (G15-10, G15-26)
- [ ] Juega BRASIL (5 de chut) y luego JAPÓN (2 de chut) contra el mismo rival. ¿Se nota?
      Paco dijo «pequeños cambios»: si se nota **demasiado**, dilo.
- [ ] La **barra de carga del chut** pinta la fracción de carga, no la velocidad: con BRASIL la barra
      llena son ~997 u/s y con JAPÓN ~902, y la barra se ve igual. ¿Molesta, o da igual?
- [ ] Juega contra un portero y fíjate en las salidas. ¿Sale más o menos según la selección?
- [ ] Lesiona al portero titular (o espera a que pase) y mira si el suplente se nota.

## 4 · Postes y larguero (G15-12)
- [ ] Chuta al palo a propósito. **Rebota al campo**, pierde velocidad y **suena** el `crossbar`.
- [ ] Chuta por encima del larguero: **fuera**, saque de puerta, **sin** sonido de marco.
- [ ] Chuta a la altura del larguero: **rebota al campo** con el mismo sonido.
- [ ] Un gol entre palos **sigue siendo gol**. (Si el marco «se come» un gol, es un fallo grave.)
- [ ] ¿Pasa demasiado a menudo? ¿Demasiado poco? La sonda dice <rellenar> de 40 partidos.

## 5 · Entradas y faltas (G15-24)
- [ ] Entra de frente sin tocar el balón: **choque, sin falta**, y te caes igual.
- [ ] Entra por detrás: **falta**.
- [ ] Entra limpio al balón: **te lo llevas**. La sonda dice <rellenar> % de limpias.
- [ ] **La CPU pita menos faltas que antes** (medido en el pre-vuelo: −24 %, de 95 a 72 en doce partidos),
      porque `ai.ts:612` sigue haciendo que solo entre de frente y de frente ya no es falta (tu resolución 8).
      Con ~6 faltas por partido y una lesión cada ~12 faltas, sale **una lesión cada dos partidos largos**.
      **¿Te parece bien esa frecuencia, o subimos `INJURY_CHANCE`?** Si se cambia, hay que regrabar otra vez.

## 6 · Lesiones (G15-18) — Task 5
- [ ] Recibe una entrada. De vez en cuando (≈1 de cada 12 faltas) → **ventana LESIONADO: <nombre>**.
- [ ] Eliges una reserva con la cruceta y A → **entra y el juego sigue** donde estaba, con el saque de
      falta en el mismo punto de la cuenta atrás en el que estaba.
- [ ] **El reloj del partido se para** mientras la ventana está abierta (tu resolución 9). Míralo en el HUD.
- [ ] **No elijas nada**: a los ~8 s entra solo el suplente de esa posición y el juego sigue. Nunca se cuelga.
- [ ] La CPU se cambia sola, sin ventana y sin parón.
- [ ] Solo **una** lesión por equipo y partido — **también después de haber hecho el cambio**.
- [ ] Sin reservas de campo: **juega con uno menos** y el partido no se queda colgado.
- [ ] **Lesiona al portero**: entra el **segundo portero** (tu resolución 7). Si el segundo ya estaba en
      el campo, **la lesión se señala y el portero sigue jugando** — nunca te quedas sin portero.

## 7 · Tarjetas (G15-13) — Task 6
- [ ] Haz dos faltas con el mismo jugador: **amarilla**, rótulo, **sin pausa**.
- [ ] Cuatro con el mismo: **roja** y **se va de verdad** — cuéntalos en el minimapa: diez.
- [ ] Si el expulsado era el que controlabas, **el control pasa solo** al más cercano.
- [ ] Expulsa a tres del mismo equipo: el tercero **ve la roja pero se queda**.
- [ ] **Roja al portero** (tu resolución 6): entra el **segundo portero** y el que se va es **un jugador
      de campo** — cuéntalos: diez en el campo, uno de ellos portero. **Nunca te quedas sin portero.**
- [ ] **Roja al portero sin segundo portero disponible**: la roja **se muestra y no expulsa a nadie**.
- [ ] Llega a la tanda con un expulsado: la tanda **no se entera** (tiran los once).

## 8 · Pausa de gol (G15-4)
- [ ] Mete un gol: la pausa dura **cuatro segundos**. ¿Se hace larga sin la celebración del abrazo
      (que es V15-5)? Si se hace larga, dilo: puede volver a 3 s hasta V15-5.

## 9 · Lo de siempre
- [ ] Un Mundial entero de dieciséis, sin que nada se quede colgado.
- [ ] Mando físico y los dos esquemas de teclado, intactos.
- [ ] Sin tirones. Si los hay, mira la consola por si algo asigna por frame.
```

- [ ] **Step 4: El mensaje de commit propuesto (UNO, para todo el paso)**

```
feat(world-cup): v1.5 engine — eleven a side on a bigger pitch, per-selection and per-player attributes, goal frame, cards with real sendings off and injury substitutions (V15-4, G15-4/G15-10/G15-12/G15-13/G15-16/G15-18/G15-24/G15-26)
```
**Claude no commitea.** Se deja el working tree verificado y el mensaje escrito aquí y en `progress.md`.

- [ ] **Step 5: Cerrar `progress.md`**

Una línea por tarea, la tabla de valores viejos → nuevos del regrabado, los números medidos por las dos sondas, el tiempo de la suite y la sección `## Peticiones separadas al motor` con lo que este paso **no** ha hecho (las cuatro dudas de diseño, si alguna sigue abierta, y cualquier hallazgo).

---

## Self-review (ejecutada al escribir el plan, 24-sep; ACTUALIZADA tras el pre-vuelo)

**0 · Lo que el pre-vuelo corrigió, y que esta self-review no había visto.** Diecisiete hallazgos aplicados: el censo real de la Task 1 (**89 rojos en 13 ficheros**, no once ficheros con 2 marcas), la mecánica del regrabado (clase 3 + lista blanca + regla de parada sobre los asertos que valen 0), las resoluciones 5-10 de Paco propagadas a todas las tareas (áreas que escalan, portero expulsado y lesionado por la vía del cambio, reloj parado con salida por tiempo, tres días con el corte tras la Task 2), la exhaustividad real de la fase `'injury'` en pantalla, el tope de lesiones movido al `MatchState`, la firma única de `createPlayers`, los siete símbolos sin cuerpo, y el objetivo de tests recalculado a **≈1461 / 88**. El detalle, en `.superpowers/sdd/2026-09-24-vault-world-cup-v15-4/preflight.md`, sección «Aplicado 24-sep».

**1 · Cobertura del spec.** Las ocho decisiones que el encargo nombra tienen tarea: G15-16 → T1a+T1b; G15-10 y G15-26 → T2; G15-12 → T3; G15-24 y G15-4 → T4; G15-18 → **T5**; G15-13 → **T6**; el diferido del comentario de `positionTeam` → T8. Los cinco puntos que el encargo pedía resolver explícitamente están en: **(1)** el bloque «EL REGRABADO ÚNICO» de Global Constraints + Task 9; **(2)** la tabla «Lo que este paso da por cerrado de V15-3» + Task 1b Steps 1.d y 4; **(3)** la lista de invariantes de Task 6 Step 6 y la red nueva `checkTeamCount`, ahora **con cuerpo**; **(4)** la tabla de orden con la columna «Día» y los dos cortes (tras la 1b y tras la 4); **(5)** Task 10. **Hueco conocido:** G15-10 menciona «0 sin ganador» como parte de su sonda; eso ya lo cubre el test `'the shootout always ends with a winner (criterion 23)'` que existe desde la etapa B2 y que la Task 1b deja intacto — se anota en `qa-paco.md` en vez de duplicarlo.

**2 · Placeholders.** Repasado. Quedan **tres** sitios donde el plan dice deliberadamente «medir y escribir» en vez de dar el número: los valores del regrabado (Task 9, que es su razón de ser), los números medidos de las dos sondas (Task 10 Step 3) y la tabla de veinte `KEEPER_ATTRS` (Task 2 Step 4), que se da con el criterio y un ejemplo y se completa al implementar. Son datos que **no se pueden saber sin ejecutar**, no vaguedades — y cada uno lleva escrito el criterio con el que se rellena.

**3 · Consistencia de tipos.** `isActive` se define en `discipline.ts` en la **Task 5** como `!p.injured` y la **Task 6** la extiende a `!p.sentOff && !p.injured`; la usan `ai.ts`, `actions.ts`, `ball.ts`, `set-pieces.ts` e `invariants.ts`. `PlayerState.injured` se declara en `players.ts` en la **Task 5**, inicializado a `false`; `fouls`/`card`/`sentOff`, en la **Task 6**. `PlayerState` gana además, en la Task 2, `squadIndex`, `speedMult`, `shotMult` **y los tres escalares de portero `keeperReflexes`/`keeperRushing`/`keeperKicking`** (H12: faltaban aquí). `TeamAttrs` (T2) entra en `TeamDef`, que `invariants.ts` ya recorre en `checkTeam` — `checkTeam` **no** cambia: la red de atributos vive aparte, en `checkAttributes`. `FrameHit` se declara en `goal-frame.ts` y `ball.ts` lo importa, no al revés (ciclo ESM evitado). `substitute` recibe un **índice de plantilla**, y `TeamInput.sub` lleva un **índice de plantilla** — el mismo espacio de números en los dos sitios, comprobado. **`createPlayers` tiene UNA firma, fijada en la Task 2** (H9). **`registerFoul` recibe `(match, offenderId)`**, no `(players, offenderId, team)`, porque necesita el `match` para `sendOffKeeper`.

**3 bis · Aristas de import declaradas (H12, H17).** `football-logic/players.ts → football-logic/squads.ts` se **abre en la Task 2**, a propósito y con su porqué: rompe la propiedad que V15-3 dejó escrita y que la Task 1b usa como prueba de cierre, así que el `grep` de las tareas 2-11 la espera. `football-logic/` **no importa** `football-screen/` en ningún momento: `defaultLineup` (`football-screen/lineup.ts:68`) se queda en la pantalla y el motor usa `defaultSquadIndexFor`. `discipline.ts → match.ts` es de tipos (`MatchState`) en una dirección y `match.ts → discipline.ts` de funciones en la otra, la misma arista que `ai.ts ← match.ts` ya usa. `invariants.ts → discipline.ts` (para `isActive`, `SENT_OFF_MAX`, `INJURY_MAX_PER_TEAM`) se abre en la Task 6. `keeperOf` **pasa de privada a exportada** en `match.ts` en la Task 2.

**4 · Riesgo que el plan no elimina.** Si un corte de día se alarga y el día 3 no llega hasta la Task 9, el paso queda **un día más** con las marcas vivas. Eso es aceptable mientras `engine-invariants.test.ts` siga verde — es literalmente para lo que se escribe en la Task 1a — pero **no** es aceptable cerrar el paso así, y por eso la compuerta del `grep PENDING_REBASELINE` vacío está tanto en la Task 9 como en la Task 11.

**5 · Riesgo nuevo, que el pre-vuelo destapó y que el plan acota pero no elimina.** La Task 1b sigue siendo un golpe de **89 tests en 13 ficheros** en una sola tarea, porque `TEAM_SIZE` es atómico. Lo que el plan hace es (a) sacar la red fuera, a la 1a; (b) escribir la lista de los trece ficheros con su arreglo, medida y no adivinada; (c) partir el trabajo de los dos ficheros congelados en dos pasadas de clase 3 con un número medido entre ellas (39 → 25 → 4); y (d) darle el día 1 entero. Si aun así no cabe, **el corte natural está entre el Step 4 y el Step 5**: los once ficheros no congelados verdes y los dos congelados todavía rojos **no** es un estado verde, así que ese corte **no** cumple la regla de compuertas — habría que dejarlo con los dos congelados enteros en `it.skip` temporal y desmarcarlos al día siguiente, y eso hay que **pedírselo a Paco**, no decidirlo.

## Resoluciones de Paco (24-sep, antes del pre-vuelo)

> **Las resoluciones 2 y 4 están DEROGADAS en parte por las 5, 6 y 7 de abajo.** Se conservan para que se vea el recorrido; lo que manda es el segundo bloque.

1. **Entrenamiento = opción (a):** solo se conservan sus REGLAS (humanos contra el portero para aprender pase y chut); adopta el tamaño de
   equipo vigente. NO se implementa tamaño por partido, y el paso sigue siendo de dos días. *(Esta última frase queda
   derogada por la resolución 10: el paso es de TRES días.)*
2. **Portero expulsado:** un jugador de campo se pone los guantes (sin cambio), como en el fútbol real. Se mantiene el invariante de que
   siempre hay exactamente un portero por equipo (criterio 9b, `keeperOf`).
3. **Portero lesionado:** entra el **segundo portero** de la plantilla si está disponible; si ya se gastó el cambio o no queda portero,
   un jugador de campo se pone los guantes (mismo camino que el punto 2).
4. **Campo: +10 % de lado y nada más** (2200 × 1430). Razón medida: 2000×1300 / 18 jugadores = 144 444 u² por jugador; con 22 jugadores,
   2200×1430 / 22 = 143 000 u², es decir, la MISMA densidad que hoy. Un +15 % daría más espacio del actual y volvería el juego más lento.
   Si al jugar se ve apretado, se sube DENTRO de V15-4 y ANTES del regrabado único (tarea 9). Las áreas crecen con el campo, en proporción.
→ En la tarea de cierre se registran como «resueltas por Paco 24-sep», no como dudas abiertas.

## Resoluciones de Paco (24-sep, tras el pre-vuelo) — SUSTITUYEN a lo anterior donde choquen

5. **Qué escala con el campo (+10 %, 2200 × 1430):** escalan el campo, **las áreas** (grande y pequeña) y el círculo central. **La portería
   NO**: su ancho se queda como hoy, porque es lo que fija cuántos goles caen y está equilibrado con `catchChance`/`SHOT_POST_MARGIN`.
   Esto corrige H4(4) y las tres frases del plan que decían que las áreas no escalan.
6. **Portero expulsado (sustituye a la resolución 2 del 24-sep):** entra el **segundo portero** por el mecanismo de cambio de la tarea de
   lesiones y el equipo pierde un jugador de campo. Si ya no queda portero disponible, la roja se **muestra como rótulo y NO expulsa**.
   No se toca `keeperOf` ni sus llamadores: el equipo siempre tiene exactamente un portero.
7. **Portero lesionado:** igual — segundo portero si queda; si no, la lesión se señala pero el portero sigue (no se juega sin portero).
   Esto corrige H4(3): `substitute` DEBE permitir el cambio de portero por el segundo portero.
8. **CPU y entradas (H7):** `ai.ts:612` NO se toca (la CPU sigue entrando solo de frente). Se aceptan los números medidos por el pre-vuelo
   (faltas −24 %, entradas limpias 23,6 % → 42,1 %) y se revisan en el QA jugado. La banda de la sonda de entradas se corrige según H8
   (transiciones de `tackleStepsLeft`, no eventos por paso).
9. **Ventana LESIONADO:** el reloj se **para** (fase de pausa, como el gol) y, si el humano no elige en unos segundos, entra
   automáticamente el suplente de esa posición. Hay salida por tiempo, nunca se queda colgada.
10. **Calendario: TRES días**, con el corte tras la Task 2 (el pre-vuelo midió que la Task 1 sola son ~45 tests a reanclar en 11 ficheros).

### Dónde vive cada resolución, ya propagada (24-sep)

| Resolución | Dónde está aplicada en este plan |
|---|---|
| **5** — escalan campo, áreas, punto de penalti y círculo central; la portería no | Mapa de ficheros (`pitch.ts`) · Dudas de diseño 4 · Task 1b Step 3 (el `PITCH` completo, con los diez valores) y su comentario · Task 1b Step 4 (los siete fixtures de `checkPitch` reanclados) · Task 3 Interfaces (el marco no cambia) · `qa-paco.md` §1 |
| **6** — portero expulsado → segundo portero por el cambio; sin portero, rótulo sin expulsión; `keeperOf` intacto | Dudas de diseño 2 · tabla de orden (por qué las tareas 5 y 6 se intercambian) · Task 6 Interfaces, Step 1 (los dos `it`), Step 3 (`sendOffKeeper` y `registerFoul`), Step 4 (control negativo 2), Step 6 (`checkTeamCount`) · Task 1a Step 1 (`it` de «exactamente un portero por equipo») · `qa-paco.md` §7 |
| **7** — portero lesionado → segundo portero; si no queda, se señala y sigue jugando; `substitute` PERMITE gk→gk | Dudas de diseño 3 · Task 5 Step 1 (test 8), Step 4 (`hasSubstituteFor`), Step 5 (la rama del portero sin recambio y la guarda nueva de `substitute`) · `qa-paco.md` §6 |
| **8** — `ai.ts:612` no se toca; números de H7 aceptados; sonda corregida según H8 | Mapa de ficheros (`ai.ts`) · Task 4 Contexto (la cita literal y la tabla medida), Step 5 (la sonda de faltas), Step 6 (`ai.test.ts:710`) · Task 10 Step 2 (`slidesStarted` y su control negativo), Step 4 · `qa-paco.md` §5 |
| **9** — ventana LESIONADO: reloj parado y salida automática por tiempo | Mapa de ficheros (`match.ts`) · Task 5 Interfaces (`INJURY_WINDOW_STEPS`, `injuryStepsLeft`), Step 1 (tests 4, 5 y 6), Step 5 (el `case 'injury'`) · Task 7 Step 3 (punto 4) · `qa-paco.md` §6 |
| **10** — tres días, corte tras la Task 2 | Architecture · tabla de orden (columna «Día») · «Cortes de día» · fin del día 1 (Task 1b Step 9) y fin del día 2 (Task 4 Step 7) |
11. **Punto de penalti (Paco, 24-sep): SÍ escala** con el área grande (210 → 231). Deja de ser decisión derivada: está confirmada.
