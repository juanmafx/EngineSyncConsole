import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
const schema = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8');

const insertRun = (database, seed = 42) =>
  database
    .prepare(
      `INSERT INTO simulation_runs (seed, model_version, tick_seconds, duration_seconds, controls_json)
       VALUES (?, '1.0.0', 0.5, 60, '{}')`,
    )
    .run(seed).lastInsertRowid;

const insertSample = (database, runId, tick = 0) =>
  database
    .prepare('INSERT INTO run_samples VALUES (?, ?, 440, 34000, 0, 90, 30000, 300000)')
    .run(runId, tick);

describe('db/schema.sql', () => {
  let database;

  beforeEach(() => {
    database = new DatabaseSync(':memory:');
    database.exec(schema);
  });

  afterEach(() => database.close());

  it('creates every table', () => {
    const names = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name);
    expect(names).toEqual(['run_alert_events', 'run_engine_samples', 'run_samples', 'simulation_runs']);
  });

  it('is idempotent', () => {
    expect(() => database.exec(schema)).not.toThrow();
  });

  it('rejects an out-of-range seed', () => {
    expect(() => insertRun(database, 4294967296)).toThrow();
  });

  it('rejects malformed controls JSON', () => {
    expect(() =>
      database
        .prepare(
          `INSERT INTO simulation_runs (seed, model_version, tick_seconds, duration_seconds, controls_json)
           VALUES (1, '1.0.0', 0.5, 60, 'not-json')`,
        )
        .run(),
    ).toThrow();
  });

  it('enforces engine numbering and sample references', () => {
    const runId = insertRun(database);
    insertSample(database, runId);
    const insertEngine = database.prepare('INSERT INTO run_engine_samples VALUES (?, ?, ?, 80, 90, 600, 50, 100, 4000, 9000)');
    expect(() => insertEngine.run(runId, 0, 9)).toThrow();
    expect(() => insertEngine.run(runId, 5, 1)).toThrow();
    expect(() => insertEngine.run(runId, 0, 1)).not.toThrow();
  });

  it('cascades deletes from a run', () => {
    const runId = insertRun(database);
    insertSample(database, runId);
    database.prepare('INSERT INTO run_engine_samples VALUES (?, 0, 1, 80, 90, 600, 50, 100, 4000, 9000)').run(runId);
    database
      .prepare("INSERT INTO run_alert_events (run_id, tick, alert_key, level, transition) VALUES (?, 0, 'egt_high', 'caution', 'raised')")
      .run(runId);
    database.prepare('DELETE FROM simulation_runs WHERE id = ?').run(runId);
    for (const table of ['run_samples', 'run_engine_samples', 'run_alert_events']) {
      expect(database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total).toBe(0);
    }
  });
});
