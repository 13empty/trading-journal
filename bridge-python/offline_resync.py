"""
Resync MT5 -> bridge-state.json SIN puente HTTP ni app abierta.

  set TJ_BRIDGE_DIR=%APPDATA%\\trading-journal\\bridge-data
  set TJ_MT5_SERVER_OFFSET_HOURS=6
  py -3 bridge-python/offline_resync.py
"""
from __future__ import annotations

import json
import os
import re
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except OSError:
        pass

try:
    import requests
except ImportError:
    requests = None  # type: ignore

try:
    import MetaTrader5 as mt5
except ImportError:
    print("Instala: pip install MetaTrader5")
    raise

from mt5_sync import (  # noqa: E402
    HISTORY_DAYS,
    build_position_trade,
    connect_mt5,
    fetch_balance_deals,
    group_closed_positions,
    history_deals_range,
    balance_movement_from_deal,
    get_open_positions_payload,
    start_of_today,
)


def bridge_data_dir() -> Path:
    env = os.getenv("TJ_BRIDGE_DIR")
    if env:
        return Path(env)
    appdata = os.getenv("APPDATA") or os.path.expanduser("~")
    return Path(appdata) / "trading-journal" / "bridge-data"


def cash_dedupe_key(movement: dict, ticket: int | None = None) -> str:
    notes = movement.get("notes") or ""
    mt5_m = re.search(r"MT5\s*#(\d+)", notes, re.I)
    if mt5_m:
        return f"ticket:{mt5_m.group(1)}"
    autotrf = re.search(r"AutoTrf\s+(\d+)", notes, re.I)
    if autotrf:
        return f"autotrf:{autotrf.group(1)}"
    if ticket:
        return f"ticket:{ticket}"
    return f"sig:{movement.get('date')}|{movement.get('category')}|{movement.get('amount')}|{notes}"


def position_to_trade(p: dict) -> dict:
    side_raw = str(p.get("side", "")).lower()
    side = "short" if side_raw in ("sell", "short") else "long"
    pid = str(p["id"])
    close_date = p.get("closeDate") or str(p.get("closeTime", ""))[:10]
    return {
        "id": str(uuid.uuid4()),
        "date": close_date,
        "symbol": str(p.get("symbol", "")).upper(),
        "side": side,
        "quantity": float(p.get("volume") or 1),
        "entryPrice": float(p.get("openPrice") or 0),
        "exitPrice": float(p.get("closePrice") or 0),
        "pnl": float(p.get("profit") or 0),
        "fees": abs(float(p.get("commission") or 0)) + abs(float(p.get("swap") or 0)),
        "notes": f"MT5 #{pid}",
        "positionId": pid,
    }


def upsert_trade(trades: list[dict], trade: dict) -> list[dict]:
    key = trade.get("positionId")
    if not key:
        return [trade, *trades]
    for i, t in enumerate(trades):
        if t.get("positionId") == key:
            trade["id"] = t.get("id") or trade["id"]
            trades[i] = trade
            return trades
    return [trade, *trades]


def notify_bridge_reload() -> bool:
    if requests is None:
        return False
    try:
        r = requests.post("http://127.0.0.1:3847/api/reload", timeout=10)
        return r.status_code == 200
    except requests.RequestException:
        return False


def run_offline_resync() -> bool:
    data_dir = bridge_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    state_file = data_dir / "bridge-state.json"

    state: dict = {}
    if state_file.exists():
        try:
            state = json.loads(state_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            state = {}

    print(f"Destino: {state_file}", flush=True)
    print("Conectando a MetaTrader 5...", flush=True)
    if not connect_mt5():
        print("No se pudo conectar a MT5. Abre MT5 e inicia sesion.", flush=True)
        return False

    acc = mt5.account_info()
    if acc:
        print(f"Cuenta {acc.login} | saldo {acc.balance:.2f}", flush=True)

    to_date = datetime.now()
    from_date = to_date - timedelta(days=HISTORY_DAYS)
    deals, _ = history_deals_range(from_date, to_date)
    if deals is None:
        print("history_deals_get:", mt5.last_error(), flush=True)
        mt5.shutdown()
        return False

    existing = state.get("trades") or []
    manual_only = [t for t in existing if not t.get("positionId")]
    trades = list(manual_only)

    by_pos = group_closed_positions(deals)
    to_fetch = datetime.now() + timedelta(days=1)
    today = start_of_today()
    extra_deals: list[Any] = []
    for w_from in (today - timedelta(days=1), today, datetime.now() - timedelta(hours=6)):
        chunk = mt5.history_deals_get(w_from, to_fetch)
        if chunk:
            extra_deals.extend(chunk)
    if extra_deals:
        for pid, group in group_closed_positions(extra_deals).items():
            if pid not in by_pos:
                by_pos[pid] = group
            else:
                known = {int(x.ticket) for x in by_pos[pid]}
                for d in group:
                    if int(d.ticket) not in known:
                        by_pos[pid].append(d)

    for pid, group in by_pos.items():
        if not any(x.entry == mt5.DEAL_ENTRY_OUT for x in group):
            continue
        built = build_position_trade(pid, group)
        if built:
            trades = upsert_trade(trades, position_to_trade(built))

    trades.sort(key=lambda t: t.get("date", ""), reverse=True)

    account_id = acc.login if acc else 0
    cash_map: dict[str, dict] = {}
    for d in fetch_balance_deals():
        m = balance_movement_from_deal(d, account_id)
        if not m:
            continue
        movement = {
            "id": str(uuid.uuid4()),
            "date": m["date"],
            "type": m["type"],
            "category": m["category"],
            "amount": m["amount"],
            "notes": m["notes"],
        }
        key = cash_dedupe_key(movement, m.get("ticket"))
        prev = cash_map.get(key)
        if prev:
            movement["id"] = prev.get("id") or movement["id"]
        cash_map[key] = movement

    cash = sorted(cash_map.values(), key=lambda c: c.get("date", ""), reverse=True)
    open_map = {str(p["id"]): p for p in get_open_positions_payload()}

    state.update(
        {
            "lastSeen": int(datetime.now().timestamp() * 1000),
            "account": str(account_id),
            "server": acc.server if acc else state.get("server"),
            "balance": float(acc.balance) if acc else state.get("balance"),
            "equity": float(acc.equity) if acc else state.get("equity"),
            "trades": trades,
            "cashMovements": cash,
            "openPositions": open_map,
        }
    )

    state_file.write_text(json.dumps(state, indent=2), encoding="utf-8")
    today = datetime.now().strftime("%Y-%m-%d")
    today_trades = sum(1 for t in trades if str(t.get("date", ""))[:10] == today)
    today_cash = sum(
        1
        for c in cash
        if str(c.get("date", ""))[:10] == today
        and c.get("category") in ("withdraw", "transfer_out", "fee")
    )
    print(
        f"OK: {len(trades)} trades, {len(cash)} movimientos cash "
        f"(hoy: {today_trades} trades, {today_cash} salidas)",
        flush=True,
    )
    if notify_bridge_reload():
        print("Puente en memoria recargado (app abierta).", flush=True)
    else:
        print(
            "Si la app estaba abierta: cierrala y vuelve a abrir, o pulsa Sincronizar ahora.",
            flush=True,
        )
    mt5.shutdown()
    return True


if __name__ == "__main__":
    ok = run_offline_resync()
    sys.exit(0 if ok else 1)
