<#
.SYNOPSIS
  Arranca backend (FastAPI :8000) y frontend (Vite :5173) en local.
.PARAMETER Lan
  Expone Vite en la red local para probar desde el móvil.
.EXAMPLE
  .\start.ps1
  .\start.ps1 -Lan
#>
param([switch]$Lan)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$python = Join-Path $backend '.venv\Scripts\python.exe'

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

foreach ($port in 8000, 5173) {
    $busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($busy) {
        $proc = Get-Process -Id $busy.OwningProcess -ErrorAction SilentlyContinue
        Write-Host "El puerto $port ya esta en uso por '$($proc.ProcessName)' (PID $($busy.OwningProcess))." -ForegroundColor Red
        Write-Host "Hay otra instancia en marcha? Cierrala o ejecuta: Stop-Process -Id $($busy.OwningProcess)" -ForegroundColor Yellow
        exit 1
    }
}

# --- Backend setup ---
if (-not (Test-Path $python)) {
    Step 'Creando entorno virtual de Python'
    python -m venv (Join-Path $backend '.venv')
}

$requirements = Join-Path $backend 'requirements.txt'
$stamp = Join-Path $backend '.venv\.requirements.sha256'
$hash = (Get-FileHash $requirements -Algorithm SHA256).Hash
if (-not (Test-Path $stamp) -or (Get-Content $stamp) -ne $hash) {
    Step 'Instalando dependencias de Python'
    & $python -m pip install -q --disable-pip-version-check -r $requirements
    if ($LASTEXITCODE -ne 0) { throw 'pip install fallo' }
    Set-Content $stamp $hash
}

$envFile = Join-Path $backend '.env'
if (-not (Test-Path $envFile)) {
    Step 'Creando backend/.env con una SECRET_KEY aleatoria'
    $secret = & $python -c "import secrets; print(secrets.token_urlsafe(48))"
    (Get-Content (Join-Path $backend '.env.example')) -replace '^SECRET_KEY=.*', "SECRET_KEY=$secret" |
        Where-Object { $_ -notmatch '^#' } | Set-Content $envFile
}

# --- Frontend setup ---
$nodeModules = Join-Path $root 'node_modules'
$lock = Join-Path $root 'package-lock.json'
$installedLock = Join-Path $nodeModules '.package-lock.json'
if (-not (Test-Path $nodeModules) -or ((Get-Item $lock).LastWriteTime -gt (Get-Item $installedLock).LastWriteTime)) {
    Step 'Instalando dependencias de npm'
    Push-Location $root
    npm install
    Pop-Location
    if ($LASTEXITCODE -ne 0) { throw 'npm install fallo' }
}

# --- Run ---
Step 'Arrancando backend en http://localhost:8000'
$api = Start-Process -FilePath $python -WorkingDirectory $backend -NoNewWindow -PassThru `
    -ArgumentList '-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000'

try {
    Step 'Arrancando frontend (Ctrl+C para parar ambos)'
    Push-Location $root
    $viteArgs = @('run', 'dev', '--', '--port', '5173', '--strictPort')
    if ($Lan) { $viteArgs += '--host' }
    npm @viteArgs
}
finally {
    Pop-Location
    if (-not $api.HasExited) {
        Step 'Parando backend'
        # /T also stops the uvicorn --reload worker process.
        taskkill /PID $api.Id /T /F | Out-Null
    }
}
