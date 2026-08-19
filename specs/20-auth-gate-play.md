# SPEC 20 — Gate de login en las play-pages

> **Estado:** Approved
> **Depende de:** 13-supabase-auth · 15-pong (patrón proxy con refresh) · 18-auth-hardening (callback con `next`)
> **Fecha:** 2026-08-19
> **Objetivo:** Exigir sesión para jugar: un visitante sin login que abra cualquier
> `/games/*/play` es redirigido a `/auth` con un aviso claro y vuelve al juego tras
> autenticarse. Catálogo, detalle y leaderboards siguen públicos.

---

## Scope

**In:**

- `proxy.ts` — tras el `getClaims()` existente: si NO hay sesión y `pathname` matchea
  `/^\/games\/[^/]+\/play$/` → redirect 307 a
  `/auth?reason=play&next=<pathname>` (el proxy ya corre en todas las rutas).
- `app/auth/page.tsx`:
  - Con `reason=play`: banner informativo SUPERIOR (mismo slot que el banner de error
    del callback, estilo neutro/cian, no rojo): "Inicia sesión o crea tu cuenta para jugar".
  - Tras login/registro con éxito y en el redirect de usuario ya logueado: si hay
    `next` válido (ruta relativa que empieza por `/` y no por `//`), ir a `next`
    en vez de `/`.
  - OAuth: propagar `next` en el `redirectTo` → `/auth/callback?next=<next>` (el
    callback YA honra `next` desde el spec 18).
- `proxy.ts` — el redirect existente de `/auth` con sesión → `/` pasa a respetar
  `next` válido si viene en la URL.

**Out (sin cambios):**

- `/games` (catálogo), `/games/[id]` (detalle+leaderboard), `/hall-of-fame` — públicos.
- Guardado de scores: ya exige sesión a nivel RLS (spec 14); este spec solo adelanta
  la fricción al inicio del flujo.
- MobileGamepad, juegos, componentes canvas — intactos.

---

## Decisiones

- **Solo `/play`, no todo `/games`** — el catálogo y los rankings son el escaparate
  (decisión del usuario 2026-08-19). Revierte formalmente el "jugar como invitado"
  del spec 13: desde el spec 14 los invitados ya no podían guardar scores, así que
  jugar sin cuenta era un embudo roto.
- **Gate en el proxy, no en las páginas** — un solo punto (el proxy ya verifica
  sesión con `getClaims` por navegación); las play-pages estáticas no se tocan.
- **`next` validado** — solo rutas relativas mismo-origen (sin `//`), patrón ya
  aplicado en el callback (spec 18); evita open-redirect.
- **Banner superior informativo** — decisión del usuario; distinto en tono del banner
  de error del callback (informar, no alarmar).

---

## Criterios de aceptación

- [ ] Sin sesión, `GET /games/pacman/play` (y cualquier otro juego) responde 307 a `/auth?reason=play&next=/games/pacman/play`.
- [ ] La página de auth con `reason=play` muestra el banner superior informativo.
- [ ] Tras login con email desde ese estado, el usuario aterriza en `/games/pacman/play`.
- [ ] Tras registro (flujo confirmación email) el `next` no rompe el flujo existente.
- [ ] OAuth desde ese estado propaga `next` vía callback.
- [ ] Con sesión, `/auth?next=/games/snake/play` redirige a esa ruta (no a `/`).
- [ ] Un `next` malicioso (`https://evil.com`, `//evil.com`) se ignora → `/`.
- [ ] Catálogo, detalle y hall-of-fame siguen accesibles sin sesión.
- [ ] `npm run build` verde; las play-pages siguen siendo estáticas (el gate vive en el proxy).
