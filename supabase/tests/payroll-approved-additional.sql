-- Classification and one-time approval. Rolls back. Does not approve production rows.
begin;

do $test$
declare
  split jsonb;
  ordinary integer := 0;
  extraordinary integer := 0;
  week_ordinary integer := 0;
  day_regular integer := 0;
  current_day date := null;
  item record;
begin
  for item in
    select *
    from (values
      (date '2026-10-13', 480, 18, false),
      (date '2026-10-14', 480, 35, false),
      (date '2026-10-15', 480, 90, false),
      (date '2026-10-19', 480, 3, true),
      (date '2026-10-23', 480, 1, false)
    ) as days(shift_date, regular_minutes, approved_minutes, week_reset)
  loop
    if item.week_reset then
      week_ordinary := 0;
      day_regular := 0;
      current_day := null;
    end if;
    if current_day is distinct from item.shift_date then
      day_regular := 0;
      current_day := item.shift_date;
    end if;
    split := public.classify_approved_additional_minutes(day_regular, item.regular_minutes, week_ordinary, item.approved_minutes);
    if (split->>'ordinary_minutes')::integer <> 0 then
      raise exception 'ROBERTO_ORDINARY %', split;
    end if;
    extraordinary := extraordinary + (split->>'extraordinary_minutes')::integer;
    ordinary := ordinary + (split->>'ordinary_minutes')::integer;
    week_ordinary := (split->>'week_ordinary_after')::integer;
    day_regular := (split->>'day_regular_after')::integer;
  end loop;
  if extraordinary <> 147 or ordinary <> 0 then
    raise exception 'ROBERTO_TOTAL % %', ordinary, extraordinary;
  end if;

  split := public.classify_approved_additional_minutes(0, 480, 0, 90);
  if (split->>'ordinary_minutes')::integer <> 0 or (split->>'extraordinary_minutes')::integer <> 90 then
    raise exception 'UNDER_40_STILL_DAILY_OT %', split;
  end if;

  split := public.classify_approved_additional_minutes(0, 360, 0, 180);
  if (split->>'ordinary_minutes')::integer <> 120 or (split->>'extraordinary_minutes')::integer <> 60 then
    raise exception 'SHORT_DAY_SPLIT %', split;
  end if;

  split := public.classify_approved_additional_minutes(0, 200, 2300, 80);
  if (split->>'ordinary_minutes')::integer <> 0 or (split->>'extraordinary_minutes')::integer <> 80 then
    raise exception 'WEEKLY_OT %', split;
  end if;

  split := public.classify_approved_additional_minutes(0, 0, 2320, 100);
  if (split->>'ordinary_minutes')::integer <> 80 or (split->>'extraordinary_minutes')::integer <> 20
     or (split->>'week_ordinary_after')::integer <> 2400 then
    raise exception 'WEEKLY_ROOM %', split;
  end if;

  split := public.classify_approved_additional_minutes(300, 300, 300, 30);
  if (split->>'ordinary_minutes')::integer <> 0 or (split->>'extraordinary_minutes')::integer <> 30 then
    raise exception 'SECOND_SHIFT_SAME_DAY %', split;
  end if;

  split := public.classify_approved_additional_minutes(0, 480, 0, 0);
  if (split->>'ordinary_minutes')::integer <> 0 or (split->>'extraordinary_minutes')::integer <> 0 then
    raise exception 'UNAPPROVED_COUNTED %', split;
  end if;

  split := public.classify_approved_additional_minutes(0, 600, 0, 0);
  if (split->>'regular_ordinary_minutes')::integer <> 480
     or (split->>'regular_extraordinary_minutes')::integer <> 120 then
    raise exception 'DAILY_OT_UNDER_40 %', split;
  end if;

  split := public.classify_approved_additional_minutes(0, 200, 2300, 0);
  if (split->>'regular_ordinary_minutes')::integer <> 100
     or (split->>'regular_extraordinary_minutes')::integer <> 100 then
    raise exception 'WEEKLY_OT_ON_REGULAR %', split;
  end if;

  if position('WEEKLY_SCHEDULE_LIMIT' in pg_get_functiondef('public.attendance_week_schedule_guard(uuid,uuid,date,uuid,timestamptz,timestamptz,integer,text)'::regprocedure)) = 0
     or position('record_employee_attendance' in pg_get_functiondef('public.attendance_week_schedule_guard(uuid,uuid,date,uuid,timestamptz,timestamptz,integer,text)'::regprocedure)) > 0 then
    raise exception 'SCHEDULE_GUARD_TOUCHES_PUNCHES';
  end if;

  if position('status = ''pending''' in pg_get_functiondef('public.decide_overtime_review(uuid,text,integer,text)'::regprocedure)) = 0
     or position('OVERTIME_ALREADY_DECIDED' in pg_get_functiondef('public.decide_overtime_review(uuid,text,integer,text)'::regprocedure)) = 0
     or position('attendance.overtime.decide' in pg_get_functiondef('public.decide_overtime_review(uuid,text,integer,text)'::regprocedure)) = 0
     or position('audit_logs' in pg_get_functiondef('public.decide_overtime_review(uuid,text,integer,text)'::regprocedure)) = 0 then
    raise exception 'DECISION_GUARD_MISSING';
  end if;

  if position('update public.attendance_events' in pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure)) > 0
     or position('update public.attendance_overtime_reviews' in pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure)) > 0
     or position('update public.finance_records' in pg_get_functiondef('public.payroll_actual(date,date)'::regprocedure)) > 0 then
    raise exception 'PAYROLL_WRITES_SOURCE_DATA';
  end if;
end
$test$;

rollback;
