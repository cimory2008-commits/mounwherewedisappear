create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  roblox_user_id bigint not null unique,
  username text not null,
  displayname text not null,
  avatar_url text,
  total_summit integer not null default 0 check (total_summit >= 0),
  total_playtime bigint not null default 0 check (total_playtime >= 0), -- detik
  updated_at timestamptz not null default now()
);
create index if not exists players_summit_idx on public.players (total_summit desc, roblox_user_id);
create index if not exists players_playtime_idx on public.players (total_playtime desc, roblox_user_id);
create index if not exists players_username_idx on public.players (lower(username));
-- Tidak ada policy: anon/public tidak bisa akses. Hanya backend (service role) yang membaca/menulis.
alter table public.players enable row level security;

-- Login lewat kode di dalam game
create table if not exists public.login_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  pending_token text not null unique,
  roblox_user_id bigint not null,
  status text not null default 'pending' check (status in ('pending','verified','used')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index if not exists login_codes_active_code_idx on public.login_codes (code) where status = 'pending';
create index if not exists login_codes_user_idx on public.login_codes (roblox_user_id);
alter table public.login_codes enable row level security;
