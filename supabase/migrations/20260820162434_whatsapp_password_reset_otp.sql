alter table public.users
  add column if not exists whatsapp text not null default '';

create table if not exists public.password_reset_challenges (
  user_id text primary key references public.users(id) on delete cascade,
  code_hash text not null,
  expires_at text not null,
  attempts integer not null default 0,
  send_count integer not null default 1,
  window_started_at text not null,
  last_sent_at text not null,
  created_at text not null default (current_timestamp::text)
);

create index if not exists password_reset_challenges_expires_idx
  on public.password_reset_challenges (expires_at);

alter table public.password_reset_challenges enable row level security;

revoke all on table public.password_reset_challenges from anon, authenticated;
grant select, insert, update, delete
  on table public.password_reset_challenges to oxemenu_netlify;

drop policy if exists oxemenu_netlify_app_access
  on public.password_reset_challenges;

create policy oxemenu_netlify_app_access
  on public.password_reset_challenges
  for all
  to oxemenu_netlify
  using (true)
  with check (true);
