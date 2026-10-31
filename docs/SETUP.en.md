# Setup & usage guide (English)

## 1. End user — portable .exe only

### Download (recommended)

1. Open **[Releases](https://github.com/13empty/trading-journal/releases)** on GitHub.
2. Download **`Trading-Journal.exe`** from the latest version.
3. Keep **MetaTrader 5** running with your account logged in.
4. Double-click the `.exe`.

### Build from source

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
                     └──────── X-TJ-Token ───────┘
```

### Bridge token

The bridge only answers the app itself, the Python sync, and the MT5 EA. Each launch generates a random token. A request without the `X-TJ-Token` header gets **401**. A request whose `Origin` is not the UI (`http://127.0.0.1:5173`, `http://localhost:5173`, or the preview server on port `4173`) gets **403** and no `Access-Control-Allow-Origin`. The UI WebSocket sends the token as `?token=` because browsers cannot set custom handshake headers.

| Who starts it | Where the token lives |
|---------------|------------------------|
| Desktop app | `%APPDATA%\trading-journal\bridge-data\bridge-token`. The window receives it through preload. The Python process inherits `TJ_BRIDGE_TOKEN`. |
| `npm run bridge` | `bridge/bridge-token` (or `$TJ_BRIDGE_DIR/bridge-token` when that variable is set). You can also export `TJ_BRIDGE_TOKEN` before starting the process. |
| `npm run dev` / `npm run start` / the `.bat` launchers | You do not copy the token by hand. Vite serves it to the page at `/__tj/bridge-token` (same origin only). `mt5_sync.py` and `offline_resync.py` read the file the bridge wrote. |
| `mt5-sync.exe` | Same as the Python script: `TJ_BRIDGE_TOKEN` or the file above. **Rebuild the exe** (`Crear-Ejecutable.bat` or `scripts/build-mt5-sync.ps1`) after this version; an older exe does not send the header. |
| MQL5 EA | On Windows, once MT5 has been opened, the bridge copies the token into MT5's common folder as `trading-journal-bridge-token.txt`. An empty `BridgeToken` input (or `TJ_BridgeToken` in the `.mqh`) uses that file. A filled input sends that value. Recompile the EA (F7). |

The `.bat` files (`Iniciar-Trading-Journal.bat`, `scripts/sync-mt5-ahora.bat`, `scripts/resync-mt5-completo.bat`) stay the same: sync reads the token file from the bridge that is already running, or from `%APPDATA%\trading-journal\bridge-data\` when `TJ_BRIDGE_DIR` points there.

## 3. Troubleshooting

| Issue | Action |
|-------|--------|
| Bridge offline | Portable app starts it; in dev run `npm run bridge` |
| Sync or the UI returns 401 | The token changed when the bridge restarted. Open the app or `npm run start` again. Do not keep an `mt5-sync.exe` built before this version |
| No trades | Ensure MT5 is open → **Sync now** in MT5 panel |
| PnL mismatch | Check timezone offset in Settings |
| Antivirus blocks .exe | Allow `release/Trading-Journal.exe` |

Sync log: `%APPDATA%\trading-journal\mt5-sync.log`

## 4. UI overview (v1.2.2)

### Sidebar (calendar)

- Compact month navigation with month total and inline **$ / % / $+%** toggle.
- Smaller cells; collapsible legend (Gain / Loss → “More” for badges and details).
- Compact **MetaTrader 5** panel: account, balance, equity, last sync, **Sync now**.
- Buttons: **Day summary** (primary), **Import Excel** and **Deposit / Withdrawal** in a row.

### Day tab

- **Hero:** day PnL, balance, trades, win rate.
- **14-day summary:** period total, %, avg/day, win/loss days, best day, mini chart with labels.
- **Chips:** goals at ≥80% or reached; rules only on STOP.
- **Insights** (collapsible): goals and rules when configured.
- **Day notes** in a modal (button on trades panel).

### Analytics

- **Profit goals** and **trading rules** (also in Settings).
- **Weekly risk:** average, last 4 weeks, suggested risk size.
- Account finance, period summary, and global trade search.

### Rules & alerts

- In **Settings → Trading rules**, set limits (e.g. max daily loss).
- If a rule is breached today, a red banner shows which rule fired.
- The alert clears when you are back within limits or change settings.
