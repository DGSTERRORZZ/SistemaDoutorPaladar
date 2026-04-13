// =============================================
// FIADO.JS - Gestão de Fiado
// Desenvolvido por: Samuel
// =============================================

let clienteSelecionadoId = null;
let carrinhoFiado = [];
let todosClientes = [];

// =============================================
// INICIALIZAÇÃO
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticação
    if (!verificarAutenticacao()) return;
    
    // Carregar dados iniciais
    carregarClientes();
    atualizarTotalGeral();
    
    // Atualizar a cada 30 segundos
    setInterval(() => {
        if (clienteSelecionadoId) {
            carregarDetalhesCliente(clienteSelecionadoId);
        }
        atualizarTotalGeral();
    }, 30000);
});

// =============================================
// CARREGAMENTO DE DADOS
// =============================================

function carregarClientes() {
    const fiado = getFiado();
    todosClientes = fiado.clientes || [];
    exibirClientes(todosClientes);
}

function exibirClientes(clientes) {
    const container = document.getElementById('listaClientes');
    
    if (clientes.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--gray-600);">
                <i class="fas fa-user-slash" style="font-size: 3rem; opacity: 0.3;"></i>
                <p>Nenhum cliente cadastrado</p>
                <button class="btn btn-primary btn-sm" onclick="abrirModalNovoCliente()">
                    Cadastrar Primeiro Cliente
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = clientes.map(cliente => {
        const totalDevido = calcularTotalDevidoCliente(cliente.id);
        const temAtraso = verificarAtraso(cliente.id);
        
        return `
            <div class="cliente-card ${clienteSelecionadoId === cliente.id ? 'active' : ''} ${temAtraso ? 'atraso' : ''}" 
                 onclick="selecionarCliente(${cliente.id})">
                <div class="cliente-nome">
                    ${cliente.nome}
                    ${temAtraso ? '<span class="badge badge-danger" style="margin-left: 0.5rem;">Em atraso</span>' : ''}
                </div>
                <div class="cliente-turma">
                    <i class="fas fa-graduation-cap"></i> ${cliente.turma || 'Não informada'}
                </div>
                <div class="cliente-divida">
                    ${formatarMoeda(totalDevido)}
                </div>
                <div style="font-size: 0.85rem; color: var(--gray-600); margin-top: 0.3rem;">
                    ${cliente.dividas.length} compra(s)
                </div>
            </div>
        `;
    }).join('');
}

function selecionarCliente(clienteId) {
    clienteSelecionadoId = clienteId;
    carregarClientes(); // Recarregar para atualizar active
    carregarDetalhesCliente(clienteId);
    
    document.getElementById('painelVazio').style.display = 'none';
    document.getElementById('painelDetalhes').style.display = 'block';
}

function carregarDetalhesCliente(clienteId) {
    const cliente = getClienteFiado(clienteId);
    if (!cliente) return;
    
    // Atualizar cabeçalho
    document.getElementById('clienteNomeDetalhe').textContent = cliente.nome;
    document.getElementById('clienteTurmaDetalhe').innerHTML = 
        `<i class="fas fa-graduation-cap"></i> ${cliente.turma || 'Turma não informada'} · 
         <i class="fas fa-calendar"></i> Cliente desde ${formatarData(cliente.dataCadastro)}`;
    
    // Calcular totais
    const totalDevido = calcularTotalDevidoCliente(clienteId);
    const totalPago = calcularTotalPagoCliente(clienteId);
    
    document.getElementById('totalDevidoCliente').textContent = formatarMoeda(totalDevido);
    document.getElementById('totalPagoCliente').textContent = formatarMoeda(totalPago);
    document.getElementById('qtdComprasCliente').textContent = cliente.dividas.length;
    
    // Carregar histórico de compras
    carregarHistoricoCompras(cliente);
}

function carregarHistoricoCompras(cliente) {
    const container = document.getElementById('historicoCompras');
    
    if (!cliente.dividas || cliente.dividas.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-600);">Nenhuma compra registrada</p>';
        return;
    }
    
    // Ordenar por data (mais recente primeiro)
    const dividasOrdenadas = [...cliente.dividas].sort((a, b) => 
        new Date(b.data) - new Date(a.data)
    );
    
    container.innerHTML = dividasOrdenadas.map(divida => {
        const statusClass = divida.pago ? 'status-pago' : 
                           (new Date(divida.data) < new Date(Date.now() - 30*24*60*60*1000) ? 'status-atraso' : 'status-pendente');
        const statusText = divida.pago ? 'Pago ✓' : 
                          (statusClass === 'status-atraso' ? 'Em atraso ⚠️' : 'Pendente');
        
        return `
            <div class="divida-item">
                <div class="divida-header">
                    <div>
                        <strong>Compra #${divida.id}</strong>
                        <span style="margin-left: 1rem; color: var(--gray-600);">
                            <i class="far fa-calendar"></i> ${formatarData(divida.data)}
                        </span>
                    </div>
                    <span class="${statusClass}">${statusText}</span>
                </div>
                <div style="margin: 0.5rem 0;">
                    ${divida.itens.map(item => {
                        const produto = getProdutos().find(p => p.id === item.produtoId);
                        return `
                            <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                                <span>${item.quantidade}x ${produto ? produto.nome : 'Produto'}</span>
                                <span>${formatarMoeda(item.precoUnitario * item.quantidade)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 0.8rem; padding-top: 0.5rem; border-top: 1px dashed var(--gray-200);">
                    <strong>Total: ${formatarMoeda(divida.total)}</strong>
                    <div>
                        ${!divida.pago ? `
                            <span style="color: var(--success);">
                                Pago: ${formatarMoeda(divida.valorPago || 0)}
                            </span>
                            <span style="margin-left: 1rem; font-weight: 600; color: var(--danger);">
                                Restante: ${formatarMoeda(divida.total - (divida.valorPago || 0))}
                            </span>
                        ` : `
                            <span style="color: var(--success);">Total pago: ${formatarMoeda(divida.total)}</span>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// =============================================
// CÁLCULOS
// =============================================

function calcularTotalDevidoCliente(clienteId) {
    const cliente = getClienteFiado(clienteId);
    if (!cliente) return 0;
    
    return cliente.dividas.reduce((total, divida) => {
        if (!divida.pago) {
            return total + (divida.total - (divida.valorPago || 0));
        }
        return total;
    }, 0);
}

function calcularTotalPagoCliente(clienteId) {
    const cliente = getClienteFiado(clienteId);
    if (!cliente) return 0;
    
    return cliente.dividas.reduce((total, divida) => {
        return total + (divida.valorPago || 0);
    }, 0);
}

function verificarAtraso(clienteId) {
    const cliente = getClienteFiado(clienteId);
    if (!cliente) return false;
    
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    return cliente.dividas.some(divida => 
        !divida.pago && new Date(divida.data) < trintaDiasAtras
    );
}

function atualizarTotalGeral() {
    const total = getTotalFiadoPendente();
    document.getElementById('totalGeralFiado').textContent = formatarMoeda(total);
}

// =============================================
// CADASTRO DE CLIENTE
// =============================================

function abrirModalNovoCliente() {
    document.getElementById('modalNovoCliente').classList.add('active');
    document.getElementById('novoClienteNome').focus();
}

function cadastrarCliente(event) {
    event.preventDefault();
    
    const nome = document.getElementById('novoClienteNome').value.trim();
    const turma = document.getElementById('novoClienteTurma').value.trim();
    
    if (!nome) {
        alert('Por favor, informe o nome do cliente');
        return;
    }
    
    const novoCliente = adicionarClienteFiado(nome, turma);
    
    if (novoCliente) {
        fecharModal('modalNovoCliente');
        carregarClientes();
        selecionarCliente(novoCliente.id);
        
        // Limpar formulário
        document.getElementById('formNovoCliente').reset();
        
        // Mostrar mensagem de sucesso
        mostrarNotificacao('Cliente cadastrado com sucesso!', 'success');
    }
}

// =============================================
// COMPRA FIADO
// =============================================

function abrirModalNovaCompra() {
    if (!clienteSelecionadoId) {
        alert('Selecione um cliente primeiro');
        return;
    }
    
    const cliente = getClienteFiado(clienteSelecionadoId);
    
    // Atualizar info do cliente
    document.getElementById('clienteSelecionadoInfo').innerHTML = `
        <strong>${cliente.nome}</strong> · ${cliente.turma || 'Turma não informada'}
    `;
    
    // Carregar produtos disponíveis
    carregarProdutosParaFiado();
    
    // Resetar carrinho
    carrinhoFiado = [];
    atualizarResumoCompra();
    
    document.getElementById('modalNovaCompra').classList.add('active');
}

function carregarProdutosParaFiado() {
    const produtos = getProdutos();
    const container = document.getElementById('listaProdutosFiado');
    
    // Agrupar por categoria
    const categorias = [...new Set(produtos.map(p => p.categoria))];
    
    container.innerHTML = categorias.map(categoria => {
        const produtosCategoria = produtos.filter(p => p.categoria === categoria && p.estoque > 0);
        
        if (produtosCategoria.length === 0) return '';
        
        return `
            <div style="margin-bottom: 1rem;">
                <h5 style="color: var(--gray-600); margin-bottom: 0.5rem;">
                    <i class="fas fa-tag"></i> ${categoria}
                </h5>
                ${produtosCategoria.map(produto => `
                    <div class="produto-selector flex-between">
                        <div>
                            <strong>${produto.nome}</strong><br>
                            <small>${formatarMoeda(produto.preco)} · Estoque: ${produto.estoque}</small>
                        </div>
                        <div class="flex">
                            <input type="number" id="qtd_${produto.id}" 
                                   min="0" max="${produto.estoque}" value="0"
                                   style="width: 70px; padding: 0.4rem; border-radius: 20px; border: 1px solid var(--gray-200); text-align: center;"
                                   onchange="atualizarCarrinho(${produto.id}, this.value)">
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');
}

function atualizarCarrinho(produtoId, quantidade) {
    quantidade = parseInt(quantidade) || 0;
    const produto = getProdutos().find(p => p.id === produtoId);
    
    if (!produto) return;
    
    // Remover do carrinho se quantidade for 0
    carrinhoFiado = carrinhoFiado.filter(item => item.produtoId !== produtoId);
    
    if (quantidade > 0) {
        if (quantidade > produto.estoque) {
            alert(`Quantidade indisponível! Estoque atual: ${produto.estoque}`);
            document.getElementById(`qtd_${produtoId}`).value = 0;
            return;
        }
        
        carrinhoFiado.push({
            produtoId: produtoId,
            quantidade: quantidade,
            precoUnitario: produto.preco
        });
    }
    
    atualizarResumoCompra();
}

function atualizarResumoCompra() {
    const container = document.getElementById('resumoCompraFiado');
    const totalSpan = document.getElementById('totalCompraFiado');
    
    if (carrinhoFiado.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-600);">Nenhum produto selecionado</p>';
        totalSpan.textContent = 'R$ 0,00';
        return;
    }
    
    const produtos = getProdutos();
    let total = 0;
    
    container.innerHTML = carrinhoFiado.map(item => {
        const produto = produtos.find(p => p.id === item.produtoId);
        const subtotal = item.quantidade * item.precoUnitario;
        total += subtotal;
        
        return `
            <div class="flex-between" style="margin-bottom: 0.5rem;">
                <span>${item.quantidade}x ${produto ? produto.nome : 'Produto'}</span>
                <span>${formatarMoeda(subtotal)}</span>
            </div>
        `;
    }).join('');
    
    totalSpan.textContent = formatarMoeda(total);
}

function finalizarCompraFiado() {
    if (carrinhoFiado.length === 0) {
        alert('Selecione pelo menos um produto');
        return;
    }
    
    const total = carrinhoFiado.reduce((sum, item) => 
        sum + (item.quantidade * item.precoUnitario), 0
    );
    
    const sucesso = registrarCompraFiado(clienteSelecionadoId, carrinhoFiado, total);
    
    if (sucesso) {
        fecharModal('modalNovaCompra');
        carregarDetalhesCliente(clienteSelecionadoId);
        carregarClientes();
        atualizarTotalGeral();
        
        mostrarNotificacao('Compra fiado registrada com sucesso!', 'success');
    } else {
        alert('Erro ao registrar compra');
    }
}

// =============================================
// PAGAMENTOS
// =============================================

function abrirModalPagamento() {
    if (!clienteSelecionadoId) {
        alert('Selecione um cliente primeiro');
        return;
    }
    
    const cliente = getClienteFiado(clienteSelecionadoId);
    const select = document.getElementById('selectDivida');
    
    // Filtrar apenas dívidas não pagas
    const dividasPendentes = cliente.dividas.filter(d => !d.pago);
    
    if (dividasPendentes.length === 0) {
        alert('Este cliente não possui dívidas pendentes');
        return;
    }
    
    select.innerHTML = '<option value="">Selecione uma dívida</option>' +
        dividasPendentes.map(divida => {
            const restante = divida.total - (divida.valorPago || 0);
            return `
                <option value="${divida.id}" data-restante="${restante}">
                    Compra #${divida.id} - ${formatarData(divida.data)} - 
                    Total: ${formatarMoeda(divida.total)} - 
                    Restante: ${formatarMoeda(restante)}
                </option>
            `;
        }).join('');
    
    // Resetar valor
    document.getElementById('valorPagamento').value = '';
    document.getElementById('valorMaximoInfo').textContent = '';
    
    // Adicionar evento para atualizar valor máximo
    select.onchange = function() {
        const selectedOption = this.options[this.selectedIndex];
        const restante = selectedOption.dataset.restante;
        
        if (restante) {
            const valorInput = document.getElementById('valorPagamento');
            valorInput.max = restante;
            document.getElementById('valorMaximoInfo').textContent = 
                `Valor máximo: ${formatarMoeda(parseFloat(restante))}`;
        }
    };
    
    document.getElementById('modalPagamento').classList.add('active');
}

function registrarPagamento(event) {
    event.preventDefault();
    
    const select = document.getElementById('selectDivida');
    const dividaId = parseInt(select.value);
    const valor = parseFloat(document.getElementById('valorPagamento').value);
    
    if (!dividaId) {
        alert('Selecione uma dívida');
        return;
    }
    
    if (!valor || valor <= 0) {
        alert('Informe um valor válido');
        return;
    }
    
    const selectedOption = select.options[select.selectedIndex];
    const restante = parseFloat(selectedOption.dataset.restante);
    
    if (valor > restante) {
        alert(`O valor não pode ser maior que o restante: ${formatarMoeda(restante)}`);
        return;
    }
    
    const sucesso = registrarPagamentoFiado(clienteSelecionadoId, dividaId, valor);
    
    if (sucesso) {
        fecharModal('modalPagamento');
        carregarDetalhesCliente(clienteSelecionadoId);
        carregarClientes();
        atualizarTotalGeral();
        
        mostrarNotificacao('Pagamento registrado com sucesso!', 'success');
    } else {
        alert('Erro ao registrar pagamento');
    }
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

function filtrarClientes() {
    const termo = document.getElementById('buscaCliente').value.toLowerCase();
    
    if (!termo) {
        exibirClientes(todosClientes);
        return;
    }
    
    const filtrados = todosClientes.filter(cliente => 
        cliente.nome.toLowerCase().includes(termo) ||
        (cliente.turma && cliente.turma.toLowerCase().includes(termo))
    );
    
    exibirClientes(filtrados);
}

function fecharModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function mostrarNotificacao(mensagem, tipo = 'info') {
    // Criar elemento de notificação
    const notificacao = document.createElement('div');
    notificacao.className = `alert alert-${tipo}`;
    notificacao.style.position = 'fixed';
    notificacao.style.top = '20px';
    notificacao.style.right = '20px';
    notificacao.style.zIndex = '9999';
    notificacao.style.minWidth = '300px';
    notificacao.style.animation = 'fadeIn 0.3s';
    
    notificacao.innerHTML = `
        <i class="fas fa-${tipo === 'success' ? 'check-circle' : 'info-circle'}"></i>
        ${mensagem}
    `;
    
    document.body.appendChild(notificacao);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notificacao.remove();
    }, 3000);
}

// Fechar modais com ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

console.log('✅ Fiado.js carregado - Desenvolvido por Samuel');

 