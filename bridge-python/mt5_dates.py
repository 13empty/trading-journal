"""Fechas MT5: dia calendario como en la pestaña Historial del terminal."""
from __future__ import annotations

import os
import re
from datetime import datetime, timedelta


def broker_offset_hours() -> int:
    """
    Horas que se suman al timestamp del deal (hora local del PC) para
    coincidir con la fecha/hora que muestra MT5 en Historial.
    Si el calendario va un dia atrasado, sube este valor (ej. 6 en JST + IC).
    """
    try:
        return int(os.getenv("TJ_MT5_SERVER_OFFSET_HOURS", "6"))
    except ValueError:
        return 6


def mt5_datetime_from_unix(t: int | float) -> datetime:
    return datetime.fromtimestamp(t) + timedelta(hours=broker_offset_hours())


def deal_time_iso(t: int | float) -> str:
    return mt5_datetime_from_unix(t).strftime("%Y-%m-%d %H:%M:%S")


def deal_date_only(t: int | float) -> str:
    return mt5_datetime_from_unix(t).strftime("%Y-%m-%d")


def day_from_mt5_display(value: str) -> str | None:
    """Fecha como en Historial MT5: 2026.06.04 o 2026-06-04."""
    s = (value or "").strip()
    m = re.match(r"^(\d{4})[.\-](\d{2})[.\-](\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None
