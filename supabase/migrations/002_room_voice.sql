-- Separate from card state; existing Shanghai and other game tables are unchanged.
create table if not exists public.shanghai_voice (
 code text primary key references public.shanghai_rooms(code) on delete cascade,
 version integer not null default 1 check (version > 0),
 state jsonb not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '24 hours')
);
alter table public.shanghai_voice enable row level security;
revoke all on public.shanghai_voice from public, anon, authenticated;
grant select, insert, update, delete on public.shanghai_voice to service_role;
