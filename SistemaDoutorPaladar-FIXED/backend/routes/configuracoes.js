const express = require('express');
const router = express.Router();
const { query, execute, queryOne } = require('../database');
const bcrypt = require('bcryptjs');

// GET todas as configurações
router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM configuracoes');
    const configs = {};
    rows.forEach(row => { configs[row.chave] = row.valor; });
    res.json(configs);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ erro: 'Erro ao buscar configurações' });
  }
});

// PUT atualizar uma configuração
router.put('/:chave', async (req, res) => {
  const { valor } = req.body;
  if (valor === undefined) return res.status(400).json({ erro: 'Valor obrigatório' });
  try {
    await execute(
      'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?',
      [req.params.chave, String(valor), String(valor)]
    );
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    res.status(500).json({ erro: 'Erro ao atualizar configuração' });
  }
});

// PUT atualizar várias configurações de uma vez
router.put('/', async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [chave, valor] of entries) {
      await execute(
        'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?',
        [chave, String(valor), String(valor)]
      );
    }
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({ erro: 'Erro ao atualizar configurações' });
  }
});

// POST alterar senha do admin
router.post('/alterar-senha', async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha) return res.status(400).json({ erro: 'Dados incompletos' });
  try {
    const admin = await queryOne('SELECT * FROM admin_users WHERE username = ?', ['admin']);
    if (!admin) return res.status(404).json({ erro: 'Administrador não encontrado' });

    const senhaCorreta = bcrypt.compareSync(senhaAtual, admin.senha_hash);
    if (!senhaCorreta) return res.status(401).json({ erro: 'Senha atual incorreta' });

    const novoHash = bcrypt.hashSync(novaSenha, 10);
    await execute('UPDATE admin_users SET senha_hash = ? WHERE username = ?', [novoHash, 'admin']);
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ erro: 'Erro ao alterar senha' });
  }
});

module.exports = router;
