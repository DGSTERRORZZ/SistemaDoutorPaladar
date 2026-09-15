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

    for (const pedido of pedidos) {
      pedido.total = parseFloat(pedido.total);
      pedido.itens = await query('SELECT * FROM itens_pedido WHERE pedidoId = ?', [pedido.id]);
      pedido.itens.forEach(item => { item.precoUnitario = parseFloat(item.precoUnitario); });
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
    for (const pedido of pedidos) {
      pedido.total = parseFloat(pedido.total);
      pedido.itens = await query('SELECT * FROM itens_pedido WHERE pedidoId = ?', [pedido.id]);
      pedido.itens.forEach(item => { item.precoUnitario = parseFloat(item.precoUnitario); });
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
  const { nomeCliente, turma, mesa, formaPagamento, horarioRetirada, itens, total, clienteAppId, observacao, pontosUsados, descontoPontos } = req.body;

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
  if (total === undefined || parseFloat(total) <= 0) {
    return res.status(400).json({ erro: 'Total do pedido inválido' });
  }

  const formasValidas = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'a_prazo', 'fiado', 'cartao'];
  const fp = formaPagamento || 'dinheiro';
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

    // 2. Verificar Fiado (se aplicável)
    if (fp === 'fiado' || fp === 'a_prazo') {
      if (finalClienteId) {
        const [uRows] = await conn.execute('SELECT limiteCredito, saldoDevedor FROM usuarios WHERE id = ?', [finalClienteId]);
        if (uRows.length > 0) {
          const limite = parseFloat(uRows[0].limiteCredito || 50.00);
          const saldo = parseFloat(uRows[0].saldoDevedor || 0.00);
          if (saldo + parseFloat(total) > limite) {
            conn.release();
            return res.status(400).json({
              erro: `Limite de fiado excedido! Limite: R$ ${limite.toFixed(2)}, Saldo Devedor Atual: R$ ${saldo.toFixed(2)}.`
            });
          }
        }
      }
    }

    await conn.beginTransaction();
    const dataPedido = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const ptsRedeem = parseInt(pontosUsados || 0, 10);

    // Resgate de pontos (se o cliente solicitou no checkout)
    if (ptsRedeem > 0 && finalClienteId) {
      const [uPts] = await conn.execute('SELECT pontosFidelidade FROM usuarios WHERE id = ?', [finalClienteId]);
      const saldoPts = parseInt(uPts[0]?.pontosFidelidade || 0, 10);
      if (saldoPts < ptsRedeem) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ erro: `Saldo de pontos insuficiente para resgate. Você tem ${saldoPts} pts.` });
      }
      await conn.execute('UPDATE usuarios SET pontosFidelidade = pontosFidelidade - ? WHERE id = ?', [ptsRedeem, finalClienteId]);
    }

    const obsFinal = observacao ? (ptsRedeem > 0 ? `${observacao} | Resgatou ${ptsRedeem} pts de fidelidade` : observacao) : (ptsRedeem > 0 ? `Resgatou ${ptsRedeem} pts de fidelidade` : null);

    const [result] = await conn.execute(
      'INSERT INTO pedidos (clienteAppId, nomeCliente, turma, mesa, formaPagamento, horarioRetirada, total, status, data, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [finalClienteId || null, nomeCliente.trim(), turma || '', mesa || null, fp, horarioRetirada, parseFloat(total), 'pendente', dataPedido, obsFinal]
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

    // Se o pedido for entregue ou confirmado e houver um clienteAppId, atribuir pontos de fidelidade reais
    if ((status === 'entregue' || status === 'confirmado') && statusAnterior !== 'entregue' && statusAnterior !== 'confirmado' && pedido.clienteAppId) {
      // Verificar se pontos já foram concedidos para este pedidoId
      const [historicoExistente] = await conn.execute('SELECT id FROM historico_fidelidade WHERE pedidoId = ? AND tipo = "ganho"', [pedido.id]);
      if (historicoExistente.length === 0) {
        const valorTotal = parseFloat(pedido.total || 0);
        // Regra de Fidelidade: 10% do dinheiro gasto convertido em pontos
        const pontosGanhos = Math.max(1, Math.round(valorTotal * 0.10));
        await conn.execute(
          'UPDATE usuarios SET pontosFidelidade = pontosFidelidade + ?, totalPedidos = totalPedidos + 1 WHERE id = ?',
          [pontosGanhos, pedido.clienteAppId]
        );
        const dataAgora = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await conn.execute(
          'INSERT INTO historico_fidelidade (clienteId, pedidoId, pontos, tipo, descricao, data) VALUES (?, ?, ?, "ganho", ?, ?)',
          [pedido.clienteAppId, pedido.id, pontosGanhos, `Pontos do Pedido #${pedido.id} (10% do valor: R$ ${valorTotal.toFixed(2)})`, dataAgora]
        );

        const [usrRow] = await conn.execute('SELECT pontosFidelidade FROM usuarios WHERE id = ?', [pedido.clienteAppId]);
        if (usrRow.length > 0) {
          const io = req.app.get('io');
          if (io) io.emit('fidelidade_atualizada', { clienteId: pedido.clienteAppId, pontos: usrRow[0].pontosFidelidade });
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
