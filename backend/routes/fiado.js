const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

router.get('/clientes', (req, res) => {
  const stmtClientes = req.db.prepare('SELECT * FROM clientes');
  const clientes = [];
  while (stmtClientes.step()) {
    const cliente = stmtClientes.getAsObject();
    const stmtDividas = req.db.prepare('SELECT * FROM dividas WHERE clienteId = ?');
    stmtDividas.bind([cliente.id]);
    const dividas = [];
    while (stmtDividas.step()) {
      const divida = stmtDividas.getAsObject();
      const stmtItens = req.db.prepare('SELECT * FROM itens_divida WHERE dividaId = ?');
      stmtItens.bind([divida.id]);
      const itens = [];
      while (stmtItens.step()) itens.push(stmtItens.getAsObject());
      stmtItens.free();
      dividas.push({ ...divida, itens, pago: !!divida.pago });
    }
    stmtDividas.free();
    clientes.push({ ...cliente, dividas });
  }
  stmtClientes.free();
  res.json({ clientes, historicoPagamentos: [] });
});

router.post('/clientes', (req, res) => {
  const { nome, turma } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
  req.db.run('INSERT INTO clientes (nome, turma, dataCadastro) VALUES (?, ?, ?)',
    [nome, turma || '', new Date().toISOString()]);
  const id = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  res.status(201).json({ id, nome, turma });
});

router.post('/compras', (req, res) => {
  const { clienteId, itens, total } = req.body;
  if (!clienteId || !itens || !total) return res.status(400).json({ erro: 'Dados incompletos' });

  req.db.run('INSERT INTO dividas (clienteId, data, total, pago, valorPago) VALUES (?, ?, ?, 0, 0)',
    [clienteId, new Date().toISOString(), total]);
  const dividaId = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];

  const insertItem = req.db.prepare('INSERT INTO itens_divida (dividaId, produtoId, quantidade, precoUnitario) VALUES (?, ?, ?, ?)');
  const atualizarEstoque = req.db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ?');

  for (const item of itens) {
    insertItem.run([dividaId, item.produtoId, item.quantidade, item.precoUnitario]);
    atualizarEstoque.run([item.quantidade, item.produtoId]);
  }
  insertItem.free();
  atualizarEstoque.free();

  res.status(201).json({ id: dividaId });
});

router.post('/pagamentos', (req, res) => {
  const { clienteId, dividaId, valor } = req.body;
  const stmt = req.db.prepare('SELECT * FROM dividas WHERE id = ? AND clienteId = ?');
  stmt.bind([dividaId, clienteId]);
  let divida;
  if (stmt.step()) divida = stmt.getAsObject();
  stmt.free();
  if (!divida) return res.status(404).json({ erro: 'Dívida não encontrada' });

  const novoValorPago = divida.valorPago + valor;
  const pago = novoValorPago >= divida.total ? 1 : 0;
  req.db.run('UPDATE dividas SET valorPago = ?, pago = ? WHERE id = ?', [novoValorPago, pago, dividaId]);
  res.json({ sucesso: true });
});

module.exports = router;
