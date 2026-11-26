const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, execute } = require('../database');
const { generateToken } = require('../authMiddleware');
const { descriptografar } = require('../securityService');
const { verifyTotp } = require('../twoFactor');

const WEEK = 7 * 86400000;
const DEVICE_COOKIE = 'dp_trusted_2fa';

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  const item = cookies.find(x => x.trim().startsWith(name + '='));
  return item ? item.trim().slice(name.length + 1) : null;
}

function deviceHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sendDeviceCookie(res, token) {
  res.cookie(DEVICE_COOKIE, token, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
    path: '/api/auth', maxAge: WEEK
  });
}

async function isTrusted(req, userId) {
  const token = readCookie(req, DEVICE_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return false;
  const [device] = await query(
    'SELECT id FROM dispositivos_confiaveis_2fa WHERE usuario_id = ? AND token_hash = ? AND expira_em > NOW() LIMIT 1',
    [userId, deviceHash(token)]
  );
  return !!device;
}

async function trustDevice(req, res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await execute(
    'INSERT INTO dispositivos_confiaveis_2fa (usuario_id, token_hash, expira_em) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
    [userId, deviceHash(token)]
  );
  sendDeviceCookie(res, token);
}

async function failedAttempt(userId, current) {
  const attempts = Number(current || 0) + 1;
  await execute(
    'UPDATE usuarios SET tentativas_login = ?, bloqueado_ate = IF(? >= 5, DATE_ADD(NOW(), INTERVAL 15 MINUTE), bloqueado_ate) WHERE id = ?',
    [attempts, attempts, userId]
  );
}

async function loginAdmin(req, res) {
  const { username, password, senha, codigo2FA, lembrarDispositivo7Dias } = req.body || {};
  const pass = password || senha;
  if (typeof username !== 'string' || typeof pass !== 'string' ||
      username.length > 100 || pass.length > 1024 || !username || !pass) {
    return res.status(400).json({ erro: 'Credenciais inválidas' });
  }
  try {
    const [admin] = await query('SELECT * FROM usuarios WHERE username = ? AND tipo = ?', [username, 'administrador']);
    const valid = admin && await bcrypt.compare(pass, admin.senha_hash);
    if (!admin || !valid) {
      if (admin && (!admin.bloqueado_ate || new Date(admin.bloqueado_ate) <= new Date())) {
        await failedAttempt(admin.id, admin.tentativas_login);
      }
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }
    if (admin.bloqueado || (admin.bloqueado_ate && new Date(admin.bloqueado_ate) > new Date())) {
      return res.status(429).json({ erro: 'Conta temporariamente bloqueada' });
    }

    // Nunca usar um marcador associado à conta inteira para dispensar o segundo fator.
    const trusted = await isTrusted(req, admin.id);
    if (!trusted) {
      if (!admin.two_factor_secret) {
        return res.status(403).json({
          erro: 'Segundo fator não configurado. Solicite configuração local ao administrador do servidor.',
          configuracao2FAPendente: true
        });
      }
      if (!codigo2FA) {
        return res.json({ exige2FA: true, mensagem: 'Digite o código do aplicativo autenticador.' });
      }
      let match = null;
      try { match = verifyTotp(descriptografar(admin.two_factor_secret), String(codigo2FA).trim()); }
      catch (_) { match = null; }
      if (!match || (admin.two_factor_last_step != null && match.step <= Number(admin.two_factor_last_step))) {
        await failedAttempt(admin.id, admin.tentativas_login);
        return res.status(401).json({ exige2FA: true, erro: 'Código inválido, expirado ou já utilizado' });
      }
      const updated = await execute(
        'UPDATE usuarios SET two_factor_last_step = ?, tentativas_login = 0, bloqueado_ate = NULL WHERE id = ? AND (two_factor_last_step IS NULL OR two_factor_last_step < ?)',
        [match.step, admin.id, match.step]
      );
      if (!updated.affectedRows) return res.status(401).json({ erro: 'Código já utilizado' });
      if (lembrarDispositivo7Dias === true) await trustDevice(req, res, admin.id);
    } else {
      await execute('UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL WHERE id = ?', [admin.id]);
    }

    res.json({
      token: generateToken({ id: admin.id, nome: admin.nome, tipo: 'admin' }),
      nome: admin.nome,
      tipo: 'admin',
      seguranca: { hashAlgoritmo: 'bcrypt', autenticacao2Etapas: true, dispositivoConfiado7Dias: trusted || lembrarDispositivo7Dias === true }
    });
  } catch (error) {
    console.error('Falha na autenticação:', error.message);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { loginAdmin };
