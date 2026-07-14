Create a retro arcade game portal web application called "ARCADE VAULT" with the following features and visual direction:

---

### LANGUAGE

All UI text, labels, buttons, navigation, messages, and placeholder content must be in Spanish. This includes button labels ("JUGAR", "VOLVER AL VAULT", "GUARDAR PUNTUACIÓN"), navigation links ("Biblioteca", "Salón de la Fama"), form fields ("Usuario", "Contraseña", "Correo electrónico"), game descriptions, modal messages ("GAME OVER", "PUNTUACIÓN GUARDADA"), and any instructional or descriptive text throughout the app.

---

### VISUAL AESTHETIC

Dark arcade cabinet theme. Deep black background (#0a0a0f) with neon accent colors — electric cyan (#00f5ff), hot magenta (#ff006e), and acid yellow (#f5ff00). Pixel/scanline texture overlay on the background. Typography: a bold pixel-style display font (like "Press Start 2P" from Google Fonts) for headings and game titles, paired with a clean monospace font for body text and UI elements. CRT monitor glow effects on cards and selected elements. Animated grid lines on the background (subtle perspective grid, like an 80s retro-future aesthetic).

---

### PAGES & SCREENS

**1. Home / Game Library (main screen)**

- Header with the app logo "ARCADE VAULT" in neon glow text, animated flicker effect
- Subtitle: "INSERTA UNA MONEDA PARA JUGAR"
- A grid of game cards (3–4 columns on desktop, 1–2 on mobile), each card showing:
  - Game thumbnail / cover art placeholder (colorful retro-style illustration area)
  - Game title (e.g., Arkanoid, Tetris, Snake, Pac-Man, Space Invaders, Asteroids)
  - Short description (1 line, in Spanish)
  - "JUGAR" button with neon border hover effect
  - High score badge showing "MEJOR PUNTUACIÓN"
- Filter/search bar at the top to filter games by name or category, placeholder text in Spanish
- Smooth hover animations: cards scale up slightly, border glows brighter

**2. Game Detail / Launch Screen**

- Full-screen overlay or dedicated page when a game is selected
- Large game title with neon glow
- Game description (2–3 sentences, in Spanish)
- Leaderboard panel on the side showing top 10 scores (username + score + date), labeled "MEJORES PUNTUACIONES"
- Big "JUGAR AHORA" button (animated, pulsing glow)
- "VOLVER AL VAULT" button

**3. Game Player Screen**

- Clean, distraction-free layout
- The HTML game renders inside a centered container styled like a CRT monitor bezel (rounded corners, slight screen curvature effect with CSS)
- HUD bar above the game: current score ("PUNTUACIÓN"), lives/level ("VIDAS" / "NIVEL"), player name
- "PAUSA" and "SALIR" buttons in the corner
- After game ends: modal overlay with "FIN DEL JUEGO", final score, option to submit score ("GUARDAR PUNTUACIÓN"), and "JUGAR DE NUEVO" / "VOLVER AL VAULT" buttons

**4. Authentication Screen**

- Minimal centered card with the ARCADE VAULT logo
- Toggle between "INICIAR SESIÓN" and "CREAR CUENTA" tabs
- Fields: "Usuario", "Contraseña" (and "Correo electrónico" for register)
- "JUGAR COMO INVITADO" option (no account needed, scores not saved)
- Social login buttons (Google, GitHub) as secondary options
- Neon-bordered input fields with glow-on-focus effect

**5. High Scores / Hall of Fame Page**

- Full leaderboard page titled "SALÓN DE LA FAMA"
- Tab selector for each game (Arkanoid, Tetris, Snake, etc.)
- Top 10 global scores table with columns: "RANGO", "JUGADOR", "PUNTUACIÓN", "FECHA"
- Top 3 highlighted with gold/silver/bronze neon treatment
- Current user's personal best highlighted if logged in, labeled "TU MEJOR MARCA"
- Animated entrance for the rows (stagger reveal on load)

---

### NAVIGATION

- Sticky top navbar with: Logo (left), nav links ("Biblioteca", "Salón de la Fama"), Auth button ("Iniciar Sesión") or User avatar (right)
- Mobile: hamburger menu with a slide-in panel
- Active page indicator with neon underline

---

### INTERACTIONS & ANIMATIONS

- Page transitions: fast slide or fade
- Game card hover: lift + glow border intensifies + slight rotate (3D tilt effect)
- Buttons: pixel-style press effect on click (slight scale down)
- Score submission: typewriter text animation showing "PUNTUACIÓN GUARDADA"
- Loading states: retro pixel spinner or scanline wipe

---

### TECHNICAL NOTES

- React application (or vanilla HTML/CSS/JS if React is not available)
- The game area should be a sandboxed iframe or canvas container where external HTML game files can be loaded
- Use localStorage for guest score tracking; indicate where a real backend (REST API or Supabase) would connect for authenticated users
- Fully responsive: mobile, tablet, desktop
- Use Google Fonts: "Press Start 2P" + "Courier Prime"
- All text content throughout the app must be in Spanish