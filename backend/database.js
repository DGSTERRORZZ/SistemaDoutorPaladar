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
  timezone: '-03:00',
  ssl: process.env.DB_SSL === 'true' || process.env.DB_HOST?.includes('tidbcloud.com') ? { rejectUnauthorized: false } : undefined
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

/**
 * Adiciona chave estrangeira de forma segura
 */
async function addForeignKeyIfNotExists(conn, tableName, constraintName, fkSql) {
  try {
    const [rows] = await conn.execute(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
      [process.env.DB_NAME || 'doutor_paladar', tableName, constraintName]
    );
    if (rows.length === 0) {
      await conn.execute(`ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${fkSql}`);
      logger.debug(`  FK adicionada: ${constraintName}`);
    }
  } catch (e) {
    logger.warn(`  Aviso FK ${constraintName}: ${e.message}`);
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
    await conn.execute(`CREATE TABLE IF NOT EXISTS usuarios (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nome VARCHAR(100) NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      telefone VARCHAR(20) UNIQUE DEFAULT NULL,
      turma VARCHAR(50) DEFAULT '',
      senha_hash VARCHAR(255) NOT NULL,
      tipo ENUM('cliente', 'visitante', 'administrador') NOT NULL DEFAULT 'cliente',
      foto VARCHAR(500) DEFAULT '',
      totalPedidos INT DEFAULT 0,
      pontosFidelidade INT DEFAULT 0,
      limiteCredito DECIMAL(10,2) DEFAULT 50.00,
      saldoDevedor DECIMAL(10,2) DEFAULT 0.00,
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

    await conn.execute(`CREATE TABLE IF NOT EXISTS dividas (
      id INT PRIMARY KEY AUTO_INCREMENT,
      clienteId INT NOT NULL,
      data DATETIME NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      valorPago DECIMAL(10,2) DEFAULT 0.00,
      pago TINYINT(1) DEFAULT 0,
      FOREIGN KEY (clienteId) REFERENCES usuarios(id) ON DELETE CASCADE
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
      FOREIGN KEY (clienteId) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (dividaId) REFERENCES dividas(id) ON DELETE CASCADE
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
      FOREIGN KEY (clienteId) REFERENCES usuarios(id) ON DELETE CASCADE
    )`);

    // Tabela modular de promoções e cupons para cantinas
    await conn.execute(`CREATE TABLE IF NOT EXISTS promocoes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      codigo VARCHAR(50) UNIQUE DEFAULT NULL,
      nome VARCHAR(100) NOT NULL,
      descricao VARCHAR(255) DEFAULT '',
      tipo ENUM('desconto_porcentagem', 'desconto_fixo', 'primeira_compra', 'pontos_dobro', 'combo_categoria') NOT NULL,
      valor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      valor_minimo_pedido DECIMAL(10,2) DEFAULT 0.00,
      desconto_maximo DECIMAL(10,2) DEFAULT NULL,
      regras_json JSON DEFAULT NULL,
      ativa TINYINT(1) DEFAULT 1,
      data_inicio DATETIME DEFAULT NULL,
      data_fim DATETIME DEFAULT NULL,
      usos_maximos INT DEFAULT NULL,
      usos_atuais INT DEFAULT 0,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de Blacklist de IPs (Bloqueio manual ou automático por país/suspeita)
    await conn.execute(`CREATE TABLE IF NOT EXISTS ip_blacklist (
      id INT PRIMARY KEY AUTO_INCREMENT,
      ip VARCHAR(45) UNIQUE NOT NULL,
      motivo VARCHAR(255) NOT NULL,
      pais VARCHAR(10) DEFAULT 'XX',
      bloqueado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expira_em DATETIME DEFAULT NULL,
      criado_por VARCHAR(100) DEFAULT 'Sistema (Segurança)'
    )`);

    // Tabela de Logs de Auditoria e Tentativas de Invasão / Ataques de Força Bruta
    await conn.execute(`CREATE TABLE IF NOT EXISTS logs_seguranca (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tipo VARCHAR(50) NOT NULL,
      ip VARCHAR(45) NOT NULL,
      detalhes TEXT NOT NULL,
      bloqueado TINYINT(1) DEFAULT 0,
      dataHora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migrações dinâmicas seguras (via INFORMATION_SCHEMA)
    await addColumnIfNotExists(conn, 'usuarios', 'pontosFidelidade', 'INT DEFAULT 0');
    await addColumnIfNotExists(conn, 'usuarios', 'limiteCredito', 'DECIMAL(10,2) DEFAULT 50.00');
    await addColumnIfNotExists(conn, 'usuarios', 'cargo', "VARCHAR(50) DEFAULT 'atendente'");
    await addColumnIfNotExists(conn, 'usuarios', 'alçada_max_desconto', 'DECIMAL(5,2) DEFAULT 10.00');
    await addColumnIfNotExists(conn, 'usuarios', 'two_factor_code', 'VARCHAR(10) DEFAULT NULL');
    await addColumnIfNotExists(conn, 'usuarios', 'two_factor_expira', 'DATETIME DEFAULT NULL');
    await addColumnIfNotExists(conn, 'usuarios', 'two_factor_remember_until', 'DATETIME DEFAULT NULL');
    await addColumnIfNotExists(conn, 'usuarios', 'tentativas_login', 'INT DEFAULT 0');
    await addColumnIfNotExists(conn, 'usuarios', 'bloqueado_ate', 'DATETIME DEFAULT NULL');
    await addColumnIfNotExists(conn, 'usuarios', 'saldoDevedor', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists(conn, 'usuarios', 'bloqueado', 'TINYINT(1) DEFAULT 0');
    await addColumnIfNotExists(conn, 'usuarios', 'tipo', "ENUM('cliente', 'visitante', 'administrador') NOT NULL DEFAULT 'cliente'");
    await addColumnIfNotExists(conn, 'produtos', 'ativo', 'TINYINT(1) DEFAULT 1');
    await addColumnIfNotExists(conn, 'pedidos', 'mesa', 'VARCHAR(50) DEFAULT NULL');
    await addColumnIfNotExists(conn, 'pedidos', 'formaPagamento', "VARCHAR(50) DEFAULT 'dinheiro'");
    await addColumnIfNotExists(conn, 'pedidos', 'canal', "VARCHAR(30) DEFAULT 'app'");
    await addColumnIfNotExists(conn, 'pedidos', 'subtotal', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
    await addColumnIfNotExists(conn, 'pedidos', 'desconto', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
    await addColumnIfNotExists(conn, 'pedidos', 'descontoPontos', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
    await addColumnIfNotExists(conn, 'pedidos', 'pontosUsados', 'INT NOT NULL DEFAULT 0');
    await addColumnIfNotExists(conn, 'pedidos', 'cupomCodigo', 'VARCHAR(50) DEFAULT NULL');
    await addColumnIfNotExists(conn, 'pedidos', 'promocaoId', 'INT DEFAULT NULL');
    await addColumnIfNotExists(conn, 'agendamentos', 'data', 'DATE DEFAULT NULL');
    await addColumnIfNotExists(conn, 'agendamentos', 'horario', "VARCHAR(10) DEFAULT '12:00'");
    await addColumnIfNotExists(conn, 'agendamentos', 'pratoDoDia', "VARCHAR(150) DEFAULT ''");
    await addColumnIfNotExists(conn, 'agendamentos', 'vagasTotais', 'INT DEFAULT 50');
    await addColumnIfNotExists(conn, 'agendamentos', 'vagasOcupadas', 'INT DEFAULT 0');
    await addColumnIfNotExists(conn, 'agendamentos', 'preco', 'DECIMAL(10,2) DEFAULT 0.00');
    await addColumnIfNotExists(conn, 'agendamentos', 'dataCriacao', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfNotExists(conn, 'vendas', 'pedidoId', 'INT DEFAULT NULL');

    // Atualizar status ENUM de pedidos para incluir 'cancelado' de forma segura
    try {
      await conn.execute("ALTER TABLE pedidos MODIFY COLUMN status ENUM('pendente','confirmado','preparando','pronto','entregue','recusado','cancelado') DEFAULT 'pendente'");
    } catch (e) {
      logger.debug('Status ENUM pedidos já atualizado');
    }

    // Chaves estrangeiras seguras
    await addForeignKeyIfNotExists(conn, 'pedidos', 'fk_pedidos_cliente', 'FOREIGN KEY (clienteAppId) REFERENCES usuarios(id) ON DELETE SET NULL');
    await addForeignKeyIfNotExists(conn, 'pedidos', 'fk_pedidos_promocao', 'FOREIGN KEY (promocaoId) REFERENCES promocoes(id) ON DELETE SET NULL');
    await addForeignKeyIfNotExists(conn, 'cliente_agendamentos', 'fk_cliente_agendamentos_cliente', 'FOREIGN KEY (clienteAppId) REFERENCES usuarios(id) ON DELETE SET NULL');
    await addForeignKeyIfNotExists(conn, 'vendas', 'fk_vendas_pedido', 'FOREIGN KEY (pedidoId) REFERENCES pedidos(id) ON DELETE SET NULL');
    await addForeignKeyIfNotExists(conn, 'itens_divida', 'fk_itens_divida_produto', 'FOREIGN KEY (produtoId) REFERENCES produtos(id) ON DELETE RESTRICT');

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
    await createIndexIfNotExists(conn, 'idx_pedidos_cliente_data', 'pedidos', 'clienteAppId, data DESC');
    await createIndexIfNotExists(conn, 'idx_vendas_data', 'vendas', 'data');
    await createIndexIfNotExists(conn, 'idx_vendas_pedidoId', 'vendas', 'pedidoId');
    await createIndexIfNotExists(conn, 'idx_itens_venda_vendaId', 'itens_venda', 'vendaId');
    await createIndexIfNotExists(conn, 'idx_itens_pedido_pedidoId', 'itens_pedido', 'pedidoId');
    await createIndexIfNotExists(conn, 'idx_produtos_categoria', 'produtos', 'categoria');
    await createIndexIfNotExists(conn, 'idx_produtos_ativo', 'produtos', 'ativo');
    await createIndexIfNotExists(conn, 'idx_hist_fid_cliente_data', 'historico_fidelidade', 'clienteId, data DESC');
    await createIndexIfNotExists(conn, 'idx_dividas_cliente_pago', 'dividas', 'clienteId, pago');
    await createIndexIfNotExists(conn, 'idx_promocoes_ativa', 'promocoes', 'ativa, codigo');
    await createIndexIfNotExists(conn, 'idx_usuarios_tipo', 'usuarios', 'tipo');
    await createIndexIfNotExists(conn, 'idx_usuarios_turma', 'usuarios', 'turma');
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
    const [admin] = await conn.execute("SELECT id FROM usuarios WHERE username = 'admin' OR tipo = 'administrador'");
    if (admin.length === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await conn.execute(
        "INSERT INTO usuarios (username, senha_hash, nome, tipo, dataCadastro) VALUES ('admin', ?, 'Deyse Nayana', 'administrador', ?)",
        [hash, now]
      );
      logger.success('Admin criado na tabela usuarios: admin / admin123');
    }

    // ─── HORÁRIOS / AGENDAMENTOS PADRÃO ──────────────────────────────────────────
    const hoje = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Atualizar agendamentos antigos para a data de hoje para garantir pratos do dia sempre disponíveis
    await conn.execute('UPDATE agendamentos SET data = ? WHERE data < DATE_SUB(CURDATE(), INTERVAL 1 DAY)', [hoje]);

    const [horarios] = await conn.execute('SELECT id FROM agendamentos LIMIT 1');
    if (horarios.length === 0) {
      const horariosPadrao = [
        [hoje, '12:00', 'Almoço Executivo: Filé de Frango Grelhado, Arroz, Feijão e Salada', 50, 0, 18.00],
        [hoje, '12:30', 'Almoço Light: Grelhado com Legumes no Vapor', 50, 0, 18.00],
        [hoje, '13:00', 'Almoço Tradicional: Bife de Panela com Batata', 50, 0, 18.00],
        [hoje, '20:40', 'Jantar Especial: Strogonoff de Frango com Batata Palha', 40, 0, 16.00],
        [hoje, '21:10', 'Jantar Cantina: Caldo Verde com Torradas', 40, 0, 15.00]
      ];
      for (const [data, horario, prato, vagas, ocupadas, preco] of horariosPadrao) {
        await conn.execute(
          'INSERT INTO agendamentos (data, horario, pratoDoDia, vagasTotais, vagasOcupadas, preco, bloqueado, dataCriacao) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
          [data, horario, prato, vagas, ocupadas, preco, now]
        );
      }
      logger.success('Agendamentos padrão inseridos');
    }

    // ─── CONFIGURAÇÕES PADRÃO ───────────────────────────────────────────────────
    const configsPadrao = [
      ['nome_cantina', 'Cantina Doutor Paladar - IFSP'],
      ['telefone_contato', '(11) 99999-9999'],
      ['email_contato', 'cantina@ifsp.edu.br'],
      ['endereco', 'Instituto Federal - Rua Principal, 100'],
      ['meta_diaria', '500.00'],
      ['aviso_cardapio', 'Seja bem-vindo à cantina! Faça seu pedido online ou escaneie o QR Code da mesa.'],
      ['fidelidade_ativa', '1'],
      ['fidelidade_taxa', '10'],
      ['fidelidade_resgate_min', '50'],
      ['fidelidade_valor_ponto', '0.10'],
      ['fidelidade_pedido_minimo', '5.00'],
      ['promocoes_ativas', '1'],
      ['limite_padrao_fiado', '0.00'],
      ['fiado_ativo', '1'],
      ['fiado_app_ativo', '1']
    ];
    for (const [chave, valor] of configsPadrao) {
      await conn.execute(
        'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE chave = chave',
        [chave, valor]
      );
    }

    try {
      await conn.execute('ALTER TABLE usuarios MODIFY COLUMN limiteCredito DECIMAL(10,2) DEFAULT 0.00');
    } catch(errAlter) {}

    logger.success('Configurações padrão verificadas');

    // ─── PROMOÇÕES PADRÃO ───────────────────────────────────────────────────────
    const [promos] = await conn.execute('SELECT id FROM promocoes LIMIT 1');
    if (promos.length === 0) {
      const promocoesPadrao = [
        ['BEMVINDO10', 'Boas-Vindas App', '10% de desconto no seu 1º pedido pelo aplicativo!', 'primeira_compra', 10.00, 10.00, 15.00, JSON.stringify({}), 1],
        ['QUARTA2X', 'Quarta Maluca: Pontos em Dobro', 'Ganhe o dobro de pontos de fidelidade em pedidos feitos às quartas-feiras!', 'pontos_dobro', 2.00, 0.00, null, JSON.stringify({ dias_semana: [3], multiplicador: 2 }), 1],
        ['COMBOPALADAR', 'Combo Econômico Cantina', 'R$ 3,00 de desconto automático para pedidos acima de R$ 25,00', 'desconto_fixo', 3.00, 25.00, null, JSON.stringify({}), 1],
        ['PALADAR15', 'Cupom Especial Estudante', '15% de desconto em pedidos acima de R$ 30,00', 'desconto_porcentagem', 15.00, 30.00, 10.00, JSON.stringify({}), 1]
      ];
      for (const [cod, nome, desc, tipo, val, minPed, maxDesc, regras, ativa] of promocoesPadrao) {
        await conn.execute(
          'INSERT INTO promocoes (codigo, nome, descricao, tipo, valor, valor_minimo_pedido, desconto_maximo, regras_json, ativa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [cod, nome, desc, tipo, val, minPed, maxDesc, regras, ativa]
        );
      }
      logger.success('Promoções padrão criadas com sucesso!');
    }

    // ─── PRODUTOS PADRÃO ────────────────────────────────────────────────────────
    const [prods] = await conn.execute('SELECT id FROM produtos LIMIT 1');
    if (prods.length === 0) {
      const produtosPadrao = [
        // --- SALGADOS ---
        ['Hambúrgão Cheddar', 'Salgados', 8.00, 15, 5, 'imagens/hamburgao_cheddar.jpg'],
        ['Hambúrgão c/ Bacon', 'Salgados', 9.00, 20, 5, 'imagens/hamburgao_bacon.jpg'],
        ['Coxinha de Frango', 'Salgados', 5.50, 20, 10, 'imagens/coxinha_frango.jpg'],
        ['Risolis de Queijo', 'Salgados', 5.00, 20, 10, 'imagens/risolis.jpg'],
        ['Risolis de Carne', 'Salgados', 5.00, 20, 10, 'imagens/risolis.jpg'],
        ['Esfiha de Carne', 'Salgados', 4.50, 20, 10, 'imagens/esfiha_carne.jpg'],
        ['Pão de Queijo 90g', 'Salgados', 4.00, 30, 15, 'imagens/pao_de_queijo.jpg'],
        ['Pão Batata Frango', 'Salgados', 6.00, 20, 5, 'imagens/pao_batata_frango.jpg'],
        ['Pão Batata Calabresa', 'Salgados', 6.00, 20, 5, 'imagens/pao_batata_calabresa.jpg'],
        ['Enroladinho Bauru', 'Salgados', 5.00, 20, 10, 'imagens/enroladinho_bauru.jpg'],
        ['Enroladinho Salsicha', 'Salgados', 5.00, 15, 10, 'imagens/enroladinho_salsicha.jpg'],
        ['Pizza Fria', 'Salgados', 6.00, 20, 5, 'imagens/enroladinho_bauru.jpg'],
        ['Kibe', 'Salgados', 5.00, 20, 10, 'imagens/kibe.jpg'],
        // --- BEBIDAS ---
        ['Coca-Cola Lata 350ml', 'Bebidas', 7.00, 60, 20, 'imagens/coca_cola_lata_350ml.jpg'],
        ['Coca-Cola Pet 600ml', 'Bebidas', 7.00, 60, 20, 'imagens/coca_cola_pet_600ml.jpg'],
        ['Coca-Cola Zero 350ml', 'Bebidas', 7.00, 36, 10, 'imagens/coca_cola_zero_350ml.jpg'],
        ['Coca-Cola Zero 200ml', 'Bebidas', 5.00, 72, 15, 'imagens/coca_cola_zero_200ml.jpg'],
        ['Sprite Lata 350ml', 'Bebidas', 6.00, 24, 10, 'imagens/sprite_lata_350ml.jpg'],
        ['Guaraná Antarctica Zero Lata', 'Bebidas', 5.00, 60, 20, 'imagens/guarana_antarctica_zero_lata.jpg'],
        ['Água Passa Quatro c/ Gás', 'Bebidas', 4.00, 36, 15, 'imagens/agua_passa_quatro_com_gas.jpg'],
        ['Água Passa Quatro s/ Gás', 'Bebidas', 4.00, 48, 15, 'imagens/agua_passa_quatro_sem_gas.jpg'],
        ['Suco K-mais Integral 300ml', 'Bebidas', 5.00, 36, 10, 'imagens/suco_kmais_caju_300ml.jpg'],
        ['Suco K-mais Uva 300ml', 'Bebidas', 5.00, 12, 5, 'imagens/suco_kmais_caju_300ml.jpg'],
        ['Suco K-mais Goiaba 300ml', 'Bebidas', 5.00, 12, 5, 'imagens/suco_kmais_caju_300ml.jpg'],
        ['Suco K-mais Caju 300ml', 'Bebidas', 5.00, 12, 5, 'imagens/suco_kmais_caju_300ml.jpg'],
        ['Café Coado (copo)', 'Bebidas', 3.00, 99, 20, 'imagens/cafe_coado.jpg'],
        // --- DOCES & SORVETES ---
        ['Cremosinho Sorvete Iogurte', 'Doces', 2.50, 30, 10, 'imagens/cremosinho.jpg'],
        ['Geladão de Açaí', 'Doces', 7.00, 10, 5, 'imagens/geladao.jpg'],
        ['Trento Chocolate', 'Doces', 3.50, 24, 10, 'imagens/trento_chocolate.jpg'],
        ['Trento Branco', 'Doces', 3.50, 24, 10, 'imagens/trento_chocolate.jpg'],
        ['Pão de Mel 50g', 'Doces', 4.00, 20, 10, 'imagens/pao_de_mel_50g.jpg'],
        ['Brigadeiro', 'Doces', 3.50, 80, 15, 'imagens/pao_de_mel_50g.jpg'],
        // --- CALDOS ---
        ['Caldo Sopa de Legumes', 'Caldos', 20.00, 5, 2, 'imagens/caldo_sopa_legumes.jpg'],
        ['Caldo Mandioquinha c/ Frango', 'Caldos', 20.00, 5, 2, 'imagens/caldo_mandioquinha_frango.jpg'],
        ['Caldo de Abóbora Seca Barriga', 'Caldos', 20.00, 5, 2, 'imagens/caldo_abobora.jpg'],
        ['Caldo Verde c/ Carne', 'Caldos', 20.00, 5, 2, 'imagens/caldo_verde_carne.jpg'],
        ['Caldo Vaca Atolada', 'Caldos', 20.00, 5, 2, 'imagens/caldo_vaca_atolada.jpg'],
        // --- SNACKS / DOCES ---
        ['Halls Melancia', 'Doces', 2.00, 21, 5, 'imagens/halls.jpg'],
        ['Halls Morango', 'Doces', 2.00, 21, 5, 'imagens/halls.jpg'],
        ['Halls Menta', 'Doces', 2.00, 21, 5, 'imagens/halls.jpg'],
        ['Trident Hortela', 'Doces', 2.50, 21, 5, 'imagens/trident.jpg'],
        ['Trident Morango', 'Doces', 2.50, 21, 5, 'imagens/trident.jpg'],
        ['Trident Tutti Frutti', 'Doces', 2.50, 21, 5, 'imagens/trident.jpg'],
        // --- CREMOSINHO / POLPAS ---
        ['Cremosinho Abacaxi', 'Doces', 4.00, 30, 5, 'imagens/cremosinho.jpg'],
        ['Cremosinho Maracujá', 'Doces', 4.00, 30, 5, 'imagens/cremosinho.jpg'],
        ['Cremosinho Morango', 'Doces', 4.00, 30, 5, 'imagens/cremosinho.jpg'],
        ['Açaí no Copo', 'Doces', 8.50, 25, 5, 'imagens/geladao.jpg']
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
