# RemoraNotes - Daily Digest System

## Overview

The daily digest is the **primary notification channel** for RemoraNotes. It's a morning email that tells users:

1. Who to contact today (Today Queue)
2. Upcoming birthdays and events
3. Overdue reminders requiring attention
4. Quick action buttons (complete, snooze)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DIGEST PIPELINE                                      │
│                                                                              │
│  EventBridge          Dispatch           SQS              Sender            │
│  (Hourly Cron)        Lambda            Queue            Lambda             │
│       │                  │                │                 │               │
│       │ 6:00 AM UTC      │                │                 │               │
│       ├─────────────────►│                │                 │               │
│       │                  │                │                 │               │
│       │                  │ Query users:   │                 │               │
│       │                  │ - digestHour=6 │                 │               │
│       │                  │ - tz in band   │                 │               │
│       │                  │                │                 │               │
│       │                  │ For each user: │                 │               │
│       │                  │ - Check idemp  │                 │               │
│       │                  │ - Send msg ───────────────────►│                 │
│       │                  │                │                 │               │
│       │                  │                │  Process msg    │               │
│       │                  │                ├────────────────►│               │
│       │                  │                │                 │               │
│       │                  │                │                 │ Fetch queue   │
│       │                  │                │                 │ Render email  │
│       │                  │                │                 │ Send via SES  │
│       │                  │                │                 │               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Scheduling Strategy

### Timezone-Aware Dispatch

Users receive digests at their **local time** (default 8 AM).

**Implementation**: Run dispatcher hourly, filter users by timezone offset.

```javascript
// EventBridge runs this every hour
async function dispatchDigests() {
  const now = new Date();
  const currentUtcHour = now.getUTCHours();

  // For each timezone, find users whose local time matches their digestHour
  // Example: 6 AM UTC = 8 AM for UTC+2 users who want digest at 8

  const users = await User.find({
    "preferences.digestEnabled": true,
    deletedAt: null,
  });

  const todayKey = format(now, "yyyy-MM-dd");

  for (const user of users) {
    // Calculate user's local hour
    const userLocalTime = utcToZonedTime(now, user.preferences.timezone);
    const userLocalHour = userLocalTime.getHours();

    // Check if it's the user's digest hour
    if (userLocalHour !== user.preferences.digestHour) continue;

    // Check digest day preference (weekdays only, etc.)
    const userLocalDay = userLocalTime.getDay();
    if (!user.preferences.digestDays.includes(userLocalDay)) continue;

    // Idempotency check
    const idempotencyKey = `digest:${user._id}:${todayKey}`;
    const alreadySent = await AuditLog.findOne({ idempotencyKey });

    if (alreadySent) {
      console.log(`Digest already sent for user ${user._id} on ${todayKey}`);
      continue;
    }

    // Send to SQS for processing
    await sqs.sendMessage({
      QueueUrl: DIGEST_QUEUE_URL,
      MessageBody: JSON.stringify({
        userId: user._id.toString(),
        email: user.email, // Will be decrypted by sender
        timezone: user.preferences.timezone,
        idempotencyKey,
      }),
      MessageGroupId: user._id.toString(), // FIFO queue
      MessageDeduplicationId: idempotencyKey,
    });
  }
}
```

### Hourly Windows

| UTC Hour | Local Time (Example Timezones)      |
| -------- | ----------------------------------- |
| 05:00    | 8 AM UTC+3, 6 AM UTC+1              |
| 06:00    | 8 AM UTC+2, 7 AM UTC+1, 9 AM UTC+3  |
| 13:00    | 8 AM EST (UTC-5), 9 AM CST (UTC-6)  |
| 14:00    | 8 AM CST (UTC-6), 9 AM MST (UTC-7)  |
| 15:00    | 8 AM MST (UTC-7), 9 AM PST (UTC-8)  |
| 16:00    | 8 AM PST (UTC-8), 9 AM AKST (UTC-9) |

---

## Digest Content Generation

### Query: Today Queue

```javascript
async function getDigestTodayQueue(userId, timezone) {
  const userNow = utcToZonedTime(new Date(), timezone);
  const todayStart = startOfDay(userNow);
  const todayEnd = endOfDay(userNow);

  const queue = await ReminderInstance.find({
    userId,
    status: { $in: ["pending", "snoozed"] },
    $or: [{ dueDate: { $lte: todayEnd } }, { snoozedUntil: { $lte: userNow } }],
  })
    .populate("contactId", "name tags business.priority email phone")
    .sort({ score: -1 })
    .limit(15); // More than UI cap - show urgency

  return queue;
}
```

### Query: Birthdays & Anniversaries

```javascript
async function getUpcomingBirthdays(userId, timezone, daysAhead = 7) {
  const userNow = utcToZonedTime(new Date(), timezone);
  const today = { month: userNow.getMonth() + 1, day: userNow.getDate() };

  const dates = [];
  for (let i = 0; i <= daysAhead; i++) {
    const date = addDays(userNow, i);
    dates.push({
      month: date.getMonth() + 1,
      day: date.getDate(),
      daysFromNow: i,
    });
  }

  const contacts = await Contact.find({
    userId,
    isArchived: false,
    $or: dates.map((d) => ({
      "birthday.month": d.month,
      "birthday.day": d.day,
    })),
  });

  return contacts
    .map((c) => {
      const match = dates.find(
        (d) => d.month === c.birthday.month && d.day === c.birthday.day
      );
      return {
        contact: c,
        daysFromNow: match.daysFromNow,
        isToday: match.daysFromNow === 0,
      };
    })
    .sort((a, b) => a.daysFromNow - b.daysFromNow);
}
```

### Query: Calendar Events Today

```javascript
async function getTodayEvents(userId, timezone) {
  const userNow = utcToZonedTime(new Date(), timezone);
  const todayStr = format(userNow, "yyyy-MM-dd");

  const events = await CalendarEvent.find({
    userId,
    $or: [
      // All-day events
      { "start.date": todayStr },
      // Timed events
      {
        "start.dateTime": {
          $gte: startOfDay(userNow),
          $lt: endOfDay(userNow),
        },
      },
    ],
  }).populate("matchedContacts");

  return events;
}
```

### Query: Upcoming Reminders

```javascript
async function getUpcomingReminders(userId, timezone, daysAhead = 7) {
  const userNow = utcToZonedTime(new Date(), timezone);
  const futureDate = addDays(userNow, daysAhead);

  const reminders = await ReminderInstance.find({
    userId,
    status: "pending",
    dueDate: {
      $gt: endOfDay(userNow),
      $lte: endOfDay(futureDate),
    },
  })
    .populate("contactId", "name tags")
    .sort({ dueDate: 1 })
    .limit(10);

  return reminders;
}
```

---

## Email Template

### Structure

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your RemoraNotes Daily Digest</title>
    <style>
      /* Mobile-first styles */
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        text-align: center;
        padding: 20px 0;
        border-bottom: 2px solid #3b82f6;
      }
      .section {
        margin: 24px 0;
      }
      .section-title {
        font-size: 18px;
        font-weight: 600;
        color: #1e3a5f;
        margin-bottom: 12px;
      }
      .reminder-card {
        background: #f8fafc;
        border-radius: 8px;
        padding: 16px;
        margin: 8px 0;
      }
      .reminder-title {
        font-weight: 600;
        margin-bottom: 4px;
      }
      .reminder-meta {
        font-size: 14px;
        color: #64748b;
      }
      .priority-high {
        border-left: 4px solid #ef4444;
      }
      .priority-medium {
        border-left: 4px solid #f59e0b;
      }
      .priority-low {
        border-left: 4px solid #10b981;
      }
      .action-buttons {
        margin-top: 12px;
      }
      .action-btn {
        display: inline-block;
        padding: 8px 16px;
        margin-right: 8px;
        border-radius: 6px;
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
      }
      .btn-complete {
        background: #10b981;
        color: white;
      }
      .btn-snooze {
        background: #f59e0b;
        color: white;
      }
      .template-links {
        margin-top: 8px;
      }
      .template-link {
        font-size: 13px;
        color: #3b82f6;
        margin-right: 12px;
      }
      .birthday-item {
        display: flex;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #e2e8f0;
      }
      .birthday-emoji {
        font-size: 24px;
        margin-right: 12px;
      }
      .footer {
        text-align: center;
        padding: 20px;
        font-size: 12px;
        color: #94a3b8;
        border-top: 1px solid #e2e8f0;
        margin-top: 24px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>☀️ Good Morning!</h1>
      <p style="color: #64748B;">
        Your relationship reminders for {{dateFormatted}}
      </p>
    </div>

    {{#if todayQueue.length}}
    <div class="section">
      <h2 class="section-title">
        🎯 Today's Queue ({{todayQueue.length}} items)
      </h2>
      {{#each todayQueue}}
      <div class="reminder-card priority-{{priority}}">
        <div class="reminder-title">{{title}}</div>
        <div class="reminder-meta">
          {{#if contactName}}{{contactName}} • {{/if}} {{#if isOverdue}}⚠️
          {{daysOverdue}} days overdue{{else}}Due today{{/if}}
        </div>
        <div class="action-buttons">
          <a href="{{completeUrl}}" class="action-btn btn-complete">✓ Done</a>
          <a href="{{snoozeUrl}}" class="action-btn btn-snooze">⏰ Snooze</a>
        </div>
        {{#if contactPhone}}
        <div class="template-links">
          <a href="tel:{{contactPhone}}" class="template-link">📞 Call</a>
          <a href="sms:{{contactPhone}}" class="template-link">💬 Text</a>
          <a href="mailto:{{contactEmail}}" class="template-link">✉️ Email</a>
        </div>
        {{/if}}
      </div>
      {{/each}} {{#if overflowCount}}
      <p style="color: #64748B; font-size: 14px;">
        + {{overflowCount}} more reminders due today.
        <a href="{{appUrl}}/today">View all →</a>
      </p>
      {{/if}}
    </div>
    {{/if}} {{#if birthdays.length}}
    <div class="section">
      <h2 class="section-title">🎂 Birthdays This Week</h2>
      {{#each birthdays}}
      <div class="birthday-item">
        <span class="birthday-emoji">🎂</span>
        <div>
          <strong>{{contact.name.display}}</strong>
          {{#if isToday}}<span style="color: #EF4444;"> – TODAY!</span>
          {{else}} – {{daysFromNow}} days away{{/if}} {{#if
          contact.birthday.year}}
          <span style="color: #64748B;"> (turning {{age}})</span>
          {{/if}}
        </div>
      </div>
      {{/each}}
    </div>
    {{/if}} {{#if todayEvents.length}}
    <div class="section">
      <h2 class="section-title">📅 Today's Calendar</h2>
      {{#each todayEvents}}
      <div class="reminder-card">
        <div class="reminder-title">
          {{#if hasSummary}}{{summary}}{{else}}Calendar Event{{/if}}
        </div>
        <div class="reminder-meta">
          {{#if isAllDay}}All Day{{else}}{{startTime}} - {{endTime}}{{/if}}
          {{#if matchedContacts.length}} • With: {{#each
          matchedContacts}}{{name}}{{#unless @last}},
          {{/unless}}{{/each}}{{/if}}
        </div>
      </div>
      {{/each}}
    </div>
    {{/if}} {{#if upcoming.length}}
    <div class="section">
      <h2 class="section-title">📆 Coming Up (Next 7 Days)</h2>
      <ul style="padding-left: 20px;">
        {{#each upcoming}}
        <li style="margin: 8px 0;">
          <strong>{{dateShort}}</strong>: {{title}} {{#if
          contactName}}({{contactName}}){{/if}}
        </li>
        {{/each}}
      </ul>
    </div>
    {{/if}}

    <div class="footer">
      <p>
        <a href="{{preferencesUrl}}">Manage digest preferences</a> •
        <a href="{{unsubscribeUrl}}">Unsubscribe</a>
      </p>
      <p>RemoraNotes • Never forget to follow up</p>
    </div>
  </body>
</html>
```

---

## One-Click Actions

### URL Structure

Action URLs contain a signed token to verify authenticity:

```javascript
function generateActionUrl(action, instanceId, userId) {
  const payload = {
    action, // 'complete' | 'snooze'
    instanceId,
    userId,
    exp: addDays(new Date(), 7).getTime(), // Expires in 7 days
  };

  const token = jwt.sign(payload, ACTION_SECRET, { algorithm: "HS256" });

  return `${APP_URL}/api/digest-actions/${action}?token=${token}`;
}
```

### Action Handler

```javascript
// GET /api/digest-actions/complete?token=...
// GET /api/digest-actions/snooze?token=...
router.get("/digest-actions/:action", async (req, res) => {
  const { action } = req.params;
  const { token } = req.query;

  try {
    const payload = jwt.verify(token, ACTION_SECRET);

    if (payload.exp < Date.now()) {
      return res.redirect(`${APP_URL}/action-expired`);
    }

    switch (action) {
      case "complete":
        await completeReminder(payload.userId, payload.instanceId);
        return res.redirect(`${APP_URL}/action-success?action=completed`);

      case "snooze":
        await snoozeReminder(payload.userId, payload.instanceId, "tomorrow");
        return res.redirect(`${APP_URL}/action-success?action=snoozed`);

      default:
        return res.redirect(`${APP_URL}/action-invalid`);
    }
  } catch (error) {
    return res.redirect(`${APP_URL}/action-error`);
  }
});
```

### Template-Based Contact Actions

Generate contact action URLs (no authentication needed - uses device's apps):

```javascript
function generateContactLinks(contact, dek) {
  const phone = contact.phone ? decrypt(contact.phone, dek) : null;
  const email = contact.email ? decrypt(contact.email, dek) : null;

  return {
    call: phone ? `tel:${phone}` : null,
    sms: phone ? `sms:${phone}` : null,
    email: email ? `mailto:${email}` : null,
    whatsapp: phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : null,
  };
}
```

---

## Idempotency Guarantees

### Problem

- Lambda may retry on timeout
- SQS may deliver message twice
- Network issues could cause duplicate sends

### Solution

Triple-layer idempotency:

```javascript
async function sendDigest(message) {
  const { userId, idempotencyKey } = JSON.parse(message.body);

  // Layer 1: Check audit log (primary idempotency)
  const existingLog = await AuditLog.findOne({ idempotencyKey });
  if (existingLog) {
    console.log(`Digest already sent: ${idempotencyKey}`);
    return { skipped: true, reason: "already_sent" };
  }

  // Layer 2: Use atomic findOneAndUpdate with upsert
  const lock = await DigestLock.findOneAndUpdate(
    { idempotencyKey },
    {
      $setOnInsert: {
        idempotencyKey,
        startedAt: new Date(),
        status: "processing",
      },
    },
    { upsert: true, new: true }
  );

  // If lock already existed, another process is handling it
  if (
    lock.status !== "processing" ||
    lock.startedAt < subMinutes(new Date(), 5)
  ) {
    // Lock is stale or already processed
  }

  try {
    // Generate and send email
    const digestContent = await generateDigestContent(userId);
    const result = await sendEmail(digestContent);

    // Layer 3: Write completion to audit log
    await AuditLog.create({
      userId,
      category: "email",
      action: "DIGEST_SENT",
      idempotencyKey,
      metadata: {
        messageId: result.MessageId,
        queueItems: digestContent.todayQueue.length,
        birthdays: digestContent.birthdays.length,
      },
      timestamp: new Date(),
    });

    return { success: true, messageId: result.MessageId };
  } catch (error) {
    await AuditLog.create({
      userId,
      category: "email",
      action: "DIGEST_ERROR",
      idempotencyKey,
      metadata: { error: error.message },
      timestamp: new Date(),
    });

    throw error; // Let Lambda retry
  }
}
```

---

## SES Integration

### Configuration

```javascript
const ses = new SESClient({
  region: "us-east-1",
  credentials: fromEnv(), // Use IAM role
});

const EMAIL_CONFIG = {
  fromAddress: "digest@remoranotes.com",
  fromName: "RemoraNotes",
  configurationSet: "remoranotes-tracking", // For delivery tracking
};
```

### Send Email

```javascript
async function sendDigestEmail(to, subject, htmlBody, textBody) {
  const command = new SendEmailCommand({
    Source: `${EMAIL_CONFIG.fromName} <${EMAIL_CONFIG.fromAddress}>`,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: htmlBody, Charset: "UTF-8" },
        Text: { Data: textBody, Charset: "UTF-8" },
      },
    },
    ConfigurationSetName: EMAIL_CONFIG.configurationSet,
    Tags: [
      { Name: "email_type", Value: "digest" },
      { Name: "user_id", Value: userId.toString() },
    ],
  });

  return ses.send(command);
}
```

### Bounce/Complaint Handling

```javascript
// SNS webhook for SES notifications
router.post("/ses-notifications", async (req, res) => {
  const notification = JSON.parse(req.body.Message);

  switch (notification.notificationType) {
    case "Bounce":
      const bounceRecipient =
        notification.bounce.bouncedRecipients[0].emailAddress;

      // Disable digest for bounced email
      await User.updateOne(
        { emailHash: sha256(bounceRecipient.toLowerCase()) },
        { "preferences.digestEnabled": false }
      );

      await AuditLog.create({
        category: "email",
        action: "DIGEST_BOUNCED",
        metadata: {
          bounceType: notification.bounce.bounceType,
        },
      });
      break;

    case "Complaint":
      // User marked as spam - disable all emails
      const complaintRecipient =
        notification.complaint.complainedRecipients[0].emailAddress;

      await User.updateOne(
        { emailHash: sha256(complaintRecipient.toLowerCase()) },
        { "preferences.digestEnabled": false }
      );

      await AuditLog.create({
        category: "email",
        action: "DIGEST_COMPLAINT",
      });
      break;
  }

  res.status(200).send("OK");
});
```

---

## Unsubscribe Flow

### One-Click Unsubscribe (RFC 8058)

```javascript
// Email headers
const headers = {
  "List-Unsubscribe": `<${APP_URL}/api/unsubscribe?token=${token}>, <mailto:unsubscribe@remoranotes.com?subject=Unsubscribe>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
};

// Handler
router.post("/api/unsubscribe", async (req, res) => {
  const { token } = req.query;
  const payload = jwt.verify(token, UNSUBSCRIBE_SECRET);

  await User.updateOne(
    { _id: payload.userId },
    { "preferences.digestEnabled": false }
  );

  await AuditLog.create({
    userId: payload.userId,
    category: "email",
    action: "DIGEST_UNSUBSCRIBED",
    metadata: { method: "one_click" },
  });

  res.redirect(`${APP_URL}/unsubscribed`);
});
```

---

## Metrics and Monitoring

### CloudWatch Metrics

```javascript
const cloudwatch = new CloudWatchClient({ region: "us-east-1" });

async function publishDigestMetrics(stats) {
  await cloudwatch.send(
    new PutMetricDataCommand({
      Namespace: "RemoraNotes/Digest",
      MetricData: [
        {
          MetricName: "DigestsSent",
          Value: stats.sent,
          Unit: "Count",
        },
        {
          MetricName: "DigestsSkipped",
          Value: stats.skipped,
          Unit: "Count",
        },
        {
          MetricName: "DigestErrors",
          Value: stats.errors,
          Unit: "Count",
        },
        {
          MetricName: "AverageQueueSize",
          Value: stats.avgQueueSize,
          Unit: "Count",
        },
      ],
    })
  );
}
```

### Alerts

| Metric          | Threshold         | Action                   |
| --------------- | ----------------- | ------------------------ |
| DigestErrors    | > 10/hour         | Page on-call             |
| DigestsSent     | < 50% of expected | Warning                  |
| SES Bounce Rate | > 5%              | Review email list health |
| Complaint Rate  | > 0.1%            | Urgent review            |

---

## Configuration Options

```javascript
// User preferences (stored in user.preferences)
{
  digestEnabled: Boolean,          // Master toggle
  digestHour: Number,              // 0-23, local time
  digestDays: [Number],            // 0-6, Sunday=0
  upcomingWindow: Number,          // Days to show in "upcoming"
  digestFormat: 'full' | 'summary', // Future: summary version
}

// System configuration (environment variables)
{
  DIGEST_QUEUE_URL: String,        // SQS queue URL
  SES_FROM_ADDRESS: String,        // Verified sender
  SES_CONFIGURATION_SET: String,   // Tracking configuration
  DIGEST_ACTION_SECRET: String,    // JWT signing key
}
```
