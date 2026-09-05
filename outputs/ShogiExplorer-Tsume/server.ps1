param([int]$Port = 19341)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$EngineDir = Join-Path $Root 'engines\shtsume'
$EngineExe = Join-Path $EngineDir 'shtsume.exe'
$ResponderDir = Join-Path $Root 'engines\yaneuraou'
$ResponderExe = Join-Path $ResponderDir 'YaneuraOu-Suisho5-AVX2.exe'
$Prefix = "http://127.0.0.1:$Port/"
$script:ResponderProcess = $null
$script:ResponderIn = $null
$script:ResponderOut = $null

$rankMap = @{}
foreach ($pair in @(@(0x4e00,1),@(0x4e8c,2),@(0x4e09,3),@(0x56db,4),@(0x4e94,5),@(0x516d,6),@(0x4e03,7),@(0x516b,8),@(0x4e5d,9))) {
  $rankMap[([char]$pair[0]).ToString()] = $pair[1]
}
$digitMap = @{}
foreach ($pair in @(@(0xff11,'1'),@(0xff12,'2'),@(0xff13,'3'),@(0xff14,'4'),@(0xff15,'5'),@(0xff16,'6'),@(0xff17,'7'),@(0xff18,'8'),@(0xff19,'9'))) {
  $digitMap[([char]$pair[0]).ToString()] = $pair[1]
}
$pieceMap = @{}
foreach ($pair in @(@(0x7389,'K'),@(0x98db,'R'),@(0x89d2,'B'),@(0x91d1,'G'),@(0x9280,'S'),@(0x6842,'N'),@(0x9999,'L'),@(0x6b69,'P'),@(0x9f8d,'R'),@(0x99ac,'B'),@(0x5168,'S'),@(0x572d,'N'),@(0x674f,'L'),@(0x3068,'P'))) {
  $pieceMap[([char]$pair[0]).ToString()] = $pair[1]
}

function Send-Bytes($Response, [byte[]]$Bytes, [string]$ContentType, [int]$StatusCode = 200) {
  $Response.StatusCode = $StatusCode
  $Response.ContentType = $ContentType
  $Response.ContentEncoding = [Text.Encoding]::UTF8
  $Response.ContentLength64 = $Bytes.Length
  $Response.Headers['Cache-Control'] = 'no-store'
  $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
  $Response.OutputStream.Close()
}

function Send-Text($Response, [string]$Text, [string]$ContentType = 'text/plain; charset=utf-8', [int]$StatusCode = 200) {
  Send-Bytes $Response ([Text.Encoding]::UTF8.GetBytes($Text)) $ContentType $StatusCode
}

function Send-Json($Response, $Value, [int]$StatusCode = 200) {
  Send-Text $Response (($Value | ConvertTo-Json -Compress -Depth 8)) 'application/json; charset=utf-8' $StatusCode
}

function Convert-ToUsi($Move) {
  $ranks = @('', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i')
  if ($Move.drop) { return "$($Move.drop)*$($Move.to[0])$($ranks[[int]$Move.to[1]])" }
  $suffix = if ($Move.promote) { '+' } else { '' }
  return "$($Move.from[0])$($ranks[[int]$Move.from[1]])$($Move.to[0])$($ranks[[int]$Move.to[1]])$suffix"
}

function Get-KifMove($Content, $PreviousTarget) {
  if ([string]::IsNullOrWhiteSpace($Content)) { return $null }
  $text = $Content.Trim()
  $symbol = $text.IndexOf([char]0x25b2)
  if ($symbol -lt 0) { $symbol = $text.IndexOf([char]0x25b3) }
  if ($symbol -ge 0) { $text = $text.Substring($symbol + 1).Trim() }
  $token = ($text -split '\s+')[0]
  if ([string]::IsNullOrWhiteSpace($token)) { return $null }

  $piecePattern = '\u7389|\u98db|\u89d2|\u91d1|\u9280|\u6842|\u9999|\u6b69|\u9f8d|\u99ac|\u5168|\u572d|\u674f|\u3068'
  $movePattern = "^(?<file>[1-9\uFF11-\uFF19])(?<rank>[\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D])(?<piece>$piecePattern)(?<flags>\u4E0D\u6210|\u6210|\u6253)?(?:\((?<from>[0-9]{2})\))?"
  $match = [regex]::Match($token, $movePattern)
  $destFile = $null; $destRank = $null; $pieceName = $null; $flags = ''; $from = $null
  if ($match.Success) {
    $destFile = [string]$match.Groups['file'].Value
    if ($digitMap.ContainsKey($destFile)) { $destFile = $digitMap[$destFile] }
    $destRank = $rankMap[[string]$match.Groups['rank'].Value]
    $pieceName = [string]$match.Groups['piece'].Value
    $flags = [string]$match.Groups['flags'].Value
    $from = [string]$match.Groups['from'].Value
  } else {
    $samePattern = "^\u540C(?<piece>$piecePattern)(?<flags>\u4E0D\u6210|\u6210|\u6253)?(?:\((?<from>[0-9]{2})\))?"
    $sameMatch = [regex]::Match($token, $samePattern)
    if (-not $sameMatch.Success -or $null -eq $PreviousTarget) { return $null }
    $destFile = [int]$PreviousTarget[0]; $destRank = [int]$PreviousTarget[1]
    $pieceName = [string]$sameMatch.Groups['piece'].Value
    $flags = [string]$sameMatch.Groups['flags'].Value
    $from = [string]$sameMatch.Groups['from'].Value
  }
  if (-not $pieceMap.ContainsKey($pieceName)) { return $null }
  $move = @{ to = @([int]$destFile, [int]$destRank); from = $null; drop = $null; promote = ($flags -eq ([char]0x6210).ToString()) }
  if ($flags -eq ([char]0x6253).ToString()) {
    $move.drop = $pieceMap[$pieceName]
  } elseif ($from.Length -eq 2) {
    $move.from = @([int]$from.Substring(0, 1), [int]$from.Substring(1, 1))
  } else {
    return $null
  }
  $move.usi = Convert-ToUsi $move
  return $move
}

function Read-UsiLine([IO.StreamReader]$Reader, [int]$TimeoutMs) {
  if ($null -eq $Reader) { return $null }
  try {
    $task = $Reader.ReadLineAsync()
    if (-not $task.Wait($TimeoutMs)) { return $null }
    return $task.Result
  } catch {
    return $null
  }
}

function Wait-UsiMarker([string]$Marker, [int]$TimeoutMs) {
  $watch = [Diagnostics.Stopwatch]::StartNew()
  try {
    while ($watch.ElapsedMilliseconds -lt $TimeoutMs) {
      $remaining = [Math]::Max(50, $TimeoutMs - [int]$watch.ElapsedMilliseconds)
      $line = Read-UsiLine $script:ResponderOut $remaining
      if ($null -eq $line) { return $false }
      if ($line.Trim() -eq $Marker) { return $true }
    }
    return $false
  } finally {
    $watch.Stop()
  }
}

function Stop-Responder {
  $process = $script:ResponderProcess
  $script:ResponderProcess = $null
  $script:ResponderIn = $null
  $script:ResponderOut = $null
  if ($null -ne $process) {
    try { if (-not $process.HasExited) { $process.Kill() } } catch { }
    try { $process.Dispose() } catch { }
  }
}

function Start-Responder {
  if (-not (Test-Path -LiteralPath $ResponderExe)) { return $false }
  if ($null -ne $script:ResponderProcess) {
    try { if (-not $script:ResponderProcess.HasExited) { return $true } } catch { }
    Stop-Responder
  }

  $info = New-Object Diagnostics.ProcessStartInfo
  $info.FileName = $ResponderExe
  $info.WorkingDirectory = $ResponderDir
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $false
  try { $info.StandardOutputEncoding = [Text.Encoding]::UTF8 } catch { }

  $process = New-Object Diagnostics.Process
  $process.StartInfo = $info
  try {
    if (-not $process.Start()) { $process.Dispose(); return $false }
    $script:ResponderProcess = $process
    $script:ResponderIn = $process.StandardInput
    $script:ResponderOut = $process.StandardOutput
    $script:ResponderIn.AutoFlush = $true
    $script:ResponderIn.WriteLine('usi')
    if (-not (Wait-UsiMarker 'usiok' 8000)) { throw 'responder-usi-timeout' }
    foreach ($option in @(
      'setoption name Threads value 1',
      'setoption name USI_Hash value 16',
      'setoption name USI_OwnBook value false',
      'setoption name USI_Ponder value false',
      'setoption name EvalDir value eval'
    )) {
      $script:ResponderIn.WriteLine($option)
    }
    $script:ResponderIn.WriteLine('isready')
    if (-not (Wait-UsiMarker 'readyok' 10000)) { throw 'responder-ready-timeout' }
    return $true
  } catch {
    Stop-Responder
    return $false
  }
}

function Expand-SfenRow([string]$Row) {
  $cells = @()
  for ($i = 0; $i -lt $Row.Length; $i++) {
    $char = [string]$Row[$i]
    if ($char -match '^[1-9]$') {
      for ($j = 0; $j -lt [int]$char; $j++) { $cells += '' }
    } elseif ($char -eq '+') {
      if ($i + 1 -lt $Row.Length) {
        $i++
        $cells += '+' + [string]$Row[$i]
      } else {
        $cells += '+'
      }
    } else {
      $cells += $char
    }
  }
  while ($cells.Count -lt 9) { $cells += '' }
  if ($cells.Count -ne 9) { return $null }
  return $cells
}

function Compress-SfenRow($Cells) {
  $text = ''
  $empty = 0
  foreach ($cell in @($Cells)) {
    if ([string]::IsNullOrEmpty([string]$cell)) {
      $empty++
    } else {
      if ($empty -gt 0) { $text += [string]$empty; $empty = 0 }
      $text += [string]$cell
    }
  }
  if ($empty -gt 0) { $text += [string]$empty }
  return $text
}

function Get-ResponderSfenCandidates([string]$Sfen) {
  $safe = $Sfen.Trim()
  $parts = $safe -split '\s+'
  if ($parts.Count -lt 4) { return @($safe) }
  if ($parts[0] -cmatch 'K') { return @($safe) }
  $rows = @($parts[0] -split '/')
  $preferred = @(
    @(9,9),@(1,9),@(8,9),@(2,9),@(7,9),@(3,9),@(6,9),@(4,9),@(5,9),
    @(9,8),@(1,8),@(8,8),@(2,8),@(7,8),@(3,8),@(6,8),@(4,8),@(5,8),
    @(9,1),@(1,1),@(8,1),@(2,1),@(7,1),@(3,1),@(6,1),@(4,1),@(5,1),
    @(9,7),@(1,7),@(9,2),@(1,2),@(8,7),@(2,7),@(8,2),@(2,2)
  )
  $result = @()
  foreach ($position in $preferred) {
    $x = [int]$position[0]; $y = [int]$position[1]
    if ($y -lt 1 -or $y -gt $rows.Count) { continue }
    $cells = @(Expand-SfenRow $rows[$y - 1])
    if ($cells.Count -ne 9) { continue }
    $index = 9 - $x
    if (-not [string]::IsNullOrEmpty([string]$cells[$index])) { continue }
    $copyRows = @($rows)
    $cells[$index] = 'K'
    $copyRows[$y - 1] = Compress-SfenRow $cells
    $copyParts = @($parts)
    $copyParts[0] = $copyRows -join '/'
    $result += ($copyParts -join ' ')
    if ($result.Count -ge 6) { break }
  }
  if ($result.Count -eq 0) { return @($safe) }
  return $result
}

function Get-ResponderMove([string]$Sfen) {
  $safe = $Sfen.Trim()
  if ($safe.Length -gt 500 -or $safe -match '["\r\n]') { return @{ ok = $false; reason = 'invalid-sfen' } }
  $started = [Diagnostics.Stopwatch]::StartNew()
  try {
    foreach ($candidate in @(Get-ResponderSfenCandidates $safe)) {
      if (-not (Start-Responder)) { return @{ ok = $false; reason = 'responder-start-failed' } }
      try {
        $script:ResponderIn.WriteLine('position sfen ' + $candidate)
        $script:ResponderIn.WriteLine('go nodes 1000')
        while ($started.ElapsedMilliseconds -lt 1400) {
          $remaining = [Math]::Max(50, 1400 - [int]$started.ElapsedMilliseconds)
          $line = Read-UsiLine $script:ResponderOut $remaining
          if ($null -eq $line) { break }
          $match = [regex]::Match($line, '^\s*bestmove\s+(\S+)')
          if ($match.Success) {
            $move = [string]$match.Groups[1].Value
            if ($move -notmatch '^(none|resign)$') {
              return @{ ok = $true; reply = $move; engine = 'yaneuraou'; engineMs = $started.ElapsedMilliseconds }
            }
            break
          }
        }
      } catch { }
      Stop-Responder
    }
    return @{ ok = $false; reason = 'no-responder-move'; engineMs = $started.ElapsedMilliseconds }
  } finally {
    $started.Stop()
  }
}

function Invoke-Shtsume([string]$Sfen, [int]$LimitSeconds) {
  if (-not (Test-Path -LiteralPath $EngineExe)) { return @{ ok = $false; reason = 'engine-missing' } }
  $limit = [Math]::Max(1, [Math]::Min(15, $LimitSeconds))
  $safeSfen = $Sfen.Trim()
  if ($safeSfen.Length -gt 500 -or $safeSfen -match '["\r\n]') { return @{ ok = $false; reason = 'invalid-sfen' } }

  $info = New-Object Diagnostics.ProcessStartInfo
  $info.FileName = $EngineExe
  $info.WorkingDirectory = $EngineDir
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.Arguments = "-m 8 -i $limit `"$safeSfen`""
  try {
    $info.StandardOutputEncoding = [Text.Encoding]::UTF8
    $info.StandardErrorEncoding = [Text.Encoding]::UTF8
  } catch { }

  $process = New-Object Diagnostics.Process
  $process.StartInfo = $info
  $started = [Diagnostics.Stopwatch]::StartNew()
  try {
    if (-not $process.Start()) { return @{ ok = $false; reason = 'engine-start-failed' } }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    # shtsume's own -i limit is not a hard wall for every search position.
    # Keep the launcher responsive by enforcing a short process-level bound too.
    $finished = $process.WaitForExit(($limit * 1000) + 1500)
    if (-not $finished) {
      try { $process.Kill() } catch { }
      return @{ ok = $false; reason = 'engine-timeout'; engineMs = $started.ElapsedMilliseconds }
    }
    $output = $stdoutTask.Result
    $errorOutput = $stderrTask.Result
    $stepLines = @{}
    foreach ($line in ($output -split '\r?\n')) {
      $stepMatch = [regex]::Match($line, '^\s*(\d+):(.*)$')
      if ($stepMatch.Success) { $stepLines[[int]$stepMatch.Groups[1].Value] = $stepMatch.Groups[2].Value }
    }
    $first = $null; $reply = $null
    if ($stepLines.ContainsKey(1)) { $first = Get-KifMove $stepLines[1] $null }
    if ($stepLines.ContainsKey(2) -and $null -ne $first) { $reply = Get-KifMove $stepLines[2] $first.to }
    $mateMatch = [regex]::Match($output, '\u8A70\u307F\u307E\u3057\u305F\u3002(\d+)\u624B\u8A70\u3081')
    $mateLength = if ($mateMatch.Success) { [int]$mateMatch.Groups[1].Value } else { $null }
    if ($null -eq $first) {
      $reason = if ($output -match '\u8A70\u307F\u307E\u3057\u305F') { 'engine-parse-failed' } else { 'no-mate' }
      return @{ ok = $false; reason = $reason; engineMs = $started.ElapsedMilliseconds; mateLength = $mateLength; stderr = $errorOutput }
    }
    return @{ ok = $true; firstMove = $first.usi; reply = if ($null -eq $reply) { $null } else { $reply.usi }; mateLength = $mateLength; engineMs = $started.ElapsedMilliseconds }
  } catch {
    return @{ ok = $false; reason = 'engine-error'; message = $_.Exception.Message; engineMs = $started.ElapsedMilliseconds }
  } finally {
    $started.Stop()
    $process.Dispose()
  }
}

function Handle-Request($Context) {
  $request = $Context.Request
  $response = $Context.Response
  $path = $request.Url.AbsolutePath
  try {
    if ($path -eq '/favicon.ico') { $response.StatusCode = 204; $response.Close(); return }
    if ($path -eq '/api/health') {
      $responderReady = Start-Responder
      Send-Json $response @{
        ok = $true
        engine = (Test-Path -LiteralPath $EngineExe)
        solver = (Test-Path -LiteralPath $EngineExe)
        responder = $responderReady
        version = 'yaneuraou-v9.00 + shtsume-v1.2.6'
      }
      return
    }
    if ($path -eq '/api/engine/reply' -and $request.HttpMethod -eq 'POST') {
      $reader = New-Object IO.StreamReader($request.InputStream, [Text.Encoding]::UTF8)
      $body = $reader.ReadToEnd(); $reader.Dispose()
      $payload = $body | ConvertFrom-Json
      if ($null -eq $payload.sfen) { Send-Json $response @{ ok = $false; reason = 'missing-sfen' } 400; return }
      Send-Json $response (Get-ResponderMove ([string]$payload.sfen))
      return
    }
    if ($path -eq '/api/engine/solve' -and $request.HttpMethod -eq 'POST') {
      $reader = New-Object IO.StreamReader($request.InputStream, [Text.Encoding]::UTF8)
      $body = $reader.ReadToEnd(); $reader.Dispose()
      $payload = $body | ConvertFrom-Json
      if ($null -eq $payload.sfen) { Send-Json $response @{ ok = $false; reason = 'missing-sfen' } 400; return }
      Send-Json $response (Invoke-Shtsume ([string]$payload.sfen) 1)
      return
    }

    $file = $null; $contentType = 'text/plain; charset=utf-8'
    switch ($path) {
      '/' { $file = Join-Path $Root 'TsumeLauncher.html'; $contentType = 'text/html; charset=utf-8'; break }
      '/TsumeLauncher.html' { $file = Join-Path $Root 'TsumeLauncher.html'; $contentType = 'text/html; charset=utf-8'; break }
      '/puzzle-data.js' { $file = Join-Path $Root 'puzzle-data.js'; $contentType = 'application/javascript; charset=utf-8'; break }
      '/launcher.js' { $file = Join-Path $Root 'launcher.js'; $contentType = 'application/javascript; charset=utf-8'; break }
      default { Send-Text $response 'Not found' 'text/plain; charset=utf-8' 404; return }
    }
    if (-not (Test-Path -LiteralPath $file)) { Send-Text $response 'Not found' 'text/plain; charset=utf-8' 404; return }
    Send-Bytes $response ([IO.File]::ReadAllBytes($file)) $contentType
  } catch {
    try { Send-Json $response @{ ok = $false; reason = 'server-error'; message = $_.Exception.Message } 500 } catch { }
  }
}

$listener = New-Object Net.HttpListener
$listener.Prefixes.Add($Prefix)
try {
  if (Test-Path -LiteralPath $ResponderExe) { Start-Responder | Out-Null }
  $listener.Start()
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    Handle-Request $context
  }
} catch {
  try { [IO.File]::AppendAllText((Join-Path $Root 'server-error.log'), "$(Get-Date -Format o) $($_.Exception.Message)`r`n", [Text.Encoding]::UTF8) } catch { }
} finally {
  Stop-Responder
  if ($null -ne $listener) {
    try { $listener.Stop() } catch { }
    try { $listener.Close() } catch { }
  }
}
