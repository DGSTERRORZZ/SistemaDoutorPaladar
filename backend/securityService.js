const crypto = require('crypto');
const net = require('net');
const { query, execute } = require('./database');

function getEncryptionKey() {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('Configure ENCRYPTION_KEY com 32 bytes aleatórios em base64');
  return key;
}

// AES-256-GCM fornece confidencialidade E autenticação contra adulteração.
function criptografar(dado) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const texto = typeof dado === 'string' ? dado : JSON.stringify(dado);
  const encrypted = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return ['v2', iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}

function descriptografar(pacote) {
  if (typeof pacote !== 'string' || !/^v2:[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]*$/i.test(pacote)) {
    throw new Error('Formato de relatório criptografado inválido');
  }
  const [, ivHex, tagHex, dataHex] = pacote.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const texto = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  try { return JSON.parse(texto); } catch { return texto; }
}

function normalizarIp(value) {
  const ip = String(value || '').trim();
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip === '::1' ? '127.0.0.1' : ip;
  return net.isIP(normalized) ? normalized : null;
}

function ipNoCidr(ip, cidr) {
  const [address, prefixText] = String(cidr).split('/');
  const family = net.isIP(address);
  if (!family || family !== net.isIP(ip)) return false;
  const prefix = prefixText === undefined ? (family === 4 ? 32 : 128) : Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > (family === 4 ? 32 : 128)) return false;
  const list = new net.BlockList();
  list.addSubnet(address, prefix, family === 4 ? 'ipv4' : 'ipv6');
  return list.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

function identificarPaisPorIp(ip) {
  const normalized = normalizarIp(ip);
  if (!normalized) return 'XX';
  if (['127.0.0.1', '::1'].includes(normalized)) return 'LOCAL';
  // Somente CIDRs explicitamente cadastrados; nunca inferir país por prefixos arbitrários.
  let ranges;
  try { ranges = JSON.parse(process.env.GEOIP_COUNTRY_CIDRS || '{}'); } catch { return 'XX'; }
  for (const [country, cidrs] of Object.entries(ranges)) {
    if (!/^[A-Z]{2}$/.test(country) || !Array.isArray(cidrs)) continue;
    if (cidrs.some(range => { try { return ipNoCidr(normalized, range); } catch { return false; } })) return country;
  }
  return 'XX';
}

function paisBloqueado(country) {
  if (!/^[A-Z]{2}$/.test(String(country || ''))) return false;
  return (process.env.BLOCKED_COUNTRIES || '').split(',').map(x => x.trim().toUpperCase()).includes(country);
}

async function registrarBloqueio(tipo, ip, detalhe) {
  try {
    await execute('INSERT INTO logs_seguranca (tipo, ip, detalhes, bloqueado) VALUES (?, ?, ?, 1)', [tipo, ip, detalhe]);
  } catch (error) {
    console.error('Falha ao registrar bloqueio:', error.message);
  }
}

async function verificarBlacklist(req, res, next) {
  const ip = normalizarIp(req.ip || (req.socket && req.socket.remoteAddress));
  if (!ip) return res.status(403).json({ erro: 'Endereço de origem inválido' });
  req.clientIp = ip;
  try {
    const [entry] = await query(
      'SELECT id FROM ip_blacklist WHERE ip = ? AND (expira_em IS NULL OR expira_em > NOW()) LIMIT 1',
      [ip]
    );
    if (entry) {
      await registrarBloqueio('Blacklist IP', ip, 'Origem bloqueada por regra de IP');
      return res.status(403).json({ erro: 'Acesso bloqueado pela política de segurança' });
    }
    req.clientCountry = identificarPaisPorIp(ip);
    if (paisBloqueado(req.clientCountry)) {
      await registrarBloqueio('Bloqueio por país', ip, req.clientCountry);
      return res.status(403).json({ erro: 'Acesso bloqueado pela política geográfica' });
    }
    return next();
  } catch (error) {
    console.error('Falha ao consultar lista de bloqueios:', error.message);
    return res.status(503).json({ erro: 'Verificação de segurança temporariamente indisponível' });
  }
}

const ALCADAS = Object.freeze({ cliente: 0, atendente: 1, supervisor: 2, gerente: 3, administrador: 4 });
function verificarAlcada(cargoMinimo = 'atendente', maxDescontoPermitido = null) {
  const minimo = ALCADAS[String(cargoMinimo).toLowerCase()];
  if (minimo === undefined) throw new Error('Alçada desconhecida');
  return async function checkAlcada(req, res, next) {
    if (!req.user || !req.user.id) return res.status(401).json({ erro: 'Autenticação necessária' });
    try {
      const [user] = await query('SELECT tipo, cargo, alçada_max_desconto FROM usuarios WHERE id = ?', [req.user.id]);
      if (!user) return res.status(403).json({ erro: 'Acesso negado' });
      const role = user.tipo === 'administrador'
        ? (user.cargo && user.cargo !== 'atendente' ? String(user.cargo).toLowerCase() : 'administrador')
        : 'cliente';
      if (ALCADAS[role] === undefined || ALCADAS[role] < minimo) {
        return res.status(403).json({ erro: 'Alçada insuficiente para esta ação' });
      }
      if (maxDescontoPermitido !== null) {
        const desconto = Number(req.body && (req.body.descontoPorcentagem ?? req.body.desconto ?? 0));
        const limite = Number(user.alçada_max_desconto ?? 0);
        if (!Number.isFinite(desconto) || desconto < 0 || desconto > 100 || desconto > limite) {
          return res.status(403).json({ erro: 'Desconto acima da alçada permitida' });
        }
      }
      req.user.cargo = role;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  criptografar, descriptografar, normalizarIp, ipNoCidr, identificarPaisPorIp,
  paisBloqueado, verificarBlacklist, verificarAlcada, ALCADAS
};
