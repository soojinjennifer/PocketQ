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

**Resource-contention flakiness (2026-09-08)**: running `pnpm test` concurrently/back-to-back with `pnpm build`/`pnpm typecheck` in the same shell session can produce spurious `[vitest-pool-runner]: Timeout waiting for worker to respond` / `Failed to start forks worker` errors on a handful of unrelated test files (setup phase ballooning to 900+s instead of ~15s) — this is sandbox/OneDrive-path resource contention, not a real regression. Confirmed by re-running `pnpm test` alone immediately after: same files, 0 errors, ~15s. **How to apply:** if `pnpm test` reports worker-timeout errors on files unrelated to the current diff, don't treat it as a finding — rerun `pnpm test` in isolation (nothing else running concurrently) before concluding pass/fail.

**2026-09-12 checkpoint**: api = 44 test files / 330 tests, web = 74 test files / 477 tests, all 4 gates (typecheck/lint/test/build) green on a logo-asset + copy-only stage (`Logo.tsx` size-variant radius/object-fit/border, new `--color-accent-cyan` token, Login/RegisterPage subtitle+disclosure copy). Confirms a useful verification technique: to check whether a new `--color-accent-*`/`--color-*` CSS var actually produces a working Tailwind utility (`border-accent-cyan`, `bg-accent-cyan`, etc.) in this repo's Tailwind v4 setup, don't guess — grep `theme.css` for the var inside the `@theme inline { ... }` block (it must be re-declared there, `tokens.css` alone is not enough) and grep for an existing sibling utility class (e.g. `bg-accent-steel` in `DeleteHistoryButton.tsx`) as precedent that the pattern compiles.
