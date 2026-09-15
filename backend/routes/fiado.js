const express = require('express');
const router = express.Router();
const { getDatabase, query, queryOne, execute } = require('../database');

// GET todos os clientes com limite / fiado
router.get('/clientes', async (req, res) => {
  try {
    const clientes = await query(`
      SELECT 
        u.id, u.nome, u.username as usuario, u.username, u.telefone, u.turma, u.foto, u.tipo, 
        u.limiteCredito as limite, u.limiteCredito, u.saldoDevedor, u.saldoDevedor as saldo_devedor, 
        u.pontosFidelidade, u.dataCadastro,
        COALESCE((SELECT COUNT(*) FROM pedidos p WHERE p.clienteAppId = u.id), 0) as totalPedidos,
        COALESCE((SELECT SUM(p.total) FROM pedidos p WHERE p.clienteAppId = u.id AND p.status = 'entregue'), 0.00) as totalGasto
      FROM usuarios u 
      ORDER BY u.nome
    `);
    for (const cliente of clientes) {
      cliente.limite = parseFloat(cliente.limite || 50.00);
      cliente.saldoDevedor = parseFloat(cliente.saldoDevedor || 0.00);
      cliente.totalGasto = parseFloat(cliente.totalGasto || 0.00);
      cliente.pontosFidelidade = parseInt(cliente.pontosFidelidade || 0, 10);
      cliente.totalPedidos = parseInt(cliente.totalPedidos || 0, 10);
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

// GET cliente específico por ID com todas as suas dívidas detalhadas
router.get('/clientes/:id', async (req, res) => {
  try {
    const cliente = await queryOne(
      'SELECT id, nome, username as usuario, username, telefone, turma, limiteCredito as limite, saldoDevedor as saldo_devedor, saldoDevedor, pontosFidelidade, totalPedidos, dataCadastro FROM usuarios WHERE id = ?',
      [req.params.id]
    );
    if (!cliente) {
      return res.status(404).json({ erro: 'Cliente não encontrado' });
    }

    cliente.limite = parseFloat(cliente.limite || 50.00);
    cliente.saldo_devedor = parseFloat(cliente.saldo_devedor || 0.00);
    cliente.saldoDevedor = parseFloat(cliente.saldoDevedor || 0.00);

    const dividas = await query('SELECT * FROM dividas WHERE clienteId = ? ORDER BY id DESC', [cliente.id]);
    for (const divida of dividas) {
      divida.total = parseFloat(divida.total);
      divida.valorPago = parseFloat(divida.valorPago || 0);
      divida.pago = !!divida.pago;
      divida.itens = await query('SELECT * FROM itens_divida WHERE dividaId = ?', [divida.id]);
      divida.itens.forEach(i => { i.precoUnitario = parseFloat(i.precoUnitario); });
    }
    cliente.dividas = dividas;

    res.json(cliente);
  } catch (error) {
    console.error('Erro ao buscar cliente fiado:', error);
    res.status(500).json({ erro: 'Erro ao buscar dados do cliente' });
  }
});

// POST cadastrar novo cliente de crédito ou atualizar limite de cliente existente
router.post('/clientes', async (req, res) => {
  const { clienteAppId, nome, turma, telefone, limite } = req.body;

  try {
    const limiteVal = parseFloat(limite !== undefined ? limite : 50.00);

    // Caso 1: ID fornecido diretamente
    if (clienteAppId) {
      const usuarioApp = await queryOne('SELECT * FROM usuarios WHERE id = ?', [clienteAppId]);
      if (!usuarioApp) {
        return res.status(404).json({ erro: 'Usuário não encontrado no sistema.' });
      }
      await execute('UPDATE usuarios SET limiteCredito = ? WHERE id = ?', [limiteVal, clienteAppId]);
      return res.status(200).json({
        id: usuarioApp.id,
        nome: usuarioApp.nome,
        turma: usuarioApp.turma,
        telefone: usuarioApp.telefone,
        limite: limiteVal,
        saldo_devedor: parseFloat(usuarioApp.saldoDevedor || 0)
      });
    }

    // Caso 2: Criar novo cliente ou associar por Nome
    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: 'Nome do cliente é obrigatório.' });
    }

    const nomeLimpo = nome.trim();
    const usuarioExistente = await queryOne('SELECT * FROM usuarios WHERE LOWER(nome) = ?', [nomeLimpo.toLowerCase()]);

    if (usuarioExistente) {
      await execute('UPDATE usuarios SET limiteCredito = ?, turma = COALESCE(?, turma) WHERE id = ?', [
        limiteVal,
        turma || null,
        usuarioExistente.id
      ]);
      return res.status(200).json({
        id: usuarioExistente.id,
        nome: usuarioExistente.nome,
        turma: turma || usuarioExistente.turma,
        telefone: usuarioExistente.telefone,
        limite: limiteVal,
        saldo_devedor: parseFloat(usuarioExistente.saldoDevedor || 0)
      });
    }

    // Gerar username único e seguro
    const usernameBase = nomeLimpo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '.');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const usernameFinal = `${usernameBase}.${randomSuffix}`;
    const dataCadastro = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const result = await execute(
      'INSERT INTO usuarios (nome, username, senha_hash, tipo, turma, telefone, limiteCredito, saldoDevedor, pontosFidelidade, totalPedidos, dataCadastro) VALUES (?, ?, ?, "cliente", ?, ?, ?, 0.00, 0, 0, ?)',
      [
        nomeLimpo,
        usernameFinal,
        '123456',
        turma || '',
        telefone || null,
        limiteVal,
        dataCadastro
      ]
    );

    res.status(201).json({
      id: result.insertId,
      nome: nomeLimpo,
      usuario: usernameFinal,
      turma: turma || '',
      telefone: telefone || '',
      limite: limiteVal,
      saldo_devedor: 0.00
    });
  } catch (error) {
    console.error('Erro ao salvar cliente fiado:', error);
    res.status(500).json({ erro: 'Erro ao salvar conta de crédito' });
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

