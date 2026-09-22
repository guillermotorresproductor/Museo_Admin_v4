-- Enforce the museographic requirement of at most four photographs per collection item.
-- The lock on the parent item serializes concurrent photo attachments for the same piece.
begin;
create or replace function public.collection_attach_photo(p_id uuid,p_expected_version bigint,p_photo_id uuid,p_path text,p_caption text)
returns public.collection_items language plpgsql security definer set search_path='' as $$
declare i public.collection_items; photo public.collection_photos;
begin
 if public.has_permission('collections.write') is not true or not public.collection_photo_allowed(p_path,true) then raise exception 'COLLECTION_FORBIDDEN' using errcode='42501'; end if;
 select * into i from public.collection_items where id=p_id and museum_id=public.current_user_museum_id() for update;
 if not found then raise exception 'COLLECTION_NOT_FOUND' using errcode='42501'; end if;
 if i.version is distinct from p_expected_version then raise exception 'COLLECTION_CONFLICT' using errcode='PT409'; end if;
 if (select count(*) from public.collection_photos where item_id=i.id)>=4 then raise exception 'COLLECTION_PHOTO_LIMIT' using errcode='22023'; end if;
 if (storage.foldername(p_path))[2]<>p_id::text or split_part(storage.filename(p_path),'.',1)<>p_photo_id::text
 or not exists(select 1 from storage.objects where bucket_id='collection-photos' and name=p_path) then raise exception 'PHOTO_NOT_FOUND' using errcode='22023'; end if;
 insert into public.collection_photos(id,museum_id,item_id,path,caption,created_by)
 values(p_photo_id,i.museum_id,i.id,p_path,coalesce(p_caption,''),auth.uid()) returning * into photo;
 update public.collection_items set version=version+1,updated_at=now(),updated_by=auth.uid() where id=i.id returning * into i;
 insert into public.collection_history(museum_id,item_id,actor_id,actor_name,action,reason,after_value)
 values(i.museum_id,i.id,auth.uid(),coalesce((select full_name from public.profiles where id=auth.uid()),'Catalogador'),'fotografia','Fotografía añadida; se conserva la evidencia anterior.',to_jsonb(photo));
 return i;
end $$;
notify pgrst,'reload schema';
commit;
