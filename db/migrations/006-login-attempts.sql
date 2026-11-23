BEGIN;
CREATE TABLE login_attempts (
  email text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
COMMIT;
