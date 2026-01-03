import crypto from 'node:crypto';
import { config } from '../config/index.js';

// Normalize email for hashing
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Normalize phone to E.164-ish format (remove non-digits except +)
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

// Create deterministic hash with pepper
export function createHash(value: string): string {
  return crypto.createHmac('sha256', config.security.hashPepper).update(value).digest('hex');
}

// Hash email for dedup queries
export function hashEmail(email: string): string {
  return createHash(normalizeEmail(email));
}

// Hash phone for dedup queries
export function hashPhone(phone: string): string {
  return createHash(normalizePhone(phone));
}

// Hash IP address for audit logs
export function hashIp(ip: string): string {
  return createHash(ip);
}
