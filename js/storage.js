// =============================================
// STORAGE.JS - Gerenciamento de Dados
// Compartilhado por todos os desenvolvedores
// =============================================

const STORAGE_KEYS = {
    PRODUTOS: 'doutorPaladar_produtos',
    VENDAS: 'doutorPaladar_vendas',
    FIADO: 'doutorPaladar_fiado',
    DESPESAS: 'doutorPaladar_despesas',
    CONFIG: 'doutorPaladar_config'
};

// =============================================
// FUNÇÕES DE INICIALIZAÇÃO
// =============================================

function inicializarDados() {
    // Inicializar produtos se não existirem
    if (!localStorage.getItem(STORAGE_KEYS.PRODUTOS)) {
        const produtosIniciais = [
            { id: 1, nome: 'Coxinha', categoria: 'Salgados', preco: 6.50, estoque: 45, estoqueMinimo: 10 },
            { id: 2, nome: 'Pastel de Carne', categoria: 'Salgados', preco: 7.00, estoque: 38, estoqueMinimo: 10 },
            { id: 3, nome: 'Empada de Frango', categoria: 'Salgados', preco: 6.00, estoque: 52, estoqueMinimo: 10 },
            { id: 4, nome: 'Refrigerante Lata', categoria: 'Bebidas', preco: 5.00, estoque: 120, estoqueMinimo: 20 },
            { id: 5, nome: 'Suco Natural', categoria: 'Bebidas', preco: 7.50, estoque: 35, estoqueMinimo: 10 },
            { id: 6, nome: 'Água Mineral', categoria: 'Bebidas', preco: 3.00, estoque: 200, estoqueMinimo: 30 },
            { id: 7, nome: 'Brigadeiro', categoria: 'Doces', preco: 3.50, estoque: 80, estoqueMinimo: 15 },
            { id: 8, nome: 'Bolo de Chocolate', categoria: 'Doces', preco: 5.00, estoque: 25, estoqueMinimo: 8 },
            { id: 9, nome: 'Sorvete Casquinha', categoria: 'Sorvetes', preco: 4.00, estoque: 60, estoqueMinimo: 15 },
            { id: 10, nome: 'Pão de Queijo', categoria: 'Salgados', preco: 3.50, estoque: 70, estoqueMinimo: 15 },
            { id: 11, nome: 'Misto Quente', categoria: 'Lanches', preco: 8.00, estoque: 30, estoqueMinimo: 8 },
            { id: 12, nome: 'Salada de Frutas', categoria: 'Saudáveis', preco: 9.00, estoque: 15, estoqueMinimo: 5 }
        ];
        salvarProdutos(produtosIniciais);
    }
    
    // Inicializar vendas
    if (!localStorage.getItem(STORAGE_KEYS.VENDAS)) {
        salvarVendas([]);
    }
    
    // Inicializar fiado
    if (!localStorage.getItem(STORAGE_KEYS.FIADO)) {
        const fiadoInicial = {
            clientes: [],
            historicoPagamentos: []
        };
        salvarFiado(fiadoInicial);
    }
    
    // Inicializar despesas
    if (!localStorage.getItem(STORAGE_KEYS.DESPESAS)) {
        salvarDespesas([]);
    }
}

// =============================================
// PRODUTOS (Estoque)
// =============================================

function getProdutos() {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUTOS);
    return data ? JSON.parse(data) : [];
}

function salvarProdutos(produtos) {
    localStorage.setItem(STORAGE_KEYS.PRODUTOS, JSON.stringify(produtos));
}

function adicionarProduto(produto) {
    const produtos = getProdutos();
    const novoId = produtos.length > 0 ? Math.max(...produtos.map(p => p.id)) + 1 : 1;
    produto.id = novoId;
    produto.estoqueMinimo = produto.estoqueMinimo || 10;
    produtos.push(produto);
    salvarProdutos(produtos);
    return produto;
}

function atualizarProduto(id, dadosAtualizados) {
    const produtos = getProdutos();
    const index = produtos.findIndex(p => p.id === id);
    if (index !== -1) {
        produtos[index] = { ...produtos[index], ...dadosAtualizados };
        salvarProdutos(produtos);
        return true;
    }
    return false;
}

function deletarProduto(id) {
    const produtos = getProdutos();
    const filtrados = produtos.filter(p => p.id !== id);
    salvarProdutos(filtrados);
}

function getProdutosBaixoEstoque() {
    const produtos = getProdutos();
    return produtos.filter(p => p.estoque <= p.estoqueMinimo);
}

function atualizarEstoque(id, quantidade, operacao = 'subtract') {
    const produtos = getProdutos();
    const index = produtos.findIndex(p => p.id === id);
    if (index !== -1) {
        if (operacao === 'subtract') {
            produtos[index].estoque = Math.max(0, produtos[index].estoque - quantidade);
        } else if (operacao === 'add') {
            produtos[index].estoque += quantidade;
        } else if (operacao === 'set') {
            produtos[index].estoque = Math.max(0, quantidade);
        }
        salvarProdutos(produtos);
        return true;
    }
    return false;
}

// =============================================
// VENDAS
// =============================================

function getVendas() {
    const data = localStorage.getItem(STORAGE_KEYS.VENDAS);
    return data ? JSON.parse(data) : [];
}

function salvarVendas(vendas) {
    localStorage.setItem(STORAGE_KEYS.VENDAS, JSON.stringify(vendas));
}

function registrarVenda(venda) {
    const vendas = getVendas();
    const novoId = vendas.length > 0 ? Math.max(...vendas.map(v => v.id)) + 1 : 1;
    venda.id = novoId;
    venda.data = venda.data || new Date().toISOString();
    vendas.push(venda);
    salvarVendas(vendas);
    
    // Atualizar estoque
    venda.itens.forEach(item => {
        atualizarEstoque(item.produtoId, item.quantidade, 'subtract');
    });
    
    return venda;
}

function getVendasPorPeriodo(dataInicio, dataFim) {
    const vendas = getVendas();
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    fim.setHours(23, 59, 59);
    
    return vendas.filter(venda => {
        const dataVenda = new Date(venda.data);
        return dataVenda >= inicio && dataVenda <= fim;
    });
}

function getTotalVendasPeriodo(dataInicio, dataFim) {
    const vendas = getVendasPorPeriodo(dataInicio, dataFim);
    return vendas.reduce((total, venda) => total + venda.total, 0);
}

// =============================================
// FIADO (Dívidas)
// =============================================

function getFiado() {
    const data = localStorage.getItem(STORAGE_KEYS.FIADO);
    return data ? JSON.parse(data) : { clientes: [], historicoPagamentos: [] };
}

function salvarFiado(fiado) {
    localStorage.setItem(STORAGE_KEYS.FIADO, JSON.stringify(fiado));
}

function adicionarClienteFiado(nome, turma = '') {
    const fiado = getFiado();
    const novoId = fiado.clientes.length > 0 ? Math.max(...fiado.clientes.map(c => c.id)) + 1 : 1;
    const cliente = {
        id: novoId,
        nome: nome,
        turma: turma,
        dividas: [],
        dataCadastro: new Date().toISOString()
    };
    fiado.clientes.push(cliente);
    salvarFiado(fiado);
    return cliente;
}

function registrarCompraFiado(clienteId, itens, total) {
    const fiado = getFiado();
    const cliente = fiado.clientes.find(c => c.id === clienteId);
    if (cliente) {
        const divida = {
            id: cliente.dividas.length + 1,
            data: new Date().toISOString(),
            itens: itens,
            total: total,
            pago: false,
            valorPago: 0
        };
        cliente.dividas.push(divida);
        salvarFiado(fiado);
        
        // Atualizar estoque
        itens.forEach(item => {
            atualizarEstoque(item.produtoId, item.quantidade, 'subtract');
        });
        
        return divida;
    }
    return null;
}

function registrarPagamentoFiado(clienteId, dividaId, valorPago) {
    const fiado = getFiado();
    const cliente = fiado.clientes.find(c => c.id === clienteId);
    if (cliente) {
        const divida = cliente.dividas.find(d => d.id === dividaId);
        if (divida && !divida.pago) {
            divida.valorPago += valorPago;
            if (divida.valorPago >= divida.total) {
                divida.pago = true;
                divida.valorPago = divida.total;
            }
            
            // Registrar no histórico
            fiado.historicoPagamentos.push({
                clienteId: clienteId,
                clienteNome: cliente.nome,
                dividaId: dividaId,
                valor: valorPago,
                data: new Date().toISOString()
            });
            
            salvarFiado(fiado);
            return true;
        }
    }
    return false;
}

function getTotalFiadoPendente() {
    const fiado = getFiado();
    let total = 0;
    fiado.clientes.forEach(cliente => {
        cliente.dividas.forEach(divida => {
            if (!divida.pago) {
                total += (divida.total - divida.valorPago);
            }
        });
    });
    return total;
}

function getClienteFiado(id) {
    const fiado = getFiado();
    return fiado.clientes.find(c => c.id === id);
}

// =============================================
// DESPESAS
// =============================================

function getDespesas() {
    const data = localStorage.getItem(STORAGE_KEYS.DESPESAS);
    return data ? JSON.parse(data) : [];
}

function salvarDespesas(despesas) {
    localStorage.setItem(STORAGE_KEYS.DESPESAS, JSON.stringify(despesas));
}

function adicionarDespesa(descricao, valor, categoria = 'Insumos') {
    const despesas = getDespesas();
    const novoId = despesas.length > 0 ? Math.max(...despesas.map(d => d.id)) + 1 : 1;
    const despesa = {
        id: novoId,
        descricao: descricao,
        valor: parseFloat(valor),
        categoria: categoria,
        data: new Date().toISOString()
    };
    despesas.push(despesa);
    salvarDespesas(despesas);
    return despesa;
}

function getTotalDespesasPeriodo(dataInicio, dataFim) {
    const despesas = getDespesas();
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    fim.setHours(23, 59, 59);
    
    return despesas
        .filter(d => {
            const dataDespesa = new Date(d.data);
            return dataDespesa >= inicio && dataDespesa <= fim;
        })
        .reduce((total, d) => total + d.valor, 0);
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function formatarData(data) {
    return new Date(data).toLocaleDateString('pt-BR');
}

function formatarDataHora(data) {
    return new Date(data).toLocaleString('pt-BR');
}

function getDataAtual() {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
}

function getInicioMes() {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
}

// =============================================
// ESTATÍSTICAS PARA DASHBOARD
// =============================================

function getEstatisticasGerais() {
    const hoje = getDataAtual();
    const inicioMes = getInicioMes();
    
    const vendasHoje = getVendasPorPeriodo(hoje, hoje);
    const totalVendasHoje = vendasHoje.reduce((sum, v) => sum + v.total, 0);
    
    const vendasMes = getVendasPorPeriodo(inicioMes, hoje);
    const totalVendasMes = vendasMes.reduce((sum, v) => sum + v.total, 0);
    
    const despesasMes = getTotalDespesasPeriodo(inicioMes, hoje);
    const lucroMes = totalVendasMes - despesasMes;
    
    const totalFiado = getTotalFiadoPendente();
    const produtosBaixoEstoque = getProdutosBaixoEstoque();
    
    return {
        vendasHoje: totalVendasHoje,
        vendasMes: totalVendasMes,
        despesasMes: despesasMes,
        lucroMes: lucroMes,
        totalFiado: totalFiado,
        qtdVendasHoje: vendasHoje.length,
        alertasEstoque: produtosBaixoEstoque.length,
        produtosBaixoEstoque: produtosBaixoEstoque
    };
}

// Inicializar dados ao carregar o script
document.addEventListener('DOMContentLoaded', function() {
    inicializarDados();
});

console.log('✅ Storage.js carregado - Sistema Doutor Paladar');