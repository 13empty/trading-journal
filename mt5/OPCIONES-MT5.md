# Dos formas de conectar MT5 (sin pelear con tu EA)

## El problema

En **un mismo gráfico** solo puede haber **1 Expert Advisor**.
Si ya tienes uno de trading, no puedes poner `TradingJournalBridge` encima.

---

## ¿Cuál opción es mejor?

| | Opción 1: Python (sin EA) | Opción 2: Fusionar con tu EA |
|---|---------------------------|------------------------------|
| **Necesitas** | MT5 abierto + Python | Código fuente (.mq5) de tu EA actual |
| **Tu EA de trading** | Sigue igual, sin cambios | Debes editar y recompilar tu EA |
| **Tiempo real** | Cada 2 segundos | Instantáneo al cerrar trade |
| **Historial** | Sí (365 días) | Depende de lo que programes |
| **Dificultad** | Fácil (3 comandos) | Media (programar MQL5) |
| **Mejor si…** | Tu EA es de terceros / no tienes código | Tú escribiste o puedes modificar el EA |

### Recomendación

- **EA comercial o sin código** → **Opción 1 (Python)** ✅
- **EA propio que puedes editar** → **Opción 2 (include `.mqh`)** ✅

---

## Opción 1 — Python (recomendada si no puedes editar tu EA)

No usa Expert Advisor. Lee MT5 desde fuera con la API oficial de MetaQuotes.

### Terminal 1 — puente
```powershell
cd path\to\trading-journal
npm run bridge
```

### Terminal 2 — sync Python
```powershell
pip install -r bridge-python/requirements.txt
python bridge-python/mt5_sync.py
```

### Terminal 3 — app
```powershell
npm run dev
```

**Requisitos:** MT5 abierto, cuenta conectada, mismo PC.

---

## Opción 2 — Añadir al EA que ya usas

Archivo: `mt5/TradingJournalBridge.mqh`

En tu EA:

```mql5
#include <TradingJournalBridge.mqh>

int OnInit() {
   TJ_SendHeartbeat();
   return INIT_SUCCEEDED;
}

void OnTradeTransaction(const MqlTradeTransaction& trans, ...) {
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
      TJ_OnDealAdded(trans.deal);
}
```

WebRequest: añade `http://127.0.0.1:3847` en opciones de MT5.

---

## Importar Excel sigue funcionando

Aunque uses Python o tu EA, puedes importar tu `ReportHistory-XXXXXX.xlsx` de MT5 cuando quieras.
