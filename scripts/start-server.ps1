param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'

try {
    $root = Split-Path $PSScriptRoot -Parent
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $script = Join-Path $PSScriptRoot 'serve.mjs'
    $url = 'http://127.0.0.1:5173'
    $listener = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener[0].OwningProcess)"
        if ($owner.CommandLine -notlike "*$script*") { throw 'Port 5173 is occupied by another process. Close that server before starting this viewer.' }
    } else {
        $log = Join-Path $root 'viewer-server.log'
        $errorLog = Join-Path $root 'viewer-server-error.log'
        $process = Start-Process -FilePath $node -ArgumentList ('"' + $script + '"') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $errorLog -PassThru
    }
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try { $response = Invoke-WebRequest "$url/index.html" -UseBasicParsing -TimeoutSec 1; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch {}
        if ($process -and $process.HasExited) { throw "Server exited. See $errorLog" }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'Server did not respond. See viewer-server-error.log.' }
    Write-Host "Avorion Viewer ready: $url"
    if (-not $NoBrowser) { Start-Process $url }
} catch {
    Write-Host "Could not start Avorion Viewer: $_" -ForegroundColor Red
    exit 1
}

