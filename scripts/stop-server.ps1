$ErrorActionPreference = 'Stop'
try {
    $serverPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'serve.mjs'))
    # Match the absolute script argument used by Start Avorion Viewer.cmd.
    # Do not terminate unrelated Node.js applications or another viewer checkout.
    $argument = '(?i)(?:"' + [regex]::Escape($serverPath) + '"|(?<!\S)' + [regex]::Escape($serverPath) + '(?!\S))'
    $servers = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match $argument })
    if ($servers.Count -eq 0) {
        Write-Host 'No server started by this viewer launcher is running.'
        exit 0
    }
    foreach ($server in $servers) {
        $process = Get-Process -Id $server.ProcessId -ErrorAction SilentlyContinue
        if ($null -ne $process) {
            Stop-Process -InputObject $process -ErrorAction Stop
            $process.WaitForExit()
            Write-Host "Stopped Avorion Viewer server (PID $($server.ProcessId))."
        }
    }
} catch {
    Write-Error "Could not stop Avorion Viewer: $_"
    exit 1
}
