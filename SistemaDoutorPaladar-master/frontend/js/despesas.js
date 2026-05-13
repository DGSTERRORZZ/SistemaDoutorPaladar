// =============================================
// DESPESAS.JS - Controle de Despesas (Reformulado)
// =============================================

document.addEventListener('DOMContentLoaded', async function() {
  if (!verificarAutenticacao()) return;
  document.getElementById('data').value = new Date().toISOString().split('T')[0];
  document.getElementById('filtroMes').value = new Date().toISOString().slice(0, 7);
  await carregarDespesasTabela();
  await carregarResumoMes();

  document.getElementById('despesaForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    await registrarDespesa();
  });
});

async function registrarDespesa() {
  const descricao = document.getElementById('descricao').value.trim();
  const categoria = document.getElementById('categoria').value;
  const valor = parseFloat(document.getElementById('valor').value);
  const dataInput = document.getElementById('data').value;
  if (!descricao || isNaN(valor) || valor <= 0) { showToast('Preencha corretamente', 'warning'); return; }
  try {
    await adicionarDespesa(descricao, valor, categoria, dataInput);
    document.getElementById('despesaForm').reset();
    document.getElementById('data').value = new Date().toISOString().split('T')[0];
    await carregarDespesasTabela();
    await carregarResumoMes();
    showToast('Despesa registrada!', 'success');
  } catch (e) { showToast('Erro ao registrar despesa', 'error'); }
}

async function carregarDespesasTabela() {
  const despesas = await getDespesas();
  const mesFiltro = document.getElementById('filtroMes').value;
  let filtradas = despesas;
  if (mesFiltro) filtradas = despesas.filter(d => d.data.slice(0, 7) === mesFiltro);
  filtradas.sort((a, b) => new Date(b.data) - new Date(a.data));
  const tbody = document.getElementById('despesasTableBody');
  tbody.innerHTML = filtradas.length === 0
    ? '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-secondary);">Nenhuma despesa encontrada</td></tr>'
    : filtradas.map(d => `<tr>
        <td>${formatarData(d.data)}</td>
        <td>${escapeHtml(d.descricao)}</td>
        <td><span class="badge" style="background:var(--bg-nav);color:var(--text-secondary);">${escapeHtml(d.categoria)}</span></td>
        <td style="font-weight:700;color:var(--danger);">${formatarMoeda(d.valor)}</td>
        <td><button class="btn-icon" onclick="excluirDespesa(${d.id})" title="Excluir" style="color:var(--danger);">✕</button></td>
      </tr>`).join('');
}

async function carregarResumoMes() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
  const [despesasMes, vendasMes] = await Promise.all([
    getTotalDespesasPeriodo(inicioMes, fimMes),
    getTotalVendasPeriodo(inicioMes, fimMes)
  ]);
  const lucro = vendasMes - despesasMes;
  document.getElementById('resumoMes').innerHTML = `
    <div class="stat-card" style="border-left-color:var(--danger);"><div class="stat-label">Despesas do Mês</div><div class="stat-value" style="background:var(--gradient-danger);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${formatarMoeda(despesasMes)}</div></div>
    <div class="stat-card" style="border-left-color:var(--success);"><div class="stat-label">Receita do Mês</div><div class="stat-value" style="background:linear-gradient(135deg,#10b981,#34d399);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${formatarMoeda(vendasMes)}</div></div>
    <div class="stat-card" style="border-left-color:${lucro >= 0 ? 'var(--success)' : 'var(--danger)'};"><div class="stat-label">Lucro do Mês</div><div class="stat-value">${formatarMoeda(lucro)}</div><small style="color:var(--text-secondary);">${((lucro / vendasMes) * 100 || 0).toFixed(1)}% de margem</small></div>
  `;
}

async function excluirDespesa(id) {
  if (confirm('Excluir esta despesa?')) {
    try {
      await apiFetch(`/despesas/${id}`, { method: 'DELETE' });
      await carregarDespesasTabela();
      await carregarResumoMes();
      showToast('Despesa excluída', 'success');
    } catch (e) { showToast('Erro ao excluir', 'error'); }
  }
}

function filtrarPorMes() { carregarDespesasTabela(); }
