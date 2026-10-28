-- Administrador General consulta, crea, guarda, edita y cancela horarios
-- con el mismo schedules.manage que Director Ejecutivo y Gerente Administrativo.
-- No otorga otros permisos. Una denegación explícita sigue ganando.
do $schedule_three$
declare
  src text;
  patched text;
  marker constant text := 'requested_permission = ''schedules.manage''';
  old_list constant text := 'public.current_employee_module_profile() in (''director_ejecutivo'',''gerente_administrativo'')';
  new_list constant text := 'public.current_employee_module_profile() in (''administrador_general'',''director_ejecutivo'',''gerente_administrativo'')';
  start_at integer;
  block text;
  before_count integer;
  after_count integer;
begin
  src := replace(pg_get_functiondef('public.has_permission(text)'::regprocedure), E'\r\n', E'\n');
  if position('schedules_manage_three_profiles' in src) > 0 then
    return;
  end if;
  start_at := position(marker in src);
  if start_at = 0 then
    raise exception 'SCHEDULES_MANAGE_BLOCK_MISSING' using errcode = '55000';
  end if;
  block := substring(src from start_at);
  if position('u.effect = ''deny''' in substring(block from 1 for 900)) = 0 then
    raise exception 'SCHEDULES_MANAGE_EXPLICIT_DENY_MISSING' using errcode = '55000';
  end if;
  if position(old_list in block) = 0 then
    raise exception 'SCHEDULES_MANAGE_PROFILE_LIST_MISSING' using errcode = '55000';
  end if;
  patched := overlay(
    src
    placing new_list || E'\n -- schedules_manage_three_profiles'
    from (start_at + position(old_list in block) - 1)
    for char_length(old_list)
  );
  before_count := (char_length(src) - char_length(replace(src, old_list, ''))) / char_length(old_list);
  after_count := (char_length(patched) - char_length(replace(patched, old_list, ''))) / char_length(old_list);
  if after_count <> before_count - 1
     or position('schedules_manage_three_profiles' in patched) = 0
     or position(new_list in substring(patched from start_at for 2500)) = 0 then
    raise exception 'SCHEDULES_MANAGE_PATCH_FAILED' using errcode = '55000';
  end if;
  execute patched;
end
$schedule_three$;
