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

-- Accounts for the game of the month. People sign in with Discord, Google, or an emailed link.
create table if not exists users (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null,
  -- Verified email, used only to sign in and to link sign-in methods. Never shown.
  email        text unique,
  created_at   timestamptz not null default now()
);

create table if not exists identities (
  provider   text not null,
  subject    text not null,
  user_id    uuid not null references users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, subject)
);

-- Only a hash of the session token is stored.
create table if not exists sessions (
  token_hash text primary key,
  user_id    uuid not null references users on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists email_tokens (
  token_hash text primary key,
  email      text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_tokens_email on email_tokens (email, created_at);

-- One row per game of the month vote, keyed by the month the winning game is discussed.
create table if not exists gotm_cycles (
  key                  text primary key,
  vote_opens_at        timestamptz,
  vote_closes_at       timestamptz,
  opened_announced_at  timestamptz,
  winner_announced_at  timestamptz,
  winner_nomination_id uuid
);

create table if not exists nominations (
  id             uuid primary key default gen_random_uuid(),
  cycle          text not null,
  user_id        uuid not null references users on delete cascade,
  igdb_id        integer,
  title          text not null,
  platform       text not null,
  year           integer,
  cover_url      text,
  cover_width    integer,
  cover_height   integer,
  info_url       text,
  pitch          text,
  created_at     timestamptz not null default now(),
  removed_at     timestamptz
);
create unique index if not exists nominations_igdb on nominations (cycle, igdb_id)
  where removed_at is null and igdb_id is not null;
create unique index if not exists nominations_title on nominations (cycle, lower(title), platform)
  where removed_at is null;

create table if not exists game_ballots (
  cycle      text not null,
  user_id    uuid not null references users on delete cascade,
  ranking    jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (cycle, user_id)
);
