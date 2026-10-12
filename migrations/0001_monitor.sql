CREATE TABLE IF NOT EXISTS monitor_state (
  name TEXT PRIMARY KEY,
  observed_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS monitored_positions (
  account TEXT PRIMARY KEY,
  observed_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
