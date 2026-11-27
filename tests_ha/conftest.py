"""Home Assistant runtime fixtures for Encoding Fixer."""

import pytest

pytest_plugins = "pytest_homeassistant_custom_component"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Load custom_components from this repository."""
    yield

@pytest.fixture(autouse=True)
def trace_delayed_save(monkeypatch):
    import traceback
    from homeassistant.helpers.storage import Store
    original = Store.async_delay_save
    def traced(self, data_func, delay=0):
        print('DIAGNOSTIC_DELAYED_STORE', self.key, 'delay', delay, flush=True)
        traceback.print_stack(limit=12)
        return original(self, data_func, delay)
    monkeypatch.setattr(Store, 'async_delay_save', traced)
