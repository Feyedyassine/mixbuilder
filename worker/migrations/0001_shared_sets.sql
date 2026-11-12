-- Shared sets behind "Share" links. Rows are immutable snapshots; links never
-- expire. payload is the validated SharedSet JSON (src/share/schema.ts).
CREATE TABLE shared_sets (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  views INTEGER NOT NULL DEFAULT 0
);
