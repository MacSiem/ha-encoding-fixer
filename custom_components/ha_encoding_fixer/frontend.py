"""Serve the bundled card and register it with Lovelace and the sidebar."""

from __future__ import annotations

import logging
import asyncio
from copy import deepcopy
from pathlib import Path
from typing import Any

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import CoreState, HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    CARD_ELEMENT,
    CARD_FILENAME,
    CARD_URL,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    STATIC_URL_BASE,
    VERSION,
)

_LOGGER = logging.getLogger(__name__)

DATA_STATIC = "ha_encoding_fixer_static_registered"
DATA_EXTRA_URL = "ha_encoding_fixer_extra_url"
DATA_OWNERSHIP = "ha_encoding_fixer_frontend_ownership"
OWNERSHIP_KEY = "ha_encoding_fixer.frontend"


class _ResourceOwnership:
    """Serialize changes and keep durable receipts for resources we create."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.lock = asyncio.Lock()

    def store(self) -> Store:
        return Store(self.hass, 1, OWNERSHIP_KEY, private=True, atomic_writes=True)

    async def load(self) -> list[dict[str, str]]:
        data = await self.store().async_load()
        if data is None:
            return []
        records = data.get("owned_resources") if isinstance(data, dict) else None
        if not isinstance(records, list) or any(
            not isinstance(record, dict)
            or any(not isinstance(record.get(key), str) or not record[key]
                   for key in ("id", "url", "type"))
            for record in records
        ):
            raise ValueError("Invalid Encoding Fixer resource ownership receipt")
        return deepcopy(records)

    async def save(self, records: list[dict[str, str]]) -> None:
        if self.hass.state is CoreState.stopping:
            raise ValueError("Cannot save resource ownership while HA is stopping")
        data = {"owned_resources": deepcopy(records)}
        await self.store().async_save(data)
        if await self.store().async_load() != data:
            raise ValueError("Encoding Fixer resource ownership save was not confirmed")


def _ownership(hass: HomeAssistant) -> _ResourceOwnership:
    if DATA_OWNERSHIP not in hass.data:
        hass.data[DATA_OWNERSHIP] = _ResourceOwnership(hass)
    return hass.data[DATA_OWNERSHIP]


def _receipt(item: dict[str, Any]) -> dict[str, str]:
    return {key: item[key] for key in ("id", "url", "type")}


async def _reconcile_owned(state: _ResourceOwnership, resources: Any) -> list[dict[str, str]]:
    saved = await state.load()
    # Store I/O yields; re-read the collection afterward to avoid stale ownership.
    current = {item["id"]: item for item in resources.async_items()}
    owned = [record for record in saved if record["id"] in current
             and all(current[record["id"]].get(key) == record[key]
                     for key in ("url", "type"))]
    if owned != saved:
        await state.save(owned)
    return owned


async def _delete_owned(
    state: _ResourceOwnership, resources: Any,
    owned: list[dict[str, str]], record: dict[str, str],
) -> None:
    remaining = [item for item in owned if item["id"] != record["id"]]
    current = next((item for item in resources.async_items()
                    if item.get("id") == record["id"]), None)
    if current is not None and _receipt(current) == record:
        await resources.async_delete_item(record["id"])
    await state.save(remaining)
    owned[:] = remaining


def versioned_card_url() -> str:
    """Return the cache-busting URL of the bundled card."""
    return f"{CARD_URL}?v={VERSION}"


async def async_register_static(hass: HomeAssistant) -> None:
    """Serve custom_components/ha_encoding_fixer/www once per HA run."""
    if hass.data.get(DATA_STATIC):
        return
    www = Path(__file__).parent / "www"
    if not await hass.async_add_executor_job((www / CARD_FILENAME).is_file):
        raise FileNotFoundError(f"Bundled Encoding Fixer card missing: {CARD_FILENAME}")
    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_URL_BASE, str(www), cache_headers=False)]
    )
    hass.data[DATA_STATIC] = True


def _resources(hass: HomeAssistant) -> Any | None:
    lovelace = hass.data.get("lovelace")
    if lovelace is None:
        return None
    return getattr(lovelace, "resources", None) or (
        lovelace.get("resources") if isinstance(lovelace, dict) else None
    )


def _lovelace_mode(hass: HomeAssistant) -> str | None:
    lovelace = hass.data.get("lovelace")
    if lovelace is None:
        return None
    for attr in ("resource_mode", "mode"):
        if (mode := getattr(lovelace, attr, None)) is not None:
            return mode
    return lovelace.get("mode") if isinstance(lovelace, dict) else None


def _is_foreign_copy(url: str) -> bool:
    path = url.split("?", 1)[0]
    filename = path.rsplit("/", 1)[-1]
    return filename in {CARD_FILENAME, "ha-encoding-fixer.js"}


async def async_register_card(hass: HomeAssistant) -> str:
    """Make the card available to dashboards.

    Storage-mode dashboards get a Lovelace resource (loaded like any HACS card,
    no page-load race). If the card is already loaded from another resource
    (for example the HACS Dashboard install of this repository), nothing is
    added so the element is not loaded twice. YAML-mode dashboards fall back to
    ``add_extra_js_url``. Returns how the card was registered.
    """
    url = versioned_card_url()
    state = _ownership(hass)
    async with state.lock:
        resources = _resources(hass)
        if resources is not None and hasattr(resources, "async_create_item") and _lovelace_mode(hass) != "yaml":
            if not getattr(resources, "loaded", True):
                await resources.async_load()
                resources.loaded = True
            owned = await _reconcile_owned(state, resources)
            owned_ids = {record["id"] for record in owned}
            items = list(resources.async_items())
            foreign = [item for item in items if item.get("id") not in owned_ids
                       and _is_foreign_copy(item.get("url", ""))]
            if foreign:
                for record in list(owned):
                    await _delete_owned(state, resources, owned, record)
                _LOGGER.info("Encoding Fixer card already loaded from %s", foreign[0].get("url"))
                return "existing_resource"
            if owned:
                first, *rest = owned
                if first["url"] != url or first["type"] != "module":
                    previous = first
                    await resources.async_update_item(
                        first["id"], {"res_type": "module", "url": url}
                    )
                    current = next((item for item in resources.async_items()
                                    if item.get("id") == first["id"]), None)
                    if current is None or _receipt(current) != {
                        "id": first["id"], "url": url, "type": "module"
                    }:
                        await state.save(rest)
                        if current is not None and _is_foreign_copy(current.get("url", "")):
                            return "existing_resource"
                        raise ValueError("Encoding Fixer resource changed during update")
                    first = _receipt(current)
                    owned = [first, *rest]
                    try:
                        await state.save(owned)
                    except Exception:
                        # The old receipt is still durable. Roll back only if the
                        # same resource still has the exact post-update identity.
                        current = next((item for item in resources.async_items()
                                        if item.get("id") == first["id"]), None)
                        updated_receipt = {"id": first["id"], "url": url, "type": "module"}
                        if current is not None and _receipt(current) == updated_receipt:
                            await resources.async_update_item(
                                previous["id"], {"res_type": previous["type"], "url": previous["url"]}
                            )
                        raise
                for record in list(owned[1:]):
                    await _delete_owned(state, resources, owned, record)
                return "resource"
            created = await resources.async_create_item({"res_type": "module", "url": url})
            if not isinstance(created.get("id"), str) or not created["id"]:
                raise ValueError("Lovelace did not return a created resource ID")
            record = _receipt(created)
            current = next((item for item in resources.async_items()
                            if item.get("id") == record["id"]), None)
            if current is None or _receipt(current) != record:
                if current is not None and _is_foreign_copy(current.get("url", "")):
                    return "existing_resource"
                raise ValueError("Encoding Fixer resource changed during creation")
            try:
                await state.save([*owned, record])
            except Exception:
                current = next((item for item in resources.async_items()
                                if item.get("id") == record["id"]), None)
                if current is not None and _receipt(current) == record:
                    await resources.async_delete_item(record["id"])
                raise
            return "resource"
        frontend.add_extra_js_url(hass, url)
        hass.data[DATA_EXTRA_URL] = url
        return "extra_js_url"


async def async_unregister_card(hass: HomeAssistant) -> None:
    """Remove only this integration's resource or YAML fallback."""
    if url := hass.data.pop(DATA_EXTRA_URL, None):
        try:
            frontend.remove_extra_js_url(hass, url)
        except KeyError:
            pass
    state = _ownership(hass)
    async with state.lock:
        resources = _resources(hass)
        if resources is None or not hasattr(resources, "async_delete_item"):
            if await state.load():
                raise ValueError("Lovelace resources unavailable for ownership cleanup")
            return
        if not getattr(resources, "loaded", True):
            await resources.async_load()
            resources.loaded = True
        owned = await _reconcile_owned(state, resources)
        for record in list(owned):
            await _delete_owned(state, resources, owned, record)


async def async_register_panel(hass: HomeAssistant) -> bool:
    """Add the admin-only sidebar panel unless the URL path is already taken."""
    panels = hass.data.get(frontend.DATA_PANELS, {})
    if PANEL_URL_PATH in panels:
        _LOGGER.info("Sidebar path /%s is already in use; not adding the Encoding Fixer panel", PANEL_URL_PATH)
        return False
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=CARD_ELEMENT,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=versioned_card_url(),
        embed_iframe=False,
        require_admin=True,
        config={},
    )
    return True


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Remove the sidebar panel this integration added (callers track ownership)."""
    if PANEL_URL_PATH in hass.data.get(frontend.DATA_PANELS, {}):
        frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
