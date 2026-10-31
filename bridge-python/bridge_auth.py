"""
Token for the local Trading Journal bridge.

The bridge writes a per-launch secret. This module sends it as X-TJ-Token.
Resolution order:
  1. TJ_BRIDGE_TOKEN
  2. TJ_BRIDGE_TOKEN_FILE
  3. TJ_BRIDGE_DIR/bridge-token
  4. <repo>/bridge/bridge-token (dev, not the frozen exe)
  5. %APPDATA%/trading-journal/bridge-data/bridge-token
  6. %APPDATA%/Trading Journal/bridge-data/bridge-token
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import requests

_active_token: str | None = None


def _add(tokens: list[str], value: str | None) -> None:
    text = (value or "").strip()
    if text and text not in tokens:
        tokens.append(text)


def token_candidates() -> list[str]:
    tokens: list[str] = []
    _add(tokens, os.getenv("TJ_BRIDGE_TOKEN"))

    paths: list[Path] = []
    file_env = os.getenv("TJ_BRIDGE_TOKEN_FILE")
    if file_env:
        paths.append(Path(file_env))
    dir_env = os.getenv("TJ_BRIDGE_DIR")
    if dir_env:
        paths.append(Path(dir_env) / "bridge-token")
    if not getattr(sys, "frozen", False):
        paths.append(Path(__file__).resolve().parent.parent / "bridge" / "bridge-token")
    appdata = os.getenv("APPDATA")
    if appdata:
        paths.append(Path(appdata) / "trading-journal" / "bridge-data" / "bridge-token")
        paths.append(Path(appdata) / "Trading Journal" / "bridge-data" / "bridge-token")

    for path in paths:
        try:
            if path.is_file():
                _add(tokens, path.read_text(encoding="utf-8"))
        except OSError:
            continue
    return tokens


def bridge_request(method: str, url: str, **kwargs):
    """Call the bridge. On HTTP 401, try the next known token."""
    global _active_token
    timeout = kwargs.pop("timeout", 10)
    extra_headers = dict(kwargs.pop("headers", {}) or {})

    tokens = token_candidates()
    if _active_token:
        if _active_token in tokens:
            tokens.remove(_active_token)
        tokens.insert(0, _active_token)
    if not tokens:
        tokens = [""]

    last = None
    for token in tokens:
        headers = dict(extra_headers)
        if token:
            headers["X-TJ-Token"] = token
        last = requests.request(method, url, headers=headers, timeout=timeout, **kwargs)
        if last.status_code != 401:
            _active_token = token or None
            return last
    return last
