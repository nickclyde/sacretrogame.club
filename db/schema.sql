create table if not exists ballots (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  name_key        text not null unique,
  slot_ranking    jsonb not null,
  week_ranking    jsonb not null,
  library_ranking jsonb not null,
  drive_minutes   jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
