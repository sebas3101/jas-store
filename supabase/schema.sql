-- =====================================================================
-- JAS Store — Schema de base de datos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================================

-- Extensión para UUIDs
create extension if not exists "uuid-ossp";

-- ─── Usuarios de la app (auth propio, sin Supabase Auth) ─────────────
create table if not exists app_users (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  email         text unique not null,
  password      text not null,
  role          text not null default 'vendedor',
  phone         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ─── Clientes ─────────────────────────────────────────────────────────
create table if not exists clients (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  phone         text not null,
  address       text,
  company       text,
  reference     text,
  status        text not null default 'al_dia',
  is_internal   boolean not null default false,
  notes         text,
  credit_limit  numeric,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Productos ────────────────────────────────────────────────────────
create table if not exists products (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  category        text not null,
  size            text,
  color           text,
  reference       text,
  sale_price      numeric not null default 0,
  cost_price      numeric not null default 0,
  status          text not null default 'disponible',
  image_url       text,
  responsible_id  uuid references app_users(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── Pedidos (items guardados como JSONB) ─────────────────────────────
create table if not exists orders (
  id                      uuid primary key default uuid_generate_v4(),
  order_number            text unique not null,
  client_id               uuid not null references clients(id) on delete restrict,
  items                   jsonb not null default '[]',
  total_amount            numeric not null default 0,
  total_cost              numeric not null default 0,
  amount_paid             numeric not null default 0,
  status                  text not null default 'tomado',
  payment_method          text not null default 'credito',
  seller_id               uuid references app_users(id) on delete set null,
  delivery_person_id      uuid references app_users(id) on delete set null,
  order_date              timestamptz not null default now(),
  estimated_delivery_date timestamptz,
  delivered_at            timestamptz,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ─── Pagos y abonos ───────────────────────────────────────────────────
create table if not exists payments (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references clients(id) on delete restrict,
  order_ids         text[] not null default '{}',
  amount            numeric not null,
  method            text not null,
  date              timestamptz not null default now(),
  proof_url         text,
  notes             text,
  registered_by_id  uuid references app_users(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- ─── Proveedores ──────────────────────────────────────────────────────
create table if not exists suppliers (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  phone       text,
  address     text,
  products    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Compras a proveedores ────────────────────────────────────────────
create table if not exists supplier_purchases (
  id             uuid primary key default uuid_generate_v4(),
  supplier_id    uuid not null references suppliers(id) on delete cascade,
  description    text not null,
  cost           numeric not null,
  status         text not null default 'pendiente',
  purchase_date  timestamptz not null default now(),
  received_date  timestamptz,
  notes          text,
  created_at     timestamptz not null default now()
);

-- ─── Publicaciones ────────────────────────────────────────────────────
create table if not exists publications (
  id               uuid primary key default uuid_generate_v4(),
  product_id       uuid references products(id) on delete set null,
  product_name     text not null,
  channel          text not null,
  published_by_id  uuid references app_users(id) on delete set null,
  published_at     timestamptz,
  is_published     boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now()
);

-- ─── Row Level Security (acceso total con anon key — app interna) ─────
alter table app_users          enable row level security;
alter table clients            enable row level security;
alter table products           enable row level security;
alter table orders             enable row level security;
alter table payments           enable row level security;
alter table suppliers          enable row level security;
alter table supplier_purchases enable row level security;
alter table publications       enable row level security;

drop policy if exists "jas_all_app_users"          on app_users;
drop policy if exists "jas_all_clients"            on clients;
drop policy if exists "jas_all_products"           on products;
drop policy if exists "jas_all_orders"             on orders;
drop policy if exists "jas_all_payments"           on payments;
drop policy if exists "jas_all_suppliers"          on suppliers;
drop policy if exists "jas_all_supplier_purchases" on supplier_purchases;
drop policy if exists "jas_all_publications"       on publications;

create policy "jas_all_app_users"          on app_users          for all using (true) with check (true);
create policy "jas_all_clients"            on clients            for all using (true) with check (true);
create policy "jas_all_products"           on products           for all using (true) with check (true);
create policy "jas_all_orders"             on orders             for all using (true) with check (true);
create policy "jas_all_payments"           on payments           for all using (true) with check (true);
create policy "jas_all_suppliers"          on suppliers          for all using (true) with check (true);
create policy "jas_all_supplier_purchases" on supplier_purchases for all using (true) with check (true);
create policy "jas_all_publications"       on publications       for all using (true) with check (true);

-- ─── Datos iniciales — usuarios del sistema ───────────────────────────
insert into app_users (id, name, email, password, role, active) values
  ('00000000-0000-0000-0000-000000000001', 'Administrador', 'admin@jasstore.co',     'admin123',    'admin',    true),
  ('00000000-0000-0000-0000-000000000002', 'Jennifer',      'jennifer@jasstore.co',  'jennifer123', 'jennifer', true),
  ('00000000-0000-0000-0000-000000000003', 'Alexis',        'alexis@jasstore.co',    'alexis123',   'alexis',   true),
  ('00000000-0000-0000-0000-000000000004', 'Vendedor',      'vendedor@jasstore.co',  'vendedor123', 'vendedor', true)
on conflict (email) do nothing;

-- =====================================================================
-- MIGRACIÓN v1.3 — Sistema de permisos por usuario
-- Ejecutar en Supabase SQL Editor después del schema inicial
-- =====================================================================

-- 1. Agregar columna permissions a app_users
alter table app_users
  add column if not exists permissions jsonb not null default '{}';

-- 2. Función de login que verifica usuario activo
--    Reemplaza la anterior (si existe) y solo retorna usuarios con active = true
create or replace function login_user(p_email text, p_password text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(u.*)
  from app_users u
  where u.email = p_email
    and u.password = p_password
    and u.active = true
  limit 1;
$$;

-- 3. Permisos predeterminados para usuarios existentes
--    Admin: todos los permisos (el rol 'admin' ya omite el chequeo en la app,
--    pero se setean por consistencia)
update app_users
set permissions = '{
  "dashboard":    {"ver":true,"crear":true,"editar":true,"eliminar":true,"exportar":true,"registrar_pago":true,"registrar_abono":true,"ver_financiero":true,"cambiar_estado":true,"administrar_accesos":true},
  "clientes":     {"ver":true,"crear":true,"editar":true,"eliminar":true,"exportar":true,"registrar_pago":true,"registrar_abono":true,"ver_financiero":true,"cambiar_estado":true,"administrar_accesos":true},
  "pedidos":      {"ver":true,"crear":true,"editar":true,"eliminar":true,"exportar":true,"registrar_pago":true,"registrar_abono":true,"ver_financiero":true,"cambiar_estado":true,"administrar_accesos":true},
  "productos":    {"ver":true,"crear":true,"editar":true,"eliminar":true,"exportar":true,"registrar_pago":true,"registrar_abono":true,"ver_financiero":true,"cambiar_estado":true,"administrar_accesos":true},
  "publicaciones":{"ver":true,"crear":true,"editar":true,"eliminar":true,"exportar":true,"registrar_pago":true,"registrar_abono":true,"ver_financiero":true,"cambiar_estado":true,"administrar_accesos":true},
  "pagos":        {"ver":true,"crear":true,"editar":true,"eliminar":true,"exportar":true,"registrar_pago":true,"registrar_abono":true,"ver_financiero":true,"cambiar_estado":true,"administrar_accesos":true},
  "proveedores":  {"ver":true,"crear":true,"editar":true,"eliminar":true,"exportar":true,"registrar_pago":true,"registrar_abono":true,"ver_financiero":true,"cambiar_estado":true,"administrar_accesos":true},
  "entregas":     {"ver":true,"crear":true,"editar":true,"eliminar":true,"exportar":true,"registrar_pago":true,"registrar_abono":true,"ver_financiero":true,"cambiar_estado":true,"administrar_accesos":true},
  "reportes":     {"ver":true,"crear":true,"editar":true,"eliminar":true,"exportar":true,"registrar_pago":true,"registrar_abono":true,"ver_financiero":true,"cambiar_estado":true,"administrar_accesos":true},
  "configuracion":{"ver":true,"crear":true,"editar":true,"eliminar":true,"exportar":true,"registrar_pago":true,"registrar_abono":true,"ver_financiero":true,"cambiar_estado":true,"administrar_accesos":true}
}'::jsonb
where role = 'admin';

-- Jennifer: clientes, pedidos, pagos, entregas, publicaciones, reportes
update app_users
set permissions = '{
  "dashboard":    {"ver":true},
  "clientes":     {"ver":true,"crear":true,"editar":true,"ver_financiero":true},
  "pedidos":      {"ver":true,"crear":true,"editar":true,"cambiar_estado":true},
  "pagos":        {"ver":true,"registrar_pago":true,"registrar_abono":true,"ver_financiero":true},
  "entregas":     {"ver":true},
  "publicaciones":{"ver":true,"crear":true},
  "reportes":     {"ver":true},
  "productos":    {"ver":true}
}'::jsonb
where role = 'jennifer';

-- Alexis: pedidos y entregas (cambiar estado)
update app_users
set permissions = '{
  "dashboard": {"ver":true},
  "pedidos":   {"ver":true,"cambiar_estado":true},
  "entregas":  {"ver":true,"cambiar_estado":true}
}'::jsonb
where role = 'alexis';

-- Vendedor: productos, pedidos, publicaciones
update app_users
set permissions = '{
  "dashboard":    {"ver":true},
  "productos":    {"ver":true},
  "pedidos":      {"ver":true,"crear":true},
  "publicaciones":{"ver":true,"crear":true}
}'::jsonb
where role = 'vendedor';

-- Consulta: solo reportes
update app_users
set permissions = '{
  "dashboard": {"ver":true},
  "reportes":  {"ver":true}
}'::jsonb
where role = 'consulta';
