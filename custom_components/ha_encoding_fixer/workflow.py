"""Transactional, allowlisted file workflow for HA Encoding Fixer."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable

from . import backup, scanner


class WorkflowError(Exception):
    """A redacted client-safe workflow failure."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def validate_yaml_bytes(
    config_root: Path,
    _relative_path: str,
    content: bytes,
) -> None:
    """Validate YAML syntax with Home Assistant's annotated YAML parser."""
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as err:
        raise WorkflowError("invalid_utf8") from err

    try:
        from homeassistant.util.yaml import Secrets, parse_yaml

        parse_yaml(text, Secrets(config_root))
    except ImportError:
        # Pure unit tests do not import Home Assistant. PyYAML's compose step is
        # syntax-only and never constructs or executes tagged objects.
        try:
            import yaml

            yaml.compose(text, Loader=yaml.SafeLoader)
        except Exception as err:  # noqa: BLE001
            raise WorkflowError("invalid_yaml") from err
    except Exception as err:  # noqa: BLE001 - never expose parser/file details
        raise WorkflowError("invalid_yaml") from err


def build_file_preview(
    config_root: Path,
    target_ids: list[str] | None,
) -> dict[str, Any]:
    """Build an internal and public preview without mutating files."""
    try:
        scan = scanner.scan_config_files(
            config_root,
            target_ids,
            include_sensitive=True,
        )
    except (OSError, ValueError) as err:
        raise WorkflowError("invalid_target_selection") from err

    internal_changes: list[dict[str, Any]] = []
    public_findings: list[dict[str, Any]] = []
    privacy_key = secrets.token_bytes(32)
    file_refs = {
        relative_path: secrets.token_urlsafe(12)
        for relative_path in scan["source_hashes"]
    }
    for raw_change in scan["changes"]:
        public = scanner.redact_change(raw_change)
        public["file_ref"] = file_refs[str(raw_change["file"])]
        internal = deepcopy(raw_change)
        internal["change_id"] = public["change_id"]
        internal["file_ref"] = public["file_ref"]
        internal_changes.append(internal)
        public_findings.append(public)

    public_source_hashes = [
        {
            "file_ref": file_refs[relative_path],
            "source_hash": hmac.new(
                privacy_key,
                source_hash.encode(),
                hashlib.sha256,
            ).hexdigest(),
        }
        for relative_path, source_hash in sorted(scan["source_hashes"].items())
    ]

    return {
        "target_ids": list(target_ids or scanner.DEFAULT_TARGET_IDS),
        "internal_changes": internal_changes,
        "findings": public_findings,
        "source_hashes": deepcopy(scan["source_hashes"]),
        "public_source_hashes": public_source_hashes,
        "errors": deepcopy(scan["errors"]),
        "scanned_files": int(scan["scanned_files"]),
        "completeness": scan["completeness"],
    }


def prepare_file_transaction(
    hass: Any,
    preview: dict[str, Any],
    selected_change_ids: set[str],
    backup_id: str,
    *,
    validator: Callable[[Path, str, bytes], None] = validate_yaml_bytes,
) -> list[dict[str, Any]]:
    """Validate and back up the complete file write set before any mutation."""
    internal_changes = preview.get("internal_changes") or []
    known_ids = {
        str(change.get("change_id"))
        for change in internal_changes
        if change.get("change_id")
    }
    if not selected_change_ids or not selected_change_ids <= known_ids:
        raise WorkflowError("invalid_change_selection")

    selected = [
        change
        for change in internal_changes
        if change.get("change_id") in selected_change_ids
    ]
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for change in selected:
        grouped[str(change["file"])].append(change)

    config_root = Path(hass.config.path()).resolve(strict=True)
    plans: list[dict[str, Any]] = []
    for relative_path, file_changes in sorted(grouped.items()):
        try:
            original, mode = backup.read_config_file(hass, relative_path)
        except (OSError, ValueError) as err:
            raise WorkflowError("unsafe_or_unavailable_target") from err
        if hashlib.sha256(original).hexdigest() != preview["source_hashes"].get(
            relative_path
        ):
            raise WorkflowError("stale_preview")
        try:
            original_text = original.decode("utf-8")
        except UnicodeDecodeError as err:
            raise WorkflowError("invalid_utf8") from err
        fixed_text, applied = scanner.apply_selected_file_changes(
            original_text,
            file_changes,
        )
        if len(applied) != len(file_changes):
            raise WorkflowError("stale_preview")
        updated = fixed_text.encode("utf-8")
        validator(config_root, relative_path, updated)
        plans.append(
            {
                "relative_path": relative_path,
                "file_ref": str(file_changes[0]["file_ref"]),
                "original": original,
                "updated": updated,
                "mode": mode,
                "updated_hash": hashlib.sha256(updated).hexdigest(),
                "change_ids": [str(item["change_id"]) for item in file_changes],
            }
        )

    # Back up only after the complete candidate write set has passed stale,
    # decoding, exact-change and YAML validation checks.
    for plan in plans:
        try:
            backup_copy = backup.copy_file_to_backup(
                hass,
                backup_id,
                plan["relative_path"],
            )
        except (OSError, ValueError) as err:
            raise WorkflowError("backup_failed") from err
        plan["backup_path"] = backup_copy.backup_relative_path
    return plans


def rollback_file_transaction(hass: Any, plans: list[dict[str, Any]]) -> bool:
    """Restore every file plan to its exact original bytes."""
    restored = True
    for plan in reversed(plans):
        try:
            backup.atomic_write_config_file(
                hass,
                plan["relative_path"],
                plan["original"],
                plan["mode"],
            )
            readback, _ = backup.read_config_file(hass, plan["relative_path"])
            if readback != plan["original"]:
                restored = False
        except Exception:  # noqa: BLE001 - caller reports rollback_failed
            restored = False
    return restored


def commit_file_transaction(
    hass: Any,
    plans: list[dict[str, Any]],
    *,
    validator: Callable[[Path, str, bytes], None] = validate_yaml_bytes,
) -> list[dict[str, Any]]:
    """Atomically write and verify all plans, rolling all back on failure."""
    config_root = Path(hass.config.path()).resolve(strict=True)
    changed: list[dict[str, Any]] = []
    try:
        for plan in plans:
            # A post-preview symlink swap is rejected immediately before write.
            current, _ = backup.read_config_file(hass, plan["relative_path"])
            if current != plan["original"]:
                raise WorkflowError("stale_preview")
            # Include the current target in rollback even if replace succeeds
            # but a later fsync/readback step raises.
            changed.append(plan)
            backup.atomic_write_config_file(
                hass,
                plan["relative_path"],
                plan["updated"],
                plan["mode"],
            )
            readback, _ = backup.read_config_file(hass, plan["relative_path"])
            if hashlib.sha256(readback).hexdigest() != plan["updated_hash"]:
                raise WorkflowError("readback_failed")
            validator(config_root, plan["relative_path"], readback)
    except Exception as err:  # noqa: BLE001
        if not rollback_file_transaction(hass, changed):
            raise WorkflowError("rollback_failed") from err
        if isinstance(err, WorkflowError):
            raise
        raise WorkflowError("write_failed") from err

    return [
        {
            "target_id": (
                "packages"
                if plan["relative_path"].startswith("packages/")
                else Path(plan["relative_path"]).stem
            ),
            "file_ref": plan["file_ref"],
            "changed": True,
            "verified": True,
            "restored": False,
            "change_count": len(plan["change_ids"]),
        }
        for plan in plans
    ]
