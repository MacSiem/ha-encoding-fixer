"""Minimal, privacy-preserving diagnostic state."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any, Callable

from homeassistant.helpers.storage import Store

from . import backup
from .const import DOMAIN


def latest_restorable_backup(hass: Any) -> datetime | None:
    """Return the latest eligible copy time using file metadata only."""
    try:
        entries = backup.list_backups(hass, _include_mtime=True)
        timestamps = [entry["_latest_mtime"] for entry in entries
                      if entry["restorable"] and entry["_latest_mtime"] is not None]
        return datetime.fromtimestamp(max(timestamps), UTC) if timestamps else None
    except (OSError, ValueError, OverflowError):
        return None


class Diagnostics:
    """Persist only the last completed aggregate and expose updates locally."""

    def __init__(self, hass: Any, entry_id: str) -> None:
        self.hass = hass
        self._store = Store(hass, 1, f"{DOMAIN}.diagnostics_{entry_id}")
        self.count: int | None = None
        self.completeness: str | None = None
        self._listeners: set[Callable[[], None]] = set()
        self._lock = asyncio.Lock()

    async def async_load(self) -> None:
        try:
            data = await self._store.async_load()
        except Exception:  # noqa: BLE001 - diagnostics cannot block setup
            return
        if (isinstance(data, dict) and type(data.get("count")) is int
                and 0 <= data["count"] <= 2000
                and data.get("completeness") in ("complete", "partial")):
            self.count = data["count"]
            self.completeness = data["completeness"]

    async def async_record_preview(self, count: int, completeness: str) -> None:
        if type(count) is not int or count < 0 or count > 2000 or completeness not in ("complete", "partial"):
            return
        async with self._lock:
            self.count, self.completeness = count, completeness
            for listener in tuple(self._listeners):
                try:
                    listener()
                except Exception:  # noqa: BLE001 - observer isolation
                    continue
            try:
                await self._store.async_save({"count": count, "completeness": completeness})
            except Exception:  # noqa: BLE001 - never fail the requested preview
                pass

    def subscribe(self, listener: Callable[[], None]) -> Callable[[], None]:
        self._listeners.add(listener)
        return lambda: self._listeners.discard(listener)
