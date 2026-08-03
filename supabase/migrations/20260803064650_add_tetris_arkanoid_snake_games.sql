insert into public.games (id, title, short, long, cat, cover, color)
values
  (
    'tetris', 'TETRIS', 'Apila tetrominos antes de que el techo te aplaste.',
    'Siete piezas, diez columnas, una sola regla: no dejes que el tablero llegue arriba. Gira y encaja tetrominos para completar líneas y ganar puntos; cada nivel te las acelera un poco más.',
    'PUZZLE', 'cover-tetro', 'cyan'
  ),
  (
    'arkanoid', 'ARKANOID', 'Rompe todos los bloques antes de perder tus 3 vidas.',
    'Controla la paleta y rebota la pelota para destruir todos los bloques. Cinco niveles con patrones distintos y velocidad creciente ponen a prueba tus reflejos. Completa el nivel 5 sin agotar tus vidas para ganar.',
    'ARCADE', 'cover-bricks', 'cyan'
  ),
  (
    'snake', 'SNAKE', 'Come frutas, crece y no te muerdas la cola.',
    'Guía a la serpiente por el tablero comiendo frutas que aparecen aleatoriamente. Cada fruta que comes hace crecer tu cuerpo y sube tu puntuación. La partida termina si chocas contra una pared o contra ti mismo.',
    'ARCADE', 'cover-snake', 'green'
  )
on conflict (id) do nothing;
