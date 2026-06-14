# Inicia Vencely sin Docker (requiere Node.js)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js no esta instalado." -ForegroundColor Red
    Write-Host "Instalalo desde https://nodejs.org o abre index.html directamente en el navegador."
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias..."
    npm install
}

Write-Host ""
Write-Host "App disponible en: http://localhost:8080" -ForegroundColor Green
Write-Host "Presiona Ctrl+C para detener." -ForegroundColor Gray
Write-Host ""
npm start
