# EngineSyncConsole 1.0.0 Release Notes

Status: prepared, not tagged or published.

## Highlights

- **Deterministic core.** The simulation is now a pure, seedable step function that runs in the browser or from the command line.
- **Correctness fixes.** The simulation no longer stalls during autothrottle activity, fuel mass is conserved, and engines stop producing thrust when the tanks are empty.
- **Tested.** The project now has an automated suite with property-based and statistical tests. See `reports/tests/SUMMARY.md`.
- **Current stack.** React 19, Vite 8 and Node.js 24, with no known npm advisories at the time of the audit.
- **Hardened.** Production builds include a Content Security Policy, and CI runs with read-only permissions and pinned actions.

## Upgrade Notes

- Use Node.js 24 (`nvm use`).
- Source paths changed. See `docs/ARCHITECTURE.md`.
- Flight behavior differs slightly because of the model fixes. The default uncommanded 600 second run now ends near 340 kt instead of near 350 kt.

## Known Limitations

See the Known Limitations section of `docs/ARCHITECTURE.md`. In particular, this is an educational model and is not validated against flight data.
