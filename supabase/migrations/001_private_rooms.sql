-- Run once in the dedicated Shanghai project's SQL Editor.
-- Full hands and seat-key hashes are server-only. Browsers never query this table.
create table if not exists public.shanghai_rooms (
 code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
 version integer not null default 1 check (version > 0),
 state jsonb not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '24 hours')
);
alter table public.shanghai_rooms enable row level security;
revoke all on public.shanghai_rooms from public, anon, authenticated;
grant select, insert, update, delete on public.shanghai_rooms to service_role;
create index if not exists shanghai_rooms_expiry on public.shanghai_rooms(expires_at);
-- No anon/authenticated policy is intentional: only the Netlify function's server key can access it.
-- Optional housekeeping: delete from public.shanghai_rooms where expires_at < now();
