# SPEC 29 — VAULT FIGHTER

> **Estado:** Approved (grill hecho con Paco, 2026-09-01)
> **Depende de:** 25-karate-champ (motor de combate del que hereda), 24-games-registry-credits-f2,
> 27-kong-v15 (`GameOverModal` compartido), 28-bubble
> **Fecha:** 2026-09-01
> **Objetivo:** Juego nº13 con id `vault-fighter`, segunda entrada de la categoría FIGHTING:
> ocho luchadores propios del Vault, cada uno con sus características y su magia, que se
> enfrentan en combates al mejor de cinco asaltos. **v1: modo historia** (los 7 rivales más un
> jefe final no seleccionable) con ocho fondos; el **modo torneo va a la v1.5**.

---

## Contexto: en qué se diferencia de Karate Champ

Ya existe un juego FIGHTING en el catálogo (spec 25). Si Vault Fighter fuese "otro juego de
pelea" se sentiría repetido, así que las diferencias son deliberadas y estructurales:

| | Karate Champ | Vault Fighter |
|---|---|---|
| Cómo se gana | **puntos** por técnica limpia | **barras de vida**, al mejor de 5 asaltos |
| Rival | uno, escalado por nivel | **eliges 1 de 8**, y peleas contra los demás |
| Progresión | niveles sucesivos | **historia** con jefe final (y torneo en v1.5) |
| Recurso propio | — | **magia por luchador**, con barra que se carga peleando |
| Defensa | esquiva pasiva (retroceder) | **bloqueo y agacharse** explícitos |

Lo que **sí** hereda, porque está probado y funciona: el esquema de entrada de 8 técnicas
(botón + dirección), la idea de bloqueo por altura y la estructura de `karate-logic/`.

---

## Scope

**In:**

- `bubble`-style: lógica pura en `components/games/fighter-logic/` con tests.
- **Motor de combate**: 8 técnicas (A/B × 4 direcciones) con **daño** en vez de puntos,
  **bloqueo** (← mantenido) y **agacharse** (↓ mantenido).
- **8 luchadores** con `fuerza`, `velocidad`, `alcance` y una magia cada uno.
- **Barra de magia** que se carga dando y recibiendo golpes; se lanza con un **tercer botón**.
- **Combates al mejor de 5 asaltos** (gana quien se lleve 3).
- **Modo historia**: eliges 1 de 8 → los otros 7 → **jefe final** (9º personaje, no seleccionable).
  8 combates, 8 fondos.
- **Pantalla de selección de luchador**.
- **CONTINUE arcade** al perder un combate: cuenta atrás y, si se acepta, se repite ESE combate.
- **8 fondos**, uno por pantalla.
- Final: **CAMPEÓN** al ganar, **ELIMINADO** al caer — reutilizando `components/GameOverModal.tsx`.
- Entrada nº13 en el registro, migración `games`, cover PNG ya existente, música propia.

**Out (v1.5, decidido en el grill):**

- **Modo torneo** (cuadro de 8: cuartos, semifinal, final) y **selector de modo**. Comparte el
  100 % del motor de combate, así que es lo más barato de añadir encima y lo que menos se echa
  en falta; a cambio, adelanta el QA de equilibrio, que es el riesgo alto de este juego.

**Out (fuera del juego):**

- Multijugador local o en red (es el punto 8 del roadmap, aparte).
- Combos encadenados y cancelaciones. La profundidad la dan las técnicas y las magias.
- Animaciones por luchador: los 8 comparten esqueleto y se distinguen por color, paleta
  y proporciones, no por animaciones propias.
- Historias o finales narrativos por personaje.

---

## Diseño

### El combate

Hereda el esquema de entrada de Karate Champ, que ya está probado y cabe en el mando móvil
(solo hay A, B y cruceta):

| Entrada | Técnica | Altura | Notas |
|---|---|---|---|
| A | Patada frontal | media | rápida |
| ↑+A | Patada alta | alta | lenta, más alcance |
| ↓+A | Barrido | baja | derriba, corto alcance |
| →+A | Patada voladora | alta | avanza, la más lenta |
| B | Puñetazo | media | la más rápida, corto alcance |
| ↑+B | Golpe alto | alta | lento |
| ↓+B | Puñetazo bajo | baja | rápido |
| →+B | Golpe con salto | media | avanza |

**Novedades respecto a Karate Champ:**
- **← mantenido = bloquear.** Bloquear anula el daño de las técnicas de su altura y reduce el
  resto. No se puede atacar mientras se bloquea.
- **↓ mantenido = agacharse.** Esquiva las técnicas altas; deja expuesto a las bajas.
- Cada técnica **quita vida** en función de la `fuerza` del atacante y del `alcance` al que
  conecte, en vez de sumar puntos.

### Los 8 luchadores

Tres números por luchador (1-10) más su magia:

| # | Luchador | Fuerza | Velocidad | Alcance | Σ | Magia |
|---|---|---|---|---|---|---|
| 1 | **NOVA** | 5 | 5 | 5 | 15 | Destello — aturde brevemente |
| 2 | **TORRE** | 9 | 2 | 4 | 15 | Muro — absorbe el próximo golpe |
| 3 | **GLITCH** | 3 | 9 | 3 | 15 | Salto de fase — reaparece a la espalda |
| 4 | **VOLTIO** | 4 | 8 | 3 | 15 | Descarga — proyectil rápido |
| 5 | **ÓXIDO** | 7 | 4 | 4 | 15 | Corrosión — daño sostenido |
| 6 | **ECO** | 3 | 3 | 9 | 15 | Onda — empuja y aparta |
| 7 | **PÍXEL** | 4 | 7 | 4 | 15 | Duplicado — un golpe fantasma extra |
| 8 | **BRECHA** | 8 | 3 | 4 | 15 | Sísmico — golpe de área que no se bloquea |
| — | **EL ARQUITECTO** (jefe) | 8 | 7 | 7 | 22 | Reinicio — restaura parte de su vida |

**Los ocho suman exactamente 15** (decidido en el grill). Elegir luchador es siempre un
intercambio, nunca un error: no hay ninguno objetivamente peor. **Es un invariante con test**
—igual que los de Kong y Bubble—, así que es imposible publicar un luchador desequilibrado sin
que salte la suite. El jefe está **exento y documentado**: debe ser superior.

> La primera versión de esta tabla NO cumplía la regla (PÍXEL sumaba 12 y ECO 18). Lo detectó
> el grill sumando las columnas: uno de los luchadores no era distinto, era peor.

El jefe se llama así por coherencia con el rango máximo del Vault (`MAESTRO DEL VAULT`,
`lib/credits.ts`): es quien guarda el sistema.

### Las 9 magias: cuatro mecánicas, nueve caras

**Decisión de ingeniería, validada en el grill.** Ocho magias distintas serían ocho subsistemas. En
Bubble se resolvió reduciendo su número; aquí no se puede, porque cada luchador tiene la suya.
La alternativa es que las nueve sean **variantes de cuatro mecánicas** ya implementadas una vez:

| Mecánica | Magias que la usan | Qué cambia entre ellas |
|---|---|---|
| **Proyectil** | Descarga (VOLTIO), Onda (ECO) | velocidad, daño y si empuja |
| **Golpe de área** | Sísmico (BRECHA), Duplicado (PÍXEL) | radio, si es bloqueable |
| **Estado propio** | Muro (TORRE), Reinicio (ARQUITECTO) | absorber vs restaurar |
| **Estado del rival** | Destello (NOVA), Corrosión (ÓXIDO), Salto de fase (GLITCH) | aturdir, daño en el tiempo, reposicionar |

Coste real: **4 mecánicas + 9 tablas de parámetros**, no 9 sistemas. El jugador percibe nueve
magias distintas; el código mantiene cuatro caminos.

### Barra de magia

Se carga **dando y recibiendo** golpes (recibir carga menos que dar, para que no premie
encajar). Se vacía al usarla y **se reinicia en cada asalto**.

**Cómo se lanza (decidido en el grill):** con un **tercer botón**, no con A+B. El tipo
`TouchControls` ya tiene `a?` y `b?` opcionales, así que añadir un `c?` es **aditivo y no toca
los otros 12 juegos**. El botón aparece **apagado** y se **enciende** al llenarse la barra: le
enseña al jugador cuándo puede usarla sin explicar nada — que es justo lo que le faltaba a Kong
con su meta. En teclado, tecla propia.

### Los dos modos

**Historia** — eliges luchador, peleas contra los otros 7 en orden de dificultad creciente y
cierras contra EL ARQUITECTO. **8 combates, 8 fondos**, uno por combate.

**Torneo** — va a la **v1.5**: cuadro de eliminatoria de 8 (cuartos, semifinal, final).

**Al perder (decidido en el grill): CONTINUE arcade.** Perder un combate saca la cuenta atrás
clásica; aceptar repite **ese** combate, rechazar da **ELIMINADO**. Motivo: una partida son
8 combates al mejor de 5 asaltos, entre 15 y 25 minutos. Mandar al jugador al principio tras
perder el séptimo —como sí hace Kong, que dura 7 minutos— haría que nadie llegase al jefe.
Ganar el octavo → **CAMPEÓN**. Ambos finales usan `GameOverModal`
(`variant="victory"` / `"defeat"`).

### Los 8 fondos

Ocho escenarios del Vault, horneados como los fondos de Kong (canvas fuera de pantalla, se
rehornean solo al cambiar de combate). Se distinguen por paleta y silueta, no por detalle.

---

## Data model

- **Migración `games`**: fila `vault-fighter` (`cat: 'FIGHTING'`, `cover: '/covers/vault-fighter.png'`).
  El PNG **ya está** en el repo, así que el INSERT lo lleva directo, sin cover CSS provisional
  ni UPDATE posterior.
- **Color**: `red` lo sugería el planner pero ya lo usan `kong` y `road-fighter`.
  **CORREGIDO 01-sep tras verificar**: en el spec dije que `silver` y `bronze` estaban libres,
  y era FALSO — miré las variables CSS de `globals.css`, no la unión de tipos. La unión real de
  `GameRow.color` (`lib/supabase/types.ts:8`) es
  `'cyan' | 'magenta' | 'yellow' | 'green' | 'blue' | 'red' | 'gold'`: **`silver` no existe**.
  **Solución**: añadir `'silver'` a esa unión — cambio de UNA línea, aditivo, sin romper nada.
  Verificado por MCP que la tabla `games` **no tiene ningún CHECK constraint**, así que la base
  de datos acepta el valor nuevo sin migración adicional.
- **Registro** (`lib/games-registry.ts`): entrada nº13, skins classic/retro/neon, keyMap
  `{up, down, left, right, a, b}` con `a: 'PATADA'`, `b: 'PUÑO'`, `realtime: true`.
  **`lib/games-registry.test.ts` lleva a mano TRES listas** que hay que actualizar en el mismo
  commit o la suite se pone roja: los ids (línea 8), los juegos realtime (línea 54) y
  **`KEYMAP_SLOTS` (línea 4), que hoy solo admite `up/down/left/right/a/b`** — el tercer botón
  `c` de la magia la rompe. Son los ÚNICOS tres cambios de expectativa autorizados en este
  trabajo; cualquier otro test que falle se investiga, no se ajusta.

- **Assets: YA ESTÁN todos** (01-sep, verificado). `public/covers/vault-fighter.png` (renombrado
  desde `vaultfighter.png` a la convención `covers/<id>.png`) y **CUATRO pistas de música**:
  `public/vault-fighter-theme-1.mp3` … `-4.mp3`. El INSERT lleva el PNG directo, sin cover CSS
  provisional ni migración UPDATE.

### Música: cuatro pistas, elegidas al azar

**Requisito nuevo de Paco (01-sep)**: este juego no tiene una pista fija como los demás, sino
**cuatro**, y se elige **una al azar** para que no suene siempre la misma. Los otros doce juegos
usan `setTrackOverride('/x-theme.mp3')` con una sola pista; aquí el patrón se extiende.

**Dos cuidados obligatorios al implementarlo:**
1. **El sorteo va DENTRO del `useEffect`, nunca en el cuerpo del render.** `Math.random()` en
   render da un valor distinto en servidor y cliente y rompe la hidratación de React.
2. **Una sola pista por partida**, no una por render ni por combate: elegirla al montar y
   mantenerla. Cambiar de canción en mitad de un combate es peor que repetir siempre la misma.

---

## Acceptance criteria

1. Se puede elegir modo y luchador, y el luchador elegido no aparece como rival.
2. Un combate lo gana quien se lleva **3 de 5 asaltos**; el marcador de asaltos es visible.
3. **Bloquear** anula el daño de las técnicas de su altura; **agacharse** esquiva las altas.
4. La barra de magia se carga peleando, se lanza con el **tercer botón** —que está apagado
   hasta que se llena—, se vacía al usarla y **se reinicia en cada asalto**.
5. Las 9 magias hacen lo que dice su tabla, y las 8 de los luchadores son alcanzables jugando.
6. **Modo historia**: 8 combates contra los 7 rivales y el jefe, cada uno con un fondo distinto.
7. Ganar el octavo combate da **CAMPEÓN**, con `GameOverModal`.
8. Perder un combate saca el **CONTINUE** con cuenta atrás: aceptar repite ese combate,
   rechazar da **ELIMINADO**.
9. **Invariantes de luchador con test** (patrón de Kong y Bubble):
   **a) los 8 luchadores suman EXACTAMENTE 15** (el jefe exento y documentado);
   b) ninguna característica fuera de 1-10; c) ninguna magia sin su mecánica;
   d) los 8 fondos existen y son distintos entre sí.
10. `npm test`, `npx tsc --noEmit` y `npm run build` limpios; sin regresiones en los 222 tests.
11. QA humano: los 8 luchadores se sienten distintos y las magias se entienden sin leer.

---

## Decisions

- **Sí: 8 luchadores propios del Vault, no personajes del original** — coherente con la
  decisión del spec 26 (trofeo del Vault en vez de personajes de terceros). (Paco, 2026-09-01)
- **Sí: el juego se llama VAULT FIGHTER**, id `vault-fighter` — nombre propio, como KONG.
  (Paco, 2026-09-01)
- **Sí: v1 solo el modo historia; el torneo va a la v1.5** — revisado en el grill al ver el
  tamaño real. El torneo comparte el 100 % del motor, es lo más barato de añadir después y
  adelanta el QA de equilibrio, que es el riesgo alto. (Paco, 2026-09-01)
- **Sí: combates al mejor de 5 asaltos.** (Paco, 2026-09-01)
- **Sí: jefe final como 9º personaje no seleccionable.** (Paco, 2026-09-01)
- **Sí: hereda el esquema de 8 técnicas de Karate Champ y añade bloqueo y agacharse.**
  (Paco, 2026-09-01)
- **Sí: barra de magia que se carga peleando**, frente a una vez por asalto o por vida baja.
  (Paco, 2026-09-01)
- **Sí: la magia se lanza con un TERCER BOTÓN opcional (`c?`)**, no con A+B — aditivo, no toca
  los otros 12 juegos, y encendiéndose al cargarse enseña al jugador cuándo puede usarla.
  (Paco, 2026-09-01)
- **Sí: los 8 luchadores suman exactamente 15**, con invariante que lo vigila. Elegir es un
  intercambio, nunca un error. (Paco, 2026-09-01)
- **Sí: CONTINUE arcade al perder**, no vuelta al principio como Kong — una partida son 15-25
  minutos y repetirla entera tras el séptimo combate haría que nadie viese al jefe.
  (Paco, 2026-09-01)
- **Sí: color `silver`** (el `red` del planner ya lo usan kong y road-fighter). (Paco, 2026-09-01)
- **Sí: fuerza, velocidad y alcance** diferencian a los luchadores, además de su magia.
  (Paco, 2026-09-01)
- **Sí: las 9 magias son variantes de 4 mecánicas**, no 9 subsistemas. (Paco, 2026-09-01)
- Nombres y números de los 9 luchadores: **aprobados en el grill**, sujetos a ajuste fino en QA.

---

## Riesgos identificados

1. **Sigue siendo el juego más grande del proyecto**, aun sacando el torneo: 9 luchadores,
   9 magias, 8 fondos, motor de combate nuevo y pantalla de selección. Kong v1.5 fueron
   8 tareas y Bubble 10; esto está en ese orden o por encima.
2. **El equilibrio no lo puede verificar ningún test.** Los invariantes evitan lo imposible,
   pero que ocho luchadores resulten *divertidos y equilibrados* solo se sabe jugando. Es el
   riesgo de producto más alto: reservar QA de sobra.
3. ~~A+B en móvil~~ — **resuelto en el grill**: la magia va a un tercer botón opcional (`c?`).
   Riesgo residual: es el **primer juego que añade un botón al mando táctil compartido**, así
   que hay que comprobar que los otros 12 siguen viéndose igual (el campo es opcional, pero el
   layout del gamepad cambia si no se maneja bien).
4. **Parecido con Karate Champ.** Comparten esquema de entrada; si además se sintieran igual
   al jugar, sobraría uno de los dos. Las barras de vida, las magias y el torneo deberían
   bastar, pero es lo primero que hay que mirar en el QA.
5. **La IA del rival** ~~es un riesgo alto~~ — **rebajado tras explorar el código**:
   `karate-logic/ai.ts` son **65 líneas** con `opponentFor(level)` y `decide(level, ctx, rng)`.
   Cambiar "nivel" por "perfil de luchador" es el mismo tipo de refactor que inyectar el layout
   en Kong: acotado y con tests. Riesgo medio-bajo.
