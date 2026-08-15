Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("C:\Users\apaca\.gemini\antigravity-ide\brain\22a44e39-7c91-4509-9e03-2f8e358a2a79\.user_uploaded\media_1786763950636.jpg")
$bmp = new-object System.Drawing.Bitmap($img)
$img.Dispose()

# Hacer blanco transparente (con tolerancia si es necesario, pero MakeTransparent busca coincidencia exacta. Usamos loop si es jpeg)
for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $color = $bmp.GetPixel($x, $y)
        # Si es casi blanco (JPEG compression artifacts)
        if ($color.R -ge 240 -and $color.G -ge 240 -and $color.B -ge 240) {
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        }
    }
}

$bmp.Save("c:\Users\apaca\OneDrive\Escritorio\Amilcar\Bitacora_vehiculos\backend\logo.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Success"
