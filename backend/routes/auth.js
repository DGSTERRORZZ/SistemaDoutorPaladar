const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../authMiddleware');
const { getDatabase, queryOne } = require('../database');
const router = express.Router();

const DEFAULT_USER = 'Pablo';
const DEFAULT_HASH = bcrypt.hashSync('admin123', 10);

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ erro: 'Usuário e senha são obrigatórios' });
    }

    if (username !== DEFAULT_USER) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    // Verificar primeiro se há senha customizada no banco
    const db = await getDatabase();
    const config = queryOne(db, "SELECT valor FROM configuracoes WHERE chave = 'senha_hash'");
    const senhaHash = config ? config.valor : DEFAULT_HASH;

    if (!bcrypt.compareSync(password, senhaHash)) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const token = generateToken(username);
    res.json({ token, usuario: username });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

module.exports = router;
