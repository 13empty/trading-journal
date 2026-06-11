# Prueba si el puente funciona (la app debería ponerse amarilla, no verde aún)
# Usa valores de ejemplo — sustituye por tu cuenta demo si quieres probar.
$body = @{
  type     = 'heartbeat'
  account  = 12345678
  balance  = 10000.00
  equity   = 10000.00
  server   = 'Demo-Server'
} | ConvertTo-Json

try {
  $r = Invoke-RestMethod -Uri 'http://127.0.0.1:3847/api/event' -Method POST -Body $body -ContentType 'application/json'
  $s = Invoke-RestMethod -Uri 'http://127.0.0.1:3847/api/status'
  Write-Host 'Puente OK. connected=' $s.connected 'balance=' $s.balance -ForegroundColor Green
  Write-Host 'Refresca la app en el navegador — deberia verse VERDE unos segundos.'
} catch {
  Write-Host 'Puente NO corre. Ejecuta: npm run bridge' -ForegroundColor Red
  Write-Host $_.Exception.Message
}
