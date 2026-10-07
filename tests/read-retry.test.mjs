import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture(callWS) {
  const dom = new JSDOM('', { runScripts: 'dangerously', url: 'https://ha.local/' });
  dom.window.eval(readFileSync(new URL('../ha-encoding-fixer.js', import.meta.url), 'utf8'));
  const card = dom.window.document.createElement('ha-encoding-fixer');
  dom.window.document.body.append(card);
  card.setConfig({ show_support: false });
  card.hass = { language: 'en', user: { id: 'qa-admin', is_admin: true }, connection: {}, callWS };
  return { dom, card };
}

for (const initialResponse of ['error', 'malformed']) {
  test(`first-run ${initialResponse} target read offers a working retry instead of permanent loading`, async () => {
    let reads = 0;
    const { dom, card } = fixture(async command => {
      if (command.type.endsWith('/list_backups')) return { backups: [] };
      assert.equal(command.type, 'ha_encoding_fixer/targets');
      reads += 1;
      if (reads === 1) {
        if (initialResponse === 'error') throw { code: 'request_failed' };
        return {};
      }
      return { targets: [{ target_id: 'packages', available: true }] };
    });
    try {
      await settle();
      assert.equal(card._notice?.kind, 'error');
      assert.doesNotMatch(card.shadowRoot.textContent, /Loading the server allowlist/);
      const retry = [...card.shadowRoot.querySelectorAll('button')].find(b => /Retry/.test(b.textContent));
      assert.ok(retry, 'An initial target failure must be recoverable without navigation');
      retry.click();
      await settle();
      assert.equal(reads, 2);
      assert.equal(card._notice, null);
      assert.equal(card.shadowRoot.querySelector('[data-target="packages"]').checked, true);
    } finally { dom.window.close(); }
  });
}

test('incomplete preview response cannot be reported as a verified empty result', async () => {
  const { dom, card } = fixture(async command => {
    if (command.type.endsWith('/targets')) return { targets: [{ target_id: 'packages', available: true }] };
    if (command.type.endsWith('/list_backups')) return { backups: [] };
    return { findings: [] };
  });
  try {
    await settle();
    await card._preview();
    assert.equal(card._previewState, null);
    assert.equal(card._notice?.kind, 'error');
    assert.doesNotMatch(card.shadowRoot.textContent, /No encoding fixes were found/);
  } finally { dom.window.close(); }
});
