import crypto from 'node:crypto';
import { generateDataKey, decryptDataKey } from '../config/aws.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export interface EncryptedData {
  iv: string;
  authTag: string;
  data: string;
}

// Encrypt data with a DEK
export function encrypt(plaintext: string, dek: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Pack as: iv:authTag:data (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

// Decrypt data with a DEK
export function decrypt(encryptedString: string, dek: Buffer): string {
  const [ivBase64, authTagBase64, data] = encryptedString.split(':');

  if (!ivBase64 || !authTagBase64 || !data) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, dek, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Generate new DEK for a user
export async function createUserDEK(): Promise<{
  plaintext: Buffer;
  encryptedDEK: string;
}> {
  const { plaintext, encrypted } = await generateDataKey();

  return {
    plaintext,
    encryptedDEK: encrypted.toString('base64'),
  };
}

// Get decrypted DEK for a user
export async function getUserDEK(encryptedDEK: string): Promise<Buffer> {
  const encrypted = Buffer.from(encryptedDEK, 'base64');
  return decryptDataKey(encrypted);
}

// Simple in-memory DEK cache (short TTL)
const dekCache = new Map<string, { dek: Buffer; expiresAt: number }>();
const DEK_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getCachedUserDEK(userId: string, encryptedDEK: string): Promise<Buffer> {
  const cached = dekCache.get(userId);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.dek;
  }

  const dek = await getUserDEK(encryptedDEK);
  dekCache.set(userId, { dek, expiresAt: now + DEK_CACHE_TTL_MS });

  return dek;
}

// Clear DEK from cache (on logout, delete, etc.)
export function clearDEKCache(userId: string): void {
  dekCache.delete(userId);
}
