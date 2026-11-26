const STORAGE_KEY = 'nsat:wallet-keystore:v1';
const ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal:true});
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PKCS8_PREFIX = Uint8Array.from([0x30,0x2e,0x02,0x01,0x00,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x04,0x22,0x04,0x20]);

function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(value) {
  let bits = 0, buffer = 0; const out = [];
  for (const char of value) {
    const digit = BASE32.indexOf(char); if (digit < 0) throw new Error('invalid_recovery_key');
    buffer = (buffer << 5) | digit; bits += 5;
    if (bits >= 8) { out.push((buffer >>> (bits - 8)) & 255); bits -= 8; }
  }
  if (bits && (buffer & ((1 << bits) - 1))) throw new Error('invalid_recovery_key');
  return Uint8Array.from(out);
}
function crc16(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}
function encodeStrKey(version, payload) {
  const bytes = new Uint8Array(payload.length + 3); bytes[0] = version; bytes.set(payload, 1);
  const crc = crc16(bytes.subarray(0, payload.length + 1)); bytes[bytes.length - 2] = crc & 255; bytes[bytes.length - 1] = crc >>> 8;
  return base32Encode(bytes);
}
function decodeStrKey(value, version) {
  const bytes = base32Decode(String(value).trim().toUpperCase());
  if (bytes.length !== 35 || bytes[0] !== version) throw new Error('invalid_recovery_key');
  const checksum = crc16(bytes.subarray(0, 33));
  if (bytes[33] !== (checksum & 255) || bytes[34] !== (checksum >>> 8)) throw new Error('invalid_recovery_key');
  return bytes.slice(1, 33);
}
function cryptoApi() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) throw new Error('secure_crypto_unavailable');
  return globalThis.crypto;
}
function toBase64(bytes) { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function fromBase64(value) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }
async function encryptionKey(password, salt, api) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 1024) throw new Error('wallet_password_invalid');
  const material = await api.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return api.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function generateWallet() {
  const api = cryptoApi();
  if (!api.subtle.generateKey || !api.subtle.exportKey) throw new Error('secure_crypto_unavailable');
  const pair = await api.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
  const [rawPublic, pkcs8] = await Promise.all([api.subtle.exportKey('raw',pair.publicKey),api.subtle.exportKey('pkcs8',pair.privateKey)]);
  const publicBytes = new Uint8Array(rawPublic), privateBytes = new Uint8Array(pkcs8).slice(-32);
  return {address:encodeStrKey(48,publicBytes), secret:encodeStrKey(144,privateBytes)};
}
export async function saveEncryptedWallet(secret, password, address) {
  const api = cryptoApi(); decodeStrKey(secret,144);
  if (!/^G[A-Z2-7]{55}$/.test(address || '')) throw new Error('wallet_address_invalid');
  const salt = api.getRandomValues(new Uint8Array(16)), iv = api.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(password,salt,api);
  const ciphertext = await api.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(String(secret).trim().toUpperCase()));
  const record = {version:1,address,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',salt:toBase64(salt),iv:toBase64(iv),ciphertext:toBase64(new Uint8Array(ciphertext))};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(record));
  return {address:record.address};
}
async function deriveAddress(seed, api) {
  const privateKey = await api.subtle.importKey('pkcs8',new Uint8Array([...PKCS8_PREFIX,...seed]),{name:'Ed25519'},true,['sign']);
  // Export JWK includes the matching public point for Ed25519 private keys in supported browsers.
  const jwk = await api.subtle.exportKey('jwk',privateKey);
  if (!jwk.x) throw new Error('secure_crypto_unavailable');
  return encodeStrKey(48,base64UrlToBytes(jwk.x));
}
function base64UrlToBytes(value) { const padded = value.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4 - value.length % 4) % 4); return fromBase64(padded); }
export async function unlockEncryptedWallet(password) {
  const api = cryptoApi(); let record;
  try { record = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { record = null; }
  if (record?.version !== 1 || record.kdf !== 'PBKDF2-SHA256' || record.iterations !== ITERATIONS || record.cipher !== 'AES-256-GCM' || !/^G[A-Z2-7]{55}$/.test(record.address || '')) throw new Error('wallet_keystore_invalid');
  try {
    const key = await encryptionKey(password,fromBase64(record.salt),api);
    const clear = await api.subtle.decrypt({name:'AES-GCM',iv:fromBase64(record.iv)},key,fromBase64(record.ciphertext));
    const secret = decoder.decode(clear), address = await deriveAddress(decodeStrKey(secret,144),api);
    if (address !== record.address) throw new Error('wallet_address_mismatch');
    return {address,secret};
  } catch { throw new Error('wallet_unlock_failed'); }
}
export function readWalletMeta() {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); return value?.version === 1 && /^G[A-Z2-7]{55}$/.test(value.address || '') ? {address:value.address} : null; } catch { return null; }
}
export async function walletAddressForRecoveryKey(secret) { return deriveAddress(decodeStrKey(secret,144),cryptoApi()); }
export async function signWalletMessage(secret,message) {
  const api=cryptoApi(),seed=decodeStrKey(secret,144);
  const privateKey=await api.subtle.importKey('pkcs8',new Uint8Array([...PKCS8_PREFIX,...seed]),{name:'Ed25519'},false,['sign']);
  const signature=new Uint8Array(await api.subtle.sign({name:'Ed25519'},privateKey,encoder.encode(String(message))));
  let binary='';for(const byte of signature)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
