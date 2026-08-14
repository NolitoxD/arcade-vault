# SPEC 17 — Road Fighter extendido: velocidad, hazards e IA de rivales

> **Estado:** Approved
> **Depende de:** 16-road-fighter
> **Fecha:** 2026-08-14
> **Objetivo:** Ampliar Road Fighter con control de velocidad (↑/↓), hazards de
> carretera (curvas, aceite, charcos, meta de tramo) e IA de rivales (cambios de
> carril y embestidas telegrafiadas), manteniendo intacto por construcción el
> invariante del carril transitable del spec 16.

---

## Por qué este spec existe

El spec 16 dejó tres ampliaciones explícitas en "Qué no entra". Las tres giran
alrededor del mismo peligro: **cualquier elemento nuevo que ocupe u obstruya
carriles puede romper el invariante del hueco garantizado**. Este spec existe
para diseñar cada ampliación declarando explícitamente cómo respeta ese
invariante — ninguna feature entra sin esa declaración.

---

## Scope

**In:**

- Todo el trabajo ocurre sobre `components/games/RoadFighterGame.tsx` y
  `app/games/road-fighter/play/page.tsx` — sin archivos nuevos, sin migraciones,
  sin cambios en Supabase.
- **Acelerar/frenar** con `↑`/`↓` **y** alias `W`/`S`:
  - Tres regímenes de velocidad sobre el scroll del nivel: FRENO (×`BRAKE_FACTOR`),
    CRUCERO (×1, por defecto) y TURBO (×`BOOST_FACTOR`), activos mientras la
    tecla está pulsada (flags `keydown`/`keyup`, igual que el lateral).
  - El drain de fuel es **proporcional al régimen**: frenar ahorra combustible,
    el turbo lo quema más rápido (ver Data model).
  - La puntuación por distancia no cambia de fórmula: sigue ligada a píxeles de
    mundo recorridos, así que frenar ya reduce puntos/segundo y el turbo los
    sube — riesgo y recompensa sin tocar el modelo de score.
  - **Recálculo del invariante con la velocidad máxima nueva**: la relación del
    spec 16 pasa a dimensionarse contra `SCROLL_MAX_SPEED × BOOST_FACTOR` (no
    contra la media), subiendo `SPAWN_WINDOW_H` en consecuencia (ver Data model).
  - Indicador de régimen en el HUD interno del canvas: etiqueta
    FRENO / CRUCERO / TURBO junto a la barra de fuel.
- **Meta de tramo**: al completar cada `LEVEL_DISTANCE` (= subir de nivel), una
  línea de meta a cuadros cruza la pantalla con banner "META" (~1 s, no
  bloqueante: el juego no se pausa) y suma un bonus de `200 × nivel completado`.
  La meta **no** recarga fuel — los bidones siguen siendo el único repostaje.
  Invariante: la línea de meta es puramente visual, no es obstáculo — no ocupa
  carriles.
- **Curvas**: el trazado entero (calzada + arcenes + todo lo que hay sobre él)
  se desplaza lateralmente de forma progresiva siguiendo un offset senoidal por
  tramos en función de la distancia de mundo. Rivales, bidones y manchas se
  posicionan **relativo al carril**, así que se desplazan con la carretera.
  Invariante: la curva mueve la carretera como bloque — nunca cierra huecos; el
  drift lateral máximo por ventana (`CURVE_DRIFT_PER_WINDOW_MAX`) entra en el
  presupuesto de travesía del invariante (ver Data model).
- **Manchas de aceite**: hazard estático sobre un carril; pisarla produce
  derrape — durante `OIL_SLIP_MS` el input lateral se ignora y el coche conserva
  la velocidad lateral que llevaba (puede acabar en el arcén o contra un rival:
  el derrape no es choque en sí, el choque resultante sí). Invariante: el aceite
  **nunca** aparece en el `gapLane` de su ventana.
- **Charcos**: hazard estático sobre un carril; mientras el coche lo pisa, el
  scroll efectivo se reduce a ×`PUDDLE_SLOW_FACTOR` (pierde puntos/segundo, sin
  perder el control — hazard de velocidad, complementario al aceite que es
  hazard de control). Invariante: los charcos **nunca** aparecen en el
  `gapLane` de su ventana.
- **IA de rivales — cambios de carril**:
  - Un rival puede cambiar a un carril **adyacente** con animación de
    `LANE_CHANGE_MOVE_MS`, precedida siempre de un telegrafiado visual de
    `LANE_CHANGE_TELEGRAPH_MS = 300` ms (intermitente parpadeante hacia el lado
    del cambio) para que sea esquivable.
  - **REGLA DURA (mecanismo exacto):** cada rival guarda al spawnearse el
    `gapLane` de su ventana **y** el de la ventana adyacente hacia el jugador.
    Esos carriles son destinos prohibidos. Si ningún carril adyacente es legal,
    el rival no cambia (y su cooldown se reinicia). Así un rival jamás invade el
    hueco de su ventana ni el de la ventana hacia la que deriva — la cadena de
    huecos queda intacta por construcción.
  - Cooldown por rival (`LANE_CHANGE_COOLDOWN_MS`) y probabilidad de cambio
    creciente con el nivel, con tope.
- **IA de rivales — embestidas**: un rival en carril adyacente al del jugador y
  a distancia corta puede lanzarse hacia el carril del jugador. Es un cambio de
  carril normal a todos los efectos: mismo telegrafiado de 300 ms, misma
  animación y **misma regla dura** (si el carril del jugador es un carril
  prohibido para ese rival, la embestida no ocurre). Cooldown global
  (`RAM_COOLDOWN_MS`) para que nunca haya dos embestidas encadenadas.
- Los **7 patrones del spec 12 siguen siendo requisito**: los elementos nuevos
  (aceite, charco, línea de meta, intermitente) entran en la caché de sprites
  neon (P7) cuando `@skin-designer` haga su pasada; los timers nuevos (derrape,
  telegrafiado, banner) van acotados (P3); cero allocaciones nuevas en el RAF (P1).
- **La puntuación base no cambia** (distancia/rebase/bidón del spec 16). Único
  evento nuevo que puntúa: el bonus de meta (`200 × nivel`).

**Fuera de alcance:**

- **Anchura variable de la calzada** — recortada de esta ampliación (ver
  Decisions: rompe el `LANE_COUNT` fijo que sostiene el spawner; las curvas ya
  dan variedad de trazado con el invariante intacto).
- Rivales que aceleran/frenan o reaccionan al régimen del jugador.
- Hazards móviles (manchas que se desplazan, obstáculos que caen).
- Marchas, turbo con recarga, nitro o cualquier economía de velocidad extra.
- Cambios en migración, catálogo, copy de la card o `REALTIME_GAMES` — todo eso
  quedó cerrado en el spec 16.
- La pasada de `@mobile-porter` y la de `@skin-designer` — se ejecutan después,
  con los deberes que este spec les deja por escrito (ver sección de cadena).

---

## Data model

No se introducen tablas ni tipos TypeScript nuevos. Cambios internos en
`RoadFighterGame.tsx`:

### Velocidad y fuel

```ts
const BRAKE_FACTOR = 0.6;  // ↓/S mantenida: scroll × 0.6
const BOOST_FACTOR = 1.4;  // ↑/W mantenida: scroll × 1.4
// drain de fuel proporcional al régimen:
// drain = FUEL_DRAIN_PER_S × speedFactor  (0.6 | 1.0 | 1.4)
```

El régimen es un factor sobre la velocidad de scroll del nivel; los topes del
spec 16 se conservan y el máximo absoluto pasa a ser
`SCROLL_MAX_SPEED × BOOST_FACTOR` (560 × 1.4 = 784 px/s).

### Invariante recalculado

`SPAWN_WINDOW_H` sube de 260 a **340** px y la relación documentada junto a las
constantes pasa a ser:

```
tiempo_travesía_1_carril + tiempo_drift_curva_por_ventana
  < SPAWN_WINDOW_H / (SCROLL_MAX_SPEED × BOOST_FACTOR)
```

Es decir: el presupuesto de travesía se calcula contra la **velocidad máxima
con turbo**, y el drift de curva consume parte de ese presupuesto.

### Curvas

```ts
const CURVE_AMPLITUDE_MAX = 60;        // px de offset lateral máximo del trazado
const CURVE_DRIFT_PER_WINDOW_MAX = 30; // px de drift máximo por ventana de spawn
```

El offset lateral es una función senoidal suave de la distancia de mundo,
recalculada por tramo (cada nivel define fase y amplitud dentro de los topes).
Todas las entidades ligadas a carril (rivales, bidones, aceite, charcos) se
dibujan como `carril → x_base + curveOffset(worldY)` — la carretera se mueve
como bloque.

### Hazards

```ts
const OIL_SLIP_MS = 600;         // derrape: input lateral ignorado, deriva conservada
const PUDDLE_SLOW_FACTOR = 0.7;  // charco: scroll efectivo × 0.7 mientras se pisa
const GOAL_BONUS = 200;          // bonus de meta: 200 × nivel completado
const GOAL_BANNER_MS = 1000;     // duración del banner META (no bloqueante)
```

Aceite y charcos se spawnean dentro de la ventana como los rivales, **siempre en
carril ≠ `gapLane`**, con frecuencia por nivel acotada.

### IA de rivales

```ts
const LANE_CHANGE_TELEGRAPH_MS = 300; // intermitente antes de moverse
const LANE_CHANGE_MOVE_MS = 400;      // duración de la animación de cambio
const LANE_CHANGE_COOLDOWN_MS = 1500; // por rival
const RAM_COOLDOWN_MS = 4000;         // global, entre embestidas
```

Estado por rival (en los objetos del pool del efecto, no estado React):

```ts
interface RivalAI {
  forbiddenLanes: [number, number]; // gapLane de su ventana + el de la adyacente hacia el jugador
  laneChangeCooldown: number;       // ms restantes (timer acotado — P3)
  telegraph: -1 | 0 | 1;            // 0 = sin cambio; ±1 = lado telegrafiado
  telegraphTimer: number;
}
```

Transición de un cambio de carril: elegible (cooldown a 0, destino adyacente
legal) → telegrafiado 300 ms (intermitente) → animación 400 ms → cooldown. La
embestida es la misma máquina de estados con condición de disparo distinta
(jugador en carril adyacente a distancia corta) y sujeta además al cooldown
global.

---

## Impacto en la cadena de agentes

El orden de la cadena no cambia: **implementación → `@mobile-porter` →
`@skin-designer`**. Deberes que este spec les deja:

- **`@mobile-porter`**: ampliar el `keyMap` del `MobileGamepad` con `up`/`down`
  (acelerar/frenar en el D-pad). El componente canvas no se toca: `↑`/`↓` y
  `W`/`S` ya son alias equivalentes, igual que el eje lateral del spec 16.
- **`@skin-designer`**: añadir a los 3 skins los elementos visuales nuevos —
  mancha de aceite, charco, línea/banner de meta, intermitente de telegrafiado
  y etiqueta de régimen del HUD interno. En neon, todos entran en la caché de
  sprites offscreen (P7); el telegrafiado parpadeante debe seguir siendo legible
  en los 3 skins (es información de gameplay, no decoración).

---

## Implementation plan

1. **Acelerar/frenar** — flags `↑`/`↓` + `W`/`S`, factor de régimen sobre el
   scroll, drain de fuel proporcional, etiqueta FRENO/CRUCERO/TURBO en el HUD
   interno, y `SPAWN_WINDOW_H` a 340 con la relación del invariante recalculada
   contra `SCROLL_MAX_SPEED × BOOST_FACTOR` en el comentario.
   Verificación: con TURBO mantenido el juego es visiblemente más rápido y el
   fuel cae más deprisa; con FRENO al revés; el spawning sigue siendo justo
   jugando ≥3 niveles en TURBO continuo.

2. **Meta de tramo** — al subir de nivel, línea de meta a cuadros + banner
   "META" durante `GOAL_BANNER_MS` (timer acotado, sin pausar el loop) y bonus
   `GOAL_BONUS × nivel completado` sumado al score.
   Verificación: al completar el nivel 1 aparece el banner y el score sube
   exactamente 200 puntos extra; el fuel no se recarga.

3. **Curvas** — offset senoidal por tramo con `CURVE_AMPLITUDE_MAX` y drift por
   ventana ≤ `CURVE_DRIFT_PER_WINDOW_MAX`; carretera, rivales, bidones y HUD de
   carril desplazados como bloque.
   Verificación: en tramos con curva, el trazado serpentea y los huecos siguen
   siendo alcanzables (≥5 niveles de observación); ningún rival ni bidón queda
   desalineado de su carril.

4. **Aceite y charcos** — spawn en carril ≠ `gapLane`; aceite → derrape de
   `OIL_SLIP_MS` con input ignorado y deriva conservada; charco → scroll
   ×`PUDDLE_SLOW_FACTOR` mientras se pisa; sonido de derrape reutilizando
   `/ball-bounce.mp3` (sin assets nuevos).
   Verificación: pisar aceite en deriva lateral desemboca en derrape visible y
   esquivable con anticipación; el charco frena sin quitar control; ninguno de
   los dos aparece jamás en el carril libre.

5. **IA de rivales** — máquina de estados telegrafiado → animación → cooldown
   con `forbiddenLanes` por rival (regla dura); embestida como caso particular
   con `RAM_COOLDOWN_MS` global; intermitente dibujado en el skin classic.
   Verificación: los cambios de carril siempre parpadean 300 ms antes de
   moverse; jugando ≥5 niveles ningún rival pisa un `gapLane` prohibido
   (chequeo de consola temporal sobre destinos elegidos); nunca hay dos
   embestidas seguidas dentro del cooldown global.

6. **Verificación final** — `npm run build` sin errores de TypeScript; pasada
   de los criterios P1–P7 sobre el código nuevo (sin literales en el RAF, timers
   acotados, sin búsquedas lineales nuevas); ninguna ruta devuelve 500.

---

## Acceptance criteria

- [ ] `↑`/`W` mantenida multiplica el scroll ×1.4 y el drain de fuel ×1.4; `↓`/`S` mantenida, ×0.6 ambos; soltar vuelve a CRUCERO.
- [ ] El HUD interno muestra el régimen actual (FRENO / CRUCERO / TURBO) junto a la barra de fuel.
- [ ] La fórmula de puntos por distancia no cambió: frenar reduce puntos/segundo y el turbo los aumenta solo por la distancia recorrida.
- [ ] `SPAWN_WINDOW_H = 340` y el comentario del invariante referencia `SCROLL_MAX_SPEED × BOOST_FACTOR` y el drift de curva.
- [ ] Jugando ≥3 niveles en TURBO continuo, toda ventana tiene ≥1 carril libre alcanzable (observación o chequeo de consola temporal).
- [ ] Al completar cada nivel aparece la línea de meta y el banner "META" ~1 s sin pausar el juego, y el score sube exactamente `200 × nivel completado`.
- [ ] La meta no recarga fuel.
- [ ] En tramos con curva, calzada, rivales, bidones y hazards se desplazan como bloque; ningún elemento queda fuera de su carril.
- [ ] El drift lateral del trazado por ventana nunca supera `CURVE_DRIFT_PER_WINDOW_MAX`.
- [ ] Pisar aceite ignora el input lateral durante ~600 ms conservando la deriva; el derrape en sí no resta vida (el choque resultante sí).
- [ ] Pisar un charco reduce el scroll efectivo a ×0.7 solo mientras se pisa, sin alterar el control lateral.
- [ ] Ni aceite ni charcos aparecen jamás en el `gapLane` de su ventana.
- [ ] Todo cambio de carril de un rival va precedido de un intermitente de 300 ms hacia el lado del movimiento.
- [ ] Ningún rival entra en sus `forbiddenLanes` (gapLane propio + el de la ventana adyacente hacia el jugador); si no hay destino legal, no hay cambio.
- [ ] Las embestidas usan el mismo telegrafiado y la misma regla dura, y respetan el cooldown global de 4 s.
- [ ] No hay literales de array nuevos en el RAF (P1), los timers nuevos (derrape, telegrafiado, banner, cooldowns) están acotados (P3) y no hay búsquedas lineales nuevas en el hot path (P4).
- [ ] El canvas sigue sin redibujarse en pausa (P2) y `RoadFighterGame` sigue exportado con `React.memo` (P5).
- [ ] "JUGAR DE NUEVO" resetea también régimen (CRUCERO), curvas, hazards y estados de IA.
- [ ] `npm run build` completa sin errores de TypeScript y ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: velocidad como 3 regímenes por tecla mantenida (×0.6 / ×1 / ×1.4)** —
  en vez de aceleración analógica acumulativa. Razón: dos flags de teclado igual
  que el eje lateral, trivial de sintetizar desde el D-pad del `MobileGamepad`,
  y sin estado de inercia que tunear; el riesgo/recompensa ya emerge del binomio
  puntos-por-distancia × drain de fuel.

- **Sí: drain de fuel proporcional al régimen** — Razón: convierte la velocidad
  en una decisión económica (turbo = más puntos/segundo pero menos autonomía)
  sin añadir eventos nuevos de puntuación; frenar como recurso defensivo tiene
  coste implícito (menos puntos) y beneficio (ahorro), así ningún régimen es
  dominante.

- **Sí: invariante recalculado contra `SCROLL_MAX_SPEED × BOOST_FACTOR` subiendo
  `SPAWN_WINDOW_H` a 340** — instrucción de diseño explícita: el hueco debe ser
  alcanzable a la velocidad **máxima**, no la media, porque el jugador puede ir
  en turbo permanente. Subir la ventana (y no la velocidad lateral del coche)
  mantiene la sensación de manejo del spec 16 intacta.

- **Sí: la meta no recarga fuel** — Razón: recargar en meta haría el fuel
  trivial (los niveles duran ~`LEVEL_DISTANCE`/scroll segundos, menos que la
  autonomía del depósito) y mataría a los bidones como mecánica; la meta ya
  recompensa con `200 × nivel`. Si el tuning demuestra que el fuel queda
  demasiado castigado a niveles altos, se ajusta la frecuencia de bidones, no
  la meta.

- **Sí: bonus de meta `200 × nivel` como único evento nuevo de puntuación** —
  Razón: mandato de la ampliación ("la puntuación base NO cambia"); un solo
  evento nuevo, alineado con la escala de rebase (50×) y bidón (25×), que
  premia cerrar tramos completos.

- **Sí: curvas como offset del trazado entero, entidades posicionadas relativo
  al carril** — Razón: la curva no puede cerrar huecos porque mueve carretera y
  ocupantes como bloque; el único efecto sobre el invariante es el drift lateral
  extra que el jugador debe compensar, y ese drift entra acotado
  (`CURVE_DRIFT_PER_WINDOW_MAX`) en el presupuesto de travesía. Alternativa
  descartada: curvar carriles individualmente — rompe la abstracción de carril
  y el spawner.

- **Sí: aceite = hazard de control, charco = hazard de velocidad** — Razón: dos
  hazards con castigos ortogonales (perder el volante vs. perder scroll) en vez
  de dos variantes del mismo derrape; el charco "derrape suave" se descartó por
  redundante con el aceite. Ambos fuera del `gapLane` **siempre**: la regla
  uniforme es más simple de implementar y de verificar que distinguir hazards
  letales de no letales.

- **Sí: regla dura de IA = `forbiddenLanes` por rival (gapLane propio + el de la
  ventana adyacente hacia el jugador)** — Razón: como los rivales derivan hacia
  el jugador respecto a la carretera, prohibir solo el gap propio dejaría a un
  rival invadir el hueco de la ventana a la que se acerca; con los gaps
  adyacentes difiriendo ±1, el conjunto prohibido son ≤2 carriles de 4 y casi
  siempre queda destino legal. Si no lo hay, el rival simplemente no cambia —
  el invariante nunca depende de un fallback.

- **Sí: telegrafiado obligatorio de 300 ms + cooldowns (1,5 s por rival, 4 s
  global de embestida)** — Razón: un cambio de carril instantáneo a corta
  distancia es indistinguible de un golpe injusto; 300 ms es percepción +
  reacción suficiente a las velocidades del juego, y los cooldowns impiden que
  la IA encadene agresiones que saturen el presupuesto de travesía del jugador.

- **Sí: embestida = cambio de carril con condición de disparo distinta** —
  Razón: reutiliza la misma máquina de estados, el mismo telegrafiado y la misma
  regla dura; cero código de movimiento nuevo y una sola fuente de verdad del
  invariante.

- **No: anchura variable de la calzada** — recortada de la ampliación (estaba
  sugerida). Razón: cambia `LANE_COUNT` dinámicamente, que es el cimiento del
  spawner y de todos los invariantes (gap, forbiddenLanes, hazards); combinada
  con curvas multiplicaría los casos borde y amenaza el cierre en el día. Las
  curvas ya aportan la variedad de trazado. Si llega, va en su propio spec con
  su propio análisis de invariante.

- **No: hazards móviles ni rivales que reaccionan al régimen del jugador** —
  Razón: cualquier elemento con movimiento lateral propio fuera de la regla dura
  reabre el análisis del hueco; se mantiene la garantía por construcción.

---

## Riesgos identificados

| Riesgo                                                                        | Mitigación                                                                                                                                                    |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turbo permanente como estrategia dominante (más puntos siempre)                | El drain ×1.4 obliga a repostar más y los bidones están en el `gapLane` — ir en turbo exige más travesías arriesgadas; tuning de `FUEL_DRAIN_PER_S` como válvula.  |
| Freno permanente para esquivar trivialmente                                    | Frenar reduce puntos/segundo (score por distancia) — la partida pasiva puntúa claramente menos; aceptado como estilo válido pero no competitivo.                  |
| Curva + turbo agotan el presupuesto de travesía del invariante                 | El drift por ventana está acotado (`CURVE_DRIFT_PER_WINDOW_MAX`) y sumado explícitamente a la desigualdad; QA jugando ≥5 niveles en turbo por tramos con curva.    |
| Derrape de aceite que empuja al jugador fuera del hueco justo antes de una ventana densa | El aceite nunca está en el `gapLane`: pisarlo es siempre consecuencia de salir del hueco voluntariamente; `OIL_SLIP_MS` corto (600 ms) limita el castigo.   |
| Rival sin destino legal se queda "congelado" en patrones raros                 | Comportamiento definido: no cambia y resetea cooldown — indistinguible de un rival sin IA; ningún fallback que toque el invariante.                              |
| El telegrafiado no se lee en algún skin                                        | Deber por escrito para `@skin-designer`: el intermitente es información de gameplay y debe ser legible en los 3 skins; criterio de su pasada, no de esta.         |
| Sprites nuevos degradan el skin neon (shadowBlur por frame)                    | Aceite, charco, meta e intermitente entran en la caché offscreen (P7) en la pasada de `@skin-designer`, patrón ya resuelto en el spec 12.                        |
| Más timers simultáneos (derrape, telegraph, banner, cooldowns) crecen sin tope | Todos declarados con acotación (P3) y listados en el criterio de aceptación dedicado.                                                                            |

---

## Qué **no** entra en este spec

- **Anchura variable de la calzada** — recortada: rompe el `LANE_COUNT` fijo que
  sostiene el spawner y todos los invariantes; su propio spec si llega, con su
  propio análisis de alcanzabilidad.
- Hazards móviles y rivales que reaccionan al régimen del jugador.
- Marchas, nitro o economías de velocidad adicionales.
- La ejecución de las pasadas de `@mobile-porter` (keyMap con up/down) y
  `@skin-designer` (aceite, charco, meta, intermitente, régimen en los 3 skins)
  — quedan encargadas por escrito en la sección de cadena, pero se ejecutan
  después, en su orden.
- Cualquier cambio en Supabase, catálogo, copy o `REALTIME_GAMES`.

Cada uno de ellos, si llega, va en su propio spec o en la pasada de su agente.
