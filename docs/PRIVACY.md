# Privacidad antes de publicar / Privacy before sharing

## Español

**No subas ni compartas estos archivos** (contienen tu cuenta, trades y saldos):

| Archivo / carpeta | Motivo |
|-------------------|--------|
| `bridge/bridge-state.json` | Historial MT5, cuenta, servidor, saldo |
| `release/` | Ejecutable compilado en tu PC (puede incluir rutas locales) |
| `build/mt5-sync.exe`, `build/pyinstaller-*` | Artefactos de compilación con rutas de tu máquina |
| `*.xlsx`, `ReportHistory*` | Exportaciones de MT5 |
| `.env`, `*.pem` | Claves o configuración local |

Los datos del journal en **Electron** viven en `%APPDATA%\Trading Journal\` (no en el repo).

### Antes de `git push`

```powershell
# Buscar cuenta MT5, rutas de usuario o emails en el código
git grep -E "[0-9]{6,}" -- "*.ps1" "*.md" "*.ts" "*.tsx"  # revisar números largos (cuentas MT5)
git grep -i "C:\\Users\\" -- "*.md" "*.ps1" "*.ts" "*.tsx" || echo "OK: sin rutas personales"
git ls-files bridge/bridge-state.json  # debe estar vacío (no trackeado)
```

Si ya commiteaste datos personales **sin haber hecho push**, puedes reescribir el historial:

```powershell
git add -A
git commit -m "chore: remove personal paths and sample account from docs"
# O, para historial limpio desde cero: git reset --soft <primer-commit> y recommit
```

**Vuelve a compilar** `Trading-Journal.exe` después de limpiar: el build anterior pudo empaquetar `bridge-state.json`.

---

## English

Do **not** commit or share:

- `bridge/bridge-state.json` — MT5 sync state (account, trades, balance)
- `release/`, local build artifacts, MT5 Excel exports
- `.env` and key files

Electron user data is stored under `%APPDATA%\Trading Journal\`, not in the repository.

Run the `git grep` checks above before pushing. Rebuild the portable `.exe` after cleanup.
