param(
    [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://127.0.0.1:$Port/web-prototype/"
$networkUrls = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.PrefixOrigin -ne 'WellKnown'
    } |
    Select-Object -ExpandProperty IPAddress -Unique |
    ForEach-Object { "http://$_:$Port/web-prototype/" }

Write-Host ""
Write-Host "Starting HadithApp web prototype at $url" -ForegroundColor Green
if ($networkUrls) {
    Write-Host "Open one of these on your phone (same Wi-Fi):" -ForegroundColor Cyan
    $networkUrls | ForEach-Object { Write-Host "  $_" -ForegroundColor Cyan }
}
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Yellow
Write-Host ""

Start-Process $url | Out-Null

if (Get-Command py -ErrorAction SilentlyContinue) {
    py -m http.server $Port -d $root
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    python -m http.server $Port -d $root
} else {
    throw "Python was not found. Install Python or run another local static server from the repo root."
}
