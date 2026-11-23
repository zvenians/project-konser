BEGIN;
ALTER TABLE notification_outbox DROP CONSTRAINT notification_outbox_status_check;
ALTER TABLE notification_outbox ADD CONSTRAINT notification_outbox_status_check CHECK(status IN ('QUEUED','SENDING','SENT','DELIVERED','READ','FAILED','DISABLED'));
ALTER TABLE notification_outbox ADD COLUMN delivered_at timestamptz;
ALTER TABLE notification_outbox ADD COLUMN read_at timestamptz;
CREATE INDEX notification_provider_id_idx ON notification_outbox(provider_id) WHERE provider_id IS NOT NULL;
COMMIT;
