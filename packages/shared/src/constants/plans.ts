// User modes
export const USER_MODES = ['business', 'personal', 'both'] as const;
export type UserMode = (typeof USER_MODES)[number];

// Plan tiers
export const PLAN_TIERS = ['free', 'pro'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

// Plan limits
export const PLAN_LIMITS = {
  free: {
    maxContacts: 50,
    maxReminders: 100,
    todayQueueCap: 10,
    calendarSyncDays: 30,
    contactImportLimit: 100,
    dataExportFormats: ['json'] as const,
  },
  pro: {
    maxContacts: Infinity,
    maxReminders: Infinity,
    todayQueueCap: 25,
    calendarSyncDays: 90,
    contactImportLimit: 500,
    dataExportFormats: ['json', 'csv'] as const,
  },
} as const;

export type PlanLimits = (typeof PLAN_LIMITS)[PlanTier];
