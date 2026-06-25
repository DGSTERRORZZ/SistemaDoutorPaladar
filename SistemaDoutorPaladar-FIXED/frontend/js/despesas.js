// =============================================
// DESPESAS.JS - Controle de Despesas
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
    if (!descricao || isNaN(valor) || valor <= 0) { alert('Preencha corretamente'); return; }
    await adicionarDespesa(descricao, valor, categoria, dataInput);
    document.getElementById('despesaForm').reset();
    document.getElementById('data').value = new Date().toISOString().split('T')[0];
    await carregarDespesasTabela();
    await carregarResumoMes();
}

async function carregarDespesasTabela() {
    const despesas = await getDespesas();
    const mesFiltro = document.getElementById('filtroMes').value;
    let filtradas = despesas;
    if (mesFiltro) filtradas = despesas.filter(d => d.data.slice(0,7) === mesFiltro);
    filtradas.sort((a,b) => new Date(b.data) - new Date(a.data));
    const tbody = document.getElementById('despesasTableBody');
    tbody.innerHTML = filtradas.length === 0
        ? '<tr><td colspan="5">Nenhuma despesa</td></tr>'
        : filtradas.map(d => `<tr><td>${formatarData(d.data)}</td><td>${d.descricao}</td><td>${d.categoria}</td><td>${formatarMoeda(d.valor)}</td><td><button onclick="excluirDespesa(${d.id})"><i class="fas fa-trash" style="color:red;"></i></button></td></tr>`).join('');
}

async function carregarResumoMes() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
    const despesasMes = await getTotalDespesasPeriodo(inicioMes, fimMes);
    const vendasMes = await getTotalVendasPeriodo(inicioMes, fimMes);
    const lucro = vendasMes - despesasMes;
    document.getElementById('resumoMes').innerHTML = `
        <div class="stat-card"><div class="stat-label">Despesas do Mês</div><div class="stat-value" style="color:var(--danger);">${formatarMoeda(despesasMes)}</div></div>
        <div class="stat-card"><div class="stat-label">Receita do Mês</div><div class="stat-value" style="color:var(--success);">${formatarMoeda(vendasMes)}</div></div>
        <div class="stat-card"><div class="stat-label">Lucro do Mês</div><div class="stat-value" style="color:${lucro>=0?'var(--success)':'var(--danger)'};">${formatarMoeda(lucro)}</div><small>${((lucro/vendasMes)*100 || 0).toFixed(1)}% de margem</small></div>
    `;
}

async function excluirDespesa(id) {
    if (confirm('Excluir esta despesa?')) {
        await fetch(`http://localhost:3000/api/despesas/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
        await carregarDespesasTabela();
        await carregarResumoMes();
    }
}

function filtrarPorMes() { carregarDespesasTabela(); }