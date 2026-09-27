"""HA Encoding Fixer integration entry points."""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    DATA_FRONTEND_REGISTERED,
    DATA_PANEL_REGISTERED,
    DATA_WORKFLOW,
    DATA_WS_REGISTERED,
    DOMAIN,
)
from .frontend import (
    async_register_card,
    async_register_panel,
    async_register_static,
    async_unregister_card,
    async_unregister_panel,
)
from .websocket_api import EncodingFixerWorkflow, async_register_commands

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up HA Encoding Fixer from a config entry."""
    bucket = hass.data.setdefault(DOMAIN, {})
    bucket[entry.entry_id] = {}
    if DATA_WORKFLOW not in bucket:
        bucket[DATA_WORKFLOW] = EncodingFixerWorkflow(hass)

    if not bucket.get(DATA_WS_REGISTERED):
        async_register_commands(hass)
        bucket[DATA_WS_REGISTERED] = True

    if not bucket.get(DATA_FRONTEND_REGISTERED):
        await async_register_static(hass)
        await async_register_card(hass)
        bucket[DATA_FRONTEND_REGISTERED] = True
    if not bucket.get(DATA_PANEL_REGISTERED):
        bucket[DATA_PANEL_REGISTERED] = await async_register_panel(hass)
    _LOGGER.debug("HA Encoding Fixer set up (entry_id=%s)", entry.entry_id)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload the config entry."""
    bucket = hass.data.get(DOMAIN, {})
    bucket.pop(entry.entry_id, None)
    loaded_entry_ids = {
        key
        for key in bucket
        if key
        not in {
            DATA_FRONTEND_REGISTERED,
            DATA_PANEL_REGISTERED,
            DATA_WS_REGISTERED,
            DATA_WORKFLOW,
        }
    }
    if not loaded_entry_ids:
        # WebSocket command registration is process-wide and intentionally
        # remains deduplicated. Close first so already captured handlers drain
        # before a later setup can create a workflow with an independent lock.
        service = bucket.get(DATA_WORKFLOW)
        if isinstance(service, EncodingFixerWorkflow):
            await service.async_close()
        if bucket.get(DATA_WORKFLOW) is service:
            bucket.pop(DATA_WORKFLOW, None)
        if bucket.pop(DATA_PANEL_REGISTERED, False):
            async_unregister_panel(hass)
        if bucket.pop(DATA_FRONTEND_REGISTERED, False):
            await async_unregister_card(hass)
    _LOGGER.debug("HA Encoding Fixer unloaded (entry_id=%s)", entry.entry_id)
    return True
