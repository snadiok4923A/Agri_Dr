-- ============================================================================
-- migration_onboarding.sql — Krisiveda new-user onboarding schema.
--
-- Run ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: everything uses IF NOT EXISTS / OR REPLACE.
--
-- Tables (all owned rows keyed by auth.uid(), full RLS):
--   profiles      — one row per user: language choice + onboarding flags
--   farms         — one row per user (farm name)
--   land_parcels  — 1..N per farm: ordered parcels with area, unit,
--                   rice variety and crop stage
--
-- The app degrades gracefully when this schema is absent (guest/local-only
-- mode), but running it unlocks real per-user persistence.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles — one per auth user
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
    id                    uuid primary key references auth.users (id) on delete cascade,
    selected_language     text not null default 'en'
                          check (selected_language in ('en', 'bn', 'hi', 'te', 'ta')),
    onboarding_completed  boolean not null default false,
    onboarding_skipped    boolean not null default false,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
    on public.profiles for select
    using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
    on public.profiles for insert
    with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- farms — one per user (the user's farm identity)
-- ---------------------------------------------------------------------------
create table if not exists public.farms (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null unique references auth.users (id) on delete cascade,
    name        text not null default '',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

alter table public.farms enable row level security;

drop policy if exists "farms_select_own" on public.farms;
create policy "farms_select_own"
    on public.farms for select
    using (auth.uid() = user_id);

drop policy if exists "farms_insert_own" on public.farms;
create policy "farms_insert_own"
    on public.farms for insert
    with check (auth.uid() = user_id);

drop policy if exists "farms_update_own" on public.farms;
create policy "farms_update_own"
    on public.farms for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "farms_delete_own" on public.farms;
create policy "farms_delete_own"
    on public.farms for delete
    using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- land_parcels — ordered parcels of one farm
-- ---------------------------------------------------------------------------
create table if not exists public.land_parcels (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users (id) on delete cascade,
    farm_id       uuid not null references public.farms (id) on delete cascade,
    order_index   integer not null,
    area          numeric(10, 2) not null check (area > 0),
    unit          text not null default 'acre'
                  check (unit in ('acre', 'hectare', 'bigha', 'katha', 'decimal')),
    rice_variety  text not null default '',
    crop_stage    text not null default '',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    unique (farm_id, order_index)
);

create index if not exists land_parcels_user_idx on public.land_parcels (user_id);
create index if not exists land_parcels_farm_idx on public.land_parcels (farm_id, order_index);

alter table public.land_parcels enable row level security;

drop policy if exists "land_parcels_select_own" on public.land_parcels;
create policy "land_parcels_select_own"
    on public.land_parcels for select
    using (auth.uid() = user_id);

drop policy if exists "land_parcels_insert_own" on public.land_parcels;
create policy "land_parcels_insert_own"
    on public.land_parcels for insert
    with check (auth.uid() = user_id);

drop policy if exists "land_parcels_update_own" on public.land_parcels;
create policy "land_parcels_update_own"
    on public.land_parcels for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "land_parcels_delete_own" on public.land_parcels;
create policy "land_parcels_delete_own"
    on public.land_parcels for delete
    using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at touch triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
    before update on public.profiles
    for each row execute function public.touch_updated_at();

drop trigger if exists farms_touch on public.farms;
create trigger farms_touch
    before update on public.farms
    for each row execute function public.touch_updated_at();

drop trigger if exists land_parcels_touch on public.land_parcels;
create trigger land_parcels_touch
    before update on public.land_parcels
    for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile for every new auth user (Google sign-up included)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id)
    values (new.id)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
