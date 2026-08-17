const express = require('express');
const router = express.Router();
const { getDatabase, query, queryOne, execute } = require('../database');

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

// POST criar ou vincular conta de crédito a prazo para um usuário autenticado existente (Item 19)
router.post('/clientes', async (req, res) => {
  const { clienteAppId, limite } = req.body;
  if (!clienteAppId) {
    return res.status(400).json({ erro: 'Selecione um cliente autenticado existente no sistema.' });
  }

  try {
    const usuarioApp = await queryOne('SELECT * FROM clientes_app WHERE id = ?', [clienteAppId]);
    if (!usuarioApp) {
      return res.status(404).json({ erro: 'Usuário cadastrado não encontrado no sistema.' });
    }

    // Verificar se já existe vínculo
    const existente = await queryOne('SELECT id FROM clientes_fiado WHERE clienteAppId = ?', [clienteAppId]);
    if (existente) {
      return res.status(400).json({ erro: 'Este cliente já possui uma conta de crédito ativa.' });
    }

    const dataCadastro = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const limiteVal = parseFloat(limite || usuarioApp.limiteCredito || 50.00);

    const result = await execute(
      'INSERT INTO clientes_fiado (clienteAppId, nome, turma, telefone, limite, saldoDevedor, dataCadastro) VALUES (?, ?, ?, ?, ?, 0.00, ?)',
      [clienteAppId, usuarioApp.nome, usuarioApp.turma || '', usuarioApp.telefone || '', limiteVal, dataCadastro]
    );

    res.status(201).json({
      id: result.insertId,
      clienteAppId,
      nome: usuarioApp.nome,
      turma: usuarioApp.turma,
      telefone: usuarioApp.telefone,
      limite: limiteVal,
      saldoDevedor: 0.00
    });
  } catch (error) {
    console.error('Erro ao criar conta de crédito:', error);
    res.status(500).json({ erro: 'Erro ao criar conta de crédito' });
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
    const [clientes] = await conn.execute('SELECT * FROM clientes_fiado WHERE id = ?', [clienteId]);
    if (clientes.length === 0) {
      conn.release();
      return res.status(404).json({ erro: 'Cliente de crédito não encontrado' });
    }

    const cliente = clientes[0];
    const limite = parseFloat(cliente.limite || 50);
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
    await conn.execute('UPDATE clientes_fiado SET saldoDevedor = saldoDevedor + ? WHERE id = ?', [totalCompra, clienteId]);

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
    await conn.execute('UPDATE clientes_fiado SET saldoDevedor = GREATEST(0, saldoDevedor - ?) WHERE id = ?', [valorPagoFloat, clienteId]);
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

// DELETE remover cliente de crédito
router.delete('/clientes/:id', async (req, res) => {
  try {
    await execute('DELETE FROM clientes_fiado WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao remover cliente' });
  }
});

module.exports = router;
