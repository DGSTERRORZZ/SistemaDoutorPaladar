const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

// GET todos
router.get('/', (req, res) => {
  const stmt = req.db.prepare('SELECT * FROM fornecedores ORDER BY nome');
  const fornecedores = [];
  while (stmt.step()) fornecedores.push(stmt.getAsObject());
  stmt.free();
  res.json(fornecedores);
});

// GET um
router.get('/:id', (req, res) => {
  const stmt = req.db.prepare('SELECT * FROM fornecedores WHERE id = ?');
  stmt.bind([req.params.id]);
  if (stmt.step()) {
    res.json(stmt.getAsObject());
  } else {
    res.status(404).json({ erro: 'Fornecedor não encontrado' });
  }
  stmt.free();
});

// POST criar
router.post('/', (req, res) => {
  const { nome, cnpj, telefone, email, endereco } = req.body;
  if (!nome || nome.trim().length < 2) {
    return res.status(400).json({ erro: 'Nome do fornecedor é obrigatório (mínimo 2 caracteres)' });
  }
  req.db.run('INSERT INTO fornecedores (nome, cnpj, telefone, email, endereco) VALUES (?, ?, ?, ?, ?)',
    [nome.trim(), cnpj || '', telefone || '', email || '', endereco || '']);
  const id = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  res.status(201).json({ id, nome: nome.trim(), cnpj, telefone, email, endereco });
});

// PUT atualizar — CORRIGIDO: .get() removido
router.put('/:id', (req, res) => {
  const { nome, cnpj, telefone, email, endereco } = req.body;

  const stmt = req.db.prepare('SELECT * FROM fornecedores WHERE id = ?');
  stmt.bind([req.params.id]);
  let fornecedor = null;
  if (stmt.step()) {
    fornecedor = stmt.getAsObject();
  }
  stmt.free();

  if (!fornecedor) {
    return res.status(404).json({ erro: 'Fornecedor não encontrado' });
  }

  req.db.run('UPDATE fornecedores SET nome=?, cnpj=?, telefone=?, email=?, endereco=? WHERE id=?',
    [nome ?? fornecedor.nome, cnpj ?? fornecedor.cnpj, telefone ?? fornecedor.telefone,
     email ?? fornecedor.email, endereco ?? fornecedor.endereco, req.params.id]);
  res.json({ sucesso: true });
});

// DELETE excluir
router.delete('/:id', (req, res) => {
  req.db.run('DELETE FROM fornecedores WHERE id = ?', [req.params.id]);
  res.status(204).send();
});

// POST registrar compra do fornecedor — CORRIGIDO: .get() removido
router.post('/compras', (req, res) => {
  const { fornecedorId, itens, total, status, data } = req.body;

  if (!fornecedorId) {
    return res.status(400).json({ erro: 'Fornecedor é obrigatório' });
  }

  // Verificar se fornecedor existe
  const stmt = req.db.prepare('SELECT * FROM fornecedores WHERE id = ?');
  stmt.bind([fornecedorId]);
  let fornecedor = null;
  if (stmt.step()) {
    fornecedor = stmt.getAsObject();
  }
  stmt.free();

  if (!fornecedor) {
    return res.status(404).json({ erro: 'Fornecedor não encontrado' });
  }

  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Adicione pelo menos um item à compra' });
  }

  if (!total || total <= 0) {
    return res.status(400).json({ erro: 'Total da compra inválido' });
  }

  req.db.run('INSERT INTO compras_fornecedor (fornecedorId, total, status, data) VALUES (?, ?, ?, ?)',
    [fornecedorId, total, status || 'pedido', data || new Date().toISOString()]);
  const compraId = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];

  const insertItem = req.db.prepare('INSERT INTO itens_compra (compraId, produtoId, quantidade, precoUnitario) VALUES (?, ?, ?, ?)');
  for (const item of itens) {
    insertItem.run([compraId, item.produtoId, item.quantidade, item.precoUnitario]);
  }
  insertItem.free();

  res.status(201).json({ id: compraId, status: 'pedido' });
});

// PUT confirmar entrega (atualiza estoque) — CORRIGIDO: .get() removido
router.put('/compras/:id/entregar', (req, res) => {
  const stmt = req.db.prepare('SELECT * FROM compras_fornecedor WHERE id = ?');
  stmt.bind([req.params.id]);
  let compra = null;
  if (stmt.step()) {
    compra = stmt.getAsObject();
  }
  stmt.free();

  if (!compra) {
    return res.status(404).json({ erro: 'Compra não encontrada' });
  }

  if (compra.status === 'entregue') {
    return res.status(400).json({ erro: 'Compra já foi entregue' });
  }

  req.db.run('UPDATE compras_fornecedor SET status = ? WHERE id = ?', ['entregue', req.params.id]);

  const stmtItens = req.db.prepare('SELECT * FROM itens_compra WHERE compraId = ?');
  stmtItens.bind([req.params.id]);
  const itens = [];
  while (stmtItens.step()) itens.push(stmtItens.getAsObject());
  stmtItens.free();

  const atualizarEstoque = req.db.prepare('UPDATE produtos SET estoque = estoque + ? WHERE id = ?');
  for (const item of itens) {
    atualizarEstoque.run([item.quantidade, item.produtoId]);
  }
  atualizarEstoque.free();

  res.json({ sucesso: true });
});

// GET compras do fornecedor
router.get('/:id/compras', (req, res) => {
  const stmtCompras = req.db.prepare('SELECT * FROM compras_fornecedor WHERE fornecedorId = ? ORDER BY id DESC');
  stmtCompras.bind([req.params.id]);
  const compras = [];
  while (stmtCompras.step()) {
    const compra = stmtCompras.getAsObject();
    const stmtItens = req.db.prepare('SELECT * FROM itens_compra WHERE compraId = ?');
    stmtItens.bind([compra.id]);
    const itens = [];
    while (stmtItens.step()) itens.push(stmtItens.getAsObject());
    stmtItens.free();
    compras.push({ ...compra, itens });
  }
  stmtCompras.free();
  res.json(compras);
});

module.exports = router;