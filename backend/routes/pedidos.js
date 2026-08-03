const express = require('express');
const router = express.Router();
const { getDatabase, query, execute } = require('../database');

// GET todos os pedidos (admin) ou filtrar
router.get('/', async (req, res) => {
  try {
    const { nome, status, data } = req.query;
    let sql = 'SELECT * FROM pedidos WHERE 1=1';
    const params = [];

    if (nome) { sql += ' AND nomeCliente LIKE ?'; params.push(`%${nome}%`); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (data) { sql += ' AND DATE(data) = DATE(?)'; params.push(data); }

    sql += ' ORDER BY id DESC';

    const pedidos = await query(sql, params);
    for (const pedido of pedidos) {
      pedido.total = parseFloat(pedido.total);
      pedido.itens = await query('SELECT * FROM itens_pedido WHERE pedidoId = ?', [pedido.id]);
      pedido.itens.forEach(item => { item.precoUnitario = parseFloat(item.precoUnitario); });
    }
    res.json(pedidos);
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ erro: 'Erro ao listar pedidos' });
  }
});

// GET buscar pedido por nome do cliente (público)
router.get('/buscar/:nome', async (req, res) => {
  try {
    const pedidos = await query('SELECT * FROM pedidos WHERE nomeCliente = ? ORDER BY id DESC', [req.params.nome]);
    for (const pedido of pedidos) {
      pedido.total = parseFloat(pedido.total);
      pedido.itens = await query('SELECT * FROM itens_pedido WHERE pedidoId = ?', [pedido.id]);
      pedido.itens.forEach(item => { item.precoUnitario = parseFloat(item.precoUnitario); });
    }
    res.json(pedidos);
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

// POST criar pedido (público)
router.post('/', async (req, res) => {
  const { nomeCliente, turma, horarioRetirada, itens, total, clienteAppId, observacao } = req.body;
  if (!nomeCliente || !horarioRetirada || !itens || !itens.length || total === undefined) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const dataPedido = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [result] = await conn.execute(
      'INSERT INTO pedidos (clienteAppId, nomeCliente, turma, horarioRetirada, total, status, data, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [clienteAppId || null, nomeCliente, turma || '', horarioRetirada, parseFloat(total), 'pendente', dataPedido, observacao || null]
    );
    const pedidoId = result.insertId;
    for (const item of itens) {
      await conn.execute(
        'INSERT INTO itens_pedido (pedidoId, produtoId, nome, quantidade, precoUnitario) VALUES (?, ?, ?, ?, ?)',
        [pedidoId, item.produtoId, item.nome || '', item.quantidade, parseFloat(item.precoUnitario)]
      );
    }
    if (clienteAppId) {
      await conn.execute('UPDATE clientes_app SET totalPedidos = totalPedidos + 1 WHERE id = ?', [clienteAppId]);
    }
    await conn.commit();

    const novoPedido = { id: pedidoId, nomeCliente, turma, horarioRetirada, total: parseFloat(total), status: 'pendente', data: dataPedido, itens };

    // Emitir via socket.io se disponível
    const io = req.app.get('io');
    if (io) io.emit('novo_pedido', novoPedido);

    res.status(201).json(novoPedido);
  } catch (error) {
    await conn.rollback();
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ erro: 'Erro ao criar pedido' });
  } finally {
    conn.release();
  }
});

// PUT atualizar status do pedido (admin)
router.put('/:id/status', async (req, res) => {
  const { status } = req.body;
  const statusValidos = ['pendente', 'confirmado', 'preparando', 'pronto', 'entregue', 'recusado'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido' });
  }
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    const [pedidos] = await conn.execute('SELECT * FROM pedidos WHERE id = ?', [req.params.id]);
    if (pedidos.length === 0) return res.status(404).json({ erro: 'Pedido não encontrado' });
    const pedido = pedidos[0];

    await conn.beginTransaction();
    await conn.execute('UPDATE pedidos SET status = ? WHERE id = ?', [status, req.params.id]);

    // Se confirmado, dar baixa no estoque
    if (status === 'confirmado' && pedido.status !== 'confirmado') {
      const [itens] = await conn.execute('SELECT * FROM itens_pedido WHERE pedidoId = ?', [req.params.id]);
      for (const item of itens) {
        await conn.execute('UPDATE produtos SET estoque = estoque - ? WHERE id = ?', [item.quantidade, item.produtoId]);
      }
    }

    await conn.commit();

    const io = req.app.get('io');
    if (io) io.emit('status_pedido_atualizado', { id: parseInt(req.params.id), status });

    res.json({ sucesso: true });
  } catch (error) {
    await conn.rollback();
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ erro: 'Erro ao atualizar status' });
  } finally {
    conn.release();
  }
});

module.exports = router;
