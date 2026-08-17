// =============================================
// API.JS - Conexão com o backend
// =============================================
const API_URL = 'http://localhost:3000/api';

function getToken() {
  return sessionStorage.getItem('token');
}

function getClienteToken() {
  return sessionStorage.getItem('cliente_token');
}

function getAdminToken() {
  return sessionStorage.getItem('admin_token');
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

// ===== CLIENTES APP (CADASTRO/LOGIN/PEFRIL) =====
async function cadastrarClienteApp(nome, telefone, turma, senha) {
  const res = await fetch(`${API_URL}/clientes/cadastrar`, {
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
  }
  return { ok: res.ok, data };
}

async function loginClienteApp(telefone, senha) {
  const res = await fetch(`${API_URL}/clientes/login`, {
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
  }
  return { ok: res.ok, data };
}

async function getPerfilCliente() {
  const token = getClienteToken();
  if (!token) return null;
  const res = await fetch(`${API_URL}/clientes/perfil`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}

function logoutCliente() {
  sessionStorage.removeItem('cliente_token');
  sessionStorage.removeItem('cliente_nome');
  sessionStorage.removeItem('cliente_id');
  sessionStorage.removeItem('cliente_telefone');
  sessionStorage.removeItem('cliente_turma');
  sessionStorage.removeItem('cliente_data');
}

// ===== ADMIN AUTH =====
function isAdminLogado() {
  return sessionStorage.getItem('admin_logado') === 'true';
}

function logoutAdmin() {
  sessionStorage.removeItem('admin_logado');
  sessionStorage.removeItem('admin_nome');
  sessionStorage.removeItem('admin_token');
}

// =============================================
// PRODUTOS
// =============================================
async function getProdutos() {
  return await apiFetch('/produtos');
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
  return produtos.filter(p => p.estoque <= (p.estoqueMinimo || 10));
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
  return vendas.reduce((s, v) => s + (v.total || 0), 0);
}

// =============================================
// CONTAS A RECEBER (ex-Fiado)
// =============================================
async function getContasReceber() {
  const data = await apiFetch('/fiado/clientes');
  return { clientes: data.clientes || [], historicoPagamentos: data.historicoPagamentos || [] };
}

async function adicionarClienteContasReceber(nome, turma) {
  return await apiFetch('/fiado/clientes', {
    method: 'POST',
    body: JSON.stringify({ nome, turma })
  });
}

async function registrarCompraContasReceber(clienteId, itens, total) {
  return await apiFetch('/fiado/compras', {
    method: 'POST',
    body: JSON.stringify({ clienteId, itens, total })
  });
}

async function registrarPagamentoContasReceber(clienteId, dividaId, valor) {
  await apiFetch('/fiado/pagamentos', {
    method: 'POST',
    body: JSON.stringify({ clienteId, dividaId, valor })
  });
  return true;
}

async function getTotalContasReceberPendente() {
  const dados = await getContasReceber();
  let total = 0;
  dados.clientes.forEach(c => {
    c.dividas.forEach(d => {
      if (!d.pago) total += (d.total - (d.valorPago || 0));
    });
  });
  return total;
}

async function getClienteContasReceber(id) {
  const dados = await getContasReceber();
  return dados.clientes.find(c => c.id === id) || null;
}

// =============================================
// DESPESAS
// =============================================
async function getDespesas() {
  return await apiFetch('/despesas');
}

async function adicionarDespesa(descricao, valor, categoria = 'Insumos', data = null) {
  return await apiFetch('/despesas', {
    method: 'POST',
    body: JSON.stringify({ descricao, valor, categoria, data })
  });
}

async function atualizarDespesa(id, descricao, valor, categoria, data) {
  // Primeiro busca, depois atualiza (simplificado)
  const despesas = await getDespesas();
  const despesa = despesas.find(d => d.id === id);
  if (!despesa) return false;
  return await apiFetch(`/despesas/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ descricao: descricao || despesa.descricao, valor: valor || despesa.valor, categoria: categoria || despesa.categoria, data: data || despesa.data })
  });
}

async function deletarDespesa(id) {
  await apiFetch(`/despesas/${id}`, { method: 'DELETE' });
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
    .reduce((s, d) => s + (d.valor || 0), 0);
}

// =============================================
// PEDIDOS (Clientes)
// =============================================
async function getPedidos() {
  return await apiFetch('/pedidos');
}

async function criarPedido(nomeCliente, turma, horarioRetirada, itens, total) {
  return await apiFetch('/pedidos', {
    method: 'POST',
    body: JSON.stringify({ nomeCliente, turma, horarioRetirada, itens, total })
  });
}

async function atualizarStatusPedido(id, status) {
  return await apiFetch(`/pedidos/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
}

async function buscarPedidosPorNome(nome) {
  const res = await fetch(`${API_URL}/pedidos/buscar/${encodeURIComponent(nome)}`);
  if (!res.ok) return [];
  return res.json();
}

// =============================================
// AGENDAMENTOS
// =============================================
async function getAgendamentos() {
  return await apiFetch('/agendamentos');
}

async function criarAgendamento(horarioInicio, horarioFim, limitePedidos) {
  return await apiFetch('/agendamentos', {
    method: 'POST',
    body: JSON.stringify({ horarioInicio, horarioFim, limitePedidos })
  });
}

async function atualizarAgendamento(id, dados) {
  return await apiFetch(`/agendamentos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados)
  });
}

async function deletarAgendamento(id) {
  await apiFetch(`/agendamentos/${id}`, { method: 'DELETE' });
}

// =============================================
// FORNECEDORES
// =============================================
async function getFornecedores() {
  return await apiFetch('/fornecedores');
}

async function adicionarFornecedor(fornecedor) {
  return await apiFetch('/fornecedores', {
    method: 'POST',
    body: JSON.stringify(fornecedor)
  });
}

async function atualizarFornecedor(id, fornecedor) {
  return await apiFetch(`/fornecedores/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fornecedor)
  });
}

async function deletarFornecedor(id) {
  await apiFetch(`/fornecedores/${id}`, { method: 'DELETE' });
}

async function registrarCompraFornecedor(fornecedorId, itens, total) {
  return await apiFetch(`/fornecedores/${fornecedorId}/compras`, {
    method: 'POST',
    body: JSON.stringify({ itens, total, status: 'pedido' })
  });
}

// =============================================
// CONFIGURAÇÕES
// =============================================
async function getConfiguracoes() {
  return await apiFetch('/configuracoes');
}

async function atualizarConfiguracao(chave, valor) {
  return await apiFetch(`/configuracoes/${chave}`, {
    method: 'PUT',
    body: JSON.stringify({ valor })
  });
}

async function alterarSenhaAdmin(senhaAtual, novaSenha) {
  const token = getToken();
  const res = await fetch(`${API_URL}/configuracoes/alterar-senha`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ senhaAtual, novaSenha })
  });
  return res.ok;
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
  const totalVendasHoje = vendasHoje.reduce((s, v) => s + (v.total || 0), 0);
  const vendasMes = await getVendasPorPeriodo(inicioMes, hoje);
  const totalVendasMes = vendasMes.reduce((s, v) => s + (v.total || 0), 0);
  const despesasMes = await getTotalDespesasPeriodo(inicioMes, hoje);
  const lucroMes = totalVendasMes - despesasMes;
  const totalContasReceber = await getTotalContasReceberPendente();
  const produtosBaixoEstoque = await getProdutosBaixoEstoque();
  return {
    vendasHoje: totalVendasHoje,
    vendasMes: totalVendasMes,
    despesasMes,
    lucroMes,
    totalFiado: totalContasReceber,
    qtdVendasHoje: vendasHoje.length,
    alertasEstoque: produtosBaixoEstoque.length,
    produtosBaixoEstoque
  };
}

// ===== ALIASES para compatibilidade com código legado =====
// Manter funções antigas para não quebrar outros arquivos
const getFiado = getContasReceber;
const adicionarClienteFiado = adicionarClienteContasReceber;
const registrarCompraFiado = registrarCompraContasReceber;
const registrarPagamentoFiado = registrarPagamentoContasReceber;
const getTotalFiadoPendente = getTotalContasReceberPendente;
const getClienteFiado = getClienteContasReceber;