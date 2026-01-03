import type {
  ReminderType,
  ReminderPriority,
  ReminderStatus,
  IntervalAnchor,
} from '../constants/index.js';
import type { MonthDay } from './contact.js';

// Reminder Rule - defines the pattern
export interface ReminderRule {
  _id: string;
  userId: string;
  contactId: string;

  // Type
  type: ReminderType;

  // For fixed-date reminders (birthday, anniversary, custom)
  fixedDate?: MonthDay;

  // For interval-based reminders (follow_up)
  intervalDays?: number;
  intervalAnchor?: IntervalAnchor;
  customAnchorDate?: Date;

  // Common
  priority: ReminderPriority;
  isActive: boolean;
  notifyDaysBefore: number[]; // e.g., [0, 7] = day-of and 1 week before

  // Custom reminder fields
  customTitle?: string;
  customNotes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Reminder Instance - materialized occurrence
export interface ReminderInstance {
  _id: string;
  ruleId: string;
  userId: string;
  contactId: string;

  // Instance key for idempotency
  instanceKey: string; // Format: {ruleId}:{YYYY-MM-DD}

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

  // Score for Today Queue (calculated on query, not stored)
  // score?: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Create types
export interface ReminderRuleCreate {
  contactId: string;
  type: ReminderType;
  fixedDate?: MonthDay;
  intervalDays?: number;
  intervalAnchor?: IntervalAnchor;
  customAnchorDate?: Date;
  priority?: ReminderPriority;
  notifyDaysBefore?: number[];
  customTitle?: string;
  customNotes?: string;
}

export interface ReminderRuleUpdate extends Partial<
  Omit<ReminderRuleCreate, 'contactId' | 'type'>
> {
  isActive?: boolean;
}

// Today Queue item (instance with computed score)
export interface TodayQueueItem extends ReminderInstance {
  score: number;
  daysOverdue: number;
  contact: {
    _id: string;
    name: string;
    importance: number;
  };
}

export interface TodayQueueResponse {
  items: TodayQueueItem[];
  totalDue: number;
  hiddenCount: number; // Items beyond cap
}
