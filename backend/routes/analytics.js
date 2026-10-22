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
    const resClientesTotal = await queryOne("SELECT COUNT(*) as total FROM usuarios WHERE tipo != 'administrador'");
    const resClientesNovos = await queryOne("SELECT COUNT(*) as total FROM usuarios WHERE tipo != 'administrador' AND dataCadastro >= ? AND dataCadastro <= ?", [inicioDate, fimDate]);
    const resClientesRecorrentes = await queryOne("SELECT COUNT(*) as total FROM usuarios WHERE tipo != 'administrador' AND totalPedidos > 1");
    const resPontosFidelidade = await queryOne("SELECT SUM(pontosFidelidade) as total FROM usuarios WHERE tipo != 'administrador'");

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

// GET /api/analytics/relatorios-detalhados - Retorna os 10+ relatórios consolidados em dados reais
router.get('/relatorios-detalhados', verifyAdmin, async (req, res) => {
  try {
    // 1. Relatório Faturamento Consolidado por Mês
    const relFaturamentoMensal = await query(`
      SELECT 
        DATE_FORMAT(data, '%Y-%m') as mes,
        COUNT(*) as total_transacoes,
        SUM(total) as faturamento_total,
        AVG(total) as ticket_medio
      FROM (
        SELECT data, total FROM pedidos WHERE status NOT IN ('cancelado', 'recusado')
        UNION ALL
        SELECT data, total FROM vendas WHERE pedidoId IS NULL OR pedidoId = 0
      ) as todas_vendas
      GROUP BY DATE_FORMAT(data, '%Y-%m')
      ORDER BY mes DESC
      LIMIT 12
    `);

    // 2. Relatório de Produtos Mais Vendidos (Curva ABC)
    const relTopProdutos = await query(`
      SELECT 
        p.id, p.nome, p.categoria, p.preco,
        COALESCE(SUM(unificado.qtd), 0) as total_quantidade,
        COALESCE(SUM(unificado.qtd * unificado.precoUnitario), 0) as receita_gerada
      FROM produtos p
      JOIN (
        SELECT produtoId, quantidade as qtd, precoUnitario FROM itens_venda
        UNION ALL
        SELECT produtoId, quantidade as qtd, precoUnitario FROM itens_pedido
      ) as unificado ON unificado.produtoId = p.id
      GROUP BY p.id, p.nome, p.categoria, p.preco
      ORDER BY total_quantidade DESC
      LIMIT 15
    `);

    // 3. Relatório por Categoria de Produtos
    const relCategorias = await query(`
      SELECT 
        p.categoria,
        COUNT(DISTINCT p.id) as total_produtos,
        COALESCE(SUM(unificado.qtd), 0) as total_itens_vendidos,
        COALESCE(SUM(unificado.qtd * unificado.precoUnitario), 0) as receita_total
      FROM produtos p
      LEFT JOIN (
        SELECT produtoId, quantidade as qtd, precoUnitario FROM itens_venda
        UNION ALL
        SELECT produtoId, quantidade as qtd, precoUnitario FROM itens_pedido
      ) as unificado ON unificado.produtoId = p.id
      GROUP BY p.categoria
      ORDER BY receita_total DESC
    `);

    // 4. Relatório de Formas de Pagamento
    const relFormasPagamento = await query(`
      SELECT 
        CASE 
          WHEN LOWER(formaPagamento) LIKE '%pix%' THEN 'PIX'
          WHEN LOWER(formaPagamento) LIKE '%cart%' THEN 'Cartão'
          WHEN LOWER(formaPagamento) LIKE '%dinheiro%' THEN 'Dinheiro'
          WHEN LOWER(formaPagamento) LIKE '%fiado%' OR LOWER(formaPagamento) = 'a_prazo' THEN 'Venda a Prazo (Crédito)'
          ELSE 'Outros'
        END as forma,
        COUNT(*) as transacoes,
        SUM(total) as volume_total
      FROM (
        SELECT formaPagamento, total FROM pedidos WHERE status NOT IN ('cancelado', 'recusado')
        UNION ALL
        SELECT formaPagamento, total FROM vendas WHERE pedidoId IS NULL OR pedidoId = 0
      ) as pagamentos
      GROUP BY forma
      ORDER BY volume_total DESC
    `);

    // 5. Relatório de Horários de Pico
    const relHorariosPico = await query(`
      SELECT 
        HOUR(data) as hora,
        COUNT(*) as quantidade_pedidos,
        SUM(total) as faturamento
      FROM (
        SELECT data, total FROM pedidos WHERE status NOT IN ('cancelado', 'recusado')
        UNION ALL
        SELECT data, total FROM vendas WHERE pedidoId IS NULL OR pedidoId = 0
      ) as horarios
      GROUP BY HOUR(data)
      ORDER BY hora ASC
    `);

    // 6. Relatório de Fiado / Contas a Receber por Cliente
    const relFiadoClientes = await query(`
      SELECT 
        u.id, u.nome, u.turma, u.telefone,
        u.limiteCredito as limite,
        u.saldoDevedor,
        COALESCE(u.bloqueado, 0) as bloqueado,
        COUNT(d.id) as dividas_em_aberto
      FROM usuarios u
      LEFT JOIN dividas d ON d.clienteId = u.id AND d.pago = 0
      WHERE u.saldoDevedor > 0 OR u.bloqueado = 1
      GROUP BY u.id, u.nome, u.turma, u.telefone, u.limiteCredito, u.saldoDevedor, u.bloqueado
      ORDER BY u.saldoDevedor DESC
    `);

    // 7. Relatório de Estoque e Posição Crítica
    const relEstoqueCritico = await query(`
      SELECT 
        p.id, p.nome, p.categoria, p.preco, p.estoque, p.estoqueMinimo, p.ativo,
        (p.estoque * p.preco) as valor_patrimonial,
        CASE 
          WHEN p.estoque = 0 THEN 'Esgotado'
          WHEN p.estoque <= p.estoqueMinimo THEN 'Abaixo do Mínimo'
          ELSE 'Estoque Regular'
        END as status_estoque
      FROM produtos p
      ORDER BY p.estoque ASC, p.nome ASC
    `);

    // 8. Relatório DRE Simplificado: Faturamento vs Despesas (Lucro Líquido Real)
    const relDre = await query(`
      SELECT 
        DATE_FORMAT(v.data, '%Y-%m') as mes,
        COALESCE(SUM(v.total), 0) as receitas,
        COALESCE((
          SELECT SUM(d.valor) 
          FROM despesas d 
          WHERE DATE_FORMAT(d.data, '%Y-%m') = DATE_FORMAT(v.data, '%Y-%m')
        ), 0) as despesas,
        (
          COALESCE(SUM(v.total), 0) - COALESCE((
            SELECT SUM(d.valor) 
            FROM despesas d 
            WHERE DATE_FORMAT(d.data, '%Y-%m') = DATE_FORMAT(v.data, '%Y-%m')
          ), 0)
        ) as resultado_liquido
      FROM (
        SELECT data, total FROM pedidos WHERE status NOT IN ('cancelado', 'recusado')
        UNION ALL
        SELECT data, total FROM vendas WHERE pedidoId IS NULL OR pedidoId = 0
      ) as v
      GROUP BY DATE_FORMAT(v.data, '%Y-%m')
      ORDER BY mes DESC
      LIMIT 6
    `);

    // 9. Relatório de Fornecedores e Despesas por Categoria
    const relDespesasFornecedores = await query(`
      SELECT 
        categoria,
        COUNT(*) as total_lancamentos,
        SUM(valor) as total_despesas
      FROM despesas
      GROUP BY categoria
      ORDER BY total_despesas DESC
    `);

    // 10. Relatório de Fidelidade e Engajamento
    const relFidelidade = await query(`
      SELECT 
        u.id, u.nome, u.turma, u.pontosFidelidade, u.totalPedidos,
        COALESCE(SUM(p.total), 0) as total_gasto_vida
      FROM usuarios u
      LEFT JOIN pedidos p ON p.clienteAppId = u.id AND p.status = 'entregue'
      WHERE u.tipo = 'cliente'
      GROUP BY u.id, u.nome, u.turma, u.pontosFidelidade, u.totalPedidos
      ORDER BY u.pontosFidelidade DESC, total_gasto_vida DESC
      LIMIT 20
    `);

    // 11. Relatório de Agendamento e Refeições
    const relAgendamentosOcupacao = await query(`
      SELECT 
        a.id, a.data, a.horario, a.pratoDoDia, a.vagasTotais, a.vagasOcupadas,
        ROUND((a.vagasOcupadas / GREATEST(1, a.vagasTotais)) * 100, 1) as taxa_ocupacao_pct,
        (a.vagasOcupadas * a.preco) as receita_estimada
      FROM agendamentos a
      ORDER BY a.data DESC, a.horario ASC
      LIMIT 15
    `);

    res.json({
      sucesso: true,
      relatorios: {
        faturamentoMensal: relFaturamentoMensal,
        topProdutos: relTopProdutos,
        categorias: relCategorias,
        formasPagamento: relFormasPagamento,
        horariosPico: relHorariosPico,
        fiadoClientes: relFiadoClientes,
        estoqueCritico: relEstoqueCritico,
        dreLucroLiquido: relDre,
        despesasCategorias: relDespesasFornecedores,
        fidelidadeEngajamento: relFidelidade,
        agendamentosOcupacao: relAgendamentosOcupacao
      }
    });
  } catch (error) {
    console.error('Erro ao buscar relatórios detalhados:', error);
    res.status(500).json({ erro: 'Erro ao gerar relatórios detalhados' });
  }
});

module.exports = router;
