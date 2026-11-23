// Executar LOCALMENTE: node scripts/configurar_2fa_admin.js nome_do_usuario
// Não envie o segredo exibido no terminal para tickets, logs ou GitHub.
require('dotenv').config();
const { query, execute } = require('../database');
const { criptografar } = require('../securityService');
const { generateTotpSecret } = require('../twoFactor');

async function main() {
  const username = process.argv[2];
  if (!username || !/^[a-zA-Z0-9_.-]{1,80}$/.test(username)) {
    throw new Error('Uso: node scripts/configurar_2fa_admin.js usuario_admin');
  }
  const [user] = await query('SELECT id FROM usuarios WHERE username = ? AND tipo = ?', [username, 'administrador']);
  if (!user) throw new Error('Administrador não encontrado');
  const secret = generateTotpSecret();
  await execute(
    'UPDATE usuarios SET two_factor_secret = ?, two_factor_last_step = NULL WHERE id = ?',
    [criptografar(secret), user.id]
  );
  await execute('DELETE FROM dispositivos_confiaveis_2fa WHERE usuario_id = ?', [user.id]);
  const label = encodeURIComponent('Doutor Paladar:' + username);
  console.log('Cadastre esta chave no aplicativo autenticador. Guarde-a em local seguro:');
  console.log(secret);
  console.log('URI: otpauth://totp/' + label + '?secret=' + secret + '&issuer=Doutor%20Paladar');
  console.log('A configuração anterior e os dispositivos confiáveis foram revogados.');
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error.message);
  process.exit(1);
});
