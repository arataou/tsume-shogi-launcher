param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot 'outputs')
)

$package = Join-Path $OutputRoot 'ShogiExplorer-Tsume'
$zip = Join-Path $OutputRoot 'ShogiExplorer-Tsume-Full.zip'

if (-not (Test-Path -LiteralPath $package -PathType Container)) {
  throw "Package directory not found: $package"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $zip) {
  Remove-Item -LiteralPath $zip -Force
}
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $package,
  $zip,
  [System.IO.Compression.CompressionLevel]::Optimal,
  $true
)

Get-Item -LiteralPath $zip | Select-Object FullName, Length, LastWriteTime
