/*
# EduBridge Core Tenant & Identity Schema

1. Purpose
   Establishes the multi-tenant foundation for the EduBridge school management platform.
   Every school is an isolated tenant. All school-scoped data references a `school_id`
   so that Row Level Security can guarantee School A can never see School B's data.

2. New Tables
   - `schools` — tenant registry. One row per school.
   - `app_users` — profile extension of `auth.users`. Stores role, tenant, profile fields.
   - `subscriptions` — billing/subscription state per school.
   - `invitations` — secure, one-time-use, expiring invitation tokens.
   - `audit_logs` — platform-wide audit trail.

3. Security
   - RLS enabled on every table.
   - Helper functions is_super_admin(), user_school_id(), is_school_member() defined after tables.
*/

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  address text,
  email text,
  phone text,
  principal_name text,
  admin_name text,
  admin_email text,
  admin_phone text,
  status text not null default 'pending' check (status in ('pending','active','suspended','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schools enable row level security;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  role text not null check (role in ('super_admin','school_admin','teacher','parent')),
  full_name text not null,
  phone text,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.app_users enable row level security;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  plan text not null default 'starter' check (plan in ('starter','growth','enterprise')),
  status text not null default 'trial' check (status in ('trial','active','past_due','cancelled','suspended')),
  seats int not null default 0,
  student_limit int,
  billing_cycle text default 'annual' check (billing_cycle in ('monthly','annual')),
  amount numeric(10,2) default 0,
  currency text default 'KES',
  trial_ends_at timestamptz,
  renews_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id)
);

alter table public.subscriptions enable row level security;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  token text not null unique,
  role text not null check (role in ('school_admin','teacher','parent')),
  email text,
  phone text,
  full_name text,
  status text not null default 'pending' check (status in ('pending','accepted','expired','cancelled')),
  channel text default 'email' check (channel in ('email','sms')),
  metadata jsonb default '{}'::jsonb,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invitations_token on public.invitations(token);
create index if not exists idx_invitations_school_status on public.invitations(school_id, status);

alter table public.invitations enable row level security;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  actor_id uuid references auth.users(id),
  actor_role text,
  action text not null,
  entity text,
  entity_id uuid,
  detail jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_school on public.audit_logs(school_id);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin',
    false
  );
$$;

create or replace function public.user_school_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select school_id from public.app_users where user_id = auth.uid();
$$;

create or replace function public.is_school_member(expected_school_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or exists (
      select 1 from public.app_users
      where user_id = auth.uid() and school_id = expected_school_id
    );
$$;

-- schools policies
drop policy if exists "schools_select_super_or_member" on public.schools;
create policy "schools_select_super_or_member"
on public.schools for select to authenticated
using (public.is_super_admin() or public.is_school_member(id));

drop policy if exists "schools_insert_super_admin" on public.schools;
create policy "schools_insert_super_admin"
on public.schools for insert to authenticated
with check (public.is_super_admin());

drop policy if exists "schools_update_super_admin" on public.schools;
create policy "schools_update_super_admin"
on public.schools for update to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "schools_update_own_school_admin" on public.schools;
create policy "schools_update_own_school_admin"
on public.schools for update to authenticated
using (public.is_school_member(id) and not public.is_super_admin())
with check (public.is_school_member(id) and not public.is_super_admin());

drop policy if exists "schools_delete_super_admin" on public.schools;
create policy "schools_delete_super_admin"
on public.schools for delete to authenticated
using (public.is_super_admin());

-- app_users policies
drop policy if exists "app_users_select_self_or_admin" on public.app_users;
create policy "app_users_select_self_or_admin"
on public.app_users for select to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
  or (public.is_school_member(school_id) and role <> 'super_admin')
);

drop policy if exists "app_users_insert_self" on public.app_users;
create policy "app_users_insert_self"
on public.app_users for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "app_users_update_self" on public.app_users;
create policy "app_users_update_self"
on public.app_users for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "app_users_update_own_school_admin" on public.app_users;
create policy "app_users_update_own_school_admin"
on public.app_users for update to authenticated
using (
  public.is_school_member(school_id)
  and role in ('school_admin','teacher','parent')
)
with check (
  public.is_school_member(school_id)
  and role in ('school_admin','teacher','parent')
);

drop policy if exists "app_users_delete_super_admin" on public.app_users;
create policy "app_users_delete_super_admin"
on public.app_users for delete to authenticated
using (public.is_super_admin());

drop policy if exists "app_users_delete_own_school_admin" on public.app_users;
create policy "app_users_delete_own_school_admin"
on public.app_users for delete to authenticated
using (
  public.is_school_member(school_id)
  and role in ('school_admin','teacher','parent')
);

-- subscriptions policies
drop policy if exists "subscriptions_select_super_or_member" on public.subscriptions;
create policy "subscriptions_select_super_or_member"
on public.subscriptions for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "subscriptions_all_super_admin" on public.subscriptions;
create policy "subscriptions_all_super_admin"
on public.subscriptions for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

-- invitations policies
drop policy if exists "invitations_select_by_token_public" on public.invitations;
create policy "invitations_select_by_token_public"
on public.invitations for select to anon, authenticated
using (token is not null);

drop policy if exists "invitations_select_super_or_school_admin" on public.invitations;
create policy "invitations_select_super_or_school_admin"
on public.invitations for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "invitations_insert_super_or_school_admin" on public.invitations;
create policy "invitations_insert_super_or_school_admin"
on public.invitations for insert to authenticated
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "invitations_update_super_or_school_admin" on public.invitations;
create policy "invitations_update_super_or_school_admin"
on public.invitations for update to authenticated
using (public.is_super_admin() or public.is_school_member(school_id))
with check (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "invitations_delete_super_or_school_admin" on public.invitations;
create policy "invitations_delete_super_or_school_admin"
on public.invitations for delete to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

-- audit_logs policies
drop policy if exists "audit_logs_select_super_or_member" on public.audit_logs;
create policy "audit_logs_select_super_or_member"
on public.audit_logs for select to authenticated
using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_authenticated"
on public.audit_logs for insert to authenticated
with check (auth.uid() is not null);