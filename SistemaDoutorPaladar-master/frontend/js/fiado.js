// =============================================
// FIADO.JS - Gestão de Fiado (API)
// =============================================

let clienteSelecionadoId = null;
let carrinhoFiado = [];
let todosClientes = [];
let produtosCache = [];
let filtroStatusFiado = 'todos';
let filtroTurmaFiado = 'todas';

const savedClienteId = sessionStorage.getItem('clienteSelecionadoId');
if (savedClienteId) clienteSelecionadoId = parseInt(savedClienteId);

document.addEventListener('DOMContentLoaded', async function() {
    if (!verificarAutenticacao()) return;
    await carregarTudo();
    window.addEventListener('focus', async () => {
        await carregarTudo();
        if (clienteSelecionadoId) await carregarDetalhesCliente(clienteSelecionadoId);
    });
});

async function carregarTudo() { await carregarClientes(); await atualizarTotalGeral(); }

async function carregarClientes() {
    try {
        const fiado = await getFiado();
        todosClientes = fiado.clientes || [];
        atualizarFiltroTurmas();
        filtrarClientes();
    } catch (e) { console.error('Erro ao carregar clientes:', e); }
}

function atualizarFiltroTurmas() {
    const select = document.getElementById('filtroTurmaFiado');
    if (!select) return;
    const turmas = [...new Set(todosClientes.map(c => c.turma).filter(Boolean))].sort();
    select.innerHTML = '<option value="todas">Todas as turmas</option>' + turmas.map(t => `<option value="${t}">${t}</option>`).join('');
}

function filtrarClientes() {
    const termo = document.getElementById('buscaCliente').value.toLowerCase();
    filtroStatusFiado = document.getElementById('filtroStatusFiado')?.value || 'todos';
    filtroTurmaFiado = document.getElementById('filtroTurmaFiado')?.value || 'todas';
    let filtrados = todosClientes.filter(cliente => {
        if (termo && !cliente.nome.toLowerCase().includes(termo)) return false;
        if (filtroTurmaFiado !== 'todas' && cliente.turma !== filtroTurmaFiado) return false;
        if (filtroStatusFiado === 'em-dia') { if (cliente.dividas.some(d => !d.pago)) return false; }
        else if (filtroStatusFiado === 'atraso') { const trinta = new Date(Date.now()-30*24*60*60*1000); if (!cliente.dividas.some(d=>!d.pago&&new Date(d.data)<trinta)) return false; }
        return true;
    });
    exibirClientes(filtrados);
}

function exibirClientes(clientes) {
    const container = document.getElementById('listaClientes');
    if (!clientes.length) { container.innerHTML='<div style="text-align:center;padding:2rem;"><i class="fas fa-user-slash" style="font-size:3rem;opacity:0.3;"></i><p>Nenhum cliente encontrado</p></div>'; return; }
    container.innerHTML = clientes.map(cliente => {
        const totalDevido = calcularTotalDevidoCliente(cliente);
        const temAtraso = verificarAtraso(cliente);
        return `<div class="cliente-card ${clienteSelecionadoId===cliente.id?'active':''}" onclick="selecionarCliente(${cliente.id})">
            <div class="cliente-nome">${cliente.nome} ${temAtraso?'<span class="badge badge-danger">Em atraso</span>':''}</div>
            <div class="cliente-turma"><i class="fas fa-graduation-cap"></i> ${cliente.turma||'Não informada'}</div>
            <div class="cliente-divida">${formatarMoeda(totalDevido)}</div><div style="font-size:0.85rem;">${cliente.dividas.length} compra(s)</div></div>`;
    }).join('');
}

function calcularTotalDevidoCliente(cliente) { return cliente.dividas.reduce((s,d)=>!d.pago?s+(d.total-(d.valorPago||0)):s,0); }
function verificarAtraso(cliente) { const t=new Date(Date.now()-30*24*60*60*1000); return cliente.dividas.some(d=>!d.pago&&new Date(d.data)<t); }

async function selecionarCliente(id) {
    clienteSelecionadoId = id; sessionStorage.setItem('clienteSelecionadoId', id);
    await carregarClientes(); await carregarDetalhesCliente(id);
    document.getElementById('painelVazio').style.display='none'; document.getElementById('painelDetalhes').style.display='block';
}

async function carregarDetalhesCliente(id) {
    const cliente = await getClienteFiado(id); if(!cliente)return;
    document.getElementById('clienteNomeDetalhe').textContent=cliente.nome;
    document.getElementById('clienteTurmaDetalhe').innerHTML=`<i class="fas fa-graduation-cap"></i> ${cliente.turma||'Não informada'}`;
    document.getElementById('totalDevidoCliente').textContent=formatarMoeda(calcularTotalDevidoCliente(cliente));
    document.getElementById('totalPagoCliente').textContent=formatarMoeda(cliente.dividas.reduce((s,d)=>s+(d.valorPago||0),0));
    document.getElementById('qtdComprasCliente').textContent=cliente.dividas.length;
    carregarHistoricoCompras(cliente);
}

function carregarHistoricoCompras(cliente) {
    const container = document.getElementById('historicoCompras');
    if(!cliente.dividas.length){container.innerHTML='<p style="color:var(--gray-600);">Nenhuma compra registrada</p>';return;}
    const ord=[...cliente.dividas].sort((a,b)=>new Date(b.data)-new Date(a.data));
    container.innerHTML=ord.map(d=>{
        const sc=d.pago?'status-pago':(new Date(d.data)<new Date(Date.now()-30*24*60*60*1000)?'status-atraso':'status-pendente');
        const st=d.pago?'Pago ✓':(sc==='status-atraso'?'Em atraso ⚠️':'Pendente');
        return `<div class="divida-item"><div class="divida-header"><div><strong>Compra #${d.id}</strong> <span>${formatarData(d.data)}</span></div><span class="${sc}">${st}</span></div><div>${d.itens.map(i=>`${i.quantidade}x ${produtosCache.find(p=>p.id===i.produtoId)?.nome||'Produto'}`).join(', ')}</div><div style="display:flex;justify-content:space-between;margin-top:0.5rem;"><strong>Total: ${formatarMoeda(d.total)}</strong><span>Pago: ${formatarMoeda(d.valorPago||0)} ${!d.pago?`| Restante: ${formatarMoeda(d.total-(d.valorPago||0))}`:''}</span></div></div>`;
    }).join('');
}

async function atualizarTotalGeral() { document.getElementById('totalGeralFiado').textContent=formatarMoeda(await getTotalFiadoPendente()); }

function abrirModalNovoCliente(){document.getElementById('modalNovoCliente').classList.add('active');}
function fecharModal(id){document.getElementById(id).classList.remove('active');}

async function cadastrarCliente(event){
    event.preventDefault();
    const nome=document.getElementById('novoClienteNome').value.trim(),turma=document.getElementById('novoClienteTurma').value.trim();
    if(!nome||nome.length<3){alert('Nome deve ter pelo menos 3 caracteres.');return;}
    const novo=await adicionarClienteFiado(nome,turma);
    if(novo){fecharModal('modalNovoCliente');document.getElementById('formNovoCliente').reset();await carregarTudo();selecionarCliente(novo.id);mostrarNotificacao('Cliente cadastrado!','success');}
}

async function abrirModalNovaCompra(){
    if(!clienteSelecionadoId){alert('Selecione um cliente');return;}
    const cliente=await getClienteFiado(clienteSelecionadoId);
    document.getElementById('clienteSelecionadoInfo').innerHTML=`<strong>${cliente.nome}</strong> · ${cliente.turma||'Não informada'}`;
    await carregarProdutosParaFiado(); carrinhoFiado=[]; atualizarResumoCompra(); document.getElementById('modalNovaCompra').classList.add('active');
}

async function carregarProdutosParaFiado(){
    try{
        produtosCache=await getProdutos();
        const container=document.getElementById('listaProdutosFiado');
        const categorias=[...new Set(produtosCache.map(p=>p.categoria))];
        container.innerHTML=categorias.map(cat=>{
            const prods=produtosCache.filter(p=>p.categoria===cat&&p.estoque>0);
            if(!prods.length)return'';
            return`<div style="margin-bottom:1rem;"><h5>${cat}</h5>`+prods.map(p=>`<div class="produto-selector flex-between"><div><strong>${p.nome}</strong><br><small>${formatarMoeda(p.preco)} · Estoque: ${p.estoque}</small></div><input type="number" id="qtd_${p.id}" min="0" max="${p.estoque}" value="0" onchange="atualizarCarrinho(${p.id},this.value)" style="width:70px;"></div>`).join('')+`</div>`;
        }).join('');
    }catch(e){console.error(e);}
}

function atualizarCarrinho(produtoId,quantidade){
    quantidade=parseInt(quantidade)||0; carrinhoFiado=carrinhoFiado.filter(i=>i.produtoId!==produtoId);
    if(quantidade>0){const p=produtosCache.find(p=>p.id===produtoId); if(p&&quantidade<=p.estoque)carrinhoFiado.push({produtoId,quantidade,precoUnitario:p.preco}); else{alert('Quantidade indisponível!');document.getElementById(`qtd_${produtoId}`).value=0;}}
    atualizarResumoCompra();
}

function atualizarResumoCompra(){
    const c=document.getElementById('resumoCompraFiado'),t=document.getElementById('totalCompraFiado');
    if(!carrinhoFiado.length){c.innerHTML='<p style="color:var(--gray-600);">Nenhum produto selecionado</p>';t.textContent='R$ 0,00';return;}
    let total=0; c.innerHTML=carrinhoFiado.map(i=>{const p=produtosCache.find(p=>p.id===i.produtoId); const s=i.quantidade*i.precoUnitario; total+=s; return`<div class="flex-between"><span>${i.quantidade}x ${p?.nome||'Produto'}</span><span>${formatarMoeda(s)}</span></div>`;}).join('');
    t.textContent=formatarMoeda(total);
}

async function finalizarCompraFiado(){
    if(!carrinhoFiado.length){alert('Selecione itens');return;}
    const total=carrinhoFiado.reduce((s,i)=>s+i.quantidade*i.precoUnitario,0);
    try{const ok=await registrarCompraFiado(clienteSelecionadoId,carrinhoFiado,total); if(ok){fecharModal('modalNovaCompra');await carregarTudo();await selecionarCliente(clienteSelecionadoId);mostrarNotificacao('Compra registrada!','success');}}catch(e){alert('Erro');}
}

async function abrirModalPagamento(){
    if(!clienteSelecionadoId){alert('Selecione um cliente');return;}
    const cliente=await getClienteFiado(clienteSelecionadoId); const dp=cliente.dividas.filter(d=>!d.pago);
    if(!dp.length){alert('Sem dívidas pendentes');return;}
    const select=document.getElementById('selectDivida');
    select.innerHTML='<option value="">Selecione...</option>'+dp.map(d=>{const r=d.total-(d.valorPago||0); return`<option value="${d.id}" data-restante="${r}">Compra #${d.id} - ${formatarData(d.data)} - Total: ${formatarMoeda(d.total)} - Restante: ${formatarMoeda(r)}</option>`;}).join('');
    document.getElementById('valorPagamento').value=''; document.getElementById('valorMaximoInfo').textContent='';
    select.onchange=function(){const o=this.options[this.selectedIndex]; if(o.dataset.restante){document.getElementById('valorPagamento').max=o.dataset.restante; document.getElementById('valorMaximoInfo').textContent=`Valor máximo: ${formatarMoeda(parseFloat(o.dataset.restante))}`;}};
    document.getElementById('modalPagamento').classList.add('active');
}

async function registrarPagamento(event){
    event.preventDefault();
    const dividaId=parseInt(document.getElementById('selectDivida').value),valor=parseFloat(document.getElementById('valorPagamento').value);
    if(!dividaId||!valor||valor<=0){alert('Informe um valor válido');return;}
    const restante=parseFloat(document.getElementById('selectDivida').selectedOptions[0].dataset.restante);
    if(valor>restante){alert(`Máximo: ${formatarMoeda(restante)}`);return;}
    try{await registrarPagamentoFiado(clienteSelecionadoId,dividaId,valor);fecharModal('modalPagamento');await carregarTudo();await selecionarCliente(clienteSelecionadoId);mostrarNotificacao('Pagamento registrado!','success');}catch(e){alert('Erro');}
}

function mostrarNotificacao(msg,tipo){const d=document.createElement('div'); d.className=`alert alert-${tipo}`; d.textContent=msg; d.style.cssText='position:fixed;top:20px;right:20px;z-index:9999;min-width:300px;animation:fadeIn 0.3s;'; document.body.appendChild(d); setTimeout(()=>d.remove(),3000);}
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal').forEach(m=>m.classList.remove('active'));});