# Changelog / Registro de cambios

All notable changes to this project are documented here.  
Todos los cambios importantes del proyecto se documentan aquí.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.2.7] — 2026-08-20

### Added / Añadido

- **ES:** Layout home tipo mockup: rail de navegación, calendario + stats, panel derecho (Diario del día, Metas, Reglas)  
  **EN:** Mockup-style home layout: nav rail, calendar + stats, right panel (day diary, goals, rules)
- **ES:** Ventanas secundarias Electron para Diario, Analytics, Sync, Opciones y Proyección  
  **EN:** Secondary Electron windows for Diary, Analytics, Sync, Options and Projection
- **ES:** Header del calendario horizontal (mes + flechas, PnL mensual, toggles `$` / `%` / `$+%`)  
  **EN:** Horizontal calendar header (month + arrows, monthly PnL, `$` / `%` / `$+%` toggles)
- **ES:** Celdas del calendario cuadradas con glow de PnL alineado al card del día  
  **EN:** Square calendar cells with PnL glow matched to the day card
- **ES:** Sincronización de tema/ajustes entre ventanas (storage + BroadcastChannel)  
  **EN:** Theme/settings sync across windows (storage + BroadcastChannel)

### Changed / Cambiado

- **ES:** Home estático sin curva de equity ni Apariencia en la columna derecha  
  **EN:** Static home without equity curve or Appearance in the right column
- **ES:** Metas y reglas viven en el panel derecho del home (dock solo en vistas secundarias)  
  **EN:** Goals and rules live in the home right panel (dock only on secondary views)

---

## [1.2.6] — 2026-08-13

### Added / Añadido

- **ES:** Revisión visual del trade (Journal): setup, SL/TP, resultado, notas y capturas BEFORE / AFTER / CLOSE  
  **EN:** Visual trade review (Journal): setup, SL/TP, result, notes and BEFORE / AFTER / CLOSE screenshots
- **ES:** Mistake tracker + Top 5 errores en Analytics  
  **EN:** Mistake tracker + Top 5 mistakes in Analytics
- **ES:** Setup Analytics — setup, timeframe, sesión, calidad A/B/C; combos con win rate y expectancy en R  
  **EN:** Setup Analytics — setup, timeframe, session, quality A/B/C; combos with win rate and R expectancy
- **ES:** SL, TP, riesgo $, MFE/MAE y sesión se sincronizan desde MT5 (override manual si quieres)  
  **EN:** SL, TP, risk $, MFE/MAE and session sync from MT5 (manual override still available)
- **ES:** Tema Sangre (crimson) en packs de apariencia  
  **EN:** Crimson appearance pack

### Fixed / Corregido

- **ES:** Inputs numéricos ya no “tragan” decimales; Avg R firmado; sesión y % resultado más correctos  
  **EN:** Number inputs keep decimals; signed Avg R; session and result % fixes

---

## [1.2.5] — 2026-08-13

### Added / Añadido

- **ES:** Packs de apariencia (Medianoche, Grafito, Cyber, Pizarra, Light) — acento incluido en cada pack  
  **EN:** Appearance packs (Midnight, Graphite, Cyber, Slate, Light) — accent baked into each pack
- **ES:** Tema Cyber futurista con glow  
  **EN:** Futuristic Cyber theme with glow accents
- **ES:** Auto-cálculo de metas de ganancia al editar una  
  **EN:** Auto-calculate related profit goals when editing one

### Fixed / Corregido

- **ES:** Arrastrar la ventana en Windows (zona drag del titlebar oculto)  
  **EN:** Drag the Windows frameless window (hidden titlebar drag region)
- **ES:** Titlebar overlay sincroniza colores con el tema  
  **EN:** Titlebar overlay colors sync with the active theme

---

## [1.2.4] — 2026-08-10

### Fixed / Corregido

- **ES:** Auto-cierre espera resultado real de MT5 y reintenta si falla (antes marcaba el día como hecho al encolar)  
  **EN:** Auto-close waits for real MT5 result and retries on failure (previously marked the day done on queue only)
- **ES:** Comando bridge `close_all` se restaura al reiniciar y solo se limpia tras el resultado  
  **EN:** Bridge `close_all` command restored on restart and cleared only after result
- **ES:** Metas de ganancia usan PnL cerrado (sin flotante) — evita spam de “meta alcanzada”  
  **EN:** Profit goals use closed PnL (no floating) — stops “goal reached” notify spam
- **ES:** Banner de límite de pérdida en Analytics respeta el interruptor de reglas  
  **EN:** Analytics loss-limit banner respects trading-rules master switch
- **ES:** Riesgo sugerido ya no puede redondear a 0% por el tope de límite diario  
  **EN:** Suggested risk no longer rounds to 0% from daily-limit cap

---

## [1.2.3] — 2026-08-03

### Added / Añadido

- **ES:** Pestaña **Opciones** consolidada (idioma, color, metas, reglas, notificaciones, sync, backup)  
  **EN:** Consolidated **Options** tab (language, color, goals, rules, notifications, sync, backup)
- **ES:** Selector de color de acento (azul, turquesa, verde, ámbar, rosa)  
  **EN:** Accent color picker (blue, teal, green, amber, rose)
- **ES:** Opción para **cerrar todas las posiciones** si se viola una regla del día (pérdida diaria o máx. trades)  
  **EN:** Option to **close all positions** when a day rule is breached (daily loss or max trades)
- **ES:** Bridge + sync Python: comando `close_all` hacia MT5  
  **EN:** Bridge + Python sync: `close_all` command to MT5

### Changed / Cambiado

- **ES:** Edición de metas movida de Analytics a Opciones (Analytics solo muestra progreso)  
  **EN:** Goal editing moved from Analytics to Options (Analytics shows progress only)
- **ES:** Nav “Ajustes” renombrado a “Opciones”  
  **EN:** Nav “Settings” renamed to “Options”

---

## [1.2.2] — 2026-08-01

### Added / Añadido

- **ES:** Notificaciones de escritorio (reglas, meta alcanzada, MT5 desconectado)  
  **EN:** Desktop notifications (rules, goal reached, MT5 disconnect)
- **ES:** Barra de journal en pestaña Día (setup %, riesgo %, R promedio)  
  **EN:** Trade journal stats bar on Day tab (setup %, risk %, avg R)
- **ES:** Resumen semanal en sidebar con notas por semana  
  **EN:** Weekly summary modal from sidebar with per-week notes
- **ES:** Toggle para mostrar/ocultar aviso de meta alcanzada (Ajustes y Analíticas)  
  **EN:** Toggle to show/hide profit-goal-reached messages (Settings and Analytics)
- **ES:** Panel de riesgo: rendimiento diario (hoy, promedio, semana en curso)  
  **EN:** Risk panel: daily performance (today, average, week-to-date)
- **ES:** Riesgo sugerido anclado al saldo real (1% conservador, cálculo explícito $)  
  **EN:** Balance-based suggested risk (1% conservative default, explicit $ formula)

### Changed / Cambiado

- **ES:** Riesgo actual estimado con sesión de hoy, límite diario y ganancias/R:R  
  **EN:** Current risk estimate uses today’s session, daily limit, and wins/R:R
- **ES:** Recomendación “proteger ganancias” separada del tamaño por trade  
  **EN:** “Protect gains” advice decoupled from per-trade sizing
- **ES:** Saldo MT5 en vivo usado en Analíticas para montos de riesgo  
  **EN:** Live MT5 balance used in Analytics for risk dollar amounts

### Fixed / Corregido

- **ES:** Monto sugerido ($) ahora coincide con saldo × % (sin cifras incoherentes)  
  **EN:** Suggested $ amount now matches balance × % (no mismatched figures)
- **ES:** Script `build-ejecutable.ps1` evita bloqueo por `app.asar` en release  
  **EN:** `build-ejecutable.ps1` avoids locked `app.asar` during portable build

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
