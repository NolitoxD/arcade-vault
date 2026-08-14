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

Leyenda: `✅` aplicado y verificado · `🟡` en progreso · `—` pendiente

## Notas

- **road-fighter** (2026-08-14, 2ª pasada): ampliación spec 17 cubierta — aceite/charco/meta con versión propia en retro (CRT sólido, paleta cálida) y neon (glow horneado en la caché offscreen P7: sprites `oil`, `puddle` y franja `goal` completa). Intermitente de IA afinado por contraste: retro `#ff3b30`, neon `#ffffff` (fillRect plano, sin glow — gameplay info). HUD (`hudColor`/`fuelOk`/`fuelLow`) sin cambios.
