const { getDatabase } = require('./database');

async function migrarCategoriasESabores() {
  const db = await getDatabase();

  console.log('🔄 Iniciando atualização de produtos, remoção e sabores...');

  // 1. Desativar Brigadeiro e Açaí no Copo (solicitado pelo usuário)
  const [resDesativar] = await db.query(
    "UPDATE produtos SET ativo = 0 WHERE nome LIKE '%Brigadeiro%' OR nome LIKE '%Açaí no Copo%' OR nome LIKE '%Acai no Copo%'"
  );
  console.log(`🚫 Desativados Brigadeiro e Açaí no Copo: ${resDesativar.affectedRows} itens.`);

  // 2. Garantir que Cremosinho e Snacks estejam em Doces
  await db.query(
    "UPDATE produtos SET categoria = 'Doces' WHERE categoria IN ('Cremosinho', 'Snacks')"
  );

  // 3. Adicionar novos sabores de Trento (Chocolate, Branco, Avelã, Dark, Maracujá, Torta de Limão)
  const saboresTrento = [
    { nome: 'Trento Chocolate', preco: 3.50, imagem: 'imagens/trento_chocolate.jpg' },
    { nome: 'Trento Branco', preco: 3.50, imagem: 'imagens/trento_chocolate.jpg' },
    { nome: 'Trento Avelã', preco: 3.50, imagem: 'imagens/trento_chocolate.jpg' },
    { nome: 'Trento Dark 55%', preco: 3.50, imagem: 'imagens/trento_chocolate.jpg' },
    { nome: 'Trento Maracujá', preco: 3.50, imagem: 'imagens/trento_chocolate.jpg' },
    { nome: 'Trento Torta de Limão', preco: 3.50, imagem: 'imagens/trento_chocolate.jpg' }
  ];

  for (const t of saboresTrento) {
    const [exist] = await db.query('SELECT id FROM produtos WHERE nome = ?', [t.nome]);
    if (exist.length === 0) {
      await db.query(
        'INSERT INTO produtos (nome, categoria, preco, estoque, estoqueMinimo, imagem, ativo) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [t.nome, 'Doces', t.preco, 20, 5, t.imagem]
      );
      console.log(`🍫 Inserido sabor de Trento: ${t.nome}`);
    } else {
      await db.query(
        "UPDATE produtos SET categoria = 'Doces', preco = ?, ativo = 1, imagem = ? WHERE nome = ?",
        [t.preco, t.imagem, t.nome]
      );
      console.log(`🍫 Atualizado sabor de Trento: ${t.nome}`);
    }
  }

  // 4. Garantir os 4 sabores de Geladão de Açaí
  const saboresGeladao = [
    { nome: 'Geladão de Açaí - Leite Condensado', preco: 7.00, imagem: 'imagens/fundo_balcao_1.jpg' },
    { nome: 'Geladão de Açaí - Leite Ninho', preco: 7.00, imagem: 'imagens/fundo_balcao_1.jpg' },
    { nome: 'Geladão de Açaí - Maracujá', preco: 7.00, imagem: 'imagens/fundo_balcao_1.jpg' },
    { nome: 'Geladão de Açaí - Morango', preco: 7.00, imagem: 'imagens/fundo_balcao_1.jpg' }
  ];

  for (const s of saboresGeladao) {
    const [exist] = await db.query('SELECT id FROM produtos WHERE nome = ?', [s.nome]);
    if (exist.length === 0) {
      await db.query(
        'INSERT INTO produtos (nome, categoria, preco, estoque, estoqueMinimo, imagem, ativo) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [s.nome, 'Doces', s.preco, 20, 5, s.imagem]
      );
    } else {
      await db.query(
        "UPDATE produtos SET categoria = 'Doces', preco = ?, ativo = 1, imagem = ? WHERE nome = ?",
        [s.preco, s.imagem, s.nome]
      );
    }
  }

  // Desativar genérico Geladão de Açaí
  await db.query(
    "UPDATE produtos SET ativo = 0 WHERE nome = 'Geladão de Açaí' OR nome = 'Geladao de Acai'"
  );

  // 5. Conferir contagem e itens ativos
  const [ativos] = await db.query(
    "SELECT id, nome, categoria, preco FROM produtos WHERE ativo = 1 ORDER BY categoria, nome"
  );
  console.log(`✅ Total de produtos ativos no banco: ${ativos.length}`);
  console.log('📌 Amostra de produtos ativos:', ativos.map(p => `${p.categoria}: ${p.nome}`));

  console.log('🎉 Atualização de banco de dados finalizada!');
  process.exit(0);
}

migrarCategoriasESabores().catch(err => {
  console.error('❌ Erro na migração:', err);
  process.exit(1);
});
