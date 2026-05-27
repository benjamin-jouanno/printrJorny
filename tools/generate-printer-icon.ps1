Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$iconDir = Join-Path $root 'src-tauri/icons'

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-PrinterBitmap {
  param([int]$Size)

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $bgPath = New-RoundedRectanglePath -X ($Size * 0.055) -Y ($Size * 0.055) -Width ($Size * 0.89) -Height ($Size * 0.89) -Radius ($Size * 0.19)
  $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.RectangleF]::new(0, 0, $Size, $Size),
    [System.Drawing.Color]::FromArgb(255, 13, 19, 30),
    [System.Drawing.Color]::FromArgb(255, 21, 28, 43),
    135
  )
  $graphics.FillPath($bgBrush, $bgPath)

  $glowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(32, 128, 255, 219))
  $glowPath = New-RoundedRectanglePath -X ($Size * 0.19) -Y ($Size * 0.2) -Width ($Size * 0.62) -Height ($Size * 0.55) -Radius ($Size * 0.09)
  $graphics.FillPath($glowBrush, $glowPath)

  $accent = [System.Drawing.Color]::FromArgb(255, 128, 255, 219)
  $accentTwo = [System.Drawing.Color]::FromArgb(255, 72, 191, 227)
  $soft = [System.Drawing.Color]::FromArgb(255, 237, 242, 247)

  $stroke = [Math]::Max(2.0, $Size * 0.065)
  $bodyPen = [System.Drawing.Pen]::new($accent, $stroke)
  $bodyPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $bodyPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $bodyPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $railPen = [System.Drawing.Pen]::new($accentTwo, $stroke)
  $railPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $railPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen = [System.Drawing.Pen]::new($soft, [Math]::Max(1.5, $Size * 0.038))
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $x = $Size * 0.25
  $y = $Size * 0.33
  $w = $Size * 0.5
  $h = $Size * 0.37
  $radius = $Size * 0.055
  $bodyPath = New-RoundedRectanglePath -X $x -Y $y -Width $w -Height $h -Radius $radius
  $graphics.DrawPath($bodyPen, $bodyPath)

  $graphics.DrawLine($railPen, $Size * 0.27, $Size * 0.24, $Size * 0.73, $Size * 0.24)
  $graphics.DrawLine($linePen, $Size * 0.36, $Size * 0.49, $Size * 0.64, $Size * 0.49)

  $nozzlePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $nozzlePath.AddPolygon(@(
    [System.Drawing.PointF]::new($Size * 0.43, $Size * 0.50),
    [System.Drawing.PointF]::new($Size * 0.57, $Size * 0.50),
    [System.Drawing.PointF]::new($Size * 0.54, $Size * 0.61),
    [System.Drawing.PointF]::new($Size * 0.50, $Size * 0.67),
    [System.Drawing.PointF]::new($Size * 0.46, $Size * 0.61)
  ))
  $graphics.FillPath([System.Drawing.SolidBrush]::new($soft), $nozzlePath)

  $graphics.Dispose()
  return $bitmap
}

function Save-Png {
  param([int]$Size, [string]$Path)

  $bitmap = New-PrinterBitmap -Size $Size
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function Get-PngBytes {
  param([int]$Size)

  $bitmap = New-PrinterBitmap -Size $Size
  $stream = [System.IO.MemoryStream]::new()
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  $bytes = $stream.ToArray()
  $stream.Dispose()
  return ,$bytes
}

function Save-Ico {
  param([string]$Path, [int[]]$Sizes)

  $entries = foreach ($size in $Sizes) {
    [PSCustomObject]@{
      Size = $size
      Bytes = Get-PngBytes -Size $size
    }
  }

  $stream = [System.IO.File]::Create($Path)
  $writer = [System.IO.BinaryWriter]::new($stream)
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$entries.Count)

  $offset = 6 + ($entries.Count * 16)
  foreach ($entry in $entries) {
    $writer.Write([byte]$(if ($entry.Size -ge 256) { 0 } else { $entry.Size }))
    $writer.Write([byte]$(if ($entry.Size -ge 256) { 0 } else { $entry.Size }))
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$entry.Bytes.Length)
    $writer.Write([UInt32]$offset)
    $offset += $entry.Bytes.Length
  }

  foreach ($entry in $entries) {
    $writer.Write($entry.Bytes)
  }

  $writer.Dispose()
  $stream.Dispose()
}

Save-Png -Size 32 -Path (Join-Path $iconDir '32x32.png')
Save-Png -Size 128 -Path (Join-Path $iconDir '128x128.png')
Save-Png -Size 256 -Path (Join-Path $iconDir '128x128@2x.png')
Save-Png -Size 512 -Path (Join-Path $iconDir 'icon.png')
Save-Ico -Path (Join-Path $iconDir 'icon.ico') -Sizes @(16, 24, 32, 48, 64, 128, 256)
