param([switch]$Before, [switch]$UI)
$ErrorActionPreference = 'Stop'
$keys = supabase projects api-keys --project-ref lonpdmxdvbxuagqxztig --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Staging credentials unavailable' }
try {
  $env:SUPABASE_TEST_URL = 'https://lonpdmxdvbxuagqxztig.supabase.co'
  $env:SUPABASE_TEST_ANON_KEY = ($keys | Where-Object name -eq 'anon' | Select-Object -First 1).api_key
  $env:SUPABASE_TEST_SERVICE_KEY = ($keys | Where-Object name -eq 'service_role' | Select-Object -First 1).api_key
  if ($UI) { node "$PSScriptRoot/../supabase/tests/unlinked-employee-staging.mjs" ui }
  elseif ($Before) { node "$PSScriptRoot/../supabase/tests/unlinked-employee-staging.mjs" before }
  else { node "$PSScriptRoot/../supabase/tests/unlinked-employee-staging.mjs" }
  if ($LASTEXITCODE -ne 0) { throw 'Staging verification failed' }
} finally {
  Remove-Item Env:SUPABASE_TEST_URL,Env:SUPABASE_TEST_ANON_KEY,Env:SUPABASE_TEST_SERVICE_KEY -ErrorAction SilentlyContinue
  $keys = $null
}
