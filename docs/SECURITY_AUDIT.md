# Security Audit

- **Date:** 2026-11-23
- **Version audited:** 1.0.0 (branch `modernize/2026`)
- **Type:** automated scans plus manual source review. This is not an independent penetration test.

## Attack Surface

EngineSyncConsole is a static single-page application. It has no backend, authentication, forms, cookies, browser storage, third-party requests, or secrets. Its only external input is the optional `seed` query parameter. The command-line simulator accepts local arguments only.

## Checks Performed

| Check | Method | Result |
| --- | --- | --- |
| Dependency advisories | `npm audit` on the full tree | 8 before (5 high, 2 moderate, 1 low), 0 after |
| Secrets in the tree and history | `gitleaks` 8.30.1 with `--redact` across the 15 commits of the pre-modernization history and the working tree | No findings. On 2026-11-24 the published history was rewritten to keep only the 2026 modernization commits |
| Lockfile integrity | All 230 packages resolve to `registry.npmjs.org` with integrity hashes | No exceptions |
| CI action pins | `actions/checkout` v7.0.1 and `actions/setup-node` v7.1.0 tags compared with the pinned commit hashes | Match |
| Dangerous sinks (`eval`, `new Function`, `innerHTML`, `dangerouslySetInnerHTML`, `document.write`) | Source search and ESLint rules | None |
| Browser storage and network calls in source | Source search | None |
| Tracked dependencies and build output | `git ls-files` | None |
| Tracked private keys | `gitleaks` and pattern search | None |
| Content Security Policy | Production build loaded in headless Chrome | Application and audio load with no violations |
| Lifecycle scripts | Installs use `--ignore-scripts` | Disabled |

## Findings and Remediation

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| SA-01 | High | Vulnerable transitive build tooling in the previous lockfile | Fixed by upgrading to Vite 8 and regenerating the lockfile |
| SA-02 | Medium | No Content Security Policy | Fixed in production builds |
| SA-03 | Low | Query parameter would be an unvalidated input | Fixed: `seed` is parsed against a strict unsigned 32-bit format |
| SA-04 | Low | Verbose audio event logging in production | Fixed: limited to development builds |
| SA-05 | Low | No CI supply-chain controls | Fixed: read-only token, actions pinned to commit hashes, exact dependency versions |
| SA-06 | Low | Clickjacking protection requires a response header that a static bundle cannot set | Open: depends on the hosting platform, see `SECURITY.md` |
| SA-07 | Low | Content Security Policy allowed `blob:` media, which the application does not use | Fixed: removed |
| SA-08 | Low | Private vulnerability reporting is disabled on the repository | Open: requires a repository setting, see `SECURITY.md` |
| SA-09 | Low | The test report could show a pass after a suite failed to load, or reuse stale results | Fixed: the report and exit code now fail, with regression tests |

## Not Applicable

Two-factor authentication, password hashing, CSRF protection, SQL injection defenses, and data-at-rest encryption do not apply because the application has no accounts, server, state-changing requests, or database connection. The optional schema in `db/schema.sql` is not used by the application.

## Non-Security Notes

The PRNG (Mulberry32) is intentionally non-cryptographic and is used only for simulation noise. The fallback browser seed comes from `crypto.getRandomValues`.

The license and origin of the audio assets are undocumented. This is a compliance question rather than a vulnerability and is noted in the README.
