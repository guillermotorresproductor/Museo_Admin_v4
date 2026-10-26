-- 202609250003 replaced every director/gerente grant in has_permission,
-- including attendance.overtime.decide. Compensation and history keep the
-- wider grant. Overtime decisions stay with the two profiles named here.

do $overtime_decide_profiles$
declare
  src text;
  patched text;
  marker constant text := 'requested_permission = ''attendance.overtime.decide''';
  wide constant text := $wide$public.current_employee_module_profile() in ('administrador_general','director_ejecutivo','gerente_administrativo')
      or (
        public.current_employee_module_profile() is null
        and exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid()
            and lower(pr.role) = 'administrador'
        )
      )$wide$;
  narrow constant text := 'public.current_employee_module_profile() in (''director_ejecutivo'',''gerente_administrativo'')';
  wide_text text;
  start_at integer;
  wide_at integer;
begin
  src := replace(pg_get_functiondef('public.has_permission(text)'::regprocedure), E'\r', '');
  wide_text := replace(wide, E'\r', '');
  start_at := position(marker in src);
  if start_at = 0 then
    raise exception 'OVERTIME_DECIDE_BLOCK_MISSING' using errcode = '55000';
  end if;
  wide_at := position(wide_text in substring(src from start_at));
  if wide_at = 0 then
    if position(narrow in substring(src from start_at for 1600)) > 0 then
      return;
    end if;
    raise exception 'OVERTIME_DECIDE_WIDE_GRANT_MISSING' using errcode = '55000';
  end if;
  patched := overlay(src placing narrow from (start_at + wide_at - 1) for char_length(wide_text));
  if position(wide_text in substring(patched from start_at for 1800)) > 0
     or position(narrow in substring(patched from start_at for 1800)) = 0 then
    raise exception 'OVERTIME_DECIDE_STILL_WIDE' using errcode = '55000';
  end if;
  if position(wide_text in patched) = 0 then
    raise exception 'COMPENSATION_GRANT_REMOVED' using errcode = '55000';
  end if;
  execute patched;
end
$overtime_decide_profiles$;
