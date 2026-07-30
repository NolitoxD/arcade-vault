alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "public can read games"
  on public.games for select
  to anon, authenticated
  using (true);

create policy "public can read scores"
  on public.scores for select
  to anon, authenticated
  using (true);

create policy "public can insert scores"
  on public.scores for insert
  to anon, authenticated
  with check (true);
