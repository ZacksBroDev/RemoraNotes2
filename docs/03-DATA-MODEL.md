# RemoraNotes - Data Model Specification

## Overview

All collections enforce per-user authorization boundaries. Every document (except `auditLogs`) contains a `userId` field that must match the authenticated user.

**Encryption Legend**:

- 🔐 Field is encrypted at application level using user's DEK
- 🔑 Field is hashed for query purposes (cannot be decrypted)
- ⏰ Field stores UTC timestamp

---

## Collection: `users`

Stores user accounts, preferences, and OAuth tokens.

```javascript
{
  _id: ObjectId,

  // Google OAuth identity
  googleId: String,                    // Google's unique user ID
  email: String,                       // 🔐 Encrypted (for display only)
  emailHash: String,                   // 🔑 SHA-256 hash for uniqueness check
  name: String,
  picture: String,                     // Google profile picture URL

  // Encrypted OAuth tokens
  encryptedRefreshToken: String,       // 🔐 AES-256-GCM encrypted
  encryptedDEK: Buffer,                // 🔐 KMS-encrypted Data Encryption Key
  tokenExpiresAt: Date,                // ⏰ When refresh token expires

  // User mode and plan
  mode: {
    type: String,
    enum: ['personal', 'business', 'both'],
    default: 'both'
  },
  plan: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free'
  },
  planExpiresAt: Date,                 // ⏰ For trial/subscription

  // Preferences
  preferences: {
    timezone: String,                  // IANA timezone (e.g., 'America/New_York')
    digestEnabled: Boolean,            // Default: true
    digestHour: Number,                // 0-23, local time (default: 8)
    digestDays: [Number],              // 0-6, Sunday=0 (default: [1,2,3,4,5])
    upcomingWindow: Number,            // Days to show in "upcoming" (default: 7)
    privacyStoreEventTitles: Boolean,  // Default: false (privacy-first)

    // Default reminder settings
    defaultFollowUpDays: {
      client: Number,                  // Default: 30
      lead: Number,                    // Default: 14
      friend: Number,                  // Default: 60
      family: Number,                  // Default: 90
      vendor: Number,                  // Default: 90
    },
    birthdayRemindDaysBefore: Number,  // Default: 7
  },

  // Google sync state
  googleSync: {
    contactsSyncToken: String,
    contactsLastSyncedAt: Date,        // ⏰
    calendarSyncToken: String,
    calendarLastSyncedAt: Date,        // ⏰
    calendarWindowDays: Number,        // 30 (free) or 90 (pro)
  },

  // Onboarding state
  onboarding: {
    completedAt: Date,                 // ⏰
    steps: {
      modeSelected: Boolean,
      contactsImported: Boolean,
      firstReminderCreated: Boolean,
      digestConfigured: Boolean,
    }
  },

  // Feature flags (user-level overrides)
  featureFlags: {
    calendarSyncEnabled: Boolean,      // Default: true
    betaFeatures: Boolean,             // Default: false
  },

  // Metadata
  createdAt: Date,                     // ⏰
  updatedAt: Date,                     // ⏰
  lastLoginAt: Date,                   // ⏰
  deletedAt: Date,                     // ⏰ Soft delete (hard delete via job)
}
```

**Indexes**:

```javascript
// Unique Google identity
{ googleId: 1 } // unique

// Lookup by email hash (for potential merge scenarios)
{ emailHash: 1 }

// Find users for digest dispatch (by timezone band)
{ 'preferences.digestEnabled': 1, 'preferences.digestHour': 1, 'preferences.timezone': 1 }

// Find users needing calendar sync
{ 'googleSync.calendarLastSyncedAt': 1 }
```

---

## Collection: `contacts`

Stores contact records with encrypted PII.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,                    // Owner (indexed, required)

  // Identity
  name: {
    first: String,
    last: String,
    display: String,                   // Computed: "First Last" or custom
  },

  // Contact info (encrypted)
  email: String,                       // 🔐 Primary email
  emailHash: String,                   // 🔑 For deduplication
  phone: String,                       // 🔐 Primary phone
  phoneHash: String,                   // 🔑 For deduplication

  // Source tracking
  source: {
    type: String,
    enum: ['manual', 'google'],
    default: 'manual'
  },
  googleResourceName: String,          // Google People API resource ID
  hasGoogleLink: Boolean,              // Has associated Google contact
  localOverrides: {                    // User edits to imported data
    name: String,
    phone: String,
    notes: String,
    // Only populated fields were explicitly overridden
  },
  lastSyncedAt: Date,                  // ⏰ Last Google sync

  // Categorization
  tags: [{
    type: String,
    enum: ['client', 'lead', 'friend', 'family', 'vendor', 'colleague', 'other']
  }],
  customTags: [String],                // User-defined tags

  // Business-specific fields
  business: {
    company: String,
    title: String,
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    importance: {                      // 1-10 scale for queue scoring
      type: Number,
      min: 1,
      max: 10,
      default: 5
    },
    value: String,                     // Free-form (e.g., "Enterprise client", "$50k deal")
  },

  // Important dates (month/day for recurrence)
  birthday: {
    month: Number,                     // 1-12
    day: Number,                       // 1-31
    year: Number,                      // Optional, for age calc
  },
  anniversary: {
    month: Number,
    day: Number,
    year: Number,
  },
  customDates: [{
    label: String,                     // e.g., "Work anniversary"
    month: Number,
    day: Number,
    year: Number,
  }],

  // Interaction tracking
  lastContactedAt: Date,               // ⏰ Last interaction timestamp
  interactionCount: Number,            // Total interactions logged

  // Notes
  notes: String,                       // 🔐 Encrypted free-form notes

  // Metadata
  isArchived: Boolean,                 // Hidden but not deleted
  createdAt: Date,                     // ⏰
  updatedAt: Date,                     // ⏰
}
```

**Indexes**:

```javascript
// Primary lookup: all contacts for a user
{ userId: 1, isArchived: 1 }

// Deduplication: unique email per user
{ userId: 1, emailHash: 1 } // unique, sparse

// Deduplication: unique phone per user
{ userId: 1, phoneHash: 1 } // unique, sparse

// Google sync: find linked contacts
{ userId: 1, source: 1, googleResourceName: 1 }

// Birthday queries: find contacts with birthday in month
{ userId: 1, 'birthday.month': 1, 'birthday.day': 1 }

// Anniversary queries
{ userId: 1, 'anniversary.month': 1, 'anniversary.day': 1 }

// Follow-up queries: contacts not contacted recently
{ userId: 1, lastContactedAt: 1, 'business.priority': 1 }

// Search by tags
{ userId: 1, tags: 1 }
```

---

## Collection: `reminderRules`

Defines reminder patterns (the "template" for recurring reminders).

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  contactId: ObjectId,                 // Optional, null for general reminders

  // Type determines behavior
  type: {
    type: String,
    enum: ['birthday', 'anniversary', 'follow_up', 'holiday', 'custom'],
    required: true
  },

  // For fixed-date reminders (birthday, anniversary, holiday, some custom)
  fixedDate: {
    month: Number,                     // 1-12
    day: Number,                       // 1-31
    // Year omitted = recurring annually
  },

  // For interval-based reminders (follow_up, some custom)
  interval: {
    days: Number,                      // e.g., 30, 60, 90
    anchor: {
      type: String,
      enum: ['last_contact', 'rule_creation', 'custom_date'],
      default: 'last_contact'
    },
    customAnchorDate: Date,            // ⏰ If anchor = 'custom_date'
  },

  // Common configuration
  title: String,                       // e.g., "Follow up with John"
  description: String,                 // Additional context
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },

  // Notification timing
  notifyDaysBefore: [Number],          // e.g., [0, 7] = day-of and 7 days before

  // State
  isActive: Boolean,                   // Can be paused
  isAutoGenerated: Boolean,            // Created by system (birthday import)

  // Metadata
  createdAt: Date,                     // ⏰
  updatedAt: Date,                     // ⏰
}
```

**Indexes**:

```javascript
// All rules for a user
{ userId: 1, isActive: 1 }

// Rules for a specific contact
{ userId: 1, contactId: 1 }

// Birthday rules for regeneration
{ userId: 1, type: 1, isActive: 1 }

// Interval rules for recalculation
{ userId: 1, type: 1, 'interval.anchor': 1 }
```

---

## Collection: `reminderInstances`

Materialized upcoming reminder occurrences (generated from rules).

```javascript
{
  _id: ObjectId,
  ruleId: ObjectId,                    // Parent rule
  userId: ObjectId,
  contactId: ObjectId,                 // Denormalized for query efficiency

  // Due date (always a specific date)
  dueDate: Date,                       // ⏰ When reminder is due

  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'snoozed', 'skipped'],
    default: 'pending'
  },
  completedAt: Date,                   // ⏰
  completedNote: String,               // Brief note on completion
  snoozedUntil: Date,                  // ⏰
  snoozeCount: Number,                 // Track snooze abuse

  // Denormalized fields for efficient querying
  type: String,                        // From rule
  priority: String,                    // From rule
  title: String,                       // From rule (or contact name for birthdays)

  // Contact denormalization
  contactName: String,
  contactEmail: String,                // 🔐 Encrypted
  contactPhone: String,                // 🔐 Encrypted

  // For Today Queue scoring
  score: Number,                       // Calculated priority score
  isOverdue: Boolean,
  daysOverdue: Number,

  // Idempotency
  instanceKey: String,                 // Unique: `${ruleId}:${dueDateString}`

  // Metadata
  createdAt: Date,                     // ⏰
  updatedAt: Date,                     // ⏰
}
```

**Indexes**:

```javascript
// Today Queue: pending reminders due today or earlier
{ userId: 1, status: 1, dueDate: 1 }

// Upcoming reminders
{ userId: 1, status: 1, dueDate: 1, priority: 1 }

// Find by rule (for regeneration)
{ ruleId: 1, status: 1 }

// Idempotency: prevent duplicate instances
{ instanceKey: 1 } // unique

// Cleanup: find old completed instances
{ status: 1, completedAt: 1 }
```

---

## Collection: `interactions`

Logs when user contacted someone.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  contactId: ObjectId,

  // When
  occurredAt: Date,                    // ⏰ When interaction happened

  // Type
  type: {
    type: String,
    enum: ['call', 'email', 'meeting', 'text', 'social', 'other'],
    default: 'other'
  },

  // Notes (lightweight, not full CRM)
  notes: String,                       // 🔐 Brief notes about conversation

  // Optional: link to completed reminder
  reminderInstanceId: ObjectId,

  // Metadata
  createdAt: Date,                     // ⏰
}
```

**Indexes**:

```javascript
// Interactions for a contact
{ userId: 1, contactId: 1, occurredAt: -1 }

// Recent interactions across all contacts
{ userId: 1, occurredAt: -1 }

// Cleanup old interactions (optional data retention)
{ userId: 1, createdAt: 1 }
```

---

## Collection: `calendarEvents`

Cached Google Calendar events (rolling window only).

```javascript
{
  _id: ObjectId,
  userId: ObjectId,

  // Google Calendar identity
  calendarId: String,                  // Google calendar ID
  eventId: String,                     // Google event ID

  // Event timing
  start: {
    dateTime: Date,                    // ⏰ For timed events
    date: String,                      // For all-day events (YYYY-MM-DD)
    timeZone: String,
  },
  end: {
    dateTime: Date,
    date: String,
    timeZone: String,
  },
  isAllDay: Boolean,

  // Event details (minimal by default)
  summary: String,                     // 🔐 Optional, only if user enables
  hasSummary: Boolean,                 // True if summary was stored

  // For reminder matching
  attendees: [{
    email: String,                     // 🔐 Encrypted
    emailHash: String,                 // 🔑 For contact matching
  }],

  // Sync metadata
  syncedAt: Date,                      // ⏰ Last sync timestamp
  googleUpdatedAt: Date,               // ⏰ Google's updated timestamp
  etag: String,                        // For sync conflict detection

  // Expiry for cleanup
  expiresAt: Date,                     // ⏰ TTL index target
}
```

**Indexes**:

```javascript
// Find events for a user in date range
{ userId: 1, 'start.dateTime': 1 }
{ userId: 1, 'start.date': 1 }

// Prevent duplicates
{ userId: 1, calendarId: 1, eventId: 1 } // unique

// Automatic cleanup of expired events
{ expiresAt: 1 } // TTL index, expireAfterSeconds: 0

// Match events to contacts
{ userId: 1, 'attendees.emailHash': 1 }
```

---

## Collection: `auditLogs`

System audit trail (NO PII).

```javascript
{
  _id: ObjectId,
  userId: ObjectId,                    // May be null for system events

  // Action categorization
  category: {
    type: String,
    enum: ['auth', 'sync', 'reminder', 'email', 'data', 'account'],
  },
  action: {
    type: String,
    enum: [
      // Auth
      'LOGIN', 'LOGOUT', 'TOKEN_REFRESH', 'TOKEN_REVOKE',
      // Sync
      'CONTACTS_SYNC_START', 'CONTACTS_SYNC_COMPLETE', 'CONTACTS_SYNC_ERROR',
      'CALENDAR_SYNC_START', 'CALENDAR_SYNC_COMPLETE', 'CALENDAR_SYNC_ERROR',
      // Reminder
      'REMINDER_CREATED', 'REMINDER_COMPLETED', 'REMINDER_SNOOZED', 'REMINDER_SKIPPED',
      'REMINDER_RECALC_START', 'REMINDER_RECALC_COMPLETE',
      // Email
      'DIGEST_SENT', 'DIGEST_SKIPPED', 'DIGEST_ERROR',
      // Data
      'CONTACT_CREATED', 'CONTACT_UPDATED', 'CONTACT_DELETED',
      'DATA_EXPORT', 'DATA_IMPORT',
      // Account
      'ACCOUNT_CREATED', 'ACCOUNT_UPDATED', 'ACCOUNT_DELETED',
      'GOOGLE_CONNECTED', 'GOOGLE_DISCONNECTED',
    ],
  },

  // Non-PII metadata
  metadata: {
    resourceType: String,              // 'contact', 'reminder', etc.
    resourceId: ObjectId,
    count: Number,                     // For batch operations
    duration: Number,                  // For sync operations (ms)
    error: String,                     // Error message (no PII)
  },

  // Idempotency
  idempotencyKey: String,              // For job deduplication

  // Request context (no PII)
  request: {
    ipHash: String,                    // Hashed IP
    userAgent: String,
    requestId: String,
  },

  // Timestamp
  timestamp: Date,                     // ⏰
}
```

**Indexes**:

```javascript
// Query logs by user and time
{ userId: 1, timestamp: -1 }

// Query by action type
{ action: 1, timestamp: -1 }

// Idempotency checks
{ idempotencyKey: 1 } // unique, sparse

// Cleanup old logs (90-day retention)
{ timestamp: 1 } // TTL index candidate
```

---

## Collection: `digestQueue` (Optional - for SQS backup)

Tracks digest email status for idempotency.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,

  // Idempotency
  digestDate: String,                  // YYYY-MM-DD
  idempotencyKey: String,              // `digest:${userId}:${digestDate}`

  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'skipped', 'error'],
  },

  // Timing
  scheduledFor: Date,                  // ⏰ When digest should be sent
  processedAt: Date,                   // ⏰ When actually processed

  // Result
  emailMessageId: String,              // SES message ID
  error: String,

  // Metadata
  createdAt: Date,                     // ⏰
}
```

**Indexes**:

```javascript
// Idempotency check
{ idempotencyKey: 1 } // unique

// Find pending digests
{ status: 1, scheduledFor: 1 }

// Cleanup
{ createdAt: 1 } // TTL after 7 days
```

---

## Index Justifications

| Collection        | Index                                  | Query Pattern           | Justification                             |
| ----------------- | -------------------------------------- | ----------------------- | ----------------------------------------- |
| users             | `googleId` unique                      | OAuth login             | Fast lookup on every auth                 |
| contacts          | `userId, emailHash` unique             | Deduplication on import | Prevent duplicate contacts per user       |
| contacts          | `userId, birthday.month, birthday.day` | Birthday reminders      | Monthly reminder generation               |
| reminderInstances | `userId, status, dueDate`              | Today Queue             | Most critical query, needs compound index |
| reminderInstances | `instanceKey` unique                   | Idempotency             | Prevent duplicate reminder generation     |
| calendarEvents    | `expiresAt` TTL                        | Auto-cleanup            | Automatic expiry without job              |
| auditLogs         | `idempotencyKey` unique sparse         | Job deduplication       | Prevent double-processing                 |

---

## Data Retention Policies

| Collection                    | Retention   | Mechanism                   |
| ----------------------------- | ----------- | --------------------------- |
| calendarEvents                | 90 days max | TTL index on `expiresAt`    |
| auditLogs                     | 90 days     | TTL index on `timestamp`    |
| reminderInstances (completed) | 30 days     | Background job cleanup      |
| digestQueue                   | 7 days      | TTL index on `createdAt`    |
| interactions                  | Indefinite  | User choice (export/delete) |

---

## Schema Versioning

Each collection has an implicit `__v` field (Mongoose versionKey) for optimistic concurrency. Major schema changes should:

1. Add migration script to `/migrations`
2. Document change in `CLAUDE.md`
3. Update this file
4. Run migration in staging before production
