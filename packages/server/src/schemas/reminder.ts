import { z } from 'zod';
import { REMINDER_TYPES, REMINDER_PRIORITIES, INTERVAL_ANCHORS } from '@remoranotes/shared';
import { monthDaySchema } from './contact.js';

// Reminder rule creation schema
export const reminderRuleCreateSchema = z
  .object({
    contactId: z.string().length(24),
    type: z.enum(REMINDER_TYPES),
    fixedDate: monthDaySchema.optional(),
    intervalDays: z.number().int().min(1).max(365).optional(),
    intervalAnchor: z.enum(INTERVAL_ANCHORS).optional(),
    customAnchorDate: z.coerce.date().optional(),
    priority: z.enum(REMINDER_PRIORITIES).optional(),
    notifyDaysBefore: z.array(z.number().int().min(0).max(30)).optional(),
    customTitle: z.string().max(200).optional(),
    customNotes: z.string().max(2000).optional(),
  })
  .refine(
    (data) => {
      // Fixed-date reminders need a fixedDate
      if (['birthday', 'anniversary'].includes(data.type) || data.type === 'custom') {
        if (data.type === 'custom' && data.intervalDays) return true; // Custom can be interval-based
        return !!data.fixedDate;
      }
      // Follow-up reminders need intervalDays
      if (data.type === 'follow_up') {
        return !!data.intervalDays;
      }
      return true;
    },
    {
      message: 'Invalid reminder configuration for the selected type',
    }
  );

// Reminder rule update schema
export const reminderRuleUpdateSchema = z.object({
  fixedDate: monthDaySchema.optional(),
  intervalDays: z.number().int().min(1).max(365).optional(),
  intervalAnchor: z.enum(INTERVAL_ANCHORS).optional(),
  customAnchorDate: z.coerce.date().optional(),
  priority: z.enum(REMINDER_PRIORITIES).optional(),
  notifyDaysBefore: z.array(z.number().int().min(0).max(30)).optional(),
  customTitle: z.string().max(200).optional(),
  customNotes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

// Snooze schema
export const snoozeSchema = z.object({
  snoozeDays: z.number().int().min(1).max(30),
});

export type ReminderRuleCreate = z.infer<typeof reminderRuleCreateSchema>;
export type ReminderRuleUpdate = z.infer<typeof reminderRuleUpdateSchema>;
export type SnoozeInput = z.infer<typeof snoozeSchema>;
