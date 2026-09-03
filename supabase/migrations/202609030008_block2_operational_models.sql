-- Block 2 operational foundation: real calendar and maintenance records.
-- Additive and idempotent across Staging and Production legacy schemas.

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete cascade,
  calendar_type text not null check (calendar_type in ('general','mantenimiento','ujieres')),
  title text not null,
  description text,
  event_date date not null,
  start_time time,
  end_time time,
  location text,
  assigned_employee_id uuid references public.employees(id),
  status text default 'pendiente',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id) on delete cascade,
  employee_id uuid references public.employees(id),
  area text,
  task text not null,
  task_date date,
  status text default 'pendiente',
  observations text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events
  add column if not exists updated_by uuid references public.profiles(id),
  add column if not exists archived_at timestamptz;

alter table public.maintenance_tasks
  add column if not exists record_type text not null default 'work',
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists updated_by uuid references public.profiles(id),
  add column if not exists archived_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='maintenance_tasks_record_type_check' and conrelid='public.maintenance_tasks'::regclass) then
    alter table public.maintenance_tasks add constraint maintenance_tasks_record_type_check
      check (record_type in ('work','material_request','route_inspection'));
  end if;
end $$;

create or replace function public.can_manage_maintenance()
returns boolean language sql stable security definer set search_path='' as $$
  select public.has_permission('maintenance.manage')
    or (public.has_permission('calendar.manage')
      and public.has_permission('audit.read')
      and public.has_permission('notifications.manage'))
$$;
revoke all on function public.can_manage_maintenance() from public,anon;
grant execute on function public.can_manage_maintenance() to authenticated;

create index if not exists calendar_events_museum_date_idx
  on public.calendar_events(museum_id,event_date) where archived_at is null;
create index if not exists maintenance_tasks_museum_type_date_idx
  on public.maintenance_tasks(museum_id,record_type,task_date) where archived_at is null;

insert into public.permissions(code,description,sensitivity) values
 ('maintenance.manage','Administrar obras, solicitudes e inspecciones de mantenimiento','sensitive')
on conflict(code) do update set description=excluded.description,sensitivity=excluded.sensitivity;

do $$ begin
  if to_regclass('public.roles') is not null and to_regclass('public.role_permissions') is not null then
    execute $sql$
      insert into public.role_permissions(role_id,permission_id)
      select r.id,p.id from public.roles r cross join public.permissions p
      where r.code in ('administrador','ejecutivo') and p.code='maintenance.manage'
      on conflict do nothing
    $sql$;
  end if;
end $$;

create or replace function public.block2_write_audit()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  actor_column text;
  audit_action text;
  before_value jsonb;
  after_value jsonb;
begin
  if tg_op='INSERT' then
    audit_action:=upper(tg_table_name)||'_CREATED'; before_value:=null; after_value:=to_jsonb(new);
  else
    before_value:=to_jsonb(old); after_value:=to_jsonb(new);
    if old.archived_at is null and new.archived_at is not null then
      audit_action:=upper(tg_table_name)||'_ARCHIVED';
    else
      audit_action:=upper(tg_table_name)||'_UPDATED';
    end if;
  end if;
  select case
    when exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='actor_user_id') then 'actor_user_id'
    when exists(select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='user_id') then 'user_id'
  end into actor_column;
  if actor_column is null then raise exception 'Incompatible public.audit_logs actor column'; end if;
  execute format('insert into public.audit_logs(museum_id,%I,action,table_name,record_id,old_value,new_value) values($1,$2,$3,$4,$5,$6,$7)',actor_column)
    using coalesce(new.museum_id,old.museum_id),auth.uid(),audit_action,tg_table_name,coalesce(new.id,old.id),before_value,after_value;
  return new;
end $$;

drop trigger if exists calendar_events_block2_audit on public.calendar_events;
create trigger calendar_events_block2_audit after insert or update on public.calendar_events
for each row execute function public.block2_write_audit();
drop trigger if exists maintenance_tasks_block2_audit on public.maintenance_tasks;
create trigger maintenance_tasks_block2_audit after insert or update on public.maintenance_tasks
for each row execute function public.block2_write_audit();

alter table public.calendar_events enable row level security;
alter table public.maintenance_tasks enable row level security;

drop policy if exists "admins and executives can manage calendar events" on public.calendar_events;
drop policy if exists "users can read calendar events in museum" on public.calendar_events;
drop policy if exists calendar_events_authorized_read on public.calendar_events;
drop policy if exists calendar_events_authorized_insert on public.calendar_events;
drop policy if exists calendar_events_authorized_update on public.calendar_events;
create policy calendar_events_authorized_read on public.calendar_events for select to authenticated
  using (museum_id=public.current_user_museum_id() and public.has_permission('calendar.manage'));
create policy calendar_events_authorized_insert on public.calendar_events for insert to authenticated
  with check (museum_id=public.current_user_museum_id() and created_by=auth.uid() and updated_by=auth.uid() and public.has_permission('calendar.manage'));
create policy calendar_events_authorized_update on public.calendar_events for update to authenticated
  using (museum_id=public.current_user_museum_id() and public.has_permission('calendar.manage'))
  with check (museum_id=public.current_user_museum_id() and updated_by=auth.uid() and public.has_permission('calendar.manage'));

drop policy if exists "admins and executives can manage maintenance tasks" on public.maintenance_tasks;
drop policy if exists "users can read maintenance tasks in museum" on public.maintenance_tasks;
drop policy if exists maintenance_tasks_authorized_read on public.maintenance_tasks;
drop policy if exists maintenance_tasks_authorized_insert on public.maintenance_tasks;
drop policy if exists maintenance_tasks_authorized_update on public.maintenance_tasks;
create policy maintenance_tasks_authorized_read on public.maintenance_tasks for select to authenticated
  using (museum_id=public.current_user_museum_id() and public.can_manage_maintenance());
create policy maintenance_tasks_authorized_insert on public.maintenance_tasks for insert to authenticated
  with check (museum_id=public.current_user_museum_id() and created_by=auth.uid() and updated_by=auth.uid() and public.can_manage_maintenance());
create policy maintenance_tasks_authorized_update on public.maintenance_tasks for update to authenticated
  using (museum_id=public.current_user_museum_id() and public.can_manage_maintenance())
  with check (museum_id=public.current_user_museum_id() and updated_by=auth.uid() and public.can_manage_maintenance());

grant select,insert,update on public.calendar_events,public.maintenance_tasks to authenticated;
revoke delete on public.calendar_events,public.maintenance_tasks from authenticated;
