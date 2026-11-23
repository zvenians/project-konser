BEGIN;
ALTER TABLE users ADD COLUMN phone text UNIQUE;
ALTER TABLE users ADD COLUMN whatsapp_consent_at timestamptz;
ALTER TABLE users ADD CONSTRAINT users_phone_e164 CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$');
ALTER TABLE notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_status_check;
ALTER TABLE notification_outbox ADD CONSTRAINT notification_outbox_status_check CHECK (status IN ('QUEUED','SENDING','SENT','FAILED','DISABLED'));
ALTER TABLE notification_outbox ADD COLUMN locked_at timestamptz;
COMMIT;
