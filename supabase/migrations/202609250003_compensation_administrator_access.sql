-- Administrador may read and set another employee's compensation.
-- Does not change employee_compensation, rates, or the self-edit ban.
-- Legacy administrator: no module profile and role administrador.

do $patch$
declare src text; patched text;
  old_sql text := $old$and public.current_employee_module_profile() in ('director_ejecutivo','gerente_administrativo') then$old$;
  new_sql text := $new$and (
      public.current_employee_module_profile() in ('administrador_general','director_ejecutivo','gerente_administrativo')
      or (
        public.current_employee_module_profile() is null
        and exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid()
            and lower(pr.role) = 'administrador'
        )
      )
    ) then
 -- compensation_administrator_access$new$;
begin
  src := pg_get_functiondef('public.has_permission(text)'::regprocedure);
  if position('compensation_administrator_access' in src) > 0 then
    return;
  end if;
  if position(old_sql in src) = 0 then
    raise exception 'COMPENSATION_GRANT_NOT_FOUND';
  end if;
  patched := replace(src, old_sql, new_sql);
  if patched = src or position('compensation_administrator_access' in patched) = 0 then
    raise exception 'HAS_PERMISSION_PATCH_FAILED';
  end if;
  execute patched;
end
$patch$;
