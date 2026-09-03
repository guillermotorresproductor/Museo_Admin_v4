begin;
do $$
declare
  museum_a uuid:=gen_random_uuid(); museum_b uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid();
  work_id uuid; material_id uuid; route_id uuid; isolated_id uuid; affected integer;
begin
  insert into public.museums(id,name,slug) values
    (museum_a,'TEST-B2-MAINT museum A','test-b2-maint-a-'||museum_a),
    (museum_b,'TEST-B2-MAINT museum B','test-b2-maint-b-'||museum_b);
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
    values('00000000-0000-0000-0000-000000000000',actor,'authenticated','authenticated','test-b2-maint-'||actor||'@example.invalid',crypt('TEST-B2-MAINT',gen_salt('bf')),now(),now(),now());
  update public.profiles set museum_id=museum_a,full_name='TEST-B2-MAINT operator',email='test-b2-maint-'||actor||'@example.invalid',role='administrador',status='active' where id=actor;
  insert into public.user_roles(museum_id,user_id,role_id,assigned_by) select museum_a,actor,id,actor from public.roles where code='administrador';
  insert into public.maintenance_tasks(museum_id,record_type,task,task_date) values(museum_b,'work','TEST-B2-MAINT isolated',current_date) returning id into isolated_id;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',actor,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  if not public.can_manage_maintenance() then raise exception 'TEST-B2-MAINT permission failed'; end if;
  insert into public.maintenance_tasks(museum_id,record_type,employee_id,task,task_date,status,details,created_by,updated_by) values
    (museum_a,'work',null,'TEST-B2-MAINT work',current_date,'Pendiente','{}',actor,actor) returning id into work_id;
  insert into public.maintenance_tasks(museum_id,record_type,employee_id,task,task_date,status,details,created_by,updated_by) values
    (museum_a,'material_request',null,'TEST-B2-MAINT material',current_date,'pendiente','{"materials":["TEST-B2-MAINT"]}',actor,actor) returning id into material_id;
  insert into public.maintenance_tasks(museum_id,record_type,employee_id,task,task_date,status,details,created_by,updated_by) values
    (museum_a,'route_inspection',null,'TEST-B2-MAINT route',current_date,'completado','{"checks":["TEST-B2-MAINT"]}',actor,actor) returning id into route_id;
  update public.maintenance_tasks set task='TEST-B2-MAINT edited',updated_by=actor where id=work_id;
  update public.maintenance_tasks set archived_at=now(),updated_by=actor where id in(material_id,route_id);
  if exists(select 1 from public.maintenance_tasks where id=isolated_id) then raise exception 'TEST-B2-MAINT read isolation failed'; end if;
  update public.maintenance_tasks set task='TEST-B2-MAINT breach',updated_by=actor where id=isolated_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'TEST-B2-MAINT update isolation failed'; end if;
  if (select count(*) from public.audit_logs where record_id in(work_id,material_id,route_id))<>6 then raise exception 'TEST-B2-MAINT audit failed'; end if;
end $$;
rollback;
