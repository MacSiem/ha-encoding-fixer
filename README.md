# Encoding Fixer

![Preview](banner.png)

Find and fix UTF-8/mojibake text (`Åazienka` → `Łazienka`, `KÃ¼che` → `Küche`)
across Home Assistant — entity registry friendly names, live state
`friendly_name` attributes, and your `.yaml`/`.yml` config files.

[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.7+-blue.svg?logo=homeassistant)](https://www.home-assistant.io/) [![Version](https://img.shields.io/github/v/release/MacSiem/ha-encoding-fixer)](https://github.com/MacSiem/ha-encoding-fixer/releases) [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Part of the [HA Tools](https://github.com/MacSiem) ecosystem.

## How it works

**Short version: install the integration, add the card, click Scan.**

1. **Server-side scan.** The integration walks your entity registry (names)
   and matching live states (`friendly_name` attributes), and reads every
   `.yaml`/`.yml` file under your Home Assistant config directory, looking
   for mojibake (UTF-8 text mis-decoded as Latin-1/Windows-1252/Windows-1250),
   a leading BOM, and Python-style Unicode escapes such as `\U0001F512` or
   `ł`.
2. **The card is bundled.** The integration serves and registers the card JS
   automatically; you only add `custom:ha-encoding-fixer` to a dashboard —
   no manual Lovelace resource entry.
3. **Dry run, then confirm, then backup.** Fixing always previews the exact
   change list first (nothing written yet); applying re-checks that list is
   still current, backs up every touched file before writing, writes, then
   reads the file back to verify the bytes match — restoring the backup
   automatically if verification fails.
4. **YAML inspection and writes require an admin.** Integration-backed scans,
   previews, fixes, backup listing, and restores can expose or change files in
   the Home Assistant config directory, so they require an administrator.
   Non-admin users can still use the card's limited legacy entity-state scan.

### What is automatic vs. manual

| Limited fallback — signed-in user | Integration API — Home Assistant admin required |
|---|---|
| Card JS registration (no resource entry) | Scanning entity registry, states, and YAML files |
| Legacy entity-state scan | Previewing/applying a fix and listing/restoring backups |

## Screenshots

| Light | Dark |
|---|---|
| ![Scan tab, light theme](docs/screenshots/card-scan-light.png) | ![Scan tab, dark theme](docs/screenshots/card-scan-dark.png) |

*The Scan tab after a scan: mojibake found in entity registry friendly names,
with per-row select, Fix selected / Fix all, and the common-patterns
reference below. Dark mode follows your Home Assistant theme automatically.*

## What changed in v5

Encoding Fixer is now a Home Assistant integration (`custom_components/ha_encoding_fixer/`)
with a bundled card, server-side timestamped backups, and a verified
WebSocket scan/fix/backup/restore API — instead of a Lovelace-card-only HACS
plugin.

If the card is loaded without the integration configured (or on an older
install), it falls back to a more limited client-side scan and direct
`config/entity_registry/update` calls, and shows a legacy-mode hint. Server
backups, write verification, and the restore panel need the integration.

After installing the integration, remove any old manual Lovelace resource
entry for `/local/community/ha-encoding-fixer/ha-encoding-fixer.js` — the
integration registers the card for you.

## Installation

### HACS custom repository

1. Open HACS → Integrations → menu → Custom repositories.
2. Add `https://github.com/MacSiem/ha-encoding-fixer` with category
   **Integration**.
3. Install **Encoding Fixer**.
4. Restart Home Assistant.
5. Go to Settings → Devices & services → Add integration → **Encoding
   Fixer** (zero-input setup — one instance).

### Lovelace card

After the integration is loaded, the card JS is registered automatically.
Add the card manually:

```yaml
type: custom:ha-encoding-fixer
```

No Lovelace resource entry is required in integration mode.

## What it scans

- Entity registry friendly names, and the live state's `friendly_name`
  attribute where it differs.
- `.yaml`/`.yml` files under the Home Assistant config directory (`.git`,
  `__pycache__`, the backups folder, `deps/`, `tts/`, and files over 2 MB are
  skipped).
- A leading BOM (`EF BB BF` / `﻿`) at the start of a file.
- Common UTF-8-decoded-as-Latin-1/Windows-1252/Windows-1250 mojibake
  patterns.
- Python-style Unicode escape literals such as `\U0001F512` (an emoji
  codepoint) and `ł` (the letter "ł").

The Lovelace Resources tab additionally checks `lovelace_resources` entries
for BOM, duplicates, mojibake and malformed URLs — this uses Home Assistant's
built-in `lovelace/resources` API directly and is independent of the
integration.

## Backups and restore

Every server-side write creates a timestamped backup before changing
anything, at:

```text
<config>/ha_encoding_fixer_backups/<YYYYMMDD-HHMMSS>/<relative-path>
```

File fixes back up the target YAML file before writing. Entity registry name
fixes go through the Home Assistant entity registry API and back up
`.storage/core.entity_registry` first. If a write verification fails, the
integration restores the just-created backup for that file and returns an
error in the WebSocket response — your file is never left in a
half-written state.

Use the restore panel (Lovelace Resources tab, below the resource scan) to
list server backups and restore a selected backup directory. Restoring backs
up the *current* file first (a rollback point), copies every file from the
chosen backup back to its original relative path, and verifies the copied
bytes. A Home Assistant restart is recommended after restoring `.storage`
files.

## FAQ

**Do I need to be an admin to use this?**
Yes for every integration-backed scan or backup operation, because results can
contain Home Assistant YAML content. A non-admin can use only the limited
legacy entity-state scan; previews, fixes, backup listing, and restores remain
administrator-only.

**What if a fix goes wrong?**
Every write is preceded by a timestamped backup, and every write is verified
by reading the file back and comparing bytes. If verification fails, the
integration automatically restores that file from the backup it just made.
You can also manually restore any earlier backup directory from the restore
panel at any time — restoring itself creates a rollback backup of your
current files first, so restoring is safe to retry.

**Does this scan `secrets.yaml` or read my credentials?**
The scanner reads `.yaml`/`.yml` files looking for encoding artifacts
(mojibake/BOM/escaped Unicode), not for secret values, and it never sends
file contents anywhere — everything happens locally between Home Assistant
and its own config directory.

**Does this send data anywhere?**
No. No telemetry, no analytics, no CDN-hosted assets. Scans, fixes, backups
and restores all happen locally through Home Assistant's WebSocket API and
local filesystem.

**Can I use the card without the integration?**
Yes, a limited legacy mode still works: without the backend, scanning falls
back to the entities already loaded in your browser and fixes go straight
through `config/entity_registry/update` with no server-side backup or
verification. Install the integration to get backups, verified writes, and
restore.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Support

If this tool makes your Home Assistant life easier, consider supporting
development:

- [Buy Me a Coffee](https://buymeacoffee.com/macsiem)
- [PayPal](https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W)

## License

MIT - see [LICENSE](LICENSE).
