# SPEC 30 — VAULT FIGHTER: MODO TORNEO (v1.5)

> **Estado:** Approved (leído por Paco + grill hecho, 2026-09-01)
> **Depende de:** 29-vault-fighter (motor de combate, roster, magias, escenarios y
> `GameOverModal`), 27-kong-v15 (precedente de cómo se estructura una v1.5 en este proyecto),
> 24-games-registry-credits-f2
> **Fecha:** 2026-09-01
> **Objetivo:** Segundo modo de juego para `vault-fighter`: un **cuadro de eliminatoria con los
> 8 luchadores seleccionables** (cuartos, semifinal y final) rematado por una **super final
> contra EL ARQUITECTO** en busca del cinturón negro, precedido por el **selector de modo** que
> la v1 no tiene.

---

## Alcance

**Dentro:**

- **Selector de modo**, pantalla nueva al entrar al juego: HISTORIA o TORNEO. Va delante de la
  de elegir luchador, que no cambia.
- **Módulo propio `tournament.ts`** en `components/games/fighter-logic/`, con su fichero de
  tests: cuadro de 8, emparejamientos, avance de ronda, y resolución de los combates que el
  jugador no disputa.
- **Resolución de los combates ajenos** por sorteo ponderado por `difficultyRank`, con la
  fuente de azar inyectada por parámetro (igual que el resto del motor), de modo que un cuadro
  completo se pueda fijar con semilla en los tests.
- **Super final contra EL ARQUITECTO** al ganar la final, en el NÚCLEO DEL VAULT.
- **Escenarios**: tres al azar de los siete primeros para cuartos, semifinal y final; el núcleo
  reservado a la super final.
- **Puntuación escalada** para que un torneo compita de tú a tú con una historia en la **misma**
  tabla de `vault-fighter`.
- **Pantalla de cuadro**, visible **al inicio de cada combate**: quién sigue vivo, quién ha
  caído y contra quién te toca. Avanza con un botón **CONTINUAR** bien visible, no sola.
- **Capa de modo** en `fighter-logic/mode.ts`: el componente deja de hablar con `story.ts` a
  pelo y pasa por una unión discriminada.
- **Cableado en `VaultFighterGame.tsx`**: la fase nueva del selector, la del cuadro, y el torneo
  como alternativa a la historia dentro del mismo bucle de combate.
- **Cambio de contrato**: `onBoutChange` pasa de mandar un número a mandar una **etiqueta**, y
  la play-page deja de importar nada de `story.ts`.
- **Textos del registro de juegos** que mencionen que hay dos modos.

**Fuera, y por qué:**

- **Multiplayer y 1 contra 1 humano.** Es el punto 8 del roadmap y llegará a los trece juegos a
  la vez; prepararlo aquí a mano sería adivinar. El cuadro se modela como el jugador contra
  siete CPU.
- **Persistencia del cuadro al recargar.** Se pierde, como en los otros doce juegos.
- **CONTINUE en el torneo.** Es una eliminatoria: perder es quedar eliminado.
- **Cinturón negro persistente** en el perfil. Aquí solo se celebra en la pantalla final;
  convertirlo en un rango tocaría perfil y base de datos, y sería su propio spec.
- **`story.ts` no se toca ni se generaliza.** El torneo es un módulo hermano sobre el mismo
  `combat.ts`.
- **El motor de combate no cambia** (`combat`, `techniques`, `magic`, `ai`, `stages`,
  `fighters`), salvo que un invariante existente obligue.
- **Ni luchadores, ni magias, ni escenarios nuevos.**

---

## Modelo de datos

Todo vive en `components/games/fighter-logic/tournament.ts`.

```ts
export const BRACKET_SIZE = 8;        // los 8 seleccionables, el jefe no entra
export const TOURNAMENT_BOUTS = 4;    // cuartos, semifinal, final, super final

export type TournamentRound = 'quarters' | 'semis' | 'final' | 'black-belt';
export type TournamentStatus = 'fighting' | 'champion' | 'eliminated';

export type TournamentState = {
  playerId: FighterId;
  round: TournamentRound;
  entrants: FighterId[];    // participantes de la ronda en curso: 8 → 4 → 2 → 1
  opponentId: FighterId;    // rival del jugador ahora; 'arquitecto' en la super final
  stageIds: string[];       // 3 escenarios sorteados + el núcleo al final
  status: TournamentStatus;
  score: number;
};
```

**Cómo avanza el cuadro.** `entrants` es la ronda en curso y los emparejamientos son los pares
consecutivos: `0-1`, `2-3`, `4-5`, `6-7`. Al ganar el jugador, los tres combates que no disputa
se resuelven por sorteo ponderado por `difficultyRank` y la lista se reduce a la mitad. Así el
cuadro entero es reproducible con una semilla y no hace falta guardar un árbol.

```ts
export function createTournament(
  roster: readonly FighterDef[], playerId: FighterId,
  stages: readonly StageDef[], rng: () => number,
): TournamentState;

export function currentOpponent(roster: readonly FighterDef[], t: TournamentState): FighterDef;
export function currentStage(stages: readonly StageDef[], t: TournamentState): StageDef;
export function currentDifficulty(t: TournamentState): number;   // 3,5,7,8 — ver abajo
export function boutLabel(t: TournamentState): string;           // CUARTOS/SEMIFINAL/FINAL/SUPER FINAL
export function winBout(roster: readonly FighterDef[], t: TournamentState, rng: () => number): void;
export function loseBout(t: TournamentState): void;              // → 'eliminated', sin CONTINUE
export function awardDamage(t: TournamentState, damage: number): void;
export function awardRound(t: TournamentState, perfect: boolean): void;
```

Mismo patrón que `story.ts`: todo por parámetro, mutación sin asignar, y **guarda de
precondición en las siete funciones que mutan** — la lección que costó dos rondas de arreglos
en la v1.

**El peso del sorteo, con número.** Los ocho `difficultyRank` van de 16,2 a 18,0: un 11 % de
diferencia entre el más flojo y el más fuerte. Ponderar por ese número directamente daría un
53 % al favorito, que es una moneda al aire. Hay que estirar el rango:

```
norm(f)   = (rank(f) − rankMínimo) / (rankMáximo − rankMínimo)   // 0..1 dentro del roster
peso(f)   = 1 + SPREAD × norm(f)                                  // SPREAD = 3
P(a gana) = peso(a) / (peso(a) + peso(b))
```

Con `SPREAD = 3` el más fuerte gana al más flojo el **80 %** de las veces y dos vecinos quedan
en 55/45: se nota la jerarquía y las sorpresas siguen pasando. El mínimo y el máximo se calculan
**del roster recibido**, nunca a mano, así que si algún día cambian las características el
sorteo se reajusta solo.

**La dificultad recorre el rango ENTERO: 3, 5, 7 y 8.** No 1..4. La dificultad alimenta el
perfil de la IA, y la historia va de 1 a 8; si el torneo se quedara en 1..4, la super final
contra EL ARQUITECTO sería *más blanda* que la de la historia y el modo entero resultaría más
fácil, justo lo contrario del criterio 14. Con 3-5-7-8 empieza por encima de donde empieza la
historia, sube más rápido y remata en el mismo 8.

**La capa de modo**, en `components/games/fighter-logic/mode.ts`:

```ts
export type GameMode =
  | { kind: 'story'; state: StoryState }
  | { kind: 'tournament'; state: TournamentState };

export function modeOpponent(roster: readonly FighterDef[], m: GameMode): FighterDef;
export function modeStage(stages: readonly StageDef[], m: GameMode): StageDef;
export function modeDifficulty(m: GameMode): number;
export function modeScore(m: GameMode): number;
export function modeStatus(m: GameMode): 'fighting' | 'continue' | 'champion' | 'eliminated';
export function modeBoutLabel(m: GameMode): string;
export function modeWinBout(roster: readonly FighterDef[], m: GameMode, rng: () => number): void;
export function modeLoseBout(m: GameMode): void;
export function modeAwardDamage(m: GameMode, damage: number): void;
export function modeAwardRound(m: GameMode, perfect: boolean): void;
```

**El CONTINUE deja de ser un caso especial.** Hoy el componente llama a `tickContinue` porque
sabe que está en historia. Con la capa, `modeLoseBout` deja el estado en `'continue'` si es
historia y en `'eliminated'` si es torneo, y **el componente solo reacciona al estado**: la fase
de CONTINUE no se alcanza nunca en torneo porque ningún modo la produce. Cero ramas por modo.

**Hallazgo del grill — código muerto que se borra.** `VaultFighterGame.tsx:933` tiene
`story.bout === BOUTS - 1 ? BOSS : currentOpponent(...)`, pero `createStory` ya mete al jefe al
final de `order` y `currentOpponent` solo lee `order[bout]`. El ternario es redundante: se
borra, no se migra.

**Cambio de contrato del HUD.** `onBoutChange(bout: number)` pasa a `onBoutChange(label: string)`.
El modo produce el texto — `COMBATE 03/08` en historia, `CUARTOS`/`SEMIFINAL`/`FINAL`/
`SUPER FINAL` en torneo — y la play-page solo lo escribe, dejando de importar `BOUTS` de
`story.ts`. Las etiquetas siguen precalculadas, así que no se asigna por frame.

**Puntuación escalada.** La historia son 8 combates y remata con el jefe; el torneo son 4. El
torneo duplica los valores por combate, por asalto y por daño, y el cinturón negro vale lo mismo
que el jefe:

| | Historia | Torneo |
|---|---|---|
| Por combate | 8 000 | **16 000** |
| Por asalto ganado | 2 000 | **4 000** |
| Asalto perfecto | 1 000 | **2 000** |
| Por punto de daño | 10 | **20** |
| Remate final | 20 000 (jefe) | **20 000** (cinturón negro) |

La equivalencia es **aritmética, no aproximada**: al duplicar todos los valores y partir por dos
el número de combates, cada término se compensa. Por combate en historia son 8 000 + unos 6 000
de los tres asaltos + unos 3 000 del daño ≈ 17 000; ocho combates ≈ 136 000 más 20 000 del jefe.
En torneo, 34 000 por combate × 4 = 136 000 más 20 000. Una sola tabla y ninguno de los dos modos
queda fuera.

---

## Plan de implementación

**1. `tournament.ts` — el cuadro, con su red de invariantes.**
El módulo puro: `createTournament`, el avance `8 → 4 → 2 → 1`, el sorteo ponderado por
dificultad con la fuente de azar inyectada, y la super final. Sin escenarios ni puntuación
todavía. Invariantes con test negativo cada uno: el cuadro son exactamente los 8 seleccionables,
el jugador siempre está dentro, nadie aparece dos veces, cada ronda reduce a la mitad, el jefe
**nunca** está en el cuadro y **siempre** es el rival de la super final. Con semilla fija, un
cuadro completo es reproducible.

**2. Escenarios y dificultad.**
`currentStage`: tres sorteados de los siete primeros para cuartos, semifinal y final, y el
núcleo reservado a la super final. `currentDifficulty` devolviendo **3, 5, 7 y 8**, que alimenta
el perfil de la IA. Test de que los tres sorteados no se repiten, de que el cuarto es siempre el
núcleo, y de que la super final del torneo tiene la misma dificultad que la del jefe en historia.

**3. Puntuación del torneo.**
Las constantes propias de la tabla de arriba, `awardDamage` y `awardRound`, y **guarda de
precondición en las siete funciones que mutan**, sin excepciones. Test de que el techo del
torneo y el de la historia coinciden.

**4. Refactor: `mode.ts` y el componente dejando de hablar con `story.ts` a pelo.**
La unión discriminada y sus funciones, y el componente pasando por ellas. Aquí se borra el
ternario muerto del jefe y se cambia `onBoutChange` a etiqueta. **Sin cambiar ni un
comportamiento**: la historia tiene que seguir jugándose exactamente igual, CONTINUE incluido.
Se verifica con el build, leyendo el diff y jugando.

**5. Funcionalidad: selector de modo y torneo enchufado.**
La fase nueva `mode-select` delante de la de elegir luchador —cruceta para moverse y A para
confirmar, igual que la de luchador— y el torneo conectado a la capa del paso 4. También el fin
de partida: eliminado directo sin CONTINUE, la pantalla de CAMPEÓN celebrando el cinturón negro,
y volver a jugar devolviendo al **selector de modo**.

**6. La pantalla de cuadro.**
Se muestra **al inicio de cada combate** del torneo: los 8 participantes, quién sigue vivo,
quién ha caído y contra quién te toca ahora. **Espera a que el jugador pulse**, con un botón
CONTINUAR bien visible — no avanza sola. Reutiliza las paletas y los nombres que ya existen.
Sin asignar memoria por frame, como todo lo que se dibuja.

**7. Registro, textos y cierre.**
Las instrucciones del juego mencionan los dos modos. `verify-plan` sobre el spec entero y QA
humano: que el cuadro se sienta distinto de la historia, que la super final se note como el
momento gordo, y que las puntuaciones de los dos modos convivan en la tabla.

---

## Criterios de aceptación

1. **Al entrar al juego aparece un selector con HISTORIA y TORNEO**, y elegir HISTORIA lleva a
   la partida de la v1 **sin ningún cambio de comportamiento**.
2. **El cuadro lo forman exactamente los 8 seleccionables**, el jugador incluido, sin repetidos,
   y EL ARQUITECTO no aparece en él.
3. **Cada ronda reduce los participantes a la mitad**: 8 → 4 → 2 → 1.
4. **Los combates que el jugador no disputa se resuelven por sorteo ponderado por
   `difficultyRank`**, y con la misma semilla sale el mismo cuadro completo.
5. **El jugador disputa exactamente 4 combates**: cuartos, semifinal, final y super final.
6. **La super final es siempre contra EL ARQUITECTO y siempre en el NÚCLEO DEL VAULT.**
7. **Los otros tres escenarios salen de los siete primeros y no se repiten entre sí** dentro de
   un mismo torneo.
8. **Cada combate es al mejor de 5 asaltos**, igual que en la historia.
9. **Perder cualquier combate del torneo da ELIMINADO de inmediato**, sin cuenta atrás y sin
   CONTINUE.
10. **Ganar la super final da CAMPEÓN** celebrando el cinturón negro.
11. **Un torneo perfecto y una historia perfecta puntúan ambos 84 000**, y las dos partidas se
    guardan en la misma tabla de `vault-fighter`.
12. **`story.ts` no ha cambiado** y el motor de combate (`combat`, `techniques`, `magic`, `ai`,
    `stages`, `fighters`) tampoco: sus diffs están vacíos.
13. **La dificultad del torneo es 3, 5, 7 y 8**, y la super final tiene la misma dificultad que
    el jefe de la historia.
14. **El sorteo ponderado usa el rango normalizado con `SPREAD = 3`**: el más fuerte gana al más
    flojo en torno al 80 % de las veces, no al 53 %.
15. **Al inicio de cada combate del torneo se ve el cuadro** con los 8, quién vive y quién ha
    caído, y **espera a que el jugador pulse CONTINUAR**.
16. **`onBoutChange` manda una etiqueta**, en torneo `CUARTOS`/`SEMIFINAL`/`FINAL`/`SUPER FINAL`,
    y la play-page no importa nada de `story.ts`.
17. **Volver a jugar desde el final devuelve al selector de modo**, no al modo recién jugado.
18. **La suite sigue verde y no baja de los 404 tests** de partida.
19. **QA humano:** el torneo se siente más corto y más duro que la historia, la super final se
    nota como el momento gordo, y el cuadro da ganas de seguir.

---

## Decisiones tomadas y descartadas

- **Sí: el cuadro son los 8 luchadores seleccionables y el jefe no entra.** Un cuadro de 8
  encaja exacto con el roster jugable, y meter a EL ARQUITECTO con sus 22 de características
  contra 15 desequilibraría la rama que le tocase. (Paco, 2026-09-01)
- **Sí: super final contra EL ARQUITECTO al ganar la final, "en busca del cinturón negro".**
  Recupera al mejor personaje del juego sin desbalancear el cuadro, y le da al torneo un remate
  propio. (Paco, 2026-09-01)
- **Sí: los combates que el jugador no disputa se resuelven por sorteo ponderado por
  dificultad.** Descartado el determinista por `difficultyRank` (sabrías el cuadro entero de
  antemano) y descartado simular los combates de verdad con la IA (caro, lento y nadie lo ve).
  (Paco, 2026-09-01)
- **Sí: una sola tabla de puntuación, con los valores del torneo duplicados.** Los dos modos
  rematan en 84 000, así que ninguno queda fuera de la tabla. Descartado no puntuar el torneo
  (lo dejaría en modo de práctica) y descartadas tablas separadas (tocaría base de datos y
  registro, y se sale del alcance barato). (Paco, 2026-09-01)
- **Sí: perder es quedar eliminado, sin CONTINUE.** Es una eliminatoria, y son 4 combates en vez
  de 8, así que repetir no duele como en la historia. De paso el módulo no hereda la cuenta
  atrás. (Paco, 2026-09-01)
- **Sí: el cuadro se pierde al recargar**, como en los otros doce juegos. (Paco, 2026-09-01)
- **Sí: al mejor de 5 asaltos, igual que la historia.** El torneo se acorta por número de
  combates, no cambiando cómo se siente el combate — que es lo único validado jugando.
  Descartado el mejor de 3. (Paco, 2026-09-01)
- **Sí: tres escenarios sorteados de los siete primeros, y el núcleo reservado a la super
  final.** Corrección de la propia conversación: los combates son cuatro y el último es el
  núcleo, así que los sorteados son **tres**, no cuatro. (2026-09-01)
- **Sí: el cinturón negro solo se celebra en la pantalla final.** Descartado que persista como
  rango o insignia en el perfil: tocaría perfil y base de datos y merecería su propio spec.
  (Paco, 2026-09-01)
- **No: no se prepara el terreno para el multiplayer.** Llegará a los trece juegos a la vez, en
  el punto 8 del roadmap, así que adelantarlo aquí sería adivinar la forma equivocada. El cuadro
  se modela como el jugador contra siete CPU y este módulo se revisará entonces igual que los
  demás. (Paco, 2026-09-01)
- **Sí: `story.ts` no se toca ni se generaliza.** El torneo es un módulo hermano sobre el mismo
  `combat.ts`, decidido ya en el grill de la v1. (Paco, 2026-09-01)
- **Sí: el refactor de la capa de modo (paso 4) va separado de enchufar el torneo (paso 5).**
  Cuesta un paso más y evita no saber cuál de los dos rompió qué. (Paco, 2026-09-01)
- **Sí: capa de modo como unión discriminada en `mode.ts`.** Descartado un objeto con métodos
  creado al vuelo (asignaría por frame) y descartado mantener dos caminos paralelos en el
  componente (garantiza romper la historia en el paso 5 sin que nadie lo vea). El CONTINUE deja
  de ser un caso especial: el componente reacciona al estado y ningún modo produce `'continue'`
  salvo la historia. (grill, 2026-09-01)
- **Sí: la dificultad del torneo recorre el rango entero (3, 5, 7, 8), no 1..4.** Con 1..4 la
  super final habría sido más blanda que la de la historia y el torneo entero más fácil, justo
  lo contrario de su identidad. (Paco, grill, 2026-09-01)
- **Sí: `SPREAD = 3` sobre el rango normalizado.** Los `difficultyRank` solo se separan un 11 %,
  así que ponderar directo daba un 53 % al favorito — una moneda al aire. (Paco, grill, 2026-09-01)
- **Sí: `onBoutChange` pasa a mandar una etiqueta.** En un cuadro las rondas tienen nombre, y
  "SEMIFINAL" dice más que "COMBATE 02/04". De paso la play-page deja de importar `BOUTS` de
  `story.ts`, que era una fuga del modo historia hacia la página. (Paco, grill, 2026-09-01)
- **Sí: pantalla de cuadro al inicio de CADA combate, con botón CONTINUAR.** Se nos pasó al
  escribir el spec: sin ella, el sorteo ponderado y todo el cuadro son trabajo que el jugador no
  ve nunca — el mismo fallo que las magias invisibles de la v1. Espera pulsación en vez de
  avanzar sola, para poder mirar quién ha caído. (Paco, grill, 2026-09-01)
- **Sí: volver a jugar devuelve al selector de modo.** Si te encierra en el modo que acabas de
  jugar, mucha gente no descubrirá el otro. (Paco, grill, 2026-09-01)
- **Sí: el selector de modo usa cruceta y A**, igual que el de luchador. (Paco, grill, 2026-09-01)
- **Sí: aceptar que el cuadro te cruce pronto con el más duro.** El examen final es fijo — la
  super final es siempre contra EL ARQUITECTO —, así que el orden del cuadro no decide la
  dificultad real del modo. (Paco, grill, 2026-09-01)
- **Sí: queda abierta la puerta a `grill-me` durante la implementación.** Si al implementar
  aparece algo no previsto, se analiza con esa herramienta en vez de reabrir el spec entero.
  (Paco, 2026-09-01)

---

## Riesgos identificados

1. **El refactor del paso 4 puede romper la historia sin que ningún test lo vea.**
   `VaultFighterGame.tsx` no tiene pruebas unitarias — es canvas y bucle de animación —, así que
   meter la capa de modo por debajo de un modo que ya funciona se verifica con el build, con la
   lectura del diff y jugando. Es el riesgo más probable de todo el spec, y por eso el criterio
   1 exige que la historia siga exactamente igual.
2. **El cuadro puede salir aburrido o injusto y solo se sabe jugando.** Un sorteo ponderado
   puede emparejarte en cuartos con el rival más duro y dejarte una final floja. Ningún test lo
   cubre: los invariantes garantizan que el cuadro es *legal*, no que sea *divertido*.
3. **La equivalencia de puntuación es sólida, pero depende de que los combates duren lo
   parecido.** La cuenta cuadra término a término —duplicar los valores y partir por dos los
   combates se compensa exactamente—, pero un torneo con rivales de dificultad 3 a 8 tendrá
   peleas algo más largas que los primeros combates de una historia, así que acumulará algo más
   de daño. Si al jugar un modo domina la tabla, se ajusta con los mismos números: están todos
   en constantes.
4. **El torneo puede canibalizar a la historia.** Cuatro combates contra ocho, sin CONTINUE y
   con el jefe al final: puede que nadie vuelva a jugar el modo largo. No es un fallo, es
   información.
5. **El componente crece otra vez.** Ya pasa de las 1 500 líneas y este spec le añade dos fases
   (selector de modo y cuadro) y una capa de modo. Si al implementar se ve que la capa de modo se está llenando
   de reglas, esas reglas van a `fighter-logic`, no al `.tsx`.
