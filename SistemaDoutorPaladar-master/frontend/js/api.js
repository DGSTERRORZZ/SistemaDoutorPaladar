// =============================================
// API.JS - Conexão com o backend
// =============================================
const API_URL = 'http://localhost:3000/api';

function getToken() {
  return sessionStorage.getItem('token');
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  const res = await fetch(`${API_URL}${url}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ erro: 'Erro desconhecido' }));
    throw new Error(error.erro || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

// =============================================
// PRODUTOS
// =============================================
async function getProdutos() {
  return await apiFetch('/produtos');
}

async function salvarProdutos(produtos) {
  // Não usado
}

async function adicionarProduto(produto) {
  return await apiFetch('/produtos', {
    method: 'POST',
    body: JSON.stringify(produto)
  });
}

async function atualizarProduto(id, dados) {
  return await apiFetch(`/produtos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados)
  });
}

async function deletarProduto(id) {
  await apiFetch(`/produtos/${id}`, { method: 'DELETE' });
}

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

// =============================================
// VENDAS
// =============================================
async function getVendas() {
  return await apiFetch('/vendas');
}

async function salvarVendas(vendas) {
  // Não necessário
}

async function registrarVenda(venda) {
  return await apiFetch('/vendas', {
    method: 'POST',
    body: JSON.stringify(venda)
  });
}

async function getVendasPorPeriodo(inicio, fim) {
  const vendas = await getVendas();
  const inicioDate = new Date(inicio);
  const fimDate = new Date(fim);
  fimDate.setHours(23, 59, 59);
  return vendas.filter(v => {
    const data = new Date(v.data);
    return data >= inicioDate && data <= fimDate;
  });
}

async function getTotalVendasPeriodo(inicio, fim) {
  const vendas = await getVendasPorPeriodo(inicio, fim);
  return vendas.reduce((s, v) => s + v.total, 0);
}

// =============================================
// FIADO
// =============================================
async function getFiado() {
  const data = await apiFetch('/fiado/clientes');
  return { clientes: data.clientes, historicoPagamentos: data.historicoPagamentos || [] };
}

async function salvarFiado(fiado) {
  // Não usado
}

async function adicionarClienteFiado(nome, turma) {
  return await apiFetch('/fiado/clientes', {
    method: 'POST',
    body: JSON.stringify({ nome, turma })
  });
}

async function registrarCompraFiado(clienteId, itens, total) {
  return await apiFetch('/fiado/compras', {
    method: 'POST',
    body: JSON.stringify({ clienteId, itens, total })
  });
}

async function registrarPagamentoFiado(clienteId, dividaId, valor) {
  await apiFetch('/fiado/pagamentos', {
    method: 'POST',
    body: JSON.stringify({ clienteId, dividaId, valor })
  });
  return true;
}

async function getTotalFiadoPendente() {
  const fiado = await getFiado();
  let total = 0;
  fiado.clientes.forEach(c => {
    c.dividas.forEach(d => {
      if (!d.pago) total += (d.total - d.valorPago);
    });
  });
  return total;
}

async function getClienteFiado(id) {
  const fiado = await getFiado();
  return fiado.clientes.find(c => c.id === id) || null;
}

// =============================================
// DESPESAS
// =============================================
async function getDespesas() {
  return await apiFetch('/despesas');
}

async function salvarDespesas(despesas) {
  // Não usado
}

async function adicionarDespesa(descricao, valor, categoria = 'Insumos', data = null) {
  return await apiFetch('/despesas', {
    method: 'POST',
    body: JSON.stringify({ descricao, valor, categoria, data })
  });
}

async function getTotalDespesasPeriodo(inicio, fim) {
  const despesas = await getDespesas();
  const inicioDate = new Date(inicio);
  const fimDate = new Date(fim);
  fimDate.setHours(23, 59, 59);
  return despesas
    .filter(d => {
      const data = new Date(d.data);
      return data >= inicioDate && data <= fimDate;
    })
    .reduce((s, d) => s + d.valor, 0);
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}
function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}
function formatarDataHora(data) {
  return new Date(data).toLocaleString('pt-BR');
}
function getDataAtual() {
  return new Date().toISOString().split('T')[0];
}
function getInicioMes() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
}
async function getEstatisticasGerais() {
  const hoje = getDataAtual();
  const inicioMes = getInicioMes();
  const vendasHoje = await getVendasPorPeriodo(hoje, hoje);
  const totalVendasHoje = vendasHoje.reduce((s, v) => s + v.total, 0);
  const vendasMes = await getVendasPorPeriodo(inicioMes, hoje);
  const totalVendasMes = vendasMes.reduce((s, v) => s + v.total, 0);
  const despesasMes = await getTotalDespesasPeriodo(inicioMes, hoje);
  const lucroMes = totalVendasMes - despesasMes;
  const totalFiado = await getTotalFiadoPendente();
  const produtosBaixoEstoque = await getProdutosBaixoEstoque();
  return {
    vendasHoje: totalVendasHoje,
    vendasMes: totalVendasMes,
    despesasMes,
    lucroMes,
    totalFiado,
    qtdVendasHoje: vendasHoje.length,
    alertasEstoque: produtosBaixoEstoque.length,
    produtosBaixoEstoque
  };
}