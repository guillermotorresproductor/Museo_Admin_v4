-- Allow structured classification details. Does not alter existing rows,
-- photographs, history, RLS, or write-capability rules.
begin;
create or replace function public.collection_save(p_id uuid, p_expected_version bigint, p_item jsonb, p_reason text)
returns public.collection_items language plpgsql security definer set search_path='' as $$
declare m uuid:=public.current_user_museum_id(); prev public.collection_items; saved public.collection_items; d jsonb:=coalesce(p_item->'details','{}'); k text;
begin
 if m is null or public.collection_can_write() is not true then raise exception 'COLLECTION_FORBIDDEN' using errcode='42501'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'CHANGE_REASON_REQUIRED' using errcode='22023'; end if;
 if jsonb_typeof(d)<>'object' then raise exception 'INVALID_DETAILS' using errcode='22023'; end if;
 for k in select jsonb_object_keys(d) loop
  if k not in ('author','dating','materials','dimensions','provenance','owner','acquisition','custody','donor','owner_phone','owner_email','owner_address','lender','received_date','fmv','currency','loan_reference','notes','cultural_history','personal_object_description','object_type_specification')
    or jsonb_typeof(d->k) not in ('string','null') then raise exception 'INVALID_DETAILS' using errcode='22023'; end if;
 end loop;
 if length(coalesce(d->>'personal_object_description',''))>1000 or length(coalesce(d->>'object_type_specification',''))>1000 then raise exception 'INVALID_DETAILS' using errcode='22023'; end if;
 if btrim(coalesce(p_item->>'category',''))='Objeto personal' and length(btrim(coalesce(d->>'personal_object_description','')))<1 then raise exception 'PERSONAL_OBJECT_DESCRIPTION_REQUIRED' using errcode='22023'; end if;
 if btrim(coalesce(p_item->>'category',''))='Otro' and length(btrim(coalesce(d->>'object_type_specification','')))<1 then raise exception 'OBJECT_TYPE_SPECIFICATION_REQUIRED' using errcode='22023'; end if;
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
notify pgrst,'reload schema';
commit;
