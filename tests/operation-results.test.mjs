import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

async function fixture(response) {
  const dom = new JSDOM('', { runScripts: 'dangerously', url: 'https://ha.local/' });
  dom.window.eval(readFileSync(new URL('../ha-encoding-fixer.js', import.meta.url), 'utf8'));
  const card = dom.window.document.createElement('ha-encoding-fixer');
  card.hass = { language: 'en', user: { id: 'qa-results', is_admin: true }, connection: {},
    callWS: async command => command.type.endsWith('/targets') ? { targets: [] }
      : command.type.endsWith('/list_backups') ? { backups: [] } : response };
  await new Promise(resolve => setImmediate(resolve));
  return { dom, card };
}

for (const action of ['apply', 'restore']) {
  test(`${action} reports malformed result as an error instead of a verified zero`, async () => {
    for (const count of [undefined, null, -1, 1.5, '1']) {
      const { dom, card } = await fixture({ status: 'success', changed: count, restored: count });
      try {
        card._previewState = { preview_id: 'qa-preview', findings: [] };
        card._selectedChanges.add('qa-change'); card._confirmed = true;
        card._selectedBackup = 'qa-backup'; card._restoreConfirmed = true;
        await card[`_${action}`]();
        assert.equal(card._notice.kind, 'error');
        assert.doesNotMatch(card.shadowRoot.textContent, /verified (targets|files): 0/);
      } finally { dom.window.close(); }
    }
  });
}

test('file apply tells the user to review and restart without performing a restart', async () => {
  const { dom, card } = await fixture({ status: 'success', changed: 1, failed: 0,
    backup_id: '20261007-000001', results: [], restart_recommended: true });
  try {
    card._previewState = { preview_id: 'qa-preview', findings: [] };
    card._selectedChanges.add('qa-change'); card._confirmed = true;
    await card._apply();
    assert.equal(card._notice.kind, 'success');
    assert.match(card.shadowRoot.textContent, /Restart Home Assistant/);
    card.hass = { ...card.hass, language: 'pl' };
    assert.match(card.shadowRoot.textContent, /Uruchom ponownie Home Assistant/);
  } finally { dom.window.close(); }
});
