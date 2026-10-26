-- Preserve overtime decision access for Director Ejecutivo, Administrador General,
-- and Gerente Administrativo. Explicit individual denies remain effective.
-- This migration intentionally does not replace public.has_permission.
-- Abort if the existing production permission block does not contain the expected grant.
do $overtime_decide_profiles$
declare
  src text;
  marker constant text := 'requested_permission = ''attendance.overtime.decide''';
  wide constant text := 'public.current_employee_module_profile() in (''administrador_general'',''director_ejecutivo'',''gerente_administrativo'')';
  start_at integer;
begin
  src := pg_get_functiondef('public.has_permission(text)'::regprocedure);
  start_at := position(marker in src);
  if start_at = 0 then
    raise exception 'OVERTIME_DECIDE_BLOCK_MISSING' using errcode = '55000';
  end if;
  if position(wide in substring(src from start_at for 2500)) = 0 then
    raise exception 'OVERTIME_DECIDE_THREE_PROFILES_MISSING' using errcode = '55000';
  end if;
  if position('p.code = ''attendance.overtime.decide''' in substring(src from start_at for 1500)) = 0
     or position('u.effect = ''deny''' in substring(src from start_at for 1500)) = 0 then
    raise exception 'OVERTIME_DECIDE_EXPLICIT_DENY_MISSING' using errcode = '55000';
  end if;
end
$overtime_decide_profiles$;
