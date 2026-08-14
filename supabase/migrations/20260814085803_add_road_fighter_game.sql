insert into public.games (id, title, short, long, cat, cover, color)
values (
  'road-fighter',
  'ROAD FIGHTER',
  'Esquiva el tráfico a toda velocidad antes de que se agote el depósito.',
  'Carreras clásicas a vista de pájaro: tu coche no frena nunca y la carretera baja cada vez más rápido. Serpentea entre el tráfico, rebasa rivales para sumar puntos y recoge bidones de combustible antes de quedarte tirado. Tienes 3 vidas: cada choque — o cada depósito vacío — te quita una.',
  'RACING',
  'cover-road-fighter',
  'red'
)
on conflict (id) do nothing;
