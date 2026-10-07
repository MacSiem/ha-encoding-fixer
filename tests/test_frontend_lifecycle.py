"""UI ownership regression using production registration functions."""
import asyncio
import sys
import types
import unittest
from tests.test_file_workflow import _load, _load_websocket_module


class FrontendLifecycleTests(unittest.TestCase):
    def test_yaml_unload_removes_only_its_extra_module(self):
        _load_websocket_module()
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
        module = _load("encoding_fixer_security.frontend", "custom_components/ha_encoding_fixer/frontend.py")
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
