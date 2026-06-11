# Publicar en GitHub / Publish to GitHub

## Español

El repositorio local ya tiene commits ordenados en `main`:

1. `docs: add bilingual project documentation (ES/EN)`
2. `feat: trading journal v1.2.0 with MT5 sync and Electron desktop`

### Pasos (una sola vez)

```powershell
cd path\to\trading-journal

# 1. Iniciar sesión en GitHub (abre el navegador)
gh auth login

# 2. Crear repo remoto y subir
gh repo create trading-journal --public --source=. --remote=origin --push --description "Trading journal desktop app with MetaTrader 5 sync"
```

Si el nombre `trading-journal` ya existe en tu cuenta, usa otro:

```powershell
gh repo create mi-trading-journal --public --source=. --remote=origin --push
```

### Repo privado

Añade `--private` en lugar de `--public`.

### Antes de publicar

Revisa [PRIVACY.md](PRIVACY.md) — no subas `bridge-state.json`, Excel de MT5 ni el `.exe` compilado con datos locales.

---

## English

The local repo has two ordered commits on `main` (see above).

### Steps (one-time)

```powershell
cd path\to\trading-journal

# 1. Log in to GitHub (opens browser)
gh auth login

# 2. Create remote repo and push
gh repo create trading-journal --public --source=. --remote=origin --push --description "Trading journal desktop app with MetaTrader 5 sync"
```

Use a different name if `trading-journal` is taken. Add `--private` for a private repository.

See [PRIVACY.md](PRIVACY.md) before publishing.
