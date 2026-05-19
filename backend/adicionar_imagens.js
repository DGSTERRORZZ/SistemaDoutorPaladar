const db = require('./database');
(async () => {
    const d = await db.getDatabase();
    
    try {
        d.run('ALTER TABLE produtos ADD COLUMN imagem TEXT DEFAULT ""');
        console.log('Coluna imagem adicionada');
    } catch (e) {
        console.log('Coluna imagem já existe');
    }
    
    const atualizar = d.prepare('UPDATE produtos SET imagem = ? WHERE categoria = ? AND (imagem IS NULL OR imagem = "")');
    
    atualizar.run(['🥟', 'Salgados']);
    atualizar.run(['🥤', 'Bebidas']);
    atualizar.run(['🍰', 'Doces']);
    atualizar.run(['🥪', 'Lanches']);
    atualizar.run(['🍦', 'Sorvetes']);
    atualizar.run(['🥗', 'Saudáveis']);
    atualizar.run(['🍽️', 'Refeições']);
    atualizar.free();
    
    db.saveDatabase();
    console.log('Imagens adicionadas aos produtos!');
})();
