"""HA Encoding Fixer integration entry points."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    CARD_FILENAME,
    CARD_PACKAGE_DIR,
    CARD_URL_PATH,
    DATA_FRONTEND_REGISTERED,
    DATA_WORKFLOW,
    DATA_WS_REGISTERED,
    DOMAIN,
    VERSION,
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

    await _async_register_frontend(hass)
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
    _LOGGER.debug("HA Encoding Fixer unloaded (entry_id=%s)", entry.entry_id)
    return True


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Register the bundled Lovelace card."""
    bucket = hass.data.setdefault(DOMAIN, {})
    if bucket.get(DATA_FRONTEND_REGISTERED):
        return

    card_dir = Path(__file__).parent / CARD_PACKAGE_DIR
    card_path = card_dir / CARD_FILENAME
    if not await hass.async_add_executor_job(card_path.is_file):
        _LOGGER.error("Bundled card file missing at %s", card_path)
        return

    await hass.http.async_register_static_paths(
        [StaticPathConfig(f"/{DOMAIN}", str(card_dir), cache_headers=False)]
    )
    add_extra_js_url(hass, f"{CARD_URL_PATH}?v={VERSION}")
    bucket[DATA_FRONTEND_REGISTERED] = True
    _LOGGER.debug("Registered Lovelace card at %s", CARD_URL_PATH)
