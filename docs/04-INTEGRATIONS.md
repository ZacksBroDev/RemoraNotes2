# RemoraNotes - Google Integrations Specification

## Overview

RemoraNotes integrates with three Google APIs:

1. **OAuth 2.0** - Authentication and authorization
2. **People API** - Contact import and sync
3. **Calendar API** - Event import and sync

All integrations follow security-first principles: least-privilege scopes, encrypted token storage, and minimal data retention.

---

## Google OAuth 2.0 Integration

### Scopes Requested

```javascript
const GOOGLE_SCOPES = [
  "openid", // Required for OpenID Connect
  "email", // User's email address
  "profile", // User's basic profile info
  "https://www.googleapis.com/auth/contacts.readonly", // Read contacts
  "https://www.googleapis.com/auth/calendar.readonly", // Read calendar
  "https://www.googleapis.com/auth/calendar.events.readonly", // Read events
];
```

**Scope Justification**:
| Scope | Purpose | Why Read-Only |
|-------|---------|---------------|
| openid, email, profile | User identity | Core authentication |
| contacts.readonly | Import contacts | We never modify Google contacts |
| calendar.readonly | List calendars | Find primary calendar |
| calendar.events.readonly | Import events | We never create/modify events |

### OAuth Flow Sequence

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           OAuth 2.0 Flow                                      │
└──────────────────────────────────────────────────────────────────────────────┘

1. User clicks "Sign in with Google" on frontend

   Frontend redirects to:
   GET /api/auth/google

2. Server generates OAuth URL with PKCE (if supported) and state parameter

   Response: 302 Redirect to:
   https://accounts.google.com/o/oauth2/v2/auth?
     client_id={CLIENT_ID}&
     redirect_uri={CALLBACK_URL}&
     response_type=code&
     scope={SCOPES}&
     state={CSRF_TOKEN}&
     access_type=offline&
     prompt=consent

3. User authenticates with Google and consents to scopes

4. Google redirects back with authorization code

   GET /api/auth/google/callback?code={AUTH_CODE}&state={CSRF_TOKEN}

5. Server validates state, exchanges code for tokens

   POST https://oauth2.googleapis.com/token
   Body: {
     client_id, client_secret, code, redirect_uri, grant_type: 'authorization_code'
   }

   Response: {
     access_token: "ya29...",
     expires_in: 3599,
     refresh_token: "1//...",
     scope: "...",
     token_type: "Bearer",
     id_token: "eyJ..."
   }

6. Server fetches user profile from ID token or userinfo endpoint

   GET https://www.googleapis.com/oauth2/v3/userinfo
   Headers: { Authorization: "Bearer {access_token}" }

7. Server creates/updates user record:
   - Generate DEK if new user (via KMS)
   - Encrypt refresh token with user's DEK
   - Store encrypted tokens and profile

8. Server creates session (JWT in httpOnly cookie)

   Set-Cookie: session={JWT}; HttpOnly; Secure; SameSite=Strict; Path=/

9. Redirect to frontend (onboarding or dashboard)
```

### Token Storage and Refresh

```javascript
// Token encryption on storage
async function storeRefreshToken(userId, refreshToken) {
  const user = await User.findById(userId);
  const dek = await kms.decrypt(user.encryptedDEK);

  const encryptedRefreshToken = encrypt(refreshToken, dek, {
    algorithm: "aes-256-gcm",
    encoding: "base64",
  });

  await User.updateOne(
    { _id: userId },
    {
      encryptedRefreshToken,
      tokenExpiresAt: addDays(new Date(), 180), // Google refresh tokens last ~6 months
    }
  );
}

// Token decryption and refresh
async function getValidAccessToken(userId) {
  const user = await User.findById(userId);
  const dek = await kms.decrypt(user.encryptedDEK);
  const refreshToken = decrypt(user.encryptedRefreshToken, dek);

  const { access_token, expires_in } = await googleOAuth.refreshAccessToken(
    refreshToken
  );

  // Access token is NEVER stored - used immediately and discarded
  return access_token;
}
```

### Token Rotation

Google may return a new refresh token during token refresh. Always store the latest:

```javascript
async function refreshAccessToken(refreshToken) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  // Google may issue a new refresh token
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await storeRefreshToken(userId, data.refresh_token);
  }

  return data;
}
```

### Token Revocation (Disconnect Google)

```javascript
async function disconnectGoogle(userId) {
  const user = await User.findById(userId);

  // 1. Revoke token with Google
  const dek = await kms.decrypt(user.encryptedDEK);
  const refreshToken = decrypt(user.encryptedRefreshToken, dek);

  await fetch(`https://oauth2.googleapis.com/revoke?token=${refreshToken}`, {
    method: "POST",
  });

  // 2. Delete imported data
  await Contact.deleteMany({ userId, source: "google" });
  await CalendarEvent.deleteMany({ userId });

  // 3. Clear token and sync state
  await User.updateOne(
    { _id: userId },
    {
      $unset: {
        encryptedRefreshToken: 1,
        "googleSync.contactsSyncToken": 1,
        "googleSync.calendarSyncToken": 1,
      },
      $set: {
        "googleSync.contactsLastSyncedAt": null,
        "googleSync.calendarLastSyncedAt": null,
      },
    }
  );

  // 4. Audit log
  await auditLog({
    userId,
    category: "account",
    action: "GOOGLE_DISCONNECTED",
  });
}
```

---

## Google People API Integration

### Overview

The People API is used to import contacts. We use:

- **Connections** endpoint for personal contacts
- **Incremental sync** via syncToken to avoid re-importing everything

### Import Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Contact Import Flow                                    │
└──────────────────────────────────────────────────────────────────────────────┘

1. User clicks "Import Google Contacts" in app

2. Frontend calls:
   POST /api/contacts/import

3. Server checks rate limits:
   - Max 1 import per 5 minutes per user
   - Max 100 contacts per import (FREE) / 500 (PRO)

4. Server fetches contacts from Google:

   First sync (no syncToken):
   GET https://people.googleapis.com/v1/people/me/connections?
     personFields=names,emailAddresses,phoneNumbers,birthdays&
     pageSize=100&
     requestSyncToken=true

   Incremental sync (has syncToken):
   GET https://people.googleapis.com/v1/people/me/connections?
     personFields=names,emailAddresses,phoneNumbers,birthdays&
     syncToken={SYNC_TOKEN}&
     requestSyncToken=true

5. For each contact in response:

   a. Extract relevant fields:
      - name: names[0].displayName
      - email: emailAddresses[0].value (primary)
      - phone: phoneNumbers[0].value (primary)
      - birthday: birthdays[0].date { year, month, day }

   b. Hash email/phone for deduplication:
      emailHash = sha256(email.toLowerCase())

   c. Check for existing contact:
      existing = Contact.findOne({ userId, emailHash })

   d. Apply deduplication rules (see below)

   e. Encrypt PII before storage:
      contact.email = encrypt(email, dek)
      contact.phone = encrypt(phone, dek)

6. Store new syncToken:
   User.updateOne({
     'googleSync.contactsSyncToken': response.nextSyncToken,
     'googleSync.contactsLastSyncedAt': new Date()
   })

7. Return import summary:
   { imported: 45, updated: 12, skipped: 3 }
```

### Deduplication Rules

```javascript
const DEDUPE_RULES = {
  // Rule 1: Email match - same person
  emailMatch: {
    condition: (existing, incoming) =>
      existing.emailHash === incoming.emailHash,
    action: "merge",
  },

  // Rule 2: Phone match (secondary)
  phoneMatch: {
    condition: (existing, incoming) =>
      existing.phoneHash && existing.phoneHash === incoming.phoneHash,
    action: "merge",
  },

  // Rule 3: Google resource name match - same contact
  googleResourceMatch: {
    condition: (existing, incoming) =>
      existing.googleResourceName === incoming.googleResourceName,
    action: "update",
  },
};

async function deduplicateContact(userId, incomingContact, dek) {
  const emailHash = sha256(incomingContact.email?.toLowerCase());

  // Check for existing by email
  const existing = await Contact.findOne({ userId, emailHash });

  if (!existing) {
    // New contact - create
    return createContact(userId, incomingContact, dek);
  }

  if (existing.source === "manual") {
    // Manual contact exists - link to Google but preserve manual data
    return Contact.updateOne(
      { _id: existing._id },
      {
        $set: {
          hasGoogleLink: true,
          googleResourceName: incomingContact.resourceName,
          lastSyncedAt: new Date(),
          // Only update fields user hasn't overridden
          ...(existing.localOverrides?.name
            ? {}
            : { "name.display": incomingContact.name }),
          // Add birthday if missing
          ...(!existing.birthday && incomingContact.birthday
            ? { birthday: incomingContact.birthday }
            : {}),
        },
      }
    );
  }

  if (existing.source === "google") {
    // Google contact exists - update with latest, respect local overrides
    return Contact.updateOne(
      { _id: existing._id },
      {
        $set: {
          lastSyncedAt: new Date(),
          // Only update fields without local overrides
          ...(existing.localOverrides?.name
            ? {}
            : { "name.display": incomingContact.name }),
          ...(existing.localOverrides?.phone
            ? {}
            : {
                phone: encrypt(incomingContact.phone, dek),
                phoneHash: sha256(incomingContact.phone),
              }),
          // Always update birthday from Google (no override support)
          birthday: incomingContact.birthday,
        },
      }
    );
  }
}
```

### Local Override Mechanism

When user edits an imported contact:

```javascript
async function updateContact(userId, contactId, updates) {
  const contact = await Contact.findOne({ _id: contactId, userId });

  if (contact.source === "google") {
    // Track which fields user has explicitly overridden
    const localOverrides = { ...contact.localOverrides };

    if (updates.name) localOverrides.name = updates.name;
    if (updates.phone) localOverrides.phone = updates.phone;
    if (updates.notes) localOverrides.notes = updates.notes;

    await Contact.updateOne(
      { _id: contactId },
      {
        $set: {
          ...updates,
          localOverrides,
        },
      }
    );
  } else {
    // Manual contact - direct update
    await Contact.updateOne({ _id: contactId }, { $set: updates });
  }
}
```

### Handling Deleted Google Contacts

Incremental sync includes deleted contacts with `metadata.deleted: true`:

```javascript
for (const person of connections) {
  if (person.metadata?.deleted) {
    // Google contact was deleted
    // Don't auto-delete - user may have added notes
    await Contact.updateOne(
      { userId, googleResourceName: person.resourceName },
      {
        $set: {
          hasGoogleLink: false,
          source: "manual", // Convert to manual contact
          googleResourceName: null,
        },
      }
    );
    continue;
  }

  // Normal processing...
}
```

### Error Handling

```javascript
const GOOGLE_API_ERRORS = {
  401: {
    action: "REFRESH_TOKEN",
    message: "Access token expired, refreshing...",
  },
  403: {
    action: "SCOPE_ERROR",
    message: "Missing required permissions. Please reconnect Google.",
  },
  410: {
    action: "FULL_SYNC",
    message: "Sync token expired. Performing full sync.",
  },
  429: {
    action: "RATE_LIMIT",
    message: "Too many requests. Please try again later.",
    retryAfter: 60,
  },
};

async function handleGoogleApiError(error, userId) {
  const errorConfig = GOOGLE_API_ERRORS[error.status];

  switch (errorConfig?.action) {
    case "REFRESH_TOKEN":
      // Attempt token refresh and retry
      await refreshAccessToken(userId);
      throw new RetryableError();

    case "FULL_SYNC":
      // Clear sync token and do full sync
      await User.updateOne(
        { _id: userId },
        { $unset: { "googleSync.contactsSyncToken": 1 } }
      );
      throw new RetryableError();

    case "RATE_LIMIT":
      await auditLog({ userId, action: "SYNC_RATE_LIMITED" });
      throw new RateLimitError(errorConfig.retryAfter);

    default:
      throw error;
  }
}
```

---

## Google Calendar API Integration

### Overview

The Calendar API imports upcoming events to:

- Show in daily digest
- Link events to contacts (via attendees)
- Help users prepare for meetings

### Privacy-First Design

**Default**: Do NOT store event summaries/titles. Store only timing and attendee emails.

**Optional**: User can enable `privacyStoreEventTitles` in preferences to store summaries.

### Sync Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Calendar Sync Flow                                     │
└──────────────────────────────────────────────────────────────────────────────┘

1. Background job triggers daily at 3:00 AM UTC (or user-initiated)

2. For each user with calendar sync enabled:

3. Determine sync window:
   - FREE tier: 30 days
   - PRO tier: 90 days

   startDate = now
   endDate = now + windowDays

4. Fetch calendar list:
   GET https://www.googleapis.com/calendar/v3/users/me/calendarList?
     minAccessRole=reader

   Filter to primary calendar (or user-selected calendars in future)

5. Fetch events with incremental sync:

   First sync (no syncToken):
   GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events?
     timeMin={startDate}&
     timeMax={endDate}&
     singleEvents=true&
     orderBy=startTime&
     maxResults=250

   Incremental sync (has syncToken):
   GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events?
     syncToken={SYNC_TOKEN}

6. Process each event:

   a. Check if event is within window (incremental may return old events)

   b. Handle deleted events (status: 'cancelled')

   c. Upsert event record:
      - Key: { userId, calendarId, eventId }
      - Calculate expiresAt based on end date + buffer

7. Extract attendee emails for contact matching:

   For each attendee:
     emailHash = sha256(attendee.email.toLowerCase())

     // Find matching contact
     contact = Contact.findOne({ userId, emailHash })

     if (contact) {
       // Store event-contact link for digest
       event.matchedContactIds.push(contact._id)
     }

8. Store new syncToken:
   User.updateOne({
     'googleSync.calendarSyncToken': response.nextSyncToken,
     'googleSync.calendarLastSyncedAt': new Date()
   })

9. Cleanup:
   - Delete events where end date < now (TTL handles this automatically)
   - Delete events outside user's window
```

### Event Schema Mapping

```javascript
function mapGoogleEventToSchema(googleEvent, userId, storeTitle) {
  return {
    userId,
    calendarId: googleEvent.organizer?.email || "primary",
    eventId: googleEvent.id,

    start: {
      dateTime: googleEvent.start.dateTime
        ? new Date(googleEvent.start.dateTime)
        : null,
      date: googleEvent.start.date || null,
      timeZone: googleEvent.start.timeZone,
    },

    end: {
      dateTime: googleEvent.end.dateTime
        ? new Date(googleEvent.end.dateTime)
        : null,
      date: googleEvent.end.date || null,
      timeZone: googleEvent.end.timeZone,
    },

    isAllDay: !googleEvent.start.dateTime,

    // Privacy-first: only store if user opted in
    summary: storeTitle ? encrypt(googleEvent.summary, dek) : null,
    hasSummary: storeTitle && !!googleEvent.summary,

    attendees: (googleEvent.attendees || [])
      .filter((a) => a.email)
      .map((a) => ({
        email: encrypt(a.email, dek),
        emailHash: sha256(a.email.toLowerCase()),
      })),

    syncedAt: new Date(),
    googleUpdatedAt: new Date(googleEvent.updated),
    etag: googleEvent.etag,

    // TTL: expire 1 day after event ends
    expiresAt: addDays(
      googleEvent.end.dateTime
        ? new Date(googleEvent.end.dateTime)
        : parseISO(googleEvent.end.date),
      1
    ),
  };
}
```

### Handling Recurring Events

Google's `singleEvents=true` parameter expands recurring events into individual instances. This is preferred because:

1. Simpler storage and querying
2. Each instance has its own eventId
3. No need to calculate recurrence locally
4. Incremental sync handles instance updates

### Contact-Event Matching

For the daily digest, match calendar events to contacts:

```javascript
async function getEventsWithContacts(userId, date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const events = await CalendarEvent.find({
    userId,
    $or: [
      { "start.dateTime": { $gte: dayStart, $lt: dayEnd } },
      { "start.date": format(date, "yyyy-MM-dd") },
    ],
  });

  // Enrich with contact info
  const enrichedEvents = await Promise.all(
    events.map(async (event) => {
      const contacts = await Contact.find({
        userId,
        emailHash: { $in: event.attendees.map((a) => a.emailHash) },
      });

      return {
        ...event.toObject(),
        matchedContacts: contacts.map((c) => ({
          _id: c._id,
          name: c.name.display,
          tags: c.tags,
        })),
      };
    })
  );

  return enrichedEvents;
}
```

---

## Rate Limiting

### Internal Rate Limits

```javascript
const RATE_LIMITS = {
  contactImport: {
    window: 5 * 60 * 1000, // 5 minutes
    max: 1, // 1 import per window
  },
  calendarSync: {
    window: 60 * 60 * 1000, // 1 hour
    max: 2, // 2 syncs per hour (manual)
  },
};

// Implemented via Redis or in-memory store
async function checkRateLimit(userId, operation) {
  const key = `ratelimit:${operation}:${userId}`;
  const config = RATE_LIMITS[operation];

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, config.window / 1000);
  }

  if (count > config.max) {
    const ttl = await redis.ttl(key);
    throw new RateLimitError(
      `Too many ${operation} requests. Retry in ${ttl}s`
    );
  }
}
```

### Google API Quotas

| API          | Quota                  | Our Usage          |
| ------------ | ---------------------- | ------------------ |
| People API   | 90,000 requests/day    | ~100 per user sync |
| Calendar API | 1,000,000 requests/day | ~50 per user sync  |

At 1000 users with daily sync: ~150,000 requests/day - well within limits.

---

## Error Recovery

### Sync Token Expiration

Google sync tokens expire after ~7 days of inactivity:

```javascript
async function handleCalendarSync(userId) {
  try {
    const user = await User.findById(userId);
    const accessToken = await getValidAccessToken(userId);

    if (user.googleSync.calendarSyncToken) {
      // Try incremental sync
      const events = await fetchEventsWithSyncToken(
        accessToken,
        user.googleSync.calendarSyncToken
      );
      return processEvents(userId, events);
    }
  } catch (error) {
    if (error.status === 410) {
      // Sync token expired - full sync
      await User.updateOne(
        { _id: userId },
        { $unset: { "googleSync.calendarSyncToken": 1 } }
      );

      // Perform full sync
      const events = await fetchEventsFullSync(accessToken, user.plan);
      return processEvents(userId, events);
    }
    throw error;
  }
}
```

### Network Failures

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new ApiError(response.status);
      return response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await sleep(delay);
    }
  }
}
```

---

## Security Considerations

1. **Access tokens never stored** - Refreshed on demand, used immediately, discarded
2. **Refresh tokens encrypted** - AES-256-GCM with per-user DEK
3. **Minimal scopes** - Read-only for all Google APIs
4. **PII encryption** - All emails, phones, event titles encrypted at rest
5. **Audit logging** - Every sync operation logged (without PII)
6. **Rate limiting** - Prevent abuse of import/sync endpoints
7. **Token revocation** - Disconnect flow revokes tokens with Google and purges data
