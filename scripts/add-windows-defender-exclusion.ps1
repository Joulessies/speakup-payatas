# Adds a Microsoft Defender folder exclusion for this repo (speeds up Next.js / Turbopack on Windows).
# Run in an elevated PowerShell: right-click Terminal -> Run as Administrator, then:
#   Set-ExecutionPolicy -Scope Process Bypass -Force; & ".\scripts\add-windows-defender-exclusion.ps1"
# Docs: https://nextjs.org/docs/app/guides/local-development

$ErrorActionPreference = "Stop"
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Run this script in an elevated (Administrator) PowerShell session."
}
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Add-MpPreference -ExclusionPath $projectRoot
Write-Host "Defender exclusion added for: $projectRoot"
