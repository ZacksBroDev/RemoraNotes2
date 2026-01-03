// Base Google scopes (always requested)
export const GOOGLE_BASE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
] as const;

// Optional scopes (requested incrementally)
export const GOOGLE_CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly';
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

// All available optional scopes
export const GOOGLE_OPTIONAL_SCOPES = {
  contacts: GOOGLE_CONTACTS_SCOPE,
  calendar: GOOGLE_CALENDAR_SCOPE,
} as const;

export type GoogleOptionalScope = keyof typeof GOOGLE_OPTIONAL_SCOPES;
