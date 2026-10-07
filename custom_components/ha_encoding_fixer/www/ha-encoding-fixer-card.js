(() => {
  'use strict';

  const TAG = 'ha-encoding-fixer';
  const API = 'ha_encoding_fixer';
  const _asText = (value) => value == null ? '' : String(value);
  const _escBase = (value) => value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const _esc = (s) => _escBase(_asText(s));
  const SUPPORT_KEY = 'ha-encoding-fixer-support-dismissed';
  const supportDismissed = () => {
    try { return window.localStorage.getItem(SUPPORT_KEY) === '1'; } catch { return false; }
  };
  const ownDonateFooter = (t) => `
    <footer class="donate" data-source="own-card">
      <a href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer">${_esc(t('Support development'))}</a>
      <button type="button" data-action="dismiss-support" aria-label="${_esc(t('Dismiss support link'))}">×</button>
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

  const PL = Object.freeze({
  "Support development": "Wesprzyj rozwój",
  "Retry loading targets": "Ponów odczyt celów",
  "The server allowlist could not be loaded.": "Nie udało się odczytać listy celów serwera.",
  "No allowlisted targets are available.": "Brak dostępnych celów na liście serwera.",
  "Applied and verified targets: {count}. Backup: {backup}. Restart Home Assistant after reviewing the result.": "Zastosowane i zweryfikowane cele: {count}. Kopia: {backup}. Uruchom ponownie Home Assistant po sprawdzeniu wyniku.",
  "Dismiss support link": "Ukryj link wsparcia",
  "Configuration": "Konfiguracja",
  "Automations": "Automatyzacje",
  "Scripts": "Skrypty",
  "Scenes": "Sceny",
  "Packages": "Pakiety",
  "Entity registry": "Rejestr encji",
  "Administrator access is required.": "Wymagane uprawnienia administratora.",
  "The Encoding Fixer integration is not available. Reload the integration and try again.": "Integracja Encoding Fixer jest niedostępna. Przeładuj integrację i spróbuj ponownie.",
  "Select at least one available target.": "Wybierz co najmniej jeden dostępny cel.",
  "The selected findings are no longer valid. Create a new preview.": "Wybrane wyniki są już nieaktualne. Utwórz nowy podgląd.",
  "This preview expired or belongs to another session. Create a new preview.": "Podgląd wygasł lub należy do innej sesji. Utwórz nowy podgląd.",
  "The source changed after preview. Nothing was applied; create a new preview.": "Źródło zmieniło się po utworzeniu podglądu. Niczego nie zastosowano; utwórz nowy podgląd.",
  "A selected file is not valid UTF-8. Nothing was applied.": "Wybrany plik nie ma poprawnego kodowania UTF-8. Niczego nie zastosowano.",
  "The proposed result is not valid Home Assistant YAML. Nothing was applied.": "Proponowany wynik nie jest poprawnym plikiem YAML Home Assistant. Niczego nie zastosowano.",
  "A target became unavailable or failed the safety check. Nothing was applied.": "Cel stał się niedostępny lub nie przeszedł kontroli bezpieczeństwa. Niczego nie zastosowano.",
  "A complete backup could not be created. Nothing was applied.": "Nie udało się utworzyć pełnej kopii zapasowej. Niczego nie zastosowano.",
  "Automatic rollback could not be verified. Do not retry; inspect the local Home Assistant logs and backup.": "Nie udało się potwierdzić automatycznego przywrócenia. Nie ponawiaj operacji; sprawdź lokalne logi Home Assistant i kopię zapasową.",
  "This operation identifier was already used for a different request.": "Ten identyfikator operacji został już użyty dla innego żądania.",
  "Confirm the restore before continuing.": "Potwierdź przywrócenie przed kontynuowaniem.",
  "The preview is too large to process safely in one operation.": "Podgląd jest zbyt duży, aby bezpiecznie przetworzyć go w jednej operacji.",
  "The operation failed safely. Create a new preview before retrying.": "Operacja została bezpiecznie przerwana. Utwórz nowy podgląd przed ponowieniem.",
  "The backup could not be restored safely.": "Nie udało się bezpiecznie przywrócić kopii zapasowej.",
  "The request could not be completed safely.": "Nie udało się bezpiecznie wykonać żądania.",
  "Preview ready. Findings: {count}.": "Podgląd gotowy. Liczba wyników: {count}.",
  "Preview complete: no safe fixes found.": "Podgląd zakończony: nie znaleziono bezpiecznych poprawek.",
  "Select findings and confirm the transactional write before applying.": "Wybierz wyniki i potwierdź zapis przed zastosowaniem poprawek.",
  "Applied and verified targets: {count}. Backup: {backup}.": "Zastosowane i zweryfikowane cele: {count}. Kopia zapasowa: {backup}.",
  "Choose a backup and confirm the restore first.": "Najpierw wybierz kopię zapasową i potwierdź przywrócenie.",
  "Restored and verified files: {count}. Restart Home Assistant after reviewing the result.": "Przywrócone i zweryfikowane pliki: {count}. Po sprawdzeniu wyniku uruchom ponownie Home Assistant.",
  "Loading the server allowlist…": "Wczytywanie listy dozwolonych celów…",
  "Available": "Dostępny",
  "Not configured": "Nieskonfigurowany",
  "Create a read-only preview to see exact, redacted findings.": "Utwórz podgląd bez zapisu, aby zobaczyć dokładne wyniki z ukrytą treścią.",
  "No encoding fixes were found in the selected targets.": "W wybranych celach nie znaleziono poprawek kodowania.",
  "Redacted findings: {count}": "Wyniki z ukrytą treścią: {count}",
  "Select all": "Zaznacz wszystkie",
  "Line {line}": "Wiersz {line}",
  "Registry name": "Nazwa w rejestrze",
  "Ref {ref}": "Identyfikator {ref}",
  "Contents are hidden from the browser": "Treść jest ukryta przed przeglądarką",
  "Redacted": "Treść ukryta",
  "Files: {count}": "Pliki: {count}",
  " · offline recovery only": " · tylko odzyskiwanie offline",
  "Recovery": "Odzyskiwanie",
  "Verified server backups": "Zweryfikowane kopie zapasowe",
  "Refresh": "Odśwież",
  "Only timestamp IDs and file counts are shown. Paths and file contents stay on the Home Assistant host.": "Widoczne są tylko identyfikatory czasowe i liczby plików. Ścieżki i treść plików pozostają na hoście Home Assistant.",
  "Backups containing the entity-registry store are intentionally not restored while Home Assistant is running; use them only for offline recovery.": "Kopii zawierających rejestr encji nie można przywrócić podczas działania Home Assistant; służą wyłącznie do odzyskiwania offline.",
  "Backup": "Kopia zapasowa",
  "Choose a backup…": "Wybierz kopię zapasową…",
  "I understand that restore writes allowlisted files, verifies them, and creates a rollback backup first.": "Rozumiem, że przywrócenie zapisuje dozwolone pliki i weryfikuje je, a wcześniej tworzy kopię umożliwiającą wycofanie zmian.",
  "Restore selected backup": "Przywróć wybraną kopię",
  "Connecting to Home Assistant…": "Łączenie z Home Assistant…",
  "Restricted": "Dostęp ograniczony",
  "Administrator access required": "Wymagane uprawnienia administratora",
  "Encoding previews can inspect configuration metadata and fixes can write configuration files. This card does not use a reduced-permission fallback.": "Podgląd kodowania odczytuje metadane konfiguracji, a poprawki mogą zapisywać pliki konfiguracyjne. Ta karta wymaga uprawnień administratora.",
  "I reviewed {count} selected findings for {targets}. Apply will revalidate source hashes and YAML, back up every target before any write, verify readback, and roll back the whole write set on failure.": "Sprawdziłem wybrane wyniki ({count}) dla: {targets}. Zastosowanie ponownie sprawdzi źródła i YAML, utworzy kopie wszystkich celów przed zapisem, zweryfikuje wynik i wycofa wszystkie zmiany w razie błędu.",
  "Home Assistant · local only": "Home Assistant · tylko lokalnie",
  "Preview, validate, back up and repair mojibake without exposing configuration contents to the browser.": "Przeglądaj, sprawdzaj i naprawiaj błędy kodowania z kopiami zapasowymi, bez udostępniania treści konfiguracji przeglądarce.",
  "Admin": "Administrator",
  "Step 1": "Krok 1",
  "Choose allowlisted targets": "Wybierz dozwolone cele",
  "Read-only preview": "Podgląd bez zapisu",
  "Working safely…": "Bezpieczne przetwarzanie…",
  "Create preview": "Utwórz podgląd",
  "Step 2": "Krok 2",
  "Review redacted findings": "Sprawdź wyniki",
  "Clear": "Wyczyść",
  "Preview is partial because one or more targets were unavailable or invalid UTF-8. Only visible findings can be selected.": "Podgląd jest częściowy, ponieważ co najmniej jeden cel był niedostępny lub miał niepoprawne kodowanie UTF-8. Można wybrać tylko widoczne wyniki.",
  "Apply selected fixes: {count}": "Zastosuj wybrane poprawki: {count}",
  "Select findings to continue": "Wybierz wyniki, aby kontynuować"
});

  class HAEncodingFixer extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._hass = null;
      this._admin = false;
      this._language = 'en';
      this._config = {};
      this._epoch = 0;
      this._connection = null;
      this._userId = null;
      this._initialized = false;
      this._busy = false;
      this._targets = [];
      this._targetsLoaded = false;
      this._targetsLoading = false;
      this._targetsError = false;
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

    setConfig(config) { this._config = config || {}; this._render(); }
    getCardSize() { return 8; }
    static getStubConfig() { return {}; }

    set hass(value) {
      const hadHass = Boolean(this._hass);
      const wasAdmin = this._admin;
      const nextConnection = value?.connection || null;
      const nextUserId = value?.user?.id || null;
      const identityChanged = Boolean(this._hass) && (
        this._connection !== nextConnection || this._userId !== nextUserId ||
        wasAdmin !== Boolean(value?.user?.is_admin)
      );
      const nextLanguage = /^pl(?:[-_]|$)/i.test(value?.language || '') ? 'pl' : 'en';
      const languageChanged = this._language !== nextLanguage;
      this._language = nextLanguage;
      this._hass = value || null;
      this._admin = this._isAdmin();
      if (!this._hass || identityChanged) {
        this._epoch += 1;
        this._initialized = false;
        this._busy = false;
        this._targets = [];
        this._targetsLoaded = false;
        this._targetsLoading = false;
        this._targetsError = false;
        this._selectedTargets.clear();
        this._clearPreview(false);
        this._backups = [];
        this._selectedBackup = '';
        this._restoreConfirmed = false;
        this._notice = null;
      }
      this._connection = nextConnection;
      this._userId = nextUserId;
      if (!hadHass || !value || identityChanged || languageChanged || wasAdmin !== this._isAdmin()) this._render();
      if (this._isAdmin() && !this._initialized) {
        this._initialized = true;
        void this._initialize();
      }
    }
    get hass() { return this._hass; }

    _t(message, values = {}) {
      const template = this._language === 'pl' ? (PL[message] || message) : message;
      return template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? _asText(values[key]) : match);
    }

    _isAdmin() { return Boolean(this._hass?.user?.is_admin); }

    _bindEvents() {
      this.shadowRoot.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button || button.disabled) return;
        const action = button.dataset.action;
        if (action === 'preview') void this._preview();
        if (action === 'retry-targets') void this._loadTargets();
        if (action === 'apply') void this._apply();
        if (action === 'list-backups') void this._loadBackups();
        if (action === 'restore') void this._restore();
        if (action === 'select-all') {
          this._selectedChanges = new Set((this._previewState?.findings || []).map((item) => item.change_id));
          this._confirmed = false;
          this._render();
        }
        if (action === 'clear-preview') this._clearPreview();
        if (action === 'dismiss-support') {
          try { window.localStorage.setItem(SUPPORT_KEY, '1'); } catch { /* optional preference */ }
          this._render();
        }
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

    _setNotice(kind, message, values = {}) {
      this._notice = { kind, message, values };
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
      if (this._targetsLoading || epoch !== this._epoch) return;
      this._targetsLoading = true;
      this._render();
      try {
        const response = await this._call('targets', {}, epoch);
        if (!Array.isArray(response?.targets)) throw { code: 'request_failed' };
        const targets = response.targets;
        this._targets = targets.filter((item) => LABELS[item.target_id]);
        this._targetsLoaded = true;
        this._targetsError = false;
        if (this._notice?.scope === 'targets') this._notice = null;
        if (!this._selectedTargets.size) {
          this._targets.filter((item) => item.available).forEach((item) => this._selectedTargets.add(item.target_id));
        }
        this._render();
      } catch (error) {
        if (this._errorCode(error) !== 'request_cancelled') {
          this._targetsError = true;
          this._showError(error);
          this._notice.scope = 'targets';
        }
      } finally {
        if (epoch === this._epoch) {
          this._targetsLoading = false;
          this._render();
        }
      }
    }

    async _loadBackups(epoch = this._epoch) {
      if (!this._isAdmin()) return;
      try {
        const response = await this._call('list_backups', {}, epoch);
        // Failed attempts can allocate an empty directory without copying any file.
        // Keep real offline-only snapshots, but do not offer an empty allocation.
        if (!Array.isArray(response?.backups)) throw { code: 'request_failed' };
        this._backups = response.backups.filter((item) => Number.isInteger(item?.file_count) && item.file_count > 0);
        if (this._notice?.scope === 'backups') this._notice = null;
        if (this._selectedBackup && !this._backups.some((item) => item.backup_id === this._selectedBackup && item.restorable !== false)) {
          this._selectedBackup = '';
          this._restoreConfirmed = false;
        }
        this._render();
      } catch (error) {
        if (this._errorCode(error) !== 'request_cancelled') {
          this._showError(error);
          this._notice.scope = 'backups';
        }
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
        if (typeof response?.preview_id !== 'string' || !response.preview_id || !Array.isArray(response.findings)) throw { code: 'request_failed' };
        this._previewState = response;
        this._selectedChanges = new Set((response.findings || []).map((item) => item.change_id));
        this._confirmed = false;
        const count = this._selectedChanges.size;
        this._notice = { kind: 'success', message: count ? 'Preview ready. Findings: {count}.' : 'Preview complete: no safe fixes found.', values: { count } };
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
        if (response?.status !== 'success' || !Number.isInteger(response.changed) || response.changed < 0) throw { code: 'request_failed' };
        this._clearPreview(false);
        this._notice = { kind: 'success', message: response.restart_recommended
          ? 'Applied and verified targets: {count}. Backup: {backup}. Restart Home Assistant after reviewing the result.'
          : 'Applied and verified targets: {count}. Backup: {backup}.', values: { count: response.changed, backup: _asText(response.backup_id) } };
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
        if (response?.status !== 'success' || !Number.isInteger(response.restored) || response.restored < 0) throw { code: 'request_failed' };
        this._restoreConfirmed = false;
        this._notice = { kind: 'success', message: 'Restored and verified files: {count}. Restart Home Assistant after reviewing the result.', values: { count: response.restored } };
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
      const t = (message, values) => _esc(this._t(message, values));
      if (this._targetsError) return `<p class="muted">${t('The server allowlist could not be loaded.')}</p><button class="secondary" data-action="retry-targets" type="button" ${this._targetsLoading ? 'disabled' : ''}>${t('Retry loading targets')}</button>`;
      if (!this._targets.length) return `<p class="muted">${t(this._targetsLoaded ? 'No allowlisted targets are available.' : 'Loading the server allowlist…')}</p>`;
      return this._targets.map((item) => `
        <label class="target ${item.available ? '' : 'disabled'}">
          <input type="checkbox" data-target="${_esc(item.target_id)}" ${this._selectedTargets.has(item.target_id) ? 'checked' : ''} ${!item.available || this._busy ? 'disabled' : ''}>
          <span><strong>${t(LABELS[item.target_id])}</strong><small>${t(item.available ? 'Available' : 'Not configured')}</small></span>
        </label>`).join('');
    }

    _findingsMarkup() {
      const t = (message, values) => _esc(this._t(message, values));
      const findings = this._previewState?.findings || [];
      if (!this._previewState) return `<div class="empty">${t('Create a read-only preview to see exact, redacted findings.')}</div>`;
      if (!findings.length) return `<div class="empty success-empty">${t('No encoding fixes were found in the selected targets.')}</div>`;
      return `
        <div class="findings-head"><span>${t('Redacted findings: {count}', { count: findings.length })}</span><button class="link" data-action="select-all" type="button">${t('Select all')}</button></div>
        <div class="findings">${findings.map((item) => `
          <label class="finding">
            <input type="checkbox" data-change="${_esc(item.change_id)}" ${this._selectedChanges.has(item.change_id) ? 'checked' : ''} ${this._busy ? 'disabled' : ''}>
            <span class="finding-main"><strong>${t(LABELS[item.target_id] || item.target_id)}</strong><small><span>${item.line ? t('Line {line}', { line: item.line }) : t('Registry name')}</span><span>${_esc(item.kind || 'encoding')}</span><span>${t('Ref {ref}', { ref: this._shortRef(item.file_ref || item.entity_ref || 'server') })}</span></small></span>
            <span class="verified" aria-label="${t('Contents are hidden from the browser')}">${t('Redacted')}</span>
          </label>`).join('')}</div>`;
    }

    _backupMarkup() {
      const t = (message, values) => _esc(this._t(message, values));
      const options = this._backups.map((item) => `<option value="${_esc(item.backup_id)}" ${this._selectedBackup === item.backup_id ? 'selected' : ''} ${item.restorable === false ? 'disabled' : ''}>${_esc(item.backup_id)} · ${t('Files: {count}', { count: Number(item.file_count || 0) })}${item.restorable === false ? t(' · offline recovery only') : ''}</option>`).join('');
      return `
        <section class="panel restore-panel">
          <div class="section-title"><div><span class="eyebrow">${t('Recovery')}</span><h2>${t('Verified server backups')}</h2></div><button class="secondary" data-action="list-backups" type="button" ${this._busy ? 'disabled' : ''}>${t('Refresh')}</button></div>
          <p class="muted">${t('Only timestamp IDs and file counts are shown. Paths and file contents stay on the Home Assistant host.')}</p>
          <p class="muted">${t('Backups containing the entity-registry store are intentionally not restored while Home Assistant is running; use them only for offline recovery.')}</p>
          <select data-backup-select aria-label="${t('Backup')}" ${this._busy ? 'disabled' : ''}><option value="">${t('Choose a backup…')}</option>${options}</select>
          <label class="confirm"><input type="checkbox" data-restore-confirm ${this._restoreConfirmed ? 'checked' : ''} ${this._selectedBackup ? '' : 'disabled'}><span>${t('I understand that restore writes allowlisted files, verifies them, and creates a rollback backup first.')}</span></label>
          <button class="danger" data-action="restore" type="button" ${!this._selectedBackup || !this._restoreConfirmed || this._busy ? 'disabled' : ''}>${t('Restore selected backup')}</button>
        </section>`;
    }

    _render() {
      if (!this.shadowRoot) return;
      const active = this.shadowRoot.activeElement;
      const focusAttribute = ['data-action', 'data-target', 'data-change', 'data-confirm', 'data-backup-select', 'data-restore-confirm'].find(key => active?.hasAttribute(key));
      const focusValue = focusAttribute ? active.getAttribute(focusAttribute) : null;
      const t = (message, values) => _esc(this._t(message, values));
      if (!this._hass) {
        this.shadowRoot.innerHTML = `<style>${this._styles()}</style><ha-card><div class="loading">${t('Connecting to Home Assistant…')}</div></ha-card>`;
        return;
      }
      if (!this._isAdmin()) {
        this.shadowRoot.innerHTML = `<style>${this._styles()}</style><ha-card><div class="permission"><span class="lock">${t('Restricted')}</span><h2>${t('Administrator access required')}</h2><p>${t('Encoding previews can inspect configuration metadata and fixes can write configuration files. This card does not use a reduced-permission fallback.')}</p></div></ha-card>`;
        return;
      }
      const selectedCount = this._selectedChanges.size;
      const notice = this._notice ? `<div class="notice ${_esc(this._notice.kind)}" role="status">${_esc(this._t(this._notice.message, this._notice.values))}</div>` : '';
      const preview = this._previewState;
      const targetSummary = [...this._selectedTargets].map((id) => this._t(LABELS[id] || id)).join(', ');
      const confirmation = preview && (preview.findings || []).length ? `
        <label class="confirm important"><input type="checkbox" data-confirm ${this._confirmed ? 'checked' : ''}><span>${t('I reviewed {count} selected findings for {targets}. Apply will revalidate source hashes and YAML, back up every target before any write, verify readback, and roll back the whole write set on failure.', { count: selectedCount, targets: targetSummary })}</span></label>` : '';
      const html = `
        <style>${this._styles()}</style>
        <ha-card>
          <header><div><span class="eyebrow">${t('Home Assistant · local only')}</span><h1>Encoding Fixer</h1><p>${t('Preview, validate, back up and repair mojibake without exposing configuration contents to the browser.')}</p></div><span class="shield">${t('Admin')}</span></header>
          ${notice}
          <section class="panel">
            <div class="section-title"><div><span class="eyebrow">${t('Step 1')}</span><h2>${t('Choose allowlisted targets')}</h2></div><span class="status-dot">${t('Read-only preview')}</span></div>
            <div class="targets">${this._targetMarkup()}</div>
            <button class="primary" data-action="preview" type="button" ${this._busy || !this._selectedTargets.size ? 'disabled' : ''}>${t(this._busy ? 'Working safely…' : 'Create preview')}</button>
          </section>
          <section class="panel">
            <div class="section-title"><div><span class="eyebrow">${t('Step 2')}</span><h2>${t('Review redacted findings')}</h2></div>${preview ? `<button class="link" data-action="clear-preview" type="button">${t('Clear')}</button>` : ''}</div>
            ${preview?.completeness === 'partial' ? `<div class="notice warning">${t('Preview is partial because one or more targets were unavailable or invalid UTF-8. Only visible findings can be selected.')}</div>` : ''}
            ${this._findingsMarkup()}
            ${confirmation}
            <button class="primary" data-action="apply" type="button" ${!preview || !selectedCount || !this._confirmed || this._busy ? 'disabled' : ''}>${selectedCount ? t('Apply selected fixes: {count}', { count: selectedCount }) : t('Select findings to continue')}</button>
          </section>
          ${this._backupMarkup()}
          ${this._isAdmin() && this._config.show_support !== false && !supportDismissed() ? ownDonateFooter((message) => this._t(message)) : ''}
        </ha-card>`;
      this.shadowRoot.innerHTML = html;
      if (focusAttribute) {
        const next = [...this.shadowRoot.querySelectorAll(`[${focusAttribute}]`)].find(control => control.getAttribute(focusAttribute) === focusValue);
        if (next && !next.disabled) {
          next.focus({ preventScroll: true });
          // Native checkbox activation can finish by blurring the removed input.
          // Restore only an otherwise lost focus after that activation completes.
          window.requestAnimationFrame?.(() => {
            if (next.isConnected && !next.disabled && !this.shadowRoot.activeElement && document.activeElement === document.body) {
              next.focus({ preventScroll: true });
            }
          });
        }
      }
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
      .donate { display:flex; align-items:center; justify-content:center; gap:12px; padding:8px 16px; border-top:1px solid var(--divider-color); color:var(--secondary-text-color); font-size:12px; line-height:1.4; }
      .donate a { color:var(--primary-color); font-weight:750; text-decoration:none; }
      .donate button { width:auto; border:0; background:transparent; color:var(--secondary-text-color); cursor:pointer; padding:2px 6px; }
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
  // The sidebar must use this integration's frontend even when a legacy
  // dashboard resource has already defined the public card element.
  if (!customElements.get('ha-encoding-fixer-panel')) customElements.define('ha-encoding-fixer-panel', class extends HAEncodingFixer {});
  window.customCards = window.customCards || [];
  if (!window.customCards.some((card) => card.type === TAG)) {
    window.customCards.push({ type: TAG, name: 'Encoding Fixer', description: 'Secure, local-only mojibake repair with verified backups.' });
  }
})();
