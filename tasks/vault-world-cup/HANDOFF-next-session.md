# HANDOFF — VAULT WORLD CUP · etapa B cerrada · escrito 2026-09-06

**Repo:** `/Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault` · rama `main`.
**HEAD al escribir:** `5eeeb41` (Paco, 06-sep: spec con D1-D4 + plan B + checkpoint). **SIN commitear:** TODA la
etapa B (código en `components/games/football-logic/`, `ai.ts`/`ai.test.ts` nuevos sin trackear), las
ediciones H1-H11 del plan B, `tasks/vault-world-cup/CHECKPOINT-etapa-B.md` y este handoff — lo commitea Paco.
**Suite real:** 861 tests en 52 ficheros verdes (760 de partida + 101) · `npx tsc --noEmit` limpio ·
`npm run build` exit 0 · grep de determinismo vacío (tests incluidos).

---

## 1. Dónde estamos

**06-sep, en una sesión (cortada dos veces por límite de uso, reanudada sin pérdida):** plan de la etapa B
(`docs/superpowers/plans/2026-09-05-vault-world-cup-stage-b.md`, 3377 líneas), grill corto con Paco
(D1-D4, en el spec), pre-vuelo (H1-H11 aplicados al plan), y la **etapa B entera (Tasks 6a, 6b, 7)
ejecutada y verificada** con `subagent-driven-development`: cada tarea con revisión + ronda de arreglo
(6a y 6b una cada una; 7 limpia a la primera) + re-revisión; revisión final de la etapa con **15 sondas
ejecutables (1,2 M de pasos simulados, 0 violaciones)** + una ola de arreglo (R28) + re-revisión limpia.

**Lo que existe ahora además de la etapa A:** `ai.ts` completo (canal `want`, perfil 1-8 por fórmula,
colocación viva por formación/estrategia, portero en su línea que ataja y se queda el balón 2 s con saque
por botón o automático, error angular por perfil, `AiState`, `chooseStrategy`, `decideTeamInput` con el
árbol chutar/pasar/conducir, persecución y robo/entrada, penalti); `createMatch(teams, formations, pitch,
profiles)`; `HALF_*` en `clock.ts`; **16 selecciones y 3 formaciones** en `teams.ts` con la red de
invariantes cerrada sobre ellas (162 colocaciones en 84 ms); `scratch.events` barrido al inicio de CADA
paso (R28). Tres partidos grabados deterministas (criterio 1 seis fases, gol de oro con IA viva, CPU vs
CPU semilla 14) + uno por formación.

**Lo que NO existe:** `mode.ts`, `world-cup.ts`, pantalla, registro, migración, música, carátula (etapas C y D).

**Registro completo** (git-ignorado, NO borrar): `.superpowers/sdd/2026-09-05-vault-world-cup-stage-b/`
— `progress.md` (rulings R21-R28, 16 minors diferidos con triaje), `preflight.md`, briefs/informes/
revisiones por tarea, `final-review-report.md` (veredicto, sondas, criterios, números→constantes, triaje,
**recomendaciones para la etapa C y lista QA de la Task 11**), `final-fix-report.md`.

---

## 2. Próximos pasos, en orden

1. **Paco commitea la etapa B.** Mensaje recomendado por la revisión final (opción A, global):
   `feat(world-cup): stage B — in-engine AI, CPU decision layer, sixteen selections and three formations`
   (opción B, tres por tarea, en `final-review-report.md` §9; exigiría `git add` por rutas). Antes:
   `git status` debe mostrar solo `components/games/football-logic/`, `docs/`, `tasks/`. No hay
   `node_modules` colado (se borró una caché `.vite` de las sondas).
2. **`retomar` con este documento.** Comprobar árbol limpio y 861 verdes.
3. **Etapa C (Tasks 8-10 del spec: la pantalla).** Plan con `writing-plans` leyendo OBLIGATORIAMENTE
   `final-review-report.md` §8 "Recomendaciones para la etapa C" (6 puntos: `abandon()` para el gol de oro
   sin techo; cursor durante los 2 s del portero, S-GK.6, decisión visible; A/B tragados en la cuenta atrás →
   el HUD debe decirlo; `applyTeamChoices` corre cada paso, el HUD escribe `TeamInput` sin ceremonia) y el
   triaje "CARRY TO Task 8" del ledger (5 ítems: guarda −1 en `applyTeamInput`, `SHOT_VZ_MAX` y
   `*_SECONDS`/`SET_PIECE_COUNTDOWN_SECONDS` como consumidores del HUD/SFX, `OutfieldRole`/`Kit`/
   `ButtonState`/`ActionKind` con destino declarado, helper `isGoalkeeperRole`). Pre-vuelo con subagente.
   Luego `subagent-driven-development`. **Máximo la etapa C en el día.**
4. **Antes de la Task 11 (QA humano)** leer `final-review-report.md` §8 "QA list": 11 puntos con datos
   (ver sección 5 de este handoff).

---

## 3. Decisiones ya tomadas (no relitigar)

**Grill corto 05-sep (en el spec, §Decisiones 2026-09-05):** D1 persecución = K más cercanos (3/2/1),
1º controlado, siguiente cubre a 120 u; D2 `tackleChance` = disposición (éxito sigue 65/35); D3 perfil
humano con la misma dificultad (error angular 0); **D4 portero con balón**: atajada ≠ saque de puerta,
2 s inrobable, B saque con la mano / A largo, cruceta apunta, a los 120 pasos automático al más libre.

**Rulings de ejecución (ledger, R21-R28):** R24/S-GK detalles de D4 (primer saque en el paso siguiente
a la atajada; A gana a B; solo `pressed`; cursor sobre el portero = decisión de la etapa C); R25 tres tests
de la etapa A cambian por la regla 2 (no relajación); **R26** partido grabado criterio 1 con 6 fases +
segundo grabado "gol de oro con IA viva"; **R27** tasa de chuts de la CPU → QA (ver 5); **R28** barrido de
`scratch.events` al inicio de `stepMatch`.

**Supuestos abiertos etiquetados en código** (`// Stage B assumption`): S14b entrada de la CPU solo de
frente; S-GK; `SHOT_POST_MARGIN = 20` y `CHASE_DEAD_ZONE = 4` sin número → numerar en el spec.

---

## 4. Reglas de Paco (sin cambios)

Máximo UNA etapa al día · commits SOLO Paco · spec profundo + grill; duda de diseño en implementación →
grill corto · nunca `next dev` (:3000 es de Paco) · audio: dos pistas + SFX de fichero (sección 7 del
handoff del 04-sep, ya en el spec) · carátula con `design`, PNG 800×800 → `public/covers/vault-world-cup.png`.

---

## 5. Lista QA (Task 11) — resumen, detalle en `final-review-report.md` §8

- **Chuts de la CPU**: 160 planes → 123 completados (76,9 %); el cuello es que **casi nunca decide chutar**
  (puerta geométrica de `tryShoot`, ai.ts ~451-459: solo rayo recto/diagonal a < 55 u del centro).
  Palancas: ensanchar `SHOT_POST_MARGIN`, más direcciones candidatas, releer `shoot` en el tick, recalcular
  carga al soltar, capar la carga. Media 2,55 chuts/partido, 0 en 2 de 20 semillas.
- **0 saques de puerta y 2 córners en 18 partidos** (consecuencia de D4; palanca `catchChance`/geometría).
- Saque automático del portero cargado por rival a 2,7 u (bucle atajada→saque→robo→chut→atajada en 3 pasos).
- Entrada al portero que sostiene el balón sigue siendo falta (2 s de exposición a penalti; solo el humano lo
  explota). Decisión de producto.
- Penaltis: 20 en 60 partidos, 2 marcados / 8 parados / 10 sin gol en 4 s → mirar con más semillas.
- Dificultad: nivel 8 gana 18 de 20 al nivel 1, desde los dos lados. Números típicos 8v8: 11-16 k pasos,
  1-4 goles, 20-60 pases cortos y 10-35 largos por equipo, 6-49 robos ganados, 0-6 atajadas, 1-5 chuts.
- Robos simultáneos resuelven equipo 0 primero; una falta por paso (gana equipo 0) — heredado de la etapa A.

---

## 6. Trampas de hoy (además de las del 04-sep)

- **Ninguna copia `*.ts` bajo `.superpowers/`**: una instantánea `snapshot-after-6a/ai.test.ts` la ejecutó
  vitest (fallo fantasma). Las instantáneas van con extensión `.txt`.
- **Sin commits no hay `git diff BASE..HEAD`**: los paquetes de revisión se hacen con `git diff BASE --
  components/...` + ficheros nuevos anexados; para tareas encadenadas, instantánea `.txt` de la carpeta.
  `git stash create` NO incluye ficheros sin trackear.
- **Sondas ejecutables**: `--root <dir>` sin más NO aísla; lo que funciona es `ln -s <repo>/node_modules
  <dir>/node_modules` + `npx vitest run --root <dir>`. Borrar `components/games/football-logic/node_modules/`
  (caché `.vite`) si reaparece: `.gitignore` solo anula `/node_modules` en la raíz.
- Límite de uso cortó dos agentes a mitad: reanudar con agente fresco + auditoría del diff funciona; el
  `CHECKPOINT-etapa-B.md` con casillas fue la red (puede borrarse tras el commit).
- El editor enseña "Cannot find name" caducados tras cambios grandes; solo vale `npx tsc --noEmit`.
