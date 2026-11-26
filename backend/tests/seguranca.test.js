const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
const { criptografar, descriptografar, normalizarIp, identificarPaisPorIp, paisBloqueado } = require('../securityService');
const { generateTotpSecret, totpAt, verifyTotp } = require('../twoFactor');

test('AES-256-GCM cifra e recupera um relatório sem revelar o conteúdo', () => {
  const relatorio = { total: 124.5, conta: 'exemplo-interno' };
  const cipher = criptografar(relatorio);
  assert.ok(cipher.startsWith('v2:'));
  assert.ok(!cipher.includes('exemplo-interno'));
  assert.deepEqual(descriptografar(cipher), relatorio);
});

test('AES-256-GCM rejeita alteração do ciphertext e tag', () => {
  const partes = criptografar('segredo').split(':');
  partes[3] = (partes[3][0] === 'a' ? 'b' : 'a') + partes[3].slice(1);
  assert.throws(() => descriptografar(partes.join(':')));
});

test('TOTP de seis dígitos aceita janela de 30 segundos e rejeita código errado', () => {
  const secret = generateTotpSecret();
  const when = 1760000000000;
  const step = Math.floor(when / 30000);
  const code = totpAt(secret, step);
  assert.deepEqual(verifyTotp(secret, code, when), { step });
  assert.equal(verifyTotp(secret, 'abcdef', when), null);
  assert.equal(verifyTotp(secret, '1234567', when), null);
});

test('IPs arbitrários não recebem país inventado e cabeçalho encaminhado não é utilizado', () => {
  delete process.env.GEOIP_COUNTRY_CIDRS;
  assert.equal(identificarPaisPorIp('8.8.8.8'), 'XX');
  assert.equal(normalizarIp('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(normalizarIp('203.0.113.7, 8.8.8.8'), null);
});

test('bloqueio geográfico usa apenas CIDRs configurados explicitamente', () => {
  process.env.GEOIP_COUNTRY_CIDRS = JSON.stringify({ CN: ['203.0.113.0/24'], RU: ['198.51.100.0/24'] });
  process.env.BLOCKED_COUNTRIES = 'CN, RU';
  assert.equal(identificarPaisPorIp('203.0.113.5'), 'CN');
  assert.equal(identificarPaisPorIp('198.51.100.9'), 'RU');
  assert.equal(identificarPaisPorIp('8.8.8.8'), 'XX');
  assert.equal(paisBloqueado('CN'), true);
  assert.equal(paisBloqueado('XX'), false);
});
