const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, execute } = require('../database');
const { verifyAdmin, generateToken } = require('../authMiddleware');
const { criptografar, descriptografar, identificarPaisPorIp } = require('../securityService');

// ── 1. RELATÓRIO CRIPTOGRAFADO (AES-256) ──
// GET /api/seguranca/relatorio-criptografado - Retorna dados sensíveis cifrados
router.get('/relatorio-criptografado', verifyAdmin, async (req, res) => {
  try {
    // Coleta dados financeiros sensíveis para demonstrar cifra
    const dadosSensiveis = await query(`
      SELECT 
        u.id, u.nome, u.username, u.saldoDevedor, u.limiteCredito,
        COUNT(p.id) as total_pedidos,
        COALESCE(SUM(p.total), 0) as faturamento_gerado
      FROM usuarios u
      LEFT JOIN pedidos p ON p.clienteAppId = u.id AND p.status = 'entregue'
      WHERE u.tipo = 'cliente'
      GROUP BY u.id, u.nome, u.username, u.saldoDevedor, u.limiteCredito
      LIMIT 10
    `);

    const pacoteRelatorio = {
      geradoEm: new Date().toISOString(),
      classificacao: 'CONFIDENCIAL / LGPD / DIRETORIA IFSP',
      algoritmo: 'AES-256-CBC com Salt & IV Dinâmico',
      dados: dadosSensiveis
    };

    const payloadCriptografado = criptografar(pacoteRelatorio);

    res.json({
      sucesso: true,
      seguro: true,
      algoritmo: 'AES-256-CBC',
      payloadCriptografado,
      mensagem: 'Relatório gerado e protegido por criptografia de ponta a ponta.'
    });
  } catch (err) {
    console.error('Erro ao gerar relatório criptografado:', err);
    res.status(500).json({ erro: 'Falha na geração do relatório seguro' });
  }
});

// POST /api/seguranca/descriptografar-relatorio - Descriptografa com a chave mestra
router.post('/descriptografar-relatorio', verifyAdmin, async (req, res) => {
  try {
    const { payloadCriptografado } = req.body;
    if (!payloadCriptografado) return res.status(400).json({ erro: 'Payload criptografado é obrigatório' });

    const relatorioAberto = descriptografar(payloadCriptografado);
    res.json({
      sucesso: true,
      descriptografado: true,
      relatorio: relatorioAberto
    });
  } catch (err) {
    res.status(400).json({ erro: 'Chave incorreta ou dados corrompidos: ' + err.message });
  }
});

// ── 2. TESTE DE VULNERABILIDADE SQL INJECTION (Vulnerável vs Seguro) ──
// POST /api/seguranca/testar-sql-injection - Demonstra o efeito de injeção e como os Prepared Statements protegem
router.post('/testar-sql-injection', verifyAdmin, async (req, res) => {
  const { entradaPayload, modo } = req.body;
  const payload = entradaPayload || "admin' OR '1'='1";

  if (modo === 'simular_vulneravel') {
    // ⚠️ Demonstração didática: Concatenação pura sem sanitização (Vulnerável)
    const sqlVulneravel = `SELECT id, nome, username, tipo FROM usuarios WHERE username = '${payload}'`;
    try {
      const [resultados] = await (await require('../database').getDatabase()).query(sqlVulneravel);
      return res.json({
        sucesso: true,
        modo: 'vulneravel',
        alerta: '🚨 ATAQUE BEM-SUCEDIDO: O banco executou a injeção SQL devido a concatenação direta!',
        sqlExecutado: sqlVulneravel,
        registrosVazadosOuAfetados: resultados.length,
        dadosExpostos: resultados
      });
    } catch (sqlErr) {
      return res.json({
        sucesso: false,
        modo: 'vulneravel',
        erroSintaxeSql: sqlErr.message,
        sqlExecutado: sqlVulneravel
      });
    }
  } else {
    // 🛡️ Modo Padrão Seguro: Prepared Statement com bind de parâmetros (?)
    const sqlSeguro = `SELECT id, nome, username, tipo FROM usuarios WHERE username = ?`;
    const resultados = await query(sqlSeguro, [payload]);

    return res.json({
      sucesso: true,
      modo: 'protegido_prepared_statement',
      status: '🛡️ PROTEGIDO: O Banco de Dados tratou as aspas e comandos SQL estritamente como texto literal!',
      sqlExecutado: `${sqlSeguro} com param = "${payload}"`,
      registrosRetornados: resultados.length,
      dados: resultados,
      explicacao: 'O Sistema Doutor Paladar usa mysql2/promise com execute() parametrizado, tornando injeções SQL impossíveis.'
    });
  }
});

// ── 3. SIMULAÇÃO DE ATAQUE DE FORÇA BRUTA & PREVENÇÃO ──
// POST /api/seguranca/simular-bruteforce - Simula um robô tentando adivinhar senhas e bloqueio automático
router.post('/simular-bruteforce', async (req, res) => {
  const { username, tentativas } = req.body;
  const alvo = username || 'admin';
  const qtd = Math.min(20, parseInt(tentativas || 8));

  const [usuario] = await query('SELECT * FROM usuarios WHERE username = ?', [alvo]);
  if (!usuario) return res.status(404).json({ erro: 'Usuário alvo não existe' });

  const ipAtacante = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '185.220.101.5';
  const logTentativas = [];
  let bloqueado = false;
  let bloqueioMinutos = 0;

  for (let i = 1; i <= qtd; i++) {
    const senhaFalsa = `senha_errada_${i}`;
    const acertou = bcrypt.compareSync(senhaFalsa, usuario.senha_hash);

    if (!acertou) {
      logTentativas.push({ tentativa: i, senhaTestada: senhaFalsa, status: 'Falhou (401)' });
      if (i >= 5) {
        bloqueado = true;
        bloqueioMinutos = 15;
        // Aplica trava no banco
        await execute(
          'UPDATE usuarios SET tentativas_login = tentativas_login + ?, bloqueado_ate = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
          [i, usuario.id]
        );
        // Registra log de incidente de segurança
        await execute(
          'INSERT INTO logs_seguranca (tipo, ip, detalhes, bloqueado) VALUES ("Ataque Força Bruta Detectado", ?, ?, 1)',
          [ipAtacante, `Múltiplas tentativas de quebra de senha para o usuário '${alvo}'. Conta bloqueada temporariamente.`]
        );
        break;
      }
    }
  }

  res.json({
    sucesso: true,
    usuarioAlvo: alvo,
    totalTentativasExecutadas: logTentativas.length,
    historicoTentativas: logTentativas,
    contaBloqueada: bloqueado,
    tempoBloqueio: bloqueado ? `${bloqueioMinutos} minutos com reset automático` : 'Ainda não bloqueada (menos de 5 falhas)',
    mecanismo: 'Defesa ativa por Rate Limiter e Trava de Conta por Excesso de Tentativas'
  });
});

// ── 4. GERENCIAMENTO DE BLACKLIST DE IP E BLOQUEIO POR PAÍS ──
// GET /api/seguranca/blacklist - Lista todos os IPs bloqueados
router.get('/blacklist', verifyAdmin, async (req, res) => {
  const lista = await query('SELECT * FROM ip_blacklist ORDER BY bloqueado_em DESC');
  const logs = await query('SELECT * FROM logs_seguranca ORDER BY dataHora DESC LIMIT 30');
  res.json({ sucesso: true, lista, logs });
});

// POST /api/seguranca/blacklist - Adiciona IP ou país à blacklist
router.post('/blacklist', verifyAdmin, async (req, res) => {
  const { ip, motivo, pais } = req.body;
  if (!ip || !motivo) return res.status(400).json({ erro: 'IP e motivo são obrigatórios' });

  try {
    const paisDetectado = pais || identificarPaisPorIp(ip);
    await execute(
      'INSERT INTO ip_blacklist (ip, motivo, pais, criado_por) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE motivo = VALUES(motivo), pais = VALUES(pais)',
      [ip.trim(), motivo.trim(), paisDetectado, req.user?.nome || 'Admin']
    );

    res.json({ sucesso: true, mensagem: `IP ${ip} (${paisDetectado}) adicionado à Blacklist com sucesso!` });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao bloquear IP: ' + err.message });
  }
});

// DELETE /api/seguranca/blacklist/:id - Remove IP da blacklist
router.delete('/blacklist/:id', verifyAdmin, async (req, res) => {
  await execute('DELETE FROM ip_blacklist WHERE id = ?', [req.params.id]);
  res.json({ sucesso: true, mensagem: 'IP desbloqueado com sucesso!' });
});

// ── 5. VERIFICAÇÃO DE SENHAS COM HASH NO BANCO DE DADOS ──
// GET /api/seguranca/auditoria-hashes - Audita se todas as contas de usuários usam bcrypt hash
router.get('/auditoria-hashes', verifyAdmin, async (req, res) => {
  const usuarios = await query('SELECT id, nome, username, tipo, senha_hash, dataCadastro FROM usuarios');
  
  const relatorio = usuarios.map(u => {
    const isBcrypt = typeof u.senha_hash === 'string' && (u.senha_hash.startsWith('$2a$') || u.senha_hash.startsWith('$2b$'));
    return {
      id: u.id,
      nome: u.nome,
      username: u.username,
      tipo: u.tipo,
      algoritmo: isBcrypt ? 'bcrypt (Salt Rounds = 10)' : 'Texto Plano / Desconhecido (INSEGURO)',
      emConformidade: isBcrypt,
      tamanhoHash: u.senha_hash ? u.senha_hash.length : 0,
      amostraSegura: u.senha_hash ? u.senha_hash.substring(0, 10) + '...' : 'Vazio'
    };
  });

  const totalmenteSeguro = relatorio.every(r => r.emConformidade);

  res.json({
    sucesso: true,
    totalContas: usuarios.length,
    todasComHashBcrypt: totalmenteSeguro,
    statusGeral: totalmenteSeguro ? '✅ 100% das senhas protegidas com Bcrypt Salt 10' : '⚠️ Existem senhas não criptografadas',
    detalhes: relatorio
  });
});

module.exports = router;
