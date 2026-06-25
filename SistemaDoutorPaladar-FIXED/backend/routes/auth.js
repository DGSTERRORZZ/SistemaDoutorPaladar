const bcrypt = require('bcryptjs');
const { query } = require('../database');
const { generateToken } = require('../authMiddleware');

async function loginAdmin(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ erro: 'Usuário e senha são obrigatórios' });
  }
  try {
    const admins = await query('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (admins.length === 0) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }
    const admin = admins[0];
    const senhaValida = bcrypt.compareSync(password, admin.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }
    const token = generateToken({ id: admin.id, nome: admin.nome, tipo: 'admin' });
    res.json({ token, nome: admin.nome, tipo: 'admin' });
  } catch (error) {
    console.error('Erro no login admin:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { loginAdmin };
