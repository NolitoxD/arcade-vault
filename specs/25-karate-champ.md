# SPEC 25 — Integración del juego KARATE CHAMP

> **Estado:** Approved (diseño aprobado por Paco)
> **Depende de:** 12-frogger-performance, 20-auth-gate-play, 21-background-music,
> 23-space-invaders, 24-games-registry-credits-f2
> **Fecha:** 2026-08-25
> **Objetivo:** Integrar KARATE CHAMP con ID `karate-champ` (primera entrada de
> la categoría FIGHTING, color `gold`) como combate por puntos fiel al arcade:
> 8 técnicas por dirección+botón, combates a 2 puntos contra una escalera
> infinita de rivales CPU, fase bonus de romper tablas cada 3 rivales — nacido
> sobre el registro central (spec 24): candados de skins, modal de
> instrucciones, `saveScore` y leaderboard realtime desde el primer commit.

---

## Scope

**In:**

- Migración Supabase: fila `karate-champ` en `games` (`cat: 'FIGHTING'`,
  `color: 'gold'`, cover CSS provisional `cover-karate-champ`).
- `lib/supabase/types.ts`: `GameRow.cat` union + `'FIGHTING'`; `color` union
  + `'gold'`. Clase CSS `cover-karate-champ` en `app/globals.css` (motivo
  karateka dorado, patrón de las hermanas).
- **Entrada nº 10 en `lib/games-registry.ts`**: skins classic(base)/retro/neon,
  controles (tabla de técnicas abajo; táctil `keyMap` completo con
  `a: 'PATADA'`, `b: 'PUÑO'`), instrucciones (texto abajo), `realtime: true`.
- Lógica pura en `components/games/karate-logic/` con tests vitest:
  - `techniques.ts` — `TECHNIQUES`: 8 técnicas `{ id, input: { dir: 'neutral'
    | 'up' | 'down' | 'forward'; button: 'a' | 'b' }, name, points: 0.5 | 1,
    range, startupMs, recoveryMs, height: 'high' | 'mid' | 'low' }`;
    `resolveTechnique(dirHeld, button)`; `landsHit(attacker, defender,
    technique)` (rango + rival no bloqueando esa altura + no invulnerable).
  - `scoring.ts` — `SCORE_PER_POINT = { half: 500, full: 1000 }`,
    `OPPONENT_BONUS = 2000`, `timeBonus(remainingMs)`; estado de combate
    `{ playerPoints, cpuPoints, roundMs }`; `matchWinner(state)` (2 puntos o
    líder a los 30 s; empate → punto de oro: siguiente técnica gana).
  - `ai.ts` — máquina de estados CPU (`approach | retreat | attack | block |
    evade`) con decisión cada `reactionMs` y pesos por nivel; RNG inyectado
    (`rng: () => number`) → determinista en tests. `OPPONENT_CONFIG`: 10
    niveles `[reactionMs, aggression, blockChance, fullPointBias]` de
    `[600, 0.3, 0.2, 0.2]` a `[180, 0.8, 0.65, 0.5]`; clamp en nivel 10+.
  - `bonus.ts` — barra oscilante (`period` decreciente por tabla), zona verde,
    `hitQuality(phase)`; 3 tablas por fase bonus: 1000/2000/4000; fallar no
    penaliza.
- `components/games/KarateChampGame.tsx` — `"use client"`, canvas 800×500
  apaisado, RAF + delta acumulado, patrón props del registro:
  `{ paused, muted?, skinKey?, onScoreChange, onLivesChange, onLevelChange,
  onGameOver }` (`onLivesChange` reporta 1→0: un combate perdido = game over;
  `onLevelChange` = rival actual). Dos karatekas de perfil (gi blanco jugador,
  gi rojo CPU) con **poses estáticas por técnica** (2-3 frames pre-bakeados
  por skin, patrón sprites de Space Invaders); banner retro del árbitro
  ("¡MEDIO PUNTO!", "¡PUNTO!", "¡GANADOR!", "PUNTO DE ORO"); HUD in-canvas
  (score TL, marcador de puntos del combate TC como banderines, rival BR,
  timer 30 s TC-bajo); fase bonus cada 3 rivales vencidos; SKINS map solo
  `classic` (estructura de adición pura para retro/neon).
- SFX procedurales `lib/sfx-karate-champ.ts` (patrón clase de Space Invaders):
  `whoosh` (técnica), `hit` (impacto), `block`, `point` (medio/entero),
  `gong` (inicio/fin de combate), `board_break`, `game_over`. `AudioContext`
  diferido; mute vía prop; sin archivos de audio (si el árbitro con voz lo
  pide, mp3 de Paco en iteración posterior).
- `app/games/karate-champ/play/page.tsx` — espejo exacto del patrón spec 24
  (pacman/space-invaders): `useGameSkin('karate-champ')`,
  `getKeyMap('karate-champ')`, `saveScore`, botón "?" + overlay
  `InstructionsContent`, mute SFX propio (`av_sfx_muted`), `MobileGamepad`
  con `skinOptions`/`onHelp`, modal game-over, `dynamic(ssr: false)`.
- Controles teclado: ←→ mover (A/D alias), ↑/↓ modificadores de técnica
  (W/S alias), **J = patada (A)**, **K = puño (B)** (Espacio alias de J);
  el canvas escucha keydown/keyup en `document` con cleanup completo.
- Tests: los 4 módulos de lógica pura + entrada del registro cubierta por
  los tests existentes de `games-registry.test.ts` (se actualizan los
  asserts de `GAME_IDS`, realtime y catálogo).
- Cover final: captura real (`/covers/karate-champ.png` + migración UPDATE),
  CSS provisional hasta entonces.
- Cadena: implementación → `@mobile-porter` → `@skin-designer` (retro/neon)
  → cover → `verify-plan`.

**Fuera de alcance:**

- Modo 2 jugadores local u online (punto 8 del roadmap).
- Voz real del árbitro (mp3) — iteración posterior si los SFX saben a poco.
- Más fases bonus (esquivar objetos, toro) — minors diferidos.
- Barras de vida — decisión cerrada: puntos estilo original.
- Cambios en registro/créditos/instrucciones más allá de añadir la entrada.

---

## Data model

### Migración `games`

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'karate-champ',
  'KARATE CHAMP',
  'Ejecuta técnicas de karate precisas para puntuar antes que tu rival.',
  'Elige bien tu técnica y su momento: cada golpe limpio vale medio punto o un punto según su dificultad. Vence a 2 puntos, escala una lista infinita de rivales cada vez más rápidos y rompe tablas en las fases bonus.',
  'FIGHTING',
  'cover-karate-champ',
  'gold'
);
```

Aplicada por el orquestador por MCP y versionada con la versión EXACTA del
servidor. UPDATE final del cover con la captura real.

### Tabla de técnicas (registro + `techniques.ts`)

| Input | Técnica | Puntos | Altura | Notas |
|---|---|---|---|---|
| A | Patada frontal | ½ | mid | rápida |
| ↑+A | Patada alta | 1 | high | lenta, más alcance |
| ↓+A | Barrido | ½ | low | derriba, corto alcance |
| →+A | Patada voladora | 1 | high | avanza, la más lenta |
| B | Puñetazo | ½ | mid | la más rápida, corto alcance |
| ↑+B | Golpe alto | 1 | high | lenta |
| ↓+B | Puñetazo bajo | ½ | low | rápida |
| →+B | Golpe con salto | 1 | mid | avanza |

← retrocede (esquiva pasiva); → avanza. Bloqueo CPU por altura: una técnica
no conecta si el rival bloquea su altura o está fuera de rango.

### Instrucciones (entrada del registro)

- **goal:** "Puntúa con técnicas de karate limpias antes de que lo haga tu
  rival: las difíciles valen un punto entero, las rápidas medio. Gana el
  combate a 2 puntos y escala la lista infinita de aspirantes."
- **tips:** "Cada técnica tiene su distancia: la voladora cruza el tatami,
  el puñetazo exige cuerpo a cuerpo", "El rival bloquea por alturas —
  varía alto/medio/bajo", "Cada 3 rivales, fase bonus: rompe tablas
  pulsando en la zona verde", "Sin prisa: fallar una técnica te deja
  vendido durante la recuperación".

### Escalado de rivales (`OPPONENT_CONFIG`, `ai.ts`)

10 niveles `[reactionMs, aggression, blockChance, fullPointBias]`:
`[600,0.30,0.20,0.20]`, `[540,0.35,0.25,0.22]`, `[480,0.40,0.30,0.25]`,
`[430,0.45,0.35,0.28]`, `[380,0.50,0.40,0.32]`, `[330,0.55,0.45,0.36]`,
`[290,0.62,0.50,0.40]`, `[250,0.68,0.55,0.44]`, `[210,0.74,0.60,0.47]`,
`[180,0.80,0.65,0.50]` — clamp en 10+ (patrón `waveFor`).

---

## Implementation plan

1. **Types + migración + cover CSS** — unions `FIGHTING`/`gold`, INSERT por
   MCP versionado, `.cover-karate-champ` en globals.css. Card visible.
2. **Lógica pura + tests** — `techniques.ts`, `scoring.ts`, `ai.ts`,
   `bonus.ts` con sus suites ANTES del componente.
3. **Registro** — entrada `karate-champ` en `GAMES` + update de los asserts
   de `games-registry.test.ts` (10 ids, realtime set + karate-champ).
4. **SFX** — `lib/sfx-karate-champ.ts` + test de no-op sin AudioContext.
5. **`KarateChampGame.tsx`** — canvas, poses bakeadas, combate, árbitro,
   bonus, HUD; cero allocations en el loop (spec 12).
6. **Play-page** — espejo del patrón spec 24 completo.
7. **Cadena** — `@mobile-porter`, `@skin-designer`, cover real + UPDATE.
8. **Gate** — `npm test` + build verdes; `verify-plan`; QA gameplay de Paco.

---

## Acceptance criteria

- [ ] Card KARATE CHAMP en `/games` (FIGHTING, gold; cover provisional →
      captura real al final) y contador de créditos pasa a X/10.
- [ ] `/games/karate-champ/play` exige sesión y renderiza canvas 800×500.
- [ ] Las 8 técnicas salen con dirección+botón en teclado (J/K + flechas o
      WASD) y con dpad+A/B en móvil; cada una respeta puntos/altura/rango
      de la tabla.
- [ ] El rival bloquea por alturas y una técnica bloqueada o fuera de rango
      no puntúa.
- [ ] Combate a 2 puntos o 30 s (líder gana; empate → punto de oro);
      banners "¡MEDIO PUNTO!"/"¡PUNTO!"/"¡GANADOR!".
- [ ] Escalera infinita: rival N usa `OPPONENT_CONFIG[min(N,10)-1]`; la
      dificultad se nota entre niveles.
- [ ] Perder un combate → `onLivesChange(0)` + `onGameOver(score)`; el score
      se guarda vía `saveScore` y aparece en el leaderboard realtime.
- [ ] Fase bonus cada 3 rivales: 3 tablas, zona verde, 1000/2000/4000,
      fallar no penaliza.
- [ ] Botón INSTRUCCIONES del detalle y "?" de la play-page muestran las 8
      técnicas (tabla teclado normal/especial + táctil) desde el registro.
- [ ] Skins: classic jugable; retro/neon aparecen con candado según créditos
      (los añade @skin-designer al final).
- [ ] SFX procedurales en técnicas/impactos/puntos/gong/tablas; mute propio
      independiente de la música global.
- [ ] PAUSA y "?" pausan (`update()` se salta, `draw()` sigue).
- [ ] `npm test` (58 + nuevos) y `npm run build` verdes; ninguna ruta 500.

---

## Decisions

- **Sí: combate por puntos fiel al original** — no canibaliza SF2 (punto 5)
  y las poses estáticas abaratan la animación. (Paco, 2026-08-25)
- **Sí: 8 técnicas dirección+botón** — todas alcanzables con dpad+A/B en
  móvil; ← esquiva. (Paco, 2026-08-25)
- **Sí: escalera infinita a 2 puntos, un combate perdido = game over** —
  partidas cortas, caza de récords. (Paco, 2026-08-25)
- **Sí: fase bonus de tablas cada 3 rivales en v1** — pedida explícitamente;
  mecánica de 1 botón, barata. (Paco, 2026-08-25)
- **Sí: IA por máquina de estados con RNG inyectado** — testeable y
  suficiente; sin redes ni aprendizaje.
- **Sí: J/K como botones de teclado (Espacio alias de J)** — dos acciones
  necesitan dos teclas cómodas junto a WASD/flechas.
- **Sí: realtime true** — patrón de los juegos recientes.
- **No: 2P, voz de árbitro, más bonus, barras de vida** — ver Fuera de
  alcance.

---

## Riesgos identificados

- **La IA es lo más complejo hasta la fecha** — mitigación: máquina de
  estados pura con RNG inyectado y tests deterministas por nivel (p. ej.
  nivel 1 nunca reacciona en <600 ms; nivel 10 bloquea ~65%).
- **Sensación del combate (rangos/timings)** — los valores de la tabla son
  punto de partida; QA de gameplay de Paco los ajusta (constantes de módulo,
  un solo sitio).
- **Nuevas categorías en types** — `FIGHTING`/`gold` deben añadirse ANTES
  del INSERT o el detalle tipado fallará en build.
- **Punto de oro** — estado extra de la máquina de combate; test dedicado
  (empate a 1 a los 30 s → siguiente técnica limpia decide).
- **QA headless imposible** (RAF congelado): estructura + primer frame por
  agentes, gameplay de Paco.
