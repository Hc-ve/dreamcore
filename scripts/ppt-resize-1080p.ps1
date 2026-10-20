# Batch-resize all PNGs in ppt制作素材库 to 1920x1080.
# Strategy: contain-scale (no crop, no stretch) centered onto a 1920x1080 canvas,
#           padding filled with the image's top-left pixel color (dark theme blends naturally).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/ppt-resize-1080p.ps1
Add-Type -AssemblyName System.Drawing

$root = 'e:\a\6a578b50553ee2fa56364236\ppt制作素材库'
$tw = 1920; $th = 1080
$processed = 0; $skipped = 0; $errors = 0

Get-ChildItem -Path $root -Recurse -Filter *.png | ForEach-Object {
  $p = $_.FullName
  try {
    $img = [System.Drawing.Image]::FromFile($p)
    $w = $img.Width; $h = $img.Height

    if ($w -eq $tw -and $h -eq $th) {
      $img.Dispose()
      $script:skipped++
      return
    }

    # in-memory copy for sampling + drawing (releases the file handle)
    $bmp = New-Object System.Drawing.Bitmap($img)
    $corner = $bmp.GetPixel(0, 0)
    $img.Dispose()

    # fit within target canvas without upscaling beyond native size
    $scale = [Math]::Min(($tw / $w), ($th / $h))
    if ($scale -gt 1.0) { $scale = 1.0 }
    $nw = [int][Math]::Round($w * $scale)
    $nh = [int][Math]::Round($h * $scale)

    $canvas = New-Object System.Drawing.Bitmap($tw, $th)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear($corner)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $x = [int](($tw - $nw) / 2)
    $y = [int](($th - $nh) / 2)
    $g.DrawImage($bmp, $x, $y, $nw, $nh)

    $g.Dispose()
    $bmp.Dispose()
    $canvas.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()

    $script:processed++
    Write-Output ("OK    {0,-40} {1}x{2} -> {3}x{4}" -f $_.Name, $w, $h, $tw, $th)
  }
  catch {
    $script:errors++
    Write-Output ("FAIL  {0,-40} {1}" -f $_.Name, $_.Exception.Message)
  }
}

Write-Output ''
Write-Output ("Done: processed={0} skipped={1} failed={2}" -f $processed, $skipped, $errors)