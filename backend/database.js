require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const logger = require('./utils/logger');

let pool = null;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'doutor_user',
  password: process.env.DB_PASS || 'Doutor@2026',
  database: process.env.DB_NAME || 'doutor_paladar',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
  timezone: '-03:00'
};

/**
 * Verifica se uma coluna já existe em uma tabela via INFORMATION_SCHEMA
 */
async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.DB_NAME || 'doutor_paladar', tableName, columnName]
  );
  return rows.length > 0;
}

/**
 * Adiciona coluna de forma segura (só se não existir)
 */
async function addColumnIfNotExists(conn, table, column, definition) {
  const exists = await columnExists(conn, table, column);
  if (!exists) {
    await conn.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    logger.debug(`  Coluna adicionada: ${table}.${column}`);
  }
}

/**
 * Cria índice de forma segura (ignora se já existir)
 */
async function createIndexIfNotExists(conn, indexName, table, columns) {
  try {
    await conn.execute(`CREATE INDEX ${indexName} ON ${table}(${columns})`);
    logger.debug(`  Índice criado: ${indexName}`);
  } catch (e) {
    // Índice já existe — silenciar
  }
}

async function getDatabase() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
    try {
      const conn = await pool.getConnection();
      logger.success('Conectado ao MySQL!');
      conn.release();
      await criarTabelas();
      await criarIndices();
      await inserirDadosPadrao();
    } catch (err) {
      logger.error('Falha ao conectar ao MySQL:', err.message);
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
      pontosFidelidade INT DEFAULT 0,
      limiteCredito DECIMAL(10,2) DEFAULT 50.00,
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
      mesa VARCHAR(50) DEFAULT NULL,
      formaPagamento VARCHAR(50) DEFAULT 'dinheiro',
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
      data DATE NOT NULL,
      horario VARCHAR(10) NOT NULL,
      pratoDoDia VARCHAR(150) NOT NULL,
      vagasTotais INT NOT NULL DEFAULT 50,
      vagasOcupadas INT NOT NULL DEFAULT 0,
      preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      bloqueado TINYINT(1) DEFAULT 0,
      dataCriacao DATETIME NOT NULL
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS cliente_agendamentos (
      id INT PRIMARY KEY AUTO_INCREMENT,
      agendamentoId INT NOT NULL,
      clienteAppId INT DEFAULT NULL,
      nomeCliente VARCHAR(100) NOT NULL,
      telefone VARCHAR(20) DEFAULT '',
      turma VARCHAR(50) DEFAULT '',
      status ENUM('agendado','concluido','cancelado') DEFAULT 'agendado',
      dataCriacao DATETIME NOT NULL,
      FOREIGN KEY (agendamentoId) REFERENCES agendamentos(id) ON DELETE CASCADE
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS pedidos_status_log (
      id INT PRIMARY KEY AUTO_INCREMENT,
      pedidoId INT NOT NULL,
      statusAnterior VARCHAR(50) NOT NULL,
      statusNovo VARCHAR(50) NOT NULL,
      responsavel VARCHAR(100) DEFAULT 'Sistema',
      dataHora DATETIME NOT NULL,
      FOREIGN KEY (pedidoId) REFERENCES pedidos(id) ON DELETE CASCADE
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS configuracoes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      chave VARCHAR(50) UNIQUE NOT NULL,
      valor TEXT NOT NULL
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS chat_mensagens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      conversaId INT NOT NULL,
      autor_id INT NOT NULL,
      autor_nome VARCHAR(100) NOT NULL,
      autor_tipo ENUM('cliente','admin') NOT NULL,
      mensagem TEXT NOT NULL,
      lida TINYINT(1) DEFAULT 0,
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

    await conn.execute(`CREATE TABLE IF NOT EXISTS historico_fidelidade (
      id INT PRIMARY KEY AUTO_INCREMENT,
      clienteId INT NOT NULL,
      pedidoId INT DEFAULT NULL,
      pontos INT NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      descricao VARCHAR(255) NOT NULL,
      data DATETIME NOT NULL,
      FOREIGN KEY (clienteId) REFERENCES clientes_app(id) ON DELETE CASCADE
    )`);

    // Migrações dinâmicas seguras (via INFORMATION_SCHEMA)
    await addColumnIfNotExists(conn, 'clientes_app', 'pontosFidelidade', 'INT DEFAULT 0');
    await addColumnIfNotExists(conn, 'clientes_app', 'limiteCredito', 'DECIMAL(10,2) DEFAULT 50.00');
    await addColumnIfNotExists(conn, 'pedidos', 'mesa', 'VARCHAR(50) DEFAULT NULL');
    await addColumnIfNotExists(conn, 'pedidos', 'formaPagamento', "VARCHAR(50) DEFAULT 'dinheiro'");
    await addColumnIfNotExists(conn, 'pedidos', 'canal', "VARCHAR(30) DEFAULT 'app'");
    await addColumnIfNotExists(conn, 'agendamentos', 'data', 'DATE DEFAULT NULL');
    await addColumnIfNotExists(conn, 'agendamentos', 'horario', "VARCHAR(10) DEFAULT '12:00'");
    await addColumnIfNotExists(conn, 'agendamentos', 'pratoDoDia', "VARCHAR(150) DEFAULT ''");
    await addColumnIfNotExists(conn, 'agendamentos', 'vagasTotais', 'INT DEFAULT 50');
    await addColumnIfNotExists(conn, 'agendamentos', 'vagasOcupadas', 'INT DEFAULT 0');
    await addColumnIfNotExists(conn, 'agendamentos', 'preco', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists(conn, 'agendamentos', 'dataCriacao', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfNotExists(conn, 'clientes_fiado', 'clienteAppId', 'INT DEFAULT NULL');
    await addColumnIfNotExists(conn, 'chat_mensagens', 'conversaId', 'INT DEFAULT 0');
    await addColumnIfNotExists(conn, 'chat_mensagens', 'lida', 'TINYINT(1) DEFAULT 0');
    await addColumnIfNotExists(conn, 'vendas', 'pedidoId', 'INT DEFAULT NULL');

    logger.success('Tabelas e migrações criadas/verificadas!');
  } catch (error) {
    logger.error('Erro ao criar tabelas:', error.message);
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Cria índices para performance de consultas
 */
async function criarIndices() {
  const conn = await pool.getConnection();
  try {
    await createIndexIfNotExists(conn, 'idx_pedidos_data', 'pedidos', 'data');
    await createIndexIfNotExists(conn, 'idx_pedidos_status', 'pedidos', 'status');
    await createIndexIfNotExists(conn, 'idx_pedidos_cliente', 'pedidos', 'clienteAppId');
    await createIndexIfNotExists(conn, 'idx_vendas_data', 'vendas', 'data');
    await createIndexIfNotExists(conn, 'idx_itens_venda_vendaId', 'itens_venda', 'vendaId');
    await createIndexIfNotExists(conn, 'idx_itens_pedido_pedidoId', 'itens_pedido', 'pedidoId');
    await createIndexIfNotExists(conn, 'idx_chat_conversaId', 'chat_mensagens', 'conversaId');
    await createIndexIfNotExists(conn, 'idx_produtos_categoria', 'produtos', 'categoria');
    await createIndexIfNotExists(conn, 'idx_produtos_ativo', 'produtos', 'ativo');
    logger.success('Índices de performance verificados!');
  } catch (error) {
    logger.warn('Aviso ao criar índices:', error.message);
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
      logger.success('Admin criado: admin / admin123');
    }

    // ─── HORÁRIOS DE FUNCIONAMENTO ───────────────────────────────────────────────
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
      logger.success('Horários de agendamento inseridos');
    }

    // ─── CONFIGURAÇÕES PADRÃO ───────────────────────────────────────────────────
    const [configs] = await conn.execute('SELECT id FROM configuracoes LIMIT 1');
    if (configs.length === 0) {
      const configsPadrao = [
        ['nome_cantina', 'Cantina Doutor Paladar - IFSP'],
        ['telefone_contato', '(11) 99999-9999'],
        ['email_contato', 'cantina@ifsp.edu.br'],
        ['endereco', 'Instituto Federal - Rua Principal, 100'],
        ['meta_diaria', '500.00'],
        ['aviso_cardapio', 'Seja bem-vindo à cantina! Faça seu pedido online ou escaneie o QR Code da mesa.']
      ];
      for (const [chave, valor] of configsPadrao) {
        await conn.execute(
          'INSERT INTO configuracoes (chave, valor) VALUES (?, ?)',
          [chave, valor]
        );
      }
      logger.success('Configurações padrão inseridas');
    }

    // ─── PRODUTOS PADRÃO ────────────────────────────────────────────────────────
    const [prods] = await conn.execute('SELECT id FROM produtos LIMIT 1');
    if (prods.length === 0) {
      const produtosPadrao = [
        // --- SALGADOS ---
        ['Hambúrgão Cheddar', 'Salgados', 8.00, 15, 5, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80'],
        ['Hambúrgão c/ Bacon', 'Salgados', 9.00, 20, 5, 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&q=80'],
        ['Coxinha de Frango', 'Salgados', 5.50, 20, 10, 'https://images.unsplash.com/photo-1601924638867-3a6de6b7a500?w=400&q=80'],
        ['Pastel de Carne', 'Salgados', 7.00, 38, 10, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80'],
        ['Risolis de Queijo', 'Salgados', 5.00, 20, 10, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80'],
        ['Risolis de Carne', 'Salgados', 5.00, 20, 10, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80'],
        ['Esfiha de Carne', 'Salgados', 4.50, 20, 10, 'https://images.unsplash.com/photo-1621852003960-b7aad6e0f07f?w=400&q=80'],
        ['Pão de Queijo 90g', 'Salgados', 4.00, 30, 15, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80'],
        ['Pão Batata Frango', 'Salgados', 6.00, 20, 5, 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80'],
        ['Pão Batata Calabresa', 'Salgados', 6.00, 20, 5, 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80'],
        ['Enroladinho Bauru', 'Salgados', 5.00, 20, 10, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80'],
        ['Enroladinho Salsicha', 'Salgados', 5.00, 15, 10, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80'],
        ['Pizza Fria', 'Salgados', 6.00, 20, 5, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80'],
        ['Kibe', 'Salgados', 5.00, 20, 10, 'https://images.unsplash.com/photo-1621852003960-b7aad6e0f07f?w=400&q=80'],
        // --- BEBIDAS ---
        ['Coca-Cola Lata 350ml', 'Bebidas', 7.00, 60, 20, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80'],
        ['Coca-Cola Pet 600ml', 'Bebidas', 7.00, 60, 20, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80'],
        ['Coca-Cola Zero 350ml', 'Bebidas', 7.00, 36, 10, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80'],
        ['Coca-Cola Zero 200ml', 'Bebidas', 5.00, 72, 15, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80'],
        ['Sprite Lata 350ml', 'Bebidas', 6.00, 24, 10, 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400&q=80'],
        ['Guaraná Antarctica Zero Lata', 'Bebidas', 5.00, 60, 20, 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400&q=80'],
        ['Água Passa Quatro c/ Gás', 'Bebidas', 4.00, 36, 15, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80'],
        ['Água Passa Quatro s/ Gás', 'Bebidas', 4.00, 48, 15, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80'],
        ['Suco K-mais Integral 300ml', 'Bebidas', 5.00, 36, 10, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80'],
        ['Suco K-mais Uva 300ml', 'Bebidas', 5.00, 12, 5, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80'],
        ['Suco K-mais Goiaba 300ml', 'Bebidas', 5.00, 12, 5, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80'],
        ['Suco K-mais Caju 300ml', 'Bebidas', 5.00, 12, 5, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80'],
        ['Café Coado (copo)', 'Bebidas', 3.00, 99, 20, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80'],
        // --- DOCES & SORVETES ---
        ['Cremosinho Sorvete Iogurte', 'Doces', 2.50, 30, 10, 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&q=80'],
        ['Geladão de Açaí', 'Doces', 7.00, 10, 5, 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&q=80'],
        ['Trento Chocolate', 'Doces', 3.50, 24, 10, 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80'],
        ['Trento Branco', 'Doces', 3.50, 24, 10, 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80'],
        ['Pão de Mel 50g', 'Doces', 4.00, 20, 10, 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80'],
        ['Brigadeiro', 'Doces', 3.50, 80, 15, 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&q=80'],
        // --- CALDOS ---
        ['Caldo Sopa de Legumes', 'Caldos', 20.00, 5, 2, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80'],
        ['Caldo Mandioquinha c/ Frango', 'Caldos', 20.00, 5, 2, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80'],
        ['Caldo de Abóbora Seca Barriga', 'Caldos', 20.00, 5, 2, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80'],
        ['Caldo Verde c/ Carne', 'Caldos', 20.00, 5, 2, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80'],
        ['Caldo Vaca Atolada', 'Caldos', 20.00, 5, 2, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80'],
        // --- SNACKS ---
        ['Halls Melancia', 'Snacks', 2.00, 21, 5, 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&q=80'],
        ['Halls Morango', 'Snacks', 2.00, 21, 5, 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&q=80'],
        ['Halls Menta', 'Snacks', 2.00, 21, 5, 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&q=80'],
        ['Trident Hortela', 'Snacks', 2.50, 21, 5, 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&q=80'],
        ['Trident Morango', 'Snacks', 2.50, 21, 5, 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&q=80'],
        ['Trident Tutti Frutti', 'Snacks', 2.50, 21, 5, 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&q=80'],
        // --- CREMOSINHO / POLPAS ---
        ['Cremosinho Abacaxi', 'Cremosinho', 4.00, 30, 5, 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=400&q=80'],
        ['Cremosinho Maracujá', 'Cremosinho', 4.00, 30, 5, 'https://images.unsplash.com/photo-1604495772376-9657f0035a54?w=400&q=80'],
        ['Cremosinho Morango', 'Cremosinho', 4.00, 30, 5, 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&q=80'],
        ['Açaí no Copo', 'Cremosinho', 8.50, 25, 5, 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&q=80']
      ];
      for (const [nome, categoria, preco, estoque, estoqueMinimo, imagem] of produtosPadrao) {
        await conn.execute(
          'INSERT INTO produtos (nome, categoria, preco, estoque, estoqueMinimo, imagem, ativo) VALUES (?, ?, ?, ?, ?, ?, 1)',
          [nome, categoria, preco, estoque, estoqueMinimo, imagem]
        );
      }
      logger.success('48 Produtos oficiais inseridos no banco de dados');
    }
  } catch (error) {
    logger.error('Erro ao inserir dados padrão:', error.message);
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
