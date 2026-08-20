# SPEC 21 — Música de fondo en las play-pages

> **Estado:** Approved
> **Depende de:** 10-mobile-touch-controls (gamepad) · 20-auth-gate-play
> **Fecha:** 2026-08-19
> **Objetivo:** Música ambiental compartida en todos los juegos, con mute persistente
> y arranque conforme a las políticas de autoplay del navegador — sin tocar los ocho
> componentes de juego ni sus play-pages.

---

## Scope

**In:**

- Asset `public/arcade-theme.m4a` — AAC 96 kbps estéreo, 1,0 MB, 87 s.
  Origen: "Arcade 80s Era" de **slimeyfox** (Pixabay, libre de derechos, sin
  atribución obligatoria). Convertido desde el mp3 original de 256 kbps con
  `afconvert -f m4af -d aac -b 96000`.
- `app/context/MusicContext.tsx` — provider cliente montado en el root layout:
  - Crea un único `HTMLAudioElement` (`loop = true`, `volume = 0.35`,
    `preload = 'none'`) **de forma perezosa**: el archivo NO se descarga hasta
    que la música vaya a sonar por primera vez.
  - Reproduce **solo** cuando `pathname` matchea `/^\/games\/[^/]+\/play$/`;
    al salir de una play-page, pausa.
  - **Autoplay:** no intenta reproducir al montar. Espera al primer gesto del
    usuario (`keydown` o `pointerdown` en `document`, listener `once`). El
    `play()` va con `.catch(() => {})` como el resto de audio del repo.
  - Estado `muted` persistido en `localStorage` con la clave `av_music_muted`
    (por defecto **no muteado**); expuesto por el hook `useMusic()`.
- `components/Nav.tsx` — botón de mute (icono ♪ / ♪̸) que consume `useMusic()`.
  Visible siempre, en desktop y móvil: la música es global, su control también.

**Fuera de alcance:**

- Los 8 componentes de juego y sus play-pages: **no se tocan** (el provider vive
  en el layout y decide por ruta).
- `MobileGamepad.tsx`: no se toca — el control global del Nav ya es accesible en móvil.
- Slider de volumen (volumen fijo 0.35), tracks por juego, efectos de sonido
  existentes (siguen como están, independientes de este sistema).
- Crossfade del bucle — ver riesgos.

---

## Decisiones

- **Provider global en el layout, no hook por juego** — la alternativa (llamar a un
  hook en cada play-page) tocaría 8 archivos y se repetiría en cada juego nuevo.
  Con el provider, el coste por juego futuro es cero.
- **Control en el Nav, no en el HUD ni en el gamepad** — el estado es global, así que
  el control debe serlo; además evita tocar `MobileGamepad` y los 8 HUD.
- **Carga perezosa + `preload="none"`** — 1 MB no debe entrar en la carga inicial de
  quien solo mira el catálogo.
- **Arranque tras el primer gesto** — Chrome/Safari bloquean el autoplay con sonido;
  en una play-page el primer gesto llega enseguida (mover al jugador).
- **Volumen fijo 0.35 y solo mute** — un slider añade UI a un HUD ya cargado; el
  mute cubre el 95% de la necesidad real.
- **La música NO se pausa con el botón PAUSA del juego** — pausar la música rompe la
  continuidad musical en pausas de dos segundos; el jugador que no la quiera, la mutea.

---

## Criterios de aceptación

- [ ] `public/arcade-theme.m4a` existe (~1 MB) y no hay assets sin usar añadidos.
- [ ] En `/games` (catálogo) NO se descarga el audio (verificable en la pestaña Network).
- [ ] Al entrar a cualquier `/games/*/play` y pulsar la primera tecla, suena la música.
- [ ] La música se detiene al salir de la play-page (volver al detalle o al catálogo).
- [ ] El botón del Nav mutea y desmutea; el estado sobrevive a recargas y a navegar.
- [ ] Con `av_music_muted = true`, entrar a una play-page NO descarga ni reproduce el audio.
- [ ] Ningún error de autoplay en consola.
- [ ] Los 8 componentes de juego y sus play-pages siguen sin modificarse.
- [ ] `npm test` (33) y `npm run build` verdes.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El track no está compuesto como bucle: al repetirse a los 87 s puede oírse un corte | Aceptado en v1 (`loop = true`). Si en QA molesta, se añade un crossfade de ~1,5 s con un segundo elemento de audio — cambio localizado en el provider. |
| Un usuario con la pestaña en segundo plano sigue oyendo música | El navegador ya pausa/atenúa según su política; además el provider pausa al salir de la ruta de juego. |
| 1 MB en conexiones lentas | Carga perezosa: solo se descarga al empezar a jugar con música activa, y queda en caché. |
