# SPEC 28 — Integración del juego BUBBLE (Puzzle Bobble / Bust-a-Move)

> **Estado:** Draft (pendiente de grill)
> **Depende de:** 12-frogger-performance, 20-auth-gate-play, 21-background-music,
> 24-games-registry-credits-f2, 26-kong, 27-kong-v15
> **Fecha:** 2026-08-28
> **Objetivo:** Integrar BUBBLE con ID `bubble` (juego nº12, categoría `PUZZLE`,
> color `magenta`) como bubble-shooter clásico: un cañón abajo dispara burbujas
> contra una masa hexagonal colgada del techo, agrupar **3 o más del mismo color**
> las revienta y todo lo que quede desconectado del techo **cae**. **8 mapas** de
> dificultad creciente, **4 magias** (una por cada pareja de mapas) y **pantalla
> de VICTORIA** al superar el mapa 8 — el segundo juego terminable del Vault,
> mismo patrón que Kong v1.5 (spec 27). Música propia
> (`/bubble-theme.mp3`, patrón `setTrackOverride`).

---

## Scope

**In:**

- **Migración Supabase**: fila `bubble` en `games` (`cat: 'PUZZLE'`,
  `color: 'magenta'`, cover **`/covers/bubble.png` directo**). El PNG YA ESTA
  en el repo (Paco lo coloco el 28-ago), asi que NO hay clase CSS provisional
  ni segunda migracion UPDATE — regla del proyecto: si el PNG existe al hacer
  el INSERT, va directo. (Esto sustituye al patron `pacman` /
  `space-invaders` / `karate-champ`).
- **Entrada nº12 en `lib/games-registry.ts`** + `GameId` union a 12 entradas:
  skins `CLASSIC_SKINS` (classic base / retro / neon), keyMap
  `{ left:'ArrowLeft', right:'ArrowRight', a:' ', b:'ArrowDown' }` con
  `a: 'DISPARAR'` y `b: 'CAMBIAR'`, instrucciones (goal >20 chars + tips),
  `realtime: true`.
- **Actualización de `lib/games-registry.test.ts` en el MISMO commit**: lista de
  ids a 12, lista de realtime a 7, assert de `getSkinOptions('bubble')` y test
  propio de keyMap/labels de Bubble.
- **Lógica pura en `components/games/bubble-logic/` con tests vitest** (TDD, antes
  del componente):
  - `grid.ts` — geometría hexagonal: `COLS`, `ROWS`, `idx`, `rowShifted`,
    `neighbors` (2 tablas de 6 offsets por paridad), `cellX`/`cellY`,
    `pixelToCell` (out-params), `dropCeiling`.
  - `shot.ts` — `fire(angle)`, avance por sub-pasos, rebote de paredes,
    `firstHit` (≤7 tests), `anchor`, `traceShot` (preview hasta el 1er rebote).
  - `match.ts` — `findGroup` (flood fill ≥3) y `findFloating` (BFS desde la
    fila 0), ambos con pila preasignada y `visited` sellado por generación.
  - `maps.ts` — los 8 layouts como arrays de strings, `parseMap`, `MAPS`,
    `configFor(map)` clampado (patrón `configFor` de `kong-logic/level.ts`).
  - `magic.ts` — las 4 magias como funciones puras sobre `Board`.
  - `scoring.ts` — puntuación de pop, cascada, magia, mapa y victoria.
- `components/games/BubbleGame.tsx` — `"use client"`, `React.memo`, canvas
  600×700, props del patrón del registro (`paused`, `muted?`, `skinKey?`,
  `onScoreChange`, `onLivesChange`, `onLevelChange` = mapa 1-8, `onGameOver`),
  sprites pixel horneados por skin, tablero horneado en canvas offscreen,
  cero allocations en el loop (spec 12), HUD lateral in-canvas.
- `app/games/bubble/play/page.tsx` — espejo de `app/games/kong/play/page.tsx`
  (`dynamic(ssr:false)`, `useGameSkin`, `getKeyMap`, refs + escritura directa al
  DOM, `heartsMarkup`, mute `av_sfx_muted`, overlay "?", `MobileGamepad`, modal
  game-over con `saveScore`, CRT `aspectRatio: '6 / 7'`) + **modal de VICTORIA
  propio** + `setTrackOverride('/bubble-theme.mp3')` en mount / `null` en cleanup.
- `lib/sfx-bubble.ts` + test — SFX procedurales WebAudio, clase con
  `AudioContext` perezoso, `masterGain = 0.4`, singleton exportado.
- `references/implemented-games.md` — añadir `bubble` **y** las dos filas que hoy
  faltan (`karate-champ`, `kong`).
- Cadena: implementación → `@skin-designer` (retro/neon) → `@mobile-porter` →
  `verify-plan` → QA de Paco. (Cover y musica ya estan en el repo.)

**Fuera de alcance:**

- **Bubble Bobble** (el de plataformas con dinosaurios). Este juego es
  Puzzle Bobble / Bust-a-Move. No se implementa ninguna mecánica de plataformas.
- Modo endless / supervivencia tras el mapa 8, modo VS contra CPU, editor de
  mapas, mapas 9+.
- Más de 4 magias, magias combinables, o magias que se acumulen en inventario.
- Cambios en `lib/supabase/types.ts` (`'PUZZLE'` ya existe en la union).
- `app/games/bubble/page.tsx`: la ficha la sirve la ruta dinámica
  `app/games/[id]/page.tsx` leyendo de Supabase (Kong solo tiene `play/`).
- Archivos de audio nuevos: `bubble-theme.mp3` ya está; los SFX son procedurales.
- El bug responsive de las play-pages (A.2) y los 44 lints de React 19: son
  transversales y van por su cuenta.
- El arreglo global de "teclas pegadas al perder el foco" — Bubble sí trae su
  listener de `blur` local (ver Diseño), pero no se toca el resto de juegos.

---

## Diseño

### Marco del canvas y reparto del ancho

Se reutiliza el marco de Kong sin tocar CSS: `CANVAS_W = 600`, `CANVAS_H = 700`,
CRT `aspectRatio: '6 / 7'`.

```
CANVAS_W = 600
PLAY_W   = 420   campo de juego,  x ∈ [0, 420]
HUD_W    = 180   panel lateral,   x ∈ [420, 600]  (MAPA / PUNTOS / RÉCORD / techo)
```

`PLAY_W = 420` no es arbitrario: en malla hexagonal con filas alternas la anchura
del campo debe ser `COLS·D + R` para que las filas pares peguen a la pared
izquierda y las impares a la derecha. Con `COLS = 10` y `D = 40`: `10·40 + 20 = 420`.

| Constante | Valor | Nota |
|---|---|---|
| `D` (diámetro burbuja) | 40 px | `R = 20` |
| `COLS` | 10 | en **todas** las filas |
| `ROWS` | 15 | índices 0..14 |
| `ROW_H` | `R·√3 = 34.6410161…` | |
| `ROOF_Y` | 24 | cara inferior de la barra de techo |
| `DEATH_ROW` | 14 | centro y = 528,97; borde inferior 548,97 |
| `DEATH_LINE_Y` | 550 | línea discontinua dibujada |
| `CANNON` | (210, 620) | 210 = `PLAY_W/2`; 70 px de aire bajo la línea |
| Capacidad | 150 celdas | 15 × 10 |

Encaje vertical: centro de la fila `r` = `44 + 34,641·r`. Fila 0 → 44 (borde
superior 24 = `ROOF_Y`). Fila 14 → 528,97 (borde inferior 548,97 < 550).

### Cuadrícula, paridad y vecindades

Dos `Uint8Array(150)` planos (color y magia) creados **una vez**, más un `parity`
global 0|1. Todas las filas guardan 10 celdas: es la decisión clave del modelo,
porque permite bajar el techo con un `copyWithin` de una fila + toggle de `parity`
sin perder ninguna burbuja ni redimensionar nada.

La paridad efectiva de la fila `r` es `(r + parity) & 1`: `0` = pegada a la
izquierda, `1` = desplazada +20 px. Las 6 vecindades salen de dos tablas
constantes de módulo:

```
NB_FLUSH   = [0,-1] [0,+1] [-1,-1] [-1,0] [+1,-1] [+1,0]   // fila NO desplazada
NB_SHIFTED = [0,-1] [0,+1] [-1, 0] [-1,+1] [+1, 0] [+1,+1] // fila desplazada
```

Derivación: con `x_flush(c) = 20 + 40c` y `x_shift(c) = 40 + 40c`, desde una celda
no desplazada las de la fila contigua a 20 px en X están en `x_shift(c-1)` y
`x_shift(c)` → `dc ∈ {-1, 0}`; desde una desplazada, `x_flush(c)` y `x_flush(c+1)`
→ `dc ∈ {0, +1}`. `neighbors()` escribe en un `Int16Array(6)` de módulo y devuelve
cuántos ha escrito: no aloca.

**Bajada del techo** (`dropCeiling`): si hay algo en la última fila → mapa perdido;
si no, `copyWithin` de una fila hacia abajo en ambos arrays, `fill(0)` de la fila 0,
siembra de la nueva fila 0 con colores vivos, y **toggle de `parity`** (es lo que
desplaza la masa ±20 px, como la recreativa).

### Disparo, rebote y anclaje

| Constante | Valor |
|---|---|
| `SHOT_SPEED` | 1000 px/s (≈0,58 s del cañón al techo) |
| `SUBSTEP_MAX` | 8 px por sub-paso |
| `MAX_BOUNCES` | 12 |
| `ANGLE_MIN` / `ANGLE_MAX` | 12° / 168° medidos desde +x |
| `AIM_SPEED` | 75 °/s manteniendo ← / → |

El proyectil vive en **escalares del closure** (`px, py, vx, vy, pColor, pMagic`),
nunca un objeto por disparo. Por frame:
`n = max(1, ceil(SHOT_SPEED·dt / SUBSTEP_MAX))` con `dt` ya capado a 50 ms → `n ≤ 7`.

En cada sub-paso, por orden: (a) rebote de pared reflejando **posición y
velocidad** (`px = 2R − px` / `px = 2(PLAY_W−R) − px`), abortando con anclaje
forzoso si `bounce > MAX_BOUNCES`; (b) techo → anclar en fila 0; (c) colisión.

`firstHit(px, py)` **no recorre las 150 celdas**: calcula `(r,c)` con
`pixelToCell` y prueba esa celda y sus 6 vecinas contra `(2R)² = 1600`. ≤7
comparaciones por sub-paso, ≤49 por frame en el peor caso.

`anchor(px, py, hit)`: candidatos = celda bajo `(px,py)` ∪ 6 vecinas de `hit`,
filtrados por "en rango y libre", elegido el de menor distancia² al centro; si no
queda ninguno se busca en el anillo 2. Invariantes testeados: la celda elegida
**estaba libre** y **es vecina de una ocupada o está en la fila 0**.

Preview de apuntado: `traceShot(board, angle, outPts)` es la misma función en
fast-forward, devolviendo la polilínea hasta el **primer rebote** (≈8 puntos).

### Orden de resolución de un disparo (no negociable)

```
anclar
  → findGroup (una sola llamada, start = celda anclada)
      < 3 : fin, contador de techo++
      ≥ 3 : pop → magia (si la había) → findFloating → caída
            → ¿tablero vacío?              → mapa superado
            → ¿ocupada en fila ≥ DEATH_ROW? → vida perdida
            → rehornear el canvas del tablero (UNA vez)
```

`findFloating` siembra **solo desde la fila 0** (el techo es la fila 0, no una
coordenada en píxeles). Las colgadas **no explotan: caen** — pool preasignado
`FALL_POOL = 64` con `x, y, vy, color, active`, gravedad 1400 px/s² (mismo valor
que `GRAVITY` en `kong-logic/player.ts`), desactivadas al salir del canvas.
Puntúan al desprenderse, no al tocar el suelo.

Semántica cerrada: una burbuja con magia que **cae** como colgada **no detona**.
Solo detona si formaba parte del grupo reventado.

### Las 4 magias

Reglas comunes a las cuatro:

- La burbuja mágica **tiene color normal** y hay que reventarla dentro de un grupo
  de ≥3 como cualquier otra. La magia es un extra, no una vía alternativa.
- Hay **exactamente una por mapa**, colocada a mano en el layout.
- Se dibuja con un glifo/anillo sobre el sprite base (4 glifos × 3 skins, horneados
  una sola vez).
- Detona **después** del pop y **antes** de `findFloating`, para que sus huecos
  generen colgadas.
- Ninguna introduce un subsistema nuevo: todas se implementan sobre `neighbors()`
  y los dos arrays existentes.

Las 4 magias y su reparto por mapas (cerrado, ver Decisions):

| Magia | Qué hace | Coste de implementación |
|---|---|---|
| **BOMBA** | Revienta 2 anillos: las 6 vecinas + las 12 del anillo 2 (18 celdas además de la propia). | Barata. Dos tablas constantes de 18 offsets `(dr,dc)` (una por paridad) con recorte de bordes. ~20 líneas + test de simetría. |
| **RAYO** | Revienta la **fila entera** en la que estaba la burbuja mágica. | La más barata. `for (c = 0..9) color[idx(r,c)] = 0`. 4 líneas + test. |
| **PURGA DE COLOR** | Elimina del tablero **todas** las burbujas del color de la mágica. | Media. Barrido de 150 celdas trivial; el coste está en el balance (puede vaciar medio mapa), en la animación escalonada de ~30 burbujas y en que **cambia la bolsa de colores de golpe** (hay que recalcularla después). |
| **ANCLA** | Congela la bajada del techo durante los **4 disparos siguientes**, con cuenta atrás en el HUD. | Media/cara. La única con **estado persistente entre disparos**: vive en `GameState`, se resetea al perder vida y al reiniciar mapa, se pinta en el HUD e **interactúa con la condición de derrota**. Las otras tres son puras y se agotan en el mismo tick. |

**Orden cerrado (Paco, 2026-08-28):** `1-2 Bomba · 3-4 Rayo · 5-6 Purga · 7-8 Ancla`.

- **Bomba en 1-2** es lo importante: es la única de las cuatro cuyo efecto se
  entiende **sin leer nada** — abre un boquete redondo justo donde has disparado.
  El Rayo es marginalmente más barato de codificar, pero como primera magia enseña
  peor: parece un fallo, "se ha borrado una fila". En los mapas 1-2 (5-6 filas,
  3 colores, bloque casi macizo) la bomba además es espectacular sin desbalancear.
- **Rayo en 3-4**: ahí ya hay columnas colgando; un corte horizontal limpio provoca
  la primera cascada grande y enseña la mecánica de desprendimiento, que es la que
  más puntúa el resto del juego.
- **Purga en 5-6**: son los primeros mapas con 5 colores. Con 3 colores la purga
  sería un botón de "ganar"; con 5 es una decisión táctica.
- **Ancla en 7-8**: ahí el techo baja cada 5-6 disparos y es la amenaza real. Una
  magia que compra oxígeno es el clímax natural y hace que el jugador la busque en
  vez de reventarla de rebote.

**Descartada para el slot D: ráfaga doble** (los próximos 3 disparos salen con dos
burbujas). Rompe la invariante de "un solo proyectil en vuelo", que es lo que
permite tener el proyectil en escalares del closure. Coste desproporcionado.

### Progresión de los 8 mapas

Ejes que **no** varían (reducen superficie de bugs): velocidad del disparo,
geometría de la malla, vidas (3), umbral de grupo (3), ángulos.

Fin del juego: superar el mapa 8 → **pantalla de VICTORIA** propia (no el modal de
game over) con la puntuación final guardable. Perder las 3 vidas → game over
normal, y la siguiente partida empieza en el mapa 1 con 0 puntos. Perder **una**
vida → el mapa actual se reinicia desde su layout inicial **conservando la
puntuación**.

### La bolsa de colores

`pickNext()` sortea **solo entre los colores presentes en el tablero**. Si no, en
el mapa 7 (6 colores) el jugador recibe burbujas de un color extinguido y el juego
se siente roto sin estarlo. Consecuencias:

- Recalcular la paleta viva tras cada resolución (barrido de 150 celdas, trivial).
- La **Purga de color** cambia la bolsa de golpe → recalcular después de ella.
- Si la paleta viva queda vacía → tablero vacío → mapa superado (comprobar en ese
  orden).
- La burbuja "siguiente" ya sorteada puede quedar huérfana si su color desaparece
  durante la resolución: **remapearla** al color vivo más cercano antes de mostrarla.

### Render y rendimiento (spec 12)

- **El tablero se hornea, no se pinta.** 150 `drawImage`/frame × 60 fps = 9.000/s
  es exactamente lo que la spec 12 prohíbe. Se usa un `boardCanvas` offscreen de
  420×550 rehorneado **solo** cuando el tablero cambia (fin de resolución, bajada
  de techo, cambio de skin, reinicio de mapa). Precedente exacto: `bakeLevelCanvas`
  en `KongGame.tsx:682`. Por frame quedan: fondo + `boardCanvas` + proyectil +
  ≤64 burbujas cayendo + cañón + 2 de recámara + HUD ≈ **menos de 20 `drawImage`**.
- Al bajar el techo la masa se desplaza 20 px en X por el toggle de `parity`: **no
  vale dibujar el horneado desplazado, hay que rehornear**. Ocurre 1 vez cada 5-12
  disparos.
- **Cero allocations en `update`**: proyectil en escalares, `pixelToCell` con
  out-params, `neighbors()` sobre `Int16Array(6)` de módulo, BFS con pila
  preasignada y `visited` sellado por generación (nunca `fill(0)` por llamada),
  nada de `filter`/`map`/spread, animación de pop sobre pool fijo.
- **Strings del HUD precalculados** (patrón `TIMER_TEXT`, `KongGame.tsx:84`):
  MAPA / PUNTOS / RÉCORD y el contador de techo se regeneran solo al cambiar el
  número.
- El `shadowBlur` de la skin neon va **horneado en el sprite**, nunca vivo por
  burbuja. Solo HUD y banner lo usan en vivo, con reset manual a 0.
- `bakeSprite` no es un helper compartido del repo: cada juego define el suyo
  (`KongGame.tsx:383`). Bubble define el propio, sobre mapas de 20×20 chars con
  `BUBBLE_PX = 2` → sprite de 40×40, sin escalado.
- Loop: `dtMs = Math.min(ts - last, 50)`; si `pausedRef.current` → `draw()` y
  salir; si `s.over` → dibujar una sola vez (`overDrawn`).

### Controles, foco y móvil

Teclado en `document` con guarda `isTypingTarget`, `e.preventDefault()` y
`sfxBubble.init()` perezoso en el primer keydown (política de autoplay).

`MobileGamepad` **sintetiza `KeyboardEvent`s** con `bubbles: true`
(`components/MobileGamepad.tsx:51`), así que el canvas solo escucha teclado y
nunca eventos táctiles propios. Apuntar con dos botones discretos es tosco:
mantener pulsado gira a `AIM_SPEED = 75 °/s` y un toque corto (<150 ms) aplica un
paso fino de 1,5°.

**Listener de `blur` propio desde el día 1**: es el bug transversal nº1 abierto
(ningún juego del repo maneja `window blur`), y en Bubble es especialmente visible
— con ← pulsado y alt-tab la mira gira sola hasta el tope. Bubble resetea
`leftDown/rightDown/…` en `blur`; el arreglo global va en su propia pasada.

### SFX y música

`lib/sfx-bubble.ts`, patrón de `lib/sfx-kong.ts`: clase con `AudioContext`
perezoso, `masterGain = 0.4`, `play(name)` con `switch`, `setMuted` vía
`setTargetAtTime`, `dispose()`, singleton `export const sfxBubble = new BubbleSFX()`.
Eventos: `shoot | bounce | stick | pop | drop | magic | map_clear | life_lost |
victory | game_over`.

Música: `/bubble-theme.mp3` ya está en `public/`. Solo hay que cablear
`setTrackOverride` en mount y `null` en cleanup.

---

## Data model

### Migración `games`

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'bubble',
  'BUBBLE',
  'Agrupa tres burbujas del mismo color y derriba el racimo entero.',
  'Un racimo de burbujas cuelga del techo del Vault y baja disparo a disparo. Apunta con el cañón, rebota en las paredes para colar la burbuja en el hueco imposible y junta tres del mismo color para reventarlas: todo lo que quede desconectado del techo se desploma. Ocho mapas, cuatro burbujas mágicas y una sola forma de salir — vaciando el último.',
  'PUZZLE',
  '/covers/bubble.png',
  'magenta'
);
```

Aplicada por MCP y versionada con la versión EXACTA del servidor. Migración
No hace falta ningun UPDATE posterior: el INSERT ya lleva el PNG definitivo.
cuando Paco coloque el PNG. `magenta` es el único valor de la union
`cyan|magenta|yellow|green|blue|red|gold` sin usar (verificado: de los 11 juegos,
2 cyan, 3 green, 2 red, 2 yellow, 1 blue, 1 gold).

### Entrada del registro (`lib/games-registry.ts`)

```ts
bubble: {
  id: 'bubble',
  skins: CLASSIC_SKINS,
  controls: {
    keyboard: [
      { keys: ['←', '→', 'A', 'D'], action: 'Apuntar el cañón' },
      { keys: ['Espacio', 'J'], action: 'Disparar', special: true },
      { keys: ['↓', 'S'], action: 'Cambiar por la burbuja siguiente', special: true },
    ],
    touch: {
      keyMap: { left: 'ArrowLeft', right: 'ArrowRight', a: ' ', b: 'ArrowDown' },
      a: 'DISPARAR',
      b: 'CAMBIAR',
    },
  },
  instructions: { goal: '…', tips: ['…'] },
  realtime: true,
},
```

- **goal:** "Junta 3 o más burbujas del mismo color para reventarlas y derriba todo
  lo que quede colgando: el techo baja cada pocos disparos y si el racimo cruza la
  línea roja pierdes una vida. Vacía los 8 mapas para terminar el juego."
- **tips:** "Rebota en las paredes laterales para llegar a los huecos imposibles —
  el techo no rebota", "Lo que puntúa de verdad es desprender: revienta el enganche
  y arrastra el racimo entero", "Cada mapa esconde una burbuja mágica: hay que
  reventarla dentro de un grupo de 3, no vale tocarla", "Con ↓ cambias la burbuja
  actual por la siguiente antes de disparar".

`a: 'DISPARAR'` y `b: 'CAMBIAR'` son obligatorias, no decorativas: el test
`keymaps only use valid slots and touch labels exist for a/b` exige etiqueta
si el slot existe.

### Estado del tablero

```ts
export const COLS = 10;
export const ROWS = 15;
export const CELLS = ROWS * COLS;          // 150

type Board = {
  color: Uint8Array;   // 150 · 0 = vacía; 1..6 = color
  magic: Uint8Array;   // 150 · 0 = normal; 1..4 = id de magia
  parity: 0 | 1;       // desplazamiento global de filas
};

export const idx = (r: number, c: number) => r * COLS + c;
```

Buffers de trabajo a nivel de módulo, preasignados: `stack: Int16Array(150)`,
`visited: Uint16Array(150)` + `stamp` incremental, `out: Int16Array(150)`,
`nbScratch: Int16Array(6)`.

### `MAPS` (`bubble-logic/maps.ts`)

| # | Filas iniciales | Burbujas | Colores | Techo baja cada | Magia | Carácter del layout |
|---|---|---|---|---|---|---|
| 1 | 5 | 50 | 3 (rojo, azul, amarillo) | 12 disparos | A | Bloque macizo sin huecos. Enseña a apuntar y el ≥3. |
| 2 | 6 | 56 | 3 | 10 | A | Primeros huecos internos; colgadas pequeñas. |
| 3 | 6 | 52 | 4 (+ verde) | 9 | B | Dos columnas colgando: primera cascada grande. |
| 4 | 7 | 62 | 4 | 8 | B | Techo dentado; obliga al primer rebote de pared. |
| 5 | 7 | 58 | 5 (+ magenta) | 7 | C | Racimos separados por color; premia limpiar uno entero. |
| 6 | 8 | 66 | 5 | 6 | C | Pasillos de 1 celda: huecos SOLO alcanzables por rebote. |
| 7 | 8 | 76 | 6 (+ cian) | 6 | D | Bloque denso, poco margen de error. |
| 8 | 9 | 88 | 6 | 5 | D | Arranca a 5 filas de la línea de muerte. Final. |

Formato de layout (arrays de strings, legibles en el diff, como los sprites de Kong):

```ts
// '.' vacío · R A V M N C = los 6 colores · minúscula = lleva la magia del mapa
const MAP_1: readonly string[] = [
  'RRAAVVRRAA',
  'AAVVRRAAVV',
  'VVRRaAVVRR',   // la 'a' es la burbuja mágica
  'RRAAVVRRAA',
  'AAVVRRAAVV',
];
```

### Scoring (`bubble-logic/scoring.ts`)

| Evento | Puntos |
|---|---|
| Burbuja del grupo reventado | 10 c/u |
| Burbuja desprendida en cascada | `20 · i` (i = orden en la cascada) |
| Detonar una burbuja mágica | 200 |
| Mapa superado | 1000 |
| Victoria (mapa 8 superado) | 5000 |

---

## Acceptance criteria

- [ ] Card BUBBLE visible en `/games` (PUZZLE, magenta, cover PNG) y el
      contador de créditos pasa a X/**12**.
- [ ] `/games/bubble` (ficha) responde 200 desde la ruta dinámica `[id]` sin
      crear `app/games/bubble/page.tsx`; `/games/bubble/play` exige sesión y
      renderiza un canvas 600×700 con campo de 420 px y HUD lateral de 180 px.
- [ ] ←/→ giran el cañón entre 12° y 168° a 75 °/s, ↓ intercambia actual↔siguiente,
      Espacio dispara. La preview del apuntado se corta en el primer rebote.
- [ ] Un disparo contra la pared lateral rebota (posición **y** velocidad
      reflejadas, sin temblor) y nunca atraviesa una burbuja con `dt = 50 ms`
      (test de sub-pasos).
- [ ] Anclar siempre escribe en una celda que estaba libre y que es vecina de una
      ocupada o está en la fila 0 (invariante testeado sobre las 150 celdas).
- [ ] Test de **simetría de vecindad**: para las 150 celdas y ambas paridades,
      `j ∈ neighbors(i)` ⟺ `i ∈ neighbors(j)`; cardinalidad **6 en interior,
      4 en bordes superior/inferior, 5 o 3 en bordes laterales segun paridad, y
      2 o 3 en las esquinas** segun paridad y lado. CORREGIDO 28-ago: este criterio
      decia antes "3-4 en bordes/esquinas", lo cual es FALSO — con el desplazamiento
      de las filas impares en un solo sentido, las esquinas del lado contrario tienen
      solo 2 vecinos. Verificado midiendo; costo una ronda de implementacion.
- [ ] `dropCeiling` conserva el recuento de burbujas (menos las de la fila
      perdida) y **alterna `parity`** (test).
- [ ] Grupo de ≥3 revienta; grupo de 2 no. Tras cada pop, todo lo desconectado de
      la fila 0 cae y puntúa en cascada.
- [ ] Las 4 magias tienen test propio y detonan **después** del pop y **antes**
      de `findFloating`. Una burbuja mágica que cae como colgada **no** detona.
- [ ] Tests de `maps.ts`: (1) los 8 mapas tienen exactamente **una** burbuja
      mágica; (2) ningún mapa usa un color fuera de su paleta declarada;
      (3) ningún mapa arranca con burbujas en fila ≥ `DEATH_ROW − 4`; (4) todo
      mapa tiene al menos una burbuja en la fila 0; (5) dificultad monótona
      (`dropEvery` no crece, `colors` no decrece).
- [ ] `pickNext()` solo sortea colores presentes en el tablero (test), y la
      burbuja "siguiente" huérfana se remapea al color vivo más cercano.
- [ ] Vaciar el tablero pasa al mapa siguiente con banner; el racimo cruzando
      `DEATH_ROW` cuesta una vida y reinicia **el mapa actual** conservando la
      puntuación; 3 vidas perdidas → game over + `saveScore` + leaderboard realtime.
- [ ] Superar el mapa 8 muestra el **modal de VICTORIA** (distinto del de game
      over), con la puntuación final guardable desde ahí.
- [ ] `lib/games-registry.test.ts` actualizado **en el mismo commit**: 12 ids,
      **7** juegos realtime, skins classic/retro/neon de `bubble` y su keyMap con
      labels `DISPARAR`/`CAMBIAR`.
- [ ] Instrucciones (ficha y overlay "?") muestran objetivo, tips y controles
      desde el registro.
- [ ] Música propia suena solo en la play-page de Bubble, obedece el mute del Nav
      y se limpia al salir (`setTrackOverride(null)`); SFX con mute propio
      (`av_sfx_muted`).
- [ ] PAUSA y overlay "?" pausan la simulación pero el `draw()` sigue.
- [ ] Alt-tab con ← pulsado no deja la mira girando (listener de `blur`).
- [ ] Perfilado del loop: ninguna allocation en `update` (proyectil en escalares,
      BFS preasignado) y ≤20 `drawImage` por frame en estado estacionario.
- [ ] `npm test` verde, **sin regresiones en los 109 tests existentes** (109 +
      los nuevos de `bubble-logic`, `sfx-bubble` y registro).
- [ ] `npx tsc --noEmit` limpio.
- [ ] `npm run build` limpio; ninguna ruta 500.
- [ ] `references/implemented-games.md` incluye `bubble`, `karate-champ` y `kong`.
- [ ] **QA humano de jugabilidad de Paco**: los 8 mapas se pueden superar, ningún
      hueco es inalcanzable, las 4 magias se entienden al usarlas y la victoria se
      alcanza al menos una vez.

---

## Decisions

- **Sí: es Puzzle Bobble / Bust-a-Move, no Bubble Bobble** — disparar burbujas a
  una cuadrícula hexagonal y agrupar por color; nada de plataformas ni dinosaurios.
  (Paco, 2026-08-28)
- **Sí: 8 mapas y superar el 8 termina el juego con VICTORIA** — pantalla propia,
  no el modal de game over; mismo patrón de "juego terminable" que Kong v1.5
  (spec 27). (Paco, 2026-08-28)
- **Sí: 4 magias, no 8 — cada una cubre DOS mapas** (1-2 → A, 3-4 → B, 5-6 → C,
  7-8 → D). En cada mapa hay **una** burbuja especial con la magia de su pareja;
  reventarla dentro de un grupo de ≥3 dispara el efecto. (Paco, 2026-08-28)
- **Sí: las 4 magias y su orden son `1-2 Bomba · 3-4 Rayo · 5-6 Purga de color ·
  7-8 Ancla`.** Bomba va primera a propósito: es la única que se entiende sin leer
  nada, y es la que ve el jugador nuevo. Efectos y coste en Diseño → "Las 4 magias".
  (Paco, 2026-08-28)
- **Sí: la música ya existe** — `public/bubble-theme.mp3` está en el repo
  (verificado); solo hay que cablear `setTrackOverride`. (Paco, 2026-08-28)
- **Sí: cover PNG definitiva ya en el repo** — `public/covers/bubble.png` (800x800,
  pixel art, misma linea que `kong.png`), colocada por Paco el 28-ago. El INSERT
  lleva el PNG directo: **sin clase CSS provisional ni migración UPDATE posterior**,
  segun la regla del proyecto. (Paco, 2026-08-28)
- **Sí: id `bubble`, categoría `PUZZLE`, color `magenta`** — `'PUZZLE'` ya existe
  en la union de `lib/supabase/types.ts` (a diferencia de Kong, que tuvo que
  añadir `'PLATFORMER'`) y `magenta` es el único color libre. (Paco, 2026-08-28)
- **Sí: `realtime: true`** — cuarto juego consecutivo con leaderboard en vivo;
  sube la lista de realtime de 6 a 7.
- **Sí: 10 columnas uniformes en todas las filas + `parity` global** — es lo que
  permite bajar el techo con `copyWithin` + toggle sin perder burbujas ni
  redimensionar arrays.
- **Sí: las colgadas caen, no explotan** — puntúan al desprenderse, con pool fijo
  de 64 y la misma gravedad (1400 px/s²) que Kong.
- **Sí: una burbuja mágica que cae como colgada NO detona** — solo detona dentro
  del grupo reventado; evita cascadas incontrolables y hace el efecto predecible.
- **Sí: perder una vida reinicia el mapa actual conservando la puntuación**;
  perder las 3 es game over y la partida siguiente arranca en el mapa 1 con 0
  puntos (mismo criterio que Kong v1.5).
- **No: modo endless tras el mapa 8, VS contra CPU, editor de mapas o magias
  combinables** — ver Fuera de alcance.
- **No: ráfaga doble como magia** — rompe la invariante de un solo proyectil en
  vuelo, que es lo que permite tener el proyectil en escalares del closure.

---

## Riesgos identificados

1. **La paridad de filas al bajar el techo.** Es la trampa nº1. Si se olvida el
   toggle de `parity` en `dropCeiling`, la malla se descuadra media celda y los
   anclajes empiezan a solaparse; y si las tablas de vecinos por paridad están mal,
   el bug aparece semanas después como "a veces un grupo de 3 no revienta".
   Mitigación: test de simetría/cardinalidad de `neighbors` sobre las 150 celdas en
   ambas paridades, y test de que `dropCeiling` conserva el recuento y alterna
   `parity`. Van **antes** de escribir el componente.
2. **Túnel del disparo si no hay sub-pasos.** Con `SHOT_SPEED = 1000` un frame de
   16,7 ms avanza 16,7 px, pero uno de 50 ms avanza 50 px > `D = 40`: la burbuja
   atraviesa el racimo. El sub-paso de 8 px lo cierra, y **el cap
   `Math.min(dt, 50)` del loop es precondición, no un detalle**. Hermano de este:
   el rebote reflejando solo la velocidad y no la posición → temblor de doble
   rebote pegado a la pared.
3. **Rehorneado del tablero cacheado.** El `boardCanvas` offscreen es obligatorio
   (150 `drawImage`/frame es justo lo que prohíbe la spec 12), pero la trampa es
   la inversa: **olvidar rehornear**. El toggle de `parity` desplaza la masa 20 px
   en X, así que no vale con dibujar el horneado desplazado. Puntos de rehorneado:
   fin de resolución de disparo, bajada de techo, cambio de skin, reinicio de mapa.
4. **`lib/games-registry.test.ts` tiene las listas hard-codeadas.** El test
   `has exactly the 11 implemented games` lleva los 11 ids escritos a mano y
   `flags the realtime games` los 6 realtime. **La suite se pone roja en cuanto se
   añada la entrada** si no se actualizan ambos en el MISMO commit (12 ids, 7
   realtime). Verificado hoy: 18 ficheros, 109 tests, todos verdes.
5. **Efecto de producto: el catálogo pasa de 11 a 12 juegos.** `getRank` da
   `MAESTRO DEL VAULT` con `credits >= catalogSize` (`lib/credits.ts:25`,
   verificado). Quien tuviera 11 créditos **pierde el rango hasta jugar a Bubble**.
   Es correcto por diseño, pero Paco debe saberlo antes de verlo en su perfil.
6. **La bolsa de colores.** Si `pickNext()` sortea entre los 6 colores del mapa y
   no entre los vivos, el mapa 7 entrega burbujas de un color extinguido y el juego
   se siente roto sin estarlo. Agravado por la Purga, que vacía un color de golpe;
   hay que recalcular la paleta viva después de ella y remapear la "siguiente"
   huérfana.
7. **El modal de VICTORIA no existe todavía en el repo.** Las 11 play-pages
   muestran `FIN DEL JUEGO` y nada más; el spec 27, que introduce el modal de
   victoria de Kong, sigue en `Draft` y **no está implementado**. Bubble no puede
   copiar un patrón que aún no existe: o lo estrena, o se coordina con la
   implementación del spec 27 para no acabar con dos modales de victoria distintos.
8. **Balance de las magias sin decidir bloquea `magic.ts` y los layouts.** Los 8
   layouts llevan el glifo de su magia embebido en el string; si el reparto cambia
   después, cambian los 8 ficheros de mapa y sus tests. La decisión pendiente va
   antes de la implementación, no durante.
9. **Anclaje eligiendo una celda ocupada o fuera de rango.** Síntoma: burbujas
   solapadas o disparos que se evaporan. Invariante testeada obligatoria.
10. **Ángulo demasiado horizontal → rebote infinito.** `ANGLE_MIN`/`ANGLE_MAX`
    de 12°/168° más `MAX_BOUNCES = 12` con anclaje forzoso son el cinturón.
11. **`findFloating` sembrando desde la fila equivocada.** Solo la fila 0 es techo;
    sembrar "las que tocan `ROOF_Y` en píxeles" se rompe en cuanto baja el techo.
12. **Móvil**: con el HUD dentro del canvas el campo útil es 420/600 = 70 % del
    ancho, así que en un móvil de 360 px las burbujas de 40 px quedan a ~24 px
    reales — verificar en el QA visual. Además el bug **responsive A.2** de las
    play-pages (ya afecta a Pac-Man y Kong) sigue abierto y Bubble lo heredará: es
    de plataforma, no se arregla dentro de este juego.
13. **Deuda que Bubble engorda sin resolver.** Copiar la play-page de Kong copia
    también sus lints de React 19 (refs leídas en render, `setState` síncrono en
    efectos) y el `saveScore` silencioso (el jugador ve "PUNTUACIÓN GUARDADA"
    aunque el insert falle). La consistencia gana, pero Bubble suma la play-page
    nº12 a esa deuda.
14. **QA headless imposible** (RAF congelado): la verificación de jugabilidad —
    especialmente que los 8 mapas sean superables y que ningún hueco de los mapas
    6 y 8 sea inalcanzable — solo la puede hacer Paco jugando.
