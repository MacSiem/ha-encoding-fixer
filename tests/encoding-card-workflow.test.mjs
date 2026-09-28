import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const rootSource = fs.readFileSync(new URL('ha-encoding-fixer.js', root), 'utf8');
const shippedSource = fs.readFileSync(
  new URL('custom_components/ha_encoding_fixer/www/ha-encoding-fixer-card.js', root),
  'utf8',
);

assert.equal(rootSource, shippedSource, 'root and shipped cards must be identical');

for (const [label, source] of [['root', rootSource], ['shipped', shippedSource]]) {
  for (const forbidden of [
    'accessToken',
    'Bearer',
    '/api/config',
    "callService('shell_command'",
    '/local/encoding_scan_result.json',
    "type: 'config/entity_registry/update'",
  ]) {
    assert.equal(source.includes(forbidden), false, `${label}: forbidden active path ${forbidden}`);
  }
  assert.match(source, /const API = 'ha_encoding_fixer'/);
  assert.match(source, /_call\('preview'/);
  assert.match(source, /_call\('apply'/);
  assert.match(source, /_hass\?\.user\?\.is_admin/);
  assert.match(source, /font-size:15px; line-height:1\.6/);
  assert.equal(source.includes('word-break:break-all'), false, `${label}: text must not be split character by character`);
  assert.equal(source.includes('Date.now()'), false, `${label}: operation IDs must not use a predictable fallback`);
}

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://ha.local/' });
const context = vm.createContext({
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  HTMLSelectElement: dom.window.HTMLSelectElement,
  customElements: dom.window.customElements,
  CustomEvent: dom.window.CustomEvent,
  localStorage: dom.window.localStorage,
  setTimeout,
  clearTimeout,
  console,
  crypto: globalThis.crypto,
});
vm.runInContext(rootSource, context);
const Card = dom.window.customElements.get('ha-encoding-fixer');
assert.ok(Card, 'card must register');

const nonAdmin = new Card();
let nonAdminCalls = 0;
nonAdmin.hass = {
  user: { is_admin: false },
  callWS: async () => { nonAdminCalls += 1; },
  themes: { darkMode: false },
  language: 'en',
};
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(nonAdminCalls, 0, 'non-admin UI must not call privileged endpoints');
assert.match(nonAdmin.shadowRoot.textContent, /administrator/i);
assert.equal(nonAdmin.shadowRoot.querySelector('.donate'), null);

const admin = new Card();
const calls = [];
admin.hass = {
  user: { is_admin: true },
  callWS: async (payload) => {
    calls.push(payload);
    if (payload.type.endsWith('/targets')) {
      return { targets: [{ target_id: 'configuration', available: true }] };
    }
    if (payload.type.endsWith('/list_backups')) return { backups: [] };
    if (payload.type.endsWith('/preview')) {
      return {
        schema_version: 1,
        preview_id: 'preview-1',
        expires_at: '2099-01-01T00:00:00Z',
        findings: [{ change_id: 'change-1', target_id: 'configuration', line: 2, kind: 'mojibake' }],
        errors: [],
        completeness: 'complete',
      };
    }
    return { status: 'success', changed: 1, failed: 0, results: [] };
  },
  themes: { darkMode: false },
  language: 'en',
};
await new Promise((resolve) => setTimeout(resolve, 0));
assert.ok(admin.shadowRoot.querySelector('.donate'), 'admin sees the optional support link');
admin.setConfig({ show_support: false });
assert.equal(admin.shadowRoot.querySelector('.donate'), null, 'show_support: false hides support');
admin.setConfig({});
admin.shadowRoot.querySelector('[data-action="dismiss-support"]').click();
assert.equal(admin.shadowRoot.querySelector('.donate'), null, 'dismiss hides support');
assert.equal(dom.window.localStorage.getItem('ha-encoding-fixer-support-dismissed'), '1');
const stablePanel = admin.shadowRoot.querySelector('ha-card');
const steadyHass = admin.hass;
for (let index = 0; index < 30; index += 1) {
  admin.hass = { ...steadyHass, states: { [`sensor.tick_${index}`]: { state: index } } };
}
assert.equal(admin.shadowRoot.querySelector('ha-card'), stablePanel, 'unrelated HA updates must preserve the rendered panel');
assert.equal(calls.filter((call) => call.type.endsWith('/targets')).length, 1, 'unrelated HA updates must not reinitialize');
admin.hass = { ...steadyHass, user: { id: steadyHass.user.id, is_admin: false } };
assert.equal(admin._targets.length, 0, 'revoking admin access must clear cached targets');
assert.match(admin.shadowRoot.textContent, /Administrator access required/);
admin.hass = steadyHass;
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(admin._targets.length, 1, 'restored admin access must reload targets');
await admin._preview();
assert.ok(calls.every((call) => call.type.startsWith('ha_encoding_fixer/')));
assert.equal(admin._previewState.preview_id, 'preview-1');

admin._previewState = {
  preview_id: 'preview-1',
  findings: [{ change_id: 'change-1', target_id: 'configuration', line: 2, kind: 'mojibake' }],
};
admin._selectedChanges = new Set(['change-1']);
admin._confirmed = true;
await Promise.all([admin._apply(), admin._apply()]);
assert.equal(calls.filter((call) => call.type.endsWith('/apply')).length, 1, 'double apply must deduplicate');

const savedCrypto = context.crypto;
context.crypto = undefined;
assert.throws(() => admin._operationId(), /secure_random_unavailable/);
context.crypto = savedCrypto;

const hostile = new Card();
hostile.hass = {
  user: { id: 'admin-safe-render', is_admin: true },
  connection: { id: 'connection-safe-render' },
  callWS: async (payload) => payload.type.endsWith('/targets')
    ? { targets: [{ target_id: 'configuration', available: true }] }
    : { backups: [] },
};
await new Promise((resolve) => setTimeout(resolve, 0));
hostile._previewState = {
  preview_id: 'preview-hostile',
  findings: [{
    change_id: 'change-hostile',
    target_id: 'configuration',
    line: 7,
    kind: '<img src=x onerror=alert(1)>',
    file_ref: '\"><script>alert(1)</script>',
  }],
};
hostile._selectedChanges = new Set(['change-hostile']);
hostile._render();
assert.equal(hostile.shadowRoot.querySelector('img,script'), null, 'server text must never become active markup');
assert.match(hostile.shadowRoot.textContent, /<img src=x onerror=alert\(1\)>/);

let resolveDeferredPreview;
const deferredPreview = new Promise((resolve) => { resolveDeferredPreview = resolve; });
const disconnecting = new Card();
disconnecting.hass = {
  user: { id: 'admin-disconnect', is_admin: true },
  connection: { id: 'connection-disconnect' },
  callWS: async (payload) => {
    if (payload.type.endsWith('/targets')) {
      return { targets: [{ target_id: 'configuration', available: true }] };
    }
    if (payload.type.endsWith('/list_backups')) return { backups: [] };
    if (payload.type.endsWith('/preview')) return deferredPreview;
    throw new Error('unexpected request');
  },
};
await new Promise((resolve) => setTimeout(resolve, 0));
const pendingPreview = disconnecting._preview();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(disconnecting._busy, true);
disconnecting.hass = null;
assert.equal(disconnecting._busy, false, 'disconnect must clear the busy state');
resolveDeferredPreview({
  preview_id: 'stale-preview',
  findings: [{ change_id: 'stale-change', target_id: 'configuration' }],
});
await pendingPreview;
assert.equal(disconnecting._previewState, null, 'a response from the previous connection must be ignored');

console.log('encoding integration-only workflow assertions passed');
