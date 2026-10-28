-- Optional cloud features. Apply in a Supabase project, then verify RLS before launch.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public, anon, authenticated;

create function private.is_site_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.admin_users where user_id = (select auth.uid())); $$;
revoke all on function private.is_site_admin() from public, anon, authenticated;
grant execute on function private.is_site_admin() to authenticated;

create function public.is_site_admin() returns boolean
language sql stable security invoker set search_path = ''
as $$ select private.is_site_admin(); $$;
revoke all on function public.is_site_admin() from public, anon, authenticated;
grant execute on function public.is_site_admin() to authenticated;

create table public.user_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 5000000),
  updated_at timestamptz not null default now()
);
alter table public.user_backups enable row level security;
revoke all on public.user_backups from public, anon, authenticated;
grant select, insert, update, delete on public.user_backups to authenticated;
create policy backup_select on public.user_backups for select to authenticated using ((select auth.uid()) = user_id);
create policy backup_insert on public.user_backups for insert to authenticated with check ((select auth.uid()) = user_id);
create policy backup_update on public.user_backups for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy backup_delete on public.user_backups for delete to authenticated using ((select auth.uid()) = user_id);

create table public.site_content (
  id smallint primary key check (id = 1),
  revision integer not null check (revision > 0),
  catalog jsonb not null,
  settings jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
revoke all on public.site_content from public, anon, authenticated;
grant select on public.site_content to anon, authenticated;
create policy content_public_read on public.site_content for select to anon, authenticated using (true);

create table public.content_revisions (
  revision integer primary key,
  catalog jsonb not null,
  settings jsonb not null,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.content_revisions enable row level security;
revoke all on public.content_revisions from public, anon, authenticated;
grant select on public.content_revisions to authenticated;
create policy revision_admin_read on public.content_revisions for select to authenticated using ((select private.is_site_admin()));

create function private.publish_site(p_catalog jsonb, p_settings jsonb, p_expected_revision integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare current_revision integer; next_revision integer;
begin
  if not private.is_site_admin() then raise exception 'admin access required' using errcode = '42501'; end if;
  if jsonb_typeof(p_catalog) is distinct from 'object' or jsonb_typeof(p_catalog->'names') is distinct from 'array'
     or jsonb_array_length(p_catalog->'names') < 1 or jsonb_array_length(p_catalog->'names') > 100000
     or jsonb_typeof(p_settings) is distinct from 'object' or pg_column_size(p_catalog) > 5000000 then
    raise exception 'invalid content';
  end if;
  -- An advisory lock also serializes the first publication, when no row exists yet.
  perform pg_advisory_xact_lock(718611, 1);
  select revision into current_revision from public.site_content where id = 1 for update;
  current_revision := coalesce(current_revision, 0);
  if p_expected_revision is distinct from current_revision then raise exception 'content changed since preview' using errcode = '40001'; end if;
  next_revision := current_revision + 1;
  insert into public.content_revisions(revision, catalog, settings, author_id) values(next_revision, p_catalog, p_settings, (select auth.uid()));
  insert into public.site_content(id, revision, catalog, settings) values(1, next_revision, p_catalog, p_settings)
    on conflict (id) do update set revision = excluded.revision, catalog = excluded.catalog, settings = excluded.settings, updated_at = now();
  return next_revision;
end; $$;
revoke all on function private.publish_site(jsonb,jsonb,integer) from public, anon, authenticated;
grant execute on function private.publish_site(jsonb,jsonb,integer) to authenticated;

create function public.publish_site(p_catalog jsonb, p_settings jsonb, p_expected_revision integer)
returns integer language sql security invoker set search_path = ''
as $$ select private.publish_site(p_catalog, p_settings, p_expected_revision); $$;
revoke all on function public.publish_site(jsonb,jsonb,integer) from public, anon, authenticated;
grant execute on function public.publish_site(jsonb,jsonb,integer) to authenticated;
