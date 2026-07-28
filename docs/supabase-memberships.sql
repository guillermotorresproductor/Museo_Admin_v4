-- Módulo de Membresías - Museo Admin v4
-- Ejecutar en Supabase SQL Editor una sola vez.

create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  code text not null,
  name text not null,
  audience text,
  price numeric(12,2) not null default 0 check (price >= 0),
  sibling_price numeric(12,2) check (sibling_price is null or sibling_price >= 0),
  billing_period text not null default 'annual'
    check (billing_period in ('annual', 'one_time', 'annual_from')),
  benefits jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (museum_id, code)
);

create table if not exists public.museum_members (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  member_number text not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  organization_name text,
  plan_code text not null,
  status text not null default 'Activo'
    check (status in ('Activo', 'Pendiente', 'Vencido', 'Inactivo')),
  start_date date not null,
  expiration_date date,
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  interests text[] not null default '{}',
  notes text,
  email_consent boolean not null default false,
  sms_consent boolean not null default false,
  analytics_consent boolean not null default false,
  consent_updated_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (museum_id, member_number)
);

create table if not exists public.membership_attendance (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  member_id uuid not null references public.museum_members(id) on delete restrict,
  event_name text not null,
  event_category text,
  attended_at timestamptz not null,
  recorded_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.membership_renewals (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  member_id uuid not null references public.museum_members(id) on delete restrict,
  previous_expiration_date date,
  new_start_date date not null,
  new_expiration_date date,
  plan_code text not null,
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  payment_reference text,
  recorded_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.membership_communications (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  member_id uuid references public.museum_members(id) on delete restrict,
  channel text not null check (channel in ('email', 'sms', 'phone', 'postal')),
  subject text not null,
  campaign_type text,
  sent_at timestamptz not null default now(),
  sent_by uuid,
  delivery_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.membership_audit_logs (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null,
  member_id uuid references public.museum_members(id) on delete restrict,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  performed_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists museum_members_museum_status_idx
  on public.museum_members (museum_id, status);
create index if not exists museum_members_museum_expiration_idx
  on public.museum_members (museum_id, expiration_date);
create index if not exists membership_attendance_member_date_idx
  on public.membership_attendance (member_id, attended_at desc);

alter table public.membership_plans enable row level security;
alter table public.museum_members enable row level security;
alter table public.membership_attendance enable row level security;
alter table public.membership_renewals enable row level security;
alter table public.membership_communications enable row level security;
alter table public.membership_audit_logs enable row level security;

create or replace function public.can_manage_memberships(target_museum_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.museum_id = target_museum_id
      and profiles.role in ('administrador', 'ejecutivo')
  );
$$;

revoke all on function public.can_manage_memberships(uuid) from public;
grant execute on function public.can_manage_memberships(uuid) to authenticated;

drop policy if exists "membership plans restricted read" on public.membership_plans;
drop policy if exists "membership plans admin write" on public.membership_plans;
create policy "membership plans restricted read" on public.membership_plans
  for select to authenticated using (public.can_manage_memberships(museum_id));
create policy "membership plans admin write" on public.membership_plans
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.museum_id = membership_plans.museum_id
        and profiles.role = 'administrador'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.museum_id = membership_plans.museum_id
        and profiles.role = 'administrador'
    )
  );

drop policy if exists "members restricted access" on public.museum_members;
create policy "members restricted access" on public.museum_members
  for all to authenticated
  using (public.can_manage_memberships(museum_id))
  with check (public.can_manage_memberships(museum_id));

drop policy if exists "attendance restricted access" on public.membership_attendance;
create policy "attendance restricted access" on public.membership_attendance
  for all to authenticated
  using (public.can_manage_memberships(museum_id))
  with check (public.can_manage_memberships(museum_id));

drop policy if exists "renewals restricted access" on public.membership_renewals;
create policy "renewals restricted access" on public.membership_renewals
  for all to authenticated
  using (public.can_manage_memberships(museum_id))
  with check (public.can_manage_memberships(museum_id));

drop policy if exists "communications restricted access" on public.membership_communications;
create policy "communications restricted access" on public.membership_communications
  for all to authenticated
  using (public.can_manage_memberships(museum_id))
  with check (public.can_manage_memberships(museum_id));

drop policy if exists "membership audit restricted read" on public.membership_audit_logs;
drop policy if exists "membership audit restricted insert" on public.membership_audit_logs;
create policy "membership audit restricted read" on public.membership_audit_logs
  for select to authenticated using (public.can_manage_memberships(museum_id));
create policy "membership audit restricted insert" on public.membership_audit_logs
  for insert to authenticated with check (public.can_manage_memberships(museum_id));

comment on table public.museum_members is
  'Expedientes protegidos de miembros y socios del museo; no contiene empleados ni usuarios de acceso.';
comment on column public.museum_members.analytics_consent is
  'Consentimiento para analizar asistencia e intereses con fines institucionales.';
