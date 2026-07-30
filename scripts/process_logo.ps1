Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\adity\.gemini\antigravity\brain\4db8ea25-4f05-44bb-8cf5-f0e80253e591\.user_uploaded\media__1785383882169.jpg"
$img = [System.Drawing.Image]::FromFile($srcPath)

function Resize-And-Save($targetPath, $width, $height) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($img, 0, 0, $width, $height)
    $g.Dispose()
    
    $bmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Saved $targetPath ($width x $height)"
}

Resize-And-Save "c:\Users\adity\Downloads\SSCBS OS\public\sscbs_logo.png" 512 512
Resize-And-Save "c:\Users\adity\Downloads\SSCBS OS\public\favicon.png" 512 512
Resize-And-Save "c:\Users\adity\Downloads\SSCBS OS\public\apple-touch-icon.png" 180 180

if (Test-Path "c:\Users\adity\Downloads\SSCBS OS\design_handoff_sscbs_os_redesign\assets") {
    Resize-And-Save "c:\Users\adity\Downloads\SSCBS OS\design_handoff_sscbs_os_redesign\assets\sscbs_logo.png" 512 512
}

$img.Dispose()
