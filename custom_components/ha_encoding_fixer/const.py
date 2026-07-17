"""Constants for HA Encoding Fixer."""

from __future__ import annotations

DOMAIN = "ha_encoding_fixer"
VERSION = "5.0.7"

DATA_FRONTEND_REGISTERED = "_frontend_registered"
DATA_WS_REGISTERED = "_ws_registered"

CARD_FILENAME = "ha-encoding-fixer-card.js"
CARD_PACKAGE_DIR = "www"
CARD_URL_PATH = f"/{DOMAIN}/{CARD_FILENAME}"

BACKUP_DIR_NAME = "ha_encoding_fixer_backups"
ENTITY_REGISTRY_STORAGE = ".storage/core.entity_registry"
