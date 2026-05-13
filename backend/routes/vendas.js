const express = require('express');
const router = express.Router();
const { getDatabase, queryAll, queryOne } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

router.get('/', (req, res) => {
  try {
    const vendas = queryAll(req.db, 'SELECT * FROM vendas ORDER BY id DESC');
    for (const venda of vendas) {
      venda.itens = queryAll(req.db, 'SELECT * FROM itens_venda WHERE vendaId = ?', [venda.id]);
    }
    res.json(vendas);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar vendas' });
  }
});

router.post('/', (req, res) => {
  try {
    const { itens, total, formaPagamento, data } = req.body;
    if (!itens || !total || !formaPagamento) {
      return res.status(400).json({ erro: 'Dados incompletos' });
    }

    // Verificar estoque antes de vender
    for (const item of itens) {
      const produto = queryOne(req.db, 'SELECT estoque FROM produtos WHERE id = ?', [item.produtoId]);
      if (!produto || produto.estoque < item.quantidade) {
        return res.status(400).json({ erro: `Estoque insuficiente para ${item.nome || 'produto'}` });
      }
    }

    req.db.run('INSERT INTO vendas (total, formaPagamento, data) VALUES (?, ?, ?)',
      [total, formaPagamento, data || new Date().toISOString()]);
    const vendaId = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    const insertItem = req.db.prepare('INSERT INTO itens_venda (vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (?, ?, ?, ?, ?)');
    const atualizarEstoque = req.db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ?');

    for (const item of itens) {
      insertItem.run([vendaId, item.produtoId, item.nome || '', item.quantidade, item.precoUnitario]);
      atualizarEstoque.run([item.quantidade, item.produtoId]);
    }
    insertItem.free();
    atualizarEstoque.free();

    res.status(201).json({ id: vendaId, total, formaPagamento, data });
  } catch (err) {
    console.error('Erro ao registrar venda:', err);
    res.status(500).json({ erro: 'Erro ao registrar venda' });
  }
});

module.exports = router;
