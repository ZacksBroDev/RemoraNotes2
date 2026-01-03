import type { UserMode, PlanTier, GoogleOptionalScope } from '../constants/index.js';

export interface User {
  _id: string;
  googleId: string;
  email: string;
  emailHash: string;
  name: string;
  avatarUrl?: string;

  // Mode & plan
  mode: UserMode;
  plan: PlanTier;

  // OAuth tokens (encrypted)
  encryptedRefreshToken?: string;
  encryptedDEK: string; // Data Encryption Key

  // Granted Google scopes
  grantedScopes: GoogleOptionalScope[];

  // Preferences
  timezone: string;
  digestTime: string; // HH:mm format, e.g., "08:00"
  digestEnabled: boolean;
  storeEventTitles: boolean;

  // Sync state
  calendarSyncToken?: string;
  lastCalendarSyncAt?: Date;
  contactsSyncToken?: string;
  lastContactsSyncAt?: Date;

  // Onboarding
  onboardingCompleted: boolean;
  onboardingStep?: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

export interface UserPreferences {
  timezone: string;
  digestTime: string;
  digestEnabled: boolean;
  storeEventTitles: boolean;
}

export interface UserPublic {
  _id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  mode: UserMode;
  plan: PlanTier;
  grantedScopes: GoogleOptionalScope[];
  timezone: string;
  digestTime: string;
  digestEnabled: boolean;
  storeEventTitles: boolean;
  onboardingCompleted: boolean;
  createdAt: Date;
}
