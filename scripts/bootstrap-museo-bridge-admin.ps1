#Requires -Version 5.1
<#
  Cuenta de prueba puente Museo staging: mismo correo en Auth + rol administrador (rentals.manage).
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory = $true)]
  [string]$Email,

  [string]$MuseumId = '00000000-0000-0000-0000-000000000001',
  [string]$RoleCode = 'administrador',
  [string]$ExpectedProjectRef = 'lonpdmxdvbxuagqxztig'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$linkedProjectFile = Join-Path $repositoryRoot 'supabase\.temp\project-ref'
if (-not (Test-Path -LiteralPath $linkedProjectFile)) {
  throw 'Link Museo staging: supabase link --project-ref lonpdmxdvbxuagqxztig'
}
if ((Get-Content -Raw -LiteralPath $linkedProjectFile).Trim() -ne $ExpectedProjectRef) {
  throw "Linked project must be $ExpectedProjectRef (Museo staging)."
}

$escapedEmail = $Email.Replace("'", "''")
$sql = @"
begin;
do `$museo`$
declare
  target_user_id uuid;
  target_museum_id uuid := '$MuseumId'::uuid;
  admin_role_id uuid;
begin
  select u.id into target_user_id from auth.users u where lower(u.email) = lower(btrim('$escapedEmail'));
  if target_user_id is null then
    raise exception 'Auth user not found for %. Sign up on Museo staging first.', '$escapedEmail';
  end if;

  update public.profiles p
  set status = 'active', museum_id = target_museum_id, email = '$escapedEmail', role = '$RoleCode'
  where p.id = target_user_id;

  select r.id into admin_role_id from public.roles r where r.code = '$RoleCode' and r.active = true;
  if admin_role_id is null then raise exception 'Role % missing.', '$RoleCode'; end if;

  delete from public.user_roles ur
  where ur.user_id = target_user_id and ur.museum_id = target_museum_id
    and ur.role_id <> admin_role_id;

  insert into public.user_roles (museum_id, user_id, role_id)
  values (target_museum_id, target_user_id, admin_role_id)
  on conflict do nothing;
end;
`$museo`$;
commit;

select u.id, u.email, p.status, r.code as role_code
from auth.users u
join public.profiles p on p.id = u.id
left join public.user_roles ur on ur.user_id = u.id and ur.museum_id = '$MuseumId'::uuid
left join public.roles r on r.id = ur.role_id
where lower(u.email) = lower(btrim('$escapedEmail'));
"@

if (-not $PSCmdlet.ShouldProcess($Email, "Grant Museo staging administrador")) { return }
$supabase = Join-Path $env:APPDATA 'npm\supabase.cmd'
$tmp = Join-Path $env:TEMP "museo-bridge-$([Guid]::NewGuid().ToString('N')).sql"
try {
  [System.IO.File]::WriteAllText($tmp, $sql, [System.Text.UTF8Encoding]::new($false))
  & $supabase db query --linked --file $tmp
  if ($LASTEXITCODE -ne 0) { throw "Failed exit $LASTEXITCODE" }
}
finally {
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
}
