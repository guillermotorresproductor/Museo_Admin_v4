-- The approver list and the server check must name the same people:
-- administrador_general and director_ejecutivo. gerente_administrativo
-- is not an approver of a punch-time change, including their own.

do $authorizers$
declare
  fn regprocedure;
  src text;
  old_profile text := $old$e.access_profile in ('director_ejecutivo','gerente_administrativo')$old$;
  new_profile text := $new$e.access_profile in ('administrador_general','director_ejecutivo')$new$;
  hits integer;
begin
  foreach fn in array array[
    'public.list_attendance_correction_authorizers()'::regprocedure,
    'public.correct_shift_attendance_punches(uuid,text,text,uuid,jsonb)'::regprocedure
  ]
  loop
    src := replace(pg_get_functiondef(fn), E'\r\n', E'\n');
    hits := (length(src) - length(replace(src, old_profile, ''))) / length(old_profile);
    if hits = 0 then
      if (length(src) - length(replace(src, new_profile, ''))) / length(new_profile) <> 1 then
        raise exception 'AUTHORIZER_PROFILE_PATCH_FAILED';
      end if;
    elsif hits = 1 then
      execute replace(src, old_profile, new_profile);
    else
      raise exception 'AUTHORIZER_PROFILE_PATCH_AMBIGUOUS';
    end if;
  end loop;
end
$authorizers$;
