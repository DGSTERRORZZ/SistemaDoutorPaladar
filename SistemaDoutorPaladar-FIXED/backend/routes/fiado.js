const express = require('express');
const router = express.Router();
const { getDatabase, query, execute } = require('../database');

// GET todos os clientes com fiado
router.get('/clientes', async (req, res) => {
  try {
    const clientes = await query('SELECT * FROM clientes_fiado ORDER BY nome');
    for (const cliente of clientes) {
      cliente.limite = parseFloat(cliente.limite);
      cliente.saldoDevedor = parseFloat(cliente.saldoDevedor);
      const dividas = await query('SELECT * FROM dividas WHERE clienteId = ? ORDER BY id DESC', [cliente.id]);
      for (const divida of dividas) {
        divida.total = parseFloat(divida.total);
        divida.valorPago = parseFloat(divida.valorPago);
        divida.pago = !!divida.pago;
        divida.itens = await query('SELECT * FROM itens_divida WHERE dividaId = ?', [divida.id]);
        divida.itens.forEach(i => { i.precoUnitario = parseFloat(i.precoUnitario); });
      }
      cliente.dividas = dividas;
    }

    const historicoPagamentos = await query(`
      SELECT p.*, c.nome as clienteNome
      FROM pagamentos_fiado p
      JOIN clientes_fiado c ON c.id = p.clienteId
      ORDER BY p.id DESC LIMIT 50
    `);
    historicoPagamentos.forEach(h => { h.valor = parseFloat(h.valor); });

    res.json({ clientes, historicoPagamentos });
  } catch (error) {
    console.error('Erro ao listar clientes fiado:', error);
    res.status(500).json({ erro: 'Erro ao listar clientes' });
  }
});

// POST criar cliente fiado
router.post('/clientes', async (req, res) => {
  const { nome, turma, telefone, limite } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
  try {
    const dataCadastro = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const result = await execute(
      'INSERT INTO clientes_fiado (nome, turma, telefone, limite, saldoDevedor, dataCadastro) VALUES (?, ?, ?, ?, 0, ?)',
      [nome, turma || '', telefone || '', limite || 50, dataCadastro]
    );
    res.status(201).json({ id: result.insertId, nome, turma, telefone, limite: limite || 50 });
  } catch (error) {
    console.error('Erro ao criar cliente fiado:', error);
    res.status(500).json({ erro: 'Erro ao criar cliente' });
  }
});

// POST registrar compra a fiado (gera dívida e dá baixa no estoque)
router.post('/compras', async (req, res) => {
  const { clienteId, itens, total } = req.body;
  if (!clienteId || !itens || !itens.length || !total) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const dataCompra = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [result] = await conn.execute(
      'INSERT INTO dividas (clienteId, data, total, valorPago, pago) VALUES (?, ?, ?, 0, 0)',
      [clienteId, dataCompra, parseFloat(total)]
    );
    const dividaId = result.insertId;
    for (const item of itens) {
      await conn.execute(
        'INSERT INTO itens_divida (dividaId, produtoId, quantidade, precoUnitario) VALUES (?, ?, ?, ?)',
        [dividaId, item.produtoId, item.quantidade, parseFloat(item.precoUnitario)]
      );
      await conn.execute('UPDATE produtos SET estoque = estoque - ? WHERE id = ?', [item.quantidade, item.produtoId]);
    }
    await conn.execute('UPDATE clientes_fiado SET saldoDevedor = saldoDevedor + ? WHERE id = ?', [parseFloat(total), clienteId]);
    await conn.commit();
    res.status(201).json({ id: dividaId });
  } catch (error) {
    await conn.rollback();
    console.error('Erro ao registrar compra fiado:', error);
    res.status(500).json({ erro: 'Erro ao registrar compra' });
  } finally {
    conn.release();
  }
});

// POST registrar pagamento de dívida
router.post('/pagamentos', async (req, res) => {
  const { clienteId, dividaId, valor } = req.body;
  if (!clienteId || !dividaId || !valor) return res.status(400).json({ erro: 'Dados incompletos' });
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    const [dividas] = await conn.execute('SELECT * FROM dividas WHERE id = ? AND clienteId = ?', [dividaId, clienteId]);
    if (dividas.length === 0) return res.status(404).json({ erro: 'Dívida não encontrada' });
    const divida = dividas[0];

    const novoValorPago = parseFloat(divida.valorPago) + parseFloat(valor);
    const pago = novoValorPago >= parseFloat(divida.total) ? 1 : 0;

    await conn.beginTransaction();
    await conn.execute('UPDATE dividas SET valorPago = ?, pago = ? WHERE id = ?', [novoValorPago, pago, dividaId]);
    await conn.execute('UPDATE clientes_fiado SET saldoDevedor = saldoDevedor - ? WHERE id = ?', [parseFloat(valor), clienteId]);
    const dataPagamento = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await conn.execute(
      'INSERT INTO pagamentos_fiado (clienteId, dividaId, valor, data) VALUES (?, ?, ?, ?)',
      [clienteId, dividaId, parseFloat(valor), dataPagamento]
    );
    await conn.commit();
    res.json({ sucesso: true, pago: !!pago });
  } catch (error) {
    await conn.rollback();
    console.error('Erro ao registrar pagamento:', error);
    res.status(500).json({ erro: 'Erro ao registrar pagamento' });
  } finally {
    conn.release();
  }
});

// DELETE remover cliente
router.delete('/clientes/:id', async (req, res) => {
  try {
    await execute('DELETE FROM clientes_fiado WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao remover cliente' });
  }
});

module.exports = router;
