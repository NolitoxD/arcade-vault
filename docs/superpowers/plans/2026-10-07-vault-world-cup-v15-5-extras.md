# Vault World Cup — v1.5, paso V15-5, dos tareas extra (G15-30 dificultad del amistoso, G15-31 saque rápido) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dos ajustes de jugabilidad pedidos por Paco en el grill del 07-oct, que se ejecutan **después de la Task V15-5-10** del plan `2026-10-06-vault-world-cup-v15-5-show.md`: (G15-30) el Amistoso contra la CPU se juega a uno de tres niveles — BEGINNER 2, MEDIUM 4 (por defecto), PRO 6 — elegido en una pantalla propia justo después del modo, con el nivel visible en el marcador durante el partido; (G15-31) en saque inicial, banda, puerta, córner y falta, la A del humano saca **al momento** en la dirección apuntada; sin pulsar, la cuenta atrás sigue igual que hoy; el penalti no cambia.

**Architecture:** G15-30 vive en el estado del modo (`GameMode` `'friendly-cpu'` lleva `level`; `modeDifficulty` lo lee) y en una fase nueva del flujo puro (`'level-select'`); el `.tsx` solo pregunta y dibuja. G15-31 es un campo nuevo del `TeamInput`, `quickKick`, que **solo escribe la pantalla** desde el flanco humano de A (`padQuickKick`) y **solo lee** `stepSetPiece` en los cinco tipos que salen solos: la CPU, las grabaciones y las sondas nunca lo escriben, así que ningún partido existente cambia (demostrado más abajo). Mismo patrón que `TeamInput.sub` de la ventana de lesión (G15-18, V15-4).

**Tech Stack:** TypeScript estricto, React 19.2.4, Next 16.2.6 (App Router), canvas 2D 800 × 500, vitest 4.1.11 (tests `*.test.ts` junto al código, sin `vitest.config`, entorno Node sin DOM, **imports relativos**).

**Spec:** `specs/31-vault-world-cup.md` (Approved). Decisiones nuevas **G15-30** y **G15-31** (grill de Paco, 07-oct, cerrado; se copian abajo y se anotan en el spec al cerrar la Task 12). Criterios **1, 2, 20 y 21**.
**Plan hermano (modelo de formato):** `docs/superpowers/plans/2026-10-06-vault-world-cup-v15-5-show.md`. **Pre-vuelo de este plan:** `.superpowers/sdd/2026-10-07-vault-world-cup-v15-5-extras/preflight.md`.
**Código a imitar:** `TeamInput.sub` y `injuryPick` (G15-18: un campo del `TeamInput` que escribe la pantalla y lee una sola fase del motor); `injuryWindowTeam` (`hud.ts`: qué equipo humano ve la ayuda); `injuryHintFor`/`keeperHintFor` (`control-hints.ts`: una cadena por tabla, horneada al cargar); `PRE_MATCH_BY_MODE` y `flowMoveBracketChoice` (`flow.ts`: tabla por modo y cursor con tope en los extremos); `drawModeSelect` (`.tsx`: tarjetas de menú).
**Código a modificar:** motor — `football-logic/mode.ts` (+ `mode.test.ts`) en la Task 11; `football-logic/input.ts`, `football-logic/set-pieces.ts` (+ `input.test.ts`, `set-pieces.test.ts`) en la Task 12. Pantalla — `football-screen/{flow,control-hints}.ts` (+ tests) en la 11; `football-screen/{keyboard,hud,control-hints}.ts` (+ tests) en la 12; `components/games/VaultWorldCupGame.tsx` en las dos. Spec — dos bullets y su anotación.
**Código nuevo:** ninguno. **0 ficheros de test nuevos.**
**Ledger de este paso:** `.superpowers/sdd/2026-10-07-vault-world-cup-v15-5-extras/` (creado al escribir este plan, solo con `preflight.md`; bajo el `.gitignore` de `.superpowers/sdd/`). El controlador crea allí `sdd.sh` (literal en las Global Constraints), `progress.md` y, al cierre, `qa-paco.md`.

---

## Global Constraints

**Los requisitos de cada tarea incluyen implícitamente esta sección.**

### Las decisiones del grill que este plan ejecuta (Paco, 07-oct; cerradas, no se relitigan)

- **G15-30 · Dificultad del Amistoso vs CPU:** tres niveles, **BEGINNER = 2, MEDIUM = 4, PRO = 6**; por defecto **MEDIUM**. Los nombres en pantalla son BEGINNER / MEDIUM / PRO, en inglés tal cual. Se eligen en una **pantalla propia justo después de elegir Amistoso vs CPU**, con el patrón del selector de formación: cruceta para moverse, A para confirmar. En el partido, una etiqueta discreta en el marcador con el nivel, como la ronda en el Mundial. **No afecta a `friendly-2p`, `training` ni `world-cup`.**
- **G15-31 · Saque rápido en balones parados:** en `kickoff`, `throw-in`, `goal-kick`, `corner` y `free-kick`, pulsar A saca **al momento** en la dirección apuntada; si no se pulsa, la cuenta atrás sigue igual que hoy. **El penalti no cambia** (cuenta atrás y elección de lado). El aviso de abajo pasa a algo como «Cruceta apunta · A saca», nombrando la tecla real de la tabla en uso, como `keeperHintFor`.

### Lo que el planificador decide dentro de esas decisiones (reversible en una línea; listado también en «Dudas para Paco»)

1. **«En el marcador, como la ronda en el Mundial».** La ronda del Mundial **no** se pinta en el canvas: va por `reportStatus(modeMatchLabel(mode))` al cuadro **Estado** de la barra de la página (`app/games/vault-world-cup/play/page.tsx`, junto a «Marcador» y «Reloj»). El nivel viaja por el mismo sitio: `modeMatchLabel` del amistoso CPU pasa de `AMISTOSO` a `AMISTOSO · MEDIUM` (etc.). Cero dibujo nuevo en el canvas.
2. **La pantalla DIFICULTAD** usa tres de las tarjetas de ELIGE MODO (`modeCardY`, `MODE_CARD_W/H`), con el resaltado de siempre; arriba/izquierda sube, abajo/derecha baja, **con tope en los extremos** (regla del cuadro, G15-8: pulsar otra vez hacia PRO se queda en PRO); A confirma y **B vuelve a ELIGE MODO** (resolución (d) de Paco: B es el «volver» de todas las pantallas). Pista: `CRUCETA: NIVEL · A (J) CONFIRMA · B (K) VOLVER` (Clásico: `(Z)`/`(X)`).
3. **El nivel elegido sobrevive a un reset**, como `modeIndex` («otra vez» cae en el modo recién jugado): al volver a DIFICULTAD el cursor está en el último nivel jugado. La primera vez, MEDIUM.
4. **El aviso del saque (G15-31)** — `CRUCETA: APUNTAR · A (J) SACA · SI NO, SALE SOLO` — sale cuando el que saca es **humano** y el balón parado es saque inicial, banda, puerta, córner o falta. **El saque inicial cuenta** (en el motor es un balón parado más: `beginSetPiece('kickoff')` → `stepSetPiece`, y Paco lo incluye en la lista). Penalti, tanda, pausa de gol y descanso conservan `HINT_AIM` (`CRUCETA: APUNTAR · SALE SOLO`): en ellos A no hace nada, y en gol/descanso todavía no hay saque. Un saque de la CPU también conserva `HINT_AIM` (comportamiento de hoy, no se toca).

### Riesgos que pedía resolver Paco — respuesta con evidencia (medida el 07-oct sobre dos copias del repo en el scratchpad: HEAD `651ea2f` + los ficheros de la T7, y el working tree real de tras la T10, 1561 / 94)

**Riesgo 1 · ¿La CPU pulsa A en `'set-piece'`? ¿Cambian las grabaciones?**
- **La CPU no pulsa nunca A en un balón parado.** `decideTeamInput` (`ai.ts`) empieza por `neutralInput(out)` (`a/b/c = 'up'`) y en `kickoff`/`set-piece`/`shootout` solo escribe `out.dy` para el lado del penalti y hace `return`. Los equipos congelados del entrenamiento ni siquiera pasan por ahí (`cpuDecides` de `match-run.ts`). `engine-invariants.test.ts` y `probe-harness.ts` alimentan los dos equipos con `decideTeamInput`.
- **Pero las grabaciones de `match.test.ts` SÍ pulsan A en balones parados.** Instrumentando `stepSetPiece` (copia, sin tocar el repo) y corriendo la suite entera: **24 pasos** con `a === 'pressed'` en un balón parado no-penalti (10 saques iniciales, 6 bandas, 4 de puerta, 4 faltas), **todos** en `full match with recorded inputs > run A ends over…`, y todos en la **carrera C** (la réplica con otra semilla que debe divergir: pasos ≥ 3840, ya divergida en el 364). La política `policy` pulsa A con balón cerca de la portería y para entrar al tackle; tras divergir, esas entradas caen sobre balones parados de C.
- **Variante ingenua (motor lee `input.a === 'pressed'`) — RECHAZADA.** La suite sigue verde (1541/91 en la copia) pero la carrera C cambia **en silencio**: `2-0, over en el paso 11 462` → `4-2, over en el paso 12 426`. Es un partido grabado distinto que ningún test detecta: un regrabado escondido, justo lo que G15-31 no debe causar; y cualquier política futura que pulse A en un saque lo heredaría.
- **Variante elegida — un campo propio `TeamInput.quickKick`**, escrito **solo** por la pantalla con el flanco de A del pad humano (`padQuickKick`: `quickKick = a === 'pressed'`) y leído **solo** por `stepSetPiece` en los cinco tipos. Nadie más lo escribe (`createTeamInput` lo pone a `false`; `copyTeamInput` lo copia; ni `ai.ts`, ni `policy`, ni `probe-harness`, ni `engine-invariants` lo tocan). Medido en la copia con la implementación final: carrera A `12 854 pasos, 3-2, 112 tiradas, C diverge en 364`, **carrera C `2-0, over, 11 462`, idéntica a la base**; suite verde; md5 de `engine-invariants.test.ts` = `0845d50e0d972fb778048d6a4e6fe443`; `ai.test.ts`, sondas, `probe-harness.ts`, `match.ts`, `match.test.ts` sin tocar. **No hay regrabado.**
- **Flanco, no nivel (la A «pulsada» de antes del balón parado).** `TeamInput.a` ya ES un flanco: `padToTeamInput` da `'pressed'` solo en el primer paso del frame (`settle` lo baja a `'held'` en los demás) y `padAdvance` lo baja al cerrar el frame; `overlayPadToTeamInput` hace lo mismo con el mando. Una A mantenida desde antes del pitido llega como `'held'` y **no saca**; hay que soltar y volver a pulsar. Es la misma regla que la ventana de lesión (`injuryALatched`: «a button already down when the window opens must be released first»), que allí necesitó un pestillo porque el campo `sub` se escribe en la pantalla; aquí el pestillo es el propio `'pressed'`, y un test lo fija paso a paso (`padQuickKick`: `[false, true, false, false, false, true]`). Además el balón parado empieza **en el paso siguiente** al que lo pita (`callSetPiece` en el paso N, primer `stepSetPiece` en N + 1), así que la A del tackle que provocó la falta (paso N) llega como `'held'`.
- **La A que cierra la pantalla previa (T9) o la de DIFICULTAD no dispara el saque inicial.** En los menús la tecla va a `menuAction` sin `padDown` (los pads solo se escriben en `'match'`); su keyup en el partido es un `padUp` sin `padDown`, que deja `'up'` (test existente `a keyup with no keydown leaves the button up, with no phantom edge`). El mando: el frame de la A va a `routeMenuGamepad`; en el siguiente, ya en `'match'`, `routeGamepadToPad` ve el flanco `'held'` y no hace `padDown`.

**Riesgo 2 · ¿Quién depende de `FRIENDLY_DIFFICULTY`?**
- `FRIENDLY_DIFFICULTY = 5` **se queda** con su valor y su significado para el amistoso a dos y el entrenamiento. Dependientes: `probes.test.ts:3,11` y `probes-close-matches.test.ts:3,11,26-27` (**congelados**: siguen midiendo «la dificultad del amistoso» = 5, que sigue existiendo), `mode.test.ts:95` (el bucle de los tres amistosos: **se edita**), comentario de `world-cup.ts:57` (**no se toca**: sigue siendo cierto para el amistoso a dos). `modeDifficulty` la consume `VaultWorldCupGame.tsx` al crear el `MatchRun` (`createMatchRun(…, modeDifficulty(mode), …)`), que es por donde llega el nivel al partido sin tocar el `.tsx` en eso.
- `probes-difficulty.test.ts` mide 1 contra 8 (`ROUND_DIFFICULTY.final`); `ai.test.ts` no lee `FRIENDLY_DIFFICULTY`. 2, 4 y 6 están dentro del rango que ya juega el Mundial (3, 4, 6, 8) y que `profileFor` acota (`clampNum`). **Ninguna sonda ni grabación cambia**; ninguna mide 2/4/6 contra el humano: se juzga jugando (QA). Dato del spec (V15-4-10): «a dificultad 5 contra 1 la mayor gana solo el 52,6 % / 70,0 % de los decididos (la dificultad de la CPU pesa poco frente a los atributos)» — el salto BEGINNER→PRO puede notarse poco; ver Duda 1.
- **El nivel vive en el estado del modo**, no en una constante: `GameMode` pasa a tener una variante `{ kind: 'friendly-cpu'; state: FriendlyState & { level } }`; `createFriendlyMode` recibe el nivel (opcional, MEDIUM por defecto, así que todos los llamadores de hoy compilan sin cambios); `modeDifficulty` y `modeMatchLabel` lo leen. Nada fuera de `mode.ts` construye un `GameMode` a mano (`grep -rn "kind: 'friendly" components app lib` → solo `mode.ts`).

**Riesgo 3 · Encaje con el flujo (`flow.ts`, `mode.ts`).**
- La fase nueva `'level-select'` solo se abre desde `flowConfirmMode` con `LEVEL_SELECT_BY_MODE[kind]` (solo `friendly-cpu`); los otros tres modos van a `'team-select'` como hoy (test). **Volver atrás:** B en DIFICULTAD → `'mode-select'` sobre el mismo modo; `flowReset` (desde `'over'`, la victoria, R del entrenamiento) no se toca salvo para **no** borrar `levelIndex` (como `modeIndex`). No existe hoy un «volver» desde `team-select` y este plan no lo añade.
- **Teclados a dos:** la pantalla solo existe en un modo de un jugador, así que su tabla es `menuTable()` (el esquema elegido) por la rama por defecto de `handleKeyDown`, la pausa por la rama por defecto de `pauseTables()` y el mando 1 por `routeMenuGamepad(0)`. El amistoso a dos no la ve nunca (test). Ningún cambio en esas tres funciones.
- `phaseGroup('level-select') === 'menu'` (la música de menú, como ELIGE MODO); `update()` no la simula (rama final `accumulatorMs = 0`); `handleResize` la trata como menú (`flow.phase !== 'match' && … 'spectate'`).
- Tests existentes de `flow.test.ts` que hoy confirman AMISTOSO y esperan `team-select` (el modo por defecto es AMISTOSO): **se editan** añadiendo `flowConfirmLevel(f)` (listados en la Task 11). No cambian de valor esperado salvo dos `toBe('team-select')` que pasan a `'level-select'` porque el flujo cambia a propósito.

### Fuera de este plan (no se toca aunque «quede cerca»)

`profileFor` y la fórmula de dificultad; el perfil humano (`humanProfile` usa la misma dificultad que la CPU, regla D3/S9 de la etapa B: en PRO tu portero también para más — Duda 1); `FRIENDLY_DIFFICULTY` y las sondas; un «volver» en `team-select`; cualquier cambio a `match.ts` (el enrutado `inputs[sp.team]` ya existe); `idleHint` (se deja tal cual; la decisión del aviso va en una función nueva).

### Reglas del repo

- **Commits: SOLO Paco.** Ninguna tarea ejecuta `git add`, `git rm`, `git commit` ni `git stash`. Al final se propone **UN** mensaje de commit para las dos tareas.
- **Base de las compuertas = el árbol al cerrar la T10.** Al empezar la Task 11 el controlador ejecuta `sdd.sh snap` y escribe en `progress.md` la línea `Base tree: <tree>` (si Paco ya commiteó el V15-5, es `git rev-parse HEAD^{tree}`; si no, el árbol del working tree verificado de la T10). Todas las compuertas comparan contra esa base. Antes de anotar la base: `npx vitest run` → **1561 / 94** y `tsc` limpio (si no, la T10 no está cerrada: **para**).
- **NUNCA arrancar `next dev` ni `next build`.** Verificación: `npx vitest run <fichero>` → `npx vitest run` → `npx tsc --noEmit` → `npx eslint <ficheros tocados>`. El QA jugado lo hace Paco.
- **Comentarios, identificadores y `describe`/`it` en inglés**; plan, spec, chat y textos de UI en castellano (salvo BEGINNER/MEDIUM/PRO, que Paco quiere en inglés).
- **TypeScript estricto:** nada de `any`, **nada de `as` nuevo (tampoco `as const` en tests: se escribe el tipo)**, ningún `!` nuevo. Compuerta en `sdd.sh gate` (abajo).
- **Criterio 20:** en `draw*`, `update`, `runStep`, `loop` y `pollGamepadFrame`, ninguna asignación nueva (`new`, literales, plantillas, `.map/.filter/.slice`, `=>`). Las cadenas nuevas son constantes de módulo (`CPU_FRIENDLY_LABEL_BY_LEVEL`, `QUICK_KICK_HINT_*`, `CONTROL_HINTS[…].levelSelect`, `LEVEL_TITLE`).
- **Un test que pasa no prueba nada hasta verlo fallar.** Cada tarea tiene su «ver en rojo» y sus controles negativos con el resultado literal (medidos en la copia).
- **Anclas:** se busca por **texto o símbolo**, nunca por número de línea. El `.tsx` y `flow.ts`/`control-hints.ts` llegan con los cambios de las Tasks 7 y 9 del plan hermano: las anclas de este plan se eligieron fuera de lo que esas tareas tocan, y donde comparten línea (los `import`) la instrucción es «añade el símbolo X al import de Y», no un bloque literal.

### La compuerta del motor, redefinida para estas dos tareas

| Fichero de `components/games/football-logic/` | Tarea | Por qué está permitido |
|---|---|---|
| `mode.ts` | 11 | G15-30: `FriendlyLevel`, la variante `friendly-cpu` de `GameMode`, tres tablas, `createFriendlyMode(…, level)`, `modeDifficulty` y `modeMatchLabel`. No es simulación: no lo lee `stepMatch`. |
| `mode.test.ts` | 11 | +1 `it`; dos aserciones del bucle de los tres amistosos (`modeDifficulty` y `modeMatchLabel` del CPU). |
| `input.ts` | 12 | G15-31: el campo `quickKick` en `TeamInput`, `createTeamInput`, `copyTeamInput`. |
| `input.test.ts` | 12 | El literal de `createTeamInput` y el `from.quickKick = true` de la copia. |
| `set-pieces.ts` | 12 | G15-31: **una** línea (más su comentario) en `stepSetPiece`. |
| `set-pieces.test.ts` | 12 | +4 `it` en un `describe` nuevo; imports. |

**Congelados (diff vacío contra la base en las dos tareas):** `ai.ts`, `ai.test.ts`, `match.ts`, `match.test.ts`, `world-cup.ts`, `world-cup.test.ts`, `discipline.ts`, `discipline.test.ts`, `probes.test.ts`, `probes-close-matches.test.ts`, `probes-difficulty.test.ts`, `probe-harness.ts`, `engine-invariants.test.ts` (y su md5 `0845d50e0d972fb778048d6a4e6fe443`), `step.ts`, `actions.ts`, `referee.ts`, `players.ts`, `ball.ts`, `teams.ts`, `squads.ts`. Si una tarea creyera necesitar uno, **se para** y se apunta en el ledger.

`sdd.sh` del ledger (lo crea el controlador antes de la Task 11, copiando el del V15-5 y cambiando `W`, `PLAN`, el `brief` y el `gate`):

```bash
#!/usr/bin/env bash
# Helpers without commits (Paco commits): snapshot = tree object via a temp index.
set -euo pipefail
cd /Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault
W=.superpowers/sdd/2026-10-07-vault-world-cup-v15-5-extras
PLAN=docs/superpowers/plans/2026-10-07-vault-world-cup-v15-5-extras.md
L=components/games/football-logic
case "$1" in
  snap)  export GIT_INDEX_FILE=$PWD/$W/.snap-index; git read-tree HEAD; git add -A -- . ':!docs' ':!tasks' ':!specs' ':!.superpowers'; git write-tree ;;
  brief) awk -v n="$2" '/^#{1,3} /{t=($0 ~ ("^### Task V15-5-" n "[^0-9]"))} t{print}' $PLAN > $W/task-$2-brief.md; wc -l $W/task-$2-brief.md ;;
  pkg)   out=$W/review-$4.diff; { echo "## stat $2..$3"; git diff --stat "$2" "$3"; echo; git diff -U10 "$2" "$3"; } > $out; echo $out; wc -l $out ;;
  step)  prev=$(grep -o 'tree [0-9a-f]\{40\}' $W/progress.md | tail -1 | cut -d' ' -f2 || true); [ -z "$prev" ] && prev=$(grep 'Base tree:' $W/progress.md | awk '{print $3}'); cur=$($0 snap); $0 pkg $prev $cur task$2 >/dev/null; echo "Task V15-5-$2: implemented (tree $cur)" >> $W/progress.md; echo "prev=$prev cur=$cur"; npx tsc --noEmit >/dev/null 2>&1 && echo tsc=0 || echo tsc=FAIL ;;
  gate)  B=$(grep 'Base tree:' $W/progress.md | awk '{print $3}')
         echo "-- engine files vs base ($B):"; git diff --name-only $B -- $L/ | sort; git status --short -- $L/ | grep '^??' || true
         echo "-- md5:"; md5 -q $L/engine-invariants.test.ts
         echo "-- frozen stat:"; git diff --stat $B -- $L/ai.ts $L/ai.test.ts $L/match.ts $L/match.test.ts $L/world-cup.ts $L/world-cup.test.ts $L/discipline.ts $L/discipline.test.ts $L/probes.test.ts $L/probes-close-matches.test.ts $L/probes-difficulty.test.ts $L/probe-harness.ts $L/engine-invariants.test.ts $L/step.ts $L/actions.ts $L/referee.ts $L/players.ts $L/ball.ts $L/teams.ts $L/squads.ts
         echo "-- quickKick writers (no tests):"; grep -rn "quickKick =" components/games | grep -v "\.test\.ts:" || true
         echo "-- padQuickKick callers (no tests):"; grep -rn "padQuickKick(" components/games | grep -v "\.test\.ts:" || true
         echo "-- as / ! / any in added lines:"; git diff $B -- '*.ts' '*.tsx' | grep "^+" | grep -v "^+++" | grep -vE "^\+\s*(it|describe)\(" | sed -E 's#//.*$##' | grep -nE " as [A-Za-z{(\[]| as const|!\.|!\)|: any" || true
         echo "-- Math.random(:"; grep -rn "Math\.random(" $L/ components/games/football-screen/ || true
         echo "-- .ts under .superpowers:"; find .superpowers -name "*.ts" -o -name "*.tsx" ;;
esac
```

**Esperado del `gate`** (cada línea):
- Tras la Task 11: motor = `mode.test.ts`, `mode.ts` (2 líneas), ningún `??`. Tras la Task 12: las **seis** de la tabla, ningún `??`.
- md5 `0845d50e0d972fb778048d6a4e6fe443`; *frozen stat* **vacío**.
- *quickKick writers*: tras la 11, vacío; tras la 12, **exactamente** `components/games/football-logic/input.ts:…:  to.quickKick = from.quickKick;` y `components/games/football-screen/keyboard.ts:…:  out.quickKick = out.a === 'pressed';`.
- *padQuickKick callers*: tras la 12, **exactamente** tres: la definición en `keyboard.ts` y las dos llamadas de `VaultWorldCupGame.tsx` (una por equipo humano).
- `as`/`!`/`any`, `Math.random(` y `.ts` bajo `.superpowers`: **vacíos**.

### Recuento de tests

**Partida (tras T10): 1561 tests en 94 ficheros, 0 saltados**, `tsc` limpio — el objetivo de cierre del plan hermano. Deltas medidos en la copia (sobre su propia base, que no tiene los ficheros nuevos de T6-T8; los deltas son independientes de ellos):

| Orden | Tarea | Ficheros que toca | Δ tests / ficheros | Acumulado |
|---|---|---|---|---|
| — | **Partida: tras T10** | — | — | **1561 / 94** |
| 1 | **V15-5-11** G15-30: niveles del Amistoso vs CPU y su pantalla | `mode.ts` (+test), `flow.ts` (+test), `control-hints.ts` (+test), `VaultWorldCupGame.tsx` | +1 (mode) +4 (flow) +1 (hints) = **+6 / 0** | **1567 / 94** |
| 2 | **V15-5-12** G15-31: saque rápido con A; cierre (spec, `qa-paco.md`, commit) | `input.ts` (+test), `set-pieces.ts` (+test), `keyboard.ts` (+test), `hud.ts` (+test), `control-hints.ts` (+test), `VaultWorldCupGame.tsx`, `specs/31-vault-world-cup.md` | +4 (set-pieces) +1 (keyboard) +1 (hud) +1 (hints) = **+7 / 0** | **1574 / 94** |

**En serie, nunca en paralelo**: las dos tocan el `.tsx` y `control-hints.ts`(+test), y cada una pasa por rojos intencionados con compuertas globales. Ninguna deja `tsc` en rojo al cerrar (cada una cablea el `.tsx` dentro de sí misma: la fase nueva rompe el `switch` exhaustivo de `menuAction` con TS2366 y se cierra en la misma tarea). **No se parten en más tareas:** cada una son ~10 ficheros y una sola idea; partir pura/cableado dejaría un TS2366 cruzando la frontera (como T7→T9) sin ganar nada, porque los dos cableados son de 20-40 líneas.

---

## Mapa de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `football-logic/mode.ts` | `FriendlyLevel`, variante `friendly-cpu` con `level`; `FRIENDLY_LEVELS`, `FRIENDLY_LEVEL_NAMES`, `FRIENDLY_LEVEL_DIFFICULTY`, `DEFAULT_FRIENDLY_LEVEL`; `createFriendlyMode(kind, home, away, level?)`; `modeDifficulty` y `modeMatchLabel` leen el nivel. | 11 |
| `football-logic/mode.test.ts` | Dos aserciones del bucle de amistosos; +1 `it` G15-30. | 11 |
| `football-screen/flow.ts` | Fase `'level-select'`; `LEVEL_SELECT_BY_MODE`, `DEFAULT_LEVEL_INDEX`; `FlowState.levelIndex`; `flowConfirmMode` la abre; `flowMoveLevel`, `flowConfirmLevel`, `flowLevelBack`; `flowBuildMode` pasa el nivel; `phaseGroup`. | 11 |
| `football-screen/flow.test.ts` | Helper `startRaw` y seis `it` existentes con `flowConfirmLevel`; el de `phaseGroup` con once fases; +4 `it`. | 11 |
| `football-screen/control-hints.ts` | `ControlHints.levelSelect` (11); `quickKickHintFor` (12). | 11, 12 |
| `football-screen/control-hints.test.ts` | `allTexts` con `levelSelect`; +1 `it` (11); +1 `it` (12). | 11, 12 |
| `football-logic/input.ts` | `TeamInput.quickKick`, `createTeamInput`, `copyTeamInput`. | 12 |
| `football-logic/input.test.ts` | Literal de `createTeamInput`; la copia con `quickKick`. | 12 |
| `football-logic/set-pieces.ts` | Una línea en `stepSetPiece`. | 12 |
| `football-logic/set-pieces.test.ts` | +4 `it` (`describe('G15-31: the quick kick')`). | 12 |
| `football-screen/keyboard.ts` | `padQuickKick(out)`. | 12 |
| `football-screen/keyboard.test.ts` | +1 `it`. | 12 |
| `football-screen/hud.ts` | `quickKickTeam(match, human)`. | 12 |
| `football-screen/hud.test.ts` | +1 `it`; imports de tipos. | 12 |
| `VaultWorldCupGame.tsx` | 11: imports, `LEVEL_TITLE`, `drawLevelSelect`, `case` en `draw()` y en `menuAction`. 12: imports, `padQuickKick` en `runStep`, el aviso en `drawHud`. | 11, 12 |
| `specs/31-vault-world-cup.md` | Bullets G15-30 y G15-31 con su línea «Implementado». | 12 |

---

### Task V15-5-11: el Amistoso vs CPU a tres niveles — BEGINNER, MEDIUM, PRO — elegidos en su propia pantalla (G15-30)

**Files:**
- Modify: `components/games/football-logic/mode.ts` (`type FriendlyState = …`, `export type GameMode = …`, `export const FRIENDLY_DIFFICULTY = 5;` y su comentario `// G9-6: 5 in every friendly, no selector.`, `createFriendlyMode`, `modeDifficulty`, `MATCH_LABEL_BY_KIND`/`FRIENDLY_VICTORY_TITLE`, `modeMatchLabel`)
- Modify: `components/games/football-screen/flow.ts` (import de `../football-logic/mode`; `FlowPhase`; `phaseGroup`; tras `PRE_MATCH_STEPS`; `FlowState`; `createFlowState`; `flowConfirmMode`; sección nueva antes de `// G15-6: the key-scheme row of ELIGE MODO`; `flowBuildMode`)
- Modify: `components/games/football-screen/control-hints.ts` (`ControlHints`, `buildHints`)
- Modify: `components/games/VaultWorldCupGame.tsx` (imports de `./football-logic/mode` y `./football-screen/flow`; `const MODE_TITLE = 'ELIGE MODO';`; antes de `function drawTeamSelect(): void {`; `draw()`; `menuAction`)
- Test: `components/games/football-logic/mode.test.ts`, `components/games/football-screen/flow.test.ts`, `components/games/football-screen/control-hints.test.ts`

**Interfaces:**
- Consumes: `GameModeKind`, `createFriendlyMode`, `modeDifficulty`, `modeMatchLabel`, `MATCH_LABEL_BY_KIND` (privada de `mode.ts`); `flowModeKind`, `PRE_MATCH_STEPS` (T7); `keyLabel`; en el `.tsx`, `drawMenuBackground`, `drawHint`, `modeCardY`, `MODE_CARD_W/H`, `MODE_HINT_Y`, `CARD_BG`, `CARD_BORDER`, `HUD_ACCENT`, `HUD_TEXT`, `FONT_MENU_ITEM`.
- Produces: `FriendlyLevel = 'beginner' | 'medium' | 'pro'`; `FRIENDLY_LEVELS` (`['beginner','medium','pro']`), `FRIENDLY_LEVEL_NAMES`, `FRIENDLY_LEVEL_DIFFICULTY` (2/4/6), `DEFAULT_FRIENDLY_LEVEL` (`'medium'`); `createFriendlyMode(kind, homeId, awayId, level = DEFAULT_FRIENDLY_LEVEL)`; `modeMatchLabel` del CPU = `AMISTOSO · <NIVEL>`. `FlowPhase` con `'level-select'`; `LEVEL_SELECT_BY_MODE`; `DEFAULT_LEVEL_INDEX` (1); `FlowState.levelIndex`; `flowMoveLevel(f, delta)`, `flowConfirmLevel(f)`, `flowLevelBack(f)`. `ControlHints.levelSelect`.

- [ ] **Step 0 (controlador, una vez): base y ledger**

```bash
npx vitest run 2>&1 | grep -E "Tests |Test Files"
npx tsc --noEmit
```
Esperado: **1561 passed / 94**; `tsc` sin salida. Crea `sdd.sh` (literal de las Global Constraints, `chmod +x`) y `progress.md` con la línea `Base tree: $(./sdd.sh snap)`. `./sdd.sh gate` → motor vacío, md5 bueno, el resto vacío.

- [ ] **Step 1: Escribir los tests que fallan**

**`mode.test.ts`.** El import de `./mode` añade, delante de `FRIENDLY_DIFFICULTY`, `DEFAULT_FRIENDLY_LEVEL,` y, detrás, `FRIENDLY_LEVELS, FRIENDLY_LEVEL_DIFFICULTY, FRIENDLY_LEVEL_NAMES,` (orden alfabético del bloque; `createFriendlyMode` puede pasar a la línea siguiente). En `it('answer the questions the component asks, without the component knowing which one it holds'`:

```ts
      expect(modeDifficulty(m)).toBe(FRIENDLY_DIFFICULTY);   // G9-6: 5, no selector
```
pasa a
```ts
      // G9-6: 5, no selector -- except the CPU friendly since G15-30, built here on its default level.
      expect(modeDifficulty(m)).toBe(m === cpu ? FRIENDLY_LEVEL_DIFFICULTY.medium : FRIENDLY_DIFFICULTY);
```
y
```ts
    expect(modeMatchLabel(cpu)).toBe('AMISTOSO');
```
pasa a
```ts
    expect(modeMatchLabel(cpu)).toBe('AMISTOSO · MEDIUM');   // G15-30: the level, on its default
```
Y justo antes de `it('refuse the same team on both sides', () => {`:

```ts
  // ── G15-30 (Paco, 07-oct): the CPU friendly's three levels ──────────────────────
  it('G15-30: the CPU friendly plays at the level it was built with -- BEGINNER 2, MEDIUM 4 (the default), PRO 6 -- and says so in its label; the other two friendlies ignore it', () => {
    expect(FRIENDLY_LEVELS).toEqual(['beginner', 'medium', 'pro']);
    expect(FRIENDLY_LEVELS.map((l) => FRIENDLY_LEVEL_NAMES[l])).toEqual(['BEGINNER', 'MEDIUM', 'PRO']);
    expect(DEFAULT_FRIENDLY_LEVEL).toBe('medium');
    const played = FRIENDLY_LEVELS.map((l) => createFriendlyMode('friendly-cpu', 'espana', 'italia', l));
    expect(played.map(modeDifficulty)).toEqual([2, 4, 6]);
    expect(played.map(modeMatchLabel)).toEqual(['AMISTOSO · BEGINNER', 'AMISTOSO · MEDIUM', 'AMISTOSO · PRO']);
    expect(modeDifficulty(createFriendlyMode('friendly-cpu', 'espana', 'italia'))).toBe(4);
    const others: ('friendly-2p' | 'training')[] = ['friendly-2p', 'training'];
    for (const kind of others) {
      const m = createFriendlyMode(kind, 'brasil', 'argentina', 'pro');
      expect([kind, modeDifficulty(m)]).toEqual([kind, FRIENDLY_DIFFICULTY]);
    }
    expect(modeMatchLabel(createFriendlyMode('friendly-2p', 'brasil', 'argentina', 'beginner'))).toBe('AMISTOSO A DOS');
  });
```

**`flow.test.ts`** (estado tras la T7). Al import de `./flow` añade `DEFAULT_LEVEL_INDEX`, `LEVEL_SELECT_BY_MODE` (tras `BRACKET_CHOICE_COUNT` / antes de `LINEUP_BY_MODE`), `flowConfirmLevel` (tras `flowConfirmDraw`), `flowLevelBack, flowMoveLevel` (tras `flowExitMatch`). Ediciones de tests existentes (no suman tests; el modo por defecto es AMISTOSO, que ahora pasa por DIFICULTAD):

1. Helper `startRaw` (T7): tras `flowConfirmMode(f);` añade
   ```ts
     if (f.phase === 'level-select') flowConfirmLevel(f);   // G15-30: on MEDIUM, the default
   ```
2. `it('starts on mode-select at AMISTOSO, wraps in both directions, and A moves to team-select'`: el título pasa a `'starts on mode-select at AMISTOSO, wraps in both directions, and A moves to the level screen and then team-select'`, y tras su `flowConfirmMode(f);` el `expect(f.phase).toBe('team-select');` pasa a
   ```ts
    expect(f.phase).toBe('level-select');   // G15-30
    flowConfirmLevel(f);
    expect(f.phase).toBe('team-select');
   ```
3. `it('flowToggleKeyScheme flips the scheme on mode-select only'`: su `expect(f.phase).toBe('team-select');` pasa a `expect(f.phase).toBe('level-select');   // G15-30: AMISTOSO opens the level screen first`.
4. `it('moves the cursor on a 5 x 4 grid, wrapping rows and columns, and refuses a slot past the bank'`, `it('the ALINEACIÓN cursor wraps, and the two sub-modes open and close (G15-17)'` y `it('browsing, choosing a reserve and editing a name refuse to interleave (G15-17)'`: tras su primer `flowConfirmMode(f);` añade `flowConfirmLevel(f);`.
5. `it('a friendly and the World Cup go on to ALINEACIÓN; the training is done there and then (G15-17)'`: tras `flowConfirmMode(solo);                                   // AMISTOSO` añade `flowConfirmLevel(solo);                                  // G15-30: MEDIUM`.
6. `describe('phaseGroup'`: en el comentario de encima, `All TEN phases of` pasa a `All ELEVEN phases of`; el `it` pasa a
   ```ts
  it('match, spectate and pre-match are "match"; the other eight phases are "menu"', () => {
    const phases: FlowPhase[] = [
      'mode-select', 'level-select', 'team-select', 'lineup', 'draw', 'bracket', 'pre-match', 'match', 'spectate', 'victory',
      'over',
    ];
    expect(phases.map(phaseGroup)).toEqual([
      'menu', 'menu', 'menu', 'menu', 'menu', 'menu', 'match', 'match', 'match', 'menu', 'menu',
    ]);
  });
   ```

Los demás `it` que llaman a `flowConfirmMode` (`starts on Flechas and keeps the chosen scheme across a reset`, `flowSetKeyScheme sets it on any screen`, `keeps one formation per human, 3-3-2 by default (G9-5)`) **no** se tocan: el primero hace `flowReset` (vale desde cualquier fase), el segundo solo fija el esquema, el tercero mueve antes a AMISTOSO A DOS. Y al final del fichero:

```ts
// ── G15-30 (Paco, 07-oct): the CPU friendly's level screen ──────────────────────
describe('the level screen (G15-30)', () => {
  it('only AMISTOSO opens DIFICULTAD, right after the mode and on MEDIUM; the other three modes go straight to the team selector', () => {
    expect(LEVEL_SELECT_BY_MODE).toEqual({ 'friendly-cpu': true, 'friendly-2p': false, training: false, 'world-cup': false });
    expect(DEFAULT_LEVEL_INDEX).toBe(1);
    const cpu = createFlowState();
    flowConfirmMode(cpu);
    expect([cpu.phase, cpu.levelIndex]).toEqual(['level-select', DEFAULT_LEVEL_INDEX]);
    for (const steps of [1, 2, 3]) {
      const f = createFlowState();
      flowMoveMode(f, steps);
      flowConfirmMode(f);
      expect([flowModeKind(f), f.phase]).toEqual([MODE_LIST[steps], 'team-select']);
    }
  });

  it('the cruceta walks BEGINNER - MEDIUM - PRO and stops at each end; A goes on to the team selector and nothing else moves it', () => {
    const f = createFlowState();
    flowMoveLevel(f, 1);
    expect(f.levelIndex).toBe(DEFAULT_LEVEL_INDEX);         // not on its screen: a no-op
    flowConfirmMode(f);
    flowMoveLevel(f, -1);
    expect(f.levelIndex).toBe(0);
    flowMoveLevel(f, -1);
    expect(f.levelIndex).toBe(0);                            // stops at BEGINNER, no wrap
    flowMoveLevel(f, 1);
    flowMoveLevel(f, 1);
    flowMoveLevel(f, 1);
    expect(f.levelIndex).toBe(2);                            // stops at PRO
    flowConfirmLevel(f);
    expect(f.phase).toBe('team-select');
    flowMoveLevel(f, -1);
    expect(f.levelIndex).toBe(2);                            // the team selector does not move it
  });

  it('B goes back to ELIGE MODO on AMISTOSO, the level kept; a reset keeps it too, like the mode', () => {
    const f = createFlowState();
    flowConfirmMode(f);
    flowMoveLevel(f, 1);
    flowLevelBack(f);
    expect([f.phase, flowModeKind(f), f.levelIndex]).toEqual(['mode-select', 'friendly-cpu', 2]);
    flowLevelBack(f);
    expect(f.phase).toBe('mode-select');                     // only from its own screen
    flowConfirmMode(f);
    expect([f.phase, f.levelIndex]).toEqual(['level-select', 2]);
    flowConfirmLevel(f);
    flowReset(f);
    expect([f.phase, f.levelIndex]).toEqual(['mode-select', 2]);
  });

  it('flowBuildMode plays the CPU friendly at the chosen level -- BEGINNER 2, MEDIUM 4, PRO 6 -- and the other modes as before', () => {
    const played: number[] = [];
    for (let level = 0; level < 3; level++) {
      const f = createFlowState();
      flowConfirmMode(f);
      flowMoveLevel(f, -1);
      for (let i = 0; i < level; i++) flowMoveLevel(f, 1);
      flowConfirmLevel(f);
      f.cursor = 0;
      flowConfirmTeam(f, BANK);
      flowConfirmLineup(f);
      played.push(modeDifficulty(flowBuildMode(f, BANK_IDS, SEED)));
    }
    expect(played).toEqual([2, 4, 6]);
    expect(modeDifficulty(start('friendly-2p', 3, 11).m)).toBe(5);
    expect(modeDifficulty(start('training', 7).m)).toBe(5);
    expect(modeDifficulty(start('world-cup', 1).m)).toBe(3);   // the round of 16 (G15-7)
  });
});
```
(`modeDifficulty`, `MODE_LIST`, `flowMoveMode`, `flowModeKind`, `flowConfirmTeam`, `flowConfirmLineup`, `flowBuildMode`, `flowReset`, `start`, `BANK`, `BANK_IDS` y `SEED` ya están en el fichero.)

**`control-hints.test.ts`.** En `allTexts`, tras `h.mode,` añade `h.levelSelect,` (así el `it` «names Clásico's own A key everywhere and never Flechas' J» también la cubre). Y justo antes de `it('the name editor hint names no key of any scheme`:

```ts
  it('DIFICULTAD (G15-30): the cruceta picks the level, the scheme\'s own A confirms and its B goes back', () => {
    expect(CONTROL_HINTS.arrows.levelSelect).toBe('CRUCETA: NIVEL · A (J) CONFIRMA · B (K) VOLVER');
    expect(CONTROL_HINTS.classic.levelSelect).toBe('CRUCETA: NIVEL · A (Z) CONFIRMA · B (X) VOLVER');
  });
```

- [ ] **Step 2: Verlos fallar**

Run: `npx vitest run components/games/football-logic/mode.test.ts components/games/football-screen/flow.test.ts components/games/football-screen/control-hints.test.ts`
Expected (medido): FAIL **test a test**, nunca el fichero entero (vitest resuelve los exports que faltan como `undefined`):
- `mode.test.ts`: **2** rojos — el `it` nuevo (`AssertionError: expected undefined to deeply equal [ 'beginner', 'medium', 'pro' ]`) y el del bucle (`TypeError: Cannot read properties of undefined (reading 'medium')`).
- `flow.test.ts`: **11** rojos — los 4 nuevos, el de `phaseGroup` y los seis editados (`flowConfirmLevel` no existe: `TypeError … is not a function` o la fase sigue en `team-select`).
- `control-hints.test.ts`: **3** rojos — el `it` nuevo, «names Clásico's own A key everywhere…» y «the scheme row names the scheme…» (los dos recorren `allTexts`, que ahora mete un `undefined`).

Total **16** rojos (2 + 11 + 3), medidos sobre el árbol real de tras la T10.

- [ ] **Step 3: Implementar**

**`mode.ts`.** El bloque desde `type FriendlyState = …` hasta `export const FRIENDLY_DIFFICULTY = 5;` pasa a:

```ts
type FriendlyState = { homeId: string; awayId: string; status: ModeStatus };

// G15-30 (Paco, 07-oct): the CPU friendly is played at one of three levels, chosen on
// its own screen right after the mode. Only 'friendly-cpu' carries one: the two-player
// friendly and the training stay at FRIENDLY_DIFFICULTY, the World Cup at its ladder.
export type FriendlyLevel = 'beginner' | 'medium' | 'pro';
type CpuFriendlyState = FriendlyState & { level: FriendlyLevel };

export type GameMode =
  | { kind: 'friendly-cpu'; state: CpuFriendlyState }
  | { kind: Exclude<FriendlyKind, 'friendly-cpu'>; state: FriendlyState }
  | { kind: 'world-cup'; state: WorldCupState };

// G9-6: 5 in every friendly, no selector. Since G15-30 that is the two-player friendly
// and the training (and the probes, which play "the friendly difficulty"); the CPU
// friendly reads FRIENDLY_LEVEL_DIFFICULTY instead.
export const FRIENDLY_DIFFICULTY = 5;

// G15-30: the order of the screen (top to bottom) and the names Paco gave them, in
// English as he wrote them. Numbers, not branches.
export const FRIENDLY_LEVELS: readonly FriendlyLevel[] = ['beginner', 'medium', 'pro'];
export const FRIENDLY_LEVEL_NAMES: Readonly<Record<FriendlyLevel, string>> = {
  beginner: 'BEGINNER',
  medium: 'MEDIUM',
  pro: 'PRO',
};
export const FRIENDLY_LEVEL_DIFFICULTY: Readonly<Record<FriendlyLevel, number>> = {
  beginner: 2,
  medium: 4,
  pro: 6,
};
export const DEFAULT_FRIENDLY_LEVEL: FriendlyLevel = 'medium';
```

`createFriendlyMode` pasa a:

```ts
// `level` is read only by the CPU friendly (G15-30); the other two ignore it.
export function createFriendlyMode(
  kind: FriendlyKind, homeId: string, awayId: string, level: FriendlyLevel = DEFAULT_FRIENDLY_LEVEL,
): GameMode {
  if (homeId === awayId) throw new Error(`a friendly needs two different teams: ${homeId}`);
  if (kind === 'friendly-cpu') return { kind, state: { homeId, awayId, status: 'playing', level } };
  return { kind, state: { homeId, awayId, status: 'playing' } };
}
```

`modeDifficulty` pasa a:

```ts
export function modeDifficulty(m: GameMode): number {
  if (m.kind === 'world-cup') return worldCup.currentDifficulty(m.state);
  return m.kind === 'friendly-cpu' ? FRIENDLY_LEVEL_DIFFICULTY[m.state.level] : FRIENDLY_DIFFICULTY;
}
```

Entre el cierre de `MATCH_LABEL_BY_KIND` y `const FRIENDLY_VICTORY_TITLE = 'GANADOR';`:

```ts
// G15-30: the level rides on the CPU friendly's label, which the play page shows in its
// Estado box during the match -- the same place as the World Cup's round.
const CPU_FRIENDLY_LABEL_BY_LEVEL: Readonly<Record<FriendlyLevel, string>> = {
  beginner: `${MATCH_LABEL_BY_KIND['friendly-cpu']} · ${FRIENDLY_LEVEL_NAMES.beginner}`,
  medium: `${MATCH_LABEL_BY_KIND['friendly-cpu']} · ${FRIENDLY_LEVEL_NAMES.medium}`,
  pro: `${MATCH_LABEL_BY_KIND['friendly-cpu']} · ${FRIENDLY_LEVEL_NAMES.pro}`,
};
```

`modeMatchLabel` pasa a:

```ts
export function modeMatchLabel(m: GameMode): string {
  if (m.kind === 'world-cup') return worldCup.roundLabel(m.state);
  return m.kind === 'friendly-cpu' ? CPU_FRIENDLY_LABEL_BY_LEVEL[m.state.level] : MATCH_LABEL_BY_KIND[m.kind];
}
```
(Las plantillas son de **carga del módulo**, no de frame: criterio 20 intacto. `modeEndMatch`, `HUMAN_SIDE_BY_KIND[m.kind]` y `m.state.status` siguen compilando con la unión nueva: medido, `tsc` limpio.)

**`flow.ts`** (estado tras la T7).
1. El import de `../football-logic/mode` añade `DEFAULT_FRIENDLY_LEVEL, FRIENDLY_LEVELS` delante de `createFriendlyMode`.
2. `FlowPhase`: tras `| 'mode-select'   // the four modes` añade `| 'level-select'  // G15-30: BEGINNER / MEDIUM / PRO, the CPU friendly only`.
3. `phaseGroup`: añade `case 'level-select':` justo debajo de `case 'mode-select':` (rama `'menu'`).
4. Tras `export const PRE_MATCH_STEPS = stepsFor(3);`:

```ts

// G15-30 (Paco, 07-oct): the level screen opens right after AMISTOSO is chosen, and only
// there -- the two-player friendly, the training and the World Cup go on to the team
// selector as before. MEDIUM is the cursor's first position.
export const LEVEL_SELECT_BY_MODE: Readonly<Record<GameModeKind, boolean>> = {
  'friendly-cpu': true,
  'friendly-2p': false,
  training: false,
  'world-cup': false,
};
export const DEFAULT_LEVEL_INDEX = FRIENDLY_LEVELS.indexOf(DEFAULT_FRIENDLY_LEVEL);
```
5. `FlowState`: tras `preMatchStepsLeft: number;    // G15-19: …` añade `levelIndex: number;           // G15-30: cursor on FRIENDLY_LEVELS; survives a reset, like modeIndex`. `createFlowState`: en la línea `lineupCursor: 0, lineupChoosing: -1, lineupEditing: -1, preMatchStepsLeft: 0,` añade al final ` levelIndex: DEFAULT_LEVEL_INDEX,`. **`flowReset` no se toca** (el nivel sobrevive, como `modeIndex`).
6. `flowConfirmMode`: `f.phase = 'team-select';` pasa a `f.phase = LEVEL_SELECT_BY_MODE[flowModeKind(f)] ? 'level-select' : 'team-select';` (el resto del cuerpo igual).
7. Justo antes de `// G15-6: the key-scheme row of ELIGE MODO, flipped with left/right from any card.`:

```ts
// ── level-select (G15-30) ───────────────────────────────────────────────────────

// The cruceta walks BEGINNER - MEDIUM - PRO with a stop at each end (the bracket's rule,
// G15-8): a repeated press towards PRO stays on PRO instead of wrapping to BEGINNER.
export function flowMoveLevel(f: FlowState, delta: number): void {
  if (f.phase !== 'level-select' || delta === 0) return;
  const next = f.levelIndex + (delta < 0 ? -1 : 1);
  if (next >= 0 && next < FRIENDLY_LEVELS.length) f.levelIndex = next;
}

// A: on to the team selector, with the level kept for flowBuildMode.
export function flowConfirmLevel(f: FlowState): void {
  if (f.phase !== 'level-select') return;
  f.phase = 'team-select';
}

// B (Paco's (d): the back button of every screen): back to ELIGE MODO, on the same mode.
export function flowLevelBack(f: FlowState): void {
  if (f.phase !== 'level-select') return;
  f.phase = 'mode-select';
}

```
8. `flowBuildMode`: `return createFriendlyMode(kind, homeId, awayId);` pasa a `return createFriendlyMode(kind, homeId, awayId, FRIENDLY_LEVELS[f.levelIndex]);`.

**`control-hints.ts`.** `ControlHints`: tras `readonly mode: string;           // ELIGE MODO: the screen hint` añade `readonly levelSelect: string;    // G15-30: DIFICULTAD, the CPU friendly's level`. `buildHints`: tras la línea `mode: …,` añade

```ts
    levelSelect: `CRUCETA: NIVEL · A (${a}) CONFIRMA · B (${b}) VOLVER`,
```

Tras este paso, `npx tsc --noEmit` da **exactamente 1 error**: `VaultWorldCupGame.tsx` `menuAction` TS2366 (sin `case 'level-select'`). Lo cierra el Step 5.

- [ ] **Step 4: Verlos pasar**

Run: `npx vitest run components/games/football-logic/mode.test.ts components/games/football-screen/flow.test.ts components/games/football-screen/control-hints.test.ts`
Expected: PASS, los tres enteros.

- [ ] **Step 5: Cableado en `VaultWorldCupGame.tsx`**

1. Al import de `./football-logic/mode` añade `FRIENDLY_LEVELS, FRIENDLY_LEVEL_NAMES` (antes de los `type …`). Al import de `./football-screen/flow` añade `flowConfirmLevel`, `flowLevelBack` y `flowMoveLevel` (la T9 añadió `flowEndPreMatch`/`flowStepPreMatch` a ese mismo import: **se añade al bloque, no se reescribe**).
2. Tras `const MODE_TITLE = 'ELIGE MODO';`: `const LEVEL_TITLE = 'DIFICULTAD';   // G15-30`.
3. Justo antes de `    function drawTeamSelect(): void {`:

```tsx
    // G15-30: the CPU friendly's three levels, as three of the mode cards -- the same
    // highlight (accent border and name) as ELIGE MODO, the cursor on flow.levelIndex.
    function drawLevelSelect(): void {
      drawMenuBackground(LEVEL_TITLE);
      const x = (VIEW_W - MODE_CARD_W) / 2;
      for (let i = 0; i < FRIENDLY_LEVELS.length; i++) {
        const y = modeCardY(i);
        const selected = i === flow.levelIndex;
        ctx.fillStyle = CARD_BG;
        ctx.fillRect(x, y, MODE_CARD_W, MODE_CARD_H);
        ctx.strokeStyle = selected ? HUD_ACCENT : CARD_BORDER;
        ctx.lineWidth = selected ? 3 : 1;
        ctx.strokeRect(x, y, MODE_CARD_W, MODE_CARD_H);
        ctx.textAlign = 'center';
        ctx.font = FONT_MENU_ITEM;
        ctx.fillStyle = selected ? HUD_ACCENT : HUD_TEXT;
        ctx.fillText(FRIENDLY_LEVEL_NAMES[FRIENDLY_LEVELS[i]], VIEW_W / 2, y + MODE_CARD_H / 2);
      }
      drawHint(CONTROL_HINTS[flow.keyScheme].levelSelect, MODE_HINT_Y);
    }

```
(`drawMenuBackground` deja `textBaseline = 'middle'`; ninguna asignación por frame: `x`, `y`, `selected` son números/booleanos, los textos son constantes.)
4. `draw()`: tras `        case 'mode-select': drawModeSelect(); break;` añade `        case 'level-select': drawLevelSelect(); break;`.
5. `menuAction`: tras el `case 'mode-select':` (su bloque termina en `else if (k === 'a') flowConfirmMode(flow);` / `else return false;` / `return true;`), y antes de `case 'team-select':`:

```tsx
        case 'level-select':
          // G15-30: the cruceta walks the three levels, A goes on, B goes back.
          if (k === 'up' || k === 'left') flowMoveLevel(flow, -1);
          else if (k === 'down' || k === 'right') flowMoveLevel(flow, 1);
          else if (k === 'a') flowConfirmLevel(flow);
          else if (k === 'b') flowLevelBack(flow);
          else return false;
          return true;
```
**No se tocan** `handleKeyDown` (la fase cae en `menuTable()`), `pauseTables()` (rama por defecto), `pollGamepadFrame`/`routeMenuGamepad` (el mando 1 llega a `menuAction`), `update()` (rama final de menús), `handleResize` ni `startHumanMatch` (que ya hace `reportStatus(modeMatchLabel(mode))`: el cuadro Estado dirá `AMISTOSO · MEDIUM` sin tocarlo).

- [ ] **Step 6: Controles negativos (ejecutar y REVERTIR cada uno; resultados medidos en la copia)**

1. `mode.ts`, `pro: 6,` → `pro: 5,` → FALLA el `it` G15-30: `expected [ 2, 4, 5 ] to deeply equal [ 2, 4, 6 ]`.
2. `mode.ts`, la segunda línea de `modeDifficulty` → `return FRIENDLY_DIFFICULTY;` → FALLAN 2: `expected 5 to be 4` (bucle) y `expected [ 5, 5, 5 ] to deeply equal [ 2, 4, 6 ]`.
3. `mode.ts`, `level: FriendlyLevel = DEFAULT_FRIENDLY_LEVEL,` → `level: FriendlyLevel = 'pro',` → FALLAN 2: `expected 6 to be 4` (las dos).
4. `mode.ts`, la segunda línea de `modeMatchLabel` → `return MATCH_LABEL_BY_KIND[m.kind];` → FALLAN 2: `expected 'AMISTOSO' to be 'AMISTOSO · MEDIUM'` y `expected [ 'AMISTOSO', 'AMISTOSO', 'AMISTOSO' ] to deeply equal [ 'AMISTOSO · BEGINNER', …(2) ]`.
5. `flow.ts`, `LEVEL_SELECT_BY_MODE` con `'friendly-2p': true` → FALLAN 2: `expected { 'friendly-cpu': true, …(3) } to deeply equal …` y `expected 'refused' to be 'next'` (el amistoso a dos se quedaría en DIFICULTAD).
6. `flow.ts`, el `if` de `flowMoveLevel` → `f.levelIndex = (next + FRIENDLY_LEVELS.length) % FRIENDLY_LEVELS.length;` (envolver) → FALLA: `expected 2 to be +0`.
7. `flow.ts`, `flowReset` con `f.levelIndex = DEFAULT_LEVEL_INDEX;` antes de `f.after = 'mode-select';` → FALLA: `expected [ 'mode-select', 1 ] to deeply equal [ 'mode-select', 2 ]`.
8. `flow.ts`, `flowBuildMode` sin el cuarto argumento → FALLA: `expected [ 4, 4, 4 ] to deeply equal [ 2, 4, 6 ]`.
9. `flow.ts`, `flowLevelBack` con `f.phase = 'team-select';` → FALLA: `expected [ 'team-select', 'friendly-cpu', 2 ] to deeply equal [ 'mode-select', 'friendly-cpu', 2 ]`.
10. `flow.ts`, `phaseGroup` con `case 'level-select': return 'match';` → FALLA: `expected [ 'menu', 'match', 'menu', …(8) ] to deeply equal [ Array(11) ]`.
11. `flow.ts`, `flowConfirmLevel` con `f.phase = 'lineup';` → FALLAN **11**, el primero `expected 'lineup' to be 'team-select'`.

Revertidos los once: `git diff <base> -- components/games/football-logic/mode.ts components/games/football-screen/flow.ts` enseña solo lo del Step 3.

- [ ] **Step 7: Revisión de revisor (punto por punto) y compuertas**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-logic/mode.ts components/games/football-logic/mode.test.ts components/games/football-screen/flow.ts components/games/football-screen/flow.test.ts components/games/football-screen/control-hints.ts components/games/football-screen/control-hints.test.ts components/games/VaultWorldCupGame.tsx
./.superpowers/sdd/2026-10-07-vault-world-cup-v15-5-extras/sdd.sh gate
B=$(grep 'Base tree:' .superpowers/sdd/2026-10-07-vault-world-cup-v15-5-extras/progress.md | awk '{print $3}')
git diff $B -- components/games/VaultWorldCupGame.tsx | grep "^+" | grep -v "^+++" | grep -vE "^\+\s*//" | grep -nE "new |\`|\.map\(|\.filter\(|\.slice\(|=>|\[\]|\{ *\}"
git diff $B -- components/games/VaultWorldCupGame.tsx | grep "^+" | grep -v "^+++" | grep -nE "kind ===|modeKind|'friendly-cpu'"
```
Expected: **1567 tests en 94 ficheros**; `tsc` y `eslint` sin salida; `gate` según las Global Constraints (motor: `mode.test.ts`, `mode.ts`); el `grep` de asignaciones del `.tsx`, **vacío**; el último, **vacío** (regla de `mode.ts`: el componente nunca pregunta qué modo tiene; el `.tsx` ya tiene `captions.kind ===` y `sp.kind ===`, que no son eso, por eso se mira solo lo añadido).

Comprueba a mano: (1) en `drawLevelSelect` no se construye ninguna cadena; (2) DIFICULTAD solo aparece tras AMISTOSO (no tras AMISTOSO A DOS, ENTRENAMIENTO ni MUNDIAL); (3) `startHumanMatch` sigue llamando a `reportStatus(modeMatchLabel(mode))` y ningún otro sitio del `.tsx` compara la etiqueta con `'AMISTOSO'`.

- [ ] **Step 8: Ledger**

`./sdd.sh step 11` y, en `progress.md`: `Task V15-5-11: G15-30 — friendly-cpu con level (BEGINNER 2 / MEDIUM 4 / PRO 6, MEDIUM por defecto), fase 'level-select' tras AMISTOSO (cruceta con topes, A sigue, B vuelve, el nivel sobrevive al reset), etiqueta «AMISTOSO · <NIVEL>» en Estado; 1567 / 94; motor: mode.ts(+test); 11 controles revertidos.`

---

### Task V15-5-12: el saque rápido con A en los balones parados — y cierre (G15-31)

**Files:**
- Modify: `components/games/football-logic/input.ts` (`export type TeamInput = {…}`, `createTeamInput`, `copyTeamInput`)
- Modify: `components/games/football-logic/set-pieces.ts` (`stepSetPiece`: `sp.stepsLeft--;` / `if (sp.stepsLeft > 0) return false;`)
- Modify: `components/games/football-screen/keyboard.ts` (antes de `function settle(b: ButtonState): ButtonState {`)
- Modify: `components/games/football-screen/hud.ts` (antes de `// The picker offers only what match.ts's substitute accepts`)
- Modify: `components/games/football-screen/control-hints.ts` (tras `export function injuryHintFor`)
- Modify: `components/games/VaultWorldCupGame.tsx` (imports de `control-hints`, `hud`, `keyboard`; `runStep`: `run.inputs[0].sub = -1;` y `run.inputs[1].sub = -1;`; `drawHud`: `if (idleHint(match) === 'aim') {`)
- Modify: `specs/31-vault-world-cup.md` (tras la línea `*Implementado en V15-5 (Task 1): …*` que la T10 dejó bajo G15-29)
- Test: `components/games/football-logic/input.test.ts`, `components/games/football-logic/set-pieces.test.ts`, `components/games/football-screen/keyboard.test.ts`, `components/games/football-screen/hud.test.ts`, `components/games/football-screen/control-hints.test.ts`
- Create (ledger): `.superpowers/sdd/2026-10-07-vault-world-cup-v15-5-extras/qa-paco.md`

**Interfaces:**
- Consumes: `stepSetPiece`, `SetPieceState`, `SetPieceKind`, `createMatch`, `stepMatch`, `profileFor`; `padToTeamInput`, `padAdvance`, `padDown`, `padUp`, `createPadState`; `keyLabel`, `ARROWS_SOLO`, `CLASSIC_SOLO`, `TWO_PLAYER_P1`; en el `.tsx`, `run.human`, `tables`, `idleHint`, `HINT_AIM`, `HINT_TEXT`.
- Produces: `TeamInput.quickKick: boolean` (`createTeamInput` → `false`); `stepSetPiece` saca en el paso con `quickKick` en los cinco tipos (nunca `'penalty'`); `padQuickKick(out: TeamInput): void`; `quickKickTeam(match, human): 0 | 1 | -1`; `quickKickHintFor(table): string`.

**Por qué no hay regrabado (y cómo se prueba):** ver «Riesgo 1» en las Global Constraints. La prueba en ejecución es triple: la suite entera verde con **cero** cambios de valor esperado en tests de partido; el `gate` (frozen stat vacío, md5, y los únicos escritores de `quickKick` son `copyTeamInput` y `padQuickKick`); y el `it` «A pressed, held or released WITHOUT the flag changes nothing», que fija el contrato del que dependen las grabaciones.

- [ ] **Step 1: Escribir los tests que fallan**

**`input.test.ts`.** En `it('createTeamInput is the neutral input'`:

```ts
    expect(createTeamInput()).toEqual({
      dx: 0, dy: 0, a: 'up', b: 'up', c: 'up', formation: 0, strategy: 'neutral', sub: -1, quickKick: false,
    });
```
y en `it('copyTeamInput copies every field without aliasing'`, al final de la línea `from.dx = -1; … from.sub = 13;` añade ` from.quickKick = true;`. (Ediciones, no tests nuevos.)

**`set-pieces.test.ts`.** El import `import { createTeamInput, type TeamInput } from './input';` pasa a

```ts
import { createTeamInput, type ButtonState, type TeamInput } from './input';
import { createMatch, stepMatch } from './match';
import { profileFor } from './ai';
```
Y justo antes de `describe('penalty', () => {`:

```ts
// ── G15-31 (Paco, 07-oct): "A saca al momento" ────────────────────────────────────
describe('G15-31: the quick kick', () => {
  // The five kinds that go by themselves, with the kick each one is (the table of
  // 'automatic execution by kind' above). The aim of the PRESS step differs from the one
  // held before it, so "in the aimed direction" means the aim of that very step.
  type Quick = { kind: SetPieceKind; team: 0 | 1; x: number; y: number; dy: -1 | 1; event: 'short-pass' | 'long-pass' | 'shot' };
  const QUICK: readonly Quick[] = [
    { kind: 'kickoff', team: 0, x: SPOT_X, y: CY, dy: 1, event: 'short-pass' },
    { kind: 'throw-in', team: 1, x: 700, y: 0, dy: 1, event: 'short-pass' },
    { kind: 'goal-kick', team: 0, x: PITCH.smallAreaDepth, y: CY, dy: -1, event: 'long-pass' },
    { kind: 'corner', team: 1, x: 0, y: PITCH.height, dy: -1, event: 'long-pass' },
    { kind: 'free-kick', team: 0, x: 1500, y: 500, dy: 1, event: 'shot' },
  ];

  it('takes kickoff, throw-in, goal kick, corner and free kick on the step of the press, at that step\'s aim', () => {
    for (const q of QUICK) {
      const w = world();
      begin(w, q.kind, q.team, q.x, q.y);
      w.input.dx = 1;
      w.input.dy = 0;
      expect(run(w, 10), `${q.kind}: nothing before the press`).toBe(-1);
      w.input.dx = 0;
      w.input.dy = q.dy;
      w.input.quickKick = true;
      expect(run(w, 1, createRng(1), 0.6, 11), `${q.kind}: taken on the press`).toBe(11);
      expect(w.sp.stepsLeft, `${q.kind}: countdown cut`).toBe(0);
      expect(w.out.kind, `${q.kind}: the kick of its kind`).toBe(q.event);
      expect(w.ball.owner, `${q.kind}: the ball is away`).toBeNull();
      expect(w.ball.vx, `${q.kind}: no x left from the old aim`).toBeCloseTo(0, 10);
      expect(Math.sign(w.ball.vy), `${q.kind}: along the new aim`).toBe(q.dy);
    }
  });

  it('the penalty ignores it: the side still sticks and the countdown still runs to zero', () => {
    const w = world();
    begin(w, 'penalty', 0, PITCH.width - PITCH.penaltySpotDist, CY);
    w.input.dy = 1;
    w.input.quickKick = true;
    const rng = fixedRng([0.61, 0.3]);
    expect(run(w, SET_PIECE_COUNTDOWN_STEPS - 1, rng)).toBe(-1);
    expect([w.sp.stepsLeft, w.sp.side]).toEqual([1, 1]);
    expect(run(w, 1, rng, 0.6, SET_PIECE_COUNTDOWN_STEPS)).toBe(SET_PIECE_COUNTDOWN_STEPS);
  });

  it('A pressed, held or released WITHOUT the flag changes nothing: the CPU, the recordings and the probes never write it', () => {
    const states: ButtonState[] = ['pressed', 'held', 'released'];
    for (const state of states) {
      const w = world();
      begin(w, 'free-kick', 0, 1500, 500);
      w.input.a = state;
      w.input.b = state;
      w.input.c = state;
      expect(run(w, SET_PIECE_COUNTDOWN_STEPS - 1), `A ${state}`).toBe(-1);
      expect(w.sp.stepsLeft, `A ${state}`).toBe(1);
    }
  });

  it('through stepMatch only the TAKING team\'s flag counts, and play resumes on the step of the press', () => {
    const m = createMatch([TEAMS[0], TEAMS[1]], FORMATIONS, PITCH, [profileFor(TEAMS[0], 5), profileFor(TEAMS[1], 5)]);
    const sp = m.setPiece;
    if (sp === null) throw new Error('a match opens with its kickoff');
    const taking = sp.team;
    const inputs: [TeamInput, TeamInput] = [createTeamInput(), createTeamInput()];
    inputs[taking === 0 ? 1 : 0].quickKick = true;
    stepMatch(m, inputs, createRng(1));
    expect([m.phase, sp.stepsLeft]).toEqual(['kickoff', SET_PIECE_COUNTDOWN_STEPS - 1]);
    inputs[taking === 0 ? 1 : 0].quickKick = false;
    inputs[taking].quickKick = true;
    const takerId = sp.takerId;
    stepMatch(m, inputs, createRng(1));
    expect(m.phase).toBe('play');
    expect(m.scratch.events[takerId].kind).toBe('short-pass');
  });
});

```
(`SPOT_X`, `CY`, `world`, `begin`, `run`, `fixedRng`, `SET_PIECE_COUNTDOWN_STEPS`, `createRng`, `TEAMS`, `FORMATIONS`, `PITCH` y el tipo `SetPieceKind` ya están en el fichero. El tercer `it` es **el contrato de las grabaciones**: si alguien hiciera que A sola sacase, las 24 pulsaciones de `match.test.ts` cambiarían la carrera C sin que nada fallase; este `it` falla antes.)

**`keyboard.test.ts`.** Al import de `./keyboard` añade `padQuickKick` (tras `padKeyFor`). Justo antes de `describe('padChoice', () => {`:

```ts
// G15-31: the quick kick is the edge of A, never its level.
describe('padQuickKick', () => {
  it('is true only on the step A goes down: not while held, not on release, not after the frame advances', () => {
    const pad = createPadState('neutral', 0);
    const out = createTeamInput();
    const seen: boolean[] = [];
    const step = (first: boolean): void => {
      padToTeamInput(pad, first, out);
      padQuickKick(out);
      seen.push(out.quickKick);
    };
    step(true);                // nothing pressed
    padDown(pad, 'a');
    step(true);                // the press
    step(false);               // same frame, second step: held
    padAdvance(pad);
    step(true);                // next frame, still down: held
    padUp(pad, 'a');
    step(true);                // released
    padAdvance(pad);
    padDown(pad, 'a');
    step(true);                // pressed again: a new kick
    expect(seen).toEqual([false, true, false, false, false, true]);
  });
});

```

**`hud.test.ts`.** El import de `../football-logic/match` añade `type MatchPhase` (queda `createMatch, substitute, TRAINING_RULES, type MatchPhase, type MatchState`) y debajo `import type { SetPieceKind } from '../football-logic/referee';`. Al import de `./hud` añade `quickKickTeam` (tras `keeperHoldsBall`). Justo antes de `describe('idleHint', () => {`:

```ts
// G15-31: which human, if any, can take the set piece now with A.
describe('quickKickTeam', () => {
  it('is the taking team when it is human, in a kickoff or a restart -- never a penalty, a CPU kick or another phase', () => {
    const m = newMatch();
    const sp = m.setPiece;
    if (sp === null) throw new Error('a match opens with its kickoff');
    expect(m.phase).toBe('kickoff');
    const taking = sp.team;
    const both: [boolean, boolean] = [true, true];
    const onlyOther: [boolean, boolean] = [taking === 1, taking === 0];
    expect(quickKickTeam(m, both)).toBe(taking);
    expect(quickKickTeam(m, onlyOther)).toBe(-1);         // the CPU takes it: no A hint
    m.phase = 'set-piece';
    const restarts: SetPieceKind[] = ['throw-in', 'goal-kick', 'corner', 'free-kick'];
    for (const kind of restarts) {
      sp.kind = kind;
      expect([kind, quickKickTeam(m, both)]).toEqual([kind, taking]);
    }
    sp.kind = 'penalty';
    expect(quickKickTeam(m, both)).toBe(-1);              // the penalty keeps its countdown
    sp.kind = 'free-kick';
    const others: MatchPhase[] = ['play', 'golden-goal', 'goal', 'half-time', 'shootout', 'injury', 'over'];
    for (const phase of others) {
      m.phase = phase;
      expect([phase, quickKickTeam(m, both)]).toEqual([phase, -1]);
    }
  });
});

```

**`control-hints.test.ts`.** Al import de `./control-hints` añade `quickKickHintFor` (tras `keyLabel`). Justo antes de `it('keyLabel names the key a table reads for a pad key, upper-cased, and throws when there is none'`:

```ts
  // G15-31: a human set piece can go at once with A; the line names the A of the table
  // of the team that takes it, and still says that waiting works as before.
  it('quickKickHintFor: the d-pad aims and the table\'s own A takes the kick, or it goes by itself', () => {
    expect(quickKickHintFor(ARROWS_SOLO)).toBe('CRUCETA: APUNTAR · A (J) SACA · SI NO, SALE SOLO');
    expect(quickKickHintFor(TWO_PLAYER_P2)).toBe('CRUCETA: APUNTAR · A (J) SACA · SI NO, SALE SOLO');
    expect(quickKickHintFor(TWO_PLAYER_P1)).toBe('CRUCETA: APUNTAR · A (C) SACA · SI NO, SALE SOLO');
    expect(quickKickHintFor(CLASSIC_SOLO)).toBe('CRUCETA: APUNTAR · A (Z) SACA · SI NO, SALE SOLO');
  });

```

- [ ] **Step 2: Verlos fallar**

Run: `npx vitest run components/games/football-logic/input.test.ts components/games/football-logic/set-pieces.test.ts components/games/football-screen/keyboard.test.ts components/games/football-screen/hud.test.ts components/games/football-screen/control-hints.test.ts`
Expected (medido), test a test:
- `input.test.ts`: **2** rojos — `createTeamInput is the neutral input` (`expected { dx: +0, dy: +0, a: 'up', …(5) } to deeply equal { dx: +0, dy: +0, a: 'up', …(6) }`) y `copyTeamInput copies every field without aliasing` (`expected { dx: -1, dy: 1, a: 'held', …(5) } to deeply equal { …(6) }`: la copia de hoy no lleva el campo).
- `set-pieces.test.ts`: **2** rojos — `kickoff: taken on the press: expected -1 to be 11` y `expected 'kickoff' to be 'play'`. Los otros dos **pasan ya en rojo a propósito**: «the penalty ignores it» y «WITHOUT the flag changes nothing» fijan lo que NO debe cambiar; los ponen a prueba los controles 2 y 3.
- `keyboard.test.ts`, `hud.test.ts`, `control-hints.test.ts`: **1** rojo cada uno (`TypeError: padQuickKick is not a function` / `quickKickTeam` / `quickKickHintFor`).

Total **7** rojos, medidos sobre el árbol real de tras la T10 con la Task 11 aplicada.

- [ ] **Step 3: Implementar**

**`input.ts`.** En `TeamInput`, tras `  sub: number;`:

```ts
  // G15-31 (Paco, 07-oct): "A saca al momento" -- the set piece is taken on THIS step, at
  // this step's aim, instead of waiting for its countdown. Written ONLY by the screen, from
  // a fresh human press of A (keyboard.ts padQuickKick: the edge 'pressed', never 'held'),
  // and read ONLY by stepSetPiece for the five kinds that go by themselves -- never the
  // penalty. A field of its own and not `a === 'pressed'` because the recorded matches of
  // match.test.ts press A in set pieces too (24 presses, all in its run C) and none of them
  // must change: nothing but the screen writes this field, so it stays false there.
  quickKick: boolean;
```
`createTeamInput`: `sub: -1 };` pasa a `sub: -1, quickKick: false };`. `copyTeamInput`: tras `  to.sub = from.sub;` añade `  to.quickKick = from.quickKick;`. (`checkTeamInput` no cambia: un booleano es válido por tipo, y `engine-invariants.test.ts` no se toca.)

**`set-pieces.ts`.** En `stepSetPiece`, entre `  sp.stepsLeft--;` y `  if (sp.stepsLeft > 0) return false;`:

```ts
  // G15-31: A takes it now, AFTER this step's aim (so it goes where the d-pad points on
  // the very step of the press). The penalty keeps its countdown and its side (Paco).
  if (input.quickKick && sp.kind !== 'penalty') sp.stepsLeft = 0;
```
(Nada más cambia: el `switch` de ejecución es el de siempre, así que el saque rápido es **el mismo** pase/disparo que el automático, solo antes. La tanda llama a `stepSetPiece` solo con `'penalty'`: no le afecta.)

**`keyboard.ts`.** Justo antes de `function settle(b: ButtonState): ButtonState {`:

```ts
// G15-31 (Paco, 07-oct): "A saca al momento". The quick kick is a fresh human press of A
// -- the EDGE: 'pressed' lasts one step (settle, padAdvance), so an A held since before
// the whistle reads 'held' and never takes the kick; the player has to let go and press
// again, the LESIONADO window's rule. The component calls this for each HUMAN side after
// both devices have written the step's input (the gamepad can turn 'held' into
// 'pressed'); the CPU never does, so its quickKick stays false (input.ts).
export function padQuickKick(out: TeamInput): void {
  out.quickKick = out.a === 'pressed';
}

```

**`hud.ts`.** Justo antes de `// The picker offers only what match.ts's substitute accepts`:

```ts
// G15-31 (Paco, 07-oct): the HUMAN team that can take the set piece standing now with A
// -- a kickoff or any restart but the penalty, which keeps its countdown -- or -1. The
// screen swaps the bottom line for that table's quickKickHintFor; a CPU set piece, the
// penalty, the shootout and the goal and half-time pauses keep HINT_AIM.
export function quickKickTeam(match: MatchState, human: readonly [boolean, boolean]): 0 | 1 | -1 {
  if (match.phase !== 'kickoff' && match.phase !== 'set-piece') return -1;
  const sp = match.setPiece;
  if (sp === null || sp.kind === 'penalty' || !human[sp.team]) return -1;
  return sp.team;
}

```

**`control-hints.ts`.** Tras el cierre de `export function injuryHintFor(table: KeyTable): string { … }`:

```ts

// G15-31 (Paco, 07-oct): a human set piece -- kickoff, throw-in, goal kick, corner, free
// kick -- can go at once with A, or by itself when the countdown ends, as before. Per
// table, like the two above, so the line names the A of the team taking it.
function quickKickHint(table: KeyTable): string {
  return `CRUCETA: APUNTAR · A (${keyLabel(table, 'a')}) SACA · SI NO, SALE SOLO`;
}
const QUICK_KICK_HINT_ARROWS = quickKickHint(ARROWS_SOLO);   // also J2's: the same J
const QUICK_KICK_HINT_CLASSIC = quickKickHint(CLASSIC_SOLO);
const QUICK_KICK_HINT_P1 = quickKickHint(TWO_PLAYER_P1);

export function quickKickHintFor(table: KeyTable): string {
  if (table === CLASSIC_SOLO) return QUICK_KICK_HINT_CLASSIC;
  if (table === TWO_PLAYER_P1) return QUICK_KICK_HINT_P1;
  return QUICK_KICK_HINT_ARROWS;
}
```

- [ ] **Step 4: Verlos pasar**

Run: el mismo comando del Step 2. Expected: PASS, los cinco enteros.

- [ ] **Step 5: Cableado en `VaultWorldCupGame.tsx`**

1. Imports: al de `./football-screen/control-hints` añade `quickKickHintFor` (la T9 añadió `PRE_MATCH_HINT_TWO` a esa línea: se añade, no se reescribe); al de `./football-screen/hud` añade `quickKickTeam` (tras `keeperHoldsBall`); al de `./football-screen/keyboard` añade `padQuickKick` (tras `padKeyFor`).
2. `runStep`, en el bloque `if (run.human[0]) {`: tras `        run.inputs[0].sub = -1;` añade

```tsx
        padQuickKick(run.inputs[0]);   // G15-31: after both devices, the edge of A only
```
y en el bloque `if (run.human[1]) {`, tras `        run.inputs[1].sub = -1;`:

```tsx
        padQuickKick(run.inputs[1]);
```
(Los dos van **después** de `overlayPadToTeamInput`, porque el mando puede convertir un `'held'` del teclado en `'pressed'`. Una CPU nunca pasa por estos bloques: su `quickKick` sigue en `false` desde `createTeamInput`. Mismo sitio y misma vida de un paso que `sub`.)
3. `drawHud`: el bloque

```tsx
      if (idleHint(match) === 'aim') {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HINT_TEXT;
        ctx.fillText(HINT_AIM, VIEW_W / 2, VIEW_H - 14);
      }
```
pasa a

```tsx
      // G15-31: a HUMAN kickoff or restart (not the penalty) can go at once with A, so its
      // line names that team's A; every other stop keeps HINT_AIM, as before.
      const quickTeam = quickKickTeam(match, run.human);
      if (quickTeam !== -1 || idleHint(match) === 'aim') {
        ctx.textAlign = 'center';
        ctx.font = FONT_SMALL;
        ctx.fillStyle = HINT_TEXT;
        ctx.fillText(quickTeam !== -1 ? quickKickHintFor(tables[quickTeam]) : HINT_AIM, VIEW_W / 2, VIEW_H - 14);
      }
```
(El comentario de encima, `// Only the AIM line: during the LESIONADO window A does something …`, se queda: sigue siendo cierto. `quickKickHintFor` devuelve una constante: criterio 20 intacto. En un saque de la CPU, `quickTeam` es -1 y sale `HINT_AIM` como hoy.)

- [ ] **Step 6: Controles negativos (ejecutar y REVERTIR cada uno; resultados medidos en la copia)**

1. `set-pieces.ts`, quita la línea G15-31 → FALLAN 2: `kickoff: taken on the press: expected -1 to be 11` y `expected 'kickoff' to be 'play'`.
2. `set-pieces.ts`, `&& sp.kind !== 'penalty'` fuera → FALLA «the penalty ignores it»: `expected 1 to be -1`.
3. `set-pieces.ts`, la condición → `(input.quickKick || input.a === 'pressed') && sp.kind !== 'penalty'` (la variante ingenua) → FALLA «WITHOUT the flag»: `A pressed: expected 1 to be -1`.
4. `match.ts` (control solo; **se revierte**, el fichero está congelado), en la rama `case 'set-piece':` de `stepMatch`, `sp, inputs[sp.team], …` → `sp, inputs[keeperTeam], …` → FALLA «through stepMatch»: `expected [ 'play', +0 ] to deeply equal [ 'kickoff', 299 ]`.
5. `keyboard.ts`, `out.quickKick = out.a === 'pressed' || out.a === 'held';` (nivel en vez de flanco) → FALLA: `expected [ Array(6) ] to deeply equal [ false, true, false, false, …(2) ]`.
6. `input.ts`, quita `to.quickKick = from.quickKick;` → FALLA la copia: `expected { dx: -1, dy: 1, a: 'held', …(6) } to deeply equal { …(6) }`.
7. `hud.ts`, quita `sp.kind === 'penalty' ||` → FALLA: `expected +0 to be -1` (la cifra es el equipo que saca de centro en `newMatch`).
8. `hud.ts`, quita `|| !human[sp.team]` → FALLA: `expected +0 to be -1` (la línea `onlyOther`).
9. `hud.ts`, la primera línea → `if (match.phase === 'over') return -1;` → FALLA: `expected [ 'play', +0 ] to deeply equal [ 'play', -1 ]`.
10. `control-hints.ts`, `keyLabel(table, 'a')` → `keyLabel(ARROWS_SOLO, 'a')` → FALLA: `expected 'CRUCETA: APUNTAR · A (J) SACA · SI NO…' to be 'CRUCETA: APUNTAR · A (C) SACA · SI NO…'`.

Revertidos los diez: `git diff <base> -- components/games/football-logic/` enseña solo los seis ficheros de la tabla y `match.ts` no aparece.

- [ ] **Step 7: Revisión de revisor y compuertas**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-logic/input.ts components/games/football-logic/input.test.ts components/games/football-logic/set-pieces.ts components/games/football-logic/set-pieces.test.ts components/games/football-screen/keyboard.ts components/games/football-screen/keyboard.test.ts components/games/football-screen/hud.ts components/games/football-screen/hud.test.ts components/games/football-screen/control-hints.ts components/games/football-screen/control-hints.test.ts components/games/VaultWorldCupGame.tsx
./.superpowers/sdd/2026-10-07-vault-world-cup-v15-5-extras/sdd.sh gate
B=$(grep 'Base tree:' .superpowers/sdd/2026-10-07-vault-world-cup-v15-5-extras/progress.md | awk '{print $3}')
git diff $B -- components/games/VaultWorldCupGame.tsx | grep "^+" | grep -v "^+++" | grep -vE "^\+\s*//" | grep -nE "new |\`|\.map\(|\.filter\(|\.slice\(|=>|\[\]|\{ *\}"
grep -rn "quickKick" components/games/football-logic/ai.ts components/games/football-logic/match.ts components/games/football-logic/probe-harness.ts components/games/football-screen/match-run.ts
```
Expected: **1574 tests en 94 ficheros**, 0 saltados; `tsc` y `eslint` sin salida; `gate` exactamente como en las Global Constraints (motor: los **seis** ficheros de la tabla; md5 bueno; frozen vacío; escritores de `quickKick`: `input.ts` y `keyboard.ts`; llamadas a `padQuickKick`: la definición y las dos del `.tsx`); asignaciones del `.tsx`, **vacío**; el último `grep`, **vacío** (ni la CPU, ni el motor, ni las sondas, ni `match-run` saben que existe).

Comprueba a mano: (1) `padQuickKick` va después de `overlayPadToTeamInput` en los dos bloques; (2) la tanda (`stepShootout`) llama a `stepSetPiece` con un `'penalty'`; (3) en el entrenamiento el equipo congelado no es humano, así que su `quickKick` sigue en `false`.

- [ ] **Step 8: Cierre — anotar el spec**

En `specs/31-vault-world-cup.md`, tras la línea en cursiva que empieza por `*Implementado en V15-5 (Task 1):` (la que la T10 dejó bajo el bullet G15-29; verificado el 07-oct que ya está en el working tree), con la misma sangría que el bullet `- **G15-29 · …`. Si esa línea no existiera, va tras el último renglón del bullet G15-29:

```markdown
    - **G15-30 · Dificultad del Amistoso vs CPU (Paco, 2026-10-07):** tres niveles, BEGINNER = 2, MEDIUM = 4, PRO = 6, por
      defecto MEDIUM, con los nombres en inglés tal cual. Se eligen en una pantalla propia justo después de elegir Amistoso vs
      CPU, con cruceta y A (el patrón del selector de formación); en el partido, una etiqueta discreta con el nivel, como la ronda
      en el Mundial. No afecta al amistoso a dos, al entrenamiento ni al Mundial.
      *Implementado en V15-5 (extras, Task 11): `GameMode` `friendly-cpu` lleva `level` y `modeDifficulty` lo lee
      (`FRIENDLY_DIFFICULTY` = 5 se queda para el amistoso a dos, el entrenamiento y las sondas); fase DIFICULTAD tras AMISTOSO,
      cruceta con tope en los extremos, A sigue y B vuelve a ELIGE MODO, el nivel se recuerda como el modo; la etiqueta va al
      cuadro Estado de la página, «AMISTOSO · MEDIUM», donde va la ronda del Mundial. Sin regrabado.*
    - **G15-31 · Saque rápido en balones parados (Paco, 2026-10-07):** en saque inicial, banda, puerta, córner y falta, pulsar A
      saca al momento en la dirección apuntada; si no se pulsa, la cuenta atrás sigue igual. El penalti no cambia. El aviso de
      abajo nombra la tecla real de la tabla en uso.
      *Implementado en V15-5 (extras, Task 12): un campo `TeamInput.quickKick` que solo escribe la pantalla con el flanco de la A
      humana (`padQuickKick`) y solo lee `stepSetPiece` en esos cinco tipos; no se lee `a === 'pressed'` porque las grabaciones de
      `match.test.ts` pulsan A en balones parados (24 veces, carrera C) y habrían cambiado sin que fallara nada. La CPU nunca saca
      rápido. Aviso «CRUCETA: APUNTAR · A (J) SACA · SI NO, SALE SOLO» cuando saca un humano; el resto de paradas, como antes. Sin
      regrabado: md5 de `engine-invariants.test.ts` y grabaciones intactos.*
```

- [ ] **Step 9: Cierre — verificación completa y diff con ojos de revisor**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-logic/ components/games/football-screen/ components/games/VaultWorldCupGame.tsx
./.superpowers/sdd/2026-10-07-vault-world-cup-v15-5-extras/sdd.sh gate
git status --short
```
```bash
B=$(grep 'Base tree:' .superpowers/sdd/2026-10-07-vault-world-cup-v15-5-extras/progress.md | awk '{print $3}')
git diff --name-only $B -- components | sort
```
Expected: **1574 / 94**; `tsc`, `eslint` sin salida; `gate` como arriba. El `--name-only` da **exactamente 15** ficheros: los del «Mapa de ficheros» menos el spec (el `snap` deja `specs/` fuera del árbol base). Ningún fichero de código nuevo.

- [ ] **Step 10: Cierre — `qa-paco.md`**

Crea `.superpowers/sdd/2026-10-07-vault-world-cup-v15-5-extras/qa-paco.md` con exactamente la sección «QA jugado — V15-5 extras» de abajo.

- [ ] **Step 11: Cierre — ledger y mensaje de commit**

`./sdd.sh step 12` y, en `progress.md`: `Task V15-5-12: G15-31 — TeamInput.quickKick (solo lo escribe padQuickKick, flanco de A humana; solo lo lee stepSetPiece en kickoff/throw-in/goal-kick/corner/free-kick, nunca el penalti), aviso por tabla cuando saca un humano; spec anotado (G15-30/31), qa-paco.md; 1574 / 94; motor: input.ts, set-pieces.ts (+tests); grabaciones, sondas y md5 intactos; 10 controles revertidos.` Y deja a Paco el mensaje de commit de abajo. **No se commitea.**

---

# QA jugado — V15-5 extras (G15-30 dificultad del Amistoso, G15-31 saque rápido)

Partir de un `next dev` propio de Paco (`:3000`), con el V15-5 ya probado. Cada punto: qué hacer → qué tiene que pasar.

## 1 · DIFICULTAD (G15-30)

1.1 ELIGE MODO → AMISTOSO → A → sale **DIFICULTAD** con tres tarjetas, BEGINNER / MEDIUM / PRO, el cursor en **MEDIUM**; abajo `CRUCETA: NIVEL · A (J) CONFIRMA · B (K) VOLVER` (en Clásico, `(Z)`/`(X)`).
1.2 Arriba/izquierda y abajo/derecha mueven el cursor; pulsar otra vez hacia PRO se queda en PRO (no da la vuelta a BEGINNER), igual hacia BEGINNER.
1.3 B → vuelve a ELIGE MODO con AMISTOSO marcado. A de nuevo → DIFICULTAD con el cursor donde lo dejaste.
1.4 A en DIFICULTAD → ELIGE TU SELECCIÓN de siempre; ALINEACIÓN, pantalla previa y partido como antes. **La A que confirma no saca el saque inicial** (también con el mando).
1.5 Durante el partido, el cuadro **Estado** de la barra de arriba de la página dice `AMISTOSO · BEGINNER` / `· MEDIUM` / `· PRO`. (Interpretación de «en el marcador, como la ronda»: ver Duda 2.)
1.6 Jugar un rato en BEGINNER y en PRO: la CPU debe notarse distinta (reacción, pases, disparos, entradas, portero). **Ojo:** tu propio portero y tu lectura de penaltis usan la misma dificultad (regla D3): en PRO tu portero también para más, en BEGINNER menos (Duda 1). Si la diferencia se nota poco, es el dato del spec (la dificultad pesa poco frente a los atributos), no un fallo.
1.7 AMISTOSO A DOS, ENTRENAMIENTO y MUNDIAL **no** pasan por DIFICULTAD; el Mundial sigue con su escalera (Estado: OCTAVOS DE FINAL…).
1.8 Al terminar (GANADOR/ELIMINADO/EMPATE → ELIGE MODO) y volver a AMISTOSO, el cursor de DIFICULTAD está en el último nivel jugado (decisión 3; Duda 3).
1.9 Con el mando: la cruceta y A/B del mando 1 hacen lo mismo en DIFICULTAD; Start pausa.

## 2 · Saque rápido (G15-31)

2.1 Saque inicial a favor (el tuyo): abajo `CRUCETA: APUNTAR · A (J) SACA · SI NO, SALE SOLO`. Apunta con la cruceta y pulsa A → sale **en ese momento**, hacia donde apuntas. Si no pulsas, sale solo a los 5 s, como antes.
2.2 Lo mismo en banda, saque de puerta, córner y falta a favor (la falta es un disparo, el córner y la puerta un pase largo, banda y saque inicial pases cortos — los mismos golpes que el automático, solo antes).
2.3 **Penalti a favor:** A no hace nada; la cruceta elige lado y sale con la cuenta atrás, como siempre; el aviso es el de siempre (`CRUCETA: APUNTAR · SALE SOLO`). Tanda de penaltis igual.
2.4 Balón parado de la CPU: la CPU **no** saca rápido nunca (espera su cuenta atrás); abajo, el aviso de siempre.
2.5 **A mantenida desde antes del pitido** (p. ej. cargando un disparo cuando te hacen falta): no saca; hay que soltar y volver a pulsar.
2.6 Ventana LESIONADO: la A que confirma el suplente **no** saca la falta que viene después; una segunda pulsación ya en el balón parado sí (es una pulsación nueva).
2.7 Amistoso a dos: cada jugador saca rápido con **su** A (J1 `C`, J2 `J`) y el aviso nombra la del que saca. Clásico: `(Z)`.
2.8 Entrenamiento: tus saques (centro tras gol, banda, puerta…) salen con A; el rival congelado nunca saca.
2.9 Raro pero posible: si mantienes A después de un saque rápido y el balón llega a un compañero, al soltar dispara (es la carga de tiro de siempre). Juzgar si molesta.
2.10 Espectar una pareja de la CPU (VER): nada cambia (ni aviso ni saques rápidos).

## 3 · General

3.1 Ningún parpadeo ni tirón nuevo en DIFICULTAD ni en el HUD durante los balones parados.
3.2 Un Mundial completo y un amistoso completo sin errores en consola.

---

## Mensaje de commit propuesto (uno para las dos tareas; lo hace Paco)

```
feat(world-cup): v15-5 extras — CPU friendly levels and quick set pieces with A (G15-30, G15-31)

- G15-30: the CPU friendly is played at BEGINNER (2), MEDIUM (4, default) or PRO (6),
  picked on a new DIFICULTAD screen right after AMISTOSO (d-pad with stops at the ends,
  A confirms, B goes back, the level is remembered like the mode). GameMode
  'friendly-cpu' carries the level and modeDifficulty reads it; FRIENDLY_DIFFICULTY (5)
  stays for the two-player friendly, the training and the probes. The match label
  shows "AMISTOSO · <LEVEL>" in the page's Estado box, where the World Cup round goes.
- G15-31: in kickoff, throw-in, goal kick, corner and free kick a human A takes the set
  piece at once, at the aimed direction; otherwise the countdown runs as before. The
  penalty is unchanged. New TeamInput.quickKick, written only by the screen from the
  edge of a human A (padQuickKick) and read only by stepSetPiece, so the CPU never uses
  it and no recording changes (match.test.ts's recordings press A in set pieces; reading
  a === 'pressed' would have silently changed its run C). Per-table hint "CRUCETA:
  APUNTAR · A (J) SACA · SI NO, SALE SOLO" when a human takes it.
- No re-recording: engine-invariants.test.ts byte-identical, probes and ai.test untouched.
  Spec annotated (G15-30, G15-31). 1574 tests in 94 files.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

## Self-review (al escribir el plan, 07-oct)

- **Cada decisión de Paco tiene tarea y test:** tres niveles con sus números (mode `it`, flow `it` 4), MEDIUM por defecto (mode y flow), nombres en inglés (mode `it`), pantalla propia tras AMISTOSO (flow `it` 1), cruceta + A (flow `it` 2 y `menuAction`), etiqueta (mode `it`, bucle), no afecta a los otros tres modos (mode y flow); los cinco tipos rápidos (set-pieces `it` 1), en la dirección apuntada en el paso del press (aserción de `vx`/`vy`), cuenta atrás igual sin pulsar (tests existentes de `direction and countdown` y `automatic execution by kind` intactos), penalti igual (`it` 2), aviso con la tecla real por tabla (hints `it`, hud `it`).
- **Todo el código del plan se aplicó literalmente** — con un script que extrae los bloques de este fichero y sigue sus anclas de texto — sobre una copia del **working tree real de tras la T10** (1561 / 94 de partida, `tsc` limpio): rojos 16 y 7, `tsc` con el TS2366 declarado y luego limpio, `eslint` limpio, **1567 / 94** y **1574 / 94**, los 21 controles con los mensajes copiados arriba, el `gate` tal cual, md5 intacto y la carrera C de la grabación idéntica (`2-0, over, 11 462`). Detalle en el pre-vuelo.
- **Sin `as`, `!` ni `any` nuevos** (el `as const` que se escribiría por costumbre en los bucles de tipos está sustituido por arrays tipados).
- **Sin asignaciones por frame:** `drawLevelSelect` y el aviso del HUD solo leen constantes.

## Dudas para Paco (no bloquean; el plan ejecuta la opción indicada)

1. **Tu portero también cambia de nivel.** `humanProfile` usa la misma dificultad que la CPU para el portero y la lectura del penalti (regla D3/S9 de la etapa B; el Mundial ya funciona así). En PRO tu portero para más y en BEGINNER menos, lo que suaviza la diferencia. El plan **no lo toca**. Alternativa: el perfil humano del amistoso CPU fijo a 5 (una línea en el `.tsx` o en `match-run.ts`).
2. **«Etiqueta en el marcador, como la ronda en el Mundial».** La ronda no está en el canvas, está en el cuadro **Estado** de la barra de la página; el plan pone el nivel ahí mismo (`AMISTOSO · PRO`). Si lo querías dentro del canvas (bajo el reloj, por ejemplo), es un `fillText` de una constante en `drawHud`.
3. **El nivel se recuerda entre partidos** (como el modo). Si prefieres que vuelva siempre a MEDIUM, es una línea en `flowReset` (y la aserción del `it` 3 de flow).
