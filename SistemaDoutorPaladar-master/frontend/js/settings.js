// =============================================
// SETTINGS.JS - Painel de Configurações Globais
// =============================================
(function () {
  'use strict';

  const translations = {
    'pt-BR': {
      title: 'Configurações', appearance: 'Aparência', darkMode: 'Modo escuro',
      language: 'Idioma', fontSize: 'Tamanho da fonte', reset: 'Redefinir padrões',
      close: 'Fechar', save: 'Salvo automaticamente',
      labelSmall: 'Pequeno', labelMedium: 'Médio', labelLarge: 'Grande',
      dashboard: 'Dashboard', pdv: 'PDV', estoque: 'Estoque', fiado: 'Fiado',
      desempenhos: 'Desempenhos', despesas: 'Despesas', pedidos: 'Pedidos',
      agenda: 'Agenda', fornecedores: 'Fornecedores', config: 'Config',
      logout: 'Sair', welcome: 'Bem-vindo de volta, Pablo!',
      welcomeSub: 'Gerencie sua cantina com eficiência. Aqui está o resumo de hoje.',
      salesToday: 'Vendas Hoje', pendingFiado: 'Fiado Pendente',
      monthProfit: 'Lucro do Mês', stockAlerts: 'Alertas de Estoque',
      recentSales: 'Últimas Vendas', weekSales: 'Vendas da Semana',
      criticalStock: 'Estoque Crítico', bestSellers: 'Mais Vendidos Hoje',
      quickActions: 'Ações Rápidas', addProduct: 'Adicionar Produto',
      newFiado: 'Novo Fiado', registerExpense: 'Registrar Despesa',
      financialSummary: 'Resumo Financeiro do Mês', totalRevenue: 'Receita Total',
      totalExpenses: 'Despesas Totais', netProfit: 'Lucro Líquido',
      accessPerformance: 'Acessar Central de Desempenhos', manage: 'Gerenciar',
      newSale: 'Nova Venda', cart: 'Carrinho', clear: 'Limpar',
      subtotal: 'Subtotal', total: 'Total', cash: 'Dinheiro', card: 'Cartão',
      finishSale: 'Finalizar Venda', saleCompleted: 'Venda Realizada!',
      newClient: 'Novo Cliente', register: 'Cadastrar', cancel: 'Cancelar'
    },
    'en': {
      title: 'Settings', appearance: 'Appearance', darkMode: 'Dark mode',
      language: 'Language', fontSize: 'Font size', reset: 'Reset defaults',
      close: 'Close', save: 'Saved automatically',
      labelSmall: 'Small', labelMedium: 'Medium', labelLarge: 'Large',
      dashboard: 'Dashboard', pdv: 'POS', estoque: 'Stock', fiado: 'Credit',
      desempenhos: 'Performance', despesas: 'Expenses', pedidos: 'Orders',
      agenda: 'Schedule', fornecedores: 'Suppliers', config: 'Settings',
      logout: 'Logout', welcome: 'Welcome back, Pablo!',
      welcomeSub: 'Manage your cafeteria efficiently. Here is today\'s summary.',
      salesToday: 'Sales Today', pendingFiado: 'Pending Credit',
      monthProfit: 'Monthly Profit', stockAlerts: 'Stock Alerts',
      recentSales: 'Recent Sales', weekSales: 'Weekly Sales',
      criticalStock: 'Critical Stock', bestSellers: 'Best Sellers Today',
      quickActions: 'Quick Actions', addProduct: 'Add Product',
      newFiado: 'New Credit', registerExpense: 'Register Expense',
      financialSummary: 'Monthly Financial Summary', totalRevenue: 'Total Revenue',
      totalExpenses: 'Total Expenses', netProfit: 'Net Profit',
      accessPerformance: 'Access Performance Center', manage: 'Manage',
      newSale: 'New Sale', cart: 'Cart', clear: 'Clear',
      subtotal: 'Subtotal', total: 'Total', cash: 'Cash', card: 'Card',
      finishSale: 'Finish Sale', saleCompleted: 'Sale Completed!',
      newClient: 'New Client', register: 'Register', cancel: 'Cancel'
    }
  };

  const defaults = { theme: 'light', lang: 'pt-BR', fontSize: 'medium' };
  let current = { ...defaults };

  function loadSettings() {
    try { const raw = localStorage.getItem('doutorPaladar_settings'); if (raw) { const parsed = JSON.parse(raw); current = { ...defaults, ...parsed }; } } catch (e) { current = { ...defaults }; }
  }

  function saveSettings() { localStorage.setItem('doutorPaladar_settings', JSON.stringify(current)); applyAll(); }

  function applyTheme() { document.body.classList.toggle('dark-theme', current.theme === 'dark'); }

  function applyFontSize() {
    const sizes = { small: '0.9rem', medium: '1rem', large: '1.15rem' };
    document.documentElement.style.setProperty('--font-size-base', sizes[current.fontSize] || '1rem');
  }

  function applyLanguage() {
    const t = translations[current.lang] || translations['pt-BR'];
    const panelMap = { 'settingsTitle': t.title, 'appearanceLabel': t.appearance, 'darkModeLabel': t.darkMode, 'languageLabel': t.language, 'fontSizeLabel': t.fontSize, 'resetLabel': t.reset, 'closeLabel': t.close };
    Object.entries(panelMap).forEach(([id, text]) => { const el = document.getElementById(id); if (el) el.textContent = text; });
    document.querySelectorAll('[data-translate]').forEach(el => {
      const key = el.getAttribute('data-translate');
      if (t[key]) {
        if (el.tagName === 'INPUT' && el.type === 'text') el.value = t[key];
        else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = t[key];
        else el.textContent = t[key];
      }
    });
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: current.lang } }));
  }

  function applyAll() { applyTheme(); applyFontSize(); applyLanguage(); }

  function buildSettingsUI() {
    if (document.getElementById('settingsTrigger')) return;
    const overlay = document.createElement('div'); overlay.className = 'settings-overlay'; overlay.id = 'settingsOverlay'; overlay.addEventListener('click', closePanel); document.body.appendChild(overlay);
    const panel = document.createElement('div'); panel.className = 'settings-panel'; panel.id = 'settingsPanel';
    panel.innerHTML = `<button class="close-settings" id="closeSettingsBtn">&times;</button><h2 id="settingsTitle"><i class="fas fa-cog"></i> Configurações</h2>
      <div class="settings-group"><h3 id="appearanceLabel">Aparência</h3>
        <div class="settings-row"><span id="darkModeLabel">Modo escuro</span><label class="toggle-switch"><input type="checkbox" id="darkModeToggle"><span class="toggle-slider"></span></label></div>
        <div class="settings-row"><span id="fontSizeLabel">Tamanho da fonte</span><select id="fontSizeSelect"><option value="small">Pequeno</option><option value="medium" selected>Médio</option><option value="large">Grande</option></select></div>
      </div>
      <div class="settings-group"><h3 id="languageLabel">Idioma</h3><select id="languageSelect"><option value="pt-BR">🇧🇷 Português</option><option value="en">🇺🇸 English</option></select></div>
      <button class="btn btn-secondary" id="resetSettingsBtn"><i class="fas fa-undo"></i> <span id="resetLabel">Redefinir padrões</span></button>
      <small style="text-align:center;color:var(--text-secondary);margin-top:1rem;" id="saveLabel">Salvo automaticamente</small>`;
    document.body.appendChild(panel);
    const trigger = document.createElement('button'); trigger.className = 'settings-trigger'; trigger.id = 'settingsTrigger'; trigger.innerHTML = '<i class="fas fa-cog"></i>'; trigger.addEventListener('click', openPanel); document.body.appendChild(trigger);
  }

  function openPanel() { document.getElementById('settingsPanel').classList.add('open'); document.getElementById('settingsOverlay').classList.add('active'); syncUI(); }
  function closePanel() { document.getElementById('settingsPanel').classList.remove('open'); document.getElementById('settingsOverlay').classList.remove('active'); }
  function syncUI() { document.getElementById('darkModeToggle').checked = current.theme === 'dark'; document.getElementById('languageSelect').value = current.lang; document.getElementById('fontSizeSelect').value = current.fontSize; }

  function bindEvents() {
    document.getElementById('darkModeToggle').addEventListener('change', function () { current.theme = this.checked ? 'dark' : 'light'; saveSettings(); });
    document.getElementById('languageSelect').addEventListener('change', function () { current.lang = this.value; saveSettings(); });
    document.getElementById('fontSizeSelect').addEventListener('change', function () { current.fontSize = this.value; saveSettings(); });
    document.getElementById('resetSettingsBtn').addEventListener('click', function () { current = { ...defaults }; saveSettings(); syncUI(); });
  }

  function init() { loadSettings(); buildSettingsUI(); bindEvents(); applyAll(); syncUI(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();