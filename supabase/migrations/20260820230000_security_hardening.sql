alter table public.users
  add column if not exists password_iterations integer not null default 100000;

create unique index if not exists users_single_active_admin
  on public.users (role)
  where role = 'admin' and status = 'active' and password_hash <> '';

create table if not exists public.auth_rate_limits (
  key_hash text primary key,
  action text not null,
  attempts integer not null default 0,
  window_started_at text not null,
  expires_at text not null,
  updated_at text not null default (current_timestamp::text),
  constraint auth_rate_limits_attempts_nonnegative check (attempts >= 0)
);

create index if not exists auth_rate_limits_expires_idx
  on public.auth_rate_limits (expires_at);

alter table public.auth_rate_limits enable row level security;

revoke all on table
  public.users,
  public.auth_sessions,
  public.auth_invitations,
  public.auth_rate_limits,
  public.establishments,
  public.categories,
  public.products,
  public.option_groups,
  public.product_options,
  public.media
from anon, authenticated;

grant select, insert, update, delete
  on table public.auth_rate_limits
  to oxemenu_netlify;

drop policy if exists oxemenu_netlify_app_access
  on public.auth_rate_limits;

create policy oxemenu_netlify_app_access
  on public.auth_rate_limits
  for all
  to oxemenu_netlify
  using (true)
  with check (true);
