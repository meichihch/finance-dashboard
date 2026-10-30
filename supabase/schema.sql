-- Finance dashboard — run once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to re-run: every statement is idempotent.

-- ── App state ────────────────────────────────────────────────────────────────
-- The whole app state (transactions, budgets, recurring items, goal checks,
-- settings) as one JSON document per user. It is small and edited by one person,
-- so one row keeps the app logic unchanged. `version` guards against a stale
-- device overwriting newer edits made on another one.
create table if not exists public.app_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  version    bigint      not null default 1,
  updated_at timestamptz not null default now()
);

-- ── Monthly investment actuals ───────────────────────────────────────────────
-- Uploaded from the Mac by the portfolio's update.command — the ledger itself
-- (portfolio/lots.csv) stays on the Mac.
create table if not exists public.investment_months (
  user_id    uuid not null references auth.users (id) on delete cascade,
  month      text not null check (month ~ '^\d{4}-\d{2}$'),
  amount_twd numeric not null,
  accounts   jsonb not null default '{}'::jsonb,   -- account name -> NT$
  primary key (user_id, month)
);

create table if not exists public.investment_meta (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  budget_twd  numeric,        -- portfolio/budget.csv monthly_twd
  fx_twd      numeric,        -- TWD per USD used for the figures
  fx_as_of    text,
  synced_at   timestamptz not null default now()
);

-- ── Data API access ──────────────────────────────────────────────────────────
-- The project is created with "Automatically expose new tables" off, so grant
-- explicitly: signed-in users only. Anonymous visitors get no table access at
-- all, and RLS below further limits signed-in users to their own rows.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.app_state         to authenticated;
grant select, insert, update, delete on public.investment_months to authenticated;
grant select, insert, update, delete on public.investment_meta   to authenticated;
revoke all on public.app_state, public.investment_months, public.investment_meta from anon;

-- ── Row Level Security: every row is visible only to its owner ───────────────
alter table public.app_state         enable row level security;
alter table public.investment_months enable row level security;
alter table public.investment_meta   enable row level security;

drop policy if exists "own rows" on public.app_state;
create policy "own rows" on public.app_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.investment_months;
create policy "own rows" on public.investment_months
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.investment_meta;
create policy "own rows" on public.investment_meta
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
