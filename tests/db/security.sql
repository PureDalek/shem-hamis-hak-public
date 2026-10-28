\set ON_ERROR_STOP on
insert into auth.users(id,email) values
 ('11111111-1111-1111-1111-111111111111','first@example.test'),
 ('22222222-2222-2222-2222-222222222222','second@example.test'),
 ('33333333-3333-3333-3333-333333333333','admin@example.test');
insert into public.admin_users(user_id) values ('33333333-3333-3333-3333-333333333333');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.user_backups(user_id,payload) values ('11111111-1111-1111-1111-111111111111','{"owner":1}');
do $$ begin
  if (select count(*) from public.user_backups) <> 1 then raise exception 'Owner cannot see own backup'; end if;
  begin
    insert into public.user_backups(user_id,payload) values ('22222222-2222-2222-2222-222222222222','{}');
    raise exception 'User could write another user backup';
  exception when insufficient_privilege then null; end;
  begin
    perform public.publish_site('{"names":[{"id":"n"}]}'::jsonb,'{}'::jsonb,0);
    raise exception 'Non-admin could publish';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.admin_users(user_id) values ('11111111-1111-1111-1111-111111111111');
    raise exception 'User could grant themselves admin access';
  exception when insufficient_privilege then null; end;
  begin
    update public.site_content set revision = 999;
    raise exception 'User could directly modify published content';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.content_revisions) <> 0 then raise exception 'Non-admin could read history'; end if;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  if (select count(*) from public.user_backups) <> 0 then raise exception 'Another user could read the backup'; end if;
  update public.user_backups set payload = '{}' where user_id = '11111111-1111-1111-1111-111111111111';
  if found then raise exception 'Another user could modify the backup'; end if;
  delete from public.user_backups where user_id = '11111111-1111-1111-1111-111111111111';
  if found then raise exception 'Another user could delete the backup'; end if;
end $$;

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ declare rev integer; begin
  if not public.is_site_admin() then raise exception 'Administrator was not recognized'; end if;
  rev := public.publish_site('{"source":"https://example.test","names":[{"id":"one"}]}'::jsonb,'{"setting":1}'::jsonb,0);
  if rev <> 1 then raise exception 'First publication revision is wrong'; end if;
  begin
    perform public.publish_site('{"names":[{"id":"two"}]}'::jsonb,'{}'::jsonb,0);
    raise exception 'Stale publication was accepted';
  exception when serialization_failure then null; end;
  rev := public.publish_site('{"names":[{"id":"two"}]}'::jsonb,'{"setting":2}'::jsonb,1);
  if rev <> 2 or (select count(*) from public.content_revisions) <> 2 then raise exception 'Revision history is incomplete'; end if;
end $$;

reset role;
set role anon;
do $$ begin
  if (select revision from public.site_content where id = 1) <> 2 then raise exception 'Public cannot read published content'; end if;
  begin
    perform public.publish_site('{"names":[{"id":"x"}]}'::jsonb,'{}'::jsonb,2);
    raise exception 'Anonymous visitor could publish';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.user_backups;
    raise exception 'Anonymous visitor could read backups';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'Database authorization checks passed' as result;
