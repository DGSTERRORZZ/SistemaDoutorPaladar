const express = require('express');
const router = express.Router();
const { getDatabase, query, queryOne, execute } = require('../database');

// GET todos
router.get('/', async (req, res) => {
  try {
    const fornecedores = await query('SELECT * FROM fornecedores ORDER BY nome');
    res.json(fornecedores);
  } catch (error) {
    console.error('Erro ao listar fornecedores:', error);
    res.status(500).json({ erro: 'Erro ao listar fornecedores' });
  }
});

// GET um
router.get('/:id', async (req, res) => {
  try {
    const fornecedor = await queryOne('SELECT * FROM fornecedores WHERE id = ?', [req.params.id]);
    if (!fornecedor) return res.status(404).json({ erro: 'Fornecedor não encontrado' });
    res.json(fornecedor);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar fornecedor' });
  }
});

// GET compras do fornecedor
router.get('/:id/compras', async (req, res) => {
  try {
    const compras = await query('SELECT * FROM compras_fornecedor WHERE fornecedorId = ? ORDER BY id DESC', [req.params.id]);
    for (const compra of compras) {
      compra.total = parseFloat(compra.total);
      compra.itens = await query('SELECT * FROM itens_compra WHERE compraId = ?', [compra.id]);
      compra.itens.forEach(i => { i.precoUnitario = parseFloat(i.precoUnitario); });
    }
    res.json(compras);
  } catch (error) {
    console.error('Erro ao listar compras:', error);
    res.status(500).json({ erro: 'Erro ao listar compras' });
  }
});

// POST criar
router.post('/', async (req, res) => {
  const { nome, cnpj, telefone, email, endereco } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
  try {
    const result = await execute(
      'INSERT INTO fornecedores (nome, cnpj, telefone, email, endereco) VALUES (?, ?, ?, ?, ?)',
      [nome, cnpj || '', telefone || '', email || '', endereco || '']
    );
    res.status(201).json({ id: result.insertId, nome, cnpj, telefone, email, endereco });
  } catch (error) {
    console.error('Erro ao criar fornecedor:', error);
    res.status(500).json({ erro: 'Erro ao criar fornecedor' });
  }
});

// PUT atualizar
router.put('/:id', async (req, res) => {
  const { nome, cnpj, telefone, email, endereco } = req.body;
  try {
    const fornecedor = await queryOne('SELECT * FROM fornecedores WHERE id = ?', [req.params.id]);
    if (!fornecedor) return res.status(404).json({ erro: 'Fornecedor não encontrado' });

    await execute(
      'UPDATE fornecedores SET nome=?, cnpj=?, telefone=?, email=?, endereco=? WHERE id=?',
      [nome ?? fornecedor.nome, cnpj ?? fornecedor.cnpj, telefone ?? fornecedor.telefone,
       email ?? fornecedor.email, endereco ?? fornecedor.endereco, req.params.id]
    );
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao atualizar fornecedor:', error);
    res.status(500).json({ erro: 'Erro ao atualizar fornecedor' });
  }
});

// DELETE excluir
router.delete('/:id', async (req, res) => {
  try {
    await execute('DELETE FROM fornecedores WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao remover fornecedor' });
  }
});

// POST registrar compra do fornecedor
router.post('/:id/compras', async (req, res) => {
  const { itens, total, status, data } = req.body;
  const fornecedorId = req.params.id;
  if (!itens || !itens.length || !total) return res.status(400).json({ erro: 'Dados incompletos' });

  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const dataCompra = data || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [result] = await conn.execute(
      'INSERT INTO compras_fornecedor (fornecedorId, total, status, data) VALUES (?, ?, ?, ?)',
      [fornecedorId, parseFloat(total), status || 'pedido', dataCompra]
    );
    const compraId = result.insertId;
    for (const item of itens) {
      await conn.execute(
        'INSERT INTO itens_compra (compraId, produtoId, quantidade, precoUnitario) VALUES (?, ?, ?, ?)',
        [compraId, item.produtoId, item.quantidade, parseFloat(item.precoUnitario)]
      );
    }
    await conn.commit();
    res.status(201).json({ id: compraId });
  } catch (error) {
    await conn.rollback();
    console.error('Erro ao registrar compra:', error);
    res.status(500).json({ erro: 'Erro ao registrar compra' });
  } finally {
    conn.release();
  }
});

// PUT confirmar entrega (atualiza estoque)
router.put('/compras/:id/entregar', async (req, res) => {
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    const [compras] = await conn.execute('SELECT * FROM compras_fornecedor WHERE id = ?', [req.params.id]);
    if (compras.length === 0) return res.status(404).json({ erro: 'Compra não encontrada' });

    await conn.beginTransaction();
    await conn.execute("UPDATE compras_fornecedor SET status = 'entregue' WHERE id = ?", [req.params.id]);

    const [itens] = await conn.execute('SELECT * FROM itens_compra WHERE compraId = ?', [req.params.id]);
    for (const item of itens) {
      await conn.execute('UPDATE produtos SET estoque = estoque + ? WHERE id = ?', [item.quantidade, item.produtoId]);
    }
    await conn.commit();
    res.json({ sucesso: true });
  } catch (error) {
    await conn.rollback();
    console.error('Erro ao confirmar entrega:', error);
    res.status(500).json({ erro: 'Erro ao confirmar entrega' });
  } finally {
    conn.release();
  }
});

module.exports = router;
