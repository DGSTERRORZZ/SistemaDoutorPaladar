const { getDatabase } = require('./database');

const imagensPrecisas = [
  // SALGADOS
  { match: 'Hambúrgão Cheddar', img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80' },
  { match: 'Hambúrgão c/ Bacon', img: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=500&q=80' },
  { match: 'Coxinha de Frango', img: 'https://images.unsplash.com/photo-1601924638867-3a6de6b7a500?w=500&q=80' },
  { match: 'Pastel de Carne', img: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&q=80' },
  { match: 'Risolis de Queijo', img: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=500&q=80' },
  { match: 'Risolis de Carne', img: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=500&q=80' },
  { match: 'Esfiha de Carne', img: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=500&q=80' },
  { match: 'Pão de Queijo', img: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=500&q=80' },
  { match: 'Pão Batata Frango', img: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&q=80' },
  { match: 'Pão Batata Calabresa', img: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&q=80' },
  { match: 'Enroladinho Bauru', img: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500&q=80' },
  { match: 'Enroladinho Salsicha', img: 'https://images.unsplash.com/photo-1627054234591-6284e3118cf6?w=500&q=80' },
  { match: 'Pizza Fria', img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&q=80' },
  { match: 'Kibe', img: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80' },
  
  // BEBIDAS
  { match: 'Coca-Cola Lata', img: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&q=80' },
  { match: 'Coca-Cola Pet', img: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&q=80' },
  { match: 'Coca-Cola Zero', img: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&q=80' },
  { match: 'Sprite', img: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=500&q=80' },
  { match: 'Guaraná', img: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&q=80' },
  { match: 'Água', img: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=500&q=80' },
  { match: 'Suco K-mais Integral', img: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=500&q=80' },
  { match: 'Suco K-mais Uva', img: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=500&q=80' },
  { match: 'Suco K-mais Goiaba', img: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&q=80' },
  { match: 'Suco K-mais Caju', img: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&q=80' },
  { match: 'Café Coado', img: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80' },

  // DOCES
  { match: 'Cremosinho Sorvete', img: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=500&q=80' },
  { match: 'Geladão de Açaí', img: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=500&q=80' },
  { match: 'Trento Chocolate', img: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=500&q=80' },
  { match: 'Trento Branco', img: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=500&q=80' },
  { match: 'Pão de Mel', img: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=500&q=80' },
  { match: 'Brigadeiro', img: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&q=80' },

  // CALDOS
  { match: 'Caldo Sopa de Legumes', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80' },
  { match: 'Caldo Mandioquinha', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80' },
  { match: 'Caldo de Abóbora', img: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=500&q=80' },
  { match: 'Caldo Verde', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80' },
  { match: 'Caldo Vaca Atolada', img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80' },

  // SNACKS
  { match: 'Halls Melancia', img: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500&q=80' },
  { match: 'Halls Morango', img: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500&q=80' },
  { match: 'Halls Menta', img: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500&q=80' },
  { match: 'Trident Hortela', img: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500&q=80' },
  { match: 'Trident Morango', img: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500&q=80' },
  { match: 'Trident Tutti Frutti', img: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500&q=80' },

  // CREMOSINHO
  { match: 'Cremosinho Abacaxi', img: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=500&q=80' },
  { match: 'Cremosinho Maracujá', img: 'https://images.unsplash.com/photo-1604495772376-9657f0035a54?w=500&q=80' },
  { match: 'Cremosinho Morango', img: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=500&q=80' },
  { match: 'Açaí no Copo', img: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=500&q=80' }
];

async function run() {
  const db = await getDatabase();
  for (const item of imagensPrecisas) {
    const pattern = '%' + item.match + '%';
    await db.execute('UPDATE produtos SET imagem = ? WHERE nome LIKE ?', [item.img, pattern]);
  }
  console.log('✅ Imagens dos produtos atualizadas com sucesso no MySQL!');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
