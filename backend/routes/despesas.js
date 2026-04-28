const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

router.get('/', (req, res) => {
  const stmt = req.db.prepare('SELECT * FROM despesas ORDER BY id DESC');
  const despesas = [];
  while (stmt.step()) despesas.push(stmt.getAsObject());
  stmt.free();
  res.json(despesas);
});

router.post('/', (req, res) => {
  const { descricao, valor, categoria, data } = req.body;
  if (!descricao || !valor) return res.status(400).json({ erro: 'Dados incompletos' });
  req.db.run('INSERT INTO despesas (descricao, valor, categoria, data) VALUES (?, ?, ?, ?)',
    [descricao, valor, categoria || 'Outros', data || new Date().toISOString()]);
  const id = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  res.status(201).json({ id, descricao, valor, categoria, data: data || new Date().toISOString() });
});

router.delete('/:id', (req, res) => {
  req.db.run('DELETE FROM despesas WHERE id = ?', [req.params.id]);
  res.status(204).send();
});

module.exports = router;
