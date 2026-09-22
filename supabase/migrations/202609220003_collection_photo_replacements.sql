-- Append-only correction chain: existing photo rows and Storage objects stay intact.
begin;
create unique index if not exists collection_photos_museum_item_id
 on public.collection_photos(museum_id,item_id,id);
create table if not exists public.collection_photo_replacements (
 old_photo_id uuid primary key,
 new_photo_id uuid not null unique,
 museum_id uuid not null references public.museums(id) on delete restrict,
 item_id uuid not null references public.collection_items(id) on delete restrict,
 reason text not null check(length(btrim(reason)) between 3 and 2000),
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 check(old_photo_id<>new_photo_id),
 foreign key(museum_id,item_id,old_photo_id) references public.collection_photos(museum_id,item_id,id) on delete restrict,
 foreign key(museum_id,item_id,new_photo_id) references public.collection_photos(museum_id,item_id,id) on delete restrict
);
alter table public.collection_photo_replacements enable row level security;
revoke all on public.collection_photo_replacements from public,anon,authenticated;
grant select on public.collection_photo_replacements to authenticated;
drop policy if exists collection_photo_replacements_read on public.collection_photo_replacements;
create policy collection_photo_replacements_read on public.collection_photo_replacements
 for select to authenticated using(museum_id=public.current_user_museum_id() and public.collection_can_read());
drop trigger if exists collection_photo_replacements_immutable on public.collection_photo_replacements;
create trigger collection_photo_replacements_immutable before update or delete on public.collection_photo_replacements
 for each row execute function public.collection_immutable();

-- Invoker rights preserve both underlying tables' museum/read policies.
create or replace view public.collection_active_photos with (security_invoker=true) as
 select p.* from public.collection_photos p
 where not exists(select 1 from public.collection_photo_replacements r where r.old_photo_id=p.id);
revoke all on public.collection_active_photos from public,anon,authenticated;
grant select on public.collection_active_photos to authenticated;

create or replace function public.collection_attach_photo(p_id uuid,p_expected_version bigint,p_photo_id uuid,p_path text,p_caption text)
returns public.collection_items language plpgsql security definer set search_path='' as $$
declare i public.collection_items; photo public.collection_photos;
begin
 if public.collection_can_write() is not true or not public.collection_photo_allowed(p_path,true) then raise exception 'COLLECTION_FORBIDDEN' using errcode='42501'; end if;
 select * into i from public.collection_items where id=p_id and museum_id=public.current_user_museum_id() for update;
 if not found then raise exception 'COLLECTION_NOT_FOUND' using errcode='42501'; end if;
 if i.version is distinct from p_expected_version then raise exception 'COLLECTION_CONFLICT' using errcode='PT409'; end if;
 if (select count(*) from public.collection_active_photos where item_id=i.id)>=4 then raise exception 'COLLECTION_PHOTO_LIMIT' using errcode='22023'; end if;
 if (storage.foldername(p_path))[2]<>p_id::text or split_part(storage.filename(p_path),'.',1)<>p_photo_id::text
 or not exists(select 1 from storage.objects where bucket_id='collection-photos' and name=p_path) then raise exception 'PHOTO_NOT_FOUND' using errcode='22023'; end if;
 insert into public.collection_photos(id,museum_id,item_id,path,caption,created_by)
 values(p_photo_id,i.museum_id,i.id,p_path,coalesce(p_caption,''),auth.uid()) returning * into photo;
 update public.collection_items set version=version+1,updated_at=now(),updated_by=auth.uid() where id=i.id returning * into i;
 insert into public.collection_history(museum_id,item_id,actor_id,actor_name,action,reason,after_value)
 values(i.museum_id,i.id,auth.uid(),coalesce((select full_name from public.profiles where id=auth.uid()),'Catalogador'),'fotografia','Fotografía añadida; se conserva la evidencia anterior.',to_jsonb(photo));
 return i;
end $$;

create or replace function public.collection_replace_photo(p_id uuid,p_expected_version bigint,p_old_photo_id uuid,p_photo_id uuid,p_path text,p_reason text)
returns public.collection_items language plpgsql security definer set search_path='' as $$
declare i public.collection_items; previous public.collection_photos; photo public.collection_photos;
begin
 if public.has_permission('collections.write') is not true or public.current_user_museum_id() is null
 or public.collection_photo_allowed(p_path,true) is not true then raise exception 'COLLECTION_FORBIDDEN' using errcode='42501'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'CHANGE_REASON_REQUIRED' using errcode='22023'; end if;
 select * into i from public.collection_items where id=p_id and museum_id=public.current_user_museum_id() for update;
 if not found then raise exception 'COLLECTION_NOT_FOUND' using errcode='42501'; end if;
 if i.version is distinct from p_expected_version then raise exception 'COLLECTION_CONFLICT' using errcode='PT409'; end if;
 select * into previous from public.collection_photos where id=p_old_photo_id and item_id=i.id and museum_id=i.museum_id;
 if not found then raise exception 'PHOTO_NOT_FOUND' using errcode='22023'; end if;
 if exists(select 1 from public.collection_photo_replacements where old_photo_id=previous.id) then raise exception 'COLLECTION_CONFLICT' using errcode='PT409'; end if;
 if p_photo_id is null or p_photo_id=previous.id or p_path is null or p_path=previous.path
 or (storage.foldername(p_path))[2]<>i.id::text or split_part(storage.filename(p_path),'.',1)<>p_photo_id::text
 or not exists(select 1 from storage.objects where bucket_id='collection-photos' and name=p_path)
 then raise exception 'PHOTO_NOT_FOUND' using errcode='22023'; end if;
 insert into public.collection_photos(id,museum_id,item_id,path,caption,created_by)
 values(p_photo_id,i.museum_id,i.id,p_path,previous.caption,auth.uid()) returning * into photo;
 insert into public.collection_photo_replacements(old_photo_id,new_photo_id,museum_id,item_id,reason,created_by)
 values(previous.id,photo.id,i.museum_id,i.id,btrim(p_reason),auth.uid());
 update public.collection_items set version=version+1,updated_at=now(),updated_by=auth.uid() where id=i.id returning * into i;
 insert into public.collection_history(museum_id,item_id,actor_id,actor_name,action,reason,before_value,after_value)
 values(i.museum_id,i.id,auth.uid(),coalesce((select full_name from public.profiles where id=auth.uid()),'Catalogador'),
 'sustitucion_fotografia',btrim(p_reason),to_jsonb(previous),to_jsonb(photo));
 return i;
end $$;
revoke all on function public.collection_replace_photo(uuid,bigint,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.collection_replace_photo(uuid,bigint,uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
