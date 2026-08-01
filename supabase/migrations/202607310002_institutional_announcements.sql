-- Institutional announcements (Boletín de Avisos Institucionales)
-- Pending: apply only after security audit. Do not db push from casual work.

insert into public.permissions(code, description, sensitivity) values
  ('announcements.publish', 'Publicar y archivar avisos institucionales', 'sensitive'),
  ('announcements.read', 'Leer avisos institucionales del museo', 'normal')
on conflict (code) do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on (
  (r.code in ('ejecutivo', 'administrador') and p.code = 'announcements.publish')
  or (
    r.code in ('empleado', 'supervisor', 'recursos_humanos', 'finanzas', 'ejecutivo', 'administrador')
    and p.code = 'announcements.read'
  )
)
on conflict do nothing;

create table if not exists public.institutional_announcements (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id),
  title text not null check (length(btrim(title)) > 0),
  body text not null check (length(btrim(body)) > 0),
  published_by uuid not null references public.profiles(id),
  published_at timestamptz not null default now(),
  status text not null default 'published' check (status in ('published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists institutional_announcements_museum_published_idx
  on public.institutional_announcements (museum_id, published_at desc);
create index if not exists institutional_announcements_museum_status_idx
  on public.institutional_announcements (museum_id, status, published_at desc);

create table if not exists public.institutional_announcement_recipients (
  announcement_id uuid not null references public.institutional_announcements(id) on delete restrict,
  museum_id uuid not null references public.museums(id),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notified_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (announcement_id, recipient_user_id)
);

create index if not exists institutional_announcement_recipients_museum_idx
  on public.institutional_announcement_recipients (museum_id);
create index if not exists institutional_announcement_recipients_user_idx
  on public.institutional_announcement_recipients (recipient_user_id, notified_at desc);
create index if not exists institutional_announcement_recipients_read_idx
  on public.institutional_announcement_recipients (recipient_user_id, read_at);

alter table public.employee_notifications
  add column if not exists related_announcement_id uuid
  references public.institutional_announcements(id) on delete set null;

create index if not exists employee_notifications_related_announcement_idx
  on public.employee_notifications (related_announcement_id)
  where related_announcement_id is not null;

alter table public.institutional_announcements enable row level security;
alter table public.institutional_announcement_recipients enable row level security;

-- RPC-only access: no direct PostgREST SELECT for authenticated.
revoke all on table public.institutional_announcements from public, anon, authenticated;
revoke all on table public.institutional_announcement_recipients from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers (SECURITY DEFINER, empty search_path, EXECUTE revoked)
-- Relies on public.employee_status_is_active() from usher migration (fail-closed).
-- ---------------------------------------------------------------------------

create or replace function public.profile_has_nonactive_linked_employee(
  p_profile_id uuid,
  p_museum_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- True when any same-museum employee link for this auth/profile is not explicitly active.
  select exists (
    select 1
    from public.employees e
    where e.museum_id = p_museum_id
      and p_profile_id is not null
      and (e.auth_user_id = p_profile_id or e.profile_id = p_profile_id)
      and not public.employee_status_is_active(e.status)
  );
$$;

create or replace function public.profile_has_active_auth_linked_employee(
  p_profile_id uuid,
  p_museum_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Active employee with a real Auth link (auth_user_id set and matching the profile).
  select exists (
    select 1
    from public.employees e
    where e.museum_id = p_museum_id
      and p_profile_id is not null
      and e.auth_user_id = p_profile_id
      and (e.profile_id is null or e.profile_id = p_profile_id)
      and public.employee_status_is_active(e.status)
  );
$$;

create or replace function public.linked_employee_blocks_announcements()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Fail-closed: any linked employee that is not explicitly active blocks all announcement privileges,
  -- including Administrador / Ejecutivo / announcements.publish.
  select public.profile_has_nonactive_linked_employee(
    auth.uid(),
    public.current_user_museum_id()
  );
$$;

create or replace function public.is_admin_or_executive_profile()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.status = 'active'
        and p.museum_id = public.current_user_museum_id()
        and (
          p.role in ('administrador', 'ejecutivo')
          or exists (
            select 1
            from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            where ur.user_id = p.id
              and ur.museum_id = p.museum_id
              and r.code in ('administrador', 'ejecutivo')
              and (ur.valid_until is null or ur.valid_until > now())
          )
        )
    );
$$;

create or replace function public.profile_is_admin_or_executive(
  p_profile_id uuid,
  p_museum_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and p.museum_id = p_museum_id
      and p.status = 'active'
      and (
        p.role in ('administrador', 'ejecutivo')
        or exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = p.id
            and ur.museum_id = p_museum_id
            and r.code in ('administrador', 'ejecutivo')
            and (ur.valid_until is null or ur.valid_until > now())
        )
      )
  );
$$;

create or replace function public.can_publish_institutional_announcement()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_museum_id() is not null
    and not public.linked_employee_blocks_announcements()
    and (
      public.has_permission('announcements.publish')
      or public.is_admin_or_executive_profile()
    );
$$;

create or replace function public.can_read_institutional_announcements()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_museum_id() is not null
    and not public.linked_employee_blocks_announcements()
    and (
      public.has_permission('announcements.read')
      or public.has_permission('announcements.publish')
      or public.has_permission('notifications.read.self')
      or public.is_admin_or_executive_profile()
    );
$$;

create or replace function public.eligible_institutional_announcement_recipients(p_museum_id uuid)
returns table (recipient_user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  -- Non-active linked employees are excluded BEFORE any role-based eligibility.
  select distinct p.id
  from public.profiles p
  where p.museum_id = p_museum_id
    and p.status = 'active'
    and not public.profile_has_nonactive_linked_employee(p.id, p_museum_id)
    and (
      public.profile_has_active_auth_linked_employee(p.id, p_museum_id)
      or public.profile_is_admin_or_executive(p.id, p_museum_id)
    );
$$;

-- Defense-in-depth RLS (tables have no SELECT grant for authenticated; RPCs are the path).
drop policy if exists institutional_announcements_select on public.institutional_announcements;
create policy institutional_announcements_select
on public.institutional_announcements
for select
to authenticated
using (
  museum_id = public.current_user_museum_id()
  and not public.linked_employee_blocks_announcements()
  and (
    public.can_publish_institutional_announcement()
    or exists (
      select 1
      from public.institutional_announcement_recipients r
      where r.announcement_id = institutional_announcements.id
        and r.museum_id = institutional_announcements.museum_id
        and r.recipient_user_id = auth.uid()
    )
  )
);

drop policy if exists institutional_announcement_recipients_select on public.institutional_announcement_recipients;
create policy institutional_announcement_recipients_select
on public.institutional_announcement_recipients
for select
to authenticated
using (
  museum_id = public.current_user_museum_id()
  and not public.linked_employee_blocks_announcements()
  and recipient_user_id = auth.uid()
);

-- No direct INSERT/UPDATE/DELETE policies for authenticated (RPC-only mutations).

create or replace function public.write_institutional_announcement_audit(
  p_museum_id uuid,
  p_announcement_id uuid,
  p_action text,
  p_old jsonb,
  p_new jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if p_museum_id is null or p_museum_id <> public.current_user_museum_id() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_action not in ('publish', 'archive', 'read') then
    raise exception 'INVALID_AUDIT_ACTION' using errcode = '22000';
  end if;

  insert into public.audit_logs(museum_id, actor_user_id, action, table_name, record_id, old_value, new_value)
  values (p_museum_id, auth.uid(), upper(p_action), 'institutional_announcements', p_announcement_id, p_old, p_new);
end;
$$;

create or replace function public.publish_institutional_announcement(
  p_title text,
  p_body text
) returns public.institutional_announcements
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid uuid := public.current_user_museum_id();
  actor uuid := auth.uid();
  saved public.institutional_announcements;
  recipient_count integer := 0;
  title_clean text := btrim(coalesce(p_title, ''));
  body_clean text := btrim(coalesce(p_body, ''));
begin
  if actor is null or mid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if not public.can_publish_institutional_announcement() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if title_clean = '' or body_clean = '' then
    raise exception 'INVALID_ANNOUNCEMENT' using errcode = '22023';
  end if;

  insert into public.institutional_announcements (
    museum_id, title, body, published_by, published_at, status
  ) values (
    mid, title_clean, body_clean, actor, now(), 'published'
  )
  returning * into saved;

  insert into public.institutional_announcement_recipients (
    announcement_id, museum_id, recipient_user_id, notified_at
  )
  select saved.id, mid, r.recipient_user_id, now()
  from public.eligible_institutional_announcement_recipients(mid) r;

  get diagnostics recipient_count = row_count;
  if recipient_count < 1 then
    raise exception 'NO_ELIGIBLE_RECIPIENTS' using errcode = 'P0001';
  end if;

  insert into public.employee_notifications (
    museum_id, recipient_user_id, title, message, category, related_announcement_id, created_at
  )
  select
    mid,
    r.recipient_user_id,
    saved.title,
    left(saved.body, 280),
    'institutional_announcement',
    saved.id,
    now()
  from public.institutional_announcement_recipients r
  where r.announcement_id = saved.id
    and r.museum_id = mid;

  perform public.write_institutional_announcement_audit(
    mid,
    saved.id,
    'publish',
    null,
    jsonb_build_object(
      'id', saved.id,
      'title', saved.title,
      'body', saved.body,
      'status', saved.status,
      'published_by', saved.published_by,
      'published_at', saved.published_at,
      'recipient_count', recipient_count
    )
  );

  return saved;
end;
$$;

create or replace function public.list_institutional_announcements(
  p_include_archived boolean default false
)
returns table (
  id uuid,
  museum_id uuid,
  title text,
  body text,
  published_by uuid,
  author_name text,
  published_at timestamptz,
  status text,
  read_at timestamptz,
  can_archive boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mid uuid := public.current_user_museum_id();
  publisher boolean := public.can_publish_institutional_announcement();
begin
  if auth.uid() is null or mid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if not public.can_read_institutional_announcements() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.museum_id,
    a.title,
    a.body,
    a.published_by,
    coalesce(nullif(btrim(p.full_name), ''), p.email, 'Autor institucional') as author_name,
    a.published_at,
    a.status,
    r.read_at,
    publisher as can_archive
  from public.institutional_announcements a
  left join public.profiles p on p.id = a.published_by
  left join public.institutional_announcement_recipients r
    on r.announcement_id = a.id
   and r.recipient_user_id = auth.uid()
   and r.museum_id = a.museum_id
  where a.museum_id = mid
    and (
      publisher
      or r.recipient_user_id is not null
    )
    and (p_include_archived or a.status = 'published' or publisher)
  order by a.published_at desc, a.created_at desc;
end;
$$;

create or replace function public.mark_institutional_announcement_read(
  p_announcement_id uuid
) returns public.institutional_announcement_recipients
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid uuid := public.current_user_museum_id();
  actor uuid := auth.uid();
  recipient public.institutional_announcement_recipients;
begin
  if actor is null or mid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if not public.can_read_institutional_announcements() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.institutional_announcement_recipients r
  set read_at = coalesce(r.read_at, now())
  where r.announcement_id = p_announcement_id
    and r.museum_id = mid
    and r.recipient_user_id = actor
  returning * into recipient;

  if recipient.announcement_id is null then
    raise exception 'NOT_A_RECIPIENT' using errcode = '42501';
  end if;

  update public.employee_notifications n
  set read_at = coalesce(n.read_at, now())
  where n.museum_id = mid
    and n.recipient_user_id = actor
    and n.related_announcement_id = p_announcement_id;

  perform public.write_institutional_announcement_audit(
    mid,
    p_announcement_id,
    'read',
    null,
    jsonb_build_object('read_at', recipient.read_at, 'recipient_user_id', actor)
  );

  return recipient;
end;
$$;

create or replace function public.archive_institutional_announcement(
  p_announcement_id uuid
) returns public.institutional_announcements
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid uuid := public.current_user_museum_id();
  before_row public.institutional_announcements;
  saved public.institutional_announcements;
begin
  if auth.uid() is null or mid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if not public.can_publish_institutional_announcement() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into before_row
  from public.institutional_announcements a
  where a.id = p_announcement_id
    and a.museum_id = mid
  for update;

  if before_row.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Content remains immutable; only status may move to archived.
  update public.institutional_announcements a
  set status = 'archived',
      updated_at = now()
  where a.id = before_row.id
    and a.museum_id = mid
  returning * into saved;

  perform public.write_institutional_announcement_audit(
    mid,
    saved.id,
    'archive',
    jsonb_build_object('status', before_row.status),
    jsonb_build_object('status', saved.status)
  );

  return saved;
end;
$$;

-- Prevent silent content edits and hard deletes outside SECURITY DEFINER RPCs.
create or replace function public.protect_institutional_announcement_mutations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ANNOUNCEMENT_DELETE_FORBIDDEN' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.museum_id is distinct from old.museum_id
      or new.title is distinct from old.title
      or new.body is distinct from old.body
      or new.published_by is distinct from old.published_by
      or new.published_at is distinct from old.published_at
    then
      if current_setting('role', true) is distinct from 'service_role'
         and pg_catalog.session_user not in ('postgres', 'supabase_admin') then
        if new.status is distinct from old.status
          and new.title is not distinct from old.title
          and new.body is not distinct from old.body
          and new.published_by is not distinct from old.published_by
          and new.published_at is not distinct from old.published_at
          and new.museum_id is not distinct from old.museum_id
        then
          return new;
        end if;
        raise exception 'ANNOUNCEMENT_CONTENT_IMMUTABLE' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists institutional_announcements_protect on public.institutional_announcements;
create trigger institutional_announcements_protect
before update or delete on public.institutional_announcements
for each row execute function public.protect_institutional_announcement_mutations();

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'profile_has_nonactive_linked_employee(uuid,uuid)',
    'profile_has_active_auth_linked_employee(uuid,uuid)',
    'linked_employee_blocks_announcements()',
    'is_admin_or_executive_profile()',
    'profile_is_admin_or_executive(uuid,uuid)',
    'can_publish_institutional_announcement()',
    'can_read_institutional_announcements()',
    'eligible_institutional_announcement_recipients(uuid)',
    'write_institutional_announcement_audit(uuid,uuid,text,jsonb,jsonb)',
    'protect_institutional_announcement_mutations()'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
  end loop;
end $$;

grant execute on function public.publish_institutional_announcement(text, text) to authenticated;
grant execute on function public.list_institutional_announcements(boolean) to authenticated;
grant execute on function public.mark_institutional_announcement_read(uuid) to authenticated;
grant execute on function public.archive_institutional_announcement(uuid) to authenticated;
