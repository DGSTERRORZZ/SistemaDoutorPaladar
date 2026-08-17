const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET /api/chat/minhas-mensagens - mensagens da conversa do cliente logado
router.get('/minhas-mensagens', async (req, res) => {
  try {
    const { clienteId } = req.query;
    if (!clienteId) {
      return res.status(400).json({ erro: 'ID do cliente é obrigatório para visualizar mensagens.' });
    }

    const mensagens = await query(
      'SELECT * FROM chat_mensagens WHERE conversaId = ? ORDER BY id ASC',
      [clienteId]
    );

    // Marcar como lidas as mensagens vindas do admin
    await execute("UPDATE chat_mensagens SET lida = 1 WHERE conversaId = ? AND autor_tipo = 'admin'", [clienteId]);

    res.json(mensagens);
  } catch (error) {
    console.error('Erro ao buscar mensagens do cliente:', error);
    res.status(500).json({ erro: 'Erro ao buscar mensagens' });
  }
});

// GET /api/chat/conversas - painel do admin: listar todas as conversas/clientes com mensagens não lidas
router.get('/conversas', async (req, res) => {
  try {
    // Buscar todos os clientes_app que possuem mensagens ou que estejam cadastrados
    const clientesComMensagens = await query(`
      SELECT 
        c.id as clienteId,
        c.nome as clienteNome,
        c.usuario as clienteUsuario,
        c.foto,
        (SELECT mensagem FROM chat_mensagens m WHERE m.conversaId = c.id ORDER BY m.id DESC LIMIT 1) as ultimaMensagem,
        (SELECT data FROM chat_mensagens m WHERE m.conversaId = c.id ORDER BY m.id DESC LIMIT 1) as dataUltimaMensagem,
        (SELECT COUNT(*) FROM chat_mensagens m WHERE m.conversaId = c.id AND m.lida = 0 AND m.autor_tipo = 'cliente') as naoLidas
      FROM clientes_app c
      ORDER BY dataUltimaMensagem DESC, c.nome ASC
    `);

    res.json(clientesComMensagens);
  } catch (error) {
    console.error('Erro ao listar conversas para o admin:', error);
    res.status(500).json({ erro: 'Erro ao carregar lista de conversas' });
  }
});

// GET /api/chat/conversa/:conversaId - admin busca historico completo com um cliente especifico
router.get('/conversa/:conversaId', async (req, res) => {
  try {
    const { conversaId } = req.params;
    const mensagens = await query(
      'SELECT * FROM chat_mensagens WHERE conversaId = ? ORDER BY id ASC',
      [conversaId]
    );

    // Marcar como lidas mensagens do cliente
    await execute("UPDATE chat_mensagens SET lida = 1 WHERE conversaId = ? AND autor_tipo = 'cliente'", [conversaId]);

    res.json(mensagens);
  } catch (error) {
    console.error('Erro ao buscar conversa específica:', error);
    res.status(500).json({ erro: 'Erro ao buscar mensagens' });
  }
});

// POST /api/chat/enviar - cliente ou admin envia mensagem
router.post('/enviar', async (req, res) => {
  const { mensagem, autor_id, autor_nome, autor_tipo, conversaId } = req.body;
  
  if (!mensagem || !mensagem.trim()) {
    return res.status(400).json({ erro: 'Mensagem vazia' });
  }
  if (autor_id === undefined || autor_id === null || !autor_nome || !autor_tipo) {
    return res.status(400).json({ erro: 'Identificação do autor é obrigatória' });
  }

  // Se o autor é cliente, a conversaId é o próprio autor_id. Se é admin, deve informar a conversaId (ID do cliente).
  const targetConversaId = autor_tipo === 'cliente' ? parseInt(autor_id) : parseInt(conversaId || autor_id || 0);

  if (!targetConversaId) {
    return res.status(400).json({ erro: 'Conversa não especificada' });
  }

  try {
    const dataHora = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const result = await execute(
      'INSERT INTO chat_mensagens (conversaId, autor_id, autor_nome, autor_tipo, mensagem, lida, data) VALUES (?, ?, ?, ?, ?, 0, ?)',
      [targetConversaId, autor_id, autor_nome, autor_tipo, mensagem.trim(), dataHora]
    );

    const novaMensagem = {
      id: result.insertId,
      conversaId: targetConversaId,
      autor_id,
      autor_nome,
      autor_tipo,
      mensagem: mensagem.trim(),
      lida: 0,
      data: dataHora
    };

    const io = req.app.get('io');
    if (io) {
      io.emit('nova_mensagem', novaMensagem);
    }

    res.status(201).json(novaMensagem);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ erro: 'Erro ao enviar mensagem no chat' });
  }
});

// PUT /api/chat/marcar-lidas/:conversaId
router.put('/marcar-lidas/:conversaId', async (req, res) => {
  try {
    const { autor_tipo } = req.body; // se admin chamou, marca as do cliente como lidas; se cliente chamou, marca as do admin
    const tipoParaMarcar = autor_tipo === 'admin' ? 'cliente' : 'admin';
    await execute('UPDATE chat_mensagens SET lida = 1 WHERE conversaId = ? AND autor_tipo = ?', [req.params.conversaId, tipoParaMarcar]);
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao marcar mensagens como lidas:', error);
    res.status(500).json({ erro: 'Erro ao atualizar status de leitura' });
  }
});

module.exports = router;
