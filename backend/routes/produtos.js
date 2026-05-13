const express = require('express');
const router = express.Router();
const { getDatabase, queryOne, queryAll } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

router.get('/', (req, res) => {
  try {
    const produtos = queryAll(req.db, 'SELECT * FROM produtos');
    res.json(produtos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar produtos' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const produto = queryOne(req.db, 'SELECT * FROM produtos WHERE id = ?', [Number(req.params.id)]);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar produto' });
  }
});

router.post('/', (req, res) => {
  try {
    const { nome, categoria, preco, estoque, estoqueMinimo } = req.body;
    if (!nome || !categoria || preco == null || estoque == null) {
      return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
    }

    const precoNum = parseFloat(preco);
    const estoqueNum = parseInt(estoque);
    if (isNaN(precoNum) || precoNum < 0) return res.status(400).json({ erro: 'Preço inválido' });
    if (isNaN(estoqueNum) || estoqueNum < 0) return res.status(400).json({ erro: 'Estoque inválido' });

    req.db.run('INSERT INTO produtos (nome, categoria, preco, estoque, estoqueMinimo) VALUES (?, ?, ?, ?, ?)',
      [nome.trim(), categoria, precoNum, estoqueNum, parseInt(estoqueMinimo) || 10]);
    const id = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    res.status(201).json({ id, nome: nome.trim(), categoria, preco: precoNum, estoque: estoqueNum, estoqueMinimo: parseInt(estoqueMinimo) || 10 });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar produto' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const produto = queryOne(req.db, 'SELECT * FROM produtos WHERE id = ?', [Number(req.params.id)]);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

    const { nome, categoria, preco, estoque, estoqueMinimo } = req.body;
    req.db.run('UPDATE produtos SET nome=?, categoria=?, preco=?, estoque=?, estoqueMinimo=? WHERE id=?',
      [nome ?? produto.nome, categoria ?? produto.categoria, preco ?? produto.preco,
       estoque ?? produto.estoque, estoqueMinimo ?? produto.estoqueMinimo, Number(req.params.id)]);
    res.json({ id: Number(req.params.id), ...req.body });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar produto' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    req.db.run('DELETE FROM produtos WHERE id = ?', [Number(req.params.id)]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir produto' });
  }
});

module.exports = router;
