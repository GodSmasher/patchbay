-- Patchbay hosted-v1 initial schema
-- Run in Supabase SQL editor after project creation (EU region).
-- Week-1 scaffolding: tables + RLS policies. No business-logic triggers yet.
--
-- Table map:
--   users         — profile row keyed to auth.users (one-to-one, created on sign-up)
--   subscriptions — Polar subscription state, source of truth is Polar webhooks
--   endpoints     — MCP server URLs a user wants scanned
--   scans         — one row per scan, references endpoint
--   findings      — one row per finding, references scan
--   alerts        — rendered email alerts, one row per send
--
-- Convention: every table has id uuid pk, created_at, updated_at, owner_id (where applicable).
-- RLS: owner-only access on owned rows. Service role bypasses RLS for cron writes.

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- -- profiles -----------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users on delete cascade,
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.users enable row level security;
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (auth.uid() = id);
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (auth.uid() = id);

-- -- subscriptions ----------------------------------------------------
-- source of truth is Polar; webhook writes here as service_role.
create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  polar_subscription_id text unique,
  polar_customer_id text,
  plan text not null,            -- 'single-monthly', 'single-annual-founding', 'single-annual', 'team-monthly'
  status text not null,          -- 'active', 'canceled', 'past_due', 'trialing'
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  seats_included int not null default 1,
  endpoints_included int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_owner_idx on public.subscriptions(owner_id);
create index if not exists subscriptions_polar_idx on public.subscriptions(polar_subscription_id);

alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select using (auth.uid() = owner_id);

-- -- endpoints --------------------------------------------------------
create table if not exists public.endpoints (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  url text not null,
  display_name text,
  is_private boolean not null default false,
  auth_token_encrypted bytea,     -- encrypted via pgp_sym_encrypt(... supabase_vault)
  scan_schedule text not null default 'weekly',   -- 'daily', 'weekly'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint endpoints_unique_owner_url unique (owner_id, url)
);

create index if not exists endpoints_owner_idx on public.endpoints(owner_id);

alter table public.endpoints enable row level security;
drop policy if exists endpoints_crud_own on public.endpoints;
create policy endpoints_crud_own on public.endpoints
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- -- scans + findings -----------------------------------------------
create table if not exists public.scans (
  id uuid primary key default uuid_generate_v4(),
  endpoint_id uuid not null references public.endpoints(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  grade text,                      -- 'A' | 'B' | 'C' | 'D' | 'F'
  score int,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms int,
  raw_report jsonb,                -- full patchbay audit JSON
  created_at timestamptz not null default now()
);

create index if not exists scans_endpoint_idx on public.scans(endpoint_id);
create index if not exists scans_owner_started_idx on public.scans(owner_id, started_at desc);

alter table public.scans enable row level security;
drop policy if exists scans_select_own on public.scans;
create policy scans_select_own on public.scans
  for select using (auth.uid() = owner_id);

create table if not exists public.findings (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  check_id text not null,          -- 'AUTH-001', 'POISONING-003', ...
  severity text not null,          -- 'critical' | 'high' | 'medium' | 'low' | 'info'
  verification text,               -- 'runtime-verified' | 'source-confirmed' | 'potential-fp'
  title text not null,
  evidence text,
  fix_guidance text,
  docs_url text,
  created_at timestamptz not null default now()
);

create index if not exists findings_scan_idx on public.findings(scan_id);
create index if not exists findings_owner_severity_idx on public.findings(owner_id, severity);

alter table public.findings enable row level security;
drop policy if exists findings_select_own on public.findings;
create policy findings_select_own on public.findings
  for select using (auth.uid() = owner_id);

-- -- alerts (rendered email sends) --------------------------------
create table if not exists public.alerts (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  scan_id uuid references public.scans(id) on delete set null,
  kind text not null,              -- 'grade-change', 'new-finding', 'weekly-digest'
  resend_email_id text,
  sent_at timestamptz,
  subject text,
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists alerts_owner_idx on public.alerts(owner_id);

alter table public.alerts enable row level security;
drop policy if exists alerts_select_own on public.alerts;
create policy alerts_select_own on public.alerts
  for select using (auth.uid() = owner_id);

-- -- updated_at triggers ------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['users','subscriptions','endpoints']
  loop
    execute format('drop trigger if exists touch_updated_at_%I on public.%I', t, t);
    execute format('create trigger touch_updated_at_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- End init.
