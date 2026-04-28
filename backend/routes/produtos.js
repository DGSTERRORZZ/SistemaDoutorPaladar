const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

// Middleware para garantir que o banco está pronto
router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

router.get('/', (req, res) => {
  const stmt = req.db.prepare('SELECT * FROM produtos');
  const produtos = [];
  while (stmt.step()) {
    produtos.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(produtos);
});

router.get('/:id', (req, res) => {
  const stmt = req.db.prepare('SELECT * FROM produtos WHERE id = ?');
  stmt.bind([req.params.id]);
  if (stmt.step()) {
    res.json(stmt.getAsObject());
  } else {
    res.status(404).json({ erro: 'Produto não encontrado' });
  }
  stmt.free();
});

router.post('/', (req, res) => {
  const { nome, categoria, preco, estoque, estoqueMinimo } = req.body;
  if (!nome || !categoria || preco == null || estoque == null) {
    return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
  }
  req.db.run('INSERT INTO produtos (nome, categoria, preco, estoque, estoqueMinimo) VALUES (?, ?, ?, ?, ?)', 
    [nome, categoria, preco, estoque, estoqueMinimo || 10]);
  const id = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  res.status(201).json({ id, nome, categoria, preco, estoque, estoqueMinimo: estoqueMinimo || 10 });
});

router.put('/:id', (req, res) => {
  const stmt = req.db.prepare('SELECT * FROM produtos WHERE id = ?');
  stmt.bind([req.params.id]);
  let produto;
  if (stmt.step()) {
    produto = stmt.getAsObject();
  }
  stmt.free();
  if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

  const { nome, categoria, preco, estoque, estoqueMinimo } = req.body;
  req.db.run('UPDATE produtos SET nome=?, categoria=?, preco=?, estoque=?, estoqueMinimo=? WHERE id=?',
    [nome ?? produto.nome, categoria ?? produto.categoria, preco ?? produto.preco,
     estoque ?? produto.estoque, estoqueMinimo ?? produto.estoqueMinimo, req.params.id]);
  res.json({ id: Number(req.params.id), ...req.body });
});

router.delete('/:id', (req, res) => {
  req.db.run('DELETE FROM produtos WHERE id = ?', [req.params.id]);
  res.status(204).send();
});

module.exports = router;
