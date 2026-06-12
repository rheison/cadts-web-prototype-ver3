-- CADTS SecureDestroy Version 2 Supabase schema
-- Run this file in Supabase SQL Editor before using the GitHub Pages app.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'customer'
    check (role in ('admin', 'customer', 'approver', 'technician', 'auditor')),
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  asset_tag text not null,
  asset_type text not null,
  description text,
  status text not null default 'Active'
    check (status in ('Active', 'Pending Destruction', 'Destroyed')),
  created_at timestamptz not null default now()
);

create table if not exists public.destruction_tickets (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  request_reason text not null,
  status text not null default 'Submitted'
    check (status in ('Submitted', 'Approved', 'Assigned', 'Destroyed', 'Certified', 'Rejected')),
  approver_id uuid references public.profiles(id),
  technician_id uuid references public.profiles(id),
  evidence_notes text,
  certificate_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assets_owner_id on public.assets(owner_id);
create index if not exists idx_tickets_customer_id on public.destruction_tickets(customer_id);
create index if not exists idx_tickets_status on public.destruction_tickets(status);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_destruction_tickets_updated_at on public.destruction_tickets;
create trigger set_destruction_tickets_updated_at
before update on public.destruction_tickets
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'customer'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Security-definer helper avoids recursive Row Level Security policies on profiles.
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.profiles enable row level security;
alter table public.assets enable row level security;
alter table public.destruction_tickets enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.assets from anon, authenticated;
revoke all on public.destruction_tickets from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.assets to authenticated;
grant select, insert, update, delete on public.destruction_tickets to authenticated;
grant select, insert on public.audit_logs to authenticated;

drop policy if exists profiles_select_policy on public.profiles;
drop policy if exists profiles_update_admin_only on public.profiles;

create policy profiles_select_policy
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_role() in ('admin', 'approver', 'technician', 'auditor')
);

create policy profiles_update_admin_only
on public.profiles
for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists assets_select_policy on public.assets;
drop policy if exists assets_insert_customer_only on public.assets;
drop policy if exists assets_update_owner_admin_technician on public.assets;

create policy assets_select_policy
on public.assets
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.current_user_role() in ('admin', 'approver', 'technician', 'auditor')
);

create policy assets_insert_customer_only
on public.assets
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and public.current_user_role() = 'customer'
);

create policy assets_update_owner_admin_technician
on public.assets
for update
to authenticated
using (
  owner_id = auth.uid()
  or public.current_user_role() in ('admin', 'technician')
)
with check (
  owner_id = auth.uid()
  or public.current_user_role() in ('admin', 'technician')
);

drop policy if exists tickets_select_policy on public.destruction_tickets;
drop policy if exists tickets_insert_customer_only on public.destruction_tickets;
drop policy if exists tickets_update_staff_only on public.destruction_tickets;
drop policy if exists tickets_delete_admin_only on public.destruction_tickets;

create policy tickets_select_policy
on public.destruction_tickets
for select
to authenticated
using (
  customer_id = auth.uid()
  or public.current_user_role() in ('admin', 'approver', 'technician', 'auditor')
);

-- Required project rule: only Customer / Asset Owner users can create tickets.
create policy tickets_insert_customer_only
on public.destruction_tickets
for insert
to authenticated
with check (
  customer_id = auth.uid()
  and public.current_user_role() = 'customer'
);

create policy tickets_update_staff_only
on public.destruction_tickets
for update
to authenticated
using (public.current_user_role() in ('admin', 'approver', 'technician'))
with check (public.current_user_role() in ('admin', 'approver', 'technician'));

create policy tickets_delete_admin_only
on public.destruction_tickets
for delete
to authenticated
using (public.current_user_role() = 'admin');

drop policy if exists audit_select_admin_auditor on public.audit_logs;
drop policy if exists audit_insert_authenticated on public.audit_logs;

create policy audit_select_admin_auditor
on public.audit_logs
for select
to authenticated
using (public.current_user_role() in ('admin', 'auditor'));

create policy audit_insert_authenticated
on public.audit_logs
for insert
to authenticated
with check (actor_id = auth.uid());
