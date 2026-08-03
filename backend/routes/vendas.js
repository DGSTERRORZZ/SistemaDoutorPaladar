const express = require('express');
const router = express.Router();
const { getDatabase, query, execute } = require('../database');

// GET todas as vendas
router.get('/', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    let sql = 'SELECT * FROM vendas';
    const params = [];
    if (inicio && fim) {
      sql += ' WHERE data BETWEEN ? AND ?';
      params.push(inicio, fim);
    } else if (inicio) {
      sql += ' WHERE data >= ?';
      params.push(inicio);
    }
    sql += ' ORDER BY id DESC';
    const vendas = await query(sql, params);
    for (const v of vendas) {
      v.total = parseFloat(v.total);
      v.itens = await query('SELECT * FROM itens_venda WHERE vendaId = ?', [v.id]);
      v.itens.forEach(i => { i.precoUnitario = parseFloat(i.precoUnitario); });
    }
    res.json(vendas);
  } catch (error) {
    console.error('Erro ao listar vendas:', error);
    res.status(500).json({ erro: 'Erro ao listar vendas' });
  }
});

// GET horários de pico
router.get('/horarios-pico', async (req, res) => {
  try {
    const horarios = await query(`
      SELECT HOUR(data) as hora, COUNT(*) as total_vendas, SUM(total) as total_valor
      FROM vendas
      WHERE data >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY HOUR(data)
      ORDER BY total_vendas DESC
      LIMIT 3
    `);
    horarios.forEach(h => { h.total_valor = parseFloat(h.total_valor || 0); });
    res.json(horarios);
  } catch (error) {
    res.json([]);
  }
});

// GET dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const [vendasHoje] = await query(
      'SELECT COALESCE(SUM(total),0) as total, COUNT(*) as qtd FROM vendas WHERE DATE(data) = ?',
      [hoje]
    );
    const [vendasSemana] = await query(
      'SELECT COALESCE(SUM(total),0) as total, COUNT(*) as qtd FROM vendas WHERE data >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    const [vendasMes] = await query(
      'SELECT COALESCE(SUM(total),0) as total, COUNT(*) as qtd FROM vendas WHERE MONTH(data) = MONTH(NOW()) AND YEAR(data) = YEAR(NOW())'
    );
    const topProdutos = await query(`
      SELECT iv.nome, SUM(iv.quantidade) as total_qtd, SUM(iv.quantidade * iv.precoUnitario) as total_valor
      FROM itens_venda iv
      JOIN vendas v ON v.id = iv.vendaId
      WHERE v.data >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY iv.nome
      ORDER BY total_qtd DESC
      LIMIT 5
    `);
    const vendasPorDia = await query(`
      SELECT DATE(data) as dia, COALESCE(SUM(total),0) as total
      FROM vendas
      WHERE data >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(data)
      ORDER BY dia ASC
    `);
    const vendasPorCategoria = await query(`
      SELECT p.categoria, COALESCE(SUM(iv.quantidade),0) as total
      FROM itens_venda iv
      JOIN produtos p ON p.id = iv.produtoId
      JOIN vendas v ON v.id = iv.vendaId
      WHERE v.data >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY p.categoria
    `);
    const formasPagamento = await query(`
      SELECT formaPagamento, COUNT(*) as total
      FROM vendas
      WHERE data >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY formaPagamento
    `);
    res.json({
      vendasHoje: { total: parseFloat(vendasHoje.total), qtd: vendasHoje.qtd },
      vendasSemana: { total: parseFloat(vendasSemana.total), qtd: vendasSemana.qtd },
      vendasMes: { total: parseFloat(vendasMes.total), qtd: vendasMes.qtd },
      topProdutos: topProdutos.map(p => ({ ...p, total_valor: parseFloat(p.total_valor || 0) })),
      vendasPorDia: vendasPorDia.map(d => ({ ...d, total: parseFloat(d.total) })),
      vendasPorCategoria,
      formasPagamento
    });
  } catch (error) {
    console.error('Erro ao buscar stats:', error);
    res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
  }
});

// POST nova venda (PDV)
router.post('/', async (req, res) => {
  const { itens, total, formaPagamento, data } = req.body;
  if (!itens || !itens.length || !total || !formaPagamento) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const dataVenda = data ? new Date(data).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [result] = await conn.execute(
      'INSERT INTO vendas (total, formaPagamento, data) VALUES (?, ?, ?)',
      [parseFloat(total), formaPagamento, dataVenda]
    );
    const vendaId = result.insertId;
    for (const item of itens) {
      await conn.execute(
        'INSERT INTO itens_venda (vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (?, ?, ?, ?, ?)',
        [vendaId, item.produtoId, item.nome, item.quantidade, parseFloat(item.precoUnitario)]
      );
      await conn.execute('UPDATE produtos SET estoque = estoque - ? WHERE id = ?', [item.quantidade, item.produtoId]);
    }
    await conn.commit();
    res.status(201).json({ id: vendaId, total: parseFloat(total), formaPagamento, data: dataVenda });
  } catch (error) {
    await conn.rollback();
    console.error('Erro ao registrar venda:', error);
    res.status(500).json({ erro: 'Erro ao registrar venda' });
  } finally {
    conn.release();
  }
});

module.exports = router;
