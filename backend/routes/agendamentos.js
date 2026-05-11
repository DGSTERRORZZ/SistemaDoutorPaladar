const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

// GET todos os agendamentos
router.get('/', (req, res) => {
  const stmt = req.db.prepare('SELECT * FROM agendamentos ORDER BY horarioInicio');
  const agendamentos = [];
  while (stmt.step()) {
    const agendamento = stmt.getAsObject();
    // Contar pedidos neste horário
    const stmtPedidos = req.db.prepare("SELECT COUNT(*) as qtd FROM pedidos WHERE horarioRetirada = ? AND date(data) = date('now') AND status != 'recusado'");
    stmtPedidos.bind([agendamento.horarioInicio]);
    if (stmtPedidos.step()) {
      agendamento.pedidosHoje = stmtPedidos.getAsObject().qtd;
    }
    stmtPedidos.free();
    agendamentos.push(agendamento);
  }
  stmt.free();
  res.json(agendamentos);
});

// PUT atualizar agendamento
router.put('/:id', (req, res) => {
  const { limitePedidos, bloqueado } = req.body;
  const stmt = req.db.prepare('SELECT * FROM agendamentos WHERE id = ?');
  stmt.bind([req.params.id]);
  let ag;
  if (stmt.step()) ag = stmt.getAsObject();
  stmt.free();
  if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' });

  req.db.run('UPDATE agendamentos SET limitePedidos = ?, bloqueado = ? WHERE id = ?',
    [limitePedidos ?? ag.limitePedidos, bloqueado ?? ag.bloqueado, req.params.id]);
  res.json({ sucesso: true });
});

// POST criar novo horário
router.post('/', (req, res) => {
  const { horarioInicio, horarioFim, limitePedidos } = req.body;
  if (!horarioInicio || !horarioFim) return res.status(400).json({ erro: 'Dados incompletos' });
  req.db.run('INSERT INTO agendamentos (horarioInicio, horarioFim, limitePedidos) VALUES (?, ?, ?)',
    [horarioInicio, horarioFim, limitePedidos || 10]);
  const id = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  res.status(201).json({ id, horarioInicio, horarioFim, limitePedidos });
});

// DELETE remover horário
router.delete('/:id', (req, res) => {
  req.db.run('DELETE FROM agendamentos WHERE id = ?', [req.params.id]);
  res.status(204).send();
});

module.exports = router;