-- Apply on existing Supabase projects (schema.sql is for reference / fresh installs).
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.

alter table couriers
  add column if not exists is_admin boolean not null default false;

alter table couriers
  alter column phone drop not null;

create table if not exists pricing_config (
  id uuid primary key default gen_random_uuid(),
  base_price numeric not null default 50,
  free_km numeric not null default 5,
  price_per_km numeric not null default 5,
  updated_at timestamptz not null default now()
);

insert into pricing_config (base_price, free_km, price_per_km)
select 50, 5, 5
where not exists (select 1 from pricing_config);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.couriers
    where auth_user_id = auth.uid()
      and is_admin = true
      and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table pricing_config enable row level security;

-- Policies (ignore errors if already exist — or drop first)
do $$
begin
  -- pricing_config
  if not exists (
    select 1 from pg_policies where policyname = 'Anon can view pricing config'
  ) then
    create policy "Anon can view pricing config"
      on pricing_config for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Authenticated can view pricing config'
  ) then
    create policy "Authenticated can view pricing config"
      on pricing_config for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Admins can update pricing config'
  ) then
    create policy "Admins can update pricing config"
      on pricing_config for update to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;

  -- couriers
  if not exists (
    select 1 from pg_policies where policyname = 'Admins can view all couriers'
  ) then
    create policy "Admins can view all couriers"
      on couriers for select to authenticated using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Admins can insert couriers'
  ) then
    create policy "Admins can insert couriers"
      on couriers for insert to authenticated with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Admins can update couriers'
  ) then
    create policy "Admins can update couriers"
      on couriers for update to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;

  -- orders
  if not exists (
    select 1 from pg_policies where policyname = 'Admins can view all orders'
  ) then
    create policy "Admins can view all orders"
      on orders for select to authenticated using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Admins can update all orders'
  ) then
    create policy "Admins can update all orders"
      on orders for update to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;

  -- service_areas
  if not exists (
    select 1 from pg_policies where policyname = 'Admins can view all service areas'
  ) then
    create policy "Admins can view all service areas"
      on service_areas for select to authenticated using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Admins can insert service areas'
  ) then
    create policy "Admins can insert service areas"
      on service_areas for insert to authenticated with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Admins can update service areas'
  ) then
    create policy "Admins can update service areas"
      on service_areas for update to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Promote an admin (edit the name / auth link as needed):
-- update couriers set is_admin = true where full_name = 'YOUR NAME';
