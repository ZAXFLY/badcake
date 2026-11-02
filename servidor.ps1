$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8080
$listener = $null

for ($p = 8080; $p -le 8095; $p++) {
  try {
    $tmp = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
    $tmp.Start()
    $listener = $tmp
    $port = $p
    break
  } catch {}
}

if (-not $listener) {
  Write-Host "No se encontro puerto libre. Abriendo index.html directamente..."
  Start-Process (Join-Path $root "index.html")
  exit
}

$base = "http://localhost:$port"
try { Clear-Host } catch {}
Write-Host "========================================================"
Write-Host "  BADCAKE - good people, bad ideas"
Write-Host "  Tienda (clientes) : $base/index.html"
Write-Host "  Panel (dueno)     : $base/admin.html"
Write-Host "  Contrasena local  : badcake2026"
Write-Host "========================================================"
Write-Host "  Deja esta ventana abierta mientras uses el servidor."
Write-Host "  Presiona Ctrl+C para cerrarlo."
Write-Host ""

Start-Process "$base/index.html"

$mimes = @{
  '.html'  = 'text/html; charset=utf-8'
  '.css'   = 'text/css; charset=utf-8'
  '.js'    = 'application/javascript; charset=utf-8'
  '.json'  = 'application/json; charset=utf-8'
  '.png'   = 'image/png'
  '.jpg'   = 'image/jpeg'
  '.jpeg'  = 'image/jpeg'
  '.webp'  = 'image/webp'
  '.svg'   = 'image/svg+xml'
  '.ico'   = 'image/x-icon'
  '.woff2' = 'font/woff2'
  '.otf'   = 'font/otf'
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $line = $reader.ReadLine()
      if ($line) {
        while ($true) {
          $h = $reader.ReadLine()
          if ([string]::IsNullOrEmpty($h)) { break }
        }
        $parts = $line.Split(' ')
        $rawPath = if ($parts.Length -ge 2) { $parts[1].Split('?')[0] } else { '/' }
        $rel = [Uri]::UnescapeDataString($rawPath.TrimStart('/'))
        if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
        $full = [System.IO.Path]::GetFullPath((Join-Path $root ($rel -replace '/', '\')))

        if ($full.StartsWith($root) -and (Test-Path $full -PathType Leaf)) {
          $ext = [System.IO.Path]::GetExtension($full).ToLower()
          $ct = if ($mimes.ContainsKey($ext)) { $mimes[$ext] } else { 'application/octet-stream' }
          $body = [System.IO.File]::ReadAllBytes($full)
          $hdr = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-cache`r`n`r`n"
          $hb = [System.Text.Encoding]::ASCII.GetBytes($hdr)
          $stream.Write($hb, 0, $hb.Length)
          $stream.Write($body, 0, $body.Length)
        } else {
          $msg = [System.Text.Encoding]::UTF8.GetBytes("404 No encontrado")
          $hdr = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($msg.Length)`r`nConnection: close`r`n`r`n"
          $hb = [System.Text.Encoding]::ASCII.GetBytes($hdr)
          $stream.Write($hb, 0, $hb.Length)
          $stream.Write($msg, 0, $msg.Length)
        }
      }
    } catch {} finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
