const express = require('express');
const router = express.Router();
const { getDatabase, queryOne, queryAll } = require('../database');
const { verifyToken } = require('../authMiddleware');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

// GET todos os pedidos (admin) ou filtrar por nome (cliente)
router.get('/', (req, res) => {
  try {
    const { nome, status, data } = req.query;
    let query = 'SELECT * FROM pedidos WHERE 1=1';
    const params = [];

    if (nome) { query += ' AND nomeCliente LIKE ?'; params.push(`%${nome}%`); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (data) { query += ' AND date(data) = date(?)'; params.push(data); }

    query += ' ORDER BY id DESC';

    const pedidos = queryAll(req.db, query, params);
    for (const pedido of pedidos) {
      pedido.itens = queryAll(req.db, 'SELECT * FROM itens_pedido WHERE pedidoId = ?', [pedido.id]);
    }
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

// POST criar pedido (público)
router.post('/', (req, res) => {
  try {
    const { nomeCliente, turma, horarioRetirada, itens, total } = req.body;

    if (!nomeCliente || nomeCliente.trim().length < 3) {
      return res.status(400).json({ erro: 'Nome do cliente é obrigatório (mínimo 3 caracteres)' });
    }
    if (!horarioRetirada) return res.status(400).json({ erro: 'Horário de retirada é obrigatório' });
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: 'Adicione pelo menos um item ao pedido' });
    }
    if (!total || total <= 0) return res.status(400).json({ erro: 'Total do pedido inválido' });

    // Validar se o horário existe e não está bloqueado
    const agendamento = queryOne(req.db, 'SELECT * FROM agendamentos WHERE horarioInicio = ?', [horarioRetirada]);
    if (!agendamento) return res.status(400).json({ erro: 'Horário de retirada inválido' });
    if (agendamento.bloqueado) return res.status(400).json({ erro: 'Este horário está bloqueado' });

    // Verificar vagas
    const pedidosHoje = queryOne(req.db,
      "SELECT COUNT(*) as qtd FROM pedidos WHERE horarioRetirada = ? AND date(data) = date('now') AND status != 'recusado'",
      [horarioRetirada]);
    if (pedidosHoje && pedidosHoje.qtd >= agendamento.limitePedidos) {
      return res.status(400).json({ erro: 'Horário lotado, escolha outro' });
    }

    req.db.run('INSERT INTO pedidos (nomeCliente, turma, horarioRetirada, total, status, data) VALUES (?, ?, ?, ?, ?, ?)',
      [nomeCliente.trim(), turma || '', horarioRetirada, total, 'pendente', new Date().toISOString()]);

    const pedidoId = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    const insertItem = req.db.prepare('INSERT INTO itens_pedido (pedidoId, produtoId, quantidade, precoUnitario) VALUES (?, ?, ?, ?)');
    for (const item of itens) {
      insertItem.run([pedidoId, item.produtoId, item.quantidade, item.precoUnitario]);
    }
    insertItem.free();

    res.status(201).json({ id: pedidoId, nomeCliente, status: 'pendente' });
  } catch (err) {
    console.error('Erro ao criar pedido:', err);
    res.status(500).json({ erro: 'Erro ao criar pedido' });
  }
});

// PUT atualizar status do pedido (admin - protegido)
router.put('/:id/status', verifyToken, (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ erro: 'Status é obrigatório' });

    const statusValidos = ['pendente', 'confirmado', 'preparando', 'pronto', 'entregue', 'recusado'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Use: ${statusValidos.join(', ')}` });
    }

    const pedido = queryOne(req.db, 'SELECT * FROM pedidos WHERE id = ?', [Number(req.params.id)]);
    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

    if (pedido.status === 'entregue' || pedido.status === 'recusado') {
      return res.status(400).json({ erro: `Pedido já está ${pedido.status}. Não pode ser alterado.` });
    }

    req.db.run('UPDATE pedidos SET status = ? WHERE id = ?', [status, Number(req.params.id)]);

    // Se CONFIRMADO → deduzir estoque com verificação
    if (status === 'confirmado' && pedido.status !== 'confirmado') {
      const itens = queryAll(req.db, 'SELECT * FROM itens_pedido WHERE pedidoId = ?', [Number(req.params.id)]);

      // Verificar estoque antes de deduzir
      for (const item of itens) {
        const produto = queryOne(req.db, 'SELECT estoque FROM produtos WHERE id = ?', [item.produtoId]);
        if (!produto || produto.estoque < item.quantidade) {
          // Reverter status
          req.db.run('UPDATE pedidos SET status = ? WHERE id = ?', [pedido.status, Number(req.params.id)]);
          return res.status(400).json({ erro: `Estoque insuficiente para o produto ID ${item.produtoId}` });
        }
      }

      // Deduzir estoque
      for (const item of itens) {
        req.db.run('UPDATE produtos SET estoque = estoque - ? WHERE id = ?', [item.quantidade, item.produtoId]);
      }
    }

    res.json({ sucesso: true, status });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar status' });
  }
});

// GET buscar pedido por nome do cliente (público)
router.get('/buscar/:nome', (req, res) => {
  try {
    if (!req.params.nome || req.params.nome.trim().length < 3) {
      return res.status(400).json({ erro: 'Nome deve ter pelo menos 3 caracteres' });
    }

    const pedidos = queryAll(req.db, 'SELECT * FROM pedidos WHERE nomeCliente LIKE ? ORDER BY id DESC', [`%${req.params.nome.trim()}%`]);
    for (const pedido of pedidos) {
      pedido.itens = queryAll(req.db, 'SELECT * FROM itens_pedido WHERE pedidoId = ?', [pedido.id]);
    }
    res.json(pedidos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

module.exports = router;
