$ErrorActionPreference = 'Stop'
$projectRef = 'lonpdmxdvbxuagqxztig'
$keys = supabase projects api-keys --project-ref $projectRef --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Could not load Staging credentials' }
try {
  $env:SUPABASE_TEST_URL = "https://$projectRef.supabase.co"
  $env:SUPABASE_TEST_ANON_KEY = ($keys | Where-Object name -eq 'anon' | Select-Object -First 1).api_key
  $env:SUPABASE_TEST_SERVICE_KEY = ($keys | Where-Object name -eq 'service_role' | Select-Object -First 1).api_key
  node "$PSScriptRoot/../supabase/tests/employee-photo-level-staging.mjs"
  if ($LASTEXITCODE -ne 0) { throw 'Staging tests failed' }
} finally {
  Remove-Item Env:SUPABASE_TEST_URL,Env:SUPABASE_TEST_ANON_KEY,Env:SUPABASE_TEST_SERVICE_KEY -ErrorAction SilentlyContinue
  $keys = $null
}
