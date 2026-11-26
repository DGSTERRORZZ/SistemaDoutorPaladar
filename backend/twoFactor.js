const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_MS = 30000;

function base32Encode(data) {
  const input = Buffer.from(data);
  let result = '';
  let buffer = 0;
  let bits = 0;
  for (const value of input) {
    buffer = (buffer << 8) | value;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += ALPHABET[(buffer >>> bits) & 31];
    }
  }
  if (bits) result += ALPHABET[(buffer << (5 - bits)) & 31];
  return result;
}

function base32Decode(secret) {
  if (typeof secret !== 'string' || !/^[A-Z2-7]{16,64}$/.test(secret)) {
    throw new Error('Segredo TOTP inválido');
  }
  let buffer = 0;
  let bits = 0;
  const bytes = [];
  for (const character of secret) {
    buffer = (buffer << 5) | ALPHABET.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 255);
    }
  }
  return Buffer.from(bytes);
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function totpAt(secret, step) {
  if (!Number.isSafeInteger(step) || step < 0) throw new Error('Intervalo TOTP inválido');
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(number).padStart(6, '0');
}

function verifyTotp(secret, code, now = Date.now()) {
  if (typeof code !== 'string' || !/^[0-9]{6}$/.test(code)) return null;
  const current = Math.floor(now / STEP_MS);
  for (const delta of [-1, 0, 1]) {
    const step = current + delta;
    if (step < 0) continue;
    const expected = Buffer.from(totpAt(secret, step));
    if (crypto.timingSafeEqual(expected, Buffer.from(code))) return { step };
  }
  return null;
}

module.exports = { base32Encode, base32Decode, generateTotpSecret, totpAt, verifyTotp, STEP_MS };
