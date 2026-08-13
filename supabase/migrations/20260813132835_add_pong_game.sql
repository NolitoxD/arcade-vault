insert into public.games (id, title, short, long, cat, cover, color)
values (
  'pong',
  'PONG',
  'Golpea la pelota más rápido de lo que tu rival puede reaccionar.',
  'Duelo clásico contra la CPU: mueve tu pala, devuelve la pelota y marca tantos a una máquina que cada nivel juega más rápido y afina mejor. Tienes 3 vidas; cada tanto que encaje la CPU te quita una. Suma puntos con cada devolución y multiplica con cada tanto que marques.',
  'SPORTS',
  'cover-pong',
  'blue'
)
on conflict (id) do nothing;
