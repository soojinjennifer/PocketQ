---
name: test-commands
description: Correct root-level commands to run the PocketQ (WhyMath repo) automated verification gate
metadata:
  type: project
---

Root `package.json` scripts (pnpm workspace) fan out to `shared-types`, `validation`, `api`, `web`:

```
pnpm typecheck   # tsc -p across shared-types, validation, api, web
pnpm lint        # eslint . across the same 4 workspaces
pnpm test        # vitest run -- --run across api + web (shared-types/validation have no test script but are still in scope for typecheck/lint)
pnpm build       # tsc build (api) + vite build (web, includes vite-plugin-pwa manifest/sw generation)
```

As of 2026-08-23 baseline (post-rebrand-to-PocketQ stage): api = 16 test files / 89 tests, web = 55 test files / 334 tests, all passing. `apps/web` test output prints repeated `Not implemented: HTMLCanvasElement's getContext()` jsdom warnings — this is a pre-existing jsdom limitation (no `canvas` npm package installed), not a real failure; do not treat it as a regression on its own.

**Why:** confirmed by actually running all four gate commands during Stage QA rather than trusting prior reports.
**How to apply:** always run these 4 commands yourself at the start of automated verification instead of assuming CI/agent-reported pass is still true.
