# Bank Notification Processor — Backend (NestJS + Postgres)

This service powers bank notification processing and management by reading bank email notifications (Gmail first), extracting only the required data, and preserving user privacy and transparency.

Status: MVP in progress. New modules will be added as the project evolves.


## MVP goals and success criteria

Primary user problem: Automatically discover and organize bank email notifications by reading bank notification emails so users can understand their financial activities, transactions, and account updates. We must never store full email content and be transparent about what we read and why.

MVP success criteria:
- Users can connect their Gmail account and grant limited access for bank notification discovery.
- The app identifies bank notification emails and extracts structured bank notification records (bank/institution, transaction amount, currency, transaction type, account information, notification type) without storing raw email bodies.
- UI (out of scope in this repo) will show: transaction summaries, account activity, and financial insights from bank notifications.
- Privacy & transparency features: consent screen, a privacy dashboard showing number of emails scanned, last sync time, per-extraction confidence, and the reason/evidence for an extraction in redacted or rule-based form. Users can delete extracted data and revoke Gmail access at any time.
- Extraction pipeline is deterministic first (regex + bank heuristics) with an optional LLM fallback for ambiguous emails (LLM only with explicit user opt-in and documented data handling).
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
- Subscriptions: CRUD/representation of extracted bank notification entries. See src/subscriptions.

Planned modules to be added incrementally:
- EmailProcessor: deterministic parsing pipeline (regex, bank heuristics) to detect bank notifications in email metadata/snippets.
- Extraction: persistence of structured outputs and audit trails. No raw email bodies, only extracted fields + hashed message IDs.
- Notifications: user-facing alerts (e.g., new transaction detected, account balance updates).
- Analytics: aggregates for transaction summaries, account activity, and financial insights from bank notifications.
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

- Tables (conceptual): users, bank_notifications, extractions, sync_status, audit/consent_logs, email_message_dedup (hashed ids).
- No raw email body storage. Only extracted fields: bank_institution, transaction_amount, currency, transaction_type, account_info, notification_type, and minimal provenance.
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
- POST /auth/verify-reset-token - Verifies the reset token and sets a new password.
- POST /auth/reset-password - Resets the user's password.

Email (Gmail connector)
- GET  /email/get-auth — returns Google OAuth URL
- POST /email/get-token — exchanges OAuth code for tokens (tokens stored encrypted)
- GET  /email/sync-status — current sync status for user (number scanned, last sync time)
- POST /email/manual-sync — manually trigger a sync job
- GET  /email/verify-label-access?label-name={LabelName} — verifies Gmail access and that the specified label exists; stores the label to be used for subsequent syncs

Notification
- GET  /notification — get all notifications for authenticated user
- GET  /notification/:id — get specific notification by ID
- PUT  /notification/:id — mark notification as read

Account
- GET  /account — get all accounts for authenticated user
- GET  /account/:id — get specific account by ID

Category
- GET  /category — get all categories (with optional search query)
- GET  /category/:id — get specific category by ID

Transaction
- GET  /transaction — get all transactions (paginated, with search, sort, and filter options)
- GET  /transaction/account/:accountId — get transactions for specific account (paginated, with search, sort, and filter options)
- GET  /transaction/:id — get specific transaction by ID
- PUT  /transaction/:id — update transaction fields

Bank Notifications
- REST endpoints for managing/viewing extracted bank notifications (see src/subscriptions)

Swagger/OpenAPI is configured via decorators in controllers.


## Realtime sync updates (WebSocket + BullMQ/Redis)

Overview
- WebSocket: Socket.IO namespace /sync exposes realtime events to the authenticated user.
- Auth: Pass the JWT access token either via the Socket.IO auth payload (auth.token) or Authorization header (Bearer <token>).
- Rooming: On connect, the server validates the token, extracts the user id (JWT sub), and joins the socket to a private room named by that user id.
- Events: The server emits user-scoped events into that room; only sockets for that user receive them.

Events you can listen for
- connected — sent once on successful connection
- notification — initial payload of recent notifications
- sync_started — background email sync began
- sync_progress — progress updates with { progress: number }
- sync_completed — background email sync finished
- sync_failed — background email sync failed

Client example (socket.io-client)
```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/sync', {
  auth: { token: '<ACCESS_TOKEN>' },
  // or headers: { Authorization: `Bearer <ACCESS_TOKEN>` },
});

socket.on('connected', (payload) => console.log('WS connected:', payload));

socket.on('notification', (payload) => {
  console.log('Notifications:', payload.data, 'count:', payload.count);
});

socket.on('sync_started', (p) => console.log('Sync started:', p));
socket.on('sync_progress', (p) => console.log('Sync progress:', p.progress));
socket.on('sync_completed', (p) => console.log('Sync completed:', p));
socket.on('sync_failed', (p) => console.warn('Sync failed:', p));

socket.emit('notification'); // request initial notifications
```

How background jobs and Redis tie in
- Queue setup: The service registers a BullMQ queue named email-sync (see src/email/email.module.ts).
- Trigger: POST /email/manual-sync enqueues a job (name: sync-emails) with the current user's id and selected Gmail label.
- Worker: EmailWorker (src/email/email.worker.ts) processes jobs. On BullMQ worker lifecycle events (active, progress, completed, failed) it updates the database and calls NotificationService.createAndEmit(...).
- Emission: NotificationService emits via the EmailGateway into the user's private room; the gateway is attached to the /sync namespace.
- Redis: BullMQ uses Redis for job queues. Default connection is localhost:6379 (see src/common/configurations/bullmq.config.ts). Ensure Redis is running locally.

Worker lifecycle and Redis integration
1. Job enqueued: When POST /email/manual-sync is called, EmailService adds a job to the BullMQ 'email-sync' queue stored in Redis.
2. Worker picks up job: EmailWorker (@Processor('email-sync')) polls Redis and receives the job payload containing userId and labelName.
3. Job processing: The worker fetches emails from Gmail API, extracts transaction data, and saves to the database.
4. Progress updates: As the worker processes each email, it calls job.updateProgress(percent), triggering the @OnWorkerEvent('progress') handler.
5. Real-time notifications: Each worker event (active, progress, completed, failed) creates a notification record in the database and emits a WebSocket event via EmailGateway.sendToUser() to the user's private room.
6. Database sync: The worker updates the Email entity's syncStatus field (PENDING → IN_PROGRESS → COMPLETED/FAILED) at each lifecycle stage.
7. Job completion: Upon successful processing, the job result is stored in Redis, and a 'sync_completed' event is emitted to the user's WebSocket connection.

Redis configuration
- Connection: BullMQ connects to Redis using the configuration in src/common/configurations/bullmq.config.ts.
- Default: localhost:6379 (no password)
- Customization: Update the config file or use environment variables (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD) to connect to a remote Redis instance.
- Queue persistence: Jobs are persisted in Redis, allowing for retries and recovery after server restarts.

Notes
- By default, Redis host/port are configured in code. To use a different Redis instance, update src/common/configurations/bullmq.config.ts accordingly.
- User room keys are the user's numeric id as a string. Clients connect with the same JWT used for the HTTP API so the gateway can place them into the correct room.
- Ensure Redis is running before starting the application: `redis-server` or use Docker: `docker run -d -p 6379:6379 redis:alpine`


## Project structure

Core modules:
- src/app — application bootstrap, main module configuration
- src/auth — authentication system (JWT, guards, strategies, user management)
- src/account — account management (entities, DTOs, CRUD operations)
- src/transaction — transaction processing (entities, DTOs, controllers, services)
- src/category — category management for transactions
- src/bank — bank entity definitions and relationships
- src/currency — currency entities and management
- src/email — Gmail OAuth integration and email sync functionality
- src/subscriptions — bank notification subscription management
- src/tokens — password reset token handling
- src/mail — email service and templates

Infrastructure:
- src/common — shared utilities, configurations, DTOs (database config, response DTOs)
  - src/common/configurations — database and other system configurations
  - src/common/dto — shared data transfer objects (pagination, responses)
  - src/common/utils — utility functions and helpers

Testing and build:
- test — unit and e2e test files
- dist — compiled application output (ignored in development)


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
