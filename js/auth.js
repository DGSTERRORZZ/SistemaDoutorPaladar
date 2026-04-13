// =============================================
// AUTH.JS - Controle de Autenticação
// =============================================

const ADMIN_CREDENTIALS = {
    username: 'Pablo',
    password: 'admin123'
};

function autenticarUsuario(username, password) {
    return username === ADMIN_CREDENTIALS.username && 
           password === ADMIN_CREDENTIALS.password;
}

function verificarAutenticacao() {
    const usuarioLogado = sessionStorage.getItem('usuarioLogado');
    const loginTime = sessionStorage.getItem('loginTime');
    
    if (!usuarioLogado || usuarioLogado !== 'Pablo') {
        window.location.href = 'index.html';
        return false;
    }
    
    // Verificar se a sessão expirou (4 horas)
    if (loginTime) {
        const tempoLogin = new Date(loginTime);
        const agora = new Date();
        const horasDiff = (agora - tempoLogin) / (1000 * 60 * 60);
        
        if (horasDiff > 4) {
            logout();
            return false;
        }
    }
    
    return true;
}

function logout() {
    sessionStorage.removeItem('usuarioLogado');
    sessionStorage.removeItem('loginTime');
    window.location.href = 'index.html';
}

function getUsuarioLogado() {
    return sessionStorage.getItem('usuarioLogado');
}

// Adicionar botão de logout em todas as páginas
function adicionarBotaoLogout() {
    const header = document.querySelector('header, .main-header, .header');
    if (header) {
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn-logout';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair';
        logoutBtn.onclick = logout;
        header.appendChild(logoutBtn);
    }
}

console.log('🔒 Auth.js carregado');