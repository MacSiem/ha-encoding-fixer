"""Regression coverage for component-local persistence isolation."""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    "ha-encoding-fixer.js",
    "custom_components/ha_encoding_fixer/www/ha-encoding-fixer-card.js",
)


class PersistenceIsolationTest(unittest.TestCase):
    def test_card_does_not_use_browser_storage_as_authority(self):
        for relative_path in SOURCES:
            with self.subTest(path=relative_path):
                source = (ROOT / relative_path).read_text(encoding="utf-8")
                self.assertNotIn("window._haToolsPersistence", source)
                self.assertNotIn("full impl in ha-tools-panel", source)
                self.assertNotIn("localStorage", source)
                self.assertNotIn("sessionStorage", source)

    def test_unload_removes_privileged_workflow_authority(self):
        source = (
            ROOT / "custom_components/ha_encoding_fixer/__init__.py"
        ).read_text(encoding="utf-8")
        self.assertIn("await service.async_close()", source)
        self.assertIn("bucket.pop(DATA_WORKFLOW, None)", source)


if __name__ == "__main__":
    unittest.main()
