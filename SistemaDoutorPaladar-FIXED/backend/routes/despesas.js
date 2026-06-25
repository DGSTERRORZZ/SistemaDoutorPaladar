const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

router.get('/', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    let sql = 'SELECT * FROM despesas';
    const params = [];
    if (inicio && fim) {
      sql += ' WHERE data BETWEEN ? AND ?';
      params.push(inicio, fim);
    }
    sql += ' ORDER BY data DESC, id DESC';
    const despesas = await query(sql, params);
    despesas.forEach(d => { d.valor = parseFloat(d.valor); });
    res.json(despesas);
  } catch (error) {
    console.error('Erro ao listar despesas:', error);
    res.status(500).json({ erro: 'Erro ao listar despesas' });
  }
});

router.post('/', async (req, res) => {
  const { descricao, valor, categoria, data } = req.body;
  if (!descricao || valor === undefined) return res.status(400).json({ erro: 'Dados incompletos' });
  try {
    const dataDespesa = data || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const result = await execute(
      'INSERT INTO despesas (descricao, valor, categoria, data) VALUES (?, ?, ?, ?)',
      [descricao, parseFloat(valor), categoria || 'Outros', dataDespesa]
    );
    res.status(201).json({ id: result.insertId, descricao, valor: parseFloat(valor), categoria: categoria || 'Outros', data: dataDespesa });
  } catch (error) {
    console.error('Erro ao criar despesa:', error);
    res.status(500).json({ erro: 'Erro ao criar despesa' });
  }
});

router.put('/:id', async (req, res) => {
  const { descricao, valor, categoria, data } = req.body;
  try {
    await execute(
      'UPDATE despesas SET descricao = ?, valor = ?, categoria = ?, data = ? WHERE id = ?',
      [descricao, parseFloat(valor), categoria || 'Outros', data, req.params.id]
    );
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao atualizar despesa:', error);
    res.status(500).json({ erro: 'Erro ao atualizar despesa' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await execute('DELETE FROM despesas WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao remover despesa' });
  }
});

module.exports = router;
