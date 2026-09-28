-- A reclassified clock_out keeps supersedes_event_id null, so the original-type
-- unique index still treats it as the original exit. A later real exit must
-- point at that retired row instead of inserting a second original.

do $retired_original$
declare
  src text;
  patched text;
begin
  src := replace(pg_get_functiondef('public.correct_shift_attendance_punches(uuid,text,text,uuid,jsonb)'::regprocedure), E'\r\n', E'\n');
  if position('retired_original_id' in src) = 0 then
    patched := replace(src, 'reclassify_clock_out boolean := false;', 'reclassify_clock_out boolean := false; retired_original_id uuid;');
    patched := replace(patched,
      'if reclassify_clock_out and change_type = ''clock_in'' then expected_id := lone_clock_out_id; end if;',
      $link$if reclassify_clock_out and change_type = 'clock_in' then expected_id := lone_clock_out_id; end if;
    retired_original_id := null;
    if expected_id is null then
      select ev.id into retired_original_id
        from public.attendance_events ev
       where ev.shift_id = shift_row.id and ev.museum_id = museum and ev.event_type = change_type
         and ev.supersedes_event_id is null
         and exists (
           select 1 from public.attendance_events newer
            where newer.supersedes_event_id = ev.id and newer.event_type is distinct from ev.event_type
         )
       order by ev.occurred_at desc
       limit 1;
      if retired_original_id is not null then expected_id := retired_original_id; end if;
    end if;$link$);
    if position('retired_original_id' in patched) = 0
       or position('newer.event_type is distinct from ev.event_type' in patched) = 0
       or position('attendance_events_original_type_idx' in patched) > 0 then
      raise exception 'RETIRED_ORIGINAL_PATCH_FAILED';
    end if;
    execute patched;
  end if;
end
$retired_original$;
