insert into public.games (id, title, short, long, cat, cover, color)
values (
  'pacman',
  'PAC-MAN',
  'Come todos los puntos del laberinto sin que los cuatro fantasmas te atrapen.',
  'El comecocos original: recorre el laberinto engullendo cada punto mientras Blinky, Pinky, Inky y Clyde te acorralan, cada uno con su propia manía. Traga una píldora de poder y cázalos tú a ellos para encadenar 200, 400, 800 y 1600 puntos. Tres laberintos en rotación, fruta de bonus y una dificultad que nunca deja de apretar: tienes 3 vidas y ningún sitio donde esconderte.',
  'MAZE',
  'cover-pacman',
  'yellow'
)
on conflict (id) do nothing;
