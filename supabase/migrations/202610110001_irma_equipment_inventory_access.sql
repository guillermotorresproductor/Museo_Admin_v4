-- Access exception for Irma Rodriguez: equipment inventory only.
-- Preserve her existing Marketing/Content module profile, job, pay and attendance.
-- No changes to museographic collections or to shared module profiles.
--
-- Inventory in the current application requires BOTH:
--   modules.inventory.read  -> entry/read and the restrictive RLS boundary
--   inventory.manage        -> create equipment (also permits edit/archive/photo)
-- The second permission is a pre-existing coarse-grained inventory permission.
--
-- This migration does not change any role, employee, profile or payroll row.
-- On environments without the production museum, it does nothing.
-- In the production museum it fails closed unless exactly one eligible linked
-- employee is found. Re-running the migration is safe.

begin;

do $irma_inventory$
declare
  target_museum constant uuid := 'a1f597f7-44a2-44b2-9214-93364c2a12ff';
  target_user uuid;
  candidate_count integer;
  permission_count integer;
  grant_count integer;
begin
  if not exists (select 1 from public.museums where id = target_museum) then
    raise notice 'IRMA_INVENTORY_SKIPPED: production museum not present';
    return;
  end if;

  -- Match the employee and her current, active login to avoid an email/name
  -- collision and to ensure Marketing remains her module profile.
  select count(*), min(e.profile_id)
    into candidate_count, target_user
  from public.employees e
  join public.profiles pr
    on pr.id = e.profile_id
   and pr.museum_id = e.museum_id
   and lower(btrim(pr.email)) = lower(btrim(e.email))
  where e.museum_id = target_museum
    and lower(btrim(e.first_name)) = 'irma'
    and lower(btrim(e.last_name)) in ('rodríguez', 'rodriguez')
    and e.access_profile = 'contenido_marketing'
    and e.status in ('active', 'activo')
    and pr.status in ('active', 'activo');

  if candidate_count <> 1 or target_user is null then
    raise exception 'IRMA_INVENTORY_IDENTITY_UNVERIFIED (matching active Marketing employees: %)', candidate_count
      using errcode = '42501';
  end if;

  select count(*) into permission_count
  from public.permissions
  where code in ('modules.inventory.read', 'inventory.manage');

  if permission_count <> 2 then
    raise exception 'IRMA_INVENTORY_PERMISSIONS_MISSING'
      using errcode = '55000';
  end if;

  -- Never silently override an explicit denial.
  if exists (
    select 1
    from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.museum_id = target_museum
      and up.user_id = target_user
      and p.code in ('modules.inventory.read', 'inventory.manage')
      and up.effect = 'deny'
      and (up.valid_until is null or up.valid_until > now())
  ) then
    raise exception 'IRMA_INVENTORY_EXPLICIT_DENY_PRESENT'
      using errcode = '42501';
  end if;

  insert into public.user_permissions (museum_id, user_id, permission_id, effect)
  select target_museum, target_user, p.id, 'allow'
  from public.permissions p
  where p.code in ('modules.inventory.read', 'inventory.manage')
  on conflict (museum_id, user_id, permission_id) do nothing;

  select count(*) into grant_count
  from public.user_permissions up
  join public.permissions p on p.id = up.permission_id
  where up.museum_id = target_museum
    and up.user_id = target_user
    and p.code in ('modules.inventory.read', 'inventory.manage')
    and up.effect = 'allow'
    and (up.valid_until is null or up.valid_until > now());

  if grant_count <> 2 then
    raise exception 'IRMA_INVENTORY_GRANT_INCOMPLETE'
      using errcode = '42501';
  end if;

  raise notice 'IRMA_EQUIPMENT_INVENTORY_ACCESS_OK';
end
$irma_inventory$;

commit;
