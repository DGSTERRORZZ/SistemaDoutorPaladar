const { getDatabase } = require('./database');

async function updateProducts() {
  const db = await getDatabase();

  // 1. Desativar Pastel de Carne
  const [res1] = await db.query("UPDATE produtos SET ativo = 0 WHERE nome LIKE '%Pastel de Carne%'");
  console.log('Pastel de carne atualizado:', res1.affectedRows);

  // 2. Renomear Pizza Fria para Pizza Enrolada
  const [res2] = await db.query("UPDATE produtos SET nome = 'Pizza Enrolada' WHERE nome LIKE '%Pizza Fria%'");
  console.log('Pizza Fria renomeada para Pizza Enrolada:', res2.affectedRows);

  // 3. Adicionar Croissants
  const croissants = [
    {
      nome: 'Croissant de Frango',
      categoria: 'Salgados',
      preco: 7.50,
      estoque: 20,
      estoqueMinimo: 5,
      imagem: 'imagens/coxinha_frango.jpg'
    },
    {
      nome: 'Croissant de Queijo',
      categoria: 'Salgados',
      preco: 7.50,
      estoque: 20,
      estoqueMinimo: 5,
      imagem: 'imagens/coxinha_frango.jpg'
    },
    {
      nome: 'Croissant de Chocolate',
      categoria: 'Doces',
      preco: 8.00,
      estoque: 20,
      estoqueMinimo: 5,
      imagem: 'imagens/trento_chocolate.jpg'
    }
  ];

  for (const c of croissants) {
    const [existing] = await db.query('SELECT id FROM produtos WHERE nome = ?', [c.nome]);
    if (existing.length === 0) {
      await db.query(
        'INSERT INTO produtos (nome, categoria, preco, estoque, estoqueMinimo, imagem, ativo) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [c.nome, c.categoria, c.preco, c.estoque, c.estoqueMinimo, c.imagem]
      );
      console.log('Produto inserido:', c.nome);
    } else {
      await db.query('UPDATE produtos SET ativo = 1, preco = ?, imagem = ? WHERE nome = ?', [c.preco, c.imagem, c.nome]);
      console.log('Produto reativado/atualizado:', c.nome);
    }
  }

  console.log('✅ Alterações no banco concluídas com sucesso!');
  process.exit(0);
}

updateProducts().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
