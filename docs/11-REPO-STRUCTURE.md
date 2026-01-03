# RemoraNotes - Repository Structure & Libraries

## Repository Structure

```
remoranotes/
├── CLAUDE.md                    # Design decisions & change log (THIS FILE)
├── README.md                    # Project overview & setup instructions
├── package.json                 # Root package.json (workspace config)
├── pnpm-workspace.yaml          # pnpm workspace definition
├── turbo.json                   # Turborepo configuration
├── .github/
│   ├── workflows/
│   │   ├── ci.yml               # Lint, test, build
│   │   ├── deploy-staging.yml   # Deploy to staging
│   │   └── deploy-prod.yml      # Deploy to production
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
│
├── docs/                        # Design documentation
│   ├── 01-EXECUTIVE-SUMMARY.md
│   ├── 02-ARCHITECTURE.md
│   ├── 03-DATA-MODEL.md
│   ├── 04-INTEGRATIONS.md
│   ├── 05-REMINDER-ENGINE.md
│   ├── 06-NOTIFICATIONS.md
│   ├── 07-API-SPECIFICATION.md
│   ├── 08-UX-FLOWS.md
│   ├── 09-SECURITY.md
│   ├── 10-IMPLEMENTATION-PLAN.md
│   └── 11-REPO-STRUCTURE.md      # This file
│
├── packages/
│   ├── client/                   # React frontend (Vite)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── public/
│   │   │   ├── favicon.ico
│   │   │   ├── manifest.json
│   │   │   └── robots.txt
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── vite-env.d.ts
│   │       │
│   │       ├── assets/           # Static assets
│   │       │   ├── logo.svg
│   │       │   └── styles/
│   │       │       └── globals.css
│   │       │
│   │       ├── components/       # Reusable UI components
│   │       │   ├── ui/           # Primitive components
│   │       │   │   ├── Button.tsx
│   │       │   │   ├── Card.tsx
│   │       │   │   ├── Input.tsx
│   │       │   │   ├── Modal.tsx
│   │       │   │   ├── Toast.tsx
│   │       │   │   └── index.ts
│   │       │   │
│   │       │   ├── layout/       # Layout components
│   │       │   │   ├── AppShell.tsx
│   │       │   │   ├── BottomNav.tsx
│   │       │   │   ├── Header.tsx
│   │       │   │   └── index.ts
│   │       │   │
│   │       │   ├── contacts/     # Contact-related components
│   │       │   │   ├── ContactCard.tsx
│   │       │   │   ├── ContactForm.tsx
│   │       │   │   ├── ContactList.tsx
│   │       │   │   └── index.ts
│   │       │   │
│   │       │   ├── reminders/    # Reminder-related components
│   │       │   │   ├── ReminderCard.tsx
│   │       │   │   ├── TodayQueue.tsx
│   │       │   │   ├── ReminderForm.tsx
│   │       │   │   └── index.ts
│   │       │   │
│   │       │   └── interactions/ # Interaction components
│   │       │       ├── InteractionForm.tsx
│   │       │       ├── InteractionList.tsx
│   │       │       └── index.ts
│   │       │
│   │       ├── pages/            # Route pages
│   │       │   ├── Landing.tsx
│   │       │   ├── Dashboard.tsx
│   │       │   ├── Contacts.tsx
│   │       │   ├── ContactDetail.tsx
│   │       │   ├── Reminders.tsx
│   │       │   ├── Settings.tsx
│   │       │   ├── Onboarding/
│   │       │   │   ├── ModeSelect.tsx
│   │       │   │   ├── ImportContacts.tsx
│   │       │   │   ├── FirstReminder.tsx
│   │       │   │   └── DigestSetup.tsx
│   │       │   │
│   │       │   └── auth/
│   │       │       ├── Callback.tsx
│   │       │       └── ActionResult.tsx
│   │       │
│   │       ├── hooks/            # Custom React hooks
│   │       │   ├── useAuth.ts
│   │       │   ├── useContacts.ts
│   │       │   ├── useReminders.ts
│   │       │   ├── useToast.ts
│   │       │   └── index.ts
│   │       │
│   │       ├── stores/           # State management (Zustand)
│   │       │   ├── authStore.ts
│   │       │   ├── uiStore.ts
│   │       │   └── index.ts
│   │       │
│   │       ├── api/              # API client
│   │       │   ├── client.ts     # Axios/fetch wrapper
│   │       │   ├── auth.ts
│   │       │   ├── contacts.ts
│   │       │   ├── reminders.ts
│   │       │   ├── interactions.ts
│   │       │   └── index.ts
│   │       │
│   │       ├── lib/              # Utility functions
│   │       │   ├── date.ts       # Date formatting
│   │       │   ├── format.ts     # Text formatting
│   │       │   └── validation.ts # Frontend validation
│   │       │
│   │       ├── routes/           # React Router config
│   │       │   ├── index.tsx
│   │       │   ├── ProtectedRoute.tsx
│   │       │   └── routes.ts
│   │       │
│   │       └── types/            # Frontend-specific types
│   │           └── index.ts
│   │
│   ├── server/                   # Express backend
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nodemon.json
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts          # Entry point
│   │       ├── app.ts            # Express app setup
│   │       ├── config/
│   │       │   ├── index.ts      # Config loader
│   │       │   ├── database.ts   # MongoDB connection
│   │       │   ├── google.ts     # Google OAuth config
│   │       │   └── aws.ts        # AWS SDK config
│   │       │
│   │       ├── middleware/
│   │       │   ├── auth.ts       # requireAuth
│   │       │   ├── validation.ts # validateBody
│   │       │   ├── rateLimit.ts  # Rate limiting
│   │       │   ├── errorHandler.ts
│   │       │   ├── requestLogger.ts
│   │       │   └── index.ts
│   │       │
│   │       ├── routes/
│   │       │   ├── index.ts      # Route aggregator
│   │       │   ├── auth.ts
│   │       │   ├── users.ts
│   │       │   ├── contacts.ts
│   │       │   ├── reminders.ts
│   │       │   ├── interactions.ts
│   │       │   ├── calendar.ts
│   │       │   ├── onboarding.ts
│   │       │   └── digestActions.ts
│   │       │
│   │       ├── services/         # Business logic
│   │       │   ├── AuthService.ts
│   │       │   ├── UserService.ts
│   │       │   ├── ContactService.ts
│   │       │   ├── ReminderService.ts
│   │       │   ├── InteractionService.ts
│   │       │   ├── CalendarService.ts
│   │       │   ├── DigestService.ts
│   │       │   ├── CryptoService.ts
│   │       │   ├── GoogleService.ts
│   │       │   └── index.ts
│   │       │
│   │       ├── models/           # Mongoose models
│   │       │   ├── User.ts
│   │       │   ├── Contact.ts
│   │       │   ├── ReminderRule.ts
│   │       │   ├── ReminderInstance.ts
│   │       │   ├── CalendarEvent.ts
│   │       │   ├── Interaction.ts
│   │       │   ├── AuditLog.ts
│   │       │   └── index.ts
│   │       │
│   │       ├── schemas/          # Zod validation schemas
│   │       │   ├── contact.ts
│   │       │   ├── reminder.ts
│   │       │   ├── interaction.ts
│   │       │   ├── user.ts
│   │       │   └── index.ts
│   │       │
│   │       ├── utils/
│   │       │   ├── logger.ts     # Pino logger
│   │       │   ├── auditLog.ts
│   │       │   ├── errors.ts     # Custom error classes
│   │       │   ├── hash.ts       # SHA-256 hashing
│   │       │   ├── date.ts       # Date utilities
│   │       │   └── index.ts
│   │       │
│   │       └── types/
│   │           └── express.d.ts  # Express type extensions
│   │
│   ├── jobs/                     # Lambda job handlers
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── template.yaml         # SAM template
│   │   └── src/
│   │       ├── handlers/
│   │       │   ├── digestDispatcher.ts
│   │       │   ├── digestSender.ts
│   │       │   ├── calendarSync.ts
│   │       │   ├── reminderRecalc.ts
│   │       │   └── eventCleanup.ts
│   │       │
│   │       ├── lib/
│   │       │   ├── database.ts
│   │       │   ├── email.ts
│   │       │   └── shared.ts
│   │       │
│   │       └── index.ts
│   │
│   └── shared/                   # Shared types & utilities
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── types/
│           │   ├── user.ts
│           │   ├── contact.ts
│           │   ├── reminder.ts
│           │   ├── interaction.ts
│           │   ├── calendar.ts
│           │   ├── api.ts        # API response types
│           │   └── index.ts
│           │
│           ├── constants/
│           │   ├── tags.ts       # Allowed tags
│           │   ├── priorities.ts
│           │   ├── reminderTypes.ts
│           │   ├── plans.ts      # Plan limits
│           │   └── index.ts
│           │
│           └── utils/
│               ├── date.ts       # Shared date utils
│               └── index.ts
│
├── infrastructure/               # IaC (CDK or Terraform)
│   ├── package.json
│   ├── cdk.json
│   └── lib/
│       ├── vpc-stack.ts
│       ├── database-stack.ts
│       ├── api-stack.ts
│       ├── jobs-stack.ts
│       ├── cdn-stack.ts
│       └── monitoring-stack.ts
│
├── scripts/                      # Utility scripts
│   ├── setup-local.sh           # Local dev setup
│   ├── seed-data.ts             # Dev data seeding
│   └── migrate.ts               # Database migrations
│
├── migrations/                   # Database migrations
│   ├── 001-initial-schema.ts
│   └── README.md
│
├── .env.example                 # Environment template
├── .eslintrc.js                 # ESLint config
├── .prettierrc                  # Prettier config
├── .gitignore
├── docker-compose.yml           # Local development
└── tsconfig.base.json           # Base TypeScript config
```

---

## NPM Libraries

### Root / Shared

```json
{
  "devDependencies": {
    "typescript": "^5.3.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "prettier": "^3.2.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.2.0",
    "turbo": "^1.12.0"
  }
}
```

### packages/client

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.5.0",
    "react-hook-form": "^7.49.0",
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.22.0",
    "date-fns": "^3.2.0",
    "date-fns-tz": "^2.0.0",
    "axios": "^1.6.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "vitest": "^1.2.0",
    "@testing-library/react": "^14.1.0"
  }
}
```

### packages/server

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "mongoose": "^8.1.0",
    "jsonwebtoken": "^9.0.0",
    "cookie-parser": "^1.4.0",
    "cors": "^2.8.0",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.0",
    "rate-limit-redis": "^4.2.0",
    "zod": "^3.22.0",
    "pino": "^8.18.0",
    "pino-http": "^9.0.0",
    "date-fns": "^3.2.0",
    "date-fns-tz": "^2.0.0",
    "googleapis": "^131.0.0",
    "@aws-sdk/client-kms": "^3.496.0",
    "@aws-sdk/client-ses": "^3.496.0",
    "@aws-sdk/client-secrets-manager": "^3.496.0",
    "ioredis": "^5.3.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/cookie-parser": "^1.4.0",
    "@types/cors": "^2.8.0",
    "nodemon": "^3.0.0",
    "ts-node": "^10.9.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "supertest": "^6.3.0",
    "@types/supertest": "^6.0.0"
  }
}
```

### packages/jobs

```json
{
  "dependencies": {
    "mongoose": "^8.1.0",
    "date-fns": "^3.2.0",
    "date-fns-tz": "^2.0.0",
    "@aws-sdk/client-kms": "^3.496.0",
    "@aws-sdk/client-ses": "^3.496.0",
    "@aws-sdk/client-sqs": "^3.496.0",
    "googleapis": "^131.0.0",
    "pino": "^8.18.0",
    "@remoranotes/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.0",
    "esbuild": "^0.20.0",
    "aws-sam-cli": "^1.0.0"
  }
}
```

---

## Library Justifications

| Library             | Purpose           | Why This Library                                 |
| ------------------- | ----------------- | ------------------------------------------------ |
| **Vite**            | Frontend bundler  | Fast HMR, native ESM, better DX than CRA         |
| **React Query**     | Data fetching     | Caching, refetching, optimistic updates built-in |
| **Zustand**         | State management  | Minimal API, no boilerplate, TS-friendly         |
| **React Hook Form** | Forms             | Performance-focused, minimal re-renders          |
| **Zod**             | Validation        | TypeScript-first, shared with backend            |
| **date-fns**        | Date handling     | Tree-shakeable, immutable, comprehensive         |
| **date-fns-tz**     | Timezone handling | Works with date-fns, IANA timezone support       |
| **Tailwind CSS**    | Styling           | Utility-first, mobile-first, consistent design   |
| **Mongoose**        | MongoDB ODM       | Mature, well-documented, schema validation       |
| **Pino**            | Logging           | Fast, structured, JSON output                    |
| **helmet**          | Security headers  | Standard Express security middleware             |
| **googleapis**      | Google APIs       | Official SDK, TypeScript support                 |
| **AWS SDK v3**      | AWS services      | Modular, tree-shakeable, TypeScript              |
| **ioredis**         | Redis client      | Robust, cluster support, good performance        |

---

## Configuration Files

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### .eslintrc.js

```javascript
module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
  },
  ignorePatterns: ["node_modules/", "dist/", "build/"],
};
```

### .prettierrc

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  mongodb:
    image: mongo:7
    container_name: remoranotes-mongo
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: remoranotes

  redis:
    image: redis:7-alpine
    container_name: remoranotes-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  localstack:
    image: localstack/localstack:latest
    container_name: remoranotes-localstack
    ports:
      - "4566:4566"
    environment:
      - SERVICES=kms,ses,sqs,secretsmanager
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
    volumes:
      - localstack_data:/tmp/localstack

volumes:
  mongodb_data:
  redis_data:
  localstack_data:
```

### .env.example

```bash
# Environment
NODE_ENV=development

# Server
PORT=3001
API_URL=http://localhost:3001

# Client
VITE_API_URL=http://localhost:3001/api/v1

# MongoDB
MONGODB_URI=mongodb://localhost:27017/remoranotes

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/v1/auth/google/callback

# AWS (LocalStack for development)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_ENDPOINT_URL=http://localhost:4566

# KMS
KMS_CMK_ARN=arn:aws:kms:us-east-1:000000000000:key/test-key

# SES
SES_FROM_ADDRESS=digest@localhost.test

# Feature Flags
FEATURE_CALENDAR_SYNC=true
FEATURE_CONTACT_IMPORT=true
```

---

## Scripts

### Root package.json scripts

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "clean": "turbo run clean && rm -rf node_modules",
    "prepare": "husky install"
  }
}
```

### Client scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .ts,.tsx",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### Server scripts

```json
{
  "scripts": {
    "dev": "nodemon",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

---

## Getting Started

```bash
# Clone repository
git clone https://github.com/username/remoranotes.git
cd remoranotes

# Install dependencies
pnpm install

# Start local services
docker-compose up -d

# Set up environment
cp .env.example .env
# Edit .env with your values

# Initialize LocalStack (KMS key, etc.)
./scripts/setup-local.sh

# Start development
pnpm dev

# Open browser
# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```
