"""Minimal, privacy-preserving diagnostic state."""

from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable

from homeassistant.helpers.storage import Store

from . import backup, scanner
from .const import BACKUP_DIR_NAME, DOMAIN


def preview_completeness(root: Path, target_ids: list[str], preview: dict[str, Any]) -> str:
    """Conservatively detect skipped entries hidden by the scanner's allowlist walk."""
    if preview["completeness"] != "complete":
        return "partial"
    if "packages" not in target_ids:
        return "complete"
    try:
        package_root = root / "packages"
        if package_root.is_symlink() or not package_root.is_dir():
            return "partial"
        def fail(error: OSError) -> None:
            raise error
        for current, directories, filenames in os.walk(package_root, followlinks=False, onerror=fail):
            directory = Path(current)
            directories[:] = [name for name in directories if name not in scanner.EXCLUDED_DIRS]
            if any((directory / name).is_symlink() for name in directories):
                return "partial"
            for name in filenames:
                path = directory / name
                if name.casefold() != "secrets.yaml" and path.suffix.casefold() in scanner.CONFIG_EXTENSIONS and path.is_symlink():
                    return "partial"
        expected = set(scanner.iter_config_files(root, target_ids))
        if expected != set(preview["source_hashes"]):
            return "partial"
        return "complete"
    except (OSError, ValueError):
        return "partial"


def latest_restorable_backup(hass: Any) -> datetime | None:
    """Read actual restorable copies; empty, unsafe and offline-only sets do not count."""
    try:
        entries = backup.list_backups(hass)
        root = Path(hass.config.path()).resolve(strict=True)
        latest = None
        for entry in entries:
            if not entry["restorable"]:
                continue
            relative_root = f'{BACKUP_DIR_NAME}/{entry["backup_id"]}'
            directory = backup._assert_no_symlink_path(root, relative_root, regular=False)
            inventory = backup._backup_inventory(directory)
            if not inventory or len(inventory) != entry["file_count"]:
                continue
            for relative in inventory:
                path = backup._assert_no_symlink_path(root, f'{relative_root}/{relative}', regular=True)
                stamp = datetime.fromtimestamp(path.stat().st_mtime, UTC)
                if latest is None or stamp > latest:
                    latest = stamp
        return latest
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
