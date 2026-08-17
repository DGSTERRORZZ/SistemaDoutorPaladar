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