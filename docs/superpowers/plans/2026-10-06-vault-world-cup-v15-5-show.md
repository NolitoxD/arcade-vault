# Vault World Cup — v1.5, paso V15-5 «Espectáculo» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la v1.5 de VAULT WORLD CUP con el espectáculo del partido y de sus pantallas: (G15-29) el entrenamiento sin tarjetas ni lesiones; (G15-11) nombres en los rótulos de GOL (en propia: «EN PROPIA · \<defensa\>» debajo), PENALTI, FALTA, FALLA de la tanda, TARJETA y LESIÓN, cada rótulo con su propio nombre, y el dorsal sobre el controlado; (G15-25) la entrada «tirándose» y el robo que solo amaga; (G15-4) la celebración del gol con carrera al goleador, abrazo en corro y cabezas gachas; (G15-14) la red que ondula con el gol; (G15-19, matizada) la pantalla previa con las dos formaciones de pie, sin nombres; (G15-21) el confeti y los fuegos de la victoria. **El motor se toca UNA sola vez, en la Task 1 (G15-29, un interruptor de reglas sin regrabado); el resto es pantalla.**

**Architecture:** Cada pieza nueva es un módulo PURO de `football-screen/` con su test (`celebration.ts`, `net-ripple.ts`, `pre-match.ts`, `front-sprite.ts`) o una ampliación pura de uno existente (`captions.ts`, `sprite-maps.ts`, `sprite-frame.ts`, `gestures.ts`, `flow.ts`, `particles.ts`, `control-hints.ts`); el `.tsx` solo pregunta y dibuja, en dos tareas de cableado (una por día). Todo lo que la pantalla necesita del motor lo lee **en el paso en que ocurre**, con `MatchWatch` o con una instantánea previa al paso (`capturePreStep`), después de CADA `stepMatchRun` — nunca como estado del último paso del frame. Nada se crea por frame: estados, tablas de senos y lienzos se crean al montar o en un evento.

**Tech Stack:** TypeScript estricto, React 19.2.4, Next 16.2.6 (App Router), canvas 2D 800 × 500, vitest 4.1.11 (tests `*.test.ts` junto al código, **sin `vitest.config`**, entorno Node sin DOM, **imports relativos** — el alias `@/` no existe en vitest).

**Spec:** `specs/31-vault-world-cup.md` (Approved) — decisiones **G15-4**, **G15-11**, **G15-14** (bullet «Grill de la v1.5»), **G15-19** y **G15-21** (bullet «Ampliación tras el QA de V15-1»), **G15-19 matizada** y **G15-25** (bullet «QA jugado de V15-2»), **G15-29** (al final del spec, 06-oct); criterios de aceptación **1, 2, 17, 20, 21 y 23**. Las decisiones G15 son ley y no se reabren en este plan.
**Plan hermano (modelo de formato):** `docs/superpowers/plans/2026-09-23-vault-world-cup-v15-3-content.md` (paso de pantalla). **Lecciones aplicadas:** `.superpowers/sdd/2026-09-24-vault-world-cup-v15-4/progress.md` (ver «Lecciones de V15-4» abajo).
**Código a imitar:** `football-screen/gestures.ts` (temporizadores de pantalla en arrays tipados creados una vez, `beginGkCatchGestures` leyendo los eventos del paso) · `football-screen/captions.ts` (`MatchWatch`, `cardShownThisStep`: el flanco de un paso leído contra el paso anterior) · `football-screen/particles.ts` (depósito creado una vez, tablas trigonométricas en la carga del módulo, cuarto stream) · `football-screen/sprite-maps.ts` (mapas de caracteres horneados con paleta) · `football-screen/flow.ts` (fases puras; el componente solo pregunta).
**Código a modificar:** motor (SOLO Task 1) — `football-logic/match.ts` (+ `match.test.ts`, `discipline.test.ts`); pantalla — `football-screen/{captions,hud,sprite-maps,sprite-frame,gestures,flow,control-hints,particles}.ts` (+ sus tests y `view-pipeline.test.ts`), `components/games/VaultWorldCupGame.tsx`; spec — una anotación.
**Código nuevo:** `football-screen/celebration.ts`, `football-screen/net-ripple.ts`, `football-screen/front-sprite.ts`, `football-screen/pre-match.ts` (+ los cuatro tests).
**Ledger de este paso:** `.superpowers/sdd/2026-10-06-vault-world-cup-v15-5/` (**creado vacío al escribir este plan**; está bajo el `.gitignore` de `.superpowers/sdd/`). El controlador crea allí `progress.md` al empezar la ejecución SDD; cada tarea le añade **una** línea al cerrar; la tarea de cierre escribe `qa-paco.md`.

---

## Global Constraints

**Los requisitos de cada tarea incluyen implícitamente esta sección.**

### Las decisiones del grill que este paso ejecuta (copiadas literalmente del spec)

- **G15-4 Celebración (Paco):** única para todos los goles (gol de oro incluido; tanda = solo el lanzador). Solo pantalla: equipo goleador corre hacia el goleador y abrazo en corro (sprite «abrazo» recoloreado por kit); rivales cabeza gacha. `GOAL_PAUSE_SECONDS` 2 → **4** (constante del motor → REGRABADO de valores dependientes de pasos; verificar en plan). Si en QA queda pobre → animación específica cargada al marcar (props: equipo goleador + colores del kit).
  > La pausa de 4 s ya está en el motor desde V15-4 (`GOAL_PAUSE_STEPS = stepsFor(4)` = 240). Este paso NO la toca.
- **G15-11 Nombres y dorsales (Paco):** 160 nombres inventados que suenen al país (sin jugadores reales) + dorsales fijos (GK = 1) en fichero de datos aparte. Nombre solo en eventos (GOL goleador, penalti lanzador, falta/tarjeta infractor); dorsal sobre el controlado junto al cursor. Motor intacto (verificar que expone goleador/infractor).
  > Los nombres y dorsales ya existen (`squads.ts`, 360 nombres, dorsales 1-18, V15-3). Verificado al escribir este plan: el motor **sí** expone lo necesario sin cambios — goleador = `ball.lastTouchId` en el paso del gol; lanzador del penalti = `setPiece.takerId` en el paso de la pitada; infractor = `scratch.events[i].actorId` del evento con `foul` en ese paso; tarjeta = `lastCard.squadIndex`; goleador de la tanda = `shootoutTakerId(team, taken[team] - 1)` (función pura ya exportada por `set-pieces.ts`).
- **G15-14 Red que ondula (Paco):** solo con gol (incluye gol de oro y tanda); poste/larguero no la mueven. Onda amortiguada desde el punto de impacto, ~1 s dentro de la pausa de 4 s. Solo pantalla (`net-ripple.ts` + test). Ajuste en QA.
- **G15-19 · Pantalla previa**: antes del saque inicial en amistoso y Mundial, ~3 s o hasta A. Arriba rival, abajo tu equipo (estilo foto Tehkan de alineaciones): 11 titulares de pie en fila con su kit (GK verde flúor), nombre de la selección y «TU EQUIPO»/«ORDENADOR» (a dos: «J1»/«J2»). Sprite nuevo «de frente, de pie» en el mismo pixel-art, horneado y recoloreado por kit; fondo simple de gradas + césped; parecido, no copia. En V15-5, solo pantalla.
- **G15-19 matizada (Paco, 23-sep):** la pantalla previa va justo al pulsar JUGAR, con el rival ya sorteado, y **SIN NOMBRES**: solo las dos formaciones de pie con sus equipaciones, para dar ambiente. Los nombres se ven en ALINEACIÓN (G15-17) y en los eventos.
  > Referencia de aspecto: `references/vault-world-cup-tehkan.png` y la foto de alineaciones que Paco compartió en el chat (dos equipos en fila, uno arriba y otro abajo; no está en el repo).
- **G15-21 · Celebración de victoria**: reutiliza particles.ts existente (confeti amistoso / fuegos Mundial). Amistoso ganado: confeti empieza sobre el campo al pitido final, más denso y con colores del kit propio. Mundial ganado: fuegos + confeti a la vez, más densos, confeti dorado + kit, destello dorado en la copa. Solo pantalla, en V15-5.
- **G15-25 · Entrada visible** (V15-5, solo pantalla): sprite «tirándose» (tumbado de lado, pierna estirada) durante la entrada y luego levantarse; el robo normal solo amaga (cuerpo inclinado y más bajo, sin tocar el suelo).
- **G15-29 · Entrenamiento sin tarjetas ni lesiones (Paco, 2026-10-06):** el entrenamiento sirve para habituarse a los mandos y coger habilidad, no para practicar reglas: se desactivan tarjetas y lesiones en ese modo (interruptor en las reglas del modo, sin regrabado). Amistoso y Mundial no cambian. Sobre la dificultad: «el amistoso ya es difícil contra la máquina», así que la progresión del Mundial no preocupa por ahora (se confirma en el QA).

### Resoluciones de Paco (06-oct) — ya aplicadas a cada tarea, test, compuerta y a `qa-paco.md`; NO son dudas abiertas

- **D1 · cámara de la tanda:** se sujeta **1 s** (`SHOOTOUT_HOLD_STEPS` = 60 pasos), y el rótulo GOL de la tanda dura **lo mismo** (`CAPTION_STEPS['shootout-goal']` = 60): la cámara y el rótulo cortan a la vez (Task 2 y Task 4). El tiempo que le quita al siguiente lanzador se juzga en el QA.
- **D2 · gol en propia:** celebra el equipo beneficiado, en corro alrededor de SU jugador más cercano al balón (`goalHubId`, Task 4); el rótulo es «GOL» y, debajo, «EN PROPIA · \<nombre del defensa\>» — por eso el sujeto del rótulo es **el defensa** y una marca `ownGoal` viaja con él (Task 2), y `drawCaption` lee una etiqueta ya horneada (Task 5).
- **D3 · FALLA de la tanda:** lleva el nombre del lanzador, como el resto de rótulos (Task 2).
- **D4 · amistoso sin botón JUGAR:** la pantalla previa sale justo tras la última ALINEACIÓN (Task 7). Vale así.
- **D5 · compañeros lejanos:** los cercanos llegan al corro y los demás se acercan **corriendo a velocidad normal** (`HUG_RUN_SPEED` = `PLAYER_SPEED` por paso = 3 u/paso = 180 u/s, fotogramas de carrera, NO sprint de 240 u/s) sin llegar (Task 4).
- **D6 · entrada que roba el balón:** el que roba no se levanta del suelo, sigue corriendo con el balón (Task 3). Vale así.

**Fuera de V15-5 (no se toca aunque «quede cerca»):** la fórmula de dificultad del Mundial (G15-29: no preocupa); resistencia y banquillo táctico (v1.6); el online (V15-6, tras producción); `reserveCanComeOn` duplicando las guardas de `substitute` (**NO se toca**: arreglarlo exige abrir el motor fuera de la Task 1); cualquier constante de juego (`INJURY_CHANCE`, `SHOT_POST_MARGIN`, tamaño del campo…).

### Lecciones de V15-4 que este plan aplica (de su `progress.md`)

1. **Los flancos de un paso se leen después de CADA paso, nunca como estado del último paso del frame.** `lastCard`, `frameHit`, `scratch.events`, el `takerId` de la tanda y la posición del lanzador cambian o se borran en el paso siguiente. Aquí: los sujetos de los rótulos se calculan dentro de `collectCaptions` (que ya corre por paso), el gol se detecta con `goalScoredThisStep(match, watch)` antes de `updateWatch`, y lo que el motor destruye en el mismo paso del gol (la tanda recoloca al lanzador y corta la cámara) se lee de una instantánea tomada ANTES de `stepMatchRun` (`capturePreStep`). Medido al escribir el plan (semilla 16, CPU contra CPU, dificultad 5): en el paso del gol de la tanda `shootout.takerId` ya es el SIGUIENTE lanzador, `ball.lastTouchId` también, el goleador está en el círculo central (x 980) y el punto de penalti saltó de x 231 a x 1969.
2. **Tests que pasan por casualidad:** cada test nuevo lleva su **control negativo** escrito con el resultado esperado literal, y se ejecuta (y se revierte) antes de cerrar la tarea. Un control que no hace fallar lo que dice = test vacuo, se arregla antes de seguir. Ejemplo ya detectado al escribir el plan: los dos equipos usan el mismo `squadIndex` en el mismo hueco de la alineación por defecto, así que «el nombre NO es el del siguiente lanzador» solo discrimina si el siguiente es **del mismo equipo** (Task 2, test 5).
3. **Controles negativos de determinismo:** cualquier cambio visual aleatorio sale de semillas (`createRng`), nunca de `Math.random` — y el test lo comprueba comparando dos corridas con la misma semilla y una con otra.
4. **Criterio 20** (abajo) con revisión explícita de cada función por frame en las tareas de cableado.
5. **Sin regrabado.** Ningún valor esperado de un test de partido cambia. La Task 1 (única que toca el motor) lo demuestra con la suite completa y la red `engine-invariants.test.ts` byte a byte.

### Criterios del spec (copiados literalmente)

> 1. **Misma semilla y misma secuencia de entradas producen el mismo estado**, paso a paso, en un partido completo. Hay test que lo fija. **La simulación es de paso fijo** (`STEP_MS`): ningún `dtMs` entra en el motor.
> 2. **El motor no distingue quién mueve cada equipo**: `stepMatch` recibe dos `TeamInput` y ningún módulo de `football-logic/` lee teclado, `Math.random` ni estado de módulo.
> 17. **Ganar el amistoso da la pantalla de GANADOR con confeti; ganar la final, la de CAMPEONES DEL MUNDO con fuegos artificiales**, ambas con la selección ganadora, y CONTINUAR devuelve al selector de modo.
> 20. **Ninguna asignación de memoria por frame** en el bucle ni en el dibujo, incluido el confeti (depósito de partículas creado una vez).
> 21. **La suite sigue verde y no baja de los 861 tests (cierre de la etapa B, 2026-09-06)** de partida.
> 23. **La tanda de penaltis es determinista con el `rng` inyectado y termina siempre** (nunca un partido sin ganador).

Traducción operativa del criterio 20 para este paso: dentro de `draw()` y todos sus `draw*`, `update`, `runStep`, `stepCaptionsOnly`, `loop` y `pollGamepadFrame` no hay `new`, literales de objeto o array, plantillas ni concatenaciones de string, `.map/.filter/.slice/.split/.fill`, ni cierres (`=>`) nuevos. Los estados nuevos (`createCelebration`, `createNetRipple`, `createPreStep`, `createCelebrationView`, `createRippleVertex`, los dos depósitos de partículas, los tres lienzos de frente y el de gradas) se crean **una vez al montar**; los horneados de frente por kit corren **en el evento** de entrar en la pantalla previa. `resetCelebration` usa `Int8Array.fill` sobre un array ya creado (no asigna) y corre en `startMatch` (evento).

### Reglas del repo

- **Commits: SOLO Paco.** Ninguna tarea ejecuta `git add`, `git rm`, `git commit` ni `git stash`. Donde un plan de superpowers diría «Commit», aquí dice: **dejar el working tree verificado; commit lo hace Paco**. Al final (Task V15-5-10) se propone **UN** mensaje de commit convencional para todo el paso.
- **Rama `main`. HEAD de hoy: `77aecd7`.** Estado medido al terminar este plan: `specs/31-vault-world-cup.md` modificado sin añadir (las 4 líneas de **G15-29** que Paco escribió hoy) y este plan sin seguimiento; nada más. Ninguno es código: no los toques, y cuando la Task 10 anote el spec, sus líneas se suman a las de Paco. Todas las compuertas comparan contra `77aecd7` y se acotan a `*.ts`/`*.tsx` donde haga falta.
- **NUNCA arrancar `next dev` ni `next build`.** Paco tiene el suyo en `:3000`. La verificación de cada tarea es `npx vitest run <fichero>` → `npx vitest run` → `npx tsc --noEmit` → `npx eslint <ficheros tocados>`. **El QA jugado lo hace Paco** con la lista que deja escrita la tarea de cierre.
- **EL MOTOR SE TOCA SOLO EN LA TASK 1.** Ficheros de `components/games/football-logic/` que este paso puede tocar:
  | Fichero | Por qué está permitido |
  |---|---|
  | `match.ts` | G15-29: un campo `discipline` en `MatchRules`, sus dos constantes y dos guardas en el bloque de la falta de `stepOpenPlay`. Ninguna otra línea de código cambia (comentarios del bloque G9-1 aparte). |
  | `match.test.ts` | Solo los dos literales `toEqual` que fijan `NORMAL_RULES` y `TRAINING_RULES` (`:1754-1755`). |
  | `discipline.test.ts` | +1 test de G15-29 al final (lo nuevo, con su control negativo). |

  Compuerta al cerrar **cada** tarea (desde la Task 1 en adelante):
  ```bash
  git diff --name-only 77aecd7 -- components/games/football-logic/ | sort
  ```
  Esperado, **exactamente** estas tres líneas y ninguna más:
  ```
  components/games/football-logic/discipline.test.ts
  components/games/football-logic/match.test.ts
  components/games/football-logic/match.ts
  ```
  Y la red, byte a byte: `md5 -q components/games/football-logic/engine-invariants.test.ts` → `0845d50e0d972fb778048d6a4e6fe443`. Si cualquier tarea de la 2 a la 10 creyera necesitar el motor, **se para** y se escribe como hallazgo en el ledger (no se planifica aquí).
- **Sin regrabado.** `git diff --stat 77aecd7 -- components/games/football-logic/ai.test.ts components/games/football-logic/probes.test.ts components/games/football-logic/probes-close-matches.test.ts components/games/football-logic/probes-difficulty.test.ts components/games/football-logic/probe-harness.ts components/games/football-logic/engine-invariants.test.ts` **vacío** en todas las tareas, y en `match.test.ts` solo las dos líneas de la Task 1. **Si algo obligara a regrabar, se para y se le pregunta a Paco.**
- **Determinismo (criterios 1 y 2):** `grep -rn "Math\.random(" components/games/football-logic/ components/games/football-screen/` **VACÍO** al cerrar cada tarea (tests incluidos). El patrón busca la LLAMADA (`Math\.random(`), no la palabra: un comentario que diga «sin Math.random» no casa y no puede hacer fallar la compuerta por construcción (pre-vuelo H5; aun así el comentario de `pre-match.ts` ya no la nombra). Lo aleatorio visual (público de las gradas) sale de `createRng(CROWD_SEED)`; el confeti y los fuegos, del cuarto stream `fxRng` que ya existe. Ningún fichero de `football-screen/` ni de `football-logic/` importa React ni toca `document`, `window`, `navigator` ni `localStorage`.
- **Instantáneas bajo `.superpowers/`: solo `.txt`/`.md`.** Compuerta: `find .superpowers -name "*.ts" -o -name "*.tsx"` **vacío**.
- **Baseline medida hoy (2026-10-06, HEAD `77aecd7`, `npx vitest run` ejecutado al escribir este plan): 1519 tests en 90 ficheros verdes, 0 saltados, 16,4 s. `npx tsc --noEmit` limpio.** Objetivo al cerrar el paso: **1561 tests en 94 ficheros**, 0 saltados (tabla de orden abajo). Ningún test existente de **partido** cambia de valor esperado.
- **ESLint de partida (medido hoy):** `npx eslint components/games/football-screen components/games/VaultWorldCupGame.tsx app/games/vault-world-cup` → **3 errores**, todos en `app/games/vault-world-cup/play/page.tsx` (`react-hooks`), de antes de V15-2; **no se arreglan aquí**. Criterio en cada compuerta: **ningún error nuevo**.
- **Tests con imports RELATIVOS** (`from './celebration'`, `from '../football-logic/match'`).
- **Comentarios, identificadores y nombres de tests (`describe`/`it`) en inglés.** El plan, el spec, el chat y los textos de UI, en castellano.
- **Ficheros en kebab-case**, salvo `VaultWorldCupGame.tsx`. Tipos en PascalCase, `SCREAMING_CASE` para constantes de módulo. TypeScript estricto: nada de `any`, **nada de `as` nuevo** (ni siquiera `as const` en tests: se escribe el tipo), **ningún `!` nuevo**. Compuerta, en DOS comandos y **vacía** los dos (pre-vuelo H5: el patrón viejo ` as ` casaba con prosa inglesa de comentarios y de títulos de `it`, y era ciego a los 8 ficheros nuevos, que sin `git add` no salen en `git diff`; el patrón nuevo exige código — un `as` seguido de un tipo — y se quitan antes los comentarios y los títulos de `describe`/`it`):
  ```bash
  # (a) las líneas añadidas en ficheros que ya están en git
  git diff 77aecd7 -- '*.ts' '*.tsx' | grep "^+" | grep -v "^+++" | grep -vE "^\+\s*(it|describe)\(" | sed -E 's#//.*$##' | grep -nE " as [A-Za-z{(\[]|!\.|!\)|: any"
  # (b) los 8 ficheros NUEVOS enteros (no hace falta añadirlos: se leen del disco)
  cat components/games/football-screen/{celebration,net-ripple,front-sprite,pre-match}{,.test}.ts | grep -vE "^\s*(it|describe)\(" | sed -E 's#//.*$##' | grep -nE " as [A-Za-z{(\[]|!\.|!\)|: any"
  ```
  (El (b) solo puede dar salida a partir de la tarea que crea cada fichero; con ficheros aún sin crear, `cat` avisa de «No such file» y no cuenta como hallazgo.)
- **Un test que pasa no prueba nada hasta verlo fallar** (regla de Paco). Cada tarea tiene su paso «ver en rojo» y su **control negativo** con el resultado esperado escrito literalmente.
- **Números de línea = orientativos.** Cada cita va con el texto literal a buscar; si las líneas se han desplazado, manda el texto.

### Orden, días y paralelismo (para SDD)

**Las diez tareas se ejecutan EN SERIE — V15-5-1 → … → V15-5-10 — nunca en paralelo.** Motivo: cada tarea pasa por un rojo **intencionado** (Step 2: `Failed to resolve import`, `TS2305`/`TS2339`; controles negativos) y cierra con `npx vitest run` y `npx tsc --noEmit` **globales**; en un mismo working tree dos subagentes verían el rojo del otro. Además la cadena es real: la Task 4 usa las poses de la 3 y el `goalScoredThisStep` de la 2; la 5 y la 9 editan el **mismo** `.tsx`; la 9 usa todo lo de la 6-8.

> **Regla de compuertas:** al cerrar **cada** tarea, `npx vitest run` sale **entero verde** con el número de la columna «Acumulado». Cada tarea **lista y arregla los tests existentes que rompe**. Los **únicos** rojos que cruzan una frontera de tarea son de `tsc` sobre `VaultWorldCupGame.tsx` (vitest no lo compila) y están declarados: (a) tras la **Task 3**, **5 errores**, todos en `VaultWorldCupGame.tsx` y de tres causas — el import de `SLIDE_TILT_COS` y `SLIDE_TILT_SIN` (TS2305 ×2), la llamada a `choosePlayerSprite` con un argumento menos (TS2554 ×1) y `spriteChoice.tilt` (TS2339 ×2) —, que cierra la **Task 5**; (b) tras la **Task 7**, **1 error**: `menuAction` sin `case 'pre-match'` deja de devolver en todos los caminos (TS2366), que cierra la **Task 9**. Las Tasks 2, 4, 6 y 8 mantienen compatibles las firmas que el `.tsx` usa (la 2 conserva los exports `cardShownThisStep` e `injuredTeamThisStep`; la 8 conserva `FX_COLORS`, `createParticlePool()`, `startFx` y `stepFx`). Nada más: si `tsc` da otro error al cerrar una tarea, es de esa tarea.

**Corte en dos días (Paco trabaja un paso al día; el paso no cabe en uno):**

| Día | Orden | Tarea | Ficheros que toca | Δ tests / ficheros | Acumulado |
|---|---|---|---|---|---|
| 1 | 1 | **V15-5-1** G15-29: entrenamiento sin tarjetas ni lesiones (MOTOR, sin regrabado) | `match.ts`, `match.test.ts`, `discipline.test.ts` | +1 / 0 | 1520 / 90 |
| 1 | 2 | **V15-5-2** G15-11: cada rótulo lleva su sujeto (nombre propio por rótulo) + `goalScoredThisStep`; borrar `buttonsIdle` | `captions.ts` (+test), `hud.ts` (+test) | +9 −2 = +7 / 0 | 1527 / 90 |
| 1 | 3 | **V15-5-3** G15-25 + G15-4: poses TIRÁNDOSE, AMAGO, ABRAZO y CABIZBAJO; amago del robo; levantarse | `sprite-maps.ts`, `sprite-frame.ts`, `gestures.ts` (+tests), `view-pipeline.test.ts` | +6 / 0 | 1533 / 90 |
| 1 | 4 | **V15-5-4** G15-4: la celebración del gol (puro) | `celebration.ts` + test (nuevos) | +8 / +1 | 1541 / 91 |
| 1 | 5 | **V15-5-5** cableado en partido: nombres, dorsal, sprites, amagos, abrazo y cámara de la tanda | `VaultWorldCupGame.tsx` | 0 / 0 | 1541 / 91 |
| — | — | **FIN DEL DÍA 1.** Working tree verificado; QA corto opcional de Paco (puntos 1-4 de `qa-paco.md` se escriben al cierre, pero se pueden mirar ya). Sin commit intermedio salvo que Paco lo pida. | | | |
| 2 | 6 | **V15-5-6** G15-14: la red que ondula (puro) | `net-ripple.ts` + test (nuevos) | +5 / +1 | 1546 / 92 |
| 2 | 7 | **V15-5-7** G15-19: pantalla previa (puro): fase, sprite de frente, maqueta, gradas, texto | `flow.ts`, `control-hints.ts` (+tests), `front-sprite.ts` + test, `pre-match.ts` + test (nuevos) | +11 / +2 | 1557 / 94 |
| 2 | 8 | **V15-5-8** G15-21: confeti y fuegos de la victoria (puro) | `particles.ts` (+test) | +4 / 0 | 1561 / 94 |
| 2 | 9 | **V15-5-9** cableado: red, pantalla previa y victoria | `VaultWorldCupGame.tsx` | 0 / 0 | 1561 / 94 |
| 2 | 10 | **V15-5-10** cierre: anotación del spec, `qa-paco.md`, mensaje de commit | `specs/31-vault-world-cup.md`, ledger | 0 / 0 | 1561 / 94 |

**Dónde se puede cortar (pre-vuelo M7).** El día 1 empieza hoy (06-oct) con las resoluciones de Paco ya aplicadas a la Task 2; son cinco tareas, dos largas y el `.tsx`, y puede no cerrar hoy. Los rojos de `tsc` que cruzan tareas se cierran dentro de cada día, así que **cortar tras la Task 2 o tras la Task 5 es seguro** (árbol limpio); cortar entre la Task 3 y la Task 5 deja el árbol con los 5 errores de `tsc` declarados en `VaultWorldCupGame.tsx` (ídem el error de la Task 7 hasta la Task 9). Si el día 1 no cierra, se retoma por la tarea que quede, sin repartir una tarea en dos días.

---

## Mapa de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `components/games/football-logic/match.ts` **(modificado)** | `MatchRules.discipline`; `NORMAL_RULES` lo pone a `true`, `TRAINING_RULES` a `false`; `registerFoul` y `decideInjury` solo corren con él. | 1 |
| `components/games/football-logic/match.test.ts` **(modificado)** | Los dos literales de `:1754-1755`. | 1 |
| `components/games/football-logic/discipline.test.ts` **(modificado)** | +1 test G15-29. | 1 |
| `components/games/football-screen/captions.ts` **(modificado)** | `CaptionState` con sujeto (`team`, `squad`) y marca `ownGoal` en lo que se muestra y en cada hueco de la cola; `pushCaption(cs, kind, team?, squad?, ownGoal?)`; deduplicado por (tipo, sujeto, en propia); `SUBJECT_NONE`, `OWN_GOAL_PREFIX`; `shootoutScorerId` (el lanzador del último tiro, entre o no), `foulOffenderId`, `goalScoredThisStep`; `CAPTION_STEPS['shootout-goal']` = 1 s (D1); `collectCaptions` calcula el sujeto de GOL (el defensa, con `ownGoal`, si fue en propia), GOL y FALLA de la tanda, FALTA, PENALTI, TARJETA y LESIÓN. | 2 |
| `components/games/football-screen/hud.ts` **(modificado)** | Se borra `buttonsIdle` (sin llamador de producción; `idleHint` cubre las mismas fases con test). | 2 |
| `components/games/football-screen/sprite-maps.ts` **(modificado)** | Cuatro poses nuevas: `POSE_SLIDE` 7, `POSE_FEINT` 8, `POSE_HUG` 9, `POSE_DEJECTED` 10 (`POSE_COUNT` 11, atlas 240 × 330); N y NE a mano, E = cuarto de vuelta de N. | 3 |
| `components/games/football-screen/sprite-frame.ts` **(modificado)** | Entrada = `POSE_SLIDE` con la cabeza detrás (la pierna estirada delante); levantarse = `POSE_FEINT` los últimos `GETUP_STEPS`; amago del robo = `POSE_FEINT`; fuera `tilt` y `SLIDE_TILT_*`. | 3 |
| `components/games/football-screen/gestures.ts` **(modificado)** | `FEINT_STEPS`, `beginStealFeints` (robo con rival a tiro → amago). | 3 |
| `components/games/football-screen/celebration.ts` **(nuevo)** | Estado de la celebración (gol / tanda), instantánea previa al paso, anfitrión del corro (goleador o, en propia, el más cercano al balón), huecos del corro del más cercano al más lejano, vista por jugador (posición, pose, octante), cámara sujeta 1 s en la tanda (D1), los compañeros lejanos corren a velocidad normal (D5). | 4 |
| `components/games/VaultWorldCupGame.tsx` **(modificado)** | T5: nombres por rótulo, dorsal, sprites, amagos, abrazo, cámara de la tanda. T9: red, pantalla previa, confeti/fuegos/destello. | 5, 9 |
| `components/games/football-screen/net-ripple.ts` **(nuevo)** | La onda amortiguada desde el punto de impacto (tabla de senos en la carga), desplazamiento radial de los vértices de la red. | 6 |
| `components/games/football-screen/flow.ts` **(modificado)** | `FlowPhase` `'pre-match'`, `PRE_MATCH_BY_MODE`, `PRE_MATCH_STEPS`, `preMatchStepsLeft`, `flowStepPreMatch`, `flowEndPreMatch`; `flowAfterModeBuilt` y `flowConfirmBracket('play')` pasan por ella. | 7 |
| `components/games/football-screen/front-sprite.ts` **(nuevo)** | El sprite «de frente, de pie» (11 × 21 a 3 px) y su horneado por paleta. | 7 |
| `components/games/football-screen/pre-match.ts` **(nuevo)** | Maqueta de la pantalla previa, quién va arriba/abajo, las cuatro etiquetas, el público de las gradas por semilla. | 7 |
| `components/games/football-screen/control-hints.ts` **(modificado)** | `preMatch` por esquema y `PRE_MATCH_HINT_TWO`. | 7 |
| `components/games/football-screen/particles.ts` **(modificado)** | Paleta por depósito, `writeConfettiPalette` (kit / oro + kit), `startConfettiRain`, más densidad (`CONFETTI_COUNT`, `FIREWORK_POOL_COUNT`, ráfagas), `cupFlashAlpha`. | 8 |
| `specs/31-vault-world-cup.md` **(modificado)** | Anotación «V15-5 implementado» bajo G15-22 y bajo G15-29. | 10 |

**Lo que este paso NO toca, a propósito:** todo `football-logic/` salvo los tres ficheros de la Task 1; `mode.ts` (el par confeti/fuegos se deriva en pantalla de `modeFxKind`); `keyboard.ts`, `gamepad-input.ts`, `lib/gamepad*`; `app/games/vault-world-cup/play/page.tsx`; `lib/games-registry.ts`; los otros 13 juegos.

**Deuda de V15-4 que se resuelve aquí:** (a) la **ranura única de nombre** (`cardName`/`injuryName`) que dos rótulos en < 3 s pisaban → cada rótulo lleva su sujeto (Task 2) y el `.tsx` borra las dos variables (Task 5); (b) **`buttonsIdle`** sin llamador de producción → **se borra** con sus 2 tests (Task 2): `idleHint` es el que usa la pantalla y su test cubre las mismas nueve fases. **Deuda que NO se toca:** `reserveCanComeOn` duplica las guardas de `substitute` (exige abrir el motor; queda para la próxima vez que se abra fuera de una tarea de reglas).

---

### Task V15-5-1: el entrenamiento sin tarjetas ni lesiones (G15-29, MOTOR, sin regrabado)

**La única tarea del paso que toca el motor.** Pequeña y aislada a propósito: un interruptor más en las reglas del modo, al lado de los dos que ya existen (`timed`, `frozenTeam`, G9-1).

**Files:**
- Modify: `components/games/football-logic/match.ts` (el bloque `// ── G9-1 (Paco, 09-sep): the training mode is a RULESET…` `:34-47`, con `export type MatchRules = { timed: boolean; frozenTeam: -1 | 0 | 1 };` `:45` y las dos constantes `:46-47`; en `stepOpenPlay`, `registerFoul(match, ev.actorId);` `:695` y `decideInjury(match, players[ev.victimId], rng);` `:700`)
- Modify: `components/games/football-logic/match.test.ts` (`expect(implicit.rules).toEqual({ timed: true, frozenTeam: -1 });` `:1754` y `expect(TRAINING_RULES).toEqual({ timed: false, frozenTeam: 1 });` `:1755`)
- Test: `components/games/football-logic/discipline.test.ts` (import de `./match` `:6-8`; describe nuevo al final del fichero)

**Interfaces:**
- Consumes: `registerFoul` (`discipline.ts`), `decideInjury` (privada de `match.ts`), los helpers del test `foulStep`, `fixedRng`, `PROFILES` (`discipline.test.ts:25-80`).
- Produces: `MatchRules = { timed: boolean; frozenTeam: -1 | 0 | 1; discipline: boolean }`; `NORMAL_RULES.discipline === true`; `TRAINING_RULES.discipline === false`. Nadie fuera de `match.ts` construye un `MatchRules` (verificado: `grep -rn "frozenTeam:" components` solo da las dos constantes y los dos literales del test), así que el campo nuevo no rompe a ningún consumidor.

**Por qué no hay regrabado (y cómo se prueba):** con `discipline: true` el bloque de la falta ejecuta **exactamente** lo de hoy, en el mismo orden y con las mismas tiradas del `Rng`; amistoso y Mundial usan `NORMAL_RULES` (`mode.ts:100`, `modeRules`). Solo el entrenamiento deja de tirar el dado de la lesión, y el entrenamiento no tiene grabaciones que dependan de él. La prueba es la suite: **ningún test existente cambia de valor esperado salvo los dos literales que fijan las propias constantes**, y la red `engine-invariants.test.ts` sigue byte a byte.

- [ ] **Step 1: Escribir el test que falla**

En `components/games/football-logic/discipline.test.ts`, añade `TRAINING_RULES` al import de `./match` (`:6-8`):

```ts
import {
  TRAINING_RULES, callSetPiece, createMatch, endExtraTime, keeperOf, resumePlay, stepMatch, substitute,
  type MatchPhase, type MatchState,
} from './match';
```

Y al final del fichero:

```ts
// ── G15-29 (Paco, 06-oct): the training is for getting used to the pads, not for
// practising the rules -- no cards and no injuries there. Friendly and World Cup keep
// NORMAL_RULES, so every test above (and every recording) is untouched.
describe('G15-29: the training decides no cards and no injuries', () => {
  it('under TRAINING_RULES four fouls by the same player book nobody, hurt nobody and draw nothing from the Rng', () => {
    const m = createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, PROFILES, TRAINING_RULES);
    // The victim is a statue of the frozen team (team 1), so stageFoulOn makes the
    // offender id 1 -- the human side's, the only one that can foul in a training.
    const victimId = TEAM_SIZE + 5;
    const offender = m.players[1];
    for (let i = 0; i < CARD_RED_AT; i++) {
      // A roll of 0 injures under NORMAL_RULES on the very first foul (INJURY_CHANCE 0.08).
      const roll = fixedRng([0]);
      foulStep(m, victimId, roll.rng);
      expect(m.lastCard.card, `foul ${i + 1}: card`).toBe('none');
      expect(roll.calls(), `foul ${i + 1}: injury draws`).toBe(0);
      expect(m.phase, `foul ${i + 1}: phase`).toBe('set-piece');
    }
    expect(offender.fouls).toBe(0);
    expect(offender.card).toBe('none');
    expect(offender.sentOff).toBe(false);
    expect(m.injuriesUsed).toEqual([0, 0]);
    expect(m.players[victimId].injured).toBe(false);
    expect(m.players.filter((p) => isActive(p))).toHaveLength(TEAM_SIZE * 2);
  });
});
```

`foulStep` ya asevera que el paso montado ES una falta sobre la víctima (`discipline.test.ts:76-81`), así que el test no puede pudrirse en un choque o una entrada limpia.

- [ ] **Step 2: Verlo fallar**

Run: `npx vitest run components/games/football-logic/discipline.test.ts -t "G15-29"`
Expected: FAIL en la primera vuelta del bucle con `foul 1: injury draws: expected 1 to be +0` (hoy el entrenamiento tira el dado de la lesión). Si fallara antes por otra cosa (por ejemplo `the staged slide was not given as a foul`), **para**: el montaje no vale en el entrenamiento y hay que entender por qué antes de tocar `match.ts`.

- [ ] **Step 3: Implementar**

En `components/games/football-logic/match.ts`, el bloque G9-1 (`:34-47`) pasa a:

```ts
// ── G9-1 (Paco, 09-sep): the training mode is a RULESET of the match, not a mode.
// The engine still does not know what it is playing; it knows three switches:
//   · timed      — advanceClock is a no-op when false: no half ends, no extra time,
//                  no shootout. The match only ends by abandon().
//   · frozenTeam — that team's outfield players skip positionTeam (their want
//                  channel stays at zero: they stand at their anchors), and never end a
//                  step holding a loose ball (dropFrozenPickup, S-FL2). Its KEEPER is
//                  untouched: keeperStep, keeperCatch and the automatic release all
//                  still run, which is what makes it a shooting drill and not a void.
//   · discipline — G15-29 (Paco, 06-oct): the cards of G15-13 and the injuries of G15-18
//                  are decided only when true. The training is for getting used to the
//                  pads, not for practising the rules: with false a foul is still
//                  whistled and restarted, but nobody is booked, nobody is hurt and the
//                  Rng is not drawn for the injury roll.
// NORMAL_RULES is the default of createMatch, so every existing call and test is the
// match it always was, byte for byte (see the first G9-1 test).
export type MatchRules = { timed: boolean; frozenTeam: -1 | 0 | 1; discipline: boolean };
export const NORMAL_RULES: Readonly<MatchRules> = { timed: true, frozenTeam: -1, discipline: true };
export const TRAINING_RULES: Readonly<MatchRules> = { timed: false, frozenTeam: 1, discipline: false };
```

En `stepOpenPlay`, dentro de `if (ev.foul) {` (`:688-703`), las dos llamadas pasan a ir guardadas — **nada más cambia en el bloque**, ni el orden ni `judgeFoul` ni `callSetPiece` ni `advanceClock`:

```ts
      if (match.rules.discipline) registerFoul(match, ev.actorId);
```
```ts
      if (match.rules.discipline) decideInjury(match, players[ev.victimId], rng);
```

Y añade una línea al comentario que precede a `registerFoul` (tras `// the screen reads match.lastCard on the edge, like it reads scratch.call.`):

```ts
      // G15-29: neither the card nor the injury roll happens in a training (rules.discipline).
```

En `components/games/football-logic/match.test.ts` (`:1754-1755`), los dos literales que fijan las constantes:

```ts
    expect(implicit.rules).toEqual({ timed: true, frozenTeam: -1, discipline: true });
    expect(TRAINING_RULES).toEqual({ timed: false, frozenTeam: 1, discipline: false });
```

- [ ] **Step 4: Verlo pasar**

Run: `npx vitest run components/games/football-logic/discipline.test.ts components/games/football-logic/match.test.ts`
Expected: PASS, los dos ficheros enteros.

- [ ] **Step 5: Controles negativos (ejecutar y REVERTIR cada uno)**

1. En `match.ts`, `TRAINING_RULES` con `discipline: true` → el test nuevo FALLA en `foul 1: injury draws: expected 1 to be +0` (y el `toEqual` de `match.test.ts:1755`). Revertir.
2. Quita SOLO la guarda de `registerFoul` (deja la de `decideInjury`) → el test nuevo FALLA en `foul 2: card: expected 'yellow' to be 'none'`. Revertir.
3. Quita SOLO la guarda de `decideInjury` → FALLA en `foul 1: injury draws: expected 1 to be +0`. Revertir.

Los tres revertidos: `git diff 77aecd7 -- components/games/football-logic/match.ts` enseña **solo** el comentario G9-1, el tipo, las dos constantes, las dos guardas y la línea de comentario G15-29.

- [ ] **Step 6: Compuertas — la prueba de que no hay regrabado**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-logic/match.ts components/games/football-logic/match.test.ts components/games/football-logic/discipline.test.ts
git diff --name-only 77aecd7 -- components/games/football-logic/ | sort
git diff 77aecd7 -- components/games/football-logic/match.test.ts | grep -E "^[+-][^+-]"
git diff --stat 77aecd7 -- components/games/football-logic/ai.test.ts components/games/football-logic/probes.test.ts components/games/football-logic/probes-close-matches.test.ts components/games/football-logic/probes-difficulty.test.ts components/games/football-logic/probe-harness.ts components/games/football-logic/engine-invariants.test.ts components/games/football-logic/mode.test.ts
md5 -q components/games/football-logic/engine-invariants.test.ts
grep -rn "Math\.random(" components/games/football-logic/ components/games/football-screen/
find .superpowers -name "*.ts" -o -name "*.tsx"
```
Expected: **1520 tests en 90 ficheros verdes**, 0 saltados (las tres sondas incluidas: siguen midiendo amistoso y escalera del Mundial con `NORMAL_RULES`); `tsc` sin salida; `eslint` sin salida; el `--name-only`, las **tres** líneas de las Global Constraints; el `grep` del diff de `match.test.ts`, **exactamente cuatro líneas** (los dos `-` y los dos `+` de `:1754-1755`); el `--stat`, **vacío**; el `md5`, `0845d50e0d972fb778048d6a4e6fe443`; `Math.random` y `find`, vacíos.

**Regla de parada:** si CUALQUIER test existente distinto de esos dos literales se pone rojo (en particular uno de entrenamiento de `match.test.ts:1830-2010` o de `match-run.test.ts`/`hud.test.ts`, que usan `TRAINING_RULES`), **no se ajusta su valor**: se para y se le lleva a Paco con el nombre del test, el valor viejo y el nuevo. Sería un regrabado, y este paso no los tiene.

- [ ] **Step 7: Dejar el working tree verificado (commit: Paco) y una línea al ledger**

`progress.md`: `Task V15-5-1: G15-29 — MatchRules.discipline (NORMAL true / TRAINING false), registerFoul y decideInjury guardados; 1520 / 90; match.test.ts solo :1754-1755; red md5 intacta; 3 controles revertidos.`

---

### Task V15-5-2: cada rótulo lleva su sujeto — nombres en GOL (y en propia), FALLA de la tanda, PENALTI, FALTA, TARJETA y LESIÓN (G15-11, puro)

**El arreglo de la ranura única.** Hoy el `.tsx` guarda UN nombre de tarjeta (`cardName`) y UNO de lesión (`injuryName`): si dos tarjetas llegan en menos de 3 s, el segundo nombre pisa al primero mientras éste espera en la cola (hallazgo de la revisión de V15-4). Aquí el nombre deja de vivir en el componente: **cada rótulo viaja en la cola con su sujeto** (`team`, `squad` = índice de plantilla), calculado en `collectCaptions` en el paso del evento. El `.tsx` (Task 5) solo traduce el sujeto a nombre al dibujar, con una búsqueda que no asigna (`playerName`). **El gol en propia (D2, resuelta por Paco 06-oct) lleva al DEFENSA como sujeto y una marca `ownGoal`**: así `drawCaption` puede rotular «GOL» y, debajo, «EN PROPIA · \<nombre del defensa\>» (una etiqueta horneada en `startMatch`, no compuesta por frame). Tampoco la FALLA de la tanda va sin nombre (D3), y el rótulo GOL de la tanda baja a 1 s (D1).

**Files:**
- Modify: `components/games/football-screen/captions.ts` (imports `:1-8`; `SHORT_CAPTION_STEPS` `:55` y `CAPTION_STEPS` `:60-82`, su línea `'shootout-goal'` `:70` (D1); `export const CAPTION_QUEUE_MAX = 4;` `:87`; `CaptionState` `:89-94`; `createCaptionState` `:96-100`; `pushCaption` `:102-113`; `stepCaption` `:115-128`; tras `frameHitThisStep` `:182-184` las funciones nuevas; `collectCaptions` pasos 1, 2, 4 y 4b `:211-266`; `resetCaptionState` `:306-310`)
- Modify: `components/games/football-screen/hud.ts` (`// The match is stopped and does not read A or B…` + `export function buttonsIdle` `:123-127`)
- Test: `components/games/football-screen/captions.test.ts` (imports `:1-11`; describe nuevo al final)
- Test: `components/games/football-screen/hud.test.ts` (import `:11`; `describe('buttonsIdle (gate 4)'` `:155-172`; comentario `:174-176`)

**Interfaces:**
- Consumes: `shootoutTakerId(team, taken)` (`football-logic/set-pieces.ts`, pura); `MatchState` (`ball.lastTouchId`, `players[i].squadIndex`, `setPiece`, `scratch.events`, `lastCard`, `pendingInjury`, `lastInjury`, `shootout`).
- Produces (los consumen las Tasks 4 y 5):
  - `SUBJECT_NONE = -1` y `OWN_GOAL_PREFIX = 'EN PROPIA · '`. (El centinela `SUBJECT_OWN_GOAL = -2` y `OWN_GOAL_TEXT` del primer borrador **no existen**: metían el gol en propia en el campo `squad` y perdían al defensa, así que «EN PROPIA · \<nombre del defensa\>» —D2, resuelta por Paco— no se podía dibujar.)
  - `CaptionState` gana `team: 0 | 1`, `squad: number`, `ownGoal: boolean` (lo que se MUESTRA) y `queueTeam: (0 | 1)[]`, `queueSquad: number[]`, `queueOwnGoal: boolean[]` (paralelos a `queue`). En un gol en propia el sujeto es **el defensa** (`team` = su equipo, `squad` = su `squadIndex`) y `ownGoal` es `true`; el equipo que marca no viaja con el rótulo (la celebración y la red lo reciben aparte, de `goalScoredThisStep`).
  - `pushCaption(cs: CaptionState, kind: CaptionKind, team: 0 | 1 = 0, squad: number = SUBJECT_NONE, ownGoal = false): void` — las llamadas de hoy con dos argumentos siguen valiendo.
  - `shootoutScorerId(match: MatchState, team: 0 | 1): number` (el lanzador del último tiro contado, haya entrado o no: lo usan GOL y FALLA de la tanda, D3), `foulOffenderId(match: MatchState): number`, `goalScoredThisStep(match: MatchState, w: MatchWatch): 0 | 1 | -1`.
  - `CAPTION_STEPS['shootout-goal']` baja de 1,5 s a **1 s** (60 pasos; D1): la Task 4 lo lee como `SHOOTOUT_HOLD_STEPS` para que la cámara sujeta y el rótulo GOL de la tanda duren lo mismo.
  - `cardShownThisStep` e `injuredTeamThisStep` **siguen exportadas** (el `.tsx` las importa hasta la Task 5).

- [ ] **Step 1: Escribir los tests que fallan**

En `components/games/football-screen/captions.test.ts`, sustituye el bloque de imports (`:1-11`) por:

```ts
import { describe, expect, it } from 'vitest';
import { NORMAL_RULES, createMatch, type MatchState } from '../football-logic/match';
import { TEAM_SIZE } from '../football-logic/teams';
import { PITCH } from '../football-logic/pitch';
import { FORMATIONS, TEAMS } from '../football-logic/teams';
import { humanProfile, profileFor } from '../football-logic/ai';
import { createShootoutState, shootoutTakerId } from '../football-logic/set-pieces';
import {
  CAPTION_QUEUE_MAX, CAPTION_STEPS, CAPTION_TEXT, OWN_GOAL_PREFIX, SUBJECT_NONE, collectCaptions,
  createCaptionState, createMatchWatch, goalScoredThisStep, pushCaption, resetCaptionState, resetMatchWatch, stepCaption,
  updateWatch, type CaptionKind,
} from './captions';
import { createMatchRun, stepMatchRun } from './match-run';
```

Y al final del fichero:

```ts
// ── G15-11 (V15-5): who each caption is about ─────────────────────────────────
// The subject travels WITH the caption through the queue, so two captions about two
// players never share one name slot (the V15-4 review: a second card inside 3 s renamed
// the first one while it was still waiting).
describe('G15-11: every caption carries its own subject', () => {
  function started(m: MatchState) {
    const w = createMatchWatch();
    const cs = createCaptionState();
    collectCaptions(m, w, 0, cs);
    updateWatch(m, w);
    resetCaptionState(cs);
    return { w, cs };
  }

  it('pushCaption carries the subject (and the own-goal mark) with the caption, and stepCaption hands it over with the kind', () => {
    const cs = createCaptionState();
    // Two DIFFERENT subjects on purpose: with the same one, a stepCaption that forgot to
    // hand the subject over would still show the right name, by coincidence.
    pushCaption(cs, 'foul', 1, 7);
    pushCaption(cs, 'injury', 0, 2);
    pushCaption(cs, 'goal', 1, 4, true);   // an own goal by player 4 of team 1 (D2): the mark travels too
    expect([cs.kind, cs.team, cs.squad, cs.ownGoal]).toEqual(['foul', 1, 7, false]);
    for (let i = 0; i < CAPTION_STEPS.foul; i++) stepCaption(cs);
    expect([cs.kind, cs.team, cs.squad, cs.ownGoal]).toEqual(['injury', 0, 2, false]);
    for (let i = 0; i < CAPTION_STEPS.injury; i++) stepCaption(cs);
    expect([cs.kind, cs.team, cs.squad, cs.ownGoal]).toEqual(['goal', 1, 4, true]);
    for (let i = 0; i < CAPTION_STEPS.goal; i++) stepCaption(cs);
    expect([cs.kind, cs.squad, cs.ownGoal]).toEqual(['none', SUBJECT_NONE, false]);
  });

  it('two cards for two players keep a name each, also back to back (the single name slot of V15-4 is gone)', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'foul', 0, 3);
    pushCaption(cs, 'card-yellow', 0, 3);
    pushCaption(cs, 'foul', 1, 9);
    pushCaption(cs, 'card-yellow', 1, 9);
    expect(cs.queue.slice(0, cs.queueLen)).toEqual(['card-yellow', 'foul', 'card-yellow']);
    expect(cs.queueSquad.slice(0, cs.queueLen)).toEqual([3, 9, 9]);
    expect(cs.queueTeam.slice(0, cs.queueLen)).toEqual([0, 1, 1]);
    // The same kind about a DIFFERENT player, straight after: queued, not swallowed.
    const back = createCaptionState();
    pushCaption(back, 'card-yellow', 0, 3);
    pushCaption(back, 'card-yellow', 1, 9);
    expect([back.queueLen, back.queue[0], back.queueSquad[0]]).toEqual([1, 'card-yellow', 9]);
  });

  it('the same caption about the same player is still queued once', () => {
    const cs = createCaptionState();
    pushCaption(cs, 'foul', 1, 9);
    // The subject is part of the state: this line is what puts the test in red before the
    // code exists (the old state has no team/squad), so it is not an empty test.
    expect([cs.kind, cs.team, cs.squad]).toEqual(['foul', 1, 9]);
    pushCaption(cs, 'foul', 1, 9);
    expect(cs.queueLen).toBe(0);
    pushCaption(cs, 'card-red', 1, 9);
    pushCaption(cs, 'card-red', 1, 9);
    expect(cs.queueLen).toBe(1);
    // A caption with no subject keeps the old rule.
    pushCaption(cs, 'full-time');
    pushCaption(cs, 'full-time');
    expect(cs.queue.slice(0, cs.queueLen)).toEqual(['card-red', 'full-time']);
  });

  it('GOL names the last player to touch the ball; in an own goal that is the DEFENDER, flagged ownGoal; nobody when nobody touched it', () => {
    const m = newMatch();
    const { w, cs } = started(m);
    const scorer = m.players[TEAM_SIZE + 9];
    m.ball.lastTouchId = scorer.id;
    m.score[1] = 1;
    m.phase = 'goal';
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    expect([cs.kind, cs.team, cs.squad, cs.ownGoal]).toEqual(['goal', 1, scorer.squadIndex, false]);
    expect(scorer.squadIndex).toBeGreaterThanOrEqual(0);
    updateWatch(m, w);
    resetCaptionState(cs);
    // A team-0 defender put it in his own net: team 1 scores, but the caption is ABOUT the
    // defender (D2: "EN PROPIA · <defender's name>"), so it carries HIS team and squad index.
    const defender = m.players[4];
    expect(defender.team).toBe(0);
    m.ball.lastTouchId = defender.id;
    m.score[1] = 2;
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    expect([cs.kind, cs.team, cs.squad, cs.ownGoal]).toEqual(['goal', 0, defender.squadIndex, true]);
    expect(OWN_GOAL_PREFIX).toBe('EN PROPIA · ');
    updateWatch(m, w);
    resetCaptionState(cs);
    m.ball.lastTouchId = null;
    m.score[0] = 1;
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    expect([cs.kind, cs.team, cs.squad, cs.ownGoal]).toEqual(['goal', 0, SUBJECT_NONE, false]);
  });

  it('GOL of the shootout names the man who took THAT kick, not the next taker the engine already put on the spot', () => {
    const m = newMatch();
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    const { w, cs } = started(m);
    // Team 0's third kick went in. The next taker of the SAME team is used as the trap:
    // the two teams' default lineups share squad indices slot by slot, so only a taker
    // of the same team tells a right name from a wrong one.
    m.shootout.taken[0] = 3;
    m.shootout.scored[0] = 1;
    m.shootout.taken[1] = 2;
    m.shootout.team = 1;
    m.shootout.takerId = shootoutTakerId(0, 3);
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    const scorer = m.players[shootoutTakerId(0, 2)];
    const next = m.players[shootoutTakerId(0, 3)];
    expect([cs.kind, cs.team, cs.squad]).toEqual(['shootout-goal', 0, scorer.squadIndex]);
    expect(scorer.squadIndex).not.toBe(next.squadIndex);
  });

  it('FALTA names the offender of the step\'s foul and PENALTI the taker who will kick it', () => {
    const m = newMatch();
    const { w, cs } = started(m);
    const offender = m.players[TEAM_SIZE + 5];
    const victim = m.players[3];
    const ev = m.scratch.events[offender.id];
    ev.kind = 'tackle';
    ev.foul = true;
    ev.actorId = offender.id;
    ev.victimId = victim.id;
    m.scratch.call.kind = 'free-kick';
    m.phase = 'set-piece';
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    expect([cs.kind, cs.team, cs.squad]).toEqual(['foul', 1, offender.squadIndex]);

    const p = newMatch();
    const s = started(p);
    const taker = p.players[7];
    p.setPiece = p.scratch.setPiece;
    p.setPiece.kind = 'penalty';
    p.setPiece.takerId = taker.id;
    p.scratch.call.kind = 'penalty';
    p.phase = 'set-piece';
    p.stepCount++;
    collectCaptions(p, s.w, 0, s.cs);
    expect([s.cs.kind, s.cs.team, s.cs.squad]).toEqual(['penalty', 0, taker.squadIndex]);
  });

  it('TARJETA names the carded man from lastCard (not the slot) and LESIÓN the injured one, each in its own caption', () => {
    const m = newMatch();
    const { w, cs } = started(m);
    const fouler = m.players[TEAM_SIZE + 4];
    const victim = m.players[6];
    const ev = m.scratch.events[fouler.id];
    ev.kind = 'tackle';
    ev.foul = true;
    ev.actorId = fouler.id;
    ev.victimId = victim.id;
    m.scratch.call.kind = 'free-kick';
    m.lastCard.playerId = fouler.id;
    m.lastCard.squadIndex = fouler.squadIndex;
    m.lastCard.card = 'yellow';
    m.injuriesUsed[0] = 1;
    m.pendingInjury[0] = victim.id;
    m.phase = 'injury';
    m.stepCount++;
    collectCaptions(m, w, 0, cs);
    expect([cs.kind, cs.team, cs.squad]).toEqual(['foul', 1, fouler.squadIndex]);
    expect(cs.queue.slice(0, cs.queueLen)).toEqual(['card-yellow', 'injury']);
    expect(cs.queueTeam.slice(0, cs.queueLen)).toEqual([1, 0]);
    expect(cs.queueSquad.slice(0, cs.queueLen)).toEqual([fouler.squadIndex, victim.squadIndex]);

    // A keeper's red: the slot already holds the second keeper (squad 1) when the screen
    // looks, and the caption must still name the one sent off (squad 0) -- review-6.
    const k = newMatch();
    const s = started(k);
    k.players[0].squadIndex = 1;
    k.lastCard.playerId = 0;
    k.lastCard.squadIndex = 0;
    k.lastCard.card = 'red';
    k.stepCount++;
    collectCaptions(k, s.w, 0, s.cs);
    expect([s.cs.kind, s.cs.team, s.cs.squad]).toEqual(['card-red', 0, 0]);
  });

  // MEASURED 06-oct: CPU v CPU, seed 16, difficulty 5, ESPAÑA v ITALIA in 4-4-2 ends 0-0
  // and goes to penalties, where team 0 scores three (0-0, 3-0 on penalties) and team 1
  // misses its three (pre-flight). On the step of each kick the engine has ALREADY put the
  // next taker on the spot, so this one run covers the GOL and the FALLA (D3) of the shootout.
  it('a real shootout (CPU v CPU, seed 16): every GOL and every FALLA, read step by step, names the man who took THAT kick', () => {
    const run = createMatchRun(TEAMS[0], TEAMS[1], 16, 5, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const w = createMatchWatch();
    const cs = createCaptionState();
    let named = 0;
    let missed = 0;
    for (let i = 0; i < 20_000 && m.phase !== 'over'; i++) {
      const takerBefore = m.shootout === null ? -1 : m.shootout.takerId;
      stepMatchRun(run);
      resetCaptionState(cs);
      collectCaptions(m, w, 'none', cs);
      updateWatch(m, w);
      if (cs.kind !== 'shootout-goal' && cs.kind !== 'shootout-miss') continue;
      expect(takerBefore).toBeGreaterThanOrEqual(0);
      expect([cs.team, cs.squad]).toEqual([m.players[takerBefore].team, m.players[takerBefore].squadIndex]);
      if (cs.kind === 'shootout-goal') {
        expect(m.shootout === null ? -1 : m.shootout.takerId).not.toBe(takerBefore);
        named++;
      } else missed++;
    }
    expect(named).toBe(3);
    expect(missed).toBeGreaterThan(0);
  });

  it('goalScoredThisStep: the team that scored on this step, in open play or in the shootout; -1 for a post, a miss and the step after', () => {
    const m = newMatch();
    const w = createMatchWatch();
    collectCaptions(m, w, 0, createCaptionState());
    updateWatch(m, w);
    m.ball.frameHit = 'post';
    m.stepCount++;
    expect(goalScoredThisStep(m, w)).toBe(-1);
    m.score[1] = 1;
    expect(goalScoredThisStep(m, w)).toBe(1);
    updateWatch(m, w);
    expect(goalScoredThisStep(m, w)).toBe(-1);
    m.phase = 'shootout';
    m.shootout = createShootoutState();
    updateWatch(m, w);
    m.shootout.taken[0] = 1;
    expect(goalScoredThisStep(m, w)).toBe(-1);      // a miss: taken moved, scored did not
    m.shootout.scored[0] = 1;
    expect(goalScoredThisStep(m, w)).toBe(0);
  });
});
```

En `components/games/football-screen/hud.test.ts`: quita `buttonsIdle, ` del import (`:11`), borra el `describe('buttonsIdle (gate 4)', …)` entero (`:155-172`, sus dos `it`) y reescribe las tres líneas del comentario que le sigue (`:174-176`, que hablan de `buttonsIdle`) como un comentario limpio, con estas tres líneas exactas (M4: la edición «línea a línea» del primer borrador dejaba «the match is stopped -- / too, but A confirms…»):

```ts
// V15-4-7 (controller addition 3): during the LESIONADO window the match is stopped, but
// A confirms the reserve, so the bottom line must not say "the buttons do nothing".
// idleHint is the exhaustive switch that picks which line.
``` Las nueve fases que fijaban los dos `it` borrados las sigue fijando, una por una, el `it` de `idleHint` (`:177-190`).

- [ ] **Step 2: Verlos fallar**

Run: `npx vitest run components/games/football-screen/captions.test.ts`
Expected: FAIL **test a test, no el fichero entero** (M1: vitest no tumba la carga; resuelve los exports que faltan —`OWN_GOAL_PREFIX`, `goalScoredThisStep`— como `undefined`). Medido en el pre-vuelo con el borrador anterior: 8 de los 9 `it` nuevos en rojo y el de «queued once» **pasaba antes de implementar** (solo lo justificaba su control 3); por eso ese `it` lleva ahora la aserción `[cs.kind, cs.team, cs.squad]` tras el primer `pushCaption`, que sí cae en rojo (`expected [ 'foul', undefined, undefined ] to deeply equal [ 'foul', 1, 9 ]`): **los 9 nuevos, en rojo**. Si alguno pasa antes de implementar, es un test vacuo: se arregla antes de seguir. `npx vitest run components/games/football-screen/hud.test.ts` → PASS ya (solo se ha borrado).

- [ ] **Step 3: Implementar**

En `components/games/football-screen/captions.ts`:

1. Imports (`:1-8`): añade `import { shootoutTakerId } from '../football-logic/set-pieces';`.

1b. D1 (Paco, 06-oct): el rótulo GOL de la tanda dura **1 s**, lo mismo que la cámara sujeta (Task 4). Junto a `const SHORT_CAPTION_STEPS = stepsFor(1.5);` (`:55`) añade `const SHOOTOUT_GOAL_CAPTION_STEPS = stepsFor(1);   // D1: the camera holds the same second (celebration.ts)`, y en `CAPTION_STEPS` la línea `'shootout-goal': SHORT_CAPTION_STEPS,` (`:70`) pasa a `'shootout-goal': SHOOTOUT_GOAL_CAPTION_STEPS,`. El comentario «the captions that cover an engine pause last exactly as long as the pause» sigue siendo verdad: la tanda no tiene pausa de motor, así que acortar su GOL no deja la pantalla congelada.

2. Tras `export const CAPTION_QUEUE_MAX = 4;` (`:87`), y sustituyendo `CaptionState`, `createCaptionState`, `pushCaption` y `stepCaption` (`:89-128`):

```ts
// G15-11 (V15-5): who a caption is about. `squad` is the squad index of the player --
// the screen turns it into the name (lineup or squad) with a lookup, never a string
// built per frame -- or SUBJECT_NONE for a caption that names nobody. `team` is the
// subject's team (0 when nobody). D2 (Paco, 06-oct): an own goal is ABOUT THE DEFENDER --
// his team and his squad index -- and `ownGoal` says so; the screen draws GOL with
// OWN_GOAL_PREFIX + his name underneath, baked at startMatch, never composed per frame.
// The subject travels WITH the caption through the queue: two captions about two players
// never share one name slot (the V15-4 review found a second card inside 3 s renaming the
// first one while it waited).
export const SUBJECT_NONE = -1;
export const OWN_GOAL_PREFIX = 'EN PROPIA · ';

export type CaptionState = {
  kind: ShowingCaption;
  stepsLeft: number;
  team: 0 | 1;
  squad: number;
  ownGoal: boolean;
  queue: CaptionKind[];
  queueTeam: (0 | 1)[];
  queueSquad: number[];
  queueOwnGoal: boolean[];
  queueLen: number;
};

export function createCaptionState(): CaptionState {
  const queue: CaptionKind[] = [];
  const queueTeam: (0 | 1)[] = [];
  const queueSquad: number[] = [];
  const queueOwnGoal: boolean[] = [];
  for (let i = 0; i < CAPTION_QUEUE_MAX; i++) {
    queue.push('kickoff');
    queueTeam.push(0);
    queueSquad.push(SUBJECT_NONE);
    queueOwnGoal.push(false);
  }
  return {
    kind: 'none', stepsLeft: 0, team: 0, squad: SUBJECT_NONE, ownGoal: false, queue, queueTeam, queueSquad, queueOwnGoal,
    queueLen: 0,
  };
}

// A caption equal to the one showing, or to the last one queued, is dropped -- equal
// meaning the same kind ABOUT THE SAME PLAYER (and the same own-goal mark): a second card
// for somebody else is news.
export function pushCaption(
  cs: CaptionState, kind: CaptionKind, team: 0 | 1 = 0, squad: number = SUBJECT_NONE, ownGoal = false,
): void {
  if (cs.kind === 'none') {
    cs.kind = kind;
    cs.stepsLeft = CAPTION_STEPS[kind];
    cs.team = team;
    cs.squad = squad;
    cs.ownGoal = ownGoal;
    return;
  }
  if (cs.kind === kind && cs.team === team && cs.squad === squad && cs.ownGoal === ownGoal) return;
  const last = cs.queueLen - 1;
  if (
    last >= 0 && cs.queue[last] === kind && cs.queueTeam[last] === team && cs.queueSquad[last] === squad
    && cs.queueOwnGoal[last] === ownGoal
  ) return;
  if (cs.queueLen >= CAPTION_QUEUE_MAX) return;
  cs.queue[cs.queueLen] = kind;
  cs.queueTeam[cs.queueLen] = team;
  cs.queueSquad[cs.queueLen] = squad;
  cs.queueOwnGoal[cs.queueLen] = ownGoal;
  cs.queueLen++;
}

export function stepCaption(cs: CaptionState): void {
  if (cs.kind === 'none') return;
  cs.stepsLeft--;
  if (cs.stepsLeft > 0) return;
  if (cs.queueLen === 0) {
    cs.kind = 'none';
    cs.stepsLeft = 0;
    cs.team = 0;
    cs.squad = SUBJECT_NONE;
    cs.ownGoal = false;
    return;
  }
  cs.kind = cs.queue[0];
  cs.team = cs.queueTeam[0];
  cs.squad = cs.queueSquad[0];
  cs.ownGoal = cs.queueOwnGoal[0];
  cs.stepsLeft = CAPTION_STEPS[cs.kind];
  for (let i = 1; i < cs.queueLen; i++) {
    cs.queue[i - 1] = cs.queue[i];
    cs.queueTeam[i - 1] = cs.queueTeam[i];
    cs.queueSquad[i - 1] = cs.queueSquad[i];
    cs.queueOwnGoal[i - 1] = cs.queueOwnGoal[i];
  }
  cs.queueLen--;
}
```

3. Tras `frameHitThisStep` (`:182-184`) (no hay `goalSubject`: el sujeto del GOL se calcula inline en `collectCaptions`, paso 1, porque necesita el jugador entero —equipo y `squadIndex`—, no solo un índice):

```ts
// G15-11 / G15-4 / D3: the id of the taker whose shootout kick `team` has just taken --
// scored OR missed, both captions name him. NOT shootout.takerId: on the step of the kick
// finishShootoutKick has already put the NEXT taker on the spot (measured 06-oct, seed 16).
// shootoutTakerId is the engine's own pure rule (set-pieces.ts); the kick just counted is
// number taken[team] - 1.
export function shootoutScorerId(match: MatchState, team: 0 | 1): number {
  const sh = match.shootout;
  if (sh === null || sh.taken[team] === 0) return -1;
  return shootoutTakerId(team, sh.taken[team] - 1);
}

// G15-11: the player whose foul the referee judged on THIS step -- the first foul event in
// ascending id order, the very scan stepOpenPlay judges by. -1 when there is none. The
// events are swept at the top of the next stepMatch: read on the step, never later.
export function foulOffenderId(match: MatchState): number {
  const events = match.scratch.events;
  for (let i = 0; i < events.length; i++) {
    if (events[i].foul) return events[i].actorId;
  }
  return -1;
}

// G15-4 / G15-14: the team that scored on THIS step -- in open play or a golden goal (the
// score), or in the shootout (its own scoreboard) -- or -1. A post or a crossbar never
// moves either counter. Read against the watch BEFORE updateWatch, like the captions.
export function goalScoredThisStep(match: MatchState, w: MatchWatch): 0 | 1 | -1 {
  if (match.score[0] > w.score0) return 0;
  if (match.score[1] > w.score1) return 1;
  const sh = match.shootout;
  if (sh === null) return -1;
  if (sh.scored[0] > w.scored0) return 0;
  if (sh.scored[1] > w.scored1) return 1;
  return -1;
}

// The squad index of whoever left the pitch with the card of THIS step, if it is the
// offender; otherwise the offender's own. After a keeper's red the slot already holds
// the second keeper (review-6), and lastCard kept the one sent off.
function offenderSquad(match: MatchState, w: MatchWatch, id: number): number {
  const card = match.lastCard;
  if (cardShownThisStep(match, w) && card.playerId === id) return card.squadIndex;
  return match.players[id].squadIndex;
}

function injurySquad(match: MatchState, team: 0 | 1): number {
  const id = match.pendingInjury[team] >= 0 ? match.pendingInjury[team] : match.lastInjury;
  return id < 0 ? SUBJECT_NONE : match.players[id].squadIndex;
}
```

4. En `collectCaptions` (`:211-266`), el paso 1 (`if (match.score[0] > w.score0 || match.score[1] > w.score1) pushCaption(cs, 'goal');`) pasa a:

```ts
  const scorer = match.score[0] > w.score0 ? 0 : match.score[1] > w.score1 ? 1 : -1;
  if (scorer !== -1) {
    // G15-11 / D2: the subject is the last player to touch the ball (ball.lastTouchId,
    // written by every kick and every possession), read on the goal's own step -- the
    // kickoff after the pause gives the ball to somebody else. A touch by the team that
    // did NOT score is an own goal: the caption is ABOUT that defender, flagged ownGoal.
    const id = match.ball.lastTouchId;
    if (id === null) pushCaption(cs, 'goal', scorer);
    else {
      const toucher = match.players[id];
      pushCaption(cs, 'goal', toucher.team, toucher.squadIndex, toucher.team !== scorer);
    }
  }
```

El paso 2 (desde `const sh = match.shootout;` hasta el cierre de su `if`) pasa a:

```ts
  const sh = match.shootout;
  if (sh !== null && (sh.taken[0] !== w.taken0 || sh.taken[1] !== w.taken1)) {
    // D3: GOL and FALLA both name the man who took THAT kick; the team whose `taken`
    // moved is the one that kicked.
    const kicked = sh.taken[0] !== w.taken0 ? 0 : 1;
    const id = shootoutScorerId(match, kicked);
    const squad = id < 0 ? SUBJECT_NONE : match.players[id].squadIndex;
    const scoredNow = sh.scored[0] !== w.scored0 || sh.scored[1] !== w.scored1;
    pushCaption(cs, scoredNow ? 'shootout-goal' : 'shootout-miss', kicked, squad);
  }
```

En el paso 4, los dos `case` de falta y penalti pasan a:

```ts
      case 'free-kick': {
        const id = foulOffenderId(match);
        if (id < 0) pushCaption(cs, 'foul');
        else pushCaption(cs, 'foul', match.players[id].team, offenderSquad(match, w, id));
        break;
      }
      case 'penalty': {
        const sp = match.setPiece;
        if (sp === null || sp.takerId < 0) pushCaption(cs, 'penalty');
        else pushCaption(cs, 'penalty', match.players[sp.takerId].team, match.players[sp.takerId].squadIndex);
        break;
      }
```

Y el paso 4b (las dos líneas de tarjeta y lesión) pasa a:

```ts
  if (cardShownThisStep(match, w)) {
    const card = match.lastCard;
    const kind = card.card === 'red' ? 'card-red' : 'card-yellow';
    if (card.playerId < 0) pushCaption(cs, kind);
    else pushCaption(cs, kind, match.players[card.playerId].team, card.squadIndex);
  }
  const injured = injuredTeamThisStep(match, w);
  if (injured !== -1) pushCaption(cs, 'injury', injured, injurySquad(match, injured));
```

(`card.playerId < 0` no pasa en el motor — `registerFoul` escribe siempre las dos cosas a la vez — pero el test existente `does NOT queue the card again…` (`captions.test.ts:561`) monta una tarjeta sin `playerId`, y leer `players[-1]` reventaría.)

5. `resetCaptionState` (`:306-310`) añade `cs.team = 0;`, `cs.squad = SUBJECT_NONE;` y `cs.ownGoal = false;`.

En `components/games/football-screen/hud.ts`, borra las cinco líneas de `buttonsIdle` (`:123-127`: las dos de comentario y la función).

- [ ] **Step 4: Verlos pasar**

Run: `npx vitest run components/games/football-screen/captions.test.ts components/games/football-screen/hud.test.ts`
Expected: PASS, todos (los existentes de `captions.test.ts` incluidos: las llamadas `pushCaption(cs, kind)` de dos argumentos siguen deduplicando igual porque el sujeto por defecto es el mismo).

- [ ] **Step 5: Controles negativos (ejecutar y REVERTIR cada uno)**

1. `stepCaption` sin las dos líneas `cs.team = cs.queueTeam[0]; cs.squad = cs.queueSquad[0];` → FALLA `pushCaption carries the subject…` en el segundo `toEqual` (`expected [ 'injury', 1, 7, false ] to deeply equal [ 'injury', 0, 2, false ]`). Es el control que justifica usar dos sujetos distintos en ese test.
1b. `stepCaption` sin `cs.ownGoal = cs.queueOwnGoal[0];` → FALLA el mismo `it` en el tercer `toEqual` (`expected [ 'goal', 1, 4, false ] to deeply equal [ 'goal', 1, 4, true ]`): la marca de «en propia» se pierde al pasar de la cola al rótulo.
2. Deduplicado solo por tipo (`if (cs.kind === kind) return;` y `cs.queue[last] === kind`) → FALLA `two cards for two players…` en el **primer** `toEqual` (M1, medido: `expected [ 'card-yellow' ] to deeply equal [ Array(3) ]`: la segunda tarjeta se traga, y con ella las otras dos).
3. Sin deduplicado (borra las dos líneas `return`) → FALLA `the same caption about the same player is still queued once` (`expected 1 to be +0`).
4. En el paso 1 de `collectCaptions`, `toucher.team !== scorer` sustituido por `false` → FALLA el test de GOL en el gol en propia (`expected [ 'goal', 0, <squad del defensa>, false ] to deeply equal [ 'goal', 0, <squad del defensa>, true ]`). Y con `pushCaption(cs, 'goal', scorer, toucher.squadIndex)` (el equipo que marca en vez del del defensa) → FALLA en `['goal', 1, …]` frente a `['goal', 0, …]`: el nombre se buscaría en la plantilla equivocada.
5. `shootoutScorerId` con `sh.taken[team]` en vez de `- 1` → FALLAN el test sintético de la tanda y el de la semilla 16.
6. `foulOffenderId` devolviendo `events[i].victimId` → FALLA `FALTA names the offender…` (`expected [ 'foul', 0, … ]`).
7. `offenderSquad` devolviendo siempre `match.players[id].squadIndex` y el 4b con `match.players[card.playerId].squadIndex` → FALLA el bloque del portero (`expected [ 'card-red', 0, 1 ] to equal [ 'card-red', 0, 0 ]`).
8. `goalScoredThisStep` sin las dos líneas de la tanda → FALLA su test en la última aserción (`expected -1 to be +0`).
9. D3: la FALLA empujada sin sujeto (`pushCaption(cs, 'shootout-miss')`) → FALLA el test de la semilla 16 en la primera FALLA (`expected [ 0, -1 ] to deeply equal [ 1, <squadIndex del que tiró> ]`). Y `shootoutScorerId` con `sh.taken[team]` en vez de `- 1` (control 5) también tumba ahora las FALLA: nombrarían al SIGUIENTE lanzador del mismo equipo.
10. D1: `'shootout-goal': SHORT_CAPTION_STEPS` (1,5 s) → no cae en esta tarea (ningún test de `captions.test.ts` fija esa duración); lo tumba el `it` de `celebration.test.ts` de la Task 4 (`expect(CAPTION_STEPS['shootout-goal']).toBe(SHOOTOUT_HOLD_STEPS)`), y se ejecuta allí (control 7 de la Task 4).

- [ ] **Step 6: Compuertas**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/captions.ts components/games/football-screen/captions.test.ts components/games/football-screen/hud.ts components/games/football-screen/hud.test.ts
git diff --name-only 77aecd7 -- components/games/football-logic/ | sort
grep -rn "buttonsIdle" components app lib
grep -rn "Math\.random(" components/games/football-logic/ components/games/football-screen/
find .superpowers -name "*.ts" -o -name "*.tsx"
```
Expected: **1527 tests en 90 ficheros** (1520 + 9 − 2); `tsc` sin salida (el `.tsx` sigue compilando: las firmas son compatibles); `eslint` sin salida; el motor, las tres líneas de la Task 1; `buttonsIdle`, `Math.random` y `find`, vacíos.

- [ ] **Step 7: Ledger**

`Task V15-5-2: sujeto por rótulo (GOL, GOL EN PROPIA con el defensa + marca ownGoal, GOL y FALLA de la tanda con el lanzador, FALTA/PENALTI/TARJETA/LESIÓN), deduplicado por (tipo, sujeto, ownGoal), goalScoredThisStep, rótulo GOL de la tanda a 1 s (D1); buttonsIdle borrado; 1527 / 90; 9 controles revertidos aquí (el 10 se ejecuta en la Task 4).`

---

### Task V15-5-3: las cuatro poses nuevas — TIRÁNDOSE, AMAGO, ABRAZO, CABIZBAJO — el amago del robo y el levantarse (G15-25 + G15-4, puro)

**Qué se dibuja y por qué así.** El sprite de VAULT WORLD CUP no es un cenital puro: la figura «mira» hacia donde apunta su cabeza y las piernas quedan detrás (por eso E es el cuarto de vuelta de N). La red de `sprite-maps.test.ts` exige, para TODA pose y TODO octante, que el centroide del pelo apunte donde dice el octante. Consecuencias de diseño, decididas aquí:
- **TIRÁNDOSE (`POSE_SLIDE`)**: cuerpo estrecho (de lado), un brazo apoyado, **una pierna estirada hasta el borde** y la otra doblada. Como la pierna va DETRÁS de la cabeza, el sprite se dibuja con el octante **contrario** a la dirección de la entrada: la cabeza queda atrás y la pierna estirada delante, que es lo que se ve en una entrada de verdad. Sustituye a la «carrera inclinada» de G15-3, así que **`tilt` y `SLIDE_TILT_*` desaparecen** (el `setTransform` de `drawPlayer` también, Task 5).
- **AMAGO (`POSE_FEINT`)**: cabeza adelantada, brazos abiertos, piernas recogidas — más bajo que de pie, sin tocar el suelo. Sirve para el robo normal (G15-25) **y** para levantarse: los últimos `GETUP_STEPS` de un jugador tumbado (`isPlayerDown`) pasan de `POSE_DOWN` a `POSE_FEINT`.
- **ABRAZO (`POSE_HUG`)**: brazos estirados por delante de la cabeza, rodeando. Es la pose del corro, del goleador y del lanzador de la tanda (Task 4).
- **CABIZBAJO (`POSE_DEJECTED`)**: cabeza hundida entre los hombros (empieza una fila más abajo), brazos colgando. Los rivales tras un gol (Task 4).
- N y NE se dibujan a mano; **E = `rotateMapCW(N)`** para las cuatro (en un cenital tumbado/abrazado el cuarto de vuelta es exacto y legible; las de carrera se dibujaron a mano por las piernas). Validado al escribir el plan: los ocho mapas son 15 × 15, solo usan `.OHKSTF`, y la dirección del pelo es correcta en los ocho octantes derivados.
- **El amago del robo** es un temporizador de pantalla como la estirada del portero (G11-2): `beginStealFeints` lee los eventos del paso y arranca un amago de `FEINT_STEPS` para cada robo **con un rival a tiro** (`ev.kind === 'steal' && ev.victimId >= 0`: `steal()` solo rellena `victimId` cuando el dueño está a menos de `STEAL_RANGE`). Un botón pulsado con nadie cerca no amaga. Medido (semilla 14, dificultad 5): primer robo con rival a tiro en el paso 588, 103 en el partido.

**Files:**
- Modify: `components/games/football-screen/sprite-maps.ts` (comentario de cabecera `:6-11`; `POSE_*` `:39-46`; tras `const E_DIVE_1` `:417-433` los mapas nuevos; `HAND_N/HAND_NE/HAND_E` `:435-437`)
- Modify: `components/games/football-screen/sprite-frame.ts` (imports `:1-6`; cabecera `:8-17`; `SLIDE_TILT_*` `:58-62`; `SpriteChoice`/`createSpriteChoice` `:64-68`; `choosePlayerSprite` `:70-99`)
- Modify: `components/games/football-screen/gestures.ts` (tras `beginGkCatchGestures`, al final)
- Test: `components/games/football-screen/sprite-maps.test.ts` (imports `:3-9`; describe nuevo al final)
- Test: `components/games/football-screen/sprite-frame.test.ts` (imports `:6-13`; los `it` de `choosePlayerSprite` `:101-172`)
- Test: `components/games/football-screen/gestures.test.ts` (imports `:5-8`; describe nuevo al final)
- Test: `components/games/football-screen/view-pipeline.test.ts` (las dos llamadas a `choosePlayerSprite` `:95` y `:168`; los contadores del primer `it`)

**Interfaces:**
- Consumes: `isPlayerDown`, `PLAYER_SPEED` (`players.ts`); `GESTURE_IDLE`, `gestureBegin`, `createGestureTimers` (`gestures.ts`).
- Produces (los consumen las Tasks 4 y 5):
  - `POSE_SLIDE = 7`, `POSE_FEINT = 8`, `POSE_HUG = 9`, `POSE_DEJECTED = 10`, `POSE_COUNT = 11` (`ATLAS_H` = 330).
  - `GETUP_STEPS = 12`; `SpriteChoice = { octant: number; pose: number }` (sin `tilt`).
  - `choosePlayerSprite(p, stepCount, shootout, parked, diveProgress, diveDirX, diveDirY, feintProgress, out): void` — `feintProgress` nuevo, en la posición 8 (antes de `out`).
  - `FEINT_STEPS = 18`; `beginStealFeints(match: MatchState, g: GestureTimers, durationSteps = FEINT_STEPS): number`.
  - Se BORRAN: `SLIDE_TILT_RAD`, `SLIDE_TILT_COS`, `SLIDE_TILT_SIN`, `SpriteChoice.tilt`.

- [ ] **Step 1: Escribir los tests que fallan**

`components/games/football-screen/sprite-maps.test.ts` — añade al import (`:3-9`) `POSE_DEJECTED, POSE_FEINT, POSE_HUG, POSE_SLIDE`, y al final:

```ts
// ── V15-5: the four poses of the show (G15-25 + G15-4) ──────────────────────────
function opaqueRowSpan(map: SpriteMap): number {
  let first = -1;
  let last = -1;
  for (let r = 0; r < map.length; r++) {
    if (!/[^.]/.test(map[r])) continue;
    if (first < 0) first = r;
    last = r;
  }
  return last - first + 1;
}

function firstRowWith(map: SpriteMap, ch: string): number {
  for (let r = 0; r < map.length; r++) if (map[r].includes(ch)) return r;
  return -1;
}

function lastRowWith(map: SpriteMap, ch: string): number {
  let row = -1;
  for (let r = 0; r < map.length; r++) if (map[r].includes(ch)) row = r;
  return row;
}

describe('the V15-5 poses', () => {
  it('the slide lies the whole cell long with a boot at the far end from the hair; the feint crouches shorter than standing (G15-25)', () => {
    const slide = HAND_N[POSE_SLIDE];
    expect(opaqueRowSpan(slide)).toBe(SPRITE_GRID);
    expect(lastRowWith(slide, 'H')).toBeLessThanOrEqual(2);
    expect(lastRowWith(slide, 'F')).toBeGreaterThanOrEqual(SPRITE_GRID - 3);
    expect(opaqueRowSpan(HAND_N[POSE_FEINT])).toBeLessThan(opaqueRowSpan(HAND_N[POSE_IDLE]));
    expect(opaqueRowSpan(HAND_NE[POSE_FEINT])).toBeLessThan(opaqueRowSpan(HAND_NE[POSE_IDLE]));
  });

  it('the hug reaches its arms past the head, and the dejected head sits lower than the standing one (G15-4)', () => {
    for (const set of [HAND_N, HAND_NE]) {
      expect(firstRowWith(set[POSE_HUG], 'K')).toBeLessThan(firstRowWith(set[POSE_HUG], 'H'));
      expect(firstRowWith(set[POSE_IDLE], 'K')).toBeGreaterThan(firstRowWith(set[POSE_IDLE], 'H'));
      expect(firstRowWith(set[POSE_DEJECTED], 'H')).toBeGreaterThan(firstRowWith(set[POSE_IDLE], 'H'));
    }
  });

  it('the E maps of the four new poses are the quarter turn of their N maps', () => {
    for (const pose of [POSE_SLIDE, POSE_FEINT, POSE_HUG, POSE_DEJECTED]) {
      expect(HAND_E[pose]).toEqual(rotateMapCW(HAND_N[pose]));
    }
    expect(POSE_COUNT).toBe(11);
  });
});
```

`components/games/football-screen/sprite-frame.test.ts` — el import de `./sprite-maps` (`:6-9`) añade `POSE_FEINT, POSE_SLIDE`; el de `./sprite-frame` (`:10-13`) pasa a:

```ts
import {
  GETUP_STEPS, OCTANT_TAN, RUN_FRAME_STEPS, SPRINT_FRAME_STEPS,
  choosePlayerSprite, createSpriteChoice, diveSpritePose, facingOctant, runPose,
} from './sprite-frame';
```

En el `describe('choosePlayerSprite'` (`:101-172`): **todas** las llamadas `choosePlayerSprite(p, N, a, b, X, dx, dy, out)` ganan `GESTURE_IDLE` como octavo argumento (`…, dx, dy, GESTURE_IDLE, out)`) — son seis llamadas fuera del `it` del slide (portero 1, aparcado 1, tumbado 2, «writes in place» 2); se borran las dos líneas `expect(out.tilt).toBe(0);` de los `it` del portero y del aparcado (`:109`, `:119`) y el `it('draws a slide as the run sprite tilted…'` (`:134-153`) se **sustituye** por:

```ts
  it('draws the slide as the lying SLIDE pose with the head TRAILING, so the stretched leg leads the tackle (G15-25)', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.facingX = 1;
    p.facingY = 0;
    p.tackleStepsLeft = 10;
    p.tackleDirX = -1;
    p.tackleDirY = 0;
    choosePlayerSprite(p, 100, false, false, GESTURE_IDLE, 0, 0, GESTURE_IDLE, out);
    expect(out.pose).toBe(POSE_SLIDE);
    expect(out.octant).toBe(OCTANT_E);   // sliding west: head east, leg west
    p.tackleDirX = 0;
    p.tackleDirY = 1;
    choosePlayerSprite(p, 100, false, false, GESTURE_IDLE, 0, 0, GESTURE_IDLE, out);
    expect(out.octant).toBe(OCTANT_N);   // sliding south: head north
    choosePlayerSprite(p, 100, true, false, GESTURE_IDLE, 0, 0, GESTURE_IDLE, out);
    expect(out.pose).not.toBe(POSE_SLIDE);   // never in the shootout
  });
```

y se añaden, al final del mismo `describe`:

```ts
  it('gets up through the FEINT crouch in the last GETUP_STEPS of being down (G15-25: "y luego se levanta")', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.downUntilStep = 100 + GETUP_STEPS;
    choosePlayerSprite(p, 100, false, false, GESTURE_IDLE, 0, 0, GESTURE_IDLE, out);
    expect(out.pose).toBe(POSE_FEINT);
    choosePlayerSprite(p, 99, false, false, GESTURE_IDLE, 0, 0, GESTURE_IDLE, out);
    expect(out.pose).toBe(POSE_DOWN);
    choosePlayerSprite(p, 100 + GETUP_STEPS, false, false, GESTURE_IDLE, 0, 0, GESTURE_IDLE, out);
    expect(out.pose).toBe(POSE_IDLE);    // up, standing still
    expect(GETUP_STEPS).toBeLessThan(60); // inside TACKLE_MISS_DOWN_STEPS (1 s)
  });

  it('a steal feint shows the FEINT pose the way the player faces, but the dive, the floor and the slide all win over it', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.facingX = 0;
    p.facingY = -1;
    choosePlayerSprite(p, 100, false, false, GESTURE_IDLE, 0, 0, 0.3, out);
    expect([out.pose, out.octant]).toEqual([POSE_FEINT, OCTANT_N]);
    choosePlayerSprite(p, 100, false, true, GESTURE_IDLE, 0, 0, 0.3, out);
    expect(out.pose).toBe(POSE_IDLE);    // parked in the shootout
    p.tackleStepsLeft = 5;
    p.tackleDirX = 1;
    choosePlayerSprite(p, 100, false, false, GESTURE_IDLE, 0, 0, 0.3, out);
    expect(out.pose).toBe(POSE_SLIDE);
    choosePlayerSprite(p, 100, false, false, 0.3, 1, 0, 0.3, out);
    expect(out.pose).not.toBe(POSE_FEINT); // a dive (keeper gesture) wins
  });
```

`components/games/football-screen/gestures.test.ts` — el import de `./gestures` (`:5-8`) añade `FEINT_STEPS, beginStealFeints`; el de `../football-logic/match` (`:2`) añade `createMatch`; el de `../football-logic/teams` (`:3`) añade `FORMATIONS`; y dos imports nuevos: `import { PITCH } from '../football-logic/pitch';` y `import { humanProfile, profileFor } from '../football-logic/ai';` (una sola línea por módulo: nada de dos imports del mismo fichero). Al final:

```ts
// ── G15-25: the steal that only feints ─────────────────────────────────────────
describe('beginStealFeints', () => {
  it('starts a feint for a steal with a rival in reach, read on its step, and none for a press with nobody near', () => {
    // MEASURED 06-oct: CPU v CPU, seed 14, difficulty 5 -- the first steal with a rival in
    // reach is on step 588 (103 in the match).
    const run = createMatchRun(ESP, ITA, 14, 5, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const g = createGestureTimers();
    let actor = -1;
    for (let i = 0; i < 3000 && actor < 0; i++) {
      stepMatchRun(run);
      const started = beginStealFeints(m, g);
      if (started === 0) continue;
      for (const ev of m.scratch.events) if (ev.kind === 'steal' && ev.victimId >= 0) actor = ev.actorId;
    }
    expect(actor).toBeGreaterThanOrEqual(0);
    expect(gestureProgress(g, actor, m.stepCount)).toBe(0);
    expect(gestureProgress(g, actor, m.stepCount + FEINT_STEPS)).toBe(GESTURE_IDLE);

    // A steal pressed with no owner in reach: steal() stamps the event but no victim.
    const quiet = createMatch([ESP, ITA], FORMATIONS, PITCH, [humanProfile(ESP, 5), profileFor(ITA, 5)]);
    const q = createGestureTimers();
    const ev = quiet.scratch.events[3];
    ev.kind = 'steal';
    ev.actorId = 3;
    ev.victimId = -1;
    expect(beginStealFeints(quiet, q)).toBe(0);
    expect(gestureProgress(q, 3, quiet.stepCount)).toBe(GESTURE_IDLE);
  });
});
```

`components/games/football-screen/view-pipeline.test.ts`: las dos llamadas (`:95` y `:168`) ganan `GESTURE_IDLE` antes de `choice` (`…, gestures.dirY[p.id], GESTURE_IDLE, choice);`). En el primer `it`, junto a los contadores (`let idleSeen = 0;` etc.), declara `let slideSeen = 0;` y `let getUpSeen = 0;`; dentro del bucle, junto a `if (choice.pose === POSE_DIVE_1) diveFullSeen++;`, añade `if (choice.pose === POSE_SLIDE) slideSeen++;` y `if (choice.pose === POSE_FEINT) getUpSeen++;`; y junto a `expect(diveFullSeen).toBeGreaterThan(0);`, `expect(slideSeen).toBeGreaterThan(0);` y `expect(getUpSeen).toBeGreaterThan(0);` (sin amago de robo en este probe — se pasa `GESTURE_IDLE` — así que cada `POSE_FEINT` visto es un jugador levantándose tras una entrada). Importa `POSE_FEINT, POSE_SLIDE` de `./sprite-maps`. **No es un test nuevo**: refuerza el probe de pipeline que ya recorre partidos enteros.

- [ ] **Step 2: Verlos fallar**

Run: `npx vitest run components/games/football-screen/sprite-maps.test.ts components/games/football-screen/sprite-frame.test.ts components/games/football-screen/gestures.test.ts components/games/football-screen/view-pipeline.test.ts`
Expected: FAIL — `sprite-maps.test.ts` con `expected undefined to be 15`/`Cannot read properties of undefined` (`HAND_N[POSE_SLIDE]` no existe; `POSE_SLIDE` es `undefined`), `sprite-frame.test.ts` por `TypeError: Cannot create property 'tilt' on number '-1'` (M1, medido en el pre-vuelo: las llamadas ganan `GESTURE_IDLE` como octavo argumento y la función de hoy toma ese `-1` por el objeto `out`; no es un fallo de import), `view-pipeline.test.ts` por las aserciones nuevas `slideSeen`/`getUpSeen` (`POSE_SLIDE` y `POSE_FEINT` son `undefined`; no medido por separado), `gestures.test.ts` por `beginStealFeints is not a function`. Vitest no tumba la carga por un export que falta: resuelve `undefined` y falla test a test.

- [ ] **Step 3: Implementar**

**`sprite-maps.ts`.** En el comentario de cabecera, tras `…W = mirror(E), NW = mirror(NE).` añade: `// V15-5: the four poses of the show (slide, feint, hug, dejected) draw N and NE by hand; their E is rotateMapCW(N) -- a figure lying down or hugging reads the same turned a quarter, unlike the run frames, whose legs were drawn per side.` Las constantes de pose (`:39-46`) pasan a:

```ts
export const POSE_IDLE = 0;
export const POSE_RUN_0 = 1;
export const POSE_RUN_1 = 2;
export const POSE_RUN_2 = 3;
export const POSE_DOWN = 4;
export const POSE_DIVE_0 = 5;
export const POSE_DIVE_1 = 6;
// V15-5: G15-25 (the slide, the feint/getting up) and G15-4 (the hug, the hung heads).
export const POSE_SLIDE = 7;
export const POSE_FEINT = 8;
export const POSE_HUG = 9;
export const POSE_DEJECTED = 10;
export const POSE_COUNT = 11;
```
Y `export const ATLAS_H = POSE_COUNT * SPRITE_SIZE; // 210` (`:61`) pasa a `// 330` (M4: el comentario con el número viejo se quedaba torcido; el valor sale solo de `POSE_COUNT`).

Tras `const E_DIVE_1: SpriteMap = [ … ];` (y antes de `export const HAND_N`):

```ts
// ── V15-5. G15-25: lying on his side, one leg stretched to the edge of the cell, the
// other bent, an arm on the ground. The leg is BEHIND the head (the head leads, as in
// every map), so choosePlayerSprite draws it with the octant OPPOSITE to the tackle.
const N_SLIDE: SpriteMap = [
  '......OOO......',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '..OOOOTTTOO....',
  '.OKKKSSSSSO....',
  '..OOOSSSSSO....',
  '.....OSSSO.....',
  '.....OSSSO.....',
  '.....OTTTO.....',
  '.....OTTOKKOO..',
  '.....OKKOOKKFO.',
  '.....OKKO.OOO..',
  '.....OKKO......',
  '.....OFFO......',
  '......OO.......',
];
const NE_SLIDE: SpriteMap = [
  '..........OOO..',
  '.........OHHHO.',
  '........OHHHO..',
  '......OOTTTO...',
  '..OKKOSSSSSO...',
  '...OOSSSSSO....',
  '.....OSSSO.....',
  '....OTTTTO.....',
  '...OTTOOKKO....',
  '..OKKO.OKKFO...',
  '..OKKO..OOO....',
  '.OKKO..........',
  '.OKKO..........',
  'OFFO...........',
  'OO.............',
];
// G15-25: the steal that only feints, and the crouch of getting up -- head forward,
// arms out, legs gathered: lower than standing, never on the ground.
const N_FEINT: SpriteMap = [
  '......OOO......',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '..OOOOTTTOOOO..',
  '.OKSSSSSSSSSKO.',
  '.OKOSSSSSSSOKO.',
  '..O.OSSSSSO.O..',
  '....OSSSSSO....',
  '....OTTOTTO....',
  '....OKKOKKO....',
  '....OFFOFFO....',
  '.....OO.OO.....',
  '...............',
  '...............',
  '...............',
];
const NE_FEINT: SpriteMap = [
  '..........OOO..',
  '........OHHHO..',
  '........OHHHO..',
  '.....OOOTTTOOOO',
  '...OKSSSSSSSSKO',
  '..OKOSSSSSSSOO.',
  '...OSSSSSSSO...',
  '...OSSSSSSO....',
  '...OTTOTTO.....',
  '...OKKOKKO.....',
  '..OFFOFFO......',
  '..OO.OO........',
  '...............',
  '...............',
  '...............',
];
// G15-4: the hug -- both arms reaching past the head, round a team-mate.
const N_HUG: SpriteMap = [
  '..OO.......OO..',
  '.OKKO.OOO.OKKO.',
  '.OKKOOHHHOOKKO.',
  '..OKOOHHHOOKO..',
  '..OKOOHHHOOKO..',
  '...OOOTTTOOO...',
  '...OSSSSSSSO...',
  '...OSSSSSSSO...',
  '...OSSSSSSSO...',
  '....OSSSSSO....',
  '....OTTOTTO....',
  '....OKKOKKO....',
  '....OKKOKKO....',
  '....OFFOFFO....',
  '.....OO.OO.....',
];
const NE_HUG: SpriteMap = [
  '.......OO......',
  '......OKKO.OOO.',
  '.....OKKOOHHHO.',
  '.....OKOOHHHOO.',
  '......OOHHHOKKO',
  '....OOOTTTOOKKO',
  '..OSSSSSSSSOOO.',
  '..OSSSSSSSSO...',
  '..OSSSSSSSO....',
  '..OSSSSSSO.....',
  '..OTTOTTO......',
  '..OKKOKKO......',
  '..OKKOKKO......',
  '.OFFOFFO.......',
  '.OO.OO.........',
];
// G15-4: "rivales cabeza gacha" -- the head sunk between the shoulders, arms hanging.
const N_DEJECTED: SpriteMap = [
  '...............',
  '...............',
  '......OOO......',
  '.....OHHHO.....',
  '....OOHHHOO....',
  '...OOOTTTOOO...',
  '...OSSSSSSSO...',
  '...OKSSSSSKO...',
  '...OKSSSSSKO...',
  '...OKSSSSSKO...',
  '....OTTOTTO....',
  '....OKKOKKO....',
  '....OKKOKKO....',
  '....OFFOFFO....',
  '.....OO.OO.....',
];
const NE_DEJECTED: SpriteMap = [
  '...............',
  '...............',
  '.........OOO...',
  '........OHHHO..',
  '.......OOHHHOO.',
  '....OOOOTTTOO..',
  '...OSSSSSSSSO..',
  '...OKSSSSSSKO..',
  '...OKSSSSSSKO..',
  '..OSSSSSSSO....',
  '..OTTOTTO......',
  '..OKKOKKO......',
  '..OKKOKKO......',
  '.OFFOFFO.......',
  '.OO.OO.........',
];
// rotateMapCW is a function declaration further down: hoisted, so callable here, at load.
const E_SLIDE: SpriteMap = rotateMapCW(N_SLIDE);
const E_FEINT: SpriteMap = rotateMapCW(N_FEINT);
const E_HUG: SpriteMap = rotateMapCW(N_HUG);
const E_DEJECTED: SpriteMap = rotateMapCW(N_DEJECTED);
```

y las tres tablas (`:435-437`) pasan a:

```ts
export const HAND_N: readonly SpriteMap[] = [
  N_IDLE, N_RUN_0, N_RUN_1, N_RUN_2, N_DOWN, N_DIVE_0, N_DIVE_1, N_SLIDE, N_FEINT, N_HUG, N_DEJECTED,
];
export const HAND_NE: readonly SpriteMap[] = [
  NE_IDLE, NE_RUN_0, NE_RUN_1, NE_RUN_2, NE_DOWN, NE_DIVE_0, NE_DIVE_1, NE_SLIDE, NE_FEINT, NE_HUG, NE_DEJECTED,
];
export const HAND_E: readonly SpriteMap[] = [
  E_IDLE, E_RUN_0, E_RUN_1, E_RUN_2, E_DOWN, E_DIVE_0, E_DIVE_1, E_SLIDE, E_FEINT, E_HUG, E_DEJECTED,
];
```

**`sprite-frame.ts`.** Imports (`:1-6`): añade `POSE_FEINT, POSE_SLIDE` al de `./sprite-maps`. En la cabecera, el párrafo `// The priorities copy the exclusions drawPlayer already had …` (`:14-17`, hasta `then running or standing still.`) se sustituye por estas líneas exactas (M4: antes solo estaba en prosa y la cabecera quedaba desfasada):

```ts
// The priorities copy the exclusions drawPlayer already had (stage B2 §8 and its
// Minor 2): a diving keeper first, then the parked nineteen of the shootout (standing,
// whatever the engine left in their slide/floor fields), then lying down -- getting up
// through the FEINT crouch in its last GETUP_STEPS -- (never during the shootout, taker
// included), then sliding (G15-25: lying on its side, head trailing), then a steal
// feint, then running or standing still.
``` Borra el bloque `SLIDE_TILT_RAD/COS/SIN` y su comentario (`:58-62`). Sustituye `SpriteChoice`, `createSpriteChoice` y `choosePlayerSprite` (`:64-99`) por:

```ts
// G15-25: the last steps of lying down show the FEINT crouch -- "y luego se levanta".
// TACKLE_MISS_DOWN_STEPS is 60; 12 is a fifth of a second.
export const GETUP_STEPS = 12;

export type SpriteChoice = { octant: number; pose: number };

export function createSpriteChoice(): SpriteChoice {
  return { octant: OCTANT_E, pose: POSE_IDLE };
}

// diveProgress: gestureProgress(...) for a keeper, GESTURE_IDLE for everybody else.
// diveDirX/diveDirY: gestures.dirX/dirY of that player (read only while diving).
// feintProgress (G15-25): the steal feint's gestureProgress for an outfield player,
// GESTURE_IDLE otherwise.
export function choosePlayerSprite(
  p: PlayerState, stepCount: number, shootout: boolean, parked: boolean,
  diveProgress: number, diveDirX: number, diveDirY: number, feintProgress: number, out: SpriteChoice,
): void {
  if (diveProgress !== GESTURE_IDLE) {
    out.octant = facingOctant(diveDirX, diveDirY);
    out.pose = diveSpritePose(diveProgress);
    return;
  }
  out.octant = facingOctant(p.facingX, p.facingY);
  if (parked) {
    out.pose = POSE_IDLE;
    return;
  }
  if (!shootout && isPlayerDown(p, stepCount)) {
    out.pose = p.downUntilStep - stepCount <= GETUP_STEPS ? POSE_FEINT : POSE_DOWN;
    return;
  }
  if (!shootout && p.tackleStepsLeft > 0) {
    // G15-25: the head trails and the stretched leg leads, so the octant is the
    // opposite of the tackle's direction.
    out.octant = facingOctant(-p.tackleDirX, -p.tackleDirY);
    out.pose = POSE_SLIDE;
    return;
  }
  if (feintProgress !== GESTURE_IDLE) {
    out.pose = POSE_FEINT;
    return;
  }
  out.pose = runPose(stepCount, p.id, p.vx, p.vy);
}
```

**`gestures.ts`.** Al final:

```ts
// G15-25: "el robo normal solo amaga". steal() (actions.ts) stamps an ActionEvent of kind
// 'steal' on EVERY press, but fills victimId only when the owner is within STEAL_RANGE:
// that is the feint -- a lunge at somebody -- and a press with nobody near is not. Read
// after EVERY step, like the dive (the events are swept at the top of the next stepMatch).
// A screen timer in its own GestureTimers (the component keeps it apart from the dives).
export const FEINT_STEPS = 18;   // 0.3 s

export function beginStealFeints(match: MatchState, g: GestureTimers, durationSteps = FEINT_STEPS): number {
  const events = match.scratch.events;
  let started = 0;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.kind !== 'steal' || ev.victimId < 0) continue;
    const id = ev.actorId;
    if (id < 0 || id >= g.count) continue;
    gestureBegin(g, id, match.stepCount, durationSteps, 0, 0);
    started++;
  }
  return started;
}
```

- [ ] **Step 4: Verlos pasar**

Run: `npx vitest run components/games/football-screen/sprite-maps.test.ts components/games/football-screen/sprite-frame.test.ts components/games/football-screen/gestures.test.ts components/games/football-screen/view-pipeline.test.ts`
Expected: PASS, los cuatro ficheros enteros — incluidos los `it` existentes de `sprite-maps.test.ts` que ahora recorren once poses (la dirección del pelo en los ocho octantes, pelo/camiseta/ribete en todas, el verde del portero en todas, el horneado celda a celda en 240 × 330).

- [ ] **Step 5: Controles negativos (ejecutar y REVERTIR cada uno)**

1. `HAND_N[POSE_SLIDE]` = `N_IDLE` → FALLA `the slide lies the whole cell long…` (`expected 14 to be 15`).
2. `N_DEJECTED` con la cabeza en las filas 1-4 (copia `N_IDLE`) → FALLA `the hug reaches…` (`expected 2 to be greater than 2`).
3. `E_HUG` = `E_IDLE` → FALLA `the E maps…` y además `points the head where the octant says` sigue verde (por eso hace falta el test nuevo).
4. En `choosePlayerSprite`, octante del slide con `facingOctant(p.tackleDirX, p.tackleDirY)` → FALLA el `it` del slide (`expected 4 to be 0`, OCTANT_W en vez de OCTANT_E).
5. Sin la rama de levantarse (siempre `POSE_DOWN`) → FALLA `gets up through the FEINT crouch…` (`expected 4 to be 8`) **y** `view-pipeline` (`getUpSeen: expected 0 to be greater than 0`).
6. `beginStealFeints` sin `|| ev.victimId < 0` → FALLA el bloque `quiet` (`expected 1 to be +0`).

- [ ] **Step 6: Compuertas**

```bash
npx vitest run
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "VaultWorldCupGame.tsx"
npx eslint components/games/football-screen/sprite-maps.ts components/games/football-screen/sprite-frame.ts components/games/football-screen/gestures.ts components/games/football-screen/sprite-maps.test.ts components/games/football-screen/sprite-frame.test.ts components/games/football-screen/gestures.test.ts components/games/football-screen/view-pipeline.test.ts
git diff --name-only 77aecd7 -- components/games/football-logic/ | sort
grep -rn "Math\.random(" components/games/football-logic/ components/games/football-screen/
grep -rn "SLIDE_TILT\|\.tilt" components/games/football-screen/
```
Expected: **1533 tests en 90 ficheros** (1527 + 3 + 2 + 1; el slide sustituido no suma); `tsc`: **5** errores, el segundo `grep` **vacío** (los cinco son los declarados de `VaultWorldCupGame.tsx`, los cierra la Task 5); `eslint` sin salida; el motor, las tres líneas; `Math.random` y `SLIDE_TILT`, vacíos.

- [ ] **Step 7: Ledger**

`Task V15-5-3: POSE_SLIDE/FEINT/HUG/DEJECTED (atlas 240×330), slide con cabeza detrás, levantarse por FEINT, beginStealFeints (victimId>=0); tilt fuera; 1533 / 90; tsc 5 errores declarados en el .tsx (cierra T5); 6 controles revertidos.`

---

### Task V15-5-4: la celebración del gol — carrera al goleador, corro, cabezas gachas; la tanda, solo el lanzador (G15-4, puro)

**Cómo funciona sin tocar el motor.** Durante la fase `'goal'` el motor NO mueve a nadie (`stepMatch` solo descuenta `pauseStepsLeft`, 240 pasos), y tras un gol de oro el partido está en `'over'` y tampoco se mueve. Así que la celebración es **una posición dibujada distinta de la del motor**: cada compañero sale de donde estaba cuando se marcó y corre en línea recta, a `HUG_RUN_SPEED` (`PLAYER_SPEED` por paso = 3 u/paso = 180 u/s: la carrera normal, no un sprint —D5, resuelta por Paco: «trotando»—), hacia su hueco del corro alrededor del goleador; al llegar se abraza mirando al centro. Los rivales se quedan donde están, cabizbajos; el goleador y el portero del equipo que marca celebran en su sitio. Nada se escribe en el motor: `celebrationView` devuelve posición, pose y octante en un objeto de salida creado una vez.

**La tanda (medido, ver Lección 1):** en el MISMO paso del gol el motor ya ha puesto al siguiente lanzador en el punto (en la otra portería) y ha mandado al goleador al círculo central, y la cámara (que en la tanda se centra en el punto del penalti) cortaría a la otra punta. Para que «en la tanda solo celebra el lanzador» se vea, la celebración de la tanda (1) dibuja al lanzador **donde tiró** — su posición antes del paso, de `capturePreStep` — y (2) **sujeta la cámara** en ese punto `SHOOTOUT_HOLD_STEPS` pasos: **1 s = 60 pasos** (D1, resuelta por Paco 06-oct), que es también lo que dura el rótulo GOL de la tanda (la Task 2 lo baja de 1,5 a 1 s; la cámara y el rótulo cortan a la vez). Lo que cuesta —1 s de los 5 s de cuenta atrás del siguiente lanzador, que ve la otra portería— se juzga en el QA (4.5).

**El gol en propia (D2, resuelta por Paco 06-oct):** no hay goleador del equipo que marca; el corro se forma alrededor de SU jugador de campo activo más cercano al balón (`goalHubId`), y el rótulo es «GOL» + «EN PROPIA · \<defensa\>» (Task 2 y Task 5).

**Lo que se mide y no se decide:** con los partidos medidos al escribir el plan (semillas 11, 14 y 23, dificultad 8), los compañeros quedan a 21-1 277 u del goleador. A 180 u/s en 4 s llegan los que están a menos de ~700 u (la cifra «4-6 de 9» se midió a 240 u/s y ya no vale: llegan menos); los demás siguen corriendo —a ritmo normal— cuando el saque los recoloca de golpe, igual que hoy. D5, resuelta por Paco: «los cercanos llegan al corro; los demás se acercan trotando sin llegar». Se juzga en el QA (4.2).

**Files:**
- Create: `components/games/football-screen/celebration.ts`
- Test: `components/games/football-screen/celebration.test.ts` (nuevo)

**Interfaces:**
- Consumes: `GOAL_PAUSE_STEPS`, `MatchPhase`, `MatchState` (`match.ts`); `isActive` (`discipline.ts`); `STEPS_PER_SECOND` (`clock.ts`); `TEAM_SIZE`; `CAPTION_STEPS`, `MatchWatch`, `goalScoredThisStep` (Task 2); `facingOctant`, `runPose` (`sprite-frame.ts`); `POSE_HUG`, `POSE_DEJECTED` (Task 3).
- Produces (los consume la Task 5):
  - `CELEBRATION_STEPS` (= `GOAL_PAUSE_STEPS`, 240), `SHOOTOUT_HOLD_STEPS` (= `CAPTION_STEPS['shootout-goal']`, 60: 1 s, D1), `HUG_RUN_SPEED` (= `perStep(PLAYER_SPEED)`, 3 u/paso: carrera normal, D5), `HUG_RING_SLOTS` (10).
  - `type Celebration`, `type PreStep`, `type CelebrationView = { x: number; y: number; octant: number; pose: number }`.
  - `createCelebration(count?)`, `createPreStep()`, `createCelebrationView()`, `resetCelebration(c)`.
  - `capturePreStep(match, out): void` — ANTES de `stepMatchRun`.
  - `goalHubId(match, team): number`.
  - `beginCelebrationForGoal(c, match, w, team, pre): void` — en el paso del gol, con el `watch` todavía del paso anterior.
  - `stepCelebration(c, phase): void` — una vez por paso simulado (y por paso de solo-rótulos en `'over'`).
  - `celebrationHoldsCamera(c): boolean`, `celebrationView(c, p, out): boolean`; `c.camX/c.camY` (punto donde se sujeta la cámara) y `c.hubId`.

- [ ] **Step 1: Escribir los tests que fallan**

Crea `components/games/football-screen/celebration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { humanProfile, profileFor } from '../football-logic/ai';
import { STEPS_PER_SECOND } from '../football-logic/clock';
import { GOAL_PAUSE_STEPS, NORMAL_RULES, createMatch, type MatchState } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { PLAYER_SPEED } from '../football-logic/players';
import { shootoutTakerId } from '../football-logic/set-pieces';
import { FORMATIONS, TEAMS, TEAM_SIZE } from '../football-logic/teams';
import {
  CAPTION_STEPS, collectCaptions, createCaptionState, createMatchWatch, goalScoredThisStep, updateWatch, type MatchWatch,
} from './captions';
import {
  CELEBRATION_STEPS, HUG_RING_SLOTS, HUG_RUN_SPEED, SHOOTOUT_HOLD_STEPS, beginCelebrationForGoal, capturePreStep,
  celebrationHoldsCamera, celebrationView, createCelebration, createCelebrationView, createPreStep, goalHubId,
  resetCelebration, stepCelebration,
} from './celebration';
import { createMatchRun, stepMatchRun } from './match-run';
import { RUN_FAST_SPEED_SQ, facingOctant } from './sprite-frame';
import { POSE_DEJECTED, POSE_HUG } from './sprite-maps';

function newMatch(): MatchState {
  return createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [humanProfile(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
}

// A watch that has seen the match once, in open play: what runStep holds on a goal step.
function watching(m: MatchState): MatchWatch {
  const w = createMatchWatch();
  collectCaptions(m, w, 0, createCaptionState());
  updateWatch(m, w);
  w.phase = 'play';
  return w;
}

// Team 1 scores through its forward TEAM_SIZE + 9, from the kickoff positions.
function goalByTeam1(m: MatchState): number {
  const scorer = m.players[TEAM_SIZE + 9];
  m.ball.lastTouchId = scorer.id;
  m.score[1] = 1;
  m.phase = 'goal';
  return scorer.id;
}

describe('the hub of the hug', () => {
  it('goalHubId: the scorer; for an own goal the scoring team\'s active outfielder nearest the ball', () => {
    const m = newMatch();
    const scorer = goalByTeam1(m);
    expect(goalHubId(m, 1)).toBe(scorer);
    m.ball.lastTouchId = 3;            // a team-0 defender: own goal
    m.ball.x = 2100;
    m.ball.y = 700;
    const near = m.players[TEAM_SIZE + 4];
    near.x = 2090;
    near.y = 705;
    expect(goalHubId(m, 1)).toBe(near.id);
    near.sentOff = true;               // nobody who left the pitch hosts it
    expect(goalHubId(m, 1)).not.toBe(near.id);
    expect(m.players[goalHubId(m, 1)].team).toBe(1);
  });
});

describe('beginCelebrationForGoal / celebrationView (G15-4)', () => {
  it('gives the ring slots nearest first to the scoring team\'s active outfielders, and to nobody else', () => {
    const m = newMatch();
    const w = watching(m);
    const hub = m.players[goalByTeam1(m)];
    m.players[TEAM_SIZE + 2].sentOff = true;
    const c = createCelebration();
    beginCelebrationForGoal(c, m, w, 1, createPreStep());
    expect([c.kind, c.hubId]).toEqual(['goal', hub.id]);
    let last = -1;
    let slots = 0;
    for (let k = 0; k < HUG_RING_SLOTS; k++) {
      const id = c.slot.indexOf(k);
      if (id < 0) break;
      const p = m.players[id];
      expect([p.team, p.role === 'gk', id === hub.id]).toEqual([1, false, false]);
      const d = Math.hypot(p.x - hub.x, p.y - hub.y);
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
      slots++;
    }
    expect(slots).toBe(TEAM_SIZE - 3);   // eleven minus the keeper, the hub and the one sent off
    for (let i = 0; i < TEAM_SIZE; i++) expect(c.slot[i]).toBe(-1);
    expect([c.slot[TEAM_SIZE], c.slot[TEAM_SIZE + 2]]).toEqual([-1, -1]);
  });

  it('a team-mate runs at HUG_RUN_SPEED (the normal run, not the sprint) straight to his slot, then hugs facing the hub; the engine is never written', () => {
    const m = newMatch();
    const w = watching(m);
    const hub = m.players[goalByTeam1(m)];
    const c = createCelebration();
    const view = createCelebrationView();
    beginCelebrationForGoal(c, m, w, 1, createPreStep());
    const mate = m.players[c.slot.indexOf(0)];
    const sx = mate.x;
    const sy = mate.y;
    expect(Math.hypot(sx - hub.x, sy - hub.y)).toBeGreaterThan(4 * HUG_RUN_SPEED);
    // D5 (Paco, "trotando"): the team-mates run at the NORMAL run speed, never the sprint.
    expect(HUG_RUN_SPEED * STEPS_PER_SECOND).toBe(PLAYER_SPEED);
    expect((HUG_RUN_SPEED * STEPS_PER_SECOND) ** 2).toBeLessThan(RUN_FAST_SPEED_SQ);   // run frames, not sprint frames
    stepCelebration(c, 'goal');
    stepCelebration(c, 'goal');
    expect(celebrationView(c, mate, view)).toBe(true);
    expect(Math.hypot(view.x - sx, view.y - sy)).toBeCloseTo(2 * HUG_RUN_SPEED, 3);
    expect(view.pose).not.toBe(POSE_HUG);
    expect([mate.x, mate.y]).toEqual([sx, sy]);
    while (c.kind !== 'none' && view.pose !== POSE_HUG) {
      stepCelebration(c, 'goal');
      celebrationView(c, mate, view);
    }
    expect(view.pose).toBe(POSE_HUG);
    expect(Math.hypot(view.x - hub.x, view.y - hub.y)).toBeLessThan(40);
    expect(view.octant).toBe(facingOctant(hub.x - view.x, hub.y - view.y));
  });

  it('rivals hang their heads where they stand; the hub and the scoring keeper celebrate in place; nothing after a reset', () => {
    const m = newMatch();
    const w = watching(m);
    const hub = m.players[goalByTeam1(m)];
    const c = createCelebration();
    const view = createCelebrationView();
    beginCelebrationForGoal(c, m, w, 1, createPreStep());
    const rival = m.players[4];
    expect(celebrationView(c, rival, view)).toBe(true);
    expect([view.x, view.y, view.pose, view.octant])
      .toEqual([rival.x, rival.y, POSE_DEJECTED, facingOctant(rival.facingX, rival.facingY)]);
    const keeper = m.players[TEAM_SIZE];
    celebrationView(c, keeper, view);
    expect([view.x, view.y, view.pose]).toEqual([keeper.x, keeper.y, POSE_HUG]);
    celebrationView(c, hub, view);
    expect([view.x, view.y, view.pose]).toEqual([hub.x, hub.y, POSE_HUG]);
    resetCelebration(c);
    expect(celebrationView(c, rival, view)).toBe(false);
  });

  it('stepCelebration: a goal lasts its pause and the kickoff ends it; a golden goal runs CELEBRATION_STEPS in over; the shootout SHOOTOUT_HOLD_STEPS (1 s)', () => {
    expect(CELEBRATION_STEPS).toBe(GOAL_PAUSE_STEPS);
    // D1 (Paco, 06-oct): the camera holds ONE second, and the GOL caption of the shootout lasts the same.
    expect(SHOOTOUT_HOLD_STEPS).toBe(STEPS_PER_SECOND);
    expect(SHOOTOUT_HOLD_STEPS).toBe(CAPTION_STEPS['shootout-goal']);
    const m = newMatch();
    const w = watching(m);
    goalByTeam1(m);
    const c = createCelebration();
    beginCelebrationForGoal(c, m, w, 1, createPreStep());
    let live = 0;
    for (let i = 0; i < GOAL_PAUSE_STEPS * 2 && c.kind !== 'none'; i++) {
      stepCelebration(c, 'goal');
      live++;
    }
    expect(live).toBe(CELEBRATION_STEPS);
    beginCelebrationForGoal(c, m, w, 1, createPreStep());
    stepCelebration(c, 'goal');
    stepCelebration(c, 'kickoff');
    expect(c.kind).toBe('none');
    beginCelebrationForGoal(c, m, w, 1, createPreStep());
    for (let i = 0; i < CELEBRATION_STEPS - 1; i++) stepCelebration(c, 'over');
    expect(c.kind).toBe('goal');
    stepCelebration(c, 'over');
    expect(c.kind).toBe('none');
    w.phase = 'shootout';
    const pre = createPreStep();
    pre.takerId = 4;
    beginCelebrationForGoal(c, m, w, 0, pre);
    for (let i = 0; i < SHOOTOUT_HOLD_STEPS - 1; i++) stepCelebration(c, 'shootout');
    expect(c.kind).toBe('shootout');
    stepCelebration(c, 'shootout');
    expect(c.kind).toBe('none');
  });

  it('the shootout: only the man who took the kick celebrates, where he took it, and the camera holds on that spot', () => {
    const m = newMatch();
    const w = watching(m);
    w.phase = 'shootout';
    const pre = createPreStep();
    pre.takerId = 4;
    pre.takerX = 249;
    pre.takerY = 715;
    pre.spotX = 231;
    pre.spotY = 715;
    m.players[4].x = 980;              // the engine already parked him in the centre circle
    const c = createCelebration();
    const view = createCelebrationView();
    beginCelebrationForGoal(c, m, w, 0, pre);
    expect([c.kind, celebrationHoldsCamera(c), c.camX, c.camY]).toEqual(['shootout', true, 231, 715]);
    expect(celebrationView(c, m.players[4], view)).toBe(true);
    expect([view.x, view.y, view.pose, view.octant]).toEqual([249, 715, POSE_HUG, facingOctant(-1, 0)]);
    expect(celebrationView(c, m.players[5], view)).toBe(false);
    expect(celebrationView(c, m.players[TEAM_SIZE + 4], view)).toBe(false);
    pre.takerId = -1;
    beginCelebrationForGoal(c, m, w, 0, pre);
    expect([c.kind, celebrationHoldsCamera(c)]).toEqual(['none', false]);
  });
});

describe('the celebration against real matches, read step by step', () => {
  // MEASURED 06-oct: CPU v CPU, seed 14, difficulty 8, ESPAÑA v ITALIA: first goal on step
  // 9765, team 1, nearest team-mate 34 u from the scorer.
  it('a real goal (seed 14, difficulty 8): begun on the goal step, the nearest team-mate is hugging before the kickoff, and the kickoff ends it', () => {
    const run = createMatchRun(TEAMS[0], TEAMS[1], 14, 8, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const w = createMatchWatch();
    const c = createCelebration();
    const pre = createPreStep();
    const view = createCelebrationView();
    collectCaptions(m, w, 'none', createCaptionState());
    updateWatch(m, w);
    let begun = -1;
    let live = 0;
    let hugged = false;
    let endedAtKickoff = false;
    for (let i = 0; i < 20_000 && m.phase !== 'over'; i++) {
      capturePreStep(m, pre);
      stepMatchRun(run);
      const was = c.kind;
      stepCelebration(c, m.phase);
      if (was === 'goal' && c.kind === 'none') {
        endedAtKickoff = m.phase === 'kickoff';
        break;
      }
      const team = goalScoredThisStep(m, w);
      if (team !== -1 && begun < 0) {
        beginCelebrationForGoal(c, m, w, team, pre);
        begun = m.stepCount;
      }
      updateWatch(m, w);
      if (c.kind !== 'goal') continue;
      live++;
      const mate = m.players[c.slot.indexOf(0)];
      if (celebrationView(c, mate, view) && view.pose === POSE_HUG) hugged = true;
    }
    expect(begun).toBeGreaterThan(0);
    expect(live).toBe(GOAL_PAUSE_STEPS);
    expect(hugged).toBe(true);
    expect(endedAtKickoff).toBe(true);
  });

  // MEASURED 06-oct: seed 16, difficulty 5 goes to penalties; team 0 scores three, all from
  // the spot at x 231 (the taker stands at x 249), and on each goal step the engine has
  // moved the taker to the centre circle and the set piece to x 1969.
  it('a real shootout (seed 16): each goal celebrates the man who took that kick, at his kick, with the camera held there', () => {
    const run = createMatchRun(TEAMS[0], TEAMS[1], 16, 5, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const w = createMatchWatch();
    const c = createCelebration();
    const pre = createPreStep();
    collectCaptions(m, w, 'none', createCaptionState());
    updateWatch(m, w);
    let goals = 0;
    for (let i = 0; i < 20_000 && m.phase !== 'over'; i++) {
      capturePreStep(m, pre);
      stepMatchRun(run);
      stepCelebration(c, m.phase);
      const team = goalScoredThisStep(m, w);
      if (team !== -1) {
        beginCelebrationForGoal(c, m, w, team, pre);
        const sh = m.shootout;
        expect(sh).not.toBeNull();
        if (sh === null) return;
        expect([c.kind, c.hubId]).toEqual(['shootout', shootoutTakerId(team, sh.taken[team] - 1)]);
        expect([c.hubX, c.hubY, c.camX, c.camY]).toEqual([pre.takerX, pre.takerY, pre.spotX, pre.spotY]);
        expect(m.players[c.hubId].x).not.toBe(c.hubX);
        expect(m.setPiece === null ? c.camX : m.setPiece.x).not.toBe(c.camX);
        goals++;
      }
      updateWatch(m, w);
    }
    expect(goals).toBe(3);
  });
});
```

- [ ] **Step 2: Verlos fallar**

Run: `npx vitest run components/games/football-screen/celebration.test.ts`
Expected: FAIL — `Failed to resolve import "./celebration"`.

- [ ] **Step 3: Implementar**

Crea `components/games/football-screen/celebration.ts`:

```ts
import { STEPS_PER_SECOND, perStep } from '../football-logic/clock';
import { isActive } from '../football-logic/discipline';
import { GOAL_PAUSE_STEPS, type MatchPhase, type MatchState } from '../football-logic/match';
import { PLAYER_SPEED, type PlayerState } from '../football-logic/players';
import { TEAM_SIZE } from '../football-logic/teams';
import { CAPTION_STEPS, type MatchWatch } from './captions';
import { facingOctant, runPose } from './sprite-frame';
import { POSE_DEJECTED, POSE_HUG } from './sprite-maps';

// G15-4 (Paco, v1.5 grill): ONE celebration for every goal, golden goal included -- the
// scoring team runs to the scorer and hugs in a ring, the rivals hang their heads; in the
// shootout only the taker celebrates. Screen only: during the 'goal' pause (and after a
// golden goal, in 'over') the engine moves nobody, so the celebration is a DRAWN position
// that differs from the engine's frozen one. Nothing here writes the match.
//
// Everything is created once (createCelebration) and written in place; the only
// trigonometry is the ring table, at module load (criterion 20, particles.ts's rule).

export const CELEBRATION_STEPS = GOAL_PAUSE_STEPS;                    // 240: the whole 4 s pause
// In the shootout the engine moves the scorer to the centre circle and the next kick to
// the other goal ON THE STEP OF THE GOAL (measured 06-oct, seed 16), so the screen holds
// the camera on the kick for as long as its GOL caption lasts: 1 s (D1, Paco 06-oct;
// captions.ts shortens that caption to match, so camera and caption cut together).
export const SHOOTOUT_HOLD_STEPS = CAPTION_STEPS['shootout-goal'];    // 60: 1 s
// D5 (Paco, "trotando"): the team-mates run at the NORMAL run speed, PLAYER_SPEED per step
// (3 u/step = 180 u/s) -- under RUN_FAST_SPEED_SQ, so runPose shows run frames, not the sprint's.
export const HUG_RUN_SPEED = perStep(PLAYER_SPEED);                   // 3 world units per step
const HUG_RUN_UPS = HUG_RUN_SPEED * STEPS_PER_SECOND;
export const HUG_RING_SLOTS = 10;                                     // ten outfielders at most
export const HUG_RING_INNER_SLOTS = 5;
export const HUG_RING_INNER = 18;                                     // world units from the hub
export const HUG_RING_OUTER = 34;

function ringOffsets(useCos: boolean): Float32Array {
  const out = new Float32Array(HUG_RING_SLOTS);
  for (let k = 0; k < HUG_RING_SLOTS; k++) {
    const inner = k < HUG_RING_INNER_SLOTS;
    const radius = inner ? HUG_RING_INNER : HUG_RING_OUTER;
    const turn = inner
      ? k / HUG_RING_INNER_SLOTS
      : (k - HUG_RING_INNER_SLOTS + 0.5) / (HUG_RING_SLOTS - HUG_RING_INNER_SLOTS);
    const angle = turn * Math.PI * 2;
    out[k] = radius * (useCos ? Math.cos(angle) : Math.sin(angle));
  }
  return out;
}

// Slot k of the ring, relative to the hub: five close round him, five more behind them,
// offset by half a step so the outer five fill the gaps.
export const HUG_RING_X: Float32Array = ringOffsets(true);
export const HUG_RING_Y: Float32Array = ringOffsets(false);

export type CelebrationKind = 'none' | 'goal' | 'shootout';

export type Celebration = {
  kind: CelebrationKind;
  team: 0 | 1;          // the team that scored
  hubId: number;        // the scorer (or, for an own goal, see goalHubId); the taker in the shootout
  step: number;         // steps since the goal
  hubX: number;         // where the hub is drawn (the shootout: where he kicked from)
  hubY: number;
  hubFaceX: number;
  hubFaceY: number;
  camX: number;         // the shootout: where the camera is held
  camY: number;
  slot: Int8Array;      // per player id: his ring slot, -1 = not running
  startX: Float32Array; // per player id: where he stood when the goal went in
  startY: Float32Array;
};

// What the engine destroys on the step of a shootout goal, read BEFORE stepMatchRun.
export type PreStep = {
  ballX: number;
  ballY: number;
  takerId: number;      // shootout.takerId, -1 outside the shootout
  takerX: number;
  takerY: number;
  spotX: number;        // the set piece's spot (the ball when there is none)
  spotY: number;
};

export type CelebrationView = { x: number; y: number; octant: number; pose: number };

export function createCelebration(count = TEAM_SIZE * 2): Celebration {
  return {
    kind: 'none', team: 0, hubId: -1, step: 0, hubX: 0, hubY: 0, hubFaceX: 1, hubFaceY: 0, camX: 0, camY: 0,
    slot: new Int8Array(count).fill(-1), startX: new Float32Array(count), startY: new Float32Array(count),
  };
}

export function createPreStep(): PreStep {
  return { ballX: 0, ballY: 0, takerId: -1, takerX: 0, takerY: 0, spotX: 0, spotY: 0 };
}

export function createCelebrationView(): CelebrationView {
  return { x: 0, y: 0, octant: 0, pose: 0 };
}

// Called by runStep before EVERY stepMatchRun (it also replaces the old prevBallX/Y of the
// keeper's dive, G11-2). Reads the match; writes only `out`.
export function capturePreStep(match: MatchState, out: PreStep): void {
  out.ballX = match.ball.x;
  out.ballY = match.ball.y;
  const sh = match.shootout;
  out.takerId = sh === null ? -1 : sh.takerId;
  const taker = out.takerId >= 0 ? match.players[out.takerId] : null;
  out.takerX = taker === null ? 0 : taker.x;
  out.takerY = taker === null ? 0 : taker.y;
  const sp = match.setPiece;
  out.spotX = sp === null ? match.ball.x : sp.x;
  out.spotY = sp === null ? match.ball.y : sp.y;
}

// A new match on the same screen (startMatch): nothing carries over. No allocation.
export function resetCelebration(c: Celebration): void {
  c.kind = 'none';
  c.step = 0;
  c.hubId = -1;
  c.slot.fill(-1);
}

// Who the ring forms round: the scorer (ball.lastTouchId on the goal step) when he is of the
// scoring team and still on the pitch; otherwise -- an own goal -- the scoring team's
// active outfielder nearest the ball, and its keeper if it has none.
export function goalHubId(match: MatchState, team: 0 | 1): number {
  const id = match.ball.lastTouchId;
  if (id !== null) {
    const scorer = match.players[id];
    if (scorer.team === team && isActive(scorer)) return id;
  }
  let best = team * TEAM_SIZE;
  let bestD = Infinity;
  for (let i = 0; i < match.players.length; i++) {
    const p = match.players[i];
    if (p.team !== team || p.role === 'gk' || !isActive(p)) continue;
    const dx = p.x - match.ball.x;
    const dy = p.y - match.ball.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// On the step of the goal (goalScoredThisStep !== -1), with `w` still the PREVIOUS step's:
// w.phase tells a shootout goal from any other. On an event: a handful of times a match.
export function beginCelebrationForGoal(c: Celebration, match: MatchState, w: MatchWatch, team: 0 | 1, pre: PreStep): void {
  c.team = team;
  c.step = 0;
  c.slot.fill(-1);
  if (w.phase === 'shootout') {
    if (pre.takerId < 0) {
      c.kind = 'none';
      return;
    }
    c.kind = 'shootout';
    c.hubId = pre.takerId;
    c.hubX = pre.takerX;
    c.hubY = pre.takerY;
    // Facing the goal he has just beaten: the spot is in front of it.
    c.hubFaceX = pre.spotX < match.pitch.width / 2 ? -1 : 1;
    c.hubFaceY = 0;
    c.camX = pre.spotX;
    c.camY = pre.spotY;
    return;
  }
  c.kind = 'goal';
  const hub = match.players[goalHubId(match, team)];
  c.hubId = hub.id;
  c.hubX = hub.x;
  c.hubY = hub.y;
  c.hubFaceX = hub.facingX;
  c.hubFaceY = hub.facingY;
  c.camX = hub.x;
  c.camY = hub.y;
  for (let i = 0; i < match.players.length; i++) {
    c.startX[i] = match.players[i].x;
    c.startY[i] = match.players[i].y;
  }
  // Nearest first: slot 0 to the closest team-mate. Ten passes of 22 -- on an event.
  for (let k = 0; k < HUG_RING_SLOTS; k++) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < match.players.length; i++) {
      const p = match.players[i];
      if (p.team !== team || p.role === 'gk' || p.id === hub.id || !isActive(p) || c.slot[i] !== -1) continue;
      const dx = p.x - hub.x;
      const dy = p.y - hub.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return;
    c.slot[best] = k;
  }
}

// Once per simulated step (runStep) and per captions-only step ('over'). A goal's
// celebration ends with its pause -- the kickoff puts everybody back -- and never outlives
// CELEBRATION_STEPS; a golden goal's plays out in 'over'; the shootout's lasts its hold.
export function stepCelebration(c: Celebration, phase: MatchPhase): void {
  if (c.kind === 'none') return;
  c.step++;
  const limit = c.kind === 'shootout' ? SHOOTOUT_HOLD_STEPS : CELEBRATION_STEPS;
  if (c.step >= limit || (c.kind === 'goal' && phase !== 'goal' && phase !== 'over')) c.kind = 'none';
}

export function celebrationHoldsCamera(c: Celebration): boolean {
  return c.kind === 'shootout';
}

// Where and how `p` is drawn while the celebration lasts. false = draw him as usual.
export function celebrationView(c: Celebration, p: PlayerState, out: CelebrationView): boolean {
  if (c.kind === 'none') return false;
  if (c.kind === 'shootout') {
    if (p.id !== c.hubId) return false;
    out.x = c.hubX;
    out.y = c.hubY;
    out.pose = POSE_HUG;
    out.octant = facingOctant(c.hubFaceX, c.hubFaceY);
    return true;
  }
  if (p.team !== c.team) {
    out.x = p.x;
    out.y = p.y;
    out.pose = POSE_DEJECTED;
    out.octant = facingOctant(p.facingX, p.facingY);
    return true;
  }
  const slot = c.slot[p.id];
  if (slot < 0) {
    // The hub and the scoring team's keeper celebrate where they are.
    out.x = p.x;
    out.y = p.y;
    out.pose = POSE_HUG;
    out.octant = p.id === c.hubId ? facingOctant(c.hubFaceX, c.hubFaceY) : facingOctant(p.facingX, p.facingY);
    return true;
  }
  const sx = c.startX[p.id];
  const sy = c.startY[p.id];
  const tx = c.hubX + HUG_RING_X[slot];
  const ty = c.hubY + HUG_RING_Y[slot];
  const dx = tx - sx;
  const dy = ty - sy;
  const d = Math.sqrt(dx * dx + dy * dy);
  const run = c.step * HUG_RUN_SPEED;
  if (run >= d) {
    out.x = tx;
    out.y = ty;
    out.pose = POSE_HUG;
    out.octant = facingOctant(c.hubX - tx, c.hubY - ty);
    return true;
  }
  const ux = dx / d;
  const uy = dy / d;
  out.x = sx + ux * run;
  out.y = sy + uy * run;
  out.pose = runPose(c.step, p.id, ux * HUG_RUN_UPS, uy * HUG_RUN_UPS);
  out.octant = facingOctant(ux, uy);
  return true;
}
```

- [ ] **Step 4: Verlos pasar**

Run: `npx vitest run components/games/football-screen/celebration.test.ts`
Expected: PASS, 8 tests. (Los dos de partido real se validaron con un prototipo al escribir el plan: semilla 14 dificultad 8 → `begun` 9765, `live` 240, abrazo antes del saque, fin en `kickoff`; semilla 16 → 3 goles en la tanda, `hubX` 249, `camX` 231.)

- [ ] **Step 5: Controles negativos (ejecutar y REVERTIR cada uno)**

1. `goalHubId` devolviendo `id` sin mirar el equipo → FALLA el primero (`expected 3 to be 15`: el defensa rival como anfitrión).
2. Sin `p.role === 'gk' ||` en el reparto de huecos → FALLA el de huecos: el portero recibe hueco (`expected [ 1, true, false ] to deeply equal [ 1, false, false ]`, o `expected 9 to be 8` si es el último en entrar).
3. `celebrationView` devolviendo siempre `p.x/p.y` para los que corren → FALLA el de la carrera (`expected 0 to be close to 8`).
4. `stepCelebration` sin la condición de fase → FALLA el de duraciones en `stepCelebration(c, 'kickoff')` (`expected 'goal' to be 'none'`).
5. La tanda con `c.hubX = match.players[pre.takerId].x` (la posición de DESPUÉS del paso) → FALLAN el sintético (`980` en vez de `249`) y el de la semilla 16.
6. `beginCelebrationForGoal` sin la rama de la tanda (todo como gol normal) → FALLA el de la semilla 16 (`expected [ 'goal', … ] to equal [ 'shootout', … ]`).
7. D1: en `captions.ts`, `'shootout-goal': SHORT_CAPTION_STEPS` (1,5 s; deshace el 1b de la Task 2) → FALLA el `it` de duraciones (`expected 90 to be 60`, en `toBe(STEPS_PER_SECOND)` y en el enlace con `CAPTION_STEPS['shootout-goal']`). Revertir.
8. D5: `HUG_RUN_SPEED = 4` → FALLA el `it` de la carrera (`expected 240 to be 180`: el sprint). Revertir.

- [ ] **Step 6: Compuertas**

```bash
npx vitest run
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "VaultWorldCupGame.tsx"
npx eslint components/games/football-screen/celebration.ts components/games/football-screen/celebration.test.ts
git diff --name-only 77aecd7 -- components/games/football-logic/ | sort
grep -rn "Math\.random(" components/games/football-logic/ components/games/football-screen/
```
Expected: **1541 tests en 91 ficheros**; el `grep` de `tsc` **vacío** (siguen solo los 5 declarados del `.tsx`); `eslint` sin salida; motor, las tres líneas; `Math.random` vacío.

- [ ] **Step 7: Ledger**

`Task V15-5-4: celebration.ts (corro por huecos del más cercano, cabizbajos, compañeros a velocidad de carrera normal 180 u/s —D5—, tanda con lanzador donde tiró y cámara sujeta 60 pasos = 1 s, igual que su rótulo —D1—), capturePreStep; 1541 / 91; 8 controles revertidos (el 7 es también el control 10 de la Task 2).`

---

### Task V15-5-5: cableado en el partido — nombres por rótulo, dorsal, sprites nuevos, amagos, abrazo y la cámara de la tanda (pantalla)

**Sin tests nuevos** (es el `.tsx`, que vitest no compila): lo verifican `tsc` (cierra los 5 errores de la Task 3), `eslint`, la revisión punto por punto del Step 3 y el QA jugado. Toda la lógica que se cablea aquí ya está probada en las Tasks 2-4.

**Files:**
- Modify: `components/games/VaultWorldCupGame.tsx` — imports (`:32-35` captions, `:56` gestures, `:86` sprite-frame, nuevo de celebration); constantes (`HEADS_DOWN` `:147`; tras `NOTCH_DY` `:205`); estado del montaje (`let cardName = ''; let injuryName = '';` `:502-504`; tras `const spriteChoice = createSpriteChoice();` `:518`); `startMatch` (`cardName = ''; injuryName = '';` `:692-693`); `refreshCardView` + `refreshInjuryCaption` (`:995-1010`); `runStep` (`:1057-1208`); `stepCaptionsOnly` (`:1214-1220`); `drawPlayer` (`:1358-1467`); `drawPlayers` (`:1479-1488`); `drawCaption` (`:1730-1753`).

**Interfaces:**
- Consumes: Task 2 (`OWN_GOAL_PREFIX`, `goalScoredThisStep`, `CaptionState.team/squad/ownGoal`); Task 3 (`choosePlayerSprite` de 9 argumentos, `beginStealFeints`, `SpriteChoice` sin `tilt`); Task 4 (todo `celebration.ts`).
- Produces: el partido con nombres, dorsal, entradas tirándose, amagos, levantarse, corro y cámara de la tanda. La Task 9 añade la red sobre el mismo `runStep` y `stepCaptionsOnly`.

- [ ] **Step 1: Imports y constantes**

1. El import de `./football-screen/captions` (`:32-35`) pasa a:

```ts
import {
  CAPTION_TEXT, OWN_GOAL_PREFIX, collectCaptions, createCaptionState, createMatchWatch, goalScoredThisStep,
  pushCaption, resetCaptionState, resetMatchWatch, stepCaption, updateWatch, type ShowingCaption,
} from './football-screen/captions';
```
(`cardShownThisStep` e `injuredTeamThisStep` salen: sus dos llamadores, `refreshCardView`/`refreshInjuryCaption`, se borran en el Step 2.)

2. El de `./football-screen/gestures` (`:56`) añade `beginStealFeints`.
3. El de `./football-screen/sprite-frame` (`:86`) pasa a `import { choosePlayerSprite, createSpriteChoice } from './football-screen/sprite-frame';`.
4. Nuevo, tras el de `./football-screen/camera`:

```ts
import {
  beginCelebrationForGoal, capturePreStep, celebrationHoldsCamera, celebrationView, createCelebration,
  createCelebrationView, createPreStep, resetCelebration, stepCelebration,
} from './football-screen/celebration';
```

5. Borra `const HEADS_DOWN = 'rgba(0,0,0,0.5)';` (`:147`; su único uso eran los arcos de la celebración vieja). Tras `const NOTCH_DY = -24;` (`:205`):

```ts
// G15-11: the shirt number of the controlled player, to the right of the cursor arrow
// (which spans x - 7 .. x + 7 at y - PLAYER_RADIUS - 12).
const DORSAL_DX = 10;
const DORSAL_DY = 8;
```

- [ ] **Step 2: Estado del montaje, `startMatch` y lo que se borra**

1. Borra las tres líneas `// G15-13 / G15-18: the name under the card and injury captions, composed on the event.`, `let cardName = '';`, `let injuryName = '';` (`:502-504`).
2. Tras `const spriteChoice = createSpriteChoice();` (`:518`):

```ts
    // G15-25: the steal feints, a GestureTimers of their own (the dives keep theirs).
    // G15-4: the goal celebration, its per-player view and the snapshot taken before every
    // step (what the shootout destroys on the step of its goal). All created ONCE.
    const feints = createGestureTimers();
    const celebration = createCelebration();
    const celebrationOut = createCelebrationView();
    const preStep = createPreStep();
    // G15-11 / D2: the second line of an own-goal caption, "EN PROPIA · <name>", for every
    // (team, squad index) of THIS match -- index = team * SQUAD_SIZE + squad. Built once per
    // match in startMatch (an event), so drawCaption only looks it up (criterion 20).
    const ownGoalLabels: string[] = [];
```

3. En `startMatch`, sustituye `cardName = '';` y `injuryName = '';` (`:692-693`) por:

```ts
      resetGestures(feints);
      resetCelebration(celebration);
      // D2: the own-goal labels of this match, on this event. `run` and runLineups are
      // already this match's here; two explicit writes, because playerName takes a `0 | 1`
      // and the counter of a for loop is a `number`.
      for (let i = 0; i < SQUAD_SIZE; i++) {
        ownGoalLabels[i] = OWN_GOAL_PREFIX + playerName(0, i);
        ownGoalLabels[SQUAD_SIZE + i] = OWN_GOAL_PREFIX + playerName(1, i);
      }
```

4. Borra `refreshCardView` y `refreshInjuryCaption` con sus comentarios (`:995-1010`, desde `// G15-13: the name under TARJETA AMARILLA / ROJA…` hasta el cierre de `refreshInjuryCaption`). `playerName` (`:987-993`) **se queda**: la usan `drawCaption` (Step 5) y `refreshInjuryView`.

- [ ] **Step 3: `runStep` y `stepCaptionsOnly`**

En `runStep` (`:1057`):

1. Sustituye las dos líneas `const prevBallX = match.ball.x;` / `const prevBallY = match.ball.y;` (`:1063-1064`) — y deja su comentario — por:

```ts
      capturePreStep(match, preStep);
```
Y añade al final de ese comentario: `// V15-5: capturePreStep keeps that snapshot, and also what the shootout destroys on the step of its goal (the taker's position, the spot) -- G15-4.`

2. En el comentario del punto 1c (`:1083-1087`), `direction comes from prevBallX/prevBallY, captured above` pasa a `direction comes from preStep.ballX/ballY, captured above` (la compuerta del Step 6 busca `prevBallX` y debe salir vacía). Y `beginGkCatchGestures(match, gestures, prevBallX, prevBallY);` (`:1088`) pasa a:

```ts
      beginGkCatchGestures(match, gestures, preStep.ballX, preStep.ballY);
      // 1d. G15-25: a steal with a rival in reach feints, read off THIS step's events.
      beginStealFeints(match, feints);
```

3. El punto 7 (`:1166-1177`) pasa a:

```ts
      // 7. Captions, from the transition detector, seen from the human side of THIS
      //    match; no GANADOR when a victory screen follows (S-FL3). G15-11: every caption
      //    carries its own subject (collectCaptions), so no name is composed here.
      //    G15-4: the celebration of an earlier goal moves on one step, and a goal ON this
      //    step starts a new one -- read against the same watch, before updateWatch.
      stepCelebration(celebration, match.phase);
      const scoredTeam = goalScoredThisStep(match, watch);
      if (scoredTeam !== -1) beginCelebrationForGoal(celebration, match, watch, scoredTeam, preStep);
      const before = captions.kind;
      collectCaptions(match, watch, humanSide, captions, victoryScreen);
      updateWatch(match, watch);
      stepCaption(captions);
      playCaptionEdge(before);
```

4. En el punto 8 (`:1188-1194`), la cámara pasa a:

```ts
      // 8. The camera. During the shootout the target is the alternating penalty
      //    spot and the cut is instant (S-SC8): panning 1600 units between kicks
      //    would take longer than the kick itself. G15-4: for the SHOOTOUT_HOLD_STEPS
      //    after a shootout goal it is held on the kick that scored, or the cut to the
      //    next spot would hide the celebration and the net.
      const tx = cameraTargetX(match);
      const ty = cameraTargetY(match);
      if (celebrationHoldsCamera(celebration)) centreCamera(cam, celebration.camX, celebration.camY, PITCH);
      else if (match.phase === 'shootout') centreCamera(cam, tx, ty, PITCH);
      else followCamera(cam, tx, ty, PITCH, CAMERA_LAG);
```

`stepCaptionsOnly` (`:1214-1220`) pasa a:

```ts
    function stepCaptionsOnly(steps: number): void {
      for (let i = 0; i < steps; i++) {
        const before = captions.kind;
        stepCaption(captions);
        playCaptionEdge(before);
        // G15-4: a golden goal (straight to 'over') celebrates in these frames.
        stepCelebration(celebration, run.match.phase);
      }
    }
```

- [ ] **Step 4: `drawPlayer` y `drawPlayers`**

Sustituye el comentario y la función `drawPlayer` (`:1358-1467`) por:

```ts
    // V15-1 (G15-2 + G15-3): every player is ONE sprite from the atlas of its side,
    // chosen by sprite-frame.ts's choosePlayerSprite. V15-5: the slide is its own lying
    // sprite (G15-25, no tilted run any more), a steal feints, a player getting up crouches,
    // and during a goal celebration (G15-4) celebrationView moves and poses the sprite --
    // the engine's own positions stay frozen under it. The shadow, the cursor with the
    // shirt number (G15-11), the charge notches and the sprint ring stay vector, on top.
    //
    // The shootout exclusions of stage B2 §8 live in choosePlayerSprite:
    //   · `parked` — the nineteen in the centre circle stand still, whatever slide,
    //     floor or charge fields the engine left on them.
    //   · nobody is drawn lying down or sliding during the shootout, THE TAKER
    //     INCLUDED (B2 report, Minor 2; probe P6(1)).
    function drawPlayer(p: PlayerState, cursor: boolean): void {
      const match = run.match;
      const shootout = match.phase === 'shootout';
      const parked = shootout && p.id !== (match.shootout?.takerId ?? -1) && p.role !== 'gk';
      // G11-2 still drives the dive: a SCREEN timer started by 'gk-catch'. G15-25: the
      // steal feint is the same kind of timer, for the outfield.
      const gesture = p.role === 'gk' ? gestureProgress(gestures, p.id, match.stepCount) : GESTURE_IDLE;
      const feint = p.role === 'gk' ? GESTURE_IDLE : gestureProgress(feints, p.id, match.stepCount);
      choosePlayerSprite(
        p, match.stepCount, shootout, parked, gesture, gestures.dirX[p.id], gestures.dirY[p.id], feint, spriteChoice,
      );
      // The position is chosen BEFORE the culling: a team-mate running into the hug may be
      // coming on screen.
      let wx = p.x;
      let wy = p.y;
      if (celebrationView(celebration, p, celebrationOut)) {
        wx = celebrationOut.x;
        wy = celebrationOut.y;
        spriteChoice.octant = celebrationOut.octant;
        spriteChoice.pose = celebrationOut.pose;
      }
      if (!isOnScreen(cam, wx, wy, PLAYER_RADIUS * 3)) return;
      const x = toScreenX(cam, wx);
      const y = toScreenY(cam, wy);

      ctx.fillStyle = SHADOW;
      ctx.beginPath();
      ctx.ellipse(x, y + SPRITE_SHADOW_DY, SPRITE_SHADOW_RX, SPRITE_SHADOW_RY, 0, 0, Math.PI * 2);
      ctx.fill();

      // G12-1: the keeper ALWAYS paints from the reserved atlas, never its team's.
      const atlas = p.role === 'gk' ? atlasKeeper : p.team === HOME ? atlasHome : atlasAway;
      // Whole pixels, or the pixel art shimmers while the camera glides.
      const px = Math.round(x);
      const py = Math.round(y);
      ctx.drawImage(
        atlas, atlasCellX(spriteChoice.octant), atlasCellY(spriteChoice.pose), SPRITE_SIZE, SPRITE_SIZE,
        px - SPRITE_HALF, py - SPRITE_HALF, SPRITE_SIZE, SPRITE_SIZE,
      );

      if (cursor) {
        ctx.strokeStyle = CURSOR_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 7, y - PLAYER_RADIUS - 12);
        ctx.lineTo(x + 7, y - PLAYER_RADIUS - 12);
        ctx.lineTo(x, y - PLAYER_RADIUS - 3);
        ctx.closePath();
        ctx.stroke();
        // G15-11: "dorsal sobre el controlado junto al cursor". SHIRT_LABELS is built at
        // module load; squadIndex 0..17 is its index.
        ctx.font = FONT_HALF;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = CURSOR_COLOR;
        ctx.fillText(SHIRT_LABELS[p.squadIndex], x + DORSAL_DX, y - PLAYER_RADIUS - DORSAL_DY);
```

…y a partir de aquí **copia sin cambios** el resto del cuerpo de hoy, desde el comentario `// R33 (Paco, 07-sep), replacing the continuous yellow bar…` (`:1432`) hasta el final de la función (`:1467`) — las muescas de carga dentro del `if (cursor)` y el aro de sprint.

En `drawPlayers` (`:1485`), la línea del filtro pasa a (el lanzador de la tanda que celebra se dibuja aunque hubiera sido expulsado, igual que cuando tira). **Ojo (M2): la línea `if (!isActive(p) && !isShootoutTaker(match, p)) continue;` aparece DOS veces en el `.tsx` — `:1485` en `drawPlayers` y `:1591` en el dibujo del minimapa —: cambia SOLO la primera, la de `drawPlayers`; el minimapa no se toca.**

```ts
        if (!isActive(p) && !isShootoutTaker(match, p) && !(celebrationHoldsCamera(celebration) && p.id === celebration.hubId)) continue;
```

- [ ] **Step 5: `drawCaption`**

En `drawCaption` (`:1742-1744`), las dos líneas del nombre pasan a:

```ts
      // G15-11: the subject travels with the caption (captions.ts); the name is a lookup
      // (playerName: the lineup's for a human team, the squad's for the CPU), never a
      // string built here. D2: an own goal is about the DEFENDER (captions.team/squad are
      // his), and its second line is the label baked at startMatch: "EN PROPIA · <name>".
      // The same two lines serve every caption with a subject: GOL, FALLA and PENALTI,
      // FALTA, TARJETA, LESIÓN.
      const name = captions.squad < 0
        ? ''
        : captions.ownGoal
          ? ownGoalLabels[captions.team * SQUAD_SIZE + captions.squad]
          : playerName(captions.team, captions.squad);
```

(El resto de `drawCaption` no cambia: con nombre, dos líneas; sin nombre, una.)

- [ ] **Step 6: Revisión de revisor (punto por punto) y compuertas**

```bash
npx tsc --noEmit
npx vitest run
npx eslint components/games/VaultWorldCupGame.tsx components/games/football-screen
git diff --name-only 77aecd7 -- components/games/football-logic/ | sort
grep -n "cardName\|injuryName\|refreshCardView\|refreshInjuryCaption\|HEADS_DOWN\|SLIDE_TILT\|\.tilt\|prevBallX\|prevBallY" components/games/VaultWorldCupGame.tsx
git diff 77aecd7 -- components/games/VaultWorldCupGame.tsx | grep "^+" | grep -v "^+++" | grep -vE "^\+\s*//" | grep -nE "new |\`|\.map\(|\.filter\(|\.slice\(|=>|\[\]|\{ *\}"
grep -rn "Math\.random(" components/games/football-logic/ components/games/football-screen/
```
Expected: `tsc` **sin salida** (los 5 de la Task 3, cerrados); **1541 / 91** verdes; `eslint` **sin salida** (no se le pasa `app/`, donde viven los 3 errores de partida); motor, las tres líneas; el `grep` de restos, **vacío**; el `grep` de asignaciones en líneas añadidas, **exactamente UNA línea**: `const ownGoalLabels: string[] = [];` (montaje, no por frame; anótala en el ledger — las otras creaciones nuevas, las cuatro de `createGestureTimers/createCelebration/createCelebrationView/createPreStep`, no casan con el patrón y van también en el montaje); `Math.random` vacío.

Comprueba a mano, una por una:
1. `capturePreStep` va ANTES de `stepMatchRun`, y `goalScoredThisStep` + `beginCelebrationForGoal` DESPUÉS de `stepMatchRun` y ANTES de `updateWatch` (Lección 1).
2. `stepCelebration` corre una vez por paso en `runStep` y una vez por paso en `stepCaptionsOnly`, nunca por frame.
3. `drawPlayer` no tiene ya `setTransform` (el slide es un sprite), y el `drawImage` usa el `spriteChoice` que puede haber reescrito la celebración.
4. `drawCaption` no concatena: `playerName` y `ownGoalLabels[…]` devuelven cadenas existentes; la única concatenación (`OWN_GOAL_PREFIX + playerName(…)`) está en `startMatch`, que es un evento, y la hornea para los dos equipos antes de que se dibuje el primer frame del partido.
5. El orden de prioridad de la cámara: celebración de la tanda > tanda > seguir al balón.
6. `startMatch` reinicia amagos y celebración (un partido nuevo no hereda el corro del anterior).

- [ ] **Step 7: Ledger — FIN DEL DÍA 1**

`Task V15-5-5: .tsx día 1 — nombres por rótulo (cardName/injuryName fuera; gol en propia con «EN PROPIA · defensa» horneado en startMatch; FALLA de la tanda con nombre), dorsal junto al cursor, slide/amago/levantarse, corro y cabizbajos, cámara sujeta en la tanda; tsc limpio; 1541 / 91.`
Y debajo: `=== DÍA 1 CERRADO. Working tree verificado. Siguiente = día 2: Tasks 6-10. ===`

---

## DÍA 2

### Task V15-5-6: la red que ondula (G15-14, puro)

**Qué es.** Una onda amortiguada que sale del punto de impacto del gol y recorre la malla ~1 s (`RIPPLE_STEPS` = 60). La red se dibuja cenital (líneas paralelas a la línea de gol y perpendiculares, `drawPitch`); la onda **empuja cada vértice de la malla en radial**, alejándolo del punto de impacto, con un desplazamiento `rippleOffset(distancia)` que es cero por delante del frente, oscila detrás de él con una tabla de senos creada al cargar el módulo, cae con la distancia y se apaga con el tiempo. **Solo la arranca un gol** (`goalScoredThisStep`, Task 2, cableado en la Task 9): poste y larguero no mueven ningún marcador, así que no la arrancan (está probado en la Task 2: `goalScoredThisStep` da -1 con `frameHit = 'post'`).

**El punto de impacto** sale de `preStep.ballX/Y` (la posición del balón un paso antes del gol): en la tanda, en el paso del gol el motor ya ha colocado el balón en el otro punto de penalti (medido: x 1969), así que el balón de DESPUÉS del paso no sirve; el de antes está a 2-12 u de la línea (medido en 8 goles). La portería es la del lado de ese balón; la `y` se recorta entre los postes.

**Files:**
- Create: `components/games/football-screen/net-ripple.ts`
- Test: `components/games/football-screen/net-ripple.test.ts` (nuevo)

**Interfaces:**
- Consumes: `centerY`, `PitchDef` (`pitch.ts`).
- Produces (los consume la Task 9): `RIPPLE_STEPS`, `RIPPLE_AMPLITUDE`, `RIPPLE_SEGMENTS_DEEP` (6), `RIPPLE_SEGMENTS_ACROSS` (30), `RIPPLE_TABLE_SIZE`, `RIPPLE_WAVE`; `type NetRipple = { active: boolean; side: 0 | 1; x: number; y: number; step: number }`; `type RippleVertex = { x: number; y: number }`; `createNetRipple()`, `createRippleVertex()`, `resetNetRipple(r)`, `beginNetRipple(r, pitch, ballX, ballY)`, `stepNetRipple(r)`, `rippleOffset(r, distance): number`, `rippleVertex(r, x, y, out): void`. `side` 0 = la portería de x = 0, la misma convención que el bucle `for (let side = 0; side < 2; side++)` de `drawPitch`.

- [ ] **Step 1: Escribir los tests que fallan**

Crea `components/games/football-screen/net-ripple.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PITCH, centerY } from '../football-logic/pitch';
import {
  RIPPLE_AMPLITUDE, RIPPLE_STEPS, RIPPLE_TABLE_SIZE, RIPPLE_WAVE, beginNetRipple, createNetRipple, createRippleVertex,
  resetNetRipple, rippleOffset, rippleVertex, stepNetRipple,
} from './net-ripple';

const MID = centerY(PITCH);
const HALF_GOAL = PITCH.goalWidth / 2;

describe('net-ripple (G15-14)', () => {
  it('begins on the goal line of the goal scored on, with the impact clamped between the posts', () => {
    const r = createNetRipple();
    expect(r.active).toBe(false);
    // MEASURED 06-oct: a goal at the left end leaves the pre-step ball at x 2..12.
    beginNetRipple(r, PITCH, 8, MID - 20);
    expect([r.active, r.side, r.x, r.y, r.step]).toEqual([true, 0, 0, MID - 20, 0]);
    beginNetRipple(r, PITCH, 2193, MID + 400);
    expect([r.side, r.x, r.y]).toEqual([1, PITCH.width, MID + HALF_GOAL]);
    resetNetRipple(r);
    expect(r.active).toBe(false);
  });

  it('is zero ahead of the wave front, and everywhere once RIPPLE_STEPS have passed', () => {
    const r = createNetRipple();
    beginNetRipple(r, PITCH, 8, MID);
    expect(rippleOffset(r, 0)).toBe(0);              // sin(0): the wave starts flat
    for (let i = 0; i < 10; i++) stepNetRipple(r);
    expect(rippleOffset(r, 31)).toBe(0);             // the front is at 10 * 3 = 30
    let moved = false;
    for (let d = 0; d <= 30; d++) if (rippleOffset(r, d) !== 0) moved = true;
    expect(moved).toBe(true);
    for (let i = 10; i < RIPPLE_STEPS; i++) stepNetRipple(r);
    expect(r.active).toBe(false);
    for (let d = 0; d <= 200; d++) expect(rippleOffset(r, d)).toBe(0);
  });

  it('never moves a point more than RIPPLE_AMPLITUDE, and damps out over time', () => {
    const r = createNetRipple();
    beginNetRipple(r, PITCH, 8, MID);
    const peak: number[] = [];
    for (let s = 0; s < RIPPLE_STEPS; s++) {
      let max = 0;
      for (let d = 0; d <= 200; d++) {
        const off = Math.abs(rippleOffset(r, d));
        expect(off).toBeLessThanOrEqual(RIPPLE_AMPLITUDE);
        if (off > max) max = off;
      }
      peak.push(max);
      stepNetRipple(r);
    }
    expect(peak[10]).toBeGreaterThan(0);
    expect(peak[50]).toBeLessThan(peak[10] / 4);
  });

  it('rippleVertex pushes a mesh point away from the impact, in place, and leaves the impact point itself alone', () => {
    const r = createNetRipple();
    const v = createRippleVertex();
    beginNetRipple(r, PITCH, 8, MID);
    for (let i = 0; i < 10; i++) stepNetRipple(r);
    const off = rippleOffset(r, 20);
    expect(off).toBeGreaterThan(0);
    rippleVertex(r, -20, MID, v);                    // 20 u straight behind the impact, inside the net
    expect(v.x).toBeCloseTo(-20 - off, 9);
    expect(v.y).toBe(MID);
    rippleVertex(r, 0, MID, v);
    expect([v.x, v.y]).toEqual([0, MID]);
  });

  it('the wave table is built once at load: RIPPLE_TABLE_SIZE samples of one sine period', () => {
    expect(RIPPLE_WAVE.length).toBe(RIPPLE_TABLE_SIZE);
    expect(RIPPLE_WAVE[0]).toBe(0);
    expect(RIPPLE_WAVE[RIPPLE_TABLE_SIZE / 4]).toBeCloseTo(1, 6);
    expect(RIPPLE_WAVE[(RIPPLE_TABLE_SIZE * 3) / 4]).toBeCloseTo(-1, 6);
  });
});
```

- [ ] **Step 2: Verlos fallar**

Run: `npx vitest run components/games/football-screen/net-ripple.test.ts`
Expected: FAIL — `Failed to resolve import "./net-ripple"`.

- [ ] **Step 3: Implementar**

Crea `components/games/football-screen/net-ripple.ts`:

```ts
import { centerY, type PitchDef } from '../football-logic/pitch';

// G15-14 (Paco, v1.5 grill): the net ripples with a goal -- golden goal and shootout
// included -- and never with a post or the crossbar. A damped wave runs out from the point
// of impact for ~1 s, inside the 4 s goal pause. Screen only: the component starts it on
// goalScoredThisStep (captions.ts), steps it once per simulated step and asks this module
// where each vertex of the mesh is drawn. Nothing here allocates after the module loads:
// the sine table is built once, the state and the vertex are created once by the caller.

export const RIPPLE_STEPS = 60;           // ~1 s at 60 steps/s
export const RIPPLE_AMPLITUDE = 6;        // world units, the most a point of the mesh moves
export const RIPPLE_SPEED = 3;            // world units per step the front travels
export const RIPPLE_WAVELENGTH = 24;      // world units
export const RIPPLE_FALLOFF = 60;         // world units: the swing halves at this distance
// The mesh drawn as polylines while it ripples: the 30-unit depth in 6 segments, the
// 150-unit mouth in 30 -- 5 units a segment.
export const RIPPLE_SEGMENTS_DEEP = 6;
export const RIPPLE_SEGMENTS_ACROSS = 30;
export const RIPPLE_TABLE_SIZE = 64;

function buildWave(): Float32Array {
  const out = new Float32Array(RIPPLE_TABLE_SIZE);
  for (let i = 0; i < RIPPLE_TABLE_SIZE; i++) out[i] = Math.sin((i / RIPPLE_TABLE_SIZE) * Math.PI * 2);
  return out;
}

// One sine period, sampled once at load: no trigonometry per frame (particles.ts's rule).
export const RIPPLE_WAVE: Float32Array = buildWave();

export type NetRipple = {
  active: boolean;
  side: 0 | 1;   // 0 = the goal at x = 0, 1 = the goal at x = pitch.width (drawPitch's loop)
  x: number;     // the point of impact: on the goal line...
  y: number;     // ...between the posts
  step: number;
};

export type RippleVertex = { x: number; y: number };

export function createNetRipple(): NetRipple {
  return { active: false, side: 0, x: 0, y: 0, step: 0 };
}

export function createRippleVertex(): RippleVertex {
  return { x: 0, y: 0 };
}

export function resetNetRipple(r: NetRipple): void {
  r.active = false;
  r.step = 0;
}

// ballX/ballY: the ball ONE step before the goal (VaultWorldCupGame's preStep) -- after the
// step the shootout has already moved it to the next spot.
export function beginNetRipple(r: NetRipple, pitch: PitchDef, ballX: number, ballY: number): void {
  const half = pitch.goalWidth / 2;
  const mid = centerY(pitch);
  r.side = ballX < pitch.width / 2 ? 0 : 1;
  r.x = r.side === 0 ? 0 : pitch.width;
  r.y = ballY < mid - half ? mid - half : ballY > mid + half ? mid + half : ballY;
  r.step = 0;
  r.active = true;
}

export function stepNetRipple(r: NetRipple): void {
  if (!r.active) return;
  r.step++;
  if (r.step >= RIPPLE_STEPS) r.active = false;
}

// How far a point `distance` units from the impact is pushed, outwards (+) or back (-).
export function rippleOffset(r: NetRipple, distance: number): number {
  if (!r.active) return 0;
  const front = r.step * RIPPLE_SPEED;
  if (distance > front) return 0;
  const phase = (front - distance) / RIPPLE_WAVELENGTH;
  const index = Math.floor(phase * RIPPLE_TABLE_SIZE) % RIPPLE_TABLE_SIZE;
  const time = 1 - r.step / RIPPLE_STEPS;
  return (RIPPLE_AMPLITUDE * time * time * RIPPLE_WAVE[index]) / (1 + distance / RIPPLE_FALLOFF);
}

// Where the mesh point (x, y) is drawn: pushed along the line from the impact. Writes `out`.
export function rippleVertex(r: NetRipple, x: number, y: number, out: RippleVertex): void {
  out.x = x;
  out.y = y;
  const dx = x - r.x;
  const dy = y - r.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return;
  const off = rippleOffset(r, d);
  out.x += (dx / d) * off;
  out.y += (dy / d) * off;
}
```

- [ ] **Step 4: Verlos pasar**

Run: `npx vitest run components/games/football-screen/net-ripple.test.ts`
Expected: PASS, 5 tests. (Valores a mano para el cuarto: paso 10, distancia 20 → fase 10/24 → índice 26 → seno ≈ +0,556, amplitud 6 · (5/6)² / (1 + 1/3) ≈ +1,74 u: positivo, así que el punto se aleja.)

- [ ] **Step 5: Controles negativos (ejecutar y REVERTIR cada uno)**

1. `beginNetRipple` sin el recorte de `y` → FALLA el primero (`expected [ 1, 2200, 1115 ]` frente a `[ 1, 2200, 790 ]`).
2. `rippleOffset` sin `if (distance > front) return 0;` → FALLA el segundo (`expected <número> to be +0` en la distancia 31).
3. Sin el factor `time * time` → FALLA el tercero (`expected <pico 50> to be less than <pico 10 / 4>`).
4. `rippleVertex` con `out.x -= …` (hacia el impacto) → FALLA el cuarto (`expected -18.26… to be close to -21.74…`).

- [ ] **Step 6: Compuertas**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/net-ripple.ts components/games/football-screen/net-ripple.test.ts
git diff --name-only 77aecd7 -- components/games/football-logic/ | sort
grep -rn "Math\.random(" components/games/football-logic/ components/games/football-screen/
```
Expected: **1546 tests en 92 ficheros**; `tsc` sin salida; `eslint` sin salida; motor, las tres líneas; `Math.random` vacío.

- [ ] **Step 7: Ledger**

`Task V15-5-6: net-ripple.ts (onda radial amortiguada, 60 pasos, tabla de senos en la carga); 1546 / 92; 4 controles revertidos.`

---
### Task V15-5-7: la pantalla previa — la fase, el sprite de frente, la maqueta, las gradas y su texto (G15-19 matizada, puro)

**Dónde va.** «Justo al pulsar JUGAR, con el rival ya sorteado»: en el Mundial, JUGAR es la A del cuadro sobre TU PARTIDO (`flowConfirmBracket` → `'play'`; la pista ya dice `A (J) PARA JUGAR`); en los amistosos, el momento en que el modo queda construido (rival sorteado en `flowBuildMode`) tras la última ALINEACIÓN. Las dos puertas pasan a ir a una fase nueva **`'pre-match'`** en vez de a `'match'`; el entrenamiento no tiene pantalla previa (G15-19: «en amistoso y Mundial») y sigue yendo directo. La fase dura `PRE_MATCH_STEPS` (3 s) o hasta A, y la cuenta la lleva el flujo (puro) — el componente solo le da pasos fijos, como a la victoria.

**Qué se ve (Task 9 lo dibuja; aquí la maqueta y los datos):** gradas arriba (banda de `PRE_MATCH_STANDS_H` px con público de puntos de colores **sacado de una semilla**), césped debajo; arriba el rival y abajo tu equipo — a dos, J2 arriba y J1 abajo —, once figuras de frente en fila (portero primero, en verde flúor), y sobre cada fila el nombre de la selección y su etiqueta (`TU EQUIPO`/`ORDENADOR`, `J1`/`J2`). **Ningún nombre de jugador.** La figura de frente es un mapa nuevo de 11 × 21 a 3 px (33 × 63 px, el doble de alta que el sprite de partido: es una «foto»), simétrico, horneado por paleta como el atlas.

**Files:**
- Modify: `components/games/football-screen/flow.ts` (imports `:1-9`; `FlowPhase` `:15-24`; comentario y `phaseGroup` `:26-48`; tras `LINEUP_BY_MODE` `:81-88`; `FlowState` `:90-103`; `createFlowState` `:105-111`; `flowReset` `:115-128`; `flowAfterModeBuilt` `:221-226`; `flowConfirmBracket` `:300-308`; nuevas al final de la sección `// ── match`)
- Modify: `components/games/football-screen/control-hints.ts` (import `:1-3`; `ControlHints` `:18-31`; `buildHints` `:44-63`; nueva constante tras `TWO_PLAYER_SCHEME_NOTE` `:72`)
- Create: `components/games/football-screen/front-sprite.ts`, `components/games/football-screen/pre-match.ts`
- Test: `components/games/football-screen/flow.test.ts` (imports `:1-18`; helper `start` `:55-69`; `:344-345`, `:439`, `:454`, `:462`; `describe('phaseGroup'` `:491-503`; describe nuevo al final)
- Test: `components/games/football-screen/control-hints.test.ts` (imports `:1-5`; `allTexts` `:7-13`; `it` nuevo)
- Test: `components/games/football-screen/front-sprite.test.ts`, `components/games/football-screen/pre-match.test.ts` (nuevos)

**Interfaces:**
- Consumes: `stepsFor` (`clock.ts`); `HumanSide` (`mode.ts`); `createRng` (`rng.ts`); `VIEW_W`, `VIEW_H` (`camera.ts`); `isSpriteChar`, `SpriteMap`, `SpritePalette` (`sprite-maps.ts`); `keyLabel`, `TWO_PLAYER_P1`, `TWO_PLAYER_P2`.
- Produces (los consume la Task 9):
  - `FlowPhase` con `'pre-match'`; `PRE_MATCH_BY_MODE: Readonly<Record<GameModeKind, boolean>>`; `PRE_MATCH_STEPS` (180); `FlowState.preMatchStepsLeft`; `flowStepPreMatch(f): boolean` (true en el paso en que la fase termina); `flowEndPreMatch(f): void`; `phaseGroup('pre-match') === 'match'`.
  - `ControlHints.preMatch` y `PRE_MATCH_HINT_TWO`.
  - `FRONT_GRID_W` 11, `FRONT_GRID_H` 21, `FRONT_PX` 3, `FRONT_W` 33, `FRONT_H` 63, `FRONT_STANDING`, `bakeFrontSprite(palette, fill): number`.
  - `PRE_MATCH_STANDS_H` 92, `PRE_MATCH_SLOT_W` 66, `PRE_MATCH_TOP_LABEL_Y` 112, `PRE_MATCH_TOP_FEET_Y` 230, `PRE_MATCH_BOTTOM_FEET_Y` 400, `PRE_MATCH_BOTTOM_LABEL_Y` 424, `PRE_MATCH_TAG_DY` 18, `PRE_MATCH_HINT_Y` 480; `preMatchSlotX(index, count)`, `preMatchBottomTeam(side)`, `preMatchTopTeam(side)`, `preMatchTag(side, team)`, `PRE_MATCH_TAGS`; `CROWD_SEED`, `CROWD_DOT`, `CROWD_BG`, `CROWD_COLORS`, `forEachCrowdDot(seed, w, h, fill): number`.

**Música (decidido aquí, a confirmar en QA):** `phaseGroup('pre-match')` es `'match'`: la pista de partido arranca con la foto de las formaciones, «para dar ambiente». Si Paco la quiere aún de menú, es cambiar una línea de `phaseGroup` y una del test.

- [ ] **Step 1: Escribir los tests que fallan**

**`flow.test.ts`.** Añade al import de `./flow` (`:10-18`) `PRE_MATCH_BY_MODE, PRE_MATCH_STEPS, flowEndPreMatch, flowStepPreMatch`, y al bloque de imports `import { stepsFor } from '../football-logic/clock';`. El helper `start` (`:55-69`) se parte en dos — el cuerpo de hoy pasa a llamarse `startRaw`, y `start` cruza la pantalla previa para que los tests de hoy sigan hablando del partido:

```ts
// Walks the selector to a mode and a team, and builds the mode as the component does.
function startRaw(kind: string, teamIndex: number, secondIndex = -1): { f: FlowState; m: GameMode } {
  const f = createFlowState();
  while (flowModeKind(f) !== kind) flowMoveMode(f, 1);
  flowConfirmMode(f);
  f.cursor = teamIndex;
  const first = flowConfirmTeam(f, BANK);
  if (first === 'next') {
    f.cursor = secondIndex;
    flowConfirmTeam(f, BANK);
  }
  if (f.phase === 'lineup') flowConfirmLineup(f);
  const m = flowBuildMode(f, BANK_IDS, SEED);
  flowAfterModeBuilt(f, m);
  return { f, m };
}

// The same, past the G15-19 line-up screen (A on it), so the tests that are about the
// match start in the match.
function start(kind: string, teamIndex: number, secondIndex = -1): { f: FlowState; m: GameMode } {
  const s = startRaw(kind, teamIndex, secondIndex);
  flowEndPreMatch(s.f);
  return s;
}
```

Ediciones de tests existentes (no suman tests):
- `:344-345` (`offers VER by default…`): `expect(flowConfirmBracket(f, m)).toBe('play');` se queda y `expect(f.phase).toBe('match');` pasa a `expect(f.phase).toBe('pre-match');`.
- `:439` (dentro del bucle de `a World Cup round won goes back to the bracket…`): tras `expect(flowConfirmBracket(f, m)).toBe('play');` añade `flowEndPreMatch(f);`.
- `:454` y `:462`: tras `flowConfirmBracket(lost.f, lost.m);` añade `flowEndPreMatch(lost.f);` y tras `flowConfirmBracket(abandoned.f, abandoned.m);` añade `flowEndPreMatch(abandoned.f);`.
- `describe('phaseGroup'` (`:491-503`), el comentario de encima dice ahora `All TEN phases of FlowPhase` y el `it` pasa a:

```ts
  it('match, spectate and pre-match are "match"; the other seven phases are "menu"', () => {
    const phases: FlowPhase[] = [
      'mode-select', 'team-select', 'lineup', 'draw', 'bracket', 'pre-match', 'match', 'spectate', 'victory', 'over',
    ];
    expect(phases.map(phaseGroup)).toEqual([
      'menu', 'menu', 'menu', 'menu', 'menu', 'match', 'match', 'match', 'menu', 'menu',
    ]);
  });
```

Y al final del fichero:

```ts
// ── G15-19 (matizada 23-sep): the line-up screen, "justo al pulsar JUGAR" ─────────
describe('the pre-match line-up (G15-19)', () => {
  it('a friendly, either one, goes to PRE-MATCH once its rival is drawn; the training goes straight to the match', () => {
    expect(PRE_MATCH_BY_MODE).toEqual({ 'friendly-cpu': true, 'friendly-2p': true, training: false, 'world-cup': true });
    const cpu = startRaw('friendly-cpu', 0);
    expect([cpu.f.phase, cpu.f.preMatchStepsLeft]).toEqual(['pre-match', PRE_MATCH_STEPS]);
    expect(modeAwayId(cpu.m)).not.toBe('espana');   // the rival is already drawn
    const two = startRaw('friendly-2p', 3, 11);
    expect(two.f.phase).toBe('pre-match');
    const training = startRaw('training', 7);
    expect([training.f.phase, training.f.preMatchStepsLeft]).toEqual(['match', 0]);
  });

  it('the World Cup\'s JUGAR -- A on the bracket on YOUR match -- goes to PRE-MATCH, and a CPU pair never does', () => {
    const { f, m } = start('world-cup', 1);
    flowConfirmDraw(f);
    expect(flowConfirmBracket(f, m)).toBe('spectate');
    expect(f.phase).toBe('spectate');
    flowSkipSpectate(f);
    skipCpuPairs(f, m);
    expect(flowConfirmBracket(f, m)).toBe('play');
    expect([f.phase, f.preMatchStepsLeft]).toEqual(['pre-match', PRE_MATCH_STEPS]);
  });

  it('PRE-MATCH ends by itself after PRE_MATCH_STEPS, or at once with A, and only from its own phase', () => {
    expect(PRE_MATCH_STEPS).toBe(stepsFor(3));
    const { f } = startRaw('friendly-cpu', 2);
    let ended = 0;
    for (let i = 0; i < PRE_MATCH_STEPS - 1; i++) if (flowStepPreMatch(f)) ended++;
    expect([ended, f.phase]).toEqual([0, 'pre-match']);
    expect(flowStepPreMatch(f)).toBe(true);
    expect([f.phase, f.preMatchStepsLeft]).toEqual(['match', 0]);
    expect(flowStepPreMatch(f)).toBe(false);          // a no-op in the match
    const a = startRaw('friendly-cpu', 2);
    flowEndPreMatch(a.f);
    expect([a.f.phase, a.f.preMatchStepsLeft]).toEqual(['match', 0]);
    const menu = createFlowState();
    flowEndPreMatch(menu);
    expect(flowStepPreMatch(menu)).toBe(false);
    expect(menu).toEqual(createFlowState());
  });
});
```

(`flowSkipSpectate` y `modeAwayId` ya están importados en `flow.test.ts`; si no, se añaden al import de `./flow` y de `../football-logic/mode` respectivamente.)

**`control-hints.test.ts`.** El import de `./control-hints` (`:2-4`) añade `PRE_MATCH_HINT_TWO`; `allTexts` (`:7-13`) añade `h.preMatch` al final de la lista. Nuevo `it` dentro de `describe('control hints per key scheme (G15-6)'`:

```ts
  it('PRE-MATCH (G15-19): each scheme names its own A, and the two-player line names both players\' A', () => {
    expect(CONTROL_HINTS.arrows.preMatch).toBe('A (J) · EMPEZAR');
    expect(CONTROL_HINTS.classic.preMatch).toBe('A (Z) · EMPEZAR');
    expect(PRE_MATCH_HINT_TWO).toBe('C (J1) O J (J2) · EMPEZAR');
    expect(PRE_MATCH_HINT_TWO).toContain(keyLabel(TWO_PLAYER_P1, 'a'));
    expect(PRE_MATCH_HINT_TWO).toContain(keyLabel(TWO_PLAYER_P2, 'a'));
  });
```

**`front-sprite.test.ts`** (nuevo):

```ts
import { describe, expect, it } from 'vitest';
import { FRONT_GRID_H, FRONT_GRID_W, FRONT_H, FRONT_PX, FRONT_STANDING, FRONT_W, bakeFrontSprite } from './front-sprite';
import { SPRITE_CHARS, createSpritePalette, mirrorMapX, writeSpritePalette } from './sprite-maps';

const KEEPER_GREEN = '#39ff14';

function firstRowWith(ch: string): number {
  for (let r = 0; r < FRONT_STANDING.length; r++) if (FRONT_STANDING[r].includes(ch)) return r;
  return -1;
}

describe('the standing front sprite (G15-19)', () => {
  it('is an 11 x 21 grid of palette letters, left-right symmetric like a player facing the camera', () => {
    expect(FRONT_STANDING.length).toBe(FRONT_GRID_H);
    for (const row of FRONT_STANDING) {
      expect(row.length).toBe(FRONT_GRID_W);
      for (const c of row) expect(c === '.' || SPRITE_CHARS.some((s) => s === c)).toBe(true);
    }
    expect(mirrorMapX(FRONT_STANDING)).toEqual([...FRONT_STANDING]);
    expect([FRONT_W, FRONT_H]).toEqual([FRONT_GRID_W * FRONT_PX, FRONT_GRID_H * FRONT_PX]);
  });

  it('wears every letter of the palette, hair above the face and boots at the bottom', () => {
    for (const ch of SPRITE_CHARS) expect([ch, firstRowWith(ch) >= 0]).toEqual([ch, true]);
    expect(firstRowWith('H')).toBeLessThan(firstRowWith('K'));
    expect(firstRowWith('F')).toBeGreaterThanOrEqual(FRONT_GRID_H - 2);
  });

  it('bakes every opaque cell once, FRONT_PX wide, inside FRONT_W x FRONT_H, in the kit it is handed (the keeper green too)', () => {
    const palette = createSpritePalette();
    writeSpritePalette(palette, KEEPER_GREEN, '#000000');
    let opaque = 0;
    for (const row of FRONT_STANDING) for (const c of row) if (c !== '.') opaque++;
    let outside = 0;
    let green = 0;
    let wrongSize = 0;
    const painted = bakeFrontSprite(palette, (x, y, size, color) => {
      if (x < 0 || y < 0 || x + size > FRONT_W || y + size > FRONT_H) outside++;
      if (size !== FRONT_PX) wrongSize++;
      if (color === KEEPER_GREEN) green++;
    });
    expect([painted, outside, wrongSize]).toEqual([opaque, 0, 0]);
    expect(green).toBeGreaterThan(0);
  });
});
```

**`pre-match.test.ts`** (nuevo):

```ts
import { describe, expect, it } from 'vitest';
import { TEAM_SIZE } from '../football-logic/teams';
import { VIEW_H, VIEW_W } from './camera';
import { FRONT_H, FRONT_W } from './front-sprite';
import {
  CROWD_COLORS, CROWD_DOT, CROWD_SEED, PRE_MATCH_BOTTOM_FEET_Y, PRE_MATCH_BOTTOM_LABEL_Y, PRE_MATCH_HINT_Y,
  PRE_MATCH_SLOT_W, PRE_MATCH_STANDS_H, PRE_MATCH_TAGS, PRE_MATCH_TAG_DY, PRE_MATCH_TOP_FEET_Y, PRE_MATCH_TOP_LABEL_Y,
  forEachCrowdDot, preMatchBottomTeam, preMatchSlotX, preMatchTag, preMatchTopTeam,
} from './pre-match';

describe('the pre-match screen (G15-19)', () => {
  it('your team is drawn below and the rival above, whichever side you play; at two, J1 below and J2 above', () => {
    expect([preMatchBottomTeam(0), preMatchTopTeam(0)]).toEqual([0, 1]);
    expect([preMatchBottomTeam(1), preMatchTopTeam(1)]).toEqual([1, 0]);   // the World Cup may put you away (S-PK3)
    expect([preMatchBottomTeam('both'), preMatchTopTeam('both')]).toEqual([0, 1]);
  });

  it('labels each row TU EQUIPO / ORDENADOR, or J1 / J2 at two -- and those four are the only words besides the team names', () => {
    expect([preMatchTag(0, 0), preMatchTag(0, 1)]).toEqual(['TU EQUIPO', 'ORDENADOR']);
    expect([preMatchTag(1, 1), preMatchTag(1, 0)]).toEqual(['TU EQUIPO', 'ORDENADOR']);
    expect([preMatchTag('both', 0), preMatchTag('both', 1)]).toEqual(['J1', 'J2']);
    // G15-19 matizada (Paco, 23-sep): SIN nombres de jugadores en esta pantalla.
    expect(PRE_MATCH_TAGS).toEqual(['TU EQUIPO', 'ORDENADOR', 'J1', 'J2']);
  });

  it('eleven figures fit across the canvas without touching, and stands, rows, labels and hint stack top to bottom', () => {
    expect(preMatchSlotX(0, TEAM_SIZE) - FRONT_W / 2).toBeGreaterThanOrEqual(0);
    expect(preMatchSlotX(TEAM_SIZE - 1, TEAM_SIZE) + FRONT_W / 2).toBeLessThanOrEqual(VIEW_W);
    expect(preMatchSlotX((TEAM_SIZE - 1) / 2, TEAM_SIZE)).toBe(VIEW_W / 2);
    expect(PRE_MATCH_SLOT_W).toBeGreaterThan(FRONT_W);
    expect(PRE_MATCH_TOP_LABEL_Y).toBeGreaterThan(PRE_MATCH_STANDS_H);
    expect(PRE_MATCH_TOP_LABEL_Y + PRE_MATCH_TAG_DY).toBeLessThan(PRE_MATCH_TOP_FEET_Y - FRONT_H);
    expect(PRE_MATCH_TOP_FEET_Y).toBeLessThan(PRE_MATCH_BOTTOM_FEET_Y - FRONT_H);
    expect(PRE_MATCH_BOTTOM_FEET_Y).toBeLessThan(PRE_MATCH_BOTTOM_LABEL_Y);
    expect(PRE_MATCH_BOTTOM_LABEL_Y + PRE_MATCH_TAG_DY).toBeLessThan(PRE_MATCH_HINT_Y);
    expect(PRE_MATCH_HINT_Y).toBeLessThan(VIEW_H);
  });

  it('the crowd comes from a seed: the same seed paints the same dots, another seed others, all inside the stands', () => {
    const a: number[] = [];
    const b: number[] = [];
    const c: number[] = [];
    const n = forEachCrowdDot(CROWD_SEED, VIEW_W, PRE_MATCH_STANDS_H, (x, y, color) => { a.push(x, y, CROWD_COLORS.indexOf(color)); });
    forEachCrowdDot(CROWD_SEED, VIEW_W, PRE_MATCH_STANDS_H, (x, y, color) => { b.push(x, y, CROWD_COLORS.indexOf(color)); });
    forEachCrowdDot(CROWD_SEED + 1, VIEW_W, PRE_MATCH_STANDS_H, (x, y, color) => { c.push(x, y, CROWD_COLORS.indexOf(color)); });
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
    expect(n).toBeGreaterThan(0);
    expect(n).toBe(a.length / 3);
    for (let i = 0; i < a.length; i += 3) {
      expect(a[i]).toBeGreaterThanOrEqual(0);
      expect(a[i] + CROWD_DOT).toBeLessThanOrEqual(VIEW_W);
      expect(a[i + 1]).toBeGreaterThanOrEqual(0);
      expect(a[i + 1] + CROWD_DOT).toBeLessThanOrEqual(PRE_MATCH_STANDS_H);
      expect(a[i + 2]).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Verlos fallar**

Run: `npx vitest run components/games/football-screen/flow.test.ts components/games/football-screen/control-hints.test.ts components/games/football-screen/front-sprite.test.ts components/games/football-screen/pre-match.test.ts`
Expected: FAIL — `flow.test.ts` entero por el import de `PRE_MATCH_BY_MODE`/`flowEndPreMatch` (no existen); `control-hints.test.ts` por `PRE_MATCH_HINT_TWO`; los dos nuevos por `Failed to resolve import`.

- [ ] **Step 3: Implementar**

**`flow.ts`.**
1. Imports: añade `import { stepsFor } from '../football-logic/clock';`.
2. `FlowPhase`: añade, entre `'bracket'` y `'match'`, `| 'pre-match'     // G15-19: the two elevens lined up before the kickoff, ~3 s or A`.
3. El comentario de `PhaseGroup` (`:26-31`) cambia «'match' is the only two phases with a game actually running -- a played match and a spectated CPU pair; the other six…» por «'match' is the phases with a game on: a played match, a spectated CPU pair, and since V15-5 the pre-match line-up that opens the human's match (G15-19: "para dar ambiente", so the match track starts with it); the other seven…». En `phaseGroup`, añade `case 'pre-match':` sobre `case 'match':`.
4. Tras `LINEUP_BY_MODE` (`:81-88`):

```ts
// G15-19 (matizada 23-sep): the line-up screen opens a friendly (either one) and every
// World Cup match the human plays -- "justo al pulsar JUGAR, con el rival ya sorteado" --
// for ~3 s or until A. The training has none (G15-19: "en amistoso y Mundial").
export const PRE_MATCH_BY_MODE: Readonly<Record<GameModeKind, boolean>> = {
  'friendly-cpu': true,
  'friendly-2p': true,
  training: false,
  'world-cup': true,
};
export const PRE_MATCH_STEPS = stepsFor(3);
```

5. `FlowState` añade, tras `lineupEditing`, `preMatchStepsLeft: number;   // G15-19: fixed steps left on the line-up screen`; `createFlowState` añade `preMatchStepsLeft: 0,` (en la misma línea que `lineupEditing: -1,`); `flowReset` añade `f.preMatchStepsLeft = 0;`.
6. Tras `flowAfterModeBuilt`, y cambiando su cuerpo:

```ts
// The human's match is about to start: through the line-up screen where the mode has one.
function enterHumanMatch(f: FlowState): void {
  if (PRE_MATCH_BY_MODE[flowModeKind(f)]) {
    f.phase = 'pre-match';
    f.preMatchStepsLeft = PRE_MATCH_STEPS;
    return;
  }
  f.phase = 'match';
}

// A mode with a bracket shows the draw first; one without goes to its match -- through
// the line-up screen of G15-19 when the mode has it.
export function flowAfterModeBuilt(f: FlowState, m: GameMode): void {
  if (f.phase !== 'team-select' && f.phase !== 'lineup') return;
  if (modeBracket(m) === null) enterHumanMatch(f);
  else f.phase = 'draw';
}
```

7. En `flowConfirmBracket`, `else if (action === 'play') f.phase = 'match';` pasa a `else if (action === 'play') enterHumanMatch(f);`, y su comentario «'play' moves to the match» a «'play' moves to the match, through the line-up screen (G15-19)».
8. Al final de la sección `// ── match ──` (tras `flowExitMatch`):

```ts
// ── pre-match (G15-19) ──────────────────────────────────────────────────────────

// One fixed step of the line-up screen (the component runs it at the match's step
// rate). true on the step the screen ends and the match begins.
export function flowStepPreMatch(f: FlowState): boolean {
  if (f.phase !== 'pre-match') return false;
  f.preMatchStepsLeft--;
  if (f.preMatchStepsLeft > 0) return false;
  flowEndPreMatch(f);
  return true;
}

// A on the line-up screen: straight to the kickoff.
export function flowEndPreMatch(f: FlowState): void {
  if (f.phase !== 'pre-match') return;
  f.phase = 'match';
  f.preMatchStepsLeft = 0;
}
```

**`control-hints.ts`.** El import (`:1-3`) añade `TWO_PLAYER_P2`. `ControlHints` añade, tras `victory`, `readonly preMatch: string;        // G15-19: the line-up screen`. `buildHints` añade, tras `victory: …,`, `preMatch: \`A (${a}) · EMPEZAR\`,`. Tras `TWO_PLAYER_SCHEME_NOTE` (`:72`):

```ts
// G15-19: at two the line-up screen takes either player's A (the component routes both
// tables there), so the hint names both -- built from the tables, never typed by hand.
export const PRE_MATCH_HINT_TWO = `${keyLabel(TWO_PLAYER_P1, 'a')} (J1) O ${keyLabel(TWO_PLAYER_P2, 'a')} (J2) · EMPEZAR`;
```

**`front-sprite.ts`** (nuevo):

```ts
import { isSpriteChar, type SpriteMap, type SpritePalette } from './sprite-maps';

// G15-19: the pre-match line-up shows the two elevens STANDING, FACING the camera -- the
// one pose the top-down atlas does not have. Same pixel art and same palette letters as
// sprite-maps.ts (O outline, H hair, K skin, S shirt = kit primary or the keeper's green,
// T trim = kit secondary, F boots), baked per kit on the event of entering the screen,
// never per frame. 11 x 21 cells at 3 px: a "photo", twice as tall as a match sprite.
export const FRONT_GRID_W = 11;
export const FRONT_GRID_H = 21;
export const FRONT_PX = 3;
export const FRONT_W = FRONT_GRID_W * FRONT_PX;   // 33
export const FRONT_H = FRONT_GRID_H * FRONT_PX;   // 63

export const FRONT_STANDING: SpriteMap = [
  '....OOO....',
  '...OHHHO...',
  '..OHHHHHO..',
  '..OHKKKHO..',
  '..OKKKKKO..',
  '...OKKKO...',
  '..OOTTTOO..',
  '.OSSSTSSSO.',
  'OSSSSSSSSSO',
  'OKSSSSSSSKO',
  'OKOSSSSSOKO',
  'OKOSSSSSOKO',
  '.O.OTTTO.O.',
  '...OTTTO...',
  '...OTOTO...',
  '...OKOKO...',
  '...OKOKO...',
  '...OSOSO...',
  '...OSOSO...',
  '..OFFOFFO..',
  '..OOO.OOO..',
];

// Hands every opaque cell to `fill`, at its position inside a FRONT_W x FRONT_H canvas.
// Returns how many it painted (the tests count; the component's fill does the fillRect).
export function bakeFrontSprite(
  palette: Readonly<SpritePalette>,
  fill: (x: number, y: number, size: number, color: string) => void,
): number {
  let painted = 0;
  for (let r = 0; r < FRONT_STANDING.length; r++) {
    const row = FRONT_STANDING[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (!isSpriteChar(ch)) continue;
      fill(c * FRONT_PX, r * FRONT_PX, FRONT_PX, palette[ch]);
      painted++;
    }
  }
  return painted;
}
```

**`pre-match.ts`** (nuevo):

```ts
import type { HumanSide } from '../football-logic/mode';
import { createRng } from '../football-logic/rng';
import { VIEW_W } from './camera';

// G15-19 (matizada 23-sep): the line-up screen before the kickoff -- the two elevens
// standing in a row with their kits (the keeper in the fluor green), the rival above and
// your team below, the selection's name and TU EQUIPO / ORDENADOR (J1 / J2 at two) over
// each row. NO player names. Simple stands and grass behind. "Parecido, no copia" of the
// Tehkan line-up photo Paco shared. Pure: layout, who goes where, the four words, and the
// crowd dots from a SEED (createRng: nothing here is unseeded).

// ── Layout (800 x 500) ───────────────────────────────────────────────────────────
export const PRE_MATCH_STANDS_H = 92;
export const PRE_MATCH_SLOT_W = 66;            // eleven slots = 726 px, centred
export const PRE_MATCH_TOP_LABEL_Y = 112;      // the selection's name; its tag PRE_MATCH_TAG_DY below
export const PRE_MATCH_TOP_FEET_Y = 230;       // the figures stand ON this line
export const PRE_MATCH_BOTTOM_FEET_Y = 400;
export const PRE_MATCH_BOTTOM_LABEL_Y = 424;
export const PRE_MATCH_TAG_DY = 18;
export const PRE_MATCH_HINT_Y = 480;

export function preMatchSlotX(index: number, count: number): number {
  return VIEW_W / 2 + (index - (count - 1) / 2) * PRE_MATCH_SLOT_W;
}

// ── Who goes where ───────────────────────────────────────────────────────────────
// Your team below, the rival above. Team 1 is yours only when the World Cup puts you away
// (S-PK3); at two, J1 (team 0) below and J2 above. 'none' (a CPU pair) never gets here.
export function preMatchBottomTeam(side: HumanSide): 0 | 1 {
  return side === 1 ? 1 : 0;
}

export function preMatchTopTeam(side: HumanSide): 0 | 1 {
  return preMatchBottomTeam(side) === 0 ? 1 : 0;
}

export const PRE_MATCH_YOU = 'TU EQUIPO';
export const PRE_MATCH_CPU = 'ORDENADOR';
export const PRE_MATCH_P1 = 'J1';
export const PRE_MATCH_P2 = 'J2';
// The only words of this screen besides the two selection names.
export const PRE_MATCH_TAGS: readonly string[] = [PRE_MATCH_YOU, PRE_MATCH_CPU, PRE_MATCH_P1, PRE_MATCH_P2];

// Constants only: draw() may call it every frame without building a string.
export function preMatchTag(side: HumanSide, team: 0 | 1): string {
  if (side === 'both') return team === 0 ? PRE_MATCH_P1 : PRE_MATCH_P2;
  return side === team ? PRE_MATCH_YOU : PRE_MATCH_CPU;
}

// ── The stands: rows of crowd dots on a dark band, baked ONCE at mount ─────────────
export const CROWD_SEED = 0x2f6b1d3;
export const CROWD_DOT = 3;
export const CROWD_EMPTY_CHANCE = 0.2;
export const CROWD_BG = '#262633';
export const CROWD_COLORS: readonly string[] = ['#c94c4c', '#e8c547', '#4c7bc9', '#e8e8e8', '#6e6e82', '#d98a3d'];

// Every other cell of a CROWD_DOT grid, rows staggered, a few left empty; the colour of
// each dot from the same Rng. Returns how many dots it handed to `fill`.
export function forEachCrowdDot(
  seed: number, w: number, h: number, fill: (x: number, y: number, color: string) => void,
): number {
  const rng = createRng(seed);
  const pitch = CROWD_DOT * 2;
  let n = 0;
  for (let row = 0; row * pitch + 1 + CROWD_DOT <= h; row++) {
    const y = row * pitch + 1;
    for (let x = 1 + (row % 2) * CROWD_DOT; x + CROWD_DOT <= w; x += pitch) {
      if (rng() < CROWD_EMPTY_CHANCE) continue;
      fill(x, y, CROWD_COLORS[Math.floor(rng() * CROWD_COLORS.length)]);
      n++;
    }
  }
  return n;
}
```

- [ ] **Step 4: Verlos pasar**

Run: `npx vitest run components/games/football-screen/flow.test.ts components/games/football-screen/control-hints.test.ts components/games/football-screen/front-sprite.test.ts components/games/football-screen/pre-match.test.ts`
Expected: PASS, los cuatro enteros (los tests de hoy de `flow.test.ts` incluidos, gracias a `start` y a las cuatro ediciones).

- [ ] **Step 5: Controles negativos (ejecutar y REVERTIR cada uno)**

1. `PRE_MATCH_BY_MODE.training = true` → FALLA el primero nuevo de `flow.test.ts` (el `toEqual` de la tabla y `['pre-match', 180]` frente a `['match', 0]`).
2. `flowConfirmBracket` con `f.phase = 'match'` para `'play'` (como hoy) → FALLA el segundo (`expected [ 'match', 0 ] to deeply equal [ 'pre-match', 180 ]`) y el `:344-345` editado.
3. `flowStepPreMatch` con `>= 0` en vez de `> 0` → FALLA el tercero (termina un paso tarde: `expected false to be true`).
4. `preMatchBottomTeam` devolviendo siempre 0 → FALLA el primero de `pre-match.test.ts` (`expected [ 0, 1 ] to deeply equal [ 1, 0 ]`).
5. `forEachCrowdDot` con `Math.random()` en vez de `rng()` → FALLA el de las gradas (`expected [...] to deeply equal [...]`, dos corridas distintas). **Revertir y comprobar `grep Math.random` vacío.**
6. Un pixel cambiado en `FRONT_STANDING` (fila 7, `'.OSSSTSSSO.'` → `'.OSSSTSSSS.'`) → FALLA la simetría de `front-sprite.test.ts`.
7. `PRE_MATCH_HINT_TWO` escrito a mano con `'V (J1) …'` → FALLA el de `control-hints.test.ts`.

- [ ] **Step 6: Compuertas**

```bash
npx vitest run
npx tsc --noEmit 2>&1 | grep "error TS"
npx eslint components/games/football-screen/flow.ts components/games/football-screen/flow.test.ts components/games/football-screen/control-hints.ts components/games/football-screen/control-hints.test.ts components/games/football-screen/front-sprite.ts components/games/football-screen/front-sprite.test.ts components/games/football-screen/pre-match.ts components/games/football-screen/pre-match.test.ts
git diff --name-only 77aecd7 -- components/games/football-logic/ | sort
grep -rn "Math\.random(" components/games/football-logic/ components/games/football-screen/
```
Expected: **1557 tests en 94 ficheros** (1546 + 3 + 1 + 3 + 4); `tsc`: **1 error**, `VaultWorldCupGame.tsx` `menuAction` TS2366 (sin `case 'pre-match'`), declarado, lo cierra la Task 9; `eslint` sin salida; motor, las tres líneas; `Math.random` vacío.

- [ ] **Step 7: Ledger**

`Task V15-5-7: fase 'pre-match' (amistosos y Mundial, 180 pasos o A; training directo), sprite de frente 11×21 a 3 px, maqueta, etiquetas sin nombres, gradas por semilla, pistas; 1557 / 94; tsc 1 error declarado (cierra T9); 7 controles revertidos.`

---
### Task V15-5-8: el confeti y los fuegos de la victoria — más densos, con el kit, oro y el destello de la copa (G15-21, puro)

**Qué cambia en `particles.ts` (reutilizado, como pide G15-21).** (1) Cada depósito lleva **su propia paleta** (6 colores, la de hoy por defecto), reescrita en el sitio para el kit del ganador (amistoso) o para oro + kit (Mundial); el índice de color sigue saliendo de `rng() * longitud`, así que las tiradas del cuarto stream no cambian de forma. (2) **`startConfettiRain`**: el confeti arranca ENCIMA de la vista y cae sobre el campo (G15-21: «empieza sobre el campo al pitido final»); `startFx('confetti')` se queda como está. (3) **Más denso**: `CONFETTI_COUNT` 400 (el depósito de hoy era `PARTICLE_COUNT` 240), `FIREWORK_POOL_COUNT` 320, ráfagas de 50 cada 30 pasos (hoy 40 cada 45). (4) **`cupFlashAlpha`**: el destello dorado de la copa, una onda triangular de 90 pasos. El amistoso se queda con confeti (más denso, kit); el Mundial suma fuegos + confeti oro y kit + destello — la pantalla lo deriva de `modeFxKind` (`'fireworks'` = Mundial), **sin tocar `mode.ts`**.

**Files:**
- Modify: `components/games/football-screen/particles.ts` (`PARTICLE_COUNT` `:13`; `FX_COLORS` `:35`; `FIREWORK_BURST_*` y `FIREWORK_LIFE_MAX` `:46-52`; `ParticlePool`/`createParticlePool` `:60-83`; `startFx` `:92-106`; `burst` `:108-126`; nuevas al final)
- Test: `components/games/football-screen/particles.test.ts` (imports `:4-7`; describe nuevo al final)

**Interfaces:**
- Consumes: `Rng`, `VIEW_W`, `VIEW_H`.
- Produces (los consume la Task 9): `ParticlePool.palette: string[]`; `CONFETTI_COUNT` (400), `FIREWORK_POOL_COUNT` (320), `FIREWORK_BURST_STEPS` (30), `FIREWORK_BURST_SIZE` (50), `FIREWORK_LIFE_MAX` (70, ahora exportada), `FX_GOLD`, `FX_GOLD_LIGHT`; `type ConfettiStyle = 'kit' | 'gold-kit'`; `writeConfettiPalette(pool, style, primary, secondary): void`; `startConfettiRain(pool, rng): void`; `CUP_FLASH_PERIOD` (90); `cupFlashAlpha(step): number`. `FX_COLORS`, `createParticlePool()`, `startFx` y `stepFx` conservan su firma (el `.tsx` de hoy sigue compilando).

- [ ] **Step 1: Escribir los tests que fallan**

En `components/games/football-screen/particles.test.ts`, el import de `./particles` (`:4-7`) pasa a:

```ts
import {
  CONFETTI_COUNT, CUP_FLASH_PERIOD, FIREWORK_BURST_SIZE, FIREWORK_BURST_STEPS, FIREWORK_LIFE_MAX, FIREWORK_POOL_COUNT,
  FX_COLORS, FX_DIR_COUNT, FX_DIR_X, FX_DIR_Y, FX_GOLD, FX_GOLD_LIGHT, FX_SEED_SALT, PARTICLE_COUNT,
  activeCount, createParticlePool, cupFlashAlpha, fxSeedFor, startConfettiRain, startFx, stepFx, writeConfettiPalette,
} from './particles';
```

Y al final:

```ts
// ── G15-21: the victory, denser, in the winner's kit and in gold ─────────────────
describe('the victory celebration (G15-21)', () => {
  it('every pool carries its own palette (v1\'s colours by default), rewritten in place for the kit or for gold + kit', () => {
    const pool = createParticlePool(8);
    expect(pool.palette).toEqual([...FX_COLORS]);
    expect(pool.palette).not.toBe(FX_COLORS);
    const palette = pool.palette;
    writeConfettiPalette(pool, 'kit', '#d40000', '#ffcc00');
    expect(pool.palette).toBe(palette);
    expect(pool.palette.length).toBe(FX_COLORS.length);
    expect(new Set(pool.palette)).toEqual(new Set(['#d40000', '#ffcc00', '#ffffff']));
    expect(pool.palette.filter((c) => c === '#d40000' || c === '#ffcc00').length).toBeGreaterThanOrEqual(4);
    writeConfettiPalette(pool, 'gold-kit', '#d40000', '#ffcc00');
    expect(pool.palette).toContain('#d40000');
    expect(pool.palette).toContain('#ffcc00');
    expect(pool.palette.filter((c) => c === FX_GOLD || c === FX_GOLD_LIGHT).length).toBeGreaterThanOrEqual(3);
    startFx(pool, 'confetti', createRng(5));
    for (let i = 0; i < pool.count; i++) expect(pool.color[i]).toBeLessThan(pool.palette.length);
  });

  it('startConfettiRain starts every particle ABOVE the view, and two seconds later it is raining on the pitch', () => {
    const pool = createParticlePool(CONFETTI_COUNT);
    const rng = createRng(fxSeedFor(4));
    startConfettiRain(pool, rng);
    expect(activeCount(pool)).toBe(CONFETTI_COUNT);
    for (let i = 0; i < pool.count; i++) {
      expect(pool.y[i]).toBeLessThan(0);
      expect(pool.y[i]).toBeGreaterThanOrEqual(-VIEW_H);
      expect(pool.x[i]).toBeGreaterThanOrEqual(0);
      expect(pool.x[i]).toBeLessThanOrEqual(VIEW_W);
      expect(pool.vy[i]).toBeGreaterThan(0);
    }
    for (let step = 0; step < 120; step++) stepFx(pool, 'confetti', rng);
    let inView = 0;
    for (let i = 0; i < pool.count; i++) if (pool.y[i] >= 0) inView++;
    expect(inView).toBeGreaterThan(0);
    expect(inView).toBeLessThan(CONFETTI_COUNT);
  });

  it('is denser than v1: more confetti, a bigger fireworks pool, bigger and more frequent bursts that still all fit', () => {
    expect(CONFETTI_COUNT).toBeGreaterThan(PARTICLE_COUNT);
    expect(FIREWORK_POOL_COUNT).toBeGreaterThan(PARTICLE_COUNT);
    expect(FIREWORK_BURST_SIZE / FIREWORK_BURST_STEPS).toBeGreaterThan(40 / 45);   // v1: 40 every 45 steps
    // Every spark of every burst still alive fits: the pool never refuses a burst.
    expect(Math.ceil(FIREWORK_LIFE_MAX / FIREWORK_BURST_STEPS) * FIREWORK_BURST_SIZE).toBeLessThanOrEqual(PARTICLE_COUNT);
    expect(FIREWORK_POOL_COUNT).toBeGreaterThanOrEqual(PARTICLE_COUNT);
  });

  it('cupFlashAlpha: a gold glint that is 0 when each period starts, 1 halfway, and never leaves [0, 1]', () => {
    expect(cupFlashAlpha(0)).toBe(0);
    expect(cupFlashAlpha(CUP_FLASH_PERIOD / 2)).toBe(1);
    expect(cupFlashAlpha(CUP_FLASH_PERIOD)).toBe(0);
    expect(cupFlashAlpha(CUP_FLASH_PERIOD * 7 + CUP_FLASH_PERIOD / 2)).toBe(1);
    for (let s = 0; s < CUP_FLASH_PERIOD * 3; s++) {
      const a = cupFlashAlpha(s);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Verlos fallar**

Run: `npx vitest run components/games/football-screen/particles.test.ts`
Expected: FAIL **test a test, no el fichero entero** (M1: vitest resuelve los exports que faltan —`CONFETTI_COUNT`, `writeConfettiPalette`…— como `undefined`, no tumba la carga). Medido en el pre-vuelo: los 4 `it` nuevos en rojo; los de antes, en verde.

- [ ] **Step 3: Implementar**

En `components/games/football-screen/particles.ts`:

1. Tras `export const FX_COLORS…` (`:35`):

```ts
// G15-21 (V15-5): the World Cup's confetti is gold + the champion's kit.
export const FX_GOLD = '#ffcf3a';
export const FX_GOLD_LIGHT = '#fff1a8';
// G15-21 "más denso": v1's one pool was PARTICLE_COUNT (240), still the default of
// createParticlePool. The victory now runs the confetti on its own pool and, in the World
// Cup, the fireworks on another, both created ONCE by the component.
export const CONFETTI_COUNT = 400;
export const FIREWORK_POOL_COUNT = 320;
```

2. Las constantes de los fuegos (`:46-52`) pasan a (más frecuentes y más grandes; `FIREWORK_LIFE_MAX` se exporta para el test de cabida):

```ts
export const FIREWORK_BURST_STEPS = 30;   // G15-21 "más densos": v1 burst every 45
export const FIREWORK_BURST_SIZE = 50;    // v1: 40
const FIREWORK_SPEED_MIN = 2;
const FIREWORK_SPEED_MAX = 5;
const FIREWORK_GRAVITY = 0.06;
const FIREWORK_LIFE_MIN = 40;
export const FIREWORK_LIFE_MAX = 70;
```
(y en el comentario que las precede, `a burst of FIREWORK_BURST_SIZE every FIREWORK_BURST_STEPS` sigue siendo verdad; cambia solo «dies after 40-70 steps» si hiciera falta — no hace falta.)

3. `ParticlePool` añade, tras `size`, `palette: string[];  // G15-21: this pool's colours; `color` indexes it (FX_COLORS by default)`, y `createParticlePool` añade `palette: FX_COLORS.slice(),` (una copia: escribir el kit en un depósito no puede tocar la constante ni el otro depósito).

4. En `startFx` y en `burst`, `Math.floor(rng() * FX_COLORS.length)` pasa a `Math.floor(rng() * pool.palette.length)` (las dos ocurrencias). Con la paleta por defecto la longitud es la misma (6): la secuencia de tiradas de hoy no cambia.

5. Al final del fichero:

```ts
// ── G15-21 (V15-5) ───────────────────────────────────────────────────────────────

export type ConfettiStyle = 'kit' | 'gold-kit';

// In place, on the event of the final whistle: the friendly's confetti in the winner's
// kit (and a little white), the World Cup's in gold with the kit. Same length as FX_COLORS.
export function writeConfettiPalette(pool: ParticlePool, style: ConfettiStyle, primary: string, secondary: string): void {
  const p = pool.palette;
  if (style === 'kit') {
    p[0] = primary;
    p[1] = secondary;
    p[2] = primary;
    p[3] = secondary;
    p[4] = primary;
    p[5] = '#ffffff';
    return;
  }
  p[0] = FX_GOLD;
  p[1] = FX_GOLD_LIGHT;
  p[2] = FX_GOLD;
  p[3] = primary;
  p[4] = secondary;
  p[5] = FX_GOLD;
}

// G15-21 "el confeti empieza sobre el campo al pitido final": the same confetti as
// startFx, but every particle starts ABOVE the view (y in [-VIEW_H, 0)) and rains in over
// the pitch -- it starts during the FINAL caption and carries on into the victory screen.
export function startConfettiRain(pool: ParticlePool, rng: Rng): void {
  for (let i = 0; i < pool.count; i++) {
    pool.x[i] = rng() * VIEW_W;
    pool.y[i] = -VIEW_H + rng() * (VIEW_H - 1);
    pool.vx[i] = (rng() - 0.5) * 2 * CONFETTI_SWAY;
    pool.vy[i] = CONFETTI_FALL_MIN + rng() * (CONFETTI_FALL_MAX - CONFETTI_FALL_MIN);
    pool.life[i] = CONFETTI_LIFE;
    pool.color[i] = Math.floor(rng() * pool.palette.length);
    pool.size[i] = 2 + Math.floor(rng() * 3);
  }
  pool.burstIn = 0;
}

// G15-21 "destello dorado en la copa": a triangle wave, 0 -> 1 -> 0 every CUP_FLASH_PERIOD
// steps of the victory screen. No trigonometry.
export const CUP_FLASH_PERIOD = 90;

// `step` counts up from 0 (VaultWorldCupGame's victorySteps), so one modulo is enough.
export function cupFlashAlpha(step: number): number {
  const t = (step % CUP_FLASH_PERIOD) / CUP_FLASH_PERIOD;
  return t <= 0.5 ? t * 2 : (1 - t) * 2;
}
```

(`-VIEW_H + rng() * (VIEW_H - 1)` deja la `y` en `[-500, -1)`: estrictamente por encima de la vista con cualquier `rng()` en `[0, 1)`.)

- [ ] **Step 4: Verlos pasar**

Run: `npx vitest run components/games/football-screen/particles.test.ts`
Expected: PASS, todo el fichero — incluidos los de hoy de los fuegos, que usan las constantes por nombre: con 50 por ráfaga cada 30 pasos y vidas de 40-70, la primera ráfaga sigue viva entera a los 30 pasos (`<= 50`), la segunda llega en el paso 31 (`> 25`) y caben tres vivas a la vez (150 ≤ 240).

- [ ] **Step 5: Controles negativos (ejecutar y REVERTIR cada uno)**

1. `createParticlePool` con `palette: FX_COLORS` sin copiar → FALLA el primero en `not.toBe(FX_COLORS)` (vitest no comprueba tipos; `tsc` además lo rechazaría por `readonly`).
2. `startConfettiRain` llamando a `startFx(pool, 'confetti', rng)` → FALLA el segundo (`expected <una y ≥ 0> to be less than 0`).
3. `FIREWORK_BURST_SIZE = 90` → FALLA el tercero (`expected 270 to be less than or equal to 240`).
4. `cupFlashAlpha` sin la bajada (`return t * 2;`) → FALLA el cuarto (`expected 1.0… to be less than or equal to 1` a partir de la mitad del periodo, y `cupFlashAlpha(CUP_FLASH_PERIOD * 7 + 45)` sigue dando 1 pero el bucle sale de `[0, 1]`).

- [ ] **Step 6: Compuertas**

```bash
npx vitest run
npx tsc --noEmit 2>&1 | grep "error TS"
npx eslint components/games/football-screen/particles.ts components/games/football-screen/particles.test.ts
git diff --name-only 77aecd7 -- components/games/football-logic/ | sort
grep -rn "Math\.random(" components/games/football-logic/ components/games/football-screen/
```
Expected: **1561 tests en 94 ficheros**; `tsc`: el mismo **1** error declarado de la Task 7 y ninguno más; `eslint` sin salida; motor, las tres líneas; `Math.random` vacío.

- [ ] **Step 7: Ledger**

`Task V15-5-8: particles.ts — paleta por depósito (kit / oro+kit), lluvia de confeti desde arriba, CONFETTI_COUNT 400, fuegos 320 con ráfagas 50/30, cupFlashAlpha; 1561 / 94.`

---
### Task V15-5-9: cableado — la red que ondula, la pantalla previa y la victoria (pantalla)

**Sin tests nuevos** (`.tsx`). Cierra el error de `tsc` de la Task 7. Lo verifican `tsc`, `eslint`, la revisión del Step 6 y el QA jugado.

**Los números de línea del `.tsx` de esta tarea son los de `77aecd7`**: la Task 5 ya ha movido el fichero (el import de `particles` está en `:85` y `CUP_COLOR` en `:291`, y todo lo de más abajo se ha desplazado en proporción). Manda el texto que se cita, no el número.

**Files:**
- Modify: `components/games/VaultWorldCupGame.tsx` — imports (flow, particles, control-hints, nuevos de net-ripple, pre-match, front-sprite); constantes de color; funciones de módulo junto a `bakeAtlas` (`:344-352`); estado del montaje (`fxPool` `:535-540`, junto a los atlas `:519-528`); `startMatch`; `startHumanMatch` (`:725-734`); `startVictory` (`:805-820`); `continueFromVictory` (`:823-827`); `runStep` (puntos 7 y 9); `stepCaptionsOnly`; `update` (`:1222-1259`); `drawPitch` (la malla, `:1333-1349`); `drawMatch` (`:2154-2164`); `drawVictory` (`:2111-2152`); `draw` (`:2166-2180`); `menuAction` (`:2244-2316`); `handleKeyDown` (`:2474-2479`).

**Interfaces:**
- Consumes: Task 6 (`net-ripple.ts`), Task 7 (`flowStepPreMatch`, `flowEndPreMatch`, `CONTROL_HINTS[…].preMatch`, `PRE_MATCH_HINT_TWO`, `front-sprite.ts`, `pre-match.ts`), Task 8 (`particles.ts`); de la Task 5, `preStep`, `goalScoredThisStep` en `runStep`.
- Produces: el paso completo.

- [ ] **Step 1: Imports, constantes y funciones de módulo**

1. El import de `./football-screen/flow` añade `flowEndPreMatch, flowStepPreMatch`.
2. El de `./football-screen/control-hints` añade `PRE_MATCH_HINT_TWO`.
3. El de `./football-screen/particles` (`:85` tras la Task 5; en `77aecd7` era `:81`) pasa a:

```ts
import {
  CONFETTI_COUNT, FIREWORK_POOL_COUNT, createParticlePool, cupFlashAlpha, fxSeedFor, startConfettiRain, startFx, stepFx,
  writeConfettiPalette, type ParticlePool,
} from './football-screen/particles';
```
(`FX_COLORS` sale: cada depósito pinta con su `palette`.)

4. Nuevos:

```ts
import { FRONT_H, FRONT_W, bakeFrontSprite } from './football-screen/front-sprite';
import {
  createNetRipple, createRippleVertex, beginNetRipple, resetNetRipple, rippleVertex, stepNetRipple,
  RIPPLE_SEGMENTS_ACROSS, RIPPLE_SEGMENTS_DEEP,
} from './football-screen/net-ripple';
import {
  CROWD_BG, CROWD_DOT, CROWD_SEED, PRE_MATCH_BOTTOM_FEET_Y, PRE_MATCH_BOTTOM_LABEL_Y, PRE_MATCH_HINT_Y,
  PRE_MATCH_STANDS_H, PRE_MATCH_TAG_DY, PRE_MATCH_TOP_FEET_Y, PRE_MATCH_TOP_LABEL_Y, forEachCrowdDot,
  preMatchBottomTeam, preMatchSlotX, preMatchTag, preMatchTopTeam,
} from './football-screen/pre-match';
```
(Ordena los nombres dentro de cada llave como pida `eslint` si el repo lo exige; hoy no hay regla de orden.)

5. Constante de color, junto a `CUP_COLOR` (`:291` tras la Task 5; en `77aecd7` era `:284`): `const CUP_FLASH = '#fff6c8';   // G15-21: the gold glint on the cup`.

6. Junto a `createAtlasCanvas`/`bakeAtlas` (`:335-352`):

```ts
// G15-19: one FRONT_W x FRONT_H canvas per standing figure (home, away, keeper), created
// ONCE per mount; home and away are re-baked on entering the line-up screen, from the
// resolved kits of that match -- never per frame.
function createFrontCanvas(): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = FRONT_W;
  el.height = FRONT_H;
  return el;
}

function bakeFront(front: HTMLCanvasElement, palette: Readonly<SpritePalette>): void {
  const c = front.getContext('2d');
  if (c === null) return;
  c.clearRect(0, 0, front.width, front.height);
  bakeFrontSprite(palette, (x, y, size, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, size, size);
  });
}

// G15-19: the stands of the line-up screen, ONCE per mount, from CROWD_SEED (no
// Math.random: the same crowd every time).
function bakeStands(): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = VIEW_W;
  el.height = PRE_MATCH_STANDS_H;
  const c = el.getContext('2d');
  if (c === null) return el;
  c.fillStyle = CROWD_BG;
  c.fillRect(0, 0, VIEW_W, PRE_MATCH_STANDS_H);
  forEachCrowdDot(CROWD_SEED, VIEW_W, PRE_MATCH_STANDS_H, (x, y, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, CROWD_DOT, CROWD_DOT);
  });
  return el;
}
```

- [ ] **Step 2: Estado del montaje, `startMatch`, `startHumanMatch`, victoria**

1. Tras `bakeMatchAtlases();` (`:528`):

```ts
    // G15-19: the three standing figures and the stands, created ONCE. The keeper's is
    // baked once and for all (G12-1), home and away on entering the line-up screen.
    const frontHome = createFrontCanvas();
    const frontAway = createFrontCanvas();
    const frontKeeper = createFrontCanvas();
    writeSpritePalette(spritePalette, GK_KIT_PRIMARY, GK_KIT_SECONDARY);
    bakeFront(frontKeeper, spritePalette);
    const stands = bakeStands();
    // G15-14: the rippling net and the vertex it writes, created ONCE.
    const ripple = createNetRipple();
    const rippleOut = createRippleVertex();
```
(`writeSpritePalette` deja la paleta en el verde del portero; no importa: `bakeMatchAtlases` y `refreshPreMatchView` la reescriben antes de cada uso.)

2. Sustituye `const fxPool = createParticlePool();` y su comentario (`:535-536`) por:

```ts
    // The fourth stream and the two victory pools (criterion 20: created once). G15-21:
    // the confetti runs alone in a friendly, with the fireworks in the World Cup, and both
    // start at the final whistle, over the pitch, then carry on into the victory screen.
    const confettiPool = createParticlePool(CONFETTI_COUNT);
    const fireworkPool = createParticlePool(FIREWORK_POOL_COUNT);
    let fxLive = false;
    let victorySteps = 0;
```

3. En `startMatch`, junto a `resetCelebration(celebration);` (Task 5): `resetNetRipple(ripple);` y `fxLive = false;`.

4. `startHumanMatch` (`:725-734`) añade al final:

```ts
      // G15-19: the line-up screen draws this very run (frozen until the flow says
      // 'match'), so its figures are baked now, from the kits the match will wear.
      if (flow.phase === 'pre-match') refreshPreMatchView();
```

y, tras `startHumanMatch`:

```ts
    // G15-19, on the event of entering the line-up screen: the two standing figures in the
    // RESOLVED kits (the away side inverted when they clash, QA 15-sep), never per frame.
    function refreshPreMatchView(): void {
      writeSpritePalette(spritePalette, matchKits[HOME].primary, matchKits[HOME].secondary);
      bakeFront(frontHome, spritePalette);
      writeSpritePalette(spritePalette, matchKits[AWAY].primary, matchKits[AWAY].secondary);
      bakeFront(frontAway, spritePalette);
    }

    // G15-21, on the event of the final whistle of a human win with a victory screen to
    // follow (flow.after === 'victory'): the confetti starts raining over the pitch NOW,
    // in the winner's own kit -- gold and kit, plus the fireworks, in the World Cup.
    function beginVictoryFx(): void {
      fxKind = modeFxKind(mode);
      victoryTeam = teamOf(modeVictoryTeamId(mode, run.match));
      const worldCup = fxKind === 'fireworks';
      writeConfettiPalette(confettiPool, worldCup ? 'gold-kit' : 'kit', victoryTeam.kit.primary, victoryTeam.kit.secondary);
      startConfettiRain(confettiPool, fxRng);
      if (worldCup) startFx(fireworkPool, 'fireworks', fxRng);
      fxLive = true;
      victorySteps = 0;
    }

    function stepVictoryFx(): void {
      stepFx(confettiPool, 'confetti', fxRng);
      if (fxKind === 'fireworks') stepFx(fireworkPool, 'fireworks', fxRng);
      victorySteps++;
    }
```

5. `startVictory` (`:805-820`): borra `fxKind = modeFxKind(mode);`, `victoryTeam = teamOf(modeVictoryTeamId(mode, run.match));` y `startFx(fxPool, fxKind, fxRng);` (ya los hizo `beginVictoryFx` en el pitido); deja `victoryTitle = …`, `accumulatorMs = 0;`, los cánticos, `onVictory` y el estado. Comentario nuevo en su cabeza: `// The effects are already running: beginVictoryFx started them at the final whistle (G15-21).`
6. `continueFromVictory`: añade `fxLive = false;`.

- [ ] **Step 3: `runStep`, `stepCaptionsOnly` y `update`**

1. En el punto 7 de `runStep` (Task 5), tras `stepCelebration(celebration, match.phase);` añade `stepNetRipple(ripple);`, y la línea del gol pasa a:

```ts
      if (scoredTeam !== -1) {
        beginCelebrationForGoal(celebration, match, watch, scoredTeam, preStep);
        // G15-14: from the ball ONE step before (the shootout has moved it already).
        beginNetRipple(ripple, PITCH, preStep.ballX, preStep.ballY);
      }
```

2. En el punto 9, `} else endHumanMatch(false);` pasa a:

```ts
        } else {
          endHumanMatch(false);
          // G15-21: "empieza sobre el campo al pitido final".
          if (flow.after === 'victory') beginVictoryFx();
        }
```

3. `stepCaptionsOnly`, dentro del bucle tras `stepCelebration(…)`:

```ts
        stepNetRipple(ripple);
        if (fxLive) stepVictoryFx();
```

4. `update` (`:1222`): tras `const phase = flow.phase;` añade el ramal de la pantalla previa:

```ts
      if (phase === 'pre-match') {
        // G15-19: ~3 s or A, at the fixed step, paused with P, frozen by the guard.
        accumulatorMs = planFrame('play', pausedRef.current, blocked, accumulatorMs, frameMs, budget, plan, 1);
        if (plan.mode !== 'full') return;
        for (let i = 0; i < plan.steps; i++) if (flowStepPreMatch(flow)) break;
        return;
      }
```
y en el ramal `'victory'`, `for (let i = 0; i < plan.steps; i++) stepFx(fxPool, fxKind, fxRng);` pasa a `for (let i = 0; i < plan.steps; i++) stepVictoryFx();`.

- [ ] **Step 4: El dibujo — red, previa y victoria**

1. **`drawPitch`, la malla** (`:1333-1349`, desde `// One path for the whole mesh…` hasta `ctx.stroke();`): sustituye por

```ts
        // One path for the whole mesh, no allocation. G15-14: the goal that has just been
        // scored on draws its mesh as polylines pushed by the ripple (net-ripple.ts); the
        // other one, and every goal outside a ripple, the static grid of G11-4.
        ctx.strokeStyle = NET_LINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const across = netLineCount(p.goalWidth, NET_CELL);
        const deep = netLineCount(GOAL_MOUTH_DEPTH, NET_CELL);
        if (ripple.active && ripple.side === side) {
          const worldX = goalX + (dir === 1 ? -GOAL_MOUTH_DEPTH : 0);
          const worldY = midY - p.goalWidth / 2;
          for (let i = 1; i <= across; i++) {
            const wy = worldY + i * NET_CELL;
            for (let k = 0; k <= RIPPLE_SEGMENTS_DEEP; k++) {
              rippleVertex(ripple, worldX + (k * GOAL_MOUTH_DEPTH) / RIPPLE_SEGMENTS_DEEP, wy, rippleOut);
              if (k === 0) ctx.moveTo(toScreenX(cam, rippleOut.x), toScreenY(cam, rippleOut.y));
              else ctx.lineTo(toScreenX(cam, rippleOut.x), toScreenY(cam, rippleOut.y));
            }
          }
          for (let i = 1; i <= deep; i++) {
            const wx = worldX + i * NET_CELL;
            for (let k = 0; k <= RIPPLE_SEGMENTS_ACROSS; k++) {
              rippleVertex(ripple, wx, worldY + (k * p.goalWidth) / RIPPLE_SEGMENTS_ACROSS, rippleOut);
              if (k === 0) ctx.moveTo(toScreenX(cam, rippleOut.x), toScreenY(cam, rippleOut.y));
              else ctx.lineTo(toScreenX(cam, rippleOut.x), toScreenY(cam, rippleOut.y));
            }
          }
        } else {
          for (let i = 1; i <= across; i++) {
            const lineY = mouthY + i * NET_CELL;
            ctx.moveTo(mouthX, lineY);
            ctx.lineTo(mouthX + GOAL_MOUTH_DEPTH, lineY);
          }
          for (let i = 1; i <= deep; i++) {
            const lineX = mouthX + i * NET_CELL;
            ctx.moveTo(lineX, mouthY);
            ctx.lineTo(lineX, mouthY + p.goalWidth);
          }
        }
        ctx.stroke();
```
(El marco — `GOAL_FRAME`, `strokeRect` — no cambia: los postes no se mueven.) Actualiza también el comentario de `drawPitch` que dice `the net is a STATIC grid (the one that ripples is v1.5)` → `the net is a static grid, and ripples for ~1 s after a goal (G15-14, V15-5)`.

2. **Partículas** — nueva función junto a `drawVictory`:

```ts
    // G15-21: one pool, in its own palette. Shared by the final whistle (over the pitch)
    // and the victory screen.
    function drawFxPool(pool: ParticlePool): void {
      for (let i = 0; i < pool.count; i++) {
        if (pool.life[i] === 0) continue;
        ctx.fillStyle = pool.palette[pool.color[i]];
        ctx.fillRect(pool.x[i], pool.y[i], pool.size[i], pool.size[i]);
      }
    }
```

`drawMatch` (`:2154-2164`) añade al final:

```ts
      // G15-21: the confetti (and the World Cup's fireworks) from the final whistle on.
      if (fxLive) {
        drawFxPool(confettiPool);
        if (fxKind === 'fireworks') drawFxPool(fireworkPool);
      }
```

`drawVictory` (`:2111-2152`): el bucle `for (let i = 0; i < fxPool.count; i++) { … }` pasa a

```ts
      drawFxPool(confettiPool);
      if (fxKind === 'fireworks') drawFxPool(fireworkPool);
```
y, tras el último `ctx.fillRect(cx - 24, cy - 78, 48, 8);` de la copa:

```ts
      // G15-21 "destello dorado en la copa", the World Cup's only: a glint over the cup and
      // four short rays, faded by cupFlashAlpha. globalAlpha is a number (criterion 20).
      if (fxKind === 'fireworks') {
        const glint = cupFlashAlpha(victorySteps);
        if (glint > 0) {
          ctx.globalAlpha = glint;
          ctx.fillStyle = CUP_FLASH;
          ctx.fillRect(cx - 30, cy - 118, 60, 8);
          ctx.strokeStyle = CUP_FLASH;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx - 52, cy - 140);
          ctx.lineTo(cx - 40, cy - 128);
          ctx.moveTo(cx + 52, cy - 140);
          ctx.lineTo(cx + 40, cy - 128);
          ctx.moveTo(cx, cy - 152);
          ctx.lineTo(cx, cy - 136);
          ctx.moveTo(cx - 60, cy - 110);
          ctx.lineTo(cx - 46, cy - 110);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
```

3. **La pantalla previa** — nuevas, junto a `drawLineup`:

```ts
    // G15-19 (matizada 23-sep): the two elevens standing in a row, the rival above and your
    // team below, the selection's name and its tag -- no player names. Stands baked at
    // mount, figures baked on entering (refreshPreMatchView). The run exists already and
    // is frozen until the flow says 'match'.
    function drawPreMatch(): void {
      ctx.drawImage(stands, 0, 0);
      ctx.fillStyle = GRASS_DARK;
      ctx.fillRect(0, PRE_MATCH_STANDS_H, VIEW_W, VIEW_H - PRE_MATCH_STANDS_H);
      drawPreMatchRow(preMatchTopTeam(humanSide), PRE_MATCH_TOP_FEET_Y, PRE_MATCH_TOP_LABEL_Y);
      drawPreMatchRow(preMatchBottomTeam(humanSide), PRE_MATCH_BOTTOM_FEET_Y, PRE_MATCH_BOTTOM_LABEL_Y);
      drawHint(flowHumanCount(flow) === 2 ? PRE_MATCH_HINT_TWO : CONTROL_HINTS[flow.keyScheme].preMatch, PRE_MATCH_HINT_Y);
    }

    function drawPreMatchRow(team: 0 | 1, feetY: number, labelY: number): void {
      const match = run.match;
      const first = team * TEAM_SIZE;
      const figure = team === HOME ? frontHome : frontAway;
      for (let i = 0; i < TEAM_SIZE; i++) {
        const p = match.players[first + i];
        ctx.drawImage(
          p.role === 'gk' ? frontKeeper : figure,
          Math.round(preMatchSlotX(i, TEAM_SIZE) - FRONT_W / 2), feetY - FRONT_H,
        );
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = FONT_TEAM;
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(match.teams[team].name, VIEW_W / 2, labelY);
      ctx.font = FONT_SMALL;
      ctx.fillStyle = HUD_ACCENT;
      ctx.fillText(preMatchTag(humanSide, team), VIEW_W / 2, labelY + PRE_MATCH_TAG_DY);
    }
```

4. `draw()` (`:2166`): añade `case 'pre-match': drawPreMatch(); break;` tras `case 'bracket':`.

- [ ] **Step 5: Teclas y mando en la pantalla previa**

1. `menuAction` (`:2244`): añade, tras el `case 'bracket'`,

```ts
        case 'pre-match':
          // G15-19: "~3 s o hasta A".
          if (k !== 'a') return false;
          flowEndPreMatch(flow);
          return true;
```
(cierra el TS2366 de la Task 7).

2. `handleKeyDown`, la elección de tabla del menú (`:2474-2475`, `const table = …; const k = padKeyFor(table, key);`) pasa a:

```ts
      const table = phase === 'team-select' || phase === 'lineup' ? tableForPicker() : menuTable();
      // G15-19: at two, either player's A starts the match from the line-up screen.
      const k = phase === 'pre-match' && flowHumanCount(flow) === 2
        ? padKeyFor(TWO_PLAYER_P1, key) ?? padKeyFor(TWO_PLAYER_P2, key)
        : padKeyFor(table, key);
```
(El mando: `pollGamepadFrame` ya enruta cualquier fase que no sea `'match'` al menú con el mando 1 — la A del mando 1 termina la previa; no hace falta tocarlo. La pausa: `pauseTables` cae en su rama por defecto, P o Esc. El guardián de ventana: la previa es una fase de menú para `handleResize`, se bloquea y se desbloquea como las demás.)

- [ ] **Step 6: Revisión de revisor (punto por punto) y compuertas**

```bash
npx tsc --noEmit
npx vitest run
npx eslint components/games/VaultWorldCupGame.tsx components/games/football-screen
git diff --name-only 77aecd7 -- components/games/football-logic/ | sort
grep -n "fxPool\|FX_COLORS" components/games/VaultWorldCupGame.tsx
git diff 77aecd7 -- components/games/VaultWorldCupGame.tsx | grep "^+" | grep -v "^+++" | grep -vE "^\+\s*//" | grep -nE "new |\`|\.map\(|\.filter\(|\.slice\(|=>|\[\]|\{ *\}"
grep -rn "Math\.random(" components/games/football-logic/ components/games/football-screen/
```
Expected: `tsc` **sin salida**; **1561 / 94** verdes; `eslint` sin salida; motor, las tres líneas; `fxPool|FX_COLORS`, vacío; el `grep` de asignaciones (acumulado contra `77aecd7`, así que incluye lo de la Task 5), **solo** tres líneas: `const ownGoalLabels: string[] = [];` (Task 5, montaje) y las dos líneas `=>` de los callbacks de `bakeFront`/`bakeStands` (funciones de módulo que corren al montar o en el evento de la previa — M3, medido en el pre-vuelo: con `=>` en el patrón salen exactamente esas dos; revísalas y anótalas en el ledger; ninguna dentro de una función por frame); `Math.random` vacío.

Comprueba a mano:
1. `beginNetRipple` y `beginCelebrationForGoal` corren en el mismo `if` del gol, con `preStep` (antes del paso) y antes de `updateWatch`.
2. `stepNetRipple`/`stepCelebration`/`stepVictoryFx` corren por paso (en `runStep`, `stepCaptionsOnly` y el ramal de victoria), nunca por frame.
3. `beginVictoryFx` corre UNA vez: está dentro del `else` de `!endFired`, y `endHumanMatch` es idempotente; un abandono (guardián) no pasa por ahí (`flow.after` es `'mode-select'`).
4. `startVictory` ya no reinicia el confeti: es el mismo que empezó sobre el campo.
5. `drawPreMatch` no construye cadenas (`preMatchTag` y los nombres de selección devuelven constantes) y no lee `localStorage`.
6. La previa no simula: en `'pre-match'` `update` solo descuenta la fase; el primer `runStep` llega en el primer frame de `'match'` (y empuja INICIO, como siempre).
7. Entrenamiento: `flowAfterModeBuilt` lo manda directo a `'match'` (sin previa) — `startHumanMatch` no llama a `refreshPreMatchView`.

- [ ] **Step 7: Ledger**

`Task V15-5-9: .tsx día 2 — red que ondula en la portería del gol, pantalla previa (fase, figuras horneadas por kit, gradas por semilla, A de cualquiera a dos), confeti desde el pitido sobre el campo y en la victoria, fuegos + oro en el Mundial, destello de la copa; tsc limpio; 1561 / 94.`

---
### Task V15-5-10 (cierre): anotación del spec, verificación del paso, lista de QA de Paco y mensaje de commit

**Files:**
- Modify: `specs/31-vault-world-cup.md` (bajo el párrafo en cursiva `*V15-4 implementado (2026-10-01): …*` de G15-22, y bajo el bullet G15-29)
- Modify: `.superpowers/sdd/2026-10-06-vault-world-cup-v15-5/progress.md`
- Create: `.superpowers/sdd/2026-10-06-vault-world-cup-v15-5/qa-paco.md`
- Ningún fichero de código se toca en esta tarea. Si al verificar aparece un fallo, **se arregla en la tarea que lo introdujo**.

**Interfaces:** consume todo lo anterior; produce la lista del QA jugado (G15-15: «QA jugado al final de cada uno») y el mensaje de commit.

- [ ] **Step 1: Anotar el spec**

Bajo el párrafo `*V15-4 implementado (2026-10-01): …*` de G15-22, un párrafo nuevo en cursiva:

```markdown
    *V15-5 implementado (2026-10-06/07), último paso de la v1.5: el entrenamiento sin tarjetas ni lesiones (G15-29, un interruptor
    `discipline` en `MatchRules`, sin regrabado); cada rótulo lleva su propio sujeto — GOL con el goleador o, en propia, «GOL» con
    «EN PROPIA · \<defensa\>» debajo, GOL y FALLA de la tanda con el lanzador, PENALTI con el lanzador, FALTA con el infractor,
    TARJETA y LESIÓN con el suyo — y el dorsal va junto al cursor del controlado
    (G15-11; se retira la ranura única de nombre de V15-4); la entrada se dibuja «tirándose» con la pierna estirada delante y el
    jugador se levanta agachado, y el robo con rival a tiro amaga (G15-25); el gol se celebra con carrera al goleador (los
    compañeros a velocidad de carrera normal, no al sprint), abrazo en corro y rivales cabizbajos dentro de la pausa de 4 s, también
    el gol de oro, y en la tanda solo el lanzador, dibujado donde tiró con la cámara sujeta 1 s en esa portería, lo que dura su
    rótulo GOL (G15-4); la red de la portería del gol ondula ~1 s desde el punto de impacto, nunca
    con poste o larguero (G15-14); la pantalla previa enseña las dos formaciones de pie, de frente, con sus equipaciones, el nombre de
    la selección y TU EQUIPO/ORDENADOR (J1/J2 a dos), sin nombres, ~3 s o hasta A, en amistosos y Mundial (G15-19 matizada); y la
    victoria arranca el confeti sobre el campo en el pitido final, más denso y con el kit del ganador, y en el Mundial suma fuegos,
    confeti dorado y el destello de la copa (G15-21). El motor solo cambia en G15-29. Las seis dudas del plan (D1-D6) quedaron
    resueltas por Paco el 06-oct, antes de ejecutar.*
```

Y bajo el bullet G15-29 (al final del spec), una línea en cursiva: `*Implementado en V15-5 (Task 1): `MatchRules.discipline` (`NORMAL_RULES` true, `TRAINING_RULES` false); `registerFoul` y la tirada de lesión solo corren con él; ningún valor de test regrabado.*`

- [ ] **Step 2: Verificación completa del paso**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-logic/ components/games/football-screen/ components/games/VaultWorldCupGame.tsx
```
Esperado: **1561 tests en 94 ficheros verdes**, 0 saltados (1519 + 1 + 7 + 6 + 8 + 0 + 5 + 11 + 4; 90 + 4); `tsc` sin salida; `eslint` sin salida.

- [ ] **Step 3: Las compuertas de las Global Constraints**

```bash
git diff --name-only 77aecd7 -- components/games/football-logic/ | sort
git diff 77aecd7 -- components/games/football-logic/match.test.ts | grep -E "^[+-][^+-]"
git diff --stat 77aecd7 -- components/games/football-logic/ai.test.ts components/games/football-logic/probes.test.ts components/games/football-logic/probes-close-matches.test.ts components/games/football-logic/probes-difficulty.test.ts components/games/football-logic/probe-harness.ts components/games/football-logic/engine-invariants.test.ts
md5 -q components/games/football-logic/engine-invariants.test.ts
grep -rn "Math\.random(" components/games/football-logic/ components/games/football-screen/
grep -rnE "(navigator|window|document|localStorage)\.[a-zA-Z]+\(" components/games/football-screen/ components/games/football-logic/
git diff 77aecd7 -- '*.ts' '*.tsx' | grep "^+" | grep -v "^+++" | grep -vE "^\+\s*(it|describe)\(" | sed -E 's#//.*$##' | grep -nE " as [A-Za-z{(\[]|!\.|!\)|: any"
cat components/games/football-screen/{celebration,net-ripple,front-sprite,pre-match}{,.test}.ts | grep -vE "^\s*(it|describe)\(" | sed -E 's#//.*$##' | grep -nE " as [A-Za-z{(\[]|!\.|!\)|: any"
find .superpowers -name "*.ts" -o -name "*.tsx"
grep -rn "buttonsIdle\|cardName\|injuryName\|SLIDE_TILT" components app lib
grep -rn "reserveCanComeOn" components/games/football-screen/hud.ts | head -1
```
Esperado: las **tres** líneas del motor; el diff de `match.test.ts`, **cuatro** líneas (los dos literales); el `--stat`, **vacío**; `md5` `0845d50e0d972fb778048d6a4e6fe443`; `Math.random(`, DOM, los **dos** `grep` de `as`/`!`/`any` (el de las líneas añadidas y el de los 8 ficheros nuevos; ver las Global Constraints), `find` y los restos, **vacíos**; `reserveCanComeOn` sigue ahí, intacto (deuda que NO se toca).

- [ ] **Step 4: Repasar el diff entero con ojos de revisor**

```bash
git status --short
git diff --stat 77aecd7
```
Comprueba: `git status` enseña nuevos `football-screen/{celebration,net-ripple,front-sprite,pre-match}.ts` y sus cuatro tests, y el plan; modificados `match.ts`, `match.test.ts`, `discipline.test.ts`, `captions.ts/.test.ts`, `hud.ts/.test.ts`, `sprite-maps.ts/.test.ts`, `sprite-frame.ts/.test.ts`, `gestures.ts/.test.ts`, `view-pipeline.test.ts`, `flow.ts/.test.ts`, `control-hints.ts/.test.ts`, `particles.ts/.test.ts`, `VaultWorldCupGame.tsx` y el spec. **Nada más** — ni `mode.ts`, ni `page.tsx`, ni `keyboard.ts`, ni `lib/`. (El ledger está ignorado por git.)

- [ ] **Step 5: Escribir `qa-paco.md`**

Crea `.superpowers/sdd/2026-10-06-vault-world-cup-v15-5/qa-paco.md` con exactamente esto:

```markdown
# QA jugado — V15-5 «Espectáculo» (v1.5, último paso)

Todo en `localhost:3000/games/vault-world-cup`. Claude NO lo ha jugado: lo ha dejado verde en tests (1561 tests, 94
ficheros, 0 saltados). Lo que no cuadre, anótalo aquí mismo. Las decisiones G15 no se reabren: lo que salga es un
cambio nuevo. Los puntos marcados **(resuelta por Paco 06-oct, Dn)** son decisiones que Paco ya tomó antes de ejecutar (ver el plan,
«Resoluciones de Paco»): aquí solo se comprueba que se NOTAN bien, no se reabren.

## 1 · Entrenamiento sin tarjetas ni lesiones (G15-29)
1.1 - [ ] En ENTRENAMIENTO, haz cuatro entradas por detrás a la misma estatua: se pita falta (FALTA y saque) pero **nunca
      sale TARJETA ni LESIÓN** y nadie se va del campo.
1.2 - [ ] En AMISTOSO, las tarjetas y lesiones siguen como en V15-4 (amarilla a la 2.ª falta, roja a la 4.ª).
1.3 - [ ] Dificultad: «el amistoso ya es difícil contra la máquina». Confirma jugando que el Mundial no se nota plano (si se nota,
      es v1.6, no este paso).

## 2 · Nombres en los rótulos y dorsal (G15-11)
2.1 - [ ] GOL: debajo, el nombre de quien la metió (en un equipo humano, el nombre que editaste en ALINEACIÓN).
2.2 - [ ] Un gol en propia dice **GOL** y debajo **EN PROPIA · \<nombre del defensa\>** (el defensa que lo metió en su puerta, no el
      del equipo que marca). **(resuelta por Paco 06-oct, D2)**
2.3 - [ ] PENALTI: el nombre de quien lo va a tirar. FALTA: el de quien la hizo. TARJETA: el del amonestado. LESIÓN: el del
      lesionado.
2.4 - [ ] **El arreglo de V15-4:** provoca dos faltas con tarjeta seguidas (de dos jugadores distintos, en menos de 3 s si puedes,
      a dos o contra la CPU a dificultad alta): cada TARJETA lleva **su** nombre, el primero no se reescribe con el segundo.
      (Límite conocido, no regresión: la cola guarda 4 rótulos; si una falta con tarjeta y lesión llega pegada a otra, el quinto
      rótulo se pierde en silencio. En 50 partidos medidos la cola nunca pasó de 2.)
2.5 - [ ] En la tanda, cada GOL **y cada FALLA** lleva el nombre de quien lo tiró (no el del siguiente). **(resuelta por Paco 06-oct, D3)**
2.6 - [ ] El dorsal sale a la derecha de la flecha del cursor, en amarillo, y cambia al cambiar de jugador (L). A dos, cada uno
      el suyo. ¿Se lee? ¿Molesta con las muescas de carga?

## 3 · Entradas y robos (G15-25)
3.1 - [ ] Una entrada (botón de entrada sin balón): el jugador se ve **tumbado de lado con una pierna estirada hacia donde va**,
      no la carrera inclinada de antes.
3.2 - [ ] Si falla o choca, se queda en el suelo ~1 s y **se levanta agachado** el último quinto de segundo.
3.3 - [ ] Una entrada que gana el balón: el que roba no se levanta del suelo, sigue corriendo con el balón (el motor no lo tumba).
      **(resuelta por Paco 06-oct, D6)**
3.4 - [ ] El robo normal con un rival cerca: **amaga** (cuerpo adelantado y más bajo, sin tocar el suelo) ~0,3 s. Pulsado con
      nadie cerca, no amaga.

## 4 · La celebración del gol (G15-4)
4.1 - [ ] Tras un gol, los compañeros corren hacia el goleador y se abrazan en corro; los rivales se quedan cabizbajos; el portero
      del que marca celebra en su sitio. Todo dentro de los 4 s; con el saque, cada uno a su sitio.
4.2 - [ ] Los compañeros cercanos llegan al corro; los lejanos (defensas) se acercan **corriendo a velocidad normal, no a sprint**, y
      **no llegan** en 4 s: el saque los recoloca a mitad de carrera. **(resuelta por Paco 06-oct, D5)**
4.3 - [ ] Gol de oro: misma celebración, sobre el FINAL / GANADOR.
4.4 - [ ] Gol en propia: el equipo que se beneficia se abraza alrededor de SU jugador más cercano al balón (rótulo como en 2.2).
      **(resuelta por Paco 06-oct, D2)**
4.5 - [ ] **Tanda:** tras un gol, la cámara **se queda 1 s** en esa portería, con el lanzador celebrando donde tiró y la red
      ondulando; el rótulo GOL dura ese mismo segundo y la cámara corta al siguiente penalti a la vez. **El siguiente lanzador
      pierde 1 s de sus 5 s de cuenta atrás para apuntar — ¿se nota?** **(resuelta por Paco 06-oct, D1: 1 s; lo único que se juzga
      aquí es si ese segundo se nota)**
4.6 - [ ] ¿Se lee el abrazo como abrazo? ¿Y los cabizbajos? Si queda pobre, G15-4 ya prevé «animación específica».

## 5 · La red que ondula (G15-14)
5.1 - [ ] Con gol (normal, de oro y de la tanda), la red de ESA portería se mueve ~1 s desde donde entró el balón y se calma.
5.2 - [ ] Un balón al poste o al larguero **no** la mueve.
5.3 - [ ] ¿Se nota lo justo? (amplitud 6 u, 1 s; se ajustan en `net-ripple.ts` sin tocar nada más).

## 6 · La pantalla previa (G15-19 matizada)
6.1 - [ ] AMISTOSO: tras la última ALINEACIÓN sale la pantalla previa con el rival ya sorteado: gradas arriba, césped, el rival en
      fila arriba y tu equipo abajo, once de frente cada uno, el portero en verde flúor, el nombre de cada selección y TU EQUIPO /
      ORDENADOR. **Ningún nombre de jugador.**
6.2 - [ ] Dura ~3 s; A la salta. P/Esc la pausan.
6.3 - [ ] AMISTOSO A DOS: J1 abajo, J2 arriba; la A de **cualquiera** de los dos (C o J, o el mando 1) la salta.
6.4 - [ ] MUNDIAL: sale al pulsar A sobre TU PARTIDO en el cuadro, en cada ronda; si juegas de visitante, tu equipo sigue abajo.
      Un partido de la CPU (VER) **no** tiene pantalla previa.
6.5 - [ ] ENTRENAMIENTO: **no** hay pantalla previa.
6.6 - [ ] Las equipaciones son las del partido (si chocan, el visitante sale invertido, como en el campo).
6.7 - [ ] La música de partido arranca ya en la pantalla previa (decidido en el plan; si la quieres de menú, una línea).
6.8 - [ ] ¿Se parece a la foto de alineaciones que compartiste? Parecido, no copia.

## 7 · La victoria (G15-21)
7.1 - [ ] Gana un AMISTOSO: al pitido final empieza a llover confeti **sobre el campo**, con los colores de tu equipación (y algo
      de blanco), y sigue en la pantalla de GANADOR. Más denso que antes.
7.2 - [ ] Gana el MUNDIAL: fuegos **y** confeti a la vez, el confeti dorado con tus colores, y la copa da un **destello dorado**
      cada segundo y medio.
7.3 - [ ] CONTINUAR corta todo y vuelve al selector; un amistoso perdido o abandonado no tiene confeti.
7.4 - [ ] Sin tirones con todo a la vez (400 + 320 partículas). Si los hay, mira la consola.

## 8 · General
8.1 - [ ] Ningún tirón nuevo en partido (criterio 20). 8.2 - [ ] Ningún error en consola en ninguna pantalla.
```

- [ ] **Step 6: Cerrar el ledger**

Añade a `progress.md`:

```
V15-5 COMPLETO en código (y con él, la v1.5): 1561 tests / 94 ficheros verdes, 0 saltados, tsc limpio, eslint sin errores nuevos. Motor tocado SOLO en G15-29 (match.ts + 2 literales de match.test.ts + 1 test de discipline.test.ts), sin regrabado (red md5 intacta, sondas y grabaciones sin cambio). G15-29, G15-11, G15-25, G15-4, G15-14, G15-19 matizada y G15-21 implementados; deuda de V15-4: ranura única de nombre y buttonsIdle resueltas; reserveCanComeOn sin tocar. Spec anotado. Lista de QA en qa-paco.md. Pendiente: QA jugado + commit de Paco.
```

Y debajo, cuatro encabezados: `## Dudas resueltas por Paco (06-oct)` (las seis líneas D1-D6 de la sección «Resoluciones de Paco» de este plan, copiadas tal cual y marcadas como **resueltas por Paco 06-oct**; ninguna queda abierta), `## Peticiones separadas al motor` (1. `reserveCanComeOn` duplica las guardas de `substitute`: compartir `canSubstitute` la próxima vez que se abra el motor fuera de una tarea de reglas. Nada más: la alternativa de D1 «devolver al siguiente lanzador su cuenta atrás entera» NO se pide —Paco resolvió 1 s de cámara sujeta, que no toca el motor—), `## Hallazgos de la ejecución` (lo que salga; si nada, `ninguno.`) y `## Mensaje de commit propuesto`.

- [ ] **Step 7: Proponer el commit del paso — NO ejecutes `git add` ni `git commit`**

Mensaje único para Paco:

```
feat(world-cup): v1.5 show — goal hug and rippling net, names on every caption, slide and feint sprites, pre-match line-up, denser victory confetti and fireworks, no cards or injuries in training (V15-5, G15-4/G15-11/G15-14/G15-19/G15-21/G15-25/G15-29)
```

Recuérdale que el commit incluye **ficheros nuevos** que hay que añadir explícitamente (`football-screen/celebration.ts`, `celebration.test.ts`, `net-ripple.ts`, `net-ripple.test.ts`, `front-sprite.ts`, `front-sprite.test.ts`, `pre-match.ts`, `pre-match.test.ts`) — o `git add -A`, como en V15-4 —, y que el plan (`docs/superpowers/plans/2026-10-06-vault-world-cup-v15-5-show.md`) es suyo: él decide si entra en el mismo commit.

---
## Self-review (ejecutada al escribir el plan, 06-oct)

**1. Cobertura del spec.**
- **G15-29** — interruptor en las reglas del modo, solo entrenamiento, sin regrabado → Task 1 (`MatchRules.discipline`), con la prueba de no-regrabado en su Step 6 (suite entera, `match.test.ts` solo dos literales, sondas y red intactas) y un test con tres controles. «Amistoso y Mundial no cambian» → usan `NORMAL_RULES` (`mode.ts:100`), que ejecuta exactamente el código de hoy. La nota de dificultad → «Fuera de V15-5» + QA 1.3.
- **G15-11** — «GOL goleador» → `collectCaptions`, paso 1 (`ball.lastTouchId`, Task 2) + `drawCaption` (Task 5); «GOL EN PROPIA» → rótulo «GOL» + «EN PROPIA · \<defensa\>» (D2): el sujeto es el defensa, con la marca `ownGoal` y `OWN_GOAL_PREFIX`; la etiqueta se hornea en `startMatch`; «FALLA» de la tanda con el lanzador (D3); «penalti lanzador» → `setPiece.takerId` en el paso de la pitada; «falta/tarjeta infractor» → `foulOffenderId` y `lastCard.squadIndex`; «dorsal sobre el controlado junto al cursor» → `drawPlayer` (Task 5). «Reutiliza el mecanismo de V15-4 y arregla la cola» → el sujeto viaja con el rótulo (Task 2), `cardName`/`injuryName` desaparecen (Task 5), con el test de dos tarjetas seguidas y su control. «Motor intacto (verificar que expone goleador/infractor)» → verificado y escrito en las Global Constraints.
- **G15-25** — «tirándose (tumbado de lado, pierna estirada) durante los pasos de la entrada» → `POSE_SLIDE` mientras `tackleStepsLeft > 0` (Task 3); «y luego se levanta» → `POSE_FEINT` en los últimos `GETUP_STEPS` del suelo; «el robo normal solo amaga (inclinado y más bajo, sin tocar el suelo)» → `POSE_FEINT` + `beginStealFeints` (con rival a tiro).
- **G15-4** — «corre hacia el goleador y se abraza en corro (sprite abrazo recoloreado por kit)» → `celebration.ts` + `POSE_HUG` (en el atlas de cada equipo: el recoloreado por kit sale del horneado de siempre); «rivales cabeza gacha» → `POSE_DEJECTED`; «dentro de la pausa de 4 s» → `CELEBRATION_STEPS = GOAL_PAUSE_STEPS` y fin en el saque (test de partido real: 240 pasos exactos); «gol de oro incluido» → corre en `'over'` por `stepCaptionsOnly`; «en la tanda solo el lanzador» → kind `'shootout'`, con el lanzador donde tiró y la cámara sujeta (Lección 1, medido).
- **G15-14** — «solo con gol (gol de oro y tanda incluidos); poste y larguero no» → la arranca solo `goalScoredThisStep` (Task 2 prueba que el poste da -1); «onda amortiguada desde el punto de impacto, ~1 s» → `net-ripple.ts` (Task 6, `RIPPLE_STEPS` 60) con el impacto de `preStep` (la tanda mueve el balón en el paso del gol); «`net-ripple.ts` + test» → exactamente.
- **G15-19 (+ matizada)** — «al pulsar JUGAR, con el rival ya sorteado» → fase `'pre-match'` tras construir el modo (amistosos) y tras la A sobre TU PARTIDO (Mundial) (Task 7; lectura del amistoso → D4); «amistoso y Mundial», no entrenamiento → `PRE_MATCH_BY_MODE`; «~3 s o hasta A» → `PRE_MATCH_STEPS` + `flowEndPreMatch`; «arriba rival, abajo tu equipo; a dos J1/J2» → `preMatchTopTeam`/`preMatchBottomTeam`/`preMatchTag`; «11 titulares de pie en fila con su kit (GK verde flúor)» → `drawPreMatchRow` con `frontKeeper`; «sprite nuevo de frente, de pie, mismo pixel-art, horneado y recoloreado por kit» → `front-sprite.ts` + `bakeFront` con la paleta del kit; «fondo simple de gradas y césped» → `bakeStands` (semilla) + `GRASS_DARK`; «SIN nombres» → test de las cuatro únicas palabras.
- **G15-21** — «reutiliza particles.ts» → sí, ampliado (Task 8); «amistoso: confeti sobre el campo al pitido final, más denso, kit propio» → `beginVictoryFx` en el pitido + `startConfettiRain` + `writeConfettiPalette('kit')` + `CONFETTI_COUNT` 400; «Mundial: fuegos + confeti a la vez, más densos, confeti dorado + kit, destello dorado en la copa» → dos depósitos, `'gold-kit'`, ráfagas 50/30, `cupFlashAlpha`.
- **Deuda de V15-4** — ranura única de nombre: resuelta (Tasks 2 y 5); `buttonsIdle`: borrada (Task 2); `reserveCanComeOn`: NO se toca (Global Constraints, compuerta de cierre que comprueba que sigue).
- **Criterios 1, 2, 17, 20, 21, 23** — motor solo en la Task 1 con compuerta en cada tarea; `Math.random` vacío en cada tarea y un test que prueba la semilla de las gradas; la victoria sigue siendo confeti/fuegos con CONTINUAR; criterio 20 traducido y revisado en las Tasks 5 y 9; 1519 → 1561; la tanda no se toca. **Sin huecos.**

**2. Placeholders.** Ningún «TBD», ningún «similar a la Task N», ningún «añade los tests». Todo el código de producción y de test está escrito; los cuatro mapas de sprite de N, los cuatro de NE y el de frente están escritos píxel a píxel y **se validaron con un script al escribir el plan** (15 × 15 / 11 × 21, solo letras de paleta, la dirección del pelo correcta en los ocho octantes derivados, el de frente simétrico). Los números «medidos» (pasos 588 y 9765, 3 goles de la tanda en la semilla 16, posiciones 249/231/980/1969, 240 pasos de celebración) salen de sondas ejecutadas el 06-oct sobre `77aecd7`, y la lógica de `celebration.ts` se ejecutó como prototipo contra esas dos semillas. **Además, el plan entero se aplicó mecánicamente (extrayendo sus bloques de código) sobre una copia de `77aecd7` fuera del repo (`git archive`, en el scratchpad de la sesión): suite final 1561 tests / 94 ficheros verdes, `tsc` limpio, `eslint` limpio, y los rojos intermedios de `tsc` exactamente los declarados (5 tras la Task 3, 1 tras la Task 7); el test de G15-29 y los controles 1, 2 y 5 de la Task 2 dieron el rojo que el plan anuncia.** El repo no se tocó. **Salvedad (pre-vuelo y resoluciones, 06-oct):** las resoluciones de Paco (D1, D2, D3, D5) y los hallazgos del pre-vuelo (H1-H5, M1-M7) se aplicaron al plan DESPUÉS de esa ejecución mecánica y no se han vuelto a ejecutar sobre la copia. No cambian ningún total: no hay un `it` nuevo ni borrado (solo aserciones nuevas dentro de los `it` de las Tasks 2 y 4), así que 1527 / 1533 / 1541 / 1546 / 1557 / 1561 y 94 ficheros salen igual por construcción; sí cambian el contrato de `captions.ts` (`ownGoal` en vez del centinela) y las constantes de `celebration.ts`.

**3. Consistencia de nombres y tipos.** Task 2 → `SUBJECT_NONE`, `OWN_GOAL_PREFIX`, `goalScoredThisStep`, `CaptionState.team/squad/ownGoal/queueTeam/queueSquad/queueOwnGoal`, `CAPTION_STEPS['shootout-goal']` (1 s) → los usan las Tasks 4 y 5 con esos nombres. Task 3 → `POSE_SLIDE/FEINT/HUG/DEJECTED`, `GETUP_STEPS`, `choosePlayerSprite(…, feintProgress, out)`, `beginStealFeints`, `FEINT_STEPS` → Tasks 4 y 5. Task 4 → `createCelebration`, `createCelebrationView`, `createPreStep`, `capturePreStep`, `resetCelebration`, `beginCelebrationForGoal`, `stepCelebration`, `celebrationHoldsCamera`, `celebrationView`, `celebration.camX/camY/hubId` → Task 5 (y la 9 añade la red en el mismo `if`). Task 6 → `createNetRipple`, `createRippleVertex`, `resetNetRipple`, `beginNetRipple`, `stepNetRipple`, `rippleVertex`, `RIPPLE_SEGMENTS_DEEP/ACROSS`, `ripple.active/side` → Task 9. Task 7 → `'pre-match'`, `flowStepPreMatch`, `flowEndPreMatch`, `CONTROL_HINTS[…].preMatch`, `PRE_MATCH_HINT_TWO`, `FRONT_W/H`, `bakeFrontSprite`, `PRE_MATCH_*`, `preMatch*`, `CROWD_*`, `forEachCrowdDot` → Task 9. Task 8 → `CONFETTI_COUNT`, `FIREWORK_POOL_COUNT`, `ParticlePool.palette`, `writeConfettiPalette`, `startConfettiRain`, `cupFlashAlpha` → Task 9. Los dos rojos de `tsc` que cruzan tareas están declarados (5 tras la 3 → cierra la 5; 1 tras la 7 → cierra la 9). Ésa es otra razón de la ejecución **en serie**.

**Riesgos que el plan NO cierra y que solo cierra el QA jugado** (sensación; las decisiones están tomadas): si el abrazo y los cabizbajos se leen a 30 px; si la red se nota (6 u); si el dorsal molesta con las muescas; si la previa recuerda a la foto de Tehkan; si 400 + 320 partículas dan tirones; y lo que las seis decisiones D1-D6 (resueltas por Paco 06-oct) no pueden decidir por él: si 1 s de cámara en la tanda se nota, si los lejanos a ritmo normal quedan bien, si «EN PROPIA · nombre» cabe en la banda.

---

## Dudas D1-D6 del primer borrador — HISTÓRICO: todas resueltas por Paco el 06-oct

**No queda ninguna duda abierta.** Esta sección conserva, como historial, las seis preguntas y la opción provisional que el primer borrador llevaba en cada una; las respuestas de Paco están justo debajo («Resoluciones de Paco») y **ya están aplicadas al cuerpo del plan** (cada tarea, test, compuerta y `qa-paco.md`). Donde una opción provisional de abajo contradiga la resolución —D1 con 1,5 s, D2 con «GOL EN PROPIA» en una línea, D3 con FALLA sin nombre, D5 con sprint—, **manda la resolución**.

- **D1 · La cámara en la tanda.** Medido: en el MISMO paso del gol de la tanda el motor manda al lanzador al círculo central y pone el siguiente penalti en la otra portería, y la cámara de la tanda corta allí. Sin hacer nada, la celebración del lanzador y la red quedarían fuera de cámara. Opciones: (a) sujetar la cámara en la portería del gol `SHOOTOUT_HOLD_STEPS` (1,5 s) dibujando al lanzador donde tiró — **provisional en el plan** — a costa de que el siguiente lanzador pierda 1,5 s de sus 5 s de cuenta atrás viendo la otra portería; (b) otro tiempo de sujeción; (c) no sujetar (la celebración de la tanda no se ve); (d) devolverle al lanzador su cuenta atrás entera → es MOTOR (alargar la cuenta tras un gol de la tanda) con regrabado de la tanda: fuera de V15-5. (Cambia en `celebration.ts`: `SHOOTOUT_HOLD_STEPS`.)
- **D2 · El gol en propia.** (i) ¿A quién abraza el equipo que se beneficia? Provisional: a su jugador de campo más cercano al balón (`goalHubId`). (ii) ¿Cómo se rotula? Provisional: título GOL y debajo «GOL EN PROPIA»; alternativa: el título entero «GOL EN PROPIA» sin segunda línea. (Cambia en `goalHubId` y en `drawCaption`.)
- **D3 · FALLA en la tanda.** G15-11 nombra GOL, penalti y falta/tarjeta, no el fallo. Provisional: FALLA sin nombre. ¿Con el nombre del que falló? (Una línea en `collectCaptions`, paso 2.)
- **D4 · «Al pulsar JUGAR» en el amistoso.** En el Mundial JUGAR es la A sobre TU PARTIDO. En el amistoso no hay botón JUGAR: el partido arranca con la B de la última ALINEACIÓN («VOLVER»). Provisional: la pantalla previa sale ahí, tras sortear el rival. ¿Vale, o quieres un JUGAR explícito? (`flowAfterModeBuilt`.)
- **D5 · Los compañeros lejanos.** Medido: a 240 u/s en 4 s llegan al corro los que están a menos de ~956 u del goleador (4-6 de 9 en los goles medidos); los defensas siguen corriendo cuando el saque los recoloca de golpe. Opciones: así (provisional); que solo corran los N más cercanos y el resto celebre en su sitio; o más velocidad. (`HUG_RUN_SPEED` / el reparto de huecos.)
- **D6 · La entrada que gana el balón.** El motor no tumba al que roba con una entrada limpia (`tackleStepsLeft = 0` sin `downUntilStep`), así que pasa de tumbado a correr sin «levantarse». Provisional: así. Alternativa de pantalla: un temporizador de levantarse (`GETUP_STEPS`) arrancado por el evento `'tackle'` con `ok` (como el amago). (`gestures.ts` + `sprite-frame.ts`.)

## Resoluciones de Paco (06-oct, antes del pre-vuelo)

- **D1 · cámara en la tanda:** se sujeta **1 s** (no 1,5) en la portería del gol; el tiempo que le quita al siguiente lanzador se juzga en el QA.
- **D2 · gol en propia:** celebra el equipo beneficiado, en corro alrededor de SU jugador más cercano al balón; rótulo «GOL» y debajo «EN PROPIA · <nombre del defensa>».
- **D3 · FALLA en la tanda:** lleva el nombre del lanzador, como el resto de rótulos.
- **D4 · amistoso sin botón JUGAR:** la pantalla previa sale justo después de la última ALINEACIÓN. Vale así.
- **D5 · compañeros lejanos:** los cercanos llegan al corro; los demás se acercan trotando sin llegar. Vale así.
- **D6 · entrada que roba el balón:** el que roba no se levanta del suelo, sigue corriendo con el balón. Vale así.
- **Calendario:** día 1 = T1-T5 (hoy, 06-oct); día 2 = T6-T10 (07-oct). QA del V15-4 la noche del día 1; QA del V15-5 tras el día 2.
→ En la tarea de cierre se registran como «resueltas por Paco 06-oct», no como dudas abiertas.
- **Tras el pre-vuelo (controlador, 06-oct):** D5 «trotando» = los compañeros lejanos van a velocidad normal de carrera, NO a sprint (240 u/s fuera); el rótulo GOL de la tanda dura lo mismo que la cámara sujeta (1 s); formato del gol en propia = título «GOL» + segunda línea «EN PROPIA · <nombre del defensa>» (Paco ya lo aprobó en D2).
