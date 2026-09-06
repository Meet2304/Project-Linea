$ErrorActionPreference = 'Stop'
$vswhere = Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'Microsoft Visual Studio/Installer/vswhere.exe'
if (-not (Test-Path -LiteralPath $vswhere)) { throw 'Install Visual Studio 2022 C++ Build Tools and Windows SDK to build the SMTC helper.' }
$msbuild = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -find 'MSBuild\**\Bin\MSBuild.exe' | Select-Object -First 1
if (-not $msbuild) { throw 'Visual Studio C++ Build Tools were not found.' }
& $msbuild (Join-Path $PSScriptRoot '../native/smtc/linea-smtc.vcxproj') /p:Configuration=Release /p:Platform=x64 /nologo /verbosity:minimal
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

