(() => {
  'use strict';

  const TAG = 'ha-encoding-fixer';
  const API = 'ha_encoding_fixer';
  const _asText = (value) => value == null ? '' : String(value);
  const _escBase = (value) => value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const _esc = (s) => _escBase(_asText(s));
  const ownDonateFooter = () => `
    <footer class="donate" data-source="own-card">
      <span>Encoding Fixer is local-first and has no telemetry.</span>
      <a href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer">Support development</a>
    </footer>`;

  const LABELS = Object.freeze({
    configuration: 'Configuration', automations: 'Automations', scripts: 'Scripts',
    scenes: 'Scenes', packages: 'Packages', entity_registry: 'Entity registry',
  });
  const ERROR_MESSAGES = Object.freeze({
    authorization_required: 'Administrator access is required.',
    integration_unavailable: 'The Encoding Fixer integration is not available. Reload the integration and try again.',
    invalid_target_selection: 'Select at least one available target.',
    invalid_change_selection: 'The selected findings are no longer valid. Create a new preview.',
    preview_unavailable: 'This preview expired or belongs to another session. Create a new preview.',
    stale_preview: 'The source changed after preview. Nothing was applied; create a new preview.',
    invalid_utf8: 'A selected file is not valid UTF-8. Nothing was applied.',
    invalid_yaml: 'The proposed result is not valid Home Assistant YAML. Nothing was applied.',
    unsafe_or_unavailable_target: 'A target became unavailable or failed the safety check. Nothing was applied.',
    backup_failed: 'A complete backup could not be created. Nothing was applied.',
    rollback_failed: 'Automatic rollback could not be verified. Do not retry; inspect the local Home Assistant logs and backup.',
    operation_id_reused: 'This operation identifier was already used for a different request.',
    confirmation_required: 'Confirm the restore before continuing.',
    too_many_findings: 'The preview is too large to process safely in one operation.',
    apply_failed: 'The operation failed safely. Create a new preview before retrying.',
    restore_failed: 'The backup could not be restored safely.',
    request_failed: 'The request could not be completed safely.',
  });

  class HAEncodingFixer extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._hass = null;
      this._config = {};
      this._epoch = 0;
      this._connection = null;
      this._userId = null;
      this._initialized = false;
      this._busy = false;
      this._targets = [];
      this._selectedTargets = new Set();
      this._previewState = null;
      this._selectedChanges = new Set();
      this._confirmed = false;
      this._backups = [];
      this._selectedBackup = '';
      this._restoreConfirmed = false;
      this._notice = null;
      this._bindEvents();
      this._render();
    }

    setConfig(config) { this._config = config || {}; }
    getCardSize() { return 8; }
    static getStubConfig() { return {}; }

    set hass(value) {
      const nextConnection = value?.connection || null;
      const nextUserId = value?.user?.id || null;
      const identityChanged = Boolean(this._hass) && (
        this._connection !== nextConnection || this._userId !== nextUserId
      );
      this._hass = value || null;
      if (!this._hass || identityChanged) {
        this._epoch += 1;
        this._initialized = false;
        this._busy = false;
        this._targets = [];
        this._selectedTargets.clear();
        this._clearPreview(false);
        this._backups = [];
        this._selectedBackup = '';
        this._restoreConfirmed = false;
        this._notice = null;
      }
      this._connection = nextConnection;
      this._userId = nextUserId;
      this._render();
      if (this._isAdmin() && !this._initialized) {
        this._initialized = true;
        void this._initialize();
      }
    }
    get hass() { return this._hass; }

    _isAdmin() { return Boolean(this._hass?.user?.is_admin); }

    _bindEvents() {
      this.shadowRoot.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button || button.disabled) return;
        const action = button.dataset.action;
        if (action === 'preview') void this._preview();
        if (action === 'apply') void this._apply();
        if (action === 'list-backups') void this._loadBackups();
        if (action === 'restore') void this._restore();
        if (action === 'select-all') {
          this._selectedChanges = new Set((this._previewState?.findings || []).map((item) => item.change_id));
          this._confirmed = false;
          this._render();
        }
        if (action === 'clear-preview') this._clearPreview();
      });
      this.shadowRoot.addEventListener('change', (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLSelectElement)) return;
        if (input.matches('[data-target]')) {
          input.checked ? this._selectedTargets.add(input.dataset.target) : this._selectedTargets.delete(input.dataset.target);
          this._clearPreview(false);
        }
        if (input.matches('[data-change]')) {
          input.checked ? this._selectedChanges.add(input.dataset.change) : this._selectedChanges.delete(input.dataset.change);
          this._confirmed = false;
        }
        if (input.matches('[data-confirm]')) this._confirmed = input.checked;
        if (input.matches('[data-backup-select]')) {
          this._selectedBackup = input.value;
          this._restoreConfirmed = false;
        }
        if (input.matches('[data-restore-confirm]')) this._restoreConfirmed = input.checked;
        this._render();
      });
    }

    async _initialize() {
      const epoch = this._epoch;
      await Promise.allSettled([this._loadTargets(epoch), this._loadBackups(epoch)]);
    }

    async _call(type, payload = {}, epoch = this._epoch) {
      if (!this._isAdmin() || typeof this._hass?.callWS !== 'function') throw { code: 'authorization_required' };
      const result = await this._hass.callWS({ type: `${API}/${type}`, ...payload });
      if (epoch !== this._epoch || !this._hass) throw { code: 'request_cancelled' };
      return result;
    }

    _setNotice(kind, message) {
      this._notice = { kind, message };
      this._render();
    }

    _errorCode(error) {
      return _asText(error?.code || error?.error?.code || 'request_failed');
    }

    _showError(error) {
      const code = this._errorCode(error);
      this._setNotice('error', ERROR_MESSAGES[code] || ERROR_MESSAGES.request_failed);
    }

    async _loadTargets(epoch = this._epoch) {
      try {
        const response = await this._call('targets', {}, epoch);
        const targets = Array.isArray(response?.targets) ? response.targets : [];
        this._targets = targets.filter((item) => LABELS[item.target_id]);
        if (!this._selectedTargets.size) {
          this._targets.filter((item) => item.available).forEach((item) => this._selectedTargets.add(item.target_id));
        }
        this._render();
      } catch (error) {
        if (this._errorCode(error) !== 'request_cancelled') this._showError(error);
      }
    }

    async _loadBackups(epoch = this._epoch) {
      if (!this._isAdmin()) return;
      try {
        const response = await this._call('list_backups', {}, epoch);
        this._backups = Array.isArray(response?.backups) ? response.backups : [];
        if (this._selectedBackup && !this._backups.some((item) => item.backup_id === this._selectedBackup && item.restorable !== false)) {
          this._selectedBackup = '';
        }
        this._render();
      } catch (error) {
        if (this._errorCode(error) !== 'request_cancelled') this._showError(error);
      }
    }

    _clearPreview(render = true) {
      this._previewState = null;
      this._selectedChanges.clear();
      this._confirmed = false;
      if (render) this._render();
    }

    async _preview() {
      if (this._busy || !this._isAdmin()) return;
      const targetIds = [...this._selectedTargets];
      if (!targetIds.length) {
        this._setNotice('error', ERROR_MESSAGES.invalid_target_selection);
        return;
      }
      this._busy = true;
      this._notice = null;
      this._render();
      const epoch = this._epoch;
      try {
        const response = await this._call('preview', { target_ids: targetIds }, epoch);
        this._previewState = response;
        this._selectedChanges = new Set((response.findings || []).map((item) => item.change_id));
        this._confirmed = false;
        const count = this._selectedChanges.size;
        this._notice = { kind: 'success', message: count ? `Preview ready: ${count} finding${count === 1 ? '' : 's'}.` : 'Preview complete: no safe fixes found.' };
      } catch (error) {
        if (this._errorCode(error) !== 'request_cancelled') this._showError(error);
      } finally {
        if (epoch === this._epoch) {
          this._busy = false;
          this._render();
        }
      }
    }

    _operationId() {
      if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
      if (typeof globalThis.crypto?.getRandomValues !== 'function') {
        throw new Error('secure_random_unavailable');
      }
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    }

    _shortRef(value) {
      const text = _asText(value);
      return text.length > 12 ? `${text.slice(0, 8)}…` : text;
    }

    async _apply() {
      if (this._busy || !this._isAdmin()) return;
      if (!this._previewState?.preview_id || !this._selectedChanges.size || !this._confirmed) {
        this._setNotice('error', 'Select findings and confirm the transactional write before applying.');
        return;
      }
      this._busy = true;
      this._notice = null;
      this._render();
      const epoch = this._epoch;
      try {
        const response = await this._call('apply', {
          preview_id: this._previewState.preview_id,
          change_ids: [...this._selectedChanges],
          operation_id: this._operationId(),
        }, epoch);
        this._clearPreview(false);
        this._notice = { kind: 'success', message: `Applied and verified ${Number(response?.changed || 0)} target${Number(response?.changed || 0) === 1 ? '' : 's'}. Backup: ${_asText(response?.backup_id)}.` };
        await this._loadBackups(epoch);
      } catch (error) {
        if (this._errorCode(error) !== 'request_cancelled') this._showError(error);
      } finally {
        if (epoch === this._epoch) {
          this._busy = false;
          this._render();
        }
      }
    }

    async _restore() {
      if (this._busy || !this._isAdmin()) return;
      if (!this._selectedBackup || !this._restoreConfirmed) {
        this._setNotice('error', 'Choose a backup and confirm the restore first.');
        return;
      }
      this._busy = true;
      this._notice = null;
      this._render();
      const epoch = this._epoch;
      try {
        const response = await this._call('restore', {
          backup_id: this._selectedBackup,
          operation_id: this._operationId(),
          confirmed: true,
        }, epoch);
        this._restoreConfirmed = false;
        this._notice = { kind: 'success', message: `Restored and verified ${Number(response?.restored || 0)} file${Number(response?.restored || 0) === 1 ? '' : 's'}. Restart Home Assistant after reviewing the result.` };
        await this._loadBackups(epoch);
      } catch (error) {
        if (this._errorCode(error) !== 'request_cancelled') this._showError(error);
      } finally {
        if (epoch === this._epoch) {
          this._busy = false;
          this._render();
        }
      }
    }

    _targetMarkup() {
      if (!this._targets.length) return '<p class="muted">Loading the server allowlist…</p>';
      return this._targets.map((item) => `
        <label class="target ${item.available ? '' : 'disabled'}">
          <input type="checkbox" data-target="${_esc(item.target_id)}" ${this._selectedTargets.has(item.target_id) ? 'checked' : ''} ${!item.available || this._busy ? 'disabled' : ''}>
          <span><strong>${_esc(LABELS[item.target_id])}</strong><small>${item.available ? 'Available' : 'Not configured'}</small></span>
        </label>`).join('');
    }

    _findingsMarkup() {
      const findings = this._previewState?.findings || [];
      if (!this._previewState) return '<div class="empty">Create a read-only preview to see exact, redacted findings.</div>';
      if (!findings.length) return '<div class="empty success-empty">No encoding fixes were found in the selected targets.</div>';
      return `
        <div class="findings-head"><span>${findings.length} redacted finding${findings.length === 1 ? '' : 's'}</span><button class="link" data-action="select-all" type="button">Select all</button></div>
        <div class="findings">${findings.map((item) => `
          <label class="finding">
            <input type="checkbox" data-change="${_esc(item.change_id)}" ${this._selectedChanges.has(item.change_id) ? 'checked' : ''} ${this._busy ? 'disabled' : ''}>
            <span class="finding-main"><strong>${_esc(LABELS[item.target_id] || item.target_id)}</strong><small><span>${item.line ? `Line ${_esc(item.line)}` : 'Registry name'}</span><span>${_esc(item.kind || 'encoding')}</span><span>Ref ${_esc(this._shortRef(item.file_ref || item.entity_ref || 'server'))}</span></small></span>
            <span class="verified" aria-label="Contents are hidden from the browser">Redacted</span>
          </label>`).join('')}</div>`;
    }

    _backupMarkup() {
      const options = this._backups.map((item) => `<option value="${_esc(item.backup_id)}" ${this._selectedBackup === item.backup_id ? 'selected' : ''} ${item.restorable === false ? 'disabled' : ''}>${_esc(item.backup_id)} · ${Number(item.file_count || 0)} file(s)${item.restorable === false ? ' · offline recovery only' : ''}</option>`).join('');
      return `
        <section class="panel restore-panel">
          <div class="section-title"><div><span class="eyebrow">Recovery</span><h2>Verified server backups</h2></div><button class="secondary" data-action="list-backups" type="button" ${this._busy ? 'disabled' : ''}>Refresh</button></div>
          <p class="muted">Only timestamp IDs and file counts are shown. Paths and file contents stay on the Home Assistant host.</p>
          <p class="muted">Backups containing the entity-registry store are intentionally not restored while Home Assistant is running; use them only for offline recovery.</p>
          <select data-backup-select aria-label="Backup" ${this._busy ? 'disabled' : ''}><option value="">Choose a backup…</option>${options}</select>
          <label class="confirm"><input type="checkbox" data-restore-confirm ${this._restoreConfirmed ? 'checked' : ''} ${this._selectedBackup ? '' : 'disabled'}><span>I understand that restore writes allowlisted files, verifies them, and creates a rollback backup first.</span></label>
          <button class="danger" data-action="restore" type="button" ${!this._selectedBackup || !this._restoreConfirmed || this._busy ? 'disabled' : ''}>Restore selected backup</button>
        </section>`;
    }

    _render() {
      if (!this.shadowRoot) return;
      if (!this._hass) {
        this.shadowRoot.innerHTML = `<style>${this._styles()}</style><ha-card><div class="loading">Connecting to Home Assistant…</div></ha-card>`;
        return;
      }
      if (!this._isAdmin()) {
        this.shadowRoot.innerHTML = `<style>${this._styles()}</style><ha-card><div class="permission"><span class="lock">Restricted</span><h2>Administrator access required</h2><p>Encoding previews can inspect configuration metadata and fixes can write configuration files. This card does not use a reduced-permission fallback.</p></div></ha-card>`;
        return;
      }
      const selectedCount = this._selectedChanges.size;
      const notice = this._notice ? `<div class="notice ${_esc(this._notice.kind)}" role="status">${_esc(this._notice.message)}</div>` : '';
      const preview = this._previewState;
      const targetSummary = [...this._selectedTargets].map((id) => LABELS[id] || id).join(', ');
      const confirmation = preview && (preview.findings || []).length ? `
        <label class="confirm important"><input type="checkbox" data-confirm ${this._confirmed ? 'checked' : ''}><span>I reviewed ${selectedCount} selected finding${selectedCount === 1 ? '' : 's'} for ${_esc(targetSummary)}. Apply will revalidate source hashes and YAML, back up every target before any write, verify readback, and roll back the whole write set on failure.</span></label>` : '';
      const html = `
        <style>${this._styles()}</style>
        <ha-card>
          <header><div><span class="eyebrow">Home Assistant · local only</span><h1>Encoding Fixer</h1><p>Preview, validate, back up and repair mojibake without exposing configuration contents to the browser.</p></div><span class="shield">Admin</span></header>
          ${notice}
          <section class="panel">
            <div class="section-title"><div><span class="eyebrow">Step 1</span><h2>Choose allowlisted targets</h2></div><span class="status-dot">Read-only preview</span></div>
            <div class="targets">${this._targetMarkup()}</div>
            <button class="primary" data-action="preview" type="button" ${this._busy || !this._selectedTargets.size ? 'disabled' : ''}>${this._busy ? 'Working safely…' : 'Create preview'}</button>
          </section>
          <section class="panel">
            <div class="section-title"><div><span class="eyebrow">Step 2</span><h2>Review redacted findings</h2></div>${preview ? `<button class="link" data-action="clear-preview" type="button">Clear</button>` : ''}</div>
            ${preview?.completeness === 'partial' ? '<div class="notice warning">Preview is partial because one or more targets were unavailable or invalid UTF-8. Only visible findings can be selected.</div>' : ''}
            ${this._findingsMarkup()}
            ${confirmation}
            <button class="primary" data-action="apply" type="button" ${!preview || !selectedCount || !this._confirmed || this._busy ? 'disabled' : ''}>${selectedCount ? `Apply ${selectedCount} selected fix${selectedCount === 1 ? '' : 'es'}` : 'Select findings to continue'}</button>
          </section>
          ${this._backupMarkup()}
          ${ownDonateFooter()}
        </ha-card>`;
      this.shadowRoot.innerHTML = html;
    }

    _styles() { return `
      :host { display:block; color:var(--primary-text-color); font-family:var(--paper-font-body1_-_font-family, system-ui, sans-serif); font-size:15px; line-height:1.6; }
      * { box-sizing:border-box; }
      ha-card { overflow:hidden; background:var(--ha-card-background, var(--card-background-color)); border-radius:var(--ha-card-border-radius, 16px); }
      header { padding:26px; display:flex; justify-content:space-between; gap:22px; align-items:flex-start; background:linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 14%, transparent), transparent 72%); border-bottom:1px solid var(--divider-color); }
      h1,h2,p { margin:0; } h1 { font-size:30px; line-height:1.2; margin-top:6px; letter-spacing:-.02em; } h2 { font-size:20px; line-height:1.4; margin-top:4px; } header p { margin-top:12px; color:var(--secondary-text-color); max-width:680px; line-height:1.65; }
      .eyebrow { text-transform:uppercase; letter-spacing:.09em; font-size:11.5px; line-height:1.4; font-weight:800; color:var(--primary-color); }
      .shield,.status-dot,.verified,.lock { white-space:nowrap; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:750; background:color-mix(in srgb, var(--primary-color) 12%, transparent); color:var(--primary-color); }
      .panel { margin:18px; padding:22px; border:1px solid var(--divider-color); border-radius:14px; background:color-mix(in srgb, var(--card-background-color) 96%, var(--primary-color) 4%); }
      .section-title { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; margin-bottom:16px; }
      .targets { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr)); gap:12px; margin:18px 0 20px; }
      .target,.finding,.confirm { display:flex; align-items:flex-start; gap:13px; border:1px solid var(--divider-color); border-radius:12px; padding:15px 16px; cursor:pointer; }
      .target span,.finding-main { display:flex; flex-direction:column; gap:5px; min-width:0; } small,.muted { color:var(--secondary-text-color); font-size:13.5px; line-height:1.65; } .target.disabled { opacity:.55; cursor:not-allowed; }
      input[type=checkbox] { width:18px; height:18px; accent-color:var(--primary-color); flex:0 0 auto; }
      button,select { font:inherit; } button { border:0; border-radius:10px; min-height:44px; padding:0 18px; font-weight:750; cursor:pointer; line-height:1.25; }
      button:disabled,select:disabled { opacity:.48; cursor:not-allowed; }
      button:focus-visible,select:focus-visible,input:focus-visible,a:focus-visible { outline:3px solid color-mix(in srgb, var(--primary-color) 40%, transparent); outline-offset:2px; }
      .primary { width:100%; background:var(--primary-color); color:var(--text-primary-color, white); }
      .secondary { background:color-mix(in srgb, var(--primary-color) 12%, transparent); color:var(--primary-color); }
      .danger { width:100%; margin-top:12px; background:var(--error-color, #b3261e); color:white; }
      .link { min-height:auto; padding:4px; color:var(--primary-color); background:transparent; }
      .findings-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:14px; line-height:1.5; font-weight:700; }
      .findings { display:grid; gap:11px; max-height:440px; overflow:auto; padding:3px; }
      .finding { display:grid; grid-template-columns:20px minmax(0,1fr) auto; align-items:center; column-gap:14px; cursor:pointer; min-height:76px; }
      .finding-main strong { line-height:1.45; overflow-wrap:normal; word-break:normal; }
      .finding-main small { display:flex; flex-wrap:wrap; gap:6px 14px; overflow-wrap:anywhere; }
      .finding-main small span { white-space:nowrap; }
      .verified { font-size:11.5px; line-height:1.35; padding:5px 9px; }
      .empty,.loading,.permission { padding:32px 28px; text-align:center; color:var(--secondary-text-color); line-height:1.65; }
      .success-empty { color:var(--success-color, #16855b); }
      .confirm { margin:18px 0; cursor:pointer; color:var(--secondary-text-color); line-height:1.65; font-size:13.5px; }
      .confirm.important { border-color:color-mix(in srgb, var(--warning-color, #ed8b00) 45%, var(--divider-color)); background:color-mix(in srgb, var(--warning-color, #ed8b00) 8%, transparent); }
      .notice { margin:18px; padding:15px 17px; border-radius:10px; line-height:1.65; font-size:13.5px; border:1px solid transparent; overflow-wrap:anywhere; }
      .notice.error { color:var(--error-color, #b3261e); background:color-mix(in srgb, var(--error-color, #b3261e) 9%, transparent); border-color:color-mix(in srgb, var(--error-color, #b3261e) 25%, transparent); }
      .notice.success { color:var(--success-color, #16855b); background:color-mix(in srgb, var(--success-color, #16855b) 9%, transparent); }
      .notice.warning { margin:0 0 12px; color:var(--warning-color, #a65d00); background:color-mix(in srgb, var(--warning-color, #ed8b00) 9%, transparent); }
      select { width:100%; min-height:44px; padding:0 12px; color:var(--primary-text-color); background:var(--card-background-color); border:1px solid var(--divider-color); border-radius:10px; margin:14px 0 2px; }
      .donate { display:flex; justify-content:space-between; gap:16px; padding:18px 22px; border-top:1px solid var(--divider-color); color:var(--secondary-text-color); font-size:13px; line-height:1.55; }
      .donate a { color:var(--primary-color); font-weight:750; text-decoration:none; }
      .permission { padding:40px 28px; } .permission h2 { color:var(--primary-text-color); margin:14px 0 8px; } .permission p { max-width:540px; margin:auto; }
      @media (max-width:600px) {
        header,.section-title,.donate { flex-direction:column; }
        header { padding:22px 20px; } h1 { font-size:26px; }
        .status-dot { align-self:flex-start; }
        .verified { display:none; }
        .finding { grid-template-columns:20px minmax(0,1fr); }
        .panel { margin:12px; padding:18px 16px; }
        .findings { max-height:none; }
        button { width:100%; }
        .link { width:auto; }
      }
    `; }
  }

  if (!customElements.get('ha-encoding-fixer')) customElements.define('ha-encoding-fixer', HAEncodingFixer);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((card) => card.type === TAG)) {
    window.customCards.push({ type: TAG, name: 'Encoding Fixer', description: 'Secure, local-only mojibake repair with verified backups.' });
  }
})();
