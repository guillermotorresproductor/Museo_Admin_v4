param([switch]$UI,[switch]$Administrative)
$ErrorActionPreference='Stop'
$keys=supabase projects api-keys --project-ref lonpdmxdvbxuagqxztig --output json | ConvertFrom-Json
if($LASTEXITCODE -ne 0){throw 'Staging credentials unavailable'}
try {
 $env:SUPABASE_TEST_URL='https://lonpdmxdvbxuagqxztig.supabase.co'
 $env:SUPABASE_TEST_ANON_KEY=($keys|Where-Object name -eq 'anon').api_key
 $env:SUPABASE_TEST_SERVICE_KEY=($keys|Where-Object name -eq 'service_role').api_key
 if($Administrative){node "$PSScriptRoot/../supabase/tests/collections-administrative-staging.mjs"}
 elseif($UI){node "$PSScriptRoot/../supabase/tests/collections-staging.mjs" ui}else{node "$PSScriptRoot/../supabase/tests/collections-staging.mjs"}
 if($LASTEXITCODE -ne 0){throw 'Collections Staging validation failed'}
} finally {
 Remove-Item Env:SUPABASE_TEST_URL,Env:SUPABASE_TEST_ANON_KEY,Env:SUPABASE_TEST_SERVICE_KEY -ErrorAction SilentlyContinue
 $keys=$null
}
