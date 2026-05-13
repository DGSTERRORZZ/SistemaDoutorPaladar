const express = require('express');
const router = express.Router();
const { getDatabase, queryOne, queryAll } = require('../database');
const { verifyToken } = require('../authMiddleware');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

// GET todos os agendamentos (público - clientes precisam ver horários)
router.get('/', (req, res) => {
  try {
    const agendamentos = queryAll(req.db, 'SELECT * FROM agendamentos ORDER BY horarioInicio');
    for (const ag of agendamentos) {
      const result = queryOne(req.db,
        "SELECT COUNT(*) as qtd FROM pedidos WHERE horarioRetirada = ? AND date(data) = date('now') AND status != 'recusado'",
        [ag.horarioInicio]);
      ag.pedidosHoje = result ? result.qtd : 0;
    }
    res.json(agendamentos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar agendamentos' });
  }
});

// PUT atualizar agendamento (protegido)
router.put('/:id', verifyToken, (req, res) => {
  try {
    const { limitePedidos, bloqueado } = req.body;
    const ag = queryOne(req.db, 'SELECT * FROM agendamentos WHERE id = ?', [Number(req.params.id)]);
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' });

    req.db.run('UPDATE agendamentos SET limitePedidos = ?, bloqueado = ? WHERE id = ?',
      [limitePedidos ?? ag.limitePedidos, bloqueado ?? ag.bloqueado, Number(req.params.id)]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar agendamento' });
  }
});

// POST criar novo horário (protegido)
router.post('/', verifyToken, (req, res) => {
  try {
    const { horarioInicio, horarioFim, limitePedidos } = req.body;
    if (!horarioInicio || !horarioFim) return res.status(400).json({ erro: 'Dados incompletos' });
    req.db.run('INSERT INTO agendamentos (horarioInicio, horarioFim, limitePedidos) VALUES (?, ?, ?)',
      [horarioInicio, horarioFim, limitePedidos || 10]);
    const id = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    res.status(201).json({ id, horarioInicio, horarioFim, limitePedidos });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar agendamento' });
  }
});

// DELETE remover horário (protegido)
router.delete('/:id', verifyToken, (req, res) => {
  try {
    req.db.run('DELETE FROM agendamentos WHERE id = ?', [Number(req.params.id)]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir agendamento' });
  }
});

module.exports = router;
