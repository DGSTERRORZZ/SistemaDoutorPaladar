const db = require('./database');
(async () => {
    const d = await db.getDatabase();
    d.run("DELETE FROM configuracoes WHERE chave = 'senha_hash'");
    db.saveDatabase();
    console.log('OK - Hash removido');
})();
