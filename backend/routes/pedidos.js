const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

// ============================================
// ROTAS PÚBLICAS (sem token)
// ============================================

// POST criar pedido (alunos)
router.post('/', (req, res) => {
  const { nomeCliente, turma, horarioRetirada, itens, total } = req.body;

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

  // Validar se o horário existe
  const stmtAg = req.db.prepare('SELECT * FROM agendamentos WHERE horarioInicio = ?');
  stmtAg.bind([horarioRetirada]);
  let agendamento = null;
  if (stmtAg.step()) {
    agendamento = stmtAg.getAsObject();
  }
  stmtAg.free();

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

// GET buscar pedido por nome do cliente (alunos consultam status)
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

// ============================================
// ROTAS PROTEGIDAS (exigem token JWT)
// ============================================

// GET todos os pedidos (admin)
router.get('/admin', (req, res) => {
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

// PUT atualizar status do pedido (admin) — CORRIGIDO: validação de estoque refeita
router.put('/:id/status', (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ erro: 'Status é obrigatório' });
  }

  const statusValidos = ['pendente', 'confirmado', 'preparando', 'pronto', 'entregue', 'recusado'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${statusValidos.join(', ')}` });
  }

  // Buscar pedido
  const stmt = req.db.prepare('SELECT * FROM pedidos WHERE id = ?');
  stmt.bind([req.params.id]);
  let pedido = null;
  if (stmt.step()) {
    pedido = stmt.getAsObject();
  }
  stmt.free();

  if (!pedido) {
    return res.status(404).json({ erro: 'Pedido não encontrado' });
  }

  if (pedido.status === 'entregue' || pedido.status === 'recusado') {
    return res.status(400).json({ erro: `Pedido já está ${pedido.status}. Não pode ser alterado.` });
  }

  // Se for confirmar, validar estoque ANTES de atualizar
  if (status === 'confirmado' && pedido.status !== 'confirmado') {
    const stmtItens = req.db.prepare('SELECT * FROM itens_pedido WHERE pedidoId = ?');
    stmtItens.bind([req.params.id]);
    const itens = [];
    while (stmtItens.step()) itens.push(stmtItens.getAsObject());
    stmtItens.free();

    // Validar cada item
    for (const item of itens) {
      const stmtProd = req.db.prepare('SELECT id, nome, estoque FROM produtos WHERE id = ?');
      stmtProd.bind([item.produtoId]);
      let produto = null;
      if (stmtProd.step()) {
        produto = stmtProd.getAsObject();
      }
      stmtProd.free();

      if (!produto) {
        return res.status(404).json({ erro: `Produto ID ${item.produtoId} não encontrado` });
      }

      if (produto.estoque < item.quantidade) {
        return res.status(400).json({ 
          erro: `Estoque insuficiente para "${produto.nome}". Disponível: ${produto.estoque}, solicitado: ${item.quantidade}` 
        });
      }
    }

    // Deduzir estoque
    const atualizarEstoque = req.db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ?');
    for (const item of itens) {
      atualizarEstoque.run([item.quantidade, item.produtoId]);
    }
    atualizarEstoque.free();
  }

  req.db.run('UPDATE pedidos SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ sucesso: true, status });
});

module.exports = router;