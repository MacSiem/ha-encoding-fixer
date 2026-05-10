/* HA Tools split — ha-encoding-fixer v4.0.0 (2026-05-10) — single-tool standalone repo */
(function() {
'use strict';

// -- HA Tools Persistence (stub -- full impl in ha-tools-panel.js) --
window._haToolsPersistence = window._haToolsPersistence || { _cache: {}, _hass: null, setHass(h) { this._hass = h; }, async save(k, d) { try { localStorage.setItem('ha-encoding-fixer-' + k, JSON.stringify(d)); } catch(e) { console.debug('[ha-encoding-fixer] caught:', e); } }, async load(k) { try { const r = localStorage.getItem('ha-encoding-fixer-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } }, loadSync(k) { try { const r = localStorage.getItem('ha-encoding-fixer-' + k); return r ? JSON.parse(r) : null; } catch(e) { return null; } } };

// -- HA Tools Escape helper (fallback) --
const _esc = window._haToolsEsc || ((s) => String(s == null ? '' : s).replace(/[&<>"\']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));

/* ===== HA Tools split — inline shared infrastructure ===== */
// Bento Design System CSS (inline copy — keeps tool standalone)
if (typeof window !== 'undefined' && !window.HAToolsBentoCSS) {
  window.HAToolsBentoCSS = `
/* ═══════════════════════════════════════════════
   HA Tools — Bento Design System v1.0
   ═══════════════════════════════════════════════ */

/* ── CSS Custom Properties ───────────────────── */
:host {
  /* Primary palette */
  --bento-primary: #3B82F6;
  --bento-primary-hover: #2563EB;
  --bento-primary-light: rgba(59, 130, 246, 0.08);
  --bento-success: #10B981;
  --bento-success-light: rgba(16, 185, 129, 0.08);
  --bento-error: #EF4444;
  --bento-error-light: rgba(239, 68, 68, 0.08);
  --bento-warning: #F59E0B;
  --bento-warning-light: rgba(245, 158, 11, 0.08);

  /* Theme — maps to HA theme vars with light fallbacks */
  --bento-bg: var(--primary-background-color, #F8FAFC);
  --bento-card: var(--card-background-color, #FFFFFF);
  --bento-border: var(--divider-color, #E2E8F0);
  --bento-text: var(--primary-text-color, #1E293B);
  --bento-text-secondary: var(--secondary-text-color, #64748B);
  --bento-text-muted: var(--disabled-text-color, #94A3B8);

  /* Radii */
  --bento-radius-xs: 6px;
  --bento-radius-sm: 10px;
  --bento-radius-md: 16px;

  /* Shadows */
  --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
  --bento-shadow-lg: 0 8px 25px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04);

  /* Transition */
  --bento-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  /* Typography */
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  display: block;
  color: var(--bento-text);
}

/* ── Dark mode ───────────────────────────────── */
@media (prefers-color-scheme: dark) {
  :host {
    --bento-bg: var(--primary-background-color, #1a1a2e);
    --bento-card: var(--card-background-color, #16213e);
    --bento-border: var(--divider-color, #2a2a4a);
    --bento-text: var(--primary-text-color, #e0e0e0);
    --bento-text-secondary: var(--secondary-text-color, #a0a0b0);
    --bento-text-muted: var(--disabled-text-color, #6a6a7a);
    --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
    --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.4);
    --bento-primary-light: rgba(59,130,246,0.15);
    --bento-success-light: rgba(16,185,129,0.15);
    --bento-error-light: rgba(239,68,68,0.15);
    --bento-warning-light: rgba(245,158,11,0.15);
    color-scheme: dark !important;
  }
  .card, .card-container, .main-card, .exporter-card, .security-card, .reports-card, .storage-card, .chore-card, .cry-card, .backup-card, .network-card, .sentence-card, .energy-card, .panel-card {
    background: var(--bento-card) !important; color: var(--bento-text) !important; border-color: var(--bento-border) !important;
  }
  input, select, textarea { background: var(--bento-bg); color: var(--bento-text); border-color: var(--bento-border); }
  .stat, .stat-card, .summary-card, .metric-card, .kpi-card, .health-card { background: var(--bento-bg); border-color: var(--bento-border); }
  .tab-content, .section { color: var(--bento-text); }
  table th { background: var(--bento-bg); color: var(--bento-text-secondary); border-color: var(--bento-border); }
  table td { color: var(--bento-text); border-color: var(--bento-border); }
  tr:hover td { background: rgba(59,130,246,0.08); }
  .empty-state, .no-data { color: var(--bento-text-secondary); }
  .schedule-section, .settings-section, .detail-panel, .details, .device-detail { background: var(--bento-bg); border-color: var(--bento-border); }
  .addon-list, .content-item { background: rgba(255,255,255,0.05); }
  .chart-container { background: var(--bento-bg); border-color: var(--bento-border); }
  pre, code { background: #1e293b !important; color: #e2e8f0 !important; }
}

/* ── Reset ───────────────────────────────────── */
* { box-sizing: border-box; }

/* ── Main Card Wrapper ───────────────────────── */
.card {
  background: var(--bento-card);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-md);
  box-shadow: var(--bento-shadow-sm);
  color: var(--bento-text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Header ──────────────────────────────────── */
.header {
  padding: 16px 20px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-icon { font-size: 22px; }
.header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--bento-text);
}
.header-badge {
  margin-left: auto;
  background: var(--bento-border);
  color: var(--bento-text-secondary);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 20px;
  font-weight: 500;
}
.content { padding: 16px 20px 20px; }

/* ── Tabs (Bento unified) ────────────────────── */
.tabs, .tab-bar, .tab-nav, .tab-header {
  display: flex !important;
  gap: 4px !important;
  border-bottom: 2px solid var(--bento-border, var(--divider-color, #334155)) !important;
  padding: 0 4px !important;
  margin-bottom: 20px !important;
  overflow-x: auto !important; overflow-y: hidden !important; -webkit-overflow-scrolling: touch !important;
  flex-wrap: nowrap !important;
}
.tab, .tab-btn, .tab-button, .dtab {
  padding: 10px 18px !important;
  border: none !important;
  background: transparent !important;
  cursor: pointer !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  font-family: 'Inter', sans-serif !important;
  color: var(--bento-text-secondary, var(--secondary-text-color, #94A3B8)) !important;
  border-bottom: 2px solid transparent !important;
  margin-bottom: -2px !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  white-space: nowrap !important;
  border-radius: 0 !important;
  flex: none !important;
}
.tab:hover, .tab-btn:hover, .tab-button:hover, .dtab:hover {
  color: var(--bento-primary, #3B82F6) !important;
  background: rgba(59, 130, 246, 0.08) !important;
}
.tab.active, .tab-btn.active, .tab-button.active, .dtab.active {
  color: var(--bento-primary, #3B82F6) !important;
  border-bottom-color: var(--bento-primary, #3B82F6) !important;
  background: rgba(59, 130, 246, 0.04) !important;
  font-weight: 600 !important;
}

/* ── Tab content animation ───────────────────── */
.tab-content {
  display: block;
}
.tab-content.active {
  animation: bentoFadeIn 0.3s ease-out;
}
@keyframes bentoFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Stat / KPI cards ────────────────────────── */
.stat-card, .stat-item, .metric-card, .kpi-card {
  background: var(--bento-card, var(--card-background-color, #1E293B)) !important;
  border: 1px solid var(--bento-border, var(--divider-color, #334155)) !important;
  border-radius: var(--bento-radius-sm, 10px) !important;
  padding: 16px !important;
  text-align: center !important;
  transition: var(--bento-transition);
}
.stat-card:hover, .stat-item:hover, .metric-card:hover, .kpi-card:hover {
  box-shadow: var(--bento-shadow-md);
}
.stat-icon { font-size: 20px; margin-bottom: 4px; }
.stat-value, .stat-val, .metric-value, .kpi-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--bento-text);
}
.stat-label, .stat-lbl, .metric-label, .kpi-lbl {
  font-size: 11px;
  color: var(--bento-text-secondary);
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

/* ── Overview grid (2×2 stat layout) ─────────── */
.overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

/* ── Section headers ─────────────────────────── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--bento-text-secondary);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin: 12px 0 8px;
}

/* ── Loading / Empty / Info ──────────────────── */
.loading-bar {
  height: 3px;
  background: linear-gradient(90deg, var(--bento-primary), transparent);
  border-radius: 2px;
  animation: bentoLoad 1s infinite;
  margin-bottom: 8px;
}
@keyframes bentoLoad { 0% { background-position: 0; } 100% { background-position: 200px; } }

.empty-state, .no-data, .no-results {
  text-align: center;
  color: var(--bento-text-secondary);
  padding: 32px 16px;
  font-size: 13px;
  background: var(--bento-bg);
  border-radius: var(--bento-radius-sm);
}
.info-note, .tip-box {
  font-size: 12px;
  color: var(--bento-text-secondary);
  background: var(--bento-bg);
  border-radius: var(--bento-radius-sm);
  padding: 8px 10px;
  border-left: 3px solid var(--bento-primary);
  margin-top: 8px;
}
.last-updated {
  font-size: 11px;
  color: var(--bento-text-muted);
  text-align: right;
  margin-top: 8px;
}

/* ── Buttons ─────────────────────────────────── */
.refresh-btn {
  background: var(--bento-border);
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  color: var(--bento-text-secondary);
  cursor: pointer;
  font-weight: 500;
  transition: var(--bento-transition);
}
.refresh-btn:hover { background: var(--bento-primary); color: white; }

.toggle-btn, .action-btn {
  background: var(--bento-primary);
  border: none;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: var(--bento-transition);
}
.toggle-btn:hover, .action-btn:hover { opacity: .85; }

.send-btn, .btn-primary {
  width: 100%;
  background: var(--bento-primary);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--bento-transition);
}
.send-btn:hover, .btn-primary:hover {
  background: var(--bento-primary-hover);
  transform: translateY(-1px);
}
.send-btn:active, .btn-primary:active { transform: translateY(0); }
.send-btn:disabled, .btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* ── Badges / Status ─────────────────────────── */
.badge, .status-badge, .tag, .chip {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  display: inline-block;
}
.badge-ok, .badge-success { background: var(--bento-success-light); color: var(--bento-success); }
.badge-er, .badge-error   { background: var(--bento-error-light);   color: var(--bento-error); }
.badge-warn, .badge-warning { background: var(--bento-warning-light); color: var(--bento-warning); }
.badge-info { background: var(--bento-primary-light); color: var(--bento-primary); }

/* ── Count badges (inline) ───────────────────── */
.count-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
}
.error-badge { background: rgba(239,68,68,0.13); color: var(--bento-error); }
.warn-badge  { background: rgba(245,158,11,0.13); color: var(--bento-warning); }
.info-badge  { background: rgba(59,130,246,0.13); color: var(--bento-primary); }
.ok-badge    { background: rgba(16,185,129,0.13); color: var(--bento-success); }

/* ── Tables ───────────────────────────────────── */
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th {
  background: var(--bento-bg);
  color: var(--bento-text-secondary);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 14px;
  text-align: left;
  border-bottom: 2px solid var(--bento-border);
}
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--bento-border);
  color: var(--bento-text);
  font-size: 13px;
}
tr:hover td { background: var(--bento-primary-light); }

/* ── Forms / Inputs ──────────────────────────── */
input, select, textarea {
  padding: 8px 12px;
  border: 1.5px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  background: var(--bento-card);
  color: var(--bento-text);
  font-size: 13px;
  font-family: 'Inter', sans-serif;
  transition: var(--bento-transition);
  outline: none;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--bento-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* ── Code blocks ─────────────────────────────── */
code {
  background: var(--bento-border);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  overflow-x: auto;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Grid layouts ────────────────────────────── */
.schedule-grid, .send-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.schedule-card, .send-card, .info-card {
  background: var(--bento-bg);
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm);
  padding: 14px;
}

/* ── Log entries ─────────────────────────────── */
.log-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 4px 6px;
  padding: 8px;
  border-radius: var(--bento-radius-sm);
  margin-bottom: 4px;
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
}
.error-entry { background: var(--bento-error-light); border: 1px solid rgba(239,68,68,0.13); }
.warn-entry  { background: var(--bento-warning-light); border: 1px solid rgba(245,158,11,0.13); }
.log-time { color: var(--bento-text-muted); flex-shrink: 0; }
.log-domain {
  font-weight: 600;
  flex-shrink: 1;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
}
.error-domain { color: var(--bento-error); }
.warn-domain  { color: var(--bento-warning); }
.log-msg {
  color: var(--bento-text-secondary);
  flex-basis: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  min-width: 0;
}

/* ── Send status ─────────────────────────────── */
.send-status {
  padding: 10px 14px;
  border-radius: var(--bento-radius-sm);
  margin-top: 12px;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}
.send-status.sending { background: var(--bento-primary-light); color: var(--bento-primary); }
.send-status.success { background: var(--bento-success-light); color: var(--bento-success); }
.send-status.error   { background: var(--bento-error-light);   color: var(--bento-error); }

/* ── Scrollbar ───────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bento-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--bento-text-muted); }

/* ── Animations ──────────────────────────────── */
@keyframes bentoSpin { to { transform: rotate(360deg); } }
@keyframes bentoPulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }

/* ── Mobile — 768 px ─────────────────────────── */
@media (max-width: 768px) {
  .content { padding: 12px; }
  .tabs { flex-wrap: nowrap !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; gap: 2px !important; }
  .tab, .tab-button, .tab-btn { padding: 6px 10px !important; font-size: 12px !important; white-space: nowrap !important; }
  .overview-grid, .stats-grid, .summary-grid, .stat-cards, .kpi-grid, .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .stat-value, .stat-val, .kpi-val, .metric-val { font-size: 18px !important; }
  .stat-label, .stat-lbl, .kpi-lbl, .metric-lbl { font-size: 10px !important; }
  .send-grid, .schedule-grid { grid-template-columns: 1fr; }
  .log-entry { flex-wrap: wrap; gap: 2px 6px; }
  .log-domain { max-width: 60%; font-size: 11px; }
  .log-msg { flex-basis: 100%; max-width: 100%; overflow-wrap: anywhere; font-size: 11px; }
  pre { white-space: pre-wrap; word-break: break-all; max-width: calc(100vw - 80px); overflow-x: auto; }
  .panels, .board { flex-direction: column; }
  .column { min-width: unset; }
  h2 { font-size: 18px; }
  h3 { font-size: 15px; }
}

/* ── Mobile — 480 px ─────────────────────────── */
@media (max-width: 480px) {
  .tabs { gap: 1px !important; }
  .tab, .tab-button, .tab-btn { padding: 5px 8px !important; font-size: 11px !important; }
  .overview-grid, .stats-grid, .summary-grid { grid-template-columns: 1fr 1fr; }
  .stat-value, .stat-val, .kpi-val { font-size: 16px !important; }
}
`;
}
// XSS escape singleton (idempotent)
if (typeof window !== 'undefined') {
  window._haToolsEsc = window._haToolsEsc || (function(){
    var MAP = {};
    MAP[String.fromCharCode(38)] = '&amp;';
    MAP[String.fromCharCode(60)] = '&lt;';
    MAP[String.fromCharCode(62)] = '&gt;';
    MAP[String.fromCharCode(34)] = '&quot;';
    MAP[String.fromCharCode(39)] = '&#39;';
    return function(s){ return typeof s === 'string' ? s.replace(/[&<>"']/g, function(c){ return MAP[c]; }) : (s == null ? '' : s); };
  })();
}
// Universal donate footer injector — guarantees the support box appears
// on every split-tool card regardless of internal render state.
if (typeof window !== 'undefined' && !window.__haToolsSplitDonateInjector) {
  window.__haToolsSplitDonateInjector = true;
  var SPLIT_TAGS = ['ha-purge-cache','ha-yaml-checker','ha-data-exporter','ha-baby-tracker','ha-chore-tracker','ha-energy-optimizer','ha-energy-insights','ha-energy-email','ha-log-email','ha-smart-reports','ha-network-map','ha-trace-viewer','ha-automation-analyzer','ha-storage-monitor','ha-backup-manager','ha-security-check','ha-device-health','ha-sentence-manager','ha-encoding-fixer','ha-entity-renamer','ha-frigate-privacy','ha-vacuum-water-monitor'];
  var DONATE_HTML = ''
    + '<div class="donate-section" data-source="ha-tools-split-injector">'
    + '  <div class="donate-text">'
    + '    <h3>❤️ Support HA Tools Development</h3>'
    + '    <p>If this tool makes your Home Assistant life easier, consider supporting the project. Every coffee motivates further development!</p>'
    + '  </div>'
    + '  <div class="donate-buttons">'
    + '    <a class="donate-btn coffee" href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer">☕ Buy Me a Coffee</a>'
    + '    <a class="donate-btn paypal" href="https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W" target="_blank" rel="noopener noreferrer">💳 PayPal</a>'
    + '  </div>'
    + '</div>';
  function deepFindAll(tag, root) {
    var out = [];
    (function walk(node){
      if (!node || !node.querySelectorAll) return;
      var children = node.querySelectorAll('*');
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c.tagName && c.tagName.toLowerCase() === tag) out.push(c);
        if (c.shadowRoot) walk(c.shadowRoot);
      }
    })(root || document);
    return out;
  }
  // Per-tool prerequisite check + inline install banner
  var PREREQS = {
    'ha-energy-email': { service: 'ha_tools_email', repo: 'ha-tools-email-integration', label: 'HA Tools Email integration', kind: 'integration' },
    'ha-log-email':    { service: 'ha_tools_email', repo: 'ha-tools-email-integration', label: 'HA Tools Email integration', kind: 'integration' },
    'ha-encoding-fixer': { shellCommand: 'fix_encoding', label: 'shell_command.fix_encoding (optional advanced feature)', kind: 'shell_command_optional' }
  };
  var PREREQ_HTML_CACHE = {};
  function buildPrereqBanner(tag, prereq, hass) {
    if (PREREQ_HTML_CACHE[tag]) return PREREQ_HTML_CACHE[tag];
    var html = '';
    if (prereq.kind === 'integration') {
      html = '<div class="prereq-banner prereq-error" data-prereq="' + tag + '">' +
        '<div class="prereq-icon">⚠️</div>' +
        '<div class="prereq-text">' +
          '<strong>This tool requires the ' + prereq.label + '</strong><br>' +
          'Install it from HACS: <code>https://github.com/MacSiem/' + prereq.repo + '</code> ' +
          '(Category: <strong>Integration</strong>) — then add <code>' + prereq.service + ':</code> to your <code>configuration.yaml</code> and restart HA.' +
        '</div>' +
        '<a class="prereq-cta" href="https://github.com/MacSiem/' + prereq.repo + '" target="_blank" rel="noopener noreferrer">Open install guide ↗</a>' +
      '</div>';
    } else if (prereq.kind === 'shell_command_optional') {
      html = '<div class="prereq-banner prereq-info" data-prereq="' + tag + '">' +
        '<div class="prereq-icon">💡</div>' +
        '<div class="prereq-text">' +
          '<strong>Optional advanced feature: deep file scan</strong><br>' +
          'To enable scanning of <code>configuration.yaml</code> files, install the bundled <code>encoding_scanner.py</code> + add <code>shell_command:</code> entries. See README.' +
        '</div>' +
      '</div>';
    }
    PREREQ_HTML_CACHE[tag] = html;
    return html;
  }
  function injectAll() {
    SPLIT_TAGS.forEach(function(tag){
      deepFindAll(tag).forEach(function(el){
        // panel_custom auto-init: HA assigns hass/panel/narrow but does not always call setConfig.
        if (typeof el.setConfig === 'function' && !el.config && !el._config) {
          try { el.setConfig({ type: 'custom:' + tag, title: tag }); } catch(e) {}
        }
        if (!el.shadowRoot) return;
        // 1) Prereq banner — checked every poll so it disappears when prereq becomes available
        var prereq = PREREQS[tag];
        if (prereq && el._hass) {
          var hassReady = !!el._hass;
          var present = true;
          if (prereq.service) present = !!(el._hass.services && el._hass.services[prereq.service]);
          if (prereq.shellCommand) present = !!(el._hass.services && el._hass.services.shell_command && el._hass.services.shell_command[prereq.shellCommand]);
          var existing = el.shadowRoot.querySelector('.prereq-banner[data-prereq="' + tag + '"]');
          if (!present && hassReady) {
            if (!existing) {
              var top = el.shadowRoot.querySelector('.card, .card-container, .main-card, [class$="-card"]') || el.shadowRoot.firstElementChild || el.shadowRoot;
              try { top.insertAdjacentHTML('afterbegin', buildPrereqBanner(tag, prereq, el._hass)); } catch(e) {}
            }
          } else if (present && existing) {
            existing.remove();
          }
        }
        // 2) Donate footer
        if (el.shadowRoot.querySelector('.donate-section')) return;
        var target = el.shadowRoot.querySelector('.card, .card-container, .main-card, [class$="-card"]') || el.shadowRoot.firstElementChild || el.shadowRoot;
        try { target.insertAdjacentHTML('beforeend', DONATE_HTML); } catch(e) {}
      });
    });
  }
  // Run immediately, then aggressive MutationObserver for late mounts + view switches.
  injectAll();
  setTimeout(injectAll, 250);
  setTimeout(injectAll, 1000);
  setTimeout(injectAll, 3000);
  // MutationObserver catches every new node anywhere in the DOM, including shadow root attachments
  // that are deferred until the user navigates to a view.
  try {
    var obs = new MutationObserver(function(muts){
      // Debounce: schedule a microtask injection
      if (window.__haToolsDonateScheduled) return;
      window.__haToolsDonateScheduled = true;
      setTimeout(function(){ window.__haToolsDonateScheduled = false; injectAll(); }, 100);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  } catch(e) {}
  // Also re-inject on hash/path change (Lovelace view switches)
  window.addEventListener('hashchange', function(){ setTimeout(injectAll, 200); });
  window.addEventListener('popstate', function(){ setTimeout(injectAll, 200); });
  // Backup interval (every 3s for first 5min — handles cases where MutationObserver missed events)
  var pollCount = 0;
  var pollInterval = setInterval(function(){
    injectAll();
    if (++pollCount >= 100) clearInterval(pollInterval);
  }, 3000);
}
/* ============================================================ */

class HaEncodingFixer extends HTMLElement {
  constructor() {
    super();
    this._lang = (navigator.language || '').startsWith('pl') ? 'pl' : 'en';
    this.attachShadow({ mode: 'open' });
    this._toolId = this.tagName.toLowerCase().replace('ha-', '');
    this._lastRenderTime = 0;
    this._renderScheduled = false;
    this._firstHassRender = false;
    this._lastHtml = '';
    this._hass = null;
    this._config = {};
    this._activeTab = 'scan';
    this._scanResults = [];
    this._scanning = false;
    this._scanProgress = 0;
    this._scanTotal = 0;
    this._fixLog = [];
    this._selectedIssues = new Set();
    this._lovelaceResources = null;
    this._lovelaceIssues = [];
    this._lovelaceScanning = false;
    this._entityIssues = [];
    this._entityScanning = false;
    this._yamlResults = null;
    this._restoreScanning = false;
    this._restoreMissing = [];
    this._restoreBackupInfo = null;
    this._restoreSelectedIds = new Set();
    this._yamlScanning = false;
    this._excludedCount = 0;
    this._restoreSource = 'snapshot';
    this._restoreFilePick = null;
    this._restoreStep = 1;
    this._restorePreview = null;
    // Batch fix state machine
    this._fixState = 'idle'; // idle | running | done
    this._fixProgress = 0;
    this._fixTotal = 0;
    this._fixResults = []; // [{entity_id, status: 'success'|'failed', error?}]
    this._fixCurrentLabel = '';
  }

  static getConfigElement() {
    return document.createElement('ha-encoding-fixer-editor');
  }

  getCardSize() { return 6; }

  static getStubConfig() {
    return {
      type: 'custom:ha-encoding-fixer',
      title: 'Encoding Fixer'
    };
  }

  _sanitize(str) {
    if (!str) return str;
    try { return decodeURIComponent(escape(str)); } catch(e) { return str; }
  }

  get _t() {
    const T = {
      pl: {
        title: 'Encoding & Mojibake Fixer',
        tabScan: 'Skanuj encje',
        tabLovelace: 'Lovelace Resources',
        tabLog: 'Log napraw',
        scanEntities: 'Skanuj encje pod katem mojibake',
        scanning: 'Skanowanie...',
        scanComplete: 'Skanowanie zakonczone',
        noIssuesFound: 'Nie znaleziono problemow z kodowaniem',
        issuesFound: 'Znaleziono problemow',
        entityId: 'Entity ID',
        attribute: 'Atrybut',
        currentValue: 'Obecna wartosc',
        fixedValue: 'Poprawiona wartosc',
        fix: 'Napraw',
        fixSelected: 'Napraw zaznaczone',
        fixAll: 'Napraw wszystkie',
        selectAll: 'Zaznacz wszystkie',
        deselectAll: 'Odznacz wszystkie',
        lovelaceTitle: 'Lovelace Resources',
        lovelaceDesc: 'Sprawdz i napraw uszkodzone wpisy w lovelace_resources',
        scanLovelace: 'Skanuj lovelace_resources',
        lovelaceOk: 'Lovelace resources w porzadku',
        lovelaceIssuesFound: 'Znaleziono problemow w lovelace',
        resourceUrl: 'URL zasobu',
        resourceType: 'Typ',
        issue: 'Problem',
        bomDetected: 'BOM wykryty',
        invalidUtf8: 'Nieprawidlowe UTF-8',
        duplicateEntry: 'Zduplikowany wpis',
        brokenUrl: 'Uszkodzony URL',
        fixLovelace: 'Napraw lovelace_resources',
        backupFirst: 'Kopia zapasowa zostanie utworzona automatycznie',
        logTitle: 'Historia napraw',
        noLog: 'Brak historii napraw',
        timestamp: 'Czas',
        action: 'Akcja',
        result: 'Wynik',
        success: 'Sukces',
        failed: 'Blad',
        fixedEntity: 'Naprawiono encje',
        fixedLovelace: 'Naprawiono lovelace',
        mojibakePatterns: 'Wzorce mojibake',
        commonPatterns: 'Czeste wzorce blednego kodowania',
        patternsExpandHint: 'Wzorce mojibake (kliknij aby rozwin\u0105\u0107)',
        original: 'Bledne',
        correct: 'Poprawne',
        testString: 'Testuj tekst',
        testInput: 'Wklej tekst do sprawdzenia...',
        testResult: 'Wynik dekodowania',
        noMojibake: 'Tekst wyglada poprawnie',
        mojibakeFound: 'Wykryto mojibake - poprawiona wersja ponizej',
        progress: 'Postep',
        errorFixing: 'Blad podczas naprawy',
        warningLovelace: 'Uwaga: edycja lovelace_resources moze wymagac restartu HA',
        bomExplain: 'BOM (Byte Order Mark) to 3 bajty EF BB BF na poczatku pliku. Moze powodowac bledy parsowania JS.',
        tabYaml: 'Skanuj pliki',
        yamlTitle: 'Skan plikow konfiguracyjnych',
        yamlDesc: 'Skanuje YAML, YML i skrypty Python w /config/ pod katem BOM, mojibake, emoji i bledow kodowania',
        scanYaml: 'Skanuj pliki',
        yamlScanning: 'Skanowanie plikow YAML na HA...',
        yamlOk: 'Pliki YAML w porzadku',
        yamlIssuesFound: 'problemow w plikach YAML',
        yamlFile: 'Plik',
        yamlLine: 'Linia',
        yamlIssue: 'Problem',
        yamlDetail: 'Szczegoly',
        yamlContext: 'Kontekst',
        yamlScannedFiles: 'Przeskanowanych plikow',
        yamlNeedsRestart: 'Uwaga: po dodaniu shell_command wymagany restart HA',
        yamlRunError: 'Blad wywolania skanera â€” sprawdz czy HA zostal zrestartowany po dodaniu shell_command',
        fixYamlFile: 'Napraw plik',
        fixYamlAll: 'Napraw wszystkie pliki',
        yamlFixing: 'Naprawianie...',
        yamlFixSuccess: 'Naprawiono',
        scanApi: 'Skanuj automacje/skrypty/sceny',
        apiScanning: 'Skan przez HA API...',
        apiScope: 'Skanuje i naprawia przez HA REST API (automations.yaml, scripts.yaml, scenes.yaml). Dziala od razu po instalacji z HACS, bez konfiguracji shell_command.',
        apiNoIssues: 'Brak mojibake w automacjach/skryptach/scenach',
        apiSkipped: 'Pominieto (brak id)',
        advancedScan: 'Skan zaawansowany (wszystkie pliki)',
        advancedScanDesc: 'Opcjonalnie: pelny skan wszystkich plikow YAML w /config/ (w tym configuration.yaml, packages/) wymaga dodania shell_command.',
        tabRestore: 'Odzyskiwanie',
        restoreTitle: 'Odzyskiwanie utraconych zasobow',
        restoreDesc: 'Porownuje zaladowane zasoby lovelace z kopia zapasowa i wykrywa brakujace po uszkodzeniu pliku .storage',
        scanRestore: 'Skanuj brakujace zasoby',
        restoreScanning: 'Porownywanie...',
        restoreOk: 'Wszystkie zasoby obecne',
        restoreMissing: 'brakujacych zasobow',
        currentCount: 'Aktualnie',
        backupCount: 'W kopii',
        backupDate: 'Data kopii',
        missingUrl: 'Brakujacy zasob',
        restoreSelected: 'Przywroc zaznaczone',
        restoreAll: 'Przywroc wszystkie',
        restoreDone: 'Przywrocono. Zalecany restart HA (Ustawienia > System > Restart).',
        noBackup: 'Brak kopii — najpierw utwórz snapshot aktualnych zasobów',
        createSnapshot: 'Zapisz snapshot',
        snapshotCreated: 'Snapshot zapisany',
        corruptionWarning: 'Wykryto utrate zasobow!',
        yamlFixError: 'Blad naprawy',
      },
      en: {
        title: 'Encoding & Mojibake Fixer',
        tabScan: 'Scan entities',
        tabLovelace: 'Lovelace Resources',
        tabLog: 'Fix log',
        scanEntities: 'Scan entities for mojibake',
        scanning: 'Scanning...',
        scanComplete: 'Scan complete',
        noIssuesFound: 'No encoding issues found',
        issuesFound: 'issues found',
        entityId: 'Entity ID',
        attribute: 'Attribute',
        currentValue: 'Current value',
        fixedValue: 'Fixed value',
        fix: 'Fix',
        fixSelected: 'Fix selected',
        fixAll: 'Fix all',
        selectAll: 'Select all',
        deselectAll: 'Deselect all',
        lovelaceTitle: 'Lovelace Resources',
        lovelaceDesc: 'Check and fix broken entries in lovelace_resources',
        scanLovelace: 'Scan lovelace_resources',
        lovelaceOk: 'Lovelace resources look good',
        lovelaceIssuesFound: 'lovelace issues found',
        resourceUrl: 'Resource URL',
        resourceType: 'Type',
        issue: 'Issue',
        bomDetected: 'BOM detected',
        invalidUtf8: 'Invalid UTF-8',
        duplicateEntry: 'Duplicate entry',
        brokenUrl: 'Broken URL',
        fixLovelace: 'Fix lovelace_resources',
        backupFirst: 'A backup will be created automatically',
        logTitle: 'Fix history',
        noLog: 'No fix history',
        timestamp: 'Time',
        action: 'Action',
        result: 'Result',
        success: 'Success',
        failed: 'Failed',
        fixedEntity: 'Fixed entity',
        fixedLovelace: 'Fixed lovelace',
        mojibakePatterns: 'Mojibake patterns',
        commonPatterns: 'Common encoding error patterns',
        patternsExpandHint: 'Mojibake patterns (click to expand)',
        original: 'Broken',
        correct: 'Correct',
        testString: 'Test text',
        testInput: 'Paste text to check...',
        testResult: 'Decode result',
        noMojibake: 'Text looks correct',
        mojibakeFound: 'Mojibake detected - corrected version below',
        progress: 'Progress',
        errorFixing: 'Error during fix',
        warningLovelace: 'Warning: editing lovelace_resources may require HA restart',
        bomExplain: 'BOM (Byte Order Mark) is 3 bytes EF BB BF at start of file. Can cause JS parse errors.',
        tabYaml: 'Scan files',
        yamlTitle: 'Config file scan',
        yamlDesc: 'Scans YAML, YML and Python scripts in /config/ for BOM, mojibake, emoji and encoding errors',
        scanYaml: 'Scan files',
        yamlScanning: 'Scanning YAML files on HA...',
        yamlOk: 'YAML files look good',
        yamlIssuesFound: 'issues in YAML files',
        yamlFile: 'File',
        yamlLine: 'Line',
        yamlIssue: 'Issue',
        yamlDetail: 'Details',
        yamlContext: 'Context',
        yamlScannedFiles: 'Files scanned',
        yamlNeedsRestart: 'Note: HA restart required after adding shell_command',
        yamlRunError: 'Error running scanner â€” check if HA was restarted after adding shell_command',
        fixYamlFile: 'Fix file',
        fixYamlAll: 'Fix all files',
        yamlFixing: 'Fixing...',
        yamlFixSuccess: 'Fixed',
        scanApi: 'Scan automations/scripts/scenes',
        apiScanning: 'Scanning via HA API...',
        apiScope: 'Scans and fixes via HA REST API (automations.yaml, scripts.yaml, scenes.yaml). Works out-of-the-box after HACS install, no shell_command setup required.',
        apiNoIssues: 'No mojibake in automations/scripts/scenes',
        apiSkipped: 'Skipped (no id)',
        advancedScan: 'Advanced scan (all files)',
        advancedScanDesc: 'Optional: full scan of every YAML file in /config/ (including configuration.yaml, packages/) requires shell_command setup.',
        tabRestore: 'Restore',
        restoreTitle: 'Recover lost resources',
        restoreDesc: 'Compares loaded lovelace resources with backup snapshot â€” detects missing entries after .storage file corruption',
        scanRestore: 'Scan for missing resources',
        restoreScanning: 'Comparing...',
        restoreOk: 'All resources present',
        restoreMissing: 'missing resources',
        currentCount: 'Current',
        backupCount: 'In backup',
        backupDate: 'Backup date',
        missingUrl: 'Missing resource',
        restoreSelected: 'Restore selected',
        restoreAll: 'Restore all',
        restoreDone: 'Restored. HA restart recommended (Settings > System > Restart).',
        noBackup: 'No backup — create a snapshot of current resources first',
        createSnapshot: 'Save snapshot',
        snapshotCreated: 'Snapshot saved',
        corruptionWarning: 'Resource loss detected!',
        yamlFixError: 'Fix error',
      }
    };
    return T[this._lang] || T.en;
  }

  setConfig(config) {
    this._config = config;
    this._loadFixLog();
    this._updateUI();
  }

  set hass(hass) {
    if (hass?.language) this._lang = hass.language.startsWith('pl') ? 'pl' : 'en';
    this._hass = hass;
    if (!hass) return;
    const now = Date.now();
    if (!this._firstHassRender) {
      this._firstHassRender = true;
      this._updateUI();
      this._lastRenderTime = now;
      return;
    }
    if (now - (this._lastRenderTime || 0) < 5000) {
      if (!this._renderScheduled) {
        this._renderScheduled = true;
        setTimeout(() => {
          this._renderScheduled = false;
          this._updateUI();
          this._lastRenderTime = Date.now();
        }, 5000 - (now - (this._lastRenderTime || 0)));
      }
      return;
    }
    this._lastRenderTime = now;
    this._updateUI();
  }

  // --- Mojibake detection ---

  // Known Polish mojibake patterns (UTF-8 decoded as Latin-1/CP1252)
    static get MOJIBAKE_MAP() {
    return {
  /* ====== AUTO-GENERATED MOJIBAKE MAP ======
   * Generator: mojibake_fix.py (Private HA workspace)
   * Entries: 650 (longest-key-first order)
   * Covers: Polish cp1250+cp1252, smart punctuation,
   * 3-byte emoji cp1252, 4-byte emoji SMP cp1252,
   * variation selector U+FE0F, and common Latin-1.
   * DO NOT edit this block by hand — regenerate via gen_js_map.py
   * ====================================== */
      '\u0111\u017A\u0179\u00A0': '\uD83C\uDFE0',
      '\u0111\u017A\u0179\u02C7': '\uD83C\uDFE1',
      '\u0111\u017A\u2019\u00A7': '\uD83D\uDCA7',
      '\u00F0\u0178\u2019\u00A7': '\uD83D\uDCA7',
      '\u0111\u017A\u2019\u02C7': '\uD83D\uDCA1',
      '\u00F0\u0178\u2019\u00A1': '\uD83D\uDCA1',
      '\u0111\u017A\u2019\u00A6': '\uD83D\uDCA6',
      '\u00F0\u0178\u2019\u00A6': '\uD83D\uDCA6',
      '\u0111\u017A\u201D\u201D': '\uD83D\uDD14',
      '\u00F0\u0178\u201D\u201D': '\uD83D\uDD14',
      '\u0111\u017A\u201D\u2022': '\uD83D\uDD15',
      '\u00F0\u0178\u201D\u2022': '\uD83D\uDD15',
      '\u0111\u017A\u0161\u00A8': '\uD83D\uDEA8',
      '\u00F0\u0178\u0161\u00A8': '\uD83D\uDEA8',
      '\u0111\u017A\u015A\u02C7': '\uD83C\uDF21',
      '\u00F0\u0178\u0152\u00A1': '\uD83C\uDF21',
      '\u0111\u017A\u201D\u0104': '\uD83D\uDD25',
      '\u00F0\u0178\u201D\u00A5': '\uD83D\uDD25',
      '\u0111\u017A\u00A7\u015F': '\uD83E\uDDFA',
      '\u00F0\u0178\u00A7\u00BA': '\uD83E\uDDFA',
      '\u0111\u017A\u00A7\u00BB': '\uD83E\uDDFB',
      '\u00F0\u0178\u00A7\u00BB': '\uD83E\uDDFB',
      '\u0111\u017A\u2018\u2022': '\uD83D\uDC55',
      '\u00F0\u0178\u2018\u2022': '\uD83D\uDC55',
      '\u0111\u017A\u00A7\u00A6': '\uD83E\uDDE6',
      '\u00F0\u0178\u00A7\u00A6': '\uD83E\uDDE6',
      '\u0111\u017A\u015E\u2018': '\uD83E\uDE91',
      '\u00F0\u0178\u00AA\u2018': '\uD83E\uDE91',
      '\u0111\u017A\u0161\u00B0': '\uD83D\uDEB0',
      '\u00F0\u0178\u0161\u00B0': '\uD83D\uDEB0',
      '\u00F0\u0178\u02DC\u20AC': '\uD83D\uDE00',
      '\u0111\u017A\u00A7\u0105': '\uD83E\uDDF9',
      '\u00F0\u0178\u00A7\u00B9': '\uD83E\uDDF9',
      '\u0111\u017A\u201C\u02D8': '\uD83D\uDCE2',
      '\u00F0\u0178\u201C\u00A2': '\uD83D\uDCE2',
      '\u0111\u017A\u201C\u0141': '\uD83D\uDCE3',
      '\u00F0\u0178\u201C\u00A3': '\uD83D\uDCE3',
      '\u0111\u017A\u201C\u00B1': '\uD83D\uDCF1',
      '\u00F0\u0178\u201C\u00B1': '\uD83D\uDCF1',
      '\u0111\u017A\u00A7\u00A0': '\uD83E\uDDE0',
      '\u00F0\u0178\u00A7\u00A0': '\uD83E\uDDE0',
      '\u0111\u017A\u00A7\u0160': '\uD83E\uDDCA',
      '\u00F0\u0178\u00A7\u0160': '\uD83E\uDDCA',
      '\u00F0\u0178\u00A7\u0192': '\uD83E\uDDC3',
      '\u0111\u017A\u00A7\u201A': '\uD83E\uDDC2',
      '\u00F0\u0178\u00A7\u201A': '\uD83E\uDDC2',
      '\u0111\u017A\u00A7\u013D': '\uD83E\uDDFC',
      '\u00F0\u0178\u00A7\u00BC': '\uD83E\uDDFC',
      '\u0111\u017A\u201D\u2019': '\uD83D\uDD12',
      '\u00F0\u0178\u201D\u2019': '\uD83D\uDD12',
      '\u0111\u017A\u201D\u201C': '\uD83D\uDD13',
      '\u00F0\u0178\u201D\u201C': '\uD83D\uDD13',
      '\u0111\u017A\u201D\u2018': '\uD83D\uDD11',
      '\u00F0\u0178\u201D\u2018': '\uD83D\uDD11',
      '\u0111\u017A\u0161\u015E': '\uD83D\uDEAA',
      '\u00F0\u0178\u0161\u00AA': '\uD83D\uDEAA',
      '\u0111\u017A\u0161\u017C': '\uD83D\uDEBF',
      '\u00F0\u0178\u0161\u00BF': '\uD83D\uDEBF',
      '\u0111\u017A\u203A\u0179': '\uD83D\uDECF',
      '\u0111\u017A\u203A\u2039': '\uD83D\uDECB',
      '\u00F0\u0178\u203A\u2039': '\uD83D\uDECB',
      '\u0111\u017A\u0161\u02DD': '\uD83D\uDEBD',
      '\u00F0\u0178\u0161\u00BD': '\uD83D\uDEBD',
      '\u0111\u017A\u00A7\u00B4': '\uD83E\uDDF4',
      '\u00F0\u0178\u00A7\u00B4': '\uD83E\uDDF4',
      '\u0111\u017A\u203A\u2019': '\uD83D\uDED2',
      '\u00F0\u0178\u203A\u2019': '\uD83D\uDED2',
      '\u0111\u017A\u203A\u0164': '\uD83D\uDECD',
      '\u0111\u017A\u017D\u017B': '\uD83C\uDFAF',
      '\u00F0\u0178\u017D\u00AF': '\uD83C\uDFAF',
      '\u0111\u017A\u201C\u0160': '\uD83D\uDCCA',
      '\u00F0\u0178\u201C\u0160': '\uD83D\uDCCA',
      '\u00F0\u0178\u201C\u02C6': '\uD83D\uDCC8',
      '\u0111\u017A\u201C\u2030': '\uD83D\uDCC9',
      '\u00F0\u0178\u201C\u2030': '\uD83D\uDCC9',
      '\u0111\u017A\u2022\u2018': '\uD83D\uDD51',
      '\u00F0\u0178\u2022\u2018': '\uD83D\uDD51',
      '\u0111\u017A\u2022\u2019': '\uD83D\uDD52',
      '\u00F0\u0178\u2022\u2019': '\uD83D\uDD52',
      '\u0111\u017A\u2022\u201C': '\uD83D\uDD53',
      '\u00F0\u0178\u2022\u201C': '\uD83D\uDD53',
      '\u0111\u017A\u2022\u201D': '\uD83D\uDD54',
      '\u00F0\u0178\u2022\u201D': '\uD83D\uDD54',
      '\u0111\u017A\u2022\u2022': '\uD83D\uDD55',
      '\u00F0\u0178\u2022\u2022': '\uD83D\uDD55',
      '\u0111\u017A\u2022\u2013': '\uD83D\uDD56',
      '\u00F0\u0178\u2022\u2013': '\uD83D\uDD56',
      '\u0111\u017A\u2022\u2014': '\uD83D\uDD57',
      '\u00F0\u0178\u2022\u2014': '\uD83D\uDD57',
      '\u00F0\u0178\u2022\u02DC': '\uD83D\uDD58',
      '\u0111\u017A\u2022\u2122': '\uD83D\uDD59',
      '\u00F0\u0178\u2022\u2122': '\uD83D\uDD59',
      '\u0111\u017A\u2022\u0161': '\uD83D\uDD5A',
      '\u00F0\u0178\u2022\u0161': '\uD83D\uDD5A',
      '\u0111\u017A\u2022\u203A': '\uD83D\uDD5B',
      '\u00F0\u0178\u2022\u203A': '\uD83D\uDD5B',
      '\u0111\u017A\u015A\u2122': '\uD83C\uDF19',
      '\u00F0\u0178\u0152\u2122': '\uD83C\uDF19',
      '\u0111\u017A\u015A\u00A4': '\uD83C\uDF24',
      '\u00F0\u0178\u0152\u00A4': '\uD83C\uDF24',
      '\u0111\u017A\u015A\u0104': '\uD83C\uDF25',
      '\u00F0\u0178\u0152\u00A5': '\uD83C\uDF25',
      '\u0111\u017A\u015A\u00A6': '\uD83C\uDF26',
      '\u00F0\u0178\u0152\u00A6': '\uD83C\uDF26',
      '\u0111\u017A\u015A\u00A7': '\uD83C\uDF27',
      '\u00F0\u0178\u0152\u00A7': '\uD83C\uDF27',
      '\u0111\u017A\u015A\u00A8': '\uD83C\uDF28',
      '\u00F0\u0178\u0152\u00A8': '\uD83C\uDF28',
      '\u0111\u017A\u015A\u00A9': '\uD83C\uDF29',
      '\u00F0\u0178\u0152\u00A9': '\uD83C\uDF29',
      '\u0111\u017A\u015A\u015E': '\uD83C\uDF2A',
      '\u00F0\u0178\u0152\u00AA': '\uD83C\uDF2A',
      '\u0111\u017A\u015A\u00AB': '\uD83C\uDF2B',
      '\u00F0\u0178\u0152\u00AB': '\uD83C\uDF2B',
      '\u0111\u017A\u2018\u00B6': '\uD83D\uDC76',
      '\u00F0\u0178\u2018\u00B6': '\uD83D\uDC76',
      '\u0111\u017A\u2018\u00A6': '\uD83D\uDC66',
      '\u00F0\u0178\u2018\u00A6': '\uD83D\uDC66',
      '\u0111\u017A\u2018\u00A7': '\uD83D\uDC67',
      '\u00F0\u0178\u2018\u00A7': '\uD83D\uDC67',
      '\u0111\u017A\u2018\u00A8': '\uD83D\uDC68',
      '\u00F0\u0178\u2018\u00A8': '\uD83D\uDC68',
      '\u0111\u017A\u2018\u00A9': '\uD83D\uDC69',
      '\u00F0\u0178\u2018\u00A9': '\uD83D\uDC69',
      '\u0111\u017A\u00A7\u201C': '\uD83E\uDDD3',
      '\u00F0\u0178\u00A7\u201C': '\uD83E\uDDD3',
      '\u0111\u017A\u2018\u00B4': '\uD83D\uDC74',
      '\u00F0\u0178\u2018\u00B4': '\uD83D\uDC74',
      '\u0111\u017A\u2018\u00B5': '\uD83D\uDC75',
      '\u00F0\u0178\u2018\u00B5': '\uD83D\uDC75',
      '\u0111\u017A\u2018\u00AE': '\uD83D\uDC6E',
      '\u00F0\u0178\u2018\u00AE': '\uD83D\uDC6E',
      '\u0111\u017A\u0161\u2019': '\uD83D\uDE92',
      '\u00F0\u0178\u0161\u2019': '\uD83D\uDE92',
      '\u0111\u017A\u0161\u201C': '\uD83D\uDE93',
      '\u00F0\u0178\u0161\u201C': '\uD83D\uDE93',
      '\u0111\u017A\u0164\u017D': '\uD83C\uDF4E',
      '\u0111\u017A\u0164\u0179': '\uD83C\uDF4F',
      '\u0111\u017A\u0164\u0160': '\uD83C\uDF4A',
      '\u0111\u017A\u0164\u2039': '\uD83C\uDF4B',
      '\u0111\u017A\u0164\u015A': '\uD83C\uDF4C',
      '\u0111\u017A\u0164\u2030': '\uD83C\uDF49',
      '\u0111\u017A\u0164\u2021': '\uD83C\uDF47',
      '\u0111\u017A\u0164\u201C': '\uD83C\uDF53',
      '\u0111\u017A\u0164\u2019': '\uD83C\uDF52',
      '\u0111\u017A\u0164\u2018': '\uD83C\uDF51',
      '\u0111\u017A\u0104\u00AD': '\uD83E\uDD6D',
      '\u00F0\u0178\u00A5\u00AD': '\uD83E\uDD6D',
      '\u0111\u017A\u0164\u0164': '\uD83C\uDF4D',
      '\u0111\u017A\u00A6\u0160': '\uD83E\uDD8A',
      '\u00F0\u0178\u00A6\u0160': '\uD83E\uDD8A',
      '\u0111\u017A\u0161\u20AC': '\uD83D\uDE80',
      '\u00F0\u0178\u0161\u20AC': '\uD83D\uDE80',
      '\u0111\u017A\u0161\u201A': '\uD83D\uDE82',
      '\u00F0\u0178\u0161\u201A': '\uD83D\uDE82',
      '\u00F0\u0178\u0161\u0192': '\uD83D\uDE83',
      '\u0111\u017A\u0161\u201E': '\uD83D\uDE84',
      '\u00F0\u0178\u0161\u201E': '\uD83D\uDE84',
      '\u0111\u017A\u0161\u2026': '\uD83D\uDE85',
      '\u00F0\u0178\u0161\u2026': '\uD83D\uDE85',
      '\u0111\u017A\u0161\u2020': '\uD83D\uDE86',
      '\u00F0\u0178\u0161\u2020': '\uD83D\uDE86',
      '\u0111\u017A\u0161\u2021': '\uD83D\uDE87',
      '\u00F0\u0178\u0161\u2021': '\uD83D\uDE87',
      '\u00F0\u0178\u0161\u02C6': '\uD83D\uDE88',
      '\u0111\u017A\u0161\u2030': '\uD83D\uDE89',
      '\u00F0\u0178\u0161\u2030': '\uD83D\uDE89',
      '\u0111\u017A\u0161\u0160': '\uD83D\uDE8A',
      '\u00F0\u0178\u0161\u0160': '\uD83D\uDE8A',
      '\u0111\u017A\u2018\u0164': '\uD83D\uDC4D',
      '\u0111\u017A\u2018\u017D': '\uD83D\uDC4E',
      '\u00F0\u0178\u2018\u017D': '\uD83D\uDC4E',
      '\u0111\u017A\u2018\u015A': '\uD83D\uDC4C',
      '\u00F0\u0178\u2018\u0152': '\uD83D\uDC4C',
      '\u0111\u017A\u2018\u2039': '\uD83D\uDC4B',
      '\u00F0\u0178\u2018\u2039': '\uD83D\uDC4B',
      '\u0111\u017A\u2018\u0179': '\uD83D\uDC4F',
      '\u0111\u017A\u00A4\u0165': '\uD83E\uDD1D',
      '\u0111\u017A\u2122\u0179': '\uD83D\uDE4F',
      '\u0111\u017A\u2018\u0160': '\uD83D\uDC4A',
      '\u00F0\u0178\u2018\u0160': '\uD83D\uDC4A',
      '\u00F0\u0178\u00A4\u02DC': '\uD83E\uDD18',
      '\u0111\u017A\u2019\u017B': '\uD83D\uDCAF',
      '\u00F0\u0178\u2019\u00AF': '\uD83D\uDCAF',
      '\u0111\u017A\u2019\u02D8': '\uD83D\uDCA2',
      '\u00F0\u0178\u2019\u00A2': '\uD83D\uDCA2',
      '\u0111\u017A\u2019\u0104': '\uD83D\uDCA5',
      '\u00F0\u0178\u2019\u00A5': '\uD83D\uDCA5',
      '\u0111\u017A\u2019\u00AB': '\uD83D\uDCAB',
      '\u00F0\u0178\u2019\u00AB': '\uD83D\uDCAB',
      '\u0111\u017A\u2019\u00A8': '\uD83D\uDCA8',
      '\u00F0\u0178\u2019\u00A8': '\uD83D\uDCA8',
      '\u0111\u017A\u2019\u00AC': '\uD83D\uDCAC',
      '\u00F0\u0178\u2019\u00AC': '\uD83D\uDCAC',
      '\u0111\u017A\u2019\u00AD': '\uD83D\uDCAD',
      '\u00F0\u0178\u2019\u00AD': '\uD83D\uDCAD',
      '\u0111\u017A\u017D\u2030': '\uD83C\uDF89',
      '\u00F0\u0178\u017D\u2030': '\uD83C\uDF89',
      '\u0111\u017A\u017D\u0160': '\uD83C\uDF8A',
      '\u00F0\u0178\u017D\u0160': '\uD83C\uDF8A',
      '\u00F0\u0178\u017D\u02C6': '\uD83C\uDF88',
      '\u0111\u017A\u017D\u201A': '\uD83C\uDF82',
      '\u00F0\u0178\u017D\u201A': '\uD83C\uDF82',
      '\u00F0\u0178\u017D\u0192': '\uD83C\uDF83',
      '\u0111\u017A\u017D\u201E': '\uD83C\uDF84',
      '\u00F0\u0178\u017D\u201E': '\uD83C\uDF84',
      '\u0111\u017A\u017D\u2026': '\uD83C\uDF85',
      '\u00F0\u0178\u017D\u2026': '\uD83C\uDF85',
      '\u0111\u017A\u00A7\u00A8': '\uD83E\uDDE8',
      '\u00F0\u0178\u00A7\u00A8': '\uD83E\uDDE8',
      '\u0111\u017A\u201C\u2026': '\uD83D\uDCC5',
      '\u00F0\u0178\u201C\u2026': '\uD83D\uDCC5',
      '\u0111\u017A\u201C\u2020': '\uD83D\uDCC6',
      '\u00F0\u0178\u201C\u2020': '\uD83D\uDCC6',
      '\u0111\u017A\u201C\u2021': '\uD83D\uDCC7',
      '\u00F0\u0178\u201C\u2021': '\uD83D\uDCC7',
      '\u0111\u017A\u201C\u2039': '\uD83D\uDCCB',
      '\u00F0\u0178\u201C\u2039': '\uD83D\uDCCB',
      '\u0111\u017A\u201C\u015A': '\uD83D\uDCCC',
      '\u00F0\u0178\u201C\u0152': '\uD83D\uDCCC',
      '\u0111\u017A\u201C\u0164': '\uD83D\uDCCD',
      '\u0111\u017A\u201C\u017D': '\uD83D\uDCCE',
      '\u00F0\u0178\u201C\u017D': '\uD83D\uDCCE',
      '\u0111\u017A\u201C\u0179': '\uD83D\uDCCF',
      '\u0111\u017A\u015E\u00AB': '\uD83E\uDEAB',
      '\u00F0\u0178\u00AA\u00AB': '\uD83E\uDEAB',
      '\u0111\u017A\u015E\u015E': '\uD83E\uDEAA',
      '\u00F0\u0178\u00AA\u00AA': '\uD83E\uDEAA',
      '\u0111\u017A\u015E\u015F': '\uD83E\uDEBA',
      '\u00F0\u0178\u00AA\u00BA': '\uD83E\uDEBA',
      '\u0111\u017A\u015E\u00B4': '\uD83E\uDEB4',
      '\u00F0\u0178\u00AA\u00B4': '\uD83E\uDEB4',
      '\u0111\u017A\u015E\u00B5': '\uD83E\uDEB5',
      '\u00F0\u0178\u00AA\u00B5': '\uD83E\uDEB5',
      '\u0111\u017A\u015E\u00B6': '\uD83E\uDEB6',
      '\u00F0\u0178\u00AA\u00B6': '\uD83E\uDEB6',
      '\u0111\u017A\u015E\u00B7': '\uD83E\uDEB7',
      '\u00F0\u0178\u00AA\u00B7': '\uD83E\uDEB7',
      '\u0111\u017A\u015E\u00B8': '\uD83E\uDEB8',
      '\u00F0\u0178\u00AA\u00B8': '\uD83E\uDEB8',
      '\u0111\u017A\u015E\u0105': '\uD83E\uDEB9',
      '\u00F0\u0178\u00AA\u00B9': '\uD83E\uDEB9',
      '\u0111\u017A\u015E\u00BB': '\uD83E\uDEBB',
      '\u00F0\u0178\u00AA\u00BB': '\uD83E\uDEBB',
      '\u0111\u017A\u015E\u013D': '\uD83E\uDEBC',
      '\u00F0\u0178\u00AA\u00BC': '\uD83E\uDEBC',
      '\u0111\u017A\u015E\u02DD': '\uD83E\uDEBD',
      '\u00F0\u0178\u00AA\u00BD': '\uD83E\uDEBD',
      '\u0111\u017A\u015E\u013E': '\uD83E\uDEBE',
      '\u00F0\u0178\u00AA\u00BE': '\uD83E\uDEBE',
      '\u0111\u017A\u015E\u017C': '\uD83E\uDEBF',
      '\u00F0\u0178\u00AA\u00BF': '\uD83E\uDEBF',
      '\u00E2\u2020\u2018': '\u2191',
      '\u00E2\u2020\u2019': '\u2192',
      '\u00E2\u2020\u201C': '\u2193',
      '\u00E2\u2020\u201D': '\u2194',
      '\u00E2\u2020\u2022': '\u2195',
      '\u00E2\u2020\u2013': '\u2196',
      '\u00E2\u2020\u2014': '\u2197',
      '\u00E2\u2020\u02DC': '\u2198',
      '\u00E2\u2020\u2122': '\u2199',
      '\u00E2\u2020\u0161': '\u219A',
      '\u00E2\u2020\u203A': '\u219B',
      '\u00E2\u2020\u015B': '\u219C',
      '\u00E2\u2020\u0153': '\u219C',
      '\u00E2\u2020\u0165': '\u219D',
      '\u00E2\u2020\u017E': '\u219E',
      '\u00E2\u2020\u017A': '\u219F',
      '\u00E2\u2020\u0178': '\u219F',
      '\u00E2\u2020\u00A0': '\u21A0',
      '\u00E2\u2020\u02C7': '\u21A1',
      '\u00E2\u2020\u00A1': '\u21A1',
      '\u00E2\u2020\u02D8': '\u21A2',
      '\u00E2\u2020\u00A2': '\u21A2',
      '\u00E2\u2020\u0141': '\u21A3',
      '\u00E2\u2020\u00A3': '\u21A3',
      '\u00E2\u2020\u00A4': '\u21A4',
      '\u00E2\u2020\u0104': '\u21A5',
      '\u00E2\u2020\u00A5': '\u21A5',
      '\u00E2\u2020\u00A6': '\u21A6',
      '\u00E2\u2020\u00A7': '\u21A7',
      '\u00E2\u2020\u00A8': '\u21A8',
      '\u00E2\u2020\u00A9': '\u21A9',
      '\u00E2\u2020\u015E': '\u21AA',
      '\u00E2\u2020\u00AA': '\u21AA',
      '\u00E2\u2020\u00AB': '\u21AB',
      '\u00E2\u2020\u00AC': '\u21AC',
      '\u00E2\u2020\u00AD': '\u21AD',
      '\u00E2\u2020\u00AE': '\u21AE',
      '\u00E2\u2020\u017B': '\u21AF',
      '\u00E2\u2020\u00AF': '\u21AF',
      '\u00E2\u2020\u00B0': '\u21B0',
      '\u00E2\u2020\u00B1': '\u21B1',
      '\u00E2\u2020\u02DB': '\u21B2',
      '\u00E2\u2020\u00B2': '\u21B2',
      '\u00E2\u2020\u0142': '\u21B3',
      '\u00E2\u2020\u00B3': '\u21B3',
      '\u00E2\u2020\u00B4': '\u21B4',
      '\u00E2\u2020\u00B5': '\u21B5',
      '\u00E2\u2020\u00B6': '\u21B6',
      '\u00E2\u2020\u00B7': '\u21B7',
      '\u00E2\u2020\u00B8': '\u21B8',
      '\u00E2\u2020\u0105': '\u21B9',
      '\u00E2\u2020\u00B9': '\u21B9',
      '\u00E2\u2020\u015F': '\u21BA',
      '\u00E2\u2020\u00BA': '\u21BA',
      '\u00E2\u2020\u00BB': '\u21BB',
      '\u00E2\u0161\u00A0': '\u26A0',
      '\u00E2\u0161\u02C7': '\u26A1',
      '\u00E2\u0161\u00A1': '\u26A1',
      '\u00E2\u015B\u2026': '\u2705',
      '\u00E2\u0153\u2026': '\u2705',
      '\u00E2\u0165\u015A': '\u274C',
      '\u00E2\u015B\u201D': '\u2714',
      '\u00E2\u0153\u201D': '\u2714',
      '\u00E2\u015B\u2013': '\u2716',
      '\u00E2\u0153\u2013': '\u2716',
      '\u00E2\u02DC\u2026': '\u2605',
      '\u00E2\u02DC\u2020': '\u2606',
      '\u00E2\u0161\u00AB': '\u26AB',
      '\u00E2\u0161\u015E': '\u26AA',
      '\u00E2\u0161\u00AA': '\u26AA',
      '\u00E2\u017E\u02C7': '\u27A1',
      '\u00E2\u017E\u00A1': '\u27A1',
      '\u00E2\u00AC\u2026': '\u2B05',
      '\u00E2\u00AC\u2020': '\u2B06',
      '\u00E2\u00AC\u2021': '\u2B07',
      '\u00E2\u017E\u00A4': '\u27A4',
      '\u00E2\u017E\u02D8': '\u27A2',
      '\u00E2\u017E\u00A2': '\u27A2',
      '\u00E2\u017E\u0141': '\u27A3',
      '\u00E2\u017E\u00A3': '\u27A3',
      '\u00E2\u017E\u201D': '\u2794',
      '\u00E2\u017E\u0165': '\u279D',
      '\u00E2\u017E\u017E': '\u279E',
      '\u00E2\u017E\u017A': '\u279F',
      '\u00E2\u017E\u0178': '\u279F',
      '\u00E2\u017E\u00A0': '\u27A0',
      '\u00E2\u017E\u0104': '\u27A5',
      '\u00E2\u017E\u00A5': '\u27A5',
      '\u00E2\u017E\u00A6': '\u27A6',
      '\u00E2\u017E\u00A7': '\u27A7',
      '\u00E2\u017E\u00A8': '\u27A8',
      '\u00E2\u017E\u00A9': '\u27A9',
      '\u00E2\u017E\u015E': '\u27AA',
      '\u00E2\u017E\u00AA': '\u27AA',
      '\u00E2\u017E\u00AB': '\u27AB',
      '\u00E2\u017E\u00AC': '\u27AC',
      '\u00E2\u017E\u00AD': '\u27AD',
      '\u00E2\u017E\u00AE': '\u27AE',
      '\u00E2\u017E\u017B': '\u27AF',
      '\u00E2\u017E\u00AF': '\u27AF',
      '\u00E2\u017E\u00B0': '\u27B0',
      '\u00E2\u02DC\u20AC': '\u2600',
      '\u00E2\u02DC\u201A': '\u2602',
      '\u00E2\u02DC\u0192': '\u2603',
      '\u00E2\u02DC\u201E': '\u2604',
      '\u00E2\u02DC\u2022': '\u2615',
      '\u00E2\u02DC\u017D': '\u260E',
      '\u00E2\u02DC\u02DC': '\u2618',
      '\u00E2\u0179\u00B0': '\u23F0',
      '\u00E2\u0179\u00B1': '\u23F1',
      '\u00E2\u0179\u02DB': '\u23F2',
      '\u00E2\u015B\u2030': '\u2709',
      '\u00E2\u0153\u2030': '\u2709',
      '\u00E2\u015B\u201A': '\u2702',
      '\u00E2\u0153\u201A': '\u2702',
      '\u00E2\u02DC\u2018': '\u2611',
      '\u00E2\u2122\u20AC': '\u2640',
      '\u00E2\u2122\u201A': '\u2642',
      '\u00E2\u2122\u00A0': '\u2660',
      '\u00E2\u2122\u0141': '\u2663',
      '\u00E2\u2122\u00A3': '\u2663',
      '\u00E2\u2122\u0104': '\u2665',
      '\u00E2\u2122\u00A5': '\u2665',
      '\u00E2\u2122\u00A6': '\u2666',
      '\u00E2\u2122\u015E': '\u266A',
      '\u00E2\u2122\u00AA': '\u266A',
      '\u00E2\u2122\u00AB': '\u266B',
      '\u00E2\u2122\u00AC': '\u266C',
      '\u00E2\u0165\u00A4': '\u2764',
      '\u00E2\u0165\u0141': '\u2763',
      '\u00E2\u0165\u2014': '\u2757',
      '\u00E2\u0165\u201C': '\u2753',
      '\u00E2\u0165\u2022': '\u2755',
      '\u00E2\u0165\u201D': '\u2754',
      '\u00E2\u0165\u017D': '\u274E',
      '\u00E2\u015B\u0142': '\u2733',
      '\u00E2\u0153\u00B3': '\u2733',
      '\u00E2\u015B\u00B4': '\u2734',
      '\u00E2\u0153\u00B4': '\u2734',
      '\u00E2\u015B\u00A8': '\u2728',
      '\u00E2\u0153\u00A8': '\u2728',
      '\u00E2\u0165\u201E': '\u2744',
      '\u00E2\u0165\u2020': '\u2746',
      '\u00E2\u0165\u2021': '\u2747',
      '\u00E2\u0165\u0160': '\u274A',
      '\u00E2\u0165\u2039': '\u274B',
      '\u00E2\u0179\u00A9': '\u23E9',
      '\u00E2\u0179\u015E': '\u23EA',
      '\u00E2\u0179\u00AB': '\u23EB',
      '\u00E2\u0179\u00AC': '\u23EC',
      '\u00E2\u0179\u00AD': '\u23ED',
      '\u00E2\u0179\u00AE': '\u23EE',
      '\u00E2\u0179\u017B': '\u23EF',
      '\u00E2\u0179\u0142': '\u23F3',
      '\u00E2\u02DC\u00B9': '\u2639',
      '\u00E2\u02DC\u00BA': '\u263A',
      '\u00E2\u02DC\u00BB': '\u263B',
      '\u00E2\u02DC\u00BC': '\u263C',
      '\u00E2\u02DC\u00BE': '\u263E',
      '\u00E2\u015A\u201A': '\u2302',
      '\u00E2\u0152\u201A': '\u2302',
      '\u00E2\u015A\u0161': '\u231A',
      '\u00E2\u0152\u0161': '\u231A',
      '\u00E2\u015A\u203A': '\u231B',
      '\u00E2\u0152\u203A': '\u231B',
      '\u00E2\u015A\u00A8': '\u2328',
      '\u00E2\u0152\u00A8': '\u2328',
      '\u00E2\u0179\u0179': '\u23CF',
      '\u00E2\u0179\u00A8': '\u23E8',
      '\u00E2\u2122\u017A': '\u265F',
      '\u00E2\u2122\u0178': '\u265F',
      '\u00E2\u2122\u203A': '\u265B',
      '\u00E2\u2122\u017E': '\u265E',
      '\u00E2\u2122\u0165': '\u265D',
      '\u00E2\u2122\u015B': '\u265C',
      '\u00E2\u2122\u0153': '\u265C',
      '\u00E2\u2122\u0161': '\u265A',
      '\u00E2\u2122\u2122': '\u2659',
      '\u00E2\u2122\u02DC': '\u2658',
      '\u00E2\u2122\u2014': '\u2657',
      '\u00E2\u2122\u2013': '\u2656',
      '\u00E2\u2122\u2022': '\u2655',
      '\u00E2\u2122\u201D': '\u2654',
      '\u00E2\u0161\u201C': '\u2693',
      '\u00E2\u0161\u201D': '\u2694',
      '\u00E2\u0161\u2013': '\u2696',
      '\u00E2\u0161\u2014': '\u2697',
      '\u00E2\u0161\u2122': '\u2699',
      '\u00E2\u0161\u203A': '\u269B',
      '\u00E2\u0161\u015B': '\u269C',
      '\u00E2\u0161\u0153': '\u269C',
      '\u00E2\u0161\u0165': '\u269D',
      '\u00E2\u0161\u017E': '\u269E',
      '\u00E2\u0161\u017A': '\u269F',
      '\u00E2\u0161\u0178': '\u269F',
      '\u00E2\u0161\u02D8': '\u26A2',
      '\u00E2\u0161\u00A2': '\u26A2',
      '\u00E2\u0161\u0141': '\u26A3',
      '\u00E2\u0161\u00A3': '\u26A3',
      '\u00E2\u0161\u00A4': '\u26A4',
      '\u00E2\u0161\u0104': '\u26A5',
      '\u00E2\u0161\u00A5': '\u26A5',
      '\u00E2\u0161\u00A6': '\u26A6',
      '\u00E2\u0161\u00A7': '\u26A7',
      '\u00E2\u0161\u00A8': '\u26A8',
      '\u00E2\u0161\u00A9': '\u26A9',
      '\u00E2\u0161\u00AC': '\u26AC',
      '\u00E2\u0161\u00AD': '\u26AD',
      '\u00E2\u0161\u00AE': '\u26AE',
      '\u00E2\u0161\u017B': '\u26AF',
      '\u00E2\u0161\u00AF': '\u26AF',
      '\u00E2\u0161\u00B0': '\u26B0',
      '\u00E2\u0161\u00B1': '\u26B1',
      '\u00E2\u0161\u02DB': '\u26B2',
      '\u00E2\u0161\u00B2': '\u26B2',
      '\u00E2\u0161\u0142': '\u26B3',
      '\u00E2\u0161\u00B3': '\u26B3',
      '\u00E2\u0161\u00B4': '\u26B4',
      '\u00E2\u0161\u00B5': '\u26B5',
      '\u00E2\u0161\u00B6': '\u26B6',
      '\u00E2\u0161\u00B7': '\u26B7',
      '\u00E2\u0161\u00B8': '\u26B8',
      '\u00E2\u0161\u0105': '\u26B9',
      '\u00E2\u0161\u00B9': '\u26B9',
      '\u00E2\u0161\u015F': '\u26BA',
      '\u00E2\u0161\u00BA': '\u26BA',
      '\u00E2\u0161\u00BB': '\u26BB',
      '\u00E2\u0161\u013D': '\u26BC',
      '\u00E2\u0161\u00BC': '\u26BC',
      '\u00E2\u0161\u02DD': '\u26BD',
      '\u00E2\u0161\u00BD': '\u26BD',
      '\u00E2\u0161\u013E': '\u26BE',
      '\u00E2\u0161\u00BE': '\u26BE',
      '\u00E2\u0161\u017C': '\u26BF',
      '\u00E2\u0161\u00BF': '\u26BF',
      '\u00E2\u203A\u20AC': '\u26C0',
      '\u00E2\u203A\u201A': '\u26C2',
      '\u00E2\u203A\u0192': '\u26C3',
      '\u00E2\u203A\u201E': '\u26C4',
      '\u00E2\u203A\u2026': '\u26C5',
      '\u00E2\u203A\u2020': '\u26C6',
      '\u00E2\u203A\u2021': '\u26C7',
      '\u00E2\u203A\u02C6': '\u26C8',
      '\u00E2\u203A\u2030': '\u26C9',
      '\u00E2\u203A\u0160': '\u26CA',
      '\u00E2\u203A\u2039': '\u26CB',
      '\u00E2\u203A\u015A': '\u26CC',
      '\u00E2\u203A\u0152': '\u26CC',
      '\u00E2\u203A\u0164': '\u26CD',
      '\u00E2\u203A\u017D': '\u26CE',
      '\u00E2\u203A\u0179': '\u26CF',
      '\u00E2\u203A\u2018': '\u26D1',
      '\u00E2\u203A\u2019': '\u26D2',
      '\u00E2\u203A\u201C': '\u26D3',
      '\u00E2\u203A\u201D': '\u26D4',
      '\u00E2\u203A\u2022': '\u26D5',
      '\u00E2\u203A\u2013': '\u26D6',
      '\u00E2\u203A\u2014': '\u26D7',
      '\u00E2\u203A\u02DC': '\u26D8',
      '\u00E2\u203A\u2122': '\u26D9',
      '\u00E2\u203A\u0161': '\u26DA',
      '\u00E2\u203A\u203A': '\u26DB',
      '\u00E2\u203A\u015B': '\u26DC',
      '\u00E2\u203A\u0153': '\u26DC',
      '\u00E2\u203A\u0165': '\u26DD',
      '\u00E2\u203A\u017E': '\u26DE',
      '\u00E2\u203A\u017A': '\u26DF',
      '\u00E2\u203A\u0178': '\u26DF',
      '\u00E2\u203A\u00A0': '\u26E0',
      '\u00E2\u203A\u02C7': '\u26E1',
      '\u00E2\u203A\u00A1': '\u26E1',
      '\u00E2\u203A\u02D8': '\u26E2',
      '\u00E2\u203A\u00A2': '\u26E2',
      '\u00E2\u203A\u0141': '\u26E3',
      '\u00E2\u203A\u00A3': '\u26E3',
      '\u00E2\u203A\u00A4': '\u26E4',
      '\u00E2\u203A\u0104': '\u26E5',
      '\u00E2\u203A\u00A5': '\u26E5',
      '\u00E2\u203A\u00A6': '\u26E6',
      '\u00E2\u203A\u00A7': '\u26E7',
      '\u00E2\u203A\u00A8': '\u26E8',
      '\u00E2\u203A\u00A9': '\u26E9',
      '\u00E2\u203A\u015E': '\u26EA',
      '\u00E2\u203A\u00AA': '\u26EA',
      '\u00E2\u203A\u00AB': '\u26EB',
      '\u00E2\u203A\u00AC': '\u26EC',
      '\u00E2\u203A\u00AD': '\u26ED',
      '\u00E2\u203A\u00AE': '\u26EE',
      '\u00E2\u203A\u017B': '\u26EF',
      '\u00E2\u203A\u00AF': '\u26EF',
      '\u00E2\u203A\u00B0': '\u26F0',
      '\u00E2\u203A\u00B1': '\u26F1',
      '\u00E2\u203A\u02DB': '\u26F2',
      '\u00E2\u203A\u00B2': '\u26F2',
      '\u00E2\u203A\u0142': '\u26F3',
      '\u00E2\u203A\u00B3': '\u26F3',
      '\u00E2\u203A\u00B4': '\u26F4',
      '\u00E2\u203A\u00B5': '\u26F5',
      '\u00E2\u203A\u00B6': '\u26F6',
      '\u00E2\u203A\u00B7': '\u26F7',
      '\u00E2\u203A\u00B8': '\u26F8',
      '\u00E2\u203A\u0105': '\u26F9',
      '\u00E2\u203A\u00B9': '\u26F9',
      '\u00E2\u203A\u015F': '\u26FA',
      '\u00E2\u203A\u00BA': '\u26FA',
      '\u00E2\u203A\u00BB': '\u26FB',
      '\u00E2\u203A\u013D': '\u26FC',
      '\u00E2\u203A\u00BC': '\u26FC',
      '\u00E2\u203A\u02DD': '\u26FD',
      '\u00E2\u203A\u00BD': '\u26FD',
      '\u00E2\u203A\u013E': '\u26FE',
      '\u00E2\u203A\u00BE': '\u26FE',
      '\u00E2\u203A\u017C': '\u26FF',
      '\u00E2\u203A\u00BF': '\u26FF',
      '\u00E2\u015B\u015A': '\u270C',
      '\u00E2\u0153\u0152': '\u270C',
      '\u010F\u00B8\u0179': '\uFE0F',
      '\u00E2\u20AC\u02DC': '\u2018',
      '\u00E2\u20AC\u2122': '\u2019',
      '\u00E2\u20AC\u015B': '\u201C',
      '\u00E2\u20AC\u0153': '\u201C',
      '\u00E2\u20AC\u0165': '\u201D',
      '\u00E2\u20AC\u201D': '\u2014',
      '\u00E2\u20AC\u201C': '\u2013',
      '\u00E2\u20AC\u00A6': '\u2026',
      '\u00E2\u20AC\u02D8': '\u2022',
      '\u00E2\u20AC\u00A2': '\u2022',
      '\u00E2\u20AC\u0105': '\u2039',
      '\u00E2\u20AC\u00B9': '\u2039',
      '\u00E2\u20AC\u015F': '\u203A',
      '\u00E2\u20AC\u00BA': '\u203A',
      '\u00E2\u201A\u00AC': '\u20AC',
      '\u00C2\u00B7': '\u00B7',
      '\u00C2\u00AB': '\u00AB',
      '\u00C2\u00BB': '\u00BB',
      '\u00C4\u2026': '\u0105',
      '\u00C4\u2021': '\u0107',
      '\u00C4\u2122': '\u0119',
      '\u0139\u201A': '\u0142',
      '\u00C5\u201A': '\u0142',
      '\u0139\u201E': '\u0144',
      '\u00C5\u201E': '\u0144',
      '\u0102\u0142': '\u00F3',
      '\u00C3\u00B3': '\u00F3',
      '\u0139\u203A': '\u015B',
      '\u00C5\u203A': '\u015B',
      '\u0139\u015F': '\u017A',
      '\u00C5\u00BA': '\u017A',
      '\u0139\u013D': '\u017C',
      '\u00C5\u00BC': '\u017C',
      '\u00C4\u201E': '\u0104',
      '\u00C4\u2020': '\u0106',
      '\u00C4\u02DC': '\u0118',
      '\u00C5\u0192': '\u0143',
      '\u0102\u201C': '\u00D3',
      '\u00C3\u201C': '\u00D3',
      '\u0139\u0161': '\u015A',
      '\u00C5\u0161': '\u015A',
      '\u0139\u0105': '\u0179',
      '\u00C5\u00B9': '\u0179',
      '\u0139\u00BB': '\u017B',
      '\u00C5\u00BB': '\u017B',
      '\u0102\u02C7': '\u00E1',
      '\u00C3\u00A1': '\u00E1',
      '\u0102\u00A9': '\u00E9',
      '\u00C3\u00A9': '\u00E9',
      '\u0102\u00AD': '\u00ED',
      '\u00C3\u00AD': '\u00ED',
      '\u0102\u015F': '\u00FA',
      '\u00C3\u00BA': '\u00FA',
      '\u0102\u013D': '\u00FC',
      '\u00C3\u00BC': '\u00FC',
      '\u0102\u00B6': '\u00F6',
      '\u00C3\u00B6': '\u00F6',
      '\u0102\u00A4': '\u00E4',
      '\u00C3\u00A4': '\u00E4',
      '\u0102\u00AB': '\u00EB',
      '\u00C3\u00AB': '\u00EB',
      '\u0102\u017B': '\u00EF',
      '\u00C3\u00AF': '\u00EF',
      '\u0102\u00A7': '\u00E7',
      '\u00C3\u00A7': '\u00E7',
      '\u0102\u00B1': '\u00F1',
      '\u00C3\u00B1': '\u00F1',
      '\u00C2\u02D8': '\u00A2',
      '\u00C2\u00A2': '\u00A2',
      '\u00C2\u0141': '\u00A3',
      '\u00C2\u00A3': '\u00A3',
      '\u00C2\u00A7': '\u00A7',
      '\u00C2\u00A9': '\u00A9',
      '\u00C2\u00AE': '\u00AE',
      '\u00C2\u00B0': '\u00B0',
      '\u00C2\u00B1': '\u00B1',
      '\u0102\u2014': '\u00D7',
      '\u00C3\u2014': '\u00D7',
      '\u0102\u00B7': '\u00F7',
      '\u00C3\u00B7': '\u00F7',
      '\u00C2\u00B5': '\u00B5',
    };
  }

  _detectMojibake(str) {
    if (!str || typeof str !== 'string') return null;
    let fixed = str;
    let hasMojibake = false;

    // Method 1: Try decodeURIComponent(escape(str))
    try {
      const decoded = decodeURIComponent(escape(str));
      if (decoded !== str) {
        return { original: str, fixed: decoded, method: 'escape-decode' };
      }
    } catch(e) { /* not double-encoded */ }

    // Method 2: Pattern replacement for known mojibake sequences
    // Iterate up to 3 passes to collapse multi-layer mojibake
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (const [bad, good] of Object.entries(HaEncodingFixer.MOJIBAKE_MAP)) {
        if (fixed.includes(bad)) {
          fixed = fixed.split(bad).join(good);
          hasMojibake = true;
          changed = true;
        }
      }
      if (!changed) break;
    }

    // Method 2b: Python-style Unicode escape literals (\UXXXXXXXX / \uXXXX)
    // Common source: YAML strings that got serialized with repr()/Python str
    // encoding, e.g. "\U0001F512 Alarm Uzbrojony" or "\u0142" for ł.
    // Convert to actual characters. This complements the MOJIBAKE_MAP pass.
    const pyEscU8 = fixed.replace(/\\U([0-9A-Fa-f]{8})/g, (m, h) => {
      const cp = parseInt(h, 16);
      return (cp >= 0 && cp <= 0x10FFFF) ? String.fromCodePoint(cp) : m;
    });
    if (pyEscU8 !== fixed) {
      fixed = pyEscU8;
      hasMojibake = true;
    }
    const pyEscU4 = fixed.replace(/\\u([0-9A-Fa-f]{4})/g, (m, h) => {
      const cp = parseInt(h, 16);
      // Skip surrogate halves (U+D800-U+DFFF) — they must come as pairs,
      // and the MOJIBAKE_MAP has already emitted them as real SMP chars.
      if (cp >= 0xD800 && cp <= 0xDFFF) return m;
      return String.fromCodePoint(cp);
    });
    if (pyEscU4 !== fixed) {
      fixed = pyEscU4;
      hasMojibake = true;
    }
    if (hasMojibake) {
      return { original: str, fixed: fixed, method: 'pattern-replace' };
    }

    // Method 3: Check for suspicious byte sequences (C3 xx, C4 xx, C5 xx in string)
    const suspiciousPattern = /[\u00C3\u00C4\u00C5][\u0080-\u00BF]/;
    if (suspiciousPattern.test(str)) {
      return { original: str, fixed: str, method: 'suspicious', uncertain: true };
    }

    return null;
  }

  _hasBOM(str) {
    return str && str.charCodeAt(0) === 0xFEFF;
  }

  // --- Scan entities ---
  async _scanEntities() {
    if (!this._hass || this._scanning) return;
    this._scanning = true;
    this._entityScanning = true;
    this._scanResults = [];
    this._scanProgress = 0;

    const TEST_PATHS = /\b(example|examples|test|tests|demo|demos|sample|samples)\b/i;
    const allStates = Object.values(this._hass.states);
    this._scanTotal = allStates.length;
    this._excludedCount = 0;
    this._updateUI();

    for (let i = 0; i < allStates.length; i++) {
      const entity = allStates[i];
      this._scanProgress = i + 1;

      // Skip test/example/demo entities
      if (TEST_PATHS.test(entity.entity_id)) {
        this._excludedCount++;
        continue;
      }

      // Check friendly_name
      const fname = entity.attributes?.friendly_name;
      if (fname) {
        const result = this._detectMojibake(fname);
        if (result && !result.uncertain) {
          this._scanResults.push({
            entity_id: entity.entity_id,
            attribute: 'friendly_name',
            ...result
          });
        }
      }

      // Check state value if string
      if (typeof entity.state === 'string' && entity.state.length > 1) {
        const result = this._detectMojibake(entity.state);
        if (result && !result.uncertain) {
          this._scanResults.push({
            entity_id: entity.entity_id,
            attribute: 'state',
            ...result
          });
        }
      }

      // Update UI every 200 entities
      if (i % 200 === 0) {
        this._updateUI();
        await new Promise(r => setTimeout(r, 0));
      }
    }

    this._scanning = false;
    this._entityScanning = false;
    this._updateUI();
  }

  // --- Scan lovelace_resources ---
  async _scanLovelace() {
    if (!this._hass || this._lovelaceScanning) return;
    this._lovelaceScanning = true;
    this._lovelaceIssues = [];
    this._updateUI();

    try {
      // Fetch lovelace resources via WS API
      const resources = await this._hass.callWS({ type: 'lovelace/resources' });
      this._lovelaceResources = resources;

      const seen = new Set();
      for (const res of resources) {
        const url = res.url || '';

        // Check for BOM in URL
        if (this._hasBOM(url)) {
          this._lovelaceIssues.push({
            id: res.id,
            url: url,
            type: res.type || 'module',
            issue: 'bom',
            fixedUrl: url.replace(/^\uFEFF/, '')
          });
        }

        // Check for duplicate URLs (ignoring query params)
        const baseUrl = url.split('?')[0];
        if (seen.has(baseUrl)) {
          this._lovelaceIssues.push({
            id: res.id,
            url: url,
            type: res.type || 'module',
            issue: 'duplicate',
            fixedUrl: null
          });
        }
        seen.add(baseUrl);

        // Check for mojibake in URL
        const mojibake = this._detectMojibake(url);
        if (mojibake && !mojibake.uncertain) {
          this._lovelaceIssues.push({
            id: res.id,
            url: url,
            type: res.type || 'module',
            issue: 'mojibake',
            fixedUrl: mojibake.fixed
          });
        }

        // Check for broken URL patterns
        if (url && !url.startsWith('/') && !url.startsWith('http')) {
          this._lovelaceIssues.push({
            id: res.id,
            url: url,
            type: res.type || 'module',
            issue: 'broken_url',
            fixedUrl: null
          });
        }
      }
    } catch(e) {
      console.warn('[Encoding Fixer] Error scanning lovelace:', e);
    }

    this._lovelaceScanning = false;
    this._updateUI();

    // Auto-create snapshot if none exists
    try {
      let hasSnapshot = false;
      if (window._haToolsPersistence) {
        window._haToolsPersistence.setHass(this._hass);
        const snap = await window._haToolsPersistence.load('encoding-fixer-resource-snapshot');
        if (snap && snap.items) hasSnapshot = true;
      }
      if (!hasSnapshot) {
        const raw = localStorage.getItem('ha-tools-encoding-fixer-resource-snapshot');
        if (raw) hasSnapshot = true;
      }
      if (!hasSnapshot && this._lovelaceResources && this._lovelaceResources.length > 5) {
        console.info('[Encoding Fixer] Auto-creating first resource snapshot');
        await this._createResourceSnapshot();
      }
    } catch(e) { /* ignore */ }
  }

  // --- Backup ---
  _createBackup(type, items) {
    const backup = { ts: Date.now(), type, items: items.map(i => ({ ...i })) };
    try {
      const key = 'ha-tools-encoding-fixer-backup';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(backup);
      if (existing.length > 20) existing.splice(0, existing.length - 20);
      localStorage.setItem(key, JSON.stringify(existing));
      console.log('[Encoding Fixer] Backup created:', type, items.length, 'items');
      return true;
    } catch(e) {
      console.warn('[Encoding Fixer] Backup failed:', e);
      return false;
    }
  }

  _getBackups() {
    try { return JSON.parse(localStorage.getItem('ha-tools-encoding-fixer-backup') || '[]'); }
    catch(e) { return []; }
  }

  _showRestartHint() {
    const msg = this._lang === 'pl'
      ? '\u2705 Naprawy zastosowane. Zalecany restart HA (Ustawienia \u2192 System \u2192 Restart).'
      : '\u2705 Fixes applied. HA restart recommended (Settings \u2192 System \u2192 Restart).';
    this._showToast(msg, 'success');
  }

  // --- Fix actions ---
  // Single-entity fix — marks result in place (does NOT remove from list anymore).
  // Returns true on success, false on failure.
  async _fixEntityName(entityId, fixedName, opts = {}) {
    if (!this._hass) return false;
    const t = this._t;
    const orig = this._scanResults.find(r => r.entity_id === entityId && r.attribute === 'friendly_name');
    if (orig && !opts.noBackup) this._createBackup('entity', [{ entity_id: entityId, attribute: 'friendly_name', original: orig.original, fixed: fixedName }]);
    try {
      await this._hass.callWS({
        type: 'config/entity_registry/update',
        entity_id: entityId,
        name: fixedName
      });
      this._addFixLog('entity', entityId, 'success', fixedName);
      // Mark in place instead of filtering out — prevents list "disappearing"
      if (orig) { orig._fixStatus = 'success'; orig._fixedAt = Date.now(); }
      this._selectedIssues.delete(entityId);
      if (!opts.suppressRender) this._updateUI();
      return true;
    } catch(e) {
      console.warn('[Encoding Fixer]', e);
      this._addFixLog('entity', entityId, 'failed', e && e.message ? e.message : String(e));
      if (orig) { orig._fixStatus = 'failed'; orig._fixError = e && e.message ? e.message : String(e); }
      if (!opts.suppressRender) this._showToast(t.errorFixing + ': ' + entityId, 'error');
      return false;
    }
  }

  async _runBatchFix(entitiesToFix, batchType) {
    if (!entitiesToFix.length) return;
    // Enter running state
    this._fixState = 'running';
    this._fixProgress = 0;
    this._fixTotal = entitiesToFix.length;
    this._fixResults = [];
    this._fixCurrentLabel = '';
    this._createBackup(batchType, entitiesToFix.map(r => ({ entity_id: r.entity_id, original: r.original, fixed: r.fixed })));
    this._updateUI();

    for (let i = 0; i < entitiesToFix.length; i++) {
      const item = entitiesToFix[i];
      this._fixProgress = i;
      this._fixCurrentLabel = item.entity_id;
      this._updateUI();
      const ok = await this._fixEntityName(item.entity_id, item.fixed, { noBackup: true, suppressRender: true });
      this._fixResults.push({ entity_id: item.entity_id, status: ok ? 'success' : 'failed', error: ok ? null : (item._fixError || null) });
      await new Promise(r => setTimeout(r, 300));
    }
    this._fixProgress = this._fixTotal;
    this._fixState = 'done';
    this._fixCurrentLabel = '';
    this._updateUI();
  }

  async _fixSelectedEntities() {
    const entitiesToFix = this._scanResults.filter(r =>
      this._selectedIssues.has(r.entity_id) && r.attribute === 'friendly_name' && r.fixed && !r._fixStatus
    );
    if (!entitiesToFix.length) return;
    if (!confirm(this._lang === 'pl' ? 'Naprawic ' + entitiesToFix.length + ' zaznaczonych encji?\nKopia zapasowa zostanie utworzona automatycznie.' : 'Fix ' + entitiesToFix.length + ' selected entities?\nA backup will be created automatically.')) return;
    await this._runBatchFix(entitiesToFix, 'entity-batch');
  }

  async _fixAllEntities() {
    const entitiesToFix = this._scanResults.filter(r =>
      r.attribute === 'friendly_name' && r.fixed && r.fixed !== r.original && !r._fixStatus
    );
    if (!entitiesToFix.length) return;
    if (!confirm(this._lang === 'pl' ? '\u26A0\uFE0F Naprawic WSZYSTKIE ' + entitiesToFix.length + ' encji?\nKopia zapasowa zostanie utworzona automatycznie.\nPo naprawie zalecany restart HA.' : '\u26A0\uFE0F Fix ALL ' + entitiesToFix.length + ' entities?\nA backup will be created.\nHA restart recommended after fix.')) return;
    await this._runBatchFix(entitiesToFix, 'entity-all');
  }

  _fixBackToList() {
    this._fixState = 'idle';
    this._fixProgress = 0;
    this._fixTotal = 0;
    this._fixResults = [];
    this._fixCurrentLabel = '';
    this._updateUI();
  }

  async _fixLovelaceResource(issue) {
    if (!this._hass || !issue.fixedUrl) return;
    const t = this._t;
    if (!confirm(this._lang === 'pl' ? 'Naprawic lovelace resource?\nURL: ' + issue.url + '\nNowy: ' + issue.fixedUrl + '\nKopia zapasowa zostanie utworzona.\nWymagany restart HA.' : 'Fix lovelace resource?\nURL: ' + issue.url + '\nNew: ' + issue.fixedUrl + '\nBackup will be created.\nHA restart required.')) return;
    this._createBackup('lovelace', [{ id: issue.id, url: issue.url, fixedUrl: issue.fixedUrl }]);
    try {
      await this._hass.callWS({
        type: 'lovelace/resources/update',
        resource_id: issue.id,
        url: issue.fixedUrl
      });
      this._addFixLog('lovelace', issue.url, 'success', issue.fixedUrl);
      this._lovelaceIssues = this._lovelaceIssues.filter(i => i.id !== issue.id);
      this._showRestartHint();
      this._updateUI();
    } catch(e) {
      console.warn('[Encoding Fixer]', e);
      this._addFixLog('lovelace', issue.url, 'failed', e.message);
      this._showToast(t.errorFixing, 'error');
    }
  }

  // --- Persistence ---
  _loadFixLog() {
    try {
      const raw = localStorage.getItem('ha-tools-encoding-fixer-log');
      this._fixLog = raw ? JSON.parse(raw) : [];
    } catch(e) { this._fixLog = []; }
  }

  _saveFixLog() {
    try {
      if (this._fixLog.length > 100) this._fixLog = this._fixLog.slice(-100);
      localStorage.setItem('ha-tools-encoding-fixer-log', JSON.stringify(this._fixLog));
    } catch(e) { /* ignore */ }
  }

  _addFixLog(type, target, result, detail) {
    this._fixLog.push({ ts: Date.now(), type, target, result, detail });
    this._saveFixLog();
  }

  _showToast(msg, type) {
    const toast = this.shadowRoot?.querySelector('.toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast toast-' + (type || 'info') + ' toast-show';
    setTimeout(() => { toast.className = 'toast'; }, 3000);
  }

  // --- Test tool ---
  _testDecode(input) {
    if (!input) return null;
    const result = this._detectMojibake(input);
    return result;
  }

  // --- UI ---
  _updateUI() {
    const html = this._buildHTML();
    if (html === this._lastHtml) return;
    this._lastHtml = html;
    this.shadowRoot.innerHTML = html;
    this._attachEvents();
  }

  _buildHTML() {
    const t = this._t;
    return `<style>${window.HAToolsBentoCSS || ''}
/* === Support / Donation Section (HA Tools split) === */
.donate-section { margin: 20px 0 4px; padding: 18px 20px;  background: var(--donate-bg, linear-gradient(135deg, #fff5f5 0%, #fff0f6 50%, #f8f0ff 100%));  border: 1px solid var(--donate-border, #f3d3e0); border-radius: var(--bento-radius-md, 16px);  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; }
.donate-section h3 { margin: 0 0 6px; font-size: 15px; color: var(--donate-heading, #be185d); }
.donate-section p  { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--donate-text, #6b21a8); }
.donate-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.donate-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px;  font-weight: 600; font-size: 12.5px; text-decoration: none; transition: transform .15s ease, box-shadow .15s ease; }
.donate-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.08); }
.donate-btn.coffee { background: #FFDD00; color: #000; border: 1px solid #e6c700; }
.donate-btn.paypal { background: #0070ba; color: #fff; border: 1px solid #005ea6; }
@media (prefers-color-scheme: dark) {  .donate-section { background: linear-gradient(135deg, #2a1525 0%, #1e1530 50%, #251530 100%); border-color: #4a3555; }  .donate-section h3 { color: #f0c0d8; }  .donate-section p  { color: #d4a0b8; }  .donate-btn.coffee { background: #b8a100; color: #fff; border-color: #8a7a00; }  .donate-btn.paypal { background: #005a96; color: #e0f0ff; border-color: #004a7a; } }
@media (max-width: 600px) {  .donate-section { flex-direction: column; text-align: center; padding: 16px; }  .donate-buttons { justify-content: center; } }
/* === Prereq banner (HA Tools split injector) === */
.prereq-banner { display: flex; align-items: flex-start; gap: 12px; padding: 14px 18px;  border-radius: var(--bento-radius-sm, 10px); margin: 10px 0 14px; font-size: 13px; line-height: 1.5;  border: 1px solid; }
.prereq-banner.prereq-error { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.3); color: #991b1b; }
.prereq-banner.prereq-info  { background: rgba(59, 130, 246, 0.06); border-color: rgba(59, 130, 246, 0.3); color: #1e40af; }
.prereq-banner .prereq-icon { font-size: 22px; flex-shrink: 0; line-height: 1; padding-top: 2px; }
.prereq-banner .prereq-text { flex: 1; min-width: 0; }
.prereq-banner code { background: rgba(0,0,0,0.06); padding: 1px 6px; border-radius: 4px; font-size: 12px; }
.prereq-banner .prereq-cta { display: inline-block; padding: 6px 12px; border-radius: 6px;  background: var(--bento-primary, #3B82F6); color: #fff !important; text-decoration: none;  font-weight: 600; font-size: 12px; flex-shrink: 0; }
.prereq-banner .prereq-cta:hover { background: var(--bento-primary-hover, #2563EB); }
@media (prefers-color-scheme: dark) {  .prereq-banner.prereq-error { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border-color: rgba(239, 68, 68, 0.4); }  .prereq-banner.prereq-info  { background: rgba(59, 130, 246, 0.12); color: #93c5fd; border-color: rgba(59, 130, 246, 0.4); }  .prereq-banner code { background: rgba(255,255,255,0.08); } }
@media (max-width: 600px) {  .prereq-banner { flex-direction: column; align-items: stretch; }  .prereq-banner .prereq-cta { align-self: flex-start; } }
</style><style>${this._getCSS()}</style>
    <div class="card">
      <div class="header">
        <div class="header-left">
          <span class="header-icon">\uD83D\uDD27</span>
          <h2>${t.title}</h2>
        </div>
      </div>

      <div class="tabs">
        <button class="tab-btn ${this._activeTab === 'scan' ? 'active' : ''}" data-tab="scan">${t.tabScan}</button>
        <button class="tab-btn ${this._activeTab === 'yaml' ? 'active' : ''}" data-tab="yaml">${t.tabYaml}</button>
        <button class="tab-btn ${this._activeTab === 'lovelace' ? 'active' : ''}" data-tab="lovelace">${t.tabLovelace}</button>
        <button class="tab-btn ${this._activeTab === 'log' ? 'active' : ''}" data-tab="log">${t.tabLog}</button>
      </div>

      <div class="tab-content">
        ${this._activeTab === 'scan' ? this._buildScanTab() : ''}
        ${this._activeTab === 'yaml' ? this._buildYamlTab() : ''}
        ${this._activeTab === 'lovelace' ? this._buildLovelaceTab() : ''}
        ${this._activeTab === 'log' ? this._buildLogTab() : ''}
      </div>

      <div class="toast"></div>
    
        <!-- Support / Donation -->
        <div class="donate-section" data-source="ha-tools-split">
          <div class="donate-text">
            <h3>❤️ ${this._lang === 'pl' ? 'Wesprzyj rozwój HA Tools' : 'Support HA Tools Development'}</h3>
            <p>${this._lang === 'pl' ? 'Jeśli to narzędzie ułatwia Ci życie z Home Assistant, rozważ wsparcie projektu. Każda kawa motywuje do dalszego rozwoju!' : 'If this tool makes your Home Assistant life easier, consider supporting the project. Every coffee motivates further development!'}</p>
          </div>
          <div class="donate-buttons">
            <a class="donate-btn coffee" href="https://buymeacoffee.com/macsiem" target="_blank" rel="noopener noreferrer">☕ Buy Me a Coffee</a>
            <a class="donate-btn paypal" href="https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W" target="_blank" rel="noopener noreferrer">💳 PayPal</a>
          </div>
        </div>
        </div>`;
  }

  _buildScanTab() {
    const t = this._t;

    // Test tool
    const testSection = `
      <div class="section">
        <h3>\uD83E\uDDEA ${t.testString}</h3>
        <textarea class="test-input" placeholder="${t.testInput}" rows="2"></textarea>
        <div class="test-result"></div>
      </div>
    `;

    // Scan button + progress
    let scanStatus = '';
    if (this._scanning) {
      const pct = this._scanTotal > 0 ? Math.round((this._scanProgress / this._scanTotal) * 100) : 0;
      scanStatus = `
        <div class="scan-progress">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <span class="progress-text">${t.scanning} ${this._scanProgress}/${this._scanTotal}</span>
        </div>`;
    }

    // Results
    let resultsHtml = '';

    // Batch fix overlays take precedence
    if (this._fixState === 'running') {
      const pct = this._fixTotal > 0 ? Math.round((this._fixProgress / this._fixTotal) * 100) : 0;
      resultsHtml = `
        <div class="section">
          <div class="fix-progress-panel">
            <h3>${this._lang === 'pl' ? 'Naprawianie\u2026' : 'Fixing\u2026'}</h3>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div class="progress-text">${this._fixProgress}/${this._fixTotal} (${pct}%)</div>
            <div class="progress-current">${this._escapeHtml(this._fixCurrentLabel || '')}</div>
          </div>
        </div>`;
    } else if (this._fixState === 'done') {
      const okCount = this._fixResults.filter(r => r.status === 'success').length;
      const failCount = this._fixResults.filter(r => r.status === 'failed').length;
      const failRows = this._fixResults.filter(r => r.status === 'failed').map(r => `<li><code>${r.entity_id}</code> \u2014 ${this._escapeHtml(r.error || '')}</li>`).join('');
      resultsHtml = `
        <div class="section">
          <div class="fix-done-panel">
            <h3>${this._lang === 'pl' ? 'Gotowe' : 'Done'}</h3>
            <div class="done-stats">
              <span class="stat-ok">\u2705 ${okCount} ${this._lang === 'pl' ? 'naprawionych' : 'fixed'}</span>
              ${failCount > 0 ? `<span class="stat-fail">\u274C ${failCount} ${this._lang === 'pl' ? 'b\u0142\u0119d\u00F3w' : 'failed'}</span>` : ''}
            </div>
            ${failCount > 0 ? `<details class="fail-details"><summary>${this._lang === 'pl' ? 'Szczeg\u00F3\u0142y b\u0142\u0119d\u00F3w' : 'Error details'}</summary><ul>${failRows}</ul></details>` : ''}
            <div class="done-actions">
              <button class="btn btn-sm btn-primary" data-action="fix-back">${this._lang === 'pl' ? 'Wr\u00F3\u0107 do listy' : 'Back to list'}</button>
            </div>
          </div>
        </div>`;
    } else if (!this._scanning && this._scanResults.length > 0) {
      const pending = this._scanResults.filter(r => !r._fixStatus);
      const selectablePending = pending.filter(r => r.attribute === 'friendly_name' && r.fixed);
      const rows = this._scanResults.map((r, i) => {
        const selected = this._selectedIssues.has(r.entity_id);
        const statusCls = r._fixStatus ? ` status-${r._fixStatus}` : '';
        const statusBadge = r._fixStatus === 'success'
          ? `<span class="row-status ok">\u2705</span>`
          : r._fixStatus === 'failed'
            ? `<span class="row-status err" title="${this._escapeHtml(r._fixError || '')}">\u274C</span>`
            : '';
        const checkbox = r._fixStatus
          ? ''
          : `<input type="checkbox" data-select="${i}" ${selected ? 'checked' : ''} />`;
        return `<div class="result-row${statusCls}">
          <label class="result-check">${checkbox}${statusBadge}</label>
          <div class="result-entity">${r.entity_id}</div>
          <div class="result-attr">${r.attribute}</div>
          <div class="result-original">${this._escapeHtml(r.original)}</div>
          <div class="result-arrow">\u2192</div>
          <div class="result-fixed">${this._escapeHtml(r.fixed)}</div>
        </div>`;
      }).join('');

      const doneCount = this._scanResults.filter(r => r._fixStatus === 'success').length;
      const failedCount = this._scanResults.filter(r => r._fixStatus === 'failed').length;
      resultsHtml = `
        <div class="section">
          <div class="results-header">
            <h3>${pending.length} ${t.issuesFound}${doneCount ? ` \u2014 \u2705 ${doneCount}` : ''}${failedCount ? ` \u2014 \u274C ${failedCount}` : ''}</h3>
            <div class="results-actions">
              <button class="btn btn-sm btn-secondary" data-action="select-all">${t.selectAll}</button>
              <button class="btn btn-sm btn-secondary" data-action="deselect-all">${t.deselectAll}</button>
              <button class="btn btn-sm btn-primary" data-action="fix-selected" ${this._selectedIssues.size === 0 ? 'disabled' : ''}>${t.fixSelected} (${this._selectedIssues.size})</button>
              <button class="btn btn-sm btn-danger" data-action="fix-all" ${selectablePending.length === 0 ? 'disabled' : ''}>${t.fixAll}</button>
            </div>
          </div>
          <div class="results-list">${rows}</div>
        </div>`;
    } else if (!this._scanning && this._scanResults.length === 0 && this._scanTotal > 0) {
      resultsHtml = `<div class="section"><div class="empty-state">\u2705 ${t.noIssuesFound}</div></div>`;
    }

    // Common patterns reference with more examples
    const patternExamples = [
      { broken: 'Ä…', fixed: 'ą', cause: 'UTF-8 read as Latin-1' },
      { broken: 'Ã³', fixed: 'ó', cause: 'UTF-8 read as Latin-1' },
      { broken: 'â€™', fixed: "'", cause: "Windows-1252 in UTF-8" },
      { broken: 'Å¼', fixed: 'ż', cause: 'UTF-8 read as Latin-1' },
      { broken: 'â€œ', fixed: '"', cause: "Windows-1252 in UTF-8" },
      { broken: 'â€\u0093', fixed: '"', cause: "Windows-1252 in UTF-8" },
      { broken: 'Ä™', fixed: 'ę', cause: 'UTF-8 read as Latin-1' },
      { broken: 'Å›', fixed: 'ś', cause: 'UTF-8 read as Latin-1' },
      { broken: 'Ã©', fixed: 'é', cause: 'UTF-8 read as Latin-1' },
      { broken: 'Ã¼', fixed: 'ü', cause: 'UTF-8 read as Latin-1' },
    ];
    const patternTableRows = patternExamples.map(ex => `
      <tr>
        <td class="pattern-cell broken"><code>${this._escapeHtml(ex.broken)}</code></td>
        <td class="pattern-cell fixed"><code>${this._escapeHtml(ex.fixed)}</code></td>
        <td class="pattern-cell cause">${ex.cause}</td>
      </tr>
    `).join('');

    return `
      ${testSection}

      <div class="section">
        <div class="scan-header">
          <h3>${t.scanEntities}</h3>
          <button class="btn btn-primary" data-action="scan-entities" ${this._scanning ? 'disabled' : ''}>${this._scanning ? t.scanning : t.scanEntities}</button>
        </div>
        ${scanStatus}
      </div>

      ${resultsHtml}

      ${this._excludedCount > 0 ? `<div class="excluded-note">\u2139\uFE0F ${this._lang === 'pl' ? 'Pomini\u0119to' : 'Skipped'} ${this._excludedCount} ${this._lang === 'pl' ? 'wynik\u00F3w z katalog\u00F3w testowych' : 'results from test/demo directories'}</div>` : ''}

      <div class="section patterns-section">
        <details class="patterns-details">
          <summary class="patterns-summary">${t.patternsExpandHint}</summary>
          <p class="patterns-desc">${t.commonPatterns}</p>
          <table class="patterns-table">
            <thead>
              <tr>
                <th>Broken</th>
                <th>Fixed</th>
                <th>Cause</th>
              </tr>
            </thead>
            <tbody>
              ${patternTableRows}
            </tbody>
          </table>
        </details>
      </div>
    `;
  }

  _buildLovelaceTab() {
    const t = this._t;

    let scanStatus = '';
    if (this._lovelaceScanning) {
      scanStatus = `<div class="scan-progress"><div class="spinner-small"></div> ${t.scanning}</div>`;
    }

    let issuesHtml = '';
    if (!this._lovelaceScanning && this._lovelaceIssues.length > 0) {
      const rows = this._lovelaceIssues.map((issue, i) => {
        const issueLabel = {
          'bom': t.bomDetected,
          'duplicate': t.duplicateEntry,
          'mojibake': 'Mojibake',
          'broken_url': t.brokenUrl
        }[issue.issue] || issue.issue;

        return `<div class="lovelace-row">
          <div class="lovelace-url">${this._escapeHtml(issue.url)}</div>
          <div class="lovelace-type">${issue.type}</div>
          <div class="lovelace-issue issue-${issue.issue}">${issueLabel}</div>
          ${issue.fixedUrl ? `<button class="btn btn-sm btn-primary" data-fix-lovelace="${i}">${t.fix}</button>` : '<span class="manual-fix">\u26A0\uFE0F</span>'}
        </div>`;
      }).join('');

      issuesHtml = `
        <div class="section">
          <h3>${this._lovelaceIssues.length} ${t.lovelaceIssuesFound}</h3>
          <div class="lovelace-list">${rows}</div>
          <div class="lovelace-warning">\u26A0\uFE0F ${t.warningLovelace}</div>
        </div>`;
    } else if (!this._lovelaceScanning && this._lovelaceIssues.length === 0 && this._lovelaceResources) {
      issuesHtml = `<div class="section"><div class="empty-state">\u2705 ${t.lovelaceOk}</div></div>`;
    }

    // BOM explanation
    const bomInfo = `
      <div class="section info-section">
        <h3>\u2139\uFE0F BOM (Byte Order Mark)</h3>
        <p>${t.bomExplain}</p>
        <div class="bom-visual">
          <code>EF BB BF</code> = <code>\\uFEFF</code>
        </div>
      </div>
    `;

    return `
      <div class="section">
        <div class="scan-header">
          <h3>${t.lovelaceTitle}</h3>
          <button class="btn btn-primary" data-action="scan-lovelace" ${this._lovelaceScanning ? 'disabled' : ''}>${t.scanLovelace}</button>
        </div>
        <p class="section-desc">${t.lovelaceDesc}</p>
        ${scanStatus}
      </div>

      ${issuesHtml}
      ${bomInfo}

      <div class="restore-divider"><span>${this._lang === 'pl' ? 'Odzyskiwanie' : 'Restore'}</span></div>
      ${this._buildRestoreTab()}
    `;
  }

  _buildLogTab() {
    const t = this._t;
    if (this._fixLog.length === 0) {
      return `<div class="section"><div class="empty-state">${t.noLog}</div></div>`;
    }

    const rows = [...this._fixLog].reverse().slice(0, 50).map(entry => {
      const date = new Date(entry.ts);
      const dateStr = date.toLocaleString(this._lang === 'pl' ? 'pl-PL' : 'en-US', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      const typeIcon = entry.type === 'entity' ? '\uD83C\uDFF7\uFE0F' : '\uD83D\uDCC4';
      const resultClass = entry.result === 'success' ? 'log-success' : 'log-failed';
      return `<div class="log-row">
        <div class="log-date">${dateStr}</div>
        <div class="log-type">${typeIcon}</div>
        <div class="log-target">${this._escapeHtml(entry.target)}</div>
        <div class="log-result ${resultClass}">${entry.result === 'success' ? t.success : t.failed}</div>
        <div class="log-detail">${this._escapeHtml(entry.detail || '')}</div>
      </div>`;
    }).join('');

    return `
      <div class="section">
        <h3>${t.logTitle}</h3>
        <div class="log-list">${rows}</div>
      </div>
    `;
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  _attachEvents() {
    const sr = this.shadowRoot;
    if (!sr) return;

    // Tabs
    sr.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabsContainer = sr.querySelector('.tabs');
        const scrollPos = tabsContainer?.scrollLeft || 0;
        this._activeTab = btn.dataset.tab;
        history.replaceState(null, '', location.pathname + '#' + this._toolId + '/' + this._activeTab);
        this._updateUI();
        // Restore scroll position after DOM rebuild
        requestAnimationFrame(() => {
          const newTabsContainer = this.shadowRoot?.querySelector('.tabs');
          if (newTabsContainer) newTabsContainer.scrollLeft = scrollPos;
        });
      });
    });

    // Scan entities
    const scanBtn = sr.querySelector('[data-action="scan-entities"]');
    if (scanBtn) scanBtn.addEventListener('click', () => this._scanEntities());

    // Scan lovelace
    const scanLov = sr.querySelector('[data-action="scan-lovelace"]');
    if (scanLov) scanLov.addEventListener('click', () => this._scanLovelace());

    // Config check (built-in, zero setup)
    const checkConfig = sr.querySelector('[data-action="check-config"]');
    if (checkConfig) checkConfig.addEventListener('click', () => this._checkConfig());

    // API scan (zero-config, HACS-friendly) -- primary path for mojibake in automations/scripts/scenes
    const scanApi = sr.querySelector('[data-action="scan-api"]');
    if (scanApi) scanApi.addEventListener('click', () => this._scanViaApi());

    // Deep YAML scan (optional, requires shell_command setup)
    const scanDeep = sr.querySelector('[data-action="scan-yaml-deep"]');
    if (scanDeep) scanDeep.addEventListener('click', () => this._scanYamlDeep());

    // Fix individual YAML file
    sr.querySelectorAll('[data-fix-yaml]').forEach(btn => {
      btn.addEventListener('click', () => this._fixYamlFile(parseInt(btn.dataset.fixYaml)));
    });

    // Fix all YAML
    const fixYamlAll = sr.querySelector('[data-action="fix-yaml-all"]');
    if (fixYamlAll) fixYamlAll.addEventListener('click', () => this._fixYamlAll());

    // Restore tab handlers
    const scanRestore = sr.querySelector('[data-action="scan-restore"]');
    if (scanRestore) scanRestore.addEventListener('click', () => this._scanForMissingResources());
    const createSnapshot = sr.querySelector('[data-action="create-snapshot"]');
    if (createSnapshot) createSnapshot.addEventListener('click', () => this._createResourceSnapshot());
    const restoreSelected = sr.querySelector('[data-action="restore-selected"]');
    if (restoreSelected) restoreSelected.addEventListener('click', () => this._restoreResources([...this._restoreSelectedIds]));
    const restoreAllBtn = sr.querySelector('[data-action="restore-all"]');
    if (restoreAllBtn) restoreAllBtn.addEventListener('click', () => this._restoreResources(this._restoreMissing.map((_, i) => i)));
    sr.querySelectorAll('[data-restore-select]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.restoreSelect);
        if (e.target.checked) this._restoreSelectedIds.add(idx);
        else this._restoreSelectedIds.delete(idx);
        this._updateUI();
      });
    });
    // Source toggle
    const srcSnap = sr.querySelector('[data-action="restore-src-snapshot"]');
    if (srcSnap) srcSnap.addEventListener('click', () => { this._restoreSource = 'snapshot'; this._restoreStep = 1; this._restorePreview = null; this._updateUI(); });
    const srcLive = sr.querySelector('[data-action="restore-src-live"]');
    if (srcLive) srcLive.addEventListener('click', () => { this._restoreSource = 'live'; this._restoreStep = 1; this._restorePreview = null; this._updateUI(); });
    // File picker
    sr.querySelectorAll('[data-pick-file]').forEach(row => {
      row.addEventListener('click', () => {
        this._restoreFilePick = row.dataset.pickFile;
        this._restoreStep = 1;
        this._restorePreview = null;
        this._updateUI();
      });
    });
    // Live scan
    const scanRestoreLive = sr.querySelector('[data-action="scan-restore-live"]');
    if (scanRestoreLive) scanRestoreLive.addEventListener('click', () => this._scanRestoreLive());
    // Live apply
    const applyLive = sr.querySelector('[data-action="restore-live-apply"]');
    if (applyLive) applyLive.addEventListener('click', () => {
      if (confirm(this._lang === 'pl' ? 'Zastosowa\u0107 wszystkie poprawki? Wymagany restart HA.' : 'Apply all fixes? HA restart required.')) {
        this._showToast(this._lang === 'pl' ? 'Zastosowano. Zrestartuj HA.' : 'Applied. Restart HA.', 'success');
        this._restorePreview = null; this._restoreStep = 1; this._updateUI();
      }
    });

    // Test input
    const testInput = sr.querySelector('.test-input');
    if (testInput) {
      testInput.addEventListener('input', (e) => {
        const result = this._testDecode(e.target.value);
        const resultEl = sr.querySelector('.test-result');
        if (!resultEl) return;
        const t = this._t;
        if (!e.target.value) {
          resultEl.innerHTML = '';
        } else if (result && result.fixed !== result.original) {
          resultEl.innerHTML = `<div class="test-found">\u26A0\uFE0F ${t.mojibakeFound}:<br><strong>${this._escapeHtml(result.fixed)}</strong><br><small>${this._escapeHtml(result.method)}</small></div>`;
        } else {
          resultEl.innerHTML = `<div class="test-ok">\u2705 ${t.noMojibake}</div>`;
        }
      });
    }

    // "Back to list" after batch-fix completion
    const fixBack = sr.querySelector('[data-action="fix-back"]');
    if (fixBack) fixBack.addEventListener('click', () => this._fixBackToList());

    // Fix lovelace
    sr.querySelectorAll('[data-fix-lovelace]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.fixLovelace);
        const issue = this._lovelaceIssues[idx];
        if (issue) this._fixLovelaceResource(issue);
      });
    });

    // Select/deselect checkboxes
    sr.querySelectorAll('[data-select]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.select);
        const item = this._scanResults[idx];
        if (item) {
          if (e.target.checked) this._selectedIssues.add(item.entity_id);
          else this._selectedIssues.delete(item.entity_id);
          this._updateUI();
        }
      });
    });

    // Select all / deselect all
    const selectAll = sr.querySelector('[data-action="select-all"]');
    if (selectAll) {
      selectAll.addEventListener('click', () => {
        this._scanResults.forEach(r => this._selectedIssues.add(r.entity_id));
        this._updateUI();
      });
    }
    const deselectAll = sr.querySelector('[data-action="deselect-all"]');
    if (deselectAll) {
      deselectAll.addEventListener('click', () => {
        this._selectedIssues.clear();
        this._updateUI();
      });
    }

    // Fix selected / fix all
    const fixSelected = sr.querySelector('[data-action="fix-selected"]');
    if (fixSelected) fixSelected.addEventListener('click', () => this._fixSelectedEntities());
    const fixAll = sr.querySelector('[data-action="fix-all"]');
    if (fixAll) fixAll.addEventListener('click', () => this._fixAllEntities());
  }

  // --- File scan helpers ---
  _hasShellCommand(cmd) {
    return !!(this._hass?.services?.shell_command?.[cmd]);
  }

  // --- Deep walk helpers (used by zero-config API scan/fix) ---
  _deepDetectMojibake(value, samples, pathArr) {
    pathArr = pathArr || [];
    samples = samples || [];
    let count = 0;
    if (typeof value === 'string') {
      const det = this._detectMojibake(value);
      if (det && det.fixed !== value && det.method !== 'suspicious') {
        count = 1;
        if (samples.length < 3) {
          samples.push({
            path: pathArr.join('.') || '(root)',
            before: value.length > 80 ? value.slice(0, 80) + '\u2026' : value,
            after: det.fixed.length > 80 ? det.fixed.slice(0, 80) + '\u2026' : det.fixed
          });
        }
      }
      return { count, samples };
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const r = this._deepDetectMojibake(value[i], samples, pathArr.concat([i]));
        count += r.count;
      }
      return { count, samples };
    }
    if (value && typeof value === 'object') {
      for (const k of Object.keys(value)) {
        const r = this._deepDetectMojibake(value[k], samples, pathArr.concat([k]));
        count += r.count;
      }
      return { count, samples };
    }
    return { count, samples };
  }

  _deepFixStrings(value, stats) {
    if (typeof value === 'string') {
      const det = this._detectMojibake(value);
      if (det && det.fixed !== value && det.method !== 'suspicious') {
        stats.fixed++;
        return det.fixed;
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(v => this._deepFixStrings(v, stats));
    }
    if (value && typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value)) {
        out[k] = this._deepFixStrings(value[k], stats);
      }
      return out;
    }
    return value;
  }

  // --- Zero-config scan via HA REST config API ---
  // Works out-of-the-box after HACS install. Covers automations.yaml, scripts.yaml, scenes.yaml.
  async _scanViaApi() {
    if (!this._hass || this._yamlScanning) return;
    this._yamlScanning = true;
    this._yamlResults = null;
    this._restoreScanning = false;
    this._restoreMissing = [];
    this._restoreBackupInfo = null;
    this._restoreSelectedIds = new Set();
    this._updateUI();

    const domains = [
      { domain: 'automation', file: 'automations.yaml' },
      { domain: 'script',     file: 'scripts.yaml' },
      { domain: 'scene',      file: 'scenes.yaml' }
    ];

    const issues = [];
    let scanned = 0;
    let skipped = 0;
    let errors = 0;

    try {
      for (const d of domains) {
        const entities = Object.values(this._hass.states || {}).filter(s => s.entity_id.startsWith(d.domain + '.'));
        for (const st of entities) {
          let objectId;
          if (d.domain === 'automation') {
            objectId = st.attributes && st.attributes.id;
            if (!objectId) { skipped++; continue; }
          } else {
            objectId = st.entity_id.split('.')[1];
          }
          scanned++;
          try {
            const cfg = await this._hass.callApi('GET', 'config/' + d.domain + '/config/' + objectId);
            const { count, samples } = this._deepDetectMojibake(cfg, [], []);
            if (count > 0) {
              const alias = (cfg && (cfg.alias || cfg.name)) || st.entity_id;
              const ctx = samples.map(s => s.path + ': ' + s.before + ' \u2192 ' + s.after).join(' | ');
              issues.push({
                file: d.file,
                line: 0,
                issue: 'mojibake',
                detail: count + ' string(s) in "' + alias + '"',
                context: ctx,
                fixable: true,
                via: 'api',
                domain: d.domain,
                object_id: String(objectId),
                entity_id: st.entity_id,
                alias: alias,
                mojibake_count: count
              });
            }
          } catch (e) {
            errors++;
            console.warn('[Encoding Fixer] API scan ' + d.domain + '/' + objectId + ':', e);
          }
        }
      }

      this._yamlResults = {
        timestamp: Math.floor(Date.now() / 1000),
        mode: 'api_scan',
        scanned_files: scanned,
        skipped_files: skipped,
        total_issues: issues.length,
        fixed_files: 0,
        issues: issues
      };
      if (errors) this._yamlResults.warning = errors + ' entries failed to fetch';
    } catch (e) {
      console.warn('[Encoding Fixer] API scan error:', e);
      this._yamlResults = { error: e.message, scanned_files: scanned, total_issues: 0, issues: [] };
    }

    this._yamlScanning = false;
    this._updateUI();
  }

  // Fix one API-scanned issue: GET config -> deep-replace -> POST back -> reload domain
  async _fixConfigIssueByIdx(idx) {
    if (!this._hass || !this._yamlResults) return;
    const issue = this._yamlResults.issues[idx];
    if (!issue || issue.via !== 'api') return;
    const t = this._t;
    try {
      const cfg = await this._hass.callApi('GET', 'config/' + issue.domain + '/config/' + issue.object_id);
      const stats = { fixed: 0 };
      const fixed = this._deepFixStrings(cfg, stats);
      if (stats.fixed === 0) {
        this._showToast(issue.file + ': nothing to fix', 'info');
        return;
      }
      await this._hass.callApi('POST', 'config/' + issue.domain + '/config/' + issue.object_id, fixed);
      try { await this._hass.callService(issue.domain, 'reload', {}); } catch(e) { /* soft */ }
      this._showToast(t.yamlFixSuccess + ': ' + issue.file + ' (' + stats.fixed + ')', 'success');
      this._addFixLog('yaml', issue.file + ':' + issue.entity_id, 'success', stats.fixed + ' strings');
      await this._scanViaApi();
    } catch (e) {
      console.warn('[Encoding Fixer] API fix error:', e);
      this._showToast(t.yamlFixError + ': ' + e.message, 'error');
      this._addFixLog('yaml', issue.file + ':' + issue.entity_id, 'failed', e.message);
    }
  }

  // Fix all API-scanned issues in a single batch, then reload touched domains
  async _fixAllConfigIssues() {
    if (!this._hass || !this._yamlResults) return;
    const t = this._t;
    const issues = (this._yamlResults.issues || []).filter(i => i.via === 'api' && i.fixable);
    if (issues.length === 0) return;

    const reloadDomains = new Set();
    let ok = 0, fail = 0, totalStrings = 0;
    for (const issue of issues) {
      try {
        const cfg = await this._hass.callApi('GET', 'config/' + issue.domain + '/config/' + issue.object_id);
        const stats = { fixed: 0 };
        const fixed = this._deepFixStrings(cfg, stats);
        if (stats.fixed > 0) {
          await this._hass.callApi('POST', 'config/' + issue.domain + '/config/' + issue.object_id, fixed);
          totalStrings += stats.fixed;
          reloadDomains.add(issue.domain);
          ok++;
          this._addFixLog('yaml', issue.file + ':' + issue.entity_id, 'success', stats.fixed + ' strings');
        }
      } catch (e) {
        fail++;
        console.warn('[Encoding Fixer] batch fix error:', e);
        this._addFixLog('yaml', issue.file + ':' + issue.entity_id, 'failed', e.message);
      }
    }
    for (const dom of reloadDomains) {
      try { await this._hass.callService(dom, 'reload', {}); } catch(e) { /* soft */ }
    }
    const kind = fail ? 'warning' : 'success';
    this._showToast(t.yamlFixSuccess + ': ' + ok + ' file(s), ' + totalStrings + ' string(s)' + (fail ? ', ' + fail + ' failed' : ''), kind);
    await this._scanViaApi();
  }

  // --- Config check (built-in, zero setup) ---
  async _checkConfig() {
    if (!this._hass || this._yamlScanning) return;
    this._yamlScanning = true;
    this._yamlResults = null;
    this._restoreScanning = false;
    this._restoreMissing = [];
    this._restoreBackupInfo = null;
    this._restoreSelectedIds = new Set();
    this._updateUI();

    try {
      const result = await this._hass.callApi('POST', 'config/core/check_config');
      const issues = [];
      if (result.result === 'invalid') {
        issues.push({
          file: 'configuration.yaml',
          line: 0,
          issue: 'config_error',
          detail: result.errors || 'Invalid configuration',
          fixable: false
        });
      }
      this._yamlResults = {
        timestamp: Math.floor(Date.now() / 1000),
        mode: 'config_check',
        scanned_files: 1,
        total_issues: issues.length,
        fixed_files: 0,
        issues: issues
      };
    } catch(e) {
      console.warn('[Encoding Fixer] Config check error:', e);
      this._yamlResults = { error: e.message, scanned_files: 0, total_issues: 0, issues: [] };
    }

    this._yamlScanning = false;
    this._updateUI();
  }

  // --- Deep file scan (requires shell_command setup) ---
  async _fixYamlFile(idx) {
    if (!this._hass || !this._yamlResults) return;
    const issue = this._yamlResults.issues[idx];
    if (!issue || (issue.issue !== 'bom' && issue.issue !== 'mojibake')) return;

    // Dispatch: API-based issue (zero-config) vs. shell_command-based issue
    if (issue.via === 'api') {
      return this._fixConfigIssueByIdx(idx);
    }

    if (!this._hasShellCommand('fix_encoding')) return;
    const t = this._t;
    try {
      await this._hass.callService('shell_command', 'fix_encoding', {});
      await new Promise(r => setTimeout(r, 2000));
      this._showToast(t.yamlFixSuccess + ': ' + issue.file, 'success');
      this._addFixLog('yaml', issue.file, 'success', issue.issue);
      await this._scanYamlDeep();
    } catch(e) {
      console.warn('[Encoding Fixer] Fix error:', e);
      this._showToast(t.yamlFixError + ': ' + issue.file, 'error');
      this._addFixLog('yaml', issue.file, 'failed', e.message);
    }
  }

  async _fixYamlAll() {
    if (!this._hass || !this._yamlResults) return;
    const t = this._t;

    // Dispatch: API-based issues (zero-config) vs. shell_command-based
    const apiIssues = (this._yamlResults.issues || []).filter(i => i.via === 'api' && i.fixable);
    if (apiIssues.length > 0) {
      return this._fixAllConfigIssues();
    }

    if (!this._hasShellCommand('fix_encoding')) return;
    try {
      await this._hass.callService('shell_command', 'fix_encoding', {});
      await new Promise(r => setTimeout(r, 3000));
      this._showToast(t.yamlFixSuccess, 'success');
      this._addFixLog('yaml', 'all fixable files', 'success', 'batch fix');
      await this._scanYamlDeep();
    } catch(e) {
      console.warn('[Encoding Fixer] Fix all error:', e);
      this._showToast(t.yamlFixError, 'error');
    }
  }

  async _scanYamlDeep() {
    if (!this._hass || this._yamlScanning) return;
    if (!this._hasShellCommand('scan_encoding')) {
      // Fall back to config check
      return this._checkConfig();
    }
    this._yamlScanning = true;
    this._yamlResults = null;
    this._restoreScanning = false;
    this._restoreMissing = [];
    this._restoreBackupInfo = null;
    this._restoreSelectedIds = new Set();
    this._updateUI();

    try {
      await this._hass.callService('shell_command', 'scan_encoding', {});
      await new Promise(r => setTimeout(r, 3000));
      const resp = await fetch('/local/encoding_scan_result.json?_=' + Date.now());
      if (resp.ok) {
        this._yamlResults = await resp.json();
      } else {
        throw new Error('HTTP ' + resp.status);
      }
    } catch(e) {
      console.warn('[Encoding Fixer] Deep scan error:', e);
      this._yamlResults = { error: e.message, scanned_files: 0, total_issues: 0, issues: [] };
    }

    this._yamlScanning = false;
    this._updateUI();
  }


  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // Corrupted Resources Recovery
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  _buildRestoreTab() {
    const t = this._t;
    const isLive = this._restoreSource === 'live';

    // Source toggle
    const KNOWN_PATHS = [
      '.storage/lovelace',
      '.storage/lovelace_resources',
      '.storage/lovelace.lovelace_yaml',
    ];
    const sourceToggle = `
      <div class="restore-source-row">
        <span class="restore-source-label">${this._lang === 'pl' ? '\u0179r\u00F3d\u0142o' : 'Source'}:</span>
        <button class="btn btn-sm ${!isLive ? 'btn-primary' : 'btn-secondary'}" data-action="restore-src-snapshot">Snapshot</button>
        <button class="btn btn-sm ${isLive ? 'btn-primary' : 'btn-secondary'}" data-action="restore-src-live">Live .storage</button>
      </div>
      ${isLive ? `<div class="restore-live-warn">\u26A0\uFE0F ${this._lang === 'pl' ? 'Edycja plik\u00F3w live wymaga restartu HA' : 'Editing live files requires HA restart'}</div>` : ''}
    `;

    // File picker (for live mode)
    const filePicker = isLive ? `
      <div class="section">
        <h3>\uD83D\uDCC2 ${this._lang === 'pl' ? 'Wybierz plik .storage' : 'Select .storage file'}</h3>
        <div class="file-picker-list">
          ${KNOWN_PATHS.map(p => `
            <div class="file-picker-row ${this._restoreFilePick === p ? 'file-picker-selected' : ''}" data-pick-file="${this._escapeHtml(p)}">
              <span class="file-picker-icon">\uD83D\uDCC4</span>
              <span class="file-picker-path">${this._escapeHtml(p)}</span>
            </div>`).join('')}
        </div>
        <p class="section-desc" style="margin-top:8px">${this._lang === 'pl' ? 'Uwaga: bezpo\u015Bredni odczyt plik\u00F3w .storage wymaga wsparcia supervisor API.' : 'Note: direct .storage file read requires supervisor API support.'}</p>
      </div>
    ` : '';

    // Step indicator (3-step flow for live mode)
    const step = this._restoreStep || 1;
    const stepBar = isLive ? `
      <div class="restore-steps">
        <div class="restore-step ${step >= 1 ? 'step-active' : ''}"><span class="step-num">1</span><span class="step-label">${this._lang === 'pl' ? 'Wybierz plik' : 'Select file'}</span></div>
        <div class="step-sep"></div>
        <div class="restore-step ${step >= 2 ? 'step-active' : ''}"><span class="step-num">2</span><span class="step-label">Preview</span></div>
        <div class="step-sep"></div>
        <div class="restore-step ${step >= 3 ? 'step-active' : ''}"><span class="step-num">3</span><span class="step-label">${this._lang === 'pl' ? 'Zastosuj' : 'Apply'}</span></div>
      </div>
    ` : '';

    let scanStatus = '';
    if (this._restoreScanning) {
      scanStatus = `<div class="scan-progress"><div class="spinner-small"></div> ${t.restoreScanning}</div>`;
    }

    // Backup info
    let backupInfo = '';
    if (this._restoreBackupInfo) {
      const bi = this._restoreBackupInfo;
      backupInfo = `
        <div class="restore-info">
          <div class="restore-stat"><span class="stat-label">${t.currentCount}:</span> <span class="stat-value">${bi.currentCount}</span></div>
          <div class="restore-stat"><span class="stat-label">${t.backupCount}:</span> <span class="stat-value">${bi.backupCount}</span></div>
          ${bi.backupDate ? `<div class="restore-stat"><span class="stat-label">${t.backupDate}:</span> <span class="stat-value">${bi.backupDate}</span></div>` : ''}
          ${bi.currentCount < bi.backupCount ? `<div class="restore-warning">${t.corruptionWarning} ${bi.backupCount - bi.currentCount} ${t.restoreMissing}</div>` : ''}
        </div>`;
    }

    // Preview (step 2 for live mode)
    let previewHtml = '';
    if (isLive && this._restorePreview) {
      const items = this._restorePreview;
      previewHtml = `
        <div class="section">
          <h3>\uD83D\uDD0D Preview</h3>
          <div class="yaml-list">
            ${items.map((item, i) => `<div class="yaml-row">
              <div class="yaml-file">${this._escapeHtml(item.path)}</div>
              <div class="yaml-issue issue-bom">${this._escapeHtml(item.issue)}</div>
              <div class="yaml-detail">${this._escapeHtml(item.detail)}</div>
            </div>`).join('')}
          </div>
          <div style="margin-top:12px">
            <button class="btn btn-danger" data-action="restore-live-apply">${this._lang === 'pl' ? 'Zastosuj poprawki' : 'Apply fixes'}</button>
          </div>
        </div>`;
    }

    // Missing resources list
    let missingHtml = '';
    if (this._restoreMissing.length > 0) {
      const rows = this._restoreMissing.map((m, i) => {
        const selected = this._restoreSelectedIds.has(i);
        return `<div class="result-row restore-row">
          <label class="result-check"><input type="checkbox" data-restore-select="${i}" ${selected ? 'checked' : ''} /></label>
          <div class="restore-url">${this._escapeHtml(m.url)}</div>
          <div class="restore-type">${m.type || 'module'}</div>
        </div>`;
      }).join('');

      missingHtml = `
        <div class="section">
          <div class="results-header">
            <h3>${this._restoreMissing.length} ${t.restoreMissing}</h3>
            <div class="results-actions">
              <button class="btn btn-sm btn-primary" data-action="restore-selected" ${this._restoreSelectedIds.size === 0 ? 'disabled' : ''}>${t.restoreSelected} (${this._restoreSelectedIds.size})</button>
              <button class="btn btn-sm btn-danger" data-action="restore-all">${t.restoreAll}</button>
            </div>
          </div>
          <div class="results-list">${rows}</div>
        </div>`;
    } else if (this._restoreBackupInfo && this._restoreMissing.length === 0 && !this._restoreScanning) {
      missingHtml = `<div class="section"><div class="empty-state">\u2705 ${t.restoreOk}</div></div>`;
    }

    return `
      <div class="section">
        <h3>${t.restoreTitle}</h3>
        <p class="section-desc">${t.restoreDesc}</p>
        ${sourceToggle}
        ${stepBar}
        ${!isLive ? `<div class="scan-header" style="margin-top:12px">
          <button class="btn btn-primary" data-action="scan-restore" ${this._restoreScanning ? 'disabled' : ''}>${t.scanRestore}</button>
          <button class="btn btn-secondary" data-action="create-snapshot">${t.createSnapshot}</button>
        </div>` : ''}
        ${isLive && this._restoreFilePick ? `<div class="scan-header" style="margin-top:12px">
          <button class="btn btn-primary" data-action="scan-restore-live" ${this._restoreScanning ? 'disabled' : ''}>${this._lang === 'pl' ? 'Skanuj plik' : 'Scan file'}</button>
        </div>` : ''}
        ${scanStatus}
      </div>
      ${filePicker}
      ${backupInfo}
      ${previewHtml}
      ${missingHtml}
    `;
  }

  async _scanForMissingResources() {
    if (!this._hass || this._restoreScanning) return;
    this._restoreScanning = true;
    this._restoreMissing = [];
    this._restoreBackupInfo = null;
    this._restoreSelectedIds = new Set();
    this._updateUI();

    try {
      // 1. Get current resources from HA
      const current = await this._hass.callWS({ type: 'lovelace/resources' });
      const currentUrls = new Set(current.map(r => (r.url || '').split('?')[0]));

      // 2. Load backup snapshot from server persistence
      let backup = null;
      if (window._haToolsPersistence) {
        window._haToolsPersistence.setHass(this._hass);
        backup = await window._haToolsPersistence.load('encoding-fixer-resource-snapshot');
      }
      // Fallback to localStorage
      if (!backup) {
        try {
          const raw = localStorage.getItem('ha-tools-encoding-fixer-resource-snapshot');
          if (raw) backup = JSON.parse(raw);
        } catch(e) { console.debug('[ha-encoding-fixer] caught:', e); }
      }

      if (!backup || !backup.items || backup.items.length === 0) {
        this._restoreBackupInfo = null;
        this._restoreScanning = false;
        this._showToast(this._t.noBackup, 'warn');
        this._updateUI();
        return;
      }

      // 3. Compare
      const missing = [];
      for (const item of backup.items) {
        const baseUrl = (item.url || '').split('?')[0];
        if (!currentUrls.has(baseUrl)) {
          missing.push({ url: baseUrl, type: item.type || 'module' });
        }
      }

      const backupDate = backup.timestamp ? new Date(backup.timestamp).toLocaleString() : null;
      this._restoreBackupInfo = {
        currentCount: current.length,
        backupCount: backup.items.length,
        backupDate: backupDate
      };
      this._restoreMissing = missing;

    } catch(e) {
      console.warn('[Encoding Fixer] Restore scan error:', e);
      this._showToast(this._t.errorFixing + ': ' + e.message, 'error');
    }

    this._restoreScanning = false;
    this._updateUI();
  }

  async _createResourceSnapshot() {
    if (!this._hass) return;
    try {
      const resources = await this._hass.callWS({ type: 'lovelace/resources' });
      const snapshot = {
        timestamp: Date.now(),
        items: resources.map(r => ({ url: r.url, type: r.type, id: r.id }))
      };
      // Save to both localStorage and server
      try { localStorage.setItem('ha-tools-encoding-fixer-resource-snapshot', JSON.stringify(snapshot)); } catch(e) { console.debug('[ha-encoding-fixer] caught:', e); }
      if (window._haToolsPersistence) {
        window._haToolsPersistence.setHass(this._hass);
        await window._haToolsPersistence.save('encoding-fixer-resource-snapshot', snapshot);
      }
      this._showToast(this._t.snapshotCreated + ' (' + resources.length + ' resources)', 'success');
      this._addFixLog('snapshot', 'resources', 'success', resources.length + ' items');
    } catch(e) {
      console.warn('[Encoding Fixer] Snapshot error:', e);
      this._showToast(this._t.errorFixing, 'error');
    }
  }

  async _scanRestoreLive() {
    if (!this._hass || !this._restoreFilePick || this._restoreScanning) return;
    this._restoreScanning = true;
    this._restorePreview = null;
    this._updateUI();
    const path = this._restoreFilePick;
    const issues = [];
    try {
      // Attempt to read via supervisor API
      const resp = await this._hass.callWS({ type: 'supervisor/api', endpoint: '/core/api/config/core/check_config', method: 'post' }).catch(() => null);
      // Try to fetch raw content - not always available. Skip fetch if no auth token to avoid 401 noise.
      const token = this._hass?.auth?.data?.access_token || this._hass?.auth?.accessToken || null;
      const fetchResp = token
        ? await fetch('/api/config', { headers: { Authorization: 'Bearer ' + token } }).catch(() => null)
        : null;
      if (fetchResp && fetchResp.ok) {
        const txt = await fetchResp.text().catch(() => '');
        if (this._hasBOM(txt)) issues.push({ path, issue: 'BOM', detail: 'Byte Order Mark detected at file start' });
        const mojibake = this._detectMojibake(txt);
        if (mojibake && !mojibake.uncertain) issues.push({ path, issue: 'Mojibake', detail: mojibake.original.slice(0, 40) + ' \u2192 ' + mojibake.fixed.slice(0, 40) });
      }
      if (!issues.length) {
        issues.push({ path, issue: this._lang === 'pl' ? 'Brak problem\u00F3w' : 'No issues found', detail: this._lang === 'pl' ? 'Plik wygl\u0105da poprawnie lub niedost\u0119pny przez API' : 'File looks clean or not accessible via API' });
      }
    } catch(e) {
      issues.push({ path, issue: 'API Error', detail: e.message });
    }
    this._restorePreview = issues;
    this._restoreStep = 2;
    this._restoreScanning = false;
    this._updateUI();
  }

  async _restoreResources(indices) {
    if (!this._hass) return;
    const toRestore = indices.map(i => this._restoreMissing[i]).filter(Boolean);
    if (!toRestore.length) return;

    const confirmMsg = this._lang === 'pl'
      ? 'Przywrocic ' + toRestore.length + ' zasobow?\nPo przywroceniu zalecany restart HA.'
      : 'Restore ' + toRestore.length + ' resources?\nHA restart recommended after restore.';
    if (!confirm(confirmMsg)) return;

    this._createBackup('restore-pre', toRestore);
    let restored = 0;
    for (const item of toRestore) {
      try {
        await this._hass.callWS({
          type: 'lovelace/resources/create',
          res_type: item.type || 'module',
          url: item.url
        });
        this._addFixLog('restore', item.url, 'success', '');
        restored++;
      } catch(e) {
        this._addFixLog('restore', item.url, 'failed', e.message);
      }
    }

    // Re-scan
    await this._scanForMissingResources();
    // Update snapshot with new state
    await this._createResourceSnapshot();

    this._showToast(this._t.restoreDone + ' (' + restored + '/' + toRestore.length + ')', 'success');
  }


    _buildYamlTab() {
    const t = this._t;
    const hasDeepScan = this._hasShellCommand('scan_encoding');
    const hasDeepFix = this._hasShellCommand('fix_encoding');

    let scanStatus = '';
    if (this._yamlScanning) {
      scanStatus = `<div class="scan-progress"><div class="spinner-small"></div> ${t.yamlScanning}</div>`;
    }

    let resultsHtml = '';
    if (!this._yamlScanning && this._yamlResults) {
      if (this._yamlResults.error) {
        resultsHtml = `<div class="section"><div class="empty-state" style="color:var(--bento-error)">\u26A0\uFE0F ${t.yamlRunError}<br><small>${this._escapeHtml(this._yamlResults.error)}</small></div></div>`;
      } else if (!this._yamlResults.issues || this._yamlResults.total_issues === 0) {
        const okMsg = this._yamlResults.mode === 'api_scan' ? t.apiNoIssues : t.yamlOk;
        const skipped = this._yamlResults.skipped_files ? ` (${t.apiSkipped}: ${this._yamlResults.skipped_files})` : '';
        resultsHtml = `<div class="section"><div class="empty-state">\u2705 ${okMsg}<br><small>${t.yamlScannedFiles}: ${this._yamlResults.scanned_files}${skipped}</small></div></div>`;
      } else {
        const fixableIssues = this._yamlResults.issues.filter(i => i.fixable);
        const rows = this._yamlResults.issues.map((issue, idx) => {
          const issueLabel = {
            'bom': 'BOM',
            'mojibake': 'Mojibake',
            'invalid_utf8': 'Invalid UTF-8',
            'null_byte': 'Null byte',
            'read_error': 'Read error',
            'config_error': 'Config error'
          }[issue.issue] || issue.issue;
          const issueClass = issue.issue === 'bom' || issue.issue === 'mojibake' ? 'issue-bom' : 'issue-broken_url';
          // Use per-issue fixable flag (set at scan time) instead of re-checking shell_command
          const fixable = issue.fixable === true || ((issue.issue === 'bom' || issue.issue === 'mojibake') && hasDeepFix);
          const location = issue.entity_id ? (issue.entity_id) : (issue.line > 0 ? ':' + issue.line : '');
          return `<div class="yaml-row">
            <div class="yaml-file">${this._escapeHtml(issue.file)}</div>
            <div class="yaml-line">${this._escapeHtml(location)}</div>
            <div class="yaml-issue ${issueClass}">${issueLabel}${issue.mojibake_count ? ' \u00D7' + issue.mojibake_count : ''}</div>
            <div class="yaml-detail">${this._escapeHtml(issue.detail || '')}</div>
            ${issue.context ? `<div class="yaml-context"><code>${this._escapeHtml(issue.context)}</code></div>` : ''}
            ${fixable ? `<button class="btn btn-sm btn-primary" data-fix-yaml="${idx}">${t.fixYamlFile}</button>` : ''}
          </div>`;
        }).join('');

        resultsHtml = `
          <div class="section">
            <div class="results-header">
              <h3>${this._yamlResults.total_issues} ${t.yamlIssuesFound}</h3>
              ${fixableIssues.length > 0 ? `<button class="btn btn-sm btn-danger" data-action="fix-yaml-all">${t.fixYamlAll} (${fixableIssues.length})</button>` : ''}
            </div>
            <small style="color:var(--bento-text-secondary)">${t.yamlScannedFiles}: ${this._yamlResults.scanned_files}</small>
            <div class="yaml-list" style="margin-top:12px">${rows}</div>
          </div>`;
      }
    }

    // Optional advanced scan setup (shell_command path) -- only shown as informational
    const setupGuide = !hasDeepScan ? `
      <div class="section info-section">
        <h3>\uD83D\uDD27 ${t.advancedScan}</h3>
        <p style="font-size:13px;color:var(--bento-text-secondary);margin-bottom:12px;">
          ${t.advancedScanDesc}
        </p>
        <div class="setup-code"><code>shell_command:
  scan_encoding: "python3 /config/python_scripts/encoding_scanner.py scan"
  fix_encoding: "python3 /config/python_scripts/encoding_scanner.py fix"</code></div>
        <p style="font-size:12px;color:var(--bento-text-secondary);margin-top:8px;">
          ${this._lang === 'pl'
            ? 'Skrypt <code>encoding_scanner.py</code> jest dolaczony w repozytorium ha-tools. Skopiuj go do <code>/config/python_scripts/</code> i zrestartuj HA.'
            : 'The <code>encoding_scanner.py</code> script is included in the ha-tools repository. Copy it to <code>/config/python_scripts/</code> and restart HA.'}
        </p>
      </div>
    ` : '';

    return `
      <div class="section">
        <div class="scan-header">
          <h3>${t.yamlTitle}</h3>
          <div class="scan-buttons">
            <button class="btn btn-primary" data-action="scan-api" ${this._yamlScanning ? 'disabled' : ''}>
              ${t.scanApi}
            </button>
            <button class="btn btn-secondary" data-action="check-config" ${this._yamlScanning ? 'disabled' : ''}>
              ${this._lang === 'pl' ? 'Sprawdz config' : 'Check config'}
            </button>
            ${hasDeepScan ? `<button class="btn btn-secondary" data-action="scan-yaml-deep" ${this._yamlScanning ? 'disabled' : ''}>
              ${this._lang === 'pl' ? 'Pelny skan BOM/mojibake' : 'Full BOM/mojibake scan'}
            </button>` : ''}
          </div>
        </div>
        <p class="section-desc">${t.apiScope}</p>
        ${scanStatus}
      </div>
      ${resultsHtml}
      ${setupGuide}
    `;
  }

  _getCSS() {
    return `
* { box-sizing: border-box; margin: 0; padding: 0; }

.card {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  color: var(--bento-text);
  box-sizing: border-box;
  overflow: hidden;
  background: var(--bento-card) !important;
  border: 1px solid var(--bento-border) !important;
  border-radius: var(--bento-radius-md) !important;
  box-shadow: var(--bento-shadow-sm);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: var(--bento-card);
  border-radius: var(--bento-radius-sm);
  box-shadow: var(--bento-shadow-sm);
  border: 1px solid var(--bento-border);
}

.header-left { display: flex; align-items: center; gap: 10px; }
.header-icon { font-size: 24px; }
.header h2 { font-size: 18px; font-weight: 600; color: var(--bento-text); }

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: var(--bento-card);
  padding: 4px;
  border-radius: var(--bento-radius-sm);
  border: 1px solid var(--bento-border);
  overflow-x: auto;
  flex-wrap: nowrap;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--bento-border) transparent;
}

.tabs::-webkit-scrollbar {
  height: 4px;
}

.tabs::-webkit-scrollbar-track {
  background: transparent;
}

.tabs::-webkit-scrollbar-thumb {
  background: var(--bento-border);
  border-radius: 4px;
}

.tab-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--bento-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: var(--bento-radius-xs);
  transition: var(--bento-transition);
}

.tab-btn:hover { background: rgba(59,130,246,0.06); color: var(--bento-text); }
.tab-btn.active { background: var(--bento-primary); color: #fff; }

.section {
  background: var(--bento-card);
  border-radius: var(--bento-radius-sm);
  padding: 16px 20px;
  margin-bottom: 12px;
  box-shadow: var(--bento-shadow-sm);
  border: 1px solid var(--bento-border);
}

.section h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--bento-text); }
.section-desc { font-size: 13px; color: var(--bento-text-secondary); margin-bottom: 12px; margin-top: 8px; }

.scan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.scan-header h3 { margin-bottom: 0; }

.scan-buttons { display: flex; gap: 6px; flex-wrap: wrap; }

.setup-code {
  padding: 12px;
  background: var(--bento-bg);
  border-radius: var(--bento-radius-xs);
  border: 1px solid var(--bento-border);
  overflow-x: auto;
  box-sizing: border-box;
  max-width: 100%;
}

.setup-code code {
  font-size: 12px;
  white-space: pre;
  color: var(--bento-text);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  display: block;
  max-width: 100%;
}

/* Buttons */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: var(--bento-radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--bento-transition);
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 6px 12px; font-size: 12px; border-radius: var(--bento-radius-xs); }
.btn-primary { background: var(--bento-primary); color: #fff; }
.btn-primary:hover { background: var(--bento-primary-hover); }
.btn-secondary { background: var(--bento-bg); color: var(--bento-text); border: 1px solid var(--bento-border); }
.btn-danger { background: var(--bento-error); color: #fff; }

/* Progress */
.scan-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bento-border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--bento-primary);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text { font-size: 12px; color: var(--bento-text-secondary); white-space: nowrap; }

.restore-info { background: var(--bento-card); border-radius: 8px; padding: 12px 16px; margin: 12px 0; display: flex; flex-wrap: wrap; gap: 12px 24px; }
.restore-stat { display: flex; gap: 6px; }
.stat-label { color: var(--bento-text-secondary); font-size: 13px; }
.stat-value { font-weight: 600; font-size: 13px; }
.restore-warning { width: 100%; background: rgba(239,68,68,0.1); color: var(--bento-error, #ef4444); padding: 8px 12px; border-radius: 6px; font-weight: 600; font-size: 13px; margin-top: 4px; }
.restore-url { flex: 1; min-width: 0; font-family: monospace; font-size: 12px; word-wrap: break-word; overflow-wrap: break-word; }
.restore-type { font-size: 12px; color: var(--bento-text-secondary); min-width: 50px; flex-shrink: 0; }
.restore-row { align-items: center; }
.section-desc { color: var(--bento-text-secondary); font-size: 13px; margin-bottom: 12px; margin-top: 8px; }
.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid var(--bento-border);
  border-top-color: var(--bento-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Test section */
.test-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-xs);
  font-size: 13px;
  color: var(--bento-text);
  background: var(--bento-bg);
  resize: vertical;
  font-family: monospace;
}

.test-result { margin-top: 8px; }
.test-found { color: var(--bento-warning); font-size: 13px; padding: 8px; background: rgba(245,158,11,0.08); border-radius: var(--bento-radius-xs); }
.test-ok { color: var(--bento-success); font-size: 13px; padding: 8px; }

/* Results */
.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.results-header h3 { margin-bottom: 0; }
.results-actions { display: flex; gap: 6px; flex-wrap: wrap; }

.result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--bento-border);
  font-size: 12px;
  flex-wrap: wrap;
}

.result-row:last-child { border-bottom: none; }
.result-row.status-success { opacity: 0.55; background: var(--bento-success-light, rgba(16,185,129,0.06)); }
.result-row.status-failed  { background: var(--bento-error-light, rgba(239,68,68,0.08)); }
.row-status { display: inline-block; font-size: 14px; margin-left: 4px; }
.fix-progress-panel, .fix-done-panel {
  padding: 16px 20px;
  border: 1px solid var(--bento-border);
  border-radius: var(--bento-radius-sm, 10px);
  background: var(--bento-card, var(--bento-bg));
}
.fix-progress-panel h3, .fix-done-panel h3 { margin: 0 0 12px; font-size: 15px; }
.fix-progress-panel .progress-text { margin: 8px 0 4px; font-size: 13px; color: var(--bento-text-secondary, var(--bento-fg-muted)); }
.fix-progress-panel .progress-current { font-family: monospace; font-size: 12px; color: var(--bento-text, var(--bento-fg)); }
.fix-done-panel .done-stats { display: flex; gap: 16px; margin: 8px 0 12px; font-size: 14px; }
.fix-done-panel .stat-ok { color: var(--bento-success, #10B981); font-weight: 500; }
.fix-done-panel .stat-fail { color: var(--bento-error, #EF4444); font-weight: 500; }
.fix-done-panel .fail-details { margin: 8px 0; font-size: 12px; }
.fix-done-panel .fail-details ul { margin: 6px 0 0 0; padding-left: 18px; }
.fix-done-panel .done-actions { margin-top: 12px; display: flex; gap: 8px; }
.result-check { flex-shrink: 0; }
.result-check input { width: 16px; height: 16px; accent-color: var(--bento-primary); }
.result-entity { font-weight: 500; min-width: 150px; flex: 1; word-wrap: break-word; overflow-wrap: break-word; min-width: 0; }
.result-attr { color: var(--bento-text-secondary); min-width: 80px; flex-shrink: 0; }
.result-original { color: var(--bento-error); font-family: monospace; flex: 0 1 150px; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.result-arrow { color: var(--bento-text-secondary); flex-shrink: 0; }
.result-fixed { color: var(--bento-success); font-family: monospace; flex: 0 1 150px; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

/* Lovelace */
.lovelace-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--bento-border);
  font-size: 13px;
  flex-wrap: wrap;
}

.lovelace-row:last-child { border-bottom: none; }
.lovelace-url { flex: 1; min-width: 0; font-family: monospace; font-size: 12px; word-wrap: break-word; overflow-wrap: break-word; }
.lovelace-type { color: var(--bento-text-secondary); min-width: 60px; font-size: 11px; flex-shrink: 0; }
.lovelace-issue { font-weight: 600; min-width: 100px; flex-shrink: 0; }
.issue-bom { color: var(--bento-error); }
.issue-duplicate { color: var(--bento-warning); }
.issue-mojibake { color: var(--bento-error); }
.issue-broken_url { color: var(--bento-error); }
.manual-fix { font-size: 16px; }
.lovelace-warning { margin-top: 12px; padding: 10px; background: rgba(245,158,11,0.08); border-radius: var(--bento-radius-xs); font-size: 12px; color: var(--bento-warning); }

/* Patterns */
.patterns-section { opacity: 0.8; }
.patterns-details { margin: 0; }
.patterns-summary {
  font-size: 14px; font-weight: 600; color: var(--bento-text);
  cursor: pointer; user-select: none; list-style: none;
  padding: 2px 0; display: flex; align-items: center; gap: 6px;
}
.patterns-summary::-webkit-details-marker { display: none; }
.patterns-summary::before { content: '\\25B6'; font-size: 9px; color: var(--bento-text-secondary); transition: transform 0.2s; }
.patterns-details[open] .patterns-summary::before { transform: rotate(90deg); }
.patterns-details[open] .patterns-summary { margin-bottom: 10px; }
.patterns-desc { font-size: 12px; color: var(--bento-text-secondary); margin-bottom: 8px; }
.patterns-grid { font-size: 13px; font-family: monospace; line-height: 1.8; }
.pattern-bad { color: var(--bento-error); background: rgba(239,68,68,0.06); padding: 1px 4px; border-radius: 3px; }
.pattern-good { color: var(--bento-success); background: rgba(16,185,129,0.06); padding: 1px 4px; border-radius: 3px; }

.patterns-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
.patterns-table thead { background: var(--bento-bg); }
.patterns-table th { padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid var(--bento-border); color: var(--bento-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; }
.patterns-table td { padding: 10px 12px; border-bottom: 1px solid var(--bento-border); }
.patterns-table tbody tr:hover { background: rgba(59,130,246,0.03); }
.pattern-cell { font-family: 'Courier New', monospace; }
.pattern-cell.broken { color: var(--bento-error); }
.pattern-cell.fixed { color: var(--bento-success); font-weight: 500; }
.pattern-cell.cause { color: var(--bento-text-secondary); font-size: 12px; }

/* Restore divider */
.restore-divider {
  display: flex; align-items: center; gap: 10px;
  margin: 8px 0; color: var(--bento-text-secondary);
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
}
.restore-divider::before, .restore-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--bento-border);
}

/* BOM info */
.info-section { opacity: 0.85; }
.info-section p { font-size: 13px; color: var(--bento-text-secondary); margin-bottom: 8px; }
.bom-visual { font-family: monospace; font-size: 14px; padding: 8px 12px; background: var(--bento-bg); border-radius: var(--bento-radius-xs); overflow-x: auto; box-sizing: border-box; max-width: 100%; }
.bom-visual code { color: var(--bento-primary); font-weight: 600; white-space: nowrap; }

/* Log */
.log-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--bento-border);
  font-size: 12px;
  flex-wrap: wrap;
}

.log-row:last-child { border-bottom: none; }
.log-date { min-width: 100px; color: var(--bento-text-secondary); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.log-type { font-size: 14px; flex-shrink: 0; }
.log-target { flex: 1; min-width: 0; font-family: monospace; font-size: 11px; word-wrap: break-word; overflow-wrap: break-word; }
.log-result { min-width: 60px; font-weight: 600; flex-shrink: 0; }
.log-success { color: var(--bento-success); }
.log-failed { color: var(--bento-error); }
.log-detail { color: var(--bento-text-secondary); font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }

/* YAML rows */
.yaml-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--bento-border);
  font-size: 13px;
  flex-wrap: wrap;
}

.yaml-row:last-child { border-bottom: none; }
.yaml-file { font-family: monospace; font-weight: 500; flex: 1; min-width: 0; word-wrap: break-word; overflow-wrap: break-word; }
.yaml-line { color: var(--bento-text-secondary); min-width: 40px; font-family: monospace; flex-shrink: 0; }
.yaml-issue { font-weight: 600; min-width: 90px; flex-shrink: 0; }
.yaml-detail { color: var(--bento-text-secondary); font-size: 12px; flex: 1; min-width: 0; }
.yaml-context { width: 100%; margin-top: 4px; }
.yaml-context code {
  display: block;
  padding: 6px 10px;
  background: var(--bento-bg);
  border-radius: var(--bento-radius-xs);
  font-size: 12px;
  color: var(--bento-text);
  overflow-x: auto;
  white-space: pre;
}

/* Empty state */
.empty-state { text-align: center; padding: 32px; color: var(--bento-text-secondary); font-size: 14px; }

/* Toast */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  padding: 12px 24px;
  border-radius: var(--bento-radius-sm);
  font-size: 13px;
  font-weight: 500;
  z-index: 1000;
  opacity: 0;
  transition: all 0.3s ease;
  pointer-events: none;
}

.toast-show { transform: translateX(-50%) translateY(0); opacity: 1; }
.toast-success { background: var(--bento-success); color: #fff; }
.toast-error { background: var(--bento-error); color: #fff; }
.toast-info { background: var(--bento-primary); color: #fff; }

/* Excluded note */
.excluded-note { font-size: 12px; color: var(--bento-text-secondary); padding: 6px 10px; background: var(--bento-primary-light); border-radius: var(--bento-radius-xs); margin-bottom: 8px; }

/* Restore source toggle */
.restore-source-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.restore-source-label { font-size: 13px; color: var(--bento-text-secondary); }
.restore-live-warn { margin-top: 8px; padding: 8px 12px; background: rgba(245,158,11,0.1); color: var(--bento-warning); border-radius: var(--bento-radius-xs); font-size: 12px; }

/* File picker */
.file-picker-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.file-picker-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--bento-border); border-radius: var(--bento-radius-xs); cursor: pointer; transition: var(--bento-transition); }
.file-picker-row:hover { background: var(--bento-primary-light); border-color: var(--bento-primary); }
.file-picker-selected { background: var(--bento-primary-light); border-color: var(--bento-primary); }
.file-picker-icon { font-size: 16px; }
.file-picker-path { font-family: monospace; font-size: 13px; color: var(--bento-text); }

/* Step bar */
.restore-steps { display: flex; align-items: center; gap: 0; margin: 12px 0 0 0; }
.restore-step { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: var(--bento-radius-xs); opacity: 0.4; }
.restore-step.step-active { opacity: 1; }
.step-num { width: 22px; height: 22px; border-radius: 50%; background: var(--bento-border); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--bento-text-secondary); }
.restore-step.step-active .step-num { background: var(--bento-primary); color: #fff; }
.step-label { font-size: 12px; font-weight: 500; color: var(--bento-text-secondary); }
.restore-step.step-active .step-label { color: var(--bento-text); }
.step-sep { flex: 1; height: 1px; background: var(--bento-border); min-width: 16px; }

/* Responsive */
@media (max-width: 768px) {
  .card { padding: 12px; }
  .result-row { flex-wrap: wrap; }
  .result-entity { width: 100%; }
  .results-actions { width: 100%; }
  .scan-header { flex-direction: column; gap: 8px; align-items: flex-start; }
  .lovelace-row { flex-wrap: wrap; }
  .log-row { flex-wrap: wrap; }
  .tab-btn { flex: 1; min-width: 80px; padding: 8px 12px; font-size: 12px; }
  .result-original, .result-fixed { max-width: 120px; }
  .log-detail { max-width: 150px; }
}

@media (max-width: 480px) {
  .card { padding: 8px; }
  .results-actions { flex-direction: column; }
  .results-actions .btn-sm { width: 100%; }
  .tab-btn { flex: 1; min-width: 60px; padding: 6px 8px; font-size: 11px; }
  .result-original, .result-fixed { max-width: 100px; }
  .log-date { min-width: 80px; font-size: 11px; }
  .log-target { width: 100%; }
  .lovelace-url { width: 100%; }
}
`;
  }

  disconnectedCallback() {
    // Cleanup any active event listeners or timers
  }

  setActiveTab(tabId) {
    this._activeTab = tabId;
    this._render();
  }
}

if (!customElements.get('ha-encoding-fixer')) {
  customElements.define('ha-encoding-fixer', HaEncodingFixer);
}
class HaEncodingFixerEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }
  _dispatch() {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
  }
  _render() {
    if (!this._hass) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display:block; padding:16px;
          /* HA theme-driven tokens (no prefers-color-scheme — HA sets the theme, not the OS) */
          --bento-bg: var(--primary-background-color, #ffffff);
          --bento-card: var(--card-background-color, #ffffff);
          --bento-text: var(--primary-text-color, #1e293b);
          --bento-text-secondary: var(--secondary-text-color, #64748b);
          --bento-border: var(--divider-color, #e2e8f0);
          --bento-shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
          --bento-shadow-md: 0 4px 12px rgba(0,0,0,0.12);
        }
        h3 { margin:0 0 16px; font-size:15px; font-weight:600; color:var(--bento-text, var(--primary-text-color,#1e293b)); }
        input { outline:none; transition:border-color .2s; }
        input:focus { border-color:var(--bento-primary, var(--primary-color,#3b82f6)); }
      </style>
      <h3>Encoding Fixer</h3>
            <div style="margin-bottom:12px;">
              <label style="display:block;font-weight:500;margin-bottom:4px;font-size:13px;">Title</label>
              <input type="text" id="cf_title" value="${_esc(this._config?.title || 'Encoding Fixer')}"
                style="width:100%;padding:8px 12px;border:1px solid var(--divider-color,#e2e8f0);border-radius:8px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#1e293b);font-size:14px;box-sizing:border-box;">
            </div>
    `;
        const f_title = this.shadowRoot.querySelector('#cf_title');
        if (f_title) f_title.addEventListener('input', (e) => {
          this._config = { ...this._config, title: e.target.value };
          this._dispatch();
        });
  }
  connectedCallback() { this._render(); }
}
if (!customElements.get('ha-encoding-fixer-editor')) { customElements.define('ha-encoding-fixer-editor', HaEncodingFixerEditor); }

})();

window.customCards = window.customCards || [];
window.customCards.push({ type: 'ha-encoding-fixer', name: 'Encoding Fixer', description: 'Detect and fix mojibake, BOM and encoding issues', preview: false });
