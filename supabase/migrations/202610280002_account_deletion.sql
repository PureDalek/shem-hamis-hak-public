-- Self-service account deletion is limited to the current JWT subject.
create function private.delete_own_account() returns void
language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'sign-in required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(718611, 2);
  if exists(select 1 from public.admin_users where user_id = caller)
     and (select count(*) from public.admin_users) <= 1 then
    raise exception 'assign another admin before deleting the final administrator' using errcode = '42501';
  end if;
  delete from auth.users where id = caller;
end; $$;
revoke all on function private.delete_own_account() from public, anon, authenticated;
grant execute on function private.delete_own_account() to authenticated;

create function public.delete_own_account() returns void
language sql security invoker set search_path = ''
as $$ select private.delete_own_account(); $$;
revoke all on function public.delete_own_account() from public, anon, authenticated;
grant execute on function public.delete_own_account() to authenticated;
