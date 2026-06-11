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
```

## 3. Solución de problemas

| Problema | Qué hacer |
|----------|-----------|
| Puente apagado | La app portable lo inicia sola; en dev usa `npm run bridge` |
| Sin trades | Verifica MT5 abierto → **Sincronizar ahora** en el panel MT5 |
| PnL distinto a MT5 | Revisa offset horario en Ajustes |
| Antivirus bloquea .exe | Añade excepción para `release/Trading-Journal.exe` |

Log de sync: `%APPDATA%\trading-journal\mt5-sync.log`
