const express = require('express');
const router = express.Router();
const { getDatabase, query, queryOne, execute } = require('../database');

// GET todos os clientes com limite / fiado
router.get('/clientes', async (req, res) => {
  try {
    const clientes = await query('SELECT id, nome, username as usuario, username, telefone, turma, limiteCredito as limite, saldoDevedor, pontosFidelidade, totalPedidos, dataCadastro FROM usuarios ORDER BY nome');
    for (const cliente of clientes) {
      cliente.limite = parseFloat(cliente.limite || 50.00);
      cliente.saldoDevedor = parseFloat(cliente.saldoDevedor || 0.00);
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
      SELECT p.*, u.nome as clienteNome
      FROM pagamentos_fiado p
      JOIN usuarios u ON u.id = p.clienteId
      ORDER BY p.id DESC LIMIT 50
    `);
    historicoPagamentos.forEach(h => { h.valor = parseFloat(h.valor); });

    res.json({ clientes, historicoPagamentos });
  } catch (error) {
    console.error('Erro ao listar clientes fiado:', error);
    res.status(500).json({ erro: 'Erro ao listar clientes' });
  }
});

// POST atualizar limite de crédito para um usuário existente
router.post('/clientes', async (req, res) => {
  const { clienteAppId, limite } = req.body;
  if (!clienteAppId) {
    return res.status(400).json({ erro: 'Selecione um cliente autenticado existente no sistema.' });
  }

  try {
    const usuarioApp = await queryOne('SELECT * FROM usuarios WHERE id = ?', [clienteAppId]);
    if (!usuarioApp) {
      return res.status(404).json({ erro: 'Usuário cadastrado não encontrado no sistema.' });
    }

    const limiteVal = parseFloat(limite !== undefined ? limite : 50.00);
    await execute('UPDATE usuarios SET limiteCredito = ? WHERE id = ?', [limiteVal, clienteAppId]);

    res.status(200).json({
      id: usuarioApp.id,
      clienteAppId: usuarioApp.id,
      nome: usuarioApp.nome,
      turma: usuarioApp.turma,
      telefone: usuarioApp.telefone,
      limite: limiteVal,
      saldoDevedor: parseFloat(usuarioApp.saldoDevedor || 0)
    });
  } catch (error) {
    console.error('Erro ao atualizar limite de crédito:', error);
    res.status(500).json({ erro: 'Erro ao atualizar limite de crédito' });
  }
});

// POST registrar compra a prazo (gera dívida, dá baixa no estoque e registra venda)
router.post('/compras', async (req, res) => {
  const { clienteId, itens, total } = req.body;
  if (!clienteId || !itens || !itens.length || !total) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }

  const db = await getDatabase();
  const conn = await db.getConnection();

  try {
    const [clientes] = await conn.execute('SELECT * FROM usuarios WHERE id = ?', [clienteId]);
    if (clientes.length === 0) {
      conn.release();
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }

    const cliente = clientes[0];
    const limite = parseFloat(cliente.limiteCredito || 50);
    const saldoAtual = parseFloat(cliente.saldoDevedor || 0);
    const totalCompra = parseFloat(total);
    const novoSaldo = saldoAtual + totalCompra;

    if (novoSaldo > limite) {
      conn.release();
      return res.status(400).json({
        erro: `Limite de crédito excedido! Limite autorizado: R$ ${limite.toFixed(2)}, Saldo Devedor Atual: R$ ${saldoAtual.toFixed(2)}. Não é possível aprovar a venda de R$ ${totalCompra.toFixed(2)}.`
      });
    }

    await conn.beginTransaction();
    const dataCompra = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // 1. Criar registro da dívida
    const [result] = await conn.execute(
      'INSERT INTO dividas (clienteId, data, total, valorPago, pago) VALUES (?, ?, ?, 0, 0)',
      [clienteId, dataCompra, totalCompra]
    );
    const dividaId = result.insertId;

    for (const item of itens) {
      await conn.execute(
        'INSERT INTO itens_divida (dividaId, produtoId, quantidade, precoUnitario) VALUES (?, ?, ?, ?)',
        [dividaId, item.produtoId, item.quantidade, parseFloat(item.precoUnitario)]
      );
      await conn.execute('UPDATE produtos SET estoque = GREATEST(0, estoque - ?) WHERE id = ?', [item.quantidade, item.produtoId]);
    }

    // 2. Atualizar saldo devedor do cliente
    await conn.execute('UPDATE usuarios SET saldoDevedor = saldoDevedor + ? WHERE id = ?', [totalCompra, clienteId]);

    // 3. Registrar também na tabela de Vendas unificada para o Analytics
    const [resultVenda] = await conn.execute(
      'INSERT INTO vendas (total, formaPagamento, data) VALUES (?, ?, ?)',
      [totalCompra, 'a_prazo', dataCompra]
    );

    for (const item of itens) {
      await conn.execute(
        'INSERT INTO itens_venda (vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (?, ?, ?, ?, ?)',
        [resultVenda.insertId, item.produtoId, item.nome || '', item.quantidade, parseFloat(item.precoUnitario)]
      );
    }

    await conn.commit();

    res.status(201).json({ id: dividaId, novoSaldoDevedor: novoSaldo });
  } catch (error) {
    await conn.rollback();
    console.error('Erro ao registrar compra a prazo:', error);
    res.status(500).json({ erro: 'Erro ao registrar compra a prazo' });
  } finally {
    conn.release();
  }
});

// POST registrar pagamento de dívida a prazo
router.post('/pagamentos', async (req, res) => {
  const { clienteId, dividaId, valor } = req.body;
  if (!clienteId || !dividaId || !valor) return res.status(400).json({ erro: 'Dados incompletos' });
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    const [dividas] = await conn.execute('SELECT * FROM dividas WHERE id = ? AND clienteId = ?', [dividaId, clienteId]);
    if (dividas.length === 0) {
      conn.release();
      return res.status(404).json({ erro: 'Dívida não encontrada' });
    }
    const divida = dividas[0];

    const valorPagoFloat = parseFloat(valor);
    const novoValorPago = parseFloat(divida.valorPago) + valorPagoFloat;
    const pago = novoValorPago >= parseFloat(divida.total) ? 1 : 0;

    await conn.beginTransaction();
    await conn.execute('UPDATE dividas SET valorPago = ?, pago = ? WHERE id = ?', [novoValorPago, pago, dividaId]);
    await conn.execute('UPDATE usuarios SET saldoDevedor = GREATEST(0, saldoDevedor - ?) WHERE id = ?', [valorPagoFloat, clienteId]);
    const dataPagamento = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await conn.execute(
      'INSERT INTO pagamentos_fiado (clienteId, dividaId, valor, data) VALUES (?, ?, ?, ?)',
      [clienteId, dividaId, valorPagoFloat, dataPagamento]
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

// DELETE zerar limite de crédito do cliente
router.delete('/clientes/:id', async (req, res) => {
  try {
    await execute('UPDATE usuarios SET limiteCredito = 0.00 WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao redefinir crédito do cliente' });
  }
});

module.exports = router;

