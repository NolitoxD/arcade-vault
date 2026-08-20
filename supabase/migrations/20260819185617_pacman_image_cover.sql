update public.games
set cover = '/covers/pacman.png'
where id = 'pacman'
  and cover <> '/covers/pacman.png';
