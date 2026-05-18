const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'doutor_paladar.db');

let db;

async function getDatabase() {
  if (db) return db;

  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

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

    CREATE TABLE IF NOT EXISTS agendamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      horarioInicio TEXT NOT NULL,
      horarioFim TEXT NOT NULL,
      limitePedidos INTEGER DEFAULT 10,
      bloqueado INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS configuracoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chave TEXT UNIQUE NOT NULL,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fornecedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cnpj TEXT DEFAULT '',
      telefone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      endereco TEXT DEFAULT ''
    );

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
  `);

  // Inserir configurações padrão (sem duplicar)
  const configsPadrao = [
    ['nome_cantina', 'Doutor Paladar'],
    ['meta_vendas_diaria', '500'],
    ['meta_vendas_mensal', '10000'],
    ['limite_fiado_aluno', '50'],
    ['horario_abertura', '07:00'],
    ['horario_fechamento', '17:00']
  ];

  const stmtConfig = db.prepare('SELECT id FROM configuracoes WHERE chave = ?');
  const insertConfig = db.prepare('INSERT INTO configuracoes (chave, valor) VALUES (?, ?)');

  for (const [chave, valor] of configsPadrao) {
    stmtConfig.bind([chave]);
    const existe = stmtConfig.step();
    stmtConfig.reset();
    
    if (!existe) {
      insertConfig.run([chave, valor]);
    }
  }

  stmtConfig.free();
  insertConfig.free();

  // Inserir agendamentos padrão (sem duplicar)
  const horariosPadrao = [
    ['09:00', '09:15', 10],
    ['09:15', '09:30', 10],
    ['09:30', '09:45', 10],
    ['09:45', '10:00', 10],
    ['10:00', '10:15', 10],
    ['10:15', '10:30', 10],
    ['12:00', '12:15', 10],
    ['12:15', '12:30', 10],
    ['12:30', '12:45', 10],
    ['12:45', '13:00', 10]
  ];

  const stmtAg = db.prepare('SELECT id FROM agendamentos WHERE horarioInicio = ? AND horarioFim = ?');
  const insertAg = db.prepare('INSERT INTO agendamentos (horarioInicio, horarioFim, limitePedidos, bloqueado) VALUES (?, ?, ?, 0)');

  for (const [inicio, fim, limite] of horariosPadrao) {
    stmtAg.bind([inicio, fim]);
    const existe = stmtAg.step();
    stmtAg.reset();
    
    if (!existe) {
      insertAg.run([inicio, fim, limite]);
    }
  }

  stmtAg.free();
  insertAg.free();

  saveDatabase();
  return db;
}

function saveDatabase() {
  if (db) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (erro) {
      console.error('Erro ao salvar banco de dados:', erro);
    }
  }
}

function autoSave(req, res, next) {
  const metodosEscrita = ['POST', 'PUT', 'DELETE', 'PATCH'];

  if (!metodosEscrita.includes(req.method)) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = function (body) {
    const resultado = originalJson(body);
    saveDatabase();
    return resultado;
  };

  next();
}

module.exports = { getDatabase, saveDatabase, autoSave };