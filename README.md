# RootCause

RootCause is a Node.js log-monitoring service for small teams. PostgreSQL on Neon is the required primary database. The server applies its schema at startup, using a small TLS connection pool and retrying the initial connection to allow a suspended Neon database to wake up.

## Run it with Neon

1. Create a Neon project and copy its **pooled** PostgreSQL connection string. Prefer `sslmode=verify-full` so the TLS certificate and host name are checked.
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL`. Generate `APP_ENCRYPTION_KEY` and `RATE_LIMIT_SECRET` as independent random values; commands are in the example file. Do not commit `.env`.
3. Run `npm ci` and `npm start` with Node.js 20.6 or newer.
4. Open `http://localhost:3000`, create an account with a 12+ character password, and continue to the workspace dashboard. Add an app and copy its API key. The dashboard includes account totals, a 24-hour activity chart, incident fixes and evidence, recent log events, alert settings, warning accuracy, plan status, and account deletion. The key is displayed once; rotate it if lost.

The web process must stay online for scheduled analysis and alert delivery. For production, run behind an HTTPS reverse proxy, set `HOST=0.0.0.0` and `COOKIE_SECURE=true`, use a durable secret store for environment variables, and configure health checks against `/health`. Set `TRUST_PROXY=true` only when the proxy overwrites `X-Forwarded-For`; otherwise leave it off so clients cannot spoof the rate-limit address. Use a production Neon project and backups before customers rely on the service.

## Deploy with Docker

Build the image with `docker build -t rootcause .`. Run it on an always-on host that provides the environment variables from `.env.example` through its secret manager. The image listens on port `3000`, binds to `0.0.0.0`, and includes a `/health` container check. Terminate HTTPS at the host's trusted proxy and set `COOKIE_SECURE=true`; only set `TRUST_PROXY=true` when that proxy replaces `X-Forwarded-For`. Configure the host's health probe to use `/health`, and keep one production Neon URL and stable encryption/rate-limit secrets across restarts. Do not bake `.env` or provider credentials into the image.

For a local container smoke run, make a private environment file outside source control and pass it to Docker with `--env-file`; do not use the development `.env` defaults for an internet-facing deployment.

## Send logs

The public `/integrations.html` guide includes HTTP, Vector, Fluent Bit and Node/Python examples. The HTTP endpoint accepts both JSON batches and newline-delimited JSON records.

```sh
curl -X POST http://localhost:3000/v1/logs \
  -H "Authorization: Bearer rc_live_YOUR_PRIVATE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"logs":[{"timestamp":"2026-10-18T10:00:05Z","level":"WARN","service":"orders-service","message":"Database operation took 900 ms","durationMs":900}]}'
```

The API accepts 1–100 events per batch. Supported levels are TRACE, DEBUG, INFO, WARN, ERROR and FATAL. It normalizes timestamps, services, status codes and durations, redacts common credentials and email addresses, enforces per-plan monthly limits, groups repeated errors, and retains logs for the plan's retention period. Apps have a dashboard “Send test log” action.

## Features

- Sign-up and login with salted `scrypt` password hashes and HTTP-only, SameSite Lax session cookies.
- Tenant-scoped Neon queries for accounts, apps, keys, logs, incidents, notification settings, usage and billing records.
- App keys are high-entropy random values stored only as SHA-256 hashes. Keys can be revoked by rotating them.
- Instant deduplicated incidents for ERROR/FATAL logs, with redacted evidence and a rule-based explanation. Unknown signatures can use the optional Groq or OpenAI Responses API fallback; RootCause redacts text first and asks the provider not to store the request. Results are cached by normalized signature.
- A database-backed analyzer runs at startup and every 60 seconds. It compares 15-minute windows for rising database latency plus retries, retry spikes, memory/GC pressure and unexpected log silence. Warnings state a likely consequence, show evidence and use cautious confidence ratings.
- Email through SMTP or the HTTPS Resend API, Slack incoming webhooks and Telegram bot notifications, with a 30-minute per-incident/channel cooldown. Slack/Telegram credentials are encrypted using AES-256-GCM with `APP_ENCRYPTION_KEY`. Workspace settings include a dedicated email test and a test-alert action for configured channels.
- Warning scorecard judges whether a real error followed a warning within 60 minutes and reports accuracy and average lead time.
- Account-data deletion, app deletion, one-time key display, and key rotation.
- Razorpay subscription checkout and signed webhook processing. Billing is off by default; only a verified webhook changes a tenant's plan. Browser checkout success is never trusted.
- Free explainer with known-issue matching and an optional LLM fallback. It redacts common secrets and stores only a keyed hash of the client IP and its daily count for abuse limiting; pasted text itself is not saved.
- CSP, no-store API responses, request body limits, per-IP request throttles, same-origin checks on cookie-backed writes, and security-focused response headers.

## Optional integrations

- **Email:** Configure SMTP with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`, or configure `RESEND_API_KEY` and `EMAIL_FROM` for the HTTPS Resend API. The HTTPS API is suitable for Render Free instances, which block outbound SMTP ports. Resend's `onboarding@resend.dev` sender is for owner-only testing; sending to RootCause users requires a verified sending domain. Email alerts go to the account email.
- **Slack/Telegram:** The user saves credentials from Workspace → Alert destinations. Slack URLs are limited to Slack's incoming-webhook host. Telegram uses the Bot API host.
- **AI explanations:** Set `GROQ_API_KEY` (optionally `GROQ_MODEL`, default `openai/gpt-oss-20b`) or `OPENAI_API_KEY` (optionally `OPENAI_MODEL`, default `gpt-4.1-mini`). If both are set, Groq is used. Known patterns are explained locally; the configured provider is called only for unmatched logs. The API key stays on the server. Review the provider's free-tier limits and data-use terms before sending real user logs; redaction is best-effort.
- **Razorpay:** RootCause's current paid subscription is Plus at ₹199/month (the internal plan code is `team`). Create a matching monthly plan in Razorpay Test Mode, then set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID_TEAM` and a strong `RAZORPAY_WEBHOOK_SECRET`. Configure `https://YOUR_PUBLIC_DOMAIN/api/razorpay/webhook` as the webhook URL and subscribe to `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.completed`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.paused` and `subscription.resumed`. Keep `BILLING_ENABLED=false` in production until the complete test-mode flow and product readiness are confirmed. To test locally, enable billing with test credentials and the matching test plan ID. The server checks Checkout's payment signature; only a verified Razorpay webhook changes paid access. Do not put the key secret or webhook secret in browser code. Prime is not purchasable through this recurring subscription flow.

`BILLING_ENABLED=false` is the default. Checkout remains unavailable until the Plus plan ID and all required credentials are configured. Subscription IDs and status are stored in Neon; payment-card data is handled by Razorpay and is not stored by RootCause.

## Neon schema and operations

Tables are created idempotently by `db.js`: tenants, sessions, apps, API keys, logs, log incidents, notification settings and deliveries, warning outcomes, usage counters, plans, subscriptions, payment events, explanation cache and anonymous explanation rate counts. Tenant identifiers are included in authenticated SQL filters. Keep Neon pooled connections and the server pool small; do not run multiple server copies with local ephemeral files. Scheduled work uses a PostgreSQL advisory lock so only one analyzer cycle runs across replicas.

## Security limits and launch checklist

Redaction uses common patterns and is best-effort; inspect your own log formats and never send credentials or unnecessary personal data. The local setup is for development. Before public use, review the privacy and terms pages with qualified counsel, verify Indian privacy/tax requirements, configure TLS and backups, add a trusted proxy/WAF and external alerting, rotate all secrets, test tenant isolation and payment webhooks, and arrange an independent security review. SMTP/AI-provider/Razorpay/Neon accounts and credentials are external setup requirements and are not bundled with this repository.

- Password recovery uses single-use, 30-minute tokens, revokes existing sessions on success, and requires the configured SMTP service. Set APP_BASE_URL to the canonical HTTPS site origin in production. The recovery response does not disclose whether an email address has an account.
