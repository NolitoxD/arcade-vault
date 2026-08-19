# SPEC 19 — Integración del juego PAC-MAN

> **Estado:** Approved
> **Depende de:** 06-games-table-leaderboard-supabase, 10-mobile-touch-controls,
> 12-frogger-performance, 13-supabase-auth, 14-security-rls-password-headers,
> 15-pong, 16-road-fighter
> **Fecha:** 2026-08-18
> **Objetivo:** Integrar PAC-MAN con ID `pacman` (primera entrada de la categoría
> MAZE, color `yellow`) como comecocos endless sobre 3 laberintos artesanales
> rotativos, con las 4 personalidades clásicas de fantasmas (Blinky, Pinky, Inky,
> Clyde), máquina scatter↔chase↔frightened y puntuación clásica — con leaderboard
> realtime y aplicando desde el primer commit los 7 patrones de performance del
> spec 12.

---

## Scope

**In:**

- Migración SQL `supabase/migrations/<timestamp>_add_pacman_game.sql` que
  inserta la fila `pacman` en la tabla `games` con
  `on conflict (id) do nothing` (mismo formato que
  `20260814085803_add_road_fighter_game.sql`). RLS ya está activo (specs 04
  y 14) — **no** se crea ninguna política nueva, solo el insert del catálogo.
  `MAZE` es categoría nueva; la columna `cat` es texto libre, no requiere
  cambios de esquema.
- Crear `components/games/PacmanGame.tsx` — componente React `"use client"`
  que encapsula el canvas (448 × 560 px: rejilla de 28 × 31 celdas de 16 px
  más dos bandas de 32 px para el HUD interno) y el game loop completo.
  Acepta props: `paused`, `skinKey`, `onScoreChange`, `onLevelChange`,
  `onLivesChange`, `onGameOver`.
- **3 laberintos fijos artesanales** como constantes de módulo (arrays de
  strings, 28 columnas × 31 filas), rotando por nivel `1 → 2 → 3 → 1 → ...`
  (`mazeIndex = (level - 1) % 3`). Cada maze cumple: túneles laterales con
  wrap horizontal, casa de fantasmas central con puerta, exactamente 4
  power-pellets, ~230–250 pellets, un spawn de Pac-Man y una celda de fruta.
  La leyenda del formato de celda está en el Data model.
- **Validador de mazes en desarrollo** (assertion, no runtime de prod): al
  cargar el módulo con `process.env.NODE_ENV !== 'production'`, verificar por
  cada maze dimensiones exactas, conteo de símbolos obligatorios y que
  **todos** los pellets y power-pellets son alcanzables por flood-fill desde
  el spawn de Pac-Man (atravesando túneles, sin atravesar muros ni puerta).
- Movimiento de Pac-Man continuo por pasillos (px/s con delta time, no salto
  de celda): ejes bloqueados al corredor, giros solo alineados a centro de
  celda con tolerancia de snap, e **input bufferizado** — la última dirección
  pulsada queda en cola y se aplica en cuanto el giro es legal.
- Comer pellets (10 pts) y power-pellets (50 pts); nivel completado cuando no
  queda ninguno → banner breve, siguiente maze de la rotación, dificultad +1,
  posiciones reseteadas. Endless: sin nivel final.
- **IA de fantasmas — las 4 personalidades clásicas** (targets exactos en el
  Data model): Blinky persigue la celda de Pac-Man; Pinky apunta 4 celdas por
  delante; Inky usa el vector desde Blinky reflejado; Clyde persigue de lejos
  y se retira a su esquina de cerca. Máquina **global** scatter↔chase con
  timers por nivel, modo frightened al comer power-pellet, regla de
  no-reversa 180° salvo cambio de modo, y elección pseudo-aleatoria de salida
  en frightened.
- Casa de fantasmas: Blinky empieza fuera; Pinky, Inky y Clyde salen
  escalonados por contador de pellets comidos, con timer de respaldo para que
  nadie se quede encerrado si el jugador deja de comer.
- Frightened: fantasmas azules, lentos y comestibles; cadena
  200/400/800/1600 (reset con cada power-pellet); un fantasma comido vuelve
  como ojos a la casa y reaparece. Duración frightened decreciente por nivel
  hasta **0 desde el nivel 12** (el power-pellet sigue puntuando y sigue
  forzando la reversa de los fantasmas, pero ya no hay fase azul).
- **Escalado por nivel** con tabla de constantes (Data model): velocidad de
  fantasmas ↑, fases scatter ↓, frightened ↓; se estabiliza en ~nivel 10.
- **Fruta**: aparece en la celda `F` (centro, bajo la casa) al comer 70 y 170
  pellets del nivel (2 veces por nivel), expira a los ~9 s, vale
  `100 × nivel`.
- Vidas: 3. Colisión con fantasma no-frightened → pausa breve de muerte,
  −1 vida, respawn de Pac-Man y fantasmas en sus posiciones iniciales (los
  pellets comidos se conservan). Única condición de fin: `lives === 0` →
  `onLivesChange(0)` + `onGameOver(score)`.
- **Puntuación clásica SIN multiplicador de nivel**: pellet 10, power-pellet
  50, cadena de fantasmas 200/400/800/1600, fruta `100 × nivel` (la fruta es
  el único valor que escala).
- Controles de teclado: flechas `←`/`→`/`↑`/`↓` **y** alias `A`/`D`/`W`/`S` —
  4 direcciones, mismo modelo que Frogger, para que la síntesis de teclado del
  `MobileGamepad` (spec 10, `keyMap` con D-pad de 4 direcciones) funcione sin
  tocar el componente cuando `@mobile-porter` haga su pasada.
- **Efectos de sonido** con assets existentes y el patrón de
  `ArkanoidGame`/`PongGame`/`RoadFighterGame`
  (`new Audio(...)` una vez + `cloneNode().play().catch(() => {})`):
  - Pellet comido → `/ball-bounce.mp3` **con throttle** (mínimo
    `PELLET_SOUND_THROTTLE_MS` entre reproducciones — sin throttle sonaría
    ~9 veces/s en pasillo y saturaría; ver Decisions).
  - Power-pellet y fruta → `/ball-bounce.mp3` (sin throttle, eventos raros).
  - Comer fantasma → `/break-sound.mp3`.
  - Muerte de Pac-Man y fin de partida → `/break-sound.mp3`.
- HUD interno del canvas: score en la banda superior izquierda, nivel en la
  superior derecha; vidas restantes e indicador de fruta activa en la banda
  inferior.
- Callbacks solo cuando el valor cambia; `onLivesChange(0)` se dispara justo
  antes de `onGameOver(finalScore)`.
- Prop `paused: boolean` — congela el loop sin redibujar (patrón P2 del
  spec 12).
- Los **7 patrones de performance del spec 12** (P1 constantes de módulo para
  arrays del RAF, P2 saltar `draw()` en pausa, P3 timers acotados con módulo,
  P4 lookups O(1) precomputados — aquí, **adyacencias del grid precomputadas
  por maze**, P5 `React.memo` en el componente canvas, P6 HUD a refs + DOM
  directo en la play-page, P7 pre-render del laberinto estático en canvas
  offscreen, redibujado solo al cambiar de maze o skin) son **requisito desde
  la primera implementación**, no una optimización posterior.
- Estructura skineable siguiendo el patrón de
  `TetrisGame`/`SnakeGame`/`PongGame`/`RoadFighterGame`: mapa `SKINS` interno
  de draw-functions consultado vía prop `skinKey`, arrancando solo con
  `classic`. Los skins `retro` y `neon` los define `@skin-designer` **como
  último paso** de la cadena
  (implementación → `@mobile-porter` → `@skin-designer`).
- Limpiar event listeners de teclado y el RAF en el `return` del `useEffect`.
- Crear `app/games/pacman/play/page.tsx` — play-page específica siguiendo el
  patrón de `app/games/road-fighter/play/page.tsx` (sin selector de modo):
  - Refs de HUD + DOM directo (P6); `paused`/`over`/`name`/`saved`/`gameKey`/
    `skinKey` como estado de usuario.
  - HUD React estándar: jugador, puntuación, vidas (3 corazones), nivel, skin.
  - Auth: `useUser()` — `username` autocompleta el nombre del modal; fallback
    a `localStorage.getItem('av_player_name')`; el insert en `scores` lleva
    `user_id: user?.id ?? null`.
  - Modal fin de partida con flujo estándar de guardado en Supabase, botón
    deshabilitado tras el primer envío, y "JUGAR DE NUEVO" (`gameKey + 1`).
- **Leaderboard realtime en `/games/pacman`**: añadir `'pacman'` a la
  constante `REALTIME_GAMES` de `app/games/[id]/LiveLeaderboard.tsx` (patrón
  validado en specs 15 y 16 — un cambio de una línea; la publicación
  `supabase_realtime` sobre `public.scores` ya está habilitada).
- Añadir la clase CSS `.cover-pacman` en `app/globals.css` para la card del
  catálogo (fondo azul oscuro de laberinto con puntos amarillos, coherente
  con las demás covers).
- Actualizar `references/implemented-games.md` con la fila de `pacman` al
  terminar.

**Fuera de alcance:**

- Generación aleatoria/procedural de laberintos — **descartada en
  brainstorming** por riesgo de mapas injustos o irresolubles (ver Decisions).
- Vida extra por puntuación (los 10.000 pts del clásico).
- Los bugs históricos del arcade (overflow de Pinky/Inky mirando arriba,
  kill screen del nivel 256) — se implementa el comportamiento *intencional*.
- Frutas con sprites y valores distintos por nivel (cereza, fresa...) — una
  única fruta genérica con valor `100 × nivel`.
- Animaciones elaboradas de muerte o intermisiones entre niveles.
- Modo 2 jugadores por turnos del arcade.
- Control por ratón o touch directo sobre el canvas.
- Integración de `MobileGamepad` en la play-page — la hará `@mobile-porter`
  (segundo paso de la cadena) siguiendo el spec 10 con D-pad de 4 direcciones
  estilo Frogger; este spec garantiza no impedirlo (input 100 % por teclado
  con alias flechas + WASD).
- Los skins `retro` y `neon` — los define `@skin-designer` como **último**
  paso.
- Toggle de mute / assets de sonido nuevos.
- Cambios en tablas, políticas RLS, triggers o publicaciones de Supabase —
  solo el insert del catálogo.
- La tabla de sugerencias del `game-planner` — la actualiza el propio agente,
  no este spec.

---

## Data model

### Migración en Supabase — tabla `games`

Archivo `supabase/migrations/<timestamp>_add_pacman_game.sql`:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'pacman',
  'PAC-MAN',
  'Come todos los puntos del laberinto sin que los cuatro fantasmas te atrapen.',
  'El comecocos original: recorre el laberinto engullendo cada punto mientras Blinky, Pinky, Inky y Clyde te acorralan, cada uno con su propia manía. Traga una píldora de poder y cázalos tú a ellos para encadenar 200, 400, 800 y 1600 puntos. Tres laberintos en rotación, fruta de bonus y una dificultad que nunca deja de apretar: tienes 3 vidas y ningún sitio donde esconderte.',
  'MAZE',
  'cover-pacman',
  'yellow'
)
on conflict (id) do nothing;
```

`MAZE` es una categoría nueva en el catálogo — la columna `cat` es texto
libre, no requiere cambios de esquema.

### Geometría y leyenda de los mazes

```ts
const TILE = 16;
const GRID_COLS = 28;
const GRID_ROWS = 31;
const HUD_BAND_H = 32; // banda superior e inferior del HUD interno
const W = GRID_COLS * TILE;              // 448
const H = GRID_ROWS * TILE + HUD_BAND_H * 2; // 560
```

Los 3 mazes son constantes de módulo `MAZES: string[][]` — cada maze es un
array de 31 strings de 28 caracteres. **Leyenda del formato de celda:**

| Símbolo | Celda                                                                  |
| ------- | ---------------------------------------------------------------------- |
| `#`     | Muro (intransitable para todos)                                        |
| `.`     | Pasillo con pellet (10 pts)                                            |
| `o`     | Pasillo con power-pellet (50 pts + frightened)                         |
| ` `     | Pasillo vacío, sin pellet                                              |
| `-`     | Puerta de la casa (solo fantasmas: saliendo, o entrando como ojos)     |
| `H`     | Interior de la casa de fantasmas (spawns de Pinky, Inky y Clyde)       |
| `T`     | Celda de túnel en el borde: wrap horizontal; fantasmas al 60 % (`TUNNEL_SPEED_FACTOR`) |
| `P`     | Spawn de Pac-Man (cuenta como pasillo vacío)                           |
| `F`     | Celda de la fruta (cuenta como pasillo vacío)                          |

Requisitos por maze (verificados por el validador de desarrollo):

- Dimensiones exactas 28 × 31; todas las filas de igual longitud.
- Exactamente 4 `o` (una por cuadrante, cerca de las esquinas), 1 `P`, 1 `F`
  y ~230–250 `.`.
- Al menos un túnel: celdas `T` emparejadas en la misma fila en ambos bordes.
- Casa central con puerta `-` y ≥3 celdas `H`; el spawn de Blinky es la celda
  transitable inmediatamente sobre la puerta (derivado en el parse).
- **Flood-fill desde `P`**: todos los `.` y `o` alcanzables sin atravesar
  `#` ni `-`. El validador corre solo con
  `process.env.NODE_ENV !== 'production'` y lanza `throw` con el maze y la
  celda ofensora — assertion de desarrollo, cero coste en prod.

El dibujo artesanal de los 3 layouts es trabajo de implementación (paso 2);
el spec fija el contrato, no el arte.

### Adyacencias precomputadas (P4)

Al parsear cada maze se precomputa una única vez:

```ts
// Por maze: salidas legales de cada celda como bitmask UP|LEFT|DOWN|RIGHT
type MazeData = {
  rows: string[];
  exits: Uint8Array;           // GRID_COLS × GRID_ROWS, bitmask de salidas
  pellets: Set<number>;        // índices de celda con pellet (mutable por nivel: se clona)
  powerPellets: Set<number>;   // ídem para power-pellets
  pacmanSpawn: number;         // índice de celda
  fruitCell: number;
  ghostHouse: { door: number; inside: number[]; blinkySpawn: number };
  tunnelRows: number[];
};
```

El hot path (decisiones de fantasmas, giros de Pac-Man) consulta `exits` en
O(1); nunca se re-escanea el array de strings durante el juego.

### Constantes de tuning

Constantes de módulo en `PacmanGame.tsx` (valores iniciales, ajustables en QA):

```ts
const PACMAN_SPEED = 140;        // px/s (~8.75 celdas/s)
const TURN_TOLERANCE = 4;        // px de snap al centro de celda para girar
const COLLISION_DIST = 8;        // px entre centros para colisión Pac-Man/fantasma
const START_LIVES = 3;

const PELLET_POINTS = 10;
const POWER_PELLET_POINTS = 50;
const GHOST_CHAIN_POINTS = [200, 400, 800, 1600]; // reset con cada power-pellet
const FRUIT_POINTS_PER_LEVEL = 100;  // fruta = 100 × nivel
const FRUIT_TRIGGER_PELLETS = [70, 170]; // pellets comidos del nivel que la invocan
const FRUIT_DURATION_MS = 9000;

const FRIGHTENED_SPEED_FACTOR = 0.55; // sobre la velocidad del fantasma del nivel
const FRIGHTENED_FLASH_MS = 2000;     // los últimos 2 s parpadea en blanco
const EYES_SPEED_FACTOR = 1.5;        // ojos volviendo a casa
const TUNNEL_SPEED_FACTOR = 0.6;      // fantasmas dentro de celdas T

const CHASE_S = 20;                   // duración fija de cada fase chase
const SCATTER_CYCLES = 4;             // tras el 4º scatter → chase permanente

const GHOST_RELEASE_PELLETS = { pinky: 0, inky: 30, clyde: 60 };
const GHOST_RELEASE_FALLBACK_MS = 4000; // sin comer pellets, libera al siguiente

const PELLET_SOUND_THROTTLE_MS = 150;
const DEATH_PAUSE_MS = 1200;
const LEVEL_BANNER_MS = 1200;         // banner READY / nivel completado
```

### Tabla de escalado por nivel

Array de módulo `DIFFICULTY`; el nivel efectivo se clampea:
`DIFFICULTY[Math.min(level, 12) - 1]`. Desde el nivel 12 los valores quedan
estables (frightened ya en 0).

| Nivel | `ghostSpeedFactor` (× `PACMAN_SPEED`) | `scatterS` | `frightenedS` |
| ----- | ------------------------------------- | ---------- | ------------- |
| 1     | 0.75                                  | 7          | 6             |
| 2     | 0.80                                  | 7          | 5             |
| 3     | 0.83                                  | 6          | 4             |
| 4     | 0.86                                  | 6          | 3             |
| 5     | 0.89                                  | 5          | 3             |
| 6     | 0.91                                  | 5          | 2             |
| 7     | 0.93                                  | 4          | 2             |
| 8     | 0.95                                  | 4          | 2             |
| 9     | 0.97                                  | 3          | 1             |
| 10    | 0.98                                  | 3          | 1             |
| 11    | 0.98                                  | 3          | 1             |
| 12+   | 0.98                                  | 3          | **0**         |

Con `frightenedS === 0`, el power-pellet sigue dando 50 pts y sigue forzando
la reversa de los fantasmas, pero no hay fase azul ni cadena.

### IA de fantasmas — targets y reglas

**Máquina global de modos** (compartida por los 4 fantasmas):

- Ciclo por nivel: `scatter(scatterS) → chase(CHASE_S)`, repetido
  `SCATTER_CYCLES` veces; tras el 4º scatter, **chase permanente** hasta
  acabar el nivel.
- Power-pellet → modo **frightened** durante `frightenedS` (si > 0). El timer
  scatter/chase se **pausa** durante frightened y se reanuda donde estaba.
- Todo cambio de modo (scatter↔chase, entrada en frightened) fuerza a cada
  fantasma activo a **invertir su dirección** — única excepción a la regla de
  no-reversa. Los ojos ignoran los modos.

**Regla de decisión en intersección** (fantasmas en scatter/chase): al llegar
al centro de una celda con más de una salida, elegir la salida que minimiza
la **distancia euclídea al target**; prohibido elegir la reversa (giro 180°).
Desempate por prioridad fija `up > left > down > right` (regla clásica).
Si por construcción ninguna salida es legal (callejón), la reversa se permite
como último recurso.

**Targets en chase:**

| Fantasma | Target                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------- |
| Blinky   | La celda actual de Pac-Man.                                                                        |
| Pinky    | 4 celdas por delante de Pac-Man en su dirección actual (sin reproducir el bug del original con ↑). |
| Inky     | `blinky + 2 × (p2 − blinky)`, donde `p2` = 2 celdas por delante de Pac-Man — el vector desde Blinky hasta ese punto, duplicado. |
| Clyde    | Si su distancia euclídea a Pac-Man > 8 celdas → la celda de Pac-Man; si ≤ 8 → su esquina de scatter. |

**Targets en scatter** (esquinas del maze, constantes por maze derivadas del
parse): Blinky arriba-derecha, Pinky arriba-izquierda, Inky abajo-derecha,
Clyde abajo-izquierda. Los targets pueden ser celdas de muro — solo son
puntos de atracción para la métrica, nunca se "alcanzan".

**Frightened:** en cada intersección el fantasma elige salida
**pseudo-aleatoria uniforme** entre las legales (sin reversa), a
`FRIGHTENED_SPEED_FACTOR` de su velocidad. Comido → cadena de puntos y pasa a
**ojos**: target fijo = puerta de la casa, velocidad `EYES_SPEED_FACTOR`,
sin colisión con Pac-Man; al llegar dentro, revive y vuelve a salir.

**Casa y salidas escalonadas:** Blinky empieza sobre la puerta (fuera).
Pinky sale inmediatamente (umbral 0), Inky a los 30 pellets comidos del nivel
y Clyde a los 60 (`GHOST_RELEASE_PELLETS`); si pasan
`GHOST_RELEASE_FALLBACK_MS` sin comer ningún pellet, el siguiente fantasma
encerrado sale igualmente. Tras una muerte de Pac-Man, los contadores del
nivel se conservan pero el fallback re-libera con normalidad.

### Modelo de puntuación

Un único `score` numérico, monótono creciente y sin tope — compatible con la
columna `score` de la tabla `scores` y con el leaderboard global. **Valores
clásicos, sin multiplicador de nivel** (decisión cerrada, ver Decisions):

| Evento                                | Puntos                          |
| ------------------------------------- | ------------------------------- |
| Pellet                                | `10`                            |
| Power-pellet                          | `50`                            |
| Fantasma n.º 1/2/3/4 de la misma cadena | `200 / 400 / 800 / 1600`      |
| Fruta                                 | `100 × nivel`                   |
| Muerte                                | `0` y −1 vida                   |

- La cadena de fantasmas se resetea con **cada** power-pellet.
- La partida arranca con `lives = 3`, `score = 0`, `level = 1`, maze 1.
- Nivel completado = 0 pellets y 0 power-pellets restantes → `LEVEL_BANNER_MS`
  de banner, `level + 1`, siguiente maze de la rotación, posiciones y timers
  reseteados.
- Game over cuando `lives` llega a 0 → `onLivesChange(0)` + `onGameOver(score)`.

### Props del componente `PacmanGame`

```ts
interface PacmanGameProps {
  paused: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

### Realtime — leaderboard de `/games/pacman`

Cambio de una línea en `app/games/[id]/LiveLeaderboard.tsx`:

```ts
const REALTIME_GAMES = ['pong', 'road-fighter', 'pacman'];
```

El resto del mecanismo (suscripción `postgres_changes` filtrada por
`game_id`, merge local sin refetch, cleanup del canal) ya existe desde el
spec 15 y la publicación `supabase_realtime` sobre `public.scores` ya está
habilitada — no hay requisito de infraestructura nuevo.

### Audio

| Evento                          | Asset                                                     |
| ------------------------------- | --------------------------------------------------------- |
| Pellet comido                   | `/ball-bounce.mp3` con throttle de `PELLET_SOUND_THROTTLE_MS` |
| Power-pellet / fruta            | `/ball-bounce.mp3` (sin throttle)                         |
| Comer fantasma                  | `/break-sound.mp3`                                        |
| Muerte de Pac-Man / fin de partida | `/break-sound.mp3`                                     |

No se introducen tablas ni tipos TypeScript nuevos — se reutilizan `GameRow`
y `ScoreRow` de `lib/supabase/types.ts`.

---

## Implementation plan

1. **Migración SQL + cover** — crear
   `supabase/migrations/<timestamp>_add_pacman_game.sql` con el insert del
   data model y aplicarla. Añadir `.cover-pacman` en `app/globals.css`.
   Verificación: la fila `pacman` aparece en el Table Editor; `/games`
   muestra la card con cover `cover-pacman`, color `yellow`, categoría MAZE.

2. **Mazes + parser + validador + adyacencias** — en `PacmanGame.tsx` (o
   módulo hermano si supera las ~400 líneas de arte): las constantes `MAZES`
   con los 3 laberintos artesanales según la leyenda, el parser a `MazeData`
   (pellets, spawns, casa, túneles, `exits` como `Uint8Array` — P4) y el
   validador de desarrollo (dimensiones, conteos, flood-fill desde `P`).
   Verificación: la app arranca en dev sin `throw` del validador; romper un
   maze a propósito (pellet emparedado) hace fallar el validador con celda y
   maze señalados.

3. **Núcleo jugable sin fantasmas** — `PacmanGame.tsx` con canvas 448 × 560,
   loop RAF con delta time: movimiento continuo de Pac-Man con input
   bufferizado (flechas + WASD sobre `document`), túneles con wrap, comer
   pellets/power-pellets con score, HUD interno (score, nivel, vidas,
   fruta), fruta con triggers 70/170 y expiración, nivel completado →
   rotación de maze y dificultad +1. Muros pre-renderizados en canvas
   offscreen por maze/skin (P7); `paused` congela con frame único (P2); mapa
   `SKINS` con `classic`; export con `React.memo` (P5); sonido de pellet con
   throttle; cleanup de listeners y RAF.
   Verificación: se puede "completar" un nivel comiendo todo y el maze rota
   con banner; el sonido de pellet no satura en pasillos largos.

4. **Play-page** — crear `app/games/pacman/play/page.tsx` siguiendo el
   patrón de `app/games/road-fighter/play/page.tsx`: `dynamic(...,
   { ssr: false })`, HUD con refs + DOM directo (P6), auth con `useUser()`,
   modal de guardado (`{ game_id: 'pacman', player_name, score, user_id:
   user?.id ?? null }`, botón deshabilitado tras el primer envío), botones
   "PAUSA" y "JUGAR DE NUEVO" (`gameKey + 1`, HUD reseteado a 0/3/1).
   **Sin** `MobileGamepad` (lo integra `@mobile-porter`).
   Verificación: partida completa (aún sin fantasmas) de principio a fin; un
   score guardado aparece en `/games/pacman` y `/hall-of-fame`.

5. **Fantasmas: casa, scatter↔chase y personalidades** — los 4 fantasmas con
   spawns del parse, salidas escalonadas por contador de pellets + fallback,
   máquina global scatter↔chase con timers de la tabla, targets de chase y
   scatter del data model, regla de decisión euclídea con desempate
   `up > left > down > right`, no-reversa salvo cambio de modo, slowdown en
   túnel, colisión por `COLLISION_DIST` → muerte, pausa, respawn, −1 vida y
   game over a 0 vidas.
   Verificación: los 4 fantasmas exhiben comportamientos distinguibles
   (Blinky sigue, Pinky corta el paso, Clyde se retira de cerca); en scatter
   cada uno circula por su esquina; ninguno gira 180° salvo al cambiar el
   modo global.

6. **Frightened, cadena y ojos** — power-pellet → frightened con velocidad
   reducida, movimiento pseudo-aleatorio, parpadeo final
   (`FRIGHTENED_FLASH_MS`), cadena 200/400/800/1600 con reset por
   power-pellet, ojos a `EYES_SPEED_FACTOR` hacia la puerta, revivir y
   re-salir; pausa del timer scatter/chase durante frightened; `frightenedS`
   por nivel hasta 0 en el 12 (solo reversa).
   Verificación: comer los 4 fantasmas de una cadena suma exactamente 3000;
   el segundo power-pellet reinicia la cadena en 200; en nivel ≥12 (forzable
   bajando la tabla temporalmente) el power-pellet no genera fase azul.

7. **Realtime** — añadir `'pacman'` a `REALTIME_GAMES` en
   `app/games/[id]/LiveLeaderboard.tsx`.
   Verificación: con `/games/pacman` abierto, guardar un score desde otra
   pestaña hace aparecer la fila en el top 10 sin recargar; los juegos no
   listados siguen estáticos.

8. **Actualizar `references/implemented-games.md`** — añadir la fila de
   `pacman` (MAZE, yellow) siguiendo el formato existente.
   Verificación: la tabla lista `pacman`.

9. **Verificación final** — `npm run build` termina sin errores de
   TypeScript. Ninguna ruta existente devuelve 500.

---

## Acceptance criteria

- [ ] La migración `add_pacman_game` existe en `supabase/migrations/` con `on conflict (id) do nothing` y está aplicada.
- [ ] La fila `pacman` existe en la tabla `games` con `cat = 'MAZE'` y `color = 'yellow'` — primera del catálogo en esa categoría.
- [ ] No se ha creado ni modificado ninguna política RLS, tabla ni publicación.
- [ ] La card de PAC-MAN aparece en `/games` con cover `cover-pacman`.
- [ ] La ruta `/games/pacman/play` carga sin errores de SSR ni de TypeScript.
- [ ] Los 3 mazes pasan el validador en dev (dimensiones 28 × 31, 4 `o`, 1 `P`, 1 `F`, túneles emparejados, flood-fill completo) y el validador no corre en el build de producción.
- [ ] Pac-Man responde a flechas y a WASD; el input bufferizado permite "pre-girar" antes de llegar a la intersección.
- [ ] Los túneles laterales hacen wrap horizontal para Pac-Man y fantasmas; los fantasmas van más lentos dentro del túnel.
- [ ] Comer un pellet suma 10 y un power-pellet 50; el contador de pellets del HUD/estado decrece hasta 0.
- [ ] Con 0 pellets y 0 power-pellets aparece el banner de nivel, el maze rota 1 → 2 → 3 → 1 y el nivel sube 1.
- [ ] La velocidad de los fantasmas y las fases scatter/frightened siguen la tabla `DIFFICULTY` y quedan estables desde el nivel 12.
- [ ] En scatter cada fantasma circula hacia su esquina asignada; en chase Blinky apunta a Pac-Man, Pinky 4 celdas por delante, Inky con el vector reflejado desde Blinky y Clyde alterna persecución/retirada según la distancia de 8 celdas.
- [ ] Ningún fantasma gira 180° salvo en un cambio de modo global (o como último recurso en un callejón).
- [ ] Cada cambio scatter↔chase y cada power-pellet fuerzan la reversa de los fantasmas activos.
- [ ] Pinky, Inky y Clyde salen de la casa a 0/30/60 pellets comidos, y el timer de respaldo de 4 s libera al siguiente si no se come.
- [ ] El power-pellet activa frightened (fantasmas azules, lentos, movimiento pseudo-aleatorio) durante los segundos de la tabla, con parpadeo en los últimos 2 s.
- [ ] Comer 4 fantasmas en una cadena suma 200 + 400 + 800 + 1600 = 3000; un nuevo power-pellet reinicia la cadena en 200.
- [ ] Un fantasma comido vuelve como ojos (rápido, sin colisión) a la casa, revive y vuelve a salir.
- [ ] En niveles con `frightenedS = 0` el power-pellet suma 50 y revierte a los fantasmas, sin fase azul ni cadena.
- [ ] La fruta aparece en su celda al comer 70 y 170 pellets del nivel, expira a los ~9 s y suma `100 × nivel`.
- [ ] Tocar un fantasma no-frightened resta 1 vida, reproduce `break-sound.mp3`, pausa brevemente y respawnea a Pac-Man y a los fantasmas conservando los pellets comidos.
- [ ] Con 0 vidas hay game over: `onLivesChange(0)` seguido de `onGameOver(score)`.
- [ ] El sonido de pellet respeta el throttle (nunca más de una reproducción por `PELLET_SOUND_THROTTLE_MS`); ningún error de autoplay rompe el juego (`.catch(() => {})` presente).
- [ ] El HUD interno del canvas muestra score, nivel, vidas y fruta activa en las bandas superior/inferior.
- [ ] El HUD React refleja en tiempo real puntuación/vidas/nivel sin re-renders durante gameplay (P6, verificable con React DevTools Profiler).
- [ ] El botón "PAUSA" congela el game loop y el canvas no se redibuja en pausa (P2, verificable con `console.count('draw')` temporal).
- [ ] No hay literales de array creados dentro del loop RAF (P1), ni timers/acumuladores sin acotar (P3); las decisiones de fantasmas y giros consultan las adyacencias precomputadas, sin re-escanear los strings del maze (P4).
- [ ] El laberinto estático (muros) se dibuja desde un canvas offscreen regenerado solo al cambiar de maze o skin (P7).
- [ ] `PacmanGame` se exporta con `React.memo` (P5).
- [ ] Con sesión iniciada, el modal pre-rellena el nombre con el `username` y el insert lleva `user_id`; sin sesión, usa `av_player_name` y `user_id = null`.
- [ ] El botón de guardar se deshabilita tras el primer envío (sin doble inserción).
- [ ] `REALTIME_GAMES` incluye `'pacman'`; con `/games/pacman` abierto, un INSERT en `scores` con `game_id = 'pacman'` aparece en el top 10 sin recargar.
- [ ] "JUGAR DE NUEVO" reinicia score/vidas/nivel a 0/3/1 en canvas y HUD, con el maze 1.
- [ ] `references/implemented-games.md` incluye la fila de `pacman`.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: 3 laberintos fijos artesanales rotando 1 → 2 → 3 → 1; no: generación
  aleatoria** — decisión cerrada en brainstorming. Razón: un generador
  procedural puede producir mapas injustos (power-pellets pegados a la casa,
  pasillos sin escapatoria) o directamente irresolubles, y validar justicia
  algorítmicamente es un proyecto en sí mismo. Tres mazes artesanales dan
  variedad perceptible con calidad garantizada a mano, y el validador de
  flood-fill protege contra errores de transcripción, no de diseño.

- **Sí: endless con dificultad creciente hasta estabilizarse (~nivel 10) y
  3 vidas** — decisión cerrada. Razón: el leaderboard premia partidas largas
  (mismo argumento que Pong y Road Fighter); un final acotado produciría
  scores con techo. La estabilización evita que el juego se vuelva
  matemáticamente imposible: el techo de dificultad es "muy difícil", no
  "injugable".

- **Sí: puntuación clásica SIN multiplicador de nivel** — decisión cerrada,
  rompe deliberadamente con el patrón `× nivel` de Pong/Frogger/Road Fighter.
  Razón: los valores 10/50/200-400-800-1600 son icónicos y el reconocimiento
  del clásico es parte del atractivo; además el endless ya premia llegar
  lejos por sí solo (más niveles = más pellets y más cadenas comidas). La
  fruta a `100 × nivel` es el único incentivo escalado, como en el arcade
  (frutas de más valor en niveles altos).

- **Sí: las 4 personalidades clásicas con targets exactos y máquina global
  scatter↔chase** — decisión cerrada. Razón: las personalidades son *la*
  esencia de Pac-Man — cuatro perseguidores idénticos convertirían el juego
  en un maze-runner genérico; los targets clásicos están documentados,
  producen el comportamiento de pinza reconocible y son baratos (una resta
  de vectores por intersección).

- **Sí: no reproducir los bugs del arcade original (overflow de Pinky/Inky
  con ↑, kill screen)** — decisión de este spec. Razón: son accidentes de la
  implementación original en Z80, no diseño; replicarlos añade casos
  especiales sin valor para quien no conoce la trivia.

- **Sí: desempate de intersección `up > left > down > right` y no-reversa
  salvo cambio de modo** — regla clásica, decisión de este spec. Razón: el
  desempate determinista hace el comportamiento reproducible y depurable; la
  no-reversa es lo que obliga a los fantasmas a patrullar en vez de vibrar; y
  la reversa forzada al cambiar de modo es la señal legible que da al jugador
  el aviso de que el ciclo ha cambiado.

- **Sí: scatter↔chase con `SCATTER_CYCLES = 4` y chase permanente después;
  frightened pausa el timer** — decisión de este spec (el clásico usa un
  esquema por-nivel más complejo). Razón: una tabla de ciclos por nivel
  multiplicaría constantes de tuning sin cambiar la sensación; 4 respiros de
  scatter y presión total después reproduce la curva percibida del original
  con 2 constantes.

- **Sí: salida de casa por contadores de pellets (0/30/60) + timer de
  respaldo** — decisión de este spec, simplificación del sistema de
  contadores individuales del arcade. Razón: escalona la presión inicial
  igual que el original con una fracción de su complejidad; el fallback evita
  el softlock de un jugador que deja de comer para "congelar" a Clyde en
  casa.

- **Sí: movimiento continuo con input bufferizado y giros con snap
  (`TURN_TOLERANCE`)** — decisión de este spec. Razón: el pre-giro
  bufferizado es lo que hace que Pac-Man se sienta responsivo en vez de
  torpe; sin tolerancia de snap, acertar el frame exacto del centro de celda
  a 60 fps es frustrante e injugable en mobile.

- **Sí: fruta 2 veces por nivel a los 70 y 170 pellets, expira a ~9 s, en la
  celda central** — umbrales de este spec tomados del arcade. Razón: ligarla
  a pellets comidos (no a tiempo) la hace justa a cualquier ritmo de juego y
  es un umbral trivial de comprobar.

- **Sí: sonido de pellet = `ball-bounce.mp3` con throttle de 150 ms, en vez
  de silencio** — decisión de este spec (el brainstorming dejó elegir entre
  throttle o silencio). Razón: comer pellets es *el* feedback central del
  juego y en un pasillo se come uno cada ~110 ms — sin throttle se saturaría
  el mixer con clones solapados; con throttle a 150 ms suena como un
  tableteo rítmico aceptable. Si en QA sigue resultando molesto, bajar a
  silencio es borrar una línea (la constante queda documentada para eso).

- **Sí: adyacencias del grid precomputadas como `Uint8Array` por maze (P4)**
  — requisito de la integración estándar. Razón: fantasmas y giros consultan
  salidas legales varias veces por frame; un bitmask por celda computado una
  vez en el parse elimina todo string-scanning del hot path.

- **Sí: muros pre-renderizados en canvas offscreen por maze/skin (P7)** —
  decisión de este spec. Razón: el laberinto son ~500 celdas de muro
  estáticas; redibujarlas por frame es el equivalente al problema de
  `shadowBlur` del spec 12 en cuanto llegue el skin neon. Pre-render una vez
  por nivel + `drawImage` por frame lo resuelve para los 3 skins de una vez.

- **Sí: validador de mazes como assertion solo en desarrollo** — decisión
  cerrada. Razón: los mazes son constantes — si son válidos en dev lo son en
  prod; pagar el flood-fill en cada carga de producción no aporta nada.

- **Sí: canvas 448 × 560 con bandas de HUD de 32 px** — decisión de este
  spec. Razón: 28 × 31 celdas a 16 px dan 448 × 496 exactos; las bandas
  replican la composición del arcade (score arriba, vidas/fruta abajo) sin
  invadir el laberinto y mantienen proporción vertical coherente con el CRT
  de la plataforma.

- **Sí: cadena de agentes = implementación → `@mobile-porter` (D-pad 4
  direcciones estilo Frogger) → `@skin-designer` (skins al FINAL)** —
  decisión cerrada, vigente desde Pong. Razón: portar a mobile antes de
  skinear evita que `@skin-designer` trabaje sobre un componente que aún va a
  recibir cambios. Nota: invierte el orden por defecto del skill
  `/spec-impl-game` — para este juego manda este spec.

- **Sí: los 7 patrones del spec 12 desde el primer commit** — evita una
  pasada posterior de `@game-performance-booster` sobre código recién
  escrito.

- **Sí: realtime por la constante `REALTIME_GAMES`** — un cambio de una
  línea; patrón validado en specs 15 y 16.

- **No: vida extra a los 10.000 puntos** — en un endless con score sin techo
  regalaría vidas sin fin o exigiría umbrales crecientes; es una decisión de
  producto aparte si algún día se quiere.

- **No: frutas diferenciadas por nivel (cereza, fresa, ...)** — son solo
  sprites y una tabla de valores; `100 × nivel` da la misma progresión sin
  8 assets nuevos. Candidata natural para la pasada de `@skin-designer` o un
  spec de ampliación.

- **No: modo 2 jugadores por turnos del arcade** — no aporta nada online y la
  plataforma no tiene noción de turnos; el hueco competitivo lo cubre el
  leaderboard.

- **No: políticas RLS nuevas** — specs 04 y 14 ya cubren `games` (SELECT
  público) y `scores` (INSERT asegurado); el catálogo solo necesita la fila
  nueva.

---

## Riesgos identificados

| Riesgo                                                                    | Mitigación                                                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Maze artesanal con pellet inalcanzable o túnel desemparejado               | Validador de desarrollo con flood-fill y conteos que lanza `throw` señalando maze y celda; criterio de aceptación dedicado.                                   |
| Tuning de dificultad: tabla demasiado dura frustra, blanda aburre          | Toda la curva vive en la tabla `DIFFICULTY` y constantes de módulo; QA manual jugando ≥5 niveles antes de cerrar el paso 6.                                  |
| Fantasma atascado (en la casa, como ojos, o vibrando en una intersección)  | Ojos con target fijo de puerta; fallback de reversa en callejón; timer de respaldo de salida de casa; desempate determinista que elimina la indecisión.       |
| Cadencia del sonido de pellet molesta pese al throttle                     | `PELLET_SOUND_THROTTLE_MS` como constante ajustable; degradar a silencio es borrar una llamada (documentado en Decisions).                                    |
| Colisión perdida por tunneling entre frames                                | A velocidades máximas (~140–137 px/s) el desplazamiento por frame a 60 fps es ~2.3 px « `COLLISION_DIST` — sin riesgo real; comprobación por distancia cada frame. |
| Coste de dibujo del laberinto + ~240 pellets por frame                     | Muros a offscreen canvas (P7); los pellets se dibujan desde los `Set` mutables (solo los vivos), coste decreciente durante la partida.                        |
| El escalado "estable desde nivel 10–12" hace las partidas largas monótonas | Aceptado: es la decisión cerrada de endless jugable; el riesgo real (imposibilidad matemática) queda cubierto por el tope de velocidad < velocidad de Pac-Man. |
| Scores de PAC-MAN no comparables con otros juegos en `/hall-of-fame`       | Aceptado: el leaderboard es por juego (tabs); no se normaliza entre juegos.                                                                                   |

---

## Qué **no** entra en este spec

- Generación procedural de laberintos — descartada, no diferida.
- Vida extra por puntuación, frutas diferenciadas, intermisiones, bugs
  históricos del arcade, modo 2P por turnos.
- Controles táctiles / `MobileGamepad` — los añade `@mobile-porter` siguiendo
  el spec 10 (D-pad de 4 direcciones estilo Frogger), antes de los skins.
- Skins `retro` y `neon` — los aplica `@skin-designer` como **último** paso
  de la cadena (implementación → `@mobile-porter` → `@skin-designer`).
- Ratón, toggle de mute, assets de sonido nuevos.
- Cambios en tablas, políticas RLS o publicaciones de Supabase.
- La tabla de sugerencias del `game-planner`.

Cada uno de ellos, si llega, va en su propio spec o en la pasada de su agente.
