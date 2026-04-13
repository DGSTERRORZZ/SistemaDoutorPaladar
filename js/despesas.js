// =============================================
// DESPESAS.JS - Controle de Despesas
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    if (!verificarAutenticacao()) return;
    
    // Configurar data padrão
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data').value = hoje;
    
    // Configurar filtro mês
    const anoMes = new Date().toISOString().slice(0, 7);
    document.getElementById('filtroMes').value = anoMes;
    
    carregarDespesas();
    carregarResumoMes();
    
    // Form submit
    document.getElementById('despesaForm').addEventListener('submit', function(e) {
        e.preventDefault();
        registrarDespesa();
    });
});

function registrarDespesa() {
    const descricao = document.getElementById('descricao').value.trim();
    const categoria = document.getElementById('categoria').value;
    const valor = parseFloat(document.getElementById('valor').value);
    let data = document.getElementById('data').value;
    
    if (!descricao || valor <= 0) {
        alert('Preencha todos os campos corretamente');
        return;
    }
    
    if (!data) {
        data = new Date().toISOString().split('T')[0];
    }
    
    const despesa = adicionarDespesa(descricao, valor, categoria);
    despesa.data = data + 'T12:00:00.000Z';
    
    const despesas = getDespesas();
    const index = despesas.findIndex(d => d.id === despesa.id);
    if (index !== -1) {
        despesas[index].data = despesa.data;
        salvarDespesas(despesas);
    }
    
    alert('✅ Despesa registrada com sucesso!');
    document.getElementById('despesaForm').reset();
    document.getElementById('data').value = new Date().toISOString().split('T')[0];
    
    carregarDespesas();
    carregarResumoMes();
}

function carregarDespesas() {
    const despesas = getDespesas();
    const tbody = document.getElementById('despesasTableBody');
    
    const mesFiltro = document.getElementById('filtroMes').value;
    let despesasFiltradas = despesas;
    
    if (mesFiltro) {
        despesasFiltradas = despesas.filter(d => {
            const data = new Date(d.data);
            const anoMes = data.toISOString().slice(0, 7);
            return anoMes === mesFiltro;
        });
    }
    
    despesasFiltradas.sort((a, b) => new Date(b.data) - new Date(a.data));
    
    if (despesasFiltradas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-receipt" style="font-size: 2rem; opacity: 0.3;"></i>
                    <p>Nenhuma despesa registrada</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = despesasFiltradas.map(despesa => `
        <tr>
            <td>${formatarData(despesa.data)}</td>
            <td>${despesa.descricao}</td>
            <td><span class="badge">${despesa.categoria}</span></td>
            <td><strong>${formatarMoeda(despesa.valor)}</strong></td>
            <td>
                <button class="btn-icon" onclick="excluirDespesa(${despesa.id})" title="Excluir">
                    <i class="fas fa-trash" style="color: var(--danger);"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function carregarResumoMes() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const despesasMes = getTotalDespesasPeriodo(inicioMes, fimMes);
    const vendasMes = getTotalVendasPeriodo(inicioMes, fimMes);
    const lucroMes = vendasMes - despesasMes;
    
    const container = document.getElementById('resumoMes');
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Despesas do Mês</div>
            <div class="stat-value" style="color: var(--danger);">${formatarMoeda(despesasMes)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Receita do Mês</div>
            <div class="stat-value" style="color: var(--success);">${formatarMoeda(vendasMes)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Lucro do Mês</div>
            <div class="stat-value" style="color: ${lucroMes >= 0 ? 'var(--success)' : 'var(--danger)'};">
                ${formatarMoeda(lucroMes)}
            </div>
            <small>${((lucroMes/vendasMes)*100 || 0).toFixed(1)}% de margem</small>
        </div>
    `;
}

function filtrarPorMes() {
    carregarDespesas();
}

function excluirDespesa(id) {
    if (confirm('Tem certeza que deseja excluir esta despesa?')) {
        const despesas = getDespesas();
        const filtradas = despesas.filter(d => d.id !== id);
        salvarDespesas(filtradas);
        carregarDespesas();
        carregarResumoMes();
        alert('✅ Despesa excluída com sucesso!');
    }
}

console.log('✅ Despesas.js carregado');