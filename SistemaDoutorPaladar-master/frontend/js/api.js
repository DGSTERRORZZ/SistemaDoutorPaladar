// =============================================
// API.JS - Conexão com o backend (Reformulado)
// =============================================
const API_URL = window.location.origin + '/api';

function getToken() {
  return sessionStorage.getItem('token');
}

// Fetch com timeout, tratamento de erro e retry
async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_URL}${url}`, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (res.status === 401) {
      sessionStorage.setItem('mensagemExpiracao', 'Sessão expirada. Faça login novamente.');
      logout();
      return;
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ erro: 'Erro desconhecido' }));
      throw new Error(error.erro || res.statusText);
    }

    if (res.status === 204) return null;
    return res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Tempo de conexão esgotado. Verifique o servidor.');
    }
    throw err;
  }
}

// ===== PRODUTOS =====
async function getProdutos() { return await apiFetch('/produtos'); }
async function adicionarProduto(produto) { return await apiFetch('/produtos', { method: 'POST', body: JSON.stringify(produto) }); }
async function atualizarProduto(id, dados) { return await apiFetch(`/produtos/${id}`, { method: 'PUT', body: JSON.stringify(dados) }); }
async function deletarProduto(id) { await apiFetch(`/produtos/${id}`, { method: 'DELETE' }); }

async function getProdutosBaixoEstoque() {
  const produtos = await getProdutos();
  return produtos.filter(p => p.estoque <= p.estoqueMinimo);
}

async function atualizarEstoque(id, quantidade, operacao = 'subtract') {
  const produtos = await getProdutos();
  const produto = produtos.find(p => p.id === id);
  if (!produto) return false;
  let novoEstoque = produto.estoque;
  if (operacao === 'add') novoEstoque += quantidade;
  else if (operacao === 'subtract') novoEstoque = Math.max(0, novoEstoque - quantidade);
  else if (operacao === 'set') novoEstoque = Math.max(0, quantidade);
  await atualizarProduto(id, { estoque: novoEstoque });
  return true;
}

// ===== VENDAS =====
async function getVendas() { return await apiFetch('/vendas'); }
async function registrarVenda(venda) { return await apiFetch('/vendas', { method: 'POST', body: JSON.stringify(venda) }); }

async function getVendasPorPeriodo(inicio, fim) {
  const vendas = await getVendas();
  return vendas.filter(v => {
    const dataVenda = v.data.split('T')[0];
    return dataVenda >= inicio && dataVenda <= fim;
  });
}

async function getTotalVendasPeriodo(inicio, fim) {
  const vendas = await getVendasPorPeriodo(inicio, fim);
  return vendas.reduce((s, v) => s + v.total, 0);
}

// ===== FIADO =====
async function getFiado() {
  const data = await apiFetch('/fiado/clientes');
  return { clientes: data.clientes || [], historicoPagamentos: data.historicoPagamentos || [] };
}

async function adicionarClienteFiado(nome, turma) {
  return await apiFetch('/fiado/clientes', { method: 'POST', body: JSON.stringify({ nome, turma }) });
}

async function registrarCompraFiado(clienteId, itens, total) {
  return await apiFetch('/fiado/compras', { method: 'POST', body: JSON.stringify({ clienteId, itens, total }) });
}

async function registrarPagamentoFiado(clienteId, dividaId, valor) {
  await apiFetch('/fiado/pagamentos', { method: 'POST', body: JSON.stringify({ clienteId, dividaId, valor }) });
  return true;
}

async function getTotalFiadoPendente() {
  const fiado = await getFiado();
  let total = 0;
  fiado.clientes.forEach(c => {
    c.dividas.forEach(d => {
      if (!d.pago) total += (d.total - (d.valorPago || 0));
    });
  });
  return total;
}

async function getClienteFiado(id) {
  const fiado = await getFiado();
  return fiado.clientes.find(c => c.id === id) || null;
}

// ===== DESPESAS =====
async function getDespesas() { return await apiFetch('/despesas'); }
async function adicionarDespesa(descricao, valor, categoria = 'Insumos', data = null) {
  return await apiFetch('/despesas', { method: 'POST', body: JSON.stringify({ descricao, valor, categoria, data }) });
}

async function getTotalDespesasPeriodo(inicio, fim) {
  const despesas = await getDespesas();
  return despesas.filter(d => {
    const data = d.data.split('T')[0];
    return data >= inicio && data <= fim;
  }).reduce((s, d) => s + d.valor, 0);
}

// ===== FORMATAÇÃO =====
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function formatarData(data) {
  try { return new Date(data).toLocaleDateString('pt-BR'); }
  catch { return data; }
}

function formatarDataHora(data) {
  try { return new Date(data).toLocaleString('pt-BR'); }
  catch { return data; }
}

function getDataAtual() { return new Date().toISOString().split('T')[0]; }

function getInicioMes() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
}

// ===== ESTATÍSTICAS =====
async function getEstatisticasGerais() {
  const hoje = getDataAtual();
  const inicioMes = getInicioMes();

  const [vendas, despesas, fiado, produtosBaixo] = await Promise.all([
    getVendas(),
    getDespesas(),
    getFiado(),
    getProdutosBaixoEstoque()
  ]);

  const vendasHoje = vendas.filter(v => v.data.split('T')[0] === hoje);
  const totalVendasHoje = vendasHoje.reduce((s, v) => s + v.total, 0);

  const vendasMes = vendas.filter(v => {
    const d = v.data.split('T')[0];
    return d >= inicioMes && d <= hoje;
  });
  const totalVendasMes = vendasMes.reduce((s, v) => s + v.total, 0);

  const despesasMes = despesas.filter(d => {
    const dt = d.data.split('T')[0];
    return dt >= inicioMes && dt <= hoje;
  }).reduce((s, d) => s + d.valor, 0);

  const lucroMes = totalVendasMes - despesasMes;

  let totalFiado = 0;
  fiado.clientes.forEach(c => {
    c.dividas.forEach(d => {
      if (!d.pago) totalFiado += (d.total - (d.valorPago || 0));
    });
  });

  return {
    vendasHoje: totalVendasHoje,
    vendasMes: totalVendasMes,
    despesasMes,
    lucroMes,
    totalFiado,
    qtdVendasHoje: vendasHoje.length,
    alertasEstoque: produtosBaixo.length,
    produtosBaixoEstoque: produtosBaixo
  };
}

// ===== SANITIZAÇÃO (Anti-XSS) =====
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// ===== DEBOUNCE =====
function debounce(func, wait = 300) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'success', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    toast.style.transition = 'all 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, duration);
}
