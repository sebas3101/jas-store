-- v1.16: tabla store_settings — capital de apertura y configuración global
create table if not exists store_settings (
  id             uuid primary key default gen_random_uuid(),
  opening_balance numeric not null default 0,
  updated_at     timestamptz default now()
);

-- Fila única: capital de caja menor que existía antes de empezar a usar la app
insert into store_settings (opening_balance)
select 3000000
where not exists (select 1 from store_settings);
