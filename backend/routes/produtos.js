const { query, queryOne, execute } = require('../database');

async function listarProdutos(req, res) {
  try {
    const produtos = await query('SELECT * FROM produtos WHERE ativo = 1 ORDER BY categoria, nome');
    produtos.forEach(p => { p.preco = parseFloat(p.preco); });
    res.json(produtos);
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({ erro: 'Erro ao listar produtos' });
  }
}

async function criarProduto(req, res) {
  const { nome, categoria, preco, estoque, estoqueMinimo, imagem, fornecedorId } = req.body;
  if (!nome || !categoria || preco === undefined) {
    return res.status(400).json({ erro: 'Nome, categoria e preço são obrigatórios' });
  }
  try {
    const result = await execute(
      'INSERT INTO produtos (nome, categoria, preco, estoque, estoqueMinimo, imagem, fornecedorId) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nome, categoria, parseFloat(preco), parseInt(estoque) || 0, parseInt(estoqueMinimo) || 10, imagem || '', fornecedorId || null]
    );
    res.status(201).json({ sucesso: true, id: result.insertId });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ erro: 'Erro ao criar produto' });
  }
}

async function atualizarProduto(req, res) {
  const { id } = req.params;
  const { nome, categoria, preco, estoque, estoqueMinimo, imagem, fornecedorId, ativo } = req.body;
  try {
    const existente = await queryOne('SELECT * FROM produtos WHERE id = ?', [id]);
    if (!existente) return res.status(404).json({ erro: 'Produto não encontrado' });

    await execute(
      'UPDATE produtos SET nome = ?, categoria = ?, preco = ?, estoque = ?, estoqueMinimo = ?, imagem = ?, fornecedorId = ?, ativo = ? WHERE id = ?',
      [
        nome ?? existente.nome,
        categoria ?? existente.categoria,
        preco !== undefined ? parseFloat(preco) : existente.preco,
        estoque !== undefined ? parseInt(estoque) : existente.estoque,
        estoqueMinimo !== undefined ? parseInt(estoqueMinimo) : existente.estoqueMinimo,
        imagem !== undefined ? imagem : existente.imagem,
        fornecedorId !== undefined ? fornecedorId : existente.fornecedorId,
        ativo !== undefined ? ativo : existente.ativo,
        id
      ]
    );
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ erro: 'Erro ao atualizar produto' });
  }
}

async function deletarProduto(req, res) {
  const { id } = req.params;
  try {
    await execute('UPDATE produtos SET ativo = 0 WHERE id = ?', [id]);
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({ erro: 'Erro ao deletar produto' });
  }
}

module.exports = { listarProdutos, criarProduto, atualizarProduto, deletarProduto };
