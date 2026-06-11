# Trading Journal

**Diario de trading con sincronización MetaTrader 5 · Desktop app for Windows**

[![Version](https://img.shields.io/badge/version-1.2.0-blue)](package.json)
[![Stack](https://img.shields.io/badge/stack-React%20%2B%20Electron%20%2B%20Python-61dafb)](package.json)

---

## Español

Aplicación de escritorio para llevar un **diario de trading** con calendario PnL, notas diarias, analíticas y sincronización en vivo con **MetaTrader 5** (vía puente local + Python).

### Características

| Módulo | Descripción |
|--------|-------------|
| **Calendario** | PnL por día en **$**, **%** o **ambos**; totales semanales y mensuales |
| **Vista día** | Hero PnL, curva de equity (PnL acumulado), trades, notas, depósitos/retiros |
| **MT5 sync** | Trades cerrados, posiciones abiertas, saldo y equity cada ~2 s |
| **Analíticas** | Expectancy, profit factor, drawdown, rachas, por símbolo, export PDF |
| **Proyección** | Escenarios 15–90 días según racha actual |
| **Búsqueda** | Buscar trades y saltar al día en el calendario |
| **i18n** | Español, inglés, portugués |
| **Desktop** | Un solo `.exe` portable (`release/Trading-Journal.exe`) |

### Requisitos

- **Windows 10/11**
- **Node.js 20+** (solo para desarrollo o compilar)
- **Python 3.10+** con `MetaTrader5`, `pyinstaller` (para compilar sync)
- **MetaTrader 5** abierto con sesión iniciada

### Inicio rápido (usuario)

1. Ejecuta `Crear-Ejecutable.bat` (una vez) → genera `release/Trading-Journal.exe`
2. Abre MT5 e inicia sesión
3. Doble clic en **Trading-Journal.exe**

Más detalle: [APP-ESCRITORIO.md](APP-ESCRITORIO.md) · [docs/SETUP.es.md](docs/SETUP.es.md)

### Desarrollo

```bash
npm install
npm run start          # bridge + mt5 + vite (navegador)
npm run app:dev        # modo Electron con hot reload
npm run build          # compilar frontend
npm run pack:portable  # .exe portable
```

### Estructura del proyecto

```
trading-journal/
├── src/                 # React + TypeScript (UI)
├── electron/            # Ventana desktop, auto-update
├── bridge/              # Servidor Node (puerto 3847)
├── bridge-python/       # Sync MT5 (MetaTrader5 API)
├── mt5/                 # EA opcional (MQL5)
├── scripts/             # Build portable / instalador
├── docs/                # Documentación ES / EN
└── release/             # .exe generado (no en git)
```

### Datos y privacidad

Los trades y notas se guardan **localmente** en el perfil del usuario (`%APPDATA%/trading-journal/`). No se envían a servidores externos.

### Donaciones

Si te resulta útil este proyecto, puedes apoyar su desarrollo:

- **USDC (EVM):** `0xE077af7EE3FB1611BC21b2a220d78274576994F3`
- **PayPal:** [paypal.me/13mpty](https://paypal.me/13mpty)

---

## English

Desktop **trading journal** with a PnL calendar, daily notes, analytics, and live **MetaTrader 5** sync (local bridge + Python).

### Features

| Module | Description |
|--------|-------------|
| **Calendar** | Daily PnL in **$**, **%**, or **both**; weekly and monthly totals |
| **Day view** | PnL hero, equity curve (cumulative PnL), trades, notes, cash flows |
| **MT5 sync** | Closed trades, open positions, balance & equity ~every 2s |
| **Analytics** | Expectancy, profit factor, drawdown, streaks, by symbol, PDF export |
| **Projection** | 15–90 day scenarios from current streak |
| **Search** | Find trades and jump to calendar day |
| **i18n** | Spanish, English, Portuguese |
| **Desktop** | Single portable `.exe` (`release/Trading-Journal.exe`) |

### Requirements

- **Windows 10/11**
- **Node.js 20+** (dev / build only)
- **Python 3.10+** with `MetaTrader5`, `pyinstaller` (to build sync)
- **MetaTrader 5** running and logged in

### Quick start (end user)

1. Run `Crear-Ejecutable.bat` once → outputs `release/Trading-Journal.exe`
2. Open MT5 and log in
3. Double-click **Trading-Journal.exe**

More: [APP-ESCRITORIO.md](APP-ESCRITORIO.md) · [docs/SETUP.en.md](docs/SETUP.en.md)

### Development

```bash
npm install
npm run start          # bridge + mt5 + vite (browser)
npm run app:dev        # Electron with hot reload
npm run build          # build frontend
npm run pack:portable  # portable .exe
```

### Project layout

See the Spanish section above — same tree under `trading-journal/`.

### Data & privacy

Trades and notes are stored **locally** in the user profile (`%APPDATA%/trading-journal/`). No cloud upload by default.

### Donations

If you find this project helpful, you can support its development:

- **USDC (EVM):** `0xE077af7EE3FB1611BC21b2a220d78274576994F3`
- **PayPal:** [paypal.me/13mpty](https://paypal.me/13mpty)

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT — see [LICENSE](LICENSE).
