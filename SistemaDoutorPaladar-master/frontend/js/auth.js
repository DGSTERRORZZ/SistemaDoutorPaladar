// =============================================
// AUTH.JS - Controle de Autenticação (Reformulado)
// =============================================

async function autenticarUsuario(username, password) {
  try {
    const API_BASE = window.location.origin + '/api';
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) return false;
    const data = await res.json();
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('usuarioLogado', data.usuario);
    sessionStorage.setItem('loginTime', new Date().toISOString());
    return true;
  } catch (err) {
    console.error('Erro de autenticação:', err);
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
    if (horas > 4) {
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
  return sessionStorage.getItem('usuarioLogado') || 'Pablo';
}
