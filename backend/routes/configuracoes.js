const express = require('express');
const router = express.Router();
const { getDatabase, queryOne, queryAll } = require('../database');
const bcrypt = require('bcryptjs');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

router.get('/', (req, res) => {
  try {
    const rows = queryAll(req.db, 'SELECT * FROM configuracoes');
    const configs = {};
    for (const row of rows) {
      configs[row.chave] = row.valor;
    }
    res.json(configs);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar configurações' });
  }
});

router.put('/:chave', (req, res) => {
  try {
    const { valor } = req.body;
    if (valor === undefined || valor === null) {
      return res.status(400).json({ erro: 'Valor é obrigatório' });
    }
    req.db.run('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)', [req.params.chave, String(valor)]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar configuração' });
  }
});

router.post('/alterar-senha', (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual) return res.status(400).json({ erro: 'Senha atual é obrigatória' });
    if (!novaSenha || novaSenha.length < 4) {
      return res.status(400).json({ erro: 'Nova senha deve ter pelo menos 4 caracteres' });
    }

    const config = queryOne(req.db, "SELECT valor FROM configuracoes WHERE chave = 'senha_hash'");
    const senhaHash = config ? config.valor : bcrypt.hashSync('admin123', 10);

    if (!bcrypt.compareSync(senhaAtual, senhaHash)) {
      return res.status(401).json({ erro: 'Senha atual incorreta' });
    }

    const novoHash = bcrypt.hashSync(novaSenha, 10);
    req.db.run('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)', ['senha_hash', novoHash]);

    res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao alterar senha' });
  }
});

module.exports = router;
