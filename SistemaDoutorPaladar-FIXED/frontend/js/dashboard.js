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
    
    // Limpar intervalo ao sair da página (memory leak fix)
    window.addEventListener('beforeunload', () => {
        if (dashboardInterval) {
            clearInterval(dashboardInterval);
            dashboardInterval = null;
        }
    });
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
    
    // Evitar chamada duplicada - reutilizar o mesmo fiado
    const fiado = await getFiado();
    document.getElementById('fiadoPendente').textContent = formatarMoeda(stats.totalFiado);
    document.getElementById('qtdDevedores').textContent = fiado.clientes.filter(c => c.dividas.some(d => !d.pago)).length;
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

// Gráfico semanal com barras CSS (implementação real)
function carregarGraficoSemana() {
    const container = document.getElementById('graficoSemana');
    if (!container) return;
    
    // Se já tiver gráfico implementado com Chart.js no admin, aqui mantemos simples
    // Para o dashboard principal, usamos barras CSS
    (async () => {
        try {
            const hoje = new Date();
            const dias = [];
            const labels = [];
            
            for (let i = 6; i >= 0; i--) {
                const data = new Date(hoje);
                data.setDate(hoje.getDate() - i);
                const dataStr = data.toISOString().split('T')[0];
                dias.push(dataStr);
                labels.push(data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''));
            }
            
            const vendasPeriodo = await getVendasPorPeriodo(dias[0], dias[6]);
            const totaisPorDia = {};
            dias.forEach(d => totaisPorDia[d] = 0);
            vendasPeriodo.forEach(v => {
                const d = v.data.split('T')[0];
                if (totaisPorDia[d] !== undefined) totaisPorDia[d] += v.total;
            });
            
            const valores = dias.map(d => totaisPorDia[d]);
            const maxValor = Math.max(...valores, 1);
            
            container.innerHTML = `
                <div style="display:flex;align-items:flex-end;height:120px;gap:0.5rem;padding:0.5rem 0;">
                    ${valores.map((v, i) => `
                        <div style="flex:1;text-align:center;">
                            <div style="font-size:0.7rem;margin-bottom:0.3rem;color:var(--text-secondary);">${formatarMoeda(v)}</div>
                            <div style="height:${Math.max((v/maxValor)*80, 8)}%;background:linear-gradient(to top,var(--primary),var(--primary-light));border-radius:6px 6px 0 0;min-height:12px;"></div>
                            <div style="font-size:0.7rem;margin-top:0.3rem;color:var(--text-secondary);">${labels[i]}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (e) {
            container.innerHTML = '<p style="text-align:center; padding:2rem;">Gráfico semanal (dados da API)</p>';
        }
    })();
}

async function carregarAlertasEstoque() {
    const baixoEstoque = await getProdutosBaixoEstoque();
    const container = document.getElementById('alertasEstoqueLista');
    if (!container) return;
    container.innerHTML = baixoEstoque.length ? baixoEstoque.slice(0, 5).map(p => `<div class="alert-item"><div><strong>${escapeHtml(p.nome)}</strong><br>${escapeHtml(p.categoria)}</div><div>${p.estoque}/${p.estoqueMinimo}</div></div>`).join('') : '<p style="text-align:center; padding:2rem;">Tudo certo!</p>';
}

// Ranking de produtos mais vendidos - CORRIGIDO (Object.entries)
async function carregarProdutosMaisVendidos() {
    const hoje = getDataAtual();
    const vendasHoje = await getVendasPorPeriodo(hoje, hoje);
    const produtos = await getProdutos();
    
    const vendasPorProduto = {};
    vendasHoje.forEach(v => v.itens.forEach(i => {
        if (!vendasPorProduto[i.produtoId]) {
            vendasPorProduto[i.produtoId] = { quantidade: 0, total: 0 };
        }
        vendasPorProduto[i.produtoId].quantidade += i.quantidade;
        vendasPorProduto[i.produtoId].total += i.precoUnitario * i.quantidade;
    }));

    // CORRIGIDO: usando Object.entries para mapear corretamente o ID do produto
    const ranking = Object.entries(vendasPorProduto)
        .map(([produtoId, dados]) => {
            const p = produtos.find(pr => pr.id === parseInt(produtoId));
            return {
                nome: p?.nome || 'Desconhecido',
                quantidade: dados.quantidade,
                total: dados.total
            };
        })
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);

    const container = document.getElementById('produtosMaisVendidos');
    if (!container) return;
    
    if (ranking.length === 0) {
        container.innerHTML = '<p style="text-align:center;">Nenhuma venda hoje</p>';
        return;
    }

    container.innerHTML = ranking.map((r, i) => `
        <div style="margin-bottom:1rem;">
            <strong>${i+1}º ${escapeHtml(r.nome)}</strong> — ${r.quantidade} un. (${formatarMoeda(r.total)})
            <div class="progress-bar">
                <div class="progress-fill" style="width:${(r.quantidade / ranking[0].quantidade) * 100}%"></div>
            </div>
        </div>
    `).join('');
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
                <div><strong>${escapeHtml(p.nomeCliente)}</strong> ${p.turma ? `(${escapeHtml(p.turma)})` : ''}<div style="font-size:0.8rem;color:var(--text-secondary);">${p.horarioRetirada}</div></div>
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
    if (lucroEl) {
        lucroEl.textContent = formatarMoeda(lucro);
        lucroEl.style.color = lucro >= 0 ? 'var(--success)' : 'var(--danger)';
    }
}

// ===== FUNÇÃO DE ESCAPE HTML PARA PREVENIR XSS =====
function escapeHtml(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}