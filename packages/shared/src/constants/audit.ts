// Audit log actions
export const AUDIT_ACTIONS = [
  // Auth
  'AUTH_LOGIN',
  'AUTH_LOGOUT',
  'AUTH_SCOPE_GRANT',
  'AUTH_SCOPE_REVOKE',
  'AUTH_TOKEN_REFRESH',

  // User
  'USER_SETTINGS_UPDATE',
  'USER_DELETE',

  // Contacts
  'CONTACT_CREATE',
  'CONTACT_UPDATE',
  'CONTACT_DELETE',
  'CONTACT_IMPORT',

  // Interactions
  'INTERACTION_CREATE',
  'INTERACTION_UPDATE',
  'INTERACTION_DELETE',

  // Reminders
  'REMINDER_RULE_CREATE',
  'REMINDER_RULE_UPDATE',
  'REMINDER_RULE_DELETE',
  'REMINDER_COMPLETE',
  'REMINDER_SNOOZE',
  'REMINDER_SKIP',

  // Calendar
  'CALENDAR_SYNC',

  // Digest
  'DIGEST_SEND',

  // Data export
  'DATA_EXPORT',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Resource types for audit logs
export const AUDIT_RESOURCE_TYPES = [
  'user',
  'contact',
  'interaction',
  'reminder_rule',
  'reminder_instance',
  'calendar_event',
  'digest',
] as const;

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];
