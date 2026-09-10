# HANDOFF — VAULT WORLD CUP · paso 9 EN EJECUCIÓN (7/7 tareas implementadas, cierre pendiente) · actualizado 2026-09-10

## -3. 10-sep: ejecución SDD del paso 9 (cortada por límite de uso de Paco)

**Working tree = las 7 tareas implementadas, SIN commitear** (Paco commitea; mensajes propuestos en cada
`task-9-N-report.md`). Verificado al cortar: **1163 tests / 68 ficheros verdes**, `npx tsc --noEmit` limpio, eslint
limpio, `npm run build` exit 0. Motor tocado SOLO en `match.ts` (+test) por G9-1. Ficheros nuevos: `football-logic/
{world-cup,mode}.ts`, `football-screen/{match-run,flow,flow-layout,particles}.ts` (+tests); modificados: `match.ts`,
`hud.ts`, `keyboard.ts`, `loop.ts`, `match-loop.ts`, `captions.ts`, `sfx-map.ts`, `lib/sfx-vault-world-cup.ts`,
`VaultWorldCupGame.tsx` (990→1593, flujo entero en el canvas), `app/games/vault-world-cup/play/page.tsx` (4 modos).

**Ledger de verdad:** `.superpowers/sdd/2026-09-09-vault-world-cup-step-9/progress.md` (rulings, reviews, minors
diferidos, estado exacto). Helpers: `package.sh` (paquete de revisión sin commits: working tree vs 0e553af o vs
snapshot) y `snapshot.sh` (copias `.txt`, nunca `.ts`). Briefs/reports/reviews por tarea en la misma carpeta.

**Estado por tarea:** 9-1..9-5 COMPLETE (review + fix round + re-review limpias). 9-6: fix round 1 hecho
(constantes des-exportadas + test con stub de `Audio` para `play(gain)`/`stop`), **re-review pendiente**
(`review-9-6-r1.md` ya generado). 9-7: review (opus) Approved con **1 Important pendiente de fix round**: abandono
por viewport en el Mundial ganando/empatando rotula GANADOR/EMPATE aunque el modo/página digan ELIMINADO
(`collectCaptions` lee `winnerOf` sobre el marcador en pie; hueco del brief). Fix = cambio pequeño de contrato en
`captions.ts` (flag de abandono, o rótulo forzado cuando `modeScores(mode)`), conservando GANADOR/ELIMINADO/EMPATE
en el amistoso (S-SC12). En el mismo fix round: `break` del bucle de pasos cuando `match.phase === 'over'` (kick
repetido a x4) y `if (!run.human[t]) continue` en `handleKeyUp`. Minors diferidos al Cierre/QA en el ledger.

**Siguiente sesión, en orden:** `/retomar` → (1) re-review 9-6 (haiku, paquete listo) → (2) fix round 9-7 + re-review
→ (3) revisión final de rama (opus, `requesting-code-review/code-reviewer.md`, paquete con `package.sh` de TODO el
working tree vs 0e553af) → (4) UNA ola de fixes + re-review → (5) Cierre del paso 9 según el plan (C1-C9: sondas
P1-P5 efímeras `*.probe.test.ts` con salida a `.txt`, greps de determinismo, exports huérfanos —`FriendlyKind`/
`FriendlyState` de mode.ts siguen sin consumidor→ borrar o marcar—, lista QA de 20 puntos para Paco + añadidos del
revisor de 9-7, «Rulings I made» en el mensaje final) → (6) QA de Paco en su :3000 con los 4 modos. Paso 10 después.



**Repo:** `/Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault` · rama `main`.
**HEAD al escribir:** `0e553af` (paso 8). **Sin commitear (solo docs, Paco commitea):** `specs/31-vault-world-cup.md`
(+QA 09-sep, +G9-1..G9-9, +v1.5 teclado alternativo y esquemas de formación), `docs/superpowers/plans/2026-09-09-vault-world-cup-step-9.md`
(NUEVO, 5 513 líneas), este handoff, y `git rm` de los tres `CHECKPOINT-*.md`. Ningún fichero de código tocado.
**Suite real:** 1050 tests en 62 ficheros (verificada 09-sep) · `tsc`/eslint limpios · `npm run build` exit 0.

## -2. Paso 9 · 09-sep: QA del paso 8 + grill + plan + pre-vuelo (NO se ha ejecutado nada)

1. **QA del paso 8 jugado por Paco: 9/10.** Cuatro ajustes en el spec (bullet «Primer QA jugado del paso 8»): modo
   ENTRENAMIENTO (→ G9-1, entra en la v1), dibujo del jugador cenital (cabeza+hombros) y portero que se estira al parar
   (→ ola de ajustes del paso 11), teclado J/K/L NO se cambia. Para la v1.5: selector de teclado (clásico Q/A/O/P +
   Z/X/C) y esquemas visuales de cada formación.
2. **Grill corto cerrado: G9-1..G9-9 en el spec** (§Decisiones, último bullet). Resumen: entrenamiento por vía barata
   (`rules {timed:false, frozenTeam}` en el motor, un solo humano, sin variante a dos) · amistoso a dos en el MISMO
   teclado: J1 = WASD + C/V/B + 1-3/4-6, J2 = flechas + J/K/L + 7-9/0'¡ · cruces de la CPU simulados de verdad con
   VER (x4, A salta) / SALTAR · rival sorteado, Mundial 7 de 15 · selector de formación en la pantalla de selección
   (3-3-2 por defecto) · dificultad fija 5 / 4-6-8 · semilla de run única → derivadas · abandono por viewport en el
   Mundial = ELIMINADO con puntos hasta ahí · flujo dentro del componente, máquina de fases pura `flow.ts`.
3. **Plan escrito:** `docs/superpowers/plans/2026-09-09-vault-world-cup-step-9.md` (Tasks 9-1 motor `rules` · 9-2 dos
   teclados + `SPECTATE_SPEED` · 9-3 `football-logic/world-cup.ts` + `football-screen/match-run.ts` · 9-4
   `football-logic/mode.ts` · 9-5 `flow.ts` + `flow-layout.ts` · 9-6 `particles.ts` + SFX `chants_victory`/`stop` ·
   9-7 integración `VaultWorldCupGame.tsx` + play-page · Cierre con sondas P1-P5 y 20 puntos de QA). Previsión 1157
   tests. Brief de diseño y **pre-vuelo** (12 hallazgos H1-H12 YA APLICADOS al plan; veredicto LISTO CON RESERVAS) en
   `.superpowers/sdd/2026-09-09-vault-world-cup-step-9/` (`design-brief.md`, `preflight.md`).
4. **Reservas del pre-vuelo = supuestos de producto S-FL1/2/3/5/8/9 + «0-0 en tanda = portería a cero para ambos»:**
   **Paco dio OK a todos el 09-sep** (lista abajo). El plan se ejecuta tal cual.
5. **Siguiente sesión:** `/retomar` con este documento → `superpowers:subagent-driven-development`
   tarea a tarea (9-1 → 9-7) con revisión por tarea + revisión final con sondas; ledger en la carpeta SDD de arriba
   (`progress.md`, briefs, reviews, snapshots `.txt`). Commits SOLO Paco (el plan propone el mensaje por tarea). Si el
   día se complica, lo diferible es el MODO entrenamiento (lista cerrada de 5 puntos al inicio de la Task 9-5), NO la
   Task 9-1. Calendario flexible (Paco, 09-sep): el paso 9 puede llevar dos días.

### Decisiones S-FL — TODAS CONFIRMADAS por Paco el 09-sep (OK a las recomendaciones; no relitigar)
- S-FL1 saque tras gol en entrenamiento: automático de la estatua a los 5 s (cero código) vs «saca el humano» (M13).
- S-FL2 las estatuas no retienen balones sueltos; el portero sí.
- S-FL3 con pantalla de victoria propia no hay rótulo GANADOR (FINAL 3 s → pantalla → cánticos).
- S-FL5 cruce VER interrumpido por el viewport se termina headless; tras el guard hay vuelta a los menús.
- S-FL8 el lado del humano en su cruce se sortea → a veces saca segundo en la tanda (S-PK3).
- S-FL9 menús con la tabla SOLO; cuadro por ronda con línea «ELIMINADOS: …» en vez de 8 filas fijas.
- 0-0 resuelto en penaltis = portería a cero para los dos (2 000 puntos).


## -1. Paso 8 (07-sep, misma sesión que la B2, autorizado por Paco)

`components/games/football-screen/` (loop, keyboard, camera, minimap, hud, captions, sfx-map, match-loop,
viewport-guard; todos puros con test), `lib/sfx-vault-world-cup.ts`, `components/games/VaultWorldCupGame.tsx`
(970 líneas, amistoso contra la CPU) y la página provisional `app/games/vault-world-cup/play/page.tsx`.
Rulings R32-R36 en el ledger (teclas J/K/L + 1-6 + P/R; cursor al portero con aviso; FINAL + GANADOR/ELIMINADO;
**barra de carga de 3 casillas**; viewport md = 768×560; M9). Mp3 renombrados a slugs ASCII (git mv). Selecciones
v1.5 anotadas (las 16 + Colombia, Corea del Sur, Noruega, Egipto). **QA de Paco pendiente**: lista de 25 puntos
en castellano en `final-review-report.md` §7 (60 fps, cámara, casillas de carga, rótulos, prórroga/tanda,
viewport, audio). Sondas: 40 partidos por la tubería de pantalla a 60/144 Hz sin errores.

**Siguiente = paso 9** (`mode.ts`, `world-cup.ts`, selector de modo y de selección, segundo teclado del
amistoso a dos, sorteo y cuadro del Mundial, pantallas de victoria): plan con writing-plans leyendo
`final-review-report.md` §8 del paso 8 (recomendaciones: `winnerOf` puede ser -1 en un partido 'over' → el
cuadro lo trata como vivo; atribución del lanzador anterior; `chants-victory` en fuegos artificiales) y el
patrón `fighter-logic/mode.ts`/`tournament.ts`. Slug del juego (`vault-futbol`) a fijar en el paso 10.

## 0. Etapa B2 (misma tarde, autorizada por Paco tras el commit de la B)

Decisiones de Paco del 06-sep (en el spec): **prórroga de una parte de 60 s con gol de oro y tope; sin gol,
tanda de cinco penaltis y muerte súbita "el primero que falla pierde"** (v1, motor); **mapa de audio
definitivo** (tabla fichero → uso → disparador en §Etapa D; silbatos: inicio de parte / final de parte /
faltas y penaltis; ambiente 2-3 veces por parte sorteado con rng propio; larguero reservado; entrada al suelo
sin fichero → pendiente síntesis o silencio); nombres inventados + dorsales → v1.5. Carátula: Paco la puso
como `public/covers/vault-futbol.png` (el spec decía `vault-world-cup.png`; los mp3 también llevan prefijo
`vault-futbol` → fijar el slug del juego en la etapa D).

Ejecutado con SDD (Tasks 7b-1 y 7b-2, revisiones limpias, una ronda de etiquetas) + revisión final con 9
sondas (40 partidos completos: 12 prórroga, 3 tanda, 1 muerte súbita, 0 sin ganador; 200 tandas forzadas,
máx 17 lanzamientos; determinismo 10/10). Ledger: `.superpowers/sdd/2026-09-06-vault-world-cup-stage-b2/`
(rulings R29-R31, supuestos S-PK1..S-PK12 etiquetados en código, `final-review-report.md` con el **mapa de
lectura para el HUD** de prórroga y tanda y 8 ítems QA nuevos). Ruling R18 (reloj parado en la parte 3)
SUSTITUIDO: el reloj corre hasta `EXTRA_TIME_STEPS`. **Lo que existe ahora:** `'shootout'` en la máquina de
fases, `ShootoutState`, `winnerOf(match)` como único lector del ganador (la tanda NO toca `match.score`),
`placeAroundCentreSpot`, `beginShootoutKick`, `AiState.penaltyKickIndex`.

**Para la etapa C, además de lo de la B:** el HUD recorta el reloj con `min(halfStep, EXTRA_TIME_STEPS)` (el
tope se difiere hasta 301 pasos si vence en una cuenta atrás); en la resolución de una atajada
`shootout.takerId` ya apunta al siguiente lanzador → atribuir con el anterior; `abandon()` desde `'shootout'`
deja `winnerOf = -1` (Task 9 lo tiene que tratar); cámara alternando porterías en la tanda (S-PK8); los 15
aparcados en el círculo central.

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

1. **Paco juega el QA** del paso 8 (`final-review-report.md` §7, 25 puntos) en su :3000 y apunta los números.
2. **`retomar` con este documento.** Comprobar árbol limpio y 1050 verdes.
3. **Paso 9 (modos y flujo).** Plan con `writing-plans` leyendo OBLIGATORIAMENTE el `final-review-report.md` §8 del paso 8 y además
   los DOS `final-review-report.md` (etapa B §8 "Recomendaciones para la etapa C" y etapa B2 §8 "mapa de
   lectura del HUD") (6 puntos: `abandon()` para el gol de oro
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
