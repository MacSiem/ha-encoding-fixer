"""Security regression contract for Encoding Fixer's file workflow."""

from __future__ import annotations

import asyncio
import functools
import importlib.util
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _load(name: str, relative_path: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative_path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


package = types.ModuleType("encoding_fixer_security")
package.__path__ = [str(ROOT / "custom_components/ha_encoding_fixer")]
sys.modules[package.__name__] = package
scanner = _load(
    "encoding_fixer_security.scanner",
    "custom_components/ha_encoding_fixer/scanner.py",
)
backup = _load(
    "encoding_fixer_security.backup",
    "custom_components/ha_encoding_fixer/backup.py",
)
workflow = _load(
    "encoding_fixer_security.workflow",
    "custom_components/ha_encoding_fixer/workflow.py",
)


def _load_websocket_module():
    try:
        import voluptuous  # noqa: F401
    except ImportError:
        voluptuous = types.ModuleType("voluptuous")
        voluptuous.Required = lambda key: key
        voluptuous.All = lambda *items: items[-1] if items else object()
        voluptuous.Length = lambda **_kwargs: object()
        voluptuous.Match = lambda pattern: pattern
        sys.modules["voluptuous"] = voluptuous

    websocket_stub = types.ModuleType("homeassistant.components.websocket_api")

    def identity_decorator(_schema=None):
        return lambda function: function

    def require_admin(function):
        @functools.wraps(function)
        async def guarded(hass, connection, msg):
            if not getattr(getattr(connection, "user", None), "is_admin", False):
                connection.send_error(msg["id"], "unauthorized", "Unauthorized")
                return None
            return await function(hass, connection, msg)

        return guarded

    websocket_stub.websocket_command = identity_decorator
    websocket_stub.async_response = lambda function: function
    websocket_stub.require_admin = require_admin
    websocket_stub.ActiveConnection = object
    websocket_stub.async_register_command = lambda *_args: None

    homeassistant = types.ModuleType("homeassistant")
    components = types.ModuleType("homeassistant.components")
    components.websocket_api = websocket_stub
    core = types.ModuleType("homeassistant.core")
    core.HomeAssistant = object
    core.callback = lambda function: function
    helpers = types.ModuleType("homeassistant.helpers")
    entity_registry = types.ModuleType("homeassistant.helpers.entity_registry")
    entity_registry.async_get = lambda hass: hass.registry
    helpers.entity_registry = entity_registry
    sys.modules.update(
        {
            "homeassistant": homeassistant,
            "homeassistant.components": components,
            "homeassistant.components.websocket_api": websocket_stub,
            "homeassistant.core": core,
            "homeassistant.helpers": helpers,
            "homeassistant.helpers.entity_registry": entity_registry,
        }
    )
    return _load(
        "encoding_fixer_security.websocket_api",
        "custom_components/ha_encoding_fixer/websocket_api.py",
    )


class _Config:
    def __init__(self, root: Path) -> None:
        self.root = root

    def path(self, relative_path: str | None = None) -> str:
        return str(self.root / relative_path) if relative_path else str(self.root)


class _Hass:
    def __init__(self, root: Path) -> None:
        self.config = _Config(root)


class ContainmentTests(unittest.TestCase):
    def test_recursive_scan_does_not_follow_escaping_file_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as root_name, tempfile.TemporaryDirectory() as outside_name:
            root = Path(root_name)
            packages = root / "packages"
            packages.mkdir()
            outside = Path(outside_name) / "private.yaml"
            outside.write_text("password: SENTINEL_SECRET_WÅ‚Ä…CZ\n")
            (packages / "escape.yaml").symlink_to(outside)

            result = scanner.scan_config_files(root)

            self.assertNotIn("SENTINEL_SECRET", json.dumps(result))
            self.assertFalse(
                any(change.get("file") == "packages/escape.yaml" for change in result["changes"])
            )

    def test_recursive_scan_does_not_follow_escaping_directory_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as root_name, tempfile.TemporaryDirectory() as outside_name:
            root = Path(root_name)
            outside = Path(outside_name)
            (outside / "private.yaml").write_text("name: WÅ‚Ä…cznik\n")
            (root / "packages").symlink_to(outside, target_is_directory=True)

            result = scanner.scan_config_files(root)

            self.assertEqual(result["changes"], [])

    def test_raw_path_validator_rejects_drive_encoding_nul_and_parent(self) -> None:
        for unsafe in (
            "C:\\config\\configuration.yaml",
            "%2e%2e/secrets.yaml",
            "packages/%2E%2E/secrets.yaml",
            "packages/evil.yaml\x00ignored",
            "../secrets.yaml",
        ):
            with self.subTest(unsafe=unsafe):
                with self.assertRaises(ValueError):
                    backup.validate_relative_path(unsafe)

    def test_backup_rejects_source_file_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as root_name, tempfile.TemporaryDirectory() as outside_name:
            root = Path(root_name)
            outside = Path(outside_name) / "secret.yaml"
            outside.write_text("token: SENTINEL_SECRET\n")
            (root / "configuration.yaml").symlink_to(outside)
            hass = _Hass(root)
            backup_id = backup.create_backup_dir(hass)

            with self.assertRaises((OSError, ValueError)):
                backup.copy_file_to_backup(hass, backup_id, "configuration.yaml")

    def test_restore_rejects_backup_file_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as root_name, tempfile.TemporaryDirectory() as outside_name:
            root = Path(root_name)
            hass = _Hass(root)
            backup_id = backup.create_backup_dir(hass)
            outside = Path(outside_name) / "secret.yaml"
            outside.write_text("token: SENTINEL_SECRET\n")
            source = root / backup.BACKUP_DIR_NAME / backup_id / "configuration.yaml"
            source.parent.mkdir(parents=True, exist_ok=True)
            source.symlink_to(outside)

            with self.assertRaises((OSError, ValueError)):
                backup.restore_file_from_backup(hass, backup_id, "configuration.yaml")


class RedactionTests(unittest.TestCase):
    def test_scan_result_never_returns_raw_line_or_secret(self) -> None:
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            (root / "configuration.yaml").write_text(
                "api_token: SENTINEL_SECRET_WÅ‚Ä…CZ\n",
                encoding="utf-8",
            )

            result = scanner.scan_config_files(root)
            payload = json.dumps(result, ensure_ascii=False)

            self.assertNotIn("SENTINEL_SECRET", payload)
            self.assertNotIn("api_token", payload)


class TransactionTests(unittest.TestCase):
    def _preview(self, root: Path, targets: list[str]) -> dict:
        return workflow.build_file_preview(root, targets)

    def test_nested_package_backup_is_safe_and_metadata_is_redacted(self) -> None:
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            target = root / "packages/rooms/lights.yaml"
            target.parent.mkdir(parents=True)
            target.write_text("name: WÅ‚Ä…cznik\n", encoding="utf-8")
            hass = _Hass(root)
            backup_id = backup.create_backup_dir(hass)

            copied = backup.copy_file_to_backup(
                hass, backup_id, "packages/rooms/lights.yaml"
            )
            listed = backup.list_backups(hass)

            self.assertTrue((root / copied.backup_relative_path).is_file())
            self.assertEqual(
                listed,
                [{"backup_id": backup_id, "file_count": 1, "restorable": True}],
            )
            self.assertNotIn("packages", json.dumps(listed))
            self.assertEqual(
                (root / backup.BACKUP_DIR_NAME).stat().st_mode & 0o777,
                0o700,
            )
            self.assertEqual(
                (root / backup.BACKUP_DIR_NAME / backup_id).stat().st_mode & 0o777,
                0o700,
            )

    def test_restore_rejects_file_outside_content_allowlist(self) -> None:
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            hass = _Hass(root)
            backup_id = backup.create_backup_dir(hass)
            rogue = root / backup.BACKUP_DIR_NAME / backup_id / "secrets.yaml"
            rogue.write_text("token: SENTINEL_SECRET\n", encoding="utf-8")

            with self.assertRaises(ValueError):
                backup.restore_backup(hass, backup_id)
            self.assertFalse((root / "secrets.yaml").exists())

    def test_restore_matches_scanner_exclusions_inside_packages(self) -> None:
        for relative_path in (
            "packages/secrets.yaml",
            "packages/rooms/secrets.yaml",
            "packages/deps/unsafe.yaml",
            "packages/__pycache__/unsafe.yml",
        ):
            with self.subTest(relative_path=relative_path):
                with self.assertRaises(ValueError):
                    backup.validate_backup_content_path(relative_path)

    def test_live_restore_rejects_entity_registry_backing_store(self) -> None:
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            storage = root / ".storage"
            storage.mkdir()
            registry = storage / "core.entity_registry"
            registry.write_text('{"data":{"entities":[]}}', encoding="utf-8")
            hass = _Hass(root)
            backup_id = backup.create_backup_dir(hass)
            backup.copy_file_to_backup(
                hass, backup_id, ".storage/core.entity_registry"
            )

            with self.assertRaisesRegex(ValueError, "offline recovery"):
                backup.restore_backup(hass, backup_id)
            self.assertFalse(backup.list_backups(hass)[0]["restorable"])

    def test_preview_and_apply_never_return_raw_content(self) -> None:
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            target = root / "configuration.yaml"
            target.write_text(
                "api_token: SENTINEL_SECRET_WÅ‚Ä…CZ\nname: WÅ‚Ä…cznik\n",
                encoding="utf-8",
            )
            hass = _Hass(root)
            preview = self._preview(root, ["configuration"])
            public_payload = json.dumps(preview["findings"], ensure_ascii=False)
            self.assertNotIn("SENTINEL_SECRET", public_payload)
            self.assertNotIn("api_token", public_payload)

            backup_id = backup.create_backup_dir(hass)
            selected = {preview["findings"][0]["change_id"]}
            plans = workflow.prepare_file_transaction(
                hass, preview, selected, backup_id
            )
            results = workflow.commit_file_transaction(hass, plans)

            self.assertEqual(results[0]["target_id"], "configuration")
            self.assertNotIn("SENTINEL_SECRET", json.dumps(results))
            updated = target.read_text(encoding="utf-8")
            self.assertIn("name: Włącznik", updated)
            self.assertIn("api_token: SENTINEL_SECRET_WÅ‚Ä…CZ", updated)

    def test_arbitrary_secret_like_values_are_not_rewritten(self) -> None:
        text = (
            "password: WÅ‚Ä…cznik\n"
            "token: ZaÅ¼Ã³Å‚Ä‡\n"
            "url: https://example.invalid/WÅ‚Ä…cznik\n"
            "name: WÅ‚Ä…cznik\n"
        )

        fixed, changes = scanner.build_file_changes("configuration.yaml", text)

        self.assertIn("password: WÅ‚Ä…cznik", fixed)
        self.assertIn("token: ZaÅ¼Ã³Å‚Ä‡", fixed)
        self.assertIn("url: https://example.invalid/WÅ‚Ä…cznik", fixed)
        self.assertIn("name: Włącznik", fixed)
        self.assertEqual([change["line"] for change in changes], [4])


class RuntimeBoundaryTests(unittest.TestCase):
    def _preview(self, root: Path, targets: list[str]) -> dict:
        return workflow.build_file_preview(root, targets)

    def test_non_admin_decorator_blocks_before_handler_side_effect(self) -> None:
        websocket_module = _load_websocket_module()
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)

            class FakeHass(_Hass):
                def __init__(self, config_root: Path) -> None:
                    super().__init__(config_root)
                    self.data = {websocket_module.DOMAIN: {}}

            hass = FakeHass(root)
            service = websocket_module.EncodingFixerWorkflow(hass)
            reached = 0

            async def forbidden_side_effect(*_args, **_kwargs):
                nonlocal reached
                reached += 1
                return {}

            service.async_preview = forbidden_side_effect
            hass.data[websocket_module.DOMAIN][websocket_module.DATA_WORKFLOW] = service

            class Connection:
                user = types.SimpleNamespace(id="user-1", is_admin=False)

                def __init__(self) -> None:
                    self.errors = []

                def send_error(self, *args) -> None:
                    self.errors.append(args)

            connection = Connection()
            asyncio.run(
                websocket_module._ws_preview(
                    hass,
                    connection,
                    {"id": 1, "target_ids": ["configuration"]},
                )
            )

            self.assertEqual(reached, 0)
            self.assertEqual(connection.errors[0][1], "unauthorized")

    def test_blocking_catalog_and_preview_work_run_in_executor(self) -> None:
        websocket_module = _load_websocket_module()
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            (root / "configuration.yaml").write_text(
                "name: WÅ‚Ä…cznik\n", encoding="utf-8"
            )

            class FakeHass(_Hass):
                def __init__(self, config_root: Path) -> None:
                    super().__init__(config_root)
                    self.executor_calls = []
                    self.data = {websocket_module.DOMAIN: {}}

                async def async_add_executor_job(self, function, *args):
                    self.executor_calls.append(function)
                    return function(*args)

            hass = FakeHass(root)
            service = websocket_module.EncodingFixerWorkflow(hass)
            connection = types.SimpleNamespace(
                user=types.SimpleNamespace(id="admin-1", is_admin=True)
            )

            asyncio.run(service.async_targets())
            result = asyncio.run(
                service.async_preview(connection, ["configuration"])
            )

            self.assertGreaterEqual(len(hass.executor_calls), 2)
            self.assertEqual(result["findings"][0]["target_id"], "configuration")
            self.assertNotIn("WÅ", json.dumps(result, ensure_ascii=False))

    def test_stale_preview_fails_before_backup_or_write(self) -> None:
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            target = root / "configuration.yaml"
            target.write_text("name: WÅ‚Ä…cznik\n", encoding="utf-8")
            hass = _Hass(root)
            preview = self._preview(root, ["configuration"])
            target.write_text("name: changed elsewhere\n", encoding="utf-8")
            backup_id = backup.create_backup_dir(hass)

            with self.assertRaisesRegex(workflow.WorkflowError, "stale_preview"):
                workflow.prepare_file_transaction(
                    hass,
                    preview,
                    {preview["findings"][0]["change_id"]},
                    backup_id,
                )

            backup_root = root / backup.BACKUP_DIR_NAME / backup_id
            self.assertEqual(list(backup_root.rglob("*")), [])
            self.assertEqual(target.read_text(), "name: changed elsewhere\n")

    def test_all_candidates_validate_before_any_backup(self) -> None:
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            (root / "configuration.yaml").write_text(
                "name: WÅ‚Ä…cznik\n", encoding="utf-8"
            )
            (root / "automations.yaml").write_text(
                "name: WÅ‚Ä…cznik\n", encoding="utf-8"
            )
            hass = _Hass(root)
            preview = self._preview(root, ["configuration", "automations"])
            selected = {finding["change_id"] for finding in preview["findings"]}
            backup_id = backup.create_backup_dir(hass)
            calls = 0

            def validator(_root: Path, _path: str, _content: bytes) -> None:
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise workflow.WorkflowError("invalid_yaml")

            with self.assertRaisesRegex(workflow.WorkflowError, "invalid_yaml"):
                workflow.prepare_file_transaction(
                    hass,
                    preview,
                    selected,
                    backup_id,
                    validator=validator,
                )

            backup_root = root / backup.BACKUP_DIR_NAME / backup_id
            self.assertEqual(list(backup_root.rglob("*")), [])

    def test_partial_write_failure_rolls_back_exact_original_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            originals = {
                "configuration.yaml": b"name: W\xc3\x85\xe2\x80\x9a\xc3\x84\xe2\x80\xa6cznik\n",
                "automations.yaml": b"name: W\xc3\x85\xe2\x80\x9a\xc3\x84\xe2\x80\xa6cznik\n",
            }
            for relative, content in originals.items():
                (root / relative).write_bytes(content)
            hass = _Hass(root)
            preview = self._preview(root, ["configuration", "automations"])
            selected = {finding["change_id"] for finding in preview["findings"]}
            backup_id = backup.create_backup_dir(hass)
            plans = workflow.prepare_file_transaction(
                hass, preview, selected, backup_id
            )
            original_write = backup.atomic_write_config_file
            failed = False

            def fail_once(hass_obj, relative_path, data, mode):
                nonlocal failed
                if relative_path == "configuration.yaml" and not failed:
                    failed = True
                    raise OSError("injected")
                return original_write(hass_obj, relative_path, data, mode)

            backup.atomic_write_config_file = fail_once
            try:
                with self.assertRaisesRegex(workflow.WorkflowError, "write_failed"):
                    workflow.commit_file_transaction(hass, plans)
            finally:
                backup.atomic_write_config_file = original_write

            for relative, content in originals.items():
                self.assertEqual((root / relative).read_bytes(), content)

    def test_post_write_yaml_validation_failure_restores_exact_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            target = root / "configuration.yaml"
            original = b"name: W\xc3\x85\xe2\x80\x9a\xc3\x84\xe2\x80\xa6cznik\r\n"
            target.write_bytes(original)
            hass = _Hass(root)
            preview = self._preview(root, ["configuration"])
            backup_id = backup.create_backup_dir(hass)
            plans = workflow.prepare_file_transaction(
                hass,
                preview,
                {preview["findings"][0]["change_id"]},
                backup_id,
                validator=lambda *_args: None,
            )

            def reject_after_write(*_args) -> None:
                raise workflow.WorkflowError("invalid_yaml")

            with self.assertRaisesRegex(workflow.WorkflowError, "invalid_yaml"):
                workflow.commit_file_transaction(
                    hass,
                    plans,
                    validator=reject_after_write,
                )

            self.assertEqual(target.read_bytes(), original)

    def test_operation_retry_replays_result_without_second_write(self) -> None:
        websocket_module = _load_websocket_module()
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            target = root / "configuration.yaml"
            target.write_text("name: WÅ‚Ä…cznik\n", encoding="utf-8")

            class FakeHass(_Hass):
                def __init__(self, config_root: Path) -> None:
                    super().__init__(config_root)
                    self.data = {websocket_module.DOMAIN: {}}

                async def async_add_executor_job(self, function, *args):
                    return function(*args)

            hass = FakeHass(root)
            service = websocket_module.EncodingFixerWorkflow(hass)
            connection = types.SimpleNamespace(
                user=types.SimpleNamespace(id="admin-1", is_admin=True)
            )

            async def scenario():
                preview = await service.async_preview(connection, ["configuration"])
                change_ids = [item["change_id"] for item in preview["findings"]]
                operation_id = "operation-1234567890"
                first = await service.async_apply(
                    connection, preview["preview_id"], change_ids, operation_id
                )
                second = await service.async_apply(
                    connection, preview["preview_id"], change_ids, operation_id
                )
                return first, second

            first, second = asyncio.run(scenario())
            backup_dirs = list((root / backup.BACKUP_DIR_NAME).iterdir())
            self.assertEqual(first, second)
            self.assertEqual(len(backup_dirs), 1)
            self.assertEqual(target.read_text(encoding="utf-8"), "name: Włącznik\n")

    def test_cancelled_mixed_apply_restores_files_and_entities(self) -> None:
        websocket_module = _load_websocket_module()

        class Registry:
            def __init__(self) -> None:
                entry = types.SimpleNamespace(
                    entity_id="light.demo",
                    name="WÅ‚Ä…cznik",
                )
                self.entities = {entry.entity_id: entry}

            def async_get(self, entity_id: str):
                return self.entities.get(entity_id)

            def async_update_entity(self, entity_id: str, *, name: str) -> None:
                self.entities[entity_id].name = name

        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            target = root / "configuration.yaml"
            original = "name: WÅ‚Ä…cznik\n"
            target.write_text(original, encoding="utf-8")
            storage = root / ".storage"
            storage.mkdir()
            (storage / "core.entity_registry").write_text(
                '{"data":{"entities":[]}}',
                encoding="utf-8",
            )

            async def scenario() -> None:
                commit_started = asyncio.Event()
                release_commit = asyncio.Event()

                class FakeHass(_Hass):
                    def __init__(self, config_root: Path) -> None:
                        super().__init__(config_root)
                        self.data = {websocket_module.DOMAIN: {}}
                        self.registry = Registry()

                    async def async_add_executor_job(self, function, *args):
                        if function is websocket_module.workflow.commit_file_transaction:
                            commit_started.set()
                            await release_commit.wait()
                        return function(*args)

                hass = FakeHass(root)
                service = websocket_module.EncodingFixerWorkflow(hass)
                connection = types.SimpleNamespace(
                    user=types.SimpleNamespace(id="admin-1", is_admin=True)
                )
                preview = await service.async_preview(
                    connection,
                    ["configuration", "entity_registry"],
                )
                task = asyncio.create_task(
                    service.async_apply(
                        connection,
                        preview["preview_id"],
                        [item["change_id"] for item in preview["findings"]],
                        "operation-cancel-123456789",
                    )
                )
                await asyncio.wait_for(commit_started.wait(), timeout=2)
                task.cancel()
                await asyncio.sleep(0)
                await asyncio.sleep(0)
                task.cancel()
                release_commit.set()
                with self.assertRaises(asyncio.CancelledError):
                    await task

                self.assertEqual(
                    hass.registry.async_get("light.demo").name,
                    "WÅ‚Ä…cznik",
                )
                self.assertEqual(target.read_text(encoding="utf-8"), original)
                self.assertEqual(service._operations, {})

            asyncio.run(scenario())

    def test_close_rejects_new_work_and_drains_inflight_apply(self) -> None:
        websocket_module = _load_websocket_module()

        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            target = root / "configuration.yaml"
            target.write_text("name: WÅ‚Ä…cznik\n", encoding="utf-8")

            async def scenario() -> None:
                commit_started = asyncio.Event()
                release_commit = asyncio.Event()

                class FakeHass(_Hass):
                    def __init__(self, config_root: Path) -> None:
                        super().__init__(config_root)
                        self.data = {websocket_module.DOMAIN: {}}

                    async def async_add_executor_job(self, function, *args):
                        if function is websocket_module.workflow.commit_file_transaction:
                            commit_started.set()
                            await release_commit.wait()
                        return function(*args)

                hass = FakeHass(root)
                service = websocket_module.EncodingFixerWorkflow(hass)
                connection = types.SimpleNamespace(
                    user=types.SimpleNamespace(id="admin-1", is_admin=True)
                )
                preview = await service.async_preview(connection, ["configuration"])
                apply_task = asyncio.create_task(
                    service.async_apply(
                        connection,
                        preview["preview_id"],
                        [item["change_id"] for item in preview["findings"]],
                        "operation-close-1234567890",
                    )
                )
                await asyncio.wait_for(commit_started.wait(), timeout=2)
                close_task = asyncio.create_task(service.async_close())
                await asyncio.sleep(0)

                self.assertFalse(close_task.done())
                with self.assertRaisesRegex(
                    workflow.WorkflowError,
                    "integration_unavailable",
                ):
                    await service.async_targets()

                release_commit.set()
                result = await apply_task
                await close_task

                self.assertEqual(result["status"], "success")
                self.assertEqual(target.read_text(encoding="utf-8"), "name: Włącznik\n")
                self.assertEqual(service._previews, {})
                self.assertEqual(service._operations, {})
                with self.assertRaisesRegex(
                    workflow.WorkflowError,
                    "integration_unavailable",
                ):
                    await service.async_preview(connection, ["configuration"])

            asyncio.run(scenario())

    def test_post_preview_symlink_swap_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as root_name, tempfile.TemporaryDirectory() as outside_name:
            root = Path(root_name)
            target = root / "configuration.yaml"
            target.write_text("name: WÅ‚Ä…cznik\n", encoding="utf-8")
            outside = Path(outside_name) / "outside.yaml"
            outside.write_text("token: SENTINEL_SECRET\n", encoding="utf-8")
            preview = self._preview(root, ["configuration"])
            target.unlink()
            target.symlink_to(outside)
            hass = _Hass(root)
            backup_id = backup.create_backup_dir(hass)

            with self.assertRaisesRegex(
                workflow.WorkflowError, "unsafe_or_unavailable_target"
            ):
                workflow.prepare_file_transaction(
                    hass,
                    preview,
                    {preview["findings"][0]["change_id"]},
                    backup_id,
                )
            self.assertEqual(outside.read_text(), "token: SENTINEL_SECRET\n")


if __name__ == "__main__":
    unittest.main()
