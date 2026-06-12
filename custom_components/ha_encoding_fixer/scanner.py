"""Pure scanning and mojibake repair helpers for HA Encoding Fixer."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

try:
    from .const import BACKUP_DIR_NAME
except ImportError:  # pragma: no cover - direct pure-test import
    BACKUP_DIR_NAME = "ha_encoding_fixer_backups"

CONFIG_EXTENSIONS = {".yaml", ".yml"}
EXCLUDED_DIRS = {
    ".git",
    "__pycache__",
    BACKUP_DIR_NAME,
    "deps",
    "tts",
}
MAX_SCAN_BYTES = 2_000_000

_MOJIBAKE_MARKERS = (
    "Ã",
    "Â",
    "Ä",
    "Å",
    "Ð",
    "Ñ",
    "â",
    "ð",
    "Ÿ",
    "Ĺ",
    "đź",
    "�",
)
_SUSPICIOUS_RE = re.compile(r"[\u00C3\u00C4\u00C5][\u0080-\u00BF]")
_PY_U8_RE = re.compile(r"\\U([0-9A-Fa-f]{8})")
_PY_U4_RE = re.compile(r"\\u([0-9A-Fa-f]{4})")


def _characters_to_map() -> str:
    chars = [
        *(chr(cp) for cp in range(0x00A0, 0x0180)),
        *(chr(cp) for cp in range(0x2000, 0x2070)),
        *(chr(cp) for cp in range(0x2190, 0x2200)),
        *(chr(cp) for cp in range(0x2300, 0x2400)),
        *(chr(cp) for cp in range(0x2500, 0x27C0)),
        *(chr(cp) for cp in range(0xFE00, 0xFE10)),
        *(chr(cp) for cp in range(0x1F300, 0x1FB00)),
    ]
    return "".join(chars)


def _build_mojibake_map() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for char in _characters_to_map():
        raw = char.encode("utf-8")
        for encoding in ("latin-1", "cp1252", "cp1250"):
            try:
                broken = raw.decode(encoding)
            except UnicodeDecodeError:
                continue
            if broken != char:
                mapping.setdefault(broken, char)

    # A few common two-pass artifacts are easier to keep explicit.
    mapping.update(
        {
            "â€™": "'",
            "â€˜": "'",
            "â€œ": '"',
            "â€\x9d": '"',
            "â€ť": '"',
            "â€“": "-",
            "â€”": "-",
            "â€¦": "...",
        }
    )
    return dict(
        sorted(mapping.items(), key=lambda item: len(item[0]), reverse=True)
    )


MOJIBAKE_MAP = _build_mojibake_map()


def _mojibake_score(value: str) -> int:
    return sum(value.count(marker) for marker in _MOJIBAKE_MARKERS)


def _roundtrip_utf8(value: str) -> tuple[str, str] | None:
    original_score = _mojibake_score(value)
    if original_score == 0:
        return None
    for encoding in ("latin-1", "cp1252", "cp1250"):
        try:
            decoded = value.encode(encoding).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if decoded != value and _mojibake_score(decoded) < original_score:
            return decoded, f"{encoding}-roundtrip"
    return None


def _replace_known_patterns(value: str) -> str:
    fixed = value
    for _ in range(3):
        changed = False
        for broken, correct in MOJIBAKE_MAP.items():
            if broken in fixed:
                fixed = fixed.replace(broken, correct)
                changed = True
        if not changed:
            break
    return fixed


def _decode_python_escapes(value: str) -> str:
    def decode_u8(match: re.Match[str]) -> str:
        codepoint = int(match.group(1), 16)
        if 0 <= codepoint <= 0x10FFFF:
            return chr(codepoint)
        return match.group(0)

    def decode_u4(match: re.Match[str]) -> str:
        codepoint = int(match.group(1), 16)
        if 0xD800 <= codepoint <= 0xDFFF:
            return match.group(0)
        return chr(codepoint)

    return _PY_U4_RE.sub(decode_u4, _PY_U8_RE.sub(decode_u8, value))


def fix_mojibake(value: str) -> str:
    """Return a best-effort fixed string using the card's heuristics."""
    if not value or not isinstance(value, str):
        return value

    roundtrip = _roundtrip_utf8(value)
    fixed = roundtrip[0] if roundtrip else value
    fixed = _replace_known_patterns(fixed)
    fixed = _decode_python_escapes(fixed)
    return fixed


def detect_mojibake(value: str) -> dict[str, Any] | None:
    """Detect mojibake and return the fixed value when confident."""
    if not value or not isinstance(value, str):
        return None

    roundtrip = _roundtrip_utf8(value)
    fixed = roundtrip[0] if roundtrip else value
    method = roundtrip[1] if roundtrip else "pattern-replace"
    fixed = _replace_known_patterns(fixed)
    fixed = _decode_python_escapes(fixed)
    if fixed != value:
        return {
            "original": value,
            "fixed": fixed,
            "method": method,
            "uncertain": False,
        }

    if _SUSPICIOUS_RE.search(value):
        return {
            "original": value,
            "fixed": value,
            "method": "suspicious",
            "uncertain": True,
        }
    return None


def _split_line_ending(line: str) -> tuple[str, str]:
    if line.endswith("\r\n"):
        return line[:-2], "\r\n"
    if line.endswith("\n") or line.endswith("\r"):
        return line[:-1], line[-1]
    return line, ""


def build_file_changes(
    relative_path: str, text: str
) -> tuple[str, list[dict[str, Any]]]:
    """Build a fixed text copy and line-level changes without writing."""
    fixed_lines: list[str] = []
    changes: list[dict[str, Any]] = []

    lines = text.splitlines(keepends=True) or [text]
    for index, line in enumerate(lines, start=1):
        body, ending = _split_line_ending(line)
        fixed_body = body
        if index == 1 and fixed_body.startswith("\ufeff"):
            fixed_body = fixed_body.lstrip("\ufeff")
        fixed_body = fix_mojibake(fixed_body)
        fixed_lines.append(fixed_body + ending)
        if fixed_body != body:
            changes.append(
                {
                    "type": "file",
                    "file": relative_path,
                    "line": index,
                    "before": body,
                    "after": fixed_body,
                }
            )

    return "".join(fixed_lines), changes


def _change_key(change: dict[str, Any]) -> tuple[Any, ...]:
    return (
        change.get("type"),
        change.get("file"),
        change.get("line"),
        change.get("before"),
        change.get("after"),
    )


def apply_selected_file_changes(
    text: str, selected_changes: list[dict[str, Any]]
) -> tuple[str, list[dict[str, Any]]]:
    """Apply exact line changes from a prior dry-run to current text."""
    selected_by_line = {
        int(change["line"]): change
        for change in selected_changes
        if change.get("type") == "file"
    }
    fixed_lines: list[str] = []
    applied: list[dict[str, Any]] = []

    for index, line in enumerate(text.splitlines(keepends=True), start=1):
        body, ending = _split_line_ending(line)
        selected = selected_by_line.get(index)
        if selected and body == selected.get("before"):
            fixed_lines.append(str(selected["after"]) + ending)
            applied.append(selected)
        else:
            fixed_lines.append(line)

    return "".join(fixed_lines), applied


def iter_config_files(config_root: Path) -> list[str]:
    """Return YAML/YML paths under the HA config directory."""
    files: list[str] = []
    for path in config_root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in CONFIG_EXTENSIONS:
            continue
        if any(part in EXCLUDED_DIRS for part in path.relative_to(config_root).parts):
            continue
        if path.stat().st_size > MAX_SCAN_BYTES:
            continue
        files.append(str(path.relative_to(config_root)))
    return sorted(files)


def scan_config_files(config_root: Path) -> dict[str, Any]:
    """Scan HA YAML config files for fixable mojibake/BOM changes."""
    changes: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    scanned_files = 0

    for relative_path in iter_config_files(config_root):
        scanned_files += 1
        path = config_root / relative_path
        try:
            raw = path.read_bytes()
            if b"\x00" in raw:
                continue
            text = raw.decode("utf-8")
        except UnicodeDecodeError as err:
            errors.append({"file": relative_path, "error": f"invalid_utf8: {err}"})
            continue
        except OSError as err:
            errors.append({"file": relative_path, "error": str(err)})
            continue

        _, file_changes = build_file_changes(relative_path, text)
        changes.extend(file_changes)

    return {
        "scanned_files": scanned_files,
        "changes": changes,
        "errors": errors,
    }


def filter_changes(
    current_changes: list[dict[str, Any]],
    selected_changes: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Filter current changes to exact prior dry-run items if provided."""
    if selected_changes is None:
        return current_changes
    selected = {_change_key(change) for change in selected_changes}
    return [change for change in current_changes if _change_key(change) in selected]
