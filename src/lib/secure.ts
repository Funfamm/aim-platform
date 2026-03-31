// src/lib/secure.ts
// Simple AES-256-GCM encryption helper for storing SMTP passwords securely.
// Uses a 32-byte base64-encoded key from the ENCRYPTION_KEY environment variable.

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_B64 = process.env.ENCRYPTION_KEY;
if (!KEY_B64) {
  throw new Error('ENCRYPTION_KEY environment variable is not set');
}
const KEY = Buffer.from(KEY_B64, 'base64');
if (KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be a 32-byte base64 string');
}

/**
 * Encrypt a UTF‑8 string and return a base64 representation containing IV, ciphertext and auth tag.
 */
export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12); // 96‑bit nonce for GCM
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store as iv|ciphertext|tag
  const payload = Buffer.concat([iv, encrypted, authTag]);
  return payload.toString('base64');
}

/**
 * Decrypt a base64 string produced by `encrypt`.
 */
export function decrypt(cipherText: string): string {
  const data = Buffer.from(cipherText, 'base64');
  const iv = data.slice(0, 12);
  const authTag = data.slice(data.length - 16);
  const encrypted = data.slice(12, data.length - 16);
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
