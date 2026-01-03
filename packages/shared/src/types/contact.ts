import type { ContactPriority, ContactSource, ContactTag } from '../constants/index.js';

export interface MonthDay {
  month: number; // 1-12
  day: number; // 1-31
  year?: number; // Optional, for age calculation
}

export interface LocalOverrides {
  name?: string;
  phone?: string;
  notes?: string;
  company?: string;
  jobTitle?: string;
}

export interface Contact {
  _id: string;
  userId: string;

  // Identity
  name: string;
  email?: string; // Encrypted
  emailHash?: string; // For dedup queries
  phone?: string; // Encrypted
  phoneHash?: string; // For dedup queries

  // Work info
  company?: string;
  jobTitle?: string;

  // Categorization
  tags: ContactTag[];
  priority: ContactPriority;
  importance: number; // 1-10 scale

  // Dates
  birthday?: MonthDay;
  anniversary?: MonthDay;

  // Notes
  notes?: string;

  // Source tracking
  source: ContactSource;
  googleResourceName?: string; // Google People API resource ID
  hasGoogleLink: boolean;
  localOverrides?: LocalOverrides;
  lastSyncedAt?: Date;

  // Interaction tracking
  lastContactedAt?: Date;
  interactionCount: number;

  // Status
  isArchived: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactCreate {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  tags?: ContactTag[];
  priority?: ContactPriority;
  importance?: number;
  birthday?: MonthDay;
  anniversary?: MonthDay;
  notes?: string;
}

export interface ContactUpdate extends Partial<ContactCreate> {
  isArchived?: boolean;
}

export interface ContactPublic extends Omit<Contact, 'emailHash' | 'phoneHash' | 'localOverrides'> {
  // Public view excludes hash fields
}
