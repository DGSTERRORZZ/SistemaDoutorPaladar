// =============================================
// DASHBOARD.JS - Reformulado com performance
// =============================================

let dashboardInterval = null;
let carregando = false;

document.addEventListener('DOMContentLoaded', async function() {
  if (!verificarAutenticacao()) return;
  await carregarDashboardSeguro();
  dashboardInterval = setInterval(carregarDashboardSeguro, 30000);

  const focusHandler = () => carregarDashboardSeguro();
  window.addEventListener('focus', focusHandler);
  window.addEventListener('beforeunload', () => {
    clearInterval(dashboardInterval);
    window.removeEventListener('focus', focusHandler);
  });
});

async function carregarDashboardSeguro() {
  if (carregando) return;
  carregando = true;
  try { await carregarDashboard(); }
  catch (e) { console.error('Erro ao carregar dashboard:', e); }
  finally { carregando = false; }
}

async function carregarDashboard() {
  atualizarDataAtual();
  const stats = await getEstatisticasGerais();
  renderEstatisticas(stats);
  await Promise.all([
    carregarUltimasVendas(),
    carregarAlertasEstoque(stats.produtosBaixoEstoque),
    carregarProdutosMaisVendidos(),
    carregarPedidosDoDia(),
    carregarResumoFinanceiro()
  ]);
  carregarGraficoSemana();
}

function atualizarDataAtual() {
  const el = document.getElementById('currentDate');
  if (el) el.textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function renderEstatisticas(stats) {
  document.getElementById('vendasHoje').textContent = formatarMoeda(stats.vendasHoje);
  document.getElementById('fiadoPendente').textContent = formatarMoeda(stats.totalFiado);
  document.getElementById('lucroMes').textContent = formatarMoeda(stats.lucroMes);
  document.getElementById('alertasEstoque').textContent = stats.alertasEstoque;

  const progressEl = document.getElementById('progressLucro');
  if (progressEl) progressEl.style.width = Math.min((stats.lucroMes / 5000) * 100, 100) + '%';

  const msg = document.getElementById('alertasMensagem');
  if (msg) {
    msg.textContent = stats.alertasEstoque === 0 ? 'Estoque em dia!' : `${stats.alertasEstoque} produtos críticos!`;
    msg.style.color = stats.alertasEstoque === 0 ? 'var(--success)' : 'var(--danger)';
  }
}

async function carregarUltimasVendas() {
  try {
    const vendas = await getVendas();
    const hoje = getDataAtual();
    const container = document.getElementById('ultimasVendas');
    const ultimas = vendas
      .filter(v => v.data.startsWith(hoje))
      .sort((a, b) => new Date(b.data) - new Date(a.data))
      .slice(0, 5);

    container.innerHTML = ultimas.length ? ultimas.map(v => {
      const hora = new Date(v.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `<div class="recent-sale-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.8rem 0;border-bottom:1px solid var(--border-color);">
        <div><strong>Venda #${escapeHtml(v.id)}</strong><div style="font-size:0.85rem;color:var(--text-secondary);">${escapeHtml(hora)} · ${v.itens ? v.itens.length : 0} itens</div></div>
        <div style="font-weight:700;color:var(--primary);">${formatarMoeda(v.total)}</div></div>`;
    }).join('') : '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">Nenhuma venda registrada hoje</div>';
  } catch (e) { console.error(e); }
}

function carregarGraficoSemana() {
  const el = document.getElementById('graficoSemana');
  if (!el) return;
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const hoje = new Date().getDay();
  const bars = [];
  for (let i = 6; i >= 0; i--) {
    const idx = (hoje - i + 7) % 7;
    const h = Math.floor(Math.random() * 80) + 20;
    bars.push(`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0.3rem;">
      <div style="width:100%;height:${h}%;background:var(--gradient-primary);border-radius:8px 8px 0 0;min-height:20px;transition:height 0.5s;"></div>
      <span style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">${dias[idx]}</span></div>`);
  }
  el.innerHTML = `<div style="display:flex;align-items:flex-end;height:150px;gap:0.5rem;padding:1rem 0;">${bars.join('')}</div>`;
}

async function carregarAlertasEstoque(produtosBaixo) {
  const container = document.getElementById('alertasEstoqueLista');
  if (!container) return;
  try {
    const baixoEstoque = produtosBaixo || await getProdutosBaixoEstoque();
    container.innerHTML = baixoEstoque.length ? baixoEstoque.slice(0, 5).map(p =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.8rem 0;border-bottom:1px solid var(--border-color);">
        <div><strong>${escapeHtml(p.nome)}</strong><br><span style="font-size:0.85rem;color:var(--text-secondary);">${escapeHtml(p.categoria)}</span></div>
        <span style="color:var(--danger);font-weight:700;">${p.estoque}/${p.estoqueMinimo}</span></div>`
    ).join('') : '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">Tudo certo!</p>';
  } catch (e) { console.error(e); }
}

async function carregarProdutosMaisVendidos() {
  try {
    const hoje = getDataAtual();
    const [vendas, produtos] = await Promise.all([getVendas(), getProdutos()]);
    const vendasHoje = vendas.filter(v => v.data.split('T')[0] === hoje);

    const vendasPorProduto = {};
    vendasHoje.forEach(v => (v.itens || []).forEach(i => {
      if (!vendasPorProduto[i.produtoId]) vendasPorProduto[i.produtoId] = { quantidade: 0, total: 0 };
      vendasPorProduto[i.produtoId].quantidade += i.quantidade;
      vendasPorProduto[i.produtoId].total += i.precoUnitario * i.quantidade;
    }));

    const ranking = Object.entries(vendasPorProduto)
      .map(([id, item]) => {
        const p = produtos.find(pr => pr.id === Number(id));
        return { nome: p ? p.nome : 'Desconhecido', ...item };
      })
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    const container = document.getElementById('produtosMaisVendidos');
    container.innerHTML = ranking.length ? ranking.map((r, i) => `
      <div style="margin-bottom:1rem;animation:fadeInUp ${0.3 + i * 0.1}s ease-out both;">
        <strong>${i + 1}º ${escapeHtml(r.nome)}</strong> — ${r.quantidade} un. (${formatarMoeda(r.total)})
        <div class="progress-bar"><div class="progress-fill" style="width:${(r.quantidade / ranking[0].quantidade) * 100}%"></div></div>
      </div>`).join('') : '<p style="text-align:center;color:var(--text-secondary);">Nenhuma venda hoje</p>';
  } catch (e) { console.error(e); }
}

async function carregarPedidosDoDia() {
  const container = document.getElementById('pedidosDoDia');
  if (!container) return;
  try {
    const hoje = getDataAtual();
    const pedidos = await apiFetch(`/pedidos?data=${hoje}`);
    if (!pedidos || pedidos.length === 0) {
      container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">Nenhum pedido hoje</p>';
      return;
    }
    const statusCores = { pendente: 'var(--warning)', confirmado: 'var(--success)', preparando: 'var(--info)', pronto: '#f97316', entregue: 'var(--text-secondary)', recusado: 'var(--danger)' };
    container.innerHTML = pedidos.slice(0, 5).map(p => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0;border-bottom:1px solid var(--border-color);">
        <div><strong>${escapeHtml(p.nomeCliente)}</strong> ${p.turma ? `(${escapeHtml(p.turma)})` : ''}
        <div style="font-size:0.8rem;color:var(--text-secondary);">${escapeHtml(p.horarioRetirada)}</div></div>
        <span style="color:${statusCores[p.status] || 'var(--text-secondary)'};font-weight:700;font-size:0.85rem;">${escapeHtml(p.status)}</span>
      </div>`).join('');
  } catch (e) {
    container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-secondary);">Erro ao carregar pedidos</p>';
  }
}

async function carregarResumoFinanceiro() {
  try {
    const inicioMes = getInicioMes();
    const hoje = getDataAtual();
    const [receita, despesas] = await Promise.all([
      getTotalVendasPeriodo(inicioMes, hoje),
      getTotalDespesasPeriodo(inicioMes, hoje)
    ]);
    const lucro = receita - despesas;
    const receitaEl = document.getElementById('receitaMes');
    const despesasEl = document.getElementById('despesasMes');
    const lucroEl = document.getElementById('lucroLiquido');
    if (receitaEl) receitaEl.textContent = formatarMoeda(receita);
    if (despesasEl) despesasEl.textContent = formatarMoeda(despesas);
    if (lucroEl) {
      lucroEl.textContent = formatarMoeda(lucro);
      lucroEl.style.color = lucro >= 0 ? 'var(--success)' : 'var(--danger)';
    }
  } catch (e) { console.error(e); }
}
