"""Pure scanning and mojibake repair helpers for HA Encoding Fixer."""

from __future__ import annotations

import hashlib
import os
import re
import secrets
import stat
from pathlib import Path
from typing import Any
from urllib.parse import unquote

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
TARGET_CATALOG = {
    "configuration": "configuration.yaml",
    "automations": "automations.yaml",
    "scripts": "scripts.yaml",
    "scenes": "scenes.yaml",
    "packages": "packages",
}
DEFAULT_TARGET_IDS = tuple(TARGET_CATALOG)

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
_SAFE_TEXT_KEY_RE = re.compile(
    r"^\s*(?:-\s*)?(?:name|friendly_name|alias|title|description|message|label|emoji)\s*:",
    re.IGNORECASE,
)


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
        # Never rewrite arbitrary YAML values (tokens, URLs, IDs, selectors,
        # templates, etc.). Only explicit human-facing text fields are
        # eligible; a leading BOM is handled independently.
        if _SAFE_TEXT_KEY_RE.match(fixed_body):
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


def _validate_target_ids(target_ids: list[str] | tuple[str, ...] | None) -> list[str]:
    requested = list(target_ids or DEFAULT_TARGET_IDS)
    if not requested or len(requested) > len(TARGET_CATALOG):
        raise ValueError("invalid target selection")
    clean: list[str] = []
    for target_id in requested:
        if not isinstance(target_id, str) or target_id not in TARGET_CATALOG:
            raise ValueError("unknown target id")
        if target_id not in clean:
            clean.append(target_id)
    return clean


def _safe_relative_path(value: str) -> str:
    """Validate an internal catalog path without accepting encoded traversal."""
    if not isinstance(value, str) or not value or "\x00" in value:
        raise ValueError("invalid path")
    decoded = unquote(value)
    if decoded != value or "\\" in value or re.match(r"^[A-Za-z]:", value):
        raise ValueError("invalid path")
    path = Path(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError("invalid path")
    if any(part in EXCLUDED_DIRS for part in path.parts):
        raise ValueError("excluded path")
    if path.name.casefold() == "secrets.yaml":
        raise ValueError("excluded path")
    return path.as_posix()


def _assert_regular_under_root(config_root: Path, relative_path: str) -> Path:
    """Resolve a regular file while rejecting every symlink component."""
    root = config_root.resolve(strict=True)
    current = root
    for part in Path(_safe_relative_path(relative_path)).parts:
        current = current / part
        info = current.lstat()
        if stat.S_ISLNK(info.st_mode):
            raise OSError("symlink targets are not allowed")
    resolved = current.resolve(strict=True)
    if resolved != root and root not in resolved.parents:
        raise OSError("target escapes config root")
    info = resolved.stat()
    if not stat.S_ISREG(info.st_mode):
        raise OSError("target is not a regular file")
    if info.st_size > MAX_SCAN_BYTES:
        raise OSError("target exceeds size limit")
    return resolved


def read_regular_bytes(config_root: Path, relative_path: str) -> bytes:
    """Read one catalog file without following a final symlink."""
    target = _assert_regular_under_root(config_root, relative_path)
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(target, flags)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_SCAN_BYTES:
            raise OSError("unsafe target")
        chunks: list[bytes] = []
        remaining = MAX_SCAN_BYTES + 1
        while remaining:
            chunk = os.read(descriptor, min(65_536, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        raw = b"".join(chunks)
        if len(raw) > MAX_SCAN_BYTES:
            raise OSError("target exceeds size limit")
        return raw
    finally:
        os.close(descriptor)


def iter_config_files(
    config_root: Path,
    target_ids: list[str] | tuple[str, ...] | None = None,
) -> list[str]:
    """Return only regular, allowlisted YAML files without following links."""
    root = config_root.resolve(strict=True)
    files: list[str] = []
    for target_id in _validate_target_ids(target_ids):
        relative = TARGET_CATALOG[target_id]
        candidate = root / relative
        if target_id != "packages":
            if not candidate.exists() and not candidate.is_symlink():
                continue
            try:
                _assert_regular_under_root(root, relative)
            except OSError:
                continue
            files.append(relative)
            continue

        if not candidate.exists() and not candidate.is_symlink():
            continue
        if candidate.is_symlink() or not candidate.is_dir():
            continue
        for directory, directories, filenames in os.walk(
            candidate,
            topdown=True,
            followlinks=False,
        ):
            directory_path = Path(directory)
            directories[:] = [
                name
                for name in directories
                if name not in EXCLUDED_DIRS
                and not (directory_path / name).is_symlink()
            ]
            for filename in filenames:
                path = directory_path / filename
                if path.is_symlink() or path.suffix.lower() not in CONFIG_EXTENSIONS:
                    continue
                relative_path = path.relative_to(root).as_posix()
                try:
                    _assert_regular_under_root(root, relative_path)
                except OSError:
                    continue
                files.append(relative_path)
    return sorted(set(files))


def _target_id(relative_path: str) -> str:
    if relative_path.startswith("packages/"):
        return "packages"
    for target_id, catalog_path in TARGET_CATALOG.items():
        if relative_path == catalog_path:
            return target_id
    raise ValueError("file is not in catalog")


def _public_file_ref(relative_path: str) -> str:
    """Return only the logical target; never a path-derived identifier."""
    return _target_id(relative_path)


def redact_change(change: dict[str, Any]) -> dict[str, Any]:
    """Return an opaque finding without content-derived public hashes."""
    return {
        "change_id": secrets.token_urlsafe(24),
        "target_id": _target_id(str(change["file"])),
        "file_ref": _public_file_ref(str(change["file"])),
        "line": int(change.get("line") or 0),
        "kind": str(change.get("kind") or "mojibake"),
    }


def scan_config_files(
    config_root: Path,
    target_ids: list[str] | tuple[str, ...] | None = None,
    *,
    include_sensitive: bool = False,
) -> dict[str, Any]:
    """Scan allowlisted YAML targets and redact returned line contents by default."""
    changes: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    scanned_files = 0

    source_hashes: dict[str, str] = {}
    for relative_path in iter_config_files(config_root, target_ids):
        scanned_files += 1
        try:
            raw = read_regular_bytes(config_root, relative_path)
            if b"\x00" in raw:
                errors.append(
                    {
                        "target_id": _target_id(relative_path),
                        "file_ref": _public_file_ref(relative_path),
                        "error": "binary_file",
                    }
                )
                continue
            text = raw.decode("utf-8")
            source_hashes[relative_path] = hashlib.sha256(raw).hexdigest()
        except UnicodeDecodeError:
            errors.append(
                {
                    "target_id": _target_id(relative_path),
                    "file_ref": _public_file_ref(relative_path),
                    "error": "invalid_utf8",
                }
            )
            continue
        except OSError:
            errors.append(
                {
                    "target_id": _target_id(relative_path),
                    "file_ref": _public_file_ref(relative_path),
                    "error": "unsafe_or_unavailable",
                }
            )
            continue

        _, file_changes = build_file_changes(relative_path, text)
        for change in file_changes:
            change["kind"] = (
                "bom" if int(change.get("line") or 0) == 1
                and str(change.get("before") or "").startswith("\ufeff")
                else "mojibake"
            )
        changes.extend(
            file_changes
            if include_sensitive
            else [redact_change(change) for change in file_changes]
        )

    return {
        "scanned_files": scanned_files,
        "changes": changes,
        "errors": errors,
        "source_hashes": source_hashes if include_sensitive else {},
        "completeness": "partial" if errors else "complete",
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
