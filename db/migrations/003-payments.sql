BEGIN;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('PENDING','PAYMENT_REVIEW','CONFIRMED','CANCELLED','EXPIRED'));
CREATE TABLE payment_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id),
  submitted_by uuid NOT NULL REFERENCES users(id),
  transfer_reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','VERIFIED','REJECTED')),
  bank_reference text UNIQUE,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE donations ADD COLUMN payment_reference text UNIQUE;
ALTER TABLE donations ADD COLUMN bank_reference text UNIQUE;
ALTER TABLE donations ADD COLUMN verified_by uuid REFERENCES users(id);
ALTER TABLE donations ADD COLUMN verified_at timestamptz;
ALTER TABLE donations ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours');
ALTER TABLE notification_outbox ADD COLUMN user_id uuid REFERENCES users(id);
ALTER TABLE notification_outbox ADD COLUMN recipient text;
ALTER TABLE notification_outbox ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX payment_claims_status_idx ON payment_claims(status,submitted_at);
CREATE INDEX notification_due_idx ON notification_outbox(next_attempt_at) WHERE status='QUEUED';
COMMIT;
