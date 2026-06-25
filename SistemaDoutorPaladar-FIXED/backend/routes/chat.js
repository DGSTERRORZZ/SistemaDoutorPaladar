const express = require('express');
const router = express.Router();
const { query, execute } = require('../database');

// GET /api/chat/mensagens - retorna todas as mensagens (filtragem de privacidade é feita no frontend)
router.get('/mensagens', async (req, res) => {
  try {
    const mensagens = await query('SELECT * FROM chat_mensagens ORDER BY id ASC');
    res.json(mensagens);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ erro: 'Erro ao buscar mensagens' });
  }
});

// GET /api/chat/conversas - lista de conversas únicas (admin)
router.get('/conversas', async (req, res) => {
  try {
    const conversas = await query(`
      SELECT conversa_id, MAX(autor_nome) as nome, MAX(id) as ultimaMensagemId,
             (SELECT mensagem FROM chat_mensagens c2 WHERE c2.conversa_id = c1.conversa_id ORDER BY id DESC LIMIT 1) as ultimaMensagem,
             (SELECT data FROM chat_mensagens c2 WHERE c2.conversa_id = c1.conversa_id ORDER BY id DESC LIMIT 1) as data
      FROM chat_mensagens c1
      WHERE autor_tipo = 'cliente'
      GROUP BY conversa_id
      ORDER BY ultimaMensagemId DESC
    `);
    res.json(conversas);
  } catch (error) {
    console.error('Erro ao buscar conversas:', error);
    res.status(500).json({ erro: 'Erro ao buscar conversas' });
  }
});

// GET /api/chat/conversa/:conversaId - mensagens de uma conversa específica
router.get('/conversa/:conversaId', async (req, res) => {
  try {
    const mensagens = await query('SELECT * FROM chat_mensagens WHERE conversa_id = ? ORDER BY id ASC', [req.params.conversaId]);
    res.json(mensagens);
  } catch (error) {
    console.error('Erro ao buscar conversa:', error);
    res.status(500).json({ erro: 'Erro ao buscar conversa' });
  }
});

// POST /api/chat/enviar - enviar nova mensagem
router.post('/enviar', async (req, res) => {
  const { mensagem, autor_id, autor_nome, autor_tipo, conversa_id } = req.body;
  if (!mensagem || !autor_id || !autor_nome || !autor_tipo) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }
  try {
    const data = new Date().toISOString().slice(0, 19).replace('T', ' ');
    // conversa_id: se cliente, é o próprio autor_id; se admin, deve ser informado (id do cliente)
    const convId = conversa_id || (autor_tipo === 'cliente' ? autor_id : autor_id);

    const result = await execute(
      'INSERT INTO chat_mensagens (mensagem, autor_id, autor_nome, autor_tipo, conversa_id, data) VALUES (?, ?, ?, ?, ?, ?)',
      [mensagem.trim(), autor_id, autor_nome, autor_tipo, convId, data]
    );

    const novaMensagem = { id: result.insertId, mensagem: mensagem.trim(), autor_id, autor_nome, autor_tipo, conversa_id: convId, data };

    const io = req.app.get('io');
    if (io) io.emit('nova_mensagem', novaMensagem);

    res.status(201).json(novaMensagem);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ erro: 'Erro ao enviar mensagem' });
  }
});

module.exports = router;
