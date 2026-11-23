BEGIN;
CREATE TABLE ticket_checkins (
  ticket_id uuid PRIMARY KEY REFERENCES ticket_inventory(id),
  checked_in_by uuid NOT NULL REFERENCES users(id),
  checked_in_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_inventory_barcode_idx ON ticket_inventory(barcode) WHERE barcode IS NOT NULL;
COMMIT;
