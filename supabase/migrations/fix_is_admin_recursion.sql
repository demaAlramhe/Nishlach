-- Hotfix: infinite recursion on couriers RLS (42P17)
-- Cause: is_admin() SELECTs couriers while a couriers policy calls is_admin().
-- Fix: disable row_security inside the security-definer function.

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
