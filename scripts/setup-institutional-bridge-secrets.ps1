#Requires -Version 5.1
<#
  Configura secrets del Edge Function institutional-data-bridge en Museo staging (o prod).
  Lee service_role de Instituva desde CLI (supabase login) — no imprime claves.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$MuseoProjectRef = 'lonpdmxdvbxuagqxztig',
  [string]$InstituvaProjectRef = 'hjbwgxoboobxhrbxbuzb',
  [string]$InstituvaSupabaseUrl = 'https://hjbwgxoboobxhrbxbuzb.supabase.co',
  [string]$InstituvaOrganizationId = '4d505200-0000-4000-8000-000000000001'
)

function Get-ServiceRoleKeyFromCli {
  param([string]$Ref)
  $supabase = Join-Path $env:APPDATA 'npm\supabase.cmd'
  if (-not (Test-Path -LiteralPath $supabase)) {
    throw 'Supabase CLI not found. Install: npm i -g supabase'
  }
  $json = & $supabase projects api-keys --project-ref $Ref --reveal -o json 2>$null | Out-String
  $keys = $json | ConvertFrom-Json
  $secret = $keys | Where-Object { $_.name -eq 'service_role' -or $_.type -eq 'service_role' } | Select-Object -First 1
  if (-not $secret) {
    $secret = $keys | Where-Object { $_.api_key -match '^sb_secret_' -or $_.api_key -match '^eyJ' } | Select-Object -First 1
  }
  $value = $secret.api_key
  if (-not $value) { $value = $secret.key }
  if (-not $value) { throw "Could not read service_role for project $Ref." }
  $value
}

$ErrorActionPreference = 'Stop'
$instituvaKey = Get-ServiceRoleKeyFromCli -Ref $InstituvaProjectRef
$supabase = Join-Path $env:APPDATA 'npm\supabase.cmd'

if (-not $PSCmdlet.ShouldProcess("Museo project $MuseoProjectRef", 'Set institutional bridge secrets')) { return }

& $supabase secrets set `
  --project-ref $MuseoProjectRef `
  "INSTITUVA_SUPABASE_URL=$InstituvaSupabaseUrl" `
  "INSTITUVA_SERVICE_ROLE_KEY=$instituvaKey" `
  "INSTITUVA_ORGANIZATION_ID=$InstituvaOrganizationId"

if ($LASTEXITCODE -ne 0) { throw "supabase secrets set failed with exit code $LASTEXITCODE." }
Write-Host "OK: secrets set on Museo project $MuseoProjectRef (Instituva org $InstituvaOrganizationId)."
