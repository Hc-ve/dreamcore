# Compress selected PPT screenshots to JPG (max edge 1600px, quality 85)
# Output: ppt-final-assets/  (used by both PPTX and HTML versions)
Add-Type -AssemblyName System.Drawing

$root = 'e:\a\6a578b50553ee2fa56364236'
$lib  = Join-Path $root 'ppt制作素材库'
$out  = Join-Path $root 'ppt-final-assets'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$map = @(
  @('01-首页与画廊\02暗色主界面.png',           'hero-dark.jpg'),
  @('05-技术证据\01-自研模型训练徽章.png',      'demo1-craft.jpg'),
  @('02-创作工坊\08-AI重绘(已有).png',          'demo2-repaint.jpg'),
  @('05-技术证据\02-手账本定制-模型预览.png',    'demo3-notebook.jpg'),
  @('05-技术证据\03-书签定制-模型预览.png',      'demo3-bookmark.jpg'),
  @('03-文化探索\06AI识文化.png',               'demo4-scan.jpg'),
  @('03-文化探索\01-文化故事图鉴.png',           'demo4-atlas.jpg'),
  @('03-文化探索\03-文化探索足迹.png',           'demo4-footprint.jpg'),
  @('03-文化探索\02-智慧导览.png',               'demo4-scenic.jpg'),
  @('01-首页与画廊\04文旅画廊.png',              'demo5-gallery.jpg'),
  @('01-首页与画廊\03创作者排行榜.png',          'demo5-rank.jpg'),
  @('补充素材\AI修图.png',                        'link-edit.jpg'),
  @('02-创作工坊\03-AI修图工作台(带作品).png',   'link-edit2.jpg'),
  @('04-平台与账户\02-管理后台.png',             'eng-admin.jpg'),
  @('补充素材\AI文创设计图2.png',                'tech-case2.jpg')
)

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep  = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)

foreach ($m in $map) {
  $src = Join-Path $lib $m[0]
  $dst = Join-Path $out $m[1]
  if (-not (Test-Path $src)) { Write-Output ("MISS  {0}" -f $m[0]); continue }
  $img = [System.Drawing.Image]::FromFile($src)
  $scale = 1600 / [Math]::Max($img.Width, $img.Height)
  if ($scale -gt 1) { $scale = 1 }
  $nw = [int]($img.Width * $scale); $nh = [int]($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $nw, $nh)
  $g.Dispose(); $bmp.Save($dst, $enc, $ep); $bmp.Dispose(); $img.Dispose()
  $kb = [int]((Get-Item $dst).Length / 1KB)
  Write-Output ("OK  {0,-24} {1}x{2}  {3}KB" -f $m[1], $nw, $nh, $kb)
}
Write-Output 'done'