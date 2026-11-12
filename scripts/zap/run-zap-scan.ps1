<#
.SYNOPSIS
  Runs OWASP ZAP Baseline Pentesting Scan against the SpeakUp Payatas web application.

.DESCRIPTION
  This script launches an automated Dynamic Application Security Testing (DAST) container
  (zaproxy/zap-stable) to crawl and pentest SpeakUp Payatas for OWASP Top 10 vulnerabilities.

.PARAMETER TargetUrl
  The URL of the running SpeakUp Payatas instance (default: http://host.docker.internal:3000)

.EXAMPLE
  .\scripts\zap\run-zap-scan.ps1
  .\scripts\zap\run-zap-scan.ps1 -TargetUrl "https://staging.speakuppayatas.org"
#>

param(
    [string]$TargetUrl = "http://host.docker.internal:3000"
)

$ErrorActionPreference = "Stop"

# Resolve paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = (Get-Item $ScriptDir).Parent.Parent.FullName
$ReportDir = Join-Path $ProjectDir "reports"
$ReportDir = Join-Path $ReportDir "zap"

if (-not (Test-Path $ReportDir)) {
    New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$HtmlReport = "zap-report-$Timestamp.html"
$JsonReport = "zap-report-$Timestamp.json"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " SpeakUp Payatas - OWASP ZAP Automated Pentesting Scan" -ForegroundColor Cyan
Write-Host " Target URL: $TargetUrl" -ForegroundColor Yellow
Write-Host " Report Dir: $ReportDir" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# Check if Docker is available
try {
    $null = docker version 2>&1
} catch {
    Write-Host "[!] Docker is not running or not installed." -ForegroundColor Red
    Write-Host "    Please start Docker Desktop to run the automated ZAP container." -ForegroundColor Yellow
    Write-Host "    Alternatively, run the desktop ZAP GUI from https://www.zaproxy.org/download/" -ForegroundColor Yellow
    exit 1
}

Write-Host "[+] Pulling latest OWASP ZAP stable container..." -ForegroundColor Green
docker pull zaproxy/zap-stable:latest

# Convert path format for Docker volume mount on Windows
$DockerMountPath = $ReportDir.Replace('\', '/')
$VolumeArg = "${DockerMountPath}:/zap/wrk/:rw"

Write-Host "[+] Executing ZAP Baseline Scan against $TargetUrl..." -ForegroundColor Green

$zapArgs = @(
    "run", "--rm",
    "-v", $VolumeArg,
    "-t", "zaproxy/zap-stable",
    "zap-baseline.py",
    "-t", $TargetUrl,
    "-g", "gen.conf",
    "-r", $HtmlReport,
    "-J", $JsonReport,
    "-I"
)

& docker $zapArgs

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "[SUCCESS] Pentesting scan completed!" -ForegroundColor Green
Write-Host "HTML Report: $ReportDir\$HtmlReport" -ForegroundColor Cyan
Write-Host "JSON Report: $ReportDir\$JsonReport" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
