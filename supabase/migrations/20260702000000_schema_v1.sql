-- djmix schema v1
-- Tables:
--   profiles       — one row per auth user (auto-created on signup)
--   sets           — saved sequenced sets (small JSON docs)
--   track_features — community feature cache, keyed by audio content hash
--   user_tracks    — per-user library entries + manual BPM/key overrides
--
-- Privacy note: no raw audio is ever stored. track_features holds only derived,
-- non-invertible feature JSON.

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "profiles: insert self"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- sets
-- ─────────────────────────────────────────────────────────────────────────────
create table public.sets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null default 'Untitled set',
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sets enable row level security;

create index sets_user_id_idx on public.sets (user_id);

create policy "sets: select own"
  on public.sets for select to authenticated
  using (auth.uid() = user_id);

create policy "sets: insert own"
  on public.sets for insert to authenticated
  with check (auth.uid() = user_id);

create policy "sets: update own"
  on public.sets for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sets: delete own"
  on public.sets for delete to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- track_features (community cache)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.track_features (
  content_hash   text primary key,
  schema_version integer not null,
  features       jsonb not null,
  created_at     timestamptz not null default now()
);

alter table public.track_features enable row level security;

-- Accelerates F8 swap-suggestion queries over the feature JSON.
create index track_features_features_gin on public.track_features using gin (features);

-- Shared cache: any authenticated user may read and contribute. Entries are
-- immutable (no update/delete policy) so the first analyzer's result wins;
-- contributors insert with "on conflict do nothing" at the app layer.
create policy "track_features: select authenticated"
  on public.track_features for select to authenticated
  using (true);

create policy "track_features: insert authenticated"
  on public.track_features for insert to authenticated
  with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- user_tracks (per-user library + overrides)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.user_tracks (
  user_id      uuid not null references auth.users (id) on delete cascade,
  content_hash text not null,
  title        text,
  artist       text,
  -- Manual corrections layered over community features, e.g. {"bpm":128,"key":"8A"}.
  overrides    jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, content_hash)
);

alter table public.user_tracks enable row level security;

create policy "user_tracks: all own"
  on public.user_tracks for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at maintenance
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger sets_set_updated_at
  before update on public.sets
  for each row execute function public.set_updated_at();

create trigger user_tracks_set_updated_at
  before update on public.user_tracks
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- auto-create a profile row when a user signs up
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
