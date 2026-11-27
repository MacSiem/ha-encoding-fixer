"""Encoding Fixer frontend registration in a real Home Assistant core."""

from __future__ import annotations

from pathlib import Path

import pytest

from homeassistant.components import frontend
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.ha_encoding_fixer.const import (
    CARD_URL,
    DOMAIN,
    PANEL_URL_PATH,
    VERSION,
)
from custom_components.ha_encoding_fixer import frontend as encoding_frontend


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    assert await async_setup_component(hass, "http", {})
    assert await async_setup_component(hass, "lovelace", {})
    entry = MockConfigEntry(domain=DOMAIN, data={}, unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_fresh_setup_registers_one_resource_and_admin_panel(hass: HomeAssistant) -> None:
    await _setup(hass)
    resources = list(hass.data["lovelace"].resources.async_items())
    assert [(item["url"], item["type"]) for item in resources] == [
        (f"{CARD_URL}?v={VERSION}", "module")
    ]
    panel = hass.data[frontend.DATA_PANELS][PANEL_URL_PATH]
    assert panel.require_admin is True
    assert panel.config["_panel_custom"]["name"] == "ha-encoding-fixer-panel"


async def test_existing_hacs_resource_is_not_duplicated(hass: HomeAssistant) -> None:
    assert await async_setup_component(hass, "lovelace", {})
    resources = hass.data["lovelace"].resources
    await resources.async_load()
    resources.loaded = True
    hacs_url = "/hacsfiles/ha-encoding-fixer/ha-encoding-fixer.js?hacstag=1"
    await resources.async_create_item({"res_type": "module", "url": hacs_url})
    await _setup(hass)
    assert [item["url"] for item in resources.async_items()] == [hacs_url]
    panel = hass.data[frontend.DATA_PANELS][PANEL_URL_PATH]
    assert panel.config["_panel_custom"]["name"] == "ha-encoding-fixer-panel"
    assert panel.config["_panel_custom"]["module_url"] == f"{CARD_URL}?v={VERSION}"


async def test_upgrade_refreshes_versioned_resource(hass: HomeAssistant) -> None:
    assert await async_setup_component(hass, "lovelace", {})
    resources = hass.data["lovelace"].resources
    await resources.async_load()
    resources.loaded = True
    old = await resources.async_create_item(
        {"res_type": "module", "url": f"{CARD_URL}?v=6.0.3"}
    )
    await encoding_frontend._ownership(hass).save(
        [{"id": old["id"], "url": old["url"], "type": old["type"]}]
    )
    await _setup(hass)
    updated = list(resources.async_items())
    assert len(updated) == 1
    assert updated[0]["id"] == old["id"]
    assert updated[0]["url"] == f"{CARD_URL}?v={VERSION}"
    assert updated[0]["type"] == "module"


async def test_legacy_resource_serves_current_bundle_without_adoption(
    hass: HomeAssistant, hass_client,
) -> None:
    assert await async_setup_component(hass, "lovelace", {})
    resources = hass.data["lovelace"].resources
    await resources.async_load()
    resources.loaded = True
    old = await resources.async_create_item(
        {"res_type": "module", "url": f"{CARD_URL}?v=6.0.3"}
    )

    await _setup(hass)
    updated = {**old, "url": f"{CARD_URL}?v={VERSION}"}
    assert list(resources.async_items()) == [updated]

    client = await hass_client()
    response = await client.get(old["url"])
    assert response.status == 200
    bundled = Path(encoding_frontend.__file__).parent / "www" / encoding_frontend.CARD_FILENAME
    assert await response.read() == bundled.read_bytes()
    assert "max-age=2678400" not in response.headers.get("Cache-Control", "")

    await encoding_frontend.async_unregister_card(hass)
    assert list(resources.async_items()) == [updated]


async def test_manual_matching_url_is_not_adopted_or_changed(hass: HomeAssistant) -> None:
    assert await async_setup_component(hass, "lovelace", {})
    resources = hass.data["lovelace"].resources
    await resources.async_load()
    resources.loaded = True
    await resources.async_create_item({"res_type": "module", "url": CARD_URL})

    assert await encoding_frontend.async_register_card(hass) == "existing_resource"
    items = list(resources.async_items())
    assert len(items) == 1
    assert items[0]["url"] == CARD_URL
    await encoding_frontend.async_unregister_card(hass)
    assert list(resources.async_items()) == items


async def test_owned_resource_receipt_survives_owner_object_recreation(hass: HomeAssistant) -> None:
    await _setup(hass)
    resources = hass.data["lovelace"].resources
    before = list(resources.async_items())
    assert len(before) == 1

    hass.data.pop(encoding_frontend.DATA_OWNERSHIP)
    assert await encoding_frontend.async_register_card(hass) == "resource"
    after = list(resources.async_items())
    assert len(after) == 1
    assert after[0]["id"] == before[0]["id"]
    assert after[0]["url"] == before[0]["url"]


async def test_modified_owned_identity_is_preserved_on_removal(hass: HomeAssistant) -> None:
    await _setup(hass)
    resources = hass.data["lovelace"].resources
    owned = list(resources.async_items())[0]
    replacement = await resources.async_update_item(
        owned["id"], {"res_type": "css", "url": "/local/manual-encoding-fixer.js"}
    )

    await encoding_frontend.async_unregister_card(hass)
    assert list(resources.async_items()) == [replacement]


async def test_changed_id_same_url_is_not_adopted_or_removed(hass: HomeAssistant) -> None:
    await _setup(hass)
    resources = hass.data["lovelace"].resources
    original = list(resources.async_items())[0]
    await resources.async_delete_item(original["id"])
    replacement = await resources.async_create_item(
        {"res_type": "module", "url": original["url"]}
    )

    assert await encoding_frontend.async_register_card(hass) == "existing_resource"
    assert list(resources.async_items()) == [replacement]


async def test_incomplete_receipt_save_removes_only_unchanged_created_resource(
    hass: HomeAssistant, monkeypatch,
) -> None:
    assert await async_setup_component(hass, "lovelace", {})
    resources = hass.data["lovelace"].resources

    class UnconfirmedStore:
        async def async_load(self):
            return None

        async def async_save(self, _data):
            return None

    monkeypatch.setattr(
        encoding_frontend._ResourceOwnership, "store", lambda _state: UnconfirmedStore()
    )
    with pytest.raises(ValueError, match="save was not confirmed"):
        await encoding_frontend.async_register_card(hass)
    assert list(resources.async_items()) == []


async def test_taken_panel_path_survives_unload(hass: HomeAssistant) -> None:
    assert await async_setup_component(hass, "frontend", {})
    frontend.async_register_built_in_panel(
        hass, "iframe", sidebar_title="Other", sidebar_icon="mdi:web",
        frontend_url_path=PANEL_URL_PATH, config={"url": "/x"},
    )
    entry = await _setup(hass)
    assert hass.data[frontend.DATA_PANELS][PANEL_URL_PATH].component_name == "iframe"
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert PANEL_URL_PATH in hass.data[frontend.DATA_PANELS]


async def test_unload_removes_owned_resource_and_panel(hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert PANEL_URL_PATH not in hass.data[frontend.DATA_PANELS]
    assert list(hass.data["lovelace"].resources.async_items()) == []


async def test_yaml_fallback_unregisters_and_reload_restores_only_owned_url(hass: HomeAssistant) -> None:
    from custom_components.ha_encoding_fixer.frontend import async_register_card, async_unregister_card
    assert await async_setup_component(hass, "frontend", {})
    # Finish frontend's deferred HTTP startup before fixture shutdown flushes stores.
    await hass.async_block_till_done()
    hass.data["lovelace"] = {"mode": "yaml"}
    frontend.add_extra_js_url(hass, "/foreign.js")
    assert await async_register_card(hass) == "extra_js_url"
    assert f"{CARD_URL}?v={VERSION}" in hass.data[frontend.DATA_EXTRA_MODULE_URL].urls
    await async_unregister_card(hass)
    assert hass.data[frontend.DATA_EXTRA_MODULE_URL].urls == {"/foreign.js"}
    await async_unregister_card(hass)
    await async_register_card(hass)
    assert f"{CARD_URL}?v={VERSION}" in hass.data[frontend.DATA_EXTRA_MODULE_URL].urls
    await async_unregister_card(hass)
    assert hass.data[frontend.DATA_EXTRA_MODULE_URL].urls == {"/foreign.js"}
