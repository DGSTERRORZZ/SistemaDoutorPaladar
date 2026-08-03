require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool = null;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'doutor_user',
  password: process.env.DB_PASS || 'Doutor@2026',
  database: process.env.DB_NAME || 'doutor_paladar',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '-03:00'
};

async function getDatabase() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
    try {
      const conn = await pool.getConnection();
      console.log('✅ Conectado ao MySQL!');
      conn.release();
      await criarTabelas();
      await inserirDadosPadrao();
    } catch (err) {
      console.error('❌ Falha ao conectar ao MySQL:', err.message);
      throw err;
    }
  }
  return pool;
}

async function criarTabelas() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`CREATE TABLE IF NOT EXISTS admin_users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      nome VARCHAR(100) NOT NULL
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS clientes_app (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(100) NOT NULL,
      usuario VARCHAR(50) UNIQUE NOT NULL,
      telefone VARCHAR(20) UNIQUE NOT NULL,
      turma VARCHAR(50) DEFAULT '',
      senha_hash VARCHAR(255) NOT NULL,
      foto VARCHAR(500) DEFAULT '',
      totalPedidos INT DEFAULT 0,
      dataCadastro DATETIME NOT NULL
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS fornecedores (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(100) NOT NULL,
      cnpj VARCHAR(20) DEFAULT '',
      telefone VARCHAR(20) DEFAULT '',
      email VARCHAR(100) DEFAULT '',
      endereco TEXT
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS produtos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(100) NOT NULL,
      categoria VARCHAR(50) NOT NULL,
      preco DECIMAL(10,2) NOT NULL,
      estoque INT NOT NULL DEFAULT 0,
      estoqueMinimo INT NOT NULL DEFAULT 10,
      fornecedorId INT DEFAULT NULL,
      imagem VARCHAR(500) DEFAULT '',
      ativo TINYINT(1) DEFAULT 1
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS vendas (
      id INT PRIMARY KEY AUTO_INCREMENT,
      total DECIMAL(10,2) NOT NULL,
      formaPagamento VARCHAR(50) NOT NULL,
      data DATETIME NOT NULL
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS itens_venda (
      id INT PRIMARY KEY AUTO_INCREMENT,
      vendaId INT NOT NULL,
      produtoId INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      quantidade INT NOT NULL,
      precoUnitario DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (vendaId) REFERENCES vendas(id) ON DELETE CASCADE
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS pedidos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      clienteAppId INT DEFAULT NULL,
      nomeCliente VARCHAR(100) NOT NULL,
      turma VARCHAR(50) DEFAULT '',
      horarioRetirada VARCHAR(20) NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      status ENUM('pendente','confirmado','preparando','pronto','entregue','recusado') DEFAULT 'pendente',
      data DATETIME NOT NULL,
      observacao TEXT DEFAULT NULL
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS itens_pedido (
      id INT PRIMARY KEY AUTO_INCREMENT,
      pedidoId INT NOT NULL,
      produtoId INT NOT NULL,
      nome VARCHAR(100) NOT NULL,
      quantidade INT NOT NULL,
      precoUnitario DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (pedidoId) REFERENCES pedidos(id) ON DELETE CASCADE
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS clientes_fiado (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(100) NOT NULL,
      turma VARCHAR(50) DEFAULT '',
      telefone VARCHAR(20) DEFAULT '',
      limite DECIMAL(10,2) DEFAULT 50.00,
      saldoDevedor DECIMAL(10,2) DEFAULT 0.00,
      dataCadastro DATETIME NOT NULL
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS dividas (
      id INT PRIMARY KEY AUTO_INCREMENT,
      clienteId INT NOT NULL,
      data DATETIME NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      valorPago DECIMAL(10,2) DEFAULT 0.00,
      pago TINYINT(1) DEFAULT 0,
      FOREIGN KEY (clienteId) REFERENCES clientes_fiado(id) ON DELETE CASCADE
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS itens_divida (
      id INT PRIMARY KEY AUTO_INCREMENT,
      dividaId INT NOT NULL,
      produtoId INT NOT NULL,
      quantidade INT NOT NULL,
      precoUnitario DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (dividaId) REFERENCES dividas(id) ON DELETE CASCADE
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS pagamentos_fiado (
      id INT PRIMARY KEY AUTO_INCREMENT,
      clienteId INT NOT NULL,
      dividaId INT NOT NULL,
      valor DECIMAL(10,2) NOT NULL,
      data DATETIME NOT NULL,
      FOREIGN KEY (clienteId) REFERENCES clientes_fiado(id),
      FOREIGN KEY (dividaId) REFERENCES dividas(id)
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS despesas (
      id INT PRIMARY KEY AUTO_INCREMENT,
      descricao TEXT NOT NULL,
      valor DECIMAL(10,2) NOT NULL,
      categoria VARCHAR(50) NOT NULL DEFAULT 'Outros',
      data DATETIME NOT NULL
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS agendamentos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      horarioInicio VARCHAR(10) NOT NULL,
      horarioFim VARCHAR(10) NOT NULL,
      limitePedidos INT DEFAULT 20,
      bloqueado TINYINT(1) DEFAULT 0
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS configuracoes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      chave VARCHAR(50) UNIQUE NOT NULL,
      valor TEXT NOT NULL
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS chat_mensagens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      mensagem TEXT NOT NULL,
      autor_id VARCHAR(50) NOT NULL,
      autor_nome VARCHAR(100) NOT NULL,
      autor_tipo VARCHAR(20) NOT NULL,
      conversa_id VARCHAR(50) DEFAULT NULL,
      data DATETIME NOT NULL
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS compras_fornecedor (
      id INT PRIMARY KEY AUTO_INCREMENT,
      fornecedorId INT NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      status VARCHAR(30) DEFAULT 'pedido',
      data DATETIME NOT NULL,
      FOREIGN KEY (fornecedorId) REFERENCES fornecedores(id)
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS itens_compra (
      id INT PRIMARY KEY AUTO_INCREMENT,
      compraId INT NOT NULL,
      produtoId INT NOT NULL,
      quantidade INT NOT NULL,
      precoUnitario DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (compraId) REFERENCES compras_fornecedor(id) ON DELETE CASCADE
    )`);

    console.log('✅ Tabelas criadas/verificadas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error.message);
    throw error;
  } finally {
    conn.release();
  }
}

async function inserirDadosPadrao() {
  const conn = await pool.getConnection();
  try {

    // ─── ADMIN PADRÃO ───────────────────────────────────────────────────────────
    const [admin] = await conn.execute('SELECT id FROM admin_users WHERE username = ?', ['admin']);
    if (admin.length === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await conn.execute(
        'INSERT INTO admin_users (username, senha_hash, nome) VALUES (?, ?, ?)',
        ['admin', hash, 'Deyse Nayana']
      );
      console.log('👑 Admin criado: admin / admin123');
    }

    // ─── HORÁRIOS DE FUNCIONAMENTO ───────────────────────────────────────────────
    // Cantina Instituto Federal — dois turnos diários
    const [horarios] = await conn.execute('SELECT id FROM agendamentos LIMIT 1');
    if (horarios.length === 0) {
      const horariosPadrao = [
        ['07:00', '07:30', 30],
        ['07:30', '08:00', 30],
        ['10:00', '10:30', 40],
        ['10:30', '11:00', 40],
        ['12:00', '12:30', 40],
        ['12:30', '13:00', 40],
        ['15:30', '16:00', 30],
        ['16:00', '16:30', 30],
        ['19:00', '19:30', 20],
        ['19:30', '20:00', 20],
        ['21:30', '22:00', 20]
      ];
      for (const [inicio, fim, limite] of horariosPadrao) {
        await conn.execute(
          'INSERT INTO agendamentos (horarioInicio, horarioFim, limitePedidos, bloqueado) VALUES (?, ?, ?, 0)',
          [inicio, fim, limite]
        );
      }
      console.log('✅ Horários da cantina inseridos');
    }

    // ─── CONFIGURAÇÕES ───────────────────────────────────────────────────────────
    const [configs] = await conn.execute('SELECT id FROM configuracoes LIMIT 1');
    if (configs.length === 0) {
      const configsPadrao = [
        ['nome_cantina',          'Doutor Paladar'],
        ['subtitulo_cantina',     'Cafeteria & Lanchonete · Instituto Federal'],
        ['meta_vendas_diaria',    '800'],
        ['meta_vendas_mensal',    '16000'],
        ['limite_fiado_aluno',    '50'],
        ['horario_abertura',      '07:00'],
        ['horario_fechamento',    '22:00'],
        ['taxa_entrega',          '0'],
        ['moeda',                 'BRL'],
        ['telefone_cantina',      '(12) 3662-4241'],
        ['email_cantina',         'flaviodamata2008@hotmail.com'],
        ['endereco_cantina',      'Rua Monsenhor José Vita, 280 – Abernéssia, Campos do Jordão/SP'],
        ['cnpj_responsavel',      '11.541.868/0001-15']
      ];
      for (const [chave, valor] of configsPadrao) {
        await conn.execute(
          'INSERT IGNORE INTO configuracoes (chave, valor) VALUES (?, ?)',
          [chave, valor]
        );
      }
      console.log('✅ Configurações inseridas');
    }

    // ─── FORNECEDORES (extraídos das notas fiscais) ──────────────────────────────
    const [forns] = await conn.execute('SELECT id FROM fornecedores LIMIT 1');
    if (forns.length === 0) {
      const fornecedores = [
        // id 1 — bebidas (NF JB Distribuidora)
        [
          'JB Distribuidora de Bebidas e Alimentos',
          '17.722.006/0001-75',
          '(35) 9989-7499',
          '',
          'Estrada Municipal da Urtiga, 1 – São Bento do Sapucaí/SP'
        ],
        // id 2 — sucos K-mais (NF Marosa)
        [
          'Marosa Distribuidora',
          '41.993.234/0001-64',
          '',
          '',
          'Avenida Califórnia, 387 – Jardim Califórnia, Jacareí/SP – CEP 12305-670'
        ],
        // id 3 — salgados congelados (NF Flavio/Vhsys)
        [
          'Flavio Francisco da Mata – Vhsys',
          '11.541.868/0001-15',
          '(12) 3662-4241',
          'flaviodamata2008@hotmail.com',
          'Rua Brigadeiro Jordão, 995 Loja 1 – Vila Abernéssia, Campos do Jordão/SP'
        ],
        // id 4 — geladão de açaí (recibo Pablo)
        [
          'Pablo / José Luiz de Silva – Geladão de Açaí',
          '',
          '(12) 99610-9823',
          '',
          'Campos do Jordão/SP'
        ],
        // id 5 — polpas de fruta (pedido Camarão Distribuidor)
        [
          'Camarão Distribuidor – Polpas Naturais Tropical',
          '',
          '(12) 99618-1141',
          '',
          'Campos do Jordão/SP'
        ]
      ];
      for (const [nome, cnpj, telefone, email, endereco] of fornecedores) {
        await conn.execute(
          'INSERT INTO fornecedores (nome, cnpj, telefone, email, endereco) VALUES (?, ?, ?, ?, ?)',
          [nome, cnpj, telefone, email, endereco]
        );
      }
      console.log('✅ 5 fornecedores reais inseridos');
    }

    // ─── PRODUTOS ────────────────────────────────────────────────────────────────
    // Baseados nas notas fiscais, cartazes e fotos do balcão
    // Estrutura: [nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem]
    const [prods] = await conn.execute('SELECT id FROM produtos LIMIT 1');
    if (prods.length === 0) {

      // --- SALGADOS (fornecedor id=3: Flavio/Vhsys) ---
      const salgados = [
        // Imagens corrigidas: cada produto com foto correspondente real
        ['Hambúrgão Cheddar',         'Salgados', 8.00,  15,  5,  3, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80'],
        ['Coxinha de Frango',          'Salgados', 5.50,  20,  10, 3, 'https://images.unsplash.com/photo-1601924638867-3a6de6b7a500?w=400&q=80'],
        ['Risolis de Queijo',          'Salgados', 5.00,  20,  10, 3, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80'],
        ['Risolis de Carne',           'Salgados', 5.00,  20,  10, 3, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80'],
        ['Esfiha de Carne',            'Salgados', 4.50,  20,  10, 3, 'https://images.unsplash.com/photo-1621852003960-b7aad6e0f07f?w=400&q=80'],
        ['Pão de Queijo 90g',          'Salgados', 4.00,  30,  10, 3, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80'],
        ['Pão Batata Frango',          'Salgados', 6.00,  20,  8,  3, 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80'],
        ['Pão Batata Calabresa',       'Salgados', 6.00,  20,  8,  3, 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80'],
        ['Enroladinho Bauru',          'Salgados', 5.00,  20,  8,  3, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80'],
        ['Enroladinho Salsicha',       'Salgados', 5.00,  15,  8,  3, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80'],
        ['Hambúrgão c/ Bacon',         'Salgados', 9.00,  20,  5,  3, 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&q=80'],
        ['Pizza Fria',                 'Salgados', 6.00,  20,  5,  3, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80'],
        ['Kibe',                       'Salgados', 5.00,  20,  8,  3, 'https://images.unsplash.com/photo-1621852003960-b7aad6e0f07f?w=400&q=80'],
      ];

      // --- BEBIDAS (fornecedor id=1: JB Distribuidora) ---
      const bebidas = [
        ['Coca-Cola Lata 350ml',        'Bebidas', 7.00,  60, 20, 1, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80'],
        ['Coca-Cola Pet 600ml',         'Bebidas', 7.00,  60, 20, 1, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80'],
        ['Coca-Cola Zero 350ml',        'Bebidas', 7.00,  36, 12, 1, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80'],
        ['Coca-Cola Zero 200ml',        'Bebidas', 5.00,  72, 24, 1, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80'],
        ['Sprite Lata 350ml',           'Bebidas', 6.00,  24, 12, 1, 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400&q=80'],
        ['Guaraná Antarctica Zero Lata','Bebidas', 5.00,  60, 12, 1, 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400&q=80'],
        ['Água Passa Quatro c/ Gás',    'Bebidas', 4.00,  36, 12, 1, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80'],
        ['Água Passa Quatro s/ Gás',    'Bebidas', 4.00,  48, 12, 1, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80'],
        // Sucos K-mais (fornecedor id=2: Marosa)
        ['Suco K-mais Integral 300ml',  'Bebidas', 5.00,  36, 12, 2, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80'],
        ['Suco K-mais Uva 300ml',       'Bebidas', 5.00,  12, 6,  2, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80'],
        ['Suco K-mais Goiaba 300ml',    'Bebidas', 5.00,  12, 6,  2, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80'],
        ['Suco K-mais Caju 300ml',      'Bebidas', 5.00,  12, 6,  2, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80'],
        // Café da cantina (balcão cantinho do café)
        ['Café Coado (copo)',            'Bebidas', 3.00,  99, 10, null, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80'],
      ];

      // --- DOCES E SNACKS (balcão + fotos) ---
      const docesSnacks = [
        // Cartaz Cremosinho
        ['Cremosinho Sorvete Iogurte',  'Doces', 2.50,  30, 10, null, 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&q=80'],
        // Geladão de Açaí (fornecedor id=4: Pablo)
        ['Geladão de Açaí',             'Doces', 7.00,  10, 5,  4, 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&q=80'],
        // Chocolates e biscoitos vistos no balcão (imagens)
        ['Trento Chocolate',            'Doces', 3.50,  24, 8,  null, 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80'],
        ['Trento Branco',               'Doces', 3.50,  24, 8,  null, 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80'],
        ['Pão de Mel 50g',              'Doces', 4.00,  20, 8,  3,   'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80'],
        // Balas e chicletes (NF JB Distribuidora)
        ['Halls Melancia cx/21',        'Snacks', 5.50, 1,  1,  1, ''],
        ['Halls Morango cx/21',         'Snacks', 5.50, 1,  1,  1, ''],
        ['Halls Menta cx/21',           'Snacks', 5.50, 1,  1,  1, ''],
        ['Halls Cereja cx/21',          'Snacks', 5.50, 1,  1,  1, ''],
        ['Halls Extra Forte cx/21',     'Snacks', 5.50, 1,  1,  1, ''],
        ['Trident Hortela cx/21',       'Snacks', 6.00, 1,  1,  1, ''],
        ['Trident Morango cx/21',       'Snacks', 6.00, 1,  1,  1, ''],
        ['Trident Menta cx/21',         'Snacks', 6.00, 1,  1,  1, ''],
        ['Trident Tutti Frutti cx/21',  'Snacks', 6.00, 1,  1,  1, ''],
        ['Trident XSenses cx/21',       'Snacks', 6.00, 1,  1,  1, ''],
        ['Ketchup Sache Predilecta',    'Snacks', 1.00, 144,20, 1, ''],
      ];

      // --- CALDOS CONGELADOS (cartaz na parede) ---
      const caldos = [
        ['Caldo Sopa de Legumes',          'Caldos', 20.00, 5, 3, null, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80'],
        ['Caldo Mandioquinha c/ Frango',   'Caldos', 20.00, 5, 3, null, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80'],
        ['Caldo de Abóbora Seca Barriga',  'Caldos', 20.00, 5, 3, null, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80'],
        ['Caldo Verde c/ Carne',           'Caldos', 20.00, 5, 3, null, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80'],
        ['Caldo Vaca Atolada',             'Caldos', 20.00, 5, 3, null, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80'],
      ];

      // --- CREMOSINHO / POLPAS DE FRUTA (fornecedor id=5: Camarão Distribuidor) ---
      // Categoria renomeada de 'Polpas' para 'Cremosinho' conforme solicitado
      const polpas = [
        ['Polpa Abacaxi',               'Cremosinho', 8.00, 10, 5, 5, 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=400&q=80'],
        ['Polpa Acerola',               'Cremosinho', 8.00, 10, 5, 5, 'https://images.unsplash.com/photo-1559181567-c3190ca9be23?w=400&q=80'],
        ['Polpa Abacaxi c/ Hortelã',    'Cremosinho', 8.00, 10, 5, 5, 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=400&q=80'],
        ['Polpa Caju',                  'Cremosinho', 8.00, 10, 5, 5, 'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=400&q=80'],
        ['Polpa Goiaba',                'Cremosinho', 8.00, 10, 5, 5, 'https://images.unsplash.com/photo-1536511132770-e5058c7e8c46?w=400&q=80'],
        ['Polpa Guaraná c/ Açaí',       'Cremosinho', 9.00, 10, 5, 5, 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&q=80'],
        ['Polpa Laranja',               'Cremosinho', 8.00, 10, 5, 5, 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=400&q=80'],
        ['Polpa Laranja c/ Acerola',    'Cremosinho', 8.00, 10, 5, 5, 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=400&q=80'],
        ['Polpa Manga',                 'Cremosinho', 8.00, 10, 5, 5, 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&q=80'],
        ['Polpa Maracujá',              'Cremosinho', 8.00, 10, 5, 5, 'https://images.unsplash.com/photo-1604495772376-9657f0035a54?w=400&q=80'],
        ['Polpa Uva',                   'Cremosinho', 8.00, 10, 5, 5, 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=80'],
      ];

      const todosProdutos = [...salgados, ...bebidas, ...docesSnacks, ...caldos, ...polpas];

      for (const [nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem] of todosProdutos) {
        await conn.execute(
          'INSERT INTO produtos (nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [nome, categoria, preco, estoque, estoqueMinimo, fornecedorId, imagem]
        );
      }
      console.log(`✅ ${todosProdutos.length} produtos reais inseridos`);
    }

    // ─── COMPRAS DOS FORNECEDORES (notas fiscais registradas) ────────────────────
    const [compras] = await conn.execute('SELECT id FROM compras_fornecedor LIMIT 1');
    if (compras.length === 0) {

      // NF JB Distribuidora 01/06/2026 — R$ 1.403,01
      const [r1] = await conn.execute(
        "INSERT INTO compras_fornecedor (fornecedorId, total, status, data) VALUES (1, 1403.01, 'recebido', '2026-06-01 14:12:45')"
      );
      const compraJB = r1.insertId;

      // NF Marosa Pedido 20501 10/03/2026 — R$ 368,40
      const [r2] = await conn.execute(
        "INSERT INTO compras_fornecedor (fornecedorId, total, status, data) VALUES (2, 368.40, 'recebido', '2026-03-10 00:00:00')"
      );
      const compraMarosa = r2.insertId;

      // NF Flavio/Vhsys Pedido 40425 31/05/2026 — R$ 1.739,55
      const [r3] = await conn.execute(
        "INSERT INTO compras_fornecedor (fornecedorId, total, status, data) VALUES (3, 1739.55, 'recebido', '2026-05-31 10:36:00')"
      );
      const compraFlavio = r3.insertId;

      // Recibo Pablo — Geladão de Açaí 30/03/2026 — R$ 220,00
      const [r4] = await conn.execute(
        "INSERT INTO compras_fornecedor (fornecedorId, total, status, data) VALUES (4, 220.00, 'recebido', '2026-03-30 00:00:00')"
      );
      const compraPablo = r4.insertId;

      // Pedido Camarão Distribuidor 02/06/2026 — R$ 24,00 (50 polpas)
      const [r5] = await conn.execute(
        "INSERT INTO compras_fornecedor (fornecedorId, total, status, data) VALUES (5, 24.00, 'recebido', '2026-06-02 00:00:00')"
      );
      const compraCamarao = r5.insertId;

      console.log('✅ 5 compras de fornecedores registradas');
    }

    // ─── DESPESAS REAIS (baseadas nos valores das notas) ─────────────────────────
    const [desps] = await conn.execute('SELECT id FROM despesas LIMIT 1');
    if (desps.length === 0) {
      const despesas = [
        ['Compra JB Distribuidora – bebidas e balas (NF 97116)',   1403.01, 'Compras', '2026-06-01 14:12:45'],
        ['Compra Marosa Distribuidora – sucos K-mais (Pedido 20501)', 368.40, 'Compras', '2026-03-10 00:00:00'],
        ['Compra Flavio Francisco da Mata – salgados congelados (Pedido 40425)', 1739.55, 'Compras', '2026-05-31 10:36:00'],
        ['Compra Pablo – Geladão de Açaí (40 unidades)',            220.00, 'Compras', '2026-03-30 00:00:00'],
        ['Compra Instituto Federal – salgados avulsos (23/4)',       502.00, 'Compras', '2026-04-23 00:00:00'],
        ['Compra Camarão Distribuidor – polpas de fruta (50 un)',     24.00, 'Compras', '2026-06-02 00:00:00'],
      ];
      for (const [descricao, valor, categoria, data] of despesas) {
        await conn.execute(
          'INSERT INTO despesas (descricao, valor, categoria, data) VALUES (?, ?, ?, ?)',
          [descricao, valor, categoria, data]
        );
      }
      console.log('✅ Despesas reais inseridas');
    }

  } catch (error) {
    console.error('❌ Erro ao inserir dados padrão:', error.message);
  } finally {
    conn.release();
  }
}

async function query(sql, params = []) {
  const db = await getDatabase();
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function execute(sql, params = []) {
  const db = await getDatabase();
  const [result] = await db.execute(sql, params);
  return result;
}

module.exports = { getDatabase, query, queryOne, execute };
