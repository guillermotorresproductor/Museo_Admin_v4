-- Governance effective 2026-10-28: only administrador_general and
-- director_ejecutivo may change registered punch times.
-- gerente_administrativo is denied first, ahead of role grants and
-- user_permissions allow. Consultation, own requests, rejection, schedules,
-- exclusions, history, and payroll are unchanged. Authorized corrections
-- keep their existing audit rows.

do $permission$
declare
  src text;
  changed boolean := false;
  old_allow text := $old$and public.current_employee_module_profile() in ('gerente_administrativo','director_ejecutivo') then$old$;
  new_allow text := $new$and public.current_employee_module_profile() in ('administrador_general','director_ejecutivo') then$new$;
  deny_sql text := $deny$
 -- punch_correction_governance_20261028: gerente_administrativo cannot alter registered punch times. This denial wins over every grant.
 if requested_permission = 'attendance.punches.correct'
    and public.current_employee_module_profile() = 'gerente_administrativo' then
   return false;
 end if;
$deny$;
  pos integer;
begin
  src := replace(pg_get_functiondef('public.has_permission(text)'::regprocedure), E'\r\n', E'\n');
  if position('punch_correction_governance_20261028' in src) = 0 then
    pos := position(E'\nbegin' in src);
    if pos = 0 then raise exception 'PUNCH_CORRECTION_GOVERNANCE_PATCH_FAILED'; end if;
    src := overlay(src placing E'\nbegin' || deny_sql from pos for 6);
    changed := true;
  end if;
  if position(old_allow in src) > 0 then
    if (length(src) - length(replace(src, old_allow, ''))) / length(old_allow) <> 1 then
      raise exception 'PUNCH_CORRECTION_ALLOW_AMBIGUOUS';
    end if;
    src := replace(src, old_allow, new_allow);
    changed := true;
  end if;
  if position('punch_correction_governance_20261028' in src) = 0
     or (length(src) - length(replace(src, new_allow, ''))) / length(new_allow) <> 1
     or position(old_allow in src) > 0 then
    raise exception 'PUNCH_CORRECTION_GOVERNANCE_PATCH_FAILED';
  end if;
  if changed then execute src; end if;
end
$permission$;

do $decide$
declare src text; old text; new text;
begin
  if to_regprocedure('public.decide_attendance_correction(uuid,text,text)') is null then
    raise exception 'DECIDE_SIGNATURE_MISSING';
  end if;
  src := replace(pg_get_functiondef('public.decide_attendance_correction(uuid,text,text)'::regprocedure), E'\r\n', E'\n');
  if position('punch_correction_governance_20261028' in src) > 0 then
    return;
  end if;
  old := E'  if auth.uid() is null or museum is null or not public.has_permission(''attendance.corrections.decide'') then\n    raise exception ''FORBIDDEN'' using errcode = ''42501'';\n  end if;\n';
  new := old || E'  -- punch_correction_governance_20261028: approving a correction writes punch times.\n  if p_decision = ''approved'' and not public.has_permission(''attendance.punches.correct'') then\n    raise exception ''FORBIDDEN'' using errcode = ''42501'';\n  end if;\n';
  if (length(src) - length(replace(src, old, ''))) / length(old) <> 1 then
    raise exception 'DECIDE_GOVERNANCE_PATCH_FAILED';
  end if;
  execute replace(src, old, new);
end
$decide$;

do $legacy$
declare
  src text;
  marker text := 'has_permission_for_user(actor_user_id,actor_museum_id,''attendance.corrections.approve'')';
  pos integer;
  end_at integer;
  guard text := E'\n  -- punch_correction_governance_20261028: gerente_administrativo cannot approve a punch change.\n  if decision = ''approved'' and exists (\n    select 1 from public.employees e\n    where e.profile_id = actor_user_id\n      and e.museum_id = actor_museum_id\n      and e.access_profile = ''gerente_administrativo''\n  ) then\n    raise exception ''FORBIDDEN'' using errcode = ''42501'';\n  end if;\n';
begin
  if to_regprocedure('public.decide_attendance_correction(uuid,uuid,uuid,text,text)') is null then
    return;
  end if;
  src := replace(pg_get_functiondef('public.decide_attendance_correction(uuid,uuid,uuid,text,text)'::regprocedure), E'\r\n', E'\n');
  if position('punch_correction_governance_20261028' in src) > 0 then
    return;
  end if;
  pos := position(marker in src);
  end_at := case when pos = 0 then 0 else position('end if;' in substr(src, pos)) end;
  if pos = 0 or end_at = 0 then raise exception 'LEGACY_DECIDE_GOVERNANCE_PATCH_FAILED'; end if;
  src := overlay(src placing guard from (pos + end_at - 1 + length('end if;')) for 0);
  if position('gerente_administrativo cannot approve a punch change' in src) = 0 then
    raise exception 'LEGACY_DECIDE_GOVERNANCE_PATCH_FAILED';
  end if;
  execute src;
end
$legacy$;
