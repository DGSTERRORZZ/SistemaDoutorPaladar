// =============================================
// DASHBOARD.JS - API + auto-refresh + card pedidos
// =============================================

let dashboardInterval = null;
let carregando = false;

document.addEventListener('DOMContentLoaded', async function() {
    if (!verificarAutenticacao()) return;
    await carregarDashboardSeguro();
    dashboardInterval = setInterval(carregarDashboardSeguro, 30000);
    window.addEventListener('focus', carregarDashboardSeguro);
});

async function carregarDashboardSeguro() {
    if (carregando) return;
    carregando = true;
    try {
        await carregarDashboard();
    } catch (e) {
        console.error('Erro ao carregar dashboard:', e);
    } finally {
        carregando = false;
    }
}

async function carregarDashboard() {
    atualizarDataAtual();
    await carregarEstatisticas();
    await carregarUltimasVendas();
    carregarGraficoSemana();
    await carregarAlertasEstoque();
    await carregarProdutosMaisVendidos();
    await carregarPedidosDoDia();
    await carregarResumoFinanceiro();
}

function atualizarDataAtual() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

async function carregarEstatisticas() {
    const stats = await getEstatisticasGerais();
    document.getElementById('vendasHoje').textContent = formatarMoeda(stats.vendasHoje);
    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().split('T')[0];
    const vendasOntem = await getTotalVendasPeriodo(ontemStr, ontemStr);
    const trend = document.getElementById('trendVendas');
    if (vendasOntem > 0) {
        const variacao = ((stats.vendasHoje - vendasOntem) / vendasOntem) * 100;
        trend.innerHTML = `<i class="fas fa-${variacao > 0 ? 'arrow-up' : variacao < 0 ? 'arrow-down' : 'minus'}"></i> ${Math.abs(variacao).toFixed(1)}% vs ontem`;
        trend.style.color = variacao > 0 ? 'var(--success)' : variacao < 0 ? 'var(--danger)' : '';
    } else trend.innerHTML = '<i class="fas fa-chart-line"></i> Primeira venda';
    
    document.getElementById('fiadoPendente').textContent = formatarMoeda(stats.totalFiado);
    document.getElementById('qtdDevedores').textContent = (await getFiado()).clientes.filter(c => c.dividas.some(d => !d.pago)).length;
    document.getElementById('lucroMes').textContent = formatarMoeda(stats.lucroMes);
    document.getElementById('progressLucro').style.width = Math.min((stats.lucroMes / 5000) * 100, 100) + '%';
    document.getElementById('alertasEstoque').textContent = stats.alertasEstoque;
    const msg = document.getElementById('alertasMensagem');
    msg.textContent = stats.alertasEstoque === 0 ? 'Estoque em dia! ✓' : `${stats.alertasEstoque} produtos críticos!`;
    msg.style.color = stats.alertasEstoque === 0 ? 'var(--success)' : '';
}

async function carregarUltimasVendas() {
    const vendas = await getVendas();
    const hoje = getDataAtual();
    const container = document.getElementById('ultimasVendas');
    const ultimas = vendas
        .filter(v => v.data.startsWith(hoje))
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 5);
    container.innerHTML = ultimas.length ? ultimas.map(v => {
        const hora = new Date(v.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `<div class="recent-sale-item"><div><strong>Venda #${v.id}</strong><div style="font-size:0.85rem;">${hora} · ${v.itens.length} itens</div></div><div style="font-weight:600; color:var(--primary);">${formatarMoeda(v.total)}</div></div>`;
    }).join('') : '<div style="text-align:center; padding:2rem;">Nenhuma venda registrada</div>';
}

function carregarGraficoSemana() {
    document.getElementById('graficoSemana').innerHTML = '<p style="text-align:center; padding:2rem;">Gráfico semanal (dados da API)</p>';
}

async function carregarAlertasEstoque() {
    const baixoEstoque = await getProdutosBaixoEstoque();
    const container = document.getElementById('alertasEstoqueLista');
    container.innerHTML = baixoEstoque.length ? baixoEstoque.slice(0, 5).map(p => `<div class="alert-item"><div><strong>${p.nome}</strong><br>${p.categoria}</div><div>${p.estoque}/${p.estoqueMinimo}</div></div>`).join('') : '<p style="text-align:center; padding:2rem;">Tudo certo!</p>';
}

async function carregarProdutosMaisVendidos() {
    const hoje = getDataAtual();
    const vendasHoje = await getVendasPorPeriodo(hoje, hoje);
    const produtos = await getProdutos();
    const vendasPorProduto = {};
    vendasHoje.forEach(v => v.itens.forEach(i => {
        if (!vendasPorProduto[i.produtoId]) vendasPorProduto[i.produtoId] = { quantidade: 0, total: 0 };
        vendasPorProduto[i.produtoId].quantidade += i.quantidade;
        vendasPorProduto[i.produtoId].total += i.precoUnitario * i.quantidade;
    }));
    const ranking = Object.values(vendasPorProduto).map((item, idx) => {
        const p = produtos.find(pr => pr.id === Object.keys(vendasPorProduto)[idx]);
        return { nome: p?.nome || 'Desconhecido', ...item };
    }).sort((a, b) => b.quantidade - a.quantidade).slice(0, 5);
    const container = document.getElementById('produtosMaisVendidos');
    container.innerHTML = ranking.length ? ranking.map((r, i) => `
        <div style="margin-bottom:1rem;">
            <strong>${i+1}º ${r.nome}</strong> — ${r.quantidade} un. (${formatarMoeda(r.total)})
            <div class="progress-bar"><div class="progress-fill" style="width:${(r.quantidade/ranking[0].quantidade)*100}%"></div></div>
        </div>`).join('') : '<p style="text-align:center;">Nenhuma venda hoje</p>';
}

async function carregarPedidosDoDia() {
    const container = document.getElementById('pedidosDoDia');
    if (!container) return;
    try {
        const hoje = getDataAtual();
        const res = await fetch(`http://localhost:3000/api/pedidos?data=${hoje}`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
        });
        const pedidos = await res.json();
        if (!pedidos || pedidos.length === 0) {
            container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">Nenhum pedido hoje</p>';
            return;
        }
        const ultimos = pedidos.slice(0, 5);
        const statusCores = { 'pendente': '#f59e0b', 'confirmado': '#10b981', 'preparando': '#3b82f6', 'pronto': '#f97316', 'entregue': '#6b7280', 'recusado': '#ef4444' };
        const statusEmojis = { 'pendente': '🟡', 'confirmado': '🟢', 'preparando': '🔵', 'pronto': '🟠', 'entregue': '⚪', 'recusado': '🔴' };
        container.innerHTML = ultimos.map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0;border-bottom:1px solid var(--border-color);">
                <div><strong>${p.nomeCliente}</strong> ${p.turma ? `(${p.turma})` : ''}<div style="font-size:0.8rem;color:var(--text-secondary);">${p.horarioRetirada}</div></div>
                <span style="color:${statusCores[p.status] || '#6b7280'};font-weight:600;font-size:0.85rem;">${statusEmojis[p.status] || ''} ${p.status}</span>
            </div>`).join('');
    } catch (e) {
        container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">Erro ao carregar pedidos</p>';
    }
}

async function carregarResumoFinanceiro() {
    const inicioMes = getInicioMes();
    const hoje = getDataAtual();
    const receita = await getTotalVendasPeriodo(inicioMes, hoje);
    const despesas = await getTotalDespesasPeriodo(inicioMes, hoje);
    const lucro = receita - despesas;
    document.getElementById('receitaMes').textContent = formatarMoeda(receita);
    document.getElementById('despesasMes').textContent = formatarMoeda(despesas);
    const lucroEl = document.getElementById('lucroLiquido');
    lucroEl.textContent = formatarMoeda(lucro);
    lucroEl.style.color = lucro >= 0 ? 'var(--success)' : 'var(--danger)';
}