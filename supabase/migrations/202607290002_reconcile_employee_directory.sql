-- Reconcile employee identity links with authenticated profiles.
-- Employment data (status, position, department, access_level) is NEVER auto-changed.
-- Completes partial or missing profile_id / auth_user_id links when the match is unambiguous.

do $$
declare
  conflict_count integer := 0;
  ambiguous_count integer := 0;
begin
  -- Recover missing display names only when Auth contains a valid human name.
  update public.profiles p
     set full_name = metadata.resolved_name,
         updated_at = now()
    from (
      select
        u.id,
        coalesce(
          nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
          nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
        ) as resolved_name
      from auth.users u
    ) metadata
   where p.id = metadata.id
     and metadata.resolved_name is not null
     and position('@' in metadata.resolved_name) = 0
     and (
       btrim(coalesce(p.full_name, '')) = ''
       or position('@' in p.full_name) > 0
       or p.full_name = 'Usuario Institucional'
     );

  -- Ambiguous candidate sets: more than one employee or profile for museum+email.
  select count(*) into ambiguous_count
  from (
    select e.museum_id, lower(btrim(e.email)) as email_key
    from public.employees e
    join public.profiles p
      on p.museum_id = e.museum_id
     and lower(btrim(p.email)) = lower(btrim(e.email))
    where nullif(btrim(e.email), '') is not null
      and nullif(btrim(p.email), '') is not null
      and (e.profile_id is null or e.auth_user_id is null)
    group by e.museum_id, lower(btrim(e.email))
    having count(distinct e.id) > 1 or count(distinct p.id) > 1
  ) ambiguous;

  if ambiguous_count > 0 then
    raise exception
      'EMPLOYEE_RECONCILE_AMBIGUOUS: % museum/email group(s) match more than one employee or profile. No employee rows were linked.',
      ambiguous_count;
  end if;

  -- Conflicting existing identity links must not be overwritten.
  select count(*) into conflict_count
  from public.employees e
  join public.profiles p
    on p.museum_id = e.museum_id
   and lower(btrim(p.email)) = lower(btrim(e.email))
  where nullif(btrim(e.email), '') is not null
    and nullif(btrim(p.email), '') is not null
    and (
      (e.profile_id is not null and e.profile_id <> p.id)
      or (e.auth_user_id is not null and e.auth_user_id <> p.id)
      or exists (
        select 1
        from public.employees other
        where other.id <> e.id
          and (
            other.auth_user_id = p.id
            or other.profile_id = p.id
          )
      )
    );

  if conflict_count > 0 then
    raise exception
      'EMPLOYEE_RECONCILE_CONFLICT: % employee/profile pair(s) have conflicting identity links. Existing links were preserved; no rows were modified for linking.',
      conflict_count;
  end if;

  -- Complete missing or partial identity links for unequivocal museum+email matches.
  -- Cases: both null; profile_id=p.id with auth_user_id null; auth_user_id=p.id with profile_id null.
  -- Does NOT touch status, position, department, access_level, or other employment fields.
  update public.employees e
     set profile_id = p.id,
         auth_user_id = p.id,
         updated_at = now()
    from public.profiles p
   where e.museum_id = p.museum_id
     and lower(btrim(e.email)) = lower(btrim(p.email))
     and nullif(btrim(e.email), '') is not null
     and nullif(btrim(p.email), '') is not null
     and (e.profile_id is null or e.profile_id = p.id)
     and (e.auth_user_id is null or e.auth_user_id = p.id)
     and (e.profile_id is null or e.auth_user_id is null)
     and not exists (
       select 1
       from public.employees other
       where other.id <> e.id
         and (
           other.auth_user_id = p.id
           or other.profile_id = p.id
         )
     );
end
$$;
