# RemoraNotes

> Never forget to follow up with important people.

RemoraNotes is a relationship reminder SaaS application for business and personal use. Keep track of contacts, log interactions, and receive timely reminders to maintain important relationships.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- Google Cloud Console project with OAuth credentials

### Setup

1. **Clone and install dependencies**

```bash
git clone https://github.com/username/remoranotes.git
cd remoranotes
pnpm install
```

2. **Start local services**

```bash
docker-compose up -d
```

3. **Configure environment**

```bash
cp .env.example .env
# Edit .env with your values (especially Google OAuth credentials)
```

4. **Wait for LocalStack initialization**

```bash
docker-compose logs -f localstack
# Wait for "LocalStack initialization complete!"
# Copy the KMS_CMK_ARN from the output to your .env
```

5. **Start development servers**

```bash
pnpm dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:5173 (when client is implemented)

## Project Structure

```
remoranotes/
├── packages/
│   ├── client/       # React frontend (Vite)
│   ├── server/       # Express backend
│   ├── shared/       # Shared types & constants
│   └── jobs/         # Lambda job handlers
├── docs/             # Design documentation
├── scripts/          # Utility scripts
└── CLAUDE.md         # Design decisions & change log
```

## Documentation

See [docs/](./docs/) for detailed design documentation:

- [Executive Summary](./docs/01-EXECUTIVE-SUMMARY.md)
- [Architecture](./docs/02-ARCHITECTURE.md)
- [Data Model](./docs/03-DATA-MODEL.md)
- [Google Integrations](./docs/04-INTEGRATIONS.md)
- [Reminder Engine](./docs/05-REMINDER-ENGINE.md)
- [Notifications](./docs/06-NOTIFICATIONS.md)
- [API Specification](./docs/07-API-SPECIFICATION.md)
- [UX Flows](./docs/08-UX-FLOWS.md)
- [Security](./docs/09-SECURITY.md)
- [Implementation Plan](./docs/10-IMPLEMENTATION-PLAN.md)
- [Repo Structure](./docs/11-REPO-STRUCTURE.md)

## Development

### Commands

```bash
# Development
pnpm dev          # Start all packages in dev mode
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm test         # Run tests

# Individual packages
pnpm --filter @remoranotes/server dev
pnpm --filter @remoranotes/client dev
```

### API Routes

```
GET  /api/v1/health              # Health check
POST /api/v1/auth/google         # Initiate Google OAuth
GET  /api/v1/auth/google/callback # OAuth callback
POST /api/v1/auth/logout         # Logout
GET  /api/v1/auth/me             # Get current user

GET  /api/v1/users/me            # Get user profile
PATCH /api/v1/users/me/preferences # Update preferences
DELETE /api/v1/users/me          # Delete account

GET  /api/v1/contacts            # List contacts
POST /api/v1/contacts            # Create contact
GET  /api/v1/contacts/:id        # Get contact
PATCH /api/v1/contacts/:id       # Update contact
DELETE /api/v1/contacts/:id      # Delete contact

GET  /api/v1/interactions        # List interactions
POST /api/v1/interactions        # Log interaction
GET  /api/v1/interactions/:id    # Get interaction
PATCH /api/v1/interactions/:id   # Update interaction
DELETE /api/v1/interactions/:id  # Delete interaction
```

## Tech Stack

- **Frontend**: React, Vite, TailwindCSS, React Query, Zustand
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Auth**: Google OAuth 2.0 with PKCE
- **Security**: AWS KMS envelope encryption
- **Email**: Amazon SES
- **Infrastructure**: AWS (ECS, Lambda, EventBridge)

## License

Private - All rights reserved
