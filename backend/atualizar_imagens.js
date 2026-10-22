const { getDatabase } = require('./database');

const imagensPrecisas = [
  // SALGADOS
  { match: 'Hambúrgão Cheddar', img: 'imagens/hamburgao_cheddar.jpg' },
  { match: 'Hambúrgão c/ Bacon', img: 'imagens/hamburgao_bacon.jpg' },
  { match: 'Coxinha de Frango', img: 'imagens/coxinha_frango.jpg' },
  { match: 'Pastel de Carne', img: 'imagens/fundo_estufa_2.jpg' },
  { match: 'Risolis', img: 'imagens/risolis.jpg' },
  { match: 'Esfiha de Carne', img: 'imagens/esfiha_carne.jpg' },
  { match: 'Pão de Queijo', img: 'imagens/pao_de_queijo.jpg' },
  { match: 'Pão Batata Frango', img: 'imagens/pao_batata_frango.jpg' },
  { match: 'Pão Batata Calabresa', img: 'imagens/pao_batata_calabresa.jpg' },
  { match: 'Enroladinho Bauru', img: 'imagens/enroladinho_bauru.jpg' },
  { match: 'Enroladinho Salsicha', img: 'imagens/enroladinho_salsicha.jpg' },
  { match: 'Pizza', img: 'imagens/enroladinho_bauru.jpg' },
  { match: 'Kibe', img: 'imagens/kibe.jpg' },
  { match: 'Croissant', img: 'imagens/croissant.jpg' },
  
  // BEBIDAS
  { match: 'Coca-Cola Lata', img: 'imagens/coca_cola_lata_350ml.jpg' },
  { match: 'Coca-Cola Pet', img: 'imagens/coca_cola_pet_600ml.jpg' },
  { match: 'Coca-Cola Zero 350ml', img: 'imagens/coca_cola_zero_350ml.jpg' },
  { match: 'Coca-Cola Zero 200ml', img: 'imagens/coca_cola_zero_200ml.jpg' },
  { match: 'Sprite', img: 'imagens/sprite_lata_350ml.jpg' },
  { match: 'Guaraná', img: 'imagens/guarana_antarctica_zero_lata.jpg' },
  { match: 'Água Passa Quatro c/ Gás', img: 'imagens/agua_passa_quatro_com_gas.jpg' },
  { match: 'Água Passa Quatro s/ Gás', img: 'imagens/agua_passa_quatro_sem_gas.jpg' },
  { match: 'Água', img: 'imagens/agua_passa_quatro_sem_gas.jpg' },
  { match: 'Suco K-mais', img: 'imagens/suco_kmais_caju_300ml.jpg' },
  { match: 'Café Coado', img: 'imagens/cafe_coado.jpg' },

  // DOCES
  { match: 'Cremosinho', img: 'imagens/cremosinho.jpg' },
  { match: 'Geladão de Açaí', img: 'imagens/geladao.jpg' },
  { match: 'Trento', img: 'imagens/trento_chocolate.jpg' },
  { match: 'Pão de Mel', img: 'imagens/pao_de_mel_50g.jpg' },
  { match: 'Brigadeiro', img: 'imagens/pao_de_mel_50g.jpg' },

  // CALDOS
  { match: 'Caldo Sopa de Legumes', img: 'imagens/caldo_sopa_legumes.jpg' },
  { match: 'Caldo Mandioquinha', img: 'imagens/caldo_mandioquinha_frango.jpg' },
  { match: 'Caldo de Abóbora', img: 'imagens/caldo_abobora.jpg' },
  { match: 'Caldo Verde', img: 'imagens/caldo_verde_carne.jpg' },
  { match: 'Caldo Vaca Atolada', img: 'imagens/caldo_vaca_atolada.jpg' },

  // SNACKS
  { match: 'Halls', img: 'imagens/halls.jpg' },
  { match: 'Trident', img: 'imagens/trident.jpg' },

  // AÇAI
  { match: 'Açaí', img: 'imagens/geladao.jpg' }
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
