# SPEC 27 — KONG v1.5: cuatro mapas, Kong que trepa y final con victoria

> **Estado:** Approved (diseño aprobado por Paco, 2026-08-28)
> **Depende de:** 26-kong
> **Fecha:** 2026-08-28
> **Objetivo:** Convertir KONG de bucle endless de una sola pantalla en un juego
> **terminable**: 4 mapas de dificultad creciente que se recorren en orden, con
> Kong trepando un peldaño en cada uno hasta salirse del escenario, y una 5ª
> pantalla final cuyo trofeo cierra la partida con **victoria** en lugar de subir
> de nivel.

---

## Contexto: qué problema resuelve

Kong se entregó el 27-ago con verify-plan PASS y QA OK. Al jugarlo en la sesión
del 28-ago apareció un problema que ninguna revisión de código podía detectar:
**el propio autor del juego subió a por Kong esperando que pasara algo**, porque
la copa flota sin señalar y el sprite llamativo está en la otra punta de la viga.
Y al superar un nivel la pantalla es idéntica, así que "subir de nivel" no se
percibe. Este spec ataca las dos cosas a la vez: la meta se entiende porque Kong
**avanza hacia ella** delante del jugador, y el progreso se ve porque **la
pantalla cambia**.

---

## Scope

**In:**

- `level.ts`: `GIRDERS`/`LADDERS`/`KONG`/`TROPHY`/`HAMMERS`/`PLAYER_SPAWN` dejan de
  ser constantes únicas y pasan a ser **5 layouts** en un array, con `layoutFor(level)`.
- **Kong trepa**: viga 4 → viga 5 → dos cornisas propias por encima del escenario;
  en la pantalla final baja de nuevo a la viga 5. `spawnBarrel` deja de hardcodear
  la viga superior y recibe la viga desde la que Kong lanza.
- `LEVEL_CONFIG` pasa de 10 entradas con clamp a **5**, una por mapa.
- **Pantalla final (mapa 5)**: mismo trofeo visible, pero al cogerlo termina la
  partida en victoria en vez de avanzar de nivel.
- **Modal de victoria propio** en la play-page, distinto del de game over.
- Tests de **invariantes de layout** (ver más abajo): hoy no existe ninguno que
  garantice que el trofeo sea alcanzable.

**Out (no se toca):**

- Física del jugador (`player.ts`), martillos, scoring por barril.
- Ascensores, remaches, fuego, muelles — siguen fuera, como en el spec 26.
- Los 3 skins y la música: se heredan sin cambios.
- El bug responsive de las play-pages (es de plataforma, va por su cuenta).

---

## Diseño

### Kong trepa: de dónde sale la dificultad

Kong no está decorando: **es la fuente de los barriles**. Hoy `spawnBarrel()`
hardcodea `girder = GIRDERS.length - 1`, así que los barriles siempre nacen arriba
y recorren la pantalla entera. Al parametrizar de dónde lanza Kong, su ascenso se
convierte en dificultad real durante los dos primeros mapas, sin tocar la física:

| Mapa | Kong está en | Los barriles nacen en | Efecto |
|---|---|---|---|
| 1 | viga 4 | viga 4 | El tramo alto está limpio. Mapa de aprendizaje. |
| 2 | viga 5 | viga 5 | Pantalla completa (el Kong de hoy). |
| 3 | cornisa baja | viga 5 | Kong ya está fuera del escenario jugable. |
| 4 | cornisa alta | viga 5 | Kong en lo más alto, sin sitio al que huir. |
| 5 (final) | viga 5 | viga 5 | **Baja** a defender el trofeo. |

Las **cornisas** son plataformas propias de Kong por encima de la viga superior:
se dibujan, pero no son jugables ni forman parte de `girders`. Es la estampa del
original, donde Kong tiene su plataforma aparte. Narrativamente cierra bien: Kong
huye hacia arriba hasta quedarse sin sitio y en la pantalla final **baja** a
defender el trofeo.

**Consecuencia asumida:** a partir del mapa 3 los barriles ya no pueden nacer más
arriba, porque la viga 5 es el techo jugable. La palanca "los barriles recorren
más pantalla" se agota en el mapa 2; de ahí en adelante la dificultad la llevan
la tabla (intervalo, velocidad, escaleras rotas) y el layout. Se acepta a cambio
de la fidelidad visual (Paco, 28-ago).

### Estructura de datos

```ts
export type Layout = {
  girders: Girder[];
  ladders: Ladder[];
  kong: { x: number; girder: number };
  trophy: { x: number; y: number };
  hammers: { x: number; girder: number }[];
  playerSpawn: { x: number; girder: number };
};

export const LAYOUTS: readonly Layout[];          // 5 entradas
export function layoutFor(level: number): Layout; // clamp en 5
```

**El layout 1 es el actual, sin tocar una coordenada** — está probado y jugado.
Los layouts 2-5 son variaciones del mismo esqueleto (6 vigas en zigzag): cambian
las posiciones de escaleras y martillos y la inclinación, no el número de vigas.
El layout 5 es el más hostil: escaleras más separadas y martillos lejos de la ruta.

### Invariantes de layout (tests obligatorios)

Hoy `level.test.ts` comprueba `TROPHY.y < GIRDERS[5].y0 + 40`, que **no verifica
que el trofeo sea alcanzable**. El margen real es `dyT = 53,14` contra un límite
de 60: **7 píxeles**. Con 5 layouts, mover una viga puede dejar el trofeo
inalcanzable y la suite seguiría verde. Cada layout debe pasar:

1. **Trofeo alcanzable a pie**: existe un tramo de la viga superior desde el que
   se cumple la condición de recogida (`|x − trophy.x| < 22` y `−34 < dy < 60`).
2. **Toda planta tiene salida**: cada viga tiene al menos una escalera hacia
   arriba, y sigue teniéndola con las escaleras rotas del mapa aplicadas.
3. **Kong tiene sitio**: su viga existe y su x cae dentro de ella.
4. **Martillos sobre vigas reales**, dentro de su rango x.
5. **El spawn del jugador** está en una viga existente y no encima del trofeo.

### `LEVEL_CONFIG`: de 10 a 5

`[barrelIntervalMs, barrelSpeed, ladderChance, brokenLadders]`, una fila por mapa.
Se reaprovechan valores ya probados de la tabla de 10, redistribuidos:

| Mapa | Intervalo | Velocidad | Prob. escalera | Escaleras rotas |
|---|---|---|---|---|
| 1 | 2600 | 110 | 0.20 | 0 |
| 2 | 2200 | 130 | 0.28 | 1 |
| 3 | 1850 | 160 | 0.36 | 2 |
| 4 | 1550 | 185 | 0.44 | 3 |
| 5 | 1250 | 208 | 0.52 | 3 |

El tiempo se queda en **90 s en los cinco** (Paco, 28-ago).

### Final y victoria

Al coger el trofeo en el mapa 5 no se llama a `startClear()` sino a un camino
nuevo de victoria: se suman los 1500 + bonus de tiempo como siempre y la partida
**termina**. La play-page distingue victoria de derrota y muestra un modal propio
(`¡LO HAS CONSEGUIDO!` + puntuación + guardar / jugar de nuevo / volver), frente
al `FIN DEL JUEGO` actual.

**Vidas**: 3 para todo el juego. Perderlas es game over y la siguiente partida
empieza en el mapa 1 con la puntuación a 0 (Paco, 28-ago).

---

## Acceptance criteria

1. Completar el mapa 1 lleva al mapa 2 **con una pantalla visiblemente distinta** y
   Kong una viga más arriba.
2. Los barriles del mapa 1 no aparecen por encima de la viga de Kong.
3. Coger el trofeo del mapa 5 muestra el modal de **victoria**, no el de game over,
   y la puntuación se puede guardar desde ahí.
4. Perder las 3 vidas en cualquier mapa muestra game over; "jugar de nuevo"
   arranca en el mapa 1 con 0 puntos.
5. Los 5 layouts pasan los 5 invariantes anteriores en test automático.
6. `npm test`, `npx tsc --noEmit` y `npm run build` limpios; sin regresiones en los
   109 tests existentes.
7. QA humano: los 5 mapas son jugables y ninguno tiene una ruta imposible.

---

## Decisions

- **Sí: 4 mapas + 5ª pantalla final** — el juego pasa a ser terminable; sustituye
  la decisión "endless" del spec 26. (Paco, 2026-08-28)
- **Sí: Kong trepa visiblemente** — arranca en la viga 4 y sube a la 5 y luego a
  dos cornisas propias por encima del escenario; en la pantalla final baja a
  defender el trofeo. Elegido sobre "empezar en la viga 2" por fidelidad a la
  estampa clásica, asumiendo que la dificultad por altura se agota en el mapa 2.
  (Paco, 2026-08-28)
- **Sí: el trofeo del mapa final está visible desde el principio** — lo que cambia
  es el mensaje y que termina el juego. (Paco, 2026-08-28)
- **Sí: modal de victoria propio** — ganar y morir no pueden verse igual.
  (Paco, 2026-08-28)
- **Sí: 3 vidas para todo el juego, game over vuelve al mapa 1** — arcade clásico;
  llegar al final tiene mérito y el Salón de la Fama significa algo.
  (Paco, 2026-08-28)
- **Sí: 90 s por mapa en los cinco** — la dificultad la llevan Kong y los barriles.
  (Paco, 2026-08-28)
- **Sí: los layouts los diseña Claude y Paco los valida en QA**, con tests de
  invariantes como red de seguridad. (Paco, 2026-08-28)
- **No: recargar vidas entre mapas** — descartado explícitamente.

---

## Riesgos identificados

1. **Dificultad real desconocida.** Con 3 vidas para 5 pantallas, y sabiendo que
   hoy ya cuesta pasar la primera, es posible que casi nadie vea el final. Solo se
   sabrá con QA humano. Si resulta imposible, la palanca más barata es el mapa 1.
2. **Los 7 píxeles de margen del trofeo.** Es el fallo más fácil de introducir al
   diseñar 4 layouts nuevos, y hoy ningún test lo cubre. Por eso el invariante 1
   es obligatorio y va antes de dibujar ningún layout.
3. **`brokenLadderSet` puede dejar una planta sin salida.** Su guarda actual está
   marcada como "inalcanzable con los datos actuales"; con 5 layouts y hasta 3
   escaleras rotas deja de serlo. El invariante 2 debe aplicarse **con las roturas
   puestas**, no solo sobre el layout limpio.
4. **`KONG_FOOT_Y` y el backdrop cacheado** se calculan hoy contra `GIRDERS[5]`.
   Al parametrizar hay que revisar cada uso; `rebuildLevel()` ya rehornea el
   backdrop, que es el punto de entrada natural.
5. **KongGame.tsx tiene 1396 líneas.** Este cambio lo hace crecer. Si al
   implementar se vuelve inmanejable, extraer el dibujo del backdrop a su módulo.
