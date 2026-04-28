// =============================================
// FIADO.JS - Gestão de Fiado
// =============================================

let clienteSelecionadoId = null;
let carrinhoFiado = [];
let todosClientes = [];

document.addEventListener('DOMContentLoaded', async function() {
    if (!verificarAutenticacao()) return;
    await carregarClientes();
    await atualizarTotalGeral();
    setInterval(async () => {
        if (clienteSelecionadoId) await carregarDetalhesCliente(clienteSelecionadoId);
        await atualizarTotalGeral();
    }, 30000);
});

async function carregarClientes() {
    const fiado = await getFiado();
    todosClientes = fiado.clientes || [];
    exibirClientes(todosClientes);
}

function exibirClientes(clientes) {
    const container = document.getElementById('listaClientes');
    if (clientes.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:2rem;">Nenhum cliente cadastrado</div>';
        return;
    }
    container.innerHTML = clientes.map(cliente => {
        const totalDevido = calcularTotalDevidoCliente(cliente);
        const temAtraso = verificarAtraso(cliente);
        return `<div class="cliente-card ${clienteSelecionadoId === cliente.id ? 'active' : ''}" onclick="selecionarCliente(${cliente.id})">
            <div class="cliente-nome">${cliente.nome} ${temAtraso ? '<span class="badge badge-danger">Em atraso</span>' : ''}</div>
            <div class="cliente-turma">${cliente.turma || 'Não informada'}</div>
            <div class="cliente-divida">${formatarMoeda(totalDevido)}</div>
        </div>`;
    }).join('');
}

function calcularTotalDevidoCliente(cliente) {
    return cliente.dividas.reduce((s, d) => !d.pago ? s + (d.total - (d.valorPago || 0)) : s, 0);
}

function verificarAtraso(cliente) {
    const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return cliente.dividas.some(d => !d.pago && new Date(d.data) < trintaDias);
}

async function selecionarCliente(id) {
    clienteSelecionadoId = id;
    await carregarClientes();
    await carregarDetalhesCliente(id);
    document.getElementById('painelVazio').style.display = 'none';
    document.getElementById('painelDetalhes').style.display = 'block';
}

async function carregarDetalhesCliente(id) {
    const cliente = await getClienteFiado(id);
    if (!cliente) return;
    document.getElementById('clienteNomeDetalhe').textContent = cliente.nome;
    document.getElementById('clienteTurmaDetalhe').innerHTML = `${cliente.turma || ''}`;
    const totalDevido = calcularTotalDevidoCliente(cliente);
    const totalPago = cliente.dividas.reduce((s, d) => s + (d.valorPago || 0), 0);
    document.getElementById('totalDevidoCliente').textContent = formatarMoeda(totalDevido);
    document.getElementById('totalPagoCliente').textContent = formatarMoeda(totalPago);
    document.getElementById('qtdComprasCliente').textContent = cliente.dividas.length;
    carregarHistoricoCompras(cliente);
}

function carregarHistoricoCompras(cliente) {
    const container = document.getElementById('historicoCompras');
    if (!cliente.dividas.length) {
        container.innerHTML = '<p>Nenhuma compra registrada</p>';
        return;
    }
    container.innerHTML = cliente.dividas.sort((a,b) => new Date(b.data) - new Date(a.data)).map(d => {
        const statusClass = d.pago ? 'status-pago' : (new Date(d.data) < new Date(Date.now() - 30*24*60*60*1000) ? 'status-atraso' : 'status-pendente');
        const statusText = d.pago ? 'Pago ✓' : (statusClass === 'status-atraso' ? 'Em atraso ⚠️' : 'Pendente');
        return `<div class="divida-item">
            <strong>Compra #${d.id}</strong> - ${formatarData(d.data)} <span class="${statusClass}">${statusText}</span>
            <div>${d.itens.map(i => `${i.quantidade}x ${i.produtoId}`).join(', ')}</div>
            <div>Total: ${formatarMoeda(d.total)} | Pago: ${formatarMoeda(d.valorPago || 0)}</div>
        </div>`;
    }).join('');
}

async function atualizarTotalGeral() {
    const total = await getTotalFiadoPendente();
    document.getElementById('totalGeralFiado').textContent = formatarMoeda(total);
}

function abrirModalNovoCliente() { document.getElementById('modalNovoCliente').classList.add('active'); }
function fecharModal(modalId) { document.getElementById(modalId).classList.remove('active'); }

async function cadastrarCliente(event) {
    event.preventDefault();
    const nome = document.getElementById('novoClienteNome').value.trim();
    const turma = document.getElementById('novoClienteTurma').value.trim();
    if (!nome || nome.length < 3) { alert('Nome deve ter pelo menos 3 caracteres'); return; }
    const novo = await adicionarClienteFiado(nome, turma);
    if (novo) {
        fecharModal('modalNovoCliente');
        await carregarClientes();
        selecionarCliente(novo.id);
        document.getElementById('formNovoCliente').reset();
        mostrarNotificacao('Cliente cadastrado!', 'success');
    }
}

function abrirModalNovaCompra() {
    if (!clienteSelecionadoId) { alert('Selecione um cliente'); return; }
    carrinhoFiado = [];
    carregarProdutosParaFiado();
    atualizarResumoCompra();
    document.getElementById('modalNovaCompra').classList.add('active');
}

async function carregarProdutosParaFiado() {
    const produtos = await getProdutos();
    const container = document.getElementById('listaProdutosFiado');
    const categorias = [...new Set(produtos.map(p => p.categoria))];
    container.innerHTML = categorias.map(cat => {
        const prods = produtos.filter(p => p.categoria === cat && p.estoque > 0);
        if (!prods.length) return '';
        return `<h5>${cat}</h5>` + prods.map(p => `
            <div class="produto-selector flex-between">
                <span>${p.nome} - ${formatarMoeda(p.preco)} (${p.estoque})</span>
                <input type="number" id="qtd_${p.id}" min="0" max="${p.estoque}" value="0" onchange="atualizarCarrinho(${p.id}, this.value)">
            </div>`).join('');
    }).join('');
}

function atualizarCarrinho(produtoId, quantidade) {
    quantidade = parseInt(quantidade) || 0;
    carrinhoFiado = carrinhoFiado.filter(i => i.produtoId !== produtoId);
    if (quantidade > 0) {
        carrinhoFiado.push({ produtoId, quantidade, precoUnitario: todosClientes.find(c => c.id === clienteSelecionadoId)?.dividas?.[0]?.itens?.[0]?.precoUnitario || 0 }); // simplificado
    }
    atualizarResumoCompra();
}

function atualizarResumoCompra() {
    const total = carrinhoFiado.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
    document.getElementById('totalCompraFiado').textContent = formatarMoeda(total);
}

async function finalizarCompraFiado() {
    if (carrinhoFiado.length === 0) { alert('Selecione itens'); return; }
    const total = carrinhoFiado.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
    const sucesso = await registrarCompraFiado(clienteSelecionadoId, carrinhoFiado, total);
    if (sucesso) {
        fecharModal('modalNovaCompra');
        await carregarDetalhesCliente(clienteSelecionadoId);
        await carregarClientes();
        await atualizarTotalGeral();
        mostrarNotificacao('Compra fiado registrada!', 'success');
    } else alert('Erro');
}

function abrirModalPagamento() { /* ... */ }
async function registrarPagamento(event) { /* ... similar com await */ }

function filtrarClientes() {
    const termo = document.getElementById('buscaCliente').value.toLowerCase();
    const filtrados = todosClientes.filter(c => c.nome.toLowerCase().includes(termo));
    exibirClientes(filtrados);
}

function mostrarNotificacao(msg, tipo) {
    const div = document.createElement('div');
    div.className = `alert alert-${tipo}`;
    div.textContent = msg;
    div.style.position = 'fixed'; div.style.top = '20px'; div.style.right = '20px';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}