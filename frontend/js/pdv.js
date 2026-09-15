// =============================================
// PDV.JS - Ponto de Venda com Busca e Paginação (8 itens)
// =============================================

let carrinho = [];
let categoriaAtiva = 'Todos';
let pagamentoSelecionado = 'dinheiro';
let todosProdutos = [];
let paginaAtualPDV = 1;
const itensPorPaginaPDV = 8;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛒 PDV inicializando...');
    if (typeof verificarAutenticacao === 'function' && !verificarAutenticacao()) return;
    await carregarProdutos();
    await carregarCategorias();
    await carregarClientesFiado();

    // Event listener para busca em tempo real (ex: "co")
    const inputBusca = document.getElementById('buscaProduto');
    if (inputBusca) {
        inputBusca.addEventListener('input', function() {
            paginaAtualPDV = 1;
            filtrarProdutos();
        });
    }

    console.log('✅ PDV pronto!', todosProdutos.length, 'produtos carregados');
});

async function carregarProdutos() {
    try {
        todosProdutos = await getProdutos();
        console.log('📦 Produtos recebidos:', todosProdutos);
        // Ordenar produtos deixando os mais vendidos primeiro (se houver estoque/histórico)
        todosProdutos.sort((a, b) => (b.estoque > 0 ? 1 : 0) - (a.estoque > 0 ? 1 : 0));
        filtrarProdutos();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        alert('Erro ao carregar produtos. Verifique o backend.');
    }
}

async function carregarCategorias() {
    const categorias = ['Todos', ...new Set(todosProdutos.map(p => p.categoria))];
    const container = document.getElementById('categoriasTabs');
    if (!container) return;
    container.innerHTML = categorias.map(cat => `
        <button class="categoria-tab ${cat === 'Todos' ? 'active' : ''}" 
                onclick="selecionarCategoria('${cat}')">
            ${cat}
        </button>
    `).join('');
}

function selecionarCategoria(categoria) {
    categoriaAtiva = categoria;
    paginaAtualPDV = 1;
    document.querySelectorAll('.categoria-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.categoria-tab').forEach(tab => {
        if (tab.textContent.trim() === categoria) tab.classList.add('active');
    });
    filtrarProdutos();
}

function filtrarProdutos() {
    const inputBusca = document.getElementById('buscaProduto');
    const termo = inputBusca ? inputBusca.value.toLowerCase().trim() : '';
    let produtosFiltrados = todosProdutos;

    if (categoriaAtiva !== 'Todos') {
        produtosFiltrados = produtosFiltrados.filter(p => p.categoria === categoriaAtiva);
    }
    if (termo) {
        produtosFiltrados = produtosFiltrados.filter(p => 
            p.nome.toLowerCase().includes(termo) || p.categoria.toLowerCase().includes(termo)
        );
    }

    exibirProdutos(produtosFiltrados);
}

function exibirProdutos(produtos) {
    const container = document.getElementById('produtosGrid');
    if (!container) return;

    if (produtos.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
            <i class="fas fa-box-open" style="font-size: 3rem; opacity: 0.3;"></i>
            <p style="margin-top: 1rem; color: var(--text-muted);">Nenhum produto encontrado</p>
        </div>`;
        renderizarPaginacaoPDV(0, 1);
        return;
    }

    const totalPaginas = Math.ceil(produtos.length / itensPorPaginaPDV);
    if (paginaAtualPDV > totalPaginas) paginaAtualPDV = totalPaginas;

    const inicio = (paginaAtualPDV - 1) * itensPorPaginaPDV;
    const produtosPagina = produtos.slice(inicio, inicio + itensPorPaginaPDV);

    container.innerHTML = produtosPagina.map(produto => {
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

    renderizarPaginacaoPDV(produtos.length, totalPaginas);
}

function renderizarPaginacaoPDV(totalItens, totalPaginas) {
    let pagContainer = document.getElementById('paginacaoPDV');
    if (!pagContainer) {
        const grid = document.getElementById('produtosGrid');
        if (grid && grid.parentNode) {
            pagContainer = document.createElement('div');
            pagContainer.id = 'paginacaoPDV';
            pagContainer.style.cssText = 'grid-column: 1/-1; display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding: 0.5rem; background: var(--card); border-radius: 12px; border: 1px solid var(--border);';
            grid.parentNode.insertBefore(pagContainer, grid.nextSibling);
        }
    }

    if (!pagContainer || totalPaginas <= 1) {
        if (pagContainer) pagContainer.innerHTML = '';
        return;
    }

    pagContainer.innerHTML = `
        <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: 500;">
            Mostrando ${((paginaAtualPDV - 1) * itensPorPaginaPDV) + 1} - ${Math.min(paginaAtualPDV * itensPorPaginaPDV, totalItens)} de ${totalItens} produtos
        </span>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn-pag" onclick="mudarPaginaPDV(-1)" ${paginaAtualPDV === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} style="padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); cursor: pointer;">
                <i class="fas fa-chevron-left"></i> Anterior
            </button>
            <span style="font-weight: 600; font-size: 0.9rem; padding: 0 8px;">Página ${paginaAtualPDV} de ${totalPaginas}</span>
            <button class="btn-pag" onclick="mudarPaginaPDV(1)" ${paginaAtualPDV === totalPaginas ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} style="padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); cursor: pointer;">
                Próxima <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
}

function mudarPaginaPDV(delta) {
    paginaAtualPDV += delta;
    filtrarProdutos();
}

function getIconeCategoria(categoria) {
    const icones = {
        'Salgados': '🥟',
        'Bebidas': '🥤',
        'Doces': '🍰',
        'Lanches': '🥪',
        'Sorvetes': '🍦',
        'Saudáveis': '🥗',
        'Refeições': '🍽️',
        'Snacks': '🍫',
        'Caldos': '🍲',
        'Cremosinho': '🍦'
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
    if (!container) return;
    
    if (carrinho.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">
            Nenhum item no carrinho
        </p>`;
        if (subtotalSpan) subtotalSpan.textContent = 'R$ 0,00';
        if (totalSpan) totalSpan.textContent = 'R$ 0,00';
        return;
    }
    
    let subtotal = 0;
    
    container.innerHTML = carrinho.map(item => {
        const subtotalItem = item.quantidade * item.precoUnitario;
        subtotal += subtotalItem;
        
        return `
            <div class="carrinho-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border);">
                <div class="carrinho-item-info">
                    <div class="carrinho-item-nome" style="font-weight: 600;">${item.nome}</div>
                    <div class="carrinho-item-preco" style="font-size: 0.85rem; color: var(--text-muted);">${formatarMoeda(item.precoUnitario)} / un</div>
                </div>
                <div class="carrinho-item-controles" style="display: flex; align-items: center; gap: 6px;">
                    <button class="btn-qtd" onclick="removerDoCarrinho(${item.produtoId})" style="padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); cursor: pointer;">-</button>
                    <span class="carrinho-item-qtd" style="font-weight: 700; min-width: 20px; text-align: center;">${item.quantidade}</span>
                    <button class="btn-qtd" onclick="aumentarQuantidade(${item.produtoId})" style="padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); cursor: pointer;">+</button>
                    <span style="margin-left: 0.5rem; font-weight: 700; min-width: 65px; text-align: right;">
                        ${formatarMoeda(subtotalItem)}
                    </span>
                </div>
            </div>
        `;
    }).join('');
    
    if (subtotalSpan) subtotalSpan.textContent = formatarMoeda(subtotal);
    if (totalSpan) totalSpan.textContent = formatarMoeda(subtotal);
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
    if (fiadoSection) fiadoSection.style.display = metodo === 'fiado' ? 'block' : 'none';
}

async function carregarClientesFiado() {
    try {
        const fiado = await getFiado();
        const select = document.getElementById('clienteFiadoSelect');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione o cliente...</option>' +
            fiado.clientes.map(cliente => `
                <option value="${cliente.id}">${cliente.nome} ${cliente.turma ? `(${cliente.turma})` : ''} - Débito: R$ ${(cliente.saldoDevedor || 0).toFixed(2)} / Limite: R$ ${(cliente.limite || 50).toFixed(2)}</option>
            `).join('');
    } catch (error) {
        console.error('Erro ao carregar clientes fiado:', error);
    }
}

// =============================================
// MODAL NOVO CLIENTE
// =============================================

function abrirModalNovoCliente() {
    const modal = document.getElementById('modalNovoCliente');
    if (modal) modal.style.display = 'flex';
}

function fecharModalNovoCliente() {
    const modal = document.getElementById('modalNovoCliente');
    if (modal) modal.style.display = 'none';
    const nome = document.getElementById('novoClienteNome');
    if (nome) nome.value = '';
    const turma = document.getElementById('novoClienteTurma');
    if (turma) turma.value = '';
}

async function cadastrarCliente() {
    const nomeInput = document.getElementById('novoClienteNome');
    const turmaInput = document.getElementById('novoClienteTurma');
    const nome = nomeInput ? nomeInput.value.trim() : '';
    const turma = turmaInput ? turmaInput.value.trim() : '';
    
    if (!nome || nome.length < 3) {
        alert('Informe um nome com pelo menos 3 caracteres.');
        return;
    }
    
    try {
        const novoCliente = await adicionarClienteFiado(nome, turma);
        if (novoCliente) {
            await carregarClientesFiado();
            const select = document.getElementById('clienteFiadoSelect');
            if (select) select.value = novoCliente.id;
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
    if (carrinho.length === 0) {
        alert('Adicione itens ao carrinho');
        return;
    }
    
    for (let item of carrinho) {
        const produto = todosProdutos.find(p => p.id === item.produtoId);
        if (!produto || produto.estoque < item.quantidade) {
            alert(`Estoque insuficiente para: ${item.nome}`);
            return;
        }
    }
    
    const total = carrinho.reduce((sum, item) => 
        sum + (item.quantidade * item.precoUnitario), 0);
    
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
        
        try {
            const sucesso = await registrarCompraFiado(parseInt(clienteId), itensFiado, total);
            if (sucesso) {
                mostrarSucesso(`Venda fiado registrada! Total: ${formatarMoeda(total)}`);
                limparCarrinho();
                await carregarProdutos();
                await carregarCategorias();
            } else {
                alert('Erro ao registrar venda fiado. Verifique o limite do cliente.');
            }
        } catch (error) {
            console.error('Erro na venda fiado:', error);
            alert('Erro ao registrar venda fiado: ' + (error.message || 'Limite excedido.'));
        }
        return;
    }
    
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
    
    try {
        const vendaRegistrada = await registrarVenda(venda);
        if (vendaRegistrada) {
            mostrarSucesso(`Venda #${vendaRegistrada.id} finalizada! Total: ${formatarMoeda(total)}`);
            limparCarrinho();
            await carregarProdutos();
            await carregarCategorias();
        } else {
            alert('Erro ao registrar venda.');
        }
    } catch (error) {
        console.error('Erro ao registrar venda:', error);
        alert('Erro ao registrar venda.');
    }
}

function mostrarSucesso(mensagem) {
    const msg = document.getElementById('mensagemVenda');
    if (msg) msg.textContent = mensagem;
    const modal = document.getElementById('modalSucesso');
    if (modal) modal.style.display = 'flex';
}

function fecharModalSucesso() {
    const modal = document.getElementById('modalSucesso');
    if (modal) modal.style.display = 'none';
}

function novaVenda() {
    fecharModalSucesso();
    limparCarrinho();
}