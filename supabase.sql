-- =========================================================
-- BADCAKE — Esquema SQL para Supabase (Opcional: Modo Nube)
-- Pega este script en el SQL Editor de tu proyecto Supabase
-- cuando quieras publicar la tienda en internet.
-- =========================================================

-- 1. Tabla de camisas
create table if not exists public.camisas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text default '',
  precio numeric not null default 0,
  precio_anterior numeric,
  coleccion text default '',
  color text default '',
  tallas text[] default '{}',
  imagenes text[] default '{}',
  destacado boolean default false,
  agotado boolean default false,
  visible boolean default true,
  creado timestamptz default now()
);

-- 2. Tabla de ajustes de la tienda
create table if not exists public.ajustes (
  clave text primary key,
  valor jsonb
);

-- 3. Seguridad (RLS): cualquiera puede ver el catálogo público,
--    pero solo el dueño autenticado puede crear, editar o borrar.
alter table public.camisas enable row level security;
alter table public.ajustes enable row level security;

create policy "Lectura pública de camisas"
  on public.camisas for select using (true);

create policy "Dueño administra camisas"
  on public.camisas for all to authenticated using (true) with check (true);

create policy "Lectura pública de ajustes"
  on public.ajustes for select using (true);

create policy "Dueño administra ajustes"
  on public.ajustes for all to authenticated using (true) with check (true);

-- 4. Bucket público de fotos "camisas"
insert into storage.buckets (id, name, public)
values ('camisas', 'camisas', true)
on conflict (id) do nothing;

create policy "Fotos públicas de camisas"
  on storage.objects for select using (bucket_id = 'camisas');

create policy "Dueño sube fotos de camisas"
  on storage.objects for insert to authenticated with check (bucket_id = 'camisas');

create policy "Dueño borra fotos de camisas"
  on storage.objects for delete to authenticated using (bucket_id = 'camisas');
