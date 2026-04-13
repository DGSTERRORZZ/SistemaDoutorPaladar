// =============================================
// DASHBOARD.JS - Victor
// Gestão do Dashboard da Doutor Paladar
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticação
    if (!verificarAutenticacao()) {
        return;
    }
    
    // Inicializar dados
    inicializarDados();
    
    // Carregar todas as seções do dashboard
    carregarDashboard();
    
    // Atualizar a cada 30 segundos (opcional)
    setInterval(carregarDashboard, 30000);
});

// =============================================
// FUNÇÃO PRINCIPAL
// =============================================

function carregarDashboard() {
    atualizarDataAtual();
    carregarEstatisticas();
    carregarUltimasVendas();
    carregarGraficoSemana();
    carregarAlertasEstoque();
    carregarProdutosMaisVendidos();
    carregarResumoFinanceiro();
}

// =============================================
// DATA ATUAL
// =============================================

function atualizarDataAtual() {
    const dataElement = document.getElementById('currentDate');
    if (dataElement) {
        const hoje = new Date();
        const opcoes = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        dataElement.textContent = hoje.toLocaleDateString('pt-BR', opcoes);
    }
}

// =============================================
// CARDS DE ESTATÍSTICAS
// =============================================

function carregarEstatisticas() {
    const stats = getEstatisticasGerais();
    const hoje = getDataAtual();
    const ontem = getDataDiaAnterior();
    
    // Vendas Hoje
    document.getElementById('vendasHoje').textContent = formatarMoeda(stats.vendasHoje);
    
    // Tendência vs ontem
    const vendasOntem = getTotalVendasPeriodo(ontem, ontem);
    const trendVendas = document.getElementById('trendVendas');
    if (vendasOntem > 0) {
        const variacao = ((stats.vendasHoje - vendasOntem) / vendasOntem) * 100;
        if (variacao > 0) {
            trendVendas.innerHTML = `<i class="fas fa-arrow-up"></i> +${variacao.toFixed(1)}% vs ontem`;
            trendVendas.style.color = 'var(--success)';
        } else if (variacao < 0) {
            trendVendas.innerHTML = `<i class="fas fa-arrow-down"></i> ${variacao.toFixed(1)}% vs ontem`;
            trendVendas.style.color = 'var(--danger)';
            trendVendas.classList.add('negative');
        } else {
            trendVendas.innerHTML = `<i class="fas fa-minus"></i> Igual a ontem`;
        }
    } else {
        trendVendas.innerHTML = `<i class="fas fa-chart-line"></i> Primeira venda`;
    }
    
    // Fiado Pendente
    const totalFiado = stats.totalFiado;
    document.getElementById('fiadoPendente').textContent = formatarMoeda(totalFiado);
    
    // Quantidade de devedores
    const fiado = getFiado();
    const devedores = fiado.clientes.filter(cliente => {
        return cliente.dividas.some(d => !d.pago);
    });
    document.getElementById('qtdDevedores').textContent = devedores.length;
    
    // Lucro do Mês
    document.getElementById('lucroMes').textContent = formatarMoeda(stats.lucroMes);
    
    // Barra de progresso do lucro
    const metaLucro = 5000; // Meta mensal de R$ 5.000
    const progresso = Math.min((stats.lucroMes / metaLucro) * 100, 100);
    document.getElementById('progressLucro').style.width = progresso + '%';
    
    // Alertas de Estoque
    const alertas = stats.alertasEstoque;
    document.getElementById('alertasEstoque').textContent = alertas;
    
    const mensagemAlertas = document.getElementById('alertasMensagem');
    if (alertas === 0) {
        mensagemAlertas.textContent = 'Estoque em dia! ✓';
        mensagemAlertas.style.color = 'var(--success)';
        mensagemAlertas.classList.remove('negative');
    } else if (alertas <= 3) {
        mensagemAlertas.textContent = `${alertas} produtos em atenção`;
    } else {
        mensagemAlertas.textContent = `${alertas} produtos críticos!`;
    }
}

// =============================================
// ÚLTIMAS VENDAS
// =============================================

function carregarUltimasVendas() {
    const container = document.getElementById('ultimasVendas');
    const vendas = getVendas();
    
    // Ordenar por data (mais recentes primeiro)
    const ultimasVendas = vendas
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 5);
    
    if (ultimasVendas.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--gray-600);">
                <i class="fas fa-receipt" style="font-size: 2rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                <p>Nenhuma venda registrada hoje</p>
                <a href="pdv.html" class="btn btn-primary btn-sm" style="margin-top: 1rem;">
                    <i class="fas fa-plus"></i> Registrar Venda
                </a>
            </div>
        `;
        return;
    }
    
    let html = '';
    ultimasVendas.forEach(venda => {
        const dataVenda = new Date(venda.data);
        const hora = dataVenda.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const iconePagamento = {
            'dinheiro': '💵',
            'cartao': '💳',
            'fiado': '📝'
        }[venda.formaPagamento] || '💰';
        
        html += `
            <div class="recent-sale-item">
                <div>
                    <strong>${iconePagamento} Venda #${venda.id}</strong>
                    <div style="font-size: 0.85rem; color: var(--gray-600);">
                        ${hora} • ${venda.itens.length} itens
                    </div>
                </div>
                <div style="font-weight: 600; color: var(--primary);">
                    ${formatarMoeda(venda.total)}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// =============================================
// GRÁFICO DE VENDAS DA SEMANA
// =============================================

function carregarGraficoSemana() {
    const container = document.getElementById('graficoSemana');
    const hoje = new Date();
    const vendasPorDia = [];
    const labels = [];
    
    // Últimos 7 dias
    for (let i = 6; i >= 0; i--) {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() - i);
        const dataStr = data.toISOString().split('T')[0];
        
        const vendasDia = getVendasPorPeriodo(dataStr, dataStr);
        const totalDia = vendasDia.reduce((sum, v) => sum + v.total, 0);
        
        vendasPorDia.push(totalDia);
        
        // Label abreviado
        const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'short' });
        labels.push(diaSemana.replace('.', ''));
    }
    
    // Encontrar o valor máximo para escala
    const maxVenda = Math.max(...vendasPorDia, 1);
    
    let html = '';
    vendasPorDia.forEach((valor, index) => {
        const altura = maxVenda > 0 ? (valor / maxVenda) * 100 : 5;
        const alturaMinima = 10; // Altura mínima para visualização
        
        html += `
            <div style="flex: 1; text-align: center;">
                <div style="margin-bottom: 0.5rem; font-weight: 600; color: var(--primary);">
                    ${formatarMoeda(valor)}
                </div>
                <div style="position: relative; height: 150px;">
                    <div class="chart-bar" style="height: ${Math.max(altura, alturaMinima)}%; min-height: 15px;">
                        <span class="chart-bar-label">${labels[index]}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// =============================================
// ALERTAS DE ESTOQUE
// =============================================

function carregarAlertasEstoque() {
    const container = document.getElementById('alertasEstoqueLista');
    const produtosBaixoEstoque = getProdutosBaixoEstoque();
    
    if (produtosBaixoEstoque.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <i class="fas fa-check-circle" style="font-size: 2.5rem; color: var(--success); opacity: 0.5;"></i>
                <p style="color: var(--gray-600); margin-top: 1rem;">Todos os produtos com estoque adequado</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    produtosBaixoEstoque.slice(0, 5).forEach(produto => {
        const percentual = (produto.estoque / produto.estoqueMinimo) * 100;
        const urgencia = percentual === 0 ? 'critical' : 
                        percentual < 50 ? 'high' : 'medium';
        
        const cores = {
            critical: { bg: '#fee', cor: '#991b1b', texto: 'ESGOTADO' },
            high: { bg: '#fff3e0', cor: '#b45309', texto: 'CRÍTICO' },
            medium: { bg: '#fef3c7', cor: '#92400e', texto: 'BAIXO' }
        };
        
        const estilo = cores[urgencia];
        
        html += `
            <div class="alert-item" style="background: ${estilo.bg}; margin-bottom: 0.5rem; border-radius: 8px;">
                <div>
                    <strong>${produto.nome}</strong>
                    <div style="font-size: 0.85rem; color: var(--gray-600);">
                        ${produto.categoria}
                    </div>
                </div>
                <div style="text-align: right;">
                    <span class="badge" style="background: ${estilo.cor}; color: white; font-size: 0.7rem;">
                        ${estilo.texto}
                    </span>
                    <div style="font-weight: 600; margin-top: 0.3rem;">
                        ${produto.estoque} / ${produto.estoqueMinimo}
                    </div>
                </div>
            </div>
        `;
    });
    
    if (produtosBaixoEstoque.length > 5) {
        html += `
            <div style="text-align: center; margin-top: 1rem;">
                <a href="estoque.html" style="color: var(--primary); text-decoration: none;">
                    <i class="fas fa-arrow-right"></i> Ver mais ${produtosBaixoEstoque.length - 5} produtos
                </a>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// =============================================
// PRODUTOS MAIS VENDIDOS HOJE
// =============================================

function carregarProdutosMaisVendidos() {
    const container = document.getElementById('produtosMaisVendidos');
    const hoje = getDataAtual();
    const vendasHoje = getVendasPorPeriodo(hoje, hoje);
    const produtos = getProdutos();
    
    // Contabilizar vendas por produto
    const vendasPorProduto = {};
    vendasHoje.forEach(venda => {
        venda.itens.forEach(item => {
            if (!vendasPorProduto[item.produtoId]) {
                vendasPorProduto[item.produtoId] = {
                    id: item.produtoId,
                    quantidade: 0,
                    total: 0
                };
            }
            vendasPorProduto[item.produtoId].quantidade += item.quantidade;
            vendasPorProduto[item.produtoId].total += item.precoUnitario * item.quantidade;
        });
    });
    
    // Adicionar nomes dos produtos
    const ranking = Object.values(vendasPorProduto).map(item => {
        const produto = produtos.find(p => p.id === item.id);
        return {
            ...item,
            nome: produto ? produto.nome : 'Produto removido',
            categoria: produto ? produto.categoria : ''
        };
    });
    
    // Ordenar por quantidade
    ranking.sort((a, b) => b.quantidade - a.quantidade);
    
    if (ranking.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <i class="fas fa-chart-line" style="font-size: 2rem; opacity: 0.3;"></i>
                <p style="color: var(--gray-600); margin-top: 0.5rem;">
                    Nenhuma venda registrada hoje
                </p>
            </div>
        `;
        return;
    }
    
    let html = '';
    const top5 = ranking.slice(0, 5);
    const maxQuantidade = top5[0].quantidade;
    
    top5.forEach((produto, index) => {
        const percentual = (produto.quantidade / maxQuantidade) * 100;
        const medalha = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
        
        html += `
            <div style="margin-bottom: 1.2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
                    <div>
                        <span style="font-weight: 600;">${medalha} ${produto.nome}</span>
                        <div style="font-size: 0.8rem; color: var(--gray-600);">
                            ${produto.categoria}
                        </div>
                    </div>
                    <div style="font-weight: 600; color: var(--primary);">
                        ${produto.quantidade} un.
                    </div>
                </div>
                <div class="progress-bar" style="height: 6px;">
                    <div class="progress-fill" style="width: ${percentual}%; background: var(--warning);"></div>
                </div>
                <div style="font-size: 0.85rem; color: var(--gray-600); margin-top: 0.2rem;">
                    Total: ${formatarMoeda(produto.total)}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// =============================================
// RESUMO FINANCEIRO DO MÊS
// =============================================

function carregarResumoFinanceiro() {
    const inicioMes = getInicioMes();
    const hoje = getDataAtual();
    
    const vendasMes = getVendasPorPeriodo(inicioMes, hoje);
    const receitaTotal = vendasMes.reduce((sum, v) => sum + v.total, 0);
    
    const despesasTotal = getTotalDespesasPeriodo(inicioMes, hoje);
    const lucroLiquido = receitaTotal - despesasTotal;
    
    document.getElementById('receitaMes').textContent = formatarMoeda(receitaTotal);
    document.getElementById('despesasMes').textContent = formatarMoeda(despesasTotal);
    document.getElementById('lucroLiquido').textContent = formatarMoeda(lucroLiquido);
    
    // Adicionar classe de cor baseado no lucro
    const lucroElement = document.getElementById('lucroLiquido');
    if (lucroLiquido > 0) {
        lucroElement.style.color = 'var(--success)';
    } else if (lucroLiquido < 0) {
        lucroElement.style.color = 'var(--danger)';
    }
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

function getDataDiaAnterior() {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    return ontem.toISOString().split('T')[0];
}

// =============================================
// ATUALIZAÇÃO EM TEMPO REAL (OPCIONAL)
// =============================================

// Função para atualizar apenas os cards quando houver nova venda
window.atualizarDashboardAposVenda = function() {
    carregarEstatisticas();
    carregarUltimasVendas();
    carregarProdutosMaisVendidos();
    carregarResumoFinanceiro();
};

// Listener para mudanças no localStorage (entre abas)
window.addEventListener('storage', function(e) {
    if (e.key && e.key.startsWith('doutorPaladar')) {
        carregarDashboard();
    }
});

console.log('✅ Dashboard.js carregado - Desenvolvido por Victor');