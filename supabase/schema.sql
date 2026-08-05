create table couriers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  auth_user_id uuid unique references auth.users(id),
  is_active boolean default true,
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

create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  min_km numeric not null,
  max_km numeric,
  price numeric not null
);

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

-- Enable Row Level Security
alter table couriers enable row level security;
alter table service_areas enable row level security;
alter table orders enable row level security;
alter table pricing_rules enable row level security;

-- Public: SELECT active service areas
create policy "Public can view active service areas"
  on service_areas
  for select
  to anon, authenticated
  using (is_active = true);

-- Public: SELECT pricing rules (for quote display)
create policy "Public can view pricing rules"
  on pricing_rules
  for select
  to anon, authenticated
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

-- TODO: Admin policies (full CRUD on couriers, service_areas, orders, pricing_rules)
