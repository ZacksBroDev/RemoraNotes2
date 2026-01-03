// Reminder types
export const REMINDER_TYPES = ['birthday', 'anniversary', 'follow_up', 'custom'] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

// Reminder priorities
export const REMINDER_PRIORITIES = ['high', 'medium', 'low'] as const;
export type ReminderPriority = (typeof REMINDER_PRIORITIES)[number];

// Reminder instance statuses
export const REMINDER_STATUSES = ['pending', 'completed', 'snoozed', 'skipped'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

// Interval anchors for follow-up reminders
export const INTERVAL_ANCHORS = ['last_contact', 'creation', 'custom_date'] as const;
export type IntervalAnchor = (typeof INTERVAL_ANCHORS)[number];

// Scoring weights for Today Queue (from ADR-004)
export const REMINDER_TYPE_SCORES: Record<ReminderType, number> = {
  birthday: 15,
  anniversary: 12,
  follow_up: 10,
  custom: 8,
};

export const PRIORITY_MULTIPLIERS: Record<ReminderPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const OVERDUE_PENALTY_PER_DAY = 5;

// Default notification days before
export const DEFAULT_NOTIFY_DAYS_BEFORE = [0, 7]; // Day-of and 1 week before

// Materialization window (days)
export const MATERIALIZATION_WINDOW = {
  free: 30,
  pro: 90,
} as const;
