import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  type AuditAction,
  type AuditResourceType,
} from '@remoranotes/shared';

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;

  // Action details
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: mongoose.Types.ObjectId;

  // Non-PII metadata only
  metadata?: Record<string, unknown>;

  // Request info (hashed/anonymized)
  ipHash?: string;
  userAgent?: string;

  // Timestamp
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // Action details
  action: {
    type: String,
    enum: AUDIT_ACTIONS,
    required: true,
    index: true,
  },
  resourceType: {
    type: String,
    enum: AUDIT_RESOURCE_TYPES,
    required: true,
  },
  resourceId: {
    type: Schema.Types.ObjectId,
    sparse: true,
  },

  // Metadata (non-PII)
  metadata: {
    type: Schema.Types.Mixed,
  },

  // Request info
  ipHash: String,
  userAgent: String,

  // Timestamp (indexed via TTL index below)
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Compound indexes
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });

// TTL index - keep audit logs for 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

auditLogSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj.__v;
    return ret;
  },
});

export const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
