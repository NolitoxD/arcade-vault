# HANDOFF — VAULT WORLD CUP (arcade-vault) · escrito 2026-09-03

**Repo:** `/Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault` · rama `main`.
**Suite:** 504 tests en 38 ficheros verdes · `npx tsc --noEmit` limpio · `npm run build` verde.
**Último commit:** `a525fb0` (Vault Fighter v1.5 completo). **Sin commitear:** `specs/31-vault-world-cup.md`
y este handoff — los commitea Paco.

---

## 1. Dónde estamos

**Hoy (03-sep) se escribió el spec 31 entero con Paco, sección a sección, y lo ha aprobado.**
`specs/31-vault-world-cup.md` — estado `Approved`, **grill PENDIENTE**. Es el spec más grande del
proyecto: 22 criterios de aceptación, 22 decisiones, 7 riesgos, 11 pasos en 4 etapas.

**El juego:** VAULT WORLD CUP, id `vault-world-cup`, nº14, segunda entrada SPORTS. Fútbol cenital de
selecciones, 9 contra 9, cámara que sigue al balón + minimapa, balón pegado al pie, tres botones con
pulsar/mantener, alineación y estrategia cambiables en juego, faltas y penaltis, saques automáticos
con dirección. Dos modos: amistoso (vs CPU o 2 en el mismo teclado) y Mundial de 8 por eliminatoria.

**Lo que NO se ha hecho todavía:** ni una línea de código. El motor `components/games/football-logic/`
no existe.

---

## 2. Próximos pasos, en orden

1. **`retomar` con este documento** y leer `specs/31-vault-world-cup.md` ENTERO.
2. **`grill-me` sobre el spec 31**, antes de cualquier código. Con Vault Fighter el grill sacó el
   torneo de la v1 y cazó luchadores que eran *peores* en vez de *distintos*; con el torneo sacó que
   el cuadro no se veía y que la dificultad hacía el modo más fácil en vez de más duro. Aquí hay
   tres cosas que apretar:
   - **La IA de la etapa B** está descrita en un párrafo y es la factura del juego entero. Cómo decide
     la CPU pasar frente a chutar, cómo se colocan los compañeros sin balón, qué hace el portero —
     merece números antes de codificarse.
   - **El determinismo**: qué cuenta exactamente como "entrada" para que dos ordenadores reproduzcan
     un partido. El `TeamInput` por frame, sí — pero el cambio automático de jugador controlado,
     ¿es entrada o estado derivado? Si es derivado, tiene que ser determinista también.
   - **La puntuación**: los ~80 000 del Mundial perfecto son estimación, no cuenta; y el amistoso a
     dos —¿puntúa alguien?— no está decidido.
3. **Actualizar el spec con lo que salga del grill** (como se hizo con el 30) y **arrancar la
   etapa A**: el motor sin pantalla. Ejecutar con `superpowers:subagent-driven-development`, paso a
   paso, cada uno con su revisión — es lo que funcionó dos veces.

---

## 3. Reglas de esta ejecución (de Paco, no negociables)

- **Máximo UNA etapa al día.** Si una necesita dos días, se le dan; al terminarla se PARA aunque
  sobre tarde. Cuatro etapas = cuatro días mínimo.
- **La calidad manda sobre el calendario.** Textual: "mejor una v1 rejugable en ocho días que una
  floja en cuatro". Las etapas se cierran cuando están bien.
- **Commits: SOLO Paco.** Las tareas dejan el working tree verificado y proponen el mensaje.
- **La carátula la hace Claude** con `design` (PNG 800×800, Paco lo coloca en `public/covers/`).
  **La música la trae Paco: 3 pistas MP3**, sorteadas por partido (patrón de Vault Fighter: sorteo
  DENTRO del efecto, nunca en render). Público, silbato y gol por síntesis WebAudio.

---

## 4. Las cuatro etapas (del spec, sección "Plan de implementación")

| Etapa | Pasos | Qué es |
|---|---|---|
| **A — motor sin pantalla** | 1-5 | rng con semilla, campo, teams, invariantes (la red PRIMERO); input/players/ball con el test de determinismo; actions; referee + set-pieces; match |
| **B — IA y contenido** | 6-7 | ai.ts (colocación, persecución, portero, decisión CPU, perfil 1-8); las 16 selecciones y 3 formaciones con la red ya en verde |
| **C — pantalla** | 8-9 | VaultWorldCupGame.tsx con cámara, minimapa, HUD, saques dibujados (un amistoso vs CPU hard-coded); luego mode.ts, world-cup.ts, selectores, cuadro, pantallas de victoria |
| **D — cierre** | 10-11 | registro, migración, play-page, música, carátula; verify-plan + QA humano |

---

## 5. Decisiones de arquitectura que gobiernan el motor

- **Entradas simétricas**: `stepMatch(match, [inputA, inputB], dtMs, rng)`. El motor NO sabe cuál
  es humano. Es la puerta del online (punto 3 del roadmap) — se deja abierta, NO se construye.
- **Azar con semilla**: `createRng(seed)` es el ÚNICO origen de aleatoriedad. Ni `Math.random` ni
  `Date.now()` ni orden de `Set` dentro de `football-logic/`. Test de misma semilla + mismas
  entradas = mismo estado, sobre un partido LARGO.
- **Nada de estado de módulo**: campo, selecciones, formaciones, estado y rng, todo por parámetro.
- **El motor se llama `football-logic`** (no `world-cup-logic`): lo reutilizará la variante Kick Off.
- **Jugadores idénticos con `id` propio** en la v1; atributos + resistencia + cambios van juntos a la
  v1.5 (sin atributos un cambio no significa nada).
- **Formaciones y estrategias como datos** con invariante (suman 8, ninguna posición fuera del campo).

---

## 6. Trampas heredadas de Vault Fighter (lo que costó caro)

- **La red de invariantes ANTES que el contenido.** Funcionó dos veces: los datos pasaron a la primera.
- **Tests que pasan por coincidencia del fixture** — apareció TRES veces: un intervalo igual al paso
  de simulación, un impacto a distancia exactamente cero, un alcance menor que la separación mínima.
  En un motor con física será peor. Regla: ¿pasaría este test con otros números?
- **Huecos entre capas**: `absorbWithShield` existió seis tareas sin consumidor y una magia entera
  no hacía nada con 389 tests verdes. Al cerrar cada etapa: recorrer lo exportado, todo con consumidor.
- **Guarda de precondición en TODAS las transiciones** de estado, no en casi todas.
- **El auto-repeat del teclado** se saltaba una pantalla entera que "esperaba pulsación". Los
  botones necesitan `e.repeat` acotado a las fases de menú (NO global: machacar en juego es válido).
- **Verificar lo que afirman los subagentes.** Uno reportó arreglos venidos de un commit inexistente.

---

## 7. Operativa

- **Nunca arrancar `next dev`**: el de Paco vive en :3000.
- **El Browser pane oculto congela `requestAnimationFrame`** y la play-page pide sesión → el QA de
  gameplay es SIEMPRE humano.
- **Migraciones por MCP** (proyecto `hppzpkurlwqwzmigiuzq`): `list_migrations` antes, versionar el
  fichero con la versión exacta que devuelva el servidor. Autorización explícita de Paco para aplicar.
- **Ojo con el cwd del shell**: un `npm` desde `~/Dev-Web` creó un `package-lock.json` huérfano
  allí y Next tomó 14 GB como raíz del workspace → dev server colgado. Si pasa, mirar ese lockfile.
- **Los avisos del editor llegan caducados**: confirmar con `npx tsc --noEmit` y `npm test`.

---

## 8. Roadmap y contexto

Roadmap definitivo (02-sep): **1) este fútbol** → 2) multijugador simultáneo por puntos → 3) online
1v1 en ordenadores distintos (aplica a fútbol, lucha y torneos con plazas humanas; hará falta una
2ª cuenta Google para el QA) → 4) producción (Supabase actual = test; uno nuevo de prod desde las
18 migraciones, sin datos; Vercel Production→prod, Preview/Dev→test; OAuth de prod SOLO Google).

**Idea futura de Paco** (después de producción): variante a lo **Kick Off** sobre este motor —
muñecos más pequeños, campo más vertical, balón LIBRE, chut con efecto. Era fanático. No se olvide.

**Ledgers de Vault Fighter** (git-ignorados, con las decisiones tomadas por Paco):
`.superpowers/sdd/2026-09-01-vault-fighter/progress.md` y `.superpowers/sdd/2026-09-01-tournament/progress.md`.
