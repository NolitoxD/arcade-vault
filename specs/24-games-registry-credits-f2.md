# SPEC 24 — Registro central de juegos, créditos fase 2 e instrucciones

> **Estado:** Approved (grill 2026-08-21)
> **Depende de:** 10-mobile-touch-controls, 11-mobile-gamepad-neon-skin,
> 13-supabase-auth, 21-background-music, 22-credits-collection, 23-space-invaders
> **Fecha:** 2026-08-21
> **Objetivo:** Sustituir las 9 copias de `SKIN_OPTIONS`/`keyMap`/`getSavedSkin`
> de las play-pages (y la lista propia de `MobileGamepad`) por un **registro
> central tipado por juego** en `lib/`, implementar sobre él la **fase 2 de
> créditos** (skins desbloqueables por umbrales fijos 3/6/9, insignias de rango y
> feedback de desbloqueo) y añadir el **modal de instrucciones y controles** por
> juego vía parallel + intercepting routes de Next 16, accesible desde el detalle
> y desde la play-page.

---

## Scope

**In:**

- `lib/games-registry.ts` — `GAMES: Record<GameId, GameMeta>` con una entrada
  por juego (los 9 actuales): `skins` (`{ key, label, tier }`, tiers
  `base | retro | neon | extra`; exactamente un `base` por juego), `controls`
  (`keyboard: { keys: string[]; action: string; special?: boolean }[]` y
  `touch: { keyMap: KeyMap; a?: string; b?: string }` con etiquetas de los
  botones), `instructions: { goal: string; tips: string[] }` y
  `realtime: boolean` (absorbe `REALTIME_GAMES`). Helpers puros `getGame(id)`,
  `getSkinOptions(id)`, `getKeyMap(id)`, `GAME_IDS`.
- `lib/credits.ts` — **escalera fija** `THRESHOLDS = { retro: 3, neon: 6,
  extra: 9 }` (revisable a mano si el catálogo crece mucho; nunca re-bloquea
  un skin ya obtenido); `isUnlocked(tier, credits)`, `resolveSkin(id,
  savedKey, credits)` (skin guardado bloqueado → `base` sin error),
  `getRank(credits, catalogSize)` y `getStars(credits)` movidos desde
  `Nav.tsx` con los mismos cortes (INVITADO sin sesión · NOVATO <3 ·
  JUGADOR ≥3 · VETERANO ≥6 · MAESTRO DEL VAULT = catalogSize completo).
- `lib/scores.ts` — `saveScore({ gameId, playerName, score })`: único punto
  de insert en `scores` (sustituye las 9 copias de las play-pages) y llama a
  `refreshCredits()` al terminar; devuelve `{ error }`.
- `components/RankBadge.tsx` — 4 insignias pixel-art SVG inline (NOVATO,
  JUGADOR, VETERANO, MAESTRO), paleta neón de la app, ~18 px; recibe `rank`
  (fuente agnóstica: hoy créditos propios, mañana rango de rivales online).
  Se muestra junto al username en el Nav y en el toast. Diseño previo en
  lienzo (skill `design`) para aprobación de Paco antes de cablear.
- `hooks/use-game-skin.ts` — `useGameSkin(id)` → `{ skinKey, options, change }`:
  lee registro + `localStorage` `<id>-skin` + créditos de `useUser()`; `options`
  trae `locked: boolean` y `requiredCredits` para pintar "🔒 RETRO · 3 créditos"
  (`disabled`).
- Refactor de las **9 play-pages**: eliminar `SKIN_OPTIONS`, `getSavedSkin`,
  `changeSkin` y `keyMap` locales → `useGameSkin` + `getKeyMap`. Renombrar prop
  `skin` → `skinKey` en `components/games/SpaceInvadersGame.tsx`.
- `components/MobileGamepad.tsx`: nueva prop `skinOptions` (sustituye su lista
  hardcoded); pinta bloqueados con candado y `disabled`.
- **KeyMaps muertos**: asteroids `b:'z'` eliminado; tetris `b:'Shift'` →
  `b:' '` (hard drop accesible en móvil); arkanoid `a:' '` **eliminado** (verificado:
  `ArkanoidGame.tsx:399-401` solo escucha ←→ y la bola se sirve sola en
  `resetBall`).
- **Feedback de desbloqueo**: `UserContext` expone `credits`/`catalogSize` y
  refresca `playedGameIds` tras cada insert de score (`refreshCredits()`);
  detecta transición de umbral (antes/después) y emite evento;
  `components/CreditsToast.tsx` montado en `app/layout.tsx` muestra
  "NUEVO SKIN DESBLOQUEADO · RETRO" (y NEON/EXTRA) y/o "NUEVO RANGO ·
  VETERANO" con su `RankBadge`, ~4 s.
- **Instrucciones** — rutas en `app/games/[id]/`: `layout.tsx` con slot
  `@modal`; `@modal/default.tsx` (null); `@modal/(.)instructions/page.tsx`
  (modal cliente, cierra con `router.back()`, Escape y click fuera);
  `instructions/page.tsx` (página completa para URL directa/refresh/compartir).
  Contenido común `components/InstructionsContent.tsx` (objetivo, tips,
  tabla teclado normal/especial, tabla táctil) leyendo del registro.
  Botón **INSTRUCCIONES** junto a JUGAR en `app/games/[id]/page.tsx`.
- Botón **"?"** en el HUD desktop y en `MobileGamepad` de las 9 play-pages →
  overlay `InstructionsContent` que pausa el juego (`paused` true mientras
  está abierto).
- Borrar `app/games/[id]/play/page.tsx` (mock sin uso, sombreado por las
  rutas estáticas).
- `LiveLeaderboard.tsx` lee `getGame(gameId).realtime` en vez de
  `REALTIME_GAMES`.
- Tests vitest: `lib/credits.test.ts` (bordes 2/3, 5/6, 8/9, MAESTRO =
  catalogSize, rank/stars, `isUnlocked`, `resolveSkin` fallback) y
  `lib/games-registry.test.ts` (9 ids, un único `base` por juego, keyMaps con
  teclas válidas de `KeyMap`, instrucciones no vacías, tetris con 4 skins).
- Actualizar `references/implemented-games.md` (añadir space-invaders) y
  `lib/supabase/types.ts` (`color` union con `blue`/`red`).

**Fuera de alcance:**

- Cambiar dibujo/paletas de ningún skin ni añadir skins nuevos.
- Otras recompensas (sonidos, títulos, avatares) — solo skins por tier e
  insignias de rango.
- Persistir skins/desbloqueos en Supabase (siguen en `localStorage`; el
  desbloqueo se deriva de créditos en cada sesión).
- Editor de instrucciones en DB — texto estático en el registro.
- El bug de render no-responsive en play-pages (QA abierto, investigación
  aparte).
- Insignia de OTROS usuarios (leaderboards, rivales online): requiere
  vista/RPC `player_rank(user_id)` en Supabase → punto 8 (multiplayer).
  Este spec deja `RankBadge` agnóstico de la fuente.

---

## Data model

### Tipos del registro (`lib/games-registry.ts`)

```ts
export type SkinTier = 'base' | 'retro' | 'neon' | 'extra';
export type SkinDef = { key: string; label: string; tier: SkinTier };
export type KeyboardControl = { keys: string[]; action: string; special?: boolean };
export type TouchControls = { keyMap: KeyMap; a?: string; b?: string }; // KeyMap de MobileGamepad
export type GameMeta = {
  id: GameId;
  skins: SkinDef[];
  controls: { keyboard: KeyboardControl[]; touch: TouchControls };
  instructions: { goal: string; tips: string[] };
  realtime: boolean;
};
export type GameId =
  | 'asteroids' | 'tetris' | 'arkanoid' | 'snake' | 'frogger'
  | 'pong' | 'road-fighter' | 'pacman' | 'space-invaders';
```

### Skins por juego

| Juego | base | retro | neon | extra |
|---|---|---|---|---|
| 8 juegos | classic | retro | neon | — |
| tetris | retro | — | neon | pastel, pixel |

### Umbrales (`lib/credits.ts`)

| Tier | Créditos | Rango asociado | Insignia |
|---|---|---|---|
| base | 0 | NOVATO (con sesión, <3) | moneda gris |
| retro | 3 | JUGADOR | moneda cian |
| neon | 6 | VETERANO | estrella magenta |
| extra | 9 | — | — |
| todos | = catalogSize | MAESTRO DEL VAULT | corona dorada |

Fijos (decisión de grill): proporcionales re-bloquearían skins al crecer el
catálogo, contra la regla de spec 22. Estrellas: ★ por corte alcanzado
(3/6/9 → ★★★). Con 13 juegos siguen siendo 23%/46%/69% del catálogo.

### `saveScore` (`lib/scores.ts`)

```ts
async function saveScore(input: { gameId: GameId; playerName: string; score: number }):
  Promise<{ error: string | null }>;
// insert { game_id, player_name, score, user_id } con el user de sesión,
// después refreshCredits() → UserContext detecta cruces de umbral/rango
```

### Contrato de `useGameSkin`

```ts
function useGameSkin(id: GameId): {
  skinKey: string;                       // efectivo (ya resuelto contra candados)
  options: (SkinDef & { locked: boolean; requiredCredits: number })[];
  change: (key: string) => void;         // ignora keys bloqueadas
};
```

### Evento de desbloqueo

`UserContext` guarda `credits` previo; tras `refreshCredits()` compara los
cortes de `THRESHOLDS` y el rango (`getRank`) antes/después y publica
`lastUnlock: { tiers: SkinTier[]; rank?: Rank }` consumido por `CreditsToast`.

### Textos de instrucciones (propuesta, revisar)

- **asteroids** — Objetivo: destruye todos los asteroides sin chocar; los
  grandes se parten en trozos más rápidos. Tips: gira y empuja con inercia,
  la pantalla envuelve por los bordes, los ovnis dan bonus.
- **tetris** — Objetivo: encaja las piezas y completa líneas; cada línea
  suma y el ritmo sube por nivel. Tips: hard drop para ganar tiempo, haz
  tetris (4 líneas) para multiplicar, no dejes huecos bajo las piezas.
- **arkanoid** — Objetivo: rompe todos los ladrillos rebotando la bola con
  la pala sin dejarla caer. Tips: el ángulo depende de dónde golpea la
  pala, recoge power-ups, los ladrillos plateados aguantan dos golpes.
- **snake** — Objetivo: come fruta para crecer sin chocar contigo ni con los
  bordes. Tips: planifica la ruta, cuanto más largo más lento reaccionas,
  no gires 180°.
- **frogger** — Objetivo: cruza la carretera y el río hasta las cuevas sin
  que te atropellen ni caigas al agua. Tips: sube a troncos y tortugas, el
  tiempo cuenta, completa las 5 cuevas para subir de nivel.
- **pong** — Objetivo: devuelve la bola y marca 11 puntos antes que el
  rival. Tips: golpea con el borde de la pala para cerrar el ángulo, la bola
  acelera en cada intercambio; modo 2 jugadores solo con teclado.
- **road-fighter** — Objetivo: llega a la meta antes de quedarte sin
  gasolina esquivando el tráfico. Tips: ↑ turbo, ↓ freno; rozar un coche te
  hace derrapar — contravolante; recoge combustible.
- **pacman** — Objetivo: come todos los puntos del laberinto huyendo de los
  4 fantasmas. Tips: los power pellets los vuelven azules y comestibles, la
  fruta del centro da bonus, usa los túneles laterales.
- **space-invaders** — Objetivo: destruye oleada tras oleada de invasores
  antes de que lleguen abajo. Tips: los escudos se desgastan, el bloque
  acelera al quedar pocos, caza el UFO para puntuación extra.

---

## Implementation plan

1. `lib/credits.ts` + `lib/scores.ts` + tests (umbrales fijos, rank/stars,
   isUnlocked, resolveSkin; saveScore con cliente mockeado).
2. `lib/games-registry.ts` + tests (9 entradas completas: skins, controles
   teclado/táctil, instrucciones, realtime).
3. `RankBadge` (diseño aprobado en lienzo) + `useGameSkin` + `UserContext`
   (credits/catalogSize/refreshCredits/lastUnlock) + `CreditsToast` en layout
   + `Nav.tsx` consumiendo `lib/credits` y mostrando `RankBadge` junto al
   username.
4. `MobileGamepad` con `skinOptions` + botón "?"; refactor de las 9
   play-pages (hook, keyMap del registro, "?" en HUD, fix keyMaps muertos,
   `skinKey` en SpaceInvaders, `saveScore` en el modal de game-over).
5. Rutas de instrucciones (`layout.tsx` + `@modal` + interceptada + página
   completa + `InstructionsContent`) + botón en detalle + borrado del mock +
   `LiveLeaderboard` por registro.
6. Docs/tipos: `implemented-games.md`, `types.ts`; `npm test`, `npm run
   build`, verify-plan; QA manual de Paco.

---

## Acceptance criteria

- [ ] Ninguna play-page define `SKIN_OPTIONS`, `getSavedSkin`, `changeSkin`
      ni `keyMap` local; todas usan `useGameSkin` y `getKeyMap`.
- [ ] `MobileGamepad` no contiene lista de skins; recibe `skinOptions`.
- [ ] Tetris ofrece retro (base), neon, pastel, pixel; los 8 restantes
      classic/retro/neon; el selector pinta bloqueados con candado y no
      permite elegirlos.
- [ ] Umbrales fijos 3/6/9 en `lib/credits.ts`; test cubre bordes (2/3,
      5/6, 8/9) y MAESTRO = catalogSize.
- [ ] Ninguna play-page hace `insert` en `scores` directamente; todas usan
      `saveScore`.
- [ ] `RankBadge` visible junto al username en el Nav para los 4 rangos;
      diseño aprobado por Paco.
- [ ] Rango y estrellas del Nav usan `lib/credits` y coinciden con los
      umbrales.
- [ ] Un skin bloqueado guardado en `localStorage` cae a `base` sin error.
- [ ] Al guardar un score que cruza un umbral aparece el toast de desbloqueo
      (skin y/o rango con insignia) y el skin queda disponible sin recargar.
- [ ] `/games/<id>` tiene botón INSTRUCCIONES; al navegar desde el detalle se
      abre como modal (URL `/games/<id>/instructions`); URL directa/refresh
      muestra la página completa; Escape/atrás cierran.
- [ ] El botón "?" de la play-page (HUD y gamepad) abre las instrucciones y
      pausa el juego.
- [ ] Instrucciones muestran objetivo, tips y tablas de teclado (normal y
      especial) y táctil para los 9 juegos.
- [ ] asteroids sin botón B; tetris B = hard drop en móvil; arkanoid sin
      botón A.
- [ ] `app/games/[id]/play/page.tsx` eliminado; todas las rutas `/games/*/play`
      siguen funcionando.
- [ ] `LiveLeaderboard` decide realtime por el registro; los 4 juegos
      realtime siguen actualizándose en vivo.
- [ ] `SpaceInvadersGame` expone `skinKey`.
- [ ] `npm test` (46 + nuevos) y `npm run build` verdes; ninguna ruta 500.

---

## Decisions

- **Sí: registro en código (`lib/`)**, no en DB — skins y teclas están
  acoplados a los componentes; una sola fuente de verdad, sin migraciones.
  (Paco, 2026-08-21)
- **Sí: Tetris conserva sus 4 skins** — retro como base, neon por umbral,
  pastel/pixel como `extra` desbloqueables. No se destruye trabajo visual.
  (Paco, 2026-08-21)
- **Sí: umbrales FIJOS 3/6/9** (grill, Paco 2026-08-21) — los proporcionales
  re-bloqueaban skins ya obtenidos al crecer el catálogo, violando la regla
  de spec 22 "recompensas que añaden, nunca bloquean"; se revisan a mano si
  hace falta.
- **Sí: `saveScore` centralizado** (grill) — un solo insert + refresh de
  créditos; el toast se dispara en el momento de la recompensa sin
  suscripciones realtime. (Paco, 2026-08-21)
- **Sí: insignias de rango (`RankBadge`)** (grill) — 4 SVG pixel-art
  diseñados por Claude y aprobados en lienzo; en Nav y toast ahora; junto a
  rivales online en el punto 8 vía RPC de rango. (Paco, 2026-08-21)
- **Sí: limpieza colateral completa** (mock muerto, keyMaps muertos,
  `skinKey`) — el registro de controles es justo la fuente que los corrige.
  (Paco, 2026-08-21)
- **Sí: modal en detalle + "?" en play-page**; intercepting routes para URL
  compartible; overlay en juego para no salir de la partida. (Paco, 2026-08-21)
- **Sí: toast de desbloqueo** — la recompensa debe verse. (Paco, 2026-08-21)
- **Sí: textos redactados por Claude desde las specs**, Paco revisa en esta
  spec. (Paco, 2026-08-21)
- **Bloqueo cosmético siempre** (regla de spec 22): nunca afecta a
  jugabilidad ni puntuación.
- **No: persistencia de desbloqueos en DB** — se derivan de créditos.

---

## Riesgos identificados

- **Refactor en 9 páginas** — riesgo de regresión en alguna; mitigación: el
  hook replica exactamente el comportamiento actual (misma clave de
  `localStorage`, mismo default) y QA por juego.
- **Parallel routes en `[id]` dinámico** — comprobar contra
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/{parallel-routes,intercepting-routes,default}.md`
  antes de escribir; `default.tsx` obligatorio para no romper el hard
  navigation del detalle.
- **Detección de transición de umbral** — requiere `refreshCredits()` tras
  el insert (hoy solo se recalcula al cambiar de usuario); cuidado con
  dobles toasts en StrictMode.
- **Escalera fija** — si el catálogo supera ~15 juegos, 9 créditos para
  `extra` se queda corto de reto; revisar entonces (subir nunca re-bloquea
  si se hace con aviso).
