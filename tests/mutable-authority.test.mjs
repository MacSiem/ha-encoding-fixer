import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

async function fixture() {
  const dom = new JSDOM('', { runScripts: 'dangerously', url: 'https://ha.local/' });
  dom.window.eval(readFileSync(new URL('../ha-encoding-fixer.js', import.meta.url), 'utf8'));
  const card = dom.window.document.createElement('ha-encoding-fixer');
  dom.window.document.body.append(card);
  card.setConfig({ show_support: false });
  const calls = [];
  const hass = { language: 'en', connection: {}, user: { id: 'qa-admin', is_admin: true },
    callWS: async command => {
      calls.push(command.type);
      if (command.type.endsWith('/targets')) return { targets: [{ target_id: 'configuration', available: true }] };
      if (command.type.endsWith('/list_backups')) return { backups: [] };
      throw Error('Unexpected operation');
    }
  };
  card.hass = hass;
  await new Promise(resolve => setImmediate(resolve));
  return { dom, card, hass, calls };
}

function reviewedDraft(card) {
  card._previewState = { preview_id: 'qa-preview', findings: [{ change_id: 'qa-change', target_id: 'configuration', line: 1, kind: 'mojibake' }] };
  card._selectedChanges.add('qa-change'); card._confirmed = true;
  card._backups = [{ backup_id: 'qa-backup', file_count: 1, restorable: true }];
  card._selectedBackup = 'qa-backup'; card._restoreConfirmed = true;
  card._render();
}

test('in-place administrator loss clears the reviewed draft and restore consent immediately', async () => {
  const { dom, card, hass, calls } = await fixture();
  try {
    reviewedDraft(card);
    const count = calls.length;
    hass.user.is_admin = false; card.hass = hass;
    assert.equal(card._previewState, null);
    assert.equal(card._confirmed, false);
    assert.equal(card._selectedChanges.size, 0);
    assert.equal(card._selectedBackup, ''); assert.equal(card._restoreConfirmed, false);
    assert.equal(card._targets.length, 0); assert.equal(card._backups.length, 0);
    assert.match(card.shadowRoot.textContent, /administrator/i);
    assert.equal(calls.length, count);
  } finally { dom.window.close(); }
});

test('late preview reply after in-place role loss cannot recreate a privileged draft', async () => {
  const { dom, card, hass, calls } = await fixture();
  try {
    let finish;
    hass.callWS = command => {
      calls.push(command.type);
      assert.equal(command.type, 'ha_encoding_fixer/preview');
      return new Promise(resolve => { finish = resolve; });
    };
    const pending = card._preview();
    hass.user.is_admin = false; card.hass = hass;
    const count = calls.length;
    finish({ preview_id: 'late-preview', findings: [{ change_id: 'late-change' }] });
    await pending;
    assert.equal(card._previewState, null);
    assert.equal(card._selectedChanges.size, 0); assert.equal(card._busy, false);
    assert.equal(calls.length, count);
  } finally { dom.window.close(); }
});

test('in-place administrator regain reinitializes fresh targets without restoring old consent', async () => {
  const { dom, card, hass, calls } = await fixture();
  try {
    reviewedDraft(card);
    hass.user.is_admin = false; card.hass = hass;
    const count = calls.length;
    hass.user.is_admin = true; card.hass = hass;
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls.slice(count), ['ha_encoding_fixer/targets', 'ha_encoding_fixer/list_backups']);
    assert.equal(card._previewState, null); assert.equal(card._confirmed, false); assert.equal(card._restoreConfirmed, false);
    assert.equal(card._targets.length, 1);
  } finally { dom.window.close(); }
});

test('in-place language and unchanged administrator updates preserve the authorized review without new reads', async () => {
  const { dom, card, hass, calls } = await fixture();
  try {
    reviewedDraft(card);
    const preview = card._previewState; const epoch = card._epoch; const count = calls.length;
    hass.language = 'pl'; card.hass = hass;
    assert.equal(card._previewState, preview); assert.equal(card._epoch, epoch);
    assert.equal(card._confirmed, true); assert.equal(card._restoreConfirmed, true);
    card.hass = hass;
    assert.equal(card._previewState, preview); assert.equal(calls.length, count);
  } finally { dom.window.close(); }
});
