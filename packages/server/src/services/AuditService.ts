import type mongoose from 'mongoose';
import { AuditLog, type IAuditLog } from '../models/index.js';
import type { AuditAction, AuditResourceType } from '@remoranotes/shared';
import { hashIp } from '../utils/index.js';

interface AuditLogParams {
  userId: string | mongoose.Types.ObjectId;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export async function createAuditLog(params: AuditLogParams): Promise<IAuditLog> {
  const { userId, action, resourceType, resourceId, metadata, ip, userAgent } = params;

  const auditLog = new AuditLog({
    userId,
    action,
    resourceType,
    resourceId,
    metadata,
    ipHash: ip ? hashIp(ip) : undefined,
    userAgent: userAgent?.substring(0, 500), // Truncate long user agents
    timestamp: new Date(),
  });

  await auditLog.save();
  return auditLog;
}

// Fire-and-forget audit logging (don't wait for save)
export function logAudit(params: AuditLogParams): void {
  createAuditLog(params).catch((err) => {
    // Log error but don't fail the request
    console.error('Failed to create audit log:', err);
  });
}
