# Notas de diseño — Kong v1.5 y Bubble (dictadas por Paco, 2026-08-28)

## Kong v1.5 — de endless a juego con FINAL

**CAMBIO IMPORTANTE respecto a lo acordado el 27-ago**: Kong deja de ser endless.
Antes: layouts rotan y los niveles escalan sin fin (LEVEL_CONFIG con clamp en 10).
Ahora: el juego TERMINA. Hay una pantalla final.

### Estructura
- **4 mapas jugables**, cada uno un poco más difícil que el anterior.
- Al completar un mapa (llegar al trofeo), **Kong sube una escalera más** y cambia el mapa.
- Se repite 4 veces.
- **Kong TREPA VISIBLEMENTE** (decidido 28-ago): en cada mapa Kong se dibuja una
  viga mas arriba. La progresion se VE sin leer nada. Implica reservarle sitio
  en la parte alta de los 4 layouts.
- **5ª pantalla = final**: Kong ya no sube mas. Aparece el mensaje
  "para matarme localiza el trofeo". El **trofeo esta VISIBLE desde el principio**
  (decidido 28-ago): lo que cambia es el mensaje y que al cogerlo **termina el
  juego con VICTORIA** en vez de pasar de nivel.
  -> OJO redaccion: "localiza el trofeo" chirria si esta a la vista; afinar el
     texto en el spec (o dar a esa pantalla un layout que lo haga costoso de
     alcanzar, que es donde vive la dificultad final).

### Final = VICTORIA, no derrota (confirmado 28-ago)

### Consecuencias técnicas a estudiar
- `LEVEL_CONFIG` (10 entradas con clamp) deja de tener sentido tal cual: ahora son 4 + final.
- `level.ts` expone `GIRDERS`/`LADDERS` como constantes únicas → array de layouts + `layoutFor(level)`.
- `brokenLadderSet` y los tests de `level.test.ts` asumen un único layout → generalizar.
- El minor diferido de `brokenLadderSet` ("guarda inalcanzable, re-verificar si
  brokenLadders sube de 3") deja de ser inalcanzable → es precondición.
- **Falta un test de alcanzabilidad del trofeo** por layout: hoy el margen es
  dyT=53,14 contra un límite de 60 (7 px). Con 4+1 layouts, mover una viga
  puede dejar el trofeo inalcanzable y la suite seguiría verde.
- KongGame ya rehornea el backdrop cacheado en cada `rebuildLevel` → el cambio
  de pantalla entra por ahí.

## Bubble (punto 4 del roadmap, spec 27)
- **DECIDIDO (28-ago)**: es **Puzzle Bobble / Bust-a-Move** — cuadricula de burbujas,
  disparo con angulo, agrupar por color. NO es Bubble Bobble (plataformas).
  Referencia visual aportada por Paco: HUD lateral con fase / puntos / record,
  cuadricula superior de bolas rojas-azules-amarillas, canon con bola actual + siguiente.
- **Maximo 8 mapas**, cada uno con mas dificultad. Al terminar los 8 -> fin del juego.
- **Magias (aclarado 28-ago): son 4, NO 8.** Cada magia cubre DOS pantallas:
  pantallas 1-2 -> magia A, 3-4 -> magia B, 5-6 -> magia C, 7-8 -> magia D.
  Hay una burbuja especial con esa magia; al reventarla hace algo.
  -> Quedan por definir CUALES son las 4 magias (brainstorming del spec 27).
- Kong y Bubble comparten patron nuevo: juego TERMINABLE, con final.

## Bugs abiertos de Kong (de la sesión de hoy)
- **Vidas**: `startDeath()` (KongGame.tsx:909) hace `return` tras `doGameOver()`
  sin llamar a `report()` → la última vida perdida no llega al HUD de la página;
  se queda 1 corazón encendido en "FIN DEL JUEGO". El contador del canvas
  (cuadraditos) sí es correcto: lee `s.lives` en el render.
- **La meta no se comunica**: el propio autor subió a por Kong esperando avanzar.
  La copa flota sin señalar y el sprite llamativo está en la otra punta.

---

## Pendientes abiertos al cerrar el 28-ago

### Bloques transversales (cada uno merece su propia pasada, NO colarlos al final de otra sesion)
1. **Teclas pegadas al perder foco (`window blur`)** — VERIFICADO: ningun juego lo maneja.
   Alt-tab con una tecla pulsada y el personaje sigue moviendose solo.
   Alcance: **11 componentes** en `components/games/*.tsx`. Cada uno guarda el estado
   de teclas en variables locales de su closure (`leftDown`, `rightDown`... con nombres
   distintos), asi que NO se resuelve con un hook compartido: es un reseteo a medida
   por juego + registrar/quitar el listener.
   Requiere **QA manual humano en los 11 juegos**.
2. **`saveScore` silencioso** — las 11 play-pages hacen `await saveScore(...)` y descartan
   el resultado, asi que el jugador ve "PUNTUACION GUARDADA" aunque el insert falle.
   `insertScore` (lib/scores.ts) y `saveScore` (UserContext) SI devuelven el error;
   el fallo esta solo en el consumidor.
   **Lleva decision de producto**: que se le enseña al jugador cuando falla.
3. **44 errores de lint de React 19** (tras sacar `references/`): 22 "Cannot access refs
   during render" + 16 "setState sincrono dentro de un effect", repartidos por las 11
   play-pages y `UserContext`/`MusicContext`. Deuda estructural, no un minor.

### Minors aplazados con destino (del triaje del 28-ago)
- guard de `userId` stale en `refreshCredits`/`saveScore` (ventana en sign-out)
- `baseKey` recomputado por render (useState lazy)
- faltan `lib/scores.test.ts` y test de `isGameId('constructor')`
- z-index del toast (80 == .modal-bd, por encima solo por orden DOM)
- **toast fijo abajo tapa el gamepad en movil scrolleado** -> va al bloque A.2 (bug responsive)
- fetch de titulo duplicado en las dos pages

### Tanda de a11y (agrupar en un solo trabajo)
- modales sin focus trap ni Escape (ayuda, instrucciones y game-over x11)
- `CreditsToast` sin acceso por teclado
- gamepad sin `helpOpen`

### DESCARTADO tras investigarlo — NO volver a abrirlo
- **"El HUD de vidas se queda colgado en el game over"**: NO es un bug. Se investigo el
  28-ago a raiz de dos partidas. `startDeath()` hace `return` tras `doGameOver()`, pero
  **`doGameOver()` llama a `report()` en su primera linea** (KongGame.tsx:897), asi que
  `onLivesChange(0)` SI se emite. Lo que parecian corazones encendidos eran los tres
  corazones **atenuados** (`heartsMarkup` siempre pinta MAX_LIVES y apaga los perdidos).
- **"Puntos gratis por caerse"**: NO es un bug. Los 900 puntos eran 3 x SCORE_SMASH (300)
  con martillo; los martillos se cogen por contacto al caminar, sin pulsar nada.

### Bug A.2 sigue abierto
- Responsive de las play-pages en emulacion DevTools (afecta tambien a Pac-Man, es de
  plataforma y viene de antes de Kong). Empezar con `superpowers:systematic-debugging`.
