"""
Sincroniza MT5 con el Trading Journal SIN usar un Expert Advisor.
Requisitos: MT5 abierto, sesion iniciada, Python 3.10+

  pip install -r bridge-python/requirements.txt
  python bridge-python/mt5_sync.py
"""
from __future__ import annotations

import sys
import time
from datetime import datetime, timedelta
from typing import Any

import requests

# Windows (cp932, etc.): evitar crash al imprimir
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except OSError:
        pass

try:
    import MetaTrader5 as mt5
except ImportError:
    print("Instala: pip install MetaTrader5 requests")
    raise

BRIDGE_URL = "http://127.0.0.1:3847/api/event"
BRIDGE_BASE = "http://127.0.0.1:3847"
POLL_SEC = 1
HISTORY_DAYS = 365
FULL_SYNC_SEC = 60
RECENT_RESYNC_SEC = 15
RECENT_RESYNC_DAYS = 21
RECENT_LOOKBACK_SEC = 120


def start_of_today() -> datetime:
    now = datetime.now()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)

seen_position_ids: set[int] = set()
seen_balance_keys: set[str] = set()


def post(event: dict[str, Any]) -> bool:
    try:
        r = requests.post(BRIDGE_URL, json=event, timeout=10)
        return r.status_code == 200
    except requests.RequestException as e:
        print(f"Puente no disponible: {e}  (ejecuta: npm run bridge)")
        return False


from mt5_dates import deal_date_only, deal_time_iso  # noqa: E402


def history_deals_range(from_date: datetime, to_date: datetime) -> tuple:
    """
    MT5 devuelve historial incompleto segun el rango:
    - rangos muy cortos: faltan deals OUT
    - rangos muy largos: a veces faltan los mas recientes
    Combinamos varias ventanas y deduplicamos por ticket.
    """
    to_fetch = to_date + timedelta(days=1)
    year = datetime.now().year
    today = start_of_today()
    # Ventanas amplias primero; las cortas al final (sobrescriben con cierres mas recientes)
    windows = [
        datetime.now() - timedelta(days=HISTORY_DAYS),
        min(from_date, datetime.now() - timedelta(days=60)),
        datetime.now() - timedelta(days=21),
        datetime(year, 3, 1),
        datetime(year, 5, 1),
        datetime(year, 6, 1),
        today - timedelta(days=2),
        today - timedelta(days=1),
        today,
        datetime.now() - timedelta(hours=12),
        datetime.now() - timedelta(hours=3),
    ]
    by_ticket: dict[int, Any] = {}
    for w_from in windows:
        chunk = mt5.history_deals_get(w_from, to_fetch)
        if not chunk:
            continue
        for d in chunk:
            by_ticket[int(d.ticket)] = d
    deals = list(by_ticket.values()) if by_ticket else None
    safe_from = min(windows)
    return deals, safe_from


def fetch_position_sl_tp(position_id: int) -> tuple[float, float]:
    """Last non-zero SL/TP from orders linked to the position."""
    orders = mt5.history_orders_get(position=position_id)
    if not orders:
        return 0.0, 0.0
    sl = 0.0
    tp = 0.0
    for o in orders:
        try:
            if float(o.sl) > 0:
                sl = float(o.sl)
            if float(o.tp) > 0:
                tp = float(o.tp)
        except (TypeError, ValueError, AttributeError):
            continue
    return sl, tp


def symbol_tick_params(symbol: str) -> tuple[float, float] | None:
    info = mt5.symbol_info(symbol)
    if info is None:
        mt5.symbol_select(symbol, True)
        info = mt5.symbol_info(symbol)
    if info is None:
        return None
    tick_size = float(info.trade_tick_size or 0)
    tick_value = float(info.trade_tick_value or 0)
    if tick_size <= 0 or tick_value <= 0:
        return None
    return tick_size, tick_value


def compute_risk_amount(
    entry: float,
    sl: float,
    volume: float,
    tick_size: float,
    tick_value: float,
) -> float | None:
    if sl <= 0 or entry <= 0 or volume <= 0 or tick_size <= 0 or tick_value <= 0:
        return None
    dist = abs(entry - sl)
    if dist <= 0:
        return None
    return round((dist / tick_size) * tick_value * volume, 2)


def compute_mfe_mae(
    symbol: str,
    side: str,
    entry: float,
    sl: float,
    open_time: int,
    close_time: int,
) -> dict[str, float | None]:
    """
    MFE/MAE from M1 (or M5) OHLC between open and close.
    maeR/mfeR need SL distance; price extremes still returned when possible.
    """
    empty = {
        "mfePrice": None,
        "maePrice": None,
        "mfeR": None,
        "maeR": None,
    }
    if not symbol or entry <= 0 or open_time <= 0 or close_time <= open_time:
        return empty

    # Skip very old closes (full-year sync would be too slow)
    if time.time() - close_time > 60 * 60 * 24 * 60:
        return empty

    hold_sec = close_time - open_time
    # Skip extreme holds (rates pull can be huge / slow)
    if hold_sec > 60 * 60 * 24 * 14:
        return empty

    open_dt = datetime.fromtimestamp(open_time)
    close_dt = datetime.fromtimestamp(close_time)
    tf = mt5.TIMEFRAME_M1 if hold_sec <= 60 * 60 * 72 else mt5.TIMEFRAME_M5
    rates = mt5.copy_rates_range(symbol, tf, open_dt, close_dt)
    if rates is None or len(rates) == 0:
        mt5.symbol_select(symbol, True)
        rates = mt5.copy_rates_range(symbol, tf, open_dt, close_dt)
    if rates is None or len(rates) == 0:
        return empty

    try:
        hi = float(max(rates["high"]))
        lo = float(min(rates["low"]))
    except (TypeError, ValueError, KeyError):
        return empty
    is_buy = side == "buy"

    if is_buy:
        mfe_price = hi
        mae_price = lo
        fav = mfe_price - entry
        adv = entry - mae_price
    else:
        mfe_price = lo
        mae_price = hi
        fav = entry - mfe_price
        adv = mae_price - entry

    out: dict[str, float | None] = {
        "mfePrice": round(mfe_price, 5),
        "maePrice": round(mae_price, 5),
        "mfeR": None,
        "maeR": None,
    }
    risk_dist = abs(entry - sl) if sl > 0 else 0.0
    if risk_dist > 0:
        out["mfeR"] = round(max(fav, 0.0) / risk_dist, 3)
        out["maeR"] = round(max(adv, 0.0) / risk_dist, 3)
    return out


def build_position_trade(position_id: int, deals: list) -> dict | None:
    symbol = ""
    open_price = 0.0
    close_price = 0.0
    volume = 0.0
    profit = 0.0
    commission = 0.0
    swap = 0.0
    open_time = 0
    close_time = 0
    side = "buy"

    for d in deals:
        if d.position_id != position_id:
            continue
        profit += d.profit
        commission += d.commission
        swap += d.swap
        symbol = d.symbol
        if d.entry == mt5.DEAL_ENTRY_IN:
            open_price = d.price
            volume = d.volume
            side = "sell" if d.type == mt5.DEAL_TYPE_SELL else "buy"
            open_time = int(d.time)
        if d.entry == mt5.DEAL_ENTRY_OUT:
            close_price = d.price
            close_time = int(d.time)

    if not symbol or close_time == 0:
        return None

    sl, tp = fetch_position_sl_tp(position_id)
    risk_amount = None
    tick = symbol_tick_params(symbol)
    if tick and sl > 0:
        risk_amount = compute_risk_amount(open_price, sl, volume, tick[0], tick[1])

    excursion = compute_mfe_mae(symbol, side, open_price, sl, open_time, close_time)

    trade: dict[str, Any] = {
        "id": position_id,
        "symbol": symbol,
        "side": side,
        "volume": volume,
        "openPrice": open_price,
        "closePrice": close_price,
        "profit": profit,
        "commission": commission,
        "swap": swap,
        "closeTime": deal_time_iso(close_time),
        "closeDate": deal_date_only(close_time),
    }
    if open_time > 0:
        trade["openTime"] = deal_time_iso(open_time)
    if sl > 0:
        trade["stopLoss"] = sl
    if tp > 0:
        trade["takeProfit"] = tp
    if risk_amount is not None and risk_amount > 0:
        trade["riskAmount"] = risk_amount
    if excursion["mfePrice"] is not None:
        trade["mfePrice"] = excursion["mfePrice"]
    if excursion["maePrice"] is not None:
        trade["maePrice"] = excursion["maePrice"]
    if excursion["mfeR"] is not None:
        trade["mfeR"] = excursion["mfeR"]
    if excursion["maeR"] is not None:
        trade["maeR"] = excursion["maeR"]
    return trade


def group_closed_positions(deals) -> dict[int, list]:
    by_pos: dict[int, list] = {}
    for d in deals:
        if d.type == mt5.DEAL_TYPE_BALANCE:
            continue
        if not d.symbol:
            continue
        pid = int(d.position_id)
        if pid not in by_pos:
            by_pos[pid] = []
        by_pos[pid].append(d)
    return by_pos


def send_position_closed(trade: dict) -> bool:
    acc = mt5.account_info()
    return post(
        {
            "type": "position_closed",
            "account": acc.login if acc else 0,
            "balance": acc.balance if acc else 0,
            "equity": acc.equity if acc else 0,
            "position": trade,
        }
    )


def sync_closed_positions(from_date: datetime, to_date: datetime, mark_seen: bool = True) -> int:
    deals, _ = history_deals_range(from_date, to_date)
    if deals is None:
        print("history_deals_get:", mt5.last_error())
        return 0

    by_pos = group_closed_positions(deals)
    positions = []
    for pid, group in by_pos.items():
        if not any(x.entry == mt5.DEAL_ENTRY_OUT for x in group):
            continue
        t = build_position_trade(pid, group)
        if t:
            positions.append(t)

    if not positions:
        return 0

    acc = mt5.account_info()
    ok = post(
        {
            "type": "history_sync",
            "account": acc.login if acc else 0,
            "balance": acc.balance if acc else 0,
            "equity": acc.equity if acc else 0,
            "positions": positions,
        }
    )
    if ok and mark_seen:
        for t in positions:
            seen_position_ids.add(int(t["id"]))
    return len(positions) if ok else 0


def sync_recent_closed_individual(days: int = RECENT_RESYNC_DAYS) -> int:
    """Re-envia cierres recientes uno a uno (no depende de seen ni de history_sync masivo)."""
    to_date = datetime.now()
    from_date = datetime.now() - timedelta(days=days)
    deals, _ = history_deals_range(from_date, to_date)
    if deals is None:
        return 0

    by_pos = group_closed_positions(deals)
    cutoff = datetime.now() - timedelta(days=days)
    today_key = start_of_today().strftime("%Y-%m-%d")
    sent = 0
    for pid, group in by_pos.items():
        if not any(x.entry == mt5.DEAL_ENTRY_OUT for x in group):
            continue
        trade = build_position_trade(pid, group)
        if not trade:
            continue
        try:
            close_dt = datetime.strptime(trade["closeTime"], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            close_dt = cutoff
        if close_dt < cutoff and trade.get("closeDate") != today_key:
            continue
        if send_position_closed(trade):
            seen_position_ids.add(pid)
            sent += 1
    return sent


def sync_today_closed() -> int:
    """Cierres de hoy/ayer: ventana corta porque MT5 a veces no los incluye en rangos largos."""
    to_fetch = datetime.now() + timedelta(days=1)
    today = start_of_today()
    by_ticket: dict[int, Any] = {}
    for w_from in (today - timedelta(days=1), today, datetime.now() - timedelta(hours=6)):
        chunk = mt5.history_deals_get(w_from, to_fetch)
        if not chunk:
            continue
        for d in chunk:
            by_ticket[int(d.ticket)] = d
    if not by_ticket:
        return 0

    today_key = today.strftime("%Y-%m-%d")
    yesterday_key = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    sent = 0
    for pid, group in group_closed_positions(list(by_ticket.values())).items():
        if not any(x.entry == mt5.DEAL_ENTRY_OUT for x in group):
            continue
        trade = build_position_trade(pid, group)
        if not trade:
            continue
        if trade.get("closeDate") not in (today_key, yesterday_key):
            continue
        if send_position_closed(trade):
            seen_position_ids.add(pid)
            sent += 1
            print(
                f"  + Cierre reciente: {trade['symbol']} {trade['profit']:.2f} "
                f"({trade['closeDate']} {trade['closeTime']})",
                flush=True,
            )
    return sent


def sync_new_trades() -> int:
    global seen_position_ids
    now = datetime.now()
    from_date = min(start_of_today(), now - timedelta(days=3))
    deals, _ = history_deals_range(from_date, now)
    if deals is None:
        return 0

    by_pos = group_closed_positions(deals)
    new_count = 0

    today_key = start_of_today().strftime("%Y-%m-%d")
    for pid, group in by_pos.items():
        if not any(x.entry == mt5.DEAL_ENTRY_OUT for x in group):
            continue
        trade = build_position_trade(pid, group)
        if not trade:
            continue
        is_today = trade.get("closeDate") == today_key
        if pid in seen_position_ids and not is_today:
            continue
        if send_position_closed(trade):
            seen_position_ids.add(pid)
            new_count += 1
            print(
                f"  + Trade nuevo: {trade['symbol']} PnL {trade['profit']:.2f} "
                f"({trade['closeDate']} {trade['closeTime']})",
                flush=True,
            )

    return new_count


_prev_open_ids: set[int] = set()


def sync_open_positions_snapshot() -> None:
    global _prev_open_ids
    positions = mt5.positions_get()
    if positions is None:
        return
    open_ids = {int(p.identifier) for p in positions}
    if not _prev_open_ids:
        _prev_open_ids = open_ids
        return
    if _prev_open_ids - open_ids:
        sync_new_trades()
    _prev_open_ids = open_ids


def balance_deal_key(d) -> str:
    return f"{d.ticket}|{d.time}|{d.profit}|{d.comment or ''}"


def classify_balance(
    comment: str, amount: float, account_id: str | int | None
) -> tuple[str, str] | None:
    if amount == 0:
        return None
    c = (comment or "").lower()
    acc = str(account_id) if account_id else ""

    if "divs" in c or "fee" in c or "comision" in c:
        return "fee", "withdraw"
    if "solidpayments" in c or "deposit" in c:
        return "deposit", "deposit"
    if "/to " in c or " to " in c:
        if acc and f"to {acc}" in c:
            return "transfer_in", "deposit"
        return "transfer_out", "withdraw"
    if "/fr " in c or "/from" in c or " fr " in c:
        return "transfer_in", "deposit"
    if amount >= 0:
        return "deposit", "deposit"
    return "withdraw", "withdraw"


def balance_movement_from_deal(d, account_id: str | int | None) -> dict | None:
    amount = float(d.profit)
    classified = classify_balance(d.comment or "", amount, account_id)
    if not classified:
        return None
    category, mov_type = classified
    return {
        "date": deal_date_only(d.time),
        "time": deal_time_iso(d.time),
        "type": mov_type,
        "category": category,
        "amount": abs(amount),
        "notes": f"MT5 #{d.ticket} {d.comment or ''}".strip(),
        "ticket": int(d.ticket),
    }


def sync_balance_deals(from_date: datetime, to_date: datetime, mark_seen: bool = True) -> int:
    deals, _ = history_deals_range(from_date, to_date)
    if deals is None:
        return 0

    acc = mt5.account_info()
    count = 0
    for d in deals:
        if d.type != mt5.DEAL_TYPE_BALANCE:
            continue
        key = balance_deal_key(d)
        if key in seen_balance_keys:
            continue
        if post(
            {
                "type": "balance",
                "account": acc.login if acc else 0,
                "balance": acc.balance if acc else 0,
                "equity": acc.equity if acc else 0,
                "amount": float(d.profit),
                "comment": d.comment or "",
                "time": deal_time_iso(d.time),
                "ticket": int(d.ticket),
            }
        ):
            if mark_seen:
                seen_balance_keys.add(key)
            count += 1
    return count


def fetch_balance_deals() -> list:
    """Solo deals BALANCE — ventanas separadas porque el historial de trades los omite."""
    to_fetch = datetime.now() + timedelta(days=1)
    year = datetime.now().year
    windows = [
        datetime.now() - timedelta(days=HISTORY_DAYS),
        datetime.now() - timedelta(days=90),
        datetime(year, 3, 1),
        datetime(year, 5, 1),
        datetime(year, 6, 1),
        start_of_today() - timedelta(days=3),
    ]
    by_ticket: dict[int, Any] = {}
    for w in windows:
        chunk = mt5.history_deals_get(w, to_fetch)
        if not chunk:
            continue
        for d in chunk:
            if d.type == mt5.DEAL_TYPE_BALANCE:
                by_ticket[int(d.ticket)] = d
    return list(by_ticket.values())


def sync_recent_balance_posts(days: int = 21) -> int:
    """Publica retiros/depositos recientes uno a uno (complementa balance_sync)."""
    acc = mt5.account_info()
    account_id = acc.login if acc else 0
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    sent = 0
    for d in fetch_balance_deals():
        if deal_date_only(d.time) < cutoff:
            continue
        key = balance_deal_key(d)
        if key in seen_balance_keys:
            continue
        if post(
            {
                "type": "balance",
                "account": account_id,
                "balance": acc.balance if acc else 0,
                "equity": acc.equity if acc else 0,
                "amount": float(d.profit),
                "comment": d.comment or "",
                "time": deal_time_iso(d.time),
                "ticket": int(d.ticket),
            }
        ):
            seen_balance_keys.add(key)
            sent += 1
    return sent


def sync_all_balance_movements() -> int:
    """Sincroniza TODOS los movimientos balance (depositos/retiros) del historial MT5."""
    deals = fetch_balance_deals()
    if not deals:
        return 0

    acc = mt5.account_info()
    account_id = acc.login if acc else 0
    movements: list[dict[str, Any]] = []
    for d in deals:
        m = balance_movement_from_deal(d, account_id)
        if m:
            movements.append(m)
            seen_balance_keys.add(balance_deal_key(d))

    if not movements:
        return 0

    ok = post(
        {
            "type": "balance_sync",
            "account": account_id,
            "balance": acc.balance if acc else 0,
            "equity": acc.equity if acc else 0,
            "movements": movements,
        }
    )
    return len(movements) if ok else 0


def get_open_positions_payload() -> list[dict[str, Any]]:
    positions = mt5.positions_get()
    if not positions:
        return []
    out: list[dict[str, Any]] = []
    for p in positions:
        out.append(
            {
                "id": int(p.identifier),
                "symbol": p.symbol,
                "side": "sell" if p.type == mt5.ORDER_TYPE_SELL else "buy",
                "volume": float(p.volume),
                "openPrice": float(p.price_open),
                "profit": float(p.profit),
                "swap": float(p.swap),
            }
        )
    return out


def heartbeat() -> None:
    acc = mt5.account_info()
    if not acc:
        return
    post(
        {
            "type": "heartbeat",
            "account": acc.login,
            "balance": acc.balance,
            "equity": acc.equity,
            "server": acc.server,
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "openPositions": get_open_positions_payload(),
        }
    )


def _filling_modes(symbol: str) -> list[int]:
    info = mt5.symbol_info(symbol)
    modes: list[int] = []
    if info is None:
        return [mt5.ORDER_FILLING_IOC, mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_RETURN]
    # Prefer IOC → FOK → RETURN depending on symbol flags
    filling = int(getattr(info, "filling_mode", 0) or 0)
    if filling & 1:
        modes.append(mt5.ORDER_FILLING_FOK)
    if filling & 2:
        modes.append(mt5.ORDER_FILLING_IOC)
    if filling & 4:
        modes.append(mt5.ORDER_FILLING_RETURN)
    return modes or [mt5.ORDER_FILLING_IOC, mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_RETURN]


def close_position(position: Any) -> tuple[bool, str]:
    """Close a single MT5 position with market deal (opposite side)."""
    symbol = position.symbol
    ticket = int(position.ticket)
    volume = float(position.volume)
    is_buy = position.type == mt5.POSITION_TYPE_BUY
    order_type = mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY

    if not mt5.symbol_select(symbol, True):
        return False, f"{ticket}: cannot select {symbol}"

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return False, f"{ticket}: no tick for {symbol}"

    price = float(tick.bid if is_buy else tick.ask)
    last_err = "unknown"
    for filling in _filling_modes(symbol):
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "position": ticket,
            "symbol": symbol,
            "volume": volume,
            "type": order_type,
            "price": price,
            "deviation": 30,
            "magic": 3847,
            "comment": "TJ day-rule close",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": filling,
        }
        result = mt5.order_send(request)
        if result is None:
            last_err = str(mt5.last_error())
            continue
        if result.retcode == mt5.TRADE_RETCODE_DONE:
            return True, f"{ticket}: closed"
        last_err = f"{result.retcode} {getattr(result, 'comment', '')}"
    return False, f"{ticket}: {last_err}"


def close_all_positions() -> dict[str, Any]:
    positions = mt5.positions_get()
    if not positions:
        return {"ok": True, "closed": 0, "failed": 0, "errors": []}

    closed = 0
    failed = 0
    errors: list[str] = []
    for p in positions:
        ok, msg = close_position(p)
        print(f"  close_all: {msg}", flush=True)
        if ok:
            closed += 1
        else:
            failed += 1
            errors.append(msg)
    return {"ok": failed == 0, "closed": closed, "failed": failed, "errors": errors}


def poll_bridge_commands() -> None:
    """Execute pending bridge commands (close_all from day rules)."""
    try:
        r = requests.get(f"{BRIDGE_BASE}/api/command", timeout=3)
        if r.status_code != 200:
            return
        cmd = r.json()
    except requests.RequestException:
        return

    action = cmd.get("action")
    if not action:
        return

    print(f"Comando bridge: {action} ({cmd.get('id')})", flush=True)
    if action == "close_all":
        result = close_all_positions()
        result["commandId"] = cmd.get("id")
        result["reason"] = cmd.get("reason")
        try:
            requests.post(
                f"{BRIDGE_BASE}/api/command/result",
                json=result,
                timeout=5,
            )
        except requests.RequestException as e:
            print(f"  No se pudo reportar resultado: {e}", flush=True)
        # Refresh open positions snapshot after closes
        sync_open_positions_snapshot()
        heartbeat()
    else:
        print(f"  Comando desconocido: {action}", flush=True)


def connect_mt5(max_wait_sec: int = 180) -> bool:
    print("Conectando a MetaTrader 5...", flush=True)
    deadline = time.time() + max_wait_sec
    while time.time() < deadline:
        if mt5.initialize():
            return True
        err = mt5.last_error()
        print(f"  Esperando MT5... {err}", flush=True)
        time.sleep(2)
    return False


def main() -> None:
    global seen_position_ids, seen_balance_keys

    print("Trading Journal - sync Python (tiempo real ~1s)", flush=True)
    print("MT5 debe estar abierto y con sesion iniciada.\n", flush=True)

    if not connect_mt5():
        print("No se pudo conectar a MT5. Abre MT5 e inicia sesion.", flush=True)
        sys.exit(1)

    acc = mt5.account_info()
    if acc:
        print(f"Cuenta {acc.login} | saldo {acc.balance:.2f}")

    to_date = datetime.now()
    from_date = to_date - timedelta(days=HISTORY_DAYS)
    n = sync_closed_positions(from_date, to_date, mark_seen=True)
    b = sync_all_balance_movements()
    print(f"Historial inicial: {n} trades cerrados, {b} movimientos de cuenta", flush=True)
    print("Vigilando cierres y saldo cada ~1s\n", flush=True)

    last_full = time.time()
    last_recent = 0.0

    try:
        while True:
            poll_bridge_commands()
            sync_open_positions_snapshot()
            sync_new_trades()
            if time.time() - last_recent > RECENT_RESYNC_SEC:
                t0 = sync_today_closed()
                n = sync_recent_closed_individual(RECENT_RESYNC_DAYS)
                if t0 > 0 or n > 0:
                    print(
                        f"  Re-sync reciente: hoy={t0} otros={n} cierres al puente",
                        flush=True,
                    )
                last_recent = time.time()
            heartbeat()
            if time.time() - last_full > FULL_SYNC_SEC:
                sync_closed_positions(
                    datetime.now() - timedelta(days=HISTORY_DAYS),
                    datetime.now(),
                    mark_seen=True,
                )
                sync_all_balance_movements()
                sync_recent_closed_individual(RECENT_RESYNC_DAYS)
                last_full = time.time()
            time.sleep(POLL_SEC)
    except KeyboardInterrupt:
        print("\nDetenido.")
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    main()
