BEGIN;
CREATE TABLE bank_receipts (
  bank_reference text PRIMARY KEY,
  amount bigint NOT NULL CHECK(amount>0),
  source_type text NOT NULL CHECK(source_type IN ('ORDER','DONATION')),
  source_id uuid NOT NULL UNIQUE,
  recorded_by uuid NOT NULL REFERENCES users(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
