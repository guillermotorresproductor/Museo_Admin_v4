-- Access control policy: reports/memberships permissions + append-only security audit RPC.
-- Does not alter historical migrations. Aligns executive sensitive areas with explicit permissions.

insert into public.permissions (code, description, sensitivity)
values
  ('reports.read', 'Leer el módulo de Reportes', 'critical'),
  ('memberships.manage', 'Administrar membresías y socios', 'sensitive')
on conflict (code) do nothing;

-- Reportes: nivel administrador autorizado (no se concede a ejecutivo por rol).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'reports.read'
where r.code = 'administrador'
on conflict do nothing;

-- Membresías: módulos ejecutivos (mismo patrón que rentals.manage).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'memberships.manage'
where r.code in ('ejecutivo', 'administrador')
on conflict do nothing;

-- Dirección Ejecutiva: no conceder automáticamente a ejecutivo por rol.
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'ejecutivo'
  and p.code = 'executive.case.read';

-- Mantener executive.case.read en administrador (permiso explícito de rol autorizado).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'executive.case.read'
where r.code = 'administrador'
on conflict do nothing;

create or replace function public.record_security_audit_event(
  p_action text,
  p_module text,
  p_result text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_museum_id uuid;
  v_id uuid;
  v_safe_details jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  v_museum_id := public.current_user_museum_id();
  if v_museum_id is null then
    raise exception 'No active museum membership' using errcode = '42501';
  end if;

  v_safe_details := coalesce(p_details, '{}'::jsonb)
    - 'password'
    - 'passwordConfirmation'
    - 'token'
    - 'access_token'
    - 'refresh_token';

  insert into public.audit_logs (
    museum_id,
    actor_user_id,
    action,
    table_name,
    record_id,
    new_value
  )
  values (
    v_museum_id,
    auth.uid(),
    coalesce(nullif(trim(p_action), ''), 'SECURITY_EVENT'),
    'security_access',
    null,
    jsonb_build_object(
      'module', coalesce(nullif(trim(p_module), ''), 'unknown'),
      'result', coalesce(nullif(trim(p_result), ''), 'unknown'),
      'at', now()
    ) || v_safe_details
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_security_audit_event(text, text, text, jsonb) from public;
grant execute on function public.record_security_audit_event(text, text, text, jsonb) to authenticated;

-- Si Membresías ya está instalada, alinear RLS con permiso real (no solo profiles.role).
do $$
begin
  if to_regprocedure('public.can_manage_memberships(uuid)') is not null then
    execute $fn$
      create or replace function public.can_manage_memberships(target_museum_id uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select
          auth.uid() is not null
          and public.current_user_museum_id() = target_museum_id
          and public.has_permission('memberships.manage')
      $body$;
    $fn$;
  end if;
end $$;
