-- Internal bookkeeping never proves payment or unlocks delivery.
ALTER TABLE output_orders ADD COLUMN intake_key TEXT;
CREATE UNIQUE INDEX output_intake_key ON output_orders(intake_key) WHERE intake_key IS NOT NULL;
CREATE TABLE treasury_destination (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  destination TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE treasury_releases (
  release_id TEXT PRIMARY KEY,
  amount_atomic INTEGER NOT NULL CHECK(amount_atomic > 0),
  destination TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
