const express = require('express');
const router = express.Router();
const { getDatabase, query, execute } = require('../database');

// GET todos os pedidos (admin) ou filtrar
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { nome, status, data, periodo } = req.query;

    let sql = 'SELECT * FROM pedidos WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM pedidos WHERE 1=1';
    const params = [];
    const countParams = [];

    if (nome) { 
      sql += ' AND nomeCliente LIKE ?'; 
      countSql += ' AND nomeCliente LIKE ?'; 
      params.push(`%${nome}%`); 
      countParams.push(`%${nome}%`); 
    }
    if (status) { 
      sql += ' AND status = ?'; 
      countSql += ' AND status = ?'; 
      params.push(status); 
      countParams.push(status); 
    }
    if (data) { 
      sql += ' AND DATE(data) = DATE(?)'; 
      countSql += ' AND DATE(data) = DATE(?)'; 
      params.push(data); 
      countParams.push(data); 
    } else if (periodo) {
      if (periodo === 'hoje') {
        sql += ' AND DATE(data) = CURDATE()';
        countSql += ' AND DATE(data) = CURDATE()';
      } else if (periodo === 'ontem') {
        sql += ' AND DATE(data) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
        countSql += ' AND DATE(data) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
      } else if (periodo === '7d') {
        sql += ' AND data >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        countSql += ' AND data >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
      }
    }

    sql += ` ORDER BY id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

    const pedidos = await query(sql, params);
    const totalRow = await query(countSql, countParams);
    const total = totalRow[0]?.total || 0;

    if (pedidos.length > 0) {
      const pIds = pedidos.map(p => p.id);
      const placeholders = pIds.map(() => '?').join(',');
      const todosItens = await query(`SELECT * FROM itens_pedido WHERE pedidoId IN (${placeholders})`, pIds);
      const itensPorPedido = {};
      for (const item of todosItens) {
        item.precoUnitario = parseFloat(item.precoUnitario);
        if (!itensPorPedido[item.pedidoId]) itensPorPedido[item.pedidoId] = [];
        itensPorPedido[item.pedidoId].push(item);
      }
      for (const pedido of pedidos) {
        pedido.total = parseFloat(pedido.total);
        pedido.subtotal = parseFloat(pedido.subtotal || pedido.total);
        pedido.desconto = parseFloat(pedido.desconto || 0);
        pedido.descontoPontos = parseFloat(pedido.descontoPontos || 0);
        pedido.pontosUsados = parseInt(pedido.pontosUsados || 0, 10);
        pedido.itens = itensPorPedido[pedido.id] || [];
      }
    }

    // Se a requisição pediu paginação explícita ou não
    if (req.query.paginado === 'true') {
      res.json({
        dados: pedidos,
        paginacao: {
          pagina: page,
          porPagina: limit,
          total,
          totalPaginas: Math.ceil(total / limit)
        }
      });
    } else {
      res.json(pedidos);
    }
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ erro: 'Erro ao listar pedidos' });
  }
});

// GET buscar pedido por nome do cliente (público)
router.get('/buscar/:nome', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const countSql = 'SELECT COUNT(*) as total FROM pedidos WHERE nomeCliente LIKE ?';
    const totalRow = await query(countSql, [`%${req.params.nome}%`]);
    const total = totalRow[0]?.total || 0;

    const pedidos = await query(`SELECT * FROM pedidos WHERE nomeCliente LIKE ? ORDER BY id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`, [`%${req.params.nome}%`]);
    if (pedidos.length > 0) {
      const pIds = pedidos.map(p => p.id);
      const placeholders = pIds.map(() => '?').join(',');
      const todosItens = await query(`SELECT * FROM itens_pedido WHERE pedidoId IN (${placeholders})`, pIds);
      const itensPorPedido = {};
      for (const item of todosItens) {
        item.precoUnitario = parseFloat(item.precoUnitario);
        if (!itensPorPedido[item.pedidoId]) itensPorPedido[item.pedidoId] = [];
        itensPorPedido[item.pedidoId].push(item);
      }
      for (const pedido of pedidos) {
        pedido.total = parseFloat(pedido.total);
        pedido.subtotal = parseFloat(pedido.subtotal || pedido.total);
        pedido.desconto = parseFloat(pedido.desconto || 0);
        pedido.descontoPontos = parseFloat(pedido.descontoPontos || 0);
        pedido.pontosUsados = parseInt(pedido.pontosUsados || 0, 10);
        pedido.itens = itensPorPedido[pedido.id] || [];
      }
    }
    
    res.json({
      dados: pedidos,
      paginacao: {
        pagina: page,
        porPagina: limit,
        total,
        totalPaginas: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

// POST criar pedido (público - aceita convidados e clientes logados)
router.post('/', async (req, res) => {
  const {
    nomeCliente, turma, mesa, formaPagamento, horarioRetirada, itens, total,
    subtotal, desconto, descontoPontos, pontosUsados, cupomCodigo, promocaoId,
    clienteAppId, observacao
  } = req.body;

  // Validações estritas
  if (!nomeCliente || typeof nomeCliente !== 'string' || nomeCliente.trim().length === 0) {
    return res.status(400).json({ erro: 'Nome do cliente é obrigatório e inválido' });
  }
  if (!horarioRetirada) {
    return res.status(400).json({ erro: 'Horário de retirada é obrigatório' });
  }
  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'O pedido deve conter pelo menos um item' });
  }
  if (total === undefined || parseFloat(total) < 0) {
    return res.status(400).json({ erro: 'Total do pedido inválido' });
  }

  const formasValidas = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'a_prazo', 'fiado', 'cartao'];
  const fp = (formaPagamento || 'dinheiro').toString().toLowerCase().trim();
  if (!formasValidas.includes(fp)) {
    return res.status(400).json({ erro: `Forma de pagamento inválida. Válidas: ${formasValidas.join(', ')}` });
  }

  const db = await getDatabase();
  const conn = await db.getConnection();

  try {
    // 1. Verificar Estoque
    for (const item of itens) {
      const [rows] = await conn.execute('SELECT nome, estoque FROM produtos WHERE id = ?', [item.produtoId]);
      if (rows.length === 0) {
        conn.release();
        return res.status(400).json({ erro: `Produto ID ${item.produtoId} não existe.` });
      }
      if (rows[0].estoque < item.quantidade) {
        conn.release();
        return res.status(400).json({ erro: `Estoque insuficiente para "${rows[0].nome}". Disponível: ${rows[0].estoque}` });
      }
    }

    // Identificar ID do cliente (se logado ou buscando por fone/nome)
    let finalClienteId = clienteAppId ? parseInt(clienteAppId, 10) : null;
    const telExtraido = observacao ? String(observacao).replace(/\D/g, '') : '';
    if (!finalClienteId) {
      if (telExtraido.length >= 8) {
        const [uByTel] = await conn.execute(
          'SELECT id FROM usuarios WHERE REPLACE(REPLACE(REPLACE(REPLACE(telefone, " ", ""), "-", ""), "(", ""), ")", "") LIKE ?',
          [`%${telExtraido.slice(-8)}%`]
        );
        if (uByTel.length > 0) finalClienteId = uByTel[0].id;
      }
      if (!finalClienteId) {
        const [uByName] = await conn.execute('SELECT id FROM usuarios WHERE LOWER(nome) = ?', [nomeCliente.trim().toLowerCase()]);
        if (uByName.length > 0) finalClienteId = uByName[0].id;
      }
    }

    // 2. Verificar Fiado / Venda a Prazo (se aplicável)
    if (fp === 'fiado' || fp === 'a_prazo') {
      if (!finalClienteId) {
        conn.release();
        return res.status(400).json({ erro: 'Para comprar a prazo / na conta, é necessário estar cadastrado e logado em sua conta de cliente.' });
      }

      // Verificar se fiado está ativo no sistema e no app
      const [cfgFiadoRows] = await conn.execute("SELECT chave, valor FROM configuracoes WHERE chave IN ('fiado_ativo', 'fiado_app_ativo')");
      const cfgFiado = {};
      cfgFiadoRows.forEach(r => { cfgFiado[r.chave] = r.valor; });
      if (cfgFiado.fiado_ativo === '0') {
        conn.release();
        return res.status(400).json({ erro: 'Vendas a prazo estão temporariamente desativadas na cantina.' });
      }
      if (cfgFiado.fiado_app_ativo === '0') {
        conn.release();
        return res.status(400).json({ erro: 'Pedidos a prazo pelo aplicativo estão desativados pela administração.' });
      }

      const [uRows] = await conn.execute('SELECT limiteCredito, saldoDevedor, nome FROM usuarios WHERE id = ?', [finalClienteId]);
      if (uRows.length === 0) {
        conn.release();
        return res.status(404).json({ erro: 'Cliente não encontrado no sistema.' });
      }
      const limite = parseFloat(uRows[0].limiteCredito !== null && uRows[0].limiteCredito !== undefined ? uRows[0].limiteCredito : 0);
      const saldo = parseFloat(uRows[0].saldoDevedor || 0.00);
      if (limite <= 0) {
        conn.release();
        return res.status(400).json({
          erro: `Sua conta não possui limite de crédito a prazo autorizado (Limite: R$ 0,00). Solicite a liberação com a administração da cantina.`
        });
      }
      if (saldo + parseFloat(total) > limite) {
        const disponivel = Math.max(0, limite - saldo);
        conn.release();
        return res.status(400).json({
          erro: `Limite de crédito insuficiente! Limite autorizado: R$ ${limite.toFixed(2)}, Débito atual: R$ ${saldo.toFixed(2)}, Disponível: R$ ${disponivel.toFixed(2)}. Total do pedido: R$ ${parseFloat(total).toFixed(2)}.`
        });
      }
    }

    // 3. Obter configurações de fidelidade da cantina
    const [cfgRows] = await conn.execute(
      "SELECT chave, valor FROM configuracoes WHERE chave IN ('fidelidade_ativa', 'fidelidade_resgate_min', 'fidelidade_valor_ponto', 'fidelidade_pedido_minimo')"
    );
    const cfgMap = {};
    cfgRows.forEach(r => { cfgMap[r.chave] = r.valor; });
    const fidelidadeAtiva = cfgMap.fidelidade_ativa !== '0';
    const fidelidadeResgateMin = parseInt(cfgMap.fidelidade_resgate_min || 50, 10);
    const fidelidadeValorPonto = parseFloat(cfgMap.fidelidade_valor_ponto || 0.10);

    await conn.beginTransaction();
    const dataPedido = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const ptsRedeem = parseInt(pontosUsados || 0, 10);

    // Validação e Resgate de pontos
    if (ptsRedeem > 0) {
      if (!fidelidadeAtiva) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ erro: 'O programa de pontos de fidelidade está temporariamente desativado nesta cantina.' });
      }
      if (!finalClienteId) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ erro: 'É necessário estar autenticado para utilizar pontos de fidelidade.' });
      }
      if (ptsRedeem < fidelidadeResgateMin) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ erro: `Mínimo de ${fidelidadeResgateMin} pontos necessários para efetuar o resgate.` });
      }

      const [uPts] = await conn.execute('SELECT pontosFidelidade FROM usuarios WHERE id = ?', [finalClienteId]);
      const saldoPts = parseInt(uPts[0]?.pontosFidelidade || 0, 10);
      if (saldoPts < ptsRedeem) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ erro: `Saldo de pontos insuficiente para resgate. Você tem ${saldoPts} pts.` });
      }
      await conn.execute('UPDATE usuarios SET pontosFidelidade = GREATEST(0, pontosFidelidade - ?) WHERE id = ?', [ptsRedeem, finalClienteId]);
    }

    // Incrementar contagem de usos do cupom / promoção (se houver)
    let finalPromocaoId = promocaoId ? parseInt(promocaoId, 10) : null;
    if (cupomCodigo && !finalPromocaoId) {
      const [pRow] = await conn.execute('SELECT id FROM promocoes WHERE UPPER(codigo) = UPPER(?) LIMIT 1', [cupomCodigo]);
      if (pRow.length > 0) finalPromocaoId = pRow[0].id;
    }
    if (finalPromocaoId) {
      await conn.execute('UPDATE promocoes SET usos_atuais = usos_atuais + 1 WHERE id = ?', [finalPromocaoId]);
    }

    const subtotalCalc = parseFloat(subtotal || itens.reduce((s, i) => s + (i.quantidade * parseFloat(i.precoUnitario)), 0));
    const descPromoCalc = parseFloat(desconto || 0);
    const descPontosCalc = parseFloat(descontoPontos || (ptsRedeem * fidelidadeValorPonto));
    const totalCalc = Math.max(0, parseFloat(total));

    const obsFinal = observacao ? (ptsRedeem > 0 ? `${observacao} | Resgatou ${ptsRedeem} pts de fidelidade` : observacao) : (ptsRedeem > 0 ? `Resgatou ${ptsRedeem} pts de fidelidade` : null);

    const [result] = await conn.execute(
      `INSERT INTO pedidos (
        clienteAppId, nomeCliente, turma, mesa, formaPagamento, horarioRetirada,
        subtotal, desconto, descontoPontos, pontosUsados, cupomCodigo, promocaoId,
        total, status, data, observacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)`,
      [
        finalClienteId || null, nomeCliente.trim(), turma || '', mesa || null, fp, horarioRetirada,
        subtotalCalc, descPromoCalc, descPontosCalc, ptsRedeem, cupomCodigo || null, finalPromocaoId,
        totalCalc, dataPedido, obsFinal
      ]
    );
    const pedidoId = result.insertId;

    if (ptsRedeem > 0 && finalClienteId) {
      await conn.execute(
        'INSERT INTO historico_fidelidade (clienteId, pedidoId, pontos, tipo, descricao, data) VALUES (?, ?, ?, "resgate", ?, ?)',
        [finalClienteId, pedidoId, -ptsRedeem, `Resgate de ${ptsRedeem} pts no Pedido #${pedidoId}`, dataPedido]
      );
    }

    for (const item of itens) {
      await conn.execute(
        'INSERT INTO itens_pedido (pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (?, ?, ?, ?, ?)',
        [pedidoId, item.produtoId, item.nome || '', item.quantidade, parseFloat(item.precoUnitario)]
      );
      await conn.execute('UPDATE produtos SET estoque = GREATEST(0, estoque - ?) WHERE id = ?', [item.quantidade, item.produtoId]);
    }

    // Inserir log inicial do pedido
    await conn.execute(
      'INSERT INTO pedidos_status_log (pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (?, "nenhum", "pendente", "Cliente / App", ?)',
      [pedidoId, dataPedido]
    );

    // Se a forma de pagamento for fiado / a prazo, registrar dívida e sincronizar venda
    if ((fp === 'fiado' || fp === 'a_prazo') && finalClienteId) {
      const [resDivida] = await conn.execute(
        'INSERT INTO dividas (clienteId, data, total, valorPago, pago) VALUES (?, ?, ?, 0, 0)',
        [finalClienteId, dataPedido, totalCalc]
      );
      const dividaId = resDivida.insertId;
      for (const item of itens) {
        await conn.execute(
          'INSERT INTO itens_divida (dividaId, produtoId, quantidade, precoUnitario) VALUES (?, ?, ?, ?)',
          [dividaId, item.produtoId, item.quantidade, parseFloat(item.precoUnitario)]
        );
      }
      await conn.execute('UPDATE usuarios SET saldoDevedor = saldoDevedor + ? WHERE id = ?', [totalCalc, finalClienteId]);

      const [resVenda] = await conn.execute(
        'INSERT INTO vendas (total, formaPagamento, data) VALUES (?, ?, ?)',
        [totalCalc, 'a_prazo', dataPedido]
      );
      for (const item of itens) {
        await conn.execute(
          'INSERT INTO itens_venda (vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (?, ?, ?, ?, ?)',
          [resVenda.insertId, item.produtoId, item.nome || '', item.quantidade, parseFloat(item.precoUnitario)]
        );
      }
    }

    await conn.commit();

    const novoPedido = {
      id: pedidoId,
      clienteAppId: finalClienteId,
      nomeCliente: nomeCliente.trim(),
      turma,
      mesa,
      formaPagamento: fp,
      horarioRetirada,
      total: parseFloat(total),
      status: 'pendente',
      data: dataPedido,
      itens
    };

    // Emitir via socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('novo_pedido', novoPedido);
      if (finalClienteId) {
        const [usrRow] = await query('SELECT pontosFidelidade FROM usuarios WHERE id = ?', [finalClienteId]);
        if (usrRow) io.emit('fidelidade_atualizada', { clienteId: finalClienteId, pontos: usrRow.pontosFidelidade });
      }
    }

    res.status(201).json(novoPedido);
  } catch (error) {
    await conn.rollback();
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ erro: 'Erro ao criar pedido' });
  } finally {
    conn.release();
  }
});

// GET histórico de alterações de status de um pedido
router.get('/:id/historico', async (req, res) => {
  try {
    const logs = await query('SELECT * FROM pedidos_status_log WHERE pedidoId = ? ORDER BY id ASC', [req.params.id]);
    res.json(logs);
  } catch (error) {
    console.error('Erro ao buscar histórico de status:', error);
    res.status(500).json({ erro: 'Erro ao buscar histórico de status' });
  }
});

// PUT atualizar status do pedido (admin)
router.put('/:id/status', async (req, res) => {
  const { status, responsavel } = req.body;
  const statusValidos = ['pendente', 'confirmado', 'preparando', 'pronto', 'entregue', 'cancelado', 'recusado'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido' });
  }
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    const [pedidos] = await conn.execute('SELECT * FROM pedidos WHERE id = ?', [req.params.id]);
    if (pedidos.length === 0) {
      conn.release();
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }
    const pedido = pedidos[0];
    const statusAnterior = pedido.status;

    if (statusAnterior === status) {
      conn.release();
      return res.json({ sucesso: true, mensagem: 'Status inalterado' });
    }

    await conn.beginTransaction();
    await conn.execute('UPDATE pedidos SET status = ? WHERE id = ?', [status, req.params.id]);

    // Registrar log de auditoria de status
    const dataHoraLog = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await conn.execute(
      'INSERT INTO pedidos_status_log (pedidoId, statusAnterior, statusNovo, responsavel, dataHora) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, statusAnterior, status, responsavel || 'Administrador', dataHoraLog]
    );

    // Se o pedido foi cancelado/recusado (e antes não estava), devolver estoque
    if ((status === 'cancelado' || status === 'recusado') && statusAnterior !== 'cancelado' && statusAnterior !== 'recusado') {
      const [itens] = await conn.execute('SELECT * FROM itens_pedido WHERE pedidoId = ?', [req.params.id]);
      for (const item of itens) {
        await conn.execute('UPDATE produtos SET estoque = estoque + ? WHERE id = ?', [item.quantidade, item.produtoId]);
      }
    }

    // Se passou para entregue ou confirmado (e antes não estava), registrar em vendas
    if ((status === 'entregue' || status === 'confirmado') && statusAnterior !== 'entregue' && statusAnterior !== 'confirmado') {
      const [itens] = await conn.execute('SELECT * FROM itens_pedido WHERE pedidoId = ?', [req.params.id]);

      // Inserir registro na tabela vendas para contabilização centralizada de caixa
      let dataVenda = pedido.data;
      if (typeof dataVenda === 'object' && dataVenda instanceof Date) {
        const y = dataVenda.getFullYear();
        const m = String(dataVenda.getMonth() + 1).padStart(2, '0');
        const day = String(dataVenda.getDate()).padStart(2, '0');
        const h = String(dataVenda.getHours()).padStart(2, '0');
        const min = String(dataVenda.getMinutes()).padStart(2, '0');
        const s = String(dataVenda.getSeconds()).padStart(2, '0');
        dataVenda = `${y}-${m}-${day} ${h}:${min}:${s}`;
      }
      const formaPag = pedido.formaPagamento === 'fiado' ? 'a_prazo' : (pedido.formaPagamento || 'dinheiro');
      const [resultVenda] = await conn.execute(
        'INSERT INTO vendas (total, formaPagamento, data, pedidoId) VALUES (?, ?, ?, ?)',
        [parseFloat(pedido.total), formaPag, dataVenda, pedido.id]
      );
      for (const item of itens) {
        await conn.execute(
          'INSERT INTO itens_venda (vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (?, ?, ?, ?, ?)',
          [resultVenda.insertId, item.produtoId, item.nome || '', item.quantidade, parseFloat(item.precoUnitario)]
        );
      }
    }

    // Se o pedido for entregue ou confirmado e houver um clienteAppId, atribuir pontos de fidelidade
    if ((status === 'entregue' || status === 'confirmado') && statusAnterior !== 'entregue' && statusAnterior !== 'confirmado' && pedido.clienteAppId) {
      // Verificar se o programa de fidelidade está ativo na cantina
      const [cfgRows] = await conn.execute("SELECT chave, valor FROM configuracoes WHERE chave IN ('fidelidade_ativa', 'fidelidade_taxa')");
      const cfg = {};
      cfgRows.forEach(r => { cfg[r.chave] = r.valor; });
      const fidelidadeAtiva = cfg.fidelidade_ativa !== '0';

      if (fidelidadeAtiva) {
        // Verificar se pontos já foram concedidos para este pedidoId
        const [historicoExistente] = await conn.execute('SELECT id FROM historico_fidelidade WHERE pedidoId = ? AND tipo = "ganho"', [pedido.id]);
        if (historicoExistente.length === 0) {
          const valorTotal = parseFloat(pedido.total || 0);
          const taxa = parseFloat(cfg.fidelidade_taxa || 10);
          let multiplicador = 1;

          // Verificar promoções de pontos em dobro ativas para hoje
          try {
            const diaSemanaHoje = new Date().getDay(); // 0: Dom, 1: Seg, 3: Qua, etc.
            const [promosDobro] = await conn.execute("SELECT regras_json, valor FROM promocoes WHERE ativa = 1 AND tipo = 'pontos_dobro'");
            for (const pr of promosDobro) {
              let regras = {};
              try { regras = typeof pr.regras_json === 'string' ? JSON.parse(pr.regras_json) : (pr.regras_json || {}); } catch(e) {}
              if (!regras.dias_semana || (Array.isArray(regras.dias_semana) && regras.dias_semana.includes(diaSemanaHoje))) {
                multiplicador = parseFloat(pr.valor || 2);
                break;
              }
            }
          } catch (promoErr) {
            console.warn('Aviso verificação promo dobro:', promoErr.message);
          }

          let pontosBase = Math.max(1, Math.round(valorTotal * (taxa / 100)));
          const pontosGanhos = Math.round(pontosBase * multiplicador);

          await conn.execute(
            'UPDATE usuarios SET pontosFidelidade = pontosFidelidade + ?, totalPedidos = totalPedidos + 1 WHERE id = ?',
            [pontosGanhos, pedido.clienteAppId]
          );
          const dataAgora = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const descHist = multiplicador > 1
            ? `Pontos do Pedido #${pedido.id} (${taxa}% + ${multiplicador}x Pontos em Dobro: R$ ${valorTotal.toFixed(2)})`
            : `Pontos do Pedido #${pedido.id} (${taxa}% do valor: R$ ${valorTotal.toFixed(2)})`;

          await conn.execute(
            'INSERT INTO historico_fidelidade (clienteId, pedidoId, pontos, tipo, descricao, data) VALUES (?, ?, ?, "ganho", ?, ?)',
            [pedido.clienteAppId, pedido.id, pontosGanhos, descHist, dataAgora]
          );

          const [usrRow] = await conn.execute('SELECT pontosFidelidade FROM usuarios WHERE id = ?', [pedido.clienteAppId]);
          if (usrRow.length > 0) {
            const io = req.app.get('io');
            if (io) io.emit('fidelidade_atualizada', { clienteId: pedido.clienteAppId, pontos: usrRow[0].pontosFidelidade });
          }
        }
      }
    }

    // Se o pedido entregue/confirmado for cancelado/recusado, efetuar estorno dos pontos
    if ((status === 'cancelado' || status === 'recusado') && (statusAnterior === 'entregue' || statusAnterior === 'confirmado') && pedido.clienteAppId) {
      const [historicoGanho] = await conn.execute('SELECT pontos FROM historico_fidelidade WHERE pedidoId = ? AND tipo = "ganho"', [pedido.id]);
      if (historicoGanho.length > 0) {
        const pontosParaEstornar = historicoGanho[0].pontos;
        await conn.execute(
          'UPDATE usuarios SET pontosFidelidade = GREATEST(0, pontosFidelidade - ?) WHERE id = ?',
          [pontosParaEstornar, pedido.clienteAppId]
        );
        const dataAgora = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await conn.execute(
          'INSERT INTO historico_fidelidade (clienteId, pedidoId, pontos, tipo, descricao, data) VALUES (?, ?, ?, "estorno", ?, ?)',
          [pedido.clienteAppId, pedido.id, -pontosParaEstornar, `Estorno por cancelamento do Pedido #${pedido.id}`, dataAgora]
        );

        const [usrRow] = await conn.execute('SELECT pontosFidelidade FROM usuarios WHERE id = ?', [pedido.clienteAppId]);
        if (usrRow.length > 0) {
          const io = req.app.get('io');
          if (io) io.emit('fidelidade_atualizada', { clienteId: pedido.clienteAppId, pontos: usrRow[0].pontosFidelidade });
        }
      }
    }

    await conn.commit();

    const io = req.app.get('io');
    if (io) io.emit('status_pedido_atualizado', { id: parseInt(req.params.id), status, statusAnterior });

    res.json({ sucesso: true, statusAnterior, statusNovo: status });
  } catch (error) {
    await conn.rollback();
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ erro: 'Erro ao atualizar status' });
  } finally {
    conn.release();
  }
});

module.exports = router;
