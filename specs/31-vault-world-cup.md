# SPEC 31 — VAULT WORLD CUP

> **Estado:** Approved (leído por Paco, 2026-09-03; grill hecho 2026-09-04, decisiones incorporadas)
> **Depende de:** 29-vault-fighter (patrón de motor puro y capa de modo), 30-vault-fighter-tournament
> (cuadro de eliminatoria y su pantalla, como referencia), 15-pong (primer SPORTS, con 2 jugadores
> en local), 24-games-registry-credits-f2, 10 (mando táctil, tercer botón C), 12 (patrones de
> performance)
> **Fecha:** 2026-09-03
> **Objetivo:** Juego nº14 con id `vault-world-cup`, segunda entrada de la categoría SPORTS:
> **fútbol cenital de selecciones, nueve contra nueve**, con cámara que sigue al balón y minimapa,
> balón pegado al pie, tres botones (chut o entrada · pase corto/largo o robo · sprint), alineación
> y estrategia cambiables en pleno partido, faltas y penaltis con saques automáticos dirigidos, en
> **dos modos** —amistoso contra la CPU o entre dos en el mismo teclado, y **Mundial de 8
> selecciones por eliminatoria directa**— con toda la lógica del partido en un módulo puro de
> **entradas simétricas y azar con semilla**, pensado para estrenar el online más adelante sin
> escribir hoy nada de red.

---

## Alcance

**Dentro:**

- **Motor puro en `components/games/football-logic/`**, con nombre de motor y no de juego a
  propósito: es el que reutilizaría la variante a lo Kick Off. Campo, balón, jugadores,
  formaciones, IA, partido, saques, faltas y Mundial, todo como funciones puras con **las dos
  entradas como parámetros simétricos** y **azar con semilla**.
- **Campo grande con cámara que sigue al balón**, y **minimapa** con los dieciocho en una esquina.
- **Nueve por equipo**: ocho de campo más portero, que siempre es IA.
- **Control del más cercano al balón**, cambiando solo. **Balón pegado al pie**, robable.
- **Tres alineaciones** (3-3-2 normal, 3-2-3 ofensiva, 4-3-1 defensiva) y **tres estrategias**
  (ataque, neutral, defensa), **cambiables en pleno partido**. Tamaño de equipo y formaciones como
  datos, con invariante.
- **Tres botones con pulsar/mantener**: A chut (mantener = más fuerte) o entrada al suelo; B pase
  corto al pulsar, largo al mantener, o robo de pie; C sprint en **ráfaga con recuperación**, con y
  sin balón.
- **Dos entradas defensivas**: al suelo (roba si llega al balón; si toca al jugador es falta; si no
  llega a nada, un segundo en el suelo) y de pie, a corta distancia.
- **Faltas y penaltis.** Falta fuera del área = tiro libre; dentro = penalti con el lanzador
  eligiendo lado y el portero tirándose. **Sin tarjetas y sin fuera de juego.**
- **Saques automáticos con dirección**: saque inicial, banda, córner, puerta, falta y penalti. El
  jugador elige con la cruceta, cuenta atrás grande de cinco segundos, y sale solo.
- **Dos partes de 90 segundos** (constante, techo 120) y **gol de oro** en el empate.
- **IA rival**: colocación por formación y estrategia, persecución del balón, portero, y cambio de
  estrategia según el marcador.
- **Dos modos**: **Amistoso** (un partido: contra la CPU, o **dos jugadores en el mismo teclado**)
  y **Mundial** (8 selecciones sorteadas de un banco mayor, eliminatoria directa, eliminado sin
  CONTINUE, con pantalla de cuadro). El Mundial es siempre contra la CPU.
- **Banco de selecciones** de dieciséis, iguales en el campo, distintas en nombre y colores de
  equipación.
- Selector de modo, selector de selección, HUD con marcador, tiempo y parte.
- **Pantalla de CAMPEONES DEL MUNDO** al ganar la final y **de GANADOR** al ganar un amistoso:
  composición fija pintada en canvas con la equipación y el nombre de la selección ganadora
  levantando la copa; lo único en movimiento es el confeti (amistoso) o los fuegos artificiales
  (Mundial). Corta, y CONTINUAR devuelve al selector de modo. **ELIMINADO** y la derrota del
  amistoso son rótulos sobre la pantalla del partido, sin pantalla propia.
- **SFX procedurales** (silbato, público, gol, golpeo) y **tres pistas de música** sorteadas por
  partido.
- Registro, migración, play-page, carátula (la hace Claude con `design`) y puntuación en la tabla
  de `vault-world-cup`.

**Fuera, y por qué:**

- **Nada de red ni online.** Es el punto 3 del roadmap. Aquí solo se deja la simulación
  determinista.
- **Atributos por jugador o posición, resistencia real y cambios de banquillo → v1.5**, todo junto:
  sin atributos un cambio no significa nada, y sin resistencia el sprint es velocidad gratis (de
  ahí la ráfaga provisional).
- **Tarjetas → v1.5**, si al jugar se ve que las faltas sin castigo molestan.
- **Octavos de final → v1.5** si el Mundial de 8 queda corto; **nunca más de 16**.
- **Fase de grupos, prórroga y tanda de penaltis como desempate**: no. Eliminatoria directa y gol
  de oro.
- **Diferencias entre selecciones más allá del nombre y los colores → v1.5**, con los atributos.
- **Clubes → v2**, si llega.
- **La variante a lo Kick Off** (balón libre, chut con efecto) → después de producción, sobre este
  motor.
- **Persistencia del Mundial al recargar**: se pierde, como en los otros trece.
- **Skins retro y neon, y el port a móvil**: la cadena posterior de siempre (`skin-designer`,
  `mobile-porter`), no este spec.

---

## Modelo de datos

Todo el motor en `components/games/football-logic/`. **Ninguna función lee estado de módulo**:
el campo, las selecciones, las formaciones, el estado del partido y la fuente de azar llegan
siempre por parámetro. Las funciones del bucle escriben en el estado que reciben, sin asignar.

| Fichero | Responsabilidad |
|---|---|
| `rng.ts` | `createRng(seed): () => number` — el azar con semilla. **Único origen de aleatoriedad del motor.** |
| `clock.ts` · `step.ts` | `STEP_MS = 1000 / 60`, `stepsFor`, `perStep` (en `clock.ts`, sin imports) y `stepPhysics` (movimiento + balón) en `step.ts`. `stepMatch` vive en `match.ts` (ruling R7 de la etapa A: ponerlo aquí formaría un ciclo ESM). |
| `geometry.ts` | `Vec2`, `dist`, `normalizeInto`, `clamp`, `INV_SQRT2` — sin trigonometría. |
| `pitch.ts` | Dimensiones del campo en coordenadas de mundo, áreas, porterías, punto de penalti. Constantes. |
| `teams.ts` | `TeamDef` (id, nombre, colores), el banco de selecciones, `FORMATIONS` y `STRATEGIES`. |
| `input.ts` | `TeamInput`, la entrada **simétrica** de un equipo. Quien la rellena —teclado 1, teclado 2 o CPU— es cosa del componente. |
| `players.ts` | `PlayerState`, creación de los nueve por formación, movimiento, sprint en ráfaga, el suelo tras la entrada. |
| `ball.ts` | `BallState`, física del balón con altura (para pases largos por encima), posesión pegada al pie. |
| `actions.ts` | Chut, pase corto, pase largo, robo de pie, entrada al suelo. Resuelven sobre el estado y devuelven el resultado en un out-param. |
| `ai.ts` | Colocación por formación y estrategia, persecución del balón, portero, y la decisión del equipo CPU (rellena un `TeamInput`). |
| `referee.ts` | Gol, balón fuera (banda, córner, puerta), falta y penalti. Devuelve **qué saque toca y dónde**. |
| `set-pieces.ts` | La fase de saque: tipo, posición, dirección elegida, cuenta atrás, ejecución automática. |
| `match.ts` | `MatchState`: reloj, partes, marcador, fase, gol de oro. **Y `stepMatch(match, inputs, rng)`**, el paso completo del partido (etapa A, ruling R7). |
| `world-cup.ts` | Sorteo de 8 del banco, cuadro, eliminación. Mismo patrón que `tournament.ts`, no el mismo código (aquél es de luchadores). |
| `invariants.ts` | La red: formaciones que suman ocho, banco sin ids ni colores repetidos, geometría del campo coherente. |
| `mode.ts` | Unión `'friendly' \| 'world-cup'`, igual que la de Vault Fighter. |

```ts
// input.ts — lo que hace SIMÉTRICO al motor: un equipo es un equipo, sea quien sea quien lo mueva.
// Un TeamInput es la entrada de UN PASO de simulación (no de un frame): el componente muestrea el
// teclado una vez por frame y repite el mismo TeamInput en todos los pasos de ese frame.
export type ButtonState = 'up' | 'pressed' | 'held' | 'released';
export type Strategy = 'attack' | 'neutral' | 'defend';
export type TeamInput = {
  dx: -1 | 0 | 1; dy: -1 | 0 | 1;
  a: ButtonState; b: ButtonState; c: ButtonState;
  formation: number;   // índice en FORMATIONS
  strategy: Strategy;
};

// players.ts
export type PlayerState = {
  id: number;           // propio, no "el defensa nº2": es lo que hará posibles los cambios en la v1.5
  team: 0 | 1;
  role: 'gk' | 'def' | 'mid' | 'fwd';
  x: number; y: number; vx: number; vy: number; facing: number;
  sprintMsLeft: number; sprintCooldownMs: number;   // la ráfaga y su recuperación
  downUntilMs: number;                              // en el suelo tras una entrada fallida
};

// ball.ts
export type BallState = {
  x: number; y: number; z: number;        // z = altura, para el pase largo por encima
  vx: number; vy: number; vz: number;
  owner: number | null;                   // id del jugador que lo lleva pegado al pie
};

// match.ts
export type MatchPhase = 'kickoff' | 'play' | 'set-piece' | 'goal' | 'half-time' | 'golden-goal' | 'over';
export type MatchState = {
  teams: [TeamDef, TeamDef];
  players: PlayerState[];                 // los 18, creados una vez
  ball: BallState;
  score: [number, number];
  half: 1 | 2 | 3;                        // 3 = gol de oro
  clockMs: number;
  phase: MatchPhase;
  setPiece: SetPieceState | null;
  stepCount: number;                      // reloj en pasos, no en ms reales: 90 s = 5 400 pasos
  controlled: [number, number];           // CACHÉ del controlado, derivado al final de cada paso (ver abajo)
};
```

**El controlado es estado derivado, no entrada** (grill 2026-09-04). Al final de cada `stepMatch` se
recalcula por equipo: si el equipo tiene el balón, el poseedor; si no, el jugador de campo (nunca el
portero) más cercano al balón, desempate por `id` más bajo (nunca por orden de iteración), y con
**histéresis de 40 unidades**: solo cambia si otro compañero está al menos 40 u más cerca que el
actual. Así el replay solo necesita semilla + secuencia de `TeamInput`.

**Paso fijo de simulación** (grill 2026-09-04): el motor expone `STEP_MS = 1000 / 60` y
`stepMatch(match, inputs, rng)` **sin `dtMs`**. Un `dtMs` variable rompería el determinismo entre
ordenadores (60 fps frente a 144 fps producen secuencias distintas). El componente lleva un
acumulador: suma el tiempo real del frame y llama a `stepMatch` tantas veces como pasos completos
quepan, con **tope de 5 pasos por frame** (una pestaña en segundo plano no dispara cien pasos al
volver). `pressed` y `released` duran un paso y el motor los consume en el primero.

El bucle del componente hace cada frame: rellenar los dos `TeamInput` (el humano desde el
teclado, la CPU desde `ai.ts`), y avanzar los pasos que toquen. **El motor no sabe cuál de los dos
es humano.** Esa única propiedad es la que deja abierta la puerta del online.

Dentro de `football-logic/` se evitan `Math.sin`, `Math.cos` y `Math.atan2` en la física (los
motores de JS no garantizan el mismo resultado bit a bit); vectores normalizados con `Math.sqrt`,
que sí es exacto por IEEE 754.

### Números de partida, ajustables en QA

Todos en constantes, ninguno enterrado en el código:

| | Valor de salida |
|---|---|
| Campo (unidades de mundo) | 2 000 × 1 300 — la proporción de un campo real; la cámara de 800 × 500 ve un 40 % |
| Velocidad de jugador | 180 u/s · con balón 160 · sprint ×1,4 |
| Sprint en ráfaga | 2 s de sprint, 3 s de recuperación |
| Pase corto / largo | 420 u/s raso · 560 u/s con altura, cae a ~350 u |
| Chut | 700 u/s al pulsar · hasta 950 manteniendo (1 s de carga) |
| Robo de pie | alcance 28 u, 65 % de éxito frente a un rival que no sprinta |
| Entrada al suelo | avance 90 u en 0,4 s · si falla, 1 s en el suelo |
| Partes | 2 × 90 s (techo 120) · cuenta atrás de saque 5 s |
| Portero | se mueve en su línea a 220 u/s, ataja lo que llega a menos de 40 u |
| Añadidos en la etapa A (no estaban en el spec; revisar en QA) | robo de pie frente a rival que SÍ sprinta 35 % · el chut cargado se eleva hasta `vz` 200 (ápex 22 u, nunca por encima del larguero solo) |


### Reglas de la IA (del grill del 2026-09-04)

Todo son números en constantes y fórmulas; ninguna rama por nivel. La IA solo recibe el **perfil**,
nunca la dificultad. Se aplican igual a los dos equipos: el humano mueve al controlado y sus ocho
compañeros obedecen estas reglas, lo que hace justo el amistoso a dos por construcción.

**La CPU con balón** — árbol de tres ramas, evaluado cada `reactionMs` (no cada paso):

1. **Chuta** si la distancia a la portería rival es < 420 u y hay línea: ningún rival a < 60 u de
   la recta balón→portería en sus primeras 200 u. Mantiene A proporcional a la distancia (a 420 u,
   carga completa; a 150 u, toque).
2. **Pasa** si hay presión (rival a < 90 u) y existe un compañero con carril libre (ningún rival a
   < 50 u de la recta del pase) más adelantado o más libre. Corto si está a < 350 u, largo si más.
   Con presión y sin carril, conduce hacia el lado contrario al rival más cercano.
3. **Conduce** hacia la portería en el resto, esquivando al rival más cercano; sprinta con 150 u de
   pista libre por delante.

Sin regates, paredes ni pases al hueco en la v1: sin atributos no se notan.

**Pases del humano asistidos** (ruling R10, etapa A): al pulsar B el pase corto va al compañero de
campo más cercano dentro de un cono de 45° alrededor de la cruceta (o del `facing` si está en
neutro); al mantener B el largo va al más lejano del mismo cono; sin compañero en el cono, el pase
sale recto. Sin error angular en el humano: el error es cosa del perfil de la CPU.

**Los compañeros sin balón** — "lo más parecido al fútbol real" (Paco):

1. **Ancla**: la posición de formación, desplazada ±12 % por la estrategia.
2. **Deriva hacia el balón**: el ancla se desplaza un 30 % de la distancia ancla→balón en el eje
   largo y un 20 % en el corto. El bloque acompaña el juego sin deshacer la formación.
3. **Separación**: dos compañeros a < 60 u se repelen.
4. **Persecución**: en el equipo sin posesión, solo el más cercano al balón lo persigue (es el
   controlado); el segundo cubre a 120 u entre el balón y su portería; el resto, a su ancla. **La
   estrategia fija cuántos persiguen**: ataque 3, neutral 2, defensa 1 y el resto repliega.
   Con posesión, los compañeros aplican solo 1-3: se ofrecen por posición, no corren al balón.

**El portero** — siempre IA, para los dos equipos:

1. Se mueve sobre una línea a 25 u de su portería siguiendo al balón en el eje corto, cerrando el
   ángulo balón→centro. **Sale solo dentro del área pequeña** a por balón suelto sin compañero más
   cerca, y vuelve al despejar. **Su posición se recorta al área grande por invariante**: nunca
   fuera, ni por física.
2. **Atajada**: balón a < 40 u lo ataja si `rng() < catchChance`; un chut cargado al máximo resta
   0,15. Si ataja, saque de puerta automático; si no, sigue la trayectoria.
3. **Penalti**: se tira a un lado con `rng`, ponderado hacia el lado del lanzador por
   `penaltyReadChance`. Si acierta el lado, ataja.
4. **Con balón**: saca en 2 s, pase largo al compañero más libre en campo propio; mientras, no se
   le puede robar.

**Perfil por dificultad (1-8)**, `profileFor(teamDef, difficulty)` — recibe la selección desde el
día uno aunque en la v1 no la use (v1.5: atributos), como `profileFor(def, difficulty)` en
Vault Fighter. Todo con `clamp` a mínimos y máximos en constantes:

| Campo | Fórmula | Nivel 1 → 8 |
|---|---|---|
| `reactionMs` | 650 − dificultad × 55 | 595 → 210 |
| `passErrorDeg` | 18 − dificultad × 2 | 16° → 2° |
| `shotErrorDeg` | 14 − dificultad × 1,5 | 12,5° → 2° |
| `catchChance` | 0,50 + dificultad × 0,05 | 0,55 → 0,90 |
| `penaltyReadChance` | 0,50 + dificultad × 0,0125 | 0,51 → 0,60 |
| `tackleChance` | 0,45 + dificultad × 0,04 | 0,49 → 0,77 |

El error angular se aplica al vector del pase o chut con `rng()` centrado en cero. **La dificultad
NO toca la velocidad**: la CPU difícil gana por reacción y precisión, no por piernas (criterio 14).

**Cambio de estrategia de la CPU por marcador**, reevaluado cada 5 s: perdiendo → ataque;
empatando en la segunda parte con < 30 s → ataque; ganando por uno con < 30 s → defensa; gol de
oro → ataque.

### Decisiones estructurales

**Puntuación** — **solo puntúa el Mundial** (grill 2026-09-04). Ningún amistoso escribe en la
tabla, ni contra la CPU ni a dos: es entrenamiento para hacerse con los controles antes del
Mundial, y dos humanos podrían pactar un 20-0. Como el versus de Pong: marcador en pantalla, nada
enviado. La tabla de `vault-world-cup` solo tiene Mundiales, comparables entre sí.

| Concepto | Puntos |
|---|---|
| Gol | 1 000 |
| Victoria en un partido | 5 000 |
| Portería a cero | 2 000 |
| Pasar cuartos / semifinal | 5 000 / 10 000 |
| Campeón del mundo | 25 000 |

Un Mundial perfecto vale **61 000 sin contar goles** (3 × 5 000 + 3 × 2 000 + 40 000) más 1 000
por gol: con 2-3 goles por partido **ronda los 70 000**. Los goles son lo único sin techo y donde
se expresa la habilidad; no hay tope.

**Gol de oro sin tope**, con la CPU pasando a estrategia de ataque al entrar en él para que el
partido se abra solo.

**Banco de dieciséis selecciones**, ocho por Mundial, sorteadas. Todas iguales en el campo,
distintas en nombre y equipación (Italia azul, España roja, Brasil amarilla — las inconfundibles).

**Dificultad de la CPU**: 4 en cuartos, 6 en semifinal, 8 en la final; 5 en el amistoso. Sobre una
escala de 1 a 8, derivada por fórmula como en Vault Fighter: afecta a la reacción, a la precisión
del pase y al portero. Números, no ramas.

**Alineación y estrategia como datos.** Cada formación es una lista de ocho posiciones como
fracción del campo; la estrategia desplaza todas ±12 % hacia la portería rival. Invariante: toda
formación suma ocho y ninguna posición se sale del campo.

---

## Plan de implementación

Once pasos en **cuatro etapas**, cada una cerrable por sí sola. **Máximo una etapa al día**; si una
necesita dos, se le dan, y al terminarla se para. La red antes que el contenido, la lógica pura
antes que la pantalla, y el refactor nunca mezclado con funcionalidad.

### Etapa A — el motor, sin pantalla

**1. `rng.ts`, `pitch.ts`, `teams.ts` e `invariants.ts` — la red antes que nada.**
El generador con semilla, el campo, los tipos de selección y formación, y la red de invariantes con
test negativo cada una: toda formación suma ocho y ninguna posición se sale del campo; el banco no
repite ids ni equipaciones; la geometría del campo es coherente. Con **dos selecciones y una
formación** — el contenido llega en el paso 7 con la red ya en verde.

**2. `input.ts`, `players.ts` y `ball.ts` — el determinismo.**
La entrada simétrica, los nueve jugadores creados por formación, movimiento, sprint en ráfaga con
recuperación, el suelo tras la entrada, y la física del balón con altura y posesión pegada al pie.
`STEP_MS` y `stepMatch` de paso fijo en `step.ts`. **El test que manda**: misma semilla y misma
secuencia de entradas producen el mismo estado, paso a paso, sobre un partido largo. Es la
precondición del online y se fija aquí.

**3. `actions.ts` — lo que hace un jugador.**
Chut con carga, pase corto raso, pase largo por alto, robo de pie, entrada al suelo con sus tres
desenlaces. Todas escriben en out-params. Y el cambio automático de jugador controlado: derivado, más cercano
con desempate por `id` e histéresis de 40 u (nunca el portero; con posesión, el poseedor).

**4. `referee.ts` y `set-pieces.ts` — las reglas y los saques.**
Gol, balón fuera por cada línea, falta y penalti. La fase de saque completa: tipo, posición,
dirección elegida con la cruceta, cuenta atrás, ejecución automática. El penalti con lanzador y
portero.

**5. `match.ts` — el partido entero.**
Reloj, dos partes, marcador, gol de oro sin tope, y la máquina de fases. **Guarda de precondición
en todas las transiciones**, sin excepciones. Test de un partido completo simulado con entradas
grabadas.

### Etapa B — la inteligencia y el contenido

**6. `ai.ts` — la CPU y los compañeros.**
Colocación por formación y estrategia, persecución del balón por el más cercano, portero, y la
decisión del equipo CPU que rellena un `TeamInput` — pasar, chutar, entrar, cambiar de estrategia
por marcador. Perfil por dificultad de 1 a 8, derivado por fórmula. Test de que la IA nunca
produce una entrada inválida y de que a más dificultad reacciona antes y acierta más.

**7. El contenido: las 16 selecciones y las 3 formaciones**, con la red del paso 1 cerrándose
sobre los datos reales. Debe pasar a la primera, como en Vault Fighter.

### Etapa C — la pantalla

**8. `VaultWorldCupGame.tsx` y los SFX.**
Cámara que sigue al balón, minimapa, campo y jugadores con las equipaciones, HUD con marcador y
reloj, teclado, la fase de saque dibujada con su cuenta atrás, rótulos de gol y de ELIMINADO. **Un
solo amistoso contra la CPU, sin modos**: es la prueba de que el motor y la pantalla encajan. Aquí
se juega por primera vez, y el QA empieza a ajustar números.

**9. `mode.ts`, `world-cup.ts`, y todas las pantallas de flujo.**
Selector de modo, selector de selección, el segundo teclado del amistoso a dos, el sorteo del
Mundial, su cuadro con pantalla al inicio de cada partido, y las dos pantallas de victoria:
confeti en el amistoso, fuegos artificiales en el Mundial.

### Etapa D — el cierre

**10. Registro, tipos, migración, play-page, música y carátula.**
La entrada en el catálogo con instrucciones que expliquen los tres botones y el pulsar/mantener,
la fila en base de datos, la play-page espejo de la de Vault Fighter, las tres pistas al azar, y la
carátula.

**11. `verify-plan` y QA humano.**
Los criterios de aceptación del spec, y el QA de Paco: que el fútbol se sienta fútbol, que el
amistoso a dos sea justo, y que el Mundial dé ganas de otro.

---

## Criterios de aceptación

**Motor y determinismo**
1. **Misma semilla y misma secuencia de entradas producen el mismo estado**, paso a paso, en un
   partido completo. Hay test que lo fija. **La simulación es de paso fijo** (`STEP_MS`): ningún
   `dtMs` entra en el motor.
2. **El motor no distingue quién mueve cada equipo**: `stepMatch` recibe dos `TeamInput` y ningún
   módulo de `football-logic/` lee teclado, `Math.random` ni estado de módulo.
3. **Toda formación suma ocho de campo y ninguna posición se sale del campo**; el banco no repite
   ids ni equipaciones. Invariantes con test negativo cada uno.
4. **Nueve por equipo**, y el portero nunca es el jugador controlado.
5. **Se controla siempre el más cercano al balón**, con histéresis de 40 u para que no parpadee,
   y el cambio es automático y derivado del estado (no es entrada).

**Juego**
6. **El balón va pegado al pie** y un rival puede robarlo de pie o con entrada al suelo.
7. **Los tres botones hacen lo suyo con y sin balón**: A chut (mantener = más fuerte) o entrada; B
   pase corto al pulsar, largo al mantener, o robo; C sprint en ráfaga con recuperación.
8. **La entrada al suelo tiene tres desenlaces**: roba si llega al balón, falta si toca al jugador,
   y un segundo en el suelo si no llega a nada.
9. **Falta fuera del área es tiro libre; dentro, penalti** con el lanzador eligiendo lado y el
   portero tirándose. Penalti solo cuando el infractor comete la falta **dentro de su propia
   área grande** (ruling R14); una falta del atacante en el área rival es tiro libre. Sin
   tarjetas, sin fuera de juego.
9b. **El portero nunca sale del área grande** (invariante), y solo sale de su línea dentro del
    área pequeña.
10. **Todo saque es automático con dirección**: cruceta para elegir, cuenta atrás de cinco segundos
    visible, y sale solo.
11. **Alineación y estrategia se cambian en pleno partido** y la colocación del equipo responde en
    el acto.
12. **Dos partes de 90 segundos y gol de oro sin tope**, con la CPU pasando a ataque al entrar en
    gol de oro.
13. **La cámara sigue al balón sin salirse del campo**, y el minimapa muestra a los dieciocho.

**Modos y flujo**
14. **Amistoso contra la CPU y amistoso a dos en el mismo teclado**, y en el de dos ningún equipo
    tiene ventaja de entrada — mismo motor, mismas velocidades.
15. **El Mundial sortea ocho de un banco de dieciséis**, eliminatoria directa de tres partidos, con
    pantalla de cuadro al inicio de cada uno.
16. **Perder en el Mundial es ELIMINADO** sobre la pantalla del partido, sin CONTINUE.
17. **Ganar el amistoso da la pantalla de GANADOR con confeti; ganar la final, la de CAMPEONES DEL
    MUNDO con fuegos artificiales**, ambas con la selección ganadora, y CONTINUAR devuelve al
    selector de modo.
18. **La dificultad de la CPU es 4, 6 y 8 en cuartos, semifinal y final**, y 5 en el amistoso.
19. **Solo el Mundial guarda puntuación en la tabla de `vault-world-cup`**, con los valores del
    spec. Ningún amistoso pide nombre ni envía nada.

**Calidad**
20. **Ninguna asignación de memoria por frame** en el bucle ni en el dibujo, incluido el confeti
    (depósito de partículas creado una vez).
21. **La suite sigue verde y no baja de los 504 tests** de partida.
22. **QA humano:** el fútbol se siente fútbol, el amistoso a dos es justo, y el Mundial da ganas de
    otro. Los criterios se revisan tras este QA.

---

## Decisiones tomadas y descartadas

- **Sí: campo grande con cámara sobre el balón y minimapa.** Descartado el campo fijo que
  recomendaba Claude: en móvil serían muñecos de tres píxeles, y el minimapa resuelve gratis el
  contexto que la cámara quita. (Paco, 2026-09-03)
- **Sí: nueve por equipo, ocho de campo más portero, formación 3-3-2 de salida.** Los clásicos eran
  once contra once, pero el coste no es visual sino la IA de veinte muñecos. El tamaño es
  constante con formación e invariante: el QA decide el número jugando. (Paco, 2026-09-03)
- **Sí: tres alineaciones y tres estrategias, cambiables en pleno partido.** Salen gratis de que
  la colocación sea por datos. Descartado cambiar solo antes o en el descanso: pasar a defensa
  ganando por uno en el último minuto es la decisión que da gracia. (Paco, 2026-09-03)
- **Sí: se controla siempre el más cercano al balón. Portero siempre IA.** (Paco, 2026-09-03)
- **Sí: balón pegado al pie.** Descartado el balón libre a lo Kick Off: es un juego de habilidad
  que se abandona al segundo partido. Queda como variante futura sobre este motor. (Paco, 2026-09-03)
- **Sí: tres botones con pulsar/mantener.** Con balón A chut, B pase corto/largo, C sprint; sin
  balón A entrada, B robo, C sprint. Descartado un cuarto botón: tocaría el mando de los otros
  trece juegos. Descartado un botón único contextual: sin pase los ocho de campo no importan.
  (Paco, 2026-09-03)
- **Sí: sprint en ráfaga con recuperación en la v1.** Sin coste sería velocidad gratis; la
  resistencia real llega con los atributos en la v1.5. (Paco, 2026-09-03)
- **Sí: faltas y penaltis en la v1. Tarjetas, si acaso, en la v1.5** tras jugar. Descartado el
  "sin árbitro" que recomendaba Claude. (Paco, 2026-09-03)
- **No: fuera de juego.** En un arcade es motivo de abandono. (2026-09-03)
- **Sí: saques automáticos con dirección y cuenta atrás de cinco segundos**, todos: inicial, banda,
  córner, puerta, falta y penalti. Descartada la fase de saque controlada. (Paco, 2026-09-03)
- **Sí: dos partes de 90 segundos y gol de oro sin tope**, con la CPU pasando a ataque. Descartados
  prórroga y tanda de penaltis: spec aparte. Techo de 120 por parte; un partido nunca más de cinco
  minutos. (Paco, 2026-09-03)
- **Sí: jugadores idénticos con identificador propio en la v1.** Atributos por posición,
  resistencia y cambios de banquillo van juntos a la **v1.5**: sin atributos un cambio no significa
  nada. El identificador propio es lo que hará posibles los cambios sin reescribir. (Paco, 2026-09-03)
- **Sí: solo selecciones, dieciséis en el banco, ocho por Mundial.** Iguales en el campo, distintas
  en nombre y equipación. Clubes, si acaso, v2. Octavos de final solo si el QA lo pide, y nunca
  más de dieciséis. (Paco, 2026-09-03)
- **Sí: dos modos, amistoso y Mundial.** El amistoso admite dos jugadores en el mismo teclado —es
  el banco de pruebas del QA y la demostración de que las entradas simétricas funcionan. El Mundial
  es siempre contra la CPU: un Mundial a dos sería el torneo con plazas humanas del roadmap.
  (Paco, 2026-09-03)
- **Sí: eliminatoria directa sin fase de grupos, y eliminado sin CONTINUE.** (Paco, 2026-09-03)
- **Sí: pantallas de victoria pintadas en canvas, no una imagen por selección.** Composición fija
  con la equipación y el nombre del ganador levantando la copa; confeti en el amistoso, fuegos
  artificiales en el Mundial; CONTINUAR devuelve al selector. ELIMINADO es un rótulo sobre el
  partido, sin pantalla propia. Descartado un PNG por selección: no escala. (Paco, 2026-09-03)
- **Sí: solo puntúa el Mundial.** Sustituye a la puntuación única de los dos modos del 03-sep:
  el amistoso (CPU o a dos) es entrenamiento y no escribe en la tabla, como el versus de Pong. Paco
  lo dejó a criterio de Claude por no ser bloqueante. (2026-09-04)
- **Sí: el controlado es estado derivado con histéresis de 40 u**, no entrada. El replay solo
  necesita semilla + `TeamInput`. **Tras el QA, preguntar a Paco si en la v1.5 pasa a cambio
  manual** (botón o cruceta, como los fútbol de consola). (Paco, 2026-09-04)
- **Sí: paso fijo de simulación a 60 por segundo**, acumulador en el componente con tope de 5
  pasos por frame. Descartado el `dtMs` variable: solo sería determinista dentro de un mismo
  ordenador. (Paco, 2026-09-04)
- **Sí: la IA con los números de la sección "Reglas de la IA"**: árbol chutar/pasar/conducir,
  colocación por ancla + deriva + separación + persecución acotada por estrategia, portero en su
  línea y nunca fuera del área, perfil por fórmula que no toca la velocidad. Regla de Paco: "lo más
  parecido al fútbol real". (Paco, 2026-09-04)
- **Sí: selecciones idénticas en la v1 con `profileFor(teamDef, difficulty)` ya preparado.**
  Descartadas las pequeñas variaciones por equipo en la v1: en el primer QA no se sabría si una
  selección es más dura por la fórmula de dificultad o por la variación. (Paco, 2026-09-04)
- **Sí: la cuenta del Mundial perfecto es ~70 000, no 80 000** (61 000 base + goles). La tabla no
  cambia. (2026-09-04)
- **Etapa A ejecutada (2026-09-04), rulings que tocan el spec:** R7 `stepMatch` en `match.ts`; R10
  pases asistidos por cono de 45°; R11 la entrada al suelo hace falta al tocar a cualquier rival y el
  que entra también cae 1 s; R14 penalti solo por falta en área propia; R6 dos números añadidos
  (robo vs sprint 35 %, `vz` del chut 200). Ledger completo en
  `.superpowers/sdd/2026-09-04-vault-world-cup-engine/progress.md` (git-ignorado).
- **Sí: dificultad de la CPU 4-6-8 por ronda y 5 en el amistoso**, derivada por fórmula como en
  Vault Fighter. (Paco, 2026-09-03)
- **Sí: entradas simétricas y azar con semilla desde el día uno, y nada de red.** Tomada el 02-sep
  pensando en el online del roadmap. No es andamiaje: es no cerrar una puerta que cuesta lo mismo
  dejar abierta. (Paco, 2026-09-02)
- **Sí: el motor se llama `football-logic`, no `world-cup-logic`.** Es el que reutilizará la
  variante a lo Kick Off. (2026-09-03)
- **Sí: cuatro etapas, máximo una al día, y la calidad manda sobre el calendario.** Mejor una v1
  rejugable en ocho días que una floja en cuatro. (Paco, 2026-09-03)
- **Sí: tres pistas de música al azar por partido; el público y el silbato por síntesis.** La
  carátula la hace Claude con `design`. (Paco, 2026-09-03)
- **Sí: los criterios se revisan tras el QA.** Están bien de partida, pero hasta que no se juega no
  se sabe qué hay que refinar. (Paco, 2026-09-03)

---

## Pendientes para el spike de la v1.5 (discutir con Paco punto a punto tras el QA)

La v1 es el MVP; la v1.5 es el producto fino. Lo apuntado en el grill del 04-sep:

- **Cambio manual de jugador controlado** (botón o cruceta), frente al derivado con histéresis.
- **Atributos por selección**: defensa, ataque, contraataque, chute, pase. Son los que tomará la
  CPU al manejar cada selección, con niveles de dificultad propios por equipo.
- **Atributos por jugador**: velocidad, regate, chut, entrada. Con ellos, resistencia real y
  cambios de banquillo (ya en el spec).
- `profileFor(teamDef, difficulty)` ya recibe la selección: aquí es donde entra.
- Afinar la fórmula de dificultad y los equipos después de jugar.

---

## Riesgos identificados

1. **Es el juego más grande del proyecto, y la IA es la factura.** Dieciocho muñecos que tienen
   que colocarse con sentido, un portero que ataje y una CPU que decida pasar, chutar o entrar. Es
   donde más números hay que afinar y donde el QA va a pedir más rondas. Por eso la etapa B es
   entera para ella, y por eso cada etapa se cierra cuando está bien y no cuando toca.
2. **Que el fútbol se sienta fútbol no lo verifica ningún test.** Los invariantes garantizan que el
   partido es *legal*; que sea divertido solo se sabe jugando. Es el mismo riesgo de producto que
   el equilibrio de Vault Fighter, y aquí es mayor porque hay más piezas interactuando.
3. **El determinismo es frágil y se rompe en silencio.** Un `Math.random` que se cuele, un
   `Date.now()`, un `dtMs` que entre en el motor, un orden de iteración que dependa de un `Set`, un
   `Math.sin` en la física: cualquiera deja la simulación no reproducible y ningún partido lo nota hoy — se notará el día del online. El test de misma
   semilla y mismas entradas es la única red, y hay que correrlo sobre un partido largo.
4. **El gol de oro sin tope puede no acabar.** La CPU pasando a ataque lo hace improbable, no
   imposible. Si el QA lo ve, el tope y la tanda de penaltis serán su propio spec.
5. **La cámara y el minimapa multiplican el dibujo.** Todo pasa por una transformación de mundo a
   pantalla. Con la norma de no asignar memoria cabe en 60 fps, pero es el juego con más elementos
   en pantalla del catálogo y el primero con cámara.
6. **El amistoso a dos es el primer juego con dos entradas humanas simultáneas desde Pong.** Un
   solo manejador de teclado sirviendo a dos `TeamInput` con teclas distintas, y ninguno puede
   pisarse. Es lo que demuestra o desmiente las entradas simétricas.
7. **Los tests que pasan por coincidencia del fixture volverán a aparecer.** Ya pasó tres veces en
   Vault Fighter. En un motor con física las coincidencias son más fáciles todavía. Regla para cada
   test: preguntarse si pasaría con otros números.
