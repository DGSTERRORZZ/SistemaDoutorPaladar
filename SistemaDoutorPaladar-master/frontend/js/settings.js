// =============================================
// SETTINGS.JS - Painel de Configurações Globais
// =============================================
(function () {
  'use strict';

  // ---------- TRADUÇÕES ----------
  const translations = {
    'pt-BR': {
      title: 'Configurações',
      appearance: 'Aparência',
      darkMode: 'Modo escuro',
      language: 'Idioma',
      fontSize: 'Tamanho da fonte',
      reset: 'Redefinir padrões',
      close: 'Fechar',
      save: 'Salvo automaticamente',
      labelSmall: 'Pequeno',
      labelMedium: 'Médio',
      labelLarge: 'Grande'
    },
    'en': {
      title: 'Settings',
      appearance: 'Appearance',
      darkMode: 'Dark mode',
      language: 'Language',
      fontSize: 'Font size',
      reset: 'Reset defaults',
      close: 'Close',
      save: 'Saved automatically',
      labelSmall: 'Small',
      labelMedium: 'Medium',
      labelLarge: 'Large'
    }
  };

  // ---------- ESTADO ----------
  const defaults = {
    theme: 'light',
    lang: 'pt-BR',
    fontSize: 'medium' // small | medium | large
  };

  let current = { ...defaults };

  // ---------- PERSISTÊNCIA ----------
  function loadSettings() {
    try {
      const raw = localStorage.getItem('doutorPaladar_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        current = { ...defaults, ...parsed };
      }
    } catch (e) {
      current = { ...defaults };
    }
  }

  function saveSettings() {
    localStorage.setItem('doutorPaladar_settings', JSON.stringify(current));
    applyAll();
  }

  // ---------- APLICAÇÃO ----------
  function applyTheme() {
    document.body.classList.toggle('dark-theme', current.theme === 'dark');
  }

  function applyFontSize() {
    const sizes = { small: '0.9rem', medium: '1rem', large: '1.15rem' };
    document.documentElement.style.setProperty('--font-size-base', sizes[current.fontSize] || '1rem');
  }

  function applyLanguage() {
    const t = translations[current.lang] || translations['pt-BR'];
    const panel = document.getElementById('settingsPanel');
    if (!panel) return;

    // Atualiza textos estáticos do painel
    const map = {
      'settingsTitle': t.title,
      'appearanceLabel': t.appearance,
      'darkModeLabel': t.darkMode,
      'languageLabel': t.language,
      'fontSizeLabel': t.fontSize,
      'resetLabel': t.reset,
      'closeLabel': t.close
    };

    Object.entries(map).forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });
  }

  function applyAll() {
    applyTheme();
    applyFontSize();
    applyLanguage();
  }

  // ---------- CONSTRUÇÃO DO PAINEL ----------
  function buildSettingsUI() {
    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay';
    overlay.id = 'settingsOverlay';
    overlay.addEventListener('click', closePanel);
    document.body.appendChild(overlay);

    // Painel
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    panel.id = 'settingsPanel';
    panel.innerHTML = `
      <button class="close-settings" id="closeSettingsBtn" title="Fechar">&times;</button>
      <h2 id="settingsTitle"><i class="fas fa-cog"></i> Configurações</h2>

      <div class="settings-group">
        <h3 id="appearanceLabel">Aparência</h3>
        <div class="settings-row">
          <span id="darkModeLabel">Modo escuro</span>
          <label class="toggle-switch">
            <input type="checkbox" id="darkModeToggle">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="settings-row">
          <span id="fontSizeLabel">Tamanho da fonte</span>
          <select id="fontSizeSelect">
            <option value="small">Pequeno</option>
            <option value="medium" selected>Médio</option>
            <option value="large">Grande</option>
          </select>
        </div>
      </div>

      <div class="settings-group">
        <h3 id="languageLabel">Idioma</h3>
        <select id="languageSelect">
          <option value="pt-BR">🇧🇷 Português</option>
          <option value="en">🇺🇸 English</option>
        </select>
      </div>

      <button class="btn btn-secondary" id="resetSettingsBtn">
        <i class="fas fa-undo"></i> <span id="resetLabel">Redefinir padrões</span>
      </button>
      <small style="text-align:center; color:var(--text-secondary); margin-top:1rem;" id="saveLabel">Salvo automaticamente</small>
    `;
    document.body.appendChild(panel);

    // Botão engrenagem (flutuante)
    const trigger = document.createElement('button');
    trigger.className = 'settings-trigger';
    trigger.id = 'settingsTrigger';
    trigger.innerHTML = '<i class="fas fa-cog"></i>';
    trigger.title = 'Configurações';
    trigger.addEventListener('click', openPanel);
    document.body.appendChild(trigger);
  }

  // ---------- CONTROLE DO PAINEL ----------
  function openPanel() {
    document.getElementById('settingsPanel').classList.add('open');
    document.getElementById('settingsOverlay').classList.add('active');
    syncUI();
  }

  function closePanel() {
    document.getElementById('settingsPanel').classList.remove('open');
    document.getElementById('settingsOverlay').classList.remove('active');
  }

  function syncUI() {
    document.getElementById('darkModeToggle').checked = current.theme === 'dark';
    document.getElementById('languageSelect').value = current.lang;
    document.getElementById('fontSizeSelect').value = current.fontSize;
  }

  // ---------- EVENTOS ----------
  function bindEvents() {
    document.getElementById('darkModeToggle').addEventListener('change', function () {
      current.theme = this.checked ? 'dark' : 'light';
      saveSettings();
    });

    document.getElementById('languageSelect').addEventListener('change', function () {
      current.lang = this.value;
      saveSettings();
    });

    document.getElementById('fontSizeSelect').addEventListener('change', function () {
      current.fontSize = this.value;
      saveSettings();
    });

    document.getElementById('resetSettingsBtn').addEventListener('click', function () {
      current = { ...defaults };
      saveSettings();
      syncUI();
    });

    document.getElementById('darkModeToggle').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') this.click();
    });
  }

  // ---------- INICIALIZAÇÃO ----------
  function init() {
    loadSettings();
    buildSettingsUI();
    bindEvents();
    applyAll();
    syncUI();
  }

  // Aguarda o DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();