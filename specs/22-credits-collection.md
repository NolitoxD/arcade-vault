# SPEC 22 — Créditos: progreso de colección

> **Estado:** Approved (fase 1) · fase 2 pendiente de decisión
> **Depende de:** 06-games-table-leaderboard-supabase · 13-supabase-auth · 20-auth-gate-play
> **Fecha:** 2026-08-19
> **Objetivo:** Dar significado real al contador "CRÉDITOS · 03" del navbar: pasa de
> adorno a **progreso de colección** — cuántos juegos distintos ha jugado el usuario —
> y (fase 2) convertir los skins en recompensa por explorar el catálogo.

---

## Por qué

Hoy el navbar muestra "CRÉDITOS · 03" fijo, sin significado: un número inventado en
una UI que por lo demás dice la verdad. Y en paralelo, los tres skins de cada juego
están disponibles desde el primer segundo, sin que desbloquearlos signifique nada.
Este spec resuelve los dos problemas con el mismo mecanismo y sin tablas nuevas.

---

## Fase 1 — el contador (Approved, implementable ya)

**Definición:** `créditos` = número de `game_id` **distintos** en los que el usuario
tiene al menos un score. Máximo = número de juegos del catálogo (hoy 8).

**Scope In:**

- `app/context/UserContext.tsx` — al establecerse la sesión, una consulta:
  `select game_id from scores where user_id = <uid>` → `new Set(...).size`.
  Se expone como `gamesPlayed` (número) y `catalogSize` en el contexto. Se recalcula
  al cambiar la sesión; no hace falta realtime.
- `components/Nav.tsx` — el bloque de créditos muestra `CRÉDITOS · NN / 08`
  (dos dígitos, estilo arcade). **Sin sesión** muestra `CRÉDITOS · --` y el bloque
  enlaza a `/auth` (coherente con el gate del spec 20: para sumar créditos hay que
  jugar, y para jugar hay que tener cuenta).
- `catalogSize` sale del propio catálogo (count de `games`), no hardcodeado.

**Recompensas de la fase 1** (decisión del usuario 2026-08-19: recompensas que
**añaden**, nunca que bloquean — mismo incentivo, coste marginal):

- **Rango de jugador** junto al contador, derivado del mismo número:
  `0` → `INVITADO` · `1-2` → `NOVATO` · `3-5` → `JUGADOR` · `6-7` → `VETERANO` ·
  `8/8` (todos) → `MAESTRO DEL VAULT`. Los umbrales 3 y 6 son los mismos que usaría
  la fase 2, para no reeducar al usuario si algún día llega.
- **Estrellas de progreso** `★★☆` junto a los créditos, con los mismos umbrales
  (3 y 6), reutilizando el lenguaje visual de la barra DIFICULTAD de las fichas.
- **Insignia en las cards del catálogo**: cada juego en el que el usuario ya tiene
  algún score luce una marca discreta en su tarjeta (`GamesGrid.tsx`), para que se
  vea de un vistazo cuáles faltan. Sin sesión no se muestra ninguna.

**Fuera de alcance en fase 1:** cualquier bloqueo de skins (ver fase 2).

**Criterios de aceptación (fase 1):**

- [ ] Sin sesión, el navbar muestra `CRÉDITOS · --` y enlaza a `/auth`.
- [ ] Con sesión, muestra el número real de juegos distintos jugados sobre el total.
- [ ] Guardar un score en un juego NUEVO incrementa el contador tras recargar.
- [ ] Guardar un segundo score en un juego ya jugado NO lo incrementa.
- [ ] Una sola consulta por sesión (no una por render ni por navegación).
- [ ] `npm test` y `npm run build` verdes.

---

## Fase 2 — skins como recompensa (pendiente de decisión)

**Idea:** umbrales de créditos desbloquean skins en TODOS los juegos:
`classic` siempre · **3 créditos → `retro`** · **6 créditos → `neon`**.
Los skins bloqueados aparecen en el selector con candado y deshabilitados.

**Coste real (por eso va aparte):** cada play-page declara su propia constante
`SKIN_OPTIONS` (convención per-game-copy del repo) y `MobileGamepad` tiene su propia
lista de los 3 canónicos. Implementarlo toca **8 play-pages + el gamepad**, o exige
antes centralizar los skins en un módulo compartido (refactor transversal que hoy
ningún otro requisito pide).

**Decisiones si se aprueba:**

- Centralizar primero `SKIN_OPTIONS` en un único módulo y que cada play-page lo
  consuma — el bloqueo entonces se implementa una sola vez.
- El bloqueo es cosmético, nunca afecta a la jugabilidad ni a la puntuación.
- Un usuario que ya jugaba con `neon` guardado en localStorage y aún no lo tiene
  desbloqueado cae a `classic` sin error.

---

## Decisiones

- **Sí: créditos = colección, no moneda** — es la única variante que no necesita
  tabla nueva (se deriva de `scores`, que ya existe) y no añade fricción al juego.
  La moneda con saldo gastable (opción B evaluada) exigiría persistir el gasto.
- **No: créditos como partidas restantes** (opción C, la recreativa auténtica) —
  cobrar por jugar en un arcade gratuito sin monetización solo genera abandono.
- **Sí: `--` para invitados en vez de `00`** — `00` sugiere "has jugado 0 partidas";
  `--` comunica "esto se activa con cuenta" y aprovecha el gate ya existente.
- **Sí: fase 2 separada** — el valor del contador es inmediato y barato; el
  desbloqueo de skins arrastra un refactor que merece su propia decisión.
