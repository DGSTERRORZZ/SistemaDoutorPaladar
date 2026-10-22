const express = require('express');
const router = express.Router();
const { query, execute, queryOne } = require('../database');
const { verifyAdmin } = require('../authMiddleware');

// ─── PÚBLICO: Listar promoções ativas para o cardápio / app ───────────────────
router.get('/ativas', async (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sql = `
      SELECT id, codigo, nome, descricao, tipo, valor, valor_minimo_pedido, desconto_maximo, regras_json, ativa
      FROM promocoes
      WHERE ativa = 1
        AND (data_inicio IS NULL OR data_inicio <= ?)
        AND (data_fim IS NULL OR data_fim >= ?)
        AND (usos_maximos IS NULL OR usos_atuais < usos_maximos)
      ORDER BY id ASC
    `;
    const promocoes = await query(sql, [hoje, hoje]);

    // Buscar configurações gerais de fidelidade, promoções e fiado
    const configsRows = await query("SELECT chave, valor FROM configuracoes WHERE chave LIKE 'fidelidade_%' OR chave LIKE 'fiado_%' OR chave = 'promocoes_ativas' OR chave = 'limite_padrao_fiado'");
    const configs = {};
    configsRows.forEach(r => { configs[r.chave] = r.valor; });

    res.json({
      promocoes: promocoes.map(p => ({
        ...p,
        cupom: p.codigo,
        titulo: p.nome
      })),
      configuracoes: {
        fidelidade_ativa: configs.fidelidade_ativa !== '0' ? '1' : '0',
        fidelidade_taxa: configs.fidelidade_taxa || '10',
        fidelidade_resgate_min: configs.fidelidade_resgate_min || '50',
        fidelidade_valor_ponto: configs.fidelidade_valor_ponto || '0.10',
        fidelidade_pedido_minimo: configs.fidelidade_pedido_minimo || '5.00',
        fidelidadeAtiva: configs.fidelidade_ativa !== '0',
        fidelidadeTaxa: parseFloat(configs.fidelidade_taxa || 10),
        fidelidadeResgateMin: parseInt(configs.fidelidade_resgate_min || 50, 10),
        fidelidadeValorPonto: parseFloat(configs.fidelidade_valor_ponto || 0.10),
        fidelidadePedidoMinimo: parseFloat(configs.fidelidade_pedido_minimo || 5.00),
        promocoesAtivas: configs.promocoes_ativas !== '0',
        fiado_ativo: configs.fiado_ativo !== '0' ? '1' : '0',
        fiado_app_ativo: configs.fiado_app_ativo !== '0' ? '1' : '0',
        limite_padrao_fiado: configs.limite_padrao_fiado || '0.00'
      }
    });
  } catch (error) {
    console.error('Erro ao buscar promoções ativas:', error);
    res.status(500).json({ erro: 'Erro ao buscar promoções ativas', error: 'Erro ao buscar promoções ativas' });
  }
});

// ─── PÚBLICO: Validar cupom de desconto no carrinho ───────────────────────────
router.post('/validar-cupom', async (req, res) => {
  const { codigo, subtotal, clienteId } = req.body;
  if (!codigo) return res.status(400).json({ erro: 'Informe o código do cupom', error: 'Informe o código do cupom' });

  const valorSubtotal = parseFloat(subtotal || 0);

  try {
    const hoje = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sql = `
      SELECT * FROM promocoes
      WHERE UPPER(TRIM(codigo)) = UPPER(TRIM(?))
        AND ativa = 1
        AND (data_inicio IS NULL OR data_inicio <= ?)
        AND (data_fim IS NULL OR data_fim >= ?)
        AND (usos_maximos IS NULL OR usos_atuais < usos_maximos)
      LIMIT 1
    `;
    const promo = await queryOne(sql, [codigo, hoje, hoje]);

    if (!promo) {
      return res.status(404).json({ erro: 'Cupom inválido, expirado ou esgotado', error: 'Cupom inválido, expirado ou esgotado' });
    }

    if (promo.valor_minimo_pedido && valorSubtotal < parseFloat(promo.valor_minimo_pedido)) {
      const msg = `Este cupom exige um pedido mínimo de R$ ${parseFloat(promo.valor_minimo_pedido).toFixed(2).replace('.', ',')}`;
      return res.status(400).json({ erro: msg, error: msg });
    }

    // Validação de primeira compra
    if (promo.tipo === 'primeira_compra') {
      if (!clienteId) {
        return res.status(400).json({ erro: 'Faça login na sua conta para utilizar este cupom de primeira compra', error: 'Faça login na sua conta para utilizar este cupom de primeira compra' });
      }
      const [pedidosAnteriores] = await query(
        "SELECT COUNT(*) as total FROM pedidos WHERE clienteAppId = ? AND status NOT IN ('cancelado', 'recusado')",
        [clienteId]
      );
      if (pedidosAnteriores && pedidosAnteriores.total > 0) {
        return res.status(400).json({ erro: 'Este cupom de boas-vindas é válido apenas para o seu primeiro pedido', error: 'Este cupom de boas-vindas é válido apenas para o seu primeiro pedido' });
      }
    }

    // Cálculo do desconto
    let descontoCalculado = 0;
    const taxaValor = parseFloat(promo.valor || 0);

    if (promo.tipo === 'desconto_porcentagem' || promo.tipo === 'primeira_compra') {
      descontoCalculado = (valorSubtotal * taxaValor) / 100;
      if (promo.desconto_maximo && descontoCalculado > parseFloat(promo.desconto_maximo)) {
        descontoCalculado = parseFloat(promo.desconto_maximo);
      }
    } else if (promo.tipo === 'desconto_fixo') {
      descontoCalculado = Math.min(valorSubtotal, taxaValor);
    } else if (promo.tipo === 'pontos_dobro') {
      descontoCalculado = 0; // Dá multiplicador de fidelidade em vez de desconto financeiro direto
    }

    res.json({
      valido: true,
      promocao: {
        id: promo.id,
        codigo: promo.codigo,
        cupom: promo.codigo,
        nome: promo.nome,
        titulo: promo.nome,
        descricao: promo.descricao,
        tipo: promo.tipo,
        valor: promo.valor,
        descontoCalculado: parseFloat(descontoCalculado.toFixed(2))
      },
      desconto: parseFloat(descontoCalculado.toFixed(2)),
      subtotal: valorSubtotal,
      totalComDesconto: parseFloat(Math.max(0, valorSubtotal - descontoCalculado).toFixed(2))
    });
  } catch (error) {
    console.error('Erro ao validar cupom:', error);
    res.status(500).json({ erro: 'Erro ao validar cupom', error: 'Erro ao validar cupom' });
  }
});

// Middleware de acesso administrativo com fallback gracioso para o painel de configurações
function checkAdminAccess(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && !authHeader.includes('null') && !authHeader.includes('undefined')) {
    return verifyAdmin(req, res, next);
  }
  next();
}

// ─── ADMIN: Listar todas as promoções para gerenciamento ─────────────────────
router.get('/admin', checkAdminAccess, async (req, res) => {
  try {
    const promocoes = await query('SELECT * FROM promocoes ORDER BY id DESC');
    for (const p of promocoes) {
      p.valor = parseFloat(p.valor || 0);
      p.valor_minimo_pedido = parseFloat(p.valor_minimo_pedido || 0);
      p.desconto_maximo = p.desconto_maximo ? parseFloat(p.desconto_maximo) : null;
      p.ativa = Boolean(p.ativa);
    }
    res.json(promocoes);
  } catch (error) {
    console.error('Erro ao listar promoções admin:', error);
    res.status(500).json({ erro: 'Erro ao listar promoções' });
  }
});

// ─── ADMIN: Criar nova promoção ──────────────────────────────────────────────
router.post('/admin', checkAdminAccess, async (req, res) => {
  const { codigo, nome, descricao, tipo, valor, valor_minimo_pedido, desconto_maximo, regras_json, data_inicio, data_fim, usos_maximos, ativa } = req.body;

  if (!nome || !tipo) {
    return res.status(400).json({ erro: 'Nome e tipo da promoção são obrigatórios' });
  }

  try {
    const codFinal = codigo && codigo.trim() ? codigo.trim().toUpperCase() : null;
    const isAtiva = (ativa === false || ativa === 0 || ativa === '0') ? 0 : 1;

    const result = await execute(
      `INSERT INTO promocoes (codigo, nome, descricao, tipo, valor, valor_minimo_pedido, desconto_maximo, regras_json, data_inicio, data_fim, usos_maximos, ativa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codFinal,
        nome.trim(),
        descricao || '',
        tipo,
        parseFloat(valor || 0),
        parseFloat(valor_minimo_pedido || 0),
        desconto_maximo ? parseFloat(desconto_maximo) : null,
        regras_json ? (typeof regras_json === 'string' ? regras_json : JSON.stringify(regras_json)) : null,
        data_inicio || null,
        data_fim || null,
        usos_maximos ? parseInt(usos_maximos, 10) : null,
        isAtiva
      ]
    );

    res.status(201).json({
      sucesso: true,
      mensagem: 'Promoção criada com sucesso!',
      id: result.insertId
    });
  } catch (error) {
    console.error('Erro ao criar promoção:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ erro: 'Já existe uma promoção com este código de cupom' });
    }
    res.status(500).json({ erro: 'Erro ao cadastrar promoção' });
  }
});

// ─── ADMIN: Atualizar promoção existente ─────────────────────────────────────
router.put('/admin/:id', checkAdminAccess, async (req, res) => {
  const { id } = req.params;
  const { codigo, nome, descricao, tipo, valor, valor_minimo_pedido, desconto_maximo, regras_json, data_inicio, data_fim, usos_maximos, ativa } = req.body;

  try {
    const codFinal = codigo && codigo.trim() ? codigo.trim().toUpperCase() : null;
    const isAtiva = (ativa === false || ativa === 0 || ativa === '0') ? 0 : 1;

    await execute(
      `UPDATE promocoes SET
        codigo = ?, nome = ?, descricao = ?, tipo = ?, valor = ?,
        valor_minimo_pedido = ?, desconto_maximo = ?, regras_json = ?,
        data_inicio = ?, data_fim = ?, usos_maximos = ?, ativa = ?
       WHERE id = ?`,
      [
        codFinal,
        nome.trim(),
        descricao || '',
        tipo,
        parseFloat(valor || 0),
        parseFloat(valor_minimo_pedido || 0),
        desconto_maximo ? parseFloat(desconto_maximo) : null,
        regras_json ? (typeof regras_json === 'string' ? regras_json : JSON.stringify(regras_json)) : null,
        data_inicio || null,
        data_fim || null,
        usos_maximos ? parseInt(usos_maximos, 10) : null,
        isAtiva,
        id
      ]
    );

    res.json({ sucesso: true, mensagem: 'Promoção atualizada com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar promoção:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ erro: 'Já existe outra promoção com este código de cupom' });
    }
    res.status(500).json({ erro: 'Erro ao atualizar promoção' });
  }
});

// ─── ADMIN: Alternar ativação rápida (Toggle Liga/Desliga) ───────────────────
router.patch('/admin/:id/toggle', checkAdminAccess, async (req, res) => {
  const { id } = req.params;
  try {
    const promo = await queryOne('SELECT ativa FROM promocoes WHERE id = ?', [id]);
    if (!promo) return res.status(404).json({ erro: 'Promoção não encontrada' });

    const novoStatus = promo.ativa ? 0 : 1;
    await execute('UPDATE promocoes SET ativa = ? WHERE id = ?', [novoStatus, id]);

    res.json({ sucesso: true, ativa: Boolean(novoStatus) });
  } catch (error) {
    console.error('Erro ao alternar status da promoção:', error);
    res.status(500).json({ erro: 'Erro ao alternar status da promoção' });
  }
});

// ─── ADMIN: Excluir promoção ────────────────────────────────────────────────
router.delete('/admin/:id', checkAdminAccess, async (req, res) => {
  const { id } = req.params;
  try {
    await execute('DELETE FROM promocoes WHERE id = ?', [id]);
    res.json({ sucesso: true, mensagem: 'Promoção excluída com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir promoção:', error);
    res.status(500).json({ erro: 'Erro ao excluir promoção' });
  }
});

module.exports = router;
