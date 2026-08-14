# SPEC 16 — Integración del juego Road Fighter

> **Estado:** Aprobado
> **Depende de:** 06-games-table-leaderboard-supabase, 10-mobile-touch-controls,
> 12-frogger-performance, 13-supabase-auth, 14-security-rls-password-headers, 15-pong
> **Fecha:** 2026-08-14
> **Objetivo:** Integrar Road Fighter con ID `road-fighter` (primera entrada de la
> categoría RACING, color `red`) como juego de conducción top-down con scroll
> vertical, gestión de combustible y spawning de tráfico con carril transitable
> garantizado — con leaderboard realtime y aplicando desde el primer commit los
> 7 patrones de performance del spec 12.

---

## Scope

**In:**

- Migración SQL `supabase/migrations/<timestamp>_add_road_fighter_game.sql` que
  inserta la fila `road-fighter` en la tabla `games` con
  `on conflict (id) do nothing` (mismo formato que `20260813132835_add_pong_game.sql`).
  RLS ya está activo (specs 04 y 14) — **no** se crea ninguna política nueva, solo
  el insert del catálogo. `RACING` es categoría nueva; la columna `cat` es texto
  libre, no requiere cambios de esquema.
- Crear `components/games/RoadFighterGame.tsx` — componente React `"use client"`
  que encapsula el canvas (480 × 640 px, orientación vertical) y el game loop
  completo. Acepta props: `paused`, `skinKey`, `onScoreChange`, `onLevelChange`,
  `onLivesChange`, `onGameOver`.
- Mecánica Road Fighter clásica top-down:
  - La carretera hace scroll vertical hacia abajo a velocidad automática
    (sin acelerar/frenar); el coche del jugador está fijo en la banda inferior
    del canvas y solo se mueve lateralmente.
  - Calzada de 4 carriles lógicos con arcenes a ambos lados; tocar el arcén
    cuenta como choque.
  - Tráfico rival: coches que bajan por la pantalla (más lentos que el scroll,
    por lo que el jugador los rebasa); chocar contra uno cuesta una vida.
  - Movimiento lateral **continuo** en píxeles (no salto discreto de carril),
    fiel al clásico; los carriles son una abstracción del spawner, no del input.
- **Combustible**: depósito que se agota con el tiempo
  (`FUEL_DRAIN_PER_S`, timer acotado — P3) y se rellena recogiendo bidones que
  aparecen en la carretera siempre sobre un carril transitable. Barra de fuel
  dibujada en el HUD interno del canvas (el HUD React estándar no tiene slot
  para fuel).
- **Vidas — una sola tubería de muerte**: la partida arranca con `lives = 3`.
  - Choque (rival o arcén) → −1 vida, explosión breve, respawn centrado en el
    carril libre garantizado con `INVULN_MS` de invulnerabilidad parpadeante.
  - Fuel a 0 → −1 vida y depósito recargado al 100 % (quedarse tirado equivale
    a un choque). Única condición de game over: `lives === 0`.
- **Niveles/tramos**: el nivel sube cada `LEVEL_DISTANCE` píxeles de mundo
  recorridos; cada nivel incrementa (con topes) la velocidad de scroll y la
  densidad de tráfico, y reduce ligeramente la frecuencia de bidones.
- **Spawning justo — requisito de diseño central** (detallado en Data model):
  el generador trabaja por ventanas verticales de spawn sobre los 4 carriles
  lógicos y garantiza en cada ventana ≥1 carril libre; el carril libre solo
  puede desplazarse ±1 carril entre ventanas consecutivas, de modo que el hueco
  siempre es alcanzable lateralmente. Los bidones de fuel solo aparecen en
  carril libre.
- Modelo de puntuación acumulativa (único `score` numérico creciente, ver Data
  model): distancia + bonus por rebase + bonus por bidón, todo multiplicado por
  el nivel.
- Controles de teclado: `←`/`→` **y** alias `A`/`D`, ambos mueven el coche
  lateralmente — así la síntesis de teclado del `MobileGamepad` (spec 10,
  `keyMap`) funciona sin tocar el componente. Sin `↑`/`↓`: la velocidad es
  automática.
- **Efectos de sonido**, reutilizando el patrón de `ArkanoidGame`/`PongGame`
  (`new Audio(...)` una vez + `cloneNode().play().catch(() => {})`):
  - Recoger bidón de fuel → `/ball-bounce.mp3` (asset existente).
  - Choque (rival, arcén o fuel a 0) → `/break-sound.mp3` (asset existente).
  - Fin de partida → `/break-sound.mp3` (reutilizado — sin assets nuevos).
- HUD interno del canvas: score top-left, level top-right, barra de fuel en la
  parte inferior con marca de reserva.
- Callbacks solo cuando el valor cambia; `onLivesChange(0)` se dispara justo
  antes de `onGameOver(finalScore)`.
- Prop `paused: boolean` — congela el loop sin redibujar (patrón P2 del spec 12).
- Los **7 patrones de performance del spec 12** (P1 constantes de módulo para
  arrays del RAF, P2 saltar `draw()` en pausa, P3 timers acotados con módulo,
  P4 lookups O(1) precomputados, P5 `React.memo` en el componente canvas, P6 HUD
  a refs + DOM directo en la play-page, P7 caché de sprites neon si aplica) son
  **requisito desde la primera implementación**, no una optimización posterior.
- Estructura skineable siguiendo el patrón de `TetrisGame`/`SnakeGame`/`PongGame`:
  mapa `SKINS` interno consultado vía prop `skinKey`, arrancando solo con
  `classic`. Los skins `retro` y `neon` los define `@skin-designer` **como
  último paso** de la cadena (implementación → `@mobile-porter` → `@skin-designer`).
- Limpiar event listeners de teclado y el RAF en el `return` del `useEffect`.
- Crear `app/games/road-fighter/play/page.tsx` — play-page específica siguiendo
  el patrón de `app/games/pong/play/page.tsx` (sin selector de modo: un solo
  modo), con:
  - Refs de HUD + DOM directo (P6); `paused`/`over`/`name`/`saved`/`gameKey`/
    `skinKey` como estado de usuario.
  - HUD React estándar: jugador, puntuación, vidas (3 corazones), nivel, skin.
  - Auth: `useUser()` — `username` autocompleta el nombre del modal; fallback a
    `localStorage.getItem('av_player_name')`; el insert en `scores` lleva
    `user_id: user?.id ?? null`.
  - Modal fin de partida con flujo estándar de guardado en Supabase, botón
    deshabilitado tras el primer envío, y "JUGAR DE NUEVO" (`gameKey + 1`).
- **Leaderboard realtime en `/games/road-fighter`**: añadir `'road-fighter'` a
  la constante `REALTIME_GAMES` de `app/games/[id]/LiveLeaderboard.tsx`
  (patrón ya validado con Pong en el spec 15 — un cambio de una línea; la
  infraestructura de publicación `supabase_realtime` sobre `public.scores` ya
  está habilitada).
- Añadir la clase CSS `.cover-road-fighter` en `app/globals.css` para la card
  del catálogo.
- Actualizar `references/implemented-games.md` al terminar con **dos** filas:
  la de `road-fighter` y la de `frogger`, que falta en la tabla (deuda de
  mantenimiento detectada — Frogger está implementado pero no listado).

**Fuera de alcance:**

- Acelerar/frenar con `↑`/`↓` — la velocidad es automática (ver Decisions).
- Curvas, bifurcaciones o tramos de carretera con anchura variable.
- Coches rivales con IA (cambios de carril, embestidas) — el tráfico baja recto.
- Manchas de aceite, charcos y derrapes del clásico.
- Meta / final de tramo con bandera — el juego es endless, tramos = niveles.
- Control por ratón o touch directo sobre el canvas.
- Integración de `MobileGamepad` en la play-page — la hará `@mobile-porter`
  (segundo paso de la cadena) siguiendo el spec 10; este spec garantiza no
  impedirlo (input 100 % por teclado con alias ←/→ y A/D, solo 2 direcciones).
- Los skins `retro` y `neon` — los define `@skin-designer` como **último** paso.
- Toggle de mute / control de volumen.
- Cambios en tablas, políticas RLS, triggers o publicaciones de Supabase — solo
  el insert del catálogo.

---

## Data model

### Migración en Supabase — tabla `games`

Archivo `supabase/migrations/<timestamp>_add_road_fighter_game.sql`:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'road-fighter',
  'ROAD FIGHTER',
  'Esquiva el tráfico a toda velocidad antes de que se agote el depósito.',
  'Carreras clásicas a vista de pájaro: tu coche no frena nunca y la carretera baja cada vez más rápido. Serpentea entre el tráfico, rebasa rivales para sumar puntos y recoge bidones de combustible antes de quedarte tirado. Tienes 3 vidas: cada choque — o cada depósito vacío — te quita una.',
  'RACING',
  'cover-road-fighter',
  'red'
)
on conflict (id) do nothing;
```

`RACING` es una categoría nueva en el catálogo — la columna `cat` es texto libre,
no requiere cambios de esquema.

### Modelo de puntuación

Un único `score` numérico, monótono creciente y sin tope — compatible con la
columna `score` de la tabla `scores` y con el leaderboard global:

| Evento                                         | Puntos       |
| ---------------------------------------------- | ------------ |
| Cada 100 px de mundo recorridos                | `10 × nivel` |
| Rebase (rival sale por el borde inferior)      | `50 × nivel` |
| Bidón de fuel recogido                         | `25 × nivel` |
| Choque o fuel a 0                              | `0` y −1 vida |

- La partida arranca con `lives = 3`, `score = 0`, `level = 1`,
  `fuel = FUEL_MAX`.
- La distancia se acumula en un contador que descarga puntos cada 100 px
  (acumulador con módulo — P3, sin crecimiento numérico ilimitado).
- Un rival cuenta como rebase cuando sale por el borde inferior sin haber
  colisionado con el jugador — un choque consume al rival sin puntuar.
- Game over cuando `lives` llega a 0 → `onLivesChange(0)` + `onGameOver(score)`.

### Niveles y constantes de tuning

Constantes de módulo en `RoadFighterGame.tsx` (valores iniciales, ajustables en QA):

```ts
const LANE_COUNT = 4;             // carriles lógicos del spawner
const LEVEL_DISTANCE = 2000;      // px de mundo por nivel
const SCROLL_BASE_SPEED = 240;    // px/s de scroll en nivel 1
const SCROLL_LEVEL_FACTOR = 0.12; // +12 % de scroll por nivel, con tope
const SCROLL_MAX_SPEED = 560;     // tope de velocidad de scroll
const FUEL_MAX = 100;
const FUEL_DRAIN_PER_S = 4;       // ~25 s de autonomía sin repostar
const FUEL_PICKUP_AMOUNT = 40;    // por bidón, con clamp a FUEL_MAX
const INVULN_MS = 2000;           // invulnerabilidad tras respawn
```

Por nivel: velocidad de scroll `min(SCROLL_BASE_SPEED × (1 + SCROLL_LEVEL_FACTOR × (nivel − 1)), SCROLL_MAX_SPEED)`,
densidad de tráfico creciente (más rivales por ventana de spawn, hasta
`LANE_COUNT − 1`) y frecuencia de bidones ligeramente menor, con suelo mínimo
para que el juego nunca sea matemáticamente imposible por fuel.

### Spawning justo — invariante del carril transitable

El generador de tráfico **no** coloca rivales en posiciones libres al azar:
trabaja por **ventanas de spawn** — bandas horizontales consecutivas de altura
`SPAWN_WINDOW_H` px de mundo que van entrando por el borde superior.

```ts
const SPAWN_WINDOW_H = 260; // altura de cada ventana de spawn en px de mundo

// Estado del spawner (dentro del efecto, no estado React):
let lastGapLane = 1; // carril libre de la última ventana generada
```

Invariantes que el spawner garantiza **por construcción**:

1. **Hueco garantizado:** en cada ventana, al menos 1 de los `LANE_COUNT`
   carriles queda sin rival ni obstáculo en toda la altura de la ventana
   (`gapLane`).
2. **Hueco alcanzable:** `gapLane` de la ventana nueva ∈
   `{lastGapLane − 1, lastGapLane, lastGapLane + 1}` (clampeado a los bordes).
   Con `SPAWN_WINDOW_H` dimensionada para que atravesar un carril lateralmente
   cueste menos tiempo del que tarda una ventana en recorrer la pantalla a
   `SCROLL_MAX_SPEED`, el jugador siempre puede encadenar hueco con hueco.
3. **Densidad acotada:** el nº de rivales por ventana escala con el nivel pero
   nunca ocupa los `LANE_COUNT` carriles (máximo `LANE_COUNT − 1`).
4. **Fuel accesible:** los bidones se colocan siempre en el `gapLane` de su
   ventana — recoger fuel nunca obliga a chocar.

La verificación de este invariante es un criterio de aceptación con test de
observación (ver Acceptance criteria); los valores de `SPAWN_WINDOW_H`, la
velocidad lateral del jugador y `SCROLL_MAX_SPEED` deben mantener la relación
`tiempo_travesía_1_carril < SPAWN_WINDOW_H / SCROLL_MAX_SPEED` documentada como
comentario junto a las constantes.

### Props del componente `RoadFighterGame`

```ts
interface RoadFighterGameProps {
  paused: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

### Realtime — leaderboard de `/games/road-fighter`

Cambio de una línea en `app/games/[id]/LiveLeaderboard.tsx`:

```ts
const REALTIME_GAMES = ['pong', 'road-fighter'];
```

El resto del mecanismo (suscripción `postgres_changes` filtrada por `game_id`,
merge local sin refetch, cleanup del canal) ya existe desde el spec 15 y la
publicación `supabase_realtime` sobre `public.scores` ya está habilitada — no
hay requisito de infraestructura nuevo.

### Audio

| Evento                              | Asset                                       |
| ----------------------------------- | ------------------------------------------- |
| Bidón de fuel recogido              | `/ball-bounce.mp3` (existente, de Arkanoid) |
| Choque (rival, arcén o fuel a 0)    | `/break-sound.mp3` (existente, de Arkanoid) |
| Fin de partida                      | `/break-sound.mp3` (reutilizado)            |

No se introducen tablas ni tipos TypeScript nuevos — se reutilizan `GameRow` y
`ScoreRow` de `lib/supabase/types.ts`.

---

## Implementation plan

1. **Migración SQL + cover** — crear
   `supabase/migrations/<timestamp>_add_road_fighter_game.sql` con el insert del
   data model y aplicarla. Añadir `.cover-road-fighter` en `app/globals.css`
   (fondo rojo oscuro tipo asfalto, coherente con las demás covers).
   Verificación: la fila `road-fighter` aparece en el Table Editor; `/games`
   muestra la card con cover `cover-road-fighter`, color `red`, categoría RACING.

2. **Crear `components/games/RoadFighterGame.tsx` — núcleo jugable** —
   componente `"use client"`:
   - Canvas 480 × 640, loop RAF con delta time: `update(dt)` avanza el scroll,
     mueve el coche con flags de `keydown`/`keyup` (`←`/`→` y `A`/`D` sobre
     `document`), resuelve colisiones AABB contra rivales y arcenes; `draw()`
     pinta carretera (líneas de carril discontinuas con constantes de módulo —
     P1), rivales, bidones, coche y HUD interno.
   - Spawner por ventanas con los 4 invariantes del data model
   	 (`gapLane` ± 1, densidad acotada, fuel en `gapLane`).
   - Fuel drenando con acumulador acotado (P3); choque y fuel a 0 → −1 vida,
     respawn en `gapLane` con `INVULN_MS` de parpadeo.
   - Puntuación y niveles según el data model; `onLivesChange(0)` y
     `onGameOver(score)` al perder la tercera vida.
   - Sonido: precargar `ball-bounce.mp3` y `break-sound.mp3` una vez, reproducir
     con `cloneNode().play().catch(() => {})` en bidón y choque (patrón
     ArkanoidGame/PongGame).
   - `paused` congela el loop dibujando un único frame al entrar en pausa (P2);
     mapa `SKINS` con `classic` + prop `skinKey`; export con `React.memo` (P5);
     listeners y RAF limpiados en el `return` del `useEffect`.
   Verificación: jugable con teclado de principio a fin, con sonido; nunca
   aparece una ventana de tráfico sin hueco alcanzable.

3. **Crear `app/games/road-fighter/play/page.tsx`** — play-page específica
   siguiendo el patrón de `app/games/pong/play/page.tsx` (sin selector de modo):
   - Importa `RoadFighterGame` con `dynamic(..., { ssr: false })`; HUD con refs
     + DOM directo (P6): jugador, puntuación, vidas (corazones), nivel, skin.
   - Auth con `useUser()` y modal de guardado
     (`{ game_id: 'road-fighter', player_name, score, user_id: user?.id ?? null }`,
     botón deshabilitado tras el primer envío); botones "PAUSA" y
     "JUGAR DE NUEVO" (`gameKey + 1`, HUD reseteado a 0/3/1).
   Verificación: partida completa de principio a fin; un score guardado aparece
   en `/games/road-fighter` y `/hall-of-fame`.

4. **Realtime** — añadir `'road-fighter'` a `REALTIME_GAMES` en
   `app/games/[id]/LiveLeaderboard.tsx`.
   Verificación: con `/games/road-fighter` abierto, guardar un score desde otra
   pestaña hace aparecer la fila en el top 10 sin recargar; los juegos no
   listados siguen estáticos.

5. **Actualizar `references/implemented-games.md`** — añadir la fila de
   `road-fighter` (RACING, red) **y** la fila de `frogger` que falta en la tabla
   (deuda detectada: implementado desde su game-jam pero nunca listado),
   siguiendo el formato existente.
   Verificación: la tabla lista `frogger` y `road-fighter`.

6. **Verificación final** — `npm run build` termina sin errores de TypeScript.
   Ninguna ruta existente devuelve 500.

---

## Acceptance criteria

- [ ] La migración `add_road_fighter_game` existe en `supabase/migrations/` con `on conflict (id) do nothing` y está aplicada.
- [ ] La fila `road-fighter` existe en la tabla `games` con `cat = 'RACING'` y `color = 'red'` — primera del catálogo en esa categoría.
- [ ] No se ha creado ni modificado ninguna política RLS, tabla ni publicación.
- [ ] La card de Road Fighter aparece en `/games` con cover `cover-road-fighter`.
- [ ] La ruta `/games/road-fighter/play` carga sin errores de SSR ni de TypeScript.
- [ ] El coche responde a `←`/`→` y a `A`/`D` con movimiento lateral continuo; no existe input de acelerar/frenar.
- [ ] Tocar el arcén o un rival resta 1 vida, reproduce `break-sound.mp3` y respawnea al coche en el carril libre con ~2 s de invulnerabilidad parpadeante.
- [ ] El fuel baja de forma continua y visible en la barra del canvas; recogiendo un bidón sube (con clamp al máximo) y suena `ball-bounce.mp3`.
- [ ] Fuel a 0 resta 1 vida y recarga el depósito al 100 %; nunca produce game over directo con vidas restantes.
- [ ] Con 0 vidas hay game over: `onLivesChange(0)` seguido de `onGameOver(score)` y sonido de fin.
- [ ] Cada 100 px recorridos suman `10 × nivel`; cada rebase suma `50 × nivel`; cada bidón suma `25 × nivel`; los choques no puntúan.
- [ ] Un rival con el que se ha chocado no cuenta también como rebase.
- [ ] El nivel sube cada 2000 px de mundo y la velocidad de scroll y la densidad de tráfico crecen de forma perceptible, con tope de velocidad.
- [ ] **Spawning justo:** en 5 minutos de observación (o con un chequeo de consola temporal sobre las ventanas generadas) toda ventana de spawn tiene ≥1 carril libre y su `gapLane` difiere como mucho en 1 del de la ventana anterior.
- [ ] Los bidones de fuel aparecen siempre en el carril libre de su ventana.
- [ ] Nunca hay una ventana con los 4 carriles ocupados.
- [ ] El HUD interno del canvas muestra score, nivel y barra de fuel.
- [ ] El HUD React refleja en tiempo real puntuación/vidas/nivel sin re-renders durante gameplay (P6, verificable con React DevTools Profiler).
- [ ] El botón "PAUSA" congela el game loop y el canvas no se redibuja en pausa (P2, verificable con `console.count('draw')` temporal).
- [ ] No hay literales de array creados dentro del loop RAF (P1), ni timers/acumuladores sin acotar (P3), ni búsquedas lineales en el hot path (P4).
- [ ] `RoadFighterGame` se exporta con `React.memo` (P5).
- [ ] Ningún error de autoplay rompe el juego (`.catch(() => {})` presente en todas las reproducciones).
- [ ] Con sesión iniciada, el modal pre-rellena el nombre con el `username` y el insert lleva `user_id`; sin sesión, usa `av_player_name` y `user_id = null`.
- [ ] El botón de guardar se deshabilita tras el primer envío (sin doble inserción).
- [ ] `REALTIME_GAMES` incluye `'road-fighter'`; con `/games/road-fighter` abierto, un INSERT en `scores` con `game_id = 'road-fighter'` aparece en el top 10 sin recargar.
- [ ] "JUGAR DE NUEVO" reinicia score/vidas/nivel/fuel a 0/3/1/100 en canvas y HUD.
- [ ] `references/implemented-games.md` incluye las filas de `road-fighter` **y** de `frogger`.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: puntuación = distancia + rebase + bidón, todo × nivel** — en lugar de solo
  distancia (el clásico puntuaba casi solo por avance). Razón: el leaderboard
  guarda un único `score` creciente; la distancia sola convierte el ranking en un
  ranking de supervivencia pura, mientras que el bonus de rebase premia jugar
  agresivo (buscar el tráfico en vez de esconderse en el hueco) y el de bidón
  premia el riesgo de desviarse. El multiplicador por nivel premia llegar lejos,
  igual que en Pong y Frogger — coherencia entre juegos.

- **Sí: fuel a 0 = −1 vida con depósito recargado, en vez de game over directo** —
  Razón: deja una **única** condición de fin (`lives === 0`), lo que mapea limpio
  al HUD estándar de 3 corazones sin necesitar un segundo indicador de muerte;
  quedarse tirado se castiga exactamente igual que un choque. La alternativa
  (fuel = vida única estilo clásico) rompería el HUD estándar jugador/puntuación/
  vidas/nivel de la plataforma.

- **Sí: velocidad automática, sin ↑/↓** — Razón: reduce el input a 2 direcciones,
  lo que simplifica el port táctil (`MobileGamepad` con `keyMap` de solo
  izquierda/derecha, spec 10) y elimina la dimensión de tuning
  aceleración/frenada; la dificultad creciente ya la aporta el nivel. Acelerar/
  frenar iría en un spec de ampliación si algún día se quiere.

- **Sí: movimiento lateral continuo + spawning por carriles lógicos** — Razón:
  el movimiento continuo es fiel al clásico y más satisfactorio que el salto de
  carril; los carriles se conservan solo como abstracción del spawner porque son
  lo que permite **demostrar** el invariante del hueco. Salto discreto de carril
  descartado: convertiría el juego en un endless runner genérico.

- **Sí: spawner por ventanas con `gapLane` ± 1 garantizado por construcción** —
  Razón: es EL riesgo del juego — un spawner aleatorio con densidad creciente
  acaba generando muros imposibles, y "comprobar y re-tirar" (rejection sampling)
  es no determinista y difícil de verificar. Generar el hueco primero y rellenar
  después hace el invariante estructural: no puede fallar, solo puede estar mal
  dimensionado (y esa relación de constantes queda documentada y testeable).

- **Sí: `←`/`→` con alias `A`/`D`** — Razón: mismo argumento que Pong con
  `↑`/`↓` + `W`/`S`: `MobileGamepad` sintetiza eventos de teclado vía `keyMap` y
  mantener ambos mapeos deja a `@mobile-porter` elegir cualquiera sin tocar el
  canvas.

- **Sí: sonido reutilizando los assets y el patrón de ArkanoidGame/PongGame** —
  bidón → `ball-bounce.mp3`, choque y fin → `break-sound.mp3`, con
  `cloneNode().play().catch(() => {})`. Razón: cero assets nuevos, patrón ya
  probado en el repo y tolerante a las políticas de autoplay. El rebase no
  suena: a densidades altas sonaría varias veces por segundo.

- **Sí: realtime por la constante `REALTIME_GAMES`** — un cambio de una línea.
  Razón: el patrón quedó validado con Pong (spec 15) exactamente para esto —
  extender juego a juego sin refactor; la publicación de `public.scores` ya está
  habilitada, no hay requisito de infraestructura nuevo.

- **Sí: cadena de agentes = implementación → `@mobile-porter` → `@skin-designer`
  (skins al FINAL)** — decisión vigente desde Pong. Razón: portar a mobile antes
  de skinear evita que `@skin-designer` trabaje sobre un componente que aún va a
  recibir cambios. Nota: invierte el orden por defecto del skill
  `/spec-impl-game` — para este juego manda este spec.

- **Sí: los 7 patrones del spec 12 desde el primer commit** — evita una pasada
  posterior de `@game-performance-booster` sobre código recién escrito.

- **Sí: aprovechar este spec para añadir la fila de `frogger` que falta en
  `references/implemented-games.md`** — deuda de mantenimiento de una línea
  detectada al preparar este spec; no justifica spec propio.

- **No: curvas y tramos con anchura variable** — multiplican la complejidad del
  render y rompen la abstracción de carriles que sostiene el spawning justo.
  Ampliación futura en su propio spec.

- **No: IA de rivales (cambios de carril)** — un rival que se mueve lateralmente
  puede invadir el `gapLane` y romper el invariante del hueco; el tráfico recto
  mantiene la garantía por construcción.

- **No: aceite/charcos/derrapes del clásico** — más superficies de colisión que
  también comprometerían el invariante; candidatos a spec de ampliación.

- **No: meta de tramo con bandera** — el leaderboard premia partidas largas; un
  final acotado produce scores con techo. Endless con niveles-tramo es coherente
  con el resto del catálogo.

- **No: políticas RLS nuevas** — specs 04 y 14 ya cubren `games` (SELECT
  público) y `scores` (INSERT asegurado); el catálogo solo necesita la fila nueva.

---

## Riesgos identificados

| Riesgo                                                                       | Mitigación                                                                                                                                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Muro de tráfico imposible a niveles altos (el riesgo central del juego)       | Invariante estructural del spawner (hueco generado primero, densidad ≤ `LANE_COUNT − 1`, `gapLane` ± 1); relación de constantes documentada; criterio de aceptación con observación dedicada. |
| `gapLane` alcanzable en teoría pero no en práctica (travesía lateral lenta)   | La relación `tiempo_travesía_1_carril < SPAWN_WINDOW_H / SCROLL_MAX_SPEED` queda como comentario junto a las constantes; QA manual jugando ≥5 niveles antes de cerrar el paso 2. |
| Tuning de fuel: drenaje alto frustra, bajo hace el fuel irrelevante           | `FUEL_DRAIN_PER_S`, `FUEL_PICKUP_AMOUNT` y la frecuencia de bidones como constantes de módulo fácilmente ajustables; frecuencia con suelo mínimo por nivel.               |
| Tunneling del coche contra rivales a scroll alto                              | Cap de velocidad de scroll (`SCROLL_MAX_SPEED`) + colisión AABB con barrido vertical (comparar posición previa y actual del rival contra el coche).                       |
| Farmeo de puntos por supervivencia pasiva en el `gapLane`                     | Aceptado y mitigado por diseño: el hueco se desplaza (±1 por ventana) obligando a moverse, y los bonus de rebase/bidón hacen que la pasividad puntúe claramente menos.    |
| Autoplay bloqueado silencia los primeros sonidos                              | Todos los sonidos se disparan tras input de teclado y `play().catch(() => {})` evita errores no capturados; comportamiento idéntico a Arkanoid/Pong.                      |
| `.cover-road-fighter` olvidada en `globals.css` deja la card sin fondo        | Incluida explícitamente en el paso 1 y en los criterios de aceptación.                                                                                                   |
| Scores de Road Fighter no comparables con otros juegos en `/hall-of-fame`     | Aceptado: el leaderboard es por juego (tabs); no se normaliza entre juegos.                                                                                              |

---

## Qué **no** entra en este spec

- Acelerar/frenar con `↑`/`↓` — spec de ampliación si llega.
- Curvas, anchura variable, aceite, charcos, derrapes, meta de tramo.
- IA de rivales (cambios de carril, embestidas).
- Controles táctiles / `MobileGamepad` — los añade `@mobile-porter` siguiendo el
  spec 10, antes de los skins.
- Skins `retro` y `neon` — los aplica `@skin-designer` como **último** paso de
  la cadena (implementación → `@mobile-porter` → `@skin-designer`).
- Ratón, toggle de mute, assets de sonido nuevos.
- Cambios en tablas, políticas RLS o publicaciones de Supabase.

Cada uno de ellos, si llega, va en su propio spec o en la pasada de su agente.
