// =============================================
// PDV.JS - Ponto de Venda (API)
// =============================================

let carrinho = [];
let categoriaAtiva = 'Todos';
let pagamentoSelecionado = 'dinheiro';
let todosProdutos = [];

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛒 PDV inicializando...');
    if (!verificarAutenticacao()) return;
    await carregarProdutos();
    await carregarCategorias();
    await carregarClientesFiado();
    console.log('✅ PDV pronto!', todosProdutos.length, 'produtos carregados');
});

async function carregarProdutos() {
    try {
        todosProdutos = await getProdutos();
        console.log('📦 Produtos recebidos:', todosProdutos);
        filtrarProdutos();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        alert('Erro ao carregar produtos. Verifique o backend.');
    }
}

async function carregarCategorias() {
    const categorias = ['Todos', ...new Set(todosProdutos.map(p => p.categoria))];
    const container = document.getElementById('categoriasTabs');
    container.innerHTML = categorias.map(cat => `
        <button class="categoria-tab ${cat === 'Todos' ? 'active' : ''}" 
                onclick="selecionarCategoria('${cat}')">
            ${cat}
        </button>
    `).join('');
}

function selecionarCategoria(categoria) {
    categoriaAtiva = categoria;
    document.querySelectorAll('.categoria-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.categoria-tab').forEach(tab => {
        if (tab.textContent.trim() === categoria) tab.classList.add('active');
    });
    filtrarProdutos();
}

function filtrarProdutos() {
    const termo = document.getElementById('buscaProduto').value.toLowerCase();
    let produtosFiltrados = todosProdutos;
    if (categoriaAtiva !== 'Todos') {
        produtosFiltrados = produtosFiltrados.filter(p => p.categoria === categoriaAtiva);
    }
    if (termo) {
        produtosFiltrados = produtosFiltrados.filter(p => 
            p.nome.toLowerCase().includes(termo)
        );
    }
    exibirProdutos(produtosFiltrados);
}

function exibirProdutos(produtos) {
    const container = document.getElementById('produtosGrid');
    if (produtos.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
            <i class="fas fa-box-open" style="font-size: 3rem; opacity: 0.3;"></i>
            <p>Nenhum produto encontrado</p>
        </div>`;
        return;
    }
    container.innerHTML = produtos.map(produto => {
        const semEstoque = produto.estoque === 0;
        const icone = getIconeCategoria(produto.categoria);
        return `
            <div class="produto-card ${semEstoque ? 'sem-estoque' : ''}" 
                 onclick="${semEstoque ? '' : `adicionarAoCarrinho(${produto.id})`}">
                <div class="produto-icone">${icone}</div>
                <div class="produto-nome">${produto.nome}</div>
                <div class="produto-preco">${formatarMoeda(produto.preco)}</div>
                <div class="produto-estoque ${semEstoque ? 'estoque-baixo' : ''}">
                    ${semEstoque ? 'Esgotado' : `Estoque: ${produto.estoque}`}
                </div>
            </div>
        `;
    }).join('');
}

function getIconeCategoria(categoria) {
    const icones = {
        'Salgados': '🥟',
        'Bebidas': '🥤',
        'Doces': '🍰',
        'Lanches': '🥪',
        'Sorvetes': '🍦',
        'Saudáveis': '🥗',
        'Refeições': '🍽️'
    };
    return icones[categoria] || '📦';
}

// =============================================
// GERENCIAMENTO DO CARRINHO
// =============================================

function adicionarAoCarrinho(produtoId) {
    const produto = todosProdutos.find(p => p.id === produtoId);
    if (!produto || produto.estoque === 0) return;
    
    const itemExistente = carrinho.find(item => item.produtoId === produtoId);
    
    if (itemExistente) {
        if (itemExistente.quantidade < produto.estoque) {
            itemExistente.quantidade++;
        } else {
            alert(`Quantidade máxima disponível: ${produto.estoque}`);
            return;
        }
    } else {
        carrinho.push({
            produtoId: produtoId,
            nome: produto.nome,
            precoUnitario: produto.preco,
            quantidade: 1
        });
    }
    
    atualizarCarrinho();
}

function removerDoCarrinho(produtoId) {
    const index = carrinho.findIndex(item => item.produtoId === produtoId);
    if (index !== -1) {
        if (carrinho[index].quantidade > 1) {
            carrinho[index].quantidade--;
        } else {
            carrinho.splice(index, 1);
        }
        atualizarCarrinho();
    }
}

function aumentarQuantidade(produtoId) {
    const item = carrinho.find(item => item.produtoId === produtoId);
    const produto = todosProdutos.find(p => p.id === produtoId);
    
    if (item && produto && item.quantidade < produto.estoque) {
        item.quantidade++;
        atualizarCarrinho();
    } else if (produto) {
        alert(`Quantidade máxima disponível: ${produto.estoque}`);
    }
}

function atualizarCarrinho() {
    const container = document.getElementById('carrinhoItens');
    const subtotalSpan = document.getElementById('subtotal');
    const totalSpan = document.getElementById('totalCarrinho');
    
    if (carrinho.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--gray-600); padding: 2rem;">
            Nenhum item no carrinho
        </p>`;
        subtotalSpan.textContent = 'R$ 0,00';
        totalSpan.textContent = 'R$ 0,00';
        return;
    }
    
    let subtotal = 0;
    
    container.innerHTML = carrinho.map(item => {
        const subtotalItem = item.quantidade * item.precoUnitario;
        subtotal += subtotalItem;
        
        return `
            <div class="carrinho-item">
                <div class="carrinho-item-info">
                    <div class="carrinho-item-nome">${item.nome}</div>
                    <div class="carrinho-item-preco">${formatarMoeda(item.precoUnitario)} / un</div>
                </div>
                <div class="carrinho-item-controles">
                    <button class="btn-qtd" onclick="removerDoCarrinho(${item.produtoId})">-</button>
                    <span class="carrinho-item-qtd">${item.quantidade}</span>
                    <button class="btn-qtd" onclick="aumentarQuantidade(${item.produtoId})">+</button>
                    <span style="margin-left: 0.5rem; font-weight: 600; min-width: 70px; text-align: right;">
                        ${formatarMoeda(subtotalItem)}
                    </span>
                </div>
            </div>
        `;
    }).join('');
    
    subtotalSpan.textContent = formatarMoeda(subtotal);
    totalSpan.textContent = formatarMoeda(subtotal);
}

function limparCarrinho() {
    carrinho = [];
    atualizarCarrinho();
}

// =============================================
// PAGAMENTO
// =============================================

function selecionarPagamento(metodo) {
    pagamentoSelecionado = metodo;
    
    document.querySelectorAll('.pagamento-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const btnAtivo = document.querySelector(`[data-pagamento="${metodo}"]`);
    if (btnAtivo) btnAtivo.classList.add('active');
    
    const fiadoSection = document.getElementById('fiadoSection');
    fiadoSection.style.display = metodo === 'fiado' ? 'block' : 'none';
}

async function carregarClientesFiado() {
    try {
        const fiado = await getFiado();
        const select = document.getElementById('clienteFiadoSelect');
        select.innerHTML = '<option value="">Selecione o cliente...</option>' +
            fiado.clientes.map(cliente => `
                <option value="${cliente.id}">${cliente.nome} ${cliente.turma ? `(${cliente.turma})` : ''}</option>
            `).join('');
    } catch (error) {
        console.error('Erro ao carregar clientes fiado:', error);
    }
}

// =============================================
// MODAL NOVO CLIENTE
// =============================================

function abrirModalNovoCliente() {
    document.getElementById('modalNovoCliente').style.display = 'flex';
}

function fecharModalNovoCliente() {
    document.getElementById('modalNovoCliente').style.display = 'none';
    document.getElementById('novoClienteNome').value = '';
    document.getElementById('novoClienteTurma').value = '';
}

async function cadastrarCliente() {
    const nome = document.getElementById('novoClienteNome').value.trim();
    const turma = document.getElementById('novoClienteTurma').value.trim();
    
    if (!nome || nome.length < 3) {
        alert('Informe um nome com pelo menos 3 caracteres.');
        return;
    }
    
    try {
        const novoCliente = await adicionarClienteFiado(nome, turma);
        if (novoCliente) {
            await carregarClientesFiado();
            document.getElementById('clienteFiadoSelect').value = novoCliente.id;
            fecharModalNovoCliente();
            alert('✅ Cliente cadastrado com sucesso!');
        }
    } catch (error) {
        console.error('Erro ao cadastrar cliente:', error);
        alert('Erro ao cadastrar cliente.');
    }
}

// =============================================
// FINALIZAR VENDA
// =============================================

async function finalizarVenda() {
    console.log('🛒 Finalizando venda...');
    console.log('Carrinho:', carrinho);
    console.log('Pagamento:', pagamentoSelecionado);
    
    if (carrinho.length === 0) {
        alert('Adicione itens ao carrinho');
        return;
    }
    
    // Validar estoque
    for (let item of carrinho) {
        const produto = todosProdutos.find(p => p.id === item.produtoId);
        if (!produto || produto.estoque < item.quantidade) {
            alert(`Estoque insuficiente para: ${item.nome}`);
            return;
        }
    }
    
    const total = carrinho.reduce((sum, item) => 
        sum + (item.quantidade * item.precoUnitario), 0);
    
    console.log('Total da venda:', total);
    
    // Validar fiado
    if (pagamentoSelecionado === 'fiado') {
        const clienteId = document.getElementById('clienteFiadoSelect').value;
        if (!clienteId) {
            alert('Selecione um cliente para a venda fiado');
            return;
        }
        
        const itensFiado = carrinho.map(item => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario
        }));
        
        console.log('Registrando compra fiado...');
        try {
            const sucesso = await registrarCompraFiado(parseInt(clienteId), itensFiado, total);
            if (sucesso) {
                console.log('✅ Venda fiado registrada!');
                mostrarSucesso(`Venda fiado registrada! Total: ${formatarMoeda(total)}`);
                limparCarrinho();
                await carregarProdutos(); // Recarregar produtos para atualizar estoque
                await carregarCategorias();
            } else {
                alert('Erro ao registrar venda fiado');
            }
        } catch (error) {
            console.error('Erro na venda fiado:', error);
            alert('Erro ao registrar venda fiado.');
        }
        return;
    }
    
    // Venda normal (dinheiro/cartão)
    const venda = {
        itens: carrinho.map(item => ({
            produtoId: item.produtoId,
            nome: item.nome,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario
        })),
        total: total,
        formaPagamento: pagamentoSelecionado,
        data: new Date().toISOString()
    };
    
    console.log('Registrando venda normal:', venda);
    
    try {
        const vendaRegistrada = await registrarVenda(venda);
        if (vendaRegistrada) {
            console.log('✅ Venda registrada com sucesso! ID:', vendaRegistrada.id);
            mostrarSucesso(`Venda #${vendaRegistrada.id} finalizada! Total: ${formatarMoeda(total)}`);
            limparCarrinho();
            await carregarProdutos(); // Recarregar produtos para atualizar estoque
            await carregarCategorias();
        } else {
            alert('Erro ao registrar venda.');
        }
    } catch (error) {
        console.error('Erro ao registrar venda:', error);
        alert('Erro ao registrar venda. Verifique o console.');
    }
}

function mostrarSucesso(mensagem) {
    document.getElementById('mensagemVenda').textContent = mensagem;
    document.getElementById('modalSucesso').style.display = 'flex';
}

function fecharModalSucesso() {
    document.getElementById('modalSucesso').style.display = 'none';
}

function novaVenda() {
    fecharModalSucesso();
    limparCarrinho();
}