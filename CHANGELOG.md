# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-11-24

### Changed

- Documentation corrections: release notes, changelog, and security audit now reflect the published 1.0.0 release and the rewritten repository history. No code behaviour change.

## [1.0.0] - 2026-11-24

### Added

- Pure, seedable simulation core with a headless scenario runner (`npm run simulate`).
- Reproducible browser runs through the `?seed=` query parameter.
- International Standard Atmosphere model.
- Automated test suite with property-based, statistical, schema and UI tests, plus a committed test report.
- Optional SQLite schema for run results.
- CI workflow, ESLint, architecture documentation, security policy and audit.
- Content Security Policy in production builds.

### Changed

- **Breaking:** requires Node.js 24.
- **Breaking:** source reorganized into `app`, `domain`, `features`, `infrastructure` and `ui`.
- Upgraded to React 19 and Vite 8, with all dependencies pinned to exact versions.
- Spool, vertical speed and crossfeed dynamics now use exact first-order discretization.
- Telemetry density now comes from the International Standard Atmosphere instead of an exponential approximation.
- Alert thresholds are centralized, and the caution count now uses the documented 35 psi low oil limit instead of 34 psi.
- Audio event logging is limited to development builds.
- Buttons and tabs expose ARIA state.

### Fixed

- The simulation stalled while the autothrottle was slewing, because each throttle update restarted the tick timer.
- Fuel burn could exceed the fuel remaining, and engines kept producing thrust with empty tanks.
- Random noise accumulated into the N1 state as a random walk. The default uncommanded 600 second run shows no measurable change in mean final speed: 344.6 kt before and 344.3 kt after, each over 200 runs with a standard deviation of about 11 kt.
- The simulation updater was impure, which conflicted with React StrictMode.
- Vertical speed could remain non-zero while pinned at an altitude limit.
- Aircraft mass was floored at 220,000 lb, above the 185,000 lb empty weight.
- `npm run test:report` could report success after a test suite failed to load, or reuse stale results.
- `npm run simulate` accepted durations too short to run a tick and printed a stack trace on malformed arguments.

### Security

- Resolved all 8 npm audit advisories present in the previous lockfile (5 high, 2 moderate, 1 low).
- Removed the unused `blob:` source from the Content Security Policy.

### Removed

- Empty tracked `.codex` file and unused speed estimation helpers.
