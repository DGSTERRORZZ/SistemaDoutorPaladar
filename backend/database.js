const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'doutor_paladar.db');

let db;

async function getDatabase() {
  if (db) return db;

  const SQL = await initSqlJs();
  
  // Carrega banco existente ou cria um novo
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Cria tabelas se não existirem
  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      categoria TEXT NOT NULL,
      preco REAL NOT NULL,
      estoque INTEGER NOT NULL DEFAULT 0,
      estoqueMinimo INTEGER NOT NULL DEFAULT 10,
      fornecedorId INTEGER,
      FOREIGN KEY (fornecedorId) REFERENCES fornecedores(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total REAL NOT NULL,
      formaPagamento TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS itens_venda (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendaId INTEGER NOT NULL,
      produtoId INTEGER NOT NULL,
      nome TEXT NOT NULL,
      quantidade INTEGER NOT NULL,
      precoUnitario REAL NOT NULL,
      FOREIGN KEY (vendaId) REFERENCES vendas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      turma TEXT DEFAULT '',
      dataCadastro TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dividas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clienteId INTEGER NOT NULL,
      data TEXT NOT NULL,
      total REAL NOT NULL,
      pago INTEGER DEFAULT 0,
      valorPago REAL DEFAULT 0,
      FOREIGN KEY (clienteId) REFERENCES clientes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS itens_divida (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dividaId INTEGER NOT NULL,
      produtoId INTEGER NOT NULL,
      quantidade INTEGER NOT NULL,
      precoUnitario REAL NOT NULL,
      FOREIGN KEY (dividaId) REFERENCES dividas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS despesas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      categoria TEXT NOT NULL,
      data TEXT NOT NULL
    );

    -- ============================================
    -- NOVAS TABELAS
    -- ============================================

    -- Pedidos antecipados (clientes)
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomeCliente TEXT NOT NULL,
      turma TEXT DEFAULT '',
      horarioRetirada TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pendente',
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS itens_pedido (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedidoId INTEGER NOT NULL,
      produtoId INTEGER NOT NULL,
      quantidade INTEGER NOT NULL,
      precoUnitario REAL NOT NULL,
      FOREIGN KEY (pedidoId) REFERENCES pedidos(id) ON DELETE CASCADE
    );

    -- Agendamentos de horários
    CREATE TABLE IF NOT EXISTS agendamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      horarioInicio TEXT NOT NULL,
      horarioFim TEXT NOT NULL,
      limitePedidos INTEGER DEFAULT 10,
      bloqueado INTEGER DEFAULT 0
    );

    -- Configurações do sistema
    CREATE TABLE IF NOT EXISTS configuracoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chave TEXT UNIQUE NOT NULL,
      valor TEXT NOT NULL
    );

    -- Fornecedores
    CREATE TABLE IF NOT EXISTS fornecedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cnpj TEXT DEFAULT '',
      telefone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      endereco TEXT DEFAULT ''
    );

    -- Compras de fornecedores
    CREATE TABLE IF NOT EXISTS compras_fornecedor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fornecedorId INTEGER NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pedido',
      data TEXT NOT NULL,
      FOREIGN KEY (fornecedorId) REFERENCES fornecedores(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS itens_compra (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      compraId INTEGER NOT NULL,
      produtoId INTEGER NOT NULL,
      quantidade INTEGER NOT NULL,
      precoUnitario REAL NOT NULL,
      FOREIGN KEY (compraId) REFERENCES compras_fornecedor(id) ON DELETE CASCADE
    );

    -- Inserir configurações padrão se não existirem
    INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('nome_cantina', 'Doutor Paladar');
    INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('meta_vendas_diaria', '500');
    INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('meta_vendas_mensal', '10000');
    INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('limite_fiado_aluno', '50');
    INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('horario_abertura', '07:00');
    INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES ('horario_fechamento', '17:00');

    -- Inserir agendamentos padrão se não existirem
    INSERT OR IGNORE INTO agendamentos (horarioInicio, horarioFim, limitePedidos) VALUES ('09:00', '09:15', 10);
    INSERT OR IGNORE INTO agendamentos (horarioInicio, horarioFim, limitePedidos) VALUES ('09:15', '09:30', 10);
    INSERT OR IGNORE INTO agendamentos (horarioInicio, horarioFim, limitePedidos) VALUES ('09:30', '09:45', 10);
    INSERT OR IGNORE INTO agendamentos (horarioInicio, horarioFim, limitePedidos) VALUES ('09:45', '10:00', 10);
    INSERT OR IGNORE INTO agendamentos (horarioInicio, horarioFim, limitePedidos) VALUES ('10:00', '10:15', 10);
    INSERT OR IGNORE INTO agendamentos (horarioInicio, horarioFim, limitePedidos) VALUES ('10:15', '10:30', 10);
    INSERT OR IGNORE INTO agendamentos (horarioInicio, horarioFim, limitePedidos) VALUES ('12:00', '12:15', 10);
    INSERT OR IGNORE INTO agendamentos (horarioInicio, horarioFim, limitePedidos) VALUES ('12:15', '12:30', 10);
    INSERT OR IGNORE INTO agendamentos (horarioInicio, horarioFim, limitePedidos) VALUES ('12:30', '12:45', 10);
    INSERT OR IGNORE INTO agendamentos (horarioInicio, horarioFim, limitePedidos) VALUES ('12:45', '13:00', 10);
  `);

  saveDatabase();
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function autoSave(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    saveDatabase();
    return originalJson(data);
  };
  const originalSend = res.send.bind(res);
  res.send = function(data) {
    saveDatabase();
    return originalSend(data);
  };
  const originalEnd = res.end.bind(res);
  res.end = function(data) {
    saveDatabase();
    return originalEnd(data);
  };
  next();
}

module.exports = { getDatabase, saveDatabase, autoSave };