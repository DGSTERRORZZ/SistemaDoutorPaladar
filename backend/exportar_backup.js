const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./database');

async function exportarDumpSQL() {
  console.log('📦 Iniciando exportação completa do banco de dados MySQL para backup.sql...');
  const db = await getDatabase();
  const conn = await db.getConnection();

  try {
    const tabelas = [
      'usuarios',
      'fornecedores',
      'produtos',
      'pedidos',
      'itens_pedido',
      'pedidos_status_log',
      'vendas',
      'itens_venda',
      'compras_fornecedor',
      'itens_compra',
      'despesas',
      'dividas',
      'itens_divida',
      'pagamentos_fiado',
      'agendamentos',
      'cliente_agendamentos',
      'historico_fidelidade',
      'chat_mensagens',
      'configuracoes',
      'promocoes'
    ];

    let sqlDump = `-- BACKUP COMPLETO DO SISTEMA DOUTOR PALADAR\n-- Data: ${new Date().toISOString()}\n\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

    for (const tabela of tabelas) {
      try {
        const [rows] = await conn.execute(`SELECT * FROM ${tabela}`);
        if (rows.length > 0) {
          sqlDump += `-- Tabela: ${tabela} (${rows.length} registros)\n`;
          sqlDump += `DELETE FROM ${tabela};\n`;

          const cols = Object.keys(rows[0]);
          for (const row of rows) {
            const values = cols.map(col => {
              const val = row[col];
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'number') return val;
              if (typeof val === 'boolean') return val ? 1 : 0;
              if (val instanceof Date) {
                return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
              }
              const strVal = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
              return `'${strVal}'`;
            });
            sqlDump += `INSERT INTO ${tabela} (${cols.join(', ')}) VALUES (${values.join(', ')});\n`;
          }
          sqlDump += `\n`;
        }
      } catch (tErr) {
        // Tabela opcional pode não existir ainda
      }
    }

    sqlDump += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    const dumpPath = path.join(__dirname, '..', 'backup_banco_doutor_paladar.sql');
    fs.writeFileSync(dumpPath, sqlDump, 'utf8');
    console.log(`✅ Backup do banco salvo com sucesso em: ${dumpPath}`);
  } catch (err) {
    console.error('❌ Erro ao exportar banco:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

exportarDumpSQL();
