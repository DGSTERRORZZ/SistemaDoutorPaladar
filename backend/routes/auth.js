const bcrypt = require('bcryptjs');
const { query, execute } = require('../database');
const { generateToken } = require('../authMiddleware');

async function loginAdmin(req, res) {
  const { username, password, senha, codigo2FA, lembrarDispositivo7Dias } = req.body;
  const pass = password || senha;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (!username || !pass) {
    return res.status(400).json({ erro: 'Usuário e senha são obrigatórios' });
  }

  try {
    const admins = await query("SELECT * FROM usuarios WHERE username = ? AND tipo = 'administrador'", [username]);
    if (admins.length === 0) {
      await execute('INSERT INTO logs_seguranca (tipo, ip, detalhes, bloqueado) VALUES ("Tentativa Login Falha", ?, ?, 0)', [
        clientIp,
        `Tentativa de login de admin com usuário inexistente: '${username}'`
      ]);
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const admin = admins[0];

    // ── Prevenção Ativa de Ataque de Força Bruta ──
    if (admin.bloqueado_ate && new Date(admin.bloqueado_ate) > new Date()) {
      const minutosRestantes = Math.ceil((new Date(admin.bloqueado_ate) - new Date()) / 60000);
      return res.status(429).json({
        erro: `Conta temporariamente bloqueada por excesso de tentativas incorretas (Proteção anti-bruteforce). Tente novamente em ${minutosRestantes} minuto(s).`,
        bloqueadoAte: admin.bloqueado_ate
      });
    }

    const senhaValida = bcrypt.compareSync(pass, admin.senha_hash);
    if (!senhaValida) {
      const novasTentativas = (admin.tentativas_login || 0) + 1;
      let bloqueioSql = '';
      if (novasTentativas >= 5) {
        // Bloqueia por 15 minutos ao atingir 5 tentativas consecutivas
        bloqueioSql = ', bloqueado_ate = DATE_ADD(NOW(), INTERVAL 15 MINUTE)';
        await execute(
          'INSERT INTO logs_seguranca (tipo, ip, detalhes, bloqueado) VALUES ("Conta Bloqueada (Brute Force)", ?, ?, 1)',
          [clientIp, `Admin '${username}' bloqueado por 15 minutos após 5 erros de senha seguidos.`]
        );
      } else {
        await execute(
          'INSERT INTO logs_seguranca (tipo, ip, detalhes, bloqueado) VALUES ("Senha Incorreta", ?, ?, 0)',
          [clientIp, `Senha incorreta para admin '${username}' (tentativa ${novasTentativas} de 5).`]
        );
      }

      await execute(`UPDATE usuarios SET tentativas_login = ? ${bloqueioSql} WHERE id = ?`, [novasTentativas, admin.id]);
      return res.status(401).json({
        erro: 'Credenciais inválidas',
        tentativasRestantes: Math.max(0, 5 - novasTentativas)
      });
    }

    // ── 2FA: Validação de Login em 2 Etapas com Trava de Tempo (1 semana) ──
    const dispositivoConfiado = admin.two_factor_remember_until && new Date(admin.two_factor_remember_until) > new Date();

    if (!dispositivoConfiado) {
      // Se já enviou o código 2FA, valida-o
      if (codigo2FA) {
        const codigoValido = admin.two_factor_code === String(codigo2FA).trim();
        const codigoNaoExpirado = admin.two_factor_expira && new Date(admin.two_factor_expira) > new Date();

        if (!codigoValido || !codigoNaoExpirado) {
          return res.status(401).json({
            erro: 'Código de autenticação em 2 etapas inválido ou expirado. Tente novamente.',
            exige2FA: true
          });
        }

        // 2FA válido: se o usuário marcou lembrar por 1 semana, salva a trava de tempo
        let lembrarSql = 'two_factor_code = NULL, two_factor_expira = NULL, tentativas_login = 0, bloqueado_ate = NULL';
        if (lembrarDispositivo7Dias) {
          lembrarSql += ', two_factor_remember_until = DATE_ADD(NOW(), INTERVAL 7 DAY)';
        }
        await execute(`UPDATE usuarios SET ${lembrarSql} WHERE id = ?`, [admin.id]);
      } else {
        // Não enviou código 2FA: gera código PIN de 6 dígitos (válido por 10 minutos)
        const pin2FA = Math.floor(100000 + Math.random() * 900000).toString();
        await execute(
          'UPDATE usuarios SET two_factor_code = ?, two_factor_expira = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',
          [pin2FA, admin.id]
        );

        console.log(`🔐 [2FA - SEGURANÇA] Código gerado para '${admin.username}': ${pin2FA} (Válido por 10 minutos)`);

        return res.json({
          exige2FA: true,
          mensagem: 'Autenticação em 2 Etapas ativada! Digite o código de 6 dígitos.',
          codigoSimulado: pin2FA, // Enviado para facilitar teste na aula/laboratório
          expiraEmMinutos: 10
        });
      }
    } else {
      // Dispositivo dentro do período de 1 semana lembrado
      await execute('UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL WHERE id = ?', [admin.id]);
    }

    // Sucesso: Gera Token JWT com cargo e alçada incluídos
    const token = generateToken({
      id: admin.id,
      nome: admin.nome,
      tipo: 'admin',
      cargo: admin.cargo || 'administrador',
      alçada_max_desconto: parseFloat(admin.alçada_max_desconto || 100.00)
    });

    res.json({
      token,
      nome: admin.nome,
      tipo: 'admin',
      cargo: admin.cargo || 'administrador',
      seguranca: {
        hashAlgoritmo: 'bcrypt',
        autenticacao2Etapas: true,
        dispositivoConfiado7Dias: dispositivoConfiado || !!lembrarDispositivo7Dias
      }
    });
  } catch (error) {
    console.error('Erro no login admin:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

module.exports = { loginAdmin };
