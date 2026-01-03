# RemoraNotes - REST API Specification

## Base URL

```
Production: https://api.remoranotes.com/v1
Staging:    https://api-staging.remoranotes.com/v1
Development: http://localhost:3001/api/v1
```

## Authentication

All endpoints (except `/auth/*`) require authentication via:

- **Session Cookie**: `session` (httpOnly, secure, sameSite=strict)
- **Bearer Token**: `Authorization: Bearer <jwt>` (for API access)

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-01-02T08:00:00.000Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [{ "field": "email", "message": "Invalid email format" }]
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-01-02T08:00:00.000Z"
  }
}
```

### Error Codes

| Code               | HTTP Status | Description                       |
| ------------------ | ----------- | --------------------------------- |
| `UNAUTHORIZED`     | 401         | Missing or invalid authentication |
| `FORBIDDEN`        | 403         | Insufficient permissions          |
| `NOT_FOUND`        | 404         | Resource not found                |
| `VALIDATION_ERROR` | 400         | Invalid request body              |
| `RATE_LIMITED`     | 429         | Too many requests                 |
| `INTERNAL_ERROR`   | 500         | Server error                      |

---

## Authentication Endpoints

### `GET /auth/google`

Initiates Google OAuth flow.

**Response**: 302 Redirect to Google OAuth consent screen

---

### `GET /auth/google/callback`

Google OAuth callback handler.

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `code` | string | Authorization code from Google |
| `state` | string | CSRF token |

**Response**: 302 Redirect to:

- `/onboarding` (new user)
- `/dashboard` (existing user)
- `/auth/error?code=...` (on error)

---

### `POST /auth/logout`

Logs out user and clears session.

**Response**:

```json
{
  "success": true,
  "data": { "message": "Logged out successfully" }
}
```

---

### `GET /auth/me`

Gets current authenticated user.

**Response**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "john@example.com",
      "name": "John Doe",
      "picture": "https://...",
      "mode": "business",
      "plan": "free",
      "preferences": {
        "timezone": "America/New_York",
        "digestEnabled": true,
        "digestHour": 8
      },
      "onboarding": {
        "completedAt": null,
        "steps": {
          "modeSelected": false,
          "contactsImported": false,
          "firstReminderCreated": false
        }
      },
      "googleConnected": true,
      "createdAt": "2026-01-02T08:00:00.000Z"
    }
  }
}
```

---

## User Endpoints

### `PATCH /users/me`

Updates current user's profile and preferences.

**Request Body**:

```json
{
  "mode": "business",
  "preferences": {
    "timezone": "America/Los_Angeles",
    "digestEnabled": true,
    "digestHour": 9,
    "digestDays": [1, 2, 3, 4, 5],
    "upcomingWindow": 7,
    "privacyStoreEventTitles": false,
    "defaultFollowUpDays": {
      "client": 30,
      "lead": 14
    }
  }
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "user": { ... }
  }
}
```

---

### `POST /users/me/disconnect-google`

Disconnects Google account and deletes imported data.

**Response**:

```json
{
  "success": true,
  "data": {
    "message": "Google account disconnected",
    "deletedContacts": 145,
    "deletedEvents": 23
  }
}
```

---

### `DELETE /users/me`

Initiates account deletion (hard delete all data).

**Request Body**:

```json
{
  "confirmation": "DELETE MY ACCOUNT"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "message": "Account scheduled for deletion",
    "deletionDate": "2026-01-09T08:00:00.000Z"
  }
}
```

---

### `GET /users/me/export`

Exports all user data as JSON or CSV.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | `json` \| `csv` | `json` | Export format |

**Response** (JSON):

```json
{
  "success": true,
  "data": {
    "user": { ... },
    "contacts": [ ... ],
    "reminders": [ ... ],
    "interactions": [ ... ]
  }
}
```

**Response** (CSV): Returns zip file with multiple CSVs.

---

## Contact Endpoints

### `GET /contacts`

Lists all contacts for the authenticated user.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page (max 100) |
| `search` | string | - | Search name/email |
| `tags` | string | - | Comma-separated tags |
| `sort` | string | `name` | Sort field |
| `order` | `asc` \| `desc` | `asc` | Sort order |
| `archived` | boolean | `false` | Include archived |

**Response**:

```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": "contact_123",
        "name": {
          "first": "John",
          "last": "Smith",
          "display": "John Smith"
        },
        "email": "john@acme.com",
        "phone": "+1-555-123-4567",
        "tags": ["client", "high-value"],
        "business": {
          "company": "ACME Corp",
          "title": "CEO",
          "priority": "high",
          "importance": 9
        },
        "birthday": {
          "month": 3,
          "day": 15,
          "year": 1985
        },
        "lastContactedAt": "2026-01-01T10:30:00.000Z",
        "interactionCount": 12,
        "source": "google",
        "hasGoogleLink": true,
        "createdAt": "2025-06-15T08:00:00.000Z",
        "updatedAt": "2026-01-01T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 145,
      "totalPages": 3
    }
  }
}
```

---

### `POST /contacts`

Creates a new contact.

**Request Body**:

```json
{
  "name": {
    "first": "Jane",
    "last": "Doe"
  },
  "email": "jane@example.com",
  "phone": "+1-555-987-6543",
  "tags": ["lead"],
  "business": {
    "company": "StartupXYZ",
    "title": "CTO",
    "priority": "high",
    "importance": 8
  },
  "birthday": {
    "month": 7,
    "day": 4,
    "year": 1990
  },
  "notes": "Met at TechConf 2025"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "contact": {
      "id": "contact_456",
      ...
    }
  }
}
```

**Validation Rules**:

- `name.first` or `name.display` required
- `email` must be valid email format
- `phone` must be E.164 format
- `tags` must be from allowed list
- `business.importance` must be 1-10
- `birthday.month` must be 1-12
- `birthday.day` must be 1-31 (validated for month)

---

### `GET /contacts/:id`

Gets a single contact.

**Response**:

```json
{
  "success": true,
  "data": {
    "contact": { ... },
    "recentInteractions": [
      {
        "id": "int_123",
        "type": "call",
        "occurredAt": "2026-01-01T10:30:00.000Z",
        "notes": "Discussed Q1 goals"
      }
    ],
    "upcomingReminders": [
      {
        "id": "rem_456",
        "type": "follow_up",
        "dueDate": "2026-01-15T00:00:00.000Z",
        "title": "Follow up on proposal"
      }
    ]
  }
}
```

---

### `PATCH /contacts/:id`

Updates a contact.

**Request Body** (partial update):

```json
{
  "business": {
    "priority": "medium"
  },
  "notes": "Updated notes"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "contact": { ... }
  }
}
```

---

### `DELETE /contacts/:id`

Deletes a contact.

**Response**:

```json
{
  "success": true,
  "data": {
    "message": "Contact deleted"
  }
}
```

---

### `POST /contacts/:id/archive`

Archives a contact (soft delete).

**Response**:

```json
{
  "success": true,
  "data": {
    "contact": { "isArchived": true, ... }
  }
}
```

---

### `POST /contacts/:id/unarchive`

Unarchives a contact.

---

### `POST /contacts/import`

Imports contacts from Google.

**Request Body** (optional):

```json
{
  "fullSync": false
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "imported": 45,
    "updated": 12,
    "skipped": 3,
    "errors": 0,
    "syncToken": "stored"
  }
}
```

**Rate Limit**: 1 request per 5 minutes

---

## Interaction Endpoints

### `GET /contacts/:contactId/interactions`

Lists interactions for a contact.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Response**:

```json
{
  "success": true,
  "data": {
    "interactions": [
      {
        "id": "int_123",
        "type": "call",
        "occurredAt": "2026-01-01T10:30:00.000Z",
        "notes": "Discussed Q1 goals",
        "createdAt": "2026-01-01T10:35:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

### `POST /contacts/:contactId/interactions`

Logs a new interaction.

**Request Body**:

```json
{
  "type": "call",
  "occurredAt": "2026-01-02T14:00:00.000Z",
  "notes": "Followed up on proposal, they're interested"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "interaction": { ... },
    "contact": {
      "lastContactedAt": "2026-01-02T14:00:00.000Z"
    },
    "recalculatedReminders": true
  }
}
```

---

## Reminder Endpoints

### `GET /reminders/today`

Gets the Today Queue.

**Response**:

```json
{
  "success": true,
  "data": {
    "queue": [
      {
        "id": "rem_123",
        "type": "follow_up",
        "title": "Follow up with John Smith",
        "dueDate": "2026-01-02T00:00:00.000Z",
        "priority": "high",
        "score": 135,
        "isOverdue": false,
        "contact": {
          "id": "contact_123",
          "name": "John Smith",
          "email": "john@acme.com",
          "phone": "+1-555-123-4567",
          "tags": ["client"]
        },
        "actions": {
          "call": "tel:+15551234567",
          "sms": "sms:+15551234567",
          "email": "mailto:john@acme.com",
          "whatsapp": "https://wa.me/15551234567"
        }
      }
    ],
    "overflowCount": 5,
    "totalDueToday": 15
  }
}
```

---

### `GET /reminders`

Lists all reminders (upcoming instances).

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | `pending` | Filter by status |
| `type` | string | - | Filter by type |
| `contactId` | string | - | Filter by contact |
| `from` | date | today | Start date |
| `to` | date | +30 days | End date |

**Response**:

```json
{
  "success": true,
  "data": {
    "reminders": [ ... ],
    "pagination": { ... }
  }
}
```

---

### `GET /reminders/rules`

Lists reminder rules (patterns).

**Response**:

```json
{
  "success": true,
  "data": {
    "rules": [
      {
        "id": "rule_123",
        "type": "follow_up",
        "contactId": "contact_123",
        "interval": {
          "days": 30,
          "anchor": "last_contact"
        },
        "priority": "high",
        "isActive": true,
        "isAutoGenerated": false
      }
    ]
  }
}
```

---

### `POST /reminders/rules`

Creates a new reminder rule.

**Request Body**:

```json
{
  "type": "follow_up",
  "contactId": "contact_123",
  "interval": {
    "days": 30,
    "anchor": "last_contact"
  },
  "priority": "high",
  "notifyDaysBefore": [0]
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "rule": { ... },
    "generatedInstances": 1
  }
}
```

---

### `PATCH /reminders/rules/:id`

Updates a reminder rule.

---

### `DELETE /reminders/rules/:id`

Deletes a reminder rule and its pending instances.

---

### `POST /reminders/:id/complete`

Marks a reminder as complete.

**Request Body**:

```json
{
  "note": "Had a great call, they're signing next week"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "reminder": { "status": "completed", ... },
    "interaction": { "id": "int_456", ... }
  }
}
```

---

### `POST /reminders/:id/snooze`

Snoozes a reminder.

**Request Body**:

```json
{
  "duration": "tomorrow"
}
```

**Allowed Durations**: `1h`, `3h`, `tomorrow`, `3d`, `1w`, or ISO date string.

**Response**:

```json
{
  "success": true,
  "data": {
    "reminder": {
      "status": "snoozed",
      "snoozedUntil": "2026-01-03T09:00:00.000Z",
      ...
    }
  }
}
```

---

### `POST /reminders/:id/skip`

Skips a reminder.

---

### `POST /reminders/:id/reschedule`

Reschedules a reminder to a new date.

**Request Body**:

```json
{
  "newDate": "2026-01-15T00:00:00.000Z"
}
```

---

## Calendar Endpoints

### `GET /calendar/events`

Lists cached calendar events.

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | date | today | Start date |
| `to` | date | +30 days | End date |

**Response**:

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "evt_123",
        "start": {
          "dateTime": "2026-01-05T09:00:00.000Z",
          "timeZone": "America/New_York"
        },
        "end": {
          "dateTime": "2026-01-05T10:00:00.000Z",
          "timeZone": "America/New_York"
        },
        "isAllDay": false,
        "hasSummary": true,
        "summary": "Meeting with John",
        "matchedContacts": [{ "id": "contact_123", "name": "John Smith" }]
      }
    ],
    "syncedAt": "2026-01-02T03:00:00.000Z"
  }
}
```

---

### `POST /calendar/sync`

Triggers calendar sync (manual).

**Response**:

```json
{
  "success": true,
  "data": {
    "synced": 45,
    "deleted": 3,
    "syncedAt": "2026-01-02T14:00:00.000Z"
  }
}
```

**Rate Limit**: 2 requests per hour

---

## Onboarding Endpoints

### `POST /onboarding/mode`

Sets user mode during onboarding.

**Request Body**:

```json
{
  "mode": "business"
}
```

---

### `POST /onboarding/complete`

Marks onboarding as complete.

**Response**:

```json
{
  "success": true,
  "data": {
    "onboarding": {
      "completedAt": "2026-01-02T08:15:00.000Z",
      "steps": {
        "modeSelected": true,
        "contactsImported": true,
        "firstReminderCreated": true,
        "digestConfigured": true
      }
    }
  }
}
```

---

## Digest Action Endpoints

### `GET /digest-actions/complete`

One-click complete from email (redirects to app).

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `token` | string | Signed JWT with action details |

---

### `GET /digest-actions/snooze`

One-click snooze from email (redirects to app).

---

### `POST /unsubscribe`

One-click unsubscribe (RFC 8058).

---

## Plan & Feature Endpoints

### `GET /plan`

Gets current plan details and limits.

**Response**:

```json
{
  "success": true,
  "data": {
    "plan": "free",
    "limits": {
      "contacts": { "max": 50, "used": 23 },
      "reminders": { "max": 100, "used": 45 },
      "todayQueueCap": 10,
      "calendarWindowDays": 30,
      "contactImportPerSync": 100
    },
    "features": {
      "csvExport": false,
      "weeklyDigest": false
    }
  }
}
```

---

## Rate Limits

| Endpoint            | Limit | Window |
| ------------------- | ----- | ------ |
| `/contacts/import`  | 1     | 5 min  |
| `/calendar/sync`    | 2     | 1 hour |
| `/auth/*`           | 10    | 1 min  |
| All other endpoints | 100   | 1 min  |

Rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704189600
```

---

## Pagination

Standard pagination for list endpoints:

**Request**:

```
GET /contacts?page=2&limit=50
```

**Response**:

```json
{
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 145,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

## Webhooks (Future)

Reserved for future integration:

- `POST /webhooks` - Register webhook
- `GET /webhooks` - List webhooks
- `DELETE /webhooks/:id` - Remove webhook

Webhook events:

- `reminder.due`
- `reminder.completed`
- `contact.created`
- `contact.updated`
