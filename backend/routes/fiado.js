const express = require('express');
const router = express.Router();
const { getDatabase, queryOne, queryAll } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

router.get('/clientes', (req, res) => {
  try {
    const clientes = queryAll(req.db, 'SELECT * FROM clientes');
    for (const cliente of clientes) {
      cliente.dividas = queryAll(req.db, 'SELECT * FROM dividas WHERE clienteId = ?', [cliente.id]);
      for (const divida of cliente.dividas) {
        divida.itens = queryAll(req.db, 'SELECT * FROM itens_divida WHERE dividaId = ?', [divida.id]);
        divida.pago = !!divida.pago;
      }
    }
    res.json({ clientes, historicoPagamentos: [] });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }
});

router.post('/clientes', (req, res) => {
  try {
    const { nome, turma } = req.body;
    if (!nome || nome.trim().length < 3) return res.status(400).json({ erro: 'Nome deve ter pelo menos 3 caracteres' });
    req.db.run('INSERT INTO clientes (nome, turma, dataCadastro) VALUES (?, ?, ?)',
      [nome.trim(), turma || '', new Date().toISOString()]);
    const id = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    res.status(201).json({ id, nome: nome.trim(), turma });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao cadastrar cliente' });
  }
});

router.post('/compras', (req, res) => {
  try {
    const { clienteId, itens, total } = req.body;
    if (!clienteId || !itens || !total) return res.status(400).json({ erro: 'Dados incompletos' });

    req.db.run('INSERT INTO dividas (clienteId, data, total, pago, valorPago) VALUES (?, ?, ?, 0, 0)',
      [clienteId, new Date().toISOString(), total]);
    const dividaId = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    const insertItem = req.db.prepare('INSERT INTO itens_divida (dividaId, produtoId, quantidade, precoUnitario) VALUES (?, ?, ?, ?)');
    const atualizarEstoque = req.db.prepare('UPDATE produtos SET estoque = MAX(0, estoque - ?) WHERE id = ?');

    for (const item of itens) {
      insertItem.run([dividaId, item.produtoId, item.quantidade, item.precoUnitario]);
      atualizarEstoque.run([item.quantidade, item.produtoId]);
    }
    insertItem.free();
    atualizarEstoque.free();

    res.status(201).json({ id: dividaId });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao registrar compra' });
  }
});

router.post('/pagamentos', (req, res) => {
  try {
    const { clienteId, dividaId, valor } = req.body;
    const divida = queryOne(req.db, 'SELECT * FROM dividas WHERE id = ? AND clienteId = ?', [dividaId, clienteId]);
    if (!divida) return res.status(404).json({ erro: 'Dívida não encontrada' });

    const novoValorPago = (divida.valorPago || 0) + valor;
    const pago = novoValorPago >= divida.total ? 1 : 0;
    req.db.run('UPDATE dividas SET valorPago = ?, pago = ? WHERE id = ?', [novoValorPago, pago, dividaId]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao registrar pagamento' });
  }
});

module.exports = router;
