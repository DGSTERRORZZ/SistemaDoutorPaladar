const express = require('express');
const router = express.Router();
const { getDatabase, queryAll } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

router.get('/', (req, res) => {
  try {
    const despesas = queryAll(req.db, 'SELECT * FROM despesas ORDER BY id DESC');
    res.json(despesas);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar despesas' });
  }
});

router.post('/', (req, res) => {
  try {
    const { descricao, valor, categoria, data } = req.body;
    if (!descricao || !valor) return res.status(400).json({ erro: 'Dados incompletos' });

    const valorNum = parseFloat(valor);
    if (isNaN(valorNum) || valorNum <= 0) return res.status(400).json({ erro: 'Valor inválido' });

    const dataFinal = data || new Date().toISOString();
    req.db.run('INSERT INTO despesas (descricao, valor, categoria, data) VALUES (?, ?, ?, ?)',
      [descricao.trim(), valorNum, categoria || 'Outros', dataFinal]);
    const id = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    res.status(201).json({ id, descricao: descricao.trim(), valor: valorNum, categoria: categoria || 'Outros', data: dataFinal });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao registrar despesa' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    req.db.run('DELETE FROM despesas WHERE id = ?', [Number(req.params.id)]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir despesa' });
  }
});

module.exports = router;
