// Hachage et vérification des mots de passe avec l'API Web Crypto (disponible
// sur Cloudflare Workers sans dépendance externe).
// Algorithme : PBKDF2-SHA-256, 200 000 itérations, sel aléatoire 16 octets.

// Cloudflare Workers (workerd) plafonne PBKDF2 à 100 000 itérations max —
// une valeur plus haute passe en local (wrangler dev / Node) mais lève
// `NotSupportedError` en production.
const ITERATIONS = 100_000;
const KEY_LENGTH = 32; // octets
const ALGORITHM = 'SHA-256';

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Retourne une chaîne de la forme "<sel_hex>:<hash_hex>" à stocker en base.
 */
export async function hashPassword(password) {
  const enc = new TextEncoder();
  const saltBuf = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations: ITERATIONS, hash: ALGORITHM },
    keyMaterial,
    KEY_LENGTH * 8
  );
  return `${bufToHex(saltBuf.buffer)}:${bufToHex(derived)}`;
}

/**
 * Retourne true si `password` correspond au hash stocké.
 */
export async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const enc = new TextEncoder();
  const saltBuf = hexToBuf(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations: ITERATIONS, hash: ALGORITHM },
    keyMaterial,
    KEY_LENGTH * 8
  );
  // Comparaison en temps constant pour éviter les timing attacks
  const a = new Uint8Array(derived);
  const b = new Uint8Array(hexToBuf(hashHex));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
