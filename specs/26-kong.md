# SPEC 26 — Integración del juego KONG

> **Estado:** Approved (diseño aprobado por Paco)
> **Depende de:** 12-frogger-performance, 20-auth-gate-play, 21-background-music,
> 24-games-registry-credits-f2, 25-karate-champ
> **Fecha:** 2026-08-27
> **Objetivo:** Integrar KONG con ID `kong` (primera entrada de la categoría
> PLATFORMER, color `red`) como plataformas clásico de vigas: sube el zigzag de
> vigas esquivando o destruyendo barriles hasta el trofeo dorado del Vault,
> en bucle endless con dificultad por niveles — nacido sobre el registro
> central (candados, instrucciones, `saveScore`, realtime) y con música
> propia (`kong-theme.mp3`, patrón `setTrackOverride`).

---

## Scope

**In:**

- Migración Supabase: fila `kong` en `games` (`cat: 'PLATFORMER'`,
  `color: 'red'`, cover provisional `cover-kong`).
- `lib/supabase/types.ts`: `GameRow.cat` union + `'PLATFORMER'`. Clase CSS
  `.cover-kong` en `app/globals.css` (vigas magenta en zigzag + silueta de
  gorila, patrón de las hermanas) — se sustituye por el PNG del lienzo de
  diseño cuando Paco lo exporte (`/covers/kong.png` + migración UPDATE).
- **Entrada nº 11 en `lib/games-registry.ts`**: skins classic(base)/retro/
  neon; keyMap `{up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',
  right:'ArrowRight',a:' '}` con `a: 'SALTAR'` (sin B); teclado ←→/A-D
  correr, ↑↓/W-S trepar, Espacio/J saltar (special); instrucciones (abajo);
  `realtime: true`.
- Lógica pura en `components/games/kong-logic/` con tests vitest:
  - `level.ts` — geometría de la pantalla: 6 vigas inclinadas alternantes
    (`GIRDERS`: y base, pendiente ±, x0..x1), escaleras (`LADDERS`: x, viga
    inferior→superior, `broken?: boolean` — una rota sube pero los barriles
    no la usan y el jugador no puede bajarla), posición de Kong, trofeo,
    2 martillos, spawn del jugador. `girderYAt(girder, x)` (y sobre la
    pendiente), `ladderAt(x, girderIndex)`, `LEVEL_CONFIG`: 10 niveles
    `[barrelIntervalMs, barrelSpeed, ladderChance, brokenLadders]` de
    `[2600, 110, 0.20, 0]` a `[1100, 220, 0.55, 3]`, `configFor(level)`
    clamp 10+ (patrón `waveFor`).
  - `barrels.ts` — rodadura sobre pendiente (`advanceBarrel(b, dtMs,
    speed)`), caída al borde de viga, `shouldTakeLadder(chance, rng)`
    (RNG inyectado, nunca en escaleras rotas), pool máx. 12.
  - `player.ts` — estados `run | jump | climb | hammer | dead`; física:
    `GRAVITY`, `JUMP_VY`, snap a la pendiente al aterrizar, trepado por
    rejilla de escalera (entrar solo alineado ±8px), no saltar ni trepar
    con martillo; `stepPlayer(p, input, level, dtMs)` puro.
  - `scoring.ts` — `SCORE_JUMP = 100` (barril saltado: cruza bajo el
    jugador en salto), `SCORE_SMASH = 300` (barril destruido con
    martillo), `HAMMER_MS = 8000`, `timeBonus(remainingMs)` (100/s,
    presupuesto 90 s por nivel), `SCORE_LEVEL = 1500` al alcanzar el
    trofeo.
- `components/games/KongGame.tsx` — `"use client"`, canvas 600×700
  vertical, props patrón registro (`paused`, `muted?`, `skinKey?`,
  `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`);
  sprites pixel pre-bakeados por skin (jugador 3 frames carrera + salto +
  trepado ×2 + martillo ×2, Kong 2 frames pecho + lanzamiento, barril ×2
  rotación, martillo, trofeo); Kong lanza con cadencia del nivel; muerte →
  vida-- y reset de posición (3 vidas → game over); banner retro
  ("¡NIVEL SUPERADO!", "¡TROFEO!"); HUD in-canvas (score TL, vidas BL,
  nivel BR, bonus-tiempo TC); SFX procedurales `lib/sfx-kong.ts` (`jump`,
  `walk_tick`, `barrel_roll` no — solo eventos: `jump`, `land`, `climb`,
  `hammer_pickup`, `smash`, `point`, `death`, `level_clear`, `game_over`);
  cero allocations en el loop (spec 12); pausa mantiene draw.
- `app/games/kong/play/page.tsx` — espejo del patrón (useGameSkin,
  getKeyMap, saveScore, "?" overlay, mute SFX `av_sfx_muted`,
  MobileGamepad, modal game-over, `dynamic(ssr:false)`, CRT
  `aspectRatio: '6 / 7'`) + **música propia**: `setTrackOverride
  ('/kong-theme.mp3')` en mount / `null` en cleanup (patrón KC).
- Tests: los 4 módulos de kong-logic + updates de `games-registry.test.ts`
  (11 ids, realtime, skins, keyMap).
- Cadena: implementación → `@mobile-porter` → `@skin-designer` (retro/
  neon) → cover PNG de Paco → `verify-plan`.

**Fuera de alcance:**

- Pantallas de ascensores/remaches del arcade completo (v2 si apetece).
- Bolas de fuego, muelles y enemigos adicionales.
- Personajes de terceros (Pauline/Mario): el objetivo es el TROFEO del
  Vault y el jugador es nuestro personaje pixel propio.
- Música/SFX con archivos extra (kong-theme.mp3 ya está; SFX
  procedurales).
- Cambios en registro/créditos más allá de la entrada nueva.

---

## Data model

### Migración `games`

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'kong',
  'KONG',
  'Esquiva los barriles y escala las vigas hasta el trofeo.',
  'Kong ha robado el trofeo del Vault y lo defiende desde lo alto lanzando barriles. Corre por las vigas, trepa las escaleras, salta lo que ruede hacia ti — o agarra un martillo y hazlo astillas. Cada trofeo recuperado lo sube más arriba.',
  'PLATFORMER',
  'cover-kong',
  'red'
);
```

Aplicada por el orquestador por MCP y versionada con la versión EXACTA del
servidor. UPDATE final del cover con el PNG del lienzo.

### Instrucciones (entrada del registro)

- **goal:** "Sube el zigzag de vigas hasta el trofeo dorado esquivando los
  barriles de Kong: salta lo que ruede hacia ti, trepa rápido y no te
  entretengas — el bonus de tiempo cae cada segundo."
- **tips:** "Saltar un barril da 100 puntos — saltar en el sitio también
  cuenta si te pasa por debajo", "El martillo destruye barriles 8
  segundos, pero no deja saltar ni trepar", "Las escaleras rotas suben
  pero no bajan — y los barriles no las usan", "Cada trofeo endurece a
  Kong: más barriles, más rápidos y más listos".

### `LEVEL_CONFIG` (`level.ts`)

10 niveles `[barrelIntervalMs, barrelSpeed, ladderChance, brokenLadders]`:
`[2600,110,0.20,0]`, `[2400,120,0.24,0]`, `[2200,130,0.28,1]`,
`[2000,145,0.32,1]`, `[1850,160,0.36,1]`, `[1700,172,0.40,2]`,
`[1550,185,0.44,2]`, `[1400,196,0.48,2]`, `[1250,208,0.52,3]`,
`[1100,220,0.55,3]` — clamp en 10+.

### Scoring

| Evento | Puntos |
|---|---|
| Barril saltado | 100 |
| Barril destruido (martillo) | 300 |
| Trofeo (nivel superado) | 1500 + timeBonus(restante de 90 s) |

---

## Implementation plan

1. **Types + migración + cover CSS** — union `PLATFORMER`, INSERT por MCP
   versionado, `.cover-kong` provisional.
2. **kong-logic + tests** — `level.ts`, `barrels.ts`, `player.ts`,
   `scoring.ts` ANTES del componente (TDD).
3. **Registro** — entrada `kong` + asserts de `games-registry.test.ts`
   (11 ids).
4. **SFX** — `lib/sfx-kong.ts` (patrón clase KC/SI) + test no-op.
5. **`KongGame.tsx`** — canvas, sprites bakeados, spawn/rodadura, física,
   martillo, trofeo, HUD, banners.
6. **Play-page** — espejo completo + música propia (`setTrackOverride`).
7. **Cadena** — mobile-porter, skin-designer, cover PNG + UPDATE.
8. **Gate** — tests + build; `verify-plan`; QA gameplay de Paco.

---

## Acceptance criteria

- [ ] Card KONG en `/games` (PLATFORMER, red; cover CSS → PNG del lienzo)
      y créditos pasan a X/11.
- [ ] `/games/kong/play` exige sesión y renderiza canvas 600×700.
- [ ] 6 vigas en zigzag con pendiente real (los barriles aceleran viga
      abajo y caen al borde); escaleras conectan pisos, las rotas suben
      pero no bajan y los barriles nunca las usan.
- [ ] Kong lanza barriles con la cadencia del nivel; algunos bajan
      escaleras según `ladderChance` (RNG inyectado, testeado).
- [ ] ←→ corre (afectado por pendiente), ↑↓ trepa alineado a escalera,
      A/Espacio salta; saltar un barril suma 100.
- [ ] Martillo: se recoge al tocar, dura 8 s, destruye barriles (300),
      bloquea salto y trepado mientras.
- [ ] Tocar un barril (sin martillo) o caer un piso completo = vida
      perdida y reset de posición; 3 vidas → `onLivesChange` +
      `onGameOver` + `saveScore` en el modal; leaderboard realtime.
- [ ] Trofeo → banner, 1500 + bonus de tiempo (90 s por nivel), nivel+1
      con `LEVEL_CONFIG[min(N,10)-1]`; endless.
- [ ] Instrucciones (detalle y "?") muestran objetivo, tips y controles
      desde el registro.
- [ ] Skins classic jugable; retro/neon con candado (via @skin-designer).
- [ ] Música propia suena solo en la play-page de Kong y obedece el mute
      del Nav; SFX con mute propio.
- [ ] PAUSA y "?" pausan (draw sigue).
- [ ] `npm test` (78 + nuevos) y `npm run build` verdes; ninguna ruta 500.

---

## Decisions

- **Sí: una sola pantalla clásica de vigas, endless** — el layout icónico
  con dificultad por tabla; ascensores/remaches quedan para una v2.
  (Paco, 2026-08-27)
- **Sí: martillo con timer y auto-golpeo** — solo tenemos A (salto) en
  móvil; el martillo no necesita botón. (Paco, 2026-08-27)
- **Sí: el TROFEO del Vault como meta** — sin personajes de terceros;
  coherente con el Hall of Fame. (Paco, 2026-08-27)
- **Sí: PNG del lienzo de diseño como cover** — primera cover diseñada
  (no captura); Paco la exporta del canvas de Claude Design.
  (Paco, 2026-08-27)
- **Sí: música propia con `setTrackOverride`** — tercer juego con tema
  propio, patrón establecido en KC.
- **Sí: RNG inyectado en decisiones de barril** — determinismo en tests,
  patrón IA de KC.
- **No: fuego/muelles/ascensores/personajes de terceros** — ver Fuera de
  alcance.

---

## Riesgos identificados

- **Física de plataformas** — lo nuevo de verdad (gravedad, snap a
  pendiente, trepado): mitigación: `stepPlayer` puro con tests de casos
  (aterrizar en pendiente, entrar/salir de escalera, no trepar con
  martillo, muerte por caída larga).
- **Sensación del salto** — `GRAVITY`/`JUMP_VY` como constantes de módulo
  único sitio; QA de Paco las ajusta.
- **Colisión barril-salto** — "barril saltado" = barril cruza la vertical
  del jugador mientras está en el aire; ventana definida en `scoring` y
  testeada para no duplicar puntos por barril.
- **Union `PLATFORMER` antes del INSERT** — misma trampa que FIGHTING;
  el plan lo secuencia.
- **QA headless imposible** (RAF congelado): estructura por agentes,
  gameplay de Paco.
