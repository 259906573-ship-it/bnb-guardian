CREATE TABLE IF NOT EXISTS service_deliveries (
 delivery_id TEXT PRIMARY KEY,
 sub_id TEXT NOT NULL,
 subscriber TEXT NOT NULL,
 agent_id TEXT NOT NULL,
 delivered_at INTEGER NOT NULL,
 result_hash TEXT NOT NULL,
 payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS deliveries_by_sub ON service_deliveries(sub_id);
