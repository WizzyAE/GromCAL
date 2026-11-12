$ErrorActionPreference = 'Stop'
$webRoot = Join-Path $PSScriptRoot 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $webRoot 'index.html'))) {
    throw 'Nedostaje dist/index.html.'
}
Write-Host 'GromCAL: http://127.0.0.1:5173'
Write-Host 'Za zaustavljanje pritisni Ctrl+C.'
python -m http.server 5173 --bind 127.0.0.1 --directory $webRoot
