-- A lone clock_out can be reclassified as the shift clock_in without rewriting
-- the original event. An excluded open time entry must not block that correction.
-- record_employee_attendance rejects clock_out when the shift has no effective event.

do $reclassify$
declare
  src text;
  patched text;
begin
  src := replace(pg_get_functiondef('public.correct_shift_attendance_punches(uuid,text,text,uuid,jsonb)'::regprocedure), E'\r\n', E'\n');
  if position('reclassify_clock_out' in src) = 0 then
    patched := replace(src, 'review_id uuid;', 'review_id uuid; lone_out_count integer := 0; lone_clock_out_id uuid; reclassify_clock_out boolean := false;');
    patched := replace(patched,
      'if (new_lunch_out is null) is distinct from (new_lunch_in is null) then',
      $block$select count(*) into lone_out_count
    from public.attendance_events ev
   where ev.shift_id = shift_row.id and ev.museum_id = museum and ev.event_type = 'clock_out'
     and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id);
  if lone_out_count = 1 then
    select ev.id into lone_clock_out_id
      from public.attendance_events ev
     where ev.shift_id = shift_row.id and ev.museum_id = museum and ev.event_type = 'clock_out'
       and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id = ev.id)
     order by ev.occurred_at desc
     limit 1;
  end if;
  if old_in is null
     and old_lunch_out is null
     and old_lunch_in is null
     and old_out is not null
     and new_in is not null
     and lone_out_count = 1
     and not ('clock_out' = any(seen))
     and not ('lunch_out' = any(seen))
     and not ('lunch_in' = any(seen))
     and date_trunc('minute', new_in) = date_trunc('minute', old_out)
  then
    reclassify_clock_out := true;
    new_out := null;
    new_clock_out_event := null;
  end if;

  if (new_lunch_out is null) is distinct from (new_lunch_in is null) then$block$);
    patched := replace(patched,
      E'expected_id := nullif(change->>''expected_event_id'', '''')::uuid;\n    classification := ''standard'';',
      E'expected_id := nullif(change->>''expected_event_id'', '''')::uuid;\n    if reclassify_clock_out and change_type = ''clock_in'' then expected_id := lone_clock_out_id; end if;\n    classification := ''standard'';');
    patched := replace(patched,
      'and (t.clock_out is null or t.clock_in = new_in)',
      'and t.excluded_at is null and (t.clock_out is null or t.clock_in = new_in)');
    if position('reclassify_clock_out' in patched) = 0
       or position('lone_clock_out_id' in patched) = 0
       or position('t.excluded_at is null and (t.clock_out is null or t.clock_in = new_in)' in patched) = 0
       or position('if reclassify_clock_out and change_type = ''clock_in''' in patched) = 0 then
      raise exception 'RECLASSIFY_PATCH_FAILED';
    end if;
    execute patched;
  end if;
end
$reclassify$;

do $sequence$
declare
  src text;
  patched text;
begin
  src := replace(pg_get_functiondef('public.record_employee_attendance(uuid,uuid,text,jsonb)'::regprocedure), E'\r\n', E'\n');
  if position('prior_ev.event_type into prior' in src) = 0 then
    patched := src;
    if position('select event_type into prior from public.attendance_events where shift_id=s.id order by occurred_at desc limit 1;' in patched) > 0 then
      patched := replace(patched,
        'select event_type into prior from public.attendance_events where shift_id=s.id order by occurred_at desc limit 1;',
        'select prior_ev.event_type into prior from public.attendance_events prior_ev where prior_ev.shift_id=s.id and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id=prior_ev.id) and not public.attendance_is_excluded(prior_ev.shift_id, null) and not public.attendance_is_excluded(prior_ev.shift_id, prior_ev.id) order by prior_ev.occurred_at desc limit 1;');
      patched := replace(patched,
        'or (requested_event=''clock_out'' and prior not in (''clock_in'',''lunch_in''))',
        'or (requested_event=''clock_out'' and (prior is null or prior not in (''clock_in'',''lunch_in'')))');
    elsif position('select ev.event_type into prior from public.attendance_events ev where ev.shift_id=s.id' in patched) > 0 then
      patched := replace(patched,
        'select ev.event_type into prior from public.attendance_events ev where ev.shift_id=s.id and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id=ev.id) and not public.attendance_is_excluded(ev.shift_id, null) and not public.attendance_is_excluded(ev.shift_id, ev.id) order by ev.occurred_at desc limit 1;',
        'select prior_ev.event_type into prior from public.attendance_events prior_ev where prior_ev.shift_id=s.id and not exists (select 1 from public.attendance_events newer where newer.supersedes_event_id=prior_ev.id) and not public.attendance_is_excluded(prior_ev.shift_id, null) and not public.attendance_is_excluded(prior_ev.shift_id, prior_ev.id) order by prior_ev.occurred_at desc limit 1;');
    else
      raise exception 'PUNCH_SEQUENCE_PATCH_FAILED';
    end if;
    if position('prior_ev.event_type into prior' in patched) = 0
       or position('prior is null or prior not in (''clock_in'',''lunch_in'')' in patched) = 0
       or position('attendance_is_excluded(prior_ev.shift_id, prior_ev.id)' in patched) = 0 then
      raise exception 'PUNCH_SEQUENCE_PATCH_FAILED';
    end if;
    execute patched;
  end if;
end
$sequence$;
