drop policy if exists "public can insert scores" on public.scores;

create policy "authenticated_insert_own_score"
  on public.scores for insert
  to authenticated
  with check (auth.uid() = user_id);

drop function if exists public.rls_auto_enable() cascade;
