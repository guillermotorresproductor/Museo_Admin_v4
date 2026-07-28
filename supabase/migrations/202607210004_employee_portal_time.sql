insert into public.permissions(code,description,sensitivity) values
 ('schedules.read.self','Leer horario propio','normal'),
 ('schedules.read.team','Leer horarios del equipo','sensitive'),
 ('schedules.manage','Administrar horarios','sensitive'),
 ('time.clock','Registrar ponche propio','sensitive'),
 ('time.read.self','Leer ponches propios','sensitive'),
 ('time.read.team','Leer ponches del equipo','sensitive'),
 ('time.correct','Corregir ponches','critical'),
 ('timesheets.read.self','Leer hojas de tiempo propias','sensitive'),
 ('timesheets.read.team','Leer hojas de tiempo del equipo','sensitive')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on
 (r.code in ('empleado','supervisor','recursos_humanos','finanzas','ejecutivo','administrador') and p.code in ('schedules.read.self','time.clock','time.read.self','timesheets.read.self')) or
 (r.code='supervisor' and p.code in ('schedules.read.team','schedules.manage','time.read.team','time.correct','timesheets.read.team')) or
 (r.code='recursos_humanos' and p.code in ('schedules.manage','time.correct'))
on conflict do nothing;

create table public.employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id),
  employee_id uuid not null references public.employees(id) on delete restrict,
  clock_in timestamptz not null,
  clock_out timestamptz,
  source text not null default 'instituva' check(source in ('instituva','quickbooks')),
  sync_status text not null default 'not_configured' check(sync_status in ('not_configured','pending','synced','error')),
  quickbooks_time_activity_id text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_time_order check(clock_out is null or clock_out >= clock_in)
);
create index employee_time_entries_employee_clock_idx on public.employee_time_entries(employee_id,clock_in desc);
create index employee_time_entries_museum_clock_idx on public.employee_time_entries(museum_id,clock_in desc);
create unique index employee_time_entries_one_open on public.employee_time_entries(employee_id) where clock_out is null;

create table public.employee_notifications (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  category text not null default 'general',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index employee_notifications_recipient_idx on public.employee_notifications(recipient_user_id,created_at desc);

alter table public.employee_time_entries enable row level security;
alter table public.employee_notifications enable row level security;

create policy employee_time_self_read on public.employee_time_entries
for select to authenticated using(
  museum_id=public.current_user_museum_id()
  and public.has_permission('time.read.self')
  and exists(
    select 1 from public.employees e
    where e.id=employee_time_entries.employee_id and e.auth_user_id=auth.uid() and e.status='activo'
  )
);

create policy employee_time_team_read on public.employee_time_entries
for select to authenticated using(
  museum_id=public.current_user_museum_id()
  and public.has_permission('time.read.team')
  and exists(
    select 1
    from public.employee_supervisors es
    join public.employees supervisor on supervisor.id=es.supervisor_employee_id
    where es.employee_id=employee_time_entries.employee_id
      and es.museum_id=public.current_user_museum_id()
      and supervisor.auth_user_id=auth.uid()
      and (es.valid_until is null or es.valid_until>now())
  )
);

create policy employee_notifications_self_read on public.employee_notifications
for select to authenticated using(
  museum_id=public.current_user_museum_id()
  and recipient_user_id=auth.uid()
  and public.has_permission('notifications.read.self')
);

create or replace function public.clock_employee_time(actor_user_id uuid,actor_museum_id uuid,requested_action text)
returns public.employee_time_entries
language plpgsql security definer set search_path='' as $$
declare
  employee_row public.employees;
  entry_row public.employee_time_entries;
  occurred_at timestamptz:=now();
  audit_action text;
begin
  if requested_action not in ('clock_in','clock_out') then
    raise exception 'INVALID_CLOCK_ACTION' using errcode='22023';
  end if;

  select * into employee_row
  from public.employees e
  where e.museum_id=actor_museum_id and e.auth_user_id=actor_user_id and e.status='activo';
  if not found then raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode='P0001'; end if;

  select * into entry_row
  from public.employee_time_entries te
  where te.museum_id=actor_museum_id and te.employee_id=employee_row.id and te.clock_out is null
  for update;

  if requested_action='clock_in' then
    if found then raise exception 'ALREADY_CLOCKED_IN' using errcode='P0001'; end if;
    insert into public.employee_time_entries(museum_id,employee_id,clock_in,source,sync_status,created_by)
    values(actor_museum_id,employee_row.id,occurred_at,'instituva','not_configured',actor_user_id)
    returning * into entry_row;
    audit_action:='TIME_CLOCK_IN';
  else
    if not found then raise exception 'NOT_CLOCKED_IN' using errcode='P0001'; end if;
    update public.employee_time_entries
    set clock_out=occurred_at,updated_at=occurred_at
    where id=entry_row.id and clock_out is null
    returning * into entry_row;
    audit_action:='TIME_CLOCK_OUT';
  end if;

  insert into public.audit_logs(museum_id,actor_user_id,action,table_name,record_id,new_value)
  values(actor_museum_id,actor_user_id,audit_action,'employee_time_entries',entry_row.id,
    jsonb_build_object('employee_id',employee_row.id,'occurred_at',case when requested_action='clock_in' then entry_row.clock_in else entry_row.clock_out end,'sync_status',entry_row.sync_status));

  return entry_row;
end $$;

revoke all on function public.clock_employee_time(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.clock_employee_time(uuid,uuid,text) to service_role;

grant select on public.employee_time_entries,public.employee_notifications to authenticated;
revoke insert,update,delete on public.employee_time_entries,public.employee_notifications from authenticated;