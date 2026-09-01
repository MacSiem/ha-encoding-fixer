"""Admin-only, privacy-preserving WebSocket workflow for Encoding Fixer."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import secrets
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from functools import partial, wraps
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er

from . import backup, scanner, workflow
from .const import DATA_WORKFLOW, DOMAIN, ENTITY_REGISTRY_STORAGE

_LOGGER = logging.getLogger(__name__)

PREVIEW_TTL_SECONDS = 15 * 60
MAX_PREVIEWS = 32
MAX_OPERATIONS = 256
MAX_CHANGES = 2_000
ENTITY_TARGET_ID = "entity_registry"
ALL_TARGET_IDS = (*scanner.DEFAULT_TARGET_IDS, ENTITY_TARGET_ID)


def _requires_active(method):
    """Reject new work after lifecycle close and drain tracked operations."""

    @wraps(method)
    async def wrapped(self, *args, **kwargs):
        async with self._activity():
            return await method(self, *args, **kwargs)

    return wrapped


class EncodingFixerWorkflow:
    """Own previews and exactly-once operations for one HA runtime."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._lock = asyncio.Lock()
        self._previews: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self._operations: OrderedDict[tuple[str, str], dict[str, Any]] = OrderedDict()
        self._closed = False
        self._active_operations = 0
        self._drained = asyncio.Event()
        self._drained.set()

    @asynccontextmanager
    async def _activity(self):
        """Track one full public workflow operation for lifecycle draining."""
        if self._closed:
            raise workflow.WorkflowError("integration_unavailable")
        self._active_operations += 1
        self._drained.clear()
        try:
            yield
        finally:
            self._active_operations -= 1
            if self._active_operations == 0:
                self._drained.set()

    async def async_close(self) -> None:
        """Fail closed for new work and wait for existing work to finish."""
        self._closed = True
        wait_task = asyncio.create_task(self._drained.wait())
        cancellation: asyncio.CancelledError | None = None
        try:
            await asyncio.shield(wait_task)
        except asyncio.CancelledError as err:
            cancellation = err
            while not wait_task.done():
                try:
                    await asyncio.shield(wait_task)
                except asyncio.CancelledError:
                    continue
        self._previews.clear()
        self._operations.clear()
        if cancellation is not None:
            raise cancellation

    @staticmethod
    def _owner(connection: websocket_api.ActiveConnection) -> str:
        user = getattr(connection, "user", None)
        user_id = getattr(user, "id", None)
        if not isinstance(user_id, str) or not user_id:
            raise workflow.WorkflowError("authorization_required")
        return user_id

    @staticmethod
    def _fingerprint(action: str, payload: dict[str, Any]) -> str:
        canonical = json.dumps(
            {"action": action, "payload": payload},
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(canonical.encode()).hexdigest()

    def _clean_previews(self) -> None:
        now = time.monotonic()
        for preview_id in list(self._previews):
            if self._previews[preview_id]["expires_monotonic"] <= now:
                self._previews.pop(preview_id, None)
        while len(self._previews) > MAX_PREVIEWS:
            self._previews.popitem(last=False)

    def _remember_operation(
        self,
        owner: str,
        operation_id: str,
        fingerprint: str,
        *,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        key = (owner, operation_id)
        self._operations[key] = {
            "fingerprint": fingerprint,
            "result": deepcopy(result),
            "error": error,
        }
        self._operations.move_to_end(key)
        while len(self._operations) > MAX_OPERATIONS:
            self._operations.popitem(last=False)

    def _replay_operation(
        self,
        owner: str,
        operation_id: str,
        fingerprint: str,
    ) -> dict[str, Any] | None:
        record = self._operations.get((owner, operation_id))
        if record is None:
            return None
        if record["fingerprint"] != fingerprint:
            raise workflow.WorkflowError("operation_id_reused")
        if record["error"]:
            raise workflow.WorkflowError(str(record["error"]))
        return deepcopy(record["result"])

    @_requires_active
    async def async_targets(self) -> dict[str, Any]:
        root = Path(self.hass.config.path())
        available_files = await self.hass.async_add_executor_job(
            scanner.iter_config_files,
            root,
            list(scanner.DEFAULT_TARGET_IDS),
        )
        available_ids = {
            "packages" if path.startswith("packages/") else Path(path).stem
            for path in available_files
        }
        targets = [
            {
                "target_id": target_id,
                "available": target_id == ENTITY_TARGET_ID or target_id in available_ids,
            }
            for target_id in ALL_TARGET_IDS
        ]
        return {"schema_version": 1, "targets": targets}

    async def _async_entity_preview(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        registry = er.async_get(self.hass)
        internal: list[dict[str, Any]] = []
        public: list[dict[str, Any]] = []
        for entry in registry.entities.values():
            if not entry.name:
                continue
            detected = scanner.detect_mojibake(entry.name)
            if not detected or detected.get("uncertain") or detected["fixed"] == entry.name:
                continue
            change_id = secrets.token_urlsafe(24)
            entity_ref = secrets.token_urlsafe(12)
            internal.append(
                {
                    "change_id": change_id,
                    "entity_ref": entity_ref,
                    "entity_id": entry.entity_id,
                    "before": entry.name,
                    "after": detected["fixed"],
                }
            )
            public.append(
                {
                    "change_id": change_id,
                    "target_id": ENTITY_TARGET_ID,
                    "entity_ref": entity_ref,
                    "kind": "mojibake",
                }
            )
        return internal, public

    @_requires_active
    async def async_preview(
        self,
        connection: websocket_api.ActiveConnection,
        target_ids: list[str],
    ) -> dict[str, Any]:
        owner = self._owner(connection)
        selected_targets = list(dict.fromkeys(target_ids))
        if (
            not selected_targets
            or len(selected_targets) > len(ALL_TARGET_IDS)
            or any(target_id not in ALL_TARGET_IDS for target_id in selected_targets)
        ):
            raise workflow.WorkflowError("invalid_target_selection")

        file_targets = [
            target_id for target_id in selected_targets if target_id != ENTITY_TARGET_ID
        ]
        if file_targets:
            file_preview = await self.hass.async_add_executor_job(
                workflow.build_file_preview,
                Path(self.hass.config.path()),
                file_targets,
            )
        else:
            file_preview = {
                "internal_changes": [],
                "findings": [],
                "source_hashes": {},
                "public_source_hashes": [],
                "errors": [],
                "scanned_files": 0,
                "completeness": "complete",
            }

        entity_internal: list[dict[str, Any]] = []
        entity_public: list[dict[str, Any]] = []
        if ENTITY_TARGET_ID in selected_targets:
            entity_internal, entity_public = await self._async_entity_preview()

        findings = [*file_preview["findings"], *entity_public]
        if len(findings) > MAX_CHANGES:
            raise workflow.WorkflowError("too_many_findings")
        preview_id = secrets.token_urlsafe(24)
        expires_at = datetime.now(UTC) + timedelta(seconds=PREVIEW_TTL_SECONDS)
        record = {
            "owner": owner,
            "expires_monotonic": time.monotonic() + PREVIEW_TTL_SECONDS,
            "target_ids": selected_targets,
            "file_preview": file_preview,
            "entity_changes": entity_internal,
            "findings": findings,
            "source_hashes": file_preview["public_source_hashes"],
        }
        async with self._lock:
            self._clean_previews()
            self._previews[preview_id] = record
            self._previews.move_to_end(preview_id)

        return {
            "schema_version": 1,
            "preview_id": preview_id,
            "expires_at": expires_at.isoformat(),
            "target_ids": selected_targets,
            "findings": findings,
            "errors": file_preview["errors"],
            "scanned_files": file_preview["scanned_files"],
            "completeness": file_preview["completeness"],
        }

    async def _async_apply_entities(
        self,
        changes: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        if not changes:
            return []
        registry = er.async_get(self.hass)
        applied: list[dict[str, Any]] = []
        for change in changes:
            entry = registry.async_get(change["entity_id"])
            if entry is None or entry.name != change["before"]:
                raise workflow.WorkflowError("stale_preview")
        try:
            for change in changes:
                registry.async_update_entity(change["entity_id"], name=change["after"])
                updated = registry.async_get(change["entity_id"])
                if updated is None or updated.name != change["after"]:
                    raise workflow.WorkflowError("entity_update_failed")
                applied.append(change)
        except Exception as err:  # noqa: BLE001 - converted to a safe code
            if not await self._async_rollback_entities(applied):
                raise workflow.WorkflowError("rollback_failed") from err
            if isinstance(err, workflow.WorkflowError):
                raise
            raise workflow.WorkflowError("entity_update_failed") from err
        return applied

    async def _async_rollback_entities(self, changes: list[dict[str, Any]]) -> bool:
        registry = er.async_get(self.hass)
        restored = True
        for change in reversed(changes):
            try:
                current = registry.async_get(change["entity_id"])
                if current is None:
                    restored = False
                    continue
                registry.async_update_entity(change["entity_id"], name=change["before"])
                verified = registry.async_get(change["entity_id"])
                if verified is None or verified.name != change["before"]:
                    restored = False
            except Exception:  # noqa: BLE001 - caller gets rollback_failed only
                restored = False
        return restored

    async def _async_cleanup_cancelled_apply(
        self,
        commit_task: asyncio.Task[list[dict[str, Any]]],
        plans: list[dict[str, Any]],
        applied_entities: list[dict[str, Any]],
    ) -> bool:
        """Wait for an in-flight commit and restore the mixed transaction."""
        file_commit_succeeded = False
        files_restored = True
        try:
            await commit_task
            file_commit_succeeded = True
        except workflow.WorkflowError as err:
            # commit_file_transaction rolls its own changed-file set back before
            # raising. Only rollback_failed means that invariant was not met.
            if err.code == "rollback_failed":
                files_restored = False
        except Exception:  # noqa: BLE001 - the commit owns its own rollback
            pass

        if file_commit_succeeded:
            files_restored = await self.hass.async_add_executor_job(
                workflow.rollback_file_transaction,
                self.hass,
                plans,
            )
        entities_restored = await self._async_rollback_entities(applied_entities)
        return files_restored and entities_restored

    @_requires_active
    async def async_apply(
        self,
        connection: websocket_api.ActiveConnection,
        preview_id: str,
        change_ids: list[str],
        operation_id: str,
    ) -> dict[str, Any]:
        owner = self._owner(connection)
        selected_ids = sorted(set(change_ids))
        fingerprint = self._fingerprint(
            "apply",
            {"preview_id": preview_id, "change_ids": selected_ids},
        )

        async with self._lock:
            replay = self._replay_operation(owner, operation_id, fingerprint)
            if replay is not None:
                return replay
            try:
                self._clean_previews()
                preview = self._previews.get(preview_id)
                if preview is None or preview["owner"] != owner:
                    raise workflow.WorkflowError("preview_unavailable")
                known_ids = {finding["change_id"] for finding in preview["findings"]}
                if (
                    not selected_ids
                    or len(selected_ids) > MAX_CHANGES
                    or not set(selected_ids) <= known_ids
                ):
                    raise workflow.WorkflowError("invalid_change_selection")

                backup_id = await self.hass.async_add_executor_job(
                    backup.create_backup_dir,
                    self.hass,
                )
                file_change_ids = {
                    item["change_id"]
                    for item in preview["file_preview"]["internal_changes"]
                }
                file_ids = set(selected_ids) & file_change_ids
                entity_changes = [
                    item
                    for item in preview["entity_changes"]
                    if item["change_id"] in selected_ids
                ]
                plans = (
                    await self.hass.async_add_executor_job(
                        workflow.prepare_file_transaction,
                        self.hass,
                        preview["file_preview"],
                        file_ids,
                        backup_id,
                    )
                    if file_ids
                    else []
                )

                if entity_changes:
                    await self.hass.async_add_executor_job(
                        backup.copy_file_to_backup,
                        self.hass,
                        backup_id,
                        ENTITY_REGISTRY_STORAGE,
                    )
                applied_entities = await self._async_apply_entities(entity_changes)
                commit_task = asyncio.ensure_future(
                    self.hass.async_add_executor_job(
                        workflow.commit_file_transaction,
                        self.hass,
                        plans,
                    )
                )
                try:
                    # Keep the executor result alive if the WebSocket task is
                    # cancelled. A thread cannot be stopped safely mid-replace;
                    # cancellation therefore waits for it and restores both the
                    # file and entity halves before it propagates.
                    file_results = await asyncio.shield(commit_task)
                except asyncio.CancelledError as cancel_err:
                    cleanup_task = asyncio.create_task(
                        self._async_cleanup_cancelled_apply(
                            commit_task,
                            plans,
                            applied_entities,
                        )
                    )
                    try:
                        cleanup_ok = await asyncio.shield(cleanup_task)
                    except asyncio.CancelledError:
                        cleanup_ok = await cleanup_task
                    if not cleanup_ok:
                        _LOGGER.error(
                            "Encoding Fixer cancellation cleanup failed (rollback_failed)"
                        )
                    raise cancel_err
                except Exception as err:  # noqa: BLE001
                    if not await self._async_rollback_entities(applied_entities):
                        raise workflow.WorkflowError("rollback_failed") from err
                    raise

                entity_results = [
                    {
                        "target_id": ENTITY_TARGET_ID,
                        "entity_ref": item["entity_ref"],
                        "changed": True,
                        "verified": True,
                    }
                    for item in applied_entities
                ]
                self._previews.pop(preview_id, None)
                result = {
                    "status": "success",
                    "operation_id": operation_id,
                    "backup_id": backup_id,
                    "changed": len(file_results) + len(entity_results),
                    "failed": 0,
                    "results": [*file_results, *entity_results],
                    "restart_recommended": bool(file_results),
                }
                self._remember_operation(
                    owner,
                    operation_id,
                    fingerprint,
                    result=result,
                )
                return result
            except workflow.WorkflowError as err:
                self._remember_operation(
                    owner,
                    operation_id,
                    fingerprint,
                    error=err.code,
                )
                raise
            except Exception as err:  # noqa: BLE001
                self._remember_operation(
                    owner,
                    operation_id,
                    fingerprint,
                    error="apply_failed",
                )
                raise workflow.WorkflowError("apply_failed") from err

    @_requires_active
    async def async_list_backups(self) -> dict[str, Any]:
        backups = await self.hass.async_add_executor_job(
            backup.list_backups,
            self.hass,
        )
        return {"schema_version": 1, "backups": backups}

    @_requires_active
    async def async_restore(
        self,
        connection: websocket_api.ActiveConnection,
        backup_id: str,
        operation_id: str,
        confirmed: bool,
    ) -> dict[str, Any]:
        owner = self._owner(connection)
        fingerprint = self._fingerprint("restore", {"backup_id": backup_id})
        async with self._lock:
            replay = self._replay_operation(owner, operation_id, fingerprint)
            if replay is not None:
                return replay
            if not confirmed:
                raise workflow.WorkflowError("confirmation_required")
            try:
                restored = await self.hass.async_add_executor_job(
                    partial(
                        backup.restore_backup,
                        self.hass,
                        backup_id,
                        validator=workflow.validate_yaml_bytes,
                    )
                )
                result = {
                    "status": "success",
                    "operation_id": operation_id,
                    "backup_id": backup_id,
                    "rollback_backup_id": restored["rollback_backup_id"],
                    "restored": len(restored["results"]),
                    "restart_recommended": True,
                }
                self._remember_operation(
                    owner,
                    operation_id,
                    fingerprint,
                    result=result,
                )
                return result
            except Exception as err:  # noqa: BLE001
                code = (
                    err.code
                    if isinstance(err, workflow.WorkflowError)
                    else "restore_failed"
                )
                self._remember_operation(
                    owner,
                    operation_id,
                    fingerprint,
                    error=code,
                )
                if isinstance(err, workflow.WorkflowError):
                    raise
                raise workflow.WorkflowError(code) from err


def _service(hass: HomeAssistant) -> EncodingFixerWorkflow:
    service = hass.data.get(DOMAIN, {}).get(DATA_WORKFLOW)
    if not isinstance(service, EncodingFixerWorkflow):
        raise workflow.WorkflowError("integration_unavailable")
    return service


def _send_error(
    connection: websocket_api.ActiveConnection,
    message_id: int,
    err: Exception,
) -> None:
    code = err.code if isinstance(err, workflow.WorkflowError) else "request_failed"
    _LOGGER.warning("Encoding Fixer request failed (%s)", code)
    connection.send_error(message_id, code, "The request could not be completed safely.")


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/targets"})
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_targets(hass, connection, msg) -> None:
    try:
        connection.send_result(msg["id"], await _service(hass).async_targets())
    except Exception as err:  # noqa: BLE001
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/preview",
        vol.Required("target_ids"): vol.All(
            [str],
            vol.Length(min=1, max=len(ALL_TARGET_IDS)),
        ),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_preview(hass, connection, msg) -> None:
    try:
        result = await _service(hass).async_preview(connection, msg["target_ids"])
        connection.send_result(msg["id"], result)
    except Exception as err:  # noqa: BLE001
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/apply",
        vol.Required("preview_id"): vol.All(str, vol.Length(min=16, max=128)),
        vol.Required("change_ids"): vol.All(
            [vol.All(str, vol.Length(min=32, max=128))],
            vol.Length(min=1, max=MAX_CHANGES),
        ),
        vol.Required("operation_id"): vol.All(str, vol.Length(min=16, max=128)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_apply(hass, connection, msg) -> None:
    try:
        result = await _service(hass).async_apply(
            connection,
            msg["preview_id"],
            msg["change_ids"],
            msg["operation_id"],
        )
        connection.send_result(msg["id"], result)
    except Exception as err:  # noqa: BLE001
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/list_backups"})
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_list_backups(hass, connection, msg) -> None:
    try:
        connection.send_result(
            msg["id"],
            await _service(hass).async_list_backups(),
        )
    except Exception as err:  # noqa: BLE001
        _send_error(connection, msg["id"], err)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/restore",
        vol.Required("backup_id"): vol.Match(backup.BACKUP_ID_RE),
        vol.Required("operation_id"): vol.All(str, vol.Length(min=16, max=128)),
        vol.Required("confirmed"): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def _ws_restore(hass, connection, msg) -> None:
    try:
        result = await _service(hass).async_restore(
            connection,
            msg["backup_id"],
            msg["operation_id"],
            msg["confirmed"],
        )
        connection.send_result(msg["id"], result)
    except Exception as err:  # noqa: BLE001
        _send_error(connection, msg["id"], err)


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    """Register the integration-only command surface."""
    for handler in (
        _ws_targets,
        _ws_preview,
        _ws_apply,
        _ws_list_backups,
        _ws_restore,
    ):
        websocket_api.async_register_command(hass, handler)
