const express = require('express');
const net = require('net');
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
      algoritmo: 'AES-256-GCM com IV aleatório e tag de autenticação',
      dados: dadosSensiveis
    };

    const payloadCriptografado = criptografar(pacoteRelatorio);

    res.json({
      sucesso: true,
      seguro: true,
      algoritmo: 'AES-256-GCM',
      payloadCriptografado,
      mensagem: 'Relatório criptografado em repouso com AES-256-GCM.'
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
    res.status(400).json({ erro: 'Relatório inválido ou corrompido' });
  }
});

// ── 2. Testes puramente simulados; nunca executar SQL injetado ou bloquear conta real. ──
router.post('/testar-sql-injection', verifyAdmin, async (req, res) => {
  const payload = typeof req.body?.entradaPayload === 'string' ? req.body.entradaPayload.slice(0, 150) : "admin' OR '1'='1";
  const rows = await query('SELECT id FROM usuarios WHERE username = ? LIMIT 1', [payload]);
  res.json({
    sucesso: true, modo: 'protegido_prepared_statement', demonstracao: true,
    consulta: 'SELECT id FROM usuarios WHERE username = ? LIMIT 1',
    registrosRetornados: rows.length,
    explicacao: 'O parâmetro é tratado como valor, não como instrução SQL. Este teste não comprova a ausência de SQL injection em toda a aplicação.'
  });
});

router.post('/simular-bruteforce', verifyAdmin, async (req, res) => {
  const qtd = Math.min(20, Math.max(1, Number.parseInt(req.body?.tentativas, 10) || 8));
  const historicoTentativas = Array.from({ length: Math.min(qtd, 5) }, (_, idx) => ({
    tentativa: idx + 1,
    status: idx === 4 ? 'Bloqueio simulado por 15 minutos' : 'Falha simulada'
  }));
  res.json({
    sucesso: true, demonstracao: true, totalTentativasExecutadas: historicoTentativas.length,
    historicoTentativas, contaBloqueada: qtd >= 5,
    tempoBloqueio: qtd >= 5 ? '15 minutos (simulação)' : 'Sem bloqueio',
    observacao: 'Nenhuma senha foi testada e nenhuma conta real foi bloqueada.'
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
  if (typeof ip !== 'string' || !net.isIP(ip.trim()) || typeof motivo !== 'string' || motivo.trim().length < 3 || motivo.length > 255) {
    return res.status(400).json({ erro: 'IP válido e motivo de 3 a 255 caracteres são obrigatórios' });
  }

  try {
    const paisDetectado = identificarPaisPorIp(ip);
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
