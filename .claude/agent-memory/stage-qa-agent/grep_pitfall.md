---
name: grep-pitfall-node-modules
description: Recursive grep across apps/ times out because apps/web and apps/api each have their own local node_modules
metadata:
  type: project
---

`apps/web/node_modules` and `apps/api/node_modules` exist locally (pnpm workspace, but each app dir still has its own `node_modules`). A naive `grep -rln "pattern" apps/` (or similar find/grep over `apps/`) will crawl these and can exceed the 120s tool timeout, moving to background and wasting a turn.

**Why:** observed during PocketQ rebrand Stage QA — an unscoped `grep -rln "WhyMath" apps/` hung and had to be backgrounded, while a scoped version (`apps/web/src apps/api/src apps/web/index.html apps/web/vite.config.ts apps/web/.env.example apps/web/public`) returned instantly.
**How to apply:** when searching for leftover strings/old names/dead references in this repo, always scope grep to `src/`, specific config files, or use `--include="*.ts" --include="*.tsx" --include="*.html" --include="*.json" --include="*.css"` rather than bare `apps/`. Same caution applies to `references/claude-design/` (large asset tree) — scope searches there too.
