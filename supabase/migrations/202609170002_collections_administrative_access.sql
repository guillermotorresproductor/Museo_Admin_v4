-- Match the existing administrative workspace rule, using effective permissions.
-- No email allowlist, role assignments or changes to existing permission resolvers.
begin;
create function public.collection_can_write() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
  public.has_permission('collections.write')
  or public.has_permission('system.configure')
  or (public.has_permission('audit.read') and public.has_permission('notifications.manage'))
 )
$$;
create or replace function public.collection_can_read() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.has_permission('collections.read') or public.collection_can_write())
$$;
revoke all on function public.collection_can_write() from public,anon,authenticated;
grant execute on function public.collection_can_write() to authenticated;
create or replace function public.collection_save(p_id uuid, p_expected_version bigint, p_item jsonb, p_reason text)
returns public.collection_items language plpgsql security definer set search_path='' as $$
declare m uuid:=public.current_user_museum_id(); prev public.collection_items; saved public.collection_items; d jsonb:=coalesce(p_item->'details','{}'); k text;
begin
 if m is null or public.collection_can_write() is not true then raise exception 'COLLECTION_FORBIDDEN' using errcode='42501'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'CHANGE_REASON_REQUIRED' using errcode='22023'; end if;
 if jsonb_typeof(d)<>'object' then raise exception 'INVALID_DETAILS' using errcode='22023'; end if;
 for k in select jsonb_object_keys(d) loop
  if k not in ('author','dating','materials','dimensions','provenance','owner','acquisition','custody','donor','lender','received_date','fmv','currency','loan_reference','notes')
    or jsonb_typeof(d->k) not in ('string','null') then raise exception 'INVALID_DETAILS' using errcode='22023'; end if;
 end loop;
 if coalesce(d->>'fmv','')<>'' and ((d->>'fmv')::numeric<0 or (d->>'fmv')::numeric>999999999999.99) then raise exception 'INVALID_FMV' using errcode='22023'; end if;
 if coalesce(d->>'received_date','')<>'' then perform (d->>'received_date')::date; end if;
 if p_id is null then
  if p_expected_version is not null then raise exception 'INVALID_VERSION' using errcode='22023'; end if;
  insert into public.collection_items(museum_id,accession_number,title,description,category,location,condition,details,status,created_by,updated_by)
  values(m,btrim(p_item->>'accession_number'),btrim(p_item->>'title'),btrim(p_item->>'description'),btrim(p_item->>'category'),btrim(p_item->>'location'),btrim(p_item->>'condition'),d,coalesce(p_item->>'status','ingreso'),auth.uid(),auth.uid()) returning * into saved;
 else
  select * into prev from public.collection_items where id=p_id and museum_id=m for update;
  if not found then raise exception 'COLLECTION_NOT_FOUND' using errcode='42501'; end if;
  if p_expected_version is distinct from prev.version then raise exception 'COLLECTION_CONFLICT' using errcode='PT409'; end if;
  update public.collection_items set accession_number=btrim(p_item->>'accession_number'),title=btrim(p_item->>'title'),description=btrim(p_item->>'description'),category=btrim(p_item->>'category'),location=btrim(p_item->>'location'),condition=btrim(p_item->>'condition'),details=d,status=p_item->>'status',version=version+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning * into saved;
 end if;
 insert into public.collection_history(museum_id,item_id,actor_id,actor_name,action,reason,before_value,after_value)
 values(m,saved.id,auth.uid(),coalesce((select full_name from public.profiles where id=auth.uid()),'Catalogador'),case when p_id is null then 'registro' else 'edicion' end,btrim(p_reason),case when p_id is null then null else to_jsonb(prev) end,to_jsonb(saved));
 return saved;
end $$;

create or replace function public.collection_photo_allowed(object_name text, writing boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and case when writing then public.collection_can_write() else public.collection_can_read() end
 and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
 and (storage.foldername(object_name))[1]=public.current_user_museum_id()::text
 and exists(select 1 from public.collection_items i where i.museum_id=public.current_user_museum_id() and i.id::text=(storage.foldername(object_name))[2])
$$;
create or replace function public.collection_attach_photo(p_id uuid,p_expected_version bigint,p_photo_id uuid,p_path text,p_caption text)
returns public.collection_items language plpgsql security definer set search_path='' as $$
declare i public.collection_items; photo public.collection_photos;
begin
 if public.collection_can_write() is not true or not public.collection_photo_allowed(p_path,true) then raise exception 'COLLECTION_FORBIDDEN' using errcode='42501'; end if;
 select * into i from public.collection_items where id=p_id and museum_id=public.current_user_museum_id() for update;
 if not found then raise exception 'COLLECTION_NOT_FOUND' using errcode='42501'; end if;
 if i.version is distinct from p_expected_version then raise exception 'COLLECTION_CONFLICT' using errcode='PT409'; end if;
 if (storage.foldername(p_path))[2]<>p_id::text or split_part(storage.filename(p_path),'.',1)<>p_photo_id::text
 or not exists(select 1 from storage.objects where bucket_id='collection-photos' and name=p_path) then raise exception 'PHOTO_NOT_FOUND' using errcode='22023'; end if;
 insert into public.collection_photos(id,museum_id,item_id,path,caption,created_by)
 values(p_photo_id,i.museum_id,i.id,p_path,coalesce(p_caption,''),auth.uid()) returning * into photo;
 update public.collection_items set version=version+1,updated_at=now(),updated_by=auth.uid() where id=i.id returning * into i;
 insert into public.collection_history(museum_id,item_id,actor_id,actor_name,action,reason,after_value)
 values(i.museum_id,i.id,auth.uid(),coalesce((select full_name from public.profiles where id=auth.uid()),'Catalogador'),'fotografia','Fotografía añadida; se conserva la evidencia anterior.',to_jsonb(photo));
 return i;
end $$;

commit;
