"""Backup and restore helpers for HA Encoding Fixer.

All Home Assistant runtime paths are resolved by callers through
``hass.config.path()``.  The pure path helpers are intentionally kept
separate so they can be tested without importing Home Assistant.
"""

from __future__ import annotations

import re
import shutil
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any

try:
    from .const import BACKUP_DIR_NAME
except ImportError:  # pragma: no cover - direct pure-test import
    BACKUP_DIR_NAME = "ha_encoding_fixer_backups"

BACKUP_ID_RE = re.compile(r"^\d{8}-\d{6}$")


@dataclass(frozen=True)
class BackupCopy:
    """A copied file inside one timestamped backup directory."""

    backup_id: str
    relative_path: str
    backup_relative_path: str


def format_backup_id(now: datetime | None = None) -> str:
    """Return the timestamp directory name used for one backup operation."""
    return (now or datetime.now()).strftime("%Y%m%d-%H%M%S")


def validate_relative_path(relative_path: str) -> str:
    """Return a safe POSIX-style relative path or raise ``ValueError``."""
    posix_path = PurePosixPath(str(relative_path).replace("\\", "/"))
    if posix_path.is_absolute() or ".." in posix_path.parts:
        raise ValueError(f"Unsafe relative path: {relative_path}")
    normalized = str(posix_path)
    if not normalized or normalized == ".":
        raise ValueError("Relative path is required")
    return normalized


def build_backup_destination(
    config_root: Path, backup_id: str, relative_path: str
) -> Path:
    """Build the destination path for a backed-up config file."""
    if not BACKUP_ID_RE.match(backup_id):
        raise ValueError(f"Invalid backup id: {backup_id}")
    safe_relative_path = validate_relative_path(relative_path)
    return config_root / BACKUP_DIR_NAME / backup_id / safe_relative_path


def _config_root(hass: Any) -> Path:
    return Path(hass.config.path())


def _target_path(hass: Any, relative_path: str) -> Path:
    return Path(hass.config.path(validate_relative_path(relative_path)))


def create_backup_dir(hass: Any, now: datetime | None = None) -> str:
    """Create and return a never-overwritten timestamped backup directory."""
    config_root = _config_root(hass)
    base_time = now or datetime.now()
    for offset in range(0, 120):
        backup_id = format_backup_id(base_time + timedelta(seconds=offset))
        backup_root = config_root / BACKUP_DIR_NAME / backup_id
        try:
            backup_root.mkdir(parents=True, exist_ok=False)
            return backup_id
        except FileExistsError:
            continue
    raise FileExistsError("Could not allocate a unique timestamped backup dir")


def copy_file_to_backup(
    hass: Any, backup_id: str, relative_path: str
) -> BackupCopy:
    """Copy one config file into the given backup directory before writes."""
    safe_relative_path = validate_relative_path(relative_path)
    config_root = _config_root(hass)
    source = _target_path(hass, safe_relative_path)
    if not source.is_file():
        raise FileNotFoundError(safe_relative_path)

    destination = build_backup_destination(
        config_root, backup_id, safe_relative_path
    )
    if destination.exists():
        raise FileExistsError(str(destination.relative_to(config_root)))

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return BackupCopy(
        backup_id=backup_id,
        relative_path=safe_relative_path,
        backup_relative_path=str(destination.relative_to(config_root)),
    )


def restore_file_from_backup(
    hass: Any, backup_id: str, relative_path: str
) -> dict[str, Any]:
    """Restore one file from a backup directory and verify the copied bytes."""
    safe_relative_path = validate_relative_path(relative_path)
    config_root = _config_root(hass)
    source = build_backup_destination(
        config_root, backup_id, safe_relative_path
    )
    if not source.is_file():
        raise FileNotFoundError(str(source.relative_to(config_root)))

    target = _target_path(hass, safe_relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    if source.read_bytes() != target.read_bytes():
        raise OSError(f"Verification failed restoring {safe_relative_path}")

    return {
        "file": safe_relative_path,
        "backup_id": backup_id,
        "restored": True,
    }


def list_backups(hass: Any) -> list[dict[str, Any]]:
    """Return available backup directories and their relative file paths."""
    config_root = _config_root(hass)
    backup_root = config_root / BACKUP_DIR_NAME
    if not backup_root.exists():
        return []

    backups: list[dict[str, Any]] = []
    for directory in sorted(backup_root.iterdir(), reverse=True):
        if not directory.is_dir() or not BACKUP_ID_RE.match(directory.name):
            continue
        files = [
            str(path.relative_to(directory))
            for path in sorted(directory.rglob("*"))
            if path.is_file()
        ]
        backups.append(
            {
                "backup_id": directory.name,
                "path": str(directory.relative_to(config_root)),
                "files": files,
                "file_count": len(files),
            }
        )
    return backups


def restore_backup(hass: Any, backup_id: str) -> dict[str, Any]:
    """Restore every file from a named backup directory.

    The current version of each target file is backed up first, because
    restore is also a write path.
    """
    if not BACKUP_ID_RE.match(backup_id):
        raise ValueError(f"Invalid backup id: {backup_id}")

    config_root = _config_root(hass)
    backup_root = config_root / BACKUP_DIR_NAME / backup_id
    if not backup_root.is_dir():
        raise FileNotFoundError(backup_id)

    rollback_backup_id = create_backup_dir(hass)
    results: list[dict[str, Any]] = []
    for source in sorted(backup_root.rglob("*")):
        if not source.is_file():
            continue
        relative_path = str(source.relative_to(backup_root))
        target = _target_path(hass, relative_path)
        rollback_path = None
        if target.exists():
            rollback = copy_file_to_backup(
                hass, rollback_backup_id, relative_path
            )
            rollback_path = rollback.backup_relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        verified = source.read_bytes() == target.read_bytes()
        results.append(
            {
                "file": relative_path,
                "restored": verified,
                "rollback_backup_path": rollback_path,
            }
        )
        if not verified:
            if rollback_path:
                restore_file_from_backup(
                    hass, rollback_backup_id, relative_path
                )
            raise OSError(f"Verification failed restoring {relative_path}")

    return {
        "backup_id": backup_id,
        "rollback_backup_id": rollback_backup_id,
        "results": results,
    }
