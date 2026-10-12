CREATE TABLE IF NOT EXISTS request_limits (
  ip_hash TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (ip_hash,bucket)
);
