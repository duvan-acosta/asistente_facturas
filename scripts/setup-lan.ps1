# Vencely — configuración rápida para pruebas LAN (PC + Android en la misma WiFi)
# Uso: .\scripts\setup-lan.ps1
#      .\scripts\setup-lan.ps1 -LanIp 192.168.1.50
#      .\scripts\setup-lan.ps1 -SkipDocker -SkipCopyWeb

param(
    [string]$LanIp = '',
    [switch]$SkipDocker,
    [switch]$SkipCopyWeb,
    [switch]$BuildApk
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Get-LanIpAddress {
    if ($LanIp) { return $LanIp.Trim() }

    # Preferir adaptador Wi-Fi/Ethernet con IP privada 192.168.x.x o 10.x.x.x
    $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and
            $_.IPAddress -match '^(192\.168\.|10\.)' -and
            $_.PrefixOrigin -ne 'WellKnown'
        } |
        Sort-Object {
            if ($_.InterfaceAlias -match 'Wi-Fi|WLAN|Wireless|Ethernet') { 0 } else { 1 }
        }, InterfaceAlias

    if ($candidates) {
        return ($candidates | Select-Object -First 1).IPAddress
    }

    # Fallback: ipconfig y primera IPv4 privada
    $lines = ipconfig | Select-String -Pattern 'IPv4'
    foreach ($line in $lines) {
        if ($line -match ':\s*(\d+\.\d+\.\d+\.\d+)') {
            $ip = $Matches[1]
            if ($ip -match '^(192\.168\.|10\.)') { return $ip }
        }
    }

    throw 'No se detectó IP LAN (192.168.x.x o 10.x.x.x). Usa -LanIp 192.168.x.x'
}

function Set-EnvValue {
    param([string[]]$Lines, [string]$Key, [string]$Value)
    $pattern = "^\s*$([regex]::Escape($Key))\s*="
    $newLine = "$Key=$Value"
    $found = $false
    $result = @()
    foreach ($line in $Lines) {
        if ($line -match $pattern) {
            $result += $newLine
            $found = $true
        } else {
            $result += $line
        }
    }
    if (-not $found) { $result += $newLine }
    return ,$result
}

function Ensure-EnvFile {
    param([string]$Path, [string]$ExamplePath)
    if (-not (Test-Path $Path)) {
        if (Test-Path $ExamplePath) {
            Copy-Item $ExamplePath $Path
            Write-Host "Creado .env desde .env.example"
        } else {
            New-Item -Path $Path -ItemType File -Force | Out-Null
        }
    }
}

$ip = Get-LanIpAddress
$apiUrl = "http://${ip}:3000"
$webUrl = "http://${ip}:8080"

Write-Host ''
Write-Host '=== Vencely — setup LAN ===' -ForegroundColor Cyan
Write-Host "IP detectada: $ip"
Write-Host "API: $apiUrl"
Write-Host "Web: $webUrl"
Write-Host ''

$envPath = Join-Path $root '.env'
$examplePath = Join-Path $root '.env.example'
Ensure-EnvFile -Path $envPath -ExamplePath $examplePath

$lines = Get-Content $envPath -Encoding UTF8
$lines = Set-EnvValue -Lines $lines -Key 'PORT' -Value '3000'
$lines = Set-EnvValue -Lines $lines -Key 'CLOUD_API_URL' -Value $apiUrl
$cors = @(
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    "http://${ip}:8080",
    'https://localhost',
    'capacitor://localhost',
    'http://localhost'
) -join ','
$lines = Set-EnvValue -Lines $lines -Key 'CORS_ORIGINS' -Value $cors

if (-not ($lines -join "`n" -match 'DATABASE_URL=')) {
    $lines += 'DATABASE_URL=postgresql://vencely:vencely@localhost:5432/vencely'
}
if (-not ($lines -join "`n" -match 'JWT_SECRET=')) {
    $lines += 'JWT_SECRET=vencely-dev-jwt-change-me'
}

Set-Content -Path $envPath -Value $lines -Encoding UTF8
Write-Host "Actualizado .env (CLOUD_API_URL, CORS_ORIGINS)" -ForegroundColor Green

Write-Host 'Inyectando sync-config.js...'
node -e "require('./scripts/inject-sync-config').ensureSyncConfig(require('path').join(process.cwd()))"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipCopyWeb) {
    Write-Host 'Copiando assets a www/...'
    node scripts/copy-web.js
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $SkipDocker) {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if ($docker) {
        Write-Host 'Reiniciando API Docker para aplicar CORS...'
        docker compose up -d api postgres 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            docker compose restart api 2>&1 | Out-Null
            Write-Host 'Docker: api + postgres activos' -ForegroundColor Green
        } else {
            Write-Host 'Docker no disponible. Usa: npm run dev  o  npm run server' -ForegroundColor Yellow
        }
    } else {
        Write-Host 'Docker no instalado. Arranca el API con: npm run server' -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'Comprobando API...'
try {
    $health = Invoke-RestMethod -Uri "$apiUrl/api/health" -TimeoutSec 5
    Write-Host "Health OK: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "Health falló ($apiUrl/api/health): $_" -ForegroundColor Yellow
    Write-Host 'Espera unos segundos o ejecuta: docker compose up -d api postgres'
}

if ($BuildApk) {
    Write-Host ''
    Write-Host 'Compilando APK debug...'
    npm run build:apk
}

Write-Host ''
Write-Host '=== Instrucciones (teléfono Android) ===' -ForegroundColor Cyan
Write-Host @"

1. PC y teléfono en la MISMA WiFi.
2. Firewall Windows: permite puertos TCP 3000 (API) y 8080 (web, opcional).
   PowerShell (admin): New-NetFirewallRule -DisplayName "Vencely API" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
3. Verifica desde el PC: curl $apiUrl/api/health
4. Opción A — APK con API en LAN:
     npm run build:apk
   Instala: android\app\build\outputs\apk\debug\app-debug.apk
   (USB: adb install -r android\app\build\outputs\apk\debug\app-debug.apk)
5. Opción B — Live reload (dev):
   npm run dev
   Edita capacitor.config.json → server.url = "$webUrl"
   npx cap sync android && npx cap run android
6. En la app: Avisos → debe decir sincronización en línea.
   Usuarios demo: maria@vencely.app / cliente123  |  admin@vencely.app / admin123

URLs:
  API:  $apiUrl
  Web:  $webUrl

"@
