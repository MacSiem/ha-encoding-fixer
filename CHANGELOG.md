# Changelog

## [5.0.5] - 2026-07-12

- Fix: fix/restore failures caused by missing admin permissions are now detected
  and reported with a clear toast ("Admin permissions required to apply fixes",
  EN/PL) instead of a generic integration/restore error message.
- Chore: aligned card JS version header with `manifest.json`/`const.py` (5.0.5).

## [5.0.4] - 2026-07-12

- Fix: the card now renders for non-admin Home Assistant users — the read-only `list_backups` websocket command no longer requires admin (`scan` was already open). `fix` and `restore` stay admin-only — they write files on disk.

## [5.0.3] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.


## [5.0.2] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.

## [5.0.1] - 2026-06-13

### Added
- getGridOptions() for correct sizing in HA sections (grid) layout.

# Changelog — Encoding Fixer

## [5.0.0] - 2026-06-12

### Changed
- Migrated from Lovelace-card-only HACS plugin layout to a Home Assistant integration under `custom_components/ha_encoding_fixer/`.
- Bundled the card through integration frontend registration.
- Added WebSocket scan/fix/backup/restore API.
- Added timestamped backup-before-write behavior for file fixes, entity registry fixes, and restores.
- Added pure Python tests for backup path generation, mojibake detection, and dry-run diff building.

## [4.1.3] - 2026-05-12

### Fixed
- Removed Google Fonts CDN @import (1 occurrence(s)); now uses system font stack with Inter as the preferred locally-installed face.
- Normalized bare `font-family: "Inter", sans-serif` declarations to a complete cross-platform system stack.
- Privacy section in README: claim now matches behaviour (no CDN dependencies).

All notable changes to **Encoding Fixer** are documented here.

## [4.0.0] - 2026-05-10

### Major
- **Split from `MacSiem/ha-tools` monorepo** into a dedicated standalone HACS plugin.
- Bundled Bento Design System CSS inline — no shared dependency required.
- Inlined `_haToolsEsc` XSS sanitizer.
- Persistence keys migrated to per-tool namespace `ha-encoding-fixer-…` (clean break — old data under `ha-tools-…` is **not** migrated automatically).
- Donation/support footer added to the panel.
- Cross-tool discovery banner removed; each tool stands on its own.

### Compatibility

- Home Assistant ≥ 2024.1.0
