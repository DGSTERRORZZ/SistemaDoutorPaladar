// =============================================
// FIADO.JS - Gestão de Fiado (Reformulado)
// =============================================

let clienteSelecionadoId = null;
let carrinhoFiado = [];
let todosClientes = [];
let produtosCache = [];
let filtroStatusFiado = 'todos';
let filtroTurmaFiado = 'todas';

const savedClienteId = sessionStorage.getItem('clienteSelecionadoId');
if (savedClienteId) clienteSelecionadoId = parseInt(savedClienteId);

document.addEventListener('DOMContentLoaded', async function() {
  if (!verificarAutenticacao()) return;
  // Carregar produtos no início para o cache
  try { produtosCache = await getProdutos(); } catch(e) {}
  await carregarTudo();

  // Debounce na busca
  const buscaInput = document.getElementById('buscaCliente');
  if (buscaInput) {
    buscaInput.addEventListener('input', debounce(filtrarClientes, 250));
  }

  // Restaurar seleção
  if (clienteSelecionadoId) {
    await selecionarCliente(clienteSelecionadoId);
  }
});

async function carregarTudo() { await carregarClientes(); await atualizarTotalGeral(); }

async function carregarClientes() {
  try {
    const fiado = await getFiado();
    todosClientes = fiado.clientes || [];
    atualizarFiltroTurmas();
    filtrarClientes();
  } catch (e) { console.error('Erro ao carregar clientes:', e); }
}

function atualizarFiltroTurmas() {
  const select = document.getElementById('filtroTurmaFiado');
  if (!select) return;
  const turmas = [...new Set(todosClientes.map(c => c.turma).filter(Boolean))].sort();
  select.innerHTML = '<option value="todas">Todas as turmas</option>' + turmas.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
}

function filtrarClientes() {
  const termo = (document.getElementById('buscaCliente')?.value || '').toLowerCase();
  filtroStatusFiado = document.getElementById('filtroStatusFiado')?.value || 'todos';
  filtroTurmaFiado = document.getElementById('filtroTurmaFiado')?.value || 'todas';
  let filtrados = todosClientes.filter(cliente => {
    if (termo && !cliente.nome.toLowerCase().includes(termo)) return false;
    if (filtroTurmaFiado !== 'todas' && cliente.turma !== filtroTurmaFiado) return false;
    if (filtroStatusFiado === 'em-dia') { if (cliente.dividas.some(d => !d.pago)) return false; }
    else if (filtroStatusFiado === 'atraso') {
      const trinta = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (!cliente.dividas.some(d => !d.pago && new Date(d.data) < trinta)) return false;
    }
    return true;
  });
  exibirClientes(filtrados);
}

function exibirClientes(clientes) {
  const container = document.getElementById('listaClientes');
  if (!clientes.length) {
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-secondary);"><p style="font-size:2rem;">👤</p><p>Nenhum cliente encontrado</p></div>';
    return;
  }
  container.innerHTML = clientes.map(cliente => {
    const totalDevido = calcularTotalDevidoCliente(cliente);
    const temAtraso = verificarAtraso(cliente);
    return `<div class="cliente-card ${clienteSelecionadoId === cliente.id ? 'active' : ''}" onclick="selecionarCliente(${cliente.id})">
      <div class="cliente-nome">${escapeHtml(cliente.nome)} ${temAtraso ? '<span class="badge badge-danger">Em atraso</span>' : ''}</div>
      <div class="cliente-turma">${escapeHtml(cliente.turma || 'Não informada')}</div>
      <div class="cliente-divida">${formatarMoeda(totalDevido)}</div>
      <div style="font-size:0.85rem;color:var(--text-secondary);">${cliente.dividas.length} compra(s)</div></div>`;
  }).join('');
}

function calcularTotalDevidoCliente(cliente) {
  return cliente.dividas.reduce((s, d) => !d.pago ? s + (d.total - (d.valorPago || 0)) : s, 0);
}

function verificarAtraso(cliente) {
  const t = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return cliente.dividas.some(d => !d.pago && new Date(d.data) < t);
}

async function selecionarCliente(id) {
  clienteSelecionadoId = id;
  sessionStorage.setItem('clienteSelecionadoId', id);
  await carregarClientes();
  await carregarDetalhesCliente(id);
  document.getElementById('painelVazio').style.display = 'none';
  document.getElementById('painelDetalhes').style.display = 'block';
}

async function carregarDetalhesCliente(id) {
  const cliente = await getClienteFiado(id);
  if (!cliente) return;
  document.getElementById('clienteNomeDetalhe').textContent = cliente.nome;
  document.getElementById('clienteTurmaDetalhe').textContent = cliente.turma || 'Não informada';
  document.getElementById('totalDevidoCliente').textContent = formatarMoeda(calcularTotalDevidoCliente(cliente));
  document.getElementById('totalPagoCliente').textContent = formatarMoeda(cliente.dividas.reduce((s, d) => s + (d.valorPago || 0), 0));
  document.getElementById('qtdComprasCliente').textContent = cliente.dividas.length;
  carregarHistoricoCompras(cliente);
}

function carregarHistoricoCompras(cliente) {
  const container = document.getElementById('historicoCompras');
  if (!cliente.dividas.length) {
    container.innerHTML = '<p style="color:var(--text-secondary);">Nenhuma compra registrada</p>';
    return;
  }
  const ord = [...cliente.dividas].sort((a, b) => new Date(b.data) - new Date(a.data));
  container.innerHTML = ord.map(d => {
    const sc = d.pago ? 'status-pago' : (new Date(d.data) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) ? 'status-atraso' : 'status-pendente');
    const st = d.pago ? 'Pago' : (sc === 'status-atraso' ? 'Em atraso' : 'Pendente');
    const itensTexto = d.itens.map(i => {
      const prod = produtosCache.find(p => p.id === i.produtoId);
      return `${i.quantidade}x ${escapeHtml(prod ? prod.nome : 'Produto')}`;
    }).join(', ');
    return `<div class="divida-item"><div class="divida-header"><div><strong>Compra #${d.id}</strong> <span style="color:var(--text-secondary);">${formatarData(d.data)}</span></div><span class="${sc}" style="font-weight:700;">${st}</span></div>
    <div style="font-size:0.9rem;color:var(--text-secondary);">${itensTexto}</div>
    <div style="display:flex;justify-content:space-between;margin-top:0.5rem;"><strong>Total: ${formatarMoeda(d.total)}</strong><span>Pago: ${formatarMoeda(d.valorPago || 0)} ${!d.pago ? `| Restante: ${formatarMoeda(d.total - (d.valorPago || 0))}` : ''}</span></div></div>`;
  }).join('');
}

async function atualizarTotalGeral() {
  document.getElementById('totalGeralFiado').textContent = formatarMoeda(await getTotalFiadoPendente());
}

function abrirModalNovoCliente() { document.getElementById('modalNovoCliente').classList.add('active'); }
function fecharModal(id) { document.getElementById(id).classList.remove('active'); }

async function cadastrarCliente(event) {
  event.preventDefault();
  const nome = document.getElementById('novoClienteNome').value.trim();
  const turma = document.getElementById('novoClienteTurma').value.trim();
  if (!nome || nome.length < 3) { showToast('Nome deve ter pelo menos 3 caracteres', 'warning'); return; }
  try {
    const novo = await adicionarClienteFiado(nome, turma);
    if (novo) {
      fecharModal('modalNovoCliente');
      document.getElementById('formNovoCliente').reset();
      await carregarTudo();
      selecionarCliente(novo.id);
      showToast('Cliente cadastrado!', 'success');
    }
  } catch (e) { showToast('Erro ao cadastrar', 'error'); }
}

async function abrirModalNovaCompra() {
  if (!clienteSelecionadoId) { showToast('Selecione um cliente', 'warning'); return; }
  const cliente = await getClienteFiado(clienteSelecionadoId);
  document.getElementById('clienteSelecionadoInfo').innerHTML = `<strong>${escapeHtml(cliente.nome)}</strong> · ${escapeHtml(cliente.turma || 'Não informada')}`;
  await carregarProdutosParaFiado();
  carrinhoFiado = [];
  atualizarResumoCompra();
  document.getElementById('modalNovaCompra').classList.add('active');
}

async function carregarProdutosParaFiado() {
  try {
    produtosCache = await getProdutos();
    const container = document.getElementById('listaProdutosFiado');
    const categorias = [...new Set(produtosCache.map(p => p.categoria))];
    container.innerHTML = categorias.map(cat => {
      const prods = produtosCache.filter(p => p.categoria === cat && p.estoque > 0);
      if (!prods.length) return '';
      return `<div style="margin-bottom:1rem;"><h5 style="color:var(--primary);margin-bottom:0.5rem;">${escapeHtml(cat)}</h5>` +
        prods.map(p => `<div class="produto-selector flex-between" style="padding:0.6rem;border:1px solid var(--border-color);border-radius:var(--radius-xs);margin-bottom:0.4rem;">
          <div><strong>${escapeHtml(p.nome)}</strong><br><small style="color:var(--text-secondary);">${formatarMoeda(p.preco)} · Estoque: ${p.estoque}</small></div>
          <input type="number" id="qtd_${p.id}" min="0" max="${p.estoque}" value="0" onchange="atualizarCarrinhoFiado(${p.id},this.value)" style="width:70px;padding:0.4rem;border:1px solid var(--border-color);border-radius:8px;text-align:center;"></div>`).join('') + '</div>';
    }).join('');
  } catch (e) { console.error(e); }
}

function atualizarCarrinhoFiado(produtoId, quantidade) {
  quantidade = parseInt(quantidade) || 0;
  carrinhoFiado = carrinhoFiado.filter(i => i.produtoId !== produtoId);
  if (quantidade > 0) {
    const p = produtosCache.find(p => p.id === produtoId);
    if (p && quantidade <= p.estoque) carrinhoFiado.push({ produtoId, quantidade, precoUnitario: p.preco });
    else { showToast('Quantidade indisponível!', 'warning'); document.getElementById(`qtd_${produtoId}`).value = 0; }
  }
  atualizarResumoCompra();
}

function atualizarResumoCompra() {
  const c = document.getElementById('resumoCompraFiado');
  const t = document.getElementById('totalCompraFiado');
  if (!carrinhoFiado.length) { c.innerHTML = '<p style="color:var(--text-secondary);">Nenhum produto selecionado</p>'; t.textContent = 'R$ 0,00'; return; }
  let total = 0;
  c.innerHTML = carrinhoFiado.map(i => {
    const p = produtosCache.find(p => p.id === i.produtoId);
    const s = i.quantidade * i.precoUnitario;
    total += s;
    return `<div class="flex-between" style="padding:0.3rem 0;"><span>${i.quantidade}x ${escapeHtml(p?.nome || 'Produto')}</span><span>${formatarMoeda(s)}</span></div>`;
  }).join('');
  t.textContent = formatarMoeda(total);
}

async function finalizarCompraFiado() {
  if (!carrinhoFiado.length) { showToast('Selecione itens', 'warning'); return; }
  const total = carrinhoFiado.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
  try {
    await registrarCompraFiado(clienteSelecionadoId, carrinhoFiado, total);
    fecharModal('modalNovaCompra');
    await carregarTudo();
    await selecionarCliente(clienteSelecionadoId);
    showToast('Compra registrada!', 'success');
  } catch (e) { showToast('Erro ao registrar compra', 'error'); }
}

async function abrirModalPagamento() {
  if (!clienteSelecionadoId) { showToast('Selecione um cliente', 'warning'); return; }
  const cliente = await getClienteFiado(clienteSelecionadoId);
  const dp = cliente.dividas.filter(d => !d.pago);
  if (!dp.length) { showToast('Sem dívidas pendentes', 'warning'); return; }
  const select = document.getElementById('selectDivida');
  select.innerHTML = '<option value="">Selecione...</option>' + dp.map(d => {
    const r = d.total - (d.valorPago || 0);
    return `<option value="${d.id}" data-restante="${r}">Compra #${d.id} - ${formatarData(d.data)} - Restante: ${formatarMoeda(r)}</option>`;
  }).join('');
  document.getElementById('valorPagamento').value = '';
  document.getElementById('valorMaximoInfo').textContent = '';
  select.onchange = function() {
    const o = this.options[this.selectedIndex];
    if (o.dataset.restante) {
      document.getElementById('valorPagamento').max = o.dataset.restante;
      document.getElementById('valorMaximoInfo').textContent = `Valor máximo: ${formatarMoeda(parseFloat(o.dataset.restante))}`;
    }
  };
  document.getElementById('modalPagamento').classList.add('active');
}

async function registrarPagamento(event) {
  event.preventDefault();
  const dividaId = parseInt(document.getElementById('selectDivida').value);
  const valor = parseFloat(document.getElementById('valorPagamento').value);
  if (!dividaId || !valor || valor <= 0) { showToast('Informe um valor válido', 'warning'); return; }
  const restante = parseFloat(document.getElementById('selectDivida').selectedOptions[0].dataset.restante);
  if (valor > restante) { showToast(`Máximo: ${formatarMoeda(restante)}`, 'warning'); return; }
  try {
    await registrarPagamentoFiado(clienteSelecionadoId, dividaId, valor);
    fecharModal('modalPagamento');
    await carregarTudo();
    await selecionarCliente(clienteSelecionadoId);
    showToast('Pagamento registrado!', 'success');
  } catch (e) { showToast('Erro ao registrar pagamento', 'error'); }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
});
