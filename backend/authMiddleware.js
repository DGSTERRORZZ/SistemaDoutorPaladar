const jwt = require('jsonwebtoken');
const SECRET = 'doutor-paladar-secret-2024';

function generateToken(user) {
  return jwt.sign({ user }, SECRET, { expiresIn: '4h' });
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ erro: 'Token não fornecido' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2) return res.status(401).json({ erro: 'Token mal formatado' });

  const [scheme, token] = parts;
  if (scheme !== 'Bearer') return res.status(401).json({ erro: 'Token mal formatado' });

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ erro: 'Token inválido' });
    req.userId = decoded.user;
    next();
  });
}

module.exports = { generateToken, verifyToken, SECRET };
