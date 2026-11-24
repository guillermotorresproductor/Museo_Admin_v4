-- Scoped fix: an unrelated, later open time entry must not block
-- an authorized correction of a fully historical shift.
-- Preserve the complete deployed function, including all audit, permissions,
-- exclusions, correction history, overtime and payroll reconciliation rules.
do $migration$
declare
  original_definition text;
  amended_definition text;
  original_predicate text := 't.excluded_at is null and (t.clock_out is null or t.clock_in = new_in)';
  replacement_predicate text := $predicate$t.excluded_at is null
         and (
           -- An identical entry is always a conflict.
           t.clock_in = new_in
           -- For closed entries, detect actual overlaps with the correction.
           or (t.clock_out is not null
               and t.clock_out > new_in
               and (new_out is null or t.clock_in < new_out))
           -- An open entry conflicts only when it begins before the
           -- corrected shift finishes; future open entries do not.
           or (t.clock_out is null
               and (new_out is null or t.clock_in < new_out))
         )$predicate$;
begin
 select pg_get_functiondef(
   'public.correct_shift_attendance_punches(uuid,text,text,uuid,jsonb)'::regprocedure
 ) into original_definition;
 if original_definition is null then
   raise exception 'Correction function missing; abort';
 end if;
 if length(original_definition) - length(replace(original_definition,original_predicate,''))
    <> length(original_predicate) then
   raise exception 'Correction guard changed or duplicated; abort without changes';
 end if;
 amended_definition := replace(original_definition,original_predicate,replacement_predicate);
 execute amended_definition;
end $migration$;
