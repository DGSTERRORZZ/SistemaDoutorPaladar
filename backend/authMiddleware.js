require('dotenv').config();
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (typeof SECRET !== 'string' || Buffer.byteLength(SECRET) < 32) {
  throw new Error('JWT_SECRET deve conter no mínimo 32 bytes aleatórios');
}

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
  verifyToken(req, res, async () => {
    try {
      const { query } = require('./database');
      const [user] = await query('SELECT tipo, bloqueado FROM usuarios WHERE id = ?', [req.user.id]);
      if (!user || user.tipo !== 'administrador' || user.bloqueado) {
        return res.status(403).json({ erro: 'Acesso restrito ao administrador' });
      }
      next();
    } catch (error) { next(error); }
  });
}

function verifyClienteToken(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user) {
      req.cliente = req.user;
      next();
    } else {
      res.status(403).json({ erro: 'Acesso restrito ao cliente' });
    }
  });
}

module.exports = { generateToken, verifyToken, verifyAdmin, verifyClienteToken, SECRET };
