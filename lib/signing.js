const crypto = require('crypto');

function normalizePem(key) {
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed.includes('BEGIN')) return trimmed;
  try {
    return Buffer.from(trimmed, 'base64').toString('utf-8');
  } catch (err) {
    return trimmed;
  }
}

function getKeyPair() {
  const privateKey = normalizePem(process.env.SIGNING_PRIVATE_KEY);
  const publicKey = normalizePem(process.env.SIGNING_PUBLIC_KEY);
  if (!privateKey || !publicKey) {
    throw new Error('Signing keys missing. Set SIGNING_PRIVATE_KEY and SIGNING_PUBLIC_KEY.');
  }
  const kid = crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 16);
  return { privateKey, publicKey, kid };
}

function getMasterKey() {
  const raw = process.env.SIGNING_MASTER_KEY;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  try {
    return Buffer.from(trimmed, 'base64');
  } catch (err) {
    return null;
  }
}

function encryptPrivateKey(privateKeyPem, masterKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(privateKeyPem, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

function decryptPrivateKey(enc, masterKey) {
  const [ivB64, tagB64, dataB64] = enc.split('.');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString('utf-8');
}

function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  return { publicKeyPem, privateKeyPem };
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function signHashHex(hashHex, privateKey) {
  const signature = crypto.sign(null, Buffer.from(hashHex, 'hex'), privateKey);
  return signature.toString('base64');
}

function verifyHashHex(hashHex, signatureB64, publicKey) {
  return crypto.verify(null, Buffer.from(hashHex, 'hex'), publicKey, Buffer.from(signatureB64, 'base64'));
}

function generateVerificationCode(prefix = 'VER') {
  const rand = crypto.randomBytes(6).toString('base64url').toUpperCase();
  return `${prefix}-${rand}`;
}

module.exports = {
  getKeyPair,
  getMasterKey,
  encryptPrivateKey,
  decryptPrivateKey,
  generateKeyPair,
  sha256Hex,
  signHashHex,
  verifyHashHex,
  generateVerificationCode
};
