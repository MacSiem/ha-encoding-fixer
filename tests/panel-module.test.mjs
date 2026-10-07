import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

for (const legacyFirst of [true, false]) {
  test(`bundled sidebar remains current with a legacy dashboard module loaded ${legacyFirst ? 'first' : 'last'}`, () => {
    const dom = new JSDOM('', { runScripts: 'dangerously', url: 'https://ha.local/' });
    try {
      const legacy = () => dom.window.eval(`
        if (!customElements.get('ha-encoding-fixer')) customElements.define('ha-encoding-fixer', class extends HTMLElement {
          connectedCallback() { this.textContent = 'Legacy dashboard'; }
        });`);
      if (legacyFirst) legacy();
      dom.window.eval(readFileSync(new URL('../ha-encoding-fixer.js', import.meta.url), 'utf8'));
      if (!legacyFirst) legacy();
      const panel = dom.window.document.createElement('ha-encoding-fixer-panel');
      dom.window.document.body.append(panel);
      assert.equal(typeof panel.setConfig, 'function');
      panel.setConfig({ show_support: false });
      panel.hass = { user: { id: 'household', is_admin: false }, language: 'en' };
      assert.match(panel.shadowRoot.textContent, /Administrator access/);
      assert.equal(dom.window.customCards.filter(c => c.type === 'ha-encoding-fixer').length, 1);
    } finally { dom.window.close(); }
  });
}
