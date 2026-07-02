-- Permitir que cualquier usuario (autenticado o anónimo) gestione sus propias
-- suscripciones push. El endpoint es la clave única y no contiene datos sensibles.
alter table push_subscriptions enable row level security;

drop policy if exists "push_sub_insert" on push_subscriptions;
drop policy if exists "push_sub_upsert" on push_subscriptions;
drop policy if exists "push_sub_delete" on push_subscriptions;
drop policy if exists "push_sub_select" on push_subscriptions;

create policy "push_sub_insert" on push_subscriptions
  for insert with check (true);

create policy "push_sub_upsert" on push_subscriptions
  for update with check (true);

create policy "push_sub_delete" on push_subscriptions
  for delete using (true);

create policy "push_sub_select" on push_subscriptions
  for select using (true);
