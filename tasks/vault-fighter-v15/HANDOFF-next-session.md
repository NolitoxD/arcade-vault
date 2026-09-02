# HANDOFF — VAULT FIGHTER v1.5 (modo torneo) · escrito 2026-09-01

**Repo:** `/Users/paco.monleon/Dev-Web/curso-claude-code/arcade-vault` · rama `main`.
**Suite:** 404 tests en 36 ficheros verdes · `npx tsc --noEmit` limpio · `npm run build` verde.
**Commiteado:** `c4bddf5` (el juego entero) y `b293bdb` (paleta de TORRE). Working tree limpio.

---

## 1. Qué se cerró ayer

VAULT FIGHTER, juego nº13 y segunda entrada FIGHTING, **v1 completa y jugada**. Las 11 tareas
del plan, cada una con su revisión y sus rondas de arreglo, más una revisión final de toda la
rama. La suite pasó de 222 a 404 tests.

El motor vive entero en `components/games/fighter-logic/` como funciones puras:
`fighters.ts` (roster + consultas), `roster-invariants.ts` (la red), `techniques.ts` (las 8
técnicas), `combat.ts` (vida, asaltos, barra de magia, **y el embudo único de daño**),
`ai.ts` (perfil derivado del luchador), `magic.ts` (las 4 mecánicas), `stages.ts` (los 8
fondos), `story.ts` (modo historia). `VaultFighterGame.tsx` es sólo la cáscara de canvas.

---

## 2. Lo que toca: el modo torneo

**El torneo se sacó de la v1 en el grill de diseño**, no por falta de tiempo: comparte el 100 %
del motor, es lo más barato de añadir después, y sacarlo adelantó el QA de equilibrio, que era
el riesgo alto del juego. Ese QA ya está hecho.

**Regla de arquitectura, decidida y no relitigable:** el torneo es **su propio módulo sobre el
mismo `combat.ts`**. `story.ts` es del modo historia y no se toca ni se generaliza. No hay
ganchos a medias que aprovechar — se dejó explícitamente sin ellos.

Lo que sí hay que hacer, y no existe hoy: **la fase `select` elige luchador y nada más**. En la
v1 no hay selector de modo porque un menú de un solo modo sería un menú muerto. El torneo
necesita esa pantalla previa, delante de la de elegir luchador.

---

## 3. Lo que el motor ya te da gratis

- `createBout` / `startBout` / `startRound` / `roundWinner` / `commitRound` / `boutWinner`:
  el combate al mejor de 5 entero, con el flag `roundResolved` que impide contar dos veces el
  mismo asalto desde el bucle de render.
- `profileFor(def, difficulty)`: el perfil de la IA se deriva del luchador y de un número de
  dificultad de 1 a 8. El torneo puede alimentar ese número como quiera.
- `MIN_GAP` y `HIT_STUN_MS` exportados desde `combat.ts`, **con invariantes que recorren las 8
  técnicas × los 9 luchadores**. Si tocas alcances o tiempos, esos tests te avisan.
- `applyDamage` es el **embudo único**: absorbe el escudo, aplica suelo de vida y carga las dos
  barras de magia. Cualquier fuente de daño nueva debe pasar por ahí y sólo por ahí.
- `MAGIC_SPECS`: las 9 magias son 9 tablas de números sobre 4 mecánicas. Añadir una magia es
  una fila, no un subsistema.

---

## 4. Trampas de este juego, aprendidas a base de tropezar

- **La trampa nº1 es el estado de módulo.** Toda función recibe el roster, el `FighterDef`, el
  `BoutState` o los escenarios **por parámetro**. Ninguna lee `ROSTER` ni `MAGIC_SPECS` por su
  cuenta. Mientras los datos se parecen, ese fallo es invisible.
- **Los tests que pasan por coincidencia del fixture.** Aparecieron tres: un daño sostenido
  probado con un paso de tiempo igual a su intervalo (se disparaba cada frame en el juego
  real), un proyectil probado a distancia exactamente cero (el radio no lo comprobaba nadie), y
  las técnicas que no llegaban porque el alcance mínimo era menor que la separación mínima.
  **Al escribir un test, pregúntate si pasaría con otros números en el fixture.**
- **Los huecos entre capas no los ve ninguna revisión de tarea.** `absorbWithShield` existió
  durante seis tareas sin que la llamara nadie: MURO no hacía nada y los 389 tests estaban en
  verde. Al terminar, **recorre lo exportado y comprueba que todo tiene consumidor real**.
- **Las máquinas de estado necesitan guarda en TODAS las transiciones.** En `story.ts` cinco
  funciones la tenían y dos no: un doble disparo de evento descoronaba al campeón.
- **Verifica lo que afirman los subagentes.** Uno reportó que 12 arreglos venían de un commit
  `852f788` que no existía. El trabajo era real; el relato, no.

---

## 5. Operativa

- **Commits: sólo Paco.** Las tareas dejan el working tree verificado y proponen el mensaje.
- **Nunca arrancar `next dev`**: el suyo vive en :3000.
- **El Browser pane oculto congela `requestAnimationFrame`** → el QA de gameplay es humano.
  Además la play-page pide sesión, así que un agente no puede abrirla.
- **Migraciones por MCP** (proyecto `hppzpkurlwqwzmigiuzq`), comprobando antes con
  `list_migrations` y versionando el fichero con la versión exacta que devuelva el servidor.
- **Ojo con el directorio del shell**: un `npm` lanzado desde `~/Dev-Web` creó allí un
  `package-lock.json` huérfano, Next tomó los 14 GB del directorio padre como raíz del
  workspace y el dev server se quedó colgado compilando. Si vuelve a pasar, mira ese lockfile.

---

## 6. Pendiente de la v1, todo menor y decisión de Paco

- **El escudo de MURO absorbe el daño pero no evita el aturdimiento**: comes 0 pero te frenas
  igual. Una línea (usar el retorno de `dealDamage` en vez de `hitOut.result`).
- **A 360 px de ancho los tres botones del mando se comprimen ~2 px.** Bajar la separación de
  8 a 5 lo cierra.
- **Fondos `cartuchos` y `azotea`** comparten un `ground` casi idéntico; las siluetas
  (rejilla vs agujas) compensan, pero es el par más próximo.
- **`stageForBout`** acota contra la constante de 8 y no contra la longitud del array recibido.
- **El invariante del aturdimiento es más débil de lo que promete**: compara contra el mínimo de
  `startup + recovery` por técnica, cuando la propiedad real es
  `min(recovery(t1)) + min(startup(t2))`. Hoy coinciden por casualidad de las tablas.
- **Sin verificar en QA:** el teletransporte de GLITCH (magia SALTO DE FASE) y el mando en móvil.

---

## 7. Registro completo

`.superpowers/sdd/2026-09-01-vault-fighter/progress.md` — el ledger, con las **23 decisiones**
que se tomaron por Paco durante la ejecución, cada una con su razón y su coste si es errónea.
No borrar hasta que lo haya leído.

---

## ACTUALIZACIÓN 2026-09-01 (cierre del día)

**Spec 30 escrito, aprobado y grillado**: `specs/30-vault-fighter-tournament.md`. 7 pasos, 19
criterios de aceptación. El grill sacó tres cosas que no estaban: que el cuadro no se veía (se
añadió la pantalla de cuadro como paso 6), que la dificultad 1..4 habría hecho el torneo MÁS
FÁCIL que la historia (ahora 3-5-7-8), y que el sorteo "ponderado" daba un 53% al favorito
porque los rangos solo se separan un 11% (ahora SPREAD=3 sobre el rango normalizado).

**Pasos 1, 2 y 3 HECHOS y revisados limpios.** `components/games/fighter-logic/tournament.ts`
completo: cuadro de 8, sorteo ponderado, tres escenarios + núcleo, dificultad 3-5-7-8 y
puntuación con techo 84.000 verificado contra el de la historia. 452 tests en 37 ficheros
verdes. `story.ts` y el motor con diff vacío.

**MAÑANA: pasos 4 al 7**, todos en el componente, y ahí está el riesgo real del spec:
- **4.** `mode.ts` con la unión discriminada, y el componente dejando de hablar con `story.ts`.
  Aquí se borra el ternario muerto del jefe (`VaultFighterGame.tsx:933`) y `onBoutChange` pasa
  de número a etiqueta. **Sin cambiar ni un comportamiento** — la historia tiene que seguir
  jugándose igual, y ningún test lo cubre.
- **5.** Selector de modo, torneo enchufado, y volver a jugar devolviendo al selector.
- **6.** La pantalla de cuadro, al inicio de cada combate, con botón CONTINUAR.
- **7.** Registro, textos, `verify-plan` y QA humano.

**Ojo con la firma**: `winBout(roster, t, rng)` — el roster va primero, como en todo el módulo.
`modeWinBout` heredará esa necesidad al delegar.

**El ledger del torneo** está en `.superpowers/sdd/2026-09-01-tournament/progress.md`.
