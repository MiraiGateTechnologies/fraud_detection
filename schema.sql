-- Fraud confirm ticks. Ek player = ek row.
CREATE TABLE IF NOT EXISTS ticks (
  user_id   INTEGER PRIMARY KEY,
  user_code TEXT,
  name      TEXT,
  marked_by TEXT,
  marked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ticks_marked_at ON ticks(marked_at);
