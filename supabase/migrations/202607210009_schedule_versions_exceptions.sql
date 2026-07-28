alter table public.attendance_schedule_rules add column version_no integer not null default 1;
alter table public.attendance_schedule_rules add column supersedes_rule_id uuid references public.attendance_schedule_rules(id) on delete restrict;

create or replace function public.save_attendance_schedule_rule(actor_user_id uuid,actor_museum_id uuid,rule_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_employee uuid:=(rule_payload->>'employee_id')::uuid; saved public.attendance_schedule_rules; old_rule public.attendance_schedule_rules; generated integer; days smallint[]; prior_id uuid:=nullif(rule_payload->>'supersedes_rule_id','')::uuid; next_version integer:=1;
begin
 if not public.has_permission_for_user(actor_user_id,actor_museum_id,'schedules.manage') or not public.can_manage_employee_schedule(actor_user_id,target_employee,actor_museum_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select array_agg(distinct value::smallint order by value::smallint) into days from jsonb_array_elements_text(rule_payload->'weekdays');
 if days is null or cardinality(days)=0 then raise exception 'WEEKDAYS_REQUIRED' using errcode='22023'; end if;
 if exists(select 1 from public.attendance_schedule_rules x where x.employee_id=target_employee and x.museum_id=actor_museum_id and x.active=true and x.id is distinct from prior_id and x.weekdays&&days and daterange(x.effective_from,coalesce(x.effective_until,'infinity'::date),'[]')&&daterange((rule_payload->>'effective_from')::date,coalesce(nullif(rule_payload->>'effective_until','')::date,'infinity'::date),'[]')) then raise exception 'SCHEDULE_CONFLICT' using errcode='P0001'; end if;
 if prior_id is not null then
   select * into old_rule from public.attendance_schedule_rules where id=prior_id and museum_id=actor_museum_id and employee_id=target_employee for update;
   if not found or not old_rule.active then raise exception 'ACTIVE_RULE_REQUIRED' using errcode='P0001'; end if;
   next_version:=old_rule.version_no+1;
   update public.attendance_schedule_rules set active=false,updated_by=actor_user_id,updated_at=now() where id=old_rule.id;
   update public.employee_shifts s set status='cancelled',updated_at=now(),notes=coalesce(notes,'')||' | Sustituido por nueva version de horario' where s.schedule_rule_id=old_rule.id and s.starts_at>now() and s.status='scheduled' and not exists(select 1 from public.attendance_events e where e.shift_id=s.id);
 end if;
 insert into public.attendance_schedule_rules(museum_id,employee_id,weekdays,starts_local,ends_local,effective_from,effective_until,shift_type,expected_lunch_minutes,timezone,active,created_by,updated_by,version_no,supersedes_rule_id)
 values(actor_museum_id,target_employee,days,(rule_payload->>'starts_local')::time,(rule_payload->>'ends_local')::time,(rule_payload->>'effective_from')::date,nullif(rule_payload->>'effective_until','')::date,coalesce(nullif(rule_payload->>'shift_type',''),'regular'),nullif(rule_payload->>'expected_lunch_minutes','')::integer,coalesce(nullif(rule_payload->>'timezone',''),'America/Puerto_Rico'),true,actor_user_id,actor_user_id,next_version,prior_id)
 returning * into saved;
 generated:=public.materialize_attendance_shifts(saved.id,90);
 insert into public.audit_logs(museum_id,actor_user_id,action,table_name,record_id,old_value,new_value) values(actor_museum_id,actor_user_id,case when prior_id is null then 'ATTENDANCE_SCHEDULE_RULE_CREATED' else 'ATTENDANCE_SCHEDULE_RULE_REVISED' end,'attendance_schedule_rules',saved.id,case when prior_id is null then null else to_jsonb(old_rule) end,jsonb_build_object('employee_id',saved.employee_id,'version',saved.version_no,'weekdays',saved.weekdays,'starts_local',saved.starts_local,'ends_local',saved.ends_local,'effective_from',saved.effective_from,'effective_until',saved.effective_until,'generated_shifts',generated));
 return jsonb_build_object('rule',to_jsonb(saved),'generated_shifts',generated);
end $$;

create or replace function public.deactivate_attendance_schedule_rule(actor_user_id uuid,actor_museum_id uuid,target_rule_id uuid,reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.attendance_schedule_rules; cancelled integer;
begin
 if length(trim(reason))<3 then raise exception 'REASON_REQUIRED' using errcode='22023'; end if;
 select * into r from public.attendance_schedule_rules where id=target_rule_id and museum_id=actor_museum_id and active=true for update;
 if not found then raise exception 'ACTIVE_RULE_REQUIRED' using errcode='P0001'; end if;
 if not public.has_permission_for_user(actor_user_id,actor_museum_id,'schedules.manage') or not public.can_manage_employee_schedule(actor_user_id,r.employee_id,actor_museum_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 update public.attendance_schedule_rules set active=false,updated_by=actor_user_id,updated_at=now() where id=r.id;
 update public.employee_shifts s set status='cancelled',updated_at=now(),notes=coalesce(notes,'')||' | Regla desactivada: '||reason where s.schedule_rule_id=r.id and s.starts_at>now() and s.status='scheduled' and not exists(select 1 from public.attendance_events e where e.shift_id=s.id);
 get diagnostics cancelled=row_count;
 insert into public.audit_logs(museum_id,actor_user_id,action,table_name,record_id,old_value,new_value) values(actor_museum_id,actor_user_id,'ATTENDANCE_SCHEDULE_RULE_DEACTIVATED','attendance_schedule_rules',r.id,to_jsonb(r),jsonb_build_object('active',false,'reason',reason,'cancelled_future_shifts',cancelled));
 return jsonb_build_object('rule_id',r.id,'cancelled_future_shifts',cancelled);
end $$;

create or replace function public.save_attendance_schedule_exception(actor_user_id uuid,actor_museum_id uuid,exception_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_employee uuid:=(exception_payload->>'employee_id')::uuid; target_rule uuid:=nullif(exception_payload->>'rule_id','')::uuid; kind text:=exception_payload->>'exception_type'; day date:=(exception_payload->>'exception_date')::date; saved public.attendance_schedule_exceptions; affected integer:=0; local_start time; local_end time; tz text:='America/Puerto_Rico'; start_at timestamptz; end_at timestamptz;
begin
 if not public.has_permission_for_user(actor_user_id,actor_museum_id,'schedules.manage') or not public.can_manage_employee_schedule(actor_user_id,target_employee,actor_museum_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if kind not in ('cancelled','override','additional') or length(trim(exception_payload->>'reason'))<3 then raise exception 'INVALID_EXCEPTION' using errcode='22023'; end if;
 if target_rule is not null then select timezone into tz from public.attendance_schedule_rules where id=target_rule and employee_id=target_employee and museum_id=actor_museum_id; end if;
 local_start:=nullif(exception_payload->>'starts_local','')::time; local_end:=nullif(exception_payload->>'ends_local','')::time;
 insert into public.attendance_schedule_exceptions(museum_id,employee_id,rule_id,exception_date,exception_type,starts_local,ends_local,shift_type,reason,created_by)
 values(actor_museum_id,target_employee,target_rule,day,kind,local_start,local_end,nullif(exception_payload->>'shift_type',''),exception_payload->>'reason',actor_user_id) returning * into saved;
 if kind in ('cancelled','override') then
   update public.employee_shifts s set status='cancelled',updated_at=now(),schedule_exception_id=saved.id,notes=coalesce(notes,'')||' | Excepcion: '||(exception_payload->>'reason') where s.employee_id=target_employee and (s.starts_at at time zone tz)::date=day and s.status='scheduled' and not exists(select 1 from public.attendance_events e where e.shift_id=s.id);
   get diagnostics affected=row_count;
 end if;
 if kind in ('override','additional') then
   start_at:=(day+local_start) at time zone tz; end_at:=case when local_end>local_start then (day+local_end) at time zone tz else (day+1+local_end) at time zone tz end;
   insert into public.employee_shifts(museum_id,employee_id,starts_at,ends_at,shift_type,status,created_by,notes,schedule_rule_id,schedule_exception_id)
   values(actor_museum_id,target_employee,start_at,end_at,coalesce(nullif(exception_payload->>'shift_type',''),'regular'),'scheduled',actor_user_id,'Excepcion: '||(exception_payload->>'reason'),target_rule,saved.id) on conflict(employee_id,starts_at) do nothing;
 end if;
 insert into public.audit_logs(museum_id,actor_user_id,action,table_name,record_id,new_value) values(actor_museum_id,actor_user_id,'ATTENDANCE_SCHEDULE_EXCEPTION_CREATED','attendance_schedule_exceptions',saved.id,to_jsonb(saved)||jsonb_build_object('affected_shifts',affected));
 return jsonb_build_object('exception',to_jsonb(saved),'affected_shifts',affected);
end $$;

revoke all on function public.deactivate_attendance_schedule_rule(uuid,uuid,uuid,text),public.save_attendance_schedule_exception(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.deactivate_attendance_schedule_rule(uuid,uuid,uuid,text),public.save_attendance_schedule_exception(uuid,uuid,jsonb) to service_role;
