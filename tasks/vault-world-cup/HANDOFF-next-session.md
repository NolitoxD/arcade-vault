# HANDOFF — VAULT WORLD CUP · etapa A cerrada · escrito 2026-09-04

**Repo:** `/Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault` · rama `main`.
**Último commit:** `bfafcaa` (spec 31 + handoff del 03-sep). **Sin commitear al escribir esto:**
los 26 ficheros de `components/games/football-logic/`, `specs/31-vault-world-cup.md` (modificado),
`docs/superpowers/plans/2026-09-04-vault-world-cup-engine.md` y este handoff — los commitea Paco.
**Suite real:** 760 tests en 51 ficheros verdes (504 de partida + 256 del motor) · `npx tsc --noEmit`
limpio · `npm run build` verde · grep de determinismo vacío en toda la carpeta, tests incluidos.

---

## 1. Dónde estamos

**04-sep, en una sesión:** grill del spec 31 (cerrado y volcado al spec), plan de la etapa A, y la
**etapa A entera (motor sin pantalla, Tasks 1-5) ejecutada y verificada** con
`subagent-driven-development`: cinco tareas, cada una con revisión + una ronda de arreglo +
re-revisión; revisión final de toda la etapa (cazó 2 Critical de integración que ningún test de
tarea podía ver) + una ola de arreglo + re-revisión limpia.

**Lo que existe:** `rng` (mulberry32), `pitch`, `teams` (SOLO España e Italia y SOLO la 3-3-2),
`invariants`, `geometry`, `clock`, `input`, `step` (paso fijo 60 Hz, `stepPhysics`), `players`,
`ball`, `actions` (chut con carga, pases asistidos por cono de 45°, robo, entrada al suelo,
controlado derivado con histéresis 40 u), `referee`, `set-pieces`, `match` (`MatchState`, máquina
de fases con guarda en las 7 transiciones, `stepMatch(match, inputs, rng)`).

**Lo que NO existe:** `ai.ts`, las otras 14 selecciones y 2 formaciones, `mode.ts`,
`world-cup.ts`, pantalla, registro, migración, música, carátula.

**Registro completo de la ejecución** (git-ignorado, NO borrar):
`.superpowers/sdd/2026-09-04-vault-world-cup-engine/progress.md` — 20 rulings R1-R20, 23 minors
diferidos con su triaje, `final-review-report.md` (466 líneas, con tablas de cobertura de criterios,
números del spec, exports sin consumidor, tests acoplados a la 3-3-2 y **recomendaciones para la
etapa B**), `final-fix-report.md` (mensajes de commit propuestos, uno global o cinco por tarea).

---

## 2. Próximos pasos, en orden

1. **`retomar` con este documento.** Comprobar con `git log`/`git status` si Paco commiteó la
   etapa A. Si no, recordárselo: los mensajes están en `final-fix-report.md` §"Mensaje de commit".
2. **Preguntar a Paco el "ajuste del plan"** que anunció el 04-sep ("cuando termines te digo un
   ajuste del plan"; confirmó que NO toca la etapa A). Puede afectar a B, C o D: preguntarlo ANTES
   de escribir el plan de la etapa B.
3. **Plan de la etapa B** con `writing-plans` (Tasks 6 y 7 del spec: `ai.ts` + contenido), leyendo
   OBLIGATORIAMENTE `final-review-report.md` §"Recommendations for stage B" y §"Tests coupled to
   the 3-3-2 geometry", y las líneas `CARRY TO Task 6/7` del ledger. Pre-vuelo con subagente como
   hoy. Luego `subagent-driven-development`. **Máximo la etapa B en el día.**
4. Deudas con dueño en la etapa B (del ledger): criterio 11 "responde en el acto" se cumple en
   la Task 6 (R19, verificar explícitamente al cerrarla); `scratch.events` ya es por jugador pero
   solo se juzga una falta por paso (gana equipo 0); robos simultáneos resuelven equipo 0 primero
   (criterio 14, QA); `isSprinting` da false en el último paso del sprint (umbral
   `STEAL_CHANCE_VS_SPRINT`); comentario obsoleto en `match.test.ts` ~510 ("nobody tackles").

---

## 3. Decisiones ya tomadas (no relitigar)

**Del grill (en el spec):** paso fijo sin `dtMs`; controlado derivado con histéresis 40 u (tras el
QA preguntar si en v1.5 pasa a manual); reglas de la IA con números y perfil 1-8 por fórmula
(`profileFor(teamDef, difficulty)`, la dificultad NO toca la velocidad); portero en su línea, sale
solo en el área pequeña, nunca fuera del área grande (invariante); selecciones idénticas en v1;
**solo puntúa el Mundial** (ningún amistoso, como el versus de Pong); Mundial perfecto ~70 000.

**De la ejecución (ledger, R1-R20), las que tocan el diseño:** `stepMatch` vive en `match.ts`
(R7); pases asistidos (R10); entrada = falta al tocar a cualquier rival y el que entra cae 1 s
(R11); penalti SOLO por falta en área propia del infractor (R14); `clearActionEvent` exportada y
las 18 casillas de eventos se limpian al inicio de cada paso (R16); `pickUp` no actúa fuera del
campo (R17); el reloj no avanza en `half === 3` (R18); grep de determinismo literal sobre toda la
carpeta, tests incluidos (R12); dos números añadidos al spec por revisar en QA: robo vs sprint
35 % y `vz` del chut 200 (R6).

**Pendientes para el spike v1.5** (sección propia en el spec): cambio manual de controlado,
atributos por selección (defensa/ataque/contraataque/chute/pase) y por jugador.

---

## 4. Reglas de Paco (no negociables)

- Máximo UNA etapa al día; la calidad manda sobre el calendario.
- Commits SOLO Paco. Las tareas dejan el working tree verificado y proponen el mensaje.
- Spec profundo + grill; **durante la implementación, si surge una duda de diseño, parar y hacer
  un grill corto en vez de decidir en silencio** (Paco lo pidió explícitamente el 04-sep).
- Música: Paco deja `public/vault-world-cup-theme-{1,2,3}.mp3` (etapa D). Carátula la hace Claude
  con `design`, PNG 800×800, Paco la pone en `public/covers/vault-world-cup.png`.

---

## 5. Trampas de hoy (además de las heredadas de Vault Fighter, en el handoff del 03-sep)

- **Vitest ejecuta cualquier `*.test.ts` bajo `.superpowers/`**: los snapshots del SDD van al
  scratchpad, NUNCA dentro del repo (inflaron la cuenta 666→809 hasta que se detectó).
- **Los revisores de tarea no ven la integración**: los dos Critical (falta re-juzgada tras el
  saque, balón recogido fuera del campo) solo aparecieron en la revisión final con sondas
  ejecutables. Para la etapa B: revisión final con sondas, no solo lectura.
- **El test integrador insignia tiene que ejercitar todas las cadenas**: la policy del partido
  grabado no hacía entradas y por eso C1 pasó. Ahora sí (una entrada por `TACKLE_STEPS`).
- **Las cuentas de suite de los subagentes hay que re-correrlas** (varias venían infladas).
- El editor muestra "Cannot find module" caducados; solo vale `npx tsc --noEmit`.
- Un `ToolSearch` de `SendMessage` no existe en este harness: las rondas de arreglo van con
  implementador fresco + brief + informe (funcionó igual).

---

## 6. Operativa (sin cambios)

Nunca `next dev` (Paco lo tiene en :3000). Migraciones por MCP con `list_migrations` antes y
autorización explícita. QA de gameplay siempre humano. Skills: `retomar`, `grill-me`,
`superpowers:writing-plans`, `superpowers:subagent-driven-development`, `verify-plan`.
