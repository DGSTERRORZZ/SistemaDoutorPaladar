const express = require('express');
const router = express.Router();
const { query, queryOne, execute, getDatabase } = require('../database');
const { verifyClienteToken, verifyAdmin } = require('../authMiddleware');

// GET listar disponibilidades de agendamento (Cliente vê apenas futuros não bloqueados; Admin pode filtrar por data)
router.get('/', async (req, res) => {
  try {
    const { data, admin } = req.query;
    let sql = 'SELECT * FROM agendamentos';
    const params = [];
    const conditions = [];

    if (data) {
      conditions.push('data = ?');
      params.push(data);
    }

    if (!admin) {
      // Cliente visualiza datas a partir de hoje e slots não bloqueados
      conditions.push('bloqueado = 0');
      conditions.push('(data >= DATE_SUB(CURDATE(), INTERVAL 1 DAY))');
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY data ASC, horario ASC';

    const agendamentos = await query(sql, params);
    
    // Mapear vagas restantes e status
    const resultado = agendamentos.map(ag => {
      const vagasTotais = ag.vagasTotais || 50;
      const vagasOcupadas = ag.vagasOcupadas || 0;
      const vagasDisponiveis = Math.max(0, vagasTotais - vagasOcupadas);
      
      // Formatar data em string YYYY-MM-DD se vier como objeto Date
      let dataStr = ag.data;
      if (ag.data instanceof Date) {
        dataStr = ag.data.toISOString().slice(0, 10);
      } else if (typeof ag.data === 'string') {
        dataStr = ag.data.slice(0, 10);
      }

      const statusCalculado = ag.bloqueado ? 'bloqueado' : (vagasDisponiveis <= 0 ? 'esgotado' : 'disponivel');

      return {
        ...ag,
        data: dataStr,
        vagasTotais,
        vagasOcupadas,
        vagasDisponiveis,
        status: statusCalculado,
        esgotado: vagasDisponiveis <= 0,
        preco: parseFloat(ag.preco || 0)
      };
    });

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    res.status(500).json({ erro: 'Erro ao listar agendamentos' });
  }
});

// GET listar reservas do cliente autenticado
router.get('/meus-agendamentos', verifyClienteToken, async (req, res) => {
  try {
    const clienteAppId = req.cliente.id;
    const reservas = await query(
      `SELECT ca.*, a.data, a.horario, a.pratoDoDia, a.preco 
       FROM cliente_agendamentos ca
       JOIN agendamentos a ON ca.agendamentoId = a.id
       WHERE ca.clienteAppId = ?
       ORDER BY a.data DESC, a.horario DESC`,
      [clienteAppId]
    );

    const formatadas = reservas.map(r => {
      let dataStr = r.data;
      if (r.data instanceof Date) dataStr = r.data.toISOString().slice(0, 10);
      else if (typeof r.data === 'string') dataStr = r.data.slice(0, 10);

      return {
        ...r,
        data: dataStr,
        preco: parseFloat(r.preco || 0)
      };
    });

    res.json(formatadas);
  } catch (error) {
    console.error('Erro ao listar meus agendamentos:', error);
    res.status(500).json({ erro: 'Erro ao buscar agendamentos do cliente' });
  }
});

// GET participantes de um agendamento específico (Admin)
router.get('/:id/participantes', verifyAdmin, async (req, res) => {
  try {
    const participantes = await query(
      `SELECT ca.*, c.usuario, c.telefone 
       FROM cliente_agendamentos ca
       LEFT JOIN clientes_app c ON ca.clienteAppId = c.id
       WHERE ca.agendamentoId = ? AND ca.status != 'cancelado'
       ORDER BY ca.dataCriacao ASC`,
      [req.params.id]
    );
    res.json(participantes);
  } catch (error) {
    console.error('Erro ao buscar participantes:', error);
    res.status(500).json({ erro: 'Erro ao listar participantes' });
  }
});

// POST criar disponibilidade de agendamento (Admin)
router.post('/', verifyAdmin, async (req, res) => {
  const { data, horario, pratoDoDia, vagasTotais, preco } = req.body;
  if (!data || !horario || !pratoDoDia) {
    return res.status(400).json({ erro: 'Data, horário e prato do dia são obrigatórios' });
  }

  try {
    const dataCriacao = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const vagas = parseInt(vagasTotais || 50, 10);
    const precoVal = parseFloat(preco || 0);

    const result = await execute(
      'INSERT INTO agendamentos (data, horario, pratoDoDia, vagasTotais, vagasOcupadas, preco, bloqueado, dataCriacao) VALUES (?, ?, ?, ?, 0, ?, 0, ?)',
      [data, horario, pratoDoDia, vagas, precoVal, dataCriacao]
    );

    res.status(201).json({
      id: result.insertId,
      data,
      horario,
      pratoDoDia,
      vagasTotais: vagas,
      vagasOcupadas: 0,
      vagasDisponiveis: vagas,
      preco: precoVal
    });
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ erro: 'Erro ao criar agendamento' });
  }
});

// POST realizar reserva de agendamento (Cliente ou Guest)
router.post('/reservar', async (req, res) => {
  const { agendamentoId, clienteAppId, nomeCliente, telefone, turma } = req.body;
  if (!agendamentoId || !nomeCliente) {
    return res.status(400).json({ erro: 'Informe o agendamento e seu nome' });
  }

  const pool = await getDatabase();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Buscar slot com LOCK (FOR UPDATE)
    const [rows] = await conn.execute('SELECT * FROM agendamentos WHERE id = ? FOR UPDATE', [agendamentoId]);
    const ag = rows[0];

    if (!ag || ag.bloqueado) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ erro: 'Horário indisponível ou bloqueado' });
    }

    // Verificar data passada (datas anteriores a hoje)
    let agDataStr = ag.data;
    if (ag.data instanceof Date) agDataStr = ag.data.toISOString().slice(0, 10);
    else if (typeof ag.data === 'string') agDataStr = ag.data.slice(0, 10);

    const hojeYMD = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    if (agDataStr < hojeYMD) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ erro: 'Este agendamento pertence a uma data passada!' });
    }

    // Verificar duplicidade de reserva ativa pelo mesmo cliente para este slot
    if (clienteAppId) {
      const [duplicadas] = await conn.execute(
        "SELECT id FROM cliente_agendamentos WHERE agendamentoId = ? AND clienteAppId = ? AND status = 'agendado'",
        [agendamentoId, clienteAppId]
      );
      if (duplicadas.length > 0) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ erro: 'Você já possui uma reserva ativa para este horário!' });
      }
    }

    // Controle atômico de vagas
    if (ag.vagasOcupadas >= ag.vagasTotais) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ erro: 'Todas as vagas para este horário já foram preenchidas!' });
    }

    // Incrementar vagas ocupadas
    await conn.execute('UPDATE agendamentos SET vagasOcupadas = vagasOcupadas + 1 WHERE id = ?', [agendamentoId]);

    const dataCriacao = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Criar registro na tabela cliente_agendamentos
    const [reservaResult] = await conn.execute(
      'INSERT INTO cliente_agendamentos (agendamentoId, clienteAppId, nomeCliente, telefone, turma, status, dataCriacao) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [agendamentoId, clienteAppId || null, nomeCliente, telefone || '', turma || '', 'agendado', dataCriacao]
    );

    // Criar também pedido correspondente no sistema de pedidos
    const total = parseFloat(ag.preco || 0);
    const [pedidoResult] = await conn.execute(
      'INSERT INTO pedidos (clienteAppId, nomeCliente, turma, mesa, formaPagamento, horarioRetirada, total, status, data, observacao, canal) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)',
      [
        clienteAppId || null,
        nomeCliente,
        turma || '',
        'agendamento',
        ag.horario,
        total,
        'confirmado',
        dataCriacao,
        `Reserva de Agendamento: ${ag.pratoDoDia} | Data: ${agDataStr}`,
        'agendamento'
      ]
    );

    await conn.commit();
    conn.release();

    const io = req.app.get('io');
    if (io) {
      io.emit('novo_agendamento', {
        agendamentoId,
        reservaId: reservaResult.insertId,
        nomeCliente,
        prato: ag.pratoDoDia,
        data: agDataStr,
        horario: ag.horario
      });
      io.emit('novo_pedido', {
        id: pedidoResult.insertId,
        nomeCliente,
        total,
        status: 'confirmado'
      });
    }

    res.status(201).json({
      sucesso: true,
      reservaId: reservaResult.insertId,
      pedidoId: pedidoResult.insertId,
      prato: ag.pratoDoDia,
      data: agDataStr,
      horario: ag.horario
    });
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error('Erro ao realizar reserva de agendamento:', error);
    res.status(500).json({ erro: 'Erro ao processar reserva' });
  }
});

// POST cancelar agendamento (Cliente ou Admin)
router.post('/cancelar/:reservaId', async (req, res) => {
  const { reservaId } = req.params;
  const authHeader = req.headers.authorization;
  let clienteIdDoToken = null;
  let isAdmin = false;

  if (authHeader) {
    try {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const { SECRET } = require('../authMiddleware');
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(parts[1], SECRET);
        if (decoded.tipo === 'admin') isAdmin = true;
        else clienteIdDoToken = decoded.id;
      }
    } catch(e) {}
  }

  const pool = await getDatabase();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute('SELECT * FROM cliente_agendamentos WHERE id = ? FOR UPDATE', [reservaId]);
    const reserva = rows[0];

    if (!reserva || reserva.status === 'cancelado') {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ erro: 'Reserva não encontrada ou já cancelada' });
    }

    // Se for cliente, garantir que a reserva pertence a ele
    if (!isAdmin && clienteIdDoToken && reserva.clienteAppId && parseInt(reserva.clienteAppId) !== parseInt(clienteIdDoToken)) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({ erro: 'Você não tem permissão para cancelar este agendamento' });
    }

    // Atualizar reserva para cancelada
    await conn.execute("UPDATE cliente_agendamentos SET status = 'cancelado' WHERE id = ?", [reservaId]);

    // Decrementar vagas ocupadas do slot
    await conn.execute('UPDATE agendamentos SET vagasOcupadas = GREATEST(0, vagasOcupadas - 1) WHERE id = ?', [reserva.agendamentoId]);

    await conn.commit();
    conn.release();

    res.json({ sucesso: true, mensagem: 'Reserva cancelada com sucesso' });
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error('Erro ao cancelar agendamento:', error);
    res.status(500).json({ erro: 'Erro ao cancelar agendamento' });
  }
});

// PUT atualizar disponibilidade de agendamento (Admin)
router.put('/:id', verifyAdmin, async (req, res) => {
  const { data, horario, pratoDoDia, vagasTotais, preco, bloqueado } = req.body;
  try {
    const ag = await queryOne('SELECT * FROM agendamentos WHERE id = ?', [req.params.id]);
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' });

    await execute(
      'UPDATE agendamentos SET data = ?, horario = ?, pratoDoDia = ?, vagasTotais = ?, preco = ?, bloqueado = ? WHERE id = ?',
      [
        data || ag.data,
        horario || ag.horario,
        pratoDoDia !== undefined ? pratoDoDia : ag.pratoDoDia,
        vagasTotais !== undefined ? parseInt(vagasTotais, 10) : ag.vagasTotais,
        preco !== undefined ? parseFloat(preco) : parseFloat(ag.preco || 0),
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

// DELETE remover agendamento (Admin)
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM agendamentos WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    console.error('Erro ao remover agendamento:', error);
    res.status(500).json({ erro: 'Erro ao remover agendamento' });
  }
});

module.exports = router;
