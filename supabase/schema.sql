create extension if not exists "pgcrypto";

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null,
  address text,
  opening_balance numeric(14,2) not null default 0,
  opening_balance_date date,
  created_at timestamptz not null default now()
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  company_id uuid references companies(id) on delete set null,
  allowed_transaction_types text[] not null default array['cash', 'upi', 'cheque'],
  allowed_site_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount numeric(14,2) not null check (amount > 0),
  transaction_type text not null check (transaction_type in ('cash', 'upi', 'cheque')),
  entry_type text not null check (entry_type in ('credit', 'debit')),
  upi_transaction_id text,
  cheque_number text,
  cheque_date date,
  cheque_status text,
  company_id uuid not null references companies(id) on delete restrict,
  vendor_id uuid not null references vendors(id) on delete restrict,
  site_id uuid not null references sites(id) on delete restrict,
  description text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint upi_requires_id check (transaction_type <> 'upi' or nullif(upi_transaction_id, '') is not null),
  constraint cheque_requires_number check (transaction_type <> 'cheque' or nullif(cheque_number, '') is not null)
);

alter table companies enable row level security;
alter table vendors enable row level security;
alter table sites enable row level security;
alter table profiles enable row level security;
alter table transactions enable row level security;

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.current_profile_company()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from profiles where id = auth.uid()
$$;

create policy "profiles read own or admin" on profiles
for select using (id = auth.uid() or public.current_profile_role() = 'admin');

create policy "profiles admin write" on profiles
for all using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "companies read authenticated" on companies
for select using (auth.uid() is not null);

create policy "companies admin write" on companies
for all using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "vendors read authenticated" on vendors
for select using (auth.uid() is not null);

create policy "vendors admin write" on vendors
for all using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "sites read authenticated" on sites
for select using (auth.uid() is not null);

create policy "sites admin write" on sites
for all using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy "transactions read scoped" on transactions
for select using (
  public.current_profile_role() = 'admin'
  or company_id = public.current_profile_company()
);

create policy "transactions insert scoped" on transactions
for insert with check (
  public.current_profile_role() = 'admin'
  or (
    company_id = public.current_profile_company()
    and exists (
      select 1
      from profiles
      where id = auth.uid()
        and site_id = any(allowed_site_ids)
        and transaction_type = any(allowed_transaction_types)
    )
  )
);

create policy "transactions delete scoped" on transactions
for delete using (
  public.current_profile_role() = 'admin'
  or (
    company_id = public.current_profile_company()
    and exists (
      select 1
      from profiles
      where id = auth.uid()
        and site_id = any(allowed_site_ids)
    )
  )
);

insert into companies (name, owner_name, address)
values
  ('SK enterprises', 'SK Enterprise Owner', 'SK enterprises site'),
  ('RK enterprises', 'RK Enterprise Owner', 'RK enterprises site'),
  ('AR enterprises', 'AR Enterprise Owner', 'AR enterprises site')
on conflict do nothing;

-- After creating your first Auth user in Supabase, run this with that user's id:
-- insert into profiles (id, email, full_name, role)
-- values ('AUTH_USER_UUID', 'admin@example.com', 'Admin', 'admin')
-- on conflict (id) do update set role = 'admin';
