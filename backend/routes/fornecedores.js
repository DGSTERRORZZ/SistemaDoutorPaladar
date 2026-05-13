const express = require('express');
const router = express.Router();
const { getDatabase, queryOne, queryAll } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

// GET todos
router.get('/', (req, res) => {
  try {
    const fornecedores = queryAll(req.db, 'SELECT * FROM fornecedores ORDER BY nome');
    res.json(fornecedores);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar fornecedores' });
  }
});

// GET um
router.get('/:id', (req, res) => {
  try {
    const fornecedor = queryOne(req.db, 'SELECT * FROM fornecedores WHERE id = ?', [Number(req.params.id)]);
    if (!fornecedor) return res.status(404).json({ erro: 'Fornecedor não encontrado' });
    res.json(fornecedor);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar fornecedor' });
  }
});

// POST criar
router.post('/', (req, res) => {
  try {
    const { nome, cnpj, telefone, email, endereco } = req.body;
    if (!nome || nome.trim().length < 2) {
      return res.status(400).json({ erro: 'Nome do fornecedor é obrigatório (mínimo 2 caracteres)' });
    }
    req.db.run('INSERT INTO fornecedores (nome, cnpj, telefone, email, endereco) VALUES (?, ?, ?, ?, ?)',
      [nome.trim(), cnpj || '', telefone || '', email || '', endereco || '']);
    const id = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    res.status(201).json({ id, nome: nome.trim(), cnpj, telefone, email, endereco });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar fornecedor' });
  }
});

// PUT atualizar
router.put('/:id', (req, res) => {
  try {
    const { nome, cnpj, telefone, email, endereco } = req.body;
    const fornecedor = queryOne(req.db, 'SELECT * FROM fornecedores WHERE id = ?', [Number(req.params.id)]);
    if (!fornecedor) return res.status(404).json({ erro: 'Fornecedor não encontrado' });

    req.db.run('UPDATE fornecedores SET nome=?, cnpj=?, telefone=?, email=?, endereco=? WHERE id=?',
      [nome ?? fornecedor.nome, cnpj ?? fornecedor.cnpj, telefone ?? fornecedor.telefone,
       email ?? fornecedor.email, endereco ?? fornecedor.endereco, Number(req.params.id)]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar fornecedor' });
  }
});

// DELETE excluir
router.delete('/:id', (req, res) => {
  try {
    req.db.run('DELETE FROM fornecedores WHERE id = ?', [Number(req.params.id)]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir fornecedor' });
  }
});

// POST registrar compra do fornecedor
router.post('/compras', (req, res) => {
  try {
    const { fornecedorId, itens, total, status, data } = req.body;

    if (!fornecedorId) return res.status(400).json({ erro: 'Fornecedor é obrigatório' });

    const fornecedor = queryOne(req.db, 'SELECT * FROM fornecedores WHERE id = ?', [Number(fornecedorId)]);
    if (!fornecedor) return res.status(404).json({ erro: 'Fornecedor não encontrado' });

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: 'Adicione pelo menos um item à compra' });
    }
    if (!total || total <= 0) return res.status(400).json({ erro: 'Total da compra inválido' });

    req.db.run('INSERT INTO compras_fornecedor (fornecedorId, total, status, data) VALUES (?, ?, ?, ?)',
      [Number(fornecedorId), total, status || 'pedido', data || new Date().toISOString()]);
    const compraId = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    const insertItem = req.db.prepare('INSERT INTO itens_compra (compraId, produtoId, quantidade, precoUnitario) VALUES (?, ?, ?, ?)');
    for (const item of itens) {
      insertItem.run([compraId, item.produtoId, item.quantidade, item.precoUnitario]);
    }
    insertItem.free();

    res.status(201).json({ id: compraId, status: 'pedido' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao registrar compra' });
  }
});

// PUT confirmar entrega (atualiza estoque)
router.put('/compras/:id/entregar', (req, res) => {
  try {
    const compra = queryOne(req.db, 'SELECT * FROM compras_fornecedor WHERE id = ?', [Number(req.params.id)]);
    if (!compra) return res.status(404).json({ erro: 'Compra não encontrada' });
    if (compra.status === 'entregue') return res.status(400).json({ erro: 'Compra já foi entregue' });

    req.db.run('UPDATE compras_fornecedor SET status = ? WHERE id = ?', ['entregue', Number(req.params.id)]);

    const itens = queryAll(req.db, 'SELECT * FROM itens_compra WHERE compraId = ?', [Number(req.params.id)]);

    const atualizarEstoque = req.db.prepare('UPDATE produtos SET estoque = estoque + ? WHERE id = ?');
    for (const item of itens) {
      atualizarEstoque.run([item.quantidade, item.produtoId]);
    }
    atualizarEstoque.free();

    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao confirmar entrega' });
  }
});

// GET compras do fornecedor
router.get('/:id/compras', (req, res) => {
  try {
    const compras = queryAll(req.db, 'SELECT * FROM compras_fornecedor WHERE fornecedorId = ? ORDER BY id DESC', [Number(req.params.id)]);
    for (const compra of compras) {
      compra.itens = queryAll(req.db, 'SELECT * FROM itens_compra WHERE compraId = ?', [compra.id]);
    }
    res.json(compras);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar compras' });
  }
});

module.exports = router;
