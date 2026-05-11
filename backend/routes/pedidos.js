const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

// GET todos os pedidos (admin) ou filtrar por nome (cliente)
router.get('/', (req, res) => {
  const { nome, status, data } = req.query;
  let query = 'SELECT * FROM pedidos WHERE 1=1';
  const params = [];

  if (nome) { query += ' AND nomeCliente LIKE ?'; params.push(`%${nome}%`); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (data) { query += ' AND date(data) = date(?)'; params.push(data); }

  query += ' ORDER BY id DESC';

  const stmt = req.db.prepare(query);
  stmt.bind(params);
  
  const pedidos = [];
  while (stmt.step()) {
    const pedido = stmt.getAsObject();
    const stmtItens = req.db.prepare('SELECT * FROM itens_pedido WHERE pedidoId = ?');
    stmtItens.bind([pedido.id]);
    const itens = [];
    while (stmtItens.step()) itens.push(stmtItens.getAsObject());
    stmtItens.free();
    pedidos.push({ ...pedido, itens });
  }
  stmt.free();
  res.json(pedidos);
});

// POST criar pedido (público)
router.post('/', (req, res) => {
  const { nomeCliente, turma, horarioRetirada, itens, total } = req.body;

  // Validações
  if (!nomeCliente || nomeCliente.trim().length < 3) {
    return res.status(400).json({ erro: 'Nome do cliente é obrigatório (mínimo 3 caracteres)' });
  }
  if (!horarioRetirada) {
    return res.status(400).json({ erro: 'Horário de retirada é obrigatório' });
  }
  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Adicione pelo menos um item ao pedido' });
  }
  if (!total || total <= 0) {
    return res.status(400).json({ erro: 'Total do pedido inválido' });
  }

  // Validar se o horário existe e não está bloqueado
  const agendamento = req.db.prepare('SELECT * FROM agendamentos WHERE horarioInicio = ?').get(horarioRetirada);
  if (!agendamento) {
    return res.status(400).json({ erro: 'Horário de retirada inválido' });
  }

  req.db.run('INSERT INTO pedidos (nomeCliente, turma, horarioRetirada, total, status, data) VALUES (?, ?, ?, ?, ?, ?)',
    [nomeCliente.trim(), turma || '', horarioRetirada, total, 'pendente', new Date().toISOString()]);
  
  const pedidoId = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];

  const insertItem = req.db.prepare('INSERT INTO itens_pedido (pedidoId, produtoId, quantidade, precoUnitario) VALUES (?, ?, ?, ?)');
  for (const item of itens) {
    insertItem.run([pedidoId, item.produtoId, item.quantidade, item.precoUnitario]);
  }
  insertItem.free();

  res.status(201).json({ id: pedidoId, nomeCliente, status: 'pendente' });
});

// PUT atualizar status do pedido (admin)
router.put('/:id/status', (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ erro: 'Status é obrigatório' });
  }

  const statusValidos = ['pendente', 'confirmado', 'preparando', 'pronto', 'entregue', 'recusado'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${statusValidos.join(', ')}` });
  }

  const stmt = req.db.prepare('SELECT * FROM pedidos WHERE id = ?');
  stmt.bind([req.params.id]);
  let pedido;
  if (stmt.step()) pedido = stmt.getAsObject();
  stmt.free();

  if (!pedido) {
    return res.status(404).json({ erro: 'Pedido não encontrado' });
  }

  // Não permitir mudar status de pedidos já entregues ou recusados
  if (pedido.status === 'entregue' || pedido.status === 'recusado') {
    return res.status(400).json({ erro: `Pedido já está ${pedido.status}. Não pode ser alterado.` });
  }

  req.db.run('UPDATE pedidos SET status = ? WHERE id = ?', [status, req.params.id]);

  // Se CONFIRMADO → deduzir estoque
  if (status === 'confirmado' && pedido.status !== 'confirmado') {
    const stmtItens = req.db.prepare('SELECT * FROM itens_pedido WHERE pedidoId = ?');
    stmtItens.bind([req.params.id]);
    const itens = [];
    while (stmtItens.step()) itens.push(stmtItens.getAsObject());
    stmtItens.free();

    const atualizarEstoque = req.db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ?');
    for (const item of itens) {
      const resultado = atualizarEstoque.run([item.quantidade, item.produtoId, item.quantidade]);
      if (resultado.changes === 0) {
        return res.status(400).json({ erro: `Estoque insuficiente para o produto ID ${item.produtoId}` });
      }
    }
    atualizarEstoque.free();
  }

  res.json({ sucesso: true, status });
});

// GET buscar pedido por nome do cliente (público)
router.get('/buscar/:nome', (req, res) => {
  if (!req.params.nome || req.params.nome.trim().length < 3) {
    return res.status(400).json({ erro: 'Nome deve ter pelo menos 3 caracteres' });
  }

  const stmt = req.db.prepare('SELECT * FROM pedidos WHERE nomeCliente LIKE ? ORDER BY id DESC');
  stmt.bind([`%${req.params.nome.trim()}%`]);
  const pedidos = [];
  while (stmt.step()) {
    const pedido = stmt.getAsObject();
    const stmtItens = req.db.prepare('SELECT * FROM itens_pedido WHERE pedidoId = ?');
    stmtItens.bind([pedido.id]);
    const itens = [];
    while (stmtItens.step()) itens.push(stmtItens.getAsObject());
    stmtItens.free();
    pedidos.push({ ...pedido, itens });
  }
  stmt.free();
  res.json(pedidos);
});

module.exports = router;