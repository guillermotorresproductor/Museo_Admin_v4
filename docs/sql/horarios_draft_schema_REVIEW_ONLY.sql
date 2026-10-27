-- INSTITUVA HORARIOS — DRAFT SCHEMA (NOT APPLIED)
-- Run only in disposable, synthetic-data database after code review.
-- Does not alter any existing tables, triggers, RPCs, attendance or payroll.
BEGIN;
CREATE TABLE IF NOT EXISTS public.schedule_week_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 museum_id uuid NOT NULL,
 week_start date NOT NULL,
 state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published','discarded')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
 created_by uuid NOT NULL,
 published_by uuid,
 published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT week_monday CHECK (extract(isodow from week_start)=1),
 CONSTRAINT published_fields CHECK (
   (state='published' AND published_by IS NOT NULL AND published_at IS NOT NULL)
   OR (state <> 'published' AND published_by IS NULL AND published_at IS NULL)
 )
);
CREATE TABLE IF NOT EXISTS public.schedule_week_draft_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 draft_id uuid NOT NULL REFERENCES public.schedule_week_drafts(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL,
 shift_date date NOT NULL,
 action text NOT NULL CHECK(action IN ('set_shift','day_off')),
 starts_local time,
 ends_local time,
 lunch_minutes integer,
 source_shift_id uuid,
 source_updated_at timestamptz,
 reason text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT draft_shift_fields CHECK (
   (action='day_off' AND starts_local IS NULL AND ends_local IS NULL AND lunch_minutes IS NULL)
   OR (action='set_shift' AND starts_local IS NOT NULL AND ends_local IS NOT NULL
   AND starts_local <> ends_local AND lunch_minutes BETWEEN 0 AND 1439)
 ),
 CONSTRAINT draft_no_duplicate_day UNIQUE(draft_id,employee_id,shift_date)
);
CREATE INDEX IF NOT EXISTS schedule_week_drafts_museum_week
 ON public.schedule_week_drafts(museum_id,week_start);
CREATE INDEX IF NOT EXISTS schedule_week_draft_items_draft
 ON public.schedule_week_draft_items(draft_id);
ALTER TABLE public.schedule_week_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_week_draft_items ENABLE ROW LEVEL SECURITY;
-- Explicitly deny access until audited, permission-scoped CRUD RPCs exist.
REVOKE ALL ON public.schedule_week_drafts FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.schedule_week_draft_items FROM PUBLIC,anon,authenticated;
COMMIT;
