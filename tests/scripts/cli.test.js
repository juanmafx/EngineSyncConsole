import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const simulatePath = fileURLToPath(new URL('../../scripts/simulate.js', import.meta.url));
const reportWriterPath = fileURLToPath(new URL('../../scripts/write-test-report.js', import.meta.url));

const simulate = (...args) => spawnSync(process.execPath, [simulatePath, ...args], { encoding: 'utf8' });

describe('scripts/simulate.js', () => {
  it('produces identical output for identical arguments', () => {
    const first = simulate('--seed', '7', '--duration', '5');
    const second = simulate('--seed', '7', '--duration', '5');
    expect(first.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
    expect(JSON.parse(first.stdout).tickCount).toBe(10);
  });

  it('accepts the shortest duration that runs one tick', () => {
    const result = simulate('--duration', '0.5');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).tickCount).toBe(1);
  });

  it.each([
    ['--duration', '0.1'],
    ['--duration', '86401'],
    ['--duration', 'NaN'],
    ['--seed', 'abc'],
    ['--seed', '-1'],
    ['--target-speed', '179'],
    ['--unknown', '1'],
  ])('rejects %s %s without a stack trace', (flag, value) => {
    const result = simulate(flag, value);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toMatch(/^\s+at /m);
  });
});

describe('scripts/write-test-report.js', () => {
  let directory;

  const writeResults = (overrides) => {
    const results = {
      success: true,
      numTotalTests: 1,
      numPassedTests: 1,
      numFailedTests: 0,
      numPendingTests: 0,
      numFailedTestSuites: 0,
      testResults: [{ name: 'tests/a.test.js', assertionResults: [{ status: 'passed' }] }],
      ...overrides,
    };
    writeFileSync(join(directory, 'reports/tests/results.json'), JSON.stringify(results));
    writeFileSync(join(directory, 'reports/tests/junit.xml'), '<testsuites hostname="machine"/>');
  };

  const writeReport = () => spawnSync(process.execPath, [reportWriterPath], { cwd: directory, encoding: 'utf8' });
  const summary = () => readFileSync(join(directory, 'reports/tests/SUMMARY.md'), 'utf8');

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'engine-sync-report-'));
    mkdirSync(join(directory, 'reports/tests'), { recursive: true });
  });

  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it('reports a passing run', () => {
    writeResults({});
    expect(writeReport().status).toBe(0);
    expect(summary()).toContain('- Result: PASS');
  });

  it('fails when a suite cannot load even though no test failed', () => {
    writeResults({ success: false, numFailedTestSuites: 1 });
    expect(writeReport().status).toBe(1);
    expect(summary()).toContain('- Failed suites: 1');
    expect(summary()).toContain('- Result: FAIL');
  });

  it('fails when a test failed', () => {
    writeResults({ success: false, numPassedTests: 0, numFailedTests: 1 });
    expect(writeReport().status).toBe(1);
    expect(summary()).toContain('- Result: FAIL');
  });

  it('fails instead of reusing results that are missing', () => {
    expect(writeReport().status).not.toBe(0);
  });

  it('removes the machine hostname from the report', () => {
    writeResults({});
    writeReport();
    expect(readFileSync(join(directory, 'reports/tests/junit.xml'), 'utf8')).toContain('hostname="redacted"');
  });
});
