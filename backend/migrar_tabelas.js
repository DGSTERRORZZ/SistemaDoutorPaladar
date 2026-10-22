const { getDatabase } = require('./database');

async function run() {
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    console.log('Iniciando migracao e unificacao de tabelas...');
    // 1. Garantir que clientes_app possui saldoDevedor
    const [cols] = await conn.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clientes_app' AND COLUMN_NAME = 'saldoDevedor'"
    );
    if (cols.length === 0) {
      await conn.execute('ALTER TABLE clientes_app ADD COLUMN saldoDevedor DECIMAL(10,2) DEFAULT 0.00');
      console.log('Coluna saldoDevedor adicionada a clientes_app');
    }

    // 2. Drop das foreign keys antigas de dividas e pagamentos_fiado
    try {
      const [fks] = await conn.execute(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dividas' AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      for (const fk of fks) {
        await conn.execute(`ALTER TABLE dividas DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
      }
    } catch(e) { console.log('Info drop fk dividas:', e.message); }

    try {
      const [fks] = await conn.execute(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pagamentos_fiado' AND REFERENCED_TABLE_NAME = 'clientes_fiado'
      `);
      for (const fk of fks) {
        await conn.execute(`ALTER TABLE pagamentos_fiado DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
      }
    } catch(e) { console.log('Info drop fk pagamentos:', e.message); }

    // 3. Atualizar dividas e pagamentos_fiado para apontar para clientes_app
    try {
      await conn.execute('ALTER TABLE dividas ADD CONSTRAINT fk_dividas_clienteApp FOREIGN KEY (clienteId) REFERENCES clientes_app(id) ON DELETE CASCADE');
      console.log('Foreign key fk_dividas_clienteApp criada');
    } catch(e) { console.log('Info fk dividas:', e.message); }

    try {
      await conn.execute('ALTER TABLE pagamentos_fiado ADD CONSTRAINT fk_pagamentos_clienteApp FOREIGN KEY (clienteId) REFERENCES clientes_app(id) ON DELETE CASCADE');
      console.log('Foreign key fk_pagamentos_clienteApp criada');
    } catch(e) { console.log('Info fk pagamentos:', e.message); }

    // 4. Dropar tabela redundante clientes_fiado se existir
    await conn.execute('DROP TABLE IF EXISTS clientes_fiado');
    console.log('Tabela clientes_fiado removida com sucesso (unificada em clientes_app)');

    console.log('Migracao do banco concluida com exito!');
  } finally {
    conn.release();
    process.exit(0);
  }
}

run().catch(e => { console.error('Erro na migracao:', e); process.exit(1); });
