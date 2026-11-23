BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS demo_historical boolean NOT NULL DEFAULT false;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS demo_historical boolean NOT NULL DEFAULT false;
ALTER TABLE ticket_inventory ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS demo_message jsonb;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (
  status IN ('PENDING','PAYMENT_REVIEW','CONFIRMED','CANCELLED','EXPIRED','FAILED')
);

ALTER TABLE notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_status_check;
ALTER TABLE notification_outbox ADD CONSTRAINT notification_outbox_status_check CHECK (
  status IN ('QUEUED','SENDING','SENT','DELIVERED','READ','FAILED','DISABLED','SIMULATED_DELIVERED')
);

CREATE TABLE IF NOT EXISTS demo_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id),
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS','FAILED','CANCELLED')),
  receipt_label text NOT NULL DEFAULT 'SIMULATED',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demo_inventory_class_status
  ON ticket_inventory(class_id,status) WHERE is_demo=true;
CREATE INDEX IF NOT EXISTS demo_orders_user_created
  ON orders(user_id,created_at DESC) WHERE is_demo=true;
CREATE INDEX IF NOT EXISTS demo_donations_created
  ON donations(created_at DESC) WHERE is_demo=true;

COMMIT;
