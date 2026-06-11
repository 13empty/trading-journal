# Un solo .exe — todo automatico

Al hacer **doble clic** en `Trading-Journal.exe` se inicia **todo**:

1. **Puente MT5** (http://127.0.0.1:3847) — integrado en la app  
2. **Sync MT5** (`mt5-sync.exe`) — conecta con MetaTrader  
3. **Ventana del journal** — calendario, profit, etc.

No necesitas `.bat`, navegador, `npm` ni abrir el puente aparte.

## Requisito

**MetaTrader 5** abierto con sesion iniciada (la app no incluye MT5).

## Crear el .exe (una vez)

Doble clic: **`Crear-Ejecutable.bat`**

Resultado: `release\Trading-Journal.exe`

## Uso diario

1. Abre MT5  
2. Doble clic en **Trading-Journal.exe**  
3. Espera unos segundos ("Puente MT5...", "Conexion con MetaTrader 5...")  
4. Se abre el journal

Al cerrar la ventana, todo se detiene.

## Si algo falla

- Vuelve a ejecutar **Crear-Ejecutable.bat** y usa el `.exe` nuevo en `release\`  
- Permite el .exe en el antivirus  
- MT5 debe estar abierto antes o justo al abrir la app
