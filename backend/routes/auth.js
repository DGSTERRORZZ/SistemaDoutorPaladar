const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../authMiddleware');
const router = express.Router();

const ADMIN = { username: 'Pablo', passwordHash: bcrypt.hashSync('admin123', 10) };

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN.username || !bcrypt.compareSync(password, ADMIN.passwordHash)) {
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }
  const token = generateToken(username);
  res.json({ token, usuario: username });
});

module.exports = router;
