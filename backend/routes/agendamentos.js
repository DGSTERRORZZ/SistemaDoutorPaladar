const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../database');

// GET todos os agendamentos com contagem de pedidos do dia
router.get('/', async (req, res) => {
  try {
    const agendamentos = await query('SELECT * FROM agendamentos ORDER BY horarioInicio');
    for (const ag of agendamentos) {
      const resultado = await queryOne(
        "SELECT COUNT(*) as qtd FROM pedidos WHERE horarioRetirada = ? AND DATE(data) = CURDATE() AND status != 'recusado'",
        [ag.horarioInicio]
      );
      ag.pedidosHoje = resultado ? resultado.qtd : 0;
      ag.bloqueado = !!ag.bloqueado;
      const horaInicio = parseInt(ag.horarioInicio.split(':')[0], 10);
      ag.tipo = horaInicio < 18 ? 'Almoço' : 'Jantar';
    }
    res.json(agendamentos);
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    res.status(500).json({ erro: 'Erro ao listar agendamentos' });
  }
});

// PUT atualizar agendamento
router.put('/:id', async (req, res) => {
  const { limitePedidos, bloqueado, horarioInicio, horarioFim } = req.body;
  try {
    const ag = await queryOne('SELECT * FROM agendamentos WHERE id = ?', [req.params.id]);
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' });

    await execute(
      'UPDATE agendamentos SET horarioInicio = ?, horarioFim = ?, limitePedidos = ?, bloqueado = ? WHERE id = ?',
      [
        horarioInicio ?? ag.horarioInicio,
        horarioFim ?? ag.horarioFim,
        limitePedidos !== undefined ? limitePedidos : ag.limitePedidos,
        bloqueado !== undefined ? (bloqueado ? 1 : 0) : ag.bloqueado,
        req.params.id
      ]
    );
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    res.status(500).json({ erro: 'Erro ao atualizar agendamento' });
  }
});

// POST criar novo horário
router.post('/', async (req, res) => {
  const { horarioInicio, horarioFim, limitePedidos } = req.body;
  if (!horarioInicio || !horarioFim) return res.status(400).json({ erro: 'Dados incompletos' });
  try {
    const result = await execute(
      'INSERT INTO agendamentos (horarioInicio, horarioFim, limitePedidos, bloqueado) VALUES (?, ?, ?, 0)',
      [horarioInicio, horarioFim, limitePedidos || 20]
    );
    res.status(201).json({ id: result.insertId, horarioInicio, horarioFim, limitePedidos: limitePedidos || 20 });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ erro: 'Erro ao criar agendamento' });
  }
});

// DELETE remover horário
router.delete('/:id', async (req, res) => {
  try {
    await execute('DELETE FROM agendamentos WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao remover agendamento' });
  }
});

module.exports = router;
