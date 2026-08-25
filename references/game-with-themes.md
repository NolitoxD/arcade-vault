# Skins por juego — Estado

> Mantenido por el agente `skin-designer`. Un juego por corrida. No editar manualmente sin avisar al agente.

## Estado por juego

| Juego     | classic | retro | neon | Skins extra | Dark-mode revisado | Última actualización |
| --------- | ------- | ----- | ---- | ----------- | ------------------ | -------------------- |
| tetris    | —       | ✅    | ✅   | pastel      | parcial            | —                    |
| arkanoid  | ✅      | ✅    | ✅   | —           | sí                 | 2026-05-21           |
| asteroids | ✅      | ✅    | ✅   | —           | sí                 | 2026-05-21           |
| snake     | ✅      | ✅    | ✅   | —           | sí                 | 2026-05-21           |
| frogger   | ✅      | ✅    | ✅   | —           | sí                 | 2026-05-25           |
| pong      | ✅      | ✅    | ✅   | —           | sí                 | 2026-08-13           |
| road-fighter | ✅   | ✅    | ✅   | —           | sí                 | 2026-08-14           |
| pacman    | ✅      | ✅    | ✅   | —           | sí                 | 2026-08-19           |
| space-invaders | ✅ | ✅    | ✅   | —           | sí                 | 2026-08-20           |
| karate-champ | ✅   | ✅    | ✅   | —           | sí                 | 2026-08-25           |

Leyenda: `✅` aplicado y verificado · `🟡` en progreso · `—` pendiente

## Notas

- **karate-champ** (2026-08-25): componente ya traía la estructura de skins (prop `skinKey`, mapa
  `SKINS` con solo `classic`, fallback `SKINS[skinKey] ?? SKINS.classic`, selector ya cableado vía
  registro central en `app/games/karate-champ/play/page.tsx` — no tocado). Adición pura de `retro`
  y `neon`. Los luchadores son siluetas 2 colores horneadas por pose (`bakePose`, 20 poses × 2
  facing, cacheadas por `skin.name` en `spriteCache`): se generalizó `bakePose` con `opts`
  opcionales, mismo patrón que `bakeSprite` de Space Invaders — `highlight` para retro (pasada
  extra con `globalCompositeOperation: 'source-atop'`, recorta el brillo blanco 45% al tercio
  superior de la silueta real, sin blur) y `glowColor/glowBlur` para neon (pasada con `shadowBlur`
  horneada UNA vez en el canvas offscreen, con padding simétrico vía `c.translate(pad, pad)`; el
  hot path — `drawFighter`/`drawBonus` — solo hace `drawImage`, centrando en `spr.width/height`
  reales para mantener pies en `FLOOR_Y` y centro horizontal en `f.x` sin importar el padding).
  Elementos de baja frecuencia (línea del tatami, banner, timer/nivel del HUD — unos pocos trazos
  por frame, nunca por-píxel) llevan `shadowBlur` EN VIVO seteado y reseteado a mano tras cada
  trazo (mismo patrón que `PacmanGame`/`SpaceInvadersGame`), sin `save/restore` y sin crear canvas
  en el bucle. Paletas: retro CRT pastel dojo (gi jugador crema `#fff3d6`, gi CPU salmón `#ffab91`,
  piel `#f2c9a0`, suelo `#8a6a52`, línea dorada pastel `#ffe08a`); neon eléctrico sobre negro puro
  `#000000` (gi jugador cian `#00e5ff`, gi CPU magenta `#ff00e5`, piel amarillo eléctrico `#f5ff00`,
  línea del tatami cian `#00eaff`, acentos HUD/banner magenta `#ff00e5` con halo cian).

- **space-invaders** (2026-08-20): componente ya traía la estructura de skins (prop `skin`, mapa
  `SKINS` con solo `classic`, fallback `SKINS[skin] ?? SKINS.classic`, selector ya cableado en
  `app/games/space-invaders/play/page.tsx`) — esta pasada fue adición pura de `retro` y `neon` sin
  tocar la play-page. Invasores (crab/squid/octopus) siguen el mismo mecanismo de sprites horneados
  en offscreen canvas que ya usaba classic (`bakeSprite`, cacheados por tipo/frame, hot path solo
  `drawImage`): se generalizó `bakeSprite` con `opts` opcionales — `highlight` para retro (pasada
  extra vía `globalCompositeOperation: 'source-atop'`, recorta el brillo a la silueta real sin
  bleed) y `glowColor/glowBlur` para neon (pasada con `shadowBlur` horneada UNA vez en el canvas
  offscreen + pasada nítida encima; el frame loop nunca setea shadowBlur para invasores). Cañón,
  OVNI, balas y explosión se dibujan como mucho ~11 veces por frame (balas enemigas) así que van con
  `shadowBlur` en vivo reseteado a mano tras cada trazo (mismo patrón que `PacmanGame.tsx`, sin
  `save/restore`). Escudos (P7): los ~350 píxeles por escudo NO llevan `shadowBlur` por-píxel (sería
  caro); neon añade un halo barato de una sola `fillRect` con blur por escudo (`shieldGlow` en
  `Skin`, alpha 0.12) antes del relleno nítido de píxeles. Paletas: retro pastel CRT (crab ámbar
  `#ffcf5c`, squid cian `#7fe7ff`, octopus rosa `#ff8fc2`, highlight blanco 35%); neon eléctrico
  (crab `#00e5ff`, squid `#ff00e5`, octopus `#c6ff00`, jugador `#f5ff00`, boardBg `#000000` puro).

- **pacman** (2026-08-19): 3 skins nuevos sobre `PacmanGame.tsx` (antes solo `classic`). Fantasmas
  recolorizados por skin manteniendo identidad (Blinky rojo/Pinky rosa/Inky cian/Clyde naranja) vía
  fábrica `makeDrawGhostFlat` (classic/retro comparten cuerpo "flat fill", solo cambia paleta +
  highlight CRT) y un caché de sprites propio para neon (glow horneado, igual que los rivales de
  RoadFighterGame). P7 aplicado a pellets (~240/pantalla → sprite horneado `getNeonPelletSprite`/
  `getNeonPowerSprite`, cero `shadowBlur` en el hot path) y a los 4 fantasmas neon (cuerpo cacheado,
  ojos dibujados en vivo sin blur porque son fills planos baratos). Muros: `wallLayer()` ya cacheaba
  offscreen por maze/skin (generic, sin tocar), así que `drawWallsNeon` usa `shadowBlur` libremente.
  T2-b (wall islands muy regulares) resuelto SIN tocar geometría del laberinto: retro añade textura
  de "junta" (líneas de sombra entre celdas de muro contiguas) y neon añade una segunda línea interior
  más tenue (aspecto "doble trazo" tipo circuito) vía `traceWallOutline` reutilizable. T4-#5 (cambiar
  skin en pausa no repintaba) arreglado: `pauseDrawn` pasó de variable local del closure del efecto a
  `pauseDrawnRef` en scope de componente, invalidado en el `useEffect` de `skinKey`.

- **road-fighter** (2026-08-14, 2ª pasada): ampliación spec 17 cubierta — aceite/charco/meta con versión propia en retro (CRT sólido, paleta cálida) y neon (glow horneado en la caché offscreen P7: sprites `oil`, `puddle` y franja `goal` completa). Intermitente de IA afinado por contraste: retro `#ff3b30`, neon `#ffffff` (fillRect plano, sin glow — gameplay info). HUD (`hudColor`/`fuelOk`/`fuelLow`) sin cambios.
