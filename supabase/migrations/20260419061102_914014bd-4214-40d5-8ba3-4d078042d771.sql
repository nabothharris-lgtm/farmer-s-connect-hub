-- Enum for roles
create type public.app_role as enum ('farmer', 'expert', 'store', 'agent', 'admin');

-- Profiles table (one per auth user)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  location_lat double precision,
  location_lng double precision,
  location_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- User roles (separate table to avoid privilege escalation)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Security definer role check
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Expert profile details
create table public.expert_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  specialty text not null,
  bio text,
  hourly_rate numeric(10,2) not null default 0,
  years_experience int not null default 0,
  verified boolean not null default false,
  rating numeric(3,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expert_profiles enable row level security;

-- Bookings
create type public.booking_status as enum ('pending', 'accepted', 'completed', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'released');

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references auth.users(id) on delete cascade,
  expert_id uuid not null references auth.users(id) on delete cascade,
  scheduled_for timestamptz not null,
  status public.booking_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  price numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger expert_profiles_updated_at before update on public.expert_profiles
  for each row execute function public.set_updated_at();
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== RLS Policies =====

-- profiles: signed in users can read; users update own
create policy "Profiles are viewable by authenticated"
  on public.profiles for select to authenticated using (true);

create policy "Users insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- user_roles: user can read own roles; only admins manage
create policy "Users view own roles"
  on public.user_roles for select to authenticated using (auth.uid() = user_id);

create policy "Users insert own non-admin role on signup"
  on public.user_roles for insert to authenticated
  with check (auth.uid() = user_id and role <> 'admin');

create policy "Admins manage all roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- expert_profiles: anyone signed in views verified; expert manages own
create policy "Expert profiles viewable by authenticated"
  on public.expert_profiles for select to authenticated using (true);

create policy "Experts insert own expert profile"
  on public.expert_profiles for insert to authenticated
  with check (auth.uid() = id and public.has_role(auth.uid(), 'expert'));

create policy "Experts update own expert profile"
  on public.expert_profiles for update to authenticated using (auth.uid() = id);

-- bookings: farmer creates; both parties view; expert updates status
create policy "Farmer or expert view their bookings"
  on public.bookings for select to authenticated
  using (auth.uid() = farmer_id or auth.uid() = expert_id);

create policy "Farmers create bookings"
  on public.bookings for insert to authenticated
  with check (auth.uid() = farmer_id and public.has_role(auth.uid(), 'farmer'));

create policy "Expert or farmer update own booking"
  on public.bookings for update to authenticated
  using (auth.uid() = expert_id or auth.uid() = farmer_id);