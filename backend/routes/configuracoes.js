const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');
const bcrypt = require('bcryptjs');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

// GET todas as configurações
router.get('/', (req, res) => {
  const stmt = req.db.prepare('SELECT * FROM configuracoes');
  const configs = {};
  while (stmt.step()) {
    const row = stmt.getAsObject();
    configs[row.chave] = row.valor;
  }
  stmt.free();
  res.json(configs);
});

// PUT atualizar uma configuração
router.put('/:chave', (req, res) => {
  const { valor } = req.body;
  if (valor === undefined || valor === null) {
    return res.status(400).json({ erro: 'Valor é obrigatório' });
  }
  req.db.run('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)', [req.params.chave, valor]);
  res.json({ sucesso: true });
});

// POST alterar senha
router.post('/alterar-senha', (req, res) => {
  const { senhaAtual, novaSenha } = req.body;

  if (!senhaAtual) {
    return res.status(400).json({ erro: 'Senha atual é obrigatória' });
  }
  if (!novaSenha || novaSenha.length < 4) {
    return res.status(400).json({ erro: 'Nova senha deve ter pelo menos 4 caracteres' });
  }

  // Buscar hash da senha no banco (se existir)
  const stmt = req.db.prepare("SELECT valor FROM configuracoes WHERE chave = 'senha_hash'");
  let senhaHash = null;
  if (stmt.step()) senhaHash = stmt.getAsObject().valor;
  stmt.free();

  // Se não tem hash salvo, usa a senha padrão
  if (!senhaHash) {
    senhaHash = bcrypt.hashSync('admin123', 10);
  }

  // Verificar senha atual
  if (!bcrypt.compareSync(senhaAtual, senhaHash)) {
    return res.status(401).json({ erro: 'Senha atual incorreta' });
  }

  // Gerar novo hash e salvar
  const novoHash = bcrypt.hashSync(novaSenha, 10);
  req.db.run('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)', ['senha_hash', novoHash]);

  res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });
});

module.exports = router;