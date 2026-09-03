begin;

do $$
declare
  museum_a uuid:=gen_random_uuid();
  museum_b uuid:=gen_random_uuid();
  profile_a uuid:=gen_random_uuid();
  event_id uuid;
  event_b_id uuid;
  task_id uuid;
  task_b_id uuid;
  affected integer;
begin
  insert into public.museums(id,name,slug) values
    (museum_a,'TEST-B2 museum A','test-b2-a-'||museum_a),
    (museum_b,'TEST-B2 museum B','test-b2-b-'||museum_b);
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
    values('00000000-0000-0000-0000-000000000000',profile_a,'authenticated','authenticated',
      'test-b2-'||profile_a||'@example.invalid',crypt('TEST-B2-not-a-real-password',gen_salt('bf')),now(),now(),now());
  update public.profiles set museum_id=museum_a,full_name='TEST-B2 operator',
    email='test-b2-'||profile_a||'@example.invalid',role='administrador',status='active'
    where id=profile_a;
  insert into public.user_roles(museum_id,user_id,role_id,assigned_by)
    select museum_a,profile_a,id,profile_a from public.roles where code='administrador';
  insert into public.calendar_events(museum_id,calendar_type,title,event_date,status)
    values(museum_b,'general','TEST-B2 isolated event',current_date,'pendiente') returning id into event_b_id;
  insert into public.maintenance_tasks(museum_id,record_type,task,task_date,status,details)
    values(museum_b,'route_inspection','TEST-B2 isolated route',current_date,'completado','{"marker":"TEST-B2"}') returning id into task_b_id;
  perform set_config('request.jwt.claim.sub',profile_a::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',profile_a,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  if auth.uid() is distinct from profile_a then
    raise exception 'TEST-B2 auth.uid mismatch: %',auth.uid();
  end if;
  if public.current_user_museum_id() is distinct from museum_a then
    raise exception 'TEST-B2 museum context mismatch: %',public.current_user_museum_id();
  end if;
  if not public.has_permission('calendar.manage') then
    raise exception 'TEST-B2 administrator lacks calendar.manage';
  end if;

  insert into public.calendar_events(museum_id,calendar_type,title,event_date,status,created_by,updated_by)
    values(museum_a,'general','TEST-B2 event',current_date,'pendiente',profile_a,profile_a) returning id into event_id;
  update public.calendar_events set title='TEST-B2 event edited',updated_by=profile_a where id=event_id;
  update public.calendar_events set archived_at=now(),updated_by=profile_a where id=event_id;

  insert into public.maintenance_tasks(museum_id,record_type,task,task_date,status,details,created_by,updated_by)
    values(museum_a,'material_request','TEST-B2 materials',current_date,'pendiente','{"marker":"TEST-B2"}',profile_a,profile_a) returning id into task_id;
  update public.maintenance_tasks set status='aprobado',updated_by=profile_a where id=task_id;
  update public.maintenance_tasks set archived_at=now(),updated_by=profile_a where id=task_id;

  if not exists(select 1 from public.calendar_events where id=event_id and archived_at is not null)
    or not exists(select 1 from public.maintenance_tasks where id=task_id and archived_at is not null) then
    raise exception 'TEST-B2 own records are not readable';
  end if;
  if exists(select 1 from public.calendar_events where id=event_b_id)
    or exists(select 1 from public.maintenance_tasks where id=task_b_id) then
    raise exception 'TEST-B2 museum isolation failed';
  end if;
  update public.calendar_events set title='TEST-B2 isolation breach',updated_by=profile_a where id=event_b_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'TEST-B2 cross-museum calendar update was allowed'; end if;
  update public.maintenance_tasks set task='TEST-B2 isolation breach',updated_by=profile_a where id=task_b_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'TEST-B2 cross-museum maintenance update was allowed'; end if;
  if (select count(*) from public.audit_logs where record_id in(event_id,task_id))<>6 then
    raise exception 'TEST-B2 audit trail incomplete';
  end if;
end $$;

rollback;
