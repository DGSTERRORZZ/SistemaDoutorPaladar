// =============================================
// PDV.JS - Ponto de Venda (Reformulado)
// =============================================

let carrinho = [];
let categoriaAtiva = 'Todos';
let pagamentoSelecionado = 'dinheiro';
let todosProdutos = [];
let finalizandoVenda = false;

document.addEventListener('DOMContentLoaded', async function() {
  if (!verificarAutenticacao()) return;
  await carregarProdutos();
  await carregarCategorias();
  await carregarClientesFiado();

  // Debounce na busca
  const buscaInput = document.getElementById('buscaProduto');
  if (buscaInput) {
    buscaInput.addEventListener('input', debounce(filtrarProdutos, 250));
  }
});

async function carregarProdutos() {
  try {
    todosProdutos = await getProdutos();
    filtrarProdutos();
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    showToast('Erro ao carregar produtos', 'error');
  }
}

async function carregarCategorias() {
  const categorias = ['Todos', ...new Set(todosProdutos.map(p => p.categoria))];
  const container = document.getElementById('categoriasTabs');
  container.innerHTML = categorias.map(cat =>
    `<button class="categoria-tab ${cat === 'Todos' ? 'active' : ''}" onclick="selecionarCategoria('${escapeHtml(cat)}')">${escapeHtml(cat)}</button>`
  ).join('');
}

function selecionarCategoria(categoria) {
  categoriaAtiva = categoria;
  document.querySelectorAll('.categoria-tab').forEach(tab => {
    tab.classList.toggle('active', tab.textContent.trim() === categoria);
  });
  filtrarProdutos();
}

function filtrarProdutos() {
  const termo = (document.getElementById('buscaProduto')?.value || '').toLowerCase();
  let produtosFiltrados = todosProdutos;
  if (categoriaAtiva !== 'Todos') {
    produtosFiltrados = produtosFiltrados.filter(p => p.categoria === categoriaAtiva);
  }
  if (termo) {
    produtosFiltrados = produtosFiltrados.filter(p => p.nome.toLowerCase().includes(termo));
  }
  exibirProdutos(produtosFiltrados);
}

function exibirProdutos(produtos) {
  const container = document.getElementById('produtosGrid');
  if (produtos.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-secondary);">
      <p style="font-size:2rem;margin-bottom:0.5rem;">📦</p><p>Nenhum produto encontrado</p></div>`;
    return;
  }
  container.innerHTML = produtos.map(produto => {
    const semEstoque = produto.estoque === 0;
    const icone = getIconeCategoria(produto.categoria);
    return `<div class="produto-card ${semEstoque ? 'sem-estoque' : ''}" onclick="${semEstoque ? '' : `adicionarAoCarrinho(${produto.id})`}">
      <div class="produto-icone">${icone}</div>
      <div class="produto-nome">${escapeHtml(produto.nome)}</div>
      <div class="produto-preco">${formatarMoeda(produto.preco)}</div>
      <div class="produto-estoque ${semEstoque ? 'estoque-baixo' : ''}">${semEstoque ? 'Esgotado' : `Estoque: ${produto.estoque}`}</div></div>`;
  }).join('');
}

function getIconeCategoria(categoria) {
  const icones = { 'Salgados': '🥟', 'Bebidas': '🥤', 'Doces': '🍰', 'Lanches': '🥪', 'Sorvetes': '🍦', 'Saudáveis': '🥗', 'Refeições': '🍽️' };
  return icones[categoria] || '📦';
}

function adicionarAoCarrinho(produtoId) {
  const produto = todosProdutos.find(p => p.id === produtoId);
  if (!produto || produto.estoque === 0) return;
  const itemExistente = carrinho.find(item => item.produtoId === produtoId);
  if (itemExistente) {
    if (itemExistente.quantidade < produto.estoque) itemExistente.quantidade++;
    else { showToast(`Máximo disponível: ${produto.estoque}`, 'warning'); return; }
  } else {
    carrinho.push({ produtoId, nome: produto.nome, precoUnitario: produto.preco, quantidade: 1 });
  }
  atualizarCarrinho();
}

function removerDoCarrinho(produtoId) {
  const index = carrinho.findIndex(item => item.produtoId === produtoId);
  if (index !== -1) {
    if (carrinho[index].quantidade > 1) carrinho[index].quantidade--;
    else carrinho.splice(index, 1);
    atualizarCarrinho();
  }
}

function aumentarQuantidade(produtoId) {
  const item = carrinho.find(item => item.produtoId === produtoId);
  const produto = todosProdutos.find(p => p.id === produtoId);
  if (item && produto && item.quantidade < produto.estoque) { item.quantidade++; atualizarCarrinho(); }
  else if (produto) showToast(`Máximo disponível: ${produto.estoque}`, 'warning');
}

function atualizarCarrinho() {
  const container = document.getElementById('carrinhoItens');
  const subtotalSpan = document.getElementById('subtotal');
  const totalSpan = document.getElementById('totalCarrinho');
  if (carrinho.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">Nenhum item no carrinho</p>';
    subtotalSpan.textContent = 'R$ 0,00';
    totalSpan.textContent = 'R$ 0,00';
    return;
  }
  let subtotal = 0;
  container.innerHTML = carrinho.map(item => {
    const subtotalItem = item.quantidade * item.precoUnitario;
    subtotal += subtotalItem;
    return `<div class="carrinho-item"><div class="carrinho-item-info"><div class="carrinho-item-nome">${escapeHtml(item.nome)}</div><div class="carrinho-item-preco">${formatarMoeda(item.precoUnitario)} / un</div></div>
    <div class="carrinho-item-controles"><button class="btn-qtd" onclick="removerDoCarrinho(${item.produtoId})">-</button><span class="carrinho-item-qtd">${item.quantidade}</span><button class="btn-qtd" onclick="aumentarQuantidade(${item.produtoId})">+</button><span style="margin-left:0.5rem;font-weight:700;min-width:70px;text-align:right;">${formatarMoeda(subtotalItem)}</span></div></div>`;
  }).join('');
  subtotalSpan.textContent = formatarMoeda(subtotal);
  totalSpan.textContent = formatarMoeda(subtotal);
}

function limparCarrinho() { carrinho = []; atualizarCarrinho(); }

function selecionarPagamento(metodo) {
  pagamentoSelecionado = metodo;
  document.querySelectorAll('.pagamento-btn').forEach(btn => btn.classList.remove('active'));
  const btnAtivo = document.querySelector(`[data-pagamento="${metodo}"]`);
  if (btnAtivo) btnAtivo.classList.add('active');
  const fiadoSection = document.getElementById('fiadoSection');
  if (fiadoSection) fiadoSection.style.display = metodo === 'fiado' ? 'block' : 'none';
}

async function carregarClientesFiado() {
  try {
    const fiado = await getFiado();
    const select = document.getElementById('clienteFiadoSelect');
    select.innerHTML = '<option value="">Selecione o cliente...</option>' +
      fiado.clientes.map(c => `<option value="${c.id}">${escapeHtml(c.nome)} ${c.turma ? `(${escapeHtml(c.turma)})` : ''}</option>`).join('');
  } catch (error) { console.error('Erro ao carregar clientes fiado:', error); }
}

function abrirModalNovoCliente() { document.getElementById('modalNovoCliente').style.display = 'flex'; }
function fecharModalNovoCliente() { document.getElementById('modalNovoCliente').style.display = 'none'; }

async function cadastrarCliente() {
  const nome = document.getElementById('novoClienteNome').value.trim();
  const turma = document.getElementById('novoClienteTurma').value.trim();
  if (!nome || nome.length < 3) { showToast('Nome deve ter pelo menos 3 caracteres', 'warning'); return; }
  try {
    const novoCliente = await adicionarClienteFiado(nome, turma);
    if (novoCliente) {
      await carregarClientesFiado();
      document.getElementById('clienteFiadoSelect').value = novoCliente.id;
      fecharModalNovoCliente();
      showToast('Cliente cadastrado com sucesso!', 'success');
    }
  } catch (error) { showToast('Erro ao cadastrar cliente', 'error'); }
}

async function finalizarVenda() {
  if (finalizandoVenda) return;
  if (carrinho.length === 0) { showToast('Adicione itens ao carrinho', 'warning'); return; }

  for (let item of carrinho) {
    const produto = todosProdutos.find(p => p.id === item.produtoId);
    if (!produto || produto.estoque < item.quantidade) {
      showToast(`Estoque insuficiente para: ${item.nome}`, 'error');
      return;
    }
  }

  const total = carrinho.reduce((sum, item) => sum + (item.quantidade * item.precoUnitario), 0);
  finalizandoVenda = true;
  const btnFinalizar = document.getElementById('btnFinalizar');
  btnFinalizar.disabled = true;
  btnFinalizar.innerHTML = '<span class="loading"></span> Processando...';

  try {
    if (pagamentoSelecionado === 'fiado') {
      const clienteId = document.getElementById('clienteFiadoSelect').value;
      if (!clienteId) { showToast('Selecione um cliente para venda fiado', 'warning'); return; }
      const itensFiado = carrinho.map(item => ({ produtoId: item.produtoId, quantidade: item.quantidade, precoUnitario: item.precoUnitario }));
      await registrarCompraFiado(parseInt(clienteId), itensFiado, total);
      mostrarSucesso(`Venda fiado registrada! Total: ${formatarMoeda(total)}`);
      limparCarrinho();
      await carregarProdutos();
      return;
    }

    const venda = {
      itens: carrinho.map(item => ({ produtoId: item.produtoId, nome: item.nome, quantidade: item.quantidade, precoUnitario: item.precoUnitario })),
      total, formaPagamento: pagamentoSelecionado, data: new Date().toISOString()
    };
    const vendaRegistrada = await registrarVenda(venda);
    if (vendaRegistrada) {
      mostrarSucesso(`Venda #${vendaRegistrada.id} finalizada! Total: ${formatarMoeda(total)}`);
      limparCarrinho();
      await carregarProdutos();
    }
  } catch (error) {
    console.error('Erro ao registrar venda:', error);
    showToast('Erro ao registrar venda: ' + error.message, 'error');
  } finally {
    finalizandoVenda = false;
    btnFinalizar.disabled = false;
    btnFinalizar.innerHTML = 'Finalizar Venda';
  }
}

function mostrarSucesso(mensagem) {
  document.getElementById('mensagemVenda').textContent = mensagem;
  document.getElementById('modalSucesso').style.display = 'flex';
}

function fecharModalSucesso() { document.getElementById('modalSucesso').style.display = 'none'; }
function novaVenda() { fecharModalSucesso(); limparCarrinho(); }
