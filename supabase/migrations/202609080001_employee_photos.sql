begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('employee-photos','employee-photos',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy employee_photos_read on storage.objects for select to authenticated
using (bucket_id='employee-photos' and exists (
  select 1 from public.employees e where e.museum_id=public.current_user_museum_id()
    and e.museum_id::text=(storage.foldername(name))[1] and e.id::text=(storage.foldername(name))[2]
    and (public.has_permission('employees.read.all') or e.profile_id=auth.uid())
));
create policy employee_photos_insert on storage.objects for insert to authenticated
with check (bucket_id='employee-photos' and array_length(storage.foldername(name),1)=2 and exists (
  select 1 from public.employees e where e.museum_id=public.current_user_museum_id()
    and e.museum_id::text=(storage.foldername(name))[1] and e.id::text=(storage.foldername(name))[2]
    and (public.has_permission('employees.update.basic') or e.profile_id=auth.uid())
));
-- Immutable object names: no client UPDATE/DELETE policy. A failed commit leaves
-- an unreferenced private object for a separately authorized retention cleanup.
create function public.set_employee_photo(p_employee_id uuid,p_path text,p_expected_photo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.employees%rowtype;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select * into e from public.employees where id=p_employee_id
    and museum_id=public.current_user_museum_id() for update;
  if not found or not (public.has_permission('employees.update.basic') or e.profile_id=auth.uid()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if nullif(e.photo_url,'') is distinct from nullif(p_expected_photo,'') then
    raise exception 'PHOTO_CHANGED_RELOAD' using errcode='40001';
  end if;
  if p_path is not null and (
    p_path !~ ('^'||e.museum_id::text||'/'||e.id::text||'/[0-9a-f-]+\.(png|jpeg|webp)$')
    or not exists(select 1 from storage.objects where bucket_id='employee-photos' and name=p_path)
  ) then raise exception 'INVALID_PHOTO' using errcode='22023'; end if;
  update public.employees set photo_url=case when p_path is null then null else 'storage:employee-photos/'||p_path end where id=e.id;
  return jsonb_build_object('saved',true);
end;
$$;
alter function public.set_employee_photo(uuid,text,text) owner to postgres;
revoke all on function public.set_employee_photo(uuid,text,text) from public,anon,service_role;
grant execute on function public.set_employee_photo(uuid,text,text) to authenticated;

create function public.protect_employee_photo_reference() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (TG_OP='INSERT' and new.photo_url is not null)
     or (TG_OP='UPDATE' and new.photo_url is distinct from old.photo_url) then
    if current_user <> 'postgres' and auth.role() is distinct from 'service_role' then
      raise exception 'Use set_employee_photo' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger employee_photo_reference_guard before insert or update on public.employees
for each row execute function public.protect_employee_photo_reference();
commit;
