const { Pool } = require('pg');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Create a Neon project and copy its pooled connection string into .env.');
if (!/[?&]sslmode=(?:verify-full|require)(?:&|$)/i.test(process.env.DATABASE_URL)) throw new Error('DATABASE_URL must include sslmode=verify-full for Neon TLS.');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000, ssl: { rejectUnauthorized: true }, application_name: 'rootcause' });
pool.on('error', error => console.error('PostgreSQL idle client error:', error.message));

const schema = `
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
  salt text NOT NULL, password_hash text NOT NULL, plan text NOT NULL DEFAULT 'starter',
  phone text, avatar_data text, github_id text, github_username text, github_token_enc text,
  totp_enabled boolean NOT NULL DEFAULT false, totp_secret_enc text, totp_pending_enc text,
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS avatar_data text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS github_id text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS github_username text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS github_token_enc text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS totp_secret_enc text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS totp_pending_enc text;
CREATE TABLE IF NOT EXISTS github_oauth_states (
  state_hash text PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_tenant_idx ON sessions(tenant_id);
CREATE TABLE IF NOT EXISTS login_challenges (
  token_hash text PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_challenges_tenant_idx ON login_challenges(tenant_id);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash text PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tenant_idx ON password_reset_tokens(tenant_id);
CREATE TABLE IF NOT EXISTS apps (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), last_seen timestamptz,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS apps_tenant_idx ON apps(tenant_id);
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_id uuid NOT NULL REFERENCES apps(id) ON DELETE CASCADE, key_hash text NOT NULL UNIQUE,
  prefix text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS api_keys_app_idx ON api_keys(app_id) WHERE revoked_at IS NULL;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_four text NOT NULL DEFAULT '????';
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_one_active_per_app_idx ON api_keys(app_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS logs (
  id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_id uuid NOT NULL REFERENCES apps(id) ON DELETE CASCADE, event_at timestamptz NOT NULL,
  level text NOT NULL, service text NOT NULL, message text NOT NULL, template_id text,
  status_code integer, duration_ms integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS logs_tenant_time_idx ON logs(tenant_id,event_at DESC);
CREATE INDEX IF NOT EXISTS logs_app_time_idx ON logs(app_id,event_at DESC);
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_id uuid NOT NULL REFERENCES apps(id) ON DELETE CASCADE, type text NOT NULL CHECK(type IN ('error','warning')),
  pattern_code text NOT NULL, signature text NOT NULL, severity text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','ignored')),
  title text NOT NULL, cause text NOT NULL, steps jsonb NOT NULL DEFAULT '[]', confidence text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
  last_notified_at timestamptz
);
CREATE INDEX IF NOT EXISTS incidents_tenant_time_idx ON incidents(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS incidents_app_open_idx ON incidents(app_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS notification_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true, slack_webhook_enc text,
  telegram_token_enc text, telegram_chat_enc text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  channel text NOT NULL, sent_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL,
  error text, dedupe_key text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS warning_outcomes (
  incident_id uuid PRIMARY KEY REFERENCES incidents(id) ON DELETE CASCADE,
  followed_by_real_error boolean, lead_time_minutes integer, judged_at timestamptz
);
CREATE TABLE IF NOT EXISTS usage_counters (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, month date NOT NULL,
  log_count bigint NOT NULL DEFAULT 0, explanation_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY(tenant_id,month)
);
CREATE TABLE IF NOT EXISTS anonymous_explanation_usage (
  client_hash text NOT NULL, usage_date date NOT NULL, explanation_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY(client_hash,usage_date)
);
CREATE TABLE IF NOT EXISTS plans (
  code text PRIMARY KEY, price_inr integer NOT NULL, log_limit bigint NOT NULL,
  app_limit integer NOT NULL, explanation_limit integer NOT NULL, retention_days integer NOT NULL
);
INSERT INTO plans(code,price_inr,log_limit,app_limit,explanation_limit,retention_days) VALUES
 ('starter',0,10,5,10,30), ('team',199,50,20,100,90)
ON CONFLICT(code) DO UPDATE SET price_inr=EXCLUDED.price_inr,log_limit=EXCLUDED.log_limit;
CREATE TABLE IF NOT EXISTS subscriptions (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  razorpay_subscription_id text UNIQUE, status text NOT NULL DEFAULT 'trialing',
  plan_code text NOT NULL REFERENCES plans(code), current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payment_events (
  razorpay_event_id text PRIMARY KEY, event_type text NOT NULL, payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS explanation_cache (
  signature text PRIMARY KEY, explanation jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notification_interests (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
`;

async function initialize() {
  let last;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try { await pool.query('SELECT 1'); await pool.query(schema); return; }
    catch (error) { last = error; if (attempt < 6) await new Promise(r => setTimeout(r, Math.min(1000 * attempt, 5000))); }
  }
  throw new Error(`Could not connect to Neon after retries: ${last.message}`);
}
async function transaction(work) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
module.exports = { pool, initialize, transaction };
