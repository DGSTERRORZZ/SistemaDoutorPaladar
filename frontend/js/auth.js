// =============================================
// AUTH.JS - Controle de Autenticação (API + Admin + Cliente)
// =============================================

// ===== ADMIN AUTH =====
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD_HASH = 'admin123'; // Em produção, isso viria do backend

async function autenticarAdmin(username, password) {
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) return false;
    const data = await res.json();
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('usuarioLogado', data.nome || username);
    sessionStorage.setItem('loginTime', new Date().toISOString());
    sessionStorage.setItem('admin_logado', 'true');
    sessionStorage.setItem('admin_nome', data.nome || 'Administrador');
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

function verificarAdmin() {
  const adminLogado = sessionStorage.getItem('admin_logado');
  const token = sessionStorage.getItem('token');
  if (!adminLogado || !token) {
    return false;
  }
  return true;
}

function isAdminLogado() {
  return sessionStorage.getItem('admin_logado') === 'true';
}

function getAdminNome() {
  return sessionStorage.getItem('admin_nome') || 'Gestor Master';
}

function logoutAdmin() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('usuarioLogado');
  sessionStorage.removeItem('loginTime');
  sessionStorage.removeItem('admin_logado');
  sessionStorage.removeItem('admin_nome');
  window.location.href = 'index.html';
}

// ===== CLIENTE AUTH (App) =====
function isClienteLogado() {
  const token = sessionStorage.getItem('cliente_token');
  const nome = sessionStorage.getItem('cliente_nome');
  const id = sessionStorage.getItem('cliente_id');
  return !!(token && nome && id);
}

function getClienteLogado() {
  if (!isClienteLogado()) return null;
  return {
    id: parseInt(sessionStorage.getItem('cliente_id')),
    nome: sessionStorage.getItem('cliente_nome'),
    token: sessionStorage.getItem('cliente_token'),
    telefone: sessionStorage.getItem('cliente_telefone'),
    turma: sessionStorage.getItem('cliente_turma'),
    dataCadastro: sessionStorage.getItem('cliente_data')
  };
}

function logoutCliente() {
  sessionStorage.removeItem('cliente_token');
  sessionStorage.removeItem('cliente_nome');
  sessionStorage.removeItem('cliente_id');
  sessionStorage.removeItem('cliente_telefone');
  sessionStorage.removeItem('cliente_turma');
  sessionStorage.removeItem('cliente_data');
  window.location.href = 'index.html';
}

// ===== ADMIN AUTH (via token do backend) =====
async function autenticarUsuario(username, password) {
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) return false;
    const data = await res.json();
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('usuarioLogado', data.nome || username);
    sessionStorage.setItem('loginTime', new Date().toISOString());
    sessionStorage.setItem('admin_logado', 'true');
    sessionStorage.setItem('admin_nome', data.nome || 'Administrador');
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

function verificarAutenticacao() {
  const usuario = sessionStorage.getItem('usuarioLogado');
  const token = sessionStorage.getItem('token');
  const loginTime = sessionStorage.getItem('loginTime');
  if (!usuario || !token) {
    window.location.href = 'index.html';
    return false;
  }
  if (loginTime) {
    const horas = (new Date() - new Date(loginTime)) / 36e5;
    if (horas > 8) {
      logout();
      return false;
    }
  }
  return true;
}

function logout() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}

function getUsuarioLogado() {
  return sessionStorage.getItem('usuarioLogado');
}

// ===== CLIENTE AUTH (via API do backend) =====
async function loginCliente(telefone, senha) {
  try {
    const res = await fetch('http://localhost:3000/api/clientes/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: telefone, senha })
    });
    const data = await res.json();
    if (res.ok) {
      sessionStorage.setItem('cliente_token', data.token);
      sessionStorage.setItem('cliente_nome', data.nome);
      sessionStorage.setItem('cliente_id', data.id);
      sessionStorage.setItem('cliente_telefone', telefone);
      if (data.turma) sessionStorage.setItem('cliente_turma', data.turma);
      if (!sessionStorage.getItem('cliente_data')) {
        sessionStorage.setItem('cliente_data', new Date().toISOString().split('T')[0]);
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function cadastrarCliente(nome, telefone, turma, senha) {
  try {
    const res = await fetch('http://localhost:3000/api/clientes/cadastrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone, turma, senha })
    });
    const data = await res.json();
    if (res.ok) {
      sessionStorage.setItem('cliente_token', data.token);
      sessionStorage.setItem('cliente_nome', data.nome);
      sessionStorage.setItem('cliente_id', data.id);
      sessionStorage.setItem('cliente_telefone', telefone);
      if (turma) sessionStorage.setItem('cliente_turma', turma);
      sessionStorage.setItem('cliente_data', new Date().toISOString().split('T')[0]);
      return true;
    }
    return false;
  } catch (err) {
    console.error(err);
    return false;
  }
}

function verificarClienteLogado() {
  const token = sessionStorage.getItem('cliente_token');
  const nome = sessionStorage.getItem('cliente_nome');
  const id = sessionStorage.getItem('cliente_id');
  return !!(token && nome && id);
}

// ===== FUNÇÃO GERAL DE LOGOUT =====
function logoutGeral() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}

// Sincronização Imediata (executa antes de carregar o DOM completo para evitar "pulo" de tela)
(function aplicarPreferenciaImediata() {
  try {
    if (localStorage.getItem('dp_theme') === 'dark') {
      document.documentElement.classList.add('dark-mode');
    }
    if (window.innerWidth > 900 && localStorage.getItem('dp_sidebar_collapsed') === 'true') {
      document.documentElement.classList.add('sidebar-is-collapsed');
    }
  } catch(e) {}
})();

// ===== SUPORTE GLOBAL A TEMA E SIDEBAR (INSPIRADO NO PULSE) =====
function toggleTema() {
  const isDark = document.body.classList.toggle('dark-mode');
  document.documentElement.classList.toggle('dark-mode', isDark);
  localStorage.setItem('dp_theme', isDark ? 'dark' : 'light');
  atualizarIconeTema();
}

function inicializarTema() {
  const salvo = localStorage.getItem('dp_theme');
  if (salvo === 'dark') {
    document.body.classList.add('dark-mode');
    document.documentElement.classList.add('dark-mode');
  }
  atualizarIconeTema();
}

function atualizarIconeTema() {
  const btns = document.querySelectorAll('.btn-theme-toggle');
  const isDark = document.body.classList.contains('dark-mode');
  btns.forEach(btn => {
    btn.innerHTML = isDark ? '<i class="fas fa-sun" style="color:#f59e0b"></i>' : '<i class="fas fa-moon" style="color:#64748b"></i>';
    btn.title = isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro';
  });
}

function toggleSidebar() {
  const layout = document.querySelector('.admin-layout');
  if (!layout) return;
  if (window.innerWidth <= 900) {
    layout.classList.toggle('mobile-open');
  } else {
    layout.classList.toggle('sidebar-collapsed');
    const isCollapsed = layout.classList.contains('sidebar-collapsed');
    document.documentElement.classList.toggle('sidebar-is-collapsed', isCollapsed);
    localStorage.setItem('dp_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  }
}

function inicializarSidebar() {
  const layout = document.querySelector('.admin-layout');
  if (!layout) return;
  if (window.innerWidth > 900 && localStorage.getItem('dp_sidebar_collapsed') === 'true') {
    layout.classList.add('sidebar-collapsed');
    document.documentElement.classList.add('sidebar-is-collapsed');
  } else {
    document.documentElement.classList.remove('sidebar-is-collapsed');
  }
}

// ===== RASTREAMENTO INTELIGENTE DE PÁGINA ANTERIOR DO CLIENTE =====
function registrarPaginaAtual() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  const queryStr = window.location.search || '';
  const full = current + queryStr;
  if (!full.includes('login.html') && !full.includes('cadastro.html')) {
    sessionStorage.setItem('dp_last_page', full);
  }
}

function irParaLogin() {
  registrarPaginaAtual();
  const returnUrl = sessionStorage.getItem('dp_last_page') || 'index.html';
  window.location.href = `login.html?returnUrl=${encodeURIComponent(returnUrl)}`;
}

function irParaCadastro() {
  registrarPaginaAtual();
  const returnUrl = sessionStorage.getItem('dp_last_page') || 'index.html';
  window.location.href = `cadastro.html?returnUrl=${encodeURIComponent(returnUrl)}`;
}

// ===== ACESSO SECRETO DO GESTOR (KONAMI CODE: CIMA CIMA BAIXO BAIXO 6 7) =====
const KONAMI_SECRET_SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', '6', '7'];
let konamiBuffer = [];

function inicializarKonamiCode() {
  window.addEventListener('keydown', (e) => {
    // Ignorar se o usuário estiver digitando dentro de um input/textarea/select
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      return;
    }

    const key = e.key;
    konamiBuffer.push(key);

    // Manter buffer do tamanho exato da sequência
    if (konamiBuffer.length > KONAMI_SECRET_SEQUENCE.length) {
      konamiBuffer.shift();
    }

    // Verificar se corresponde à sequência secreta
    const match = KONAMI_SECRET_SEQUENCE.every((k, idx) => {
      if (k === '6' || k === '7') {
        return konamiBuffer[idx] === k || konamiBuffer[idx] === `Numpad${k}`;
      }
      return konamiBuffer[idx] === k;
    });

    if (match) {
      konamiBuffer = [];
      window.location.href = 'admin.html';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  registrarPaginaAtual();
  inicializarTema();
  inicializarSidebar();
  inicializarKonamiCode();
});