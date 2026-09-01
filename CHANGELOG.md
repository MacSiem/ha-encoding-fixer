# Changelog

## 6.0.0 (2026-09-01)

- Security: replaced arbitrary recursive configuration scans with a fixed logical target allowlist and symlink/traversal-resistant file access.
- Privacy: previews and backup lists no longer expose YAML lines, raw file paths, entity IDs, entity names or backup paths to the browser.
- Reliability: added source-bound previews, exact change IDs, Home Assistant YAML validation, backup-before-write, atomic fsync/readback verification, complete rollback and cancellation-safe mixed file/entity transactions.
- Authorization: removed token, REST, shell-command, direct entity-registry and reduced-permission browser fallbacks; every backend command is administrator-only.
- Lifecycle: unloading the final config entry now blocks new work, drains in-flight operations and removes the privileged workflow authority before a new workflow can be created.
- Policy parity: restore now applies the same package-directory and `secrets.yaml` exclusions as scanning.
- Backup privacy: backup directories are created with owner-only permissions (`0700`); their contents still require configuration-equivalent host protection.
- UX: rebuilt the card around explicit target selection, redacted review, write confirmation, truthful partial/error states and confirmed restore; increased typography, line height, spacing and mobile affordances for legibility.
- Supply chain: pinned CI actions, disabled persisted checkout credentials and added locked security/parity checks.

## 5.0.13 (2026-08-28)

- Isolation: Bento CSS is component-local in both frontend copies and cannot be captured from `window.HAToolsBentoCSS` by load order.
- Isolation: persistence is now card-local, removing `window._haToolsPersistence` load-order coupling while retaining existing localStorage keys.
- Isolation: removed the document-wide sibling-card injector and all shared global escape-helper references.
- Security: retained local String-before-escape helpers in byte-identical root and packaged cards.
- Tests: prevent future cross-card DOM mutation and global helper coupling.
- UX: restored the donate footer within the Encoding Fixer card's own shadow root.

## 5.0.12 (2026-08-27)

- Security: restricted server-backup metadata and restore controls to Home Assistant administrators; backup responses include identifiers and relative configuration-file paths.
- UX: non-admin users keep the limited entity-state workflow and now see a focused administrator-only explanation instead of a misleading integration fallback.
- Tests: added backend authorization and admin/non-admin runtime rendering regressions while preserving byte-identical root and packaged cards.

## 5.0.11 (2026-08-21)

- Compatibility: raised the Home Assistant floor to 2024.7 for the static-path API used by the integration.
- Permissions/docs: documented that integration-backed scans expose YAML and require an administrator; unauthorized scans now fall back to the limited legacy entity-state mode.
- Consistency: refreshed the legacy root card from the packaged build and moved its startup filesystem stat off the event loop.

## 5.0.10 (2026-08-20)

- Security: the scan WebSocket command now requires a Home Assistant administrator because its results can include before/after lines from YAML configuration files.
- Chore: aligned the version in `const.py`, `manifest.json`, and the bundled card header.

## 5.0.9 (2026-07-31)

- Docs-only: clarified in-code that the SPLIT_TAGS list and cross-family help entries in the bundled card are shared HA Tools family metadata (donate-footer targets / help gallery), not custom-element registrations; this card registers only `ha-encoding-fixer` and `ha-encoding-fixer-editor`. No functional changes.

## 5.0.8 (2026-07-18)

- Fix (UI): the small accent dot before section titles no longer detaches from the title text (it was pushed to the opposite edge by the header's flex space-between); it is now pinned next to the title.

## 5.0.7 (2026-07-17)

- Fix (UI): responsive tab bar — tabs stretch to fill the card width and wrap on narrow layouts instead of being pinned to content width and clipped (shared HA Tools tab styling).

## 5.0.7 (2026-07-17)

- Fix (UI): responsive tab bar — tabs stretch to fill the card width and wrap on narrow layouts instead of being pinned to content width and clipped (shared HA Tools tab styling).

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
