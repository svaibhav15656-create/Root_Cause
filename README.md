# RootCause

RootCause is a Node.js log-monitoring service for small teams. PostgreSQL on Neon is the required primary database. The server applies its schema at startup, using a small TLS connection pool and retrying the initial connection to allow a suspended Neon database to wake up.

## Run it with Neon

1. Create a Neon project and copy its **pooled** PostgreSQL connection string. Prefer `sslmode=verify-full` so the TLS certificate and host name are checked.
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL`. Generate `APP_ENCRYPTION_KEY` and `RATE_LIMIT_SECRET` as independent random values; commands are in the example file. Do not commit `.env`.
3. Run `npm ci` and `npm start` with Node.js 20.6 or newer.
4. Open `http://localhost:3000`, create an account with a 12+ character password, and continue to the workspace dashboard. Add an app and copy its API key. The dashboard includes account totals, a 24-hour activity chart, incident fixes and evidence, recent log events, alert settings, warning accuracy, plan status, and account deletion. The key is displayed once; rotate it if lost.

The web process must stay online for scheduled analysis and alert delivery. For production, run behind an HTTPS reverse proxy, set `HOST=0.0.0.0` and `COOKIE_SECURE=true`, use a durable secret store for environment variables, and configure health checks against `/health`. Set `TRUST_PROXY=true` only when the proxy overwrites `X-Forwarded-For`; otherwise leave it off so clients cannot spoof the rate-limit address. Use a production Neon project and backups before customers rely on the service.

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
- Instant deduplicated incidents for ERROR/FATAL logs, with redacted evidence and a rule-based explanation. Unknown signatures can use the optional OpenAI Responses API fallback; text is redacted first and sent with storage disabled. Results are cached by normalized signature.
- A database-backed analyzer runs at startup and every 60 seconds. It compares 15-minute windows for rising database latency plus retries, retry spikes, memory/GC pressure and unexpected log silence. Warnings state a likely consequence, show evidence and use cautious confidence ratings.
- Email (SMTP), Slack incoming webhooks and Telegram bot notifications, with a 30-minute per-incident/channel cooldown. Slack/Telegram credentials are encrypted using AES-256-GCM with `APP_ENCRYPTION_KEY`.
- Warning scorecard judges whether a real error followed a warning within 60 minutes and reports accuracy and average lead time.
- Account-data deletion, app deletion, one-time key display, and key rotation.
- Razorpay subscription checkout and signed webhook processing. Billing is off by default; only a verified webhook changes a tenant's plan. Browser checkout success is never trusted.
- Free explainer with known-issue matching and an optional LLM fallback. It redacts common secrets and stores only a keyed hash of the client IP and its daily count for abuse limiting; pasted text itself is not saved.
- CSP, no-store API responses, request body limits, per-IP request throttles, same-origin checks on cookie-backed writes, and security-focused response headers.

## Optional integrations

- **Email:** Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`. Email alerts go to the account email.
- **Slack/Telegram:** The user saves credentials from Workspace → Alert destinations. Slack URLs are limited to Slack's incoming-webhook host. Telegram uses the Bot API host.
- **LLM:** Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. The known-issues library is checked first; the LLM is used only for unmatched explanations.
- **Razorpay:** Create test-mode Starter and Team subscription plans, set both plan IDs and test credentials, configure a webhook at `/webhooks/razorpay`, then set `BILLING_ENABLED=true`. Subscribe to subscription activated, charged, cancelled, halted and paused events. Test the full signed-webhook flow before using live keys.

`BILLING_ENABLED=false` is the default. The Starter and Team entitlement rows are provisioned at migration time (100k/1m logs per month, 5/20 apps, 30/90-day retention). Set the matching Razorpay plan IDs before enabling checkout. No payment-card information is stored by RootCause.

## Neon schema and operations

Tables are created idempotently by `db.js`: tenants, sessions, apps, API keys, logs, log incidents, notification settings and deliveries, warning outcomes, usage counters, plans, subscriptions, payment events, explanation cache and anonymous explanation rate counts. Tenant identifiers are included in authenticated SQL filters. Keep Neon pooled connections and the server pool small; do not run multiple server copies with local ephemeral files. Scheduled work uses a PostgreSQL advisory lock so only one analyzer cycle runs across replicas.

## Security limits and launch checklist

Redaction uses common patterns and is best-effort; inspect your own log formats and never send credentials or unnecessary personal data. The local setup is for development. Before public use, review the privacy and terms pages with qualified counsel, verify Indian privacy/tax requirements, configure TLS and backups, add a trusted proxy/WAF and external alerting, rotate all secrets, test tenant isolation and payment webhooks, and arrange an independent security review. SMTP/OpenAI/Razorpay/Neon accounts and credentials are external setup requirements and are not bundled with this repository.
