"""WebSocket API for HA Encoding Fixer."""

from __future__ import annotations

import logging
from collections import defaultdict
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er

from . import backup, scanner
from .const import DOMAIN, ENTITY_REGISTRY_STORAGE

_LOGGER = logging.getLogger(__name__)


def _change_key(change: dict[str, Any]) -> tuple[Any, ...]:
    return (
        change.get("type"),
        change.get("file"),
        change.get("line"),
        change.get("entity_id"),
        change.get("before"),
        change.get("after"),
    )


def _filter_changes(
    current_changes: list[dict[str, Any]],
    selected_changes: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    if selected_changes is None:
        return current_changes
    selected = {_change_key(change) for change in selected_changes}
    return [change for change in current_changes if _change_key(change) in selected]


async def _scan_file_changes(hass: HomeAssistant) -> dict[str, Any]:
    config_root = Path(hass.config.path())
    return await hass.async_add_executor_job(
        scanner.scan_config_files, config_root
    )


async def _scan_entity_changes(hass: HomeAssistant) -> list[dict[str, Any]]:
    registry = er.async_get(hass)
    changes: list[dict[str, Any]] = []
    seen_entities: set[str] = set()

    for entry in registry.entities.values():
        candidates: list[str] = []
        if entry.name:
            candidates.append(entry.name)
        state = hass.states.get(entry.entity_id)
        friendly_name = (
            state.attributes.get("friendly_name")
            if state and state.attributes
            else None
        )
        if friendly_name and friendly_name not in candidates:
            candidates.append(friendly_name)

        for value in candidates:
            detected = scanner.detect_mojibake(value)
            if not detected or detected.get("uncertain"):
                continue
            fixed = detected["fixed"]
            if fixed == value or entry.entity_id in seen_entities:
                continue
            changes.append(
                {
                    "type": "entity_registry",
                    "file": ENTITY_REGISTRY_STORAGE,
                    "line": 0,
                    "entity_id": entry.entity_id,
                    "attribute": "friendly_name",
                    "before": value,
                    "after": fixed,
                    "method": detected.get("method"),
                }
            )
            seen_entities.add(entry.entity_id)
            break

    return changes


async def _scan_all(hass: HomeAssistant) -> dict[str, Any]:
    file_scan = await _scan_file_changes(hass)
    entity_changes = await _scan_entity_changes(hass)
    changes = [*file_scan["changes"], *entity_changes]
    return {
        "changes": changes,
        "total": len(changes),
        "scanned_files": file_scan["scanned_files"],
        "errors": file_scan["errors"],
    }


def _apply_file_fixes_sync(
    hass: HomeAssistant,
    backup_id: str,
    selected_changes: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Apply file changes after backing up every touched file."""
    config_root = Path(hass.config.path())
    current_scan = scanner.scan_config_files(config_root)
    current_changes = [
        change
        for change in current_scan["changes"]
        if change.get("type") == "file"
    ]
    changes = _filter_changes(current_changes, selected_changes)
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for change in changes:
        grouped[str(change["file"])].append(change)

    results: list[dict[str, Any]] = []
    for relative_path, file_changes in grouped.items():
        target = Path(hass.config.path(relative_path))
        backup_copy = None
        try:
            backup_copy = backup.copy_file_to_backup(
                hass, backup_id, relative_path
            )
            text = target.read_bytes().decode("utf-8")
            if selected_changes is None:
                fixed_text, applied_changes = scanner.build_file_changes(
                    relative_path, text
                )
            else:
                fixed_text, applied_changes = scanner.apply_selected_file_changes(
                    text, file_changes
                )
            if not applied_changes:
                results.append(
                    {
                        "type": "file",
                        "file": relative_path,
                        "changed": False,
                        "reason": "no_matching_current_change",
                        "backup_path": backup_copy.backup_relative_path,
                    }
                )
                continue

            target.write_bytes(fixed_text.encode("utf-8"))
            verified_text = target.read_bytes().decode("utf-8")
            if verified_text != fixed_text:
                backup.restore_file_from_backup(
                    hass, backup_id, relative_path
                )
                results.append(
                    {
                        "type": "file",
                        "file": relative_path,
                        "changed": False,
                        "verified": False,
                        "restored": True,
                        "backup_path": backup_copy.backup_relative_path,
                        "error": "verify_failed",
                    }
                )
                continue

            results.append(
                {
                    "type": "file",
                    "file": relative_path,
                    "changed": True,
                    "verified": True,
                    "backup_path": backup_copy.backup_relative_path,
                    "changes": applied_changes,
                }
            )
        except Exception as err:  # noqa: BLE001 - returned to UI
            _LOGGER.exception("File fix failed for %s: %s", relative_path, err)
            if backup_copy is not None:
                try:
                    backup.restore_file_from_backup(
                        hass, backup_id, relative_path
                    )
                except Exception as restore_err:  # noqa: BLE001
                    _LOGGER.exception(
                        "Automatic restore failed for %s: %s",
                        relative_path,
                        restore_err,
                    )
            results.append(
                {
                    "type": "file",
                    "file": relative_path,
                    "changed": False,
                    "verified": False,
                    "restored": backup_copy is not None,
                    "backup_path": (
                        backup_copy.backup_relative_path
                        if backup_copy is not None
                        else None
                    ),
                    "error": str(err),
                }
            )
    return results


async def _apply_entity_fixes(
    hass: HomeAssistant,
    backup_id: str,
    selected_changes: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Apply entity registry name fixes through the registry API."""
    current_entity_changes = await _scan_entity_changes(hass)
    changes = _filter_changes(current_entity_changes, selected_changes)
    if not changes:
        return []

    try:
        registry_backup = await hass.async_add_executor_job(
            backup.copy_file_to_backup,
            hass,
            backup_id,
            ENTITY_REGISTRY_STORAGE,
        )
    except Exception as err:  # noqa: BLE001
        _LOGGER.exception("Could not back up entity registry: %s", err)
        return [
            {
                "type": "entity_registry",
                "entity_id": change["entity_id"],
                "changed": False,
                "error": f"backup_failed: {err}",
            }
            for change in changes
        ]

    registry = er.async_get(hass)
    results: list[dict[str, Any]] = []
    for change in changes:
        entity_id = str(change["entity_id"])
        entry = registry.async_get(entity_id)
        if entry is None:
            results.append(
                {
                    "type": "entity_registry",
                    "entity_id": entity_id,
                    "changed": False,
                    "backup_path": registry_backup.backup_relative_path,
                    "error": "entity_not_found",
                }
            )
            continue

        original_registry_name = entry.name
        try:
            registry.async_update_entity(entity_id, name=change["after"])
            updated = registry.async_get(entity_id)
            verified = bool(updated and updated.name == change["after"])
            if not verified:
                registry.async_update_entity(
                    entity_id, name=original_registry_name
                )
                await hass.async_add_executor_job(
                    backup.restore_file_from_backup,
                    hass,
                    backup_id,
                    ENTITY_REGISTRY_STORAGE,
                )
                results.append(
                    {
                        "type": "entity_registry",
                        "entity_id": entity_id,
                        "changed": False,
                        "verified": False,
                        "restored": True,
                        "backup_path": registry_backup.backup_relative_path,
                        "error": "verify_failed",
                    }
                )
                continue

            results.append(
                {
                    "type": "entity_registry",
                    "entity_id": entity_id,
                    "changed": True,
                    "verified": True,
                    "backup_path": registry_backup.backup_relative_path,
                    "changes": [change],
                }
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.exception("Entity registry fix failed for %s: %s", entity_id, err)
            try:
                registry.async_update_entity(entity_id, name=original_registry_name)
                await hass.async_add_executor_job(
                    backup.restore_file_from_backup,
                    hass,
                    backup_id,
                    ENTITY_REGISTRY_STORAGE,
                )
            except Exception as restore_err:  # noqa: BLE001
                _LOGGER.exception(
                    "Entity registry automatic restore failed for %s: %s",
                    entity_id,
                    restore_err,
                )
            results.append(
                {
                    "type": "entity_registry",
                    "entity_id": entity_id,
                    "changed": False,
                    "verified": False,
                    "restored": True,
                    "backup_path": registry_backup.backup_relative_path,
                    "error": str(err),
                }
            )
    return results


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/scan"})
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_scan(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Scan files and entity registry names for an administrator."""
    try:
        connection.send_result(msg["id"], await _scan_all(hass))
    except Exception as err:  # noqa: BLE001
        _LOGGER.exception("scan failed: %s", err)
        connection.send_error(msg["id"], "scan_failed", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/fix",
        vol.Optional("dry_run", default=True): bool,
        vol.Optional("changes", default=None): object,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_fix(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Dry-run or apply fixes. Server defaults to dry-run."""
    dry_run = bool(msg.get("dry_run", True))
    selected_changes = msg.get("changes")
    if selected_changes is not None and not isinstance(selected_changes, list):
        connection.send_error(msg["id"], "invalid_payload", "changes must be a list")
        return

    try:
        if dry_run:
            scan_result = await _scan_all(hass)
            changes = _filter_changes(scan_result["changes"], selected_changes)
            connection.send_result(
                msg["id"],
                {
                    **scan_result,
                    "changes": changes,
                    "total": len(changes),
                    "dry_run": True,
                },
            )
            return

        backup_id = await hass.async_add_executor_job(
            backup.create_backup_dir, hass
        )
        file_results = await hass.async_add_executor_job(
            _apply_file_fixes_sync, hass, backup_id, selected_changes
        )
        entity_results = await _apply_entity_fixes(
            hass, backup_id, selected_changes
        )
        results = [*file_results, *entity_results]
        connection.send_result(
            msg["id"],
            {
                "dry_run": False,
                "backup_id": backup_id,
                "results": results,
                "changed": sum(1 for result in results if result.get("changed")),
                "failed": sum(1 for result in results if result.get("error")),
            },
        )
    except Exception as err:  # noqa: BLE001
        _LOGGER.exception("fix failed: %s", err)
        connection.send_error(msg["id"], "fix_failed", str(err))


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list_backups"})
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_list_backups(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """List available backup directories."""
    try:
        backups = await hass.async_add_executor_job(backup.list_backups, hass)
        connection.send_result(msg["id"], {"backups": backups})
    except Exception as err:  # noqa: BLE001
        _LOGGER.exception("list_backups failed: %s", err)
        connection.send_error(msg["id"], "list_backups_failed", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/restore",
        vol.Required("backup_id"): str,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_restore(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Restore every file from a chosen backup directory."""
    try:
        result = await hass.async_add_executor_job(
            backup.restore_backup, hass, msg["backup_id"]
        )
        result["restart_recommended"] = True
        connection.send_result(msg["id"], result)
    except Exception as err:  # noqa: BLE001
        _LOGGER.exception("restore failed: %s", err)
        connection.send_error(msg["id"], "restore_failed", str(err))


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    """Register all websocket commands."""
    for handler in (_ws_scan, _ws_fix, _ws_list_backups, _ws_restore):
        websocket_api.async_register_command(hass, handler)
