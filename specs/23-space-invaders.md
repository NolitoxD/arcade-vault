# SPEC 23 — Integración del juego SPACE INVADERS

> **Estado:** Draft
> **Depende de:** 06-games-table-leaderboard-supabase, 10-mobile-touch-controls,
> 12-frogger-performance, 13-supabase-auth, 14-security-rls-password-headers,
> 20-auth-gate-play, 21-background-music, 22-credits-collection
> **Referencia:** `specs/game-jam/space-invaders/01-space-invaders-core.md` y
> `02-space-invaders-sfx.md` (mayo 2026) — insumo de diseño; esta spec las
> sustituye y NO se implementan tal cual.
> **Fecha:** 2026-08-20
> **Objetivo:** Integrar SPACE INVADERS con ID `space-invaders` (categoría
> SHOOTER, color `green`) como shooter endless de oleadas con grid clásico 11×5,
> escudos destructibles píxel a píxel, UFO de bonus y SFX procedurales — con
> leaderboard realtime, sesión obligatoria en la play-page y los patrones de
> performance del spec 12 desde el primer commit.

---

## Scope

**In:**

- Migración Supabase: fila `space-invaders` en la tabla `games`.
- `components/games/SpaceInvadersGame.tsx` — componente `"use client"` con
  canvas 600 × 700 px y game loop `requestAnimationFrame` con acumulador de
  delta time. Props: `paused`, `muted?`, `skin?`, `onScoreChange`,
  `onLivesChange`, `onLevelChange`, `onGameOver`.
- Grid de invasores 11 columnas × 5 filas (55): crabs (filas 3–5, 10 pts),
  squids (fila 2, 20 pts), octopus (fila 1, 30 pts). Movimiento en bloque:
  horizontal, paso abajo + inversión al tocar borde; el intervalo de paso se
  reduce 15 ms por invasor eliminado partiendo del valor del nivel.
- Cañón del jugador: ← → (o A/D), dispara con Space; un único proyectil propio
  en vuelo. 3 vidas.
- Proyectiles enemigos: dispara la fila inferior viva de cada columna a
  intervalos aleatorios dentro del rango del nivel.
- 4 escudos destructibles: matriz 22 × 16 de píxeles lógicos de 3 px
  (`Uint8Array` por escudo); cualquier proyectil destruye píxeles y se detiene.
- UFO: cada 20–30 s (aleatorio) cruza la parte superior; puntuación
  50/100/150/300 × multiplicador del nivel, revelada al abatirlo.
- `WAVE_CONFIG` a nivel de módulo: 10 entradas
  `[stepIntervalMs, enemyFireIntervalMs, ufoMultiplier, blockOffsetY]`
  (valores de la spec de referencia, de `[800, 2000, 1, 0]` a
  `[150, 400, 3, 130]`).
- **Juego endless**: completar una oleada avanza de nivel sin tope; a partir
  del nivel 10 la dificultad queda congelada en `WAVE_CONFIG[9]`. No hay
  condición de victoria.
- Game over: impacto enemigo con 0 vidas restantes, o cualquier invasor
  alcanza la fila del cañón.
- HUD dentro del canvas: score (top-left), hi-score de sesión (top-center),
  vidas como iconos (bottom-left), nivel (bottom-right).
- `lib/sfx-space-invaders.ts` — clase `SpaceInvadersSFX` con los 8 SFX
  procedurales Web Audio de la spec de referencia (`march` con 4 notas que
  acelera por nivel, `shoot`, `invader_hit`, `player_hit`, `ufo` con LFO,
  `ufo_hit`, `level_clear`, `game_over`), singleton exportado, `AudioContext`
  diferido a la primera interacción, `init/play/stop/setMuted/dispose`.
- `app/games/space-invaders/play/page.tsx` — patrón de la play-page de
  Pac-Man: `dynamic(ssr: false)`, `useUser()` (la ruta ya está protegida por
  el gate del spec 20), HUD React con refs (sin re-render por frame), botón
  PAUSA, botón mute de SFX (persistido en `localStorage` `av_sfx_muted`,
  independiente del mute de música global del Nav), selector de skins con
  `SKIN_OPTIONS` local (classic/retro/neon — última duplicación consciente,
  ver Decisiones), `MobileGamepad`, y modal game-over que inserta en `scores`
  `{ game_id: 'space-invaders', player_name, score, user_id: user.id }`.
- `'space-invaders'` añadido a `REALTIME_GAMES` en
  `app/games/[id]/LiveLeaderboard.tsx`.
- Tests vitest de lógica pura extraíble a módulo: geometría/colisiones de
  proyectiles, daño de escudos, selección de tirador por columna, lectura de
  `WAVE_CONFIG` con clamp a nivel 10, aceleración del bloque.
- Patrones de performance del spec 12 desde el primer commit (constantes a
  nivel de módulo, sin allocs en el loop, refs para HUD, cleanup completo de
  listeners y RAF).
- Cover final: captura real del juego (columna `cover` con ruta que empieza
  por `/`), tomada al final de la implementación; hasta entonces, clase CSS
  provisional `cover-space-invaders`.

**Fuera de alcance:**

- Power-ups, armas especiales, modo dos jugadores.
- Explosiones con partículas (solo flash de frame ~200 ms).
- Música de fondo propia (la global del spec 21 ya suena; los SFX conviven
  con ella).
- Archivos de audio externos (`.mp3`/`.ogg`) — si en QA algún SFX procedural
  queda pobre, se pedirá el asset a Paco como mejora posterior.
- Centralización de `SKIN_OPTIONS` y fase 2 de créditos — tarea propia
  inmediatamente posterior a este juego (decisión de roadmap 2026-08-20).
- Controles táctiles más allá del mapeo estándar de `MobileGamepad`
  (los ajustes finos son de `@mobile-porter`).
- Skins definitivas (las diseña `@skin-designer` al final de la cadena; el
  componente solo expone el hook de skin como Pac-Man).

---

## Data model

### Migración en Supabase — tabla `games`

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'space-invaders',
  'SPACE INVADERS',
  'Destruye oleadas de alienígenas antes de que lleguen a la Tierra.',
  'Maneja tu cañón láser para abatir cinco filas de invasores que descienden implacablemente. Cúbrete tras los cuatro escudos, caza la nave misteriosa para puntuación extra y sobrevive a oleadas cada vez más rápidas.',
  'SHOOTER',
  'cover-space-invaders',
  'green'
);
```

La aplica el orquestador por MCP y se versiona el archivo de migración con la
versión EXACTA que devuelva el servidor. Al final de la implementación, un
UPDATE cambia `cover` a la ruta de la captura real (`/covers/...`).

### Constantes de módulo (extracto)

```ts
const CANVAS_W = 600;
const CANVAS_H = 700;
const COLS = 11;
const ROWS = 5;
const INV_POINTS = [30, 20, 10, 10, 10]; // fila 0 = octopus
const SHIELD_COUNT = 4;
const BULLET_SPEED = 400;        // px/s jugador
const ENEMY_BULLET_SPEED = 220;  // px/s enemigo
const UFO_SPEED = 120;           // px/s
const UFO_POINTS = [50, 100, 150, 300];
const STEP_ACCEL_PER_KILL_MS = 15;

const WAVE_CONFIG = [
  // [stepIntervalMs, enemyFireIntervalMs, ufoMultiplier, blockOffsetY]
  [800, 2000, 1, 0],
  [700, 1800, 1, 20],
  [600, 1600, 1.5, 40],
  [520, 1400, 1.5, 60],
  [440, 1200, 2, 80],
  [370, 1000, 2, 90],
  [300, 850, 2.5, 100],
  [240, 700, 2.5, 110],
  [190, 550, 3, 120],
  [150, 400, 3, 130],
] as const;

const waveFor = (level: number) =>
  WAVE_CONFIG[Math.min(level, WAVE_CONFIG.length) - 1];
```

### Tipos internos

```ts
type Invader = { col: number; row: number; alive: boolean; type: 0 | 1 | 2; animFrame: 0 | 1 };
type Bullet = { x: number; y: number; active: boolean };
type Shield = { x: number; pixels: Uint8Array }; // 22*16, 1=intacto
type UFO = { x: number; active: boolean; points: number };
```

### Props del componente

```ts
interface SpaceInvadersGameProps {
  paused: boolean;
  muted?: boolean;
  skin?: string; // 'classic' | 'retro' | 'neon'
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

---

## Implementation plan

1. **Migración `games`** — INSERT por MCP + archivo versionado. Verificar card
   en `/games` (cover CSS provisional, color `green`).
2. **Lógica pura + tests** — módulo con las funciones testeables (colisiones,
   daño de escudo, tirador por columna, `waveFor` con clamp, aceleración) y
   sus tests vitest ANTES del componente.
3. **`SpaceInvadersGame.tsx`** — loop, grid, cañón, proyectiles, escudos, UFO,
   HUD canvas, game over, cleanup. Pausa vía prop (`update()` se salta,
   `draw()` continúa).
4. **`lib/sfx-space-invaders.ts`** — los 8 SFX según la spec de referencia
   (secciones 1a–1l de `02-space-invaders-sfx.md`), conectados a los eventos
   del loop.
5. **Play-page** — patrón Pac-Man completo: HUD React con refs, pausa, mute
   SFX, skins locales, `MobileGamepad`, modal game-over con `user_id` real.
6. **Realtime** — añadir `'space-invaders'` a `REALTIME_GAMES`.
7. **Cadena de agentes** — `@mobile-porter` (← → + FIRE) y después
   `@skin-designer` (classic/retro/neon).
8. **Cover real** — captura del juego, subir asset, UPDATE de la columna
   `cover`.
9. **Verificación** — `npm test` (33 + nuevos) y `npm run build` verdes;
   `verify-plan` antes de dar por cerrado. QA de gameplay lo hace Paco
   (el Browser pane oculto congela RAF).

---

## Acceptance criteria

- [ ] La card SPACE INVADERS aparece en `/games` (SHOOTER, verde) y al final
      con captura real como cover.
- [ ] `/games/space-invaders/play` exige sesión (gate del spec 20) y renderiza
      el canvas 600×700.
- [ ] Grid 11×5 con 3 tipos y puntuaciones 10/20/30; el bloque acelera al
      quedar menos invasores y da un paso abajo en cada borde.
- [ ] Un solo proyectil del jugador en vuelo; los enemigos disparan desde la
      fila inferior viva de cada columna.
- [ ] Los 4 escudos se degradan píxel a píxel con proyectiles de ambos bandos.
- [ ] El UFO cruza cada 20–30 s y otorga 50–300 pts × multiplicador del nivel.
- [ ] El juego es endless: tras el nivel 10 la dificultad se mantiene en
      `WAVE_CONFIG[9]` y el nivel sigue subiendo.
- [ ] Game over por vidas a 0 o invasión de la fila del cañón; el modal
      inserta score con `user_id` del usuario y aparece en el leaderboard.
- [ ] El leaderboard de `/games/space-invaders` se actualiza en realtime.
- [ ] Los 8 SFX procedurales suenan en sus eventos; la marcha acelera con el
      nivel; cero archivos de audio externos.
- [ ] El mute de SFX (play-page) es independiente del mute de música del Nav
      y persiste en `localStorage`.
- [ ] Con PAUSA, `update()` se detiene y `draw()` continúa; la música global
      no se pausa (decisión del spec 21).
- [ ] Jugar Space Invaders por primera vez incrementa el contador de créditos
      del Nav (pasa a X/9).
- [ ] `MobileGamepad` permite mover y disparar en móvil (ajuste fino de
      `@mobile-porter`).
- [ ] Tests nuevos de lógica pura en verde; `npm test` y `npm run build`
      completos sin errores; ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: spec única (core + oleadas + SFX)** — la partición 01/02 de game-jam
  era del flujo antiguo; el ciclo validado (Pac-Man) entrega el juego completo
  en un spec. (Paco, 2026-08-20)
- **Sí: endless con dificultad capada en nivel 10** — plataforma orientada a
  leaderboard; una condición de victoria cerraría la caza de récords.
  (Paco, 2026-08-20)
- **Sí: SFX con mute propio e independiente de la música global** — dos capas
  de audio, dos controles; patrón reutilizable para los 4 juegos siguientes.
  (Paco, 2026-08-20)
- **Sí: cover con captura real** — patrón Pac-Man; CSS provisional solo hasta
  el final de la implementación. (Paco, 2026-08-20)
- **Sí: `SKIN_OPTIONS` duplicado una última vez** — la centralización de skins
  + fase 2 de créditos es la tarea inmediatamente posterior a este juego; no
  se bloquea el juego con ese refactor. (Paco, 2026-08-20)
- **Sí: `user_id` real en el insert de score** — el gate del spec 20 garantiza
  sesión; el `user_id: null` de la spec de referencia era pre-auth.
- **Sí: SFX procedurales sin assets** — coherente con la spec de referencia;
  si en QA alguno queda pobre, se pide el mp3 a Paco como mejora posterior,
  nunca se bloquea la entrega por ello.
- **No: power-ups, 2 jugadores, partículas, música propia** — fuera de alcance
  (ver Scope).

---

## Riesgos identificados

- **Performance de escudos**: 4 × 352 píxeles lógicos testeados por proyectil;
  mitigación: bounding-box del escudo antes de comprobar píxeles, sin allocs
  en el loop (spec 12).
- **Sensación de la marcha**: el `sfx_march` ligado al paso del bloque debe
  acelerar con él o el juego se siente muerto; criterio de aceptación propio.
- **Colisión de builds**: si `@mobile-porter`/`@skin-designer` corren en
  paralelo con otra build, serializar o reintentar a los 30 s (gotcha
  conocido de `.next`).
- **QA de gameplay headless imposible**: el Browser pane oculto congela RAF;
  la verificación agente se limita a estructura y primer frame, el gameplay
  lo valida Paco.
