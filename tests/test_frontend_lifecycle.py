"""UI ownership regression using production registration functions."""
import asyncio
import sys
import types
import unittest
import importlib
from copy import deepcopy


class FrontendLifecycleTests(unittest.TestCase):
    def test_yaml_unload_removes_only_its_extra_module(self):
        boundary = sys.modules.get("test_file_workflow") or importlib.import_module("tests.test_file_workflow")
        boundary._load_websocket_module()
        core = sys.modules["homeassistant.core"]
        core.CoreState = types.SimpleNamespace(stopping="stopping")
        storage = types.ModuleType("homeassistant.helpers.storage")

        class EmptyStore:
            def __init__(self, *_args, **_kwargs):
                pass

            async def async_load(self):
                return None

            async def async_save(self, _value):
                return None

        storage.Store = EmptyStore
        sys.modules["homeassistant.helpers.storage"] = storage
        frontend = types.ModuleType("homeassistant.components.frontend")
        frontend.DATA_EXTRA_MODULE_URL = "extra_modules"
        frontend.add_extra_js_url = lambda hass, url: hass.data["extra_modules"].add(url)
        frontend.remove_extra_js_url = lambda hass, url: hass.data["extra_modules"].remove(url)
        panel = types.ModuleType("homeassistant.components.panel_custom")
        http = types.ModuleType("homeassistant.components.http")
        http.StaticPathConfig = object
        sys.modules["homeassistant.components.frontend"] = frontend
        sys.modules["homeassistant.components.panel_custom"] = panel
        sys.modules["homeassistant.components.http"] = http
        sys.modules["homeassistant.components"].frontend = frontend
        sys.modules["homeassistant.components"].panel_custom = panel
        module = boundary._load("encoding_fixer_security.frontend", "custom_components/ha_encoding_fixer/frontend.py")
        hass = types.SimpleNamespace(data={"lovelace": {"mode": "yaml"}, "extra_modules": {"/foreign.js"}})

        async def scenario():
            await module.async_register_card(hass)
            self.assertEqual(len(hass.data["extra_modules"]), 2)
            await module.async_unregister_card(hass)
            self.assertEqual(hass.data["extra_modules"], {"/foreign.js"})
            await module.async_unregister_card(hass)
            await module.async_register_card(hass)
            self.assertEqual(len(hass.data["extra_modules"]), 2)
            await module.async_unregister_card(hass)
            self.assertEqual(hass.data["extra_modules"], {"/foreign.js"})

        asyncio.run(scenario())

    def test_resource_receipts_preserve_manual_and_changed_resources(self):
        boundary = sys.modules.get("test_file_workflow") or importlib.import_module("tests.test_file_workflow")
        boundary._load_websocket_module()
        core = sys.modules["homeassistant.core"]
        core.CoreState = types.SimpleNamespace(stopping="stopping")
        storage = types.ModuleType("homeassistant.helpers.storage")
        persisted = {}

        class FakeStore:
            fail_save = False
            fail_next_save = False
            on_fail_save = None

            def __init__(self, *_args, **_kwargs):
                pass

            async def async_load(self):
                return deepcopy(persisted) if persisted else None

            async def async_save(self, value):
                if self.fail_save or self.fail_next_save:
                    type(self).fail_next_save = False
                    if type(self).on_fail_save is not None:
                        type(self).on_fail_save()
                    return
                persisted.clear()
                persisted.update(deepcopy(value))

        storage.Store = FakeStore
        sys.modules["homeassistant.helpers.storage"] = storage
        frontend = types.ModuleType("homeassistant.components.frontend")
        frontend.DATA_EXTRA_MODULE_URL = "extra_modules"
        frontend.DATA_PANELS = "panels"
        frontend.add_extra_js_url = lambda hass, url: hass.data["extra_modules"].add(url)
        frontend.remove_extra_js_url = lambda hass, url: hass.data["extra_modules"].remove(url)
        panel = types.ModuleType("homeassistant.components.panel_custom")
        http = types.ModuleType("homeassistant.components.http")
        http.StaticPathConfig = object
        sys.modules["homeassistant.components.frontend"] = frontend
        sys.modules["homeassistant.components.panel_custom"] = panel
        sys.modules["homeassistant.components.http"] = http
        sys.modules["homeassistant.components"].frontend = frontend
        sys.modules["homeassistant.components"].panel_custom = panel
        module = boundary._load("encoding_fixer_security.frontend", "custom_components/ha_encoding_fixer/frontend.py")

        class Resources:
            loaded = True

            def __init__(self):
                self.items = []
                self.next_id = 0

            def async_items(self):
                return deepcopy(self.items)

            async def async_create_item(self, value):
                self.next_id += 1
                item = {"id": str(self.next_id), "url": value["url"], "type": value["res_type"]}
                self.items.append(item)
                return deepcopy(item)

            async def async_update_item(self, item_id, value):
                item = next(item for item in self.items if item["id"] == item_id)
                item.update(url=value["url"], type=value["res_type"])
                return deepcopy(item)

            async def async_delete_item(self, item_id):
                self.items[:] = [item for item in self.items if item["id"] != item_id]

        async def scenario():
            resources = Resources()
            hass = types.SimpleNamespace(
                data={"lovelace": {"mode": "storage", "resources": resources}, "extra_modules": set()}, state="running"
            )

            # A matching URL without a creation receipt is a manual resource.
            resources.items.append({"id": "manual", "url": module.CARD_URL, "type": "module"})
            self.assertEqual(await module.async_register_card(hass), "existing_resource")
            self.assertIn(module.versioned_card_url(), hass.data["extra_modules"])
            await module.async_unregister_card(hass)
            self.assertEqual(hass.data["extra_modules"], set())
            self.assertEqual(resources.items[0]["id"], "manual")
            resources.items.clear()
            persisted.clear()

            # An unowned HACS resource is preserved; repeated setup adds no copy.
            manual_hacs = {
                "id": "hacs-manual", "url": "/hacsfiles/ha-encoding-fixer/ha-encoding-fixer.js?hacstag=1",
                "type": "module",
            }
            resources.items.append(manual_hacs.copy())
            self.assertEqual(await module.async_register_card(hass), "existing_resource")
            self.assertEqual(await module.async_register_card(hass), "existing_resource")
            self.assertEqual(resources.async_items(), [manual_hacs])
            resources.items.clear()

            # Upgrade changes only the URL of the exact receipt-owned ID.
            old_url = f"{module.CARD_URL}?v=5.9.0"
            resources.items.append({"id": "owned-old", "url": old_url, "type": "module"})
            persisted["owned_resources"] = [
                {"id": "owned-old", "url": old_url, "type": "module"}
            ]
            self.assertEqual(await module.async_register_card(hass), "resource")
            self.assertEqual(resources.async_items(), [{
                "id": "owned-old", "url": module.versioned_card_url(), "type": "module"
            }])
            resources.items.clear()
            persisted.clear()

            # The exact owned receipt survives recreation of the in-memory owner.
            self.assertEqual(await module.async_register_card(hass), "resource")
            owned = resources.async_items()[0]
            hass.data.pop(getattr(module, "DATA_OWNERSHIP", "encoding_fixer_frontend_ownership"), None)
            self.assertEqual(await module.async_register_card(hass), "resource")
            self.assertEqual(resources.async_items(), [owned])

            # Same ID with edited type/URL is no longer ours and survives removal.
            resources.items[0].update(url=module.CARD_URL, type="css")
            await module.async_unregister_card(hass)
            self.assertEqual(resources.async_items()[0]["type"], "css")

            # A replacement ID with the same URL is a manual entry, not ownership.
            resources.items.clear()
            persisted.clear()
            self.assertEqual(await module.async_register_card(hass), "resource")
            replaced_url = resources.items[0]["url"]
            resources.items[:] = [{"id": "replacement", "url": replaced_url, "type": "module"}]
            self.assertEqual(await module.async_register_card(hass), "existing_resource")
            await module.async_unregister_card(hass)
            self.assertEqual(resources.async_items(), [
                {"id": "replacement", "url": replaced_url, "type": "module"}
            ])

            # Failed durable receipt confirmation rolls back only our fresh entry.
            resources.items.clear()
            persisted.clear()
            FakeStore.fail_save = True
            with self.assertRaisesRegex(ValueError, "save was not confirmed"):
                await module.async_register_card(hass)
            self.assertEqual(resources.items, [])
            FakeStore.fail_save = False

            # If an upgrade's receipt write fails, roll back the exact owned
            # item to the still-durable old receipt before returning the error.
            old_url = f"{module.CARD_URL}?v=6.0.2"
            resources.items[:] = [{"id": "upgrade-save-fails", "url": old_url, "type": "module"}]
            persisted["owned_resources"] = [
                {"id": "upgrade-save-fails", "url": old_url, "type": "module"}
            ]
            FakeStore.fail_next_save = True
            with self.assertRaisesRegex(ValueError, "save was not confirmed"):
                await module.async_register_card(hass)
            self.assertEqual(resources.async_items(), [
                {"id": "upgrade-save-fails", "url": old_url, "type": "module"}
            ])
            self.assertEqual(persisted["owned_resources"], [
                {"id": "upgrade-save-fails", "url": old_url, "type": "module"}
            ])

            # Later user drift invalidates the old receipt and is preserved.
            resources.items[0]["url"] = "/user-edited-after-failed-upgrade.js"
            await module.async_unregister_card(hass)
            self.assertEqual(resources.async_items(), [{
                "id": "upgrade-save-fails", "url": "/user-edited-after-failed-upgrade.js", "type": "module"
            }])

            # A foreign edit that lands while receipt persistence fails is not
            # overwritten by the conditional rollback.
            concurrent_old_url = f"{module.CARD_URL}?v=5.8.0"
            resources.items[:] = [{"id": "upgrade-concurrent-edit", "url": concurrent_old_url, "type": "module"}]
            persisted["owned_resources"] = [
                {"id": "upgrade-concurrent-edit", "url": concurrent_old_url, "type": "module"}
            ]
            FakeStore.on_fail_save = lambda: resources.items[0].update(
                url="/concurrent-user-edit.js"
            )
            FakeStore.fail_next_save = True
            with self.assertRaisesRegex(ValueError, "save was not confirmed"):
                await module.async_register_card(hass)
            FakeStore.on_fail_save = None
            self.assertEqual(resources.async_items(), [{
                "id": "upgrade-concurrent-edit", "url": "/concurrent-user-edit.js", "type": "module"
            }])
            await module.async_unregister_card(hass)
            self.assertEqual(resources.async_items(), [{
                "id": "upgrade-concurrent-edit", "url": "/concurrent-user-edit.js", "type": "module"
            }])

        asyncio.run(scenario())
