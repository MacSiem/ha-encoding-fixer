import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

for (const source of ['ha-encoding-fixer.js', 'custom_components/ha_encoding_fixer/www/ha-encoding-fixer-card.js']) {
  const setup = () => {
    const dom = new JSDOM('', {runScripts:'outside-only', pretendToBeVisual:true, url:'http://synthetic.invalid/'});
    dom.window.eval(fs.readFileSync(source, 'utf8'));
    const card = dom.window.document.createElement('ha-encoding-fixer');
    dom.window.document.body.append(card);
    const calls=[];
    card._hass={language:'en', user:{id:'admin', is_admin:true}, themes:{darkMode:false}, callWS:async p=>{calls.push(p);return {};}};
    return {dom, card, calls};
  };
  test(`${source}: unavailable targets remain accessible and retain expansion and focus`, () => {
    const {dom,card,calls}=setup();
    try {
      card._targets=[{target_id:'configuration',available:true},{target_id:'scripts',available:false},{target_id:'scenes',available:false}];
      card._selectedTargets.add('configuration');card._render();
      let details=card.shadowRoot.querySelector('[data-unavailable-targets]');
      assert.ok(details); assert.match(details.textContent,/2/);assert.equal(details.open,false);
      details.open=true;details.querySelector('summary').focus();card._render();
      details=card.shadowRoot.querySelector('[data-unavailable-targets]');
      assert.equal(details.open,true);assert.equal(card.shadowRoot.activeElement,details.querySelector('summary'));
      assert.equal(details.querySelectorAll('input:disabled').length,2);assert.ok(card._selectedTargets.has('configuration'));assert.equal(calls.length,0);
    } finally {dom.window.close();}
  });
  test(`${source}: editor preserves foreign configuration and selects initial section`, () => {
    const {dom,card,calls}=setup();
    try {
      const Card=dom.window.customElements.get('ha-encoding-fixer');assert.ok(Card.getConfigElement);
      const editor=Card.getConfigElement();editor.setConfig({type:'custom:ha-encoding-fixer',nested:{value:'keep'},default_tab:'recovery'});
      editor.hass={language:'pl',themes:{darkMode:true}};let emitted;
      editor.addEventListener('config-changed',e=>{emitted=e.detail.config});
      const select=editor.shadowRoot.querySelector('[data-default-tab]');assert.equal(select.value,'recovery');
      select.value='review';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
      assert.equal(emitted.default_tab,'review');assert.equal(emitted.nested.value,'keep');
      card.setConfig(emitted);assert.equal(card._config.default_tab,'review');
      assert.equal(card.shadowRoot.querySelector('[data-section-panel=review]').hidden,false);
      assert.equal(card.shadowRoot.querySelector('[data-section-panel=targets]').hidden,true);
      const recovery=card.shadowRoot.querySelector('[data-section=recovery]');recovery.focus();recovery.click();
      assert.equal(card.shadowRoot.querySelector('[data-section-panel=recovery]').hidden,false);
      assert.equal(card.shadowRoot.activeElement.dataset.section,'recovery');
      assert.equal(card.shadowRoot.querySelector('[data-action=restore]').disabled,true);
      card.setConfig({default_tab:'bad'});assert.equal(card.shadowRoot.querySelectorAll('[data-section-panel][hidden]').length,0);
      assert.ok(card.getGridOptions().min_columns);assert.equal(calls.length,0);
    } finally {dom.window.close();}
  });
  test(`${source}: theme change updates native controls without server writes`,()=>{
    const {dom,card}=setup();try{card._initialized=true;card.hass={language:'en',user:{id:'admin',is_admin:true},themes:{darkMode:true}};assert.equal(card.style.colorScheme,'dark');card.hass={...card.hass,themes:{darkMode:false}};assert.equal(card.style.colorScheme,'light');}finally{dom.window.close();}
  });
}
