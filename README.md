# Subscription Tracker — Backend (NestJS + Postgres)

This service powers subscription discovery and management by reading subscription-related emails (Gmail first), extracting only the required data, and preserving user privacy and transparency.

Status: MVP in progress. New modules will be added as the project evolves.


## MVP goals and success criteria

Primary user problem: Automatically discover and organize recurring subscriptions by reading subscription emails so users can understand how many subscriptions they have (active/paused/cancelled), how much they spend, and get suggestions (e.g., consolidate duplicates). We must never store full email content and be transparent about what we read and why.

MVP success criteria:
- Users can connect their Gmail account and grant limited access for subscription discovery.
- The app identifies subscription-related emails and extracts structured subscription records (service/vendor, price, currency, billing cadence, next payment date, status) without storing raw email bodies.
- UI (out of scope in this repo) will show: total subscriptions by status, monthly/annual spend, and suggestions (e.g., duplicate services).
- Privacy & transparency features: consent screen, a privacy dashboard showing number of emails scanned, last sync time, per-extraction confidence, and the reason/evidence for an extraction in redacted or rule-based form. Users can delete extracted data and revoke Gmail access at any time.
- Extraction pipeline is deterministic first (regex + vendor heuristics) with an optional LLM fallback for ambiguous emails (LLM only with explicit user opt-in and documented data handling).
- Gmail tokens/credentials are encrypted at rest, and we store only minimum metadata (hashed message IDs) for deduplication.
- Scheduled syncs (background worker) and on-demand sync.


## High-level architecture

Stack: NestJS, PostgreSQL, optional Redis (BullMQ) for background jobs/queues.

Textual flow:
User (web/mobile) -> Auth/Consent UI -> API (EmailConnector) -> Gmail API (OAuth)
                                   -> EmailFetcher Job -> EmailProcessor -> Extraction results stored in Postgres
                                   -> Background worker -> Notifications/Analytics

Privacy variants:
- Server-side (MVP default): Server holds encrypted refresh tokens, fetches labeled emails, parses in-memory, stores only extracted fields + hashed message IDs.
- Client-side (future option): Browser/mobile uses Gmail API directly (OAuth) and runs extraction locally; only extracted records are sent to server.


## Modules (current and planned)

Existing in this repository (as of now):
- Auth: user registration, login, JWT, current user endpoint. See src/auth.
- Email (EmailConnector): Gmail OAuth flow and sync status + manual sync. See src/email.
- Subscriptions: CRUD/representation of extracted subscription entries. See src/subscriptions.

Planned modules to be added incrementally:
- EmailProcessor: deterministic parsing pipeline (regex, vendor heuristics) to detect subscriptions in email metadata/snippets.
- Extraction: persistence of structured outputs and audit trails. No raw email bodies, only extracted fields + hashed message IDs.
- Notifications: user-facing alerts (e.g., new subscription detected, upcoming charge).
- Analytics: aggregates for monthly/annual spend, status breakdown, and suggestions (e.g., duplicate service consolidation).
- Background worker: BullMQ queues (fetch -> parse -> extract) with retries and observability.
- LLM Fallback (optional): invoked only when deterministic parsing is ambiguous and only with explicit user opt‑in to privacy terms.

Note: New modules will be added as the project is still under development. Names and boundaries may evolve.


## Data privacy & handling principles

- Do not store raw email bodies or full message content.
- Store minimum metadata for deduplication (e.g., hashed Gmail message IDs, labels, dates).
- Keep Gmail refresh tokens encrypted at rest; limit scopes to what’s necessary for reading relevant messages.
- Provide transparency metadata: number of emails scanned, last sync, extraction confidence, and reason/evidence for extraction (redacted/rule-based form).
- Allow users to delete extracted data and revoke Gmail access at any time.
- LLM usage is opt-in only, documented, and isolated to redacted content where possible. Prefer enterprise providers with no training/retention.


## Database (PostgreSQL)

- Tables (conceptual): users, subscriptions, extractions, sync_status, audit/consent_logs, email_message_dedup (hashed ids).
- No raw email body storage. Only extracted fields: vendor, price, currency, cadence, next_payment_date, status, and minimal provenance.
- Use unique constraint on hashed_message_id + user_id for idempotent ingestion.


## Background jobs (BullMQ + Redis)

- Queues: email:fetch -> email:process -> extraction:store.
- Retries with backoff; idempotent by hashed message id.
- Scheduled syncs (cron) plus on-demand triggers from API.


## API surface at a glance

Auth
- POST /auth/register — create user
- POST /auth/login — obtain access/refresh tokens
- POST /auth/google — login with Google (send { idToken } from Google Identity Services)
- POST /auth/refresh-token — rotate access token
- GET  /auth/me — current user (JWT)
- GET /auth/request-reset-password - Initiates a password reset process by sending a reset link to the user's email.
- POST /auth/reset-password - Resets the user's password.

Email (Gmail connector)
- GET  /email/get-auth — returns Google OAuth URL
- POST /email/get-token — exchanges OAuth code for tokens (tokens stored encrypted)
- GET  /email/sync-status — current sync status for user (number scanned, last sync time)
- POST /email/manual-sync — manually trigger a sync job

Subscriptions
- REST endpoints for managing/viewing extracted subscriptions (see src/subscriptions)

Swagger/OpenAPI is configured via decorators in controllers.


## Project structure (selected)

- src/app — application bootstrap/controllers/services
- src/auth — authentication, JWT, guards, DTOs
- src/email — Gmail OAuth and sync endpoints
- src/mail - mailer, email templates
- src/subscriptions — subscription DTOs, controller, service
- src/tokens - reset tokens
- test — unit/e2e tests
- dist — build output (ignored in dev)


## Local development

Prerequisites: Node.js LTS, npm, Postgres, optional Redis.

Install deps:
- npm install

Run:
- npm run start:dev (watch mode)

Environment variables (example):
- DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME
- JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
- GOOGLE_CLIENT_ID — required for /auth/google verification and Gmail connector
- GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI — required for Gmail OAuth connector
- REDIS_URL (optional, for BullMQ)

Client-side Google login (high level):
- Use Google Identity Services (One Tap or button) to obtain an ID token for your OAuth 2.0 Web Client (the client ID must match GOOGLE_CLIENT_ID).
- Send that token to POST /auth/google as { idToken }.
- The API verifies the token, links the account by email if it exists, or creates a new user with provider=google, then returns access/refresh JWTs.

Testing:
- npm run test
- npm run test:e2e

Notes:
- TypeORM synchronize=true is enabled for local dev and will add the new User fields (provider, googleId, picture) automatically. Use migrations for production.
