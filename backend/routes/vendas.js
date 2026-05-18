const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

router.use(async (req, res, next) => {
  req.db = await getDatabase();
  next();
});

// GET todas as vendas
router.get('/', (req, res) => {
  const stmtVendas = req.db.prepare('SELECT * FROM vendas ORDER BY id DESC');
  const vendas = [];
  while (stmtVendas.step()) {
    const venda = stmtVendas.getAsObject();
    const stmtItens = req.db.prepare('SELECT * FROM itens_venda WHERE vendaId = ?');
    stmtItens.bind([venda.id]);
    const itens = [];
    while (stmtItens.step()) itens.push(stmtItens.getAsObject());
    stmtItens.free();
    vendas.push({ ...venda, itens });
  }
  stmtVendas.free();
  res.json(vendas);
});

// POST registrar venda — CORRIGIDO: valida estoque antes de registrar
router.post('/', (req, res) => {
  const { itens, total, formaPagamento, data } = req.body;

  if (!itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Adicione pelo menos um item à venda' });
  }

  if (!total || total <= 0) {
    return res.status(400).json({ erro: 'Total da venda inválido' });
  }

  if (!formaPagamento) {
    return res.status(400).json({ erro: 'Forma de pagamento é obrigatória' });
  }

  const formasValidas = ['dinheiro', 'cartao', 'fiado'];
  if (!formasValidas.includes(formaPagamento)) {
    return res.status(400).json({ erro: `Forma de pagamento inválida. Use: ${formasValidas.join(', ')}` });
  }

  // Validar estoque de todos os itens antes de registrar
  for (const item of itens) {
    if (!item.produtoId || !item.quantidade || item.quantidade <= 0) {
      return res.status(400).json({ erro: 'Cada item precisa de produtoId e quantidade válida' });
    }

    const stmtProd = req.db.prepare('SELECT id, nome, estoque FROM produtos WHERE id = ?');
    stmtProd.bind([item.produtoId]);
    let produto = null;
    if (stmtProd.step()) {
      produto = stmtProd.getAsObject();
    }
    stmtProd.free();

    if (!produto) {
      return res.status(404).json({ erro: `Produto ID ${item.produtoId} não encontrado` });
    }

    if (produto.estoque < item.quantidade) {
      return res.status(400).json({
        erro: `Estoque insuficiente para "${produto.nome}". Disponível: ${produto.estoque}, solicitado: ${item.quantidade}`
      });
    }
  }

  // Registrar venda
  req.db.run('INSERT INTO vendas (total, formaPagamento, data) VALUES (?, ?, ?)',
    [total, formaPagamento, data || new Date().toISOString()]);
  const vendaId = req.db.exec("SELECT last_insert_rowid()")[0].values[0][0];

  // Inserir itens e baixar estoque
  const insertItem = req.db.prepare('INSERT INTO itens_venda (vendaId, produtoId, nome, quantidade, precoUnitario) VALUES (?, ?, ?, ?, ?)');
  const atualizarEstoque = req.db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ?');

  for (const item of itens) {
    insertItem.run([vendaId, item.produtoId, item.nome, item.quantidade, item.precoUnitario]);
    atualizarEstoque.run([item.quantidade, item.produtoId]);
  }
  insertItem.free();
  atualizarEstoque.free();

  res.status(201).json({ id: vendaId, total, formaPagamento, data });
});

module.exports = router;