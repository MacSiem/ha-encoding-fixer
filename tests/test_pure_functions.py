from __future__ import annotations

import ast
import importlib.util
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, relative_path: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative_path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


scanner = load_module(
    "ha_encoding_fixer_scanner",
    "custom_components/ha_encoding_fixer/scanner.py",
)
backup = load_module(
    "ha_encoding_fixer_backup",
    "custom_components/ha_encoding_fixer/backup.py",
)


class BackupPathTests(unittest.TestCase):
    def test_timestamped_backup_path_preserves_relative_tree(self) -> None:
        backup_id = backup.format_backup_id(
            datetime(2026, 6, 12, 8, 9, 10, tzinfo=timezone.utc)
        )

        destination = backup.build_backup_destination(
            Path("/config"), backup_id, "packages/lights.yaml"
        )

        self.assertEqual(backup_id, "20260612-080910")
        self.assertEqual(
            destination,
            Path("/config")
            / "ha_encoding_fixer_backups"
            / "20260612-080910"
            / "packages"
            / "lights.yaml",
        )

    def test_backup_path_rejects_absolute_and_parent_paths(self) -> None:
        for unsafe in ("/config/configuration.yaml", "../secrets.yaml"):
            with self.subTest(unsafe=unsafe):
                with self.assertRaises(ValueError):
                    backup.build_backup_destination(
                        Path("/config"), "20260612-080910", unsafe
                    )


class MojibakeDetectionTests(unittest.TestCase):
    def test_detects_cp1252_polish_mojibake(self) -> None:
        result = scanner.detect_mojibake("ZaÅ¼Ã³Å‚Ä‡ gÄ™Å›lÄ…")

        self.assertIsNotNone(result)
        self.assertEqual(result["fixed"], "Zażółć gęślą")
        self.assertFalse(result.get("uncertain", False))

    def test_detects_python_unicode_escape_literals(self) -> None:
        result = scanner.detect_mojibake("Alarm \\U0001F512 wÅ‚Ä…czony")

        self.assertIsNotNone(result)
        self.assertEqual(result["fixed"], "Alarm 🔒 włączony")


class DiffBuilderTests(unittest.TestCase):
    def test_builds_line_diffs_without_writing(self) -> None:
        text = "ok: true\nname: WÅ‚Ä…cznik\nemoji: \\U0001F512 Alarm\n"

        fixed_text, changes = scanner.build_file_changes("automations.yaml", text)

        self.assertEqual(
            fixed_text,
            "ok: true\nname: Włącznik\nemoji: 🔒 Alarm\n",
        )
        self.assertEqual(
            changes,
            [
                {
                    "type": "file",
                    "file": "automations.yaml",
                    "line": 2,
                    "before": "name: WÅ‚Ä…cznik",
                    "after": "name: Włącznik",
                },
                {
                    "type": "file",
                    "file": "automations.yaml",
                    "line": 3,
                    "before": "emoji: \\U0001F512 Alarm",
                    "after": "emoji: 🔒 Alarm",
                },
            ],
        )


class AuthorizationRegressionTests(unittest.TestCase):
    def test_scan_websocket_command_requires_admin(self) -> None:
        source = (ROOT / "custom_components/ha_encoding_fixer/websocket_api.py").read_text()
        tree = ast.parse(source)
        scan = next(
            node
            for node in tree.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and node.name == "_ws_scan"
        )
        decorators = {ast.unparse(decorator) for decorator in scan.decorator_list}

        self.assertIn("websocket_api.require_admin", decorators)


if __name__ == "__main__":
    unittest.main()
