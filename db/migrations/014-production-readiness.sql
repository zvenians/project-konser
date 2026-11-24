BEGIN;

ALTER TABLE ticket_classes ADD COLUMN IF NOT EXISTS sales_target integer;
ALTER TABLE ticket_classes ADD COLUMN IF NOT EXISTS purchase_limit integer;

UPDATE ticket_classes
SET purchase_limit=coalesce(purchase_limit,capacity)
WHERE mode='LIVESTREAM';

ALTER TABLE ticket_classes DROP CONSTRAINT IF EXISTS ticket_classes_purchase_limit_check;
ALTER TABLE ticket_classes ADD CONSTRAINT ticket_classes_purchase_limit_check
  CHECK (purchase_limit IS NULL OR purchase_limit>0);

ALTER TABLE ticket_classes DROP CONSTRAINT IF EXISTS ticket_classes_sales_target_check;
ALTER TABLE ticket_classes ADD CONSTRAINT ticket_classes_sales_target_check
  CHECK (sales_target IS NULL OR sales_target>0);

ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_official_tier_check;
ALTER TABLE donations ADD CONSTRAINT donations_official_tier_check CHECK (
  contribution_tier IS NULL OR
  (contribution_tier='Pilar Iman' AND amount=2000000) OR
  (contribution_tier='Sahabat Pembangunan' AND amount=1000000) OR
  (contribution_tier='Tangan Kasih' AND amount=750000) OR
  (contribution_tier='Iman yang Membangun' AND amount=500000) OR
  (contribution_tier='Benih Berkat' AND amount=250000) OR
  (contribution_tier='Semangat Membangun' AND amount=100000)
);

CREATE INDEX IF NOT EXISTS orders_environment_status_created
  ON orders(is_demo,status,created_at DESC);
CREATE INDEX IF NOT EXISTS donations_environment_status_created
  ON donations(is_demo,status,created_at DESC);

COMMIT;
