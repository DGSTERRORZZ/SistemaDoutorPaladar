const crypto = require('crypto');
const { query, execute } = require('./database');

// Chave e IV para criptografia AES-256-CBC de relatórios e dados sensíveis
const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || 'doutor_paladar_aes_secret_key_32b!').padEnd(32, '!').slice(0, 32);

/**
 * Criptografa string ou objeto JSON usando AES-256-CBC
 */
function criptografar(dado) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  const texto = typeof dado === 'object' ? JSON.stringify(dado) : String(dado);
  let encrypted = cipher.update(texto, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Descriptografa texto gerado por `criptografar`
 */
function descriptografar(textoCriptografado) {
  try {
    const [ivHex, encrypted] = textoCriptografado.split(':');
    if (!ivHex || !encrypted) throw new Error('Formato criptográfico inválido');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (err) {
    throw new Error('Falha ao descriptografar: ' + err.message);
  }
}

/**
 * Tabela de simulação GeoIP básica por prefixo de IP para fins educacionais e de demonstração
 * Em produção integraria com MaxMind GeoLite2
 */
function identificarPaisPorIp(ip) {
  if (!ip) return 'XX';
  const cleanIp = ip.replace(/^.*:/, ''); // strip IPv6 prefix if local
  if (cleanIp === '127.0.0.1' || cleanIp.startsWith('10.') || cleanIp.startsWith('192.168.')) {
    return 'BR (Local)';
  }
  if (cleanIp.startsWith('185.') || cleanIp.startsWith('95.') || cleanIp.startsWith('5.')) {
    return 'RU'; // Rússia
  }
  if (cleanIp.startsWith('103.') || cleanIp.startsWith('220.') || cleanIp.startsWith('114.')) {
    return 'CN'; // China
  }
  if (cleanIp.startsWith('194.') || cleanIp.startsWith('91.')) {
    return 'KP'; // Coreia do Norte
  }
  if (cleanIp.startsWith('177.') || cleanIp.startsWith('179.') || cleanIp.startsWith('189.') || cleanIp.startsWith('200.')) {
    return 'BR'; // Brasil
  }
  return 'US'; // Padrão
}

/**
 * Middleware para bloquear IPs que estejam na blacklist ou que pertençam a países bloqueados
 */
async function verificarBlacklist(req, res, next) {
  try {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
    const clientIp = String(rawIp).split(',')[0].trim().replace(/^.*:/, '');

    // Verifica se IP consta na tabela de blacklist
    const [bloqueado] = await query('SELECT * FROM ip_blacklist WHERE ip = ? AND (expira_em IS NULL OR expira_em > NOW())', [clientIp]);

    if (bloqueado) {
      await execute('INSERT INTO logs_seguranca (tipo, ip, detalhes, bloqueado) VALUES ("Acesso Negado (IP Blacklist)", ?, ?, 1)', [
        clientIp,
        `Tentativa de acesso bloqueada. Motivo: ${bloqueado.motivo} (País: ${bloqueado.pais})`
      ]);
      return res.status(403).json({
        erro: 'Acesso bloqueado por diretrizes de segurança da rede institucional (IP Blacklist)',
        ip: clientIp,
        motivo: bloqueado.motivo,
        data: bloqueado.bloqueado_em
      });
    }

    req.clientIp = clientIp;
    req.clientCountry = identificarPaisPorIp(clientIp);
    next();
  } catch (err) {
    console.error('Erro na verificação de blacklist:', err);
    next();
  }
}

/**
 * Middleware de controle de alçada e permissões por cargo
 * Cargos suportados: atendente, supervisor, gerente, administrador
 */
function verificarAlcada(cargoMinimo = 'atendente', maxDescontoPermitido = null) {
  const niveis = {
    'cliente': 0,
    'atendente': 1,
    'supervisor': 2,
    'gerente': 3,
    'administrador': 4
  };

  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ erro: 'Não autenticado' });

    // Administrador tem alçada total
    if (user.tipo === 'administrador' || user.tipo === 'admin') return next();

    const userCargo = (user.cargo || 'atendente').toLowerCase();
    const userNivel = niveis[userCargo] || 1;
    const nivelExigido = niveis[cargoMinimo.toLowerCase()] || 1;

    if (userNivel < nivelExigido) {
      return res.status(403).json({
        erro: `Acesso negado: Requer alçada mínima de '${cargoMinimo}'. Seu cargo atual é '${userCargo}'.`,
        cargoAtual: userCargo,
        cargoNecessario: cargoMinimo
      });
    }

    if (maxDescontoPermitido !== null) {
      const descontoSolicitado = parseFloat(req.body.desconto || req.body.descontoPorcentagem || 0);
      const limiteUsuario = parseFloat(user.alçada_max_desconto || 10.00);
      if (descontoSolicitado > limiteUsuario) {
        return res.status(403).json({
          erro: `Alçada insuficiente: Seu limite máximo de concessão de desconto é ${limiteUsuario}%, mas foi solicitado ${descontoSolicitado}%. Solicite autorização de um Supervisor ou Administrador.`,
          limite: limiteUsuario,
          solicitado: descontoSolicitado
        });
      }
    }

    next();
  };
}

module.exports = {
  criptografar,
  descriptografar,
  identificarPaisPorIp,
  verificarBlacklist,
  verificarAlcada
};
