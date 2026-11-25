BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_url text;

ALTER TABLE payment_events DROP CONSTRAINT IF EXISTS payment_events_provider_provider_event_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_transition_unique
  ON payment_events(provider,provider_event_id,status,payload_hash);

CREATE TABLE IF NOT EXISTS ticket_download_tokens (
  token_hash text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES ticket_inventory(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_download_tokens_order_idx ON ticket_download_tokens(order_id,expires_at);

CREATE TABLE IF NOT EXISTS claim_rate_limits (
  key_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stream_viewer_sessions ADD COLUMN IF NOT EXISTS claim_session_id uuid REFERENCES claim_sessions(id) ON DELETE SET NULL;
ALTER TABLE claim_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

COMMIT;
