const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../database');
const { verifyAdmin } = require('../authMiddleware');

function getIntervaloDatas(periodo, dataInicioStr, dataFimStr) {
  const agora = new Date();

  const formatYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  let inicioDate, fimDate;

  if (periodo === 'hoje') {
    const hojeYMD = formatYMD(agora);
    inicioDate = `${hojeYMD} 00:00:00`;
    fimDate = `${hojeYMD} 23:59:59`;
  } else if (periodo === 'ontem') {
    const ontem = new Date(agora);
    ontem.setDate(ontem.getDate() - 1);
    const ontemYMD = formatYMD(ontem);
    inicioDate = `${ontemYMD} 00:00:00`;
    fimDate = `${ontemYMD} 23:59:59`;
  } else if (periodo === '7d') {
    const d7 = new Date(agora);
    d7.setDate(d7.getDate() - 6);
    inicioDate = `${formatYMD(d7)} 00:00:00`;
    fimDate = `${formatYMD(agora)} 23:59:59`;
  } else if (periodo === '30d') {
    const d30 = new Date(agora);
    d30.setDate(d30.getDate() - 29);
    inicioDate = `${formatYMD(d30)} 00:00:00`;
    fimDate = `${formatYMD(agora)} 23:59:59`;
  } else if (periodo === 'mes_atual') {
    const primeiroDia = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
    inicioDate = `${formatYMD(primeiroDia)} 00:00:00`;
    fimDate = `${formatYMD(ultimoDia)} 23:59:59`;
  } else if (periodo === 'mes_anterior') {
    const primeiroDia = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const ultimoDia = new Date(agora.getFullYear(), agora.getMonth(), 0);
    inicioDate = `${formatYMD(primeiroDia)} 00:00:00`;
    fimDate = `${formatYMD(ultimoDia)} 23:59:59`;
  } else if (periodo === 'ano_atual') {
    const primeiroDia = new Date(agora.getFullYear(), 0, 1);
    const ultimoDia = new Date(agora.getFullYear(), 11, 31);
    inicioDate = `${formatYMD(primeiroDia)} 00:00:00`;
    fimDate = `${formatYMD(ultimoDia)} 23:59:59`;
  } else if (periodo === 'custom' && dataInicioStr && dataFimStr) {
    inicioDate = `${dataInicioStr.slice(0, 10)} 00:00:00`;
    fimDate = `${dataFimStr.slice(0, 10)} 23:59:59`;
  } else {
    inicioDate = '1970-01-01 00:00:00';
    fimDate = `${formatYMD(agora)} 23:59:59`;
  }

  return { inicioDate, fimDate };
}

// GET /api/analytics - dados analíticos consolidados reais do banco de dados (Fonte de Verdade Unificada)
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const { periodo, dataInicio, dataFim, formaPagamento, status } = req.query;
    const { inicioDate, fimDate } = getIntervaloDatas(periodo, dataInicio, dataFim);

    const hojeYMD = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const hojeInicio = `${hojeYMD} 00:00:00`;
    const hojeFim = `${hojeYMD} 23:59:59`;

    // 1. Consolidação de Pedidos (Tabela pedidos: status não cancelado nem recusado por padrão, ou o status filtrado)
    let statusFilter = "status NOT IN ('cancelado', 'recusado')";
    let paramsPedidos = [inicioDate, fimDate];
    if (status) {
      statusFilter = 'status = ?';
      paramsPedidos = [status, inicioDate, fimDate];
    }
    let sqlPag = '';
    if (formaPagamento) {
      sqlPag = ' AND formaPagamento = ?';
      paramsPedidos.push(formaPagamento);
    }

    // Buscar pedidos no período
    const pedidos = await query(`SELECT * FROM pedidos WHERE ${statusFilter} AND data >= ? AND data <= ?${sqlPag}`, paramsPedidos);

    // Buscar vendas diretas no PDV (onde pedidoId é nulo ou 0 para não duplicar com pedidos)
    let paramsVendasPdv = [inicioDate, fimDate];
    let sqlPagVendas = '';
    if (formaPagamento) {
      sqlPagVendas = ' AND formaPagamento = ?';
      paramsVendasPdv.push(formaPagamento);
    }
    const vendasPdv = await query(`SELECT * FROM vendas WHERE (pedidoId IS NULL OR pedidoId = 0) AND data >= ? AND data <= ?${sqlPagVendas}`, paramsVendasPdv);

    // Vendas hoje (acumulado do dia atual)
    const resVendasHojePedidos = await queryOne(`SELECT SUM(total) as total FROM pedidos WHERE ${statusFilter} AND data >= ? AND data <= ?`, [hojeInicio, hojeFim]);
    const resVendasHojePdv = await queryOne('SELECT SUM(total) as total FROM vendas WHERE (pedidoId IS NULL OR pedidoId = 0) AND data >= ? AND data <= ?', [hojeInicio, hojeFim]);
    const vendasHoje = parseFloat(resVendasHojePedidos?.total || 0) + parseFloat(resVendasHojePdv?.total || 0);

    // Total de Vendas do Período
    const totalPedidosValor = pedidos.reduce((acc, p) => acc + parseFloat(p.total || 0), 0);
    const totalVendasPdvValor = vendasPdv.reduce((acc, v) => acc + parseFloat(v.total || 0), 0);
    const vendasPeriodo = totalPedidosValor + totalVendasPdvValor;

    // Total de Vendas Geral (Acumulado da história do sistema)
    const resVendasGeralPedidos = await queryOne(`SELECT SUM(total) as total FROM pedidos WHERE ${statusFilter}`);
    const resVendasGeralPdv = await queryOne('SELECT SUM(total) as total FROM vendas WHERE (pedidoId IS NULL OR pedidoId = 0)');
    const totalVendasGeral = parseFloat(resVendasGeralPedidos?.total || 0) + parseFloat(resVendasGeralPdv?.total || 0);

    // Quantidade de Pedidos / Transações no Período
    const qtdPedidos = pedidos.length + vendasPdv.length;
    const ticketMedio = qtdPedidos > 0 ? (vendasPeriodo / qtdPedidos) : 0;

    // Mapeamento de Status dos Pedidos no Período
    const resStatus = await query('SELECT status, COUNT(*) as qtd FROM pedidos WHERE data >= ? AND data <= ? GROUP BY status', [inicioDate, fimDate]);
    const statusMap = { pendente: 0, confirmado: 0, preparando: 0, pronto: 0, entregue: 0, cancelado: 0, recusado: 0 };
    resStatus.forEach(r => { if (statusMap.hasOwnProperty(r.status)) statusMap[r.status] = r.qtd; });

    // 2. Produtos Mais e Menos Vendidos (Unificando itens_pedido e itens_venda)
    const prodMap = {};

    const itensPedido = await query(
      `SELECT ip.nome, ip.quantidade, ip.precoUnitario
       FROM itens_pedido ip
       JOIN pedidos p ON ip.pedidoId = p.id
       WHERE p.${statusFilter} AND p.data >= ? AND p.data <= ?${sqlPag.replace(/formaPagamento/g, 'p.formaPagamento')}`,
      paramsPedidos
    );

    const itensVenda = await query(
      `SELECT iv.nome, iv.quantidade, iv.precoUnitario
       FROM itens_venda iv
       JOIN vendas v ON iv.vendaId = v.id
       WHERE (v.pedidoId IS NULL OR v.pedidoId = 0) AND v.data >= ? AND v.data <= ?${sqlPagVendas.replace(/formaPagamento/g, 'v.formaPagamento')}`,
      paramsVendasPdv
    );

    [...itensPedido, ...itensVenda].forEach(item => {
      const nome = item.nome || 'Produto sem nome';
      const qtd = parseInt(item.quantidade || 0);
      const preco = parseFloat(item.precoUnitario || 0);
      if (!prodMap[nome]) {
        prodMap[nome] = { nome, qtdTotal: 0, faturamentoTotal: 0 };
      }
      prodMap[nome].qtdTotal += qtd;
      prodMap[nome].faturamentoTotal += (qtd * preco);
    });

    const todosProdutosRank = Object.values(prodMap);
    todosProdutosRank.sort((a, b) => b.qtdTotal - a.qtdTotal);

    const topProdutos = todosProdutosRank.slice(0, 5);
    const menosProdutos = [...todosProdutosRank].reverse().slice(0, 5);

    // 3. Categorias mais vendidas
    const catMap = {};
    const produtosDb = await query('SELECT id, nome, categoria FROM produtos');
    const prodCatLookup = {};
    produtosDb.forEach(p => { prodCatLookup[p.nome] = p.categoria || 'Geral'; });

    todosProdutosRank.forEach(item => {
      const cat = prodCatLookup[item.nome] || 'Lanches';
      if (!catMap[cat]) catMap[cat] = { categoria: cat, qtdTotal: 0, faturamento: 0 };
      catMap[cat].qtdTotal += item.qtdTotal;
      catMap[cat].faturamento += item.faturamentoTotal;
    });

    const categoriasVendidas = Object.values(catMap).sort((a, b) => b.faturamento - a.faturamento);

    // 4. Clientes & Fidelidade
    const resClientesTotal = await queryOne('SELECT COUNT(*) as total FROM clientes_app');
    const resClientesNovos = await queryOne('SELECT COUNT(*) as total FROM clientes_app WHERE dataCadastro >= ? AND dataCadastro <= ?', [inicioDate, fimDate]);
    const resClientesRecorrentes = await queryOne('SELECT COUNT(*) as total FROM clientes_app WHERE totalPedidos > 1');
    const resPontosFidelidade = await queryOne('SELECT SUM(pontosFidelidade) as total FROM clientes_app');

    // 5. Agendamentos
    const resAgendamentosCount = await queryOne('SELECT COUNT(*) as total FROM cliente_agendamentos WHERE dataCriacao >= ? AND dataCriacao <= ?', [inicioDate, fimDate]);
    const resVagasStats = await queryOne('SELECT SUM(vagasTotais) as totais, SUM(vagasOcupadas) as ocupadas FROM agendamentos');
    const taxaUtilizacao = resVagasStats?.totais > 0 ? Math.round((resVagasStats.ocupadas / resVagasStats.totais) * 100) : 0;

    // 6. Vendas a Prazo / Crédito
    const resVendasCreditoPedidos = await queryOne(`SELECT SUM(total) as total FROM pedidos WHERE ${statusFilter} AND formaPagamento IN ('a_prazo', 'fiado') AND data >= ? AND data <= ?`, [inicioDate, fimDate]);
    const resVendasCreditoPdv = await queryOne(`SELECT SUM(total) as total FROM vendas WHERE (pedidoId IS NULL OR pedidoId = 0) AND formaPagamento IN ('a_prazo', 'fiado') AND data >= ? AND data <= ?`, [inicioDate, fimDate]);
    const vendasCredito = parseFloat(resVendasCreditoPedidos?.total || 0) + parseFloat(resVendasCreditoPdv?.total || 0);

    const resPendentesCredito = await queryOne('SELECT SUM(saldoDevedor) as total FROM clientes_fiado');
    const resRecebidosCredito = await queryOne('SELECT SUM(valor) as total FROM pagamentos_fiado WHERE data >= ? AND data <= ?', [inicioDate, fimDate]);

    // 7. Evolução Temporal de Vendas por Dia (Unificada)
    const evolucaoMap = {};

    pedidos.forEach(p => {
      let diaStr = p.data;
      if (typeof diaStr === 'object' && diaStr instanceof Date) {
        diaStr = diaStr.toISOString().slice(0, 10);
      } else if (typeof diaStr === 'string') {
        diaStr = diaStr.slice(0, 10);
      }
      if (diaStr) {
        if (!evolucaoMap[diaStr]) evolucaoMap[diaStr] = { dia: diaStr, total: 0, qtd: 0 };
        evolucaoMap[diaStr].total += parseFloat(p.total || 0);
        evolucaoMap[diaStr].qtd += 1;
      }
    });

    vendasPdv.forEach(v => {
      let diaStr = v.data;
      if (typeof diaStr === 'object' && diaStr instanceof Date) {
        diaStr = diaStr.toISOString().slice(0, 10);
      } else if (typeof diaStr === 'string') {
        diaStr = diaStr.slice(0, 10);
      }
      if (diaStr) {
        if (!evolucaoMap[diaStr]) evolucaoMap[diaStr] = { dia: diaStr, total: 0, qtd: 0 };
        evolucaoMap[diaStr].total += parseFloat(v.total || 0);
        evolucaoMap[diaStr].qtd += 1;
      }
    });

    const evolucaoVendas = Object.values(evolucaoMap).sort((a, b) => a.dia.localeCompare(b.dia));

    // 8. Formas de Pagamento (Unificada)
    const pagMap = {};

    pedidos.forEach(p => {
      const pag = p.formaPagamento === 'fiado' ? 'a_prazo' : (p.formaPagamento || 'dinheiro');
      if (!pagMap[pag]) pagMap[pag] = { formaPagamento: pag, total: 0, qtd: 0 };
      pagMap[pag].total += parseFloat(p.total || 0);
      pagMap[pag].qtd += 1;
    });

    vendasPdv.forEach(v => {
      const pag = v.formaPagamento || 'dinheiro';
      if (!pagMap[pag]) pagMap[pag] = { formaPagamento: pag, total: 0, qtd: 0 };
      pagMap[pag].total += parseFloat(v.total || 0);
      pagMap[pag].qtd += 1;
    });

    const formasPagamentoList = Object.values(pagMap);

    // 9. Pedidos por Horário do Dia (Unificada)
    const horaMap = {};
    for (let h = 0; h < 24; h++) horaMap[h] = 0;

    [...pedidos, ...vendasPdv].forEach(item => {
      if (item.data) {
        const d = new Date(item.data);
        const hora = d.getHours();
        if (!isNaN(hora) && hora >= 0 && hora < 24) {
          horaMap[hora] += 1;
        }
      }
    });

    const pedidosPorHorario = Object.keys(horaMap).map(h => ({ hora: parseInt(h), qtd: horaMap[h] }));

    res.json({
      indicadores: {
        vendasHoje: parseFloat(vendasHoje.toFixed(2)),
        vendasPeriodo: parseFloat(vendasPeriodo.toFixed(2)),
        totalVendasGeral: parseFloat(totalVendasGeral.toFixed(2)),
        qtdPedidos,
        ticketMedio: parseFloat(ticketMedio.toFixed(2)),
        totalClientes: resClientesTotal?.total || 0,
        novosClientes: resClientesNovos?.total || 0,
        clientesRecorrentes: resClientesRecorrentes?.total || 0,
        pontosFidelidadeTotais: resPontosFidelidade?.total || 0,
        totalAgendamentos: resAgendamentosCount?.total || 0,
        taxaUtilizacaoAgendamentos: taxaUtilizacao,
        vendasCredito: parseFloat(vendasCredito.toFixed(2)),
        valoresPendentesCredito: parseFloat(resPendentesCredito?.total || 0),
        valoresRecebidosCredito: parseFloat(resRecebidosCredito?.total || 0)
      },
      statusPedidos: statusMap,
      topProdutos,
      menosProdutos,
      categoriasVendidas,
      evolucaoVendas,
      formasPagamento: formasPagamentoList,
      pedidosPorHorario
    });
  } catch (error) {
    console.error('Erro ao gerar relatórios analíticos:', error);
    res.status(500).json({ erro: 'Erro ao gerar dados analíticos' });
  }
});

module.exports = router;
