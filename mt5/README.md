# Conectar MT5 — guía rápida

## ¿Qué archivos copiar?

| ¿Copiar a MT5? | Archivo / carpeta |
|----------------|-------------------|
| **SÍ — solo 1 archivo** | `TradingJournalBridge.mq5` |
| **NO** | Carpeta `bridge/` |
| **NO** | Carpeta `src/` |
| **NO** | Todo el proyecto `trading-journal` |

El puente (`bridge/server.mjs`) corre desde la terminal en tu PC, **no** va dentro de MT5.

---

## Instalación automática (Windows)

```powershell
cd path\to\trading-journal
.\install-mt5.ps1
```

Luego **compilar en MetaEditor** (paso obligatorio abajo).

---

## Instalación manual

1. MT5 → **Archivo → Abrir carpeta de datos**
2. Entra en `MQL5\Experts\`
3. Crea carpeta `TradingJournalBridge`
4. Copia **solo** `TradingJournalBridge.mq5` ahí

Ruta típica IC Markets:

```
C:\Users\TU_USUARIO\AppData\Roaming\MetaQuotes\Terminal\XXXX\MQL5\Experts\TradingJournalBridge\TradingJournalBridge.mq5
```

---

## Compilar (si no ves el EA en el gráfico)

Sin compilar, **no aparece** en la lista o no funciona.

1. En MT5 pulsa **F4** (MetaEditor)
2. Panel izquierdo: **Experts → TradingJournalBridge → TradingJournalBridge.mq5**
3. Doble clic para abrir
4. Pulsa **F7** (Compilar)
5. Abajo debe decir: **`0 error(s), 0 warning(s)`**
6. Debe crearse `TradingJournalBridge.ex5` en la misma carpeta

Cierra MetaEditor y en MT5 en el **Navegador** (Ctrl+N):

**Asesores Expertos → TradingJournalBridge → TradingJournalBridge**

Arrastra al gráfico.

---

## Permitir WebRequest

1. **Herramientas → Opciones → Asesores Expertos**
2. ✅ Permitir WebRequest para URL listadas
3. Añadir: `http://127.0.0.1:3847`
4. ✅ Permitir trading algorítmico
5. Aceptar

---

## Arrancar la app

Terminal 1:

```powershell
cd path\to\trading-journal
npm run bridge
```

Terminal 2:

```powershell
npm run dev
```

O todo junto: `npm run dev:all`

Abre http://localhost:5173 — el panel **MetaTrader 5** debe ponerse verde.

---

## Comprobar que funciona

En MT5 pestaña **Expertos** (abajo) debe aparecer:

```
Trading Journal Bridge activo → http://127.0.0.1:3847/api/event
```

Si dice **Error 4014** → falta la URL en WebRequest.

Si dice **WebRequest falló** → ejecuta `npm run bridge` primero.
