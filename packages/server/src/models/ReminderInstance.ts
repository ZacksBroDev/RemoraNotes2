import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  REMINDER_TYPES,
  REMINDER_PRIORITIES,
  REMINDER_STATUSES,
  type ReminderType,
  type ReminderPriority,
  type ReminderStatus,
} from '@remoranotes/shared';

export interface IReminderInstance extends Document {
  _id: mongoose.Types.ObjectId;
  ruleId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  contactId: mongoose.Types.ObjectId;

  // Instance key for idempotency
  instanceKey: string;

  // Due info
  dueDate: Date;
  status: ReminderStatus;

  // Action tracking
  completedAt?: Date;
  snoozedUntil?: Date;
  skippedAt?: Date;

  // Denormalized for efficient queries
  type: ReminderType;
  priority: ReminderPriority;
  contactName: string;
  customTitle?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const reminderInstanceSchema = new Schema<IReminderInstance>(
  {
    ruleId: {
      type: Schema.Types.ObjectId,
      ref: 'ReminderRule',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true,
    },

    // Instance key for idempotency
    instanceKey: {
      type: String,
      required: true,
      unique: true,
    },

    // Due info
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: REMINDER_STATUSES,
      default: 'pending',
    },

    // Action tracking
    completedAt: Date,
    snoozedUntil: Date,
    skippedAt: Date,

    // Denormalized
    type: {
      type: String,
      enum: REMINDER_TYPES,
      required: true,
    },
    priority: {
      type: String,
      enum: REMINDER_PRIORITIES,
      required: true,
    },
    contactName: {
      type: String,
      required: true,
    },
    customTitle: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes for Today Queue queries
reminderInstanceSchema.index({ userId: 1, status: 1, dueDate: 1 });
reminderInstanceSchema.index({ userId: 1, dueDate: 1, status: 1 });
reminderInstanceSchema.index({ ruleId: 1, dueDate: 1 });
reminderInstanceSchema.index({ instanceKey: 1 }, { unique: true });

// TTL index for auto-cleanup of old completed instances (30 days after completion)
reminderInstanceSchema.index(
  { completedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { status: 'completed' } }
);

reminderInstanceSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const ReminderInstance: Model<IReminderInstance> = mongoose.model<IReminderInstance>(
  'ReminderInstance',
  reminderInstanceSchema
);
