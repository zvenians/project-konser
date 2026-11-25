BEGIN;

ALTER TABLE stream_entitlements ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE stream_entitlements ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES users(id);

CREATE TABLE IF NOT EXISTS stream_viewer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id uuid NOT NULL REFERENCES stream_entitlements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS stream_viewer_sessions_active_user
  ON stream_viewer_sessions(user_id,event_id,last_heartbeat DESC) WHERE active=true;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (
  status IN ('PENDING','PAYMENT_REVIEW','CONFIRMED','CANCELLED','EXPIRED','FAILED','REFUNDED')
);
CREATE OR REPLACE FUNCTION revoke_stream_access_for_order() RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('CANCELLED','EXPIRED','FAILED','REFUNDED') THEN
    UPDATE stream_entitlements SET active=false,revoked_at=coalesce(revoked_at,now()) WHERE order_id=NEW.id;
    UPDATE stream_viewer_sessions SET active=false,ended_at=now()
      WHERE entitlement_id IN (SELECT id FROM stream_entitlements WHERE order_id=NEW.id) AND active=true;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS orders_revoke_stream_access ON orders;
CREATE TRIGGER orders_revoke_stream_access AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION revoke_stream_access_for_order();

UPDATE ticket_classes SET sales_target=CASE name
  WHEN 'Simfoni Iman' THEN 50 WHEN 'Simfoni Agung' THEN 100
  WHEN 'Simfoni Harapan' THEN 50 WHEN 'Simfoni Pujian' THEN 500
  WHEN 'Simfoni Syukur' THEN 1000 WHEN 'Simfoni Kasih' THEN 5000
  WHEN 'Simfoni Setia' THEN 3000 END,
  purchase_limit=NULL, capacity=NULL
WHERE mode='LIVESTREAM';

INSERT INTO site_settings(key,value) VALUES ('stream', '{
  "provider":"simulation","state":"NOT_STARTED","viewerAccess":false,
  "sessionLimit":1,"scheduledStart":"2027-02-07T19:00:00+07:00",
  "scheduledEnd":"2027-02-07T22:00:00+07:00","maintenanceMessage":"",
  "targetsPendingConfirmation":true
}'::jsonb) ON CONFLICT(key) DO NOTHING;

COMMIT;
