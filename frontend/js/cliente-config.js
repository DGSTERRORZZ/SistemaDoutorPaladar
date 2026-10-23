// =========================================================================
// DOUTOR PALADAR — CLIENT CONFIG & ACCESSIBILITY CONTROLLER (Global)
// Adiciona botão fixo de configurações em todas as telas de cliente,
// oferecendo controle de acessibilidade, modo celular/desktop, conta e exclusão.
// =========================================================================

(function () {
  const STORAGE_DEVICE_KEY = 'dp_user_device_preference';

  // 1. Injetar estilos do modal e do botão fixo
  const styleEl = document.createElement('style');
  styleEl.id = 'dp-client-config-styles';
  styleEl.textContent = `
    /* Container Fixo no Canto Superior Direito para Configurações e Ajuda */
    .dp-top-actions-container {
      position: fixed !important;
      top: 14px !important;
      right: 16px !important;
      z-index: 99990 !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      pointer-events: auto !important;
    }

    .dp-btn-action-pill {
      background: rgba(15, 23, 42, 0.88) !important;
      backdrop-filter: blur(10px) !important;
      -webkit-backdrop-filter: blur(10px) !important;
      color: #ffffff !important;
      border: 1.5px solid rgba(255, 255, 255, 0.18) !important;
      border-radius: 999px !important;
      padding: 8px 14px !important;
      font-size: 0.82rem !important;
      font-weight: 800 !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 7px !important;
      cursor: pointer !important;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35) !important;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
      user-select: none !important;
      text-decoration: none !important;
      font-family: 'Plus Jakarta Sans', 'Outfit', -apple-system, sans-serif !important;
    }
    .dp-btn-action-pill:hover {
      background: linear-gradient(135deg, #1b4332, #2d7d52) !important;
      border-color: rgba(255, 255, 255, 0.4) !important;
      transform: translateY(-2px) scale(1.02) !important;
      box-shadow: 0 10px 24px rgba(45, 125, 82, 0.45) !important;
      color: #ffffff !important;
    }
    .dp-btn-action-pill i.gear-icon {
      font-size: 0.95rem !important;
      color: #ffbc0d !important;
      transition: transform 0.4s ease !important;
    }
    .dp-btn-action-pill:hover i.gear-icon {
      transform: rotate(90deg) !important;
    }
    .dp-btn-action-pill i.help-icon {
      font-size: 0.95rem !important;
      color: #38bdf8 !important;
    }

    @media (max-width: 640px) {
      .dp-top-actions-container {
        top: 10px !important;
        right: 10px !important;
        gap: 6px !important;
      }
      .dp-btn-action-pill {
        padding: 7px 11px !important;
        font-size: 0.76rem !important;
      }
      .dp-btn-action-pill span.btn-label-long {
        display: none !important;
      }
    }

    /* Modal Overlay */
    .dp-config-modal-overlay {
      position: fixed !important;
      inset: 0 !important;
      background: rgba(10, 15, 25, 0.8) !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
      z-index: 999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 1rem !important;
      opacity: 0;
      visibility: hidden;
      transition: all 0.25s ease !important;
    }
    .dp-config-modal-overlay.active {
      opacity: 1 !important;
      visibility: visible !important;
    }

    .dp-config-card {
      background: #ffffff !important;
      color: #0f172a !important;
      border-radius: 24px !important;
      width: 100% !important;
      max-width: 520px !important;
      max-height: 90vh !important;
      overflow-y: auto !important;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.5) !important;
      border: 1px solid #e2e8f0 !important;
      animation: dpConfigSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
      padding: 1.6rem !important;
      font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
    }
    @keyframes dpConfigSlideUp {
      from { transform: translateY(25px) scale(0.97); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }

    .dp-config-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      margin-bottom: 1.2rem !important;
      padding-bottom: 0.9rem !important;
      border-bottom: 1px solid #f1f5f9 !important;
    }
    .dp-config-title {
      font-size: 1.25rem !important;
      font-weight: 800 !important;
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      color: #0f172a !important;
      margin: 0 !important;
    }
    .dp-config-close {
      background: #f1f5f9 !important;
      border: none !important;
      width: 36px !important;
      height: 36px !important;
      border-radius: 50% !important;
      cursor: pointer !important;
      color: #64748b !important;
      font-size: 1rem !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.2s !important;
    }
    .dp-config-close:hover {
      background: #e2e8f0 !important;
      color: #0f172a !important;
      transform: scale(1.05) !important;
    }

    .dp-config-section {
      background: #f8fafc !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 16px !important;
      padding: 1.1rem !important;
      margin-bottom: 1rem !important;
    }
    .dp-config-section-title {
      font-size: 0.85rem !important;
      font-weight: 800 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.05em !important;
      color: #2d7d52 !important;
      margin-bottom: 0.8rem !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
    }

    /* Botoes de Acessibilidade */
    .dp-access-grid {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 8px !important;
    }
    .dp-access-btn {
      background: #ffffff !important;
      border: 1.5px solid #cbd5e1 !important;
      border-radius: 12px !important;
      padding: 10px 12px !important;
      font-weight: 700 !important;
      font-size: 0.82rem !important;
      color: #334155 !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
    }
    .dp-access-btn:hover {
      border-color: #2d7d52 !important;
      color: #2d7d52 !important;
      background: #f0fdf4 !important;
    }
    .dp-access-btn.active {
      background: #0f172a !important;
      color: #ffffff !important;
      border-color: #0f172a !important;
    }

    /* Botoes Seletor Celular / Desktop */
    .dp-device-toggle-grid {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 10px !important;
    }
    .dp-device-btn {
      border: 2px solid #e2e8f0 !important;
      background: #ffffff !important;
      border-radius: 14px !important;
      padding: 12px 10px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 6px !important;
      cursor: pointer !important;
      font-weight: 800 !important;
      font-size: 0.85rem !important;
      color: #475569 !important;
      transition: all 0.2s !important;
    }
    .dp-device-btn i {
      font-size: 1.3rem !important;
      color: #64748b !important;
    }
    .dp-device-btn.selected {
      border-color: #2d7d52 !important;
      background: #eefbf4 !important;
      color: #1b4332 !important;
      box-shadow: 0 4px 14px rgba(45, 125, 82, 0.15) !important;
    }
    .dp-device-btn.selected i {
      color: #2d7d52 !important;
    }

    /* Seção da Conta */
    .dp-account-info-box {
      background: #ffffff !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 12px !important;
      padding: 10px 14px !important;
      margin-bottom: 10px !important;
      font-size: 0.86rem !important;
    }
    .dp-account-info-row {
      display: flex !important;
      justify-content: space-between !important;
      padding: 4px 0 !important;
      border-bottom: 1px dashed #f1f5f9 !important;
    }
    .dp-account-info-row:last-child {
      border-bottom: none !important;
    }
    .dp-account-label {
      color: #64748b !important;
      font-weight: 600 !important;
    }
    .dp-account-val {
      color: #0f172a !important;
      font-weight: 800 !important;
    }

    .dp-btn-danger-outline {
      width: 100% !important;
      background: #fff !important;
      color: #dc2626 !important;
      border: 1.5px solid #fecaca !important;
      padding: 10px 14px !important;
      border-radius: 12px !important;
      font-weight: 800 !important;
      font-size: 0.86rem !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
      transition: all 0.2s !important;
      margin-top: 6px !important;
    }
    .dp-btn-danger-outline:hover {
      background: #fee2e2 !important;
      border-color: #ef4444 !important;
      color: #991b1b !important;
    }

    /* Regras de Alto Contraste */
    body.modo-alto-contraste {
      filter: contrast(125%) !important;
      background-color: #000000 !important;
    }
    body.modo-dislexia {
      font-family: 'Comic Sans MS', 'Arial', sans-serif !important;
      letter-spacing: 0.05em !important;
      word-spacing: 0.1em !important;
    }
  `;
  document.head.appendChild(styleEl);

  // 2. Funções de Acessibilidade
  let fonteZoom = parseInt(localStorage.getItem('dp_fonte_zoom') || '100', 10);
  function alterarZoom(delta) {
    fonteZoom = Math.min(140, Math.max(80, fonteZoom + delta * 10));
    document.documentElement.style.fontSize = `${fonteZoom}%`;
    localStorage.setItem('dp_fonte_zoom', fonteZoom);
    const zoomText = document.getElementById('dpZoomVal');
    if (zoomText) zoomText.textContent = `${fonteZoom}%`;
  }
  function resetarZoom() {
    fonteZoom = 100;
    document.documentElement.style.fontSize = '100%';
    localStorage.removeItem('dp_fonte_zoom');
    const zoomText = document.getElementById('dpZoomVal');
    if (zoomText) zoomText.textContent = '100%';
  }

  function toggleContraste() {
    document.body.classList.toggle('modo-alto-contraste');
    const atv = document.body.classList.contains('modo-alto-contraste');
    localStorage.setItem('dp_alto_contraste', atv ? '1' : '0');
    const btn = document.getElementById('dpBtnContraste');
    if (btn) btn.classList.toggle('active', atv);
  }

  function toggleDislexia() {
    document.body.classList.toggle('modo-dislexia');
    const atv = document.body.classList.contains('modo-dislexia');
    localStorage.setItem('dp_modo_dislexia', atv ? '1' : '0');
    const btn = document.getElementById('dpBtnDislexia');
    if (btn) btn.classList.toggle('active', atv);
  }

  // 3. Funções de Dispositivo (Mobile / Desktop)
  function aplicarModoDispositivo(modo) {
    localStorage.setItem(STORAGE_DEVICE_KEY, modo);
    if (modo === 'mobile') {
      document.documentElement.classList.add('mode-mobile');
      document.documentElement.classList.remove('mode-desktop');
      document.body.classList.add('mode-mobile');
      document.body.classList.remove('mode-desktop');
    } else {
      document.documentElement.classList.add('mode-desktop');
      document.documentElement.classList.remove('mode-mobile');
      document.body.classList.add('mode-desktop');
      document.body.classList.remove('mode-mobile');
    }

    const btnMob = document.getElementById('dpDeviceMob');
    const btnDesk = document.getElementById('dpDeviceDesk');
    if (btnMob && btnDesk) {
      btnMob.classList.toggle('selected', modo === 'mobile');
      btnDesk.classList.toggle('selected', modo !== 'mobile');
    }
  }

  // 4. Modal HTML
  function renderizarModal() {
    if (document.getElementById('dpConfigModalOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'dpConfigModalOverlay';
    overlay.className = 'dp-config-modal-overlay';
    overlay.innerHTML = `
      <div class="dp-config-card" role="dialog" aria-modal="true" aria-labelledby="dpConfigModalTitle">
        <div class="dp-config-header">
          <h2 id="dpConfigModalTitle" class="dp-config-title">
            <i class="fas fa-sliders" style="color:#2d7d52;"></i> Configurações & Acessibilidade
          </h2>
          <button type="button" class="dp-config-close" id="dpCloseConfigModal" title="Fechar">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Seção 1: Visualização & Dispositivo -->
        <div class="dp-config-section">
          <div class="dp-config-section-title">
            <i class="fas fa-mobile-screen"></i> Modo de Exibição
          </div>
          <div class="dp-device-toggle-grid">
            <button type="button" class="dp-device-btn" id="dpDeviceMob">
              <i class="fas fa-mobile-screen-button"></i>
              <span>Celular / Mobile</span>
              <small style="font-size:0.7rem; font-weight:normal; opacity:0.8;">Vertical em 2 colunas</small>
            </button>
            <button type="button" class="dp-device-btn" id="dpDeviceDesk">
              <i class="fas fa-laptop"></i>
              <span>Computador / PC</span>
              <small style="font-size:0.7rem; font-weight:normal; opacity:0.8;">Panorâmico largo</small>
            </button>
          </div>
        </div>

        <!-- Seção 2: Acessibilidade -->
        <div class="dp-config-section">
          <div class="dp-config-section-title">
            <i class="fas fa-universal-access"></i> Acessibilidade & Conforto Visual
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; background:#fff; padding:8px 12px; border-radius:12px; border:1px solid #cbd5e1;">
            <span style="font-size:0.84rem; font-weight:700;">Tamanho do Texto: <span id="dpZoomVal">${fonteZoom}%</span></span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="dp-access-btn" id="dpBtnZoomMenos" style="padding:6px 12px;" title="Diminuir fonte"><i class="fas fa-minus"></i></button>
              <button type="button" class="dp-access-btn" id="dpBtnZoomReset" style="padding:6px 12px;" title="Restaurar tamanho">100%</button>
              <button type="button" class="dp-access-btn" id="dpBtnZoomMais" style="padding:6px 12px;" title="Aumentar fonte"><i class="fas fa-plus"></i></button>
            </div>
          </div>
          <div class="dp-access-grid">
            <button type="button" class="dp-access-btn ${document.body.classList.contains('modo-alto-contraste') ? 'active' : ''}" id="dpBtnContraste">
              <i class="fas fa-circle-half-stroke"></i>
              <span>Alto Contraste</span>
            </button>
            <button type="button" class="dp-access-btn ${document.body.classList.contains('modo-dislexia') ? 'active' : ''}" id="dpBtnDislexia">
              <i class="fas fa-font"></i>
              <span>Fonte Amigável</span>
            </button>
          </div>
        </div>

        <!-- Seção 3: Conta & Segurança -->
        <div class="dp-config-section">
          <div class="dp-config-section-title">
            <i class="fas fa-user-circle"></i> Minha Conta
          </div>
          <div id="dpAccountContent">
            <!-- Renderizado via JS se logado ou visitante -->
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Eventos do modal
    document.getElementById('dpCloseConfigModal').addEventListener('click', fecharModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fecharModal();
    });

    // Zoom
    document.getElementById('dpBtnZoomMenos').addEventListener('click', () => alterarZoom(-1));
    document.getElementById('dpBtnZoomMais').addEventListener('click', () => alterarZoom(1));
    document.getElementById('dpBtnZoomReset').addEventListener('click', resetarZoom);

    // Contraste e Dislexia
    document.getElementById('dpBtnContraste').addEventListener('click', toggleContraste);
    document.getElementById('dpBtnDislexia').addEventListener('click', toggleDislexia);

    // Dispositivo
    document.getElementById('dpDeviceMob').addEventListener('click', () => aplicarModoDispositivo('mobile'));
    document.getElementById('dpDeviceDesk').addEventListener('click', () => aplicarModoDispositivo('desktop'));

    // Estado inicial de seleção de dispositivo
    const modoAtual = localStorage.getItem(STORAGE_DEVICE_KEY) || (window.innerWidth <= 768 ? 'mobile' : 'desktop');
    aplicarModoDispositivo(modoAtual);

    atualizarConteudoConta();
  }

  function atualizarConteudoConta() {
    const box = document.getElementById('dpAccountContent');
    if (!box) return;

    const token = sessionStorage.getItem('cliente_token');
    const nome = sessionStorage.getItem('cliente_nome') || 'Usuário';
    const usuario = sessionStorage.getItem('cliente_usuario') || '';
    const email = sessionStorage.getItem('cliente_email') || 'Não informado';
    const telefone = sessionStorage.getItem('cliente_telefone') || 'Não informado';

    if (token) {
      box.innerHTML = `
        <div class="dp-account-info-box">
          <div class="dp-account-info-row">
            <span class="dp-account-label">Nome:</span>
            <span class="dp-account-val">${nome}</span>
          </div>
          <div class="dp-account-info-row">
            <span class="dp-account-label">Usuário:</span>
            <span class="dp-account-val">@${usuario}</span>
          </div>
          <div class="dp-account-info-row">
            <span class="dp-account-label">E-mail:</span>
            <span class="dp-account-val">${email}</span>
          </div>
          <div class="dp-account-info-row">
            <span class="dp-account-label">WhatsApp:</span>
            <span class="dp-account-val">${telefone}</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <a href="pedidos.html" class="dp-access-btn" style="text-decoration:none; justify-content:center;">
            <i class="fas fa-receipt"></i> Meus Pedidos
          </a>
          <button type="button" class="dp-access-btn" id="dpBtnLogoutCliente" style="justify-content:center; color:#dc2626;">
            <i class="fas fa-sign-out-alt"></i> Sair da Conta
          </button>
        </div>

        <button type="button" class="dp-btn-danger-outline" id="dpBtnExcluirConta">
          <i class="fas fa-trash-can"></i> Excluir Minha Conta Definitivamente
        </button>
      `;

      document.getElementById('dpBtnLogoutCliente')?.addEventListener('click', () => {
        if (confirm('Deseja realmente sair da sua conta?')) {
          sessionStorage.clear();
          window.location.reload();
        }
      });

      document.getElementById('dpBtnExcluirConta')?.addEventListener('click', acaoExcluirConta);
    } else {
      box.innerHTML = `
        <p style="font-size:0.86rem; color:#64748b; margin-bottom:12px;">
          Você está navegando como visitante. Acesse ou crie sua conta para acompanhar pedidos e juntar pontos!
        </p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <a href="login.html" class="dp-access-btn" style="text-decoration:none; justify-content:center; background:#2d7d52; color:#fff; border-color:#2d7d52;">
            <i class="fas fa-sign-in-alt"></i> Entrar
          </a>
          <a href="cadastro.html" class="dp-access-btn" style="text-decoration:none; justify-content:center;">
            <i class="fas fa-user-plus"></i> Criar Conta
          </a>
        </div>
      `;
    }
  }

  async function acaoExcluirConta() {
    const confirmacao1 = confirm('⚠️ ATENÇÃO: Tem certeza que deseja excluir sua conta no Doutor Paladar?\n\nEssa ação é irreversível e seus pontos de fidelidade serão perdidos.');
    if (!confirmacao1) return;

    const confirmacao2 = prompt('Para confirmar a exclusão permanente, digite a palavra EXCLUIR abaixo:');
    if (confirmacao2 !== 'EXCLUIR') {
      alert('Operação cancelada. A palavra digitada não confere.');
      return;
    }

    try {
      const token = sessionStorage.getItem('cliente_token');
      const origin = (typeof window !== 'undefined' && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:3000';
      const res = await fetch(`${origin}/api/clientes/excluir-conta`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok) {
        alert('Sua conta foi excluída com sucesso.');
        sessionStorage.clear();
        window.location.href = 'index.html';
      } else {
        alert(data.erro || 'Não foi possível excluir a conta.');
      }
    } catch (err) {
      alert('Erro de conexão ao solicitar exclusão de conta.');
    }
  }

  function abrirModal() {
    renderizarModal();
    const overlay = document.getElementById('dpConfigModalOverlay');
    if (overlay) {
      atualizarConteudoConta();
      overlay.classList.add('active');
    }
  }

  function fecharModal() {
    const overlay = document.getElementById('dpConfigModalOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  // 5. Injetar o Botão de Configurações e Ajuda
  function criarBotaoFixo() {
    if (document.getElementById('dpBtnConfigFixed')) return;

    // Remover botão anterior de device se existir para não ficar disputando espaço
    const oldBtn = document.getElementById('floatingDeviceSwitch');
    if (oldBtn) oldBtn.style.display = 'none';

    // 1. Botão de Ajuda (FAQ / Central de Dúvidas)
    const btnAjuda = document.createElement('a');
    btnAjuda.id = 'dpBtnAjudaTop';
    btnAjuda.className = 'dp-btn-action-pill';
    btnAjuda.href = 'faq.html';
    btnAjuda.setAttribute('title', 'Perguntas Frequentes & Suporte');
    btnAjuda.innerHTML = `
      <i class="fas fa-circle-question help-icon"></i>
      <span>Ajuda</span>
    `;

    // 2. Botão de Configurações
    const btnConfig = document.createElement('button');
    btnConfig.id = 'dpBtnConfigFixed';
    btnConfig.className = 'dp-btn-action-pill';
    btnConfig.setAttribute('type', 'button');
    btnConfig.setAttribute('title', 'Configurações, Acessibilidade e Conta');
    btnConfig.innerHTML = `
      <i class="fas fa-gear gear-icon"></i>
      <span>Configurações</span>
    `;
    btnConfig.addEventListener('click', abrirModal);

    // Verificar se a tela possui o navbar com a área da direita (.mcd-nav-right)
    const navRight = document.querySelector('.mcd-nav-right');
    if (navRight) {
      // Inserir de forma nativa e alinhada dentro da barra superior no lado direito
      navRight.appendChild(btnAjuda);
      navRight.appendChild(btnConfig);
    } else {
      // Caso seja tela sem navbar (ex: login.html ou cadastro.html), criar container fixo no canto superior direito
      const container = document.createElement('div');
      container.id = 'dpTopActionsContainer';
      container.className = 'dp-top-actions-container';
      container.appendChild(btnAjuda);
      container.appendChild(btnConfig);
      document.body.appendChild(container);
    }
  }

  // 6. Inicialização
  function init() {
    // Restaurar acessibilidade salva
    if (localStorage.getItem('dp_fonte_zoom')) {
      document.documentElement.style.fontSize = `${localStorage.getItem('dp_fonte_zoom')}%`;
    }
    if (localStorage.getItem('dp_alto_contraste') === '1') {
      document.body.classList.add('modo-alto-contraste');
    }
    if (localStorage.getItem('dp_modo_dislexia') === '1') {
      document.body.classList.add('modo-dislexia');
    }

    // Restaurar dispositivo salvo
    const modoSalvo = localStorage.getItem(STORAGE_DEVICE_KEY);
    if (modoSalvo === 'mobile') {
      document.documentElement.classList.add('mode-mobile');
      document.body.classList.add('mode-mobile');
    } else if (modoSalvo === 'desktop') {
      document.documentElement.classList.add('mode-desktop');
      document.body.classList.add('mode-desktop');
    }

    criarBotaoFixo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
