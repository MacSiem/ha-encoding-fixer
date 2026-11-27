"""Native integration lifecycle checks for optional diagnostics."""

from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.ha_encoding_fixer.const import DATA_WORKFLOW, DOMAIN


async def test_diagnostics_are_opt_in_and_survive_reload(hass):
    assert await async_setup_component(hass, "http", {})
    assert await async_setup_component(hass, "lovelace", {})
    entry = MockConfigEntry(domain=DOMAIN, data={}, unique_id=DOMAIN)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    registry = er.async_get(hass)
    for suffix in ("last_preview", "last_backup"):
        entity_id = registry.async_get_entity_id("sensor", DOMAIN, f"{entry.entry_id}_{suffix}")
        assert entity_id is not None
        assert registry.async_get(entity_id).disabled
        assert hass.states.get(entity_id) is None
    workflow = hass.data[DOMAIN][DATA_WORKFLOW]
    await workflow._diagnostics.async_record_preview(2, "partial")
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert await hass.config_entries.async_setup(entry.entry_id)
    restored = hass.data[DOMAIN][DATA_WORKFLOW]._diagnostics
    assert (restored.count, restored.completeness) == (2, "partial")
