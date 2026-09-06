$ErrorActionPreference = 'Stop'
$helper = (Resolve-Path -LiteralPath 'resources/smtc/linea-smtc.exe').Path
$checkDirectory = Join-Path (Get-Location) 'output/playwright/媒体 session'
New-Item -ItemType Directory -Force -Path $checkDirectory | Out-Null
$checkHelper = Join-Path $checkDirectory 'linea-smtc.exe'
Copy-Item -LiteralPath $helper -Destination $checkHelper -Force
$start = [Diagnostics.ProcessStartInfo]::new()
$start.FileName = $checkHelper
$start.Arguments = '--parent ' + $PID
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardInput = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$process = [Diagnostics.Process]::new()
$process.StartInfo = $start
try {
  $null = $process.Start()
  $ready = $process.StandardOutput.ReadLineAsync()
  if (-not $ready.Wait(5000)) { throw 'Startup timeout' }
  if (($ready.Result | ConvertFrom-Json).type -ne 'ready') { throw 'Helper did not become ready' }
  $cpuStart = $process.TotalProcessorTime.TotalMilliseconds
  $wall = [Diagnostics.Stopwatch]::StartNew()
  $peak = 0
  for ($sample=1; $sample -le 15; $sample++) {
    $process.StandardInput.WriteLine(('{"v":1,"id":' + $sample + ',"method":"snapshot"}'))
    do {
      $read = $process.StandardOutput.ReadLineAsync()
      if (-not $read.Wait(5000)) { throw 'Snapshot timeout' }
      $message = $read.Result | ConvertFrom-Json
    } until ($message.type -eq 'response')
    if (-not $message.ok) { throw 'Snapshot failed' }
    $process.Refresh()
    $peak = [Math]::Max($peak, $process.WorkingSet64)
    Start-Sleep -Milliseconds 2000
  }
  $process.Refresh()
  [pscustomobject]@{
    Samples=15
    Seconds=[Math]::Round($wall.Elapsed.TotalSeconds,2)
    CpuPercentOfOneCore=[Math]::Round(($process.TotalProcessorTime.TotalMilliseconds-$cpuStart)/$wall.Elapsed.TotalMilliseconds*100,3)
    PeakObservedWorkingSetMB=[Math]::Round($peak/1MB,2)
    HelperMB=[Math]::Round((Get-Item -LiteralPath $helper).Length/1MB,2)
    UnicodeAndSpacePath=$true
    Sessions=@($message.data.sessions).Count
  } | ConvertTo-Json
} finally {
  if ($process.Id -and -not $process.HasExited) { $process.StandardInput.Close(); if (-not $process.WaitForExit(2000)) { $process.Kill() } }
  $process.Dispose()
}

