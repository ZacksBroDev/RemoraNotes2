# RemoraNotes - System Architecture

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENTS                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐              │
│  │   Mobile Web    │    │   Desktop Web   │    │  Email Client   │              │
│  │   (Primary)     │    │   (Secondary)   │    │  (Digest Links) │              │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘              │
│           │                      │                      │                        │
│           └──────────────────────┼──────────────────────┘                        │
│                                  │                                               │
│                                  ▼                                               │
│  ┌───────────────────────────────────────────────────────────────┐              │
│  │                     CloudFront CDN                             │              │
│  │              (React SPA + API Gateway)                         │              │
│  └───────────────────────────────┬───────────────────────────────┘              │
└──────────────────────────────────┼──────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AWS INFRASTRUCTURE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         API LAYER (ECS Fargate)                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │   │
│  │  │                     Express.js Application                       │    │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │    │   │
│  │  │  │    Routes    │  │  Middleware  │  │  Validators  │           │    │   │
│  │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │    │   │
│  │  │         │                 │                 │                    │    │   │
│  │  │         └─────────────────┼─────────────────┘                    │    │   │
│  │  │                           ▼                                      │    │   │
│  │  │  ┌─────────────────────────────────────────────────────────┐    │    │   │
│  │  │  │                   SERVICE LAYER                          │    │    │   │
│  │  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │    │    │   │
│  │  │  │  │   Auth      │ │  Contact    │ │  Reminder   │        │    │    │   │
│  │  │  │  │   Service   │ │  Service    │ │  Service    │        │    │    │   │
│  │  │  │  └─────────────┘ └─────────────┘ └─────────────┘        │    │    │   │
│  │  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │    │    │   │
│  │  │  │  │  Calendar   │ │   Digest    │ │  Crypto     │        │    │    │   │
│  │  │  │  │  Service    │ │  Service    │ │  Service    │        │    │    │   │
│  │  │  │  └─────────────┘ └─────────────┘ └─────────────┘        │    │    │   │
│  │  │  └─────────────────────────────────────────────────────────┘    │    │   │
│  │  │                           │                                      │    │   │
│  │  │                           ▼                                      │    │   │
│  │  │  ┌─────────────────────────────────────────────────────────┐    │    │   │
│  │  │  │                   DATA ACCESS LAYER                      │    │    │   │
│  │  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │    │    │   │
│  │  │  │  │   User      │ │  Contact    │ │  Reminder   │        │    │    │   │
│  │  │  │  │   Repo      │ │  Repo       │ │  Repo       │        │    │    │   │
│  │  │  │  └─────────────┘ └─────────────┘ └─────────────┘        │    │    │   │
│  │  │  └─────────────────────────────────────────────────────────┘    │    │   │
│  │  └─────────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                    │                    │                    │                   │
│                    ▼                    ▼                    ▼                   │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │    MongoDB Atlas     │  │      AWS KMS         │  │    AWS Secrets       │  │
│  │    (Primary DB)      │  │   (Encryption)       │  │    Manager           │  │
│  │                      │  │                      │  │                      │  │
│  │  • users             │  │  • CMK per env       │  │  • Google OAuth      │  │
│  │  • contacts          │  │  • DEK per user      │  │    client secret     │  │
│  │  • reminderRules     │  │  • Envelope encrypt  │  │  • MongoDB URI       │  │
│  │  • reminderInstances │  │                      │  │  • SES credentials   │  │
│  │  • calendarEvents    │  │                      │  │                      │  │
│  │  • interactions      │  │                      │  │                      │  │
│  │  • auditLogs         │  │                      │  │                      │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘  │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                           BACKGROUND JOBS (Lambda)                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │                        EventBridge Scheduler                            │    │
│  │                                                                         │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │    │
│  │  │ Daily Digest │ │ Calendar     │ │ Reminder     │ │ Event        │  │    │
│  │  │ Job (hourly) │ │ Sync (daily) │ │ Recalc       │ │ Cleanup      │  │    │
│  │  │              │ │              │ │ (hourly)     │ │ (daily)      │  │    │
│  │  │ 5:00-9:00 AM │ │ 3:00 AM UTC  │ │ *:15         │ │ 4:00 AM UTC  │  │    │
│  │  │ per timezone │ │              │ │              │ │              │  │    │
│  │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘  │    │
│  │         │                │                │                │          │    │
│  │         └────────────────┼────────────────┼────────────────┘          │    │
│  │                          │                │                           │    │
│  │                          ▼                ▼                           │    │
│  │  ┌───────────────────────────────────────────────────────────────┐   │    │
│  │  │                         SQS Queue                              │   │    │
│  │  │              (Fan-out for user processing)                     │   │    │
│  │  └───────────────────────────────────────────────────────────────┘   │    │
│  │                                                                       │    │
│  └───────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│                                       │                                          │
│                                       ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                            Amazon SES                                     │  │
│  │                      (Email Delivery Service)                             │  │
│  │                                                                           │  │
│  │   • Daily digest emails          • One-click action links                │  │
│  │   • Transactional emails         • Unsubscribe handling                  │  │
│  │   • Bounce/complaint handling    • Send rate limiting                    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                           EXTERNAL INTEGRATIONS                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │                        Google Cloud Platform                            │    │
│  │                                                                         │    │
│  │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │    │
│  │   │  Google OAuth   │  │  People API     │  │  Calendar API   │       │    │
│  │   │  (Sign in)      │  │  (Contacts)     │  │  (Events)       │       │    │
│  │   └─────────────────┘  └─────────────────┘  └─────────────────┘       │    │
│  │                                                                         │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              OBSERVABILITY                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │  CloudWatch    │  │  CloudWatch    │  │  X-Ray         │  │  CloudTrail  │  │
│  │  Logs          │  │  Metrics       │  │  Tracing       │  │  (KMS Audit) │  │
│  └────────────────┘  └────────────────┘  └────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### Frontend (React/Vite SPA)

**Responsibilities**:

- Mobile-first responsive UI
- OAuth flow initiation
- Local timezone handling
- Optimistic UI updates
- Form validation (duplicate at backend)

**Key Libraries**:

- React 18 with hooks
- React Router v6
- TanStack Query (data fetching/caching)
- Zustand (minimal state management)
- React Hook Form + Zod (forms/validation)
- date-fns-tz (timezone handling)

**No Business Logic** - All computation happens server-side.

---

### Backend (Express.js on ECS Fargate)

**Layer Architecture**:

```
Routes (HTTP) → Middleware (Auth/Validation) → Services (Business Logic) → Repos (Data Access) → MongoDB
```

| Layer      | Responsibility                               | Example                           |
| ---------- | -------------------------------------------- | --------------------------------- |
| Routes     | HTTP handling, request parsing               | `POST /api/contacts`              |
| Middleware | Auth verification, rate limiting, validation | `requireAuth()`, `validateBody()` |
| Services   | Business logic, orchestration                | `contactService.create()`         |
| Repos      | Data access, query building                  | `contactRepo.findByUserId()`      |

**Why Fargate over Lambda for API**:

- Consistent response times (no cold starts)
- WebSocket support if needed later
- Easier local development
- Cost-effective at moderate scale

---

### Background Jobs (Lambda + EventBridge)

| Job                 | Schedule                  | Description                               |
| ------------------- | ------------------------- | ----------------------------------------- |
| `digest-dispatcher` | Hourly (5-9 AM UTC bands) | Queries users by timezone, sends to SQS   |
| `digest-sender`     | SQS trigger               | Generates and sends one user's digest     |
| `calendar-sync`     | Daily 3:00 AM UTC         | Incremental calendar sync for all users   |
| `reminder-recalc`   | Hourly at :15             | Regenerates reminder instances from rules |
| `event-cleanup`     | Daily 4:00 AM UTC         | Purges expired calendar events            |

**Idempotency Strategy**:

- Each job writes idempotency key to `auditLogs` before processing
- Key format: `{jobType}:{userId}:{dateKey}` (e.g., `digest:user123:2026-01-02`)
- Check for existing key before processing, skip if found

---

### Database (MongoDB Atlas)

**Why MongoDB**:

- Flexible schema for evolving requirements
- Good fit for document-oriented data (contacts, reminders)
- Native JSON support for API responses
- Excellent Node.js driver
- Atlas provides managed backups, scaling

**Collections**:

1. `users` - Account and preferences
2. `contacts` - Contact records (encrypted PII)
3. `reminderRules` - Reminder definitions
4. `reminderInstances` - Materialized upcoming reminders
5. `calendarEvents` - Cached Google Calendar events
6. `interactions` - Contact interaction logs
7. `auditLogs` - System audit trail

---

### Security Services

**AWS KMS**:

- Customer Master Key (CMK) per environment
- Data Encryption Key (DEK) per user
- Envelope encryption for field-level encryption

**AWS Secrets Manager**:

- Google OAuth client secret
- MongoDB connection string
- SES credentials
- JWT signing secret

---

## Data Flow Diagrams

### OAuth Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │     │  Server  │     │  Google  │     │ MongoDB  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ Click "Sign in with Google"     │                │
     ├───────────────►│                │                │
     │                │                │                │
     │ Redirect to Google OAuth        │                │
     │◄───────────────┤                │                │
     │                │                │                │
     │ User consents ─────────────────►│                │
     │                │                │                │
     │ Redirect with auth code         │                │
     │◄───────────────────────────────┤                │
     │                │                │                │
     │ Send auth code │                │                │
     ├───────────────►│                │                │
     │                │                │                │
     │                │ Exchange code  │                │
     │                ├───────────────►│                │
     │                │                │                │
     │                │ Tokens + profile                │
     │                │◄───────────────┤                │
     │                │                │                │
     │                │ Encrypt refresh token           │
     │                │ Create/update user             │
     │                ├───────────────────────────────►│
     │                │                │                │
     │ Set session cookie              │                │
     │◄───────────────┤                │                │
     │                │                │                │
     │ Redirect to app                 │                │
     │◄───────────────┤                │                │
```

### Contact Import Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │     │  Server  │     │  Google  │     │ MongoDB  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ Request import │                │                │
     ├───────────────►│                │                │
     │                │                │                │
     │                │ Get sync token │                │
     │                ├───────────────────────────────►│
     │                │                │                │
     │                │ Decrypt refresh token          │
     │                │ Get access token               │
     │                ├───────────────►│                │
     │                │                │                │
     │                │ Fetch contacts (incremental)   │
     │                │◄───────────────┤                │
     │                │                │                │
     │                │ For each contact:              │
     │                │  - Hash email for dedup        │
     │                │  - Encrypt PII fields          │
     │                │  - Check for existing          │
     │                │  - Upsert with merge rules     │
     │                ├───────────────────────────────►│
     │                │                │                │
     │                │ Save new sync token            │
     │                ├───────────────────────────────►│
     │                │                │                │
     │ Import complete (count)         │                │
     │◄───────────────┤                │                │
```

### Daily Digest Flow

```
┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ EventBridge │     │ Dispatch │     │   SQS    │     │  Sender  │     │   SES    │
│ (Scheduler) │     │ Lambda   │     │  Queue   │     │  Lambda  │     │          │
└──────┬──────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
       │                 │                │                │                │
       │ Cron trigger    │                │                │                │
       │ (6:00 AM UTC)   │                │                │                │
       ├────────────────►│                │                │                │
       │                 │                │                │                │
       │                 │ Query users where:             │                │
       │                 │ - digestEnabled = true         │                │
       │                 │ - digestHour = 6               │                │
       │                 │ - timezone in UTC offset band  │                │
       │                 │                │                │                │
       │                 │ For each user:│                │                │
       │                 │ - Check idempotency key        │                │
       │                 │ - If not sent today:           │                │
       │                 │                │                │                │
       │                 │ Send to SQS   │                │                │
       │                 ├───────────────►│                │                │
       │                 │                │                │                │
       │                 │                │ Process message                │
       │                 │                ├───────────────►│                │
       │                 │                │                │                │
       │                 │                │ Query today queue:             │
       │                 │                │ - Due today    │                │
       │                 │                │ - Birthdays    │                │
       │                 │                │ - Calendar events              │
       │                 │                │ - Upcoming 7d  │                │
       │                 │                │                │                │
       │                 │                │ Render email   │                │
       │                 │                │ template       │                │
       │                 │                │                │                │
       │                 │                │ Send via SES  │                │
       │                 │                ├───────────────────────────────►│
       │                 │                │                │                │
       │                 │                │ Write audit log                │
       │                 │                │ (idempotency key)              │
```

---

## Deployment Architecture

### AWS Resources

```
VPC
├── Public Subnets (2 AZs)
│   └── ALB (Application Load Balancer)
│
├── Private Subnets (2 AZs)
│   ├── ECS Fargate (API Service)
│   └── Lambda (Jobs - VPC attached for MongoDB access)
│
└── Database Subnet Group
    └── MongoDB Atlas (VPC Peering)

CloudFront
├── S3 Origin (React SPA)
└── ALB Origin (API proxy /api/*)

Route 53
└── remoranotes.com → CloudFront
```

### Environment Strategy

| Environment  | Purpose                | Database      | Scale    |
| ------------ | ---------------------- | ------------- | -------- |
| `dev`        | Local development      | Local MongoDB | N/A      |
| `staging`    | Pre-production testing | Atlas M10     | 1 task   |
| `production` | Live users             | Atlas M30+    | 2+ tasks |

---

## Cost Estimates (Monthly, Low Scale)

| Service         | Estimate         | Notes                  |
| --------------- | ---------------- | ---------------------- |
| ECS Fargate     | $30-50           | 0.5 vCPU, 1GB, 2 tasks |
| Lambda          | $5-10            | Jobs only              |
| MongoDB Atlas   | $60              | M10 cluster            |
| CloudFront      | $5               | Low traffic            |
| S3              | $1               | SPA hosting            |
| SES             | $1-10            | $0.10/1000 emails      |
| KMS             | $5               | 1 CMK + requests       |
| Secrets Manager | $2               | 4 secrets              |
| **Total**       | **~$110-140/mo** |                        |

Cost scales primarily with user count → MongoDB and SES usage.
