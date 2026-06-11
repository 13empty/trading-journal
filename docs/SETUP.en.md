# Setup & usage guide (English)

## 1. End user — portable .exe only

1. Clone or download this repository.
2. Run **`Crear-Ejecutable.bat`** at the project root.
3. Wait 5–15 minutes (builds UI, `mt5-sync.exe`, and Electron package).
4. Open **`release/Trading-Journal.exe`**.
5. Keep **MetaTrader 5** running with your account logged in.

### First launch

- Welcome flow and **broker / timezone offset** setup (e.g. IC Markets +6 h).
- MT5 bridge listens on `http://127.0.0.1:3847`.
- Data is stored under `%APPDATA%\trading-journal\`.

## 2. Developer

### Dependencies

```powershell
npm install
pip install -r bridge-python/requirements.txt
pip install pyinstaller
```

### Useful commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Web UI only |
| `npm run start` | Bridge + MT5 + Vite |
| `npm run app:dev` | Electron dev mode |
| `npm run build` | Compile TypeScript + Vite |
| `npm run pack:portable` | Portable `.exe` |
| `npm run pack:installer` | NSIS installer |

### Architecture

```
MetaTrader 5  →  mt5-sync.exe (Python)  →  bridge/server.mjs  →  React UI
                     ↑                           ↑
              MetaTrader5 API              WebSocket / REST :3847
```

## 3. Troubleshooting

| Issue | Action |
|-------|--------|
| Bridge offline | Portable app starts it; in dev run `npm run bridge` |
| No trades | Ensure MT5 is open → **Sync now** in MT5 panel |
| PnL mismatch | Check timezone offset in Settings |
| Antivirus blocks .exe | Allow `release/Trading-Journal.exe` |

Sync log: `%APPDATA%\trading-journal\mt5-sync.log`
