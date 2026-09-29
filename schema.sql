-- Confirmed fraud ticks. One player = one row (keyed by the platform's numeric user ID).
CREATE TABLE IF NOT EXISTS ticks (
  user_id   INTEGER PRIMARY KEY,
  user_code TEXT,
  name      TEXT,
  marked_by TEXT,
  marked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ticks_marked_at ON ticks(marked_at);
