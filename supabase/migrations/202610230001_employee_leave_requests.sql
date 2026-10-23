-- Solicitud de días libres, aislada de ponches, asistencia y nómina.
create table if not exists public.employee_leave_requests (
 id uuid primary key default gen_random_uuid(),
 museum_id uuid not null references public.museums(id),
 employee_id uuid not null references public.employees(id),
 requested_by uuid not null references auth.users(id),
 start_date date not null,
 end_date date not null,
 leave_type text not null check (leave_type in ('personal','vacaciones','enfermedad','otro')),
 reason text not null check(length(btrim(reason)) >= 5),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 check (end_date >= start_date)
);
create index if not exists employee_leave_requests_museum_status_idx on public.employee_leave_requests(museum_id,status,created_at desc);
alter table public.employee_leave_requests enable row level security;
-- Populate immutable tenant and authorship from authenticated account, never from browser input.
create or replace function public.prepare_employee_leave_request()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare target_museum uuid; own_museum uuid; is_manager boolean;
begin
 if auth.uid() is null then raise exception 'Se requiere iniciar sesión'; end if;
 select museum_id into target_museum from public.employees where id = new.employee_id;
 select museum_id into own_museum from public.profiles where id = auth.uid() and status='activo';
 if target_museum is null or own_museum is distinct from target_museum then
   raise exception 'Empleado no autorizado';
 end if;
 select exists(select 1 from public.employees e where e.profile_id=auth.uid() and e.museum_id=target_museum and e.access_profile='gerente_administrativo')
 into is_manager;
 if not is_manager and not exists(select 1 from public.employees e where e.id=new.employee_id and e.profile_id=auth.uid()) then
   raise exception 'Solo puede solicitar para su propio expediente';
 end if;
 new.museum_id := target_museum;
 new.requested_by := auth.uid();
 new.status := 'pending';
 new.reviewed_by := null;
 new.reviewed_at := null;
 return new;
end $$;
drop trigger if exists prepare_employee_leave_request_trigger on public.employee_leave_requests;
create trigger prepare_employee_leave_request_trigger before insert on public.employee_leave_requests
for each row execute function public.prepare_employee_leave_request();
revoke all on function public.prepare_employee_leave_request() from public, anon, authenticated;
grant select,insert on public.employee_leave_requests to authenticated;
create policy leave_read_on_own_museum on public.employee_leave_requests for select to authenticated
using (
 requested_by=(select auth.uid())
 or exists(select 1 from public.employees e where e.profile_id=(select auth.uid()) and e.museum_id=employee_leave_requests.museum_id and e.access_profile='gerente_administrativo')
);
create policy leave_insert_authenticated on public.employee_leave_requests for insert to authenticated
with check (requested_by=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.museum_id=employee_leave_requests.museum_id and p.status='activo'));
-- Decisions are centralized: client roles never have direct UPDATE rights.
create or replace function public.review_employee_leave_request(p_request_id uuid,p_decision text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare leave_row public.employee_leave_requests%rowtype;
begin
 if auth.uid() is null or p_decision not in ('approved','rejected') then raise exception 'Decisión no autorizada'; end if;
 select * into leave_row from public.employee_leave_requests where id=p_request_id for update;
 if not found then raise exception 'Solicitud no encontrada'; end if;
 if not exists (select 1 from public.employees e where e.profile_id=auth.uid() and e.museum_id=leave_row.museum_id and e.access_profile='gerente_administrativo') then
   raise exception 'Permiso insuficiente';
 end if;
 if leave_row.status <> 'pending' then raise exception 'La solicitud ya fue revisada'; end if;
 if leave_row.requested_by=auth.uid() then raise exception 'No puede aprobar su propia solicitud'; end if;
 update public.employee_leave_requests set status=p_decision, reviewed_by=auth.uid(), reviewed_at=now() where id=p_request_id;
end $$;
revoke all on function public.review_employee_leave_request(uuid,text) from public,anon;
grant execute on function public.review_employee_leave_request(uuid,text) to authenticated;
