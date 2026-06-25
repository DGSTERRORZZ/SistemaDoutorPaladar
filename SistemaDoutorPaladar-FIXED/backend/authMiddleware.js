require('dotenv').config();
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'doutor_paladar_secret_key_2026';

function generateToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ erro: 'Token não fornecido' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ erro: 'Token mal formatado' });
  }

  jwt.verify(parts[1], SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ erro: 'Token inválido ou expirado' });
    req.user = decoded;
    req.userId = decoded.id;
    next();
  });
}

function verifyAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user && req.user.tipo === 'admin') {
      next();
    } else {
      res.status(403).json({ erro: 'Acesso restrito ao administrador' });
    }
  });
}

module.exports = { generateToken, verifyToken, verifyAdmin, SECRET };
