Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$iconPath = Join-Path $PSScriptRoot 'TsumeLauncher.ico'
$previewPath = Join-Path $env:TEMP 'tsume-launcher-icon-preview.png'

function New-RoundedPath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-Object -TypeName System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-IconBitmap([int]$size) {
  $bitmap = New-Object -TypeName System.Drawing.Bitmap -ArgumentList @($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $scale = $size / 256.0

  $outer = New-RoundedPath (8 * $scale) (8 * $scale) (240 * $scale) (240 * $scale) (47 * $scale)
  $outerRect = [System.Drawing.RectangleF]::new((8 * $scale), (8 * $scale), (240 * $scale), (240 * $scale))
  $outerBrush = New-Object -TypeName System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList @($outerRect, [System.Drawing.Color]::FromArgb(255, 28, 79, 70), [System.Drawing.Color]::FromArgb(255, 61, 126, 103), 135)
  $outerPen = New-Object -TypeName System.Drawing.Pen -ArgumentList @([System.Drawing.Color]::FromArgb(210, 236, 220, 172), (2 * $scale))
  $graphics.FillPath($outerBrush, $outer)
  $graphics.DrawPath($outerPen, $outer)

  $inner = New-RoundedPath (17 * $scale) (17 * $scale) (222 * $scale) (222 * $scale) (39 * $scale)
  $innerPen = New-Object -TypeName System.Drawing.Pen -ArgumentList @([System.Drawing.Color]::FromArgb(70, 255, 255, 255), (1 * $scale))
  $graphics.DrawPath($innerPen, $inner)

  $piecePoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new((128 * $scale), (29 * $scale)),
    [System.Drawing.PointF]::new((199 * $scale), (50 * $scale)),
    [System.Drawing.PointF]::new((215 * $scale), (196 * $scale)),
    [System.Drawing.PointF]::new((175 * $scale), (231 * $scale)),
    [System.Drawing.PointF]::new((81 * $scale), (231 * $scale)),
    [System.Drawing.PointF]::new((41 * $scale), (196 * $scale)),
    [System.Drawing.PointF]::new((57 * $scale), (50 * $scale))
  )
  $piecePath = New-Object -TypeName System.Drawing.Drawing2D.GraphicsPath
  $piecePath.AddPolygon($piecePoints)
  $pieceBounds = [System.Drawing.RectangleF]::new((41 * $scale), (29 * $scale), (174 * $scale), (202 * $scale))
  $pieceBrush = New-Object -TypeName System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList @($pieceBounds, [System.Drawing.Color]::FromArgb(255, 255, 244, 198), [System.Drawing.Color]::FromArgb(255, 208, 143, 67), 135)
  $piecePen = New-Object -TypeName System.Drawing.Pen -ArgumentList @([System.Drawing.Color]::FromArgb(230, 112, 71, 34), (3 * $scale))
  $graphics.FillPath($pieceBrush, $piecePath)
  $graphics.DrawPath($piecePen, $piecePath)

  $fontSize = [Math]::Max(12, 96 * $scale)
  $font = New-Object -TypeName System.Drawing.Font -ArgumentList @('Microsoft YaHei UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object -TypeName System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textRect = [System.Drawing.RectangleF]::new((56 * $scale), (55 * $scale), (144 * $scale), (132 * $scale))
  $textBrush = New-Object -TypeName System.Drawing.SolidBrush -ArgumentList @([System.Drawing.Color]::FromArgb(255, 36, 83, 72))
  $kanji = [string][char]0x8A70
  $graphics.DrawString($kanji, $font, $textBrush, $textRect, $format)

  $shine = New-Object -TypeName System.Drawing.Pen -ArgumentList @([System.Drawing.Color]::FromArgb(120, 255, 255, 255), (2 * $scale))
  $graphics.DrawLine($shine, (78 * $scale), (65 * $scale), (111 * $scale), (55 * $scale))

  $outer.Dispose(); $outerBrush.Dispose(); $outerPen.Dispose(); $inner.Dispose(); $innerPen.Dispose(); $piecePath.Dispose(); $pieceBrush.Dispose(); $piecePen.Dispose(); $font.Dispose(); $format.Dispose(); $textBrush.Dispose(); $shine.Dispose(); $graphics.Dispose()
  return $bitmap
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngFrames = @()
foreach ($size in $sizes) {
  $bitmap = New-IconBitmap $size
  $stream = New-Object -TypeName System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngFrames += ,$stream.ToArray()
  if ($size -eq 256) { $bitmap.Save($previewPath, [System.Drawing.Imaging.ImageFormat]::Png) }
  $stream.Dispose(); $bitmap.Dispose()
}

$iconStream = New-Object -TypeName System.IO.MemoryStream
$writer = New-Object -TypeName System.IO.BinaryWriter -ArgumentList @($iconStream)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$pngFrames.Count)
$offset = 6 + (16 * $pngFrames.Count)
for ($index = 0; $index -lt $pngFrames.Count; $index++) {
  $size = $sizes[$index]
  $width = if ($size -eq 256) { 0 } else { $size }
  $writer.Write([byte]$width); $writer.Write([byte]$width); $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$pngFrames[$index].Length); $writer.Write([uint32]$offset)
  $offset += $pngFrames[$index].Length
}
foreach ($frame in $pngFrames) { $writer.Write($frame) }
$writer.Flush()
[System.IO.File]::WriteAllBytes($iconPath, $iconStream.ToArray())
$writer.Dispose(); $iconStream.Dispose()
Write-Output "Generated $iconPath"
Write-Output "Preview $previewPath"
