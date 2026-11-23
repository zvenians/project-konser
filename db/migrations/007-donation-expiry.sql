BEGIN;
ALTER TABLE donations DROP CONSTRAINT donations_status_check;
ALTER TABLE donations ADD CONSTRAINT donations_status_check CHECK(status IN ('PENDING','VERIFIED','REJECTED','EXPIRED'));
CREATE INDEX donations_pending_expiry ON donations(expires_at) WHERE status='PENDING';
COMMIT;
