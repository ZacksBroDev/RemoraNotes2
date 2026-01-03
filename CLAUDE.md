# CLAUDE.md - RemoraNotes Design & Decision Log

> **Purpose**: This is a living document tracking architectural decisions, security choices, scope deferrals, and implementation assumptions for the RemoraNotes project. Future developers (including future-you) should consult this document to understand _why_ the system is designed the way it is.

> **Last Updated**: 2026-01-02
> **Version**: 0.1.0 (Initial Design)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Security Decisions](#security-decisions)
4. [Data Model Decisions](#data-model-decisions)
5. [Integration Decisions](#integration-decisions)
6. [Scope Deferrals](#scope-deferrals)
7. [Assumptions](#assumptions)
8. [Change Log](#change-log)

---

## Project Overview

**RemoraNotes** is a relationship reminder SaaS application targeting:

- **Primary**: Business users needing follow-up reminders for clients/leads
- **Secondary**: Personal users with ADHD-friendly relationship memory support

**Core Value Proposition**: Never forget to follow up with important people.

**Tech Stack**: MERN (MongoDB, Express, React/Vite, Node.js) on AWS

---

## Architecture Decisions

### ADR-001: Single Backend Engine for Business/Personal Modes

**Date**: 2026-01-02
**Status**: Accepted

**Context**: The app supports Business, Personal, and Both modes. We could either:

1. Build separate backends for each mode
2. Use a single backend with mode-aware presets

**Decision**: Single backend with mode-aware configuration.

**Rationale**:

- DRY principle: same reminder logic, different defaults
- Easier maintenance and testing
- Mode is a user preference, not a fundamental data model difference
- Allows seamless mode switching without data migration

**Consequences**:

- All models must be mode-agnostic
- UI layer handles mode-specific rendering
- Presets stored in user preferences, not hardcoded

---

### ADR-002: AWS Background Job Strategy - EventBridge + Lambda

**Date**: 2026-01-02
**Status**: Accepted

**Context**: Need to run daily jobs for:

- Digest email generation and sending
- Calendar sync
- Reminder recalculation
- Expired event cleanup

Options considered:

1. **EventBridge + Lambda**: Serverless, pay-per-use, auto-scaling
2. **ECS Scheduled Tasks**: More control, better for long-running jobs
3. **Self-managed cron on EC2**: Simple but not scalable

**Decision**: EventBridge + Lambda for all scheduled jobs.

**Rationale**:

- Solo developer project: minimize operational overhead
- Jobs are short-duration (<15 min each)
- Pay-per-invocation cost model fits early-stage
- Native AWS integration with SES, KMS, CloudWatch
- Easy to add new schedules without infrastructure changes

**Tradeoffs**:

- 15-minute Lambda timeout (acceptable for our workloads)
- Cold start latency (not user-facing, so acceptable)
- Harder to debug locally (mitigated with SAM local)

**Consequences**:

- All jobs must be idempotent (Lambda can retry)
- Jobs must complete within 15 minutes
- Use SQS for fan-out if processing many users
- Must implement idempotency keys

---

### ADR-003: Monorepo Structure

**Date**: 2026-01-02
**Status**: Accepted

**Context**: How to organize frontend, backend, and shared code.

**Decision**: Monorepo with packages structure.

```
/packages
  /client      # React/Vite frontend
  /server      # Express backend
  /shared      # Types, constants, utils
  /jobs        # Lambda job handlers
```

**Rationale**:

- Shared TypeScript types between FE/BE
- Single version control history
- Easier CI/CD pipeline
- npm workspaces for dependency management

---

### ADR-004: Today Queue Algorithm Design

**Date**: 2026-01-02
**Status**: Accepted

**Context**: Users need a prioritized daily action list that isn't overwhelming.

**Decision**: Implement a capped, prioritized Today Queue.

**Algorithm**:

```
1. Gather all reminders due today (status = 'pending', dueDate <= today)
2. Score each reminder:
   - Base score by type: follow-up=10, birthday=15, anniversary=12, custom=8
   - Priority multiplier: high=3, medium=2, low=1
   - Contact importance: (contact.importance || 5) / 5
   - Overdue penalty: +5 per day overdue
   - Final score = base * priority_multiplier * importance + overdue_penalty
3. Sort by score descending
4. Apply caps:
   - FREE tier: max 10 items
   - PRO tier: max 25 items
5. Remaining items shown as "Also due today (N more)"
```

**Rationale**:

- Prevents overwhelm (ADHD-friendly)
- High-value contacts surface first
- Overdue items don't get buried
- Tier differentiation adds upgrade incentive

**Consequences**:

- Must store contact.importance field
- Must store reminder.priority field
- Queue recalculated on page load, not cached

---

### ADR-005: Feature Flags and Plan Model

**Date**: 2026-01-02
**Status**: Accepted

**Context**: Need to support FREE/PRO tiers even before billing is implemented.

**Decision**: Implement feature flags and plan limits from day one.

**Plan Limits**:
| Feature | FREE | PRO |
|---------|------|-----|
| Contacts | 50 | Unlimited |
| Reminders | 100 | Unlimited |
| Today Queue cap | 10 | 25 |
| Calendar sync | 30 days | 90 days |
| Email digest | Daily | Daily + Weekly summary |
| Contact import | 100/sync | 500/sync |
| Data export | JSON only | JSON + CSV |

**Feature Flags** (stored in config, not user DB):

```javascript
const featureFlags = {
  CALENDAR_SYNC_ENABLED: true,
  CONTACT_IMPORT_ENABLED: true,
  WEEKLY_DIGEST_ENABLED: false, // PRO only, phase 2
  BULK_ACTIONS_ENABLED: true,
  DATA_EXPORT_ENABLED: true,
};
```

**Rationale**:

- Easier to add billing later
- A/B testing capability
- Graceful degradation if features break
- Clear upgrade path for users

---

## Security Decisions

### SEC-001: Field-Level Encryption with AWS KMS Envelope Encryption

**Date**: 2026-01-02
**Status**: Accepted

**Context**: Must encrypt PII at application level, not just at-rest.

**Decision**: Use AWS KMS envelope encryption for sensitive fields.

**Implementation**:

```
1. Generate a Data Encryption Key (DEK) per user via KMS GenerateDataKey
2. Store encrypted DEK with user record
3. Use DEK to encrypt/decrypt sensitive fields:
   - contact.email
   - contact.phone
   - calendarEvent.summary (if stored)
   - user.refreshToken
4. DEK is decrypted via KMS on each request (cached briefly)
```

**Encrypted Fields by Collection**:

- `users`: refreshToken, encryptedDEK
- `contacts`: email, phone
- `calendarEvents`: summary (optional)

**Rationale**:

- KMS provides audit trail via CloudTrail
- Envelope encryption is performant (local DEK usage)
- Per-user keys enable selective data deletion
- Field-level gives granular control

**Tradeoffs**:

- Cannot query on encrypted fields (use hashed index instead)
- Slight performance overhead
- KMS costs ($1/key/month + $0.03/10k requests)

---

### SEC-002: OAuth Token Storage

**Date**: 2026-01-02
**Status**: Accepted

**Context**: Google OAuth refresh tokens are high-value targets.

**Decision**:

- Store refresh tokens encrypted with user's DEK
- Access tokens stored only in memory (never DB)
- Refresh tokens rotated on each use

**Implementation**:

```javascript
// On OAuth callback
const dek = await kms.decrypt(user.encryptedDEK);
user.encryptedRefreshToken = encrypt(refreshToken, dek);
await user.save();

// On API call
const dek = await kms.decrypt(user.encryptedDEK);
const refreshToken = decrypt(user.encryptedRefreshToken, dek);
const { access_token } = await google.refreshAccessToken(refreshToken);
// access_token used immediately, not stored
```

---

### SEC-003: Per-User Authorization Boundaries

**Date**: 2026-01-02
**Status**: Accepted

**Context**: Every database query must be scoped to the authenticated user.

**Decision**: Implement mandatory user scoping in data access layer.

**Implementation**:

```javascript
// WRONG - allows cross-user access
const contact = await Contact.findById(contactId);

// RIGHT - always scope to user
const contact = await Contact.findOne({
  _id: contactId,
  userId: req.user._id,
});

// Enforced via middleware/service layer
class ContactService {
  constructor(userId) {
    this.userId = userId;
    this.baseQuery = { userId: this.userId };
  }

  async findById(id) {
    return Contact.findOne({ ...this.baseQuery, _id: id });
  }
}
```

---

### SEC-004: PII Logging Prevention

**Date**: 2026-01-02
**Status**: Accepted

**Context**: Logs must never contain PII or tokens.

**Decision**: Structured logging with explicit allowlist.

**Implementation**:

```javascript
// Logger sanitizes by default
const logger = createLogger({
  sanitize: true,
  allowedFields: ['userId', 'action', 'resourceType', 'resourceId', 'timestamp'],
  redactPatterns: [/email/i, /phone/i, /token/i, /password/i],
});

// Audit log schema (safe to store)
{
  userId: ObjectId,
  action: 'CONTACT_CREATED' | 'REMINDER_COMPLETED' | ...,
  resourceType: 'contact' | 'reminder' | ...,
  resourceId: ObjectId,
  metadata: { /* non-PII only */ },
  timestamp: Date,
  ipHash: String, // hashed, not raw IP
}
```

---

## Data Model Decisions

### DM-001: Birthday/Anniversary as Month-Day with Leap Year Handling

**Date**: 2026-01-02
**Status**: Accepted

**Context**: Birthdays recur yearly. Storing as full Date is problematic.

**Decision**: Store as `{ month: Number, day: Number }` with leap-day handling.

**Schema**:

```javascript
birthday: {
  month: { type: Number, min: 1, max: 12 },
  day: { type: Number, min: 1, max: 31 },
  year: { type: Number }, // Optional, for age calculation
}
```

**Leap Day Rule** (Feb 29):

- In non-leap years, Feb 29 birthdays are celebrated on Feb 28
- Query: if month=2 && day=29 && !isLeapYear(currentYear), match Feb 28

**Rationale**:

- Avoids timezone issues with full Date
- Simpler recurrence calculation
- Industry standard for birthday handling

---

### DM-002: Contact Deduplication Strategy

**Date**: 2026-01-02
**Status**: Accepted

**Context**: Imported Google contacts may duplicate manual contacts.

**Decision**: Email-based deduplication with local overrides.

**Rules**:

1. **Match key**: Lowercased email address
2. **On import conflict**:
   - If existing contact is manual: mark as `hasGoogleLink: true`, preserve manual data
   - If existing contact is imported: update with latest Google data
3. **Local overrides**: User edits to imported contacts stored as `localOverrides` subdocument
4. **Merge UI**: Show conflicts, let user choose winner

**Schema**:

```javascript
{
  email: String, // encrypted
  emailHash: String, // SHA-256 for dedup queries
  source: 'manual' | 'google',
  googleResourceName: String, // Google People API resource ID
  hasGoogleLink: Boolean,
  localOverrides: {
    name: String,
    phone: String,
    notes: String,
    // Fields user has explicitly overridden
  },
  lastSyncedAt: Date,
}
```

**Index**: `{ userId: 1, emailHash: 1 }` unique

---

### DM-003: Reminder Rules vs Instances Model

**Date**: 2026-01-02
**Status**: Accepted

**Context**: Reminders can be one-time or recurring. Need efficient querying.

**Decision**: Separate ReminderRule and ReminderInstance collections.

**ReminderRule**: Defines the pattern

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  contactId: ObjectId,
  type: 'birthday' | 'anniversary' | 'follow_up' | 'custom',

  // For fixed-date reminders
  fixedDate: { month: Number, day: Number },

  // For interval-based reminders
  intervalDays: Number,
  intervalAnchor: 'last_contact' | 'creation' | 'custom_date',

  // Common fields
  priority: 'high' | 'medium' | 'low',
  isActive: Boolean,
  notifyDaysBefore: [Number], // e.g., [0, 7] = day-of and 1 week before
}
```

**ReminderInstance**: Materialized upcoming occurrences

```javascript
{
  _id: ObjectId,
  ruleId: ObjectId,
  userId: ObjectId,
  contactId: ObjectId,
  dueDate: Date,
  status: 'pending' | 'completed' | 'snoozed' | 'skipped',
  completedAt: Date,
  snoozedUntil: Date,

  // Denormalized for query efficiency
  type: String,
  priority: String,
  contactName: String,
}
```

**Rationale**:

- Instances enable efficient "due today" queries
- Rules define logic, instances are ephemeral
- Completed instances archived for history
- Recalculation regenerates instances from rules

---

## Integration Decisions

### INT-001: Google Calendar Sync Token Strategy

**Date**: 2026-01-02
**Status**: Accepted

**Context**: Full calendar re-sync is expensive. Google provides sync tokens.

**Decision**: Use incremental sync with sync tokens.

**Implementation**:

```javascript
// First sync (or token expired)
const { events, nextSyncToken } = await calendar.list({
  timeMin: now,
  timeMax: addDays(now, windowDays),
  singleEvents: true,
});
user.calendarSyncToken = nextSyncToken;

// Subsequent syncs
const { events, nextSyncToken } = await calendar.list({
  syncToken: user.calendarSyncToken,
});
// Apply deltas (added/updated/deleted events)
```

**Token Expiry Handling**:

- If sync returns 410 Gone, discard token and full-sync
- Store token expiry estimate, refresh proactively

---

### INT-002: Google Scope Gating by Mode

**Date**: 2026-01-02
**Status**: Accepted

**Context**: Different modes need different permissions.

**Decision**: Request scopes based on user's selected mode.

**Scope Matrix**:
| Scope | Personal | Business | Both |
|-------|----------|----------|------|
| `profile` | ✓ | ✓ | ✓ |
| `email` | ✓ | ✓ | ✓ |
| `contacts.readonly` | ✓ | ✓ | ✓ |
| `calendar.readonly` | ✓ | ✓ | ✓ |
| `calendar.events.readonly` | ✓ | ✓ | ✓ |

**Note**: All modes get same scopes for MVP. Scope differentiation deferred.

---

## Scope Deferrals

### DEFER-001: SMS and Push Notifications

**Date**: 2026-01-02
**Status**: Deferred to post-v1

**Context**: Users may want instant notifications.

**Reason for Deferral**:

- SMS costs are high and complex to manage
- Push requires native app or PWA service worker
- Email digest is sufficient for MVP validation

**Revisit Trigger**: User feedback requests >10 mentions

---

### DEFER-002: Team/Organization Accounts

**Date**: 2026-01-02
**Status**: Deferred to v2

**Context**: Businesses may want shared contact lists.

**Reason for Deferral**:

- Significant complexity (RBAC, shared ownership, billing)
- Solo developer bandwidth
- Validate single-user market first

**Revisit Trigger**: >100 paying users requesting teams

---

### DEFER-003: Payment/Billing Integration

**Date**: 2026-01-02
**Status**: Deferred to v1.1

**Context**: Need to monetize eventually.

**Reason for Deferral**:

- Plan limits implemented, billing can be added later
- Stripe integration is well-documented
- Focus on core value first

**Preparation**: Plan model and limits in place from day one

---

### DEFER-004: Phone Contact Access Outside Google

**Date**: 2026-01-02
**Status**: Explicitly Out of Scope

**Context**: Users may want to import phone contacts directly.

**Reason**:

- Requires native app or complex browser APIs
- Privacy concerns
- Google Contacts covers most use cases

---

## Assumptions

### ASM-001: Calendar Event Retention Window

**Assumption**: Store events for rolling 90-day window maximum.

**Rationale**:

- Balance between usefulness and storage costs
- Privacy: don't hold historical data
- PRO tier gets 90 days, FREE gets 30 days

**Impact if Wrong**: Increase window via config, migrate job schedules

---

### ASM-002: Digest Send Time Default

**Assumption**: Default digest time is 8:00 AM user's local timezone.

**Rationale**:

- Morning check-in pattern for business users
- Configurable per-user if wrong

---

### ASM-003: Single Email Address per Contact

**Assumption**: Contacts have one primary email for deduplication.

**Rationale**:

- Simplifies dedup logic
- Google Contacts often have multiple; we pick first/primary

**Impact if Wrong**: Add `emails[]` array, update dedup to check all

---

### ASM-004: UTC Storage, Local Rendering

**Assumption**: All timestamps stored in UTC, rendered in user timezone.

**Implementation**:

- `user.timezone` stored (from browser or explicit)
- API returns UTC, frontend converts
- Jobs use user timezone for "8 AM local" logic

---

## Change Log

| Date       | Version | Author  | Summary                                   |
| ---------- | ------- | ------- | ----------------------------------------- |
| 2026-01-02 | 0.1.0   | Initial | Initial architecture and design decisions |

---

## How to Update This Document

When making changes to RemoraNotes:

1. **New Feature**: Add ADR-NNN entry with context, decision, rationale, consequences
2. **Security Change**: Add SEC-NNN entry
3. **Data Model Change**: Add DM-NNN entry with schema diff
4. **Integration Change**: Add INT-NNN entry
5. **Deferral**: Add DEFER-NNN with reason and revisit trigger
6. **Assumption Change**: Update ASM-NNN or add new entry

**Template for new decisions**:

```markdown
### [PREFIX]-NNN: Title

**Date**: YYYY-MM-DD
**Status**: Accepted | Superseded by [X] | Deprecated

**Context**: What is the issue we're facing?

**Decision**: What we decided to do.

**Rationale**: Why this decision was made.

**Consequences**: What are the results?
```

Google Contacts & Calendar are read-only

Local edits override imported data

Imported data never writes back to Google

Calendar events auto-expire after retention window

local

prod

Separate Google OAuth credentials per env

Separate SES configs per env

Separate Mongo databases per env

“The app must always clearly answer: Who should I contact today and why?”

## MVP Scope Freeze (v0.1)

This section defines the immutable scope for the initial build.  
No features outside this list may be implemented without an explicit ADR update.

### Included

- Google OAuth (Sign in with Google)
- Business / Personal / Both mode onboarding
- OAuth scope gating based on enabled features
- Manual contact creation and editing
- Contact tags, importance, and priority
- Interaction logging (last contacted + short notes)
- Reminder rules (birthday, anniversary, follow-up, custom)
- Reminder instances materialized for upcoming window
- Today Queue (prioritized, capped)
- Google Contacts import (opt-in)
- Google Calendar import (opt-in, rolling window)
- Daily email digest via Amazon SES
- Snooze / Done actions
- Data export (JSON for FREE, JSON + CSV for PRO)
- Disconnect Google (revoke tokens + delete imported data)
- Account deletion (hard delete)

### Explicitly Deferred

- SMS notifications
- Push notifications / PWA
- Native mobile apps
- Team / organization accounts
- Billing / payments
- AI summaries or analysis
- Writing data back to Google Contacts or Calendar

### INT-002: Google OAuth Scope Gating by Mode & Feature

**Date**: 2026-01-02  
**Status**: Accepted

**Context**: Requesting broad Google scopes up front reduces trust and conversion.  
Scopes should be requested only when required.

**Decision**:
Scopes are requested incrementally based on user-enabled features, not globally.

**Base Scopes (always requested)**:

- openid
- email
- profile

**Optional Scopes (requested only when feature is enabled)**:

- Google People API (contacts.readonly)
- Google Calendar API (calendar.readonly)

**Mode Behavior**:

- Business-only mode:
  - No People or Calendar scopes by default
- Personal mode:
  - Contacts and Calendar toggles shown during onboarding
- Both mode:
  - User explicitly enables Contacts and/or Calendar features

**Rationale**:

- Improves OAuth consent acceptance rates
- Principle of least privilege
- Easier compliance and future reviews

**Consequences**:

- OAuth must support incremental authorization
- UI must explain why each permission is requested

#### Hashing & Normalization Rules

Because encrypted fields cannot be queried directly, deterministic hashes are required.

**Email Normalization**:

- Trim whitespace
- Lowercase
- Hash: SHA-256(email + PEPPER)

**Phone Normalization**:

- Convert to E.164 format
- Remove punctuation
- Hash: SHA-256(phone + PEPPER)

**Indexes**:

- Unique index on { userId, emailHash } where emailHash exists
- Unique sparse index on { userId, phoneHash } where phoneHash exists

**Pepper Strategy**:

- Single application-level PEPPER stored in AWS Secrets Manager
- Not stored in database
- Rotation requires re-hashing (acceptable tradeoff)

**Collision Handling**:

- Extremely unlikely with SHA-256
- In collision case, require manual merge confirmation

#### Reminder Instance Materialization Strategy

**When instances are created**:

- On ReminderRule creation
- On interaction log update (for interval-based rules)
- Nightly via scheduled job

**Materialization Window**:

- FREE: next 30 days
- PRO: next 90 days

**Uniqueness Guarantee**:
Each ReminderInstance has a deterministic unique key:

Instances are upserted by this key to prevent duplicates.

**Cleanup**:

- Completed instances archived
- Expired instances outside window are deleted nightly

**Rationale**:

- Fast “due today” queries
- Deterministic behavior
- Safe reprocessing during retries

### INT-003: Calendar Event Privacy Mode

**Date**: 2026-01-02  
**Status**: Accepted

**Context**: Calendar events may contain sensitive personal information.

**Decision**:
Default behavior is privacy-first.

**Default Stored Fields**:

- eventId
- calendarId
- startDateTime
- endDateTime
- timezone

**Optional Fields (user-enabled)**:

- summary/title (encrypted)

**Defaults**:

- Event titles are NOT stored unless user explicitly enables
- Descriptions and attendees are NEVER stored

**Rationale**:

- Minimizes PII exposure
- Builds user trust
- Still enables reminder functionality

**Consequences**:

- UI must explain limitation
- Digest emails may omit event titles by default

### SEC-005: Deterministic Hashing Policy

**Date**: 2026-01-02  
**Status**: Accepted

**Context**: Encrypted fields cannot be queried. Hashes are required for dedupe and lookup.

**Decision**:
Use deterministic SHA-256 hashing with application-level pepper.

**Applies To**:

- contact.email → emailHash
- contact.phone → phoneHash

**Storage Rules**:

- Hashes stored in plaintext
- Original values stored encrypted
- Pepper stored only in AWS Secrets Manager

**Rationale**:

- Enables efficient queries
- Prevents rainbow table attacks
- Simple to implement and audit
