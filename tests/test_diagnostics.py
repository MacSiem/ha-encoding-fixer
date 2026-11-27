"""Focused diagnostics privacy, lifecycle and inventory regression tests."""
import asyncio
import json
import os
import sys
import tempfile
import types
import unittest
from datetime import UTC
from pathlib import Path

from test_file_workflow import _Hass, _load, _load_websocket_module, backup, workflow

storage = types.ModuleType('homeassistant.helpers.storage')
class Store:
    data = {}
    def __init__(self, hass, version, key): self.key = key
    async def async_load(self): return self.data.get(self.key)
    async def async_save(self, value): self.data[self.key] = dict(value)
storage.Store = Store
sys.modules['homeassistant.helpers.storage'] = storage

diagnostics = _load('encoding_fixer_security.diagnostics', 'custom_components/ha_encoding_fixer/diagnostics.py')

class DiagnosticTests(unittest.TestCase):
    def setUp(self): Store.data.clear()

    def test_preview_persistence_unknown_and_minimal_data(self):
        async def run():
            state = diagnostics.Diagnostics(None, 'entry')
            await state.async_load()
            self.assertIsNone(state.count); self.assertIsNone(state.completeness)
            await state.async_record_preview(3, 'partial')
            self.assertEqual(Store.data[state._store.key], {'count': 3, 'completeness': 'partial'})
            loaded = diagnostics.Diagnostics(None, 'entry'); await loaded.async_load()
            self.assertEqual((loaded.count, loaded.completeness), (3, 'partial'))
            Store.data[state._store.key] = {'count': -1, 'completeness': 'complete', 'path': 'secret'}
            invalid = diagnostics.Diagnostics(None, 'entry'); await invalid.async_load()
            self.assertIsNone(invalid.count)
        asyncio.run(run())

    def test_real_backups_ignore_empty_and_offline_and_removed(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name); hass = _Hass(root)
            empty = backup.create_backup_dir(hass)
            self.assertIsNone(diagnostics.latest_restorable_backup(hass))
            target = root / 'configuration.yaml'; target.write_text('a: 1\n')
            bid = backup.create_backup_dir(hass); copy = backup.copy_file_to_backup(hass, bid, 'configuration.yaml')
            copy_path = root / copy.backup_relative_path
            os.utime(copy_path, (1700000000, 1700000000))
            value = diagnostics.latest_restorable_backup(hass)
            self.assertEqual(value.tzinfo, UTC); self.assertEqual(value.timestamp(), 1700000000)
            (root / backup.BACKUP_DIR_NAME / empty / '.storage').mkdir()
            (root / backup.BACKUP_DIR_NAME / empty / '.storage/core.entity_registry').write_text('{}')
            self.assertEqual(diagnostics.latest_restorable_backup(hass), value)
            copy_path.unlink()
            self.assertIsNone(diagnostics.latest_restorable_backup(hass))

    def test_preview_hook_only_completed_and_redacted(self):
        module = _load_websocket_module()
        async def run(root):
            class Hass(_Hass):
                async def async_add_executor_job(self, f, *args): return f(*args)
            hass = Hass(root); state = diagnostics.Diagnostics(hass, 'entry')
            service = module.EncodingFixerWorkflow(hass, state)
            conn = types.SimpleNamespace(user=types.SimpleNamespace(id='private-user'))
            result = await service.async_preview(conn, ['configuration'])
            self.assertEqual(result['completeness'], 'partial')
            self.assertEqual((state.count, state.completeness), (0, 'partial'))
            self.assertNotIn('private-user', json.dumps(Store.data))
            self.assertNotIn(str(root), json.dumps(Store.data))
            with self.assertRaises(workflow.WorkflowError): await service.async_preview(conn, ['invalid'])
            self.assertEqual((state.count, state.completeness), (0, 'partial'))
            await service.async_close()
        with tempfile.TemporaryDirectory() as name: asyncio.run(run(Path(name)))

    def test_sensor_defaults_and_values(self):
        _load_websocket_module()
        sensor_module = types.ModuleType('homeassistant.components.sensor')
        class SensorEntity: pass
        sensor_module.SensorEntity = SensorEntity
        sensor_module.SensorDeviceClass = types.SimpleNamespace(TIMESTAMP='timestamp')
        const_module = types.ModuleType('homeassistant.const')
        const_module.EntityCategory = types.SimpleNamespace(DIAGNOSTIC='diagnostic')
        sys.modules['homeassistant.components.sensor'] = sensor_module
        sys.modules['homeassistant.const'] = const_module
        sensor = _load('encoding_fixer_security.sensor', 'custom_components/ha_encoding_fixer/sensor.py')
        state = diagnostics.Diagnostics(None, 'entry')
        preview = sensor.PreviewSensor('entry', state); backups = sensor.BackupSensor('entry')
        self.assertFalse(preview._attr_entity_registry_enabled_default)
        self.assertFalse(backups._attr_entity_registry_enabled_default)
        self.assertIsNone(preview.native_value)
        self.assertEqual(preview.extra_state_attributes, {'completeness':'unknown'})
        self.assertNotEqual(preview._attr_unique_id, backups._attr_unique_id)
        self.assertEqual(preview._attr_entity_category, 'diagnostic')

    def test_package_skipped_symlink_is_partial(self):
        with tempfile.TemporaryDirectory() as name, tempfile.TemporaryDirectory() as outside:
            root = Path(name); packages = root / 'packages'; packages.mkdir()
            (packages / 'good.yaml').write_text('name: good\n')
            (packages / 'hidden.yaml').symlink_to(Path(outside) / 'private.yaml')
            preview = workflow.build_file_preview(root, ['packages'])
            self.assertEqual(preview['completeness'], 'complete')
            self.assertEqual(diagnostics.preview_completeness(root, ['packages'], preview), 'partial')
