// Source-only: no tests executed by worker. Native geometry remains owner acceptance.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
const sources=['ha-encoding-fixer.js','custom_components/ha_encoding_fixer/www/ha-encoding-fixer-card.js'];
for(const source of sources)test(source+': native labels keep all repair/recovery selections and gates',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://synthetic.invalid/',virtualConsole:new VirtualConsole()});
 dom.window.eval(fs.readFileSync(source,'utf8'));const card=dom.window.document.createElement('ha-encoding-fixer');dom.window.document.body.append(card);
 const calls=[];card._hass={language:'en',user:{is_admin:true},callWS:async p=>{calls.push(p);return {};},themes:{}};
 card._targets=[{target_id:'configuration',available:true}];card._selectedTargets=new dom.window.Set(['configuration']);
 card._previewState={preview_id:'synthetic',expires_at:'2099-01-01T00:00:00Z',findings:[{change_id:'synthetic-change',target_id:'configuration',line:2,kind:'mojibake'}],completeness:'complete',errors:[]};
 card._backups=[{backup_id:'synthetic-backup',created_at:'2026-10-01T00:00:00Z'}];card._render();
 try{
  assert.equal(card.shadowRoot.querySelector('[data-tab],#ha-tools-tab-picker'),null,'tool has no navigation tabs');
  for(const input of card.shadowRoot.querySelectorAll('input[type=checkbox]')){assert.equal(input.labels.length,1);assert.ok(input.labels[0].textContent.trim());}
  const target=card.shadowRoot.querySelector('[data-target]');target.labels[0].click();assert.equal(card._selectedTargets.has('configuration'),false);
  assert.equal(calls.length,0,'selecting a target never invokes server actions');
  const backup=card.shadowRoot.querySelector('[data-backup-select]');assert.ok(backup.getAttribute('aria-label'));backup.focus();backup.value='synthetic-backup';backup.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.equal(card._selectedBackup,'synthetic-backup');assert.equal(card.shadowRoot.activeElement,card.shadowRoot.querySelector('[data-backup-select]'));
  assert.equal(card.shadowRoot.querySelector('[data-action=restore]').disabled,true);
  assert.equal(calls.length,0);card._hass.user.is_admin=false;card._render();assert.equal(card.shadowRoot.querySelector('[data-action=apply]'),null);
 }finally{card.remove();dom.window.close();}
});
