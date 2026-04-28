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
      estoqueMinimo INTEGER NOT NULL DEFAULT 10
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
  `);

  // Salva as alterações iniciais
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

// Middleware para salvar automaticamente após cada requisição de escrita
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
