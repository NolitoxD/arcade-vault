# SPEC 15 — Integración del juego Pong

> **Estado:** Approved
> **Depende de:** 06-games-table-leaderboard-supabase, 12-frogger-performance, 13-supabase-auth, 14-security-rls-password-headers
> **Fecha:** 2026-08-13
> **Objetivo:** Integrar Pong con ID `pong` (primera entrada de la categoría SPORTS)
> como juego contra la CPU con puntuación acumulativa para el leaderboard global —
> más modo 2 jugadores local en desktop, efectos de sonido y leaderboard realtime —
> aplicando desde el primer commit los 7 patrones de performance del spec 12.

---

## Scope

**In:**

- Migración SQL `supabase/migrations/<timestamp>_add_pong_game.sql` que inserta la fila
  `pong` en la tabla `games` con `on conflict (id) do nothing`. RLS ya está activo
  (specs 04 y 14) — **no** se crea ninguna política nueva, solo el insert del catálogo.
- Crear `components/games/PongGame.tsx` — componente React `"use client"` que encapsula
  el canvas (800 × 600 px, orientación horizontal) y el game loop completo. Acepta props:
  `paused`, `mode`, `skinKey`, `onScoreChange`, `onLevelChange`, `onLivesChange`,
  `onGameOver`, `onMatchEnd`.
- **Dos modos de juego** vía prop `mode: 'solo' | 'versus'`:
  - `solo` (1P vs CPU): pala del jugador a la izquierda, pala de la CPU a la derecha.
    Puntuación acumulativa, 3 vidas, niveles crecientes (ver Data model).
  - `versus` (2P local, solo desktop): dos humanos en el mismo teclado — jugador 1
    con `W`/`S` (pala izquierda), jugador 2 con `↑`/`↓` (pala derecha). Formato
    clásico: **primero a 7 tantos** gana. Sin vidas, sin niveles, sin score
    acumulativo; al acabar se dispara `onMatchEnd(winner, score1, score2)`.
    **El modo versus NO guarda nada en Supabase.**
- Mecánica común: pelota que rebota en los bordes superior e inferior; el ángulo de
  rebote en pala depende del punto de impacto (clásico); la velocidad de la pelota
  sube ligeramente en cada devolución dentro del mismo rally, con un tope.
- **Modificadores de dificultad acumulables** (ampliación 2026-08-13): dos checkboxes
  independientes en el overlay del selector de modo, visibles también en mobile —
  **BOLA RÁPIDA** (velocidad base de la pelota ×1.35, constante de módulo
  `FAST_BALL_MULTIPLIER`; la aceleración de rally parte de esa base rápida y su tope
  escala con el mismo factor) y **PALAS PEQUEÑAS** (ambas palas al 60 % de la altura
  normal, constante `SMALL_PADDLE_SCALE`). Aplican en ambos modos — en versus
  afectan a los dos jugadores por igual — y **no alteran la puntuación**. Se
  conservan al "JUGAR DE NUEVO"; "CAMBIAR MODO" vuelve al selector donde pueden
  cambiarse.
- CPU (solo modo `solo`): la pala sigue la posición Y de la pelota con velocidad
  máxima limitada y una zona muerta de error; ambas se ajustan por nivel para que la
  dificultad crezca pero la CPU siga siendo batible.
- Controles de teclado en modo `solo`: `↑`/`↓` **y** alias `W`/`S`, ambos mueven la
  pala del jugador — así la síntesis de teclado del `MobileGamepad` (spec 10,
  `keyMap`) funciona sin tocar el componente. En modo `versus` el mapeo se divide
  (W/S = izquierda, ↑/↓ = derecha); como versus es solo desktop, el gamepad táctil
  nunca convive con ese mapeo.
- **Efectos de sonido**, reutilizando el patrón de `ArkanoidGame`
  (`new Audio(...)` una vez + `cloneNode().play().catch(() => {})`):
  - Rebote en pala o pared → `/ball-bounce.mp3` (asset existente).
  - Tanto marcado (por cualquiera) → `/break-sound.mp3` (asset existente).
  - Fin de partida → `/break-sound.mp3` (asset existente, reutilizado — decisión
    del usuario 2026-08-13: sin assets pendientes).
  - El `.catch(() => {})` absorbe los bloqueos de autoplay del navegador; en la
    práctica todos los sonidos ocurren tras la primera interacción de teclado.
- HUD interno del canvas — patrón doble HUD: en `solo`, score top-left y level
  top-right; en `versus`, marcador P1 – P2 centrado en la parte superior.
- Callbacks solo cuando el valor cambia; en `solo`, `onLivesChange(0)` se dispara
  justo antes de `onGameOver(finalScore)`.
- Prop `paused: boolean` — congela el loop sin redibujar (patrón P2 del spec 12).
- Los **7 patrones de performance del spec 12** (P1 constantes de módulo para arrays
  del RAF, P2 saltar `draw()` en pausa, P3 timers acotados con módulo, P4 lookups O(1)
  precomputados, P5 `React.memo` en el componente canvas, P6 HUD a refs + DOM directo
  en la play-page, P7 caché de sprites neon si aplica) son **requisito desde la
  primera implementación**, no una optimización posterior.
- Estructura skineable siguiendo el patrón de `TetrisGame`/`SnakeGame`: mapa `SKINS`
  interno consultado vía prop `skinKey`, arrancando solo con `classic`. Los 3 skins
  canónicos los define `@skin-designer` **como último paso** de la cadena.
- Limpiar event listeners de teclado y el RAF en el `return` del `useEffect`.
- Crear `app/games/pong/play/page.tsx` — play-page específica siguiendo el patrón
  de `app/games/snake/play/page.tsx`, con:
  - **Selector de modo 1P/2P** antes de empezar: overlay sobre el CRT al montar
    (y al "CAMBIAR MODO") con "1 JUGADOR vs CPU" y "2 JUGADORES (mismo teclado)".
    La opción 2P solo se muestra en desktop (gate por breakpoint `md`, igual que el
    HUD desktop); en mobile solo existe 1P.
  - Refs de HUD + DOM directo (P6); `paused`/`over`/`name`/`saved`/`gameKey`/
    `skinKey`/`mode` como estado de usuario.
  - HUD en `solo`: jugador, puntuación, vidas (3 corazones), nivel, skin. HUD en
    `versus`: marcador P1 – P2 y skin (sin vidas/nivel/nombre).
  - Auth (solo `solo`): `useUser()` — `username` autocompleta el nombre del modal;
    fallback a `localStorage.getItem('av_player_name')`; el insert en `scores` lleva
    `user_id: user?.id ?? null`.
  - Modal fin de partida: en `solo`, flujo estándar de guardado en Supabase con
    deshabilitado tras el primer envío; en `versus`, banner "GANA JUGADOR 1/2" con
    marcador final, **sin** input de nombre ni botón de guardar; ambos ofrecen
    "JUGAR DE NUEVO" (mismo modo) y "CAMBIAR MODO" (vuelve al selector).
- **Leaderboard realtime en `/games/pong`**:
  - Extraer el `<aside>` del leaderboard de `app/games/[id]/page.tsx` a un
    componente cliente `app/games/[id]/LiveLeaderboard.tsx` que recibe `gameId` y
    los 10 scores iniciales del Server Component (SSR intacto).
  - Suscripción con Supabase Realtime (`lib/supabase/client`):
    `postgres_changes` sobre `INSERT` en `public.scores` con filtro
    `game_id=eq.pong`; al recibir un insert, se re-inserta ordenado en el top 10
    local (sin refetch). Canal limpiado en el `return` del `useEffect`.
  - La suscripción solo se activa para los juegos listados en la constante
    `REALTIME_GAMES = ['pong']` — el resto de juegos sigue mostrando el leaderboard
    estático SSR de siempre.
  - **Requisito de infraestructura (fuera del código):** la tabla `public.scores`
    debe añadirse a la publicación `supabase_realtime`. Lo hará el orquestador vía
    MCP — este spec solo documenta el requisito; no hay migración para ello.
- Añadir la clase CSS `.cover-pong` en `app/globals.css` para la card del catálogo.
- Actualizar `references/implemented-games.md` con la fila de `pong` al terminar.

**Fuera de alcance:**

- Multiplayer **online** — TODO futuro explícito, iría en su propio spec.
- Modo 2P en mobile/táctil.
- Control por ratón o touch directo sobre el canvas.
- Integración de `MobileGamepad` en la play-page — la hará `@mobile-porter` (segundo
  paso de la cadena) siguiendo el spec 10; este spec garantiza no impedirlo
  (modo `solo` 100% por teclado con alias W/S y ↑/↓).
- Los skins `retro` y `neon` — los define `@skin-designer` como **último** paso.
- Toggle de mute / control de volumen.
- Realtime en `/hall-of-fame` — se empieza solo por `/games/pong`; extenderlo es
  trivial una vez validado, pero queda para después.
- Cambios en tablas, políticas RLS o triggers de Supabase — solo el insert del
  catálogo (la publicación realtime la habilita el orquestador vía MCP, sin migración).

---

## Data model

### Migración en Supabase — tabla `games`

Archivo `supabase/migrations/<timestamp>_add_pong_game.sql`:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'pong',
  'PONG',
  'Golpea la pelota más rápido de lo que tu rival puede reaccionar.',
  'Duelo clásico: reta a una CPU que cada nivel juega más rápido y afina mejor, o desafía a un amigo en el mismo teclado al primero que llegue a 7. Contra la CPU tienes 3 vidas; suma puntos con cada devolución y multiplica con cada tanto que marques.',
  'SPORTS',
  'cover-pong',
  'blue'
)
on conflict (id) do nothing;
```

`SPORTS` es una categoría nueva en el catálogo — la columna `cat` es texto libre,
no requiere cambios de esquema.

### Modelo de puntuación — modo `solo` (el único que puntúa en el leaderboard)

Un único `score` numérico, monótono creciente y sin tope — compatible con la columna
`score` de la tabla `scores` y con el leaderboard global:

| Evento                             | Puntos        |
| ---------------------------------- | ------------- |
| Devolución del jugador (rally hit) | `10 × nivel`  |
| Tanto ganado a la CPU              | `100 × nivel` |
| Tanto encajado (la CPU marca)      | `0` y −1 vida |

- La partida arranca con `lives = 3`, `score = 0`, `level = 1`.
- El nivel sube 1 cada 2 tantos ganados a la CPU; cada nivel incrementa la velocidad
  base de la pelota y la velocidad/precisión de la pala CPU.
- Game over cuando `lives` llega a 0 → `onLivesChange(0)` + `onGameOver(score)`.

### Modelo de partida — modo `versus`

- Marcador `score1` / `score2` (tantos de cada jugador). Gana el primero en llegar
  a `VERSUS_TARGET = 7`.
- Sin vidas, sin niveles, sin puntos por rally. La velocidad de la pelota solo sube
  dentro del rally (mismo cap que en `solo`).
- Al llegar al objetivo: `onMatchEnd(winner, score1, score2)` con `winner: 1 | 2`.
- **No se escribe nada en Supabase** — la tabla `scores` modela puntuaciones
  individuales contra la CPU; un duelo local no es comparable ni atribuible.

### Props del componente `PongGame`

```ts
interface PongGameProps {
  paused: boolean;
  mode: 'solo' | 'versus';
  skinKey?: string;
  fastBall?: boolean; // ×1.35 velocidad base y tope de rally (FAST_BALL_MULTIPLIER)
  smallPaddles?: boolean; // palas al 60 % de altura (SMALL_PADDLE_SCALE)
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  onMatchEnd?: (winner: 1 | 2, score1: number, score2: number) => void;
}
```

En modo `versus`, los cuatro callbacks de `solo` no se invocan; en modo `solo`,
`onMatchEnd` no se invoca.

Los modificadores son props booleanas opcionales (default `false`), respaldadas por
dos constantes de módulo en `PongGame.tsx`:

```ts
const FAST_BALL_MULTIPLIER = 1.35; // escala velocidad base de saque y tope de rally
const SMALL_PADDLE_SCALE = 0.6; // altura de ambas palas respecto a PADDLE_H
```

No afectan al modelo de puntuación: los puntos por rally y por tanto son los mismos
con o sin modificadores.

### Realtime — leaderboard de `/games/pong`

```ts
// app/games/[id]/LiveLeaderboard.tsx ("use client")
const REALTIME_GAMES = ['pong'];

// Solo si REALTIME_GAMES.includes(gameId):
supabase
  .channel(`scores-${gameId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'scores',
      filter: `game_id=eq.${gameId}`,
    },
    (payload) => {
      /* insertar payload.new ordenado en el top 10 local */
    },
  )
  .subscribe();
```

Requisito de infraestructura: `public.scores` añadida a la publicación
`supabase_realtime` (lo habilita el orquestador vía MCP; sin ello la suscripción
simplemente no recibe eventos y el leaderboard queda como el SSR estático).

### Audio

| Evento                       | Asset                                        |
| ---------------------------- | -------------------------------------------- |
| Rebote en pala o pared       | `/ball-bounce.mp3` (existente, de Arkanoid)  |
| Tanto marcado                | `/break-sound.mp3` (existente, de Arkanoid)  |
| Fin de partida (ambos modos) | `public/break-sound.mp3` (reutilizado) |

No se introducen tablas ni tipos TypeScript nuevos — se reutilizan `GameRow` y
`ScoreRow` de `lib/supabase/types.ts`.

---

## Implementation plan

1. **Migración SQL** — crear `supabase/migrations/<timestamp>_add_pong_game.sql` con
   el insert del data model (mismo formato que `20260810132324_add_frogger_game.sql`)
   y aplicarla. Añadir `.cover-pong` en `app/globals.css`.
   Verificación: la fila `pong` aparece en el Table Editor; `/games` muestra la card
   de Pong con cover `cover-pong` y color `blue`, categoría SPORTS.

2. **Crear `components/games/PongGame.tsx` (modo `solo`)** — componente `"use client"`:
   - Canvas 800 × 600, loop RAF con delta time: `update(dt)` mueve palas y pelota,
     resuelve colisiones y puntuación; `draw()` pinta campo (línea central discontinua
     con constante de módulo — P1), palas, pelota y HUD interno.
   - Pala del jugador con `↑`/`↓` y `W`/`S` (flags en `keydown`/`keyup` sobre
     `document`); pala CPU con seguimiento limitado + zona muerta escaladas por nivel.
   - Tras cada tanto, saque desde el centro hacia quien encajó con componente
     vertical aleatoria y ~1 s de pausa de saque (timer acotado — P3).
   - Puntuación y niveles según el data model; `onLivesChange(0)` y
     `onGameOver(score)` al perder la tercera vida.
   - Sonido: precargar `ball-bounce.mp3` y `break-sound.mp3` una vez, reproducir con
     `cloneNode().play().catch(() => {})` en rebote y tanto (patrón ArkanoidGame).
   - `paused` congela el loop dibujando un único frame al entrar en pausa (P2);
     mapa `SKINS` con `classic` + prop `skinKey`; export con `React.memo` (P5);
     listeners y RAF limpiados en el `return` del `useEffect`.
     Verificación: jugable con teclado contra la CPU, con sonido.

3. **Añadir modo `versus` a `PongGame`** — prop `mode`:
   - Rama de input: W/S → pala izquierda, ↑/↓ → pala derecha; sin CPU.
   - Marcador a `VERSUS_TARGET = 7`; HUD interno con marcador P1 – P2 centrado;
     `onMatchEnd(winner, score1, score2)` al terminar. Sin llamadas a los callbacks
     de `solo` ni a Supabase.
     Verificación: dos personas pueden jugar en el mismo teclado; a 7 tantos aparece
     el fin de partida con el ganador.

4. **Crear `app/games/pong/play/page.tsx`** — play-page específica:
   - Selector de modo 1P/2P como overlay inicial sobre el CRT; opción 2P visible
     solo en desktop (breakpoint `md`); `mode` en estado de usuario.
   - Importa `PongGame` con `dynamic(..., { ssr: false })`; HUD con refs + DOM
     directo (P6); HUD condicionado por modo (solo: score/vidas/nivel; versus:
     marcador P1 – P2).
   - Auth con `useUser()` y modal de guardado **solo en modo `solo`**
     (`{ game_id: 'pong', player_name, score, user_id: user?.id ?? null }`, botón
     deshabilitado tras el primer envío). En `versus`, modal de ganador sin guardado.
   - Botones "JUGAR DE NUEVO" (mismo modo, `gameKey + 1`) y "CAMBIAR MODO"
     (vuelve al selector).
     Verificación: ambos modos completos de principio a fin; un score de `solo`
     aparece en `/games/pong` y `/hall-of-fame`; una partida `versus` no crea filas
     en `scores`.

5. **Leaderboard realtime** — crear `app/games/[id]/LiveLeaderboard.tsx`
   (`"use client"`) con el markup actual del `<aside>` del leaderboard, props
   `gameId` + `initialScores`; suscripción `postgres_changes` según el data model,
   activa solo para `REALTIME_GAMES`; sustituir el `<aside>` de
   `app/games/[id]/page.tsx` por el componente (datos iniciales SSR intactos).
   Requisito previo: el orquestador habilita la publicación realtime de
   `public.scores` vía MCP.
   Verificación: con `/games/pong` abierto, guardar un score desde otra pestaña
   hace aparecer la fila en el top 10 sin recargar; `/games/snake` sigue estático.

6. **Actualizar `references/implemented-games.md`** — añadir la fila de `pong`
   (SPORTS, blue) siguiendo el formato de la tabla.
   Verificación: la tabla lista `pong`.

7. **Verificación final** — `npm run build` termina sin errores de TypeScript.
   Ninguna ruta existente devuelve 500.

### Ampliación — modificadores de dificultad (2026-08-13)

8. **Props de modificadores en `PongGame`** — añadir `fastBall` y `smallPaddles`
   (booleanas opcionales, default `false`) con sus constantes de módulo
   `FAST_BALL_MULTIPLIER = 1.35` y `SMALL_PADDLE_SCALE = 0.6`. `fastBall` escala la
   velocidad de saque (ambos modos) y el tope de rally; `smallPaddles` reduce la
   altura de ambas palas (colisión, clamps, seguimiento CPU y dibujo).
   Verificación: con cada modificador activo el efecto es perceptible; la puntuación
   no cambia.

9. **Checkboxes en el selector de modo** — dos checkboxes retro (indicador `[X]`,
   clases `mono` + colores del overlay) bajo los botones de modo en
   `app/games/pong/play/page.tsx`; estado `fastBall`/`smallPaddles` fuera de
   `resetHud` para que sobreviva a "JUGAR DE NUEVO"; props pasadas a `PongGame`.
   Verificación: acumulables, visibles en mobile, persisten entre partidas y son
   editables al volver con "CAMBIAR MODO".

---

## Acceptance criteria

- [ ] La migración `add_pong_game` existe en `supabase/migrations/` con `on conflict (id) do nothing` y está aplicada.
- [ ] La fila `pong` existe en la tabla `games` con `cat = 'SPORTS'` — primera del catálogo en esa categoría.
- [ ] No se ha creado ni modificado ninguna política RLS ni tabla.
- [ ] La card de Pong aparece en `/games` con cover `cover-pong` y color `blue`.
- [ ] La ruta `/games/pong/play` carga sin errores de SSR ni de TypeScript.
- [ ] Al entrar en la play-page aparece el selector de modo; en viewport mobile solo se ofrece 1P.
- [ ] **Modo solo:** la pala responde a `↑`/`↓` y a `W`/`S`; la CPU sigue la pelota con velocidad limitada y es batible en el nivel 1.
- [ ] **Modo solo:** cada devolución suma `10 × nivel`; cada tanto ganado suma `100 × nivel`; cada tanto de la CPU resta 1 vida sin alterar el score; con 0 vidas hay game over.
- [ ] **Modo solo:** el nivel sube cada 2 tantos ganados y la partida se acelera de forma perceptible.
- [ ] **Modo versus:** W/S mueve solo la pala izquierda y ↑/↓ solo la derecha; no hay CPU.
- [ ] **Modo versus:** el primero en llegar a 7 tantos gana; aparece el modal "GANA JUGADOR 1/2" con el marcador final.
- [ ] **Modo versus:** no se muestra input de nombre ni botón de guardar, y no se inserta ninguna fila en `scores`.
- [ ] "CAMBIAR MODO" devuelve al selector; "JUGAR DE NUEVO" repite el mismo modo desde cero.
- [ ] Los rebotes en pala/pared reproducen `ball-bounce.mp3` y los tantos `break-sound.mp3`; ningún error de autoplay rompe el juego (`.catch` presente).
- [ ] El fin de partida reproduce `break-sound.mp3`.
- [ ] El HUD interno del canvas se dibuja correctamente en ambos modos (solo: score/level; versus: marcador P1 – P2).
- [ ] El HUD React refleja en tiempo real los valores sin re-renders durante gameplay (P6 verificable con React DevTools Profiler).
- [ ] El botón "PAUSA" congela el game loop y el canvas no se redibuja en pausa (P2, verificable con `console.count('draw')` temporal).
- [ ] No hay literales de array creados dentro del loop RAF (P1) ni timers cíclicos sin acotar (P3) ni búsquedas lineales en el hot path (P4).
- [ ] `PongGame` se exporta con `React.memo` (P5).
- [ ] Con sesión iniciada, el modal de `solo` pre-rellena el nombre con el `username` y el insert lleva `user_id`; sin sesión, usa `av_player_name` y `user_id = null`.
- [ ] El botón de guardar se deshabilita tras el primer envío (sin doble inserción).
- [ ] `app/games/[id]/LiveLeaderboard.tsx` existe, renderiza el mismo markup que el leaderboard anterior y recibe los datos iniciales por SSR.
- [ ] Con `/games/pong` abierto, un INSERT en `scores` con `game_id = 'pong'` aparece en el top 10 sin recargar la página.
- [ ] El canal realtime se elimina al desmontar el componente (sin suscripciones huérfanas).
- [ ] Los demás juegos (`REALTIME_GAMES` no los incluye) siguen mostrando el leaderboard estático sin abrir canal.
- [ ] La publicación `supabase_realtime` incluye `public.scores` (habilitada por el orquestador vía MCP).
- [ ] "JUGAR DE NUEVO" en `solo` reinicia score/vidas/nivel a 0/3/1 en canvas y HUD.
- [ ] El selector de modo muestra los checkboxes "BOLA RÁPIDA" y "PALAS PEQUEÑAS", marcables por separado o a la vez, también en viewport mobile.
- [ ] Con BOLA RÁPIDA activa, la pelota sale ×1.35 más rápida en ambos modos y el tope de rally escala en la misma proporción.
- [ ] Con PALAS PEQUEÑAS activa, ambas palas (jugador, CPU o P2) miden el 60 % de la altura normal en ambos modos.
- [ ] Los modificadores se conservan al "JUGAR DE NUEVO", se pueden cambiar tras "CAMBIAR MODO" y no alteran los puntos por rally ni por tanto.
- [ ] `references/implemented-games.md` incluye la fila de `pong`.
- [ ] `npm run build` completa sin errores de TypeScript.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: puntuación acumulativa (rally + tanto) × nivel, partida a 3 vidas (modo solo)** —
  en lugar del clásico "primero a 11". Razón: el leaderboard guarda un único `score`
  numérico y premia partidas largas; "primero a 11" produce scores acotados sin
  ranking útil. Rally + tanto recompensa supervivencia y agresividad, y el
  multiplicador por nivel premia llegar lejos.

- **Sí: modo 2P local a primero de 7 tantos, solo desktop** — formato clásico de
  Pong, partida corta y autoconclusiva. Razón: en un duelo humano el marcador cerrado
  es la gracia; replicar el modelo de vidas/niveles de 1P no tiene sentido sin CPU.
  Solo desktop porque exige dos manos en el mismo teclado físico.

- **Sí: el modo versus NO guarda scores en Supabase** — Razón: la tabla `scores`
  modela puntuaciones individuales contra la CPU con un único `score` por fila; un
  duelo local produce dos marcadores no comparables con el resto del leaderboard y
  no atribuibles a un único jugador. Guardarlos contaminaría el ranking global.

- **Sí: en modo solo, `↑`/`↓` y `W`/`S` son alias de la misma pala** — Razón:
  `MobileGamepad` sintetiza eventos de teclado vía `keyMap` (spec 10); mantener ambos
  mapeos activos en 1P deja a `@mobile-porter` elegir cualquiera sin tocar el canvas.
  El split de teclas solo existe en versus, que es exclusivo de desktop, así que
  nunca colisiona con la síntesis táctil.

- **Sí: sonido reutilizando los assets y el patrón de ArkanoidGame** —
  `ball-bounce.mp3` para rebotes y `break-sound.mp3` para tantos, con
  `cloneNode().play().catch(() => {})`. Razón: cero assets nuevos para el mapeo
  mínimo, patrón ya probado en el repo y tolerante a las políticas de autoplay.
  El sonido de fin de partida queda como asset pendiente del usuario — no se
  inventa ni se genera.

- **Sí: leaderboard realtime solo en `/games/[id]` y gateado por `REALTIME_GAMES = ['pong']`** —
  Razón: empezar por una sola superficie acota el riesgo y la validación; la
  constante permite extender a otros juegos (o a `/hall-of-fame`) sin refactor.
  El componente cliente recibe los datos iniciales por SSR, así que sin publicación
  realtime el comportamiento degrada al actual (estático), nunca a peor.

- **Sí: suscripción `postgres_changes` INSERT filtrada por `game_id`, merge local sin refetch** —
  Razón: el leaderboard solo crece por inserts; escuchar el evento concreto y
  ordenar en cliente evita queries redundantes. Habilitar la publicación de
  `public.scores` es requisito de infraestructura que ejecuta el orquestador vía
  MCP — no va en migración.

- **Sí: cadena de agentes = implementación → `@mobile-porter` → `@skin-designer` (skins al FINAL)** —
  decisión del usuario. Razón: portar a mobile antes de skinear evita que
  `@skin-designer` trabaje sobre un componente que aún va a recibir cambios de
  integración. Nota: invierte el orden por defecto del skill `/spec-impl-game`
  (skins → mobile) — para este juego manda este spec.

- **Sí: modificadores de dificultad como checkboxes y sin multiplicador de score** —
  checkboxes (no radio/select) porque son acumulables e independientes; la
  puntuación no cambia con ellos porque premiar la dificultad con multiplicadores
  alteraría la comparabilidad del leaderboard — si algún día se quiere, será una
  decisión de producto aparte.

- **Sí: 3 vidas = 3 tantos encajados (modo solo)** — mapea la derrota parcial de Pong
  al modelo de vidas estándar del HUD, igual que Arkanoid/Frogger.

- **Sí: CPU con velocidad máxima limitada + zona muerta escaladas por nivel** — el
  modelo de IA más simple que produce dificultad creciente y siempre batible.

- **Sí: los 7 patrones del spec 12 desde el primer commit** — evita una pasada
  posterior de `@game-performance-booster` sobre código recién escrito.

- **Sí: play-page específica y migración versionada con `on conflict do nothing`** —
  coherencia con los cinco juegos existentes y patrón vigente desde `add_frogger_game`.

- **No: multiplayer online** — TODO futuro explícito; exige backend de salas y
  sincronización que no cabe aquí. Su propio spec si llega.

- **No: control por ratón** — un segundo camino de input que el port mobile no puede
  replicar; ver decisión de alias de teclado.

- **No: toggle de mute** — ningún otro juego lo tiene; si se quiere, es una mejora
  de plataforma transversal, no de este spec.

- **No: realtime en `/hall-of-fame`** — se valida primero en la página del juego.

- **No: políticas RLS nuevas** — specs 04 y 14 ya cubren `games` (SELECT público) y
  `scores` (INSERT asegurado); el catálogo solo necesita la fila nueva.

---

## Riesgos identificados

| Riesgo                                                                    | Mitigación                                                                                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tuning de la CPU: demasiado fácil infla scores, demasiado difícil frustra  | Parámetros (velocidad máx., zona muerta, escalado por nivel) como constantes de módulo fácilmente ajustables; QA manual jugando 3+ niveles antes de cerrar el paso 2.           |
| Pelota que atraviesa la pala a velocidades altas (tunneling)               | Cap de velocidad + colisión por barrido en el eje X (comparar posición previa y actual contra el plano de la pala).                                                             |
| Ghosting de teclado en 2P (W/S + ↑/↓ simultáneas)                          | Esas combinaciones no comparten fila de matriz en teclados habituales; riesgo bajo. QA manual con dos jugadores en el paso 3; si un teclado concreto falla, es limitación hardware documentada, no bug. |
| Autoplay bloqueado silencia los primeros sonidos                           | Todos los sonidos se disparan tras input de teclado (gesto de usuario) y `play().catch(() => {})` evita errores no capturados; comportamiento idéntico a Arkanoid.               |
| ~~`game-over.mp3` no existe todavía~~ (resuelto: se reutiliza `break-sound.mp3`) | N/A — decisión del usuario 2026-08-13.                        |
| Publicación realtime de `scores` no habilitada al desplegar                | El leaderboard degrada al SSR estático actual (la suscripción no recibe eventos, sin errores); el requisito queda documentado y asignado al orquestador vía MCP.               |
| Canal realtime huérfano al navegar entre juegos                            | `supabase.removeChannel(...)` en el cleanup del `useEffect` de `LiveLeaderboard`; criterio de aceptación dedicado.                                                              |
| `.cover-pong` olvidada en `globals.css` deja la card sin fondo             | Incluida explícitamente en el paso 1 y en los criterios de aceptación.                                                                                                          |
| Scores de Pong no comparables con otros juegos en `/hall-of-fame`          | Aceptado: el leaderboard es por juego (tabs); no se normaliza entre juegos.                                                                                                     |

---

## Qué **no** entra en este spec

- **Multiplayer online** — TODO futuro; su propio spec si llega.
- Modo 2P en mobile/táctil.
- Skins retro y neon — los aplica `@skin-designer` como **último** paso de la cadena
  (implementación → `@mobile-porter` → `@skin-designer`).
- Controles táctiles / `MobileGamepad` — los añade `@mobile-porter` siguiendo el
  spec 10, antes de los skins.
- Ratón, toggle de mute, realtime en `/hall-of-fame`.
- Un asset de sonido propio para el fin de partida — se reutiliza `break-sound.mp3`; si algún día se quiere uno dedicado, es un cambio de una línea.

Cada uno de ellos, si llega, va en su propio spec o en la pasada de su agente.
