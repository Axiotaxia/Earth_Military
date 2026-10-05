create table if not exists public.discord_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  discord_id text not null,
  discord_username text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists discord_verification_tokens_expires_at_idx
  on public.discord_verification_tokens (expires_at);

alter table public.discord_verification_tokens enable row level security;

revoke all on public.discord_verification_tokens from anon, authenticated;
