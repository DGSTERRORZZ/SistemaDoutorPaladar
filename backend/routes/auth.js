const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../authMiddleware');
const { getDatabase } = require('../database');
const router = express.Router();

// Senha padrão (usada apenas se não existir hash no banco)
const SENHA_PADRAO = 'admin123';

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validar campos obrigatórios
    if (!username || !password) {
      return res.status(400).json({ erro: 'Usuário e senha são obrigatórios' });
    }

    // Verificar se é o usuário Pablo
    if (username !== 'Pablo') {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    // Buscar senha salva no banco (se existir)
    const db = await getDatabase();
    const stmt = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'senha_hash'");
    
    let senhaCorreta = false;
    
    if (stmt.step()) {
      // Existe hash no banco — usar ele
      const senhaHash = stmt.getAsObject().valor;
      senhaCorreta = bcrypt.compareSync(password, senhaHash);
    } else {
      // Não existe hash no banco — usar senha padrão
      const hashPadrao = bcrypt.hashSync(SENHA_PADRAO, 10);
      senhaCorreta = bcrypt.compareSync(password, hashPadrao);
    }
    stmt.free();

    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    // Gerar token JWT
    const token = generateToken(username);
    res.json({ token, usuario: username });

  } catch (erro) {
    console.error('Erro no login:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

module.exports = router;