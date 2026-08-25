update public.games
set cover = '/covers/karate-champ.png'
where id = 'karate-champ'
  and cover <> '/covers/karate-champ.png';
