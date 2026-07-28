insert into public.permissions(code,description,sensitivity) values
 ('compensation.read','Leer compensacion de empleados','critical'),
 ('compensation.manage','Administrar compensacion de empleados','critical'),
 ('emergency_contact.read','Leer contactos de emergencia','critical'),
 ('emergency_contact.manage','Administrar contactos de emergencia','critical')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('recursos_humanos','administrador')
  and p.code in ('compensation.read','compensation.manage','emergency_contact.read','emergency_contact.manage')
on conflict do nothing;

create table public.employee_compensation (
  employee_id uuid primary key references public.employees(id) on delete restrict,
  museum_id uuid not null references public.museums(id),
  compensation_type text not null default 'unconfigured' check(compensation_type in ('unconfigured','hourly','salary','commission','mixed','stipend','other')),
  hourly_rate numeric(12,2) check(hourly_rate is null or hourly_rate>=0),
  salary_amount numeric(12,2) check(salary_amount is null or salary_amount>=0),
  salary_period text check(salary_period is null or salary_period in ('weekly','biweekly','semimonthly','monthly','annual')),
  pay_frequency text check(pay_frequency is null or pay_frequency in ('weekly','biweekly','semimonthly','monthly')),
  standard_hours_week numeric(5,2) check(standard_hours_week is null or standard_hours_week between 0 and 168),
  overtime_eligible boolean not null default true,
  bonus_type text check(bonus_type is null or bonus_type in ('fixed','percentage','discretionary','statutory','none')),
  bonus_amount numeric(12,2) check(bonus_amount is null or bonus_amount>=0),
  bonus_percent numeric(7,4) check(bonus_percent is null or bonus_percent between 0 and 100),
  other_description text,
  effective_from date,
  currency text not null default 'USD' check(currency='USD'),
  intuit_employee_id text,
  sync_status text not null default 'not_configured' check(sync_status in ('not_configured','pending','synced','error')),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.employee_emergency_contacts (
  employee_id uuid primary key references public.employees(id) on delete restrict,
  museum_id uuid not null references public.museums(id),
  full_name text not null default '', relationship text, primary_phone text,
  alternate_phone text, email text, notes text,
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.employee_compensation enable row level security;
alter table public.employee_emergency_contacts enable row level security;
create policy compensation_authorized_read on public.employee_compensation for select to authenticated
using(museum_id=public.current_user_museum_id() and public.has_permission('compensation.read'));
create policy emergency_authorized_read on public.employee_emergency_contacts for select to authenticated
using(museum_id=public.current_user_museum_id() and public.has_permission('emergency_contact.read'));

create or replace function public.save_employee_sensitive_details(target_employee_id uuid, compensation jsonb, emergency_contact jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_museum uuid; actor uuid:=auth.uid(); compensation_id uuid; emergency_id uuid;
begin
 if actor is null or not public.has_permission('compensation.manage') or not public.has_permission('emergency_contact.manage') then raise exception 'permission_denied'; end if;
 select museum_id into target_museum from public.employees where id=target_employee_id and museum_id=public.current_user_museum_id();
 if target_museum is null then raise exception 'employee_not_found'; end if;
 insert into public.employee_compensation(employee_id,museum_id,compensation_type,hourly_rate,salary_amount,salary_period,pay_frequency,standard_hours_week,overtime_eligible,bonus_type,bonus_amount,bonus_percent,other_description,effective_from,updated_by,updated_at)
 values(target_employee_id,target_museum,coalesce(nullif(compensation->>'compensation_type',''),'unconfigured'),nullif(compensation->>'hourly_rate','')::numeric,nullif(compensation->>'salary_amount','')::numeric,nullif(compensation->>'salary_period',''),nullif(compensation->>'pay_frequency',''),nullif(compensation->>'standard_hours_week','')::numeric,coalesce((compensation->>'overtime_eligible')::boolean,true),nullif(compensation->>'bonus_type',''),nullif(compensation->>'bonus_amount','')::numeric,nullif(compensation->>'bonus_percent','')::numeric,nullif(compensation->>'other_description',''),nullif(compensation->>'effective_from','')::date,actor,now())
 on conflict(employee_id) do update set compensation_type=excluded.compensation_type,hourly_rate=excluded.hourly_rate,salary_amount=excluded.salary_amount,salary_period=excluded.salary_period,pay_frequency=excluded.pay_frequency,standard_hours_week=excluded.standard_hours_week,overtime_eligible=excluded.overtime_eligible,bonus_type=excluded.bonus_type,bonus_amount=excluded.bonus_amount,bonus_percent=excluded.bonus_percent,other_description=excluded.other_description,effective_from=excluded.effective_from,updated_by=actor,updated_at=now()
 returning employee_id into compensation_id;
 insert into public.employee_emergency_contacts(employee_id,museum_id,full_name,relationship,primary_phone,alternate_phone,email,notes,updated_by,updated_at)
 values(target_employee_id,target_museum,coalesce(emergency_contact->>'full_name',''),nullif(emergency_contact->>'relationship',''),nullif(emergency_contact->>'primary_phone',''),nullif(emergency_contact->>'alternate_phone',''),nullif(emergency_contact->>'email',''),nullif(emergency_contact->>'notes',''),actor,now())
 on conflict(employee_id) do update set full_name=excluded.full_name,relationship=excluded.relationship,primary_phone=excluded.primary_phone,alternate_phone=excluded.alternate_phone,email=excluded.email,notes=excluded.notes,updated_by=actor,updated_at=now()
 returning employee_id into emergency_id;
 insert into public.audit_logs(museum_id,actor_user_id,action,table_name,record_id,old_value,new_value)
 values(target_museum,actor,'UPDATE_SENSITIVE_EMPLOYEE_DETAILS','employee_sensitive_details',target_employee_id,null,jsonb_build_object('compensation_updated',true,'emergency_contact_updated',true));
 return jsonb_build_object('employee_id',target_employee_id,'saved',true);
end $$;

revoke all on public.employee_compensation,public.employee_emergency_contacts from anon;
revoke insert,update,delete on public.employee_compensation,public.employee_emergency_contacts from authenticated;
grant select on public.employee_compensation,public.employee_emergency_contacts to authenticated;
revoke all on function public.save_employee_sensitive_details(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_employee_sensitive_details(uuid,jsonb,jsonb) to authenticated;
