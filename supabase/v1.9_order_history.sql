create table if not exists order_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  user_name   text not null,
  action      text not null,
  changes     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists order_history_order_id_idx on order_history(order_id);

alter table order_history enable row level security;

create policy "order_history_read" on order_history for select using (true);
create policy "order_history_insert" on order_history for insert with check (true);
