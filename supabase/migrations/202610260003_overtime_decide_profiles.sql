-- Keep attendance.overtime.decide for the three administrative profiles.
-- An individual user_permissions deny still wins. Compensation grants stay as they are.

do $overtime_decide_profiles$
declare
  src text;
  patched text;
  marker constant text := 'requested_permission = ''attendance.overtime.decide''';
  two constant text := 'public.current_employee_module_profile() in (''director_ejecutivo'',''gerente_administrativo'')';
  three constant text := 'public.current_employee_module_profile() in (''administrador_general'',''director_ejecutivo'',''gerente_administrativo'')';
  start_at integer;
  block_end integer;
  overtime_block text;
  found_at integer;
begin
  src := replace(pg_get_functiondef('public.has_permission(text)'::regprocedure), E'\r', '');
  start_at := position(marker in src);
  if start_at = 0 then
    raise exception 'OVERTIME_DECIDE_BLOCK_MISSING' using errcode = '55000';
  end if;
  block_end := position('end if;' in substring(src from start_at));
  if block_end = 0 then
    raise exception 'OVERTIME_DECIDE_BLOCK_OPEN' using errcode = '55000';
  end if;
  overtime_block := substring(src from start_at for block_end + 6);
  if position('effect = ''deny''' in overtime_block) = 0 then
    raise exception 'OVERTIME_DECIDE_DENY_MISSING' using errcode = '55000';
  end if;
  if position('administrador_general' in overtime_block) > 0
     and position('director_ejecutivo' in overtime_block) > 0
     and position('gerente_administrativo' in overtime_block) > 0 then
    return;
  end if;
  found_at := position(two in overtime_block);
  if found_at = 0 then
    raise exception 'OVERTIME_DECIDE_PROFILE_LIST_MISSING' using errcode = '55000';
  end if;
  patched := overlay(src placing three from (start_at + found_at - 1) for char_length(two));
  overtime_block := substring(patched from start_at for position('end if;' in substring(patched from start_at)) + 6);
  if position('administrador_general' in overtime_block) = 0
     or position('director_ejecutivo' in overtime_block) = 0
     or position('gerente_administrativo' in overtime_block) = 0
     or position('effect = ''deny''' in overtime_block) = 0 then
    raise exception 'OVERTIME_DECIDE_PROFILES_NOT_KEPT' using errcode = '55000';
  end if;
  execute patched;
end
$overtime_decide_profiles$;
