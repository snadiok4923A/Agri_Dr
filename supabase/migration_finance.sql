-- Actual, user-owned Cost & Profit records.
create table if not exists public.farm_expenses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    parcel_id uuid not null references public.land_parcels (id) on delete cascade,
    category text not null check (category in (
        'land_preparation', 'seeds', 'seed_treatment', 'fertilizers',
        'pesticides', 'labour', 'irrigation', 'machinery', 'harvesting',
        'transportation', 'other'
    )),
    amount numeric(12, 2) not null check (amount > 0),
    description text,
    expense_date date not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists farm_expenses_user_idx
    on public.farm_expenses (user_id, parcel_id, expense_date);

create table if not exists public.farm_financial_targets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    parcel_id uuid not null references public.land_parcels (id) on delete cascade,
    expected_production_kg numeric(12, 2) check (expected_production_kg > 0),
    expected_price_per_quintal numeric(12, 2) check (expected_price_per_quintal > 0),
    expected_selling_date date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, parcel_id)
);

alter table public.farm_expenses enable row level security;
alter table public.farm_financial_targets enable row level security;

drop policy if exists "farm_expenses_select_own" on public.farm_expenses;
create policy "farm_expenses_select_own" on public.farm_expenses for select using (auth.uid() = user_id);
drop policy if exists "farm_expenses_insert_own" on public.farm_expenses;
create policy "farm_expenses_insert_own" on public.farm_expenses for insert
with check (auth.uid() = user_id and exists (
    select 1 from public.land_parcels p
    where p.id = parcel_id and p.user_id = auth.uid()
));
drop policy if exists "farm_expenses_update_own" on public.farm_expenses;
create policy "farm_expenses_update_own" on public.farm_expenses for update
using (auth.uid() = user_id and exists (
    select 1 from public.land_parcels p
    where p.id = parcel_id and p.user_id = auth.uid()
))
with check (auth.uid() = user_id and exists (
    select 1 from public.land_parcels p
    where p.id = parcel_id and p.user_id = auth.uid()
));
drop policy if exists "farm_expenses_delete_own" on public.farm_expenses;
create policy "farm_expenses_delete_own" on public.farm_expenses for delete using (auth.uid() = user_id);

drop policy if exists "farm_financial_targets_select_own" on public.farm_financial_targets;
create policy "farm_financial_targets_select_own" on public.farm_financial_targets for select using (auth.uid() = user_id);
drop policy if exists "farm_financial_targets_insert_own" on public.farm_financial_targets;
create policy "farm_financial_targets_insert_own" on public.farm_financial_targets for insert
with check (auth.uid() = user_id and exists (
    select 1 from public.land_parcels p
    where p.id = parcel_id and p.user_id = auth.uid()
));
drop policy if exists "farm_financial_targets_update_own" on public.farm_financial_targets;
create policy "farm_financial_targets_update_own" on public.farm_financial_targets for update
using (auth.uid() = user_id and exists (
    select 1 from public.land_parcels p
    where p.id = parcel_id and p.user_id = auth.uid()
))
with check (auth.uid() = user_id and exists (
    select 1 from public.land_parcels p
    where p.id = parcel_id and p.user_id = auth.uid()
));
drop policy if exists "farm_financial_targets_delete_own" on public.farm_financial_targets;
create policy "farm_financial_targets_delete_own" on public.farm_financial_targets for delete using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists farm_expenses_touch on public.farm_expenses;
create trigger farm_expenses_touch before update on public.farm_expenses
for each row execute function public.touch_updated_at();
drop trigger if exists farm_financial_targets_touch on public.farm_financial_targets;
create trigger farm_financial_targets_touch before update on public.farm_financial_targets
for each row execute function public.touch_updated_at();
