-- New, isolated patrimonial catalog. No import, rewrite or deletion of legacy data.
begin;
insert into public.permissions(code,description,sensitivity) values
 ('collections.read','Consultar piezas, fotografías e historial museográfico','sensitive'),
 ('collections.write','Catalogar y editar piezas museográficas','sensitive')
on conflict(code) do nothing;
-- Deliberately no user grants or changes to existing role/permission functions.

create table public.collection_items (
 id uuid primary key default gen_random_uuid(),
 museum_id uuid not null references public.museums(id) on delete restrict,
 accession_number text not null check(length(btrim(accession_number)) between 1 and 100),
 title text not null check(length(btrim(title)) between 1 and 300),
 description text not null check(length(btrim(description)) between 1 and 10000),
 category text not null check(length(btrim(category)) between 1 and 100),
 location text not null check(length(btrim(location)) between 1 and 300),
 condition text not null check(length(btrim(condition)) between 1 and 2000),
 details jsonb not null default '{}' check(jsonb_typeof(details)='object' and octet_length(details::text)<=50000),
 status text not null default 'ingreso' check(status in ('ingreso','catalogada','conservacion','restauracion')),
 version bigint not null default 1,
 created_by uuid not null references public.profiles(id) on delete restrict,
 updated_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index collection_number_unique on public.collection_items(museum_id,lower(btrim(accession_number)));
create index collection_museum_updated on public.collection_items(museum_id,updated_at desc,id);
create table public.collection_history (
 id uuid primary key default gen_random_uuid(),
 museum_id uuid not null references public.museums(id) on delete restrict,
 item_id uuid not null references public.collection_items(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 actor_name text not null,
 occurred_at timestamptz not null default now(),
 action text not null, reason text not null,
 before_value jsonb, after_value jsonb not null
);
create index collection_history_item on public.collection_history(item_id,occurred_at,id);
create table public.collection_photos (
 id uuid primary key,
 museum_id uuid not null references public.museums(id) on delete restrict,
 item_id uuid not null references public.collection_items(id) on delete restrict,
 path text unique not null,
 caption text not null default '' check(length(caption)<=1000),
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);

create function public.collection_can_read() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.has_permission('collections.read') or public.has_permission('collections.write'))
$$;

create function public.collection_immutable() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Patrimonial records and evidence cannot be deleted or rewritten.' using errcode='42501'; end
$$;
create trigger collection_no_delete before delete on public.collection_items for each row execute function public.collection_immutable();
create trigger collection_history_immutable before update or delete on public.collection_history for each row execute function public.collection_immutable();
create trigger collection_photos_immutable before update or delete on public.collection_photos for each row execute function public.collection_immutable();

create function public.collection_save(p_id uuid, p_expected_version bigint, p_item jsonb, p_reason text)
returns public.collection_items language plpgsql security definer set search_path='' as $$
declare m uuid:=public.current_user_museum_id(); prev public.collection_items; saved public.collection_items; d jsonb:=coalesce(p_item->'details','{}'); k text;
begin
 if m is null or public.has_permission('collections.write') is not true then raise exception 'COLLECTION_FORBIDDEN' using errcode='42501'; end if;
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

create function public.collection_photo_allowed(object_name text, writing boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and case when writing then public.has_permission('collections.write') else public.collection_can_read() end
 and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
 and (storage.foldername(object_name))[1]=public.current_user_museum_id()::text
 and exists(select 1 from public.collection_items i where i.museum_id=public.current_user_museum_id() and i.id::text=(storage.foldername(object_name))[2])
$$;
create function public.collection_attach_photo(p_id uuid,p_expected_version bigint,p_photo_id uuid,p_path text,p_caption text)
returns public.collection_items language plpgsql security definer set search_path='' as $$
declare i public.collection_items; photo public.collection_photos;
begin
 if public.has_permission('collections.write') is not true or not public.collection_photo_allowed(p_path,true) then raise exception 'COLLECTION_FORBIDDEN' using errcode='42501'; end if;
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

alter table public.collection_items enable row level security;
alter table public.collection_history enable row level security;
alter table public.collection_photos enable row level security;
revoke all on public.collection_items,public.collection_history,public.collection_photos from public,anon,authenticated;
grant select on public.collection_items,public.collection_history,public.collection_photos to authenticated;
create policy collection_items_read on public.collection_items for select to authenticated using(museum_id=public.current_user_museum_id() and public.collection_can_read());
create policy collection_history_read on public.collection_history for select to authenticated using(museum_id=public.current_user_museum_id() and public.collection_can_read());
create policy collection_photos_read on public.collection_photos for select to authenticated using(museum_id=public.current_user_museum_id() and public.collection_can_read());
revoke all on function public.collection_can_read(),public.collection_immutable(),public.collection_save(uuid,bigint,jsonb,text),public.collection_photo_allowed(text,boolean),public.collection_attach_photo(uuid,bigint,uuid,text,text) from public,anon,authenticated;
grant execute on function public.collection_can_read(),public.collection_save(uuid,bigint,jsonb,text),public.collection_photo_allowed(text,boolean),public.collection_attach_photo(uuid,bigint,uuid,text,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('collection-photos','collection-photos',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy collection_storage_read on storage.objects for select to authenticated using(bucket_id='collection-photos' and public.collection_photo_allowed(name,false));
create policy collection_storage_insert on storage.objects for insert to authenticated with check(bucket_id='collection-photos' and public.collection_photo_allowed(name,true));
-- Restrictive guards also protect this bucket if another module has broad policies.
create policy collection_storage_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'collection-photos' or public.collection_photo_allowed(name,false));
create policy collection_storage_insert_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'collection-photos' or public.collection_photo_allowed(name,true));
create policy collection_storage_no_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'collection-photos') with check(bucket_id<>'collection-photos');
create policy collection_storage_no_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'collection-photos');
commit;
