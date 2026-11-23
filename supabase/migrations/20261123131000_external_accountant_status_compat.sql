-- Preserve the same narrow accountant-only guard on differently versioned museum databases.
do $patch$
declare definition text;
begin
 definition := pg_get_functiondef('public.has_permission(text)'::regprocedure);
 if position('pr.status in (''active'',''activo'') and pr.role = ''empleado''' in definition)>0 then
   return;
 end if;
 if position('pr.status = ''activo'' and pr.role = ''empleado''' in definition)=0 then
   raise exception 'Unexpected external accountant permission guard; abort';
 end if;
 execute replace(definition,
   'pr.status = ''activo'' and pr.role = ''empleado''',
   'pr.status in (''active'',''activo'') and pr.role = ''empleado''');
end $patch$;
