begin;

-- Independent lifetime: does not modify any auth.* configuration or credential.
create table public.employee_invitation_grants (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  museum_id uuid not null references public.museums(id),
  issued_by uuid not null references auth.users(id),
  request_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  auth_user_id uuid references auth.users(id),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  ready_at timestamptz,
  revoked_at timestamptz,
  claim_id uuid,
  claimed_at timestamptz,
  redeemed_at timestamptz,
  password_fingerprint text,
  accepted_at timestamptz,
  unique(employee_id, request_id),
  check (expires_at >= issued_at + interval '24 hours'),
  check (accepted_at is null or redeemed_at is not null)
);
alter table public.employee_invitation_grants enable row level security;
revoke all on public.employee_invitation_grants from public, anon, authenticated;
grant select, insert, update on public.employee_invitation_grants to service_role;
create index employee_invitation_grants_employee on public.employee_invitation_grants(employee_id,issued_at desc);

create function public.assert_employee_invitation_identity(p_employee uuid,p_museum uuid,p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.employees e join public.profiles p on p.id=e.profile_id
    join auth.users u on u.id=p.id
    where e.id=p_employee and e.museum_id=p_museum and p.museum_id=p_museum and u.id=p_user
    and lower(trim(e.email))=lower(trim(u.email)) and lower(trim(p.email))=lower(trim(u.email))
    and p.status in ('active','activo') and e.status in ('active','activo')
    and p.role in ('empleado','ejecutivo','administrador') and e.access_level=p.role
    and (u.banned_until is null or u.banned_until <= now())
    for share of e,p,u;
  if not found or (select count(*) from public.employees where profile_id=p_user)<>1 then
    raise exception 'INVITATION_LINK_INVALID';
  end if;
end;
$$;

create function public.activate_employee_invitation(p_employee uuid,p_user uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare g public.employee_invitation_grants%rowtype;
begin
  -- Serialize activations for one employee, keeping the newest issue authoritative.
  perform 1 from public.employees where id=p_employee for update;
  select * into g from public.employee_invitation_grants where employee_id=p_employee
    and revoked_at is null order by issued_at desc,id desc limit 1 for update;
  if not found then return null; end if;
  perform public.assert_employee_invitation_identity(g.employee_id,g.museum_id,p_user);
  if g.auth_user_id is not null and g.auth_user_id<>p_user then raise exception 'INVITATION_LINK_INVALID'; end if;
  if g.ready_at is null then
    update public.employee_invitation_grants set auth_user_id=p_user,ready_at=now(),expires_at=now()+interval '24 hours'
      where id=g.id;
    update public.employee_invitation_grants set revoked_at=now()
      where employee_id=p_employee and id<>g.id and revoked_at is null;
  end if;
  return g.id;
end;
$$;

create function public.claim_employee_invitation(p_hash text,p_claim uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.employee_invitation_grants%rowtype;
begin
  select * into g from public.employee_invitation_grants where token_hash=p_hash for update;
  if not found then return jsonb_build_object('code','invalid_link'); end if;
  if g.revoked_at is not null then return jsonb_build_object('code','invitation_replaced'); end if;
  if g.redeemed_at is not null then return jsonb_build_object('code','invitation_used'); end if;
  if g.expires_at<=now() then return jsonb_build_object('code','invitation_expired'); end if;
  if g.ready_at is null then return jsonb_build_object('code','invitation_preparing'); end if;
  -- A failed/uncertain exchange is fail-closed; no concurrent second minting.
  if g.claimed_at is not null then return jsonb_build_object('code','invitation_processing'); end if;
  perform public.assert_employee_invitation_identity(g.employee_id,g.museum_id,g.auth_user_id);
  update public.employee_invitation_grants set claim_id=p_claim,claimed_at=now() where id=g.id;
  return jsonb_build_object('code','claimed','id',g.id,'user_id',g.auth_user_id,'employee_id',g.employee_id,'museum_id',g.museum_id);
end;
$$;

create function public.finish_employee_invitation(p_id uuid,p_claim uuid)
returns void language plpgsql security definer set search_path='' as $$
declare g public.employee_invitation_grants%rowtype;
begin
  select * into g from public.employee_invitation_grants where id=p_id for update;
  if not found or g.claim_id is distinct from p_claim or g.redeemed_at is not null or g.revoked_at is not null then
    raise exception 'INVITATION_STATE_CHANGED';
  end if;
  perform public.assert_employee_invitation_identity(g.employee_id,g.museum_id,g.auth_user_id);
  update public.employee_invitation_grants set redeemed_at=now(),
    password_fingerprint=(select md5(coalesce(encrypted_password,'')) from auth.users where id=g.auth_user_id)
    where id=g.id;
end;
$$;

create function public.complete_employee_invitation(p_id uuid,p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare g public.employee_invitation_grants%rowtype;
begin
  select * into g from public.employee_invitation_grants where id=p_id for update;
  if not found or g.auth_user_id<>p_user or g.redeemed_at is null or g.revoked_at is not null then
    raise exception 'INVITATION_STATE_CHANGED';
  end if;
  perform public.assert_employee_invitation_identity(g.employee_id,g.museum_id,p_user);
  if not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null and coalesce(encrypted_password,'')<>''
    and md5(encrypted_password) is distinct from g.password_fingerprint) then
    raise exception 'INVITATION_PASSWORD_REQUIRED';
  end if;
  update public.employee_invitation_grants set accepted_at=coalesce(accepted_at,now()) where id=g.id;
end;
$$;

revoke all on function public.assert_employee_invitation_identity(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.activate_employee_invitation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.claim_employee_invitation(text,uuid) from public,anon,authenticated;
revoke all on function public.finish_employee_invitation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.complete_employee_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.assert_employee_invitation_identity(uuid,uuid,uuid) to service_role;
grant execute on function public.activate_employee_invitation(uuid,uuid) to service_role;
grant execute on function public.claim_employee_invitation(text,uuid) to service_role;
grant execute on function public.finish_employee_invitation(uuid,uuid) to service_role;
grant execute on function public.complete_employee_invitation(uuid,uuid) to service_role;
commit;
