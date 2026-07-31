# Changelog / Registro de cambios

All notable changes to this project are documented here.  
Todos los cambios importantes del proyecto se documentan aquí.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.2.1] — 2026-07-31

### Added / Añadido

- **ES:** Metas de beneficio (día / semana / mes) con barras de progreso y estado “Alcanzada”  
  **EN:** Profit goals (day / week / month) with progress bars and “Reached” state
- **ES:** Reglas de trading configurables con alertas PARAR y banner que indica qué regla se activó  
  **EN:** Configurable trading rules with STOP alerts and banner showing which rule fired
- **ES:** Consejo de riesgo semanal en Analíticas (promedio, tendencia, sugerencia subir/mantener/bajar)  
  **EN:** Weekly risk advice in Analytics (average, trend, increase/hold/reduce suggestion)
- **ES:** Resumen últimos 14 días en pestaña Día (total, %, prom./día, días +/−, mejor día)  
  **EN:** Last-14-days summary on Day tab (total, %, avg/day, win/loss days, best day)
- **ES:** Notas del día en modal; chips de estado compactos; Insights colapsables  
  **EN:** Day notes modal; compact status chips; collapsible Insights section
- **ES:** Paneles en Analíticas: finanzas de cuenta, resumen por período, búsqueda global  
  **EN:** Analytics panels: account finance, period summary, global trade search

### Changed / Cambiado

- **ES:** Pestaña Día más limpia: hero primero, sin curva grande; finanzas/búsqueda en Analíticas  
  **EN:** Cleaner Day tab: hero first, no large chart; finance/search moved to Analytics
- **ES:** Sidebar: calendario compacto, leyenda colapsable, panel MT5 reducido, botones en grid  
  **EN:** Sidebar: compact calendar, collapsible legend, slimmer MT5 panel, grid action buttons
- **ES:** Meses en español/portugués con minúscula inicial en vistas mensuales  
  **EN:** Spanish/Portuguese month names with lowercase in monthly views

### Fixed / Corregido

- **ES:** Alerta “Rule Breached” desaparece al recuperar límites o cambiar configuración  
  **EN:** “Rule Breached” alert clears when limits recover or settings change
- **ES:** Sync MT5 ya no entra en bucles; splash de carga no se queda colgado  
  **EN:** MT5 sync no longer loops; loading splash no longer stuck

---

## [1.2.0] — 2026-06-03

### Added / Añadido

- **ES:** Sincronización MT5 en vivo (trades, saldo, posiciones abiertas)  
  **EN:** Live MT5 sync (trades, balance, open positions)
- **ES:** App Electron portable + scripts `Crear-Ejecutable.bat` / instalador NSIS  
  **EN:** Portable Electron app + `Crear-Ejecutable.bat` / NSIS installer scripts
- **ES:** Calendario con PnL en $, % o ambos; totales semanales  
  **EN:** Calendar with $, % or both PnL display; weekly totals
- **ES:** Vista día (hero PnL, curva equity estilo premium, notas, KPIs)  
  **EN:** Day view (PnL hero, premium equity curve, notes, KPIs)
- **ES:** Panel analíticas, proyección, búsqueda global, resumen de sesión  
  **EN:** Analytics panel, projection, global search, session summary
- **ES:** Asistente de broker, wizard MT5, resync completo  
  **EN:** Broker wizard, MT5 setup, full history resync
- **ES:** i18n: español, inglés, portugués  
  **EN:** i18n: Spanish, English, Portuguese

### Changed / Cambiado

- **ES:** PnL del calendario alineado con columna Profit de MT5 (bruto)  
  **EN:** Calendar PnL matches MT5 Profit column (gross)
- **ES:** Curva de equity basada en PnL acumulado (sin saltos por depósitos)  
  **EN:** Equity curve uses cumulative trading PnL (no deposit spikes)
- **ES:** Scrollbars y UI del sidebar refinados  
  **EN:** Refined sidebar scrollbars and UI polish

### Fixed / Corregido

- **ES:** Selección de fecha en calendario ya no vuelve forzada a “hoy”  
  **EN:** Calendar date selection no longer forced back to today
- **ES:** Alineación de celdas vacías en meses con distinta longitud  
  **EN:** Empty calendar cell alignment for variable month lengths

---

## [1.0.0] — Initial release

- **ES:** Journal básico con importación Excel y vistas por período  
  **EN:** Basic journal with Excel import and period views
