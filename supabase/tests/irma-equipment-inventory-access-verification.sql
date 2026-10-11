-- Read-only verification after the Irma equipment-inventory grant is deployed.
-- Never modifies any record. Run in the authorized Supabase SQL editor.
with target as (
  select e.id, e.museum_id, e.profile_id, e.first_name, e.last_name,
         e.position, e.access_profile, e.access_level, e.status
  from public.employees e
  where e.museum_id = 'a1f597f7-44a2-44b2-9214-93364c2a12ff'::uuid
    and lower(btrim(e.first_name)) = 'irma'
    and lower(btrim(e.last_name)) in ('rodríguez','rodriguez')
), grants as (
  select t.id,
    count(*) filter (where p.code in ('modules.inventory.read','inventory.manage')
       and up.effect='allow' and (up.valid_until is null or up.valid_until > now())) as active_inventory_grants,
    array_agg(p.code order by p.code) filter (where p.code in ('modules.inventory.read','inventory.manage')
       and up.effect='allow' and (up.valid_until is null or up.valid_until > now())) as granted_codes
  from target t
  left join public.user_permissions up on up.user_id=t.profile_id and up.museum_id=t.museum_id
  left join public.permissions p on p.id=up.permission_id
  group by t.id
)
select t.first_name, t.last_name, t.position, t.access_profile,
       t.access_level, t.status, coalesce(g.active_inventory_grants,0) as active_inventory_grants,
       g.granted_codes,
       (t.access_profile='contenido_marketing' and coalesce(g.active_inventory_grants,0)=2) as expected_configuration
from target t
join grants g on g.id=t.id;
