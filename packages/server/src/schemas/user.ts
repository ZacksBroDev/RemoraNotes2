import { z } from 'zod';
import { USER_MODES } from '@remoranotes/shared';

// User preferences update
export const userPreferencesSchema = z.object({
  timezone: z.string().max(100).optional(),
  digestTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Must be in HH:mm format')
    .optional(),
  digestEnabled: z.boolean().optional(),
  storeEventTitles: z.boolean().optional(),
});

// Mode update
export const userModeSchema = z.object({
  mode: z.enum(USER_MODES),
});

// Onboarding complete
export const onboardingCompleteSchema = z.object({
  mode: z.enum(USER_MODES),
  enableContacts: z.boolean().default(false),
  enableCalendar: z.boolean().default(false),
});

export type UserPreferencesUpdate = z.infer<typeof userPreferencesSchema>;
export type UserModeUpdate = z.infer<typeof userModeSchema>;
export type OnboardingComplete = z.infer<typeof onboardingCompleteSchema>;
