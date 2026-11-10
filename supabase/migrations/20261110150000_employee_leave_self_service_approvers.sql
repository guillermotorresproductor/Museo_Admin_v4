-- Self-service leave requests: do not alter attendance, payroll or schedules.
-- Apply first in staging after reviewing current function and policy definitions.
begin;
create or replace function public.prepare_employee_leave_request()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare target_museum uuid; own_museum uuid;
begin
  if auth.uid() is null then raise exception 'Se requiere iniciar sesión'; end if;
  select museum_id into target_museum from public.employees where id = new.employee_id and profile_id = auth.uid();
  select museum_id into own_museum from public.profiles where id = auth.uid() and status = 'activo';
  if target_museum is null or own_museum is distinct from target_museum then
    raise exception 'Solo puede solicitar días libres para su propio expediente';
  end if;
  new.museum_id := target_museum;
  new.requested_by := auth.uid();
  new.status := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  return new;
end $$;
revoke all on function public.prepare_employee_leave_request() from public, anon, authenticated;

drop policy if exists leave_read_on_own_museum on public.employee_leave_requests;
create policy leave_read_on_own_museum on public.employee_leave_requests
for select to authenticated using (
  requested_by = (select auth.uid())
  or exists (
    select 1 from public.employees reviewer
    join public.profiles p on p.id = reviewer.profile_id and p.museum_id = reviewer.museum_id
    where reviewer.profile_id = (select auth.uid())
      and reviewer.museum_id = employee_leave_requests.museum_id
      and p.status = 'activo'
      and reviewer.access_profile in ('gerente_administrativo','director_ejecutivo','administrador_general')
  )
);

create or replace function public.review_employee_leave_request(p_request_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare leave_row public.employee_leave_requests%rowtype;
begin
  if auth.uid() is null or p_decision not in ('approved','rejected') then
    raise exception 'Decisión no autorizada';
  end if;
  select * into leave_row from public.employee_leave_requests where id = p_request_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if not exists (
    select 1 from public.employees reviewer
    join public.profiles p on p.id=reviewer.profile_id and p.museum_id=reviewer.museum_id
    where reviewer.profile_id=auth.uid() and reviewer.museum_id=leave_row.museum_id
      and p.status='activo'
      and reviewer.access_profile in ('gerente_administrativo','director_ejecutivo','administrador_general')
  ) then raise exception 'Permiso insuficiente'; end if;
  if leave_row.status <> 'pending' then raise exception 'La solicitud ya fue revisada'; end if;
  if leave_row.requested_by = auth.uid() or exists (
    select 1 from public.employees e
    where e.id=leave_row.employee_id and e.profile_id=auth.uid()
  ) then raise exception 'No puede aprobar ni rechazar su propia solicitud'; end if;
  update public.employee_leave_requests
    set status=p_decision, reviewed_by=auth.uid(), reviewed_at=now()
    where id=p_request_id;
end $$;
revoke all on function public.review_employee_leave_request(uuid,text) from public, anon;
grant execute on function public.review_employee_leave_request(uuid,text) to authenticated;
commit;
