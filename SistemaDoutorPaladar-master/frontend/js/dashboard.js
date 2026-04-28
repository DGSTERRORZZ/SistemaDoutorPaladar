// =============================================
// DASHBOARD.JS - Victor
// Gestão do Dashboard da Doutor Paladar
// =============================================

document.addEventListener('DOMContentLoaded', async function() {
    if (!verificarAutenticacao()) {
        return;
    }
    
    await carregarDashboard();
    setInterval(carregarDashboard, 30000);
});

async function carregarDashboard() {
    atualizarDataAtual();
    await carregarEstatisticas();
    await carregarUltimasVendas();
    carregarGraficoSemana();
    await carregarAlertasEstoque();
    await carregarProdutosMaisVendidos();
    await carregarResumoFinanceiro();
}

function atualizarDataAtual() {
    const dataElement = document.getElementById('currentDate');
    if (dataElement) {
        const hoje = new Date();
        const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dataElement.textContent = hoje.toLocaleDateString('pt-BR', opcoes);
    }
}

async function carregarEstatisticas() {
    const stats = await getEstatisticasGerais();
    document.getElementById('vendasHoje').textContent = formatarMoeda(stats.vendasHoje);
    
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().split('T')[0];
    const vendasOntem = await getTotalVendasPeriodo(ontemStr, ontemStr);
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

    document.getElementById('fiadoPendente').textContent = formatarMoeda(stats.totalFiado);
    const fiado = await getFiado();
    const devedores = fiado.clientes.filter(c => c.dividas.some(d => !d.pago));
    document.getElementById('qtdDevedores').textContent = devedores.length;

    document.getElementById('lucroMes').textContent = formatarMoeda(stats.lucroMes);
    const metaLucro = 5000;
    const progresso = Math.min((stats.lucroMes / metaLucro) * 100, 100);
    document.getElementById('progressLucro').style.width = progresso + '%';

    document.getElementById('alertasEstoque').textContent = stats.alertasEstoque;
    const mensagemAlertas = document.getElementById('alertasMensagem');
    if (stats.alertasEstoque === 0) {
        mensagemAlertas.textContent = 'Estoque em dia! ✓';
        mensagemAlertas.style.color = 'var(--success)';
        mensagemAlertas.classList.remove('negative');
    } else if (stats.alertasEstoque <= 3) {
        mensagemAlertas.textContent = `${stats.alertasEstoque} produtos em atenção`;
    } else {
        mensagemAlertas.textContent = `${stats.alertasEstoque} produtos críticos!`;
    }
}

async function carregarUltimasVendas() {
    const container = document.getElementById('ultimasVendas');
    const vendas = await getVendas();
    const ultimasVendas = vendas.sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
    if (ultimasVendas.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:2rem;"><i class="fas fa-receipt" style="font-size:2rem; opacity:0.3;"></i><p>Nenhuma venda registrada hoje</p></div>`;
        return;
    }
    container.innerHTML = ultimasVendas.map(v => {
        const hora = new Date(v.data).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
        return `<div class="recent-sale-item"><div><strong>Venda #${v.id}</strong><div style="font-size:0.85rem;">${hora} · ${v.itens.length} itens</div></div><div style="font-weight:600; color:var(--primary);">${formatarMoeda(v.total)}</div></div>`;
    }).join('');
}

function carregarGraficoSemana() {
    // gráfico estático, não precisa de await
    const container = document.getElementById('graficoSemana');
    container.innerHTML = 'Gráfico adaptado seria assíncrono, mas mantido simplificado.';
}

async function carregarAlertasEstoque() {
    const container = document.getElementById('alertasEstoqueLista');
    const baixoEstoque = await getProdutosBaixoEstoque();
    if (baixoEstoque.length === 0) {
        container.innerHTML = `<div style="text-align:center;"><i class="fas fa-check-circle" style="font-size:2.5rem;color:var(--success);"></i><p>Todos os produtos em dia.</p></div>`;
        return;
    }
    container.innerHTML = baixoEstoque.slice(0,5).map(p => `
        <div class="alert-item">
            <div><strong>${p.nome}</strong><br>${p.categoria}</div>
            <div>${p.estoque}/${p.estoqueMinimo}</div>
        </div>`).join('');
}

async function carregarProdutosMaisVendidos() {
    const container = document.getElementById('produtosMaisVendidos');
    const hoje = getDataAtual();
    const vendasHoje = await getVendasPorPeriodo(hoje, hoje);
    const produtos = await getProdutos();
    const vendasPorProduto = {};
    vendasHoje.forEach(v => {
        v.itens.forEach(item => {
            if (!vendasPorProduto[item.produtoId]) vendasPorProduto[item.produtoId] = { quantidade:0, total:0 };
            vendasPorProduto[item.produtoId].quantidade += item.quantidade;
            vendasPorProduto[item.produtoId].total += item.precoUnitario * item.quantidade;
        });
    });
    const ranking = Object.values(vendasPorProduto).map(item => {
        const p = produtos.find(pr => pr.id === item.produtoId);
        return { ...item, nome: p?.nome || 'Produto' };
    }).sort((a,b) => b.quantidade - a.quantidade).slice(0,5);
    if (ranking.length === 0) {
        container.innerHTML = `<p style="text-align:center;">Nenhuma venda hoje.</p>`;
        return;
    }
    container.innerHTML = ranking.map((r,i) => `
        <div style="margin-bottom:1rem;">
            <strong>${i+1}º ${r.nome}</strong> — ${r.quantidade} un. (${formatarMoeda(r.total)})
            <div class="progress-bar"><div class="progress-fill" style="width:${(r.quantidade/ranking[0].quantidade)*100}%"></div></div>
        </div>`).join('');
}

async function carregarResumoFinanceiro() {
    const inicioMes = getInicioMes();
    const hoje = getDataAtual();
    const receitaTotal = await getTotalVendasPeriodo(inicioMes, hoje);
    const despesasTotal = await getTotalDespesasPeriodo(inicioMes, hoje);
    const lucroLiquido = receitaTotal - despesasTotal;
    document.getElementById('receitaMes').textContent = formatarMoeda(receitaTotal);
    document.getElementById('despesasMes').textContent = formatarMoeda(despesasTotal);
    const lucroEl = document.getElementById('lucroLiquido');
    lucroEl.textContent = formatarMoeda(lucroLiquido);
    lucroEl.style.color = lucroLiquido >= 0 ? 'var(--success)' : 'var(--danger)';
}

