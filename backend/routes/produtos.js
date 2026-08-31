const { query, queryOne, execute } = require('../database');
const { AppError } = require('../middleware/errorHandler');

async function listarProdutos(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;
    const { categoria, busca } = req.query;

    let sql = 'SELECT * FROM produtos WHERE ativo = 1';
    let countSql = 'SELECT COUNT(*) as total FROM produtos WHERE ativo = 1';
    const params = [];
    const countParams = [];

    if (categoria) {
      sql += ' AND categoria = ?';
      countSql += ' AND categoria = ?';
      params.push(categoria);
      countParams.push(categoria);
    }

    if (busca) {
      sql += ' AND nome LIKE ?';
      countSql += ' AND nome LIKE ?';
      params.push(`%${busca}%`);
      countParams.push(`%${busca}%`);
    }

    sql += ` ORDER BY categoria, nome LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

    const produtos = await query(sql, params);
    const totalRow = await queryOne(countSql, countParams);
    const total = totalRow?.total || 0;

    produtos.forEach(p => { p.preco = parseFloat(p.preco); });

    if (req.query.paginado === 'true') {
      res.json({
        dados: produtos,
        paginacao: {
          pagina: page,
          porPagina: limit,
          total,
          totalPaginas: Math.ceil(total / limit)
        }
      });
    } else {
      res.json(produtos);
    }
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({ erro: 'Erro ao listar produtos' });
  }
}

async function criarProduto(req, res) {
  const { nome, categoria, preco, estoque, estoqueMinimo, imagem, fornecedorId } = req.body;

  // Validações
  if (!nome || !categoria || preco === undefined) {
    return res.status(400).json({ erro: 'Nome, categoria e preço são obrigatórios' });
  }
  if (typeof nome === 'string' && nome.length > 100) {
    return res.status(400).json({ erro: 'Nome do produto excede 100 caracteres' });
  }
  const precoNum = parseFloat(preco);
  if (isNaN(precoNum) || precoNum <= 0) {
    return res.status(400).json({ erro: 'Preço deve ser um número positivo' });
  }
  const categoriasValidas = ['Salgados', 'Bebidas', 'Doces', 'Caldos', 'Snacks', 'Cremosinho', 'Combos', 'Outros'];
  if (!categoriasValidas.includes(categoria)) {
    return res.status(400).json({ erro: `Categoria inválida. Válidas: ${categoriasValidas.join(', ')}` });
  }

  try {
    const estoqueInt = Math.max(0, parseInt(estoque) || 0);
    const estoqueMinimoInt = Math.max(0, parseInt(estoqueMinimo) || 10);

    const result = await execute(
      'INSERT INTO produtos (nome, categoria, preco, estoque, estoqueMinimo, imagem, fornecedorId) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nome.trim(), categoria, precoNum, estoqueInt, estoqueMinimoInt, imagem || '', fornecedorId || null]
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

  // Validações opcionais (apenas se fornecidos)
  if (nome && typeof nome === 'string' && nome.length > 100) {
    return res.status(400).json({ erro: 'Nome do produto excede 100 caracteres' });
  }
  if (preco !== undefined) {
    const precoNum = parseFloat(preco);
    if (isNaN(precoNum) || precoNum <= 0) {
      return res.status(400).json({ erro: 'Preço deve ser um número positivo' });
    }
  }

  try {
    const existente = await queryOne('SELECT * FROM produtos WHERE id = ?', [id]);
    if (!existente) return res.status(404).json({ erro: 'Produto não encontrado' });

    await execute(
      'UPDATE produtos SET nome = ?, categoria = ?, preco = ?, estoque = ?, estoqueMinimo = ?, imagem = ?, fornecedorId = ?, ativo = ? WHERE id = ?',
      [
        nome ?? existente.nome,
        categoria ?? existente.categoria,
        preco !== undefined ? parseFloat(preco) : existente.preco,
        estoque !== undefined ? Math.max(0, parseInt(estoque)) : existente.estoque,
        estoqueMinimo !== undefined ? Math.max(0, parseInt(estoqueMinimo)) : existente.estoqueMinimo,
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
    const existente = await queryOne('SELECT id FROM produtos WHERE id = ?', [id]);
    if (!existente) return res.status(404).json({ erro: 'Produto não encontrado' });

    await execute('UPDATE produtos SET ativo = 0 WHERE id = ?', [id]);
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({ erro: 'Erro ao deletar produto' });
  }
}

async function obterMaisPedidos(req, res) {
  try {
    // 1. Busca ranking agregado real em itens_venda (vendas do PDV) e itens_pedido (pedidos online)
    const rankingReal = await query(`
      SELECT 
        p.id,
        p.nome,
        p.categoria,
        p.preco,
        p.imagem,
        COALESCE(SUM(unificado.qtd), 0) as total_vendido,
        COALESCE(COUNT(DISTINCT unificado.ref_id), 0) as total_pedidos
      FROM produtos p
      LEFT JOIN (
        SELECT produtoId, quantidade as qtd, vendaId as ref_id FROM itens_venda
        UNION ALL
        SELECT produtoId, quantidade as qtd, pedidoId as ref_id FROM itens_pedido
      ) as unificado ON unificado.produtoId = p.id
      WHERE p.ativo = 1
      GROUP BY p.id, p.nome, p.categoria, p.preco, p.imagem
      ORDER BY total_vendido DESC, p.nome ASC
    `);

    // Categorias de Bebidas
    const categoriasBebidas = ['Bebidas', 'Cremosinho', 'Sucos', 'Refrigerantes', 'Cafés', 'Cha', 'Água'];

    const comidas = [];
    const bebidas = [];

    for (const item of rankingReal) {
      item.preco = parseFloat(item.preco);
      item.total_vendido = parseInt(item.total_vendido) || 0;
      item.total_pedidos = parseInt(item.total_pedidos) || 0;

      const ehBebida = categoriasBebidas.some(cat => 
        (item.categoria || '').toLowerCase().includes(cat.toLowerCase())
      );

      if (ehBebida) {
        if (bebidas.length < 6) bebidas.push(item);
      } else {
        if (comidas.length < 6) comidas.push(item);
      }
    }

    res.json({
      comidas,
      bebidas,
      totalComidas: comidas.length,
      totalBebidas: bebidas.length
    });
  } catch (error) {
    console.error('Erro ao obter mais pedidos:', error);
    res.status(500).json({ erro: 'Erro ao obter produtos mais pedidos' });
  }
}

module.exports = { listarProdutos, criarProduto, atualizarProduto, deletarProduto, obterMaisPedidos };
