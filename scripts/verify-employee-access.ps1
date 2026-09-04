$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Require-Text([string]$Path, [string]$Pattern) {
  $content = Get-Content (Join-Path $root $Path) -Raw
  if ($content -notmatch $Pattern) { throw "Falta patrón requerido en ${Path}: ${Pattern}" }
}

Require-Text 'perfil-empleado.html' 'ACCESO AL SISTEMA|Acceso al sistema'
Require-Text 'perfil-empleado.html' 'data-access-invite'
Require-Text 'perfil-empleado.html' 'data-access-recovery'
Require-Text 'perfil-empleado.html' 'data-access-deactivate'
Require-Text 'perfil-empleado.html' 'data-access-reactivate'
Require-Text 'js/app.js' 'hasPermission\("users\.invite"\)'
Require-Text 'js/app.js' 'hasPermission\("users\.deactivate"\)'
Require-Text 'js/app.js' 'window\.confirm'
Require-Text 'supabase/functions/_shared/employee-access.ts' 'https://mmdpr\.org/login'
Require-Text 'supabase/functions/invite-employee/index.ts' 'USER_INVITATION_RESENT'
Require-Text 'supabase/functions/employee-access/index.ts' 'USER_PASSWORD_RECOVERY_SENT'
Require-Text 'supabase/functions/employee-access/index.ts' 'USER_ACCESS_REACTIVATED'
Require-Text 'supabase/functions/invite-employee/index.ts' '\.from\("profiles"\)\s*\.upsert\('
Require-Text 'supabase/functions/invite-employee/index.ts' 'id:\s*invited\.user\.id'
Require-Text 'supabase/functions/invite-employee/index.ts' 'PROFILE_PROVISION_FAILED'

$inviteSource = Get-Content (Join-Path $root 'supabase/functions/invite-employee/index.ts') -Raw
if ($inviteSource -match '\.from\("profiles"\)\s*\.update\(') {
  throw 'Regression: invite-employee vuelve a depender de un perfil preexistente.'
}
Require-Text 'supabase/functions/deactivate-user-access/index.ts' 'USER_ACCESS_DEACTIVATED'

$browserCode = (Get-Content (Join-Path $root 'js/app.js') -Raw) + (Get-Content (Join-Path $root 'js/services/supabase.js') -Raw)
if ($browserCode -match 'service_role|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY') {
  throw 'El navegador contiene una referencia prohibida a credenciales administrativas.'
}

$accessFunctions = Get-Content (Join-Path $root 'supabase/functions/invite-employee/index.ts'), (Join-Path $root 'supabase/functions/deactivate-user-access/index.ts'), (Join-Path $root 'supabase/functions/employee-access/index.ts') -Raw
if ($accessFunctions -match 'localhost|github\.io') { throw 'Una función de acceso contiene un redirect no autorizado.' }
if ((Get-Content (Join-Path $root 'supabase/functions/deactivate-user-access/index.ts') -Raw) -match 'from\("employees"\)\.update') {
  throw 'La desactivación de Auth no puede cambiar el estado laboral del empleado.'
}

Write-Output 'Employee access verification passed.'
