# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - Unreleased

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
- Random noise accumulated into the N1 state as a random walk. Together with the discretization changes, this moves the default uncommanded 600 second run from about 350 kt to about 340 kt (mean of 20 unseeded baseline runs versus 8 seeded runs).
- The simulation updater was impure, which conflicted with React StrictMode.
- Vertical speed could remain non-zero while pinned at an altitude limit.
- Aircraft mass was floored at 220,000 lb, above the 185,000 lb empty weight.

### Security

- Resolved all 8 npm audit advisories present in the previous lockfile (5 high, 2 moderate, 1 low).

### Removed

- Empty tracked `.codex` file and unused speed estimation helpers.
