create table if not exists public.rpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  classification text not null,
  season_year text not null default 'live',
  source text not null default 'official',
  fetched_at timestamptz not null default now(),
  row_hash text not null,
  rows jsonb not null,
  last_updated text,
  test_mode boolean not null default false
);

create index if not exists rpi_snapshots_lookup_idx
  on public.rpi_snapshots (sport, classification, season_year, source, fetched_at desc);

create index if not exists rpi_snapshots_fetched_at_idx
  on public.rpi_snapshots (fetched_at desc);

alter table public.rpi_snapshots enable row level security;
