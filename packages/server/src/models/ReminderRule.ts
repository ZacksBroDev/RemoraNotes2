import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  REMINDER_TYPES,
  REMINDER_PRIORITIES,
  INTERVAL_ANCHORS,
  DEFAULT_NOTIFY_DAYS_BEFORE,
  type ReminderType,
  type ReminderPriority,
  type IntervalAnchor,
  type MonthDay,
} from '@remoranotes/shared';

export interface IReminderRule extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  contactId: mongoose.Types.ObjectId;

  // Type
  type: ReminderType;

  // For fixed-date reminders
  fixedDate?: MonthDay;

  // For interval-based reminders
  intervalDays?: number;
  intervalAnchor?: IntervalAnchor;
  customAnchorDate?: Date;

  // Common
  priority: ReminderPriority;
  isActive: boolean;
  notifyDaysBefore: number[];

  // Custom reminder fields
  customTitle?: string;
  customNotes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const monthDaySchema = new Schema<MonthDay>(
  {
    month: { type: Number, min: 1, max: 12, required: true },
    day: { type: Number, min: 1, max: 31, required: true },
    year: { type: Number },
  },
  { _id: false }
);

const reminderRuleSchema = new Schema<IReminderRule>(
  {
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

    // Type
    type: {
      type: String,
      enum: REMINDER_TYPES,
      required: true,
    },

    // Fixed-date
    fixedDate: monthDaySchema,

    // Interval-based
    intervalDays: {
      type: Number,
      min: 1,
    },
    intervalAnchor: {
      type: String,
      enum: INTERVAL_ANCHORS,
    },
    customAnchorDate: Date,

    // Common
    priority: {
      type: String,
      enum: REMINDER_PRIORITIES,
      default: 'medium',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notifyDaysBefore: {
      type: [Number],
      default: DEFAULT_NOTIFY_DAYS_BEFORE,
    },

    // Custom
    customTitle: String,
    customNotes: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes
reminderRuleSchema.index({ userId: 1, contactId: 1 });
reminderRuleSchema.index({ userId: 1, type: 1, isActive: 1 });
reminderRuleSchema.index({ userId: 1, isActive: 1 });

reminderRuleSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj.__v;
    return ret;
  },
});

export const ReminderRule: Model<IReminderRule> = mongoose.model<IReminderRule>(
  'ReminderRule',
  reminderRuleSchema
);
