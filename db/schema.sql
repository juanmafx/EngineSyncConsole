-- Optional SQLite schema for persisting headless simulation runs.
-- The console itself does not read or write a database.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS simulation_runs (
  id INTEGER PRIMARY KEY,
  seed INTEGER NOT NULL CHECK (seed BETWEEN 0 AND 4294967295),
  model_version TEXT NOT NULL,
  tick_seconds REAL NOT NULL CHECK (tick_seconds > 0),
  duration_seconds REAL NOT NULL CHECK (duration_seconds > 0),
  controls_json TEXT NOT NULL CHECK (json_valid(controls_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (seed, model_version, tick_seconds, duration_seconds, controls_json)
);

CREATE TABLE IF NOT EXISTS run_samples (
  run_id INTEGER NOT NULL REFERENCES simulation_runs (id) ON DELETE CASCADE,
  tick INTEGER NOT NULL CHECK (tick >= 0),
  airspeed_kt REAL NOT NULL CHECK (airspeed_kt >= 0),
  altitude_ft REAL NOT NULL CHECK (altitude_ft >= 0),
  vertical_speed_fpm REAL NOT NULL,
  heading_deg REAL NOT NULL CHECK (heading_deg >= 0 AND heading_deg < 360),
  total_fuel_flow_lb_per_hour REAL NOT NULL CHECK (total_fuel_flow_lb_per_hour >= 0),
  fuel_remaining_lb REAL NOT NULL CHECK (fuel_remaining_lb >= 0),
  PRIMARY KEY (run_id, tick)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS run_engine_samples (
  run_id INTEGER NOT NULL,
  tick INTEGER NOT NULL,
  engine_number INTEGER NOT NULL CHECK (engine_number BETWEEN 1 AND 8),
  n1_pct REAL NOT NULL CHECK (n1_pct BETWEEN 0 AND 100),
  n2_pct REAL NOT NULL CHECK (n2_pct BETWEEN 0 AND 100),
  egt_c REAL NOT NULL,
  oil_pressure_psi REAL NOT NULL CHECK (oil_pressure_psi >= 0),
  oil_temperature_c REAL NOT NULL,
  fuel_flow_lb_per_hour REAL NOT NULL CHECK (fuel_flow_lb_per_hour >= 0),
  thrust_lbf REAL NOT NULL CHECK (thrust_lbf >= 0),
  PRIMARY KEY (run_id, tick, engine_number),
  FOREIGN KEY (run_id, tick) REFERENCES run_samples (run_id, tick) ON DELETE CASCADE
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS run_alert_events (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES simulation_runs (id) ON DELETE CASCADE,
  tick INTEGER NOT NULL CHECK (tick >= 0),
  alert_key TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('warning', 'caution')),
  transition TEXT NOT NULL CHECK (transition IN ('raised', 'cleared'))
);

CREATE INDEX IF NOT EXISTS idx_run_alert_events_run_tick ON run_alert_events (run_id, tick);
CREATE INDEX IF NOT EXISTS idx_run_alert_events_key ON run_alert_events (alert_key, level);
