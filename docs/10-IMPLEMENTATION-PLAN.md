# RemoraNotes - Implementation Plan

## Phase Overview

| Phase       | Duration  | Goal                                    |
| ----------- | --------- | --------------------------------------- |
| **MVP**     | Weeks 1-2 | Functional prototype with core features |
| **v1**      | Weeks 3-6 | Production-ready with security & polish |
| **Post-v1** | Ongoing   | Billing, enhancements, scale            |

---

## MVP (Weeks 1-2)

### Goal

Validate core value proposition:

- User can sign in with Google
- User can see/manage contacts
- User can set up follow-up reminders
- User receives a daily email digest
- User can mark reminders complete

### Week 1: Foundation

#### Day 1-2: Project Setup

```
□ Initialize monorepo structure
  □ Create /packages/client (Vite + React)
  □ Create /packages/server (Express)
  □ Create /packages/shared (TypeScript types)
  □ Configure npm workspaces
  □ Set up TypeScript configs

□ Development environment
  □ ESLint + Prettier configuration
  □ Husky pre-commit hooks
  □ Docker Compose for local MongoDB
  □ Environment variable setup (.env.example)

□ CI/CD foundation
  □ GitHub Actions workflow (lint, test)
  □ Basic Dockerfile for server
```

**Deliverable**: Running dev environment, linting, type checking

#### Day 3-4: Authentication

```
□ Google OAuth implementation
  □ Set up Google Cloud project
  □ Configure OAuth consent screen
  □ Implement /auth/google route
  □ Implement /auth/google/callback
  □ Session management (JWT + cookies)
  □ /auth/me endpoint
  □ /auth/logout endpoint

□ User model
  □ Create User schema (simplified for MVP)
  □ googleId, email, name, picture
  □ Basic preferences (timezone)

□ Frontend auth flow
  □ Landing page with "Sign in with Google"
  □ Auth callback handler
  □ Protected route wrapper
  □ User context/store
```

**Deliverable**: Working Google login, session persistence

#### Day 5-6: Contact Management

```
□ Contact model
  □ Create Contact schema
  □ Basic fields (name, email, phone, tags)
  □ userId index

□ Contact API
  □ GET /contacts (list with pagination)
  □ GET /contacts/:id
  □ POST /contacts (create)
  □ PATCH /contacts/:id (update)
  □ DELETE /contacts/:id

□ Frontend contacts
  □ Contact list view (mobile-first)
  □ Contact detail view
  □ Add/edit contact form
  □ Basic search/filter
```

**Deliverable**: Full CRUD for manual contacts

#### Day 7: Interaction Logging

```
□ Interaction model
  □ Create schema (userId, contactId, date, type, notes)

□ Interaction API
  □ GET /contacts/:id/interactions
  □ POST /contacts/:id/interactions

□ Frontend
  □ Log interaction button on contact
  □ Interaction list on contact detail
  □ Quick log modal
```

**Deliverable**: Can log when contacted someone

### Week 2: Reminders & Digest

#### Day 8-9: Reminder Engine

```
□ Reminder models
  □ ReminderRule schema
  □ ReminderInstance schema
  □ Indexes for querying

□ Reminder generation
  □ generateInstancesForRule() function
  □ Handle follow-up type
  □ Handle birthday type (basic)
  □ instanceKey for idempotency

□ Reminder API
  □ GET /reminders/today (Today Queue)
  □ GET /reminders/rules
  □ POST /reminders/rules
  □ POST /reminders/:id/complete
  □ POST /reminders/:id/snooze

□ Frontend reminders
  □ Today Queue view (main dashboard)
  □ Reminder card component
  □ Complete/snooze buttons
  □ Add reminder rule flow
```

**Deliverable**: Working reminder system with Today Queue

#### Day 10-11: Email Digest

```
□ SES setup
  □ Verify domain in SES
  □ Create configuration set
  □ IAM role for sending

□ Digest generation
  □ Query today's reminders
  □ Query upcoming (7 days)
  □ HTML email template (basic)
  □ Text email fallback

□ Digest sending
  □ sendDigestEmail() function
  □ Manual trigger for testing
  □ /api/debug/digest (dev only)

□ One-click actions
  □ Generate signed action URLs
  □ GET /digest-actions/complete
  □ GET /digest-actions/snooze
  □ Action success page
```

**Deliverable**: Can send digest email, one-click actions work

#### Day 12-13: Polish & Testing

```
□ Bug fixes from testing
□ Error handling
  □ Global error handler
  □ User-friendly error messages
  □ Toast notifications

□ Mobile optimization
  □ Test on iPhone/Android
  □ Fix layout issues
  □ Touch target sizing

□ Basic analytics
  □ Track key events (login, reminder complete)
  □ Simple console logging

□ Documentation
  □ README.md setup instructions
  □ Environment variables list
```

**Deliverable**: Stable MVP ready for personal testing

#### Day 14: Deployment Prep

```
□ AWS infrastructure (basic)
  □ MongoDB Atlas M0 (free tier)
  □ ECS or Lambda setup (basic)
  □ CloudFront for frontend
  □ Route 53 domain setup

□ Environment configuration
  □ Production .env
  □ Secrets in environment

□ Deploy MVP
  □ Deploy frontend to S3/CloudFront
  □ Deploy backend to ECS/Lambda
  □ Verify end-to-end flow
```

**Deliverable**: MVP deployed and accessible

---

## MVP Completion Checklist

| Feature                       | Status |
| ----------------------------- | ------ |
| Google OAuth login            | □      |
| User profile/preferences      | □      |
| Contact CRUD                  | □      |
| Contact list + search         | □      |
| Interaction logging           | □      |
| Reminder rules                | □      |
| Today Queue                   | □      |
| Complete/snooze reminders     | □      |
| Email digest (manual trigger) | □      |
| One-click actions             | □      |
| Mobile-responsive UI          | □      |
| Deployed to AWS               | □      |

---

## v1 (Weeks 3-6)

### Week 3: Google Integrations

#### Day 15-17: Contact Import

```
□ Google People API integration
  □ Request contacts.readonly scope
  □ Fetch contacts from Google
  □ Parse contact fields (name, email, phone, birthday)

□ Deduplication logic
  □ Hash emails for matching
  □ Merge rules (manual vs imported)
  □ localOverrides support

□ Incremental sync
  □ Store and use syncToken
  □ Handle token expiration (410 Gone)
  □ Rate limiting

□ Frontend
  □ Import contacts button
  □ Import progress indicator
  □ Import summary modal
```

#### Day 18-19: Calendar Sync

```
□ Google Calendar API integration
  □ Request calendar.readonly scope
  □ Fetch upcoming events
  □ Store minimal fields

□ CalendarEvent model
  □ Schema implementation
  □ TTL index for cleanup
  □ Attendee email matching

□ Privacy controls
  □ privacyStoreEventTitles preference
  □ Encrypt summary if stored

□ Frontend
  □ Today's calendar section in dashboard
  □ Settings toggle for title storage
```

#### Day 20-21: Sync Jobs

```
□ Lambda job setup
  □ calendar-sync Lambda
  □ EventBridge schedule (daily)
  □ Error handling and retries

□ Idempotency
  □ Idempotency key generation
  □ Check before processing
  □ Audit log on completion
```

### Week 4: Security Hardening

#### Day 22-23: Encryption Implementation

```
□ KMS setup
  □ Create CMK
  □ IAM policies
  □ Key rotation

□ Crypto service
  □ generateDataEncryptionKey()
  □ decryptDataKey()
  □ encryptField() / decryptField()

□ Encrypt existing fields
  □ User.encryptedRefreshToken
  □ Contact.email, phone, notes
  □ Migration script for existing data

□ Hash fields
  □ User.emailHash
  □ Contact.emailHash, phoneHash
```

#### Day 24-25: Authorization & Validation

```
□ Authorization middleware
  □ requireAuth middleware
  □ Per-user scoping in services
  □ Test for IDOR vulnerabilities

□ Input validation
  □ Zod schemas for all endpoints
  □ validateBody middleware
  □ Custom validators (birthday date)

□ Rate limiting
  □ Install express-rate-limit
  □ Configure limits per endpoint
  □ Redis store for distributed limiting
```

#### Day 26-28: Logging & Monitoring

```
□ Structured logging
  □ Pino logger setup
  □ PII redaction rules
  □ Request ID propagation

□ Audit logging
  □ AuditLog model
  □ Key events logged
  □ Query interface (admin)

□ Monitoring
  □ CloudWatch metrics
  □ Error tracking (Sentry)
  □ Health check endpoint
```

### Week 5: Polish & Features

#### Day 29-31: Onboarding Flow

```
□ Onboarding steps
  □ Mode selection screen
  □ Contact import screen (with education)
  □ First reminder screen
  □ Digest setup screen

□ Permission education
  □ Explain each Google scope
  □ Privacy-first messaging

□ Onboarding state tracking
  □ user.onboarding.steps
  □ Skip and complete flows
```

#### Day 32-33: Plan & Limits

```
□ Plan model
  □ FREE vs PRO limits
  □ user.plan field

□ Limit enforcement
  □ Contact count check
  □ Reminder count check
  □ Today Queue cap
  □ Import batch size limit

□ Frontend
  □ Plan indicator in settings
  □ Upgrade prompts (link to future page)
  □ Usage display
```

#### Day 34-35: Data Export & Deletion

```
□ Data export
  □ GET /users/me/export?format=json
  □ GET /users/me/export?format=csv
  □ Generate downloadable files

□ Account deletion
  □ DELETE /users/me endpoint
  □ Confirmation requirement
  □ Hard delete implementation
  □ Google token revocation

□ Google disconnect
  □ POST /users/me/disconnect-google
  □ Delete imported data
  □ Convert linked contacts to manual
```

### Week 6: Production Readiness

#### Day 36-37: Digest Automation

```
□ Digest pipeline
  □ Dispatch Lambda (hourly)
  □ SQS queue for fan-out
  □ Sender Lambda (SQS trigger)

□ Timezone handling
  □ Query users by local digest hour
  □ Test across timezones

□ Idempotency
  □ DigestQueue model (optional)
  □ idempotencyKey checks
  □ Audit log per send
```

#### Day 38-39: Testing & QA

```
□ Unit tests
  □ Service layer tests
  □ Crypto utility tests
  □ Validation tests

□ Integration tests
  □ API endpoint tests
  □ Auth flow tests
  □ Reminder generation tests

□ Manual QA
  □ Full flow testing
  □ Mobile device testing
  □ Email rendering testing
  □ Edge cases (leap year, timezone edge)
```

#### Day 40-41: Performance & Optimization

```
□ Database optimization
  □ Index analysis
  □ Query profiling
  □ Connection pooling

□ API performance
  □ Response time analysis
  □ N+1 query fixes
  □ Caching (if needed)

□ Frontend optimization
  □ Bundle size analysis
  □ Lazy loading
  □ Image optimization
```

#### Day 42: Production Deployment

```
□ Production infrastructure
  □ MongoDB Atlas M10+
  □ ECS Fargate (2 tasks)
  □ ALB + CloudFront
  □ Route 53 DNS

□ Security verification
  □ SSL/TLS check
  □ Security headers
  □ Penetration testing (basic)

□ Monitoring setup
  □ CloudWatch dashboards
  □ Alert rules
  □ On-call rotation (self)

□ Launch
  □ DNS cutover
  □ Monitor for errors
  □ Celebrate 🎉
```

---

## v1 Completion Checklist

| Feature                                 | Status |
| --------------------------------------- | ------ |
| Google contact import                   | □      |
| Incremental contact sync                | □      |
| Google calendar sync                    | □      |
| Calendar event display                  | □      |
| Field-level encryption (KMS)            | □      |
| OAuth token encryption                  | □      |
| Per-user authorization                  | □      |
| Input validation (all endpoints)        | □      |
| Rate limiting                           | □      |
| Structured logging                      | □      |
| Audit logging                           | □      |
| Onboarding flow                         | □      |
| Mode selection (Business/Personal/Both) | □      |
| Plan limits (FREE/PRO)                  | □      |
| Data export (JSON/CSV)                  | □      |
| Account deletion                        | □      |
| Google disconnect                       | □      |
| Automated daily digest                  | □      |
| Timezone-aware scheduling               | □      |
| Unit tests (core)                       | □      |
| Integration tests                       | □      |
| Production deployment                   | □      |
| Monitoring & alerts                     | □      |

---

## Post-v1 Roadmap

### v1.1 (Week 7-8): Billing Integration

```
□ Stripe integration
  □ Customer creation
  □ Subscription management
  □ Webhook handling

□ Pro upgrade flow
  □ Pricing page
  □ Checkout flow
  □ Plan upgrade API

□ Billing portal
  □ Stripe customer portal
  □ Invoice history
```

### v1.2 (Week 9-10): Enhanced Features

```
□ Birthday/anniversary auto-reminders
  □ Auto-generate rules from contact dates
  □ User preference for notification timing

□ Holiday reminders
  □ Holiday database
  □ User-selectable holidays
  □ Regional holiday support

□ Contact merge UI
  □ Duplicate detection
  □ Merge confirmation flow
  □ Field selection
```

### v1.3 (Week 11-12): Mobile PWA

```
□ PWA setup
  □ Service worker
  □ Web app manifest
  □ Offline support (basic)

□ App-like experience
  □ Add to home screen
  □ Splash screen
  □ Full-screen mode
```

### Future Considerations

- Weekly digest summary (PRO feature)
- Custom tags (beyond presets)
- Contact groups
- Reminder templates
- Import from other sources (CSV, vCard)
- Team/organization accounts (v2)
- API for integrations
- Zapier/Make integration

---

## Risk Mitigation

| Risk                      | Mitigation                                  |
| ------------------------- | ------------------------------------------- |
| Google API quota exceeded | Rate limiting, monitor usage                |
| KMS costs spike           | Monitor decrypt calls, cache DEKs briefly   |
| Email delivery issues     | SES bounce handling, domain reputation      |
| Scope creep               | Strict MVP definition, defer non-essentials |
| Single developer burnout  | Realistic timeline, breaks scheduled        |

---

## Success Metrics

### MVP Success (Week 2)

- [ ] Can complete full flow: login → add contact → create reminder → receive digest → complete reminder
- [ ] 10 personal contacts entered
- [ ] 5 reminders working
- [ ] 1 week of digests received

### v1 Success (Week 6)

- [ ] Google contacts imported successfully
- [ ] Calendar events syncing
- [ ] Encryption verified (database inspection)
- [ ] 0 critical security issues
- [ ] <500ms API response time (p95)
- [ ] Digest emails delivered reliably

### Business Success (Week 12+)

- [ ] 10 beta users recruited
- [ ] NPS > 30
- [ ] 1 paying customer (PRO)
