create table couriers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  auth_user_id uuid unique references auth.users(id),
  is_active boolean default true,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists couriers_auth_user_id_idx
  on couriers (auth_user_id);

create table service_areas (
  id uuid primary key default gen_random_uuid(),
  city_name text not null unique,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_name text not null,
  customer_phone text not null,
  pickup_location text not null,
  pickup_address text,
  pickup_lat numeric,
  pickup_lng numeric,
  tracking_number text,
  proof_image_url text,
  proof_text text,
  dropoff_address text not null,
  dropoff_city text not null,
  house_number text,
  entrance_number text,
  entry_code text,
  note text,
  dropoff_lat numeric,
  dropoff_lng numeric,
  distance_km numeric,
  price numeric,
  status text not null default 'pending',
  courier_id uuid references couriers(id),
  payment_status text default 'unpaid',
  payment_provider_ref text,
  created_at timestamptz default now(),
  claimed_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz
);

-- Legacy tiered pricing (unused by formula; kept for future zone pricing)
create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  min_km numeric not null,
  max_km numeric,
  price numeric not null
);

-- Single-row formula constants for findPriceForDistance
create table pricing_config (
  id uuid primary key default gen_random_uuid(),
  base_price numeric not null default 50,
  free_km numeric not null default 5,
  price_per_km numeric not null default 5,
  updated_at timestamptz not null default now()
);

insert into pricing_config (base_price, free_km, price_per_km)
select 50, 5, 5
where not exists (select 1 from pricing_config);

-- Sequential order numbers: NS-1001, NS-1002, ...
create sequence if not exists order_number_seq start with 1001;

create or replace function next_order_number()
returns text
language sql
security definer
set search_path = public
as $$
  select 'NS-' || nextval('order_number_seq')::text;
$$;

grant execute on function next_order_number() to anon, authenticated;

-- Active admin check (security definer + row_security off — avoids RLS recursion on couriers)
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

-- Enable Row Level Security
alter table couriers enable row level security;
alter table service_areas enable row level security;
alter table orders enable row level security;
alter table pricing_rules enable row level security;
alter table pricing_config enable row level security;

-- Public: SELECT active service areas
create policy "Public can view active service areas"
  on service_areas
  for select
  to anon, authenticated
  using (is_active = true);

-- Public: SELECT pricing rules (legacy quote display)
create policy "Public can view pricing rules"
  on pricing_rules
  for select
  to anon, authenticated
  using (true);

-- Public / authenticated: SELECT pricing formula config
create policy "Anon can view pricing config"
  on pricing_config
  for select
  to anon
  using (true);

create policy "Authenticated can view pricing config"
  on pricing_config
  for select
  to authenticated
  using (true);

-- Public: INSERT orders
create policy "Public can create orders"
  on orders
  for insert
  to anon, authenticated
  with check (true);

-- Public: SELECT orders by order_number (tracking lookup)
-- App must always filter by order_number. Tighten via RPC when tracking is built.
create policy "Public can view order by order_number"
  on orders
  for select
  to anon, authenticated
  using (true);

-- Storage: proofs bucket (run after creating bucket in dashboard if needed)
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;

create policy "Public can upload proofs"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'proofs');

create policy "Public can view proofs"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'proofs');

-- Courier: read own profile
create policy "Couriers can view own profile"
  on couriers
  for select
  to authenticated
  using (auth_user_id = auth.uid());

-- Courier: read pending orders + assigned orders
create policy "Couriers can view pending and assigned orders"
  on orders
  for select
  to authenticated
  using (
    status = 'pending'
    or courier_id in (
      select id from couriers where auth_user_id = auth.uid()
    )
  );

-- Courier: update pending (claim) or own assigned orders
create policy "Couriers can update pending or assigned orders"
  on orders
  for update
  to authenticated
  using (
    status = 'pending'
    or courier_id in (
      select id from couriers where auth_user_id = auth.uid()
    )
  )
  with check (
    courier_id in (
      select id from couriers where auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- Admin policies (require public.is_admin())
-- ============================================================

-- Couriers
create policy "Admins can view all couriers"
  on couriers
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert couriers"
  on couriers
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update couriers"
  on couriers
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Orders
create policy "Admins can view all orders"
  on orders
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can update all orders"
  on orders
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Service areas
create policy "Admins can view all service areas"
  on service_areas
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert service areas"
  on service_areas
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update service areas"
  on service_areas
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Pricing config (edit formula constants)
create policy "Admins can update pricing config"
  on pricing_config
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
