const { getDatabase } = require('./database');

async function updatePaoDeQueijo() {
  const db = await getDatabase();
  const [res] = await db.query("UPDATE produtos SET nome = 'Pão de Queijo' WHERE nome LIKE '%Pão de Queijo%'");
  console.log('Pão de Queijo atualizado:', res.affectedRows);
  process.exit(0);
}

updatePaoDeQueijo().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
