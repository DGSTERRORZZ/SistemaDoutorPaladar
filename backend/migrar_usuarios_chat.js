const { getDatabase } = require('./database');
const bcrypt = require('bcryptjs');

async function run() {
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    console.log('🚀 Iniciando migração e unificação de Usuários e remoção do Chat...');

    // 1. Criar tabela unificada 'usuarios' se não existir
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
    console.log('✅ Tabela usuarios criada/verificada.');

    // 2. Migrar dados de admin_users para usuarios
    try {
      const [admins] = await conn.execute('SELECT * FROM admin_users');
      for (const a of admins) {
        const [exists] = await conn.execute('SELECT id FROM usuarios WHERE username = ?', [a.username]);
        if (exists.length === 0) {
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          await conn.execute(
            'INSERT INTO usuarios (nome, username, senha_hash, tipo, dataCadastro) VALUES (?, ?, ?, ?, ?)',
            [a.nome, a.username, a.senha_hash, 'administrador', now]
          );
          console.log(`  👤 Admin migrado: ${a.username}`);
        }
      }
    } catch (e) {
      console.log('  Info admin_users:', e.message);
    }

    // Se não houver nenhum admin, garantir admin padrão
    const [adminCheck] = await conn.execute("SELECT id FROM usuarios WHERE tipo = 'administrador'");
    if (adminCheck.length === 0) {
      const defaultHash = bcrypt.hashSync('admin123', 10);
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await conn.execute(
        "INSERT INTO usuarios (nome, username, senha_hash, tipo, dataCadastro) VALUES ('Administrador', 'admin', ?, 'administrador', ?)",
        [defaultHash, now]
      );
      console.log('  👤 Admin padrão criado (admin / admin123).');
    }

    // 3. Migrar dados de clientes_app para usuarios
    try {
      const [clientes] = await conn.execute('SELECT * FROM clientes_app');
      for (const c of clientes) {
        const [exists] = await conn.execute('SELECT id FROM usuarios WHERE id = ? OR username = ?', [c.id, c.usuario]);
        if (exists.length === 0) {
          await conn.execute(
            `INSERT INTO usuarios (id, nome, username, telefone, turma, senha_hash, tipo, foto, totalPedidos, pontosFidelidade, limiteCredito, saldoDevedor, dataCadastro)
             VALUES (?, ?, ?, ?, ?, ?, 'cliente', ?, ?, ?, ?, ?, ?)`,
            [
              c.id,
              c.nome,
              c.usuario,
              c.telefone || null,
              c.turma || '',
              c.senha_hash,
              c.foto || '',
              c.totalPedidos || 0,
              c.pontosFidelidade || 0,
              c.limiteCredito || 50.00,
              c.saldoDevedor || 0.00,
              c.dataCadastro || new Date().toISOString().slice(0, 19).replace('T', ' ')
            ]
          );
          console.log(`  👤 Cliente migrado: ${c.nome} (id: ${c.id})`);
        }
      }
    } catch (e) {
      console.log('  Info clientes_app:', e.message);
    }

    // 4. Atualizar chaves estrangeiras para apontarem para `usuarios(id)`
    const tabelasFilhas = ['dividas', 'pagamentos_fiado', 'historico_fidelidade'];
    for (const tab of tabelasFilhas) {
      try {
        const [fks] = await conn.execute(`
          SELECT CONSTRAINT_NAME 
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
        `, [tab]);
        for (const fk of fks) {
          await conn.execute(`ALTER TABLE ${tab} DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        }
        await conn.execute(`ALTER TABLE ${tab} ADD CONSTRAINT fk_${tab}_usuario FOREIGN KEY (clienteId) REFERENCES usuarios(id) ON DELETE CASCADE`);
        console.log(`  🔗 Chave estrangeira de ${tab} atualizada para usuarios(id).`);
      } catch (e) {
        console.log(`  Info FK em ${tab}:`, e.message);
      }
    }

    // 5. Dropar tabelas antigas redundantes
    await conn.execute('DROP TABLE IF EXISTS admin_users');
    await conn.execute('DROP TABLE IF EXISTS clientes_app');
    console.log('✅ Tabelas admin_users e clientes_app dropadas com sucesso.');

    // 6. Remover completamente o chat do banco de dados
    await conn.execute('DROP TABLE IF EXISTS chat_mensagens');
    console.log('✅ Tabela chat_mensagens removida do banco de dados.');

    console.log('🎉 Migração concluída com sucesso!');
  } catch (err) {
    console.error('❌ Erro na migração:', err);
    throw err;
  } finally {
    conn.release();
    process.exit(0);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
