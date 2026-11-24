# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| 1.x | Yes |
| Below 1.0 | No |

## Reporting a Vulnerability

Do not post vulnerability details in a public issue. Private vulnerability reporting is not currently enabled on this repository, so open a GitHub issue that only asks the maintainer for a private contact channel, and share the details there.

Include the affected version, reproduction steps, and the expected impact. This is a personal project maintained on a best-effort basis, so no response time is guaranteed.

## Scope

EngineSyncConsole is a static client-side application with no accounts, server, database connection, or secrets. The most relevant reports concern script injection in the built application, vulnerable dependencies, and the CI supply chain.

This software is an educational simulation. Its outputs are not safety data.

## Deployment Guidance

Static hosts should send these response headers, because a `<meta>` Content Security Policy cannot set `frame-ancestors`:

```text
Content-Security-Policy: frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
```
