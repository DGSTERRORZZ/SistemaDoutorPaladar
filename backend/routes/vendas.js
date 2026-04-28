const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

router.get('/', (req, res) => {
  const stmtVendas = req.db.prepare('SELECT * FROM vendas ORDER BY id DESC');
  const vendas = [];
  while (stmtVendas.step()) {
    const venda = stmtVendas.getAsObject();
    const stmtItens = req.db.prepare('SELECT * FROM itens_venda WHERE vendaId = ?');
    stmtItens.bind([venda.id]);
    const itens = [];
    while (stmtItens.step()) itens.push(stmtItens.getAsObject());
    stmtItens.free();
    vendas.push({ ...venda, itens });
  }
  stmtVendas.free();
  res.json(vendas);
});

router.post('/', (req, res) => {
  const { itens, total, formaPagamento, data } = req.body;
  if (!itens || !total || !formaPagamento) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }

  req.db.run('INSERT INTO vendas (total, formaPagamento, data) VALUES (?, ?, ?)',
    [total, formaPagamento, data || new Date().toISOString()]);
  const vendaId = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];

  const insertItem = req.db.prepare('INSERT INTO itens_venda (vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (?, ?, ?, ?, ?)');
  const atualizarEstoque = req.db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ?');

  for (const item of itens) {
    insertItem.run([vendaId, item.produtoId, item.nome, item.quantidade, item.precoUnitario]);
    atualizarEstoque.run([item.quantidade, item.produtoId]);
  }
  insertItem.free();
  atualizarEstoque.free();

  res.status(201).json({ id: vendaId, total, formaPagamento, data });
});

module.exports = router;
