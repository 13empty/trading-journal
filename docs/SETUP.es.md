# Guía de instalación y uso (Español)

## 1. Usuario final — solo el .exe

### Descargar (recomendado)

1. Abre **[Releases](https://github.com/13empty/trading-journal/releases)** en GitHub.
2. Descarga **`Trading-Journal.exe`** de la última versión.
3. Abre **MetaTrader 5** con tu cuenta (IC Markets u otro).
4. Doble clic en el `.exe`.

### Compilar desde el código

1. Clona o descarga este repositorio.
2. Ejecuta **`Crear-Ejecutable.bat`** en la raíz del proyecto.
3. Espera 5–15 minutos (compila interfaz, `mt5-sync.exe` y empaqueta Electron).
4. Abre **`release/Trading-Journal.exe`**.
5. Ten **MetaTrader 5** abierto con tu cuenta.

### Primer arranque

- Asistente de bienvenida y configuración de **broker / offset horario** (ej. IC Markets +6 h).
- El puente MT5 escucha en `http://127.0.0.1:3847`.
- Los datos se guardan en `%APPDATA%\trading-journal\`.

## 2. Desarrollador

### Dependencias

```powershell
npm install
pip install -r bridge-python/requirements.txt
pip install pyinstaller
```

### Comandos útiles

| Comando | Uso |
|---------|-----|
| `npm run dev` | Solo interfaz web |
| `npm run start` | Bridge + MT5 + Vite |
| `npm run app:dev` | Electron en desarrollo |
| `npm run build` | Compilar TypeScript + Vite |
| `npm run pack:portable` | Generar `.exe` portable |
| `npm run pack:installer` | Instalador NSIS |

### Arquitectura

```
MetaTrader 5  →  mt5-sync.exe (Python)  →  bridge/server.mjs  →  React UI
                     ↑                           ↑
              MetaTrader5 API              WebSocket / REST :3847
                     └──────── X-TJ-Token ───────┘
```

### Token del puente

El puente solo responde a la propia app, al sync de Python y al EA de MT5. En cada arranque genera un token aleatorio. Sin el header `X-TJ-Token` responde **401**. Si la petición trae un `Origin` distinto de la interfaz (`http://127.0.0.1:5173`, `http://localhost:5173`, o el preview en el puerto `4173`) responde **403** y no envía `Access-Control-Allow-Origin`. El WebSocket de la interfaz lleva el token en `?token=` porque el navegador no permite headers propios en el handshake.

| Quién arranca | Dónde queda el token |
|---------------|----------------------|
| App de escritorio | `%APPDATA%\trading-journal\bridge-data\bridge-token`. La ventana lo recibe por el preload. El proceso de Python hereda `TJ_BRIDGE_TOKEN`. |
| `npm run bridge` | `bridge/bridge-token` (o `$TJ_BRIDGE_DIR/bridge-token` si definiste esa variable). También puedes exportar `TJ_BRIDGE_TOKEN` antes de arrancar el proceso. |
| `npm run dev` / `npm run start` / los `.bat` | No hace falta copiar el token. Vite se lo entrega a la página en `/__tj/bridge-token` (solo mismo origen). `mt5_sync.py` y `offline_resync.py` leen el archivo que escribió el puente. |
| `mt5-sync.exe` | Misma lógica que el script Python: variable `TJ_BRIDGE_TOKEN` o el archivo de arriba. **Recompila el exe** (`Crear-Ejecutable.bat` o `scripts/build-mt5-sync.ps1`) después de esta versión; un exe antiguo no envía el header. |
| EA de MQL5 | En Windows, si MT5 ya se abrió alguna vez, el puente copia el token a la carpeta común: `trading-journal-bridge-token.txt`. El input `BridgeToken` (o `TJ_BridgeToken` en el `.mqh`) vacío usa ese archivo. Si lo rellenas, manda ese valor. Vuelve a compilar el EA (F7). |

Los `.bat` (`Iniciar-Trading-Journal.bat`, `scripts/sync-mt5-ahora.bat`, `scripts/resync-mt5-completo.bat`) no cambian: el sync lee el archivo del puente que ya está en marcha, o el de `%APPDATA%\trading-journal\bridge-data\` cuando `TJ_BRIDGE_DIR` apunta ahí.

## 3. Solución de problemas

| Problema | Qué hacer |
|----------|-----------|
| Puente apagado | La app portable lo inicia sola; en dev usa `npm run bridge` |
| Sync o la UI responden 401 | El token cambió al reiniciar el puente. Vuelve a abrir la app o `npm run start`. No reutilices un `mt5-sync.exe` compilado antes de esta versión |
| Sin trades | Verifica MT5 abierto → **Sincronizar ahora** en el panel MT5 |
| PnL distinto a MT5 | Revisa offset horario en Ajustes |
| Antivirus bloquea .exe | Añade excepción para `release/Trading-Journal.exe` |

Log de sync: `%APPDATA%\trading-journal\mt5-sync.log`

## 4. Interfaz (v1.2.2)

### Sidebar (calendario)

- Navegación de mes compacta con total del mes y toggle **$ / % / $+%** integrado.
- Celdas más pequeñas; leyenda colapsable (Ganancia / Pérdida → “Más” para badges y detalles).
- Panel **MetaTrader 5** compacto: cuenta, saldo, equity, última sync y **Sincronizar ahora**.
- Botones: **Resumen del día** (principal), **Importar Excel** y **Depósito / Retiro** en fila.

### Pestaña Día

- **Hero:** PnL del día, saldo, trades, win rate.
- **Resumen 14 días:** total del periodo, %, promedio/día, días positivos/negativos, mejor día y mini curva con valores.
- **Chips:** metas al ≥80 % o alcanzadas; reglas solo si hay PARAR.
- **Insights** (colapsable): metas y reglas si están configuradas.
- **Notas del día** en modal (botón en panel de trades).

### Analíticas

- **Metas de beneficio** y **reglas de trading** (también en Ajustes).
- **Riesgo semanal:** promedio, últimas 4 semanas, recomendación de tamaño de riesgo.
- Finanzas de cuenta, resumen por período y búsqueda global de trades.

### Reglas y alertas

- En **Ajustes → Reglas de trading** define límites (p. ej. pérdida diaria máxima).
- Si se incumple una regla hoy, aparece banner rojo con el nombre de la regla.
- La alerta se quita sola si vuelves a estar dentro del límite o cambias la configuración.
