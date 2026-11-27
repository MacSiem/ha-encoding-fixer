"""Opt-in aggregate diagnostics for Encoding Fixer."""

from __future__ import annotations

from datetime import timedelta

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .diagnostics import latest_restorable_backup

SCAN_INTERVAL = timedelta(seconds=30)


async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities) -> None:
    diagnostics = hass.data[DOMAIN][entry.entry_id]["diagnostics"]
    async_add_entities([PreviewSensor(entry.entry_id, diagnostics), BackupSensor(entry.entry_id)], True)


class PreviewSensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_translation_key = "last_preview"
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_entity_registry_enabled_default = False
    _attr_should_poll = False

    def __init__(self, entry_id, diagnostics) -> None:
        self._attr_unique_id = f"{entry_id}_last_preview"
        self._diagnostics = diagnostics

    @property
    def native_value(self):
        return self._diagnostics.count

    @property
    def extra_state_attributes(self):
        return {"completeness": self._diagnostics.completeness or "unknown"}

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(self._diagnostics.subscribe(self.async_write_ha_state))


class BackupSensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_translation_key = "last_backup"
    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_entity_registry_enabled_default = False
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, entry_id) -> None:
        self._attr_unique_id = f"{entry_id}_last_backup"
        self._attr_native_value = None

    async def async_update(self) -> None:
        self._attr_native_value = await self.hass.async_add_executor_job(latest_restorable_backup, self.hass)
