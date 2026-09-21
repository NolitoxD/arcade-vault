# Vault World Cup — v1.5, paso V15-1 «Aspecto» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cambiar el aspecto del partido al de la referencia Tehkan — jugadores como sprites pixel-art cenitales horneados por partido (8 direcciones, carrera animada, quieto, tumbado, estirada del portero en 2 fotogramas, deslizamiento inclinado), césped de dos verdes lima en bandas estrechas con moteado suave, sin palito de dirección, sin `player-pose.ts` y con `lineWidth` explícito en `drawPitch` — **sin tocar una sola línea del motor** y sin asignar memoria por frame.

**Architecture:** Igual que el paso 11: todo lo que se puede probar vive en módulos puros nuevos de `components/games/football-screen/` y el `.tsx` solo traza. `sprite-maps.ts` guarda los 21 mapas de caracteres dibujados a mano (N, NE y E × 7 poses), deriva las otras 5 orientaciones con dos helpers exactos (`rotateMapCW`, `mirrorMapX`) y hornea un atlas a través de un callback `fill(x, y, size, color)` — así el horneado se prueba en Node sin DOM y el componente solo le pasa un `fillRect`. `sprite-frame.ts` elige, **sin trigonometría y sin asignar**, qué celda del atlas pinta cada jugador (octante desde `facingX/facingY`, fotograma desde `stepCount`/`id`/velocidad, estirada desde la fracción del gesto de `gestures.ts`). `grass.ts` define una baldosa de 96 × 96 (dos bandas de 48 u) con moteado por hash entero; el componente la hornea **una vez** al montar, la convierte en `CanvasPattern` y en cada frame hace **un** `fillRect` desplazado por la cámara. Los atlas (local, visitante, portero) son tres `<canvas>` de 240 × 210 creados una vez al montar; `startMatch` re-hornea local y visitante con `resolveMatchKits` (un evento, no un frame) y `drawPlayer` hace un `drawImage` de 9 argumentos por jugador.

**Tech Stack:** TypeScript estricto, React 19.2.4, Next 16.2.6 (App Router), canvas 2D 800 × 500, vitest 4.1.11 (tests `*.test.ts` junto al código, **sin `vitest.config`**, entorno Node sin DOM, **imports relativos** — el alias `@/` no existe en vitest).

**Spec:** `specs/31-vault-world-cup.md` (Approved) — bullet «Grill de la v1.5 (Paco, 2026-09-17), decisiones G15», sobre todo **G15-2** (sprites y césped), **G15-3** (capas) y **G15-15** (alcance de V15-1); bullet «QA jugado del paso 11 (Paco, 2026-09-16)» (**G12-1**, portero verde flúor); criterios de aceptación **1, 2, 20 y 21**. Las decisiones G15 son ley y no se reabren en este plan.
**Informe obligatorio:** `.superpowers/sdd/2026-09-17-vault-world-cup-v1-5/design-brief.md` §1 (opción 1-A recomendada, césped 1-C1 + 1-C2, riesgos) y §8 (diferido `lineWidth` en `drawPitch`).
**Referencia visual (ábrela con Read antes de tocar un mapa o un color):** `references/vault-world-cup-tehkan.png` — césped de dos verdes lima en bandas tipo corte con moteado suave; jugadores pequeños con pelo, camiseta y piernas abiertas; sombra mínima. Su campo es vertical, el nuestro horizontal: sus bandas horizontales son nuestras bandas **verticales**.
**Código a imitar:** `components/games/KongGame.tsx:94-130` (mapas de caracteres, `'.'` transparente) y `:383-420` (`bakeSprite`: hornear en `<canvas>` una vez, el bucle solo hace `drawImage`) · `components/games/football-screen/particles.ts` (preasignación una vez, escritura in-place) · `components/games/football-screen/gestures.ts` (`GESTURE_IDLE`, `diveReach`, `DIVE_REACH_MAX`, `gestures.dirX/dirY`: lo que la estirada consume).
**Código a modificar:** `components/games/VaultWorldCupGame.tsx` — imports (`:21-66`), paleta (`:99-136`), tamaños (`:139-173`), `getContext` (`:293`), preasignación del efecto (`:325-333`), `startMatch` (`:437-450`), `drawPitch` (`:815-897`), comentario + `drawPlayer` (`:900-1071`). `components/games/football-screen/view-pipeline.test.ts` (sonda del paso 11).
**Código a borrar:** `components/games/football-screen/player-pose.ts` y `components/games/football-screen/player-pose.test.ts` (G15-3; decisión razonada en Global Constraints).
**Ledger de este paso:** `.superpowers/sdd/2026-09-21-vault-world-cup-v15-1/progress.md` (lo crea el controlador al empezar la ejecución SDD; cada tarea le añade **una** línea al cerrar).

---

## Global Constraints

**Los requisitos de cada tarea incluyen implícitamente esta sección.**

### Las decisiones del grill que este paso ejecuta (copiadas literalmente del spec)

- **G15-2 Referencia (Paco):** confirmada = Tehkan World Cup, copiada a `references/vault-world-cup-tehkan.png`. Sprites horneados por dirección (3 a mano N/NE/E + rotación/espejo = 8), estilo `KongGame.tsx`, 3 fotogramas carrera + quieto + tumbado, paleta por partido; ~28-32 px en pantalla (radio físico intacto); obligatorio pelo, camiseta con kit, piernas animadas, sombra mínima. Césped: DOS verdes (uno más fuerte/serio) en bandas tipo «corte de césped», como la captura.
- **G15-3 Capas (Paco):** sprite = carrera/quieto, tumbado propio, deslizamiento = carrera inclinada, estirada GK 2 fotogramas. Se quedan vectoriales: cursor, muescas de carga, aro de sprint. SE QUITA el palito de dirección. SE BORRA `player-pose.ts` + tests (salvo lo que la estirada necesite).
- **G15-15 (tramo V15-1):** V15-1 Aspecto (sprites, césped, fuera palito, borrar player-pose, lineWidth; sin motor).
- **G12-1 · Color reservado de portero**: los 16 porteros visten verde flúor `#39ff14` con ribete negro, igual para todos, independiente de la equipación (solo pantalla; el minimapa mantiene el color del equipo).
- **G11-2 · Portero que se estira** (sigue vigente): gesto visual disparado por el evento de atajada, ~35 pasos (~0,6 s), vuelve a la pose normal antes de sacar. Motor intacto.

**Fuera de V15-1 (no se toca aunque «quede cerca»):** motor (`football-logic/**`), mandos (V15-2), selecciones y selector (V15-3), celebración del abrazo (V15-5 — **la celebración de arcos de v1 SE QUEDA** tal cual en `drawPlayer`), red que ondula (V15-5), nombres y dorsales (V15-5), minimapa, pantalla de victoria (su figura vectorial no es un jugador del partido).

### Criterios del spec (copiados literalmente)

> 1. **Misma semilla y misma secuencia de entradas producen el mismo estado**, paso a paso, en un partido completo. Hay test que lo fija. **La simulación es de paso fijo** (`STEP_MS`): ningún `dtMs` entra en el motor.
> 2. **El motor no distingue quién mueve cada equipo**: `stepMatch` recibe dos `TeamInput` y ningún módulo de `football-logic/` lee teclado, `Math.random` ni estado de módulo.
> 20. **Ninguna asignación de memoria por frame** en el bucle ni en el dibujo, incluido el confeti (depósito de partículas creado una vez).
> 21. **La suite sigue verde y no baja de los 861 tests (cierre de la etapa B, 2026-09-06)** de partida.

Traducción operativa del criterio 20 para este paso, sin excepciones: dentro de `draw()`, `drawPitch`, `drawPlayer` y `runStep` no hay `new`, `document.createElement`, `createPattern`, `getContext`, literales de objeto o array, plantillas ni concatenaciones de string, `.map/.filter/.slice/.split`, ni cierres (`=>`) nuevos. Los tres atlas, la baldosa del césped, el `CanvasPattern`, la paleta y el objeto `SpriteChoice` se crean **una vez al montar** el efecto. Re-hornear los atlas de local y visitante ocurre en `startMatch` (**un evento**, como el `createMatchRun` que ya hay allí). `Math.round` y `ctx.setTransform` con números no asignan. Las únicas llamadas trigonométricas nuevas del paso son `Math.cos/Math.sin` de `SLIDE_TILT_RAD`, **una vez al cargar el módulo** `sprite-frame.ts`.

### Decisión cerrada por este plan: `player-pose.ts` se BORRA ENTERO (con sus 13 tests)

G15-3 dice «SE BORRA `player-pose.ts` + tests (salvo lo que la estirada necesite)». Medido contra el código: `player-pose.ts` exporta dos cosas, `playerPose` (cabeza + hombros de G11-1) y `divePose` (la cápsula del portero estirado de G11-2). Con sprites, `playerPose` no tiene consumidor. La estirada de G15-3 son **2 fotogramas de sprite elegidos por la fracción del gesto**: lo que necesita es (a) la fracción → ya la da `gestureProgress` de `gestures.ts`, (b) cuánto se ha estirado → ya la da `diveReach` de `gestures.ts`, y (c) hacia dónde → ya la guardan `gestures.dirX/dirY`. `divePose` solo convertía esos tres números en los seis puntos de una cápsula vectorial, que desaparece. **Ninguna de las dos funciones tiene consumidor tras V15-1**, así que no hay nada que rescatar: `gestures.ts` y su test se quedan intactos y `player-pose.ts` + `player-pose.test.ts` se borran enteros (Task V15-1-4). Consumidores actuales que hay que actualizar (medido con grep): `VaultWorldCupGame.tsx:59` (import), `:332-333` (`pose`, `dive`), `:946-958` y `:984-1000` (usos) y `view-pipeline.test.ts:10` (import) + su cuerpo.

### Reglas del repo

- **Commits: SOLO Paco.** Ninguna tarea ejecuta `git add`, `git rm`, `git commit` ni `git stash`. Donde el paso 11 decía «Commit», aquí dice: **dejar el working tree verificado; commit lo hace Paco**. Al final (Task V15-1-5) se propone **UN** mensaje de commit convencional para todo el paso. Borrar ficheros = `rm` en el working tree, nunca `git rm`.
- **Rama `main`. HEAD de hoy: `478fc93`** (commit de docs del brief/grill de la v1.5 sobre `c71be98`, el cierre de la v1). Working tree limpio al escribir el plan, salvo este fichero de plan, que **ya está trackeado** (entró en `478fc93`) y aparece como modificado (`M`), no como sin trackear. Todas las compuertas del motor comparan contra `478fc93`.
- **NUNCA arrancar `next dev` ni `next build`.** Paco tiene el suyo en `:3000`. La verificación de cada tarea es `npx vitest run <fichero>` → `npx vitest run` → `npx tsc --noEmit` → `npx eslint <ficheros tocados>`. **El QA visual lo hace Paco** con la lista que deja escrita la tarea de cierre.
- **EL MOTOR NO SE TOCA. Cero excepciones.** Al cerrar **cada** tarea, `git diff --stat 478fc93 -- components/games/football-logic/` debe salir **VACÍO**. Los módulos nuevos **leen** `PlayerState` (y `isPlayerDown`, `PLAYER_SPEED`, `PLAYER_RADIUS`) y no escriben en nada del motor.
- **Determinismo (criterios 1 y 2):** `grep -rn "Math.random" components/games/football-screen/` debe devolver **VACÍO** al cerrar cada tarea (tests incluidos). El moteado del césped sale de un hash entero (`Math.imul`), nunca de `Math.random`. Ningún fichero nuevo de `football-screen/` importa React ni toca `document`, `window`, `canvas` ni `Audio` (el horneado real vive en el `.tsx`; los módulos solo llaman a un callback).
- **Instantáneas bajo `.superpowers/`: solo `.txt`.** Si el controlador guarda una copia de un fichero de código antes de una tarea (como `snapshot-after-11-3/` del paso 11), va con extensión `.txt` (p. ej. `snapshot-before-v15-1-4/components_games_VaultWorldCupGame.tsx.txt`). **Ninguna copia `*.ts`/`*.tsx` bajo `.superpowers/`**: `tsc` y vitest las recogerían.
- **Baseline verificada hoy (2026-09-17, HEAD `478fc93`, `npx vitest run` ejecutado al escribir este plan): 1268 tests en 75 ficheros verdes.** Objetivo al cerrar el paso: **1291 tests en 77 ficheros** (1268 + 13 + 8 + 15 − 13; 75 + 3 − 1). Ningún test existente cambia de valor esperado; `view-pipeline.test.ts` cambia de cuerpo pero conserva sus 2 tests.
- **Tests con imports RELATIVOS** (`from './sprite-maps'`, `from '../football-logic/players'`).
- **Comentarios y nombres de tests en inglés** (convención del repo). El plan, el spec y el chat, en castellano. Este paso no añade texto de UI.
- **Ficheros en kebab-case**, salvo `VaultWorldCupGame.tsx`. Tipos en PascalCase, `SCREAMING_CASE` para constantes de módulo. TypeScript estricto: nada de `any`, **nada de `as`** para tapar un tipo (se estrecha con predicados, p. ej. `isSpriteChar`), **ningún `!` nuevo**.
- **Un test que pasa no prueba nada hasta verlo fallar** (regla de Paco). Cada tarea tiene su paso «ver en rojo» y su **control negativo** con el resultado esperado escrito literalmente; si un control negativo no hace fallar lo que dice, el test es vacuo y se arregla antes de seguir.
- **Números de línea = orientativos.** Cada cita de línea va con el texto literal a buscar; si las líneas se han desplazado, manda el texto.

### Orden y paralelismo (para SDD)

**Decisión del controlador (21-sep, H3 del pre-vuelo): las cinco tareas se ejecutan EN SERIE, una detrás de otra — V15-1-1 → V15-1-2 → V15-1-3 → V15-1-4 → V15-1-5 — nunca en paralelo,** aunque los ficheros de las tareas 1, 2 y 3 sean disjuntos. Motivo: cada tarea pasa por un estado rojo **intencionado** (Step 2: `Failed to resolve import`/`TS2307`; controles negativos) y cierra con `npx vitest run` y `npx tsc --noEmit` **globales**; en un mismo working tree, dos subagentes en paralelo verían el rojo intencionado del otro como si fuera su propio gate global — o, peor, uno podría intentar «arreglar» el fichero de la otra tarea. Ejecutar en serie evita esa contaminación sin necesidad de worktrees separados (coste: bajo, son tareas cortas).

| Orden | Tarea | Ficheros que toca | ¿Paralela? |
|---|---|---|---|
| 1 | **V15-1-1** `sprite-maps.ts` | solo `sprite-maps.ts/.test.ts` (nuevos) | No — serie |
| 2 | **V15-1-2** `grass.ts` + `drawPitch` | `grass.ts/.test.ts` (nuevos) + `VaultWorldCupGame.tsx` (paleta, `drawPitch`, preasignación del césped) | No — serie, tras V15-1-1 |
| 3 | **V15-1-3** `sprite-frame.ts` | solo `sprite-frame.ts/.test.ts` (nuevos) | No — serie, tras V15-1-2 (y ya depende de V15-1-1, importa sus constantes) |
| 4 | **V15-1-4** cableado de sprites + borrado de `player-pose` + sonda | `VaultWorldCupGame.tsx`, `view-pipeline.test.ts`, borra `player-pose.ts/.test.ts` | No — serie, tras V15-1-1, V15-1-2 (mismo `.tsx`) y V15-1-3 |
| 5 | **V15-1-5** cierre + `qa-paco.md` | solo ledger | No — serie, tras todo |

Cada tarea da su **delta** (tests/ficheros que suma) sobre lo que ya ha aterrizado; al ir en serie el total intermedio de cada tarea es acumulado y determinista — el controlador comprueba la suma de deltas, sin la ambigüedad de qué otras tareas han aterrizado que sí existiría con olas paralelas.

---

## Mapa de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `components/games/football-screen/sprite-maps.ts` **(nuevo)** | Los 21 mapas a mano (N/NE/E × IDLE, RUN_0..2, DOWN, DIVE_0..1), constantes de pose/octante/tamaño/atlas, `rotateMapCW`, `mirrorMapX`, las 56 derivadas (`PLAYER_SPRITE_MAPS`), paleta (`createSpritePalette`/`writeSpritePalette`) y `bakeSpriteAtlas(maps, palette, fill)`. Sin DOM. | 1 |
| `components/games/football-screen/sprite-maps.test.ts` **(nuevo)** | 13 tests. | 1 |
| `components/games/football-screen/grass.ts` **(nuevo)** | Bandas de 48 u, baldosa 96 × 96, `grassHash` entero, tonos, `forEachGrassCell(fill)`, `grassTileOffset`. Sin DOM. | 2 |
| `components/games/football-screen/grass.test.ts` **(nuevo)** | 8 tests. | 2 |
| `components/games/football-screen/sprite-frame.ts` **(nuevo)** | `facingOctant` (sin trigonometría), `runPose`, `diveSpritePose`, `SpriteChoice` + `choosePlayerSprite` (in place), constantes del deslizamiento inclinado. | 3 |
| `components/games/football-screen/sprite-frame.test.ts` **(nuevo)** | 15 tests. | 3 |
| `components/games/VaultWorldCupGame.tsx` **(modificado)** | V15-1-2: césped por patrón + `lineWidth` explícito. V15-1-4: `imageSmoothingEnabled`, atlas, `drawPlayer` por sprite, fuera palito/cabeza/hombros/cápsula. | 2, 4 |
| `components/games/football-screen/view-pipeline.test.ts` **(modificado)** | La sonda de 3 partidos pasa por `choosePlayerSprite` en vez de `playerPose`/`divePose`. Sigue con 2 tests. | 4 |
| `components/games/football-screen/player-pose.ts` + `player-pose.test.ts` **(borrados)** | — (13 tests menos). | 4 |
| `.superpowers/sdd/2026-09-21-vault-world-cup-v15-1/progress.md` · `qa-paco.md` | Ledger (una línea por tarea) y lista de QA de Paco. | todas · 5 |

**Lo que este paso NO toca, a propósito:** `components/games/football-logic/**`, `gestures.ts` y su test, `ball-view.ts`, `goal-net.ts`, `minimap.ts` y `drawMinimap`, `drawBall`, `drawVictory`, `app/**` (incluido el CSS del canvas: resuelto por Paco 21-sep — no se añade `image-rendering: pixelated`; se mira en el QA, punto 11), `lib/**`.

---

### Task V15-1-1: `sprite-maps.ts` — los mapas, las 8 orientaciones y el horneado sin DOM (G15-2)

**Files:**
- Create: `components/games/football-screen/sprite-maps.ts`
- Test: `components/games/football-screen/sprite-maps.test.ts`

**Interfaces:**
- Consumes: nada de otras tareas (es la primera de la serie).
- Produces, y las Tasks V15-1-3 y V15-1-4 consumen literalmente:
  - `type SpriteMap = readonly string[]` · `type SpriteChar = 'O' | 'H' | 'K' | 'S' | 'T' | 'F'` · `type SpritePalette = Record<SpriteChar, string>`
  - `SPRITE_CHARS: readonly SpriteChar[]`, `isSpriteChar(ch: string): ch is SpriteChar`
  - `SPRITE_GRID = 15`, `SPRITE_PX = 2`, `SPRITE_SIZE = 30`, `SPRITE_HALF = 15`
  - `POSE_IDLE = 0`, `POSE_RUN_0 = 1`, `POSE_RUN_1 = 2`, `POSE_RUN_2 = 3`, `POSE_DOWN = 4`, `POSE_DIVE_0 = 5`, `POSE_DIVE_1 = 6`, `POSE_COUNT = 7`
  - `OCTANT_E = 0`, `OCTANT_SE = 1`, `OCTANT_S = 2`, `OCTANT_SW = 3`, `OCTANT_W = 4`, `OCTANT_NW = 5`, `OCTANT_N = 6`, `OCTANT_NE = 7`, `OCTANT_COUNT = 8` (ejes de pantalla: +y hacia ABAJO)
  - `ATLAS_W = 240`, `ATLAS_H = 210`, `atlasCellX(octant: number): number`, `atlasCellY(pose: number): number`
  - `SPRITE_OUTLINE`, `SPRITE_HAIR`, `SPRITE_SKIN`, `SPRITE_BOOTS` (`string`)
  - `rotateMapCW(map: SpriteMap): string[]`, `mirrorMapX(map: SpriteMap): string[]`
  - `HAND_N`, `HAND_NE`, `HAND_E`: `readonly SpriteMap[]` (índice = pose)
  - `buildPlayerSpriteMaps(): SpriteMap[][]` y `PLAYER_SPRITE_MAPS: readonly (readonly SpriteMap[])[]` (`[octante][pose]`, calculado una vez al cargar el módulo)
  - `createSpritePalette(): SpritePalette`, `writeSpritePalette(out: SpritePalette, shirt: string, trim: string): void`
  - `bakeSpriteAtlas(maps: readonly (readonly SpriteMap[])[], palette: Readonly<SpritePalette>, fill: (x: number, y: number, size: number, color: string) => void): number` → píxeles pintados

**Contexto que el ejecutor no tiene:**
- **Letras de la paleta:** `.` transparente · `O` contorno oscuro · `H` pelo · `K` piel (brazos, piernas) · `S` camiseta (= `kit.primary`, o `#39ff14` en el portero) · `T` ribete: cuello, pantalón (= `kit.secondary`, o `#000000` en el portero) · `F` botas.
- **Tamaño:** rejilla 15 × 15 (impar: tiene píxel central, así que girar 90° es exacto) × 2 px = **30 px en pantalla**, dentro del 28-32 de G15-2. `PLAYER_RADIUS` sigue en 12 (motor): el sprite es más grande que el radio físico solo a efectos de dibujo.
- **Cómo salen las 8 orientaciones de 3:** con giros de 90° y espejos, que en pixel-art son exactos (sin interpolar): `S = rotateMapCW²(N)`, `SE = rotateMapCW(NE)`, `SW = mirrorMapX(SE)`, `W = mirrorMapX(E)`, `NW = mirrorMapX(NE)`. La cabeza (el pelo `H`) siempre va delante, hacia donde mira el jugador; es lo que el test «points the head where the octant says» comprueba en las 56 celdas.
- **Sobre los mapas a mano:** los de N se han dibujado píxel a píxel; los de E parten del giro exacto de N y los de NE de un cizallado de N (cabeza hacia la derecha, piernas hacia la izquierda) — **son literales editables a mano**, que es lo que G15-2 pide: si en el QA Paco quiere que el perfil E tenga otra forma, se retoca el literal y los tests de forma lo vigilan. Validado al escribir el plan: los 21 mapas son 15 × 15, todas las poses tienen `H`, `S` y `T`, las de pie tienen `F`, y la dirección de la cabeza es correcta en los 8 octantes × 7 poses.
- **El horneado no toca el DOM:** `bakeSpriteAtlas` recorre octante × pose × fila × columna y llama `fill(x, y, SPRITE_PX, color)` por cada letra no transparente. El `.tsx` (Task V15-1-4) le pasa un callback que hace `fillStyle` + `fillRect` sobre el `<canvas>` del atlas. Así el test cuenta píxeles con un callback falso, sin canvas.

- [ ] **Step 1: Escribir el test en rojo**

Crea `components/games/football-screen/sprite-maps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS } from '../football-logic/players';
import {
  ATLAS_H, ATLAS_W, HAND_E, HAND_N, HAND_NE, OCTANT_COUNT, OCTANT_E, OCTANT_N, OCTANT_NE,
  PLAYER_SPRITE_MAPS, POSE_COUNT, POSE_DIVE_1, POSE_IDLE, POSE_RUN_0, POSE_RUN_1, POSE_RUN_2,
  SPRITE_BOOTS, SPRITE_CHARS, SPRITE_GRID, SPRITE_HAIR, SPRITE_OUTLINE, SPRITE_SIZE, SPRITE_SKIN,
  atlasCellX, atlasCellY, bakeSpriteAtlas, createSpritePalette, mirrorMapX, rotateMapCW, writeSpritePalette,
  type SpriteMap,
} from './sprite-maps';

const HAND_SETS: readonly (readonly SpriteMap[])[] = [HAND_N, HAND_NE, HAND_E];
const STANDING_POSES: readonly number[] = [POSE_IDLE, POSE_RUN_0, POSE_RUN_1, POSE_RUN_2];
const KEEPER_GREEN = '#39ff14';

// Screen axes: +x right, +y DOWN. Indexed by octant: E, SE, S, SW, W, NW, N, NE.
const EXPECTED_HEAD: readonly (readonly [number, number])[] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

function countChar(map: SpriteMap, ch: string): number {
  let n = 0;
  for (const row of map) for (const c of row) if (c === ch) n++;
  return n;
}

function opaqueCount(map: SpriteMap): number {
  let n = 0;
  for (const row of map) for (const c of row) if (c !== '.') n++;
  return n;
}

// The hair IS the head, and the head leads the body: the sign of the hair's centroid
// relative to the centre of the grid, with a one-pixel dead zone, is the direction
// the sprite faces.
function headDirection(map: SpriteMap): [number, number] {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] !== 'H') continue;
      sx += x;
      sy += y;
      n++;
    }
  }
  const centre = (SPRITE_GRID - 1) / 2;
  const dx = sx / n - centre;
  const dy = sy / n - centre;
  return [dx > 1 ? 1 : dx < -1 ? -1 : 0, dy > 1 ? 1 : dy < -1 ? -1 : 0];
}

describe('the hand-drawn maps', () => {
  it('are a 15 x 15 grid for every pose of N, NE and E', () => {
    for (const set of HAND_SETS) {
      expect(set.length).toBe(POSE_COUNT);
      for (const map of set) {
        expect(map.length).toBe(SPRITE_GRID);
        for (const row of map) expect(row.length).toBe(SPRITE_GRID);
      }
    }
  });

  it('use only the transparent dot and the six palette letters', () => {
    for (const set of HAND_SETS) {
      for (const map of set) {
        for (const row of map) {
          for (const c of row) expect(c === '.' || SPRITE_CHARS.some((s) => s === c)).toBe(true);
        }
      }
    }
  });
});

describe('rotateMapCW / mirrorMapX', () => {
  it('rotateMapCW sends the top edge to the right edge, and four turns give the map back', () => {
    const marker: string[] = [];
    for (let r = 0; r < SPRITE_GRID; r++) marker.push(r === 0 ? '.......H.......' : '...............');
    expect(rotateMapCW(marker)[7][14]).toBe('H');
    const sample = HAND_NE[POSE_RUN_0];
    expect(rotateMapCW(rotateMapCW(rotateMapCW(rotateMapCW(sample))))).toEqual([...sample]);
    expect(rotateMapCW(sample)).not.toEqual([...sample]);
  });

  it('mirrorMapX flips every row left to right and is its own inverse', () => {
    const sample = HAND_E[POSE_IDLE];
    const mirrored = mirrorMapX(sample);
    for (let r = 0; r < SPRITE_GRID; r++) {
      for (let c = 0; c < SPRITE_GRID; c++) expect(mirrored[r][c]).toBe(sample[r][SPRITE_GRID - 1 - c]);
    }
    expect(mirrorMapX(mirrored)).toEqual([...sample]);
  });
});

describe('PLAYER_SPRITE_MAPS', () => {
  it('holds the eight octants of every pose, 15 x 15 each, with N, NE and E exactly the hand-drawn ones', () => {
    expect(PLAYER_SPRITE_MAPS.length).toBe(OCTANT_COUNT);
    for (const poses of PLAYER_SPRITE_MAPS) {
      expect(poses.length).toBe(POSE_COUNT);
      for (const map of poses) {
        expect(map.length).toBe(SPRITE_GRID);
        for (const row of map) expect(row.length).toBe(SPRITE_GRID);
      }
    }
    for (let pose = 0; pose < POSE_COUNT; pose++) {
      expect(PLAYER_SPRITE_MAPS[OCTANT_N][pose]).toEqual(HAND_N[pose]);
      expect(PLAYER_SPRITE_MAPS[OCTANT_NE][pose]).toEqual(HAND_NE[pose]);
      expect(PLAYER_SPRITE_MAPS[OCTANT_E][pose]).toEqual(HAND_E[pose]);
    }
  });

  it('points the head where the octant says, for every octant and every pose', () => {
    for (let octant = 0; octant < OCTANT_COUNT; octant++) {
      for (let pose = 0; pose < POSE_COUNT; pose++) {
        expect([octant, pose, ...headDirection(PLAYER_SPRITE_MAPS[octant][pose])])
          .toEqual([octant, pose, ...EXPECTED_HEAD[octant]]);
      }
    }
  });

  it('animates the legs: in every octant the three run frames differ from each other and from standing still', () => {
    for (let octant = 0; octant < OCTANT_COUNT; octant++) {
      const maps = PLAYER_SPRITE_MAPS[octant];
      expect(maps[POSE_RUN_0]).not.toEqual(maps[POSE_RUN_1]);
      expect(maps[POSE_RUN_1]).not.toEqual(maps[POSE_RUN_2]);
      expect(maps[POSE_RUN_0]).not.toEqual(maps[POSE_RUN_2]);
      expect(maps[POSE_RUN_1]).not.toEqual(maps[POSE_IDLE]);
    }
  });

  it('always draws hair, a kit shirt and its trim, and the boots on every standing pose (G15-2)', () => {
    for (let octant = 0; octant < OCTANT_COUNT; octant++) {
      for (let pose = 0; pose < POSE_COUNT; pose++) {
        const map = PLAYER_SPRITE_MAPS[octant][pose];
        expect(countChar(map, 'H')).toBeGreaterThan(0);
        expect(countChar(map, 'S')).toBeGreaterThan(0);
        expect(countChar(map, 'T')).toBeGreaterThan(0);
      }
      for (const pose of STANDING_POSES) expect(countChar(PLAYER_SPRITE_MAPS[octant][pose], 'F')).toBeGreaterThan(0);
    }
  });

  it('is drawn at 28-32 px on screen while the physical radius stays the engine\'s 12', () => {
    expect(SPRITE_SIZE).toBeGreaterThanOrEqual(28);
    expect(SPRITE_SIZE).toBeLessThanOrEqual(32);
    expect(PLAYER_RADIUS).toBe(12);
  });
});

describe('palette and atlas', () => {
  it('writeSpritePalette puts the kit on the shirt and the trim and keeps hair, skin, outline and boots fixed', () => {
    const palette = createSpritePalette();
    writeSpritePalette(palette, '#d40000', '#ffcc00');
    expect(palette.S).toBe('#d40000');
    expect(palette.T).toBe('#ffcc00');
    writeSpritePalette(palette, KEEPER_GREEN, '#000000');
    expect(palette.S).toBe(KEEPER_GREEN);
    expect(palette.T).toBe('#000000');
    expect(palette.H).toBe(SPRITE_HAIR);
    expect(palette.K).toBe(SPRITE_SKIN);
    expect(palette.O).toBe(SPRITE_OUTLINE);
    expect(palette.F).toBe(SPRITE_BOOTS);
  });

  it('bakes the reserved keeper green into every pose of every octant (G12-1)', () => {
    const palette = createSpritePalette();
    writeSpritePalette(palette, KEEPER_GREEN, '#000000');
    const green = new Int32Array(OCTANT_COUNT * POSE_COUNT);
    bakeSpriteAtlas(PLAYER_SPRITE_MAPS, palette, (x, y, _size, color) => {
      if (color !== KEEPER_GREEN) return;
      green[Math.floor(x / SPRITE_SIZE) * POSE_COUNT + Math.floor(y / SPRITE_SIZE)]++;
    });
    for (let i = 0; i < green.length; i++) expect(green[i]).toBeGreaterThan(0);
  });

  it('bakes every opaque cell exactly once, inside its own 30 px square of the atlas', () => {
    const palette = createSpritePalette();
    const painted = new Int32Array(OCTANT_COUNT * POSE_COUNT);
    let outside = 0;
    const total = bakeSpriteAtlas(PLAYER_SPRITE_MAPS, palette, (x, y, size) => {
      if (x < 0 || y < 0 || x + size > ATLAS_W || y + size > ATLAS_H) outside++;
      painted[Math.floor(x / SPRITE_SIZE) * POSE_COUNT + Math.floor(y / SPRITE_SIZE)]++;
    });
    let expected = 0;
    for (let octant = 0; octant < OCTANT_COUNT; octant++) {
      for (let pose = 0; pose < POSE_COUNT; pose++) {
        const cell = opaqueCount(PLAYER_SPRITE_MAPS[octant][pose]);
        expect(painted[octant * POSE_COUNT + pose]).toBe(cell);
        expected += cell;
      }
    }
    expect(outside).toBe(0);
    expect(total).toBe(expected);
  });

  it('lays the atlas out with octants across and poses down, one 30 px cell each', () => {
    expect(ATLAS_W).toBe(OCTANT_COUNT * SPRITE_SIZE);
    expect(ATLAS_H).toBe(POSE_COUNT * SPRITE_SIZE);
    expect(atlasCellX(OCTANT_NE)).toBe(7 * SPRITE_SIZE);
    expect(atlasCellY(POSE_DIVE_1)).toBe(6 * SPRITE_SIZE);
    expect(atlasCellX(0)).toBe(0);
    expect(atlasCellY(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Verlo fallar**

Ejecuta: `npx vitest run components/games/football-screen/sprite-maps.test.ts`
Esperado: **FALLA** con `Failed to resolve import "./sprite-maps"`.

- [ ] **Step 3: Escribir `sprite-maps.ts`**

Crea `components/games/football-screen/sprite-maps.ts`:

```ts
// V15-1 (G15-2, grill de la v1.5 del 17-sep): the players stop being vector discs and
// become top-down pixel-art sprites in the style of the Tehkan World Cup reference
// (references/vault-world-cup-tehkan.png), baked the KongGame.tsx way: character maps,
// '.' transparent, every other letter looked up in a per-match palette.
//
// Only three orientations are drawn by hand -- N, NE and E -- and the other five come
// from quarter turns and left-right mirrors of the character grid, which are EXACT on
// pixel art (no interpolation): S = cw(cw(N)), SE = cw(NE), SW = mirror(SE),
// W = mirror(E), NW = mirror(NE). The grid is 15 x 15 (odd, so a quarter turn keeps the
// centre pixel in place) at 2 px per cell: 30 px on screen, inside G15-2's 28-32, while
// the engine's PLAYER_RADIUS stays 12 -- the sprite is bigger than the body only on
// screen.
//
// Letters: O outline, H hair, K skin, S shirt (kit.primary; the keeper's reserved
// #39ff14, G12-1), T trim -- collar and shorts (kit.secondary; the keeper's black),
// F boots. The hair is always the head and the head always leads: that is what the
// tests use to check every derived orientation.
//
// No DOM here on purpose: bakeSpriteAtlas walks the maps and hands every opaque cell
// to a fill callback. The component's callback does the fillRect on a canvas; the
// tests' callback counts. Everything in this module allocates at module load or on a
// bake (a match starting), never per frame (criterion 20).

export type SpriteMap = readonly string[];
export type SpriteChar = 'O' | 'H' | 'K' | 'S' | 'T' | 'F';
export type SpritePalette = Record<SpriteChar, string>;

export const SPRITE_CHARS: readonly SpriteChar[] = ['O', 'H', 'K', 'S', 'T', 'F'];

export function isSpriteChar(ch: string): ch is SpriteChar {
  return ch === 'O' || ch === 'H' || ch === 'K' || ch === 'S' || ch === 'T' || ch === 'F';
}

export const SPRITE_GRID = 15;
export const SPRITE_PX = 2;
export const SPRITE_SIZE = SPRITE_GRID * SPRITE_PX; // 30
export const SPRITE_HALF = SPRITE_SIZE / 2; // 15

export const POSE_IDLE = 0;
export const POSE_RUN_0 = 1;
export const POSE_RUN_1 = 2;
export const POSE_RUN_2 = 3;
export const POSE_DOWN = 4;
export const POSE_DIVE_0 = 5;
export const POSE_DIVE_1 = 6;
export const POSE_COUNT = 7;

// Screen axes: +x right, +y DOWN, clockwise from east.
export const OCTANT_E = 0;
export const OCTANT_SE = 1;
export const OCTANT_S = 2;
export const OCTANT_SW = 3;
export const OCTANT_W = 4;
export const OCTANT_NW = 5;
export const OCTANT_N = 6;
export const OCTANT_NE = 7;
export const OCTANT_COUNT = 8;

// The atlas: octants across, poses down.
export const ATLAS_W = OCTANT_COUNT * SPRITE_SIZE; // 240
export const ATLAS_H = POSE_COUNT * SPRITE_SIZE; // 210

export function atlasCellX(octant: number): number {
  return octant * SPRITE_SIZE;
}

export function atlasCellY(pose: number): number {
  return pose * SPRITE_SIZE;
}

// The letters that do not come from the kit: the same for all eighteen players.
export const SPRITE_OUTLINE = '#141414';
export const SPRITE_HAIR = '#3b2416';
export const SPRITE_SKIN = '#f1c27d';
export const SPRITE_BOOTS = '#202020';

const N_IDLE: SpriteMap = [
  '...............',
  '......OOO......',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '...OOOTTTOOO...',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '...OSSSSSSSO...',
  '....OTTOTTO....',
  '....OKKOKKO....',
  '....OKKOKKO....',
  '....OFFOFFO....',
  '.....OO.OO.....',
];
const N_RUN_0: SpriteMap = [
  '...............',
  '......OOO......',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '...OOOTTTOOO...',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '...OSSSSSSSO...',
  '....OTTOTTO....',
  '....OFFOKKO....',
  '.....OOOKKO....',
  '........OFFO...',
  '.........OO....',
];
const N_RUN_1: SpriteMap = [
  '...............',
  '......OOO......',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '...OOOTTTOOO...',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '...OSSSSSSSO...',
  '....OTTOTTO....',
  '.....OKKKO.....',
  '.....OKOKO.....',
  '.....OFOFO.....',
  '......O.O......',
];
const N_RUN_2: SpriteMap = [
  '...............',
  '......OOO......',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '...OOOTTTOOO...',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '...OSSSSSSSO...',
  '....OTTOTTO....',
  '....OKKOFFO....',
  '....OKKOOO.....',
  '...OFFO........',
  '....OO.........',
];
const N_DOWN: SpriteMap = [
  '......OOO......',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '..OOOOTTTOOOO..',
  '..OKSSSSSSSKO..',
  '..OOSSSSSSSOO..',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OTTTTTO....',
  '....OTTOTTO....',
  '....OKKOKKO....',
  '....OKKOKKO....',
  '....OKKOKKO....',
  '....OFFOFFO....',
  '.....OO.OO.....',
];
const N_DIVE_0: SpriteMap = [
  '....OKO.OKO....',
  '....OKO.OKO....',
  '....OOHHHOO....',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '....OOTTTOO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OTTTTTO....',
  '....OTTOTTO....',
  '....OKKOKKO....',
  '....OKKOKKO....',
  '....OFFOFFO....',
  '.....OO.OO.....',
];
const N_DIVE_1: SpriteMap = [
  '......OKO......',
  '.....OKKKO.....',
  '.....OHHHO.....',
  '.....OHHHO.....',
  '....OOTTTOO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '.....OTTTO.....',
  '.....OTTTO.....',
  '.....OKKKO.....',
  '.....OKKKO.....',
  '.....OFFFO.....',
  '......OOO......',
];
const NE_IDLE: SpriteMap = [
  '...............',
  '.........OOO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '....OOOTTTOOO..',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '..OSSSSSSSO....',
  '..OTTOTTO......',
  '..OKKOKKO......',
  '..OKKOKKO......',
  '.OFFOFFO.......',
  '.OO.OO.........',
];
const NE_RUN_0: SpriteMap = [
  '...............',
  '.........OOO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '....OOOTTTOOO..',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '..OSSSSSSSO....',
  '..OTTOTTO......',
  '..OFFOKKO......',
  '...OOOKKO......',
  '.....OFFO......',
  '.....OO........',
];
const NE_RUN_1: SpriteMap = [
  '...............',
  '.........OOO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '....OOOTTTOOO..',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '..OSSSSSSSO....',
  '..OTTOTTO......',
  '...OKKKO.......',
  '...OKOKO.......',
  '..OFOFO........',
  '..O.O..........',
];
const NE_RUN_2: SpriteMap = [
  '...............',
  '.........OOO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '.......OHHHO...',
  '....OOOTTTOOO..',
  '..OSSSSSSSSSO..',
  '..OKSSSSSSSKO..',
  '..OKSSSSSSSKO..',
  '..OSSSSSSSO....',
  '..OTTOTTO......',
  '..OKKOFFO......',
  '..OKKOOO.......',
  'OFFO...........',
  'OO.............',
];
const NE_DOWN: SpriteMap = [
  '..........OOO..',
  '........OHHHO..',
  '.......OHHHO...',
  '....OOOOTTTOOOO',
  '....OKSSSSSSSKO',
  '...OOSSSSSSSOO.',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OTTTTTO....',
  '...OTTOTTO.....',
  '..OKKOKKO......',
  '..OKKOKKO......',
  '..OKKOKKO......',
  '.OFFOFFO.......',
  '.OO.OO.........',
];
const NE_DIVE_0: SpriteMap = [
  '........OKO.OKO',
  '.......OKO.OKO.',
  '......OOHHHOO..',
  '.......OHHHO...',
  '.......OHHHO...',
  '.....OOTTTOO...',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '...OTTTTTO.....',
  '..OTTOTTO......',
  '..OKKOKKO......',
  '..OKKOKKO......',
  '.OFFOFFO.......',
  '.OO.OO.........',
];
const NE_DIVE_1: SpriteMap = [
  '..........OKO..',
  '........OKKKO..',
  '.......OHHHO...',
  '.......OHHHO...',
  '......OOTTTOO..',
  '.....OSSSSSO...',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OSSSSSO....',
  '....OTTTO......',
  '...OTTTO.......',
  '...OKKKO.......',
  '...OKKKO.......',
  '..OFFFO........',
  '..OOO..........',
];
const E_IDLE: SpriteMap = [
  '...............',
  '...............',
  '......OOO......',
  '.....OKKSO.....',
  '.OOOOSSSSO.....',
  'OFKKTSSSSOOOO..',
  'OFKKTSSSSTHHHO.',
  '.OOOOSSSSTHHHO.',
  'OFKKTSSSSTHHHO.',
  'OFKKTSSSSOOOO..',
  '.OOOOSSSSO.....',
  '.....OKKSO.....',
  '......OOO......',
  '...............',
  '...............',
];
const E_RUN_0: SpriteMap = [
  '...............',
  '...............',
  '......OOO......',
  '.....OKKSO.....',
  '...OOSSSSO.....',
  '..OFTSSSSOOOO..',
  '..OFTSSSSTHHHO.',
  '..OOOSSSSTHHHO.',
  '.OKKTSSSSTHHHO.',
  'OFKKTSSSSOOOO..',
  'OFOOOSSSSO.....',
  '.O...OKKSO.....',
  '......OOO......',
  '...............',
  '...............',
];
const E_RUN_1: SpriteMap = [
  '...............',
  '...............',
  '......OOO......',
  '.....OKKSO.....',
  '....OSSSSO.....',
  '.OOOTSSSSOOOO..',
  'OFKKTSSSSTHHHO.',
  '.OOKOSSSSTHHHO.',
  'OFKKTSSSSTHHHO.',
  '.OOOTSSSSOOOO..',
  '....OSSSSO.....',
  '.....OKKSO.....',
  '......OOO......',
  '...............',
  '...............',
];
const E_RUN_2: SpriteMap = [
  '...............',
  '...............',
  '......OOO......',
  '.O...OKKSO.....',
  'OFOOOSSSSO.....',
  'OFKKTSSSSOOOO..',
  '.OKKTSSSSTHHHO.',
  '..OOOSSSSTHHHO.',
  '..OFTSSSSTHHHO.',
  '..OFTSSSSOOOO..',
  '...OOSSSSO.....',
  '.....OKKSO.....',
  '......OOO......',
  '...............',
  '...............',
];
const E_DOWN: SpriteMap = [
  '...............',
  '...............',
  '.........OOO...',
  '.........OKO...',
  '.OOOOOOOOSSO...',
  'OFKKKTTSSSSOOO.',
  'OFKKKTTSSSSTHHO',
  '.OOOOOTSSSSTHHO',
  'OFKKKTTSSSSTHHO',
  'OFKKKTTSSSSOOO.',
  '.OOOOOOOOSSO...',
  '.........OKO...',
  '.........OOO...',
  '...............',
  '...............',
];
const E_DIVE_0: SpriteMap = [
  '...............',
  '...............',
  '...............',
  '...............',
  '.OOOOOOOOO..OOO',
  'OFKKTTSSSOOOOKK',
  'OFKKTTSSSTHHHOO',
  '.OOOOTSSSTHHH..',
  'OFKKTTSSSTHHHOO',
  'OFKKTTSSSOOOOKK',
  '.OOOOOOOOO..OOO',
  '...............',
  '...............',
  '...............',
  '...............',
];
const E_DIVE_1: SpriteMap = [
  '...............',
  '...............',
  '...............',
  '...............',
  '......OOOOO....',
  '.OOOOOSSSSOOOO.',
  'OFKKTTSSSSTHHKO',
  'OFKKTTSSSSTHHKK',
  'OFKKTTSSSSTHHKO',
  '.OOOOOSSSSOOOO.',
  '......OOOOO....',
  '...............',
  '...............',
  '...............',
  '...............',
];

export const HAND_N: readonly SpriteMap[] = [N_IDLE, N_RUN_0, N_RUN_1, N_RUN_2, N_DOWN, N_DIVE_0, N_DIVE_1];
export const HAND_NE: readonly SpriteMap[] = [NE_IDLE, NE_RUN_0, NE_RUN_1, NE_RUN_2, NE_DOWN, NE_DIVE_0, NE_DIVE_1];
export const HAND_E: readonly SpriteMap[] = [E_IDLE, E_RUN_0, E_RUN_1, E_RUN_2, E_DOWN, E_DIVE_0, E_DIVE_1];

// A quarter turn clockwise ON SCREEN: the top row becomes the right column.
export function rotateMapCW(map: SpriteMap): string[] {
  const n = map.length;
  const out: string[] = [];
  for (let r = 0; r < n; r++) {
    let row = '';
    for (let c = 0; c < n; c++) row += map[n - 1 - c][r];
    out.push(row);
  }
  return out;
}

export function mirrorMapX(map: SpriteMap): string[] {
  const out: string[] = [];
  for (const row of map) {
    let flipped = '';
    for (let c = row.length - 1; c >= 0; c--) flipped += row[c];
    out.push(flipped);
  }
  return out;
}

// [octant][pose]. Called once, at module load, into PLAYER_SPRITE_MAPS.
export function buildPlayerSpriteMaps(): SpriteMap[][] {
  const out: SpriteMap[][] = [];
  for (let octant = 0; octant < OCTANT_COUNT; octant++) out.push([]);
  for (let pose = 0; pose < POSE_COUNT; pose++) {
    const n = HAND_N[pose];
    const ne = HAND_NE[pose];
    const e = HAND_E[pose];
    const se = rotateMapCW(ne);
    out[OCTANT_E].push(e);
    out[OCTANT_SE].push(se);
    out[OCTANT_S].push(rotateMapCW(rotateMapCW(n)));
    out[OCTANT_SW].push(mirrorMapX(se));
    out[OCTANT_W].push(mirrorMapX(e));
    out[OCTANT_NW].push(mirrorMapX(ne));
    out[OCTANT_N].push(n);
    out[OCTANT_NE].push(ne);
  }
  return out;
}

export const PLAYER_SPRITE_MAPS: readonly (readonly SpriteMap[])[] = buildPlayerSpriteMaps();

// Created once by the component; the kit letters are rewritten in place on each bake.
export function createSpritePalette(): SpritePalette {
  return { O: SPRITE_OUTLINE, H: SPRITE_HAIR, K: SPRITE_SKIN, S: '#ffffff', T: '#000000', F: SPRITE_BOOTS };
}

export function writeSpritePalette(out: SpritePalette, shirt: string, trim: string): void {
  out.S = shirt;
  out.T = trim;
}

// Walks every map of the [octant][pose] table and hands each opaque cell to `fill`, at
// its atlas position. Returns how many cells it painted.
export function bakeSpriteAtlas(
  maps: readonly (readonly SpriteMap[])[],
  palette: Readonly<SpritePalette>,
  fill: (x: number, y: number, size: number, color: string) => void,
): number {
  let painted = 0;
  for (let octant = 0; octant < maps.length; octant++) {
    const poses = maps[octant];
    for (let pose = 0; pose < poses.length; pose++) {
      const map = poses[pose];
      const originX = atlasCellX(octant);
      const originY = atlasCellY(pose);
      for (let r = 0; r < map.length; r++) {
        const row = map[r];
        for (let c = 0; c < row.length; c++) {
          const ch = row[c];
          if (!isSpriteChar(ch)) continue;
          fill(originX + c * SPRITE_PX, originY + r * SPRITE_PX, SPRITE_PX, palette[ch]);
          painted++;
        }
      }
    }
  }
  return painted;
}
```

- [ ] **Step 4: Verlo pasar**

Ejecuta: `npx vitest run components/games/football-screen/sprite-maps.test.ts`
Esperado: **PASA**, 13 tests.

Si «points the head where the octant says» falla en alguna celda, **no toques la aserción ni la zona muerta**: el mensaje dice `[octant, pose, dx, dy]`; corrige el mapa a mano de esa pose (el pelo `H` tiene que quedar delante del cuerpo) o la fórmula de derivación de ese octante.

- [ ] **Step 5: Romperlo a propósito (control negativo, regla de Paco)**

1. En `buildPlayerSpriteMaps`, cambia temporalmente `out[OCTANT_W].push(mirrorMapX(e));` por `out[OCTANT_W].push(e);` y ejecuta el fichero. Esperado: **falla** «points the head where the octant says» (octante 4 con cabeza `[1, 0]` en vez de `[-1, 0]`). **Deshaz.**
2. En el literal `N_RUN_2`, sustituye temporalmente las cinco últimas filas por las de `N_RUN_0` y ejecuta. Esperado: **falla** «animates the legs» (`RUN_0` igual a `RUN_2` en el octante N y en todos los derivados). **Deshaz** y vuelve a verlo verde.

- [ ] **Step 6: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/sprite-maps.ts components/games/football-screen/sprite-maps.test.ts
git diff --stat 478fc93 -- components/games/football-logic/
grep -rn "Math.random\|document\.\|window\.\| as " components/games/football-screen/sprite-maps.ts components/games/football-screen/sprite-maps.test.ts
```
Esperado: delta **+13 tests / +1 fichero** (sola en este orden: **1281 / 76** verdes), `tsc` y `eslint` sin salida, el `git diff` del motor **vacío**, el `grep` **vacío**.

- [ ] **Step 7: Anotar en el ledger**

Añade una línea a `.superpowers/sdd/2026-09-21-vault-world-cup-v15-1/progress.md`:
`V15-1-1 hecha: sprite-maps.ts (21 mapas a mano, 56 derivados, horneado sin DOM) + 13 tests. Motor intacto. Controles negativos aplicados y deshechos. Working tree verificado; commit lo hace Paco.`

- [ ] **Step 8: Dejar el working tree verificado; commit lo hace Paco**

No ejecutes `git add` ni `git commit`. El mensaje único del paso se propone en la Task V15-1-5.

---

### Task V15-1-2: `grass.ts` + `drawPitch` — césped lima tipo corte con moteado y `lineWidth` explícito (G15-2, diferido §8)

**Files:**
- Create: `components/games/football-screen/grass.ts`
- Test: `components/games/football-screen/grass.test.ts`
- Modify: `components/games/VaultWorldCupGame.tsx` (imports `:21-66`, paleta `:99-102`, preasignación junto a `const viewRect = createMinimapRect();` `:329`, `drawPitch` `:815-897`)

**Interfaces:**
- Consumes: nada de las Tasks V15-1-1/V15-1-3 (ficheros disjuntos, pero va en serie tras V15-1-1 — H3 del pre-vuelo: sin paralelismo, ver «Orden y paralelismo»).
- Produces, y el componente consume:
  - `GRASS_STRIPE_WIDTH = 48`, `GRASS_TILE_W = 96`, `GRASS_TILE_H = 96`, `GRASS_CELL = 2`, `GRASS_SPECKLE_PERCENT = 12`
  - `GRASS_TONE_LIGHT = 0`, `GRASS_TONE_LIGHT_SPECK = 1`, `GRASS_TONE_DARK = 2`, `GRASS_TONE_DARK_SPECK = 3`
  - `grassHash(x: number, y: number): number` (entero sin signo de 32 bits)
  - `grassBaseTone(worldX: number): number` → `GRASS_TONE_LIGHT` | `GRASS_TONE_DARK`
  - `grassTileTone(cellX: number, cellY: number): number` → uno de los cuatro tonos
  - `forEachGrassCell(fill: (x: number, y: number, size: number, tone: number) => void): void`
  - `grassTileOffset(camera: number, tile: number): number` → entero en `[0, tile)`

**Contexto que el ejecutor no tiene:** hoy `drawPitch` (`VaultWorldCupGame.tsx:815-826`) pinta todo `GRASS_DARK #1f6b32` y encima bandas `GRASS_LIGHT #247a39` de `STRIPE_WIDTH = 160`, alineadas con el mundo (banda impar = clara). El brief (§0 hallazgo 2) ya lo dijo: lo que pide la captura **no son rayas** (ya las hay), sino **otro tono (lima), bandas más estrechas y textura**. Opción 1-C1 (constantes) + 1-C2 (baldosa moteada horneada una vez). Se mantiene la convención de v1 (banda de índice impar = tono claro) y la alineación con el mundo; en nuestro campo horizontal las bandas son **verticales**, el equivalente de las horizontales de la captura (su campo es vertical).

**Cómo se pinta sin asignar por frame:** la baldosa (96 × 96 = dos bandas de 48 de ancho) se hornea **una vez** al montar en un `<canvas>` y se convierte en `CanvasPattern` con `createPattern(tile, 'repeat')`, también una vez. Un patrón está anclado al origen del sistema de coordenadas, así que en cada frame basta con `ctx.setTransform(1, 0, 0, 1, -ox, -oy)`, `fillRect(ox, oy, VIEW_W, VIEW_H)` y `ctx.setTransform(1, 0, 0, 1, 0, 0)`, donde `ox = grassTileOffset(cam.x, 96)`: el píxel de pantalla `s` muestra el píxel de baldosa `(s + ox) mod 96`, que es `(s + cam.x) mod 96` — la banda del mundo. **Una** llamada de relleno por frame, sin objetos. El test «reproduces the world stripes» convierte ese razonamiento en aserción.

**El `lineWidth` diferido (brief §8):** dentro del bucle de las dos porterías, la segunda iteración traza las áreas con `ctx.strokeStyle = LINE` pero **hereda** `ctx.lineWidth = 3` del marco de la portería de la iteración anterior (`:895`). Hoy coincide por casualidad (3 = 3); esta tarea lo hace explícito con una constante `PITCH_LINE_WIDTH` en los dos sitios.

- [ ] **Step 1: Escribir el test en rojo**

Crea `components/games/football-screen/grass.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { VIEW_W } from './camera';
import {
  GRASS_CELL, GRASS_SPECKLE_PERCENT, GRASS_STRIPE_WIDTH, GRASS_TILE_H, GRASS_TILE_W,
  GRASS_TONE_DARK, GRASS_TONE_DARK_SPECK, GRASS_TONE_LIGHT, GRASS_TONE_LIGHT_SPECK,
  forEachGrassCell, grassBaseTone, grassHash, grassTileOffset, grassTileTone,
} from './grass';

describe('the grass tile geometry', () => {
  it('is exactly two stripes wide and a whole number of cells both ways, so it repeats with no seam', () => {
    expect(GRASS_TILE_W).toBe(2 * GRASS_STRIPE_WIDTH);
    expect(GRASS_TILE_W % GRASS_CELL).toBe(0);
    expect(GRASS_TILE_H % GRASS_CELL).toBe(0);
    expect(GRASS_STRIPE_WIDTH % GRASS_CELL).toBe(0);
  });

  it('uses narrower mowing stripes than v1 (160) and alternates them along the world x', () => {
    expect(GRASS_STRIPE_WIDTH).toBeLessThan(160);
    expect(GRASS_STRIPE_WIDTH).toBeGreaterThanOrEqual(32);
    expect(grassBaseTone(0)).toBe(GRASS_TONE_DARK);
    expect(grassBaseTone(GRASS_STRIPE_WIDTH)).toBe(GRASS_TONE_LIGHT);
    expect(grassBaseTone(2 * GRASS_STRIPE_WIDTH)).toBe(GRASS_TONE_DARK);
    // The camera can sit left of the pitch (cameraMinX is -60): negative x alternates too.
    expect(grassBaseTone(-1)).toBe(GRASS_TONE_LIGHT);
    expect(grassBaseTone(-GRASS_STRIPE_WIDTH - 1)).toBe(GRASS_TONE_DARK);
  });
});

// The whole drawing trick in one assertion: the screen pixel s shows the tile pixel
// (s + grassTileOffset(cam)) mod TILE_W, and that has to be the stripe of the WORLD
// pixel s + cam, for any camera the game can produce.
describe('the tile drawn through the camera offset', () => {
  it('reproduces the world stripes at every screen x, negative and fractional cameras included', () => {
    const cameras = [-60, -13.4, 0, 47.6, 500, 1234.2];
    for (const camX of cameras) {
      const ox = grassTileOffset(camX, GRASS_TILE_W);
      for (let s = 0; s < VIEW_W; s++) {
        const tileX = (s + ox) % GRASS_TILE_W;
        expect(grassBaseTone(tileX)).toBe(grassBaseTone(s + Math.round(camX)));
      }
    }
  });

  it('grassTileOffset is an integer in [0, tile) for any camera', () => {
    for (const cam of [-1000.7, -60, -0.4, 0, 0.6, 95, 96, 97, 12345.5]) {
      const ox = grassTileOffset(cam, GRASS_TILE_W);
      expect(Number.isInteger(ox)).toBe(true);
      expect(ox).toBeGreaterThanOrEqual(0);
      expect(ox).toBeLessThan(GRASS_TILE_W);
    }
  });
});

describe('the speckle', () => {
  it('grassHash is deterministic and spreads over the tile', () => {
    expect(grassHash(3, 7)).toBe(grassHash(3, 7));
    expect(grassHash(3, 7)).not.toBe(grassHash(7, 3));
    const seen = new Set<number>();
    for (let y = 0; y < GRASS_TILE_H / GRASS_CELL; y++) {
      for (let x = 0; x < GRASS_TILE_W / GRASS_CELL; x++) seen.add(grassHash(x, y));
    }
    expect(seen.size).toBeGreaterThan(2000);
  });

  it('paints every cell of the tile exactly once, inside the tile', () => {
    let cells = 0;
    let outside = 0;
    forEachGrassCell((x, y, size) => {
      cells++;
      if (x < 0 || y < 0 || x + size > GRASS_TILE_W || y + size > GRASS_TILE_H) outside++;
    });
    expect(cells).toBe((GRASS_TILE_W / GRASS_CELL) * (GRASS_TILE_H / GRASS_CELL));
    expect(outside).toBe(0);
  });

  it('is soft: between 8 % and 16 % of the cells of EACH stripe are speckled, in that stripe\'s own shade', () => {
    const count = [0, 0, 0, 0];
    forEachGrassCell((x, _y, _size, tone) => {
      count[tone]++;
      // A speckle never changes stripe: it is the stripe's own darker shade.
      const base = grassBaseTone(x);
      expect(tone === base || tone === base + 1).toBe(true);
    });
    const light = count[GRASS_TONE_LIGHT_SPECK] / (count[GRASS_TONE_LIGHT] + count[GRASS_TONE_LIGHT_SPECK]);
    const dark = count[GRASS_TONE_DARK_SPECK] / (count[GRASS_TONE_DARK] + count[GRASS_TONE_DARK_SPECK]);
    expect(GRASS_SPECKLE_PERCENT).toBe(12);
    expect(light).toBeGreaterThan(0.08);
    expect(light).toBeLessThan(0.16);
    expect(dark).toBeGreaterThan(0.08);
    expect(dark).toBeLessThan(0.16);
  });

  it('bakes the same tile twice, cell by cell: no randomness, reproducible screenshots', () => {
    const first: number[] = [];
    const second: number[] = [];
    forEachGrassCell((_x, _y, _size, tone) => first.push(tone));
    forEachGrassCell((_x, _y, _size, tone) => second.push(tone));
    expect(second).toEqual(first);
    expect(grassTileTone(0, 0)).toBe(first[0]);
  });
});
```

- [ ] **Step 2: Verlo fallar**

Ejecuta: `npx vitest run components/games/football-screen/grass.test.ts`
Esperado: **FALLA** con `Failed to resolve import "./grass"`.

- [ ] **Step 3: Escribir `grass.ts`**

Crea `components/games/football-screen/grass.ts`:

```ts
// V15-1 (G15-2 + brief §1, options 1-C1 and 1-C2): the pitch goes from two dark greens
// in 160-unit stripes to the Tehkan reference's look -- TWO lime greens, one stronger,
// in narrow "mowing" stripes with a soft speckle. The reference's pitch is vertical and
// its stripes horizontal; ours is horizontal, so our stripes stay VERTICAL and aligned
// with the world, like v1 (odd stripe index = light shade).
//
// The component bakes ONE tile -- two stripes wide -- into a canvas when it mounts,
// turns it into a repeating CanvasPattern once, and every frame fills the screen with
// that pattern shifted by grassTileOffset(camera): one fill call, no allocation
// (criterion 20). The speckle comes from an integer hash, never from a random source, so
// the pitch is the same pixel for pixel on every run (criterion 1's spirit applied to
// the screen: reproducible captures for the QA).
//
// No DOM here: forEachGrassCell hands every cell to a callback, exactly like
// sprite-maps.ts's bakeSpriteAtlas.

export const GRASS_STRIPE_WIDTH = 48;
export const GRASS_TILE_W = GRASS_STRIPE_WIDTH * 2; // one light + one dark stripe
export const GRASS_TILE_H = 96;
export const GRASS_CELL = 2; // pixel-art grain, matching the sprites' 2 px
export const GRASS_SPECKLE_PERCENT = 12;

export const GRASS_TONE_LIGHT = 0;
export const GRASS_TONE_LIGHT_SPECK = 1;
export const GRASS_TONE_DARK = 2;
export const GRASS_TONE_DARK_SPECK = 3;

// A 32-bit integer mix (murmur3-style finaliser over the two coordinates).
export function grassHash(x: number, y: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// Math.floor, not truncation: the camera can show x < 0 (cameraMinX is -60), and
// (-1 & 1) === 1 keeps the alternation going on that side too.
export function grassBaseTone(worldX: number): number {
  return (Math.floor(worldX / GRASS_STRIPE_WIDTH) & 1) === 1 ? GRASS_TONE_LIGHT : GRASS_TONE_DARK;
}

// The speckle is the stripe's OWN darker shade (base + 1), so it never blurs the stripes.
export function grassTileTone(cellX: number, cellY: number): number {
  const base = grassBaseTone(cellX * GRASS_CELL);
  return grassHash(cellX, cellY) % 100 < GRASS_SPECKLE_PERCENT ? base + 1 : base;
}

export function forEachGrassCell(fill: (x: number, y: number, size: number, tone: number) => void): void {
  const cols = GRASS_TILE_W / GRASS_CELL;
  const rows = GRASS_TILE_H / GRASS_CELL;
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) fill(cx * GRASS_CELL, cy * GRASS_CELL, GRASS_CELL, grassTileTone(cx, cy));
  }
}

// Where the tile's origin has to sit so that the pattern follows the world: an integer
// (pixel-art grain, no half-pixel shimmer) in [0, tile).
export function grassTileOffset(camera: number, tile: number): number {
  const r = Math.round(camera) % tile;
  return r < 0 ? r + tile : r;
}
```

- [ ] **Step 4: Verlo pasar**

Ejecuta: `npx vitest run components/games/football-screen/grass.test.ts`
Esperado: **PASA**, 8 tests. (Medido al escribir el plan con este mismo hash: 13,1 % de moteado en la banda clara y 12,2 % en la oscura; 2304 valores distintos en 2304 celdas.)

- [ ] **Step 5: Romperlo a propósito (control negativo)**

1. Cambia temporalmente `export const GRASS_TILE_W = GRASS_STRIPE_WIDTH * 2;` por `GRASS_STRIPE_WIDTH * 3` y ejecuta el fichero. Esperado: **fallan** «is exactly two stripes wide» **y** «reproduces the world stripes at every screen x» (la baldosa de tres bandas rompe la paridad al repetirse). **Deshaz.**
2. Cambia temporalmente `GRASS_SPECKLE_PERCENT` a `0`. Esperado: **falla** «is soft: between 8 % and 16 %». **Deshaz** y vuelve a verlo verde.

- [ ] **Step 6: Cablear el componente — imports, paleta y horneado único**

En `components/games/VaultWorldCupGame.tsx`, junto a los imports de `./football-screen/` (orden alfabético: después de `./football-screen/goal-net`), añade:

```ts
import {
  GRASS_TILE_H, GRASS_TILE_W, forEachGrassCell, grassTileOffset,
} from './football-screen/grass';
```

Sustituye las tres líneas de la paleta (`:100-102`):

```ts
const GRASS_DARK = '#1f6b32';
const GRASS_LIGHT = '#247a39';
const STRIPE_WIDTH = 160;
```

por:

```ts
// V15-1 (G15-2): two lime greens in mowing stripes, the dark one "stronger/more
// serious" as Paco asked, each with its own speckle shade. Indexed by grass.ts's tone.
const GRASS_LIGHT = '#9ccf3f';
const GRASS_LIGHT_SPECK = '#8fc538';
const GRASS_DARK = '#7db62f';
const GRASS_DARK_SPECK = '#70a82a';
const GRASS_TONE_COLORS: readonly string[] = [GRASS_LIGHT, GRASS_LIGHT_SPECK, GRASS_DARK, GRASS_DARK_SPECK];
// Brief §8 (deferred minor of step 11): every stroke of drawPitch sets it explicitly
// instead of inheriting it from whatever was drawn before.
const PITCH_LINE_WIDTH = 3;
```

Justo **encima** de `function VaultWorldCupGame(` (a nivel de módulo, fuera del componente), añade la función de horneado (usa DOM; no se testea en vitest, igual que `bakeSprite` de Kong):

```ts
// Bakes grass.ts's tile into a canvas ONCE per mount (criterion 20: never per frame).
function bakeGrassTile(): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = GRASS_TILE_W;
  tile.height = GRASS_TILE_H;
  const c = tile.getContext('2d');
  if (c === null) return tile;
  forEachGrassCell((x, y, size, tone) => {
    c.fillStyle = GRASS_TONE_COLORS[tone];
    c.fillRect(x, y, size, size);
  });
  return tile;
}
```

Y en el efecto, **justo debajo** de `const viewRect = createMinimapRect();`:

```ts
    // V15-1: the grass tile and its pattern, created ONCE (criterion 20). drawPitch
    // only shifts it with the camera. createPattern can return null (per the DOM
    // types), and then drawPitch falls back to the flat dark shade.
    const grassPattern = ctx.createPattern(bakeGrassTile(), 'repeat');
```

- [ ] **Step 7: Cablear el componente — `drawPitch`**

En `drawPitch`, **sustituye** el bloque del césped (desde el comentario `// Grass, in world-aligned stripes so the camera movement is legible.` hasta el cierre `}` del bucle `for (let i = first; i <= last; i++)`, `:816-826`) por:

```ts
      // V15-1 (G15-2): lime mowing stripes with a soft speckle, baked once into
      // grassPattern. The pattern is anchored to the coordinate origin, so shifting the
      // transform by the camera's offset inside the tile glues the stripes to the world:
      // screen pixel s shows tile pixel (s + ox) mod 96 = the stripe of world pixel
      // s + cam.x (grass.test.ts asserts it). One fill, no allocation. (No
      // `const match = run.match` here: drawPitch never reads the match.)
      if (grassPattern === null) {
        ctx.fillStyle = GRASS_DARK;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      } else {
        const ox = grassTileOffset(cam.x, GRASS_TILE_W);
        const oy = grassTileOffset(cam.y, GRASS_TILE_H);
        ctx.setTransform(1, 0, 0, 1, -ox, -oy);
        ctx.fillStyle = grassPattern;
        ctx.fillRect(ox, oy, VIEW_W, VIEW_H);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
```

Después, en el mismo `drawPitch`:
1. En `const p = PITCH; ctx.strokeStyle = LINE; ctx.lineWidth = 3;` sustituye `ctx.lineWidth = 3;` por `ctx.lineWidth = PITCH_LINE_WIDTH;`.
2. Dentro del bucle `for (let side = 0; side < 2; side++)`, justo **después** de `ctx.strokeStyle = LINE;` (la primera línea de trazo del bucle, antes del `strokeRect` del área grande), añade:

```ts
        // Brief §8: without this, the second goal's areas inherit the goal frame's
        // lineWidth from the first iteration. Explicit, so they can never drift apart.
        ctx.lineWidth = PITCH_LINE_WIDTH;
```

3. **No toques** la red ni el marco de la portería (`NET_LINE` con `lineWidth = 1`, `GOAL_FRAME` con `lineWidth = 3`): son de G11-4 y la red que ondula es V15-5.

- [ ] **Step 8: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/grass.ts components/games/football-screen/grass.test.ts components/games/VaultWorldCupGame.tsx
git diff --stat 478fc93 -- components/games/football-logic/
grep -rn "Math.random" components/games/football-screen/
grep -n "STRIPE_WIDTH\|#1f6b32\|#247a39" components/games/VaultWorldCupGame.tsx
grep -n "lineWidth = PITCH_LINE_WIDTH" components/games/VaultWorldCupGame.tsx
grep -n "createPattern\|bakeGrassTile()" components/games/VaultWorldCupGame.tsx
```
Esperado: delta **+8 tests / +1 fichero** (sola tras V15-1-1: **1289 / 77**; sola sobre la baseline: 1276 / 76), `tsc` y `eslint` sin salida, `git diff` del motor **vacío**, `grep Math.random` **vacío**, el `grep` de `STRIPE_WIDTH` y los verdes viejos **vacío**, el de `PITCH_LINE_WIDTH` con **exactamente 2** líneas dentro de `drawPitch`, y `createPattern`/`bakeGrassTile()` con **2 líneas cada uno** (la preasignación del efecto + un comentario que menciona cada nombre — p. ej. «createPattern can return null…» y la declaración `function bakeGrassTile(): HTMLCanvasElement`); ninguna de las 4 dentro de `drawPitch`.

- [ ] **Step 9: Anotar en el ledger**

`V15-1-2 hecha: grass.ts + 8 tests; drawPitch con patrón lima horneado una vez (1 fillRect/frame) + PITCH_LINE_WIDTH explícito en los 2 sitios. Motor intacto. Controles negativos aplicados y deshechos. Working tree verificado; commit lo hace Paco.`

- [ ] **Step 10: Dejar el working tree verificado; commit lo hace Paco**

No ejecutes `git add` ni `git commit`.

---

### Task V15-1-3: `sprite-frame.ts` — qué celda del atlas pinta cada jugador (G15-2, G15-3)

**Files:**
- Create: `components/games/football-screen/sprite-frame.ts`
- Test: `components/games/football-screen/sprite-frame.test.ts`

**Interfaces:**
- Consumes de la Task V15-1-1, literalmente: `OCTANT_E`, `OCTANT_SE`, `OCTANT_S`, `OCTANT_SW`, `OCTANT_W`, `OCTANT_NW`, `OCTANT_N`, `OCTANT_NE`, `POSE_IDLE`, `POSE_RUN_0`, `POSE_RUN_1`, `POSE_RUN_2`, `POSE_DOWN`, `POSE_DIVE_0`, `POSE_DIVE_1`.
- Consumes de `gestures.ts` (paso 11, sin cambios): `GESTURE_IDLE`, `DIVE_REACH_MAX`, `DIVE_PEAK`, `GK_DIVE_STEPS`, `diveReach(progress)`.
- Consumes del motor (solo lectura): `PlayerState`, `isPlayerDown`, `PLAYER_SPEED`.
- Produces, y la Task V15-1-4 consume literalmente:
  - `OCTANT_TAN = 0.41421356`
  - `facingOctant(fx: number, fy: number): number`
  - `RUN_FRAME_STEPS = 6`, `SPRINT_FRAME_STEPS = 4`, `RUN_PHASE_SPREAD = 5`, `RUN_MIN_SPEED_SQ = 1`, `RUN_FAST_SPEED_SQ: number`
  - `runPose(stepCount: number, id: number, vx: number, vy: number): number`
  - `DIVE_FULL_FRACTION = 0.6`, `diveSpritePose(progress: number): number`
  - `SLIDE_TILT_RAD = 0.45`, `SLIDE_TILT_COS: number`, `SLIDE_TILT_SIN: number`
  - `type SpriteChoice = { octant: number; pose: number; tilt: -1 | 0 | 1 }`, `createSpriteChoice(): SpriteChoice`
  - `choosePlayerSprite(p: PlayerState, stepCount: number, shootout: boolean, parked: boolean, diveProgress: number, diveDirX: number, diveDirY: number, out: SpriteChoice): void`

**Contexto que el ejecutor no tiene:**
- **Octante sin trigonometría** (brief §1, 1-A): `facingX/facingY` es unitario (`players.ts:movePlayer` lo escribe solo cuando el jugador se mueve y lo conserva parado), pero los jugadores de la IA van en **ángulo continuo** (`stepPlayerFree`), así que hay que redondear al octante más cercano. Basta comparar `|y|` con `|x| · tan 22,5°` (≈ 0,414) y viceversa, más los signos: dos multiplicaciones, ninguna raíz ni `atan2`. `(0, 0)` no debería llegar nunca; si llega, E.
- **Fotograma de carrera:** ciclo `RUN_0 → RUN_1 → RUN_2 → RUN_1` (el `RUN_1` de piernas juntas hace de paso intermedio), un fotograma cada 6 pasos (10 Hz a 60 pasos/s) o cada 4 si va rápido. «Rápido» = velocidad² por encima de `(PLAYER_SPEED · 1,2)²` = 216²: por encima de la carrera normal (180) y por debajo del sprint (180 · 1,4 = 252); el portero (220) también anima rápido. Los ids desfasan el ciclo 5 pasos cada uno para que los 18 no «marchen» sincronizados. Parado (velocidad² ≤ 1) = `POSE_IDLE`. Todo desde `stepCount`, `id`, `vx`, `vy`: puro y determinista.
- **Prioridades de `choosePlayerSprite`**, copiando las exclusiones que `drawPlayer` ya tiene (comentario de `VaultWorldCupGame.tsx:900-918`):
  1. **Portero en estirada** (`diveProgress !== GESTURE_IDLE`): octante de la **dirección de la estirada** (`gestures.dirX/dirY`, el balón un paso antes de la atajada — hallazgo H1 del paso 11), pose `DIVE_0` o `DIVE_1` según `diveReach(progress)` ≥ 60 % de `DIVE_REACH_MAX`. Sale `0 → 1 → 0` a lo largo de los 35 pasos: los «2 fotogramas elegidos por la fracción del gesto» de G15-3. El que llama pasa `GESTURE_IDLE` para los que no son porteros.
  2. **Aparcado de la tanda** (`parked`): de pie y quieto (`POSE_IDLE`), aunque el motor le haya dejado `tackleStepsLeft` o `downUntilStep` (B2 §8: la pantalla los ignora, el motor no los limpia).
  3. **Tumbado** (`!shootout && isPlayerDown`): `POSE_DOWN` con el octante de su `facing`. En la tanda **nadie** se dibuja tumbado, lanzador incluido (Minor 2 del informe B2).
  4. **Deslizamiento** (`!shootout && tackleStepsLeft > 0`): `POSE_RUN_1` (piernas juntas, el cuerpo en tensión) con el octante de `tackleDirX/tackleDirY` y `tilt = ±1` (signo de `tackleDirX`, `+1` si es 0): el componente lo dibuja girado `SLIDE_TILT_RAD` — «deslizamiento = carrera inclinada» de G15-3.
  5. **El resto:** `runPose`.
- **`SLIDE_TILT_COS/SIN`** son las únicas llamadas trigonométricas nuevas del paso, **una vez al cargar el módulo**, para que el componente dibuje el sprite inclinado con `setTransform` sin calcular nada por frame.

- [ ] **Step 1: Escribir el test en rojo**

Crea `components/games/football-screen/sprite-frame.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PITCH } from '../football-logic/pitch';
import { createPlayers, type PlayerState } from '../football-logic/players';
import { FORMATIONS } from '../football-logic/teams';
import { DIVE_PEAK, GESTURE_IDLE, GK_DIVE_STEPS } from './gestures';
import {
  OCTANT_COUNT, OCTANT_E, OCTANT_N, OCTANT_NE, OCTANT_NW, OCTANT_S, OCTANT_SE, OCTANT_SW, OCTANT_W,
  POSE_DIVE_0, POSE_DIVE_1, POSE_DOWN, POSE_IDLE, POSE_RUN_0, POSE_RUN_1, POSE_RUN_2,
} from './sprite-maps';
import {
  OCTANT_TAN, RUN_FRAME_STEPS, SLIDE_TILT_COS, SLIDE_TILT_RAD, SLIDE_TILT_SIN, SPRINT_FRAME_STEPS,
  choosePlayerSprite, createSpriteChoice, diveSpritePose, facingOctant, runPose,
} from './sprite-frame';

// A real outfield player from the engine's own factory (id 1, team 0, facing east).
function outfielder(): PlayerState {
  return createPlayers([FORMATIONS[0], FORMATIONS[0]], PITCH)[1];
}

describe('facingOctant', () => {
  it('maps the four axes (screen y grows DOWN)', () => {
    expect(facingOctant(1, 0)).toBe(OCTANT_E);
    expect(facingOctant(0, 1)).toBe(OCTANT_S);
    expect(facingOctant(-1, 0)).toBe(OCTANT_W);
    expect(facingOctant(0, -1)).toBe(OCTANT_N);
  });

  it('maps the four diagonals', () => {
    const d = Math.SQRT1_2;
    expect(facingOctant(d, d)).toBe(OCTANT_SE);
    expect(facingOctant(-d, d)).toBe(OCTANT_SW);
    expect(facingOctant(-d, -d)).toBe(OCTANT_NW);
    expect(facingOctant(d, -d)).toBe(OCTANT_NE);
  });

  it('switches from axis to diagonal at tan(22.5 deg), on both sides of the boundary', () => {
    expect(OCTANT_TAN).toBeCloseTo(Math.SQRT2 - 1, 6);
    expect(facingOctant(1, 0.41)).toBe(OCTANT_E);
    expect(facingOctant(1, 0.42)).toBe(OCTANT_SE);
    expect(facingOctant(0.41, 1)).toBe(OCTANT_S);
    expect(facingOctant(0.42, 1)).toBe(OCTANT_SE);
  });

  it('falls back to east on a zero vector instead of guessing', () => {
    expect(facingOctant(0, 0)).toBe(OCTANT_E);
  });

  // The AI moves at continuous angles (stepPlayerFree): every one of 72 directions round
  // the circle must land in its NEAREST octant. The expected value is computed here with
  // trigonometry -- the function under test uses none. Angles are whole degrees + 1, so
  // none of them sits exactly on a 22.5 deg boundary.
  it('lands 72 directions round the circle in their nearest octant', () => {
    for (let i = 0; i < 72; i++) {
      const rad = ((i * 5 + 1) * Math.PI) / 180;
      const expected = ((Math.round(rad / (Math.PI / 4)) % OCTANT_COUNT) + OCTANT_COUNT) % OCTANT_COUNT;
      expect([i, facingOctant(Math.cos(rad), Math.sin(rad))]).toEqual([i, expected]);
    }
  });
});

describe('runPose', () => {
  it('stands still when the player does not move', () => {
    expect(runPose(0, 1, 0, 0)).toBe(POSE_IDLE);
    expect(runPose(999, 7, 0.5, -0.5)).toBe(POSE_IDLE);
  });

  it('cycles RUN_0, RUN_1, RUN_2, RUN_1 every RUN_FRAME_STEPS at running speed', () => {
    const seen: number[] = [];
    for (let k = 0; k < 5; k++) seen.push(runPose(k * RUN_FRAME_STEPS, 0, 180, 0));
    expect(seen).toEqual([POSE_RUN_0, POSE_RUN_1, POSE_RUN_2, POSE_RUN_1, POSE_RUN_0]);
    expect(runPose(RUN_FRAME_STEPS - 1, 0, 180, 0)).toBe(POSE_RUN_0);
  });

  it('cycles faster when sprinting (every SPRINT_FRAME_STEPS)', () => {
    expect(SPRINT_FRAME_STEPS).toBeLessThan(RUN_FRAME_STEPS);
    const seen: number[] = [];
    for (let k = 0; k < 5; k++) seen.push(runPose(k * SPRINT_FRAME_STEPS, 0, 252, 0));
    expect(seen).toEqual([POSE_RUN_0, POSE_RUN_1, POSE_RUN_2, POSE_RUN_1, POSE_RUN_0]);
    expect(runPose(SPRINT_FRAME_STEPS, 0, 180, 0)).toBe(POSE_RUN_0);
  });

  it('puts neighbours out of phase so the eighteen do not march in step', () => {
    expect(runPose(0, 1, 180, 0)).toBe(POSE_RUN_0);
    expect(runPose(0, 2, 180, 0)).toBe(POSE_RUN_1);
  });
});

describe('diveSpritePose', () => {
  it('opens on DIVE_0, is fully stretched (DIVE_1) at the peak and closes on DIVE_0 (G15-3: 2 frames)', () => {
    expect(diveSpritePose(0)).toBe(POSE_DIVE_0);
    expect(diveSpritePose(DIVE_PEAK)).toBe(POSE_DIVE_1);
    expect(diveSpritePose((GK_DIVE_STEPS - 1) / GK_DIVE_STEPS)).toBe(POSE_DIVE_0);
    let full = 0;
    let open = 0;
    for (let k = 0; k < GK_DIVE_STEPS; k++) {
      if (diveSpritePose(k / GK_DIVE_STEPS) === POSE_DIVE_1) full++;
      else open++;
    }
    expect(full).toBeGreaterThan(0);
    expect(open).toBeGreaterThan(0);
  });
});

describe('choosePlayerSprite', () => {
  it('draws a diving keeper towards the DIVE direction, not its own facing', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.facingX = 1;
    p.facingY = 0;
    choosePlayerSprite(p, 100, false, false, 0.3, 0, -1, out);
    expect(out.octant).toBe(OCTANT_N);
    expect(out.pose).toBe(POSE_DIVE_1);
    expect(out.tilt).toBe(0);
  });

  it('keeps a parked shootout player standing still even if the engine left it sliding and down', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.vx = 180;
    p.tackleStepsLeft = 5;
    p.downUntilStep = 10_000;
    choosePlayerSprite(p, 100, true, true, GESTURE_IDLE, 0, 0, out);
    expect(out.pose).toBe(POSE_IDLE);
    expect(out.tilt).toBe(0);
  });

  it('lays a player down in open play, but never during the shootout, taker included', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.downUntilStep = 200;
    p.facingX = -1;
    p.facingY = 0;
    choosePlayerSprite(p, 100, false, false, GESTURE_IDLE, 0, 0, out);
    expect(out.pose).toBe(POSE_DOWN);
    expect(out.octant).toBe(OCTANT_W);
    choosePlayerSprite(p, 100, true, false, GESTURE_IDLE, 0, 0, out);
    expect(out.pose).toBe(POSE_IDLE);
  });

  it('draws a slide as the run sprite tilted, along the tackle direction (G15-3)', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.facingX = 1;
    p.facingY = 0;
    p.tackleStepsLeft = 10;
    p.tackleDirX = -1;
    p.tackleDirY = 0;
    choosePlayerSprite(p, 100, false, false, GESTURE_IDLE, 0, 0, out);
    expect(out.pose).toBe(POSE_RUN_1);
    expect(out.octant).toBe(OCTANT_W);
    expect(out.tilt).toBe(-1);
    p.tackleDirX = 1;
    choosePlayerSprite(p, 100, false, false, GESTURE_IDLE, 0, 0, out);
    expect(out.tilt).toBe(1);
    expect(SLIDE_TILT_COS).toBeCloseTo(Math.cos(SLIDE_TILT_RAD), 9);
    expect(SLIDE_TILT_SIN).toBeCloseTo(Math.sin(SLIDE_TILT_RAD), 9);
  });

  it('writes in place and returns nothing (criterion 20)', () => {
    const p = outfielder();
    const out = createSpriteChoice();
    p.vx = 180;
    expect(choosePlayerSprite(p, 0, false, false, GESTURE_IDLE, 0, 0, out)).toBeUndefined();
    // id 1 at step 0: ((0 + 1 * RUN_PHASE_SPREAD) / RUN_FRAME_STEPS) | 0 = 0 -> RUN_0.
    expect(out.pose).toBe(POSE_RUN_0);
    expect(out.octant).toBe(OCTANT_E);
    p.facingX = 0;
    p.facingY = 1;
    choosePlayerSprite(p, 6, false, false, GESTURE_IDLE, 0, 0, out);
    expect(out.pose).toBe(POSE_RUN_1);
    expect(out.octant).toBe(OCTANT_S);
  });
});
```

- [ ] **Step 2: Verlo fallar**

Ejecuta: `npx vitest run components/games/football-screen/sprite-frame.test.ts`
Esperado: **FALLA** con `Failed to resolve import "./sprite-frame"`.

- [ ] **Step 3: Escribir `sprite-frame.ts`**

Crea `components/games/football-screen/sprite-frame.ts`:

```ts
import { PLAYER_SPEED, isPlayerDown, type PlayerState } from '../football-logic/players';
import { DIVE_REACH_MAX, GESTURE_IDLE, diveReach } from './gestures';
import {
  OCTANT_E, OCTANT_N, OCTANT_NE, OCTANT_NW, OCTANT_S, OCTANT_SE, OCTANT_SW, OCTANT_W,
  POSE_DIVE_0, POSE_DIVE_1, POSE_DOWN, POSE_IDLE, POSE_RUN_0, POSE_RUN_1, POSE_RUN_2,
} from './sprite-maps';

// V15-1 (G15-2 + G15-3): which cell of the sprite atlas each player shows this frame.
// Pure, per player, written into an out object created ONCE by the component, and
// without a single trigonometric call per frame: the octant comes from comparing |x|
// with |y| * tan(22.5 deg), the run frame from the step count, the player id and the
// speed, and the keeper's two dive frames from gestures.ts's own reach curve.
//
// The priorities copy the exclusions drawPlayer already had (stage B2 §8 and its
// Minor 2): a diving keeper first, then the parked fifteen of the shootout (standing,
// whatever the engine left in their slide/floor fields), then lying down (never during
// the shootout, taker included), then sliding, then running or standing still.

// tan(22.5 deg) = sqrt(2) - 1: below it a direction is an axis, above it a diagonal.
export const OCTANT_TAN = 0.41421356;

export function facingOctant(fx: number, fy: number): number {
  const ax = fx < 0 ? -fx : fx;
  const ay = fy < 0 ? -fy : fy;
  if (ax === 0 && ay === 0) return OCTANT_E;
  if (ay <= ax * OCTANT_TAN) return fx > 0 ? OCTANT_E : OCTANT_W;
  if (ax <= ay * OCTANT_TAN) return fy > 0 ? OCTANT_S : OCTANT_N;
  if (fx > 0) return fy > 0 ? OCTANT_SE : OCTANT_NE;
  return fy > 0 ? OCTANT_SW : OCTANT_NW;
}

export const RUN_FRAME_STEPS = 6; // 10 frames/s at 60 steps/s
export const SPRINT_FRAME_STEPS = 4;
// Each id shifts its cycle by this many steps, so neighbours do not run in lockstep.
export const RUN_PHASE_SPREAD = 5;
export const RUN_MIN_SPEED_SQ = 1;
// Between a normal run (PLAYER_SPEED 180) and a sprint (180 * SPRINT_MULT 1.4 = 252).
export const RUN_FAST_SPEED_SQ = (PLAYER_SPEED * 1.2) * (PLAYER_SPEED * 1.2);
// RUN_1 (legs together) is the passing frame between the two strides.
const RUN_CYCLE: readonly number[] = [POSE_RUN_0, POSE_RUN_1, POSE_RUN_2, POSE_RUN_1];

export function runPose(stepCount: number, id: number, vx: number, vy: number): number {
  const speedSq = vx * vx + vy * vy;
  if (speedSq <= RUN_MIN_SPEED_SQ) return POSE_IDLE;
  const frameSteps = speedSq > RUN_FAST_SPEED_SQ ? SPRINT_FRAME_STEPS : RUN_FRAME_STEPS;
  const frame = ((stepCount + id * RUN_PHASE_SPREAD) / frameSteps) | 0;
  return RUN_CYCLE[frame & 3];
}

// G15-3: "estirada GK 2 fotogramas" chosen by the fraction of the gesture. The reach
// curve (gestures.ts) goes 0 -> DIVE_REACH_MAX -> 0 over the 35 steps, so the sprite
// goes DIVE_0 -> DIVE_1 -> DIVE_0 with it.
export const DIVE_FULL_FRACTION = 0.6;

export function diveSpritePose(progress: number): number {
  return diveReach(progress) >= DIVE_REACH_MAX * DIVE_FULL_FRACTION ? POSE_DIVE_1 : POSE_DIVE_0;
}

// G15-3: "deslizamiento = carrera inclinada". The only trigonometry of V15-1, computed
// ONCE at module load so the component can tilt the sprite with setTransform.
export const SLIDE_TILT_RAD = 0.45;
export const SLIDE_TILT_COS = Math.cos(SLIDE_TILT_RAD);
export const SLIDE_TILT_SIN = Math.sin(SLIDE_TILT_RAD);

export type SpriteChoice = { octant: number; pose: number; tilt: -1 | 0 | 1 };

export function createSpriteChoice(): SpriteChoice {
  return { octant: OCTANT_E, pose: POSE_IDLE, tilt: 0 };
}

// diveProgress: gestureProgress(...) for a keeper, GESTURE_IDLE for everybody else.
// diveDirX/diveDirY: gestures.dirX/dirY of that player (read only while diving).
export function choosePlayerSprite(
  p: PlayerState, stepCount: number, shootout: boolean, parked: boolean,
  diveProgress: number, diveDirX: number, diveDirY: number, out: SpriteChoice,
): void {
  out.tilt = 0;
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
    out.pose = POSE_DOWN;
    return;
  }
  if (!shootout && p.tackleStepsLeft > 0) {
    out.octant = facingOctant(p.tackleDirX, p.tackleDirY);
    out.pose = POSE_RUN_1;
    out.tilt = p.tackleDirX < 0 ? -1 : 1;
    return;
  }
  out.pose = runPose(stepCount, p.id, p.vx, p.vy);
}
```

- [ ] **Step 4: Verlo pasar**

Ejecuta: `npx vitest run components/games/football-screen/sprite-frame.test.ts`
Esperado: **PASA**, 15 tests.

- [ ] **Step 5: Romperlo a propósito (control negativo)**

1. Cambia temporalmente `OCTANT_TAN` a `1` y ejecuta. Esperado: fallan, **al menos**, «switches from axis to diagonal at tan(22.5 deg)» y «lands 72 directions round the circle» (medido: falla también «maps the four diagonals», 3 en total — el control discrimina igualmente). **Deshaz.**
2. Cambia temporalmente `RUN_CYCLE` a `[POSE_RUN_1, POSE_RUN_1, POSE_RUN_1, POSE_RUN_1]`. Esperado: fallan, **al menos**, los dos tests de ciclo y el de desfase (medido: falla también «writes in place and returns nothing», 4 en total — el control discrimina igualmente). **Deshaz.**
3. En `choosePlayerSprite`, cambia temporalmente `if (!shootout && isPlayerDown(p, stepCount))` por `if (isPlayerDown(p, stepCount))`. Esperado: **falla** «lays a player down in open play, but never during the shootout, taker included». **Deshaz** y vuelve a verlo verde.

- [ ] **Step 6: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/sprite-frame.ts components/games/football-screen/sprite-frame.test.ts
git diff --stat 478fc93 -- components/games/football-logic/
grep -n "Math.atan2\|Math.sqrt\|Math.hypot\|Math.random" components/games/football-screen/sprite-frame.ts
grep -n "Math.cos\|Math.sin" components/games/football-screen/sprite-frame.ts
```
Esperado: delta **+15 tests / +1 fichero** (sola tras V15-1-1 y V15-1-2: **1304 / 78**), `tsc` y `eslint` sin salida, `git diff` del motor **vacío**, el primer `grep` **vacío**, el segundo con **exactamente 2** líneas (`SLIDE_TILT_COS` y `SLIDE_TILT_SIN`, a nivel de módulo).

- [ ] **Step 7: Anotar en el ledger**

`V15-1-3 hecha: sprite-frame.ts (octante sin trigonometría, ciclo de carrera, estirada 2 fotogramas, deslizamiento inclinado) + 15 tests. Motor intacto. Controles negativos aplicados y deshechos. Working tree verificado; commit lo hace Paco.`

- [ ] **Step 8: Dejar el working tree verificado; commit lo hace Paco**

No ejecutes `git add` ni `git commit`.

---

### Task V15-1-4: `drawPlayer` por sprite, fuera palito y `player-pose`, sonda actualizada (G15-2, G15-3)

**Files:**
- Modify: `components/games/VaultWorldCupGame.tsx` (imports `:21-66`, constantes `:107`, `:122-126`, `:155-156`, `getContext` `:293`, preasignación `:330-333`, `startMatch` `:440`, comentario + `drawPlayer` `:900-1011`)
- Modify: `components/games/football-screen/view-pipeline.test.ts` (entero)
- Delete: `components/games/football-screen/player-pose.ts`, `components/games/football-screen/player-pose.test.ts`

**Interfaces:**
- Consumes de la Task V15-1-1: `ATLAS_W`, `ATLAS_H`, `PLAYER_SPRITE_MAPS`, `SPRITE_SIZE`, `SPRITE_HALF`, `OCTANT_COUNT`, `POSE_COUNT`, `POSE_IDLE`, `POSE_RUN_0`, `POSE_RUN_1`, `POSE_RUN_2`, `POSE_DIVE_0`, `POSE_DIVE_1`, `atlasCellX`, `atlasCellY`, `bakeSpriteAtlas`, `createSpritePalette`, `writeSpritePalette`, `type SpritePalette`.
- Consumes de la Task V15-1-3: `choosePlayerSprite`, `createSpriteChoice`, `SLIDE_TILT_COS`, `SLIDE_TILT_SIN`.
- Consumes de `gestures.ts`: `GESTURE_IDLE`, `gestureProgress`, `gestures.dirX/dirY` (y la sonda: `DIVE_REACH_MAX`, `diveReach`).
- Produces: nada nuevo para tareas posteriores; cierra el cableado del paso.

**Contexto que el ejecutor no tiene:**
- **Instantánea previa (la hace el controlador antes de despachar):** `VaultWorldCupGame.tsx` copiado a `.superpowers/sdd/2026-09-21-vault-world-cup-v15-1/snapshot-before-v15-1-4/components_games_VaultWorldCupGame.tsx.txt` (extensión `.txt`, nunca `.tsx`).
- **Qué se queda de `drawPlayer` y qué se va (G15-3):** se queda **la sombra** (más pequeña: «sombra mínima»), los **arcos de celebración** de v1 (el abrazo es V15-5), el **triángulo del cursor**, las **muescas de carga** y el **aro de sprint**, todo vectorial y sin cambios. Se van el **cuerpo** (círculo/elipse), el **ribete**, la **cápsula** del portero, la **cabeza y los hombros** de G11-1 y el **palito de dirección**. Con ellos se van `HEAD_COLOR`, `HEAD_TRIM`, `SHOULDER_WIDTH`, `FACING_STICK`, los objetos `pose` y `dive`, el import de `player-pose` y el uso de `diveReach` en el componente (ahora lo usa `sprite-frame.ts`).
- **Atlas:** tres `<canvas>` de 240 × 210 creados **una vez** al montar: local, visitante y portero. El del portero se hornea una sola vez con `GK_KIT_PRIMARY`/`GK_KIT_SECONDARY` (G12-1: igual para los 16 porteros). Local y visitante se re-hornean en `startMatch` justo después de `matchKits = resolveMatchKits(...)` (así el visitante sale con su equipación invertida si choca, QA del 15-sep) y también al montar (el placeholder). Re-hornear = `clearRect` + ~5 300 `fillRect` por atlas (2·N + 4·NE + 2·E × 667 celdas opacas cada juego a mano = 5 336): un evento, no un frame.
- **Nitidez:** `ctx.imageSmoothingEnabled = false` una vez tras `getContext` (el componente no tenía ningún `drawImage` hasta ahora: no afecta a nada existente; sí al patrón del césped, que también queda nítido), y coordenadas de pantalla redondeadas con `Math.round` antes de `drawImage`, o los sprites tiemblan al moverse la cámara (brief §1, «Pega»). **`image-rendering: pixelated` NO se añade en este paso** — resuelto por Paco (21-sep): el CSS del canvas (`VaultWorldCupGame.tsx` JSX y `app/globals.css:210`) nunca lo **amplía** en escritorio (`maxWidth/maxHeight: 100%` solo encogen, y por debajo de 768 px el juego está bloqueado por `viewport-guard`), pero en pantallas con `devicePixelRatio` 2 el navegador sí escala el lienzo 800 × 500 y la decisión afecta también al texto del HUD; se mira en el QA (punto 11), no queda como duda abierta.
- **Deslizamiento inclinado:** `ctx.setTransform(cos, s, -s, cos, px, py)` con `s = SLIDE_TILT_SIN · tilt`, `drawImage` centrado en el origen y `ctx.setTransform(1, 0, 0, 1, 0, 0)` inmediatamente después. El lienzo no usa ninguna otra transformación (medido: ni `setTransform`, ni `scale`, ni `translate`, ni `save` en el componente antes de V15-1; V15-1-2 añade el `setTransform` del césped, que también se deshace en el acto).

- [ ] **Step 1: Reescribir la sonda en rojo**

Sustituye **entero** `components/games/football-screen/view-pipeline.test.ts` por:

```ts
import { describe, expect, it } from 'vitest';
import { NORMAL_RULES } from '../football-logic/match';
import { PITCH } from '../football-logic/pitch';
import { TEAMS } from '../football-logic/teams';
import { BALL_SCALE_MAX, BALL_SHADOW_MIN, ballLift, ballScale, ballShadowFade, ballShadowScale } from './ball-view';
import {
  DIVE_REACH_MAX, GESTURE_IDLE, beginGkCatchGestures, createGestureTimers, diveReach, gestureProgress, resetGestures,
} from './gestures';
import { ballInsideGoalMouth } from './goal-net';
import { MATCH_RUN_STEP_CAP, createMatchRun, finishMatchRun, stepMatchRun } from './match-run';
import { choosePlayerSprite, createSpriteChoice } from './sprite-frame';
import {
  OCTANT_COUNT, PLAYER_SPRITE_MAPS, POSE_COUNT, POSE_DIVE_0, POSE_DIVE_1, POSE_IDLE, POSE_RUN_0, POSE_RUN_1, POSE_RUN_2,
} from './sprite-maps';

const BRA = TEAMS[2];
const FRA = TEAMS[5];
// Three different matches, not three runs of the same one: enough goals, saves and
// high balls between them to exercise every helper of steps 11 and V15-1.
const SEEDS = [23, 71, 131];

describe('the view layer (steps 11 and V15-1) over three full matches', () => {
  it('changes nothing in the simulation and produces only values inside its own bounds', () => {
    let saves = 0;
    let gestureSteps = 0;
    let airborneSteps = 0;
    let goalPhaseSteps = 0;
    let ballInsideMouthSteps = 0;
    let finiteEverywhere = true;
    let scaleInBounds = true;
    let shadowInBounds = true;
    let liftNeverNegative = true;
    let progressInBounds = true;
    let reachInBounds = true;
    let spriteInBounds = true;
    let idleSeen = 0;
    let runSeen = 0;
    let diveOpenSeen = 0;
    let diveFullSeen = 0;
    const octantSeen = new Uint8Array(OCTANT_COUNT);

    const gestures = createGestureTimers();
    const choice = createSpriteChoice();

    for (const seed of SEEDS) {
      // The control: the very same match, stepped WITHOUT the screen layer.
      const control = createMatchRun(BRA, FRA, seed, 6, [false, false], NORMAL_RULES, [0, 0]);
      const controlWinner = finishMatchRun(control);
      expect(controlWinner).not.toBe(-1);

      const probed = createMatchRun(BRA, FRA, seed, 6, [false, false], NORMAL_RULES, [0, 0]);
      const m = probed.match;
      resetGestures(gestures);
      let steps = 0;
      while (m.phase !== 'over' && steps < MATCH_RUN_STEP_CAP) {
        // Step-11 pre-flight finding: the dive direction is read from the ball BEFORE
        // this step, not from the 'gk-catch' event -- see gestures.ts's header.
        const prevBallX = m.ball.x;
        const prevBallY = m.ball.y;
        stepMatchRun(probed);
        steps++;

        saves += beginGkCatchGestures(m, gestures, prevBallX, prevBallY);

        if (m.phase === 'goal') {
          goalPhaseSteps++;
          if (ballInsideGoalMouth(m.ball.x, m.ball.y, m.ball.z, PITCH)) ballInsideMouthSteps++;
        }

        const z = m.ball.z;
        if (z > 0) airborneSteps++;
        const scale = ballScale(z);
        const shadow = ballShadowScale(z);
        const fade = ballShadowFade(z);
        const lift = ballLift(z);
        if (!Number.isFinite(scale + shadow + fade + lift)) finiteEverywhere = false;
        if (scale < 1 || scale > BALL_SCALE_MAX) scaleInBounds = false;
        if (shadow > 1 || shadow < BALL_SHADOW_MIN || fade > 1) shadowInBounds = false;
        if (lift < 0) liftNeverNegative = false;

        // The same inputs drawPlayer hands to choosePlayerSprite.
        const shootout = m.phase === 'shootout';
        const takerId = m.shootout === null ? -1 : m.shootout.takerId;
        for (let i = 0; i < m.players.length; i++) {
          const p = m.players[i];
          const progress = gestureProgress(gestures, p.id, m.stepCount);
          if (progress !== GESTURE_IDLE) {
            gestureSteps++;
            if (progress < 0 || progress >= 1) progressInBounds = false;
            const reach = diveReach(progress);
            if (reach < 0 || reach > DIVE_REACH_MAX + 1e-9) reachInBounds = false;
          }
          const parked = shootout && p.id !== takerId && p.role !== 'gk';
          const keeperProgress = p.role === 'gk' ? progress : GESTURE_IDLE;
          choosePlayerSprite(p, m.stepCount, shootout, parked, keeperProgress, gestures.dirX[p.id], gestures.dirY[p.id], choice);
          if (!Number.isInteger(choice.octant) || choice.octant < 0 || choice.octant >= OCTANT_COUNT) spriteInBounds = false;
          else if (!Number.isInteger(choice.pose) || choice.pose < 0 || choice.pose >= POSE_COUNT) spriteInBounds = false;
          else if (PLAYER_SPRITE_MAPS[choice.octant][choice.pose].length === 0) spriteInBounds = false;
          else octantSeen[choice.octant] = 1;
          if (choice.pose === POSE_IDLE) idleSeen++;
          if (choice.pose === POSE_RUN_0 || choice.pose === POSE_RUN_1 || choice.pose === POSE_RUN_2) runSeen++;
          if (choice.pose === POSE_DIVE_0) diveOpenSeen++;
          if (choice.pose === POSE_DIVE_1) diveFullSeen++;
        }
      }

      // THE point of the probe: the screen layer read the match and changed nothing.
      expect(steps).toBeLessThan(MATCH_RUN_STEP_CAP);
      expect(m.stepCount).toBe(control.match.stepCount);
      expect(m.score).toEqual(control.match.score);
      expect(m.half).toBe(control.match.half);
    }

    // Nothing here is allowed to be zero: a probe that never saw a save, a high ball,
    // a goal, both dive frames or a runner would pass while proving nothing.
    expect(saves).toBeGreaterThan(0);
    expect(gestureSteps).toBeGreaterThan(0);
    expect(airborneSteps).toBeGreaterThan(0);
    expect(goalPhaseSteps).toBeGreaterThan(0);
    expect(ballInsideMouthSteps).toBe(goalPhaseSteps);
    expect(idleSeen).toBeGreaterThan(0);
    expect(runSeen).toBeGreaterThan(0);
    expect(diveOpenSeen).toBeGreaterThan(0);
    expect(diveFullSeen).toBeGreaterThan(0);
    let octants = 0;
    for (let o = 0; o < OCTANT_COUNT; o++) octants += octantSeen[o];
    expect(octants).toBe(OCTANT_COUNT);

    expect(finiteEverywhere).toBe(true);
    expect(scaleInBounds).toBe(true);
    expect(shadowInBounds).toBe(true);
    expect(liftNeverNegative).toBe(true);
    expect(progressInBounds).toBe(true);
    expect(reachInBounds).toBe(true);
    expect(spriteInBounds).toBe(true);
  });

  it('keeps the dive frames on the keepers: an outfield player is never drawn diving', () => {
    const run = createMatchRun(BRA, FRA, SEEDS[0], 6, [false, false], NORMAL_RULES, [0, 0]);
    const m = run.match;
    const gestures = createGestureTimers();
    const choice = createSpriteChoice();
    resetGestures(gestures);
    let outfieldGestures = 0;
    let outfieldDives = 0;
    let steps = 0;
    while (m.phase !== 'over' && steps < MATCH_RUN_STEP_CAP) {
      const prevBallX = m.ball.x;
      const prevBallY = m.ball.y;
      stepMatchRun(run);
      steps++;
      beginGkCatchGestures(m, gestures, prevBallX, prevBallY);
      const shootout = m.phase === 'shootout';
      const takerId = m.shootout === null ? -1 : m.shootout.takerId;
      for (let i = 0; i < m.players.length; i++) {
        const p = m.players[i];
        if (p.role === 'gk') continue;
        const progress = gestureProgress(gestures, p.id, m.stepCount);
        if (progress !== GESTURE_IDLE) outfieldGestures++;
        const parked = shootout && p.id !== takerId;
        // H12 del pre-vuelo (21-sep): se pasa la fracción real del gesto, SIN la puerta
        // de rol (`p.role === 'gk' ? progress : GESTURE_IDLE` que usaba el otro test de
        // este fichero) -- si no, outfieldDives solo podría ser > 0 con la función
        // gravemente rota, porque choosePlayerSprite jamás ve un progress !== GESTURE_IDLE
        // para un jugador de campo. Con la fracción real, outfieldDives === 0 depende de
        // que los gestos solo arranquen en porteros (comprobado por beginGkCatchGestures),
        // que es la garantía que este test dice dar.
        choosePlayerSprite(p, m.stepCount, shootout, parked, progress, gestures.dirX[p.id], gestures.dirY[p.id], choice);
        if (choice.pose === POSE_DIVE_0 || choice.pose === POSE_DIVE_1) outfieldDives++;
      }
    }
    expect(outfieldGestures).toBe(0);
    expect(outfieldDives).toBe(0);
  });
});
```

- [ ] **Step 2: Verla pasar… y demostrar que NO es vacua**

Ejecuta: `npx vitest run components/games/football-screen/view-pipeline.test.ts`
Con V15-1-1 y V15-1-3 ya en el árbol, **debería pasar a la primera** (2 tests). Por eso el rojo se provoca a mano, y es obligatorio:

1. Cambia `const keeperProgress = p.role === 'gk' ? progress : GESTURE_IDLE;` por `const keeperProgress = GESTURE_IDLE;` → esperado: **falla** en `expect(diveOpenSeen).toBeGreaterThan(0)` y `expect(diveFullSeen).toBeGreaterThan(0)`. **Deshaz.**
2. Cambia `octantSeen[choice.octant] = 1` por `octantSeen[0] = 1` → esperado: **falla** `expect(octants).toBe(OCTANT_COUNT)`. **Deshaz.**
3. Si con estas semillas `octants` sale menor que 8 **sin** sabotaje, **no rebajes la aserción**: la IA se mueve en ángulo continuo y en tres partidos completos tiene que mirar a las 8; investiga `facingOctant` antes de tocar nada más.

- [ ] **Step 3: Borrar `player-pose`**

```bash
rm components/games/football-screen/player-pose.ts components/games/football-screen/player-pose.test.ts
```

(En el working tree; **no** `git rm`. Paco lo recoge en su commit.)

- [ ] **Step 4: Cablear el componente — imports y constantes**

En `components/games/VaultWorldCupGame.tsx`:

1. **Borra** la línea `import { createDivePose, createPlayerPose, divePose, playerPose } from './football-screen/player-pose';`.
2. En el import de `./football-screen/gestures`, **quita** `diveReach` (queda `GESTURE_IDLE, beginGkCatchGestures, createGestureTimers, gestureProgress, resetGestures`).
3. En el import de `./football-logic/players` (`:14`, `import { PLAYER_RADIUS, isPlayerDown, isSprinting, type PlayerState } from './football-logic/players';`), **quita** `isPlayerDown` → queda `import { PLAYER_RADIUS, isSprinting, type PlayerState } from './football-logic/players';`. El único uso de `isPlayerDown` en el `.tsx` (el `const down = !shootout && isPlayerDown(p, match.stepCount);` de `drawPlayer`) lo borra el Step 6 al sustituir el cuerpo por el sprite (ahora `choosePlayerSprite`/`sprite-frame.ts` deciden el tumbado); dejar el import sin tocar deja un `eslint` `no-unused-vars` que hace fallar la compuerta del Step 7.
4. Añade, en orden alfabético entre los imports de `./football-screen/` (tras `./football-screen/sfx-map`):

```ts
import { SLIDE_TILT_COS, SLIDE_TILT_SIN, choosePlayerSprite, createSpriteChoice } from './football-screen/sprite-frame';
import {
  ATLAS_H, ATLAS_W, PLAYER_SPRITE_MAPS, SPRITE_HALF, SPRITE_SIZE, atlasCellX, atlasCellY, bakeSpriteAtlas,
  createSpritePalette, writeSpritePalette, type SpritePalette,
} from './football-screen/sprite-maps';
```

5. **Borra** de la paleta `const FACING_STICK = 'rgba(0,0,0,0.55)';` y el bloque:

```ts
// G11-1: the head has to read on top of all sixteen teams' kits, so it is a fixed
// tone with a light trim, not a team colour.
const HEAD_COLOR = '#23201d';
const HEAD_TRIM = 'rgba(255,255,255,0.55)';
```

6. **Sustituye** en los tamaños el bloque:

```ts
// G11-1: the width of the shoulder stroke, drawn perpendicular to facing.
const SHOULDER_WIDTH = 4;
```

por:

```ts
// V15-1 (G15-2 "sombra mínima"): a small ellipse under the sprite's feet, smaller than
// v1's body shadow, so the sprite and not the shadow is what reads.
const SPRITE_SHADOW_DY = 4;
const SPRITE_SHADOW_RX = 10;
const SPRITE_SHADOW_RY = 4;
```

7. Junto a `bakeGrassTile` (nivel de módulo, fuera del componente; la añadió V15-1-2), añade:

```ts
// V15-1: one 240 x 210 atlas canvas (octants across, poses down), created ONCE per
// mount and re-baked on the startMatch event -- never per frame (criterion 20).
function createAtlasCanvas(): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = ATLAS_W;
  el.height = ATLAS_H;
  return el;
}

function bakeAtlas(atlas: HTMLCanvasElement, palette: Readonly<SpritePalette>): void {
  const c = atlas.getContext('2d');
  if (c === null) return;
  c.clearRect(0, 0, atlas.width, atlas.height);
  bakeSpriteAtlas(PLAYER_SPRITE_MAPS, palette, (x, y, size, color) => {
    c.fillStyle = color;
    c.fillRect(x, y, size, size);
  });
}
```

- [ ] **Step 5: Cablear el componente — nitidez, atlas y `startMatch`**

1. Justo **después** de `const ctx = canvas.getContext('2d')!;` (línea existente, no es un `!` nuevo), añade:

```ts
    // V15-1: pixel art. Smoothing off for every drawImage/pattern of this canvas (the
    // sprites and the grass); drawPlayer also rounds its screen coordinates, or the
    // sprites shimmer while the camera glides.
    ctx.imageSmoothingEnabled = false;
```

2. **Sustituye** el bloque de preasignación:

```ts
    // Criterion 20: created ONCE, written in place by drawPlayer every frame.
    const gestures = createGestureTimers();
    const pose = createPlayerPose();
    const dive = createDivePose();
```

por:

```ts
    // Criterion 20: created ONCE, written in place by runStep/drawPlayer every frame.
    const gestures = createGestureTimers();
    const spriteChoice = createSpriteChoice();
    // V15-1 (G15-2): the three sprite atlases. The keeper's is baked once and for all
    // (G12-1: the same fluor green and black for the sixteen keepers); home and away
    // are re-baked by bakeMatchAtlases on every startMatch, from the RESOLVED kits.
    const spritePalette = createSpritePalette();
    const atlasHome = createAtlasCanvas();
    const atlasAway = createAtlasCanvas();
    const atlasKeeper = createAtlasCanvas();
    writeSpritePalette(spritePalette, GK_KIT_PRIMARY, GK_KIT_SECONDARY);
    bakeAtlas(atlasKeeper, spritePalette);
    bakeMatchAtlases();
```

3. **Justo antes** de `function teamOf(id: string): TeamDef {` (dentro del efecto), añade:

```ts
    // On an event (mount, startMatch), never per frame: paints the resolved kits of
    // the match -- the away side's inverted kit included when it clashes (QA 15-sep).
    function bakeMatchAtlases(): void {
      writeSpritePalette(spritePalette, matchKits[HOME].primary, matchKits[HOME].secondary);
      bakeAtlas(atlasHome, spritePalette);
      writeSpritePalette(spritePalette, matchKits[AWAY].primary, matchKits[AWAY].secondary);
      bakeAtlas(atlasAway, spritePalette);
    }
```

4. En `startMatch`, **justo después** de `matchKits = resolveMatchKits(home.kit, away.kit);`, añade:

```ts
      bakeMatchAtlases();
```

- [ ] **Step 6: Cablear el componente — `drawPlayer`**

1. **Sustituye** el comentario que precede a `drawPlayer` (desde `// The parked fifteen of the shootout must be drawn STANDING AND STILL (stage B2` hasta `//     being taken by a man lying flat.`) por:

```ts
    // V15-1 (G15-2 + G15-3): every player is ONE sprite from the atlas of its side --
    // run/idle frames, its own lying-down frame, the keeper's two dive frames, a slide
    // drawn as the run sprite tilted -- chosen by sprite-frame.ts's choosePlayerSprite.
    // The direction stick, the head and shoulders of G11-1 and the dive capsule are
    // gone (G15-3); the shadow, the step-8 goal celebration arcs, the cursor, the
    // charge notches and the sprint ring stay vector, on top of the sprite.
    //
    // The shootout exclusions of stage B2 §8 live in choosePlayerSprite now:
    //   · `parked` — the fifteen in the centre circle stand still, whatever slide,
    //     floor or charge fields the engine left on them.
    //   · nobody is drawn lying down or sliding during the shootout, THE TAKER
    //     INCLUDED (B2 report, Minor 2; probe P6(1)).
```

2. **Sustituye** el cuerpo de `drawPlayer` desde su primera línea hasta el final del bloque del palito — es decir, desde `const match = run.match;` hasta el `}` que cierra `if (!down && !parked) { ... FACING_STICK ... }` — por:

```ts
      const match = run.match;
      if (!isOnScreen(cam, p.x, p.y, PLAYER_RADIUS * 3)) return;
      const x = toScreenX(cam, p.x);
      const y = toScreenY(cam, p.y);
      const shootout = match.phase === 'shootout';
      const parked = shootout && p.id !== (match.shootout?.takerId ?? -1) && p.role !== 'gk';

      ctx.fillStyle = SHADOW;
      ctx.beginPath();
      ctx.ellipse(x, y + SPRITE_SHADOW_DY, SPRITE_SHADOW_RX, SPRITE_SHADOW_RY, 0, 0, Math.PI * 2);
      ctx.fill();

      // G11-2 still drives the dive: a SCREEN timer started by 'gk-catch'. G15-3 turns
      // it into two sprite frames chosen by the fraction of the gesture, pointed where
      // the gesture stored (the ball one step before the catch).
      const gesture = p.role === 'gk' ? gestureProgress(gestures, p.id, match.stepCount) : GESTURE_IDLE;
      choosePlayerSprite(
        p, match.stepCount, shootout, parked, gesture, gestures.dirX[p.id], gestures.dirY[p.id], spriteChoice,
      );
      // G12-1: the keeper ALWAYS paints from the reserved atlas, never its team's.
      const atlas = p.role === 'gk' ? atlasKeeper : p.team === HOME ? atlasHome : atlasAway;
      const sx = atlasCellX(spriteChoice.octant);
      const sy = atlasCellY(spriteChoice.pose);
      // Whole pixels, or the pixel art shimmers while the camera glides.
      const px = Math.round(x);
      const py = Math.round(y);
      if (spriteChoice.tilt === 0) {
        ctx.drawImage(atlas, sx, sy, SPRITE_SIZE, SPRITE_SIZE, px - SPRITE_HALF, py - SPRITE_HALF, SPRITE_SIZE, SPRITE_SIZE);
      } else {
        // G15-3: the slide is the run sprite tilted. cos/sin were computed once at
        // module load; the transform is undone on the very next line.
        const s = SLIDE_TILT_SIN * spriteChoice.tilt;
        ctx.setTransform(SLIDE_TILT_COS, s, -s, SLIDE_TILT_COS, px, py);
        ctx.drawImage(atlas, sx, sy, SPRITE_SIZE, SPRITE_SIZE, -SPRITE_HALF, -SPRITE_HALF, SPRITE_SIZE, SPRITE_SIZE);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
```

3. **No toques nada más de `drawPlayer`**: el bloque `if (match.phase === 'goal' && match.lastGoalTeam >= 0)` (arcos), `if (cursor)` (triángulo + muescas) y `if (isSprinting(p))` (aro) se quedan exactamente como están, **después** del sprite.

- [ ] **Step 7: Verificación completa**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/view-pipeline.test.ts components/games/VaultWorldCupGame.tsx
git diff --stat 478fc93 -- components/games/football-logic/
grep -rnw "player-pose\|playerPose\|divePose\|createPlayerPose\|createDivePose" components/games/football-screen components/games/VaultWorldCupGame.tsx app/
grep -n "FACING_STICK\|HEAD_COLOR\|HEAD_TRIM\|SHOULDER_WIDTH\|diveReach\|isPlayerDown" components/games/VaultWorldCupGame.tsx
grep -n "createAtlasCanvas()\|bakeMatchAtlases()\|bakeAtlas(\|imageSmoothingEnabled" components/games/VaultWorldCupGame.tsx
grep -n "drawImage\|setTransform" components/games/VaultWorldCupGame.tsx
ls components/games/football-screen/player-pose.ts 2>&1
```
Esperado:
- **1291 tests / 77 ficheros** verdes (con V15-1-1, V15-1-2 y V15-1-3 ya en el árbol: 1304 − 13 del test borrado; 78 − 1), `tsc` y `eslint` sin salida, `git diff` del motor **vacío**.
- Los dos primeros `grep` **vacíos**.
- El tercero: `imageSmoothingEnabled` **1** vez (tras `getContext`); `createAtlasCanvas()` **3** usos en la preasignación + la declaración; `bakeMatchAtlases()` **2** llamadas (preasignación y `startMatch`) + la declaración; `bakeAtlas(` en la declaración, en la preasignación del portero y dentro de `bakeMatchAtlases` — **ninguna** línea dentro de `drawPlayer`, `drawPitch` ni `draw`.
- El cuarto: `drawImage` **3** líneas — 2 llamadas reales en `drawPlayer` + 1 mención en el comentario del Step 5.1 («Smoothing off for every drawImage/pattern…»); `setTransform` **4** líneas: 2 en `drawPitch` (césped) y 2 en `drawPlayer` (deslizamiento), cada `setTransform` con desplazamiento seguido de su `setTransform(1, 0, 0, 1, 0, 0)`.
- `ls` → `No such file or directory`.

- [ ] **Step 8: Anotar en el ledger**

`V15-1-4 hecha: drawPlayer por sprite (atlas local/visitante/portero, horneado en startMatch), fuera palito/cabeza/hombros/cápsula, player-pose.ts + test BORRADOS (-13), view-pipeline reescrita (2 tests, 8 octantes y 2 fotogramas de estirada vistos). Suite 1291/77. Motor intacto. Controles negativos aplicados y deshechos. Working tree verificado; commit lo hace Paco.`

- [ ] **Step 9: Dejar el working tree verificado; commit lo hace Paco**

No ejecutes `git add`, `git rm` ni `git commit`.

---

### Task V15-1-5 (cierre): verificación del paso, lista de QA de Paco y mensaje de commit

**Files:**
- Modify: `.superpowers/sdd/2026-09-21-vault-world-cup-v15-1/progress.md`
- Create: `.superpowers/sdd/2026-09-21-vault-world-cup-v15-1/qa-paco.md`
- Ningún fichero de código se toca en esta tarea. Si al verificar aparece un fallo, **se arregla en la tarea que lo introdujo**, no aquí.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la lista con la que Paco hace el QA jugado (G15-15: «QA jugado al final de cada uno») y el mensaje de commit del paso.

- [ ] **Step 1: Verificación completa del paso**

```bash
npx vitest run
npx tsc --noEmit
npx eslint components/games/football-screen/ components/games/VaultWorldCupGame.tsx
```
Esperado: **1291 tests en 77 ficheros verdes** (1268 + 13 + 8 + 15 − 13; 75 + 3 − 1), `tsc` sin salida, `eslint` sin salida.

- [ ] **Step 2: Las compuertas de las Global Constraints**

```bash
git diff --stat 478fc93 -- components/games/football-logic/
grep -rn "Math.random" components/games/football-screen/
grep -rn "@/" components/games/football-screen/sprite-maps.ts components/games/football-screen/sprite-frame.ts components/games/football-screen/grass.ts
grep -rn "React\|document\.\|window\.\|new Audio" components/games/football-screen/sprite-maps.ts components/games/football-screen/sprite-frame.ts components/games/football-screen/grass.ts
grep -rn " as " components/games/football-screen/sprite-maps.ts components/games/football-screen/sprite-frame.ts components/games/football-screen/grass.ts
find .superpowers -name "*.ts" -o -name "*.tsx"
```
Esperado: los **seis vacíos**. El primero es el que importa: el motor sigue exactamente como lo dejó `478fc93`.

- [ ] **Step 3: Repasar el diff entero con ojos de revisor**

```bash
git status --short
git diff --stat 478fc93
git diff 478fc93 -- components/games/VaultWorldCupGame.tsx
```
Comprueba, una por una:
1. `git status` muestra: 6 ficheros nuevos en `football-screen/` (`sprite-maps`, `sprite-frame`, `grass`, cada uno con su `.test.ts`), 2 borrados (`player-pose.ts`, `player-pose.test.ts`), 2 modificados (`VaultWorldCupGame.tsx`, `view-pipeline.test.ts`), el plan y el ledger. Nada más.
2. En `drawPitch`, `drawPlayer` y `draw()` no hay `document.createElement`, `createPattern`, `getContext`, literales de objeto/array, plantillas de string, `.map(`, ni `=>`.
3. En `drawPlayer` siguen, intactos y **después** del sprite: arcos de celebración, triángulo del cursor, muescas de carga, aro de sprint. No queda palito.
4. El portero siempre sale de `atlasKeeper` (G12-1), también en el ENTRENAMIENTO y la tanda.
5. Cada `ctx.setTransform` con desplazamiento va seguido, en la línea de dibujo siguiente, de `ctx.setTransform(1, 0, 0, 1, 0, 0)`.

- [ ] **Step 4: Escribir la lista de QA de Paco**

Crea `.superpowers/sdd/2026-09-21-vault-world-cup-v15-1/qa-paco.md` con exactamente esto:

```markdown
# QA jugado — V15-1 «Aspecto» (v1.5)

Catorce puntos, en orden de importancia. ENTRENAMIENTO para los seis primeros (sin reloj,
se puede girar al jugador en círculo), un amistoso y un partido con tanda para el resto.
Ten abierta `references/vault-world-cup-tehkan.png` al lado.

1. **Se parece a la referencia.** Jugadores pequeños (~30 px) con pelo, camiseta del kit
   y piernas; césped lima a bandas con moteado. ¿Da el aire de Tehkan?
2. **Ocho direcciones.** Gira en círculo con la cruceta: la cabeza va siempre delante y
   las diagonales (NE, SE, SO, NO) se distinguen de los ejes. Los mapas N/NE/E son
   literales editables en `sprite-maps.ts`: si una dirección no te convence, dilo y se
   retoca a mano.
3. **Piernas animadas.** Al correr se ven las zancadas; al esprintar el ciclo va más
   rápido; parado, quieto. ¿El ritmo (6 pasos por fotograma, 4 al esprintar) te vale?
4. **Sin palito de dirección (G15-3).** ¿Se entiende hacia dónde mira el jugador antes
   de pasar, solo con el sprite?
5. **Portero verde flúor en TODAS las poses (G12-1)**, de pie, corriendo y en la
   estirada, en los dos equipos, también contra BRASIL/MÉXICO/PORTUGAL (verdes).
6. **Estirada del portero (G15-3):** 2 fotogramas hacia el balón. Ya no hay cápsula
   alargada: el sprite mide lo mismo que de pie. ¿Se lee la parada? Si se queda corta,
   la palanca es desplazar el sprite en la dirección del gesto (cambio de pantalla).
7. **Entrada al suelo = sprite de carrera inclinado (~26°).** ¿Se lee como
   deslizamiento? ¿El sentido del giro te parece bien a izquierda y a derecha?
8. **Tumbado** tras una falta o una entrada fallida: sprite propio, en la dirección en
   que miraba.
9. **Tanda de penaltis:** los quince aparcados, de pie y quietos; el lanzador nunca
   tumbado; los porteros se estiran.
10. **Césped:** dos verdes lima, bandas de 48 u, moteado ~12 %. ¿Se nota la repetición de
    la baldosa (cada 96 px)? ¿Las líneas blancas (opacidad 0,75) se leen sobre lima? ¿Las
    camisetas blancas (ALEMANIA, INGLATERRA, EE. UU.) se confunden con las líneas?
11. **Nitidez:** con la cámara en movimiento, ¿los sprites tiemblan o se ven borrosos?
    Si tienes pantalla retina, prueba en DevTools a añadir `image-rendering: pixelated`
    al `<canvas>` y compara (afecta también al texto del HUD). Decisión tuya: no está
    puesto.
12. **Capas vectoriales que se quedan:** el triángulo del cursor, las muescas de carga y
    el aro de sprint encajan con un sprite de 30 px (antes el cuerpo era de 24). Los
    arcos de celebración de gol siguen (el abrazo es V15-5).
13. **Líneas del campo:** las áreas de la portería derecha tienen el mismo grosor que las
    de la izquierda (lineWidth explícito), y la red y el marco de las porterías siguen
    igual.
14. **Rendimiento:** un VER x4 de un cruce de CPU del Mundial va fluido, y un partido
    completo no da tirones.
```

- [ ] **Step 5: Cerrar el ledger**

Añade a `.superpowers/sdd/2026-09-21-vault-world-cup-v15-1/progress.md`:

```
V15-1 COMPLETO en código: 1291 tests / 77 ficheros verdes, tsc y eslint limpios, motor intacto desde 478fc93 (git diff vacío). G15-2 (sprites 8 direcciones horneados por partido, césped lima moteado) y G15-3 (capas; palito fuera; player-pose borrado entero) implementados; lineWidth explícito (brief §8). Lista de QA en qa-paco.md. Pendiente: commit de Paco + QA jugado.
```

- [ ] **Step 6: Resueltas por Paco (lista, no cambios)**

Añade a `progress.md` bajo el encabezado `## Resueltas por Paco (21-sep, antes del pre-vuelo)` las 6 resoluciones (H4 del pre-vuelo: ya no son dudas abiertas, se registran como decididas):
1. **Base de compuertas:** `478fc93` (docs sobre `9a1d3d6`; mismo código).
2. **`image-rendering: pixelated`:** NO se añade en V15-1; se mira en el QA (punto 11).
3. **Pelo y piel:** iguales para los 18 jugadores (un solo `SPRITE_HAIR`/`SPRITE_SKIN`) en la v1.5. G15-2 pide pelo, no variedad; variar por id sería otra paleta por jugador o más atlas.
4. **Estirada del portero:** sin desplazamiento hacia el balón en V15-1; se valora en el QA (punto 6).
5. **Deslizamiento:** `SLIDE_TILT_RAD = 0.45` inclinado hacia donde va el jugador (signo de `tackleDirX`); se valora en el QA (punto 7).
6. **Mapas E/NE derivados de N:** se valida su legibilidad a 30 px en el QA (puntos 1-2).

Bajo `## Dudas abiertas para Paco`: `ninguna.` Bajo `## Peticiones separadas al motor`: `ninguna.` — el hueco vacío también es información.

- [ ] **Step 7: Proponer el commit del paso — NO ejecutes `git add` ni `git commit`**

Mensaje único para Paco:

```
feat(world-cup): v1.5 aspect — baked top-down pixel-art sprites, lime mown grass, no facing stick (V15-1, G15-2/G15-3)
```

Recuérdale que el commit incluye dos **borrados** (`player-pose.ts` y su test) que hay que añadir con `git add -A components/games/football-screen/` o equivalente, y que el plan (`docs/superpowers/plans/2026-09-17-vault-world-cup-v15-1-aspect.md`) está **modificado** (trackeado desde `478fc93`) y el ledger **sin trackear**: es suyo decidir si entran en el mismo commit.

---

## Self-review (ejecutada al escribir el plan, 17-sep)

**1. Cobertura del spec.**
- **G15-2** — sprites horneados por dirección → V15-1-1 (`bakeSpriteAtlas`) + V15-1-4 (atlas en el `.tsx`); 3 a mano N/NE/E + rotación/espejo = 8 → V15-1-1 (`HAND_*`, `rotateMapCW`, `mirrorMapX`, `buildPlayerSpriteMaps`, test de dirección de la cabeza en 56 celdas); estilo `KongGame.tsx` → mapas de caracteres + horneado una vez; 3 fotogramas carrera + quieto + tumbado → `POSE_RUN_0..2`, `POSE_IDLE`, `POSE_DOWN` (V15-1-1) y su selección (V15-1-3); paleta por partido → `writeSpritePalette` + `bakeMatchAtlases` en `startMatch` con `resolveMatchKits` (V15-1-4); ~28-32 px con radio intacto → `SPRITE_SIZE = 30` + test que fija `PLAYER_RADIUS === 12`; pelo, camiseta con kit, piernas animadas → tests «always draws hair, a kit shirt…» y «animates the legs»; sombra mínima → `SPRITE_SHADOW_*` (V15-1-4); césped de dos verdes en bandas tipo corte → V15-1-2 (`grass.ts` + patrón), con moteado determinista (hash entero, test de reproducibilidad). Octante sin trigonometría y fotograma desde `stepCount`/`id`/velocidad → V15-1-3. `imageSmoothingEnabled = false` y redondeo → V15-1-4 Step 5-6; `image-rendering: pixelated` comprobado (no se amplía por CSS en escritorio) y resuelto por Paco (21-sep): no se añade, se mira en el QA (punto 11).
- **G15-3** — carrera/quieto, tumbado propio → V15-1-3 prioridades 3 y 5; deslizamiento = carrera inclinada → prioridad 4 + `setTransform` en V15-1-4; estirada GK 2 fotogramas por la fracción del gesto → `diveSpritePose` (V15-1-3) + test 0→1→0; cursor, muescas y aro vectoriales → V15-1-4 Step 6.3 (intactos); palito fuera → V15-1-4 Step 4.4 y 6.2 + grep; `player-pose.ts` + tests borrados → V15-1-4 Step 3, con la decisión razonada en Global Constraints (nada que rescatar para la estirada). La celebración de v1 se queda → V15-1-4 Step 6.3.
- **G12-1** — verde flúor en todas las poses → atlas de portero único + test «bakes the reserved keeper green into every pose of every octant».
- **Brief §8** — `lineWidth` explícito → V15-1-2 Step 7 + grep de 2 líneas.
- **Criterios 1/2** → motor intacto (gate por tarea), sin `Math.random`, sonda con partido de control en V15-1-4. **Criterio 20** → Global Constraints + diseño (atlas/patrón/elección preasignados) + greps de V15-1-2/4 y revisión de V15-1-5. **Criterio 21** → 1268 medidos hoy → 1291 objetivo.
- Fuera de alcance respetado: motor, mandos, selecciones, abrazo, red que ondula, nombres/dorsales. **Sin huecos.**

**2. Placeholders.** Ningún «TBD»/«similar a la Task N»; los 21 mapas están escritos enteros; todo test y todo cambio del `.tsx` lleva su código. Los valores esperados de fotograma de los tests de V15-1-3 están calculados a mano en comentario (p. ej. id 1 en el paso 0 → `RUN_0`).

**3. Consistencia de nombres.** `POSE_*`/`OCTANT_*`/`SPRITE_SIZE`/`SPRITE_HALF`/`ATLAS_W`/`ATLAS_H`/`atlasCellX`/`atlasCellY` se declaran en V15-1-1 y se consumen con esos nombres en V15-1-3, V15-1-4 y la sonda. `choosePlayerSprite(p, stepCount, shootout, parked, diveProgress, diveDirX, diveDirY, out)` tiene la misma firma y orden en su test, en `drawPlayer` y en los dos tests de la sonda. `SpriteChoice.tilt` es `-1 | 0 | 1` en V15-1-3 y se compara con `=== 0` y se multiplica en V15-1-4. `grassTileOffset(camera, tile)` y `GRASS_TILE_W/H` coinciden entre `grass.test.ts` y `drawPitch`. `bakeAtlas`/`createAtlasCanvas`/`bakeMatchAtlases` (V15-1-4) y `bakeGrassTile` (V15-1-2) solo existen en el `.tsx`. `GESTURE_IDLE`, `gestureProgress`, `DIVE_REACH_MAX`, `diveReach`, `DIVE_PEAK`, `GK_DIVE_STEPS` son los exports reales de `gestures.ts` (medidos con grep).

**Riesgo que el plan NO cierra y que solo cierra el QA de Paco:** la legibilidad del pixel-art a 30 px (mapas E/NE partidos de giro/cizallado de N), el contraste de líneas blancas y camisetas blancas sobre lima, y la nitidez en pantallas retina. Están en `qa-paco.md` (puntos 1, 2, 10 y 11); las decisiones de diseño que no son de código ya las resolvió Paco el 21-sep (ver «Resoluciones de Paco» y el Step 6 de V15-1-5) y se validan en ese mismo QA, no quedan como dudas abiertas.

## Resoluciones de Paco (21-sep, antes del pre-vuelo)

- **Base de compuertas:** `478fc93` (docs sobre `9a1d3d6`; mismo código). Sustituido en todo el plan.
- **`image-rendering: pixelated`:** NO se añade en V15-1; se mira en el QA (punto 11).
- **Pelo y piel:** iguales para los 18 jugadores en la v1.5.
- **Estirada del portero:** sin desplazamiento hacia el balón en V15-1; se valora en el QA (punto 6).
- **Deslizamiento:** `SLIDE_TILT_RAD = 0.45` inclinado hacia donde va el jugador (signo de `tackleDirX`).
- **Mapas E/NE derivados de N:** se valida su legibilidad a 30 px en el QA.
→ El Step 6 de V15-1-5 registra estas como «resueltas por Paco 21-sep», no como dudas abiertas.
