# Investigación de mecánica — BUBBLE (Puzzle Bobble / Bust-a-Move)

> Documento de investigación previo al spec 27. No es el spec.
> Fecha: 2026-08-28 · Juego nº12 · id previsto `bubble` · punto 4 del roadmap.
> Decisiones del dueño ya cerradas (NO se cuestionan aquí): Puzzle Bobble (no Bubble
> Bobble), 8 mapas, 4 magias emparejadas 1-2 / 3-4 / 5-6 / 7-8, HUD lateral con
> fase/puntos/récord, cañón abajo al centro con burbuja actual + siguiente.
> Fuente adicional: `tasks/kong-v15/NOTAS-diseno-2026-08-28.md` (sección "Bubble").

---

## 1. Convenciones del repo que Bubble debe seguir

Patrón verificado sobre el juego más reciente (`kong`, spec 26, commits `59cad6b`…`da2aad0`).
Bubble es una copia estructural de Kong con la lógica cambiada.

### 1.1 Ficheros a crear (y los que hay que tocar)

| Ruta | Qué es | Nuevo/Tocar |
| --- | --- | --- |
| `components/games/bubble-logic/grid.ts` + `.test.ts` | Geometría hexagonal, vecinos, celda↔píxel | Nuevo |
| `components/games/bubble-logic/shot.ts` + `.test.ts` | Trayectoria, rebote, anclaje | Nuevo |
| `components/games/bubble-logic/match.ts` + `.test.ts` | Grupo ≥3 y burbujas colgadas | Nuevo |
| `components/games/bubble-logic/maps.ts` + `.test.ts` | Los 8 layouts + `configFor(map)` | Nuevo |
| `components/games/bubble-logic/magic.ts` + `.test.ts` | Las 4 magias | Nuevo |
| `components/games/bubble-logic/scoring.ts` + `.test.ts` | Puntuación | Nuevo |
| `components/games/BubbleGame.tsx` | Canvas `"use client"`, `React.memo` | Nuevo |
| `app/games/bubble/play/page.tsx` | Play-page | Nuevo |
| `lib/sfx-bubble.ts` + `.test.ts` | SFX procedurales WebAudio | Nuevo |
| `lib/games-registry.ts` | Entrada nº12 + `GameId` union | Tocar |
| `lib/games-registry.test.ts` | **Rompe seguro** (ver §6.2) | Tocar |
| `supabase/migrations/<ts>_add_bubble_game.sql` | Fila en `games` | Nuevo |
| `public/covers/bubble.png` | Carátula (Paco la coloca) | Nuevo |
| `app/globals.css` | `.cover-bubble` de respaldo (opcional) | Tocar |
| `references/implemented-games.md` | Tabla (ya está desactualizada: le faltan `karate-champ` y `kong`) | Tocar |

**NO hace falta `app/games/bubble/page.tsx`**: la ficha de juego la sirve la ruta dinámica
`app/games/[id]/page.tsx` leyendo de Supabase. Kong solo tiene `play/page.tsx` (verificado).

**NO hace falta tocar `lib/supabase/types.ts`**: `'PUZZLE'` ya existe en la union `GameRow.cat`
(a diferencia de Kong, que tuvo que añadir `'PLATFORMER'`).

**`public/bubble-theme.mp3` YA EXISTE** en el repo. La música está resuelta; solo hay que
cablear `setTrackOverride('/bubble-theme.mp3')`.

### 1.2 Entrada en `lib/games-registry.ts`

```ts
bubble: {
  id: 'bubble',
  skins: CLASSIC_SKINS,                    // classic(base) / retro / neon
  controls: {
    keyboard: [
      { keys: ['←', '→', 'A', 'D'], action: 'Apuntar' },
      { keys: ['Espacio', 'J'], action: 'Disparar', special: true },
      { keys: ['↓', 'S'], action: 'Cambiar por la siguiente', special: true },
    ],
    touch: {
      keyMap: { left: 'ArrowLeft', right: 'ArrowRight', a: ' ', b: 'ArrowDown' },
      a: 'DISPARAR',
      b: 'CAMBIAR',
    },
  },
  instructions: { goal: '…(>20 chars, lo exige el test)', tips: ['…'] },
  realtime: true,
},
```

- Categoría `PUZZLE`, color sugerido **`magenta`** (es el único de la union
  `cyan|magenta|yellow|green|blue|red|gold` sin usar todavía).
- `GameId` union pasa a 12 entradas.
- `getKeyMap('bubble')` alimenta `MobileGamepad`, que **sintetiza `KeyboardEvent`s**
  (`components/MobileGamepad.tsx:51`, `bubbles: true`) → el canvas solo escucha teclado,
  nunca eventos táctiles propios.

### 1.3 Anatomía del componente canvas (calcado de `KongGame.tsx`)

- `'use client'`, `export default React.memo(BubbleGame)`.
- Props: `paused`, `muted?`, `skinKey?`, `onScoreChange`, `onLivesChange`,
  `onLevelChange` (aquí = fase 1-8), `onGameOver`.
- **Un solo `useEffect(..., [])`** con todo el estado en variables del closure + un
  `stateRef` con el objeto `GameState` creado una vez.
- `skinRef` actualizado por un efecto aparte con `[skinKey]` — el loop nunca lee props.
- Sprites: `bakeSprite(rows, px, palette, flip, opts)` sobre mapas de píxeles en strings.
  Para Bubble: mapa de **20×20 chars con `BUBBLE_PX = 2` → sprite de 40×40** (encaja con
  el diámetro elegido en §2 sin escalado).
- `spriteCache: Record<skinName, Sprites>` a nivel de módulo.
- Fondo horneado una vez por cambio de tablero/skin (`bakeLevelCanvas` en Kong) —
  crítico aquí, ver §6.1.
- `loop(ts)`: `dtMs = Math.min(ts - last, 50)`; si `pausedRef.current` → `draw()` y salir;
  si `s.over` → dibujar una sola vez (`overDrawn`).
- Teclado en `document` con guarda `isTypingTarget`, `e.preventDefault()`, y
  `sfxBubble.init()` perezoso en el primer keydown (política de autoplay).
- Cleanup: `cancelAnimationFrame` + quitar listeners + `sfxBubble.dispose()`.
- `<canvas width={CANVAS_W} height={CANVAS_H} style={{maxWidth:'100%',maxHeight:'100%'}}/>`
  dentro de un flex centrado. Sin DPR scaling (ningún juego del repo lo hace).

### 1.4 Play-page (`app/games/bubble/play/page.tsx`)

Espejo literal de `app/games/kong/play/page.tsx`:
`dynamic(() => import(...), { ssr: false })` · `useGameSkin('bubble')` · `getKeyMap` ·
score/lives/level en **refs + escritura directa al DOM** (nunca `useState`, spec 12) ·
corazones inyectados con el mismo helper `heartsMarkup` que usan Kong / Space Invaders /
Karate Champ (markup generado internamente, sin entrada de usuario) · botón mute con
`localStorage['av_sfx_muted']` · modal "?" con
`<InstructionsContent game={getGame('bubble')!} />` · `MobileGamepad` · modal game-over
con `saveScore({ gameId: 'bubble', … })` · CRT con **`aspectRatio: '6 / 7'`** (se mantiene
si el canvas es 600×700, ver §2) ·
`useEffect(() => { setTrackOverride('/bubble-theme.mp3'); return () => setTrackOverride(null); }, [setTrackOverride])`.

### 1.5 SFX (`lib/sfx-bubble.ts`)

Clase con `AudioContext` perezoso, `masterGain` a `0.4`, `play(name)` con `switch`,
`setMuted` vía `setTargetAtTime`, `dispose()`, y una instancia singleton exportada
(`export const sfxBubble = new BubbleSFX()`). Eventos propuestos:
`shoot | bounce | stick | pop | drop | magic | map_clear | life_lost | victory | game_over`.

---

## 2. Modelo de la cuadrícula

### 2.1 De dónde salen los números

Kong usa `CANVAS_W = 600`, `CANVAS_H = 700` y la play-page fija el CRT en
`aspectRatio: '6 / 7'`. **Se reutiliza tal cual** (mismo marco, mismo CSS, cero riesgo
en el bug responsive abierto A.2).

La referencia visual del dueño tiene HUD lateral. Reparto del ancho:

```
CANVAS_W = 600
PLAY_W   = 420   ← campo de juego, x ∈ [0, 420]
HUD_W    = 180   ← panel lateral, x ∈ [420, 600]  (FASE / PUNTOS / RÉCORD / techo)
```

`PLAY_W = 420` **no es arbitrario**: en una malla hexagonal con filas alternas
desplazadas media celda, el ancho del campo tiene que ser `COLS·D + R` para que las filas
pares peguen contra la pared izquierda y las impares contra la derecha.
Con `COLS = 10` y `D = 40`: `10·40 + 20 = 420`. ✔

```
D (diámetro)  = 40 px      R = 20 px
COLS          = 10  (TODAS las filas, ver §2.3)
ROW_H         = D·√3/2 = R·√3 = 34.6410161…
ROOF_Y        = 24         (cara inferior de la barra de techo)
ROWS          = 15         (índices 0..14)
DEATH_ROW     = 14         (centro y = 528.97; borde inferior 548.97)
DEATH_LINE_Y  = 550        (línea discontinua dibujada)
CANNON        = (210, 620) (210 = PLAY_W/2; 70 px de aire bajo la línea de muerte)
```

Comprobación de encaje vertical: centro de la fila `r` = `44 + 34.641·r`.
Fila 0 → 44 (borde superior 24 = ROOF_Y ✔). Fila 14 → 528.97 (borde inferior 548.97 < 550 ✔).
Capacidad total del tablero: 15 × 10 = **150 burbujas**.

### 2.2 Representación de datos

Dos arrays tipados planos, creados **una vez** y reutilizados (cero allocations, spec 12):

```ts
export const COLS = 10;
export const ROWS = 15;
export const CELLS = ROWS * COLS;          // 150

// 0 = vacía; 1..6 = color
const color = new Uint8Array(CELLS);
// 0 = normal; 1..4 = id de magia (A/B/C/D)
const magic = new Uint8Array(CELLS);

export const idx = (r: number, c: number) => r * COLS + c;
```

Estado del tablero:

```ts
type Board = {
  color: Uint8Array;      // 150
  magic: Uint8Array;      // 150
  parity: 0 | 1;          // desplazamiento global de filas (ver §2.3)
};
```

Buffers de trabajo preasignados a nivel de módulo (BFS sin `new`):

```ts
const stack   = new Int16Array(CELLS);     // pila de índices
const visited = new Uint16Array(CELLS);    // sellado por generación
let   stamp   = 0;                          // ++stamp por recorrido, nunca se limpia
const out     = new Int16Array(CELLS);     // resultado (grupo / colgadas)
```

### 2.3 Paridad y las 6 vecindades

Una fila es **larga** (pegada a la izquierda) o **desplazada** (+R a la derecha).
La paridad efectiva de la fila `r` es `(r + board.parity) & 1`:
`0` = pegada a la izquierda, `1` = desplazada +20 px.

> Todas las filas guardan **10 celdas** en el array. Es la decisión clave del modelo:
> permite bajar el techo con un `copyWithin` y un toggle de `parity` sin perder
> ninguna burbuja (ver §2.5). Es el mismo truco del `rowoffset` del bubble-shooter clásico.

```ts
export function rowShifted(r: number, parity: 0 | 1): boolean {
  return ((r + parity) & 1) === 1;
}

// dr/dc de los 6 vecinos, por paridad de fila. Tablas constantes de módulo.
const NB_FLUSH   = [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]] as const; // fila NO desplazada
const NB_SHIFTED = [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]] as const;   // fila desplazada

export function neighbors(r: number, c: number, parity: 0|1, dst: Int16Array): number {
  const t = rowShifted(r, parity) ? NB_SHIFTED : NB_FLUSH;
  let n = 0;
  for (let i = 0; i < 6; i++) {
    const rr = r + t[i][0], cc = c + t[i][1];
    if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
    dst[n++] = rr * COLS + cc;
  }
  return n;                                  // devuelve cuántos, no aloca array
}
```

**Derivación (por qué esas tablas).** Con `x_flush(c) = 20 + 40c` y
`x_shift(c) = 40 + 40c`:
desde una celda no desplazada en `x = 20+40c`, las de la fila contigua a distancia 20 px
en X están en `x_shift(c-1) = 40c` y `x_shift(c) = 40+40c` → `dc ∈ {-1, 0}`.
Desde una desplazada en `x = 40+40c`: `x_flush(c) = 20+40c` y `x_flush(c+1) = 60+40c`
→ `dc ∈ {0, +1}`. ✔ Simétrico y comprobable con un test (§6.3).

### 2.4 Celda ↔ píxel

```ts
export function cellX(r: number, c: number, parity: 0|1): number {
  return 20 + 40 * c + (rowShifted(r, parity) ? 20 : 0);
}
export function cellY(r: number): number {
  return 44 + ROW_H * r;                     // ROOF_Y(24) + R(20) + r·34.641
}

export function pixelToCell(x: number, y: number, parity: 0|1, out: Int16Array): void {
  let r = Math.round((y - 44) / ROW_H);
  r = r < 0 ? 0 : r > ROWS - 1 ? ROWS - 1 : r;
  let c = Math.round((x - 20 - (rowShifted(r, parity) ? 20 : 0)) / 40);
  c = c < 0 ? 0 : c > COLS - 1 ? COLS - 1 : c;
  out[0] = r; out[1] = c;                    // out-params: cero objetos por sub-paso
}
```

### 2.5 Bajada del techo

```ts
export function dropCeiling(b: Board): boolean {   // true = mapa perdido
  // 1. ¿hay algo en la última fila? al bajar cruzaría la línea de muerte
  for (let c = 0; c < COLS; c++) if (b.color[idx(ROWS - 1, c)]) return true;
  // 2. desplazar todo una fila hacia abajo
  b.color.copyWithin(COLS, 0, CELLS - COLS);
  b.magic.copyWithin(COLS, 0, CELLS - COLS);
  b.color.fill(0, 0, COLS);
  b.magic.fill(0, 0, COLS);
  // 3. sembrar la nueva fila 0 con colores vivos del tablero
  seedRow0(b);
  // 4. invertir la alineación global
  b.parity = b.parity === 0 ? 1 : 0;
  return anyAtOrBelow(b, DEATH_ROW);
}
```

El toggle de `parity` es lo que hace que la masa entera se desplace ±20 px al bajar,
igual que en la recreativa. Con `COLS` uniforme **ninguna burbuja se sale del array**.

---

## 3. Los tres algoritmos centrales

Los tres son funciones puras sobre `Board`, testeables sin canvas, en `bubble-logic/`.

### 3.1 Trayectoria del disparo, rebote y anclaje (`shot.ts`)

Constantes:

```ts
export const SHOT_SPEED  = 1000;   // px/s → ~0.58 s del cañón al techo (576 px)
export const SUBSTEP_MAX = 8;      // px por sub-paso  (« R = 20 → nunca atraviesa)
export const MAX_BOUNCES = 12;     // corta el caso patológico del ángulo casi horizontal
export const ANGLE_MIN   = 12 * Math.PI / 180;   // medido desde +x, hacia arriba
export const ANGLE_MAX   = 168 * Math.PI / 180;
export const AIM_SPEED   = 75 * Math.PI / 180;   // rad/s manteniendo ← / →
```

Estado del proyectil: **escalares en el closure** (`px, py, vx, vy, pColor, pMagic`),
nunca un objeto por disparo.

`fire(angle)` → `vx = cos(angle) * SHOT_SPEED`, `vy = -sin(angle) * SHOT_SPEED`
(en canvas la `y` crece hacia abajo: de ahí el signo).

Paso por frame:

```
n = max(1, ceil(SHOT_SPEED * dt / SUBSTEP_MAX))     // dt ya capado a 50 ms → n ≤ 7
h = dt / n
repetir n veces:
  px += vx*h ;  py += vy*h
  A) pared izquierda:  si px < R          → px = 2R - px             ; vx = -vx ; bounce++
     pared derecha:    si px > PLAY_W - R → px = 2(PLAY_W-R) - px    ; vx = -vx ; bounce++
     (reflejar TAMBIÉN la posición, no solo la velocidad — si no, jitter de doble rebote)
     si bounce > MAX_BOUNCES → anclar donde esté y salir
  B) techo: si py - R <= ROOF_Y  → anclar en la fila 0 y salir
  C) colisión: hit = firstHit(px, py)
     si hit >= 0 → anclar contra `hit` y salir
```

`firstHit(px, py)`: **NO recorre las 150 celdas**. Calcula `(r,c) = pixelToCell(px,py)` y
prueba solo esa celda y sus 6 vecinas (≤7 tests de distancia al cuadrado contra
`(2R)² = 1600`). Devuelve el índice de la ocupada más cercana, o `-1`.
Coste: ≤7 comparaciones por sub-paso, ≤49 por frame en el peor caso.

`anchor(px, py, hit)` — la parte que más fácil se implementa mal:

```
candidatos = { celda bajo (px,py) } ∪ { 6 vecinas de `hit` }
filtrar:  dentro de rango  Y  color[i] === 0        (libre)
elegir:   la de menor distancia² desde (px,py) a su centro
si no queda ninguna → buscar libre en el anillo 2 (caso rarísimo)
escribir: color[celda] = pColor ; magic[celda] = pMagic
```

Invariantes a testear: la celda elegida **siempre estaba libre**, y **siempre es vecina
de una ocupada o está en la fila 0**.

Previsualización del apuntado: la misma función en modo *fast-forward* —
`traceShot(board, angle, outPts)` avanza con `SUBSTEP_MAX` sin dibujar y devuelve la
polilínea hasta el **primer rebote** (clásico; más allá se considera chivato). ~8 puntos.

### 3.2 Grupo del mismo color ≥3 (`match.ts`)

Flood fill iterativo con pila preasignada y `visited` sellado por generación:

```ts
export function findGroup(b: Board, start: number, out: Int16Array): number {
  const target = b.color[start];
  if (target === 0) return 0;
  const gen = ++stamp;
  let sp = 0, n = 0;
  stack[sp++] = start; visited[start] = gen;
  while (sp > 0) {
    const cur = stack[--sp];
    out[n++] = cur;
    const r = (cur / COLS) | 0, c = cur - r * COLS;
    const k = neighbors(r, c, b.parity, nbScratch);   // Int16Array(6) de módulo
    for (let i = 0; i < k; i++) {
      const j = nbScratch[i];
      if (visited[j] === gen || b.color[j] !== target) continue;
      visited[j] = gen;
      stack[sp++] = j;
    }
  }
  return n;                                   // revienta si n >= 3
}
```

Se llama **una sola vez por disparo**, con `start` = la celda recién anclada.
Coste peor caso: 150 celdas × 6 vecinos = 900 comparaciones. Despreciable.

Si `n >= 3`: se vacían las `n` celdas, se contabilizan puntos, y **si alguna llevaba
magia se dispara su efecto** (§4) después de vaciarlas y antes de calcular colgadas.

### 3.3 Burbujas colgadas (`match.ts`)

Se ejecuta **siempre después** del pop (y después del efecto de magia), nunca antes:

```ts
export function findFloating(b: Board, out: Int16Array): number {
  const gen = ++stamp;
  let sp = 0;
  for (let c = 0; c < COLS; c++) {            // semillas: SOLO la fila 0 (el techo)
    if (b.color[c] !== 0) { visited[c] = gen; stack[sp++] = c; }
  }
  while (sp > 0) { /* BFS por vecinos ocupados de CUALQUIER color */ }
  let n = 0;
  for (let i = 0; i < CELLS; i++)
    if (b.color[i] !== 0 && visited[i] !== gen) out[n++] = i;
  return n;                                   // estas caen
}
```

Las colgadas **no explotan: caen**. Pasan a un pool preasignado de burbujas cayendo
(`FALL_POOL = 64`) con `x, y, vy, color, active`, gravedad 1400 px/s² (mismo valor que
`GRAVITY` en `kong-logic/player.ts`), desactivadas al salir del canvas. Puntúan al
desprenderse, no al tocar el suelo.

> Semántica decidida: una burbuja **con magia que cae como colgada NO detona**.
> Solo detona si forma parte del grupo reventado. Evita cascadas incontrolables y hace
> el efecto predecible para el jugador.

Secuencia completa de resolución de un disparo (orden no negociable):

```
anclar → findGroup → si <3: fin  (y contador de techo++)
                     si ≥3: pop → magia (si la había) → findFloating → caída
                            → ¿tablero vacío?            → mapa superado
                            → ¿ocupada en fila ≥ DEATH_ROW? → vida perdida
                            → rehornear el canvas del tablero (UNA vez)
```

---

## 4. Las 4 magias

Reglas comunes:

- La burbuja mágica **tiene color normal** y hay que reventarla en un grupo de ≥3 como
  cualquier otra. La magia es un extra, no una vía alternativa.
- Hay **exactamente una por mapa**, colocada a mano en el layout (§5.2).
- Se dibuja con un anillo/glifo encima del sprite base (un segundo `bakeSprite` de
  overlay; 4 glifos × 3 skins horneados una sola vez).
- Detona **después** del pop y **antes** de `findFloating` → sus huecos generan colgadas.
- Todas se implementan sobre `neighbors()` y los arrays existentes. **Ninguna introduce
  un subsistema nuevo.**

Ordenadas de más barata a más cara:

### 1) RAYO — barata — mapas 3-4 (magia B)

Revienta **la fila entera** en la que estaba la burbuja mágica.
Implementación: `for (c = 0..9) color[idx(r,c)] = 0`. Literalmente 4 líneas + test.

*Por qué en 3-4:* en esos mapas ya hay columnas colgando del techo; un corte horizontal
limpio provoca la primera cascada grande de colgadas y **le enseña al jugador la mecánica
de desprendimiento**, que es la que más puntúa en el resto del juego.

### 2) BOMBA — barata — mapas 1-2 (magia A) ← **RECOMENDADA COMO PRIMERA**

Revienta todo en un radio de 2 anillos: las 6 vecinas + las 12 del anillo 2 (18 celdas
además de la propia).
Implementación: dos tablas constantes de 18 offsets `(dr, dc)` (una por paridad) con
recorte de bordes. ~20 líneas + test de simetría.

*Por qué es la primera que ve el jugador:* es la única de las cuatro cuyo efecto se
entiende **sin leer nada** — abre un boquete redondo justo donde has disparado. El Rayo
es marginalmente más barato de codificar, pero como primera magia enseña peor: parece un
fallo de "se ha borrado una fila". En los mapas 1-2 (5-6 filas, 3 colores, bloque casi
sólido) la bomba además es espectacular sin desbalancear nada.

### 3) PURGA DE COLOR — media — mapas 5-6 (magia C)

Elimina del tablero **todas** las burbujas del color de la burbuja mágica.
Implementación: barrido de 150 celdas comparando color. La lógica es trivial; el coste
está en (a) el balance —puede vaciar medio mapa— y (b) la animación: hasta ~30 burbujas
reventando escalonadas y una cascada de colgadas enorme.

*Por qué en 5-6:* son los primeros mapas con **5 colores**. Con 3 colores la purga sería
un botón de "ganar"; con 5, quitar un color entero es una decisión táctica (y además
cambia la bolsa del generador de siguiente burbuja, §6.4). Encaja justo cuando el jugador
ya entiende la economía de colores.

### 4) ANCLA (freno del techo) — media/cara — mapas 7-8 (magia D)

Congela la bajada del techo durante los **próximos 4 disparos**, con cuenta atrás en el
HUD lateral.
Es la más cara porque es la única con **estado persistente entre disparos**: hay que
guardarla en `GameState`, resetearla al perder una vida y al reiniciar mapa, pintarla en
el HUD y —lo delicado— **interactúa con la condición de derrota**. Las otras tres son
puras y se agotan en el mismo tick.

*Por qué en 7-8:* en los dos últimos mapas el techo baja cada 5-6 disparos y es la
amenaza real, no los colores. Una magia que compra oxígeno es el clímax natural y hace
que el jugador la busque activamente en vez de reventarla de rebote.

> Alternativa descartada para el slot D: **ráfaga doble** (los próximos 3 disparos salen
> con dos burbujas). Rompe la invariante de "un solo proyectil en vuelo", que es la que
> permite tener el proyectil en escalares del closure. Coste desproporcionado.

---

## 5. Progresión de los 8 mapas

### 5.1 Tabla de configuración

`MAPS: readonly MapConfig[]` en `bubble-logic/maps.ts`, con `configFor(map)` clampado
(patrón `configFor` de `kong-logic/level.ts`).

| # | Filas iniciales | Burbujas | Colores | Techo baja cada | Magia | Carácter del layout |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 | 50 | 3 (rojo, azul, amarillo) | 12 disparos | A · Bomba | Bloque macizo sin huecos. Enseña a apuntar y el ≥3. |
| 2 | 6 | 56 | 3 | 10 | A · Bomba | Primeros huecos internos; aparecen colgadas pequeñas. |
| 3 | 6 | 52 | 4 (+ verde) | 9 | B · Rayo | Dos columnas colgando: el rayo provoca la caída grande. |
| 4 | 7 | 62 | 4 | 8 | B · Rayo | Techo dentado; obliga al primer rebote de pared. |
| 5 | 7 | 58 | 5 (+ magenta) | 7 | C · Purga | Racimos separados por color; premia limpiar uno entero. |
| 6 | 8 | 66 | 5 | 6 | C · Purga | Pasillos de 1 celda: huecos SOLO alcanzables por rebote. |
| 7 | 8 | 76 | 6 (+ cian) | 6 | D · Ancla | Bloque denso, poco margen de error. |
| 8 | 9 | 88 | 6 | 5 | D · Ancla | Arranca a 5 filas de la línea de muerte. Final. |

Ejes que **no** varían (mantenerlos fijos reduce superficie de bugs): velocidad del
disparo, geometría de la malla, vidas (3), umbral de grupo (3).

Fin del juego: superar el mapa 8 → **pantalla de VICTORIA** (mismo patrón de "juego
terminable" que Kong v1.5), `onGameOver(score)` con el marcador final.
Perder las 3 vidas → game over normal. Perder una vida → **el mapa actual se reinicia
desde su layout inicial conservando la puntuación** (equivalente a `resetBoard()` en Kong).

Puntuación propuesta (`scoring.ts`): `SCORE_POP = 10` por burbuja del grupo ·
desprendidas en cascada `20 · i` (i = orden en la cascada) · `SCORE_MAGIC = 200` ·
`SCORE_MAP = 1000` al superar mapa · `SCORE_VICTORY = 5000`.

### 5.2 Formato de los layouts

Como los sprites de Kong: arrays de strings, uno por mapa, legibles en el diff.

```ts
// '.' vacío · R A V M N C = los 6 colores · minúscula = lleva la magia del mapa
const MAP_1: readonly string[] = [
  'RRAAVVRRAA',
  'AAVVRRAAVV',
  'VVRRaAVVRR',   // la 'a' es la burbuja mágica (color A + magia del mapa)
  'RRAAVVRRAA',
  'AAVVRRAAVV',
];
```

`parseMap(rows)` escribe `color`/`magic` y devuelve el `Board`. Es pura y testeable.

Tests obligatorios de `maps.ts` (el equivalente al test de alcanzabilidad del trofeo que
las notas de Kong echan en falta):

1. Los 8 mapas tienen **exactamente una** burbuja mágica.
2. Ningún mapa usa un color fuera de su paleta declarada.
3. Ningún mapa arranca con burbujas en fila ≥ `DEATH_ROW - 4` (margen de arranque).
4. Todo mapa tiene al menos una burbuja en la fila 0 (si no, el tablero entero está
   colgado y cae solo al primer disparo).
5. La dificultad es monótona: `dropEvery` no crece, `colors` no decrece.

---

## 6. Riesgos y trampas

### 6.1 Rendimiento del loop de render

- **El tablero se hornea, no se pinta.** 150 `drawImage` por frame × 60 fps = 9 000/s.
  Funcionaría en desktop, pero es exactamente el patrón que la spec 12 prohíbe.
  Solución: un `boardCanvas` offscreen de 420×550 que se rehornea **solo** cuando el
  tablero cambia (fin de resolución de disparo, bajada de techo, cambio de skin, reinicio
  de mapa). Precedente exacto: `bakeLevelCanvas` en `KongGame.tsx:682`.
  Por frame se dibujan entonces: fondo + `boardCanvas` + proyectil + ≤64 burbujas cayendo
  + cañón + 2 burbujas de recámara + HUD ≈ **menos de 20 `drawImage`**.
- **Ojo con el `parity`:** al bajar el techo la masa se desplaza 20 px en X, así que no
  vale con dibujar el canvas horneado desplazado — **hay que rehornear**. Ocurre 1 vez
  cada 5-12 disparos: irrelevante.
- **Cero allocations en `update`:** proyectil en escalares; `pixelToCell` con out-params;
  `neighbors()` escribiendo en un `Int16Array(6)` de módulo; BFS con pila preasignada y
  `visited` sellado por generación (nunca un `fill(0)` de 150 por llamada); nada de
  `filter` / `map` / spread. La animación de pop usa un pool fijo, no un array que crece.
- **Strings del HUD precalculados** (patrón `TIMER_TEXT`, `KongGame.tsx:75`): el panel
  lateral repinta FASE / PUNTOS / RÉCORD y el contador de techo cada frame — cachear el
  string y regenerarlo solo al cambiar el número, como hace `report()` en Kong.
- El `shadowBlur` de la skin neon va **horneado en el sprite** (`BakeOpts.glowColor` de
  `bakeSprite`), nunca vivo por burbuja. Solo HUD y banner lo usan en vivo, con reset
  manual a 0.

### 6.2 Encaje en el registro central

- `lib/games-registry.test.ts` **va a fallar** en cuanto se añada la entrada: el test
  `'has exactly the 11 implemented games'` lleva la lista de 11 ids hard-codeada y
  `'flags the realtime games'` lleva la lista de realtime hard-codeada. Hay que
  actualizar ambos (12 juegos, 7 realtime) **en el mismo commit** que la entrada, o la
  suite queda roja.
- Añadir también un `expect(getSkinOptions('bubble'))` con `classic/retro/neon`,
  siguiendo el patrón de los tests existentes.
- El test `keymaps only use valid slots` exige etiqueta `a`/`b` si el slot existe →
  `a: 'DISPARAR'`, `b: 'CAMBIAR'` son obligatorias, no decorativas.
- `lib/supabase/types.ts`: **no se toca** (`PUZZLE` ya existe). Es la diferencia con Kong.
- La ficha del juego sale sola de la ruta dinámica `app/games/[id]/page.tsx` **en cuanto
  exista la fila en Supabase**. Si la migración no se aplica, el juego no aparece en el
  grid aunque el registro y la ruta `play` estén perfectos — fallo silencioso típico.
- `GamesGrid.tsx:39` decide entre imagen y clase CSS con `cover.startsWith('/')`. Si el
  PNG aún no está, poner `'cover-bubble'` (clase CSS) en la migración y hacer un `UPDATE`
  posterior a `/covers/bubble.png` — exactamente lo que se hizo con `karate-champ` y
  `kong` (dos migraciones cada uno).
- **Créditos F2**: el juego cuenta para el desbloqueo de skins (`lib/credits.ts`, umbrales
  3/6/9 y rango `MAESTRO DEL VAULT` con `credits >= catalogSize`). Al subir el catálogo de
  11 a 12, quien tuviera 11 créditos **pierde el rango de MAESTRO** hasta jugar a Bubble.
  Es correcto por diseño, pero conviene que Paco lo sepa antes de verlo en su perfil.

### 6.3 Lo que más fácil se implementa mal

Por orden de probabilidad de morder:

1. **Las tablas de vecinos por paridad.** Test obligatorio: *simetría* — para las 150
   celdas, `j ∈ neighbors(i)` ⟺ `i ∈ neighbors(j)`; y *cardinalidad* — 6 vecinos en el
   interior, 3-4 en bordes y esquinas. Sin ese test el bug aparece semanas después como
   "a veces un grupo de 3 no revienta".
2. **El toggle de `parity` al bajar el techo.** Si se olvida, la malla se descuadra media
   celda y los anclajes empiezan a solaparse. Test: `dropCeiling` conserva el recuento de
   burbujas (menos las de la fila perdida) y `parity` alterna.
3. **El anclaje eligiendo una celda ocupada o fuera de rango.** Síntoma: burbujas
   solapadas o disparos que se evaporan. Invariante testeada: la celda devuelta estaba
   libre y es vecina de una ocupada (o está en la fila 0).
4. **Túnel a alta velocidad.** Con `SHOT_SPEED = 1000` y sin sub-pasos, un frame de
   16,7 ms avanza 16,7 px y uno de 50 ms avanza 50 px > `D`. El sub-paso de 8 px lo
   cierra; **el cap `Math.min(dt, 50)` del loop es precondición**, no un detalle.
5. **Rebote reflejando solo la velocidad.** Hay que reflejar también la posición
   (`px = 2R - px`), o en el frame siguiente la burbuja sigue fuera y vuelve a rebotar →
   temblor pegado a la pared.
6. **Ángulo demasiado horizontal.** Con `ANGLE_MIN` bajo o mal clampado, un disparo puede
   rebotar indefinidamente. `MAX_BOUNCES = 12` + anclaje forzoso es el cinturón.
7. **`findFloating` sembrando desde la fila equivocada.** Solo la fila 0 es techo. Si se
   siembra "las que tocan `ROOF_Y` en píxeles", se rompe en cuanto baja el techo.
8. **Orden pop → magia → colgadas.** Invertirlo (colgadas antes de la magia) deja
   burbujas flotando un disparo entero.
9. **Generador de la siguiente burbuja** (§6.4).
10. **Teclas pegadas al perder el foco.** Es el bug transversal nº1 abierto en
    `tasks/kong-v15/NOTAS-diseno-2026-08-28.md` (afecta a los 11 juegos; ninguno maneja
    `window blur`). En Bubble es **especialmente visible**: con ← pulsado y alt-tab, la
    mira gira sola hasta el tope. Merece un listener de `blur` que resetee
    `leftDown/rightDown/…` en este juego desde el día 1, aunque el arreglo global vaya
    en su propia pasada.

### 6.4 Trampa de diseño: la bolsa de colores

`pickNext()` debe sortear **solo entre los colores que siguen presentes en el tablero**.
Si no, en el mapa 7 (6 colores) el jugador recibe burbujas de un color ya extinguido y el
juego se siente roto sin estarlo. Consecuencias:

- Recalcular la paleta viva tras cada resolución (barrido de 150 celdas, trivial).
- La magia **Purga de color** cambia la bolsa de golpe → recalcular después de ella.
- Si la paleta viva queda vacía → tablero vacío → mapa superado (comprobar en ese orden).
- La burbuja "siguiente" ya sorteada puede quedar huérfana si su color desaparece durante
  la resolución: **remapearla** al color vivo más cercano antes de mostrarla.

### 6.5 Móvil y responsive

- Apuntar con dos botones discretos es tosco. Propuesta: mantener pulsado gira a
  `AIM_SPEED = 75°/s`, y un toque corto (<150 ms) aplica un paso fino de 1,5°.
- El bug **A.2** (responsive de las play-pages en emulación DevTools; afecta ya a Pac-Man
  y Kong) sigue abierto y es de plataforma: Bubble lo heredará. No intentar arreglarlo
  dentro de este juego.
- Con HUD lateral dentro del canvas, el campo útil es 420/600 = 70 % del ancho. Aceptable
  porque el CRT escala el canvas entero, pero verificarlo en el QA visual: las burbujas de
  40 px pasan a ~24 px reales en un móvil de 360 px de ancho.

### 6.6 Deuda que NO se debe engordar

Las notas del 28-ago listan **44 errores de lint de React 19** repartidos por las 11
play-pages (refs leídas en render + `setState` síncrono en efectos) y el problema de
`saveScore` silencioso (el jugador ve "PUNTUACIÓN GUARDADA" aunque el insert falle).
Copiar la play-page de Kong copia también esos patrones. No es motivo para desviarse
—la consistencia gana—, pero conviene anotarlo: Bubble suma la play-page nº12 a esa
deuda, no la resuelve.

---

## 7. Resumen ejecutivo de decisiones propuestas

| Decisión | Valor |
| --- | --- |
| Canvas | 600×700, CRT `aspectRatio: '6 / 7'` (idéntico a Kong) |
| Campo / HUD | 420 px de campo + 180 px de panel lateral |
| Malla | 10 columnas × 15 filas uniformes, `D = 40`, `R = 20`, `ROW_H = 20√3` |
| Almacenamiento | 2 × `Uint8Array(150)` (color + magia) + `parity` global |
| Bajada de techo | `copyWithin` de una fila + toggle de `parity` |
| Disparo | 1000 px/s, sub-pasos de 8 px, ≤12 rebotes, ángulo 12°–168° |
| Vecindad | 2 tablas constantes de 6 offsets según paridad |
| Colisión | ≤7 tests por sub-paso (celda bajo el proyectil + 6 vecinas) |
| Magias | Bomba (1-2) · Rayo (3-4) · Purga (5-6) · Ancla (7-8) |
| Mapas | 8, de 5 filas/3 colores/techo cada 12 → 9 filas/6 colores/techo cada 5 |
| Fin | Mapa 8 superado → pantalla de VICTORIA |
| Registro | id `bubble`, `PUZZLE`, color `magenta`, `realtime: true`, skins clásicas |
| Música | `/bubble-theme.mp3` — **ya está en `public/`** |
