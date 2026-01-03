# RemoraNotes - Security Specification

## Security Overview

RemoraNotes handles sensitive personal information (contacts, calendars, relationship data). Security is a first-class concern, not an afterthought.

### Security Principles

1. **Least Privilege**: Request minimal Google scopes; never store more than needed
2. **Defense in Depth**: Multiple layers of protection
3. **Encrypt Everything Sensitive**: Field-level encryption for PII
4. **Zero Trust**: Verify user on every request
5. **Audit Everything**: Comprehensive logging without PII
6. **Fail Secure**: Errors should not expose data

---

## Threat Model

### Assets to Protect

| Asset                 | Sensitivity | Storage              |
| --------------------- | ----------- | -------------------- |
| User emails           | High        | Encrypted (KMS)      |
| Contact emails/phones | High        | Encrypted (KMS)      |
| OAuth refresh tokens  | Critical    | Encrypted (KMS)      |
| Calendar event titles | Medium      | Encrypted (optional) |
| Conversation notes    | Medium      | Encrypted (KMS)      |
| Reminder patterns     | Low         | Plaintext            |
| User preferences      | Low         | Plaintext            |

### Threat Actors

| Actor                  | Capability                        | Motivation            |
| ---------------------- | --------------------------------- | --------------------- |
| External Attacker      | Web exploits, credential stuffing | Data theft, ransom    |
| Compromised Admin      | Direct DB access                  | Data exfiltration     |
| Malicious Insider      | Code access                       | Backdoors, data theft |
| Compromised Dependency | Supply chain attack               | Mass compromise       |

### Attack Vectors

```
┌────────────────────────────────────────────────────────────────────────┐
│                         ATTACK SURFACE                                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  EXTERNAL                                                              │
│  ┌──────────────────┐                                                  │
│  │ Authentication   │ → OAuth token theft, session hijacking           │
│  │ Bypass           │ → CSRF, replay attacks                           │
│  └──────────────────┘                                                  │
│  ┌──────────────────┐                                                  │
│  │ Injection        │ → NoSQL injection, XSS, command injection        │
│  │ Attacks          │                                                  │
│  └──────────────────┘                                                  │
│  ┌──────────────────┐                                                  │
│  │ API Abuse        │ → Rate limit bypass, enumeration                 │
│  │                  │ → Broken access control (IDOR)                   │
│  └──────────────────┘                                                  │
│  ┌──────────────────┐                                                  │
│  │ Data Exposure    │ → Verbose errors, debug endpoints                │
│  │                  │ → Logging PII, exposed secrets                   │
│  └──────────────────┘                                                  │
│                                                                        │
│  INFRASTRUCTURE                                                        │
│  ┌──────────────────┐                                                  │
│  │ Database         │ → Unauthorized access, backup theft              │
│  │ Compromise       │ → SQL/NoSQL injection escalation                 │
│  └──────────────────┘                                                  │
│  ┌──────────────────┐                                                  │
│  │ Cloud            │ → Misconfigured IAM, exposed S3                  │
│  │ Misconfiguration │ → Public endpoints, weak KMS policies            │
│  └──────────────────┘                                                  │
│                                                                        │
│  SUPPLY CHAIN                                                          │
│  ┌──────────────────┐                                                  │
│  │ Dependency       │ → Compromised npm packages                       │
│  │ Attacks          │ → Typosquatting, malicious updates               │
│  └──────────────────┘                                                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Security

### Session Management

```javascript
// Session configuration
const SESSION_CONFIG = {
  cookie: {
    name: "session",
    httpOnly: true, // Prevent XSS access
    secure: true, // HTTPS only
    sameSite: "strict", // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
    domain: ".remoranotes.com",
  },
  rolling: true, // Extend on activity
  resave: false,
  saveUninitialized: false,
};

// JWT payload (minimal)
const jwtPayload = {
  sub: userId, // Subject (user ID)
  iat: issuedAt, // Issued at
  exp: expiresAt, // Expiration
  // NO PII in JWT
};
```

### OAuth Security

```javascript
// State parameter for CSRF protection
const state = crypto.randomBytes(32).toString("hex");
await redis.setex(`oauth:state:${state}`, 600, "pending");

// On callback, verify state
const storedState = await redis.get(`oauth:state:${state}`);
if (!storedState) throw new SecurityError("Invalid OAuth state");
await redis.del(`oauth:state:${state}`);

// PKCE for additional security (if supported)
const codeVerifier = crypto.randomBytes(32).toString("base64url");
const codeChallenge = crypto
  .createHash("sha256")
  .update(codeVerifier)
  .digest("base64url");
```

### Token Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                      TOKEN LIFECYCLE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  OAuth Callback                                                     │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Receive tokens from Google                                │   │
│  │    - access_token (short-lived, ~1 hour)                     │   │
│  │    - refresh_token (long-lived, ~6 months)                   │   │
│  │    - id_token (user identity)                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 2. Encrypt refresh_token with user's DEK                     │   │
│  │    - DEK retrieved from user record (KMS-encrypted)          │   │
│  │    - AES-256-GCM encryption                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 3. Store encrypted refresh_token in DB                       │   │
│  │    - access_token NEVER stored (used and discarded)          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 4. Create session JWT (no Google tokens)                     │   │
│  │    - Contains only userId and expiry                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  API Request Requiring Google API                                   │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 5. Decrypt refresh_token                                     │   │
│  │    - Fetch user's encrypted DEK from DB                      │   │
│  │    - Decrypt DEK via KMS                                     │   │
│  │    - Decrypt refresh_token with DEK                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 6. Exchange refresh_token for new access_token               │   │
│  │    - Call Google OAuth token endpoint                        │   │
│  │    - New access_token used immediately                       │   │
│  │    - If Google returns new refresh_token, re-encrypt & store │   │
│  └─────────────────────────────────────────────────────────────┘   │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 7. Call Google API with access_token                         │   │
│  │    - access_token discarded after use                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Encryption Architecture

### KMS Envelope Encryption

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ENVELOPE ENCRYPTION                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐          ┌─────────────┐                          │
│  │  AWS KMS    │          │  MongoDB    │                          │
│  │  (CMK)      │          │  (User Doc) │                          │
│  └──────┬──────┘          └──────┬──────┘                          │
│         │                        │                                  │
│         │ GenerateDataKey        │                                  │
│         ├───────────────────────►│                                  │
│         │                        │                                  │
│         │ Returns:               │ Stores:                         │
│         │ - Plaintext DEK        │ - encryptedDEK                  │
│         │ - Encrypted DEK        │                                  │
│         │                        │                                  │
│         │                        │                                  │
│         │                        │                                  │
│  ┌──────┴──────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  Encryption Flow:                                            │   │
│  │                                                              │   │
│  │  1. Fetch user.encryptedDEK from MongoDB                     │   │
│  │  2. Decrypt DEK via KMS.decrypt(encryptedDEK) → plaintext    │   │
│  │  3. Encrypt field: AES-256-GCM(data, plaintextDEK)           │   │
│  │  4. Store ciphertext in MongoDB                              │   │
│  │  5. Discard plaintext DEK from memory                        │   │
│  │                                                              │   │
│  │  Decryption Flow:                                            │   │
│  │                                                              │   │
│  │  1. Fetch user.encryptedDEK from MongoDB                     │   │
│  │  2. Decrypt DEK via KMS.decrypt(encryptedDEK) → plaintext    │   │
│  │  3. Decrypt field: AES-256-GCM.decrypt(ciphertext, DEK)      │   │
│  │  4. Return plaintext data                                    │   │
│  │  5. Discard plaintext DEK from memory                        │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementation

```javascript
// crypto-service.js
const {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
} = require("@aws-sdk/client-kms");
const crypto = require("crypto");

const kms = new KMSClient({ region: process.env.AWS_REGION });
const CMK_ARN = process.env.KMS_CMK_ARN;

// Generate DEK for new user
async function generateDataEncryptionKey() {
  const command = new GenerateDataKeyCommand({
    KeyId: CMK_ARN,
    KeySpec: "AES_256",
  });

  const { Plaintext, CiphertextBlob } = await kms.send(command);

  return {
    plaintext: Plaintext, // Use immediately, then discard
    encrypted: CiphertextBlob, // Store in user document
  };
}

// Decrypt user's DEK
async function decryptDataKey(encryptedDEK) {
  const command = new DecryptCommand({
    CiphertextBlob: encryptedDEK,
    KeyId: CMK_ARN,
  });

  const { Plaintext } = await kms.send(command);
  return Plaintext;
}

// Encrypt field with DEK
function encryptField(plaintext, dek) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext}`;
}

// Decrypt field with DEK
function decryptField(encryptedString, dek) {
  const [ivB64, authTagB64, ciphertext] = encryptedString.split(":");

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, "base64", "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}
```

### Encrypted Fields Summary

| Collection     | Field                 | Encryption        |
| -------------- | --------------------- | ----------------- |
| users          | encryptedRefreshToken | DEK (AES-256-GCM) |
| users          | email                 | DEK               |
| contacts       | email                 | DEK               |
| contacts       | phone                 | DEK               |
| contacts       | notes                 | DEK               |
| calendarEvents | summary               | DEK (if stored)   |
| interactions   | notes                 | DEK               |

### Hash Fields (for querying)

| Collection     | Field                 | Hash Algorithm | Purpose          |
| -------------- | --------------------- | -------------- | ---------------- |
| users          | emailHash             | SHA-256        | Uniqueness check |
| contacts       | emailHash             | SHA-256        | Deduplication    |
| contacts       | phoneHash             | SHA-256        | Deduplication    |
| calendarEvents | attendees[].emailHash | SHA-256        | Contact matching |

---

## Authorization

### Per-User Data Boundaries

**Critical**: Every database query MUST include userId scope.

```javascript
// BAD - allows cross-user access
const contact = await Contact.findById(contactId);

// GOOD - scoped to user
const contact = await Contact.findOne({
  _id: contactId,
  userId: req.user._id,
});

// BETTER - encapsulated in service layer
class ContactService {
  constructor(userId) {
    this.userId = userId;
  }

  async findById(contactId) {
    return Contact.findOne({
      _id: contactId,
      userId: this.userId,
    });
  }

  async findAll(filters = {}) {
    return Contact.find({
      ...filters,
      userId: this.userId, // Always applied
    });
  }
}

// Usage in controller
router.get("/contacts/:id", requireAuth, async (req, res) => {
  const contactService = new ContactService(req.user._id);
  const contact = await contactService.findById(req.params.id);

  if (!contact) {
    return res.status(404).json({ error: "Contact not found" });
  }

  res.json({ data: { contact } });
});
```

### Authorization Middleware

```javascript
function requireAuth(req, res, next) {
  const token = req.cookies.session || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED" } });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { _id: payload.sub };
    next();
  } catch (error) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED" } });
  }
}

// Resource ownership verification
async function requireOwnership(resourceType) {
  return async (req, res, next) => {
    const resourceId = req.params.id;
    const Model = getModelForResource(resourceType);

    const resource = await Model.findOne({
      _id: resourceId,
      userId: req.user._id,
    });

    if (!resource) {
      return res.status(404).json({ error: { code: "NOT_FOUND" } });
    }

    req[resourceType] = resource;
    next();
  };
}
```

---

## Input Validation

### Request Validation

```javascript
// Using Zod for validation
const contactSchema = z.object({
  name: z.object({
    first: z.string().min(1).max(100),
    last: z.string().max(100).optional(),
  }),
  email: z.string().email().optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/)
    .optional(), // E.164
  tags: z
    .array(z.enum(["client", "lead", "friend", "family", "vendor"]))
    .optional(),
  business: z
    .object({
      company: z.string().max(200).optional(),
      title: z.string().max(100).optional(),
      priority: z.enum(["high", "medium", "low"]).optional(),
      importance: z.number().min(1).max(10).optional(),
    })
    .optional(),
  birthday: z
    .object({
      month: z.number().min(1).max(12),
      day: z.number().min(1).max(31),
      year: z.number().min(1900).max(2100).optional(),
    })
    .optional()
    .refine(validateDayForMonth),
});

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          details: result.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
      });
    }

    req.validatedBody = result.data;
    next();
  };
}
```

### NoSQL Injection Prevention

```javascript
// Mongoose already sanitizes queries, but be explicit
function sanitizeQueryParams(params) {
  const sanitized = {};

  for (const [key, value] of Object.entries(params)) {
    // Reject objects (potential $where, $gt, etc.)
    if (typeof value === "object" && value !== null) {
      throw new ValidationError(`Invalid query parameter: ${key}`);
    }

    // Only allow expected types
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ObjectId validation
function isValidObjectId(id) {
  return (
    mongoose.Types.ObjectId.isValid(id) &&
    new mongoose.Types.ObjectId(id).toString() === id
  );
}
```

### XSS Prevention

```javascript
// Content Security Policy
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Needed for inline styles
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://www.googleapis.com",
        ],
        frameSrc: ["https://accounts.google.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Output encoding in email templates
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

---

## Rate Limiting

```javascript
const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redis.sendCommand(args),
  }),
  keyGenerator: (req) => req.user?._id || req.ip,
});

// Auth rate limit (stricter)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many auth attempts" },
  },
});

// Import rate limit (very strict)
const importLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1,
  message: { error: { code: "RATE_LIMITED", message: "Import rate limited" } },
  keyGenerator: (req) => `import:${req.user._id}`,
});

// Apply
app.use("/api/", apiLimiter);
app.use("/api/auth/", authLimiter);
app.use("/api/contacts/import", importLimiter);
app.use("/api/calendar/sync", importLimiter);
```

---

## Logging & Audit

### Structured Logging (No PII)

```javascript
const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.email",
      "req.body.phone",
      "*.email",
      "*.phone",
      "*.refreshToken",
      "*.accessToken",
    ],
    censor: "[REDACTED]",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

// Request logging middleware
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;

  logger.info({
    type: "request",
    requestId,
    method: req.method,
    path: req.path,
    userId: req.user?._id,
    userAgent: req.headers["user-agent"],
    // NO IP address (privacy)
  });

  next();
});
```

### Audit Log Events

```javascript
// Audit log middleware
async function auditLog(event) {
  const { userId, category, action, metadata, request } = event;

  await AuditLog.create({
    userId,
    category,
    action,
    metadata: sanitizeMetadata(metadata),
    request: request
      ? {
          requestId: request.requestId,
          userAgent: request.headers?.["user-agent"],
          // IP hashed for abuse detection only
          ipHash: request.ip ? sha256(request.ip) : null,
        }
      : null,
    timestamp: new Date(),
  });
}

// Usage
await auditLog({
  userId: user._id,
  category: "auth",
  action: "LOGIN",
  request: req,
});

await auditLog({
  userId: user._id,
  category: "data",
  action: "CONTACT_CREATED",
  metadata: { contactId: contact._id },
});
```

---

## Data Deletion

### Account Deletion Flow

```javascript
async function deleteAccount(userId, confirmation) {
  if (confirmation !== "DELETE MY ACCOUNT") {
    throw new ValidationError("Invalid confirmation");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // 1. Revoke Google tokens
      const user = await User.findById(userId).session(session);
      if (user.encryptedRefreshToken) {
        const dek = await decryptDataKey(user.encryptedDEK);
        const refreshToken = decryptField(user.encryptedRefreshToken, dek);

        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${refreshToken}`,
          {
            method: "POST",
          }
        ).catch(() => {}); // Best effort, don't block deletion
      }

      // 2. Delete all user data (hard delete)
      await Promise.all([
        Contact.deleteMany({ userId }).session(session),
        ReminderRule.deleteMany({ userId }).session(session),
        ReminderInstance.deleteMany({ userId }).session(session),
        CalendarEvent.deleteMany({ userId }).session(session),
        Interaction.deleteMany({ userId }).session(session),
      ]);

      // 3. Delete user record
      await User.deleteOne({ _id: userId }).session(session);

      // 4. Audit log (with userId preserved)
      await AuditLog.create(
        [
          {
            userId,
            category: "account",
            action: "ACCOUNT_DELETED",
            timestamp: new Date(),
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
}
```

### Google Disconnect Flow

```javascript
async function disconnectGoogle(userId) {
  const user = await User.findById(userId);

  // 1. Revoke token
  if (user.encryptedRefreshToken) {
    const dek = await decryptDataKey(user.encryptedDEK);
    const refreshToken = decryptField(user.encryptedRefreshToken, dek);

    await fetch(`https://oauth2.googleapis.com/revoke?token=${refreshToken}`, {
      method: "POST",
    }).catch(() => {});
  }

  // 2. Delete imported data only (preserve manual data)
  await Contact.deleteMany({ userId, source: "google", hasGoogleLink: false });
  await CalendarEvent.deleteMany({ userId });

  // 3. For contacts with local overrides, convert to manual
  await Contact.updateMany(
    { userId, source: "google", hasGoogleLink: true },
    {
      $set: { source: "manual", hasGoogleLink: false },
      $unset: { googleResourceName: 1 },
    }
  );

  // 4. Clear Google-related fields
  await User.updateOne(
    { _id: userId },
    {
      $unset: {
        encryptedRefreshToken: 1,
        "googleSync.contactsSyncToken": 1,
        "googleSync.calendarSyncToken": 1,
      },
    }
  );

  await auditLog({
    userId,
    category: "account",
    action: "GOOGLE_DISCONNECTED",
  });
}
```

---

## Security Checklist

### Authentication & Authorization

- [x] OAuth 2.0 with PKCE (where supported)
- [x] CSRF protection via state parameter
- [x] httpOnly, secure, sameSite=strict cookies
- [x] JWT tokens with short expiry
- [x] Per-request user verification
- [x] Per-user data boundaries enforced at data layer

### Encryption

- [x] TLS 1.3 for all connections
- [x] KMS envelope encryption for PII
- [x] Per-user Data Encryption Keys
- [x] OAuth tokens encrypted at rest
- [x] No plaintext secrets in code/logs

### Input Validation

- [x] Schema validation on all inputs (Zod)
- [x] ObjectId validation
- [x] NoSQL injection prevention
- [x] XSS prevention (CSP, output encoding)

### Rate Limiting

- [x] API rate limits (100/min general)
- [x] Auth rate limits (10/min)
- [x] Import/sync rate limits (1/5min)

### Logging & Monitoring

- [x] Structured logging (no PII)
- [x] Audit logs for sensitive actions
- [x] Error tracking (Sentry)
- [x] CloudWatch alerts

### Data Protection

- [x] Minimal data collection
- [x] Data retention policies
- [x] Hard delete on account deletion
- [x] Token revocation on disconnect
- [x] Data export capability

### Infrastructure

- [x] VPC isolation
- [x] Security groups (least privilege)
- [x] Secrets in AWS Secrets Manager
- [x] IAM roles (least privilege)
- [x] MongoDB Atlas with TLS + IP whitelist
- [x] CloudTrail for KMS audit

### Dependencies

- [x] npm audit on CI/CD
- [x] Dependabot enabled
- [x] Lock file committed
- [x] No wildcard versions

---

## Incident Response

### Security Incident Checklist

1. **Detection**: Alert received or anomaly detected
2. **Containment**: Revoke compromised credentials, block IPs
3. **Investigation**: Audit logs, CloudTrail, access logs
4. **Remediation**: Patch vulnerability, rotate secrets
5. **Communication**: Notify affected users (if data breach)
6. **Post-mortem**: Document and improve

### Key Contacts

- AWS Support: Available via console
- Google Cloud Support: Available via console
- MongoDB Atlas Support: Available via console
