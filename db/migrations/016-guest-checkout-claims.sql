BEGIN;

ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_phone text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_email text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_token_hash text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_buyer_phone_idx ON orders(buyer_phone) WHERE buyer_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_buyer_email_idx ON orders(lower(buyer_email)) WHERE buyer_email IS NOT NULL;

ALTER TABLE stream_entitlements ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE stream_viewer_sessions ALTER COLUMN user_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stream_entitlements_order_event_unique ON stream_entitlements(order_id,event_id);

CREATE TABLE IF NOT EXISTS claim_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_hash text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('WHATSAPP','EMAIL')),
  scope text NOT NULL CHECK (scope IN ('TICKET','LIVESTREAM')),
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claim_otps_lookup_idx ON claim_otps(destination_hash,channel,scope,created_at DESC);

CREATE TABLE IF NOT EXISTS claim_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  destination_hash text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('TICKET','LIVESTREAM')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  order_id uuid NOT NULL REFERENCES orders(id),
  amount bigint NOT NULL,
  status text NOT NULL,
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,provider_event_id)
);

CREATE TABLE IF NOT EXISTS delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  channel text NOT NULL CHECK (channel IN ('WHATSAPP','EMAIL')),
  kind text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','DELIVERED','FAILED','SIMULATED')),
  attempts integer NOT NULL DEFAULT 0,
  provider_reference text,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,channel,kind,recipient)
);

COMMIT;
