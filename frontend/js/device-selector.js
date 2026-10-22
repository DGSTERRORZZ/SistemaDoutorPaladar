// =====================================================
// DEVICE SELECTOR & ADAPTIVE EXPERIENCE CONTROLLER
// Permite escolher entre Celular e PC antes de navegar
// =====================================================

(function () {
  const STORAGE_KEY = 'dp_user_device_preference';

  function aplicarModo(modo) {
    if (modo === 'mobile') {
      document.body.classList.add('mode-mobile');
      document.body.classList.remove('mode-desktop');
    } else {
      document.body.classList.add('mode-desktop');
      document.body.classList.remove('mode-mobile');
    }
    atualizarBotaoFlutuante(modo);
  }

  function selecionarModo(modo) {
    localStorage.setItem(STORAGE_KEY, modo);
    aplicarModo(modo);

    const overlay = document.getElementById('deviceSelectOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 400);
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
          <i class="fas fa-sparkles"></i> Personalize sua Experiência
        </div>
        <h2 class="device-select-title">Como você está acessando?</h2>
        <p class="device-select-subtitle">
          Adaptamos o cardápio, tamanho das fotos, fontes e botões para a melhor usabilidade no seu dispositivo.
        </p>

        <div class="device-select-grid">
          <button type="button" class="device-option-btn" id="btnEscolherCelular">
            <div class="device-option-icon">
              <i class="fas fa-mobile-screen-button"></i>
            </div>
            <h3 class="device-option-name">Celular</h3>
            <p class="device-option-desc">Cards verticais, botões de toque rápido e sacola móvel.</p>
          </button>

          <button type="button" class="device-option-btn" id="btnEscolherPC">
            <div class="device-option-icon">
              <i class="fas fa-laptop"></i>
            </div>
            <h3 class="device-option-name">Computador / PC</h3>
            <p class="device-option-desc">Grid panorâmica, filtros expansivos e visual cinematográfico.</p>
          </button>
        </div>

        <div class="device-select-footer">
          <i class="fas fa-rotate"></i>
          <span>Você poderá alternar a qualquer momento no canto inferior.</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btnEscolherCelular').addEventListener('click', () => selecionarModo('mobile'));
    document.getElementById('btnEscolherPC').addEventListener('click', () => selecionarModo('desktop'));

    // Destacar o botão sugerido
    if (isProvavelMobile) {
      document.getElementById('btnEscolherCelular').style.borderColor = '#2d7d52';
    } else {
      document.getElementById('btnEscolherPC').style.borderColor = '#2d7d52';
    }
  }

  function atualizarBotaoFlutuante(modoAtual) {
    let btn = document.getElementById('floatingDeviceSwitch');
    if (!btn) {
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

    if (modoAtual === 'mobile') {
      btn.innerHTML = '<i class="fas fa-mobile-screen-button"></i> <span>Modo Celular</span> · <small style="opacity:0.8;">Trocar p/ PC</small>';
    } else {
      btn.innerHTML = '<i class="fas fa-laptop"></i> <span>Modo PC</span> · <small style="opacity:0.8;">Trocar p/ Celular</small>';
    }
  }

  function inicializar() {
    const modoSalvo = localStorage.getItem(STORAGE_KEY);

    if (modoSalvo) {
      aplicarModo(modoSalvo);
    } else {
      renderizarModal();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
