update public.games
set cover = '/covers/space-invaders.png'
where id = 'space-invaders'
  and cover <> '/covers/space-invaders.png';
