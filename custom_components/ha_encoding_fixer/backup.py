"""Backup and restore helpers for HA Encoding Fixer.

All Home Assistant runtime paths are resolved by callers through
``hass.config.path()``.  The pure path helpers are intentionally kept
separate so they can be tested without importing Home Assistant.
"""

from __future__ import annotations

import re
import os
import stat
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any, Callable
from urllib.parse import unquote

try:
    from .const import BACKUP_DIR_NAME
except ImportError:  # pragma: no cover - direct pure-test import
    BACKUP_DIR_NAME = "ha_encoding_fixer_backups"

BACKUP_ID_RE = re.compile(r"^\d{8}-\d{6}$")
FIXED_ALLOWLIST = {
    "configuration.yaml",
    "automations.yaml",
    "scripts.yaml",
    "scenes.yaml",
    ".storage/core.entity_registry",
}
EXCLUDED_PACKAGE_DIRS = {
    ".git",
    "__pycache__",
    BACKUP_DIR_NAME,
    "deps",
    "tts",
}


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
    if not isinstance(relative_path, str) or not relative_path or "\x00" in relative_path:
        raise ValueError("Unsafe relative path")
    if unquote(relative_path) != relative_path:
        raise ValueError("Unsafe relative path")
    if "\\" in relative_path or re.match(r"^[A-Za-z]:", relative_path):
        raise ValueError("Unsafe relative path")
    posix_path = PurePosixPath(relative_path)
    if posix_path.is_absolute() or any(
        part in {"", ".", ".."} for part in posix_path.parts
    ):
        raise ValueError("Unsafe relative path")
    normalized = str(posix_path)
    if not normalized or normalized == ".":
        raise ValueError("Relative path is required")
    return normalized


def validate_backup_content_path(relative_path: str) -> str:
    """Accept only files the integration is explicitly allowed to restore."""
    normalized = validate_relative_path(relative_path)
    if normalized in FIXED_ALLOWLIST:
        return normalized
    path = PurePosixPath(normalized)
    if (
        len(path.parts) >= 2
        and path.parts[0] == "packages"
        and path.suffix.casefold() in {".yaml", ".yml"}
        and path.name.casefold() != "secrets.yaml"
        and not any(part in EXCLUDED_PACKAGE_DIRS for part in path.parts)
    ):
        return normalized
    raise ValueError("Backup content is outside the allowlist")


def validate_restore_content_path(relative_path: str) -> str:
    """Accept only targets that are safe to restore while HA is running."""
    normalized = validate_backup_content_path(relative_path)
    if normalized == ".storage/core.entity_registry":
        raise ValueError("Entity registry backups require offline recovery")
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
    return Path(hass.config.path()).resolve(strict=True)


def _target_path(hass: Any, relative_path: str) -> Path:
    return Path(hass.config.path(validate_relative_path(relative_path)))


def _assert_no_symlink_path(root: Path, relative_path: str, *, regular: bool) -> Path:
    """Return a contained path and reject symlinks in every existing component."""
    resolved_root = root.resolve(strict=True)
    current = resolved_root
    parts = PurePosixPath(validate_relative_path(relative_path)).parts
    for index, part in enumerate(parts):
        current = current / part
        try:
            info = current.lstat()
        except FileNotFoundError:
            if index != len(parts) - 1:
                raise
            break
        if stat.S_ISLNK(info.st_mode):
            raise OSError("symlink paths are not allowed")
    parent = current.parent.resolve(strict=True)
    if parent != resolved_root and resolved_root not in parent.parents:
        raise OSError("path escapes root")
    if current.exists() and regular:
        info = current.stat()
        if not stat.S_ISREG(info.st_mode):
            raise OSError("path is not a regular file")
    return current


def _ensure_safe_parent(root: Path, relative_path: str) -> Path:
    """Create missing parent directories without traversing symlinks."""
    resolved_root = root.resolve(strict=True)
    parts = PurePosixPath(validate_relative_path(relative_path)).parts[:-1]
    current = resolved_root
    for part in parts:
        current = current / part
        try:
            info = current.lstat()
        except FileNotFoundError:
            current.mkdir(mode=0o700)
            info = current.lstat()
        if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
            raise OSError("unsafe parent directory")
    resolved_parent = current.resolve(strict=True)
    if resolved_parent != resolved_root and resolved_root not in resolved_parent.parents:
        raise OSError("path escapes root")
    return resolved_parent


def _read_regular(path: Path) -> tuple[bytes, int]:
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode):
            raise OSError("path is not a regular file")
        chunks: list[bytes] = []
        while chunk := os.read(descriptor, 65_536):
            chunks.append(chunk)
        return b"".join(chunks), stat.S_IMODE(info.st_mode)
    finally:
        os.close(descriptor)


def _atomic_write(path: Path, data: bytes, mode: int = 0o600) -> None:
    """Write and fsync a regular file via a same-directory atomic replace."""
    parent_info = path.parent.lstat()
    if stat.S_ISLNK(parent_info.st_mode) or not stat.S_ISDIR(parent_info.st_mode):
        raise OSError("unsafe destination directory")
    descriptor, temp_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    temp_path = Path(temp_name)
    try:
        with os.fdopen(descriptor, "wb", closefd=True) as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_path, mode)
        os.replace(temp_path, path)
        directory_fd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def read_config_file(hass: Any, relative_path: str) -> tuple[bytes, int]:
    """Read a contained regular config file without following links."""
    root = _config_root(hass)
    path = _assert_no_symlink_path(root, relative_path, regular=True)
    return _read_regular(path)


def atomic_write_config_file(
    hass: Any,
    relative_path: str,
    data: bytes,
    mode: int,
) -> None:
    """Atomically replace one contained non-symlink config target."""
    root = _config_root(hass)
    path = _assert_no_symlink_path(root, relative_path, regular=False)
    _atomic_write(path, data, mode)


def create_backup_dir(hass: Any, now: datetime | None = None) -> str:
    """Create and return a never-overwritten timestamped backup directory."""
    config_root = _config_root(hass).resolve(strict=True)
    backup_parent = config_root / BACKUP_DIR_NAME
    if backup_parent.is_symlink():
        raise OSError("backup root must not be a symlink")
    backup_parent.mkdir(mode=0o700, parents=False, exist_ok=True)
    parent_info = backup_parent.lstat()
    if stat.S_ISLNK(parent_info.st_mode) or not stat.S_ISDIR(parent_info.st_mode):
        raise OSError("unsafe backup root")
    base_time = now or datetime.now()
    for offset in range(0, 120):
        backup_id = format_backup_id(base_time + timedelta(seconds=offset))
        backup_root = backup_parent / backup_id
        try:
            backup_root.mkdir(mode=0o700, parents=True, exist_ok=False)
            return backup_id
        except FileExistsError:
            continue
    raise FileExistsError("Could not allocate a unique timestamped backup dir")


def copy_file_to_backup(
    hass: Any, backup_id: str, relative_path: str
) -> BackupCopy:
    """Copy one config file into the given backup directory before writes."""
    safe_relative_path = validate_backup_content_path(relative_path)
    config_root = _config_root(hass)
    source = _assert_no_symlink_path(
        config_root,
        safe_relative_path,
        regular=True,
    )
    data, mode = _read_regular(source)

    destination = build_backup_destination(
        config_root, backup_id, safe_relative_path
    )
    _ensure_safe_parent(
        config_root,
        str(destination.relative_to(config_root)),
    )
    destination = _assert_no_symlink_path(
        config_root,
        str(destination.relative_to(config_root)),
        regular=False,
    )
    if destination.exists() or destination.is_symlink():
        raise FileExistsError(str(destination.relative_to(config_root)))
    _atomic_write(destination, data, mode)
    return BackupCopy(
        backup_id=backup_id,
        relative_path=safe_relative_path,
        backup_relative_path=str(destination.relative_to(config_root)),
    )


def restore_file_from_backup(
    hass: Any, backup_id: str, relative_path: str
) -> dict[str, Any]:
    """Restore one file from a backup directory and verify the copied bytes."""
    safe_relative_path = validate_backup_content_path(relative_path)
    config_root = _config_root(hass)
    source = build_backup_destination(
        config_root, backup_id, safe_relative_path
    )
    source = _assert_no_symlink_path(
        config_root,
        str(source.relative_to(config_root)),
        regular=True,
    )
    if not source.exists():
        raise FileNotFoundError(str(source.relative_to(config_root)))
    data, mode = _read_regular(source)
    target = _assert_no_symlink_path(
        config_root,
        safe_relative_path,
        regular=False,
    )
    _atomic_write(target, data, mode)
    verified, _ = _read_regular(target)
    if data != verified:
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
    if backup_root.is_symlink() or not backup_root.is_dir():
        raise OSError("unsafe backup root")

    backups: list[dict[str, Any]] = []
    for directory in sorted(backup_root.iterdir(), reverse=True):
        if (
            directory.is_symlink()
            or not directory.is_dir()
            or not BACKUP_ID_RE.match(directory.name)
        ):
            continue
        file_count = 0
        restorable = True
        for current, directories, filenames in os.walk(
            directory,
            topdown=True,
            followlinks=False,
        ):
            current_path = Path(current)
            directories[:] = [
                name for name in directories if not (current_path / name).is_symlink()
            ]
            for filename in filenames:
                path = current_path / filename
                if path.is_symlink() or not path.is_file():
                    continue
                relative_path = path.relative_to(directory).as_posix()
                try:
                    validate_backup_content_path(relative_path)
                except ValueError:
                    restorable = False
                    continue
                file_count += 1
                try:
                    validate_restore_content_path(relative_path)
                except ValueError:
                    restorable = False
        backups.append(
            {
                "backup_id": directory.name,
                "file_count": file_count,
                "restorable": restorable and file_count > 0,
            }
        )
    return backups


def restore_backup(
    hass: Any,
    backup_id: str,
    *,
    validator: Callable[[Path, str, bytes], None] | None = None,
) -> dict[str, Any]:
    """Restore every file from a named backup directory.

    The current version of each target file is backed up first, because
    restore is also a write path.
    """
    if not BACKUP_ID_RE.match(backup_id):
        raise ValueError(f"Invalid backup id: {backup_id}")

    config_root = _config_root(hass)
    backup_root = config_root / BACKUP_DIR_NAME / backup_id
    if backup_root.is_symlink() or not backup_root.is_dir():
        raise FileNotFoundError(backup_id)

    plans: list[dict[str, Any]] = []
    for current, directories, filenames in os.walk(
        backup_root,
        topdown=True,
        followlinks=False,
    ):
        current_path = Path(current)
        directories[:] = [
            name for name in directories if not (current_path / name).is_symlink()
        ]
        for filename in filenames:
            source = current_path / filename
            if source.is_symlink() or not source.is_file():
                raise OSError("unsafe backup entry")
            relative_path = source.relative_to(backup_root).as_posix()
            validate_restore_content_path(relative_path)
            data, source_mode = _read_regular(source)
            if validator is not None and Path(relative_path).suffix.casefold() in {
                ".yaml",
                ".yml",
            }:
                validator(config_root, relative_path, data)
            target = _assert_no_symlink_path(
                config_root,
                relative_path,
                regular=False,
            )
            original = _read_regular(target) if target.exists() else None
            plans.append(
                {
                    "relative_path": relative_path,
                    "target": target,
                    "data": data,
                    "mode": source_mode,
                    "original": original,
                }
            )

    if not plans:
        raise ValueError("Backup contains no restorable files")

    # Only after every backup entry, destination and YAML document has passed
    # validation do we allocate and populate the rollback snapshot.
    rollback_backup_id = create_backup_dir(hass)
    for plan in plans:
        rollback_path = None
        if plan["original"] is not None:
            rollback = copy_file_to_backup(
                hass,
                rollback_backup_id,
                plan["relative_path"],
            )
            rollback_path = rollback.backup_relative_path
        plan["rollback_path"] = rollback_path

    changed: list[dict[str, Any]] = []
    try:
        for plan in plans:
            # Roll back this target even if replace succeeded but fsync or
            # readback verification raises before the write helper returns.
            changed.append(plan)
            _atomic_write(plan["target"], plan["data"], plan["mode"])
            verified, _ = _read_regular(plan["target"])
            if verified != plan["data"]:
                raise OSError("restore verification failed")
    except Exception:
        rollback_failed = False
        for plan in reversed(changed):
            try:
                if plan["original"] is None:
                    plan["target"].unlink(missing_ok=True)
                else:
                    original_data, original_mode = plan["original"]
                    _atomic_write(plan["target"], original_data, original_mode)
            except Exception:
                rollback_failed = True
        if rollback_failed:
            raise OSError("restore failed and rollback was incomplete")
        raise

    results = [
        {
            "file": plan["relative_path"],
            "restored": True,
            "rollback_backup_path": plan["rollback_path"],
        }
        for plan in plans
    ]

    return {
        "backup_id": backup_id,
        "rollback_backup_id": rollback_backup_id,
        "results": results,
    }
