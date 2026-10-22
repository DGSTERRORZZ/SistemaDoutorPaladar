// =====================================================
// DEVICE SELECTOR & ADAPTIVE EXPERIENCE CONTROLLER
// Permite escolher entre Celular e PC antes de navegar
// =====================================================

(function () {
  const STORAGE_KEY = 'dp_user_device_preference';

  function aplicarModo(modo) {
    if (modo === 'mobile') {
      document.documentElement.classList.add('mode-mobile');
      document.documentElement.classList.remove('mode-desktop');
      if (document.body) {
        document.body.classList.add('mode-mobile');
        document.body.classList.remove('mode-desktop');
      }
    } else {
      document.documentElement.classList.add('mode-desktop');
      document.documentElement.classList.remove('mode-mobile');
      if (document.body) {
        document.body.classList.add('mode-desktop');
        document.body.classList.remove('mode-mobile');
      }
    }
    atualizarBotaoFlutuante(modo);
  }

  function selecionarModo(modo) {
    localStorage.setItem(STORAGE_KEY, modo);
    aplicarModo(modo);

    const overlay = document.getElementById('deviceSelectOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 350);
    }
  }

  function renderizarModal() {
    if (document.getElementById('deviceSelectOverlay')) return;

    // Detectar palpite automático
    const largura = window.innerWidth;
    const isProvavelMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || largura <= 768;

    const overlay = document.createElement('div');
    overlay.id = 'deviceSelectOverlay';
    overlay.className = 'device-select-overlay active';
    overlay.innerHTML = `
      <div class="device-select-card" role="dialog" aria-modal="true">
        <div class="device-select-badge">
          <i class="fas fa-sparkles"></i> Bem-vindo ao Doutor Paladar
        </div>
        <h2 class="device-select-title">Você está no Celular ou no PC?</h2>
        <p class="device-select-subtitle">
          Escolha como prefere visualizar o cardápio para ajustarmos a tela, botões e imagens perfeitamente.
        </p>

        <div class="device-select-grid">
          <button type="button" class="device-option-btn ${isProvavelMobile ? 'active-choice' : ''}" id="btnEscolherCelular">
            <div class="device-option-icon">
              <i class="fas fa-mobile-screen-button"></i>
            </div>
            <h3 class="device-option-name">Celular</h3>
            <p class="device-option-desc">Tela em pé vertical, 2 colunas e botões fáceis de tocar.</p>
          </button>

          <button type="button" class="device-option-btn ${!isProvavelMobile ? 'active-choice' : ''}" id="btnEscolherPC">
            <div class="device-option-icon">
              <i class="fas fa-laptop"></i>
            </div>
            <h3 class="device-option-name">Computador / PC</h3>
            <p class="device-option-desc">Layout panorâmico largo para monitores e notebooks.</p>
          </button>
        </div>

        <div class="device-select-footer">
          <i class="fas fa-rotate"></i>
          <span>Você poderá alternar a qualquer momento no botão inferior.</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btnEscolherCelular').addEventListener('click', () => selecionarModo('mobile'));
    document.getElementById('btnEscolherPC').addEventListener('click', () => selecionarModo('desktop'));
  }

  function atualizarBotaoFlutuante(modoAtual) {
    let btn = document.getElementById('floatingDeviceSwitch');
    if (!btn && document.body) {
      btn = document.createElement('button');
      btn.id = 'floatingDeviceSwitch';
      btn.className = 'floating-device-switch';
      btn.setAttribute('title', 'Clique para trocar entre modo Celular e PC');
      btn.addEventListener('click', () => {
        const modoNovo = document.body.classList.contains('mode-mobile') ? 'desktop' : 'mobile';
        localStorage.setItem(STORAGE_KEY, modoNovo);
        aplicarModo(modoNovo);
      });
      document.body.appendChild(btn);
    }

    if (btn) {
      if (modoAtual === 'mobile') {
        btn.innerHTML = '<i class="fas fa-mobile-screen-button"></i> <span>Modo Celular (Em Pé)</span> · <small style="opacity:0.8;">Trocar p/ PC</small>';
      } else {
        btn.innerHTML = '<i class="fas fa-laptop"></i> <span>Modo PC</span> · <small style="opacity:0.8;">Trocar p/ Celular</small>';
      }
    }
  }

  function inicializar() {
    const params = new URLSearchParams(window.location.search);
    const forcarModo = params.get('modo'); // Permite testar via ?modo=mobile ou ?modo=desktop

    if (forcarModo) {
      localStorage.setItem(STORAGE_KEY, forcarModo);
      aplicarModo(forcarModo);
      return;
    }

    const modoSalvo = localStorage.getItem(STORAGE_KEY);

    if (modoSalvo) {
      aplicarModo(modoSalvo);
    } else {
      // Se estiver no celular (largura <= 768px), aplica modo mobile por padrão e abre a pergunta para confirmar
      const largura = window.innerWidth;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || largura <= 768;
      aplicarModo(isMobileDevice ? 'mobile' : 'desktop');
      renderizarModal();
    }
  }

  // Aplica classe imediatamente para evitar "FOUC"
  const modoSalvoPrevio = localStorage.getItem(STORAGE_KEY);
  if (modoSalvoPrevio) {
    document.documentElement.classList.add(modoSalvoPrevio === 'mobile' ? 'mode-mobile' : 'mode-desktop');
  } else if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768) {
    document.documentElement.classList.add('mode-mobile');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
