require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, execute } = require('../database');
const { criptografar } = require('../securityService');
const { generateTotpSecret } = require('../twoFactor');

async function main() {
  const name = process.argv[2];
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!name || !/^[a-zA-Z0-9_.-]{3,80}$/.test(name)) throw new Error('Uso: BOOTSTRAP_ADMIN_PASSWORD=<senha> node scripts/criar_admin.js usuario');
  if (typeof password !== 'string' || password.length < 14 || password.length > 72) {
    throw new Error('Defina BOOTSTRAP_ADMIN_PASSWORD com 14-72 caracteres somente para a execução');
  }
  const [exists] = await query('SELECT id FROM usuarios WHERE username = ?', [name]);
  if (exists) throw new Error('Nome de usuário já existe');
  const hash = await bcrypt.hash(password, 12);
  const secret = generateTotpSecret();
  await execute(
    'INSERT INTO usuarios (nome, username, senha_hash, tipo, cargo, dataCadastro, two_factor_secret) VALUES (?, ?, ?, ?, ?, NOW(), ?)',
    [name, name, hash, 'administrador', 'administrador', criptografar(secret)]
  );
  console.log('Administrador criado. Cadastre esta chave TOTP em seu aplicativo e apague-a do terminal:');
  console.log(secret);
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error.message); process.exit(1);
});
