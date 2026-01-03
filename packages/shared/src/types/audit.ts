import type { AuditAction, AuditResourceType } from '../constants/index.js';

export interface AuditLog {
  _id: string;
  userId: string;

  // Action details
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;

  // Non-PII metadata only
  metadata?: Record<string, unknown>;

  // Request info (hashed/anonymized)
  ipHash?: string;
  userAgent?: string;

  // Timestamp
  timestamp: Date;
}

export interface AuditLogCreate {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  userAgent?: string;
}
